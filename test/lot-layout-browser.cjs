/* Placement regressions: actual room bounds and inspector/toolbars, not just clicks. */
const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 for(const viewport of [{width:1280,height:800},{width:844,height:390,isMobile:true,hasTouch:true}]){
  const page=await browser.newPage();await page.setViewport(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});await page.click('#btnStart');await page.evaluate(()=>switchTab('studiolot'));await page.waitForSelector('#studioLotCanvas');
  await page.evaluate(()=>{G.studio.name='A Very Long Production Company Name';render();});
  await page.waitForFunction(()=>document.getElementById('studiolotGlobalStage').getBoundingClientRect().top>=document.getElementById('tabsNav').getBoundingClientRect().bottom-1);
  for(const view of ['writers','post','soundstage','cinema','executive']){
   await page.evaluate(v=>StudioLot2D.setView(v),view);await page.waitForFunction(v=>StudioDepartments.getCurrent()&&StudioLot2D.getView()===v,{},view);
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const l=await page.evaluate(()=>StudioDepartments.layout()),a=l.area,b=l.bounds;
   assert(b.x>=a.x-.5&&b.y>=a.y-.5&&b.x+b.w<=a.x+a.w+.5&&b.y+b.h<=a.y+a.h+.5,`${viewport.width} ${view} room clipped: ${JSON.stringify(l)}`);
   assert(l.stations.every((s,i)=>s.x===3+i%3*3&&s.y===3+Math.floor(i/3)*3),'Visible stations drifted from engine targets');
  }
  await page.evaluate(()=>StudioLot2D.setView('campus'));
  const target=await page.evaluate(()=>{const b=StudioLot2D.boundsForBuilding(3),r=document.querySelector('#studioLotCanvas').getBoundingClientRect();return {x:r.left+b.x+b.w/2,y:r.top+b.y+b.h*.45};});
  await page.mouse.click(target.x,target.y);await page.waitForSelector('#lotVisit');
  const boxes=await page.evaluate(()=>{const r=id=>document.querySelector(id).getBoundingClientRect().toJSON();return{panel:r('#lotInspectorRoot'),top:r('.kairo-top-bar'),deck:r('.kairo-bottom-deck')};});
  assert(boxes.panel.top>=boxes.top.bottom,'Inspector overlaps department toolbar');assert(boxes.panel.bottom<=boxes.deck.top,'Inspector overlaps command deck');
  assert.deepEqual(errors,[]);console.log('PASS',viewport.width+'×'+viewport.height,'five fitted rooms, canonical workstation grid, header and inspector bounds');await page.close();
 }
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
