/* Builds the APK web bundle: copies the game files into www/ and strips the
   service-worker registration (Capacitor serves assets locally from the app
   bundle — a cache-first SW inside the APK would only risk stale builds). */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(__dirname, "www");

const FILES = [
  "index.html", "design-tokens.css", "style.css", "data.js", "engine.js", "i18n.js", "ui.js",
  "finance-tools.js", "v31-features.js",
  "challenge-leaderboard.js", "theater-chains.js", "dynamic-soundtrack.js", "dynasty-legacy.js",
  "bow-shorts.js", "talent-agency.js", "film-restoration.js", "festival-pr.js",
  "studio-facilities.js", "syndication-tv.js", "talent-contracts.js", "bond-market.js",
  "clash-analytics.js", "cinematic-universe.js", "location-scouting.js", "production-insurance.js",
  "awards-campaign.js", "board-targets.js", "fan-conventions.js", "test-screenings.js",
  "studio-espionage.js", "merch-licensing.js", "territory-licensing.js", "custom-sandbox.js",
  "film-locations-tax.js", "studio-operations-suite.js", "gamedev-console-hardware.js", "live-ops-coproduction.js",
  "hollywood-crises-pr.js", "demographics-audiences.js", "production-creativity-suite.js", "exhibition-plf-concessions.js", "marketing-blitz-engine.js",
  "studio-lot-engine.js", "studio-lot-2d.js",
  "box-office-sim-2-cast.js", "gamestudio-gdd-engine.js", "social-viral-network.js", "sports-stadium-deals.js", "kairo-theme-suite.js",
  "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png", "manifest.webmanifest",
];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
if (fs.existsSync(path.join(ROOT, "assets"))) fs.cpSync(path.join(ROOT, "assets"), path.join(WWW, "assets"), { recursive: true });
if (fs.existsSync(path.join(ROOT, "pkg"))) fs.cpSync(path.join(ROOT, "pkg"), path.join(WWW, "pkg"), { recursive: true });

// strip the SW registration <script> block from the copied index.html
const idxPath = path.join(WWW, "index.html");
let idx = fs.readFileSync(idxPath, "utf8");
const swBlock = /<script>\s*\/\* PWA:[^]*?<\/script>/;
if (!swBlock.test(idx)) throw new Error("SW registration block not found in index.html");
idx = idx.replace(swBlock, "");
fs.writeFileSync(idxPath, idx);

console.log("www/ built:", fs.readdirSync(WWW).join(", "));
