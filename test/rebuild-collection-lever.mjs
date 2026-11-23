/* Rebuild collection-lever harness (#1 in the game/ build the APK ships).
   Runs game/data.js + game/engine.js + game/box-office-collection-engine.js in a
   VM sandbox with a stubbed localStorage, then plays one theatrical week twice:
   lever off vs lever on (pushScreens level 3 => grossMultiplier 1.42).
   Asserts the domestic gross grows by the CONFIGURED multiplier, not its square.

   The bug this pins: engine.js's tickTheatrical multiplied gross by
   grossMultiplier, then BoxOfficeCollection.tick() read that already-multiplied
   figure back out of f.weekly and added base*(m-1) on top, netting m^2 (2.02x
   for a 1.42x lever) and paying rentals twice. Removing the engine-side multiply
   makes tick() the single payer.

   Prints one line per check; exits non-zero on failure. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
}

const mem = {};
const ctx = vm.createContext({
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
  Number, String, Object, Array,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  }
});
ctx.globalThis = ctx;
for (const f of ["data.js", "engine.js", "box-office-collection-engine.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}

/* Deterministic RNG: both arms must see identical inputs or the ratio measures
   noise (engine.js calls Math.random() directly in star/market generation). */
function mk(seed) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 1e6) / 1e6; };
}

function runArm(leverOn) {
  ctx.Math.random = mk(0x2545f491);
  const S = ctx.newState("Lever Probe", ctx.ORIGINS[0].id, "std");
  ctx.S = S;
  S.studio.cash = 500;
  S.econ = { box: 1 };

  const f = {
    id: "fprobe", title: "Probe Picture", genre: ctx.GENRES[0].id,
    opening: 100, legs: 2.5, decay: 1 - 1 / 2.5,
    weeksOut: 1, dom: 0, weekly: [], status: "run",
    releaseWeek: 1, mkt: 20, window: 45,
  };
  S.films = [f];

  const BO = ctx.BoxOfficeCollection;
  const st = BO.state(S);
  st.bump.screens = 0;
  st.corridor.active = false;
  st.bump.priceMode = "standard";
  st.bump[f.id] = leverOn ? { pushScreens: { level: 3, weeksLeft: 9 } } : {};

  const m = BO.grossMultiplier(f, S);
  const before = f.dom;
  ctx.tickTheatrical();
  const afterTick = f.dom;
  const cashAfterTick = S.studio.cash;
  BO.tick(S);
  return { m, before, afterTick, afterAll: f.dom, cashAfterTick, cashAll: S.studio.cash };
}

const off = runArm(false);
const on = runArm(true);

const growthOff = off.afterAll - off.before;
const growthOn = on.afterAll - on.before;
const ratio = growthOn / Math.max(growthOff, 1e-9);

check("the lever actually raises the multiplier", on.m > 1.2, "m=" + on.m.toFixed(4));
check("the engine no longer multiplies gross itself (single payer)",
  Math.abs((on.afterTick - on.before) - growthOff) < 0.51,
  "tickTheatrical dom delta=" + (on.afterTick - on.before).toFixed(3) + " vs baseline " + growthOff.toFixed(3));
check("dom tracks the configured multiplier, not its square",
  Math.abs(ratio - on.m) <= 0.02,
  "ratio=" + ratio.toFixed(4) + " m=" + on.m.toFixed(4) + " m^2=" + (on.m * on.m).toFixed(4));
check("the ratio is clearly not the squared value",
  Math.abs(ratio - on.m * on.m) > 0.1,
  "|ratio-m^2|=" + Math.abs(ratio - on.m * on.m).toFixed(4));

console.log("");
if (failures) { console.error(failures + " check(s) FAILED"); process.exit(1); }
console.log("collection-lever-rebuild: all " + checks + " checks passed");
