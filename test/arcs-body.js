/* Scenario-arc driver — runs with data.js + engine.js ahead of it in one shared
   scope (assembled by arcs.js). Six played careers, ~160 weeks each:

     1. blockbuster  — swing for tentpoles, heavy P&A, expects big gross
     2. flop         — cheap rushed pictures, expects losses but a survivable run
     3. debt         — borrow hard, expects the bank to push back (or bankruptcy)
     4. spree        — maximum concurrent production, expects cash stress
     5. franchise    — chase hits, then sequels + merch + parks
     6. streamer     — rep 40 + $250M, launch a platform and feed it

   Every arc asserts the same invariants (no NaN/Infinity anywhere the player can
   see, save round-trip intact) and reports one line of outcome.

   NOTE: the engine uses Math.random() throughout and G.seed is only a label, so
   these arcs are NOT deterministic — which career survives varies run to run.
   That's deliberate: this harness exists to prove the six careers run to
   completion without bad values, not to pin a balance number. The invariants are
   the assertion; the summary table is evidence, not a spec. */

const ARCS = [];
let arcFails = 0;
function check(label, cond, detail){
  if(!cond){ arcFails++; console.log("  ✗ "+label+(detail? " — "+detail : "")); }
  else console.log("  ✓ "+label);
}
function finite(v){ return Number.isFinite(v); }

/* ── shared policy helpers ───────────────────────────────────────────── */
/* Total money the studio could put on the table right now: cash plus whatever
   headroom is left on the credit line. A film only burns ~half its budget up
   front, so this is the right bar for "can I afford to start this?". */
function buyingPower(){
  let head=0; try{ head=Math.max(0, maxDebt()-(G.studio.debt||0)); }catch(e){}
  return (G.studio.cash||0) + head;
}
/* Everything the studio pays out every week whether or not anything opens:
   overhead, interest, and the weekly burn of shoots in progress. A real player
   keeps a runway in the bank before starting another picture — without this the
   arcs over-commit and go bankrupt in their first year. */
function weeklyBurn(){
  let b=0;
  try{ b += weeklyOverhead(); }catch(e){}
  try{ b += (G.studio.debt||0)*interestRate() + (G.studio.mezzDebt||0)*0.005; }catch(e){}
  try{
    for(const p of (G.projects||[])){
      if(p.phase==="ready") continue;
      const weeks=Math.max(1, (p.phaseLen? (p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post) : 12));
      b += Math.max(0,(p.budget||0)-(p.spent||0))/weeks;
    }
  }catch(e){}
  return Math.round(b*100)/100;
}
function freeOf(kind){ return (G.talent||[]).filter(t=>t.kind===kind && !t.bookedUntil); }
function tryHire(policy){
  const producing=(G.projects||[]).filter(p=>p.phase!=="ready").length;
  if(producing >= (policy.maxConcurrent||2)) return false;
  // don't stack a new shoot on top of an undated finished film
  const waiting=(G.projects||[]).filter(p=>p.phase==="ready" && !p.releaseWeek).length;
  if(waiting >= 1) return false;
  const ideas=(G.ideas||[]).slice();
  if(!ideas.length) return false;
  const cost=i=>Math.round(neededBudget(i.genre, i.scale) * (policy.budgetMult||1));
  const runway=weeklyBurn() * (policy.runwayWeeks||14);
  /* Approximate the up-front a pitch needs: development + half the budget +
     ~12% in fees. A candidate is only considered if the studio can start it AND
     still pay the bills for the runway window — the same bar the real check
     below applies, so the policy never picks something it can't fund. */
  const upfrontFor=i=> devCostOf(i) + cost(i)*0.62;
  const fits=i=> (upfrontFor(i) + runway) <= buyingPower()*(policy.spendCap||0.55);
  ideas.sort((a,b)=> policy.preferBig? cost(b)-cost(a) : cost(a)-cost(b));
  let idea=ideas.find(fits);
  /* A studio that can't afford its preferred size doesn't sit idle and bleed
     overhead — it makes something cheaper. Without this fallback the ambitious
     arcs greenlight nothing and go bankrupt on overhead alone. */
  let fallback=false;
  if(!idea){
    const cheapest=ideas.slice().sort((a,b)=>cost(a)-cost(b));
    idea=cheapest.find(i=> (upfrontFor(i) + runway) <= buyingPower()*0.8);
    fallback=!!idea;
  }
  if(!idea) return false;
  // never start a picture that leaves less than a couple of weeks of bills in the bank
  if(!fallback && G.studio.cash < runway*3) return false;
  if(fallback && G.studio.cash < runway*1.5) return false;
  const dirs=freeOf("director"), acts=freeOf("actor");
  if(!dirs.length || acts.length<1) return false;
  const budget=cost(idea);
  const byFee=(a,b)=> policy.cheapestCrew? actorFee(a)-actorFee(b) : actorFee(b)-actorFee(a);
  const dir=dirs.slice().sort(byFee)[0];
  const writer=freeOf("writer").slice().sort(byFee)[0] || null;
  const producer=policy.cheapestCrew? null : (freeOf("producer").slice().sort(byFee)[0] || null);
  const cast=[];
  const pool=acts.slice().sort(byFee);
  for(let i=0;i<Math.min(policy.castSize||2, pool.length);i++) cast.push(pool[i]);
  const fees=actorFee(dir)+actorFee(writer)+actorFee(producer)+cast.reduce((s,c)=>s+actorFee(c),0);
  const upfront=devCostOf(idea)+fees+budget*0.5;
  if(upfront + runway*0.6 > buyingPower()) return false;
  // borrow only to top up the war chest, never to fund the whole picture
  if(G.studio.cash < upfront + runway*0.5 && policy.borrowWhenBroke && G.studio.debt < maxDebt()*(policy.maxDebtRatio||0.6)){
    const need=Math.ceil((upfront + runway - G.studio.cash)/10)*10;
    if(need>0) takeLoan(Math.min(need, Math.max(0, maxDebt()-(G.studio.debt||0))));
  }
  if(G.studio.cash < upfront + runway*0.3) return false;
  /* NOTE: greenlight() returns the project itself (not an {ok} envelope) —
     pitchFilm() is the one that returns {ok, ev, project}. Accept both. */
  const res=greenlight({idea, director:dir, writer, producer, cast, budget, presales:chance(0.3), rating:policy.rating||"PG-13"});
  return !!(res && (res.ok===true || res.id || res.project));
}
function tryDate(){
  for(const p of readyProjects()){
    if(p.releaseWeek) continue;
    p.marketing = Math.round(recMarketing(p) * (p._mktMult||1));
    p.releaseWeek = G.week + rint(1, 8);
    const up = p.marketing*0.3;
    G.studio.cash -= up; p.marketingPaid = up;
  }
}
function handleDecisions(){
  if(G.pendingChoice && G.pendingChoice.choices) resolveChoice(0);
  if(G.pendingReport) G.pendingReport=null;
  if(G.pendingEarnings) G.pendingEarnings=null;
  if(G.pendingAuction && !G.pendingAuction.manual) G.pendingAuction=null;
  if(G.pendingSports) passSports();
  if(G.pendingDeepfake) resolveDeepfake(true);
  for(const o of [...(G.offers||[])]){ if(chance(0.7)) acceptOffer(o); }
}
function runArc(name, opts, policy, weeks){
  console.log("\n── ARC: "+name+" ──");
  newGame(opts.archetype||"producer", opts.studio||name, opts.meta||{});
  let peakDebt=0, minCash=Infinity, badWeek=null;
  for(let w=0; w<weeks; w++){
    if(G.over) break;
    tryHire(policy);
    if(policy.repPush) G.studio.rep = Math.min(95, G.studio.rep);
    tryDate();
    handleDecisions();
    if(policy.borrowWhenBroke && G.studio.cash<30 && G.studio.debt<maxDebt()*0.85) takeLoan(Math.round(maxDebt()*0.3));
    if(policy.repay && G.studio.debt>0 && G.studio.cash>80) repayDebt(Math.min(G.studio.debt, G.studio.cash-50));
    if(policy.empire) tryEmpire(policy);
    if(policy.streamer) tryStreamer();
    advanceWeek();
    peakDebt=Math.max(peakDebt, G.studio.debt||0);
    minCash=Math.min(minCash, G.studio.cash||0);
    if(!finite(G.studio.cash) || !finite(G.stats.totalWW)){ badWeek=G.week; break; }
  }
  const out={
    weeks:G.week, bankrupt:!!G.over, cash:Math.round(G.studio.cash*10)/10, debt:Math.round((G.studio.debt||0)*10)/10,
    peakDebt:Math.round(peakDebt*10)/10, minCash:Math.round(minCash*10)/10,
    rep:Math.round(G.studio.rep), films:G.stats.films, ww:Math.round(G.stats.totalWW*10)/10,
    profit:Math.round(G.stats.totalProfit*10)/10, hits:G.stats.hits, flops:G.stats.flops,
    franchises:(G.franchises||[]).length, subs:G.streamer? G.streamer.subs : 0
  };
  console.log("  weeks "+out.weeks+" · cash "+fmtM(out.cash)+" · peak debt "+fmtM(out.peakDebt)+
    " · min cash "+fmtM(out.minCash)+" · rep "+out.rep+" · "+out.films+" films · WW "+fmtM(out.ww)+
    " · hits "+out.hits+"/flops "+out.flops+(out.franchises? " · "+out.franchises+" franchises":"")+
    (out.subs? " · "+fmtSubs(out.subs)+" subs":"")+(out.bankrupt? " · BANKRUPT":""));
  check("no NaN week", badWeek===null, badWeek? "week "+badWeek : "");
  check("cash finite", finite(G.studio.cash));
  check("gross finite", finite(G.stats.totalWW));
  check("save round-trip", (()=>{
    const code=exportCode();
    if(!code) return false;
    return importCode(code) === true;
  })());
  check("no negative debt", (G.studio.debt||0) >= 0, "debt "+(G.studio.debt||0));
  ARCS.push({name, out});
  return out;
}
function tryEmpire(policy){
  for(const fr of (G.franchises||[]).slice(0,4)){
    if(G.studio.cash<150) break;   // don't strip-mine the war chest
    if(fr.tier>=1 && (fr.merch||0)<3 && G.studio.cash>90) upgradeMerch(fr.id);
    if(fr.tier>=2 && (fr.park||0)<2 && G.studio.cash>260) buildPark(fr.id);
    if(fr.gameSold!==fr.tier && G.studio.cash>120) sellGameRights(fr.id);
    if(!fr.publishing && G.studio.cash>150) launchPublishing(fr.id);
    if(!fr.comics && G.studio.cash>120) releaseComic(fr.id);
    if(!fr.podcast && G.studio.cash>110) launchPodcast(fr.id);
  }
  if(policy.store && storeLevel()<4){
    const nd=nextStoreDef();
    if(nd && G.studio.cash > nd.cost*4) buildStore();
  }
}
function tryStreamer(){
  if(!G.streamer){
    // launching costs $140M — require $140M + 12 weeks of burn
    const reserve = 140 + weeklyBurn()*12;
    if(G.studio.rep>=35 && G.studio.cash>reserve) launchStreamer();
    return;
  }
  // feed the platform: move finished films across
  const movable=(G.films||[]).filter(f=>!f.soldTo&&!f.streamingOriginal&&!f.inTheaters&&!f.onOwnPlatform&&!f.onOwn);
  if(movable.length) moveToStreamer(movable[0].id);
  if(!G.streamer.tier || G.streamer.tier==="premium"){ if(G.studio.cash>200) setStreamerTier("ads"); }
}

/* ── 1. blockbuster ──────────────────────────────────────────────────── */
runArc("blockbuster", {archetype:"producer", studio:"Tentpole Pictures"}, {
  preferBig:true, spendCap:0.35, budgetMult:1.0, maxConcurrent:1, castSize:3, runwayWeeks:18,
  borrowWhenBroke:true, maxDebtRatio:0.5, repay:true, rating:"PG-13"
}, 170);

/* ── 2. flop ─────────────────────────────────────────────────────────── */
runArc("flop", {archetype:"indie", studio:"Rushed Reels"}, {
  preferBig:false, cheapestCrew:true, spendCap:0.5, budgetMult:0.6, maxConcurrent:2, castSize:1, runwayWeeks:10,
  borrowWhenBroke:true, maxDebtRatio:0.6, rating:"R"
}, 170);

/* ── 3. debt ─────────────────────────────────────────────────────────── */
runArc("debt", {archetype:"producer", studio:"Leveraged Features"}, {
  preferBig:true, spendCap:0.9, budgetMult:1.4, maxConcurrent:1, castSize:2, runwayWeeks:6,
  borrowWhenBroke:true, maxDebtRatio:0.9, repay:false
}, 170);

/* ── 4. spree ────────────────────────────────────────────────────────── */
runArc("spree", {archetype:"producer", studio:"Overproduction Inc"}, {
  preferBig:false, spendCap:0.7, budgetMult:1.1, maxConcurrent:2, castSize:2, runwayWeeks:8,
  borrowWhenBroke:true, maxDebtRatio:0.7, repay:false
}, 170);

/* ── 5. franchise ────────────────────────────────────────────────────── */
runArc("franchise", {archetype:"producer", studio:"Franchise Machine"}, {
  preferBig:false, spendCap:0.5, budgetMult:1.05, maxConcurrent:1, castSize:3, runwayWeeks:16,
  borrowWhenBroke:true, maxDebtRatio:0.5, repay:true, empire:true, store:true, games:true
}, 220);

/* ── 6. streamer ─────────────────────────────────────────────────────── */
runArc("streamer", {archetype:"producer", studio:"Platform Pictures"}, {
  preferBig:false, spendCap:0.35, budgetMult:0.85, maxConcurrent:1, castSize:2, runwayWeeks:20,
  borrowWhenBroke:true, maxDebtRatio:0.6, repay:true, streamer:true, empire:true
}, 220);

/* ── summary ─────────────────────────────────────────────────────────── */
console.log("\n── ARC SUMMARY ──");
ARCS.forEach(a=>{
  console.log("  "+a.name.padEnd(11)+" wk "+String(a.out.weeks).padStart(3)+
    " · cash "+fmtM(a.out.cash).padStart(8)+" · WW "+fmtM(a.out.ww).padStart(8)+
    " · rep "+String(a.out.rep).padStart(2)+" · "+a.out.films+" films"+(a.out.bankrupt? " · bankrupt":""));
});
if(arcFails){ console.log("\nARC HARNESS FAILED ❌ ("+arcFails+" check(s))"); process.exitCode = 1; }
else console.log("\nARC HARNESS PASSED ✅");
