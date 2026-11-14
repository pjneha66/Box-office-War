/* Box Office War — rebuilt. Slots module (wave 5) — save slots + studio identity.
   Two systems, no weekly tick (nothing here moves on its own):
   1. SAVE SLOTS — six snapshot copies of the whole save, stored OUTSIDE the save in
      localStorage key 'bow2.slots' as {slots:[{id,name,ts,snapshot,meta}]} so they
      survive newGame() wipes. slot-save snapshots localStorage 'bow2.save.v1'
      (SAVE_KEY, engine.js) — falling back to JSON.stringify(S) in private mode —
      and slot-load puts the snapshot back on SAVE_KEY, rebinds S, and re-enters the
      studio view. Two-tap confirm on delete, inline prompt-free rename via a
      #slotName text-input. Export stays the existing Save & load sheet (ui.js
      sheetExport) — this module adds no second exporter.
   2. STUDIO LOGO — S.slots.logo {shape,bg,text}; logoChipHTML() renders the monogram
      chip (ui.js topbar integration calls it). Also hosts the PREFS.frame segment
      (poster frame style; posters.js posterSVG reads it via the integrator).
   Notes for integrator: define order — ui.js already wires SLOTS_DESKS in
   collectDesks() and slotPickerHTML() on the start screen; onAction still needs its
   slotsAction bridge line (like posterAction). This module defines
   forecastAdjust_slots() → 0 (uniform zero stub, finance.js/library.js pattern) —
   ui.js's bare forecastAdjust() aggregator owns the single unsuffixed name, so a
   bare forecastAdjust here would collide with it.
   All S.slots reads are lazy-ensured — old saves have no S.slots. */
"use strict";

/* ── state (lazy ensure — old saves have no S.slots) ───────────── */
function slotsEnsure() {
  if (!S) return;
  if (!S.slots) S.slots = { logo: { shape: "circle", bg: "gold", text: "dark" } };
  if (!S.slots.logo) S.slots.logo = { shape: "circle", bg: "gold", text: "dark" };
}

/* ── slot list on localStorage 'bow2.slots' (outside the save) ── */
var SLOT_COUNT = 6;
function slotsRead() {
  var out = { slots: [] }, i;
  try { out = JSON.parse(localStorage.getItem("bow2.slots") || "{}") || {}; } catch (e) { out = {}; }
  var list = (out && out.slots) || [];
  var norm = [];
  for (i = 1; i <= SLOT_COUNT; i++) {
    var row = null, j;
    for (j = 0; j < list.length; j++) if (list[j] && list[j].id === i) row = list[j];
    if (!row) row = { id: i, name: "", ts: 0, snapshot: null, meta: null };
    if (typeof row.name !== "string") row.name = "";
    norm.push(row);
  }
  return norm;
}
function slotsWrite(list) { try { localStorage.setItem("bow2.slots", JSON.stringify({ slots: list })); } catch (e) { /* private mode */ } }
function slotById(list, id) { var i; for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function slotNameOf(row) { return row.name || ("Slot " + row.id); }
function slotMetaText(row) {
  if (!row.snapshot || !row.meta) return "— empty —";
  return "Y" + row.meta.year + " · " + fm(row.meta.cash) + " · rep " + row.meta.rep + " · " + row.meta.films + " films";
}

/* ── slot operations ──────────────────────────────────────────── */
function slotSave(id) {
  if (!S) return { err: "Start a studio first." };
  var list = slotsRead(), row = slotById(list, id);
  if (!row) return { err: "No such slot." };
  saveGame(); /* make 'bow2.save.v1' current before snapshotting */
  var snap = null;
  try { snap = localStorage.getItem(SAVE_KEY); } catch (e) {}
  if (!snap) snap = JSON.stringify(S); /* private-mode fallback */
  row.snapshot = snap;
  row.ts = Date.now();
  if (!row.name) row.name = "Slot " + id;
  row.meta = { year: S.studio.year, cash: Math.round(S.studio.cash * 10) / 10, rep: Math.round(S.studio.rep), films: S.films.length };
  slotsWrite(list);
  toast("💾 Saved to " + slotNameOf(row) + " — " + slotMetaText(row) + ".", "good");
  return { ok: true };
}
function slotLoad(id) {
  var list = slotsRead(), row = slotById(list, id);
  if (!row || !row.snapshot) return { err: "Slot " + id + " is empty." };
  var parsed = null;
  try { parsed = JSON.parse(row.snapshot); } catch (e) { parsed = null; }
  if (!parsed || !parsed.studio) return { err: "That snapshot is corrupted." };
  try { localStorage.setItem(SAVE_KEY, row.snapshot); } catch (e) {}
  S = parsed;
  slotsEnsure();
  S.slotsRenaming = null;
  S.slotsConfirm = null;
  try { if (typeof closeSheet === "function") closeSheet(); } catch (e1) {}
  VIEW = "studio";
  lastCash = null;
  if (typeof render === "function") render();
  toast("Loaded " + slotNameOf(row) + ".", "good");
  if (typeof drainFlash === "function") drainFlash();
  return { ok: true };
}
function slotRename(id) { /* first tap — inline editor; second tap on it cancels */
  if (!S) return { err: "Start a studio first." };
  if (S.slotsRenaming === id) S.slotsRenaming = null;
  else { S.slotsRenaming = id; S.slotsConfirm = null; }
  return { ok: true };
}
function slotRenameConfirm(id) {
  var list = slotsRead(), row = slotById(list, id);
  if (!row) return { err: "No such slot." };
  var val = null;
  try {
    var inp = document.getElementById("slotName");
    if (inp && typeof inp.value === "string") val = inp.value;
  } catch (e) {}
  var name = String(val || "").replace(/\s+/g, " ").trim().slice(0, 24);
  if (!name) name = slotNameOf(row);
  row.name = name;
  if (S) S.slotsRenaming = null;
  slotsWrite(list);
  toast("✏️ Renamed to “" + name + "”.", "good");
  return { ok: true };
}
function slotDelete(id) { /* two-tap confirm: first tap arms, second executes */
  if (!S) return { err: "Start a studio first." };
  var list = slotsRead(), row = slotById(list, id);
  if (!row || !row.snapshot) { if (S) S.slotsConfirm = null; return { err: "Slot " + id + " is empty." }; }
  if (S.slotsConfirm !== id) {
    S.slotsConfirm = id; S.slotsRenaming = null;
    return { ok: true, armed: true };
  }
  row.snapshot = null;
  row.meta = null;
  row.ts = 0; /* keep the chosen name */
  S.slotsConfirm = null;
  slotsWrite(list);
  toast("🗑️ " + slotNameOf(row) + " cleared.", "");
  return { ok: true };
}

/* ── logo chip ────────────────────────────────────────────────── */
var SLOT_SHAPES = ["circle", "square", "star", "roundel"];
var SLOT_SHAPE_LABELS = { circle: "Circle", square: "Square", star: "Star", roundel: "Roundel" };
var SLOT_BGS = ["gold", "pink", "blue", "red", "mint"];
var SLOT_BG = { gold: "#f5c518", pink: "#ef6f9f", blue: "#22b8d4", red: "#d43e12", mint: "#6fd7b2" };
var SLOT_TEXTS = ["dark", "light"];
var SLOT_TEXT = { dark: "#1b1b1f", light: "#ffffff" };
var SLOT_FRAME_KEYS = ["classic", "gold", "polaroid", "none"];
var SLOT_FRAME_LABELS = { classic: "Classic", gold: "Gold frame", polaroid: "Polaroid", none: "None" };

function logoInitial() {
  var n = (S && S.studio && S.studio.name) ? String(S.studio.name).trim() : "";
  var c = n ? n.charAt(0).toUpperCase() : "";
  return c || "S";
}
function logoChipHTML(px) {
  slotsEnsure();
  var L = (S && S.slots && S.slots.logo) || { shape: "circle", bg: "gold", text: "dark" };
  var size = px || 44;
  var bg = SLOT_BG[L.bg] || SLOT_BG.gold;
  var col = SLOT_TEXT[L.text] || SLOT_TEXT.dark;
  var shape = SLOT_SHAPES.indexOf(L.shape) >= 0 ? L.shape : "circle";
  var st = "display:inline-block;width:" + size + "px;height:" + size + "px;line-height:" + size
    + "px;text-align:center;font-size:" + Math.round(size * 0.45)
    + "px;font-weight:800;background:" + bg + ";color:" + col + ";";
  if (shape === "circle") st += "border-radius:50%;";
  else if (shape === "square") st += "border-radius:4px;";
  else if (shape === "roundel") st += "border-radius:50%;box-shadow:inset 0 0 0 2px " + (L.text === "dark" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.6)") + ";";
  else st += "clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);";
  return '<span class="logo-chip" style="' + st + '">' + esc(logoInitial()) + "</span>";
}

/* ── seg helper (meta.js metaSegHTML shape) ───────────────────── */
function slotsSeg(action, keys, labels, cur) {
  var html = '<div class="seg">', i;
  for (i = 0; i < keys.length; i++) {
    var lab = labels ? labels[keys[i]] : keys[i];
    html += '<button class="' + (cur === keys[i] ? "on" : "") + '" data-action="' + action + '" data-key="' + keys[i] + '">' + lab + "</button>";
  }
  return html + "</div>";
}

/* ── desk: Save slots ─────────────────────────────────────────── */
function slotCardHTML(row) {
  var id = row.id, renaming = S && S.slotsRenaming === id;
  var armed = S && S.slotsConfirm === id && !!row.snapshot;
  var html = '<div class="card">';
  if (renaming) {
    html += '<div class="field-label">Rename slot ' + id + '</div>'
      + '<input class="text-input" id="slotName" maxlength="24" value="' + esc(row.name || ("Slot " + id)) + '">'
      + '<div class="btnrow"><button class="btn primary sm" data-action="slot-rename-confirm" data-id="' + id + '">Save name</button>'
      + '<button class="btn sm" data-action="slot-rename" data-id="' + id + '">Cancel</button></div>';
  } else {
    html += '<div class="statrow"><span class="k">💾 Slot ' + id + " — " + esc(slotNameOf(row)) + '</span><span class="v num">' + slotMetaText(row) + "</span></div>"
      + '<div class="btnrow">'
      + '<button class="btn sm" data-action="slot-save" data-id="' + id + '">Save current</button>'
      + '<button class="btn sm" data-action="slot-load" data-id="' + id + '"' + (row.snapshot ? "" : " disabled") + ">Load</button>"
      + '<button class="btn sm" data-action="slot-rename" data-id="' + id + '">Rename</button>'
      + '<button class="btn danger sm" data-action="slot-delete" data-id="' + id + '"' + (row.snapshot ? "" : " disabled") + ">" + (armed ? "Sure?" : "Delete") + "</button>"
      + "</div>";
  }
  return html + "</div>";
}
function slotsMgrDesk() {
  if (!S) return '<div class="card"><div class="empty"><span class="em">💾</span>Start a studio first — then this desk snapshots it.</div></div>';
  var list = slotsRead();
  var html = '<div data-slotsdesk="mgr"><div class="card">'
    + statrow("Save slots", SLOT_COUNT)
    + statrow("Current save", "Y" + S.studio.year + " · " + fm(S.studio.cash) + " · rep " + Math.round(S.studio.rep) + " · " + S.films.length + " films")
    + "</div>";
  for (var i = 0; i < list.length; i++) html += slotCardHTML(list[i]);
  html += '<div class="card"><div class="empty"><span class="em">📤</span>Need a text backup? Settings → Save &amp; load exports the same snapshot.</div></div>';
  return html + "</div>";
}

/* ── desk: Studio logo (+ poster frame) ───────────────────────── */
function slotsLogoDesk() {
  if (!S) return '<div class="card"><div class="empty"><span class="em">🎨</span>Start a studio first — the monogram needs a name.</div></div>';
  slotsEnsure();
  var L = S.slots.logo;
  var frame = (typeof PREFS !== "undefined" && PREFS && PREFS.frame) || "classic";
  return '<div data-slotsdesk="logo">'
    + '<div class="card">' + statrow("Logo chip", logoChipHTML(40))
    + statrow("Monogram of", esc(S.studio.name)) + "</div>"
    + '<div class="sechead"><h2>Shape</h2></div><div class="card">' + slotsSeg("slot-logo-shape", SLOT_SHAPES, SLOT_SHAPE_LABELS, L.shape) + "</div>"
    + '<div class="sechead"><h2>Background</h2></div><div class="card">' + slotsSeg("slot-logo-bg", SLOT_BGS, null, L.bg) + "</div>"
    + '<div class="sechead"><h2>Text</h2></div><div class="card">' + slotsSeg("slot-logo-text", SLOT_TEXTS, null, L.text) + "</div>"
    + '<div class="sechead"><h2>Poster frame</h2></div><div class="card">' + slotsSeg("slot-frame", SLOT_FRAME_KEYS, SLOT_FRAME_LABELS, frame) + "</div>";
}

/* ── start-screen picker (ui.js start view calls slotPickerHTML) ─ */
function slotPickerHTML() {
  var list = slotsRead();
  var html = '<div data-slotpicker="1">', any = false, i;
  for (i = 0; i < list.length; i++) {
    var row = list[i];
    if (!row.snapshot) continue;
    any = true;
    html += '<div class="statrow"><span class="k">💾 ' + esc(slotNameOf(row)) + " — " + esc(slotMetaText(row)) + '</span><button class="btn sm" data-action="slot-load" data-id="' + row.id + '">Load</button></div>';
  }
  if (!any) html += '<div class="empty"><span class="em">💾</span>No saved studios yet — save one from the Save slots desk.</div>';
  return html + "</div>";
}

/* ── action delegation (ui.js onAction calls slotsAction) ─────── */
function slotsCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function slotsAction(a, elx) {
  if (typeof a !== "string" || a.indexOf("slot-") !== 0) return false;
  var id = elx && elx.getAttribute ? parseInt(elx.getAttribute("data-id"), 10) || 0 : 0;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var r;
  if (a === "slot-save") { r = slotSave(id); if (r.err) { toast(r.err, "bad"); return true; } slotsCommit(); return true; }
  if (a === "slot-load") { r = slotLoad(id); if (r.err) toast(r.err, "bad"); return true; }
  if (a === "slot-rename") { r = slotRename(id); if (r.err) { toast(r.err, "bad"); return true; } if (typeof render === "function") render(); return true; }
  if (a === "slot-rename-confirm") { r = slotRenameConfirm(id); if (r.err) { toast(r.err, "bad"); return true; } slotsCommit(); return true; }
  if (a === "slot-delete") { r = slotDelete(id); if (r.err) { toast(r.err, "bad"); return true; } slotsCommit(); return true; }
  if (a === "slot-logo-shape" || a === "slot-logo-bg" || a === "slot-logo-text") {
    if (!S) { toast("Start a studio first.", "bad"); return true; }
    slotsEnsure();
    var prop = a === "slot-logo-shape" ? "shape" : a === "slot-logo-bg" ? "bg" : "text";
    var valid = prop === "shape" ? SLOT_SHAPES : prop === "bg" ? SLOT_BGS : SLOT_TEXTS;
    if (valid.indexOf(key) < 0) { toast("Pick one of the options.", "bad"); return true; }
    S.slots.logo[prop] = key;
    slotsCommit();
    return true;
  }
  if (a === "slot-frame") {
    if (SLOT_FRAME_KEYS.indexOf(key) < 0) { toast("Pick one of the frames.", "bad"); return true; }
    if (typeof setPref === "function") setPref("frame", key);
    if (typeof render === "function") render();
    return true;
  }
  return false;
}

/* ── engine hook: no weekly cash from slots (uniform zero stub) ── */
function forecastAdjust_slots() { return 0; }

var SLOTS_DESKS = [
  { id: "slots-mgr", group: "Slots", icon: "💾", name: "Save slots", desc: "Six snapshots of the whole save — save, load, rename, delete.", render: slotsMgrDesk },
  { id: "slots-logo", group: "Slots", icon: "🎨", name: "Studio logo", desc: "Monogram chip — shape and colors — plus the poster frame style.", render: slotsLogoDesk }
];

/* Wiring lives in ui.js (SLOTS_DESKS + slotPickerHTML already collected; onAction needs
   its slotsAction bridge line) — no self-wiring. Export stays in ui.js sheetExport. */
