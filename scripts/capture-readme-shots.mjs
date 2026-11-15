/* Captures the README screenshots for the rebuilt game (v42.7).
   Boots a photogenic mid-game studio (film in theaters, tentpole with a legend
   cameo shooting, series airing), clears every pending modal, then shoots the
   key screens at phone size. Output: assets/screenshots/*.png
   Usage: node scripts/capture-readme-shots.mjs */
import { createServer } from "http";
import { readFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "assets", "screenshots");
mkdirSync(outDir, { recursive: true });

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
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
const shoot = async (name) => { await sleep(180); await page.screenshot({ path: path.join(outDir, name + ".png") }); console.log("📸", name); };

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(`${base}/game/index.html`, { waitUntil: "networkidle0" });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: "networkidle0" });
await sleep(400);
await shoot("00-start");

// boot a photogenic mid-game studio
await page.evaluate(() => {
  newGame("Aurora Pictures", "veteran", "std", "free");
  mergeCastBanks();
  S.studio.cash = 120;
  const pick2 = (k) => S.market.filter((t) => t.k === k && !talentBusy(t));
  // film 1: indie drama, quality 78, releasing next week
  const idea1 = S.ideas.find((i) => i.genre === "drama") || S.ideas[0];
  greenlight(idea1.id, { scale: "indie", bIdx: 2, dirId: pick2("dir")[0].id, actorId: pick2("actor")[0].id, mktIdx: 2 });
  const p1 = S.projects[0];
  p1.phaseLen = { pre: 1, shoot: 2, post: 1 };
  p1.phase = "ready"; p1.phaseWk = 0;
  computeQuality(p1); p1.quality = 78; p1.qPreview = 78;
  setRelease(p1, S.studio.week + 1, 2, 45);
  // series: drama, airing with a strong rating
  greenlightSeries("drama", 1);
  const s = S.series[0];
  s.phase = "aired"; s.weeksOut = 4; s.eps = 8; s.rating = 81; s.grossSum = 18.6;
});
for (let w = 0; w < 7; w++) await page.evaluate(() => { if (S.pending) S.pending = null; advanceWeek(); S.pending = null; });
await page.evaluate(() => {
  // film 2: tentpole in production with a legend cameo booked
  S.studio.rep = 58;
  const idea2 = S.ideas.find((i) => i.genre === "action") || S.ideas[0];
  const dirs = S.market.filter((t) => t.k === "dir" && !talentBusy(t));
  const acts = S.market.filter((t) => t.k === "actor" && !talentBusy(t));
  greenlight(idea2.id, { scale: "tentpole", bIdx: 1, dirId: dirs[0].id, actorId: acts[0].id, mktIdx: 2 });
  const p2 = S.projects[S.projects.length - 1];
  p2.phase = "shoot"; p2.phaseWk = 3; p2.phaseLen = { pre: 3, shoot: 10, post: 8 };
  p2.buzz = 6;
  camEnsure();
  S.cam.offers.push({ id: "cmS9", n: "Rex Thorne", legend: true, fee: 9.0, blurb: "Rex Thorne doesn't do cameos. He does events. This would be an event.", age: 0 });
  camBook("cmS9", p2.id);
  S.studio.cash = 96.4;
  saveGame();
});

const view = async (v, tab) => {
  await page.evaluate((vv, tt) => { VIEW = vv; if (tt) DEV_TAB = tt; render(); }, v, tab || null);
  await sleep(220);
};

await view("studio"); await shoot("01-studio");
await view("develop", "series"); await shoot("02-series");
await view("playing"); await shoot("03-box-office");
await view("more"); await shoot("04-desks");

// cameo desk sheet
await page.evaluate(() => { LAST_DESK = findDesk("cam-main"); openSheet('<div class="sheet-head"><h3>' + LAST_DESK.icon + " " + esc(LAST_DESK.name) + '</h3><button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div><div class="sheet-body">' + LAST_DESK.render() + "</div>"); });
await sleep(220);
await shoot("05-cameo-desk");
await page.evaluate(() => closeSheet());

// film detail sheet with the new box office breakdown
const runId = await page.evaluate(() => { const f = S.films.find((f) => f.status === "run"); return f ? f.id : null; });
if (runId) {
  await page.evaluate((id) => { VIEW = "playing"; render(); sheetFilm(id); }, runId);
  await sleep(220);
  await shoot("06-film-sheet");
  await page.evaluate(() => closeSheet());
}

console.log("done →", outDir);
await browser.close();
server.close();
