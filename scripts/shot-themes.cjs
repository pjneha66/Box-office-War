/* Dev helper: capture dashboard + settings screenshots under several themes. */
const pp = require("puppeteer-core");
const chromium = require("@sparticuz/chromium").default;
const URL = process.env.GAME_URL || "http://127.0.0.1:8080";
const THEMES = (process.env.SHOT_THEMES || "gold,violet,aurora,cyberpunk,emerald,noir,silver,carpet,slate").split(",");
const OUT = process.env.SHOT_DIR || "/home/user/shots";

(async () => {
  const fs = require("fs");
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pp.launch({
    executablePath: await chromium.executablePath(),
    args: ["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage", "--disable-gpu", "--disable-background-networking"],
    headless: true,
    protocolTimeout: 60000,
  });
  try {
    const p = await b.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(URL, { waitUntil: "networkidle0" });
    await p.evaluate(() => {
      localStorage.setItem("bow_privacy_ok", "1");
      localStorage.setItem("bow_coppa_ok", "1");
    });
    await p.click("#btnStart");
    await p.waitForSelector("#studioLotCanvas");
    await new Promise((r) => setTimeout(r, 900));
    for (const t of THEMES) {
      await p.evaluate((theme) => { applyTheme(theme); }, t);
      await new Promise((r) => setTimeout(r, 350));
      await p.evaluate(() => { if (typeof closeModal === "function") closeModal(); switchTab("dashboard"); });
      await new Promise((r) => setTimeout(r, 500));
      await p.screenshot({ path: `${OUT}/dashboard-${t}.png` });
      await p.evaluate(() => { if (typeof settingsModal === "function") settingsModal(); });
      await new Promise((r) => setTimeout(r, 400));
      await p.screenshot({ path: `${OUT}/settings-${t}.png` });
      await p.evaluate(() => { if (typeof closeModal === "function") closeModal(); });
    }
    if (errors.length) console.log("PAGE ERRORS:", errors.slice(0, 10));
    console.log("shots written to", OUT);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
