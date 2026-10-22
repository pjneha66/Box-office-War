/* Story Department (Develop) computed-style / layout regression.
   DOM-only tests cannot see legacy `!important` ID rules, so this runs a real
   browser and checks the rendered surfaces at desktop, phone landscape and
   portrait. Browser dependencies are optional local tools. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;

const SECTIONS=['scripts','demographics','creativity','ip','talent','combos','tax'];

(async()=>{
 if(process.platform==='linux'&&!process.env.LD_LIBRARY_PATH?.includes('/tmp/al2023/lib')){
   const {inflate}=await import('../node_modules/@sparticuz/chromium/build/lambdafs.js');
   const {resolve}=require('node:path');
   await inflate(resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
   process.env.LD_LIBRARY_PATH=['/tmp/al2023/lib',process.env.LD_LIBRARY_PATH||''].join(':');
 }
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080/',{waitUntil:'networkidle0'});
  await page.evaluate(()=>{
    SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};
    newGame(DATA.ARCHETYPES[1].id,'Develop Visual Studio',SEL);enterApp(false);closeModal();switchTab('develop');
    G.projects.push({id:'visual-1',title:'Visual Test Feature',genre:'thriller',phase:'pre',budget:40,quality:60,releaseWeek:G.week+5});
    _renderImpl();
  });

  /* ── Flat command surfaces, not arcade panels ─────────────────────── */
  const surfaces=await page.evaluate(()=>{
    const pick=(el)=>{const c=getComputedStyle(el);return{
      bg:c.backgroundImage,border:c.borderTopWidth,radius:c.borderRadius,shadow:c.boxShadow,
      before:getComputedStyle(el,'::before').content,align:c.textAlign,
      transform:c.transform,bottom:c.borderBottomWidth};};
    return {
      deck:pick(document.querySelector('.command-develop')),
      panel:pick(document.querySelector('.develop-panel')),
      action:pick(document.querySelector('.develop-action')),
      ghost:pick(document.querySelector('.develop-ghost')),
      title:pick(document.querySelector('.develop-panel-head h2')),
      nav:pick(document.querySelector('.command-develop-nav')),
      sectionTitle:{before:getComputedStyle(document.querySelector('.command-develop .command-section-head')||document.querySelector('.command-develop'),'::before').content},
      banner:!!document.querySelector('.kairo-dept-banner')
    };
  });
  assert.equal(surfaces.banner,false,'legacy Kairo banner must be gone');
  for(const key of ['deck','panel','nav']){
    assert.equal(surfaces[key].bg,'none',key+' must not paint a gradient');
    assert.ok(parseFloat(surfaces[key].radius)<=6,key+' radius must stay restrained (got '+surfaces[key].radius+')');
  }
  assert.equal(surfaces.action.shadow,'none','primary action must be flat');
  assert.equal(surfaces.action.transform,'none');
  assert.match(surfaces.action.bottom,/1px/, 'primary action must not keep the 3px arcade base');
  assert.equal(surfaces.ghost.shadow,'none');
  assert.equal(surfaces.title.align,'left','panel headings must be left aligned');

  /* ── Dialogs opened from Develop are flat too ────────────────────── */
  const dialogs=[['#btnPitchFilm','film pitch'],['#btnOpenContracts','picture partners'],['#btnOpenAgencyPackaging','agency packaging'],['#btnOpenDemographicsModal','audience lab','demographics'],['#btnOpenRemakeVaultModal','remake vault','creativity'],['#btnDevelopCoPro','co-production','tax']];
  for(const [sel,label,section] of dialogs){
    await page.evaluate(s=>{closeModal();DEVELOP_SUB=s;_renderImpl();},section||'scripts');
    const opened=await page.evaluate(s=>{const b=document.querySelector('#view '+s);if(!b)return false;b.click();return true;},sel);
    assert(opened,label+' trigger missing');
    await page.waitForSelector('#modalRoot .modal',{timeout:4000});
    const style=await page.evaluate(()=>{
      const m=document.querySelector('#modalRoot .modal'),head=m.querySelector('.modal-head');
      const c=getComputedStyle(m),h=getComputedStyle(head),box=m.getBoundingClientRect();
      const badge=m.querySelector('.tag'),btn=m.querySelector('.btn'),step=m.querySelector('.wiz-step');
      return {cls:m.className,bg:c.backgroundColor,img:c.backgroundImage,border:c.borderTopWidth,headImg:h.backgroundImage,headBg:h.backgroundColor,
        w:box.width,h:box.height,overflow:m.scrollWidth>m.clientWidth+2,
        tagShadow:badge?getComputedStyle(badge).boxShadow:null,tagRadius:badge?getComputedStyle(badge).borderRadius:null,
        btnShadow:btn?getComputedStyle(btn).boxShadow:null,btnTransform:btn?getComputedStyle(btn).transform:null,
        stepImg:step?getComputedStyle(step).backgroundImage:null};
    });
    assert.match(style.cls,/command-develop-modal/,label+' must use the Develop modal skin');
    assert.equal(style.img,'none',label+' must not paint a gradient');
    assert.equal(style.headImg,'none',label+' title bar must not be a gradient');
    assert.equal(style.border,'1px',label+' must use a single hairline border');
    assert(!style.overflow,label+' content overflows its dialog');
    if(style.tagShadow!==null){ assert.equal(style.tagShadow,'none',label+' tags must be flat'); assert.ok(parseFloat(style.tagRadius)<=3,label+' tags must be squared off'); }
    if(style.btnShadow!==null) assert.equal(style.btnShadow,'none',label+' buttons must be flat');
    if(style.btnTransform!==null) assert.equal(style.btnTransform,'none',label+' buttons must not keep the arcade lift');
    if(style.stepImg!==null) assert.equal(style.stepImg,'none',label+' step strip must not keep the legacy panel gradient');
  }
  await page.evaluate(()=>{closeModal();});

  /* ── Real interaction: genre filter and lens fitting ─────────────── */
  await page.evaluate(()=>{DEVELOP_SUB='scripts';_renderImpl();});
  const beforeFilter=await page.$$eval('.develop-script',a=>a.length);
  await page.click('[data-filter-genre="drama"]');
  await new Promise(r=>setTimeout(r,150));
  const afterFilter=await page.$$eval('.develop-script',a=>a.length);
  const expected=await page.evaluate(()=>G.ideas.filter(i=>i.genre==='drama').length);
  assert.equal(afterFilter,expected,'genre filter did not re-render the market');
  assert(afterFilter<beforeFilter||expected===beforeFilter,'genre filter had no effect');
  await page.click('[data-filter-genre="all"]');

  await page.evaluate(()=>{DEVELOP_SUB='creativity';G.studio.cash=Math.max(G.studio.cash,60);_renderImpl();});
  const q0=await page.evaluate(()=>G.projects.find(p=>p.id==='visual-1').quality);
  await page.$eval('[data-fit-lens]',el=>{el.scrollIntoView({block:'center'});el.click();});
  await new Promise(r=>setTimeout(r,150));
  const q1=await page.evaluate(()=>G.projects.find(p=>p.id==='visual-1').quality);
  assert(q1>q0,'fitting a lens in the browser did not raise quality');

  /* ── Responsive bounds at every size ────────────────────────────── */
  const shots=[];
  for(const [width,height,label] of [[1440,900,'desktop'],[1280,720,'laptop'],[844,390,'phone landscape'],[700,900,'tablet portrait'],[390,844,'portrait']]){
    await page.setViewport({width,height});
    for(const section of SECTIONS){
      await page.evaluate(s=>{closeModal();DEVELOP_SUB=s;_renderImpl();},section);
      const nav=await page.evaluate(()=>{
        const box=document.querySelector('.command-develop-nav').getBoundingClientRect();
        const clipped=[...document.querySelectorAll('.command-develop-nav [data-devsub]')].filter(b=>{
          const r=b.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.width<40;}).map(b=>b.textContent.trim());
        const head=document.querySelector('.command-develop .command-heading').getBoundingClientRect();
        return {clipped,chrome:Math.round(box.height+head.height)};
      });
      assert.deepEqual(nav.clipped,[],`${label}: section tabs are cut off (${nav.clipped.join(', ')})`);
      assert(nav.chrome<=Math.max(190,Math.round(height*0.55)),`${label}: deck chrome uses ${nav.chrome}px of a ${height}px viewport`);

      const layout=await page.evaluate(()=>{
        const v=document.querySelector('#view');
        const ids=[...v.querySelectorAll('[id]')].map(e=>e.id);
        return {doc:document.documentElement.scrollWidth>window.innerWidth+2,
          view:v.scrollWidth>v.clientWidth+2,
          deck:document.querySelector('.command-develop').scrollWidth>document.querySelector('.command-develop').clientWidth+2,
          dupes:ids.filter((id,i)=>ids.indexOf(id)!==i)};
      });
      assert(!layout.doc,`${section} pushes the document sideways at ${label}`);
      assert(!layout.view,`${section} overflows the view at ${label}`);
      assert(!layout.deck,`${section} overflows the deck at ${label}`);
      assert.deepEqual(layout.dupes,[],`${section} has duplicate ids at ${label}`);
    }
    await page.evaluate(()=>{DEVELOP_SUB='scripts';_renderImpl();});
    await page.screenshot({path:`/tmp/develop-${label.replace(/ /g,'-')}.png`});
    shots.push(label);
  }

  assert.deepEqual(errors,[],'page errors while rendering Develop');
  console.log(`PASS develop deck browser: flat computed surfaces, six command dialogs, live filters, lens fitting and no overflow at ${shots.join(', ')}`);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
