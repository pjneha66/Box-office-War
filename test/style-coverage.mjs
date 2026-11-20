/* Stylesheet coverage guard.
   The legacy 60-file build carries command-deck.css (537 develop-* rules) that
   game/index.html never loads, so any markup relying on those classes renders
   unstyled and the failure is invisible in a headless test. This test asserts
   every class the rebuilt UI actually emits is defined by a stylesheet the page
   loads — catching "the CSS exists but is not shipped" before it ships.

   It is deliberately narrow: only classes that the v47 Develop deck, desk
   registries and Collection empty state emit are required to have rules, because
   those are the ones this build introduced. Pre-existing markup is out of scope. */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
}

const html = readFileSync(path.join(gameDir, "index.html"), "utf8");

/* stylesheets the page actually loads */
const sheets = [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"/g)].map((m) => m[1]);
check("index.html loads stylesheets", sheets.length > 0, sheets.join(", "));

let css = "";
for (const s of sheets) {
  const p = path.join(gameDir, s);
  if (existsSync(p)) css += readFileSync(p, "utf8") + "\n";
}
const definedClasses = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));

/* classes the v47 rebuild emits and therefore must be styled */
const REQUIRED = [
  "dev-nav", "dev-head", "dev-tele", "dev-tel", "dev-chips",
  "dev-scripts", "dev-script", "dev-script-top", "dev-script-tags",
  "dev-script-price", "dev-bars", "dev-bar", "dev-script-foot",
  "dev-market", "dev-mrow", "dev-sec", "dev-sec-head", "dev-body",
  "dev-ready", "dev-ready-row", "dev-slate", "dev-talent", "dev-trow", "dev-trow-val",
  "readonly-note", "unlock-note"
];

const missing = REQUIRED.filter((c) => !definedClasses.has(c));
check("every class the v47 rebuild emits has a rule in a loaded stylesheet",
  missing.length === 0, missing.length ? "missing: " + missing.join(", ") : REQUIRED.length + " classes styled");

/* The rebuild must not depend on a stylesheet the page does not load. */
const unloaded = ["command-deck.css"].filter((f) => existsSync(path.join(gameDir, f)) && !sheets.includes(f));
check("the rebuild does not rely on an unloaded legacy stylesheet",
  unloaded.length === 0,
  unloaded.length ? unloaded.join(", ") + " exists but is not linked" : "no dependency on unloaded CSS");

/* And the classes must actually be emitted by ui.js, not just defined. */
const ui = readFileSync(path.join(gameDir, "ui.js"), "utf8");
const unused = ["dev-nav", "dev-tele", "dev-script", "dev-sec", "dev-trow", "unlock-note", "readonly-note"]
  .filter((c) => !ui.includes(c));
check("every required class is actually emitted by ui.js", unused.length === 0,
  unused.length ? "not emitted: " + unused.join(", ") : "all emitted");

console.log("\n" + (failures ? failures + " FAILED" : "ALL " + checks + " CHECKS PASSED"));
process.exit(failures ? 1 : 0);
