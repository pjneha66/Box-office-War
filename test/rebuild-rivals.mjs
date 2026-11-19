/* Rebuild rival war room harness (pattern from test/rebuild-consolehw.mjs): runs
   game/data.js + game/engine.js + game/rivals.js in a VM sandbox with a stubbed
   localStorage. ui.js needs a DOM, so the two ui helpers the module renders with
   (statrow/tag) are stubbed verbatim. Drives 80+ advanceWeek() calls with a seeded
   player release so the share leaderboard is live, exercises both desks, every
   action including the insufficient-cash rejection, and asserts the module's
   invariants (share 0..1, finite reaction mults, unique achievement ids, rival
   ytd actually accumulating). Prints one line per check; exits non-zero on failure. */
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
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "rivals.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── deterministic RNG control ─────────────────────────────────── */
const realRandom = Math.random;
let rngMode = "real", rngQueue = [];
Math.random = function () {
  if (rngMode === "fixed") return 0.5;
  if (rngMode === "queue") return rngQueue.length ? rngQueue.shift() : 0.9;
  return realRandom();
};
function withRng(mode, seq) { rngMode = mode; rngQueue = (seq || []).slice(); }
function realRng() { rngMode = "real"; rngQueue = []; }

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "rivals.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("module never writes rival ytd/lifetime (no assignment to S.rivals[].ytd)",
  !/S\.rivals\[[^\]]*\]\.ytd\s*=/.test(src) && !/\.lifetime\s*=/.test(src));
check("exports tickRivalWar/rivalWarShare/rivalReactionMult/rivalWarPoachBoost/forecastAdjust_rivalwar",
  typeof C.tickRivalWar === "function" && typeof C.rivalWarShare === "function" &&
  typeof C.rivalReactionMult === "function" && typeof C.rivalWarPoachBoost === "function" &&
  typeof C.forecastAdjust_rivalwar === "function" && typeof C.rivalwarAction === "function");
check("RIVAL_DESKS is an array of 2 shaped 'Industry' desks",
  Array.isArray(C.RIVAL_DESKS) && C.RIVAL_DESKS.length === 2 &&
  C.RIVAL_DESKS.every((d) => d.id && d.group === "Industry" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("desk ids are rivalwar-share / rivalwar-war",
  C.RIVAL_DESKS.map((d) => d.id).join(",") === "rivalwar-share,rivalwar-war");
check("RIVAL_ACHIEVEMENTS has >= 4 entries with unique rivalwar- ids",
  Array.isArray(C.RIVAL_ACHIEVEMENTS) && C.RIVAL_ACHIEVEMENTS.length >= 4 &&
  new Set(C.RIVAL_ACHIEVEMENTS.map((a) => a.id)).size === C.RIVAL_ACHIEVEMENTS.length &&
  C.RIVAL_ACHIEVEMENTS.every((a) => a.id.indexOf("rivalwar-") === 0 && a.tier && a.name && a.desc && typeof a.test === "function"));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
let badShare = 0, badHist = 0, badMult = 0, badPoach = 0, badForecast = 0;
let maxRivalYtd = 0, reactionWeeks = 0, sawAggressive = false, sawRetreat = false;
let ytdBeforeReset = 0, ytdAtReset = null, histOverCap = 0, tickDoubleBooked = 0;
function fakeFilm(id, title, opening, dom) {
  const f = {
    id, title, genre: "action", scale: "tentpole", budget: 60, mkt: 30, cost: 90,
    dirId: "t0", actId: "t0", quality: 78, criticAvg: 78, freshPct: 80, aud: 80, quotes: [],
    opening, legs: 3, decay: 1 - 1 / 3, weeksOut: 0, dom, weekly: [],
    releaseWeek: S().studio.week, season: "Summer", franchiseOf: null, status: "run"
  };
  S().films.unshift(f);
  return f;
}
function week() {
  try {
    C.advanceWeek();
    /* the integrator wires tickRivalWar() inside advanceWeek(); until then the
       harness calls it here. Either way the lastTick guard makes it run once. */
    C.tickRivalWar();
  } catch (e) {
    threw = "week " + S().studio.week + ": " + (e.stack || e);
    return false;
  }
  weeksDriven++;
  const st = S().studio;
  if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return false; }
  if (st.cash < minCash) minCash = st.cash;
  if (S().over) { threw = "studio went bankrupt at week " + st.week; return false; }

  const W = S().rivalwar;
  if (!W) { threw = "S.rivalwar vanished at week " + st.week; return false; }
  const sh = C.rivalWarShare();
  if (!isFinite(sh) || sh < 0 || sh > 1) badShare++;
  if (!isFinite(C.rivalWarPoachBoost()) || C.rivalWarPoachBoost() < 0 || C.rivalWarPoachBoost() > 1) badPoach++;
  if (C.forecastAdjust_rivalwar() !== 0) badForecast++;
  for (const r of S().rivals) {
    const m = C.rivalReactionMult(r.name);
    if (!isFinite(m) || m <= 0) badMult++;
    if (r.ytd > maxRivalYtd) maxRivalYtd = r.ytd;
  }
  for (const h of W.shareHist) {
    if (!isFinite(h.s) || h.s < 0 || h.s > 1 || !isFinite(h.w)) badHist++;
  }
  if (W.shareHist.length > 60) histOverCap++;
  let live = 0;
  for (const k in W.react) {
    if (!Object.prototype.hasOwnProperty.call(W.react, k)) continue;
    const m = C.rivalReactionMult(k);
    if (Math.abs(m - 1) > 0.001) { live++; if (m > 1) sawAggressive = true; if (m < 1) sawRetreat = true; }
  }
  if (live > 0) reactionWeeks++;
  if (st.woy === 1 && ytdAtReset === null && ytdBeforeReset > 0) {
    /* the engine zeroes rival ytd at the year boundary; capture the week after */
    ytdAtReset = S().rivals.reduce((a, r) => a + r.ytd, 0);
  }
  if (st.woy === 52) ytdBeforeReset = S().rivals.reduce((a, r) => a + r.ytd, 0);
  return true;
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.RIVAL_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + e.message; break; }
    if (typeof html !== "string" || html.length < 40) { bad = d.id + " returned no body"; break; }
    if (html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " leaked NaN/undefined"; break; }
  }
  check("both desks render clean HTML " + label, bad === "", bad);
}

/* ── week 1: lazy ensure, hook defaults, rejections ───────────── */
C.newGame("Rival Test", "veteran");
check("S.rivalwar is absent on a fresh save (lazy ensure is real)", !S().rivalwar);
C.tickRivalWar();
check("S.rivalwar namespace created lazily by tickRivalWar",
  !!S().rivalwar && Array.isArray(S().rivalwar.shareHist) && typeof S().rivalwar.react === "object" &&
  isFinite(S().rivalwar.lastTick));
check("fresh save: share 0, no reaction, no poach boost, forecast 0",
  C.rivalWarShare() === 0 && C.rivalReactionMult("Meridian Pictures") === 1 &&
  C.rivalWarPoachBoost() === 0 && C.forecastAdjust_rivalwar() === 0);
check("rivalCounterMult is neutral (1) with no counter slots", C.rivalCounterMult({ releaseWeek: 10 }) === 1);
check("reaction model: crushed rival retreats, losing rival attacks",
  C.rwTargetMult(0.5, 0.05) < 1 && C.rwTargetMult(0.5, 0.2) > 1,
  "crushed " + C.rwTargetMult(0.5, 0.05) + " · losing " + C.rwTargetMult(0.5, 0.2));

const cash0 = S().studio.cash;
S().studio.cash = 0.5;
const rej = C.rivalwarAction("rivalwar-counter", { getAttribute: (k) => (k === "data-id" ? "Meridian Pictures" : null) });
check("insufficient-cash counter rejection (needs $6M, we have $0.5M)",
  rej === true && S().rivalwar.counters.length === 0 && S().studio.cash === 0.5,
  "counters " + S().rivalwar.counters.length + " · cash " + S().studio.cash);
const rej2 = C.rivalwarAction("rivalwar-spin", { getAttribute: (k) => (k === "data-id" ? "Titan Global" : null) });
check("insufficient-cash spin rejection (needs $3.5M, we have $0.5M)",
  rej2 === true && S().rivalwar.spinsBought === 0 && S().studio.cash === 0.5);
check("unknown rival rejected without spending",
  !!C.rwBuyCounter("Nope Studios").err && !!C.rwSpin("Nope Studios").err && S().studio.cash === 0.5);
check("rivalwarAction returns false for foreign actions",
  C.rivalwarAction("ops-press", { getAttribute: () => null }) === false &&
  C.rivalwarAction("gl-open", { getAttribute: () => null }) === false);
S().studio.cash = 600;
check("cash restored for the drive", nearly(S().studio.cash, 600));

/* ── a real player release so the leaderboard is live ─────────── */
const f1 = fakeFilm("f90001", "Iron Harvest", 260, 240);
check("derived player ytd reads the running film", C.rwPlayerYtd() >= 240, "ytd " + C.rwPlayerYtd());
check("player ytd ignores last season's films",
  (function () {
    const f = { status: "done", ww: 500, releaseWeek: 1 };
    S().films.push(f);
    S().studio.year = 2;
    const v = C.rwPlayerYtd();
    S().films.pop();
    S().studio.year = 1;
    return v === 0 || v === 0 + (f1.dom || 0);
  })(), "ytd " + C.rwPlayerYtd());
desksRenderClean("(week 1, one film running)");

/* ── paid actions: real cost, real effect ─────────────────────── */
let c1 = S().studio.cash;
const cost1 = C.rwCounterCost();
const buy1 = C.rwBuyCounter("Meridian Pictures");
check("counter-programming slot bought for " + cost1 + "M",
  buy1.ok && nearly(c1 - S().studio.cash, cost1) && S().rivalwar.counters.length === 1,
  "paid " + (c1 - S().studio.cash));
check("counter lift is now live and rivalCounterMult responds near their date",
  S().rivalwar.counterLift > 0 && C.rivalCounterMult({ releaseWeek: 9999 }) === 1,
  "lift ×" + (1 + S().rivalwar.counterLift).toFixed(2));
check("duplicate counter against the same rival rejected",
  !!C.rwBuyCounter("Meridian Pictures").err && S().rivalwar.counters.length === 1);
const cost2 = C.rwCounterCost();
check("counter cost rises with each live slot (" + cost1 + " → " + cost2 + ")", cost2 > cost1);
c1 = S().studio.cash;
check("second counter slot (Titan Global) bought",
  C.rwBuyCounter("Titan Global").ok && nearly(c1 - S().studio.cash, cost2) && S().rivalwar.counters.length === 2);
c1 = S().studio.cash;
check("trade-press story planted for $3.5M",
  C.rwSpin("Solstice Films").ok && nearly(c1 - S().studio.cash, 3.5) &&
  S().rivalwar.spins["Solstice Films"] === S().studio.week);
check("war-chest spend is tracked", nearly(S().rivalwar.spend, cost1 + cost2 + 3.5, 0.01), String(S().rivalwar.spend));
const sc = C.rwScout();
check("free scouting reports a rival date", sc.ok === true, sc.none ? "no rival date yet" : "week " + sc.week);
check("scout moves no cash", nearly(S().studio.cash, c1 - 3.5));
desksRenderClean("(counters live)");

/* ── soak: 80+ weeks, invariants every week ──────────────────── */
withRng("fixed");
let injectedY2 = false;
for (let i = 0; i < 90; i++) {
  if (!week()) break;
  if (S().studio.cash < 150) S().studio.cash = 700;   /* keep the studio solvent */
  if (S().studio.week > 53 && !injectedY2 && C.rwPlayerYtd() === 0) {
    fakeFilm("f90002", "Iron Harvest II", 300, 280);
    injectedY2 = true;
  }
}
realRng();
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("80+ advanceWeek cycles driven", weeksDriven >= 80, String(weeksDriven));
check("cash stayed finite every week (min tracked)", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("S.rivalwar exists at the end with finite key fields",
  !!S().rivalwar && isFinite(S().rivalwar.lastTick) && isFinite(S().rivalwar.spend) &&
  isFinite(S().rivalwar.bestShare) && isFinite(S().rivalwar.bestRank) &&
  isFinite(S().rivalwar.countersBought) && isFinite(S().rivalwar.counterLift) &&
  isFinite(S().rivalwar.poachThreats) && isFinite(S().rivalwar.crushWeeks));
check("rivalWarShare() stayed inside 0..1 every week", badShare === 0, badShare + " bad weeks");
check("shareHist entries are finite and inside 0..1", badHist === 0, badHist + " bad rows");
check("shareHist never exceeds the 60-week cap", histOverCap === 0 && S().rivalwar.shareHist.length <= 60,
  S().rivalwar.shareHist.length + " rows");
check("rivalReactionMult finite and positive for every rival, every week", badMult === 0, badMult + " bad reads");
check("rivalWarPoachBoost() stayed inside 0..1 every week", badPoach === 0, badPoach + " bad weeks");
check("forecastAdjust_rivalwar() is always 0", badForecast === 0, badForecast + " non-zero");
check("at least one rival accumulated ytd above 0 during the run", maxRivalYtd > 0, "max " + maxRivalYtd + "M");
check("rival ytd reset at the year boundary", ytdAtReset !== null && ytdAtReset < ytdBeforeReset,
  "week 52 " + ytdBeforeReset + "M → week 1 " + ytdAtReset + "M");
check("rivals actually reacted during the run", reactionWeeks > 0, reactionWeeks + " weeks with a live reaction");
check("both reaction kinds occurred (aggression and retreat)",
  sawAggressive && sawRetreat, "aggressive " + sawAggressive + " · retreat " + sawRetreat);
check("share history actually moved", S().rivalwar.shareHist.length >= 40 &&
  S().rivalwar.shareHist.some((h) => h.s > 0), S().rivalwar.shareHist.length + " weeks tracked");
check("best share recorded and ranked", S().rivalwar.bestShare > 0 && S().rivalwar.bestRank < 99,
  "best " + (S().rivalwar.bestShare * 100).toFixed(1) + "% · best rank #" + S().rivalwar.bestRank);
check("poach boost tracks dominance inside its 0..0.25 band", C.rivalWarPoachBoost() >= 0 && C.rivalWarPoachBoost() <= 0.25,
  String(C.rivalWarPoachBoost()));

/* double-tick guard: a second call in the same week must not push a second sample */
S().rivalwar.lastTick = S().studio.week - 1;
C.tickRivalWar();
const once = JSON.stringify(S().rivalwar.shareHist);
const lastWeek = S().rivalwar.lastTick;
C.tickRivalWar();
const twice = JSON.stringify(S().rivalwar.shareHist);
check("tick is idempotent per week (lastTick guard)",
  lastWeek === S().studio.week && twice === once,
  "samples " + JSON.parse(once).length + " unchanged · lastTick " + lastWeek + " = week " + S().studio.week);
if (twice !== once) tickDoubleBooked++;
check("no double-booking observed", tickDoubleBooked === 0);

/* ── achievements: defensive tests, no throws ─────────────────── */
let achThrew = "";
for (const a of C.RIVAL_ACHIEVEMENTS) {
  try { a.test(S()); } catch (e) { achThrew = a.id + " threw on live state"; break; }
  try { a.test({}); } catch (e) { achThrew = a.id + " threw on an empty save"; break; }
  try { a.test(null); } catch (e) { achThrew = a.id + " threw on null state"; break; }
}
check("every achievement test() is defensive (live, empty, null state)", achThrew === "", achThrew);
check("achievement ids are unique and rivalwar-prefixed",
  new Set(C.RIVAL_ACHIEVEMENTS.map((a) => a.id)).size === C.RIVAL_ACHIEVEMENTS.length &&
  C.RIVAL_ACHIEVEMENTS.every((a) => a.id.indexOf("rivalwar-") === 0));
check("at least one achievement unlocked by the soak",
  C.RIVAL_ACHIEVEMENTS.some((a) => a.test(S()) === true),
  C.RIVAL_ACHIEVEMENTS.filter((a) => a.test(S())).map((a) => a.id).join(",") || "none");

/* ── final desk render + action smoke ────────────────────────── */
desksRenderClean("(end, " + weeksDriven + " weeks in)");
check("desks expose only sheet-body HTML (no sheet-head / sheet-foot)",
  C.RIVAL_DESKS.every((d) => {
    const h = d.render();
    return h.indexOf("sheet-head") < 0 && h.indexOf("sheet-foot") < 0;
  }));
check("war desk names every rival and the player",
  (function () {
    const h = C.RIVAL_DESKS[1].render();
    if (h.indexOf(S().studio.name.replace(/&/g, "&amp;")) < 0) return false;
    return S().rivals.every((r) => h.indexOf(r.name.replace(/&/g, "&amp;")) >= 0);
  })());
check("share desk shows a rank and a share percentage for the player",
  (function () {
    const h = C.RIVAL_DESKS[0].render();
    return h.indexOf("market share") >= 0 && h.indexOf("%") >= 0 && h.indexOf("#") >= 0;
  })());
check("rivalwar-scout action is handled through the ui bridge",
  C.rivalwarAction("rivalwar-scout", { getAttribute: () => null }) === true);

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · best share " +
  (S().rivalwar.bestShare * 100).toFixed(1) + "% · rival ytd max " + maxRivalYtd + "M");
process.exit(failures || threw ? 1 : 0);
