/* Box Office War — rebuilt. Live-ops module — all state under S.liveops.
   Systems: blind-box talent scout packs ($3.0M a pull, four real rarity tiers on an
   explicit odds table, an epic pity at 20 dry pulls and a legendary pity at 40, and a
   result card) · four studio-floor amenities whose effects are exported as numbers
   through liveopsAmenityMods() (reputation gain, critic score, crew speed, overhead) ·
   co-production pacts that pay 40-50% of a project's budget as an immediate advance and
   owe that same slice of the finished film's gross · a seasonal event that rolls every
   four weeks by (S.studio.week/4)%3, lifts one genre's box office and pays a target-gross
   challenge from real releases.
   Wiring: integrator calls tickLiveOps() inside advanceWeek() and liveopsOnRelease(film)
   after releaseFilm(); engine applies liveopsEventMult(genre) to the weekly gross,
   liveopsAmenityMods() to reputation/critic/crew/overhead and liveopsCoprodShare(film)
   as the partner's cut; ui.js bridges liveopsAction() in onAction() and appends
   LIVEOPS_DESKS in collectDesks(). No self-wiring. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var LIVEOPS_PULL_COST = 3.0;
var LIVEOPS_PITY_EPIC = 20;      /* dry pulls before an epic is guaranteed */
var LIVEOPS_PITY_LEGEND = 40;    /* dry pulls before the icon is guaranteed */

/* Weight out of 1000 so the table sums to exactly 1.0 — no floating-point drift.
   The pct field is the same probability written the way the UI prints it. */
var LIVEOPS_RARITIES = [
  { id: "common",    name: "Working Pro",   weight: 700, pct: 70, power: [1, 2], skill: [0, 8] },
  { id: "rare",      name: "Rising Star",   weight: 220, pct: 22, power: [2, 3], skill: [8, 16] },
  { id: "epic",      name: "Marquee Name",  weight: 70,  pct: 7,  power: [4, 5], skill: [16, 26] },
  { id: "legendary", name: "Industry Icon", weight: 10,  pct: 1,  power: [5, 5], skill: [26, 36] }
];
var LIVEOPS_WEIGHT_TOTAL = 1000;

var LIVEOPS_AMENITIES = [
  { id: "trophy",  name: "Trophy gallery",        cost: 4.0, effect: "Reputation gains ×1.08 — the lobby does the talking." },
  { id: "lounge",  name: "Screening lounge",      cost: 3.0, effect: "Critics +4 on every release — they watch in comfort." },
  { id: "gym",     name: "Studio gym",            cost: 2.0, effect: "Crew speed ×1.10 — crews wrap a tenth faster." },
  { id: "daycare", name: "Studio daycare",        cost: 1.5, effect: "Overhead ×0.92 — morale keeps the lot cheap." }
];

var LIVEOPS_PARTNERS = [
  { id: "titan",   name: "Titan Global co-financing",  share: 0.5 },
  { id: "horizon", name: "Horizon Syndicate co-op",    share: 0.4 }
];

var LIVEOPS_EVENTS = [
  { id: "horror",  name: "Midnight Horror Screams", genre: "horror",    mult: 1.35, target: 40, reward: 12 },
  { id: "family",  name: "Winter Family Carnival",  genre: "animation", mult: 1.40, target: 60, reward: 18 },
  { id: "future",  name: "FutureCon Sci-Fi Expo",    genre: "scifi",     mult: 1.30, target: 50, reward: 15 }
];

var LIVEOPS_PACT_PHASES = ["pre", "shoot", "post", "ready"];

/* ── state (lazy ensure — old saves have no S.liveops) ────────── */
function liveopsEnsure() {
  if (!S.liveops) S.liveops = {};
  var L = S.liveops;
  if (!L.amenities) L.amenities = [];
  if (!L.pacts) L.pacts = [];
  if (!L.rarityCounts) L.rarityCounts = {};
  if (!isFinite(L.lastTick)) L.lastTick = 0;
  if (!isFinite(L.pulls)) L.pulls = 0;
  if (!isFinite(L.pity)) L.pity = 0;
  if (!isFinite(L.pityLegend)) L.pityLegend = 0;
  if (!isFinite(L.pityHits)) L.pityHits = 0;
  if (!isFinite(L.pityDecayed)) L.pityDecayed = 0;
  if (!isFinite(L.lastPullWeek)) L.lastPullWeek = 0;
  if (!isFinite(L.eventIdx)) L.eventIdx = -1;
  if (!isFinite(L.eventGross)) L.eventGross = 0;
  if (!isFinite(L.eventStart)) L.eventStart = 0;
  if (typeof L.eventRewarded !== "boolean") L.eventRewarded = false;
  if (!isFinite(L.coprodPaid)) L.coprodPaid = 0;
  if (!isFinite(L.seasonCash)) L.seasonCash = 0;
  if (!isFinite(L.spentCash)) L.spentCash = 0;
  return L;
}

function liveopsFindRarity(id) {
  var i;
  for (i = 0; i < LIVEOPS_RARITIES.length; i++) if (LIVEOPS_RARITIES[i].id === id) return LIVEOPS_RARITIES[i];
  return null;
}
function liveopsFindAmenity(id) {
  var i;
  for (i = 0; i < LIVEOPS_AMENITIES.length; i++) if (LIVEOPS_AMENITIES[i].id === id) return LIVEOPS_AMENITIES[i];
  return null;
}
function liveopsFindPartner(id) {
  var i;
  for (i = 0; i < LIVEOPS_PARTNERS.length; i++) if (LIVEOPS_PARTNERS[i].id === id) return LIVEOPS_PARTNERS[i];
  return null;
}
function liveopsHas(id) {
  liveopsEnsure();
  return S.liveops.amenities.indexOf(id) >= 0;
}
/* Find the pact that owns a project or a released film. Id matches win over title
   matches (titles can repeat across a slate) and a settled pact still resolves so
   callers can report "settled". */
function liveopsPactFor(x) {
  if (!x || !S || !S.liveops) return null;
  var i, p, title;
  for (i = 0; i < S.liveops.pacts.length; i++) {
    p = S.liveops.pacts[i];
    if (p.projId === x.id || p.filmId === x.id) return p;
  }
  title = x.title ? String(x.title) : null;
  if (!title) return null;
  for (i = 0; i < S.liveops.pacts.length; i++) {
    p = S.liveops.pacts[i];
    if (p.title === title) return p;
  }
  return null;
}
function liveopsRarityClass(id) {
  return id === "legendary" ? "gold" : id === "epic" ? "blue" : id === "rare" ? "green" : "";
}

/* ── engine hooks (typeof-guarded calls from engine.js) ───────── */
/* Seasonal window: the event index rolls every four weeks — (week / 4) % 3. */
function liveopsEventIndex() {
  var w = S && S.studio && isFinite(S.studio.week) ? S.studio.week : 1;
  return Math.floor(w / 4) % LIVEOPS_EVENTS.length;
}
function liveopsEvent() { return LIVEOPS_EVENTS[liveopsEventIndex()]; }

function liveopsEventMult(genreId) {
  if (!S) return 1;
  liveopsEnsure();
  var ev = liveopsEvent();
  if (!ev || ev.genre !== genreId) return 1;
  return ev.mult;
}

/* Numeric modifiers the integrator applies. Neutral: rep 1, critic 0, crew 1, overhead 1. */
function liveopsAmenityMods() {
  var m = { rep: 1, critic: 0, crew: 1, overhead: 1 };
  if (!S) return m;
  liveopsEnsure();
  var i, a;
  for (i = 0; i < S.liveops.amenities.length; i++) {
    a = S.liveops.amenities[i];
    if (a === "trophy") m.rep = Math.round(m.rep * 1.08 * 10000) / 10000;
    else if (a === "lounge") m.critic += 4;
    else if (a === "gym") m.crew = Math.round(m.crew * 1.1 * 10000) / 10000;
    else if (a === "daycare") m.overhead = Math.round(m.overhead * 0.92 * 10000) / 10000;
  }
  return m;
}

/* Gross share owed to a co-production partner: 0.4 / 0.5 while the pact is open, else 0.
   This is the query the integrator reads; liveopsOnRelease() books the cash once. */
function liveopsCoprodShare(film) {
  if (!S || !film) return 0;
  liveopsEnsure();
  var pact = liveopsPactFor(film);
  if (!pact || pact.settled) return 0;
  return pact.share;
}

/* ── mechanics: blind-box scouting ────────────────────────────── */
function liveopsRollRarity() {
  var roll = ri(1, LIVEOPS_WEIGHT_TOTAL), acc = 0, i, r;
  for (i = 0; i < LIVEOPS_RARITIES.length; i++) {
    r = LIVEOPS_RARITIES[i];
    acc += r.weight;
    if (roll <= acc) return r;
  }
  return LIVEOPS_RARITIES[0];
}

function liveopsPull() {
  liveopsEnsure();
  var L = S.liveops;
  if (S.studio.cash < LIVEOPS_PULL_COST) return { err: "Need " + fm(LIVEOPS_PULL_COST) + " for a scout pack." };
  spend(LIVEOPS_PULL_COST, "Scout pack");
  L.pulls++;
  L.pity++;
  L.pityLegend++;
  L.pityDecayed = 0;
  L.lastPullWeek = S.studio.week;
  L.spentCash = Math.round((L.spentCash + LIVEOPS_PULL_COST) * 10) / 10;

  /* two pity rails: a marquee name is guaranteed after 20 dry pulls, an icon after 40 */
  var forced = false, rar;
  if (L.pityLegend >= LIVEOPS_PITY_LEGEND) { rar = liveopsFindRarity("legendary"); forced = true; }
  else if (L.pity >= LIVEOPS_PITY_EPIC) { rar = liveopsFindRarity("epic"); forced = true; }
  else rar = liveopsRollRarity();
  if (forced) L.pityHits++;

  var t = genTalent("actor");
  t.power = clamp(ri(rar.power[0], rar.power[1]), 1, 5);
  t.skill = clamp(t.skill + ri(rar.skill[0], rar.skill[1]), 30, 98);
  t.rarity = rar.id;
  t.rarityName = rar.name;
  t.scouted = true;
  t.scoutWeek = S.studio.week;
  S.market.push(t);

  if (rar.id === "legendary") { L.pity = 0; L.pityLegend = 0; }
  else if (rar.id === "epic") L.pity = 0;
  L.rarityCounts[rar.id] = (L.rarityCounts[rar.id] || 0) + 1;
  L.lastPull = { id: t.id, name: t.n, rarity: rar.id, rarityName: rar.name, power: t.power, skill: t.skill, week: S.studio.week, forced: forced };

  if (rar.id === "legendary") log("🎰 Scout pack hits the jackpot: " + t.n + " (" + rar.name + ", ★" + t.power + ", skill " + t.skill + ").", "gold", "🎰");
  else if (rar.id === "epic") log("🎰 Scout pack delivers a marquee name: " + t.n + " (skill " + t.skill + ").", "gold", "🎰");
  toast("🎰 " + t.n + " · " + rar.name, rar.id === "epic" || rar.id === "legendary" ? "gold" : "good");
  return { ok: true, talent: t, rarity: rar.id, forced: forced };
}

function liveopsInstall(id) {
  liveopsEnsure();
  var a = liveopsFindAmenity(id);
  if (!a) return { err: "Unknown amenity." };
  if (liveopsHas(a.id)) return { err: a.name + " is already on the studio floor." };
  if (S.studio.cash < a.cost) return { err: "Need " + fm(a.cost) + " for the " + a.name + "." };
  spend(a.cost, "Amenity · " + a.name);
  S.liveops.amenities.push(a.id);
  /* the trophy gallery also lands an immediate reputation bump — the multiplier
     from liveopsAmenityMods() keeps compounding it on every future gain */
  if (a.id === "trophy") S.studio.rep = clamp(S.studio.rep + 3, 0, 100);
  log("🏛️ " + a.name + " opens — " + a.effect, "gold", "🏛️");
  toast("🏛️ " + a.name + " installed.", "good");
  return { ok: true };
}

function liveopsSignPact(projId, partnerId) {
  liveopsEnsure();
  var p = findProject(projId), pt = liveopsFindPartner(partnerId);
  if (!p) return { err: "That project is not in production." };
  if (!pt) return { err: "Unknown co-production partner." };
  if (LIVEOPS_PACT_PHASES.indexOf(p.phase) < 0) return { err: "Co-production needs an active project." };
  if (liveopsPactFor(p)) return { err: "“" + p.title + "” already has a co-production pact." };
  var budget = isFinite(p.budget) ? p.budget : 0;
  var adv = Math.round(budget * pt.share * 10) / 10;
  if (adv <= 0) return { err: "That project has no budget to co-finance." };
  S.liveops.pacts.push({
    id: "lv" + (S.seq++), projId: p.id, title: p.title, partner: pt.id,
    share: pt.share, advance: adv, paid: 0, settled: false, week: S.studio.week
  });
  earn(adv, "Co-pro advance · " + p.title);
  log("🤝 " + pt.name + " covers " + Math.round(pt.share * 100) + "% of “" + p.title + "” — " + fm(adv) + " wired today, the same share of gross owed at release.", "gold", "🤝");
  toast("🤝 " + fm(adv) + " advance for “" + p.title + "”.", "good");
  return { ok: true, advance: adv, share: pt.share };
}

/* ── release hook (integrator calls liveopsOnRelease(film)) ───── */
function liveopsPayReward() {
  liveopsEnsure();
  var L = S.liveops, ev = liveopsEvent();
  if (!ev || L.eventRewarded) return 0;
  if (L.eventGross < ev.target) return 0;
  L.eventRewarded = true;
  L.seasonCash = Math.round((L.seasonCash + ev.reward) * 10) / 10;
  earn(ev.reward, "Seasonal event · " + ev.name);
  log("🎪 " + ev.name + " challenge cleared — " + fm(ev.reward) + " bonus banked.", "gold", "🎪");
  toast("🎪 Seasonal challenge cleared: +" + fm(ev.reward), "gold");
  return ev.reward;
}

function liveopsOnRelease(film) {
  if (!S || !film) return;
  liveopsEnsure();
  var L = S.liveops, logs = 0;
  var g = isFinite(film.ww) && film.ww > 0 ? film.ww
    : (isFinite(film.dom) && film.dom > 0 ? film.dom
    : (isFinite(film.opening) ? film.opening * (isFinite(film.legs) && film.legs > 0 ? film.legs : 2) : 0));
  if (!isFinite(g) || g < 0) g = 0;

  /* seasonal challenge: credit the gross of the event's genre, once per film */
  var ev = liveopsEvent();
  if (ev && film.genre === ev.genre && g > 0) {
    var prev = isFinite(film.liveopsCredited) ? film.liveopsCredited : 0;
    if (g > prev) {
      L.eventGross = Math.round((L.eventGross + (g - prev)) * 10) / 10;
      film.liveopsCredited = g;
    }
    liveopsPayReward();
  }

  /* co-production: settle the partner's slice once, on the best gross we know —
     ww at end of run, or the projected run (opening × legs) at release. Settling
     here is what makes liveopsCoprodShare() report 0 afterwards, so the integrator
     can apply either hook and a film is never charged twice. */
  var pact = liveopsPactFor(film);
  if (pact && !pact.settled) {
    /* If the integrator already deducted the share from the film's own gross
       (film.liveopsShareApplied), the partner has been paid — just close the pact. */
    var owed = film.liveopsShareApplied ? 0 : Math.round(g * pact.share * 10) / 10;
    if (owed > 0) {
      spend(owed, "Co-pro share · " + pact.title);
      L.coprodPaid = Math.round((L.coprodPaid + owed) * 10) / 10;
      pact.paid = owed;
      pact.filmId = film.id;
      film.liveopsSharePaid = owed;
      if (logs < 1) {
        log("🤝 " + film.title + " returns " + fm(owed) + " to its co-production partner ("
          + Math.round(pact.share * 100) + "% of gross).", "", "🤝");
        logs++;
      }
    }
    pact.settled = true;
  }
}

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
function tickLiveOps() {
  if (!S || S.over) return;
  liveopsEnsure();
  var L = S.liveops;
  if (L.lastTick === S.studio.week) return; /* idempotent per week */
  L.lastTick = S.studio.week;

  var idx = liveopsEventIndex();
  if (idx !== L.eventIdx) {
    L.eventIdx = idx;
    L.eventGross = 0;
    L.eventRewarded = false;
    L.eventStart = S.studio.week;
    var ev = LIVEOPS_EVENTS[idx];
    log("🎪 " + ev.name + " — " + genreOf(ev.genre).name + " box office ×" + ev.mult.toFixed(2)
      + " for four weeks, " + fm(ev.target) + " target for a " + fm(ev.reward) + " bonus.", "gold", "🎪");
  }

  /* pity decay: one point lost per eight idle weeks so old luck never banks forever */
  if (L.pity > 0 || L.pityLegend > 0) {
    var since = S.studio.week - (L.lastPullWeek || 0);
    var steps = since > 0 ? Math.floor(since / 8) : 0;
    if (steps > L.pityDecayed) {
      var drop = steps - L.pityDecayed;
      L.pity = Math.max(0, L.pity - drop);
      L.pityLegend = Math.max(0, L.pityLegend - drop);
      L.pityDecayed = steps;
    }
  }

  /* safety net: a challenge crossed outside a release call still pays */
  liveopsPayReward();
}

/* ── claim + action delegation (ui calls liveopsAction) ───────── */
function liveopsClaim() {
  liveopsEnsure();
  var ev = liveopsEvent();
  if (!ev) return { err: "No seasonal event is running." };
  if (S.liveops.eventRewarded) return { err: "This event's bonus is already banked." };
  if (liveopsPayReward() <= 0) {
    return { err: "Challenge needs " + fm(Math.max(0, ev.target - S.liveops.eventGross)) + " more " + genreOf(ev.genre).name + " gross." };
  }
  return { ok: true, paid: ev.reward };
}

function liveopsCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}

function liveopsAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("live-") !== 0) return false;
  liveopsEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var r;
  switch (a) {
    case "live-pull": r = liveopsPull(); break;
    case "live-amenity": r = liveopsInstall(id); break;
    case "live-coprod": r = liveopsSignPact(id, key); break;
    case "live-claim": r = liveopsClaim(); break;
    default: return false;
  }
  if (r && r.err) toast(r.err, "bad");
  else liveopsCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function liveopsScoutDesk() {
  liveopsEnsure();
  var L = S.liveops, html = "", i, r, can;
  html += '<div class="card">'
    + statrow("Scout packs pulled", String(L.pulls))
    + statrow("Cash spent scouting", fm(L.spentCash || 0), L.spentCash > 0 ? "down" : "")
    + statrow("Pity to epic", L.pity + " / " + LIVEOPS_PITY_EPIC + " dry pulls", L.pity > 0 ? "down" : "")
    + statrow("Pity to icon", L.pityLegend + " / " + LIVEOPS_PITY_LEGEND + " pulls")
    + statrow("Pity guarantees triggered", String(L.pityHits))
    + "</div>";

  html += '<div class="sechead"><h2>Odds — one pack, four tiers</h2></div><div class="card">';
  for (i = 0; i < LIVEOPS_RARITIES.length; i++) {
    r = LIVEOPS_RARITIES[i];
    html += '<div class="statrow"><span class="k">' + esc(r.name) + " · " + r.pct + "% · ★"
      + r.power[0] + "–" + r.power[1] + " · skill +" + r.skill[0] + "…+" + r.skill[1] + "</span>"
      + '<span class="v">' + tag(esc(r.id), liveopsRarityClass(r.id)) + "</span></div>";
  }
  html += '<div class="statrow"><span class="k">Total odds</span><span class="v num">100%</span></div>';
  html += "</div>";

  can = S.studio.cash >= LIVEOPS_PULL_COST;
  html += '<div class="card">'
    + '<div class="statrow"><span class="k">Blind-box scout pack · ' + fm(LIVEOPS_PULL_COST)
    + (can ? "" : " — need " + fm(LIVEOPS_PULL_COST - S.studio.cash) + " more") + "</span>"
    + '<button class="btn primary sm" data-action="live-pull" ' + (can ? "" : "disabled")
    + ">Pull · after " + fm(S.studio.cash - LIVEOPS_PULL_COST) + "</button></div>"
    + "</div>";

  html += '<div class="sechead"><h2>Last pull</h2></div>';
  if (!L.lastPull) {
    html += '<div class="card"><div class="empty"><span class="em">🎰</span>No pack opened yet. Every pull lands a named actor in your talent market, with stats scaled by the tier that rolled.</div></div>';
  } else {
    html += '<div class="card film"><div class="head"><div class="title">' + esc(L.lastPull.name) + "</div>"
      + tag(esc(L.lastPull.rarityName), liveopsRarityClass(L.lastPull.rarity)) + "</div>"
      + '<div class="meta">' + tag("★ " + L.lastPull.power) + tag("Skill " + L.lastPull.skill)
      + (L.lastPull.forced ? tag("Pity pull", "gold") : "") + "</div>"
      + '<div class="statrow"><span class="k">Signed to the talent market · week ' + L.lastPull.week + "</span>"
      + '<span class="v">' + tag("Available", "green") + "</span></div>"
      + "</div>";
  }
  return html;
}

function liveopsAmenityDesk() {
  liveopsEnsure();
  var m = liveopsAmenityMods(), html = "", i, a, owned, can;
  html += '<div class="card">'
    + statrow("Reputation gain", "×" + m.rep.toFixed(2), m.rep > 1 ? "up" : "")
    + statrow("Critic score", (m.critic > 0 ? "+" : "") + m.critic, m.critic > 0 ? "up" : "")
    + statrow("Crew speed", "×" + m.crew.toFixed(2), m.crew > 1 ? "up" : "")
    + statrow("Overhead", "×" + m.overhead.toFixed(2), m.overhead < 1 ? "up" : "")
    + statrow("Amenities installed", S.liveops.amenities.length + " / " + LIVEOPS_AMENITIES.length)
    + "</div>";
  html += '<div class="sechead"><h2>Studio floor</h2></div>';
  for (i = 0; i < LIVEOPS_AMENITIES.length; i++) {
    a = LIVEOPS_AMENITIES[i];
    owned = liveopsHas(a.id);
    can = S.studio.cash >= a.cost;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(a.name) + "</div>"
      + tag(owned ? "Installed" : fm(a.cost), owned ? "green" : "gold") + "</div>"
      + '<div class="meta">' + tag(esc(a.effect), "blue") + "</div>"
      + '<div class="statrow"><span class="k">One-time build cost</span>'
      + (owned ? '<span class="v num up">Working</span>'
        : '<button class="btn sm" data-action="live-amenity" data-id="' + a.id + '" ' + (can ? "" : "disabled")
          + ">Install · after " + fm(S.studio.cash - a.cost) + "</button>")
      + "</div></div>";
  }
  return html;
}

function liveopsCoprodDesk() {
  liveopsEnsure();
  var html = "", i, j, p, pt, adv, can, list = [], open = 0;
  for (i = 0; i < S.liveops.pacts.length; i++) if (!S.liveops.pacts[i].settled) open++;
  html += '<div class="card">'
    + statrow("Pacts signed", String(S.liveops.pacts.length))
    + statrow("Gross repaid to partners", fm(S.liveops.coprodPaid || 0), S.liveops.coprodPaid > 0 ? "down" : "")
    + statrow("Pacts still owed", String(open))
    + "</div>";

  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (LIVEOPS_PACT_PHASES.indexOf(p.phase) < 0 || liveopsPactFor(p)) continue;
    list.push(p);
  }
  html += '<div class="sechead"><h2>Projects open to co-financing</h2></div>';
  if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">🤝</span>No project in development, shooting, post or ready without a pact. A partner pays 40-50% of the budget today for that slice of the gross later.</div></div>';
  }
  for (i = 0; i < list.length && i < 4; i++) {
    p = list[i];
    html += '<div class="card film"><div class="head"><div class="title">' + esc(p.title) + "</div>"
      + tag(fm(p.budget || 0) + " budget", "blue") + "</div>"
      + '<div class="meta">' + tag(esc(genreOf(p.genre).name)) + tag("Buzz " + (p.buzz || 0)) + "</div>";
    for (j = 0; j < LIVEOPS_PARTNERS.length; j++) {
      pt = LIVEOPS_PARTNERS[j];
      adv = Math.round((p.budget || 0) * pt.share * 10) / 10;
      can = adv > 0;
      html += '<div class="statrow"><span class="k">' + esc(pt.name) + " · " + Math.round(pt.share * 100)
        + "% now, " + Math.round(pt.share * 100) + "% of gross later</span>"
        + '<button class="btn sm" data-action="live-coprod" data-id="' + p.id + '" data-key="' + pt.id + '" '
        + (can ? "" : "disabled") + ">Sign · +" + fm(adv) + "</button></div>";
    }
    html += "</div>";
  }

  html += '<div class="sechead"><h2>Signed pacts</h2></div>';
  if (!S.liveops.pacts.length) {
    html += '<div class="card"><div class="empty"><span class="em">🤝</span>No pacts signed. The advance is cash in the bank; the share is deducted from the film\'s gross when it releases.</div></div>';
  }
  for (i = 0; i < S.liveops.pacts.length; i++) {
    p = S.liveops.pacts[i];
    html += '<div class="card"><div class="statrow"><span class="k">' + esc(p.title) + " · "
      + esc(p.partner === "titan" ? "Titan Global" : "Horizon Syndicate") + " · " + Math.round(p.share * 100) + "% of gross"
      + "</span><span class=\"v num " + (p.settled ? "" : "up") + "\">"
      + (p.settled ? "Settled · " + fm(p.paid || 0) : "Advance " + fm(p.advance) + " · owed")
      + "</span></div></div>";
  }
  return html;
}

function liveopsEventDesk() {
  liveopsEnsure();
  var L = S.liveops, ev = liveopsEvent(), pct, left, genre, ready;
  if (!ev) return '<div class="empty"><span class="em">🎪</span>No seasonal event is running.</div>';
  genre = genreOf(ev.genre);
  pct = Math.min(100, Math.round((L.eventGross / ev.target) * 100));
  left = Math.max(0, 4 - ((S.studio.week - (L.eventStart || 0)) % 4));
  ready = L.eventGross >= ev.target && !L.eventRewarded;
  var html = '<div class="card">'
    + statrow("Now running", esc(ev.name))
    + statrow("Boosted genre", esc(genre.name) + " · ×" + ev.mult.toFixed(2) + " weekly gross", "up")
    + statrow("Target", fm(ev.target) + " of " + esc(genre.name) + " gross")
    + statrow("Banked so far", fm(L.eventGross || 0), (L.eventGross || 0) > 0 ? "up" : "")
    + statrow("Window closes in", left + " week(s)")
    + statrow("Seasonal cash banked", fm(L.seasonCash || 0), (L.seasonCash || 0) > 0 ? "up" : "")
    + "</div>";
  html += '<div class="card">'
    + '<div class="field-label">' + pct + "% of the " + esc(genre.name) + " target</div>"
    + '<div class="bar ' + (pct >= 100 ? "green" : "") + '"><i style="width:' + pct + '%"></i></div>'
    + '<div class="statrow"><span class="k">Reward</span><span class="v num">' + fm(ev.reward) + "</span></div>"
    + '<div class="btnrow">'
    + (L.eventRewarded
      ? '<span class="v num up">Bonus banked</span>'
      : '<button class="btn primary sm" data-action="live-claim" ' + (ready ? "" : "disabled") + ">"
        + (ready ? "Collect " + fm(ev.reward) : "Reach the target first") + "</button>")
    + "</div></div>";
  html += '<div class="card"><div class="empty"><span class="em">🎪</span>Every released film of the boosted genre credits its gross here — the bonus pays the moment the target is crossed.</div></div>';
  return html;
}

var LIVEOPS_DESKS = [
  { id: "live-scout", group: "Live ops", icon: "🎰", name: "Talent scout packs",
    desc: "Pull $3.0M blind-box scout packs: four rarity tiers on a printed odds table, an epic pity at 20 dry pulls and an icon guaranteed at 40.",
    render: liveopsScoutDesk },
  { id: "live-amenities", group: "Live ops", icon: "🏛️", name: "Studio-floor amenities",
    desc: "Build the trophy gallery, screening lounge, gym and daycare — each one exports a real reputation, critic, crew-speed or overhead modifier.",
    render: liveopsAmenityDesk },
  { id: "live-coprod", group: "Live ops", icon: "🤝", name: "Co-production pacts",
    desc: "Sign a partner on an unreleased project: 40-50% of the budget lands as cash today and that same share of the gross is owed at release.",
    render: liveopsCoprodDesk },
  { id: "live-event", group: "Live ops", icon: "🎪", name: "Seasonal event",
    desc: "A rotating four-week festival lifts one genre's box office and pays a bonus when your releases clear the target gross.",
    render: liveopsEventDesk }
];
