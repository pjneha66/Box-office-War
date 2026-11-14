/* Rebuild Exhibition-module harness (pattern from test/rebuild-pr.mjs): runs game/data.js +
   game/engine.js + game/exhibition.js in a VM sandbox with a stubbed localStorage. ui.js needs
   a DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   Drives advanceWeek() calling tickExhibition() after each (the integrator's wiring) — a 40-week
   main drive plus soak weeks to 60+ — and exercises every exhibition system through the module's
   real functions: chain buy (incl. insufficient-rep and insufficient-cash rejections), upgrades,
   PLF mastering, concession deals, previews, re-releases. Prints one line per check; exits
   non-zero on failure. */
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
for (const f of ["data.js", "engine.js", "exhibition.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "exhibition.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickExhibition/exhibitionAction/exhibitionGrossMult/rentalSplitMult/plfOpeningMult",
  typeof C.tickExhibition === "function" && typeof C.exhibitionAction === "function" &&
  typeof C.exhibitionGrossMult === "function" && typeof C.rentalSplitMult === "function" &&
  typeof C.plfOpeningMult === "function");
check("EXHIBITION_DESKS is an array of 3 shaped Exhibition desks",
  Array.isArray(C.EXHIBITION_DESKS) && C.EXHIBITION_DESKS.length === 3 &&
  C.EXHIBITION_DESKS.every((d) => d.id && d.group === "Exhibition" && d.icon && d.name && typeof d.render === "function"));
check("desk ids are exh-chains / exh-plf / exh-previews",
  C.EXHIBITION_DESKS.map((d) => d.id).join(",") === "exh-chains,exh-plf,exh-previews");

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
let concessionRows = 0, rerunRows = 0, rerunSamples = [], concessionSamples = [], rerunWeeks = new Set();
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek();
      C.tickExhibition(); /* integrator wiring: engine calls tickExhibition() after its own systems */
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
    for (const r of rows) {
      if (r.k.indexOf("Concessions · ") === 0) { concessionRows++; if (concessionSamples.length < 8) concessionSamples.push(r.k + "=" + r.v); }
      if (r.k.indexOf("Re-release · ") === 0) { rerunRows++; rerunWeeks.add(S().studio.week); if (rerunSamples.length < 12) rerunSamples.push(r.k + "=" + r.v); }
    }
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.EXHIBITION_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}
function fakeFilm(id, title, genre, opening, legs, status, ww) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening, legs, decay: 1 - 1 / legs, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null, status
  });
  if (status === "done") { const f = S().films[0]; f.ww = ww; f.dom = Math.round(ww * 0.6 * 10) / 10; f.intl = Math.round(ww * 0.4 * 10) / 10; }
}
function fakeProject(id, title, phase, opts) {
  const o = opts || {};
  S().projects.push({
    id, title, genre: o.genre || "drama", scale: "micro", budget: 5, budgetNow: 5,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: o.mkt != null ? o.mkt : null, releaseWeek: o.releaseWeek != null ? o.releaseWeek : null,
    phase, phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: o.post || 60 },
    overrun: 0, scandal: false, buzz: o.buzz || 0, franchiseOf: null, prodScore: 55,
    quality: o.quality != null ? o.quality : 70, qPreview: o.qPreview != null ? o.qPreview : 70,
    previews: null, plf: null
  });
}

/* ── week 1: lazy ensure + hook defaults + rejections ─────────── */
C.newGame("Exhibition Test", "major");
C.tickExhibition();
check("S.exh namespace created lazily by tickExhibition",
  !!S().exh && Array.isArray(S().exh.owned) && Array.isArray(S().exh.reruns) && S().exh.deal === "std");
check("rentalSplitMult defaults to 1 (Standard)", C.rentalSplitMult() === 1);
check("plfOpeningMult 1 without plf, 1+surcharge with", C.plfOpeningMult({}) === 1 && C.plfOpeningMult({ plf: { surcharge: 0.35 } }) === 1.35);
check("exhibitionGrossMult 1 with no chains", C.exhibitionGrossMult(null) === 1);
check("insufficient-rep rejection (Regalogue needs rep 60, we have " + S().studio.rep + ")",
  !!C.exhBuyChain("regalogue").err && S().exh.owned.length === 0, C.exhBuyChain("regalogue").err || "");
check("unknown chain rejected", !!C.exhBuyChain("nope").err);
desksRenderClean("(w1, nothing owned)");

/* seed the slate: 2 running films + 2 done films (per brief) */
fakeFilm("f9001", "First Runner", "action", 70, 3.0, "run");
fakeFilm("f9002", "Second Runner", "comedy", 70, 3.0, "run");
fakeFilm("f9003", "Catalog Hit", "drama", 55, 2.8, "done", 120);
fakeFilm("f9004", "Catalog Mid", "horror", 40, 2.4, "done", 80);
fakeProject("p9001", "Post Masterpiece", "post", {});
fakeProject("p9002", "Shooting Slate", "shoot", {});
fakeProject("p9003", "Ready Release", "ready", { mkt: 5, releaseWeek: S().studio.week + 6 });

advance(2); /* bank early box office for the buying spree (weeks 2–3) */
check("theatrical decay cycle moved on the seeded run", C.findFilm("f9001").dom > 0, "dom " + C.findFilm("f9001").dom);

/* ── chain ownership ──────────────────────────────────────────── */
const c0 = S().studio.cash;
check("buy Bowtie Independents ok ($70M)", C.exhBuyChain("bowtie").ok && nearly(c0 - S().studio.cash, 70));
S().studio.cash = 0.5;
check("insufficient-cash chain rejection", !!C.exhBuyChain("harkinsy").err && S().exh.owned.length === 1, C.exhBuyChain("harkinsy").err || "");
check("insufficient-cash upgrade rejection", !!C.exhUpgrade("bowtie", "dolby").err && S().exh.owned[0].upgrades.length === 0);
S().studio.cash = c0 - 70;
const c1 = S().studio.cash;
check("buy Harkinsy ok ($100M)", C.exhBuyChain("harkinsy").ok && nearly(c1 - S().studio.cash, 100));
check("max 2 chains enforced", !!C.exhBuyChain("cinemarked").err && S().exh.owned.length === 2, C.exhBuyChain("cinemarked").err || "");
check("double-buy of owned chain rejected", !!C.exhBuyChain("bowtie").err);
check("ownedScreens = 960 + 1200 = 2160", C.exhOwnedScreens() === 2160, String(C.exhOwnedScreens()));
check("exhibitionGrossMult = 1 + 2160/40000×0.5 = 1.027", nearly(C.exhibitionGrossMult(null), 1.027));

/* ── per-chain premium upgrades ───────────────────────────────── */
const u0 = S().studio.cash;
check("Dolby retrofit on Bowtie ok ($3M)", C.exhUpgrade("bowtie", "dolby").ok && nearly(u0 - S().studio.cash, 3));
check("duplicate upgrade rejected", !!C.exhUpgrade("bowtie", "dolby").err);
check("VIP retrofit on Harkinsy ok ($6M)", C.exhUpgrade("harkinsy", "vip").ok);
check("4DX retrofit on Bowtie ok ($5M)", C.exhUpgrade("bowtie", "4dx").ok);
check("unknown upgrade rejected", !!C.exhUpgrade("bowtie", "imax").err);
check("upgrade on unowned chain rejected", !!C.exhUpgrade("regalogue", "dolby").err);
check("upgrade yields stored: Bowtie ×1.18, Harkinsy ×1.15",
  nearly(C.exhUpgradeYield(S().exh.owned[0]), 1.18) && nearly(C.exhUpgradeYield(S().exh.owned[1]), 1.15));
desksRenderClean("(w3, 2 chains owned, upgrades in)");

/* ── concession backend deals ─────────────────────────────────── */
check("deal Shared 12% → rentalSplitMult 0.94", C.exhSetDeal("shared").ok && C.rentalSplitMult() === 0.94);
check("deal Max 20% → rentalSplitMult 0.90", C.exhSetDeal("max").ok && C.rentalSplitMult() === 0.9);
check("unknown deal rejected, split unchanged", !!C.exhSetDeal("ripoff").err && C.rentalSplitMult() === 0.9);
check("switching back to Standard is free → 1", C.exhSetDeal("std").ok && C.rentalSplitMult() === 1);

/* ── PLF mastering ────────────────────────────────────────────── */
const b0 = C.findProject("p9001").buzz, pl0 = S().studio.cash;
const im = C.exhPlfMaster("p9001", "imax");
check("master IMAX 70mm on post project ok ($2.5M)", im && im.ok && nearly(pl0 - S().studio.cash, 2.5));
check("PLF buzz +12", C.findProject("p9001").buzz - b0 === 12);
check("p.plf stored {fmt:'imax', surcharge:0.35}",
  C.findProject("p9001").plf && C.findProject("p9001").plf.fmt === "imax" && C.findProject("p9001").plf.surcharge === 0.35);
check("plfOpeningMult returns 1.35 on mastered project", C.plfOpeningMult(C.findProject("p9001")) === 1.35);
check("re-mastering a mastered project rejected", !!C.exhPlfMaster("p9001", "dolby").err);
check("master Dolby Cinema on shoot project ok → 1.28", C.exhPlfMaster("p9002", "dolby").ok && C.plfOpeningMult(C.findProject("p9002")) === 1.28);
check("unknown format rejected", !!C.exhPlfMaster("p9001", "huge").err);
check("unknown project rejected", !!C.exhPlfMaster("pNope", "imax").err);

/* ── Thursday previews ────────────────────────────────────────── */
const pz0 = C.findProject("p9003").buzz, pc0 = S().studio.cash;
const pv = C.exhBuyPreview("p9003");
check("preview booked on scheduled ready project ($1M)", pv && pv.ok && nearly(pc0 - S().studio.cash, 1));
check("preview buzz +15", C.findProject("p9003").buzz - pz0 === 15);
check("p.previews set true", C.findProject("p9003").previews === true);
check("second preview rejected", !!C.exhBuyPreview("p9003").err);
check("preview rejected without a release date", !!C.exhBuyPreview("p9001").err, C.exhBuyPreview("p9001").err || "");

/* ── re-releases ──────────────────────────────────────────────── */
const rc0 = S().studio.cash;
const rr = C.exhBuyRerelease("f9003");
check("re-release booked on $120M done film ($3M)", rr && rr.ok && nearly(rc0 - S().studio.cash, 3));
check("lastRerelease stamped to this week", C.findFilm("f9003").lastRerelease === S().studio.week);
check("6-week mini-run scheduled at 1% of ww", S().exh.reruns.length === 1 && S().exh.reruns[0].weeks === 6 && nearly(S().exh.reruns[0].ww, 120));
check("re-buy during active run rejected (cooldown)", !!C.exhBuyRerelease("f9003").err, C.exhBuyRerelease("f9003").err || "");
check("re-release news logged", S().news[0] && S().news[0].txt.indexOf("Catalog Hit") >= 0, S().news[0] ? S().news[0].txt.slice(0, 40) : "none");
check("second done film booked too", C.exhBuyRerelease("f9004").ok && S().exh.reruns.length === 2);
const wwSave = C.findFilm("f9004").ww;
C.findFilm("f9004").ww = 30;
check("ww < 50 rejected", !!C.exhBuyRerelease("f9004").err, C.exhBuyRerelease("f9004").err || "");
C.findFilm("f9004").ww = wwSave;
check("running film can't be re-released", !!C.exhBuyRerelease("f9001").err);

/* ── action delegation ────────────────────────────────────────── */
const stub = { getAttribute: () => null };
check("exhibitionAction handles exh-deal (Shared 12%)", C.exhibitionAction("exh-deal", { getAttribute: (k) => (k === "data-key" ? "shared" : null) }) === true && C.rentalSplitMult() === 0.94);
C.exhSetDeal("std");
check("exhibitionAction exh-buy handled but rejected on rep, no state change",
  C.exhibitionAction("exh-buy", { getAttribute: (k) => (k === "data-id" ? "regalogue" : null) }) === true && S().exh.owned.length === 2);
check("exhibitionAction returns false for foreign actions", C.exhibitionAction("gl-open", stub) === false);
check("exhibitionAction returns false for non-exh prefixes", C.exhibitionAction("tv-license", stub) === false);

/* ── 40-week main drive: concessions + re-release payouts ─────── */
advance(40);
check("no throw and cash finite through the 40-week drive", threw === null, threw || ("wk " + S().studio.week));
check("concessions earned in weeks with films in release", concessionRows >= 3, concessionRows + " rows · " + concessionSamples.join(", "));
check("first concession week matches formula (Bowtie 960×0.0006×2films×1.18 = 1.4)",
  concessionSamples.some((s) => s.indexOf("Bowtie") >= 0 && s.endsWith("=1.4")), concessionSamples[0] || "none");
check("Harkinsy concession with VIP ×1.15 (1200×0.0006×2×1.15 = 1.7)",
  concessionSamples.some((s) => s.indexOf("Harkinsy") >= 0 && s.endsWith("=1.7")), "none" );
check("re-release payouts ran in exactly 6 weeks (2 films × 6 wks = 12 rows)", rerunWeeks.size === 6 && rerunRows === 12, rerunWeeks.size + " wks · " + rerunRows + " rows");
check("re-release payout = 1% of ww (Catalog Hit 1.2/wk, Catalog Mid 0.8/wk)",
  rerunSamples.some((s) => s.indexOf("Catalog Hit") >= 0 && s.endsWith("=1.2")) && rerunSamples.some((s) => s.indexOf("Catalog Mid") >= 0 && s.endsWith("=0.8")), rerunSamples.join(", ") || "none");
check("mini-runs expired after 6 weeks", S().exh.reruns.length === 0);
check("52-week cooldown still blocks a re-booking", !!C.exhBuyRerelease("f9003").err, C.exhBuyRerelease("f9003").err || "");
desksRenderClean("(mid-drive, chains + masters + previews live)");

/* ── soak to 60+ weeks, then final invariants ─────────────────── */
advance(20);
check("no throw and cash finite all weeks (min cash tracked)", threw === null, threw || ("min cash " + Math.round(minCash) + "M"));
check("60+ advanceWeek calls driven", weeksDriven >= 60, String(weeksDriven));
check("S.exh exists at end", !!S().exh);
check("exhibition state fields finite/valid",
  typeof S().exh.deal === "string" && isFinite(S().exh.lastTick) &&
  S().exh.owned.every((o) => isFinite(o.screens) && Array.isArray(o.upgrades)) &&
  S().exh.reruns.every((r) => isFinite(r.ww) && isFinite(r.weeks)));
check("gross mult still 1.027 after 60+ weeks", nearly(C.exhibitionGrossMult(null), 1.027));
check("PLF mult still applied on the mastered post project", C.plfOpeningMult(C.findProject("p9001")) === 1.35);
check("rentalSplitMult still reads the live deal", C.rentalSplitMult() === 1);
check("seeded films still finite after the full drive", C.findFilm("f9001").dom >= 0 && C.findFilm("f9003").ww === 120);
desksRenderClean("(end, year may have rolled)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
