/* Box Office War — phone-first UX layer.
   Additive only: nothing here edits an existing file, and every feature is wrapped in
   guards so a missing dependency simply leaves that feature dormant.

   Hooks into the real globals defined by engine.js / ui.js:
     S (global state), saveGame(), advanceWeek(), onAdvance(), render(), drainFlash(),
     openSheet(), closeSheet(), fm(), toast(), SAVE_KEY "bow2.save.v1",
     weeklyChart(), filmsInRelease(), PREFS "bow2.prefs", "bow2.slots".

   Public surface:
     window.BowWeekSummary = { enabled(), setEnabled(b), show() }
     window.BowGlossary    = { define(term), attachAll() }
     window.BowChartControls = { sort(key, dir), filter(fn) }
     window.BowEmptyState  = { html(icon, title, body) }
     window.BowCrashLog    = { all(), export(), clear() }
     window.BowSaveIO      = { exportCurrent(), importText(str) }
     window.BowHaptics     = { enabled(), set(bool), buzz(ms) }
     window.BowSaved       = { mark(), last() }
     window.PhoneUX        = { init(), version }
   Load it with a script tag pointing at phone-ux.js, after ui.js.
*/
"use strict";

(function (w) {
  if (!w) { return; }

  var VERSION = "1.0.0";

  /* ── namespaced storage keys (never collide with bow2.save.v1 / bow2.prefs) ── */
  var NS = "bow2.phone.";
  var K_HIDE_SUMMARY = NS + "hideSummary";
  var K_SAVED_AT = NS + "savedAt";
  var K_HAPTIC = NS + "haptics";
  var K_CRASH = NS + "crash";
  var SAVE_KEY = "bow2.save.v1";

  var INIT_DONE = false;
  var STORAGE_PATCHED = false;
  var POLL_NEEDED = false;
  var POLLING = false;
  var CRASH_INSTALLED = false;
  var OBSERVING = false;
  var BUSY = false;
  var ENH_TIMER = null;

  /* ── tiny helpers (ES5 only) ─────────────────────────────────── */
  function lsGet(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { w.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function doc() { return w.document; }
  function byId(id) { var d = doc(); return d ? d.getElementById(id) : null; }
  function state() { var s = w.S; return s && s.studio ? s : null; }
  function money(x) {
    try { if (typeof w.fm === "function") { return w.fm(x); } } catch (e) {}
    if (!isFinite(x)) { return "$—"; }
    var neg = x < 0, a = Math.abs(x), s;
    if (a >= 950) { s = "$" + (a / 1000).toFixed(2) + "B"; }
    else if (a >= 10) { s = "$" + Math.round(a) + "M"; }
    else { s = "$" + a.toFixed(1) + "M"; }
    return neg ? "-" + s : s;
  }
  function escHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(x, d) {
    var n = typeof x === "number" ? x : parseFloat(x);
    return isFinite(n) ? n : (d || 0);
  }
  function closestAttr(node, attr, stopAt) {
    var el = node;
    while (el && el !== stopAt) {
      if (el.getAttribute && el.getAttribute(attr) != null) { return el; }
      el = el.parentNode;
    }
    return null;
  }
  function closestAttrIn(node, root) {
    var el = node;
    while (el) {
      if (el === root) { return true; }
      el = el.parentNode;
    }
    return false;
  }
  function hasClass(el, cls) {
    if (!el) { return false; }
    if (el.classList) { return el.classList.contains(cls); }
    return String(el.className || "").indexOf(cls) >= 0;
  }
  function addClass(el, cls) { if (!el) { return; } try { el.classList.add(cls); } catch (e) {} }
  function removeClass(el, cls) { if (!el) { return; } try { el.classList.remove(cls); } catch (e) {} }
  function toArray(list) {
    var out = [], i;
    if (!list) { return out; }
    for (i = 0; i < list.length; i++) { out.push(list[i]); }
    return out;
  }
  function clockOf(ts) {
    var d = new Date(ts);
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }
  function stampOf(ts) {
    var d = new Date(ts);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
      + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* ── 1. injected styles (one <style>, prefixed classes) ──────── */
  function installStyles() {
    var d = doc();
    if (!d || byId("px-style")) { return; }
    var css = ""
      + "#px-summary{position:fixed;inset:0;z-index:9200;display:flex;align-items:flex-end;"
      + "justify-content:center;background:rgba(4,6,10,.66);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}"
      + ".px-sheet{width:100%;max-width:540px;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;"
      + "background:var(--panel,#141826);border:1px solid var(--line,#262d44);border-radius:16px 16px 0 0;"
      + "padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));animation:pxUp .18s ease-out}"
      + "@keyframes pxUp{from{transform:translateY(20px);opacity:.55}to{transform:none;opacity:1}}"
      + ".px-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}"
      + ".px-eyebrow{font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted,#97a0b5)}"
      + ".px-h3{font-size:17px;font-weight:750;color:var(--text,#eef1f8);margin-top:2px}"
      + ".px-x{width:34px;height:34px;border-radius:50%;font-size:18px;line-height:1;color:var(--muted,#97a0b5);"
      + "border:1px solid var(--line,#262d44);background:var(--panel-2,#1b2033);flex:none}"
      + ".px-hero{border-radius:12px;padding:12px 14px;margin-bottom:10px;border:1px solid var(--line,#262d44);"
      + "background:var(--panel-2,#1b2033);text-align:center}"
      + ".px-hero.px-up{border-color:rgba(61,220,132,.35);background:var(--green-soft,rgba(61,220,132,.13))}"
      + ".px-hero.px-down{border-color:rgba(255,107,107,.35);background:var(--red-soft,rgba(255,107,107,.13))}"
      + ".px-val{font-size:26px;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.5px}"
      + ".px-hero.px-up .px-val{color:var(--green,#3ddc84)}.px-hero.px-down .px-val{color:var(--red,#ff6b6b)}"
      + ".px-lbl{font-size:11.5px;color:var(--muted,#97a0b5);letter-spacing:.4px;margin-top:2px}"
      + ".px-block{background:var(--panel-2,#1b2033);border:1px solid var(--line-soft,#1f2537);border-radius:12px;"
      + "padding:4px 12px;margin-bottom:10px}"
      + ".px-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;"
      + "border-top:1px solid var(--line-soft,#1f2537);font-size:13.5px}"
      + ".px-row:first-child{border-top:0}"
      + ".px-k{color:var(--muted,#97a0b5)}"
      + ".px-v{font-weight:650;font-variant-numeric:tabular-nums;text-align:right;color:var(--text,#eef1f8)}"
      + ".px-v.px-pos{color:var(--green,#3ddc84)}.px-v.px-neg{color:var(--red,#ff6b6b)}"
      + ".px-note{font-size:12px;color:var(--faint,#6a7288);padding:2px 0 8px;line-height:1.5}"
      + ".px-foot{display:flex;align-items:center;gap:10px;margin-top:12px}"
      + ".px-btn{min-height:42px;padding:8px 16px;border-radius:10px;font-size:13.5px;font-weight:650;"
      + "border:1px solid var(--line,#262d44);background:var(--panel-2,#1b2033);color:var(--text,#eef1f8)}"
      + ".px-btn.px-primary{flex:1;border-color:transparent;background:linear-gradient(180deg,#ffe062,var(--gold,#f5c518) 70%);"
      + "color:#221a00;font-weight:750}"
      + ".px-btn:active{transform:scale(.98)}"
      + "#px-saved{position:fixed;right:10px;bottom:calc(var(--nav-h,62px) + 10px + env(safe-area-inset-bottom,0px));"
      + "z-index:8000;pointer-events:none;font-size:11px;font-weight:650;letter-spacing:.3px;padding:5px 10px;"
      + "border-radius:999px;color:var(--muted,#97a0b5);background:rgba(20,24,38,.92);"
      + "border:1px solid var(--line-soft,#1f2537);opacity:1;transition:opacity .5s ease}"
      + "#px-saved.px-ghost{opacity:.34}"
      + "#px-saved.px-flash{color:var(--green,#3ddc84);border-color:rgba(61,220,132,.4)}"
      + "#px-tip{position:fixed;z-index:9400;max-width:280px;padding:10px 12px;border-radius:12px;"
      + "background:#1b2033;border:1px solid var(--line,#262d44);box-shadow:0 10px 30px rgba(0,0,0,.45);"
      + "font-size:12.5px;line-height:1.45;color:var(--text,#eef1f8)}"
      + "#px-tip .px-tip-k{display:block;font-weight:750;color:var(--gold,#f5c518);margin-bottom:3px;"
      + "letter-spacing:.4px;text-transform:uppercase;font-size:10.5px}"
      + "[data-gloss]{border-bottom:1px dotted rgba(245,197,24,.6);cursor:pointer}"
      + ".px-chartbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 8px}"
      + ".px-bar-lbl{font-size:10.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;"
      + "color:var(--faint,#6a7288);margin-right:2px}"
      + ".px-chip{min-height:30px;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:650;"
      + "color:var(--muted,#97a0b5);background:var(--panel-2,#1b2033);border:1px solid var(--line,#262d44)}"
      + ".px-chip.px-on{color:#221a00;background:var(--gold,#f5c518);border-color:transparent}"
      + ".bo-row.px-hidden{display:none}";
    var el = d.createElement("style");
    el.id = "px-style";
    el.appendChild(d.createTextNode(css));
    (d.head || d.getElementsByTagName("head")[0] || d.documentElement).appendChild(el);
  }

  /* ── 2. autosave indicator ──────────────────────────────────── */
  var savedTimer = null;

  function savedNode() {
    var d = doc();
    if (!d || !d.body) { return null; }
    var el = byId("px-saved");
    if (!el) {
      el = d.createElement("div");
      el.id = "px-saved";
      el.setAttribute("aria-live", "polite");
      d.body.appendChild(el);
    }
    return el;
  }

  function paintSaved(ts, flash) {
    var el = savedNode();
    if (!el) { return; }
    if (!ts) { el.textContent = ""; el.hidden = true; return; }
    el.hidden = false;
    el.textContent = "Saved · " + clockOf(ts);
    if (flash) {
      removeClass(el, "px-ghost");
      addClass(el, "px-flash");
      clearTimeout(savedTimer);
      savedTimer = setTimeout(function () {
        removeClass(el, "px-flash");
        addClass(el, "px-ghost");
      }, 2200);
    } else {
      addClass(el, "px-ghost");
    }
  }

  function lastSaved() {
    var raw = lsGet(K_SAVED_AT);
    var n = parseInt(raw, 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function markSaved() {
    var now = Date.now();
    lsSet(K_SAVED_AT, String(now));
    try { paintSaved(now, true); } catch (e) {}
  }

  function isSaveKey(k) {
    if (typeof k !== "string") { return false; }
    return k === SAVE_KEY || k.indexOf("bow2.slots") === 0;
  }

  function patchStorage() {
    if (STORAGE_PATCHED) { return; }
    STORAGE_PATCHED = true;

    /* Path A — wrap saveGame(), the documented write path in engine.js.
       This always sticks, so the indicator works even when Storage is locked down. */
    try {
      if (typeof w.saveGame === "function" && !w.saveGame.__pxWrapped) {
        var sg = w.saveGame;
        var nsg = function () {
          var r = sg.apply(this, arguments);
          try { markSaved(); } catch (e) {}
          return r;
        };
        nsg.__pxWrapped = true;
        nsg.__pxOrig = sg;
        w.saveGame = nsg;
      }
    } catch (e0) {}

    /* Path B — try to observe direct localStorage writes from other modules
       (slots.js writes "bow2.slots" straight to Storage). Assignment is silently
       ignored on some WebViews, so verify it took before trusting it. */
    var ls = null;
    try { ls = w.localStorage; } catch (e1) { ls = null; }
    if (ls && typeof ls.setItem === "function") {
      try {
        var origSet = ls.setItem;
        var wrappedSet = function (k, v) {
          var out = origSet.apply(ls, arguments);
          try { if (isSaveKey(k)) { markSaved(); } } catch (e) {}
          return out;
        };
        var proto = null;
        try { proto = Object.getPrototypeOf ? Object.getPrototypeOf(ls) : null; } catch (e2) { proto = null; }
        var installed = false;
        try {
          ls.setItem = wrappedSet;
          installed = (ls.setItem === wrappedSet && ls.setItem !== origSet);
        } catch (e3) { installed = false; }
        if (!installed && proto && typeof proto.setItem === "function") {
          try {
            proto.setItem = wrappedSet;
            installed = (ls.setItem === wrappedSet);
          } catch (e4) { installed = false; }
        }
        if (!installed) { POLL_NEEDED = true; }
      } catch (e5) { POLL_NEEDED = true; }
    } else {
      POLL_NEEDED = true;
    }

    /* Path C — cross-tab writes. */
    try {
      w.addEventListener("storage", function (ev) {
        try { if (ev && isSaveKey(ev.key)) { paintSaved(Date.now(), true); } } catch (e6) {}
      });
    } catch (e7) {}

    /* Path D — cheap poll as the last resort. Compares length first, so the
       expensive string compare only runs when the save actually changed. */
    if (POLL_NEEDED) { startSavePoll(); }
  }

  function startSavePoll() {
    if (POLLING) { return; }
    POLLING = true;
    var lastLen = -1;
    var lastRaw = null;
    var tick = function () {
      try {
        var d = doc();
        if (d && d.hidden) { return; }
        var raw = null;
        try { raw = w.localStorage.getItem(SAVE_KEY); } catch (e) { return; }
        if (raw == null) { return; }
        if (raw.length !== lastLen || raw !== lastRaw) {
          var first = lastRaw === null;
          lastLen = raw.length;
          lastRaw = raw;
          if (!first) { markSaved(); }
        }
      } catch (e2) {}
    };
    try { tick(); } catch (e3) {}
    try { w.setInterval(tick, 2000); } catch (e4) { POLLING = false; }
  }

  /* ── 3. week summary modal ──────────────────────────────────── */
  function summaryEnabled() {
    return lsGet(K_HIDE_SUMMARY) !== "1";
  }

  function setSummaryEnabled(on) {
    if (on) { try { w.localStorage.removeItem(K_HIDE_SUMMARY); } catch (e) { lsSet(K_HIDE_SUMMARY, "0"); } }
    else { lsSet(K_HIDE_SUMMARY, "1"); }
  }

  function snapshot() {
    var s = state();
    if (!s) { return null; }
    var out = {
      cash: num(s.studio.cash),
      week: num(s.studio.week),
      films: {}, proj: {}, inTheatres: 0, runIds: {}
    };
    var i, f, p, key;
    for (i = 0; i < (s.films || []).length; i++) {
      f = s.films[i];
      if (!f) { continue; }
      if (f.status === "run") { out.inTheatres++; }
      out.films[f.id] = 1;
      if (f.status === "run") { out.runIds[f.id] = 1; }
    }
    for (i = 0; i < (s.projects || []).length; i++) {
      p = s.projects[i];
      if (!p) { continue; }
      key = p.id;
      out.proj[key] = String(p.phase) + ":" + num(p.phaseWk);
    }
    return out;
  }

  function weeklyTx(s) {
    var tx = null;
    try {
      if (s.txHistory && s.txHistory.length && s.txHistory[0] && num(s.txHistory[0].w) === num(s.studio.week)) {
        tx = s.txHistory[0];
      }
    } catch (e) {}
    if (!tx && s.weekTx) { tx = s.weekTx; }
    return tx;
  }

  function reportAfter(before) {
    var s = state();
    if (!s || !before) { return; }
    var st = s.studio;
    var rep = {
      week: num(st.week), year: num(st.year),
      delta: num(st.cash) - before.cash,
      cash: num(st.cash),
      takenIn: 0, paidOut: 0,
      released: [], wrapped: [], inTheatres: 0, advanced: 0
    };
    var tx = weeklyTx(s);
    if (tx) {
      rep.takenIn = num(tx.in);
      rep.paidOut = num(tx.out);
    }
    var i, f, p;
    for (i = 0; i < (s.films || []).length; i++) {
      f = s.films[i];
      if (!f) { continue; }
      if (num(f.releaseWeek) === rep.week) { rep.released.push(f.title || "Untitled"); }
      if (f.status === "run") { rep.inTheatres++; }
    }
    for (i = 0; i < (s.projects || []).length; i++) {
      p = s.projects[i];
      if (!p || !before.proj[p.id]) { continue; }
      var sig = String(p.phase) + ":" + num(p.phaseWk);
      if (sig !== before.proj[p.id]) {
        rep.advanced++;
        if (p.phase === "ready") { rep.wrapped.push(p.title || "Untitled"); }
      }
    }
    return rep;
  }

  function summaryHTML(rep) {
    var up = rep.delta >= 0;
    var sign = up ? "+" : "−";
    var h = '<div class="px-sheet" role="dialog" aria-modal="true" aria-label="Week summary">';
    h += '<div class="px-sheet-head"><div>'
      + '<div class="px-eyebrow">' + escHTML("Year " + rep.year + " · Week " + rep.week) + '</div>'
      + '<div class="px-h3">Week summary</div>'
      + '</div><button class="px-x" data-px-close="1" aria-label="Close summary">×</button></div>';
    h += '<div class="px-hero ' + (up ? "px-up" : "px-down") + '">'
      + '<div class="px-val">' + sign + money(Math.abs(rep.delta)) + '</div>'
      + '<div class="px-lbl">' + escHTML(up ? "cash gained this week" : "cash lost this week") + '</div></div>';

    h += '<div class="px-block">';
    h += '<div class="px-row"><span class="px-k">Taken in</span><span class="px-v px-pos">+' + money(rep.takenIn) + '</span></div>';
    h += '<div class="px-row"><span class="px-k">Paid out</span><span class="px-v px-neg">−' + money(rep.paidOut) + '</span></div>';
    h += '<div class="px-row"><span class="px-k">Cash on hand</span><span class="px-v">' + money(rep.cash) + '</span></div>';
    h += '</div>';

    h += '<div class="px-block">';
    h += '<div class="px-row"><span class="px-k">Films released</span><span class="px-v">'
      + (rep.released.length ? escHTML(rep.released.slice(0, 2).join(", "))
        + (rep.released.length > 2 ? " +" + (rep.released.length - 2) : "") : "none") + '</span></div>';
    if (rep.wrapped.length) {
      h += '<div class="px-row"><span class="px-k">Wrapped post</span><span class="px-v">'
        + escHTML(rep.wrapped.slice(0, 2).join(", "))
        + (rep.wrapped.length > 2 ? " +" + (rep.wrapped.length - 2) : "") + '</span></div>';
    }
    h += '<div class="px-row"><span class="px-k">In theatres</span><span class="px-v">'
      + rep.inTheatres + (rep.inTheatres === 1 ? " film" : " films") + '</span></div>';
    h += '<div class="px-row"><span class="px-k">Projects advanced</span><span class="px-v">' + rep.advanced + '</span></div>';
    h += '</div>';

    if (!rep.released.length && !rep.advanced && rep.inTheatres === 0) {
      h += '<div class="px-note">A quiet week — no films on screens and nothing in production. '
        + 'Greenlight a script in Develop to get the slate moving.</div>';
    } else if (rep.delta < 0 && rep.inTheatres === 0) {
      h += '<div class="px-note">Burning cash with nothing in theatres. Schedule a release date for a finished film.</div>';
    }

    h += '<div class="px-foot">'
      + '<button class="px-btn" data-px-hide="1">Don\'t show again</button>'
      + '<button class="px-btn px-primary" data-px-close="1">Continue</button>'
      + '</div>';
    h += '</div>';
    return h;
  }

  function closeSummary() {
    var el = byId("px-summary");
    if (el && el.parentNode) { el.parentNode.removeChild(el); }
  }

  function showSummary(rep) {
    var d = doc();
    if (!d || !d.body || !rep) { return; }
    closeSummary();
    var wrap = d.createElement("div");
    wrap.id = "px-summary";
    wrap.innerHTML = summaryHTML(rep);
    wrap.setAttribute("data-px-backdrop", "1");
    d.body.appendChild(wrap);
  }

  function onSummaryClick(e) {
    var t = e.target;
    var closer = closestAttr(t, "data-px-close", null);
    if (closer) {
      e.preventDefault();
      closeSummary();
      return true;
    }
    var hider = closestAttr(t, "data-px-hide", null);
    if (hider) {
      e.preventDefault();
      setSummaryEnabled(false);
      closeSummary();
      return true;
    }
    var wrap = byId("px-summary");
    if (wrap && t === wrap) { closeSummary(); return true; }
    return false;
  }

  /* haptic on a real week advance */
  function buzz(ms) {
    try {
      if (lsGet(K_HAPTIC) !== "1") { return; }
      if (w.navigator && typeof w.navigator.vibrate === "function") {
        w.navigator.vibrate(ms || 10);
      }
    } catch (e) {}
  }

  function wrapAdvance() {
    if (typeof w.advanceWeek !== "function") { return; }
    if (w.advanceWeek.__pxWrapped) { return; }
    var orig = w.advanceWeek;
    var wrapped = function () {
      var before = null;
      try { before = snapshot(); } catch (e0) {}
      var out = orig.apply(this, arguments);
      try {
        var rep = reportAfter(before);
        if (rep) {
          buzz(10);
          var s = state();
          var blocked = !!(s && (s.pending || s.over));
          if (!blocked && summaryEnabled()) { showSummary(rep); }
        }
      } catch (e1) {}
      return out;
    };
    wrapped.__pxWrapped = true;
    wrapped.__pxOrig = orig;
    w.advanceWeek = wrapped;
  }

  /* ── 4. keyboard shortcut (Space / n = advance week) ───────── */
  function editableTarget(node) {
    var el = node;
    while (el && el !== doc().body) {
      if (el.nodeType === 1) {
        var tag = String(el.tagName || "").toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { return true; }
        if (el.isContentEditable) { return true; }
      }
      el = el.parentNode;
    }
    return false;
  }

  function sheetOpen() {
    var sw = byId("sheetWrap");
    return !!(sw && sw.hidden === false);
  }

  function doAdvance() {
    try {
      if (byId("px-summary")) { return; }
      if (typeof w.onAdvance === "function") { w.onAdvance(); return; }
      if (typeof w.advanceWeek === "function") {
        var flash = w.advanceWeek();
        if (flash && typeof w.drainFlash === "function") { w.drainFlash(); }
        if (typeof w.render === "function") { w.render(); }
      }
    } catch (e) {}
  }

  function onKeyDown(e) {
    try {
      if (!e || e.metaKey || e.ctrlKey || e.altKey) { return; }
      if (editableTarget(e.target)) { return; }
      if (sheetOpen()) { return; }
      if (byId("px-summary")) {
        if (e.key === "Escape" || e.keyCode === 27) { closeSummary(); }
        return;
      }
      var k = e.key;
      var isSpace = (k === " " || k === "Spacebar" || e.code === "Space" || e.keyCode === 32);
      var isN = (k === "n" || k === "N" || e.keyCode === 78 || e.keyCode === 110);
      if (!isSpace && !isN) { return; }
      var s = state();
      if (!s) { return; }
      if (w.VIEW === "start" || w.VIEW === "gameover") { return; }
      e.preventDefault();
      doAdvance();
    } catch (err) {}
  }

  /* ── 5. glossary tooltips ──────────────────────────────────── */
  var GLOSSARY = {
    "ww": { t: "WW", d: "Worldwide gross. Domestic box office plus every foreign territory, added together before the studio takes its share." },
    "worldwide": { t: "Worldwide", d: "See WW — the global theatrical total across all markets." },
    "opening weekend": { t: "Opening weekend", d: "The first Friday-to-Sunday take. It sets the ceiling: most films never beat it in a single weekend again." },
    "opening": { t: "Opening", d: "The first three days of wide release. Heavily driven by marketing spend, star power and how clear the weekend is." },
    "legs": { t: "Legs", d: "How long a film keeps selling after opening. Total domestic roughly equals opening multiplied by legs. Word of mouth decides it." },
    "decay": { t: "Decay", d: "The weekly drop-off factor. With legs of 2.4, each week keeps about 58% of the previous week. Longer legs mean a slower decay." },
    "p&a": { t: "P&A", d: "Prints and advertising — the marketing budget. Usually a share of the production budget and spent entirely before release." },
    "p and a": { t: "P&A", d: "Prints and advertising, the marketing spend that sells a film into theatres." },
    "pvod": { t: "PVOD", d: "Premium video on demand. Early home rental at a high price while the film is still in theatres — small revenue, big theatre risk." },
    "theatrical window": { t: "Theatrical window", d: "The exclusive stretch when a film plays only in cinemas. Shorten it and exhibitors punish you with fewer screens." },
    "window": { t: "Window", d: "See theatrical window — the exclusive cinema period before streaming or rental." },
    "breakeven": { t: "Breakeven", d: "The gross where revenue finally covers negative cost plus P&A. Studios keep roughly half of domestic and less abroad." },
    "break even": { t: "Breakeven", d: "The point where total revenue equals total cost — budget, marketing and overhead." },
    "domestic": { t: "Domestic", d: "The home market (US/Canada). The studio keeps a larger share here than overseas." },
    "gross": { t: "Gross", d: "Total ticket sales. The studio only receives a rental share of it — not the whole number." },
    "holdover": { t: "Holdover", d: "A film still playing from an earlier weekend, competing for the same screens as new openers." },
    "four-quadrant": { t: "Four-quadrant", d: "A film that appeals to men and women, over and under 25 — the widest possible audience." }
  };

  function glossKey(term) {
    return String(term == null ? "" : term).replace(/\s+/g, " ").replace(/^ | $/g, "").toLowerCase();
  }

  function glossDefine(term) {
    var row = GLOSSARY[glossKey(term)];
    if (!row) {
      var k = glossKey(term);
      if (k === "p&a" || k === "pa" || k === "p and a") { row = GLOSSARY["p&a"]; }
    }
    if (!row) { return null; }
    return row.d;
  }

  function tipEl() {
    var d = doc();
    if (!d || !d.body) { return null; }
    var el = byId("px-tip");
    if (!el) {
      el = d.createElement("div");
      el.id = "px-tip";
      el.setAttribute("role", "tooltip");
      el.hidden = true;
      d.body.appendChild(el);
    }
    return el;
  }

  function hideTip() {
    var el = byId("px-tip");
    if (el) { el.hidden = true; el.innerHTML = ""; }
  }

  function showTipFor(node, term) {
    var row = GLOSSARY[glossKey(term)];
    if (!row) {
      var def = glossDefine(term);
      if (!def) { return; }
      row = { t: String(term), d: def };
    }
    var tip = tipEl();
    if (!tip) { return; }
    tip.innerHTML = '<span class="px-tip-k">' + escHTML(row.t) + "</span>" + escHTML(row.d);
    tip.hidden = false;
    var r = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    var vw = w.innerWidth || 360;
    var vh = w.innerHeight || 640;
    var tw = Math.min(280, vw - 24);
    tip.style.maxWidth = tw + "px";
    var th = tip.offsetHeight || 70;
    if (!r) { tip.style.left = "12px"; tip.style.top = "80px"; return; }
    var left = r.left + r.width / 2 - tw / 2;
    if (left < 12) { left = 12; }
    if (left + tw > vw - 12) { left = vw - 12 - tw; }
    var top = r.top - th - 10;
    if (top < 12) { top = r.bottom + 10; }
    if (top + th > vh - 12) { top = Math.max(12, vh - 12 - th); }
    tip.style.left = Math.round(left) + "px";
    tip.style.top = Math.round(top) + "px";
  }

  function attachAll() {
    var d = doc();
    if (!d) { return 0; }
    var nodes = d.querySelectorAll("[data-gloss]");
    var i, n, term, count = 0;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      term = n.getAttribute("data-gloss");
      if (!term) { continue; }
      addClass(n, "px-gloss");
      if (!n.getAttribute("tabindex")) { n.setAttribute("tabindex", "0"); }
      if (!n.getAttribute("aria-label")) {
        n.setAttribute("aria-label", String(term) + " — tap for definition");
      }
      count++;
    }
    return count;
  }

  function onGlossClick(e) {
    var node = closestAttr(e.target, "data-gloss", null);
    if (!node) {
      if (byId("px-tip") && !byId("px-tip").hidden) { hideTip(); }
      return false;
    }
    /* a modal swallows taps — but a gloss tag inside the modal still works */
    var wrap = byId("px-summary");
    if (wrap && !closestAttrIn(e.target, wrap)) { return false; }
    e.preventDefault();
    e.stopPropagation();
    var existing = byId("px-tip");
    var term = node.getAttribute("data-gloss");
    if (existing && !existing.hidden && existing.__pxFor === term) { hideTip(); return true; }
    var tip = tipEl();
    if (tip) { tip.__pxFor = term; }
    showTipFor(node, term);
    return true;
  }

  /* ── 6. Playing-chart sort / filter ────────────────────────── */
  function parseMoney(txt) {
    var s = String(txt || "").replace(/[$,\s]/g, "");
    if (!s) { return 0; }
    var neg = s.charAt(0) === "-";
    if (neg || s.charAt(0) === "+") { s = s.slice(1); }
    var mult = 1;
    var last = s.charAt(s.length - 1).toUpperCase();
    if (last === "B") { mult = 1000; s = s.slice(0, -1); }
    else if (last === "M") { mult = 1; s = s.slice(0, -1); }
    else if (last === "K") { mult = 0.001; s = s.slice(0, -1); }
    var n = parseFloat(s);
    if (!isFinite(n)) { n = 0; }
    n = n * mult;
    return neg ? -n : n;
  }

  function chartRows(container) {
    var raw = container.querySelectorAll(".bo-row");
    return toArray(raw);
  }

  function ensureRowData(row) {
    if (!row || row.getAttribute("data-px-ready") === "1") { return; }
    var titleEl = row.querySelector ? row.querySelector(".bo-line b") : null;
    var valEl = row.querySelector ? row.querySelector(".bo-val b") : null;
    var rankEl = row.querySelector ? row.querySelector(".bo-rank") : null;
    var title = titleEl ? String(titleEl.textContent || "") : "";
    var gross = valEl ? parseMoney(valEl.textContent) : 0;
    var rank = rankEl ? parseInt(String(rankEl.textContent || "0"), 10) : 0;
    if (!isFinite(rank)) { rank = 0; }
    row.setAttribute("data-bo-title", title);
    row.setAttribute("data-bo-gross", String(gross));
    row.setAttribute("data-bo-rank", String(rank));
    row.setAttribute("data-bo-mine", hasClass(row, "mine") ? "1" : "0");
    row.setAttribute("data-px-ready", "1");
    if (!row.getAttribute("data-bo-index")) {
      row.setAttribute("data-bo-index", String(rank || 0));
    }
  }

  function rowInfo(row) {
    ensureRowData(row);
    return {
      el: row,
      title: row.getAttribute("data-bo-title") || "",
      gross: num(row.getAttribute("data-bo-gross")),
      rank: num(row.getAttribute("data-bo-rank")),
      mine: row.getAttribute("data-bo-mine") === "1"
    };
  }

  function sortRows(container, key, dir) {
    var rows = chartRows(container);
    if (!rows.length) { return 0; }
    var i;
    for (i = 0; i < rows.length; i++) { ensureRowData(rows[i]); }
    var desc = String(dir || "").toLowerCase() !== "asc";
    rows.sort(function (a, b) {
      var ka, kb;
      if (key === "title") {
        ka = String(a.getAttribute("data-bo-title") || "").toLowerCase();
        kb = String(b.getAttribute("data-bo-title") || "").toLowerCase();
        return desc ? (ka < kb ? 1 : ka > kb ? -1 : 0) : (ka < kb ? -1 : ka > kb ? 1 : 0);
      }
      ka = num(a.getAttribute("data-bo-gross"));
      kb = num(b.getAttribute("data-bo-gross"));
      if (key === "rank") {
        ka = num(a.getAttribute("data-bo-rank"), 99);
        kb = num(b.getAttribute("data-bo-rank"), 99);
        return desc ? kb - ka : ka - kb;
      }
      return desc ? kb - ka : ka - kb;
    });
    /* appendChild moves existing nodes, so this reorders in place
       without touching the row markup the chart already rendered. */
    for (i = 0; i < rows.length; i++) { container.appendChild(rows[i]); }
    return rows.length;
  }

  function clearSortMarks() {
    var d = doc();
    if (!d) { return; }
    var chips = d.querySelectorAll(".px-chartbar .px-chip");
    var i;
    for (i = 0; i < chips.length; i++) { removeClass(chips[i], "px-on"); }
  }

  function markChip(key, dir) {
    var d = doc();
    if (!d) { return; }
    var want = String(dir || "").toLowerCase() === "asc" ? "asc" : "desc";
    var chips = d.querySelectorAll(".px-chartbar .px-chip");
    var i;
    for (i = 0; i < chips.length; i++) {
      if (chips[i].getAttribute("data-px-sort") === key) {
        addClass(chips[i], "px-on");
        /* keep the chip's next-click direction in sync with the real sort */
        if (key !== "rank") { chips[i].setAttribute("data-px-dir", want); }
      }
    }
  }

  function chartSort(key, dir) {
    var containers = chartContainers();
    var i, n = 0;
    for (i = 0; i < containers.length; i++) {
      ensureChartBar(containers[i]);
      n += sortRows(containers[i], key, dir);
    }
    try { clearSortMarks(); markChip(key, dir); } catch (e) {}
    return n;
  }

  function chartFilter(fn) {
    var containers = chartContainers();
    var i, j, rows, keep, info;
    for (i = 0; i < containers.length; i++) {
      ensureChartBar(containers[i]);
      rows = chartRows(containers[i]);
      for (j = 0; j < rows.length; j++) {
        ensureRowData(rows[j]);
        if (!fn) { keep = true; }
        else if (typeof fn === "function") {
          info = rowInfo(rows[j]);
          try { keep = !!fn(info); } catch (e) { keep = true; }
        } else {
          keep = String(rows[j].getAttribute("data-bo-title") || "")
            .toLowerCase().indexOf(String(fn).toLowerCase()) >= 0;
        }
        if (keep) { removeClass(rows[j], "px-hidden"); }
        else { addClass(rows[j], "px-hidden"); }
      }
    }
    return true;
  }

  function chartContainers() {
    var d = doc();
    if (!d) { return []; }
    var view = byId("view");
    var scope = view || d;
    return toArray(scope.querySelectorAll(".bo-chart"));
  }

  function ensureChartBar(container) {
    var d = doc();
    if (!d || !container || !container.parentNode) { return; }
    var prev = container.previousElementSibling;
    if (prev && hasClass(prev, "px-chartbar")) { return; }
    var bar = d.createElement("div");
    bar.className = "px-chartbar";
    bar.innerHTML = '<span class="px-bar-lbl">Sort</span>'
      + '<button class="px-chip" data-px-sort="rank" data-px-dir="asc">Chart</button>'
      + '<button class="px-chip" data-px-sort="gross" data-px-dir="desc">Gross</button>'
      + '<button class="px-chip" data-px-sort="title" data-px-dir="asc">A–Z</button>'
      + '<button class="px-chip" data-px-sort="reset">Reset</button>';
    container.parentNode.insertBefore(bar, container);
  }

  function enhanceCharts() {
    var containers = chartContainers();
    var i, rows, j;
    for (i = 0; i < containers.length; i++) {
      rows = chartRows(containers[i]);
      for (j = 0; j < rows.length; j++) { ensureRowData(rows[j]); }
      ensureChartBar(containers[i]);
    }
  }

  function onChartBarClick(e) {
    var btn = closestAttr(e.target, "data-px-sort", null);
    if (!btn) { return false; }
    if (!hasClass(btn.parentNode, "px-chartbar")) { return false; }
    e.preventDefault();
    e.stopPropagation();
    var key = btn.getAttribute("data-px-sort");
    if (key === "reset") {
      chartFilter(null);
      chartSort("rank", "asc");
      clearSortMarks();
      return true;
    }
    var cur = btn.getAttribute("data-px-dir") || "desc";
    var next = cur === "desc" ? "asc" : "desc";
    btn.setAttribute("data-px-dir", next);
    chartSort(key, next);
    return true;
  }

  function wireChart() {
    if (OBSERVING) { return; }
    var d = doc();
    var view = byId("view");
    if (!d || !view) { return; }
    if (typeof w.MutationObserver === "function") {
      try {
        var obs = new w.MutationObserver(function () {
          if (BUSY) { return; }
          scheduleEnhance();
        });
        obs.observe(view, { childList: true, subtree: true });
        OBSERVING = true;
      } catch (e) {}
    }
    scheduleEnhance();
  }

  function scheduleEnhance() {
    clearTimeout(ENH_TIMER);
    ENH_TIMER = setTimeout(function () {
      BUSY = true;
      try { enhanceCharts(); } catch (e) {} finally { BUSY = false; }
    }, 40);
  }

  /* ── 7. empty-state helper ─────────────────────────────────── */
  function emptyHTML(icon, title, body) {
    var h = '<div class="card empty">';
    if (icon) { h += '<span class="em">' + escHTML(icon) + "</span>"; }
    if (title) { h += '<div style="font-weight:700;color:var(--text);margin-bottom:4px">' + escHTML(title) + "</div>"; }
    if (body) { h += "<div>" + escHTML(body) + "</div>"; }
    return h + "</div>";
  }

  /* ── 8. crash log (ring buffer, last 20) ───────────────────── */
  var CRASH = [];
  var CRASH_MAX = 20;

  function crashLoad() {
    var raw = lsGet(K_CRASH);
    if (!raw) { return; }
    try {
      var arr = JSON.parse(raw);
      if (arr && arr.length) { CRASH = arr.slice(0, CRASH_MAX); }
    } catch (e) {}
  }

  function crashPersist() {
    try { lsSet(K_CRASH, JSON.stringify(CRASH)); } catch (e) {}
  }

  function pushCrash(type, msg, src, line, col, stack) {
    var entry = {
      t: stampOf(Date.now()),
      type: String(type || "error"),
      msg: String(msg == null ? "" : msg).slice(0, 400),
      src: String(src == null ? "" : src).slice(0, 200),
      line: num(line, 0),
      col: num(col, 0),
      stack: String(stack == null ? "" : stack).slice(0, 600)
    };
    CRASH.unshift(entry);
    if (CRASH.length > CRASH_MAX) { CRASH.length = CRASH_MAX; }
    crashPersist();
    return entry;
  }

  function installCrash() {
    if (CRASH_INSTALLED) { return; }
    CRASH_INSTALLED = true;
    crashLoad();
    try {
      var prev = w.onerror;
      w.onerror = function (msg, src, line, col, err) {
        try {
          pushCrash("error", msg, src, line, col, err && err.stack ? err.stack : "");
        } catch (e) {}
        if (typeof prev === "function") {
          try { return prev.apply(this, arguments); } catch (e2) {}
        }
        return false;
      };
    } catch (e3) {}
    try {
      w.addEventListener("unhandledrejection", function (ev) {
        try {
          var r = ev ? ev.reason : null;
          var m = r && r.message ? r.message : String(r == null ? "unhandled rejection" : r);
          pushCrash("rejection", m, "", 0, 0, r && r.stack ? r.stack : "");
        } catch (e4) {}
      });
    } catch (e5) {}
  }

  function crashAll() { return CRASH.slice(0); }

  function crashExport() {
    var lines = [];
    lines.push("Box Office War — crash log");
    lines.push("Generated: " + stampOf(Date.now()));
    lines.push("Build: " + (function () {
      try {
        var m = doc().querySelector('meta[name="app-version"]');
        return m ? m.getAttribute("content") : "unknown";
      } catch (e) { return "unknown"; }
    })());
    lines.push("Entries: " + CRASH.length + " of last " + CRASH_MAX);
    lines.push("");
    if (!CRASH.length) {
      lines.push("No errors recorded. Clean run.");
    } else {
      var i, e;
      for (i = 0; i < CRASH.length; i++) {
        e = CRASH[i];
        lines.push("[" + (i + 1) + "] " + e.t + " · " + e.type);
        lines.push("    " + e.msg);
        if (e.src) {
          lines.push("    at " + e.src + (e.line ? ":" + e.line : "") + (e.col ? ":" + e.col : ""));
        }
        if (e.stack) {
          var st = String(e.stack).split("\n");
          var j;
          for (j = 0; j < st.length && j < 6; j++) { lines.push("    " + st[j]); }
        }
        lines.push("");
      }
    }
    return lines.join("\n");
  }

  function crashClear() {
    CRASH = [];
    try { w.localStorage.removeItem(K_CRASH); } catch (e) { lsSet(K_CRASH, "[]"); }
    return true;
  }

  /* ── 9. save export / import (real keys) ───────────────────── */
  function readSaveRaw() {
    var raw = null;
    try { raw = w.localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      var s = state();
      if (s) {
        try { raw = JSON.stringify(s); } catch (e2) { raw = null; }
      }
    }
    return raw;
  }

  function exportCurrent() {
    var raw = readSaveRaw();
    if (!raw) { return ""; }
    return raw;
  }

  function importText(str) {
    var txt = String(str == null ? "" : str).replace(/^\s+|\s+$/g, "");
    if (!txt) { return { err: "Nothing to import — the text is empty." }; }
    var parsed = null;
    try { parsed = JSON.parse(txt); } catch (e) { return { err: "That text isn't valid save data." }; }
    if (!parsed || parsed.v !== 1 || !parsed.studio || !parsed.studio.name) {
      return { err: "That isn't a Box Office War save (expected version 1 with a studio)." };
    }
    try {
      w.localStorage.setItem(SAVE_KEY, txt);
    } catch (e2) {
      /* private mode: keep the parsed object in memory anyway */
    }
    w.S = parsed;
    try { if ("lastCash" in w) { w.lastCash = null; } } catch (e3) {}
    try {
      if (typeof w.render === "function") {
        var over = !!parsed.over;
        if ("VIEW" in w) { w.VIEW = over ? "gameover" : "studio"; }
        w.render();
      }
    } catch (e4) {}
    try {
      if (typeof w.pushToast === "function") {
        w.pushToast("Save imported — welcome back, " + parsed.studio.name + ".", "good");
      }
    } catch (e5) {}
    return { ok: true, studio: parsed.studio.name, week: parsed.studio.week };
  }

  /* ── 10. wire-up ───────────────────────────────────────────── */
  function wireGlossary() {
    var d = doc();
    if (!d) { return; }
    d.addEventListener("click", function (e) {
      try { onGlossClick(e); } catch (err) {}
    }, false);
    d.addEventListener("keydown", function (e) {
      try {
        if (!e || (e.key !== "Enter" && e.key !== " " && e.keyCode !== 13 && e.keyCode !== 32)) { return; }
        var node = closestAttr(e.target, "data-gloss", null);
        if (!node) { return; }
        e.preventDefault();
        var tip = tipEl();
        if (tip) { tip.__pxFor = node.getAttribute("data-gloss"); }
        showTipFor(node, node.getAttribute("data-gloss"));
      } catch (err) {}
    }, false);
    var count = attachAll();
    return count;
  }

  function wireSummaryClicks() {
    var d = doc();
    if (!d) { return; }
    d.addEventListener("click", function (e) {
      try { onSummaryClick(e); } catch (err) {}
    }, false);
  }

  function wireChartClicks() {
    var d = doc();
    if (!d) { return; }
    d.addEventListener("click", function (e) {
      try { onChartBarClick(e); } catch (err) {}
    }, false);
    d.addEventListener("scroll", hideTip, true);
  }

  function init() {
    if (INIT_DONE) { return; }
    INIT_DONE = true;
    try { installStyles(); } catch (e0) {}
    try { installCrash(); } catch (e1) {}
    try { wrapAdvance(); } catch (e2) {}
    try { patchStorage(); } catch (e3) {}
    try { wireSummaryClicks(); } catch (e4) {}
    try { wireChartClicks(); } catch (e5) {}
    try { wireKeyboard(); } catch (e6) {}
    try { wireGlossary(); } catch (e7) {}
    try { wireChart(); } catch (e8) {}
    try {
      var ts = lastSaved();
      if (ts) { paintSaved(ts, false); }
    } catch (e9) {}
  }

  function wireKeyboard() {
    var d = doc();
    if (!d) { return; }
    d.addEventListener("keydown", onKeyDown, false);
  }

  /* ── public API ────────────────────────────────────────────── */
  w.BowWeekSummary = {
    enabled: function () { return summaryEnabled(); },
    setEnabled: function (on) { setSummaryEnabled(!!on); return summaryEnabled(); },
    show: function () {
      var before = snapshot();
      var s = state();
      if (!s || !before) { return false; }
      var tx = weeklyTx(s);
      var rep = {
        week: num(s.studio.week), year: num(s.studio.year), delta: 0,
        cash: num(s.studio.cash), takenIn: tx ? num(tx.in) : 0,
        paidOut: tx ? num(tx.out) : 0, released: [], wrapped: [],
        inTheatres: 0, advanced: 0
      };
      var i, f;
      for (i = 0; i < (s.films || []).length; i++) {
        f = s.films[i];
        if (f && f.status === "run") { rep.inTheatres++; }
        if (f && num(f.releaseWeek) === rep.week) { rep.released.push(f.title || "Untitled"); }
      }
      showSummary(rep);
      return true;
    }
  };

  w.BowGlossary = {
    define: function (term) { return glossDefine(term); },
    attachAll: function () { return attachAll(); }
  };

  w.BowChartControls = {
    sort: function (key, dir) { return chartSort(String(key || "gross"), dir || "desc"); },
    filter: function (fn) { return chartFilter(fn); },
    reset: function () { chartFilter(null); return chartSort("rank", "asc"); }
  };

  w.BowEmptyState = {
    html: function (icon, title, body) { return emptyHTML(icon, title, body); }
  };

  w.BowCrashLog = {
    all: function () { return crashAll(); },
    export: function () { return crashExport(); },
    clear: function () { return crashClear(); },
    push: function (msg) { return pushCrash("manual", msg, "", 0, 0, ""); }
  };

  function repairCurrent() {
    var raw = readSaveRaw();
    if (!raw) { return { err: "No save to repair." }; }
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { return { err: "Save is not valid JSON." }; }
    if (!parsed || parsed.v !== 1 || !parsed.studio || !parsed.studio.name) {
      return { err: "Save structure is invalid." };
    }
    try { w.localStorage.setItem(SAVE_KEY, JSON.stringify(parsed)); } catch (e2) {}
    w.S = parsed;
    try { if (typeof w.render === "function") w.render(); } catch (e3) {}
    return { ok: true, studio: parsed.studio.name };
  }
  w.BowSaveIO = {
    exportCurrent: function () { return exportCurrent(); },
    importText: function (str) { return importText(str); },
    repairCurrent: function () { return repairCurrent(); }
  };

  w.BowHaptics = {
    enabled: function () { return lsGet(K_HAPTIC) === "1"; },
    set: function (on) { lsSet(K_HAPTIC, on ? "1" : "0"); return lsGet(K_HAPTIC) === "1"; },
    buzz: function (ms) {
      try {
        if (w.navigator && typeof w.navigator.vibrate === "function") { w.navigator.vibrate(ms || 10); }
      } catch (e) {}
      return true;
    }
  };

  w.BowSaved = {
    mark: function () { markSaved(); },
    last: function () { return lastSaved(); }
  };

  w.PhoneUX = {
    init: init,
    version: VERSION
  };

  /* crash capture starts immediately so early errors are kept */
  try { installCrash(); } catch (eEarly) {}

  /* boot: after every other script has parsed */
  try {
    if (w.document && w.document.readyState === "loading") {
      w.document.addEventListener("DOMContentLoaded", init, false);
      /* late safety net: ui.js boot() runs at parse time, DOMContentLoaded after it */
      w.addEventListener("load", init, false);
    } else {
      init();
    }
  } catch (eBoot) {}
})(typeof window !== "undefined" ? window : null);
