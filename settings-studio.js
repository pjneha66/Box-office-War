/* ═════════════════════════════════════════════════════════════════════════
   SETTINGS-STUDIO.JS — Theme Studio, appearance preferences & Save Vault
   Box Office War — v39
   -------------------------------------------------------------------------
   Settings used to be a list of buttons that closed the dialog on every
   click. This module turns the two weakest panels into real workspaces:

   THEME STUDIO
     · 13 complete looks (10 dark, 3 daylight) with live mini previews
     · filter by dark / daylight, surprise-me, restore classic gold
     · theme is applied in place — the dialog never closes to show you
       what you just picked
     · appearance extras: accent intensity, UI density, film grain,
       high contrast, management-screen tinting, large tap targets,
       transparency

   SAVE VAULT
     · six named careers with date, cash, reputation, films and health
     · save here / load / rename / duplicate / download / delete
     · per-slot copy cipher + readable JSON download
     · import a career from a code or a .json file
     · rolling IndexedDB safety copies (auto-backups + checkpoints)
     · storage meter, integrity check, one-click repair

   Everything degrades gracefully: if IndexedDB or a helper from ui.js is
   unavailable the panel still renders, it just reports less.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (global) {
  /* ───────────────────────── preferences ───────────────────────── */

  const PREFS = [
    { key: "intensity", store: "bow_ui_intensity", fallback: "balanced" },
    { key: "density", store: "bow_ui_density", fallback: "comfortable" },
    { key: "grain", store: "bow_ui_grain", fallback: "1" },
    { key: "contrast", store: "bow_ui_contrast", fallback: "normal" },
    { key: "deck", store: "bow_ui_deck", fallback: "1" },
    { key: "backdrop", store: "bow_ui_backdrop", fallback: "1" },
    { key: "taps", store: "bow_ui_taps", fallback: "0" },
    { key: "confirm", store: "bow_confirm", fallback: "1" },
    { key: "autobackup", store: "bow_autobackup", fallback: "1" },
    { key: "checkpoints", store: "bow_checkpoints", fallback: "1" }
  ];
  const PREF_INDEX = {};
  PREFS.forEach(function (p) { PREF_INDEX[p.key] = p; });

  function rawPref(key) {
    const def = PREF_INDEX[key];
    if (!def) return "";
    try {
      const v = localStorage.getItem(def.store);
      return v == null ? def.fallback : v;
    } catch (e) { return def.fallback; }
  }
  function pref(key) { return rawPref(key); }
  function prefOn(key) { const v = rawPref(key); return v !== "0" && v !== "false" && v !== "off"; }
  function setPref(key, value) {
    const def = PREF_INDEX[key];
    if (!def) return false;
    try { localStorage.setItem(def.store, String(value)); } catch (e) { return false; }
    applyAppearance();
    return true;
  }
  function resetAppearance() {
    PREFS.forEach(function (p) {
      try { localStorage.removeItem(p.store); } catch (e) {}
    });
    applyAppearance();
  }

  function applyAppearance() {
    if (typeof document === "undefined" || !document.body) return;
    const body = document.body;
    const intensity = rawPref("intensity");
    const density = rawPref("density");
    const contrast = rawPref("contrast");
    body.classList.toggle("ts-acc-soft", intensity === "soft");
    body.classList.toggle("ts-acc-vivid", intensity === "vivid");
    body.classList.toggle("ts-dense", density === "compact");
    body.classList.toggle("ts-no-grain", !prefOn("grain"));
    body.classList.toggle("ts-contrast", contrast === "high");
    body.classList.toggle("ts-deck-theme", prefOn("deck"));
    body.classList.toggle("ts-flat", !prefOn("backdrop"));
    body.classList.toggle("ts-taps", prefOn("taps"));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const welcome = document.getElementById("startScreen");
      const onWelcome = welcome && welcome.style.display !== "none";
      if (onWelcome) meta.setAttribute("content", "#181b1e");
      else {
        const def = themeDefRef(currentThemeId());
        if (def) meta.setAttribute("content", def.chrome || "#0b0e14");
      }
    }
  }

  /* ───────────────────────── theme studio ───────────────────────── */

  let themeFilter = "all";

  /* THEMES / THEME are top-level const/let in ui.js: visible to this classic
     script through the shared global scope, but they are NOT window props. */
  function themeList() {
    try { return Array.isArray(THEMES) ? THEMES : []; } catch (e) { return []; }
  }
  function currentThemeId() {
    try { return typeof THEME === "string" ? THEME : "gold"; } catch (e) { return "gold"; }
  }
  function currentTheme() {
    const list = themeList();
    const id = currentThemeId();
    return list.find(function (t) { return t.id === id; }) || list[0] || null;
  }
  function gameState() {
    try { return G || null; } catch (e) { return null; }
  }
  function dataRef() {
    try { return DATA || null; } catch (e) { return null; }
  }
  function themeDefRef(id) {
    try { return typeof themeDef === "function" ? themeDef(id) : null; } catch (e) { return null; }
  }
  function filteredThemes() {
    const list = themeList();
    if (themeFilter === "all") return list;
    return list.filter(function (t) { return t.mode === themeFilter; });
  }
  function validThemeId(id) {
    return themeList().some(function (t) { return t.id === id; });
  }

  function themeCardHTML(t) {
    const active = currentTheme() && currentTheme().id === t.id;
    const swatches = [t.a, t.c, t.b].map(function (col) {
      return '<i style="background:' + col + '"></i>';
    }).join("");
    return '' +
      '<button type="button" class="ts-card' + (active ? " active" : "") + '" data-theme="' + t.id + '" data-mode="' + t.mode + '" aria-pressed="' + (active ? "true" : "false") + '" title="' + esc(t.name) + '">' +
        '<span class="ts-preview" style="--ts-a:' + t.a + ';--ts-b:' + t.b + ';--ts-c:' + t.c + '">' +
          '<span class="ts-pv-top"><i class="ts-pv-dot"></i><i class="ts-pv-dot"></i><i class="ts-pv-dot"></i></span>' +
          '<span class="ts-pv-panel"><i class="ts-pv-line"></i><i class="ts-pv-line short"></i></span>' +
          '<span class="ts-pv-panel hi"><i class="ts-pv-line"></i><i class="ts-pv-pill"></i></span>' +
          '<span class="ts-pv-btn">GREENLIGHT</span>' +
        '</span>' +
        '<span class="ts-meta">' +
          '<span class="ts-name">' + esc(t.name) + '</span>' +
          '<span class="ts-blurb">' + esc(t.blurb || "") + '</span>' +
          '<span class="ts-tags"><em class="ts-mode ' + t.mode + '">' + (t.mode === "light" ? "Daylight" : "Dark") + '</em><em>' + esc(t.group || "Cinema") + '</em>' + (active ? '<em class="ts-live">Active</em>' : "") + '</span>' +
          '<span class="ts-swatches">' + swatches + '</span>' +
        '</span>' +
      '</button>';
  }

  function themeGridHTML() {
    const list = filteredThemes();
    if (!list.length) return '<p class="ts-empty">No looks in this filter.</p>';
    return list.map(themeCardHTML).join("");
  }

  function appearanceRowHTML(opts) {
    const value = rawPref(opts.key);
    return '' +
      '<div class="ts-pref" data-pref-row="' + opts.key + '">' +
        '<div class="ts-pref-copy"><b>' + opts.label + '</b><small>' + opts.help + '</small></div>' +
        '<div class="ts-seg" role="group" aria-label="' + opts.label + '">' +
          opts.choices.map(function (c) {
            return '<button type="button" class="ts-seg-btn' + (value === c.value ? " on" : "") + '" data-pref="' + opts.key + '" data-value="' + c.value + '" aria-pressed="' + (value === c.value ? "true" : "false") + '">' + c.label + '</button>';
          }).join("") +
        '</div>' +
      '</div>';
  }

  function themeGalleryHTML() {
    const list = themeList();
    const lights = list.filter(function (t) { return t.mode === "light"; }).length;
    const darks = list.length - lights;
    const def = currentTheme();
    if (!list.length) return '<div class="theme-studio"><p class="ts-empty">Theme registry unavailable.</p></div>';
    return '' +
      '<div class="theme-studio" data-theme-studio>' +
        '<div class="ts-head">' +
          '<div class="ts-head-copy"><b>Theme</b>' +
            '<p class="ts-sub">' + list.length + ' complete looks — ' + darks + ' dark, ' + lights + ' daylight. The accent, panels, buttons and browser chrome all follow; hit points and flops keep their colours.</p>' +
          '</div>' +
          '<div class="ts-head-actions">' +
            '<button type="button" class="btn btn-sm btn-alt" data-theme-random>Surprise me</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-theme-reset>Classic gold</button>' +
          '</div>' +
        '</div>' +
        '<div class="ts-toolbar">' +
          '<div class="ts-filters" role="group" aria-label="Filter looks">' +
            '<button type="button" class="ts-filter' + (themeFilter === "all" ? " on" : "") + '" data-theme-filter="all">All ' + list.length + '</button>' +
            '<button type="button" class="ts-filter' + (themeFilter === "dark" ? " on" : "") + '" data-theme-filter="dark">Dark ' + darks + '</button>' +
            '<button type="button" class="ts-filter' + (themeFilter === "light" ? " on" : "") + '" data-theme-filter="light">Daylight ' + lights + '</button>' +
          '</div>' +
          '<span class="ts-current">Active <b data-theme-current>' + esc(def ? def.name : "Midnight Gold") + '</b></span>' +
        '</div>' +
        '<div class="ts-grid" data-theme-grid>' + themeGridHTML() + '</div>' +
        '<div class="ts-appearance">' +
          '<div class="ts-appearance-head"><b>Appearance</b><button type="button" class="btn btn-xs btn-ghost" data-pref-reset>Reset appearance</button></div>' +
          appearanceRowHTML({ key: "intensity", label: "Accent intensity", help: "How much glow the gold, neon and daylight accents throw.", choices: [{ value: "soft", label: "Soft" }, { value: "balanced", label: "Balanced" }, { value: "vivid", label: "Vivid" }] }) +
          appearanceRowHTML({ key: "density", label: "Interface density", help: "Comfortable spacing, or a tighter desk with more on screen.", choices: [{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }] }) +
          appearanceRowHTML({ key: "contrast", label: "Contrast", help: "Lifts text and borders for bright rooms and tired eyes.", choices: [{ value: "normal", label: "Standard" }, { value: "high", label: "High" }] }) +
          appearanceRowHTML({ key: "grain", label: "Film grain", help: "The faint projector-grain wash over the app shell.", choices: [{ value: "1", label: "On" }, { value: "0", label: "Off" }] }) +
          appearanceRowHTML({ key: "deck", label: "Tint management screens", help: "Lets the studio-lot decks follow the active theme instead of the classic green.", choices: [{ value: "1", label: "Follow theme" }, { value: "0", label: "Classic green" }] }) +
          appearanceRowHTML({ key: "backdrop", label: "Transparency", help: "Frosted modal veils. Turn off for a flat, faster surface.", choices: [{ value: "1", label: "On" }, { value: "0", label: "Off" }] }) +
          appearanceRowHTML({ key: "taps", label: "Large tap targets", help: "Every control grows to 48px — built for one-handed play.", choices: [{ value: "1", label: "On" }, { value: "0", label: "Off" }] }) +
        '</div>' +
      '</div>';
  }

  function syncThemeActive(root) {
    const cur = currentTheme() ? currentTheme().id : "gold";
    const grid = root.querySelector("[data-theme-grid]");
    if (grid) grid.innerHTML = themeGridHTML();
    root.querySelectorAll("[data-theme-current]").forEach(function (el) {
      const def = currentTheme();
      el.textContent = def ? def.name : "Midnight Gold";
    });
    root.querySelectorAll("[data-theme-filter]").forEach(function (b) {
      b.classList.toggle("on", b.dataset.themeFilter === themeFilter);
    });
    root.querySelectorAll("[data-pref]").forEach(function (b) {
      const on = rawPref(b.dataset.pref) === b.dataset.value;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    return cur;
  }

  function applyThemeSafely(id) {
    try {
      if (typeof applyTheme === "function") { applyTheme(id); return; }
    } catch (e) {}
    if (global.document) {
      if (id === "gold") delete document.body.dataset.theme;
      else document.body.dataset.theme = id;
      try { localStorage.setItem("bow_theme", id); } catch (e) {}
    }
  }

  function bindThemeGallery(root) {
    if (!root) return;
    root.addEventListener("click", function (e) {
      const card = e.target.closest("[data-theme]");
      const filter = e.target.closest("[data-theme-filter]");
      const seg = e.target.closest("[data-pref]");
      if (filter) {
        themeFilter = filter.dataset.themeFilter;
        syncThemeActive(root);
        if (typeof beep === "function") beep("click");
        return;
      }
      if (seg) {
        setPref(seg.dataset.pref, seg.dataset.value);
        syncThemeActive(root);
        if (typeof beep === "function") beep("click");
        return;
      }
      if (card) {
        const id = card.dataset.theme;
        if (!validThemeId(id)) return;
        applyThemeSafely(id);
        syncThemeActive(root);
        if (typeof beep === "function") beep("gold");
        return;
      }
      if (e.target.closest("[data-theme-random]")) {
        const list = themeList();
        if (!list.length) return;
        const cur = currentTheme() ? currentTheme().id : "gold";
        const pool = list.filter(function (t) { return t.id !== cur; });
        const pick = pool[Math.floor(Math.random() * pool.length)] || list[0];
        applyThemeSafely(pick.id);
        themeFilter = "all";
        syncThemeActive(root);
        if (typeof beep === "function") beep("gold");
        return;
      }
      if (e.target.closest("[data-theme-reset]")) {
        applyThemeSafely("gold");
        themeFilter = "all";
        syncThemeActive(root);
        if (typeof beep === "function") beep("click");
        return;
      }
      if (e.target.closest("[data-pref-reset]")) {
        resetAppearance();
        syncThemeActive(root);
        if (typeof beep === "function") beep("click");
        return;
      }
    });
  }

  /* ───────────────────────── save vault ───────────────────────── */

  function count() {
    try { return typeof SAVE_SLOT_COUNT === "number" ? SAVE_SLOT_COUNT : 6; } catch (e) { return 6; }
  }
  function slotInfo(n) {
    try { return typeof slotMeta === "function" ? slotMeta(n) : null; }
    catch (e) { return null; }
  }
  function activeInfo() {
    try { return typeof activeSaveMeta === "function" ? activeSaveMeta() : null; }
    catch (e) { return null; }
  }
  function money(v) {
    try { if (typeof fmtM === "function") return fmtM(v); } catch (e) {}
    return "$" + Math.round(Number(v) || 0) + "M";
  }
  function dateOf(week) {
    try { if (typeof dateLabel === "function") return dateLabel(week); } catch (e) {}
    return "Y1 · W" + (week || 1);
  }
  function scenarioName(id) {
    try {
      const D = dataRef();
      return (D && D.SCENARIOS && D.SCENARIOS[id] && D.SCENARIOS[id].name) || "Standard";
    } catch (e) { return "Standard"; }
  }
  function ago(ts) {
    if (!ts) return "never";
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }
  function kb(bytes) {
    const b = Number(bytes) || 0;
    if (b > 1024 * 1024) return (b / 1048576).toFixed(1) + " MB";
    return Math.max(1, Math.round(b / 1024)) + " KB";
  }
  function storageUsage() {
    let bytes = 0, keys = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.indexOf("bow_") !== 0) continue;
        keys++;
        bytes += k.length + String(localStorage.getItem(k) || "").length;
      }
    } catch (e) {}
    return { bytes: bytes, keys: keys };
  }
  function needsConfirm() { return prefOn("confirm"); }
  function ask(message) {
    if (!needsConfirm()) return true;
    try { return global.confirm(message); } catch (e) { return true; }
  }
  function toast(msg, kind) {
    try { if (typeof toast === "function") toast(msg, kind || "good"); } catch (e) {}
  }

  function slotCardHTML(n) {
    const m = slotInfo(n);
    const active = activeInfo();
    const isLive = m && active && active.slot === n && !m.corrupt;
    const status = !m ? "Empty" : m.corrupt ? "Needs repair" : isLive ? "Live career" : "Saved";
    const name = m ? (m.label || m.name) : "Slot " + n;
    const actions = [];
    if (m && !m.corrupt) {
      actions.push('<button type="button" class="btn btn-sm btn-primary" data-slot-load="' + n + '">Load</button>');
      actions.push('<button type="button" class="btn btn-sm btn-alt" data-saveslot="' + n + '">Save here</button>');
      actions.push('<button type="button" class="btn btn-sm btn-ghost" data-slot-file="' + n + '">Download</button>');
      actions.push('<button type="button" class="btn btn-sm btn-ghost" data-slot-copy="' + n + '">Duplicate</button>');
      actions.push('<button type="button" class="btn btn-sm btn-ghost" data-slot-del="' + n + '">Delete</button>');
    } else if (m && m.corrupt) {
      actions.push('<button type="button" class="btn btn-sm btn-primary" data-slot-repair="' + n + '">Repair slot</button>');
      actions.push('<button type="button" class="btn btn-sm btn-ghost" data-slot-download-raw="' + n + '">Download raw</button>');
      actions.push('<button type="button" class="btn btn-sm btn-ghost" data-slot-del="' + n + '">Delete</button>');
    } else {
      actions.push('<button type="button" class="btn btn-sm btn-primary" data-saveslot="' + n + '">Save here</button>');
      actions.push('<button type="button" class="btn btn-sm btn-alt" data-slot-new="' + n + '">New career</button>');
    }

    const body = m && !m.corrupt
      ? '<div class="slot-facts">' +
          '<span><small>DATE</small><b>' + dateOf(m.week) + '</b></span>' +
          '<span><small>CASH</small><b>' + money(m.cash) + '</b></span>' +
          '<span><small>REPUTATION</small><b>' + (m.rep || 25) + '</b></span>' +
          '<span><small>RELEASES</small><b>' + (m.films || 0) + '</b></span>' +
        '</div>' +
        '<div class="slot-sub">' + esc(scenarioName(m.scenario)) + ' · ' + esc(String(m.difficulty || "normal")) + (m.sandbox ? ' · sandbox' : '') + ' · saved ' + ago(m.savedAt) + ' · ' + kb(m.bytes) + '</div>'
      : m && m.corrupt
        ? '<div class="slot-warn">This slot cannot be read: ' + esc((m.problems || []).join(", ") || "unknown damage") + '.</div>'
        : '<div class="slot-empty-note">An empty lot. Save your live career here, or start a fresh one on this slot.</div>';

    return '' +
      /* is-* modifiers keep clear of the global .empty / .live utility
         classes in bow-restyle.css, which paint an arcade placeholder panel */
      '<article class="slot-card' + (m ? " is-filled" : " is-empty") + (isLive ? " is-live" : "") + (m && m.corrupt ? " is-corrupt" : "") + '" data-slot-card="' + n + '">' +
        '<header class="slot-head">' +
          '<span class="slot-num">SLOT ' + String(n).padStart(2, "0") + '</span>' +
          '<span class="slot-pill ' + (status === "Empty" ? "is-empty" : status === "Needs repair" ? "is-bad" : isLive ? "is-live" : "is-ok") + '">' + status + '</span>' +
        '</header>' +
        '<label class="slot-name">' +
          '<span class="sr-only">Slot ' + n + ' label</span>' +
          '<input type="text" maxlength="32" value="' + esc(m ? (m.label || m.name || "") : "") + '" data-slot-label="' + n + '" placeholder="Name this career" autocomplete="off">' +
        '</label>' +
        body +
        '<div class="slot-actions">' + actions.join("") + '</div>' +
      '</article>';
  }

  function vaultBodyHTML() {
    const active = activeInfo();
    const usage = storageUsage();
    const budget = 5 * 1024 * 1024;
    const pct = Math.min(100, Math.round((usage.bytes / budget) * 1000) / 10);
    const cards = [];
    for (let i = 1; i <= count(); i++) cards.push(slotCardHTML(i));
    return '' +
      '<div class="vault-head">' +
        '<div class="vault-live">' +
          '<span class="command-eyebrow">LIVE AUTOSAVE</span>' +
          '<b>' + esc(active ? active.name : "No career running") + '</b>' +
          '<small>' + (active ? dateOf(active.week) + ' · ' + money(active.cash) + ' · rep ' + active.rep + ' · slot ' + (active.slot || 1) : 'Start a career to begin') + '</small>' +
        '</div>' +
        '<div class="vault-tools">' +
          '<button type="button" class="btn btn-sm btn-primary" data-vault-save-now>Save now</button>' +
          '<button type="button" class="btn btn-sm btn-alt" data-vault-backup>Safety copy</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-vault-refresh>Refresh</button>' +
        '</div>' +
      '</div>' +
      '<div class="vault-meter" title="localStorage used by this game">' +
        '<div class="vault-meter-bar"><i style="width:' + Math.max(2, pct) + '%"></i></div>' +
        '<span>' + kb(usage.bytes) + ' in ' + usage.keys + ' keys · local budget ~5 MB</span>' +
      '</div>' +
      '<div class="vault-grid">' + cards.join("") + '</div>' +
      '<div class="vault-toggles">' +
        '<label class="vault-toggle"><input type="checkbox" data-pref-toggle="autobackup"' + (prefOn("autobackup") ? " checked" : "") + '><span><b>Auto safety copies</b><small>Every 12 weeks, quietly copy the live career into device storage.</small></span></label>' +
        '<label class="vault-toggle"><input type="checkbox" data-pref-toggle="checkpoints"' + (prefOn("checkpoints") ? " checked" : "") + '><span><b>Weekly checkpoints</b><small>A rolling five-deep checkpoint ring, restorable if a run goes wrong.</small></span></label>' +
        '<label class="vault-toggle"><input type="checkbox" data-pref-toggle="confirm"' + (prefOn("confirm") ? " checked" : "") + '><span><b>Confirm destructive actions</b><small>Ask before overwriting, loading over, or deleting a career.</small></span></label>' +
      '</div>' +
      '<div class="vault-section">' +
        '<div class="vault-section-head"><b>Import / export</b><small>Move one career between devices.</small></div>' +
        '<div class="vault-code">' +
          '<textarea id="saveCode" rows="2" placeholder="Paste a career code here, or press Copy code above to fill it."></textarea>' +
          '<div class="vault-code-actions">' +
            '<button type="button" class="btn btn-sm btn-alt" id="btnExport">Copy code</button>' +
            '<button type="button" class="btn btn-sm btn-primary" id="btnImport">Import code</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-vault-import-file>Import .json file</button>' +
            '<input type="file" accept=".json,application/json,text/plain" data-vault-file hidden>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="vault-section">' +
        '<div class="vault-section-head"><b>Safety copies</b><small>Stored on this device in IndexedDB.</small><button type="button" class="btn btn-xs btn-ghost" data-vault-repair-all>Check every slot</button></div>' +
        '<div class="vault-list" data-vault-safety><p class="vault-note">Reading device storage…</p></div>' +
      '</div>' +
      '<div class="vault-section">' +
        '<div class="vault-section-head"><b>Named device backups</b><small>Manual snapshots you saved earlier.</small></div>' +
        '<div class="vault-list" data-vault-device><p class="vault-note">Reading device storage…</p></div>' +
      '</div>';
  }

  function saveVaultHTML() {
    return '<div class="save-vault" id="saveVault" data-save-vault><div class="vault-body" data-vault-body>' + vaultBodyHTML() + '</div></div>';
  }

  function refreshVault(root) {
    if (!root) return;
    const body = root.querySelector("[data-vault-body]") || root.querySelector("#saveVault");
    if (!body) return;
    body.innerHTML = vaultBodyHTML();
    loadAsyncLists(root);
  }

  async function loadAsyncLists(root) {
    const safetyEl = root.querySelector("[data-vault-safety]");
    const deviceEl = root.querySelector("[data-vault-device]");
    const rowHTML = function (r, kind) {
      return '<div class="vault-row">' +
        '<span class="vault-row-main"><b>' + esc(r.studio || "Studio") + '</b><small>' + dateOf(r.week) + ' · ' + money(r.cash) + ' · rep ' + (r.rep || 25) + ' · ' + esc(scenarioName(r.scenario)) + ' · ' + ago(r.timestamp) + '</small></span>' +
        '<span class="vault-row-kind">' + (kind === "checkpoint" ? "CHECKPOINT" : kind === "device" ? "DEVICE" : "SAFETY") + '</span>' +
        '<span class="vault-row-actions">' +
          '<button type="button" class="btn btn-xs btn-alt" data-vault-restore="' + esc(r.id) + '" data-restore-kind="' + kind + '">Restore</button>' +
          '<button type="button" class="btn btn-xs btn-ghost" data-vault-forget="' + esc(r.id) + '">Forget</button>' +
        '</span>' +
      '</div>';
    };
    if (safetyEl) {
      try {
        const checks = typeof listSafetyCopies === "function" ? await listSafetyCopies("checkpoint") : [];
        const backups = typeof listSafetyCopies === "function" ? await listSafetyCopies("backup") : [];
        const rows = checks.map(function (r) { return rowHTML(r, "checkpoint"); })
          .concat(backups.map(function (r) { return rowHTML(r, "backup"); }));
        safetyEl.innerHTML = rows.length ? rows.join("") : '<p class="vault-note">No safety copies yet. They appear here after a few weeks, or press Safety copy now.</p>';
      } catch (e) {
        safetyEl.innerHTML = '<p class="vault-note">Device storage is unavailable in this browser.</p>';
      }
    }
    if (deviceEl) {
      try {
        const list = typeof listIDBSlots === "function" ? await listIDBSlots() : [];
        const named = list.filter(function (r) { return String(r.id).indexOf("bowbackup:") !== 0 && String(r.id).indexOf("bowchk:") !== 0; });
        deviceEl.innerHTML = named.length
          ? named.map(function (r) { return rowHTML({ id: r.id, studio: String(r.id).replace(/^.*?:/, ""), timestamp: r.timestamp, week: 0, cash: 0, rep: 0 }, "device"); }).join("")
          : '<p class="vault-note">No named backups on this device yet.</p>';
      } catch (e) {
        deviceEl.innerHTML = '<p class="vault-note">Device storage is unavailable in this browser.</p>';
      }
    }
  }

  function afterChange(root) {
    refreshVault(root);
    try { if (typeof render === "function" && document.getElementById("view")) render(); } catch (e) {}
  }

  function downloadJSON(record, filename) {
    try {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e) { return false; }
  }
  function readSlotJSON(n) {
    try {
      const raw = localStorage.getItem("bow_slot" + n);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function applyImportedSave(text, targetSlot) {
    let raw = "";
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.data && parsed.data.studio) raw = JSON.stringify(parsed.data);
      else if (parsed && parsed.studio) raw = JSON.stringify(parsed);
      else if (parsed && parsed.bow_save) raw = parsed.bow_save;
    } catch (e) {
      try { raw = decodeURIComponent(escape(atob(String(text || "").trim()))); } catch (err) { raw = ""; }
    }
    if (!raw) { toast("That file or code did not parse.", "bad"); return false; }
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { toast("That career data is not valid JSON.", "bad"); return false; }
    const problems = typeof validateSave === "function" ? validateSave(parsed) : [];
    if (problems.length) { toast("Save rejected: " + problems[0] + ".", "bad"); return false; }
    const slot = targetSlot || firstEmptySlot() || 1;
    const ok = typeof importSlotCode === "function" ? importSlotCode(slot, btoa(unescape(encodeURIComponent(raw)))) : false;
    if (!ok) { toast("Could not write that career into a slot.", "bad"); return false; }
    toast("Career imported into slot " + slot + ".", "good");
    return true;
  }

  function bindSaveVault(root) {
    if (!root) return;
    const vault = root.querySelector("#saveVault") || root;
    loadAsyncLists(root);

    vault.addEventListener("change", function (e) {
      const label = e.target.closest("[data-slot-label]");
      const toggle = e.target.closest("[data-pref-toggle]");
      const file = e.target.closest("[data-vault-file]");
      if (label) {
        const n = +label.dataset.slotLabel;
        if (typeof setSlotLabel === "function") setSlotLabel(n, label.value);
        toast("Slot " + n + " renamed.", "good");
        return;
      }
      if (toggle) {
        setPref(toggle.dataset.prefToggle, toggle.checked ? "1" : "0");
        toast("Preference saved.", "good");
        return;
      }
      if (file && file.files && file.files[0]) {
        const reader = new FileReader();
        reader.onload = function () {
          if (applyImportedSave(String(reader.result || ""), 0)) afterChange(root);
        };
        reader.readAsText(file.files[0]);
      }
    });

    vault.addEventListener("click", async function (e) {
      const load = e.target.closest("[data-slot-load]");
      const save = e.target.closest("[data-saveslot]");
      const del = e.target.closest("[data-slot-del]");
      const copy = e.target.closest("[data-slot-copy]");
      const code = e.target.closest("[data-slot-code]");
      const file = e.target.closest("[data-slot-file]");
      const rawDl = e.target.closest("[data-slot-download-raw]");
      const repair = e.target.closest("[data-slot-repair]");
      const fresh = e.target.closest("[data-slot-new]");
      const restore = e.target.closest("[data-vault-restore]");
      const forget = e.target.closest("[data-vault-forget]");
      const importFile = e.target.closest("[data-vault-import-file]");

      if (save) {
        const n = +save.dataset.saveslot;
        const m = slotInfo(n);
        if (m && m.corrupt && !ask("Slot " + n + " is damaged. Overwrite it with the live career?")) return;
        if (m && !m.corrupt && activeInfo() && activeInfo().slot !== n && !ask("Overwrite slot " + n + " (" + (m.label || m.name) + ") with the live career?")) return;
        if (!gameState()) { toast("Start a career before saving.", "bad"); return; }
        if (typeof saveCurrentToSlot === "function") saveCurrentToSlot(n);
        else { gameState().slot = n; if (typeof saveGame === "function") saveGame(); }
        toast("Saved to slot " + n + ".", "good");
        if (typeof beep === "function") beep("gold");
        afterChange(root);
        return;
      }
      if (load) {
        const n = +load.dataset.slotLoad;
        const m = slotInfo(n);
        if (!ask("Load slot " + n + " (" + (m && (m.label || m.name)) + ")? The live career is replaced.")) return;
        try { if (gameState() && typeof addSafetyCopy === "function") await addSafetyCopy(gameState(), { kind: "backup", label: "before-load" }); } catch (err) {}
        const g = typeof loadSlot === "function" ? await loadSlot(n) : null;
        if (!g) { toast("That slot could not be loaded.", "bad"); return; }
        try { if (typeof closeModal === "function") closeModal(); } catch (err) {}
        try { if (typeof render === "function") render(); } catch (err) {}
        try { if (typeof beep === "function") beep("fanfare"); } catch (err) {}
        toast("Loaded " + (g.studio && g.studio.name || "career") + " from slot " + n + ".", "good");
        return;
      }
      if (del) {
        const n = +del.dataset.slotDel;
        const m = slotInfo(n);
        if (!ask("Delete slot " + n + (m ? " (" + (m.label || m.name) + ")" : "") + "? This cannot be undone.")) return;
        if (typeof deleteSaveSlot === "function") deleteSaveSlot(n);
        toast("Slot " + n + " deleted.", "good");
        afterChange(root);
        return;
      }
      if (copy) {
        const from = +copy.dataset.slotCopy;
        const to = typeof firstEmptySlot === "function" ? firstEmptySlot() : 0;
        if (!to) { toast("Every slot is full — delete one first.", "bad"); return; }
        if (typeof copySaveSlot === "function" && copySaveSlot(from, to)) toast("Duplicated into slot " + to + ".", "good");
        else toast("Duplicate failed.", "bad");
        afterChange(root);
        return;
      }
      if (code) {
        const n = +code.dataset.slotCode;
        const txt = typeof exportSlotCode === "function" ? exportSlotCode(n) : "";
        if (!txt) { toast("That slot is empty.", "bad"); return; }
        try { await navigator.clipboard.writeText(txt); toast("Slot " + n + " code copied.", "good"); }
        catch (err) { toast("Clipboard blocked — use Download instead.", "bad"); }
        return;
      }
      if (file) {
        const n = +file.dataset.slotFile;
        const rec = readSlotJSON(n);
        if (!rec) { toast("That slot is unreadable.", "bad"); return; }
        const ok = downloadJSON({ game: "Box Office War", slot: n, exportedAt: new Date().toISOString(), save: rec }, "box-office-war-slot-" + n + ".json");
        toast(ok ? "Slot " + n + " downloaded." : "Download failed.", ok ? "good" : "bad");
        return;
      }
      if (rawDl) {
        const n = +rawDl.dataset.slotDownloadRaw;
        let raw = "";
        try { raw = localStorage.getItem("bow_slot" + n) || ""; } catch (err) {}
        const ok = downloadJSON({ slot: n, raw: raw }, "box-office-war-slot-" + n + "-raw.json");
        toast(ok ? "Raw slot downloaded." : "Download failed.", ok ? "good" : "bad");
        return;
      }
      if (repair) {
        const n = +repair.dataset.slotRepair;
        if (typeof repairSaveSlots === "function") repairSaveSlots();
        toast("Slot " + n + " checked.", "good");
        afterChange(root);
        return;
      }
      if (fresh) {
        const n = +fresh.dataset.slotNew;
        try { if (typeof closeModal === "function") closeModal(); } catch (err) {}
        if (typeof startNewCareerInSlot === "function") startNewCareerInSlot(n);
        else toast("Slot " + n + " selected. Return to the menu to start a new career.", "good");
        return;
      }
      if (restore) {
        const id = restore.dataset.vaultRestore;
        const kind = restore.dataset.restoreKind;
        if (!ask("Restore this " + (kind === "device" ? "device backup" : "safety copy") + "? The live career is replaced.")) return;
        try { if (gameState() && typeof addSafetyCopy === "function") await addSafetyCopy(gameState(), { kind: "backup", label: "before-restore" }); } catch (err) {}
        const g = kind === "device"
          ? (typeof loadFromIDB === "function" ? await (async function () { const d = await loadFromIDB(id); if (!d) return null; if (typeof validateSave === "function" && validateSave(d).length) return null; return restoreSafetyCopyWith(d); })() : null)
          : (typeof restoreSafetyCopy === "function" ? await restoreSafetyCopy(id) : null);
        if (!g) { toast("That copy could not be restored.", "bad"); return; }
        try { if (typeof closeModal === "function") closeModal(); } catch (err) {}
        try { if (typeof render === "function") render(); } catch (err) {}
        toast("Career restored.", "good");
        return;
      }
      if (forget) {
        const id = forget.dataset.vaultForget;
        if (!ask("Forget this copy? The saved career itself is untouched.")) return;
        if (typeof deleteFromIDB === "function") await deleteFromIDB(id);
        toast("Copy removed.", "good");
        refreshVault(root);
        return;
      }
      if (importFile) {
        const input = root.querySelector("[data-vault-file]");
        if (input) input.click();
        return;
      }

      const target = e.target;
      if (target.id === "btnExport") {
        const ta = root.querySelector("#saveCode");
        const code = typeof exportCode === "function" ? exportCode() : "";
        if (ta) ta.value = code;
        try { await navigator.clipboard.writeText(code); toast("Career code copied.", "good"); }
        catch (err) { toast(code ? "Code ready below." : "No career to export.", code ? "good" : "bad"); }
        return;
      }
      if (target.id === "btnImport") {
        const ta = root.querySelector("#saveCode");
        const code = ta ? String(ta.value || "").trim() : "";
        if (!code) { toast("Paste a career code first.", "bad"); return; }
        const parsed = applyImportedSave(code, 0);
        if (parsed) afterChange(root);
        return;
      }
      if (e.target.closest("[data-vault-save-now]")) {
        if (!gameState()) { toast("No career running.", "bad"); return; }
        try { if (typeof saveGame === "function") saveGame(); } catch (err) {}
        toast("Live career saved.", "good");
        afterChange(root);
        return;
      }
      if (e.target.closest("[data-vault-backup]")) {
        if (!gameState()) { toast("No career running.", "bad"); return; }
        try { await addSafetyCopy(gameState(), { kind: "backup", label: "manual" }); toast("Safety copy stored on this device.", "good"); }
        catch (err) { toast("Device storage is unavailable.", "bad"); }
        refreshVault(root);
        return;
      }
      if (e.target.closest("[data-vault-refresh]")) {
        toast("Vault refreshed.", "good");
        refreshVault(root);
        return;
      }
      if (e.target.closest("[data-vault-repair-all]")) {
        try { if (typeof repairSaveSlots === "function") repairSaveSlots(); } catch (err) {}
        toast("All slots checked.", "good");
        afterChange(root);
        return;
      }
    });
  }

  /* Restoring a named device backup reuses the same guards as a safety copy. */
  function restoreSafetyCopyWith(data) {
    try {
      if (typeof validateSave === "function" && validateSave(data).length) return null;
      const save = typeof migrateSave === "function" ? migrateSave(data).save : data;
      G = save;
      if (global.document) global.G = save;
      if (typeof ensureLiveState === "function") ensureLiveState(save);
      if (typeof ensureEmpireState === "function") ensureEmpireState(save);
      if (typeof saveGame === "function") saveGame();
      return save;
    } catch (e) { return null; }
  }

  /* ───────────────────────── weekly safety net ───────────────────────── */

  async function maybeAutoBackup() {
    const g = gameState();
    if (!g || g._noSave) return;
    const week = Number(g.week) || 0;
    if (!week) return;
    const lastWeek = Number((function () { try { return localStorage.getItem("bow_safety_week"); } catch (e) { return 0; } })()) || 0;
    if (lastWeek === week) return;
    let did = false;
    if (prefOn("checkpoints") && week % 4 === 0 && typeof addSafetyCopy === "function") {
      try { await addSafetyCopy(g, { kind: "checkpoint", label: "w" + week }); did = true; } catch (e) {}
    }
    if (prefOn("autobackup") && week % 12 === 0 && typeof addSafetyCopy === "function") {
      try { await addSafetyCopy(g, { kind: "backup", label: "w" + week }); did = true; } catch (e) {}
    }
    try { localStorage.setItem("bow_safety_week", String(week)); } catch (e) {}
    return did;
  }

  const SettingsStudio = {
    pref: pref,
    prefOn: prefOn,
    setPref: setPref,
    resetAppearance: resetAppearance,
    applyAppearance: applyAppearance,
    themeGalleryHTML: themeGalleryHTML,
    bindThemeGallery: bindThemeGallery,
    saveVaultHTML: saveVaultHTML,
    bindSaveVault: bindSaveVault,
    refreshVault: refreshVault,
    maybeAutoBackup: maybeAutoBackup,
    storageUsage: storageUsage,
    slotInfo: slotInfo,
    version: "1.0.0"
  };

  global.SettingsStudio = SettingsStudio;
  if (typeof module !== "undefined" && module.exports) module.exports = SettingsStudio;
})(typeof window !== "undefined" ? window : globalThis);
