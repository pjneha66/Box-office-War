/* Rebuild games-module harness (pattern from test/rebuild-pr.mjs): runs game/data.js +
   game/engine.js + game/games.js in a VM sandbox with a stubbed localStorage. ui.js needs a
   DOM, so the one ui helper the desk renders with (tag) is stubbed verbatim. Drives 60
   advanceWeek() calls, calling tickGames() after each (the integrator's wiring), and
   exercises every system through the module's real functions: found studio, engine R&D,
   a synergy game through completion + 10-week sales run, GameCon booth boost on a second
   (non-synergy) release, insufficient-cash rejections.
   Prints one line per check; exits non-zero on failure. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
}
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }

const mem = {};
const ctx = vm.createContext({
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
  Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  },
  /* ui.js helper (ui.js itself can't load without a DOM); same behavior as ui.js */
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "games.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const woy = () => C.woyOf(S().studio.week);

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "games.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickGames/gamesAction/forecastAdjust",
  typeof C.tickGames === "function" && typeof C.gamesAction === "function" &&
  typeof C.forecastAdjust === "function");
check("GAMES_DESKS is a shaped 1-desk array (games-hq / Game studio)",
  Array.isArray(C.GAMES_DESKS) && C.GAMES_DESKS.length === 1 &&
  C.GAMES_DESKS[0].id === "games-hq" && C.GAMES_DESKS[0].group === "Game studio" &&
  C.GAMES_DESKS[0].icon === "🎮" && C.GAMES_DESKS[0].name === "Game studio" &&
  typeof C.GAMES_DESKS[0].render === "function");
check("synergy table: 18 well-formed Topic|Genre pairs",
  C.GAME_SYNERGY.length === 18 && C.GAME_SYNERGY.every((p) => {
    const [t, g] = p.split("|");
    return C.GAME_TOPICS.indexOf(t) >= 0 && C.GAME_GENRES.indexOf(g) >= 0;
  }));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek();
      C.tickGames(); /* integrator wiring: engine calls tickGames() after its own systems */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.GAMES_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("desk renders clean " + label, bad === "", bad);
}
function stub(key, idx) {
  return { getAttribute: (k) => (k === "data-key" ? (key != null ? key : null) : k === "data-idx" ? (idx != null ? String(idx) : null) : null) };
}

/* ── week 1: lazy ensure + pre-founding rejections ────────────── */
C.newGame("Games Test Studios", "major");
C.tickGames();
check("S.games namespace created lazily by tickGames", !!S().games && S().games.studio === false);
check("forecastAdjust is a number and 0 with no releases", typeof C.forecastAdjust(50) === "number" && C.forecastAdjust(50) === 0);
check("develop rejected before founding", !!C.gamesStartDev().err);
check("engine R&D rejected before founding", !!C.gamesEngineUp().err);
check("booth rejected outside GameCon window (woy " + woy() + ")", !!C.gamesBooth().err);
const cashBeforeFound = S().studio.cash;
S().studio.cash = 10;
check("insufficient cash rejected for founding, no state change",
  !!C.gamesFound().err && S().games.studio === false && nearly(S().studio.cash, 10));
S().studio.cash = cashBeforeFound;
S().studio.cash += 240; /* test subsidy so all mechanics are affordable */
check("gamesAction returns false for foreign actions", C.gamesAction("gl-open", stub()) === false);

/* ── found + engine R&D ───────────────────────────────────────── */
const c0 = S().studio.cash;
check("found studio ok", C.gamesAction("games-found", stub()) === true && S().games.studio === true);
check("founding cost $40M", nearly(c0 - S().studio.cash, 40));
check("second founding rejected", !!C.gamesFound().err);
check("engine upgrade #1 ok", C.gamesEngineUp().ok && S().games.engineLvl === 1 && nearly(c0 - 40 - S().studio.cash, 20));
desksRenderClean("(w1, just founded)");

/* ── synergy game: Fantasy × RPG, $10M tier, 8 dev weeks ─────── */
check("picker: topic via gamesAction", C.gamesAction("games-topic", stub("Fantasy")) === true && C.GAME_PICK.topic === "Fantasy");
check("picker: genre via gamesAction", C.gamesAction("games-genre", stub("RPG")) === true && C.GAME_PICK.genre === "RPG");
check("picker: tier via gamesAction", C.gamesAction("games-tier", stub(null, 0)) === true && C.GAME_PICK.tier === 0);
check("confirm starts dev", C.gamesAction("games-confirm", stub()) === true && !!S().games.dev);
check("dev fields: synergy, 8 weeks, $10M budget",
  S().games.dev.syn === true && S().games.dev.weeks === 8 && S().games.dev.budget === 10 && S().games.dev.wk === 0);
const devTitle = S().games.dev.title;
check("dev title generated (no undefined)", typeof devTitle === "string" && devTitle.length > 0 && devTitle.indexOf("undefined") < 0);
C.tickGames(); /* double-call in the same week must be a no-op */
check("tickGames is idempotent within a week", S().games.dev.wk === 0);
const devCash = S().studio.cash;
check("second dev rejected (one at a time)", !!C.gamesStartDev().err && S().games.dev.title === devTitle);

advance(1); /* week 2: first burn */
let row = S().weekTx.rows.find((r) => r.k === "GDD · " + devTitle);
check("weekly GDD burn recorded ($10M / 8 wk ≈ 1.25)", !!row && nearly(row.v, -(Math.round((10 / 8) * 10) / 10)), row ? String(row.v) : "no row");

advance(7); /* weeks 3–9: dev completes at week 9 */
check("no throw through completion", threw === null, threw || weeksDriven + " weeks");
check("dev completed and released automatically", !S().games.dev && S().games.released.length === 1);
const g1 = S().games.released[0];
check("release title = dev title", g1.title === devTitle);
check("quality clamped 5..98", isFinite(g1.quality) && g1.quality >= 5 && g1.quality <= 98, String(g1.quality));
check("4 press reviews recorded", Array.isArray(g1.reviews) && g1.reviews.length === 4 &&
  g1.reviews.every((r) => C.GAME_OUTLETS.indexOf(r.n) >= 0 && r.score >= 5 && r.score <= 99),
  g1.reviews.map((r) => r.n + " " + r.score).join(" · "));
const avg = Math.round(g1.reviews.reduce((a, r) => a + r.score, 0) / g1.reviews.length);
check("pressAvg = mean of the 4 reviews", g1.pressAvg === avg && g1.pressAvg >= 5 && g1.pressAvg <= 99, String(g1.pressAvg));
check("release week recorded, no boost without booth", g1.relWeek === 9 && g1.boost === 1 && g1.sold === 0 && g1.done === false);
check("sales run not started at release week: forecast(9)=0", C.forecastAdjust(9) === 0);
const f10 = C.forecastAdjust(10);
check("forecastAdjust(week+1) > 0", f10 > 0, String(f10));
check("forecast matches earn formula (quality/100·budget·0.42·0.85^0)",
  nearly(f10, Math.round((g1.quality / 100) * 10 * 0.42 * 1 * 10) / 10));
check("forecast is 0 past the 10-week run", C.forecastAdjust(20) === 0);

/* ── sales run weeks 10–19 ────────────────────────────────────── */
advance(1); /* week 10: first sales week */
row = S().weekTx.rows.find((r) => r.k === "Game sales · " + devTitle);
check("game sales earn matches forecast exactly", !!row && nearly(row.v, f10), row ? String(row.v) : "no row");
check("sold accumulates", nearly(g1.sold, f10));
const soldAt10 = g1.sold;
C.tickGames(); /* double-call must not earn twice */
check("tickGames sales idempotent within a week", nearly(g1.sold, soldAt10));

advance(9); /* weeks 11–19: run completes */
check("10-week sales run completed", g1.done === true);
check("sales total positive and finite", isFinite(g1.sold) && g1.sold > soldAt10, String(g1.sold));
check("run-end logged", S().news.some((n) => n.txt.indexOf(devTitle) >= 0 && n.txt.indexOf("10-week sales run") >= 0));

/* ── engine R&D to max ────────────────────────────────────────── */
check("engine upgrade #2 ok", C.gamesEngineUp().ok && S().games.engineLvl === 2);
check("engine upgrade #3 ok", C.gamesEngineUp().ok && S().games.engineLvl === 3);
check("engine R&D maxed at Lv 3", !!C.gamesEngineUp().err && S().games.engineLvl === 3);

/* ── GameCon booth (woy 22–24) + non-synergy game ─────────────── */
advance(3); /* weeks 20–22 */
check("reached GameCon window", woy() >= 22 && woy() <= 24, "wk " + S().studio.week);
const cb0 = S().studio.cash;
check("booth bought once per year", C.gamesBooth().ok && S().games.conBooth === true && S().games.conYear === S().studio.year && nearly(cb0 - S().studio.cash, 5));
check("second booth same year rejected", !!C.gamesBooth().err && S().games.conBooth === true);

check("picker: non-synergy Cooking × RPG", C.gamesAction("games-topic", stub("Cooking")) === true && C.gamesAction("games-genre", stub("RPG")) === true && C.gamesAction("games-tier", stub(null, 1)) === true);
S().studio.cash = 1;
const poorDev = C.gamesStartDev();
check("insufficient cash rejected for dev, no state change", !!poorDev.err && S().games.dev === null, poorDev.err || "");
S().studio.cash = cb0 - 5;
check("confirm starts non-synergy dev", C.gamesAction("games-confirm", stub()) === true && !!S().games.dev);
check("dev2 fields: no synergy, 10 weeks, $25M budget",
  S().games.dev.syn === false && S().games.dev.weeks === 10 && S().games.dev.budget === 25);
const dev2Title = S().games.dev.title;

advance(1); /* week 23 */
row = S().weekTx.rows.find((r) => r.k === "GDD · " + dev2Title);
check("dev2 burn $2.5M/wk", !!row && nearly(row.v, -2.5), row ? String(row.v) : "no row");
advance(9); /* weeks 24–32: dev2 completes */
check("dev2 completed and released with GameCon boost",
  !S().games.dev && S().games.released.length === 2 && S().games.released[0].title === dev2Title);
const g2 = S().games.released[0];
check("GameCon flag consumed: boost ×1.2", g2.boost === 1.2 && S().games.conBooth === false);
check("g1 boost untouched", g1.boost === 1);
const f33 = C.forecastAdjust(33);
check("boosted forecast = formula ×1.2", nearly(f33, Math.round((g2.quality / 100) * 25 * 0.42 * Math.pow(0.85, 0) * 1.2 * 10) / 10) && f33 > 0, String(f33));

advance(10); /* weeks 33–42: g2 sales run completes */
check("g2 run completed with boosted total", g2.done === true && isFinite(g2.sold) && g2.sold > 0, String(g2.sold));
check("g2 total > unboosted equivalent", g2.sold > (g2.quality / 100) * 25 * 0.42 * 5.36);

/* ── final: 60 weeks driven, everything finite ────────────────── */
advance(19); /* weeks 43–61 — total 60 advanceWeek() calls */
check("no throw and cash finite all 60 weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("60 advanceWeek calls driven", weeksDriven >= 60, String(weeksDriven));
check("S.games namespace exists at end", !!S().games);
const G = S().games;
let fieldsFinite = typeof G.studio === "boolean" && isFinite(G.engineLvl) && isFinite(G.conYear)
  && G.released.every((g) => isFinite(g.quality) && isFinite(g.pressAvg) && isFinite(g.sold) && isFinite(g.relWeek) && isFinite(g.boost)
    && g.reviews.every((r) => isFinite(r.score)));
check("all games state fields finite", fieldsFinite);
check("both games done, totals positive", G.released.length === 2 && G.released.every((g) => g.done && g.sold > 0));
check("forecastAdjust returns a number at end", typeof C.forecastAdjust(S().studio.week + 1) === "number");
check("forecastAdjust far-future week is 0", C.forecastAdjust(9999) === 0);
desksRenderClean("(w61, 2 released games, picker state kept)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
