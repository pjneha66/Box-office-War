/* Rebuild PR-module harness (pattern from test/rebuild-sim.mjs): runs game/data.js +
   game/engine.js + game/pr.js in a VM sandbox with a stubbed localStorage. ui.js needs a
   DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   Drives 60 advanceWeek() calls, calling tickPR() after each (the integrator's wiring),
   and exercises every PR system through the module's real functions.
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
for (const f of ["data.js", "engine.js", "pr.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const woy = () => C.woyOf(S().studio.week);

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "pr.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickPR/prAction/awardPoints/prRetainer",
  typeof C.tickPR === "function" && typeof C.prAction === "function" &&
  typeof C.awardPoints === "function" && typeof C.prRetainer === "function");
check("PR_DESKS is an array of 6 shaped desks",
  Array.isArray(C.PR_DESKS) && C.PR_DESKS.length === 6 &&
  C.PR_DESKS.every((d) => d.id && d.group && d.icon && d.name && typeof d.render === "function"));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek();
      C.tickPR(); /* integrator wiring: engine calls tickPR() after its own systems */
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
  for (const d of C.PR_DESKS) {
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
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: o.mkt != null ? o.mkt : null, releaseWeek: o.releaseWeek != null ? o.releaseWeek : null,
    phase, phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: o.post || 60 },
    overrun: 0, scandal: false, buzz: 0, franchiseOf: null, prodScore: 55,
    quality: o.quality, qPreview: o.qPreview
  });
}

/* ── week 1: lazy ensure + out-of-window rejections ───────────── */
C.newGame("PR Test Studios", "major");
C.tickPR();
check("S.pr namespace created lazily by tickPR", !!S().pr && Array.isArray(S().pr.fycFilms));
check("fycFilms starts empty", S().pr.fycFilms.length === 0);

fakeFilm("f9001", "Prestige Fake", "drama", 82, "run"); /* running film → real theatrical income */
fakeProject("p9001", "Cut In Progress", "drama", "post", { budget: 20, post: 60 });
fakeProject("p9002", "Fall Festival Entry", "drama", "ready", { qPreview: 90, quality: 80 });
fakeProject("p9003", "Conv Release", "action", "ready", { releaseWeek: S().studio.week + 80, quality: 78, qPreview: 80 });

check("fyc rejected outside window", !!C.prFycBuy("f9001", 0).err);
check("festival rejected outside window", !!C.prFestSubmit("p9002").err);
check("convention rejected outside window", !!C.prConvBuy("p9003", 1).err);
desksRenderClean("(w1, all windows closed)");

/* ── week 2: FYC tracking of the fake film ────────────────────── */
advance(1);
check("tickPR tracked the quality-75+ release", S().pr.fycFilms.indexOf("f9001") >= 0, "woy " + woy());

/* ── weeks 3–22: conventions window ───────────────────────────── */
advance(20);
check("reached convention window", woy() >= 22 && woy() <= 24, "wk " + S().studio.week);
const f1 = C.findFilm("f9001");
check("theatrical decay cycle moved (fake film grossed)", f1 && f1.dom > 0, "dom " + f1.dom);
const rep0 = S().studio.rep, buzz0 = C.findProject("p9003").buzz, cash0 = S().studio.cash;
check("convention tier 2 bought", C.prConvBuy("p9003", 1).ok);
check("convention buzz +6", C.findProject("p9003").buzz - buzz0 === 6);
check("convention rep +1", S().studio.rep - rep0 === 1);
check("convention cost $8M", nearly(cash0 - S().studio.cash, 8));
check("convention once per year", !!C.prConvBuy("p9003", 2).err);
check("convYear stored", S().pr.convYear === S().studio.year);
advance(2); /* w24, still in window */

/* ── weeks 25–34: festival window ─────────────────────────────── */
advance(10);
check("reached festival window", woy() >= 34 && woy() <= 38, "wk " + S().studio.week);
fakeProject("p9005", "Action Blockbuster", "action", "post", {});
check("festival rejects non-prestige genre", !!C.prFestSubmit("p9005").err);
const rep1 = S().studio.rep, buzz1 = C.findProject("p9002").buzz, cash1 = S().studio.cash;
const fest = C.prFestSubmit("p9002");
check("festival submit ok", fest && fest.ok);
check("festival fee $2M", nearly(cash1 - S().studio.cash, 2));
check("festival once per project ever", !!C.prFestSubmit("p9002").err);
const won = S().studio.rep - rep1 === 4 && C.findProject("p9002").buzz - buzz1 === 3;
check("festival outcome is win(+4 rep,+3 buzz) or lose(0)", won || (S().studio.rep - rep1 === 0 && C.findProject("p9002").buzz - buzz1 === 0), fest.won ? "won" : "lost");
check("festival news logged", S().news[0] && S().news[0].txt.indexOf("Fall Festival Entry") >= 0, "kind " + S().news[0].kind);
advance(4); /* w38, end of window */

/* ── week 40: FYC campaigns + awardPoints hook ────────────────── */
advance(2);
check("reached FYC window", woy() >= 40, "wk " + S().studio.week);
check("fyc tier1 ($5M → 1pt)", C.prFycBuy("f9001", 0).ok && S().pr.campaigns.f9001 === 1);
check("awardPoints returns 1", C.awardPoints("f9001") === 1);
check("fyc tier2 upgrade ($15M → 3pt)", C.prFycBuy("f9001", 1).ok && C.awardPoints("f9001") === 3);
check("fyc tier3 upgrade ($40M → 8pt)", C.prFycBuy("f9001", 2).ok && C.awardPoints("f9001") === 8);
check("fyc out-of-order/maxed rejected", !!C.prFycBuy("f9001", 0).err);
check("awardPoints unknown film → 0", C.awardPoints("fNope") === 0);

fakeFilm("f9002", "Second Fake", "crime", 80, "done");
C.tickPR();
check("second eligible film tracked", S().pr.fycFilms.indexOf("f9002") >= 0);
const cashSaved = S().studio.cash;
S().studio.cash = 1;
const poor = C.prFycBuy("f9002", 0);
check("insufficient cash rejected, no state change", !!poor.err && S().pr.campaigns.f9002 == null, poor.err || "");
S().studio.cash = cashSaved;

/* ── test screening + reshoot ─────────────────────────────────── */
const sc0 = S().studio.cash;
const scr = C.prTestScreen("p9001");
check("screening ok in post phase", scr && scr.ok);
check("screening score clamped 5..99", S().pr.screened.p9001 >= 5 && S().pr.screened.p9001 <= 99, String(S().pr.screened.p9001));
check("screening fee $1M", nearly(sc0 - S().studio.cash, 1));
check("second screening rejected", !!C.prTestScreen("p9001").err);
S().pr.screened.p9001 = 50; /* force the low-score branch deterministically */
const len0 = C.findProject("p9001").phaseLen.post, rs0 = S().studio.cash;
const rs = C.prReshoot("p9001");
const p1 = C.findProject("p9001");
check("reshoot ok on score <55", rs && rs.ok);
check("reshoot extends post by 2 weeks", p1.phaseLen.post === len0 + 2);
check("reshootBoost stored 3..6", p1.reshootBoost >= 3 && p1.reshootBoost <= 6, String(p1.reshootBoost));
check("reshoot cost = 8% budget", nearly(rs0 - S().studio.cash, Math.round(20 * 0.08 * 10) / 10));
check("second reshoot rejected", !!C.prReshoot("p9001").err);

/* ── social viral rolls ───────────────────────────────────────── */
const v0 = C.findProject("p9001").buzz;
const v1 = C.prViralBuy("p9001", 0);
const d1 = C.findProject("p9001").buzz - v0;
check("viral tier1 ok, tiers=1", v1 && v1.ok && S().pr.virals.p9001 === 1);
check("viral gain tier1 ∈ {1,2,4} (whiff/full/viral)", d1 === 1 || d1 === 2 || d1 === 4, "+" + d1);
const v2 = C.prViralBuy("p9001", 1);
const d2 = C.findProject("p9001").buzz - v0 - d1;
check("viral tier2 ok, tiers=2", v2 && v2.ok && S().pr.virals.p9001 === 2);
check("viral gain tier2 ∈ {2,4,8}", d2 === 2 || d2 === 4 || d2 === 8, "+" + d2);
check("viral out-of-order rejected", !!C.prViralBuy("p9001", 3).err);
fakeProject("p9004", "Early Pitch", "comedy", "pre", {});
check("viral rejected in pre phase", !!C.prViralBuy("p9004", 0).err);

/* ── crisis retainer ──────────────────────────────────────────── */
check("retainer off by default", C.prRetainer() === false);
check("retainer toggle on", C.prToggleRetainer().ok && C.prRetainer() === true);
advance(2); /* two weeks of $2M */
const rows = S().weekTx ? S().weekTx.rows : [];
check("retainer spends $2M in the weekly tick", rows.some((r) => r.k === "Crisis retainer" && nearly(r.v, -2)), "wk " + S().studio.week);
const stub = { getAttribute: () => null };
check("prAction handles pr-retainer", C.prAction("pr-retainer", stub) === true && C.prRetainer() === false);
check("prAction returns false for foreign actions", C.prAction("gl-open", stub) === false);
const stubPid = { getAttribute: (k) => (k === "data-id" ? "p9001" : "2") };
check("prAction delegates pr-viral tier3", C.prAction("pr-viral", stubPid) === true && S().pr.virals.p9001 === 3);
desksRenderClean("(w42, FYC open, campaigns maxed)");

/* ── year rollover: stale campaign expiry ─────────────────────── */
advance(11); /* w53 → year 2 */
check("year rolled over", S().studio.year === 2 && woy() === 1, "wk " + S().studio.week);
check("stale year-1 campaign expired", C.awardPoints("f9001") === 0 && S().pr.campaigns.f9001 == null);
check("fycFilms cleared of year-1 films", S().pr.fycFilms.indexOf("f9001") < 0 && S().pr.fycFilms.length === 0);
check("convention unlocked for the new year", S().pr.convYear !== S().studio.year);

/* ── final: 60 weeks driven, everything finite ────────────────── */
advance(8); /* w61 — total 60 advanceWeek() calls */
check("no throw and cash finite all 60 weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("60+ advanceWeek calls driven", weeksDriven >= 60, String(weeksDriven));
check("S.pr namespace exists at end", !!S().pr);
let fieldsFinite = isFinite(S().pr.convYear) && typeof S().pr.retainer === "boolean"
  && Object.keys(S().pr.campaigns).every((k) => isFinite(S().pr.campaigns[k]))
  && Object.keys(S().pr.virals).every((k) => isFinite(S().pr.virals[k]))
  && Object.keys(S().pr.screened).every((k) => isFinite(S().pr.screened[k]));
check("all PR state fields finite", fieldsFinite);
check("film ledger intact (fyc expiry kept films)", !!C.findFilm("f9001") && !!C.findFilm("f9002"));
desksRenderClean("(w61, year 2)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
