/* Captures screenshots of everything in the rebuilt game: start screen, all main
   views, every feature desk sheet, plus landscape shots. Output: rebuild-notes/ss/*.png
   with a manifest JSON the gallery generator consumes.
   Usage: node scripts/capture-rebuild-screens.mjs */
import { createServer } from "http";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "rebuild-notes", "ss");
mkdirSync(outDir, { recursive: true });

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) { console.error("Chrome not found at " + CHROME); process.exit(2); }

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  try { res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" }); res.end(readFileSync(path.join(root, p))); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-first-run"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickBy(sel) {
  try {
    await page.waitForFunction((s) => document.querySelector(s), { timeout: 4000, polling: 250 }, sel);
    await page.evaluate((s) => document.querySelector(s).click(), sel);
  } catch (e) { console.log("⚠ click skipped:", sel); }
}
async function resolvePending() {
  for (let i = 0; i < 4; i++) {
    const st = await page.evaluate(() => window.S && S.pending ? { type: S.pending.type, cash: S.studio.cash } : null);
    if (!st) return;
    const sel = st.type === "poach" ? (st.cash >= 10 ? '[data-action="poach-keep"]' : '[data-action="poach-lose"]')
      : st.type === "incident" ? '[data-action="incident-opt"][data-idx="' + (st.cash >= 7 ? "0" : "2") + '"]'
      : (st.cash >= 3 ? '[data-action="event-pay"]' : '[data-action="event-ignore"]');
    await clickBy(sel);
    await sleep(120);
  }
}
async function shoot(name) {
  await sleep(160);
  await page.screenshot({ path: path.join(outDir, name + ".png") });
  console.log("📸", name);
}
async function advance(n) {
  for (let w = 0; w < n; w++) {
    await resolvePending();
    await clickBy("#btnWeek");
    await sleep(45);
  }
  await resolvePending();
}

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(`${base}/game/index.html`, { waitUntil: "networkidle0" });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "networkidle0" });
await sleep(300);
await shoot("00-start");

// build a real career with content
await page.type("#studioName", "Mercury Pictures");
await clickBy('.origin button[data-origin="major"]');
await clickBy('[data-action="start-game"]');
await sleep(200);

// greenlight three films across scales
for (let g = 0; g < 3; g++) {
  await clickBy('[data-view="develop"]');
  await clickBy('[data-action="dev-tab"][data-tab="scripts"]');
  await clickBy('[data-action="gl-open"]');
  await sleep(120);
  await page.evaluate(() => {
    document.querySelectorAll('[data-action="gl-dir"]')[1]?.click();
    document.querySelectorAll('[data-action="gl-act"]')[0]?.click();
    const heavy = document.querySelectorAll('[data-action="gl-mkt"]')[2];
    if (heavy) heavy.click();
  });
  await clickBy('[data-action="gl-confirm"]');
  await sleep(120);
}
// hire staff + found agency so desks have content
await page.evaluate(() => { for (let i = 0; i < 3; i++) hireLotStaff("writers"); for (let i = 0; i < 2; i++) hireLotStaff("crew"); });
await page.evaluate(() => foundAgency());
await advance(14);
// schedule every ready film at +2 weeks, standard marketing
await page.evaluate(() => {
  S.projects.forEach((p) => {
    if (p.phase === "ready" && !p.releaseWeek) setRelease(p, S.studio.week + 2, 2, 45);
  });
});
await advance(6);
await advance(2);

// main views
await clickBy('[data-view="studio"]'); await shoot("01-studio");
await clickBy('[data-view="develop"]'); await shoot("02-develop-scripts");
await clickBy('[data-action="dev-tab"][data-tab="slate"]'); await shoot("03-develop-slate");
await clickBy('[data-view="playing"]'); await shoot("04-playing");
await clickBy('[data-view="ledger"]'); await shoot("05-ledger");
await clickBy('[data-view="more"]'); await shoot("06-more");

// every desk
const deskIds = await page.evaluate(() => [...document.querySelectorAll("#view .desk")].map((d) => ({ id: d.getAttribute("data-id"), name: d.querySelector(".nm")?.textContent || d.getAttribute("data-id") })));
const manifest = [];
for (const d of deskIds) {
  try {
    await clickBy(`[data-action="desk-open"][data-id="${d.id}"]`);
    await sleep(160);
    const title = await page.evaluate(() => (document.querySelector("#sheetBody h3") || {}).textContent || d.name);
    await shoot("desk-" + d.id.replace(/[^a-z0-9-]/gi, ""));
    manifest.push({ file: "desk-" + d.id.replace(/[^a-z0-9-]/gi, "") + ".png", name: title, group: "" });
    await clickBy("[data-action=\"sheet-close\"]");
    await sleep(80);
  } catch (e) { console.log("⚠ desk failed:", d.id, e.message.slice(0, 60)); }
}

// landscape pair — reload to a clean render (save persists via autosave)
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
await page.reload({ waitUntil: "networkidle0" });
await sleep(450);
await shoot("90-landscape-studio");
await clickBy('[data-view="playing"]');
await shoot("91-landscape-playing");

// extras: greenlight sheet + film detail sheet
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.reload({ waitUntil: "networkidle0" });
await sleep(450);
await clickBy('[data-view="develop"]');
await clickBy('[data-action="dev-tab"][data-tab="scripts"]');
await clickBy('[data-action="gl-open"]');
await sleep(150);
await shoot("95-sheet-greenlight");
await clickBy('[data-action="sheet-close"]');
await clickBy('[data-view="playing"]');
const runFilm = await page.evaluate(() => { const f = S.films.find((f) => f.status === "run"); return f ? f.id : null; });
if (runFilm) {
  await clickBy(`[data-action="film-open"][data-id="${runFilm}"]`);
  await sleep(150);
  await shoot("96-sheet-film");
  await clickBy('[data-action="sheet-close"]');
}

writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("done:", manifest.length, "desks captured");
await browser.close();
server.close();
