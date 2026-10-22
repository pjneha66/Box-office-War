/* ═════════════════════════════════════════════════════════════════════════
   SANDBOX-AUDIT.MJS — Complete Mac-Local Sandbox & 2D Engine Test Suite
   Runs all game systems, sandbox modes, 2D Canvas engine, and mobile events
   Zero Emojis Policy strictly enforced.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

console.log("[SANDBOX AUDIT] Initializing Sandbox DOM and engine harness...");

const rawHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const inlinedHtml = rawHtml
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g, (m, file) => {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) {
      return "<script>" + fs.readFileSync(full, "utf8") + "<\/script>";
    }
    return m;
  })
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/, "");

const capturedErrors = [];
const capturedWarnings = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", e => {
  if (e && e.message && e.message.includes("Not implemented: window.scrollTo")) return;
  capturedErrors.push("jsdomError: " + (e ? e.message : String(e)));
});
virtualConsole.on("error", (...a) => capturedErrors.push("console.error: " + a.join(" ")));
virtualConsole.on("warn", (...a) => capturedWarnings.push("console.warn: " + a.join(" ")));

const dom = new JSDOM(inlinedHtml, {
  runScripts: "dangerously",
  url: "http://localhost/",
  pretendToBeVisual: true,
  virtualConsole
});

const { window } = dom;
window.scrollTo = () => {};
window.AudioContext = undefined;
window.webkitAudioContext = undefined;

// Mock 2D Canvas Context for complete headless execution
function createMockCanvasContext() {
  return {
    canvas: { width: 800, height: 600 },
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fill: () => {},
    stroke: () => {},
    drawImage: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (txt) => ({ width: (txt || "").length * 8 }),
    setLineDash: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    shadowColor: "",
    shadowBlur: 0,
    globalAlpha: 1.0,
    font: "12px sans-serif",
    textAlign: "left",
    textBaseline: "top"
  };
}

const origGetContext = window.HTMLCanvasElement.prototype.getContext;
window.HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === "2d") {
    if (!this._mockCtx) this._mockCtx = createMockCanvasContext();
    this._mockCtx.canvas = this;
    return this._mockCtx;
  }
  return origGetContext ? origGetContext.apply(this, arguments) : null;
};

// Mock Image onload
const OrigImage = window.Image;
window.Image = function() {
  const img = new OrigImage();
  img.width = 64;
  img.height = 64;
  setTimeout(() => {
    try {
      Object.defineProperty(img, "complete", { value: true, configurable: true });
    } catch (e) {}
    if (typeof img.onload === "function") img.onload();
  }, 5);
  return img;
};

// Dispatch DOMContentLoaded
window.document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));

// Synchronous render for test determinism
window.eval("render = function(){ _renderImpl(); }");

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const click = el => {
  if (!el) throw new Error("Click target missing");
  el.dispatchEvent(new window.Event("click", { bubbles: true }));
};

let stepCount = 0;
function testStep(name, fn) {
  stepCount++;
  try {
    fn();
    console.log("  [PASS] Step " + stepCount + ": " + name);
  } catch (err) {
    console.error("  [FAIL] Step " + stepCount + ": " + name);
    console.error("         Error: " + (err ? err.message : String(err)));
    capturedErrors.push("Test step failed: " + name + " -> " + (err ? err.message : String(err)));
  }
}

// ── STEP 1: Boot into Creative Sandbox Mode ──
testStep("Boot start screen and configure Creative Sandbox mode", () => {
  const chk = $("#chkSandbox");
  if (chk) {
    chk.checked = true;
    chk.dispatchEvent(new window.Event("change", { bubbles: true }));
  }
  window.eval("SEL.sandbox = true;");
  $("#studioName").value = "Sandbox Studios Prime";
  click($("#btnStart"));
  
  const G = window.eval("G");
  if (!G) throw new Error("Game state G not initialized");
  if (!G.sandbox) throw new Error("G.sandbox flag is not true");
  if (G.studio.name !== "Sandbox Studios Prime") throw new Error("Studio name mismatch: " + G.studio.name);
});

// ── STEP 2: Verify the live lot is mounted and reachable ──
// v33: the career opens on the Director's Office (Dashboard); the 2D lot is a
// Studio destination rather than the landing screen.
testStep("Verify the 2D Studio Lot is mounted and reachable from Studio", () => {
  const TAB = window.eval("TAB");
  if (TAB !== "dashboard") throw new Error("Default TAB is not dashboard, found: " + TAB);
  window.eval("switchTab('studiolot')");
  if (window.eval("TAB") !== "studiolot") throw new Error("Studio must be able to open the live 2D lot");
  const container = $("#studiolotContainer");
  if (!container) throw new Error("#studiolotContainer element missing from DOM");
  const canvas = $("#studioLotCanvas");
  if (!canvas) throw new Error("#studioLotCanvas missing inside container");
  const lot = window.eval("StudioLotBridge.getLotState()");
  if (!lot || !lot.buildings) throw new Error("StudioLot state not loaded");
  if (lot.buildings.length < 1) throw new Error("Default lot buildings empty");
});

// ── STEP 3: Test Building Placements in 2D Lot ──
testStep("Test building placement in 2D Lot engine (all 6 types)", () => {
  const buildingTypes = [
    { type: "soundstage", x: 12, y: 3 },
    { type: "virtual_led", x: 12, y: 7 },
    { type: "post_suite", x: 8, y: 12 },
    { type: "writers_bungalow", x: 8, y: 15 },
    { type: "cinema_theater", x: 3, y: 13 }, // y=12 blocks the starter post suite entrance,
    { type: "backlot", x: 3, y: 17 } // keep cinema entrance at y=16 clear
  ];

  for (const b of buildingTypes) {
    const res = window.eval(`StudioLotBridge.placeBuilding("${b.type}", ${b.x}, ${b.y})`);
    if (!res || !res.ok) throw new Error("Failed to place " + b.type + ": " + (res ? res.err : "null"));
  }

  const lot = window.eval("StudioLotBridge.getLotState()");
  if (lot.buildings.length < 7) throw new Error("Expected at least 7 buildings after placements, got: " + lot.buildings.length);
});

// ── STEP 4: Test Directing Minigame and Tier Upgrade ──
testStep("Test directing scene minigame and building tier upgrade", () => {
  const lot = window.eval("StudioLotBridge.getLotState()");
  const targetBld = lot.buildings[0];
  if (!targetBld) throw new Error("No building to test");

  // Upgrade
  const oldTier = targetBld.tier;
  const newTier = window.eval(`StudioLotBridge.getEngine().upgrade_building(${targetBld.id})`);
  if (newTier !== oldTier + 1) throw new Error("Tier upgrade failed, expected " + (oldTier + 1) + " got " + newTier);

  // Directing scene
  window.eval(`StudioLotBridge.getEngine().start_directing(${targetBld.id})`);
  const activeLot = window.eval("StudioLotBridge.getLotState()");
  const directedBld = activeLot.buildings.find(b => b.id === targetBld.id);
  if (!directedBld || !directedBld.filming_active) throw new Error("Building did not enter filming active state");

  // Advance directing
  window.eval(`StudioLotBridge.getEngine().advance_directing()`);
});

// ── STEP 5: Test Touch, Mobile Viewport Resize, and Controls ──
testStep("Test 2D viewport camera zoom, center, and mobile touch events", () => {
  const canvas = $("#studioLotCanvas");
  if (!canvas) throw new Error("Canvas missing");

  // Touch start and drag
  canvas.dispatchEvent(new window.TouchEvent("touchstart", {
    touches: [{ clientX: 100, clientY: 100 }]
  }));
  canvas.dispatchEvent(new window.TouchEvent("touchmove", {
    touches: [{ clientX: 150, clientY: 160 }]
  }));
  canvas.dispatchEvent(new window.TouchEvent("touchend", { touches: [] }));

  // Pinch zoom touch simulation (2 fingers)
  canvas.dispatchEvent(new window.TouchEvent("touchstart", {
    touches: [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 200 }
    ]
  }));
  canvas.dispatchEvent(new window.TouchEvent("touchmove", {
    touches: [
      { clientX: 80, clientY: 80 },
      { clientX: 250, clientY: 250 }
    ]
  }));
  canvas.dispatchEvent(new window.TouchEvent("touchend", { touches: [] }));

  // Control buttons
  click($("#btnZoomIn"));
  click($("#btnZoomOut"));
  click($("#btnResetView"));
  click($("#btnFocusShoot"));

  // Mobile resize simulation (360x740 Android viewport)
  window.innerWidth = 360;
  window.innerHeight = 740;
  window.dispatchEvent(new window.Event("resize"));
  if (canvas.width <= 0 || canvas.height <= 0) throw new Error("Canvas dimensions invalid after mobile resize");
});

// ── STEP 6: Test All Navigation Tabs in Sandbox Mode ──
testStep("Iterate and render all primary tabs in sandbox mode", () => {
  const tabs = [
    "studiolot", "dashboard", "studio", "develop", "productions",
    "boxoffice", "fans", "ott", "live", "empire", "library",
    "games", "finance", "notifications"
  ];

  for (const t of tabs) {
    window.eval(`switchTab("${t}")`);
    const viewHtml = $("#view").innerHTML;
    if (!viewHtml || viewHtml.trim() === "") throw new Error("Tab '" + t + "' rendered an empty view");
    if (viewHtml.includes("Render boundary caught error")) {
      throw new Error("Tab '" + t + "' triggered a render crash error boundary");
    }
  }
});

// ── STEP 7: Test Custom Sandbox Creator Modal ──
testStep("Test Custom Sandbox Modal (custom talent, rival, franchise, script)", () => {
  window.eval("openCustomSandboxModal()");
  const inner = $("#sandboxModalInner");
  if (!inner) throw new Error("#sandboxModalInner missing when opening sandbox modal");

  // Create custom actor (default tab 'talent')
  $("#cs_name").value = "Aria Starlight";
  $("#cs_kind").value = "actor";
  $("#cs_power").value = "5";
  $("#cs_skill").value = "95";
  click($("#btnSaveTalent"));

  // Create custom rival (switch to 'rival' tab)
  click(inner.querySelector("[data-stab='rival']"));
  $("#cr_name").value = "Quantum Pictures";
  $("#cr_style").value = "tentpole";
  $("#cr_cash").value = "800";
  click($("#btnSaveRival"));

  // Create custom franchise (switch to 'franchise' tab)
  click(inner.querySelector("[data-stab='franchise']"));
  $("#cfr_name").value = "Chrono Shifter";
  $("#cfr_genre").value = "scifi";
  $("#cfr_lore").value = "Time travel cyberpunk universe";
  click($("#btnSaveFranchise"));

  // Create custom script idea (switch to 'idea' tab)
  click(inner.querySelector("[data-stab='idea']"));
  $("#cid_title").value = "Neon Horizon";
  $("#cid_genre").value = "scifi";
  $("#cid_scale").value = "tentpole";
  $("#cid_buzz").value = "90";
  click($("#btnSaveIdea"));

  // Verify objects exist in G
  const G = window.eval("G");
  const talent = G.talent.find(t => t.name === "Aria Starlight");
  if (!talent) throw new Error("Custom talent Aria Starlight not found in G.talent");
  const rival = G.rivals.find(r => r.name === "Quantum Pictures");
  if (!rival) throw new Error("Custom rival Quantum Pictures not found in G.rivals");
  const franchise = (G.franchises || []).find(f => f.name === "Chrono Shifter");
  if (!franchise) throw new Error("Custom franchise Chrono Shifter not found in G.franchises");
  const idea = (G.ideas || []).find(i => i.title === "Neon Horizon");
  if (!idea) throw new Error("Custom script idea Neon Horizon not found in G.ideas");

  click($(".modal-x") || $$("[onclick='closeModal()']").pop());
});

// ── STEP 8: Test Greenlight & Production with Custom Talent & 2D Lot ──
testStep("Greenlight film with custom talent and sync to 2D soundstage", () => {
  window.eval("switchTab('develop')");
  window.eval(`
    const customTalent = G.talent.find(t => t.name === "Aria Starlight");
    const proj = {
      id: 9991,
      title: "Neon Horizon Tentpole",
      genre: "scifi",
      budget: 85,
      directorId: G.talent.find(t => t.kind === "director")?.id || G.talent[0].id,
      cast: [customTalent.id],
      writerId: G.talent[0].id,
      quality: 82,
      progress: 0,
      phase: "production",
      targetWeeks: 12,
      weeksLeft: 12,
      releaseWeek: 0,
      ww: 0
    };
    G.projects = G.projects || [];
    G.projects.push(proj);
    StudioLotBridge.syncWithGameState(G);
  `);

  window.eval("switchTab('studiolot')");
  const lot = window.eval("StudioLotBridge.getLotState()");
  const activeFilming = lot.buildings.find(b => b.filming_active && b.active_title === "Neon Horizon Tentpole");
  if (!activeFilming) throw new Error("2D lot did not schedule active filming for new production");
});

// ── STEP 9: Advance 52 Weeks in Sandbox Mode Without Error ──
testStep("Advance 52 weeks in Sandbox Mode and verify no crash/bankruptcy", () => {
  for (let w = 1; w <= 52; w++) {
    window.eval("doWeek(1)");
    const G = window.eval("G");
    if (G.over) throw new Error("Sandbox mode triggered gameover on week " + w);
    if (isNaN(G.studio.cash)) throw new Error("Studio cash corrupted to NaN on week " + w);
    if (isNaN(G.studio.debt)) throw new Error("Studio debt corrupted to NaN on week " + w);
  }
  const finalWeek = window.eval("G.week");
  console.log("    Simulated 52 full weeks. Current game week: " + finalWeek);
});

// ── STEP 10: Check Error Logs & Summary ──
console.log("\n── SANDBOX AUDIT ERROR SUMMARY ──");
if (capturedErrors.length === 0) {
  console.log("[SUCCESS] 0 runtime errors detected across all sandbox tests.");
} else {
  console.error("[FAIL] Detected " + capturedErrors.length + " errors:");
  capturedErrors.forEach((e, i) => console.error("  " + (i + 1) + ". " + e));
  process.exit(1);
}

console.log("\nALL SANDBOX CHECKS PASSED [OK]");
process.exit(0);
