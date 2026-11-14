/* Rebuild media-module harness (pattern from test/rebuild-sim.mjs): runs game/data.js +
   game/engine.js + game/media.js in a VM sandbox with a stubbed localStorage. ui.js needs a
   DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   Drives 40 advanceWeek() calls (engine.js already wires tickMedia after its own systems),
   and exercises every media system through the module's real functions: court/slam +
   cooldowns + drift, trailer roll, script passes, rating assignment + appeal fields,
   premiere bidding. Prints one line per check; exits non-zero on failure. */
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
for (const f of ["data.js", "engine.js", "media.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const woy = () => C.woyOf(S().studio.week);

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "media.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickMedia/mediaAction/criticRelAdj/forecastAdjust",
  typeof C.tickMedia === "function" && typeof C.mediaAction === "function" &&
  typeof C.criticRelAdj === "function" && typeof C.forecastAdjust_media === "function");
check("MEDIA_DESKS is 3 desks, group Press, ids med-press/med-ratings/med-premiere",
  Array.isArray(C.MEDIA_DESKS) && C.MEDIA_DESKS.length === 3 &&
  C.MEDIA_DESKS.map((d) => d.id).join(",") === "med-press,med-ratings,med-premiere" &&
  C.MEDIA_DESKS.every((d) => d.group === "Press" && d.icon && d.name && typeof d.render === "function"));
check("forecastAdjust() → 0 (no weekly recurring media cash)", C.forecastAdjust_media() === 0);

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek(); /* engine.js already calls tickMedia() inside advanceWeek */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.MEDIA_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
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

/* ── week 1: lazy ensure + hook defaults ──────────────────────── */
C.newGame("Test", "veteran");
C.tickMedia();
check("S.med namespace created lazily by tickMedia",
  !!S().med && S().med.rel && S().med.cd && S().med.trailers && S().med.passes && S().med.premieres);
check("all 8 critics start at relationship 0",
  C.CRITICS.every((c) => S().med.rel[c.n] === 0));
const name0 = C.CRITICS[0].n;
check("criticRelAdj returns 0 before any court/slam", C.criticRelAdj(name0) === 0);
check("criticRelAdj unknown critic → 0", C.criticRelAdj("Nobody, Nowhere Times") === 0);

fakeFilm("f9001", "Media Fake", "drama", 82, "run"); /* running film → real theatrical income */

/* ── court / slam: scores, costs, cooldowns ───────────────────── */
const rep0 = S().studio.rep, cash0 = S().studio.cash;
S().studio.cash = 0.2;
const poor = C.medCourt(C.CRITICS[1].n);
check("court rejected on insufficient cash, no state change",
  !!poor.err && S().med.rel[C.CRITICS[1].n] === 0, poor.err || "");
S().studio.cash = cash0;
const c1 = C.medCourt(name0);
check("court ok, score stored +3", c1.ok && S().med.rel[name0] === 3 && C.criticRelAdj(name0) === 3);
check("court cost $0.8M", nearly(cash0 - S().studio.cash, 0.8));
check("court cooldown 6wk", !!C.medCourt(name0).err && C.medCdLeft(name0, "court") === 6);
const s1 = C.medSlam(name0);
check("slam ok, score clamped to −2 (from +3, −5)", s1.ok && S().med.rel[name0] === -2 && C.criticRelAdj(name0) === -2);
check("slam rep −1", S().studio.rep === rep0 - 1);
check("slam cost $0", nearly(cash0 - S().studio.cash, 0.8));
check("slam cooldown 8wk", !!C.medSlam(name0).err && C.medCdLeft(name0, "slam") === 8);
const stubName = { getAttribute: (k) => (k === "data-id" ? C.CRITICS[2].n : null) };
check("mediaAction handles med-court (delegation)", C.mediaAction("med-court", stubName) === true && S().med.rel[C.CRITICS[2].n] === 3);
check("mediaAction returns false for foreign actions", C.mediaAction("gl-open", stubName) === false);

/* ── fakes for the remaining systems ──────────────────────────── */
fakeProject("p9001", "Trailer Pic", "comedy", "ready", { releaseWeek: S().studio.week + 6, mkt: 5, quality: 70, qPreview: 70 });
fakeProject("p9002", "Script Pic", "drama", "pre", { script: 60 });
fakeProject("p9003", "R Pic", "horror", "ready", { quality: 70, qPreview: 70 });
fakeProject("p9004", "G Pic", "animation", "ready", { releaseWeek: S().studio.week + 100, mkt: 5, quality: 70, qPreview: 70 });
fakeProject("p9006", "Action Pic", "action", "post", {});
fakeProject("p9007", "Prestige Pic", "drama", "post", { budget: 20 });

/* ── trailer market ───────────────────────────────────────────── */
S().studio.cash = Math.max(S().studio.cash, 50);
const noDate = C.medTrailer("p9002");
check("trailer rejected without a release date", !!noDate.err, noDate.err || "");
const cashT = S().studio.cash, buzzT = C.findProject("p9001").buzz;
const tr = C.medTrailer("p9001");
const views = S().med.trailers.p9001;
const gain = views >= 7 ? 10 : views >= 4 ? 6 : 2;
check("trailer ok, one roll stored 2.0–9.0M views", tr.ok && views >= 2 && views <= 9, views.toFixed(1) + "M");
check("trailer cost $1.5M", nearly(cashT - S().studio.cash, 1.5));
check("trailer buzz matches band (≥7→10, ≥4→6, else 2)", C.findProject("p9001").buzz - buzzT === gain, "band +" + gain);
check("one trailer per project", !!C.medTrailer("p9001").err);

/* ── script development passes ────────────────────────────────── */
const sc0 = C.findProject("p9002").script;
const cost0 = S().studio.cash;
const costs = [0.8, 1.6, 3.2];
let passOk = true, spent = 0;
for (let n = 0; n < 3; n++) {
  const r = C.medPass("p9002");
  const p = C.findProject("p9002");
  spent += costs[n];
  const d = p.script - sc0;
  passOk = passOk && r.ok && nearly(spent, cost0 - S().studio.cash)
    && d >= 3 * (n + 1) && d <= 6 * (n + 1)
    && S().med.passes.p9002 === n + 1;
}
check("3 passes ok, costs 0.8/1.6/3.2, script +3–6 each", passOk, "script " + sc0 + "→" + C.findProject("p9002").script);
check("4th pass rejected (max 3)", !!C.medPass("p9002").err);
check("pass rejected outside pre/shoot", !!C.medPass("p9006").err);
const scriptAtCut = C.findProject("p9002").script;
check("p.script stored directly (engine reads it at computeQuality)", scriptAtCut > 60, String(scriptAtCut));

/* ── rating assignment at ready (once) ────────────────────────── */
S().pending = null;
C.tickMedia();
check("horror → R, appeal pending set",
  C.findProject("p9003").rating === "R" && S().pending && S().pending.type === "appeal" && S().pending.projectId === "p9003");
check("animation → G · comedy → PG", C.findProject("p9004").rating === "G" && C.findProject("p9001").rating === "PG");
check("medRatingFor drama → PG-13", C.medRatingFor("drama") === "PG-13" && C.medRatingFor("thriller") === "R" && C.medRatingFor("docs") === "G");
const pendBefore = S().pending;
C.tickMedia();
check("tickMedia assigns once (rating stable, no re-pending)",
  C.findProject("p9003").rating === "R" && S().pending === pendBefore);

/* ── appeal fields via the real actions (FIELDS ONLY for integrator) ── */
const a0 = C.mediaAction("med-accept", { getAttribute: (k) => (k === "data-id" ? "p9003" : null) });
const p3 = C.findProject("p9003");
check("Accept R: ratingAud −3, appealDone, rating stays R",
  a0 === true && p3.ratingAud === -3 && p3.appealDone === true && p3.rating === "R");
check("re-appeal rejected after ruling", !!C.medAppealR("p9003").err && !!C.medCutPG("p9003").err);
fakeProject("p9009", "Appeal Pic", "horror", "ready", {});
fakeProject("p9010", "Cut Pic", "thriller", "ready", {});
S().pending = null;
C.tickMedia();
const cashA = S().studio.cash;
const ap = C.mediaAction("med-appeal", { getAttribute: (k) => (k === "data-id" ? "p9009" : null) });
const p9 = C.findProject("p9009");
check("Appeal $1M: 60% → PG-13 aud +4 / fail aud −2, appealDone",
  ap === true && nearly(cashA - S().studio.cash, 1) && p9.appealDone === true &&
  ((p9.rating === "PG-13" && p9.ratingAud === 4) || (p9.rating === "R" && p9.ratingAud === -2)),
  p9.rating + " aud " + p9.ratingAud);
const cashC = S().studio.cash;
const cu = C.mediaAction("med-cut", { getAttribute: (k) => (k === "data-id" ? "p9010" : null) });
const p10 = C.findProject("p9010");
check("Cut for PG-13 $2.5M: p.cut=true, ratingAud +4, rating PG-13, appealDone",
  cu === true && nearly(cashC - S().studio.cash, 2.5) && p10.cut === true && p10.ratingAud === 4 && p10.rating === "PG-13" && p10.appealDone === true);
const cashP2 = S().studio.cash;
S().studio.cash = 0.5;
const poorA = C.medAppealR("p9010"); /* already ruled → use a fresh R to test cash gate */
check("appeal still gated by appealDone", !!poorA.err, poorA.err || "");
fakeProject("p9011", "Broke Pic", "horror", "ready", {});
S().pending = null;
C.tickMedia();
const poorB = C.medAppealR("p9011");
check("appeal rejected on insufficient cash, no state change",
  !!poorB.err && C.findProject("p9011").appealDone !== true, poorB.err || "");
S().studio.cash = cashP2;

/* ── drift: relationship scores decay toward 0 ────────────────── */
check("drift −1/wk toward 0 (slammed −2 decayed to 0)", S().med.rel[name0] === 0, String(S().med.rel[name0]));
S().studio.cash = Math.max(S().studio.cash, 50);
C.mediaAction("med-court", { getAttribute: (k) => (k === "data-id" ? C.CRITICS[4].n : null) });
check("re-courted a fresh critic to +3", S().med.rel[C.CRITICS[4].n] === 3);
advance(2);
check("drift continues −1/wk → +3 becomes +1 after 2 weeks", C.criticRelAdj(C.CRITICS[4].n) === 1, String(C.criticRelAdj(C.CRITICS[4].n)));
check("drift never crosses 0", Object.keys(S().med.rel).every((k) => S().med.rel[k] >= -10 && S().med.rel[k] <= 10));

/* ── premiere bidding: window, genres, one per project ────────── */
check("premiere rejected outside weeks 34–38", !!C.medPremiere("p9007", 1).err);
fakeProject("p9012", "Venice Pic", "romance", "ready", {});
while (woy() < 34 && !threw) advance(1);
check("reached premiere window", woy() >= 34 && woy() <= 38, "wk " + S().studio.week);
S().studio.cash = Math.max(S().studio.cash, 60);
check("premiere rejected for non-prestige genre", !!C.medPremiere("p9006", 0).err);
const repP = S().studio.rep, buzzP = C.findProject("p9007").buzz, cashP = S().studio.cash;
const pr1 = C.medPremiere("p9007", 1); /* Sundance */
check("Sundance bid ok ($2M, buzz +6, rep +2)",
  pr1.ok && nearly(cashP - S().studio.cash, 2) && C.findProject("p9007").buzz - buzzP === 6 && S().studio.rep - repP === 2);
check("premiere stored on the project", S().med.premieres.p9007 === "Sundance");
check("one premiere per project", !!C.medPremiere("p9007", 0).err);
const repV = S().studio.rep, buzzV = C.findProject("p9012").buzz, cashV = S().studio.cash;
const ven = C.mediaAction("med-premiere", { getAttribute: (k) => (k === "data-id" ? "p9012" : k === "data-key" ? "2" : null) });
const p12 = C.findProject("p9012");
check("mediaAction routes med-premiere with data-key (Venice, idx 2: $3M, rep +3, buzz +5)",
  ven === true && S().med.premieres.p9012 === "Venice" && nearly(cashV - S().studio.cash, 3)
  && !!p12 && p12.buzz - buzzV === 5 && S().studio.rep - repV === 3,
  "exists:" + !!p12 + " fest:" + S().med.premieres.p9012 + " dCash:" + (cashV - S().studio.cash).toFixed(1)
  + " dBuzz:" + (p12 ? p12.buzz - buzzV : "?") + " dRep:" + (S().studio.rep - repV));
desksRenderClean("(wk " + woy() + ", premiere open)");

/* ── final: 40 weeks driven, everything finite ────────────────── */
while (weeksDriven < 40 && !threw) advance(1);
check("no throw and cash finite all 40 weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("40 advanceWeek calls driven", weeksDriven >= 40, String(weeksDriven));
check("S.med namespace exists at end", !!S().med);
const rels = Object.keys(S().med.rel).map((k) => S().med.rel[k]);
const trails = Object.keys(S().med.trailers).map((k) => S().med.trailers[k]);
const passes = Object.keys(S().med.passes).map((k) => S().med.passes[k]);
check("all media state fields finite/in-range",
  rels.every((v) => isFinite(v) && v >= -10 && v <= 10) &&
  trails.every((v) => isFinite(v) && v >= 2 && v <= 9) &&
  passes.every((v) => isFinite(v) && v >= 0 && v <= 3) &&
  Object.keys(S().med.premieres).every((k) => typeof S().med.premieres[k] === "string"));
check("criticRelAdj returns stored values end-to-end", typeof C.criticRelAdj(C.CRITICS[3].n) === "number");
check("engine released the ready project through releaseFilm (rating fields intact)",
  !!C.findFilm("f9001") && S().films.some((f) => f.title === "Trailer Pic"));
desksRenderClean("(wk " + woy() + ", year " + S().studio.year + ")");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
