/* Regression: a sandbox custom genre must be able to make titles, blurbs and IP.
   Before the fix, a custom genre had no DATA.TITLES / DATA.BLURBS entry, so
   genIpItem() (which picks any genre in DATA.GENRES) crashed in makeTitle().
   Needs the root site at BASE and CHROME_PATH. Exit 0 = pass. */
import { createRequire } from "module";
const req = createRequire(new URL("../package.json", import.meta.url));
const puppeteer = req("puppeteer-core");

const BASE = process.env.BASE || "http://localhost:8080/index.html";
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

await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 1200));
const res = await page.evaluate(() => {
  newGame("mogul", "Custom Genre Test Pictures", {});
  G.custom = G.custom || {};
  G.custom.genres = [{ id: "testgenre", base: "action", name: "Test Genre", emoji: "🧪", color: "#ff3366", mass: 1, legsAdj: 0, intlShare: 0.4 }];
  const added = NextWaveSuite.applyCustomGenres(G);
  let titles = 0, ips = 0, err = null;
  try {
    for (let i = 0; i < 300; i++) {
      if (makeTitle("testgenre")) titles++;
      if (genIpItem()) ips++;
    }
    // The IP market draws any genre in DATA.GENRES, so keep sampling the whole list.
    for (let i = 0; i < 200; i++) refreshIpMarket(i);
  } catch (e) { err = e.message; }
  const blurb = DATA.BLURBS.testgenre && DATA.BLURBS.testgenre.length;
  NextWaveSuite.clearCustomGenres();
  return { added, titles, ips, err, blurb, cleared: !DATA.TITLES.testgenre && !DATA.BLURBS.testgenre && !DATA.GENRES.testgenre };
});

check("custom genre is registered", res.added === 1, "added " + res.added);
check("titles generate for the custom genre", res.titles === 300, res.titles + "/300");
check("IP items generate with custom genres present", res.ips === 300, res.ips + "/300" + (res.err ? " · " + res.err : ""));
check("blurb pool exists for the custom genre", res.blurb > 0, "blurbs " + res.blurb);
check("clearing removes the custom genre and its pools", res.cleared);
check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ") || "none");

await browser.close();
console.log(failed ? "\n" + failed + " CHECK(S) FAILED" : "\nCUSTOM GENRE CHECKS PASSED");
process.exit(failed ? 1 : 0);
