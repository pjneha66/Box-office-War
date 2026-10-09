import sharp from "sharp";
import fs from "fs";
import path from "path";

const SVG_PATH = "/Volumes/PJ DRIVE/open code/Box-office-War-main/icon.svg";
const ANDROID_RES = "/Volumes/PJ DRIVE/open code/Box-office-War-main/apk/android/app/src/main/res";

const svg = fs.readFileSync(SVG_PATH);

const mipmapSizes = [
  { folder: "mipmap-mdpi", size: 48 },
  { folder: "mipmap-hdpi", size: 72 },
  { folder: "mipmap-xhdpi", size: 96 },
  { folder: "mipmap-xxhdpi", size: 144 },
  { folder: "mipmap-xxxhdpi", size: 192 },
];

for (const { folder, size } of mipmapSizes) {
  const dir = path.join(ANDROID_RES, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // ic_launcher.png (standard)
  await sharp(svg)
    .resize(size, size, { fit: "contain", background: { r: 5, g: 7, b: 10, alpha: 1 } })
    .png()
    .toFile(path.join(dir, "ic_launcher.png"));

  // ic_launcher_round.png
  await sharp(svg)
    .resize(size, size, { fit: "contain", background: { r: 5, g: 7, b: 10, alpha: 1 } })
    .png()
    .toFile(path.join(dir, "ic_launcher_round.png"));

  console.log(`Created ${folder} icons (${size}x${size})`);
}

// Foreground icons for adaptive icon (432x432 for all densities)
for (const { folder } of mipmapSizes) {
  const dir = path.join(ANDROID_RES, folder);

  await sharp(svg)
    .resize(432, 432, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(dir, "ic_launcher_foreground.png"));
}

// Background icons (solid color)
for (const { folder } of mipmapSizes) {
  const dir = path.join(ANDROID_RES, folder);

  await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 5, g: 7, b: 10, alpha: 1 }
    }
  })
  .png()
  .toFile(path.join(dir, "ic_launcher_background.png"));
}

console.log("\nAll mipmap icons created!");