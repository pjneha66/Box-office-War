/* Box Office War — rebuilt. People module (wave 4) — all state under S.ppl.
   Systems: social followings (followersK seeded per talent, star drift, release bumps)
   · casting chemistry (per dir|act pair score → chemCraftMod/chemOpenMult hooks, legendary duos)
   · talent lifecycles (yearly aging, retirement, comebacks, legend status)
   · youth academy (enroll → train → graduate prospects into the market).
   Wiring: engine's advanceWeek calls tickPeople (typeof-guarded); ui's onAction bridges
   peopleAction. No self-wrapping (wave-4 rules). Notes:
   - Films are scanned for aftermath only once they reach status "done" (profit verdict is
     set at endTheatrical), tracked via S.ppl.seenFilmIds.
   - socialBuzzMult is defined in social_viral.js (v47: it owns both creator endorsements
     and the lead's followers). This module seeds followersK and bumps it on releases.
   - forecastAdjust() → 0: this module moves no weekly cash, uniform with library.js/finance.js. */
"use strict";

/* ── state (lazy ensure — old saves have no S.ppl) ───────────── */
function pplEnsure() {
  if (!S.ppl) S.ppl = { lastTick: 0, chem: {}, retired: [], seenFilmIds: [], academy: [] };
  if (!S.ppl.chem) S.ppl.chem = {};
  if (!S.ppl.retired) S.ppl.retired = [];
  if (!S.ppl.seenFilmIds) S.ppl.seenFilmIds = [];
  if (!S.ppl.academy) S.ppl.academy = [];
}

/* ── social followings ───────────────────────────────────────── */
function seedFollowings() {
  var i, t;
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (!t.followersK) t.followersK = ri(5, 50) * t.power; /* stored in thousands */
  }
}

function pplStarDrift() {
  var i, t;
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (t.power >= 4 && t.followersK) {
      t.followersK = Math.round(clamp(t.followersK * (1 + (chance(0.5) ? rf(0, 0.10) : -rf(0, 0.10))), 1, 5000) * 10) / 10;
    }
  }
}

/* socialBuzzMult(p) lived here and was overwritten by social_viral.js (loaded later),
   so its followers-based lift was dead code. The surviving definition in
   social_viral.js now folds in both creator endorsements and the lead's following. */

/* ── casting chemistry ───────────────────────────────────────── */
function pplChemUpdate(f) {
  if (!f.dirId || !f.actId) return;
  var key = f.dirId + "|" + f.actId;
  var e = S.ppl.chem[key];
  if (!e) e = S.ppl.chem[key] = { d: f.dirId, a: f.actId, score: 50, duo: false }; /* first pairing starts neutral */
  if (f.profit > 0) e.score += 12;
  else if (f.profit < -f.cost * 0.35) e.score -= 8; /* engine's flop bar */
  e.score = clamp(Math.round(e.score), 0, 100);
  if (e.score >= 80 && !e.duo) {
    e.duo = true;
    var d = pplFindTalent(e.d), a = pplFindTalent(e.a);
    log((d ? d.n : "A director") + " and " + (a ? a.n : "an actor") + " are now a legendary duo — audiences trust the pairing.", "gold", "💞");
  }
}

/* chemCraftMod(dirId, actId) → (score−50)·0.06 (±3 craft), +2 for a legendary duo (≥80) */
function chemCraftMod(dirId, actId) {
  if (!S || !S.ppl || !dirId || !actId) return 0;
  var e = S.ppl.chem[dirId + "|" + actId];
  if (!e) return 0;
  return (e.score - 50) * 0.06 + (e.score >= 80 ? 2 : 0);
}

/* chemOpenMult(p) → 1 + (score−50)·0.002 (0.9–1.1); 0 (→ neutral) for unpaired casts */
function chemOpenMult(p) {
  if (!S || !S.ppl || !p || !p.dirId || !p.actId) return 0;
  var e = S.ppl.chem[p.dirId + "|" + p.actId];
  if (!e) return 0;
  return 1 + (e.score - 50) * 0.002;
}

/* ── film aftermath: release bumps + chemistry, one pass per film ─ */
function pplProcessFilms() {
  var seen = S.ppl.seenFilmIds, i, f;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (seen.indexOf(f.id) >= 0) continue;
    if (f.status !== "done" || f.profit === undefined) continue; /* wait for the verdict */
    seen.push(f.id);
    pplFilmAftermath(f);
    pplChemUpdate(f);
  }
  if (seen.length > 400) seen.splice(0, seen.length - 400);
}

function pplFilmAftermath(f) {
  var flop = f.profit < -f.cost * 0.35;
  var act = findTalent(f.actId), dir = findTalent(f.dirId);
  if (act && act.followersK) {
    act.followersK = Math.round(clamp(act.followersK * (flop ? 0.8 : f.profit > 0 ? 1.25 : 1), 1, 5000) * 10) / 10;
  }
  if (dir && dir.followersK) {
    dir.followersK = Math.round(clamp(dir.followersK * (flop ? 0.85 : f.profit > 0 ? 1.15 : 1), 1, 5000) * 10) / 10;
  }
}

/* ── lifecycles ──────────────────────────────────────────────── */
function pplFindTalent(id) {
  var i;
  for (i = 0; i < S.market.length; i++) if (S.market[i].id === id) return S.market[i];
  for (i = 0; i < S.ppl.retired.length; i++) if (S.ppl.retired[i].id === id) return S.ppl.retired[i];
  return null;
}

function pplYearlyRolls() {
  var i, t;
  for (i = 0; i < S.market.length; i++) S.market[i].age++;
  for (i = 0; i < S.ppl.retired.length; i++) S.ppl.retired[i].age++;
  /* retirement: stars 58+ roll 8%/yr */
  for (i = S.market.length - 1; i >= 0; i--) {
    t = S.market[i];
    if (t.power >= 4 && t.age >= 58 && chance(0.08)) {
      S.market.splice(i, 1);
      t.bookedUntil = 0;
      S.ppl.retired.push(t);
      log(t.n + " announces retirement after " + t.age + " years in the business.", "gold", "👋");
    }
  }
  /* comeback: 5%/yr per retired legend, one notch of power surrendered */
  for (i = S.ppl.retired.length - 1; i >= 0; i--) {
    t = S.ppl.retired[i];
    if (chance(0.05)) {
      S.ppl.retired.splice(i, 1);
      t.power = Math.max(1, t.power - 1);
      t.bookedUntil = 0;
      if (!t.followersK) t.followersK = ri(5, 50) * t.power;
      S.market.push(t);
      log(t.n + " comes out of retirement — back on the talent market.", "gold", "🎬");
    }
  }
  /* legend status: age 50+ roll 10%/yr — heat +1 (fee override lives with the engine, skipped) */
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (!t.legend && t.age >= 50 && chance(0.10)) {
      t.legend = true;
      t.heat = Math.min(t.heat + 1, 3);
      log(t.n + " is now regarded as a screen legend.", "", "🌟");
    }
  }
}

/* ── youth academy ───────────────────────────────────────────── */
function pplEnroll() {
  if (S.ppl.academy.length >= 3) { pushToast("The academy is full — 3 prospects max.", "bad"); return false; }
  if (S.studio.cash < 6) { pushToast("Need " + fm(6) + " to enroll a prospect.", "bad"); return false; }
  spend(6, "Youth academy enrollment");
  var p = { id: "pa" + (S.seq++), n: genName(), age: 16, power: 1, skill: ri(30, 45), trainings: 0, weeks: 0 };
  S.ppl.academy.push(p);
  log(p.n + " enrolls at the youth academy (age 16, skill " + p.skill + ").", "", "🎓");
  pushToast("🎓 " + p.n + " joins the academy.", "good");
  return true;
}

function pplTrain(id) {
  var i, p = null;
  for (i = 0; i < S.ppl.academy.length; i++) if (S.ppl.academy[i].id === id) p = S.ppl.academy[i];
  if (!p || p.trainings >= 3) return false;
  if (S.studio.cash < 4) { pushToast("Need " + fm(4) + " for a training block.", "bad"); return false; }
  spend(4, "Academy training · " + p.n);
  p.skill = Math.min(97, p.skill + 8);
  p.trainings++;
  pushToast("🎓 " + p.n + " completes training " + p.trainings + "/3 (skill " + p.skill + ").", "good");
  return true;
}

function pplGraduate(p) {
  var gain = Math.floor(p.trainings / 2); /* power +1 per 2 completed trainings */
  var power = 1 + gain;
  var t = {
    id: "t" + (S.seq++), k: "actor", n: p.n,
    power: power,
    skill: p.skill,
    fee: FEE_ACTOR[power - 1],
    ability: chance(0.3) ? pick(ABILITIES).id : null,
    fit: [pick(GENRES).id],
    age: p.age, heat: 0, bookedUntil: 0,
    followersK: ri(5, 50) * power
  };
  S.ppl.academy.splice(S.ppl.academy.indexOf(p), 1);
  S.market.push(t);
  log("🎓 Academy graduate " + t.n + " (power " + power + ", skill " + t.skill + ") joins the talent market.", "gold", "🎓");
}

function pplAcademyTick() {
  var i;
  for (i = S.ppl.academy.length - 1; i >= 0; i--) {
    var p = S.ppl.academy[i];
    p.weeks++;
    if (p.trainings >= 3 || p.weeks >= 52) pplGraduate(p);
  }
}

/* ── weekly tick (called by engine after its own systems) ────── */
function tickPeople() {
  if (!S || S.over) return;
  pplEnsure();
  if (S.ppl.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.ppl.lastTick = S.studio.week;
  seedFollowings();
  pplProcessFilms();
  pplStarDrift();
  pplAcademyTick();
  if (woyOf(S.studio.week) === 1) pplYearlyRolls();
}

/* ── action dispatch (ui.js falls through here) ──────────────── */
function peopleAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("ppl-") !== 0) return false;
  pplEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var ok = true, mut = false, desk = "";
  switch (a) {
    case "ppl-enroll": ok = pplEnroll(); desk = "academy"; mut = true; break;
    case "ppl-train": ok = pplTrain(id); desk = "academy"; mut = true; break;
    default: return false;
  }
  if (mut) saveGame();
  render();
  if (desk === "academy") rerenderSheet(pplAcademyDesk());
  return true;
}

/* ── desks ───────────────────────────────────────────────────── */
function pplChemDesk() {
  pplEnsure();
  var html = '<div data-ppldesk="chem">';
  var arr = [], k;
  for (k in S.ppl.chem) if (S.ppl.chem.hasOwnProperty(k)) arr.push(S.ppl.chem[k]);
  arr.sort(function (a, b) { return b.score - a.score; });
  arr = arr.slice(0, 8);
  if (!arr.length) return html + '<div class="card"><div class="empty"><span class="em">💞</span>No pairings yet — chemistry builds as your finished films land.</div></div>';
  html += '<div class="sechead"><h2>Top pairings</h2></div><div class="card">';
  arr.forEach(function (e) {
    var d = pplFindTalent(e.d), a = pplFindTalent(e.a);
    var duo = e.score >= 80;
    html += '<div class="statrow"><span class="k">' + esc(d ? d.n : "departed") + " × " + esc(a ? a.n : "departed") + "</span>"
      + '<span class="v">' + e.score + "/100 " + (duo ? tag("legendary duo", "gold") : tag(e.score >= 60 ? "warm" : e.score <= 35 ? "frosty" : "neutral")) + "</span></div>";
  });
  html += "</div>";
  html += '<div class="card"><div class="statrow"><span class="k">Chemistry effect</span><span class="v">craft ±3 · opening 0.9–1.1× · duos +2 craft</span></div></div>';
  return html;
}

function pplAcademyDesk() {
  pplEnsure();
  var html = '<div data-ppldesk="academy">';
  html += '<div class="card"><div class="statrow"><span class="k">Prospects</span><span class="v num">' + S.ppl.academy.length + " / 3</span></div>"
    + '<div class="statrow"><span class="k">Graduates after 3 trainings or 52 weeks</span><span class="v">power +1 per 2 trainings</span></div></div>';
  html += '<div class="sechead"><h2>Actions</h2></div><div class="card">';
  html += '<div class="statrow"><span class="k">Enroll a prospect · ' + fm(6) + " (age 16, skill 30–45)</span>"
    + '<button class="btn sm" data-action="ppl-enroll" ' + (S.studio.cash < 6 || S.ppl.academy.length >= 3 ? "disabled" : "") + ">Enroll</button></div>";
  html += "</div>";
  if (S.ppl.academy.length) {
    html += '<div class="sechead"><h2>In training</h2></div>';
    S.ppl.academy.forEach(function (p) {
      html += '<div class="card film"><div class="head"><div class="title">🎓 ' + esc(p.n) + "</div>"
        + tag(p.trainings >= 3 ? "graduates this week" : "training " + p.trainings + "/3") + "</div>"
        + '<div class="statrow"><span class="k">Age · skill</span><span class="v">' + p.age + " · " + p.skill + "</span></div>"
        + '<div class="statrow"><span class="k">Enrolled · projected power</span><span class="v">' + p.weeks + " wk / 52 · " + (1 + Math.floor(p.trainings / 2)) + "</span></div>"
        + '<div class="statrow"><span class="k">Training block · ' + fm(4) + " (+8 skill)</span>"
        + '<button class="btn sm" data-action="ppl-train" data-id="' + esc(p.id) + '" ' + (S.studio.cash < 4 || p.trainings >= 3 ? "disabled" : "") + ">Train</button></div></div>";
    });
  } else {
    html += '<div class="card"><div class="empty"><span class="em">🎓</span>No prospects enrolled — develop the next generation of stars.</div></div>';
  }
  return html;
}

var PEOPLE_DESKS = [
  { id: "ppl-chem", group: "Talent", icon: "💞", name: "Casting chemistry", desc: "Track how well your director–actor pairings land — hits warm a pairing up, flops cool it, and 80+ makes a legendary duo.", render: pplChemDesk },
  { id: "ppl-academy", group: "Talent", icon: "🎓", name: "Youth academy", desc: "Enroll teenage prospects and put them through training blocks — graduates join the talent market with a power boost.", render: pplAcademyDesk }
];

/* forecastAdjust: the people module moves no weekly cash — uniform with library.js/finance.js */
function forecastAdjust_people() { return 0; }
