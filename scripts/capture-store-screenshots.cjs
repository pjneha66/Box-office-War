/* Captures fresh store screenshots for the current build.
 *
 * Boots a real career in headless Chrome, advances it far enough that the desks
 * have content (releases, library, franchise data), then shoots each screen at
 * desktop and mobile sizes. Screenshots are written to assets/store/.
 *
 * Usage:  node scripts/capture-store-screenshots.cjs [baseUrl]
 * Requires: a static server on baseUrl (default http://127.0.0.1:8080)
 *           Google Chrome, or CHROME_PATH pointing at a Chromium binary.
 */
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const BASE = process.argv[2] || process.env.GAME_URL || "http://127.0.0.1:8080";
const SEED = Number(process.env.BOW_SEED || 31337);
const SCAN = !!process.env.BOW_SCAN;   // report the simulated studio, write no PNGs
const OUT = path.resolve(__dirname, "..", "assets", "store");
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars"],
  });

  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const shot = async (name, opts = {}) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, ...opts });
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`  ${name}.png (${kb} KB)`);
  };

  // Clear any event/pending modal so it cannot cover the desk we want to shoot.
  const clearModals = () =>
    page.evaluate(() => {
      const root = document.querySelector("#modalRoot");
      if (root) root.innerHTML = "";
      document.querySelectorAll(".modal-backdrop").forEach((n) => n.remove());
    });

  const go = async (tab, waitFor) => {
    await page.evaluate((t) => switchTab(t), tab);
    await sleep(450);
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});
    }
    await clearModals();
    await sleep(250);
  };

  try {
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
    await sleep(1200);

    // ---- 1. start screen (pre-career) -------------------------------------
    await shot("screenshot-start-desktop");

    // ---- boot a career and give it a history ------------------------------
    // Same scripted-player recipe the balance harness uses: greenlight every
    // few weeks, date the finished films, and clear pending choices each tick.
    await page.evaluate((seedInit) => {
      // Deterministic run: seed Math.random so the captured studio is identical
      // on every machine and re-runs do not silently change the store art.
      let seed = seedInit;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      SEL = { scenario: "standard", difficulty: "normal", sandbox: false, slot: 1, legacy: "" };
      newGame(DATA.ARCHETYPES[1].id, "Lighthouse Pictures", SEL);
      G._noSave = true;   // never touch a real save slot
      G.tutorial = null;
      enterApp(false);
      switchTab("dashboard");
    }, SEED);
    await page.waitForSelector("#app");
    await sleep(800);
    await clearModals();

    const WEEK = 130;
    for (let w = 0; w < WEEK; w++) {
      await page.evaluate((week) => {
        // One-time well-funded start (a studio several years in), then the
        // economy runs untouched — no cash patching, so the figures are real.
        if (week === 0) { G.studio.cash = 900; G.weeksInDebt = 0; }
        // Self-limiting greenlight: the studio stops commissioning when it is
        // already carrying a slate, so it settles into a sustainable rhythm.
        if (week % 6 === 0 && G.ideas && G.ideas.length && G.studio.cash > 420) {
          const idea = G.ideas[0];
          try {
            greenlight({
              idea: idea,
              writer: null, director: null, producer: null, cast: [],
              budget: Math.round(neededBudget(idea.genre, idea.scale)),
              marketing: 12, plan: "theatrical",
            });
          } catch (e) { /* unaffordable this week — try again later */ }
        }
        // Two small commissions right before the capture: the slate should show
        // work in progress without turning the weekly net flow red.
        if (week === 127 && G.ideas && G.ideas.length) {
          const picks = G.ideas.slice().sort((a, b) => (a.scale === "indie" ? -1 : 0) - (b.scale === "indie" ? -1 : 0)).slice(0, 2);
          picks.forEach((idea) => {
            try {
              greenlight({
                idea: idea,
                writer: null, director: null, producer: null, cast: [],
                budget: Math.round(neededBudget(idea.genre, idea.scale)),
                marketing: 8, plan: "theatrical",
              });
            } catch (e) { /* ignore */ }
          });
        }
        (G.projects || []).forEach((p) => {
          if (p.phase === "ready" && !p.releaseWeek) {
            p.releaseWeek = G.week + 1;
            p.marketingPaid = p.marketing;
          }
        });
        try { advanceWeek(); } catch (e) { /* a pending choice blocks the tick */ }
        G.pendingChoice = null;
        G.pendingReport = null;
        G.pendingEarnings = null;
        if (G.pendingAuction && !G.pendingAuction.manual) G.pendingAuction = null;
      }, w);
      await clearModals();
    }

    // Settle on a week that has something on screens or about to premiere, so
    // the hero shot is not an empty release lane.
    for (let i = 0; i < 10; i++) {
      const interesting = await page.evaluate(
        () =>
          (typeof readyProjects === "function" && readyProjects().length > 0) ||
          (typeof activeFilms === "function" && activeFilms().length > 0)
      );
      if (interesting) break;
      await page.evaluate(() => {
        try { advanceWeek(); } catch (e) { /* pending choice */ }
        G.pendingChoice = null;
        G.pendingReport = null;
        G.pendingEarnings = null;
        if (G.pendingAuction && !G.pendingAuction.manual) G.pendingAuction = null;
      });
      await clearModals();
    }

    const stats = await page.evaluate(() => ({
      week: G.week,
      films: (G.films || []).length,
      cash: Math.round(G.studio.cash),
      rep: Math.round(G.studio.rep),
      active: (G.projects || []).length,
      inFlight: (G.projects || []).filter((p) => p.phase !== "delivered").length,
      net8: Math.round((G.txHistory || []).slice(-8).reduce((s, t) => s + (t.net || 0), 0)),
    }));

    if (SCAN) {
      console.log(
        `SEED ${SEED}: week ${stats.week} · ${stats.films} releases · ${stats.inFlight} in flight · ` +
          `$${stats.cash}M · rep ${stats.rep} · net8 ${stats.net8 >= 0 ? "+" : ""}${stats.net8}M`
      );
      return;
    }    console.log(
      `  week ${stats.week} · ${stats.films} releases · ${stats.active} in flight · $${stats.cash}M · rep ${stats.rep}`
    );

    // mark notifications read so the red "9+" badge does not sit in every shot
    await page.evaluate(() => {
      try { markAllNotifRead(); } catch (e) { /* older builds */ }
    });

    // ---- desktop desks ----------------------------------------------------
    const desks = [
      ["screenshot-dashboard-desktop", "dashboard"],
      ["screenshot-studio-desktop", "studio"],
      ["screenshot-studiolot-desktop", "studiolot"],
      ["screenshot-develop-desktop", "develop"],
      ["screenshot-productions-desktop", "productions"],
      ["screenshot-boxoffice-desktop", "boxoffice"],
      ["screenshot-empire-desktop", "empire"],
      ["screenshot-library-desktop", "library"],
      ["screenshot-finance-desktop", "finance"],
    ];
    for (const [name, tab] of desks) {
      await go(tab);
      await shot(name);
    }

    // ---- mobile ----------------------------------------------------------
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
    await sleep(500);
    for (const [name, tab] of [
      ["screenshot-home-mobile", "dashboard"],
      ["screenshot-studio-mobile", "studio"],
      ["screenshot-develop-mobile", "develop"],
    ]) {
      await go(tab);
      await shot(name);
    }

    if (errors.length) {
      console.log(`\nPAGE ERRORS (${errors.length}):`);
      errors.slice(0, 5).forEach((e) => console.log("  - " + e));
    }
    console.log(`\nDONE — ${fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).length} PNGs in assets/store/`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
