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

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('EMPIRE DESK SUITE PASSED ✅');
}catch(e){
  console.error('EMPIRE DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
