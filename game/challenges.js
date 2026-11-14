/* Box Office War — rebuilt. Seeded challenge runs + Hall of Fame — all state under S.chal
   (per-run modifiers live in S.challenge, set at start and read by the engine's challengeMod hook).
   Systems: 5 seeded daily archetypes (seed = UTC date) · 3 weekly missions (seed = ISO week) ·
   two-tap start (newGame("Challenge Studio","veteran","std","free") + engine-wide modifiers) ·
   score & Hall of Fame (top 10, persisted with the save via S.chal.hall).
   PRNG (Mulberry32) + seed hashing (FNV-1a) ported from the root challenge-leaderboard.js for parity.
   Wiring: ui.js bridges chalAction() for "chal-*" actions; desks via CHALLENGE_DESKS. No weekly tick
   is needed — nothing changes state between actions. */
"use strict";

/* ── deterministic seed core (ported from challenge-leaderboard.js) ── */
function chalPrng(seedInt) {
  var s = (seedInt >>> 0) || 123456789;
  return function () {
    var t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function chalHash(str) {
  var h = 2166136261 >>> 0, i;
  for (i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function chalPad2(n) { return (n < 10 ? "0" : "") + n; }
function chalIsoWeek(d) {
  var t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  var day = (t.getUTCDay() + 6) % 7;              /* Mon=0 .. Sun=6 */
  t.setUTCDate(t.getUTCDate() - day + 3);         /* this ISO week's Thursday */
  var isoY = t.getUTCFullYear();
  var ft = new Date(Date.UTC(isoY, 0, 4));        /* Jan 4 is always in ISO week 1 */
  var fday = (ft.getUTCDay() + 6) % 7;
  ft.setUTCDate(ft.getUTCDate() - fday + 3);      /* Thursday of ISO week 1 */
  return { y: isoY, w: 1 + Math.round((t.getTime() - ft.getTime()) / (7 * 86400000)) };
}
function chalDailySeed(d) { return "CHLG-" + d.getUTCFullYear() + chalPad2(d.getUTCMonth() + 1) + chalPad2(d.getUTCDate()); }
function chalWeeklySeed(d) { var iw = chalIsoWeek(d); return "WEEKLY-" + iw.y + "-W" + chalPad2(iw.w); }

/* ── challenge catalogue ──────────────────────────────────────── */
var CHAL_DAILY = [
  { id: "credit",   name: "Credit Crunch",    mod: { interestMult: 1.4, overheadMult: 1,   startCashMult: 0.8 },
    note: "Loan interest ×1.4 and 20% less starting cash — the bank is not your friend." },
  { id: "indie",    name: "Indie Survival",   mod: { interestMult: 1,   overheadMult: 1.5, startCashMult: 0.5 },
    note: "Half the starting cash and weekly overhead ×1.5. Survive 104 weeks." },
  { id: "block",    name: "Blockbuster Only", mod: { interestMult: 1,   overheadMult: 1,   startCashMult: 1 },
    note: "Scale gate (honor rule): greenlight Mid-budget and Tentpole pictures only — no micro or indie films." },
  { id: "prestige", name: "Prestige Season",  mod: { interestMult: 1,   overheadMult: 1,   startCashMult: 1 },
    note: "Drama bonus (honor rule): every drama or musical you release should land quality 70+ — awards are the only currency." },
  { id: "rival",    name: "Rival Surge",      mod: { interestMult: 1,   overheadMult: 1,   startCashMult: 1, rivalPowerAdd: 0.2 },
    note: "Every rival studio opens +0.2 power — the competition never sleeps." }
];
var CHAL_WEEKLY = [
  { id: "w-indie",    name: "Indie Survival Gauntlet", mod: { interestMult: 1.2, overheadMult: 1.3,  startCashMult: 0.6 },
    note: "Start lean with heavy overhead — eight profitable releases in 156 weeks, never default." },
  { id: "w-tent",     name: "Tentpole Empire",         mod: { interestMult: 1,   overheadMult: 1.15, startCashMult: 0.9 },
    note: "Carry three tentpoles to theaters and $2.5B lifetime gross within 156 weeks." },
  { id: "w-prestige", name: "Prestige Master",         mod: { interestMult: 1,   overheadMult: 1.2,  startCashMult: 1 },
    note: "Land five award-calibre films (quality 75+) while staying solvent for 156 weeks." }
];

function chalCopyMod(m) {
  return {
    interestMult: m.interestMult || 1,
    overheadMult: m.overheadMult || 1,
    startCashMult: m.startCashMult || 1,
    rivalPowerAdd: m.rivalPowerAdd || 0
  };
}
function chalPick(seedStr, kind) {
  var rnd = chalPrng(chalHash(seedStr));
  var a = (kind === "weekly" ? CHAL_WEEKLY : CHAL_DAILY)[Math.floor(rnd() * (kind === "weekly" ? CHAL_WEEKLY : CHAL_DAILY).length)];
  return {
    kind: kind, id: seedStr, seedStr: seedStr,
    name: a.name, note: a.note, mod: chalCopyMod(a.mod),
    targetWeeks: kind === "weekly" ? 156 : 104
  };
}
function chalDaily() { return chalPick(chalDailySeed(new Date()), "daily"); }
function chalWeekly() { return chalPick(chalWeeklySeed(new Date()), "weekly"); }
/* BOW- share code: "BOW-" + 4-char base36 checksum of the run's seed + name. */
function chalShareCode(ch) {
  var sum = (chalHash(ch.seedStr + "|" + ch.name) % 1679616).toString(36).toUpperCase();
  while (sum.length < 4) sum = "0" + sum;
  return "BOW-" + sum;
}

/* ── state (lazy ensure — old saves have no S.chal) ───────────── */
function chalEnsure() {
  if (!S.chal) S.chal = { hall: [] };
  if (!S.chal.hall) S.chal.hall = [];
}

/* ── engine hook: engine multiplies loan interest and overhead by this ── */
function challengeMod() {
  if (!S || !S.challenge || !S.challenge.mod) return null;
  return S.challenge.mod;
}

/* ── start run (two-tap: chal-arm-<kind> then chal-start) ─────── */
var CHAL_ARM = null; /* transient { kind } — first tap of the two-tap confirm */
function chalStart(kind) {
  var ch = kind === "weekly" ? chalWeekly() : chalDaily();
  newGame("Challenge Studio", "veteran", "std", "free");
  S.challenge = { id: ch.id, kind: ch.kind, name: ch.name, note: ch.note, mod: chalCopyMod(ch.mod), startWeek: S.studio.week, targetWeeks: ch.targetWeeks };
  chalEnsure();
  S.studio.cash = Math.round(S.studio.cash * S.challenge.mod.startCashMult); /* applied immediately, per contract */
  if (S.challenge.mod.rivalPowerAdd) {
    for (var i = 0; i < S.rivals.length; i++) S.rivals[i].power = clamp(S.rivals[i].power + S.challenge.mod.rivalPowerAdd, 0.2, 2);
    log("Rival surge: every rival studio operates at +0.2 power this run.", "bad", "🏁");
  }
  log("🏁 Challenge started: " + ch.name + " — reach week " + (S.studio.week + ch.targetWeeks) + ". " + ch.note, "gold", "🏁");
  toast("🏁 " + ch.name + " — " + ch.targetWeeks + " weeks. Good luck.", "gold");
  CHAL_ARM = null;
  chalCommit();
}

/* ── score & Hall of Fame ─────────────────────────────────────── */
function chalDebt() {
  var d = S.mezz || 0, i;
  for (i = 0; i < S.loans.length; i++) d += S.loans[i].amt;
  return d;
}
function chalComputeScore() {
  var st = S.studio;
  return Math.round(st.cash + st.catalog + st.lifetime * 0.5 + S.stats.hits * 40 + st.rep * 2 - chalDebt());
}
function chalScoreRun() {
  if (!S.challenge) return { err: "No challenge run is active — start one first." };
  chalEnsure();
  var early = S.studio.week < S.challenge.targetWeeks;
  var sc = chalComputeScore();
  if (early) sc = Math.round(sc * 0.8); /* early score penalty */
  var i;
  for (i = S.chal.hall.length - 1; i >= 0; i--) {
    if (S.chal.hall[i].challenge === S.challenge.name && S.chal.hall[i].week === S.studio.week) S.chal.hall.splice(i, 1);
  }
  S.chal.hall.push({ name: S.studio.name, challenge: S.challenge.name, score: sc, week: S.studio.week });
  S.chal.hall.sort(function (a, b) { return b.score - a.score; });
  if (S.chal.hall.length > 10) S.chal.hall.length = 10;
  log("Hall of Fame: “" + S.studio.name + "” scored " + sc + " on " + S.challenge.name + (early ? " (early score ×0.8)" : "") + ".", "gold", "🏁");
  toast("🏁 Scored " + sc + " points" + (early ? " (early ×0.8)" : "") + ".", "gold");
  return { ok: true, score: sc, early: early };
}

/* ── commit + action delegation (ui calls chalAction first) ───── */
function chalCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function chalRenderCommit() {
  if (typeof render === "function") render(); /* arm/cancel only touch transient UI state */
}
function chalAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("chal-") !== 0) return false;
  chalEnsure();
  if (a === "chal-arm-daily") { CHAL_ARM = { kind: "daily" }; chalRenderCommit(); return true; }
  if (a === "chal-arm-weekly") { CHAL_ARM = { kind: "weekly" }; chalRenderCommit(); return true; }
  if (a === "chal-arm-cancel") { CHAL_ARM = null; chalRenderCommit(); return true; }
  if (a === "chal-start") {
    if (CHAL_ARM) chalStart(CHAL_ARM.kind);
    else toast("Pick a challenge first.", "bad");
    return true;
  }
  if (a === "chal-score") {
    var r = chalScoreRun();
    if (r && r.err) toast(r.err, "bad");
    chalCommit();
    return true;
  }
  return false;
}

/* ── desk ─────────────────────────────────────────────────────── */
function chalModText(mod) {
  var parts = [];
  if (mod.interestMult !== 1) parts.push("interest ×" + mod.interestMult);
  if (mod.overheadMult !== 1) parts.push("overhead ×" + mod.overheadMult);
  if (mod.startCashMult !== 1) parts.push("start cash ×" + mod.startCashMult);
  if (mod.rivalPowerAdd) parts.push("rival power +" + mod.rivalPowerAdd);
  return parts.length ? parts.join(" · ") : "no engine modifiers — honor-rule challenge";
}
function chalCard(ch, armAction) {
  var html = '<div class="card film">'
    + '<div class="head"><div class="title">' + (ch.kind === "weekly" ? "🗓" : "📅") + " " + esc(ch.name) + "</div>"
    + tag("Target " + ch.targetWeeks + " wk", "blue") + "</div>"
    + '<div class="meta">' + tag("Seed " + esc(ch.seedStr)) + tag(chalShareCode(ch), "gold") + "</div>"
    + '<div class="statrow"><span class="k">Modifiers</span><span class="v">' + esc(chalModText(ch.mod)) + "</span></div>"
    + '<div class="statrow"><span class="k">Rule</span><span class="v">' + esc(ch.note) + "</span></div>";
  if (CHAL_ARM && CHAL_ARM.kind === ch.kind) {
    html += '<div class="statrow"><span class="k">⚠ Starting wipes this studio. Export your save from the Ledger first (Ledger → Export save).</span><span class="v"></span></div>'
      + '<div class="foot btnrow"><button class="btn sm" data-action="chal-arm-cancel">Cancel</button>'
      + '<button class="btn danger grow" data-action="chal-start">Confirm — start ' + ch.kind + " run</button></div>";
  } else {
    html += '<div class="foot"><button class="btn primary sm grow" data-action="' + armAction + '">Start ' + ch.kind + " run</button></div>";
  }
  return html + "</div>";
}
function chalDesk() {
  chalEnsure();
  var html = '<div data-chaldesk="chal">';
  if (S.challenge) {
    var ch = S.challenge;
    var reached = S.studio.week >= ch.targetWeeks;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">🏁 ' + esc(ch.name) + "</div>"
      + tag(reached ? "Target reached" : "Week " + S.studio.week + " / " + ch.targetWeeks, reached ? "gold" : "blue") + "</div>"
      + '<div class="meta">' + tag("Seed " + esc(ch.id)) + tag(chalShareCode(ch), "gold") + "</div>"
      + '<div class="statrow"><span class="k">Modifiers</span><span class="v">' + esc(chalModText(ch.mod)) + "</span></div>"
      + '<div class="foot"><button class="btn primary sm grow" data-action="chal-score">'
      + (reached ? "Score current run" : "Score early (×0.8)") + "</button></div>"
      + "</div>";
  }
  html += '<div class="sechead"><h2>Today\'s daily challenge</h2></div>' + chalCard(chalDaily(), "chal-arm-daily");
  html += '<div class="sechead"><h2>This week\'s mission</h2></div>' + chalCard(chalWeekly(), "chal-arm-weekly");
  html += '<div class="sechead"><h2>Hall of Fame</h2></div><div class="card pad0">';
  if (!S.chal.hall.length) {
    html += '<div class="empty"><span class="em">🏁</span>No scored runs yet. Start a challenge and bank a score.</div>';
  } else {
    var hall = S.chal.hall.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 10);
    for (var i = 0; i < hall.length; i++) {
      html += '<div class="news-item"><span class="ico">' + (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏁") + "</span><div>"
        + esc(hall[i].name) + " — " + esc(hall[i].challenge)
        + '<div class="when">week ' + hall[i].week + " · score " + hall[i].score + "</div></div></div>";
    }
  }
  html += "</div></div>";
  return html;
}

var CHALLENGE_DESKS = [
  { id: "chal-desk", group: "Challenges", icon: "🏁", name: "Challenges & Hall of Fame",
    desc: "Seeded daily runs, weekly missions, engine-wide modifiers and a Hall of Fame of scored runs.",
    render: chalDesk }
];
