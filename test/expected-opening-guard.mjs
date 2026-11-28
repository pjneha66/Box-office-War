/* test/expected-opening-guard.mjs — expectedOpening() must survive a genre id
 * with no DATA.GENRES row.
 *
 * Bug it pins (v48 fix): expectedOpening read `DATA.GENRES[p.genre]` unguarded
 * (engine.js:2297 pre-fix), so a film carrying a cleared sandbox custom genre —
 * applyCustomGenres/clearCustomGenres in studio-nextwave-suite.js:98-117 insert
 * and delete DATA.GENRES rows at runtime — threw `g.mass` TypeError mid-tick,
 * and every projection call site went NaN (pitch wizard, screening modal,
 * weekly opening sim, finance ledger). legsOf() already used the correct
 * drama-fallback pattern; this pins expectedOpening to the same contract.
 *
 * Run: node test/expected-opening-guard.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ expected-opening-guard: jsdom is required. Run: npm install");
  process.exit(1);
}

function makeApp() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>
  </body></html>`, { url: "https://example.test/", runScripts: "outside-only" });
  const win = dom.window;
  win.addEventListener("error", (e) => e.preventDefault());
  win.console.error = function () {};
  win.beep = () => {}; win.toast = () => {}; win.saveGame = () => {}; win.log = () => {}; win.render = () => {};

  const SHIM = `if (typeof global.DATA === "undefined") global.DATA = {};\nglobal.window = global;\n`;
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "ui.js"].map(read).join("\n;\n") + "\n;\n" + `
  global.__EO = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    expectedOpening: (typeof expectedOpening === "function") ? expectedOpening : null,
    DATA: (typeof DATA === "object") ? DATA : null
  };`;
  const OUT = path.join(HERE, ".eo-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, EO: win.__EO };
}

const { win, EO } = makeApp();
check("engine exports expectedOpening", typeof EO.expectedOpening === "function");
if (typeof EO.expectedOpening !== "function") { process.exit(1); }

EO.newGame("major", "Guard Lab", { scenario: "standard", difficulty: "normal" });
EO.G._noSave = true;

/* 1. A genre id that has no DATA.GENRES row (cleared sandbox custom genre). */
const ghost = { id: "p_ghost", title: "Ghost Genre", genre: "custom_deleted_genre", scale: "mid",
  cast: [], marketing: 20, quality: { overall: 60, critic: 60, aud: 60 }, buzz: 40, awareness: 0.2,
  releaseWeek: EO.G.week, campaigns: [] };
let v1 = null, threw1 = null;
try { v1 = EO.expectedOpening(ghost, EO.G.week); } catch (e) { threw1 = e; }
check("unknown genre does not throw", threw1 === null, threw1 && String(threw1));
check("unknown genre yields a finite number", v1 !== null && Number.isFinite(v1), String(v1));

/* 2. A series-only genre (reality/documentary live in SGENRES, not GENRES). */
const reality = Object.assign({}, ghost, { id: "p_reality", genre: "reality" });
let v2 = null, threw2 = null;
try { v2 = EO.expectedOpening(reality, EO.G.week); } catch (e) { threw2 = e; }
check("series-only genre does not throw", threw2 === null, threw2 && String(threw2));
check("series-only genre yields a finite number", v2 !== null && Number.isFinite(v2), String(v2));

/* 3. A valid genre still produces the same number as before the guard — the
   fallback must be invisible on the happy path. */
const action = Object.assign({}, ghost, { id: "p_action", genre: "action" });
const v3 = EO.expectedOpening(action, EO.G.week);
check("valid genre still returns a finite projection", Number.isFinite(v3), String(v3));
check("drama fallback differs from a real genre row", EO.expectedOpening(Object.assign({}, ghost, { genre: "drama" }), EO.G.week) !== v3);

/* 4. Stale scale id — same guard now covers SCALES. */
const staleScale = Object.assign({}, ghost, { id: "p_scale", scale: "megabudget_legacy" });
let v4 = null, threw4 = null;
try { v4 = EO.expectedOpening(staleScale, EO.G.week); } catch (e) { threw4 = e; }
check("unknown scale does not throw", threw4 === null, threw4 && String(threw4));
check("unknown scale yields a finite number", v4 !== null && Number.isFinite(v4), String(v4));

/* 5. The source really carries the guard (structural pin, cheap to keep true). */
const src = fs.readFileSync(path.join(ROOT, "engine.js"), "utf8");
check("expectedOpening guards genre and scale lookups",
  /const S=DATA\.SCALES\[p\.scale\]\|\|DATA\.SCALES\.mid,\s*g=DATA\.GENRES\[p\.genre\]\|\|DATA\.GENRES\.drama/.test(src));

process.exit(failures ? 1 : 0);
