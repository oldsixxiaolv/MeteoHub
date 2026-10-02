'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const empty=()=>({publications:[],questions:[],researchers:[],following:[],bookmarks:[],profile:{},pages:[],projects:[]});
const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setTimeout(r,0));
async function harness(seed={}){
    const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window;
    await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
    let user=null, state=empty(), revision=0;
    const controls={put:null,pull:null,puts:0};
    w.fetch=async(url,opts={})=>{
        if(url==='/api/auth/me') return response(200,{user});
        if(url==='/api/auth/login'||url==='/api/auth/register'){
            const body=JSON.parse(opts.body);user={id:body.username==='alice'?1:2,username:body.username};
            state=empty();state.profile.realName=user.username;revision=user.id*10;
            return response(200,{user});
        }
        if(url==='/api/auth/logout'){user=null;return response(200,{});}
        if(url==='/api/state'&&opts.method==='PUT'){
            controls.puts++;
            if(controls.put)return controls.put(opts);
            const body=JSON.parse(opts.body);state=body.state;revision++;
            return response(200,{state,revision});
        }
        if(url==='/api/state')return controls.pull?controls.pull():response(200,{state,revision});
        throw Error('Unexpected '+url);
    };
    w.eval(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'));
    Object.entries(seed).forEach(([key,value])=>w.localStorage.setItem(key,JSON.stringify(value)));
    const store=w.MeteoHubStore;await store.init();
    return {w,store,controls,close:()=>w.close()};
}
(async()=>{
    // Delayed old PUT cannot publish a revision or mutate a later identity.
    let h=await harness();
    await h.store.update(s=>s.pages.push({id:'anon-note',title:'Keep anonymous'}));
    await h.store.login('alice','secret123');
    const delayed=deferred();h.controls.put=()=>delayed.promise;
    const a=h.store.update(s=>s.pages.push({id:'private-a'})).catch(e=>e);
    let queuedRan=false;
    const queued=h.store.update(s=>{queuedRan=true;s.pages.push({id:'private-queued'});}).catch(e=>e);
    await h.store.logout();
    assert.equal(h.store.get().pages[0].id,'anon-note');
    await h.store.login('bob','secret123');
    delayed.resolve(response(200,{revision:999}));
    await Promise.all([a,queued]);await tick();
    assert.equal(queuedRan,false);assert.equal(h.store.getUser().username,'bob');
    assert.equal(h.store._revision,20);assert.equal(h.store.get().pages.length,0);
    assert.equal(JSON.parse(h.w.localStorage.getItem('meteohub_state_v1_anon')).pages[0].id,'anon-note');
    h.close();
    // 401 cancels the queue before any queued mutator sees anonymous data.
    h=await harness();await h.store.update(s=>s.pages.push({id:'anon-note'}));await h.store.login('alice','secret123');
    const expired=deferred();h.controls.put=()=>expired.promise;
    const first=h.store.update(s=>s.pages.push({id:'secret'})).catch(e=>e);
    let ran=false;const second=h.store.update(s=>{ran=true;s.profile.secret='private';}).catch(e=>e);
    expired.resolve(response(401,{}));await Promise.all([first,second]);await tick();
    assert.equal(ran,false);assert.equal(h.store.getUser(),null);assert.equal(h.store.get().pages[0].id,'anon-note');assert.equal(h.controls.puts,1);h.close();
    // Failed pull preserves that user's cache and prohibits writing an unknown revision.
    h=await harness();const cache=empty();cache.pages.push({id:'cached-private'});
    h.w.localStorage.setItem('meteohub_state_v1_user_1',JSON.stringify(cache));h.controls.pull=()=>response(503,{});
    await h.store.login('alice','secret123');assert.equal(h.store.get().pages[0].id,'cached-private');
    assert.equal(JSON.parse(h.w.localStorage.getItem('meteohub_state_v1_user_1')).pages[0].id,'cached-private');
    await assert.rejects(h.store.update(s=>s.pages.push({id:'overwrite'})),/尚未读取/);assert.equal(h.controls.puts,0);h.close();
    // Failed writes retain the prior committed snapshot; retry applies exactly once.
    h=await harness();await h.store.login('alice','secret123');
    h.controls.put=()=>Promise.reject(Error('offline'));
    await assert.rejects(h.store.update(s=>s.pages.push({id:'retry'})),/网络错误/);assert.equal(h.store.get().pages.length,0);
    h.controls.put=null;await h.store.update(s=>s.pages.push({id:'retry'}));assert.equal(h.store.get().pages.length,1);
    h.controls.put=()=>response(409,{});await assert.rejects(h.store.update(s=>s.pages.push({id:'conflict'})),/冲突/);
    assert.equal(h.store.get().pages.length,1);await assert.rejects(h.store.update(()=>{}),/冲突/);h.close();
    // Legacy secrets stay in the untouched source key, never the migrated state.
    h=await harness({meteohub_users:[{id:'legacy',username:'old',password:'never-migrate-me'}],meteohub_articles:[{id:'old-paper',title:'Old research'}]});
    assert.equal(JSON.stringify(h.store.get()).includes('never-migrate-me'),false);
    assert.equal(JSON.parse(h.w.localStorage.getItem('meteohub_users'))[0].password,'never-migrate-me');
    await h.store.update(s=>{s.publications=s.publications.filter(p=>p.id!=='old-paper');});
    await h.store.login('alice','secret123');await h.store.logout();
    assert.equal(h.store.get().publications.some(p=>p.id==='old-paper'),false,'Migration must not resurrect deleted articles');
    const previous=JSON.stringify(h.store.get());
    const setItem=h.w.Storage.prototype.setItem;
    h.w.Storage.prototype.setItem=function(){throw Error('quota');};
    await assert.rejects(h.store.update(s=>s.pages.push({id:'not-saved'})),/存储/);
    assert.equal(JSON.stringify(h.store.get()),previous);
    h.w.Storage.prototype.setItem=setItem;h.close();
    console.log('STORE IDENTITY, 401 QUEUE, CACHE, RETRY, 409 OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
