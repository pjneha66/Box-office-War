/* Box Office War — rebuilt. Meta module (wave 4) — all state under S.meta.
   Systems: career achievements (checked weekly via the engine's live checkAchievements
   hook; unlocked ids stored in S.meta.ach with unlock week) · Trophy gallery desk ·
   Career top-250 desk · Audience analytics (quadrant shares per film, CSS bar rows) ·
   Scenario forge (custom start conditions saved to S.meta.customScenario, read back via
   getCustomScenario(); the integrator wires the Start screen — define only here) ·
   Game-studio depth WITHOUT touching game/games.js: game sequels run a local dev/sales
   queue in S.meta.gdev → S.meta.grel (same dev/press/sales pattern as games.js but 0.9
   weekly decay), engine IP sale on S.games.engineLvl (−1 level, +$40M). All S.games /
   S.tv / S.emp / S.exh / S.biz / S.posters / S.strat reads are guarded — other modules
   may be absent on old saves.
   Wiring: engine calls checkAchievements() weekly. tickMeta() is also defined for the
   integrator; it is lastTick-guarded, and checkAchievements() piggy-backs it once per
   week so sequel dev progresses even before the integrator wires tickMeta (double hooks
   stay safe). Desks: META_DESKS + metaAction (ui.js onAction bridge — integrator wires).
   Sequel sales are not in forecast12(): games.js owns forecastAdjust and this module
   cannot redefine it (single-definition contract). */
"use strict";

/* ── state (lazy ensure — old saves have no S.meta) ───────────── */
function metaEnsure() {
  if (!S.meta) S.meta = { ach: {}, customScenario: null, gdev: null, grel: [], lastTick: 0 };
  if (!S.meta.ach) S.meta.ach = {};
  if (!S.meta.grel) S.meta.grel = [];
  if (S.meta.lastTick == null) S.meta.lastTick = 0;
  /* S.meta.gdev and S.meta.customScenario stay null until used */
}

/* ── achievements (each test defensive: other modules may be absent) ── */
function achHasHits(S, n) { return !!S.stats && S.stats.hits >= n; }
function achFranchiseCount(S) { var n = 0, i; for (i = 0; i < S.films.length; i++) if (S.films[i] && S.films[i].franchiseOf) n++; return n; }
function achCriticCount(S, min) { var n = 0, i; for (i = 0; i < S.films.length; i++) if (S.films[i] && S.films[i].criticAvg >= min) n++; return n; }
function achAnyWW(S, min) { var i; for (i = 0; i < S.films.length; i++) if (S.films[i] && typeof S.films[i].ww === "number" && S.films[i].ww >= min) return true; return false; }
function achFlopRedemption(S) {
  var fl = [], i;
  for (i = 0; i < S.films.length; i++) {
    var f = S.films[i];
    if (f && typeof f.profit === "number" && f.releaseWeek != null) fl.push(f);
  }
  fl.sort(function (a, b) { return a.releaseWeek - b.releaseWeek; });
  var flopped = false;
  for (i = 0; i < fl.length; i++) {
    if (fl[i].profit < 0) flopped = true;
    else if (flopped && fl[i].profit > 0) return true;
  }
  return false;
}
function achGameHit(S) {
  if (!S.games || !S.games.released) return false;
  for (var i = 0; i < S.games.released.length; i++) if (S.games.released[i] && S.games.released[i].pressAvg >= 75) return true;
  return false;
}
function achStageRecoup(S) {
  if (!S.emp || !S.emp.stage || !S.emp.stage.shows) return false;
  for (var i = 0; i < S.emp.stage.shows.length; i++) if (S.emp.stage.shows[i] && S.emp.stage.shows[i].recouped === true) return true;
  return false;
}
function achPostersSet(S) {
  var p = S.posters, k;
  if (!p) return false;
  if (Array.isArray(p)) { for (var i = 0; i < p.length; i++) if (p[i]) return true; return false; }
  for (k in p) if (p[k]) return true;
  return false;
}
function achImprintActive(S) {
  return !!(S.biz && S.biz.imprints && S.biz.imprints.active);
}
function achPassSubscriber(S) {
  return !!(S.strat && (S.strat.pass || (S.strat.passes && S.strat.passes.length)));
}

var ACHIEVEMENTS = [
  { id: "firstRelease", tier: 1, name: "First print", desc: "Release your first film.", test: function (S) { return !!S.stats && S.stats.releases >= 1; } },
  { id: "firstProfit", tier: 1, name: "In the black", desc: "Bank your first profitable release.", test: function (S) { return achHasHits(S, 1); } },
  { id: "open100", tier: 1, name: "Century opening", desc: "Open a film to $100M+.", test: function (S) { return !!S.stats && S.stats.bestOpen >= 100; } },
  { id: "open200", tier: 2, name: "Double century", desc: "Open a film to $200M+.", test: function (S) { return !!S.stats && S.stats.bestOpen >= 200; } },
  { id: "ww500", tier: 2, name: "Half a billion", desc: "One film grosses $500M+ worldwide.", test: function (S) { return achAnyWW(S, 500); } },
  { id: "ww1B", tier: 3, name: "Billionaire studio", desc: "Reach $1B in lifetime worldwide gross.", test: function (S) { return S.studio.lifetime >= 1000; } },
  { id: "trilogy", tier: 2, name: "Franchise player", desc: "Release three franchise films.", test: function (S) { return achFranchiseCount(S) >= 3; } },
  { id: "fiveHits", tier: 2, name: "Hit factory", desc: "Bank five profitable releases.", test: function (S) { return achHasHits(S, 5); } },
  { id: "flopRedemption", tier: 2, name: "Redemption arc", desc: "Follow a flop with a hit.", test: achFlopRedemption },
  { id: "rep100", tier: 2, name: "A-list address book", desc: "Reach 90+ studio reputation.", test: function (S) { return S.studio.rep >= 90; } },
  { id: "catalog500", tier: 2, name: "Vault of gold", desc: "Build the library catalog past 500.", test: function (S) { return S.studio.catalog >= 500; } },
  { id: "agencyFounder", tier: 1, name: "Talent in-house", desc: "Found your talent agency.", test: function (S) { return !!(S.agency && S.agency.founded); } },
  { id: "chainOwner", tier: 1, name: "Exhibition mogul", desc: "Own a theater chain.", test: function (S) { return !!(S.exh && S.exh.owned && S.exh.owned.length > 0); } },
  { id: "streamer1M", tier: 1, name: "Stream launch", desc: "Grow your streamer past 1M subscribers.", test: function (S) { return !!(S.tv && S.tv.streamer && S.tv.streamer.subs >= 1); } },
  { id: "gameHit", tier: 2, name: "Critical console", desc: "Release a game with press average 75+.", test: achGameHit },
  { id: "stageRecoup", tier: 2, name: "Broadway books", desc: "Recoup a stage show.", test: achStageRecoup },
  { id: "academyGrad", tier: 2, name: "Academy nod", desc: "Release a film critics score 85+.", test: function (S) { return achCriticCount(S, 85) >= 1; } },
  { id: "universeChartered", tier: 3, name: "It's all connected", desc: "Charter a shared universe.", test: function (S) { return !!(S.emp && S.emp.universe); } },
  { id: "decadeStudio", tier: 3, name: "Decade of pictures", desc: "Keep the studio alive 10 years (520 weeks).", test: function (S) { return S.studio.week >= 520; } },
  { id: "releases25", tier: 2, name: "Prolific slate", desc: "Release 25 films.", test: function (S) { return !!S.stats && S.stats.releases >= 25; } },
  { id: "cash1000", tier: 3, name: "Cash fortress", desc: "Hold $1,000M in cash.", test: function (S) { return S.studio.cash >= 1000; } },
  { id: "imprints", tier: 2, name: "Label hoarder", desc: "Run an active studio imprint.", test: achImprintActive },
  { id: "postersSet", tier: 1, name: "Walls of one-sheets", desc: "Set a custom poster.", test: achPostersSet },
  { id: "passSubscriber", tier: 1, name: "Season pass holder", desc: "Run a strategy season pass.", test: achPassSubscriber },
  { id: "prestige", tier: 3, name: "Five-star slate", desc: "Release five films critics score 80+.", test: function (S) { return achCriticCount(S, 80) >= 5; } },
  { id: "collectionCommand", tier: 1, name: "Collection command", desc: "Apply a collection lever.", test: function (S) { return !!(S.collection && S.collection.history && S.collection.history.length); } },
  { id: "genreWestern", tier: 1, name: "Howdy", desc: "Release a Western.", test: function (S) { return (S.films || []).some(function (f) { return f.status === "done" && f.genre === "western"; }); } },
  { id: "genreFamily", tier: 1, name: "Family night", desc: "Release a Family film.", test: function (S) { return (S.films || []).some(function (f) { return f.status === "done" && f.genre === "family"; }); } },
  { id: "collectionMax", tier: 2, name: "Circuit owner", desc: "Own 5+ circuit screens.", test: function (S) { return !!(S.collection && S.collection.bump && (S.collection.bump.screens || 0) >= 5); } },
  { id: "seasonPass", tier: 1, name: "Season ticket", desc: "Run a seasonal event.", test: function (S) { return !!(S.news && S.news.some(function (n) { return /season|corridor/i.test(n.txt || ""); })); } },
  { id: "rivalCrush", tier: 2, name: "Market leader", desc: "Beat all rivals in YTD gross.", test: function (S) { return (S.rivals || []).every(function (r) { return (S.studio.lifetime || 0) > (r.ytd || 0); }); } },
  { id: "tenFilms", tier: 1, name: "Double feature", desc: "Release 10 films.", test: function (S) { return !!S.stats && S.stats.releases >= 10; } },
  { id: "cash500", tier: 2, name: "War chest", desc: "Hold $500M in cash.", test: function (S) { return S.studio.cash >= 500; } },
  { id: "rep50", tier: 1, name: "Respected", desc: "Reach 50 reputation.", test: function (S) { return S.studio.rep >= 50; } },
  { id: "catalog100", tier: 1, name: "Vault starter", desc: "Build catalog past 100.", test: function (S) { return S.studio.catalog >= 100; } },
  { id: "tenWeeks", tier: 1, name: "Still standing", desc: "Survive 10 weeks.", test: function (S) { return S.studio.week >= 10; } },
  { id: "firstFranchise", tier: 2, name: "Franchise founder", desc: "Create a franchise.", test: function (S) { return !!(S.sequel && Object.keys(S.sequel.shipped || {}).length); } },
  { id: "firstStreamer", tier: 2, name: "Streaming debut", desc: "Launch your streamer.", test: function (S) { return !!(S.tv && S.tv.streamer); } },
  { id: "firstStage", tier: 2, name: "Stage debut", desc: "Open a stage show.", test: function (S) { return !!(S.stage && S.stage.shows && S.stage.shows.length); } }
];
var TIER_NAMES = { 1: "Bronze", 2: "Silver", 3: "Gold" };

/* Modules may publish their own achievements as `FOO_ACHIEVEMENTS` arrays of
   { id, tier, name, desc, test }. Merged here so a new module can add its own
   trophies without editing this file's table. */
function allAchievements() {
  var list = ACHIEVEMENTS.slice(), i;
  var mods = [
    typeof OPS_ACHIEVEMENTS !== "undefined" ? OPS_ACHIEVEMENTS : null,
    typeof LIVEOPS_ACHIEVEMENTS !== "undefined" ? LIVEOPS_ACHIEVEMENTS : null,
    typeof BLITZ_ACHIEVEMENTS !== "undefined" ? BLITZ_ACHIEVEMENTS : null,
    typeof CONSOLE_ACHIEVEMENTS !== "undefined" ? CONSOLE_ACHIEVEMENTS : null,
    typeof RIVAL_ACHIEVEMENTS !== "undefined" ? RIVAL_ACHIEVEMENTS : null,
    typeof LEGACY_ACHIEVEMENTS !== "undefined" ? LEGACY_ACHIEVEMENTS : null,
    typeof SEQUEL_ACHIEVEMENTS !== "undefined" ? SEQUEL_ACHIEVEMENTS : null,
    typeof WINDOW_ACHIEVEMENTS !== "undefined" ? WINDOW_ACHIEVEMENTS : null,
    typeof LABOR_ACHIEVEMENTS !== "undefined" ? LABOR_ACHIEVEMENTS : null,
    typeof CRAFT_ACHIEVEMENTS !== "undefined" ? CRAFT_ACHIEVEMENTS : null,
    typeof MENTOR_ACHIEVEMENTS !== "undefined" ? MENTOR_ACHIEVEMENTS : null
  ];
  for (i = 0; i < mods.length; i++) {
    if (!mods[i] || !mods[i].length) continue;
    var j;
    for (j = 0; j < mods[i].length; j++) list.push(mods[i][j]);
  }
  return list;
}

function checkAchievements() {
  if (!S || S.over) return;
  metaEnsure();
  var list = allAchievements();
  for (var i = 0; i < list.length; i++) {
    var a = list[i];
    if (S.meta.ach[a.id]) continue;
    var ok = false;
    try { ok = a.test(S) === true; } catch (e) { ok = false; }
    if (ok) {
      S.meta.ach[a.id] = S.studio.week;
      toast("🏆 Achievement unlocked: " + a.name + "!", "gold");
      log("🏆 Achievement: " + a.name + " — " + a.desc, "gold", "🏆");
    }
  }
  tickMeta(); /* piggy-back on the live weekly hook — lastTick guard keeps this a no-op when the integrator wires tickMeta too */
}

/* ── audience analytics: quadrant shares ──────────────────────── */
var DEMO_QUADS = [
  { id: "kids", name: "Kids", base: 22 },
  { id: "teens", name: "Teens", base: 28 },
  { id: "young", name: "Young adults", base: 32 },
  { id: "mature", name: "Mature", base: 18 }
];
var DEMO_GENRE_ADJ = {
  horror: { kids: -8, teens: 8 },
  animation: { kids: 10, mature: -10 },
  romance: { kids: -6, young: 6 },
  drama: { kids: -8, mature: 8 }
};
function demoShares(genreId) {
  var out = {}, adj = DEMO_GENRE_ADJ[genreId] || null, sum = 0, i;
  for (i = 0; i < DEMO_QUADS.length; i++) {
    var q = DEMO_QUADS[i];
    out[q.id] = clamp(q.base + (adj && adj[q.id] ? adj[q.id] : 0), 5, 60);
    sum += out[q.id];
  }
  if (sum <= 0) sum = 100;
  for (i = 0; i < DEMO_QUADS.length; i++) out[DEMO_QUADS[i].id] = Math.round(out[DEMO_QUADS[i].id] / sum * 1000) / 10;
  return out;
}
function demoFilms() {
  var fl = [], i;
  for (i = 0; i < S.films.length; i++) {
    var f = S.films[i];
    if (!f) continue;
    var g = typeof f.ww === "number" ? f.ww : (f.dom || 0);
    if (g > 0) fl.push({ f: f, gross: g });
  }
  fl.sort(function (a, b) { return b.gross - a.gross; });
  return fl.slice(0, 10);
}
function demoQuadRow(label, pct, gross) {
  return '<div class="statrow"><span class="k">' + label + '</span><span class="v num">' + pct + "% · " + fm(gross) + "</span></div>"
    + '<div class="bar"><i style="width:' + clamp(Math.round(pct), 1, 100) + '%"></i></div>';
}

/* ── scenario forge ───────────────────────────────────────────── */
var META_SCEN = { cash: 50, rep: 30, rival: 1.0, goal: "none", deadline: 104 };
var META_SCEN_CASH = [20, 50, 120, 250];
var META_SCEN_REP = [15, 30, 50];
var META_SCEN_RIVAL = [0.8, 1.0, 1.3];
var META_SCEN_GOALS = [
  { id: "none", n: "None" },
  { id: "firstProfit", n: "First profit" },
  { id: "cash", n: "Cash · $50M" },
  { id: "franchise", n: "Franchise empire" }
];
var META_SCEN_DEADLINES = [60, 104, 260];

function metaScenSave() {
  metaEnsure();
  var c = META_SCEN, g = null, i;
  if (META_SCEN_CASH.indexOf(c.cash) < 0) return { err: "Pick a starting cash tier." };
  if (META_SCEN_REP.indexOf(c.rep) < 0) return { err: "Pick a reputation tier." };
  if (META_SCEN_RIVAL.indexOf(c.rival) < 0) return { err: "Pick a rival power tier." };
  for (i = 0; i < META_SCEN_GOALS.length; i++) if (META_SCEN_GOALS[i].id === c.goal) g = META_SCEN_GOALS[i];
  if (!g) return { err: "Pick a goal." };
  if (META_SCEN_DEADLINES.indexOf(c.deadline) < 0) return { err: "Pick a deadline." };
  /* Shape the Start-screen integrator maps onto newGame + S.scenario:
     cash/rep = starting values, rivalPower = multiplier on rival power,
     goal { kind, target, weeks } — weeks is relative (deadline = start week + weeks). */
  S.meta.customScenario = { cash: c.cash, rep: c.rep, rivalPower: c.rival, goal: { kind: g.id, target: g.id === "cash" ? 50 : null, weeks: c.deadline } };
  log("🛠️ Custom scenario saved — start it from the Start screen — Scenario: Custom.", "gold", "🛠️");
  toast("Scenario saved — start it from the Start screen — Scenario: Custom.", "gold");
  return { ok: true };
}
function getCustomScenario() {
  if (!S || !S.meta) return null;
  return S.meta.customScenario || null;
}

/* ── game studio depth (no edits to games.js — S.games guarded) ─ */
var META_OUTLETS = ["PixelPolygon", "HyperJoy", "BitCollider", "EdgeOfPlay"];

function metaSequelStart(parentId) {
  metaEnsure();
  var G = S.games;
  if (!G || !G.studio) return { err: "Found the game studio first (Game studio desk)." };
  if (S.meta.gdev) return { err: "“" + S.meta.gdev.title + "” is still in development — one sequel at a time." };
  var p = null, i;
  if (G.released) for (i = 0; i < G.released.length; i++) if (G.released[i] && G.released[i].id === parentId) p = G.released[i];
  if (!p) return { err: "Game not found." };
  if ((p.pressAvg || 0) < 75) return { err: "Sequels need a released game with press 75+." };
  if (p.seqDone) return { err: "“" + p.title + "” already has a sequel." };
  var cost = Math.round(p.budget * 0.8 * 10) / 10;
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " in cash to fund the sequel." };
  p.seqDone = true;
  S.meta.gdev = { title: p.title + " II", parent: p.title, budget: cost, baseQ: clamp((p.quality || 40) + 5, 5, 95), engineLvl: G.engineLvl || 0, weeks: 8, wk: 0 };
  log("🕹️ Greenlit sequel “" + S.meta.gdev.title + "” — " + fm(cost) + " over 8 weeks, quality base " + S.meta.gdev.baseQ + ".", "", "🕹️");
  toast("🕹️ “" + S.meta.gdev.title + "” enters development.", "good");
  return { ok: true };
}

function metaEngineSell() {
  metaEnsure();
  var G = S.games;
  if (!G || !G.studio) return { err: "Found the game studio first (Game studio desk)." };
  if (!G.engineLvl || G.engineLvl < 2) return { err: "Selling engine IP needs engine R&D Lv 2+." };
  G.engineLvl--;
  earn(40, "Engine IP sale");
  log("🕹️ Sold engine IP licenses — +$40M. Engine R&D falls to Lv " + G.engineLvl + ".", "gold", "🕹️");
  toast("🕹️ Engine IP sold for $40M.", "gold");
  return { ok: true };
}

function metaFinishDev() {
  var d = S.meta.gdev;
  S.meta.gdev = null;
  var q = clamp(Math.round(d.baseQ + d.engineLvl * 4 + gauss() * 6), 5, 98);
  var reviews = [], sum = 0, i;
  for (i = 0; i < META_OUTLETS.length; i++) {
    var score = clamp(Math.round(q + gauss() * 5), 5, 99);
    reviews.push({ n: META_OUTLETS[i], score: score });
    sum += score;
  }
  var g = { id: "mg" + (S.seq++), title: d.title, parent: d.parent, budget: d.budget, quality: q, reviews: reviews, pressAvg: Math.round(sum / reviews.length), relWeek: S.studio.week, sold: 0, done: false };
  S.meta.grel.unshift(g);
  log("🕹️ “" + g.title + "” launches — press avg " + g.pressAvg + "/100 (sequel to “" + d.parent + "”).", g.pressAvg >= 70 ? "gold" : "", "🕹️");
  toast("🕹️ “" + g.title + "” launches — press avg " + g.pressAvg + "/100.", g.pressAvg >= 70 ? "good" : "");
  return g;
}

/* 10-week sales run, weekly decay 0.9 (same shape as games.js gamesWeeklyEarn) */
function metaWeeklyEarn(g, d) { return (g.quality / 100) * g.budget * 0.42 * Math.pow(0.9, d - 1); }

/* ── weekly tick (integrator wires tickMeta; idempotent per week) ── */
function tickMeta() {
  if (!S || S.over) return;
  metaEnsure();
  if (S.meta.lastTick === S.studio.week) return;
  S.meta.lastTick = S.studio.week;
  var i, g, d, w, e;
  if (S.meta.gdev) {
    d = S.meta.gdev;
    d.wk++;
    spend(d.budget / d.weeks, "Sequel dev · " + d.title);
    if (d.wk >= d.weeks) metaFinishDev();
  }
  for (i = S.meta.grel.length - 1; i >= 0; i--) {
    g = S.meta.grel[i];
    if (g.done) continue;
    w = S.studio.week - g.relWeek;
    if (w >= 1 && w <= 10) {
      e = Math.round(metaWeeklyEarn(g, w) * 10) / 10;
      earn(e, "Game sales · " + g.title);
      g.sold = Math.round((g.sold + e) * 10) / 10;
      if (w === 10) { g.done = true; log("🕹️ “" + g.title + "” ends its 10-week sales run — " + fm(g.sold) + " total.", "", "🕹️"); }
    }
  }
}

/* ── commit + action delegation (ui calls metaAction) ─────────── */
function metaCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function metaHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return true; }
  metaCommit();
  return true;
}
function metaSegPick(val, list, prop) {
  if (val == null) return;
  var f = parseFloat(val);
  if (list.indexOf(f) >= 0) META_SCEN[prop] = f;
}
function metaAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("meta-") !== 0) return false;
  metaEnsure();
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  if (a === "meta-scen-cash") { metaSegPick(key, META_SCEN_CASH, "cash"); if (typeof render === "function") render(); return true; }
  if (a === "meta-scen-rep") { metaSegPick(key, META_SCEN_REP, "rep"); if (typeof render === "function") render(); return true; }
  if (a === "meta-scen-rival") { metaSegPick(key, META_SCEN_RIVAL, "rival"); if (typeof render === "function") render(); return true; }
  if (a === "meta-scen-goal") { if (key) META_SCEN.goal = key; if (typeof render === "function") render(); return true; }
  if (a === "meta-scen-deadline") { metaSegPick(key, META_SCEN_DEADLINES, "deadline"); if (typeof render === "function") render(); return true; }
  if (a === "meta-scen-save") return metaHandle(metaScenSave());
  if (a === "meta-sequel") return metaHandle(metaSequelStart(elx && elx.getAttribute ? elx.getAttribute("data-id") : null));
  if (a === "meta-engine-sell") return metaHandle(metaEngineSell());
  return false;
}

/* ── desk: trophy gallery ─────────────────────────────────────── */
function metaTrophyDesk() {
  metaEnsure();
  /* the merged list, so trophies contributed by the feature modules appear here */
  var ALL = allAchievements();
  var unlocked = 0, i, a;
  for (i = 0; i < ALL.length; i++) if (S.meta.ach[ALL[i].id]) unlocked++;
  var html = '<div data-metadesk="trophies">'
    + '<div class="card">'
    + statrow("Trophies unlocked", unlocked + " / " + ALL.length, unlocked >= ALL.length ? "up" : "")
    + '<div class="bar green"><i style="width:' + clamp(Math.round(unlocked / Math.max(ALL.length, 1) * 100), 2, 100) + '%"></i></div>'
    + "</div>";
  var tiers = [1, 2, 3];
  for (var t = 0; t < tiers.length; t++) {
    html += '<div class="sechead"><h2>' + TIER_NAMES[tiers[t]] + " tier</h2></div><div class=\"card\">";
    for (i = 0; i < ALL.length; i++) {
      a = ALL[i];
      if (a.tier !== tiers[t]) continue;
      var got = !!S.meta.ach[a.id];
      html += '<div class="statrow"><span class="k">' + (got ? "🏆" : "🔒") + " " + esc(a.name) + " — " + esc(a.desc) + "</span>"
        + tag(got ? "Unlocked" : "Locked", got ? "gold" : "") + "</div>";
    }
    html += "</div>";
  }
  return html;
}

/* ── desk: career top-250 (top 50 shown) ──────────────────────── */
function filmYear(f) { return f.releaseWeek != null ? Math.floor((f.releaseWeek - 1) / 52) + 1 : null; }
function metaTopDesk() {
  metaEnsure();
  var fl = S.films.slice().sort(function (x, y) { return (y.ww || 0) - (x.ww || 0); });
  var html = '<div data-metadesk="top">'
    + '<div class="card">'
    + statrow("Releases / hits / flops", S.stats.releases + " / " + S.stats.hits + " / " + S.stats.flops)
    + statrow("Lifetime worldwide gross", fm(S.studio.lifetime))
    + statrow("Best opening / best worldwide", fm(S.stats.bestOpen) + " / " + fm(S.stats.bestWW))
    + "</div>";
  if (!fl.length) return html + '<div class="card"><div class="empty"><span class="em">📊</span>No films yet — release one and the ranking starts here.</div></div>';
  var n = Math.min(50, fl.length);
  html += '<div class="sechead"><h2>Top ' + n + " of " + fl.length + " (by worldwide gross)</h2></div><div class=\"card\">";
  for (var i = 0; i < n; i++) {
    var f = fl[i];
    var y = filmYear(f);
    var k = (i + 1) + ". " + esc(f.title) + " " + tag(y ? "Y" + y : "—", "");
    if (typeof f.ww !== "number") k += " " + tag("In theaters", "blue");
    var crit = typeof f.criticAvg === "number" ? tag(f.criticAvg + "%", f.criticAvg >= 75 ? "green" : f.criticAvg >= 45 ? "" : "red") : "";
    html += '<div class="statrow"><span class="k">' + k + "</span><span class=\"v num up\">" + (typeof f.ww === "number" ? fm(f.ww) : fm(f.dom || 0) + " so far") + (crit ? " " + crit : "") + "</span></div>";
  }
  return html + "</div>";
}

/* ── desk: audience analytics ─────────────────────────────────── */
function metaDemoDesk() {
  metaEnsure();
  var html = '<div data-metadesk="demo">';
  var rows = demoFilms();
  if (!rows.length) return html + '<div class="card"><div class="empty"><span class="em">🥧</span>No releases to analyze yet.</div></div>';
  /* studio-wide aggregate over the top 10 */
  var agg = {}, i, q, r, sumGross = 0;
  for (i = 0; i < DEMO_QUADS.length; i++) agg[DEMO_QUADS[i].id] = 0;
  for (r = 0; r < rows.length; r++) {
    var sh = demoShares(rows[r].f.genre);
    for (i = 0; i < DEMO_QUADS.length; i++) agg[DEMO_QUADS[i].id] += sh[DEMO_QUADS[i].id];
    sumGross += rows[r].gross;
  }
  html += '<div class="sechead"><h2>Studio aggregate · top ' + rows.length + " · " + fm(sumGross) + " grossed</h2></div><div class=\"card\">";
  for (i = 0; i < DEMO_QUADS.length; i++) {
    q = DEMO_QUADS[i];
    var avg = Math.round(agg[q.id] / rows.length * 10) / 10;
    html += demoQuadRow(q.name, avg, Math.round(sumGross * avg / 100 * 10) / 10);
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Per film · top 10 by worldwide</h2></div>';
  for (r = 0; r < rows.length; r++) {
    var f = rows[r].f, shares = demoShares(f.genre);
    html += '<div class="card film"><div class="head"><div class="title">' + esc(f.title) + "</div>"
      + tag(genreOf(f.genre) ? genreOf(f.genre).name : f.genre, "")
      + tag(typeof f.ww === "number" ? fm(f.ww) : fm(rows[r].gross) + " so far", "blue") + "</div>";
    for (i = 0; i < DEMO_QUADS.length; i++) {
      q = DEMO_QUADS[i];
      html += demoQuadRow(q.name, shares[q.id], Math.round(rows[r].gross * shares[q.id] / 100 * 10) / 10);
    }
    html += "</div>";
  }
  return html;
}

/* ── desk: scenario forge ─────────────────────────────────────── */
function metaSegHTML(action, list, cur, fmt) {
  var html = '<div class="seg">';
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    html += '<button class="' + (cur === v ? "on" : "") + '" data-action="' + action + '" data-key="' + v + '">' + fmt(v) + "</button>";
  }
  return html + "</div>";
}
function metaForgeDesk() {
  metaEnsure();
  var c = META_SCEN, i;
  var html = '<div data-metadesk="forge">';
  if (S.meta.customScenario) {
    var cs = S.meta.customScenario;
    var gname = "None";
    for (i = 0; i < META_SCEN_GOALS.length; i++) if (META_SCEN_GOALS[i].id === cs.goal.kind) gname = META_SCEN_GOALS[i].n;
    html += '<div class="card">'
      + statrow("Saved scenario", tag("Saved", "gold"))
      + statrow("Start cash / reputation", fm(cs.cash) + " / " + cs.rep)
      + statrow("Rival power ×" + cs.rivalPower, "goal: " + gname + (cs.goal.weeks ? " · " + cs.goal.weeks + " wk deadline" : ""))
      + "</div>";
  }
  html += '<div class="sechead"><h2>Build custom start conditions</h2></div><div class="card">'
    + '<div class="field-label">Starting cash</div>' + metaSegHTML("meta-scen-cash", META_SCEN_CASH, c.cash, function (v) { return fm(v); })
    + '<div class="field-label">Reputation</div>' + metaSegHTML("meta-scen-rep", META_SCEN_REP, c.rep, function (v) { return String(v); })
    + '<div class="field-label">Rival power</div>' + metaSegHTML("meta-scen-rival", META_SCEN_RIVAL, c.rival, function (v) { return "×" + v; })
    + '<div class="field-label">Goal</div>' + metaSegHTML("meta-scen-goal", META_SCEN_GOALS.map(function (g) { return g.id; }), c.goal, function (v) {
        for (var i2 = 0; i2 < META_SCEN_GOALS.length; i2++) if (META_SCEN_GOALS[i2].id === v) return META_SCEN_GOALS[i2].n;
        return v;
      })
    + '<div class="field-label">Deadline (weeks)</div>' + metaSegHTML("meta-scen-deadline", META_SCEN_DEADLINES, c.deadline, function (v) { return v + " wk"; })
    + '<div class="btnrow"><button class="btn primary grow" data-action="meta-scen-save">Save scenario</button></div>'
    + "</div>";
  return html;
}

/* ── desk: game studio depth ──────────────────────────────────── */
function metaGameDesk() {
  metaEnsure();
  var G = S.games;
  var html = '<div data-metadesk="gamedepth">';
  if (!G || !G.studio) {
    return html + '<div class="card"><div class="empty"><span class="em">🕹️</span>No game studio yet. Found one on the Game studio desk — then this desk adds sequels and engine IP sales.</div></div>';
  }
  html += '<div class="card">'
    + statrow("Engine R&D", "Lv " + (G.engineLvl || 0) + " / 3")
    + (G.engineLvl >= 2
      ? '<div class="statrow"><span class="k">Sell engine IP (+$40M, R&D −1)</span><button class="btn sm" data-action="meta-engine-sell">Sell</button></div>'
      : '<div class="statrow"><span class="k">Engine IP sale</span><span class="v">needs Lv 2+</span></div>')
    + "</div>";
  /* current sequel dev */
  if (S.meta.gdev) {
    var d = S.meta.gdev;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">🕹️ ' + esc(d.title) + "</div>" + tag("Sequel of " + esc(d.parent), "gold") + "</div>"
      + '<div class="statrow"><span class="k">Progress</span><span class="v">Week ' + d.wk + " / " + d.weeks + " · " + fm(d.budget / d.weeks) + "/wk burn</span></div>"
      + '<div class="bar"><i style="width:' + clamp(Math.round(d.wk / d.weeks * 100), 3, 100) + '%"></i></div>'
      + "</div>";
  } else {
    /* sequel ideas: released games with press 75+ */
    var elig = [], i;
    if (G.released) for (i = 0; i < G.released.length; i++) {
      var p = G.released[i];
      if (p && p.pressAvg >= 75 && !p.seqDone) elig.push(p);
    }
    html += '<div class="sechead"><h2>Game sequels (press 75+ released games)</h2></div><div class="card">';
    if (!elig.length) html += '<div class="empty"><span class="em">🕹️</span>No sequel candidates. Release a game with press 75+ on the Game studio desk.</div>';
    for (i = 0; i < elig.length; i++) {
      var e2 = elig[i];
      var cost = Math.round(e2.budget * 0.8 * 10) / 10;
      html += '<div class="statrow"><span class="k">' + esc(e2.title) + " " + tag("Press " + e2.pressAvg, "green") + " · sequel " + fm(cost) + " · 8 wk · quality base " + clamp((e2.quality || 40) + 5, 5, 95) + "</span>"
        + '<button class="btn primary sm" data-action="meta-sequel" data-id="' + esc(e2.id) + '" ' + (S.studio.cash < cost ? "disabled" : "") + ">Develop</button></div>";
    }
    html += "</div>";
  }
  /* released sequels */
  if (S.meta.grel.length) {
    html += '<div class="sechead"><h2>Released sequels</h2></div>';
    for (i = 0; i < S.meta.grel.length; i++) {
      var g = S.meta.grel[i];
      html += '<div class="card film">'
        + '<div class="head"><div class="title">🕹️ ' + esc(g.title) + "</div>" + tag("Press " + g.pressAvg, g.pressAvg >= 70 ? "green" : g.pressAvg >= 45 ? "" : "red") + "</div>"
        + '<div class="meta">' + tag("Sequel of " + esc(g.parent), "gold") + "</div>"
        + statrow("Sales total", "+" + fm(g.sold), "up")
        + statrow("Sales run", g.done ? "complete (10 wk)" : "week " + Math.max(0, S.studio.week - g.relWeek) + " of 10")
        + "</div>";
    }
  } else if (!S.meta.gdev) {
    html += '<div class="card"><div class="empty"><span class="em">🕹️</span>No sequels released yet.</div></div>';
  }
  return html;
}

var META_DESKS = [
  { id: "meta-trophies", group: "Career", icon: "🏆", name: "Trophy gallery", desc: "All career achievements — bronze to gold, unlocked as you play.", render: metaTrophyDesk },
  { id: "meta-top", group: "Career", icon: "📊", name: "Career top-250", desc: "Every released film ranked by worldwide gross, plus lifetime totals.", render: metaTopDesk },
  { id: "meta-demo", group: "Career", icon: "🥧", name: "Audience analytics", desc: "Who bought tickets — Kids/Teens/Young adults/Mature shares per film.", render: metaDemoDesk },
  { id: "meta-forge", group: "Career", icon: "🛠️", name: "Scenario forge", desc: "Build custom start conditions — cash, reputation, rivals, goal, deadline.", render: metaForgeDesk },
  { id: "meta-gamedepth", group: "Career", icon: "🕹️", name: "Game studio depth", desc: "Game sequels and engine IP sales on top of the game studio.", render: metaGameDesk }
];

/* Wiring lives in engine.js (checkAchievements, optional tickMeta) and ui.js (metaAction + desk shell) — no self-wiring. */
