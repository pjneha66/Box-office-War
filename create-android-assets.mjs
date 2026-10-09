import sharp from "sharp";
import fs from "fs";
import path from "path";

const SVG_PATH = "/Volumes/PJ DRIVE/open code/Box-office-War-main/icon.svg";
const ASSETS_DIR = "/Volumes/PJ DRIVE/open code/Box-office-War-main/apk/assets";

const svg = fs.readFileSync(SVG_PATH);

// 1. icon-only.png - 432x432 (foreground for adaptive icon)
await sharp(svg)
  .resize(432, 432, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(ASSETS_DIR, "icon-only.png"));
console.log("Created icon-only.png (432x432)");

// 2. icon-foreground.png - same as icon-only
await sharp(svg)
  .resize(432, 432, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(ASSETS_DIR, "icon-foreground.png"));
console.log("Created icon-foreground.png (432x432)");

// 3. icon-background.png - solid dark background
await sharp({
  create: {
    width: 432,
    height: 432,
    channels: 4,
    background: { r: 5, g: 7, b: 10, alpha: 1 } // #05070a
  }
})
.png()
.toFile(path.join(ASSETS_DIR, "icon-background.png"));
console.log("Created icon-background.png (432x432)");

// 4. splash.png - 2732x2732
await sharp(svg)
  .resize(600, 600, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()
  .then(iconBuf => {
    return sharp({
      create: {
        width: 2732,
        height: 2732,
        channels: 4,
        background: { r: 5, g: 7, b: 10, alpha: 1 }
      }
    })
    .composite([{
      input: iconBuf,
      gravity: "center",
      blend: "over"
    }])
    .png()
    .toFile(path.join(ASSETS_DIR, "splash.png"));
  });
console.log("Created splash.png (2732x2732)");

console.log("\nAll Android assets created!");