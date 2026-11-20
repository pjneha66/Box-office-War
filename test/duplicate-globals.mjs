/* Duplicate global function guard.
   Every module is a plain <script>, so they all share one global scope. Two
   modules defining the same function name means the later script silently wins
   and the earlier implementation is dead code with no error anywhere. That is
   exactly how the lead's follower lift vanished: people.js defined
   socialBuzzMult(p) (followers) and social_viral.js redefined it (creator
   endorsements), and since social_viral.js loads later, the followers version
   never ran.

   This test loads every module index.html references and reports any function
   name defined more than once. */
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

const html = readFileSync(path.join(gameDir, "index.html"), "utf8");
const order = [...html.matchAll(/<script[^>]+src="([^"?]+)/g)].map((m) => m[1]);

check("index.html references modules", order.length > 30, order.length + " modules");

/* name -> [ {file, line} ] */
const owners = new Map();
for (const file of order) {
  const src = readFileSync(path.join(gameDir, file), "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    /* top-level function declarations only (column 0) */
    const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (!m) return;
    const name = m[1];
    if (!owners.has(name)) owners.set(name, []);
    owners.get(name).push({ file, line: i + 1 });
  });
}

const dupes = [...owners.entries()].filter(([, v]) => v.length > 1);

check(
  "no function name is defined by two modules",
  dupes.length === 0,
  dupes.length
    ? dupes.map(([n, v]) => n + " (" + v.map((x) => x.file + ":" + x.line).join(" vs ") + ")").join(" | ")
    : owners.size + " functions, all unique"
);

/* The specific regression: exactly one socialBuzzMult, and it must live in the
   module that loads last so nothing shadows it. */
const sb = owners.get("socialBuzzMult") || [];
check("socialBuzzMult is defined exactly once", sb.length === 1,
  sb.map((x) => x.file + ":" + x.line).join(", ") || "not defined at all");

if (sb.length === 1) {
  const owner = sb[0].file;
  const later = order.slice(order.indexOf(owner) + 1).filter((f) => {
    const src = readFileSync(path.join(gameDir, f), "utf8");
    return /^function\s+socialBuzzMult\s*\(/m.test(src);
  });
  check("no later module redefines socialBuzzMult", later.length === 0, later.join(", ") || "nothing shadows it");
  const src = readFileSync(path.join(gameDir, owner), "utf8");
  check("socialBuzzMult still applies the lead's followers", /followersK/.test(src));
  check("socialBuzzMult still applies creator endorsements", /creators/.test(src));
}

console.log("\n" + (failures ? failures + " FAILED" : "ALL " + checks + " CHECKS PASSED"));
process.exit(failures ? 1 : 0);
