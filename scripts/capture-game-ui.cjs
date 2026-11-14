/* Captures verification screenshots of the game skin.
 * Usage: node scripts/capture-game-ui.cjs [baseUrl]
 * Writes to /tmp/bow-game-ui-*.png (verification only, not store art).
 */
const path = require("node:path");
const BASE = process.argv[2] || "http://127.0.0.1:8080";
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars"],
  });
  const errors = [];

  // Landscape phone (the primary Android target).
  const phone = await browser.newPage({ viewport: { width: 940, height: 420 } });
  phone.on("pageerror", (e) => errors.push("phone: " + e.message));
  await phone.goto(BASE + "/game-ui-demo.html", { waitUntil: "networkidle" });
  await phone.screenshot({ path: "/tmp/bow-game-ui-demo-phone.png", fullPage: true });

  // Desktop, for layout sanity.
  const desk = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  desk.on("pageerror", (e) => errors.push("desk: " + e.message));
  await desk.goto(BASE + "/game-ui-demo.html", { waitUntil: "networkidle" });
  await desk.screenshot({ path: "/tmp/bow-game-ui-demo-desktop.png", fullPage: true });

  // The real app start screen under the skin.
  const app = await browser.newPage({ viewport: { width: 940, height: 420 } });
  app.on("pageerror", (e) => errors.push("app: " + e.message));
  await app.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await app.waitForTimeout(1200);
  await app.screenshot({ path: "/tmp/bow-game-ui-app-start.png" });

  await browser.close();
  console.log("captured:", ["bow-game-ui-demo-phone", "bow-game-ui-demo-desktop", "bow-game-ui-app-start"].map(f => "/tmp/" + f + ".png").join(", "));
  console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "no page errors");
})().catch((e) => { console.error(e); process.exit(1); });
