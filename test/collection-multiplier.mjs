/* test/collection-multiplier.mjs — the lever multiplier must be applied ONCE.
 *
 * Bug it pins down: `tickTheatrical()` already multiplied the week's gross by
 * `BoxOfficeCollection.grossMultiplier()`, and then `BoxOfficeCollection.tick()`
 * derived an "uplift" from that already-lifted weekly gross using the same
 * multiplier and paid it a second time — so a 1.5× lever stack behaved like
 * 1.5² = 2.25×. It also bumped f.dom without touching the weekly record, so
 * sum(f.weekly.gross) drifted below f.dom.
 *
 * Two arms (levers off / on) run from the same snapshot with the same seeded
 * market randomness, so the lever is the only variable.
 *
 * Assertions:
 *   1. per-week gross ratio ≈ the configured multiplier (not its square)
 *   2. total worldwide uplift cannot exceed the configured multiplier
 *   3. sum(weekly gross) ≈ f.dom — the weekly record tracks the film
 *
 * Run: node test/collection-multiplier.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const SHIM = `
if (typeof global.window === "undefined") global.window = global;
global.localStorage = { _s:{}, getItem(k){ return this._s[k] ?? null; }, setItem(k,v){ this._s[k]=v; }, removeItem(k){ delete this._s[k]; } };
if (typeof global.DATA === "undefined") global.DATA = {};
`;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");
const files = ["data.js", "engine.js", "box-office-collection-engine.js"];

const bundle = SHIM + "\n" + files.map(read).join("\n;\n") + "\n;\n" + `
function __mk(seed) {
  var st = seed >>> 0;
  return function () {
    st ^= st << 13; st >>>= 0;
    st ^= st >> 17;
    st ^= st << 5; st >>>= 0;
    return st / 4294967296;
  };
}
globalThis.__seedA = __mk(987654321);
globalThis.__seedB = __mk(123456789);
globalThis.rnd = function () { return globalThis.__seedA(); };
/* engine.js calls Math.random() directly in slate generation, poaching and
   festival picks. Overriding only rnd() left the snapshot non-deterministic, so
   each run built a different film (baseline ww swung $164M..$647M) and the
   international share drifted between the two arms — the ww ratio then measured
   market noise instead of the lever. Seed the primitive too. */
globalThis.__mr = __mk(0x2545F491);
Math.random = function () { return globalThis.__mr(); };
global.__BOW = {
  get G(){ return G; }, set G(v){ G = v; },
  newGame, releaseFilm, advanceWeeks, saveGame, loadGame, expectedOpening,
  DATA, fmtG, BoxOfficeCollection, CONFIG: BoxOfficeCollection.CONFIG,
  localStorage: global.localStorage
};
`;

const OUT = path.join(HERE, ".multiplier-generated.cjs");
fs.writeFileSync(OUT, bundle);

let BOW;
try {
  const { pathToFileURL } = await import("node:url");
  await import(pathToFileURL(OUT).href);
  BOW = globalThis.__BOW;
} finally {
  try { fs.unlinkSync(OUT); } catch {}
}

const BOC = BOW.BoxOfficeCollection;
if (!BOC) { console.error("❌ BoxOfficeCollection did not load"); process.exit(1); }

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}
const fmt = BOW.fmtG;

function mk(seed) { let st = seed >>> 0; return () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; }; }
function resetStreams() {
  globalThis.__seedA = mk(987654321);
  globalThis.__seedB = mk(123456789);
  globalThis.rnd = globalThis.__seedA;
  globalThis.__mr = mk(0x2545F491);
  Math.random = function () { return globalThis.__mr(); };
}

function makeFilm(G, opts) {
  const o = Object.assign({
    id: 99501, title: "Single Lever Picture", genre: "action", scale: "tentpole",
    budget: 180, marketing: 90, quality: 74, rating: "PG-13",
    franchise: false, premium: true, imax: true, pattern: "wide", rollout: "day",
    window: 45, cast: [], location: "la", releaseWeek: 1
  }, opts || {});
  const p = {
    id: o.id, title: o.title, genre: o.genre, scale: o.scale, budget: o.budget,
    marketing: o.marketing, marketingPaid: o.marketing, devCost: 0,
    director: null, writer: null, producer: null, cast: o.cast || [],
    quality: { overall: o.quality, critic: o.quality, aud: o.quality },
    rating: o.rating, premium: !!o.premium, imax: !!o.imax, franchise: !!o.franchise,
    pattern: o.pattern, rollout: o.rollout, window: o.window,
    location: o.location, releaseWeek: o.releaseWeek,
    campaigns: [], mktBoosts: [], advances: [], buzzBonus: 0, awareness: 0,
    phase: "ready"
  };
  BOW.expectedOpening(p, G.week);
  return BOW.releaseFilm(p);
}

const OPTS = { id: 99501, title: "Single Lever Picture", genre: "action", scale: "tentpole", budget: 180, marketing: 90, quality: 78, premium: true, imax: true };

/* Snapshot with the film already opened. */
resetStreams();
BOW.newGame("major", "Multiplier Lab");
{
  const G = BOW.G;
  G._noSave = true;
  G.tutorial = null;
  G.studio.cash = 4000;
  G.studio.debt = 0;
  const film = makeFilm(G, OPTS);
  G.films = [film];
  G._noSave = false;
  BOW.saveGame();
  if (!BOW.localStorage.getItem("bow_save")) throw new Error("snapshot not written");
}

const WEEKS = 12;
const PLAN = [{ week: 1, key: "pushScreens" }];

/* A fresh stream per week, identical for both arms. Without this the arms'
   RNG streams drift apart (the lever path consumes different randomness) and a
   week-by-week ratio stops measuring the lever. */
function seedWeek(w) {
  const s = mk(0x9e3779b9 ^ (w * 2654435761));
  globalThis.rnd = s;
  /* Same reason as rnd: the two arms consume Math.random() at different rates
     once the lever path branches, so the primitive needs a per-week reset or the
     arms desynchronise on everything downstream of the first levered tick. */
  const m = mk(0x85ebca6b ^ (w * 2246822519));
  globalThis.__mr = m;
  Math.random = function () { return globalThis.__mr(); };
}

function runArm(mode) {
  BOW.loadGame();
  const G = BOW.G;
  G._noSave = true;
  const film = (G.films || []).find(f => f && String(f.id) === String(OPTS.id));
  if (!film) throw new Error("snapshot lost the film");
  /* Freeze the decay curve identically in both arms. legsOf() reads f.ww, so a
     levered arm would otherwise earn longer legs and a different decay — a real
     coupling, but it would mask the multiplier we are measuring here. */
  film.legs = 2.5;
  film.decay = 1 - 1 / film.legs;
  const domByWeek = [];
  for (let w = 0; w < WEEKS; w++) {
    if (mode) {
      PLAN.filter(x => x.week === w + 1).forEach(x => BOC.applyLever(x.key, film.id));
    }
    seedWeek(w);
    const domBefore = Number(film.dom) || 0;
    BOW.advanceWeeks(1);
    G.pendingChoice = null; G.pendingReport = null; G.pendingEarnings = null;
    G.pendingAuction = null; G.pendingSports = null; G.pendingDeepfake = null;
    domByWeek.push({ w: G.week, delta: (Number(film.dom) || 0) - domBefore });
  }
  return {
    film,
    weekly: (film.weekly || []).map(x => ({ w: x.w, gross: Number(x.gross) || 0 })),
    domByWeek,
    ww: Number(film.ww) || 0,
    dom: Number(film.dom) || 0
  };
}

const off = runArm(false);
const on = runArm(true);

/* The configured multiplier for a single pushScreens level, no owned screens,
   no corridor, standard pricing. */
const cfg = BOC.CONFIG || {};
const lift = (cfg.pushScreens && cfg.pushScreens.lift) || 0.5;
const M = 1 + lift;

const offByWeek = new Map(off.weekly.map(x => [x.w, x.gross]));
const ratios = [];
for (const row of on.weekly) {
  const base = offByWeek.get(row.w);
  if (!base || base <= 0 || row.gross <= 0) continue;
  ratios.push({ w: row.w, r: row.gross / base });
}
const active = ratios.filter(x => x.r > 1.005).map(x => x.r).sort((a, b) => a - b);
const median = active.length ? active[Math.floor(active.length / 2)] : 1;

/* The dominant test: how much the film's *domestic total* grew per week.
   This is what the player is actually paid, and what the double-pay inflates. */
const offDom = new Map(off.domByWeek.map(x => [x.w, x.delta]));
const domRatios = [];
for (const row of on.domByWeek) {
  const base = offDom.get(row.w);
  if (!base || base <= 0 || row.delta <= 0) continue;
  domRatios.push({ w: row.w, r: row.delta / base });
}
const domActive = domRatios.filter(x => x.r > 1.005).map(x => x.r).sort((a, b) => a - b);
const domMedian = domActive.length ? domActive[Math.floor(domActive.length / 2)] : 1;

console.log("   configured multiplier M = " + M.toFixed(3));
console.log("   weekly-record gross ratios:  " +
  ratios.map(x => "w" + x.w + ":" + x.r.toFixed(2)).join(" "));
console.log("   actual dom-gain ratios:      " +
  domRatios.map(x => "w" + x.w + ":" + x.r.toFixed(2)).join(" "));
console.log("   total ww: off " + fmt(off.ww) + " → on " + fmt(on.ww) +
  " (" + (on.ww / Math.max(0.01, off.ww)).toFixed(2) + "×)");

/* 1 — what the film actually banks each week is scaled once, not twice. */
check("a levered week's domestic gain is scaled by the configured multiplier (not its square)",
  Math.abs(domMedian - M) <= M * 0.08,
  "median dom ratio " + domMedian.toFixed(3) + " vs M " + M.toFixed(3) +
  (domActive.some(r => r > M * 1.3) ? " — squared multiplier present" : ""));

/* 2 — no run can out-earn the configured multiplier. */
check("the whole run cannot exceed the configured multiplier",
  on.ww <= off.ww * M * 1.02,
  (on.ww / Math.max(0.01, off.ww)).toFixed(2) + "× vs cap " + M.toFixed(2) + "×");

/* 3 — the weekly record and the film's dom agree. */
function sumWeekly(rec) { return rec.weekly.reduce((a, x) => a + x.gross, 0); }
const drift = Math.abs(sumWeekly(on) - on.dom);
const driftPct = drift / Math.max(1, on.dom);
check("sum(weekly gross) tracks f.dom for a levered run",
  driftPct <= 0.005,
  "sum " + fmt(sumWeekly(on)) + " vs dom " + fmt(on.dom) +
  " (" + (driftPct * 100).toFixed(2) + "% drift)");

/* 4 — lever records must not report money the ledger never received. */
const uplift = (on.film.collection && on.film.collection.totals && on.film.collection.totals.uplift) || 0;
const realLift = on.dom - off.dom;
check("reported lever uplift does not exceed the gross the film actually gained",
  uplift <= realLift * 1.02 + 0.5,
  "reported " + fmt(uplift) + " vs actual dom gain " + fmt(realLift));

if (failures) { console.error("❌ collection-multiplier: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ collection-multiplier: all " + checks + " checks passed");
