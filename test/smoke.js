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
  // play it like a real producer: match the slate to the bank account (cheapest viable first)
  const ideas = G.ideas.filter(i=>i.scale!=="tentpole" || G.studio.cash>320)
                       .sort((a,b)=>neededBudget(a.genre,a.scale)-neededBudget(b.genre,b.scale));
  const idea = ideas[0]; if(!idea) return;
  const dirs = G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil);
  const acts = G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil).sort((a,b)=>actorFee(a)-actorFee(b));
  if(!dirs.length || acts.length<1) return;
  const budget = neededBudget(idea.genre, idea.scale);
  const useStreamPlan = !didAuction && G.films.length>=1 && chance(0.5);
  const affordable = a => actorFee(a) <= budget*0.18;
  const dir = pick(dirs.filter(affordable)) || pick(dirs.filter(d=>actorFee(d)<=budget*0.25));
  if(!dir) return;
  // v4: hire a writer and a producer when they're cheap enough
  const writer = pick(freeTalent("writer").filter(affordable)) || null;
  const producer = pick(freeTalent("producer").filter(affordable)) || null;
  const cast = [];
  const pool = acts.filter(affordable);
  for(let i=0;i<rint(1,3) && pool.length;i++){ const a=pool.splice(rint(0,pool.length-1),1)[0]; cast.push(a); }
  const fees = actorFee(dir)+actorFee(writer)+actorFee(producer)+cast.reduce((s,c)=>s+actorFee(c),0);
  // the budget burns weekly over months — you don't need all of it on day one
  if(G.studio.cash < devCostOf(idea)+fees+budget*0.5+25) return;
  if(G.studio.debt > maxDebt()*0.7) return;
  const cfg={idea, director:dir, writer, producer, cast, budget, presales:chance(0.3)};
  if(useStreamPlan){ cfg.plan="streaming"; didAuction=true; }
  greenlight(cfg);
}

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

let reports=0, choices=0, sawEarnings=0;
function tryEmpireFinance(){
  if(!G.public && G.studio.rep>=60) goPublic();
  if(G.public && G.pendingEarnings){ sawEarnings++; G.pendingEarnings=null; }
  if(!G.streamer && G.studio.rep>=40 && G.studio.cash>400) launchStreamer();
  if(G.streamer && G.streamer.tier==="premium" && G.studio.cash>250 && G.week>120) setStreamerTier("ads");
  if(G.pendingSports) passSports();
}
for(let w=0; w<260; w++){
  if(G.over) break;
  tryGreenlight(); trySchedule(); tryOffers(); trySeries(); tryAuctions(); tryEmpire(); tryEmpireFinance();
  if(G.studio.cash<25 && G.studio.debt<maxDebt()*0.7) takeLoan(80);
  if(G.studio.debt>0 && G.studio.cash>Math.max(G.studio.debt+60, 240)) repayDebt(Math.min(G.studio.debt, G.studio.cash-120));
  for(const o of [...(G.maOffers||[])]){ if(G.studio.cash>o.price+180 && chance(0.5)) maBuy(o.id); } // v5 M&A
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
// ── v4 checks ──
const withWriter = G.films.filter(f=>f.writer).length;
const withProd   = G.films.filter(f=>f.producer).length;
const reviewed   = G.films.filter(f=>(f.reviews||[]).length>=3).length;
const trendVals  = Object.keys(DATA.GENRES).map(g=>trendOf(g));
console.log("v4 · films w/ writer:", withWriter, " w/ producer:", withProd, " reviewed:", reviewed,
            " overruns:", G.films.filter(f=>(f.overrun||0)>0).length);
console.log("v4 · trends:", Object.keys(DATA.GENRES).map(g=>g+" "+trendOf(g).toFixed(2)).join(" "));
console.log("v4 · retired:", (G.retired||[]).length, " scandals live:", G.talent.filter(t=>t.scandal>0).length,
            " achievements:", (G.achv||[]).length);
console.log("v4 · public:", G.public? ("$"+G.public.price.toFixed(2)+" · cap "+fmtM(marketCap())+" · "+G.public.rating) : "private",
            " earnings calls:", sawEarnings, " streamer:", G.streamer? (G.streamer.subs.toFixed(1)+"M subs · "+G.streamer.tier) : "none");
console.log("v4 · fatigue:", G.franchises.map(f=>f.name+" "+Math.round((f.fatigue||0)*100)+"%").join(" | ")||"-");

if(!trendVals.every(v=>Number.isFinite(v) && v>=0.7 && v<=1.35)) throw new Error("genre trend out of range");
if(reviewed===0 && G.films.length>2) throw new Error("critics never reviewed anything");
if(!G.films.every(f=>!f.reviews || f.reviews.every(r=>Number.isFinite(r.score)))) throw new Error("bad review score");
if(!G.talent.every(t=>Number.isFinite(t.age) && t.age>0)) throw new Error("talent missing age");
if(G.franchises.some(fr=>!Number.isFinite(fr.fatigue))) throw new Error("bad franchise fatigue");
if(G.public && !Number.isFinite(G.public.price)) throw new Error("bad share price");
if(G.streamer && !Number.isFinite(G.streamer.subs)) throw new Error("bad sub count");

// ── save schema: round-trip, migration from legacy v1, corruption rejection ──
saveGame();
const raw = localStorage.getItem("bow_save");
if(!raw) throw new Error("save never written");
const parsed = JSON.parse(raw);
if(parsed.v !== DATA.SAVE_VERSION) throw new Error("save not stamped with schema version");
if(validateSave(parsed).length) throw new Error("freshly written save fails validation");

const legacy = JSON.parse(raw);
legacy.v = 1;
delete legacy.trends; delete legacy.retired; delete legacy.achv;
legacy.talent.forEach(t=>{ delete t.age; delete t.scandal; });
(legacy.franchises||[]).forEach(f=>{ delete f.fatigue; });
if(legacy.streamer){ delete legacy.streamer.tier; }
if(legacy.public){ delete legacy.public.price; }
const mig = migrateSave(legacy);
if(mig.save.v !== DATA.SAVE_VERSION) throw new Error("migration did not reach current version");
if(!mig.save.trends || !Number.isFinite(mig.save.trends.action)) throw new Error("migration did not seed trends");
if(!mig.save.talent.every(t=>Number.isFinite(t.age))) throw new Error("migration did not backfill talent ages");
if(mig.save.streamer && mig.save.streamer.tier!=="premium") throw new Error("migration did not default the streamer tier");
if(mig.save.public && !Number.isFinite(mig.save.public.price)) throw new Error("migration did not seed the share price");
console.log("v4 · save schema v"+parsed.v+" ok · legacy v1 migrated via steps ["+mig.applied.join(",")+"]");

const badProblems = validateSave({ studio:{cash:"lots"}, week:0 });
if(!badProblems.length) throw new Error("validator accepted a corrupt save");
localStorage.setItem("bow_save", "{not json");
if(loadGame()!==null) throw new Error("loadGame accepted broken JSON");
console.log("v4 · corrupt saves rejected ("+badProblems.length+" problems flagged)");

// ── export / import round-trip (settings codes) ──
const code = exportCode();
if(!code || code.length<100) throw new Error("export code empty");
const keepName = G.studio.name, keepCash = G.studio.cash;
newGame("producer", "Scratch Import Studios");
if(!importCode(code)) throw new Error("importCode rejected a fresh export");
if(G.studio.name!==keepName) throw new Error("import did not restore studio name");
if(G.studio.cash!==keepCash) throw new Error("import did not restore cash");
if(importCode("!!!not-a-code!!!")) throw new Error("importCode accepted garbage");
console.log("v5 · export/import round-trip ok · garbage rejected");

// ── multi-year economy drift: inflation, wages, meters ──
if(!(G.infl>1.05)) throw new Error("market inflation never compounded over "+G.week+" weeks");
if(!(G.wageInfl>=G.infl)) throw new Error("wage inflation did not track market inflation");
if(!Number.isFinite(G.piracy) || !Number.isFinite(G.unionMeter)) throw new Error("piracy/union meters non-finite");
console.log("v5 · "+yearOf(G.week)+"y drift ok · infl "+G.infl.toFixed(3)+" · wage "+G.wageInfl.toFixed(3));

// ── forecast regression (perf-area): finite nets, no throw ──
for(const fc of [forecastProject(), cashflowForecast()]){
  const rows = fc.rows||fc;
  if(!rows.length) throw new Error("forecast empty");
  if(!rows.every(r=>Number.isFinite(r.net))) throw new Error("forecast has non-finite net");
}
console.log("v5 · forecasts finite");

// ── game-over path: insolvent studio is seized after 3 weeks ──
if(!G.over){
  G.sandbox=false; G.studio.cash=0; G.studio.debt=maxDebt()*2; G.weeksInDebt=2;
  advanceWeek();
}
if(!G.over || !/bankrupt/i.test(G.over.title)) throw new Error("insolvency did not end the game");
console.log("v5 · game over ok ("+G.over.title+")");

console.log("ALL CHECKS PASSED ✅");
