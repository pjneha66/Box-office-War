/* Release-path guard: the shipped APK must contain the root app with the
   portrait shell (system/vertical.css), and must never regress to packaging
   the retired game/ tree.

   History, because the assertions below look like they point the wrong way:
   this guard was originally written the other way round. v44.0 shipped the
   "wrong game" by calling build-www.js without --rebuild, so the guard was
   built to assert that the build used game/ and not the root app. Phase 6
   inverted that: game/ was retired as the shipped product, the root app grew
   the portrait shell, and the APK is locked to portrait in AndroidManifest.
   So the roles swapped — root is now the product and game/ is what must not
   ship. The failure mode this guard exists for is unchanged: a release that
   silently packages the wrong tree.

   Usage: node test/release-mode.mjs */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

let failures = 0;
let total = 0;
const check = (name, ok, extra) => {
  total++;
  console.log(`${ok ? "ok  " : "FAIL"} — ${name}${extra ? " · " + extra : ""}`);
  if (!ok) failures++;
};

/* Only real invocations count: a build-www.js mention inside a shell comment
   (or a YAML comment) is prose, not a build. */
function buildCalls(src) {
  return src
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t.indexOf("#") !== 0 && t.indexOf("//") !== 0;
    })
    .map((line) => {
      const m = line.match(/node\s+apk\/build-www\.js([^"'`\n]*)/);
      return m ? m[1].trim() : null;
    })
    .filter((c) => c !== null);
}

/* Every path that produces the shipped APK. If a new one appears, add it here. */
const buildPaths = [
  { file: ".github/workflows/release-apk.yml", label: "CI release workflow" },
  { file: "release.sh", label: "release.sh" }
];

for (const { file, label } of buildPaths) {
  const calls = buildCalls(readFileSync(path.join(root, file), "utf8"));
  check(`${label}: runs apk/build-www.js`, calls.length > 0,
    calls.length ? calls.map((c) => c || "(no flags)").join(" | ") : "NOT FOUND");
  const bad = calls.filter((c) => c.indexOf("--rebuild") < 0);
  check(`${label}: every build-www.js call passes --rebuild`, bad.length === 0,
    bad.length ? "LEGACY BUILD: " + bad.map((c) => c || "(no flags)").join(", ") : "all --rebuild");
}

/* The npm scripts a human would reach for must also default to the rebuild. */
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};
for (const key of ["apk", "apk:web"]) {
  const cmd = scripts[key] || "";
  check(`package.json "${key}" builds the rebuild`, cmd.indexOf("--rebuild") >= 0, cmd || "missing");
}

/* The build must package the ROOT app. build-www.js copies from ROOT for the
   FILES list; if it ever copies from game/ again, this catches it. */
const buildSrc = readFileSync(path.join(root, "apk", "build-www.js"), "utf8");
check("build-www.js packages the root app (no game/ source tree)",
  buildSrc.indexOf('path.join(ROOT, "game"') < 0 && buildSrc.indexOf('path.join(ROOT, "game", f)') < 0,
  buildSrc.indexOf('path.join(ROOT, "game"') < 0 ? "no game/ copy path" : "STILL COPIES game/");

/* The root app must carry the portrait shell, or the APK ships landscape UI on
   a portrait-locked screen. These are the markers the release workflow also
   verifies against the built bundle. */
const rootHtml = readFileSync(path.join(root, "index.html"), "utf8");
const shellMarkers = ["system/vertical.css", "system/tokens.css", "system/components.css"];
const missingShell = shellMarkers.filter((m) => rootHtml.indexOf(m) < 0);
check("root index.html loads the portrait shell", missingShell.length === 0,
  missingShell.length ? "missing: " + missingShell.join(", ") : "all present");

/* Match the call, not the word. `data-layout` also appears in a <head> comment
   (explaining the flag) and in every rule of vertical.css, so a bare substring
   check passes on prose and reports a working flag on a page that never sets
   one. This guard briefly did exactly that — the negative control caught it. */
const setsFlag = /setAttribute\(\s*["']data-layout["']/.test(rootHtml);
check("root index.html sets the data-layout flag (the call, not the word)", setsFlag,
  setsFlag ? "set by script in <head>" : "NO setAttribute('data-layout') — shell cannot activate");

/* The retired tree must stay distinguishable from the product, so a bundle
   containing the wrong one is detectable. mobile-shell.js and phone-ux.js were
   loaded only by game/. */
const gameHtml = readFileSync(path.join(root, "game", "index.html"), "utf8");
check("retired game/ is distinguishable from the product",
  gameHtml.indexOf("mobile-shell.js") >= 0 && rootHtml.indexOf("mobile-shell.js") < 0,
  "game-only markers present only in game/");

console.log("\n" + (failures ? `FAILED ${failures}/${total}` : "ALL RELEASE-MODE CHECKS PASSED"));
process.exit(failures ? 1 : 0);
