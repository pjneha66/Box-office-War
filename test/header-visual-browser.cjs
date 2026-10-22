/* Actual computed-style/layout regression: catches ID-specific legacy !important
   rules which DOM-only tests cannot detect. Optional browser test dependencies. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
(async()=>{
 if(process.platform==='linux'){
   const {inflate}=await import('../node_modules/@sparticuz/chromium/build/lambdafs.js');
   const {resolve}=require('node:path');
   await inflate(resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
   process.env.LD_LIBRARY_PATH=['/tmp/al2023/lib',process.env.LD_LIBRARY_PATH||''].join(':');
 }
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
  const page=await browser.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080/',{waitUntil:'networkidle0'});
  await page.evaluate(()=>{SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Visual Test Studio',SEL);enterApp(false);closeModal();switchTab('dashboard');});
  for(const [width,height] of [[1440,900],[844,390],[390,844]]){
   await page.setViewport({width,height});
   const header=await page.evaluate(()=>{const el=document.querySelector('.topbar'),chip=document.querySelector('.command-header-ledger .chip'),btn=document.querySelector('#btnWeek');return{overflow:el.scrollWidth>el.clientWidth+2,pseudo:getComputedStyle(chip,'::before').content,shadow:getComputedStyle(btn).boxShadow};});
   assert(!header.overflow,'header overflows at '+width);assert.equal(header.pseudo,'none');assert.equal(header.shadow,'none');
   for(const screen of ['settings','guide']){
    await page.evaluate(s=>{closeModal();s==='settings'?settingsModal():helpModal()},screen);
    const style=await page.evaluate(()=>{const modal=document.querySelector('.command-modal'),head=modal.querySelector('.modal-head'),c=getComputedStyle(modal);return{border:c.borderTopWidth,image:c.backgroundImage,headImage:getComputedStyle(head).backgroundImage,overflow:modal.scrollWidth>modal.clientWidth+2,box:modal.getBoundingClientRect().toJSON()};});
    assert.equal(style.border,'1px');assert.equal(style.image,'none');assert.equal(style.headImage,'none');assert(!style.overflow,screen+' overflows at '+width);assert(style.box.width<=width);
    if(screen==='guide')assert.equal(await page.$eval('.guide-topic',e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
   }
   await page.evaluate(()=>closeModal());
  }
  assert.deepEqual(errors,[]);console.log('PASS real-browser legacy chrome isolation and header/settings/guide layout at desktop, phone landscape and portrait sizes');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
