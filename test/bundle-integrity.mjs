/* Bundle integrity: every file game/index.html loads must exist in game/ AND be
   listed in apk/build-www.js GAME_FILES. A script referenced by the page but
   absent from GAME_FILES ships a 404 inside the APK — that is exactly what
   happened to help.js before this check existed.
   Also verifies the service worker's precache list only names real files, so
   the PWA can install offline without a missing-asset rejection.
   Usage: node test/bundle-integrity.mjs */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const gameDir = path.join(root, "game");

const html = readFileSync(path.join(gameDir, "index.html"), "utf8");
const buildSrc = readFileSync(path.join(root, "apk", "build-www.js"), "utf8");
const swSrc = readFileSync(path.join(gameDir, "sw.js"), "utf8");

let failures = 0;
const check = (name, ok, extra) => {
  console.log(`${ok ? "ok  " : "FAIL"} — ${name}${extra ? " · " + extra : ""}`);
  if (!ok) failures++;
};

/* strip the ?v= cache-buster, keep the path */
const scripts = [...html.matchAll(/<script[^>]+src="([^"?]+)/g)].map((m) => m[1]);
const styles = [...html.matchAll(/<link[^>]+href="([^"?]+\.css)[^"]*"[^>]*/g)].map((m) => m[1]);
/* also catch rel="stylesheet" written before href */
for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"?]+)/g)) {
  if (!styles.includes(m[1])) styles.push(m[1]);
}

check("index.html references scripts", scripts.length > 30, scripts.length + " scripts");
check("index.html references stylesheets", styles.length >= 1, styles.join(", ") || "none");

/* 1. every referenced file exists on disk */
const missingFiles = [];
for (const f of [...scripts, ...styles]) {
  if (!existsSync(path.join(gameDir, f))) missingFiles.push(f);
}
check("every referenced file exists in game/", missingFiles.length === 0, missingFiles.join(", ") || "all present");

/* 2. every referenced file is listed in GAME_FILES (the APK bundle manifest) */
const missingInBundle = [];
for (const f of [...scripts, ...styles]) {
  if (buildSrc.indexOf(`"${f}"`) < 0) missingInBundle.push(f);
}
check("every referenced file is in apk/build-www.js GAME_FILES",
  missingInBundle.length === 0,
  missingInBundle.length ? "NOT SHIPPED: " + missingInBundle.join(", ") : "all bundled");

/* 3. GAME_FILES does not list files that do not exist (silently skips today,
      but a missing entry means a broken build waiting to happen) */
const gameFilesBlock = buildSrc.match(/const GAME_FILES = \[([\s\S]*?)\];/);
const gameFiles = gameFilesBlock
  ? [...gameFilesBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];
check("GAME_FILES parsed", gameFiles.length > 30, gameFiles.length + " entries");
const ghosts = gameFiles.filter((f) => !existsSync(path.join(gameDir, f)));
check("every GAME_FILES entry exists in game/", ghosts.length === 0, ghosts.join(", ") || "all real");

/* 4. the service worker precache list names real files */
const assetsBlock = swSrc.match(/var ASSETS = \[([\s\S]*?)\];/);
const swAssets = assetsBlock ? [...assetsBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
check("service worker precache list parsed", swAssets.length > 10, swAssets.length + " assets");
const swGhosts = swAssets.filter((a) => a !== "./" && !existsSync(path.join(gameDir, a)));
check("every service-worker asset exists (offline install cannot 404)",
  swGhosts.length === 0, swGhosts.join(", ") || "all real");

/* 5. the SW must precache every module the page loads, or an offline reload
      comes up with undefined globals and a half-broken game */
const notPrecached = scripts.filter((f) => !swAssets.includes(f));
check("every page script is precached by the service worker",
  notPrecached.length === 0,
  notPrecached.length ? "NOT PRECACHED: " + notPrecached.join(", ") : "all precached");

console.log("\n" + (failures ? `FAILED ${failures}/${6}` : "ALL BUNDLE INTEGRITY CHECKS PASSED"));
process.exit(failures ? 1 : 0);
