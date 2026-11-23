/* test/save-quota.mjs — a failed save must report failure, and a partial write
 * must never leave the autosave key and the slot/meta keys disagreeing.
 *
 * Bug it pins down: writeSaveKeys() swallowed every inner setItem error and
 * returned true, so saveGame() showed "💾 Saved" while nothing had been written.
 *
 * The stub models a real quota: setItem throws when the store's total size
 * would exceed `quotaChars`. That is closer to browser behaviour than "every
 * write fails after N", and it lets a rollback (which re-writes a same-sized
 * value) actually succeed.
 *
 * Run: node test/save-quota.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const SHIM = `
if (typeof global.window === "undefined") global.window = global;
/* Quota-budgeted localStorage stand-in. */
global.localStorage = (function(){
  var store = {};
  var api = {
    quotaChars: Infinity,
    size: function(){ var n = 0; for (var k in store) n += k.length + String(store[k]).length; return n; },
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null; },
    setItem: function(k,v){
      v = String(v);
      var had = Object.prototype.hasOwnProperty.call(store,k);
      var delta = (k.length + v.length) - (had ? k.length + String(store[k]).length : 0);
      if (api.size() + delta > api.quotaChars) {
        var e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e;
      }
      store[k] = v;
    },
    removeItem: function(k){ delete store[k]; },
    key: function(i){ var ks = Object.keys(store); return i >= 0 && i < ks.length ? ks[i] : null; },
    reset: function(){ store = {}; api.quotaChars = Infinity; },
    dump: function(){ return Object.assign({}, store); }
  };
  Object.defineProperty(api, "length", { get: function(){ return Object.keys(store).length; } });
  return api;
})();
if (typeof global.DATA === "undefined") global.DATA = {};
`;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

const bundle = SHIM + "\n" + ["data.js", "engine.js"].map(read).join("\n;\n") + "\n;\n" + `
global.__BOW = { writeSaveKeys: writeSaveKeys, saveGame: saveGame, newGame: newGame,
  get G(){ return G; }, set G(v){ G = v; }, SAVE_KEY: SAVE_KEY, localStorage: global.localStorage };
`;

const OUT = path.join(HERE, ".save-quota-generated.cjs");
fs.writeFileSync(OUT, bundle);
let BOW;
try {
  const { pathToFileURL } = await import("node:url");
  await import(pathToFileURL(OUT).href);
  BOW = globalThis.__BOW;
} finally {
  try { fs.unlinkSync(OUT); } catch {}
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const LS = BOW.localStorage;

/* 1 — the happy path still succeeds. */
LS.reset();
check("a normal write reports success", BOW.writeSaveKeys([["k1", "v1"]]) === true);
check("a normal write lands", LS.getItem("k1") === "v1");

/* 2 — a store that cannot take the payload reports failure (the original bug returned true). */
LS.reset();
LS.quotaChars = 0;
const okFull = BOW.writeSaveKeys([["bow_save", "0123456789"], ["bow_slot1", "0123456789"]]);
LS.quotaChars = Infinity;
check("a write that cannot fit reports failure", okFull === false, "returned " + okFull);
check("a write that cannot fit leaves no key behind",
  LS.getItem("bow_save") === null && LS.getItem("bow_slot1") === null);

/* 3 — a partial failure must be rolled back, not half-applied.
   Seed an existing save, then allow only enough room for the first pair. */
LS.reset();
LS.setItem("bow_save", "OLDVALUE");
const roomForFirst = LS.size() + 16;      /* fits the first "NEWVALUE..." write, not the second */
LS.quotaChars = roomForFirst;
const okPartial = BOW.writeSaveKeys([["bow_save", "NEWVALUE"], ["bow_slot1", "NEWVALUE"]]);
LS.quotaChars = Infinity;
check("a partial write reports failure", okPartial === false, "returned " + okPartial);
check("a partial write restores the key it had already overwritten",
  LS.getItem("bow_save") === "OLDVALUE", "bow_save = " + JSON.stringify(LS.getItem("bow_save")));
check("a partial write does not leave the failing key half-set",
  LS.getItem("bow_slot1") === null);

/* 4 — saveGame must not leave an autosave behind when the store is full. */
LS.reset();
BOW.newGame("indie", "Quota Lab", { scenario: "standard", difficulty: "normal" });
BOW.G._noSave = false;
LS.reset();                       /* drop whatever newGame wrote, then starve the store */
LS.quotaChars = 0;
BOW.saveGame();
LS.quotaChars = Infinity;
check("saveGame writes nothing when storage is full",
  LS.getItem(BOW.SAVE_KEY) === null, "SAVE_KEY = " + JSON.stringify(LS.getItem(BOW.SAVE_KEY)).slice(0, 40));

/* 5 — and a real save still writes everything, consistently. */
LS.reset();
BOW.saveGame();
const raw = LS.getItem(BOW.SAVE_KEY);
const slotRaw = LS.getItem("bow_slot" + (BOW.G.slot || 1));
let parsed = null;
try { parsed = JSON.parse(raw); } catch {}
check("saveGame writes the autosave key when storage works", !!raw);
check("the written save round-trips as an object", !!(parsed && parsed.studio),
  parsed ? "week " + parsed.week : "unparseable");
check("the autosave and the active slot hold the same save", !!raw && raw === slotRaw,
  raw === slotRaw ? "identical" : "MISMATCH");

if (failures) { console.error("❌ save-quota: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ save-quota: all " + checks + " checks passed");
