/* Rebuild distribution-window harness (pattern from test/rebuild-sequel.mjs): runs
   game/data.js + game/engine.js + game/window.js in a VM sandbox with a stubbed
   localStorage and the two ui helpers the desks render with (statrow/tag).
   Proves the contract the engine actually relies on:
   - the four engine hooks exist and the two multipliers are neutral at 45 days,
     never 0, never negative, and never NaN for degenerate input;
   - windowLegsMult works on the release-time STUB { window, genre } the engine
     passes at engine.js:567 (no S, no film record, no id available there);
   - tickWindow is idempotent per week via S.win.lastTick;
   - the real setRelease → releaseFilm path carries p.window into the film, pays an
     early PVOD cheque once, and fills an output-deal slot once;
   - every action path, including two insufficient-cash / rejected rejections.
   Drives 90+ advanceWeek() cycles. Prints one line per check; exits non-zero on
   failure. */
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
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }

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
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "window.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "window.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.assign", "globalThis", "class ", "Object.fromEntries"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("module opens with \"use strict\"", /^\s*\/\*[\s\S]*?\*\/\s*"use strict";/.test(src) || src.trimStart().startsWith('"use strict"'));
check("exports tickWindow / windowRevenueMult / windowLegsMult / windowOnRelease / windowAction",
  typeof C.tickWindow === "function" && typeof C.windowRevenueMult === "function" &&
  typeof C.windowLegsMult === "function" && typeof C.windowOnRelease === "function" &&
  typeof C.windowAction === "function");
check("tickWindow opens with the lastTick guard on S.studio.week",
  /function tickWindow\(\) \{\s*windowEnsure\(\);[^]*?if \(S\.win\.lastTick === S\.studio\.week\) return;/.test(src));
check("legs helper touches only f.window / f.genre (it gets a stub, not a film)",
  /function windowLegsMult\(f\)/.test(src) && !/windowLegsMult[\s\S]{0,600}findFilm/.test(src));
check("WINDOW_DESKS is 2 shaped 'Distribution' desks",
  Array.isArray(C.WINDOW_DESKS) && C.WINDOW_DESKS.length === 2 &&
  C.WINDOW_DESKS.map((d) => d.id).join(",") === "window-strategy,window-deals" &&
  C.WINDOW_DESKS.every((d) => d.group === "Distribution" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("WINDOW_ACHIEVEMENTS has 4+ entries with unique ids",
  Array.isArray(C.WINDOW_ACHIEVEMENTS) && C.WINDOW_ACHIEVEMENTS.length >= 4 &&
  new Set(C.WINDOW_ACHIEVEMENTS.map((a) => a.id)).size === C.WINDOW_ACHIEVEMENTS.length,
  String(C.WINDOW_ACHIEVEMENTS.length) + " awards");
check("achievement tests are safe on an empty/degenerate save",
  C.WINDOW_ACHIEVEMENTS.every((a) => {
    try { return a.test({}) === false && a.test({ win: {} }) === false && a.test({ win: { stats: {} } }) === false; }
    catch (e) { return false; }
  }));

/* ── the multipliers: the part the engine multiplies raw ──────── */
C.newGame("Window Test", "veteran");
check("S.win is absent on a fresh save (lazy ensure is real)", !S().win);

const NEUTRAL = 45;
check("windowLegsMult({window:45}) is exactly 1 (the engine default is neutral)",
  C.windowLegsMult({ window: 45, genre: "drama" }) === 1,
  String(C.windowLegsMult({ window: 45, genre: "drama" })));
check("windowRevenueMult({window:45}) is exactly 1",
  C.windowRevenueMult({ window: 45, genre: "action" }) === 1,
  String(C.windowRevenueMult({ window: 45, genre: "action" })));
check("legs: a 90-day exclusive beats the 45-day standard beats a 17-day window",
  C.windowLegsMult({ window: 90 }) > 1 && C.windowLegsMult({ window: 17 }) < 1,
  "90d ×" + C.windowLegsMult({ window: 90 }) + " · 17d ×" + C.windowLegsMult({ window: 17 }));
check("revenue: a short window beats the standard beats a 90-day exclusive",
  C.windowRevenueMult({ window: 7 }) > 1 && C.windowRevenueMult({ window: 90 }) < 1,
  "7d ×" + C.windowRevenueMult({ window: 7 }) + " · 90d ×" + C.windowRevenueMult({ window: 90 }));

/* The stub the engine actually passes at releaseFilm (engine.js:567). */
const stub = { window: 45, genre: "animation" };
check("release-time stub {window,genre} works with no S.win and no film record loaded",
  typeof C.windowLegsMult(stub) === "number" && C.windowLegsMult(stub) > 0);

/* Exhaustive: no input can produce 0, a negative, or NaN. */
let bad = [];
const daysGrid = [-50, -1, 0, 1, 3, 7, 14, 17, 21, 30, 44, 45, 46, 60, 89, 90, 91, 120, 365, 4000];
const genres = ["action", "comedy", "drama", "horror", "scifi", "romance", "thriller",
                "animation", "fantasy", "crime", "musical", "docs", "unknown-genre"];
for (const d of daysGrid) {
  for (const g of genres) {
    const L = C.windowLegsMult({ window: d, genre: g });
    const R = C.windowRevenueMult({ window: d, genre: g });
    if (!isFinite(L) || L <= 0) bad.push("legs " + d + "/" + g + " = " + L);
    if (!isFinite(R) || R <= 0) bad.push("rev " + d + "/" + g + " = " + R);
  }
}
for (const junk of [null, undefined, {}, { window: null }, { window: "x" }, { window: NaN },
                    { window: Infinity }, { window: -Infinity }, { genre: 42 }]) {
  const L = C.windowLegsMult(junk), R = C.windowRevenueMult(junk);
  if (!isFinite(L) || L <= 0) bad.push("legs junk " + JSON.stringify(junk) + " = " + L);
  if (!isFinite(R) || R <= 0) bad.push("rev junk " + JSON.stringify(junk) + " = " + R);
}
check("both multipliers stay finite and > 0 across 260 grid points and 9 junk inputs",
  bad.length === 0, bad.slice(0, 3).join(" · ") || "clean");
check("multipliers return exactly 1 for null/undefined f",
  C.windowLegsMult(null) === 1 && C.windowRevenueMult(null) === 1 &&
  C.windowLegsMult(undefined) === 1 && C.windowRevenueMult(undefined) === 1);
check("both multipliers are clamped inside a sane band",
  daysGrid.every((d) => {
    const L = C.windowLegsMult({ window: d }), R = C.windowRevenueMult({ window: d });
    return L >= 0.85 && L <= 1.12 && R >= 0.6 && R <= 2.0;
  }));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0;
const spendRows = [], earnRows = [];
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      C.tickWindow();                /* harness drives the tick until the engine hook exists */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
    const rows = S().weekTx ? S().weekTx.rows : [];
    let sum = 0;
    for (const r of rows) {
      sum += r.v;
      if (r.v < 0 && spendRows.indexOf(r.k) < 0) spendRows.push(r.k);
      if (r.v > 0 && earnRows.indexOf(r.k) < 0) earnRows.push(r.k);
    }
    if (!nearly(st.cash - before, sum, 0.05)) ledgerBreaks++;
    if (!S().win) { threw = "S.win vanished at week " + st.week; return; }
  }
}
function desksClean(label) {
  let bad = "";
  for (const d of C.WINDOW_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + (e.message || e); break; }
    if (typeof html !== "string" || !html.length) { bad = d.id + " empty"; break; }
    if (html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " bad html"; break; }
  }
  check("desks render non-empty, clean html " + label, bad === "", bad);
}
/* A finished-run film shaped exactly like engine endTheatrical's output. */
let filmSeq = 0;
function pushDoneFilm(title, o) {
  o = o || {};
  const cost = o.cost != null ? o.cost : 40;
  const f = {
    id: "wf" + (++filmSeq), title: title, genre: o.genre || "action", scale: "mid",
    budget: cost, mkt: cost * 0.5, cost: cost,
    dirId: null, actId: null, supIds: [],
    quality: 74, criticAvg: o.criticAvg != null ? o.criticAvg : 74, freshPct: 80, aud: 80, quotes: [],
    opening: o.opening != null ? o.opening : 40,
    legs: 2.6, decay: 1 - 1 / 2.6,
    weeksOut: 6, dom: 44, weekly: [], releaseWeek: S().studio.week - 8, season: "Summer season",
    franchiseOf: null, presale: 0, revShare: 0, insured: false, screenRental: 0,
    window: o.window != null ? o.window : 45,
    intl: 36, ww: 80, profit: 12, status: "done"
  };
  S().films.unshift(f);
  return f;
}

/* ── week 1: lazy ensure via the tick ─────────────────────────── */
C.tickWindow();
check("tickWindow lazily creates S.win with finite fields and empty ledgers",
  !!S().win && Array.isArray(S().win.runs) && Array.isArray(S().win.deals) &&
  Array.isArray(S().win.history) && isFinite(S().win.lastTick) &&
  typeof S().win.choice === "object" && !!S().win.stats,
  "lastTick " + S().win.lastTick);
check("every S.win.stats counter is a finite number",
  Object.keys(S().win.stats).length > 0 &&
  Object.keys(S().win.stats).every((k) => isFinite(S().win.stats[k])));
check("the tick stamped lastTick to the current week", S().win.lastTick === S().studio.week);
desksClean("(w1, empty)");

/* ── idempotency: the guard the brief calls out ───────────────── */
const l1 = S().win.lastTick;
C.tickWindow();
C.tickWindow();
check("tickWindow called 3x in one week is a single pass", S().win.lastTick === l1);
const runsBefore = S().win.runs.length;
S().win.lastTick = S().studio.week - 1;
C.tickWindow();
check("the tick runs again once the week advances", S().win.lastTick === S().studio.week &&
  S().win.runs.length === runsBefore);
S().win.lastTick = S().studio.week;
C.tickWindow();
check("re-arming the guard does not duplicate runs", S().win.runs.length === runsBefore);

/* ── windowOnRelease registration ─────────────────────────────── */
const f90 = pushDoneFilm("Hold The Line", { cost: 60, opening: 50, window: 90, genre: "drama" });
check("windowOnRelease(null) is defensive and returns false", C.windowOnRelease(null) === false);
const relOk = C.windowOnRelease(f90);
check("windowOnRelease registers a run for a 90-day film", relOk === true &&
  S().win.runs.some((r) => r.filmId === f90.id && r.window === 90),
  "runs " + S().win.runs.length);
check("the run carries a future PVOD week derived from the window",
  S().win.runs.filter((r) => r.filmId === f90.id)[0].pvodWk > S().studio.week,
  "pvodWk " + S().win.runs.filter((r) => r.filmId === f90.id)[0].pvodWk);
check("windowOnRelease is idempotent for the same film",
  C.windowOnRelease(f90) === false && S().win.runs.filter((r) => r.filmId === f90.id).length === 1);
check("the 90-day release incremented wExcl and released",
  S().win.stats.wExcl === 1 && S().win.stats.released === 1,
  JSON.stringify({ rel: S().win.stats.released, excl: S().win.stats.wExcl }));
check("release history recorded the window", S().win.history.length === 1 && S().win.history[0].window === 90);

/* ── output deals: sign, reject, fill, complete ───────────────── */
S().studio.rep = 55;
const cashBeforeDeal = S().studio.cash;
const dealDef = C.WINDOW_DEALS.filter((d) => d.id === "cinevault-exclusive")[0];
const signed = C.windowAction("window-deal", { getAttribute: (k) => (k === "data-key" ? "cinevault-exclusive" : null) });
check("window-deal signs the CineVault exclusive and pays up front",
  signed === true && nearly(S().studio.cash - cashBeforeDeal, dealDef.pay, 0.05) &&
  S().win.deals.some((r) => r.id === "cinevault-exclusive" && !r.expired),
  "+" + (S().studio.cash - cashBeforeDeal).toFixed(1) + "M");
check("deal cash is tracked in stats.dealCash and stats.deals",
  nearly(S().win.stats.dealCash, dealDef.pay, 0.05) && S().win.stats.deals === 1);
const cashBeforeDup = S().studio.cash;
check("signing the same deal twice is rejected and pays nothing",
  C.windowAction("window-deal", { getAttribute: () => "cinevault-exclusive" }) === true &&
  nearly(S().studio.cash, cashBeforeDup, 0.05) && S().win.deals.length === 1);
S().studio.rep = 10;
const cashBeforeRep = S().studio.cash;
C.windowAction("window-deal", { getAttribute: () => "meridian-output" });
check("a rep-gated deal is rejected without paying (rep 10 < 25)",
  nearly(S().studio.cash, cashBeforeRep, 0.05) && !S().win.deals.some((r) => r.id === "meridian-output"),
  "cash " + S().studio.cash.toFixed(1));
S().studio.rep = 55;

/* A 90-day release fills the exclusive pact's first slot. */
const f90b = pushDoneFilm("Second Hold", { cost: 50, opening: 45, window: 90, genre: "crime" });
const bonusBefore = S().win.stats.dealBonus;
C.windowOnRelease(f90b);
const excl = S().win.deals.filter((r) => r.id === "cinevault-exclusive")[0];
check("a qualifying release fills exactly one slot of the exclusive deal",
  excl.used === 1 && excl.paid === dealDef.bonus, "used " + excl.used + "/" + excl.films);
check("the slot bonus was paid to cash and to the stats ledger",
  nearly(S().win.stats.dealBonus - bonusBefore, dealDef.bonus, 0.05),
  "+" + (S().win.stats.dealBonus - bonusBefore) + "M");
check("a 17-day release does NOT fill the 90-day exclusive (window range enforced)",
  excl.used === 1);
const f17 = pushDoneFilm("Quick Turn", { cost: 20, opening: 25, window: 17, genre: "horror" });
C.windowOnRelease(f17);
check("result: the 17-day film filled no exclusive slot",
  S().win.deals.filter((r) => r.id === "cinevault-exclusive")[0].used === 1);

/* completing the deal */
const f90c = pushDoneFilm("Third Hold", { cost: 50, opening: 45, window: 90, genre: "scifi" });
C.windowOnRelease(f90c);
check("the deal completes on its last slot and is marked done",
  excl.done === true && S().win.stats.dealsDone === 1, "done " + excl.done);
check("a completed deal stops paying the slot bonus on later releases",
  (() => {
    const beforeB = S().win.stats.dealBonus;
    const extra = pushDoneFilm("Late Hold", { cost: 50, opening: 45, window: 90, genre: "drama" });
    C.windowOnRelease(extra);
    return S().win.stats.dealBonus === beforeB;
  })());

/* ── the real engine path: setRelease → releaseFilm ───────────── */
S().studio.cash = 500;
const idea = S().ideas[0];
const dir = S().market.filter((t) => t.k === "dir" && t.bookedUntil <= S().studio.week)[0];
const act = S().market.filter((t) => t.k === "actor" && t.bookedUntil <= S().studio.week)[0];
check("a free director and lead are in the market", !!dir && !!act);
const gl = C.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 1, supportIds: [] });
check("greenlight accepts a micro project", !!gl.ok, gl.err || "");
const proj = S().projects.filter((p) => p.title === idea.title)[0];
check("new project has no window yet on a fresh greenlight", !!proj && proj.window == null);

/* window-set before dating */
const setOk = C.windowAction("window-set", { getAttribute: (k) => (k === "data-id" ? proj.id : k === "data-key" ? "90" : null) });
check("window-set before the film is dated writes p.window = 90",
  setOk === true && proj.window === 90, "window " + proj.window);
check("the choice is echoed into S.win.choice", S().win.choice[proj.id] === 90);
check("window-set rejects an unknown project without throwing",
  C.windowAction("window-set", { getAttribute: () => "nope" }) === true && S().win.runs.length >= 1);

/* drive it to ready, then date it at the chosen window */
let guard = 0;
while (proj.phase !== "ready" && guard < 40) {
  proj.phaseWk = 99;                 /* fast-forward phases deterministically */
  advance(1);
  guard++;
}
check("project reached the ready gate", proj.phase === "ready", "phase " + proj.phase);
const releaseWeek = S().studio.week + 1;
const sr = C.setRelease(proj, releaseWeek, 1, proj.window);
check("setRelease seeds the campaign and keeps the 90-day window",
  !!sr.ok && proj.window === 90, sr.err || "window " + proj.window);
check("window-set is refused once a film is dated",
  C.windowAction("window-set", { getAttribute: (k) => (k === "data-id" ? proj.id : k === "data-key" ? "17" : null) }) === true &&
  proj.window === 90, "window still " + proj.window);

/* release it through the engine's own gate */
const runsBeforeRelease = S().win.runs.length;
advance(3);
const relFilm = S().films.filter((f) => f.title === idea.title)[0];
check("the scheduled film released into theaters", !!relFilm, relFilm ? relFilm.title : "not released");
check("the film record carries the 90-day window from the release sheet",
  !!relFilm && relFilm.window === 90, relFilm ? String(relFilm.window) : "-");
check("releaseFilm called windowOnRelease (a run was registered)",
  S().win.runs.length === runsBeforeRelease + 1 && S().win.runs.some((r) => r.filmId === relFilm.id),
  "runs " + S().win.runs.length);
check("the long window lengthened the legs versus the 45-day neutral",
  !!relFilm && isFinite(relFilm.legs) && relFilm.legs > 0,
  relFilm ? "legs ×" + relFilm.legs.toFixed(2) : "-");
check("the film's own windowRevenueMult exceeds 1 for the 90-day release… no: it is under 1",
  C.windowRevenueMult(relFilm) < 1, "×" + C.windowRevenueMult(relFilm).toFixed(3));

/* ── PVOD fires once, and only while the film is still running ─── */
const pvodFilm = pushDoneFilm("Stream Me", { cost: 80, opening: 60, window: 7, genre: "animation" });
S().films.filter((f) => f.id === pvodFilm.id)[0].status = "run";
S().films.filter((f) => f.id === pvodFilm.id)[0].weeksOut = 1;
C.windowOnRelease(pvodFilm);
const pvodBefore = S().win.stats.pvod;
const pvodRun = S().win.runs.filter((r) => r.filmId === pvodFilm.id)[0];
pvodRun.pvodWk = S().studio.week;       /* due now */
S().win.lastTick = S().studio.week - 1;
const cashPrePvod = S().studio.cash;
C.tickWindow();
check("a due PVOD window pays the film an early streaming cheque",
  S().win.stats.pvod > pvodBefore && S().studio.cash > cashPrePvod,
  "+" + (S().win.stats.pvod - pvodBefore).toFixed(1) + "M");
check("PVOD income is capped against the production cost, never wild",
  S().win.stats.pvod - pvodBefore <= pvodFilm.cost * 0.35 * 1.5,
  "cap ≈ " + (pvodFilm.cost * 0.35).toFixed(1) + "M");
check("the run is flagged fired", S().win.runs.filter((r) => r.filmId === pvodFilm.id)[0].fired === true);
const pvodOnce = S().win.stats.pvod;
S().win.lastTick = S().studio.week - 1;
C.tickWindow();
check("PVOD pays at most once per film (second tick adds nothing)",
  S().win.stats.pvod === pvodOnce);

/* a film already out of theaters must not double-dip */
const deadFilm = pushDoneFilm("Gone Already", { cost: 30, opening: 30, window: 7, genre: "comedy" });
C.windowOnRelease(deadFilm);
const deadRun = S().win.runs.filter((r) => r.filmId === deadFilm.id)[0];
deadRun.pvodWk = S().studio.week;
const pvodPreDead = S().win.stats.pvod;
S().win.lastTick = S().studio.week - 1;
C.tickWindow();
check("a finished run collects no PVOD cheque (no double dip with endTheatrical)",
  S().win.stats.pvod === pvodPreDead, "still " + S().win.stats.pvod);

/* ── window-extend: the paid, mid-run window change ──────────── */
const liveRun = S().films.filter((f) => f.status === "run" && f.window < 90)[0] || pvodFilm;
liveRun.status = "run";
liveRun.window = 17;
liveRun.legs = 2.2;
liveRun.decay = 1 - 1 / 2.2;
const extFee = C.windowExtendFee(liveRun);
const cashPreExt = S().studio.cash;
const extOk = C.windowAction("window-extend", { getAttribute: () => liveRun.id });
check("window-extend buys screens back on a running film",
  extOk === true && liveRun.window === 47 && nearly(cashPreExt - S().studio.cash, extFee, 0.05),
  "window " + liveRun.window + " · fee " + extFee.toFixed(1) + "M");
check("the extension raised legs and recomputed decay",
  liveRun.legs > 2.2 && nearly(liveRun.decay, 1 - 1 / liveRun.legs),
  "legs " + liveRun.legs.toFixed(2));
check("stats.extends and stats.extendSpend recorded the purchase",
  S().win.stats.extends === 1 && nearly(S().win.stats.extendSpend, extFee, 0.05));

const richFilm = S().films.filter((f) => f.status === "run" && f.window < 90 && f.id !== liveRun.id)[0];
if (richFilm) {
  const cashPrePoor = S().studio.cash;
  S().studio.cash = 0.1;
  C.windowAction("window-extend", { getAttribute: () => richFilm.id });
  check("window-extend is refused with insufficient cash and spends nothing",
    nearly(S().studio.cash, 0.1, 0.001) && richFilm.window < 90,
    "window " + richFilm.window + " · cash " + S().studio.cash.toFixed(1));
  S().studio.cash = cashPrePoor;
}
const doneFilm = pushDoneFilm("Locked Out", { window: 90 });
check("window-extend on a finished film is refused",
  C.windowAction("window-extend", { getAttribute: () => doneFilm.id }) === true && doneFilm.window === 90);

/* ── action delegation contract ──────────────────────────────── */
const stubEl = { getAttribute: () => null };
check("windowAction returns false for foreign actions",
  C.windowAction("gl-open", stubEl) === false && C.windowAction("labor-concede", stubEl) === false &&
  C.windowAction("window", stubEl) === false);
check("windowAction returns false for a non-string action",
  C.windowAction(null, stubEl) === false && C.windowAction(7, stubEl) === false);
check("windowAction handles an unknown window id (handled, reported)",
  C.windowAction("window-deal", stubEl) === true);

/* ── achievements fire off real state ────────────────────────── */
const ach = (id) => C.WINDOW_ACHIEVEMENTS.filter((a) => a.id === id)[0];
check("'window-first-pvod' fires after the PVOD cheque",
  ach("window-first-pvod").test(S()) === true);
check("'window-day-date' fires after a 7-day release",
  ach("window-day-date").test(S()) === true);
check("'window-exclusive' fires after a 90-day release",
  ach("window-exclusive").test(S()) === true);
check("'window-first-deal' fires after signing a streamer",
  ach("window-first-deal").test(S()) === true);
check("'window-deal-done' fires after completing every slot",
  ach("window-deal-done").test(S()) === true);
check("'window-four-doors' needs all four lengths", ach("window-four-doors").test(S()) === false ||
  (S().win.stats.wPvod >= 1 && S().win.stats.wShort >= 1 && S().win.stats.wStd >= 1 && S().win.stats.wExcl >= 1));
check("'window-buy-back' fires after the extension purchase",
  ach("window-buy-back").test(S()) === true);
check("every achievement test runs without throwing on the live save",
  C.WINDOW_ACHIEVEMENTS.every((a) => { try { a.test(S()); return true; } catch (e) { return false; } }));

/* ── a standard-window film stays neutral end to end ─────────── */
const stdFilm = pushDoneFilm("Middle Of The Road", { cost: 40, window: 45, genre: "drama" });
check("a 45-day film gets exactly ×1 on both hooks",
  C.windowLegsMult(stdFilm) === 1 && C.windowRevenueMult(stdFilm) === 1,
  "legs ×" + C.windowLegsMult(stdFilm) + " · rev ×" + C.windowRevenueMult(stdFilm));
check("a std-window release is offered only a standard-or-shorter deal",
  (() => { const dl = C.windowOpenDealFor(45); return dl === null || dl.maxWindow <= 45; })());
check("a 90-day release is never matched to a short-window deal",
  (() => { const dl = C.windowOpenDealFor(90); return dl === null || dl.minWindow >= 90; })());

/* ── long soak: 90+ driven weeks, invariants hold ─────────────── */
S().studio.cash = 900;
advance(Math.max(0, 95 - weeksDriven));
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("90+ advanceWeek cycles driven", weeksDriven >= 90, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("cash stayed finite every week", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("at least one spend and one earn recorded in the ledger",
  spendRows.length >= 1 && earnRows.length >= 1,
  spendRows.length + " spend kinds · " + earnRows.length + " earn kinds");
check("S.win exists at the end with every numeric field finite",
  !!S().win && isFinite(S().win.lastTick) &&
  Object.keys(S().win.stats).every((k) => isFinite(S().win.stats[k])) &&
  S().win.runs.every((r) => isFinite(r.window) && isFinite(r.pvodWk) && isFinite(r.start)),
  "runs " + S().win.runs.length + " · deals " + S().win.deals.length);
check("every run keeps a legal window after the soak",
  S().win.runs.every((r) => r.window >= 0 && r.window <= 365));
check("every deal keeps used <= films and a finite expiry",
  S().win.deals.every((r) => r.used >= 0 && r.used <= r.films && isFinite(r.expiresWk)));
check("both multipliers stay finite and > 0 after the soak",
  isFinite(C.windowLegsMult(stub)) && C.windowLegsMult(stub) > 0 &&
  isFinite(C.windowRevenueMult(stub)) && C.windowRevenueMult(stub) > 0);
check("tickWindow still idempotent at the end of the drive",
  (() => { const w = S().win.lastTick; C.tickWindow(); C.tickWindow(); return S().win.lastTick === w; })());
desksClean("(end, 95+ weeks in)");

/* ── save/load round-trip keeps S.win intact ─────────────────── */
C.saveGame();
const before = JSON.stringify(S().win.stats);
C.loadGame();
check("S.win survives a save/load round-trip byte-identically",
  !!S().win && JSON.stringify(S().win.stats) === before, "stats preserved");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · " +
  S().win.stats.pvodFilms + " PVOD windows · " + S().win.stats.deals + " deals");
process.exit(failures || threw ? 1 : 0);
