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
  // Be more conservative: only 1 concurrent production if debt is high
  const maxProducing = G.studio.debt > maxDebt()*0.5 ? 1 : 2;
  if(producing>=maxProducing || !G.ideas.length) return;
  // play it like a real producer: match the slate to the bank account (cheapest viable first)
  const ideas = G.ideas.filter(i=>i.scale!=="tentpole" || G.studio.cash>400)
                       .sort((a,b)=>neededBudget(a.genre,a.scale)-neededBudget(b.genre,b.scale));
  const idea = ideas[0]; if(!idea) return;
  const dirs = G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil);
  const acts = G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil).sort((a,b)=>actorFee(a)-actorFee(b));
  if(!dirs.length || acts.length<1) return;
  const budget = neededBudget(idea.genre, idea.scale);
  const useStreamPlan = !didAuction && G.films.length>=1 && chance(0.5);
  const affordable = a => actorFee(a) <= budget*0.15; // stricter: 15% vs 18%
  const dir = pick(dirs.filter(affordable)) || pick(dirs.filter(d=>actorFee(d)<=budget*0.2));
  if(!dir) return;
  // v4: hire a writer and a producer when they're cheap enough
  const writer = pick(freeTalent("writer").filter(affordable)) || null;
  const producer = pick(freeTalent("producer").filter(affordable)) || null;
  const cast = [];
  const pool = acts.filter(affordable);
  for(let i=0;i<rint(1,2) && pool.length;i++){ const a=pool.splice(rint(0,pool.length-1),1)[0]; cast.push(a); } // max 2 cast
  const fees = actorFee(dir)+actorFee(writer)+actorFee(producer)+cast.reduce((s,c)=>s+actorFee(c),0);
  // Budget burns weekly over months — require viable cash buffer
  if(G.studio.cash < devCostOf(idea)+fees+budget*0.4+25) return;
  if(G.studio.debt > maxDebt()*0.75) return;
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
  // More aggressive loan taking: lower cash threshold, higher debt tolerance
  if(G.studio.cash<40 && G.studio.debt<maxDebt()*0.85) takeLoan(100);
  // Repay debt more aggressively when cash allows
  if(G.studio.debt>0 && G.studio.cash>80) repayDebt(Math.min(G.studio.debt, G.studio.cash-50));
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
// Inflation compounds once per year wrap (2%) plus cycle bumps; the game can
// end early (bankruptcy), so the floor scales with the number of wraps that
// actually ran instead of assuming the studio always reaches year 3.
const _econWraps = Math.max(0, yearOf(G.week)-1);
if(!(G.infl >= Math.pow(1.015, _econWraps))) throw new Error("market inflation never compounded over "+G.week+" weeks ("+_econWraps+" year wraps)");
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

// ── v16: game studio ──
if(!Array.isArray(DATA.GAME_DEVS) || DATA.GAME_DEVS.length!==3) throw new Error("game dev houses missing");
G.studio.cash=Math.max(G.studio.cash, 200);
if(!unlockGames()) throw new Error("game studio unlock failed");
const srcsV16=gameSources();
if(srcsV16.length){
  if(!startGameDev(srcsV16[0].key, "partner")) throw new Error("game dev failed to start");
  const prV16=G.gamesDiv.projects[0];
  const cashBefore=G.studio.cash;
  tickGameStudio();
  if(G.studio.cash>=cashBefore) throw new Error("game dev did not burn weekly");
  let guard16=0;
  while(G.gamesDiv.projects.length && guard16++<20) tickGameStudio();
  if(!G.gamesDiv.released.length) throw new Error("game never shipped");
  const g16=G.gamesDiv.released[0];
  if(!(g16.score>=5 && g16.score<=98 && g16.total>0 && g16.weekly>0)) throw new Error("bad game release data");
  console.log("v16 · game studio: “"+g16.title+"” scored "+g16.score+"/100, "+fmtM(g16.total)+" total (launch "+fmtM(g16.earned)+") · ok");
}else{
  console.log("v16 · game studio unlocked; no eligible sources this run · ok");
}

// ── v32 modular systems assertions ──
// 1. Seeded challenge & leaderboard
const dChlg = BOW_CHALLENGE.getDailyChallenge();
if(!dChlg.id || !dChlg.archetype) throw new Error("daily challenge generation failed");
const sc = BOW_CHALLENGE.calcScore(G);
if(!Number.isFinite(sc) || sc < 0) throw new Error("challenge score invalid");
const sCode = BOW_CHALLENGE.generateShareCode(G);
const verified = BOW_CHALLENGE.verifyShareCode(sCode);
if(!verified || verified.sc !== sc) throw new Error("share code verification failed");
console.log("v32 · seeded challenge ok (score " + sc + ", code " + sCode.slice(0, 16) + "...)");

// 2. Theater chain ownership
if(typeof BOW_THEATERS !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 400);
  G.studio.rep = Math.max(G.studio.rep, 60);
  if(!BOW_THEATERS.buyChain("starlite")) throw new Error("theater chain acquisition failed");
  if(!G.ownedChains.includes("starlite")) throw new Error("chain not recorded in ownedChains");
  const splitM = BOW_THEATERS.getExhibitionSplitMultiplier(G);
  if(splitM <= 1.0) throw new Error("exhibition split multiplier not applied");
  const conc = BOW_THEATERS.tickWeekly(G);
  if(!Number.isFinite(conc)) throw new Error("concession tick failed");
  console.log("v32 · theater chain ok (owned screens " + Math.round(G.exhibition.ownedScreenShare*100) + "%, split " + splitM.toFixed(2) + "x, concessions " + conc + "M)");
}

// 3. Dynamic soundtrack
if(typeof BOW_SOUNDTRACK !== "undefined"){
  const mood = BOW_SOUNDTRACK.evaluateMood(G);
  if(!mood) throw new Error("soundtrack mood evaluation failed");
  BOW_SOUNDTRACK.setMood("triumphant");
  console.log("v32 · dynamic soundtrack ok (evaluated mood: " + mood + ")");
}

// 4. Dynasty New Game+
if(typeof BOW_DYNASTY !== "undefined"){
  const inherit = BOW_DYNASTY.calcInheritance(G);
  if(!inherit || inherit.trustFund <= 0) throw new Error("inheritance calculation failed");
  console.log("v32 · dynasty legacy ok (gen " + inherit.generation + ", trust fund " + inherit.trustFund + "M)");
}

// 5. BOW Shorts
if(typeof BOW_SHORTS !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  if(!BOW_SHORTS.produceShort("teaser_skit", null, "Viral Teaser")) throw new Error("produce short failed");
  BOW_SHORTS.tickWeekly(G);
  console.log("v32 · bow shorts ok (active shorts " + G.shortsDivision.activeShorts.length + ", completed " + G.shortsDivision.completedShorts.length + ")");
}

// 6. Talent agency ownership
if(typeof BOW_AGENCY !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 150);
  G.studio.rep = Math.max(G.studio.rep, 50);
  if(!BOW_AGENCY.foundAgency("Smoke Agency")) throw new Error("founding talent agency failed");
  BOW_AGENCY.tickWeekly(G);
  console.log("v32 · talent agency ok (founded: " + G.myAgency.name + ", roster: " + G.myAgency.roster.length + ")");
}

// 7. Film restoration
if(typeof BOW_RESTORATION !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  if(G.films.length){
    const fId = G.films[0].id;
    if(BOW_RESTORATION.canRestore(fId, "remaster_4k")){
      if(!BOW_RESTORATION.startRestoration(fId, "remaster_4k")) throw new Error("start restoration failed");
      console.log("v32 · film restoration ok (started 4k remaster on film " + fId + ")");
    }
  }
}

// 8. Festival PR
if(typeof BOW_FESTIVAL_PR !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  if(G.films.length){
    if(!BOW_FESTIVAL_PR.submitFestival(G.films[0].id, "palais")) throw new Error("festival submission failed");
    console.log("v32 · festival circuit ok (submitted to Palais d'Or)");
  }
}

// 9. Intl currency & save-slot repair tool
if(typeof fmtIntlCurrency === "function"){
  const inr = fmtIntlCurrency(10, "INR");
  const eur = fmtIntlCurrency(10, "EUR");
  if(!inr.includes("₹") || !eur.includes("€")) throw new Error("intl currency formatting failed");
  // Test save slot repair tool on mock corrupt save
  global.localStorage.setItem("bow_save_test", JSON.stringify({ studio: { cash: "invalid", debt: -50, rep: 120 }, week: "nan" }));
  const repRes = repairSaveSlot("bow_save_test");
  if(!repRes.success) throw new Error("save-slot repair failed");
  const repaired = JSON.parse(global.localStorage.getItem("bow_save_test"));
  if(repaired.studio.cash !== 50 || repaired.studio.debt !== 0 || repaired.studio.rep !== 99) throw new Error("save repair sanitation failed");
  global.localStorage.removeItem("bow_save_test");
  console.log("v32 · intl currency (" + inr + ", " + eur + ") & save-slot repair tool ok");
}

// 10. Studio Facilities
if(typeof FacilitiesModule !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 100);
  const upRes = upgradeFacility("soundstage", G);
  if(!upRes.ok || G.facilities.soundstage.tier !== 1) throw new Error("facility upgrade failed: " + (upRes.error||""));
  const rentRes = toggleFacilityRental("soundstage", G);
  if(!rentRes.ok || !G.facilities.soundstage.rented) throw new Error("facility rental toggle failed");
  const facTick = tickFacilitiesWeekly(G);
  if(!Number.isFinite(facTick.net)) throw new Error("facilities weekly tick failed");
  console.log("v32 · studio facilities ok (soundstage T" + G.facilities.soundstage.tier + ", net " + facTick.net + "M/wk)");
}

// 11. TV Syndication
if(typeof SyndicationModule !== "undefined"){
  if(G.films.length){
    const f = G.films[0];
    const off = calculateSyndicationOffer(f, "matinee");
    if(off && off.eligible){
      const synRes = signSyndicationDeal(f.id, "matinee", G);
      if(!synRes.ok) throw new Error("syndication deal signing failed: " + (synRes.error||""));
      const synTick = tickSyndicationWeekly(G);
      if(!Number.isFinite(synTick.totalPayout)) throw new Error("syndication weekly tick failed");
      console.log("v32 · tv syndication ok (signed deal for \"" + f.title + "\", weekly payout " + synTick.totalPayout + "M)");
    }
  }
}

// 12. Talent Multi-Picture Contracts & Quirks
if(typeof TalentContractsModule !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  if(G.talent.length){
    const t = G.talent[0];
    const pactRes = signMultiPictureDeal(t.id, 3, G);
    if(!pactRes.ok) throw new Error("multi-picture contract failed: " + (pactRes.error||""));
    const consumed = consumeContractPicture(t.id, 999, G);
    if(!consumed) throw new Error("contract picture consume failed");
    console.log("v32 · talent contracts & quirks ok (signed 3-pic pact with " + t.name + ", 2 left)");
  }
}

// 13. Corporate Bond Market
if(typeof BondMarketModule !== "undefined"){
  const bRating = getStudioCreditRating(G);
  if(!bRating || !bRating.grade) throw new Error("credit rating calculation failed");
  const bRes = issueCorporateBond(25, 52, G);
  if(!bRes.ok) throw new Error("bond issue failed: " + (bRes.error||""));
  const bTick = tickBondsWeekly(G);
  if(!Number.isFinite(bTick.interestServiced)) throw new Error("bond weekly coupon tick failed");
  console.log("v32 · corporate bond market ok (grade " + bRating.grade + ", coupon " + bTick.interestServiced + "M/wk)");
}

// 14. Clash Analytics
if(typeof ClashAnalyticsModule !== "undefined"){
  const clashRes = analyzeReleaseCongestion(G.week + 4, "action", "tentpole", G);
  if(!clashRes || !clashRes.severity) throw new Error("clash analytics calculation failed");
  console.log("v32 · clash analytics ok (severity: " + clashRes.severity + ", net impact: " + clashRes.netImpactPercent + "%)");
}

// 15. Cinematic Universe
const smokeFilm = (G.films && G.films.length) ? G.films[0] : { id: 70, title: "Cyber Feature", budget: 150 };
if(!G.films) G.films = [];
if(!G.films.some(f => f.id === smokeFilm.id)) G.films.push(smokeFilm);

if(typeof CinematicUniverse !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  const uRes = CinematicUniverse.createCinematicUniverse("Cyber Dynasty", "scifi", G);
  if(!uRes.ok) throw new Error("create universe failed: " + (uRes.error || uRes.msg));
  CinematicUniverse.addFilmToUniverse(uRes.universe.id, smokeFilm, G);
  const uSyn = CinematicUniverse.calculateUniverseSynergy(uRes.universe.id, true, G);
  if(!uSyn || uSyn.buzzMultiplier < 1) throw new Error("universe synergy calculation failed");
  console.log("v32 · cinematic universe ok (created: Cyber Dynasty, crossover mult: " + uSyn.buzzMultiplier + "x)");
}

// 16. Location Scouting
if(typeof LocationScouting !== "undefined"){
  const locRes = LocationScouting.scoutLocationForProject(smokeFilm.id, "pinewood_uk", 100, G);
  if(!locRes.ok) throw new Error("location scouting failed: " + locRes.msg);
  console.log("v32 · location scouting ok (scouted: " + locRes.location.name + ", rebate: $" + locRes.taxRebateCash + "M)");
}

// 17. Production Insurance
if(typeof ProductionInsurance !== "undefined"){
  const insRes = ProductionInsurance.bindPolicy(smokeFilm.id, "overrun", 100, G);
  if(!insRes.ok) throw new Error("production insurance binding failed: " + (insRes.error || insRes.msg));
  const covRes = ProductionInsurance.claimGuarantor(smokeFilm.id, 20, G);
  if(!covRes.ok || covRes.coveredPayout <= 0) throw new Error("insurance claim coverage failed");
  console.log("v32 · production insurance ok (policy bound, absorbed overrun: $" + covRes.coveredPayout.toFixed(1) + "M)");
}

// 18. FYC Awards Campaign
if(typeof AwardsCampaign !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  const fycRes = AwardsCampaign.launchCampaign(smokeFilm.id, "trade_spread", "best_picture", G);
  if(!fycRes.ok) throw new Error("awards campaign failed: " + fycRes.msg);
  const lobScore = AwardsCampaign.getFilmAwardsLobbying(smokeFilm);
  if(lobScore < 10) throw new Error("awards lobbying score failed to buff film");
  console.log("v32 · fyc awards campaign ok (campaign launched, lobbying score: +" + lobScore + " pts)");
}

// 19. Board Directives & Governance
if(typeof BoardTargets !== "undefined"){
  const bTargets = BoardTargets.initBoardTargets(G);
  if(!bTargets || !bTargets.activeDirectives.length) throw new Error("board directives failed to initialize");
  BoardTargets.trackBoxOfficeRevenue(100, G);
  const qRev = BoardTargets.evaluateQuarterClose(G);
  if(!qRev || typeof qRev.confidence !== "number") throw new Error("board quarter evaluation failed");
  console.log("v32 · board directives ok (" + qRev.completedCount + "/" + qRev.totalCount + " met, confidence: " + qRev.confidence + "%)");
}

// 20. Fan Conventions & Club
if(typeof FanConventions !== "undefined"){
  FanConventions.initFanClub(G);
  FanConventions.setWeeklyBudget(0.1, G);
  const fcTick = FanConventions.advanceFanClubWeek(G);
  if(!fcTick || fcTick.totalFans <= 0) throw new Error("fan club weekly tick failed");
  G.studio.cash = Math.max(G.studio.cash, 50);
  const conRes = FanConventions.hostFanConvention("comic_con_hall_h", G);
  if(!conRes.ok) throw new Error("hosting fan convention failed: " + conRes.msg);
  console.log("v32 · fan conventions ok (hosted: Comic-Con Hall H, added: +" + conRes.data.addedFans + " fans)");
}

// 21. Test Screenings & Emergency Reshoots
if(typeof TestScreenings !== "undefined"){
  const mockFilm = { id: 9999, title: "Test Screening Feature", budget: 30, quality: 65, status: "post_production" };
  G.films.push(mockFilm);
  G.studio.cash = Math.max(G.studio.cash, 50);
  const tsRes = TestScreenings.conductTestScreening(9999, "focus_group", G);
  if(!tsRes.ok || !tsRes.result.projectedScore) throw new Error("test screening failed: " + tsRes.msg);
  const rsRes = TestScreenings.executeEmergencyReshoots(9999, G);
  if(!rsRes.ok || rsRes.newQuality <= 65) throw new Error("emergency reshoots failed to boost quality");
  console.log("v32 · test screenings & reshoots ok (projected: " + tsRes.result.projectedScore + ", post-reshoot quality: " + rsRes.newQuality + ")");
}

// 22. Studio Espionage Desk
if(typeof StudioEspionage !== "undefined"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  const spyRes = StudioEspionage.executeEspionageMission("infiltrate_slate", "Apex Pictures", G);
  if(!spyRes.ok && !spyRes.scandal) throw new Error("espionage mission failed");
  console.log("v32 · studio espionage ok (op completed, dossiers: " + (G.espionage.reports || []).length + ")");
}

// 23. Franchise Merchandise Licensing
if(typeof MerchLicensing !== "undefined"){
  const blockbusterFilm = { id: 8888, title: "Mega Blockbuster", budget: 80, gross: 120, ww: 120, quality: 85 };
  G.films.push(blockbusterFilm);
  const merchRes = MerchLicensing.signMerchLicensingDeal(8888, "toys_action_figures", G);
  if(!merchRes.ok) throw new Error("merchandise deal failed: " + merchRes.msg);
  const mTick = MerchLicensing.advanceMerchandiseWeek(G);
  if(mTick.totalRoyalty <= 0) throw new Error("merchandise royalty tick failed");
  console.log("v32 · merchandise licensing ok (advance: $" + merchRes.advanceCash + "M, weekly royalty: $" + (mTick.totalRoyalty * 1000).toFixed(0) + "k/wk)");
}

// 24. Crisis PR War Room (Box Office Inc parity)
if(typeof BOW_FESTIVAL_PR !== "undefined" && typeof BOW_FESTIVAL_PR.evaluateCrisisResolution === "function"){
  G.scandals = [{ headline: "Test Tabloid Leak", severity: 2 }];
  G.studio.cash = Math.max(G.studio.cash, 10);
  const crisisDrain = BOW_FESTIVAL_PR.calculateWeeklyReputationImpact(G);
  if(crisisDrain <= 0) throw new Error("crisis weekly impact calculation failed");
  if(!BOW_FESTIVAL_PR.evaluateCrisisResolution("PUBLIC_APOLOGY", 0, G)) throw new Error("crisis resolution failed");
  if(G.scandals.length !== 0) throw new Error("crisis scandal not cleared after resolution");
  console.log("v32.2 · crisis pr war room ok (damage drain: -" + crisisDrain + " pts/wk, public apology mitigated)");
}

// 25. International Territory Licensing (Box Office Inc parity)
if(typeof BOW_TERRITORIES !== "undefined"){
  const testFilm = { id: 7777, title: "Territory Test Feature", budget: 40, quality: { overall: 75 }, genre: "action" };
  G.films.push(testFilm);
  G.studio.cash = Math.max(G.studio.cash, 50);
  const offer = BOW_TERRITORIES.calculateTerritoryOffer(testFilm, "europe", "MINIMUM_GUARANTEE", G);
  if(!offer || offer.upfront <= 0) throw new Error("territory offer calculation failed");
  if(!BOW_TERRITORIES.signTerritoryDeal(7777, "europe", "MINIMUM_GUARANTEE", false, G)) throw new Error("territory deal sign failed");
  const roys = BOW_TERRITORIES.tickWeeklyRoyalties(testFilm, 10.0, G);
  if(roys <= 0) throw new Error("territory royalties tick failed");
  console.log("v32.2 · international territory licensing ok (europe MG: +$" + offer.upfront + "M upfront, weekly royalty: +$" + roys.toFixed(2) + "M)");
}

// 26. Talent Agency Packaging (Box Office Inc parity)
if(typeof BOW_AGENCY !== "undefined" && typeof BOW_AGENCY.signAgencyPackage === "function"){
  G.studio.cash = Math.max(G.studio.cash, 50);
  const tier = BOW_AGENCY.getAgencyTier("caa", G);
  if(!tier || !tier.tier) throw new Error("agency tier lookup failed");
  if(!BOW_AGENCY.signAgencyPackage("indie_breakout", null, G)) throw new Error("agency packaging deal failed");
  console.log("v32.2 · agency packaging ok (caa tier: " + tier.tier + ", indie breakout package signed)");
}

// 27. Custom Sandbox Creator & Holiday Calendar (Box Office Sim 2 parity)
if(typeof BOW_SANDBOX !== "undefined"){
  if(!BOW_SANDBOX.createCustomTalent({ name: "Johnny Cyber", kind: "actor", power: 5, skill: 90, favGenre: "scifi" }, G)) throw new Error("custom talent creation failed");
  if(!BOW_SANDBOX.createCustomRival({ name: "Quantum Studios", style: "tentpole", cash: 400 }, G)) throw new Error("custom rival creation failed");
  if(!BOW_SANDBOX.createCustomFranchise({ name: "Aero Squadron", genre: "action", lore: "Elite aerial dogfighters" }, G)) throw new Error("custom franchise creation failed");
  if(!BOW_SANDBOX.HOLIDAY_CORRIDORS.length) throw new Error("holiday corridors missing");
  console.log("v32.2 · custom sandbox & holiday corridors ok (talent, rival, franchise created, " + BOW_SANDBOX.HOLIDAY_CORRIDORS.length + " holiday corridors)");
}

// ── game-over path: insolvent studio is seized after 3 weeks ──
if(!G.over){
  G.sandbox=false; G.studio.cash=0; G.studio.debt=maxDebt()*2; G.weeksInDebt=2;
  advanceWeek();
}
if(!G.over || !/bankrupt/i.test(G.over.title)) throw new Error("insolvency did not end the game");
console.log("v5 · game over ok ("+G.over.title+")");

console.log("ALL CHECKS PASSED [OK]");
