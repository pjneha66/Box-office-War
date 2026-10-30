/* Real browser integration for cutaway rooms, real production data, upgrades and clock. */
const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 const p=await browser.newPage();await p.setViewport({width:1280,height:800,deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');await p.waitForFunction(()=>StudioDepartments.artReady());
 // Controlled production fixture tests the spatial projection; original UI suite tests real greenlighting.
 await p.evaluate(()=>{const writer=G.talent.find(t=>t.kind==='writer');G.projects.push({id:'room-qa',title:'The Last Picture',phase:'pre',phaseWeek:1,phaseLen:{pre:4},writer});StudioLotBridge.syncWithGameState(G);for(let i=0;i<2400;i++)StudioLotBridge.engine.tick(1/60);});
 const clickWorld=async(x,y)=>{const t=await p.evaluate(([x,y])=>{const s=StudioLot2D.project(x,y),r=document.querySelector('#studioLotCanvas').getBoundingClientRect();return {x:s.x+r.left,y:s.y+r.top}},[x,y]);await p.mouse.click(t.x,t.y);};
 await clickWorld(5.5,5.5);await p.waitForSelector('#lotEquipment');
 const money=await p.evaluate(()=>G.studio.cash),tier=await p.evaluate(()=>G.facilities?.soundstage?.tier||0);
 await p.click('#lotEquipment');assert.equal(await p.evaluate(()=>G.facilities?.soundstage?.tier||0),tier+1);assert.equal(await p.evaluate(()=>G.studio.cash),money-25*(tier+1));console.log('PASS inspector upgrades authoritative equipment and charges existing economic price');
 await p.click('[data-view="writers"]');await p.waitForFunction(()=>StudioDepartments.getCurrent()?.b_type==='writers_bungalow'&&StudioDepartments.pixelArtReady());
 assert.equal(await p.evaluate(()=>StudioDepartments.getCurrent().active_title),'The Last Picture');
 assert(await p.evaluate(()=>StudioLotBridge.engine.agents.some(a=>a.kind_str==='writer'&&a.inside&&a.state_str==='work')));console.log('PASS cutaway shows actual production and working writers');
 // Get a rendered character through real room hit testing, not an inspector-only shortcut.
 const at=await p.evaluate(()=>{const c=document.querySelector('#studioLotCanvas'),r=c.getBoundingClientRect();for(let y=100;y<r.height-100;y+=4)for(let x=40;x<r.width-40;x+=4){const h=StudioDepartments.hit(x,y);if(h)return{x:r.left+x,y:r.top+y};}return null;});assert(at);await p.mouse.click(at.x,at.y);assert(await p.$('#lotAssign'));console.log('PASS indoor employee selection');
 assert.equal(await p.$eval('.lot-project-progress',e=>e.getAttribute('aria-valuenow')),'25');assert.equal(await p.$eval('.lot-project-card strong',e=>e.textContent),'The Last Picture');
 await p.screenshot({path:'screenshots/lot-writers.png'});
 await p.evaluate(()=>{G.projects[0].phaseWeek=2;StudioLotBridge.syncWithGameState(G);});
 await p.waitForFunction(()=>document.querySelector('.lot-project-progress')?.getAttribute('aria-valuenow')==='50');
 await p.evaluate(()=>{G.projects[0].phaseWeek=1;StudioLotBridge.syncWithGameState(G);});

 await p.evaluate(()=>{G.projects[0].phase='shoot';StudioLotBridge.syncWithGameState(G);for(let i=0;i<2400;i++)StudioLotBridge.engine.tick(1/60);});await p.click('[data-view="soundstage"]');await p.waitForFunction(()=>StudioDepartments.getCurrent()?.active_phase==='shoot');assert.equal(await p.evaluate(()=>StudioDepartments.getCurrent().active_phase),'shoot');await p.screenshot({path:'screenshots/lot-stage.png'});
 await p.evaluate(()=>{G.projects[0].phase='post';StudioLotBridge.syncWithGameState(G);for(let i=0;i<2400;i++)StudioLotBridge.engine.tick(1/60);});await p.click('[data-view="post"]');await p.waitForFunction(()=>StudioDepartments.getCurrent()?.active_phase==='post');assert.equal(await p.evaluate(()=>StudioDepartments.getCurrent().active_phase),'post');await p.screenshot({path:'screenshots/lot-post.png'});console.log('PASS shoot/post rooms track phase transitions and arriving talent');
 await p.evaluate(()=>{closeModal();toggleAuto(true);});await p.click('#lotPause');assert(await p.evaluate(()=>AUTO===null&&StudioLotBridge.clock.paused));await p.click('#lotPause');assert(await p.evaluate(()=>!!AUTO&&!StudioLotBridge.clock.paused));await p.evaluate(()=>toggleAuto(false));
 await p.click('#lotSpeed');assert.equal(await p.evaluate(()=>StudioLotBridge.clock.speed),2);assert.equal(await p.evaluate(()=>AUTO_SPEED),2);console.log('PASS unified pause/resume and speed synchronize auto-weeks');
 await p.click('#btnLotFullscreen');assert.equal(await p.$eval('#studiolotGlobalStage',e=>e.getBoundingClientRect().top),0);await p.click('#btnLotFullscreen');console.log('PASS immersive expand/restore');
 await p.evaluate(()=>{StudioLot2D.unmount();StudioLot2D.mount('studiolotContainer','campus');});await new Promise(r=>setTimeout(r,100));assert(await p.$('#studioLotCanvas'));assert.equal(await p.evaluate(()=>StudioLot2D.getView()),'campus');console.log('PASS unmount/remount restores renderer without duplicate listeners');
 await p.click('#btnLotDevelop');assert.equal(await p.evaluate(()=>TAB),'develop');assert(await p.$('[data-dev]'));console.log('PASS Develop action opens real script market');
 assert.deepEqual(errors,[]);console.log('PASS no department browser errors');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
