/* Box Office War — rebuilt. Year-end awards expansion module (wave 6).
   Engine yearAwards() calls extraAwardCategories(yearFilms) with this year's
   releases: three categories beyond Best Picture —
   - Best Actor: the year film with the highest aud score; its lead gains heat +1
     (same 0..3 cap the engine uses at endTheatrical) + a "wins Best Actor" news line.
   - Best Director: the film with the highest quality; its director gains skill +2
     (engine's 97 cap) + news.
   - Best Original Song: a random nominated film; the studio earns a $3M
     "Soundtrack award bump" (the composer lookup is deliberately skipped).
   FYC angle: when a winning film has points from PR campaigns (guarded read of
   S.pr.campaigns — pr.js owns that state, this module never writes it) an extra
   "FYC paid off" news line is logged.
   Past winners are stored under S.aw (lazy awEnsure, old saves have no S.aw) and
   shown on the "Awards history" desk (AWARDS_DESKS, group "Awards").
   Wiring: ui.js bridges awardsAction (desk is read-only — it declines all actions)
   and collects AWARDS_DESKS. Trophies pay out once a year, never weekly, so
   forecastAdjust_awards() → 0 (uniform zero stub, finance.js/library.js pattern). */
"use strict";

/* ── state (lazy ensure — old saves have no S.aw) ─────────────── */
function awEnsure() {
  if (!S.aw) S.aw = {};
  if (!S.aw.history) S.aw.history = [];   /* {y, cat, film, who} oldest first */
}

/* ── the three categories ─────────────────────────────────────── */
function awBestBy(films, key) {
  var best = null, i;
  for (i = 0; i < films.length; i++) if (!best || films[i][key] > best[key]) best = films[i];
  return best;
}
function awFycWon(f) { return !!(S.pr && S.pr.campaigns && S.pr.campaigns[f.id]); }
function awFycLog(f) {
  log("🏆 FYC paid off for “" + f.title + "” — the campaign earns its keep.", "gold", "🏆");
}
function awRecord(cat, f, who) {
  awEnsure();
  S.aw.history.push({ y: S.studio.year, cat: cat, film: f.title, who: who || null });
}

function awBestActor(films) {
  var f = awBestBy(films, "aud");
  if (!f) return;
  var act = findTalent(f.actId);
  if (act) act.heat = Math.min(act.heat + 1, 3);
  log("🏆 " + (act ? act.n : "The lead") + " of “" + f.title + "” wins Best Actor" + (act ? " — heat +1." : "."), "gold", "🏆");
  if (awFycWon(f)) awFycLog(f);
  awRecord("Best Actor", f, act ? act.n : null);
}

function awBestDirector(films) {
  var f = awBestBy(films, "quality");
  if (!f) return;
  var dir = findTalent(f.dirId);
  if (dir) dir.skill = Math.min(97, dir.skill + 2);
  log("🎬 " + (dir ? dir.n : "The director") + " of “" + f.title + "” wins Best Director" + (dir ? " — skill +2." : "."), "gold", "🏆");
  if (awFycWon(f)) awFycLog(f);
  awRecord("Best Director", f, dir ? dir.n : null);
}

function awBestSong(films) {
  var f = pick(films);
  if (!f) return;
  earn(3, "Soundtrack award bump · " + f.title);
  log("🎵 “" + f.title + "” wins Best Original Song — soundtrack award bump " + fm(3) + ".", "gold", "🎵");
  if (awFycWon(f)) awFycLog(f);
  awRecord("Best Original Song", f, null);
}

/* ── engine hook (yearAwards calls this after Best Picture scoring) ── */
function extraAwardCategories(yearFilms) {
  awEnsure();
  var films = yearFilms || [];
  if (!films.length) return;
  awBestActor(films);
  awBestDirector(films);
  awBestSong(films);
}

/* ── action delegation (ui calls awardsAction first; desk is read-only) ── */
function awardsAction() { return false; }

/* ── engine hook: trophies pay out at year-end, never weekly ──── */
function forecastAdjust_awards() { return 0; }

/* ── desk (render returns sheet body HTML only) ───────────────── */
function awDeskHist() {
  awEnsure();
  var H = S.aw.history, i;
  var html = '<div class="card">'
    + statrow("Trophies on the shelf", String(H.length))
    + statrow("Categories", "Actor · Director · Original Song")
    + "</div>";
  if (!H.length) return html + '<div class="empty"><span class="em">🏆</span>No statuettes yet. Year-end awards honor the year\'s releases — FYC campaigns on the PR desk can tip them.</div>';
  html += '<div class="card">';
  for (i = H.length - 1; i >= 0; i--) {   /* newest first */
    var h = H[i];
    html += '<div class="statrow"><span class="k">Year ' + h.y + " · " + esc(h.cat)
      + '</span><span class="v num">“' + esc(h.film) + "”" + (h.who ? " · " + esc(h.who) : "") + "</span></div>";
  }
  html += "</div>";
  return html;
}

var AWARDS_DESKS = [
  { id: "aw-hist", group: "Awards", icon: "🏆", name: "Awards history",
    desc: "Every statuette the studio has taken — Best Actor, Best Director, Best Original Song.", render: awDeskHist }
];
