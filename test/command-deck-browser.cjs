/* Run against the static game server; browser dependencies are optional local tools. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:1440,height:900});
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});
 await page.evaluate(()=>{SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Lighthouse Pictures',SEL);enterApp(false);switchTab('dashboard');});
 await page.waitForSelector('.command-deck');
 await page.evaluate(()=>{document.querySelector('#modalRoot').innerHTML='';});
 assert.equal(await page.$eval('.command-lanes',e=>e.children.length),3);
 assert.equal(await page.$eval('.command-telemetry',e=>e.children.length),4);
 await page.screenshot({path:'/tmp/command-dashboard.png'});
 await page.click('.command-brief .command-primary');
 await page.waitForFunction(()=>TAB==='develop');
 await page.evaluate(()=>switchTab('studio'));await page.waitForSelector('.command-campus');
 assert.equal(await page.$$eval('.campus-building',a=>a.length),4);
 await page.screenshot({path:'/tmp/command-studio.png'});
 await page.click('#btnOpenFacilities');await page.waitForSelector('.modal');
 await page.evaluate(()=>{document.querySelector('#modalRoot').innerHTML='';switchTab('studio');});
 await page.waitForSelector('.command-campus');await page.click('.command-shortcuts [data-studiosub="csuite"]');
 await page.waitForFunction(()=>STUDIO_SUB==='csuite');
 await page.evaluate(()=>{STUDIO_SUB='lot';switchTab('dashboard');G.projects.push({title:'Test <film>',genre:'Drama',phase:'shooting',budget:20});render();});
 await page.waitForFunction(()=>document.querySelector('.command-project'));
 assert((await page.$eval('.command-project',e=>e.textContent)).includes('Test <film>'));
 for(const [width,height] of [[1280,720],[844,390],[390,844]]){
 await page.setViewport({width,height});
 for(const tab of ['dashboard','studio']){
 await page.evaluate(t=>{STUDIO_SUB='lot';switchTab(t)},tab);await page.waitForSelector('.command-deck');
 const overflow=await page.$eval('.command-deck',e=>e.scrollWidth>e.clientWidth+2);assert(!overflow,`${tab} overflows at ${width}`);
 }
 }
 assert.deepEqual(errors,[]);console.log('PASS command deck: live metrics, empty/active slate, navigation, facilities, sub-tabs, and landscape/portrait bounds');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
