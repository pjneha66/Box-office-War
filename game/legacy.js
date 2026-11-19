/* Box Office War — rebuilt. Studio legacy module (v46, Module 5) — all state under S.legacy.
   The studio climbs a six-rung ladder: Indie label → Boutique → Mid-tier → Major →
   Studio system → Legacy house. Legacy points come from five sources, all read live
   from the engine's own state (nothing cached except monotonic high-water marks):
     · lifetime gross          floor(lifetime ^ 0.70)      — the long game, sub-linear
     · releases shipped        4 per film
     · profitable releases    12 each
     · trophies won           40 each (S.aw.history from awards.js, plus any
                               module that publishes S.stats.awards / S.pr.wins)
     · studio reputation      (peak rep − 20) × 1.2 — high-water, so a bad year
                               never demotes a house that has already arrived
   Each tier unlocks an opening multiplier (legacyOpenMult), cheaper borrowing
   (legacyFinancingMult, < 1 = better), cheaper talent (legacyFeeMult, < 1 = better)
   and an added reputation factor (legacyRepBonus).

   Wiring (LIVE in engine.js — do not self-wrap):
     feeFor()              × legacyFeeMult(t)
     expectedOpening()     × legacyOpenMult(p) and × (1 + legacyRepBonus()/100)
     advanceWeek()         interest × legacyFinancingMult(), then tickLegacy()
     ui.js onAction        bridges legacyAction, collectDesks() appends LEGACY_DESKS
   Every hook is typeof-guarded by the engine and returns a neutral value when
   S.legacy is absent, so old saves and fresh saves are mathematically identical
   until tickLegacy() first runs. tickLegacy() is idempotent per week via lastTick.
   Desk: "legacy-tiers" (group "Empire & Franchises") — the ladder with the
   player's position, points to the next rung, each tier's unlocks, and the
   endowment action (cash → legacy points, escalating price).
*/
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var LEGACY_TIERS = [
  { t: 0, id: "indie",     n: "Indie label",   at: 0,
    open: 1,     fin: 1,     fee: 1,     rep: 0, d: "A scrappy label with a slate and a prayer." },
  { t: 1, id: "boutique",  n: "Boutique",      at: 55,
    open: 1.015, fin: 0.98,  fee: 0.985, rep: 1, d: "Critics know the name; the trades are starting to." },
  { t: 2, id: "midtier",   n: "Mid-tier",      at: 170,
    open: 1.03,  fin: 0.95,  fee: 0.97,  rep: 2, d: "A real slate, real overhead, real distribution muscle." },
  { t: 3, id: "major",     n: "Major",         at: 400,
    open: 1.05,  fin: 0.92,  fee: 0.955, rep: 3, d: "Day-and-date worldwide prints. The bank takes your call." },
  { t: 4, id: "studiosys", n: "Studio system", at: 850,
    open: 1.075, fin: 0.88,  fee: 0.94,  rep: 4, d: "Contracted talent, owned stages, a house style." },
  { t: 5, id: "legacy",    n: "Legacy house",  at: 1250,
    open: 1.10,  fin: 0.82,  fee: 0.92,  rep: 6, d: "The name above the title sells the ticket by itself." }
];

/* points curve */
var LEGACY_GROSS_EXP = 0.79;     /* sub-linear: $8-12B lifetime lands on the top rung */
var LEGACY_PTS_RELEASE = 4;
var LEGACY_PTS_HIT = 12;
var LEGACY_PTS_AWARD = 40;
var LEGACY_PTS_REP = 1.2;
var LEGACY_REP_FLOOR = 20;       /* rep below this earns nothing */

/* endowment: cash → points, each purchase 35% dearer */
var LEGACY_ENDOW_BASE = 15;
var LEGACY_ENDOW_GROWTH = 1.35;
var LEGACY_ENDOW_PTS = 20;

/* ── state (lazy ensure — old saves have no S.legacy) ─────────── */
function legacyEnsure() {
  if (!S) return;
  if (!S.legacy) {
    S.legacy = {
      lastTick: 0, points: 0, tier: 0, bestTier: 0, announced: 0,
      promotions: 0, endow: 0, endowPts: 0, spent: 0,
      repPeak: 0, awardsPeak: 0
    };
  }
  var L = S.legacy, st = S.studio || {};
  if (!isFinite(L.lastTick)) L.lastTick = 0;
  if (!isFinite(L.points) || L.points < 0) L.points = 0;
  if (!isFinite(L.tier)) L.tier = 0;
  if (!isFinite(L.bestTier)) L.bestTier = 0;
  if (!isFinite(L.announced)) L.announced = L.bestTier;
  if (!isFinite(L.promotions) || L.promotions < 0) L.promotions = 0;
  if (!isFinite(L.endow) || L.endow < 0) L.endow = 0;
  if (!isFinite(L.endowPts) || L.endowPts < 0) L.endowPts = 0;
  if (!isFinite(L.spent) || L.spent < 0) L.spent = 0;
  if (!isFinite(L.repPeak)) L.repPeak = 0;
  if (!isFinite(L.awardsPeak)) L.awardsPeak = 0;
  /* a corrupt save must not fake a promotion: rungs are always 0..5 */
  var top = LEGACY_TIERS.length - 1;
  L.tier = clamp(Math.floor(L.tier), 0, top);
  L.bestTier = clamp(Math.floor(L.bestTier), 0, top);
  L.announced = clamp(Math.floor(L.announced), 0, top);
  if (L.announced < L.bestTier) L.announced = L.bestTier;
  /* monotonic high-water marks — they can only ever raise the tier, never lower it */
  var rep = isFinite(st.rep) ? st.rep : 0;
  if (rep > L.repPeak) L.repPeak = rep;
  var aw = legacyAwardsWon();
  if (aw > L.awardsPeak) L.awardsPeak = aw;
}

/* ── points: every source read live from engine state ─────────── */
/* Trophies: awards.js publishes S.aw.history; other modules may publish their own
   counters. Take the largest single source rather than summing, so the same
   statuette can never be counted twice. All reads are defensive — a missing
   module contributes nothing rather than throwing. */
function legacyAwardsWon() {
  var n = 0;
  if (S && S.aw && S.aw.history && S.aw.history.length) n = S.aw.history.length;
  if (S && S.stats && isFinite(S.stats.awards) && S.stats.awards > n) n = S.stats.awards;
  if (S && S.pr && isFinite(S.pr.wins) && S.pr.wins > n) n = S.pr.wins;
  return Math.max(0, Math.floor(n));
}
function legacyGrossPts() {
  if (!S || !S.studio || !isFinite(S.studio.lifetime)) return 0;
  var L = Math.max(0, S.studio.lifetime);
  if (L <= 0) return 0;
  return Math.floor(Math.pow(L, LEGACY_GROSS_EXP));
}
function legacyReleasePts() {
  if (!S || !S.stats || !isFinite(S.stats.releases)) return 0;
  return Math.max(0, Math.floor(S.stats.releases)) * LEGACY_PTS_RELEASE;
}
function legacyHitPts() {
  if (!S || !S.stats || !isFinite(S.stats.hits)) return 0;
  return Math.max(0, Math.floor(S.stats.hits)) * LEGACY_PTS_HIT;
}
function legacyAwardPts() {
  var n = legacyAwardsWon();
  if (S && S.legacy && isFinite(S.legacy.awardsPeak)) n = Math.max(n, S.legacy.awardsPeak);
  return n * LEGACY_PTS_AWARD;
}
function legacyRepPts() {
  if (!S || !S.studio) return 0;
  var peak = isFinite(S.studio.rep) ? S.studio.rep : 0;
  if (S.legacy && isFinite(S.legacy.repPeak)) peak = Math.max(peak, S.legacy.repPeak);
  if (peak <= LEGACY_REP_FLOOR) return 0;
  return (peak - LEGACY_REP_FLOOR) * LEGACY_PTS_REP;
}
function legacyEndowPtsTotal() {
  if (!S || !S.legacy || !isFinite(S.legacy.endowPts)) return 0;
  return Math.max(0, S.legacy.endowPts);
}
/* Total legacy points. Read-only: safe to call from inside expectedOpening.
   Zero while the module has no state, so a fresh save is mathematically neutral. */
function legacyPoints() {
  if (!S || !S.legacy) return 0;
  var pts = legacyGrossPts() + legacyReleasePts() + legacyHitPts()
    + legacyAwardPts() + legacyRepPts() + legacyEndowPtsTotal();
  if (!isFinite(pts) || pts < 0) return 0;
  return Math.round(pts);
}
function legacyTierFor(pts) {
  var t = 0, i;
  if (!isFinite(pts) || pts < 0) pts = 0;
  for (i = 0; i < LEGACY_TIERS.length; i++) if (pts >= LEGACY_TIERS[i].at) t = LEGACY_TIERS[i].t;
  return t;
}
/* Current tier 0..5 — derived from points every call, never from a cache. */
function legacyTier() { return legacyTierFor(legacyPoints()); }
function legacyTierMeta(t) {
  var i;
  if (!isFinite(t)) t = 0;
  for (i = 0; i < LEGACY_TIERS.length; i++) if (LEGACY_TIERS[i].t === t) return LEGACY_TIERS[i];
  return LEGACY_TIERS[0];
}
function legacyNextTier(t) {
  var i;
  if (!isFinite(t)) t = 0;
  for (i = 0; i < LEGACY_TIERS.length; i++) if (LEGACY_TIERS[i].t === t + 1) return LEGACY_TIERS[i];
  return null;
}

/* ── engine hooks (all neutral while S.legacy is absent) ──────── */
/* Opening lift from brand reach. Accepts the project for signature symmetry —
   the tier, not the film, decides the number. */
function legacyOpenMult(p) {
  if (!S || !S.legacy) return 1;
  var m = legacyTierMeta(legacyTier()).open;
  if (!isFinite(m) || m < 1) m = 1;
  return m;
}
/* Loan-interest multiplier. A legacy studio borrows cheaper: (0, 1]. */
function legacyFinancingMult() {
  if (!S || !S.legacy) return 1;
  var m = legacyTierMeta(legacyTier()).fin;
  if (!isFinite(m) || m <= 0) return 1;
  if (m > 1) m = 1;
  return m;
}
/* Talent-fee multiplier for feeFor(). Must stay inside (0, 1]. */
function legacyFeeMult(t) {
  if (!S || !S.legacy) return 1;
  var m = legacyTierMeta(legacyTier()).fee;
  if (!isFinite(m) || m <= 0) return 1;
  if (m > 1) m = 1;
  return m;
}
/* Added to the reputation factor in expectedOpening (percent). */
function legacyRepBonus() {
  if (!S || !S.legacy) return 0;
  var b = legacyTierMeta(legacyTier()).rep;
  if (!isFinite(b) || b < 0) return 0;
  return b;
}

/* ── endowment: cash for legacy points (escalating price) ─────── */
function legacyEndowCost() {
  var n = (S && S.legacy && isFinite(S.legacy.endow)) ? Math.max(0, S.legacy.endow) : 0;
  var c = LEGACY_ENDOW_BASE * Math.pow(LEGACY_ENDOW_GROWTH, n);
  if (!isFinite(c) || c < LEGACY_ENDOW_BASE) c = LEGACY_ENDOW_BASE;
  return Math.round(c * 10) / 10;
}
function legacyEndow() {
  if (!S || !S.studio) return { err: "No studio to endow." };
  legacyEnsure();
  var cost = legacyEndowCost();
  if (!isFinite(S.studio.cash) || S.studio.cash < cost) {
    return { err: "Need " + fm(cost) + " to endow the legacy fund." };
  }
  var before = S.legacy.bestTier;
  spend(cost, "Legacy endowment");
  S.legacy.endow++;
  S.legacy.endowPts += LEGACY_ENDOW_PTS;
  S.legacy.spent = Math.round((S.legacy.spent + cost) * 10) / 10;
  var now = legacyApplyTier(true);
  log("👑 You endow the " + esc(S.studio.name) + " legacy fund — " + fm(cost) + " for +"
    + LEGACY_ENDOW_PTS + " legacy points."
    + (now > before ? " The studio is now a " + LEGACY_TIERS[now].n + "." : ""), "gold", "👑");
  toast("Legacy fund endowed · +" + LEGACY_ENDOW_PTS + " points.", "gold");
  return { ok: true, cost: cost, tier: now };
}

/* ── tier bookkeeping shared by tick and action ──────────────── */
/* Recomputes points/tier and logs a promotion at most once per rung.
   silent=true folds the promotion into the caller's own single log line. */
function legacyApplyTier(silent) {
  if (!S || !S.studio) return 0;
  legacyEnsure();
  var pts = legacyPoints();
  var now = legacyTierFor(pts);
  S.legacy.points = pts;
  S.legacy.tier = now;
  if (now > S.legacy.bestTier) S.legacy.bestTier = now;
  if (now > S.legacy.announced) {
    var meta = LEGACY_TIERS[now];
    S.legacy.announced = now;
    S.legacy.promotions++;
    if (!silent) {
      log("👑 The studio is now a " + meta.n + " — " + esc(meta.d)
        + " Opening ×" + meta.open.toFixed(3) + ", loan interest ×" + meta.fin.toFixed(2)
        + ", talent fees ×" + meta.fee.toFixed(3) + ".", "gold", "👑");
      toast("👑 Promoted: " + meta.n + "!", "gold");
    }
  }
  return now;
}

/* ── weekly tick (idempotent — engine may also call it) ──────── */
function tickLegacy() {
  if (!S || S.over) return;
  if (S.legacy && S.legacy.lastTick === S.studio.week) return;
  legacyEnsure();
  S.legacy.lastTick = S.studio.week;
  legacyApplyTier(false);
}

/* ── actions ─────────────────────────────────────────────────── */
function legacyCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function legacyAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("legacy-") !== 0) return false;
  legacyEnsure();
  if (a === "legacy-endow") {
    var r = legacyEndow();
    if (r && r.err) { toast(r.err, "bad"); return true; }
    legacyCommit();
    return true;
  }
  return false;
}

/* ── desk: the ladder ────────────────────────────────────────── */
function legacyUnlockTxt(L) {
  var parts = [];
  if (L.open > 1) parts.push("+" + (Math.round((L.open - 1) * 1000) / 10) + "% opening");
  if (L.fin < 1) parts.push("loans ×" + L.fin.toFixed(3));
  if (L.fee < 1) parts.push("talent ×" + L.fee.toFixed(3));
  if (L.rep > 0) parts.push("rep factor +" + L.rep + "%");
  if (!parts.length) return "no bonuses — the ladder starts here";
  return parts.join(" · ");
}
function legacyDeskTiers() {
  legacyEnsure();
  var pts = legacyPoints();
  var tier = legacyTierFor(pts);
  var cur = legacyTierMeta(tier);
  var next = legacyNextTier(tier);
  var i, L, reached, here, pct;
  var html = "<div>";

  /* current standing */
  html += '<div class="card">';
  html += statrow("Current tier", tag(esc(cur.n), tier >= 4 ? "gold" : tier >= 1 ? "green" : ""));
  html += statrow("Legacy points", String(pts));
  if (next) html += statrow("Next tier", esc(next.n) + " · " + Math.max(0, next.at - pts) + " points to go");
  else html += statrow("Next tier", "Top of the ladder", "up");
  html += statrow("Opening lift", "×" + cur.open.toFixed(3), cur.open > 1 ? "up" : "");
  html += statrow("Loan interest", "×" + cur.fin.toFixed(3), cur.fin < 1 ? "up" : "");
  html += statrow("Talent fees", "×" + cur.fee.toFixed(3), cur.fee < 1 ? "up" : "");
  html += statrow("Reputation factor", cur.rep > 0 ? "+" + cur.rep + "%" : "—", cur.rep > 0 ? "up" : "");
  pct = next
    ? clamp(Math.round((pts - cur.at) / Math.max(1, next.at - cur.at) * 100), 2, 100)
    : 100;
  html += '<div class="bar' + (tier >= 4 ? " green" : "") + '"><i style="width:' + pct + '%"></i></div>';
  html += "</div>";

  /* the ladder itself */
  html += '<div class="sechead"><h2>The ladder</h2></div><div class="card">';
  for (i = 0; i < LEGACY_TIERS.length; i++) {
    L = LEGACY_TIERS[i];
    reached = pts >= L.at;
    here = L.t === tier;
    html += '<div class="statrow"><span class="k">' + (here ? "👑 " : "") + esc(L.n)
      + '<br><small style="color:var(--faint)">'
      + (L.at > 0 ? L.at + " pts · " : "from the start · ")
      + esc(legacyUnlockTxt(L)) + "</small></span>"
      + '<span class="v num">'
      + tag(here ? "You are here" : reached ? "Unlocked" : "Locked", here ? "gold" : reached ? "green" : "")
      + "</span></div>";
    if (!reached && L.at > 0) {
      html += '<div class="bar"><i style="width:' + clamp(Math.round(pts / L.at * 100), 2, 100) + '%"></i></div>';
    }
  }
  html += "</div>";

  /* endowment */
  var cost = legacyEndowCost();
  html += '<div class="sechead"><h2>Endowment</h2></div><div class="card">';
  html += '<div class="statrow"><span class="k">Endow the legacy fund · ' + fm(cost)
    + '<br><small style="color:var(--faint)">+' + LEGACY_ENDOW_PTS + " legacy points · next endowment costs more · cash after "
    + fm(S.studio.cash - cost) + " · endowed " + S.legacy.endow + " time(s)"
    + "</small></span>"
    + '<button class="btn primary sm" data-action="legacy-endow"'
    + (S.studio.cash < cost ? " disabled" : "") + ">Endow · " + fm(cost) + "</button></div>";
  html += "</div>";

  html += '<div class="card"><div class="empty" style="padding:8px 0 0">👑 Legacy points accrue from lifetime gross, '
    + "releases, hits, trophies and reputation — and from endowments. The tier is permanent once the points are banked.</div></div>";
  return html + "</div>";
}

var LEGACY_DESKS = [
  { id: "legacy-tiers", group: "Empire & Franchises", icon: "👑", name: "Studio legacy",
    desc: "The six-rung ladder from indie label to legacy house — opening reach, cheaper financing, cheaper talent.",
    render: legacyDeskTiers }
];

/* ── achievements (merged by meta.js allAchievements()) ───────── */
var LEGACY_ACHIEVEMENTS = [
  { id: "legacy-boutique", tier: 1, name: "Boutique label",
    desc: "Reach the Boutique tier on the legacy ladder.",
    test: function (S) { return !!S && !!S.legacy && S.legacy.bestTier >= 1; } },
  { id: "legacy-major", tier: 2, name: "Major player",
    desc: "Reach the Major tier on the legacy ladder.",
    test: function (S) { return !!S && !!S.legacy && S.legacy.bestTier >= 3; } },
  { id: "legacy-house", tier: 3, name: "Legacy house",
    desc: "Climb to the top of the ladder — a legacy house.",
    test: function (S) { return !!S && !!S.legacy && S.legacy.bestTier >= 5; } },
  { id: "legacy-patron", tier: 1, name: "Patron of the arts",
    desc: "Endow the legacy fund once.",
    test: function (S) { return !!S && !!S.legacy && S.legacy.endow >= 1; } },
  { id: "legacy-endowment-chair", tier: 2, name: "Endowment chair",
    desc: "Endow the legacy fund ten times.",
    test: function (S) { return !!S && !!S.legacy && S.legacy.endow >= 10; } },
  { id: "legacy-five-billion", tier: 3, name: "Five billion in tickets",
    desc: "Bank $5B in lifetime theatrical gross.",
    test: function (S) { return !!S && !!S.studio && isFinite(S.studio.lifetime) && S.studio.lifetime >= 5000; } }
];
