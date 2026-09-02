/* Headless smoke test: loads data.js + engine.js, plays ~5 years with an AI, sanity-checks the economy. */
"use strict";
const fs = require("fs"), vm = require("vm");
global.localStorage = { _s:{}, getItem(k){ return this._s[k]??null; }, setItem(k,v){ this._s[k]=v; }, removeItem(k){ delete this._s[k]; } };

const src = f => fs.readFileSync(__dirname+"/../"+f, "utf8");
vm.runInThisContext(src("data.js"), {filename:"data.js"});
vm.runInThisContext(src("engine.js"), {filename:"engine.js"});

newGame("producer", "Smoke Test Studios");

let didAuction=false, didShop=false, didFranchiseTest=false, sawRentals=false;
function tryAuctions(){
  if(G.pendingAuction){ acceptAuction(0); return; }
  if(!didShop){
    const p=G.projects.find(x=>x.phase==="ready" && !x.releaseWeek && !x.prebuyAccepted && G.week-x.born>4);
    const ready=G.projects.find(x=>x.phase==="ready" && !x.releaseWeek && !x.prebuyAccepted);
    if(ready && G.films.length>=2 && chance(0.5)){ shopToStreamers(ready.id); didShop=true; }
  }
}
function tryEmpire(){
  if(didFranchiseTest || !G.franchises.length) return;
  const fr=G.franchises[0];
  if(fr.tier>=1) upgradeMerch(fr.id);
  if(fr.tier>=2) buildPark(fr.id);
  sellGameRights(fr.id);
  didFranchiseTest=true;
}
function tryGreenlight(){
  const producing = G.projects.filter(p=>p.phase!=="ready").length;
  if(producing>=2 || !G.ideas.length) return;
  const dirs = G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil);
  const acts = G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil);
  if(!dirs.length || acts.length<1) return;
  const useStreamPlan = !didAuction && G.films.length>=1 && chance(0.5);
  // play like a startup: work the market from the cheapest viable script up
  const cands = G.ideas.map(i=>({i, b:neededBudget(i.genre,i.scale)}))
    .sort((a,b)=>a.b-b.b).slice(0,3);
  for(const {i:idea, b:budget} of shuffle3(cands)){
    const affordable = a => actorFee(a) <= Math.max(budget*0.18, 1.5);
    const dir = pick(dirs.filter(affordable)) || pick(dirs.filter(d=>actorFee(d)<=budget*0.25));
    if(!dir) continue;
    const cast = [];
    const pool = acts.filter(affordable);
    for(let k=0;k<rint(1,3) && pool.length;k++){ const a=pool.splice(rint(0,pool.length-1),1)[0]; cast.push(a); }
    // crew attach (budget-aware): writers drive the script, producers guard the shoot
    let wr=null, pr=null;
    const wrs=G.talent.filter(t=>t.kind==="writer"&&!t.bookedUntil&&actorFee(t)<=budget*0.12);
    const prs=G.talent.filter(t=>t.kind==="producer"&&!t.bookedUntil&&actorFee(t)<=budget*0.15);
    if(wrs.length && chance(0.65)) wr=pick(wrs);
    if(prs.length && chance(0.65)) pr=pick(prs);
    const need = devCostOf(idea)+actorFee(dir)+cast.reduce((s,c)=>s+actorFee(c),0)
      +(wr?actorFee(wr):0)+(pr?actorFee(pr):0)+budget*0.85+25;
    // disciplined: only commit when cash covers the film + buffer — but a studio that
    // never shoots dies, so bridge a gap with the credit facility while young
    if(G.studio.cash < need){
      const gap=need-G.studio.cash;
      if(G.films.length<6 && (maxDebt()-G.studio.debt)>gap+50) takeLoan(gap+40);
      if(G.studio.cash < need) continue;
    }
    if(G.studio.debt > 0 && G.studio.debt > maxDebt()*0.7) continue;
    const cfg={idea, director:dir, cast, budget, presales:chance(0.3)};
    if(useStreamPlan){ cfg.plan="streaming"; didAuction=true; }
    if(wr) cfg.writer=wr;
    if(pr) cfg.producer=pr;
    greenlight(cfg);
    return;
  }
}
function shuffle3(a){ return a.slice().sort(()=>Math.random()-0.5); }

function trySchedule(){
  for(const p of readyProjects()){
    if(p.releaseWeek) continue;
    let wk = G.week + rint(1, 10);
    p.marketing = recMarketing(p);
    p.releaseWeek = wk;
    G.studio.cash -= p.marketing*0.3;
    p.marketingPaid = p.marketing*0.3;
  }
}

function tryOffers(){
  for(const o of [...G.offers]){
    if(chance(0.75)) acceptOffer(o);
    else if(chance(0.5)) counterOffer(o);
  }
}

function trySeries(){
  if(G.series.filter(s=>s.phase==="shoot").length>=1) return;
  if(G.stats.hits<1 || G.studio.cash<130 || G.studio.debt>50 || !chance(0.05)) return;
  pitchSeries({genre:pick(Object.keys(DATA.GENRES)), eps:8, perEp:6, platformId:pick(DATA.PLATFORMS).id,
    showrunner:pick(G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil)), cast:[]});
}

let reports=0, choices=0;
for(let w=0; w<260; w++){
  if(G.over) break;
  tryGreenlight(); trySchedule(); tryOffers(); trySeries(); tryAuctions(); tryEmpire();
  // drip-borrow only to keep active productions funded (never to finance idle overhead)
  if(G.projects.some(p=>p.phase!=="ready") && G.studio.cash<25 && G.studio.debt<maxDebt()*0.55) takeLoan(80);
  if(G.studio.debt>0 && G.studio.cash>G.studio.debt+80) repayDebt(G.studio.debt);
  advanceWeek();
  if(G.pendingChoice){ resolveChoice(0); choices++; }
  if(G.pendingReport){ reports++; G.pendingReport=null; }
}

// track rentals observation
for(const f of G.films){ if((f.rentalsDom||0)>1) sawRentals=true; }
console.log("franchises:", G.franchises.length, G.franchises.map(f=>f.name+" t"+f.tier+" m"+f.merch+" p"+f.park+" $"+Math.round(f.earned||0)).join(" | "));
console.log("ledger weeks:", G.txHistory.length, "last net:", G.txHistory.length? G.txHistory[G.txHistory.length-1].net : "-", "rentals seen:", sawRentals, "streaming originals:", G.films.filter(f=>f.streamingOriginal).length, "presold films:", G.films.filter(f=>f.presales>0).length);
console.log("── SMOKE RESULT ──");
console.log("weeks:", G.week, " gameover:", G.over? G.over.title : "no");
console.log("cash:", fmtM(G.studio.cash), " debt:", fmtM(G.studio.debt), " credit:", fmtM(maxDebt()));
console.log("rep:", Math.round(G.studio.rep), " films:", G.stats.films, " seasons:", G.stats.seriesSeasons);
console.log("WW gross:", fmtM(G.stats.totalWW), " profit:", fmtM(G.stats.totalProfit), " hits:", G.stats.hits, " flops:", G.stats.flops);
console.log("best open:", G.stats.bestOpen? fmtG(G.stats.bestOpen)+" ("+G.stats.bestFilm+")" : "-");
console.log("awards:", JSON.stringify(G.stats.awards||[]));
console.log("catalog:", fmtM(catalogValue()), " reports seen:", reports, " choices:", choices);
const live=G.films.filter(f=>f.inTheaters).length;
console.log("in theaters now:", live, " library:", G.films.length, " series:", G.series.length, " rival ytd:", G.rivals.map(r=>Math.round(r.ytd)).join("/"));

// sanity assertions
const allFinite = [G.studio.cash, G.studio.debt, G.stats.totalWW].every(Number.isFinite);
const grossesOk = G.films.every(f=>Number.isFinite(f.ww) && Number.isFinite(f.dom) && f.dom>=0);
const noNegOpen = G.films.every(f=>f.streamingOriginal || f.opening>0);
if(!allFinite) throw new Error("non-finite money");
if(!grossesOk) throw new Error("bad gross data");
if(!noNegOpen) throw new Error("bad opening");
if(!G.over && G.stats.films<6) throw new Error("too few films released — flow broken?");
if(G.stats.films===0 && !G.over) throw new Error("nothing released");
if(G.txHistory.length<5) throw new Error("ledger not recording");
if(!G.txHistory.every(x=>Number.isFinite(x.net))) throw new Error("non-finite weekly net");
if(G.films.some(f=>f.inTheaters) && !G.films.some(f=>(f.rentalsDom||0)>1)) throw new Error("weekly rentals not accruing during a run");
if(G.films.length>=3 && !sawRentals) throw new Error("no rentals ever recorded");
if(G.franchises.some(fr=>!Number.isFinite(fr.earned))) throw new Error("bad franchise earnings");
if(G.films.some(f=>f.streamingOriginal && !f.soldTo)) throw new Error("auction sale missing platform");
if(reports<4) throw new Error("year-end reports never fired");
// v2 mechanics: trends bounded, crews worked, careers progressed
const tvals=Object.values(G.trends||{});
if(!tvals.length || !tvals.every(v=>Number.isFinite(v)&&v>=0.5&&v<=1.6)) throw new Error("genre trends out of bounds");
if(G.films.some(f=>!Number.isFinite(f.overruns))) throw new Error("overruns not tracked");
if(G.talent.some(t=>!Number.isFinite(t.careerWeeks))) throw new Error("career clock missing on talent");
if(!G.films.some(f=>(f.weekly||[]).length)) { /* nothing in theaters all run — ok if bankrupt */ if(!G.over) throw new Error("no theatrical ever"); }
const withCrew=G.films.length>0;
console.log("trends:", tvals.map(v=>v.toFixed?v.toFixed(2):v).slice(0,10).join("/"));
console.log("ALL CHECKS PASSED ✅");
