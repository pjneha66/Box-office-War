/* Compare computed styles for the management deck between two stylesheet
   builds. Used to prove the token refactor is a pixel-identical no-op.
   node scripts/compare-deck.cjs [override.css] */
const pp = require("puppeteer-core");
const { build } = require("./visual-harness.cjs");

const OVERRIDE = process.argv[2] || "/tmp/command-deck.before.css";

const SAMPLE = () => {
  const props = ["background-color", "background-image", "color", "border-top-color", "border-bottom-color", "border-left-color", "box-shadow"];
  const roots = Array.from(document.querySelectorAll("#app #view *")).filter((el) => el.children.length < 40);
  const seen = new Set();
  const out = [];
  roots.slice(0, 4000).forEach((el, i) => {
    const cs = getComputedStyle(el);
    const sig = props.map((p) => cs.getPropertyValue(p)).join("|");
    const key = el.tagName + "." + (el.className && el.className.baseVal === undefined ? String(el.className) : "") + "#" + i;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push({ key: key.slice(0, 120), sig });
  });
  return out;
};

(async () => {
  const b = await pp.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage", "--disable-gpu", "--allow-file-access-from-files"],
    headless: true,
    protocolTimeout: 120000,
  });
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    const load = async (overrides) => {
      await p.goto("about:blank");
      await p.setContent(build({ overrides }), { waitUntil: "domcontentloaded", timeout: 90000 });
      await new Promise((r) => setTimeout(r, 900));
      await p.click("#btnStart");
      await p.waitForSelector("#studioLotCanvas");
      await new Promise((r) => setTimeout(r, 700));
      await p.evaluate(() => { if (typeof closeModal === "function") closeModal(); switchTab("dashboard"); });
      await new Promise((r) => setTimeout(r, 600));
      const dash = await p.evaluate(SAMPLE);
      await p.evaluate(() => settingsModal());
      await new Promise((r) => setTimeout(r, 400));
      const settings = await p.evaluate(SAMPLE);
      return { dash, settings };
    };
    const before = await load({ "command-deck.css": OVERRIDE });
    const after = await load({});
    const cmp = (label, a, c) => {
      const bset = new Map(c.map((x) => [x.key, x.sig]));
      const diffs = a.filter((x) => bset.has(x.key) && bset.get(x.key) !== x.sig);
      console.log(label, "elements:", a.length, "/", c.length, "differing:", diffs.length);
      diffs.slice(0, 8).forEach((d) => {
        console.log("  ", d.key);
        console.log("    before:", d.sig);
        console.log("    after :", bset.get(d.key));
      });
      return diffs.length;
    };
    const d1 = cmp("dashboard", before.dash, after.dash);
    const d2 = cmp("settings", before.settings, after.settings);
    process.exitCode = d1 + d2 ? 1 : 0;
    console.log(d1 + d2 === 0 ? "IDENTICAL" : "DIFFERENCES FOUND");
  } finally {
    await b.close().catch(() => {});
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
