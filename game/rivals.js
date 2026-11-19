/* Box Office War — rebuilt. Rival war room module (v46 module 1) — all state under S.rivalwar.
   Systems: weekly industry-share tracking against the four rival studios, rival reactions to
   your dominance (aggression when a rival is losing badly to you, retreat when it is crushed),
   counter-programming slots and trade-press spins bought with cash, and a reaction/taunt board.

   The engine's tickRivals() now accumulates S.rivals[].ytd and .lifetime weekly and resets ytd
   at the year boundary. This module READS those fields and S.studio.lifetime; it never writes
   them. The player's own year-to-date gross is not stored by the engine, so it is derived here
   from S.films (films released in S.studio.year: f.ww once done, f.dom while still running).

   Wiring (integrator, all typeof-guarded):
   - advanceWeek() calls tickRivalWar() (double-tick guarded by S.rivalwar.lastTick).
   - tickRivals() should multiply a rival's opening by rivalReactionMult(S.rivals[r].name)
     right after the slot's openEst/season/econ line (~line 706); your own opening gets
     rivalCounterMult(p) inside expectedOpening(); the poach roll adds rivalWarPoachBoost()
     to its probability. None of the three hooks is wired yet — until they are, the module
     tracks and displays state but changes no box office.
   - ui.js bridges rivalwarAction() in onAction() and appends RIVAL_DESKS in collectDesks().
   NOTE: rivalCounterMult(p) is NOT in the v46 hook list — the integrator must add
   if (typeof rivalCounterMult === "function") open *= rivalCounterMult(p) || 1;
   beside the other expectedOpening hooks, otherwise a bought counter slot only damps
   reactions (which it does on its own) and the opening lift stays inert. */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var RW_HIST_CAP = 60;        /* weeks of share history kept */
var RW_REACT_WEEKS = 3;      /* a reaction cools off after this many weeks */
var RW_COUNTER_WEEKS = 4;    /* counter-programming slot lifetime */
var RW_COUNTER_COST = 6;     /* base cost, +2 for each slot already live */
var RW_COUNTER_STEP = 2;
var RW_SPIN_COST = 3.5;
var RW_SPIN_WEEKS = 3;
var RW_TAUNT_CAP = 8;
var RW_CRUSH_REL = 0.34;     /* rival share below this fraction of yours = crushed */
var RW_LOSE_REL = 0.62;      /* below this = losing badly */

var RW_TAUNTS = {
  aggressive: [
    "{R} books a tentpole on your weekend. Message received.",
    "{R} doubles its marketing spend and takes out full-page ads. They are coming for you.",
    "{R} buys the trailer slot in front of the season's biggest release.",
    "{R}'s chief taunts your slate in the trades: “they got lucky once”.",
    "{R} starts calling your stars' agents with offers."
  ],
  retreat: [
    "{R} quietly moves its next tentpole off your weekend.",
    "{R} cuts its development slate and calls it “a strategic reset”.",
    "{R}'s chairman calls your studio “the new benchmark” — through gritted teeth.",
    "{R} shelves two pictures rather than open against you.",
    "{R} stops returning the trades' calls. The silence is the compliment."
  ]
};

/* ── state (lazy ensure — old saves have no S.rivalwar) ───────── */
function rwEnsure() {
  if (!S) return null;
  if (!S.rivalwar) S.rivalwar = {};
  var W = S.rivalwar;
  if (!W.shareHist) W.shareHist = [];
  if (!W.react) W.react = {};
  if (!W.prev) W.prev = {};
  if (!W.delta) W.delta = {};
  if (!W.counters) W.counters = [];
  if (!W.taunts) W.taunts = [];
  if (!W.spins) W.spins = {};
  if (!isFinite(W.lastTick)) W.lastTick = 0;
  if (!isFinite(W.spend)) W.spend = 0;
  if (!isFinite(W.bestShare)) W.bestShare = 0;
  if (!isFinite(W.bestRank)) W.bestRank = 99;
  if (!isFinite(W.crushWeeks)) W.crushWeeks = 0;
  if (!isFinite(W.countersBought)) W.countersBought = 0;
  if (!isFinite(W.spinsBought)) W.spinsBought = 0;
  if (!isFinite(W.poachThreats)) W.poachThreats = 0;
  if (!isFinite(W.counterLift)) W.counterLift = 0;
  return W;
}

/* ── display helpers ──────────────────────────────────────────── */
function rwPct(x) {
  if (!isFinite(x)) return "—";
  return (Math.round(clamp(x, 0, 1) * 1000) / 10).toFixed(1) + "%";
}
function rwStyleName(style) {
  if (style === "tentpole") return "Tentpole";
  if (style === "prestige") return "Prestige";
  if (style === "genre") return "Genre";
  return "Your studio";
}
function rwRivalByName(name) {
  var i;
  if (typeof rivalByName === "function") return rivalByName(name);
  if (!S || !S.rivals) return null;
  for (i = 0; i < S.rivals.length; i++) if (S.rivals[i].name === name) return S.rivals[i];
  return null;
}

/* ── player year-to-date gross (derived, never stored) ────────── */
function rwFilmYear(f) {
  if (!f || !isFinite(f.releaseWeek)) return null;
  return Math.floor((f.releaseWeek - 1) / 52) + 1;
}
function rwPlayerYtd() {
  if (!S || !S.studio || !S.films) return 0;
  var t = 0, i, f, y;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (!f) continue;
    y = rwFilmYear(f);
    if (y !== null && y !== S.studio.year) continue;   /* last season's gross does not count */
    if (f.status === "done") t += isFinite(f.ww) ? f.ww : (isFinite(f.dom) ? f.dom : 0);
    else if (f.status === "run") t += isFinite(f.dom) ? f.dom : 0;
  }
  return Math.round(t * 10) / 10;
}

/* One ranking snapshot: player row first-class, every rival, sorted by ytd. */
function rwRivalRows() {
  var rows = [], i, r, ytd, tot, py;
  py = rwPlayerYtd();
  tot = py;
  rows.push({ name: (S && S.studio ? S.studio.name : "Your studio"), mine: true, style: "you", ytd: py, power: 1 });
  if (S && S.rivals) {
    for (i = 0; i < S.rivals.length; i++) {
      r = S.rivals[i];
      if (!r) continue;
      ytd = isFinite(r.ytd) ? r.ytd : 0;
      tot += ytd;
      rows.push({ name: r.name, mine: false, style: r.style || "genre", ytd: ytd, power: isFinite(r.power) ? r.power : 1 });
    }
  }
  for (i = 0; i < rows.length; i++) rows[i].share = tot > 0 ? rows[i].ytd / tot : 0;
  rows.sort(function (a, b) { return b.ytd - a.ytd; });
  for (i = 0; i < rows.length; i++) rows[i].rank = tot > 0 ? i + 1 : 0;
  return { rows: rows, total: Math.round(tot * 10) / 10, player: py };
}

/* ── engine hook: the player's share of industry gross this year ── */
function rivalWarShare() {
  if (!S || !S.studio) return 0;
  var d = rwRivalRows();
  if (!(d.total > 0)) return 0;
  return clamp(d.player / d.total, 0, 1);
}

/* ── reaction model ───────────────────────────────────────────── */
function rwTargetMult(playerShare, rivalShare) {
  if (!(playerShare > 0)) return 1;
  if (!(rivalShare > 0)) return 1;      /* a rival with nothing out yet has no opinion */
  var rel = rivalShare / Math.max(playerShare, 0.0001);
  if (rel < RW_CRUSH_REL) return 0.88;   /* crushed — pull back */
  if (rel < RW_LOSE_REL) return 1.10;    /* losing badly — get aggressive */
  if (rel < 0.95) return 1.04;           /* still behind — push a little */
  return 1;
}
function rwCounterFor(name) {
  var W = S && S.rivalwar ? S.rivalwar : null, i, c;
  if (!W || !W.counters) return null;
  for (i = 0; i < W.counters.length; i++) {
    c = W.counters[i];
    if (c.rival === name && S.studio.week <= c.until) return c;
  }
  return null;
}
/* Extra hook: opening multiplier on YOUR film from live counter slots. 1 when nothing. */
function rivalCounterMult(p) {
  if (!S || !S.rivalwar || !p) return 1;
  var W = rwEnsure(), i, c, lift = 1, wk;
  if (!W || !W.counters.length) return 1;
  for (i = 0; i < W.counters.length; i++) {
    c = W.counters[i];
    if (S.studio.week > c.until) continue;
    wk = rwNextSlotWeek(c.rival);
    if (wk == null || !isFinite(p.releaseWeek) || Math.abs(wk - p.releaseWeek) > 2) continue;
    lift += 0.03;
  }
  return Math.round(clamp(lift, 1, 1.12) * 1000) / 1000;
}

/* ── engine hook: multiplier on a rival's opening next week ───── */
function rivalReactionMult(rivalName) {
  if (!S || !S.rivalwar || !rivalName) return 1;
  var W = S.rivalwar;
  if (!W.react) return 1;
  var r = W.react[rivalName];
  if (!r) return 1;
  if (S.studio.week - r.week > RW_REACT_WEEKS + 1) return 1;
  var m = isFinite(r.mult) ? r.mult : 1;
  if (rwCounterFor(rivalName)) m *= 0.94;                    /* a counter slot blunts the push */
  if (W.spins && W.spins[rivalName] != null && S.studio.week - W.spins[rivalName] <= RW_SPIN_WEEKS) m *= 0.92;
  return Math.round(clamp(m, 0.7, 1.25) * 1000) / 1000;
}

/* ── engine hook: extra poaching probability while you dominate ── */
function rivalWarPoachBoost() {
  if (!S || !S.studio) return 0;
  var share = rivalWarShare();
  var b = (share - 0.30) * 1.2;
  return Math.round(clamp(b, 0, 0.25) * 1000) / 1000;
}

/* ── engine hook: no recurring cash from this module ──────────── */
function forecastAdjust_rivalwar() { return 0; }

/* ── slate helpers ────────────────────────────────────────────── */
function rwNextSlotWeek(name) {
  var r = rwRivalByName(name), i, best = null, s;
  if (!r || !r.slots) return null;
  for (i = 0; i < r.slots.length; i++) {
    s = r.slots[i];
    if (!s || s.done) continue;
    if (!isFinite(s.week) || s.week < S.studio.week) continue;
    if (best === null || s.week < best) best = s.week;
  }
  return best;
}
function rwNextSlot(name) {
  var r = rwRivalByName(name), i, best = null, s;
  if (!r || !r.slots) return null;
  for (i = 0; i < r.slots.length; i++) {
    s = r.slots[i];
    if (!s || s.done) continue;
    if (!isFinite(s.week) || s.week < S.studio.week) continue;
    if (best === null || s.week < best.week) best = s;
  }
  return best;
}

/* ── weekly tick ──────────────────────────────────────────────── */
function tickRivalWar() {
  if (!S || S.over) return;
  var W = rwEnsure();
  if (!W) return;
  if (W.lastTick === S.studio.week) return;   /* double-tick guard */
  W.lastTick = S.studio.week;

  var d = rwRivalRows();
  var share = d.total > 0 ? clamp(d.player / d.total, 0, 1) : 0;
  var i, row, cur, mult, kind, was, logs = 0, taunt = null, rank = 0, pv;

  W.shareHist.push({ w: S.studio.week, s: Math.round(share * 1000) / 1000 });
  if (W.shareHist.length > RW_HIST_CAP) W.shareHist.splice(0, W.shareHist.length - RW_HIST_CAP);
  if (share > W.bestShare) W.bestShare = Math.round(share * 1000) / 1000;

  /* week-over-week change per studio, then refresh the snapshot */
  var deltas = {};
  for (i = 0; i < d.rows.length; i++) {
    row = d.rows[i];
    pv = W.prev[row.name];
    deltas[row.name] = pv == null ? 0 : Math.round((row.ytd - pv) * 10) / 10;
    if (row.mine) rank = row.rank;
  }
  W.delta = deltas;
  for (i = 0; i < d.rows.length; i++) W.prev[d.rows[i].name] = d.rows[i].ytd;
  if (d.total > 0 && rank > 0 && rank < W.bestRank) W.bestRank = rank;
  if (rank === 1 && d.rows.length > 1) W.crushWeeks++;

  /* reactions: who is coming for you, who is backing off */
  for (i = 0; i < d.rows.length; i++) {
    row = d.rows[i];
    if (row.mine) continue;
    mult = rwTargetMult(share, row.share);
    cur = W.react[row.name];
    was = cur ? cur.kind : "";
    if (Math.abs(mult - 1) > 0.001) {
      kind = mult < 1 ? "retreat" : "aggressive";
      W.react[row.name] = { mult: Math.round(mult * 1000) / 1000, kind: kind, week: S.studio.week };
      if (was !== kind && logs < 1) {
        log(kind === "retreat"
          ? "⚔️ " + row.name + " pulls back from your weekends — the retreat is on."
          : "⚔️ " + row.name + " goes on the warpath: bigger campaigns, harder dates against you.",
          kind === "retreat" ? "good" : "bad", "⚔️");
        logs++;
      }
      if (taunt === null || chance(0.4)) taunt = { name: row.name, kind: kind };
    } else if (cur && S.studio.week - cur.week > RW_REACT_WEEKS) {
      delete W.react[row.name];
    }
  }

  /* counter slots age out */
  for (i = W.counters.length - 1; i >= 0; i--) {
    if (S.studio.week > W.counters[i].until) W.counters.splice(i, 1);
  }
  W.counterLift = Math.round(Math.min(0.12, 0.03 * W.counters.length) * 1000) / 1000;

  /* a taunt lands now and then */
  if (taunt && chance(0.5)) {
    var pool = RW_TAUNTS[taunt.kind];
    if (pool && pool.length) {
      W.taunts.unshift({ txt: pick(pool).replace("{R}", taunt.name), kind: taunt.kind, week: S.studio.week });
      if (W.taunts.length > RW_TAUNT_CAP) W.taunts.length = RW_TAUNT_CAP;
    }
  }

  /* domination draws poaching raids */
  if (rivalWarPoachBoost() > 0.08 && chance(0.10)) {
    W.poachThreats++;
    W.taunts.unshift({ txt: "A rival's casting chief is calling your stars' agents. Retainers may be needed.", kind: "aggressive", week: S.studio.week });
    if (W.taunts.length > RW_TAUNT_CAP) W.taunts.length = RW_TAUNT_CAP;
  }
}

/* ── paid actions ─────────────────────────────────────────────── */
function rwCounterCost() {
  var W = S && S.rivalwar ? S.rivalwar : null;
  var n = W && W.counters ? W.counters.length : 0;
  return Math.round((RW_COUNTER_COST + RW_COUNTER_STEP * n) * 10) / 10;
}
function rwBuyCounter(name) {
  var W = rwEnsure();
  if (!W) return { err: "No studio loaded." };
  var r = rwRivalByName(name);
  if (!r) return { err: "Unknown rival studio." };
  if (rwCounterFor(name)) return { err: "A counter slot against " + name + " is already live." };
  var cost = rwCounterCost();
  if (!(S.studio.cash >= cost)) return { err: "Need " + fm(cost) + " for a counter-programming slot." };
  spend(cost, "Counter-programming · " + name);
  W.counters.push({ rival: name, week: S.studio.week, until: S.studio.week + RW_COUNTER_WEEKS, cost: cost });
  W.spend = Math.round((W.spend + cost) * 10) / 10;
  W.countersBought++;
  W.counterLift = Math.round(Math.min(0.12, 0.03 * W.counters.length) * 1000) / 1000;
  log("⚔️ Counter-programming slot bought against " + name + " — " + fm(cost) + ", four weeks of cover.", "gold", "⚔️");
  toast("⚔️ Counter slot vs " + name + " — " + fm(cost) + ".", "good");
  return { ok: true, cost: cost };
}
function rwSpin(name) {
  var W = rwEnsure();
  if (!W) return { err: "No studio loaded." };
  var r = rwRivalByName(name);
  if (!r) return { err: "Unknown rival studio." };
  if (!(S.studio.cash >= RW_SPIN_COST)) return { err: "Need " + fm(RW_SPIN_COST) + " to plant a trade-press story." };
  spend(RW_SPIN_COST, "Trade-press story · " + name);
  W.spins[name] = S.studio.week;
  W.spend = Math.round((W.spend + RW_SPIN_COST) * 10) / 10;
  W.spinsBought++;
  W.taunts.unshift({ txt: "Your spin doctors put " + name + " on the back foot in the trades.", kind: "retreat", week: S.studio.week });
  if (W.taunts.length > RW_TAUNT_CAP) W.taunts.length = RW_TAUNT_CAP;
  log("🗞️ A planted trade story rattles " + name + " — " + fm(RW_SPIN_COST) + " well spent.", "", "🗞️");
  toast("🗞️ Story planted against " + name + ".", "good");
  return { ok: true, cost: RW_SPIN_COST };
}
function rwScout() {
  var W = rwEnsure(), d, i, row, s, best = null, bestName = "", txt;
  if (!W) return { err: "No studio loaded." };
  d = rwRivalRows();
  for (i = 0; i < d.rows.length; i++) {
    row = d.rows[i];
    if (row.mine) continue;
    s = rwNextSlot(row.name);
    if (s && (best === null || s.week < best.week)) { best = s; bestName = row.name; }
  }
  if (!best) {
    toast("No rival picture is on the calendar. The slate is yours.", "");
    return { ok: true, none: true };
  }
  txt = "🕵️ Scouting: " + bestName + " opens “" + best.title + "” in week " + best.week
    + " (est. " + fm(best.openEst || 0) + ").";
  log(txt, "", "🕵️");
  toast(txt, "");
  W.scouted = S.studio.week;
  return { ok: true, week: best.week };
}

/* ── commit + action delegation (ui calls rivalwarAction) ─────── */
function rwCommit() {
  if (typeof saveGame === "function") saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function rivalwarAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("rivalwar-") !== 0) return false;
  rwEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var r;
  switch (a) {
    case "rivalwar-counter": r = rwBuyCounter(id); break;
    case "rivalwar-spin": r = rwSpin(id); break;
    case "rivalwar-scout": r = rwScout(); break;
    default: return false;
  }
  if (r && r.err) { toast(r.err, "bad"); return true; }
  rwCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function rwReactTag(name) {
  var m = rivalReactionMult(name);
  if (m > 1.02) return tag("Warpath ×" + m.toFixed(2), "red");
  if (m < 0.98) return tag("Retreating ×" + m.toFixed(2), "green");
  return tag("Watching", "");
}
function rwRankLabel(row, d) {
  return d.total > 0 && row.rank ? "#" + row.rank : "—";
}
function rwSparkHTML(W) {
  var list = W.shareHist.slice(-16), i, max = 0.01, pct, html = '<div class="chart">';
  for (i = 0; i < list.length; i++) if (list[i].s > max) max = list[i].s;
  for (i = 0; i < list.length; i++) {
    pct = Math.max(4, Math.round(list[i].s / max * 100));
    html += '<div class="c' + (i === list.length - 1 ? " me" : "") + '"><i style="height:' + pct + '%"></i><span>W'
      + woyOf(list[i].w) + "</span></div>";
  }
  return html + "</div>";
}

function rwShareDesk() {
  if (!S || !S.studio) return "";
  var W = rwEnsure();
  var d = rwRivalRows();
  var share = d.total > 0 ? clamp(d.player / d.total, 0, 1) : 0;
  var rank = 0, i, row, trend, html = "";
  for (i = 0; i < d.rows.length; i++) if (d.rows[i].mine) rank = d.rows[i].rank;

  html += '<div class="card">'
    + statrow("Your year-to-date gross", fm(d.player), d.player > 0 ? "up" : "")
    + statrow("Industry year-to-date", fm(d.total))
    + statrow("Your market share", rwPct(share), share >= 0.25 ? "up" : "")
    + statrow("Rank this week", d.total > 0 && rank ? "#" + rank + " of " + d.rows.length : "—")
    + statrow("Best share this run", rwPct(W.bestShare))
    + "</div>";

  html += '<div class="sechead"><h2>Your share, recent weeks</h2></div><div class="card">';
  if (W.shareHist.length > 1) html += rwSparkHTML(W);
  else html += '<div class="empty"><span class="em">📊</span>Two weeks of trading are needed before the share line means anything.</div>';
  html += "</div>";

  html += '<div class="sechead"><h2>Industry ranking · year ' + (S.studio.year || 1) + "</h2></div>";
  for (i = 0; i < d.rows.length; i++) {
    row = d.rows[i];
    trend = W.delta && W.delta[row.name] != null ? W.delta[row.name] : 0;
    html += '<div class="card film"><div class="head"><div class="title">'
      + (row.mine ? "🏛️ " : "") + esc(row.name) + "</div>" + tag(rwRankLabel(row, d), row.mine ? "gold" : "") + "</div>";
    html += '<div class="meta">' + tag(rwStyleName(row.style), row.mine ? "gold" : "blue")
      + tag(fm(row.ytd) + " ytd") + tag(rwPct(row.share) + " share")
      + (row.mine ? tag("You", "gold") : rwReactTag(row.name)) + "</div>";
    html += '<div class="bar' + (row.mine ? " green" : "") + '"><i style="width:'
      + Math.round(clamp(row.share, 0, 1) * 100) + '%"></i></div>';
    html += '<div class="statrow"><span class="k">Change this week</span><span class="v num '
      + (trend >= 0 ? "up" : "down") + '">' + (trend >= 0 ? "+" : "") + fm(trend) + "</span></div>";
    html += "</div>";
  }
  return html;
}

function rwWarDesk() {
  if (!S || !S.studio) return "";
  var W = rwEnsure();
  var d = rwRivalRows();
  var share = d.total > 0 ? clamp(d.player / d.total, 0, 1) : 0;
  var aggressive = 0, retreating = 0, i, row, s, m, cost, can, html = "";

  for (i = 0; i < d.rows.length; i++) {
    row = d.rows[i];
    if (row.mine) continue;
    m = rivalReactionMult(row.name);
    if (m > 1.02) aggressive++;
    else if (m < 0.98) retreating++;
  }

  html += '<div class="card">'
    + statrow("Your market share", rwPct(share), share >= 0.25 ? "up" : "")
    + statrow("Rivals on the warpath", String(aggressive), aggressive ? "down" : "")
    + statrow("Rivals in retreat", String(retreating), retreating ? "up" : "")
    + statrow("Counter slots live", String(W.counters.length) + " · lift ×" + (1 + W.counterLift).toFixed(2))
    + statrow("War chest spent", fm(W.spend), W.spend > 0 ? "down" : "")
    + statrow("Poach threats logged", String(W.poachThreats))
    + "</div>";

  html += '<div class="sechead"><h2>The reaction board</h2></div>';
  if (d.rows.length <= 1) {
    html += '<div class="card"><div class="empty"><span class="em">⚔️</span>No rival studios are trading. The field is yours.</div></div>';
  }
  for (i = 0; i < d.rows.length; i++) {
    row = d.rows[i];
    if (row.mine) {
      /* the player's own row, so the war room reads as a full league table */
      html += '<div class="card film"><div class="head"><div class="title">🏛️ ' + esc(row.name) + "</div>"
        + tag("You", "gold") + "</div>";
      html += '<div class="meta">' + tag(rwStyleName(row.style), "gold") + tag(fm(row.ytd) + " ytd")
        + tag(rwPct(row.share) + " share") + tag("Rank " + rwRankLabel(row, d), "gold") + "</div>";
      html += '<div class="statrow"><span class="k">Your share of the industry</span><span class="v num '
        + (share >= 0.25 ? "up" : "") + '">' + rwPct(share) + "</span></div>";
      html += '<div class="statrow"><span class="k">Counter-programming lift in force</span><span class="v num up">×'
        + (1 + W.counterLift).toFixed(2) + "</span></div>";
      html += "</div>";
      continue;
    }
    s = rwNextSlot(row.name);
    cost = rwCounterCost();
    can = S.studio.cash >= cost;
    m = rivalReactionMult(row.name);
    html += '<div class="card film"><div class="head"><div class="title">' + esc(row.name) + "</div>"
      + tag(rwRankLabel(row, d), "") + "</div>";
    html += '<div class="meta">' + tag(rwStyleName(row.style), "blue")
      + tag(fm(row.ytd) + " ytd") + tag(rwPct(row.share) + " share") + rwReactTag(row.name) + "</div>";
    html += '<div class="statrow"><span class="k">Next picture</span><span class="v num">'
      + (s ? esc(s.title) + " · W" + woyOf(s.week) : "nothing dated") + "</span></div>";
    html += '<div class="statrow"><span class="k">Counter-programming slot · '
      + RW_COUNTER_WEEKS + " wk · " + fm(cost) + " (after " + fm(S.studio.cash - cost) + ")</span>"
      + '<button class="btn sm" data-action="rivalwar-counter" data-id="' + esc(row.name) + '" '
      + (can ? "" : "disabled") + ">Counter</button></div>";
    html += '<div class="statrow"><span class="k">Plant a trade-press story · ' + fm(RW_SPIN_COST)
      + " · their opening −8% for " + RW_SPIN_WEEKS + ' wk</span>'
      + '<button class="btn sm" data-action="rivalwar-spin" data-id="' + esc(row.name) + '" '
      + (S.studio.cash >= RW_SPIN_COST ? "" : "disabled") + ">Plant</button></div>";
    if (m > 1.02) {
      html += '<div class="statrow"><span class="k">They are pushing: their next opening gets ×'
        + m.toFixed(2) + '</span><span class="v">' + tag("Danger", "red") + "</span></div>";
    } else if (m < 0.98) {
      html += '<div class="statrow"><span class="k">They are pulling back: their next opening gets ×'
        + m.toFixed(2) + '</span><span class="v">' + tag("Advantage", "green") + "</span></div>";
    }
    html += "</div>";
  }

  html += '<div class="sechead"><h2>Counter-programming</h2></div><div class="card">';
  html += '<div class="statrow"><span class="k">Slots live · your opening lift</span><span class="v num up">×'
    + (1 + W.counterLift).toFixed(2) + "</span></div>";
  html += '<div class="statrow"><span class="k">Slots bought this run</span><span class="v num">'
    + String(W.countersBought) + "</span></div>";
  html += '<div class="statrow"><span class="k">Scout the rival calendar · free</span>'
    + '<button class="btn sm" data-action="rivalwar-scout">Scout</button></div>';
  if (W.counters.length) {
    for (i = 0; i < W.counters.length; i++) {
      html += '<div class="statrow"><span class="k">' + esc(W.counters[i].rival) + " · until week "
        + W.counters[i].until + '</span><span class="v num">' + fm(W.counters[i].cost) + "</span></div>";
    }
  } else {
    html += '<div class="empty"><span class="em">⚔️</span>No counter slots live. Buy one against a rival opening and your picture gets the weekend to itself.</div>';
  }
  html += "</div>";

  html += '<div class="sechead"><h2>The trade papers</h2></div><div class="card">';
  if (!W.taunts.length) {
    html += '<div class="empty"><span class="em">🗞️</span>No taunts yet. Rivals only talk once you start beating them.</div>';
  } else {
    for (i = 0; i < W.taunts.length; i++) {
      html += '<div class="statrow"><span class="k">' + esc(W.taunts[i].txt) + '</span><span class="v num">W'
        + woyOf(W.taunts[i].week) + "</span></div>";
    }
  }
  html += "</div>";
  return html;
}

var RIVAL_DESKS = [
  { id: "rivalwar-share", group: "Industry", icon: "📊", name: "Industry ranking",
    desc: "Year-to-date gross, market share, rank and weekly trend for you and all four rival studios.",
    render: rwShareDesk },
  { id: "rivalwar-war", group: "Industry", icon: "⚔️", name: "Rival war room",
    desc: "Who is on the warpath, who is retreating, and the counter-programming slots and trade-press stories you can buy.",
    render: rwWarDesk }
];

/* ── achievements published to meta.js (merged by allAchievements()) ── */
var RIVAL_ACHIEVEMENTS = [
  { id: "rivalwar-first-counter", tier: 1, name: "Counter-programmed",
    desc: "Buy your first counter-programming slot against a rival studio.",
    test: function (S) { return !!S && !!S.rivalwar && S.rivalwar.countersBought >= 1; } },
  { id: "rivalwar-share25", tier: 2, name: "A quarter of the market",
    desc: "Hold at least 25% of industry gross in a single week.",
    test: function (S) { return !!S && !!S.rivalwar && S.rivalwar.bestShare >= 0.25; } },
  { id: "rivalwar-rank1", tier: 2, name: "Top of the trades",
    desc: "Rank first among the studios on year-to-date gross.",
    test: function (S) { return !!S && !!S.rivalwar && S.rivalwar.bestRank <= 1; } },
  { id: "rivalwar-crush", tier: 3, name: "Crushed the competition",
    desc: "Push a rival studio into retreat while holding a third of the market.",
    test: function (S) {
      if (!S || !S.rivalwar || !S.rivalwar.react) return false;
      if (!(S.rivalwar.bestShare >= 0.33)) return false;
      var k;
      for (k in S.rivalwar.react) {
        if (Object.prototype.hasOwnProperty.call(S.rivalwar.react, k) && S.rivalwar.react[k].kind === "retreat") return true;
      }
      return false;
    } },
  { id: "rivalwar-spend25", tier: 3, name: "War chest",
    desc: "Spend $25M on counter-programming and trade-press stories.",
    test: function (S) { return !!S && !!S.rivalwar && S.rivalwar.spend >= 25; } },
  { id: "rivalwar-share40", tier: 3, name: "Dominant studio",
    desc: "Hold 40% of industry gross in a single week.",
    test: function (S) { return !!S && !!S.rivalwar && S.rivalwar.bestShare >= 0.40; } }
];
