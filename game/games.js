/* Box Office War — rebuilt. Game Studio (GDD engine) module — all state under S.games.
   Systems: found studio · develop one game at a time (topic × genre grids, budget tiers,
   weekly burn) · automatic release with 4 named press reviews and a 10-week sales run ·
   engine R&D (+4 quality per level, max 3) · GameCon booth (wk 22–24, once a year: next
   release sells ×1.2).
   Engine hooks defined here (typeof-guarded on the engine side by the integrator):
   - forecastAdjust(weekAbs) → scheduled game-sales earn for that absolute week ($M).
   Wiring: engine calls tickGames() after its own systems; ui.js bridges gamesAction().
   The tick is idempotent per week (lastTick guard) so double hooks are safe. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var GAME_TOPICS = ["Fantasy", "Cyberpunk", "Zombies", "Space", "Sports", "Cooking", "Detective", "Pirates", "Music", "Racing"];
var GAME_GENRES = ["RPG", "Action", "Strategy", "Sim", "Puzzle"];
var GAME_SYNERGY = [
  "Fantasy|RPG", "Cyberpunk|RPG", "Cyberpunk|Action", "Zombies|Action",
  "Zombies|Strategy", "Space|Strategy", "Space|Sim", "Sports|Sim",
  "Sports|Action", "Cooking|Sim", "Detective|Puzzle", "Detective|Strategy",
  "Pirates|Action", "Pirates|RPG", "Music|Puzzle", "Racing|Sim",
  "Racing|Action", "Fantasy|Strategy"
];
var GAME_TIERS = [10, 25, 50];
var GAME_OUTLETS = ["PixelPolygon", "HyperJoy", "BitCollider", "EdgeOfPlay"];
var GAME_PICK = { topic: null, genre: null, tier: 1 };  /* desk picker (transient) */

/* ── state (lazy ensure — old saves have no S.games) ──────────── */
function gamesEnsure() {
  if (!S.games) S.games = { studio: false, engineLvl: 0, dev: null, released: [], conYear: 0 };
  var G = S.games;
  if (typeof G.studio !== "boolean") G.studio = !!G.studio;
  if (typeof G.engineLvl !== "number") G.engineLvl = 0;
  if (!G.released) G.released = [];
  if (typeof G.conYear !== "number") G.conYear = 0;
  if (G.lastTick == null) G.lastTick = 0;   /* idempotency guard for the weekly tick */
  /* G.dev (current development) and G.conBooth (GameCon sales flag) are optional */
}

function gamesSynergy(topic, genre) { return GAME_SYNERGY.indexOf(topic + "|" + genre) >= 0; }
function gamesDevWeeks(tierIdx) { return 8 + tierIdx * 2; }

/* One week of sales, d = weeks since release (1..10). Shared by tick + forecastAdjust. */
function gamesWeeklyEarn(g, d) {
  return (g.quality / 100) * g.budget * 0.42 * Math.pow(0.85, d - 1) * (g.boost || 1);
}

/* ── actions ──────────────────────────────────────────────────── */
function gamesFound() {
  var G = S.games;
  if (G.studio) return { err: "The game studio is already founded." };
  if (S.studio.cash < 40) return { err: "Need " + fm(40) + " to found the game studio." };
  spend(40, "Found game studio");
  G.studio = true;
  log("Game studio founded — the GDD engine opens its dev kits.", "gold", "🎮");
  toast("🎮 Game studio founded.", "gold");
  return { ok: true };
}

function gamesStartDev() {
  var G = S.games;
  if (!G.studio) return { err: "Found the game studio first." };
  if (G.dev) return { err: "“" + G.dev.title + "” is still in development — one GDD at a time." };
  if (!GAME_PICK.topic || !GAME_PICK.genre) return { err: "Pick a topic and a genre." };
  var tier = clamp(GAME_PICK.tier, 0, GAME_TIERS.length - 1);
  var budget = GAME_TIERS[tier];
  var weeks = gamesDevWeeks(tier);
  if (S.studio.cash < budget) return { err: "Need " + fm(budget) + " in cash to fund development." };
  var syn = gamesSynergy(GAME_PICK.topic, GAME_PICK.genre);
  G.dev = { title: genTitle(), topic: GAME_PICK.topic, genre: GAME_PICK.genre, budget: budget, tier: tier, weeks: weeks, wk: 0, syn: syn };
  log("Greenlit game “" + G.dev.title + "” — " + G.dev.topic + " × " + G.dev.genre + ", " + fm(budget) + " over " + weeks + " weeks" + (syn ? ". Synergy ★ bonus." : ".") , "", "🎮");
  toast("🎮 “" + G.dev.title + "” enters development.", "good");
  return { ok: true };
}

function gamesEngineUp() {
  var G = S.games;
  if (!G.studio) return { err: "Found the game studio first." };
  if (G.engineLvl >= 3) return { err: "Engine R&D is maxed at Lv 3." };
  if (S.studio.cash < 20) return { err: "Need " + fm(20) + " for engine R&D." };
  spend(20, "Engine R&D · Lv " + (G.engineLvl + 1));
  G.engineLvl++;
  log("Game engine upgraded to Lv " + G.engineLvl + " — +" + (G.engineLvl * 4) + " quality on every future game.", "good", "🔧");
  toast("🔧 Engine R&D → Lv " + G.engineLvl + ".", "good");
  return { ok: true };
}

function gamesBooth() {
  var G = S.games;
  if (!G.studio) return { err: "Found the game studio first." };
  var woy = woyOf(S.studio.week);
  if (woy < 22 || woy > 24) return { err: "GameCon runs weeks 22–24." };
  if (G.conYear === S.studio.year) return { err: "Already exhibited at GameCon this year." };
  if (S.studio.cash < 5) return { err: "Need " + fm(5) + " for a GameCon booth." };
  spend(5, "GameCon booth");
  G.conYear = S.studio.year;
  G.conBooth = true;
  log("GameCon booth booked — your next released game sells ×1.2.", "gold", "🎪");
  toast("🎪 GameCon booth locked in.", "good");
  return { ok: true };
}

/* ── release (automatic at completion) ────────────────────────── */
function gamesFinishDev() {
  var G = S.games, i, d = G.dev;
  G.dev = null;
  var q = clamp(Math.round(38 + d.budget * 0.35 + (d.syn ? 12 : 0) + G.engineLvl * 4 + gauss() * 6), 5, 98);
  var reviews = [], sum = 0;
  for (i = 0; i < GAME_OUTLETS.length; i++) {
    var score = clamp(Math.round(q + gauss() * 5), 5, 99);
    reviews.push({ n: GAME_OUTLETS[i], score: score });
    sum += score;
  }
  var pressAvg = Math.round(sum / reviews.length);
  var boost = 1;
  if (G.conBooth) { boost = 1.2; G.conBooth = false; }
  var g = { id: "g" + (S.seq++), title: d.title, topic: d.topic, genre: d.genre, budget: d.budget, quality: q, reviews: reviews, pressAvg: pressAvg, relWeek: S.studio.week, sold: 0, boost: boost, done: false };
  G.released.unshift(g);
  var line = "";
  for (i = 0; i < reviews.length; i++) line += (i ? " · " : "") + reviews[i].n + " " + reviews[i].score;
  log("“" + g.title + "” launches — " + line + ". Press avg " + pressAvg + "/100." + (boost > 1 ? " GameCon buzz carries it." : ""), pressAvg >= 70 ? "gold" : "", "🎮");
  toast("🎮 “" + g.title + "” launches — press avg " + pressAvg + "/100.", pressAvg >= 70 ? "good" : "");
  return g;
}

/* ── forecast hook (engine's 12-week cashflow adds this) ──────── */
function forecastAdjust_games(weekAbs) {
  if (!S || !S.games || !S.games.released) return 0;
  var t = 0, i, g, d;
  for (i = 0; i < S.games.released.length; i++) {
    g = S.games.released[i];
    if (g.done) continue;
    d = weekAbs - g.relWeek;
    if (d >= 1 && d <= 10) t += Math.round(gamesWeeklyEarn(g, d) * 10) / 10;
  }
  return Math.round(t * 100) / 100;
}

/* ── weekly tick (engine calls tickGames() after its own systems) ── */
function tickGames() {
  if (!S || S.over) return;
  gamesEnsure();
  var G = S.games;
  if (G.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  G.lastTick = S.studio.week;
  var i, g, d, e;
  if (G.dev) {
    d = G.dev;
    d.wk++;
    spend(d.budget / d.weeks, "GDD · " + d.title);
    if (d.wk >= d.weeks) gamesFinishDev();
  }
  for (i = G.released.length - 1; i >= 0; i--) {
    g = G.released[i];
    if (g.done) continue;
    d = S.studio.week - g.relWeek;
    if (d >= 1 && d <= 10) {
      e = Math.round(gamesWeeklyEarn(g, d) * 10) / 10;
      earn(e, "Game sales · " + g.title);
      g.sold = Math.round((g.sold + e) * 10) / 10;
      if (d === 10) { g.done = true; log("“" + g.title + "” ends its 10-week sales run — " + fm(g.sold) + " total.", "", "🎮"); }
    }
  }
}

/* ── commit + action delegation (ui calls gamesAction first) ──── */
function gamesCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function gamesHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return true; }
  gamesCommit();
  return true;
}
function gamesAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("games-") !== 0) return false;
  gamesEnsure();
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var idx = elx && elx.getAttribute ? parseInt(elx.getAttribute("data-idx"), 10) : NaN;
  if (a === "games-topic") { if (key && GAME_TOPICS.indexOf(key) >= 0) GAME_PICK.topic = key; if (typeof render === "function") render(); return true; }
  if (a === "games-genre") { if (key && GAME_GENRES.indexOf(key) >= 0) GAME_PICK.genre = key; if (typeof render === "function") render(); return true; }
  if (a === "games-tier") { if (isFinite(idx)) GAME_PICK.tier = clamp(idx, 0, GAME_TIERS.length - 1); if (typeof render === "function") render(); return true; }
  if (a === "games-found") return gamesHandle(gamesFound());
  if (a === "games-confirm") return gamesHandle(gamesStartDev());
  if (a === "games-engine") return gamesHandle(gamesEngineUp());
  if (a === "games-booth") return gamesHandle(gamesBooth());
  return false;
}

/* ── desk ─────────────────────────────────────────────────────── */
function gamesHqDesk() {
  gamesEnsure();
  var G = S.games;
  var html = '<div data-gamesdesk="hq">';
  if (!G.studio) {
    html += '<div class="card">'
      + '<div class="empty"><span class="em">🎮</span>No game studio yet. Found one to develop video games inside your movie empire — topics × genres, engine R&D and an annual GameCon booth.</div>'
      + '<div class="statrow"><span class="k">Founding cost</span><span class="v">' + fm(40) + "</span></div>"
      + '<div class="btnrow"><button class="btn primary grow" data-action="games-found" ' + (S.studio.cash < 40 ? "disabled" : "") + ">Found · " + fm(40) + " · cash after " + fm(S.studio.cash - 40) + "</button></div>"
      + "</div>";
    return html + "</div>";
  }
  /* status + engine R&D */
  html += '<div class="card">'
    + '<div class="statrow"><span class="k">Game studio</span><span class="v">' + tag("Active", "green") + "</span></div>"
    + '<div class="statrow"><span class="k">Engine R&D · Lv ' + G.engineLvl + " / 3 · +" + (G.engineLvl * 4) + " quality</span>"
    + (G.engineLvl < 3
      ? '<button class="btn sm" data-action="games-engine" ' + (S.studio.cash < 20 ? "disabled" : "") + ">Upgrade · " + fm(20) + "</button>"
      : "<span class=\"v\">maxed</span>") + "</div>";
  var woy = woyOf(S.studio.week);
  if (woy >= 22 && woy <= 24) {
    html += '<div class="statrow"><span class="k">' + (G.conYear === S.studio.year ? "GameCon — exhibited this year" : "GameCon booth · " + fm(5) + " — next release sells ×1.2") + "</span>"
      + '<button class="btn sm" data-action="games-booth" ' + (G.conYear === S.studio.year || S.studio.cash < 5 ? "disabled" : "") + ">Booth</button></div>";
  }
  html += "</div>";
  /* current development */
  if (G.dev) {
    var dv = G.dev;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">🎮 ' + esc(dv.title) + "</div>" + tag(dv.syn ? "Synergy ★" : "No synergy", dv.syn ? "gold" : "") + "</div>"
      + '<div class="meta">' + tag(dv.topic) + tag(dv.genre) + tag(fm(dv.budget) + " budget") + "</div>"
      + '<div class="statrow"><span class="k">Progress</span><span class="v">Week ' + dv.wk + " / " + dv.weeks + " · " + fm(dv.budget / dv.weeks) + "/wk burn</span></div>"
      + '<div class="bar"><i style="width:' + clamp(Math.round((dv.wk / dv.weeks) * 100), 3, 100) + '%"></i></div>'
      + "</div>";
  } else {
    /* development picker: topic × genre grids, budget tier */
    var tier = clamp(GAME_PICK.tier, 0, GAME_TIERS.length - 1);
    var budget = GAME_TIERS[tier], weeks = gamesDevWeeks(tier);
    var syn = GAME_PICK.topic && GAME_PICK.genre ? gamesSynergy(GAME_PICK.topic, GAME_PICK.genre) : null;
    html += '<div class="sechead"><h2>Develop a game</h2></div>'
      + '<div class="card">'
      + '<div class="field-label">Topic</div><div class="seg">';
    GAME_TOPICS.forEach(function (t) {
      html += '<button class="' + (GAME_PICK.topic === t ? "on" : "") + '" data-action="games-topic" data-key="' + t + '">' + t + (GAME_PICK.genre && gamesSynergy(t, GAME_PICK.genre) ? " ★" : "") + "</button>";
    });
    html += "</div>"
      + '<div class="field-label">Genre</div><div class="seg">';
    GAME_GENRES.forEach(function (g) {
      html += '<button class="' + (GAME_PICK.genre === g ? "on" : "") + '" data-action="games-genre" data-key="' + g + '">' + g + (GAME_PICK.topic && gamesSynergy(GAME_PICK.topic, g) ? " ★" : "") + "</button>";
    });
    html += "</div>"
      + '<div class="field-label">Budget</div><div class="seg">';
    GAME_TIERS.forEach(function (b, i) {
      html += '<button class="' + (tier === i ? "on" : "") + '" data-action="games-tier" data-idx="' + i + '">' + fm(b) + "</button>";
    });
    html += "</div>"
      + '<div class="statrow"><span class="k">Development</span><span class="v">' + weeks + " wk · " + fm(budget / weeks) + "/wk burn</span></div>"
      + '<div class="statrow"><span class="k">Synergy</span><span class="v">' + (syn == null ? "pick a topic and a genre" : syn ? "★ +12 quality" : "none — mismatched pairing") + "</span></div>"
      + '<div class="btnrow"><button class="btn primary grow" data-action="games-confirm" ' + (S.studio.cash < budget ? "disabled" : "") + ">Confirm · " + fm(budget) + " over " + weeks + " wk · cash " + fm(S.studio.cash) + "</button></div>"
      + "</div>";
  }
  /* released games */
  if (G.released.length) {
    html += '<div class="sechead"><h2>Released games</h2></div>';
    G.released.forEach(function (g) {
      var line = "", i;
      for (i = 0; i < g.reviews.length; i++) line += (i ? " · " : "") + esc(g.reviews[i].n) + " " + g.reviews[i].score;
      html += '<div class="card film">'
        + '<div class="head"><div class="title">🎮 ' + esc(g.title) + "</div>" + tag("Press " + g.pressAvg, g.pressAvg >= 70 ? "green" : g.pressAvg >= 45 ? "" : "red") + "</div>"
        + '<div class="meta">' + tag(g.topic) + tag(g.genre) + (gamesSynergy(g.topic, g.genre) ? tag("Synergy ★", "gold") : "") + (g.boost > 1 ? tag("GameCon ×1.2", "blue") : "") + "</div>"
        + '<div class="statrow"><span class="k">Reviews</span><span class="v">' + line + "</span></div>"
        + '<div class="statrow"><span class="k">Sales total</span><span class="v num up">+' + fm(g.sold) + "</span></div>"
        + '<div class="statrow"><span class="k">Sales run</span><span class="v">' + (g.done ? "complete (10 wk)" : "week " + Math.max(0, S.studio.week - g.relWeek) + " of 10") + "</span></div>"
        + "</div>";
    });
  } else {
    html += '<div class="card"><div class="empty"><span class="em">🕹️</span>No games released yet. Finish a GDD to launch your first title.</div></div>';
  }
  return html + "</div>";
}

var GAMES_DESKS = [
  { id: "games-hq", group: "Game studio", icon: "🎮", name: "Game studio", desc: "The GDD engine — develop video games inside your movie empire.", render: gamesHqDesk }
];

/* Wiring lives in engine.js (tickGames) and ui.js (gamesAction + desk shell) — no self-wiring needed. */
