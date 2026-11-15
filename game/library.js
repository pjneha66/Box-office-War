/* Box Office War — rebuilt. Library, Fan club & Sandbox module — all state under S.lib.
   Systems: library catalogue browser (finished films + territory split hook) ·
   fan club membership tiers (weekly buzz on announced projects) ·
   sandbox (bespoke talent signings, rival meddling).
   Engine hooks defined here (pure, no side effects):
   - filmTerritoryRows(film) → statrow HTML for the film detail sheet's international split.
   - forecastAdjust() → 0 (this module moves no cash weekly; kept uniform for the forecast).
   NOTE for integrator: the engine tick hook is LIVE — engine.js advanceWeek already calls
   tickLibrary() after its own systems (it is idempotent per week, so extra manual calls,
   e.g. from tests, stay safe no-ops). Still to land in ui.js: bridge libAction in onAction,
   add LIB_DESKS to collectDesks(), and append filmTerritoryRows(f) output in sheetFilm.
   - fanOpenBonus (tier-3 opening bump) intentionally NOT defined: tickLibrary already
     applies the buzz, and expectedOpening is shipped engine code. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var LIB_FAN_TIERS = [
  { tier: 1, cost: 8,  name: "Fan club",   buzz: 0.5, desc: "Newsletter, watch parties and a very committed group chat." },
  { tier: 2, cost: 20, name: "Supporters", buzz: 1,   desc: "They show up in costume. Stacks with convention buzz from the PR desk." },
  { tier: 3, cost: 45, name: "Legion",     buzz: 1.5, desc: "A fan army that never lets a release leave the conversation." }
];
var LIB_TERRITORIES = [
  { id: "europe", name: "Europe",        share: 0.30 },
  { id: "apac",   name: "Asia-Pacific",  share: 0.24 },
  { id: "latam",  name: "Latin America", share: 0.16 },
  { id: "japan",  name: "Japan",         share: 0.10 },
  { id: "china",  name: "China",         share: 0.12 },
  { id: "row",    name: "Rest of world", share: 0.08 }
];
var LIB_FILTER = "all";   /* library desk seg filter (UI state, like SERIES_GL) */

/* ── state (lazy ensure — old saves have no S.lib) ────────────── */
function libEnsure() {
  if (!S.lib) S.lib = { fan: { tier: 0 }, custom: 0, lastTick: 0 };
  if (!S.lib.fan) S.lib.fan = { tier: 0 };
}

/* ── fan club ─────────────────────────────────────────────────── */
function libFanBuzz(tier) {
  var i;
  for (i = 0; i < LIB_FAN_TIERS.length; i++) if (LIB_FAN_TIERS[i].tier === tier) return LIB_FAN_TIERS[i].buzz;
  return 0;
}

function libFanBuy() {
  libEnsure();
  var t = S.lib.fan.tier;
  if (t >= LIB_FAN_TIERS.length) return { err: "The Legion is the top tier — nowhere higher to go." };
  var next = LIB_FAN_TIERS[t];
  if (S.studio.cash < next.cost) return { err: "Need " + fm(next.cost) + " to start the " + next.name + "." };
  spend(next.cost, "Fan club · " + next.name);
  S.lib.fan.tier = next.tier;
  log("The " + next.name + " is founded — +" + next.buzz.toFixed(1) + " buzz per week on every announced release.", "gold", "🎉");
  toast("🎉 " + next.name + " founded.", "good");
  return { ok: true, tier: next.tier };
}

/* Weekly: accrue fan buzz on projects that have a locked release date. */
function libTickFan() {
  var amt = libFanBuzz(S.lib.fan.tier);
  if (!amt) return;
  var i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.releaseWeek == null) continue;
    p.buzz = Math.round((p.buzz + amt) * 10) / 10;
  }
}

/* ── sandbox ──────────────────────────────────────────────────── */
function libStrongestRival() {
  var best = null, i;
  for (i = 0; i < S.rivals.length; i++) if (!best || S.rivals[i].ytd > best.ytd) best = S.rivals[i];
  return best;
}
function libWeakestRival() {
  var worst = null, i;
  for (i = 0; i < S.rivals.length; i++) if (!worst || S.rivals[i].ytd < worst.ytd) worst = S.rivals[i];
  return worst;
}

function libSignTalent(kind) {
  libEnsure();
  var cost = kind === "prodigy" ? 8 : kind === "specialist" ? 15 : kind === "animal" ? 12 : 30;
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for the " + kind + " signing." };
  var t = genTalent(pick(["actor", "dir"]));
  var g = null;
  if (kind === "animal") {
    /* Box Office Sim 2 cast database (restored from the previous build): species + animal name banks */
    var B = (typeof window !== "undefined" && window.BOS2_CAST) || null;
    if (!B || !B.animals || !B.animals.length) return { err: "The animal cast database is not loaded." };
    t.k = "actor";
    t.power = Math.max(t.power, 3);
    t.skill = ri(60, 85);
    var sp = pick(B.animals);
    t.n = (chance(0.5) ? pick(B.animalMale) : pick(B.animalFemale)) + " the " + sp.n;
    t.animal = true;
    t.ability = "bos2_" + sp.id;
    t.fit = [pick(GENRES).id, pick(GENRES).id];
  } else if (kind === "prodigy") {
    t.power = ri(2, 3); t.skill = ri(60, 80); t.age = ri(18, 22);
  } else if (kind === "specialist") {
    t.power = 3; t.skill = ri(70, 85);
    g = pick(GENRES);
    t.fit = [g.id, g.id];
  } else {
    t.power = 5; t.skill = ri(80, 95);
  }
  /* power was overridden — re-derive the fee from the fee table */
  t.fee = t.k === "actor" ? FEE_ACTOR[t.power - 1] : FEE_DIR[t.power - 1];
  spend(cost, "Sandbox · " + kind);
  S.market.push(t);
  S.lib.custom++;
  if (kind === "prodigy") {
    log(t.n + ", a " + t.age + "-year-old prodigy (★" + t.power + ", skill " + t.skill + "), signs out of the sandbox program.", "gold", "🧪");
  } else if (kind === "specialist") {
    log(t.n + " signs as a " + g.name + " specialist — ★3, skill " + t.skill + ", genre fit locked in twice.", "", "🧪");
  } else {
    log("Legend " + t.n + " joins the roster (★★★★★, skill " + t.skill + "). Casting directors rejoice.", "gold", "🧪");
  }
  toast("🧪 " + t.n + " signed.", "good");
  return { ok: true, talent: t };
}

function libUndercut() {
  libEnsure();
  var r = libStrongestRival();
  if (!r) return { err: "No rivals to undercut." };
  if (r.power <= 0.5) return { err: r.name + " is already at the power floor." };
  if (S.studio.cash < 25) return { err: "Need " + fm(25) + " to run the sabotage campaign." };
  spend(25, "Sandbox · undercut " + r.name);
  var old = r.power;
  r.power = Math.max(Math.round(r.power * 0.9 * 100) / 100, 0.5);
  S.studio.rep = clamp(S.studio.rep - 1, 0, 100);
  log(r.name + " loses ground — key deals fell through (power " + old.toFixed(2) + " → " + r.power.toFixed(2) + ").", "good", "🧪");
  toast("🧪 " + r.name + " undercut.", "good");
  return { ok: true };
}

function libBoost() {
  libEnsure();
  var r = libWeakestRival();
  if (!r) return { err: "No rivals to boost." };
  if (S.studio.cash < 10) return { err: "Need " + fm(10) + " to run the puff campaign." };
  spend(10, "Sandbox · boost " + r.name);
  var old = r.power;
  r.power = Math.round((r.power + 0.08) * 100) / 100;
  log(r.name + " gains momentum (power " + old.toFixed(2) + " → " + r.power.toFixed(2) + ") — the field just got harder.", "bad", "🧪");
  toast("🧪 " + r.name + " boosted.", "");
  return { ok: true };
}

/* ── engine hooks ─────────────────────────────────────────────── */
/* International territory split for a film's detail sheet. Pure — no log/save/render.
   Shares are of f.intl; genre skews shift one territory, then all shares are clamped
   to 0.03–0.40 and normalized to sum 1. */
function filmTerritoryRows(f) {
  if (!f || !isFinite(f.intl) || !(f.intl > 0)) return "";
  var adj = null;
  if (f.genre === "animation") adj = { china: 0.05 };
  else if (f.genre === "horror") adj = { china: -0.06 };
  else if (f.genre === "action") adj = { apac: 0.04 };
  var i, t, s, shares = [], total = 0;
  for (i = 0; i < LIB_TERRITORIES.length; i++) {
    t = LIB_TERRITORIES[i];
    s = t.share + (adj && adj[t.id] ? adj[t.id] : 0);
    s = clamp(s, 0.03, 0.40);
    shares.push({ name: t.name, s: s });
    total += s;
  }
  var html = "";
  for (i = 0; i < shares.length; i++) {
    html += statrow(shares[i].name, fm(shares[i].s / total * f.intl));
  }
  html += '<div class="empty" style="padding:6px 0 0">'
    + (adj ? genreOf(f.genre).name + " audiences skew the map · " : "")
    + "estimated split of " + fm(f.intl) + " international · exhibitor terms vary</div>";
  return html;
}

/* This module adds no weekly cash flows — forecast stays clean. */
function forecastAdjust_library() { return 0; }

/* ── weekly tick (engine.js advanceWeek calls tickLibrary() after its own systems) ── */
function tickLibrary() {
  if (!S || S.over) return;
  libEnsure();
  if (S.lib.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.lib.lastTick = S.studio.week;
  libTickFan();
}

/* ── commit + action delegation (ui calls libAction first) ────── */
function libCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function libHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  libCommit();
}
function libAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("lib-") !== 0) return false;
  libEnsure();
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  switch (a) {
    case "lib-filter":
      if (key === "all" || key === "hits" || key === "franchise") LIB_FILTER = key;
      return true;
    case "lib-fan-buy": libHandle(libFanBuy()); return true;
    case "lib-prodigy": libHandle(libSignTalent("prodigy")); return true;
    case "lib-specialist": libHandle(libSignTalent("specialist")); return true;
    case "lib-legend": libHandle(libSignTalent("legend")); return true;
    case "lib-animal": libHandle(libSignTalent("animal")); return true;
    case "lib-undercut": libHandle(libUndercut()); return true;
    case "lib-boost": libHandle(libBoost()); return true;
    default: return false;
  }
}

/* ── desks ────────────────────────────────────────────────────── */
function libFilmRow(f) {
  var g = genreOf(f.genre);
  var k = g.em + " " + esc(f.title)
    + (f.franchiseOf ? " " + tag("Sequel · " + esc(f.franchiseOf), "blue") : "")
    + (f.restored ? " " + tag("Restored", "gold") : "");
  var v = fm(f.ww) + " " + tag((f.profit >= 0 ? "+" : "") + fm(f.profit), f.profit >= 0 ? "green" : "red");
  return statrow(k, v);
}
function libFilteredFilms() {
  var out = [], i, f;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "done") continue;
    if (LIB_FILTER === "hits" && !(f.profit > 0)) continue;
    if (LIB_FILTER === "franchise" && !f.franchiseOf) continue;
    out.push(f);
  }
  return out;
}

function libLibraryDesk() {
  libEnsure();
  var list = libFilteredFilms(), sum = 0, i;
  for (i = 0; i < list.length; i++) if (isFinite(list[i].ww)) sum += list[i].ww;
  var html = '<div>'
    + '<div class="seg">'
    + '<button class="' + (LIB_FILTER === "all" ? "on" : "") + '" data-action="lib-filter" data-key="all">All</button>'
    + '<button class="' + (LIB_FILTER === "hits" ? "on" : "") + '" data-action="lib-filter" data-key="hits">Hits</button>'
    + '<button class="' + (LIB_FILTER === "franchise" ? "on" : "") + '" data-action="lib-filter" data-key="franchise">Franchise</button>'
    + "</div>"
    + '<div class="card" style="margin-top:10px">'
    + statrow("Finished films", list.length)
    + statrow("Worldwide gross total", fm(sum))
    + statrow("Catalog value", fm(S.studio.catalog))
    + "</div>";
  if (!S.films.some(function (f) { return f.status === "done"; })) {
    html += '<div class="card"><div class="empty"><span class="em">📚</span>No finished films yet. Titles land here when their theatrical run ends.</div></div>';
  } else if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">📚</span>Nothing matches this filter.</div></div>';
  } else {
    html += '<div class="card">';
    for (i = 0; i < list.length; i++) html += libFilmRow(list[i]);
    html += "</div>";
  }
  return html + "</div>";
}

function libFanDesk() {
  libEnsure();
  var t = S.lib.fan.tier, amt = libFanBuzz(t);
  var html = '<div>'
    + '<div class="card">'
    + statrow("Membership", t ? esc(LIB_FAN_TIERS[t - 1].name) : "None")
    + statrow("Weekly buzz on announced releases", amt ? "+" + amt.toFixed(1) + "/wk" : "—", amt ? "up" : "")
    + "</div>";
  if (t < LIB_FAN_TIERS.length) {
    var next = LIB_FAN_TIERS[t];
    html += '<div class="sechead"><h2>Upgrade</h2></div>'
      + '<div class="card">'
      + '<div class="statrow"><span class="k">' + esc(next.name) + " — +" + next.buzz.toFixed(1) + " buzz/wk on announced releases"
      + "<br><small style='color:var(--faint)'>" + esc(next.desc) + "</small></span>"
      + '<button class="btn primary sm" data-action="lib-fan-buy" ' + (S.studio.cash < next.cost ? "disabled" : "") + ">Join · " + fm(next.cost) + "</button></div>"
      + statrow("Cost", fm(next.cost) + " · cash after " + fm(S.studio.cash - next.cost))
      + "</div>";
  } else {
    html += '<div class="card"><div class="empty"><span class="em">🎉</span>The Legion is yours — the biggest fan army in town.</div></div>';
  }
  html += '<div class="card"><div class="empty" style="padding:8px 0 0">Buzz accrues every week on each project with a locked release date, on top of viral moments and conventions.</div></div>';
  return html + "</div>";
}

function libSandboxDesk() {
  libEnsure();
  var strong = libStrongestRival(), weak = libWeakestRival();
  var html = '<div>'
    + '<div class="sechead"><h2>Sign bespoke talent</h2></div>'
    + '<div class="card">'
    + '<div class="statrow"><span class="k">Craft a prodigy · ' + fm(8) + "<br><small style='color:var(--faint)'>★2–3 · skill 60–80 · age 18–22 · cash after " + fm(S.studio.cash - 8) + "</small></span>"
    + '<button class="btn sm" data-action="lib-prodigy" ' + (S.studio.cash < 8 ? "disabled" : "") + ">Craft</button></div>"
    + '<div class="statrow"><span class="k">Sign a genre specialist · ' + fm(15) + "<br><small style='color:var(--faint)'>★3 · skill 70–85 · double genre fit · cash after " + fm(S.studio.cash - 15) + "</small></span>"
    + '<button class="btn sm" data-action="lib-specialist" ' + (S.studio.cash < 15 ? "disabled" : "") + ">Sign</button></div>"
    + '<div class="statrow"><span class="k">Sign a legend · ' + fm(30) + "<br><small style='color:var(--faint)'>★★★★★ · skill 80–95 · cash after " + fm(S.studio.cash - 30) + "</small></span>"
    + '<button class="btn sm" data-action="lib-legend" ' + (S.studio.cash < 30 ? "disabled" : "") + ">Sign</button></div>"
    + '<div class="statrow"><span class="k">Sign an animal star · ' + fm(12) + "<br><small style='color:var(--faint)'>a trained animal actor from the cast database, species ability included · cash after " + fm(S.studio.cash - 12) + "</small></span>"
    + '<button class="btn sm" data-action="lib-animal" ' + (S.studio.cash < 12 ? "disabled" : "") + ">Sign</button></div>"
    + "</div>";
  if (strong && weak) {
    html += '<div class="sechead"><h2>Nudge the field</h2></div>'
      + '<div class="card">'
      + '<div class="statrow"><span class="k">Undercut ' + esc(strong.name) + " · " + fm(25) + "<br><small style='color:var(--faint)'>their power ×0.9 (floor 0.5) · your rep −1 · cash after " + fm(S.studio.cash - 25) + "</small></span>"
      + '<button class="btn sm" data-action="lib-undercut" ' + (S.studio.cash < 25 || strong.power <= 0.5 ? "disabled" : "") + ">Undercut</button></div>"
      + '<div class="statrow"><span class="k">Boost ' + esc(weak.name) + " · " + fm(10) + "<br><small style='color:var(--faint)'>their power +0.08 — for a harder game · cash after " + fm(S.studio.cash - 10) + "</small></span>"
      + '<button class="btn sm" data-action="lib-boost" ' + (S.studio.cash < 10 ? "disabled" : "") + ">Boost</button></div>"
      + "</div>";
  }
  html += '<div class="card">' + statrow("Bespoke signings", S.lib.custom) + "</div>";
  return html + "</div>";
}

var LIB_DESKS = [
  { id: "library-desk", group: "Library & fans", icon: "📚", name: "Library", desc: "Your catalogue — every finished film, its worldwide gross and net result.", render: libLibraryDesk },
  { id: "fan-club", group: "Library & fans", icon: "🎉", name: "Fan club", desc: "Membership tiers that keep your releases in the conversation.", render: libFanDesk },
  { id: "sandbox", group: "Library & fans", icon: "🧪", name: "Sandbox", desc: "Creator tools — sign bespoke talent and nudge the world.", render: libSandboxDesk }
];
