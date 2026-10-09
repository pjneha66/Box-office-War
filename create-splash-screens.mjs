import sharp from "sharp";
import fs from "fs";
import path from "path";

const SVG_PATH = "/Volumes/PJ DRIVE/open code/Box-office-War-main/icon.svg";
const ANDROID_RES = "/Volumes/PJ DRIVE/open code/Box-office-War-main/apk/android/app/src/main/res";

const svg = fs.readFileSync(SVG_PATH);

const splashSizes = [
  { folder: "drawable-port-ldpi", width: 200, height: 320 },
  { folder: "drawable-port-mdpi", width: 320, height: 480 },
  { folder: "drawable-port-hdpi", width: 480, height: 800 },
  { folder: "drawable-port-xhdpi", width: 720, height: 1280 },
  { folder: "drawable-port-xxhdpi", width: 1080, height: 1920 },
  { folder: "drawable-port-xxxhdpi", width: 1440, height: 2560 },

  { folder: "drawable-land-ldpi", width: 320, height: 200 },
  { folder: "drawable-land-mdpi", width: 480, height: 320 },
  { folder: "drawable-land-hdpi", width: 800, height: 480 },
  { folder: "drawable-land-xhdpi", width: 1280, height: 720 },
  { folder: "drawable-land-xxhdpi", width: 1920, height: 1080 },
  { folder: "drawable-land-xxxhdpi", width: 2560, height: 1440 },
];

for (const { folder, width, height } of splashSizes) {
  const dir = path.join(ANDROID_RES, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const iconSize = Math.min(width, height) * 0.3;

  await sharp(svg)
    .resize(Math.round(iconSize), Math.round(iconSize), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
    .then(iconBuf => {
      return sharp({
        create: {
          width,
          height,
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
      .toFile(path.join(dir, "splash.png"));
    });

  console.log(`Created ${folder}/splash.png (${width}x${height})`);
}

const baseDir = path.join(ANDROID_RES, "drawable");
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

await sharp(svg)
  .resize(600, 600, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()
  .then(iconBuf => {
    return sharp({
      create: {
        width: 1080,
        height: 1920,
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
    .toFile(path.join(baseDir, "splash.png"));
  });

console.log("Created drawable/splash.png (1080x1920)");
console.log("\nAll splash screens created!");