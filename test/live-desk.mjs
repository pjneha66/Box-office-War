/* LIVE DESK regressions (A1–A9) + command-desk feature coverage.
   Runs entirely against the local app shell in jsdom: no network, no save
   fixtures. Every A-test names the bug it guards so a future schema slip
   fails loudly instead of silently emptying a panel again. */
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
const chips=()=>$$('[data-livesub]');
const viewText=()=>($('#view')?$('#view').textContent:'');
const toastText=()=>$$('#toasts .toast').map(t=>t.textContent).join(' | ');
const clearToasts=()=>{ const h=$('#toasts'); if(h) h.innerHTML=''; };
const uiSource=fs.readFileSync('ui.js','utf8'), engineSource=fs.readFileSync('engine.js','utf8');

function fresh(sub){
  w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Live Desk Audit',SEL);enterApp(false);closeModal();switchTab('live');${sub?`G.live.subTab='${sub}';G.live.activeSub='${sub}';`:''}render();`);
}
const FILM=`{id:99001,title:'EPG Probe',genre:'action',quality:{overall:88,critic:80,aud:82},gross:120,critics:84,releaseWeek:G.week,craft:{script:90}}`;
const FILM2=`{id:99002,title:'Second Feature',genre:'drama',quality:{overall:72,critic:70,aud:71},gross:60,critics:72,releaseWeek:G.week,craft:{script:75}}`;
const SERIES=`{id:99051,title:'Desk Series',genre:'drama'}`;

try{
  await new Promise(r=>setTimeout(r,900));
  w.eval(`window.confirm=function(){return window.__confirm!==false;};`);

  /* ── A1 — one navigation, five chips, fresh careers open Home ── */
  fresh();
  assert.equal(chips().length,5,'exactly five [data-livesub] chips in the document');
  assert.equal($$('#subTabs [data-livesub]').length,0,'global sub-tab strip must not duplicate live navigation');
  assert.equal(new Set(chips().map(b=>b.closest('nav')||b.parentElement)).size,1,'all live chips belong to one navigation');
  assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,'exactly one live chip is active');
  assert.equal($('[data-livesub].active').dataset.livesub,'home','a fresh career opens the Live Desk home');
  const panels={home:'Broadcast home',linear:'24-Hour Electronic Program Guide',stream:'Live Studio Streaming Broadcast',events:'Major Live Events, Festivals & Red Carpets',studio:'On-Air Personalities & Broadcast Studio'};
  for(const [key,copy] of Object.entries(panels)){
    const chip=$(`[data-livesub="${key}"]`); assert(chip,`missing ${key} chip`);
    chip.click();
    assert.equal(w.eval('G.live.subTab'),key,`${key} chip writes live.subTab`);
    assert(viewText().includes(copy),`${key} chip switches to its panel (“${copy}”)`);
    assert.equal($(`[data-livesub="${key}"]`).classList.contains('active'),true,`${key} chip owns the active state`);
  }
  /* an existing selection survives save/load (old saves keep working) */
  w.eval(`G.live.subTab='events';G.live.activeSub='events';saveGame();loadGame();render();`);
  assert.equal($('[data-livesub].active').dataset.livesub,'events','saved sub-tab selection survives a save/load round-trip');
  console.log('PASS A1: one live nav, five working chips, home default, save-safe selection');

  /* ── A2 — EPG reads slot.block/slot.title; films use the “movie” block ── */
  assert(!uiSource.includes('primetime_movie'),'UI must never write the unsupported primetime_movie block');
  fresh('linear');
  w.eval(`G.films.push(${FILM});render();`);
  $('[data-live-slot="bow_movies:20"]').click();
  assert($('#slotFilm_99001'),'slot modal lists the catalog film');
  $('#slotFilm_99001').click();
  let slot=w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[20]`);
  assert.equal(slot.block,'movie','scheduling a film writes the real “movie” block');
  assert.equal(slot.contentId,99001,'scheduled slot keeps the film contentId');
  assert.equal(slot.title,'EPG Probe','scheduled slot keeps the film title in slot.title');
  assert(viewText().includes('EPG Probe'),'EPG renders the scheduled film title');
  assert(viewText().includes('Feature Film'),'EPG renders the real block name for slot.block');
  assert(viewText().includes('Q 88')||viewText().includes('Q: 88')||viewText().includes('88'),'EPG shows the scheduled film quality');
  w.eval(`saveGame();loadGame();render();`);
  slot=w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[20]`);
  assert.equal(slot.block,'movie','film block survives save/load');
  assert(viewText().includes('EPG Probe'),'film title still renders after save/load');
  /* sponsor + rating + custom title written by the engine render verbatim */
  w.eval(`scheduleChannelSlot('bow_movies',3,'infomercial',null,'Night Owl Vitamins');render();`);
  const s3=w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[3]`);
  assert(viewText().includes('Night Owl Vitamins'),'EPG renders slot.title');
  assert(viewText().includes(s3.sponsor),'EPG renders slot.sponsor');
  assert(viewText().includes('Paid Programming'),'EPG renders the infomercial block label');
  console.log('PASS A2: EPG reads engine fields, movie block persists, sponsor/title render');

  /* ── A3 — only real auto-fill strategies; success only on real change ── */
  fresh('linear');
  const supported=['prime_movies','infomercials','library_reruns','full_syndication'];
  const stratBtns=$$('[data-live-autofill]');
  assert(stratBtns.length>=4,'the strategy desk exposes the auto-fill strategies');
  for(const b of stratBtns){
    const s=b.dataset.liveAutofill.split(':')[1];
    assert(supported.includes(s),`auto-fill strategy “${s}” is supported by autoFillSchedule`);
  }
  assert(!stratBtns.some(b=>/:(quality|hype)$/.test(b.dataset.liveAutofill)),'no quality/hype pseudo-strategies remain');
  /* empty library: prime_movies cannot change anything → no false success */
  const beforeEmpty=w.eval(`JSON.stringify(G.live.channels.find(c=>c.id==='bow_movies').schedule)`);
  clearToasts();
  $('[data-live-autofill="bow_movies:prime_movies"]').click();
  assert.equal(w.eval(`JSON.stringify(G.live.channels.find(c=>c.id==='bow_movies').schedule)`),beforeEmpty,'empty-library prime_movies leaves the grid untouched');
  assert(!/auto-scheduled|scheduled \(prime_movies\)/i.test(toastText()),'no success toast when nothing changed');
  /* populated library: each strategy really mutates its daypart */
  w.eval(`G.films.push(${FILM},${FILM2});G.series.push(${SERIES});render();`);
  $('[data-live-autofill="bow_movies:prime_movies"]').click();
  assert.equal(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[20].block`),'movie','prime_movies fills prime time with movies');
  assert([99001,99002].includes(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[20].contentId`)),'prime_movies schedules real films');
  $('[data-live-autofill="bow_movies:infomercials"]').click();
  assert.equal(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[2].block`),'infomercial','infomercials fills the overnight daypart');
  $('[data-live-autofill="bow_movies:library_reruns"]').click();
  assert(['series','rerun'].includes(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[12].block`)),'library_reruns fills daytime from the library');
  $('[data-live-autofill="bow_movies:full_syndication"]').click();
  assert.equal(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[4].block`),'infomercial','full_syndication covers overnight too');
  /* Clear Grid asks first */
  const beforeClear=w.eval(`JSON.stringify(G.live.channels.find(c=>c.id==='bow_movies').schedule)`);
  w.eval(`window.__confirm=false;`);
  $('[data-live-clear="bow_movies"]').click();
  assert.equal(w.eval(`JSON.stringify(G.live.channels.find(c=>c.id==='bow_movies').schedule)`),beforeClear,'declining the confirmation keeps the grid');
  w.eval(`window.__confirm=true;`);
  $('[data-live-clear="bow_movies"]').click();
  assert(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule.every(s=>s.block==='rerun')`),'confirming Clear Grid resets all 24 slots');
  console.log('PASS A3: four real strategies mutate real dayparts; no fake success; Clear confirms');

  /* ── A4 — every LIVE_EVENTS record renders with its real fields ── */
  fresh('events');
  const names=w.eval(`DATA.LIVE_EVENTS.map(e=>e.name)`);
  for(const n of names) assert(viewText().includes(n),`event “${n}” is visible in the calendar`);
  for(const probe of ['Academy Awards','Cannes Film Festival','Super Bowl','Met Gala','LA Premiere'])
    assert(viewText().includes(probe),`${probe} renders (awards/festival/sports/cultural/premiere)`);
  assert(viewText().includes('The big night.'),'event descriptions come from DATA desc');
  assert(/Prestige/.test(viewText())&&viewText().includes('100'),'event prestige renders as a score, not a multiplier');
  assert(!viewText().includes('undefined'),'no undefined leaks into the events panel');
  console.log('PASS A4: all event types render with real desc/prestige metadata');

  /* ── A5 — {ok, reason, earned, live} result objects are honoured ── */
  fresh('linear');
  w.eval(`G.studio.cash=500;G.live.activeChannel='bow_sports';render();window.__realUnlock=unlockLiveChannel;unlockLiveChannel=function(){return {ok:false,reason:'STUB UNLOCK FAIL'};};`);
  clearToasts();
  const lockedBtn=$('[data-live-unlock]'); assert(lockedBtn,'a locked channel exposes an unlock button');
  lockedBtn.click();
  assert(toastText().includes('STUB UNLOCK FAIL'),'failed unlock shows result.reason');
  w.eval(`unlockLiveChannel=window.__realUnlock;`);
  /* ad break: earned is a field, not the return value */
  fresh('stream');
  w.eval(`G.live.streaming.live=true;G.live.streaming.ccv=2;render();window.__realAd=runLiveStreamAdBreak;runLiveStreamAdBreak=function(){return {ok:true,earned:3.7};};`);
  clearToasts();
  $('[data-live-adbreak]').click();
  assert(toastText().includes('$3.7M')||toastText().includes('3.7'),'successful ad break displays result.earned');
  w.eval(`runLiveStreamAdBreak=function(){return {ok:false,reason:'STUB AD FAIL'};};`);
  clearToasts();
  $('[data-live-adbreak]').click();
  assert(toastText().includes('STUB AD FAIL'),'failed ad break shows result.reason');
  w.eval(`runLiveStreamAdBreak=window.__realAd;`);
  /* stream toggle flips real state both ways */
  $('[data-live-stream-toggle]').click();
  assert.equal(w.eval('G.live.streaming.live'),false,'toggle ends a live stream');
  $('[data-live-stream-toggle]').click();
  assert.equal(w.eval('G.live.streaming.live'),true,'toggle starts the stream');
  /* host training failure surfaces the reason */
  fresh('studio');
  w.eval(`G.studio.cash=50;render();window.__realTrain=trainLiveHost;trainLiveHost=function(){return {ok:false,reason:'STUB TRAIN FAIL'};};`);
  clearToasts();
  $('[data-live-host-train]').click();
  assert(toastText().includes('STUB TRAIN FAIL'),'failed training shows result.reason');
  w.eval(`trainLiveHost=window.__realTrain;`);
  console.log('PASS A5: result objects checked via .ok/.earned/.reason everywhere');

  /* ── A6 + A7(festival) — argument order, $0.25M fee, tick processing ── */
  fresh('events');
  w.eval(`G.films.push(${FILM});G.studio.cash=10;render();`);
  $('[data-live-fest-submit="cannes"]').click();
  const festBtn=$('#festSub_99001'); assert(festBtn,'festival modal offers the eligible film');
  assert(festBtn.textContent.includes('0.25'),'festival button displays the real $0.25M fee');
  festBtn.click();
  assert.equal(w.eval(`G.live.events.submissions['cannes']`),99001,'submission is keyed by festivalId with the filmId as value');
  assert.equal(w.eval('G.studio.cash'),9.7,'festival fee is charged exactly once (spend() rounds $0.25M to the $0.3M ledger step)');
  assert(!$('#festSub_99001'),'successful submission closes the modal');
  /* the queued film is processed by the event tick in festival week */
  w.eval(`G.week=G.week-woyOf(G.week)+20;tickLiveEvents();`);
  assert.equal(w.eval(`G.live.events.submissions['cannes']`),undefined,'tickLiveEvents consumes the pending submission');
  /* failure: no cash → no pending entry, no success, modal stays open */
  fresh('events');
  w.eval(`G.films.push(${FILM});G.studio.cash=0.1;render();`);
  $('[data-live-fest-submit="venice"]').click();
  const poorBtn=$('#festSub_99001');
  if(poorBtn && !poorBtn.disabled){ clearToasts(); poorBtn.click(); assert(toastText().length||$('#festSub_99001'),'failed submission reports the failure'); }
  assert.equal(w.eval(`G.live.events.submissions['venice']`),undefined,'failed submission creates no pending entry');
  assert.equal(w.eval('G.studio.cash'),0.1,'failed submission charges nothing');
  console.log('PASS A6/A7: submitFilmToFestival(filmId, festivalId), $0.25M once, tick-safe');

  /* ── A7 — displayed fees equal the engine charges ── */
  fresh('linear');
  w.eval(`G.studio.cash=100;G.live.activeChannel='bow_sports';render();`);
  const unlockBtn=$('[data-live-unlock="bow_sports"]'); assert(unlockBtn,'sports channel unlock button renders');
  assert(unlockBtn.textContent.includes('25'),'unlock button shows the real DATA cost ($25M)');
  unlockBtn.click();
  assert.equal(w.eval('G.studio.cash'),75,'unlock charges exactly DATA.liveChannel(id).cost');
  assert.equal(w.eval(`G.live.channels.find(c=>c.id==='bow_sports').unlocked`),true,'channel unlocks after payment');
  /* insufficient cash → disabled, with no invented reputation gate */
  w.eval(`G.studio.cash=3;G.live.activeChannel='bow_prestige';render();`);
  assert.equal($('[data-live-unlock="bow_prestige"]').disabled,true,'unlock is disabled below the real cost');
  assert(!/Requires Rep/.test(viewText()),'no fabricated minRep requirement is displayed');
  /* host training: $1.0M displayed and charged */
  fresh('studio');
  w.eval(`G.studio.cash=10;render();`);
  const trainBtn=$('[data-live-host-train="chloe"]');
  assert(/\$1(\.0)?M/.test(trainBtn.textContent),'train button displays the real $1.0M cost');
  trainBtn.click();
  assert.equal(w.eval('G.studio.cash'),9,'training charges exactly $1.0M');
  assert.equal(w.eval(`G.live.hosts.chloe.charisma`),86,'training applies the engine charisma gain');
  w.eval(`G.studio.cash=0.5;render();`);
  assert.equal($('[data-live-host-train="chloe"]').disabled,true,'training is disabled below $1.0M');
  /* premiere: $1.5M displayed and charged */
  fresh('events');
  w.eval(`G.projects.push({id:99077,title:'Gala Probe',genre:'drama',buzzBonus:0});G.studio.cash=20;render();`);
  $('[data-live-premiere]').click();
  const modalText=($('#modalRoot')?$('#modalRoot').textContent:'');
  assert(modalText.includes('1.5'),'premiere modal displays the real $1.5M cost');
  assert(!modalText.includes('+15'),'premiere modal carries no fake immediate +15 buzz copy');
  const premBtn=$('#premGo_99077'); assert(premBtn,'premiere modal offers the project');
  premBtn.click();
  assert.equal(w.eval('G.studio.cash'),18.5,'premiere charges exactly $1.5M');
  console.log('PASS A7: channel/festival/premiere/host fees display == charge, honest disabled states');

  /* ── A8 — premiere buzz applies exactly once (on the broadcast tick) ── */
  const buzz=w.eval(`(function(){
    const p=G.projects.find(x=>x.id===99077);
    const afterHost=p.buzzBonus||0;
    const queued=G.live.events.premieres.length;
    tickLiveEvents();
    const afterTick=p.buzzBonus||0;
    tickLiveEvents();
    return {afterHost,queued,afterTick,afterTick2:p.buzzBonus||0,left:G.live.events.premieres.length};
  })()`);
  assert.equal(buzz.afterHost,0,'hosting alone applies no immediate buzz (no double-count)');
  assert.equal(buzz.queued,1,'the premiere is queued for broadcast');
  assert.equal(buzz.afterTick,0.25,'the broadcast tick applies +0.25 buzzBonus exactly once');
  assert.equal(buzz.afterTick2,0.25,'a second tick does not re-apply premiere buzz');
  assert.equal(buzz.left,0,'the aired premiere leaves the pending queue');
  console.log('PASS A8: premiere buzz +0.25 once, at broadcast');

  /* ── A9 — stream metrics are honest numbers ── */
  fresh('stream');
  w.eval(`G.live.streaming.totalHours=336;G.live.streaming.quality='4K';G.live.streaming.topic='behind_scenes';G.live.streaming.subConversions=1.4;render();`);
  assert(viewText().includes('336'),'total stream hours render as a number');
  assert(!viewText().includes('$336'),'hours are never formatted as currency');
  assert(!viewText().includes('(+$K)'),'the placeholder “Run Ad Break (+$K)” copy is gone');
  assert(viewText().includes('4K'),'the real stream.quality is displayed');
  assert(!viewText().includes('1080p 60FPS'),'no hardcoded 1080p 60FPS claim');
  assert(viewText().includes('behind_scenes')||/behind/i.test(viewText()),'the stream topic is displayed');
  assert.equal($('[data-live-adbreak]').disabled,true,'ad break is disabled while off air');
  assert(/off air|offline|not live/i.test(viewText()),'offline state is explained');
  console.log('PASS A9: hours≠money, real quality/topic, honest offline controls');

  assert.equal(errors.length,0,'no console errors during the live-desk suite: '+errors.join(' ; '));
  console.log('PASS live-desk A-suites: navigation, EPG schema, strategies, events, results, fees, premiere-once, stream metrics');
}catch(e){
  console.error('FAIL live-desk:',e.message);
  if(errors.length) console.error('console errors:',errors.join(' ; '));
  process.exit(1);
}finally{ w.close(); }
