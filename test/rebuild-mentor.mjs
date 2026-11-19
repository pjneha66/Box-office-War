/* Rebuild talent-mentoring harness (pattern from test/rebuild-consolehw.mjs): loads
   game/data.js + game/engine.js + game/mentor.js in a VM sandbox with a stubbed
   localStorage, then drives advanceWeek() and calls tickMentor() after each week (the
   engine does not wire tickMentor yet; the module's lastTick guard makes a second call
   in the same week a no-op, so this stays correct once the integrator wires it).
   Covers: lazy ensure, eligibility bars, the fee, the insufficient-cash rejection, a full
   26-week programme to graduation with a real permanent skill bump, the graduate index
   behind mentorCraftMod/mentorFeeMult, the in-progress mentorSkillBonus, mentor-stop, the
   desks and the achievements. Prints one line per check; exits non-zero on failure. */
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
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  /* ui.js needs a DOM; the module only calls these three on a mutating action */
  render: () => {}, drainFlash: () => {}, closeSheet: () => {},
  rerenderSheet: () => {}, openSheet: () => {}, pushToast: () => {}
});
for (const f of ["data.js", "engine.js", "mentor.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "mentor.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickMentor / mentorAction / mentorCraftMod / mentorFeeMult / mentorSkillBonus",
  typeof C.tickMentor === "function" && typeof C.mentorAction === "function" &&
  typeof C.mentorCraftMod === "function" && typeof C.mentorFeeMult === "function" &&
  typeof C.mentorSkillBonus === "function");
check("MENTOR_DESKS is an array of 'Talent' desks with the two required ids",
  Array.isArray(C.MENTOR_DESKS) && C.MENTOR_DESKS.length >= 2 &&
  C.MENTOR_DESKS.every((d) => d.id && d.group === "Talent" && d.icon && d.name && d.desc && typeof d.render === "function") &&
  C.MENTOR_DESKS.map((d) => d.id).join(",").indexOf("mentor-program") >= 0 &&
  C.MENTOR_DESKS.map((d) => d.id).join(",").indexOf("mentor-pool") >= 0);
check("MENTOR_ACHIEVEMENTS has 4+ entries with unique prefixed ids",
  Array.isArray(C.MENTOR_ACHIEVEMENTS) && C.MENTOR_ACHIEVEMENTS.length >= 4 &&
  new Set(C.MENTOR_ACHIEVEMENTS.map((a) => a.id)).size === C.MENTOR_ACHIEVEMENTS.length &&
  C.MENTOR_ACHIEVEMENTS.every((a) => a.id.indexOf("mentor-") === 0 && a.tier >= 1 && a.tier <= 3 &&
    a.name && a.desc && typeof a.test === "function"));
check("module never touches bookedUntil or S.studio.cash directly",
  !/bookedUntil\s*=/.test(src) && !/S\.studio\.cash\s*[-+]?=/.test(src));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0;
const spendRows = [], earnRows = [];
function tick() { try { C.tickMentor(); } catch (e) { threw = "tick at week " + S().studio.week + ": " + (e.stack || e); } }
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    try {
      C.advanceWeek();
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
    let sum = 0;
    for (const r of rows) {
      sum += r.v;
      if (r.v < 0 && spendRows.indexOf(r.k) < 0) spendRows.push(r.k);
      if (r.v > 0 && earnRows.indexOf(r.k) < 0) earnRows.push(r.k);
    }
    if (!nearly(st.cash - before, sum, 0.05)) ledgerBreaks++;
    tick();
    if (threw) return;
  }
}
function desksRender(label) {
  let bad = "";
  for (const d of C.MENTOR_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + e; break; }
    if (typeof html !== "string" || html.length < 40) { bad = d.id + " returned no body"; break; }
    if (html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " renders NaN/undefined"; break; }
  }
  check("both desks render a non-empty clean body " + label, bad === "", bad);
}

/* ── talent fixtures: two mentors, three mentees ──────────────── */
function makeTalent(kind, power, skill, age, name) {
  const t = C.genTalent(kind);
  t.power = power; t.skill = skill; t.age = age; t.n = name; t.bookedUntil = 0;
  S().market.push(t);
  return t;
}

/* ── week 1: lazy ensure, defaults, rejections ────────────────── */
C.newGame("Mentor Test", "veteran");
S().studio.cash = 900;
check("S.mentor is absent on a fresh save (lazy ensure is real)", !S().mentor);
tick();
check("S.mentor namespace created lazily by tickMentor",
  !!S().mentor && Array.isArray(S().mentor.active) && Array.isArray(S().mentor.graduates) &&
  typeof S().mentor.gradIndex === "object" && isFinite(S().mentor.lastTick));
check("hooks are neutral with no mentorships (craft 0, fee ×1, skill +0)",
  C.mentorCraftMod("t1", "t2") === 0 && C.mentorFeeMult("t1") === 1 && C.mentorSkillBonus("t1") === 0,
  C.mentorCraftMod("t1", "t2") + " / " + C.mentorFeeMult("t1") + " / " + C.mentorSkillBonus("t1"));

const mentorA = makeTalent("actor", 4, 85, 48, "Veteran Vega");
const mentorB = makeTalent("dir", 3, 70, 50, "Elder Stone");
/* power 3 keeps a fixture safe from the engine's quiet attrition of power <= 2 talent */
const menteeX = makeTalent("actor", 3, 45, 24, "Young Reed");
const menteeY = makeTalent("actor", 3, 50, 22, "Fresh Pine");
const menteeZ = makeTalent("dir", 3, 60, 30, "Keen Ash");
const strangerId = "t999999";

check("eligibility bars: a power-1 veteran cannot mentor, a power-4 actor cannot be mentored",
  C.mentorCanMentor({ power: 1, skill: 95 }) === false && C.mentorCanLearn({ power: 4, age: 22 }) === false &&
  C.mentorCanMentor(mentorA) === true && C.mentorCanLearn(menteeX) === true);
check("same id / unknown id rejected",
  !!C.mentorStart(menteeX.id, menteeX.id).err && !!C.mentorStart("nope", menteeX.id).err);
check("a mentee cannot start as their own mentor, and no cash moved on rejection",
  S().mentor.active.length === 0 && S().studio.cash === 900);

/* ── insufficient cash ────────────────────────────────────────── */
const feeA = C.mentorFee(mentorA);
S().studio.cash = 0.5;
const broke = C.mentorStart(mentorA.id, menteeX.id);
check("insufficient-cash start rejected (" + broke.err + ")", !!broke.err && S().studio.cash === 0.5);
check("rejected start left no active mentorship and no ledger row",
  S().mentor.active.length === 0 && !(S().weekTx && S().weekTx.rows.some((r) => r.k.indexOf("Mentorship") === 0)));
S().studio.cash = 900;
desksRender("(w1, programme empty)");

/* ── start a real mentorship: the fee is charged ──────────────── */
/* weekTx is only open during advanceWeek; open a synthetic week so the ledger rows
   written by spend()/earn() can be inspected */
S().weekTx = { w: S().studio.week, in: 0, out: 0, rows: [] };
const cashBefore = S().studio.cash;
const txRowsBefore = (S().weekTx && S().weekTx.rows) ? S().weekTx.rows.length : 0;
const started = C.mentorStart(mentorA.id, menteeX.id);
check("mentorship started with mentorA → menteeX",
  started.ok === true && S().mentor.active.length === 1, started.err || started.id);
check("fee was deducted exactly once (" + C.fm(feeA) + ")",
  nearly(cashBefore - S().studio.cash, feeA, 0.01), "paid " + (cashBefore - S().studio.cash));
check("the fee is banked in the module's own spend counter", nearly(S().mentor.spent, feeA, 0.01),
  "spent " + S().mentor.spent);
check("the fee lands as a Mentorship row in the week ledger",
  (S().weekTx.rows || []).slice(txRowsBefore).some((r) => r.k.indexOf("Mentorship") === 0 && r.v < 0),
  (S().weekTx.rows || []).slice(txRowsBefore).map((r) => r.k).join(" / ") || "none");
check("programme is 26 weeks, records the projected gain and start skill",
  S().mentor.active[0].weeks === 26 && S().mentor.active[0].weeksDone === 0 &&
  S().mentor.active[0].gain > 0 && S().mentor.active[0].startSkill === 45,
  "gain +" + S().mentor.active[0].gain + " · " + S().mentor.active[0].startSkill + " → " + S().mentor.active[0].projSkill);
check("mentor marked engaged (availability dip ×0.90) without touching bookedUntil",
  C.mentorEngaged(mentorA.id) === true && nearly(C.mentorEngagedMult(mentorA.id), 0.9) &&
  C.mentorEngagedMult(menteeX.id) === 1 && mentorA.bookedUntil === 0);
check("duplicate mentor / duplicate mentee / self rejected",
  !!C.mentorStart(mentorA.id, menteeY.id).err && !!C.mentorStart(mentorB.id, menteeX.id).err &&
  !!C.mentorStart(mentorB.id, menteeBself()).err);

function menteeBself() { return mentorB.id; }

/* ── in-progress skill bonus grows with sessions ──────────────── */
advance(10);
check("10 weeks driven without a throw", threw === null, threw || "week " + S().studio.week);
check("mentee still mid-programme (10 of 26 sessions done)",
  S().mentor.active.length === 1 && S().mentor.active[0].weeksDone === 10,
  S().mentor.active[0] ? S().mentor.active[0].weeksDone + "/26" : "gone");
const bonusMid = C.mentorSkillBonus(menteeX.id);
check("mentorSkillBonus reports a positive in-progress bonus for the mentee", bonusMid > 0, "+" + bonusMid);
check("mentorSkillBonus is 0 for a non-mentee", C.mentorSkillBonus(strangerId) === 0);
check("the mentee's real skill has not moved mid-programme (the bump lands at graduation)",
  menteeX.skill === 45, String(menteeX.skill));

/* ── second mentorship, then mentor-stop ──────────────────────── */
const s2 = C.mentorStart(mentorB.id, menteeY.id);
check("second mentorship started", s2.ok === true && S().mentor.active.length === 2);
const stopId = S().mentor.active[1].id;
check("mentor-stop handled by mentorAction", C.mentorAction("mentor-stop", { getAttribute: (k) => (k === "data-id" ? stopId : null) }) === true);
check("stopped mentorship is gone, the counter moved, no refund issued",
  S().mentor.active.length === 1 && S().mentor.stopped === 1 && S().studio.cash < 900);
check("stopping an unknown id is handled but changes nothing",
  C.mentorAction("mentor-stop", { getAttribute: () => "me-nope" }) === true && S().mentor.active.length === 1);

/* ── run to graduation ───────────────────────────────────────── */
const gradCash = S().studio.cash;
const spentBeforeGrad = S().mentor.spent;
advance(16);
check("mentorship graduated on the weekly tick (no active programmes left)",
  S().mentor.active.length === 0, S().mentor.active.length + " still running");
const grad = S().mentor.graduates[0];
check("a graduate was recorded", !!grad && grad.talentId === menteeX.id && grad.mentorId === mentorA.id,
  grad ? grad.name + " · +" + grad.gain + " → " + grad.skill : "none");
check("the mentee's skill actually increased permanently",
  menteeX.skill > 45 && menteeX.skill === grad.skill && grad.gain === menteeX.skill - 45,
  "45 → " + menteeX.skill + " (+" + (menteeX.skill - 45) + ")");
check("graduation bumped the mentee's heat", menteeX.heat === 1, "heat " + menteeX.heat);
check("the graduate is indexed for the craft/fee hooks", S().mentor.gradIndex[menteeX.id] === 1);
check("programme counters moved (sessions 1, skill banked > 0)",
  S().mentor.sessions === 1 && S().mentor.skillGained > 0 && S().mentor.heatGained === 1,
  S().mentor.sessions + " session · +" + S().mentor.skillGained + " skill");
check("graduation moved no programme cash (the fee was paid up front)",
  S().mentor.spent === spentBeforeGrad && S().mentor.sessions === 1,
  "spent " + S().mentor.spent + " · sessions " + S().mentor.sessions);

/* ── engine hooks on the graduate vs a stranger ───────────────── */
const craftGrad = C.mentorCraftMod(menteeX.id, null);
const craftBoth = C.mentorCraftMod(menteeX.id, menteeX.id);
check("mentorCraftMod is positive for the graduated mentee's id", craftGrad > 0, "+" + craftGrad);
check("mentorCraftMod counts both roles but is capped at +5", craftBoth > craftGrad && craftBoth <= 5, "+" + craftBoth);
check("mentorCraftMod is 0 for a stranger", C.mentorCraftMod(strangerId, strangerId) === 0);
check("mentorFeeMult is < 1 for a graduate", C.mentorFeeMult(menteeX.id) < 1, "×" + C.mentorFeeMult(menteeX.id));
check("mentorFeeMult is exactly 1 for a stranger", C.mentorFeeMult(strangerId) === 1);
check("mentorFeeMult accepts a talent object as well as an id",
  C.mentorFeeMult(menteeX) === C.mentorFeeMult(menteeX.id));
check("mentorSkillBonus is 0 again once the programme is over", C.mentorSkillBonus(menteeX.id) === 0);
check("mentorEngaged is false after graduation", C.mentorEngaged(mentorA.id) === false);

/* ── a second programme can start and the graduate keeps the perk ── */
const again = C.mentorStart(mentorA.id, menteeZ.id);
check("a mentor can take a new mentee after graduating one", again.ok === true && S().mentor.active.length === 1);
check("the earlier graduate's craft bonus survives a new programme",
  C.mentorCraftMod(menteeX.id, null) === craftGrad);
desksRender("(after graduation)");

/* ── action delegation edges ──────────────────────────────────── */
const stub = { getAttribute: () => null };
check("mentorAction handles mentor-start (bad ids → handled, rejected)",
  C.mentorAction("mentor-start", stub) === true && S().mentor.active.length === 1);
check("mentorAction returns false for foreign actions",
  C.mentorAction("ppl-enroll", stub) === false && C.mentorAction("gl-open", stub) === false &&
  C.mentorAction("mentor-", stub) === false);

/* ── long soak: 90+ driven weeks, invariants hold ─────────────── */
S().studio.cash = 900;
S().studio.catalog = 120;   /* a catalog earns library royalties — gives the ledger a real income row */
advance(70);
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("90+ advanceWeek cycles driven", weeksDriven >= 90, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("cash stayed finite every week (min tracked)", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("at least one spend and one earn recorded in the ledger",
  spendRows.length >= 1 && earnRows.length >= 1, spendRows.length + " spend kinds · " + earnRows.length + " earn kinds");
check("S.mentor survives the soak with finite key fields",
  !!S().mentor && isFinite(S().mentor.lastTick) && isFinite(S().mentor.sessions) &&
  isFinite(S().mentor.stopped) && isFinite(S().mentor.spent) &&
  isFinite(S().mentor.skillGained) && isFinite(S().mentor.heatGained) &&
  Array.isArray(S().mentor.active) && Array.isArray(S().mentor.graduates));
check("no NaN or Infinity anywhere in S.mentor",
  (function () {
    let bad = "";
    function walk(v, p) {
      if (bad) return;
      if (typeof v === "number") { if (!isFinite(v)) bad = p + "=" + v; return; }
      if (!v || typeof v !== "object") return;
      for (const k of Object.keys(v)) walk(v[k], p + "." + k);
    }
    walk(S().mentor, "S.mentor");
    if (bad) console.log("   ↳ " + bad);
    return bad === "";
  })(), "every numeric leaf finite");
check("a graduate is still recognised at the end of the soak",
  C.mentorCraftMod(menteeX.id, null) > 0 && C.mentorFeeMult(menteeX.id) < 1,
  "+" + C.mentorCraftMod(menteeX.id, null) + " craft · ×" + C.mentorFeeMult(menteeX.id));

/* ── double-tick guard ───────────────────────────────────────── */
S().mentor.lastTick = S().studio.week - 1;
while (S().mentor.active.length) C.mentorStop(S().mentor.active[0].id);
const guardMentee = makeTalent("actor", 3, 40, 21, "Guard Grove");
C.mentorStart(mentorB.id, guardMentee.id);
const beforeGuard = S().mentor.active.length ? S().mentor.active[0].weeksDone : -1;
C.tickMentor();
const afterFirst = S().mentor.active.length ? S().mentor.active[0].weeksDone : -1;
C.tickMentor();
const afterSecond = S().mentor.active.length ? S().mentor.active[0].weeksDone : -1;
check("tick is idempotent per week (second call in the same week does nothing)",
  beforeGuard === 0 && afterFirst === 1 && afterSecond === 1,
  beforeGuard + " → " + afterFirst + " → " + afterSecond);

/* ── achievements ────────────────────────────────────────────── */
let achThrow = null;
for (const a of C.MENTOR_ACHIEVEMENTS) {
  try {
    const v = a.test(S());
    if (typeof v !== "boolean") { achThrow = a.id + " returned " + typeof v; break; }
  } catch (e) { achThrow = a.id + " threw: " + e; break; }
}
check("every achievement test runs and returns a boolean", achThrow === null, achThrow || "");
check("achievement tests are defensive on an empty state",
  C.MENTOR_ACHIEVEMENTS.every((a) => {
    try { return a.test({}) === false && a.test(null) === false; } catch (e) { return false; }
  }));
check("the graduation achievements now read true",
  C.MENTOR_ACHIEVEMENTS.filter((a) => a.test(S())).length >= 2,
  C.MENTOR_ACHIEVEMENTS.filter((a) => a.test(S())).map((a) => a.id).join(","));
desksRender("(end, 90+ weeks in)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · graduates " +
  S().mentor.graduates.length + " · skill banked " + S().mentor.skillGained);
process.exit(failures || threw ? 1 : 0);
