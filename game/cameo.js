/* Box Office War — rebuilt. Celebrity cameo system (wave 7, v42.7).
   State: S.cam (lazy camEnsure) — a small rotating market of cameo offers.
   Systems:
   - Up to 2 standing offers: a big-name guest spot (★3–5 flat fee; ~25% are
     ★5 legends asking star money). Offers regenerate (40%/wk when short) and
     expire after 8 weeks on the board.
   - Booking onto ONE project in pre-production or shooting: pay the fee →
     buzz +3 (legend +5) immediately; craft bonus lands at wrap via
     p.cameoBoost (legend 3, else 1–2); audience bump at release via
     p.cameoAud (legend 5, else 2). One cameo per project, ever.
   - A booked cameo stirs its own press: 8%/wk → buzz +1.
   Engine hooks (wired in v42.7):
   - engine.js computeQuality adds p.cameoBoost to craft.
   - engine.js releaseFilm adds (p.cameoAud || 0) into the audience score.
   - engine.js advanceWeek calls tickCameo().
   Wiring: ui.js bridges cameoAction and collects CAMEO_DESKS (group "Talent");
   projCard tags booked cameos. forecastAdjust_cameo() → 0 (fee moves cash at
   booking time only — finance.js/library.js pattern). */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var CAMEO_FEE_BASE = 2.5;        /* regular cameo fee floor ($M) */
var CAMEO_FEE_LEGEND = 8;        /* legend fee floor ($M) */
var CAMEO_MAX_OFFERS = 2;
var CAMEO_OFFER_TTL = 8;         /* weeks an offer sits on the desk */
var CAMEO_BUZZ = 3, CAMEO_BUZZ_LEGEND = 5;
var CAMEO_AUD = 2, CAMEO_AUD_LEGEND = 5;

var CAMEO_BLURBS = [
  "{n} wants a scene-stealing walk-on — the tabloids would eat it up.",
  "{n} is quietly a fan of the studio and will do it for the credit.",
  "{n} owes your casting director a favor and knows it.",
  "{n} is between jobs and would love the press for a cameo.",
  "{n} saw the script and asked for one scene. Any scene."
];
var CAMEO_LEGEND_BLURBS = [
  "{n} will appear for one scene — and one paycheck with a lot of zeroes.",
  "{n} doesn't do cameos. {n} does events. This would be an event.",
  "One phone call, one scene, one legend: {n}. The trades would explode."
];

/* ── state ────────────────────────────────────────────────────── */
function camEnsure() {
  if (!S.cam) S.cam = { offers: [], booked: 0, seen: {} };
  if (!S.cam.offers) S.cam.offers = [];
  if (!S.cam.seen) S.cam.seen = {};
}

/* ── offers ───────────────────────────────────────────────────── */
function camMakeOffer() {
  var legend = chance(0.25);
  var name = genName();
  var fee = legend ? CAMEO_FEE_LEGEND + rf(0, 4) : CAMEO_FEE_BASE + rf(0, 2.5);
  var bank = legend ? CAMEO_LEGEND_BLURBS : CAMEO_BLURBS;
  return {
    id: "cm" + (S.seq++),
    n: name,
    legend: legend,
    fee: Math.round(fee * 10) / 10,
    blurb: pick(bank).replace(/\{n\}/g, name),
    age: 0
  };
}
function tickCameo() {
  if (!S || S.over) return;
  camEnsure();
  var i, o;
  /* age + expire */
  for (i = S.cam.offers.length - 1; i >= 0; i--) {
    o = S.cam.offers[i];
    o.age++;
    if (o.age > CAMEO_OFFER_TTL) {
      S.cam.offers.splice(i, 1);
      log("Cameo window closed — " + o.n + " booked another gig.", "", "🎬");
    }
  }
  /* regenerate */
  if (S.cam.offers.length < CAMEO_MAX_OFFERS && chance(0.4)) {
    o = camMakeOffer();
    if (!S.cam.seen[o.n]) {
      S.cam.offers.push(o);
      S.cam.seen[o.n] = 1;
      log((o.legend ? "🌟 " : "🎬 ") + o.n + " is open to a cameo (" + fm(o.fee) + (o.legend ? " — legend money" : "") + ").", "", "🌟");
    }
  }
  /* booked cameos stir free press */
  for (i = 0; i < S.projects.length; i++) {
    var p = S.projects[i];
    if (p.cameoName && chance(0.08)) {
      p.buzz = (p.buzz || 0) + 1;
      log("📰 " + p.cameoName + "'s cameo in “" + p.title + "” leaks a set photo — buzz +1.", "", "📰");
    }
  }
}

/* ── booking ──────────────────────────────────────────────────── */
function camBook(offerId, projectId) {
  camEnsure();
  var oi = -1, i, o = null;
  for (i = 0; i < S.cam.offers.length; i++) if (S.cam.offers[i].id === offerId) { oi = i; o = S.cam.offers[i]; }
  var p = findProject(projectId);
  if (!o) { toast("That cameo offer is gone.", "bad"); return false; }
  if (!p) { toast("Pick a production.", "bad"); return false; }
  if (["pre", "shoot"].indexOf(p.phase) < 0) { toast("Cameos lock before post-production.", "bad"); return false; }
  if (p.cameoName) { toast("“" + p.title + "” already has a cameo booked.", ""); return false; }
  if (S.studio.cash < o.fee) { toast("Need " + fm(o.fee) + " for " + o.n + ".", "bad"); return false; }
  spend(o.fee, "Cameo · " + o.n + " · " + p.title);
  p.cameoName = o.n;
  p.cameoLegend = !!o.legend;
  p.cameoBoost = o.legend ? 3 : (chance(0.5) ? 2 : 1);
  p.cameoAud = o.legend ? CAMEO_AUD_LEGEND : CAMEO_AUD;
  p.buzz = (p.buzz || 0) + (o.legend ? CAMEO_BUZZ_LEGEND : CAMEO_BUZZ);
  S.cam.offers.splice(oi, 1);
  S.cam.booked++;
  log((o.legend ? "🌟 " : "🎬 ") + o.n + " books a cameo in “" + p.title + "” — buzz +" + (o.legend ? CAMEO_BUZZ_LEGEND : CAMEO_BUZZ) + ", critics may notice too.", "good", "🌟");
  toast(o.n + " joins “" + p.title + "”. A real event.", "good");
  return true;
}

/* ── action delegation (ui calls cameoAction first-to-true) ───── */
function camCommit() { saveGame(); if (typeof render === "function") render(); if (typeof drainFlash === "function") drainFlash(); }
function cameoAction(a, elx) {
  if (typeof a !== "string" || a.indexOf("cam-") !== 0) return false;
  camEnsure();
  if (a === "cam-book") {
    var offer = elx.getAttribute("data-offer");
    var pid = elx.getAttribute("data-id");
    if (camBook(offer, pid)) camCommit();
    return true;
  }
  return false;
}

/* ── engine hook: fee moves cash at booking time only ─────────── */
function forecastAdjust_cameo() { return 0; }

/* ── desk ─────────────────────────────────────────────────────── */
function camDesk() {
  camEnsure();
  var html = '<div class="card"><div class="empty" style="padding:6px 0">Big names love a surprise appearance — and the press loves it more. Book a cameo onto a project in pre-production or shooting: instant buzz, a craft bump when the film wraps and a small audience lift on opening weekend. One cameo per film.</div>'
    + statrow("Cameos booked all-time", String(S.cam.booked))
    + "</div>";
  if (!S.cam.offers.length) html += '<div class="card empty"><span class="em">🌟</span>No cameo offers this week. The phones are quiet.</div>';
  S.cam.offers.forEach(function (o) {
    html += '<div class="card film"><div class="head"><div class="title">' + (o.legend ? "🌟 " : "🎬 ") + esc(o.n) + (o.legend ? tag("Legend", "gold") : tag("Guest spot")) + "</div>" + tag(fm(o.fee), "gold") + "</div>"
      + '<div class="meta">' + tag("Buzz +" + (o.legend ? CAMEO_BUZZ_LEGEND : CAMEO_BUZZ), "blue") + tag("Quality +" + (o.legend ? 3 : "1–2")) + tag("Audience +" + (o.legend ? CAMEO_AUD_LEGEND : CAMEO_AUD), "green") + (o.age >= 4 ? tag("Leaving soon", "red") : "") + "</div>"
      + '<div class="empty" style="padding:4px 0 0">' + esc(o.blurb) + "</div>";
    var cands = S.projects.filter(function (p) { return ["pre", "shoot"].indexOf(p.phase) >= 0 && !p.cameoName; });
    if (cands.length) {
      html += '<div class="foot btnrow">';
      cands.forEach(function (p) {
        html += '<button class="btn sm" data-action="cam-book" data-offer="' + o.id + '" data-id="' + p.id + '" ' + (S.studio.cash < o.fee ? "disabled" : "") + ">" + esc(p.title) + " · " + fm(o.fee) + "</button>";
      });
      html += "</div>";
    } else {
      html += '<div class="empty" style="padding:4px 0 0">Nothing in pre-production or shooting to book onto.</div>';
    }
    html += "</div>";
  });
  var active = S.projects.filter(function (p) { return p.cameoName; });
  if (active.length) {
    html += '<div class="sechead"><h2>Booked cameos</h2></div><div class="card">';
    active.forEach(function (p) {
      html += statrow(esc(p.cameoName) + (p.cameoLegend ? " 🌟" : "") + " → “" + esc(p.title) + "”", tag(phaseName(p.phase)));
    });
    html += "</div>";
  }
  return html;
}

var CAMEO_DESKS = [
  { id: "cam-main", group: "Talent", icon: "🌟", name: "Cameos",
    desc: "Celebrity guest spots — pay a big name for one scene: instant buzz, a craft bump and an audience lift.",
    render: camDesk }
];
