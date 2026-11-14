/* Rebuild Library-module harness (pattern from test/rebuild-pr.mjs): runs game/data.js +
   game/engine.js + game/library.js in a VM sandbox with a stubbed localStorage. ui.js needs
   a DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   Drives 30+ advanceWeek() calls, calling tickLibrary() after each (per the wave-2 brief;
   the engine's own tickLibrary hook is already live, so the extra call is a guarded no-op).
   Exercises filmTerritoryRows, fan tiers + buzz accrual on an announced project, sandbox
   signings and rival meddling through libAction and the module's real functions.
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
for (const f of ["data.js", "engine.js", "library.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "library.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickLibrary/libAction/filmTerritoryRows/forecastAdjust",
  typeof C.tickLibrary === "function" && typeof C.libAction === "function" &&
  typeof C.filmTerritoryRows === "function" && typeof C.forecastAdjust === "function");
check("LIB_DESKS is 3 shaped desks in the Library & fans group",
  Array.isArray(C.LIB_DESKS) && C.LIB_DESKS.length === 3 &&
  C.LIB_DESKS.map((d) => d.id).join(",") === "library-desk,fan-club,sandbox" &&
  C.LIB_DESKS.every((d) => d.group === "Library & fans" && d.icon && d.name && typeof d.render === "function"));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function afterAdvance() {
  const st = S().studio;
  if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return false; }
  if (st.cash < minCash) minCash = st.cash;
  if (S().over) { threw = "studio went bankrupt at week " + st.week; return false; }
  return true;
}
function cycle() { /* advanceWeek + tickLibrary, guarded */
  try { C.advanceWeek(); C.tickLibrary(); } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); return false; }
  weeksDriven++;
  return afterAdvance();
}
function advance(n) { for (let i = 0; i < n && cycle(); i++); }
/* one full week: capture buzz, then advanceWeek (the engine's tickLibrary hook fires
   inside) plus the brief's manual tickLibrary() call — the idempotency guard makes the
   extra call a no-op. Engine viral events (inside advanceWeek) add exactly +3.0 to one
   random project, so deltas are amt or amt+3 on the announced project, 0 or 3 on the
   unannounced one. Anything else means the module's accrual is broken. */
function measuredWeek(projA, projB) {
  const bA = projA.buzz, bB = projB.buzz;
  try { C.advanceWeek(); C.tickLibrary(); } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); return { ok: false };
  }
  weeksDriven++;
  if (!afterAdvance()) return { ok: false };
  return {
    ok: true,
    dA: Math.round((projA.buzz - bA) * 10) / 10,
    dB: Math.round((projB.buzz - bB) * 10) / 10
  };
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.LIB_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}
/* fm() money values out of an HTML string; pass only the rows part (strip note rows) */
function moneyVals(html) {
  const out = [], re = /\$([0-9]+(\.[0-9])?)M/g;
  let m;
  while ((m = re.exec(html))) out.push(parseFloat(m[1]));
  return out;
}
function fakeFilmDone(id, title, genre, ww, profit, intl, franchiseOf, restored) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening: 30, legs: 2.6, decay: 1 - 1 / 2.6, weeksOut: 0, dom: ww - intl, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: franchiseOf || null,
    restored: !!restored, intl: intl, ww: ww, profit: profit, status: "done"
  });
}
function fakeProject(id, title, genre, releaseWeek) {
  S().projects.push({
    id, title, genre, scale: "micro", budget: 5, budgetNow: 5,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: null, releaseWeek: releaseWeek,
    phase: "ready", phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: 2 },
    overrun: 0, scandal: false, buzz: 0, franchiseOf: null, prodScore: 55
  });
}
const stub = { getAttribute: () => null };
const keyStub = (k) => ({ getAttribute: (name) => (name === "data-key" ? k : null) });

/* ── week 1: lazy ensure ──────────────────────────────────────── */
C.newGame("Library Test Studios", "veteran");
C.tickLibrary();
check("S.lib namespace created lazily by tickLibrary", !!S().lib && !!S().lib.fan && S().lib.fan.tier === 0 && S().lib.custom === 0);
check("forecastAdjust returns 0 (no cash flows)", C.forecastAdjust() === 0 && C.forecastAdjust(7) === 0);
S().studio.cash = 400;

/* ── library desk: empty, then 3 done films ───────────────────── */
check("library desk empty state (w1)", C.LIB_DESKS[0].render().indexOf("No finished films yet") >= 0);
desksRenderClean("(w1, empty catalogue)");

fakeFilmDone("f9101", "Winter Harbor", "drama", 120, 30, 60, null, false);
fakeFilmDone("f9102", "Dragon Fury II", "action", 300, 80, 180, "Dragon Fury", false);
fakeFilmDone("f9103", "The Cellar", "horror", 60, -10, 24, null, true);

const libHtml = C.LIB_DESKS[0].render();
check("library rows carry ww + green/red profit tags", libHtml.indexOf("$300M") >= 0 && libHtml.indexOf("tag green") >= 0 && libHtml.indexOf("tag red") >= 0);
check("library rows carry franchise + restored tags", libHtml.indexOf("Sequel · Dragon Fury") >= 0 && libHtml.indexOf("Restored") >= 0);
check("library header totals present", libHtml.indexOf("Finished films") >= 0 && libHtml.indexOf("Worldwide gross total") >= 0 && libHtml.indexOf("Catalog value") >= 0);
C.libAction("lib-filter", keyStub("hits"));
check("hits filter keeps profitable films only",
  C.LIB_DESKS[0].render().indexOf("The Cellar") < 0 && C.LIB_DESKS[0].render().indexOf("Winter Harbor") >= 0);
C.libAction("lib-filter", keyStub("franchise"));
check("franchise filter keeps only franchise films",
  C.LIB_DESKS[0].render().indexOf("Dragon Fury II") >= 0 && C.LIB_DESKS[0].render().indexOf("Winter Harbor") < 0);
C.libAction("lib-filter", keyStub("all"));

/* ── filmTerritoryRows hook: 6 statrows, sums ≈ intl ──────────── */
const f1 = C.findFilm("f9101"), f2 = C.findFilm("f9102"), f3 = C.findFilm("f9103");
const rows1 = C.filmTerritoryRows(f1);
check("territory rows: string with fm money", typeof rows1 === "string" && rows1.indexOf("$") >= 0);
const newsLen0 = S().news.length;
check("territory rows: exactly 6 statrows", rows1.split('class="statrow"').length - 1 === 6);
const vals1 = moneyVals(rows1.split('class="empty"')[0]);
check("territory rows: 6 money values", vals1.length === 6, JSON.stringify(vals1));
check("territory rows: drama sum ≈ intl 60", nearly(vals1.reduce((a, b) => a + b, 0), 60, 1), "sum " + vals1.reduce((a, b) => a + b, 0));
check("territory rows: Europe ≈ 0.30×intl", nearly(vals1[0], 18, 0.3), String(vals1[0]));
check("territory rows: pure — same string on repeat call", C.filmTerritoryRows(f1) === rows1);
check("territory rows: pure — no news logged", S().news.length === newsLen0);
const rows2 = C.filmTerritoryRows(f2), vals2 = moneyVals(rows2.split('class="empty"')[0]);
check("territory rows: action sum ≈ intl 180", nearly(vals2.reduce((a, b) => a + b, 0), 180, 1.2), "sum " + vals2.reduce((a, b) => a + b, 0));
check("territory rows: action Asia-Pacific boosted", vals2[1] >= 0.24 * 180, String(vals2[1]));
const rows3 = C.filmTerritoryRows(f3), vals3 = moneyVals(rows3.split('class="empty"')[0]);
check("territory rows: horror sum ≈ intl 24", nearly(vals3.reduce((a, b) => a + b, 0), 24, 1), "sum " + vals3.reduce((a, b) => a + b, 0));
check("territory rows: horror China reduced below base share", vals3[4] < 0.12 * 24, String(vals3[4]));
check("territory rows: skew note present", rows3.indexOf("skew") >= 0);
check("territory rows: running film without intl → empty", C.filmTerritoryRows({ genre: "drama", status: "run" }) === "" && C.filmTerritoryRows(null) === "");

/* ── fan club: buys + weekly buzz accrual ─────────────────────── */
fakeProject("p9101", "Summer Slate", "comedy", S().studio.week + 100);   /* announced */
fakeProject("p9102", "Unscheduled Drama", "drama", null);                /* no release date */
const projA = C.findProject("p9101"), projB = C.findProject("p9102");

const cash0 = S().studio.cash;
check("fan tier 1 bought via libAction", C.libAction("lib-fan-buy", stub) === true && S().lib.fan.tier === 1);
check("fan tier 1 charged $8M", nearly(cash0 - S().studio.cash, 8));
let m = measuredWeek(projA, projB);
check("tier 1 accrues +0.5/wk on the announced project", m.ok && (nearly(m.dA, 0.5) || nearly(m.dA, 3.5)), "Δ" + m.dA);
check("tier 1 never accrues on unannounced projects", m.ok && (nearly(m.dB, 0) || nearly(m.dB, 3)), "Δ" + m.dB);
const bIdem = projA.buzz;
C.tickLibrary();
check("tickLibrary idempotent within one week", nearly(projA.buzz - bIdem, 0));

check("fan tier 2 bought via libAction", C.libAction("lib-fan-buy", stub) === true && S().lib.fan.tier === 2);
m = measuredWeek(projA, projB);
check("tier 2 accrues +1.0/wk on the announced project", m.ok && (nearly(m.dA, 1) || nearly(m.dA, 4)), "Δ" + m.dA);
check("fan tier 3 bought via libAction", C.libAction("lib-fan-buy", stub) === true && S().lib.fan.tier === 3);
m = measuredWeek(projA, projB);
check("tier 3 accrues +1.5/wk on the announced project", m.ok && (nearly(m.dA, 1.5) || nearly(m.dA, 4.5)), "Δ" + m.dA);
check("fan tier 4 out of range rejected", C.libAction("lib-fan-buy", stub) === true && S().lib.fan.tier === 3);

/* ── sandbox: bespoke talent ──────────────────────────────────── */
const m0 = S().market.length;
check("prodigy signed via libAction, market grew", C.libAction("lib-prodigy", stub) === true && S().market.length === m0 + 1 && S().lib.custom === 1);
let t = S().market[S().market.length - 1];
check("prodigy power ∈ [2,3] · skill ∈ [60,80] · age ∈ [18,22]",
  t.power >= 2 && t.power <= 3 && t.skill >= 60 && t.skill <= 80 && t.age >= 18 && t.age <= 22,
  "p" + t.power + " s" + t.skill + " age" + t.age);
check("prodigy fee re-derived from fee table", t.fee === (t.k === "actor" ? C.FEE_ACTOR[t.power - 1] : C.FEE_DIR[t.power - 1]), t.k + " fee " + t.fee);
check("specialist signed via libAction", C.libAction("lib-specialist", stub) === true && S().lib.custom === 2);
t = S().market[S().market.length - 1];
check("specialist power 3 · skill ∈ [70,85]", t.power === 3 && t.skill >= 70 && t.skill <= 85, "p" + t.power + " s" + t.skill);
check("specialist fit = two same-genre entries", t.fit.length === 2 && t.fit[0] === t.fit[1], t.fit.join("/"));
check("legend signed via libAction", C.libAction("lib-legend", stub) === true && S().lib.custom === 3);
t = S().market[S().market.length - 1];
check("legend power 5 · skill ∈ [80,95]", t.power === 5 && t.skill >= 80 && t.skill <= 95, "p" + t.power + " s" + t.skill);
check("sandbox signings logged to news", S().news.some((n) => n.txt.indexOf("joins the roster") >= 0) && S().news.some((n) => n.txt.indexOf("prodigy") >= 0));

/* ── sandbox: rival meddling (ytd set for every rival so the pick is deterministic) ── */
S().rivals.forEach((r, i) => { r.ytd = i === 0 ? 500 : i === 2 ? 50 : 200; });
S().rivals[0].power = 1.2; S().rivals[2].power = 0.92;
const rep0 = S().studio.rep;
check("undercut hits strongest rival by ytd (×0.9)", C.libAction("lib-undercut", stub) === true && nearly(S().rivals[0].power, 1.08), String(S().rivals[0].power));
check("undercut costs rep −1", S().studio.rep === rep0 - 1);
check("boost hits weakest rival by ytd (+0.08)", C.libAction("lib-boost", stub) === true && nearly(S().rivals[2].power, 1.0), String(S().rivals[2].power));
check("undercut news line logged", S().news.some((n) => n.txt.indexOf("loses ground") >= 0));

/* ── insufficient-cash rejections: no state change, no spend ──── */
S().studio.cash = 1;
S().lib.fan.tier = 0;
const mBefore = S().market.length, customBefore = S().lib.custom, pow0 = S().rivals[0].power, pow2 = S().rivals[2].power;
check("fan buy rejected without cash", C.libAction("lib-fan-buy", stub) === true && S().lib.fan.tier === 0 && nearly(S().studio.cash, 1));
check("prodigy rejected without cash", C.libAction("lib-prodigy", stub) === true && S().market.length === mBefore && nearly(S().studio.cash, 1));
check("legend rejected without cash", C.libAction("lib-legend", stub) === true && S().market.length === mBefore && S().lib.custom === customBefore);
check("undercut rejected without cash", C.libAction("lib-undercut", stub) === true && nearly(S().rivals[0].power, pow0));
check("boost rejected without cash", C.libAction("lib-boost", stub) === true && nearly(S().rivals[2].power, pow2));
S().studio.cash = 300;
S().lib.fan.tier = 3; /* restore tier for the long loop's accrual assertions */

/* ── dispatch edge cases ──────────────────────────────────────── */
check("libAction ignores foreign actions", C.libAction("tv-launch-streamer", stub) === false && C.libAction("gl-open", stub) === false);
check("libAction ignores unknown lib- actions", C.libAction("lib-nonsense", stub) === false);
check("libAction lib-filter safe with null elx", C.libAction("lib-filter", null) === true);

/* ── desk contents at tier 3 with signings ────────────────────── */
check("fan desk shows Legion and weekly buzz", C.LIB_DESKS[1].render().indexOf("Legion") >= 0 && C.LIB_DESKS[1].render().indexOf("+1.5/wk") >= 0);
const sbHtml = C.LIB_DESKS[2].render();
check("sandbox desk lists all five tools + counter",
  sbHtml.indexOf("prodigy") >= 0 && sbHtml.indexOf("specialist") >= 0 && sbHtml.indexOf("legend") >= 0 &&
  sbHtml.indexOf("Undercut") >= 0 && sbHtml.indexOf("Boost") >= 0 && sbHtml.indexOf("Bespoke signings") >= 0);
desksRenderClean("(mid-game, tier 3, 3 signings)");

/* ── 30 measured weeks at tier 3: accrual sums to exactly +45 (viral +3 tolerated) ── */
let buzzSum = 0, viralWeeks = 0, ok = true;
for (let i = 0; i < 30; i++) {
  m = measuredWeek(projA, projB);
  if (!m.ok) { ok = false; break; }
  if (!(nearly(m.dA, 1.5) || nearly(m.dA, 4.5))) { threw = "week " + S().studio.week + ": unexpected announced-project buzz delta " + m.dA; ok = false; break; }
  if (!(nearly(m.dB, 0) || nearly(m.dB, 3))) { threw = "week " + S().studio.week + ": unannounced project accrued buzz (" + m.dB + ")"; ok = false; break; }
  if (m.dA > 2) viralWeeks++;
  buzzSum += m.dA;
}
check("30 weeks driven without throw, cash finite every week", ok && threw === null, threw || weeksDriven + " weeks so far, min cash " + Math.round(minCash) + "M");
check("30 weeks × tier-3 accrual = exactly +45.0 on the announced project", nearly(buzzSum - 3 * viralWeeks, 45, 0.05), "raw Σ" + Math.round(buzzSum * 10) / 10 + " · " + viralWeeks + " viral week(s)");

/* ── final state checks ───────────────────────────────────────── */
check("announced project never auto-released", !!C.findProject("p9101") && projA.releaseWeek > S().studio.week);
check("S.lib fields finite at end", Number.isFinite(S().lib.fan.tier) && Number.isFinite(S().lib.custom) && Number.isFinite(S().lib.lastTick));
check("no NaN leaked into S.lib", JSON.stringify(S().lib).indexOf("NaN") < 0);
check("S.studio.cash finite at end", isFinite(S().studio.cash), Math.round(S().studio.cash) + "M");
desksRenderClean("(after 30-week run)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
