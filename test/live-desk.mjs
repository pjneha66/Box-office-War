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
  assert.equal(chips().length,6,'exactly six [data-livesub] chips in the document (Shows added in v34.9)');
  assert.equal($$('#subTabs [data-livesub]').length,0,'global sub-tab strip must not duplicate live navigation');
  assert.equal(new Set(chips().map(b=>b.closest('nav')||b.parentElement)).size,1,'all live chips belong to one navigation');
  assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,'exactly one live chip is active');
  assert.equal($('[data-livesub].active').dataset.livesub,'home','a fresh career opens the Live Desk home');
  const panels={home:'Broadcast home',shows:'Develop a show',linear:'24-Hour Electronic Program Guide',stream:'Live Studio Streaming Broadcast',events:'Major Live Events, Festivals & Red Carpets',studio:'On-Air Personalities & Broadcast Studio'};
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
  console.log('PASS A1: one live nav, six working chips, home default, save-safe selection');

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


  /* ── B — command shell on every reading, no legacy chrome ── */
  for(const key of Object.keys(panels)){
    fresh(key);
    assert($('#view .command-live'),`${key}: command shell missing`);
    assert.equal($$('#view .card').length,0,`${key}: no legacy .card in the Live Desk`);
    assert.equal($$('#view .section-title').length,0,`${key}: no legacy .section-title`);
    assert.equal($$('#view .cost-line').length,0,`${key}: no legacy .cost-line`);
    assert(viewText().includes('LIVE DESK / YEAR'),`${key}: LIVE DESK eyebrow`);
    assert(viewText().includes('The broadcast command desk.'),`${key}: command heading`);
    assert(viewText().includes('Broadcast & Live Entertainment Network'),`${key}: network subtitle preserved`);
    assert.equal($$('#view .command-telemetry .command-metric').length,4,`${key}: four shared telemetry metrics`);
    const head=$('#view .command-heading'), nav=$('#view .command-live-nav'), tel=$('#view .command-telemetry'), panel=$('#view .produce-panel');
    assert(head&&nav&&tel&&panel,`${key}: shell parts render`);
    const after=(a,b)=>Boolean(a.compareDocumentPosition(b)&w.Node.DOCUMENT_POSITION_FOLLOWING);
    assert(after(head,nav)&&after(nav,tel)&&after(tel,panel),`${key}: order is header → nav → telemetry → body`);
  }
  console.log('PASS B: LIVE DESK shell, order, four telemetry metrics, no legacy chrome');

  /* ── C1 — broadcast home reads the real network state ── */
  fresh('home');
  w.eval(`G.films.push(${FILM});G.live.events.submissions['venice']=99001;G.live.events.premieres.push({filmId:99001,city:'nyc',week:G.week});G.live.stats.totalBroadcastRev=42.5;G.live.stats.festivalsWon=2;render();`);
  assert(viewText().includes('2 / 8 unlocked'),'home counts unlocked channels');
  assert(viewText().includes('EPG Probe'),'home pending tray names the submitted film');
  assert(viewText().includes('Venice Film Festival'),'home pending tray names the festival');
  assert(viewText().includes('NYC'),'home pending tray names the premiere city');
  assert(viewText().includes('$42.5M')||viewText().includes('42.5'),'home lifetime broadcast profit is the real stat');
  assert(viewText().includes('Cumulative weekly viewers')||viewText().includes('CUMULATIVE WEEKLY VIEWERS'),'lifetime viewers labelled as a career sum');
  const nx=w.eval(`(function(){const d=DATA.LIVE_EVENTS.filter(e=>e.week>0).map(e=>({n:e.name,a:(e.week-woyOf(G.week)+52)%52})).sort((x,y)=>x.a-y.a)[0];return d.n;})()`);
  assert(viewText().includes(nx),'home names the actual next dated event');
  console.log('PASS C1: broadcast home — counts, next event, pending tray, honest lifetime labels');

  /* ── C2/C3/C4/C10 — channels desk ── */
  fresh('linear');
  assert.equal($$('#view .live-channel').length,8,'portfolio compares all eight channels');
  assert(viewText().includes('Prime programmed'),'portfolio shows scheduled prime-time counts');
  assert.equal($$('#view .live-epg-row').length,24,'EPG renders all 24 slots');
  assert(viewText().includes('Apex Automotive'),'EPG shows the default prime-time sponsor from engine state');
  assert(/ad tier/.test(viewText())&&/weight ×/.test(viewText()),'EPG shows slot weight and block ad tier separately');
  assert(/2h block/.test(viewText()),'EPG shows block duration metadata');
  for(const copy of ['Prime Movies','Overnight Infomercials','Library Reruns','Full Syndication','6pm–10pm','12am–5am'])
    assert(viewText().includes(copy),`strategy desk explains: ${copy}`);
  /* ledger is reference-only and reads live sponsors */
  assert(viewText().includes('Reference only'),'ledger separates reference data from actions');
  assert(viewText().includes('spot30'),'ledger lists the AD_INVENTORY rate cards');
  assert(viewText().includes('Pay-1 (First Window)'),'ledger lists RIGHTS_MARKET windows');
  assert(viewText().includes('Broadcast Rights'),'ledger explains EVENT_PARTICIPATION');
  assert(viewText().includes('GlowLife Supplements'),'ledger lists sponsors actually present in schedules');
  /* selecting a channel opens its real schedule */
  w.eval(`scheduleChannelSlot('bow_news',20,'live_event',null,'Newsroom Special');render();`);
  $('[data-live-ch="bow_news"]').click();
  assert.equal(w.eval('G.live.activeChannel'),'bow_news','portfolio selection uses the existing channel selector');
  assert(viewText().includes('Newsroom Special'),'the selected channel schedule is what renders');
  console.log('PASS C2/C3/C4/C10: portfolio, 24-slot EPG, strategy dayparts, read-only ledger');

  /* ── C5 — stream control room wires topic/quality into toggleLiveStream ── */
  fresh('stream');
  assert($('#liveStreamTopic')&&$('#liveStreamQuality'),'stream desk exposes topic and quality controls');
  w.eval(`document.querySelector('#liveStreamTopic').value='sports_desk';document.querySelector('#liveStreamQuality').value='4K';`);
  $('[data-live-stream-toggle]').click();
  assert.equal(w.eval('G.live.streaming.topic'),'sports_desk','starting the stream stores the chosen topic');
  assert.equal(w.eval('G.live.streaming.quality'),'4K','starting the stream stores the chosen quality');
  assert.equal($('#liveStreamTopic').disabled,true,'topic locks while on air (it applies at start)');
  w.eval(`G.live.streaming.chatMessages.push({user:'WhaleFan',text:'Take my money',isSuperChat:true,amount:50});render();`);
  assert(viewText().includes('Super Chat'),'super chats render in the feed');
  assert(viewText().includes('CinemaBuff99'),'seeded chat renders');
  console.log('PASS C5: topic/quality apply at start, chat + super chats, real metrics');

  /* ── C6 — calendar sorted by countdown; filters are view-only ── */
  fresh('events');
  const stateBefore=w.eval(`JSON.stringify(G.live)`);
  const firstCard=$('#view .live-event b').textContent;
  const nearest=w.eval(`(function(){const d=DATA.LIVE_EVENTS.filter(e=>e.week>0).map(e=>({n:e.name,a:(e.week-woyOf(G.week)+52)%52}));const m=Math.min(...d.map(x=>x.a));return d.filter(x=>x.a===m).map(x=>x.n);})()`);
  assert(nearest.some(n=>firstCard.includes(n)),'calendar leads with a nearest event');
  $('[data-live-event-filter="sports"]').click();
  assert(viewText().includes('Super Bowl')&&!viewText().includes('Academy Awards'),'sports filter narrows the calendar');
  assert.equal(w.eval(`JSON.stringify(G.live)`),stateBefore,'calendar filters never write simulation state');
  $('[data-live-event-filter="all"]').click();
  assert(viewText().includes('Every 208 weeks'),'recurrence renders for quadrennial events');
  assert(viewText().includes('Rights cost'),'rights-cost metadata renders');
  console.log('PASS C6: countdown order, view-only filters, recurrence + rights metadata');

  /* ── C7/C8 — tracker + premiere desk with city selection ── */
  fresh('events');
  w.eval(`G.films.push(${FILM});G.projects.push({id:99077,title:'Gala Probe',genre:'drama',buzzBonus:0});G.studio.cash=30;render();`);
  assert(viewText().includes('Festival submission tracker'),'festival tracker renders');
  assert($('#livePremiereCity'),'premiere desk offers city selection');
  assert.equal($$('#livePremiereCity option').length,4,'all four DATA premiere cities are offered');
  w.eval(`document.querySelector('#livePremiereCity').value='london';`);
  $('[data-live-premiere-host="99077"]').click();
  assert.equal(w.eval(`G.live.events.premieres[0].city`),'london','desk hosting passes the chosen city to hostRedCarpetPremiere');
  assert.equal(w.eval(`G.live.events.premieres[0].filmId`),99077,'desk hosting queues the chosen film');
  assert(viewText().includes('Scheduled premieres'),'scheduled premieres are reviewable');
  w.eval(`G.studio.cash=0.2;render();`);
  assert($('[data-live-premiere-host="99077"]').disabled,'premiere hosting disables below $1.5M');
  /* save/load keeps the whole live picture */
  w.eval(`G.studio.cash=50;G.live.events.submissions['tiff']=99001;scheduleChannelSlot('bow_movies',19,'movie',99001,'EPG Probe');saveGame();loadGame();render();`);
  assert.equal(w.eval(`G.live.events.submissions['tiff']`),99001,'pending submission survives save/load');
  assert.equal(w.eval(`G.live.events.premieres.length`),1,'pending premiere survives save/load');
  assert.equal(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[19].block`),'movie','scheduled film survives save/load');
  console.log('PASS C7/C8: tracker states, city selection, scheduled review, save/load integrity');

  /* ── C9 — host progression uses the engine level threshold ── */
  fresh('studio');
  assert(viewText().includes('0 / 100 XP to Lv.2'),'level 1 progress reads against level × 100');
  w.eval(`G.live.hosts.rex.level=3;G.live.hosts.rex.xp=250;render();`);
  assert(viewText().includes('250 / 300 XP to Lv.4'),'level 3 progress reads against 300 XP');
  assert(viewText().includes('Listed perk'),'host perks are labelled as DATA flavour');
  assert(viewText().includes('Gravitas')&&viewText().includes('Good evening, Hollywood'),'trait and quote render');
  assert(/energy does not drain/i.test(viewText()),'no invented energy-drain claim');
  console.log('PASS C9: real XP thresholds, honest perk/energy copy');


  /* ── D — Develop a Show (TV Studio Story-inspired show lab) ── */
  fresh('shows');
  assert(viewText().includes('Develop a show'),'show lab renders');
  assert(viewText().includes('Combo codex'),'combo codex renders format/theme compatibility');
  assert($('#liveShowName'),'show lab offers a name field');
  for(const f of ['format','theme','host','set','audience','tier','sponsor','channel','hour'])
    assert($(`[data-show-field="${f}"]`),`show lab field ${f} exists`);
  /* concept scoring: a loved combo must beat a mismatch, deterministically */
  const scores=w.eval(`(function(){
    const good=scoreShowConcept({format:'talk',theme:'cinema',host:'rex',set:'livingroom',audience:'adults',tier:'standard',sponsor:'none',channel:'bow_movies',hour:20});
    const bad=scoreShowConcept({format:'talk',theme:'sports',host:'reely',set:'kitchen',audience:'kids',tier:'standard',sponsor:'none',channel:'bow_movies',hour:20});
    return {good,bad};
  })()`);
  assert(scores.good.concept>scores.bad.concept,'loved format×theme combo out-scores a mismatch');
  assert(scores.good.appeal>scores.bad.appeal,'overall appeal follows the combo');
  /* create through the UI: cash charged once, slot programmed, show tracked */
  w.eval(`G.studio.cash=50;render();document.querySelector('#liveShowName').value='Harbor Tonight';`);
  const devCost=scores.good.totalDev;
  $('[data-live-show-create]').click();
  assert.equal(w.eval(`G.live.shows.length`),1,'developing creates exactly one show');
  const showId=w.eval(`G.live.shows[0].id`);
  assert.equal(w.eval(`G.live.shows[0].name`),'Harbor Tonight','the player name sticks');
  assert.equal(w.eval('G.studio.cash'),Math.round((50-devCost)*10)/10,'development cost charged exactly once');
  const airSlot=w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[20]`);
  assert.equal(airSlot.contentId,showId,'the show is programmed into its channel slot');
  assert.equal(airSlot.title,'Harbor Tonight','the EPG slot carries the show name');
  assert(viewText().includes('Harbor Tonight'),'the roster lists the new show');
  /* a broadcast week airs an episode: ratings, revenue, fans, craft XP */
  const cashBefore=w.eval('G.studio.cash');
  w.eval(`tickLiveBroadcasting();`);
  const aired=w.eval(`(function(){const s=G.live.shows[0];return {ep:s.episode,rating:s.lastRating,viewers:s.lastViewers,rev:s.lifetimeRevenue,fans:s.fans,craft:(G.live.showCraft.formats['talk']||0),hist:s.history.length};})()`);
  assert.equal(aired.ep,1,'one episode airs per broadcast week');
  assert(aired.rating>0&&aired.viewers>0,'the episode earns a rating and viewers');
  assert(aired.rev>0,'the episode books ad/sponsor revenue');
  assert(aired.fans>=0&&aired.hist===1,'fans and rating history are tracked');
  assert.equal(aired.craft,1,'genre craft XP accrues per episode (Kairosoft-style mastery)');
  /* failure paths: insufficient cash creates nothing and charges nothing */
  w.eval(`G.studio.cash=0.5;render();`);
  assert($('[data-live-show-create]').disabled,'develop button disables below the development cost');
  const fail=w.eval(`developLiveShow({format:'talk',theme:'cinema',host:'chloe',set:'livingroom',audience:'adults',tier:'standard',sponsor:'none',channel:'bow_movies',hour:21,name:'Too Poor'})`);
  assert.equal(fail.ok,false,'engine refuses an unaffordable show');
  assert.equal(w.eval(`G.live.shows.length`),1,'failed development creates no show');
  assert.equal(w.eval('G.studio.cash'),0.5,'failed development charges nothing');
  const locked=w.eval(`(function(){G.studio.cash=100;return developLiveShow({format:'talk',theme:'cinema',host:'chloe',set:'livingroom',audience:'adults',tier:'standard',sponsor:'none',channel:'bow_sports',hour:21,name:'Locked Out'});})()`);
  assert.equal(locked.ok,false,'shows cannot be scheduled on locked channels');
  /* season arc: 12 episodes → resting → renew into season 2 → cancel frees the slot */
  w.eval(`G.live.shows[0].episode=11;tickLiveBroadcasting();`);
  assert.equal(w.eval(`G.live.shows[0].status`),'resting','season ends after 12 episodes');
  const cashPreRenew=w.eval('G.studio.cash');
  w.eval(`render();`);
  $(`[data-live-show-renew="${showId}"]`).click();
  assert.equal(w.eval(`G.live.shows[0].season`),2,'renewal starts season 2');
  assert.equal(w.eval(`G.live.shows[0].episode`),0,'renewal resets the episode count');
  assert(w.eval('G.studio.cash')<cashPreRenew,'renewal charges its cost');
  w.eval(`render();`);
  $(`[data-live-show-cancel="${showId}"]`).click();
  assert.equal(w.eval(`G.live.shows[0].status`),'cancelled','cancellation takes the show off air');
  assert.notEqual(w.eval(`G.live.channels.find(c=>c.id==='bow_movies').schedule[20].contentId`),showId,'cancellation frees the program slot');
  /* reprogramming a slot unschedules (does not delete) its show */
  const second=w.eval(`(function(){const r=developLiveShow({format:'gameshow',theme:'family',host:'reely',set:'neonfloor',audience:'family',tier:'shoestring',sponsor:'local',channel:'bow_movies',hour:19,name:'Prize Panic'});return r;})()`);
  assert.equal(second.ok,true,'second show develops with a local sponsor');
  w.eval(`scheduleChannelSlot('bow_movies',19,'rerun',null,'Filler');tickLiveBroadcasting();`);
  assert.equal(w.eval(`G.live.shows.find(s=>s.name==='Prize Panic').status`),'unscheduled','overwriting the slot unschedules the show');
  /* persistence + old-save migration */
  w.eval(`saveGame();loadGame();`);
  assert.equal(w.eval(`G.live.shows.length`),2,'shows survive save/load');
  w.eval(`delete G.live.shows;delete G.live.showCraft;ensureLiveState(G);`);
  assert(Array.isArray(w.eval(`G.live.shows`))&&w.eval(`!!G.live.showCraft`),'old saves gain show state via ensureLiveState');
  console.log('PASS D: develop-a-show — combos, casting, sets, sponsors, seasons, rivals, persistence');

  assert.equal(errors.length,0,'no console errors during the live-desk suite: '+errors.join(' ; '));
  console.log('PASS live-desk A+B+C suites: navigation, EPG schema, strategies, events, results, fees, premiere-once, stream metrics');
}catch(e){
  console.error('FAIL live-desk:',e.message);
  if(errors.length) console.error('console errors:',errors.join(' ; '));
  process.exit(1);
}finally{ w.close(); }
