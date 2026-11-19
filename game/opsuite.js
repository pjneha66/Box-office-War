/* Box Office War — rebuilt. Studio operations module — all state under S.ops.
   Systems: product placement on films in production (4 sponsor tiers pay an instant
   advance and store a critic-score penalty at release) · physical media pressing runs on
   finished films (steelbook / collector box; sell-through scales with worldwide gross) ·
   C-suite officers (4 hires with a signing fee and a real weekly salary deducted by
   tickStudioOps(), each perk wired to an exported numeric hook).
   Wiring: integrator calls tickStudioOps() inside advanceWeek(), bridges opsuiteAction()
   in ui.js onAction() and appends OPS_DESKS in collectDesks(); engine applies
   opsCreditMod() to the critic score and opsCostMult()/opsOverheadMult() to its own
   numbers. No self-wiring. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var OPS_SPONSORS = [
  { id: "automotive", name: "Luxury automotive chase",   category: "Vehicles",       advance: 12, penalty: 0.15 },
  { id: "smartphone", name: "Flagship phone & wearables", category: "Consumer tech",  advance: 8,  penalty: 0.10 },
  { id: "watch",      name: "Haute-horlogerie wristwear", category: "Luxury fashion", advance: 6,  penalty: 0.05 },
  { id: "beverage",   name: "Energy drink integration",   category: "Beverage",       advance: 5,  penalty: 0.05 }
];
var OPS_MEDIA = [
  { id: "steelbook", name: "4K steelbook run",    cost: 2,   units: 0.5,  margin: 18 },
  { id: "collector", name: "Collector's box set", cost: 3.5, units: 0.25, margin: 32 }
];
var OPS_OFFICERS = [
  { id: "cfo", title: "Chief Financial Officer", name: "Evelyn Marsh", sign: 4, salary: 0.1,
    perk: "All production and pressing costs -12%." },
  { id: "cmo", title: "Chief Marketing Officer", name: "Marcus Vane", sign: 5, salary: 0.2,
    perk: "Brand deals pay +20% up-front advances." },
  { id: "casting", title: "Head of Global Casting", name: "Helena Ross", sign: 3.5, salary: 0.1,
    perk: "Likeness rights lift home-video sell-through 25% (talent fees -10%)." },
  { id: "coo", title: "Chief Operating Officer", name: "David Caine", sign: 4.5, salary: 0.2,
    perk: "Studio overhead -15% every week." }
];
var OPS_PHASES = ["shoot", "post", "ready"];
var OPS_PLACE_WEEKS = 26;

/* ── state (lazy ensure — old saves have no S.ops) ────────────── */
function opsEnsure() {
  if (!S.ops) S.ops = { lastTick: 0, placements: [], media: [], officers: {}, sponsorCash: 0, mediaProfit: 0, payrollPaid: 0 };
  if (!S.ops.placements) S.ops.placements = [];
  if (!S.ops.media) S.ops.media = [];
  if (!S.ops.officers) S.ops.officers = {};
  if (!isFinite(S.ops.sponsorCash)) S.ops.sponsorCash = 0;
  if (!isFinite(S.ops.mediaProfit)) S.ops.mediaProfit = 0;
  if (!isFinite(S.ops.payrollPaid)) S.ops.payrollPaid = 0;
  if (!isFinite(S.ops.lastTick)) S.ops.lastTick = 0;
}

function opsFindSponsor(id) { var i; for (i = 0; i < OPS_SPONSORS.length; i++) if (OPS_SPONSORS[i].id === id) return OPS_SPONSORS[i]; return null; }
function opsFindMedia(id) { var i; for (i = 0; i < OPS_MEDIA.length; i++) if (OPS_MEDIA[i].id === id) return OPS_MEDIA[i]; return null; }
function opsFindOfficer(id) { var i; for (i = 0; i < OPS_OFFICERS.length; i++) if (OPS_OFFICERS[i].id === id) return OPS_OFFICERS[i]; return null; }
function opsHired(id) { opsEnsure(); return !!S.ops.officers[id]; }
function opsSponsorName(id) { var sp = opsFindSponsor(id); return sp ? sp.name : id; }

/* Weekly payroll = sum of the salaries actually on the books. */
function opsPayroll() {
  opsEnsure();
  var t = 0, i, o;
  for (i = 0; i < OPS_OFFICERS.length; i++) {
    o = OPS_OFFICERS[i];
    if (S.ops.officers[o.id]) t += o.salary;
  }
  return Math.round(t * 100) / 100;
}

/* ── engine hooks (typeof-guarded calls from engine.js) ───────── */
/* Critic-score addition for a film carrying a placement: negative points, 0 when none.
   Accepts the project/film object (p.opsPlace or p.opsPenalty) or a bare project id. */
function opsCreditMod(x) {
  if (!S || !x) return 0;
  opsEnsure();
  var i, id, row;
  if (typeof x === "string") {
    id = x;
    for (i = 0; i < S.ops.placements.length; i++) {
      row = S.ops.placements[i];
      if (row.projId === id) return -Math.round(row.penalty * 100);
    }
    return 0;
  }
  if (isFinite(x.opsPenalty) && x.opsPenalty > 0) return -Math.round(x.opsPenalty * 100);
  if (x.opsPlace && isFinite(x.opsPlace.penalty) && x.opsPlace.penalty > 0) return -Math.round(x.opsPlace.penalty * 100);
  id = x.id;
  if (!id) return 0;
  for (i = 0; i < S.ops.placements.length; i++) {
    row = S.ops.placements[i];
    if (row.projId === id) return -Math.round(row.penalty * 100);
  }
  return 0;
}
function opsOverheadMult() { if (!S) return 1; return opsHired("coo") ? 0.85 : 1; }
function opsCostMult() { if (!S) return 1; return opsHired("cfo") ? 0.88 : 1; }
/* CMO lever: brand deals pay more while the marketing chief is seated. */
function opsAdvanceMult() { if (!S) return 1; return opsHired("cmo") ? 1.2 : 1; }
/* Casting lever: talent signing fees -10% (engine may multiply feeFor by this). */
function opsCastingFeeMult() { if (!S) return 1; return opsHired("casting") ? 0.9 : 1; }

/* ── mechanics ────────────────────────────────────────────────── */
function opsSellThrough(f) {
  opsEnsure();
  var gross = f && isFinite(f.ww) ? f.ww : (f && isFinite(f.dom) ? f.dom : 0);
  var s = clamp(0.4 + gross / 300, 0.4, 1);
  if (S.ops.officers.casting) s = clamp(s * 1.25, 0.4, 1);
  return s;
}
function opsMediaCost(tier) { return Math.round(tier.cost * opsCostMult() * 10) / 10; }
function opsMediaProfit(f, tier) { return Math.round(tier.units * tier.margin * opsSellThrough(f) * 10) / 10; }

function opsPlace(projId, sponsorId) {
  opsEnsure();
  var sp = opsFindSponsor(sponsorId), p = findProject(projId);
  if (!sp) return { err: "Unknown sponsor." };
  if (!p) return { err: "That project is not in production." };
  if (OPS_PHASES.indexOf(p.phase) < 0) return { err: "Placements need the film in shooting, post or ready." };
  if (p.opsPlace) return { err: "“" + p.title + "” already carries a brand placement." };
  var adv = Math.round(sp.advance * opsAdvanceMult() * 10) / 10;
  p.opsPlace = { sponsor: sp.id, advance: adv, penalty: sp.penalty };
  p.opsPenalty = sp.penalty;
  S.ops.placements.push({
    id: "op" + (S.seq++), projId: p.id, title: p.title, sponsor: sp.id,
    advance: adv, penalty: sp.penalty, week: S.studio.week
  });
  S.ops.sponsorCash = Math.round((S.ops.sponsorCash + adv) * 10) / 10;
  earn(adv, "Placement · " + sp.category + " · " + p.title);
  log("🏷️ " + sp.name + " signs on “" + p.title + "” — " + fm(adv) + " up front, critics -" + Math.round(sp.penalty * 100) + " at release.", "gold", "🏷️");
  toast("🏷️ Placement signed: +" + fm(adv) + ".", "good");
  return { ok: true, advance: adv };
}

function opsPress(filmId, tierId) {
  opsEnsure();
  var f = findFilm(filmId), t = opsFindMedia(tierId);
  if (!t) return { err: "Unknown home-video edition." };
  if (!f) return { err: "Unknown film." };
  if (f.status !== "done") return { err: "Only films that finished their theatrical run can be pressed." };
  if (f.opsMedia && f.opsMedia[t.id]) return { err: "“" + f.title + "” already has that edition." };
  var cost = opsMediaCost(t);
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for the pressing run." };
  var profit = opsMediaProfit(f, t);
  spend(cost, "Pressing · " + t.name + " · " + f.title);
  earn(profit, "Home video · " + t.name + " · " + f.title);
  if (!f.opsMedia) f.opsMedia = {};
  f.opsMedia[t.id] = S.studio.week;
  S.ops.media.push({ id: "op" + (S.seq++), filmId: f.id, title: f.title, tier: t.id, cost: cost, profit: profit, week: S.studio.week });
  S.ops.mediaProfit = Math.round((S.ops.mediaProfit + profit) * 10) / 10;
  log("💿 " + t.name + " for “" + f.title + "” — " + fm(cost) + " pressed, " + fm(profit) + " sell-through.", "good", "💿");
  toast("💿 " + t.name + " shipped for “" + f.title + "”.", "good");
  return { ok: true, cost: cost, profit: profit, net: Math.round((profit - cost) * 10) / 10 };
}

function opsHire(id) {
  opsEnsure();
  var o = opsFindOfficer(id);
  if (!o) return { err: "Unknown executive." };
  if (S.ops.officers[o.id]) return { err: o.title + " already sits on the executive floor." };
  if (S.studio.cash < o.sign) return { err: "Need " + fm(o.sign) + " for the signing fee." };
  spend(o.sign, "Signing fee · " + o.title);
  S.ops.officers[o.id] = { id: o.id, name: o.name, salary: o.salary, week: S.studio.week };
  log("🧑‍💼 " + o.name + " joins as " + o.title + " — " + fm(o.sign) + " signing fee, " + fm(o.salary) + "/week.", "gold", "🧑‍💼");
  toast("🧑‍💼 " + o.name + " hired as " + o.title + ".", "good");
  return { ok: true };
}

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
function tickStudioOps() {
  if (!S || S.over) return;
  opsEnsure();
  if (S.ops.lastTick === S.studio.week) return; /* idempotent per week */
  S.ops.lastTick = S.studio.week;
  var i, p, row, logs = 0;

  /* real payroll: every seated officer is paid every single week */
  var payroll = opsPayroll();
  if (payroll > 0) {
    spend(payroll, "Executive payroll");
    S.ops.payrollPaid = Math.round((S.ops.payrollPaid + payroll) * 10) / 10;
  }

  /* placements lapse after 26 weeks; an unreleased film loses its critic penalty */
  for (i = S.ops.placements.length - 1; i >= 0; i--) {
    row = S.ops.placements[i];
    if (S.studio.week - row.week < OPS_PLACE_WEEKS) continue;
    S.ops.placements.splice(i, 1);
    p = findProject(row.projId);
    if (p && p.opsPlace) {
      p.opsPlace = null;
      p.opsPenalty = 0;
      if (logs < 1) {
        log("🏷️ The " + row.title + " placement lapsed — the brand walked and the critics' note is gone.", "", "🏷️");
        logs++;
      }
    }
  }
}

/* ── commit + action delegation (ui calls opsuiteAction) ──────── */
function opsCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function opsuiteAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("ops-") !== 0) return false;
  opsEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var r;
  switch (a) {
    case "ops-place": r = opsPlace(id, key); break;
    case "ops-press": r = opsPress(id, key); break;
    case "ops-hire-officer": r = opsHire(id); break;
    default: return false;
  }
  if (r && r.err) toast(r.err, "bad");
  else opsCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function opsPhaseLabel(p) {
  return p.phase === "shoot" ? "Shooting" : p.phase === "post" ? "In post" : "Ready";
}

function opsPlacementDesk() {
  opsEnsure();
  var html = "", i, j, p, sp, list = [], left;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (OPS_PHASES.indexOf(p.phase) >= 0) list.push(p);
  }
  html += '<div class="card">'
    + statrow("Sponsorship cash banked", fm(S.ops.sponsorCash || 0), "up")
    + statrow("Placements live", String(S.ops.placements.length))
    + statrow("Films open to brands", String(list.length))
    + "</div>";
  html += '<div class="sechead"><h2>Sponsor tiers</h2></div><div class="card">';
  for (i = 0; i < OPS_SPONSORS.length; i++) {
    sp = OPS_SPONSORS[i];
    html += '<div class="statrow"><span class="k">' + esc(sp.name) + " · " + esc(sp.category)
      + " · critics -" + Math.round(sp.penalty * 100) + '</span><span class="v num up">+'
      + fm(Math.round(sp.advance * opsAdvanceMult() * 10) / 10) + "</span></div>";
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Films in production</h2></div>';
  if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">🏷️</span>No film in shooting, post or ready. A placement pays now and costs critic points at release.</div></div>';
  }
  for (i = 0; i < list.length && i < 4; i++) {
    p = list[i];
    html += '<div class="card film"><div class="head"><div class="title">' + esc(p.title) + "</div>" + tag(opsPhaseLabel(p), "blue") + "</div>";
    if (p.opsPlace) {
      html += '<div class="meta">' + tag(esc(opsSponsorName(p.opsPlace.sponsor)), "gold")
        + tag("critics -" + Math.round(p.opsPlace.penalty * 100), "red") + "</div>";
    } else {
      html += '<div class="meta">' + tag("Buzz " + (p.buzz || 0)) + tag("One placement per film", "blue") + "</div>";
      for (j = 0; j < OPS_SPONSORS.length; j++) {
        sp = OPS_SPONSORS[j];
        html += '<div class="statrow"><span class="k">' + esc(sp.name) + " · +"
          + fm(Math.round(sp.advance * opsAdvanceMult() * 10) / 10) + " · critics -"
          + Math.round(sp.penalty * 100) + "</span>"
          + '<button class="btn sm" data-action="ops-place" data-id="' + p.id + '" data-key="' + sp.id + '">Sign</button></div>';
      }
    }
    html += "</div>";
  }
  html += '<div class="sechead"><h2>Active placements</h2></div>';
  if (!S.ops.placements.length) {
    html += '<div class="card"><div class="empty"><span class="em">🏷️</span>No placement live. Sign one above: cash lands today, the critic note lands on release.</div></div>';
  }
  for (i = 0; i < S.ops.placements.length; i++) {
    left = Math.max(0, OPS_PLACE_WEEKS - (S.studio.week - S.ops.placements[i].week));
    html += '<div class="card"><div class="statrow"><span class="k">' + esc(S.ops.placements[i].title)
      + " · " + esc(opsSponsorName(S.ops.placements[i].sponsor)) + '</span><span class="v num">-'
      + Math.round(S.ops.placements[i].penalty * 100) + " crit · " + left + " wk</span></div></div>";
  }
  return html;
}

function opsMediaDesk() {
  opsEnsure();
  var html = "", i, j, f, t, cost, profit, can, seen = 0;
  html += '<div class="card">'
    + statrow("Home-video profit banked", fm(S.ops.mediaProfit || 0), "up")
    + statrow("Batches pressed", String(S.ops.media.length))
    + statrow("Manufacturing cost mult", "\u00d7" + opsCostMult().toFixed(2), opsCostMult() < 1 ? "up" : "")
    + "</div>";
  html += '<div class="sechead"><h2>Finished films</h2></div>';
  for (i = 0; i < S.films.length && seen < 6; i++) {
    f = S.films[i];
    if (f.status !== "done") continue;
    seen++;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(f.title) + "</div>" + tag(fm(f.ww || 0) + " worldwide", "blue") + "</div>";
    html += '<div class="meta">' + tag("Sell-through " + Math.round(opsSellThrough(f) * 100) + "%", "green")
      + tag("Editions ship instantly", "") + "</div>";
    for (j = 0; j < OPS_MEDIA.length; j++) {
      t = OPS_MEDIA[j];
      if (f.opsMedia && f.opsMedia[t.id]) {
        html += '<div class="statrow"><span class="k">' + esc(t.name) + '</span><span class="v">' + tag("Pressed", "green") + "</span></div>";
        continue;
      }
      cost = opsMediaCost(t);
      profit = opsMediaProfit(f, t);
      can = S.studio.cash >= cost;
      html += '<div class="statrow"><span class="k">' + esc(t.name) + " · press " + fm(cost)
        + " · est. sell-through " + fm(profit) + "</span>"
        + '<button class="btn sm" data-action="ops-press" data-id="' + f.id + '" data-key="' + t.id + '" '
        + (can ? "" : "disabled") + ">Press · after " + fm(S.studio.cash - cost) + "</button></div>";
    }
    html += "</div>";
  }
  if (!seen) {
    html += '<div class="card"><div class="empty"><span class="em">💿</span>No film has finished its run yet. Press steelbooks and collector boxes once a release wraps.</div></div>';
  }
  return html;
}

function opsCsuiteDesk() {
  opsEnsure();
  var html = "", i, o, hired, can;
  html += '<div class="card">'
    + statrow("Weekly executive payroll", opsPayroll() > 0 ? "-" + fm(opsPayroll()) : fm(0), opsPayroll() > 0 ? "down" : "")
    + statrow("Cost multiplier (CFO)", "\u00d7" + opsCostMult().toFixed(2), opsCostMult() < 1 ? "up" : "")
    + statrow("Overhead multiplier (COO)", "\u00d7" + opsOverheadMult().toFixed(2), opsOverheadMult() < 1 ? "up" : "")
    + statrow("Salaries paid to date", fm(S.ops.payrollPaid || 0))
    + "</div>";
  html += '<div class="sechead"><h2>Open seats</h2></div>';
  for (i = 0; i < OPS_OFFICERS.length; i++) {
    o = OPS_OFFICERS[i];
    hired = !!S.ops.officers[o.id];
    can = S.studio.cash >= o.sign;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(o.title) + "</div>"
      + tag(hired ? "Seated" : fm(o.sign) + " signing", hired ? "green" : "gold") + "</div>";
    html += '<div class="meta">' + tag(esc(o.name), "blue") + tag(fm(o.salary) + "/wk", "") + "</div>";
    html += '<div class="statrow"><span class="k">' + esc(o.perk) + "</span>"
      + (hired
        ? '<span class="v num up">Active</span>'
        : '<button class="btn sm" data-action="ops-hire-officer" data-id="' + o.id + '" ' + (can ? "" : "disabled")
          + ">Hire · after " + fm(S.studio.cash - o.sign) + "</button>")
      + "</div></div>";
  }
  return html;
}

var OPS_DESKS = [
  { id: "ops-placement", group: "Studio ops", icon: "🏷️", name: "Brand placements",
    desc: "Sell sponsor slots on films in production: instant cash today, a critic-score penalty at release.",
    render: opsPlacementDesk },
  { id: "ops-media", group: "Studio ops", icon: "💿", name: "Physical media",
    desc: "Press steelbook and collector-box runs on finished films; sell-through scales with worldwide gross.",
    render: opsMediaDesk },
  { id: "ops-csuite", group: "Studio ops", icon: "🧑‍💼", name: "C-suite officers",
    desc: "Hire a CFO, CMO, Head of Casting and COO — weekly salaries buy real cost, overhead, advance and sell-through perks.",
    render: opsCsuiteDesk }
];
