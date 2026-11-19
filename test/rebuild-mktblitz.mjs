/* Rebuild Marketing-Blitz harness (pattern from test/rebuild-opsuite.mjs): runs
   game/data.js + game/engine.js + game/mktblitz.js in a VM sandbox with a stubbed
   localStorage. ui.js needs a DOM, so the two ui helpers the desks render with
   (statrow/tag) are stubbed verbatim. Drives advanceWeek() then tickMktBlitz() (the
   integrator's wiring) for 50+ weeks and exercises every system through the module's own
   functions: every ladder rung bought against an in-production project (cost really spent,
   blitzOpenMult really above 1), the saturating diminishing-returns curve, a campaign
   decaying when the release slips past its window, critic/buzz hooks staying at zero when
   their tactic was not bought, an insufficient-cash rejection, and blitzOnRelease cleanup.
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
  /* ui.js helpers (ui.js itself can't load without a DOM); same behavior as ui.js */
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "mktblitz.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "mktblitz.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.assign", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickMktBlitz/mktBlitzAction/blitzOpenMult/blitzBuzzAdd/blitzCriticAdj/blitzOnRelease",
  typeof C.tickMktBlitz === "function" && typeof C.mktBlitzAction === "function" &&
  typeof C.blitzOpenMult === "function" && typeof C.blitzBuzzAdd === "function" &&
  typeof C.blitzCriticAdj === "function" && typeof C.blitzOnRelease === "function");
check("BLITZ_DESKS is an array of 3 shaped 'Marketing' desks",
  Array.isArray(C.BLITZ_DESKS) && C.BLITZ_DESKS.length === 3 &&
  C.BLITZ_DESKS.every((d) => d.id && d.group === "Marketing" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("desk ids are blitz-ladder / blitz-windows / blitz-ledger",
  C.BLITZ_DESKS.map((d) => d.id).join(",") === "blitz-ladder,blitz-windows,blitz-ledger");
check("five ladder rungs with distinct costs and windows",
  Array.isArray(C.BLITZ_TIERS) && C.BLITZ_TIERS.length === 5 &&
  new Set(C.BLITZ_TIERS.map((t) => t.cost)).size === 5 &&
  C.BLITZ_TIERS.every((t) => t.cost > 0 && t.window > 0 && isFinite(t.open) && isFinite(t.buzz) && isFinite(t.crit)));

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
let ledgerBreaks = 0, spendRows = 0;
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      C.tickMktBlitz(); /* integrator wiring: engine calls tickMktBlitz() after its own systems */
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
    for (const r of rows) { sum += r.v; if (r.k.indexOf("Blitz · ") === 0) spendRows++; }
    if (!nearly(st.cash - before, sum, 0.05)) ledgerBreaks++;
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.BLITZ_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}
function fakeFilm(id, title, genre, opening, legs, status) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening, legs, decay: 1 - 1 / legs, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null, status
  });
}
function fakeProject(id, title, phase, opts) {
  const o = opts || {};
  const p = {
    id, title, genre: o.genre || "drama", scale: "micro", budget: 5, budgetNow: 5,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: 5, releaseWeek: o.releaseWeek != null ? o.releaseWeek : null,
    phase, phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: o.post || 300 },
    overrun: 0, scandal: false, buzz: o.buzz || 0, franchiseOf: null, prodScore: 55,
    quality: 70, qPreview: 70
  };
  S().projects.push(p);
  return p;
}

/* ── week 1: lazy ensure + hook defaults + rejections ─────────── */
C.newGame("Blitz Test", "veteran");
check("old-save state: S.blitz absent before the module runs", !S().blitz);
C.tickMktBlitz();
check("S.blitz namespace created lazily by tickMktBlitz",
  !!S().blitz && Array.isArray(S().blitz.campaigns) && isFinite(S().blitz.spend) && isFinite(S().blitz.lastTick));
check("blitzOpenMult defaults to 1 with no campaign", C.blitzOpenMult({ id: "pNone" }) === 1);
check("blitzBuzzAdd / blitzCriticAdj default to 0",
  C.blitzBuzzAdd({ id: "pNone" }) === 0 && C.blitzCriticAdj({ id: "pNone" }) === 0);
check("blitzOnRelease is safe with a bare/absent project",
  !threw && C.blitzOnRelease(null).open === 1 && C.blitzOnRelease({}).open === 1);
desksRenderClean("(w1, nothing on the slate)");

/* seed cash flow + a slate of in-production pictures */
fakeFilm("f9001", "First Runner", "action", 120, 3.0, "run");
fakeFilm("f9002", "Second Runner", "comedy", 110, 3.0, "run");
S().studio.cash = 300; /* test float so the whole ladder can be bought in one sitting */
const proj = fakeProject("p9001", "Post Masterpiece", "post", { releaseWeek: 1 + 4 });
const projCrit = fakeProject("p9002", "Junket Only", "post", { releaseWeek: 1 + 4 });
const projBuzz = fakeProject("p9003", "Hall H Only", "post", { releaseWeek: 1 + 4 });
const projSlip = fakeProject("p9004", "Release Slipper", "post", { releaseWeek: 1 + 4 });
advance(1);
check("theatrical decay cycle moved on the seeded run", C.findFilm("f9001").dom > 0, "dom " + C.findFilm("f9001").dom);

/* ── every rung bought on a real in-production project ────────── */
const ladder = C.BLITZ_TIERS.map((t) => t.id);
for (const id of ladder) {
  const t = C.BLITZ_TIERS.find((x) => x.id === id);
  const c0 = S().studio.cash;
  const r = C.blitzBuy("p9001", id);
  const want = C.blitzTierCost(C.findProject("p9001"), t);
  check("buy '" + id + "' ($" + want + " at micro scale) spends exactly its fee",
    r.ok && nearly(want, c0 - S().studio.cash), "spent " + ((c0 - S().studio.cash).toFixed(2)) + " want " + want);
  check("  blitzOpenMult > 1 after '" + id + "'", C.blitzOpenMult(C.findProject("p9001")) > 1,
    "×" + C.blitzOpenMult(C.findProject("p9001")).toFixed(4));
  check("  campaign stored on the project (p.blitz) and in S.blitz.campaigns",
    Array.isArray(C.findProject("p9001").blitz) &&
    C.findProject("p9001").blitz.length >= 1 &&
    S().blitz.campaigns.some((c) => c.projId === "p9001" && c.key === id));
}
check("duplicate rung on the same film rejected", !!C.blitzBuy("p9001", "hallh").err, C.blitzBuy("p9001", "hallh").err || "");
check("unknown rung rejected", !!C.blitzBuy("p9001", "blimp") .err);
check("unknown project rejected", !!C.blitzBuy("pNope", "hallh").err);
check("all five rungs live on one film (full escalating ladder)",
  S().blitz.campaigns.filter((c) => c.projId === "p9001").length === 5);
check("blitz spend accumulator matches the fee sum",
  nearly(S().blitz.spend, S().blitz.campaigns.reduce((a, c) => a + c.cost, 0), 0.05), "spend " + S().blitz.spend);
/* the engine ledger records the spend: spend() appends to the live week's tx rows */
const ledgerProj = fakeProject("p9007", "Ledger Test", "post", { releaseWeek: 1 + 3 });
S().weekTx = { w: S().studio.week, in: 0, out: 0, rows: [] };
const ledgerCash0 = S().studio.cash;
const ledgerBuy = C.blitzBuy("p9007", "superbowl");
const blitzRow = (S().weekTx.rows || []).filter((r) => r.k.indexOf("Blitz · ") === 0)[0];
check("spend() booked a 'Blitz · …' ledger row equal to the fee",
  ledgerBuy.ok && !!blitzRow && nearly(Math.abs(blitzRow.v), 18) && nearly(ledgerCash0 - S().studio.cash, 18),
  blitzRow ? blitzRow.k + " = " + blitzRow.v : "no row");

/* ── diminishing returns: saturating curve, not linear stacking ── */
const dm = fakeProject("p9005", "Curve Test", "post", { releaseWeek: 1 + 3 });
const m0 = C.blitzOpenMult(dm);
C.blitzBuy(dm.id, "junket");  const m1 = C.blitzOpenMult(dm);
C.blitzBuy(dm.id, "hallh");   const m2 = C.blitzOpenMult(dm);
C.blitzBuy(dm.id, "tvblitz"); const m3 = C.blitzOpenMult(dm);
const g1 = m1 - m0, g2 = m2 - m1, g3 = m3 - m2;
check("1st tactic opens ×" + m1.toFixed(4) + " (gain " + g1.toFixed(4) + ")",
  g1 > 0 && nearly(m0, 1));
check("2nd tactic adds less than the 1st (" + g2.toFixed(4) + " < " + g1.toFixed(4) + ")", g2 < g1 && g2 > 0);
check("3rd tactic adds less than the 1st (" + g3.toFixed(4) + " < " + g1.toFixed(4) + ")", g3 < g1 && g3 > 0);
check("3 tactics total gain " + (m3 - 1).toFixed(4) + " < linear sum " + (3 * g1).toFixed(4),
  (m3 - 1) < 3 * g1 - 1e-9);
check("diminishing curve is monotone but decelerating (g1 > g2 > g3)", g1 > g2 && g2 > g3);

/* ── timed windows: a slip decays the campaign already paid for ── */
C.blitzBuy(projSlip.id, "hallh");                        /* window 9 wk, release 4 wk out → full power */
const freshMult = C.blitzOpenMult(C.findProject("p9004"));
C.findProject("p9004").releaseWeek = S().studio.week + 22; /* the release slips three months */
const slippedMult = C.blitzOpenMult(C.findProject("p9004"));
check("campaign decays when the release slips past its window (" + freshMult.toFixed(4) + " → " + slippedMult.toFixed(4) + ")",
  slippedMult < freshMult && slippedMult > 1);
const slipRow = S().blitz.campaigns.find((c) => c.projId === "p9004");
check("freshness on the slipped campaign is below 0.5", C.blitzFresh(C.findProject("p9004"), slipRow) < 0.5,
  "fresh " + C.blitzFresh(C.findProject("p9004"), slipRow).toFixed(3));
C.findProject("p9004").releaseWeek = S().studio.week + 3;
check("moving the date back inside the window restores full power",
  nearly(C.blitzOpenMult(C.findProject("p9004")), freshMult, 1e-9));

/* ── distinct tactics: junket moves critics, Hall H moves buzz ── */
C.blitzBuy(projCrit.id, "junket");
check("junket-only film: blitzCriticAdj > 0 (" + C.blitzCriticAdj(C.findProject("p9002")) + ")",
  C.blitzCriticAdj(C.findProject("p9002")) > 0);
check("junket-only film: blitzBuzzAdd === 0", C.blitzBuzzAdd(C.findProject("p9002")) === 0,
  String(C.blitzBuzzAdd(C.findProject("p9002"))));
C.blitzBuy(projBuzz.id, "hallh");
check("Hall H-only film: blitzBuzzAdd > 0 (" + C.blitzBuzzAdd(C.findProject("p9003")) + ")",
  C.blitzBuzzAdd(C.findProject("p9003")) > 0);
check("Hall H-only film: blitzCriticAdj === 0", C.blitzCriticAdj(C.findProject("p9003")) === 0,
  String(C.blitzCriticAdj(C.findProject("p9003"))));
check("Hall H pays part of its buzz the moment it is booked (p.buzz rose)", C.findProject("p9003").buzz > 0,
  "buzz " + C.findProject("p9003").buzz);
check("Hall H release buzz is below its own +14 raw points (booking already paid a share)",
  C.blitzBuzzAdd(C.findProject("p9003")) > 0 && C.blitzBuzzAdd(C.findProject("p9003")) < 14,
  "release add " + C.blitzBuzzAdd(C.findProject("p9003")) + " on raw 14");

/* ── insufficient cash: rejected, cash untouched, button disabled ── */
const spare = fakeProject("p9006", "No Budget", "post", { releaseWeek: 1 + 3 });
S().studio.cash = 0.4;
const cashBefore = S().studio.cash;
const broke = C.blitzBuy("p9006", "superbowl");
check("insufficient-cash blitz rejection (Super Bowl needs $18M, we have $0.4M)",
  !!broke.err && nearly(S().studio.cash, cashBefore), broke.err || "");
check("no campaign was created by the rejected buy",
  !S().blitz.campaigns.some((c) => c.projId === "p9006"));
const deskHTML = C.BLITZ_DESKS[0].render();
check("ladder desk disables the unaffordable rung and shows cash-after",
  deskHTML.indexOf("disabled") >= 0 && deskHTML.indexOf("after -$") >= 0);
S().studio.cash = 300;

/* ── action delegation ────────────────────────────────────────── */
check("mktBlitzAction handles blitz-buy (junket on p9006)",
  C.mktBlitzAction("blitz-buy", { getAttribute: (k) => (k === "data-id" ? "p9006" : k === "data-key" ? "junket" : null) }) === true &&
  C.blitzCriticAdj(C.findProject("p9006")) > 0);
check("mktBlitzAction handles blitz-pull (refunds 35% and clears the project)",
  (() => {
    const row = S().blitz.campaigns.find((c) => c.projId === "p9006");
    const c0 = S().studio.cash;
    const ok = C.mktBlitzAction("blitz-pull", { getAttribute: (k) => (k === "data-id" ? row.id : null) }) === true;
    return ok && S().studio.cash > c0 && C.findProject("p9006").blitz.length === 0 && C.blitzOpenMult(C.findProject("p9006")) === 1;
  })());
check("mktBlitzAction returns false for foreign actions",
  C.mktBlitzAction("gl-open", { getAttribute: () => null }) === false);
check("mktBlitzAction returns false for unknown blitz- verbs",
  C.mktBlitzAction("blitz-nuke", { getAttribute: () => null }) === false);

/* ── blitzOnRelease consumes the campaigns ───────────────────── */
const consumed = C.blitzOnRelease(C.findProject("p9001"));
check("blitzOnRelease returns the aggregate the film opened on (open > 1)",
  consumed.open > 1 && C.findProject("p9001").blitz.length === 0);
check("blitzOnRelease removed every p9001 campaign from S.blitz",
  !S().blitz.campaigns.some((c) => c.projId === "p9001") && S().blitz.released >= 5);
check("hooks fall back to defaults after release",
  C.blitzOpenMult(C.findProject("p9001")) === 1 && C.blitzBuzzAdd(C.findProject("p9001")) === 0 &&
  C.blitzCriticAdj(C.findProject("p9001")) === 0);
desksRenderClean("(w2, ladder + windows live)");

/* ── 50-week drive with a live campaign that lapses ───────────── */
check("a campaign is still running for the drive", S().blitz.campaigns.length > 0,
  String(S().blitz.campaigns.length));
advance(52);
check("no throw and cash finite through the 52-week drive", threw === null, threw || ("wk " + S().studio.week));
check("52+ advanceWeek cycles driven", weeksDriven >= 52, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("blitz spend is recorded and lifecycle counters moved",
  S().blitz.spend > 0 && (S().blitz.released + S().blitz.stale) > 0,
  S().blitz.spend + "M · released " + S().blitz.released + " · stale " + S().blitz.stale);
check("stale campaigns were written off during the drive",
  S().blitz.stale > 0 || S().blitz.released > 0, "stale " + S().blitz.stale + " · released " + S().blitz.released);
check("S.blitz still exists with all key fields finite",
  !!S().blitz && isFinite(S().blitz.lastTick) && isFinite(S().blitz.spend) &&
  isFinite(S().blitz.released) && isFinite(S().blitz.pulled) && isFinite(S().blitz.stale) &&
  S().blitz.campaigns.every((c) => isFinite(c.cost) && isFinite(c.week) && isFinite(c.lead) && isFinite(c.window)));
check("every surviving campaign still belongs to a live project",
  S().blitz.campaigns.every((c) => !!C.findProject(c.projId)));
check("blitzOpenMult on every live campaign is a finite mult above 1",
  S().blitz.campaigns.every((c) => {
    const p = C.findProject(c.projId);
    const m = C.blitzOpenMult(p);
    return isFinite(m) && m >= 1 && m <= 1.5;
  }));
check("tickMktBlitz is idempotent inside one week (no double pruning)",
  (() => { const n = S().blitz.campaigns.length; C.tickMktBlitz(); C.tickMktBlitz(); return S().blitz.campaigns.length === n; })());
desksRenderClean("(end, 52+ weeks in)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · blitz spend " + S().blitz.spend + "M");
process.exit(failures || threw ? 1 : 0);
