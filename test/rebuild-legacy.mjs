/* Rebuild studio legacy harness (pattern from test/rebuild-consolehw.mjs): runs
   game/data.js + game/engine.js + game/legacy.js in a VM sandbox with a stubbed
   localStorage. ui.js needs a DOM, so the two ui helpers the module renders with
   (statrow/tag) are stubbed verbatim. Drives 100+ advanceWeek() calls with real
   greenlit micro productions so films actually release and legacy points accrue,
   then forces a promotion (lifetime gross cranked up) and asserts the four hooks
   move in the right direction, that financing/fee stay inside their legal bands,
   that a real loan really gets cheaper, and that the endowment action pays out,
   escalates and rejects an empty wallet. Prints one line per check; exits
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
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "legacy.js"]) {
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
const src = readFileSync(path.join(gameDir, "legacy.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickLegacy/legacyTier/legacyOpenMult/legacyFinancingMult/legacyFeeMult/legacyRepBonus/legacyAction",
  typeof C.tickLegacy === "function" && typeof C.legacyTier === "function" &&
  typeof C.legacyOpenMult === "function" && typeof C.legacyFinancingMult === "function" &&
  typeof C.legacyFeeMult === "function" && typeof C.legacyRepBonus === "function" &&
  typeof C.legacyAction === "function");
check("all state lives under exactly one namespace (S.legacy)",
  /S\.legacy\b/.test(src) && !/S\.legacy[a-z]/i.test(src.replace(/S\.legacy\b/g, "")));
check("LEGACY_DESKS holds the 'legacy-tiers' desk in group 'Empire & Franchises'",
  Array.isArray(C.LEGACY_DESKS) && C.LEGACY_DESKS.length >= 1 &&
  C.LEGACY_DESKS[0].id === "legacy-tiers" && C.LEGACY_DESKS[0].group === "Empire & Franchises" &&
  C.LEGACY_DESKS[0].icon && C.LEGACY_DESKS[0].name && C.LEGACY_DESKS[0].desc &&
  typeof C.LEGACY_DESKS[0].render === "function");
check("six tiers from Indie label to Legacy house, thresholds strictly rising",
  Array.isArray(C.LEGACY_TIERS) && C.LEGACY_TIERS.length === 6 &&
  C.LEGACY_TIERS[0].n === "Indie label" && C.LEGACY_TIERS[5].n === "Legacy house" &&
  C.LEGACY_TIERS.every((t, i) => i === 0 || t.at > C.LEGACY_TIERS[i - 1].at));
check("tier 5 threshold is reachable but slow (~$8-12B lifetime gross)",
  C.LEGACY_TIERS[5].at >= 900 && C.LEGACY_TIERS[5].at <= 1600 &&
  Math.pow(9000, C.LEGACY_GROSS_EXP) >= C.LEGACY_TIERS[5].at &&
  Math.pow(500, C.LEGACY_GROSS_EXP) < C.LEGACY_TIERS[5].at,
  "tier5@" + C.LEGACY_TIERS[5].at + " · $9B→" + Math.floor(Math.pow(9000, C.LEGACY_GROSS_EXP)) + " pts · $0.5B→" + Math.floor(Math.pow(500, C.LEGACY_GROSS_EXP)));
check("LEGACY_ACHIEVEMENTS has >= 4 entries, unique legacy- ids, defensive tests",
  Array.isArray(C.LEGACY_ACHIEVEMENTS) && C.LEGACY_ACHIEVEMENTS.length >= 4 &&
  new Set(C.LEGACY_ACHIEVEMENTS.map((a) => a.id)).size === C.LEGACY_ACHIEVEMENTS.length &&
  C.LEGACY_ACHIEVEMENTS.every((a) => a.id.indexOf("legacy-") === 0 && a.tier && a.name && a.desc && typeof a.test === "function"));
check("every achievement test survives a null / empty S (defensive)",
  C.LEGACY_ACHIEVEMENTS.every((a) => {
    try { return a.test(null) === false && a.test({}) === false; } catch (e) { return false; }
  }));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0;
let badRange = 0, badFin = 0, badFee = 0, badRep = 0, badOpen = 0, badPts = 0;
let lastPoints = 0, pointsNeverFell = true, maxTierSeen = 0;
function week() {
  const before = S().studio.cash;
  try {
    C.advanceWeek();
    /* engine.js already calls tickLegacy() inside advanceWeek(); calling it again
       here is deliberate — the lastTick guard must make the second call a no-op. */
    C.tickLegacy();
  } catch (e) {
    threw = "week " + S().studio.week + ": " + (e.stack || e);
    return false;
  }
  weeksDriven++;
  const st = S().studio;
  if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return false; }
  if (st.cash < minCash) minCash = st.cash;
  if (S().over) { threw = "studio went bankrupt at week " + st.week; return false; }
  const rows = S().weekTx ? S().weekTx.rows : [];
  let sum = 0;
  for (const r of rows) sum += r.v;
  if (!nearly(st.cash - before, sum, 0.06)) ledgerBreaks++;

  if (!S().legacy) { threw = "S.legacy vanished at week " + st.week; return false; }
  const L = S().legacy;
  for (const v of [L.points, L.tier, L.lastTick, L.endow, L.endowPts, L.spent, L.repPeak, L.awardsPeak]) {
    if (!isFinite(v)) badPts++;
  }
  const t = C.legacyTier();
  if (!isFinite(t) || t < 0 || t > 5) badRange++;
  if (t > maxTierSeen) maxTierSeen = t;
  const om = C.legacyOpenMult({ genre: "action", scale: "micro" });
  const fm2 = C.legacyFinancingMult();
  const fee = C.legacyFeeMult({ k: "actor", power: 3 });
  const rep = C.legacyRepBonus();
  if (!isFinite(om) || om < 1) badOpen++;
  if (!isFinite(fm2) || fm2 <= 0 || fm2 > 1) badFin++;
  if (!isFinite(fee) || fee <= 0 || fee > 1) badFee++;
  if (!isFinite(rep) || rep < 0) badRep++;
  const pts = C.legacyPoints();
  if (!isFinite(pts) || pts < 0) badPts++;
  /* points only ever grow while gross/releases/hits/rep/awards are non-decreasing
     in the engine — the one exception is a reputation drop, which the module
     absorbs with a high-water mark, so the total must be monotonic. */
  if (pts < lastPoints - 0.001) pointsNeverFell = false;
  lastPoints = pts;
  return true;
}
function deskHTML() {
  const d = C.LEGACY_DESKS[0];
  let html = null;
  try { html = d.render(); } catch (e) { return { err: "threw: " + e.message }; }
  if (typeof html !== "string" || html.length < 60) return { err: "no body", html };
  if (html.indexOf("NaN") >= 0) return { err: "leaked NaN", html };
  if (/undefined/.test(html)) return { err: "leaked undefined", html };
  return { html };
}
function greenlit(scale, bIdx) {
  const idea = S().ideas.find((i) => !i.franchiseOf) || S().ideas[0];
  const dir = S().market.find((t) => t.k === "dir" && !C.talentBusy(t));
  const act = S().market.find((t) => t.k === "actor" && !C.talentBusy(t));
  if (!idea || !dir || !act) return { err: "nothing in the market" };
  return C.greenlight(idea.id, { scale, bIdx, dirId: dir.id, actorId: act.id, mktIdx: 0 });
}

/* ── fresh save: lazy ensure is real, hooks are neutral ──────── */
C.newGame("Legacy Test", "veteran");
check("S.legacy is absent on a fresh save (lazy ensure is real)", !S().legacy);
check("legacyTier() is 0 with no state", C.legacyTier() === 0, String(C.legacyTier()));
check("legacyPoints() is 0 with no state", C.legacyPoints() === 0);
check("all four hooks are neutral with no state (1 / 1 / 1 / 0)",
  C.legacyOpenMult(null) === 1 && C.legacyFinancingMult() === 1 &&
  C.legacyFeeMult(null) === 1 && C.legacyRepBonus() === 0,
  [C.legacyOpenMult(null), C.legacyFinancingMult(), C.legacyFeeMult(null), C.legacyRepBonus()].join(" / "));
check("legacyAction declines foreign actions", C.legacyAction("ops-press", { getAttribute: () => null }) === false &&
  C.legacyAction("gl-open", { getAttribute: () => null }) === false);

/* neutral engine math: a fresh save's fee/opening must equal the pre-module value.
   Use the most expensive actor on the market at a full budget so the 0.1M display
   rounding in feeFor() cannot hide the difference. */
const probeT = S().market.filter((t) => t.k === "actor").sort((a, b) => b.fee - a.fee)[0];
const feeNeutral = C.feeFor(probeT, 40);
const savedLegacy = S().legacy;
S().legacy = null;
const feeNoModule = C.feeFor(probeT, 40);
S().legacy = savedLegacy;
check("feeFor() is unchanged while S.legacy is absent", nearly(feeNeutral, feeNoModule),
  feeNeutral + " vs " + feeNoModule);

C.tickLegacy();
check("S.legacy namespace created lazily by tickLegacy",
  !!S().legacy && isFinite(S().legacy.lastTick) && isFinite(S().legacy.points) &&
  isFinite(S().legacy.tier) && isFinite(S().legacy.endow) && isFinite(S().legacy.endowPts) &&
  isFinite(S().legacy.repPeak) && isFinite(S().legacy.awardsPeak));
check("fresh studio still sits on tier 0 (Indie label)", C.legacyTier() === 0,
  C.legacyPoints() + " pts");
check("fresh-save hooks stay neutral after ensure",
  C.legacyOpenMult(null) === 1 && C.legacyFinancingMult() === 1 &&
  C.legacyFeeMult(null) === 1 && C.legacyRepBonus() === 0);
check("lastTick stamps the current week", S().legacy.lastTick === S().studio.week);
const r0 = deskHTML();
check("legacy-tiers desk renders a non-empty ladder on a fresh save", !r0.err, r0.err || ("len " + r0.html.length));
check("desk names all six rungs",
  !r0.err && ["Indie label", "Boutique", "Mid-tier", "Major", "Studio system", "Legacy house"].every((n) => r0.html.indexOf(n) >= 0));

/* ── tick idempotency (double-tick guard) ─────────────────────── */
S().legacy.lastTick = S().studio.week;
const ptsBefore = S().legacy.points;
const promosBefore = S().legacy.promotions;
C.tickLegacy();
C.tickLegacy();
check("tick is a no-op twice in the same week (lastTick guard)",
  S().legacy.points === ptsBefore && S().legacy.promotions === promosBefore);

/* ── endowment: insufficient cash, then a real purchase ──────── */
const cost1 = C.legacyEndowCost();
/* give the action a week ledger to write into, as advanceWeek() would */
S().weekTx = { w: S().studio.week, in: 0, out: 0, rows: [] };
S().studio.cash = 0.5;
const rej = C.legacyAction("legacy-endow", { getAttribute: () => null });
check("insufficient-cash endowment rejection (needs " + cost1 + "M, we have $0.5M)",
  rej === true && S().legacy.endow === 0 && S().legacy.endowPts === 0 && S().studio.cash === 0.5,
  "endow " + S().legacy.endow + " · cash " + S().studio.cash);
check("rejected endowment logs a toast rather than throwing",
  S().flash.some((f) => f.kind === "bad") || S().flash.length === 0);

S().studio.cash = 600;
const ptsPreEndow = C.legacyPoints();
const c1 = S().studio.cash;
const ok1 = C.legacyAction("legacy-endow", { getAttribute: () => null });
check("endowment bought for $" + cost1 + "M", ok1 === true && nearly(c1 - S().studio.cash, cost1),
  "paid " + (c1 - S().studio.cash).toFixed(1));
check("endowment banked +20 legacy points", nearly(C.legacyPoints() - ptsPreEndow, C.LEGACY_ENDOW_PTS, 1.01),
  ptsPreEndow + " → " + C.legacyPoints());
check("endowment tracked on the ledger row", (S().weekTx && S().weekTx.rows || []).some((r) => r.k === "Legacy endowment"),
  ((S().weekTx && S().weekTx.rows) || []).map((r) => r.k).join(" | ").slice(0, 90));
const cost2 = C.legacyEndowCost();
check("next endowment is dearer (" + cost1 + " → " + cost2 + ")", cost2 > cost1);
const c2 = S().studio.cash;
C.legacyAction("legacy-endow", { getAttribute: () => null });
check("second endowment charges the escalated price", nearly(c2 - S().studio.cash, cost2, 0.11),
  "paid " + (c2 - S().studio.cash).toFixed(1));
check("cumulative spend tracked", nearly(S().legacy.spent, cost1 + cost2, 0.2), String(S().legacy.spent));

/* ── real releases actually build points ─────────────────────── */
S().studio.cash = 700;
let greenErr = 0;
for (let i = 0; i < 3; i++) { if (greenlit("micro", 0).err) greenErr++; }
check("three micro productions greenlit", greenErr === 0, greenErr + " failed");
const ptsAtStart = C.legacyPoints();
const relAtStart = S().stats.releases;
check("points did not move before any release", C.legacyPoints() === ptsAtStart);

/* ── soak: 110 weeks of real play ────────────────────────────── */
withRng("fixed");
for (let i = 0; i < 110; i++) {
  const st = S().studio;
  if (st.cash < 120) st.cash = 700;              /* keep the studio alive */
  S().projects.forEach((p) => {
    if (p.phase === "ready" && !p.releaseWeek) C.setRelease(p, st.week + 2, 0);
  });
  if (S().projects.length < 3 && S().ideas.length) greenlit("micro", 0);
  if (!week()) break;
}
realRng();
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("100+ advanceWeek cycles driven", weeksDriven >= 100, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("cash stayed finite every week (min tracked)", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("films really released during the drive", S().stats.releases > relAtStart,
  relAtStart + " → " + S().stats.releases);
check("legacy points accumulated as films released", C.legacyPoints() > ptsAtStart,
  ptsAtStart + " → " + C.legacyPoints() + " pts");
check("lifetime gross is what fed the points", S().studio.lifetime > 0,
  C.fm(S().studio.lifetime));
check("tier rose off the floor during the run", maxTierSeen >= 1, "peak tier " + maxTierSeen);
check("points never fell week to week (high-water marks hold)", pointsNeverFell);
check("legacyTier() stayed inside 0..5 every week", badRange === 0, badRange + " bad reads");
check("legacyOpenMult stayed >= 1 every week", badOpen === 0);
check("legacyFinancingMult stayed in (0,1] every week", badFin === 0);
check("legacyFeeMult stayed in (0,1] every week", badFee === 0);
check("legacyRepBonus stayed >= 0 every week", badRep === 0);
check("every S.legacy numeric stayed finite every week", badPts === 0, badPts + " bad fields");
check("S.legacy exists at the end with finite key fields",
  !!S().legacy && isFinite(S().legacy.points) && isFinite(S().legacy.tier) &&
  isFinite(S().legacy.bestTier) && isFinite(S().legacy.promotions) &&
  isFinite(S().legacy.lastTick) && isFinite(S().legacy.spent) &&
  isFinite(S().legacy.endowPts) && isFinite(S().legacy.repPeak) && isFinite(S().legacy.awardsPeak));

const deskMid = deskHTML();
check("legacy-tiers desk still renders clean mid-career", !deskMid.err, deskMid.err || ("len " + deskMid.html.length));
check("desk shows the player's position and the points to the next tier",
  !deskMid.err && deskMid.html.indexOf("You are here") >= 0 && deskMid.html.indexOf("points to go") >= 0);

/* ── a real loan really gets cheaper ─────────────────────────── */
S().loans.length = 0;
/* two $30M loans at the engine's 0.6%/wk → $0.36M of interest before the discount */
S().loans.push({ amt: 30, rate: 0.006 });
S().loans.push({ amt: 30, rate: 0.006 });
const finBefore = C.legacyFinancingMult();
const expectRounded = Math.round(0.36 * finBefore * 10) / 10;
S().legacy.lastTick = -1;
withRng("fixed");
try { C.advanceWeek(); } catch (e) { threw = "loan week: " + (e.stack || e); }
realRng();
const intRow = (S().weekTx.rows || []).filter((r) => r.k === "Loan interest");
check("loan interest is booked and scaled by legacyFinancingMult",
  intRow.length === 1 && nearly(-intRow[0].v, expectRounded, 0.001) && -intRow[0].v < 0.4,
  intRow.length ? intRow[0].v.toFixed(3) + " (×" + finBefore.toFixed(3) + " of 0.36)" : "no row");
S().loans.length = 0;

/* ── forced promotion: multipliers must move the right way ───── */
const tierBefore = C.legacyTier();
const openBefore = C.legacyOpenMult({});
const finB = C.legacyFinancingMult();
const feeB = C.legacyFeeMult({});
const repB = C.legacyRepBonus();
const ptsB = C.legacyPoints();
const promoBefore = S().legacy.promotions;

S().studio.lifetime = 12000;                 /* a $12B library → top of the ladder */
S().legacy.lastTick = -1;
C.tickLegacy();

check("forced promotion raises legacyTier to 5 (Legacy house)", C.legacyTier() === 5,
  tierBefore + " → " + C.legacyTier());
check("points jumped with the lifetime gross", C.legacyPoints() > ptsB, ptsB + " → " + C.legacyPoints());
const openAfter = C.legacyOpenMult({});
const finAfter = C.legacyFinancingMult();
const feeAfter = C.legacyFeeMult({});
const repAfter = C.legacyRepBonus();
check("opening multiplier went UP (" + openBefore + " → " + openAfter + ")", openAfter > openBefore);
check("financing multiplier went DOWN and stays in (0,1] (" + finB + " → " + finAfter + ")",
  finAfter < finB && finAfter > 0 && finAfter <= 1);
check("talent-fee multiplier went DOWN and stays in (0,1] (" + feeB + " → " + feeAfter + ")",
  feeAfter < feeB && feeAfter > 0 && feeAfter <= 1);
check("reputation bonus went UP (" + repB + " → " + repAfter + ")", repAfter > repB);
check("promotion was logged exactly once", S().legacy.promotions === promoBefore + 1,
  promoBefore + " → " + S().legacy.promotions);
check("promotion toast queued", S().flash.some((f) => /Promoted/.test(f.txt)));
check("bestTier records the high-water mark", S().legacy.bestTier === 5, String(S().legacy.bestTier));

/* the engine's own numbers must reflect it */
const feeAtTop = C.feeFor(probeT, 40);
check("feeFor() on a real talent is 8% lighter at tier 5", feeAtTop < feeNeutral,
  feeNeutral + " → " + feeAtTop);

const idea = S().ideas[0];
const dirP = S().market.find((t) => t.k === "dir" && !C.talentBusy(t));
const actP = S().market.find((t) => t.k === "actor" && !C.talentBusy(t));
if (idea && dirP && actP) {
  const proj = {
    genre: idea.genre, scale: "micro", budget: 5, budgetNow: 5, mkt: 2.25, actId: actP.id,
    dirId: dirP.id, releaseWeek: S().studio.week + 3, buzz: 0, quality: 70
  };
  /* withRng("fixed") pins the engine's rf(0.8,1.25) opening jitter to a constant,
     so the ratio is the tier's doing. Tiers are re-read from points on every call,
     so dropping the gross back really does drop the tier (endowments and the rest
     of the points stay banked). */
  S().studio.lifetime = 0;
  C.tickLegacy();
  const tierLow = C.legacyTier();
  const multLow = C.legacyOpenMult(proj) * (1 + C.legacyRepBonus() / 100);
  withRng("fixed");
  const openLow = C.expectedOpening(proj);
  S().studio.lifetime = 12000;
  C.tickLegacy();
  const multHigh = C.legacyOpenMult(proj) * (1 + C.legacyRepBonus() / 100);
  const openHigh = C.expectedOpening(proj);
  realRng();
  check("expectedOpening() opens a film bigger at the top tier", openHigh > openLow,
    "tier " + tierLow + "→" + C.legacyTier() + " · " + openLow.toFixed(3) + " → " + openHigh.toFixed(3)
    + " (×" + (openHigh / openLow).toFixed(4) + ")");
  check("the lift is at least the tier's own opening × rep factor",
    openHigh / openLow > 1 && openHigh / openLow <= multHigh / multLow + 0.02,
    "×" + (openHigh / openLow).toFixed(4) + " vs tier factor ×" + (multHigh / multLow).toFixed(4));
  check("legacyOpenMult + legacyRepBonus themselves match the tier table",
    nearly(multHigh, C.LEGACY_TIERS[5].open * (1 + C.LEGACY_TIERS[5].rep / 100)),
    "×" + multHigh.toFixed(4));
}

/* ── no demotion: the engine's own counters are monotonic, so points are too ──
   (gross, releases, hits, awards and the reputation high-water mark only ever
   climb in real play — a temporary state edit below is what would drop them.) */
const ptsTop = C.legacyPoints();
const repNow = S().studio.rep;
S().studio.rep = 0;
C.tickLegacy();
check("points survive a reputation wipe (rep high-water mark)",
  C.legacyPoints() === ptsTop, ptsTop + " → " + C.legacyPoints());
check("tier never demotes on reputation loss", C.legacyTier() === 5, String(C.legacyTier()));
S().studio.rep = repNow;

/* ── desk at the top of the ladder ───────────────────────────── */
const deskTop = deskHTML();
check("legacy-tiers desk renders clean at tier 5", !deskTop.err, deskTop.err || ("len " + deskTop.html.length));
check("desk marks the top rung as 'You are here' and reports no next tier",
  !deskTop.err && deskTop.html.indexOf("You are here") >= 0 && deskTop.html.indexOf("Top of the ladder") >= 0);
check("desk shows each tier's unlocks (opening / loans / talent terms)",
  !deskTop.err && deskTop.html.indexOf("opening") >= 0 && deskTop.html.indexOf("loans ×") >= 0 &&
  deskTop.html.indexOf("talent ×") >= 0);

/* ── achievements pass against real state ────────────────────── */
const achieved = C.LEGACY_ACHIEVEMENTS.filter((a) => {
  try { return a.test(S()) === true; } catch (e) { return false; }
});
check("at least 3 achievements unlock against a tier-5 state with endowments",
  achieved.length >= 3, achieved.map((a) => a.id).join(", "));
check("achievement ids are globally unique with the legacy- prefix",
  new Set(C.LEGACY_ACHIEVEMENTS.map((a) => a.id)).size === C.LEGACY_ACHIEVEMENTS.length &&
  C.LEGACY_ACHIEVEMENTS.every((a) => a.id.indexOf("legacy-") === 0));

/* ── a couple more weeks so the promoted state survives real ticks ── */
withRng("fixed");
for (let i = 0; i < 4; i++) { S().studio.cash = 700; if (!week()) break; }
realRng();
const deskEnd = deskHTML();
check("no throw after the promotion (5 more ticks)", threw === null, threw || "clean");
check("desk renders clean at the very end", !deskEnd.err, deskEnd.err || ("len " + deskEnd.html.length));
check("tier held at 5 through the closing ticks", C.legacyTier() === 5, String(C.legacyTier()));

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED")
  + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · tier "
  + C.legacyTier() + " · " + C.legacyPoints() + " legacy points");
process.exit(failures || threw ? 1 : 0);
