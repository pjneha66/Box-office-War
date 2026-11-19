/* ═══════════════════════════════════════════════════════════════════════════
   Box Office War — MOBILE SHELL
   ---------------------------------------------------------------------------
   Additive portrait-phone chrome for the single-page UI.

   HARD RULES OBSERVED HERE
     • ES5 only (var / function / no arrow, no template literals, no let/const,
       no optional chaining) — the game ships to old Android WebViews.
     • No modules, no build step, no dependencies. Plain browser script.
     • Purely additive: reads the DOM, adds classes/attributes/handlers and two
       new elements it owns outright (#bowBar, #bowPrefs). It NEVER re-renders,
       replaces or mutates the game's own UI markup.
     • Fully idempotent: loading this file twice is a no-op the second time, and
       calling apply() any number of times cannot duplicate the bottom bar.

   WHY CLONES AND NOT NEW MARKUP
     The four main tabs are <button data-view="…"> elements inside #tabbar and
     the advance-week action is #btnWeek. We clone those exact nodes so the bar
     can never drift from the real navigation, and we strip `data-action` from
     the clones so the game's delegated document click handler does not fire
     twice (once for the clone, once for the forwarded click).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── Already initialised? Bail out entirely (idempotency, rule 8). ─────── */
  if (window.BowMobileShell && window.BowMobileShell.__bowMobileShell) {
    return;
  }

  /* ── Storage keys (namespaced) ────────────────────────────────────────── */
  var KEY_COMPACT = "bow.ui.compact";
  var KEY_FONT = "bow.ui.fontScale";
  var KEY_THEME = "bow.ui.theme";
  var KEY_CONTRAST = "bow.ui.contrast";
  var KEY_MOTION = "bow.ui.motion";

  var FONT_MIN = 0.85;
  var FONT_MAX = 1.2;
  var FONT_DEFAULT = 1;

  /* Element ids this script owns. */
  var BAR_ID = "bowBar";
  var FAB_ID = "bowFab";
  var PREFS_ID = "bowPrefs";

  /* ── Tiny helpers ─────────────────────────────────────────────────────── */
  function $(sel, root) {
    try {
      return (root || document).querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  function $all(sel, root) {
    try {
      var list = (root || document).querySelectorAll(sel);
      var out = [];
      for (var i = 0; i < list.length; i++) out.push(list[i]);
      return out;
    } catch (e) {
      return [];
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function readStr(key, dflt) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null || v === undefined ? dflt : String(v);
    } catch (e) {
      return dflt;
    }
  }

  function writeStr(key, val) {
    try {
      window.localStorage.setItem(key, String(val));
    } catch (e) {
      /* private mode / quota — preferences simply do not persist */
    }
  }

  function readBool(key, dflt) {
    var v = readStr(key, null);
    if (v === null) return dflt;
    return v === "1" || v === "true";
  }

  function clampFont(n) {
    n = parseFloat(n);
    if (!isFinite(n)) n = FONT_DEFAULT;
    if (n < FONT_MIN) n = FONT_MIN;
    if (n > FONT_MAX) n = FONT_MAX;
    /* One decimal place keeps the reported value stable. */
    return Math.round(n * 100) / 100;
  }

  function prefersReducedMotion() {
    try {
      return !!(
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function prefersDark() {
    try {
      return !!(
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (e) {
      return true; /* dark is the house default */
    }
  }

  /* ── Phone viewport detection (rule B1) ───────────────────────────────── */
  function isPhoneViewport() {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 820px)").matches) {
        return true;
      }
    } catch (e) {}
    /* Coarse pointer on a narrow-ish window is also a phone. */
    try {
      if (
        window.matchMedia &&
        window.matchMedia("(pointer: coarse)").matches &&
        window.innerWidth <= 1024
      ) {
        return true;
      }
    } catch (e) {}
    return window.innerWidth <= 820;
  }

  /* ── State (persisted, with sane fallbacks) ───────────────────────────── */
  var state = {
    compact: false,
    fontScale: FONT_DEFAULT,
    theme: "dark", /* "dark" | "light" | "system" */
    contrast: "normal", /* "normal" | "high" */
    motion: "system" /* "system" | "reduced" */
  };

  function loadState() {
    state.compact = readBool(KEY_COMPACT, false);
    state.fontScale = clampFont(readStr(KEY_FONT, FONT_DEFAULT));

    var th = readStr(KEY_THEME, "");
    if (th !== "dark" && th !== "light" && th !== "system") {
      /* Seed from the game's legacy preference so we do not stomp on it. */
      th = "dark";
      try {
        var raw = window.localStorage.getItem("bow2.prefs");
        if (raw) {
          var legacy = JSON.parse(raw);
          if (legacy && (legacy.theme === "light" || legacy.theme === "contrast")) {
            th = legacy.theme === "light" ? "light" : "dark";
            if (legacy.theme === "contrast") state.contrast = "high";
          }
          if (legacy && legacy.font) {
            state.fontScale = clampFont(parseFloat(legacy.font) / 100);
          }
        }
      } catch (e) {}
    }
    state.theme = th;

    var ct = readStr(KEY_CONTRAST, "");
    if (ct === "high" || ct === "normal") state.contrast = ct;

    var mo = readStr(KEY_MOTION, "");
    if (mo === "reduced" || mo === "system") state.motion = mo;
  }

  /* ── Applying state to the document ───────────────────────────────────── */

  function applyFontScale() {
    var v = String(state.fontScale);
    var root = document.documentElement;
    try {
      root.style.setProperty("--bow-font-scale", v);
    } catch (e) {}
    try {
      document.body.style.setProperty("--bow-font-scale", v);
    } catch (e) {}
  }

  function resolveTheme() {
    if (state.theme === "system") return prefersDark() ? "dark" : "light";
    return state.theme;
  }

  function applyTheme() {
    var root = document.documentElement;
    var body = document.body;
    var resolved = resolveTheme();

    /* html[data-theme] is the attribute the shell CSS keys on. "system" leaves
       it off entirely so an OS change is picked up live. */
    if (state.theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", state.theme);
    }

    if (body) {
      if (body.classList) {
        body.classList.toggle("bow-theme-light", resolved === "light");
        body.classList.toggle("bow-theme-dark", resolved !== "light");
      }
    }
  }

  function applyContrast() {
    var root = document.documentElement;
    var body = document.body;
    var high = state.contrast === "high";
    if (high) root.setAttribute("data-contrast", "high");
    else root.removeAttribute("data-contrast");
    if (body && body.classList) {
      body.classList.toggle("bow-contrast-high", high);
    }
  }

  function applyMotion() {
    var root = document.documentElement;
    var body = document.body;
    var reduced = state.motion === "reduced" || prefersReducedMotion();
    if (reduced) root.setAttribute("data-motion", "reduced");
    else root.removeAttribute("data-motion");
    if (body && body.classList) {
      body.classList.toggle("bow-motion-reduced", reduced);
    }
  }

  function applyCompact() {
    var body = document.body;
    if (body && body.classList) {
      body.classList.toggle("bow-compact", !!state.compact);
    }
  }

  function applyChrome() {
    if (!document.body) return;
    if (isPhoneViewport()) {
      document.body.classList.add("bow-mobile");
    } else {
      document.body.classList.remove("bow-mobile");
    }
  }

  /* ── Bottom tab bar (rule B2) ─────────────────────────────────────────── */

  var refs = {
    sourceNav: null,
    weekBtn: null,
    bar: null,
    fab: null,
    prefs: null,
    pairs: [], /* { src: <original tab>, clone: <bar tab> } */
    observer: null
  };

  /* Strip anything that would make the game's own delegates act on the clone,
     so a tap can only ever be handled once. */
  function sanitiseClone(node) {
    if (!node || !node.getAttribute) return;
    node.removeAttribute("data-action");
    node.removeAttribute("id");
    if (node.removeAttribute) {
      node.removeAttribute("aria-controls");
      node.removeAttribute("aria-selected");
    }
  }

  function sanitiseSubtree(node) {
    sanitiseClone(node);
    var kids = node.getElementsByTagName ? node.getElementsByTagName("*") : [];
    for (var i = 0; i < kids.length; i++) sanitiseClone(kids[i]);
  }

  function getSourceNav() {
    return byId("tabbar");
  }

  function getSourceTabs() {
    var nav = refs.sourceNav || getSourceNav();
    if (!nav) return [];
    /* The four main tabs are exactly the [data-view] buttons inside #tabbar. */
    return $all("[data-view]", nav);
  }

  function buildBar() {
    var nav = getSourceNav();
    if (!nav) return null; /* markup not ready / different build */

    var existing = byId(BAR_ID);
    if (existing) return existing;

    var bar = document.createElement("nav");
    bar.id = BAR_ID;
    bar.className = "bow-bar";
    bar.setAttribute("aria-label", "Main navigation");
    bar.setAttribute("role", "navigation");

    var tabs = getSourceTabs();
    refs.pairs = [];

    for (var i = 0; i < tabs.length; i++) {
      (function (src) {
        var clone = src.cloneNode(true);
        sanitiseSubtree(clone);
        clone.className = src.className + " bow-tab";

        /* Forward the tap to the real button: one code path, same behaviour. */
        clone.addEventListener("click", function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          if (ev && ev.stopPropagation) ev.stopPropagation();
          if (src && typeof src.click === "function") src.click();
          syncChrome();
        });

        bar.appendChild(clone);
        refs.pairs.push({ src: src, clone: clone });
      })(tabs[i]);
    }

    /* Shell-owned display-settings affordance, lives in the bar's last cell. */
    var prefsBtn = document.createElement("button");
    prefsBtn.type = "button";
    prefsBtn.className = "bow-bar-prefs";
    prefsBtn.setAttribute("aria-label", "Display settings");
    prefsBtn.setAttribute("title", "Display settings");
    prefsBtn.appendChild(document.createTextNode("Aa"));
    prefsBtn.addEventListener("click", function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopPropagation) ev.stopPropagation();
      togglePrefs();
    });
    bar.appendChild(prefsBtn);

    /* Keep the original nav in the DOM (its #btnWeek stays wired) but out of
       the visual flow; the CSS class does the hiding. */
    nav.className = (nav.className || "") + " bow-src-hidden";

    var app = byId("app");
    if (app && app.appendChild) app.appendChild(bar);
    else document.body.appendChild(bar);

    refs.bar = bar;
    return bar;
  }

  /* ── Advance-week FAB (rule B3) ───────────────────────────────────────── */

  function buildFab() {
    var src = byId("btnWeek");
    if (!src) return null;

    var existing = byId(FAB_ID);
    if (existing) {
      /* Re-apply after a viewport change: keep the refs, never duplicate. */
      refs.weekBtn = src;
      refs.fab = existing;
      return existing;
    }

    var fab = src.cloneNode(true);
    sanitiseSubtree(fab);
    fab.id = FAB_ID;
    fab.className = "bow-fab";
    fab.setAttribute("aria-label", src.getAttribute("aria-label") || "Advance one week");

    fab.addEventListener("click", function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (src.disabled) return;
      if (typeof src.click === "function") src.click();
      syncChrome();
    });

    var app = byId("app");
    if (app && app.appendChild) app.appendChild(fab);
    else document.body.appendChild(fab);

    refs.weekBtn = src;
    refs.fab = fab;
    return fab;
  }

  /* ── Syncing bar/FAB against the real UI (rule B2) ────────────────────── */

  function syncChrome() {
    var nav = refs.sourceNav || getSourceNav();
    if (!nav) return;
    refs.sourceNav = nav;

    var shown = !nav.hidden && nav.style.display !== "none";

    /* Tabs: mirror class (so `.on` travels), label text and aria state. */
    for (var i = 0; i < refs.pairs.length; i++) {
      var pair = refs.pairs[i];
      var srcTab = pair.src;
      var clone = pair.clone;
      if (!srcTab || !clone) continue;

      clone.className = (srcTab.className || "") + " bow-tab";

      var srcSpan = srcTab.querySelector ? srcTab.querySelector("span") : null;
      var cloneSpan = clone.querySelector ? clone.querySelector("span") : null;
      if (srcSpan && cloneSpan && cloneSpan.textContent !== srcSpan.textContent) {
        cloneSpan.textContent = srcSpan.textContent;
      }

      var label = srcTab.getAttribute("aria-label");
      if (label) clone.setAttribute("aria-label", label);

      var isOn = srcTab.classList && srcTab.classList.contains("on");
      if (isOn) clone.setAttribute("aria-current", "page");
      else clone.removeAttribute("aria-current");
    }

    /* Bar visibility follows the game's own nav (hidden on start / game over). */
    if (refs.bar) {
      refs.bar.hidden = !shown;
      refs.bar.setAttribute("aria-hidden", shown ? "false" : "true");
    }

    /* FAB: mirror .attn (the "work to do" pulse) and the disabled state. */
    var week = refs.weekBtn || byId("btnWeek");
    if (refs.fab && week) {
      var attn = week.classList && week.classList.contains("attn");
      var cls = "bow-fab";
      if (attn) cls += " attn";
      if (refs.fab.className !== cls) refs.fab.className = cls;
      refs.fab.hidden = !shown;
      if (week.disabled) refs.fab.setAttribute("aria-disabled", "true");
      else refs.fab.removeAttribute("aria-disabled");
    }
  }

  function observeChrome() {
    if (typeof window.MutationObserver === "undefined") {
      /* Fallback for very old WebViews: resync on any tap. */
      document.addEventListener(
        "click",
        function () {
          syncChrome();
        },
        true
      );
      return;
    }

    var nav = refs.sourceNav;
    if (!nav || refs.observer) return;

    try {
      var obs = new window.MutationObserver(function () {
        syncChrome();
      });
      obs.observe(nav, {
        attributes: true,
        attributeFilter: ["class", "hidden", "disabled", "style"],
        childList: true,
        subtree: true,
        characterData: true
      });
      refs.observer = obs;
    } catch (e) {
      /* Observer unsupported: the click-time resync above still covers us. */
      document.addEventListener(
        "click",
        function () {
          syncChrome();
        },
        true
      );
    }
  }

  /* ── Display-settings panel (shell-owned UI) ──────────────────────────── */

  function segButton(label, active, onPick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bow-seg-b" + (active ? " on" : "");
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      onPick();
      refreshPrefs();
    });
    return b;
  }

  function row(title, valueText) {
    var wrap = document.createElement("div");
    wrap.className = "bow-prefs-row";

    var k = document.createElement("div");
    k.className = "bow-prefs-k";
    k.appendChild(document.createTextNode(title));
    if (valueText) {
      var em = document.createElement("em");
      em.appendChild(document.createTextNode(valueText));
      k.appendChild(em);
    }
    wrap.appendChild(k);
    return wrap;
  }

  function buildPrefs() {
    var existing = byId(PREFS_ID);
    if (existing) return existing;

    var root = document.createElement("div");
    root.id = PREFS_ID;
    root.className = "bow-prefs";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Display settings");
    root.hidden = true;

    var bd = document.createElement("div");
    bd.className = "bow-prefs-bd";
    bd.addEventListener("click", function () {
      closePrefs();
    });
    root.appendChild(bd);

    var sheet = document.createElement("div");
    sheet.className = "bow-prefs-sheet";

    var grab = document.createElement("div");
    grab.className = "bow-prefs-grab";
    sheet.appendChild(grab);

    var head = document.createElement("div");
    head.className = "bow-prefs-head";
    var h3 = document.createElement("h3");
    h3.appendChild(document.createTextNode("Display"));
    head.appendChild(h3);

    var x = document.createElement("button");
    x.type = "button";
    x.className = "bow-prefs-x";
    x.setAttribute("aria-label", "Close display settings");
    x.appendChild(document.createTextNode("\u2715"));
    x.addEventListener("click", function () {
      closePrefs();
    });
    head.appendChild(x);
    sheet.appendChild(head);

    var bodyEl = document.createElement("div");
    bodyEl.className = "bow-prefs-body";

    /* Theme */
    var themeRow = row("Theme");
    var themeSeg = document.createElement("div");
    themeSeg.className = "bow-seg";
    themeSeg.setAttribute("data-bow-seg", "theme");
    themeRow.appendChild(themeSeg);
    bodyEl.appendChild(themeRow);

    /* Contrast */
    var ctRow = row("Contrast");
    var ctSeg = document.createElement("div");
    ctSeg.className = "bow-seg";
    ctSeg.setAttribute("data-bow-seg", "contrast");
    ctRow.appendChild(ctSeg);
    bodyEl.appendChild(ctRow);

    /* Motion */
    var moRow = row("Motion");
    var moSeg = document.createElement("div");
    moSeg.className = "bow-seg";
    moSeg.setAttribute("data-bow-seg", "motion");
    moRow.appendChild(moSeg);
    bodyEl.appendChild(moRow);

    /* Font size */
    var fsRow = row("Text size", Math.round(state.fontScale * 100) + "%");
    var fsSeg = document.createElement("div");
    fsSeg.className = "bow-seg";
    fsSeg.setAttribute("data-bow-seg", "font");
    fsRow.appendChild(fsSeg);
    bodyEl.appendChild(fsRow);

    /* Compact */
    var cpRow = row("Compact cards");
    var cpSeg = document.createElement("div");
    cpSeg.className = "bow-seg";
    cpSeg.setAttribute("data-bow-seg", "compact");
    cpRow.appendChild(cpSeg);
    bodyEl.appendChild(cpRow);

    sheet.appendChild(bodyEl);
    root.appendChild(sheet);
    document.body.appendChild(root);

    refs.prefs = root;
    refreshPrefs();
    return root;
  }

  /* Rebuild only the segmented controls (cheap, keeps handlers fresh). */
  function refreshPrefs() {
    var root = refs.prefs || byId(PREFS_ID);
    if (!root) return;

    var themeSeg = $('[data-bow-seg="theme"]', root);
    if (themeSeg) {
      themeSeg.innerHTML = "";
      themeSeg.appendChild(
        segButton("Dark", state.theme === "dark", function () {
          api.setTheme("dark");
        })
      );
      themeSeg.appendChild(
        segButton("Light", state.theme === "light", function () {
          api.setTheme("light");
        })
      );
      themeSeg.appendChild(
        segButton("Auto", state.theme === "system", function () {
          api.setTheme("system");
        })
      );
    }

    var ctSeg = $('[data-bow-seg="contrast"]', root);
    if (ctSeg) {
      ctSeg.innerHTML = "";
      ctSeg.appendChild(
        segButton("Normal", state.contrast !== "high", function () {
          api.setContrast("normal");
        })
      );
      ctSeg.appendChild(
        segButton("High", state.contrast === "high", function () {
          api.setContrast("high");
        })
      );
    }

    var moSeg = $('[data-bow-seg="motion"]', root);
    if (moSeg) {
      moSeg.innerHTML = "";
      moSeg.appendChild(
        segButton("System", state.motion !== "reduced", function () {
          api.setMotion("system");
        })
      );
      moSeg.appendChild(
        segButton("Reduced", state.motion === "reduced", function () {
          api.setMotion("reduced");
        })
      );
    }

    var fsSeg = $('[data-bow-seg="font"]', root);
    if (fsSeg) {
      fsSeg.innerHTML = "";
      fsSeg.appendChild(
        segButton("A-", false, function () {
          api.setFontScale(state.fontScale - 0.05);
        })
      );
      var val = document.createElement("div");
      val.className = "bow-seg-out";
      val.setAttribute("aria-live", "polite");
      val.appendChild(document.createTextNode(Math.round(state.fontScale * 100) + "%"));
      fsSeg.appendChild(val);
      fsSeg.appendChild(
        segButton("A+", false, function () {
          api.setFontScale(state.fontScale + 0.05);
        })
      );
    }

    var cpSeg = $('[data-bow-seg="compact"]', root);
    if (cpSeg) {
      cpSeg.innerHTML = "";
      cpSeg.appendChild(
        segButton("Off", !state.compact, function () {
          api.setCompact(false);
        })
      );
      cpSeg.appendChild(
        segButton("On", !!state.compact, function () {
          api.setCompact(true);
        })
      );
    }

    /* Keep the "Text size" read-out in step. */
    var rows = $all(".bow-prefs-row", root);
    for (var i = 0; i < rows.length; i++) {
      var k = $(".bow-prefs-k", rows[i]);
      if (!k) continue;
      var em = k.querySelector ? k.querySelector("em") : null;
      if (em && k.firstChild && k.firstChild.nodeValue === "Text size") {
        em.textContent = Math.round(state.fontScale * 100) + "%";
      }
    }
  }

  function openPrefs() {
    var root = refs.prefs || buildPrefs();
    if (!root) return;
    refreshPrefs();
    root.hidden = false;
    var x = $(".bow-prefs-x", root);
    if (x && x.focus) {
      try {
        x.focus();
      } catch (e) {}
    }
  }

  function closePrefs() {
    var root = refs.prefs || byId(PREFS_ID);
    if (root) root.hidden = true;
  }

  function togglePrefs() {
    var root = refs.prefs || byId(PREFS_ID);
    if (root && !root.hidden) closePrefs();
    else openPrefs();
  }

  /* ── Public API (rule B7) ─────────────────────────────────────────────── */

  var api = {
    __bowMobileShell: true,
    version: "1.0.0",

    /* Re-apply everything and rebuild missing chrome. Safe to call any time,
       any number of times. */
    apply: function () {
      if (!document.body) return api;
      applyChrome();
      applyFontScale();
      applyTheme();
      applyContrast();
      applyMotion();
      applyCompact();

      if (!isPhoneViewport()) return api;

      refs.sourceNav = getSourceNav();
      if (!refs.sourceNav) return api;

      buildBar();
      buildFab();
      observeChrome();
      syncChrome();
      return api;
    },

    setFontScale: function (n) {
      var v = clampFont(n);
      state.fontScale = v;
      applyFontScale();
      writeStr(KEY_FONT, v);
      refreshPrefs();
      return v;
    },

    getFontScale: function () {
      return state.fontScale;
    },

    /* "dark" | "light" | "system" */
    setTheme: function (s) {
      if (s === "system" || s === "auto") state.theme = "system";
      else if (s === "light") state.theme = "light";
      else state.theme = "dark";
      applyTheme();
      writeStr(KEY_THEME, state.theme);
      refreshPrefs();
      return state.theme;
    },

    /* "normal" | "high" */
    setContrast: function (s) {
      state.contrast = s === "high" ? "high" : "normal";
      applyContrast();
      writeStr(KEY_CONTRAST, state.contrast);
      refreshPrefs();
      return state.contrast;
    },

    /* "system" | "reduced" */
    setMotion: function (s) {
      state.motion = s === "reduced" ? "reduced" : "system";
      applyMotion();
      writeStr(KEY_MOTION, state.motion);
      refreshPrefs();
      return state.motion;
    },

    setCompact: function (b) {
      state.compact = !!b;
      applyCompact();
      writeStr(KEY_COMPACT, state.compact ? "1" : "0");
      refreshPrefs();
      return state.compact;
    },

    getCompact: function () {
      return !!state.compact;
    },

    /* Panel control, exposed for callers that want their own trigger. */
    openPrefs: openPrefs,
    closePrefs: closePrefs,
    togglePrefs: togglePrefs,

    /* Escape hatch: resync the bar against the game's nav right now. */
    sync: function () {
      syncChrome();
      return api;
    },

    /* True when the shell opted in (phone viewport + body class present). */
    isActive: function () {
      return !!(document.body && document.body.classList && document.body.classList.contains("bow-mobile"));
    }
  };

  window.BowMobileShell = api;

  /* ── Boot ─────────────────────────────────────────────────────────────── */

  function boot() {
    loadState();
    api.apply();

    /* Escape closes the shell panel; only when it is actually open. */
    document.addEventListener("keydown", function (ev) {
      if (!ev || ev.key !== "Escape") return;
      var root = refs.prefs || byId(PREFS_ID);
      if (root && !root.hidden) {
        closePrefs();
        if (ev.preventDefault) ev.preventDefault();
      }
    });

    /* OS theme / motion changes are only meaningful in the "auto" modes. */
    try {
      if (window.matchMedia) {
        var darkQ = window.matchMedia("(prefers-color-scheme: dark)");
        var onScheme = function () {
          if (state.theme === "system") applyTheme();
        };
        if (darkQ.addEventListener) darkQ.addEventListener("change", onScheme);
        else if (darkQ.addListener) darkQ.addListener(onScheme);

        var motionQ = window.matchMedia("(prefers-reduced-motion: reduce)");
        var onMotion = function () {
          if (state.motion === "system") applyMotion();
        };
        if (motionQ.addEventListener) motionQ.addEventListener("change", onMotion);
        else if (motionQ.addListener) motionQ.addListener(onMotion);
      }
    } catch (e) {}

    /* Orientation / resize: re-evaluate the phone breakpoint, resync the bar. */
    var reflowTimer = null;
    var onReflow = function () {
      if (reflowTimer) clearTimeout(reflowTimer);
      reflowTimer = setTimeout(function () {
        reflowTimer = null;
        applyChrome();
        if (isPhoneViewport()) {
          buildBar();
          buildFab();
          observeChrome();
          syncChrome();
        }
      }, 150);
    };
    window.addEventListener("resize", onReflow);
    window.addEventListener("orientationchange", onReflow);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    /* Script injected after parse: still defer one tick so #app/#tabbar exist. */
    boot();
  }
})();
