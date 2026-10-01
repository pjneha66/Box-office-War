/* Smoke test driver — runs with data.js + engine.js loaded ahead of it in one
   shared scope (assembled by smoke.js). All game functions are in scope. */

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

function tryFilmPitch(){
  if(G.projects.filter(p=>p.phase!=="ready").length>=2) return;
  if(G.studio.cash<50 || G.studio.debt>maxDebt()*0.5 || !chance(0.03)) return;
  const dirs = G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil);
  const writers = G.talent.filter(t=>t.kind==="writer"&&!t.bookedUntil);
  const producers = G.talent.filter(t=>t.kind==="producer"&&!t.bookedUntil);
  const actors = G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil);
  if(!dirs.length || !writers.length || !producers.length || actors.length<2) return;
  const genre = pick(Object.keys(DATA.GENRES));
  const scale = pick(["indie","mid"]);
  const budget = Math.round(neededBudget(genre, scale));
  pitchFilm({
    genre, scale, budget,
    rating: pick(["PG-13","R"]),
    location: pick(DATA.LOCATIONS.map(l=>l.id)),
    director: pick(dirs),
    writer: pick(writers),
    producer: pick(producers),
    cast: [pick(actors), pick(actors)],
  });
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
  tryGreenlight(); trySchedule(); tryOffers(); trySeries(); tryFilmPitch(); tryAuctions(); tryEmpire(); tryEmpireFinance();
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
if(!G.over && reports<4) throw new Error("year-end reports never fired");
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
console.log("v6 · film pitches tried:", G.films.filter(f=>f.pitch).length, " projects from pitch:", G.projects.filter(p=>p.pitch).length);
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
if(!mig.save.chains || mig.save.chains.length!==5) throw new Error("migration did not seed theater chains");
if(!mig.save.projects.every(p=>Number.isFinite(p.promoOwed))) throw new Error("migration did not backfill promo obligations");
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

// ── v12: box office depth — chains, daily split, screens, advance curve, localization ──
if(!Array.isArray(G.chains) || G.chains.length!==5) throw new Error("theater chains not initialized");
G.studio.cash=Math.max(G.studio.cash, 100);
const chain0=G.chains[0], relBefore=chain0.rel;
if(!courtChain(chain0.id)) throw new Error("courtChain failed");
if(!(chain0.rel>relBefore)) throw new Error("courtChain did not warm the chain");
const probe=G.films.find(f=>f.inTheaters) || G.films.filter(f=>f.opening>0).slice(-1)[0];
if(!probe || !probe.opening) throw new Error("no released film for depth checks");
const daily=weekendDaily(probe);
if(Math.round(daily.reduce((a,d)=>a+d.gross,0)*10)/10!==Math.round((probe.opening||0)*10)/10) throw new Error("daily split does not re-sum to opening");
if(JSON.stringify(weekendDaily(probe))!==JSON.stringify(daily)) throw new Error("daily split is not deterministic");
const wkRows=screenWeeks(probe);
if(wkRows.length!==(probe.weekly||[]).length) throw new Error("screen weeks row mismatch");
if(!wkRows.every(r=>r.screens>0 && Number.isFinite(r.psa) && r.occ>=2 && r.occ<=98)) throw new Error("bad screen/occupancy row");
if(wkRows.length>1 && wkRows[0].wow!==null) throw new Error("opening week should not have a WoW%");
const cities=cityRows(probe);
if(!cities.length || !cities.every(cr=>Math.round(cr.cities.reduce((a,c)=>a+c.gross,0)*10)/10===Math.round(cr.region.gross*10)/10)) throw new Error("city split does not re-sum to region");
const dated=G.projects.find(p=>p.kind==="film" && p.phase==="ready" && p.releaseWeek>G.week);
if(dated){
  dated.marketing=Math.max(dated.marketing||recMarketing(dated), 20);   // a real P&A so the pace clears the skip threshold
  dated.awareness=Math.max(dated.awareness||0, 0.8);
  const advBefore=dated.advanceTotal||0;
  tickAdvances();
  if(!((dated.advanceTotal||0)>advBefore)) throw new Error("advance sales did not accrue");
}
if(!(localizationCost({budget:100, foreignLang:false, rollout:"day"}, ["europe"])>0)) throw new Error("localization cost empty");
if(localizationCost({budget:100, foreignLang:true, rollout:"day"}, "auto")>=localizationCost({budget:100, foreignLang:false, rollout:"day"}, "auto")) throw new Error("foreign-language productions should print for less");
console.log("v12 · chains "+G.chains.length+" (meridian rel "+Math.round(G.chains[0].rel)+") · daily split re-sums · "+wkRows.length+
            " wk rows · PSA wk1 $"+(wkRows[0]&&wkRows[0].psa||0)+"K · advance "+(dated?fmtM(dated.advanceTotal||0):"—")+" · cities ok");

// ── v13: campaign sequence, promo obligations, trending board ──
if(!Array.isArray(DATA.SOCIALS) || DATA.SOCIALS.length!==4) throw new Error("social platforms missing");
if(!Array.isArray(campaignDef("teaser").drop) || !campaignDef("teaser").drop.length) throw new Error("campaign drop offsets missing");
const datedV13=G.projects.find(p=>p.kind==="film" && p.phase==="ready" && p.releaseWeek>G.week);
if(datedV13){
  datedV13.campaigns=["teaser","trailer","social"];
  datedV13.releaseWeek=Math.min(datedV13.releaseWeek, G.week+2);   // close enough that the drops fire
  datedV13.promoOwed=Math.max(datedV13.promoOwed||0, 2);
  const buzzBefore=datedV13.buzzBonus||0;
  tickCampaignDrops();
  tickPromos();
  if(!Object.keys(datedV13.dropped||{}).length) throw new Error("campaign drops never fired");
  if(!((datedV13.promoDone||0)>0)) throw new Error("promo appearances never fired");
  if(!((datedV13.buzzBonus||0)>=buzzBefore)) throw new Error("drops/promos reduced buzz unexpectedly");
}
const board=trendingBoard();
if(!Array.isArray(board) || board.length>6) throw new Error("trending board malformed");
if(board.some(t=>!t.tag||!t.plat||!t.why)) throw new Error("trending tag missing fields");
console.log("v13 · "+board.length+" trending ("+board.slice(0,2).map(t=>t.tag).join(", ")+") · promo "+
            (datedV13?((datedV13.promoDone||0)+"/"+datedV13.promoOwed):"—")+" · drops "+(datedV13?Object.keys(datedV13.dropped||{}).length:0)+" · ok");

// ── v14: board, exec careers, staff levels, espionage, legal, label, what-if, hall ──
if(!Array.isArray(G.board) || G.board.length!==3) throw new Error("board not initialized");
const vote=boardVote({quality:{overall:70}, budget:150});
if(!vote || !Array.isArray(vote.votes) || vote.votes.length!==3) throw new Error("board vote malformed");
if(!Array.isArray(DATA.ARTISTS) || DATA.ARTISTS.length!==6) throw new Error("label roster missing");
G.studio.cash=Math.max(G.studio.cash, 500);
if(!unlockLabel()) throw new Error("label unlock failed");
if(!signArtist(DATA.ARTISTS[0].id)) throw new Error("artist sign failed");
if(!((G.label.artists||[]).length===1)) throw new Error("label roster empty after signing");
if(!G.execs.cmo && hireExec("cmo") && typeof G.execs.cmo!=="object") throw new Error("exec hire did not create a career object");
if(typeof G.seed!=="string" || G.seed.length<4) throw new Error("run seed missing");
if(!buyIntel(G.rivals[0].name)) throw new Error("intel purchase failed");
if(!(G.intel && G.intel.until>G.week)) throw new Error("intel not active after purchase");
saveGame();
const savedBefore=localStorage.getItem("bow_save");
const wl=whatIf("plan", 8);
if(!wl.ok) throw new Error("what-if fork failed: "+(wl.err||""));
const wh=whatIf("hype", 8);
if(!wh.ok) throw new Error("what-if hype fork failed: "+(wh.err||""));
if(localStorage.getItem("bow_save")!==savedBefore) throw new Error("what-if fork wrote over the real save");
const hall=hallOfFameData();
if(!hall || !hall.records || typeof hall.seed!=="string" || !Array.isArray(hall.hall)) throw new Error("hall of fame data malformed");
console.log("v14 · board "+Math.round((G.board||[]).reduce((a,m)=>a+m.approval,0)/3)+"/100 · exec "+(G.execs.cmo?("Lv"+levelOf(G.execs.cmo)):"—")+
            " · label "+(G.label.artists||[]).length+" act · intel "+(G.intel?G.intel.name:"—")+
            " · fork ok (plan "+fmtM(wl.cash)+" / hype "+fmtM(wh.cash)+") · seed "+G.seed);

// ── v15: fan mail + foldable sections ──
if(!Array.isArray(DATA.FAN_NAMES) || DATA.FAN_NAMES.length<10) throw new Error("fan names missing");
tickFanMail();
if(!Array.isArray(G.mail)) throw new Error("mailbox not initialized");
const mailBefore=G.mail.length;
tickFanMail();
if(G.mail.length<mailBefore) throw new Error("mailbox shrank");
if(G.mail.length>30) throw new Error("mailbox unbounded");
if(G.mail.some(m=>!m.kind||!m.from||!m.text)) throw new Error("malformed letter");
if(typeof unreadMail()!=="number" || unreadMail()<0) throw new Error("unread count broken");
markMailRead();
if(unreadMail()!==0) throw new Error("markMailRead left unread letters");
console.log("v15 · mail "+G.mail.length+" letters ("+unreadMail()+" unread after read-all) · kinds "+
            [...new Set(G.mail.map(m=>m.kind))].join("/")+" · ok");

// ── game-over path: insolvent studio is seized after 3 weeks ──
if(!G.over){
  G.sandbox=false; G.studio.cash=0; G.studio.debt=maxDebt()*2; G.weeksInDebt=2;
  advanceWeek();
}
if(!G.over || !/bankrupt/i.test(G.over.title)) throw new Error("insolvency did not end the game");
console.log("v5 · game over ok ("+G.over.title+")");

console.log("ALL CHECKS PASSED ✅");
