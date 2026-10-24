/* EMPIRE DESK regressions (A1–A11) + command-desk shell (B) + C1–C11 coverage.
   Runs entirely offline against the local app shell in jsdom: no network,
   no external fixtures. Every A-test proves its defect against real state. */
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
const chips=()=>$$('[data-empiresub]');
const viewText=()=>($('#view')?$('#view').textContent:'');
const toastText=()=>$$('#toasts .toast').map(t=>t.textContent).join(' | ');
const clearToasts=()=>{ const h=$('#toasts'); if(h) h.innerHTML=''; };

/* Track every beep() sting so A2/A11 can prove zero false-success sounds */
w.eval(`
  window.__beeps=[];
  const _origBeep = typeof beep === 'function' ? beep : function(){};
  beep = function(kind){ window.__beeps.push(kind); return _origBeep(kind); };
`);
const clearBeeps=()=>{ w.__beeps.length=0; };
const beeps=()=>[...w.__beeps];

function fresh(sub){
  w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Empire Desk Audit',SEL);enterApp(false);closeModal();switchTab('empire');${sub?`if(!G.empire)G.empire={};G.empire.subTab='${sub}';G.empire.activeSub='${sub}';`:''}render();`);
}

try{
  await new Promise(r=>setTimeout(r,900));
  w.eval(`window.confirm=function(){return window.__confirm!==false;};`);

  /* ── A1 — one Empire navigation, five real switchable sections, persisted ── */
  fresh();
  assert.equal($$('#subTabs [data-empiretab], #subTabs [data-empiresub]').length,0,'global #subTabs strip must not render dead or duplicate empire chips');
  assert.equal($('#subTabs').style.display,'none','global #subTabs is hidden on Empire');
  assert.equal($$('#view .subnav-pills').length,0,'legacy .subnav-pills row is gone from Empire');
  assert.equal($$('[data-empiretab]').length,0,'dead [data-empiretab] chips are gone');
  assert.equal(chips().length,5,'exactly five [data-empiresub] chips in Empire navigation');
  assert.deepEqual(chips().map(b=>b.dataset.empiresub),['home','franchises','universes','divisions','endgame'],'five section keys match Home / Franchises / Universes / Divisions / Endgame');
  assert.equal(new Set(chips().map(b=>b.closest('nav')||b.parentElement)).size,1,'all empire chips belong to one navigation container');
  assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,'exactly one empire chip is active');
  assert.equal($('[data-empiresub].active').dataset.empiresub,'franchises','fresh career opens Franchises safely by default');

  const expectedPanels={
    home:/Empire home|No franchises yet|unlock/i,
    franchises:/Franchises/,
    universes:/universe/i,
    divisions:/Music|Merch|Publishing/i,
    endgame:/Endgame|industry influence/i
  };
  for(const [key,rx] of Object.entries(expectedPanels)){
    const chip=$(`[data-empiresub="${key}"]`);
    assert(chip,`missing [data-empiresub="${key}"] chip`);
    chip.click();
    assert.equal(w.eval('TAB'),'empire',`clicking ${key} chip stays inside Empire tab`);
    assert.equal(w.eval('G.empire && G.empire.subTab'),key,`${key} chip persists to G.empire.subTab`);
    assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,`only ${key} chip is active`);
    assert.equal($(`[data-empiresub="${key}"]`).classList.contains('active'),true,`${key} chip has .active`);
    assert.match(viewText(),rx,`${key} chip renders its own panel`);
  }

  /* Save/load round-trip preserves active Empire sub-tab */
  w.eval(`G.empire.subTab='universes';G.empire.activeSub='universes';saveGame();loadGame();render();`);
  assert.equal($('[data-empiresub].active').dataset.empiresub,'universes','selected sub-tab survives saveGame/loadGame');

  /* Old saves without G.empire default safely without error */
  w.eval(`delete G.empire;saveGame();loadGame();render();`);
  assert.equal($('[data-empiresub].active').dataset.empiresub,'franchises','legacy save without G.empire defaults safely');
  console.log('PASS A1: one 5-chip Empire navigation, real panel switching, save/load persistence');

  /* ── A2 — structured {ok, reason} returns; zero false-success audio or modal close ── */
  fresh('franchises');
  w.eval(`
    G.franchises=[
      {id:101,name:'Solar Crown',tier:3,entries:[{filmId:1,title:'Solar Crown',ww:300,week:1}],ww:300,merch:1,park:0,gameSold:3,decay:1,genre:'scifi',earned:0,built:1,fatigue:0.2},
      {id:102,name:'Lunar Reign',tier:3,entries:[{filmId:2,title:'Lunar Reign',ww:260,week:2}],ww:260,merch:0,park:0,gameSold:0,decay:1,genre:'fantasy',earned:0,built:2,fatigue:0.1}
    ];
    G.studio.cash=0;
    render();
  `);

  /* 1. All 11 engine helpers return {ok:false, reason} on refusal */
  const refusals=w.eval(`({
    merch: upgradeMerch(101),
    park: buildPark(101),
    game: sellGameRights(101),
    toys: signToyLine(101),
    collab: brandCollab(101),
    dtv: dtvSequel(101),
    resort: buildResort(101),
    pub: launchPublishing(101),
    cross: crossoverEvent(101,102),
    merge: mergeUniverse(101,102),
    lic: licenseOut(999999,'film')
  })`);
  for(const [k,r] of Object.entries(refusals)){
    assert(r && typeof r==='object' && r.ok===false && typeof r.reason==='string' && r.reason.length>3,
      `A2 engine helper ${k} must return {ok:false, reason}, got ${JSON.stringify(r)}`);
  }

  /* 2. Disabled state when requirements unmet on Franchise desk */
  assert.equal($('[data-fr-merch="101"]').disabled,true,'[data-fr-merch] disabled when studio lacks cash');
  assert.equal($('[data-fr-park="101"]').disabled,true,'[data-fr-park] disabled when studio lacks cash');
  assert.equal($('[data-fr-toys="101"]').disabled,true,'[data-fr-toys] disabled when studio lacks cash');

  /* 3. Mid-render cash loss or forced trigger never plays gold/cash sound and toasts refusal */
  w.eval(`G.studio.cash=500; render(); G.studio.cash=0;`);
  clearBeeps(); clearToasts();
  $('[data-fr-merch="101"]').click();
  assert(!beeps().includes('gold') && !beeps().includes('cash'),'[data-fr-merch] refusal must never play gold/cash audio');
  assert.match(toastText(),/cash|need|\$/i,'[data-fr-merch] refusal toasts clear reason');

  w.eval(`G.studio.cash=500; render(); G.studio.cash=0;`);
  clearBeeps(); clearToasts();
  $('[data-fr-park="101"]').click();
  assert(!beeps().includes('gold') && !beeps().includes('cash'),'[data-fr-park] refusal must never play gold/cash audio');
  assert.match(toastText(),/cash|need|\$/i,'[data-fr-park] refusal toasts clear reason');

  w.eval(`G.studio.cash=500; render(); G.studio.cash=0;`);
  clearBeeps(); clearToasts();
  $('[data-fr-toys="101"]').click();
  assert(!beeps().includes('gold') && !beeps().includes('cash'),'[data-fr-toys] refusal must never play gold/cash audio');
  assert.match(toastText(),/cash|need|\$/i,'[data-fr-toys] refusal toasts clear reason');

  /* 4. empireModal() actions stay open, play zero gold/cash audio, and toast reason on refusal */
  for(const sel of ['#emCollab','#emDtv','#emPub','#emResort','[data-em-cross="102"]','[data-em-merge="102"]']){
    w.eval(`G.studio.cash=900; G.franchises[0].park=2; empireModal(101); G.studio.cash=0;`);
    assert($('.modal-veil'),'empireModal opened');
    const btn=$(sel);
    assert(btn,`empireModal control ${sel} exists`);
    clearBeeps(); clearToasts();
    btn.click();
    assert($('.modal-veil'),`refused ${sel} must NOT close empireModal`);
    assert(!beeps().includes('gold') && !beeps().includes('cash'),`refused ${sel} must NOT play gold/cash sound`);
    assert(toastText().length>3,`refused ${sel} toasts refusal reason`);
  }
  /* Also test #emLicFilm / #emLicGoods refusal when cooldown starts mid-modal */
  for(const sel of ['#emLicFilm','#emLicGoods']){
    w.eval(`G.franchises[0].licenseAt=0; G.franchises[0].merch=1; empireModal(101); G.franchises[0].licenseAt=G.week+20;`);
    const btn=$(sel);
    assert(btn,`empireModal control ${sel} exists`);
    clearBeeps(); clearToasts();
    btn.click();
    assert($('.modal-veil'),`refused ${sel} must NOT close empireModal`);
    assert(!beeps().includes('gold') && !beeps().includes('cash'),`refused ${sel} must NOT play gold/cash sound`);
    assert(toastText().length>3,`refused ${sel} toasts refusal reason`);
  }
  w.eval(`G.franchises[0].licenseAt=0; closeModal();`);

  /* 5. Eligible calls return {ok:true} and apply real side effects */
  w.eval(`G.studio.cash=2000; G.franchises[0].gameSold=0; G.franchises[0].park=2;`);
  assert.equal(w.eval('upgradeMerch(101).ok'),true,'upgradeMerch ok when funded');
  assert.equal(w.eval('buildPark(101).ok'),true,'buildPark ok when funded');
  assert.equal(w.eval('sellGameRights(101).ok'),true,'sellGameRights ok when tier unclaimed');
  assert.equal(w.eval('signToyLine(101).ok'),true,'signToyLine ok when funded');
  assert.equal(w.eval('brandCollab(101).ok'),true,'brandCollab ok when funded');
  assert.equal(w.eval('dtvSequel(101).ok'),true,'dtvSequel ok when funded');
  assert.equal(w.eval('launchPublishing(101).ok'),true,'launchPublishing ok when funded');
  assert.equal(w.eval('buildResort(101).ok'),true,'buildResort ok when park>=2 and funded');
  assert.equal(w.eval('crossoverEvent(101,102).ok'),true,'crossoverEvent ok when both tier>=3 and funded');
  assert.equal(w.eval('licenseOut(101,"goods").ok'),true,'licenseOut ok when rival exists');
  assert.equal(w.eval('mergeUniverse(101,102).ok'),true,'mergeUniverse ok when funded');
  console.log('PASS A2: 11 Empire helpers return {ok, reason}; zero false-success audio/flash/modal-close');

  /* ── A3 — game-rights button payout matches sellGameRights() cash credit ── */
  fresh('franchises');
  const gameCases=[
    {id:201,tier:1,ww:300},
    {id:202,tier:2,ww:2500},
    {id:203,tier:3,ww:750}
  ];
  for(const tc of gameCases){
    w.eval(`
      G.franchises=[{id:${tc.id},name:'Game IP ${tc.id}',tier:${tc.tier},entries:[],ww:${tc.ww},merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1}];
      render();
    `);
    const btn=$(`[data-fr-game="${tc.id}"]`);
    assert(btn,`[data-fr-game="${tc.id}"] rendered`);
    const expected=Math.round(20 + tc.tier*12 + Math.min(40, tc.ww/50));
    const expectedStr=w.fmtM(expected);
    assert(btn.textContent.includes(expectedStr),`button text "${btn.textContent}" must display exact payout ${expectedStr}`);
    const cashBefore=w.eval('G.studio.cash');
    btn.click();
    const cashAfter=w.eval('G.studio.cash');
    assert.equal(Math.round((cashAfter-cashBefore)*10)/10, expected, `credited cash delta must equal displayed payout ${expectedStr}`);
  }
  console.log('PASS A3: gameRightsPayout(fr) shared between button copy and sellGameRights()');

  /* ── A4 — Music label World Tour cost ($8M), +6% buzz, 8-wk chart, disabled state ── */
  fresh('divisions');
  w.eval(`
    G.studio.cash=200;
    unlockLabel();
    signArtist('nova');
    G.projects=[{id:901,title:'Broadway Neon',genre:'musical',phase:'prod',buzzBonus:0}];
    render();
  `);
  assert.equal(w.eval('DATA.LABEL_COSTS && DATA.LABEL_COSTS.tourCost'),8,'DATA.LABEL_COSTS.tourCost === 8');
  assert.equal(w.eval('DATA.LABEL_COSTS && DATA.LABEL_COSTS.tourBuzzBonus'),0.06,'DATA.LABEL_COSTS.tourBuzzBonus === 0.06');
  const tourBtn=$('[data-tour="nova"]');
  assert(tourBtn,'[data-tour="nova"] exists on Divisions');
  assert(!tourBtn.textContent.includes('$5M') && (tourBtn.textContent.includes('$8.0M') || tourBtn.textContent.includes('$8M')),
    `[data-tour] label "${tourBtn.textContent}" must state $8M / $8.0M, never $5M`);
  assert(!tourBtn.title.includes('$5M') && !tourBtn.title.includes('15%') && tourBtn.title.includes('6%'),
    `[data-tour] tooltip "${tourBtn.title}" must state +6% buzz, never $5M/+15%`);

  /* Disabled when cash < $8M, and mid-render cash loss refuses cleanly */
  w.eval(`G.studio.cash=4; render();`);
  assert.equal($('[data-tour="nova"]').disabled,true,'[data-tour] disabled when studio cash < $8M');
  w.eval(`G.studio.cash=50; render(); G.studio.cash=2;`);
  clearBeeps(); clearToasts();
  $('[data-tour="nova"]').click();
  assert(!beeps().includes('gold') && !beeps().includes('cash'),'[data-tour] refusal never plays gold/cash sound');
  assert.match(toastText(),/\$8|cash|tour/i,'[data-tour] refusal toasts clear reason');

  /* Funded tour charges $8M, credits variable gross, sets 8-wk chart, and adds +0.06 buzz */
  w.eval(`G.studio.cash=100; render();`);
  $('[data-tour="nova"]').click();
  assert.equal(Math.round(w.eval('G.projects[0].buzzBonus')*100)/100, 0.06, 'tourArtist adds +0.06 buzzBonus to musical');
  assert.equal(w.eval('G.label.artists[0].chartUntil === G.week + 8'), true, 'tourArtist grants 8-week chart window');
  console.log('PASS A4: World Tour button/tooltip/disabled state match tourArtist() ($8M, +6% buzz, 8-wk chart)');

  /* ── A5 — Podcast formatting ($500K not $500KM), wired launchPodcast(), 12-wk duration, G.streamer honesty ── */
  fresh('franchises');
  w.eval(`
    G.streamer=null;
    G.studio.cash=10;
    G.franchises=[{id:301,name:'Echo Files',tier:1,entries:[],ww:120,merch:0,park:0,gameSold:0,decay:1,genre:'thriller',earned:0,built:1}];
    render();
  `);
  assert.equal(w.eval('DATA.PODCAST.duration'),12,'DATA.PODCAST.duration matches 12-week tickPodcasts run');
  const podBtn=$('[data-fr-podcast="301"]');
  assert(podBtn,'[data-fr-podcast="301"] exists');
  assert(podBtn.textContent.includes(w.fmtM(0.5)) && !podBtn.textContent.includes('$0.5MM') && !podBtn.textContent.includes('$500KM'),
    `podcast label "${podBtn.textContent}" must render ${w.fmtM(0.5)} without duplicate M`);
  assert.match(podBtn.textContent+" "+(podBtn.title||"")+" "+viewText(),/12\s*wk|12-wk|12 week/i,'podcast states 12-week duration');
  assert.match(podBtn.textContent+" "+(podBtn.title||"")+" "+viewText(),/streamer/i,'podcast honestly states G.streamer requirement for sub conversion');

  /* Disabled when cash < $0.5M; mid-render cash loss refuses via launchPodcast().err */
  w.eval(`G.studio.cash=0.1; render();`);
  assert.equal($('[data-fr-podcast="301"]').disabled,true,'[data-fr-podcast] disabled when cash < $0.5M');
  w.eval(`G.studio.cash=5; render(); G.studio.cash=0.1;`);
  clearBeeps(); clearToasts();
  $('[data-fr-podcast="301"]').click();
  assert(!beeps().includes('gold') && !beeps().includes('cash'),'[data-fr-podcast] refusal must not play gold/cash');
  assert.match(toastText(),/fund|cash|\$0\.5M/i,'[data-fr-podcast] refusal toasts launchPodcast error');

  /* Clicking funded button calls real launchPodcast(), ticks 12 weeks, converts subs iff G.streamer exists */
  w.eval(`G.studio.cash=5; G.streamer={name:'EchoPlus',subs:2.0,peak:2.0,churn:0.01,income:0,totalRev:0,lastContent:G.week}; render();`);
  const repBeforePod=w.eval('G.studio.rep');
  $('[data-fr-podcast="301"]').click();
  assert.equal(w.eval('G.franchises[0].podcast'),true,'clicking [data-fr-podcast] sets fr.podcast via launchPodcast()');
  assert.equal(w.eval('G.franchises[0].podcastWeeks'),0,'launchPodcast initialises podcastWeeks = 0');
  assert.equal(w.eval('G.studio.rep'),Math.min(99,repBeforePod+1),'launchPodcast grants +1 rep');
  w.eval(`for(let i=0;i<12;i++) tickPodcasts();`);
  assert.equal(w.eval('G.franchises[0].podcastDone'),true,'podcast completes after 12 ticks');
  assert.equal(w.eval('G.streamer.subs'),8.0,'12 podcast weeks add +6.0M subs when G.streamer is active');
  console.log('PASS A5: Podcast $500K formatting, wired launchPodcast(), 12-wk run, honest streamer sub conversion');

  /* ── A6 — franchiseOffers(fr) persisted; card == modal == sellFranchise() across renders & save/load ── */
  fresh('franchises');
  w.eval(`
    G.franchises=[{id:401,name:'Iron Horizon',tier:2,entries:[{filmId:1,title:'Iron Horizon',ww:420,week:1}],ww:420,merch:2,park:1,gameSold:0,decay:1,genre:'action',earned:55,built:1}];
    render();
  `);
  const sellBtn1=$('[data-fr-sell="401"]').textContent;
  assert(!/from\s+\$/i.test(sellBtn1),`[data-fr-sell] "${sellBtn1}" must not mislabel highest offer as "from $X"`);
  w.eval('render(); render();');
  const sellBtn2=$('[data-fr-sell="401"]').textContent;
  assert.equal(sellBtn1,sellBtn2,'[data-fr-sell] offer label stays stable across repeated render() calls');

  /* Survives save/load round-trip and matches franchiseSaleModal() + sellFranchise() */
  const cachedTop=w.eval('franchiseOffers(G.franchises[0])[0].value');
  w.eval('saveGame(); loadGame(); render();');
  assert.equal(w.eval('franchiseOffers(G.franchises[0])[0].value'),cachedTop,'top offer persists across saveGame/loadGame');
  assert($('[data-fr-sell="401"]').textContent.includes(w.fmtM(cachedTop)),'card button shows persisted top offer');

  $('[data-fr-sell="401"]').click();
  assert($('.modal-veil'),'franchiseSaleModal opened');
  const modalTopText=$('.modal-veil .modal-offer-val').textContent;
  assert.equal(modalTopText,w.fmtM(cachedTop),'modal top offer matches card top offer');
  const cashBeforeSell=w.eval('G.studio.cash');
  const repBeforeSell=w.eval('G.studio.rep');
  $('[data-froff="0"]').click();
  assert.equal(Math.round((w.eval('G.studio.cash')-cashBeforeSell)*10)/10,cachedTop,'sellFranchise credits exact modal/card offer');
  assert.equal(w.eval('G.studio.rep'),Math.max(5,repBeforeSell-2),'sellFranchise applies -2 rep penalty');
  assert.equal(w.eval('G.franchises.length'),0,'sold franchise removed from G.franchises');
  console.log('PASS A6: franchiseOffers(fr) persisted across renders & save/load; card == modal == sellFranchise()');

  /* ── A7 — Paid divisions (publishing, comics, store) pay weekly in tickEmpire(); resort honestly labelled +5 rep / $0/wk ── */
  fresh('divisions');
  w.eval(`
    G.studio.cash=1000;
    G.franchises=[{id:501,name:'Atlas Lore',tier:2,entries:[{filmId:1,title:'Atlas Lore',ww:350,week:1}],ww:350,merch:2,park:1,gameSold:0,decay:1,genre:'fantasy',earned:0,built:1}];
    launchPublishing(501);
    releaseComic(501);
    buildStore();
    G.weekTx={};
    render();
  `);
  const breakdownBeforeTick=w.eval('typeof empireWeeklyBreakdown==="function" ? empireWeeklyBreakdown() : null');
  assert(breakdownBeforeTick && breakdownBeforeTick.publishing>0 && breakdownBeforeTick.comics>0 && breakdownBeforeTick.store>0,
    'empireWeeklyBreakdown() reports non-zero publishing, comics, and store weekly income');
  assert(!/multiplier/i.test(viewText()),'divisions panel drops unimplemented store multiplier claim');

  const cashPreTick=w.eval('G.studio.cash');
  w.eval('tickEmpire();');
  const cashPostTick=w.eval('G.studio.cash');
  const actualEmpireCredit=Math.round((cashPostTick-cashPreTick)*10)/10;
  assert.equal(actualEmpireCredit, breakdownBeforeTick.total,
    `tickEmpire() cash delta (${actualEmpireCredit}) must equal displayed empireWeeklyBreakdown().total (${breakdownBeforeTick.total}) with zero double payment`);
  assert.equal(w.eval('G.weekTx.empire'), breakdownBeforeTick.total,
    'G.weekTx.empire equals empireWeeklyBreakdown().total');

  /* Resort ($400M) explicitly states +5 rep prestige landmark and $0/wk */
  w.eval('empireModal(501);');
  const resortBtn=$('#emResort');
  assert(resortBtn,'#emResort exists when park>=1');
  assert.match(resortBtn.textContent+" "+(resortBtn.title||""),/\+5\s*rep/i,'#emResort states +5 rep');
  assert.match(resortBtn.textContent+" "+(resortBtn.title||""),/\$0\/wk|prestige/i,'#emResort states $0/wk prestige landmark');
  w.eval('closeModal();');
  console.log('PASS A7: publishing, comics, and store pay weekly in tickEmpire() matching displayed total; resort labelled +5 rep / $0/wk');

  /* ── A8 — Franchise heat unified across card, timeline, sequel advice, empireModal(), and frHeatMult() ── */
  fresh('franchises');
  for(const [decay,expectedPct,expectedMult] of [[1,100,1.18],[0.6,60,1.04],[0.25,25,0.91]]){
    w.eval(`
      G.films=[{id:601,title:'Heat Probe',ww:300,opening:85,profit:110,quality:{critic:78,overall:78}}];
      G.franchises=[{id:601,name:'Heat Probe',tier:2,entries:[{filmId:601,title:'Heat Probe',ww:300,week:1}],ww:300,merch:0,park:0,gameSold:0,decay:${decay},genre:'action',earned:0,built:1,fatigue:0}];
      render();
    `);
    assert.equal(w.eval('typeof frHeatPct==="function" ? frHeatPct(G.franchises[0]) : -1'), expectedPct, `frHeatPct(${decay}) === ${expectedPct}`);
    assert.equal(Math.round(w.eval('frHeatMult({franchiseName:"Heat Probe"})')*100)/100, expectedMult, `frHeatMult(${decay}) === ${expectedMult}`);
    assert(viewText().includes(`heat ${expectedPct}%`) || viewText().includes(`Heat${expectedPct}%`), `card/timeline shows ${expectedPct}% heat for decay=${decay}`);
    w.eval('empireModal(601);');
    const modalTxt=$('.modal-veil').textContent;
    assert(modalTxt.includes(`heat ${expectedPct}%`), `empireModal text "${modalTxt}" must show heat ${expectedPct}% (never inverted ${100-expectedPct}%)`);
    w.eval('closeModal();');
  }
  console.log('PASS A8: franchise heat unified across card, timeline, sequel advice, empireModal(), and frHeatMult()');

  /* ── A9 — Franchise timeline resolves G.films via filmId and degrades cleanly when absent ── */
  fresh('franchises');
  w.eval(`
    G.films=[{id:701,title:'Starfall',ww:380,opening:92,profit:145,criticAvg:84,quality:{critic:84,overall:82}}];
    /* Old save shape: upsertFranchise wrote only filmId, title, ww, week */
    G.franchises=[{id:701,name:'Starfall',tier:1,entries:[{filmId:701,title:'Starfall',ww:380,week:14}],ww:380,merch:0,park:0,gameSold:0,decay:1,genre:'scifi',earned:0,built:14}];
    render();
  `);
  const tlResolved=viewText();
  assert(tlResolved.includes('$92.0M open'),'timeline resolves opening gross ($92.0M) from G.films by filmId');
  assert(tlResolved.includes('84% critics'),'timeline resolves critic score (84%) from G.films by filmId');
  assert(tlResolved.includes('+$145.0M'),'timeline resolves profit (+$145.0M) from G.films by filmId');

  /* Absent/pruned G.films record degrades cleanly without "$0.0M open", "?% critics", or "+$0.0M" */
  w.eval(`
    G.films=[];
    G.franchises=[{id:702,name:'Lost Reel',tier:1,entries:[{filmId:999,title:'Lost Reel',ww:210,week:8}],ww:210,merch:0,park:0,gameSold:0,decay:1,genre:'drama',earned:0,built:8}];
    render();
  `);
  const tlPruned=viewText();
  assert(tlPruned.includes('Lost Reel') && tlPruned.includes(w.fmtG(210)+' WW'),'pruned film still shows title and WW gross');
  assert(!tlPruned.includes('$0.0M open') && !tlPruned.includes('$0 open') && !tlPruned.includes('?% critics') && !tlPruned.includes('Profit: +$0'),
    `pruned film must omit missing stats instead of fabricating zeros/question marks: "${tlPruned}"`);

  /* Purchased/custom franchise with entries: [] stays safe */
  w.eval(`
    G.franchises=[{id:'cust_703',name:'Blank Slate IP',tier:1,entries:[],ww:0,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1,custom:true}];
    render();
  `);
  assert.match(viewText(),/No films yet|first entry/i,'custom/purchased franchise with entries:[] renders safely');
  console.log('PASS A9: frTimeline() resolves G.films via filmId and degrades cleanly when absent');

  /* ── A10 — Music label removes fabricated #Top50 & scandal risk; shares labelArtistWeeklyIncome(); verifies $0.3M/wk overhead ── */
  fresh('divisions');
  const ovhBeforeLabel=w.eval('weeklyOverhead()');
  w.eval(`
    G.studio.cash=200;
    unlockLabel();
    signArtist('nova');
    G.label.artists[0].chartUntil = G.week + 5;
    render();
  `);
  const ovhAfterLabel=w.eval('weeklyOverhead()');
  assert.equal(Math.round((ovhAfterLabel-ovhBeforeLabel)*100)/100, 0.3, 'weeklyOverhead() charges exact +$0.3M/wk when music label unlocked');
  const divTxt=viewText();
  assert(!/TOP 50/i.test(divTxt) && !/#\d+\s+ON/i.test(divTxt), `Music label must not fabricate chart rank: "${divTxt}"`);
  assert(!/scandal risk/i.test(divTxt), `Music label must not fabricate artist scandal risk: "${divTxt}"`);
  assert.match(divTxt,/5\s*wk/i,'Charting artist displays real remaining chart weeks (5 wks)');

  /* Displayed per-artist $/wk equals labelArtistWeeklyIncome() and tickLabel() credit */
  const expectedArtWk=w.eval('typeof labelArtistWeeklyIncome==="function" ? labelArtistWeeklyIncome(G.label.artists[0]) : -1');
  assert(expectedArtWk > 0, 'labelArtistWeeklyIncome() exists and returns > 0');
  assert(divTxt.includes('+'+w.fmtM(expectedArtWk)+'/wk'), 'Music label displays exact labelArtistWeeklyIncome()');
  const cashPreLabel=w.eval('G.studio.cash');
  w.eval('G.weekTx={}; tickLabel();');
  assert.equal(Math.round((w.eval('G.studio.cash')-cashPreLabel)*10)/10, expectedArtWk, 'tickLabel() credits exact labelArtistWeeklyIncome()');
  console.log('PASS A10: fabricated chart rank & scandal risk removed; labelArtistWeeklyIncome() shared; $0.3M/wk overhead verified');

  /* ── A11 — valuation, rest & park honesty, universe bonus, UNIPICKS persistence,
        TV spin-off contract, merch/merch-licensing/fan-conventions/IP-market fixes ── */

  /* frValue() must equal catalogValue()'s franchise valuation exactly */
  w.eval(`
    G.films=[]; G.maLibraries=0;
    G.franchises=[{id:888,name:'Park Probe',tier:2,entries:[{filmId:888,title:'Park Probe',ww:120,week:10}],ww:120,merch:1,park:1,gameSold:0,decay:1,genre:'action',earned:0,built:10,fatigue:0.14,toys:true}];
    G.week=20; render();
  `);
  assert.equal(w.eval('frValue(G.franchises[0])'),85,'frValue() = tier*15 + merch*10 + park*45 with no toys ghost value (2*15+1*10+1*45 = 85)');
  assert.equal(w.eval('catalogValue()'),85,'frValue() matches catalogValue() franchise valuation exactly');
  w.eval(`G.franchises=[{id:889,name:'Val Probe',tier:3,entries:[],ww:0,merch:2,park:1,gameSold:0,decay:1,genre:'action',earned:0,built:1}]; render();`);
  assert.equal(w.eval('frValue(G.franchises[0])'),110,'frValue() weights unify for tier 3 / merch 2 / park 1 (110)');

  /* Fake park attendance % replaced by real park level + real park income */
  w.eval(`
    G.films=[]; G.week=20;
    G.franchises=[{id:888,name:'Park Probe',tier:2,entries:[{filmId:888,title:'Park Probe',ww:120,week:10}],ww:120,merch:1,park:1,gameSold:0,decay:1,genre:'action',earned:0,built:10,fatigue:0.14,toys:true}];
    G.empire.subTab='franchises'; G.empire.activeSub='franchises';
    render();
  `);
  assert(!viewText().includes('Attendance'),`fake Park Attendance % must be gone: "${viewText()}"`);
  assert(/Park/.test(viewText()),'real park data still shown on the card');

  /* Rest countdown derives from tickFatigue() (26-wk gap + 0.004/wk recovery), not fatigue*26 */
  assert.equal(w.eval('typeof frRestPlan'),'function','frRestPlan(fr) exists in the engine layer');
  assert.equal(w.eval('frRestPlan(G.franchises[0]).totalWks'),51,'rest countdown = 17 wks until first recovery tick + 34 more 0.004 heals (51 wks)');
  assert(viewText().includes('51 wks to heal'),`card rest countdown must come from tickFatigue() rule: "${viewText()}"`);

  /* G.universeBonus (+15%) actually applies to franchise income and is shown */
  w.eval('G.universeBonus=0.15; render();');
  const incWithBonus=w.eval('frWeeklyIncome(G.franchises[0])');
  assert(viewText().includes('+15% universe'),'card shows the +15% universe bonus');
  w.eval('G.universeBonus=0;');
  const incNoBonus=w.eval('frWeeklyIncome(G.franchises[0])');
  assert(incNoBonus>0 && Math.abs(incWithBonus - incNoBonus*1.15)<0.01,'frWeeklyIncome() applies G.universeBonus +15% to real weekly income');
  w.eval('G.universeBonus=0.15; empireModal(888);');
  assert($('.modal-veil').textContent.includes('+15%'),'empireModal() shows the active +15% universe bonus');
  w.eval('closeModal(); G.universeBonus=0;');

  /* UNIPICKS persist across renders & save/load, prune dead ids, gate #uniGo (≥2 picks + $30M) */
  fresh('universes');
  w.eval(`
    G.studio.cash=200;
    G.franchises=[
      {id:901,name:'Uni Alpha',tier:2,entries:[],ww:100,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1},
      {id:902,name:'Uni Beta',tier:2,entries:[],ww:100,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1},
      {id:'cust_903',name:'Uni Gamma',tier:2,entries:[],ww:100,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1,custom:true}
    ];
    render();
  `);
  $('[data-unipick="901"]').click();
  $('[data-unipick="cust_903"]').click();
  w.eval('render();');
  assert.equal($('#uniPicks').textContent,'Uni Alpha × Uni Gamma','picked franchises render after re-render (persisted, string ids safe)');
  w.eval('saveGame(); loadGame(); render();');
  assert.equal($('#uniPicks').textContent,'Uni Alpha × Uni Gamma','picked franchises survive saveGame/loadGame');
  assert.equal(w.eval("document.querySelector('[data-unipick=\"901\"]').classList.contains('btn-primary')"),true,'picked chip renders active after reload');
  w.eval('G.franchises=G.franchises.filter(f=>f.id!==901); render();');
  assert.equal($('#uniPicks').textContent,'Uni Gamma','stale picks prune when the franchise leaves the roster');
  $('[data-unipick="902"]').click();
  w.eval('G.studio.cash=25; render();');
  assert.equal(w.eval("document.querySelector('#uniGo').disabled"),true,'#uniGo disabled below the $30M gate even with 2 picks');
  w.eval('G.studio.cash=35; render();');
  assert.equal(w.eval("document.querySelector('#uniGo').disabled"),false,'#uniGo enabled at 2 picks + $30M cash');
  w.eval('G.studio.cash=25; render();');
  assert.equal(w.eval("document.querySelector('#uniGo').disabled"),true,'#uniGo disabled again when cash drops under $30M');
  w.eval('G.studio.cash=200; render();');
  $('#uniGo').click();
  assert.equal(w.eval('G.universes.length'),1,'weaving a universe from picks works with custom string franchise ids');
  assert(w.eval("G.universes[0].frIds.includes('cust_903') && G.universes[0].frIds.includes(902)"),'universe frIds preserve numeric and string ids');

  /* cinematic-universe.js output stays schema-compatible with uniStats()/uniOf() */
  w.eval(`
    G.studio.cash=200; G.universes=[];
    G.franchises=[
      {id:911,name:'CU Core',tier:1,entries:[],ww:0,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1},
      {id:'cust_912',name:'CU Branch',tier:1,entries:[],ww:0,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1}
    ];
  `);
  const cu=JSON.parse(w.eval('JSON.stringify(createUniverse("Probe Universe", 911))'));
  assert(cu.ok,'cinematic-universe createUniverse() succeeds');
  assert.deepEqual(JSON.parse(w.eval('JSON.stringify(G.universes[0].frIds||null)')),[911],'created universe carries frIds for uniStats()');
  assert.equal(JSON.parse(w.eval('(function(){try{return JSON.stringify({ok:true,n:uniStats(G.universes[0]).frs.length})}catch(e){return JSON.stringify({ok:false,err:String(e)})}})()')).ok,true,'uniStats() reads createUniverse() output without throwing');
  const cu2=JSON.parse(w.eval('JSON.stringify(addSubFranchiseToUniverse(G.universes[0].id, "cust_912"))'));
  assert(cu2.ok,'addSubFranchiseToUniverse() accepts custom string franchise ids');
  assert.equal(w.eval('uniStats(G.universes[0]).frs.length'),2,'uniStats() sees both franchises after schema-safe join');

  /* franchiseTvSpinoff returns {ok, reason} and tags the series with spinFr */
  w.eval(`
    window.__realChance=chance; chance=()=>true;
    G.studio.cash=200; G.series=[]; G.universes=[];
    G.franchises=[
      {id:921,name:'TV Probe',tier:2,entries:[],ww:100,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1},
      {id:'cust_922',name:'Tier One',tier:1,entries:[],ww:50,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1}
    ];
  `);
  const tv=JSON.parse(w.eval("JSON.stringify(franchiseTvSpinoff('921')||{ok:null})"));
  assert(tv.ok,'franchiseTvSpinoff() returns {ok:true} on pickup');
  assert.equal(w.eval('G.series[0].spinFr'),921,'created series carries spinFr = franchise id');
  const tvRefuse=JSON.parse(w.eval("JSON.stringify(franchiseTvSpinoff('cust_922')||{ok:null})"));
  assert(!tvRefuse.ok && typeof tvRefuse.reason==='string' && tvRefuse.reason.length>3,'tier-1 refusal carries a reason');
  const tvMissing=JSON.parse(w.eval("JSON.stringify(franchiseTvSpinoff('nope')||{ok:null})"));
  assert(!tvMissing.ok && /not found/i.test(tvMissing.reason),'missing franchise refusal carries a reason');
  /* failure path must not false-success (no gold beep, reason toasted) */
  w.eval("chance=()=>false; closeModal(); G.empire.subTab='franchises'; G.empire.activeSub='franchises'; render();");
  clearBeeps();
  $('[data-fr-tv="921"]').click();
  assert(!beeps().includes('gold'),'failed TV pitch must not play gold success audio');
  assert(toastText().length>0 || /passed|whiteboard/i.test(w.eval('G.logText||document.body.textContent')),'failed TV pitch surfaces the refusal');
  w.eval('chance=window.__realChance;');

  /* merchBoard lists films at merchEligible()'s $40M WW threshold */
  w.eval(`
    G.films=[
      {id:931,title:'Shelf Flop',ww:20,budget:20,quality:{critic:60,overall:60}},
      {id:932,title:'Shelf Hit',ww:40,budget:20,quality:{critic:60,overall:60}}
    ];
    G.franchises=[]; render();
  `);
  const mb=w.eval('merchBoard()');
  assert(mb.includes('Shelf Hit'),'merchBoard lists films at ww >= 40 (merchEligible threshold)');
  assert(!mb.includes('Shelf Flop'),'merchBoard no longer lists films under the $40M WW threshold');

  /* merch-licensing.js resolves films by String(f.id) and reads f.ww gross */
  w.eval(`
    G.films=[{id:941,title:'WW Wonder',ww:120,budget:40,quality:{critic:70,overall:70}}];
    G.merchandise={activeDeals:[],dealHistory:[],totalRoyaltyEarned:0};
  `);
  const ml=JSON.parse(w.eval("JSON.stringify(MerchLicensing.signMerchLicensingDeal('941','toys_action_figures'))"));
  assert(ml.ok,`merch-licensing deal must accept string film ids and ww gross: ${ml.msg||''}`);
  assert.equal(w.eval('G.merchandise.activeDeals.length'),1,'licensing deal recorded on the ww-only film');
  w.eval('openMerchLicensingModal();');
  assert($('.modal-veil').textContent.includes('WW Wonder'),'merch-licensing modal eligibility reads f.ww');
  w.eval('closeModal();');

  /* fan-conventions.js disables host buttons when cash cannot cover the scale */
  w.eval(`
    if(!G.fanClub) G.fanClub={totalFans:0,weeklyBudget:0,conventionHistory:[],lastConventionWeek:null};
    G.fanClub.lastConventionWeek=null; G.studio.cash=1;
    openFanClubModal();
  `);
  const broke=JSON.parse(w.eval("JSON.stringify([...document.querySelectorAll('[data-hostcon]')].map(b=>b.disabled))"));
  assert(broke.length>0 && broke.every(d=>d),'all [data-hostcon] buttons disabled when cash is under the cheapest expo');
  w.eval('closeModal(); G.studio.cash=500; openFanClubModal();');
  const rich=JSON.parse(w.eval("JSON.stringify([...document.querySelectorAll('[data-hostcon]')].map(b=>b.disabled))"));
  assert(rich.some(d=>!d),'host buttons enable again once cash covers the scale');
  w.eval('closeModal();');

  /* buyIp returns {ok, reason} with string-safe ids; custom listings price $15M–$45M */
  w.eval(`
    G.ipMarket=[{id:951,kind:'legacy',genre:'action',title:'Legacy Lot',price:20,boost:6,buzz:0.1,born:1}];
    G.studio.cash=10;
  `);
  const poorBuy=JSON.parse(w.eval("JSON.stringify(buyIp('951')||{ok:null})"));
  assert(!poorBuy.ok && typeof poorBuy.reason==='string','buyIp refusal returns {ok:false, reason}');
  w.eval('G.studio.cash=300;');
  const buy=JSON.parse(w.eval("JSON.stringify(buyIp('951')||{ok:null})"));
  assert(buy.ok,'buyIp succeeds with a string listing id');
  assert.equal(w.eval('G.franchises.some(f=>f.name==="Legacy Lot")'),true,'purchased legacy IP lands in the franchise stable');
  const missBuy=JSON.parse(w.eval("JSON.stringify(buyIp('zzz')||{ok:null})"));
  assert(!missBuy.ok && typeof missBuy.reason==='string','buyIp missing listing returns {ok:false, reason}');

  w.eval(`
    G.ipMarket=[]; G.studio.cash=500;
    createCustomFranchise('Solo One','action','');
    createCustomFranchise('Solo Two','drama','');
  `);
  assert.equal(w.eval("G.ipMarket.filter(i=>i.kind==='custom').length"),2,'multiple custom franchises can be listed at once');
  w.eval(`
    G.ipMarket=[]; G.week=20;
    G.custom={studios:[],people:[],franchises:[{id:'cust_961',name:'Custom One',genre:'action',desc:'',created:1,films:0,value:0}]};
    window.__realChance2=chance; chance=()=>true;
    refreshIpMarket(true);
    chance=window.__realChance2;
  `);
  const customPrices=JSON.parse(w.eval("JSON.stringify(G.ipMarket.filter(i=>i.custom||i.kind==='custom').map(i=>i.price))"));
  assert(customPrices.length>0,'refreshIpMarket lists custom franchises');
  assert(customPrices.every(p=>p>=15&&p<=45),`custom IP listings price in the $15M–$45M band (never $0): got ${JSON.stringify(customPrices)}`);
  console.log('PASS A11: unified valuation, tickFatigue-derived rest, honest park data, +15% universe bonus, persisted UNIPICKS, spinFr tagging, $40M merch gate, licensing/fan-con/IP-market contract fixes');

  /* ═══ PART B — EMPIRE DESK command shell ═══ */
  const allSubs=['home','franchises','universes','divisions','endgame'];
  for(const sub of allSubs){
    fresh(sub);
    assert($('#view .command-empire'),`${sub}: .command-empire shell missing`);
    assert.equal($$('#view .command-empire > .produce-panel').length,1,`${sub}: exactly one active panel`);
    assert(/EMPIRE DESK \/ YEAR \d+/.test(viewText()),`${sub}: EMPIRE DESK / YEAR n eyebrow`);
    assert(viewText().includes('The empire command desk.'),`${sub}: command heading`);
    const subLine=$('#view .command-heading p').textContent.toLowerCase();
    for(const word of ['franchises','universes','divisions','endgame crown'])
      assert(subLine.includes(word),`${sub}: subtitle names ${word}`);
    assert.equal($$('#view .command-telemetry .command-metric').length,4,`${sub}: four telemetry metrics`);
    const head=$('#view .command-heading'), nav=$('#view .command-empire-nav'),
      tel=$('#view .command-telemetry'), panel=$('#view .command-empire > .produce-panel');
    const after=(a,b)=>Boolean(a.compareDocumentPosition(b)&w.Node.DOCUMENT_POSITION_FOLLOWING);
    assert(head&&nav&&tel&&panel,`${sub}: shell parts render`);
    assert(after(head,nav)&&after(nav,tel)&&after(tel,panel),`${sub}: order is header → nav → telemetry → panel`);
    for(const c of $$('#view .command-heading, #view .command-empire-nav, #view .command-telemetry, #view .produce-panel-head')){
      assert(!c.matches('.card,.section-title,.cost-line,.stat-hero,.fr-meter'),`${sub}: chrome element carries no legacy class`);
      assert(!c.querySelector('.card,.section-title,.cost-line,.stat-hero,.fr-meter'),`${sub}: chrome interior free of legacy classes`);
    }
  }
  console.log('PASS B1: EMPIRE DESK shell — heading, subtitle, 5-chip nav, four telemetry metrics, header → nav → telemetry → panel');

  /* Telemetry reads real state and never invents a second income formula */
  fresh('franchises');
  w.eval(`
    G.studio.cash=600;
    G.films=[{id:1201,title:'Shelf Titan',ww:220,budget:80,profit:60,criticAvg:80,quality:{critic:80,overall:78},releaseWeek:1}];
    G.franchises=[
      {id:1201,name:'Titan Verse',tier:3,entries:[{filmId:1201,title:'Shelf Titan',ww:220,week:1,opening:70,criticAvg:80,profit:60}],ww:220,merch:1,park:1,gameSold:0,decay:1,genre:'action',earned:12.5,built:1,fatigue:0.2},
      {id:1202,name:'Titan Ally',tier:3,entries:[{filmId:1202,title:'Ally One',ww:180,week:2}],ww:180,merch:1,park:0,gameSold:0,decay:1,genre:'action',earned:4,built:2,fatigue:0}
    ];
    render();
  `);
  const metric=n=>$('#view .command-telemetry .command-metric:nth-child('+(n+1)+')');
  assert.equal(metric(0).querySelector('strong').textContent,'2','telemetry counts owned franchises');
  assert(metric(0).querySelector('small').textContent.includes('tier 2+'),'owned metric names the tier-2+ count');
  const telIncome=metric(1).querySelector('strong').textContent;
  assert.equal(telIncome,'+'+w.fmtM(w.eval('empireWeeklyBreakdown().total')),'telemetry income equals empireWeeklyBreakdown().total');
  assert(metric(1).querySelector('small').textContent.includes('tickEmpire()'),'income metric states the weekly settlement source');
  assert.equal(metric(2).querySelector('strong').textContent,w.fmtM(16.5),'franchise earnings metric is sum(fr.earned)');
  assert(metric(2).querySelector('span').textContent.includes('FRANCHISE EARNINGS'),'earnings metric labelled franchise earnings');
  assert(metric(2).querySelector('small').textContent.includes('Lifetime'),'earnings metric honestly labelled as lifetime');
  assert(!/empire earnings/i.test(metric(2).textContent),'old dishonest Empire-earnings label is gone');
  assert.equal(metric(3).querySelector('strong').textContent,w.fmtG(400),'WW metric is the real franchise WW sum');
  const cashPre=w.eval('G.studio.cash');
  w.eval('G.weekTx={}; tickEmpire();');
  assert.equal(Math.round((w.eval('G.studio.cash')-cashPre)*10)/10, w.eval('empireWeeklyBreakdown()').total,
    'displayed empire income/wk equals the actual tickEmpire() credit');
  console.log('PASS B2: telemetry metrics read live state — owned + tier-2 count, tickEmpire income, lifetime franchise earnings, WW gross');

  /* Panel heads carry the modal openers; chrome wiring survives */
  for(const [sub,sel] of [['home','#btnOpenFanClub'],['universes','#btnOpenUniverses'],['divisions','#btnOpenMerch']]){
    fresh(sub);
    const btn=$('#view .produce-panel-head '+sel);
    assert(btn,`${sub}: ${sel} lives in the panel head`);
    assert.equal(typeof btn.onclick,'function',`${sub}: ${sel} is wired`);
  }
  fresh('franchises');
  assert($('#view .produce-panel-head #btnOpenFanClub'),'franchises head carries Fan Conventions opener');
  console.log('PASS B3: #btnOpenUniverses / #btnOpenMerch / #btnOpenFanClub sit in panel heads and stay wired');

  /* Kairo banner stays off the Empire desk */
  w.eval(`
    window.__kairoCalls=0;
    window.__kairoOrig=KairoTheme.renderBanner;
    KairoTheme.renderBanner=function(){ window.__kairoCalls++; return window.__kairoOrig.apply(this,arguments); };
  `);
  for(const sub of allSubs) w.eval(`G.empire.subTab='${sub}';G.empire.activeSub='${sub}';render();`);
  assert.equal(w.eval('window.__kairoCalls'),0,'empire renders no Kairo banner on any sub-tab');
  /* v38.0: finance became a command desk too, so it is now excluded as well —
     every section renders its own command-heading and a Kairo banner above it
     would double the header. Assert the exclusion is complete, and check the
     banner function itself still works for any surface that calls it directly. */
  w.eval(`TAB='finance'; render();`);
  assert.equal(w.eval('window.__kairoCalls'),0,'finance is excluded from the Kairo banner like every other desk');
  assert.equal($('#view .kairo-dept-banner'),null,'no Kairo banner node above the Treasury Desk');
  assert(w.eval(`KairoTheme.renderBanner('finance').length`)>0,'renderBanner("finance") still returns markup for direct callers');
  /* and the banner it returns no longer carries the pre-v38 fabrications */
  w.eval(`G.studio.cash=3; G.studio.debt=900; G.studio.rep=8;`);
  const ban=w.eval(`KairoTheme.renderBanner('finance')`);
  assert(!/AAA Investment/.test(ban),'the finance banner no longer hardcodes an AAA grade');
  assert(!/34\.8/.test(ban),'the finance banner no longer hardcodes a 34.8% margin');
  w.eval(`KairoTheme.renderBanner=window.__kairoOrig; TAB='empire'; G.empire.subTab='franchises'; G.empire.activeSub='franchises'; render();`);
  console.log('PASS B4: every desk is excluded from the Kairo banner, and the finance banner reports live figures');

  /* Every preserved selector survives the shell rebuild */
  fresh('franchises');
  w.eval(`
    G.studio.cash=600;
    G.films=[{id:1201,title:'Shelf Titan',ww:220,budget:80,profit:60,criticAvg:80,quality:{critic:80,overall:78},releaseWeek:1}];
    G.franchises=[
      {id:1201,name:'Titan Verse',tier:3,entries:[{filmId:1201,title:'Shelf Titan',ww:220,week:1,opening:70,criticAvg:80,profit:60}],ww:220,merch:1,park:1,gameSold:0,decay:1,genre:'action',earned:12.5,built:1,fatigue:0.2},
      {id:1202,name:'Titan Ally',tier:3,entries:[{filmId:1202,title:'Ally One',ww:180,week:2}],ww:180,merch:1,park:0,gameSold:0,decay:1,genre:'action',earned:4,built:2,fatigue:0}
    ];
    render();
  `);
  const need=['[data-fr-seq]','[data-fr-spin]','[data-fr-tv]','[data-fr-merch]','[data-fr-park]','[data-fr-game]','[data-fr-toys]','[data-fr-reboot]','[data-fr-podcast]','[data-fr-sell]','[data-fr-more]'];
  for(const sel of need) assert($('#view '+sel),`preserved selector missing on franchise cards: ${sel}`);
  w.eval(`G.empire.subTab='divisions';G.empire.activeSub='divisions';render();`);
  assert($('#view [data-merchline]'),'preserved selector missing: [data-merchline]');
  assert($('#view [data-label]'),'preserved selector missing: [data-label] (launch label)');
  w.eval('unlockLabel(); signArtist("nova"); render();');
  for(const sel of ['[data-sign]','[data-tour]','[data-dropartist]']) assert($('#view '+sel),`preserved selector missing: ${sel}`);
  w.eval(`G.empire.subTab='universes';G.empire.activeSub='universes';render();`);
  assert($('#view [data-unipick]'),'preserved selector missing: [data-unipick]');
  assert($('#view #uniGo'),'preserved selector missing: #uniGo');
  for(const [sub,sel] of [['home','#btnOpenFanClub'],['universes','#btnOpenUniverses'],['divisions','#btnOpenMerch'],['franchises','#btnOpenFanClub']]){
    w.eval(`G.empire.subTab='${sub}';G.empire.activeSub='${sub}';render();`);
    assert(typeof $(sel).onclick==='function',`preserved id stays wired: ${sel} on ${sub}`);
  }
  w.eval('empireModal(1201);');
  for(const id of ['#emCollab','#emDtv','#emPub','#emResort','#emLicFilm','#emLicGoods'])
    assert($('.modal-veil '+id),`preserved selector missing in empireModal(): ${id}`);
  assert($('.modal-veil [data-em-cross]'),'preserved selector missing in empireModal(): [data-em-cross]');
  assert($('.modal-veil [data-em-merge]'),'preserved selector missing in empireModal(): [data-em-merge]');
  w.eval('closeModal(); G.empire.subTab="franchises"; G.empire.activeSub="franchises"; render();');
  $('[data-fr-sell]').click();
  assert($('.modal-veil [data-froff]'),'preserved selector missing in franchiseSaleModal(): [data-froff]');
  w.eval('closeModal();');
  console.log('PASS B5: every preserved selector survives the command-desk shell');

  /* Scoped CSS discipline */
  const css=fs.readFileSync('command-deck.css','utf8');
  const afterEmpire=css.split('EMPIRE DESK — shell chrome')[1]||'';
  /* Bound the empire block at the next major ═══ section divider so later
     desks (e.g. the v37 Game Studio desk appended below) aren't swept in. */
  const nextSection=afterEmpire.search(/\/\*\s*═{3,}/);
  const empireCss=nextSection>=0?afterEmpire.slice(0,nextSection):afterEmpire;
  const block=empireCss.replace(/^[^]*?\*\//,'').replace(/\/\*[^]*?\*\//g,'');
  assert(block.length>200,'empire shell CSS block exists');
  assert(!/\.(card|section-title|cost-line|stat-hero|fr-meter)\b/.test(block),'empire CSS never restyles legacy content classes');
  assert(!/overflow\s*:/.test(block),'empire CSS adds no overflow masking');
  assert(!/(^|[}\s])\.view[\s,{]/.test(block)&&!/(^|[}\s])#view[\s,{]/.test(block),'empire CSS adds no broad .view rules');
  for(const rule of block.split('}')){
    const brace=rule.indexOf('{');
    if(brace<0) continue;
    const sel=rule.slice(rule.lastIndexOf('}',brace)+1,brace).trim();
    if(!sel||sel.startsWith('@')||sel.includes('@media')) continue;
    assert(sel.includes('.command-empire')||sel.includes('command-empire'),`empire CSS rule not scoped to .command-empire: ${sel}`);
  }
  assert(/@media\(max-width:820px\)/.test(block)&&/padding-bottom:calc\(\d+px \+ env\(safe-area-inset-bottom/.test(block),
    'empire CSS reserves .bottomnav clearance on mobile widths (incl. 390px)');
  console.log('PASS B6: command-deck.css scoped to .command-empire + .produce-panel — no overflow masking, no broad .view rules, no legacy restyling, mobile .bottomnav clearance');

  /* ═══ PART C — desk features on real state + existing actions only ═══ */
  const popDesk=()=>{
    w.eval(`
      G.studio.cash=600;
      G.films=[{id:1201,title:'Shelf Titan',ww:220,budget:80,profit:60,criticAvg:80,quality:{critic:80,overall:78},releaseWeek:1}];
      G.franchises=[
        {id:1201,name:'Titan Verse',tier:3,entries:[{filmId:1201,title:'Shelf Titan',ww:220,week:1,opening:70,criticAvg:80,profit:60}],ww:220,merch:1,park:1,gameSold:0,decay:1,genre:'action',earned:12.5,built:1,fatigue:0.2},
        {id:1202,name:'Titan Ally',tier:2,entries:[{filmId:1202,title:'Ally One',ww:180,week:2}],ww:180,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:4,built:2,fatigue:0.5},
        {id:'cust_1203',name:'Custom Quest',tier:1,entries:[],ww:0,merch:0,park:0,gameSold:0,decay:1,genre:'fantasy',earned:0,built:1,fatigue:0,custom:true}
      ];
      G.ipMarket=[{id:1301,kind:'custom',genre:'drama',title:'Market Pick',price:22,boost:7,buzz:0.1,born:1,custom:true}];
      render();
    `);
  };

  /* C1 — Home reads live empire state and the cross-media timeline */
  fresh('home');
  assert($('#view .empire-brief'),'home renders the empire overview block');
  assert(viewText().includes('0 franchise(s)'),'home empty career states real counts');
  assert(viewText().includes('No franchises yet'),'home keeps the empty-state guidance');
  popDesk();
  w.eval(`G.empire.subTab='home';G.empire.activeSub='home';render();`);
  assert(viewText().includes('3 franchise(s)'),'home counts the live roster');
  assert.equal($$('#view .timeline-item').length>0,true,'cross-media timeline lists real events');
  assert(viewText().includes('Shelf Titan'),'timeline names the released film');
  w.eval("document.querySelector(\"[data-empire-goto='divisions']\").click();");
  assert.equal(w.eval('empireSub()'),'divisions','home goto buttons switch panels');
  console.log('PASS C1: empire home — live counts, empty state, cross-media timeline, goto navigation');

  /* C2 — Portfolio Desk is view-only sort/filter over real state */
  w.eval(`G.empire.subTab='franchises';G.empire.activeSub='franchises';render();`);
  assert.equal($$('#view [data-em-filter]').length,4,'portfolio has four filter chips');
  assert.equal($$('#view [data-em-sort]').length,5,'portfolio has five sort chips');
  assert.equal($$('#view .empire-portfolio .empire-prow').length,3,'portfolio lists every brand');
  const savedBefore=w.eval('JSON.stringify({f:G.franchises})');
  $('[data-em-filter="resting"]').click();
  const restingCount=w.eval('G.franchises.filter(f=>frRestPlan(f).totalWks>0).length');
  assert.equal($$('#view .empire-portfolio .empire-prow').length,restingCount,'resting filter shows exactly the resting brands');
  assert.equal(w.eval('JSON.stringify({f:G.franchises})'),savedBefore,'filtering is view-only — engine state untouched');
  $('[data-em-filter="all"]').click();
  $('[data-em-sort="ww"]').click();
  assert(viewText().indexOf('Titan Verse')<viewText().indexOf('Titan Ally'),'WW sort orders the desk by gross');
  $('[data-em-sort="name"]').click();
  $('[data-em-filter="all"]').click();
  console.log('PASS C2: portfolio desk — view-only filter & sort over live franchise state');

  /* C3 — Dossier renders one full brand record per visible franchise */
  assert.equal($$('#view .empire-dossier').length,3,'one dossier per visible franchise');
  $('[data-em-filter="tier2"]').click();
  assert.equal($$('#view .empire-dossier').length,2,'dossiers follow the portfolio filter');
  $('[data-em-filter="all"]').click();
  assert($('#view .empire-dossier [data-fr-seq]')&&$('#view .empire-dossier [data-fr-sell]'),'dossier keeps every action surface');
  assert($('#view .empire-dossier .fr-meters .empire-meter'),'dossier meters use the desk vocabulary');
  assert(viewText().includes('Revenue history'),'dossier shows the real entry history');
  console.log('PASS C3: dossiers carry full brand records and actions for every visible franchise');

  /* C4 — Sequel timing planner derives its countdown from tickFatigue() */
  assert.equal($$('#view .empire-planner').length,3,'planner block per dossier');
  const titan=w.eval('G.franchises.find(f=>f.id===1201)');
  const planWks=w.eval('frRestPlan(G.franchises.find(f=>f.id===1201)).totalWks');
  assert(viewText().includes(planWks?'~'+planWks+' wks to heal':'Brand rested & fresh'),'planner countdown equals frRestPlan()/tickFatigue()');
  assert(viewText().includes('26+ wks'),'planner states the tickFatigue rest rule');
  assert(viewText().includes(w.eval('frSequel(G.franchises.find(f=>f.id===1201))')),'planner shows the sequel call from real fatigue state');
  console.log('PASS C4: sequel timing planner — countdown and advice derive from tickFatigue()');

  /* C5 — Merch & Parks split income straight from frIncomeBreakdown() */
  w.eval(`G.empire.subTab='divisions';G.empire.activeSub='divisions';render();`);
  assert($('#view .empire-merchparks'),'merch & parks rollup renders');
  const b1201=w.eval('frIncomeBreakdown(G.franchises.find(f=>f.id===1201))');
  assert(viewText().includes('+'+w.fmtM(b1201.merch)+'/wk'),'rollup merch income equals frIncomeBreakdown().merch');
  assert(viewText().includes('+'+w.fmtM(b1201.park)+'/wk'),'rollup park income equals frIncomeBreakdown().park');
  assert(viewText().includes('×1.6')&&viewText().includes('×1.3'),'rollup states the real MERCH_V2 holiday & toy boosts');
  assert($('#view [data-merchline]'),'film merch lines keep the manufacture action');
  const linePlan=w.eval('merchPlan(G.films[0], "toys")||merchPlan(G.films[0], merchLineDefs()[0].id)');
  assert(linePlan && viewText().includes(w.fmtM(linePlan.cost)),'merch board costs come from merchPlan()');
  console.log('PASS C5: merch & parks — income split from frIncomeBreakdown(), boosts from MERCH_V2, lines from merchPlan()');

  /* C6 — Universes desk reads uniStats() continuity honestly */
  w.eval(`G.empire.subTab='universes';G.empire.activeSub='universes';G.universes=[{id:1401,name:'Probe Verse',frIds:[1201,1202],founded:1,subFranchises:['Titan Verse','Titan Ally']}];render();`);
  const st1401=w.eval('uniStats(G.universes[0])');
  assert(viewText().includes('Probe Verse'),'universe list renders the woven universe');
  assert(viewText().includes('continuity '+st1401.continuity+'%'),'continuity % equals uniStats()');
  assert($('#view [data-unipick]')&&$('#view #uniGo'),'weave controls stay available');
  w.eval('G.universes=[]; render();');
  console.log('PASS C6: universes desk — uniStats() continuity, picks and weave controls');

  /* C7 — Music label shows real label economics only */
  w.eval(`G.empire.subTab='divisions';G.empire.activeSub='divisions';render();`);
  const lc=w.eval('DATA.LABEL_COSTS');
  assert(viewText().includes('Launch — '+w.fmtM(lc.unlock)),'label unlock price comes from DATA.LABEL_COSTS');
  w.eval('unlockLabel(); signArtist("nova"); render();');
  assert(viewText().includes('+'+w.fmtM(w.eval('labelArtistWeeklyIncome(G.label.artists[0])'))+'/wk'),'artist income equals labelArtistWeeklyIncome()');
  assert(viewText().includes('heat '+(w.eval('G.label.artists[0].heat||1'))),'artist rows show real heat state');
  console.log('PASS C7: music label — label economics and artist income from engine constants');

  /* C8 — IP market & sell lists real listings and persisted bids */
  w.eval(`G.empire.subTab='franchises';G.empire.activeSub='franchises';render();`);
  assert($('#view .empire-ipsell'),'IP market & sell desk renders');
  assert(viewText().includes('Market Pick'),'market listing title shown');
  const buyBtn=$('#view [data-ip="1301"]');
  assert(buyBtn&&buyBtn.textContent.includes(w.fmtM(22)),'buy button prices match the listing');
  const top1202=w.eval('franchiseOffers(G.franchises.find(f=>f.id===1202))[0].value');
  const sellRows=$$('#view .empire-ipsell [data-fr-sell]').map(b=>b.dataset.frSell);
  assert(sellRows.includes('1202'),'sell row exists per franchise');
  assert($$('#view .empire-ipsell [data-fr-sell]').some(b=>b.dataset.frSell==='1202'&&b.textContent.includes(w.fmtM(top1202))),'sell row shows the persisted top bid');
  buyBtn.click();
  assert.equal(w.eval('G.franchises.some(f=>f.name==="Market Pick")'),true,'buy action routes through buyIp()');
  console.log('PASS C8: IP market & sell — real listings, persisted bids, working buy action');

  /* C9 — Divisions ledger lists the live divisions as desk rows, no legacy chrome */
  w.eval(`G.empire.subTab='divisions';G.empire.activeSub='divisions';render();`);
  assert.equal($$('#view .empire-divisions .empire-row').length,4,'divisions ledger lists the four operating divisions as desk rows');
  assert(viewText().includes('Game Studio')&&viewText().includes('Merchandise')&&viewText().includes('Publishing')&&viewText().includes('Comics'),'division rows name the operating divisions');
  assert.equal($$('#view .divisions-grid, #view .div-card, #view .div-icon, #view .div-main, #view .div-sub, #view .div-side').length,0,'legacy .div-card icon-tile ledger chrome is gone');
  const wb=w.eval('empireWeeklyBreakdown()');
  assert(viewText().includes(w.fmtM(wb.publishing))||viewText().includes(w.fmtM(wb.total)),'ledger reads the live weekly breakdown');
  console.log('PASS C9: divisions ledger — four desk rows reading the live weekly breakdown');

  /* C10 — Endgame crown tracker reads endgameGoals()/endgameInfluence() */
  w.eval(`G.empire.subTab='endgame';G.empire.activeSub='endgame';render();`);
  const eg=w.eval('endgameGoals()'), egi=w.eval('endgameInfluence()');
  assert($('#view .empire-endgame'),'endgame tracker renders');
  assert($('#view .empire-endgame .empire-row'),'influence summary renders as a desk empire-row');
  assert.equal($$('#view .empire-endgame .empire-progress').length,6,'six goal meters render as desk empire-progress tracks');
  assert.equal($$('#view .empire-endgame .bar, #view .empire-endgame .spread').length,0,'legacy .bar meters and .spread goal rows are gone from the tracker');
  for(const g of eg.slice(0,3)) assert(viewText().includes(g.name.replace(/<[^>]*>/g,''))||viewText().includes(g.label),'tracker lists real goals');
  assert(viewText().includes(egi.share+'% market share'),'tracker shows the real influence share');
  w.eval('G.endgame={crowned:true}; render();');
  assert(viewText().includes('CROWNED'),'tracker shows the earned crown');
  w.eval('G.endgame={}; render();');
  console.log('PASS C10: endgame crown tracker — real goals, influence and crown state');

  /* C11 — Custom & purchased onboarding */
  w.eval(`G.empire.subTab='franchises';G.empire.activeSub='franchises';render();`);
  assert($('#view .empire-onboard'),'onboarding guide renders');
  assert(viewText().includes('Custom Quest')&&viewText().includes('custom'),'custom brands appear with their badge');
  assert(/no entries yet — greenlight the first entry/i.test(viewText()),'custom brand onboarding explains the next step');
  w.eval(`G.franchises.push({id:1204,name:'Bought Lot',tier:1,entries:[],ww:0,merch:0,park:0,gameSold:0,decay:1,genre:'action',earned:0,built:1,purchased:true,purchasedLeft:1});render();`);
  assert(viewText().includes('Bought Lot')&&viewText().includes('purchased'),'purchased IP appears with its badge');
  w.eval(`G.franchises=G.franchises.filter(f=>f.id!==1204);`);
  fresh('franchises');
  assert(/land here with guidance/i.test(viewText()),'onboarding placeholder explains custom & purchased IP');
  console.log('PASS C11: custom & purchased onboarding — badges, guidance and safe empty states');

  /* Zero legacy chrome across every desk panel (populated + empty) */
  const LEGACY_CHROME='#view .card, #view .section-title, #view .cost-line, #view .stat-hero, #view .fr-meter, #view .divisions-grid, #view .div-card, #view .div-icon, #view .div-main, #view .div-sub, #view .div-side, #view .div-row, #view .bar';
  for(const sub of allSubs){
    popDesk();
    w.eval(`G.empire.subTab='${sub}';G.empire.activeSub='${sub}';render();`);
    assert.equal($$(LEGACY_CHROME).length,0,
      `${sub}: zero legacy .card/.section-title/.cost-line/.stat-hero/.fr-meter/.div-card chrome in the desk`);
    fresh(sub);
    assert.equal($$(LEGACY_CHROME).length,0,
      `${sub}: zero legacy classes on an empty career too`);
  }
  console.log('PASS C-DESK: zero legacy chrome on every Empire panel — populated and empty');

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('EMPIRE DESK SUITE PASSED ✅');
}catch(e){
  console.error('EMPIRE DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
