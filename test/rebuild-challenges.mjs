/* Rebuild challenges-module harness (pattern from test/rebuild-games.mjs): runs game/data.js +
   game/engine.js + game/challenges.js in a VM sandbox with a stubbed localStorage. ui.js needs a
   DOM, so the two string helpers the desk renders with (tag, statrow) are stubbed verbatim.
   Exercises every system through the module's real functions: seeded PRNG parity (reference
   Mulberry32/FNV-1a re-implemented from root challenge-leaderboard.js), same-seed determinism,
   two-tap start (arm → confirm), the LIVE engine challengeMod hook (interest/overhead rows in the
   real advanceWeek ledger), startCashMult application, early scoring with ×0.8, Hall of Fame
   persistence across saveGame/loadGame and top-10 sorting, plus a controlled rival-surge start.
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
  /* ui.js string helpers (ui.js itself can't load without a DOM); same behavior as ui.js */
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>"
});
for (const f of ["data.js", "engine.js", "challenges.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

function stub(key) {
  return { getAttribute: (k) => (k === "data-key" && key != null ? key : null) };
}
function deskHtml() { return C.CHALLENGE_DESKS[0].render(); }
function deskClean(label) {
  let html = null, bad = "";
  try { html = deskHtml(); } catch (e) { bad = "threw: " + e.message; }
  if (!bad && (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0)) bad = "dirty output";
  check("chal-desk renders clean " + label, bad === "", bad);
}
function scoreNow(st) {
  const debt = (st.mezz || 0) + st.loans.reduce((a, l) => a + l.amt, 0);
  return Math.round(st.studio.cash + st.studio.catalog + st.studio.lifetime * 0.5
    + st.stats.hits * 40 + st.studio.rep * 2 - debt);
}

/* ── reference PRNG: verbatim port of root challenge-leaderboard.js ── */
function refPrng(seedInt) {
  let s = (seedInt >>> 0) || 123456789;
  return function () {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function refHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ── static contract checks ───────────────────────────────────── */
const src = readFileSync(path.join(gameDir, "challenges.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports chalAction / challengeMod / chalDaily / chalWeekly",
  typeof C.chalAction === "function" && typeof C.challengeMod === "function" &&
  typeof C.chalDaily === "function" && typeof C.chalWeekly === "function");
check("CHALLENGE_DESKS is a shaped 1-desk array (chal-desk / Challenges)",
  Array.isArray(C.CHALLENGE_DESKS) && C.CHALLENGE_DESKS.length === 1 &&
  C.CHALLENGE_DESKS[0].id === "chal-desk" && C.CHALLENGE_DESKS[0].group === "Challenges" &&
  C.CHALLENGE_DESKS[0].icon === "🏁" && C.CHALLENGE_DESKS[0].name === "Challenges & Hall of Fame" &&
  typeof C.CHALLENGE_DESKS[0].render === "function");
check("catalogue: 5 daily archetypes + 3 weekly missions", C.CHAL_DAILY.length === 5 && C.CHAL_WEEKLY.length === 3);

/* ── PRNG parity with the old leaderboard ─────────────────────── */
let parity = true, parErr = "";
for (const seed of ["CHLG-20261114", "WEEKLY-2026-W46", "CHLG-20200101"]) {
  const mine = C.chalPrng(C.chalHash(seed)), ref = refPrng(refHash(seed));
  for (let i = 0; i < 8; i++) {
    const a = mine(), b = ref();
    if (!nearly(a, b, 1e-12) || a < 0 || a >= 1) { parity = false; parErr = seed + " #" + i + " " + a + " vs " + b; }
  }
}
check("Mulberry32 + FNV-1a match the old challenge-leaderboard.js", parity, parErr);

/* ── seeding: same seed → same challenge; catalogue coverage ──── */
const dA = C.chalPick("CHLG-20261114", "daily"), dB = C.chalPick("CHLG-20261114", "daily");
check("same seed → identical daily challenge", JSON.stringify(dA) === JSON.stringify(dB), dA.name);
check("daily targets 104 weeks, weekly 156", dA.targetWeeks === 104 && C.chalPick("WEEKLY-2026-W46", "weekly").targetWeeks === 156);
const wA = C.chalPick("WEEKLY-2026-W46", "weekly"), wB = C.chalPick("WEEKLY-2026-W46", "weekly");
check("same seed → identical weekly mission", JSON.stringify(wA) === JSON.stringify(wB), wA.name);
check("seed string formats: CHLG-YYYYMMDD / WEEKLY-YYYY-Www",
  /^CHLG-\d{8}$/.test(dA.seedStr) && /^WEEKLY-\d{4}-W\d{2}$/.test(wA.seedStr), dA.seedStr + " · " + wA.seedStr);
const dailyNames = new Set(), weeklyNames = new Set();
for (let i = 0; i < 200; i++) {
  const dd = new Date(Date.UTC(2026, 0, 1 + i));
  dailyNames.add(C.chalPick(C.chalDailySeed(dd), "daily").name);
}
for (let i = 0; i < 52; i++) {
  const wd = new Date(Date.UTC(2026, 0, 1 + i * 7));
  weeklyNames.add(C.chalPick(C.chalWeeklySeed(wd), "weekly").name);
}
check("all 5 daily archetypes reachable over 200 days", dailyNames.size === 5, [...dailyNames].join(", "));
check("all 3 weekly missions reachable over 52 weeks", weeklyNames.size === 3, [...weeklyNames].join(", "));
check("share code format BOW-<4 base36>", /^BOW-[0-9A-Z]{4}$/.test(C.chalShareCode(dA)) && /^BOW-[0-9A-Z]{4}$/.test(C.chalShareCode(wA)),
  C.chalShareCode(dA) + " · " + C.chalShareCode(wA));

/* ── fresh game: no challenge, desk renders, 46 plain weeks ───── */
C.newGame("Chal Test Studios", "veteran");
check("challengeMod() is null before any start run", C.challengeMod() === null);
check("scoring rejected with no active challenge", !!C.chalScoreRun().err);
check("chalAction returns false for foreign actions", C.chalAction("gl-open", stub()) === false);
let html = deskHtml();
check("desk shows both seeded challenges + share codes + empty hall",
  html.indexOf('data-chaldesk="chal"') >= 0 && html.indexOf("Today's daily challenge") >= 0 &&
  html.indexOf("This week's mission") >= 0 && (html.match(/BOW-[0-9A-Z]{4}/g) || []).length >= 2 &&
  html.indexOf("No scored runs yet") >= 0);
deskClean("(week 1, no challenge)");

let weeksDriven = 0, minCash = Infinity, threw = null;
function drive(n) {
  for (let i = 0; i < n; i++) {
    try { C.advanceWeek(); } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); return; }
    weeksDriven++;
    if (!isFinite(S().studio.cash)) { threw = "non-finite cash at week " + S().studio.week; return; }
    if (S().studio.cash < minCash) minCash = S().studio.cash;
    if (S().over) { threw = "bankrupt at week " + S().studio.week; return; }
  }
}
drive(46);
check("no throw and cash finite through 46 plain weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("challengeMod still null after plain weeks", C.challengeMod() === null);
check("hall empty before any start run", S().chal.hall.length === 0);

/* ── two-tap start of today's seeded daily ────────────────────── */
check("arm daily → true", C.chalAction("chal-arm-daily", stub()) === true);
check("armed desk shows export hint + confirm button",
  deskHtml().indexOf("Export your save") >= 0 && deskHtml().indexOf("Confirm — start daily run") >= 0);
check("cancel disarms", C.chalAction("chal-arm-cancel", stub()) === true && deskHtml().indexOf("Export your save") < 0);
C.chalAction("chal-arm-daily", stub());
const daily = C.chalDaily();
check("confirm starts the run", C.chalAction("chal-start", stub()) === true);
const ch = S().challenge;
check("S.challenge set: id, mod, startWeek 1, target 104",
  !!ch && ch.id === daily.id && ch.name === daily.name && ch.startWeek === 1 && ch.targetWeeks === 104 && !!ch.mod,
  ch ? ch.name + " · " + ch.id : "missing");
check("new run is a fresh 'Challenge Studio' on veteran/std/free",
  S().studio.name === "Challenge Studio" && S().studio.week === 1 && S().origin === "veteran" && S().diff === "std");
check("challengeMod() returns the run's mod after start", C.challengeMod() !== null && C.challengeMod() === ch.mod &&
  isFinite(ch.mod.interestMult) && isFinite(ch.mod.overheadMult) && isFinite(ch.mod.startCashMult),
  "interest ×" + ch.mod.interestMult + " · overhead ×" + ch.mod.overheadMult + " · cash ×" + ch.mod.startCashMult);
check("startCashMult applied to starting cash", nearly(S().studio.cash, Math.round(80 * ch.mod.startCashMult)),
  "cash " + S().studio.cash + " = 80 × " + ch.mod.startCashMult);
deskClean("(daily run active, week 1)");
check("active desk shows week counter + score button",
  deskHtml().indexOf("Week 1 / 104") >= 0 && deskHtml().indexOf("Score early (×0.8)") >= 0);

/* ── the LIVE engine hook: interest + overhead multiplied ────── */
check("emergency loan taken for the interest check", C.takeLoan() === true);
const wkBefore = S().studio.week;
C.advanceWeek(); weeksDriven++;
const rows = S().weekTx.rows;
const iRow = rows.find((r) => r.k === "Loan interest");
const oRow = rows.find((r) => r.k === "Overhead");
check("engine interest row ×interestMult (live challengeMod)",
  !!iRow && nearly(iRow.v, -Math.round(30 * 0.006 * ch.mod.interestMult * 10) / 10),
  iRow ? String(iRow.v) : "no row");
check("engine overhead row ×overheadMult (live challengeMod)",
  !!oRow && nearly(oRow.v, -Math.round((0.25 + 0.40) * ch.mod.overheadMult * 10) / 10),
  oRow ? String(oRow.v) : "no row");
check("advanced exactly one week with the challenge on", S().studio.week === wkBefore + 1);
check("loan repaid", C.repayLoan() === true && S().loans.length === 0);

/* ── score early (week < target): ×0.8 penalty ────────────────── */
const expectedEarly = Math.round(scoreNow(S()) * 0.8);
check("score current run → true", C.chalAction("chal-score", stub()) === true);
check("hall has one entry with the expected early score",
  S().chal.hall.length === 1 && S().chal.hall[0].score === expectedEarly &&
  S().chal.hall[0].name === "Challenge Studio" && S().chal.hall[0].challenge === ch.name &&
  S().chal.hall[0].week === S().studio.week && isFinite(S().chal.hall[0].score),
  "score " + (S().chal.hall[0] ? S().chal.hall[0].score : "?") + " vs expected " + expectedEarly);
check("early score logged", S().news.some((n) => n.txt.indexOf("Hall of Fame") >= 0 && n.txt.indexOf("early score") >= 0));

/* ── hall persists across saveGame/loadGame ───────────────────── */
const savedHall = JSON.stringify(S().chal.hall);
C.saveGame();
S().chal.hall.push({ name: "Junk", challenge: "x", score: 999999, week: 0 }); /* corrupt in-memory */
check("loadGame() restores the hall from localStorage",
  C.loadGame() === true && JSON.stringify(S().chal.hall) === savedHall);

/* ── top-10 sort + cap through the real scorer ────────────────── */
for (let i = 1; i <= 12; i++) S().chal.hall.push({ name: "Filler " + i, challenge: "Filler", score: i, week: 1000 + i });
drive(1);
const expectedSecond = Math.round(scoreNow(S()) * 0.8);
C.chalAction("chal-score", stub());
const hall = S().chal.hall;
let sorted = true, uniquePairs = true;
const seen = {};
for (let i = 0; i < hall.length; i++) {
  if (i && hall[i - 1].score < hall[i].score) sorted = false;
  const k = hall[i].challenge + "|" + hall[i].week;
  if (seen[k]) uniquePairs = false;
  seen[k] = true;
}
check("hall capped at top 10, sorted desc", hall.length === 10 && sorted, hall.length + " entries");
check("re-score replaced the same-week entry (no duplicate challenge+week)", uniquePairs);
const newEntry = hall.find((e) => e.week === S().studio.week);
check("re-scored entry stored with the expected ×0.8 score",
  !!newEntry && newEntry.score === expectedSecond,
  "entry " + (newEntry ? newEntry.score : "missing") + " vs expected " + expectedSecond);
check("hall leader holds the maximum score", hall[0].score === Math.max.apply(null, hall.map((e) => e.score)),
  "leader " + hall[0].score);
deskClean("(daily run + top-10 hall)");
check("desk lists the hall entries", deskHtml().indexOf("Challenge Studio") >= 0 && deskHtml().indexOf("score " + expectedSecond) >= 0);

/* ── weekly mission start (fresh save, weekly mods live) ──────── */
C.chalAction("chal-arm-weekly", stub());
check("confirm starts the weekly run", C.chalAction("chal-start", stub()) === true);
const wch = S().challenge;
check("weekly run: target 156, kind weekly, mod live",
  wch.kind === "weekly" && wch.targetWeeks === 156 && C.challengeMod() === wch.mod, wch.name);
check("weekly startCashMult applied", nearly(S().studio.cash, Math.round(80 * wch.mod.startCashMult)), "cash " + S().studio.cash);
check("fresh run starts with an empty hall (hall is per-save)", S().chal.hall.length === 0);
drive(12);
check("12 weekly-mission weeks: no throw, cash finite, mod still live",
  threw === null && isFinite(S().studio.cash) && C.challengeMod() === wch.mod, threw || "cash " + Math.round(S().studio.cash) + "M");
deskClean("(weekly run, week " + S().studio.week + ")");
check("60+ advanceWeek calls driven with everything finite", threw === null && weeksDriven >= 60, String(weeksDriven));

/* ── controlled rival-surge start (synthetic newGame, end of run) ── */
const realNewGame = C.newGame;
C.newGame = function () {
  C.S = { studio: { name: "x", cash: 80, rep: 35, week: 1, woy: 1, year: 1, catalog: 0, lifetime: 0 },
    stats: { hits: 0 }, loans: [], mezz: 0, news: [], flash: [],
    rivals: [{ name: "Rival A", power: 0.9 }, { name: "Rival B", power: 1.5 }] };
};
C.chalDaily = function () {
  return { kind: "daily", id: "CHLG-FIXED", seedStr: "CHLG-FIXED", name: "Rival Surge", note: "test",
    mod: C.chalCopyMod({ rivalPowerAdd: 0.2, startCashMult: 0.5 }), targetWeeks: 104 };
};
C.chalAction("chal-arm-daily", stub());
C.chalAction("chal-start", stub());
check("rival surge: every rival power +0.2, clamped",
  nearly(S().rivals[0].power, 1.1) && nearly(S().rivals[1].power, 1.7),
  S().rivals[0].power + " / " + S().rivals[1].power);
check("controlled start: cash ×0.5 and challengeMod live",
  nearly(S().studio.cash, 40) && C.challengeMod() !== null && C.challengeMod().rivalPowerAdd === 0.2);
C.newGame = realNewGame;

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
