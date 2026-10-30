/* Real mouse/touch coverage for the Expand Campus facility palette. */
const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 for(const touch of [false,true]){
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:touch?844:1280,height:touch?390:800,isMobile:touch,hasTouch:touch});
  await p.goto(process.env.GAME_URL||'http://127.0.0.1:8081',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');await p.click('#lotPause');
  const state=()=>p.evaluate(()=>({cash:G.studio.cash,n:StudioLotBridge.engine.buildings.length}));
  const choose=async(type)=>{await p.click('#btnTogglePalette');await p.click('[data-btype="'+type+'"]');assert.equal(await p.$eval('#lotPaletteRoot',e=>getComputedStyle(e).display),'none','palette must not block the construction site');assert.equal(await p.$eval('#btnTogglePalette',e=>e.textContent),'Cancel build');};
  const site=async(type,valid=true)=>p.evaluate(([type,valid])=>{const e=StudioLotBridge.engine,r=document.querySelector('#studioLotCanvas').getBoundingClientRect(),sites=[];for(let x=0;x<20;x++)for(let y=0;y<20;y++){if(e.can_place(type,x,y)!==valid)continue;const q=StudioLot2D.project(x+.5,y+.5),sx=q.x+r.left,sy=q.y+r.top;if(sx>0&&sy>0&&sx<innerWidth&&sy<innerHeight&&document.elementFromPoint(sx,sy)?.id==='studioLotCanvas')sites.push({x:sx,y:sy,gridX:x,gridY:y,d:Math.hypot(sx-innerWidth/2,sy-innerHeight/2)});}return sites.sort((a,b)=>a.d-b.d)[0];},[type,valid]);
  const tap=async q=>{assert(q,'expected an uncovered site on the real canvas');if(touch)await p.touchscreen.tap(q.x,q.y);else await p.mouse.click(q.x,q.y);};
  await p.click('[data-view="executive"]');
  for(const [type,cost]of Object.entries({soundstage:15,virtual_led:25,post_suite:8,writers_bungalow:5})){
   await choose(type);assert.equal(await p.$eval('.studiolot-viewport',e=>e.dataset.lotView),'campus');const before=await state();await tap(await site(type,false));assert.deepEqual(await state(),before);assert.match(await p.$eval('#lotStatus',e=>e.textContent),/Blocked site/);
   const q=await site(type);await tap(q);if(touch){assert.deepEqual(await state(),before,'first touch is only a preview');assert.match(await p.$eval('#lotStatus',e=>e.textContent),/again to confirm/);await tap(q);}
   assert.deepEqual(await state(),{cash:before.cash-cost,n:before.n+1});assert.equal(await p.$eval('#btnTogglePalette',e=>e.textContent),'Build Facility');
  }
  console.log('PASS '+(touch?'touch 844×390':'mouse 1280×800')+' all four campus facilities, collision rejection, exact costs and confirmation');
  // All exit routes must clear build state, not merely conceal its palette.
  for(const exit of ['button','escape','room','done']){
   await choose('post_suite');if(exit==='button')await p.click('#btnTogglePalette');if(exit==='escape')await p.keyboard.press('Escape');if(exit==='room'){await p.click('[data-view="post"]');await p.click('[data-view="campus"]');}if(exit==='done'){await p.click('#btnTogglePalette');await p.click('#btnTogglePalette');await p.click('#btnClosePalette');}
   assert.equal(await p.$eval('#btnTogglePalette',e=>e.textContent),'Build Facility');assert.equal(await p.$eval('#lotPaletteRoot',e=>getComputedStyle(e).display),'none');const before=await state();await tap(await site('post_suite'));assert.deepEqual(await state(),before,'cancelled build cannot charge or construct');
  }
  await choose('virtual_led');const cash=await p.evaluate(()=>{const c=G.studio.cash;G.studio.cash=0;return c;});const before=await state(),q=await site('virtual_led');await tap(q);if(touch)await tap(q);assert.deepEqual(await state(),before);assert.match(await p.$eval('#lotStatus',e=>e.textContent),/Not enough cash/);await p.evaluate(c=>G.studio.cash=c,cash);await p.click('#btnTogglePalette');
  const saved=await state();await p.evaluate(()=>saveGame());await p.reload({waitUntil:'networkidle0'});await p.click('#btnContinue');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');assert.deepEqual(await state(),saved);assert.deepEqual(errors,[]);
  console.log('PASS '+(touch?'touch':'mouse')+' cancel / Escape / room change / Done, insufficient funds and saved campus reload');await p.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
