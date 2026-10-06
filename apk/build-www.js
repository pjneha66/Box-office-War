/* Builds the APK web bundle: copies the game files into www/ and strips the
   service-worker registration (Capacitor serves assets locally from the app
   bundle — a cache-first SW inside the APK would only risk stale builds). */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(__dirname, "www");

const FILES = [
  "index.html", "style.css", "data.js", "engine.js", "i18n.js", "ui.js",
  "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png", "manifest.webmanifest",
];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
fs.cpSync(path.join(ROOT, "assets"), path.join(WWW, "assets"), { recursive: true });

// strip the SW registration <script> block from the copied index.html
const idxPath = path.join(WWW, "index.html");
let idx = fs.readFileSync(idxPath, "utf8");
const swBlock = /<script>\s*\/\* PWA:[^]*?<\/script>/;
if (!swBlock.test(idx)) throw new Error("SW registration block not found in index.html");
idx = idx.replace(swBlock, "");
fs.writeFileSync(idxPath, idx);

console.log("www/ built:", fs.readdirSync(WWW).join(", "));
