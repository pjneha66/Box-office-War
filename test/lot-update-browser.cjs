/* Prove a stale offline code entry cannot conceal a newly served room renderer. */
const assert=require('node:assert/strict'),fs=require('node:fs'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
const cache=fs.readFileSync('sw.js','utf8').match(/const CACHE = "([^"]+)"/)[1];
(async()=>{const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:1280,height:800});
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');
 const before=await p.evaluate(async()=>{saveGame();await navigator.serviceWorker.ready;return{cash:G.studio.cash,week:G.week,buildings:StudioLotBridge.engine.buildings.length};});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const online=await p.evaluate(async name=>{const c=await caches.open(name),url=new URL('studio-departments.js',location.href).href;await c.put(url,new Response('/* STALE ROOM RENDERER */',{headers:{'Content-Type':'text/javascript'}}));return (await fetch(url+'?v=41.0')).text();},cache);
 assert(online.includes('ROOM ART 41'));assert(!online.includes('STALE ROOM RENDERER'));console.log('PASS online versioned code bypasses stale unversioned offline entry');
 await p.setOfflineMode(true);const fallback=await p.evaluate(async()=>{const r=await fetch('studio-departments.js?v=offline-test');return r.text();});assert(fallback.includes('ROOM ART 41'));console.log('PASS offline canonical fallback is updated to the freshly served renderer');
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('#btnContinue',{visible:true});await p.click('#btnContinue');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');await p.waitForFunction(()=>StudioDepartments.departmentArtReady());
 assert.deepEqual(await p.evaluate(()=>({cash:G.studio.cash,week:G.week,buildings:StudioLotBridge.engine.buildings.length})),before);
 await p.click('[data-view="executive"]');await p.waitForFunction(()=>StudioDepartments.getCurrent()?.b_type==='executive');assert(await p.evaluate(()=>StudioDepartments.layout().furnitureReady));
 assert.deepEqual(errors,[]);console.log('PASS saved career and upgraded room still load offline, without deleting player saves');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
