/* test/collection-engine.mjs — Box Office Collection Command harness.
 *
 * Loads the real data.js + engine.js + box-office-collection-engine.js into one
 * flat Node scope (the same trick test/smoke.js uses for browser scripts), then:
 *   1. measures one film lifecycle with the levers OFF vs ON from an identical
 *      snapshot and RNG seed, so the only difference is the levers,
 *   2. proves the valve caps runaway weeks, clocks expire and gates hold,
 *   3. round-trips a save and proves a pre-v43 save still loads.
 *
 * Run: npm run test:collection
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
/* Two seeded streams. The fairness harness hands the same stream to both arms
   so a lever A/B is not measuring RNG luck. Seeded xorshift32, no deps. */
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

global.__BOW = {
  get G(){ return G; },
  set G(v){ G = v; },
  newGame, releaseFilm, advanceWeeks, saveGame, loadGame, expectedOpening,
  DATA, fmtM, fmtG, activeFilms, legsOf,
  BoxOfficeCollection,
  localStorage: global.localStorage
};
`;

const OUT = path.join(HERE, ".collection-generated.cjs");
fs.writeFileSync(OUT, bundle);

let BOW;
try {
  const { pathToFileURL } = await import("node:url");
  await import(pathToFileURL(OUT).href);
  BOW = globalThis.__BOW;
} finally {
  try { fs.unlinkSync(OUT); } catch {}
}

const { BoxOfficeCollection: BOC } = BOW;
if (!BOC) { console.error("❌ BoxOfficeCollection did not load — module export missing"); process.exit(1); }

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}
const fmt = BOW.fmtG;

/* ── seeded RNG control ────────────────────────────────────────── */
function mk(seed) { let st = seed >>> 0; return () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; }; }
function resetStreams() { globalThis.__seedA = mk(987654321); globalThis.__seedB = mk(123456789); globalThis.rnd = globalThis.__seedA; }
let __flip = 0;
/* Give the next simulated week to a stream. Both arms of an A/B therefore see
   the same market randomness week for week, so a lever is the only variable. */
function armTurn(arm) { __flip++; globalThis.rnd = (arm === 0) ? (__flip % 2 ? globalThis.__seedA : globalThis.__seedB) : globalThis.__seedA; }

/* ── synthetic release ─────────────────────────────────────────── */
function makeFilm(G, opts) {
  const o = Object.assign({
    id: 99001, title: "Measure Picture", genre: "action", scale: "tentpole",
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
  const expected = BOW.expectedOpening(p, G.week);
  const f = BOW.releaseFilm(p);
  f.__expected = expected;
  return f;
}

/* Build one released film, save it, and hand back the snapshot key. */
function buildReleased(opts) {
  resetStreams();
  BOW.newGame("major", "Collection Lab");
  const G = BOW.G;
  G._noSave = true;
  G.tutorial = null;
  G.studio.cash = 4000;
  G.studio.debt = 0;
  const film = makeFilm(G, opts);
  G.films = [film];
  G._noSave = false;                 /* the snapshot must actually be written */
  BOW.saveGame();
  if (!BOW.localStorage.getItem("bow_save")) throw new Error("buildReleased: snapshot not written");
  G._noSave = true;
  return film;
}

/* One arm of the A/B: identical starting snapshot, identical RNG stream. */
function armFromSnapshot(mode, opts, plan, weeks) {
  resetStreams();
  BOW.loadGame();
  const G = BOW.G;
  G._noSave = true;
  const film = (G.films || []).filter(f => f && String(f.id) === String(opts.id))[0];
  if (!film) throw new Error("armFromSnapshot: snapshot lost the film (films=" + (G.films || []).length + ")");
  const rec = {
    opening: film.opening, expected: film.__expected, spent: 0, refused: [], weeks: 0
  };
  for (let w = 0; w < (weeks || 24); w++) {
    if (mode) {
      plan.filter(x => x.week === w + 1).forEach(x => {
        const before = G.studio.cash;
        const res = BOC.applyLever(x.key, film.id);
        if (res && res.ok) rec.spent += (before - G.studio.cash);
        else if (res && !res.ok) rec.refused.push(x.key + ": " + res.reason);
      });
    }
    armTurn(0);
    BOW.advanceWeeks(1);
    /* a real player dismisses modals; keep the scheduled run on its date */
    G.pendingChoice = null; G.pendingReport = null; G.pendingEarnings = null; G.pendingAuction = null; G.pendingSports = null;
    (G.projects || []).forEach(pr => { if (pr.phase === "ready" && !pr.releaseWeek) pr.releaseWeek = G.week + 1; });
    if (!G.films.includes(film)) G.films.push(film);
    rec.weeks++;
  }
  rec.ww = film.ww || 0;
  rec.dom = film.dom || 0;
  rec.uplift = (film.collection && film.collection.totals && film.collection.totals.uplift) || 0;
  rec.merch = (film.collection && film.collection.totals && film.collection.totals.merch) || 0;
  rec.ended = !film.inTheaters;
  rec.film = film;
  return rec;
}

/* ── 1. lifecycle A/B ──────────────────────────────────────────── */
console.log("── lifecycle measurement (same snapshot, same seed) ───────");
const TENT = { id: 99101, title: "Measurement Tentpole", genre: "action", scale: "tentpole", budget: 180, marketing: 90, quality: 78, premium: true, imax: true };
buildReleased(TENT);
const PLAN = [
  { week: 1, key: "pushScreens" },
  { week: 3, key: "eventPricing" },
  { week: 5, key: "intlBlitz" },
  { week: 7, key: "merchWindow" }
];
const off = armFromSnapshot(false, TENT, PLAN, 26);
const on = armFromSnapshot(true, TENT, PLAN, 26);

console.log("   expected at release: " + fmt(off.expected) + " → opening " + fmt(off.opening) + " (both arms)");
console.log("   baseline: ww " + fmt(off.ww) + " · dom " + fmt(off.dom));
console.log("   pushed:   ww " + fmt(on.ww) + " · dom " + fmt(on.dom) + " · lever collect " + fmt(on.uplift) +
  " · merch " + fmt(on.merch) + " · lever spend " + fmt(on.spent));
if (on.refused.length) on.refused.forEach(r => console.log("   refused → " + r));

check("release path works (film opened)", off.opening > 1, "opening " + fmt(off.opening));
check("identical snapshots open identically", Math.abs(on.opening - off.opening) < 0.01,
  fmt(off.opening) + " vs " + fmt(on.opening));
check("levers produce real money", on.uplift > 0.5, "uplift " + fmt(on.uplift));
check("pushed run grosses more than baseline", on.ww > off.ww * 1.05,
  fmt(off.ww) + " → " + fmt(on.ww) + " (" + Math.round((on.ww / Math.max(0.01, off.ww) - 1) * 100) + "% up)");
check("a fully pushed tentpole lifts its worldwide run by at least 30%", on.ww >= off.ww * 1.30,
  Math.round(on.ww / Math.max(0.01, off.ww) * 100) / 100 + "× baseline");
check("the levers collect more than they cost", (on.uplift + on.merch) > on.spent,
  "collect " + fmt(on.uplift + on.merch) + " vs spend " + fmt(on.spent));
check("all figures finite", [off.opening, off.ww, on.ww, on.uplift, on.merch].every(Number.isFinite));

/* Merch gets its own licensed-property picture, where the lever belongs. */
const TOY = { id: 99103, title: "Toy Line Picture", genre: "animation", scale: "mid", budget: 80, marketing: 45, quality: 80, premium: false, imax: false };
buildReleased(TOY);
const toyOff = armFromSnapshot(false, TOY, [], 20);
const toyOn = armFromSnapshot(true, TOY, [{ week: 2, key: "merchWindow" }, { week: 2, key: "pushScreens" }], 20);
console.log("   merchandised animation: ww " + fmt(toyOn.ww) + " (baseline " + fmt(toyOff.ww) + ") · merch " + fmt(toyOn.merch));
check("merch window pays out on a licensable picture", toyOn.merch > 0.05,
  "merch " + fmt(toyOn.merch) + " (baseline " + fmt(toyOff.merch) + ")");

/* ── 2. the valve ──────────────────────────────────────────────── */
console.log("── valve behaviour ────────────────────────────────────────");
{
  resetStreams();
  BOW.newGame("major", "Valve Lab");
  const G = BOW.G; G._noSave = true; G.studio.cash = 4000;
  const f1 = makeFilm(G, { id: 99201, title: "Valve Tentpole", scale: "tentpole", budget: 280, marketing: 130, quality: 85 });
  const f2 = makeFilm(G, { id: 99202, title: "Valve Second", scale: "tentpole", budget: 260, marketing: 120, quality: 82 });
  G.films = [f1, f2];
  ["pushScreens", "eventPricing", "intlBlitz"].forEach(k => {
    BOC.applyLever(k, f1.id);
    BOC.applyLever(k, f2.id);
  });
  const valve = BOC.valveOf(G);
  let worstOverrun = 0, weeksRun = 0;
  for (let w = 0; w < 12; w++) {
    BOW.advanceWeeks(1);
    G.pendingChoice = null; G.pendingReport = null; G.pendingAuction = null; G.pendingSports = null;
    if (!G.films.includes(f1)) G.films.push(f1);
    if (!G.films.includes(f2)) G.films.push(f2);
    const wk = BOC.state(G).weekly;
    worstOverrun = Math.max(worstOverrun, wk.uplift - valve);
    weeksRun++;
  }
  check("valve is finite and positive", Number.isFinite(valve) && valve > 0, "valve " + fmt(valve));
  check("weekly uplift never exceeds the valve", worstOverrun <= 0.2, "worst overrun " + fmt(worstOverrun));
  check("the valve scales with the live slate", valve > 60, "valve " + fmt(valve) + " over " + weeksRun + " weeks");
  check("damping is reported to the desk", typeof BOC.state(G).weekly.damped === "number");
}

/* ── 3. clocks and eligibility ─────────────────────────────────── */
console.log("── clocks + eligibility ───────────────────────────────────");
{
  const CLOCK = { id: 99301, title: "Clock Picture", genre: "drama", scale: "mid", budget: 60, marketing: 30, quality: 70, premium: false, imax: false };
  buildReleased(CLOCK);
  resetStreams();
  BOW.loadGame();
  const G = BOW.G; G._noSave = true;
  const f = G.films[0];
  const okPush = BOC.applyLever("pushScreens", f.id);
  check("screen push applies on a live run", okPush.ok === true, JSON.stringify(okPush.reason || ""));
  const recNow = BOC.state(G).bump[String(f.id)] || {};
  check("lever clock starts at its configured length",
    BOC.isRunning(f, "pushScreens") && recNow.pushScreens && recNow.pushScreens.weeksLeft === BOC.CONFIG.pushScreens.weeks,
    "weeksLeft " + JSON.stringify(recNow.pushScreens));
  const again = BOC.applyLever("pushScreens", f.id);
  check("a running lever refuses a second booking", again.ok === false && /already running/i.test(again.reason || ""), again.reason);
  const badPricing = BOC.canApply("eventPricing", f);
  check("event pricing gates a small drama without PLF", badPricing.ok === false, badPricing.reason);
  const badRelaunch = BOC.canApply("relaunch", f);
  check("re-release gates a picture still in theaters", badRelaunch.ok === false, badRelaunch.reason);
  for (let i = 0; i < BOC.CONFIG.pushScreens.weeks + 1; i++) {
    BOW.advanceWeeks(1);
    G.pendingChoice = null; G.pendingReport = null; G.pendingAuction = null; G.pendingSports = null;
    if (!G.films.includes(f)) G.films.push(f);
  }
  check("lever clock expires", !BOC.isRunning(f, "pushScreens"),
    "weeksLeft " + JSON.stringify((BOC.state(G).bump[String(f.id)] || {}).pushScreens));
}

/* ── 4. save compatibility ─────────────────────────────────────── */
console.log("── save compatibility ─────────────────────────────────────");
{
  const SAVE = { id: 99401, title: "Save Picture", scale: "mid", budget: 60, marketing: 30, quality: 72 };
  buildReleased(SAVE);
  resetStreams();
  BOW.loadGame();
  const G = BOW.G; G._noSave = true;
  const f = G.films[0];
  BOC.applyLever("pushScreens", f.id);
  BOW.advanceWeeks(1);
  const snapshot = JSON.parse(JSON.stringify(G));
  check("collection state serialises",
    !!(snapshot.collection && Array.isArray(snapshot.collection.history) && snapshot.collection.bump[String(f.id)]),
    "history " + (snapshot.collection?.history?.length || 0) + " rows");

  const legacy = JSON.parse(JSON.stringify(G));
  delete legacy.collection;
  (legacy.films || []).forEach(x => { delete x.collection; });
  const st = BOC.state(legacy);
  check("a pre-v43 save lazy-initialises collection state", !!(st && st.bump && Array.isArray(st.history)), "screens " + st.bump.screens);
  const keep = BOW.G;
  BOW.G = legacy;
  legacytick();
  function legacytick() {
    try { BOW.advanceWeeks(1); } catch (e) { check("a pre-v43 save ticks without crashing", false, e.message); return; }
    check("a pre-v43 save ticks without crashing", Number.isFinite(BOW.G.studio.cash), "cash " + BOW.fmtM(BOW.G.studio.cash));
  }
  BOW.G = keep;
}

/* ── 5. desk render ────────────────────────────────────────────── */
console.log("── desk render ────────────────────────────────────────────");
{
  const html = BOC.html();
  check("desk renders a modal title", /Collection Command/.test(html));
  check("desk renders standing levers", /Circuit Screens/.test(html) && /Booking Corridor/.test(html) && /Discount Tuesday/.test(html));
  check("desk renders the coffer", /Collected this week/.test(html) && /Lever uplift this week/.test(html));
  check("desk binds its actions", /data-boc-bump=/.test(html));
}

console.log("");
if (failures) { console.error("❌ collection-engine: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ collection-engine: all " + checks + " checks passed");
