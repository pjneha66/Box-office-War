/* Callable-state guard.
   `S` is the global state OBJECT in engine.js (`var S = null;` then assigned a
   plain object). Calling it — `applyLever(S(), ...)` — throws
   "TypeError: S is not a function" at runtime, which is how all seven Collection
   lever buttons shipped dead. This test asserts ui.js never calls S as a function.
   (box-office-collection-engine.js has its own private S() accessor and is exempt.) */
import { readFileSync } from "fs";
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

const engine = readFileSync(path.join(gameDir, "engine.js"), "utf8");
check("S is declared as a state object in engine.js", /^var S = null;/m.test(engine));

const ui = readFileSync(path.join(gameDir, "ui.js"), "utf8");

/* `S(` as a call, but not `S.foo(`, `S = (`, or a word ending in S. */
const calls = [...ui.matchAll(/(^|[^.\w$])S\s*\(\s*\)/gm)].map((m) => {
  const before = ui.slice(0, m.index + m[0].length);
  return before.split("\n").length;
});
check("ui.js never calls S()", calls.length === 0, calls.length ? "at line(s) " + calls.join(", ") : "none");

/* Also guard against the wrapped variants that mean the same thing. */
check("ui.js never calls S.call/S.apply", !/(^|[^.\w$])S\s*\.\s*(call|apply)\s*\(/m.test(ui));
check("ui.js never does typeof S()", !/typeof\s+S\s*\(/m.test(ui));

/* The specific call site this test was written for. */
const bocCall = /BoxOfficeCollection\.applyLever\(\s*S\s*,/.test(ui);
check("applyLever is called with the state object, not S()", bocCall);

/* Every other module must not call the global S either. */
for (const file of ["social_viral.js", "finance.js", "challenges.js", "people.js", "biz.js", "tv.js"]) {
  const src = readFileSync(path.join(gameDir, file), "utf8");
  check(file + " never calls S()", !/(^|[^.\w$])S\s*\(\s*\)/m.test(src));
}

console.log("\n" + (failures ? failures + " FAILED" : "ALL " + checks + " CHECKS PASSED"));
process.exit(failures ? 1 : 0);
