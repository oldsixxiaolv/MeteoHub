'use strict';
const assert = require('node:assert/strict');
const { loadDom, makeHostStoreFactory } = require('./qa-harness');
(async () => {
    let listeners;
    const h = loadDom({hostStoreFactory(win) {
        listeners = new Set();
        const add = win.addEventListener.bind(win), remove = win.removeEventListener.bind(win);
        win.addEventListener = (name, fn, opts) => { if(name==='meteohub:state-changed') listeners.add(fn); return add(name,fn,opts); };
        win.removeEventListener = (name, fn, opts) => { if(name==='meteohub:state-changed') listeners.delete(fn); return remove(name,fn,opts); };
        return makeHostStoreFactory(win);
    }});
    for(let i=0;i<5;i++) h.window.MeteoWorkspace.mount(h.root);
    assert.equal(listeners.size, 1, 'Exactly one live host event subscription');
    h.click(h.$('.workspace-empty [data-act="create"]'));
    await h.tick(30);
    assert.equal(h.window.MeteoHubStore.get().pages.length, 1, 'One action executes once after remounts');
    h.dom.window.close();
    console.log('REMOUNT SUBSCRIPTION OK');
})().catch(e => { console.error(e); process.exitCode=1; });
