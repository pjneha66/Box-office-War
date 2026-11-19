/* Box Office War — rebuilt. Talent mentoring module (v46, module 4) — all state under
   S.mentor. Systems: mentorships that pair a veteran (power >= 3, skill >= 68) with a
   young hopeful (power <= 3, age <= 32) for a fixed 26-week programme; the mentee earns
   skill progress every session week and, on graduation, takes a real permanent skill bump
   (capped at 97) plus a heat bump. Graduates are recorded in S.mentor.graduates and their
   ids indexed in S.mentor.gradIndex so mentorCraftMod() can recognise them later, while
   mentorFeeMult() gives a loyal-mentee discount and mentorSkillBonus() reports the
   in-progress bonus for a current mentee.

   Wiring: the integrator calls tickMentor() inside advanceWeek() (typeof-guarded), bridges
   mentorAction() in ui.js onAction() and appends MENTOR_DESKS in collectDesks(); the
   engine applies mentorCraftMod() at computeQuality and may apply mentorFeeMult(t) in
   feeFor(). No self-wiring, no engine mutation: bookedUntil belongs to the engine, so the
   mentor's availability dip is tracked here (mentorEngaged / mentorEngagedMult) and shown
   on the desk. */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var MENTOR_WEEKS = 26;          /* fixed programme length */
var MENTOR_MAX_ACTIVE = 3;      /* concurrent mentorships */
var MENTOR_MENTOR_POWER = 3;    /* a mentor must be at least this established */
var MENTOR_MENTOR_SKILL = 68;   /* ...and this skilled */
var MENTOR_MENTEE_POWER = 3;    /* a mentee must still be unproven */
var MENTOR_MENTEE_AGE = 32;     /* ...and young */
var MENTOR_SKILL_CAP = 97;      /* hard cap on any talent's skill */
var MENTOR_GRAD_FEE = 0.92;     /* fee multiplier for a graduate */
var MENTOR_GRAD_FEE_2 = 0.88;   /* ...for someone you graduated twice */
var MENTOR_DIP = 0.90;          /* a mentor's own output while engaged */

function mentorRound(x) { return Math.round(x * 10) / 10; }

/* ── state (lazy ensure — old saves have no S.mentor) ─────────── */
function mentorEnsure() {
  if (!S.mentor) {
    S.mentor = {
      lastTick: 0, active: [], graduates: [], gradIndex: {}, gradIndexBuilt: false,
      sessions: 0, stopped: 0, spent: 0, skillGained: 0, heatGained: 0
    };
  }
  var m = S.mentor, i;
  if (!m.active) m.active = [];
  if (!m.graduates) m.graduates = [];
  if (!m.gradIndex) m.gradIndex = {};
  if (!isFinite(m.lastTick)) m.lastTick = 0;
  if (!isFinite(m.sessions)) m.sessions = 0;
  if (!isFinite(m.stopped)) m.stopped = 0;
  if (!isFinite(m.spent)) m.spent = 0;
  if (!isFinite(m.skillGained)) m.skillGained = 0;
  if (!isFinite(m.heatGained)) m.heatGained = 0;
  /* self-heal the graduate index once per save (the graduates log is capped, the index
     is not, so a graduate keeps their craft bonus for the rest of the game) */
  if (!m.gradIndexBuilt) {
    for (i = 0; i < m.graduates.length; i++) {
      if (m.graduates[i] && m.graduates[i].talentId) {
        m.gradIndex[m.graduates[i].talentId] = (m.gradIndex[m.graduates[i].talentId] || 0) + 1;
      }
    }
    m.gradIndexBuilt = true;
  }
}

/* Talent lookup that also survives the people module moving someone into retirement. */
function mentorFindTalent(id) {
  if (!id) return null;
  var t = findTalent(id), i;
  if (t) return t;
  if (S.ppl && S.ppl.retired) {
    for (i = 0; i < S.ppl.retired.length; i++) if (S.ppl.retired[i].id === id) return S.ppl.retired[i];
  }
  return null;
}

function mentorNameOf(id) { var t = mentorFindTalent(id); return t ? t.n : "departed talent"; }

/* ── eligibility ──────────────────────────────────────────────── */
function mentorCanMentor(t) {
  return !!t && isFinite(t.power) && isFinite(t.skill) &&
    t.power >= MENTOR_MENTOR_POWER && t.skill >= MENTOR_MENTOR_SKILL;
}
function mentorCanLearn(t) {
  return !!t && isFinite(t.power) && isFinite(t.age) &&
    t.power <= MENTOR_MENTEE_POWER && t.age <= MENTOR_MENTEE_AGE;
}
function mentorActiveFor(mentorId) {
  mentorEnsure();
  var i;
  for (i = 0; i < S.mentor.active.length; i++) if (S.mentor.active[i].mentorId === mentorId) return S.mentor.active[i];
  return null;
}
function mentorMenteeBusy(menteeId) {
  mentorEnsure();
  var i;
  for (i = 0; i < S.mentor.active.length; i++) if (S.mentor.active[i].menteeId === menteeId) return S.mentor.active[i];
  return null;
}
/* The mentor's own availability dip — read by the desk (and by any caller that wants it). */
function mentorEngaged(id) { return !!mentorActiveFor(id); }
function mentorEngagedMult(t) {
  if (!S || !S.mentor) return 1;
  var id = (t && typeof t === "object") ? t.id : t;
  if (!id) return 1;
  return mentorActiveFor(id) ? MENTOR_DIP : 1;
}

/* ── programme maths ──────────────────────────────────────────── */
function mentorFee(mt) {
  if (!mt) return 0;
  var base = 3 + mt.power * 1.6 + mt.skill * 0.05;
  return mentorRound(clamp(base, 6, 30));
}
/* Projected permanent gain: the wider the skill gap, the more there is to teach. */
function mentorGain(mt, t) {
  if (!mt || !t) return 0;
  var raw = (mt.skill - t.skill) * 0.35 + mt.power * 1.2 + 3;
  return clamp(Math.round(raw), 3, 18);
}
function mentorHeadroom(t) { return Math.max(0, MENTOR_SKILL_CAP - Math.round(t.skill)); }

/* ── engine hooks ─────────────────────────────────────────────── */
/* Craft add at computeQuality: +2.5 per graduated mentee on the film (lead or director). */
function mentorCraftMod(dirId, actId) {
  if (!S || !S.mentor || !S.mentor.gradIndex) return 0;
  var add = 0;
  if (dirId && S.mentor.gradIndex[dirId]) add += 2.5;
  if (actId && S.mentor.gradIndex[actId]) add += 2.5;
  return Math.min(add, 5);
}
/* Fee multiplier: a talent you brought up takes less. 1 for everyone else. */
function mentorFeeMult(t) {
  if (!S || !S.mentor || !S.mentor.gradIndex) return 1;
  var id = (t && typeof t === "object") ? t.id : t;
  if (!id) return 1;
  var n = S.mentor.gradIndex[id];
  if (!n) return 1;
  return n >= 2 ? MENTOR_GRAD_FEE_2 : MENTOR_GRAD_FEE;
}
/* In-progress bonus for a current mentee (0 for anyone not in a programme). */
function mentorSkillBonus(t) {
  if (!S || !S.mentor || !S.mentor.active) return 0;
  var id = (t && typeof t === "object") ? t.id : t;
  if (!id) return 0;
  var i, m;
  for (i = 0; i < S.mentor.active.length; i++) {
    m = S.mentor.active[i];
    if (m.menteeId !== id) continue;
    return mentorRound(m.gain * (m.weeksDone / m.weeks) * 0.7);
  }
  return 0;
}

/* ── lists used by the desks ──────────────────────────────────── */
function mentorPool() {
  mentorEnsure();
  var out = [], i, t;
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (!mentorCanLearn(t)) continue;
    if (mentorMenteeBusy(t.id)) continue;
    out.push(t);
  }
  out.sort(function (a, b) { return (b.power - a.power) || (b.skill - a.skill); });
  return out;
}
function mentorRoster() {
  mentorEnsure();
  var out = [], i, t;
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (!mentorCanMentor(t)) continue;
    if (mentorActiveFor(t.id)) continue;
    out.push(t);
  }
  out.sort(function (a, b) { return b.skill - a.skill; });
  return out;
}
function mentorCandidatesFor(t) {
  var roster = mentorRoster(), out = [], i;
  for (i = 0; i < roster.length && out.length < 3; i++) {
    if (roster[i].id === t.id) continue;
    out.push(roster[i]);
  }
  return out;
}

/* ── mechanics ────────────────────────────────────────────────── */
function mentorStart(mentorId, menteeId) {
  mentorEnsure();
  if (!mentorId || !menteeId) return { err: "Pick a mentor and a mentee." };
  if (mentorId === menteeId) return { err: "A mentor cannot mentor themselves." };
  var mt = mentorFindTalent(mentorId), t = mentorFindTalent(menteeId);
  if (!mt) return { err: "That mentor is no longer on the talent market." };
  if (!t) return { err: "That mentee is no longer on the talent market." };
  if (!mentorCanMentor(mt)) return { err: mt.n + " is not established enough to mentor (power 3+, skill 68+)." };
  if (!mentorCanLearn(t)) return { err: t.n + " is too established to be a mentee (power 3 max, age 32 max)." };
  if (mentorActiveFor(mt.id)) return { err: mt.n + " is already running a mentorship." };
  if (mentorMenteeBusy(t.id)) return { err: t.n + " is already in a mentorship." };
  if (S.mentor.active.length >= MENTOR_MAX_ACTIVE) return { err: "Three mentorships is the programme's limit — end one first." };
  var head = mentorHeadroom(t);
  if (head <= 0) return { err: t.n + " is already at the top of their craft." };
  var fee = mentorFee(mt);
  if (S.studio.cash < fee) return { err: "Need " + fm(fee) + " for the mentorship programme." };
  spend(fee, "Mentorship · " + mt.n + " → " + t.n);
  var gain = Math.min(mentorGain(mt, t), head);
  var rec = {
    id: "me" + (S.seq++),
    mentorId: mt.id, menteeId: t.id,
    mentorName: mt.n, menteeName: t.n,
    startWeek: S.studio.week, weeks: MENTOR_WEEKS, weeksDone: 0,
    fee: fee, gain: gain,
    startSkill: Math.round(t.skill), projSkill: Math.round(t.skill) + gain
  };
  S.mentor.active.push(rec);
  S.mentor.spent = mentorRound(S.mentor.spent + fee);
  log("🎓 " + mt.n + " takes " + t.n + " under their wing — " + MENTOR_WEEKS + " weeks for " + fm(fee) + ".", "gold", "🎓");
  toast("🎓 " + t.n + " starts a mentorship with " + mt.n + ".", "good");
  return { ok: true, id: rec.id, fee: fee, gain: gain };
}

function mentorStop(recId) {
  mentorEnsure();
  var i, m = null;
  for (i = 0; i < S.mentor.active.length; i++) if (S.mentor.active[i].id === recId) m = S.mentor.active[i];
  if (!m) return { err: "That mentorship is not running." };
  S.mentor.active.splice(S.mentor.active.indexOf(m), 1);
  S.mentor.stopped++;
  log("🎓 The " + m.mentorName + " / " + m.menteeName + " mentorship ends early — the fee is not refunded.", "", "🎓");
  toast("Mentorship ended. " + m.menteeName + " keeps none of the unfinished work.", "");
  return { ok: true };
}

function mentorGraduate(m, t) {
  var before = Math.round(t.skill);
  t.skill = clamp(Math.round(t.skill + m.gain), 30, MENTOR_SKILL_CAP);
  var gained = t.skill - before;
  t.heat = Math.min((t.heat || 0) + 1, 3);
  var g = {
    id: "mg" + (S.seq++),
    talentId: t.id, name: t.n, k: t.k || "actor",
    mentorId: m.mentorId, mentorName: m.mentorName,
    week: S.studio.week, gain: gained, skill: t.skill, heat: t.heat
  };
  S.mentor.graduates.unshift(g);
  if (S.mentor.graduates.length > 60) S.mentor.graduates.length = 60;
  S.mentor.gradIndex[t.id] = (S.mentor.gradIndex[t.id] || 0) + 1;
  S.mentor.sessions++;
  S.mentor.skillGained = Math.round(S.mentor.skillGained + gained);
  S.mentor.heatGained++;
  log("🎓 " + t.n + " graduates from " + m.mentorName + "'s mentorship — skill " + before + " → " + t.skill + ", heat +1.", "gold", "🎓");
  toast("🎓 " + t.n + " graduates with skill " + t.skill + ".", "gold");
  return g;
}

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
function tickMentor() {
  if (!S || S.over) return;
  mentorEnsure();
  if (S.mentor.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.mentor.lastTick = S.studio.week;
  var i, m, t;
  for (i = S.mentor.active.length - 1; i >= 0; i--) {
    m = S.mentor.active[i];
    t = mentorFindTalent(m.menteeId);
    if (!t) {
      /* the mentee left the business — the programme lapses, the fee is gone */
      S.mentor.active.splice(i, 1);
      S.mentor.stopped++;
      log("🎓 The " + m.mentorName + " mentorship lapses — " + m.menteeName + " is no longer on the market.", "", "🎓");
      continue;
    }
    m.weeksDone++;
    if (m.weeksDone >= m.weeks) {
      mentorGraduate(m, t);
      S.mentor.active.splice(i, 1);
    }
  }
}

/* ── commit + action delegation (ui calls mentorAction) ───────── */
function mentorCommit() {
  if (typeof saveGame === "function") saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function mentorAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("mentor-") !== 0) return false;
  mentorEnsure();
  var id = (elx && elx.getAttribute) ? elx.getAttribute("data-id") : null;
  var key = (elx && elx.getAttribute) ? elx.getAttribute("data-key") : null;
  var r;
  switch (a) {
    case "mentor-start": r = mentorStart(id, key); break;
    case "mentor-stop": r = mentorStop(id); break;
    default: return false;
  }
  if (r && r.err) {
    if (typeof toast === "function") toast(r.err, "bad");
    return true;
  }
  mentorCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function mentorProgramDesk() {
  mentorEnsure();
  var html = "", i, m, left, pct, g;
  html += '<div class="card">'
    + statrow("Programmes running", S.mentor.active.length + " / " + MENTOR_MAX_ACTIVE)
    + statrow("Graduates", String(S.mentor.graduates.length))
    + statrow("Skill banked", "+" + Math.round(S.mentor.skillGained) + " points", S.mentor.skillGained > 0 ? "up" : "")
    + statrow("Programme fees paid", fm(S.mentor.spent))
    + "</div>";
  html += '<div class="sechead"><h2>Active mentorships</h2></div>';
  if (!S.mentor.active.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎓</span>No mentorship running. Open the talent pool and pair a veteran with a young hopeful.</div></div>';
  }
  for (i = 0; i < S.mentor.active.length; i++) {
    m = S.mentor.active[i];
    left = Math.max(0, m.weeks - m.weeksDone);
    pct = clamp(Math.round((m.weeksDone / m.weeks) * 100), 2, 100);
    html += '<div class="card film"><div class="head"><div class="title">' + esc(m.menteeName) + " ← " + esc(m.mentorName) + "</div>"
      + tag(left + " wk left", left <= 4 ? "gold" : "blue") + "</div>";
    html += '<div class="meta">' + tag("skill " + m.startSkill + " → " + m.projSkill, "green")
      + tag("fee " + fm(m.fee), "") + "</div>";
    html += '<div class="bar"><i style="width:' + pct + '%"></i></div>';
    html += '<div class="statrow"><span class="k">Session ' + Math.min(m.weeksDone + 1, m.weeks) + " of " + m.weeks
      + " · mentor engaged (output ×0.90)</span>"
      + '<button class="btn sm" data-action="mentor-stop" data-id="' + esc(m.id) + '">End early</button></div>';
    html += "</div>";
  }
  html += '<div class="sechead"><h2>Graduates</h2></div>';
  if (!S.mentor.graduates.length) {
    html += '<div class="card"><div class="empty"><span class="em">🏅</span>No graduate yet. A finished mentorship adds +2.5 craft whenever that talent leads or directs your films.</div></div>';
  } else {
    html += '<div class="card">';
    for (i = 0; i < S.mentor.graduates.length && i < 6; i++) {
      g = S.mentor.graduates[i];
      html += '<div class="statrow"><span class="k">' + esc(g.name) + " · taught by " + esc(g.mentorName)
        + " · week " + g.week + '</span><span class="v num up">skill ' + g.skill + " · +" + g.gain + " · heat " + g.heat + "</span></div>";
    }
    html += "</div>";
  }
  return html;
}

function mentorPoolDesk() {
  mentorEnsure();
  var pool = mentorPool(), roster = mentorRoster();
  var html = "", i, j, t, cands, mt, fee, gain, can, head;
  html += '<div class="card">'
    + statrow("Young talent on the market", String(pool.length))
    + statrow("Mentors free to take a mentee", String(roster.length))
    + statrow("Mentee bar", "power ≤ " + MENTOR_MENTEE_POWER + " · age ≤ " + MENTOR_MENTEE_AGE)
    + statrow("Mentor bar", "power ≥ " + MENTOR_MENTOR_POWER + " · skill ≥ " + MENTOR_MENTOR_SKILL)
    + "</div>";
  html += '<div class="sechead"><h2>Young talent</h2></div>';
  if (!pool.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎓</span>Nobody on the market fits the programme right now (power ≤ 3, age ≤ 32). New talent arrives most weeks.</div></div>';
  }
  if (S.mentor.active.length >= MENTOR_MAX_ACTIVE) {
    html += '<div class="card"><div class="statrow"><span class="k">Programme full — end a mentorship to start another</span><span class="v">'
      + S.mentor.active.length + " / " + MENTOR_MAX_ACTIVE + "</span></div></div>";
  }
  for (i = 0; i < pool.length && i < 6; i++) {
    t = pool[i];
    head = mentorHeadroom(t);
    html += '<div class="card film"><div class="head"><div class="title">' + esc(t.n) + "</div>"
      + tag(t.k === "dir" ? "Director" : "Actor", "blue") + "</div>";
    html += '<div class="meta">' + tag("power " + t.power) + tag("age " + t.age)
      + tag("skill " + Math.round(t.skill), "green") + (head <= 0 ? tag("at the cap", "red") : "") + "</div>";
    cands = mentorCandidatesFor(t);
    if (!cands.length) {
      html += '<div class="statrow"><span class="k">No free mentor on the market</span><span class="v">—</span></div>';
    }
    for (j = 0; j < cands.length; j++) {
      mt = cands[j];
      fee = mentorFee(mt);
      gain = Math.min(mentorGain(mt, t), head);
      can = S.studio.cash >= fee && head > 0 && S.mentor.active.length < MENTOR_MAX_ACTIVE;
      html += '<div class="statrow"><span class="k">' + esc(mt.n) + " · skill " + Math.round(mt.skill)
        + " · +" + gain + " skill · " + fm(fee) + "</span>"
        + '<button class="btn sm" data-action="mentor-start" data-id="' + esc(mt.id) + '" data-key="' + esc(t.id) + '" '
        + (can ? "" : "disabled") + ">Start · after " + fm(S.studio.cash - fee) + "</button></div>";
    }
    html += "</div>";
  }
  return html;
}

var MENTOR_DESKS = [
  { id: "mentor-program", group: "Talent", icon: "🎓", name: "Mentorship programme",
    desc: "Active mentorships with weeks left, projected skill gain and fee paid — graduates keep a permanent skill bump and +2.5 craft on your films.",
    render: mentorProgramDesk },
  { id: "mentor-pool", group: "Talent", icon: "🌱", name: "Mentoring pool",
    desc: "Young talent (power ≤ 3, age ≤ 32) you can pair with a veteran mentor (power ≥ 3, skill ≥ 68) for a 26-week programme.",
    render: mentorPoolDesk }
];

/* ── achievements ─────────────────────────────────────────────── */
var MENTOR_ACHIEVEMENTS = [
  { id: "mentor-first", tier: 1, name: "Passing it on", desc: "Graduate your first mentee.",
    test: function (S) { return !!S && !!S.mentor && !!S.mentor.graduates && S.mentor.graduates.length >= 1; } },
  { id: "mentor-trio", tier: 2, name: "Academy of one", desc: "Graduate three mentees.",
    test: function (S) { return !!S && !!S.mentor && !!S.mentor.graduates && S.mentor.graduates.length >= 3; } },
  { id: "mentor-craft20", tier: 2, name: "Craft multiplier", desc: "Bank 20 points of skill across your graduates.",
    test: function (S) { return !!S && !!S.mentor && isFinite(S.mentor.skillGained) && S.mentor.skillGained >= 20; } },
  { id: "mentor-star90", tier: 3, name: "Star maker", desc: "Graduate a mentee to skill 90 or better.",
    test: function (S) {
      if (!S || !S.mentor || !S.mentor.graduates) return false;
      var i;
      for (i = 0; i < S.mentor.graduates.length; i++) {
        if (S.mentor.graduates[i] && S.mentor.graduates[i].skill >= 90) return true;
      }
      return false;
    } },
  { id: "mentor-six", tier: 3, name: "The long apprenticeship", desc: "Complete six mentorships.",
    test: function (S) { return !!S && !!S.mentor && isFinite(S.mentor.sessions) && S.mentor.sessions >= 6; } }
];

/* This module moves no weekly cash — uniform with people.js/library.js. */
function forecastAdjust_mentor() { return 0; }
