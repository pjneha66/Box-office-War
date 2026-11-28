/* test/war-room.mjs — Opening Night War Room (v48) logic tests.
 *
 * Runs the REAL data.js + engine.js + box-office-collection-engine.js +
 * war-room.js bundle in jsdom (no ui.js — these are sim-logic tests) with a
 * seeded Math.random so counter rolls are deterministic.
 *
 * Pins:
 *  - clash detection via the engine-accurate weekendCompetitors();
 *  - commit/refund/lapse cash paths through the spend()/earn() ledger;
 *  - release-time resolution (counters) and the three seam reads
 *    (openingBoostFor / weekSuppression / legsBoostFor);
 *  - the caps (own ≤ 0.12, sup ≤ 0.30, legs ≤ 0.08);
 *  - lapse refunds at 50%.
 *
 * Run: node test/war-room.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ war-room: jsdom is required. Run: npm install");
  process.exit(1);
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

/* deterministic PRNG (mulberry32) — same discipline as test/collection-engine.mjs */
function mk(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeApp(rndSeed) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>
  </body></html>`, { url: "https://example.test/", runScripts: "outside-only" });
  const win = dom.window;
  win.addEventListener("error", (e) => e.preventDefault());
  win.console.error = function () {};
  /* A constant Math.random hangs newGame's slate seeding (while-loops that
     need varied draws), so the bundle always runs on a seeded PRNG stream.
     Tests that need forced counter outcomes swap the RNG AFTER fixture()
     — see sections 3 and 4. */
  win.Math.random = mk(typeof rndSeed === "number" ? rndSeed : 987654321);

  const SHIM = `if (typeof global.DATA === "undefined") global.DATA = {};\nglobal.window = global;\n`;
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "box-office-collection-engine.js", "war-room.js"]
    .map(read).join("\n;\n") + "\n;\n" + `
  global.__WR = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    WarRoom: (typeof WarRoom !== "undefined") ? WarRoom : null,
    BoxOfficeCollection: (typeof BoxOfficeCollection !== "undefined") ? BoxOfficeCollection : null,
    expectedOpening: (typeof expectedOpening === "function") ? expectedOpening : null,
    weekendCompetitors: (typeof weekendCompetitors === "function") ? weekendCompetitors : null
  };`;
  const OUT = path.join(HERE, ".wr-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, WR: win.__WR };
}

/* Standard fixture: a ready project dated next week, one tentpole rival film
   on the same weekend, plenty of cash. */
function fixture(WR, seed) {
  WR.newGame("major", "War Lab", { scenario: "standard", difficulty: "normal" });
  const G = WR.G;
  G._noSave = true;
  G.studio.cash = 500;
  const p = {
    id: "p_war", title: "Test Clash Film", genre: "action", scale: "mid",
    budget: 80, marketing: 50, phase: "ready", released: false,
    quality: { overall: 70, critic: 70, aud: 72 }, buzz: 60, awareness: 0.3,
    releaseWeek: G.week + 1, cast: [], campaigns: []
  };
  G.projects.push(p);
  G.rivals[0].slate.push({
    week: p.releaseWeek, title: "Rival Tentpole", genre: "action", scale: "tentpole",
    weight: 20, quality: 70, opening: 0, dom: 0, decay: 0, weeksOut: 0,
    live: false, dead: false, ytdGross: 0
  });
  return { G, p, WR };
}

/* ── 1. clash detection ── */
{
  const { win, WR } = makeApp(123456789);
  const { G, p } = fixture(WR, 0);
  const clashes = WR.WarRoom.clashProjects(G);
  check("clashProjects finds the dated project against the rival slate", clashes.length === 1 && clashes[0].p.id === p.id, clashes.length + " clash(es)");
  check("the clash names the rival film", clashes.length && clashes[0].comps.some(c => c.title === "Rival Tentpole"),
    clashes.length ? String(clashes[0].comps.map(c => c.title)) : "none");

  /* a project without a date or without competition stays invisible */
  const q = Object.assign({}, p, { id: "p_undated", releaseWeek: 0, title: "Undated" });
  G.projects.push(q);
  check("undated projects never clash", !WR.WarRoom.clashProjects(G).some(c => c.p.id === "p_undated"));
}

/* ── 2. commitPlan cash path ── */
{
  const { win, WR } = makeApp(987654321);
  const { G, p, WR: M } = fixture(WR, 0);
  const cashBefore = G.studio.cash;
  const res = WR.WarRoom.commitPlan(p.id, { previews: "midnight_preview", morning: "screen_push", evening: "screen_swap" });
  check("commitPlan accepts a valid clash plan", res.ok === true, res.err || "");
  const spent = res.ok ? res.spent : 0;
  check("commitPlan charges cash through the marketing ledger",
    res.ok && G.weekTx.marketing === -spent && Math.abs((cashBefore - G.studio.cash) - spent) < 0.01,
    "spent=" + spent + " cashΔ=" + (cashBefore - G.studio.cash).toFixed(1));
  check("the plan is stored keyed by film id", !!G.warroom.plans[p.id]);
  check("a second commit is refused", WR.WarRoom.commitPlan(p.id, { previews: "midnight_preview" }).ok === false);
  check("plan cost scales with the film's marketing budget",
    G.warroom.plans[p.id].moves.every(m => m.cost >= 1 && m.cost <= 20), "");

  /* no clash → refused */
  const { WR: W2 } = { WR: null };
  void W2;
  const r2 = WR.WarRoom.commitPlan("p_missing_id", { previews: "midnight_preview" });
  check("commitPlan refuses unknown projects", r2.ok === false);

  /* cancel refunds 75% */
  const cashPre = G.studio.cash;
  const rc = WR.WarRoom.cancelPlan(p.id);
  check("cancelPlan refunds 75% of the spent cost",
    rc.ok === true && Math.abs((G.studio.cash - cashPre) - Math.round(res.spent * 0.75)) < 0.01,
    "refund=" + rc.refund);
}

/* ── 3. release resolution: counters never fire (rng pinned above any cc) ── */
{
  const { win, WR } = makeApp(31337);
  const { G, p } = fixture(WR, 0);
  win.Math.random = () => 0.999;   /* forced after fixture: chance(q) is always false */
  /* commit three effect-bearing moves: own 0.05+0.05+0.04 = 0.14 raw → cap 0.12 */
  const res = WR.WarRoom.commitPlan(p.id, { previews: "midnight_preview", morning: "screen_push", matinee: "price_cut" });
  const plan = G.warroom.plans[p.id];
  const rawOwn = plan.moves.reduce((a, m) => a + m.own, 0);
  check("raw own-boost sums above the cap (0.14 > 0.12)", Math.abs(rawOwn - 0.14) < 0.001, rawOwn.toFixed(3));

  /* the rival wins every counter roll with rnd=0.999 → chance(q)=false */
  const rec = WR.WarRoom.beforeRelease(G, p);
  check("beforeRelease arms the resolved plan", !!rec && !!G.warroom.armed[p.id]);
  check("all moves landed with no counters", rec.moves.every(m => m.kept), "countered=" + rec.countered);
  check("own-boost is capped at 0.12", Math.abs(rec.own - 0.12) < 0.001, rec.own.toFixed(3));
  check("suppression is summed and capped", rec.sup > 0 && rec.sup <= WR.WarRoom.CONFIG.maxSup, rec.sup.toFixed(3));
  check("the consumed plan leaves the plans table", !G.warroom.plans[p.id]);

  /* seam reads */
  check("openingBoostFor returns the capped own boost",
    Math.abs(WR.WarRoom.openingBoostFor(p, G) - 0.12) < 0.001);
  check("weekSuppression returns the plan's suppression for its week",
    Math.abs(WR.WarRoom.weekSuppression(G, p.releaseWeek) - rec.sup) < 0.001);
  check("weekSuppression ignores other weeks", WR.WarRoom.weekSuppression(G, p.releaseWeek + 1) === 0);

  /* openingMultiplier picks the war plan up through the single-payer seam */
  const mPlain = WR.BoxOfficeCollection.openingMultiplier(p, G);
  check("openingMultiplier reflects the war plan (≥ 1 + 0.12 → clamped)", mPlain >= 1.12 - 1e-9, mPlain.toFixed(3));
  check("the total stack still respects the collection clamp (≤1.32)", mPlain <= 1.32 + 1e-9, mPlain.toFixed(3));

  /* legs read on the released film object (same id) */
  const film = { id: p.id, genre: "action", quality: { overall: 70 }, releaseWeek: p.releaseWeek };
  check("legsBoostFor returns the plan's legs value",
    Math.abs(WR.WarRoom.legsBoostFor(film, G) - rec.legs) < 0.001);

  /* armed entries expire one week after the plan week */
  G.week = rec.week + 2;
  WR.WarRoom.tickWeekly(G);
  check("armed entries are swept after the legs read", !G.warroom.armed[p.id]);
  check("the recap survives the sweep", !!G.warroom.recaps[p.id]);
}

/* ── 4. release resolution: counters always fire (rng pinned below any cc) ── */
{
  const { win, WR } = makeApp(42424);
  const { G, p } = fixture(WR, 0);
  win.Math.random = () => 0.001;   /* forced after fixture: every counter lands */
  WR.WarRoom.commitPlan(p.id, { previews: "midnight_preview", evening: "influencer_blast" });
  const rec = WR.WarRoom.beforeRelease(G, p);
  check("a fully-countered plan keeps zero own boost", rec.own === 0, rec.own.toFixed(3));
  check("every move shows as countered in the recap", rec.moves.every(m => !m.kept), "countered=" + rec.countered);
  check("weekSuppression reads zero when everything was countered",
    WR.WarRoom.weekSuppression(G, p.releaseWeek) === 0);
}

/* ── 5. lapse refund ── */
{
  const { win, WR } = makeApp(777);
  const { G, p } = fixture(WR, 0);
  const res = WR.WarRoom.commitPlan(p.id, { previews: "midnight_preview" });
  const spent = res.spent;
  /* the release week passes without a release → resync sees no date → lapse */
  G.week = p.releaseWeek + 3;
  G.projects.length = 0;              /* the project vanished (e.g. shelved) */
  const cashBefore = G.studio.cash;
  WR.WarRoom.tickWeekly(G);
  check("a lapsed plan refunds 50%", Math.abs((G.studio.cash - cashBefore) - spent / 2) < 0.01,
    "refund=" + (G.studio.cash - cashBefore).toFixed(1));
  check("the lapsed plan is deleted", !G.warroom.plans[p.id]);
}

/* ── 6. plan resync on date moves ── */
{
  const { win, WR } = makeApp(555);
  const { G, p } = fixture(WR, 0);
  WR.WarRoom.commitPlan(p.id, { previews: "midnight_preview" });
  p.releaseWeek += 2;                  /* player moved the date */
  WR.WarRoom.tickWeekly(G);
  check("moving the release date resyncs the plan week without refund",
    G.warroom.plans[p.id] && G.warroom.plans[p.id].week === p.releaseWeek);
}

process.exit(failures ? 1 : 0);
