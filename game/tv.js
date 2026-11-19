/* Box Office War — rebuilt. TV & Streaming module — all state under S.tv.
   Systems: streamer (subscriptions) · series (episodic production) · live network (ad revenue)
   · syndication (three package tiers of licensing offers for finished films).
   Wiring: index.html loads this file after engine.js but BEFORE ui.js, and the contract's
   typeof-guarded hooks are not present in engine.js/ui.js yet — so the module self-wires at
   the bottom of this file: advanceWeek is wrapped at load (tickTV runs after the engine's own
   systems; tickTV no-ops if it already ran this week, so adding the real engine hook later is
   safe), and onAction is wrapped on a 0-delay timer once ui.js has booted. Unknown actions
   fall through untouched; unknown "tv-" actions return false without mutating anything. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var TV_BLOCKS = [
  { id: "movies",  name: "Movies",  rate: 1.0 },
  { id: "talk",    name: "Talk",    rate: 0.8 },
  { id: "reality", name: "Reality", rate: 0.9 },
  { id: "sports",  name: "Sports",  rate: 1.3 },
  { id: "drama",   name: "Drama",   rate: 0.85 },
  { id: "news",    name: "News",    rate: 0.7 }
];
var TV_SERIES_TIERS = [20, 45, 80];
var SERIES_GL = { genre: "drama", tier: 1 };   /* series greenlight picker (desk UI state) */
var LIVE_CFG = { movies: true, talk: true, reality: true, sports: true, drama: false, news: false };

/* ── state (lazy ensure — old saves have no S.tv) ─────────────── */
function tvEnsure() {
  if (!S.tv) S.tv = { lastTick: 0, streamer: null, series: [], live: null, synd: null };
  if (!S.tv.series) S.tv.series = [];
  if (!S.tv.synd) S.tv.synd = { offers: [], deals: [], archived: [], notified: [] };
  var sy = S.tv.synd, i;
  if (!sy.deals) sy.deals = [];
  if (!sy.archived) sy.archived = [];
  if (!sy.notified) sy.notified = [];
  /* pre-wave-3 saves: running 26-week royalties become Matinee deals; old offers gain tier/expires */
  if (sy.done) {
    for (i = 0; i < sy.done.length; i++) {
      sy.deals.unshift({ filmId: sy.done[i].filmId, title: sy.done[i].title, tier: "MATINEE", weekly: sy.done[i].royalty, until: S.studio.week + Math.max(1, sy.done[i].wks || 1) });
    }
    delete sy.done;
  }
  delete sy.offered;
  for (i = 0; i < sy.offers.length; i++) {
    if (!sy.offers[i].tier) sy.offers[i].tier = "MATINEE";
    if (!sy.offers[i].wks) sy.offers[i].wks = 26;
    if (!sy.offers[i].expires) sy.offers[i].expires = (sy.offers[i].born || S.studio.week) + 4;
  }
}

/* ── streamer ─────────────────────────────────────────────────── */
function tvLaunchStreamer() {
  if (S.tv.streamer) return false;
  if (S.studio.cash < 60) { pushToast("Need " + fm(60) + " to launch a streamer.", "bad"); return false; }
  spend(60, "Streamer launch");
  S.tv.streamer = { id: "tv" + (S.seq++), name: S.studio.name + " TV", subs: 0.4, licensed: 0, exclusives: 0, licensedIds: [], pendingClose: false };
  log(S.tv.streamer.name + " launches — the studio enters streaming.", "gold", "📺");
  pushToast("📺 " + S.tv.streamer.name + " is live. Subscribers: 0.4M.", "good");
  return true;
}

/* Latest done film with a $30M+ worldwide run that this streamer has not licensed yet. */
function tvLicensePick() {
  var st = S.tv.streamer, i, f;
  if (!st) return null;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status === "done" && isFinite(f.ww) && f.ww >= 30 && st.licensedIds.indexOf(f.id) < 0) {
      return { film: f, cost: Math.round(f.ww * 0.015) };
    }
  }
  return null;
}

function tvDoLicense() {
  var st = S.tv.streamer, p = tvLicensePick();
  if (!p) { pushToast("No eligible film — needs a finished $30M+ worldwide run.", ""); return false; }
  if (S.studio.cash < p.cost) { pushToast("Need " + fm(p.cost) + " to license “" + p.film.title + "”.", "bad"); return false; }
  spend(p.cost, "Streamer license · " + p.film.title);
  st.licensed++;
  st.licensedIds.push(p.film.id);
  log("“" + p.film.title + "” joins " + st.name + " — a deeper library keeps subscribers watching.", "", "📺");
  return true;
}

function tvDoExclusive() {
  var st = S.tv.streamer;
  if (!st) return false;
  if (S.studio.cash < 25) { pushToast("Need " + fm(25) + " for an exclusive.", "bad"); return false; }
  spend(25, "Streamer exclusive");
  var q = ri(55, 80), title = genTitle();
  st.subs += 1.5 + q / 40;
  st.exclusives++;
  log("Exclusive “" + title + "” (quality " + q + ") drops on " + st.name + " — subscribers surge.", "good", "📺");
  return true;
}

/* Two-tap shutdown: first tap only arms the pending flag shown in the desk. */
function tvDoShutdown() {
  var st = S.tv.streamer;
  if (!st) return false;
  if (!st.pendingClose) {
    st.pendingClose = true;
    pushToast("Tap “Confirm” again to shut " + st.name + " down for good.", "");
    return true;
  }
  log(st.name + " shuts down. Subscribers, upkeep and licensing spend all stop.", "bad", "📺");
  pushToast(st.name + " shut down.", "bad");
  S.tv.streamer = null;
  return true;
}

function tvTickStreamer() {
  var st = S.tv.streamer;
  if (!st) return;
  spend(3, "Streamer upkeep · " + st.name);
  st.subs = Math.max(0.1, st.subs * 0.98 + 0.02 * st.licensed + 0.05 * st.exclusives + 0.01);
  earn(st.subs * 0.015, "Streamer · " + st.name);
}

/* ── series ───────────────────────────────────────────────────── */
function tvFindSeries(id) {
  var i;
  for (i = 0; i < S.tv.series.length; i++) if (S.tv.series[i].id === id) return S.tv.series[i];
  return null;
}

function tvSeriesConfirm() {
  if (S.tv.series.length >= 3) { pushToast("Series slate is full — 3 concurrent series max.", "bad"); return false; }
  var budget = TV_SERIES_TIERS[SERIES_GL.tier];
  if (S.studio.cash < budget) { pushToast("Need " + fm(budget) + " to produce the series.", "bad"); return false; }
  var sn = { id: "tv" + (S.seq++), name: genTitle(), genre: SERIES_GL.genre, budget: budget, phase: "prod", wk: 0, eps: 0, season: 1, rating: null, quality: ri(40, 70) };
  S.tv.series.push(sn);
  log("Greenlit series “" + sn.name + "” — " + genreOf(sn.genre).name + ", " + fm(budget) + " budget, 6 weeks of production.", "", "🎞️");
  pushToast("🎞️ “" + sn.name + "” enters production.", "good");
  return true;
}

function tvSeriesRenew(id) {
  var sn = tvFindSeries(id);
  if (!sn || sn.phase !== "renew") return false;
  var cost = Math.round(sn.budget * 1.1 * 10) / 10;
  if (S.studio.cash < cost) { pushToast("Need " + fm(cost) + " to renew “" + sn.name + "”.", "bad"); return false; }
  spend(cost, "Series renewal · " + sn.name);
  sn.quality = clamp(sn.quality + ri(-2, 4), 5, 99);
  sn.eps = 0;
  sn.season++;
  sn.phase = "air";
  log("“" + sn.name + "” renewed for season " + sn.season + " — quality now " + sn.quality + ".", "good", "🎞️");
  return true;
}

function tvSeriesEnd(id) {
  var sn = tvFindSeries(id);
  if (!sn || sn.phase !== "renew") return false;
  S.studio.catalog += sn.budget * 0.4;
  S.tv.series.splice(S.tv.series.indexOf(sn), 1);
  log("“" + sn.name + "” ends after " + sn.season + " season(s) — the library gains " + fm(sn.budget * 0.4) + " in catalog value.", "", "📺");
  return true;
}

/* Episode rating: the show's quality (rolled ri(40,70) at greenlight — the spec's
   trendless rating roll) is the baseline; per-episode noise; renewal nudges quality. */
function tvEpisodeRating(sn) {
  return clamp(Math.round(sn.quality + gauss() * 6), 5, 99);
}

function tvTickSeries() {
  var i, sn;
  for (i = S.tv.series.length - 1; i >= 0; i--) {
    sn = S.tv.series[i];
    if (sn.phase === "prod") {
      sn.wk++;
      spend(sn.budget / 6, "Series · " + sn.name);
      if (sn.wk >= 6) {
        sn.phase = "air";
        sn.eps = 0;
        log("“" + sn.name + "” premieres — eight weekly episodes begin.", "", "📺");
      }
    } else if (sn.phase === "air") {
      sn.rating = tvEpisodeRating(sn);
      sn.eps++;
      earn((sn.rating / 100) * sn.budget * 0.15, "Series · " + sn.name);
      if (sn.eps >= 8) {
        sn.phase = "renew";
        log("Season finale of “" + sn.name + "” aired (last rating " + sn.rating + "). Renewal decision on the Series desk.", "gold", "📺");
      }
    }
  }
}

/* ── live network ─────────────────────────────────────────────── */
function tvLiveSelIds() {
  var ids = [], i;
  for (i = 0; i < TV_BLOCKS.length; i++) if (LIVE_CFG[TV_BLOCKS[i].id]) ids.push(TV_BLOCKS[i].id);
  return ids;
}

function tvLiveRateSum(lv) {
  var sum = 0, i;
  for (i = 0; i < TV_BLOCKS.length; i++) if (lv.blocks[TV_BLOCKS[i].id]) sum += TV_BLOCKS[i].rate;
  return sum;
}

function tvLiveConfirm() {
  if (S.tv.live) return false;
  var ids = tvLiveSelIds(), i;
  if (ids.length !== 4) { pushToast("Pick exactly 4 programming blocks.", "bad"); return false; }
  if (S.studio.cash < 80) { pushToast("Need " + fm(80) + " to launch the network.", "bad"); return false; }
  spend(80, "Live TV launch");
  var blocks = {};
  for (i = 0; i < ids.length; i++) blocks[ids[i]] = true;
  S.tv.live = { id: "tv" + (S.seq++), name: S.studio.name + " Network", blocks: blocks, audience: 1.0 };
  log(S.tv.live.name + " signs on with 4 programming blocks. Ad revenue starts this week.", "gold", "📡");
  pushToast("📡 " + S.tv.live.name + " is on air.", "good");
  return true;
}

function tvLiveRefresh() {
  var lv = S.tv.live;
  if (!lv) return false;
  if (S.studio.cash < 4) { pushToast("Need " + fm(4) + " for a lineup refresh.", "bad"); return false; }
  spend(4, "Live TV · lineup refresh");
  lv.audience = Math.min(1.2, lv.audience + 0.08);
  pushToast("Lineup refreshed — audience " + lv.audience.toFixed(2) + "×.", "good");
  return true;
}

function tvTickLive() {
  var lv = S.tv.live;
  if (!lv) return;
  earn(tvLiveRateSum(lv) * 1.2 * lv.audience, "Live TV · ad revenue");
  lv.audience = lv.audience * 0.985;
}

/* ── syndication ──────────────────────────────────────────────── */
/* Three fixed package tiers. Base terms come from the film's worldwide run
   (advance 3% of ww, royalty 0.1% of ww per week) scaled per tier; the gates are
   nested (PRIMETIME ⊃ MATINEE ⊃ CABLE-CULT) so a hit collects every package. */
var TV_SYND_TIERS = [
  { id: "PRIMETIME",  name: "Primetime",  wks: 52, advMult: 1.6, royMult: 1.3, minWw: 80, minCrit: 70 },
  { id: "MATINEE",    name: "Matinee",    wks: 26, advMult: 1.0, royMult: 1.0, minWw: 25, minCrit: 50 },
  { id: "CABLE-CULT", name: "Cable cult", wks: 12, advMult: 0.6, royMult: 0.8, minWw: 5,  minCrit: 30 }
];

function tvSyndTier(id) {
  var i;
  for (i = 0; i < TV_SYND_TIERS.length; i++) if (TV_SYND_TIERS[i].id === id) return TV_SYND_TIERS[i];
  return null;
}

/* Gate: worldwide gross OR critics, per tier. */
function tvSyndQualifies(f, t) {
  return (isFinite(f.ww) && f.ww >= t.minWw) || (isFinite(f.criticAvg) && f.criticAvg >= t.minCrit);
}

function tvSyndTerms(f, t) {
  var ww = isFinite(f.ww) ? f.ww : 0;
  var baseAdv = Math.round(ww * 0.03), baseRoy = Math.round(ww * 0.001 * 100) / 100;
  return { advance: Math.round(baseAdv * t.advMult), royalty: Math.round(baseRoy * t.royMult * 100) / 100 };
}

function tvSyndDealFor(filmId) {
  var i;
  for (i = 0; i < S.tv.synd.deals.length; i++) if (S.tv.synd.deals[i].filmId === filmId) return S.tv.synd.deals[i];
  return null;
}

function tvSyndAccept(id) {
  var sy = S.tv.synd, i, o = null, oi = -1, t;
  for (i = 0; i < sy.offers.length; i++) if (sy.offers[i].id === id) { o = sy.offers[i]; oi = i; }
  if (!o) return false;
  t = tvSyndTier(o.tier);
  if (tvSyndDealFor(o.filmId)) { /* film got contracted through another tier — stale offer */
    sy.offers.splice(oi, 1);
    pushToast("“" + o.title + "” is already under a syndication deal — offer withdrawn.", "");
    return false;
  }
  earn(o.advance, "Syndication · " + o.title);
  sy.deals.unshift({ filmId: o.filmId, title: o.title, tier: o.tier, weekly: o.royalty, until: S.studio.week + o.wks });
  /* one deal per film — sibling-tier offers for the same film come off the desk */
  for (i = sy.offers.length - 1; i >= 0; i--) if (sy.offers[i].filmId === o.filmId) sy.offers.splice(i, 1);
  log("“" + o.title + "” licensed for syndication (" + (t ? t.name : o.tier) + ") — " + fm(o.advance) + " advance, " + o.royalty.toFixed(2) + "M/wk for " + o.wks + " weeks.", "good", "📦");
  pushToast("📦 “" + o.title + "” syndicated.", "good");
  return true;
}

function tvSyndDecline(id) {
  var sy = S.tv.synd, i, o = null;
  for (i = 0; i < sy.offers.length; i++) if (sy.offers[i].id === id) o = sy.offers[i];
  if (!o) return false;
  sy.offers.splice(sy.offers.indexOf(o), 1);
  pushToast("Syndication offer for “" + o.title + "” declined.", "");
  return true;
}

function tvTickSynd() {
  var sy = S.tv.synd, i, j, k, f, t, terms, logged = 0, drop;
  /* expired offers come off the desk — the film re-qualifies on a later tick */
  for (i = sy.offers.length - 1; i >= 0; i--) if (S.studio.week >= sy.offers[i].expires) sy.offers.splice(i, 1);
  /* weekly royalty tail for active deals; fulfilled deals archive with their tier */
  for (i = sy.deals.length - 1; i >= 0; i--) {
    earn(sy.deals[i].weekly, "Syndication · " + sy.deals[i].title);
    if (S.studio.week >= sy.deals[i].until) {
      sy.archived.unshift({ filmId: sy.deals[i].filmId, title: sy.deals[i].title, tier: sy.deals[i].tier });
      sy.deals.splice(i, 1);
    }
  }
  /* one open offer per film+tier, none for contracted films, open pool capped at 6 */
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "done" || tvSyndDealFor(f.id)) continue;
    for (j = 0; j < TV_SYND_TIERS.length; j++) {
      t = TV_SYND_TIERS[j];
      if (!tvSyndQualifies(f, t)) continue;
      for (k = 0; k < sy.offers.length; k++) if (sy.offers[k].filmId === f.id && sy.offers[k].tier === t.id) break;
      if (k < sy.offers.length) continue;
      if (sy.offers.length >= 6) { /* pool full: drop the offer that expires soonest */
        drop = 0;
        for (k = 1; k < sy.offers.length; k++) if (sy.offers[k].expires < sy.offers[drop].expires) drop = k;
        sy.offers.splice(drop, 1);
      }
      terms = tvSyndTerms(f, t);
      sy.offers.push({ id: "tv" + (S.seq++), filmId: f.id, title: f.title, tier: t.id, advance: terms.advance, royalty: terms.royalty, wks: t.wks, expires: S.studio.week + 4 });
      /* rolling re-offers would spam the feed — log each film+tier combo once */
      if (sy.notified.indexOf(f.id + "|" + t.id) < 0) { sy.notified.push(f.id + "|" + t.id); logged++; }
    }
  }
  if (logged) log("Syndication: " + logged + " new package offer" + (logged > 1 ? "s" : "") + " on the desk.", "", "📦");
}

/* ── weekly tick (called after the engine's own systems) ──────── */
function tickTV() {
  if (!S || S.over) return;
  tvEnsure();
  if (S.tv.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.tv.lastTick = S.studio.week;
  tvTickStreamer();
  tvTickSeries();
  tvTickLive();
  tvTickSynd();
}

/* ── action dispatch (ui.js falls through here first) ─────────── */
function tvAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("tv-") !== 0) return false;
  tvEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var ok = true, desk = null, mut = false;
  switch (a) {
    case "tv-launch-streamer": ok = tvLaunchStreamer(); desk = "streamer"; mut = true; break;
    case "tv-license": ok = tvDoLicense(); desk = "streamer"; mut = true; break;
    case "tv-exclusive": ok = tvDoExclusive(); desk = "streamer"; mut = true; break;
    case "tv-shutdown": ok = tvDoShutdown(); desk = "streamer"; mut = true; break;
    case "tv-series-genre": if (key) SERIES_GL.genre = key; break;
    case "tv-series-tier": {
      var ti = parseInt(elx && elx.getAttribute ? elx.getAttribute("data-idx") : "", 10);
      if (isFinite(ti)) SERIES_GL.tier = clamp(ti, 0, TV_SERIES_TIERS.length - 1);
      break;
    }
    case "tv-series-confirm": ok = tvSeriesConfirm(); desk = "series"; mut = true; break;
    case "tv-series-renew": ok = tvSeriesRenew(id); desk = "series"; mut = true; break;
    case "tv-series-end": ok = tvSeriesEnd(id); desk = "series"; mut = true; break;
    case "tv-live-toggle": if (key && typeof LIVE_CFG[key] === "boolean") LIVE_CFG[key] = !LIVE_CFG[key]; break;
    case "tv-live-confirm": ok = tvLiveConfirm(); desk = "live"; mut = true; break;
    case "tv-live-refresh": ok = tvLiveRefresh(); desk = "live"; mut = true; break;
    case "tv-synd-accept": ok = tvSyndAccept(id); desk = "synd"; mut = true; break;
    case "tv-synd-decline": ok = tvSyndDecline(id); desk = "synd"; mut = true; break;
    default: return false;
  }
  if (mut) saveGame();
  render();
  if (desk) tvSheetRefresh(desk);
  return true;
}

/* Re-render the open TV desk sheet after an action (marker on the desk's root element). */
function tvSheetRefresh(kind) {
  if (typeof document === "undefined") return;
  var b = document.getElementById("sheetBody");
  if (!b || !b.firstElementChild) return;
  if (b.firstElementChild.getAttribute("data-tvdesk") !== kind) return;
  if (kind === "streamer") rerenderSheet(tvStreamerDesk());
  else if (kind === "series") rerenderSheet(tvSeriesDesk());
  else if (kind === "live") rerenderSheet(tvLiveDesk());
  else if (kind === "synd") rerenderSheet(tvSyndDesk());
}

/* ── desks ────────────────────────────────────────────────────── */
function tvStreamerDesk() {
  tvEnsure();
  var st = S.tv.streamer;
  var html = '<div data-tvdesk="streamer">';
  if (!st) {
    html += '<div class="card">'
      + '<div class="empty"><span class="em">📺</span>No streamer yet. Launch one for weekly subscription revenue — library licensing and exclusives grow the base.</div>'
      + '<div class="statrow"><span class="k">Platform</span><span class="v">' + esc(S.studio.name) + " TV</span></div>"
      + '<div class="statrow"><span class="k">Weekly upkeep once live</span><span class="v">' + fm(3) + "/wk</span></div>"
      + '<div class="btnrow"><button class="btn primary grow" data-action="tv-launch-streamer" ' + (S.studio.cash < 60 ? "disabled" : "") + ">Launch · " + fm(60) + " · cash after " + fm(S.studio.cash - 60) + "</button></div>"
      + "</div>";
  } else {
    var net = st.subs * 0.015 - 3;
    var lp = tvLicensePick();
    html += '<div class="card">'
      + '<div class="statrow"><span class="k">Platform</span><span class="v">' + esc(st.name) + "</span></div>"
      + '<div class="statrow"><span class="k">Subscribers</span><span class="v num">' + st.subs.toFixed(2) + "M</span></div>"
      + '<div class="statrow"><span class="k">Weekly net</span><span class="v num ' + (net >= 0 ? "up" : "down") + '">' + (net >= 0 ? "+" : "") + fm(net) + "</span></div>"
      + '<div class="statrow"><span class="k">Library titles · exclusives</span><span class="v">' + st.licensed + " · " + st.exclusives + "</span></div>"
      + "</div>"
      + '<div class="sechead"><h2>Actions</h2></div>'
      + '<div class="card">'
      + '<div class="statrow"><span class="k">' + (lp ? "License “" + esc(lp.film.title) + "” · " + fm(lp.cost) : "License a library title — no eligible film ($30M+ ww)") + "</span>"
      + '<button class="btn sm" data-action="tv-license" ' + (lp && S.studio.cash >= lp.cost ? "" : "disabled") + ">License</button></div>"
      + '<div class="statrow"><span class="k">Greenlight exclusive · ' + fm(25) + " (subs +2.9–3.5M)</span>"
      + '<button class="btn primary sm" data-action="tv-exclusive" ' + (S.studio.cash < 25 ? "disabled" : "") + ">Produce</button></div>"
      + '<div class="statrow"><span class="k">' + (st.pendingClose ? "Tap again — shutting down “" + esc(st.name) + "”" : "Shut down the streamer") + "</span>"
      + '<button class="btn danger sm" data-action="tv-shutdown">' + (st.pendingClose ? "Confirm" : "Shut down") + "</button></div>"
      + "</div>";
  }
  return html + "</div>";
}

function tvSeriesCard(sn) {
  var g = genreOf(sn.genre);
  var status = sn.phase === "prod" ? (6 - sn.wk) + " wk to premiere" : sn.phase === "air" ? "Episode " + (sn.eps + 1) + " of 8" : "Awaiting renewal decision";
  var html = '<div class="card film">'
    + '<div class="head"><div class="title">' + g.em + " " + esc(sn.name) + "</div>" + tag("Season " + sn.season, sn.phase === "air" ? "blue" : sn.phase === "renew" ? "gold" : "") + "</div>"
    + '<div class="meta">' + tag(g.name) + tag(fm(sn.budget) + " budget") + (sn.phase === "prod" ? tag("In production") : tag("Quality " + sn.quality, sn.quality >= 60 ? "green" : "")) + "</div>"
    + '<div class="statrow"><span class="k">Status</span><span class="v">' + status + "</span></div>";
  if (sn.phase === "prod") html += '<div class="statrow"><span class="k">Burn</span><span class="v">' + fm(sn.budget / 6) + "/wk</span></div>";
  if (sn.phase === "air") html += '<div class="statrow"><span class="k">Last rating</span><span class="v">' + (sn.rating != null ? sn.rating + "/100" : "—") + "</span></div>";
  if (sn.phase === "renew") {
    var cost = Math.round(sn.budget * 1.1 * 10) / 10;
    html += '<div class="btnrow">'
      + '<button class="btn primary sm grow" data-action="tv-series-renew" data-id="' + sn.id + '" ' + (S.studio.cash < cost ? "disabled" : "") + ">Renew · " + fm(cost) + "</button>"
      + '<button class="btn sm" data-action="tv-series-end" data-id="' + sn.id + '">End · catalog +' + fm(sn.budget * 0.4) + "</button>"
      + "</div>";
  }
  return html + "</div>";
}

function tvSeriesDesk() {
  tvEnsure();
  var html = '<div data-tvdesk="series">';
  if (!S.tv.series.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎞️</span>No series on the slate. Greenlight one below — 6 weeks of production, then 8 weekly episodes.</div></div>';
  } else {
    S.tv.series.forEach(function (sn) { html += tvSeriesCard(sn); });
  }
  var full = S.tv.series.length >= 3;
  var budget = TV_SERIES_TIERS[SERIES_GL.tier];
  html += '<div class="sechead"><h2>Greenlight a series</h2></div>'
    + '<div class="card">'
    + (full ? '<div class="statrow"><span class="k">Slate full — 3 concurrent series max</span><span class="v">3 / 3</span></div>' : "")
    + '<div class="field-label">Genre</div><div class="seg">';
  GENRES.forEach(function (g) {
    html += '<button class="' + (SERIES_GL.genre === g.id ? "on" : "") + '" data-action="tv-series-genre" data-key="' + g.id + '">' + g.em + " " + g.name + "</button>";
  });
  html += "</div>"
    + '<div class="field-label">Budget</div><div class="seg">';
  TV_SERIES_TIERS.forEach(function (b, i) {
    html += '<button class="' + (SERIES_GL.tier === i ? "on" : "") + '" data-action="tv-series-tier" data-idx="' + i + '">' + fm(b) + "</button>";
  });
  html += "</div>"
    + '<div class="statrow"><span class="k">Production</span><span class="v">6 wk · ' + fm(budget / 6) + "/wk</span></div>"
    + '<div class="statrow"><span class="k">Run</span><span class="v">8 episodes · up to ' + fm(budget * 0.15) + "/wk</span></div>"
    + '<div class="btnrow"><button class="btn primary grow" data-action="tv-series-confirm" ' + (full || S.studio.cash < budget ? "disabled" : "") + ">Greenlight · " + fm(budget) + " · cash after " + fm(S.studio.cash - budget) + "</button></div>"
    + "</div></div>";
  return html;
}

function tvLiveDesk() {
  tvEnsure();
  var lv = S.tv.live;
  var html = '<div data-tvdesk="live">';
  if (!lv) {
    var picked = tvLiveSelIds(), rate = 0, i;
    for (i = 0; i < TV_BLOCKS.length; i++) if (LIVE_CFG[TV_BLOCKS[i].id]) rate += TV_BLOCKS[i].rate;
    html += '<div class="card">'
      + '<div class="empty"><span class="em">📡</span>Launch a live TV network — ad revenue every week, but the audience drifts unless you refresh the lineup.</div>'
      + '<div class="field-label">Programming blocks — pick exactly 4</div><div class="seg">';
    TV_BLOCKS.forEach(function (b) {
      html += '<button class="' + (LIVE_CFG[b.id] ? "on" : "") + '" data-action="tv-live-toggle" data-key="' + b.id + '">' + b.name + " · " + b.rate.toFixed(2) + "</button>";
    });
    html += "</div>"
      + '<div class="statrow"><span class="k">Selected</span><span class="v">' + picked.length + " / 4 · rate " + rate.toFixed(2) + "</span></div>"
      + '<div class="statrow"><span class="k">Launch</span><span class="v">' + fm(80) + " · cash after " + fm(S.studio.cash - 80) + "</span></div>"
      + '<div class="btnrow"><button class="btn primary grow" data-action="tv-live-confirm" ' + (picked.length === 4 && S.studio.cash >= 80 ? "" : "disabled") + ">Sign on · " + fm(80) + "</button></div>"
      + "</div>";
  } else {
    html += '<div class="card">'
      + '<div class="statrow"><span class="k">Channel</span><span class="v">' + esc(lv.name) + "</span></div>"
      + '<div class="statrow"><span class="k">Audience</span><span class="v num">' + lv.audience.toFixed(2) + "×</span></div>"
      + '<div class="statrow"><span class="k">Weekly ad revenue</span><span class="v num up">+' + fm(tvLiveRateSum(lv) * 1.2 * lv.audience) + "</span></div>"
      + '<div class="statrow"><span class="k">Drift</span><span class="v">−1.5%/wk · refresh +0.08×</span></div>'
      + '<div class="meta">';
    TV_BLOCKS.forEach(function (b) { if (lv.blocks[b.id]) html += tag(b.name); });
    html += "</div></div>"
      + '<div class="sechead"><h2>Actions</h2></div>'
      + '<div class="card">'
      + '<div class="statrow"><span class="k">Refresh lineup · ' + fm(4) + " — audience +0.08×</span>"
      + '<button class="btn sm" data-action="tv-live-refresh" ' + (S.studio.cash < 4 || lv.audience >= 1.2 ? "disabled" : "") + ">Refresh</button></div>"
      + "</div>";
  }
  return html + "</div>";
}

function tvSyndDesk() {
  tvEnsure();
  var sy = S.tv.synd;
  var html = '<div data-tvdesk="synd">';
  /* package legend — gates and terms always visible */
  html += '<div class="card">';
  TV_SYND_TIERS.forEach(function (t) {
    html += '<div class="statrow"><span class="k">' + t.name + " · " + t.wks + " wks</span><span class=\"v\">advance ×" + t.advMult + " · royalty ×" + t.royMult + "</span></div>"
      + '<div class="statrow"><span class="k">Gate</span><span class="v">ww ≥ ' + fm(t.minWw) + " or critics ≥ " + t.minCrit + "%</span></div>";
  });
  html += "</div>";
  /* open offers, grouped by tier */
  var any = false;
  TV_SYND_TIERS.forEach(function (t) {
    var rows = sy.offers.filter(function (o) { return o.tier === t.id; });
    if (!rows.length) return;
    any = true;
    html += '<div class="sechead"><h2>' + t.name + " · " + t.wks + " wks</h2></div>";
    rows.forEach(function (o) {
      var left = Math.max(0, o.expires - S.studio.week);
      html += '<div class="card film">'
        + '<div class="head"><div class="title">📦 ' + esc(o.title) + "</div>" + tag(left + " wk to expire", left <= 1 ? "red" : "") + "</div>"
        + '<div class="statrow"><span class="k">Advance (now)</span><span class="v num up">+' + fm(o.advance) + "</span></div>"
        + '<div class="statrow"><span class="k">Royalty</span><span class="v">' + o.royalty.toFixed(2) + "M/wk · " + o.wks + " wks</span></div>"
        + '<div class="btnrow">'
        + '<button class="btn primary sm grow" data-action="tv-synd-accept" data-id="' + o.id + '">Accept</button>'
        + '<button class="btn sm" data-action="tv-synd-decline" data-id="' + o.id + '">Decline</button>'
        + "</div></div>";
    });
  });
  if (!any) html += '<div class="card"><div class="empty"><span class="em">📦</span>No offers right now. Finished films draw package offers once they clear a tier gate — worldwide gross or critics.</div></div>';
  if (sy.deals.length) {
    html += '<div class="sechead"><h2>Active deals</h2></div><div class="card">';
    sy.deals.forEach(function (d) {
      var t = tvSyndTier(d.tier);
      html += '<div class="statrow"><span class="k">' + esc(d.title) + "</span><span class=\"v\">" + (t ? t.name : d.tier) + " · " + d.weekly.toFixed(2) + "M/wk · " + Math.max(0, d.until - S.studio.week) + " wk left</span></div>";
    });
    html += "</div>";
  }
  if (sy.archived.length) {
    html += '<div class="sechead"><h2>Syndicated library</h2></div><div class="card">';
    sy.archived.slice(0, 12).forEach(function (d) {
      var t = tvSyndTier(d.tier);
      html += '<div class="statrow"><span class="k">' + esc(d.title) + "</span><span class=\"v\">" + (t ? t.name : d.tier) + " · run complete</span></div>";
    });
    html += "</div>";
  }
  return html + "</div>";
}

var TV_DESKS = [
  { id: "tv-streamer", group: "TV & Streaming", icon: "📺", name: "Streaming platform", desc: "Launch your own streamer — license library titles and produce exclusives to grow subscribers.", render: tvStreamerDesk },
  { id: "tv-series", group: "TV & Streaming", icon: "🎞️", name: "Series studio", desc: "Greenlight episodic series — 6 weeks of production, then 8 weekly episodes and a renewal decision.", render: tvSeriesDesk },
  { id: "tv-live", group: "TV & Streaming", icon: "📡", name: "Live network", desc: "Run a live TV channel — pick 4 programming blocks and refresh the lineup to hold the audience.", render: tvLiveDesk },
  { id: "tv-synd", group: "TV & Streaming", icon: "📦", name: "Syndication", desc: "Package-tier licensing offers for your finished films — Primetime, Matinee and Cable cult; take the advance, bank the weekly royalty for the run.", render: tvSyndDesk }
];

/* Wiring lives in engine.js (tickTV) and ui.js (tvAction + desk shell) — no self-wiring needed. */

/* ── forecast hook (engine.js forecastAdjust) ──────────────────
   tv.js earns real recurring cash on the weekly tick: streamer subscriptions,
   live ad revenue and the syndication royalty tail. None of it appeared in the
   12-week cashflow forecast, because this hook never existed — ui.js's old
   aggregator named forecastAdjust_tv but nothing defined it. Returning the
   actual weekly numbers keeps the projection honest. */
function forecastAdjust_tv(weekAbs) {
  if (!S || !S.tv) return 0;
  var n = 0, i, st = S.tv.streamer;
  if (st) {
    /* mirror tvTickStreamer's earn line, using the subscriber count it will have */
    var nextSubs = Math.max(0.1, st.subs * 0.98 + 0.02 * st.licensed + 0.05 * st.exclusives + 0.01);
    n += nextSubs * 0.015 - 3;                 /* subscription income less streamer upkeep */
  }
  if (S.tv.synd && S.tv.synd.deals) {
    for (i = 0; i < S.tv.synd.deals.length; i++) {
      if (weekAbs >= S.tv.synd.deals[i].until) continue;   /* deal ends before that week */
      n += S.tv.synd.deals[i].weekly;
    }
  }
  return n;
}
