/* Pitch studio, board verdict, location desk and inbox — computed-style and
   wiring regression in a real browser. Covers the three reported defects:
   1. location scouting was unreachable / opened the wrong desk,
   2. Pitch a Film / Pitch a Series errored and looked like legacy markup,
   3. a pitch never resolved in a visible board decision,
   4. the inbox still showed the old card rows.
   Browser dependencies are optional local tools (puppeteer-core + chromium). */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;

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
  page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  await page.setViewport({width:1440,height:900});
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8080/',{waitUntil:'networkidle0'});
  await page.evaluate(()=>{
    SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};
    newGame(DATA.ARCHETYPES[1].id,'Pitch Audit',SEL);enterApp(false);closeModal();switchTab('develop');
    document.querySelectorAll('.toast,.toasts').forEach(e=>e.remove());
  });

  /* ── 1. Location desk: three entry points, one surface, never a dead end ── */
  const pill=await page.evaluate(async()=>{
    closeModal();G.projects=[];switchTab('productions');await new Promise(r=>setTimeout(r,260));
    const b=[...document.querySelectorAll('.subnav-pill')].find(x=>/Location Scouting/.test(x.textContent));
    if(!b) return {error:'the Productions pill is missing'};
    b.click();await new Promise(r=>setTimeout(r,260));
    const m=document.querySelector('#modalRoot .modal');
    return {cls:m?m.className:'',cards:m?m.querySelectorAll('.loc-dest').length:0,
      buttons:m?m.querySelectorAll('[data-dest-id]').length:0,
      empty:m?!!m.querySelector('.loc-empty'):false,
      legacy:m?m.querySelectorAll('.card,.subnav-pill').length:0,
      inline:m?m.querySelectorAll('[style]').length:0,
      overflow:m?m.scrollWidth>m.clientWidth+2:false};
  });
  assert(!pill.error,pill.error);
  assert(/command-location-modal/.test(pill.cls),'the Productions pill must open the location desk, not another system');
  assert.equal(pill.cards,8,'the desk lists every commission');
  assert.equal(pill.buttons,8,'every commission is contractable even with no shoot');
  assert(pill.empty,'with no picture the desk explains what is missing (no dead end)');
  assert.equal(pill.legacy,0,'the desk must not reuse legacy cards or pills');
  assert.equal(pill.inline,0,'the desk must not use inline styles');
  assert(!pill.overflow,'the desk must not overflow horizontally');

  const entries=await page.evaluate(async()=>{
    closeModal();switchTab('develop');DEVELOP_SUB='tax';render();await new Promise(r=>setTimeout(r,260));
    document.querySelector('[data-dev-dest]').click();await new Promise(r=>setTimeout(r,260));
    const fromDevelop=!!document.querySelector('#modalRoot .command-location-modal');
    closeModal();DASHBOARD_SUB='actions';switchTab('dashboard');await new Promise(r=>setTimeout(r,260));
    const dash=document.querySelector('#btnDashLocations'); if(!dash) return {fromDevelop,fromDash:false};
    dash.click();await new Promise(r=>setTimeout(r,260));
    return {fromDevelop,fromDash:!!document.querySelector('#modalRoot .command-location-modal')};
  });
  assert(entries.fromDevelop,'Develop 07 destination cards must open the desk');
  assert(entries.fromDash,'the Dashboard incentives desk must open the same desk');

  const contract=await page.evaluate(async()=>{
    closeModal();
    G.projects.push({id:'loc-1',title:'Location Contract Test',genre:'action',phase:'pre',budget:60,cast:[],phaseLen:{pre:2,shoot:4,post:2}});
    openLocationDesk('loc-1');await new Promise(r=>setTimeout(r,260));
    const before=G.studio.cash;
    document.querySelector('[data-dest-id]').click();await new Promise(r=>setTimeout(r,260));
    const p=G.projects.find(x=>x.id==='loc-1');
    return {dest:p.filmingDestination,shoot:p.shootingLocation,rebate:p.taxRebatePct,cash:G.studio.cash,before,
      contracted:!!document.querySelector('#modalRoot .loc-dest.current'),dossier:!!document.querySelector('#modalRoot .loc-dossier')};
  });
  assert(contract.dest,'contracting must record the filming destination');
  assert(contract.shoot,'contracting must also record the scouting location (craft buff)');
  assert(contract.rebate>0,'the contract carries the real rebate');
  assert(contract.cash<contract.before,'travel cost must be charged');
  assert(contract.contracted,'the desk marks the contracted commission');
  assert(contract.dossier,'the scout file opens for the chosen commission');

  /* ── 2. Pitch studio: clean interior on every step, no errors ──────────── */
  const pitch=await page.evaluate(async()=>{
    closeModal();switchTab('develop');await new Promise(r=>setTimeout(r,260));
    document.querySelector('#btnPitchFilm').click();await new Promise(r=>setTimeout(r,260));
    const audit=()=>{const m=document.querySelector('#modalRoot .modal');return {
      cls:m.className,
      cards:m.querySelectorAll('.card').length,
      pills:m.querySelectorAll('.subnav-pill,.subnav-pills').length,
      pixel:m.querySelectorAll('.subtab-pixel-icon').length,
      inline:m.querySelectorAll('[style]').length,
      gradients:[...m.querySelectorAll('*')].filter(e=>getComputedStyle(e).backgroundImage!=='none').length,
      overflow:m.scrollWidth>m.clientWidth+2,
      steps:m.querySelectorAll('.pitch-step').length,
      active:(m.querySelector('.pitch-step.on span')||{}).textContent,
    };};
    const steps=[audit()];
    document.querySelector('[data-fpnext]').click();await new Promise(r=>setTimeout(r,150));steps.push(audit());
    document.querySelector('[data-fpd]').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('[data-fpw]').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('[data-fpp]').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('[data-fpnext="2"]').click();await new Promise(r=>setTimeout(r,150));steps.push(audit());
    document.querySelector('[data-fpc]').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('[data-fpnext="3"]').click();await new Promise(r=>setTimeout(r,150));steps.push(audit());
    document.querySelector('[data-fpnext="4"]').click();await new Promise(r=>setTimeout(r,200));steps.push(audit());
    const hasGo=!!document.querySelector('#fpGo');
    document.querySelector('#fpGo').click();await new Promise(r=>setTimeout(r,60));
    const m=document.querySelector('#modalRoot .modal');
    const stamp=m&&m.querySelector('.verdict-stamp');
    return {steps,hasGo,
      verdict:m?{cls:m.className,state:(m.querySelector('.verdict')||{dataset:{}}).dataset.verdict,stamp:stamp?stamp.textContent.replace(/\s+/g,' ').trim():'',
        anim:stamp?getComputedStyle(stamp).animationName:'',
        rows:m.querySelectorAll('.verdict-row').length,actions:m.querySelectorAll('.verdict-actions button').length}:null};
  });
  assert(pitch.steps.every(s=>/command-pitch-modal/.test(s.cls)),'the pitch studio owns its modal skin');
  assert.equal(pitch.steps[0].steps,5,'five numbered pitch steps');
  assert.deepEqual(pitch.steps.map(s=>s.active),['Concept','Team','Cast','Release','Review'],'the steps advance in order');
  for(const s of pitch.steps){
    assert.equal(s.cards,0,'no legacy cards inside the pitch studio');
    assert.equal(s.pills,0,'no pill strip inside the pitch studio');
    assert.equal(s.pixel,0,'no pixel icons inside the pitch studio');
    assert.equal(s.inline,0,'no inline styles inside the pitch studio');
    assert.equal(s.gradients,0,'no gradient panels inside the pitch studio');
    assert(!s.overflow,'the pitch studio must not overflow at desktop');
  }
  assert(pitch.hasGo,'the review step carries the board action');
  assert(pitch.verdict,'every pitch must resolve in a verdict sheet');
  assert(/ACCEPTED|REJECTED|BOARD VOTE FAILED/.test(pitch.verdict.stamp),'the verdict is stamped with the board decision');
  assert.notEqual(pitch.verdict.anim,'none','the verdict stamp must animate (legacy CSS disables modal animation)');
  assert(pitch.verdict.rows>=4,'the verdict lists the package numbers');
  assert.equal(pitch.verdict.actions,2,'the verdict offers exactly two next moves');

  const series=await page.evaluate(async()=>{
    closeModal();switchTab('develop');await new Promise(r=>setTimeout(r,240));
    document.querySelector('#btnPitchSeries').click();await new Promise(r=>setTimeout(r,240));
    const m=document.querySelector('#modalRoot .modal');
    const first={steps:m.querySelectorAll('.pitch-step').length,cards:m.querySelectorAll('.card').length,inline:m.querySelectorAll('[style]').length};
    document.querySelector('[data-sr]').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('#szToCast').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('[data-szcast]').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('#szToPlat').click();await new Promise(r=>setTimeout(r,120));
    document.querySelector('#szToReview').click();await new Promise(r=>setTimeout(r,150));
    const hasPitch=!!document.querySelector('#szPitch');
    document.querySelector('#szPitch').click();await new Promise(r=>setTimeout(r,60));
    const v=document.querySelector('#modalRoot .modal');
    return {first,hasPitch,stamp:v?(v.querySelector('.verdict-stamp')||{}).textContent:'',state:v?(v.querySelector('.verdict')||{dataset:{}}).dataset.verdict:''};
  });
  assert.equal(series.first.steps,4,'series pitch has four numbered steps');
  assert.equal(series.first.cards,0,'no legacy cards inside the series pitch');
  assert.equal(series.first.inline,0,'no inline styles inside the series pitch');
  assert(series.hasPitch,'the series review step carries the pitch action');
  assert(/ORDERED|PASSED/.test(series.stamp),'the series verdict names the buyer decision');

  /* ── 3. Inbox: rebuilt rows, working filters ───────────────────────────── */
  const inbox=await page.evaluate(async()=>{
    closeModal();G._nfWk=null;G._nfK={};G.notifications=[];
    G.flash=[{t:'Board approved the slate',k:'gold'},{t:'Stage 3 overran by 2 days',k:'bad'},{t:'Rival moved into your date',k:''},{t:'Streaming deal signed',k:'good'}];
    flashes(G.flash);notificationsModal();await new Promise(r=>setTimeout(r,260));
    const m=document.querySelector('#modalRoot .modal');
    const base={cls:m.className,rows:m.querySelectorAll('.inbox-row').length,legacy:m.querySelectorAll('.card').length,
      inline:m.querySelectorAll('[style]').length,newRows:m.querySelectorAll('.inbox-row.is-new').length,
      oldHeading:/🔔\s*Notifications/.test(document.querySelector('#modalRoot').innerHTML),
      badge:document.querySelector('#bellBadge').style.display,overflow:m.scrollWidth>m.clientWidth+2};
    document.querySelector('[data-nfilter="alerts"]').click();await new Promise(r=>setTimeout(r,150));
    const alerts=document.querySelectorAll('#modalRoot .inbox-row').length;
    document.querySelector('[data-nfilter="all"]').click();await new Promise(r=>setTimeout(r,150));
    return {...base,alerts,restored:document.querySelectorAll('#modalRoot .inbox-row').length};
  });
  assert(/command-inbox-modal/.test(inbox.cls),'the inbox owns its command skin');
  assert.equal(inbox.rows,4,'every notification is listed');
  assert.equal(inbox.legacy,0,'the inbox must not reuse legacy cards');
  assert.equal(inbox.inline,0,'the inbox must not use inline styles');
  assert(!inbox.oldHeading,'the old bell heading must be gone');
  assert.equal(inbox.newRows,4,'entries unread when the inbox opened are marked');
  assert.equal(inbox.badge,'none','opening the inbox clears the bell badge');
  assert(!inbox.overflow,'the inbox must not overflow horizontally');
  assert.equal(inbox.alerts,1,'the alerts filter narrows the inbox');
  assert.equal(inbox.restored,4,'the everything filter restores the list');

  /* ── 3b. The Notifications tab is the inbox desk, not the legacy wire panel ─ */
  const tab=await page.evaluate(async()=>{
    closeModal();G._nfWk=null;G._nfK={};G.notifications=[];
    G.flash=[{t:'Board approved the slate',k:'gold'},{t:'Stage 3 overran by 2 days',k:'bad'},{t:'Rival moved into your date',k:''}];
    flashes(G.flash);
    const b=document.querySelector('.tab[data-tab="notifications"]'); if(!b) return {missing:true};
    b.click();await new Promise(r=>setTimeout(r,300));
    const v=document.querySelector('#view');
    const base={screen:v.dataset.screen,deck:!!v.querySelector('.command-inbox-screen'),
      banner:!!v.querySelector('.kairo-dept-banner'),legacy:/WIRE TRANSMISSIONS|TELETYPE|Studio Espionage/.test(v.textContent),
      rows:v.querySelectorAll('.inbox-row').length,cards:v.querySelectorAll('.card').length,
      inline:v.querySelectorAll('[style]').length,overflow:v.scrollWidth>v.clientWidth+2,
      badge:document.querySelector('#bellBadge').style.display};
    document.querySelector('[data-inboxfilter="alerts"]').click();await new Promise(r=>setTimeout(r,150));
    const alerts=v.querySelectorAll('.inbox-row').length;
    document.querySelector('[data-inboxfilter="all"]').click();await new Promise(r=>setTimeout(r,150));
    document.querySelector('[data-nread]').click();await new Promise(r=>setTimeout(r,150));
    const afterRead={rows:v.querySelectorAll('.inbox-row').length,unread:document.querySelectorAll('#view .inbox-row.is-new').length,
      readBtns:v.querySelectorAll('[data-nread]').length};
    document.querySelector('#inboxMarkAll').click();await new Promise(r=>setTimeout(r,150));
    return {...base,alerts,afterRead,markedAll:{readBtns:v.querySelectorAll('[data-nread]').length,badge:document.querySelector('#bellBadge').style.display}};
  });
  assert(!tab.missing,'the Notifications tab must exist');
  assert(tab.deck,'the Notifications tab must render the inbox desk');
  assert(!tab.banner,'the legacy Kairo wire banner must not render on the inbox');
  assert(!tab.legacy,'the old wire/teletype copy must be gone');
  assert.equal(tab.rows,3,'the desk lists every notification');
  assert.equal(tab.cards,0,'the desk must not reuse legacy cards');
  assert.equal(tab.inline,0,'the desk must not use inline styles');
  assert(!tab.overflow,'the inbox desk must not overflow');
  assert.equal(tab.badge,'flex','reading the page must not silently clear the bell badge');
  assert.equal(tab.alerts,1,'the page filters narrow the list');
  assert.equal(tab.afterRead.readBtns,2,'marking one entry read clears that action');
  assert.equal(tab.markedAll.readBtns,0,'mark all read clears every action');
  assert.equal(tab.markedAll.badge,'none','mark all read clears the bell');

  /* ── 4. Mobile landscape + portrait ────────────────────────────────────── */
  for(const [width,height,label] of [[844,390,'landscape'],[390,844,'portrait']]){
    await page.setViewport({width,height});
    const small=await page.evaluate(async()=>{
      closeModal();switchTab('develop');await new Promise(r=>setTimeout(r,220));
      document.querySelector('#btnPitchFilm').click();await new Promise(r=>setTimeout(r,240));
      const m=document.querySelector('#modalRoot .modal');
      const pitch={overflow:m.scrollWidth>m.clientWidth+2,steps:m.querySelectorAll('.pitch-step').length,inline:m.querySelectorAll('[style]').length};
      closeModal();openLocationDesk();await new Promise(r=>setTimeout(r,240));
      const l=document.querySelector('#modalRoot .modal');
      const loc={overflow:l.scrollWidth>l.clientWidth+2,width:Math.round(l.getBoundingClientRect().width)};
      closeModal();notificationsModal();await new Promise(r=>setTimeout(r,200));
      const i=document.querySelector('#modalRoot .modal');
      const inbox={overflow:i.scrollWidth>i.clientWidth+2};
      closeModal();switchTab('notifications');await new Promise(r=>setTimeout(r,220));
      const v=document.querySelector('#view');
      const tab={overflow:v.scrollWidth>v.clientWidth+2,deck:!!v.querySelector('.command-inbox-screen')};
      return {pitch,loc,inbox,tab};
    });
    assert(!small.pitch.overflow,`pitch studio overflows at ${label}`);
    assert.equal(small.pitch.inline,0,`inline styles at ${label}`);
    assert(!small.loc.overflow,`location desk overflows at ${label}`);
    assert(small.loc.width<=width,`location desk is wider than the ${label} viewport`);
    assert(!small.inbox.overflow,`inbox overflows at ${label}`);
    assert(small.tab.deck,`the inbox desk must render at ${label}`);
    assert(!small.tab.overflow,`the inbox desk overflows at ${label}`);
  }

  assert.deepEqual(errors.filter(e=>!/Not implemented|favicon/i.test(e)),[],'unexpected console errors: '+errors.join(' | '));
  console.log('PASS pitch studio, verdict sheet, location desk and inbox — real browser, three viewports, no console errors');
 }finally{
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1);});
