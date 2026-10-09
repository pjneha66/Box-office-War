import sharp from "sharp";
import fs from "fs";
import path from "path";

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT = "/Volumes/PJ DRIVE/open code/Box-office-War-main/assets/opening-night.jpg";

// Create premium cinematic background
const bg = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    background: { r: 5, g: 7, b: 10 } // #05070a
  }
})
.png()
.toBuffer();

// Build layered composition
const layers = [];

// 1. Subtle gradient orbs (cinematic lighting)
const orb1 = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
.composite([{
  input: await sharp({
    create: {
      width: 600,
      height: 600,
      channels: 4,
      background: { r: 212, g: 168, b: 67, alpha: 0.08 } // gold
    }
  })
  .png()
  .toBuffer(),
  left: -200,
  top: -200,
  blend: "over"
}, {
  input: await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 59, g: 130, b: 246, alpha: 0.06 } // blue
    }
  })
  .png()
  .toBuffer(),
  left: WIDTH - 300,
  top: HEIGHT - 300,
  blend: "over"
}])
.png()
.toBuffer();

layers.push({ input: orb1, blend: "over" });

// 2. Film grain overlay
const grain = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
.png()
.toBuffer();

// Add film grain pattern programmatically
const grainPattern = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 0.02 }
  }
})
.raw()
.toBuffer({ resolveWithObject: true });

// Actually, let's use a simpler approach - composite a noise texture
// For now, skip grain and add it via CSS

// 3. Studio lot silhouette (using simple shapes)
const studioSilhouette = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
.png()
.toBuffer();

// Create a more sophisticated composition with SVG
const svgOverlay = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldFade" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#d4a843" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#d4a843" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="livePulse" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff2d55" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#ff2d55" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#ff2d55" stop-opacity="0.3"/>
    </linearGradient>
  </defs>

  <!-- Ground plane reflection -->
  <rect x="0" y="${HEIGHT * 0.65}" width="${WIDTH}" height="${HEIGHT * 0.35}" fill="url(#goldFade)"/>

  <!-- Studio buildings (simplified silhouettes) -->
  <g fill="#0a0d12" stroke="#1e2530" stroke-width="1">
    <!-- Back row - large sound stages -->
    <rect x="40" y="${HEIGHT * 0.35}" width="180" height="${HEIGHT * 0.45}" rx="4"/>
    <rect x="260" y="${HEIGHT * 0.3}" width="220" height="${HEIGHT * 0.5}" rx="4"/>
    <rect x="540" y="${HEIGHT * 0.38}" width="160" height="${HEIGHT * 0.42}" rx="4"/>
    <rect x="760" y="${HEIGHT * 0.32}" width="200" height="${HEIGHT * 0.48}" rx="4"/>
    <rect x="1020" y="${HEIGHT * 0.36}" width="140" height="${HEIGHT * 0.4}" rx="4"/>

    <!-- Middle row -->
    <rect x="100" y="${HEIGHT * 0.55}" width="120" height="${HEIGHT * 0.25}" rx="3"/>
    <rect x="280" y="${HEIGHT * 0.52}" width="160" height="${HEIGHT * 0.28}" rx="3"/>
    <rect x="500" y="${HEIGHT * 0.58}" width="100" height="${HEIGHT * 0.22}" rx="3"/>
    <rect x="680" y="${HEIGHT * 0.54}" width="140" height="${HEIGHT * 0.26}" rx="3"/>
    <rect x="900" y="${HEIGHT * 0.56}" width="120" height="${HEIGHT * 0.24}" rx="3"/>
    <rect x="1060" y="${HEIGHT * 0.53}" width="100" height="${HEIGHT * 0.27}" rx="3"/>

    <!-- Front row - smaller buildings/trailers -->
    <rect x="60" y="${HEIGHT * 0.7}" width="80" height="${HEIGHT * 0.18}" rx="2"/>
    <rect x="200" y="${HEIGHT * 0.68}" width="100" height="${HEIGHT * 0.2}" rx="2"/>
    <rect x="380" y="${HEIGHT * 0.72}" width="70" height="${HEIGHT * 0.16}" rx="2"/>
    <rect x="520" y="${HEIGHT * 0.69}" width="90" height="${HEIGHT * 0.19}" rx="2"/>
    <rect x="680" y="${HEIGHT * 0.71}" width="80" height="${HEIGHT * 0.17}" rx="2"/>
    <rect x="840" y="${HEIGHT * 0.68}" width="100" height="${HEIGHT * 0.2}" rx="2"/>
    <rect x="1000" y="${HEIGHT * 0.7}" width="80" height="${HEIGHT * 0.18}" rx="2"/>
  </g>

  <!-- Window lights (gold accents) -->
  <g fill="#d4a843" opacity="0.7">
    <rect x="60" y="${HEIGHT * 0.38}" width="12" height="8" rx="1"/>
    <rect x="90" y="${HEIGHT * 0.42}" width="12" height="8" rx="1"/>
    <rect x="120" y="${HEIGHT * 0.46}" width="12" height="8" rx="1"/>
    <rect x="150" y="${HEIGHT * 0.5}" width="12" height="8" rx="1"/>

    <rect x="280" y="${HEIGHT * 0.33}" width="14" height="10" rx="1"/>
    <rect x="320" y="${HEIGHT * 0.37}" width="14" height="10" rx="1"/>
    <rect x="360" y="${HEIGHT * 0.41}" width="14" height="10" rx="1"/>
    <rect x="400" y="${HEIGHT * 0.45}" width="14" height="10" rx="1"/>
    <rect x="440" y="${HEIGHT * 0.49}" width="14" height="10" rx="1"/>

    <rect x="560" y="${HEIGHT * 0.41}" width="10" height="8" rx="1"/>
    <rect x="590" y="${HEIGHT * 0.45}" width="10" height="8" rx="1"/>
    <rect x="620" y="${HEIGHT * 0.49}" width="10" height="8" rx="1"/>

    <rect x="780" y="${HEIGHT * 0.35}" width="14" height="10" rx="1"/>
    <rect x="820" y="${HEIGHT * 0.39}" width="14" height="10" rx="1"/>
    <rect x="860" y="${HEIGHT * 0.43}" width="14" height="10" rx="1"/>
    <rect x="900" y="${HEIGHT * 0.47}" width="14" height="10" rx="1"/>

    <!-- Middle row windows -->
    <rect x="120" y="${HEIGHT * 0.57}" width="8" height="6" rx="1"/>
    <rect x="160" y="${HEIGHT * 0.61}" width="8" height="6" rx="1"/>
    <rect x="300" y="${HEIGHT * 0.55}" width="10" height="8" rx="1"/>
    <rect x="340" y="${HEIGHT * 0.59}" width="10" height="8" rx="1"/>
    <rect x="520" y="${HEIGHT * 0.61}" width="8" height="6" rx="1"/>
    <rect x="700" y="${HEIGHT * 0.57}" width="10" height="8" rx="1"/>
    <rect x="740" y="${HEIGHT * 0.61}" width="10" height="8" rx="1"/>
    <rect x="920" y="${HEIGHT * 0.59}" width="8" height="6" rx="1"/>
    <rect x="960" y="${HEIGHT * 0.63}" width="8" height="6" rx="1"/>

    <!-- Live ON AIR indicators -->
    <rect x="${WIDTH - 200}" y="${HEIGHT * 0.15}" width="60" height="20" rx="4" fill="url(#livePulse)"/>
    <text x="${WIDTH - 170}" y="${HEIGHT * 0.15 + 14}" font-family="Space Grotesk,Inter,sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">ON AIR</text>
  </g>

  <!-- Searchlight beams -->
  <g fill="none" stroke="#d4a843" stroke-width="2" opacity="0.15">
    <line x1="150" y1="${HEIGHT}" x2="150" y2="${HEIGHT * 0.2}" stroke-dasharray="20 40"/>
    <line x1="400" y1="${HEIGHT}" x2="400" y2="${HEIGHT * 0.25}" stroke-dasharray="20 40"/>
    <line x1="650" y1="${HEIGHT}" x2="650" y2="${HEIGHT * 0.22}" stroke-dasharray="20 40"/>
    <line x1="900" y1="${HEIGHT}" x2="900" y2="${HEIGHT * 0.28}" stroke-dasharray="20 40"/>
  </g>

  <!-- Bottom branding -->
  <text x="${WIDTH / 2}" y="${HEIGHT - 40}" text-anchor="middle" font-family="Space Grotesk,Inter,sans-serif" font-size="28" font-weight="700" fill="#f0f2f5" letter-spacing="4">BOX OFFICE WAR</text>
  <text x="${WIDTH / 2}" y="${HEIGHT - 16}" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" font-weight="400" fill="#8b95a3" letter-spacing="3">STUDIO EMPIRE · LIVE TV · STREAMING</text>
</svg>
`;

const svgBuffer = Buffer.from(svgOverlay);

const result = await sharp(bg)
  .composite([
    { input: svgBuffer, blend: "over" }
  ])
  .jpeg({ quality: 92, mozjpeg: true })
  .toFile(OUTPUT);

console.log("Created premium opening-night.jpg");