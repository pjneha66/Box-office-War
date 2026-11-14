/* Box Office War — rebuilt. Meta module 2 (wave 5) — all state under S.m2 (+ S.tutorial).
   Systems: season pass (10 deterministic goals per game-year, auto rewards, Gold theme
   cosmetic at 8+/10) · hall of legends (talent ranking from released films) · trilogy
   board (auto-assigned matching greenlights, rising-quality bonus) · content packs
   (validated JSON talent import/export) · First Film Lab tutorial banner.
   Wiring: integrator calls tickMeta2() weekly and bridges meta2Action() in ui.js onAction;
   ui.js render() calls tutorialBanner() guarded and prepends the returned HTML.
   S.tv / S.emp / S.tech / S.market reads are guarded — other modules may be absent.
   Pack JSON lives in S.m2.packBox / S.m2.packOut so desk re-renders keep the text. */
"use strict";

/* ── state (lazy ensure — old saves have no S.m2 / S.tutorial) ── */
function m2Ensure() {
  if (!S.m2) S.m2 = { pass: null, trilogy: null, goldTheme: false, packBox: "", packOut: "", lastTick: 0 };
  if (!S.m2.pass) S.m2.pass = { year: null, goals: [], claimed: [] };
  if (!S.m2.pass.goals) S.m2.pass.goals = [];
  if (!S.m2.pass.claimed) S.m2.pass.claimed = [];
  if (S.m2.lastTick == null) S.m2.lastTick = 0;
}

/* ── small deterministic RNG (mulberry32) for per-year goal seeds ── */
function m2Rng(seed) {
  var t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    var x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── guarded counters over other modules' state ───────────────── */
function m2Subs() { return (S.tv && S.tv.streamer && typeof S.tv.streamer.subs === "number") ? S.tv.streamer.subs : 0; }
function m2StageCount() {
  var n = 0, i;
  if (S.emp && S.emp.stage && S.emp.stage.shows) for (i = 0; i < S.emp.stage.shows.length; i++) if (S.emp.stage.shows[i] && S.emp.stage.shows[i].recouped) n++;
  return n;
}
function m2PremiereCount() {
  var n = 0, i;
  for (i = 0; i < S.films.length; i++) if (S.films[i] && (S.films[i].premiere || S.films[i].premiered)) n++;
  for (i = 0; i < S.projects.length; i++) if (S.projects[i] && (S.projects[i].premiere || S.projects[i].premierePlan)) n++;
  for (i = 0; i < S.news.length; i++) if (S.news[i] && S.news[i].txt && S.news[i].txt.toLowerCase().indexOf("premiere") >= 0) n++;
  return n;
}
function m2AwardCount() {
  var n = 0, i;
  for (i = 0; i < S.news.length; i++) if (S.news[i] && S.news[i].txt && S.news[i].txt.indexOf("Best Picture") >= 0) n++;
  return n;
}
function m2TechCount() {
  if (!S.tech) return 0;
  var t = S.tech, n = 0, k;
  if (Array.isArray(t.researched)) return t.researched.length;
  if (t.researched && typeof t.researched === "object") { for (k in t.researched) if (t.researched[k]) n++; return n; }
  if (typeof t.count === "number") return t.count;
  return 0;
}

/* ── season pass: 10 goals per game-year, deterministic from year ── */
var M2_KEYS = ["films", "cash", "rep", "facility", "client", "premiere", "award", "tech", "subs", "stage"];

function m2MakeGoal(key, rng) {
  var g = { key: key, txt: "", target: 0, base: 0, done: false, reward: null };
  var roll = function (lo, hi, step) { return lo + Math.floor(rng() * (hi - lo + 1)) * step; };
  if (key === "films") { g.base = S.films.length; g.target = roll(1, 3, 1); g.txt = "Release " + g.target + (g.target === 1 ? " film" : " films"); }
  else if (key === "cash") { g.target = roll(8, 24, 5); g.txt = "Bank " + fm(g.target) + " in the vault"; }
  else if (key === "rep") { g.target = clamp(35 + Math.floor(rng() * 7) * 5, 35, 95); g.txt = "Reach reputation " + g.target; }
  else if (key === "facility") { g.base = S.upg.post + S.upg.backlot; g.target = Math.min(g.base + 1, 6); g.txt = "Build or upgrade any facility"; }
  else if (key === "client") { g.base = S.agency.clients.length; g.target = Math.min(g.base + 1, 3); g.txt = "Sign a talent client"; }
  else if (key === "premiere") { g.base = m2PremiereCount(); g.target = g.base + 1; g.txt = "Hold a premiere"; }
  else if (key === "award") { g.base = m2AwardCount(); g.target = g.base + 1; g.txt = "Win an award"; }
  else if (key === "tech") { g.base = m2TechCount(); g.target = g.base + 1; g.txt = "Research a tech"; }
  else if (key === "subs") { g.base = m2Subs(); g.target = Math.round((0.5 + rng() * 2.5) * 10) / 10; g.txt = "Grow the streamer by " + g.target.toFixed(1) + "M subscribers"; }
  else { g.base = m2StageCount(); g.target = g.base + 1; g.txt = "Finish a stage show"; }
  g.reward = rng() < 0.6 ? { kind: "cash", amt: 5 + Math.floor(rng() * 11) } : { kind: "catalog", amt: 8 + Math.floor(rng() * 13) };
  return g;
}

function m2GenGoals(year) {
  var rng = m2Rng((year + 1) * 1013904223 + 7919);
  var pool = M2_KEYS.slice();
  if (!S.tech) { pool.splice(pool.indexOf("tech"), 1); } /* tech tree not in this save */
  var goals = [], i;
  for (i = 0; i < 10; i++) goals.push(m2MakeGoal(pool[i % pool.length], rng));
  return goals;
}

function m2GoalDone(g) {
  switch (g.key) {
    case "films": return S.films.length >= g.base + g.target;
    case "cash": return S.studio.cash >= g.target;
    case "rep": return S.studio.rep >= g.target;
    case "facility": return (S.upg.post + S.upg.backlot) >= g.target;
    case "client": return S.agency.clients.length >= g.target;
    case "premiere": return m2PremiereCount() >= g.target;
    case "award": return m2AwardCount() >= g.target;
    case "tech": return m2TechCount() >= g.target;
    case "subs": return m2Subs() >= g.base + g.target;
    case "stage": return m2StageCount() >= g.target;
  }
  return false;
}

function m2ApplyGoldTheme() {
  if (typeof setPref === "function") { setPref("goldTheme", "1"); return; }
  try {
    var p = {};
    try { p = JSON.parse(localStorage.getItem("bow2.prefs") || "{}") || {}; } catch (e2) { p = {}; }
    if (!p || typeof p !== "object") p = {};
    p.goldTheme = "1";
    localStorage.setItem("bow2.prefs", JSON.stringify(p));
  } catch (e3) { /* private mode — cosmetic only */ }
}

function m2TickPass() {
  var P = S.m2.pass, i, g, done;
  if (P.year !== S.studio.year) {
    P.year = S.studio.year;
    P.goals = m2GenGoals(P.year);
    P.claimed = [];
    log("🎯 Season pass Year " + P.year + ": ten new goals posted — complete 8+ for the Gold theme.", "gold", "🎯");
  }
  var doneNow = [];
  for (i = 0; i < P.goals.length; i++) {
    g = P.goals[i];
    if (g.done) continue;
    if (m2GoalDone(g)) { g.done = true; P.claimed.push(i); doneNow.push(g); }
  }
  for (i = 0; i < doneNow.length; i++) {
    g = doneNow[i];
    if (g.reward.kind === "cash") { earn(g.reward.amt, "Season pass reward"); toast("🎯 Season pass: " + g.txt + " — +$" + g.reward.amt + "M reward!", "gold"); }
    else { S.studio.catalog += g.reward.amt; toast("🎯 Season pass: " + g.txt + " — +" + g.reward.amt + " catalog!", "gold"); }
  }
  if (doneNow.length === 1) log("🎯 Season pass goal complete: " + esc(doneNow[0].txt) + ".", "gold", "🎯");
  else if (doneNow.length > 1) log("🎯 Season pass: " + doneNow.length + " goals completed this week — rewards paid.", "gold", "🎯");
  if (!S.m2.goldTheme) {
    done = 0;
    for (i = 0; i < P.goals.length; i++) if (P.goals[i].done) done++;
    if (done >= 8) {
      S.m2.goldTheme = true;
      m2ApplyGoldTheme();
      toast("🏆 Gold theme unlocked — 8+ season goals in one year!", "gold");
      log("🏆 Gold theme unlocked. The whole UI dresses for the occasion.", "gold", "🏆");
    }
  }
}

/* ── trilogy board ─────────────────────────────────────────────── */
function m2TrilogyNew(genreId) {
  m2Ensure();
  if (S.m2.trilogy && !S.m2.trilogy.done) return { err: "A trilogy is already in the works." };
  var g = genreOf(genreId);
  if (!g || g.id !== genreId) return { err: "Pick a genre for the trilogy." };
  var tr = {
    id: "tr" + (S.seq++),
    name: pick(TITLE_A) + " " + pick(TITLE_B) + " Trilogy",
    genre: g.id, done: false,
    entries: [{ seq: 1, filmId: null, pid: null, title: null, sinceWeek: 0 },
              { seq: 2, filmId: null, pid: null, title: null, sinceWeek: 0 },
              { seq: 3, filmId: null, pid: null, title: null, sinceWeek: 0 }]
  };
  S.m2.trilogy = tr;
  log("🎬 New trilogy announced: “" + esc(tr.name) + "” — three " + esc(g.name) + " films, rising quality pays.", "gold", "🎬");
  toast("Trilogy created: " + tr.name + ". Greenlight " + g.name + " films to fill the slots.", "good");
  return { ok: true };
}

function m2OpenEntry(tr) {
  var i;
  for (i = 0; i < tr.entries.length; i++) if (!tr.entries[i].pid && !tr.entries[i].filmId) return tr.entries[i];
  return null;
}

function m2FindReleased(e, tr) {
  var i, j, f, claimed;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.title !== e.title || f.releaseWeek == null || f.releaseWeek < e.sinceWeek) continue;
    claimed = false;
    for (j = 0; j < tr.entries.length; j++) if (tr.entries[j].filmId === f.id) claimed = true;
    if (!claimed) return f;
  }
  return null;
}

function m2TrilogyFinish(tr) {
  var f1 = findFilm(tr.entries[0].filmId), f3 = findFilm(tr.entries[2].filmId);
  if (!f1 || !f3) return;
  tr.done = true;
  if (f3.quality > f1.quality) {
    earn(30, "Trilogy completion bonus");
    S.studio.rep = clamp(S.studio.rep + 6, 0, 100);
    log("🏆 Trilogy complete: " + esc(tr.name) + " — quality rose across chapters. +$30M bonus, reputation +6.", "gold", "🏆");
    toast("Trilogy complete! +$30M and reputation +6.", "gold");
  } else if (f3.quality < f1.quality) {
    log("🎬 " + esc(tr.name) + " — the trilogy fizzled: each chapter landed softer than the last.", "bad", "🎬");
    toast(tr.name + " fizzled out.", "bad");
  } else {
    log("🎬 " + esc(tr.name) + " ends dead even — a solid shelf of three.", "", "🎬");
  }
}

function m2TickTrilogy() {
  var tr = S.m2.trilogy, i, p, e, f, all;
  if (!tr || tr.done) return;
  /* auto-assign freshly greenlit projects matching the trilogy genre */
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.trilogyId || p.genre !== tr.genre) continue;
    e = m2OpenEntry(tr);
    if (!e) break;
    e.pid = p.id; e.title = p.title; e.sinceWeek = S.studio.week;
    p.trilogyId = tr.id; p.trilogySeq = e.seq;
    log("🎬 “" + esc(p.title) + "” joins " + esc(tr.name) + " as chapter " + e.seq + ".", "", "🎬");
  }
  /* link released films; free slots whose project left the slate */
  for (i = 0; i < tr.entries.length; i++) {
    e = tr.entries[i];
    if (e.filmId || !e.pid) continue;
    if (findProject(e.pid)) continue;
    f = m2FindReleased(e, tr);
    if (f) { e.filmId = f.id; log("🎬 “" + esc(f.title) + "” lands as chapter " + e.seq + " of " + esc(tr.name) + ".", "", "🎬"); }
    else if (S.studio.week > e.sinceWeek + 1) {
      log("🎬 The chapter " + e.seq + " project left the slate — the slot reopens.", "bad", "🎬");
      e.pid = null; e.title = null; e.sinceWeek = 0;
    }
  }
  all = tr.entries.length > 0;
  for (i = 0; i < tr.entries.length; i++) if (!tr.entries[i].filmId) all = false;
  if (all) m2TrilogyFinish(tr);
}

/* ── content packs ─────────────────────────────────────────────── */
function m2PackFromMarket() {
  var list = S.market.slice().sort(function (a, b) { return (b.power - a.power) || (b.skill - a.skill); }).slice(0, 10);
  var arr = [], i;
  for (i = 0; i < list.length; i++) arr.push({ n: list[i].n, k: list[i].k, power: list[i].power, skill: list[i].skill, fee: list[i].fee, fit: (list[i].fit || []).slice() });
  return JSON.stringify({ talents: arr });
}

function m2ValidPack(json) {
  var obj, i, j, t, gid;
  try { obj = JSON.parse(json); } catch (e) { return { err: "that is not valid JSON" }; }
  if (!obj || !Array.isArray(obj.talents)) return { err: "a talents array is required" };
  if (obj.talents.length < 1) return { err: "the pack has no talents" };
  if (obj.talents.length > 10) return { err: "maximum 10 talents per pack" };
  for (i = 0; i < obj.talents.length; i++) {
    t = obj.talents[i];
    if (!t || typeof t !== "object") return { err: "talent #" + (i + 1) + " is malformed" };
    if (typeof t.n !== "string" || !t.n.length || t.n.length > 30) return { err: "talent #" + (i + 1) + ": name must be 1-30 characters" };
    if (t.k !== "actor" && t.k !== "dir") return { err: t.n + ": k must be \"actor\" or \"dir\"" };
    if (typeof t.power !== "number" || !isFinite(t.power) || t.power < 1 || t.power > 5 || t.power % 1 !== 0) return { err: t.n + ": power must be an integer 1-5" };
    if (typeof t.skill !== "number" || !isFinite(t.skill) || t.skill < 20 || t.skill > 97 || t.skill % 1 !== 0) return { err: t.n + ": skill must be an integer 20-97" };
    if (typeof t.fee !== "number" || !isFinite(t.fee) || t.fee < 0 || t.fee > 40) return { err: t.n + ": fee must be 0-40" };
    if (!Array.isArray(t.fit) || !t.fit.length) return { err: t.n + ": fit must list at least one genre id" };
    for (j = 0; j < t.fit.length; j++) {
      gid = genreOf(t.fit[j]).id;
      if (gid !== t.fit[j]) return { err: t.n + ": unknown genre id \"" + t.fit[j] + "\"" };
    }
  }
  return { ok: obj };
}

function m2PackApply(obj) {
  var added = 0, i, t;
  for (i = 0; i < obj.talents.length; i++) {
    t = obj.talents[i];
    S.market.push({
      id: "t" + (S.seq++), k: t.k, n: t.n,
      power: t.power, skill: t.skill,
      fee: Math.round(t.fee * 10) / 10,
      ability: null, fit: t.fit.slice(),
      age: ri(24, 58), heat: 0, bookedUntil: 0
    });
    added++;
  }
  log("📦 Content pack: " + added + " talents imported into the market.", "gold", "📦");
  toast("Content pack: " + added + " talents imported.", "good");
  return added;
}

function m2PackImportSource(elx) {
  if (typeof document !== "undefined" && document.getElementById) {
    var ta = document.getElementById("packBox");
    if (ta && typeof ta.value === "string") return ta.value;
  }
  if (elx && elx.getAttribute && elx.getAttribute("data-text")) return elx.getAttribute("data-text");
  return S.m2.packBox || "";
}

/* ── tutorial (First Film Lab) ─────────────────────────────────── */
var M2_TUT_STEPS = [
  { view: "develop", txt: "Develop: buy a script and greenlight it." },
  { view: null,      txt: "Advance weeks with the big gold button until production wraps." },
  { view: null,      txt: "Set a release date — watch the calendar for rival films." },
  { view: null,      txt: "Watch the weekend chart. Profit completes the lab." }
];

function m2EnsureTutorial() {
  if (S.scenario && S.scenario.id === "lab" && !S.tutorial) S.tutorial = { step: 1, active: true, rewarded: false };
}

function tutorialBanner() {
  if (!S) return null;
  m2EnsureTutorial();
  if (!S.tutorial || !S.tutorial.active) return null;
  var st = S.tutorial.step;
  if (st < 1 || st > 4) return null;
  var step = M2_TUT_STEPS[st - 1];
  if (step.view && typeof VIEW !== "undefined" && VIEW !== step.view) return null;
  return '<div class="card" data-m2tut="1">'
    + '<div class="statrow"><span class="k">🎯 Tutorial ' + st + "/4 — " + esc(step.txt) + "</span>"
    + '<button class="btn sm primary" data-action="m2-tut-next">Got it</button></div>'
    + "</div>";
}

function m2TutProfitCheck() {
  if (!S.tutorial || S.tutorial.rewarded || S.tutorial.step < 4) return;
  if (!(S.stats && S.stats.hits >= 1)) return;
  S.tutorial.rewarded = true;
  S.tutorial.active = false;
  earn(10, "Tutorial graduation grant");
  toast("🎓 Tutorial complete — first profit banks the $10M graduation grant!", "gold");
  log("🎓 First Film Lab tutorial complete — the board wires a $10M graduation grant.", "gold", "🎓");
}

function m2TutNext() {
  if (!S.tutorial) return;
  if (S.tutorial.active && S.tutorial.step < 4) S.tutorial.step++;
  else if (S.tutorial.active) S.tutorial.active = false; /* dismissed at step 4 — grant still lands on first profit */
  m2TutProfitCheck();
}

/* ── weekly tick (engine calls tickMeta2 after its own systems) ── */
function tickMeta2() {
  if (!S || S.over) return;
  m2Ensure();
  if (S.m2.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.m2.lastTick = S.studio.week;
  m2EnsureTutorial();
  m2TutProfitCheck();
  m2TickPass();
  m2TickTrilogy();
}

/* ── commit + action delegation (ui calls meta2Action first-to-true) ── */
function m2Commit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function m2Handle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  m2Commit();
}

function meta2Action(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("m2-") !== 0) return false;
  m2Ensure();
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  if (a === "m2-tut-next") { m2TutNext(); m2Commit(); return true; }
  if (a === "m2-trilogy-new") { m2Handle(m2TrilogyNew(key)); return true; }
  if (a === "m2-pack-import") {
    var raw = m2PackImportSource(elx);
    var v = m2ValidPack(raw);
    if (v.err) {
      toast("Pack rejected: " + esc(v.err) + ".", "bad");
      S.m2.packBox = raw; /* keep the text so the user can fix it */
      m2Commit();
      return true;
    }
    m2PackApply(v.ok);
    S.m2.packBox = "";
    m2Commit();
    return true;
  }
  if (a === "m2-pack-export") {
    S.m2.packOut = m2PackFromMarket();
    toast("Pack JSON exported below — copy it anywhere.", "");
    m2Commit();
    return true;
  }
  return false;
}

/* ── desks ─────────────────────────────────────────────────────── */
function m2PassDesk() {
  m2Ensure();
  var P = S.m2.pass, i, done = 0;
  if (!P.goals.length) return '<div class="empty"><span class="em">🎯</span>The season pass posts its first ten goals at the next weekly tick.</div>';
  for (i = 0; i < P.goals.length; i++) if (P.goals[i].done) done++;
  var html = '<div class="card">'
    + statrow("Season " + P.year + " goals", done + " / 10 complete", done >= 8 ? "up" : "")
    + '<div class="bar green"><i style="width:' + clamp(Math.round(done / 10 * 100), 2, 100) + '%"></i></div>'
    + (S.m2.goldTheme ? statrow("Gold theme", "Unlocked", "up") : statrow("Gold theme", "Complete 8+ goals this season to unlock", ""))
    + "</div>"
    + '<div class="card">';
  for (i = 0; i < P.goals.length; i++) {
    var g = P.goals[i];
    var rw = g.reward.kind === "cash" ? "+$" + g.reward.amt + "M" : "+" + g.reward.amt + " catalog";
    html += '<div class="statrow"><span class="k">' + (g.done ? "✅ " : "⬜ ") + esc(g.txt) + "</span>"
      + tag(g.done ? rw : "Reward " + rw, g.done ? "gold" : "") + "</div>";
  }
  return html + "</div>";
}

function m2LegendRows() {
  var byId = {}, i, j, f, id, ids;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    ids = [f.dirId, f.actId];
    for (j = 0; j < ids.length; j++) {
      id = ids[j];
      if (!id) continue;
      if (!byId[id]) byId[id] = { id: id, films: 0, qSum: 0, ww: 0 };
      byId[id].films++;
      byId[id].qSum += f.quality || 0;
      byId[id].ww += f.ww || f.dom || 0;
    }
  }
  var rows = [];
  for (id in byId) {
    var r = byId[id];
    r.avgQ = Math.round(r.qSum / r.films);
    r.score = r.films * 10 + r.avgQ;
    var t = findTalent(id);
    r.name = t ? t.n : "Former contract";
    r.k = t ? t.k : "?";
    rows.push(r);
  }
  rows.sort(function (a, b) { return b.score - a.score || b.ww - a.ww; });
  return rows.slice(0, 8);
}

function m2LegendsDesk() {
  m2Ensure();
  var rows = m2LegendRows();
  if (!rows.length) return '<div class="empty"><span class="em">🗿</span>No legends yet — release films and your directors and stars start building their case here.</div>';
  var medals = ["🥇", "🥈", "🥉"];
  var html = '<div class="card">' + statrow("Ranked by", "films × 10 + average quality") + "</div><div class=\"card\">";
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    html += '<div class="statrow"><span class="k">' + (medals[i] || "🎬") + " " + esc(r.name) + " "
      + tag(r.k === "dir" ? "Director" : r.k === "actor" ? "Lead" : "Talent", "blue") + "</span>"
      + '<span class="v num">' + r.films + " films · Q" + r.avgQ + " · " + fm(r.ww) + "</span></div>";
  }
  return html + "</div>";
}

function m2TrilogyDesk() {
  m2Ensure();
  var tr = S.m2.trilogy, html = "", i, g, e, f, p, st, cls;
  if (tr) {
    g = genreOf(tr.genre);
    html += '<div class="card">' + statrow(esc(tr.name), tr.done ? tag("Complete", "gold") : tag(g.em + " " + g.name + " · in progress", "blue"));
    for (i = 0; i < tr.entries.length; i++) {
      e = tr.entries[i];
      st = "Open slot"; cls = "";
      if (e.filmId) {
        f = findFilm(e.filmId);
        st = f ? "Released · " + fm(f.ww || f.dom || 0) + " · Q" + f.quality : "Released";
        cls = "gold";
      } else if (e.pid && findProject(e.pid)) {
        p = findProject(e.pid);
        st = p.phase === "ready" ? "Ready — schedule it" : p.phase === "pre" ? "Pre-production" : p.phase === "shoot" ? "Shooting" : "Post-production";
        cls = "blue";
      }
      html += '<div class="statrow"><span class="k">Chapter ' + e.seq + " — " + (e.title ? esc(e.title) : "—") + "</span>" + tag(st, cls) + "</div>";
    }
    html += "</div>";
    if (tr.done) html += '<div class="empty"><span class="em">🎬</span>The trilogy is shelved and scored — start another below.</div>';
  }
  if (!tr || tr.done) {
    html += '<div class="sechead"><h2>Start a new trilogy</h2></div><div class="card"><div class="seg">';
    for (i = 0; i < GENRES.length; i++) html += '<button data-action="m2-trilogy-new" data-key="' + GENRES[i].id + '">' + GENRES[i].em + " " + esc(GENRES[i].name) + "</button>";
    html += "</div>"
      + '<div class="empty" style="padding:6px 0 0"><span class="em">🎬</span>Your next three greenlights in the chosen genre fill the slots automatically. Rising quality across chapters pays $30M + 6 reputation; a fading arc earns a shrug from the trades.</div></div>';
  }
  return html;
}

function m2PacksDesk() {
  m2Ensure();
  return '<div class="card">'
    + '<div class="empty" style="padding:0 0 6px"><span class="em">📦</span>Content packs move talent between studios. JSON: {talents:[{n,k,power,skill,fee,fit}]} — max 10 per pack; k actor|dir, power 1-5, skill 20-97, fee 0-40, fit = genre ids.</div>'
    + '<textarea class="text-input" id="packBox" rows="5" placeholder="paste pack JSON here, then Import">' + esc(S.m2.packBox || "") + "</textarea>"
    + '<div class="btnrow"><button class="btn primary" data-action="m2-pack-import">Import</button>'
    + '<button class="btn" data-action="m2-pack-export">Export market</button></div>'
    + "</div>"
    + '<div class="card"><div class="field-label">Current market as pack JSON (top 10 by star power)</div>'
    + '<textarea class="text-input" id="packOut" rows="5" readonly placeholder="press Export market">' + esc(S.m2.packOut || "") + "</textarea></div>";
}

var META2_DESKS = [
  { id: "m2-pass",    group: "Career 2", icon: "🎯", name: "Season pass",    desc: "Ten goals per game-year with instant rewards — 8+ unlocks the Gold theme.", render: m2PassDesk },
  { id: "m2-legends", group: "Career 2", icon: "🗿", name: "Hall of legends", desc: "Your most durable directors and stars, ranked by films and quality.", render: m2LegendsDesk },
  { id: "m2-trilogy", group: "Career 2", icon: "🎬", name: "Trilogy board",   desc: "Name a trilogy, pick a genre — matching greenlights fill its three slots.", render: m2TrilogyDesk },
  { id: "m2-packs",   group: "Career 2", icon: "📦", name: "Content packs",   desc: "Import and export talent packs as JSON to share rosters between saves.", render: m2PacksDesk }
];

/* Wiring lives in engine.js (optional tickMeta2) and ui.js (meta2Action + desk shell +
   tutorialBanner) — no self-wiring. */
