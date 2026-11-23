/* test/save-guards.mjs — two malformed-save guards.
 *
 * Bug #5: validateSave() never checked `difficulty`, yet tickPoaching() reads
 *   DATA.DIFFICULTIES[G.difficulty].eventRate unguarded on every weekly tick.
 *   A save lacking the field loaded fine and then threw mid-week.
 *   Fix: reject the save on load, and fall back to DATA.DIFFICULTIES.normal
 *   inside the tick so a save already in the wild cannot wedge the game.
 *
 * Bug #6: legsOf() reads DATA.GENRES[film.genre].legsAdj unguarded. A film
 *   with a genre that has no DATA row (the sandbox accepts free text) threw.
 *   Fix: fall back to the drama profile.
 *
 * Run: node test/save-guards.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const SHIM = `
if (typeof global.window === "undefined") global.window = global;
global.localStorage = { _s:{}, getItem(k){ return this._s[k] ?? null; }, setItem(k,v){ this._s[k]=v; }, removeItem(k){ delete this._s[k]; } };
if (typeof global.DATA === "undefined") global.DATA = {};
`;
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

const bundle = SHIM + "\n" + ["data.js", "engine.js"].map(read).join("\n;\n") + "\n;\n" + `
global.__BOW = {
  get G(){ return G; }, set G(v){ G = v; },
  newGame, advanceWeeks, validateSave, legsOf, tickPoaching, DATA,
  expectedOpening, releaseFilm, saveGame
};
`;

const OUT = path.join(HERE, ".save-guards-generated.cjs");
fs.writeFileSync(OUT, bundle);
let BOW;
try {
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

/* The fallback must be a real key, or both fixes are cosmetic. */
check("DATA.DIFFICULTIES.normal is a real difficulty row",
  !!(BOW.DATA.DIFFICULTIES && BOW.DATA.DIFFICULTIES.normal),
  BOW.DATA.DIFFICULTIES && BOW.DATA.DIFFICULTIES.normal ? "eventRate " + BOW.DATA.DIFFICULTIES.normal.eventRate : "MISSING");
check("DATA.GENRES.drama is a real genre row",
  !!(BOW.DATA.GENRES && BOW.DATA.GENRES.drama),
  BOW.DATA.GENRES && BOW.DATA.GENRES.drama ? "legsAdj " + BOW.DATA.GENRES.drama.legsAdj : "MISSING");

/* ── #5 validateSave ──────────────────────────────────────────── */
BOW.newGame("major", "Guard Lab", { scenario: "standard", difficulty: "hard" });
BOW.G._noSave = true;

function snapshotWith(mutate) {
  const s = JSON.parse(JSON.stringify(BOW.G));
  mutate(s);
  return s;
}
const clean = snapshotWith(() => {});
check("a well-formed save validates", BOW.validateSave(clean).length === 0,
  BOW.validateSave(clean).join("; "));

const noDiff = snapshotWith(s => { delete s.difficulty; });
check("a save with no difficulty is rejected", BOW.validateSave(noDiff).length > 0,
  BOW.validateSave(noDiff).join("; "));

const badDiff = snapshotWith(s => { s.difficulty = "nightmare"; });
check("a save with an unknown difficulty is rejected", BOW.validateSave(badDiff).length > 0,
  BOW.validateSave(badDiff).join("; "));

const validDiff = snapshotWith(s => { s.difficulty = "easy"; });
check("every real difficulty validates", BOW.validateSave(validDiff).length === 0);

/* ── #5 tickPoaching must not throw on a legacy save ──────────── */
["easy", "normal", "hard", undefined, "nightmare", null].forEach((d, i) => {
  BOW.G.difficulty = d;
  let threw = null;
  try { BOW.tickPoaching(); } catch (e) { threw = e.message; }
  check("tickPoaching survives difficulty " + JSON.stringify(d), threw === null, threw || "ok");
});

/* ── #6 legsOf must not throw on an unknown genre ─────────────── */
BOW.newGame("major", "Genre Lab", { scenario: "standard", difficulty: "normal" });
BOW.G._noSave = true;

/* legsOf() is called on films that are already in G.films — including films
   restored from a save. Build the object directly (releaseFilm/expectedOpening
   is a separate sink, see the note at the bottom). */
function looseFilm(genre, id) {
  return {
    id: id || 77001, title: "Genre Probe", genre: genre, scale: "mid", budget: 60, marketing: 30,
    quality: { overall: 70, critic: 70, aud: 70 }, rating: "PG-13",
    premium: false, imax: false, franchise: false, pattern: "wide", rollout: "day",
    window: 30, cast: [], location: "la", releaseWeek: 1, week: 1,
    campaigns: [], mktBoosts: [], advances: [], buzzBonus: 0, awareness: 0,
    opening: 20, dom: 20, intl: 10, ww: 30, weeksOut: 1, inTheaters: true,
    weekly: [{ w: 1, gross: 20 }], legs: 2.5, decay: 0.6, piracyPenalty: 0
  };
}

let knownLegs = null, knownErr = null;
try { knownLegs = BOW.legsOf(looseFilm("drama", 77001)); } catch (e) { knownErr = e.message; }
check("legsOf works for a known genre", knownErr === null && Number.isFinite(knownLegs), knownErr || String(knownLegs));

let unknownLegs = null, unknownErr = null;
try { unknownLegs = BOW.legsOf(looseFilm("interpretive-dance", 77002)); } catch (e) { unknownErr = e.message; }
check("legsOf survives an unknown genre", unknownErr === null,
  unknownErr ? "THREW: " + unknownErr : "legs " + unknownLegs);
check("an unknown genre falls back to the drama profile",
  unknownErr === null && knownLegs !== null && Math.abs(unknownLegs - knownLegs) < 1e-9,
  "unknown " + unknownLegs + " vs drama " + knownLegs);

/* ── the whole week must still advance with both hazards present ── */
BOW.newGame("major", "Survive Lab", { scenario: "standard", difficulty: "normal" });
BOW.G._noSave = true;
BOW.G.films = [looseFilm("interpretive-dance", 77003)];
BOW.G.difficulty = undefined;      /* as a legacy save would arrive */
let weekErr = null;
try { BOW.advanceWeeks(1); } catch (e) { weekErr = e.message; }
check("a full week advances with an unknown genre and no difficulty", weekErr === null,
  weekErr ? "THREW: " + weekErr : "week " + BOW.G.week);

/* NOTE (reported, not fixed — outside the #6 scope): expectedOpening() at
   engine.js:2303 also does `const g=DATA.GENRES[p.genre]` unguarded, so a
   *new* release with a free-text genre throws before it reaches legsOf. */
let openErr = null;
try { BOW.expectedOpening({ scale: "mid", genre: "interpretive-dance", marketing: 30, cast: [], quality: { overall: 70, critic: 70, aud: 70 } }, 1); }
catch (e) { openErr = e.message; }
console.log((openErr ? "ℹ️  expectedOpening() still unguarded for unknown genres: " + openErr
                     : "ℹ️  expectedOpening() handles unknown genres") +
  " — adjacent sink, left alone per scope.");

if (failures) { console.error("❌ save-guards: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ save-guards: all " + checks + " checks passed");
