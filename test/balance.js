/* test/balance.js — automated balance harness (Phase 5)
   Runs full engine simulations with a scripted player and asserts economic
   and progression sanity across seeds. Run: npm run balance */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".balance-generated.js");

const SHIM = "global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};\nif(typeof global.DATA === 'undefined') global.DATA = {};\n";

const body = `
/* ── balance harness body ── */
const SEEDS = 6, WEEKS = 120;
let failures = 0;
function check(name, ok, detail){
  if(!ok){ failures++; console.error("❌ " + name + (detail? " — "+detail : "")); }
  else console.log("✅ " + name + (detail? " — "+detail : ""));
}

for(let seed=0; seed<SEEDS; seed++){
  newGame("indie", "Balance Lot " + seed);
  G._noSave = true;                       // never write over the real save
  G.tutorial = null;                      // no tutorial noise
  // scripted player: greenlight when affordable, always advance
  let talentLeveled = false, gameLaunched = false, xpSources = new Set();
  for(let w=0; w<WEEKS && !G.over; w++){
    // keep the studio solvent so we test balance, not bankruptcy RNG
    if(G.studio.cash < 150){ G.studio.cash = 150; G.weeksInDebt = 0; G.studio.debt = Math.min(G.studio.debt||0, 10); }
    // greenlight something occasionally
    if(w % 6 === 0 && G.ideas.length && G.studio.cash > 200){
      const idea = G.ideas[0];
      try{ greenlight({ idea: idea, writer: null, director: null, producer: null, cast: [], budget: Math.round(neededBudget(idea.genre, idea.scale)), marketing: 10, plan: "theatrical" }); }catch(e){}
    }
    // release ready films fast
    (G.projects||[]).forEach(p=>{ if(p.phase==="ready" && !p.releaseWeek){ p.releaseWeek = G.week + 1; p.marketingPaid = p.marketing; } });
    // force game-dev unlock mid-run to exercise the pipeline
    if(w === 30 && !(G.prototypeData||{}).gameDevUnlocked){ G.studio.rep = 55; G.studio.cash = Math.max(G.studio.cash, 400); unlockGameDevLite(); }
    if((G.prototypeData||{}).gameDevUnlocked && !(G.prototypeData||{}).currentProject && w > 32){
      startGameDevProject({ genre:"rpg", platform:"pc", theme:"fantasy", mechanic:"narrative", monetization:"premium" });
    }
    advanceWeeks(1);
    // dismiss any pending modals like a player would
    if(G.pendingChoice){ const c = (DATA.EVENTS||[]).find(e=>e.kind==="choice"); if(G.pendingChoice.choices) G.pendingChoice = null; }
    G.pendingChoice = G.pendingChoice && G.pendingChoice.choices ? null : G.pendingChoice;
    G.pendingReport = null; G.pendingEarnings = null;
    if(G.pendingAuction && !G.pendingAuction.manual) G.pendingAuction = null;
    if(G.pendingSports) G.pendingSports = null;
    // phase gates: auto-advance game dev choices
    const pr = (G.prototypeData||{}).currentProject;
    if(pr && pr.progress >= 100){
      const defs = (DATA.PROTOTYPE_GAME_DEV.phaseChoices||{})[pr.phase] || [];
      const firstOpt = defs.length ? defs[0].options[0].id : null;
      advanceGameDevPhase(firstOpt);
    }
    if(((G.prototypeData||{}).releasedGames||[]).length) gameLaunched = true;
    // invariants every week
    check("wk"+w+" cash finite", Number.isFinite(G.studio.cash), "cash="+G.studio.cash);
    const pr2 = (G.prototypeData||{}).currentProject;
    if(pr2){ check("wk"+w+" project progress finite", Number.isFinite(pr2.progress) && Number.isFinite(pr2.quality), "p="+pr2.progress+" q="+pr2.quality); }
  }
  // progression invariants
  const leveled = (G.talent||[]).filter(t=>t.prototype && t.prototype.level > 1).length;
  const withXp = (G.talent||[]).filter(t=>t.prototype && (t.prototype.history||[]).some(h=>{ xpSources.add(String(h.source||"").split(":")[0]); return (h.amount||0) > 0; })).length;
  check("seed"+seed+" talents gained XP from play", withXp >= 1, withXp + " talents");
  check("seed"+seed+" at least one talent leveled", leveled >= 1, leveled + " leveled");
  check("seed"+seed+" xpToNext grows with level", (G.talent||[]).every(t=>!t.prototype || t.prototype.level < 2 || t.prototype.xpToNext > DATA.PROTOTYPE_BASE_XP));
  const levels = (G.talent||[]).map(t=>t.prototype?t.prototype.level:0);
  check("seed"+seed+" levels bounded ("+WEEKS+" wks)", Math.max(0,...levels) <= 20, "max L" + Math.max(0,...levels));
  // life events: at most 1 per talent per week
  const overEvent = (G.talent||[]).some(t=>t.prototype && t.prototype.events && t.prototype.events.length && (()=>{ const es=t.prototype.events; for(let i=1;i<es.length;i++){ if(es[i].week===es[i-1].week) return true; } return false; })());
  check("seed"+seed+" life events ≤1/talent/week", !overEvent);
  // game dev pipeline reachable
  check("seed"+seed+" in-house game launched", gameLaunched);
  const rel = ((G.prototypeData||{}).releasedGames||[]);
  check("seed"+seed+" released game fields sane", rel.every(g=>Number.isFinite(g.quality) && g.quality>=20 && g.quality<=100 && Number.isFinite(g.salesTotal)));
  // XP sources actually flowed
  check("seed"+seed+" XP came from films or events", xpSources.has("film") || xpSources.has("life_event"), [...xpSources].join(","));
  // economy: reputation in band
  check("seed"+seed+" rep in band", G.studio.rep >= 5 && G.studio.rep <= 99, "rep="+G.studio.rep);
}

console.log(failures ? ("\\nBALANCE HARNESS FAILED — " + failures + " problem(s)") : "\\nBALANCE HARNESS PASSED ✅");
process.exitCode = failures ? 1 : 0;
`;

const bundle = SHIM +
  fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "engine.js"), "utf8") + "\n" +
  body + "\n";

fs.writeFileSync(OUT, bundle);
try{
  require("./.balance-generated.js");
}finally{
  fs.unlinkSync(OUT);
}
