/* Box Office War — rebuilt. Festival circuit module (wave 6).
   One desk: a year calendar (12 months / 52 weeks mapped) of six festivals, each
   with taste genres and your lineup. "Plan premiere" costs $2M on one project in
   post or ready that matches the festival's taste → buzz +5, applied immediately
   (p.buzz += 5) and the festival stored as p.premiereFest — one premiere per
   project, ever.
   NOTE for integrator: p.premiereFest (festival name) is stored here; the
   release-side premiere hook (premiereApply, events2.js) is a separate mechanic —
   this module applies its buzz directly at planning time and does NOT touch
   engine releaseFilm. If the integrator later wants a release-night lift, read
   p.premiereFest there; nothing else needs wiring.
   Your submitted projects come from pr.js's fall-festival state (guarded read of
   S.pr.fested, weeks 34–38 only — pr.js owns it); when that state is absent the
   board simply shows the projects eligible in each festival's window instead.
   Wiring: ui.js bridges festivalAction() and collects FESTIVAL_DESKS (group
   "Awards"). The board is static and premiere effects land at action time, so
   tickFestivals() is a uniform no-op returning 0 (no engine wiring needed). */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var FEST_PREMIERE_COST = 2;
var FEST_BUZZ = 5;
/* Real-world flavored slots; taste genres are ids from data.js GENRES.
   Together they cover 9 of 12 genres, so most projects fit somewhere. */
var FESTIVALS = [
  { name: "Sundance", em: "🏔️", w: 6,  genres: ["drama", "docs", "romance"] },
  { name: "Cannes",   em: "🌴", w: 18, genres: ["drama", "crime", "romance"] },
  { name: "Venice",   em: "🚤", w: 33, genres: ["drama", "crime", "musical"] },
  { name: "TIFF",     em: "🍁", w: 36, genres: ["comedy", "drama", "docs"] },
  { name: "Fantasia", em: "👻", w: 40, genres: ["horror", "scifi", "action"] },
  { name: "AFI Fest", em: "🎞️", w: 44, genres: ["drama", "musical", "crime"] }
];
var FEST_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ── state (lazy ensure — premieres live on projects as p.premiereFest;
       S.fest stays the module's namespace anchor) ───────────────── */
function festEnsure() {
  if (!S.fest) S.fest = {};
}

/* ── helpers ──────────────────────────────────────────────────── */
function festMonth(woy) { return Math.min(12, Math.floor(((woy - 1) * 12) / 52) + 1); }
function festByName(n) {
  for (var i = 0; i < FESTIVALS.length; i++) if (FESTIVALS[i].name === n) return FESTIVALS[i];
  return null;
}
function festEligible(p, fest) {
  return (p.phase === "post" || p.phase === "ready") && fest.genres.indexOf(p.genre) >= 0 && !p.premiereFest;
}
function festTasteLabel(fest) {
  var names = [], i;
  for (i = 0; i < fest.genres.length; i++) names.push(genreOf(fest.genres[i]).name);
  return names.join(", ");
}
/* PR fall-festival submissions (pr.js owns S.pr.fested, weeks 34–38) — guarded read. */
function festPrSubmitted(fest) {
  if (fest.w < 34 || fest.w > 38 || !S.pr || !S.pr.fested) return [];
  var titles = [], i;
  for (i = 0; i < S.projects.length; i++) if (S.pr.fested[S.projects[i].id]) titles.push(S.projects[i].title);
  return titles;
}

/* ── mechanic: plan a premiere ($2M, buzz +5, one per project) ── */
function festPlanPremiere(festName, pid) {
  festEnsure();
  var fest = festByName(festName), p = findProject(pid), woy = woyOf(S.studio.week);
  if (!fest) return { err: "That festival is not on the calendar." };
  if (!p) return { err: "That project is gone." };
  if (woy > fest.w) return { err: fest.name + " has already passed this year." };
  if (p.phase !== "post" && p.phase !== "ready") return { err: "Only projects in post or ready can premiere." };
  if (fest.genres.indexOf(p.genre) < 0) return { err: genreOf(p.genre).name + " is not " + fest.name + " taste (" + festTasteLabel(fest) + ")." };
  if (p.premiereFest) return { err: "“" + p.title + "” already premiered at " + p.premiereFest + "." };
  if (S.studio.cash < FEST_PREMIERE_COST) return { err: "Need " + fm(FEST_PREMIERE_COST) + " for the premiere slot." };
  spend(FEST_PREMIERE_COST, "Festival premiere · " + p.title);
  p.buzz += FEST_BUZZ;
  p.premiereFest = fest.name;
  log("🎪 “" + p.title + "” premieres at " + fest.name + " — buzz +" + FEST_BUZZ + ".", "gold", "🎪");
  toast("“" + p.title + "” premieres at " + fest.name + ". Buzz +" + FEST_BUZZ + ".", "gold");
  return { ok: true };
}

/* ── weekly tick: none needed (board is static, effects are immediate) ── */
function tickFestivals() { return 0; }

/* ── commit + action delegation (ui calls festivalAction) ─────── */
function festCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function festHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  festCommit();
}
function festivalAction(a, elx) {
  var id = null, fest = null;
  if (elx && elx.getAttribute) {
    id = elx.getAttribute("data-id");
    fest = elx.getAttribute("data-fest");
  }
  if (a === "fest-premiere") { festHandle(festPlanPremiere(fest, id)); return true; }
  return false;
}

/* ── desk (render returns sheet body HTML only) ───────────────── */
function festDeskBoard() {
  festEnsure();
  var st = S.studio, woy = woyOf(st.week), i, j, p;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Premiere slot", fm(FEST_PREMIERE_COST) + " → buzz +" + FEST_BUZZ)
    + statrow("One premiere per project", "match the festival's taste")
    + "</div>";
  for (i = 0; i < FESTIVALS.length; i++) {
    var fest = FESTIVALS[i];
    var past = woy > fest.w;
    var prem = [], elig = [];
    for (j = 0; j < S.projects.length; j++) {
      p = S.projects[j];
      if (p.premiereFest === fest.name) prem.push(p);
      else if (festEligible(p, fest)) elig.push(p);
    }
    var subs = festPrSubmitted(fest);
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + fest.em + " " + esc(fest.name) + "</div>"
      + (past ? tag("Passed", "red") : tag(FEST_MONTHS[festMonth(fest.w) - 1] + " · W" + fest.w, "blue"))
      + "</div>"
      + '<div class="meta">';
    for (j = 0; j < fest.genres.length; j++) html += tag(genreOf(fest.genres[j]).em + " " + genreOf(fest.genres[j]).name);
    html += "</div>";
    if (prem.length) {
      var names = [];
      for (j = 0; j < prem.length; j++) names.push(prem[j].title);
      html += '<div class="statrow"><span class="k">Premiering</span><span class="v num">' + esc(names.join(", ")) + "</span></div>";
    }
    if (subs.length) html += '<div class="statrow"><span class="k">PR submissions</span><span class="v num">' + esc(subs.join(", ")) + "</span></div>";
    html += '<div class="foot">';
    if (elig.length && !past) {
      html += '<div class="btnrow">';
      for (j = 0; j < elig.length; j++) {
        p = elig[j];
        html += '<button class="btn primary sm" data-action="fest-premiere" data-fest="' + esc(fest.name) + '" data-id="' + p.id + '"'
          + (st.cash < FEST_PREMIERE_COST ? " disabled" : "") + ">" + genreOf(p.genre).em + " " + esc(p.title) + " · " + fm(FEST_PREMIERE_COST) + "</button>";
      }
      html += "</div>"
        + '<div class="meta">' + tag("Cash after " + fm(st.cash - FEST_PREMIERE_COST)) + tag("buzz +" + FEST_BUZZ + " on premiere") + "</div>";
    } else if (!prem.length && !subs.length) {
      html += '<span class="tag">' + (past ? "Edition over — plan early next year" : "No project fits the taste yet") + "</span>";
    }
    html += "</div></div>";
  }
  return html;
}

var FESTIVAL_DESKS = [
  { id: "fest-board", group: "Awards", icon: "🎪", name: "Festival circuit",
    desc: "Year calendar of six festivals — plan $2M premieres for post/ready projects that match the taste.", render: festDeskBoard }
];
