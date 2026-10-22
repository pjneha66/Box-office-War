/* Pitch studio + greenlight desk + Develop switcher — real-browser regression
   for the story-department rework:
   1. animal stars exist and are castable in films, series and the greenlight,
   2. the pitch team desk keeps writer, director and producer one click away,
   3. the cast directory opens inside a pitch (film and series) and returns to
      the same step with the picks applied,
   4. a cameo is a chosen star, not a checkbox,
   5. the greenlight flow uses the command shell, not legacy cards,
   6. all seven Develop sections and the three tool desks are visible on top,
      under them, at every viewport,
   7. the sound control is a real toggle.
   Browser dependencies are optional local tools. */
const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const chromium=require('@sparticuz/chromium').default;

const VIEWPORTS=[[1440,900,'desktop'],[1280,720,'laptop'],[1024,768,'small laptop'],[844,390,'phone landscape'],[390,844,'portrait']];

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
    newGame(DATA.ARCHETYPES[1].id,'Story Audit',SEL);enterApp(false);closeModal();switchTab('develop');
    document.querySelectorAll('.toast,.toasts').forEach(e=>e.remove());
  });
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

  /* ── 1. animal stars are on the books from week one ────────────────── */
  const animals=await page.evaluate(()=>({
    total:G.talent.length,
    animals:G.talent.filter(t=>t.isAnimal).length,
    free:G.talent.filter(t=>t.isAnimal&&castIsFree(t)).length,
    species:[...new Set(G.talent.filter(t=>t.isAnimal).map(t=>t.species))].length
  }));
  assert(animals.animals>=8,`a new career must start with animal stars (got ${animals.animals})`);
  assert.equal(animals.animals,animals.species,'each animal star is a distinct species (no duplicates)');
  assert(animals.free>=8,'animal stars must be free to book at week one');

  /* ── 2. film pitch team desk: director, writer and producer all present ── */
  await page.evaluate(()=>{ closeModal();switchTab('develop');DEVELOP_SUB='scripts';render();document.querySelector('#btnPitchFilm').click(); });
  await wait(300);
  await page.evaluate(()=>document.querySelector('[data-fpnext]').click());
  await wait(250);
  const team=await page.evaluate(()=>{
    const m=document.querySelector('#modalRoot .modal');
    return {steps:m.querySelectorAll('.pitch-step').length,active:m.querySelector('.pitch-step.on span').textContent,
      dirs:m.querySelectorAll('[data-fpd]').length,writers:m.querySelectorAll('[data-fpw]').length,
      prods:m.querySelectorAll('[data-fpp]').length,pickers:m.querySelectorAll('[data-pickrole]').length,
      legacy:m.querySelectorAll('.card,.plan-opt,.btn,.wiz-step').length,inline:m.querySelectorAll('[style]').length};
  });
  assert.equal(team.steps,5,'the film pitch keeps five numbered steps');
  assert(team.dirs>0&&team.writers>0&&team.prods>0,'writer, director and producer must all be offered on the team desk');
  assert(team.pickers>=3,'each chair offers the full directory, not just the weekly shortlist');
  assert.equal(team.legacy,0,'the team desk must not fall back to legacy cards, plan rows or .btn controls');
  assert.equal(team.inline,0,'the team desk must not use inline styles');

  /* ── 3. a chair picker lists the whole roster and returns to the pitch ── */
  await page.evaluate(()=>[...document.querySelectorAll('[data-pickrole]')].find(b=>b.dataset.pickrole==='writer').click());
  await wait(300);
  const picker=await page.evaluate(()=>{
    const m=document.querySelector('#modalRoot .modal');
    return {open:!!m&&m.classList.contains('command-talent-picker'),rows:m?m.querySelectorAll('.cast-pick').length:0,
      search:!!(m&&m.querySelector('#pickQ')),filters:m?m.querySelectorAll('[data-pickfilter]').length:0,
      draft:typeof WZ!=='undefined'&&WZ?WZ.mode:null};
  });
  assert(picker.open,'the chair picker must open the talent directory');
  assert(picker.rows>=5,'the picker must list the roster');
  assert(picker.search,'the picker must be searchable');
  assert(picker.filters>=3,'the picker must filter by free / stars / species');
  assert.equal(picker.draft,'filmPitch','the pitch draft must survive opening the directory');
  const writerName=await page.evaluate(()=>{ const q=document.querySelector('#pickList .cast-pick b').textContent; document.querySelector('#pickList .cast-pick').click(); return q; });
  await wait(350);
  const afterWriter=await page.evaluate(()=>({mode:WZ&&WZ.mode,step:WZ&&WZ.fpStep,writer:WZ&&WZ.writer&&WZ.writer.name,
    backOnDesk:!!document.querySelector('#modalRoot .pitch-shell'),held:document.querySelectorAll('#modalRoot .pitch-held').length}));
  assert.equal(afterWriter.mode,'filmPitch','picking a writer must return to the same pitch');
  assert.equal(afterWriter.step,1,'the desk must keep its step');
  assert.equal(afterWriter.writer,writerName.trim(),'the picked writer must be attached');
  assert(afterWriter.backOnDesk&&afterWriter.held===1,'the desk shows the attached writer, not the directory');

  /* ── 4. cast directory inside the film pitch: animals included, draft kept ── */
  await page.evaluate(()=>{ const d=document.querySelector('[data-fpd]'); if(d) d.click(); });
  await wait(200);
  await page.evaluate(()=>document.querySelector('[data-fpnext="2"]').click());
  await wait(250);
  const castDesk=await page.evaluate(()=>{ const m=document.querySelector('#modalRoot .modal');
    return {rows:m.querySelectorAll('[data-fpc]').length,animals:[...m.querySelectorAll('[data-fpc]')].filter(b=>/🐾|Animal actor/.test(b.textContent)).length,
      directory:!!m.querySelector('[data-pickcast]'),filter:m.querySelectorAll('[data-fpcastfilter]').length}; });
  assert(castDesk.rows>0,'the cast desk lists free performers');
  assert(castDesk.animals>0,'animal stars must appear on the film call sheet');
  assert(castDesk.directory&&castDesk.filter>=3,'the cast desk must offer the directory and its filters');

  await page.evaluate(()=>document.querySelector('[data-pickcast]').click());
  await wait(300);
  await page.evaluate(()=>{ const f=document.querySelector('[data-pickfilter="animal"]'); if(f) f.click(); });
  await wait(200);
  const dirAnimals=await page.evaluate(()=>({rows:document.querySelectorAll('#pickList .cast-pick').length,
    picker:!!document.querySelector('#modalRoot .command-talent-picker'),mode:WZ&&WZ.mode}));
  assert(dirAnimals.picker,'the cast directory must open on top of the pitch');
  assert(dirAnimals.rows>=8,'the animal filter must list every animal star');
  assert.equal(dirAnimals.mode,'filmPitch','the pitch survives the directory');
  const pickedIds=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('#pickList .cast-pick')].slice(0,2);
    rows.forEach(r=>r.click());
    return rows.map(r=>+r.dataset.pick);
  });
  await page.evaluate(()=>document.querySelector('#pickDone').click());
  await wait(350);
  const filmCast=await page.evaluate(()=>({mode:WZ&&WZ.mode,step:WZ&&WZ.fpStep,
    cast:(WZ&&WZ.cast||[]).map(c=>({id:c.id,animal:!!c.isAnimal})),
    selected:document.querySelectorAll('#modalRoot .cast-pick.sel').length,
    desk:!!document.querySelector('#modalRoot .pitch-shell')}));
  assert.equal(filmCast.mode,'filmPitch','adding leads must return to the pitch');
  assert.equal(filmCast.step,2,'the cast desk keeps its place');
  assert.equal(filmCast.cast.length,2,'both picks must land on the call sheet');
  assert(filmCast.cast.every(c=>pickedIds.includes(c.id)),'the picks are the animals that were chosen');
  assert(filmCast.cast.every(c=>c.animal),'animal stars are castable in a film');
  assert(filmCast.selected>=2,'the desk marks the chosen leads as selected');

  /* ── 5. cameo: a chosen star with a real fee ───────────────────────── */
  await page.evaluate(()=>document.querySelector('#fpCameo').click());
  await wait(300);
  const cameoPicker=await page.evaluate(()=>({rows:document.querySelectorAll('#modalRoot [data-cameo]').length,
    star:(document.querySelector('#modalRoot [data-cameo]')||{}).textContent||''}));
  assert(cameoPicker.rows>0,'the cameo picker must list bookable stars');
  const cameoId=await page.evaluate(()=>{ const row=document.querySelector('#modalRoot [data-cameo]'); const id=+row.dataset.cameo; row.click(); return id; });
  await wait(350);
  const cameo=await page.evaluate(()=>({mode:WZ&&WZ.mode,id:WZ&&WZ.cameo&&WZ.cameo.id,name:WZ&&WZ.cameo&&WZ.cameo.name,
    held:document.querySelectorAll('#modalRoot .pitch-held').length}));
  assert.equal(cameo.mode,'filmPitch','the cameo picker returns to the pitch');
  assert.equal(cameo.id,cameoId,'the chosen star is the cameo');
  assert(cameo.held>=1,'the desk shows the booked cameo');

  /* the pitch resolves in a board verdict, and a booked cameo rides along */
  await page.evaluate(()=>{ WZ.fpStep=3;filmPitchModal(); });
  await wait(200);
  await page.evaluate(()=>document.querySelector('[data-fpnext="4"]').click());
  await wait(200);
  await page.evaluate(()=>document.querySelector('#fpGo').click());
  await wait(400);
  const verdict=await page.evaluate(()=>({shown:!!document.querySelector('.verdict[data-verdict]'),
    state:(document.querySelector('.verdict')||{}).getAttribute?document.querySelector('.verdict').getAttribute('data-verdict'):null,
    project:(G.projects||[]).length}));
  assert(verdict.shown,'every pitch must resolve in a visible board verdict');

  /* ── 6. series pitch: directory picker + animal leads ──────────────── */
  await page.evaluate(()=>{ closeModal();WZ=null;startSeriesWizard();WZ.showrunner=freeTalent('director')[0];WZ.szStep=1;seriesModal(); });
  await wait(300);
  await page.evaluate(()=>document.querySelector('[data-pickcast]').click());
  await wait(300);
  await page.evaluate(()=>{ const f=document.querySelector('[data-pickfilter="animal"]'); if(f) f.click(); });
  await wait(200);
  const seriesDir=await page.evaluate(()=>({rows:document.querySelectorAll('#pickList .cast-pick').length,mode:WZ&&WZ.mode,
    picker:!!document.querySelector('#modalRoot .command-talent-picker')}));
  assert(seriesDir.picker,'the series pitch must open the same directory');
  assert(seriesDir.rows>=8,'the series directory must list animal stars');
  assert.equal(seriesDir.mode,'series','the series draft survives the directory');
  await page.evaluate(()=>{ document.querySelector('#pickList .cast-pick').click(); document.querySelector('#pickDone').click(); });
  await wait(350);
  const seriesCast=await page.evaluate(()=>({mode:WZ&&WZ.mode,cast:(WZ&&WZ.cast||[]).map(c=>!!c.isAnimal),
    step:WZ&&WZ.szStep,rows:document.querySelectorAll('#modalRoot [data-szcast]').length}));
  assert.equal(seriesCast.mode,'series','the series pitch returns after picking');
  assert(seriesCast.cast.includes(true),'an animal star must be castable in a series');

  /* ── 7. greenlight desk: command shell, five desks, pickers, cameo ─── */
  await page.evaluate(()=>{ closeModal();WZ=null;switchTab('develop');DEVELOP_SUB='scripts';render();startWizard(G.ideas[0]); });
  await wait(350);
  const gl=await page.evaluate(()=>{
    const m=document.querySelector('#modalRoot .modal');
    return {cls:m.className,shell:!!m.querySelector('.pitch-shell'),steps:[...m.querySelectorAll('.pitch-step')].map(s=>s.textContent.replace(/^\d+/,'').trim()),
      writers:m.querySelectorAll('[data-writer]').length,skip:!!m.querySelector('#wzSkipWriter'),
      legacy:m.querySelectorAll('.card,.plan-opt,.plan-pick,.wiz-step,.pick-list,button.btn').length,
      inline:m.querySelectorAll('[style]').length,overflow:m.scrollWidth>m.clientWidth+2};
  });
  assert(/command-greenlight-modal/.test(gl.cls),'the greenlight must use the command shell');
  assert(gl.shell,'the greenlight must render the numbered desk rail');
  assert.deepEqual(gl.steps,['Writer','Director','Cast','Producer','Deal'],'the greenlight walks five named desks');
  assert(gl.writers>0&&gl.skip,'the writer desk lists writers and a way past them');
  assert.equal(gl.legacy,0,'the greenlight must not reuse legacy cards, plan rows or .btn controls');
  assert.equal(gl.inline,0,'the greenlight must not use inline styles');
  assert(!gl.overflow,'the greenlight must not overflow horizontally');

  const glDesks=await page.evaluate(()=>{
    const out={};
    for(const [sub,key] of [[3,'director'],[4,'cast'],[5,'producer'],[6,'deal']]){
      WZ.sub=sub;wizardModal();
      const m=document.querySelector('#modalRoot .modal');
      out[key]={dir:m.querySelectorAll('[data-dir]').length,cast:m.querySelectorAll('[data-cast]').length,
        prod:m.querySelectorAll('[data-prod]').length,deal:m.querySelectorAll('[data-plan]').length,
        budget:!!m.querySelector('#wzBudget'),alloc:m.querySelectorAll('.alSlider').length,title:!!m.querySelector('#wzTitle'),
        go:!!m.querySelector('#wzGo'),cards:m.querySelectorAll('.card').length};
    }
    return out;
  });
  assert(glDesks.director.dir>0,'the director desk lists directors');
  assert(glDesks.cast.cast>0,'the cast desk lists performers');
  assert(glDesks.producer.prod>0,'the producer desk lists producers');
  assert(glDesks.deal.deal>=3&&glDesks.deal.budget&&glDesks.deal.alloc===5&&glDesks.deal.title&&glDesks.deal.go,
    'the deal desk carries the plan, the budget, the five allocation sliders, the title and the greenlight action');
  assert.equal(glDesks.deal.cards,0,'the deal desk must not fall back to legacy cards');

  /* cast directory + cameo inside the greenlight, then a real greenlight */
  await page.evaluate(()=>{ WZ.sub=4;wizardModal(); });
  await wait(200);
  const glAnimals=await page.evaluate(()=>[...document.querySelectorAll('#modalRoot [data-cast]')].filter(b=>/🐾|Animal actor/.test(b.textContent)).length);
  assert(glAnimals>0,'animal stars must be castable on the greenlight call sheet');
  await page.evaluate(()=>document.querySelector('[data-pickcameo]')||document.querySelector('#wzCameo').click());
  await wait(350);
  const glCameo=await page.evaluate(()=>({rows:document.querySelectorAll('#modalRoot [data-cameo]').length,
    picker:!!document.querySelector('#modalRoot .command-talent-picker'),mode:WZ&&WZ.mode}));
  assert(glCameo.picker&&glCameo.rows>0,'the greenlight cameo opens the same star picker');
  const glCameoId=await page.evaluate(()=>{ const row=document.querySelector('#modalRoot [data-cameo]'); const id=+row.dataset.cameo; row.click(); return id; });
  await wait(350);
  const glAfterCameo=await page.evaluate(()=>({mode:WZ&&WZ.mode,cameo:WZ&&WZ.cameo&&WZ.cameo.id}));
  assert.equal(glAfterCameo.mode,'film','the greenlight draft survives the cameo picker');
  assert.equal(glAfterCameo.cameo,glCameoId,'the greenlight books the chosen cameo');

  await page.evaluate(()=>{
    WZ.sub=6;wizardModal();
    G.studio.cash=Math.max(G.studio.cash,2000);
    document.querySelector('#wzTitle').value='Cameo Test Feature';
    const before=G.projects.length;
    document.querySelector('#wzGo').click();
  });
  await wait(500);
  const glDone=await page.evaluate(()=>({before:undefined,projects:G.projects.length,
    project:(G.projects[G.projects.length-1]||null)&&{title:G.projects[G.projects.length-1].title,
      cameo:G.projects[G.projects.length-1].cameo?G.projects[G.projects.length-1].cameo.id:null}}));
  assert.equal(glDone.project.title,'Cameo Test Feature','the greenlight applies the typed title');
  assert.equal(glDone.project.cameo,glCameoId,'the greenlight books the chosen cameo on the picture');

  /* ── 8. Develop switcher: seven sections on top, three tools underneath ── */
  for(const [w,h,label] of VIEWPORTS){
    await page.setViewport({width:w,height:h});
    await page.evaluate(()=>{ closeModal();switchTab('develop');DEVELOP_SUB='scripts';_renderImpl(); });
    await wait(220);
    const nav=await page.evaluate(()=>{
      const box=document.querySelector('.command-develop-nav').getBoundingClientRect();
      const tabs=[...document.querySelectorAll('.command-nav-items [data-devsub]')].map(b=>({t:b.textContent.trim(),r:b.getBoundingClientRect()}));
      const tools=[...document.querySelectorAll('.command-nav-tools button')].map(b=>({t:b.textContent.trim(),r:b.getBoundingClientRect()}));
      const head=document.querySelector('.command-develop .command-heading').getBoundingClientRect();
      return {tabs:tabs.map(x=>({t:x.t,y:Math.round(x.r.y),right:Math.round(x.r.right)})),
        tools:tools.map(x=>({t:x.t,y:Math.round(x.r.y),right:Math.round(x.r.right)})),
        clipped:[...tabs,...tools].filter(x=>x.r.left<box.left-1||x.r.right>box.right+1||x.r.width<30).map(x=>x.t),
        tabBottom:Math.round(Math.max(...tabs.map(x=>x.r.bottom))),toolTop:Math.round(Math.min(...tools.map(x=>x.r.top))),
        chrome:Math.round(box.height+head.height),height:innerHeight};
    });
    assert.equal(nav.tabs.length,7,`${label}: all seven Develop sections must exist`);
    assert.equal(nav.tools.length,3,`${label}: the three tool desks must exist`);
    assert.deepEqual(nav.clipped,[],`${label}: sections/tools are cut off (${nav.clipped.join(', ')})`);
    assert(nav.toolTop>=nav.tabBottom,`${label}: the tool desks must sit under the sections`);
    assert(nav.chrome<=Math.max(190,Math.round(nav.height*0.58)),`${label}: switcher uses ${nav.chrome}px of ${nav.height}px`);
  }
  await page.setViewport({width:1440,height:900});
  await page.evaluate(()=>{ switchTab('develop');DEVELOP_SUB='scripts';_renderImpl(); });
  await wait(200);
  const tools=[['#btnOpenAgencyPackaging','command'],['#btnOpenContracts','command'],['#btnOpenTalentAgency','command']];
  for(const [sel] of tools){
    const opened=await page.evaluate(s=>{ closeModal();const b=document.querySelector(s); if(!b) return false; b.click(); return true; },sel);
    assert(opened,sel+' trigger missing');
    await wait(280);
    const live=await page.evaluate(()=>{ const m=document.querySelector('#modalRoot .modal'); return {open:!!m,inside:!!(m&&m.querySelector('.pitch-shell,.command-dialog,.management-workspace')),cards:m?m.querySelectorAll('.card').length:0}; });
    assert(live.open,sel+' must open its desk');
    assert(live.inside,sel+' must open a command desk, not a legacy panel');
  }
  await page.evaluate(()=>closeModal());

  /* ── 9. sound is a real toggle ─────────────────────────────────────── */
  const sound=await page.evaluate(()=>{
    const b=document.querySelector('#btnSound');
    const first={pressed:b.getAttribute('aria-pressed'),text:b.textContent.trim(),dot:!!b.querySelector('.sound-dot'),label:!!b.querySelector('.sound-label')};
    b.click();
    const second={pressed:b.getAttribute('aria-pressed'),text:b.textContent.trim()};
    b.click();
    return {first,second,restored:b.getAttribute('aria-pressed'),stored:localStorage.getItem('bow_snd')};
  });
  assert(sound.first.label&&sound.first.dot,'the sound control carries a state dot and a SOUND label');
  assert(/ON|OFF/.test(sound.first.text),'the sound control states its state');
  assert(sound.first.pressed!==sound.second.pressed,'clicking sound flips aria-pressed');
  assert(sound.first.text!==sound.second.text,'clicking sound flips the visible state');
  assert(sound.restored===sound.first.pressed,'the second click restores the original state');

  assert.deepEqual(errors,[],'console must stay clean: '+errors.slice(0,4).join(' | '));
  console.log('PASS pitch studio, greenlight desk and Develop switcher — animals castable in film, series and greenlight; directory returns to the same step; chosen cameo booked; seven sections and three tools visible at five viewports; sound is a toggle');
 } finally { await browser.close(); }
})().catch(e=>{ console.error('FAIL',e.message); process.exit(1); });
