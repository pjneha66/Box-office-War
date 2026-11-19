/* Awards double-payout guard.
   Two code paths can run the below-the-line ceremony:
     1. engine yearAwards() -> awardsPlusCategories()   (the wired path)
     2. tickAwardsPlus() catch-up at the start of a new year, for seasons the
        engine path never reached (it used to `return` before the hook).
   S.awp.yearsAwarded must make those mutually exclusive. If it ever fails, the
   studio is paid a second set of craft trophies for the same season — a silent
   duplicate-cash bug that no single-module harness would catch. */
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
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  esc: (s) => String(s == null ? "" : s),
  toast: () => {}, drainFlash: () => {}
});
for (const f of ["data.js", "engine.js", "awards.js", "awardsplus.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
C.newGame("Awards", "veteran");
const S = C.S;

function mkFilm(id, title, genre, year, over) {
  const f = {
    id: id, title: title, genre: genre, scale: "mid", budget: 40, mkt: 10, cost: 60,
    quality: 84, criticAvg: 82, freshPct: 85, aud: 78, legs: 2.8,
    opening: 30, weeksOut: 2, dom: 60, ww: 140, status: "done",
    releaseWeek: (year - 1) * 52 + 20, supIds: []
  };
  if (over) Object.keys(over).forEach((k) => { f[k] = over[k]; });
  S.films.unshift(f);
  return f;
}

S.awp = undefined;
S.films = [];
S.rFilms = [];
C.awpEnsure();

/* ── path 1: the engine's wired hook ─────────────────────────── */
const y1 = [mkFilm("f1", "First Season", "drama", 1)];
const before1 = S.awp.history.length;
const res1 = C.awardsPlusCategories(y1);
const hist1 = S.awp.history.length - before1;
check("engine path awards all six categories", hist1 === 6, hist1 + " rows");
check("engine path marks the season awarded", S.awp.yearsAwarded[1] === true);
check("engine path returned six winners", res1.length === 6, String(res1.length));

/* ── replay the SAME season through the engine path ──────────── */
const cashBefore = S.studio.cash;
const histBefore = S.awp.history.length;
const res2 = C.awardsPlusCategories(y1);
check("re-running the same season through the engine pays nothing twice",
  res2.length === 0 && S.awp.history.length === histBefore,
  res2.length + " winners, " + (S.awp.history.length - histBefore) + " new rows");
check("re-running the same season leaves cash untouched",
  Math.abs(S.studio.cash - cashBefore) < 0.001,
  "delta " + (S.studio.cash - cashBefore).toFixed(3));

/* ── path 2: the catch-up must skip a season already awarded ─── */
S.studio.week = 53;                       /* week 1 of year 2 -> catch-up window */
S.studio.year = 2;
S.studio.woy = 1;
const cashBefore2 = S.studio.cash;
const histBefore2 = S.awp.history.length;
C.tickWindow;                             /* no-op reference so lint sees it */
C.tickAwardsPlus();
check("catch-up does NOT re-award a season the engine already paid",
  S.awp.history.length === histBefore2,
  (S.awp.history.length - histBefore2) + " new rows");
check("catch-up leaves cash untouched for an already-awarded season",
  Math.abs(S.studio.cash - cashBefore2) < 0.001,
  "delta " + (S.studio.cash - cashBefore2).toFixed(3));

/* ── path 2 must still work for a season the engine never saw ── */
S.awp.yearsAwarded = {};
S.studio.year = 3;
S.studio.woy = 1;
S.studio.week = 105;
S.films = [];
mkFilm("f2", "Lost Season", "scifi", 2);
const histBefore3 = S.awp.history.length;
const cashBefore3 = S.studio.cash;
C.tickAwardsPlus();
const caught = S.awp.history.length - histBefore3;
check("catch-up awards a season the engine path skipped", caught === 6, caught + " rows");
check("catch-up actually paid the studio", S.studio.cash > cashBefore3,
  "+" + (S.studio.cash - cashBefore3).toFixed(2) + "M");
check("catch-up marks the season so it cannot run again", S.awp.yearsAwarded[2] === true);

/* ── and running the tick again must be a no-op ──────────────── */
const cashAfterCatch = S.studio.cash;
const histAfterCatch = S.awp.history.length;
S.studio.week = 106; S.studio.woy = 2;
C.tickAwardsPlus();
check("a later tick does not re-award the caught-up season",
  S.awp.history.length === histAfterCatch &&
  Math.abs(S.studio.cash - cashAfterCatch) < 0.001,
  "rows " + (S.awp.history.length - histAfterCatch) + ", cash " + (S.studio.cash - cashAfterCatch).toFixed(3));

/* ── no season ever has duplicate category rows ──────────────── */
const seen = Object.create(null), dup = [];
for (const h of S.awp.history) {
  const key = h.y + "|" + h.cat;
  if (seen[key]) dup.push(key);
  seen[key] = true;
}
check("no season/category pair is recorded twice", dup.length === 0,
  dup.slice(0, 5).join(", ") || "history clean");

console.log("");
console.log(failures === 0
  ? "ALL " + checks + " CHECKS PASSED"
  : failures + " of " + checks + " CHECKS FAILED");
process.exit(failures === 0 ? 0 : 1);
