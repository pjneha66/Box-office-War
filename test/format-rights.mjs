/* test/format-rights.mjs — Format & Remake Rights (v49).
 *
 * Runs the REAL data.js + engine.js + format-rights.js bundle in jsdom with a
 * seeded Math.random.
 *
 * Pins:
 *  - eligibleFilms() excludes films still in release, below $20M WW, audience <65,
 *    and already-formatted films;
 *  - sellFormat() pays upfront via the licensing ledger, flags the film as sold,
 *    records the territory;
 *  - fee formula: ww × factor (base 3% + tier×1%, capped 8%) × (1 − fatigue≤60%);
 *  - tickWeekly() remake rolls: 5%/week per sold format; if a remake beats the
 *    original opening, royalty = 25% of the fee via the licensing ledger;
 *  - each main event (sale, royalty) raises addNotification (spied).
 *
 * Run: node test/format-rights.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ format-rights: jsdom is required. Run: npm install");
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
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "format-rights.js"].map(read).join("\n;\n") + "\n;\n" + `
  global.__FR = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    FormatRights: (typeof FormatRights !== "undefined") ? FormatRights : null,
    addNotification: (typeof addNotification === "function") ? addNotification : null,
    spend: (typeof spend === "function") ? spend : null,
    earn: (typeof earn === "function") ? earn : null,
    advanceWeek: (typeof advanceWeek === "function") ? advanceWeek : null
  };`;
  const OUT = path.join(HERE, ".fr-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, FR: win.__FR };
}

function fixture(FR, seed) {
  FR.newGame("major", "Format Lab", { scenario: "standard", difficulty: "normal" });
  const G = FR.G;
  G._noSave = true;
  G.studio.cash = 1000;
  G.studio.rep = 50;
  return { G, FR };
}

/* ── 1: eligibleFilms filters ── */
{
  const { FR } = makeApp(101);
  const { G } = fixture(FR, 0);
  const hit = {
    id: "f_hit", title: "Big Hit", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10
  };
  const flop = { id: "f_flop", title: "Flop", genre: "horror", released: true, inTheaters: false,
    ww: 5, opening: 3, quality: { overall: 40, critic: 40, aud: 40 },
    budget: 30, marketing: 10, releaseWeek: G.week - 10 };
  const lowAud = { id: "f_low", title: "Low Aud", genre: "comedy", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 50, critic: 50, aud: 50 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10 };
  const stillIn = { id: "f_live", title: "Still Live", genre: "drama", released: true, inTheaters: true,
    ww: 200, opening: 120, quality: { overall: 80, critic: 80, aud: 80 },
    budget: 80, marketing: 30, releaseWeek: G.week - 2 };
  G.films.push(hit, flop, lowAud, stillIn);
  const elig = FR.FormatRights.eligibleFilms(G);
  check("eligibleFilms includes only the big hit", elig.length === 1 && elig[0].id === "f_hit", elig.map(f => f.id).join(","));
}

/* ── 2: sellFormat pays upfront + ledger + flags ── */
{
  const { FR } = makeApp(202);
  const { G } = fixture(FR, 0);
  const hit = {
    id: "f_sold", title: "Sold Format", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10
  };
  G.films.push(hit);
  const finBefore = G.weekTx.licensing || 0;
  const cashBefore = G.studio.cash;
  const res = FR.FormatRights.sellFormat("f_sold", G);
  check("sellFormat executes", res.ok === true, res.err || "");
  check("upfront fee paid via licensing ledger", (G.weekTx.licensing || 0) === finBefore + res.fee);
  check("cash increased by fee", G.studio.cash === cashBefore + res.fee);
  check("film flagged as sold", G.formatRights.sold["f_sold"] != null);
  check("fee recorded", G.formatRights.sold["f_sold"].fee === res.fee);
  check("territory recorded", typeof G.formatRights.sold["f_sold"].remakeMarkets[0] === "string");
  check("double-sell refused", FR.FormatRights.sellFormat("f_sold", G).ok === false);
}

/* ── 3: fee formula tiers and fatigue cap ── */
{
  const { FR } = makeApp(303);
  const { G } = fixture(FR, 0);
  const baseHit = { id: "f_base", title: "Base", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10 };
  const tierHit = { id: "f_tier", title: "Tier Hit", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10, franchiseName: "Tier Universe" };
  G.franchises.push({ name: "Tier Universe", tier: 3, entries: [], ww: 0, merch: 0, park: 0, gameSold: 0, decay: 1, genre: "action", earned: 0, built: G.week });
  G.films.push(baseHit, tierHit);
  G.franchises[0].entries.push({ filmId: "f_tier", title: "Tier Hit", ww: 100, week: G.week });
  const feeBase = FR.FormatRights.feeFor(baseHit);
  const feeTier = FR.FormatRights.feeFor(tierHit);
  check("tier raises the fee", feeTier > feeBase, baseHit.ww + "×base vs tier hit");
  check("base fee ≈ 3% of WW", Math.abs(feeBase - 100 * 0.03) < 0.01, feeBase);
  check("tier-3 fee ≈ 6% of WW", Math.abs(feeTier - 100 * 0.06) < 0.01, feeTier);
  /* fatigue cap: fatigue 0.9 → only 0.6 reduces */
  G.franchises[0].fatigue = 0.9;
  const feeFatigued = FR.FormatRights.feeFor(tierHit);
  const expectedFatigued = Math.round(100 * 0.06 * (1 - 0.6) * 10) / 10;
  check("fatigue capped at 60%", feeFatigued === expectedFatigued, feeFatigued + " vs " + expectedFatigued);
}

/* ── 4: tickWeekly remake royalty ── */
{
  const { FR } = makeApp(404);
  const { G, FR: M } = fixture(FR, 0);
  const hit = { id: "f_remake", title: "Remake Source", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10 };
  G.films.push(hit);
  const fee = M.FormatRights.feeFor(hit);
  const sellRes = M.FormatRights.sellFormat("f_remake", G);
  const cashBefore = G.studio.cash;
  const finBefore = G.weekTx.licensing || 0;
  /* force remake rolls to succeed every week, and the remake to beat the opening */
  const origRoll = M.FormatRights._roll.bind(M.FormatRights);
  let rollCount = 0;
  M.FormatRights._roll = () => { rollCount++; return rollCount === 1 ? 0 : 59; }; /* territory idx 0, then opening ×1.68× */
  const origChance = M.FormatRights._chance.bind(M.FormatRights);
  M.FormatRights._chance = () => true;
  /* make remake opening > original opening: roll for opening uses 60-modulus, max 1.59× */
  G.week += 1;
  M.FormatRights.tickWeekly(G);
  check("royalty paid via licensing ledger on remake beat", (G.weekTx.licensing || 0) === finBefore + Math.round(fee * 0.25 * 10) / 10);
  check("cash increased by royalty", G.studio.cash === cashBefore + Math.round(fee * 0.25 * 10) / 10);
  M.FormatRights._roll = origRoll;
  M.FormatRights._chance = origChance;
}

/* ── 5: notifications for sale and royalty ── */
{
  const { FR } = makeApp(505);
  const { G, FR: M } = fixture(FR, 0);
  const hit = { id: "f_notif", title: "Notif Hit", genre: "action", released: true, inTheaters: false,
    ww: 100, opening: 60, quality: { overall: 70, critic: 70, aud: 80 },
    budget: 40, marketing: 20, releaseWeek: G.week - 10 };
  G.films.push(hit);
  const before = (G.notifications || []).length;
  M.FormatRights.sellFormat("f_notif", G);
  check("sale notification", G.notifications.length > before, "before=" + before + " after=" + G.notifications.length);
}

process.exit(failures ? 1 : 0);
