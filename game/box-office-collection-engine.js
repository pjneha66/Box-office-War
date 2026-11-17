/* ═══════════════════════════════════════════════════════════════════
   BOX OFFICE WAR — game/box-office-collection-engine.js
   Collection Command for the rebuilt (game/) UI.
   Player-driven levers that raise what each picture collects.
   Wires into game/engine.js seams: expectedOpening, tickTheatrical,
   advanceWeek. Uses S (not G), spend/earn, findFilm.

   All state lives in S.collection (career) and f.collection (per film).
   Optional / lazy-initialized: pre-v43.2 saves load unchanged.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
(function (global) {
  var VERSION = 1;

  var CONFIG = {
    domShare: 0.52,   /* studio keeps 52% of domestic rental */
    intlShare: 0.42,  /* studio keeps 42% of international rental */

    screenOwn: { perUnit: 0.022, maxUnits: 10, cap: 0.22, baseCost: 34, costStep: 22 },
    priceRelief: { cut: 0.10, lift: 0.08, cost: 2 },

    pushScreens: { lift: 0.26, perLevel: 0.080, maxLevel: 3, weeks: 8, costFrac: 0.26, minCost: 7, maxCost: 48 },
    eventPricing: { lift: 0.20, perLevel: 0.060, maxLevel: 3, weeks: 6, costFrac: 0.18, minCost: 5, maxCost: 34 },
    intlBlitz: { lift: 0.22, perLevel: 0.100, maxLevel: 2, weeks: 10, costFrac: 0.22, minCost: 8, maxCost: 46 },
    merchWindow: { lift: 0.08, perLevel: 0.050, maxLevel: 3, weeks: 8, costFrac: 0.10, minCost: 2, maxCost: 20 },
    relaunch: { lift: 0.70, weeks: 5, costFrac: 0.18, minCost: 4, maxCost: 32 },

    corridor: { bump: 0.05, weeks: 4, cost: 45, cooldown: 26 },
    valve: { base: 55, perOpening: 8.0, corridor: 1.28, shareBase: 0.75, shareStep: 0.045, shareCap: 1.0 },

    historyWeeks: 60
  };

  var TACTIC_KEYS = ["pushScreens", "eventPricing", "intlBlitz", "merchWindow", "relaunch"];
  var TACTICS = {
    pushScreens: { name: "Screen Expansion Push", icon: "🖥", blurb: "Buy more prints and shows: bigger first month." },
    eventPricing: { name: "Event Pricing", icon: "🎟", blurb: "Premium surcharge on PLF/IMAX/holiday weeks." },
    intlBlitz: { name: "International Blitz", icon: "🌍", blurb: "Day-and-date dubs and press in cold territories." },
    merchWindow: { name: "Merch & Tie-In Window", icon: "🧢", blurb: "Character licensing while the picture is hot." },
    relaunch: { name: "Re-Release / Restoration", icon: "🔁", blurb: "Anniversary prints for a closed title." }
  };

  /* ── helpers ───────────────────────────────────────────────────── */
  function S() { try { return (typeof global !== "undefined" && global.S) ? global.S : (typeof S !== "undefined" ? S : null); } catch (e) { return null; } }
  function clamp2(x, lo, hi) { x = Number(x); if (!isFinite(x)) x = lo; return Math.max(lo, Math.min(hi, x)); }
  function rm1(x) { x = Number(x); return isFinite(x) ? Math.round(x * 10) / 10 : 0; }
  function fmt(x) { try { if (typeof global.fmtM === "function") return global.fmtM(x); if (typeof global.fm === "function") return global.fm(x); } catch (e) {} return "$" + rm1(x) + "M"; }
  function spendMoney(cat, amt) { try { if (typeof global.spend === "function") { global.spend(amt, cat); return; } } catch (e) {} var s = S(); if (s && s.studio) s.studio.cash = rm1((s.studio.cash || 0) - amt); }
  function earnMoney(cat, amt) { try { if (typeof global.earn === "function") { global.earn(amt, cat); return; } } catch (e) {} var s = S(); if (s && s.studio) s.studio.cash = rm1((s.studio.cash || 0) + amt); }
  function say(text, kind) { try { if (typeof global.log === "function") global.log(text, kind || ""); } catch (e) {} }
  function persist() { try { if (typeof global.saveGame === "function") global.saveGame(); } catch (e) {} }

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
    var s = G.collection, b = blankState();
    if (!s.bump || typeof s.bump !== "object") s.bump = b.bump;
    if (s.bump.screens == null) s.bump.screens = 0;
    if (!s.bump.priceMode) s.bump.priceMode = "standard";
    if (!s.weekly || typeof s.weekly !== "object") s.weekly = b.weekly;
    if (!s.corridor || typeof s.corridor !== "object") s.corridor = b.corridor;
    if (!Array.isArray(s.history)) s.history = [];
    if (!Array.isArray(s.ledger)) s.ledger = [];
    return s;
  }
  function ensureFilm(f) {
    if (!f) return null;
    if (!f.collection || typeof f.collection !== "object") {
      f.collection = { cost: 0, totals: { uplift: 0, merch: 0, relaunches: 0 }, history: [] };
    }
    if (!f.collection.totals) f.collection.totals = { uplift: 0, merch: 0, relaunches: 0 };
    if (!Array.isArray(f.collection.history)) f.collection.history = [];
    return f.collection;
  }

  /* ── lever maths ───────────────────────────────────────────────── */
  function marketingOf(f) { return Math.max(1, Number(f && f.mkt) || 0); }
  function leverCost(cfg, f) { return Math.round(clamp2(marketingOf(f) * cfg.costFrac, cfg.minCost, cfg.maxCost)); }
  function recOf(G, f, key) { var s = ensure(G); if (!s || !f) return null; var k = String(f.id); if (!s.bump[k] || typeof s.bump[k] !== "object") s.bump[k] = {}; var rec = s.bump[k]; TACTIC_KEYS.forEach(function (t) { if (!(t in rec)) rec[t] = null; }); return rec[key]; }
  function isRunning(G, f, key) { var r = recOf(G, f, key); return !!(r && Number(r.weeksLeft) > 0); }
  function levelOf(G, f, key) { var r = recOf(G, f, key); return r ? Math.max(0, Number(r.level) || 0) : 0; }
  function tuneOf(G, f, key) {
    if (!isRunning(G, f, key)) return 0;
    var cfg = CONFIG[key], lv = levelOf(G, f, key) || 1;
    return cfg.perLevel ? cfg.lift + cfg.perLevel * (lv - 1) : cfg.lift;
  }

  function screenUnits() { var g = S(); var s = ensure(g); return s ? clamp2(s.bump.screens || 0, 0, CONFIG.screenOwn.maxUnits) : 0; }
  function screenMult() { return 1 + clamp2(screenUnits() * CONFIG.screenOwn.perUnit, 0, CONFIG.screenOwn.cap); }

  function valveOf(G0) {
    var G = G0 || S();
    if (!G) return 0;
    var live = (G.films || []).filter(function (f) { return f.status === "run"; });
    if (!live.length) return 0;
    var sum = live.reduce(function (a, f) { return a + Math.max(0, Number(f.opening) || 0); }, 0);
    var share = clamp2(live.length * CONFIG.valve.shareStep + CONFIG.valve.shareBase, CONFIG.valve.shareBase, CONFIG.valve.shareCap);
    var corridor = (ensure(G).corridor.active) ? CONFIG.valve.corridor : 1;
    return rm1((CONFIG.valve.base + sum * CONFIG.valve.perOpening) * share * corridor);
  }

  /* ── actions ───────────────────────────────────────────────────── */
  function canApply(G, key, f) {
    if (!G) return { ok: false, reason: "No career loaded." };
    if (key === "screens") {
      var s0 = ensure(G);
      if ((s0.bump.screens || 0) >= CONFIG.screenOwn.maxUnits) return { ok: false, reason: "the circuit is at its ceiling" };
      var c0 = CONFIG.screenOwn.baseCost + (s0.bump.screens || 0) * CONFIG.screenOwn.costStep;
      if ((G.studio.cash || 0) < c0) return { ok: false, reason: "needs " + fmt(c0) + " cash" };
      return { ok: true, cost: c0 };
    }
    if (key === "corridor") {
      var s1 = ensure(G);
      if (s1.corridor.active) return { ok: false, reason: "a booking corridor is already locked (" + s1.corridor.weeksLeft + "w)" };
      if (s1.corridor.lastBooked && G.studio.week - s1.corridor.lastBooked < CONFIG.corridor.cooldown) {
        return { ok: false, reason: "the circuit will not re-shuffle for another " + (CONFIG.corridor.cooldown - (G.studio.week - s1.corridor.lastBooked)) + "w" };
      }
      if ((G.studio.cash || 0) < CONFIG.corridor.cost) return { ok: false, reason: "needs " + fmt(CONFIG.corridor.cost) + " cash" };
      return { ok: true, cost: CONFIG.corridor.cost };
    }
    if (key === "priceRelief") {
      var s2 = ensure(G);
      if (s2.bump.priceMode === "relief") return { ok: true, cost: 0 };
      if ((G.studio.cash || 0) < CONFIG.priceRelief.cost) return { ok: false, reason: "needs " + fmt(CONFIG.priceRelief.cost) + " cash" };
      return { ok: true, cost: CONFIG.priceRelief.cost };
    }
    if (!f) return { ok: false, reason: "No release selected." };
    var def = TACTICS[key], cfg = CONFIG[key];
    if (!def || !cfg) return { ok: false, reason: "Unknown lever." };
    if (key === "relaunch") {
      if (isRunning(G, f, "relaunch")) return { ok: false, reason: "a re-release is already booked" };
      if (f.status !== "done") return { ok: false, reason: "the run is not closed yet" };
    } else {
      if (f.status !== "run") return { ok: false, reason: "the run is not in theaters" };
      if (isRunning(G, f, key)) return { ok: false, reason: def.name + " is already running (" + recOf(G, f, key).weeksLeft + "w left)" };
      if (levelOf(G, f, key) >= cfg.maxLevel) return { ok: false, reason: "already at the maximum level" };
    }
    var cost = leverCost(cfg, f);
    if ((G.studio.cash || 0) < cost) return { ok: false, reason: "needs " + fmt(cost) + " cash" };
    return { ok: true, cost: cost };
  }

  function applyLever(G, key, filmId) {
    if (!G) return { ok: false, reason: "No career loaded." };
    if (key === "screens") return buyScreens(G);
    if (key === "corridor") return bookCorridor(G);
    if (key === "priceRelief") return setPriceRelief(G);
    var f = (G.films || []).filter(function (x) { return String(x.id) === String(filmId); })[0];
    if (!f) return { ok: false, reason: "Pick a release first." };
    var check = canApply(G, key, f);
    if (!check.ok) return check;
    var cfg = CONFIG[key], rec = recOf(G, f, key);
    spendMoney("marketing", check.cost);
    var prev = rec[key];
    var nextLevel = (prev && Number(prev.weeksLeft) > 0) ? (Number(prev.level) || 1) : (Number(prev && prev.level) || 0) + 1;
    rec[key] = { level: nextLevel, weeksLeft: cfg.weeks, at: G.studio.week, filmId: f.id, title: f.title };
    ensureFilm(f);
    f.collection.cost = rm1((f.collection.cost || 0) + check.cost);
    if (key === "relaunch") {
      f.collection.totals.relaunches = (Number(f.collection.totals.relaunches) || 0) + 1;
      say("🔁 Re-release booked for \"" + f.title + "\" (−" + fmt(check.cost) + ").", "gold");
    } else {
      say("📈 " + TACTICS[key].name + " on \"" + f.title + "\" (−" + fmt(check.cost) + ").", "good");
    }
    persist();
    return { ok: true, cost: check.cost, film: f };
  }

  function buyScreens(G) {
    var check = canApply(G, "screens", null);
    if (!check.ok) return check;
    var s = ensure(G);
    spendMoney("studio", check.cost);
    s.bump.screens = (s.bump.screens || 0) + 1;
    say("🖥 Bought circuit screens (−" + fmt(check.cost) + ").", "good");
    persist();
    return { ok: true, cost: check.cost };
  }

  function setPriceRelief(G) {
    var s = ensure(G);
    if (s.bump.priceMode === "relief") {
      s.bump.priceMode = "standard";
      s.bump.priceReliefAt = 0;
      say("🎟 Discount Tuesday retired.", "");
    } else {
      var check = canApply(G, "priceRelief", null);
      if (!check.ok) return check;
      spendMoney("marketing", check.cost);
      s.bump.priceMode = "relief";
      s.bump.priceReliefAt = G.studio.week;
      say("🎟 Discount Tuesday live (−" + fmt(check.cost) + ").", "good");
    }
    persist();
    return { ok: true };
  }

  function bookCorridor(G) {
    var check = canApply(G, "corridor", null);
    if (!check.ok) return check;
    var s = ensure(G);
    spendMoney("marketing", check.cost);
    s.corridor = { active: true, weeksLeft: CONFIG.corridor.weeks, lastBooked: G.studio.week };
    say("🗓 Corridor booking locked.", "good");
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
      var G = S();
      if (isRunning(G, f, "pushScreens")) out += 0.10;
      if (isRunning(G, f, "merchWindow")) out += 0.05;
      if (isRunning(G, f, "relaunch")) out += 0.25;
      return clamp2(out, 0, 0.45);
    } catch (e) { return 0; }
  }

  function grossMultiplier(f, G0) {
    try {
      var G = G0 || S();
      if (!f || !G) return 1;
      if (!(f.status === "run")) return 1;
      var s = ensure(G);
      var m = screenMult() * (1 + tuneOf(G, f, "pushScreens") + tuneOf(G, f, "eventPricing") + tuneOf(G, f, "intlBlitz"));
      if (s.corridor.active) m *= 1 + CONFIG.corridor.bump;
      if (s.bump.priceMode === "relief") m *= 1 + CONFIG.priceRelief.lift;
      return clamp2(m, 1, 3.4);
    } catch (e) { return 1; }
  }

  function merchIncome(f, gross) {
    try {
      if (!isRunning(S(), f, "merchWindow")) return 0;
      var lv = levelOf(S(), f, "merchWindow") || 1;
      var g = (typeof global.GENRES !== "undefined" && global.GENRES) ? global.GENRES[f.genre] : null;
      var potential = clamp2((g && g.merch != null ? g.merch : 0.6) + (f.franchiseOf ? 0.8 : 0), 0.2, 2.4);
      var aud = (f.aud || 50);
      var base = clamp2(gross, 0, 120) * 0.008 * potential * clamp2(aud / 60, 0.6, 1.5);
      return rm1(base * (1 + 0.45 * (lv - 1)));
    } catch (e) { return 0; }
  }

  /* ── weekly tick (runs after tickTheatrical) ───────────────────── */
  function tick(G0) {
    var G = G0 || S();
    if (!G) return null;
    var s = ensure(G);
    var lines = [];
    var generated = 0, upliftTotal = 0, dampedTotal = 0, levyTotal = 0;

    TACTIC_KEYS.forEach(function (k) {
      if (s.bump[k] && Number(s.bump[k].weeksLeft) > 0) s.bump[k].weeksLeft--;
    });
    if (s.corridor.active) {
      s.corridor.weeksLeft = Math.max(0, Number(s.corridor.weeksLeft) - 1);
      if (s.corridor.weeksLeft === 0) { s.corridor.active = false; say("🗓 The booking corridor has closed.", ""); }
    }

    var live = (G.films || []).filter(function (f) { return f.status === "run"; });

    var lift = {};
    live.forEach(function (f) {
      ensureFilm(f);
      var m = grossMultiplier(f, G);
      if (m <= 1.0001) return;
      var last = f.weekly && f.weekly.length ? Number(f.weekly[f.weekly.length - 1]) : Number(f.opening);
      var base = Math.max(0, isFinite(last) ? last : 0);
      if (base > 0) lift[f.id] = base * (m - 1);
    });
    var totalLift = Object.keys(lift).reduce(function (a, k) { return a + lift[k]; }, 0);
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
      var newDom = oldDom + amount;
      f.dom = rm1(newDom);
      earnMoney("Box office · " + f.title, rm1(amount * CONFIG.domShare));
      upliftTotal += amount;
      col.totals.uplift = rm1((col.totals.uplift || 0) + amount);
      col.history.unshift({ w: G.studio.week, uplift: amount, gross: f.weekly && f.weekly.length ? f.weekly[f.weekly.length - 1] : 0 });
      if (col.history.length > 24) col.history.length = 24;
      if (amount >= 1.5) lines.push("📈 \"" + f.title + "\" collects an extra " + fmt(amount) + " this week.");
    });

    live.forEach(function (f) {
      if (!isRunning(G, f, "merchWindow")) return;
      var last = f.weekly && f.weekly.length ? Number(f.weekly[f.weekly.length - 1]) : Number(f.opening);
      var merch = merchIncome(f, Math.max(0, isFinite(last) ? last : 0));
      if (merch < 0.1) return;
      earnMoney("Merch · " + f.title, merch);
      var col = ensureFilm(f);
      col.totals.merch = rm1((col.totals.merch || 0) + merch);
      generated += merch;
      if (merch >= 2) lines.push("🧢 \"" + f.title + "\" merch adds " + fmt(merch) + " this week.");
    });

    (G.films || []).forEach(function (f) {
      try {
        if (f.status !== "done" || f.collectionLevy || !(Number(f.ww) > 0)) return;
        var add = rm1(clamp2(Number(f.ww) * 0.0022, 0.8, 42) * CONFIG.domShare);
        if (add <= 0) return;
        earnMoney("Library · " + f.title, add);
        levyTotal += add;
        generated += add;
        f.collectionLevy = { paid: G.studio.week, amount: add };
        if (add >= 1) lines.push("🏛 Finished-run program settles \"" + f.title + "\": +" + fmt(add) + ".");
      } catch (e) {}
    });

    generated += upliftTotal;
    s.weekly = {
      generated: rm1(generated), uplift: rm1(upliftTotal), valve: valve,
      damped: rm1(dampedTotal), runs: live.length
    };
    s.history.unshift({ w: G.studio.week, generated: rm1(generated), uplift: rm1(upliftTotal), damped: rm1(dampedTotal), valve: valve });
    if (s.history.length > CONFIG.historyWeeks) s.history.length = CONFIG.historyWeeks;
    s.ledger.unshift({ w: G.studio.week, lines: lines.slice(0, 8) });
    if (s.ledger.length > CONFIG.historyWeeks) s.ledger.length = CONFIG.historyWeeks;

    lines.slice(0, 3).forEach(function (t, i) { say(t, i === 0 ? "good" : ""); });
    return s.weekly;
  }

  /* ── desk HTML ─────────────────────────────────────────────────── */
  function desc(f) {
    var bits = [f.status === "run" ? ("week " + (f.weeksOut || 1) + " in theaters") : "run closed"];
    bits.push("dom " + fmt(f.dom || 0));
    bits.push("opened " + fmt(f.opening || 0));
    return bits.join(" · ");
  }

  function tacticCard(key, f) {
    var def = TACTICS[key], cfg = CONFIG[key];
    var running = isRunning(S(), f, key);
    var lv = levelOf(S(), f, key);
    var cost = leverCost(cfg, f);
    var check = canApply(S(), key, f);
    var strength = cfg.lift + (cfg.perLevel || 0) * Math.max(0, (running ? lv : lv + 1) - 1);
    var state = running
      ? "<b class='gold'>running · " + recOf(S(), f, key).weeksLeft + "w left · L" + lv + "</b>"
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
    var live = (G.films || []).filter(function (f) { return f.status === "run"; });
    var ended = (G.films || []).filter(function (f) { return f.status === "done" && Number(f.ww) > 0; }).slice(-8).reverse();
    var valve = valveOf(G);
    var used = valve > 0 ? Math.round(clamp2((wk.uplift || 0) / valve, 0, 1) * 100) : 0;

    var h = "<h2>🎟 Collection Command</h2>";
    h += "<p class='produce-lead'>Every lever is paid from studio cash and pays back through the normal ledger.</p>";
    h += "<div class='produce-stats boc-stats'>" +
      "<div class='stat'><b>" + fmt(wk.generated || 0) + "</b><span>Collected this week</span></div>" +
      "<div class='stat'><b>" + fmt(wk.uplift || 0) + "</b><span>Lever uplift this week</span></div>" +
      "<div class='stat'><b>" + fmt(cum) + "</b><span>Lever uplift, last " + (s.history || []).length + " weeks</span></div>" +
      "<div class='stat'><b>" + used + "%</b><span>Valve used (" + fmt(valve) + "/wk)</span></div></div>";
    if (wk.damped > 0) h += "<p class='produce-note'>🛡 The valve damped " + fmt(wk.damped) + " requested uplift this week.</p>";

    h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>CIRCUIT ASSETS</span><h3>Standing levers</h3><p>Permanent assets and circuit-wide programs.</p></div></div><div class='produce-cards boc-cards'>";
    var units = Math.round(screenUnits());
    var ownCost = CONFIG.screenOwn.baseCost + units * CONFIG.screenOwn.costStep;
    h += "<article class='boc-tactic'><header><span>🖥</span><div><h4>Circuit Screens</h4><small>+" + Math.round((screenMult() - 1) * 100) + "% on every wide release</small></div></header><p>Own the screens instead of begging for them.</p><footer><b>" + units + "/" + CONFIG.screenOwn.maxUnits + " owned</b>" +
      (units >= CONFIG.screenOwn.maxUnits ? "<b class='gold'>at ceiling</b>" : "<button class='produce-ghost' data-boc-bump='screens'" + ((G.studio.cash || 0) < ownCost ? " disabled" : "") + ">Buy " + fmt(ownCost) + "</button>") + "</footer></article>";
    h += "<article class='boc-tactic'><header><span>🗓</span><div><h4>Booking Corridor</h4><small>+" + Math.round(CONFIG.corridor.bump * 100) + "% to every live run</small></div></header><p>Lock a clear weekend for your slate.</p><footer>" +
      (s.corridor.active ? "<b class='gold'>locked · " + s.corridor.weeksLeft + "w left</b>" : "<button class='produce-ghost' data-boc-bump='corridor'" + ((G.studio.cash || 0) < CONFIG.corridor.cost ? " disabled" : "") + ">Book " + fmt(CONFIG.corridor.cost) + "</button>") + "</footer></article>";
    h += "<article class='boc-tactic'><header><span>🎟</span><div><h4>Discount Tuesday</h4><small>+" + Math.round(CONFIG.priceRelief.lift * 100) + "% admissions</small></div></header><p>A circuit-wide price program: more bodies, thinner margin.</p><footer>" +
      (s.bump.priceMode === "relief" ? "<b class='gold'>live</b><button class='produce-ghost' data-boc-bump='priceRelief'>Retire</button>" : "<button class='produce-ghost' data-boc-bump='priceRelief'" + ((G.studio.cash || 0) < CONFIG.priceRelief.cost ? " disabled" : "") + ">Start (" + fmt(CONFIG.priceRelief.cost) + ")</button>") + "</footer></article>";
    h += "</div></section>";

    if (live.length) {
      h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>LIVE RUNS</span><h3>Push a running picture</h3><p>Levers stack, cost cash and expire.</p></div><span class='produce-stamp'>" + live.length + " RUNNING</span></div>";
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
      h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>CATALOGUE</span><h3>Re-release a finished run</h3><p>A closed picture can go back out once.</p></div></div><div class='produce-cards boc-cards'>";
      ended.forEach(function (f) {
        var card = tacticCard("relaunch", f);
        h += card.replace(/<div><h4>Re-Release \/ Restoration<\/h4><small>[^<]*<\/small><\/div>/, "<div><h4>" + f.title + "</h4><small>re-release +" + Math.round(CONFIG.relaunch.lift * 100) + "% · ww " + fmt(f.ww) + "</small></div>");
      });
      h += "</div></section>";
    }

    h += "<section class='produce-panel'><div class='produce-panel-head'><div><span class='command-eyebrow'>COFFER LEDGER</span><h3>What the levers collected</h3><p>Newest first.</p></div></div>";
    var led = (s.ledger || []).slice(0, 8);
    if (!led.length) h += "<div class='bo-empty'><b>No lever activity yet.</b></div>";
    else {
      h += "<ul class='boc-ledger'>" + led.map(function (row) {
        return "<li><b>Week " + row.w + "</b><span>" + ((row.lines && row.lines.length) ? row.lines.join(" ") : "No lever payouts.") + "</span></li>";
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
      var res = applyLever(S(), key, filmId);
      if (!res || !res.ok) say("⚠ " + ((res && res.reason) || "Not available."), "bad");
      if (typeof rerender === "function") rerender();
    }, false);
  }

  function openDesk() {
    var g = S();
    if (!g) return null;
    ensure(g);
    if (typeof global.openModal !== "function") return null;
    var root = global.openModal(html(), { className: "command-produce-modal boc-desk" });
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
    filmMult: function (f, G0) { try { var G = G0 || S(); if (!f || !G) return { total: 0, parts: {} }; ensureFilm(f); var s = ensure(G); var parts = { screens: screenMult() - 1, pushScreens: tuneOf(G, f, "pushScreens"), eventPricing: tuneOf(G, f, "eventPricing"), intlBlitz: tuneOf(G, f, "intlBlitz"), corridor: s.corridor.active ? CONFIG.corridor.bump : 0, priceRelief: s.bump.priceMode === "relief" ? CONFIG.priceRelief.lift : 0 }; var total = Object.keys(parts).reduce(function (a, k) { return a + Math.max(0, parts[k]); }, 0); return { total: clamp2(total, 0, 1.6), parts: parts, valve: valveOf(G) }; } catch (e) { return { total: 0, parts: {} }; } },
    valveOf: valveOf,
    screenMult: screenMult,
    screenUnits: screenUnits,
    leverCost: leverCost,
    levelOf: function (G, f, key) { return levelOf(G, f, key); },
    isRunning: function (G, f, key) { return isRunning(G, f, key); },
    canApply: function (G, key, f) { return canApply(G, key, f); },
    applyLever: function (G, key, filmId) { return applyLever(G, key, filmId); },
    merchIncome: merchIncome,
    html: html,
    openDesk: openDesk
  };
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));