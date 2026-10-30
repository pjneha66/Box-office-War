/* Optional real Chromium test: npm i --no-save puppeteer-core @sparticuz/chromium
   Run static server on 8080 first. CHROME_PATH may point to a local Chrome. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
try {
const page=await browser.newPage();await page.setViewport({width:1280,height:800,deviceScaleFactor:2});
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});
await page.click('#btnStart');await page.evaluate(()=>switchTab('studiolot'));await page.waitForSelector('#studioLotCanvas');
await page.evaluate(()=>{document.querySelectorAll('.modal-backdrop').forEach(e=>e.remove());});
await new Promise(r=>setTimeout(r,500));
await page.waitForFunction(()=>document.getElementById('studiolotGlobalStage').getBoundingClientRect().top>=document.getElementById('tabsNav').getBoundingClientRect().bottom-1);

const run=async(name,fn)=>{await fn();console.log('PASS',name);};
const clickWorld=async(x,y)=>{const p=await page.evaluate(([x,y])=>{const p=StudioLot2D.project(x,y),r=document.querySelector('#studioLotCanvas').getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};},[x,y]);await page.mouse.click(p.x,p.y);};
await run('new career, canvas DPR and asset loading',async()=>{const v=await page.evaluate(()=>{const c=document.querySelector('#studioLotCanvas');return {cash:G.studio.cash,w:c.width,css:c.getBoundingClientRect().width,images:performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/studio/')).length};});assert(v.cash>0);assert.equal(v.w,Math.round(v.css*2));assert(v.images>=15);});
await run('camera projection roundtrip',async()=>{assert(await page.evaluate(()=>{const s=StudioLot2D.project(6.25,8.25),g=StudioLot2D.unproject(s.x,s.y);return g.x===6&&g.y===8;}));});
await run('building selection opens real inspector',async()=>{await clickWorld(5.5,5.5);assert(await page.$('#lotVisit'));});
await run('zoom and drag work without click-selection on release',async()=>{const c=await page.evaluate(()=>StudioLot2D.getCamera());await page.click('#btnZoomIn');const b=await page.evaluate(()=>StudioLot2D.getCamera());assert(b.zoom>c.zoom);await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(740,470,{steps:6});await page.mouse.up();const a=await page.evaluate(()=>StudioLot2D.getCamera());assert(a.x!==b.x);await page.click('#btnResetView');});
await run('character selection and employee assignment',async()=>{
 // Persistent workers can already be indoors; do not click their obsolete campus position.
 await page.click('#lotPause');await page.evaluate(()=>{const e=StudioLotBridge.engine;for(let i=0;i<1800&&!e.agents.some(a=>a.kind_str==='writer'&&a.inside);i++)e.tick(1/30);});
 await page.click('[data-view="writers"]');await page.waitForFunction(()=>StudioDepartments.getCurrent()?.b_type==='writers_bungalow');
 const hit=await page.evaluate(()=>{const r=document.querySelector('#studioLotCanvas').getBoundingClientRect();for(let y=80;y<r.height-100;y+=4)for(let x=30;x<r.width-30;x+=4){const h=StudioDepartments.hit(x,y);if(h)return{x:r.left+x,y:r.top+y,id:h.id};}});assert(hit);await page.mouse.click(hit.x,hit.y);assert(await page.$('#lotAssign'));
 const dest=await page.evaluate(()=>StudioLotBridge.engine.buildings.find(b=>b.b_type==='executive').id);await page.select('#lotAssignment',String(dest));await page.click('#lotAssign');
 assert(await page.evaluate(([id,dest])=>{const a=StudioLotBridge.engine.agents.find(a=>a.id===id);return a.transfer_building_id===dest||a.assigned_building_id===dest;},[hit.id,dest]));
 await page.click('[data-view="campus"]');await page.click('#lotPause');
});
await run('construction invalid site, valid purchase and money accounting',async()=>{await page.click('#btnTogglePalette');await page.click('[data-btype="post_suite"]');const before=await page.evaluate(()=>({cash:G.studio.cash,n:StudioLotBridge.engine.buildings.length}));await clickWorld(4,4);assert.equal(await page.evaluate(()=>StudioLotBridge.engine.buildings.length),before.n);await clickWorld(0.5,15.5);const after=await page.evaluate(()=>({cash:G.studio.cash,n:StudioLotBridge.engine.buildings.length}));assert.equal(after.n,before.n+1);assert.equal(after.cash,before.cash-8);});
await run('pause and resume do not advance staff timers while paused',async()=>{await page.click('#lotPause');assert.equal(await page.$eval('#lotPause',e=>e.textContent),'Resume');const t=await page.evaluate(()=>StudioLotBridge.engine.agents[0].anim_timer);await new Promise(r=>setTimeout(r,200));assert.equal(await page.evaluate(()=>StudioLotBridge.engine.agents[0].anim_timer),t);await page.click('#lotPause');});

const metrics=await page.evaluate(async()=>{const times=[];let prev=performance.now();await new Promise(resolve=>{function frame(t){times.push(t-prev);prev=t;if(times.length<30)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});times.sort((a,b)=>a-b);return {frames:times.length,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],dpr:devicePixelRatio};});
console.log('MEASURED headless desktop RAF cadence (not Android GPU benchmark)',JSON.stringify(metrics));
await page.screenshot({path:'screenshots/lot-after.png'});
await run('save and loadGame resume layout and financial state',async()=>{await page.evaluate(()=>saveGame());const before=await page.evaluate(()=>({cash:G.studio.cash,n:StudioLotBridge.engine.buildings.length}));await page.evaluate(()=>{loadGame();StudioLotBridge.syncWithGameState(G);});const after=await page.evaluate(()=>({cash:G.studio.cash,n:StudioLotBridge.engine.buildings.length}));assert.deepEqual(after,before);});
assert.deepEqual(errors,[],'page errors');assert.deepEqual(failed,[],'HTTP failures');console.log('PASS no page errors or failed HTTP assets');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
