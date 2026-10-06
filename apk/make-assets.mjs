/* Generates Android icon + splash source assets from the game's icon.svg.
   Run from the repo ROOT (needs the root node_modules/sharp): node apk/make-assets.mjs */
import sharp from "../node_modules/sharp/dist/index.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(HERE, "assets");
const svg = fs.readFileSync(path.join(ROOT, "icon.svg"));
const BG = "#0b0e14";

fs.mkdirSync(OUT, { recursive: true });

// 1024 icon: logo with a little padding
await sharp(svg, { density: 300 }).resize(880, 880).png()
  .toBuffer()
  .then(b => sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
    .composite([{ input: b, gravity: "centre" }]).png().toFile(path.join(OUT, "icon-only.png")));

// adaptive foreground: logo at ~55% inside the safe zone
await sharp(svg, { density: 300 }).resize(560, 560).png()
  .toBuffer()
  .then(b => sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
    .composite([{ input: b, gravity: "centre" }]).png().toFile(path.join(OUT, "icon-foreground.png")));

// adaptive background: solid studio dark
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } })
  .png().toFile(path.join(OUT, "icon-background.png"));

// splash 2732×2732: logo centred on dark
await sharp(svg, { density: 300 }).resize(700, 700).png()
  .toBuffer()
  .then(b => sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
    .composite([{ input: b, gravity: "centre" }]).png().toFile(path.join(OUT, "splash.png")));

console.log("assets generated:", fs.readdirSync(OUT).join(", "));
