/* test/deepfake-timer.mjs — closing the deepfake drill must stop its clock.
 *
 * Bug it pins down: deepfakeModal() starts a 1s setInterval that decrements a
 * countdown. submit() and dfDefer clear it, but a manual dismissal (✕ button,
 * backdrop click, Escape) called closeModal() directly and left the interval
 * running for the rest of the session — and on expiry it still called
 * resolveDeepfake() for an event the player had walked away from.
 *
 * The test opens the real modal in jsdom, closes it by each of the three manual
 * routes, then waits past the original deadline and asserts:
 *   - no further timer ticks,
 *   - no resolveDeepfake() call,
 *   - the modal is gone.
 *
 * Run: node test/deepfake-timer.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch (e) {
  console.error("❌ deepfake-timer: jsdom is required. Run: npm install");
  process.exit(1);
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

/* Load ui.js into a fresh jsdom with a controllable interval clock. */
function makeApp() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>
    <div id="saveIndicator"></div>
  </body></html>`, { url: "https://example.test/", runScripts: "outside-only" });

  const win = dom.window;
  /* ui.js has a DOMContentLoaded handler that expects the full app shell; on a
     minimal page it throws somewhere harmless. Keep the console quiet so a real
     failure is not lost in the noise. */
  win.addEventListener("error", (e) => e.preventDefault());
  const origErr = win.console.error;
  win.console.error = function () { /* swallow load-time shell noise */ };
  const intervals = new Map();
  let nextId = 1;

  /* Replace setInterval/clearInterval so the test can see and drive every timer
     without waiting in real time. */
  win.setInterval = (fn, ms) => { const id = nextId++; intervals.set(id, { fn, ms }); return id; };
  win.clearInterval = (id) => { intervals.delete(id); };
  win.setTimeout = (fn, ms) => { const id = nextId++; intervals.set(id, { fn, ms, once: true }); return id; };
  win.clearTimeout = (id) => { intervals.delete(id); };

  const state = { resolved: [], toasts: [], saves: 0, beeps: [] };
  win.beep = (k) => state.toasts.push("beep:" + k);
  win.toast = (m) => state.toasts.push(m);
  win.saveGame = () => { state.saves++; };
  win.log = () => {};
  win.render = () => {};
  win.closeModal = null;   /* ui.js defines its own */

  const SHIM = `
    if (typeof global.DATA === "undefined") global.DATA = {};
    global.window = global;
  `;
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "ui.js"].map(read).join("\n;\n") + "\n;\n" + `
  global.__DF = {
    deepfakeModal: (typeof deepfakeModal === "function") ? deepfakeModal : null,
    get G(){ return G; }, set G(v){ G = v; },
    newGame: (typeof newGame === "function") ? newGame : null,
    deepfakeDifficulty: (typeof deepfakeDifficulty === "function") ? deepfakeDifficulty : null
  };
  `;
  const OUT = path.join(HERE, ".deepfake-generated.cjs");
  fs.writeFileSync(OUT, bundle);

  /* Give the bundle the same window globals by evaluating it in the window. */
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}

  /* Wrap resolveDeepfake AFTER the bundle defines it — assigning it before load
     would simply be replaced by the real engine function, making every
     "was it resolved?" assertion vacuous. Same for toast(): ui.js declares its
     own at file scope, overwriting the shim above during eval. */
  const realResolve = win.resolveDeepfake;
  if (typeof realResolve === "function") {
    win.resolveDeepfake = function (correct, opts) {
      state.resolved.push({ correct, opts });
      return realResolve.apply(this, arguments);
    };
  }
  const realToast = win.toast;
  if (typeof realToast === "function") {
    win.toast = function (m) { state.toasts.push(String(m)); return realToast.apply(this, arguments); };
  }

  return { win, intervals, state };
}

/* The manual-close routes openModal wires up. */
const ROUTES = ["x-button", "backdrop", "escape"];

function runRoute(route) {
  const { win, intervals, state } = makeApp();
  const DF = win.__DF;
  if (!DF || !DF.deepfakeModal) return { error: "deepfakeModal not exported" };

  DF.newGame("major", "DF Lab", { scenario: "standard", difficulty: "normal" });
  const G = DF.G;
  G._noSave = true;
  const tiers = DF.deepfakeDifficulty ? DF.deepfakeDifficulty() : [{ frames: 4, time: 8 }];
  G.pendingDeepfake = { talentId: "t1", week: G.week, tier: 0 };

  /* Identify the drill's own timer by what appeared during this call, so a
     pre-existing global interval (the auto-week ticker) is not counted. */
  const before = new Set(intervals.keys());
  DF.deepfakeModal();
  const drillTimers = Array.from(intervals.keys()).filter(id => !before.has(id));

  const root = win.document.querySelector("#modalRoot");
  const veil = root && root.querySelector(".modal-veil");
  if (!veil) return { error: "modal did not open" };
  if (!drillTimers.length) return { error: "no timer was started by the drill" };

  /* Close by the chosen manual route. */
  if (route === "x-button") {
    const x = veil.querySelector(".modal-x");
    if (!x) return { error: "no ✕ button" };
    x.onclick();
  } else if (route === "backdrop") {
    /* openModal listens on the veil and checks e.target === veil */
    const ev = new win.MouseEvent("click", { bubbles: true });
    Object.defineProperty(ev, "target", { value: veil });
    veil.dispatchEvent(ev);
  } else if (route === "escape") {
    const ev = new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    veil.dispatchEvent(ev);
  }

  const stillOpen = !!win.document.querySelector("#modalRoot .modal-veil");
  const drillStillArmed = drillTimers.filter(id => intervals.has(id));

  /* Now "wait" past the original deadline: fire only the drill's surviving
     timers many times over. A leaked interval will tick; a cleared one will not. */
  let ticks = 0;
  for (let round = 0; round < 40; round++) {
    const live = drillTimers.filter(id => intervals.has(id));
    if (!live.length) break;
    live.forEach(id => { ticks++; try { intervals.get(id).fn(); } catch (e) {} });
  }

  return {
    stillOpen,
    drillTimers: drillTimers.length,
    drillStillArmed: drillStillArmed.length,
    ticksAfterClose: ticks,
    resolved: state.resolved.length,
    pending: !!G.pendingDeepfake
  };
}

console.log("── manual dismissal must stop the clock ──────────────────");
for (const route of ROUTES) {
  const r = runRoute(route);
  if (r.error) { check(route + ": modal opened and started a timer", false, r.error); continue; }
  check(route + ": the dialog actually opened with a running timer", r.drillTimers > 0, r.drillTimers + " timer(s)");
  check(route + ": closing removes the dialog", r.stillOpen === false);
  check(route + ": closing clears the countdown interval", r.drillStillArmed === 0,
    r.drillStillArmed + " still armed");
  check(route + ": no further ticks after close", r.ticksAfterClose === 0,
    r.ticksAfterClose + " tick(s) fired");
  check(route + ": the abandoned event is not auto-resolved", r.resolved === 0,
    r.resolved + " resolveDeepfake call(s)");
}

/* Control: an untouched dialog must keep its clock armed and still be able to
   submit. This proves onClose did not disarm the timer on the normal path. */
console.log("── control: an untouched dialog keeps its clock ──────────");
{
  const { win, intervals, state } = makeApp();
  const DF = win.__DF;
  DF.newGame("major", "DF Lab", { scenario: "standard", difficulty: "normal" });
  DF.G._noSave = true;
  DF.G.pendingDeepfake = { talentId: "t2", week: DF.G.week, tier: 0 };

  const before = new Set(intervals.keys());
  DF.deepfakeModal();
  const drillTimers = Array.from(intervals.keys()).filter(id => !before.has(id));
  check("an untouched drill starts its countdown", drillTimers.length === 1, drillTimers.length + " timer(s)");

  /* Let several seconds pass without closing. */
  for (let i = 0; i < 3; i++) {
    drillTimers.filter(id => intervals.has(id)).forEach(id => { try { intervals.get(id).fn(); } catch (e) {} });
  }
  check("the countdown stays armed while the dialog is open",
    drillTimers.every(id => intervals.has(id)), "armed");
  check("the countdown has not resolved anything on its own", state.resolved.length === 0,
    state.resolved.length + " resolution(s)");

  /* Submitting by hand must still resolve — the normal success path. */
  const solve = win.document.querySelector("#dfSolve");
  check("the Submit button is present", !!solve);
  if (solve) {
    solve.onclick();
    check("manual submission still resolves the event", state.resolved.length === 1,
      state.resolved.length + " resolution(s)");
    check("manual submission clears the countdown", drillTimers.every(id => !intervals.has(id)),
      drillTimers.filter(id => intervals.has(id)).length + " armed");
    check("manual submission clears the pending event", !DF.G.pendingDeepfake);
  }
}

/* v48 fix — expiry counts as a miss. The interval branch used to set
   finished=true before calling submit(), whose first statement is
   `if (finished) return;`, so the timeout resolution was a dead branch and the
   modal hung with a stopped timer until the engine's 2-week fallback fired.
   The fix lets submit() own the finish flags. This test fires the countdown
   past zero on an untouched dialog and asserts the miss path actually runs:
   resolveDeepfake(false), the pending event cleared, the interval cleared,
   the dialog closed, and the "out of time" toast shown. */
console.log("── expiry: clock running out resolves as a miss ──────────");
{
  const { win, intervals, state } = makeApp();
  const DF = win.__DF;
  DF.newGame("major", "DF Lab", { scenario: "standard", difficulty: "normal" });
  DF.G._noSave = true;
  DF.G.pendingDeepfake = { talentId: "t3", week: DF.G.week, tier: 0 };

  const before = new Set(intervals.keys());
  DF.deepfakeModal();
  const drillTimers = Array.from(intervals.keys()).filter(id => !before.has(id));

  /* totalTime = max(16, cfg.time*2) — tier 0 is 14s → 28 ticks. Fire well past
     it, one second per tick, so a correct fix breaks out on the 29th. */
  for (let i = 0; i < 32; i++) {
    const live = drillTimers.filter(id => intervals.has(id));
    if (!live.length) break;
    live.forEach(id => { try { intervals.get(id).fn(); } catch (e) {} });
  }

  const timedOut = state.resolved.find(r => r && r.opts && r.opts.timedOut);
  check("expiry resolves the event exactly once", state.resolved.length === 1,
    state.resolved.length + " resolution(s)");
  check("expiry records a miss (resolveDeepfake(false))",
    !!state.resolved.length && state.resolved[0].correct === false,
    "correct=" + (state.resolved[0] && state.resolved[0].correct));
  check("expiry resolves with the drill's tier",
    !!state.resolved.length && state.resolved[0].opts && state.resolved[0].opts.tier === 0,
    JSON.stringify(state.resolved[0] && state.resolved[0].opts));
  check("expiry clears the pending event", !DF.G.pendingDeepfake,
    DF.G.pendingDeepfake ? "pendingDeepfake still set" : "cleared");
  check("expiry stops the countdown", drillTimers.every(id => !intervals.has(id)),
    drillTimers.filter(id => intervals.has(id)).length + " still armed");
  check("expiry closes the dialog", !win.document.querySelector("#modalRoot .modal-veil"));
  check("expiry explains itself with a toast",
    state.toasts.some(m => typeof m === "string" && /Out of time/.test(m)),
    JSON.stringify(state.toasts.filter(m => typeof m === "string")).slice(0, 120));
}

if (failures) { console.error("❌ deepfake-timer: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ deepfake-timer: all " + checks + " checks passed");
