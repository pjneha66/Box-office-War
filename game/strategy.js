/* Box Office War — rebuilt. Strategy module — all state under S.strat.
   Systems: dynamic ticket pricing (per-release strategy) · streaming wars (3 rival
   platforms + CinePass tier) · co-production market · IP marketplace · local-language
   divisions. Desks: strat-pricing / strat-wars / strat-divisions (group "Strategy").
   Engine hooks defined here (typeof-guarded on the engine side):
   - ticketPricingMult(p) → opening mult for the project's pricing strategy (live in
     engine expectedOpening). The aud/legs deltas are stored on the project as
     p.pricingAud / p.pricingLegs — NOTE for integrator: engine releaseFilm must add
     p.pricingAud into the aud clamp line and p.pricingLegs into the legs line (plain
     field reads, same pattern as creativeProjectMods). This module does not edit engine.js.
   - forecastAdjust(weekAbs) → recurring weekly net from divisions + CinePass.
     NOTE: several modules define this global (ott/games/library/finance) — the engine
     calls whichever loaded last; finance.js currently zeroes it. Integrator decides order.
   Cross-module state: this module MUTATES S.tv.streamer.subs only (guarded
   if (S.tv && S.tv.streamer)) — poach damage, war bonus and CinePass deltas are logged.
   "rivals avg" for the war bonus = average of the rival platforms' war scores (poach
   count each), so it compares like with like against my S.strat.warScore (my exclusives). */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
/* Ticket pricing: open mult applies via ticketPricingMult at release; aud is a point
   add on the 0–100 audience score, legs a flat add (integrator wiring, see header).
   family "+0.05 aud" in the spec is read as +5 points on the 0–100 aud scale. */
var STRAT_PRICING = [
  { id: "standard", name: "Standard",  open: 1,    aud: 0,  legs: 0 },
  { id: "family",   name: "Family",    open: 0.95, aud: 5,  legs: 0 },
  { id: "peak",     name: "Peak",      open: 1.08, aud: 0,  legs: -0.1 },
  { id: "premium",  name: "Premium",   open: 1.15, aud: -2, legs: -0.15 }
];
var STRAT_STREAMERS = [
  { name: "StreamFlix Prime", subs: 25 },
  { name: "MaxxPlus",         subs: 18 },
  { name: "Disneyar2",        subs: 12 }
];
var STRAT_IP = [
  { id: "book",   title: "The Underground Bestseller", genre: "drama" },
  { id: "comic",  title: "Cult Graphic Novel",         genre: "scifi" },
  { id: "legacy", title: "80s Cartoon Revival",        genre: "animation" }
];
var IP_REST_WEEKS = 3;   /* a bought license re-enters rotation after this many weeks */
var STRAT_DIVISIONS = [
  { id: "bollywood", name: "Bollywood wing", cost: 45 },
  { id: "nollywood", name: "Nollywood wing", cost: 35 },
  { id: "korean",    name: "Korean wing",    cost: 50 }
];
var STRAT_DIV_CHANCE = 0.12;   /* weekly chance a division produces a regional hit idea */

/* Desk-local UI state (not saved — same pattern as SERIES_GL in tv.js). */
var STRAT_GL = { coproP: null, coproR: 0 };

/* ── state (lazy ensure — old saves have no S.strat) ──────────── */
function stratEnsure() {
  if (!S.strat) {
    S.strat = {
      lastTick: 0,
      warScore: 0,
      nextPoach: S.studio.week + ri(8, 12),
      rivals: [],
      cinePass: false,
      divisions: [],
      ip: { offers: {} },
      coproWatch: [],
      coproPaid: []
    };
    var i;
    for (i = 0; i < STRAT_STREAMERS.length; i++) {
      S.strat.rivals.push({ name: STRAT_STREAMERS[i].name, subs: STRAT_STREAMERS[i].subs, wscore: 0 });
    }
    for (i = 0; i < STRAT_IP.length; i++) {
      S.strat.ip.offers[STRAT_IP[i].id] = { price: ri(8, 20), soldWeek: -1 };
    }
  }
  if (!S.strat.rivals) S.strat.rivals = [];
  if (!S.strat.ip) S.strat.ip = { offers: {} };
  if (!S.strat.ip.offers) S.strat.ip.offers = {};
  if (!S.strat.coproWatch) S.strat.coproWatch = [];
  if (!S.strat.coproPaid) S.strat.coproPaid = [];
  if (!S.strat.divisions) S.strat.divisions = [];
  /* every project carries pricing fields from birth so the release math reads them */
  var j;
  for (j = 0; j < S.projects.length; j++) {
    if (!S.projects[j].pricing) { S.projects[j].pricing = "standard"; S.projects[j].pricingAud = 0; S.projects[j].pricingLegs = 0; }
  }
}

/* ── 1 · dynamic ticket pricing ───────────────────────────────── */
function stratPriceDef(id) {
  var i;
  for (i = 0; i < STRAT_PRICING.length; i++) if (STRAT_PRICING[i].id === id) return STRAT_PRICING[i];
  return null;
}

function ticketPricingMult(p) {
  if (!p || !p.pricing) return 1;
  var d = stratPriceDef(p.pricing);
  return d ? d.open : 1;
}

function stratSetPrice(p, id) {
  var d = stratPriceDef(id);
  if (!d || !p) return false;
  p.pricing = d.id;
  p.pricingAud = d.aud;
  p.pricingLegs = d.legs;
  return true;
}

/* ── 2 · streaming wars ───────────────────────────────────────── */
function stratRivalAvgScore() {
  var sum = 0, i;
  for (i = 0; i < S.strat.rivals.length; i++) sum += S.strat.rivals[i].wscore;
  return sum / Math.max(1, S.strat.rivals.length);
}

function stratLeader() {
  var best = S.strat.rivals[0], i;
  for (i = 1; i < S.strat.rivals.length; i++) if (S.strat.rivals[i].subs > best.subs) best = S.strat.rivals[i];
  return best;
}

function stratTickWars() {
  var i;
  for (i = 0; i < S.strat.rivals.length; i++) {
    S.strat.rivals[i].subs = Math.round(S.strat.rivals[i].subs * 1.02 * 100) / 100;
  }
  if (S.studio.week >= S.strat.nextPoach) {
    S.strat.nextPoach = S.studio.week + ri(8, 12);
    if (S.tv && S.tv.streamer) {
      var poacher = stratLeader(), st = S.tv.streamer;
      var lost = Math.round(st.subs * 0.07 * 100) / 100;
      st.subs = Math.round(st.subs * 0.93 * 100) / 100;
      poacher.wscore++;
      log("⚔️ " + poacher.name + " poaches " + fm(lost) + " subscribers from " + st.name + " with a lavish new exclusive.", "bad", "⚔️");
    }
  }
  /* war momentum: while my war score leads the rivals' average, my streamer grows +0.02M/wk */
  if (S.tv && S.tv.streamer && S.strat.warScore > stratRivalAvgScore()) {
    S.tv.streamer.subs = Math.round((S.tv.streamer.subs + 0.02) * 100) / 100;
  }
}

function stratExclusive() {
  if (!S.tv || !S.tv.streamer) { toast("Launch a streamer first (TV & Streaming desk).", "bad"); return false; }
  var st = S.tv.streamer;
  if (S.studio.cash < 25) { toast("Need " + fm(25) + " for a war exclusive.", "bad"); return false; }
  spend(25, "War exclusive · " + st.name);
  st.subs = Math.round((st.subs + 1.5) * 100) / 100;
  S.strat.warScore++;
  log("⚔️ " + st.name + " drops a war exclusive — +1.5M subscribers overnight. War score " + S.strat.warScore + ".", "good", "⚔️");
  toast("War exclusive live — subscribers +1.5M.", "good");
  return true;
}

/* ── 3 · CinePass subscription tier ───────────────────────────── */
function stratCinePassSetup() {
  if (!S.tv || !S.tv.streamer) { toast("CinePass needs your own streamer first.", "bad"); return false; }
  if (S.strat.cinePass) return false;
  if (S.studio.cash < 30) { toast("Need " + fm(30) + " to set up CinePass.", "bad"); return false; }
  spend(30, "CinePass setup");
  S.strat.cinePass = true;
  log("🎟️ CinePass launches on " + S.tv.streamer.name + " — faster growth and a weekly per-subscriber fee, at the cost of churn.", "gold", "🎟️");
  toast("CinePass is live.", "good");
  return true;
}

/* Own-line weekly effect (tv.js math untouched): +30% on the streamer's organic inflow
   (mirrored from its public licensed/exclusives fields), churn ×1.3 on its 2% base,
   and subs × 0.02/wk extra earn. */
function stratTickCinePass() {
  if (!S.strat.cinePass || !S.tv || !S.tv.streamer) return;
  var st = S.tv.streamer;
  var inflow = 0.02 * (st.licensed || 0) + 0.05 * (st.exclusives || 0) + 0.01;
  st.subs = Math.max(0.1, Math.round((st.subs + inflow * 0.3 - st.subs * 0.02 * 0.3) * 100) / 100);
  earn(st.subs * 0.02, "CinePass · " + st.name);
}

/* ── 4 · co-production market ─────────────────────────────────── */
function stratCoproOffer(projId) {
  var p = findProject(projId);
  if (!p || (p.scale !== "tentpole") || (p.phase !== "pre" && p.phase !== "shoot")) { toast("Pick a tentpole in pre-production or shooting.", "bad"); return false; }
  if (p.coprod) { toast("“" + p.title + "” already has a co-production partner.", ""); return false; }
  var rival = S.rivals[STRAT_GL.coproR];
  if (!rival) return false;
  var share = Math.round(rf(0.4, 0.5) * 100) / 100;
  var offer = Math.round(p.budgetNow * share * 10) / 10;
  if (rival.power * 20 > offer) {
    earn(offer, "Co-production · " + p.title + " · " + rival.name);
    p.coprod = { rival: rival.name, share: share, bought: offer };
    S.strat.coproWatch.push({ pId: p.id, title: p.title, rival: rival.name, share: share, bought: offer });
    log("🤝 " + rival.name + " co-finances " + Math.round(share * 100) + "% of “" + p.title + "” — " + fm(offer) + " lands now; they take that share of the profit at the end of the run.", "gold", "🤝");
    toast(rival.name + " is aboard the co-production.", "good");
  } else {
    log(rival.name + " passes on co-financing “" + p.title + "” — the " + fm(offer) + " ticket is too rich for them.", "", "🤝");
    toast(rival.name + " declined the co-production offer.", "");
  }
  return true;
}

/* Released films lose their project object, so settlement watches by title: the first
   finished (done) film with a watched title that hasn't been paid out yet settles it. */
function stratTickCopro() {
  var i, j, f, w, paid;
  for (i = S.strat.coproWatch.length - 1; i >= 0; i--) {
    w = S.strat.coproWatch[i];
    paid = -1;
    for (j = 0; j < S.films.length; j++) {
      f = S.films[j];
      if (f.title === w.title && f.status === "done" && f.profit != null && S.strat.coproPaid.indexOf(f.id) < 0) { paid = j; break; }
    }
    if (paid < 0) continue;
    f = S.films[paid];
    S.strat.coproPaid.push(f.id);
    S.strat.coproWatch.splice(i, 1);
    if (f.profit > 0) {
      var cut = Math.round(f.profit * w.share * 10) / 10;
      spend(cut, "Co-pro partner payout · " + f.title);
      log("🤝 " + w.rival + " collects their " + Math.round(w.share * 100) + "% share of “" + f.title + "”'s profit — " + fm(cut) + " paid out.", "bad", "🤝");
    } else if (f.profit < 0) {
      var cover = Math.min(Math.round(-f.profit * w.share * 10) / 10, w.bought);
      earn(cover, "Co-pro loss cover · " + f.title);
      log("🤝 " + w.rival + " covers their share of “" + f.title + "”'s loss — " + fm(cover) + " recovered.", "good", "🤝");
    }
  }
}

/* ── 5 · IP marketplace ───────────────────────────────────────── */
function stratIpBuy(id) {
  var i, lic = null;
  for (i = 0; i < STRAT_IP.length; i++) if (STRAT_IP[i].id === id) lic = STRAT_IP[i];
  if (!lic) return false;
  var o = S.strat.ip.offers[lic.id];
  if (!o || o.soldWeek >= 0) { toast("That license is off the shelf — it rotates back.", ""); return false; }
  if (S.studio.cash < o.price) { toast("Need " + fm(o.price) + " for the " + lic.title + " license.", "bad"); return false; }
  spend(o.price, "IP license · " + lic.title);
  o.soldWeek = S.studio.week;
  var script = ri(78, 90);
  S.ideas.unshift({
    id: "i" + (S.seq++), title: lic.title, genre: lic.genre, script: script,
    price: 0, born: S.studio.week, theme: null, franchiseOf: null, ip: lic.id
  });
  log("📚 Licensed “" + lic.title + "” for " + fm(o.price) + " — a hot script (" + script + ") is on the development desk at no extra cost.", "gold", "📚");
  toast("IP licensed — script on the desk.", "good");
  return true;
}

function stratTickIp() {
  var i, o;
  for (i = 0; i < STRAT_IP.length; i++) {
    o = S.strat.ip.offers[STRAT_IP[i].id];
    if (!o) continue;
    if (o.soldWeek >= 0 && S.studio.week - o.soldWeek >= IP_REST_WEEKS) o.soldWeek = -1;
    if (o.soldWeek < 0) o.price = ri(8, 20); /* weekly rotation re-prices the shelf */
  }
}

/* ── 6 · local-language divisions ─────────────────────────────── */
function stratDivLaunch(id) {
  var i, d = null;
  for (i = 0; i < STRAT_DIVISIONS.length; i++) if (STRAT_DIVISIONS[i].id === id) d = STRAT_DIVISIONS[i];
  if (!d) return false;
  if (S.strat.divisions.length >= 2) { toast("Two regional wings max — the lot is full.", "bad"); return false; }
  for (i = 0; i < S.strat.divisions.length; i++) if (S.strat.divisions[i].id === d.id) return false;
  if (S.studio.cash < d.cost) { toast("Need " + fm(d.cost) + " to launch the " + d.name + ".", "bad"); return false; }
  spend(d.cost, "Division launch · " + d.name);
  S.strat.divisions.push({ id: d.id, name: d.name, born: S.studio.week, hits: 0 });
  log("🌏 The " + d.name + " opens — regional development starts this week (catalog trickle +$0.3M/wk).", "gold", "🌏");
  toast(d.name + " launched.", "good");
  return true;
}

function stratTickDivisions() {
  var i, d;
  for (i = 0; i < S.strat.divisions.length; i++) {
    d = S.strat.divisions[i];
    earn(0.3, "Division catalog · " + d.name);
    if (chance(STRAT_DIV_CHANCE)) {
      var script = ri(65, 85);
      var idea = {
        id: "i" + (S.seq++), title: genTitle(), genre: pick(GENRES).id, script: script,
        price: Math.round((0.4 + script * 0.028) * 10) / 10, born: S.studio.week,
        theme: null, franchiseOf: null, division: true
      };
      S.ideas.unshift(idea);
      d.hits++;
      log("🌏 The " + d.name + " uncovers a regional hit — “" + idea.title + "” (script " + script + ") joins the development desk.", "good", "🌏");
    }
  }
}

/* ── engine hook: 12-week forecast contribution ───────────────── */
function forecastAdjust_strategy(weekAbs) {
  if (!S || !S.strat) return 0;
  var sum = S.strat.divisions.length * 0.3;
  if (S.strat.cinePass && S.tv && S.tv.streamer) sum += S.tv.streamer.subs * 0.02;
  return sum;
}

/* ── weekly tick ──────────────────────────────────────────────── */
function tickStrategy() {
  if (!S || S.over) return;
  stratEnsure();
  if (S.strat.lastTick === S.studio.week) return; /* idempotent per week */
  S.strat.lastTick = S.studio.week;
  stratTickWars();
  stratTickCinePass();
  stratTickDivisions();
  stratTickIp();
  stratTickCopro();
}

/* ── action dispatch (ui.js falls through to strategyAction) ──── */
function strategyAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("strat-") !== 0) return false;
  stratEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var ok = true, desk = null;
  switch (a) {
    case "strat-price": {
      var p = findProject(id);
      ok = p ? stratSetPrice(p, key) : false;
      desk = "pricing";
      break;
    }
    case "strat-exclusive": ok = stratExclusive(); desk = "wars"; break;
    case "strat-cinepass": ok = stratCinePassSetup(); desk = "wars"; break;
    case "strat-copro-pick": STRAT_GL.coproP = id; break;
    case "strat-copro-rival": {
      var ri2 = parseInt(key, 10);
      if (isFinite(ri2)) STRAT_GL.coproR = clamp(ri2, 0, S.rivals.length - 1);
      break;
    }
    case "strat-copro-offer": ok = stratCoproOffer(STRAT_GL.coproP); desk = "wars"; break;
    case "strat-ip-buy": ok = stratIpBuy(key); desk = "divisions"; break;
    case "strat-div-launch": ok = stratDivLaunch(key); desk = "divisions"; break;
    default: return false;
  }
  saveGame();
  if (typeof render === "function") render();
  if (desk) stratSheetRefresh(desk);
  return true;
}

/* Re-render the open Strategy desk sheet after an action (marker on the desk's root). */
function stratSheetRefresh(kind) {
  if (typeof document === "undefined") return;
  var b = document.getElementById("sheetBody");
  if (!b || !b.firstElementChild) return;
  if (b.firstElementChild.getAttribute("data-stratdesk") !== kind) return;
  if (kind === "pricing") rerenderSheet(stratPricingDesk());
  else if (kind === "wars") rerenderSheet(stratWarsDesk());
  else if (kind === "divisions") rerenderSheet(stratDivisionsDesk());
}

/* ── desks ────────────────────────────────────────────────────── */
function stratPricingDesk() {
  stratEnsure();
  var html = '<div data-stratdesk="pricing">';
  var ready = [], i, p;
  for (i = 0; i < S.projects.length; i++) if (S.projects[i].phase === "ready") ready.push(S.projects[i]);
  if (!ready.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎟️</span>No finished films waiting. Strategies are set per release once a project wraps post-production.</div></div>';
  }
  for (i = 0; i < ready.length; i++) {
    p = ready[i];
    var d = stratPriceDef(p.pricing) || STRAT_PRICING[0];
    html += '<div class="card film">'
      + '<div class="head"><div class="title">🎟️ ' + esc(p.title) + "</div>" + tag(d.name, p.pricing === "standard" ? "" : "blue") + "</div>"
      + '<div class="meta">' + tag(scaleOf(p.scale).name) + tag(genreOf(p.genre).name) + "</div>"
      + '<div class="statrow"><span class="k">Current strategy</span><span class="v">Opening ×' + d.open.toFixed(2)
      + (d.aud ? " · aud " + (d.aud > 0 ? "+" : "") + d.aud : "") + (d.legs ? " · legs " + d.legs.toFixed(2) : "") + "</span></div>"
      + '<div class="field-label">Ticket pricing</div><div class="seg">';
    var j;
    for (j = 0; j < STRAT_PRICING.length; j++) {
      html += '<button class="' + (p.pricing === STRAT_PRICING[j].id ? "on" : "") + '" data-action="strat-price" data-id="' + p.id + '" data-key="' + STRAT_PRICING[j].id + '">' + STRAT_PRICING[j].name + "</button>";
    }
    html += "</div>"
      + '<div class="statrow"><span class="k">Family · matinee pricing</span><span class="v">×0.95 open · aud +5</span></div>'
      + '<div class="statrow"><span class="k">Peak · weekend surge</span><span class="v">×1.08 open · legs −0.10</span></div>'
      + '<div class="statrow"><span class="k">Premium · big format</span><span class="v">×1.15 open · legs −0.15 · aud −2</span></div>'
      + "</div>";
  }
  html += '<div class="card"><div class="statrow"><span class="k">Opening effect</span><span class="v">live via ticketPricingMult</span></div>'
    + '<div class="statrow"><span class="k">Audience &amp; legs effects</span><span class="v">stored on the project for the release math</span></div></div>';
  return html + "</div>";
}

function stratWarsDesk() {
  stratEnsure();
  var html = '<div data-stratdesk="wars">';
  html += '<div class="card">';
  var i;
  for (i = 0; i < S.strat.rivals.length; i++) {
    var r = S.strat.rivals[i];
    html += '<div class="statrow"><span class="k">' + esc(r.name) + '</span><span class="v num">' + r.subs.toFixed(1) + "M subs · war " + r.wscore + "</span></div>";
  }
  if (S.tv && S.tv.streamer) {
    var st = S.tv.streamer;
    html += '<div class="statrow"><span class="k"><b>' + esc(st.name) + " (yours)</b></span><span class=\"v num up\"><b>" + st.subs.toFixed(2) + "M subs</b></span></div>"
      + '<div class="statrow"><span class="k">My war score</span><span class="v">' + S.strat.warScore + " (rivals avg " + stratRivalAvgScore().toFixed(1) + (S.strat.warScore > stratRivalAvgScore() ? " — momentum +" : "") + ")</span></div>";
  } else {
    html += '<div class="statrow"><span class="k">Your platform</span><span class="v">none — launch one on the TV desk</span></div>';
  }
  html += '<div class="statrow"><span class="k">Next market attack</span><span class="v">around week ' + S.strat.nextPoach + " (" + Math.max(0, S.strat.nextPoach - S.studio.week) + " wk away)</span></div>";
  html += "</div>";
  html += '<div class="sechead"><h2>War actions</h2></div><div class="card">';
  if (S.tv && S.tv.streamer) {
    html += '<div class="statrow"><span class="k">War exclusive · ' + fm(25) + " — subs +1.5M, war score +1</span>"
      + '<button class="btn primary sm" data-action="strat-exclusive" ' + (S.studio.cash < 25 ? "disabled" : "") + ">Drop</button></div>";
    if (S.strat.cinePass) {
      html += '<div class="statrow"><span class="k">CinePass active</span><span class="v num up">+' + fm(S.tv.streamer.subs * 0.02) + "/wk fee</span></div>";
    } else {
      html += '<div class="statrow"><span class="k">CinePass tier · ' + fm(30) + " — +30% growth, subs fee, churn ×1.3</span>"
        + '<button class="btn sm" data-action="strat-cinepass" ' + (S.studio.cash < 30 ? "disabled" : "") + ">Set up</button></div>";
    }
  } else {
    html += '<div class="statrow"><span class="k">War actions need your own streamer</span><span class="v">TV &amp; Streaming desk</span></div>';
  }
  html += "</div>";
  /* co-production market */
  html += '<div class="sechead"><h2>Co-production market</h2></div>';
  var tents = [], j;
  for (j = 0; j < S.projects.length; j++) {
    if (S.projects[j].scale === "tentpole" && (S.projects[j].phase === "pre" || S.projects[j].phase === "shoot") && !S.projects[j].coprod) tents.push(S.projects[j]);
  }
  if (!tents.length) {
    html += '<div class="card"><div class="empty"><span class="em">🤝</span>No tentpole in pre-production or shooting. Partners co-finance 40–50% of the remaining budget and take that share of the profit.</div></div>';
  } else {
    html += '<div class="card">'
      + '<div class="field-label">Project</div><div class="seg">';
    for (j = 0; j < tents.length; j++) {
      html += '<button class="' + (STRAT_GL.coproP === tents[j].id || (!STRAT_GL.coproP && j === 0) ? "on" : "") + '" data-action="strat-copro-pick" data-id="' + tents[j].id + '">' + esc(tents[j].title) + "</button>";
    }
    html += "</div>"
      + '<div class="field-label">Partner</div><div class="seg">';
    for (j = 0; j < S.rivals.length; j++) {
      html += '<button class="' + (STRAT_GL.coproR === j ? "on" : "") + '" data-action="strat-copro-rival" data-key="' + j + '">' + esc(S.rivals[j].name) + " ×" + S.rivals[j].power.toFixed(2) + "</button>";
    }
    html += "</div>";
    var sel = STRAT_GL.coproP ? findProject(STRAT_GL.coproP) : tents[0];
    if (sel) {
      html += '<div class="statrow"><span class="k">Remaining budget</span><span class="v num">' + fm(sel.budgetNow) + "</span></div>"
        + '<div class="statrow"><span class="k">Co-finance ask</span><span class="v">40–50% ≈ ' + fm(sel.budgetNow * 0.45) + " (refund now, profit share later)</span></div>"
        + '<div class="statrow"><span class="k">Partner appetite ceiling</span><span class="v">power ×20 = ' + fm(S.rivals[STRAT_GL.coproR].power * 20) + "</span></div>"
        + '<div class="btnrow"><button class="btn primary grow" data-action="strat-copro-offer">Offer the deal</button></div>';
    }
    html += "</div>";
  }
  for (j = 0; j < S.projects.length; j++) {
    if (S.projects[j].coprod) {
      html += '<div class="card"><div class="statrow"><span class="k">🤝 ' + esc(S.projects[j].title) + "</span><span class=\"v\">"
        + esc(S.projects[j].coprod.rival) + " · " + Math.round(S.projects[j].coprod.share * 100) + "% · paid " + fm(S.projects[j].coprod.bought) + "</span></div></div>";
    }
  }
  return html + "</div>";
}

function stratDivisionsDesk() {
  stratEnsure();
  var html = '<div data-stratdesk="divisions">';
  html += '<div class="sechead"><h2>Local divisions</h2></div>';
  var i, j;
  for (i = 0; i < S.strat.divisions.length; i++) {
    var d = S.strat.divisions[i];
    html += '<div class="card"><div class="head"><div class="title">🌏 ' + esc(d.name) + "</div>" + tag("Since wk " + d.born, "green") + "</div>"
      + '<div class="statrow"><span class="k">Weekly catalog trickle</span><span class="v num up">+$0.3M</span></div>'
      + '<div class="statrow"><span class="k">Regional hits found</span><span class="v">' + d.hits + " · " + Math.round(STRAT_DIV_CHANCE * 100) + "% chance/wk</span></div></div>";
  }
  var full = S.strat.divisions.length >= 2;
  if (full) {
    html += '<div class="card"><div class="statrow"><span class="k">Wings full — 2 regional divisions max</span><span class="v">2 / 2</span></div></div>';
  } else {
    html += '<div class="card"><div class="field-label">Launch a wing · max 2</div>';
    for (j = 0; j < STRAT_DIVISIONS.length; j++) {
      var dv = STRAT_DIVISIONS[j], owned = false;
      for (i = 0; i < S.strat.divisions.length; i++) if (S.strat.divisions[i].id === dv.id) owned = true;
      if (owned) continue;
      html += '<div class="statrow"><span class="k">' + esc(dv.name) + " · " + fm(dv.cost) + " — hits + trickle</span>"
        + '<button class="btn primary sm" data-action="strat-div-launch" data-key="' + dv.id + '" ' + (S.studio.cash < dv.cost ? "disabled" : "") + ">Launch</button></div>";
    }
    html += '<div class="statrow"><span class="k">Cash after next launch</span><span class="v num">' + fm(S.studio.cash) + "</span></div></div>";
  }
  html += '<div class="sechead"><h2>IP marketplace</h2></div><div class="card">';
  for (j = 0; j < STRAT_IP.length; j++) {
    var lic = STRAT_IP[j], o = S.strat.ip.offers[lic.id];
    if (o.soldWeek >= 0) {
      html += '<div class="statrow"><span class="k">📚 ' + esc(lic.title) + "</span><span class=\"v\">licensed — back in " + Math.max(1, IP_REST_WEEKS - (S.studio.week - o.soldWeek)) + " wk</span></div>";
    } else {
      html += '<div class="statrow"><span class="k">📚 ' + esc(lic.title) + " · " + genreOf(lic.genre).name + " · script 78–90 · " + fm(o.price) + "</span>"
        + '<button class="btn sm" data-action="strat-ip-buy" data-key="' + lic.id + '" ' + (S.studio.cash < o.price ? "disabled" : "") + ">License</button></div>";
    }
  }
  html += '<div class="statrow"><span class="k">Shelf</span><span class="v">re-priced weekly · bought licenses rotate back</span></div></div>';
  return html + "</div>";
}

var STRATEGY_DESKS = [
  { id: "strat-pricing", group: "Strategy", icon: "🎟️", name: "Pricing strategies",
    desc: "Set a ticket-pricing strategy per finished film — family matinees, peak weekends or premium formats trade opening against audience and legs.",
    render: stratPricingDesk },
  { id: "strat-wars", group: "Strategy", icon: "⚔️", name: "Streaming wars",
    desc: "Three rival platforms grow weekly and poach your subscribers — fight back with war exclusives, CinePass and tentpole co-financing.",
    render: stratWarsDesk },
  { id: "strat-divisions", group: "Strategy", icon: "🌏", name: "Local divisions",
    desc: "Regional wings surface local-language hits weekly, and the IP marketplace rotates licensed properties onto the development desk.",
    render: stratDivisionsDesk }
];

/* Wiring lives in engine.js (tickStrategy) and ui.js (strategyAction + desk shell) — no self-wiring. */
