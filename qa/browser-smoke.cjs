const {chromium}=require('playwright-core');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {url}=JSON.parse(fs.readFileSync(__dirname+'/preview-runtime.json'));
 await page.goto(url);await page.waitForFunction(()=>window.MeteoHubStore?.get());
 await page.screenshot({path:__dirname+'/desktop-overview.png',fullPage:true});
 await page.click('[data-action="goto"][data-page="publications"][data-arg="new"]');
 await page.waitForSelector('#publicationModal.active',{timeout:5000});
 console.log('modal',await page.locator('#publicationModal').getAttribute('class'));
 console.log('errors',errors);
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
