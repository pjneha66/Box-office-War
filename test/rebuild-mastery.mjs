/* Rebuild Mastery-module harness (pattern from test/rebuild-tech.mjs): runs game/data.js +
   game/engine.js + game/mastery.js in a VM sandbox with a stubbed localStorage. ui.js needs
   a DOM, so the two ui helpers the desks render with (statrow/tag) are stubbed verbatim.
   The harness drives advanceWeek() + tickMastery() each cycle (the engine does not call
   tickMastery yet — integrator wiring, see module header). Exercises every system through
   the real functions: genre mastery via 6 micro comedies greenlit → released → theatrical
   run → status "done"; agencies via real sign/switch actions (incl. one insufficient-cash
   rejection); first-look via the 30%/wk window at rep ≥ 50 (up to 40 weeks to fire);
   scouting via the real cooldown + a hidden talent cast into a project → reveal.
   Asserts: lazy ensure, tier math (unit-seeded at the end, then restored), agencyFeeMult
   values and a real feeFor ratio, hidden-reveal news, desks render clean at every state,
   62 advanceWeek() calls with finite cash throughout, box-office income seen in weekTx.
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
for (const f of ["data.js", "engine.js", "mastery.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module + engine wiring ────── */
const src = readFileSync(path.join(gameDir, "mastery.js"), "utf8");
const engineSrc = readFileSync(path.join(gameDir, "engine.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("does not self-wrap advanceWeek/onAction (no reassignment, no direct call)",
  !/advanceWeek\s*=/.test(src) && !/onAction\s*=/.test(src) &&
  !src.includes("advanceWeek(") && !src.includes("onAction("));
check("exports tickMastery/masteryAction/masteryCraftMod/masteryOpenMult/agencyFeeMult/forecastAdjust_mastery",
  typeof C.tickMastery === "function" && typeof C.masteryAction === "function" &&
  typeof C.masteryCraftMod === "function" && typeof C.masteryOpenMult === "function" &&
  typeof C.agencyFeeMult === "function" && typeof C.forecastAdjust_mastery === "function");
check("MASTERY_DESKS is 2 desks: Mastery / mast-genre 🎯 / mast-agency 🤝",
  Array.isArray(C.MASTERY_DESKS) && C.MASTERY_DESKS.length === 2 &&
  C.MASTERY_DESKS[0].id === "mast-genre" && C.MASTERY_DESKS[0].group === "Mastery" && C.MASTERY_DESKS[0].icon === "🎯" &&
  C.MASTERY_DESKS[1].id === "mast-agency" && C.MASTERY_DESKS[1].group === "Mastery" && C.MASTERY_DESKS[1].icon === "🤝" &&
  C.MASTERY_DESKS.every((d) => typeof d.render === "function"));
check("engine wiring LIVE: computeQuality adds masteryCraftMod, expectedOpening multiplies masteryOpenMult, feeFor multiplies agencyFeeMult",
  engineSrc.includes("craft += masteryCraftMod(p.genre) || 0") &&
  engineSrc.includes("open *= masteryOpenMult(p.genre) || 1") &&
  engineSrc.includes("f *= agencyFeeMult(t) || 1"));

/* ── drive helpers ───────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function cycle(n) { /* advanceWeek + tickMastery, n times, guarded */
  for (let i = 0; i < n; i++) {
    try { C.advanceWeek(); C.tickMastery(); } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); return false; }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return false; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over || st.cash <= -25) { threw = "studio bankrupt at week " + st.week; return false; }
  }
  return true;
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.MASTERY_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + e.message; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("desks render clean " + label, bad === "", bad);
}
const stub = { getAttribute: () => null };
const elxWith = (m) => ({ getAttribute: (k) => (k in m ? String(m[k]) : null) });
function doneComedies() {
  let n = 0;
  for (const f of S().films) if (f.genre === "comedy" && f.status === "done") n++;
  return n;
}
function freeTalent(kind, usedIds) {
  for (const t of S().market) {
    if (t.k === kind && !C.talentBusy(t) && !usedIds.has(t.id) && !t.hidden) return t;
  }
  return null;
}

/* ── week 1: lazy ensure + cold hooks ────────────────────────── */
C.newGame("Mastery Test Studios", "veteran");
C.tickMastery();
check("S.mast namespace created lazily by tickMastery: 3 agencies rep 20, signedId null, scoutCd 0",
  !!S().mast && Array.isArray(S().mast.agencies) && S().mast.agencies.length === 3 &&
  S().mast.agencies.every((a) => a.rep === 20 && isFinite(a.rep)) &&
  S().mast.signedId === null && S().mast.scoutCd === 0);
check("forecastAdjust_mastery() is 0 (with and without week arg)", C.forecastAdjust_mastery() === 0 && C.forecastAdjust_mastery(42) === 0);
check("cold hooks: craft 0, open ×1 for every genre, agencyFeeMult ×1 (nothing signed)",
  GENRES_OK() && C.agencyFeeMult(S().market[0]) === 1);
function GENRES_OK() {
  for (const g of C.GENRES) if (C.masteryCraftMod(g.id) !== 0 || C.masteryOpenMult(g.id) !== 1) return false;
  return C.masteryCraftMod(null) === 0 && C.masteryOpenMult(undefined) === 1;
}
check("tickMastery tags the whole starting market (60% agency / else Independent)",
  S().market.every((t) => typeof t.agency === "string") &&
  S().market.some((t) => t.agency === "indep") &&
  S().market.some((t) => ["meridian", "apex", "northstar"].indexOf(t.agency) >= 0));
desksRenderClean("(w1, nothing signed, no films)");

/* ── insufficient-cash rejection on both actions ─────────────── */
S().studio.cash = 1;
const hiddenBefore = S().market.filter((t) => t.hidden).length;
check("scout rejected without cash: handled, no spend, no hidden talent, no cooldown",
  C.masteryAction("mast-scout", stub) === true && S().studio.cash === 1 && S().mast.scoutCd === 0 &&
  S().market.filter((t) => t.hidden).length === hiddenBefore);
check("sign rejected without cash: handled, no spend, nothing signed",
  C.masteryAction("mast-sign", elxWith({ "data-id": "meridian" })) === true &&
  S().studio.cash === 1 && S().mast.signedId === null);

/* ── sign Meridian: cost, +15 rep, fee hooks ─────────────────── */
S().studio.cash = 100;
S().market[0].agency = "meridian";
S().market[1].agency = "apex";
S().market[2].agency = "indep";
check("signing Meridian via masteryAction: cash -5, exclusive set, rep 20→35, news logged",
  C.masteryAction("mast-sign", elxWith({ "data-id": "meridian" })) === true &&
  nearly(S().studio.cash, 95) && S().mast.signedId === "meridian" &&
  S().mast.agencies.find((a) => a.id === "meridian").rep === 35 &&
  S().news.some((n) => n.txt.indexOf("Exclusive deal signed") >= 0));
check("agencyFeeMult: 0.9 for their talent, ×1 for other agency / Independent / untagged",
  C.agencyFeeMult(S().market[0]) === 0.9 && C.agencyFeeMult(S().market[1]) === 1 &&
  C.agencyFeeMult(S().market[2]) === 1 && C.agencyFeeMult({ agency: null }) === 1);
check("real feeFor ratio: signed-agency talent costs exactly ×0.9 at the same budget",
  (() => {
    const t = S().market[0];
    t.agency = "indep"; const base = C.feeFor(t, 100);
    t.agency = "meridian"; const signed = C.feeFor(t, 100);
    /* both calls round to 0.1 — allow the double-rounding slack */
    return Math.abs(signed - base * 0.9) <= 0.11;
  })());
check("switch to Apex: cash -5, signedId flips, Apex 20→35, Meridian talent loses the discount",
  C.masteryAction("mast-sign", elxWith({ "data-id": "apex" })) === true &&
  nearly(S().studio.cash, 90) && S().mast.signedId === "apex" &&
  S().mast.agencies.find((a) => a.id === "apex").rep === 35 &&
  C.agencyFeeMult(S().market[0]) === 1 && C.agencyFeeMult(S().market[1]) === 0.9);
check("re-signing the current agency is a clean no-op (no double +15)",
  C.masteryAction("mast-sign", elxWith({ "data-id": "apex" })) === true &&
  nearly(S().studio.cash, 90) && S().mast.agencies.find((a) => a.id === "apex").rep === 35);
check("foreign/malformed actions ignored: non-mast prefix false, mast-nonsense false, mast-sign without data-id handled",
  C.masteryAction("tv-launch-streamer", stub) === false && C.masteryAction("mast-nonsense", stub) === false &&
  C.masteryAction("mast-sign", null) === true && S().mast.signedId === "apex");
desksRenderClean("(signed Apex, no films)");

/* ── scouting trip: cost, cooldown, hidden newcomer ──────────── */
S().studio.cash = 600;
check("scout trip runs: cash -3, cooldown 4, one hidden newcomer in the market",
  C.masteryAction("mast-scout", stub) === true && nearly(S().studio.cash, 597) && S().mast.scoutCd === 4 &&
  S().market.filter((t) => t.hidden).length === 1);
const H = S().market.find((t) => t.hidden);
check("hidden newcomer: report undersells (realSkill = rolled + ri(5,20), shown −15, both clamped)",
  H.hidden === true && isFinite(H.realSkill) && H.realSkill - H.skill >= 15 && H.realSkill - H.skill <= 35 &&
  H.skill >= 5 && H.realSkill <= 97 && H.realSkill > H.skill, H.n + " shows " + Math.round(H.skill) + ", real " + Math.round(H.realSkill));
check("second scout rejected while scouts are out (cooldown 4 wks, no double spend)",
  C.masteryAction("mast-scout", null) === true && nearly(S().studio.cash, 597) && S().mast.scoutCd === 4 &&
  S().market.filter((t) => t.hidden).length === 1);
let deskHtml = C.MASTERY_DESKS[1].render();
check("agency desk during cooldown: Send disabled with 'Out (4w)'", deskHtml.indexOf("Out (4w)") >= 0 && deskHtml.indexOf("disabled") >= 0);

/* ── cast the hidden talent immediately (booked talent cannot churn out) ── */
S().studio.cash = 600;
let scoutFails = 0;
while (S().ideas.filter((i) => i.genre === "comedy").length < 6 && scoutFails < 300) {
  if (!C.scoutScripts()) { scoutFails = 999; break; }
  scoutFails++;
}
check("stocked ≥6 comedy scripts via the real scout path", scoutFails < 300 &&
  S().ideas.filter((i) => i.genre === "comedy").length >= 6, scoutFails + " scout calls");
const idea1 = S().ideas.find((i) => i.genre === "comedy");
const used = new Set();
const dir1 = freeTalent("dir", used); used.add(dir1.id);
const act1 = H.k === "actor" ? H : freeTalent("actor", used); used.add(act1.id);
const dirUse = H.k === "dir" ? H : dir1;
const gl = C.greenlight(idea1.id, { scale: "micro", bIdx: 0, mktIdx: 0, dirId: dirUse.id, actorId: act1.id });
check("hidden talent greenlit into a real micro comedy", !gl.err && S().projects.some((p) => p.actId === H.id || p.dirId === H.id), gl.err || "ok");
const proj1 = S().projects[S().projects.length - 1];
check("release scheduled via real setRelease", !C.setRelease(proj1, S().studio.week + 2, 0).err);
check("one week after casting: talent revealed (skill = realSkill, hidden=false, gold news)",
  cycle(1) && threw === null && H.hidden === false && H.skill === H.realSkill &&
  S().news.some((n) => n.txt.indexOf("revealed") >= 0 && n.txt.indexOf(H.n) >= 0),
  H.n + " skill now " + Math.round(H.skill));
check("revealed talent kept the boost: skill === realSkill stays stable across another week",
  cycle(1) && threw === null && H.skill === H.realSkill && H.hidden === false);
check("4 weeks after the trip the cooldown has fully elapsed (4→0 across the weeks)",
  cycle(2) && threw === null && S().mast.scoutCd === 0, "scoutCd " + S().mast.scoutCd);

/* ── five more done comedies through the real pipeline ───────── */
S().studio.cash = 600;
let built = 1;
for (let i = 0; i < 5; i++) {
  const idea = S().ideas.find((x) => x.genre === "comedy");
  if (!idea) break;
  const dir = freeTalent("dir", used), act = freeTalent("actor", used);
  if (!dir || !act) break;
  used.add(dir.id); used.add(act.id);
  const r = C.greenlight(idea.id, { scale: "micro", bIdx: 0, mktIdx: 0, dirId: dir.id, actorId: act.id });
  if (r.err) { threw = "greenlight " + i + ": " + r.err; break; }
  const p = S().projects[S().projects.length - 1];
  const rr = C.setRelease(p, S().studio.week + 2, 0);
  if (rr.err) { threw = "setRelease " + i + ": " + rr.err; break; }
  built++;
}
check("6 micro comedies built through greenlight + setRelease", built === 6 && threw === null, built + " built · projects now " + S().projects.length + " (film 1 may already have released)");
let guard = 0;
while (doneComedies() < 6 && guard < 34 && threw === null) { if (!cycle(1)) break; guard++; }
check("all 6 comedies finished their theatrical run (status done) within 34 weeks",
  threw === null && doneComedies() >= 6, doneComedies() + " done comedies after " + guard + " weeks");
check("genre mastery hook: 6 done comedies → masteryCraftMod('comedy') >= 2, opening ×1 (Apprentice)",
  doneComedies() >= 6 && C.masteryCraftMod("comedy") >= 2 && C.masteryOpenMult("comedy") === 1,
  "craft " + C.masteryCraftMod("comedy") + " open " + C.masteryOpenMult("comedy"));
check("untouched genres stay at 0 craft / ×1", C.masteryCraftMod("horror") === 0 && C.masteryOpenMult("horror") === 1);
deskHtml = C.MASTERY_DESKS[0].render();
check("genre desk shows the comedy count and its level tag",
  deskHtml.indexOf("Comedy") >= 0 && deskHtml.indexOf("Apprentice") >= 0 &&
  deskHtml.indexOf(doneComedies() + " done") >= 0, "comedy done " + doneComedies());
check("box-office income actually moved through weekTx (income/decay cycle)",
  S().txHistory.some((w) => w.in > 0.5), "max in " + Math.max.apply(null, S().txHistory.map((w) => w.in)).toFixed(1) + "M");

/* ── first-look window: push Apex to rep 50 via real switches ── */
S().studio.cash = 600;
check("switch to Northstar, then back to Apex → Apex rep 35→50 unlocks first-look",
  C.masteryAction("mast-sign", elxWith({ "data-id": "northstar" })) === true &&
  C.masteryAction("mast-sign", elxWith({ "data-id": "apex" })) === true &&
  S().mast.signedId === "apex" && S().mast.agencies.find((a) => a.id === "apex").rep === 50);
const seen = new Set(S().market.map((t) => t.id));
let firstLook = null, wk = 0;
for (; wk < 40 && !firstLook && threw === null; wk++) {
  if (!cycle(1)) break;
  /* gate on the news line — only mastFirstLook logs "first-look deal"; this avoids
     matching a churn-added talent that merely got tagged Apex on the next tick */
  if (S().news.some((n) => n.txt.indexOf("first-look deal") >= 0)) {
    for (const t of S().market) {
      if (!seen.has(t.id) && t.agency === "apex" && t.power >= 3) { firstLook = t; break; }
    }
  }
  S().market.forEach((t) => seen.add(t.id));
}
check("first-look delivered a free power≥3 Apex talent within 40 weeks (30%/wk), with news",
  !!firstLook && S().news.some((n) => n.txt.indexOf("first-look deal") >= 0),
  firstLook ? firstLook.n + " power " + firstLook.power + " at week +" + wk : "none in 40 weeks");
check("market grew and every talent is agency-tagged after the window", S().market.every((t) => typeof t.agency === "string" && t.agency.length > 0));
check("agency reps stayed within 0-100", S().mast.agencies.every((a) => a.rep >= 0 && a.rep <= 100));
desksRenderClean("(Apex rep 50, first-look active)");

/* ── cooldown recovery: a second trip after expiry ───────────── */
S().studio.cash = 600;
check("second scouting trip after cooldown expiry: allowed, cooldown resets to 4, a new hidden talent waits",
  C.masteryAction("mast-scout", stub) === true && S().mast.scoutCd === 4 &&
  S().market.filter((t) => t.hidden).length === 1);

/* ── tier math (unit-seeded, then restored) ──────────────────── */
const keepLen = S().films.length;
const keepNews = S().news.length;
function seedTo(n) {
  let c = doneComedies();
  while (c < n) { S().films.unshift({ id: "fx" + (c + 1), title: "Seed " + (c + 1), genre: "comedy", status: "done" }); c++; }
}
seedTo(10);
check("10 done comedies (Adept): craft +4, openings ×1.03",
  C.masteryCraftMod("comedy") === 4 && nearly(C.masteryOpenMult("comedy"), 1.03),
  "craft " + C.masteryCraftMod("comedy") + " open " + C.masteryOpenMult("comedy"));
seedTo(20);
check("20 done comedies (Master): craft +6, openings ×1.06",
  C.masteryCraftMod("comedy") === 6 && nearly(C.masteryOpenMult("comedy"), 1.06),
  "craft " + C.masteryCraftMod("comedy") + " open " + C.masteryOpenMult("comedy"));
S().films.length = keepLen;
check("seeding restored: back to ≥6 done comedies, Apprentice craft", doneComedies() >= 6 && C.masteryCraftMod("comedy") >= 2);
check("seeded titles left no news and no project residue", S().news.length === keepNews && S().projects.length >= 0);

/* ── save/load round-trip + lazy ensure on an old save ───────── */
C.saveGame();
check("saveGame/loadGame round-trip keeps S.mast (agencies, signedId, cooldown)",
  C.loadGame() === true && !!S().mast && S().mast.signedId === "apex" &&
  S().mast.agencies.length === 3 && S().mast.scoutCd === 4);
delete S().mast;
C.tickMastery();
check("old-save path: deleting S.mast then ticking recreates it fresh (3 agencies rep 20, nothing signed)",
  !!S().mast && S().mast.agencies.length === 3 && S().mast.agencies.every((a) => a.rep === 20) &&
  S().mast.signedId === null);
desksRenderClean("(after load + re-ensure)");

/* ── idle weeks to clear the 60-week contract requirement ────── */
const idle = Math.max(6, 64 - weeksDriven);
check("idle weeks driven, cash finite every week (total ≥ 64)", cycle(idle) && threw === null, weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");

/* ── final state checks ──────────────────────────────────────── */
check("weeks driven ≥ 60 (contract requirement)", weeksDriven >= 60, String(weeksDriven));
check("S.mast fields finite and NaN-free", JSON.stringify(S().mast).indexOf("NaN") < 0 &&
  S().mast.agencies.every((a) => isFinite(a.rep)) && isFinite(S().mast.scoutCd));
check("S.studio.cash finite at end", isFinite(S().studio.cash), Math.round(S().studio.cash) + "M");
desksRenderClean("(after the full run)");

console.log("\n" + (failures || threw ? "FAILED " + failures + "/" + checks + (threw ? " · threw: " + threw : "") : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
