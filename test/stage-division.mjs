/* STAGE DIVISION regressions (S1–S10).
   Runs offline against the local app shell in jsdom. Every S-test names the
   contract it guards — save compatibility, the one-house-one-show rule, the
   weekly tick wiring, the ledger category, and the greenlight form. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8')
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
const S=()=>w.eval('G.stage');

/* deterministic stub for the audio bus so tests never touch WebAudio */
w.eval(`
  window.__beeps=[];
  beep = function(kind){ window.__beeps.push(kind); };
`);

function fresh(){
  w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Stage Audit',SEL);enterApp(false);closeModal();`);
}
/* advance the stage clock only — no rival AI, no events, no modals */
function tick(n=1){ w.eval(`for(let i=0;i<${n};i++){G.week++;G.weekTx={};StageDivision.tick(G);}`); }
function funded(){ w.eval(`G.studio.cash=900;G.studio.rep=72;`); }
function unlocked(){ funded(); w.eval(`StageDivision.unlock(G);`); }
function stageTab(){ w.eval(`if(!G.empire)G.empire={};G.empire.subTab='stage';G.empire.activeSub='stage';switchTab('empire');render();`); }
function openChamber(){
  const r=w.eval(`StageDivision.greenlight({sourceId:'original',scale:'chamber',composerId:'solene',directorId:'brennan'},G)`);
  assert.equal(r.ok,true,'chamber show should greenlight into an owned workshop');
  return r.show;
}
function toRunning(){ tick(5); tick(3); }

try{
  await new Promise(r=>setTimeout(r,900));

  /* ══ S1 — additive state: nothing is created until the module is touched ══ */
  fresh();
  assert.equal(w.eval('typeof StageDivision'),'object','stage-division.js must load as a global module');
  assert.equal(w.eval('typeof G.stage'),'undefined','a fresh career carries no stage record at all');
  const sm0=w.eval('StageDivision.summary(G)');
  assert.equal(sm0.houses,0,'summary reports no houses before the division opens');
  assert.equal(sm0.running+sm0.developing,0,'summary reports no shows before the division opens');
  assert.equal(sm0.weekly,0,'summary reports no weekly money before the division opens');
  assert.equal(sm0.tonys,0,'summary reports no Tonys before the division opens');
  w.eval(`G.week++;G.weekTx={};StageDivision.tick(G);`);
  assert.equal(w.eval('G.stage.unlocked'),false,'tick creates the record but leaves it locked');
  assert.equal(w.eval('G.weekTx.stage||0'),0,'a locked division never touches the ledger');
  console.log('PASS S1: lazy additive state, safe summary, no spend before unlock');

  /* ══ S2 — unlock refuses with reasons, then debits exactly the lease ══ */
  fresh();
  w.eval(`G.studio.cash=900;G.studio.rep=8;`);
  let r=w.eval(`StageDivision.unlock(G)`);
  assert.equal(r.ok,false,'unlock must refuse on reputation');
  assert.match(r.reason,/reputation/i,'reputation refusal names the problem');
  w.eval(`G.studio.rep=72;G.studio.cash=10;`);
  r=w.eval(`StageDivision.unlock(G)`);
  assert.equal(r.ok,false,'unlock must refuse on cash');
  assert.match(r.reason,/Need|have/i,'cash refusal names the problem');
  w.eval(`G.studio.cash=900;window.__cash0=G.studio.cash;`);
  r=w.eval(`StageDivision.unlock(G)`);
  assert.equal(r.ok,true,'unlock succeeds with rep + cash');
  assert.equal(w.eval('G.stage.unlocked'),true,'unlock flips the flag');
  assert.equal(S().houses.length,1,'unlock leases the first house');
  assert.equal(+ (w.eval('G.studio.cash')).toFixed(1), w.eval('window.__cash0')-45,'lease costs exactly $45M');
  r=w.eval(`StageDivision.unlock(G)`);
  assert.equal(r.ok,false,'a second unlock is refused');
  console.log('PASS S2: unlock gates on rep + cash, charges $45M once, second call refused');

  /* ══ S3 — buying houses is ordered and persistent across save/load ══ */
  r=w.eval(`StageDivision.buyHouse(3,G)`);
  assert.equal(r.ok,false,'the flagship cannot be bought before the Marquee');
  assert.match(r.reason,/Own/i,'out-of-order refusal explains the order');
  w.eval(`G.studio.cash=900;G.studio.rep=72;`);
  r=w.eval(`StageDivision.buyHouse(2,G)`);
  assert.equal(r.ok,true,'tier 2 can be leased once tier 1 is owned');
  assert.equal(S().houses.length,2,'two houses stand');
  w.eval(`saveGame();G.stage={};loadGame();`);
  assert.equal(w.eval('G.stage.unlocked'),true,'unlock survives a save/load round-trip');
  assert.equal(S().houses.length,2,'houses survive a save/load round-trip');
  console.log('PASS S3: ordered house purchases, save/load persistence, no migration needed');

  /* ══ S4 — greenlight validates scale versus houses and quotes honestly ══ */
  fresh(); unlocked();
  r=w.eval(`StageDivision.greenlight({sourceId:'original',scale:'standard',composerId:'solene',directorId:'brennan'},G)`);
  assert.equal(r.ok,false,'a Broadway-standard show needs a Broadway house');
  assert.match(r.reason,/needs/i,'scale refusal names the missing house');
  const q=w.eval(`StageDivision.quote({sourceId:'original',scale:'chamber',composerId:'solene',directorId:'brennan',starId:null},G)`);
  assert(q.cost>0 && q.reviews>0 && q.low<=q.reviews && q.high>=q.reviews,'the quote carries cost + a review range');
  w.eval(`window.__cash1=G.studio.cash;`);
  const show=openChamber();
  assert.equal(show.phase,'rehearsal','a new show starts in rehearsal');
  assert.equal(show.weeksLeft,5,'chamber staging rehearses for 5 weeks');
  assert.equal(show.capitalization,q.cost,'the greenlit capitalization matches the quote');
  assert.equal(w.eval('window.__cash1'),w.eval('G.studio.cash')+q.cost,'capitalisation is paid up front');
  r=w.eval(`StageDivision.greenlight({sourceId:'original',scale:'chamber',composerId:'wren',directorId:'grange'},G)`);
  assert.equal(r.ok,true,'a second chamber show can be developed in parallel');
  console.log('PASS S4: scale/house validation, honest quote, capitalization debited up front');

  /* ══ S5 — rehearsal → previews → opening → one house, one show ══ */
  // two shows are in rehearsal; only one house exists
  tick(5);
  const st=w.eval(`G.stage.shows.map(s=>({id:s.id,phase:s.phase,house:s.houseId}))`);
  assert.equal(st.filter(s=>s.phase==='previews').length,1,'exactly one show occupies the single house');
  assert.equal(st.filter(s=>s.phase==='waiting').length,1,'the second show queues for a house instead of double-booking');
  tick(3);
  const running=w.eval(`G.stage.shows[0]`);
  assert.equal(running.phase,'running','previews end in an opening night');
  assert(running.reviews>=12 && running.reviews<=99,`reviews are clamped (got ${running.reviews})`);
  assert(running.openedWeek>0,'opening week is stamped');
  const firstId=running.id;
  r=w.eval(`StageDivision.closeShow('${firstId}',G)`);
  assert.equal(r.ok,true,'a running show can be closed');
  assert.equal(S().shows.length,1,'the closed show leaves the house');
  assert.equal(S().history.length,1,'the closed show enters the history ledger');
  assert.equal(w.eval(`G.stage.shows[0].phase`),'previews','closing frees the house for the queued show immediately');
  console.log('PASS S5: rehearsal → previews → opening, one house per show, queue pumps on close');

  /* ══ S6 — the weekly tick is wired into advanceWeek() and pays through earn() ══ */
  fresh(); unlocked(); openChamber();
  const wl=w.eval('G.stage.shows[0].weeksLeft');
  w.eval(`advanceWeek();`);
  assert.equal(w.eval('G.stage.shows[0].weeksLeft'),wl-1,'advanceWeek() drives StageDivision.tick');
  toRunning();
  w.eval(`G.stage.shows[0].reviews=88;G.stage.shows[0].weeksRun=0;`);
  const hit=w.eval(`StageDivision._internals.weeklyFor(G.stage.shows[0],G)`);
  assert(hit.net>0,`a well-reviewed show is profitable weekly (net ${hit.net})`);
  const cash0=w.eval('G.studio.cash');
  w.eval(`G.week++;G.weekTx={};StageDivision.tick(G);`);
  const upkeep=w.eval(`StageDivision._internals.venueByTier(1).upkeep`);
  const delta=w.eval('G.studio.cash')-cash0;
  assert(Math.abs(delta-(hit.net-upkeep))<0.25,`weekly house money lands in cash (${delta} vs ${hit.net-upkeep})`);
  assert(w.eval('G.weekTx.stage')>0,'the stage ledger category records the week');
  w.eval(`G.stage.shows[0].reviews=22;`);
  const flop=w.eval(`StageDivision._internals.weeklyFor(G.stage.shows[0],G)`);
  assert(flop.net<0,`a panned show loses money every week (net ${flop.net})`);
  console.log('PASS S6: advanceWeek wiring, earn()/spend() routing, hit profits and flop bleeds');

  /* ══ S7 — recoupment is tracked against capitalization ══ */
  w.eval(`G.stage.shows[0].reviews=88;G.stage.shows[0].net=G.stage.shows[0].capitalization-0.1;G.stage.shows[0].recouped=false;`);
  w.eval(`G.week++;G.weekTx={};StageDivision.tick(G);`);
  assert.equal(w.eval('G.stage.shows[0].recouped'),true,'operating profit past capitalization flips recouped');
  assert(S().shows[0].net>=S().shows[0].capitalization,'net keeps accumulating after recoupment');
  console.log('PASS S7: recoupment milestone tracked against capitalisation');

  /* ══ S8 — tour, album and licensing gates + payouts ══ */
  w.eval(`G.stage.shows[0].weeksRun=5;G.stage.shows[0].tour=null;G.stage.shows[0].album=null;G.stage.shows[0].licensed=false;G.stage.shows[0].reviews=80;`);
  r=w.eval(`StageDivision.launchTour('${firstId}',G)`);
  assert.equal(r.ok,false,'touring is refused before 8 weeks');
  assert.match(r.reason,/8 weeks/i,'touring refusal names the wait');
  r=w.eval(`StageDivision.licenseShow('${firstId}',G)`);
  assert.equal(r.ok,false,'licensing is refused before 16 weeks');
  w.eval(`G.stage.shows[0].weeksRun=20;window.__cash2=G.studio.cash;`);
  r=w.eval(`StageDivision.launchTour('${firstId}',G)`);
  assert.equal(r.ok,true,'a 20-week hit can go on tour');
  assert(w.eval('G.studio.cash')<w.eval('window.__cash2'),'mounting the tour costs money');
  assert(w.eval(`G.stage.shows[0].tour.weekly`)>0,'the tour pays weekly');
  r=w.eval(`StageDivision.launchTour('${firstId}',G)`);
  assert.equal(r.ok,false,'a second touring company is refused');
  r=w.eval(`StageDivision.releaseAlbum('${firstId}',G)`);
  assert.equal(r.ok,true,'a reviewed running show can cut a cast album');
  assert(w.eval(`G.stage.shows[0].album.weekly`)>0,'the album pays royalties');
  r=w.eval(`StageDivision.licenseShow('${firstId}',G)`);
  assert.equal(r.ok,true,'staging rights license after 16 weeks');
  assert(r.fee>0,'licensing pays a lump sum');
  r=w.eval(`StageDivision.licenseShow('${firstId}',G)`);
  assert.equal(r.ok,false,'rights can only be licensed once');
  const before=w.eval(`G.stage.shows[0].tour.weeksLeft`);
  w.eval(`G.week++;G.weekTx={};StageDivision.tick(G);`);
  assert.equal(w.eval(`G.stage.shows[0].tour.weeksLeft`),before-1,'the tour advances weekly');
  console.log('PASS S8: tour/album/licence gates, one-shot rights, weekly payouts');

  /* ══ S9 — Tony season lifts occupancy and reputation exactly once a year ══ */
  w.eval(`G.stage.tonys=0;G.stage.lastTonyYear=0;G.stage.shows[0].reviews=96;G.stage.shows[0].weeksRun=10;G.stage.shows[0].tonysWon=0;G.stage.shows[0].occBonus=0;G.week=24;G.weekTx={};window.__rep0=G.studio.rep;StageDivision.tick(G);`);
  assert.equal(w.eval('G.stage.tonys'),1,'week 24 crowns one Best Musical');
  assert.equal(w.eval(`G.stage.shows[0].tonyStatus`),'winner','the winning show is tagged');
  assert(w.eval(`G.stage.shows[0].occBonus`)>0,'the Tony lifts occupancy');
  assert(w.eval('G.studio.rep')>w.eval('window.__rep0'),'the Tony lifts studio reputation');
  w.eval(`G.weekTx={};StageDivision.tick(G);`);
  assert.equal(w.eval('G.stage.tonys'),1,'the same year cannot crown twice');
  console.log('PASS S9: annual Tony season, occupancy + reputation, no repeat award');

  /* ══ S10 — the Empire desk renders, the form quotes, the buttons act ══ */
  fresh(); funded(); stageTab();
  assert(viewText().includes('Great White Way'),'the stage panel renders its own section');
  assert($('[data-stage-unlock]'),'the unlock button exists before the division opens');
  clearToasts();
  $('[data-stage-unlock]').click();
  assert.equal(w.eval('G.stage.unlocked'),true,'clicking unlock opens the division');
  assert(viewText().includes('Houses'),'the houses board renders after unlock');
  assert($('[data-stage-greenlight]'),'the greenlight form is present');
  assert($('#stageQuote').textContent.length>0,'the quote line is populated on first paint');
  const beforeQuote=$('#stageQuote').textContent;
  $('#stageScale').value='standard';
  $('#stageScale').dispatchEvent(new w.Event('change'));
  assert.notEqual($('#stageQuote').textContent,beforeQuote,'changing the scale updates the quote');
  $('#stageScale').value='chamber';
  $('#stageScale').dispatchEvent(new w.Event('change'));
  $('[data-stage-greenlight]').click();
  assert.equal(w.eval('G.stage.shows.length'),1,'the greenlight button creates a show');
  assert(viewText().includes('In rehearsal'),'the rehearsal board renders the new show');
  assert($('[data-stage-cancel]'),'rehearsal shows carry a cancel control');
  // a real tick must never throw through the panel or the bindings
  tick(8);
  stageTab();
  assert(viewText().includes('Now playing'),'an opened show moves to Now playing');
  assert(!viewText().includes('NaN'),'no NaN leaks into the panel');
  console.log('PASS S10: desk renders, quote recalculates, greenlight + cancel work end to end');

  /* ══ ledger honesty ══ */
  assert.equal(w.eval('FinanceDesk.categoryLabel("stage").indexOf("unmapped")'),-1,'the stage category is mapped in the Treasury desk');
  assert.equal(w.eval('FinanceDesk.CATEGORIES.stage.bucket'),'empire','stage revenue rolls into the empire bucket');
  assert.equal(w.eval('FinanceDesk.CATEGORIES.stage.expBucket'),'investment','stage costs roll into investment');
  console.log('PASS S-LEDGER: the Treasury desk knows the stage category');

  assert.deepEqual(errors,[],'no console errors during the suite');
  console.log('\nSTAGE DIVISION SUITE PASSED ✅');
  dom.window.close();
  process.exit(0);
}catch(e){
  console.error('\nSTAGE DIVISION FAILED ❌',e);
  if(errors.length) console.error('console errors:',errors.slice(0,5));
  process.exit(1);
}
