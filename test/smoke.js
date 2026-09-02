/* Headless smoke test: loads data.js + engine.js, plays ~5 years with an AI, sanity-checks the
   economy — including v2/v3 systems (locations, ratings, rewrites, test screenings, festivals,
   execs, IPO, streamer, sports, spin-offs, IP market, output deals, achievements, windowing). */
"use strict";
const fs = require("fs"), vm = require("vm");
global.localStorage = { _s:{}, getItem(k){ return this._s[k]??null; }, setItem(k,v){ this._s[k]=v; }, removeItem(k){ delete this._s[k]; } };

const src = f => fs.readFileSync(__dirname+"/../"+f, "utf8");
vm.runInThisContext(src("data.js"), {filename:"data.js"});
vm.runInThisContext(src("engine.js"), {filename:"engine.js"});

newGame("producer", "Smoke Test Studios", {scenario:"standard", difficulty:"normal", slot:1});

let didAuction=false, didShop=false, didFranchiseTest=false, sawRentals=false;
let didStreamer=false, didSports=false, didExecs=false, didIPO=false, didIp=false, didSpinoff=false;
function tryAuctions(){
  if(G.pendingAuction){ if(G.pendingAuction.manual && !G.pendingAuction.countered) counterAuction(); acceptAuction(0); return; }
  if(G.sportsAuction){
    if(!didSports && G.sportsAuction.packs.length && G.studio.cash>200){ didSports=true; bidSports(0, 200); }
    skipSports(); return;
  }
  if(!didShop){
    const ready=G.projects.find(x=>x.phase==="ready" && !x.releaseWeek && !x.prebuyAccepted);
    if(ready && G.films.length>=2 && chance(0.5)){ shopToStreamers(ready.id); didShop=true; }
  }
}
function tryEmpire(){
  if(G.franchises.length && !didFranchiseTest){
    const fr=G.franchises[0];
    if(fr.tier>=1) upgradeMerch(fr.id);
    if(fr.tier>=2) buildPark(fr.id);
    sellGameRights(fr.id);
    brandCollab(fr.id);
    dtvSequel(fr.id);
    launchPublishing(fr.id);
    licenseOut(fr.id);
    if(!didSpinoff){ didSpinoff=true; startSpinoffIdea(fr); }
    didFranchiseTest=true;
  }
  if(G.franchises.length>=2 && !G.universeBonus && G.studio.cash>220) mergeUniverse(G.franchises[0].id, G.franchises[1].id);
}
function startSpinoffIdea(fr){
  // emulate what the UI does: build a spin-off project via greenlight
  const idea={ id:nid(), genre:DATA.GENRES[fr.genre]?fr.genre:"action", scale:"mid", title:"(spin-off)",
    blurb:"x", script:rint(55,78), hot:true, spinoffFr:fr, awareness:0 };
  const dirs=G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil);
  if(!dirs.length) return;
  greenlight({idea, director:pick(dirs), cast:[], budget:Math.round(neededBudget(idea.genre,"mid")*0.45), spinoffFr:fr});
}
function tryGreenlight(){
  const producing = G.projects.filter(p=>p.phase!=="ready").length;
  if(producing>=2 || !G.ideas.length) return;
  const idea = pick(G.ideas);
  const dirs = G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil);
  const acts = G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil);
  if(!dirs.length || acts.length<1) return;
  const budget = neededBudget(idea.genre, idea.scale);
  const useStreamPlan = !didAuction && G.films.length>=1 && chance(0.5);
  const affordable = a => actorFee(a) <= budget*0.18;
  const dir = pick(dirs.filter(affordable)) || pick(dirs.filter(d=>actorFee(d)<=budget*0.25));
  if(!dir) return;
  const cast = [];
  const pool = acts.filter(affordable);
  for(let i=0;i<rint(1,3) && pool.length;i++){ const a=pool.splice(rint(0,pool.length-1),1)[0]; cast.push(a); }
  const fees = actorFee(dir)+cast.reduce((s,c)=>s+actorFee(c),0);
  if(G.studio.cash < devCostOf(idea)+fees+budget*0.8+40) return;
  if(G.studio.debt > 60 && G.films.length<3) return;
  const cfg={idea, director:dir, cast, budget, presales:chance(0.3),
    rating: chance(0.3)? "R":"PG-13", location: pick(["home","atlanta","london"]), foreignLang: chance(0.1)};
  if(useStreamPlan){ cfg.plan="streaming"; didAuction=true; }
  greenlight(cfg);
}
function tryPolish(){
  // v2 rewrites in pre
  const pre=G.projects.find(p=>p.phase==="pre"&&!p.rewritten&&G.studio.cash>80);
  if(pre && chance(0.4)) rewriteScript(pre.id);
  // v2 test screenings + reshoots
  const ready=G.projects.find(p=>p.phase==="ready"&&!p.tested&&!p.releaseWeek&&!p.prebuyAccepted);
  if(ready) testScreening(ready.id);
  const weak=G.projects.find(p=>p.phase==="ready"&&!p.reshoot&&p.quality&&p.quality.overall<60&&G.studio.cash>60&&!p.releaseWeek);
  if(weak) reshootFilm(weak.id);
}
function trySchedule(){
  for(const p of readyProjects()){
    if(p.releaseWeek||p.prebuyAccepted) continue;
    let wk = G.week + rint(1, 10);
    p.marketing = recMarketing(p);
    p.imax = chance(0.3);
    p.window = pick([17,45,90]);
    p.pattern = chance(0.75)?"wide":"platform";
    p.rollout = chance(0.7)?"day":"staggered";
    p.soundtrack = chance(0.2);
    if(p.soundtrack && G.studio.cash>20) spend("marketing",5); else p.soundtrack=false;
    p.dayAndDate = !!(G.streamer && chance(0.2));
    p.releaseWeek = wk;
    G.studio.cash -= p.marketing*0.3;
    p.marketingPaid = p.marketing*0.3;
    playChicken(p, wk);
  }
}
function tryOffers(){
  for(const o of [...G.offers]){
    if(o.type==="output"){ acceptOffer(o); continue; }
    if(chance(0.75)) acceptOffer(o);
    else if(chance(0.5)) counterOffer(o);
  }
}
function trySeries(){
  if(G.series.filter(s=>s.phase==="shoot").length>=1) return;
  if(G.stats.hits<1 || G.studio.cash<130 || G.studio.debt>50 || !chance(0.05)) return;
  const genre = chance(0.25)? pick(["reality","documentary"]) : pick(Object.keys(DATA.GENRES));
  pitchSeries({genre, eps:8, perEp: genre==="reality"?3:6, platformId:pick(DATA.PLATFORMS).id,
    showrunner:pick(G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil)), cast:[],
    format: chance(0.3)?"limited":"ongoing"});
}
function tryStreamer(){
  if(!G.streamer && G.studio.rep>=40 && G.studio.cash>320 && G.studio.debt<80 && !didStreamer){
    didStreamer = launchStreamer("Smoke+");
  }
  if(G.streamer){
    const movable=G.films.find(f=>!f.soldTo&&!f.streamingOriginal&&!f.inTheaters&&!f.onOwnPlatform);
    if(movable && chance(0.2)) libraryMove(movable.id);
  }
}
function tryCorp(){
  if(!didExecs && G.studio.cash>150 && G.studio.debt<60 && G.week>30){
    didExecs=true; hireExec("cmo"); hireExec("casting"); hireExec("cfo");
  }
  if(!didIPO && G.studio.rep>=60 && G.week>60){ didIPO=doIPO(); }
  if(!didIp && G.ipMarket.length && G.studio.cash>100){ didIp=true; buyIp(G.ipMarket[0].id); }
  if(G.studio.cash<10 && G.mezz<100) takeMezz(50);
  if(G.mezz>0 && G.studio.cash>G.mezz+100) repayMezz(Math.round(G.mezz));
}
function tryLibrary(){
  const rr=G.films.find(canRerelease);
  if(rr && G.studio.cash>50 && chance(0.3)) rereleaseFilm(rr.id);
  const rb=G.films.find(canReboot);
  if(rb && chance(0.5)) rebootFilm(rb.id);
  const fyc=G.films.find(f=>f.year===yearOf(G.week)&&f.quality&&f.quality.critic>=60&&!f.fyc);
  if(fyc && woyOf(G.week)>=44 && G.studio.cash>30) fycFilm(fyc.id);
}

let reports=0, choices=0;
for(let w=0; w<260; w++){
  if(G.over) break;
  tryGreenlight(); tryPolish(); trySchedule(); tryOffers(); trySeries(); tryAuctions();
  tryEmpire(); tryStreamer(); tryCorp(); tryLibrary();
  if(G.pendingChoice){ resolveChoice(0); choices++; }
  if(G.studio.cash<25 && G.studio.debt<maxDebt()*0.55) takeLoan(80);
  if(G.studio.debt>0 && G.studio.cash>G.studio.debt+80) repayDebt(G.studio.debt);
  advanceWeek();
  if(G.pendingChoice){ resolveChoice(0); choices++; }
  if(G.pendingReport){ reports++; G.pendingReport=null; }
}

// track rentals observation
for(const f of G.films){ if((f.rentalsDom||0)>1) sawRentals=true; }
console.log("franchises:", G.franchises.length, G.franchises.map(f=>f.name+" t"+f.tier+" m"+f.merch+" p"+f.park+" $"+Math.round(f.earned||0)).join(" | "));
console.log("ledger weeks:", G.txHistory.length, "last net:", G.txHistory.length? G.txHistory[G.txHistory.length-1].net : "-", "rentals seen:", sawRentals, "streaming originals:", G.films.filter(f=>f.streamingOriginal).length, "presold films:", G.films.filter(f=>f.presales>0).length);
console.log("streamer:", G.streamer? G.streamer.name+" "+fmtSubs(G.streamer.subs)+" subs, "+fmtM(G.streamer.totalRev)+" lifetime, ceiling "+fmtSubs(streamerCeiling()) : "none", "sports held:", G.mySports.length, "sportsPower:", Math.round(G.sportsPower));
console.log("execs:", Object.keys(G.execs).join(",")||"none", "IPO:", G.ipo, "mezz:", fmtM(G.mezz), "outputDeal:", G.outputDeal, "wrapDeal:", G.wrapDeal);
console.log("achievements:", Object.keys(G.ach).join(",")||"none", "festWins:", G.festWins.length, "exhibRel:", Math.round(G.exhibRel));
console.log("── SMOKE RESULT ──");
console.log("weeks:", G.week, " gameover:", G.over? G.over.title : "no");
console.log("cash:", fmtM(G.studio.cash), " debt:", fmtM(G.studio.debt), " credit:", fmtM(maxDebt()));
console.log("rep:", Math.round(G.studio.rep), " films:", G.stats.films, " seasons:", G.stats.seriesSeasons);
console.log("WW gross:", fmtM(G.stats.totalWW), " profit:", fmtM(G.stats.totalProfit), " hits:", G.stats.hits, " flops:", G.stats.flops);
console.log("best open:", G.stats.bestOpen? fmtG(G.stats.bestOpen)+" ("+G.stats.bestFilm+")" : "-");
console.log("awards:", JSON.stringify(G.stats.awards||[]));
console.log("catalog:", fmtM(catalogValue()), " reports seen:", reports, "choices:", choices);
const live=G.films.filter(f=>f.inTheaters).length;
console.log("in theaters now:", live, " library:", G.films.length, " series:", G.series.length, " rival ytd:", G.rivals.map(r=>Math.round(r.ytd)).join("/"));
console.log("forecast sample:", cashflowForecast().slice(0,3).map(x=>dateLabel(x.w)+" "+(x.net>=0?"+":"")+fmtM(x.net)).join(" | "));

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
if(reports<4 && !G.over) throw new Error("year-end reports never fired");
// v2/v3 assertions
if(!G.ach || Object.keys(G.ach).length===0) throw new Error("achievements never unlocked");
if(!G.ipMarket.length) throw new Error("IP market empty");
if(G.streamer){
  if(!Number.isFinite(G.streamer.subs) || G.streamer.subs<=0) throw new Error("bad streamer subs");
  if(streamerCeiling()<=0) throw new Error("bad streamer ceiling");
}
if(!cashflowForecast().every(x=>Number.isFinite(x.net))) throw new Error("forecast broken");
if(!G.films.some(f=>f.pay1Done)) console.log("note: no pay-1 settlements observed this run");
if(!didStreamer) console.log("note: streamer never launched this run (rep/cash gated)");
console.log("ALL CHECKS PASSED ✅");
