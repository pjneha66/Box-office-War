/* ═══════════════════════════════════════════════════════════════════
   BOX OFFICE WAR — box-office-collection-engine.js
   The Collection layer: player-driven levers that raise what a picture
   actually collects, plus the weekly "coffer" that reports it.

   DESIGN RULES (see .dsh/skills/agency-box-office-collection-director)
   ───────────────────────────────────────────────────────────────────
   • No duplication. Opening/legs/decay stay in engine.js. This module
     wraps the sanctioned seams only:
        expectedOpening()  → BoxOfficeCollection.openingMultiplier(p, G)
        tickTheatrical()   → BoxOfficeCollection.tick(G)   (runs right after)
        legsOf()           → BoxOfficeCollection.legsBonus(f)  (via engine)
   • Earning is honest. Every dollar printed by a lever is an *increment*
     over the gross the base engine already produced, is paid through the
     normal earn(cat, amt) ledger, and is logged once per week.
   • Growth is earned, not free. Levers cost cash, run out, and go on
     cooldown; the global valve (valveOf) flattens late-run income so a
     career cannot spiral into infinite money.
   • Every save field is optional. A career created before this module
     loads with zero levers, and the desk simply offers them.

   State lives in G.collection (career) and f.collection (per film).
   All lever clocks are stored as `weeksLeft`; zero means expired.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
(function (global) {
  var VERSION = 1;

  /* ── the single tuning block ─────────────────────────────────────
     Every lever's strength lives here so balance changes are one edit.
     `weeks` is lever duration; `costFrac` scales cost off the film's
     marketing spend; the valve is the economy's speed limit. */
  var CONFIG = {
    /* Splits the engine pays (box-office rental, not gross). */
    domShare: 0.53,
    intlShare: 0.42,

    /* Player-owned circuit screens: a career asset that lifts every release. */
    screenOwn: { perUnit: 0.022, maxUnits: 10, cap: 0.22, baseCost: 34, costStep: 22 },

    /* Circuit-wide price program. */
    priceRelief: { cut: 0.10, lift: 0.08, cost: 2 },

    /* Per-film levers. Strength is weekly-collection uplift; cost is a share of
       the film's marketing spend, clamped. A full push should collect a
       multiple of what it costs, or the player would be right to ignore it. */
    pushScreens: { lift: 0.50, perLevel: 0.180, maxLevel: 3, weeks: 8, costFrac: 0.07, minCost: 5, maxCost: 26 },
    eventPricing: { lift: 0.38, perLevel: 0.140, maxLevel: 3, weeks: 6, costFrac: 0.05, minCost: 4, maxCost: 20 },
    intlBlitz: { lift: 0.42, perLevel: 0.200, maxLevel: 2, weeks: 10, costFrac: 0.06, minCost: 5, maxCost: 24 },
    merchWindow: { lift: 0.14, perLevel: 0.080, maxLevel: 3, weeks: 8, costFrac: 0.03, minCost: 2, maxCost: 12 },
    relaunch: { lift: 0.85, weeks: 5, costFrac: 0.05, minCost: 3, maxCost: 18 },

    /* Career-wide valves. */
    corridor: { bump: 0.05, weeks: 4, cost: 45, cooldown: 26 },
    valve: { base: 30, perOpening: 3.2, corridor: 1.30, shareBase: 0.75, shareStep: 0.045, shareCap: 1.0 },

    historyWeeks: 60
  };

  var TACTIC_KEYS = ["pushScreens", "eventPricing", "intlBlitz", "merchWindow", "relaunch"];
  var TACTICS = {
    pushScreens: {
      name: "Screen Expansion Push", icon: "🖥",
      blurb: "Buy a print-and-advertising expansion: more screens, more shows, a bigger first month.",
      gate: function (f) { return f.pattern === "platform" ? "a platform pattern never goes wide" : null; }
    },
    eventPricing: {
      name: "Event Pricing", icon: "🎟",
      blurb: "Turn the run into an event — premium formats, a surcharge, sold-out shows you can charge for.",
      gate: function (f) {
        if (f.premium || f.imax) return null;
        if (f.genre === "action" || f.genre === "scifi" || f.genre === "fantasy" || f.genre === "animation") return null;
        return "needs a big-canvas picture (action / sci-fi / fantasy / animation) or a PLF booking";
      }
    },
    intlBlitz: {
      name: "International Blitz", icon: "🌍",
      blurb: "Day-and-date prints, dubs and local press across the territories that are still cold.",
      gate: function (f) { return (Number(f.intl) || 0) > 0 ? null : "needs an international rollout already reporting"; }
    },
    merchWindow: {
      name: "Merch & Tie-In Window", icon: "🧢",
      blurb: "License the characters while the picture is hot: toys, apparel and a fast-food tie-in.",
      gate: function (f) { return (f.genre === "horror" || f.genre === "drama" || f.genre === "war") ? "not a licensed-property genre" : null; }
    },
    relaunch: {
      name: "Re-Release / Restoration Run", icon: "🔁",
      blurb: "Put the picture back in theaters: anniversary prints, a restoration, a new trailer cut.",
      gate: function (f) { return f.inTheaters ? "already in theaters — wait for the run to close" : null; }
    }
  };

  /* ── helpers ───────────────────────────────────────────────────── */
  function S() {
    try {
      if (typeof global !== "undefined" && global.G) return global.G;
      if (typeof G !== "undefined") return G;
    } catch (e) {}
    return null;
  }
  function D() {
    try {
      if (typeof global !== "undefined" && global.DATA) return global.DATA;
      if (typeof DATA !== "undefined") return DATA;
    } catch (e) {}
    return null;
  }
  function clamp2(x, lo, hi) { x = Number(x); if (!isFinite(x)) x = lo; return Math.max(lo, Math.min(hi, x)); }
  function rm1(x) { x = Number(x); return isFinite(x) ? Math.round(x * 10) / 10 : 0; }
  function fmt(x) {
    try { if (typeof global.fmtM === "function") return global.fmtM(x); } catch (e) {}
    return "$" + rm1(x) + "M";
  }
  function fmtG(x) {
    try { if (typeof global.fmtG === "function") return global.fmtG(x); } catch (e) {}
    return "$" + rm1(x) + "M";
  }
  function spendMoney(cat, amt) {
    try { if (typeof global.spend === "function") { global.spend(cat, amt); return; } } catch (e) {}
    var g = S(); if (g && g.studio) g.studio.cash = rm1((g.studio.cash || 0) - amt);
  }
  function earnMoney(cat, amt) {
    try { if (typeof global.earn === "function") { global.earn(cat, amt); return; } } catch (e) {}
    var g = S(); if (g && g.studio) g.studio.cash = rm1((g.studio.cash || 0) + amt);
  }
  function say(text, kind) { try { if (typeof global.log === "function") global.log(text, kind || ""); } catch (e) {} }
  function persist() { try { if (typeof global.saveGame === "function") global.saveGame(); } catch (e) {} }
  function beep() { try { if (typeof global.sfx === "function") global.sfx("coin"); } catch (e) {} }

  /* ── state ─────────────────────────────────────────────────────── */
  function blankState() {
    return {
      version: VERSION,
      bump: { screens: 0, priceMode: "standard", priceReliefAt: 0 },
      weekly: { generated: 0, uplift: 0, levy: 0, damped: 0, valve: 0 },
      corridor: { active: false, weeksLeft: 0, lastBooked: 0 },
      history: [],
      ledger: []
    };
  }
  function ensure(G0) {
    var G = G0 || S();
    if (!G) return null;
    if (!G.collection || typeof G.collection !== "object") G.collection = blankState();
    var s = G.collection;
    var b = blankState();
    if (!s.bump || typeof s.bump !== "object") s.bump = b.bump;
    if (s.bump.screens == null) s.bump.screens = 0;
    if (!s.bump.priceMode) s.bump.priceMode = "standard";
    if (!s.weekly || typeof s.weekly !== "object") s.weekly = b.weekly;
    if (!s.corridor || typeof s.corridor !== "object") s.corridor = b.corridor;
    if (!Array.isArray(s.history)) s.history = [];
    if (!Array.isArray(s.ledger)) s.ledger = [];
    return s;
  }
  /* Per-film counters (spend, uplift, merch, week history). Lever clocks live
     in G.collection.bump[filmId] so the weekly tick and the desk read one map. */
  function ensureFilm(f) {
    if (!f) return null;
    if (!f.collection || typeof f.collection !== "object") {
      f.collection = { cost: 0, totals: { uplift: 0, merch: 0, relaunches: 0 }, history: [] };
    }
    if (!f.collection.totals) f.collection.totals = { uplift: 0, merch: 0, relaunches: 0 };
    if (!Array.isArray(f.collection.history)) f.collection.history = [];
    return f.collection;
  }
  function keyOf(f) { return f ? String(f.id) : null; }
  function recFor(G, f) {
    var s = ensure(G); if (!s || !f) return null;
    var k = keyOf(f);
    if (!s.bump[k] || typeof s.bump[k] !== "object") s.bump[k] = {};
    var rec = s.bump[k];
    TACTIC_KEYS.forEach(function (t) { if (!(t in rec)) rec[t] = null; });
    return rec;
  }
  /* Flat list of lever clocks for the weekly tick. */
  function clocksOf(G) {
    var s = ensure(G); var out = [];
    if (!s) return out;
    Object.keys(s.bump).forEach(function (k) {
      if (k === "screens" || k === "priceMode" || k === "priceReliefAt") return;
      var rec = s.bump[k]; if (!rec || typeof rec !== "object") return;
      TACTIC_KEYS.forEach(function (t) {
        var c = rec[t];
        if (c && Number(c.weeksLeft) > 0) out.push(c);
      });
    });
    return out;
  }

  /* ── lever maths ───────────────────────────────────────────────── */
  function marketingOf(f) { return Math.max(1, Number(f && f.marketing) || 0); }
  function leverCost(cfg, f) { return Math.round(clamp2(marketingOf(f) * cfg.costFrac, cfg.minCost, cfg.maxCost)); }
  function recOf(f, key) { var rec = recFor(S(), f); return rec ? rec[key] : null; }
  function isRunning(f, key) { var r = recOf(f, key); return !!(r && Number(r.weeksLeft) > 0); }
  function levelOf(f, key) { var r = recOf(f, key); return r ? Math.max(0, Number(r.level) || 0) : 0; }
  function tuneOf(f, key) {
    if (!isRunning(f, key)) return 0;
    var cfg = CONFIG[key], lv = levelOf(f, key) || 1;
    return cfg.perLevel ? cfg.lift + cfg.perLevel * (lv - 1) : cfg.lift;
  }

  function screenUnits() { var g = S(); var s = ensure(g); return s ? clamp2(s.bump.screens || 0, 0, CONFIG.screenOwn.maxUnits) : 0; }
  function screenMult() { return 1 + clamp2(screenUnits() * CONFIG.screenOwn.perUnit, 0, CONFIG.screenOwn.cap); }

  /* The valve: the industry's appetite for extra spend this week. */
  function valveOf(G0) {
    var G = G0 || S();
    if (!G) return 0;
    var live = (G.films || []).filter(function (f) { return f.inTheaters; });
    if (!live.length) return 0;
    var sum = live.reduce(function (a, f) { return a + Math.max(0, Number(f.opening) || 0); }, 0);
    var share = clamp2(live.length * CONFIG.valve.shareStep + CONFIG.valve.shareBase, CONFIG.valve.shareBase, CONFIG.valve.shareCap);
    var corridor = (ensure(G).corridor.active) ? CONFIG.valve.corridor : 1;
    return rm1((CONFIG.valve.base + sum * CONFIG.valve.perOpening) * share * corridor);
  }

  /* ── actions ───────────────────────────────────────────────────── */
  function canApply(key, f) {
    var g = S();
    if (!g) return { ok: false, reason: "No career loaded." };
    if (key === "screens") {
      var s0 = ensure(g);
      if ((s0.bump.screens || 0) >= CONFIG.screenOwn.maxUnits) return { ok: false, reason: "the circuit is at its ceiling" };
      var c0 = CONFIG.screenOwn.baseCost + (s0.bump.screens || 0) * CONFIG.screenOwn.costStep;
      if ((g.studio.cash || 0) < c0) return { ok: false, reason: "needs " + fmt(c0) + " cash (have " + fmt(g.studio.cash) + ")" };
      return { ok: true, cost: c0 };
    }
    if (key === "corridor") {
      var s1 = ensure(g);
      if (s1.corridor.active) return { ok: false, reason: "a booking corridor is already locked (" + s1.corridor.weeksLeft + "w)" };
      if (s1.corridor.lastBooked && g.week - s1.corridor.lastBooked < CONFIG.corridor.cooldown) {
        return { ok: false, reason: "the circuit will not re-shuffle for another " + (CONFIG.corridor.cooldown - (g.week - s1.corridor.lastBooked)) + "w" };
      }
      if ((g.studio.cash || 0) < CONFIG.corridor.cost) return { ok: false, reason: "needs " + fmt(CONFIG.corridor.cost) + " cash" };
      return { ok: true, cost: CONFIG.corridor.cost };
    }
    if (key === "priceRelief") {
      var s2 = ensure(g);
      if (s2.bump.priceMode === "relief") return { ok: true, cost: 0 };
      if ((g.studio.cash || 0) < CONFIG.priceRelief.cost) return { ok: false, reason: "needs " + fmt(CONFIG.priceRelief.cost) + " cash" };
      return { ok: true, cost: CONFIG.priceRelief.cost };
    }
    if (!f) return { ok: false, reason: "No release selected." };
    var def = TACTICS[key], cfg = CONFIG[key];
    if (!def || !cfg) return { ok: false, reason: "Unknown lever." };
    var gate = def.gate ? def.gate(f) : null;
    if (gate) return { ok: false, reason: gate };
    if (key === "relaunch") {
      if (isRunning(f, "relaunch")) return { ok: false, reason: "a re-release is already booked" };
      if (f.inTheaters) return { ok: false, reason: "already in theaters — wait for the run to close" };
    } else {
      if (!f.inTheaters) return { ok: false, reason: "the run has closed — a re-release is the only lever left" };
      if (isRunning(f, key)) return { ok: false, reason: def.name + " is already running (" + recOf(f, key).weeksLeft + "w left)" };
      if (levelOf(f, key) >= cfg.maxLevel) return { ok: false, reason: "already at the maximum level" };
    }
    var cost = leverCost(cfg, f);
    if ((g.studio.cash || 0) < cost) return { ok: false, reason: "needs " + fmt(cost) + " cash (have " + fmt(g.studio.cash) + ")" };
    return { ok: true, cost: cost };
  }

  function applyLever(key, filmId) {
    var g = S();
    if (!g) return { ok: false, reason: "No career loaded." };
    if (key === "screens") return buyScreens();
    if (key === "corridor") return bookCorridor();
    if (key === "priceRelief") return setPriceRelief();
    var f = (g.films || []).filter(function (x) { return String(x.id) === String(filmId); })[0];
    if (!f) return { ok: false, reason: "Pick a release first." };
    var check = canApply(key, f);
    if (!check.ok) return check;
    var col = ensureFilm(f), cfg = CONFIG[key];
    var rec = recFor(g, f);
    spendMoney("marketing", check.cost);
    col.cost = rm1((col.cost || 0) + check.cost);
    var prev = rec[key];
    var nextLevel = (prev && Number(prev.weeksLeft) > 0) ? (Number(prev.level) || 1) : (Number(prev && prev.level) || 0) + 1;
    rec[key] = { level: nextLevel, weeksLeft: cfg.weeks, at: g.week, filmId: f.id, title: f.title };
    if (key === "relaunch") {
      col.totals.relaunches = (Number(col.totals.relaunches) || 0) + 1;
      try { if (typeof global.reReleaseFilm === "function") global.reReleaseFilm(f.id); } catch (e) {}
      say("🔁 Re-release booked for \"" + f.title + "\" (−" + fmt(check.cost) + ") — the picture goes back on screens.", "gold");
    } else {
      say("📈 " + TACTICS[key].name + " on \"" + f.title + "\" (−" + fmt(check.cost) + ") — collection lifts from this week.", "good");
    }
    beep();
    persist();
    return { ok: true, cost: check.cost, film: f };
  }

  function buyScreens() {
    var g = S();
    if (!g) return { ok: false, reason: "No career loaded." };
    var check = canApply("screens", null);
    if (!check.ok) return check;
    var s = ensure(g);
    spendMoney("studio", check.cost);
    s.bump.screens = (s.bump.screens || 0) + 1;
    say("🖥 Bought " + Math.round(CONFIG.screenOwn.perUnit * 100) + " pts of circuit screens (−" + fmt(check.cost) + ") — every wide release opens wider now.", "good");
    beep();
    persist();
    return { ok: true, cost: check.cost };
  }

  function setPriceRelief() {
    var g = S();
    if (!g) return { ok: false, reason: "No career loaded." };
    var s = ensure(g);
    if (s.bump.priceMode === "relief") {
      s.bump.priceMode = "standard";
      s.bump.priceReliefAt = 0;
      say("🎟 Discount Tuesday retired — tickets return to standard price.", "");
    } else {
      var check = canApply("priceRelief", null);
      if (!check.ok) return check;
      spendMoney("marketing", check.cost);
      s.bump.priceMode = "relief";
      s.bump.priceReliefAt = g.week;
      say("🎟 Discount Tuesday goes live across the circuit (−" + fmt(check.cost) + ") — admissions up, price per seat down.", "good");
      beep();
    }
    persist();
    return { ok: true };
  }

  function bookCorridor() {
    var g = S();
    if (!g) return { ok: false, reason: "No career loaded." };
    var check = canApply("corridor", null);
    if (!check.ok) return check;
    var s = ensure(g);
    spendMoney("marketing", check.cost);
    s.corridor = { active: true, weeksLeft: CONFIG.corridor.weeks, lastBooked: g.week };
    say("🗓 Corridor booking locked (−" + fmt(check.cost) + ") — every live run gets a lift for " + CONFIG.corridor.weeks + " weeks.", "good");
    beep();
    persist();
    return { ok: true, cost: check.cost };
  }

  /* ── engine seams ──────────────────────────────────────────────── */
  function openingMultiplier(p, G0) {
    try {
      var G = G0 || S();
      if (!G) return 1;
      var s = ensure(G);
      var m = 1;
      if (s.bump.screens > 0 && (!p || p.scale === "tentpole" || p.scale === "mid")) {
        m *= 1 + clamp2(s.bump.screens * CONFIG.screenOwn.perUnit * 0.5, 0, 0.14);
      }
      if (s.corridor.active) m *= 1 + CONFIG.corridor.bump;
      if (s.bump.priceMode === "relief") m *= 1.03;
      return clamp2(m, 1, 1.32);
    } catch (e) { return 1; }
  }

  function legsBonus(f) {
    try {
      if (!f) return 0;
      var out = 0;
      if (isRunning(f, "pushScreens")) out += 0.10;
      if (isRunning(f, "merchWindow")) out += 0.05;
      if (isRunning(f, "relaunch")) out += 0.25;
      return clamp2(out, 0, 0.45);
    } catch (e) { return 0; }
  }

  /* The multiplier tickTheatrical() applies to this week's gross. */
  function grossMultiplier(f, G0) {
    try {
      var G = G0 || S();
      if (!f || !G) return 1;
      if (!(Number(f.weeksOut) > 1)) return 1; /* opening was priced by openingMultiplier */
      var s = ensure(G);
      var m = screenMult() * (1 + tuneOf(f, "pushScreens") + tuneOf(f, "eventPricing") + tuneOf(f, "intlBlitz"));
      if (s.corridor.active) m *= 1 + CONFIG.corridor.bump;
      if (s.bump.priceMode === "relief") m *= 1 + CONFIG.priceRelief.lift;
      return clamp2(m, 1, 2.6);
    } catch (e) { return 1; }
  }

  function merchIncome(f, gross) {
    try {
      var lv = isRunning(f, "merchWindow") ? (levelOf(f, "merchWindow") || 1) : 0;
      if (!lv) return 0;
      var d = D();
      var g = (d && d.GENRES) ? d.GENRES[f.genre] : null;
      var potential = clamp2((g && g.merch != null ? g.merch : 0.6) + (f.franchiseName ? 0.5 : 0), 0.2, 2.0);
      var aud = (f.quality && (f.quality.aud != null ? f.quality.aud : f.quality.overall)) || 50;
      var base = clamp2(gross, 0, 120) * 0.008 * potential * clamp2(aud / 60, 0.6, 1.5);
      return rm1(base * (1 + 0.45 * (lv - 1)));
    } catch (e) { return 0; }
  }

  /* International gross implied by a domestic gross (mirrors endTheatrical). */
  function intlAt(f, dom) {
    var share = 0.45;
    try {
      if (typeof global.intlShareOf === "function") {
        share = global.intlShareOf(f);
      } else {
        var d = D();
        share = (d && d.GENRES && d.GENRES[f.genre] && d.GENRES[f.genre].intlShare) || 0.45;
        if (f.censorCut) share = Math.max(0, share - 0.08);
        if (f.strictMarketsBan) share = Math.max(0, share - 0.03);
      }
    } catch (e) {}
    var econ = 1;
    try { if (typeof global.econM === "function") econ = global.econM("intl"); } catch (e) {}
    return rm1(Math.max(0, ((dom / Math.max(0.01, 1 - share)) - dom) * econ));
  }

  /* Per-film read for the desk and any run dossier. */
  function filmMult(f, G0) {
    try {
      var G = G0 || S();
      if (!f || !G) return { total: 0, parts: {} };
      ensureFilm(f);
      var s = ensure(G);
      var parts = {
        screens: screenMult() - 1,
        pushScreens: tuneOf(f, "pushScreens"),
        eventPricing: tuneOf(f, "eventPricing"),
        intlBlitz: tuneOf(f, "intlBlitz"),
        corridor: s.corridor.active ? CONFIG.corridor.bump : 0,
        priceRelief: s.bump.priceMode === "relief" ? CONFIG.priceRelief.lift : 0
      };
      var total = Object.keys(parts).reduce(function (a, k) { return a + Math.max(0, parts[k]); }, 0);
      return { total: clamp2(total, 0, 1.6), parts: parts, valve: valveOf(G) };
    } catch (e) { return { total: 0, parts: {} }; }
  }

  /* ── weekly tick (runs immediately after tickTheatrical) ─────────
     The base engine has already added this week's gross to f.dom and
     banked the domestic rentals. We add ONLY the lever increment, using
     the same intl/split maths the engine uses, then report to the coffer. */
  function tick(G0) {
    var G = G0 || S();
    if (!G) return null;
    var s = ensure(G);
    var lines = [];
    var generated = 0, upliftTotal = 0, dampedTotal = 0, levyTotal = 0, requested = 0;

    /* clocks */
    clocksOf(G).forEach(function (c) { c.weeksLeft = Math.max(0, Number(c.weeksLeft) - 1); });
    if (s.corridor.active) {
      s.corridor.weeksLeft = Math.max(0, Number(s.corridor.weeksLeft) - 1);
      if (s.corridor.weeksLeft === 0) { s.corridor.active = false; say("🗓 The booking corridor has closed — circuits re-shuffle their screens.", ""); }
    }

    var live = (G.films || []).filter(function (f) { return f.inTheaters; });

    /* 1 — live-run uplift, damped by the valve. */
    var lift = {};
    live.forEach(function (f) {
      ensureFilm(f);
      var m = grossMultiplier(f, G);
      if (m <= 1.0001) return;
      /* Base the lift on THIS week's un-levered gross that tickTheatrical just
         pushed. Using the previous record would compound: last week's record
         already carried its own increment, so each week would re-lift the lift
         (≈ m/wk decay tail, not m). */
      var wk = (f.weekly && f.weekly.length) ? f.weekly[f.weekly.length - 1] : null;
      var base = (wk && Number(wk.w) === Number(G.week)) ? Number(wk.gross) : Number(f.opening);
      base = Math.max(0, isFinite(base) ? base : 0);
      if (base > 0) lift[f.id] = base * (m - 1);
    });
    var totalLift = Object.keys(lift).reduce(function (a, k) { return a + lift[k]; }, 0);
    requested = totalLift;
    var valve = valveOf(G);
    var cut = (totalLift > valve && totalLift > 0) ? valve / totalLift : 1;
    if (cut < 1) dampedTotal = rm1(totalLift * (1 - cut));

    live.forEach(function (f) {
      var raw = lift[f.id] || 0;
      if (raw <= 0) return;
      var amount = rm1(raw * cut);
      if (amount < 0.1) return;
      var col = ensureFilm(f);
      var oldDom = f.dom || 0;
      var oldIntl = Number(f.intl) || intlAt(f, oldDom);
      var newDom = oldDom + amount;
      var newIntl = intlAt(f, newDom);
      f.dom = rm1(newDom);
      f.intl = newIntl;
      f.ww = rm1(f.dom + newIntl);
      /* tickTheatrical pushed this week's un-levered gross into f.weekly and
         ran its intl/territory maths on that. Fold the increment into the same
         record so sum(weekly.gross) keeps tracking f.dom; otherwise the chart,
         chart WoW maths and the collection history all read a stale figure. */
      var wk = (f.weekly && f.weekly.length) ? f.weekly[f.weekly.length - 1] : null;
      if (wk && Number(wk.w) === Number(G.week)) {
        wk.gross = rm1(Math.max(0, Number(wk.gross) || 0) + amount);
      } else {
        f.weekly = f.weekly || [];
        f.weekly.push({ w: G.week, gross: amount });
      }
      earnMoney("theatrical", rm1(amount * CONFIG.domShare));
      var intlDelta = rm1(Math.max(0, newIntl - oldIntl) * CONFIG.intlShare);
      if (intlDelta > 0) earnMoney("theatrical", intlDelta);
      /* territory licensees take their royalty on this increment too */
      try {
        if (typeof BOW_TERRITORIES !== "undefined" && typeof BOW_TERRITORIES.tickWeeklyRoyalties === "function") {
          var share = f.presales ? 0 : ((D() && D().GENRES && D().GENRES[f.genre] && D().GENRES[f.genre].intlShare) || 0.45);
          BOW_TERRITORIES.tickWeeklyRoyalties(f, amount * share, G);
        }
      } catch (e) {}
      upliftTotal += amount;
      col.totals.uplift = rm1((col.totals.uplift || 0) + amount);
      col.history.unshift({ w: G.week, uplift: amount, gross: wk ? wk.gross : amount });
      if (col.history.length > 24) col.history.length = 24;
      if (amount >= 1.5) lines.push("📈 \"" + f.title + "\" collects an extra " + fmt(amount) + " this week on the lever stack.");
    });

    /* 2 — merchandise windows. */
    live.forEach(function (f) {
      if (!isRunning(f, "merchWindow")) return;
      var last = f.weekly && f.weekly.length ? Number(f.weekly[f.weekly.length - 1].gross) : Number(f.opening);
      var merch = merchIncome(f, Math.max(0, isFinite(last) ? last : 0));
      if (merch < 0.1) return;
      earnMoney("merch", merch);
      var col = ensureFilm(f);
      col.totals.merch = rm1((col.totals.merch || 0) + merch);
      generated += merch;
      if (merch >= 2) lines.push("🧢 \"" + f.title + "\" merch & tie-ins add " + fmt(merch) + " this week.");
    });

    /* 3 — finished-run collection program: every closed picture with a
       reported worldwide gross joins the library levy once rank has settled. */
    (G.films || []).forEach(function (f) {
      try {
        if (f.inTheaters || f.collectionLevy || !(Number(f.ww) > 0) || f.streamingOriginal) return;
        var settled = f.pay1At ? G.week >= f.pay1At : G.week >= ((f.releaseWeek || G.week) + 20);
        if (!settled) return;
        var add = rm1(clamp2(Number(f.ww) * 0.0022, 0.8, 42) * CONFIG.domShare);
        if (add <= 0) return;
        earnMoney("library", add);
        levyTotal += add;
        generated += add;
        f.collectionLevy = { paid: G.week, amount: add };
        if (add >= 1) lines.push("🏛 The finished-run program settles \"" + f.title + "\": +" + fmt(add) + " net.");
      } catch (e) {}
    });

    /* 4 — coffer bookkeeping. */
    generated += upliftTotal;
    s.weekly = {
      generated: rm1(generated),
      uplift: rm1(upliftTotal),
      requested: rm1(requested),
      levy: rm1(levyTotal),
      damped: rm1(dampedTotal),
      valve: valve,
      runs: live.length
    };
    s.history.unshift({ w: G.week, generated: rm1(generated), uplift: rm1(upliftTotal), damped: rm1(dampedTotal), valve: valve });
    if (s.history.length > CONFIG.historyWeeks) s.history.length = CONFIG.historyWeeks;
    s.ledger.unshift({ w: G.week, lines: lines.slice(0, 8) });
    if (s.ledger.length > CONFIG.historyWeeks) s.ledger.length = CONFIG.historyWeeks;

    lines.slice(0, 3).forEach(function (t, i) { say(t, i === 0 ? "good" : ""); });
    return s.weekly;
  }

  /* ── the desk (presentation only; all numbers come from state) ─── */
  function desc(f) {
    var bits = [f.inTheaters ? ("week " + (f.weeksOut || 1) + " in theaters") : "run closed"];
    bits.push("dom " + fmtG(f.dom || 0));
    if (f.ww) bits.push("ww " + fmtG(f.ww));
    bits.push("opened " + fmtG(f.opening || 0));
    return bits.join(" · ");
  }

  function tacticCard(key, f) {
    var def = TACTICS[key], cfg = CONFIG[key];
    var running = isRunning(f, key);
    var lv = levelOf(f, key);
    var cost = leverCost(cfg, f);
    var check = canApply(key, f);
    var strength = cfg.lift + (cfg.perLevel || 0) * Math.max(0, (running ? lv : lv + 1) - 1);
    var state = running
      ? "<b class='gold'>running · " + recOf(f, key).weeksLeft + "w left · L" + lv + "</b>"
      : (check.ok ? "<b>" + fmt(cost) + "</b>" : "<b class='bad'>" + (check.reason || "unavailable") + "</b>");
    var label = running ? "Running" : (lv ? "Extend" : "Apply");
    return "<article class='boc-tactic'><header><span>" + def.icon + "</span><div><h4>" + def.name + "</h4><small>+" +
      Math.round(strength * 100) + "% weekly collection</small></div></header><p>" + def.blurb + "</p><footer>" + state +
      "<button class='produce-ghost' data-boc-bump='" + key + "' data-boc-film='" + f.id + "'" + (check.ok ? "" : " disabled") + ">" + label + "</button></footer></article>";
  }

  function html() {
    var G = S();
    if (!G) return "<div class='bo-empty'><b>No career loaded.</b></div>";
    var s = ensure(G);
    var wk = s.weekly || {};
    var cum = (s.history || []).reduce(function (a, h) { return a + (Number(h.uplift) || 0); }, 0);
    var live = (G.films || []).filter(function (f) { return f.inTheaters; });
    var ended = (G.films || []).filter(function (f) { return !f.inTheaters && Number(f.ww) > 0; }).slice(-8).reverse();
    var valve = valveOf(G);
    var used = valve > 0 ? Math.round(clamp2((wk.uplift || 0) / valve, 0, 1) * 100) : 0;

    var h = "<h2><span class='dialog-emoji' aria-hidden='true' data-emoji='🎟️'></span>Collection Command</h2>";
    h += "<p class='produce-lead'>Every lever is paid for from studio cash and pays back through the normal ledger. The valve is the industry's appetite for extra spend — past it, more money buys less.</p>";
    h += "<div class='produce-stats boc-stats'>" +
      "<div class='stat'><b>" + fmt(wk.generated || 0) + "</b><span>Collected this week</span></div>" +
      "<div class='stat'><b>" + fmt(wk.uplift || 0) + "</b><span>Lever uplift this week</span></div>" +
      "<div class='stat'><b>" + fmt(cum) + "</b><span>Lever uplift, last " + (s.history || []).length + " weeks</span></div>" +
      "<div class='stat'><b>" + used + "%</b><span>Valve used (" + fmt(valve) + "/wk)</span></div></div>";
    if (wk.damped > 0) h += "<p class='produce-note'>🛡 The valve damped " + fmt(wk.damped) + " of " + fmt(wk.requested || 0) + " requested uplift this week — the market only has so many seats.</p>";

    h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>CIRCUIT ASSETS</span><h3>Standing levers</h3><p>Permanent assets and circuit-wide programs that lift every release.</p></div></div><div class='produce-cards boc-cards'>";
    var units = Math.round(screenUnits());
    var ownCost = CONFIG.screenOwn.baseCost + units * CONFIG.screenOwn.costStep;
    h += "<article class='boc-tactic'><header><span>🖥</span><div><h4>Circuit Screens</h4><small>+" + Math.round((screenMult() - 1) * 100) + "% on every wide release</small></div></header><p>Own the screens instead of begging for them. Each tranche adds booking leverage to every picture on your slate.</p><footer><b>" + units + "/" + CONFIG.screenOwn.maxUnits + " owned</b>" +
      (units >= CONFIG.screenOwn.maxUnits ? "<b class='gold'>at ceiling</b>" : "<button class='produce-ghost' data-boc-bump='screens'" + ((G.studio.cash || 0) < ownCost ? " disabled" : "") + ">Buy " + fmt(ownCost) + "</button>") + "</footer></article>";
    h += "<article class='boc-tactic'><header><span>🗓</span><div><h4>Booking Corridor</h4><small>+" + Math.round(CONFIG.corridor.bump * 100) + "% to every live run</small></div></header><p>Lock a clear corridor with the circuits so your own slate is not fighting itself for screens.</p><footer>" +
      (s.corridor.active ? "<b class='gold'>locked · " + s.corridor.weeksLeft + "w left</b>" : "<button class='produce-ghost' data-boc-bump='corridor'" + ((G.studio.cash || 0) < CONFIG.corridor.cost ? " disabled" : "") + ">Book " + fmt(CONFIG.corridor.cost) + "</button>") + "</footer></article>";
    h += "<article class='boc-tactic'><header><span>🎟</span><div><h4>Discount Tuesday</h4><small>+" + Math.round(CONFIG.priceRelief.lift * 100) + "% admissions</small></div></header><p>A circuit-wide price program: more bodies through the door, thinner margin on every seat. Good for legs, softer on premium weeks.</p><footer>" +
      (s.bump.priceMode === "relief" ? "<b class='gold'>live</b><button class='produce-ghost' data-boc-bump='priceRelief'>Retire</button>" : "<button class='produce-ghost' data-boc-bump='priceRelief'" + ((G.studio.cash || 0) < CONFIG.priceRelief.cost ? " disabled" : "") + ">Start (" + fmt(CONFIG.priceRelief.cost) + ")</button>") + "</footer></article>";
    h += "</div></section>";

    if (live.length) {
      h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>LIVE RUNS</span><h3>Push a running picture</h3><p>Levers stack, cost cash and expire. A run only has so many weeks left before the re-release desk.</p></div><span class='produce-stamp'>" + live.length + " RUNNING</span></div>";
      live.slice(0, 4).forEach(function (f) {
        h += "<div class='boc-film' data-boc-filmid='" + f.id + "'><header><h4>" + f.title + "</h4><small>" + desc(f) + "</small></header><div class='produce-cards boc-cards'>" +
          TACTIC_KEYS.filter(function (k) { return k !== "relaunch"; }).map(function (k) { return tacticCard(k, f); }).join("") +
          "</div></div>";
      });
      h += "</section>";
    } else {
      h += "<section class='produce-panel'><div class='bo-empty'><b>Nothing is in theaters.</b><p>Release a picture and the live-run levers appear here.</p></div></section>";
    }

    if (ended.length) {
      h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>CATALOGUE</span><h3>Re-release a finished run</h3><p>A closed picture can go back out once: anniversary prints, a restoration, a new trailer cut.</p></div></div><div class='produce-cards boc-cards'>";
      ended.forEach(function (f) {
        var card = tacticCard("relaunch", f);
        h += card.replace(/<div><h4>Re-Release \/ Restoration Run<\/h4><small>[^<]*<\/small><\/div>/, "<div><h4>" + f.title + "</h4><small>re-release +" + Math.round(CONFIG.relaunch.lift * 100) + "% · ww " + fmtG(f.ww) + "</small></div>");
      });
      h += "</div></section>";
    }

    h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>COFFER LEDGER</span><h3>What the levers collected</h3><p>Newest first. Damped money is uplift the valve refused to pay.</p></div></div>";
    var led = (s.ledger || []).slice(0, 8);
    if (!led.length) h += "<div class='bo-empty'><b>No lever activity yet.</b><p>Apply a lever above and this ledger fills in every week.</p></div>";
    else {
      h += "<ul class='boc-ledger'>" + led.map(function (row) {
        return "<li><b>Week " + row.w + "</b><span>" + ((row.lines && row.lines.length) ? row.lines.join(" ") : "No lever payouts this week.") + "</span></li>";
      }).join("") + "</ul>";
    }
    h += "</section>";
    return h;
  }

  function bind(root, rerender) {
    if (!root || !root.addEventListener) return;
    root.addEventListener("click", function (ev) {
      var btn = (ev.target && ev.target.closest) ? ev.target.closest("[data-boc-bump]") : null;
      if (!btn || btn.disabled) return;
      ev.preventDefault();
      ev.stopPropagation();
      var key = btn.getAttribute("data-boc-bump");
      var filmId = btn.getAttribute("data-boc-film") || null;
      var res = applyLever(key, filmId);
      if (!res || !res.ok) say("⚠ " + ((res && res.reason) || "That lever is not available."), "bad");
      if (typeof rerender === "function") rerender();
    }, false);
  }

  function openDesk() {
    var g = S();
    if (!g) return null;
    ensure(g);
    if (typeof global.openModal !== "function") return null;
    var root = global.openModal(html(), { className: "command-produce-modal boc-desk" });
    var heading = root.querySelector(".boc-desk > h2");
    var title = root.querySelector(".modal-head > div");
    if (heading && title && document.documentElement.dataset.layout === "vertical") title.appendChild(heading);
    var veil = null;
    try { veil = document.querySelector("#modalRoot .modal-veil:last-child"); } catch (e) {}
    if (veil) bind(veil, function () { try { global.closeModal(); } catch (e) {} openDesk(); });
    return root;
  }

  /* ── public API ───────────────────────────────────────────────── */
  global.BoxOfficeCollection = {
    VERSION: VERSION,
    CONFIG: CONFIG,
    TACTICS: TACTICS,
    TACTIC_KEYS: TACTIC_KEYS,
    state: ensure,
    filmState: ensureFilm,
    tick: tick,
    openingMultiplier: openingMultiplier,
    legsBonus: legsBonus,
    grossMultiplier: grossMultiplier,
    filmMult: filmMult,
    valveOf: valveOf,
    screenMult: screenMult,
    screenUnits: screenUnits,
    leverCost: leverCost,
    levelOf: levelOf,
    isRunning: isRunning,
    canApply: canApply,
    applyLever: applyLever,
    merchIncome: merchIncome,
    html: html,
    openDesk: openDesk,
    _internals: { intlAt: intlAt }
  };
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
