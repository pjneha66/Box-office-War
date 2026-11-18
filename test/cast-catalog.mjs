/* Cast catalog + multi-pin check (root web build, headless Chromium).
   Needs the site served at BASE (default http://localhost:8080/index.html) and a Chrome binary
   at CHROME_PATH (default /usr/bin/chromium). Exit 0 = all checks passed. */
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
function check(name, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  ·  " + detail : ""));
  if (!ok) failed++;
}

await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
await new Promise(r => setTimeout(r, 1200));
await page.evaluate(() => { newGame("mogul", "Catalog Test Pictures", {}); });

const r = await page.evaluate(() => {
  const out = {};
  out.catalog = castCatalog().length;
  out.catalogAgain = castCatalog() === castCatalog();
  out.catalogIds = new Set(castCatalog().map(t => t.id)).size;
  out.rosterBefore = G.talent.length;
  G.studio.cash = 5000;
  const c = castCatalog()[0];
  out.cost = castSignCost(c);
  out.cashBefore = G.studio.cash;
  out.sign1 = castSign(c.id);
  out.signedNow = castSigned(c.id);
  out.rosterAfterSign = G.talent.length;
  out.cashAfterSign = G.studio.cash;
  out.sign2 = castSign(c.id);
  out.rosterAfterDup = G.talent.length;
  // multi-pin: roster people who are free
  const free = G.talent.filter(castIsFree);
  out.freeCount = free.length;
  const ids = free.slice(0, 5).map(t => String(t.id));
  out.pins = [];
  ids.forEach(id => pinCast(id, "film"));
  out.filmPins = castPinIds("film").length;
  out.filmPinsCapped = castPinIds("film").length <= 4;
  pinCast(ids[0], "film");
  out.afterUnpin = castPinIds("film").length;
  // seeding a pitch brings the pinned talent along (up to four leads)
  const wz = seedPinnedCast("film", { cast: [] });
  out.seeded = wz.cast.length;
  clearUsedCastPin("film", wz.cast);
  out.afterClear = castPinIds("film").length;
  // directory: catalog source renders sign buttons, roster source renders pins
  CAST_DIR.source = "catalog"; CAST_DIR.filter = "all"; CAST_DIR.q = "";
  CAST_DIR.limit = 60;
  out.catalogRows = castDirRows().length;
  out.catalogRowHtmlHasSign = castDirRow(castCatalog()[1]).indexOf("data-cast-sign") >= 0;
  CAST_DIR.source = "roster";
  out.rosterRows = castDirRows().length;
  return out;
});

check("catalog has 1,000 performers", r.catalog === 1000, String(r.catalog));
check("catalog is stable across calls", r.catalogAgain);
check("catalog ids are unique", r.catalogIds === r.catalog, r.catalogIds + " unique");
check("signing adds one roster member", r.rosterAfterSign === r.rosterBefore + 1, r.rosterBefore + " → " + r.rosterAfterSign);
check("signing charges the signing fee", Math.abs((r.cashBefore - r.cashAfterSign) - r.cost) < 0.11, "cost " + r.cost);
check("signed catalog member is marked on roster", r.signedNow);
check("a second signing of the same person is refused", r.sign2 === false && r.rosterAfterDup === r.rosterAfterSign);
check("pins accept several performers per slot (4 of 5 free talent)", r.filmPins === 4, r.filmPins + " pinned, free roster " + r.freeCount);
check("the fifth pin is refused (cap of four per slot)", r.filmPinsCapped && r.filmPins === 4);
check("unpinning one removes just that pin", r.afterUnpin === 3, r.afterUnpin + " left");
check("pitch seeding brings all three pinned performers onto the cast", r.seeded === 3, r.seeded + " seeded");
check("clearing used pins empties the slot", r.afterClear === 0, r.afterClear + " left");
check("catalog source lists performers to browse", r.catalogRows === 1000, r.catalogRows + " rows");
check("catalog rows offer a Sign button", r.catalogRowHtmlHasSign);
check("roster source still lists the roster", r.rosterRows >= 1, r.rosterRows + " rows");
check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "none");

await browser.close();
console.log(failed ? "\n" + failed + " CHECK(S) FAILED" : "\nALL CAST CATALOG CHECKS PASSED");
process.exit(failed ? 1 : 0);
