/* Box Office War — rebuilt. PR, Awards & Audience module.
   Systems: FYC award campaigns (wk 40–52), fall festivals (wk 34–38),
   test screenings & reshoots, social viral campaigns, fan conventions (wk 22–24),
   crisis retainer. All state lives under S.pr (lazy prEnsure()).
   Engine hooks defined here (typeof-guarded on the engine side by the integrator):
   - awardPoints(filmId) → FYC points; engine yearAwards scores quality + points×3.
   - prRetainer() → true while the crisis retainer is active; engine auto-resolves scandals.
   NOTE for integrator: p.reshootBoost (set by prReshoot) must be added inside engine
   computeQuality() along with location craft — this module does not edit engine.js. */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var PR_FYC_TIERS = [
  { cost: 5,  pts: 1, name: "Trade ads" },
  { cost: 15, pts: 3, name: "Screening tour" },
  { cost: 40, pts: 8, name: "Full FYC blitz" }
];
var PR_VIRAL_TIERS = [
  { cost: 1,  buzz: 2 },
  { cost: 4,  buzz: 4 },
  { cost: 10, buzz: 7 },
  { cost: 25, buzz: 12 }
];
var PR_CONV_TIERS = [
  { cost: 3,  buzz: 3,  rep: 0, name: "fan table" },
  { cost: 8,  buzz: 6,  rep: 1, name: "panel hall" },
  { cost: 20, buzz: 10, rep: 2, name: "main stage" }
];
var PR_FEST_GENRES = ["drama", "crime", "romance", "docs", "musical"];
var PR_FEST_NAMES = ["Ventura", "The Lido", "Aspen Falls", "San Sebastian"];

/* ── state ────────────────────────────────────────────────────── */
function prEnsure() {
  if (!S.pr) S.pr = {};
  var P = S.pr;
  if (!P.fycFilms) P.fycFilms = [];      /* film ids eligible for FYC this year */
  if (!P.campaigns) P.campaigns = {};    /* filmId → points (1/3/8) */
  if (!P.fested) P.fested = {};          /* projectId → one festival submit, ever */
  if (!P.screened) P.screened = {};      /* projectId → test screening score */
  if (!P.reshot) P.reshot = {};          /* projectId → reshoots booked */
  if (!P.virals) P.virals = {};          /* projectId → social tiers bought (0–4) */
  if (!P.convYear) P.convYear = 0;       /* year of last convention booth */
  /* P.retainer: crisis PR toggle */
}

function prYearOfWeek(w) { return Math.floor((w - 1) / WEEKS_PER_YEAR) + 1; }
function prFycIdx(pts) {
  var i;
  for (i = 0; i < PR_FYC_TIERS.length; i++) if (PR_FYC_TIERS[i].pts === pts) return i;
  return -1;
}

/* ── weekly tick (engine calls tickPR() after its own systems) ── */
function tickPR() {
  if (!S || S.over) return;
  prEnsure();
  var P = S.pr, i, f, y = S.studio.year;
  /* track this year's award-eligible releases (quality 75+) */
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.quality >= 75 && prYearOfWeek(f.releaseWeek) === y && P.fycFilms.indexOf(f.id) < 0) P.fycFilms.push(f.id);
  }
  /* expire stale entries: films from earlier years (or gone from the ledger) */
  var keep = [];
  for (i = 0; i < P.fycFilms.length; i++) {
    f = findFilm(P.fycFilms[i]);
    if (f && prYearOfWeek(f.releaseWeek) === y) keep.push(f.id);
  }
  if (keep.length !== P.fycFilms.length) P.fycFilms = keep;
  var k, f2;
  for (k in P.campaigns) {
    if (!P.campaigns.hasOwnProperty(k)) continue;
    f2 = findFilm(k);
    if (!f2 || prYearOfWeek(f2.releaseWeek) < y) delete P.campaigns[k];
  }
  if (P.retainer) spend(2, "Crisis retainer");
}

/* ── engine hooks ─────────────────────────────────────────────── */
function awardPoints(filmId) {
  if (!S || !S.pr || !S.pr.campaigns) return 0;
  return S.pr.campaigns[filmId] || 0;
}
function prRetainer() { return !!(S && S.pr && S.pr.retainer); }

/* ── mechanic 1: FYC award campaigns (wk 40–52) ───────────────── */
function prFycBuy(filmId, tierIdx) {
  prEnsure();
  var P = S.pr, t = PR_FYC_TIERS[tierIdx], f = findFilm(filmId);
  if (woyOf(S.studio.week) < 40) return { err: "The FYC window opens in week 40." };
  if (!t) return { err: "Pick a campaign tier." };
  if (!f) return { err: "That film is not in the ledger." };
  if (P.fycFilms.indexOf(filmId) < 0) return { err: "“" + f.title + "” is not awards-eligible this year (needs quality 75+)." };
  var cur = prFycIdx(P.campaigns[filmId] || 0);
  if (tierIdx !== cur + 1) return { err: "Upgrade FYC tiers in order (" + fm(5) + " → " + fm(15) + " → " + fm(40) + ")." };
  if (S.studio.cash < t.cost) return { err: "Need " + fm(t.cost) + " free cash for " + t.name + "." };
  spend(t.cost, "FYC · " + f.title);
  P.campaigns[filmId] = t.pts;
  log("FYC campaign for “" + f.title + "”: " + t.name + " (" + fm(t.cost) + ") — awards points now " + t.pts + ".", "", "🏆");
  toast("FYC campaign running for “" + f.title + "”.", "good");
  return { ok: true, pts: t.pts };
}

/* ── mechanic 2: fall festivals (wk 34–38) ────────────────────── */
function prFestSubmit(pid) {
  prEnsure();
  var P = S.pr, p = findProject(pid), woy = woyOf(S.studio.week);
  if (woy < 34 || woy > 38) return { err: "Festival submissions run weeks 34–38." };
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "post" && p.phase !== "ready") return { err: "Only projects in post or ready can screen at a festival." };
  if (PR_FEST_GENRES.indexOf(p.genre) < 0) return { err: genreOf(p.genre).name + " is not a festival genre (drama, crime, romance, docs, musical)." };
  if (P.fested[pid]) return { err: "“" + p.title + "” already used its one festival submission." };
  if (S.studio.cash < 2) return { err: "Need " + fm(2) + " for the entry fee." };
  spend(2, "Festival entry · " + p.title);
  P.fested[pid] = true;
  var fest = pick(PR_FEST_NAMES);
  var q = p.qPreview || 60;
  if (chance(clamp((q - 40) / 100, 0.1, 0.8))) {
    S.studio.rep = clamp(S.studio.rep + 4, 0, 100);
    p.buzz += 3;
    log("“" + p.title + "” wins big at " + fest + " — reputation +4, buzz +3.", "gold", "🏆");
    toast("“" + p.title + "” takes the festival prize!", "gold");
    return { ok: true, won: true };
  }
  log("“" + p.title + "” screened at " + fest + " but came home without a prize.", "", "🏆");
  toast("Festival audiences were polite. No prize.", "");
  return { ok: true, won: false };
}

/* ── mechanic 3: test screenings & reshoots ───────────────────── */
function prTestScreen(pid) {
  prEnsure();
  var P = S.pr, p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "post") return { err: "Test screenings run during post-production." };
  if (P.screened[pid] != null) return { err: "One test screening per project." };
  if (S.studio.cash < 1) return { err: "Need " + fm(1) + " for the screening." };
  spend(1, "Test screening · " + p.title);
  var score = clamp(Math.round((p.qPreview || 60) + gauss() * 8), 5, 99);
  P.screened[pid] = score;
  log("Test screening for “" + p.title + "”: " + score + "/100 " + (score >= 55 ? "— the cut plays." : "— the room went quiet."), score >= 55 ? "good" : "bad", "🎥");
  toast("“" + p.title + "” scored " + score + "/100.", score >= 55 ? "good" : "");
  return { ok: true, score: score };
}

function prReshoot(pid) {
  prEnsure();
  var P = S.pr, p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "post") return { err: "Reshoots need the project still in post." };
  if (P.screened[pid] == null) return { err: "Screen the cut first." };
  if (P.screened[pid] >= 55) return { err: "Scored 55+ — no reshoots needed." };
  if (P.reshot[pid]) return { err: "One round of reshoots per project." };
  var cost = Math.round(p.budget * 0.08 * 10) / 10;
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for reshoots." };
  spend(cost, "Reshoots · " + p.title);
  p.phaseLen.post += 2;
  p.reshootBoost = ri(3, 6); /* integrator: engine computeQuality() adds this field */
  P.reshot[pid] = true;
  log("“" + p.title + "” books two weeks of reshoots (" + fm(cost) + ") — the edit gets a second pass.", "", "🎞️");
  toast("Reshoots booked for “" + p.title + "”.", "good");
  return { ok: true, boost: p.reshootBoost };
}

/* ── mechanic 4: social viral campaigns ───────────────────────── */
function prViralBuy(pid, tierIdx) {
  prEnsure();
  var P = S.pr, p = findProject(pid), t = PR_VIRAL_TIERS[tierIdx];
  if (!p) return { err: "That project is gone." };
  if (!t) return { err: "Pick a social campaign tier." };
  if (p.phase !== "shoot" && p.phase !== "post" && p.phase !== "ready") return { err: "Social campaigns run from shoot through ready." };
  var bought = P.virals[pid] || 0;
  if (tierIdx !== bought) return { err: "Buy social tiers in order (" + fm(1) + " → " + fm(4) + " → " + fm(10) + " → " + fm(25) + ")." };
  if (S.studio.cash < t.cost) return { err: "Need " + fm(t.cost) + " for the push." };
  spend(t.cost, "Social push · " + p.title);
  P.virals[pid] = bought + 1;
  var roll = Math.random(), gain;
  if (roll < 0.18) {
    gain = t.buzz * 2;
    log("📱 The " + fm(t.cost) + " push for “" + p.title + "” went VIRAL — buzz +" + gain + ".", "gold", "📱");
    toast("“" + p.title + "” is everywhere. Buzz +" + gain + ".", "gold");
  } else if (roll < 0.33) {
    gain = Math.floor(t.buzz * 0.5);
    log("📱 The push for “" + p.title + "” whiffed — buzz +" + gain + ".", "", "📱");
    toast("Weak engagement. Buzz +" + gain + ".", "");
  } else {
    gain = t.buzz;
    log("📱 Social push landed for “" + p.title + "” — buzz +" + gain + ".", "good", "📱");
    toast("Solid engagement. Buzz +" + gain + ".", "good");
  }
  p.buzz += gain;
  return { ok: true, gain: gain };
}

/* ── mechanic 5: fan conventions (wk 22–24) ───────────────────── */
function prConvBuy(pid, tierIdx) {
  prEnsure();
  var P = S.pr, p = findProject(pid), t = PR_CONV_TIERS[tierIdx], woy = woyOf(S.studio.week);
  if (woy < 22 || woy > 24) return { err: "Fan conventions run weeks 22–24." };
  if (P.convYear === S.studio.year) return { err: "One convention per year — the booth is booked." };
  if (!p) return { err: "That project is gone." };
  if (!t) return { err: "Pick a booth tier." };
  if (p.releaseWeek == null) return { err: "Set a release date first — conventions sell a date." };
  if (S.studio.cash < t.cost) return { err: "Need " + fm(t.cost) + " for the booth." };
  spend(t.cost, "Convention · " + p.title);
  p.buzz += t.buzz;
  if (t.rep) S.studio.rep = clamp(S.studio.rep + t.rep, 0, 100);
  P.convYear = S.studio.year;
  log("“" + p.title + "” headlines the fan convention (" + t.name + ") — buzz +" + t.buzz + (t.rep ? ", rep +" + t.rep : "") + ".", "good", "🎪");
  toast("Convention crowd loved “" + p.title + "”.", "good");
  return { ok: true };
}

/* ── mechanic 6: crisis retainer toggle ───────────────────────── */
function prToggleRetainer() {
  prEnsure();
  S.pr.retainer = !S.pr.retainer;
  log(S.pr.retainer ? "Crisis retainer active — " + fm(2) + " a week keeps the tabloids tame." : "Crisis retainer cancelled.", S.pr.retainer ? "good" : "", "🧯");
  toast(S.pr.retainer ? "Crisis PR on retainer." : "Retainer dropped.", S.pr.retainer ? "good" : "");
  return { ok: true, on: S.pr.retainer };
}

/* ── commit + action delegation (ui calls prAction first) ─────── */
function prCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function prHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  prCommit();
}
function prAction(a, elx) {
  var id = null, key = 0;
  if (elx && elx.getAttribute) {
    id = elx.getAttribute("data-id");
    key = +(elx.getAttribute("data-key") || 0);
  }
  if (a === "pr-fyc") prHandle(prFycBuy(id, key));
  else if (a === "pr-fest") prHandle(prFestSubmit(id));
  else if (a === "pr-test") prHandle(prTestScreen(id));
  else if (a === "pr-reshoot") prHandle(prReshoot(id));
  else if (a === "pr-viral") prHandle(prViralBuy(id, key));
  else if (a === "pr-conv") prHandle(prConvBuy(id, key));
  else if (a === "pr-retainer") prHandle(prToggleRetainer());
  else return false;
  return true;
}

/* ── desks (render returns sheet body HTML only) ──────────────── */
function prDeskAwards() {
  prEnsure();
  var P = S.pr, st = S.studio, woy = woyOf(st.week), open = woy >= 40;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("FYC window", open ? tag("Open · weeks 40–52", "green") : "opens week 40 · now W" + woy)
    + statrow("Eligible this year", String(P.fycFilms.length))
    + statrow("Scoring", "quality + FYC points ×3")
    + "</div>";
  if (!P.fycFilms.length) return html + '<div class="empty"><span class="em">🏆</span>No awards-eligible releases this year. A film needs quality 75+.</div>';
  var i, f;
  for (i = 0; i < P.fycFilms.length; i++) {
    f = findFilm(P.fycFilms[i]);
    if (!f) continue;
    var pts = P.campaigns[f.id] || 0;
    var cur = prFycIdx(pts);
    var next = cur + 1 < PR_FYC_TIERS.length ? PR_FYC_TIERS[cur + 1] : null;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(f.genre).em + " " + esc(f.title) + "</div>"
      + tag("✦ " + f.quality, f.quality >= 85 ? "gold" : "green") + "</div>"
      + '<div class="meta">' + tag(pts ? "FYC " + pts + " pt" + (pts === 1 ? "" : "s") : "No campaign yet", pts ? "gold" : "")
      + (cur >= 0 ? tag(PR_FYC_TIERS[cur].name, "blue") : "");
    if (next) html += tag("Cash after " + fm(st.cash - next.cost));
    html += "</div>"
      + '<div class="foot">';
    if (next) {
      html += '<button class="btn primary sm" data-action="pr-fyc" data-id="' + f.id + '" data-key="' + (cur + 1) + '"'
        + (!open || st.cash < next.cost ? " disabled" : "") + ">"
        + (cur < 0 ? "Launch campaign" : "Upgrade") + " · " + fm(next.cost) + "</button>";
      if (!open) html += '<span class="tag">window opens wk 40</span>';
    } else html += tag("Full blitz — maxed out", "gold");
    html += "</div></div>";
  }
  return html;
}

function prDeskFest() {
  prEnsure();
  var st = S.studio, woy = woyOf(st.week), open = woy >= 34 && woy <= 38;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Festival window", open ? tag("Open · weeks 34–38", "green") : "weeks 34–38 · now W" + woy)
    + statrow("Entry fee", fm(2) + " · one submit per project, ever")
    + "</div>";
  var list = [], i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if ((p.phase === "post" || p.phase === "ready") && PR_FEST_GENRES.indexOf(p.genre) >= 0) list.push(p);
  }
  if (!list.length) return html + '<div class="empty"><span class="em">🎞️</span>No prestige projects (drama, crime, romance, docs, musical) in post or ready.</div>';
  for (i = 0; i < list.length; i++) {
    p = list[i];
    var done = !!S.pr.fested[p.id];
    var q = p.qPreview || 60;
    var odds = Math.round(clamp((q - 40) / 100, 0.1, 0.8) * 100);
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>"
      + tag(p.phase === "ready" ? "Ready" : "Post") + "</div>"
      + '<div class="meta">' + tag("Screen est " + q, "blue") + tag("Win odds ~" + odds + "%")
      + (done ? tag("Submitted", "gold") : tag("Cash after " + fm(st.cash - 2))) + "</div>"
      + '<div class="foot">';
    if (done) html += '<span class="tag">Festival pass used</span>';
    else html += '<button class="btn primary sm" data-action="pr-fest" data-id="' + p.id + '"'
      + (!open || st.cash < 2 ? " disabled" : "") + ">Submit · " + fm(2) + "</button>";
    html += "</div></div>";
  }
  return html;
}

function prDeskTest() {
  prEnsure();
  var P = S.pr, st = S.studio;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Screening fee", fm(1) + " · one per project")
    + statrow("Reshoots", "8% of budget · +2 post weeks · craft +3–6")
    + "</div>";
  var list = [], i;
  for (i = 0; i < S.projects.length; i++) if (S.projects[i].phase === "post") list.push(S.projects[i]);
  if (!list.length) return html + '<div class="empty"><span class="em">🎥</span>Nothing in post-production. Screenings test a cut while it can still change.</div>';
  for (i = 0; i < list.length; i++) {
    var p = list[i];
    var scr = P.screened[p.id];
    var rCost = Math.round(p.budget * 0.08 * 10) / 10;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>" + tag("Post") + "</div>";
    if (scr == null) {
      html += '<div class="meta">' + tag("Not screened yet") + tag("Cash after " + fm(st.cash - 1)) + "</div>"
        + '<div class="foot"><button class="btn primary sm" data-action="pr-test" data-id="' + p.id + '"'
        + (st.cash < 1 ? " disabled" : "") + ">Screen the cut · " + fm(1) + "</button></div>";
    } else {
      html += '<div class="meta">' + tag("Test score " + scr + "/100", scr >= 55 ? "green" : "red");
      if (P.reshot[p.id]) html += tag("Reshoot craft +" + (p.reshootBoost || 0), "blue");
      html += "</div>" + '<div class="foot">';
      if (scr < 55 && !P.reshot[p.id]) {
        html += '<button class="btn primary sm" data-action="pr-reshoot" data-id="' + p.id + '"'
          + (st.cash < rCost ? " disabled" : "") + ">Book reshoots · " + fm(rCost) + "</button>"
          + '<span class="tag">cash after ' + fm(st.cash - rCost) + "</span>";
      } else if (scr < 55) html += '<span class="tag">Reshoots already booked</span>';
      else html += '<span class="tag green">Scores 55+ — ship it</span>';
      html += "</div>";
    }
    html += "</div>";
  }
  return html;
}

function prDeskSocial() {
  prEnsure();
  var P = S.pr, st = S.studio;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("How it rolls", "18% viral (×2) · 15% whiff (½) · each tier once")
    + "</div>";
  var list = [], i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.phase === "shoot" || p.phase === "post" || p.phase === "ready") list.push(p);
  }
  if (!list.length) return html + '<div class="empty"><span class="em">📱</span>No projects in shoot, post or ready to push.</div>';
  for (i = 0; i < list.length; i++) {
    p = list[i];
    var bought = P.virals[p.id] || 0;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>"
      + tag("Buzz +" + p.buzz, p.buzz ? "blue" : "") + "</div>"
      + '<div class="seg">';
    for (var t = 0; t < PR_VIRAL_TIERS.length; t++) {
      var vt = PR_VIRAL_TIERS[t];
      html += '<button class="' + (t < bought ? "on" : "") + '" data-action="pr-viral" data-id="' + p.id + '" data-key="' + t + '"'
        + (t !== bought || st.cash < vt.cost ? " disabled" : "") + ">" + fm(vt.cost) + " → +" + vt.buzz + "</button>";
    }
    html += "</div></div>";
  }
  return html;
}

function prDeskConv() {
  prEnsure();
  var P = S.pr, st = S.studio, woy = woyOf(st.week);
  var open = woy >= 22 && woy <= 24;
  var used = P.convYear === st.year;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Convention window", open ? tag("Open · weeks 22–24", "green") : "weeks 22–24 · now W" + woy)
    + statrow("This year", used ? tag("Booth booked", "gold") : "One booth per year")
    + "</div>";
  if (used) return html + '<div class="empty"><span class="em">🎪</span>The Year ' + st.year + " booth is booked. Back next year.</div>";
  var list = [], i;
  for (i = 0; i < S.projects.length; i++) {
    if (S.projects[i].phase === "ready" && S.projects[i].releaseWeek != null) list.push(S.projects[i]);
  }
  if (!list.length) return html + '<div class="empty"><span class="em">🎪</span>No scheduled release to promote. Conventions sell a date.</div>';
  for (i = 0; i < list.length; i++) {
    var p = list[i];
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>"
      + tag("Opens W" + woyOf(p.releaseWeek)) + "</div>"
      + '<div class="seg">';
    for (var t = 0; t < PR_CONV_TIERS.length; t++) {
      var ct = PR_CONV_TIERS[t];
      html += '<button data-action="pr-conv" data-id="' + p.id + '" data-key="' + t + '"'
        + (!open || st.cash < ct.cost ? " disabled" : "") + ">" + fm(ct.cost) + " → +" + ct.buzz + (ct.rep ? " ★" : "") + "</button>";
    }
    html += "</div></div>";
  }
  return html;
}

function prDeskCrisis() {
  prEnsure();
  var st = S.studio, on = !!S.pr.retainer;
  return '<div class="card">'
    + statrow("Retainer", on ? tag("Active", "green") : tag("Not active", "red"))
    + statrow("Weekly cost", fm(2))
    + statrow("Cash on hand", fm(st.cash))
    + "</div>"
    + '<div class="card"><div class="foot btnrow">'
    + '<button class="btn ' + (on ? "danger" : "primary") + ' sm" data-action="pr-retainer"'
    + (!on && st.cash < 2 ? " disabled" : "") + ">"
    + (on ? "Cancel retainer" : "Activate · " + fm(2) + "/wk") + "</button>"
    + '<span class="tag">scandals buried automatically</span>'
    + "</div></div>"
    + '<div class="empty"><span class="em">🧯</span>While active, PR buries scandal stories every week without a decision — overhead in exchange for calm.</div>';
}

var PR_DESKS = [
  { id: "pr-awards", group: "PR & Awards", icon: "🏆", name: "Awards & FYC",
    desc: "Fund For Your Consideration campaigns for quality-75+ releases, weeks 40–52.", render: prDeskAwards },
  { id: "pr-fest", group: "PR & Awards", icon: "🎞️", name: "Festival circuit",
    desc: "Submit one prestige project to the fall festival, weeks 34–38.", render: prDeskFest },
  { id: "pr-test", group: "Audience", icon: "🎥", name: "Test screenings",
    desc: "Screen a cut in post; book reshoots if it lands under 55.", render: prDeskTest },
  { id: "pr-social", group: "Audience", icon: "📱", name: "Social & viral",
    desc: "Segmented social pushes for projects from shoot to ready — sometimes they go viral.", render: prDeskSocial },
  { id: "pr-conv", group: "Audience", icon: "🎪", name: "Fan conventions",
    desc: "One convention booth per year behind a scheduled release, weeks 22–24.", render: prDeskConv },
  { id: "pr-crisis", group: "PR & Awards", icon: "🧯", name: "Crisis retainer",
    desc: "Keep a crisis PR firm on retainer — $2M a week, scandals handled for you.", render: prDeskCrisis }
];
