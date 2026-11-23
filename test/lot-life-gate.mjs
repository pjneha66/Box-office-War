/* test/lot-life-gate.mjs — pins the finding behind bug #9.
 *
 * lot-life.js:844 arms a 1200 ms setInterval with no mount/unmount pair: it is
 * a load-time IIFE whose only teardown would be an unmount hook that does not
 * exist. Per the fix brief it was left as-is, but the interval is unreachable
 * anyway — the whole boot-wiring block sits behind `global.BOW_LEGACY_LOT_EFFECTS`
 * (lot-life.js:797), and no file in the project ever assigns that flag.
 *
 * If someone later enables the flag (making the interval live), this test fails
 * loudly and the mount/unmount work becomes real rather than theoretical.
 *
 * Run: node test/lot-life-gate.mjs
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
  console.error("❌ lot-life-gate: jsdom is required. Run: npm install");
  process.exit(1);
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const src = fs.readFileSync(path.join(ROOT, "lot-life.js"), "utf8");

/* 1 — the gate exists, and the interval is inside it. */
check("lot-life.js gates its boot wiring behind BOW_LEGACY_LOT_EFFECTS",
  /if \(!global\.BOW_LEGACY_LOT_EFFECTS\) return;/.test(src));

const gateAt = src.indexOf("if (!global.BOW_LEGACY_LOT_EFFECTS) return;");
const intervalAt = src.indexOf("var _weekWatch = setInterval(");
check("the 1200ms interval is declared after that gate", gateAt !== -1 && intervalAt > gateAt,
  "gate@" + gateAt + " interval@" + intervalAt);

/* 2 — nothing in the project ever sets the flag. */
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs|cjs|html|json)$/.test(e.name)) out.push(p);
  }
  return out;
}
const SELF = path.join(HERE, "lot-life-gate.mjs");
const files = walk(ROOT, []).filter(f => f !== SELF);
const assignments = [];
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  /* an assignment that is not a comparison */
  const re = /BOW_LEGACY_LOT_EFFECTS\s*=(?!=)/g;
  let m;
  while ((m = re.exec(t))) {
    assignments.push(path.relative(ROOT, f) + " @" + t.slice(0, m.index).split("\n").length);
  }
}
check("no project file enables BOW_LEGACY_LOT_EFFECTS", assignments.length === 0,
  assignments.join(", ") || "no assignments found");

/* 3 — empirically: loading the real file creates no interval. */
function load(withFlag) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="studiolotContainer"></div><div id="studiolotGlobalStage"></div>
  </body></html>`, { url: "https://example.test/", runScripts: "outside-only" });
  const win = dom.window;
  win.addEventListener("error", e => e.preventDefault());
  win.console.error = () => {};
  const created = [];
  win.setInterval = (fn, ms) => { created.push(ms); return 1; };
  win.setTimeout = () => 0;
  win.clearInterval = () => {};
  win.requestAnimationFrame = () => 1;
  if (withFlag) win.BOW_LEGACY_LOT_EFFECTS = true;
  win.eval("global = this;");
  win.eval(src);
  return { created, hasApi: !!win.LotLife };
}

const shipped = load(false);
check("lot-life.js still exposes its LotLife API", shipped.hasApi === true);
check("the shipped build creates no polling interval", shipped.created.length === 0,
  "created " + JSON.stringify(shipped.created));

/* 4 — and the interval is real when the gate is opened, so the risk is genuine
       and this test would catch a future enablement. */
const legacy = load(true);
check("with the flag on, the 1200ms interval is created (risk is real)",
  legacy.created.indexOf(1200) !== -1, "created " + JSON.stringify(legacy.created));

if (failures) { console.error("❌ lot-life-gate: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ lot-life-gate: all " + checks + " checks passed");
