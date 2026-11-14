/* Box Office War — rebuilt. Deal-making module (bizdeal, wave 5).
   Rival negotiations: relations (-100..100), gift dinners, joint press days,
   star swaps and 26-week non-aggression pacts (rival poaching blocked,
   friendlier release weekends). Screen-count deals: one negotiated tier per
   ready film — opening mult is live via screenCountMult(p); the legs/rental
   side effects travel as p.screenLegs / p.screenRental fields (release-time
   wiring is the integrator's: add `if (p.screenLegs) legs += p.screenLegs;`
   in releaseFilm and apply p.screenRental to that film's rental share).
   Regional reputation: EU / APAC / CN (0-100, start 10) grow +4 per done film
   by genre and lift the biz.js territory presale offers via dealRegionalMult
   (×0.8-1.2). All state under S.deal (lazy ensure).
   Engine hooks already live: rivalDealClash(rivalName) · hasPactWith(rivalName)
   · screenCountMult(p). Weekly beat: tickBizdeal() — engine.js does not call
   it yet, so dealCatchUp() also applies elapsed weeks on desk/action contact,
   guarded by S.deal.lastTick so it never double-applies once wired.
   ui.js already bridges bizdealAction() and concatenates BIZDEAL_DESKS. */
"use strict";

/* ── state (lazy ensure — old saves have no S.deal) ───────────── */
function dealEnsure() {
  if (!S) return;
  if (!S.deal) S.deal = { rel: {}, pacts: [], screens: {}, pressWk: {}, tradeWk: {}, regional: { EU: 10, APAC: 10, CN: 10 } };
  var d = S.deal;
  if (!d.rel) d.rel = {};
  if (!d.pacts) d.pacts = [];
  if (!d.screens) d.screens = {};
  if (!d.pressWk) d.pressWk = {};
  if (!d.tradeWk) d.tradeWk = {};
  if (!d.regional) d.regional = { EU: 10, APAC: 10, CN: 10 };
  if (d.regional.EU == null) d.regional.EU = 10;
  if (d.regional.APAC == null) d.regional.APAC = 10;
  if (d.regional.CN == null) d.regional.CN = 10;
}

/* ── engine hooks (pure — no ensure, no side effects) ─────────── */
function hasPactWith(rivalName) {
  if (!S || !S.deal || !S.deal.pacts) return false;
  for (var i = 0; i < S.deal.pacts.length; i++)
    if (S.deal.pacts[i].name === rivalName && S.deal.pacts[i].until > S.studio.week) return true;
  return false;
}
function rivalDealClash(rivalName) {
  if (!S) return 1;
  if (hasPactWith(rivalName)) return 1.1; /* pact rivals dodge your weekends */
  var rel = (S.deal && S.deal.rel && S.deal.rel[rivalName] != null) ? S.deal.rel[rivalName] : 0;
  return rel <= -50 ? 0.92 : 1; /* hostilities sour their openings */
}
function screenCountMult(p) {
  if (!p) return 1;
  if (p.screenDeal === "min") return 0.9;
  if (p.screenDeal === "wide") return 1.06;
  if (p.screenDeal === "sat") return 1.12;
  return 1; /* std or unset */
}
function dealRegionalMult() {
  if (!S || !S.deal || !S.deal.regional) return 1;
  var r = S.deal.regional;
  return clamp(0.8 + ((r.EU || 0) + (r.APAC || 0) + (r.CN || 0)) / 3 / 250, 0.8, 1.2);
}
/* forecast convention: ui.js sums per-module suffixed hooks; bizdeal moves
   cash only at action time (spend/earn), so the weekly contribution is 0. */
function forecastAdjust_bizdeal() { return 0; }

/* ── relations & actions ──────────────────────────────────────── */
function dealRelOf(name) {
  dealEnsure();
  if (S.deal.rel[name] == null) S.deal.rel[name] = 0;
  return S.deal.rel[name];
}
function dealPressCd(name) {
  var last = S.deal.pressWk[name];
  return last == null ? 0 : Math.max(0, 8 - (S.studio.week - last));
}
function dealTradeCd(name) {
  var last = S.deal.tradeWk[name];
  return last == null ? 0 : Math.max(0, 12 - (S.studio.week - last));
}
function dealPactLeft(name) {
  for (var i = 0; i < S.deal.pacts.length; i++)
    if (S.deal.pacts[i].name === name) return Math.max(0, S.deal.pacts[i].until - S.studio.week);
  return 0;
}
function dealGift(name) { /* $1M dinner → +8 relations */
  dealEnsure();
  if (!name) return false;
  if (S.studio.cash < 1) { toast("Need " + fm(1) + " for a dinner with " + name + ".", "bad"); return false; }
  spend(1, "Gift dinner · " + name);
  S.deal.rel[name] = clamp(dealRelOf(name) + 8, -100, 100);
  log("Dinner with " + name + " — relations now " + (S.deal.rel[name] > 0 ? "+" : "") + Math.round(S.deal.rel[name]) + ".", "", "🤝");
  return true;
}
function dealPress(name) { /* $2M joint press day → +12 relations, 8-wk cooldown */
  dealEnsure();
  if (!name) return false;
  var cd = dealPressCd(name);
  if (cd > 0) { toast("Joint press is on cooldown (" + cd + " wk left).", ""); return false; }
  if (S.studio.cash < 2) { toast("Need " + fm(2) + " for a joint press day.", "bad"); return false; }
  spend(2, "Joint press · " + name);
  S.deal.pressWk[name] = S.studio.week;
  S.deal.rel[name] = clamp(dealRelOf(name) + 12, -100, 100);
  log("Joint press day with " + name + " — relations now " + (S.deal.rel[name] > 0 ? "+" : "") + Math.round(S.deal.rel[name]) + ".", "", "🤝");
  return true;
}
function dealTrade(name) { /* swap a free ★3+ market talent for a rival one, +5 relations, 12-wk cooldown */
  dealEnsure();
  if (!name) return false;
  var cd = dealTradeCd(name);
  if (cd > 0) { toast("Star trading is on cooldown (" + cd + " wk left).", ""); return false; }
  var cands = [], i, t;
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (!talentBusy(t) && t.power >= 3 && !isAgencyClient(t)) cands.push(t);
  }
  if (!cands.length) { toast("No free ★3+ talent on the market to trade.", "bad"); return false; }
  var mine = pick(cands);
  var theirs = genTalent(mine.k); /* their studio's counteroffer: one power tier off */
  theirs.power = clamp(mine.power + (chance(0.5) ? 1 : -1), 1, 5);
  theirs.fee = theirs.k === "actor" ? FEE_ACTOR[theirs.power - 1] : FEE_DIR[theirs.power - 1];
  theirs.skill = clamp(ri(35, 68) + theirs.power * 7 + ri(0, 10), 30, 97);
  var ix = S.market.indexOf(mine);
  if (ix >= 0) S.market.splice(ix, 1);
  S.market.push(theirs);
  S.deal.tradeWk[name] = S.studio.week;
  S.deal.rel[name] = clamp(dealRelOf(name) + 5, -100, 100);
  log("Star swap with " + name + ": " + mine.n + " joins their roster; " + theirs.n + " (★" + theirs.power + " " + (theirs.k === "actor" ? "actor" : "director") + ") lands on your market. Relations +5.", "", "🤝");
  return true;
}
function dealPact(name) { /* $15M non-aggression pact, needs +40 relations, 26 weeks */
  dealEnsure();
  if (!name) return false;
  if (hasPactWith(name)) { toast("A pact with " + name + " is already in force.", ""); return false; }
  if (dealRelOf(name) < 40) { toast(name + " needs relations +40 for a pact (now " + Math.round(S.deal.rel[name]) + ").", "bad"); return false; }
  if (S.studio.cash < 15) { toast("Need " + fm(15) + " for the non-aggression pact.", "bad"); return false; }
  spend(15, "Non-aggression pact · " + name);
  for (var i = S.deal.pacts.length - 1; i >= 0; i--) if (S.deal.pacts[i].name === name) S.deal.pacts.splice(i, 1);
  S.deal.pacts.push({ name: name, until: S.studio.week + 26 });
  log(name + " signs a 26-week non-aggression pact — no more poaching, friendlier weekends.", "gold", "🤝");
  return true;
}
function dealScreenName(key) { return { min: "Minimum", std: "Standard", wide: "Wide", sat: "Saturation" }[key] || "Standard"; }
function dealScreen(pid, key) { /* one negotiated screen tier per ready film */
  dealEnsure();
  var p = findProject(pid);
  if (!p) { toast("Unknown project.", "bad"); return false; }
  if (p.phase !== "ready") { toast("Screen counts are negotiated once a film is ready.", "bad"); return false; }
  if (p.screenDeal) { toast("“" + p.title + "” already locked a screen count.", ""); return false; }
  if (["min", "std", "wide", "sat"].indexOf(key) < 0) return false;
  var rel = (S.biz && S.biz.chains && S.biz.chains.rel != null) ? S.biz.chains.rel : 0;
  if (key === "wide" && rel < 55) { toast("Wide release needs theater relations 55+ (now " + Math.round(rel) + ").", "bad"); return false; }
  if (key === "sat" && rel < 70) { toast("Saturation needs theater relations 70+ (now " + Math.round(rel) + ").", "bad"); return false; }
  p.screenDeal = key;
  p.screenLegs = key === "sat" ? -0.1 : 0;   /* integrator: releaseFilm legs */
  p.screenRental = key === "min" ? 0.02 : 0; /* integrator: rental share */
  S.deal.screens[p.id] = key;
  log("Screen deal locked for “" + p.title + "”: " + dealScreenName(key) + " — opening ×" + screenCountMult(p).toFixed(2) + (p.screenRental ? ", rental +2pts" : "") + (p.screenLegs ? ", legs " + p.screenLegs.toFixed(1) : "") + ".", "good", "🎟️");
  return true;
}

/* ── weekly beat ──────────────────────────────────────────────── */
function dealWeekly() {
  var i, k, r;
  /* relations drift one point toward neutral */
  for (i = 0; i < S.rivals.length; i++) {
    k = S.rivals[i].name;
    r = S.deal.rel[k];
    if (r == null) continue;
    if (r > 0) r = Math.max(0, r - 1); else if (r < 0) r = Math.min(0, r + 1);
    S.deal.rel[k] = r;
  }
  /* pact expiries */
  for (i = S.deal.pacts.length - 1; i >= 0; i--) {
    if (S.deal.pacts[i].until <= S.studio.week) {
      log(S.deal.pacts[i].name + "'s non-aggression pact has expired.", "", "🤝");
      S.deal.pacts.splice(i, 1);
    }
  }
  /* regional reputation: new done films move EU / APAC / CN */
  var intlHeavy = ["scifi", "fantasy", "action"], euHeavy = ["drama", "romance", "crime"], f;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "done" || f.regionalCounted) continue;
    f.regionalCounted = true;
    if (intlHeavy.indexOf(f.genre) >= 0) {
      S.deal.regional.APAC = clamp(S.deal.regional.APAC + 4, 0, 100);
      S.deal.regional.CN = clamp(S.deal.regional.CN + 4, 0, 100);
      log("“" + f.title + "” played strong overseas — APAC and CN reputation +4.", "", "🌏");
    } else if (euHeavy.indexOf(f.genre) >= 0) {
      S.deal.regional.EU = clamp(S.deal.regional.EU + 4, 0, 100);
      log("“" + f.title + "” charmed European buyers — EU reputation +4.", "", "🌏");
    }
  }
}
function dealCatchUp() {
  /* engine.js has no tickBizdeal call yet: apply elapsed weeks lazily on
     desk/action contact; lastTick keeps it idempotent once wired. */
  if (!S || S.over) return;
  dealEnsure();
  if (S.deal.lastTick == null) { S.deal.lastTick = S.studio.week; return; }
  if (S.deal.lastTick >= S.studio.week) return;
  var steps = Math.min(S.studio.week - S.deal.lastTick, 26);
  for (var n = 0; n < steps; n++) dealWeekly();
  S.deal.lastTick = S.studio.week;
}
function tickBizdeal() {
  if (!S || S.over) return;
  dealCatchUp();
}

/* ── desks ────────────────────────────────────────────────────── */
function dealAfter() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function deskDealRivals() {
  dealEnsure();
  dealCatchUp();
  var html = "", i;
  html += '<div class="card">'
    + statrow("Studio cash", fm(S.studio.cash))
    + statrow("Relations drift toward 0", "1 point per week")
    + "</div>";
  for (i = 0; i < S.rivals.length; i++) {
    var r = S.rivals[i], rel = dealRelOf(r.name);
    var pc = dealPactLeft(r.name), pcd = dealPressCd(r.name), tcd = dealTradeCd(r.name);
    html += '<div class="card">'
      + statrow(esc(r.name), pc ? tag("Pact · " + pc + " wk left", "green") : tag("relations " + (rel > 0 ? "+" : "") + Math.round(rel), rel >= 40 ? "green" : rel <= -50 ? "red" : ""))
      + '<div class="bar' + (rel <= -50 ? " red" : rel >= 40 ? " green" : "") + '"><i style="width:' + Math.round((rel + 100) / 2) + '%"></i></div>'
      + '<div class="btnrow">'
      + '<button class="btn sm" data-action="deal-gift" data-rival="' + esc(r.name) + '"' + (S.studio.cash < 1 ? " disabled" : "") + ">Dinner " + fm(1) + " · +8</button>"
      + '<button class="btn sm" data-action="deal-press" data-rival="' + esc(r.name) + '"' + (S.studio.cash < 2 || pcd > 0 ? " disabled" : "") + ">Press " + fm(2) + " · +12</button>"
      + "</div>"
      + '<div class="btnrow">'
      + '<button class="btn sm" data-action="deal-trade" data-rival="' + esc(r.name) + '"' + (tcd > 0 ? " disabled" : "") + ">Trade star · +5</button>"
      + '<button class="btn primary sm" data-action="deal-pact" data-rival="' + esc(r.name) + '"' + (S.studio.cash < 15 || rel < 40 || pc > 0 ? " disabled" : "") + ">Pact " + fm(15) + " · 26 wk</button>"
      + "</div>"
      + (pcd > 0 ? statrow("Joint press cooldown", pcd + " wk left") : "")
      + (tcd > 0 ? statrow("Star trade cooldown", tcd + " wk left") : "")
      + (!pc && rel < 40 ? statrow("Pact gate", "needs relations +40") : "")
      + "</div>";
  }
  return html;
}
function dealSegBtn(p, key, label, gateRel) {
  var rel = (S.biz && S.biz.chains && S.biz.chains.rel != null) ? S.biz.chains.rel : 0;
  var dis = gateRel > 0 && rel < gateRel ? " disabled" : "";
  return '<button data-action="deal-screen" data-id="' + p.id + '" data-key="' + key + '"' + dis + ">" + label + (gateRel > 0 ? " · rel " + gateRel + "+" : "") + "</button>";
}
function deskDealScreens() {
  dealEnsure();
  dealCatchUp();
  var html = "", i;
  var rel = (S.biz && S.biz.chains && S.biz.chains.rel != null) ? S.biz.chains.rel : 0;
  html += '<div class="card">'
    + statrow("Theater relations", Math.round(rel) + " / 100")
    + statrow("Pre-sale offer multiplier", "×" + dealRegionalMult().toFixed(2))
    + "</div>";
  html += '<div class="sechead"><h2>Regional reputation — lifts pre-sale offers ×0.8–1.2</h2></div><div class="card">';
  var regs = [["EU", "drama · romance · crime releases +4"], ["APAC", "scifi · fantasy · action releases +4"], ["CN", "scifi · fantasy · action releases +4"]];
  for (i = 0; i < regs.length; i++) {
    var v = S.deal.regional[regs[i][0]];
    html += statrow(regs[i][0], Math.round(v) + " / 100 · " + regs[i][1])
      + '<div class="bar' + (v >= 70 ? " green" : "") + '"><i style="width:' + Math.round(v) + '%"></i></div>';
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Screen counts — one negotiated deal per ready film</h2></div>';
  var any = false;
  for (i = 0; i < S.projects.length; i++) {
    var p = S.projects[i];
    if (p.phase !== "ready") continue;
    any = true;
    html += '<div class="card">' + statrow(esc(p.title), tag(scaleOf(p.scale).name, "blue"));
    if (p.screenDeal) {
      html += statrow("Locked: " + dealScreenName(p.screenDeal), "opening ×" + screenCountMult(p).toFixed(2)
        + (p.screenRental ? " · rental +2pts" : "") + (p.screenLegs ? " · legs " + p.screenLegs.toFixed(1) : ""));
    } else {
      html += '<div class="seg">'
        + dealSegBtn(p, "min", "Minimum", 0)
        + dealSegBtn(p, "std", "Standard", 0)
        + dealSegBtn(p, "wide", "Wide", 55)
        + dealSegBtn(p, "sat", "Saturation", 70)
        + "</div>"
        + statrow("Legend", "open ×0.90 / ×1.00 / ×1.06 / ×1.12 · Minimum rental +2pts · Saturation legs -0.1");
    }
    html += "</div>";
  }
  html += any ? "" : '<div class="empty"><span class="em">🎟️</span>No film is ready to negotiate screens.</div>';
  return html;
}

var BIZDEAL_DESKS = [
  { id: "deal-rivals",  group: "Deals", icon: "🤝", name: "Rival negotiations",  desc: "Gifts, joint press, star swaps and non-aggression pacts with the other studios.", render: deskDealRivals },
  { id: "deal-screens", group: "Deals", icon: "🎟️", name: "Screens & territories", desc: "Lock a screen count per ready film; regional reputation lifts pre-sale offers.", render: deskDealScreens }
];

/* ── actions (ui.js onAction tries bizdealAction first-to-true) ─ */
function bizdealAction(a, elx) {
  if (a !== "deal-gift" && a !== "deal-press" && a !== "deal-trade" && a !== "deal-pact" && a !== "deal-screen") return false;
  dealEnsure();
  dealCatchUp();
  var name = elx && elx.getAttribute ? elx.getAttribute("data-rival") : null;
  var pid = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var ok = false;
  if (a === "deal-gift") ok = dealGift(name);
  else if (a === "deal-press") ok = dealPress(name);
  else if (a === "deal-trade") ok = dealTrade(name);
  else if (a === "deal-pact") ok = dealPact(name);
  else ok = dealScreen(pid, key);
  if (ok) dealAfter();
  return true;
}
