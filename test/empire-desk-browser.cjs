/* EMPIRE DESK responsive browser verification (screenshots out of Git):
   every sub-tab at 320/390/414/844/1024/1440 — zero doc/#view/command
   overflow, no clipped panel children, no console errors, bottom-nav
   clearance at 390, offline (external requests blocked), screenshots. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;
const OUT='/tmp/empire-shots';
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
      newGame(DATA.ARCHETYPES[1].id,'Empire Desk Browser',SEL);enterApp(false);closeModal();
      G.studio.cash=600;G.studio.rep=62;G.week=20;
      G.films.push({id:99001,title:'Shelf Titan',genre:'action',budget:80,ww:220,opening:70,profit:60,releaseWeek:1,quality:{overall:82,critic:80,aud:84}});
      G.films.push({id:99002,title:'Ally One',genre:'action',budget:60,ww:180,opening:55,profit:38,releaseWeek:2,quality:{overall:78,critic:75,aud:80}});
      G.franchises.push({id:99001,name:'Titan Verse',tier:3,entries:[{filmId:99001,title:'Shelf Titan',ww:220,week:1,opening:70,criticAvg:80,profit:60}],ww:220,merch:1,park:1,gameSold:0,decay:1,genre:'action',earned:12.5,built:1,fatigue:0.2});
      G.franchises.push({id:99002,name:'Titan Ally',tier:2,entries:[{filmId:99002,title:'Ally One',ww:180,week:2,opening:55,criticAvg:75,profit:38}],ww:180,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:4,built:2,fatigue:0.5});
      G.franchises.push({id:'cust_99003',name:'Custom Quest',tier:1,entries:[],ww:0,merch:0,park:0,gameSold:0,decay:1,genre:'fantasy',earned:0,built:1,fatigue:0,custom:true});
      G.universes=[{id:99100,name:'Probe Verse',frIds:[99001,99002],subFranchises:['Titan Verse','Titan Ally'],leadFranchiseId:99001,leadFranchiseName:'Titan Verse',founded:1}];
      G.ipMarket=[{id:99200,kind:'custom',genre:'drama',title:'Market Pick',price:22,boost:7,buzz:0.1,born:1,custom:true}];
      unlockLabel();signArtist('nova');
      switchTab('empire');render();
    });
    const subs=['home','franchises','universes','divisions','endgame'];
    const widths=[[320,780],[390,844],[414,896],[844,414],[1024,768],[1440,950]];
    for(const [width,height] of widths){
      await page.setViewport({width,height});
      for(const sub of subs){
        await page.evaluate(s=>{G.empire.subTab=s;G.empire.activeSub=s;render();window.scrollTo(0,0);},sub);
        await new Promise(r=>setTimeout(r,120));
        const m=await page.evaluate(()=>{
          const de=document.documentElement, view=document.querySelector('#view'), deck=document.querySelector('.command-empire');
          const vr=view.getBoundingClientRect();
          let clipped=[];
          deck.querySelectorAll('.produce-panel, .empire-block, .empire-row, .empire-meter, .command-metric, .command-heading, .command-section-nav, .fr-meters, .fr-actions, .timeline-item').forEach(el=>{
            const r=el.getBoundingClientRect();
            if(r.width && (r.right>vr.right+1.5 || r.left<vr.left-1.5)) clipped.push(el.className+':'+Math.round(r.right-vr.right));
          });
          return {
            docOverflow: de.scrollWidth-window.innerWidth,
            viewOverflow: view.scrollWidth-view.clientWidth,
            deckOverflow: deck?deck.scrollWidth-deck.clientWidth:999,
            clipped: clipped.slice(0,5),
            chips: document.querySelectorAll('[data-empiresub]').length,
            legacy: document.querySelectorAll('#view .card, #view .section-title, #view .cost-line, #view .stat-hero, #view .fr-meter').length,
            hasDeck: !!deck
          };
        });
        assert(m.hasDeck,`${sub}@${width}: command-empire missing`);
        assert.equal(m.chips,5,`${sub}@${width}: five chips (got ${m.chips})`);
        assert(m.docOverflow<=1,`${sub}@${width}: document overflow ${m.docOverflow}px`);
        assert(m.viewOverflow<=1,`${sub}@${width}: #view overflow ${m.viewOverflow}px`);
        assert(m.deckOverflow<=1,`${sub}@${width}: command deck overflow ${m.deckOverflow}px`);
        assert.deepEqual(m.clipped,[],`${sub}@${width}: clipped children ${m.clipped.join(',')}`);
        assert.equal(m.legacy,0,`${sub}@${width}: legacy chrome leaked into the desk`);
      }
      console.log(`PASS width ${width}: all five sub-tabs, zero overflow/clipping`);
    }
    /* 390px: final panel clears the fixed bottom navigation */
    await page.setViewport({width:390,height:844});
    for(const sub of subs){
      await page.evaluate(s=>{G.empire.subTab=s;G.empire.activeSub=s;render();},sub);
      const clear=await page.evaluate(()=>{
        const nav=document.querySelector('.bottomnav');
        const panels=[...document.querySelectorAll('.command-empire .produce-panel')];
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
        await page.evaluate(s=>{G.empire.subTab=s;G.empire.activeSub=s;render();window.scrollTo(0,0);},sub);
        await new Promise(r=>setTimeout(r,150));
        await page.screenshot({path:`${OUT}/empire-${sub}-${tag}-top.png`});
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight/2));
        await new Promise(r=>setTimeout(r,100));
        await page.screenshot({path:`${OUT}/empire-${sub}-${tag}-mid.png`});
        await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
        await new Promise(r=>setTimeout(r,100));
        await page.screenshot({path:`${OUT}/empire-${sub}-${tag}-bottom.png`});
      }
    }
    console.log('screenshots → '+OUT+' ('+fs.readdirSync(OUT).length+' files)');
    assert.deepEqual(errors,[],'console/page errors: '+errors.join(' ; '));
    console.log('PASS empire browser: responsive + offline (external requests blocked) + screenshots');
  }finally{ await browser.close(); }
})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
