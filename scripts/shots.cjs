/* Visual capture harness for local verification.
   Usage: node scripts/shots.cjs [tag]
   Renders the game from the inlined harness (no navigation) and captures
   the dashboard + settings under a set of themes. */
const fs = require("fs");
const path = require("path");
const pp = require("puppeteer-core");
const { build } = require("./visual-harness.cjs");

const OUT = process.env.SHOT_DIR || "/home/user/shots";
const TAG = process.argv[2] || "now";
const THEMES = (process.env.SHOT_THEMES || "gold,daylight,blueprint,newsprint,ember,cyberpunk,violet,emerald,noir").split(",");
const SCREENS = (process.env.SHOT_SCREENS || "dashboard,settings").split(",");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await pp.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage", "--disable-gpu", "--allow-file-access-from-files"],
    headless: true,
    protocolTimeout: 120000,
  });
  const errors = [];
  try {
    const p = await b.newPage();
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
    p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
    await p.setViewport({ width: 1440, height: 900 });
    await p.setContent(build(), { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 1200));
    await p.click("#btnStart");
    await p.waitForSelector("#studioLotCanvas", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    for (const theme of THEMES) {
      await p.evaluate((t) => { if (typeof applyTheme === "function") applyTheme(t); }, theme);
      await new Promise((r) => setTimeout(r, 400));
      for (const screen of SCREENS) {
        if (screen === "settings" || screen === "vault") {
          await p.evaluate((s) => {
            if (typeof settingsModal === "function") settingsModal();
            if (s === "vault") {
              const tab = document.querySelector('[data-pref-panel="saves"]');
              if (tab) tab.click();
            }
          }, screen);
          await new Promise((r) => setTimeout(r, 500));
          await p.screenshot({ path: `${OUT}/${TAG}-${screen}-${theme}.png` });
          await p.evaluate(() => { if (typeof closeModal === "function") closeModal(); });
        } else {
          await p.evaluate((s) => { if (typeof closeModal === "function") closeModal(); if (typeof switchTab === "function") switchTab(s); }, screen);
          await new Promise((r) => setTimeout(r, 700));
          await p.screenshot({ path: `${OUT}/${TAG}-${screen}-${theme}.png` });
        }
      }
    }
    console.log("shots:", OUT, "errors:", errors.length ? errors.slice(0, 5) : "none");
  } finally {
    await b.close().catch(() => {});
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
