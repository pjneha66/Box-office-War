/* ═════════════════════════════════════════════════════════════════════════
   LOT-FEEL.JS — Game Feel / Juice layer for Box Office War
   ---------------------------------------------------------------------------
   Implements the engine-neutral techniques from the `game-feel` skill:

     · trauma model        shake = trauma^2, sampled from layered sines
                           (never rand() per frame — that buzzes)
     · importance tiers    small 0.10-0.20 / medium 0.30-0.50 + flash /
                           large 0.70-1.00 + flash + zoom punch + number pop
     · eased motion        overshoot (BACK) for pops, ease-out for settles
     · flash channel       replaces hit-stop, which would require pausing the
                           simulation (we must not touch game logic)
     · accessibility       honours prefers-reduced-motion and the game's own
                           motionOK() preference; shake scaled by a setting

   PURE PRESENTATION. Every effect is a CSS transform / opacity on a wrapper.
   Nothing here reads or writes simulation state, and no layout is animated.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (global) {
  if (global.LotFeel) return;

  var doc = global.document;

  /* ───────────────────────── tuning (from the skill) ───────────────────────── */
  var CFG = {
    decay: 1.35,            // trauma lost per second (skill: 1.0 - 1.5)
    maxX: 26,               // px at full trauma^2 — scaled for UI, not a shooter
    maxY: 18,               // px
    maxRoll: 0.0045,        // deg per unit — kept tiny, this is UI not a camera
    shakeScale: 0.75,       // accessibility: default 75 % of full shake
    flashScale: 0.85,
    zoomPunch: 0.006
  };

  var TIERS = {
    small:  { trauma: 0.14, flash: 0,    zoom: 0,            pop: true  },
    medium: { trauma: 0.38, flash: 0.16, zoom: 0,            pop: true  },
    large:  { trauma: 0.78, flash: 0.30, zoom: CFG.zoomPunch, pop: true }
  };

  var S = {
    trauma: 0,
    t: 0,
    raf: 0,
    last: 0,
    stage: null,
    flashEl: null,
    reduced: false,
    motionPref: true,
    shakeOn: true,
    flashOn: true
  };

  /* ───────────────────────────── helpers ───────────────────────────── */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* layered sines at incommensurate rates = smooth, self-ending shake */
  function shakeAxis(seed, t) {
    return 0.6 * Math.sin(t * 11 + seed) + 0.4 * Math.sin(t * 23 + seed * 2);
  }

  function prefersReduced() {
    try { return global.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  function motionAllowed() {
    if (S.reduced) return false;
    /* respect the game's own preference if it exposes one */
    try { if (typeof global.motionOK === "function") return !!global.motionOK(); } catch (e) { /* ignore */ }
    return S.motionPref;
  }

  /* ───────────────────────────── the loop ───────────────────────────── */
  function frame(ts) {
    S.raf = global.requestAnimationFrame(frame);
    if (!S.stage) return;
    if (doc.hidden) { S.last = ts; return; }

    var dt = S.last ? Math.min(0.05, (ts - S.last) / 1000) : 0.016;
    S.last = ts;

    if (S.trauma <= 0.0005) {
      if (S._applied) { S.stage.style.transform = ""; S._applied = false; }
      return;
    }

    S.trauma = Math.max(0, S.trauma - CFG.decay * dt);
    var shake = S.trauma * S.trauma;           // quadratic: gentle low, sharp high
    S.t += dt * 26;

    var k = shake * CFG.shakeScale;
    var dx = CFG.maxX * k * shakeAxis(0, S.t);
    var dy = CFG.maxY * k * shakeAxis(1.7, S.t);
    var rot = CFG.maxRoll * k * shakeAxis(3.1, S.t);
    var zoom = 1 + (S._punch || 0);

    S.stage.style.transform =
      "translate3d(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px,0)" +
      " rotate(" + rot.toFixed(3) + "deg) scale(" + zoom.toFixed(4) + ")";
    S._applied = true;

    if (S._punch) S._punch = Math.max(0, S._punch - dt * 0.09);
  }

  /* ─────────────────────────── public effects ─────────────────────────── */

  /* Add trauma; hits ADD, they never reset (per the skill). */
  function addTrauma(v) {
    if (!motionAllowed() || !S.shakeOn) return;
    S.trauma = clamp(S.trauma + v, 0, 1);
  }

  function flash(strength, tint) {
    if (!motionAllowed() || !S.flashOn || strength <= 0) return;
    if (!S.flashEl) {
      var el = doc.createElement("div");
      el.className = "ll-flash";
      el.setAttribute("aria-hidden", "true");
      doc.body.appendChild(el);
      S.flashEl = el;
    }
    var a = clamp(strength * CFG.flashScale, 0, 0.5);
    S.flashEl.style.background = tint || "radial-gradient(circle at 50% 45%, rgba(255,255,255,.9), rgba(255,255,255,0) 70%)";
    S.flashEl.style.opacity = "0";
    void S.flashEl.offsetWidth;
    S.flashEl.style.transition = "opacity 60ms ease-out";
    S.flashEl.style.opacity = String(a);
    setTimeout(function () {
      if (!S.flashEl) return;
      S.flashEl.style.transition = "opacity 260ms ease-out";
      S.flashEl.style.opacity = "0";
    }, 62);
  }

  /* Squash & stretch with overshoot — "the pop". */
  function pop(el, strength) {
    if (!el || !motionAllowed()) return;
    var s = strength || 1;
    el.classList.remove("ll-pop");
    void el.offsetWidth;
    el.style.setProperty("--ll-pop", String(s));
    el.classList.add("ll-pop");
    setTimeout(function () { el.classList.remove("ll-pop"); }, 420);
  }

  /* Number pop: rise + fade, fanned out so stacked hits don't overlap. */
  function numberPop(el) {
    if (!el || !motionAllowed()) return;
    el.classList.remove("ll-num");
    void el.offsetWidth;
    el.classList.add("ll-num");
    setTimeout(function () { el.classList.remove("ll-num"); }, 520);
  }

  /* ───────────────── count-up on value change ─────────────────
     The game re-renders its DOM, so elements are not stable. We key the
     last-seen value off a stable label (the stat's caption or the HUD id),
     which lets a freshly created element still tick from the old value. */
  var NUM_RE = /(-?\d[\d,]*(?:\.\d+)?)/;

  function splitNum(text) {
    var s = String(text == null ? "" : text);
    var m = NUM_RE.exec(s);
    if (!m) return null;
    var val = parseFloat(m[0].replace(/,/g, ""));
    if (!isFinite(val)) return null;
    return { pre: s.slice(0, m.index), tok: m[0], post: s.slice(m.index + m[0].length), val: val };
  }

  function formatLike(template, v) {
    var dec = (template.split(".")[1] || "").length;
    var out = Math.abs(v).toFixed(dec);
    if (template.indexOf(",") !== -1) {
      var parts = out.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      out = parts.join(".");
    }
    return (v < 0 ? "-" : "") + out;
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function countUp(el, key, from, to) {
    if (!el || !motionAllowed()) return;
    var tmpl = splitNum(el.textContent);
    if (!tmpl) return;
    var token = tmpl.tok;
    var start = null, dur = 420;
    function step(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / dur);
      var v = from + (to - from) * easeOutCubic(k);
      el.textContent = tmpl.pre + formatLike(token, v) + tmpl.post;
      if (k < 1) global.requestAnimationFrame(step);
    }
    global.requestAnimationFrame(step);
  }

  var _seen = {};          // key -> last value
  var _pending = null, _flushTimer = null;

  function queueCountUp() {
    if (_flushTimer) return;
    _flushTimer = setTimeout(function () {
      _flushTimer = null;
      var nodes = _pending; _pending = null;
      if (!nodes) return;
      nodes.forEach(function (el) {
        var p = splitNum(el.textContent);
        if (!p) return;
        var label = "";
        var host = el.closest ? el.closest(".stat, .kairo-stat-chip, .itch-hud-stat") : null;
        if (host) {
          var cap = host.querySelector(".s-l, .k-lbl, .lbl");
          if (cap) label = (cap.textContent || "").trim() + "|";
        }
        var key = label + (el.id || "") + (host ? "" : "|" + el.className);
        if (!(key in _seen)) { _seen[key] = p.val; return; }
        var prev = _seen[key];
        _seen[key] = p.val;
        if (Math.abs(prev - p.val) > 0.0001) countUp(el, key, prev, p.val);
      });
    }, 70);
  }

  var NUM_SEL = ".s-v, #chipCash, #chipDebt, #chipRep, #lotHudCash, #lotHudDate, #resumeCash";

  function watchNumbers() {
    var root = doc.getElementById("view") || doc.body;
    if (typeof global.MutationObserver !== "function") return;
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        var t = m.target;
        if (t && t.nodeType === 3) t = t.parentElement;
        if (!t || !t.querySelectorAll) continue;
        var hits = t.matches ? t.matches(NUM_SEL) : false;
        if (hits) { if (!_pending) _pending = []; _pending.push(t); }
        var kids = t.querySelectorAll(NUM_SEL);
        for (var j = 0; j < kids.length && j < 24; j++) {
          if (!_pending) _pending = [];
          _pending.push(kids[j]);
        }
      }
      if (_pending) queueCountUp();
    });
    obs.observe(root, { childList: true, subtree: true, characterData: true });
  }

  /* One call per event; the tier keeps the whole game proportional. */
  function impact(tier, opts) {
    var t = TIERS[tier] || TIERS.small;
    var o = opts || {};
    if (!motionAllowed()) return;

    addTrauma(t.trauma);
    if (t.flash) flash(t.flash, o.tint);
    if (t.zoom && S.shakeOn) S._punch = t.zoom;
    if (t.pop && o.el) pop(o.el, tier === "large" ? 1.15 : 1);
    if (o.numberEl) numberPop(o.numberEl);
  }

  /* ─────────────────────────── event wiring ─────────────────────────── */
  /* We decorate the game's existing event functions instead of editing them:
     the original runs first and untouched, we only add presentation after. */

  function wrap(name, after) {
    var fn = global[name];
    if (typeof fn !== "function" || fn.__llWrapped) return false;
    var wrapped = function () {
      var r = fn.apply(this, arguments);
      try { after.apply(this, arguments); } catch (e) { /* never break the game */ }
      return r;
    };
    wrapped.__llWrapped = true;
    wrapped.__llOriginal = fn;
    global[name] = wrapped;
    return true;
  }

  var KIND_TIER = {
    bad: "medium", danger: "medium", warn: "small", warning: "small",
    gold: "large", good: "small", success: "small", cash: "small"
  };

  function reactToToast(text, kind) {
    var k = String(kind || "").toLowerCase();
    var tier = KIND_TIER[k] || "small";
    var tint = null;
    if (tier === "medium") tint = "radial-gradient(circle at 50% 50%, rgba(255,90,90,.55), rgba(255,90,90,0) 72%)";
    else if (tier === "large") tint = "radial-gradient(circle at 50% 45%, rgba(255,214,120,.85), rgba(255,214,120,0) 70%)";
    impact(tier, { tint: tint });
  }

  function wireEvents() {
    /* toasts are the game's universal "something happened" channel */
    wrap("toast", function (text, kind) { reactToToast(text, kind); });

    /* confetti is reserved for real wins */
    wrap("confetti", function () { impact("large", { tint: "radial-gradient(circle at 50% 45%, rgba(255,214,120,.8), rgba(255,214,120,0) 70%)" }); });

    /* a week tick is routine: no shake, just the HUD numbers popping */
    wrap("advanceWeek", function () { tickHud(); });
    wrap("fastWeek", function () { tickHud(); });

    /* button press = small, always (the cheapest, most repeated feedback) */
    doc.addEventListener("pointerdown", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var b = t.closest(".btn, .tab, .btab, .subnav-pill, .kairo-nav-tab, .itch-btn-gold, .itch-btn-blue");
      if (b) pop(b, 0.9);
    }, true);
  }

  function tickHud() {
    numberPop(doc.getElementById("chipCash"));
    numberPop(doc.getElementById("chipDate"));
    numberPop(doc.getElementById("chipRep"));
    var stats = doc.querySelectorAll(".stat .s-v");
    for (var i = 0; i < stats.length && i < 8; i++) numberPop(stats[i]);
  }

  /* ─────────────────────────── public API ─────────────────────────── */
  var api = {
    impact: impact,
    addTrauma: addTrauma,
    flash: flash,
    pop: pop,
    numberPop: numberPop,
    tick: tickHud,
    config: function (opts) {
      if (!opts) return CFG;
      if (typeof opts.shakeScale === "number") CFG.shakeScale = clamp(opts.shakeScale, 0, 2);
      if (typeof opts.flashScale === "number") CFG.flashScale = clamp(opts.flashScale, 0, 2);
      if (typeof opts.decay === "number") CFG.decay = clamp(opts.decay, 0.2, 6);
      return CFG;
    },
    setShake: function (on) { S.shakeOn = !!on; },
    setFlash: function (on) { S.flashOn = !!on; },
    trauma: function () { return S.trauma; }
  };
  global.LotFeel = api;

  /* ─────────────────────────────── boot ─────────────────────────────── */
  function boot() {
    S.reduced = prefersReduced();
    S.stage = doc.getElementById("studiolotGlobalStage");
    if (!S.stage) { setTimeout(boot, 300); return; }
    wireEvents();
    try { watchNumbers(); } catch (e) { /* observer optional */ }
    if (!S.raf) S.raf = global.requestAnimationFrame(frame);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 40);

})(typeof window !== "undefined" ? window : global);
