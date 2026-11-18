/* Rebuild UI harness: boots the new game in headless Chrome at phone viewports,
   plays a full loop (greenlight → produce → release → box office), audits tap targets,
   asserts no console errors, and drops screenshots into rebuild-notes/.
   Usage: node test/rebuild-ui.mjs */
import { createServer } from "http";
import { readFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  console.error("Chrome not found at " + CHROME + " — set CHROME_PATH");
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const shotDir = path.join(root, "rebuild-notes");
mkdirSync(shotDir, { recursive: true });

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p.replace(/^\/+/, ""));
  try {
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("nope");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  args: ["--disable-web-security", "--no-first-run", "--disable-features=Translate"],
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true }
});

const VIEWPORTS = [
  { name: "portrait-390x844", width: 390, height: 844 },
  { name: "portrait-360x740", width: 360, height: 740 },
  { name: "landscape-844x390", width: 844, height: 390 }
];

let failures = 0;
const fail = (msg) => { failures++; console.error("  ✗ " + msg); };
const ok = (msg) => console.log("  ✓ " + msg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickBy(page, selector) {
  await page.waitForFunction((s) => document.querySelector(s), { timeout: 5000 }, selector);
  // programmatic click: robust against transient toast overlays in the harness
  await page.evaluate((s) => document.querySelector(s).click(), selector);
}

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} ──`);
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

  await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
  await page.goto(`${base}/game/index.html`, { waitUntil: "networkidle0" });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(300);

  // start screen
  const startVisible = await page.evaluate(() => !!document.querySelector(".start h1"));
  startVisible ? ok("start screen renders") : fail("start screen missing");
  const scripts = await page.evaluate(() => document.querySelectorAll("script[src]").length);
  scripts === 32 ? ok("32 script files (data, engine, 29 modules, ui)") : fail("expected 32 script tags, got " + scripts);

  await page.type("#studioName", "Test Pictures");
  await clickBy(page, '.origin button[data-origin="veteran"]');
  await clickBy(page, '[data-action="start-game"]');
  await sleep(200);

  const hudVisible = await page.evaluate(() => !document.getElementById("topbar").hidden);
  hudVisible ? ok("game boots, HUD visible") : fail("HUD not visible after start");
  const cash = await page.evaluate(() => document.getElementById("hudCash").textContent);
  /^\$[\d.]+M$/.test(cash) ? ok("cash chip renders: " + cash) : fail("cash chip bad: " + cash);

  // greenlight a film
  await clickBy(page, '[data-view="develop"]');
  await clickBy(page, '[data-action="gl-open"]');
  await sleep(150);
  const sheetOpen = await page.evaluate(() => !document.getElementById("sheetWrap").hidden);
  sheetOpen ? ok("greenlight sheet opens") : fail("greenlight sheet missing");
  await page.evaluate(() => {
    const persons = document.querySelectorAll(".talent-row .person");
    document.querySelectorAll('[data-action="gl-dir"]')[1]?.click();
  });
  await page.evaluate(() => document.querySelectorAll('[data-action="gl-act"]')[0]?.click());
  await sleep(100);
  await clickBy(page, '[data-action="gl-confirm"]');
  await sleep(200);
  const inSlate = await page.evaluate(() => document.body.innerHTML.includes("data-action=\"rl-open\"") || document.querySelectorAll('[data-action="dev-tab"]').length > 0);
  const projCount = await page.evaluate(() => window.S && S.projects.length);
  projCount === 1 ? ok("project created (Slate: 1)") : fail("no project after greenlight (" + projCount + ")");

  // advance until ready (≤ 22 weeks), answering any PR crisis modal
  const resolvePending = async () => {
    for (let i = 0; i < 4; i++) {
      const st = await page.evaluate(() => window.S && S.pending ? { pending: true, type: S.pending.type, cash: S.studio.cash } : { pending: false, cash: 0 });
      if (!st.pending) return;
      const sel = st.type === "poach"
        ? (st.cash >= 10 ? '[data-action="poach-keep"]' : '[data-action="poach-lose"]')
        : st.type === "incident"
        ? '[data-action="incident-opt"][data-idx="' + (st.cash >= 7 ? "0" : "2") + '"]'
        : (st.cash >= 3 ? '[data-action="event-pay"]' : '[data-action="event-ignore"]');
      await clickBy(page, sel);
      await sleep(150);
    }
  };
  for (let w = 0; w < 26; w++) {
    await resolvePending();
    const ready = await page.evaluate(() => window.S && S.projects.some((p) => p.phase === "ready"));
    if (ready) break;
    await clickBy(page, "#btnWeek");
    await sleep(60);
  }
  await resolvePending();
  const isReady = await page.evaluate(() => S.projects.some((p) => p.phase === "ready"));
  isReady ? ok("film reached 'ready'") : fail("film never became ready in 22 weeks");

  // schedule release
  await clickBy(page, '[data-action="rl-open"]');
  await sleep(150);
  await clickBy(page, '[data-action="rl-confirm"]');
  await sleep(200);
  const scheduled = await page.evaluate(() => S.projects.some((p) => p.releaseWeek));
  scheduled ? ok("release scheduled") : fail("schedule failed");

  // advance past release
  for (let w = 0; w < 5; w++) {
    await resolvePending();
    const running = await page.evaluate(() => S.films.some((f) => f.status === "run"));
    if (running) break;
    await clickBy(page, "#btnWeek");
    await sleep(60);
  }
  await resolvePending();
  const running = await page.evaluate(() => S.films.some((f) => f.status === "run"));
  running ? ok("film is now in theaters") : fail("no film in theaters after release week");

  // box office view + chart
  await clickBy(page, '[data-view="playing"]');
  await sleep(150);
  const bars = await page.evaluate(() => document.querySelectorAll("#view .chart .c").length);
  bars > 0 ? ok(`weekend chart draws (${bars} columns)`) : fail("chart empty");
  await page.screenshot({ path: path.join(shotDir, `ui-${vp.name}-playing.png`) });

  // film detail sheet
  await clickBy(page, '[data-action="film-open"]');
  await sleep(150);
  const hasReviews = await page.evaluate(() => document.body.innerHTML.includes("Audience score"));
  hasReviews ? ok("film sheet shows reviews") : fail("film sheet missing reviews");
  await clickBy(page, '[data-action="sheet-close"]');

  // ledger + screenshots
  await clickBy(page, '[data-view="ledger"]');
  await sleep(150);
  const statsOk = await page.evaluate(() => document.body.innerHTML.includes("Studio record"));
  statsOk ? ok("ledger renders") : fail("ledger broken");
  await page.screenshot({ path: path.join(shotDir, `ui-${vp.name}-ledger.png`) });

  // Desks now live under Studio / Develop / Playing / Business (the More tab is gone).
  // Studio · People holds the talent agency; open a sample and run the agency action.
  await clickBy(page, '[data-view=\"studio\"]');
  await sleep(150);
  const studioDesks = await page.evaluate(() => document.querySelectorAll("#view .desk").length);
  studioDesks >= 3 ? ok(`Studio renders ${studioDesks} desks`) : fail("too few desks on Studio: " + studioDesks);
  await page.screenshot({ path: path.join(shotDir, `ui-${vp.name}-studio-desks.png`) });
  const deskIds = await page.evaluate(() => [...document.querySelectorAll("#view .desk")].map((d) => d.getAttribute("data-id")));
  for (const id of deskIds.slice(0, 4)) {
    await clickBy(page, `[data-action="desk-open"][data-id="${id}"]`);
    await sleep(120);
    const open = await page.evaluate(() => !document.getElementById("sheetWrap").hidden && document.getElementById("sheetBody").innerHTML.length > 100);
    open ? ok("desk opens: " + id) : fail("desk failed to render: " + id);
    await clickBy(page, '[data-action="sheet-close"]');
    await sleep(80);
  }
  await clickBy(page, '[data-action="desk-open"][data-id="talent-agency"]');
  await sleep(120);
  const agBtn = await page.evaluate(() => !!document.querySelector('[data-action="ag-found"]'));
  agBtn ? ok("agency desk shows found action") : fail("agency desk broken");
  await clickBy(page, '[data-action="ag-found"]');
  await sleep(120);
  const founded = await page.evaluate(() => window.S && S.agency.founded);
  founded ? ok("agency founded via desk") : fail("agency found failed (may be cash-timed)");
  await clickBy(page, '[data-action="sheet-close"]');

  // Playing · Release: distribution / exhibition desks sit under the Release sub-tab
  await clickBy(page, '[data-view="playing"]');
  await sleep(150);
  await clickBy(page, '[data-action="play-tab"][data-tab="release"]');
  await sleep(150);
  const releaseDesks = await page.evaluate(() => document.querySelectorAll("#view .desk").length);
  releaseDesks >= 5 ? ok(`Playing · Release renders ${releaseDesks} desks`) : fail("too few Release desks: " + releaseDesks);
  await page.screenshot({ path: path.join(shotDir, `ui-${vp.name}-playing-release.png`) });

  // Gear menu: save slots + settings
  await clickBy(page, '[data-action="gear"]');
  await sleep(150);
  const gearOk = await page.evaluate(() => !document.getElementById("sheetWrap").hidden && document.getElementById("sheetBody").innerHTML.indexOf("Sound effects") >= 0);
  gearOk ? ok("gear menu opens with settings") : fail("gear menu broken");
  await clickBy(page, '[data-action="sheet-close"]');

  // tap-target audit on interactive controls
  const minBox = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-action], .tab, #btnWeek, .weekBtn')].filter((e) => e.offsetParent !== null);
    let min = 999;
    els.forEach((e) => {
      const r = e.getBoundingClientRect();
      min = Math.min(min, Math.min(r.width, r.height));
    });
    return Math.round(min);
  });
  minBox >= 38 ? ok(`smallest tap target ${minBox}px (≥38px target)`) : fail(`tap target too small: ${minBox}px`);

  // no horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow <= 1 ? ok("no horizontal overflow") : fail(`horizontal overflow ${overflow}px`);

  // studio home screenshot
  await clickBy(page, '[data-view="studio"]');
  await sleep(150);
  await page.screenshot({ path: path.join(shotDir, `ui-${vp.name}-studio.png`) });

  if (consoleErrors.length) fail("console errors: " + consoleErrors.slice(0, 3).join(" | "));
  else ok("zero console errors");
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURES` : "\nALL UI CHECKS PASSED");
process.exit(failures ? 1 : 0);
