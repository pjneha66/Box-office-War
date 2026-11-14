/* Box Office War — rebuilt. OTT module (wave 2) — all state under S.ott.
   Systems: 8 parody streaming platforms bid pay-1 licensing offers on films still in
   theatrical run (window-gated) · accepting banks the pay-1 now plus a weekly tail for
   8 weeks · declining cools that platform off that film for 12 weeks · relations drift
   toward 50 and gate bidding (rel 40+ to bid).
   Wiring (wave-2 contract): engine.js calls tickOTT() after its own systems and ui.js
   bridges ottAction()/OTT_DESKS — this file only defines them, no self-wrapping.
   Platform "renew" is per-spec roster data; no mechanic consumes it yet. */
"use strict";

/* ── platform roster ──────────────────────────────────────────── */
var OTT_PLATFORMS = [
  { id: "streamflix",  n: "StreamFlix",  generosity: 1.0,  renew: 0.5,  taste: { drama: 1.2, crime: 1.15 } },
  { id: "primevideoy", n: "PrimeVideoy", generosity: 0.95, renew: 0.45, taste: { action: 1.2, scifi: 1.15 } },
  { id: "disneyar",    n: "Disneyar+",   generosity: 1.1,  renew: 0.55, taste: { animation: 1.4, fantasy: 1.3 } },
  { id: "appletv",     n: "Appletv+",    generosity: 1.15, renew: 0.4,  taste: { drama: 1.3, docs: 1.3 } },
  { id: "maxx",        n: "Maxx",        generosity: 0.9,  renew: 0.5,  taste: { thriller: 1.2, horror: 1.1 } },
  { id: "peacocke",    n: "Peacocke",    generosity: 0.85, renew: 0.45, taste: { comedy: 1.25, romance: 1.15 } },
  { id: "huluu",       n: "Huluu",       generosity: 0.9,  renew: 0.5,  taste: { crime: 1.2, drama: 1.1 } },
  { id: "paramountp",  n: "Paramountp",  generosity: 0.85, renew: 0.4,  taste: { action: 1.15, horror: 1.2 } }
];

/* ── state (lazy ensure — old saves have no S.ott) ────────────── */
function ottEnsure() {
  if (!S.ott) S.ott = { lastTick: 0, platforms: null, offers: [], deals: [], declined: {} };
  if (!S.ott.offers) S.ott.offers = [];
  if (!S.ott.deals) S.ott.deals = [];
  if (!S.ott.declined) S.ott.declined = {};
  if (!S.ott.platforms || S.ott.platforms.length !== OTT_PLATFORMS.length) {
    var old = S.ott.platforms || [], out = [], i, j, keep;
    for (i = 0; i < OTT_PLATFORMS.length; i++) {
      keep = null;
      for (j = 0; j < old.length; j++) if (old[j].id === OTT_PLATFORMS[i].id) keep = old[j];
      out.push({
        id: OTT_PLATFORMS[i].id, n: OTT_PLATFORMS[i].n,
        generosity: OTT_PLATFORMS[i].generosity, renew: OTT_PLATFORMS[i].renew,
        taste: OTT_PLATFORMS[i].taste,
        rel: keep && isFinite(keep.rel) ? keep.rel : 50
      });
    }
    S.ott.platforms = out;
  }
}

function ottPlat(id) {
  var i;
  for (i = 0; i < S.ott.platforms.length; i++) if (S.ott.platforms[i].id === id) return S.ott.platforms[i];
  return null;
}

function ottTaste(p, genre) { return (p.taste && p.taste[genre]) || 1; }

/* Pay-1 window: how deep into the run a platform starts bidding; window is theatrical
   days (17 | 45 | 90), default 45 → week 7. Short windows bid sooner, long ones later. */
function ottOfferWeek(film) { return Math.max(3, Math.ceil((film.window || 45) / 7)); }
function ottWindowMult(film) {
  var w = film.window || 45;
  return w <= 17 ? 1.4 : w >= 90 ? 0.8 : 1;
}

/* declined map keyed by filmId+platId → week of the decline; 12-week cooldown. */
function ottDeclinedAt(filmId, platId) {
  var w = S.ott.declined[filmId + platId];
  return typeof w === "number" ? w : null;
}
function ottCooledDown(film, plat) {
  var dw = ottDeclinedAt(film.id, plat.id);
  return dw != null && S.studio.week - dw < 12;
}

/* Best bidder for a film: highest genre taste among platforms with rel 40+ that are
   not cooled down; ties broken by the better relationship. */
function ottBestPlatform(film) {
  var best = null, bestTaste = 0, i, p, t;
  for (i = 0; i < S.ott.platforms.length; i++) {
    p = S.ott.platforms[i];
    if (p.rel < 40 || ottCooledDown(film, p)) continue;
    t = ottTaste(p, film.genre);
    if (t > bestTaste || (t === bestTaste && best && p.rel > best.rel)) { best = p; bestTaste = t; }
  }
  return best;
}

function ottActiveDeal(filmId) {
  var i;
  for (i = 0; i < S.ott.deals.length; i++) if (S.ott.deals[i].filmId === filmId) return S.ott.deals[i];
  return null;
}
function ottOpenOffer(filmId) {
  var i;
  for (i = 0; i < S.ott.offers.length; i++) if (S.ott.offers[i].filmId === filmId) return S.ott.offers[i];
  return null;
}
function ottFindOffer(id) {
  var i;
  for (i = 0; i < S.ott.offers.length; i++) if (S.ott.offers[i].id === id) return S.ott.offers[i];
  return null;
}

/* One licensing offer: pay-1 = 30% of the film's worldwide takeaway, scaled by the
   platform's generosity + genre taste + the theatrical window (short windows are worth
   more to streamers, long ones less), plus a 2%-of-pay-1 weekly tail for 8 weeks. */
function ottMakeOffer(film, plat) {
  var pay1 = Math.round(film.opening * (film.legs || 2.2) * 0.30 * plat.generosity
    * ottTaste(plat, film.genre) * ottWindowMult(film) * rf(0.8, 1.2) * 10) / 10;
  var tail = Math.round(pay1 * 0.02 * 100) / 100;
  S.ott.offers.push({ id: "ott" + (S.seq++), filmId: film.id, title: film.title, platId: plat.id, pay1: pay1, tail: tail, expires: S.studio.week + 4 });
  log("📺 " + plat.n + " bids " + fm(pay1) + " for “" + film.title + "” — pay-1 now plus " + fm(tail) + "/wk for 8 weeks.", "", "📺");
  toast("📺 " + plat.n + " made an offer for “" + film.title + "”.", "");
}

/* Weekly offer pass: films still in theaters past their pay-1 week, one open offer per
   film, 4 open offers max. Expired offers were already swept this tick, so the cap
   never waits on one (the "drop oldest expired" clause is the sweep itself). */
function ottMakeOffers() {
  var i, f, plat;
  for (i = 0; i < S.films.length; i++) {
    if (S.ott.offers.length >= 4) break;
    f = S.films[i];
    if (f.status !== "run" || f.weeksOut < ottOfferWeek(f)) continue;
    if (ottOpenOffer(f.id) || ottActiveDeal(f.id)) continue;
    plat = ottBestPlatform(f);
    if (plat) ottMakeOffer(f, plat);
  }
}

/* ── accept / decline ─────────────────────────────────────────── */
function ottAccept(id) {
  var o = ottFindOffer(id), p;
  if (!o) { toast("That offer is gone.", "bad"); return false; }
  earn(o.pay1, "OTT deal · " + o.title);
  S.ott.deals.push({ filmId: o.filmId, title: o.title, platId: o.platId, tail: o.tail, weekly: o.tail, since: S.studio.week, until: S.studio.week + 8 });
  p = ottPlat(o.platId);
  if (p) p.rel = clamp(p.rel + 5, 0, 100);
  S.ott.offers.splice(S.ott.offers.indexOf(o), 1);
  log("📺 " + (p ? p.n : "A streamer") + " licenses “" + o.title + "” — " + fm(o.pay1) + " pay-1 banked, " + fm(o.tail) + "/wk for 8 weeks.", "good", "📺");
  toast("📦 “" + o.title + "” deal signed — " + fm(o.pay1) + " now.", "good");
  return true;
}

function ottDecline(id) {
  var o = ottFindOffer(id), p;
  if (!o) { toast("That offer is gone.", "bad"); return false; }
  p = ottPlat(o.platId);
  if (p) p.rel = clamp(p.rel - 3, 0, 100);
  S.ott.declined[o.filmId + o.platId] = S.studio.week;
  S.ott.offers.splice(S.ott.offers.indexOf(o), 1);
  toast("“" + o.title + "” passed on — " + (p ? p.n : "the platform") + " cools off for 12 weeks.", "");
  return true;
}

/* ── weekly systems ───────────────────────────────────────────── */
function ottTickOffers() {
  var i;
  for (i = S.ott.offers.length - 1; i >= 0; i--) {
    if (S.studio.week > S.ott.offers[i].expires) S.ott.offers.splice(i, 1);
  }
}

/* Tails land the week after signing and run 8 weeks (since+1 .. until); the deal is
   dropped after its final payment. */
function ottTickDeals() {
  var i, d;
  for (i = S.ott.deals.length - 1; i >= 0; i--) {
    d = S.ott.deals[i];
    if (S.studio.week > d.since && S.studio.week <= d.until) earn(d.weekly, "OTT tail · " + d.title);
    if (S.studio.week >= d.until) S.ott.deals.splice(i, 1);
  }
}

/* Relations drift half a point a week toward the neutral 50. */
function ottTickRel() {
  var i, p;
  for (i = 0; i < S.ott.platforms.length; i++) {
    p = S.ott.platforms[i];
    p.rel = p.rel < 50 ? Math.min(50, p.rel + 0.5) : p.rel > 50 ? Math.max(50, p.rel - 0.5) : 50;
    p.rel = Math.round(p.rel * 10) / 10;
  }
}

/* ── weekly tick (engine calls this after its own systems) ────── */
function tickOTT() {
  if (!S || S.over) return;
  ottEnsure();
  if (S.ott.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.ott.lastTick = S.studio.week;
  ottTickOffers();
  ottTickDeals();
  ottTickRel();
  ottMakeOffers();
}

/* Engine forecast hook: net $M this module adds to a given absolute week. Tails only —
   a pay-1 lands when the player accepts, which a forecast can't schedule. */
function forecastAdjust_ott(weekAbs) {
  if (!S || !S.ott) return 0;
  var sum = 0, i, d;
  for (i = 0; i < S.ott.deals.length; i++) {
    d = S.ott.deals[i];
    if (weekAbs > d.since && weekAbs <= d.until) sum += d.weekly;
  }
  return sum;
}

/* ── desk ─────────────────────────────────────────────────────── */
function ottDealsDesk() {
  ottEnsure();
  var html = '<div data-ottdesk="deals">', i, p, o, d, left;
  html += '<div class="card">';
  for (i = 0; i < S.ott.platforms.length; i++) {
    p = S.ott.platforms[i];
    html += '<div class="statrow"><span class="k">' + esc(p.n) + (p.rel >= 40 ? "" : " · not bidding") + '</span>'
      + '<span class="v">Rel ' + Math.round(p.rel) + '</span></div>';
  }
  html += '</div>';
  html += '<div class="sechead"><h2>Open offers</h2></div>';
  if (!S.ott.offers.length) {
    html += '<div class="card"><div class="empty"><span class="em">📺</span>No open offers. Platforms bid once your films are a few weeks into their theatrical run.</div></div>';
  }
  for (i = 0; i < S.ott.offers.length; i++) {
    o = S.ott.offers[i];
    p = ottPlat(o.platId);
    left = Math.max(0, o.expires - S.studio.week);
    html += '<div class="card film">'
      + '<div class="head"><div class="title">📺 ' + esc(o.title) + '</div>' + tag(fm(o.pay1) + " · " + fm(o.tail) + "/wk", "gold") + '</div>'
      + '<div class="statrow"><span class="k">Bidder</span><span class="v">' + esc(p ? p.n : o.platId) + '</span></div>'
      + '<div class="statrow"><span class="k">Pay-1 (now)</span><span class="v num up">+' + fm(o.pay1) + '</span></div>'
      + '<div class="statrow"><span class="k">Tail</span><span class="v">' + fm(o.tail) + "/wk · 8 weeks</span></div>"
      + '<div class="statrow"><span class="k">Expires</span><span class="v">in ' + left + ' wk</span></div>'
      + '<div class="btnrow">'
      + '<button class="btn primary sm grow" data-action="ott-accept" data-id="' + o.id + '">Accept · +' + fm(o.pay1) + '</button>'
      + '<button class="btn sm" data-action="ott-decline" data-id="' + o.id + '">Decline</button>'
      + '</div></div>';
  }
  html += '<div class="sechead"><h2>Active deals</h2></div>';
  if (!S.ott.deals.length) {
    html += '<div class="card"><div class="empty"><span class="em">📦</span>No active streaming deals. Signed films pay a weekly tail here for 8 weeks.</div></div>';
  }
  for (i = 0; i < S.ott.deals.length; i++) {
    d = S.ott.deals[i];
    p = ottPlat(d.platId);
    left = Math.max(0, d.until - S.studio.week);
    html += '<div class="card"><div class="statrow"><span class="k">📦 ' + esc(d.title) + " · " + esc(p ? p.n : d.platId) + '</span>'
      + '<span class="v">' + fm(d.weekly) + "/wk · " + left + ' wk left</span></div></div>';
  }
  return html + "</div>";
}

var OTT_DESKS = [
  { id: "ott-deals", group: "TV & Streaming", icon: "📺", name: "OTT deals",
    desc: "Pay-1 licensing offers from 8 streaming platforms.",
    render: ottDealsDesk }
];

/* ── action dispatch (ui.js bridges ottAction) ────────────────── */
function ottAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("ott-") !== 0) return false;
  ottEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var ok;
  if (a === "ott-accept") ok = ottAccept(id);
  else if (a === "ott-decline") ok = ottDecline(id);
  else return false;
  if (ok) saveGame();
  if (typeof render === "function") render();
  return true;
}
