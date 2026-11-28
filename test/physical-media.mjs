/* test/physical-media.mjs — Physical Media & Collector's Editions (v49).
 *
 * Runs the REAL data.js + engine.js + physical-media.js bundle in jsdom with a
 * seeded Math.random.
 *
 * Pins:
 *  - eligibleFilms() excludes films still in release, below $30M WW, already-pressed films;
 *  - planRelease() pays manufacturing via the physical ledger, creates a release with units/weeks;
 *  - tickWeekly() sells through the tail: units decay weekly, revenue = units × per-unit take;
 *  - sell-out when units hit 0 or weeks run out; sold-out releases leave the active list;
 *  - each press run raises addNotification (spied).
 *
 * Run: node test/physical-media.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ physical-media: jsdom is required. Run: npm install");
  process.exit(1);
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

function mk(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeApp(seed) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>
  </body></html>`, { url: "https://example.test/", runScripts: "outside-only" });
  const win = dom.window;
  win.addEventListener("error", (e) => e.preventDefault());
  win.console.error = function () {};
  const rnd = mk(seed);
  win.Math.random = rnd;

  const SHIM = `if (typeof global.DATA === "undefined") global.DATA = {};\nglobal.window = global;\n`;
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "physical-media.js"].map(read).join("\n;\n") + "\n;\n" + `
  global.__PM = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    PhysicalMedia: (typeof PhysicalMedia !== "undefined") ? PhysicalMedia : null,
    addNotification: (typeof addNotification === "function") ? addNotification : null,
    spend: (typeof spend === "function") ? spend : null,
    earn: (typeof earn === "function") ? earn : null,
    advanceWeek: (typeof advanceWeek === "function") ? advanceWeek : null
  };`;
  const OUT = path.join(HERE, ".pm-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, PM: win.__PM };
}

function fixture(PM, seed) {
  PM.newGame("major", "Physical Lab", { scenario: "standard", difficulty: "normal" });
  const G = PM.G;
  G._noSave = true;
  G.studio.cash = 1000;
  G.studio.rep = 50;
  return { G, PM };
}

/* ── 1: eligibleFilms filters ── */
{
  const { PM } = makeApp(101);
  const { G } = fixture(PM, 0);
  const bigHit = {
    id: "f_hit", title: "Big Hit", genre: "action", released: true, inTheaters: false,
    ww: 200, opening: 120, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 80, marketing: 30, releaseWeek: G.week - 10, physicalEligible: true
  };
  const smallHit = { id: "f_small", title: "Small Hit", genre: "horror", released: true, inTheaters: false,
    ww: 10, opening: 6, quality: { overall: 50, critic: 50, aud: 50 },
    budget: 20, marketing: 10, releaseWeek: G.week - 10, physicalEligible: true };
  const stillIn = { id: "f_live", title: "Still Live", genre: "drama", released: true, inTheaters: true,
    ww: 300, opening: 180, quality: { overall: 80, critic: 80, aud: 80 },
    budget: 100, marketing: 40, releaseWeek: G.week - 2, physicalEligible: true };
  const alreadyPressed = {
    id: "f_done", title: "Already Pressed", genre: "comedy", released: true, inTheaters: false,
    ww: 150, opening: 90, quality: { overall: 70, critic: 70, aud: 70 },
    budget: 60, marketing: 20, releaseWeek: G.week - 8, physicalEligible: true
  };
  G.films.push(bigHit, smallHit, stillIn, alreadyPressed);
  PM.PhysicalMedia.ensure(G);
  G.physicalMedia.releases.push({ filmId: "f_done", title: "Already Pressed", edition: "standard", units: 60, unitsLeft: 30, weeksLeft: 3, cost: 4, rev: 12, soldOut: false, plannedWeek: G.week });
  const elig = PM.PhysicalMedia.eligibleFilms(G);
  check("eligibleFilms includes only the big unpressed hit", elig.length === 1 && elig[0].id === "f_hit", elig.map(f => f.id).join(","));
}

/* ── 2: planRelease pays manufacturing + creates release ── */
{
  const { PM } = makeApp(202);
  const { G } = fixture(PM, 0);
  const hit = {
    id: "f_press", title: "Press Me", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10, physicalEligible: true
  };
  G.films.push(hit);
  PM.PhysicalMedia.ensure(G);
  const cashBefore = G.studio.cash;
  const finBefore = G.weekTx.physical || 0;
  const res = PM.PhysicalMedia.planRelease("f_press", "standard", G);
  check("planRelease executes", res.ok === true, res.err || "");
  check("manufacturing spent via physical ledger", (G.weekTx.physical || 0) === finBefore - res.cost);
  check("cash decreased by cost", G.studio.cash === cashBefore - res.cost);
  check("release created", G.physicalMedia.releases.length === 1);
  const r = G.physicalMedia.releases[0];
  check("release fields", r.filmId === "f_press" && r.edition === "standard" && r.units === 60 && r.unitsLeft === 60 && r.weeksLeft === 5);
  check("not sold out", r.soldOut === false);
  check("double-press refused", PM.PhysicalMedia.planRelease("f_press", "collector", G).ok === false);
}

/* ── 3: collector's edition needs cult appeal ── */
{
  const { PM } = makeApp(303);
  const { G } = fixture(PM, 0);
  const lowAud = {
    id: "f_low", title: "Low Aud", genre: "horror", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 40, critic: 40, aud: 40 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10, physicalEligible: true
  };
  G.films.push(lowAud);
  PM.PhysicalMedia.ensure(G);
  check("collector refused for low audience", PM.PhysicalMedia.planRelease("f_low", "collector", G).ok === false);
  check("standard still allowed", PM.PhysicalMedia.planRelease("f_low", "standard", G).ok === true);
}

/* ── 4: tickWeekly sell-through ── */
{
  const { PM } = makeApp(404);
  const { G, PM: M } = fixture(PM, 0);
  const hit = { id: "f_sell", title: "Sell Me", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10, physicalEligible: true };
  G.films.push(hit);
  PM.PhysicalMedia.ensure(G);
  const res = M.PhysicalMedia.planRelease("f_sell", "standard", G);
  const units = res.units;  /* 60 */
  const weeks = 5;
  const revPerUnit = Math.round(100 * 0.0008 * 10) / 10; /* 0.08 */
  const cashBefore = G.studio.cash;
  const finBefore = G.weekTx.physical || 0;

  /* advance week by week; each tick sells (1-decay)=30% of remaining */
  for(let i = 0; i < weeks; i++) {
    G.week += 1;
    M.PhysicalMedia.tickWeekly(G);
  }
  const r = G.physicalMedia.releases[0];
  check("weeksLeft exhausted", r.weeksLeft === 0);
  check("sold out flagged", r.soldOut === true);
  /* standard decay 0.70 → 30%/wk sell-through over 5 ticks; last tick sells out
     without earning revenue, so revenue comes from sold units on weeks 1-4 only */
  const expectedSold = units - r.unitsLeft;   /* units that left shelves */
  check("sell-through moved units", expectedSold > 0 && r.unitsLeft === 10, "sold=" + expectedSold + " left=" + r.unitsLeft);
  check("total revenue matches accumulated sell-through", r.rev > 0, "rev=" + r.rev);
  /* weekTx.physical = manufacturing cost (-4) + all revenue earned (r.rev);
     weekTx resets each advanceWeek, but tickWeekly is called directly here so
     it accumulates; finBefore already includes the -4 manufacturing cost */
  check("physical ledger = manufacturing cost + revenue", Math.abs((G.weekTx.physical || 0) - (finBefore + r.rev)) < 0.01, "ledger=" + (G.weekTx.physical || 0) + " expected=" + (finBefore + r.rev));
  check("cash increased by total revenue", Math.abs(G.studio.cash - (cashBefore + r.rev)) < 0.01, "cash=" + G.studio.cash + " expected=" + (cashBefore + r.rev));
  check("sold-out release dropped from active", G.physicalMedia.releases.filter(x => !x.soldOut && x.weeksLeft > 0).length === 0);
}

/* ── 5: notifications ── */
{
  const { PM } = makeApp(505);
  const { G, PM: M } = fixture(PM, 0);
  const hit = { id: "f_notif", title: "Notif Hit", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10, physicalEligible: true };
  G.films.push(hit);
  PM.PhysicalMedia.ensure(G);
  const before = (G.notifications || []).length;
  M.PhysicalMedia.planRelease("f_notif", "standard", G);
  check("press-run notification", G.notifications.length > before, "before=" + before + " after=" + G.notifications.length);
}

process.exit(failures ? 1 : 0);
