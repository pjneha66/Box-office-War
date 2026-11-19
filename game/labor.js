/* Box Office War — rebuilt. Union & labour relations (v46 module 7).
   Systems: four guilds (writers / actors / directors / crew-IATSE) each with a mood
   0..100, a wage index, a contract expiry week and a live cost contribution. Contract
   countdowns, mood drift toward a wage/reputation-driven target, strike clocks and
   negotiation windows all advance in tickLabor().
   Engine hooks (typeof-guarded on the engine side):
   - laborCostMult()  → multiplier on per-week production burn. Exactly 1 when there is
                        no state, clamped to [0.90, 1.50].
   - laborStrikeMod() → added to the weekly strike-roll threshold. Exactly 0 on a fresh
                        save, clamped to [-0.06, +0.10] so the engine's else-if chain
                        (strike 0.77, piracy 0.80) keeps its ordering.
   Actions (bridged by ui.js onAction): labor-concede (wage package), labor-negotiate
   (data-key = residual | backend | refuse | concede), labor-lockout.
   Desks (LABOR_DESKS, group "Studio ops"): labor-guilds, labor-talks.
   All state under S.labor; lazy laborEnsure() rebuilds it on an old save.
   No self-wiring: the integrator calls tickLabor() inside advanceWeek(). */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var LABOR_GUILDS = [
  { id: "writers",   name: "Writers Guild",   short: "WGA",   weight: 0.18, first: 26 },
  { id: "actors",    name: "Actors Guild",    short: "SAG",   weight: 0.34, first: 34 },
  { id: "directors", name: "Directors Guild", short: "DGA",   weight: 0.22, first: 42 },
  { id: "crew",      name: "Crew & IATSE",    short: "IATSE", weight: 0.26, first: 50 }
];

/* Four negotiation options, priced and mood-scored by laborDealCost / laborDealMood. */
var LABOR_DEALS = [
  { id: "concede",  name: "Concede a wage package", verb: "concede to", btn: "Concede",
    ledger: "Wage concession", note: "Cash today, real money on the wage index." },
  { id: "residual", name: "Offer gross residuals",  verb: "offer",     btn: "Offer",
    ledger: "Residual advance", note: "A share of every future box-office week." },
  { id: "backend",  name: "Offer back-end points",  verb: "offer",     btn: "Offer",
    ledger: "Back-end advance", note: "Cheap now, a liability once films open." },
  { id: "refuse",   name: "Refuse to budge",        verb: "refuse",    btn: "Refuse",
    ledger: "", note: "No cash. Mood and strike risk take the hit." }
];

var LABOR_MOOD0 = 65;          /* the mood at which a guild costs exactly its weight */var LABOR_CONTRACT_WEEKS = 52;
var LABOR_INTERIM_WEEKS = 12;  /* an expired contract falls back to an interim deal */
var LABOR_RESIDUAL_STEP = 0.004;
var LABOR_RESIDUAL_CAP = 0.02;
var LABOR_BACKEND_CAP = 3;
var LABOR_WAGE_MIN = 0.78;
var LABOR_WAGE_MAX = 1.35;

/* ── lookups ──────────────────────────────────────────────────── */
function laborGuildDef(id) {
  var i;
  for (i = 0; i < LABOR_GUILDS.length; i++) if (LABOR_GUILDS[i].id === id) return LABOR_GUILDS[i];
  return null;
}
function laborDealDef(id) {
  var i;
  for (i = 0; i < LABOR_DEALS.length; i++) if (LABOR_DEALS[i].id === id) return LABOR_DEALS[i];
  return null;
}
function laborWeek() {
  return (S && S.studio && isFinite(S.studio.week)) ? S.studio.week : 1;
}
function laborRound1(x) { return Math.round(x * 10) / 10; }
function laborGuildOf(id) {
  if (!S || !S.labor || !S.labor.guilds) return null;
  return S.labor.guilds[id] || null;
}

/* ── state (lazy ensure — old saves have no S.labor) ──────────── */
function laborNormalizeGuild(g, def) {
  if (!isFinite(g.mood)) g.mood = LABOR_MOOD0;
  g.mood = clamp(g.mood, 0, 100);
  if (!isFinite(g.wage) || g.wage <= 0) g.wage = 1;
  g.wage = clamp(g.wage, LABOR_WAGE_MIN, LABOR_WAGE_MAX);
  if (!isFinite(g.expWeek)) g.expWeek = laborWeek() + def.first;
  if (g.status !== "expired") g.status = "ok";
  if (!isFinite(g.expiredWk)) g.expiredWk = 0;
  if (!isFinite(g.weeksExpired)) g.weeksExpired = 0;
  if (!isFinite(g.militant)) g.militant = 0;
  g.militant = clamp(Math.round(g.militant), 0, 3);
  if (!isFinite(g.strikeWk) || g.strikeWk < 0) g.strikeWk = 0;
  if (!isFinite(g.residual)) g.residual = 0;
  g.residual = clamp(g.residual, 0, LABOR_RESIDUAL_CAP);
  if (!isFinite(g.backend)) g.backend = 0;
  g.backend = clamp(Math.round(g.backend), 0, LABOR_BACKEND_CAP);
  if (!isFinite(g.deals)) g.deals = 0;
  if (!isFinite(g.renewals)) g.renewals = 0;
  if (!isFinite(g.refusals)) g.refusals = 0;
  if (!isFinite(g.conceded)) g.conceded = 0;
  if (!isFinite(g.residualPaid)) g.residualPaid = 0;
  if (!isFinite(g.backendPaid)) g.backendPaid = 0;
}
function laborEnsure() {
  if (!S) return null;
  if (!S.labor) S.labor = { lastTick: -1, guilds: null, strikes: 0, lockouts: 0, interims: 0,
    conceded: 0, residualPaid: 0, backendPaid: 0, deals: 0 };
  var L = S.labor, wk = laborWeek(), i, def, g;
  if (!L.guilds) L.guilds = {};
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = L.guilds[def.id];
    if (!g) {
      L.guilds[def.id] = {
        id: def.id, weight: def.weight, mood: LABOR_MOOD0, wage: 1, expWeek: wk + def.first,
        status: "ok", expiredWk: 0, weeksExpired: 0, militant: 0, strikeWk: 0,
        residual: 0, backend: 0, deals: 0, renewals: 0, refusals: 0,
        conceded: 0, residualPaid: 0, backendPaid: 0
      };
      continue;
    }
    g.weight = def.weight;
    laborNormalizeGuild(g, def);
  }
  if (!isFinite(L.lastTick)) L.lastTick = -1;
  if (!isFinite(L.strikes)) L.strikes = 0;
  if (!isFinite(L.lockouts)) L.lockouts = 0;
  if (!isFinite(L.interims)) L.interims = 0;
  if (!isFinite(L.conceded)) L.conceded = 0;
  if (!isFinite(L.residualPaid)) L.residualPaid = 0;
  if (!isFinite(L.backendPaid)) L.backendPaid = 0;
  if (!isFinite(L.deals)) L.deals = 0;
  return L;
}

/* ── cost model ───────────────────────────────────────────────── */

/* One guild's contribution index: 1.00 at the default mood and wage.
   wageF 0.923..1.1225 · moodF 0.9125..1.1625 · pad 1.00..1.18 */
function laborNum(x, fallback) { return isFinite(x) ? x : fallback; }
function laborCostIndex(g) {
  if (!g) return 1;
  var wageF = 0.65 + 0.35 * clamp(laborNum(g.wage, 1), LABOR_WAGE_MIN, LABOR_WAGE_MAX);
  var moodF = 1 + (LABOR_MOOD0 - clamp(laborNum(g.mood, LABOR_MOOD0), 0, 100)) / 400;
  var pad = 1;
  if (g.status === "expired") pad += 0.05;
  if (laborNum(g.strikeWk, 0) > 0) pad += 0.07;
  pad += 0.02 * clamp(laborNum(g.militant, 0), 0, 3);
  var v = wageF * moodF * pad;
  return isFinite(v) && v > 0 ? v : 1;
}

/* Engine hook: multiplier on the weekly production burn (engine.js ~line 329).
   No state → exactly 1. Never 0, never negative. Clamped [0.90, 1.50]. */
function laborCostMult() {
  if (!S || !S.labor || !S.labor.guilds) return 1;
  var i, def, g, raw = 0, wsum = 0;
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = S.labor.guilds[def.id];
    if (!g) continue;
    raw += def.weight * laborCostIndex(g);
    wsum += def.weight;
  }
  if (!isFinite(raw) || raw <= 0 || wsum <= 0) return 1;
  if (Math.abs(wsum - 1) > 1e-6) raw = raw / wsum;      /* a guild is missing */
  if (S.strike > 0) raw *= 1.03;                        /* engine's own walkout */
  raw = clamp(raw, 0.9, 1.5);
  return Math.round(raw * 1000) / 1000;
}

/* Engine hook: added to the weekly strike-roll threshold (engine.js ~line 850).
   Fresh save → exactly 0. Clamped [-0.06, +0.10] so "roll < 0.77 + mod" can never
   swallow the 0.80 piracy branch by more than the spec allows. */
function laborStrikeMod() {
  if (!S || !S.labor || !S.labor.guilds) return 0;
  var i, def, g, avg = 0, wsum = 0, extra = 0;
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = S.labor.guilds[def.id];
    if (!g) continue;
    avg += def.weight * clamp(laborNum(g.mood, LABOR_MOOD0), 0, 100);
    wsum += def.weight;
    if (g.status === "expired") extra += 0.02;
    if (laborNum(g.strikeWk, 0) > 0) extra += 0.03;
    extra += 0.008 * clamp(laborNum(g.militant, 0), 0, 3);
  }
  if (wsum <= 0) return 0;
  avg = avg / wsum;
  var mod = (LABOR_MOOD0 - avg) / 714;   /* ±0.049 at the ends of the mood scale */
  /* structural surcharges are capped well under the 0.10 ceiling so the clamp stays a
     safety net: at 0.77 + 0.10 the engine's 0.80 piracy branch would be unreachable. */
  mod += Math.min(extra, 0.025);
  mod = clamp(mod, -0.06, 0.10);
  return isFinite(mod) ? Math.round(mod * 10000) / 10000 : 0;
}

/* Weighted average guild mood, for the desk header. */
function laborAvgMood() {
  if (!S || !S.labor || !S.labor.guilds) return LABOR_MOOD0;
  var i, def, g, avg = 0, wsum = 0;
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = S.labor.guilds[def.id];
    if (!g) continue;
    avg += def.weight * clamp(laborNum(g.mood, LABOR_MOOD0), 0, 100);
    wsum += def.weight;
  }
  if (wsum <= 0) return LABOR_MOOD0;
  var v = avg / wsum;
  return isFinite(v) ? Math.round(v * 10) / 10 : LABOR_MOOD0;
}

/* ── negotiation pricing ──────────────────────────────────────── */
function laborDealCost(g, dealId) {
  var gap = 1 + (100 - clamp(g.mood, 0, 100)) / 120;   /* angry guilds demand more */
  var w = clamp(g.wage, LABOR_WAGE_MIN, LABOR_WAGE_MAX);
  if (dealId === "concede") return laborRound1((5 + g.weight * 26 * gap) * w);
  if (dealId === "residual") return laborRound1((2 + g.weight * 9 * gap) * w);
  if (dealId === "backend") return laborRound1((0.5 + g.weight * 4 * gap) * w);
  if (dealId === "lockout") return laborRound1(1.5 + g.weight * 6);
  return 0;   /* refuse is free */
}
function laborDealMood(g, dealId) {
  var bonus = (g.status === "expired") ? 3 : 0;
  if (dealId === "concede") return 9 + bonus;
  if (dealId === "residual") return 13 + bonus;
  if (dealId === "backend") return 8 + bonus;
  if (dealId === "refuse") return -12;
  if (dealId === "lockout") return -20;
  return 0;
}
function laborExpired(g) { return g.status === "expired"; }
function laborContractLeft(g) { return Math.round(g.expWeek - laborWeek()); }

function laborContractText(g) {
  if (laborExpired(g)) return "Expired " + Math.round(g.weeksExpired) + " wk ago";
  var left = laborContractLeft(g);
  if (left <= 0) return "Expires this week";
  if (left === 1) return "1 wk left";
  return left + " wk left";
}
function laborMoodLabel(mood) {
  if (mood >= 82) return "Content";
  if (mood >= 66) return "Steady";
  if (mood >= 50) return "Uneasy";
  if (mood >= 30) return "Angry";
  return "Hostile";
}
function laborMoodClass(mood) {
  if (mood >= 70) return "green";
  if (mood >= 40) return "";
  return "red";
}

/* ── renewal ──────────────────────────────────────────────────── */
function laborRenew(g) {
  g.status = "ok";
  g.expWeek = laborWeek() + LABOR_CONTRACT_WEEKS;
  g.expiredWk = 0;
  g.weeksExpired = 0;
  g.renewals = (g.renewals || 0) + 1;
  if (g.strikeWk > 0) g.strikeWk = 0;
  if (g.militant > 0) g.militant = Math.max(0, g.militant - 2);
}

var LABOR_LOCKOUT = { id: "lockout", name: "Lock the guild out", verb: "lock out", btn: "Lock out",
  ledger: "Lockout cost", note: "Wage bill down 6%, mood -20, strike risk up." };

/* ── the one negotiation entry point (all four options + lockout) ── */
function laborDeal(gid, dealId) {
  laborEnsure();
  var def = laborGuildDef(gid), g = laborGuildOf(gid);
  var deal = dealId === "lockout" ? LABOR_LOCKOUT : laborDealDef(dealId);
  if (!def || !g) return { err: "Unknown guild." };
  if (!deal) return { err: "Unknown proposal." };
  var cost = laborDealCost(g, deal.id), before = g.mood, delta, L = S.labor;

  if (cost > 0 && S.studio.cash < cost) {
    var what = deal.id === "lockout" ? "lock out" : deal.verb;
    return { err: "Need " + fm(cost) + " to " + what + " the " + def.name + "." };
  }
  if (cost > 0) spend(cost, deal.ledger + " · " + def.name);

  delta = laborDealMood(g, deal.id);
  if (deal.id === "concede") {
    g.wage = clamp(g.wage + 0.035, LABOR_WAGE_MIN, LABOR_WAGE_MAX);
    g.conceded = laborRound1((g.conceded || 0) + cost);
    L.conceded = laborRound1((L.conceded || 0) + cost);
    g.deals++;
    L.deals++;
    if (laborExpired(g) || laborContractLeft(g) <= 12) laborRenew(g);
  } else if (deal.id === "residual") {
    g.residual = Math.min(LABOR_RESIDUAL_CAP, Math.round((g.residual + LABOR_RESIDUAL_STEP) * 1000) / 1000);
    g.deals++;
    L.deals++;
    if (laborExpired(g) || laborContractLeft(g) <= 12) laborRenew(g);
  } else if (deal.id === "backend") {
    g.backend = Math.min(LABOR_BACKEND_CAP, g.backend + 1);
    g.deals++;
    L.deals++;
    if (laborExpired(g) || laborContractLeft(g) <= 12) laborRenew(g);
  } else if (deal.id === "refuse") {
    g.refusals = (g.refusals || 0) + 1;
    g.militant = Math.min(3, g.militant + 1);
  } else if (deal.id === "lockout") {
    g.wage = clamp(g.wage - 0.06, LABOR_WAGE_MIN, LABOR_WAGE_MAX);
    g.militant = Math.min(3, g.militant + 2);
    g.strikeWk = Math.max(g.strikeWk, 2);
    L.lockouts = (L.lockouts || 0) + 1;
  }
  g.mood = clamp(g.mood + delta, 0, 100);

  if (deal.id === "refuse") {
    log("🪧 You refuse the " + def.name + " package — talks break down and the picket threat grows.", "bad", "🪧");
    toast(def.name + " talks collapse · mood " + delta + ".", "bad");
  } else if (deal.id === "lockout") {
    log("🚪 You lock out the " + def.name + " — wage bill down, mood and morale through the floor.", "bad", "🚪");
    toast(def.name + " locked out · mood " + delta + ".", "bad");
  } else {
    log("🤝 " + def.name + " signs: " + deal.name.toLowerCase() + " for " + fm(cost) + " — mood +" + delta + ".", "good", "🤝");
    toast(def.name + " deal signed · " + fm(cost) + " · mood +" + delta + ".", "good");
  }
  return { ok: true, cost: cost, moodBefore: Math.round(before), mood: Math.round(g.mood), delta: delta };
}

/* ── weekly tick (engine calls this at the end of advanceWeek) ── */
function laborGuildTarget(g) {
  var rep = (S.studio && isFinite(S.studio.rep)) ? S.studio.rep : 35;
  var t = LABOR_MOOD0
    + (clamp(g.wage, LABOR_WAGE_MIN, LABOR_WAGE_MAX) - 1) * 140
    + (g.residual || 0) * 400
    + (g.backend || 0) * 4
    + (rep - 35) * 0.2
    - (g.militant || 0) * 10
    - (laborExpired(g) ? 15 : 0)
    - (g.strikeWk > 0 ? 10 : 0);
  return clamp(t, 4, 97);
}

function laborGuildWeek(g, def, wk, L) {
  var target;
  /* 1. contract clock */
  if (!laborExpired(g) && wk >= g.expWeek) {
    g.status = "expired";
    g.expiredWk = wk;
    g.weeksExpired = 0;
    g.mood = clamp(g.mood - 22, 0, 100);
    g.militant = Math.min(3, g.militant + 1);
    if (L.logged < 1) {
      log("🪧 The " + def.name + " contract expired — mood collapses and every production costs more until you renew.", "bad", "🪧");
      L.logged++;
    }
  } else if (laborExpired(g)) {
    g.weeksExpired = Math.max(0, wk - g.expiredWk);
    g.mood = clamp(g.mood - 1, 0, 100);
    if (g.weeksExpired > 0 && g.weeksExpired % 4 === 0) g.militant = Math.min(3, g.militant + 1);
    if (g.weeksExpired >= LABOR_INTERIM_WEEKS) {
      laborRenew(g);
      g.mood = clamp(g.mood + 6, 0, 100);
      g.wage = clamp(g.wage + 0.02, LABOR_WAGE_MIN, LABOR_WAGE_MAX);
      L.interims = (L.interims || 0) + 1;
      if (L.logged < 1) {
        log("🤝 An interim agreement with the " + def.name + " ends the standoff — " + LABOR_INTERIM_WEEKS + " weeks of peace, wages tick up.", "", "🤝");
        L.logged++;
      }
    }
  }
  /* 2. strike clock */
  if (g.strikeWk > 0) {
    g.strikeWk--;
    if (g.strikeWk === 0) {
      g.mood = clamp(g.mood + 4, 0, 100);
      if (L.logged < 1) {
        log("🏁 The " + def.name + " walkout ends — crews report back, picket lines down.", "good", "🏁");
        L.logged++;
      }
    }
  } else if (g.mood < 30 && g.militant >= 2 && chance(0.18)) {
    g.strikeWk = 4;
    L.strikes = (L.strikes || 0) + 1;
    if (L.logged < 1) {
      log("💥 The " + def.name + " walks out — four weeks of picket lines and cost overruns.", "bad", "💥");
      L.logged++;
    }
  }
  /* 3. mood drifts one point a week toward its target */
  target = laborGuildTarget(g);
  if (g.mood < target) g.mood = Math.min(target, g.mood + 1);
  else if (g.mood > target) g.mood = Math.max(target, g.mood - 1);
  /* 4. militancy cools off once the guild is content again */
  if (g.militant > 0 && g.mood > 70 && g.strikeWk === 0 && chance(0.5)) g.militant--;
  g.mood = Math.round(clamp(g.mood, 0, 100) * 10) / 10;
}

/* This week's own theatrical receipts (already booked by tickTheatrical, which runs
   before tickLabor in advanceWeek). Used as the base for residuals and back-end. */
function laborBoxOfficeThisWeek() {
  if (!S || !S.weekTx || S.weekTx.w !== S.studio.week || !S.weekTx.rows) return 0;
  var i, rows = S.weekTx.rows, sum = 0;
  for (i = 0; i < rows.length; i++) {
    if (rows[i].v > 0 && rows[i].k.indexOf("Box office · ") === 0) sum += rows[i].v;
  }
  return sum;
}

/* Gross participations: residuals and back-end points are paid out of the week's
   theatrical take, so a deal signed today costs real money exactly when films open. */
function laborPayParticipations() {
  var L = S.labor, bo = laborBoxOfficeThisWeek(), i, def, g, cost;
  if (bo <= 0) return;
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = L.guilds[def.id];
    if (!g) continue;
    if (g.residual > 0) {
      cost = laborRound1(bo * g.residual);
      if (cost >= 0.1) {
        spend(cost, "Residuals · " + def.name);
        g.residualPaid = laborRound1((g.residualPaid || 0) + cost);
        L.residualPaid = laborRound1((L.residualPaid || 0) + cost);
      }
    }
    if (g.backend > 0) {
      cost = laborRound1(bo * 0.002 * g.backend);
      if (cost >= 0.1) {
        spend(cost, "Back-end · " + def.name);
        g.backendPaid = laborRound1((g.backendPaid || 0) + cost);
        L.backendPaid = laborRound1((L.backendPaid || 0) + cost);
      }
    }
  }
}

function tickLabor() {
  if (!S || S.over) return;
  laborEnsure();
  var L = S.labor, i, def, g, wk = S.studio.week;
  if (L.lastTick === wk) return;   /* double-tick guard */
  L.lastTick = wk;
  L.logged = 0;
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = L.guilds[def.id];
    if (g) laborGuildWeek(g, def, wk, L);
  }
  laborPayParticipations();
  L.logged = 0;
}

/* ── commit + action delegation (ui.js onAction bridges laborAction) ── */
function laborCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function laborHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  laborCommit();
}
function laborAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("labor-") !== 0) return false;
  laborEnsure();
  var id = null, key = null;
  if (elx && elx.getAttribute) {
    id = elx.getAttribute("data-id");
    key = elx.getAttribute("data-key");
  }
  if (a === "labor-concede") laborHandle(laborDeal(id, "concede"));
  else if (a === "labor-negotiate") laborHandle(laborDeal(id, key || "residual"));
  else if (a === "labor-lockout") laborHandle(laborDeal(id, "lockout"));
  else return false;
  return true;
}

/* ── desks (render returns the sheet body HTML only) ──────────── */
function laborMoodBar(mood) {
  return '<div class="bar ' + laborMoodClass(mood) + '"><i style="width:'
    + Math.round(clamp(mood, 2, 100)) + '%"></i></div>';
}
function laborSigned(x, dp) {
  var s = (Math.round(x * 1000) / 1000).toFixed(dp);
  if (x > 0) s = "+" + s;
  return s;
}
function laborCostShare(g) {
  var i, def, wsum = 0;
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    if (S.labor.guilds[def.id]) wsum += def.weight;
  }
  if (wsum <= 0) return 0;
  return Math.round((g.weight / wsum) * 100);
}

function laborGuildsDesk() {
  laborEnsure();
  var L = S.labor, html = "", i, def, g, mult = laborCostMult(), risk = laborStrikeMod();
  html += '<div class="card">'
    + statrow("Production cost multiplier", "\u00d7" + mult.toFixed(2), mult > 1.02 ? "down" : mult < 0.98 ? "up" : "")
    + statrow("Strike-risk shift", laborSigned(risk, 2), risk > 0.01 ? "down" : risk < -0.01 ? "up" : "")
    + statrow("Guild mood (weighted)", laborAvgMood().toFixed(1) + " / 100")
    + statrow("Wage concessions paid", fm(L.conceded || 0))
    + statrow("Residual + back-end paid", fm(laborRound1((L.residualPaid || 0) + (L.backendPaid || 0))))
    + "</div>";
  if (L.strikes > 0 || L.lockouts > 0) {
    html += '<div class="sechead"><h2>Labour record</h2></div><div class="card">'
      + statrow("Walkouts called", String(L.strikes || 0), (L.strikes || 0) > 0 ? "down" : "")
      + statrow("Lockouts ordered", String(L.lockouts || 0))
      + statrow("Interim agreements", String(L.interims || 0))
      + "</div>";
  }
  html += '<div class="sechead"><h2>The four guilds</h2></div>';
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = L.guilds[def.id];
    if (!g) continue;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(def.name) + "</div>"
      + tag(esc(def.short), laborExpired(g) ? "red" : "blue") + "</div>";
    html += '<div class="meta">'
      + tag("Mood " + g.mood.toFixed(0) + " · " + laborMoodLabel(g.mood), laborMoodClass(g.mood))
      + tag(laborContractText(g), laborExpired(g) ? "red" : "green")
      + tag("Wage \u00d7" + g.wage.toFixed(2), "")
      + (g.strikeWk > 0 ? tag("On strike " + g.strikeWk + " wk", "red") : "")
      + (g.militant > 0 && g.strikeWk <= 0 ? tag("Militant " + g.militant, "gold") : "")
      + (g.residual > 0 ? tag("Residuals " + Math.round(g.residual * 1000) / 10 + "%", "gold") : "")
      + (g.backend > 0 ? tag("Back-end \u00d7" + g.backend, "gold") : "")
      + "</div>";
    html += laborMoodBar(g.mood);
    html += statrow("Cost effect", "\u00d7" + laborCostIndex(g).toFixed(2) + " · " + laborCostShare(g) + "% of burn",
      laborCostIndex(g) > 1.02 ? "down" : laborCostIndex(g) < 0.98 ? "up" : "");
    html += statrow("Contract", laborContractText(g) + (laborExpired(g) ? " · renew it in Talks" : ""),
      laborExpired(g) ? "down" : "");
    html += "</div>";
  }
  html += '<div class="sechead"><h2>How the multiplier works</h2></div><div class="card">'
    + '<div class="empty"><span class="em">🪧</span>Each guild carries a share of every production burn. '
    + 'Mood and wages move that share between \u00d70.90 and \u00d71.50; an expired contract adds a surcharge '
    + 'until it is renewed in Negotiations.</div></div>';
  return html;
}

function laborDealRow(g, def, deal, locked) {
  var cost = laborDealCost(g, deal.id);
  var delta = laborDealMood(g, deal.id);
  var can = S.studio.cash >= cost;
  var disabled = (!can || locked) ? " disabled" : "";
  var after = fm(S.studio.cash - cost);
  var btnCls = (deal.id === "refuse" || deal.id === "lockout") ? "btn sm danger" : "btn sm";
  var label = esc(deal.name) + " · " + (cost > 0 ? fm(cost) : "free")
    + " · mood " + laborSigned(delta, 0);
  var attr = (deal.id === "concede")
    ? 'data-action="labor-concede"'
    : 'data-action="labor-negotiate" data-key="' + deal.id + '"';
  var afterTxt = cost > 0 ? "after " + after : (deal.id === "refuse" ? "no cost" : "after " + after);
  return '<div class="statrow"><span class="k">' + label + " · <small>" + esc(deal.note) + "</small></span>"
    + '<button class="' + btnCls + '" ' + attr + ' data-id="' + def.id + '"' + disabled + ">"
    + esc(deal.btn) + " · " + afterTxt + "</button></div>";
}

function laborTalksDesk() {
  laborEnsure();
  var L = S.labor, html = "", i, j, def, g, mult = laborCostMult(), risk = laborStrikeMod(), key;
  html += '<div class="card">'
    + statrow("Cash on hand", fm(S.studio.cash))
    + statrow("Cost multiplier now", "\u00d7" + mult.toFixed(2), mult > 1.02 ? "down" : "")
    + statrow("Strike-risk shift now", laborSigned(risk, 2), risk > 0.01 ? "down" : "")
    + statrow("Mood (weighted)", laborAvgMood().toFixed(1) + " / 100")
    + "</div>";
  html += '<div class="sechead"><h2>Open the table</h2></div>'
    + '<div class="card"><div class="empty"><span class="em">🤝</span>Four options per guild. '
    + 'Concede cash for mood, hand over a slice of gross, promise back-end points, or refuse and take the risk. '
    + 'Costs and mood swings below are shown before you commit.</div></div>';
  for (i = 0; i < LABOR_GUILDS.length; i++) {
    def = LABOR_GUILDS[i];
    g = L.guilds[def.id];
    if (!g) continue;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(def.name) + "</div>"
      + tag(laborMoodLabel(g.mood) + " " + g.mood.toFixed(0), laborMoodClass(g.mood)) + "</div>";
    html += '<div class="meta">'
      + tag(laborContractText(g), laborExpired(g) ? "red" : "green")
      + tag("Cost \u00d7" + laborCostIndex(g).toFixed(2), laborCostIndex(g) > 1.02 ? "red" : "")
      + tag("Wage \u00d7" + g.wage.toFixed(2), "")
      + (g.residual > 0 ? tag("Residuals " + Math.round(g.residual * 1000) / 10 + "%", "gold") : "")
      + (g.backend > 0 ? tag("Back-end \u00d7" + g.backend, "gold") : "")
      + "</div>";
    for (j = 0; j < LABOR_DEALS.length; j++) {
      html += laborDealRow(g, def, LABOR_DEALS[j], false);
    }
    key = LABOR_LOCKOUT;
    html += '<div class="statrow"><span class="k">' + esc(key.name) + " · " + fm(laborDealCost(g, "lockout"))
      + " · mood " + laborSigned(laborDealMood(g, "lockout"), 0)
      + " · <small>" + esc(key.note) + "</small></span>"
      + '<button class="btn sm danger" data-action="labor-lockout" data-id="' + def.id + '"'
      + (S.studio.cash >= laborDealCost(g, "lockout") ? "" : " disabled") + ">Lock out · after "
      + fm(S.studio.cash - laborDealCost(g, "lockout")) + "</button></div>";
    html += "</div>";
  }
  html += '<div class="sechead"><h2>What each option really costs</h2></div><div class="card">'
    + statrow("Residuals taken to date", fm(L.residualPaid || 0))
    + statrow("Back-end participation to date", fm(L.backendPaid || 0))
    + statrow("Total wage concessions", fm(L.conceded || 0))
    + statrow("Deals signed", String(L.deals || 0))
    + "</div>";
  return html;
}

var LABOR_DESKS = [
  { id: "labor-guilds", group: "Studio ops", icon: "🪧", name: "Guild relations",
    desc: "The four guilds — mood, contract clock, wage index and the exact share each one adds to production burn.",
    render: laborGuildsDesk },
  { id: "labor-talks", group: "Studio ops", icon: "🤝", name: "Negotiations",
    desc: "Concede wages, offer residuals, promise back-end points or refuse — every cost and mood swing priced before you commit.",
    render: laborTalksDesk }
];

/* ── achievements (merged by meta.js via allAchievements) ─────── */
var LABOR_ACHIEVEMENTS = [
  { id: "labor-first-deal", tier: 1, name: "At the table",
    desc: "Sign your first guild agreement.",
    test: function (S) { return !!S && !!S.labor && S.labor.deals >= 1; } },
  { id: "labor-peace", tier: 2, name: "Labour peace",
    desc: "Hold all four guilds at 85 mood or better at the same time.",
    test: function (S) {
      if (!S || !S.labor || !S.labor.guilds) return false;
      var ids = ["writers", "actors", "directors", "crew"], i;
      for (i = 0; i < ids.length; i++) {
        var g = S.labor.guilds[ids[i]];
        if (!g || !isFinite(g.mood) || g.mood < 85) return false;
      }
      return true;
    } },
  { id: "labor-renewals", tier: 2, name: "Four signatures",
    desc: "Renew every guild's contract at least once.",
    test: function (S) {
      if (!S || !S.labor || !S.labor.guilds) return false;
      var ids = ["writers", "actors", "directors", "crew"], i;
      for (i = 0; i < ids.length; i++) {
        var g = S.labor.guilds[ids[i]];
        if (!g || !isFinite(g.renewals) || g.renewals < 1) return false;
      }
      return true;
    } },
  { id: "labor-concede-25", tier: 2, name: "Chequebook unionism",
    desc: "Pay $25M in wage concessions across your career.",
    test: function (S) { return !!S && !!S.labor && isFinite(S.labor.conceded) && S.labor.conceded >= 25; } },
  { id: "labor-backend-3", tier: 3, name: "Points on the back end",
    desc: "Carry three guild back-end deals at once — cheap now, expensive later.",
    test: function (S) {
      if (!S || !S.labor || !S.labor.guilds) return false;
      var ids = ["writers", "actors", "directors", "crew"], i, n = 0;
      for (i = 0; i < ids.length; i++) {
        var g = S.labor.guilds[ids[i]];
        if (g && isFinite(g.backend)) n += g.backend;
      }
      return n >= 3;
    } }
];
