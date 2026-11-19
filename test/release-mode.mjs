/* Release-path guard: the shipped APK must contain the rebuilt, phone-first game
   in game/, never the legacy 60-script game at the repo root.

   This exists because v44.0 shipped the wrong game: the release workflow called
   `node apk/build-www.js` without `--rebuild`, so the APK regressed to the legacy
   build (62 scripts, no phone shell) while the whole rebuild lived untouched in
   game/. Nothing failed — the APK was valid, just the wrong product — so this
   asserts the build mode itself, not the built output.

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

/* The npm scripts a human would reach for must also default to the rebuild.
   (test:packaging intentionally builds the legacy bundle for the legacy
   lot-packaging test, so it is not in this list.) */
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};
for (const key of ["apk", "apk:web"]) {
  const cmd = scripts[key] || "";
  check(`package.json "${key}" builds the rebuild`, cmd.indexOf("--rebuild") >= 0, cmd || "missing");
}

/* The rebuild marker set must exist in game/, so the guard cannot pass vacuously */
const gameHtml = readFileSync(path.join(root, "game", "index.html"), "utf8");
const markers = ["mobile-shell.js", "phone-ux.js", "opsuite.js", "liveops.js", "mktblitz.js", "consolehw.js"];
const missing = markers.filter((m) => gameHtml.indexOf(m) < 0);
check("game/index.html is the rebuild (its marker scripts are present)",
  missing.length === 0, missing.length ? "missing: " + missing.join(", ") : "all present");

/* The legacy game must stay distinguishable from the rebuild, because the guard
   above relies on that difference to tell them apart. */
const legacyHtml = readFileSync(path.join(root, "index.html"), "utf8");
check("legacy root index.html is distinguishable from the rebuild",
  legacyHtml.indexOf("industry-expansion-suite.js") >= 0 && gameHtml.indexOf("industry-expansion-suite.js") < 0,
  "legacy marker present only at root");

console.log("\n" + (failures ? `FAILED ${failures}/${total}` : "ALL RELEASE-MODE CHECKS PASSED"));
process.exit(failures ? 1 : 0);
