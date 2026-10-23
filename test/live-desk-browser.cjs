/* LIVE DESK responsive browser verification (not committed):
   every sub-tab at 320/390/414/844/1024/1440 — zero doc/#view/command
   overflow, no clipped panel children, no console errors, bottom-nav
   clearance at 390, offline (external requests blocked), screenshots. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
const OUT='/tmp/live-shots';
(async()=>{
  if(process.platform==='linux'){
    const {inflate}=await import('../node_modules/@sparticuz/chromium/build/lambdafs.js');
    const {resolve}=require('node:path');
    await inflate(resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
    process.env.LD_LIBRARY_PATH=['/tmp/al2023/lib',process.env.LD_LIBRARY_PATH||''].join(':');
  }
  fs.mkdirSync(OUT,{recursive:true});
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
  const errors=[];
  try{
    const page=await browser.newPage();
    page.on('pageerror',e=>errors.push('pageerror: '+e.message));
    page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
    await page.setRequestInterception(true);
    page.on('request',r=>{ const u=r.url(); if(/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u)||u.startsWith('data:')||u.startsWith('blob:')) r.continue(); else r.abort(); });
    await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle0',timeout:60000});
    await page.evaluate(()=>{
      SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};
      newGame(DATA.ARCHETYPES[1].id,'Live Desk Browser',SEL);enterApp(false);closeModal();
      G.studio.cash=200;G.studio.rep=62;
      G.films.push({id:99001,title:'Midnight Harbor',genre:'thriller',quality:{overall:88,critic:80,aud:82},gross:140,critics:84,releaseWeek:G.week,craft:{script:90}});
      G.films.push({id:99002,title:'The Last Projectionist',genre:'drama',quality:{overall:79,critic:85,aud:75},gross:55,critics:81,releaseWeek:G.week,craft:{script:84}});
      G.series.push({id:99051,title:'Harbor Nights',genre:'drama'});
      unlockLiveChannel('bow_family');
      scheduleChannelSlot('bow_movies',20,'movie',99001,'Midnight Harbor');
      scheduleChannelSlot('bow_movies',21,'movie',99002,'The Last Projectionist');
      G.live.events.submissions['cannes']=99002;
      G.live.events.premieres.push({filmId:99001,city:'london',week:G.week});
      G.live.streaming.live=true;G.live.streaming.ccv=2.4;G.live.streaming.peakCcv=3.1;G.live.streaming.totalHours=504;G.live.streaming.subConversions=1.4;
      G.live.stats.totalBroadcastRev=96.5;G.live.stats.totalViewersReached=412.3;G.live.stats.festivalsWon=1;
      switchTab('live');render();
    });
    const subs=['home','linear','stream','events','studio'];
    const widths=[[320,780],[390,844],[414,896],[844,414],[1024,768],[1440,950]];
    for(const [width,height] of widths){
      await page.setViewport({width,height});
      for(const sub of subs){
        await page.evaluate(s=>{G.live.subTab=s;G.live.activeSub=s;render();window.scrollTo(0,0);},sub);
        await new Promise(r=>setTimeout(r,120));
        const m=await page.evaluate(()=>{
          const de=document.documentElement, view=document.querySelector('#view'), deck=document.querySelector('.command-live');
          const vr=view.getBoundingClientRect();
          let clipped=[];
          deck.querySelectorAll('.produce-panel, .live-channel, .live-event, .live-host, .live-epg-row, .live-row, .live-kpi').forEach(el=>{
            const r=el.getBoundingClientRect();
            if(r.width && (r.right>vr.right+1.5 || r.left<vr.left-1.5)) clipped.push(el.className+':'+Math.round(r.right-vr.right));
          });
          return {
            docOverflow: de.scrollWidth-window.innerWidth,
            viewOverflow: view.scrollWidth-view.clientWidth,
            deckOverflow: deck?deck.scrollWidth-deck.clientWidth:999,
            clipped: clipped.slice(0,5),
            chips: document.querySelectorAll('[data-livesub]').length,
            hasDeck: !!deck
          };
        });
        assert(m.hasDeck,`${sub}@${width}: command-live missing`);
        assert.equal(m.chips,5,`${sub}@${width}: five chips (got ${m.chips})`);
        assert(m.docOverflow<=1,`${sub}@${width}: document overflow ${m.docOverflow}px`);
        assert(m.viewOverflow<=1,`${sub}@${width}: #view overflow ${m.viewOverflow}px`);
        assert(m.deckOverflow<=1,`${sub}@${width}: command deck overflow ${m.deckOverflow}px`);
        assert.deepEqual(m.clipped,[],`${sub}@${width}: clipped children ${m.clipped.join(',')}`);
      }
      console.log(`PASS width ${width}: all five sub-tabs, zero overflow/clipping`);
    }
    /* 390px: final panel clears the fixed bottom navigation */
    await page.setViewport({width:390,height:844});
    for(const sub of subs){
      await page.evaluate(s=>{G.live.subTab=s;G.live.activeSub=s;render();},sub);
      const clear=await page.evaluate(()=>{
        const nav=document.querySelector('.bottomnav');
        const panels=[...document.querySelectorAll('.command-live .produce-panel')];
        const last=panels[panels.length-1];
        window.scrollTo(0,999999);
        const lr=last.getBoundingClientRect();
        const nr=nav?nav.getBoundingClientRect():{top:innerHeight};
        return {gap: Math.round(nr.top-lr.bottom), navFound: !!nav};
      });
      assert(clear.gap>=0,`${sub}@390: last panel clears bottom nav (gap ${clear.gap}px, nav found: ${clear.navFound})`);
    }
    console.log('PASS 390px: final panel clears the fixed bottom navigation on every sub-tab');
    /* screenshots: mobile + desktop, top/middle/bottom per sub-tab */
    for(const [width,height,tag] of [[390,844,'mobile'],[1440,950,'desktop']]){
      await page.setViewport({width,height});
      for(const sub of subs){
        await page.evaluate(s=>{G.live.subTab=s;G.live.activeSub=s;render();window.scrollTo(0,0);},sub);
        await new Promise(r=>setTimeout(r,150));
        await page.screenshot({path:`${OUT}/live-${sub}-${tag}-top.png`});
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight/2));
        await new Promise(r=>setTimeout(r,100));
        await page.screenshot({path:`${OUT}/live-${sub}-${tag}-mid.png`});
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
        await new Promise(r=>setTimeout(r,100));
        await page.screenshot({path:`${OUT}/live-${sub}-${tag}-bottom.png`});
      }
    }
    console.log('screenshots → '+OUT+' ('+fs.readdirSync(OUT).length+' files)');
    assert.deepEqual(errors,[],'console/page errors: '+errors.join(' ; '));
    console.log('PASS live browser: responsive + offline (external requests blocked) + screenshots');
  }finally{ await browser.close(); }
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
