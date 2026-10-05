import sharp from "sharp";
import fs from "fs";
import path from "path";

const svg = fs.readFileSync(path.resolve("./icon.svg"));
const sizes = [
  { size: 512, name: "icon-512.png" },
  { size: 192, name: "icon-192.png" },
  { size: 180, name: "icon-180.png" }
];

for (const { size, name } of sizes) {
  await sharp(svg)
    .resize(size, size, { fit: "contain", background: { r: 11, g: 14, b: 20, alpha: 1 } })
    .png()
    .toFile(path.resolve(`./${name}`));
  console.log(`Created ${name} (${size}x${size})`);
}

console.log("All icons generated!");