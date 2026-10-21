/* ═════════════════════════════════════════════════════════════════════════
   BOW-MOTION.JS — Universal motion layer for every tab, subtab and chart
   ---------------------------------------------------------------------------
   The game re-renders #view.innerHTML on every state change, so elements are
   never stable. This engine therefore keys its state off stable *labels*
   (a nearby caption, or the element's position inside a repeating list)
   rather than off element identity, which lets a freshly created node still
   animate from the previous value.

   What it drives:
     · staggered entrance for every direct child of #view (all tabs)
     · sub-tab switch re-animation
     · count-up on every numeric readout, with a green/red pulse on change
     · bar fills growing from zero (width- and height-based)
     · SVG sparklines / donuts drawing themselves in
     · ledger rows cascading in

   PURE PRESENTATION. It reads the DOM, never the simulation, and writes only
   inline transforms / text. No game logic is touched.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (global) {
  if (global.BowMotion) return;
  var doc = global.document;

  var REDUCED = false;
  try { REDUCED = global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { REDUCED = false; }

  /* selectors that hold a number worth counting up */
  var NUM_SEL = [
    ".s-v", ".k-val", ".val", ".tr-val", ".cb-val", ".cost-line b",
    ".t-stats b", ".a-stats b", ".ll-chip", ".resume-cash", ".t-name + .tiny"
  ].join(",");

  /* height-based bars: weekly gross, forecast, stock spark */
  var VBAR_SEL = ".wg, .stock-spark > i, .fg > i, .forecast-bars i, .pl-bar > i";
  /* width-based bars */
  var HBAR_SEL = ".cb-fill, .tr-fill, .pl-fill, .bar > i, .fb-fill";
  /* rows that cascade */
  var ROW_SEL = ".row, .cost-line, .film-row, .epg-row, .loan-row, .scen-row, .trend-row, .chart-bar";

  var _seen = Object.create(null);     // key -> last numeric value
  var _pending = null;
  var _timer = null;
  var _lastRun = 0;
  var _lastTab = "";
  var _lastChildCount = -1;

  /* ───────────────────────────── helpers ───────────────────────────── */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

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

  /* ───────────────────────── count-up + pulse ───────────────────────── */

  function countUp(el, from, to, token) {
    if (!el) return;
    var start = null, dur = 520;
    function step(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / dur);
      var v = from + (to - from) * easeOutCubic(k);
      el.textContent = el.__bowPre + formatLike(token, v) + el.__bowPost;
      if (k < 1) global.requestAnimationFrame(step);
      else el.textContent = el.__bowPre + formatLike(token, to) + el.__bowPost;
    }
    global.requestAnimationFrame(step);
  }

  function pulse(el, up) {
    if (!el || REDUCED) return;
    el.classList.remove("bow-up", "bow-down");
    void el.offsetWidth;
    el.classList.add(up ? "bow-up" : "bow-down");
    setTimeout(function () { el.classList.remove("bow-up", "bow-down"); }, 700);
  }

  function scanNumbers() {
    var root = doc.getElementById("view") || doc.body;
    var nodes = root.querySelectorAll(NUM_SEL);
    for (var i = 0; i < nodes.length && i < 90; i++) {
      var el = nodes[i];
      var p = splitNum(el.textContent);
      if (!p) continue;

      /* stable key: the nearest caption/label + this element's position
         among siblings that share its class */
      var host = el.closest(".stat, .kairo-stat-chip, .itch-hud-stat, .card, .chart-bar, .row, .fold, .talent-card");
      var label = "";
      if (host) {
        var cap = host.querySelector(".s-l, .k-lbl, .lbl, .cb-name, .tiny, .small, b:not(.s-v)");
        if (cap && cap !== el) label = (cap.textContent || "").trim().slice(0, 28) + "|";
      }
      var same = el.parentNode ? el.parentNode.querySelectorAll(":scope > " + (el.className || "*")) : [];
      var idx = 0;
      for (var j = 0; j < same.length; j++) { if (same[j] === el) { idx = j; break; } }
      var key = label + (el.className || "x") + "#" + idx;

      if (!(key in _seen)) { _seen[key] = p.val; continue; }
      var prev = _seen[key];
      _seen[key] = p.val;
      if (Math.abs(prev - p.val) > 0.0001) {
        el.__bowPre = p.pre;
        el.__bowPost = p.post;
        countUp(el, prev, p.val, p.tok);
        pulse(el, p.val > prev);
      }
    }
  }

  /* ─────────────────────── entrance + bar staging ─────────────────────── */

  function stage(root) {
    /* stagger index on every direct child of the view */
    var kids = root.children;
    for (var i = 0; i < kids.length && i < 14; i++) {
      kids[i].style.setProperty("--bow-i", String(i));
    }
    root.classList.remove("bow-stagger");
    void root.offsetWidth;
    root.classList.add("bow-stagger");

    /* height-based bars: cascade left-to-right */
    var vb = root.querySelectorAll(VBAR_SEL);
    for (var a = 0; a < vb.length && a < 60; a++) {
      vb[a].style.setProperty("--bow-i", String(a));
    }
    /* width-based bars: cascade down the list */
    var hb = root.querySelectorAll(HBAR_SEL);
    for (var b = 0; b < hb.length && b < 60; b++) {
      hb[b].style.setProperty("--bow-i", String(b));
    }
    /* ledger rows cascade */
    var rw = root.querySelectorAll(ROW_SEL);
    for (var c = 0; c < rw.length && c < 40; c++) {
      rw[c].style.setProperty("--bow-i", String(c));
    }
    /* SVG sparklines / donuts draw themselves in */
    var paths = root.querySelectorAll("svg path, svg polyline, svg circle, svg line, svg rect");
    for (var d = 0; d < paths.length && d < 60; d++) {
      drawSvg(paths[d], d);
    }
  }

  function drawSvg(node, i) {
    try {
      var len = 0;
      if (typeof node.getTotalLength === "function") {
        len = node.getTotalLength();
        node.style.strokeDasharray = String(len);
        node.style.strokeDashoffset = String(len);
        node.style.animation = "bowDraw .9s cubic-bezier(.2,.9,.3,1) " + (i * 55) + "ms both";
      } else if (node.tagName === "circle" || node.tagName === "rect") {
        /* donut segments / blocks grow from the top */
        node.style.transformOrigin = "center bottom";
        node.style.animation = "bowGrowY .6s cubic-bezier(.2,.9,.3,1) " + (i * 45) + "ms both";
      }
    } catch (e) { /* getTotalLength is not universal — skip silently */ }
  }

  /* ─────────────────────────── the observer ─────────────────────────── */

  function run(force) {
    _timer = null;
    var now = Date.now();
    var view = doc.getElementById("view");
    if (!view) return;

    var tab = "";
    try { tab = String(global.TAB || ""); } catch (e) { tab = ""; }
    var count = view.children.length;
    var changed = tab !== _lastTab || count !== _lastChildCount;
    _lastTab = tab;
    _lastChildCount = count;

    /* throttle: don't re-stage on every minor re-render, but always stage
       when the tab or the number of panels changes */
    if (!force && !changed && now - _lastRun < 900) return;
    _lastRun = now;

    stage(view);
    scanNumbers();
  }

  function schedule(force) {
    if (_timer) { if (force) { clearTimeout(_timer); _timer = null; } else return; }
    _timer = setTimeout(function () { run(force); }, force ? 0 : 90);
  }

  /* ─────────────────────────────── boot ─────────────────────────────── */

  function boot() {
    var app = doc.getElementById("app");
    if (!app) { setTimeout(boot, 250); return; }

    if (typeof global.MutationObserver === "function") {
      var obs = new MutationObserver(function () { schedule(false); });
      obs.observe(app, { childList: true, subtree: true });
    }

    /* sub-tab clicks get an immediate, forced re-stage */
    doc.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest(".subnav-pill, .subtab-btn, .kairo-nav-tab, .tab, .btab")) {
        var view = doc.getElementById("view");
        if (view) {
          view.classList.remove("bow-stagger");
          void view.offsetWidth;
        }
        schedule(true);
      }
    }, true);

    schedule(true);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 60);

  global.BowMotion = {
    refresh: function () { schedule(true); },
    reset: function () { _seen = Object.create(null); schedule(true); }
  };

})(typeof window !== "undefined" ? window : global);
