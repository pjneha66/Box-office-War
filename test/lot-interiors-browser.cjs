const assert=require('node:assert/strict'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium').default;
(async()=>{const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{for(const touch of [false,true]){
 const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width:touch?844:1280,height:touch?390:800,isMobile:touch,hasTouch:touch});
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8081',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.waitForSelector('#studioLotCanvas');await p.click('#lotPause');
 const rooms=await p.evaluate(()=>StudioLotBridge.engine.buildings.filter(b=>b.b_type!=='studio_gate').map(b=>({id:String(b.id),type:b.b_type})));assert(rooms.some(r=>r.type==='cinema_theater'));
 const state=()=>p.evaluate(()=>({cash:G.studio.cash,buildings:JSON.stringify(StudioLotBridge.engine.buildings),facilities:JSON.stringify(G.facilities)}));const before=await state();
 const selectRoom=async id=>{await p.click('#btnLotInteriors');if(await p.$('#interiorRooms'))await p.click('#interiorRooms');assert.equal(await p.$$eval('[data-interior-room]',els=>els.length),rooms.length);await p.click('[data-interior-room="'+id+'"]');assert.equal(await p.$eval('.lot-interiors',e=>e.dataset.roomId),id);assert.equal(await p.$('#interiorTarget'),null,'no all-room overwrite selector');};
 await selectRoom(rooms[0].id);await p.select('#interior-style','premiere');await p.click('#interiorCancel');assert.equal(await p.evaluate(()=>G.lotInteriors),undefined);
 const roomPixels=room=>p.evaluate(room=>{const views={executive:'executive',writers_bungalow:'writers',post_suite:'post',soundstage:'soundstage',virtual_led:'soundstage',cinema_theater:'cinema'},c=document.createElement('canvas');c.width=1000;c.height=700;StudioDepartments.draw(c.getContext('2d'),StudioLotBridge.engine,views[room.type],Number(room.id),1000,700,null,true);return c.toDataURL();},room);
 const expected={};
 for(const [i,room]of rooms.entries()){
  const pixelsBefore=await roomPixels(room);await selectRoom(room.id);const settings={style:['premiere','slate','warm'][i%3],floor:['checker','wood','carpet'][i%3],seating:['navy','wine','sage'][i%3],decor:i%2?'awards':'plants'};
  for(const [key,value]of Object.entries(settings))await p.select('#interior-'+key,value);
  // The Save button must be physically reachable, not hidden below a landscape fold.
  await p.$eval('#interiorApply',e=>e.scrollIntoView({block:'nearest'}));assert(await p.$eval('#interiorApply',e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}));
  await p.click('#interiorApply');expected[room.id]=settings;
  await p.waitForFunction(id=>String(StudioDepartments.getCurrent()?.id)===id,{},room.id);
  await p.waitForFunction(s=>JSON.stringify(StudioDepartments.layout()?.interior)===JSON.stringify(s),{},settings);
  assert.deepEqual(await p.evaluate(()=>G.lotInteriors),expected,'only the independently selected room changes');assert.notEqual(await roomPixels(room),pixelsBefore,'actual rendered pixels must change in every individual room');
 }
 // Compare deterministic, fixed-viewport renderer pixels, not moving animation or inspector offsets.
 const render=()=>p.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=700;StudioDepartments.draw(c.getContext('2d'),StudioLotBridge.engine,'cinema',StudioLotBridge.engine.buildings.find(b=>b.b_type==='cinema_theater').id,1000,700,null,true);return c.toDataURL();});
 const cinema=rooms.find(r=>r.type==='cinema_theater');await selectRoom(cinema.id);await p.click('#interiorCancel');const styled=await render();
 await selectRoom(cinema.id);await p.click('#interiorReset');assert.notEqual(await render(),styled,'saved finishes must change actual theatre pixels');
 expected[cinema.id]={style:'original',floor:'original',seating:'original',decor:'original'};assert.deepEqual(await p.evaluate(()=>G.lotInteriors),expected,'reset only affects this theatre');assert.deepEqual(await state(),before);
 await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('#btnContinue',{visible:true});await p.click('#btnContinue');await p.waitForSelector('#studioLotCanvas');assert.deepEqual(await p.evaluate(()=>G.lotInteriors),expected);
 // Test the same editor from expanded desktop, where modal hit-testing also matters.
 if(!touch){await p.click('#btnLotFullscreen');await selectRoom(cinema.id);await p.select('#interior-seating','wine');await p.click('#interiorApply');assert.equal(await p.evaluate(id=>G.lotInteriors[id].seating,cinema.id),'wine');}
 assert.deepEqual(errors,[]);console.log('PASS '+(touch?'touch landscape':'desktop')+' separate editors for every room/theatre, reachable Save, independent apply/reset, real changed pixels, Cancel, unchanged finances and saved career reload');await p.close();
}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
