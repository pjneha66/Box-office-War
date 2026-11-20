/* Handler-name bridge guard.
   ui.js dispatches module actions behind `typeof someAction === "function"` gates.
   When the name in the gate does not match the name the module actually defines,
   the guard is always false and the whole desk is silently inert — that is exactly
   how the Finance currency switch (finAction) and every Challenge button
   (chalAction) shipped dead, gated on financeAction / challengeAction.

   This test parses every such gate in game/ui.js and asserts the name exists as a
   function in some game/*.js module. It catches the mismatch the day it is written. */
import { readFileSync, readdirSync } from "fs";
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

/* every function name any module defines at top level */
const defined = new Set();
for (const f of readdirSync(gameDir).filter((f) => f.endsWith(".js"))) {
  const src = readFileSync(path.join(gameDir, f), "utf8");
  for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) defined.add(m[1]);
  for (const m of src.matchAll(/^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\b/gm)) defined.add(m[1]);
}

const ui = readFileSync(path.join(gameDir, "ui.js"), "utf8");
const gates = [...ui.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*===\s*"function"/g)].map((m) => m[1]);
const unique = [...new Set(gates)].sort();

check("ui.js has action gates to verify", unique.length > 0, unique.length + " distinct gates");

/* Names that are legitimately provided by the host (window/browser) or by
   another module we do not parse (the cast bridge). */
const EXTERNAL = new Set(["bowUnlockAllCast"]);

const missing = unique.filter((n) => !defined.has(n) && !EXTERNAL.has(n));
check(
  "every typeof-guarded name in ui.js is defined by a module",
  missing.length === 0,
  missing.length ? "missing: " + missing.join(", ") : unique.length + " names all real"
);

/* The specific regressions this test was written for. */
for (const name of ["finAction", "chalAction"]) {
  check(name + " is defined", defined.has(name));
}
for (const name of ["financeAction", "challengeAction"]) {
  check(name + " does not exist (the dead gate name)", !defined.has(name));
}
check("ui.js does not gate on financeAction", !/typeof\s+financeAction\s*===/.test(ui));
check("ui.js does not gate on challengeAction", !/typeof\s+challengeAction\s*===/.test(ui));

console.log("\n" + (failures ? failures + " FAILED" : "ALL " + checks + " CHECKS PASSED"));
process.exit(failures ? 1 : 0);
