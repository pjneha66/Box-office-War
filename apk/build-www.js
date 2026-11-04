/* Builds the APK web bundle: copies the game files into www/ and strips the
   service-worker registration (Capacitor serves assets locally from the app
   bundle — a cache-first SW inside the APK would only risk stale builds). */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(__dirname, "www");

const FILES = [
  "index.html",
  "design-tokens.css", "style.css", "ui-v33.css", "lot-life.css", "bow-restyle.css", "lot-gameplay.css", "welcome.css", "command-deck.css", "industry-expansion.css", "studio-nextwave.css", "theme-studio.css", "landscape-phone.css",
  "data.js", "engine.js", "industry-expansion-suite.js", "studio-nextwave-suite.js", "i18n.js", "ui.js", "settings-studio.js",
  "finance-desk.js", "finance-tools.js", "v31-features.js", "bo-charts.js", "gamestudio-desk.js",
  "challenge-leaderboard.js", "theater-chains.js", "dynamic-soundtrack.js", "dynasty-legacy.js",
  "bow-shorts.js", "talent-agency.js", "film-restoration.js", "festival-pr.js",
  "studio-facilities.js", "syndication-tv.js", "talent-contracts.js", "bond-market.js",
  "clash-analytics.js", "cinematic-universe.js", "location-scouting.js", "production-insurance.js",
  "awards-campaign.js", "board-targets.js", "fan-conventions.js", "test-screenings.js",
  "studio-espionage.js", "merch-licensing.js", "territory-licensing.js", "custom-sandbox.js",
  "film-locations-tax.js", "studio-operations-suite.js", "gamedev-console-hardware.js", "live-ops-coproduction.js",
  "hollywood-crises-pr.js", "demographics-audiences.js", "production-creativity-suite.js", "exhibition-plf-concessions.js", "marketing-blitz-engine.js",
  "studio-agent-life.js", "studio-lot-engine.js", "studio-actors.js", "studio-departments.js", "studio-lot-2d.js", "lot-life.js", "lot-feel.js", "bow-motion.js",
  "box-office-sim-2-cast.js", "gamestudio-gdd-engine.js", "social-viral-network.js", "sports-stadium-deals.js", "stage-division.js", "kairo-theme-suite.js",
  "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png", "manifest.webmanifest",
];

// macOS AppleDouble sidecars (._*) are filesystem metadata, never game content.
// Filtering the source is not enough: this volume stores extended attributes as
// ._ files, so the kernel re-creates them whenever a file is written. Prune the
// bundle after copying, otherwise ~600 junk files get packed into the APK.
// assets/store/ is marketing art for the store listings (10 MB of PNGs); the
// game never loads it, so it must not ship inside the APK either.
const STORE_ART = path.join(ROOT, "assets", "store");
const skipJunk = (src) =>
  !path.basename(src).startsWith("._") && !src.startsWith(STORE_ART + path.sep);

function pruneSidecars(dir) {
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { removed += pruneSidecars(p); continue; }
    if (entry.name.startsWith("._")) { fs.unlinkSync(p); removed++; }
  }
  return removed;
}

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
if (fs.existsSync(path.join(ROOT, "assets"))) fs.cpSync(path.join(ROOT, "assets"), path.join(WWW, "assets"), { recursive: true, filter: skipJunk });
if (fs.existsSync(path.join(ROOT, "pkg"))) fs.cpSync(path.join(ROOT, "pkg"), path.join(WWW, "pkg"), { recursive: true, filter: skipJunk });

// strip the SW registration <script> block from the copied index.html
const idxPath = path.join(WWW, "index.html");
let idx = fs.readFileSync(idxPath, "utf8");
const swBlock = /<script>\s*\/\* PWA:[^]*?<\/script>/;
if (!swBlock.test(idx)) throw new Error("SW registration block not found in index.html");
idx = idx.replace(swBlock, "");
fs.writeFileSync(idxPath, idx);

// prune last: every write above (including the index.html rewrite) regenerates
// ._ sidecars on this volume, so the sweep has to come after all of them.
const pruned = pruneSidecars(WWW);

console.log("www/ built:", fs.readdirSync(WWW).join(", "));
console.log(`www/ pruned ${pruned} AppleDouble sidecar(s)`);
