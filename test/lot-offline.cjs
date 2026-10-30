/* Optional Chromium: a saved career and first-visit art work without network. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{
 const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});
 try{
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.setViewport({width:1280,height:800});
  await p.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});
  await p.click('#btnStart');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');
  const before=await p.evaluate(async()=>{saveGame();await navigator.serviceWorker.ready;return {cash:G.studio.cash,buildings:StudioLotBridge.getLotState().buildings.length};});
  await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await p.setOfflineMode(true);await p.reload({waitUntil:'domcontentloaded'});
  await p.waitForSelector('#btnContinue');await p.click('#btnContinue');await p.evaluate(()=>switchTab('studiolot'));await p.waitForSelector('#studioLotCanvas');
  const after=await p.evaluate(()=>({cash:G.studio.cash,buildings:StudioLotBridge.getLotState().buildings.length}));
  assert.deepEqual(after,before);assert(after.buildings>=6);
  const assets=await p.evaluate(async()=>{
   const names=['department-furniture.png','department-furniture.json','screening-still.png','story-furniture.png','story-furniture.json','actors.json', 'audience.png', 'backlot.png', 'cameraman.png', 'cinema_theater.png', 'director.png', 'editor.png', 'executive.png', 'post_suite.png', 'producer.png', 'soundstage.png', 'star_actor.png', 'studio_gate.png', 'virtual_led.png', 'writer.png', 'writers_bungalow.png'];
   const paths=names.map(name=>'assets/studio/'+name).concat(['assets/vendor/kenney-cars/delivery_SE-trim.png','assets/vendor/kenney-cars/sedanSports_SE-trim.png','assets/vendor/kenney-furniture/atlas.png','assets/vendor/kenney-furniture/atlas.json','assets/vendor/kenney-nature/tree_palmDetailedTall_SE-trim.png','assets/vendor/kenney-nature/plant_bushDetailed_SE-trim.png']);
   paths.push(...Array.from({length:24},(_,i)=>'assets/studio/people/'+i+'.png'),'assets/studio/people/portraits.png','assets/studio/people/manifest.json','assets/vendor/lpc-revised/NOTICE.md');
   return Promise.all(paths.map(async name=>{const r=await fetch(name);return {name,ok:r.ok&&(!name.endsWith('.png')||r.headers.get('content-type')?.includes('image/png'))};}));
  });
  assert(assets.every(a=>a.ok),'Missing offline art: '+JSON.stringify(assets.filter(a=>!a.ok)));
  for(const view of ['writers','soundstage','post','cinema','executive']){
   await p.evaluate(view=>StudioLot2D.setView(view),view);
   await p.waitForFunction(()=>!!StudioDepartments.getCurrent());
  }
  await p.waitForFunction(()=>StudioActors.people.size===24&&[...StudioActors.people.values()].every(e=>e.loaded));
  await p.click('#btnLotTalent');await p.waitForSelector('.people-grid');assert.equal(await p.$$eval('[data-crew-agent]',els=>els.length),12);await p.evaluate(()=>closeModal());
  assert.deepEqual(errors,[]);console.log('PASS offline career reload, preserved cash/layout, all actor/facility assets, first-visit rooms',after);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
