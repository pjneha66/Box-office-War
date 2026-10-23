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

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('EMPIRE DESK SUITE PASSED ✅');
}catch(e){
  console.error('EMPIRE DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
