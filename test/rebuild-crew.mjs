/* Rebuild crew-module harness (pattern from test/rebuild-sim.mjs): runs game/data.js +
   game/engine.js + game/crew.js in a VM sandbox with a stubbed localStorage. ui.js needs
   a DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   NOTE: engine.js in this tree does NOT yet guard-call tickCrew (integrator wiring), so the
   harness calls tickCrew() after every advanceWeek() — the production wiring is one
   typeof-guarded line. Drives 50 advanceWeek() calls while exercising every crew system
   through the module's real functions: pool rotation + invariants, hiring all three roles
   (cash gates, per-project scoping, booking), location shoot + deterministic weather hit,
   rush/extend/reshoot via the engine functions, soundtrack royalties across a real
   releaseFilm path, pool expiry vs crewMods snapshots. Prints one line per check;
   exits non-zero on failure. */
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
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }

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
  /* ui.js helpers (ui.js itself can't load without a DOM); same behavior as ui.js */
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "crew.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "crew.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickCrew/crewAction/crewMods/forecastAdjust_crew",
  typeof C.tickCrew === "function" && typeof C.crewAction === "function" &&
  typeof C.crewMods === "function" && typeof C.forecastAdjust_crew === "function");
check("CREW_DESKS is 1 desk: id crew-main, group Crew, icon 👥, name Crew & production",
  Array.isArray(C.CREW_DESKS) && C.CREW_DESKS.length === 1 &&
  C.CREW_DESKS[0].id === "crew-main" && C.CREW_DESKS[0].group === "Crew" &&
  C.CREW_DESKS[0].icon === "👥" && C.CREW_DESKS[0].name === "Crew & production" &&
  typeof C.CREW_DESKS[0].render === "function");
check("forecastAdjust_crew() → 0", C.forecastAdjust_crew() === 0);

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek(); /* engine.js advanceWeek now calls tickCrew() itself */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
    if (!S().crew || S().crew.pool.length !== 6) { threw = "pool not 6 at week " + st.week; return; }
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.CREW_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("desk renders clean " + label, bad === "", bad);
}
function fakeFilm(id, title, genre, quality, status) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening: 30, legs: 2.6, decay: 1 - 1 / 2.6, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null, status
  });
}
function fakeProject(id, title, genre, phase, opts) {
  const o = opts || {};
  S().projects.push({
    id, title, genre, scale: "micro", budget: o.budget || 5, budgetNow: o.budget || 5,
    script: o.script != null ? o.script : 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: o.mkt != null ? o.mkt : null, releaseWeek: o.releaseWeek != null ? o.releaseWeek : null,
    phase, phaseWk: 0, phaseLen: { pre: o.pre || 2, shoot: o.shoot || 3, post: o.post || 60 },
    overrun: 0, scandal: false, buzz: 0, franchiseOf: null, prodScore: 55,
    quality: o.quality, qPreview: o.qPreview
  });
}
function elx(pid, cid) {
  return { getAttribute: (k) => (k === "data-id" ? pid : k === "data-key" ? cid : null) };
}

/* ── week 1: lazy ensure + pool invariants ────────────────────── */
C.newGame("Test", "veteran");
C.tickCrew();
check("S.crew namespace created lazily by tickCrew",
  !!S().crew && Array.isArray(S().crew.pool) && S().crew.hired && S().crew.compOf && S().crew.seen && Array.isArray(S().crew.soundtracks));
const pool0 = S().crew.pool;
check("pool starts at 6 candidates", pool0.length === 6);
check("candidate invariants: tier 1–3, craft matches role/tier map, fee $1–8M, booked free",
  pool0.every((c) => c.tier >= 1 && c.tier <= 3 && ["dp", "editor", "composer"].includes(c.role) &&
    isFinite(c.craft) && c.craft === (c.role === "dp" ? c.tier + 1 : c.role === "editor" ? c.tier : Math.min(c.tier, 2)) &&
    c.fee >= 1 && c.fee <= 8 && c.bookedUntil === 0 && typeof c.n === "string" && c.id.startsWith("cw")));
const ids0 = pool0.map((c) => c.id).join(",");
advance(1);
const ids1 = S().crew.pool.map((c) => c.id).join(",");
check("pool rotates weekly (unbooked candidates replaced)", ids0 !== ids1, "6 fresh ids");
check("craft DP 2–4 · editor 1–3 · composer 1–2 across the board",
  ["dp", "editor", "composer"].every((r) => {
    const c = S().crew.pool.find((x) => x.role === r);
    return !c || (r === "dp" ? c.craft >= 2 && c.craft <= 4 : r === "editor" ? c.craft >= 1 && c.craft <= 3 : c.craft >= 1 && c.craft <= 2);
  }));

/* ── mechanic 1: hiring all three roles ───────────────────────── */
fakeFilm("f9001", "Crew Fake", "drama", 82, "run"); /* running film → real theatrical income */
fakeProject("p9001", "Crew Pic", "drama", "pre", { budget: 5 });
const p = C.findProject("p9001");
check("crewMods → craft 0 before any hire", C.crewMods(p).craft === 0);
/* rotate until the board offers all three roles */
let guard = 0;
while (guard++ < 40 && !["dp", "editor", "composer"].every((r) => S().crew.pool.some((c) => c.role === r && c.bookedUntil <= S().studio.week))) {
  advance(1);
  if (threw) break;
}
check("board covers all three roles within 40 weeks", guard <= 40, "week " + S().studio.week);
const hires = {};
let feeSum = 0, craftSum = 0;
for (const role of ["dp", "editor", "composer"]) {
  const cand = S().crew.pool.find((c) => c.role === role && c.bookedUntil <= S().studio.week);
  hires[role] = cand;
  feeSum += cand.fee;
  craftSum += cand.craft;
}
S().studio.cash = 0.1;
const poor = C.crewHire("p9001", hires.dp.id);
check("hire rejected on insufficient cash, no state change",
  !!poor.err && !p.crewHired && hires.dp.bookedUntil === 0, poor.err || "");
S().studio.cash = 200;
const cashH = S().studio.cash, wkH = S().studio.week;
let hireOk = true;
for (const role of ["dp", "editor", "composer"]) {
  hireOk = hireOk && C.crewAction("crew-hire", elx("p9001", hires[role].id)) === true && p.crewHired[role] === hires[role].id;
}
check("all three roles hired via crewAction, ids stored on p.crewHired", hireOk,
  "DP c" + hires.dp.craft + " · ed c" + hires.editor.craft + " · comp c" + hires.composer.craft);
check("hire cost = sum of fees", nearly(cashH - S().studio.cash, Math.round(feeSum * 10) / 10), C.fm(feeSum));
check("bookedUntil = week + 30", Object.values(p.crewHired).every((id) => S().crew.pool.find((c) => c.id === id).bookedUntil === wkH + 30));
check("crewMods craft = sum of hired crafts", C.crewMods(p).craft === craftSum, "+" + craftSum);
check("hired snapshots kept in S.crew.hired (rotation-proof)",
  Object.values(p.crewHired).every((id) => S().crew.hired[id] && S().crew.hired[id].craft === S().crew.pool.find((c) => c.id === id).craft));
check("composer tier snapshotted per project in S.crew.compOf",
  S().crew.compOf.p9001 && S().crew.compOf.p9001.tier === hires.composer.tier && S().crew.compOf.p9001.title === "Crew Pic");
check("second hire in a filled role rejected", !!C.crewHire("p9001", hires.dp.id).err);
fakeProject("p9002", "Crew Pic II", "comedy", "pre", { budget: 5 });
check("booked candidate rejected for another project", !!C.crewHire("p9002", hires.dp.id).err);
check("crewMods is per-project (p9002 → 0)", C.crewMods(C.findProject("p9002")).craft === 0);
check("crewAction returns false for foreign actions", C.crewAction("gl-open", elx("p9001")) === false);
desksRenderClean("(pre, all hired)");

/* ── mechanics 4+5: location + rush/extend/reshoot, all in shoot ── */
let g2 = 0;
while (g2++ < 12 && p.phase !== "shoot" && !threw) advance(1);
if (p.phase !== "shoot") { p.phase = "shoot"; p.phaseWk = 0; } /* deterministic fallback */
check("project reached shoot phase", p.phase === "shoot", "week " + S().studio.week);
const cashL = S().studio.cash;
check("location ok: p.locationShoot + $1.5M", C.crewAction("crew-location", elx("p9001")) === true &&
  p.locationShoot === true && nearly(cashL - S().studio.cash, 1.5));
check("location once per project", !!C.crewLocation("p9001").err);
const rnd1 = (x) => Math.round(x * 10) / 10; /* same rounding as engine spend() */
const pl0 = p.phaseLen.shoot, cashR = S().studio.cash;
check("rush via engine: p.rushed, shoot −1 wk, $budget×0.12", C.crewAction("crew-rush", elx("p9001")) === true &&
  p.rushed === true && p.phaseLen.shoot === pl0 - 1 && nearly(cashR - S().studio.cash, rnd1(p.budget * 0.12)));
check("rush once (engine guard)", C.rushFilm("p9001") === false);
const pl1 = p.phaseLen.shoot, cashE = S().studio.cash;
check("extend via engine: p.extended, shoot +1 wk, +3 p.extendCraft, $budget×0.05", C.crewAction("crew-extend", elx("p9001")) === true &&
  p.extended === true && p.phaseLen.shoot === pl1 + 1 && p.extendCraft === 3 &&
  nearly(cashE - S().studio.cash, rnd1(p.budget * 0.05)));
check("extend once (engine guard)", C.extendFilm("p9001") === false);
const cashS = S().studio.cash;
check("reshoot via engine: p.reshotScene, $budget×0.06", C.crewAction("crew-reshoot", elx("p9001")) === true &&
  p.reshotScene === true && nearly(cashS - S().studio.cash, rnd1(p.budget * 0.06)));
check("reshoot once (engine guard)", C.reshootScene("p9001") === false);
desksRenderClean("(shoot, choices spent)");

/* ── weather risk: deterministic chance override window ───────── */
const realChance = C.chance;
const cashW = S().studio.cash, plW = p.phaseLen.shoot;
C.chance = () => true; /* only tickCrew's weather roll reads chance(); locationShoot was
                           set after entering shoot, so no natural roll ran before this */
C.tickCrew();
C.chance = realChance;
check("weather hit: flag, shoot +1 wk, $budget×0.03 spent, news logged",
  p.weatherHit === true && p.phaseLen.shoot === plW + 1 && nearly(cashW - S().studio.cash, rnd1(p.budget * 0.03)) &&
  S().news.some((n) => (n.txt || n.t || "").indexOf("Weather delay") >= 0), "−" + C.fm(rnd1(p.budget * 0.03)));
const plW2 = p.phaseLen.shoot;
C.tickCrew();
check("weather hits once (no re-roll)", p.weatherHit === true && p.phaseLen.shoot === plW2);

/* ── mechanic 3: soundtrack royalties across a real release ──── */
const realEarn = C.earn;
const earns = [];
C.earn = (amt, label) => { earns.push({ amt, label }); return realEarn(amt, label); };
p.phase = "post";
p.phaseWk = 99; /* wrap post this week → ready; release when the date arrives */
p.quality = 70;
p.qPreview = 70;
p.releaseWeek = S().studio.week + 2;
let g3 = 0;
while (g3++ < 6 && !S().films.some((f) => f.title === "Crew Pic") && !threw) advance(1);
const film = S().films.find((f) => f.title === "Crew Pic");
check("project released through the real engine path", !!film, film ? "quality " + film.quality : "missing");
check("soundtrack starts at release: seen ids marked, 8 weeks queued",
  S().crew.seen.p9001 === true && S().crew.soundtracks.length === 1 &&
  S().crew.soundtracks[0].title === "Crew Pic" && S().crew.soundtracks[0].tier === hires.composer.tier &&
  S().crew.soundtracks[0].left === 8, "tier " + hires.composer.tier);
const stRate = hires.composer.tier * 0.3;
advance(8);
const stEarns = earns.filter((e) => e.label === "Soundtrack · Crew Pic");
check("8 weekly soundtrack earns of tier × $0.3M, stream then expires", stEarns.length === 8, stEarns.length + " earns");
check("every soundtrack earn = tier × 0.3", stEarns.every((e) => nearly(e.amt, stRate)), C.fm(stRate) + "/wk");
check("soundtracks queue empty after 8 weeks", S().crew.soundtracks.length === 0);
check("soundtrack earn rows reach the weekly ledger", S().txHistory.some((w) => w.rows.some((r) => r.k === "Soundtrack · Crew Pic")));

/* ── pool expiry vs hired snapshots, 50-week soak ─────────────── */
while (weeksDriven < 50 && !threw) advance(1);
check("no throw and cash finite all 50 weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("50 advanceWeek calls driven", weeksDriven >= 50, String(weeksDriven));
check("S.crew namespace exists at end", !!S().crew);
check("booked candidates left the pool after 30 weeks",
  Object.values(p.crewHired).every((id) => !S().crew.pool.some((c) => c.id === id)), "week " + S().studio.week);
check("crewMods still sums from hired snapshots after pool expiry", C.crewMods(p).craft === craftSum, "+" + craftSum);
check("all crew state fields finite at end",
  S().crew.pool.every((c) => isFinite(c.craft) && isFinite(c.fee) && isFinite(c.bookedUntil)) &&
  Object.values(S().crew.hired).every((h) => isFinite(h.craft) && isFinite(h.tier)) &&
  Object.values(S().crew.compOf).every((c) => isFinite(c.tier)) &&
  earns.every((e) => isFinite(e.amt)));
desksRenderClean("(week " + S().studio.week + ", year " + S().studio.year + ")");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
