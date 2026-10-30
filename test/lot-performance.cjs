/* Long-lived actual browser rendering; duration per room configurable, default 30s x 4. */
const fs=require('node:fs'),assert=require('node:assert/strict'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 const p=await b.newPage();await p.setViewport({width:1280,height:800,deviceScaleFactor:2});const errors=[],failed=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>failed.push(r.url()));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');
 await p.evaluate(()=>{G.projects.push({id:'soak',title:'Performance QA fixture',phase:'pre',phaseWeek:1,phaseLen:{pre:4}});StudioLotBridge.syncWithGameState(G);for(let i=0;i<10;i++)StudioLotBridge.engine.trigger_box_office_surge('Crowd QA '+i,30);});
 const cdp=await p.createCDPSession();await cdp.send('HeapProfiler.collectGarbage');const initial=await cdp.send('Runtime.getHeapUsage');
 const measurements=[];
 for(const view of ['campus','writers','soundstage','post']){
  await p.evaluate(view=>{G.projects[0].phase=view==='post'?'post':view==='soundstage'?'shoot':'pre';StudioLotBridge.syncWithGameState(G);StudioLot2D.setView(view);StudioLot2D.resetDiagnostics();},view);
  const result=await p.evaluate(async duration=>{
    const deltas=[];let last=performance.now();const start=last;
    await new Promise(resolve=>{function frame(t){deltas.push(t-last);last=t;if(t-start<duration)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    deltas.shift();deltas.sort((a,b)=>a-b);const d=StudioLot2D.diagnostics();
    return {seconds:(last-start)/1000,frames:deltas.length,medianMs:deltas[Math.floor(deltas.length*.5)],p95Ms:deltas[Math.floor(deltas.length*.95)],fps:deltas.length/((last-start)/1000),meanRenderMs:d.renderMs/Math.max(1,d.frames),meanSimulationMs:d.simulationMs/Math.max(1,d.frames),maxRenderMs:d.maxRenderMs,agents:d.agents,quality:d.quality,pixelRatio:d.pixelRatio,canvasElements:document.querySelectorAll('#studioLotCanvas').length};
  },Number(process.env.SOAK_SECONDS||30)*1000);
  measurements.push({view,...result});assert.equal(result.canvasElements,1);console.log('MEASURED',JSON.stringify(measurements.at(-1)));
 }
 await cdp.send('HeapProfiler.collectGarbage');const final=await cdp.send('Runtime.getHeapUsage');
 const report={viewport:'1280x800 DPR2',environment:'headless Chromium, software graphics; not physical Android',measurements,heapBefore:initial.usedSize,heapAfter:final.usedSize,heapDelta:final.usedSize-initial.usedSize,errors,failed};
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/lot-performance.json',JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 assert(final.usedSize-initial.usedSize<8*1024*1024,'Retained JS heap grew more than 8MiB');assert(measurements.every(m=>m.fps>=45&&m.p95Ms<=50),'Headless sustained rendering missed 45 FPS / 50ms p95 threshold');console.log('PASS multi-room render soak, no errors/assets lost, bounded retained JS heap');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
