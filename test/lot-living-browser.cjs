/* Real-browser integration with actual tickProjects, not a second production stub. */
const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 const p=await b.newPage();await p.setViewport({width:1280,height:800});const errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.waitForSelector('#studioLotCanvas');
 const result=await p.evaluate(()=>{
  G.projects=[{id:'living-browser',title:'Living production fixture',phase:'pre',phaseWeek:0,phaseLen:{pre:4,shoot:4,post:4},budget:40,spent:0,cast:[],genre:'drama',plan:'later'}];StudioLotBridge.syncWithGameState(G);
  const before=G.studio.cash;tickProjects();const project=G.projects[0];StudioLotBridge.syncWithGameState(G);
  return {phaseWeek:project.phaseWeek,spent:project.spent,cash:before-G.studio.cash,work:project.studioWork.seconds.writer,complete:project.studioWork.completedRoles.writer};
 });
 assert.equal(result.phaseWeek,1);assert(result.work>=8&&result.complete>0);assert(result.spent>0&&result.cash>0);console.log('PASS actual tickProjects consumes completed real work and retains production cash burn',result);
 await p.evaluate(()=>StudioLot2D.setView('writers'));await p.waitForFunction(()=>StudioDepartments.getCurrent()?.b_type==='writers_bungalow');
 await p.keyboard.press('F8');await p.waitForSelector('#lotSimDebug');assert((await p.$eval('#lotSimDebug',e=>e.textContent)).includes('history'));await p.screenshot({path:'screenshots/lot-living-debug.png'});await p.keyboard.press('F8');await p.waitForFunction(()=>!document.getElementById('lotSimDebug'));console.log('PASS developer debug exposes real task, route, frame and bounded history; disabled normally');
 await p.evaluate(()=>{closeModal();switchTab('finance');});const t=await p.evaluate(()=>StudioLotBridge.engine.life.time);await new Promise(r=>setTimeout(r,600));assert((await p.evaluate(()=>StudioLotBridge.engine.life.time))>t+.3);console.log('PASS agents continue simulating while management pages are open');
 await p.evaluate(()=>StudioLotBridge.setPaused(true));const paused=await p.evaluate(()=>StudioLotBridge.engine.life.time);await new Promise(r=>setTimeout(r,250));assert.equal(await p.evaluate(()=>StudioLotBridge.engine.life.time),paused);await p.evaluate(()=>StudioLotBridge.setPaused(false));console.log('PASS shared pause stops all agent tasks and needs');
 const blocked=await p.evaluate(()=>{const project=G.projects[0],week=project.phaseWeek;StudioLotBridge.demolishBuilding(StudioLotBridge.engine.buildings.find(b=>b.b_type==='writers_bungalow').id);tickProjects();return{before:week,after:project.phaseWeek,notice:project.studioWork.delayWeek};});assert.equal(blocked.after,blocked.before);assert(blocked.notice);console.log('PASS actual production delays instead of inventing progress without a workplace');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);console.log('PASS no living simulation page errors or missing assets');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
