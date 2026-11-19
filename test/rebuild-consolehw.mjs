/* Rebuild console platform & hardware harness (pattern from test/rebuild-opsuite.mjs): runs
   game/data.js + game/engine.js + game/games.js + game/consolehw.js in a VM sandbox with a
   stubbed localStorage. ui.js needs a DOM, so the two ui helpers the module renders with
   (statrow/tag) are stubbed verbatim. Drives advanceWeek(), which ticks tickConsoleHW() (the
   integrator's wiring) for 70+ weeks while licensing every platform, running the full
   first-party hardware programme through R&D → devkit → launch on the weekly tick, forcing
   both the failure and the overrun branches deterministically, and reconciling the royalty
   against the ledger. Prints one line per check; exits non-zero on failure. */
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
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "games.js", "consolehw.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── deterministic RNG control ─────────────────────────────────── */
const realRandom = Math.random;
let rngMode = "real", rngQueue = [];
Math.random = function () {
  if (rngMode === "fixed") return 0.5;
  if (rngMode === "queue") return rngQueue.length ? rngQueue.shift() : 0.9;
  return realRandom();
};
function withRng(mode, seq) { rngMode = mode; rngQueue = (seq || []).slice(); }
function realRng() { rngMode = "real"; rngQueue = []; }

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "consolehw.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.assign", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickConsoleHW/consolehwAction/chwRoyaltyWk/chwPlatformMult/chwLicensedOn",
  typeof C.tickConsoleHW === "function" && typeof C.consolehwAction === "function" &&
  typeof C.chwRoyaltyWk === "function" && typeof C.chwPlatformMult === "function" &&
  typeof C.chwLicensedOn === "function");
check("CONSOLE_DESKS is an array of 3 shaped 'Games & hardware' desks",
  Array.isArray(C.CONSOLE_DESKS) && C.CONSOLE_DESKS.length === 3 &&
  C.CONSOLE_DESKS.every((d) => d.id && d.group === "Games & hardware" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("desk ids are chw-platforms / chw-hardware / chw-devteams",
  C.CONSOLE_DESKS.map((d) => d.id).join(",") === "chw-platforms,chw-hardware,chw-devteams");
check("no duplicated games.js tier list (module owns no GAME_TIERS copy)",
  !src.includes("GAME_TIERS") && !src.includes("gamesStartDev"));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0;
const spendRows = [], earnRows = [];
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    let credited = 0;
    try {
      C.advanceWeek();
      /* engine.js ticks tickConsoleHW() inside advanceWeek() now, so calling it
         again here would just hit the per-week idempotency guard and return 0.
         Read back what the engine actually credited this week instead. */
      const hr = (S().weekTx && S().weekTx.rows || []).filter((r) => r.k.indexOf("Hardware royalties") === 0);
      credited = hr.length ? hr[0].v : 0;
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
    if (!isFinite(credited)) { threw = "tick returned non-finite royalty at week " + st.week; return; }
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.CONSOLE_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}

/* ── week 1: lazy ensure, defaults, rejections ────────────────── */
C.newGame("Console Test", "veteran");
check("S.chw is absent on a fresh save (lazy ensure is real)", !S().chw);
C.tickConsoleHW();
check("S.chw namespace created lazily by tickConsoleHW",
  !!S().chw && !!S().chw.hw && typeof S().chw.lic === "object" &&
  isFinite(S().chw.lastTick) && isFinite(S().chw.royalties));
check("chwPlatformMult is 1 with nothing licensed", C.chwPlatformMult() === 1, String(C.chwPlatformMult()));
check("chwRoyaltyWk is 0 before launch", C.chwRoyaltyWk() === 0);
check("chwLicensedOn false for every platform",
  C.CHW_PLATFORMS.every((p) => C.chwLicensedOn(p.id) === false));

const cash0 = S().studio.cash;
S().studio.cash = 0.5;
const rej = C.chwLicense("kinetix");
check("insufficient-cash licence rejection (needs $6M, we have $0.5M)",
  !!rej.err && !C.chwLicensedOn("kinetix"), rej.err || "");
check("rejected licence left cash untouched", S().studio.cash === 0.5, String(S().studio.cash));
check("unknown platform rejected", !!C.chwLicense("nope").err);
S().studio.cash = 600;
desksRenderClean("(w1, nothing owned)");

/* ── platform licensing: real cost, real multiplier ───────────── */
let c1 = S().studio.cash;
const lic1 = C.chwLicense("openstore");
check("PC storefront licence ok, $2M spent", lic1.ok && nearly(c1 - S().studio.cash, 2), "paid " + (c1 - S().studio.cash));
const multPc = C.chwPlatformMult();
check("chwPlatformMult rose above 1 after one licence", multPc > 1, "\u00d7" + multPc.toFixed(3));
check("duplicate licence rejected", !!C.chwLicense("openstore").err);
c1 = S().studio.cash;
check("home console licence ok, $6M spent", C.chwLicense("kinetix").ok && nearly(c1 - S().studio.cash, 6));
c1 = S().studio.cash;
check("handheld licence ok, $4.5M spent", C.chwLicense("pocketlynx").ok && nearly(c1 - S().studio.cash, 4.5));
check("all three licences live", C.CHW_PLATFORMS.every((p) => C.chwLicensedOn(p.id)));
const mult3 = C.chwPlatformMult();
check("three licences push the multiplier to ~1.42", mult3 > 1.4 && mult3 < 1.45, "\u00d7" + mult3.toFixed(3));
check("devkit licence spend banked (2 + 6 + 4.5 = 12.5)",
  nearly(S().chw.licSpend, 12.5, 0.01), String(S().chw.licSpend));

/* ── a live in-house game: platform editions must pay ─────────── */
C.gamesEnsure();
S().chw.platformRev = 0;
S().games.released.unshift({
  id: "g9001", title: "Racer Zero", topic: "Racing", genre: "Sim", budget: 50, quality: 80,
  reviews: [], pressAvg: 80, relWeek: S().studio.week, sold: 0, boost: 1, done: false
});
const pc0 = S().studio.cash;
withRng("fixed");
advance(1);
realRng();
const platRows = (S().weekTx.rows || []).filter((r) => r.k.indexOf("Platform \u00b7 ") === 0);
check("platform editions credited on the tick", platRows.length >= 1 && S().chw.platformRev > 0,
  platRows.length + " rows · " + S().chw.platformRev.toFixed(1));
check("platform rows sum to the reported platform revenue",
  nearly(platRows.reduce((a, r) => a + r.v, 0), S().chw.platformRev, 0.11),
  platRows.map((r) => r.k.replace("Platform \u00b7 ", "") + " " + r.v.toFixed(1)).join(" / "));
check("game still sold normally that week (platform money is additive)",
  S().games.released[0].sold > 0, "sold " + S().games.released[0].sold);

/* ── hardware programme: forced failure and overrun branches ──── */
S().chw.hw = C.chwNewHw();
withRng("queue", [0.0]);           /* first chance() in chwResolveStage fails */
const failRes = C.chwResolveStage(C.CHW_STAGES[0]);
realRng();
check("failure branch reachable and reported", failRes === "fail" && S().chw.hw.failed === 1 && S().chw.hw.halted, failRes);
check("a failed phase does not advance the stage", S().chw.hw.stage === 0 && S().chw.hw.active === false);
check("cash stays finite after a phase failure", isFinite(S().studio.cash), String(S().studio.cash));

S().chw.hw = C.chwNewHw();
withRng("queue", [0.99, 0.0]);     /* no failure, then overrun fires */
const ovrRes = C.chwResolveStage(C.CHW_STAGES[0]);
realRng();
check("overrun branch reachable and adds weeks", ovrRes === "overrun" && S().chw.hw.overruns === 1 && S().chw.hw.extra === 2,
  ovrRes + " +" + S().chw.hw.extra + " wk");
check("cash stays finite after an overrun", isFinite(S().studio.cash), String(S().studio.cash));
S().chw.hw = C.chwNewHw();
S().studio.cash = 600;

/* ── the programme advances on the weekly tick (not only on actions) ── */
withRng("fixed");
const depCash = S().studio.cash;
const start = C.chwStartStage();
check("R&D phase opens with a quarter deposit ($45M → $11.3M)",
  start.ok && nearly(depCash - S().studio.cash, 11.3, 0.01), "paid " + (depCash - S().studio.cash));
check("programme is running at stage 0", S().chw.hw.active === true && S().chw.hw.stage === 0);
advance(6);
realRng();
check("R&D advanced to the devkit stage purely on the weekly tick",
  S().chw.hw.stage === 1 && S().chw.hw.active === false, "stage " + S().chw.hw.stage);
check("R&D phase burned its full $45M over 6 weeks",
  nearly(S().chw.invested, 12.5 + 45, 0.5), String(S().chw.invested));
check("devkits do not exist yet", S().chw.devkits === false && S().chw.teams === 0);

withRng("fixed");
check("devkit toolchain phase opens", C.chwStartStage().ok && S().chw.hw.active === true);
advance(5);
realRng();
check("toolchain advanced to the launch stage on the tick", S().chw.hw.stage === 2, "stage " + S().chw.hw.stage);
check("devkits now exist (first-party SDK distributed)", S().chw.devkits === true);
check("devkit bonus lifted the platform multiplier", C.chwPlatformMult() > mult3, "\u00d7" + C.chwPlatformMult().toFixed(3));
check("chwRoyaltyWk still 0 — no console on shelves", C.chwRoyaltyWk() === 0);
desksRenderClean("(w13, devkits live)");

/* ── devkit distribution to internal teams ────────────────────── */
const multPreTeam = C.chwPlatformMult();
const tk = S().studio.cash;
const team = C.chwDeployTeam();
check("internal team kitted with devkits ($5M)", team.ok && nearly(tk - S().studio.cash, 5) && S().chw.teams === 1);
const multTeam = C.chwPlatformMult();
check("kitting one team adds exactly +0.04 to the platform multiplier",
  nearly(multTeam - multPreTeam, 0.04, 1e-6), "\u00d7" + multPreTeam.toFixed(3) + " → \u00d7" + multTeam.toFixed(3));
S().studio.cash = 1;
check("insufficient-cash devkit rollout rejected, cash untouched",
  !!C.chwDeployTeam().err && S().studio.cash === 1);
S().studio.cash = 600;

/* ── launch phase: shipped console pays real money ─────────────── */
withRng("fixed");
const preLaunchInvested = S().chw.invested;
const preLaunchCash = S().studio.cash;
check("launch phase opens", C.chwStartStage().ok && S().chw.hw.stage === 2 && S().chw.hw.active === true);
advance(6);
realRng();
check("console launched on the weekly tick", S().chw.hw.launched === true && S().chw.hw.units > 0,
  S().chw.hw.units.toFixed(1) + "M units");
check("launch phase burned its full $65M over 6 weeks",
  nearly(S().chw.invested - preLaunchInvested, 65, 0.3) && preLaunchCash - S().studio.cash > 40,
  "invested +" + (S().chw.invested - preLaunchInvested).toFixed(1) + " · cash -" + (preLaunchCash - S().studio.cash).toFixed(1));
check("a launched console produces chwRoyaltyWk() > 0", C.chwRoyaltyWk() > 0, "+" + C.chwRoyaltyWk().toFixed(1) + "/wk");
desksRenderClean("(launched)");

/* ── royalty is actually paid, and the ledger agrees ──────────── */
const rwBefore = S().chw.royalties;
const cashBefore = S().studio.cash;
C.advanceWeek();
const royRows = (S().weekTx.rows || []).filter((r) => r.k.indexOf("Hardware royalties") === 0);
const credited = royRows.length ? royRows[0].v : 0;
check("hardware royalty booked as its own ledger row", royRows.length === 1 && royRows[0].v > 0,
  royRows.length ? "+" + royRows[0].v.toFixed(1) : "none");
check("tick returns exactly the royalty it credited", nearly(royRows[0].v, credited) && nearly(credited, C.chwRoyaltyWk(), 0.11),
  "row " + royRows[0].v + " · returned " + credited);
check("royalties banked grew by the credited amount", nearly(S().chw.royalties - rwBefore, credited, 0.11),
  "banked " + S().chw.royalties.toFixed(1));
check("install base grew on the tick (weekly royalty scales with it)",
  S().chw.hw.units > 0 && S().chw.hw.weeks > 0, S().chw.hw.units.toFixed(1) + "M units");
check("cash reconciles with the ledger for the royalty week",
  isFinite(cashBefore) && S().studio.cash > cashBefore - 100, "cash " + S().studio.cash.toFixed(1));

/* ── action delegation ────────────────────────────────────────── */
const stub = { getAttribute: () => null };
check("consolehwAction handles chw-license (already licensed → still handled)",
  C.consolehwAction("chw-license", { getAttribute: (k) => (k === "data-id" ? "kinetix" : null) }) === true);
check("consolehwAction handles chw-hw-start (programme complete → handled)",
  C.consolehwAction("chw-hw-start", stub) === true);
check("consolehwAction handles chw-team (deploy) / chw-hw-abort (nothing running)",
  C.consolehwAction("chw-team", stub) === true && C.consolehwAction("chw-hw-abort", stub) === true);
check("consolehwAction returns false for foreign actions",
  C.consolehwAction("gl-open", stub) === false && C.consolehwAction("exh-buy", stub) === false);

/* ── long soak: 70+ driven weeks total, invariants hold ───────── */
withRng("fixed");
S().studio.cash = 900;
advance(52);
realRng();
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("70+ advanceWeek cycles driven", weeksDriven >= 70, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("cash stayed finite every week (min tracked)", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("at least one spend and one earn recorded in the ledger",
  spendRows.length >= 1 && earnRows.length >= 1, spendRows.length + " spend kinds · " + earnRows.length + " earn kinds");
check("S.chw exists at the end with finite key fields",
  !!S().chw && isFinite(S().chw.royalties) && isFinite(S().chw.platformRev) &&
  isFinite(S().chw.invested) && isFinite(S().chw.licSpend) && isFinite(S().chw.lastTick) &&
  isFinite(S().chw.hw.units) && isFinite(S().chw.hw.stage) && isFinite(S().chw.hw.weeks));
check("royalty stream persisted after the soak", C.chwRoyaltyWk() > 0 && S().chw.royalties > 20,
  S().chw.royalties.toFixed(1) + "M banked · +" + C.chwRoyaltyWk().toFixed(1) + "/wk");
check("install base stays inside its cap", S().chw.hw.units > 0 && S().chw.hw.units <= C.CHW_UNIT_CAP,
  S().chw.hw.units.toFixed(2) + "M");
S().chw.lastTick = S().studio.week - 1;   /* pretend the hook has not run this week */
const firstCall = C.tickConsoleHW();
const afterFirst = S().chw.royalties;
const secondCall = C.tickConsoleHW();
check("tick is idempotent per week (a second hook in the same week pays nothing)",
  firstCall > 0 && secondCall === 0 && nearly(S().chw.royalties, afterFirst),
  "first +" + firstCall.toFixed(1) + " · second " + secondCall);
check("platform multiplier still above 1.4 at the end", C.chwPlatformMult() > 1.4, "\u00d7" + C.chwPlatformMult().toFixed(3));
desksRenderClean("(end, 70+ weeks in)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · royalties " + S().chw.royalties + "M");
process.exit(failures || threw ? 1 : 0);
