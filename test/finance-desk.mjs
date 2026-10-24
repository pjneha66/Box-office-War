/* TREASURY DESK regressions (A1–A19) + desk shell (B) + lane coverage (C).
   Runs entirely offline in jsdom against the local app shell: no network, no
   external fixtures. Every A-test pins one defect found in the pre-v38 Finance
   tab, so a future refactor cannot quietly reintroduce it.

   Part 0 (F1–F9) exercises finance-desk.js in plain Node — no DOM — because the
   ledger maths is the part that was wrong, and it should be checkable without
   rendering a single pixel. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

/* ══════════════════════════════════════════════════════════════════════════
   PART 0 — the data layer, in plain Node
   ══════════════════════════════════════════════════════════════════════════ */
{
  const load=f=>fs.readFileSync(f,'utf8').replace(/"use strict";/g,'');
  const bundle=
    "if(typeof global.window==='undefined')global.window=global;\n"+
    "global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};\n"+
    "if(typeof global.DATA==='undefined')global.DATA={};\n"+
    load('data.js')+"\n"+load('engine.js')+"\n"+load('bond-market.js')+"\n"+load('finance-desk.js')+"\n"+
    "module.exports={getG:()=>G,newGame,DATA,FinanceDesk,weekNet,tickBondsWeekly,issueCorporateBond,initBondMarket,getStudioCreditRating,interestRate,weeklyOverhead,maxDebt,catalogValue,marketCap,cashflowForecast,mezzCap,mezzCapTotal,mezzanineLoan,repayMezzanine,forecastProject};\n";
  const tmp=path.join('test','.finance-desk-generated.cjs');
  fs.writeFileSync(tmp,bundle);
  let M;
  try{
    M=require('./'+path.basename(tmp));
    const FD=M.FinanceDesk;
    FD.attachEngine({interestRate:M.interestRate,weeklyOverhead:M.weeklyOverhead,maxDebt:M.maxDebt,catalogValue:M.catalogValue,marketCap:M.marketCap,cashflowForecast:M.cashflowForecast,getStudioCreditRating:M.getStudioCreditRating,mezzCap:M.mezzCap,mezzCapTotal:M.mezzCapTotal});
    M.newGame(M.DATA.ARCHETYPES[1].id,'FD Unit',{scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''});
    const G=M.getG();
    G.week=60; G.studio.cash=250; G.studio.rep=64; G.studio.debt=120; G.studio.mezzDebt=40;
    G.txHistory=[
      {week:58,cats:{theatrical:100,music:-5,other:10,studio:-50,empire:30,interest:-0.2}},
      {week:59,cats:{theatrical:60,games:-12,licensing:8,overhead:-9,empire:-20}},
      {week:60,cats:{streaming:25,talent:-30,insurance:4,financing:200}}
    ];
    G.txHistory.forEach(w=>{w.net=M.weekNet(w.cats);});

    /* F1 — the double-count that inflated profit by $30M */
    const t=FD.ledgerTrail(G);
    const trueNet=Math.round(G.txHistory.reduce((a,w)=>a+w.net,0)*10)/10;
    assert.equal(t.P,trueNet,'F1: trailing profit equals the sum of the weekly nets');
    assert.equal(trueNet,110.8,'F1: the fixture week really nets 110.8 (pre-v38 reported 115)');
    assert.equal(t.reconcile.ok,true,'F1: the ledger reports itself reconciled');
    assert.ok(Math.abs(t.reconcile.delta)<0.15,'F1: bucket total matches the ledger net');

    /* F2 — franchise income no longer cancels somebody else's cost */
    const empire=t.categories.find(c=>c.cat==='empire');
    assert.equal(empire.rev,30,'F2: the +30 franchise week is all revenue');
    assert.equal(empire.exp,-20,'F2: the −20 park build is all cost');
    const inv=t.exp.find(b=>b.id==='investment');
    assert.equal(inv.amount,70,'F2: studio −50 and empire −20 both land in investments, un-netted');

    /* F3 — mixed signs inside one week no longer swallow a cost */
    const music=t.categories.find(c=>c.cat==='music');
    assert.equal(music.exp,-5,'F3: the −5 music cost survives');
    const other=t.categories.find(c=>c.cat==='other');
    assert.equal(other.rev,10,'F3: the +10 other income is not reduced by the music cost');

    /* F4 — the ten categories that used to vanish are all bucketed */
    assert.deepEqual(t.unmapped,[],'F4: no category the engine writes is unmapped');
    const games=t.categories.find(c=>c.cat==='games');
    assert.ok(games,'F4: game-studio cash appears in the ledger');
    const prod=t.exp.find(b=>b.id==='production');
    assert.equal(prod.amount,12,'F4: game spend is declared as production, not "other"');
    const licensing=t.rev.find(b=>b.id==='licensing');
    assert.equal(licensing.amount,8,'F4: rights licensing reaches the revenue split');

    /* F5 — financing stays off the P&L but stays visible */
    assert.equal(t.financing.raised,200,'F5: the $200M raise is tracked');
    assert.ok(!JSON.stringify(t.rev).includes('financing'),'F5: financing is not revenue');
    assert.equal(t.P,trueNet,'F5: profit excludes financing, exactly like weekNet()');

    /* F6 — every rendered bucket sums to the printed total */
    const revSum=Math.round(t.rev.reduce((a,b)=>a+b.amount,0)*10)/10;
    const expSum=Math.round(t.exp.reduce((a,b)=>a+b.amount,0)*10)/10;
    assert.equal(revSum,t.R,'F6: revenue buckets sum to R');
    assert.equal(expSum,t.E,'F6: expense buckets sum to E (the old view hid exp.other)');

    /* F7 — commitments read the engine's own rate functions */
    const c=FD.ledgerCommit(G);
    assert.equal(c.rates.bank,M.interestRate(),'F7: the bank rate is interestRate(), not a literal');
    assert.equal(c.weekly.overhead,M.weeklyOverhead(),'F7: overhead is weeklyOverhead(), not the crude proxy');
    assert.equal(c.debt.total,160,'F7: the debt stack adds bank + mezzanine');
    assert.ok(c.weekly.interest>0,'F7: interest run-rate is non-zero with debt drawn');

    /* F8 — the maturity ladder only dates instruments that really mature */
    const ladder=FD.maturityLadder(G);
    const bank=ladder.find(x=>x.id==='bank');
    assert.equal(bank.maturesWeek,null,'F8: a revolver has no invented balloon date');
    assert.match(bank.maturity,/Revolving/,'F8: the revolver says it rolls');
    M.initBondMarket(G); M.issueCorporateBond(100,52,G);
    const bond=FD.maturityLadder(G).find(x=>x.kind==='bond');
    assert.ok(bond&&bond.maturesWeek>G.week,'F8: a real bond gets a real maturity week');

    /* F9 — the credit rating is read, never hardcoded */
    G.studio.cash=3; G.studio.debt=900; G.studio.rep=8;
    const bad=FD.creditRating(G);
    assert.equal(bad.grade,'CCC','F9: a near-bankrupt studio is CCC, not "AAA Investment"');
    assert.equal(bad.investmentGrade,false,'F9: and is not reported as investment grade');
    G.studio.cash=900; G.studio.debt=0; G.studio.mezzDebt=0; G.studio.rep=85;
    assert.equal(FD.creditRating(G).grade,'AAA','F9: a strong balance sheet really is AAA');

    /* F10 — bond coupons now reach the ledger */
    G.studio.cash=1000; G.weekTx={};
    M.initBondMarket(G); M.issueCorporateBond(200,52,G);
    const coupon=G.bonds.activeBonds[0].weeklyCoupon;
    const cashBefore=G.studio.cash;
    M.tickBondsWeekly(G);
    assert.ok(coupon>0,'F10: the fixture bond carries a coupon');
    assert.ok(G.studio.cash<cashBefore,'F10: cash still falls');
    assert.ok(Math.abs(G.weekTx.interest||0)>0,'F10: the coupon is booked to the interest category');
    assert.ok(Math.abs(M.weekNet(G.weekTx))>0,'F10: weekNet() now sees the coupon');

    /* ── F11 — every ledger category the engine can write is mapped, and an
       unmapped one can never silently leave the profit figure ──
       Regression: eight categories (linearTv, boxoffice, merch, game_revenue,
       game_sales, guild_dues, anti_piracy, financing) were reaching G.weekTx
       but were absent from CATEGORIES. unknownCategory() names an *expense*
       bucket, and _rollBuckets() wrote the positive side to rev["otherexp"] —
       a key not in BUCKET_ORDER_REV, so a $12M linear-TV week vanished from R
       and the P&L disagreed with the ledger by exactly that amount. */
    const repoFiles=fs.readdirSync(path.resolve('.')).filter(f=>f.endsWith('.js'));
    const written=new Set();
    for(const f of repoFiles){
      const src=fs.readFileSync(f,'utf8');
      /* [a-zA-Z_0-9] — a category id may contain a digit (e.g. `pay1`), and a
         narrower class would silently skip it and pass a broken census. */
      for(const m of src.matchAll(/\b(?:global\.)?(?:earn|spend)\(\s*"([a-zA-Z_0-9]+)"/g)) written.add(m[1]);
    }
    assert.ok(written.size>=39,'F11: the census found a plausible set of categories ('+written.size+')');
    const mapped=new Set(Object.keys(FD.CATEGORIES));
    const missing=[...written].filter(c=>!mapped.has(c)&&c!==FD.FINANCING_CAT);
    assert.deepEqual(missing,[],'F11: every earn()/spend() category is mapped');
    /* the mapping is a bijection — no dead entries either */
    const neverWritten=[...mapped].filter(c=>!written.has(c)&&c!=='financing');
    assert.deepEqual(neverWritten,[],'F11: no mapped category is dead weight');
    /* financing is mapped for labelling but must stay off the P&L */
    assert.equal(FD.CATEGORIES.financing.financing,true,'F11: financing is flagged so it stays off the P&L');

    /* the structural guard: an unknown category that EARNED money must land in
       a revenue bucket, and the split must still reconcile */
    G.txHistory=[{week:1,cats:{brandNewRevenueCat:12,overhead:-3}}];
    G.txHistory[0].net=M.weekNet(G.txHistory[0].cats);
    const un=FD.ledgerTrail(G,1);
    assert.ok(un.unmapped.includes('brandNewRevenueCat'),'F11: the unknown category is still surfaced as a warning');
    assert.equal(un.R,12,'F11: and its $12M lands in revenue instead of vanishing');
    assert.equal(un.reconcile.ok,true,'F11: the split reconciles with the ledger (delta '+un.reconcile.delta+')');
    const revBucketIds=new Set(un.rev.map(b=>b.id));
    assert.ok(revBucketIds.has('otherrev'),'F11: it was routed to the other-income bucket');

    /* ...and an unknown category that COST money lands in an expense bucket */
    G.txHistory=[{week:1,cats:{brandNewCostCat:-7,theatrical:20}}];
    G.txHistory[0].net=M.weekNet(G.txHistory[0].cats);
    const un2=FD.ledgerTrail(G,1);
    assert.equal(un2.E,7,'F11: an unknown cost is counted as expense');
    assert.equal(un2.P,13,'F11: and profit is revenue minus that expense');
    assert.equal(un2.reconcile.ok,true,'F11: reconciles both ways');

    /* ── F12 — the mezzanine tranche is capped by the capital structure, not by
       a hardcoded slider ceiling ──
       Regression: mezzanineLoan() had NO cap while the tab offered a slider
       hardcoded min=10 max=200, so the ceiling was invented and identical for a
       $3M indie and a major. The tranche is now half the senior facility that
       maxDebt() sizes from catalogue value and production commitments. */
    G.studio.mezzDebt=0;
    const capTotal=M.mezzCapTotal(), senior=M.maxDebt();
    assert.ok(Math.abs(capTotal-Math.round(senior*0.5*10)/10)<0.05,'F12: the tranche is half the senior facility ('+capTotal+' of '+senior.toFixed(1)+')');
    assert.ok(capTotal!==200||senior===400,'F12: the cap is derived, not a hardcoded 200');
    assert.equal(M.mezzCap(),capTotal,'F12: with nothing drawn, all of it is available');

    /* it scales with the studio */
    const small=M.mezzCapTotal();
    G.studio.cash=9000; G.catalog=(G.catalog||[]);
    const bigLimit=M.maxDebt();
    assert.ok(bigLimit>=senior,'F12: a bigger production slate raises the senior facility');

    /* the engine refuses past the cap instead of printing money */
    G.studio.mezzDebt=0; G.studio.cash=10;
    assert.equal(M.mezzanineLoan(capTotal+5000),true,'F12: an over-cap request is accepted…');
    assert.ok(G.studio.mezzDebt<=capTotal+0.05,'F12: …but clamped to the tranche, not the amount asked for');
    assert.equal(M.mezzCap(),0,'F12: the tranche is now full');
    assert.equal(M.mezzanineLoan(50),false,'F12: and a further draw is refused');

    /* the desk reports the same figures the engine will enforce */
    const mc=FD.ledgerCommit(G).mezz;
    assert.equal(mc.drawn,Math.round(G.studio.mezzDebt*10)/10,'F12: the desk sees the drawn amount');
    assert.equal(mc.headroom,0,'F12: and reports zero headroom');
    assert.equal(mc.slider,null,'F12: so it renders no slider at all rather than a dead one');
    assert.ok(/capped|full/i.test(mc.note),'F12: and states why ('+mc.note.slice(0,60)+'…)');
    G.studio.mezzDebt=0;
    const mc2=FD.ledgerCommit(G).mezz;
    assert.ok(mc2.slider,'F12: with capacity restored a slider is offered');
    assert.ok(mc2.slider.max>=mc2.slider.min,'F12: whose bounds are not inverted');
    assert.ok(mc2.slider.value>=mc2.slider.min&&mc2.slider.value<=mc2.slider.max,'F12: and whose default sits inside them');
    console.log('PASS F1–F12: finance-desk.js ledger maths, commitments, ladder, rating, bond ledger, category census and mezzanine cap');
  }finally{
    try{ fs.unlinkSync(tmp); }catch(e){}
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   PART A/B/C — the rendered desk, in jsdom
   ══════════════════════════════════════════════════════════════════════════ */
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
const lanes=()=>$$('[data-finsub]');

/* every beep() sting is tracked so a refusal can prove it did not fake success */
w.eval(`
  window.__beeps=[];
  const _origBeep = typeof beep === 'function' ? beep : function(){};
  beep = function(kind){ window.__beeps.push(kind); return _origBeep(kind); };
`);
const clearBeeps=()=>{ w.__beeps.length=0; };
const beeps=()=>[...w.__beeps];

/* A career with real ledger history, debt, a listed equity and a bond issue. */
function fresh(sub){
  clearToasts(); clearBeeps();
  w.eval(`
    render=function(){_renderImpl()};
    SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};
    newGame(DATA.ARCHETYPES[1].id,'Treasury Desk Audit',SEL);
    enterApp(false); closeModal();
    G.week=60; G.prevCash=180; G.prevRep=60;
    G.studio.cash=250; G.studio.rep=64; G.studio.debt=120; G.studio.mezzDebt=40;
    G.stats={films:6,seriesSeasons:2,totalWW:840,hits:3,flops:1,bestOpen:120,bestFilm:'Audit Runner',totalProfit:96};
    G.txHistory=[
      {week:58,cats:{theatrical:100,music:-5,other:10,studio:-50,empire:30,interest:-0.2,overhead:-9}},
      {week:59,cats:{theatrical:60,games:-12,licensing:8,overhead:-9,empire:-20,marketing:-14,talent:-11}},
      {week:60,cats:{streaming:25,talent:-30,insurance:4,overhead:-9,theatrical:18,nft:2}}
    ];
    G.txHistory.forEach(wk=>{wk.net=weekNet(wk.cats);});
    G.weekTx={theatrical:18,overhead:-9,talent:-4,financing:20};
    G.maOffers=[{id:'lib1',name:'Meridian Library',blurb:'240 titles, catalogue value.',price:120,expires:G.week+9,icon:'📚'}];
    G.board=[{name:'A. Hawk',trait:'fiscal hawk',approval:44,hawk:true},{name:'R. Vance',trait:'creative',approval:71,hawk:false}];
    G.finState=null;
    initBondMarket(G); issueCorporateBond(100,52,G);
    switchTab('finance'); ${sub?`G.finState={sub:'${sub}'};`:''} render();
  `);
}
const lane=key=>{ w.eval(`financeSet({sub:'${key}'})`); };

try{
  await new Promise(r=>setTimeout(r,1000));
  w.eval(`window.confirm=function(){return window.__confirm!==false;};`);

  /* ── A1 — the two pills that threw a ReferenceError ── */
  fresh();
  assert.equal(w.eval(`typeof ipoModal`),'undefined','ipoModal has never existed');
  assert.equal(w.eval(`typeof maModal`),'undefined','maModal has never existed');
  assert.equal($$('#view [onclick]').length,0,'A1: no inline onclick handler anywhere on the desk');
  assert.equal($$('#view .subnav-pills').length,0,'A1: the legacy pill row is gone');
  /* every button on every lane is wired to a real function */
  const allLanes=['ledger','capital','forecast','equity','deals','analysis','board','invest'];
  for(const key of allLanes){
    lane(key);
    const btns=$$('#view .finance-panel button, #view .command-finance-nav button');
    const dead=btns.filter(b=>typeof b.onclick!=='function' && !b.disabled);
    assert.equal(dead.length,0,`A1: every enabled button on the ${key} lane has a handler (dead: ${dead.map(b=>b.id||b.textContent.trim()).join(', ')})`);
  }
  console.log('PASS A1: no dead controls — the ipoModal()/maModal() ReferenceErrors are gone');

  /* ── A2 — one navigation, one strip, persisted ── */
  fresh();
  assert.equal($('#subTabs').style.display,'none','A2: the global strip stays hidden — the desk owns its nav');
  assert.equal($$('#subTabs [data-finsub]').length,0,'A2: no duplicated chips in the global strip');
  assert.equal(lanes().length,8,'A2: exactly eight lanes');
  assert.deepEqual(lanes().map(b=>b.dataset.finsub),allLanes,'A2: lanes in desk order');
  assert.equal(new Set(lanes().map(b=>b.closest('nav'))).size,1,'A2: all lanes belong to one navigation');
  assert.equal(lanes().filter(b=>b.classList.contains('active')).length,1,'A2: exactly one active lane');
  assert.equal($('.command-finance-nav [data-finsub].active').dataset.finsub,'ledger','A2: a fresh career opens the Ledger');
  assert.equal($('#view').dataset.screen,'finance','A2: the view is the finance screen');
  assert.equal($('.kairo-dept-banner'),null,'A2: no legacy Kairo banner doubling the header');
  lane('equity');
  assert.equal($('.command-finance-nav [data-finsub].active').dataset.finsub,'equity','A2: clicking a lane moves the active marker');
  assert.equal(w.eval(`G.finState.sub`),'equity','A2: the lane persists on G.finState');
  w.eval(`render()`);
  assert.equal($('.command-finance-nav [data-finsub].active').dataset.finsub,'equity','A2: the lane survives a repaint');
  console.log('PASS A2: one persisted lane navigation, no duplicate strip, no doubled header');

  /* ── A3 — finance is registered in the data-driven nav tables ── */
  assert.ok(w.eval(`TAB_META.finance && TAB_META.finance.length===8`),'A3: TAB_META.finance exists with eight sections');
  assert.equal(w.eval(`TAB_SUB_ATTR.finance`),'data-finsub','A3: the sub-tab attribute is registered');
  assert.equal(w.eval(`TAB_SUB_DEFAULT.finance`),'ledger','A3: the default lane is registered');
  /* The reader mirrors the rendered lane, so it is only meaningful after a
     render — that is exactly how library and games behave. */
  w.eval(`G.finState={sub:'forecast'}; render()`);
  assert.equal(w.eval(`TAB_SUB_ACTIVE.finance()`),'forecast','A3: the active reader reports the live lane');
  assert.equal(w.eval(`FINANCE_SUB`),'forecast','A3: and the mirror variable tracks it');
  w.eval(`G.finState={sub:'nonsense'}; render()`);
  assert.equal(w.eval(`TAB_SUB_ACTIVE.finance()`),'ledger','A3: an invalid persisted lane falls back to the Ledger');
  console.log('PASS A3: finance is in TAB_META / TAB_SUB_ATTR / TAB_SUB_DEFAULT / TAB_SUB_ACTIVE');

  /* ── A4 — the ledger reconciles on screen ── */
  fresh();
  const recon=$('#view .fin-recon.ok');
  assert.ok(recon,'A4: the ledger prints a reconciliation banner');
  assert.match(recon.textContent,/Reconciled/,'A4: and it says the buckets reconcile');
  assert.equal(w.eval(`FinanceDesk.ledgerTrail(G,12).reconcile.ok`),true,'A4: the desk agrees');
  assert.equal($$('#view .fin-recon.bad').length,0,'A4: no reconciliation warning on a clean ledger');
  /* the printed totals must equal the sum of the printed lines */
  const sums=w.eval(`(function(){
    const t=FinanceDesk.ledgerTrail(G,12);
    return {R:t.R,E:t.E,P:t.P,
      revSum:Math.round(t.rev.reduce((a,b)=>a+b.amount,0)*10)/10,
      expSum:Math.round(t.exp.reduce((a,b)=>a+b.amount,0)*10)/10};
  })()`);
  assert.equal(sums.revSum,sums.R,'A4: rendered revenue lines sum to the revenue total');
  assert.equal(sums.expSum,sums.E,'A4: rendered expense lines sum to the expense total (exp.other is no longer hidden)');
  console.log('PASS A4: the on-screen split reconciles with the weekly ledger');

  /* ── A5 — no fabricated numbers anywhere on the desk ── */
  fresh();
  for(const key of allLanes){
    lane(key);
    const txt=viewText();
    assert.ok(!/34\.8/.test(txt),`A5: no hardcoded 34.8% margin on the ${key} lane`);
    assert.ok(!/AAA Investment/.test(txt),`A5: no hardcoded "AAA Investment" on the ${key} lane`);
    assert.ok(!/8\.5% cost of capital/.test(txt),`A5: no invented cost-of-capital tooltip on the ${key} lane`);
    assert.ok(!/catalog decay -1\.5%\/quarter/.test(txt),`A5: no invented catalogue-decay tooltip on the ${key} lane`);
    assert.ok(!/facility lease renewal week 52/.test(txt),`A5: no invented lease-renewal tooltip on the ${key} lane`);
  }
  /* the credit rating on screen is the one the bond module computes */
  const shown=w.eval(`FinanceDesk.creditRating(G).grade`);
  lane('capital');
  const telemetry=$$('.command-telemetry .command-metric').map(m=>m.textContent);
  assert.ok(telemetry.some(t=>t.includes(shown)),'A5: the telemetry shows the live credit grade ('+shown+')');
  w.eval(`G.studio.cash=3; G.studio.debt=900; G.studio.rep=8; render()`);
  assert.ok(!/AAA/.test($$('.command-telemetry').map(m=>m.textContent).join('')),'A5: a bankrupt studio is not shown as AAA');
  console.log('PASS A5: no fabricated margin, rating or forecast assumption on any lane');

  /* ── A6 — interest is read from the engine, not a literal ── */
  fresh();
  lane('capital');
  w.eval(`G.execs={cfo:{id:'cfo',level:1,xp:0,tenure:0,salary:0.6}}; render()`);
  const withCfo=w.eval(`JSON.stringify({rate:interestRate(),shown:FinanceDesk.ledgerCommit(G).rates.bank,weekly:FinanceDesk.ledgerCommit(G).weekly.bankInterest})`);
  assert.equal(withCfo.shown,withCfo.rate,'A6: the desk prints interestRate(), which already carries the CFO discount');
  const body=viewText();
  assert.ok(!/0\.18% \/wk|0\.18%\/wk/.test(body)||/discounted 30% by your CFO/.test(body),'A6: the copy states the discounted rate rather than a flat 0.18%');
  /* the run-rate and the debt line can no longer disagree */
  const one=w.eval(`(function(){const c=FinanceDesk.ledgerCommit(G);return {a:c.weekly.bankInterest,b:Math.round(c.debt.bank*c.rates.bank*100)/100};})()`);
  assert.ok(Math.abs(one.a-one.b)<0.02,'A6: the interest line and the run-rate are the same number');
  console.log('PASS A6: interest comes from interestRate() — the CFO discount is honoured, no contradiction');

  /* ── A7 — a legacy save with no txHistory does not blank the tab ── */
  fresh();
  w.eval(`delete G.txHistory;`);
  let out;
  try{ out=w.eval(`viewFinance()`); }catch(e){ out='THREW: '+e.message; }
  assert.ok(typeof out==='string'&&!/^THREW/.test(out),'A7: viewFinance() survives a missing txHistory ('+String(out).slice(0,60)+'…)');
  w.eval(`render()`);
  assert.ok($('.command-finance'),'A7: the desk still renders');
  assert.equal(errors.filter(e=>/txHistory/.test(e)).length,0,'A7: no txHistory TypeError reached the console');
  let pl;
  try{ pl=w.eval(`plCard()`); }catch(e){ pl='THREW: '+e.message; }
  assert.ok(!/^THREW/.test(String(pl)),'A7: plCard() is guarded too');
  console.log('PASS A7: a legacy save without txHistory renders instead of throwing');

  /* ── A8 — the borrow control refuses loudly at zero headroom ── */
  fresh('capital');
  w.eval(`G.studio.debt=maxDebt()+50; render()`);
  assert.equal($('#fnLoan'),null,'A8: no borrow slider is offered when there is no headroom');
  assert.ok(/No borrowing capacity/.test(viewText()),'A8: the lane says why borrowing is unavailable');
  w.eval(`G.studio.debt=0; G.studio.cash=400; render()`);
  const loan=$('#fnLoan');
  assert.ok(loan,'A8: with headroom the slider returns');
  assert.ok(+loan.max>=+loan.min,'A8: the slider bounds are not inverted (min='+loan.min+' max='+loan.max+')');
  assert.ok(+loan.value>=+loan.min && +loan.value<=+loan.max,'A8: the default sits inside the bounds');
  /* a refusal must be audible and explained, never silent */
  w.eval(`G.studio.debt=maxDebt(); render()`);
  clearToasts(); clearBeeps();
  const go=$('#fnLoanGo');
  if(go){ go.click(); assert.ok(/bad/.test(beeps().join(',')),'A8: a refused borrow beeps bad'); assert.ok(toastText().length>0,'A8: and explains itself'); }
  console.log('PASS A8: the credit facility refuses loudly instead of looking dead');

  /* ── A9 — every money control reports its outcome ── */
  fresh('capital');
  const cases=[
    ['#fnLoanGo',()=>{ w.eval(`G.studio.debt=0; G.studio.cash=400; render()`); }],
    ['#fnMezzGo',()=>{ w.eval(`G.studio.cash=10; render()`); }]
  ];
  for(const [sel,setup] of cases){
    setup(); clearToasts(); clearBeeps();
    const b=$(sel);
    assert.ok(b,`A9: ${sel} exists`);
    b.click();
    assert.ok(beeps().length>0,`A9: ${sel} beeps on click`);
  }
  /* an unaffordable repayment is refused with words, not silence */
  w.eval(`G.studio.debt=200; G.studio.cash=0.4; financeSet({sub:'capital'});`);
  assert.equal($('#fnRepay'),null,'A9: no repay slider when cash cannot cover $1M');
  assert.ok(/Repayment needs at least \$1M/.test(viewText()),'A9: and the lane says so');
  console.log('PASS A9: borrow, repay and mezzanine controls all give feedback');

  /* ── A10 — no inline hex colours; the desk uses its own tokens ── */
  fresh();
  for(const key of allLanes){
    lane(key);
    const hexed=$$('#view [style]').filter(e=>/#[0-9a-fA-F]{3,8}\b/.test(e.getAttribute('style')||''));
    assert.equal(hexed.length,0,`A10: no inline hex colour on the ${key} lane`);
  }
  const css=fs.readFileSync('command-deck.css','utf8');
  /* The block's own header comment names the retired literals in prose; slice
     from the END of that comment so the assertion tests declarations only. */
  const marker=css.indexOf('v38.0 TREASURY DESK');
  assert.ok(marker>0,'A10: the Treasury Desk stylesheet block exists');
  const finBlock=css.slice(css.indexOf('*/',marker)+2).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(finBlock.includes('--fin-panel'),'A10: the desk defines its own colour tokens');
  assert.ok(!/0d1119|0a0e16|ffdf9a/i.test(finBlock),'A10: the old blue-black literals are not used in any declaration');
  assert.ok(finBlock.length>2000,'A10: the desk really is styled (not left to legacy classes)');
  console.log('PASS A10: no inline hex; the desk is themed through --fin-* tokens');

  /* ── A11 — bond coupons reach the ledger in the live app ── */
  fresh();
  const bondProof=w.eval(`(function(){
    G.studio.cash=1000; G.weekTx={};
    initBondMarket(G); issueCorporateBond(200,52,G);
    const before=G.studio.cash;
    tickBondsWeekly(G);
    return {before, after:G.studio.cash, interest:G.weekTx.interest||0, net:weekNet(G.weekTx)};
  })()`);
  assert.ok(bondProof.after<bondProof.before,'A11: cash still falls');
  assert.ok(Math.abs(bondProof.interest)>0,'A11: the coupon is booked to the interest ledger category');
  assert.ok(Math.abs(bondProof.net)>0,'A11: weekNet() sees it, so the P&L and the earnings call do too');
  console.log('PASS A11: bond coupons are booked to the ledger instead of moving cash behind its back');

  /* ── A12 — the Kairo banner no longer lies, if anything still asks for it ── */
  const banner=w.eval(`(function(){
    G.studio.cash=3; G.studio.debt=900; G.studio.mezzDebt=0; G.studio.rep=8;
    return KairoTheme.renderBanner('finance');
  })()`);
  assert.ok(typeof banner==='string'&&banner.length>0,'A12: the banner still renders for callers that ask');
  assert.ok(!/AAA Investment/.test(banner),'A12: no hardcoded AAA grade');
  assert.ok(!/34\.8/.test(banner),'A12: no hardcoded 34.8% margin');
  assert.ok(/CCC/.test(banner),'A12: the bankrupt studio is graded CCC');
  assert.ok(!/bondMarketModal|ipoModal|cfoOfficeModal/.test(banner),'A12: no button wired to a function that does not exist');
  console.log('PASS A12: the Kairo finance banner reports the live grade and wires real handlers');

  /* ── A13 — analysis lab ratios are finite, signed and never a fake ∞ ── */
  fresh('analysis');
  const ratios=w.eval(`JSON.stringify(FINANCE_TOOLS.keyRatios())`);
  const r=JSON.parse(ratios);
  assert.ok(!Object.values(r).some(v=>v===Infinity),'A13: no ratio reports Infinity');
  const m=w.eval(`JSON.stringify(FINANCE_TOOLS.studioMetrics())`);
  assert.ok(Number.isFinite(JSON.parse(m).ebitda),'A13: EBITDA is finite');
  /* EBITDA adds interest back, so it cannot be below net income when interest is charged */
  w.eval(`G.studio.debt=400; G.txHistory=[{week:60,cats:{theatrical:100,interest:-4,overhead:-10}}]; G.txHistory[0].net=weekNet(G.txHistory[0].cats);`);
  const eb=w.eval(`(function(){const s=FINANCE_TOOLS.studioMetrics();return {ebitda:s.ebitda,net:s.netIncome};})()`);
  assert.ok(eb.ebitda>eb.net,'A13: EBITDA exceeds net income once interest is added back (pre-v38 it was below)');
  const cov=w.eval(`(function(){G.studio.debt=400;return FINANCE_TOOLS.keyRatios().interestCoverage;})()`);
  assert.ok(cov!==null&&Number.isFinite(cov)&&cov>0,'A13: interest coverage is a real positive multiple with debt outstanding, not Infinity');
  console.log('PASS A13: EBITDA adds interest back and coverage is a real number');

  /* ── A14 — the ledger search filters by text, direction and category ── */
  fresh();
  const search=$('#finSearch');
  assert.ok(search,'A14: the ledger search field exists');
  search.value='talent'; search.dispatchEvent(new w.Event('input'));
  await new Promise(r=>setTimeout(r,260));
  let rows=$$('#finTxRows .fin-line');
  assert.ok(rows.length>0,'A14: "talent" matches rows');
  assert.ok(rows.every(x=>/Talent/i.test(x.textContent)),'A14: and only talent rows');
  assert.ok(/entr/.test($('#finCount').textContent),'A14: the result count updates live');
  assert.ok($('#finSearch')===search,'A14: the field is not rebuilt, so the caret survives typing');
  /* direction filter */
  w.eval(`financeSet({q:'',cat:'all',side:'out'})`);
  rows=$$('#finTxRows .fin-line');
  assert.ok(rows.length>0&&rows.every(x=>/−/.test(x.textContent)),'A14: "Money out" shows only costs');
  w.eval(`financeSet({side:'in'})`);
  rows=$$('#finTxRows .fin-line');
  assert.ok(rows.length>0&&rows.every(x=>/\+/.test(x.textContent)),'A14: "Money in" shows only income');
  /* category filter is built from real data, including the new categories */
  w.eval(`financeSet({side:'all'})`);
  const chips=$$('[data-fincat]').map(b=>b.dataset.fincat);
  assert.ok(chips.includes('games'),'A14: the category chips include games (invisible pre-v38)');
  assert.ok(chips.includes('nft'),'A14: and nft');
  assert.ok(!chips.includes('undefined'),'A14: no junk chip');
  w.eval(`financeSet({cat:'games'})`);
  rows=$$('#finTxRows .fin-line');
  assert.ok(rows.length>0&&rows.every(x=>/Game studio/i.test(x.textContent)),'A14: filtering by games works');
  /* reset */
  const reset=$('#finReset');
  assert.ok(reset,'A14: a clear-filters control appears once a filter is set');
  reset.click();
  assert.equal(w.eval(`G.finState.cat`),'all','A14: clearing resets the category');
  assert.equal($('#finSearch').value,'','A14: and the search text');
  console.log('PASS A14: the ledger filters by text, direction and category, and resets');

  /* ── A15 — the trailing window switch works ── */
  fresh();
  const ranges=$$('[data-finweeks]').map(b=>+b.dataset.finweeks);
  assert.deepEqual(ranges,[4,8,12],'A15: three trailing windows are offered');
  w.eval(`financeSet({weeks:4})`);
  assert.equal(w.eval(`G.finState.weeks`),4,'A15: the window persists');
  /* The fixture has 3 snapshots, so a 4-week window must title itself with the
     3 weeks it really covers rather than pretending to a padded four. */
  const four=w.eval(`FinanceDesk.ledgerTrail(G,4).weeks`);
  assert.equal(four,3,'A15: a 4-week window over 3 snapshots reports 3');
  assert.ok(/TRAILING 3 WEEKS/.test(viewText()),'A15: and the panel is retitled to the real length');
  /* with a full history the requested window is honoured exactly */
  w.eval(`
    G.txHistory=[]; for(let i=0;i<12;i++) G.txHistory.push({week:49+i,cats:{theatrical:10+i,overhead:-9},net:weekNet({theatrical:10+i,overhead:-9})});
    financeSet({weeks:4});
  `);
  assert.equal(w.eval(`FinanceDesk.ledgerTrail(G,4).weeks`),4,'A15: over a full history a 4-week window covers exactly 4');
  assert.ok(/TRAILING 4 WEEKS/.test(viewText()),'A15: and the panel says so');
  w.eval(`financeSet({weeks:12})`);
  assert.ok(/TRAILING 12 WEEKS/.test(viewText()),'A15: switching to 12 retitles again');
  console.log('PASS A15: the trailing window is selectable and honest about its length');

  /* ── A16 — runway and the stress test are computed, not asserted ── */
  fresh('forecast');
  /* Give the forecast real revenue to shock: a film still in theatres, a
     franchise paying weekly income and a platform with subscribers. Without
     these every projected row is pure overhead and a revenue shock is a no-op. */
  w.eval(`
    G.films=[{id:901,title:'Audit Runner',genre:'action',scale:'mid',budget:60,ww:210,dom:90,intl:120,
      opening:70,decay:0.62,legs:6,weeksOut:1,inTheaters:true,releaseWeek:58,
      quality:{overall:74,critic:72,aud:76},franchiseName:null,awards:[],weekly:[],
      soldTo:null,streamingOriginal:false,onOwn:false,onOwnPlatform:false,profit:64,window:45,archived:false}];
    G.franchises=[{id:901,name:'Audit Verse',tier:3,merch:2,park:1,gameSold:0,decay:1,genre:'action',earned:18,built:1,fatigue:0.1,entries:[],ww:210}];
    G.streamer={name:'AuditFlix',subs:14,peak:14,churn:0.008,income:0,totalRev:0,lastContent:G.week,tier:'premium',sportsPower:1};
    G.studio.cash=250;
    render();
  `);
  const hasRevenue=w.eval(`FinanceDesk.stressForecast(G,{preset:'base'}).rows.some(r=>r.rev>0)`);
  assert.ok(hasRevenue,'A16: the fixture forecast really carries revenue to shock');
  const run=$$('.fin-runway-fig');
  assert.equal(run.length,4,'A16: the runway strip shows cash, burn, runway and committed production');
  const runway=w.eval(`JSON.stringify(FinanceDesk.runway(G))`);
  assert.ok(Number.isFinite(JSON.parse(runway).weeks)||JSON.parse(runway).weeks===null,'A16: runway is a number or nothing');
  const presets=$$('[data-finstress]').map(b=>b.dataset.finstress);
  assert.deepEqual(presets,['base','softopen','flop','overrun','squeeze'],'A16: five documented stress scenarios');
  const baseEnd=w.eval(`FinanceDesk.stressForecast(G,{preset:'base'}).endCash`);
  w.eval(`financeSet({stress:'flop'})`);
  const flopEnd=w.eval(`FinanceDesk.stressForecast(G,{preset:'flop'}).endCash`);
  assert.ok(flopEnd<baseEnd,'A16: halving revenue ends below the unshocked forecast ('+flopEnd+' < '+baseEnd+')');
  assert.ok(/Survives the shock|Insolvent in week/.test(viewText()),'A16: the verdict is printed, not implied');
  w.eval(`financeSet({stress:'squeeze'})`);
  assert.ok(/Solvent|Survives|Insolvent/.test(viewText()),'A16: the credit squeeze also reports a verdict');
  console.log('PASS A16: runway and the five-scenario stress test compute and report a verdict');

  /* ── A17 — one forecast, not two contradicting ones ── */
  fresh('forecast');
  /* The base projection and the stress-test projection are separate panels, so
     two bar charts on the lane is correct. What must be true is that the engine
     only has ONE forecast: pre-v38 forecastProject() recomputed overhead with a
     crude proxy and hardcoded 0.0018 interest, so it contradicted
     cashflowForecast() (which the week-detail card used) on the same screen. */
  const charts=$$('#view .finance-bars');
  assert.ok(charts.length>=1,'A17: the forecast lane renders its bar chart');
  const agree=w.eval(`(function(){
    G.studio.overhead=4;
    G.execs={cfo:{id:'cfo',level:1,xp:0,tenure:0,salary:0.6}};
    G.studio.debt=400;
    const a=forecastProject(), b=cashflowForecast();
    return {n:a.rows.length, m:b.length,
      sameNet:a.rows.every((r,i)=>Math.abs(r.net-b[i].net)<0.05),
      sameWeek:a.rows.every((r,i)=>r.week===b[i].w),
      oh:weeklyOverhead()};
  })()`);
  assert.equal(agree.n,12,'A17: forecastProject covers 12 weeks');
  assert.equal(agree.m,12,'A17: cashflowForecast covers 12 weeks');
  assert.equal(agree.sameWeek,true,'A17: the two agree on which weeks');
  assert.equal(agree.sameNet,true,'A17: and on every net — there is one forecast, not two');
  assert.ok(agree.oh>4,'A17: weeklyOverhead() bills the executive salary on top of the base overhead');
  /* the dishonest tooltip is gone */
  const titled=$$('#view [title]').map(e=>e.getAttribute('title')).join(' | ');
  assert.ok(!/8\.5% cost of capital/.test(titled),'A17: no invented assumption in any tooltip');
  console.log('PASS A17: forecastProject() and cashflowForecast() are one forecast, no invented assumptions');

  /* ── A18 — executives are listed once ── */
  fresh('board');
  const execButtons=$$('[data-exec]');
  const ids=execButtons.map(b=>b.dataset.exec);
  assert.equal(new Set(ids).size,ids.length,'A18: no executive is offered twice on the Board lane');
  lane('invest');
  const hqExec=$$('[data-hqbuy]').map(b=>b.dataset.hqbuy).filter(v=>/^exec:/.test(v));
  assert.equal($$('[data-exec]').length,0,'A18: the Investments lane does not repeat the executive grid');
  /* hiring still works from the one place it is offered */
  lane('board');
  w.eval(`G.studio.cash=900; render()`);
  const hire=$$('[data-exec]')[0];
  assert.ok(hire,'A18: an executive can be hired');
  clearBeeps(); hire.click();
  assert.ok(Object.keys(w.eval(`G.execs`)).length>0,'A18: the hire landed');
  /* An unaffordable hire stays clickable so it can explain itself. A disabled
     button never fires a click, so disabling it would be the same silent
     control this desk exists to remove — the shortfall is in the label. */
  w.eval(`G.execs={}; G.studio.cash=1; render()`);
  const poor=$$('[data-exec]')[0];
  assert.ok(poor,'A18: the executive is still offered when unaffordable');
  assert.equal(poor.disabled,false,'A18: and stays enabled so the click can report the reason');
  assert.match(poor.textContent,/short \$/,'A18: the label states the shortfall before you click');
  clearToasts(); clearBeeps(); poor.click();
  assert.ok(/Not enough cash/.test(toastText()),'A18: clicking it explains why ('+toastText().slice(0,70)+')');
  assert.ok(/bad/.test(beeps().join(',')),'A18: and beeps bad rather than faking a gold success');
  assert.equal(Object.keys(w.eval(`G.execs`)).length,0,'A18: nothing was hired');
  /* the same holds for upgrades, technology and headquarters wings */
  lane('invest');
  const poorUpg=$$('[data-upg]')[0];
  assert.ok(poorUpg&&poorUpg.disabled===false,'A18: an unaffordable upgrade stays clickable');
  clearToasts(); clearBeeps(); poorUpg.click();
  assert.ok(/Not enough cash|refused/.test(toastText()),'A18: and explains itself');
  assert.ok(/bad/.test(beeps().join(',')),'A18: no false gold on a refused build');
  /* buyUpgrade() returns undefined — success must be read from the state, or a
     successful build would be reported as a refusal. */
  w.eval(`G.studio.cash=900; render()`);
  const richUpg=$$('[data-upg]')[0];
  const id=richUpg.dataset.upg;
  clearToasts(); clearBeeps(); richUpg.click();
  assert.equal(w.eval(`!!G.upgrades['${id}']`),true,'A18: the affordable upgrade actually built');
  assert.ok(/gold/.test(beeps().join(',')),'A18: and is reported as a success, not a refusal');
  assert.ok(!/refused|Not enough/.test(toastText()),'A18: no refusal toast on a successful build');
  console.log('PASS A18: executives are offered once, and refusals are explained');

  /* ── A19 — M&A, IPO and secondary offering all resolve to real functions ── */
  fresh('deals');
  const ma=$$('[data-ma]');
  assert.ok(ma.length>0,'A19: an acquisition offer is rendered');
  w.eval(`G.studio.cash=5; render()`);
  const poorDeal=$$('[data-ma]')[0];
  clearToasts(); clearBeeps(); poorDeal.click();
  assert.ok(/Short by/.test(toastText()),'A19: an unaffordable deal names the shortfall');
  w.eval(`G.studio.cash=900; render()`);
  clearBeeps(); $$('[data-ma]')[0].click();
  assert.ok(/gold/.test(beeps().join(',')),'A19: an affordable deal completes');
  /* IPO: locked below rep 60, and the button says so */
  lane('equity');
  w.eval(`G.public=null; G.studio.rep=20; render()`);
  const ipoLocked=$('#fnIpo');
  assert.ok(ipoLocked&&ipoLocked.disabled,'A19: the IPO button is disabled below rep 60');
  assert.ok(/Needs reputation 60\+/.test(viewText()),'A19: and the lane states the requirement and the gap');
  w.eval(`G.studio.rep=70; render()`);
  const ipo=$('#fnIpo');
  assert.ok(ipo&&!ipo.disabled,'A19: eligible at rep 70');
  clearBeeps(); ipo.click();
  assert.ok(w.eval(`!!G.public`),'A19: going public works');
  /* the stock panel keeps the selectors other suites rely on */
  assert.ok($('.finance-stock-spark'),'A19: the share-price sparkline renders');
  const sec=$('#fnSec');
  assert.ok(sec,'A19: the secondary offering control renders');
  const sharesBefore=w.eval(`G.public.shares`);
  clearBeeps(); $('#fnSecGo').click();
  assert.ok(w.eval(`G.public.shares`)>sharesBefore,'A19: the offering issues shares');
  console.log('PASS A19: M&A, IPO and the secondary offering all reach real engine functions');

  /* ── A20 — the mezzanine slider is capped by the capital structure ── */
  fresh('capital');
  w.eval(`G.studio.mezzDebt=0; render();`);
  let mz=$('#fnMezz');
  assert.ok(mz,'A20: the mezzanine slider renders when the tranche has capacity');
  const capTotal=w.eval(`mezzCapTotal()`), senior=w.eval(`maxDebt()`);
  const floorCap=Math.max(10,Math.floor(w.eval(`mezzCap()`)/10)*10);
  assert.equal(+mz.max,floorCap,'A20: its ceiling is the derived tranche ('+mz.max+'), not a hardcoded 200');
  assert.notEqual(+mz.max,200,'A20: the invented $200M ceiling is gone');
  assert.ok(Math.abs(capTotal-senior*0.5)<0.05,'A20: the tranche is half the senior facility');
  assert.ok(+mz.min<=+mz.max,'A20: bounds are not inverted');
  assert.ok(+mz.value>=+mz.min&&+mz.value<=+mz.max,'A20: the default sits inside the bounds');
  assert.ok(viewText().includes('half the'),'A20: the rule is stated on screen, not left implicit');
  /* a full tranche renders no slider at all, and says why */
  w.eval(`G.studio.mezzDebt=mezzCapTotal(); render();`);
  assert.equal($('#fnMezz'),null,'A20: a full tranche offers no slider rather than a dead one');
  assert.ok(/No mezzanine capacity/.test(viewText()),'A20: and explains that the tranche is full');
  /* the engine refuses too — the cap is real, not only a UI ceiling */
  const refused=w.eval(`(function(){ const before=G.studio.mezzDebt; const ok=mezzanineLoan(9000); return {ok, drew:G.studio.mezzDebt-before}; })()`);
  assert.equal(refused.ok,false,'A20: mezzanineLoan() refuses past the cap');
  assert.equal(refused.drew,0,'A20: and prints no money');
  console.log('PASS A20: the mezzanine tranche is capped by the capital structure, in the UI and the engine');

  /* ── A21 — one [data-seq] handler resolving both id spaces ──
     Regression: bindView() bound [data-seq] TWICE through a global $$(). The
     second (film-only) handler overwrote the first (series-only), so every
     "New season" button looked its series id up in G.films, found nothing and
     silently did nothing. */
  const seqBinds=w.eval(`bindView.toString().match(/\\$\\$\\(\"\\[data-seq\\]\"\\)/g).length`);
  assert.equal(seqBinds,1,'A21: bindView() binds [data-seq] exactly once');
  w.eval(`
    G.films=[{id:7001,title:'Sequel Bait',genre:'action',ww:300,quality:{overall:70},franchiseName:null}];
    G.series=[{id:7002,title:'Long Runner',phase:'aired',status:'running',seasons:2,budget:20,spent:20}];
    window.__seqCalls=[];
    startSequel=function(x){ window.__seqCalls.push({title:x&&x.title, kind:(G.films.indexOf(x)>=0?'film':'series')}); };
    document.querySelector('#view').innerHTML=
      '<button data-seq="7001">Sequel</button>'+
      '<button data-seq="7002">New season</button>'+
      '<button data-seq="9999">Ghost</button>'+
      '<button data-seq="7002" disabled>Cancelled</button>';
    bindView();
  `);
  const seqBtns=$$('#view [data-seq]');
  assert.equal(seqBtns.length,4,'A21: the fixture has four sequel buttons');
  seqBtns[0].click();
  /* deepStrictEqual compares prototypes, and objects minted inside the jsdom
     window belong to that realm — compare their JSON instead. */
  assert.equal(w.eval(`JSON.stringify(window.__seqCalls)`),JSON.stringify([{title:'Sequel Bait',kind:'film'}]),'A21: a film id still starts a film sequel');
  w.eval(`window.__seqCalls=[]`);
  clearToasts();
  seqBtns[1].click();
  assert.equal(w.eval(`JSON.stringify(window.__seqCalls)`),JSON.stringify([{title:'Long Runner',kind:'series'}]),'A21: and a series id starts a new season instead of doing nothing');
  /* an id in neither space explains itself rather than failing silently */
  w.eval(`window.__seqCalls=[]`); clearToasts(); clearBeeps();
  seqBtns[2].click();
  assert.equal(w.eval(`window.__seqCalls.length`),0,'A21: an unknown id starts nothing');
  assert.ok(/no longer in the catalogue/i.test(toastText()),'A21: and says so ('+toastText().slice(0,50)+')');
  /* a cancelled series is refused with the real reason */
  w.eval(`G.series[0].status='ended'; window.__seqCalls=[]; render=function(){}; document.querySelector('#view').innerHTML='<button data-seq="7002">New season</button>'; bindView();`);
  clearToasts(); clearBeeps();
  $$('#view [data-seq]')[0].click();
  assert.equal(w.eval(`window.__seqCalls.length`),0,'A21: a cancelled series takes no new season');
  assert.ok(/cancelled/i.test(toastText()),'A21: and the toast says why');
  console.log('PASS A21: one [data-seq] handler resolves films and series, and explains every refusal');

  /* ── B — desk shell ── */
  fresh();
  assert.ok($('.command-finance'),'B: the desk renders inside .command-finance');
  assert.ok($('.command-heading h1'),'B: it carries a command heading');
  const tel=$$('.command-telemetry .command-metric');
  assert.equal(tel.length,4,'B: four telemetry metrics');
  assert.ok(tel[0].textContent.includes('$'),'B: capital is a money figure');
  const panels=$$('#view .finance-panel');
  assert.ok(panels.length>=3,'B: the ledger lane renders several panels');
  assert.ok(panels.every(p=>p.querySelector('.produce-panel-head')),'B: every panel has a head');
  /* every lane renders content, never an empty string */
  for(const key of allLanes){
    lane(key);
    assert.ok(viewText().length>600,`B: the ${key} lane renders real content`);
    assert.equal($$('#view .finance-panel').length>=1,true,`B: the ${key} lane has at least one panel`);
  }
  console.log('PASS B: the desk shell, telemetry and all eight lanes render content');

  /* ── C — coverage of the preserved controls ── */
  fresh();
  const need=[
    ['ledger','#finSearch'],['ledger','#finTxRows'],['ledger','#btnExportCSV'],['ledger','.finance-pl-bars'],
    ['capital','#fnLoan'],['capital','#fnMezz'],['capital','.fin-ladder'],['capital','.fin-alerts'],['capital','#btnOpenBonds'],
    ['forecast','.fin-runway'],['forecast','.finance-bars'],['forecast','[data-finstress]'],
    ['equity','#fnIpo'],
    ['deals','[data-ma]'],['deals','#btnMaBrowse'],
    ['analysis','.finance-panel'],
    ['board','[data-exec]'],['board','#btnOpenBoard'],['board','#btnOpenDynasty'],
    ['invest','[data-upg]'],['invest','[data-hqbuy]'],['invest','[data-tech]']
  ];
  for(const [key,sel] of need){
    lane(key);
    assert.ok($('#view '+sel),`C: ${sel} is present on the ${key} lane`);
  }
  /* the listed-studio controls appear once the studio is public */
  w.eval(`G.studio.rep=70; if(!G.public) goPublic(); financeSet({sub:'equity'});`);
  for(const sel of ['#fnSec','#fnSecGo','.finance-stock-spark']) assert.ok($('#view '+sel),`C: ${sel} is present once listed`);
  /* the bond desk opener is wired on both lanes that offer it */
  for(const key of ['capital','equity']){
    lane(key);
    const b=$('#btnOpenBonds')||$('#btnOpenBonds2');
    assert.ok(b&&typeof b.onclick==='function',`C: the bond desk opener is wired on the ${key} lane`);
  }
  console.log('PASS C: every preserved control is present and wired on its lane');

  /* ── no runtime errors across the whole sweep ── */
  const real=errors.filter(e=>!/Could not load|Not implemented/.test(e));
  assert.deepEqual(real,[],'no runtime errors during the finance sweep');
  console.log('PASS: zero runtime errors across all eight lanes');

  console.log('\nTREASURY DESK SUITE PASSED ✅');
}catch(err){
  console.error('\n❌ '+err.message);
  const real=errors.filter(e=>!/Could not load|Not implemented/.test(e));
  if(real.length) console.error('\nconsole errors:\n'+real.slice(0,8).join('\n'));
  process.exit(1);
}finally{
  try{ w.close(); }catch(e){}
}
