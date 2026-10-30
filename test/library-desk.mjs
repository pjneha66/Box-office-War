/* LIBRARY DESK regressions (A1–A14) + command-desk shell (B) + C1–C11 coverage.
   Runs entirely offline in jsdom against the local app shell: no network, no
   external fixtures. Each A-test pins the defect it fixes. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const rawIndex=fs.readFileSync('index.html','utf8');
const html=rawIndex
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>')
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];
vc.on('error',(...a)=>errors.push(a.join(' ')));
vc.on('jsdomError',e=>{ if(!/Could not load|Not implemented: (navigation|HTMLCanvasElement|Window's scrollTo)/.test(String(e&&e.message))) errors.push(String(e&&e.message)); });
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const viewText=()=>($('#view')?$('#view').textContent:'');
const toastText=()=>$$('#toasts .toast').map(t=>t.textContent).join(' | ');
const clearToasts=()=>{ const h=$('#toasts'); if(h) h.innerHTML=''; };
const chips=()=>$$('[data-libsub]');

/* every beep() sting is tracked so refusals can prove zero false gold/cash */
w.eval(`
  window.__beeps=[];
  const _origBeep = typeof beep === 'function' ? beep : function(){};
  beep = function(kind){ window.__beeps.push(kind); return _origBeep(kind); };
`);
const clearBeeps=()=>{ w.__beeps.length=0; };
const beeps=()=>[...w.__beeps];

/* A career with real catalogue material: two released films (one in theaters),
   one series with a finished season, an acquired library, a streamer. */
function fresh(sub){
  clearToasts(); clearBeeps();
  w.eval(`
    render=function(){_renderImpl()};
    SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};
    newGame(DATA.ARCHETYPES[1].id,'Library Desk Audit',SEL);
    enterApp(false); closeModal();
    G.studio.cash=500; G.studio.rep=70;
    G.films=[
      { id:101, title:'Vault Runner', genre:'action', scale:'mid', budget:60, ww:210, dom:90, intl:120, releaseWeek:18,
        quality:{overall:74,critic:72,aud:76}, franchiseName:'Runner', awards:[], weekly:[], inTheaters:false,
        soldTo:null, streamingOriginal:false, onOwn:false, onOwnPlatform:false, profit:64, window:45 },
      { id:102, title:'Quiet Season', genre:'drama', scale:'indie', budget:20, ww:41, dom:18, intl:23, releaseWeek:70,
        quality:{overall:66,critic:70,aud:62}, awards:[], weekly:[], inTheaters:true,
        soldTo:null, streamingOriginal:false, onOwn:false, onOwnPlatform:false, profit:3, window:45 },
      { id:103, title:'Neon Static', genre:'scifi', scale:'mid', budget:35, ww:0, dom:0, intl:0, releaseWeek:52,
        quality:{overall:58,critic:60,aud:57}, awards:[], weekly:[], inTheaters:false,
        soldTo:'Netflix', streamingOriginal:false, onOwn:false, onOwnPlatform:false, profit:8, window:30 }
    ];
    G.series=[{ id:201, title:'Cold Ledger', genre:'drama', platform:'own', budget:30, eps:8, status:'renewal_pending',
      seasons:[{num:1, quality:70, viewership:64, episodes:8, when:64}] }];
    G.maVault=[{ id:301, title:'Indie Import', genre:'comedy', quality:61, weight:7, week:G.week+6, dead:false, soldTo:null, source:'library' }];
    G.maLibraries=1; G.maOffers=[]; G.maDeals=[];
    G.streamer={ name:'AuditFlix', subs:12, peak:12, churn:0.008, income:0, totalRev:0, lastContent:G.week, tier:'premium', sportsPower:1 };
    G.restorationVault=null;
    G.libState=null;
    switchTab('library'); ${sub?`G.libState={sub:'${sub}'};`:''} render();
  `);
}
const lane=key=>{ w.eval(`G.libState.sub='${key}';render();`); };

try{
  await new Promise(r=>setTimeout(r,900));
  w.eval(`window.confirm=function(){return window.__confirm!==false;};`);

  /* ── A1 — one Library navigation, one strip, persisted ── */
  fresh();
  assert.equal($$('#subTabs [data-libsub]').length,0,'the global #subTabs strip must not duplicate library chips');
  assert.equal($('#subTabs').style.display,'none','global #subTabs stays hidden on the Library desk');
  assert.equal($$('#view .subnav-pills').length,0,'legacy .subnav-pills row is gone from Library');
  assert.equal(chips().length,7,'exactly seven [data-libsub] chips');
  assert.deepEqual(chips().map(b=>b.dataset.libsub),['overview','films','series','rights','catalogue','physical','restoration'],'seven sections in desk order');
  assert.equal(new Set(chips().map(b=>b.closest('nav'))).size,1,'all chips belong to one navigation container');
  assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,'exactly one active chip');
  assert.equal($('[data-libsub].active').dataset.libsub,'overview','a fresh career opens Overview');
  assert.equal($('#view').dataset.screen,'library','the view is the library screen');
  assert.equal($('.kairo-dept-banner'),null,'no legacy pixel banner above the desk');
  assert.equal($$('.command-library .command-heading').length,1,'one desk header');
  assert($('.command-edition').textContent.includes('LIBRARY DESK'),'the header is branded LIBRARY DESK');
  assert($('.command-edition').textContent.includes('YEAR'),'the header carries the year');
  /* the choice survives a reload (persisted in G.libState) */
  chips().find(b=>b.dataset.libsub==='rights').click();
  assert.equal(w.eval('G.libState.sub'),'rights','section choice is written to the save object');
  w.eval('render();');
  assert.equal($('[data-libsub].active').dataset.libsub,'rights','section choice survives a re-render');
  /* a stale/unknown value falls back instead of crashing */
  w.eval(`G.libState.sub='vault';render();`);
  assert.equal($('[data-libsub].active').dataset.libsub,'overview','a dead section key falls back to Overview');

  /* ── A2 — the inline filter bar is live (it had no handler at all) ── */
  fresh('films');
  assert.equal($$('[data-lib-genre]').length>0,true,'the Films shelf renders genre chips');
  assert.equal($('#libSearch')!==null,true,'the shelf has a search field with a binding');
  $('[data-lib-genre="action"]').click();
  assert.equal(w.eval('G.libState.genre'),'action','clicking a genre chip writes the filter');
  assert.equal($$('[data-lib-film]').length,1,'the shelf narrows to the matching film');
  $('[data-lib-genre="drama"]').click();
  assert.equal($$('[data-lib-film]').length,1,'a second genre chip re-filters from persisted state');
  assert.equal(w.eval(`$$('[data-lib-film]').length`),1,'one drama film on the shelf');
  $('[data-lib-genre="all"]').click();
  assert.equal($$('[data-lib-film]').length,3,'All restores the whole shelf');
  /* sort chips also write state */
  $('[data-lib-sort="gross"]').click();
  assert.equal(w.eval('G.libState.sort'),'gross','sort chip writes the sort key');
  $('[data-lib-sort="recent"]').click();
  /* reset */
  const resetBtn=$('#libReset'); assert(resetBtn,'filter bar has a reset control');
  w.eval(`G.libState.q='zzzz';refreshLibraryRows();`);
  assert(viewText().includes('Nothing matches'),'an unmatched search shows the empty state');
  $('#libReset2').click();
  assert.equal(w.eval('G.libState.q'),'','reset clears the search');
  assert.equal($$('[data-lib-film]').length,3,'reset restores the shelf');

  /* ── A3 — filter state is complete before any write, old saves included ── */
  w.eval(`G.libState=undefined;render();`);
  assert.equal(w.eval(`typeof G.libState`),'object','reading the desk materialises a complete libState');
  assert.deepEqual(JSON.parse(w.eval(`JSON.stringify(G.libState)`)),{sub:'overview',genre:'all',year:'all',franchise:'all',q:'',sort:'recent',limit:30},'every filter key exists with a default');
  w.eval(`G.libState={sub:'films'};render();`);
  const yearChip=$$('[data-lib-year]').find(b=>b.dataset.libYear!=='all');
  assert(yearChip,'the desk renders at least one year chip');
  yearChip.click();
  assert.equal(w.eval('G.libState.year'),yearChip.dataset.libYear,'a half-written save cannot throw on filter writes');
  w.eval(`G.libState=null;render();`);

  /* ── A4 — one axis decides the shelf; no contradictory type filter ── */
  fresh('series');
  assert.equal($$('[data-lib-film]').length,0,'the Series desk renders no film rows');
  assert.equal($$('[data-lib-series]').length,1,'the Series desk renders the series');
  assert.equal(w.eval(`typeof G.libState.type`),'undefined','there is no second type filter to contradict the section');
  fresh('films');
  assert.equal($$('[data-lib-series]').length,0,'the Films desk renders no series rows');
  assert.equal($$('[data-lib-film]').length,3,'the Films desk renders all three films');

  /* ── A5 — no double-unit money labels anywhere in the desk ── */
  const moneyRe=/\$\d[\d.,]*\s?[BM]M\b/;
  for(const key of ['overview','films','series','rights','catalogue','physical','restoration']){
    lane(key);
    const t=viewText();
    assert.equal(moneyRe.test(t),false,`no "$50.0MM" style label on the ${key} desk`);
    assert.equal(/undefined\s+undefined/.test(t),false,`no "undefined undefined" on the ${key} desk`);
  }

  /* ── A6 — unknown genres never render "undefined undefined" ── */
  assert.equal(w.eval(`libraryGenre('nostalgia')`),'Nostalgia','an unknown genre falls back to a title-cased word');
  assert.equal(w.eval(`libraryGenre(undefined)`),'Unclassified','a missing genre is named, not printed as undefined');
  w.eval(`G.films.push({id:104,title:'Genre Oddity',genre:'weirdcore',scale:'indie',budget:5,ww:9,releaseWeek:10,quality:{overall:50},awards:[],weekly:[],inTheaters:false});G.libState.sub='films';render();`);
  const odd=$('[data-lib-film="104"]');
  assert(odd,'an unclassified film still renders');
  assert.equal(/undefined/.test(odd.textContent),false,'its row prints no undefined');
  w.eval(`G.films=G.films.filter(f=>f.id!==104);render();`);

  /* ── A7 — series actions resolve ids safely and refuse honestly ── */
  fresh('series');
  w.eval(`G.series[0].id='s-201';render();`);
  const seqBtn=$('[data-seq]'); assert(seqBtn,'the series row keeps its new-season action');
  w.eval(`G.series[0].status='ended';render();`);
  assert.equal($('[data-seq]').disabled,true,'an ended series renders its new-season button disabled');
  clearBeeps(); clearToasts();
  w.eval(`$$('[data-seq]').forEach(b=>b.onclick&&b.onclick());`);
  assert.equal(beeps().filter(k=>k==='gold'||k==='cash').length,0,'a disabled/refused series action plays no gold');
  /* a string id resolves through the shared lookup */
  assert(w.eval(`findSeriesById('s-201')!==null`),'findSeriesById resolves a string id');
  assert(w.eval(`findSeriesById('nope')===null`),'findSeriesById refuses an unknown id');

  /* ── A8 — one restoration entry point per element, no duplicate id ── */
  fresh();
  assert.equal($$('#btnRestorationVault').length,0,'the desk owns no duplicate #btnRestorationVault id');
  lane('restoration');
  assert($('[data-lib-restoration="modal"]'),'the restoration desk can open the full lab modal');
  const ids=$$('[id]').map(n=>n.id).filter(Boolean);
  assert.equal(new Set(ids).size,ids.length,`no duplicate element ids on the ${'restoration'} desk`);

  /* ── A9 — a missing physical-media module refuses visibly ── */
  fresh('physical');
  assert(viewText().includes('Physical'),'the physical desk renders its panel');
  w.eval(`window.__sos=StudioOperationsSuite; StudioOperationsSuite=undefined; render();`);
  assert(viewText().includes("isn't loaded"),'a missing module names the problem instead of silently rendering another shelf');
  w.eval(`StudioOperationsSuite=window.__sos; render();`);

  /* ── A10 — the catalogue is the engine's catalogue (vault + licences included) ── */
  fresh();
  assert.equal(w.eval('libraryCatalogue().films.length'),3,'catalogue includes a licensed straight-to-platform film with no theatrical gross');
  assert.equal(w.eval('libraryCatalogue().vault.length'),1,'the acquired vault is part of the catalogue');
  assert.equal(w.eval('libraryCatalogue().titles'),4,'films + series are counted for the catalogue headline');
  lane('catalogue');
  assert(viewText().includes('Indie Import'),'the acquired vault film is visible on the desk');
  assert(viewText().includes('DEAL HISTORY')||viewText().includes('Deal history')||viewText().includes('DEAL'),'the catalogue desk shows the acquisition ledger');
  /* the weekly figure is the same function the tick pays */
  assert.equal(w.eval('libraryWeeklyIncome()'),Math.round(w.eval('catalogValue()')*0.0045*10)/10,'weekly library income is catalogValue × 0.45%, rounded once');
  assert.equal(Math.round(w.eval('libraryWeeklyRate()*10000'))/100,0.45,'the printed rate is the paid rate');

  /* ── A11 — filter year == printed year (films and series) ── */
  fresh('films');
  const row102=$('[data-lib-film="102"]');
  assert(row102.textContent.includes('Y2'),'the film row prints its release year');
  w.eval(`G.libState.year='2';render();`);
  assert.equal($$('[data-lib-film]').length,1,'filtering by the printed year keeps that film');
  assert.equal($('[data-lib-film]').dataset.libFilm,'102','the kept film is the one printing Y2');
  w.eval(`G.libState.year='all';G.libState.sub='series';render();`);
  assert($('[data-lib-series="201"]').textContent.includes('Y2'),'the series row prints a real season year');
  w.eval(`G.libState.year='2';render();`);
  assert.equal($$('[data-lib-series]').length,1,'the series year filter matches the printed year');
  w.eval(`G.libState.year='all';render();`);
  /* a pre-v36 season with no week prints an em dash and filters as "no date" */
  w.eval(`G.series[0].seasons=[{num:1,quality:60,viewership:50}];render();`);
  assert($('[data-lib-series="201"]').textContent.includes('—'),'a season with no recorded week prints an em dash');
  w.eval(`G.libState.year='unknown';render();`);
  assert.equal($$('[data-lib-series]').length,1,'"No date" finds a title with no recorded year');

  /* ── A12 — net is labelled, never silently mixed with gross ── */
  fresh('films');
  const r101=$('[data-lib-film="101"]');
  assert(/Net\s+\+\$64(\.0)?M/.test(r101.textContent.replace(/\s+/g,' ')),'a closed run prints the engine net, labelled');
  w.eval(`delete G.films[0].profit; render();`);
  assert($('[data-lib-film="101"]').textContent.includes('vs breakeven'),'an open run says "vs breakeven" instead of pretending to be net');
  w.eval(`G.films[0].profit=64; render();`);

  /* ── A13 — the shelf is bounded and loads more on demand ── */
  w.eval(`
    for(let i=0;i<80;i++) G.films.push({id:1000+i,title:'Bulk '+i,genre:'comedy',budget:10,ww:20,releaseWeek:5,
      quality:{overall:50},awards:[],weekly:[],inTheaters:false});
    G.libState.sub='films'; render();
  `);
  assert.equal($$('[data-lib-film]').length,30,'the shelf renders one page of 30 rows, not the whole catalogue');
  const moreBtn=$('#libMore'); assert(moreBtn,'the shelf offers a load-more control');
  moreBtn.click();
  assert.equal($$('[data-lib-film]').length,60,'load more appends the next page');
  w.eval(`G.libState.limit=30;G.films=G.films.filter(f=>f.id<1000);render();`);

  /* ── A14 — accessibility: pressed state, labels, live counts ── */
  fresh();
  chips().forEach(b=>assert.equal(b.getAttribute('aria-pressed')===null,false,'each nav chip declares aria-pressed'));
  assert.equal($('[data-libsub="overview"]').getAttribute('aria-current'),'page','the active chip is aria-current=page');
  assert.equal($('[data-libsub="films"]').getAttribute('aria-current'),'false','inactive chips are aria-current=false');
  lane('films');
  assert.equal($('#libSearch').getAttribute('aria-label').length>0,true,'the search field is labelled');
  $$('[data-lib-genre]').slice(0,3).forEach(b=>assert.equal(b.getAttribute('aria-pressed')!==null,true,'genre chips expose aria-pressed'));
  assert($('#libCount'),'the shelf announces a live result count');

  /* ── B — the desk shell ── */
  fresh();
  assert.equal($$('.command-library .command-metric').length,4,'four desk telemetry metrics');
  assert.equal($$('.command-library .command-section-nav').length,1,'one section nav');
  assert.equal($$('.command-library .library-panel').length>=1,true,'at least one desk panel');
  assert.equal($$('#view .card').length,0,'no legacy .card on the Overview desk');
  const titles=["The studio catalogue","Catalogue at a glance","Films","Series","Rights & windows","Catalogue & licensing","Physical 4K","Restoration vault"];
  for(const key of ['overview','films','series','rights','catalogue','physical','restoration']){
    lane(key);
    assert.equal($$('#view .card').length,0,`no legacy .card on the ${key} desk`);
    assert.equal($$('#view .section-title').length,0,`no legacy .section-title on the ${key} desk`);
    assert.equal($$('#view .cost-line').length,0,`no legacy .cost-line on the ${key} desk`);
    assert.equal($$('#view .stat-hero').length,0,`no legacy .stat-hero on the ${key} desk`);
    assert.equal($$('#view .subnav-pills').length,0,`no pill strip on the ${key} desk`);
    assert.equal(errors.length,0,`no console errors while rendering the ${key} desk: ${errors.join(' | ')}`);
  }
  /* telemetry == engine */
  fresh();
  assert(viewText().includes('TITLES IN CATALOGUE'),'telemetry names the catalogue size');
  assert.equal($$('.command-library .command-metric')[1].textContent.includes(w.eval('fmtM(catalogValue())')),true,'the catalogue value metric prints catalogValue()');

  /* ── C1–C11 — the desk features run on real state ── */
  /* C2 film dossier row */
  fresh('films');
  assert($('[data-dossier="101"]'),'a film row keeps its breakdown action');
  const before=$$('#modalRoot .modal, #modalRoot > *').length;
  $('[data-dossier="101"]').click();
  assert(w.eval(`document.querySelector('#modalRoot').innerHTML.length>0`),'the breakdown opens');
  w.eval('closeModal();');
  /* C3 series actions live */
  lane('series');
  assert($('[data-spin="201"]'),'the series row keeps its spin-off action');
  /* C4 rights board */
  lane('rights');
  assert(viewText().includes('READY TO PLACE'),'the rights board counts titles ready to place');
  const moveBtn=$('[data-movestr="101"]'); assert(moveBtn,'an unsold, out-of-theaters film can move to the platform');
  clearBeeps();
  moveBtn.click();
  assert.equal(w.eval('G.films.find(f=>f.id===101).onOwnPlatform'),true,'moving a title sets the platform flag');
  assert.equal(beeps().includes('gold'),true,'a real move plays the gold sting');
  assert.equal(w.eval(`libraryRightsOf(G.films.find(f=>f.id===101)).movable`),false,'a moved title is no longer movable');
  /* refusal is honest: in-theaters title */
  clearBeeps(); clearToasts();
  const res=w.eval(`JSON.stringify(libraryMoveResult(102))`);
  assert.equal(JSON.parse(res).ok,false,'an in-theaters title refuses the move');
  assert(JSON.parse(res).reason.toLowerCase().includes('theater'),'the refusal explains the theatrical window');
  assert.equal(beeps().includes('gold'),false,'a refusal plays no gold');
  /* no streamer → refusal names the cause */
  w.eval(`window.__st=G.streamer; G.streamer=null;`);
  assert.equal(JSON.parse(w.eval(`JSON.stringify(libraryMoveResult(103))`)).reason.includes('streamer'),true,'without a streamer the refusal says so');
  w.eval(`G.streamer=window.__st;`);
  /* C5 catalogue ledger */
  lane('catalogue');
  const bd=JSON.parse(w.eval(`JSON.stringify(catalogValueBreakdown())`));
  assert.equal(Math.round((bd.films+bd.franchises+bd.libraries)*10)/10,Math.round(bd.total*10)/10,'the itemised components add up to the total');
  assert.equal(bd.total,w.eval('catalogValue()'),'catalogValue() is the breakdown total');
  assert(viewText().includes('Library licensing pays'),'the desk states the licensing rule it pays');
  /* C6 acquisition desk */
  w.eval(`
    G.maOffers=[{id:9001,kind:'library',name:'Indie library bundle',icon:'📚',price:40,
      blurb:'A boutique back catalogue.',expires:G.week+5}];
    render();
  `);
  const buy=$('[data-libma="9001"]'); assert(buy,'the acquisition desk offers the library deal');
  assert.equal(buy.disabled,false,'an affordable deal is clickable');
  clearBeeps(); clearToasts();
  buy.click();
  assert.equal(w.eval('G.maLibraries'),2,'buying the library increments the acquired count');
  assert(viewText().includes('Indie library bundle'),'the purchase lands in the deal history');
  assert.equal(beeps().includes('gold'),true,'a real acquisition plays the gold sting');
  /* an unaffordable deal is disabled with the reason */
  w.eval(`
    G.studio.cash=1; G.maOffers=[{id:9002,kind:'library',name:'Big library',icon:'📚',price:400,blurb:'x',expires:G.week+5}];
    render();
  `);
  const broke=$('[data-libma="9002"]');
  assert.equal(broke.disabled,true,'a deal you cannot cover is disabled');
  assert(broke.textContent.includes("Can't cover"),'the button says why');
  clearBeeps();
  assert.equal(JSON.parse(w.eval(`JSON.stringify(maBuyResult(9002))`)).ok,false,'maBuyResult refuses without cash');
  assert(JSON.parse(w.eval(`JSON.stringify(maBuyResult(9002))`)).reason.includes('cash'),'the refusal explains the cash gap');
  assert.equal(beeps().includes('gold'),false,'a refused deal plays no gold');
  w.eval(`G.studio.cash=500;`);
  /* C7 restoration queue */
  lane('restoration');
  assert(viewText().includes('CANDIDATES')||viewText().includes('Candidates'),'the lab lists restoration candidates');
  const restoreBtn=$('[data-librestore]'); assert(restoreBtn,'the lab offers a restoration action');
  clearBeeps(); clearToasts();
  restoreBtn.click();
  assert.equal(w.eval(`(G.restorationVault.inProgress||[]).length`),1,'starting a restoration queues it in the lab');
  assert.equal(beeps().includes('gold'),true,'a real restoration plays the gold sting');
  w.eval('render();');
  assert(viewText().includes('IN THE LAB'),'the lab shows the queue');
  /* C8 physical panel keeps the module's economics */
  lane('physical');
  assert(viewText().toUpperCase().includes('4K'),'the physical desk renders');
  assert.equal($$('#view .card').length,0,'legacy cards inside the physical module are restyled away');
  /* C9 franchise shelf + cross-link */
  lane('films');
  assert($('[data-fr="Runner"]'),'a franchise film links back to the brand');
  w.eval(`window.__frName=null; window.__frOrig=viewFranchiseDetail; viewFranchiseDetail=function(n){ window.__frName=n; };`);
  $('[data-fr="Runner"]').click();
  assert.equal(w.eval('window.__frName'),'Runner','the franchise action routes to the brand record');
  w.eval(`viewFranchiseDetail=window.__frOrig;`);
  /* C10 archive timeline */
  lane('overview');
  assert.equal($$('#view .library-row').length>0,true,'Overview surfaces the latest catalogue rows');
  /* C11 empty onboarding */
  w.eval(`
    G.films=[]; G.series=[]; G.maVault=[]; G.maLibraries=0; G.maOffers=[];
    G.libState={sub:'overview'}; render();
  `);
  assert(viewText().includes('No titles yet'),'an empty studio gets onboarding, not a blank panel');
  assert($('[data-lib-lane="catalogue"]'),'the empty state routes to the acquisition desk');
  assert($('[data-libgoto="develop"]'),'the empty state routes to Develop');
  w.eval(`G.libState={sub:'films'};render();`);
  assert(viewText().includes('Nothing matches')||viewText().includes('No titles'),'an empty Films shelf has a real empty state');

  /* ── release plumbing ── */
  const release=JSON.parse(fs.readFileSync('version.json','utf8')).v;
  assert.equal($('meta[name="app-version"]').content,release,'app-version matches version.json');
  assert(rawIndex.includes(`ui.js?v=${release}`),'ui.js uses the current release version');
  assert(rawIndex.includes(`command-deck.css?v=${release}`),'command-deck.css uses the current release version');
  assert(fs.readFileSync('sw.js','utf8').includes('bow-v102-cache'),'service-worker cache is bow-v102');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='38.0').status`),'shipped','38.0 Treasury Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='37.0').status`),'shipped','37.0 Game Studio Desk is still marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='36.0').status`),'shipped','36.0 Library Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='35.0').status`),'shipped','35.0 Empire Desk stays shipped');

  assert.equal(errors.length,0,'no console errors across the whole run: '+errors.join(' | '));
  console.log('PASS library desk: A1–A14 + shell + C1–C11 + zero-legacy sweep');
  console.log(`PASS release: ${release} / bow-v102`);
} catch(err){
  console.error('\nFAIL:',err && err.message);
  if(errors.length) console.error('console errors:',errors.join('\n'));
  process.exit(1);
}
