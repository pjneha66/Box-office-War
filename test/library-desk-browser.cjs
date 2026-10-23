/* LIBRARY DESK responsive browser verification (screenshots out of Git):
   every section at 320/390/414/844/1024/1440 — zero doc/#view/deck overflow,
   no clipped panel children, no console errors, bottom-nav clearance at 390,
   offline (external requests blocked), screenshots to /tmp/library-shots. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
const OUT='/tmp/library-shots';
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
      newGame(DATA.ARCHETYPES[1].id,'Library Desk Browser',SEL);enterApp(false);closeModal();
      G.studio.cash=600;G.studio.rep=64;G.week=64;
      const film=(id,title,genre,scale,budget,ww,week,extra)=>Object.assign({id,title,genre,scale,budget,ww,dom:Math.round(ww*0.45),intl:Math.round(ww*0.55),releaseWeek:week,
        quality:{overall:70,critic:72,aud:70},awards:[],weekly:[],inTheaters:false,soldTo:null,streamingOriginal:false,onOwn:false,onOwnPlatform:false,profit:Math.round(ww*0.3-budget*0.5),window:45},extra||{});
      G.films=[
        film(99001,'Shelf Titan','action','tentpole',180,520,10,{franchiseName:'Titan Verse',inTheaters:true}),
        film(99002,'Ally One','action','mid',70,190,22,{franchiseName:'Titan Verse'}),
        film(99003,'Quiet Ledger','drama','indie',18,64,40,{}),
        film(99004,'Neon Static','scifi','mid',44,0,52,{soldTo:'Netflix',streamingOriginal:true,profit:12}),
        film(99005,'The Long Winter','drama','mid',36,88,58,{}),
        film(99006,'Paper Kingdom','fantasy','tentpole',150,410,60,{soldTo:'AuditFlix',onOwn:true,onOwnPlatform:true}),
        film(99007,'Comedy Hour','comedy','indie',9,31,62,{}),
        film(99008,'Desert Run','action','mid',52,120,63,{})
      ];
      G.series=[
        {id:99101,title:'Cold Ledger',genre:'drama',platform:'own',budget:30,eps:8,status:'renewal_pending',episodes:8,
          seasons:[{num:1,quality:70,viewership:64,episodes:8,when:56},{num:2,quality:74,viewership:71,episodes:8,when:62}]},
        {id:99102,title:'Titan: Origins',genre:'action',platform:'netflix',budget:40,eps:10,status:'ended',franchiseName:'Titan Verse',
          seasons:[{num:1,quality:66,viewership:52,episodes:10,when:48}]}
      ];
      G.maVault=[{id:99301,title:'Indie Import',genre:'comedy',quality:61,weight:7,week:G.week+6,dead:false,soldTo:null,source:'library'},
                 {id:99302,title:'Archive Print',genre:'drama',quality:55,weight:5,week:G.week+12,dead:false,soldTo:null,source:'library'}];
      G.maLibraries=1;
      G.maDeals=[{kind:'library',price:52,week:40,name:'Indie library bundle'}];
      G.maOffers=[{id:99401,kind:'library',name:'Indie library bundle',icon:'📚',price:48,blurb:'A boutique distributor back catalogue — permanent catalog value and weekly royalties.',expires:G.week+5}];
      G.streamer=G.streamer||{ name:'AuditFlix', subs:14, peak:14, churn:0.008, income:0, totalRev:0, lastContent:G.week, tier:'premium', sportsPower:1 };
      G.restorationVault=null;
      switchTab('library');render();
    });
    const subs=['overview','films','series','rights','catalogue','physical','restoration'];
    const widths=[[320,780],[390,844],[414,896],[844,414],[1024,768],[1440,950]];
    for(const [width,height] of widths){
      await page.setViewport({width,height});
      for(const sub of subs){
        await page.evaluate(s=>{G.libState.sub=s;render();window.scrollTo(0,0);},sub);
        await new Promise(r=>setTimeout(r,120));
        const m=await page.evaluate(()=>{
          const de=document.documentElement, view=document.querySelector('#view'), deck=document.querySelector('.command-library');
          const vr=view.getBoundingClientRect();
          const clipped=[];
          if(deck) deck.querySelectorAll('.produce-panel, .library-row, .library-tr, .library-deal, .library-need, .command-metric, .command-heading, .command-section-nav, .library-mini-row, .library-tier').forEach(el=>{
            const r=el.getBoundingClientRect();
            if(r.width && (r.right>vr.right+1.5 || r.left<vr.left-1.5)) clipped.push((el.className||'?').toString().slice(0,40)+':'+Math.round(r.right-vr.right));
          });
          return {
            docOverflow: de.scrollWidth-window.innerWidth,
            viewOverflow: view.scrollWidth-view.clientWidth,
            deckOverflow: deck?deck.scrollWidth-deck.clientWidth:999,
            clipped: clipped.slice(0,5),
            chips: document.querySelectorAll('[data-libsub]').length,
            legacy: document.querySelectorAll('#view .card, #view .section-title, #view .cost-line, #view .stat-hero, #view .subnav-pills').length,
            hasDeck: !!deck,
            heading: (document.querySelector('.command-edition')||{}).textContent||''
          };
        });
        assert(m.hasDeck,`${sub}@${width}: command-library missing`);
        assert(m.heading.includes('LIBRARY DESK'),`${sub}@${width}: desk header missing`);
        assert.equal(m.chips,7,`${sub}@${width}: seven chips (got ${m.chips})`);
        assert(m.docOverflow<=1,`${sub}@${width}: document overflow ${m.docOverflow}px`);
        assert(m.viewOverflow<=1,`${sub}@${width}: #view overflow ${m.viewOverflow}px`);
        assert(m.deckOverflow<=1,`${sub}@${width}: command deck overflow ${m.deckOverflow}px`);
        assert.deepEqual(m.clipped,[],`${sub}@${width}: clipped children ${m.clipped.join(',')}`);
        assert.equal(m.legacy,0,`${sub}@${width}: legacy chrome leaked into the desk (${m.legacy})`);
      }
      console.log(`PASS width ${width}: all seven sections, zero overflow/clipping`);
    }
    /* 390px: final panel clears the fixed bottom navigation */
    await page.setViewport({width:390,height:844});
    for(const sub of subs){
      await page.evaluate(s=>{G.libState.sub=s;render();},sub);
      const clear=await page.evaluate(()=>{
        const nav=document.querySelector('.bottomnav');
        const panels=[...document.querySelectorAll('.command-library .produce-panel')];
        const last=panels[panels.length-1];
        window.scrollTo(0,999999);
        const lr=last.getBoundingClientRect();
        const nr=nav?nav.getBoundingClientRect():{top:innerHeight};
        return {gap: Math.round(nr.top-lr.bottom), navFound: !!nav};
      });
      assert(clear.gap>=0,`${sub}@390: last panel clears bottom nav (gap ${clear.gap}px, nav found: ${clear.navFound})`);
    }
    console.log('PASS 390px: final panel clears the fixed bottom navigation on every section');
    /* the search field keeps focus while the shelf filters (no full repaint) */
    await page.setViewport({width:1440,height:950});
    await page.evaluate(()=>{G.libState.sub='films';render();});
    await page.click('#libSearch');
    await page.type('#libSearch','titan',{delay:20});
    await new Promise(r=>setTimeout(r,350));
    const typed=await page.evaluate(()=>({
      focused: document.activeElement && document.activeElement.id,
      rows: document.querySelectorAll('[data-lib-film]').length,
      count: (document.querySelector('#libCount')||{}).textContent||''
    }));
    assert.equal(typed.focused,'libSearch','the search field keeps focus while filtering');
    assert.equal(typed.rows,2,'typing filters the shelf in place (title + franchise match)');
    assert(typed.count.includes('2 film'),'the live count follows the filter');
    console.log('PASS live search: focus kept, shelf filtered in place');
    /* screenshots: mobile + desktop, top/middle/bottom per section */
    for(const [width,height,tag] of [[390,844,'mobile'],[1440,950,'desktop']]){
      await page.setViewport({width,height});
      for(const sub of subs){
        await page.evaluate(s=>{G.libState={sub:s};render();window.scrollTo(0,0);},sub);
        await new Promise(r=>setTimeout(r,150));
        await page.screenshot({path:`${OUT}/library-${sub}-${tag}-top.png`});
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight/2));
        await new Promise(r=>setTimeout(r,100));
        await page.screenshot({path:`${OUT}/library-${sub}-${tag}-mid.png`});
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
        await new Promise(r=>setTimeout(r,100));
        await page.screenshot({path:`${OUT}/library-${sub}-${tag}-bottom.png`});
      }
    }
    console.log('screenshots → '+OUT+' ('+fs.readdirSync(OUT).length+' files)');
    assert.deepEqual(errors,[],'console/page errors: '+errors.join(' ; '));
    console.log('PASS library browser: responsive + offline (external requests blocked) + screenshots');
  }finally{ await browser.close(); }
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
