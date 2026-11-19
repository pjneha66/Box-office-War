/* Box Office War — rebuilt. Marketing blitz module — all state under S.blitz.
   Systems: a five-rung campaign ladder sold against films still on the slate (press junket →
   Hall H panel → national TV blitz → Super Bowl spot → global saturation). Every rung has a
   real cost (scaled to the film's scale) and a real effect read at release through
   blitzOpenMult() / blitzBuzzAdd() / blitzCriticAdj(): the junket lifts critics and awards
   odds, Hall H and the Super Bowl lift buzz, TV and saturation lift the opening.
   Timed windows: a campaign bought inside its window lands at full power; every week of extra
   lead time — or a release that slips after the buy — decays it, so front-loading wastes money.
   Diminishing returns: the opening, buzz and critic lifts all run through saturating curves, so
   the third tactic on one film is worth a fraction of the first (see blitzAgg).
   Wiring: integrator calls tickMktBlitz() inside advanceWeek(), bridges mktBlitzAction() in
   ui.js onAction() and appends BLITZ_DESKS in collectDesks(); the release path reads
   blitzOpenMult(p) / blitzBuzzAdd(p) / blitzCriticAdj(p) before expectedOpening() and calls
   blitzOnRelease(p) after. No self-wiring. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
/* cost = base $M at a mid-budget film (×0.82 micro … ×1.45 tentpole).
   open/buzz/crit are raw effect points fed into the saturating curves in blitzAgg().
   window = weeks before release the campaign still lands at full power. */
var BLITZ_TIERS = [
  { id: "junket",     name: "Press junket tour",       cost: 1.5, buzz: 0,  open: 4,  crit: 6,  window: 5,
    desc: "Two weeks of junket rooms and press days: lifts the critic score and the awards conversation, barely the opening." },
  { id: "hallh",      name: "Hall H convention panel", cost: 4,   buzz: 14, open: 3,  crit: 0,  window: 9,
    desc: "A Hall H reveal to 6,000 screaming fans: the loudest pure-buzz buy on the ladder." },
  { id: "tvblitz",    name: "National TV blitz",       cost: 9,   buzz: 6,  open: 3,  crit: 0,  window: 6,
    desc: "Prime-time spots and late-night takeovers: the cleanest opening-week lever on the ladder." },
  { id: "superbowl",  name: "Super Bowl spot",         cost: 22,  buzz: 26, open: 2,  crit: 0,  window: 10,
    desc: "One 30-second spot in front of 120M viewers: awareness at national scale." },
  { id: "saturation", name: "Global saturation",       cost: 36,  buzz: 30, open: 2,  crit: -1, window: 12,
    desc: "Billboards on four continents and a tie-in everywhere: total reach, and critics start to notice the noise." }
];
var BLITZ_MAX_AGE = 26;        /* weeks a campaign survives unspent before it is written off */
var BLITZ_OPEN_CAP = 0.5;      /* ceiling on the opening multiplier bonus */
var BLITZ_OPEN_K = 20;         /* saturation constant: points at which half the cap is reached */
var BLITZ_BUZZ_CAP = 28;       /* ceiling on buzz points delivered at release */
var BLITZ_BUZZ_K = 24;
var BLITZ_CRIT_CAP = 12;       /* ceiling on critic-score points */
var BLITZ_CRIT_K = 6;
var BLITZ_NOW_SHARE = 0.35;    /* share of a tier's buzz that lands the moment you buy */
var BLITZ_PULL_REFUND = 0.35;  /* refund when a campaign is pulled before release */

/* ── state (lazy ensure — old saves have no S.blitz) ──────────── */
function blitzEnsure() {
  if (!S.blitz) S.blitz = { lastTick: 0, campaigns: [], spend: 0, released: 0, pulled: 0, stale: 0 };
  if (!S.blitz.campaigns) S.blitz.campaigns = [];
  if (!isFinite(S.blitz.lastTick)) S.blitz.lastTick = 0;
  if (!isFinite(S.blitz.spend)) S.blitz.spend = 0;
  if (!isFinite(S.blitz.released)) S.blitz.released = 0;
  if (!isFinite(S.blitz.pulled)) S.blitz.pulled = 0;
  if (!isFinite(S.blitz.stale)) S.blitz.stale = 0;
}

function blitzFindTier(id) { var i; for (i = 0; i < BLITZ_TIERS.length; i++) if (BLITZ_TIERS[i].id === id) return BLITZ_TIERS[i]; return null; }

/* One campaign row per tier per film; p.blitz holds the ids (single source of truth is
   S.blitz.campaigns, so a save round-trip can never fork the two copies). */
function blitzFindRow(projId, key) {
  blitzEnsure();
  var i, row;
  for (i = 0; i < S.blitz.campaigns.length; i++) {
    row = S.blitz.campaigns[i];
    if (row.projId === projId && row.key === key) return row;
  }
  return null;
}
function blitzFindCamp(id) {
  blitzEnsure();
  var i;
  for (i = 0; i < S.blitz.campaigns.length; i++) if (S.blitz.campaigns[i].id === id) return S.blitz.campaigns[i];
  return null;
}

/* ── cost & timing ────────────────────────────────────────────── */
function blitzCostMult(p) {
  var sc = scaleOf(p && p.scale ? p.scale : "micro");
  return clamp(sc.mktRate / 0.55, 0.6, 2.6);
}
function blitzTierCost(p, t) {
  if (!t) return 0;
  return Math.round(t.cost * blitzCostMult(p) * 10) / 10;
}

/* Freshness of one campaign: 1 inside its window, then decaying with every extra week of lead.
   The release date is read live, so a release that slips after the buy keeps losing power. */
function blitzFresh(p, row) {
  if (!row) return 0;
  var release = (p && p.releaseWeek != null) ? p.releaseWeek : (row.week + row.lead);
  var lead = release - row.week;
  var win = row.window > 0 ? row.window : 1;
  if (!(lead > win)) return 1;
  return win / (win + (lead - win));
}

/* ── engine hooks (typeof-guarded calls from the release path) ── */
function blitzAgg(p) {
  var out = { open: 1, buzz: 0, crit: 0 }, so = 0, sb = 0, sc = 0, paid = 0, i, row, f;
  if (!S || !p || !p.id) return out;
  blitzEnsure();
  for (i = 0; i < S.blitz.campaigns.length; i++) {
    row = S.blitz.campaigns[i];
    if (row.projId !== p.id) continue;
    f = blitzFresh(p, row);
    so += row.open * f;
    sb += row.buzz * f;
    sc += row.crit * f;
    paid += isFinite(row.nowBuzz) ? row.nowBuzz : 0;
  }
  if (so > 0) out.open = 1 + BLITZ_OPEN_CAP * so / (so + BLITZ_OPEN_K);
  if (sb > 0) out.buzz = Math.max(0, Math.round(BLITZ_BUZZ_CAP * sb / (sb + BLITZ_BUZZ_K) - paid));
  out.crit = sc > 0 ? Math.round(BLITZ_CRIT_CAP * sc / (sc + BLITZ_CRIT_K)) : Math.round(clamp(sc, -8, 0));
  return out;
}
function blitzOpenMult(p) { return blitzAgg(p).open; }
function blitzBuzzAdd(p) { return blitzAgg(p).buzz; }
function blitzCriticAdj(p) { return blitzAgg(p).crit; }

/* Called by the integrator once the film is out: consume the campaigns and clean up.
   Returns the aggregate the film released on, and is safe with a bare/absent project. */
function blitzOnRelease(p) {
  var agg, i, row, n = 0;
  if (!S || !p || !p.id) return { open: 1, buzz: 0, crit: 0 };
  blitzEnsure();
  agg = blitzAgg(p);
  for (i = S.blitz.campaigns.length - 1; i >= 0; i--) {
    row = S.blitz.campaigns[i];
    if (row.projId !== p.id) continue;
    S.blitz.campaigns.splice(i, 1);
    n++;
  }
  p.blitz = [];
  if (n) S.blitz.released = (S.blitz.released || 0) + n;
  return agg;
}

/* ── mechanics ────────────────────────────────────────────────── */
function blitzBuy(projId, key) {
  blitzEnsure();
  var p = findProject(projId), t = blitzFindTier(key);
  if (!t) return { err: "Unknown blitz rung." };
  if (!p) return { err: "That film is no longer on the slate." };
  if (blitzFindRow(p.id, t.id)) return { err: "“" + p.title + "” already has the " + t.name + "." };
  var cost = blitzTierCost(p, t);
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for the " + t.name + "." };
  var lead = p.releaseWeek != null ? Math.max(0, p.releaseWeek - S.studio.week) : t.window;
  var nowBuzz = Math.round(t.buzz * BLITZ_NOW_SHARE);
  var row = {
    id: "bl" + (S.seq++), projId: p.id, title: p.title, key: t.id, name: t.name,
    cost: cost, open: t.open, buzz: t.buzz, crit: t.crit, nowBuzz: nowBuzz,
    window: t.window, week: S.studio.week, lead: lead
  };
  spend(cost, "Blitz · " + t.name + " · " + p.title);
  S.blitz.campaigns.push(row);
  S.blitz.spend = Math.round((S.blitz.spend + cost) * 10) / 10;
  if (!p.blitz) p.blitz = [];
  p.blitz.push(row.id);
  if (nowBuzz > 0) p.buzz = (p.buzz || 0) + nowBuzz;
  var fresh = blitzFresh(p, row);
  log("🎪 " + t.name + " booked for “" + p.title + "” — " + fm(cost) + " down, "
    + (fresh >= 0.999 ? "full power at the window" : "already down to " + Math.round(fresh * 100) + "% power")
    + ".", "gold", "🎪");
  toast("🎪 " + t.name + " booked for “" + p.title + "”.", "good");
  return { ok: true, cost: cost, freshness: fresh };
}

function blitzPull(campId) {
  blitzEnsure();
  var row = blitzFindCamp(campId), i, p, refund;
  if (!row) return { err: "That campaign is not running." };
  refund = Math.round(row.cost * BLITZ_PULL_REFUND * 10) / 10;
  for (i = S.blitz.campaigns.length - 1; i >= 0; i--) if (S.blitz.campaigns[i].id === row.id) S.blitz.campaigns.splice(i, 1);
  p = findProject(row.projId);
  if (p && p.blitz) {
    i = p.blitz.indexOf(row.id);
    if (i >= 0) p.blitz.splice(i, 1);
    if (p.blitz.length === 0) p.blitz = [];
    if (isFinite(row.nowBuzz) && row.nowBuzz > 0) p.buzz = Math.max(0, (p.buzz || 0) - row.nowBuzz);
  }
  S.blitz.pulled = (S.blitz.pulled || 0) + 1;
  earn(refund, "Blitz cancellation · " + row.name);
  log("🎪 The " + row.name + " for “" + row.title + "” is pulled — " + fm(refund) + " of the spend recovered.", "", "🎪");
  return { ok: true, refund: refund };
}

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
function tickMktBlitz() {
  if (!S || S.over) return;
  blitzEnsure();
  if (S.blitz.lastTick === S.studio.week) return; /* idempotent per week */
  S.blitz.lastTick = S.studio.week;
  var i, row, p, f, dead, at, logs = 0;
  for (i = S.blitz.campaigns.length - 1; i >= 0; i--) {
    row = S.blitz.campaigns[i];
    p = findProject(row.projId);
    dead = "";
    if (!p) dead = "gone";                                  /* the film left the slate */
    else if (S.studio.week - row.week > BLITZ_MAX_AGE) dead = "expired";
    else {
      f = blitzFresh(p, row);
      if (p.releaseWeek != null && f < 0.25) dead = "stale"; /* the release slipped away from it */
    }
    if (!dead) continue;
    S.blitz.campaigns.splice(i, 1);
    if (p && p.blitz) {
      at = p.blitz.indexOf(row.id);
      if (at >= 0) p.blitz.splice(at, 1);
    }
    if (dead === "gone") continue;
    S.blitz.stale = (S.blitz.stale || 0) + 1;
    if (logs < 2) {
      if (dead === "expired") log("🎪 The " + row.name + " for “" + row.title + "” sat unused for " + BLITZ_MAX_AGE + " weeks — the money is written off.", "bad", "🎪");
      else log("🎪 “" + row.title + "” slipped again and the " + row.name + " is down to " + Math.round(blitzFresh(p, row) * 100) + "% power. Pull it or move the date.", "bad", "🎪");
      logs++;
    }
  }
}

/* ── commit + action delegation (ui calls mktBlitzAction) ─────── */
function blitzCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function mktBlitzAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("blitz-") !== 0) return false;
  blitzEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var r;
  switch (a) {
    case "blitz-buy": r = blitzBuy(id, key); break;
    case "blitz-pull": r = blitzPull(id); break;
    default: return false;
  }
  if (r && r.err) { toast(r.err, "bad"); return true; }
  blitzCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
/* Films worth showing: those with a locked release date first, then the rest of the slate. */
function blitzSlate(limit) {
  var out = [], i, p, pass;
  for (pass = 0; pass < 2 && out.length < limit; pass++) {
    for (i = 0; i < S.projects.length && out.length < limit; i++) {
      p = S.projects[i];
      if (out.indexOf(p) >= 0) continue;
      if (pass === 0 && p.releaseWeek == null) continue;
      if (pass === 1 && p.releaseWeek != null) continue;
      out.push(p);
    }
  }
  return out;
}

function blitzLadderDesk() {
  blitzEnsure();
  var html = "", i, j, p, t, cost, can, agg, wk, list = blitzSlate(3);
  html += '<div class="card">'
    + statrow("Blitz spend to date", fm(S.blitz.spend || 0))
    + statrow("Campaigns running", String(S.blitz.campaigns.length))
    + statrow("Consumed at release", String(S.blitz.released || 0))
    + statrow("Films on the slate", String(S.projects.length))
    + "</div>";
  html += '<div class="sechead"><h2>The ladder</h2></div><div class="card">';
  for (i = 0; i < BLITZ_TIERS.length; i++) {
    t = BLITZ_TIERS[i];
    html += '<div class="statrow"><span class="k">' + esc(t.name) + " · open +" + t.open + " · buzz +"
      + t.buzz + " · critics " + (t.crit >= 0 ? "+" : "") + t.crit + " · window " + t.window
      + ' wk</span><span class="v num">' + fm(t.cost) + " base</span></div>";
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Blitz a film</h2></div>';
  if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎪</span>Nothing on the slate. Greenlight a film and the whole ladder opens up against it.</div></div>';
    return html;
  }
  for (i = 0; i < list.length; i++) {
    p = list[i];
    agg = blitzAgg(p);
    wk = p.releaseWeek != null ? p.releaseWeek - S.studio.week : null;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(p.title) + "</div>"
      + tag(wk == null ? "No release date" : wk <= 0 ? "Release due" : "Opens in " + wk + " wk", wk == null ? "red" : "blue")
      + "</div>";
    html += '<div class="meta">' + tag("Buzz " + Math.round(p.buzz || 0))
      + tag("Open \u00d7" + agg.open.toFixed(2), agg.open > 1 ? "green" : "")
      + tag("Release buzz +" + agg.buzz, agg.buzz > 0 ? "green" : "")
      + tag("Critics " + (agg.crit >= 0 ? "+" : "") + agg.crit, agg.crit !== 0 ? "gold" : "") + "</div>";
    for (j = 0; j < BLITZ_TIERS.length; j++) {
      t = BLITZ_TIERS[j];
      if (blitzFindRow(p.id, t.id)) {
        html += '<div class="statrow"><span class="k">' + esc(t.name) + '</span><span class="v">' + tag("Booked", "gold") + "</span></div>";
        continue;
      }
      cost = blitzTierCost(p, t);
      can = S.studio.cash >= cost;
      html += '<div class="statrow"><span class="k">' + esc(t.name) + " · " + fm(cost) + " · open +"
        + t.open + " · buzz +" + t.buzz + '</span><button class="btn sm" data-action="blitz-buy" data-id="'
        + p.id + '" data-key="' + t.id + '" ' + (can ? "" : "disabled") + ">Buy · after "
        + fm(S.studio.cash - cost) + "</button></div>";
    }
    html += "</div>";
  }
  return html;
}

function blitzWindowDesk() {
  blitzEnsure();
  var html = "", i, j, p, row, f, list = blitzSlate(4), live = 0, shown = 0, lead;
  html += '<div class="card">'
    + statrow("Campaigns running", String(S.blitz.campaigns.length))
    + statrow("Written off as stale", String(S.blitz.stale || 0))
    + statrow("Campaigns retired at release", String(S.blitz.released || 0))
    + "</div>";
  html += '<div class="sechead"><h2>Windows</h2></div><div class="card">';
  for (i = 0; i < BLITZ_TIERS.length; i++) {
    html += statrow(esc(BLITZ_TIERS[i].name) + " · full power inside", BLITZ_TIERS[i].window + " wk of release");
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Freshness now</h2></div>';
  for (i = 0; i < list.length && shown < 8; i++) {
    p = list[i];
    if (!p.blitz || !p.blitz.length) continue;
    for (j = 0; j < S.blitz.campaigns.length && shown < 8; j++) {
      row = S.blitz.campaigns[j];
      if (row.projId !== p.id) continue;
      f = blitzFresh(p, row);
      lead = Math.max(0, (p.releaseWeek != null ? p.releaseWeek : row.week + row.lead) - S.studio.week);
      live++;
      html += '<div class="card"><div class="statrow"><span class="k">' + esc(p.title) + " · " + esc(row.name)
        + " · bought wk " + row.week + '</span><span class="v num ' + (f >= 0.6 ? "up" : "down") + '">'
        + Math.round(f * 100) + "% power · " + lead + " wk lead</span></div></div>";
      shown++;
    }
  }
  if (!live) {
    html += '<div class="card"><div class="empty"><span class="em">⏳</span>No campaign is running. Buy inside a window and it lands at full power — buy months early and most of it evaporates.</div></div>';
  }
  return html;
}

function blitzLedgerDesk() {
  blitzEnsure();
  var html = "", i, j, row, counts = {}, t, refund, shown = 0;
  for (j = 0; j < BLITZ_TIERS.length; j++) counts[BLITZ_TIERS[j].id] = 0;
  for (i = 0; i < S.blitz.campaigns.length; i++) if (counts[S.blitz.campaigns[i].key] != null) counts[S.blitz.campaigns[i].key]++;
  html += '<div class="card">'
    + statrow("Blitz spend to date", fm(S.blitz.spend || 0))
    + statrow("Campaigns running", String(S.blitz.campaigns.length))
    + statrow("Pulled early", String(S.blitz.pulled || 0))
    + statrow("Pull refund", Math.round(BLITZ_PULL_REFUND * 100) + "% of the fee")
    + "</div>";
  html += '<div class="sechead"><h2>By rung</h2></div><div class="card">';
  for (j = 0; j < BLITZ_TIERS.length; j++) {
    t = BLITZ_TIERS[j];
    html += statrow(esc(t.name), String(counts[t.id]) + " live");
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Running campaigns</h2></div>';
  if (!S.blitz.campaigns.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎪</span>No campaign on the books. The ladder sells the opening, the buzz and the reviews — one rung at a time.</div></div>';
    return html;
  }
  for (i = S.blitz.campaigns.length - 1; i >= 0 && shown < 8; i--) {
    row = S.blitz.campaigns[i];
    refund = Math.round(row.cost * BLITZ_PULL_REFUND * 10) / 10;
    html += '<div class="card"><div class="statrow"><span class="k">' + esc(row.title) + " · " + esc(row.name)
      + " · " + fm(row.cost) + '</span><button class="btn danger sm" data-action="blitz-pull" data-id="'
      + row.id + '">Pull · ' + fm(refund) + "</button></div></div>";
    shown++;
  }
  return html;
}

var BLITZ_DESKS = [
  { id: "blitz-ladder", group: "Marketing", icon: "🎪", name: "Blitz ladder",
    desc: "Buy campaign rungs against an upcoming film: junket for critics, Hall H for buzz, TV and saturation for the opening.",
    render: blitzLadderDesk },
  { id: "blitz-windows", group: "Marketing", icon: "⏳", name: "Campaign windows",
    desc: "Every rung lands at full power only inside its window — a release that slips decays the campaign you already paid for.",
    render: blitzWindowDesk },
  { id: "blitz-ledger", group: "Marketing", icon: "🧾", name: "Blitz ledger",
    desc: "What the blitz has cost, what is still running, and the fee you recover when you pull a campaign early.",
    render: blitzLedgerDesk }
];
