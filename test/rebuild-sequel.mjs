/* Rebuild sequel-planning harness (pattern from test/rebuild-consolehw.mjs): runs
   game/data.js + game/engine.js + game/sequel.js in a VM sandbox with a stubbed
   localStorage and the two ui helpers the desk renders with (statrow/tag).
   Drives 90+ advanceWeek() cycles, forces a qualifying finished film, exercises the
   real sequelPlan path end to end (cash, S.ideas + franchiseOf, plan entry), walks a
   planned sequel through greenlight → release so sequelOnRelease consumes it, hits the
   insufficient-cash rejection, and checks every published hook/desk/achievement.
   Prints one line per check; exits non-zero on failure. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
}
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }

const mem = {};
const ctx = vm.createContext({
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
  Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  },
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "sequel.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "sequel.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.assign", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickSequel / sequelAction / sequelOpenMult / sequelCraftMod / sequelOnRelease",
  typeof C.tickSequel === "function" && typeof C.sequelAction === "function" &&
  typeof C.sequelOpenMult === "function" && typeof C.sequelCraftMod === "function" &&
  typeof C.sequelOnRelease === "function");
check("SEQUEL_DESKS is an array of one shaped 'Empire & Franchises' desk",
  Array.isArray(C.SEQUEL_DESKS) && C.SEQUEL_DESKS.length >= 1 &&
  C.SEQUEL_DESKS.every((d) => d.id && d.group === "Empire & Franchises" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("desk id is sequel-plan", C.SEQUEL_DESKS.some((d) => d.id === "sequel-plan"));
check("SEQUEL_ACHIEVEMENTS has at least 4 entries with unique ids",
  Array.isArray(C.SEQUEL_ACHIEVEMENTS) && C.SEQUEL_ACHIEVEMENTS.length >= 4 &&
  new Set(C.SEQUEL_ACHIEVEMENTS.map((a) => a.id)).size === C.SEQUEL_ACHIEVEMENTS.length,
  String(C.SEQUEL_ACHIEVEMENTS.length) + " awards");
check("achievement tests all safe on an empty/degenerate save",
  C.SEQUEL_ACHIEVEMENTS.every((a) => {
    try { return a.test({}) === false && a.test({ sequel: {} }) === false; } catch (e) { return false; }
  }));
check("greenlight uses the engine genIdea (no hand-built script object)",
  /var idea = genIdea\(root\)/.test(src) && !/id: "i" \+/.test(src));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0;
const spendRows = [], earnRows = [];
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      C.tickSequel();               /* harness drives the tick until the engine hook exists */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
    const rows = S().weekTx ? S().weekTx.rows : [];
    let sum = 0;
    for (const r of rows) {
      sum += r.v;
      if (r.v < 0 && spendRows.indexOf(r.k) < 0) spendRows.push(r.k);
      if (r.v > 0 && earnRows.indexOf(r.k) < 0) earnRows.push(r.k);
    }
    if (!nearly(st.cash - before, sum, 0.05)) ledgerBreaks++;
    if (!S().sequel) { threw = "S.sequel vanished at week " + st.week; return; }
  }
}
function deskHTML(id) {
  const d = C.SEQUEL_DESKS.filter((x) => x.id === id)[0];
  if (!d) return { err: "missing desk " + id };
  try { return { html: d.render() }; } catch (e) { return { err: id + " threw: " + (e.stack || e) }; }
}
function desksClean(label) {
  let bad = "";
  for (const d of C.SEQUEL_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || !html.length || html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " bad html"; break; }
  }
  check("desk renders non-empty, clean html " + label, bad === "", bad);
}
/* A finished-run film object shaped exactly like engine endTheatrical's output. */
function pushDoneFilm(title, o) {
  o = o || {};
  const cost = o.cost != null ? o.cost : 40;
  const f = {
    id: "f" + (S().seq++), title: title, genre: o.genre || "action", scale: "mid",
    budget: cost, mkt: cost * 0.5, cost: cost,
    dirId: null, actId: null, supIds: [],
    quality: o.quality != null ? o.quality : 74,
    criticAvg: o.quality != null ? o.quality : 74, freshPct: 80, aud: 80, quotes: [],
    opening: o.opening != null ? o.opening : 45,
    legs: 2.6, decay: 1 - 1 / 2.6,
    weeksOut: 6, dom: o.ww != null ? o.ww * 0.55 : cost * 1.2,
    weekly: [], releaseWeek: S().studio.week - 8, season: "Summer season",
    franchiseOf: o.franchiseOf || null,
    presale: 0, revShare: 0, insured: false, screenRental: 0, window: 45,
    intl: o.ww != null ? o.ww * 0.45 : cost,
    ww: o.ww != null ? o.ww : cost * 2.4,
    profit: cost * 0.5,
    status: "done"
  };
  S().films.unshift(f);
  return f;
}

/* ── week 1: lazy ensure, defaults, no-plan behaviour ─────────── */
C.newGame("Sequel Test", "veteran");
check("S.sequel is absent on a fresh save (lazy ensure is real)", !S().sequel);
C.tickSequel();
check("tickSequel lazily creates S.sequel with finite fields",
  !!S().sequel && Array.isArray(S().sequel.plans) && typeof S().sequel.shipped === "object" &&
  isFinite(S().sequel.lastTick) && isFinite(S().sequel.devSpend) &&
  isFinite(S().sequel.shippedTotal) && isFinite(S().sequel.consumed));
check("sequelOpenMult returns 1 when nothing is planned",
  C.sequelOpenMult({ franchiseOf: "Whatever" }) === 1 && C.sequelOpenMult(null) === 1);
check("sequelCraftMod returns 0 when nothing is planned",
  C.sequelCraftMod({ franchiseOf: "Whatever" }) === 0 && C.sequelCraftMod(null) === 0);
check("sequelOnRelease(null) is defensive and returns false", C.sequelOnRelease(null) === false);
check("no qualifying films with an empty slate", C.sequelQualifiers().length === 0);
desksClean("(w1, empty)");

/* ── insufficient-cash rejection leaves state untouched ───────── */
const lowFilm = pushDoneFilm("Cash Poor Saga", { cost: 40 });
const prePlans = S().sequel.plans.length, preIdeas = S().ideas.length;
const preDev = S().sequel.devSpend;
S().studio.cash = 0.5;
const rej = C.sequelPlan(lowFilm.id);
check("insufficient-cash sequel rejection (needs >$0.5M development)",
  !!rej.err && S().sequel.plans.length === prePlans, rej.err || "");
check("rejected sequel plan left cash, ideas and dev spend untouched",
  S().studio.cash === 0.5 && S().ideas.length === preIdeas && S().sequel.devSpend === preDev,
  "cash " + S().studio.cash);
const rejAction = C.sequelAction("sequel-greenlight", { getAttribute: (k) => (k === "data-id" ? lowFilm.id : null) });
check("action path also rejects cleanly with insufficient cash",
  rejAction === true && S().sequel.plans.length === prePlans && S().studio.cash === 0.5);

/* ── qualifying rules are defensive ───────────────────────────── */
S().studio.cash = 400;
const bad1 = pushDoneFilm("Flop R Us", { cost: 40, ww: 50, quality: 80 });          /* 1.25x cost */
const bad2 = pushDoneFilm("Panned But Profitable", { cost: 20, ww: 90, quality: 44 }); /* quality < 60 */
const bad3 = { id: "fbroken", title: "No Numbers", status: "done" };                  /* missing fields */
S().films.unshift(bad3);
check("under-1.8x worldwide take does not qualify", !C.sequelQualifies(bad1));
check("quality under 60 does not qualify", !C.sequelQualifies(bad2));
check("a film with missing numeric fields does not qualify", !C.sequelQualifies(bad3));
check("unfinished films never qualify",
  !C.sequelQualifies({ id: "x", title: "Still Running", status: "run", ww: 500, cost: 10, quality: 90 }));
check("rejection for a non-qualifying film is clean",
  !!C.sequelPlan(bad1.id).err && S().sequel.plans.length === 0);

/* ── the real greenlight path ─────────────────────────────────── */
const hit = pushDoneFilm("Test Saga", { cost: 40, ww: 120, quality: 74 });
const qualifiers = C.sequelQualifiers();
check("a 3x-cost, 74-quality finished film qualifies", C.sequelQualifies(hit) &&
  qualifiers.some((f) => f.id === hit.id), qualifiers.length + " qualifying");
const devCost = C.sequelDevCost(hit);
check("development cost is a finite, positive quote", isFinite(devCost) && devCost > 0, C.fm(devCost));

const cashBefore = S().studio.cash;
const ideasBefore = S().ideas.length;
const plan = C.sequelPlan(hit.id);
check("sequel plan accepted", !!plan.ok && !!plan.planId, plan.err || plan.planId);
check("development fee paid up front from cash",
  nearly(cashBefore - S().studio.cash, plan.cost, 0.05), "paid " + (cashBefore - S().studio.cash).toFixed(1));
check("dev spend ledger accumulator rose by the fee",
  nearly(S().sequel.devSpend, plan.cost, 0.05), String(S().sequel.devSpend));

const newIdeas = S().ideas.filter((i) => i && i.id === plan.ideaId);
check("exactly one generated idea landed in S.ideas", newIdeas.length === 1 &&
  S().ideas.length === ideasBefore + 1, newIdeas.length + " found · ideas " + S().ideas.length);
const idea = newIdeas[0] || {};
check("generated idea carries franchiseOf = the source title", idea.franchiseOf === "Test Saga", String(idea.franchiseOf));
check("generated idea is an engine idea (i-prefixed id, priced)", /^i/.test(String(idea.id)) && isFinite(idea.price) && idea.price > 0,
  "id " + idea.id + " · price " + C.fm(idea.price));
check("sequel script carries the engine's 2.5x price multiplier (above the non-franchise $3.1M ceiling)",
  isFinite(idea.price) && idea.price > 3.1 && idea.price <= 7.8, C.fm(idea.price));
check("plan entry recorded with franchise, source, cost and week",
  !!S().sequel.plans.length && S().sequel.plans[0].franchise === "Test Saga" &&
  S().sequel.plans[0].sourceId === hit.id && S().sequel.plans[0].cost === plan.cost &&
  isFinite(S().sequel.plans[0].week));
check("plan cites the idea it generated", S().sequel.plans[0].ideaId === plan.ideaId);
check("a second plan for the same film is rejected", !!C.sequelPlan(hit.id).err);
check("duplicate plan did not deduct cash twice",
  nearly(cashBefore - S().studio.cash, plan.cost, 0.05));

/* ── hooks: planned vs unplanned project ─────────────────────── */
const plannedP = { id: "px", franchiseOf: "Test Saga" };
const unplannedP = { id: "py", franchiseOf: "Untracked IP" };
check("sequelOpenMult > 1 for a planned franchise (finite)",
  isFinite(C.sequelOpenMult(plannedP)) && C.sequelOpenMult(plannedP) > 1,
  "\u00d7" + C.sequelOpenMult(plannedP).toFixed(3));
check("sequelOpenMult === 1 for an unplanned project",
  C.sequelOpenMult(unplannedP) === 1 && C.sequelOpenMult({}) === 1);
check("sequelCraftMod > 0 for a planned sequel, 0 for an unplanned one",
  C.sequelCraftMod(plannedP) > 0 && C.sequelCraftMod(unplannedP) === 0,
  "+" + C.sequelCraftMod(plannedP));
const firstBoost = C.sequelOpenMult(plannedP);

/* ── fatigue: each shipped sequel weakens the next boost ──────── */
S().sequel.shipped["test saga"] = 3;
const thirdBoost = C.sequelOpenMult(plannedP);
check("sequel fatigue shrinks the opening boost as entries pile up",
  thirdBoost < firstBoost && thirdBoost > 1, "\u00d7" + firstBoost.toFixed(3) + " → \u00d7" + thirdBoost.toFixed(3));
check("fatigued craft bonus still positive but lower",
  C.sequelCraftMod(plannedP) > 0 && C.sequelCraftMod(plannedP) < 4, "+" + C.sequelCraftMod(plannedP));
S().sequel.shipped["test saga"] = 0;
check("fatigue resets with the shipped counter for a clean franchise",
  C.sequelOpenMult(plannedP) === firstBoost);

/* ── the paid-for script survives the engine's 14-week desk sweep ── */
advance(17);
check("planned script is still on the development desk after 17 weeks",
  S().ideas.some((i) => i && i.id === plan.ideaId), "week " + S().studio.week);
check("plan aged toward its window", isFinite(S().sequel.plans[0].wk) && S().sequel.plans[0].wk >= 17,
  "wk " + S().sequel.plans[0].wk);

/* ── production: greenlight the sequel through the engine ─────── */
const dir = S().market.filter((t) => t.k === "dir" && t.bookedUntil <= S().studio.week)[0];
const act = S().market.filter((t) => t.k === "actor" && t.bookedUntil <= S().studio.week)[0];
check("free director and lead found in the market", !!dir && !!act);
S().studio.cash = 400;
const gl = C.greenlight(plan.ideaId, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 1, supportIds: [] });
check("sequel script greenlights through the normal development desk", !!gl.ok, gl.err || "");
const proj = S().projects.filter((p) => p.franchiseOf === "Test Saga")[0];
check("project carries franchiseOf from the generated idea", !!proj && proj.franchiseOf === "Test Saga");
const glPlanMult = C.sequelOpenMult(proj);
check("sequelOpenMult applies to the live project", isFinite(glPlanMult) && glPlanMult > 1, "\u00d7" + glPlanMult.toFixed(3));
check("sequel script got the engine's +5 franchise script bonus",
  !!proj && proj.script >= 47, proj ? String(proj.script) : "none");

/* project tracking: the tick links the plan to its project */
advance(1);
check("tick linked the plan to the in-production project",
  S().sequel.plans[0].projId === proj.id && S().sequel.plans[0].status === "greenlit",
  String(S().sequel.plans[0].status));

/* release it: schedule, then drive until the film is out and the plan is consumed */
const relWeek = S().studio.week + 1;
const sr = C.setRelease(proj, relWeek, 1, 45);
check("release date locked for the sequel", !!sr.ok, sr.err || "");
let guard = 0;
while (S().sequel.plans[0].status !== "done" && guard < 30) { advance(1); guard++; }
const seqFilm = S().films.filter((f) => f.franchiseOf === "Test Saga" && f.id !== hit.id)[0];
check("sequel released into theaters", !!seqFilm, seqFilm ? seqFilm.title : "no film");
check("sequelOnRelease consumed the plan at release",
  S().sequel.plans[0].status === "done" && S().sequel.plans[0].filmId === (seqFilm && seqFilm.id),
  S().sequel.plans[0].status + " · " + guard + " wk");
check("shipped counter bumped for the franchise",
  S().sequel.shipped["test saga"] === 1 && S().sequel.shippedTotal === 1,
  JSON.stringify(S().sequel.shipped));
check("consumed plan no longer boosts later projects",
  C.sequelOpenMult(plannedP) === 1 && C.sequelOpenMult(seqFilm) === 1);
check("sequelOnRelease is idempotent for an already-consumed film",
  C.sequelOnRelease(seqFilm) === false && S().sequel.shippedTotal === 1);

/* ── drop path ────────────────────────────────────────────────── */
const second = pushDoneFilm("Drop Me", { cost: 30, ww: 80, quality: 70 });
const p2 = C.sequelPlan(second.id);
check("second plan accepted for a different franchise", !!p2.ok);
const ideaCountBeforeDrop = S().ideas.length;
check("sequel-drop action is handled", C.sequelAction("sequel-drop", { getAttribute: (k) => (k === "data-plan" ? p2.planId : null) }) === true);
check("dropped plan removed and its script pulled from the desk",
  !S().sequel.plans.some((p) => p.id === p2.planId) && S().ideas.length === ideaCountBeforeDrop - 1);

/* ── action delegation contract ───────────────────────────────── */
const stub = { getAttribute: () => null };
check("sequelAction returns false for foreign actions",
  C.sequelAction("gl-open", stub) === false && C.sequelAction("ops-press", stub) === false &&
  C.sequelAction("emp-park", stub) === false);
check("sequelAction handles an unknown sequel id (handled, reported)",
  C.sequelAction("sequel-greenlight", { getAttribute: () => "nope" }) === true);
check("sequelAction handles a drop of a missing plan", C.sequelAction("sequel-drop", stub) === true);

/* ── achievements fire off real state ─────────────────────────── */
check("'sequel-first-plan' passes once a plan exists",
  C.SEQUEL_ACHIEVEMENTS.filter((a) => a.id === "sequel-first-plan")[0].test(S()) === true);
check("'sequel-first-ship' passes after a plan shipped",
  C.SEQUEL_ACHIEVEMENTS.filter((a) => a.id === "sequel-first-ship")[0].test(S()) === true);
check("achievement tests run without throwing on the live save",
  C.SEQUEL_ACHIEVEMENTS.every((a) => { try { a.test(S()); return true; } catch (e) { return false; } }));

/* ── double-tick guard ────────────────────────────────────────── */
const livePlan = S().sequel.plans.filter((p) => p.status !== "done")[0] || null;
if (livePlan) {
  S().sequel.lastTick = S().studio.week - 1;
  C.tickSequel();
  const wk1 = livePlan.wk;
  C.tickSequel();
  check("tickSequel is idempotent within a week (plan ages once)", livePlan.wk === wk1, "wk " + wk1);
} else {
  S().sequel.lastTick = S().studio.week - 1;
  C.tickSequel();
  const l1 = S().sequel.lastTick;
  C.tickSequel();
  check("tickSequel is idempotent within a week", S().sequel.lastTick === l1 && l1 === S().studio.week);
}
desksClean("(mid-game, plan consumed)");

/* ── long soak: 90+ driven weeks total, invariants hold ───────── */
S().studio.cash = 900;
advance(Math.max(0, 92 - weeksDriven));
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("90+ advanceWeek cycles driven", weeksDriven >= 90, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("cash stayed finite every week", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("at least one spend and one earn recorded in the ledger",
  spendRows.length >= 1 && earnRows.length >= 1, spendRows.length + " spend kinds · " + earnRows.length + " earn kinds");
check("S.sequel exists at the end with every numeric field finite",
  !!S().sequel && isFinite(S().sequel.lastTick) && isFinite(S().sequel.devSpend) &&
  isFinite(S().sequel.shippedTotal) && isFinite(S().sequel.consumed) &&
  S().sequel.plans.every((p) => isFinite(p.cost) && isFinite(p.week) && isFinite(p.wk)),
  "plans " + S().sequel.plans.length);
check("shipped counters stayed finite and non-negative",
  Object.keys(S().sequel.shipped).every((k) => isFinite(S().sequel.shipped[k]) && S().sequel.shipped[k] >= 0));
check("sequelOpenMult stays finite and > 0 after the soak",
  isFinite(C.sequelOpenMult(plannedP)) && C.sequelOpenMult(plannedP) > 0 &&
  isFinite(C.sequelOpenMult(unplannedP)) && C.sequelOpenMult(unplannedP) > 0);
check("sequelCraftMod stays finite after the soak",
  isFinite(C.sequelCraftMod(plannedP)) && isFinite(C.sequelCraftMod(unplannedP)));
desksClean("(end, 90+ weeks in)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · sequels shipped " + S().sequel.shippedTotal);
process.exit(failures || threw ? 1 : 0);
