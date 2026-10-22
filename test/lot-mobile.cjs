/* Optional Chromium touch-emulation regression. Same dependencies/server as lot-browser.cjs. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
(async()=>{const b=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote'],headless:true});try{
 const p=await b.newPage();await p.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8080',{waitUntil:'networkidle0'});await p.click('#btnStart');await p.waitForSelector('#studioLotCanvas');await new Promise(r=>setTimeout(r,500));
 const t=await p.evaluate(()=>{const s=StudioLot2D.boundsForBuilding(3),r=document.querySelector('#studioLotCanvas').getBoundingClientRect();return {x:s.x+s.w/2+r.left,y:s.y+s.h*.45+r.top}});
 await p.touchscreen.tap(t.x,t.y);assert(await p.$('#lotVisit'));console.log('PASS mobile facility tap opens inspector');
 assert.equal(await p.$eval('#lotPause',e=>e.getBoundingClientRect().height),44);console.log('PASS 44px mobile controls');
 const cdp=await p.createCDPSession();const before=await p.evaluate(()=>StudioLot2D.getCamera());
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y:230}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:340,y:240}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.notEqual((await p.evaluate(()=>StudioLot2D.getCamera())).x,before.x);console.log('PASS mobile touch pan');
 const zoom=await p.evaluate(()=>StudioLot2D.getCamera().zoom);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:250,y:220,id:1},{x:350,y:220,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:220,y:220,id:1},{x:380,y:220,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert((await p.evaluate(()=>StudioLot2D.getCamera().zoom))>zoom);console.log('PASS mobile pinch zoom');
 assert.deepEqual(errors,[]);await p.screenshot({path:'screenshots/lot-mobile.png'});console.log('PASS no mobile page errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
