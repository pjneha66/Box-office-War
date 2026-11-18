/* Browser check for the game/ greenlight sheet: lead + supporting picks, the three-pick cap,
   the cost in the sheet total, and the film created with its supporting cast.
   Needs the site at BASE (default http://localhost:8080/game/index.html) and CHROME_PATH. */
import { createRequire } from "module";
const req = createRequire(new URL("../package.json", import.meta.url));
const puppeteer = req("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:8080/game/index.html";
const CHROME = process.env.CHROME_PATH || "/usr/bin/chromium";
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  defaultViewport: { width: 390, height: 844 }
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", e => pageErrors.push(e.message));
let failed = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  ·  " + detail : ""));
  if (!ok) failed++;
};
const wait = ms => new Promise(r => setTimeout(r, ms));

await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
await wait(1200);
await page.evaluate(() => {
  if (typeof newGame === "function") newGame("Supporting Browser Test", "veteran");
  S.studio.cash = 5000;
  if (!S.ideas.length) S.ideas.push({ id: "bsc", title: "Ensemble Test", genre: "drama", price: 10, script: 70, theme: null, franchiseOf: null });
});

const ideaId = await page.evaluate(() => S.ideas[0].id);
await page.evaluate(id => sheetGreenlight(id), ideaId);
await wait(200);

// pick a director and lead from the sheet
const picks = await page.evaluate(() => {
  const dir = document.querySelector('[data-action="gl-dir"]:not([disabled])');
  if (dir) dir.click();
  return !!dir;
});
check("a director can be picked on the sheet", picks);
await wait(150);
await page.evaluate(() => { const b = document.querySelector('[data-action="gl-act"]:not([disabled])'); if (b) b.click(); });
await wait(150);

const sup = await page.evaluate(() => document.querySelectorAll('[data-action="gl-sup"]').length);
check("supporting-cast picker lists actors", sup >= 4, sup + " listed");

// pick three supporting actors
for (let i = 0; i < 3; i++) {
  await page.evaluate(i => { const b = document.querySelectorAll('[data-action="gl-sup"]:not([disabled])')[i]; if (b) b.click(); }, i);
  await wait(120);
}
const afterThree = await page.evaluate(() => ({ n: GL.supIds.length, label: (document.body.innerText.match(/Supporting cast[^\n]*/) || [""])[0] }));
check("three supporting actors can be picked", afterThree.n === 3, afterThree.label);

// the fourth pick is refused with a message
await page.evaluate(() => { const b = document.querySelectorAll('[data-action="gl-sup"]:not([disabled])')[3]; if (b) b.click(); });
await wait(150);
const capped = await page.evaluate(() => GL.supIds.length);
check("a fourth supporting actor is refused", capped === 3, "picked " + capped);

// the sheet total includes the supporting fees
const totals = await page.evaluate(() => ({ sup: glTotals().supTotal, total: glTotals().total, dir: glTotals().dirFee + glTotals().actFee }));
check("sheet total includes supporting fees", totals.sup > 0 && totals.total > totals.dir, "supporting " + totals.sup);

// the greenlight button is enabled and creates the film with its supporting cast
const before = await page.evaluate(() => S.projects.length);
await page.evaluate(() => { const b = document.querySelector('[data-action="gl-confirm"]'); if (b) b.click(); });
await wait(300);
const made = await page.evaluate(() => {
  const p = S.projects[S.projects.length - 1];
  return { count: S.projects.length, sup: p && p.supIds ? p.supIds.length : -1, booked: p && p.supIds ? p.supIds.every(id => { const t = findTalent(id); return t && talentBusy(t); }) : false };
});
check("greenlight creates the film", made.count === before + 1, "projects " + made.count);
check("the film carries its three supporting actors", made.sup === 3, "supIds " + made.sup);
check("supporting actors are booked", made.booked);
check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ") || "none");

await browser.close();
console.log(failed ? "\n" + failed + " CHECK(S) FAILED" : "\nSUPPORTING CAST BROWSER CHECKS PASSED");
process.exit(failed ? 1 : 0);
