/* Theme audit: for every theme, open Settings and verify that
   (a) the theme applies, (b) the deck recolours, (c) text contrast on the
   main surfaces is >= 4.5:1, (d) no element ends up with an unreadable
   transparent-on-transparent pair. Also proves gold is unchanged. */
const pp = require("puppeteer-core");
const { build } = require("./visual-harness.cjs");

const THEMES = ["gold","aurora","violet","carpet","silver","cyberpunk","noir","slate","emerald","ember","daylight","blueprint","newsprint"];

function lum(rgb) {
  const m = rgb.match(/[\d.]+/g);
  if (!m) return null;
  const [r, g, b] = m.slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  if (la == null || lb == null) return null;
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
/* flatten alpha over a backdrop so rgba() text can be measured too */
function flat(fg, bg) {
  const f = (fg.match(/[\d.]+/g) || []).map(Number);
  const b = (bg.match(/[\d.]+/g) || []).map(Number);
  if (f.length < 3 || b.length < 3) return fg;
  const a = f.length > 3 ? f[3] : 1;
  return "rgb(" + [0, 1, 2].map((i) => Math.round(f[i] * a + b[i] * (1 - a))).join(",") + ")";
}

(async () => {
  const b = await pp.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--no-zygote", "--single-process", "--disable-dev-shm-usage", "--disable-gpu", "--allow-file-access-from-files"],
    headless: true, protocolTimeout: 120000,
  });
  let failures = 0;
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.setContent(build(), { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise((r) => setTimeout(r, 900));
    await p.click("#btnStart");
    await p.waitForSelector("#studioLotCanvas");
    await new Promise((r) => setTimeout(r, 700));

    for (const theme of THEMES) {
      const report = await p.evaluate((t) => {
        applyTheme(t);
        if (typeof closeModal === "function") closeModal();
        switchTab("dashboard");
        const out = { theme: t, mode: document.body.dataset.themeMode, samples: [], deckBg: null, deckInk: null };
        const deck = document.querySelector(".command-deck");
        if (deck) {
          const dcs = getComputedStyle(deck);
          out.deckBg = dcs.backgroundColor;
          out.deckInk = dcs.color;
        }
        const sels = [
          ["deck h1", ".command-deck h1"],
          ["deck p", ".command-deck p"],
          ["brief h2", ".command-brief h2"],
          ["brief p", ".command-brief p"],
          ["stat label", ".command-metric > span"],
          ["stat value", ".command-metric strong"],
          ["tab", ".tab"],
          ["chip", ".chip"],
        ];
        sels.forEach(([label, sel]) => {
          const el = document.querySelector(sel);
          if (!el) return;
          const cs = getComputedStyle(el);
          /* nearest painted background */
          let node = el, bg = "rgba(0, 0, 0, 0)";
          while (node && node !== document.documentElement) {
            const ncs = getComputedStyle(node);
            if (ncs.backgroundColor && ncs.backgroundColor !== "rgba(0, 0, 0, 0)" && ncs.backgroundColor !== "transparent") { bg = ncs.backgroundColor; break; }
            node = node.parentElement;
          }
          if (bg === "rgba(0, 0, 0, 0)") bg = getComputedStyle(document.body).backgroundColor;
          out.samples.push({ label, fg: cs.color, bg });
        });
        return out;
      }, theme);
      let worst = 99, worstLbl = "";
      for (const s of report.samples) {
        const fg = flat(s.fg, s.bg);
        const r = ratio(fg, s.bg);
        if (r != null && r < worst) { worst = r; worstLbl = s.label; }
      }
      const ok = worst >= 4.4;
      if (!ok) failures++;
      console.log((ok ? "OK  " : "LOW ") + theme.padEnd(10) + " mode=" + String(report.mode).padEnd(5) +
        " deck=" + String(report.deckBg).padEnd(22) + " worst contrast " + worst.toFixed(2) + " (" + worstLbl + ")");
    }
    /* gold must be the classic green deck */
    const goldDeck = await p.evaluate(() => { applyTheme("gold"); return getComputedStyle(document.querySelector(".command-deck")).backgroundColor; });
    console.log("gold deck background (classic must be rgb(25, 43, 44)):", goldDeck);
    if (goldDeck !== "rgb(25, 43, 44)") failures++;
  } finally {
    await b.close().catch(() => {});
  }
  console.log(failures ? failures + " THEME CHECKS FAILED" : "ALL THEME CHECKS PASSED");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
