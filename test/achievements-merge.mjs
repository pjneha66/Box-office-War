/* Achievement-merge harness. Proves meta.js's allAchievements() actually picks up
   the *_ACHIEVEMENTS arrays published by the feature modules, that every id is
   unique across the whole game, and that every test() is defensive (no throw on a
   fresh save or on a half-populated one). A trophy that cannot be seen in the
   gallery is a bug: metaTrophyDesk() must render the merged list, so the count in
   its header must equal the merged length. */
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
  Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  },
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});

const FILES = ["data.js", "engine.js", "meta.js", "opsuite.js", "liveops.js", "mktblitz.js", "consolehw.js"];
for (const f of FILES) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;

C.newGame("Merge Test", "veteran");

/* ── the module arrays are actually visible to meta.js ─────────── */
const base = C.ACHIEVEMENTS.length;
const merged = C.allAchievements();
const moduleArrays = ["OPS_ACHIEVEMENTS", "LIVEOPS_ACHIEVEMENTS", "BLITZ_ACHIEVEMENTS", "CONSOLE_ACHIEVEMENTS"];

check("base ACHIEVEMENTS table is non-trivial", base >= 20, base + " entries");

let declared = 0;
for (const name of moduleArrays) {
  const arr = C[name];
  check(name + " exists and is an array", Array.isArray(arr));
  if (Array.isArray(arr)) {
    declared += arr.length;
    check(name + " has at least 4 entries", arr.length >= 4, arr.length + " entries");
  }
}

check("allAchievements() returns base + every module entry",
  merged.length === base + declared, merged.length + " vs " + (base + declared));

/* ── ids are globally unique ──────────────────────────────────── */
const seen = Object.create(null), dupes = [];
for (const a of merged) {
  if (!a || !a.id) { dupes.push("<missing id>"); continue; }
  if (seen[a.id]) dupes.push(a.id);
  seen[a.id] = true;
}
check("every achievement id is globally unique", dupes.length === 0, dupes.slice(0, 5).join(", ") || "no duplicates");

/* ── shape is renderable ──────────────────────────────────────── */
let badShape = 0;
for (const a of merged) {
  if (typeof a.id !== "string" || !a.id) badShape++;
  else if (typeof a.name !== "string" || !a.name) badShape++;
  else if (typeof a.desc !== "string" || !a.desc) badShape++;
  else if (a.tier !== 1 && a.tier !== 2 && a.tier !== 3) badShape++;
  else if (typeof a.test !== "function") badShape++;
}
check("every achievement has id/name/desc/tier/test", badShape === 0, badShape + " malformed");

/* ── tests never throw, on a fresh save ───────────────────────── */
let threw = [];
for (const a of merged) {
  try { a.test(C.S); } catch (e) { threw.push(a.id + ": " + e.message); }
}
check("no test() throws on a fresh save", threw.length === 0, threw.slice(0, 3).join(" | ") || "all safe");

/* ── tests never throw when the module namespaces are absent ──── */
const saved = {};
for (const ns of ["ops", "liveops", "blitz", "chw"]) { saved[ns] = C.S[ns]; delete C.S[ns]; }
threw = [];
for (const a of merged) {
  try { a.test(C.S); } catch (e) { threw.push(a.id + ": " + e.message); }
}
for (const ns of ["ops", "liveops", "blitz", "chw"]) { if (saved[ns] !== undefined) C.S[ns] = saved[ns]; }
check("no test() throws with module state stripped (old save)", threw.length === 0, threw.slice(0, 3).join(" | ") || "all safe");

/* ── the trophy desk shows the merged list, not just the base ─── */
C.S.meta = C.S.meta || {};
C.S.meta.ach = C.S.meta.ach || {};
const html = C.metaTrophyDesk();
check("trophy desk header uses the merged count",
  html.indexOf(String(merged.length)) >= 0, "looking for " + merged.length);
check("trophy desk renders a row for a module trophy",
  html.indexOf("Blind box") >= 0 || html.indexOf("Product on screen") >= 0 || html.indexOf("Devkit in hand") >= 0);
check("trophy desk does not divide by zero when empty", html.indexOf("NaN") < 0);

/* ── a module trophy actually unlocks through the live hook ───── */
C.S.liveops = C.S.liveops || {};
C.S.liveops.pulls = 1;
C.S.meta.ach = {};
C.checkAchievements();
check("module trophy unlocks via checkAchievements()", !!C.S.meta.ach["live-first-pull"]);

console.log("");
console.log(failures === 0
  ? "ALL " + checks + " CHECKS PASSED"
  : failures + " of " + checks + " CHECKS FAILED");
process.exit(failures === 0 ? 0 : 1);
