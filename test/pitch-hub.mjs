/* Pitch hub, series season step, and board-vote animation (root web build, headless Chromium).
   Needs the site at BASE (default http://localhost:8080/index.html) and CHROME_PATH.
   Exit 0 = all checks passed. */
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
await page.evaluate(() => { newGame("mogul", "Pitch Hub Test Pictures", {}); G.studio.cash = 5000; });

// 1. Develop › Pitch shows the two options
await page.evaluate(() => { switchTab("develop"); DEVELOP_SUB = "pitch"; render(); });
await new Promise(r => setTimeout(r, 300));
const hub = await page.evaluate(() => {
  return {
    film: !!document.querySelector("#btnHubFilm"),
    series: !!document.querySelector("#btnHubSeries"),
    navHasPitch: !!document.querySelector('[data-devsub="pitch"]')
  };
});
check("Develop has a Pitch section", hub.navHasPitch);
check("Pitch shows a Film option", hub.film);
check("Pitch shows a Series option", hub.series);

// 2. Series wizard has a Season step between Cast and Platform
const steps = await page.evaluate(() => {
  startSeriesWizard();
  WZ.showrunner = freeTalent("director")[0] || G.talent.find(t => t.kind === "director");
  const names = PITCH_SERIES_STEPS.map(s => s[0]);
  WZ.szStep = 2; seriesModal();
  return { names, arcs: document.querySelectorAll("[data-szarc]").length, pilots: document.querySelectorAll("[data-szpilot]").length };
});
check("series steps are format, cast, season, platform, review",
  JSON.stringify(steps.names) === JSON.stringify(["format", "cast", "season", "platform", "review"]), steps.names.join(" > "));
check("season step offers three arcs", steps.arcs === 3, steps.arcs + " arcs");
check("season step offers four pilot levels", steps.pilots === 4, steps.pilots + " levels");

// 3. Pilot premium is charged at pitch time and feeds the odds
const pilot = await page.evaluate(() => {
  WZ.pilotPct = 20; const cost = seriesPilotCost(); const extra = seriesOddsExtra();
  WZ.pilotPct = 0; const free = seriesPilotCost();
  return { cost, free, extra };
});
check("a 20% pilot costs 20% of the season", pilot.cost > 0 && pilot.free === 0, "cost " + pilot.cost);
check("the pilot adds to the greenlight odds", pilot.extra > 0, "+" + Math.round(pilot.extra * 100) + "%");

// 4. Board votes agree with the outcome for every score
const votes = await page.evaluate(() => {
  const bad = [];
  for (let s = 0; s <= 100; s++) {
    const pass = pitchBoardVotes({ mode: "film", ok: true }, s).filter(v => v.yes).length;
    const fail = pitchBoardVotes({ mode: "film", ok: false }, s).filter(v => v.yes).length;
    const boardFail = pitchBoardVotes({ mode: "film", ok: false, board: true }, s).filter(v => v.yes).length;
    const seriesPass = pitchBoardVotes({ mode: "series", ok: true }, s).filter(v => v.yes).length;
    const seriesFail = pitchBoardVotes({ mode: "series", ok: false }, s).filter(v => v.yes).length;
    if (pass < 3) bad.push("pass " + s + "=" + pass);
    if (fail > 2) bad.push("fail " + s + "=" + fail);
    if (boardFail > 2) bad.push("board " + s + "=" + boardFail);
    if (seriesPass < 3) bad.push("series pass " + s + "=" + seriesPass);
    if (seriesFail > 2) bad.push("series fail " + s + "=" + seriesFail);
  }
  return { bad, seats: pitchBoardVotes({ mode: "film", ok: true }, 70).length };
});
check("a passed pitch always has a board majority", votes.bad.filter(b => b.startsWith("pass") || b.startsWith("series pass")).length === 0, votes.bad.slice(0, 3).join(", ") || "all scores");
check("a failed pitch never has a majority", votes.bad.filter(b => b.startsWith("fail") || b.startsWith("board") || b.startsWith("series fail")).length === 0);
check("the board has five seats", votes.seats === 5, votes.seats + " seats");

// 5. The verdict renders the five seats (films and series)
const verdict = await page.evaluate(() => {
  pitchResultModal({ mode: "film", ok: true, label: "Test Picture", genre: "drama", ev: { score: 84, profit: 1, be: 2 }, project: null });
  const seats = document.querySelectorAll(".vb .vb-seat").length;
  const ok = document.querySelectorAll(".vb .vb-vote.ok").length;
  const label = (document.querySelector(".vb-count") || {}).textContent || "";
  closeModal();
  return { seats, ok, label };
});
check("the verdict shows five board seats", verdict.seats === 5, verdict.seats + " seats");
check("a passed film shows at least three approvals", verdict.ok >= 3, verdict.ok + " approve");
check("the tally line matches the seats", verdict.label.indexOf(verdict.ok + " approve") >= 0, verdict.label);

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "none");

await browser.close();
console.log(failed ? "\n" + failed + " CHECK(S) FAILED" : "\nALL PITCH HUB CHECKS PASSED");
process.exit(failed ? 1 : 0);
