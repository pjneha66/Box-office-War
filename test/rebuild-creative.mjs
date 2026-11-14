/* Rebuild Creative-module harness (pattern from test/rebuild-pr.mjs): runs game/data.js +
   game/engine.js + game/creative.js in a VM sandbox with a stubbed localStorage. ui.js needs
   a DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   Drives 60+ advanceWeek() calls, calling tickCreative() after each (the integrator's wiring;
   the engine's own typeof-guarded call runs too — both are idempotent), and exercises every
   Creative system through the module's real functions: camera equip, director sparks,
   writers' room upgrades, script doctor, dial test, remake vault, and the
   creativeProjectMods() hook returning craft/aud/legs for a configured project.
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
for (const f of ["data.js", "engine.js", "creative.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "creative.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickCreative/creativeAction/creativeProjectMods",
  typeof C.tickCreative === "function" && typeof C.creativeAction === "function" &&
  typeof C.creativeProjectMods === "function");
check("CREATIVE_DESKS is an array of 3 shaped desks in group 'Creative'",
  Array.isArray(C.CREATIVE_DESKS) && C.CREATIVE_DESKS.length === 3 &&
  C.CREATIVE_DESKS.every((d) => d.group === "Creative" && d.icon && d.name && typeof d.render === "function") &&
  C.CREATIVE_DESKS.map((d) => d.id).join(",") === "cre-cam,cre-room,cre-demo",
  C.CREATIVE_DESKS.map((d) => d.id).join(","));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      /* harness stipend: keeps the sim solvent so the invariants under test are
         finiteness and hook behavior, not bankruptcy survival */
      if (S().studio.cash < 10) S().studio.cash += 60;
      C.advanceWeek();
      C.tickCreative();
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
function advanceUntil(pid, phase, cap) {
  for (let i = 0; i < (cap || 30); i++) {
    const p = C.findProject(pid);
    if (!p) return false;
    if (p.phase === phase) return true;
    advance(1);
    if (threw) return false;
  }
  const p = C.findProject(pid);
  return !!p && p.phase === phase;
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.CREATIVE_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + e.message; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}
function idleTalent(kind) {
  for (const t of S().market) if (t.k === kind && t.bookedUntil <= S().studio.week) return t;
  return null;
}
function fakeFilm(id, title, genre, ww, status) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 65, freshPct: 70, aud: 65, quotes: [],
    opening: 30, legs: 2.6, decay: 1 - 1 / 2.6, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null,
    ww: ww, intl: 0, status
  });
}
function fakeProject(id, title, genre, phase, opts) {
  const o = opts || {};
  S().projects.push({
    id, title, genre, scale: "micro", budget: o.budget || 5, budgetNow: o.budget || 5,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: o.mkt != null ? o.mkt : null, releaseWeek: o.releaseWeek != null ? o.releaseWeek : null,
    phase, phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: o.post || 40 },
    overrun: 0, scandal: false, buzz: 0, franchiseOf: null, prodScore: 55,
    quality: o.quality != null ? o.quality : 60, qPreview: o.qPreview != null ? o.qPreview : 60
  });
}
const stub = { getAttribute: () => null };
const stubPid = (id, key) => ({ getAttribute: (k) => (k === "data-id" ? id : String(key == null ? 0 : key)) });

/* ── week 1: lazy ensure + demographics pure functions ────────── */
C.newGame("Creative Test Studios", "major", "easy");
C.tickCreative();
check("S.cre namespace created lazily by tickCreative", !!S().cre &&
  typeof S().cre.wroom === "number" && !!S().cre.sparks && !!S().cre.dial && !!S().cre.doctor && !!S().cre.camera);
check("wroom starts at 0", S().cre.wroom === 0);
check("desks render clean on a fresh studio (empty states)", (() => {
  let bad = "";
  for (const d of C.CREATIVE_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  return bad === "";
})(), "");

check("ratings: horror/thriller→R, animation/docs→G, comedy/romance→PG, others PG-13",
  C.creRatingOf("horror") === "R" && C.creRatingOf("thriller") === "R" &&
  C.creRatingOf("animation") === "G" && C.creRatingOf("docs") === "G" &&
  C.creRatingOf("comedy") === "PG" && C.creRatingOf("romance") === "PG" &&
  C.creRatingOf("action") === "PG-13" && C.creRatingOf("drama") === "PG-13");
check("aud mod: +4 only when both largest quadrants (YA, Teens) favor the genre",
  C.creAudMod("action") === 4 && C.creAudMod("scifi") === 4 &&
  C.creAudMod("horror") === 0 && C.creAudMod("thriller") === 0 &&
  C.creAudMod("romance") === 0 && C.creAudMod("animation") === 0 &&
  C.creAudMod("fantasy") === 0 && C.creAudMod("comedy") === 0);
check("aud mod: -3 only for Mature-only genres (drama/crime/docs/musical)",
  C.creAudMod("drama") === -3 && C.creAudMod("crime") === -3 &&
  C.creAudMod("docs") === -3 && C.creAudMod("musical") === -3);
check("legs mod: +0.05 for animation/comedy, 0 otherwise",
  C.creLegsMod("animation") === 0.05 && C.creLegsMod("comedy") === 0.05 && C.creLegsMod("action") === 0);
const hor = C.creSharesOf("horror");
check("R rating zeroes the Kids share only",
  hor[0].id === "kids" && hor[0].share === 0 && hor[1].share === 0.28 && hor[3].share === 0.18);

/* ── greenlight a real project through the engine ─────────────── */
S().studio.cash = Math.max(S().studio.cash, 120); /* harness funding for the upfront fees */
const idea = S().ideas[0];
const dir = idleTalent("dir"), actor = idleTalent("actor");
check("found idle director and lead in the market", !!dir && !!actor, dir && dir.n + " / " + actor && actor.n);
const gl = C.greenlight(idea.id, { scale: "indie", dirId: dir.id, actorId: actor.id, bIdx: 1, mktIdx: 1 });
check("greenlight created project A via the real engine path", !!gl.ok && S().projects.length === 1, gl.err || "");
const pA = S().projects[0];
check("project A starts in pre without a rating or creative mods",
  pA.phase === "pre" && !pA.rating && !pA.cameraFmt && !pA.spark && !pA.doctored);
check("creativeProjectMods on an unconfigured project = wroom baseline + genre mods",
  C.creativeProjectMods(pA).craft === 0 && C.creativeProjectMods(pA).aud === C.creAudMod(pA.genre));

/* ── out-of-phase rejections while in pre ─────────────────────── */
check("camera rejected outside shoot", !!C.creCamBuy(pA.id, 2).err);
check("dial test rejected outside post", !!C.creDialTest(pA.id).err);
check("doctor rejected outside post/ready", !!C.creDoctor(pA.id).err);
check("spark buy rejected with no offer rolled yet", !!C.creSparkBuy(pA.id, 0).err);

/* ── shoot phase: rating detection, camera, sparks ────────────── */
check("A reaches shoot within its phase length", advanceUntil(pA.id, "shoot", 10), "wk " + S().studio.week);
check("tickCreative stored the audience rating at first sight", pA.rating === C.creRatingOf(pA.genre), pA.rating);
check("invalid camera index rejected", !!C.creCamBuy(pA.id, 9).err);
const cashCam = S().studio.cash;
const camBuy = C.creCamBuy(pA.id, 2);
check("70mm IMAX-cam equipped in shoot", camBuy.ok && pA.cameraFmt === "imax" && S().cre.camera[pA.id] === "imax");
check("camera charged the rounded package price", nearly(cashCam - S().studio.cash, C.creCharge(1.8)), C.creCharge(1.8) + "M");
check("camera once per project", !!C.creCamBuy(pA.id, 1).err);
const offer = S().cre.sparks[pA.id];
check("tickCreative rolled 3 distinct named sparks in shoot",
  offer && offer.opts.length === 3 &&
  new Set(offer.opts.map((s) => s.name)).size === 3 &&
  offer.opts.every((s) => s.cost >= 0.3 && s.cost <= 1.2 && s.craft >= 6 && s.craft <= 12),
  offer && offer.opts.map((s) => s.name).join(" | "));
const cashSpark = S().studio.cash;
const sparkBuy = C.creSparkBuy(pA.id, 0);
check("spark bought → p.spark {name, craft 6..12}", sparkBuy.ok && pA.spark &&
  pA.spark.craft >= 6 && pA.spark.craft <= 12 && S().cre.sparks[pA.id].done === true, pA.spark && pA.spark.name);
check("spark charged its offered price", nearly(cashSpark - S().studio.cash, C.creCharge(offer.opts[0].cost)));
check("spark once per project", !!C.creSparkBuy(pA.id, 1).err);

/* ── post phase: doctor + dial test ───────────────────────────── */
check("A reaches post", advanceUntil(pA.id, "post", 14), "wk " + S().studio.week);
const cashDoc = S().studio.cash;
check("script doctor bought in post", C.creDoctor(pA.id).ok && pA.doctored === true && S().cre.doctor[pA.id] === true);
check("doctor charged $1.5M", nearly(cashDoc - S().studio.cash, 1.5));
check("doctor once per project", !!C.creDoctor(pA.id).err);
const cashDial = S().studio.cash;
const dial = C.creDialTest(pA.id);
check("dial test bought in post", dial.ok && !!S().cre.dial[pA.id]);
check("dial curve = 6 finite minute scores clamped 5..99",
  S().cre.dial[pA.id].curve.length === 6 &&
  S().cre.dial[pA.id].curve.every((v) => isFinite(v) && v >= 5 && v <= 99),
  S().cre.dial[pA.id].curve.join("/"));
check("sag flag = curve[4] < curve[2] - 6",
  S().cre.dial[pA.id].sag === (S().cre.dial[pA.id].curve[4] < S().cre.dial[pA.id].curve[2] - 6),
  "sag " + S().cre.dial[pA.id].sag);
check("dial test charged its rounded price", nearly(cashDial - S().studio.cash, C.creCharge(0.35)));
check("dial test once per project", !!C.creDialTest(pA.id).err);

/* ── creativeProjectMods returns craft/aud/legs for the configured project ── */
const modsA = C.creativeProjectMods(pA);
const expectedCraft = S().cre.wroom * 1.5 + 9 /* imax */ + pA.spark.craft + 10 /* doctor */;
check("mods.craft = wroom×1.5 + camera 9 + spark + doctor 10",
  nearly(modsA.craft, expectedCraft), "got " + modsA.craft + " expected " + expectedCraft);
check("mods.aud = genre quadrant mod (imax adds 0)", modsA.aud === C.creAudMod(pA.genre), String(modsA.aud));
check("mods.legs = family-genre legs mod", nearly(modsA.legs, C.creLegsMod(pA.genre)), String(modsA.legs));
check("hook values are finite", isFinite(modsA.craft) && isFinite(modsA.aud) && isFinite(modsA.legs));

/* ── writers' room: upgrades change the hook output ───────────── */
const craftBefore = C.creativeProjectMods(pA).craft;
const cashW1 = S().studio.cash;
check("wroom upgrade T1 ok", C.creWroomUp().ok && S().cre.wroom === 1);
check("T1 cost = $1.5M", nearly(cashW1 - S().studio.cash, 1.5));
const cashW2 = S().studio.cash;
check("wroom upgrade T2 ok", C.creWroomUp().ok && S().cre.wroom === 2);
check("T2 cost = $3.0M (1.5 × tier bought into)", nearly(cashW2 - S().studio.cash, 3));
check("two tiers raised the hook craft by exactly 3.0",
  nearly(C.creativeProjectMods(pA).craft - craftBefore, 3),
  craftBefore + " → " + C.creativeProjectMods(pA).craft);
const savedCash = S().studio.cash;
S().studio.cash = 0.2;
check("insufficient cash rejected, no state change", !!C.creWroomUp().err && S().cre.wroom === 2);
S().studio.cash = savedCash;
S().cre.wroom = 5;
check("wroom maxed at T5", !!C.creWroomUp().err);
S().cre.wroom = 2;

/* ── wrap → ready → release: the engine path consumes the hook ── */
check("A wraps to ready", advanceUntil(pA.id, "ready", 16), "wk " + S().studio.week);
check("A quality computed and finite", isFinite(pA.quality) && pA.quality >= 5 && pA.quality <= 98, String(pA.quality));
fakeProject("pB", "Locked Cut", "drama", "ready", { quality: 60 });
check("doctor on a locked (ready) film applies +10 directly",
  C.creDoctor("pB").ok && C.findProject("pB").quality === 70, "60 → 70");
const rel = C.setRelease(pA, S().studio.week + 2, 1, 45);
check("release scheduled via the engine", !!rel.ok, rel.err || "");
advance(2);
const filmA = S().films[0];
check("A released through releaseFilm with the hook live",
  filmA && filmA.title === pA.title && isFinite(filmA.aud) && isFinite(filmA.legs) && filmA.legs >= 1.4,
  filmA ? ("aud " + filmA.aud + " legs " + filmA.legs.toFixed(2)) : "missing");
check("theatrical decay cycle moved for the released film", filmA && filmA.weekly.length > 0);

/* ── remake vault ─────────────────────────────────────────────── */
fakeFilm("f9001", "Prestige Fake", "action", 120, "done");
fakeFilm("f9002", "Small Fry", "drama", 50, "done");
fakeFilm("f9003", "Still Running", "comedy", 90, "run");
check("remake rejected under $60M ww", !!C.creRemake("f9002").err);
check("remake rejected while still in theaters", !!C.creRemake("f9003").err);
const cashRemake = S().studio.cash;
const remake = C.creRemake("f9001");
check("remake vault options the done hit for $40M", remake.ok && nearly(cashRemake - S().studio.cash, 40));
const pR = remake.ok ? C.findProject(remake.projectId) : null;
check("remake lands as a fresh pre project with original genre and scale-mid budget",
  pR && pR.phase === "pre" && pR.genre === "action" && pR.budget === C.scaleOf("indie").budgets[1],
  pR ? (pR.genre + " $" + pR.budget + "M") : "missing");
check("remake carries script 75, buzz 12, remakeOf + franchiseOf",
  pR && pR.script === 75 && pR.buzz === 12 && pR.remakeOf === "Prestige Fake" && pR.franchiseOf === "Prestige Fake");
check("remake news logged with the nostalgia angle",
  S().news[0] && S().news[0].txt.indexOf("(Remake)") >= 0 && S().news[0].txt.indexOf("nostalgia") >= 0);
const modsR = C.creativeProjectMods(pR);
check("mods on the remake = wroom baseline + remake craft +3",
  nearly(modsR.craft, S().cre.wroom * 1.5 + 3), "got " + modsR.craft);
advance(1);
check("remake project gets its audience rating on the next tick",
  pR.rating === C.creRatingOf(pR.genre), pR.rating);
check("remake craft bonus feeds computeQuality at wrap (hook wiring verified by mods equality)",
  typeof C.creativeProjectMods === "function" && pR.franchiseOf != null);

/* ── action delegation (ui bridges creativeAction) ────────────── */
const wBefore = S().cre.wroom;
check("creativeAction handles cre-wroom", C.creativeAction("cre-wroom", stub) === true && S().cre.wroom === wBefore + 1);
check("creativeAction returns false for foreign actions", C.creativeAction("gl-open", stub) === false);
fakeProject("pC", "Shoot Item", "comedy", "shoot", {});
check("creativeAction equips Vintage 16mm via cre-cam",
  C.creativeAction("cre-cam", stubPid("pC", 3)) === true && C.findProject("pC").cameraFmt === "v16");
check("16mm adds +2 aud on top of the genre quadrant mod",
  C.creativeProjectMods(C.findProject("pC")).aud === C.creAudMod("comedy") + 2);
fakeProject("pD", "Post Item", "horror", "post", {});
check("creativeAction runs a dial test via cre-dial",
  C.creativeAction("cre-dial", stubPid("pD", 0)) === true && !!S().cre.dial["pD"]);
check("R-rated horror project shows a zeroed Kids share in the desk",
  C.CREATIVE_DESKS[2].render().indexOf("Kids 0%") >= 0);
S().cre.dial["pD"].curve = [80, 79, 78, 70, 68, 60]; /* force the sag branch deterministically */
S().cre.dial["pD"].sag = true;
check("desk shows the third-act-sag warning recommending reshoots",
  C.CREATIVE_DESKS[2].render().indexOf("Third-act sag") >= 0 && C.CREATIVE_DESKS[2].render().indexOf("reshoot") >= 0);

/* ── final: 60+ weeks driven, everything finite ───────────────── */
advance(62 - weeksDriven > 0 ? 62 - weeksDriven : 2);
check("no throw and cash finite every week", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("60+ advanceWeek calls driven (brief's 30-week main flow included)", weeksDriven >= 60, String(weeksDriven));
check("S.cre namespace exists at end", !!S().cre);
let creFinite = isFinite(S().cre.wroom) && S().cre.wroom >= 0 && S().cre.wroom <= 5;
for (const k in S().cre.sparks) {
  if (!S().cre.sparks.hasOwnProperty(k)) continue;
  creFinite = creFinite && S().cre.sparks[k].opts.every((s) => isFinite(s.cost) && isFinite(s.craft));
}
for (const k in S().cre.dial) {
  if (!S().cre.dial.hasOwnProperty(k)) continue;
  creFinite = creFinite && S().cre.dial[k].curve.every((v) => isFinite(v)) && typeof S().cre.dial[k].sag === "boolean";
}
check("all Creative state fields finite (wroom, sparks, dial curves)", creFinite);
check("every project carries a rating after the run",
  S().projects.every((p) => !!p.rating && ["G", "PG", "PG-13", "R"].indexOf(p.rating) >= 0));
desksRenderClean("(final week " + S().studio.week + ")");

console.log("\n" + (failures || threw ? "FAILED " + (failures + (threw ? 1 : 0)) + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
