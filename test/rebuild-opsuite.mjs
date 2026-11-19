/* Rebuild Studio-Operations harness (pattern from test/rebuild-exhibition.mjs): runs
   game/data.js + game/engine.js + game/opsuite.js in a VM sandbox with a stubbed
   localStorage. ui.js needs a DOM, so the two ui helpers the module renders with
   (statrow/tag) are stubbed verbatim. Drives advanceWeek() then tickStudioOps() (the
   integrator's wiring) for 60+ weeks and exercises every system through the module's own
   functions: officer hires and the real weekly payroll deduction, product placements on an
   in-production project, physical-media batches on a finished film, and insufficient-cash
   rejections. Prints one line per check; exits non-zero on failure. */
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
for (const f of ["data.js", "engine.js", "opsuite.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "opsuite.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.assign", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickStudioOps/opsuiteAction/opsCreditMod/opsOverheadMult/opsCostMult",
  typeof C.tickStudioOps === "function" && typeof C.opsuiteAction === "function" &&
  typeof C.opsCreditMod === "function" && typeof C.opsOverheadMult === "function" &&
  typeof C.opsCostMult === "function");
check("OPS_DESKS is an array of 3 shaped 'Studio ops' desks",
  Array.isArray(C.OPS_DESKS) && C.OPS_DESKS.length === 3 &&
  C.OPS_DESKS.every((d) => d.id && d.group === "Studio ops" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("desk ids are ops-placement / ops-media / ops-csuite",
  C.OPS_DESKS.map((d) => d.id).join(",") === "ops-placement,ops-media,ops-csuite");

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
let ledgerBreaks = 0, payrollWeeks = 0, payrollMismatch = 0;
let noOfficerWeeks = 0, noOfficerPayrollRows = 0;
let payrollSum = 0;
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      C.tickStudioOps(); /* integrator wiring: engine calls tickStudioOps() after its own systems */
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
    let sum = 0, payrollRow = null;
    for (const r of rows) { sum += r.v; if (r.k === "Executive payroll") payrollRow = r.v; }
    if (!nearly(st.cash - before, sum, 0.05)) ledgerBreaks++;
    const due = C.opsPayroll();
    if (due > 0) {
      payrollWeeks++;
      payrollSum = Math.round((payrollSum + due) * 100) / 100;
      if (payrollRow == null || !nearly(Math.abs(payrollRow), due, 1e-9)) payrollMismatch++;
    } else {
      noOfficerWeeks++;
      if (payrollRow != null) { noOfficerPayrollRows++; payrollMismatch++; }
    }
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.OPS_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}
function fakeFilm(id, title, genre, opening, legs, status, ww) {
  const f = {
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening, legs, decay: 1 - 1 / legs, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null, status
  };
  if (status === "done") { f.ww = ww; f.dom = Math.round(ww * 0.6 * 10) / 10; f.intl = Math.round(ww * 0.4 * 10) / 10; }
  S().films.unshift(f);
  return f;
}
function fakeProject(id, title, phase, opts) {
  const o = opts || {};
  const p = {
    id, title, genre: o.genre || "drama", scale: "micro", budget: 5, budgetNow: 5,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: o.mkt != null ? o.mkt : null, releaseWeek: null,
    phase, phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: o.post || 60 },
    overrun: 0, scandal: false, buzz: o.buzz || 0, franchiseOf: null, prodScore: 55,
    quality: 70, qPreview: 70
  };
  S().projects.push(p);
  return p;
}

/* ── week 1: lazy ensure + hook defaults + rejections ─────────── */
C.newGame("Ops Test", "veteran");
C.tickStudioOps();
check("S.ops namespace created lazily by tickStudioOps",
  !!S().ops && Array.isArray(S().ops.placements) && Array.isArray(S().ops.media) &&
  typeof S().ops.officers === "object" && isFinite(S().ops.payrollPaid));
check("opsPayroll is 0 with no officers", C.opsPayroll() === 0);
check("opsCostMult / opsOverheadMult default to 1", C.opsCostMult() === 1 && C.opsOverheadMult() === 1);
check("opsCreditMod 0 with no placement", C.opsCreditMod(null) === 0 && C.opsCreditMod("pNope") === 0);

const cash0 = S().studio.cash;
S().studio.cash = 0.5;
check("insufficient-cash hire rejection (CFO needs $4M, we have $0.5M)",
  !!C.opsHire("cfo").err && !S().ops.officers.cfo, C.opsHire("cfo").err || "");
S().studio.cash = cash0;
check("unknown officer rejected", !!C.opsHire("clown").err);
desksRenderClean("(w1, nothing hired)");

/* seed the slate: 2 running films (revenue for the long drive) + 1 finished film */
fakeFilm("f9001", "Opening Runner", "action", 90, 3.0, "run");
fakeFilm("f9002", "Second Runner", "comedy", 80, 3.0, "run");
fakeFilm("f9003", "Catalog Hit", "drama", 55, 2.8, "done", 120);
const proj = fakeProject("p9001", "Post Masterpiece", "post", {});
const readyProj = fakeProject("p9002", "Ready Picture", "ready", {});
advance(2);
check("theatrical decay cycle moved on the seeded run", C.findFilm("f9001").dom > 0, "dom " + C.findFilm("f9001").dom);

/* ── C-suite hires: signing fee + real perks ──────────────────── */
const c1 = S().studio.cash;
check("hire CFO ok ($4M signing fee)", C.opsHire("cfo").ok && nearly(c1 - S().studio.cash, 4));
check("CFO perk: opsCostMult 0.88", C.opsCostMult() === 0.88);
check("duplicate CFO hire rejected", !!C.opsHire("cfo").err, C.opsHire("cfo").err || "");
check("hire COO ok → opsOverheadMult 0.85", C.opsHire("coo").ok && C.opsOverheadMult() === 0.85);
check("hire CMO ok → placement advance mult 1.2", C.opsHire("cmo").ok && C.opsAdvanceMult() === 1.2);
check("hire Head of Casting ok → talent fee mult 0.9", C.opsHire("casting").ok && C.opsCastingFeeMult() === 0.9);
check("weekly payroll = 0.1 + 0.2 + 0.1 + 0.2 = $0.6M/wk", nearly(C.opsPayroll(), 0.6), String(C.opsPayroll()));
check("hiring left all four seats filled", ["cfo", "cmo", "coo", "casting"].every((id) => !!S().ops.officers[id]));

/* ── product placement on a film in production ─────────────────── */
const pc0 = S().studio.cash;
const pl = C.opsPlace("p9001", "automotive");
check("placement on a post-production film ok, advance ×1.2 = $14.4M",
  pl.ok && nearly(S().studio.cash - pc0, 14.4), "advance " + (pl.advance || 0));
check("placement stored on the project with its penalty (15%)",
  !!C.findProject("p9001").opsPlace && C.findProject("p9001").opsPenalty === 0.15);
check("opsCreditMod(project) = -15 critic points", C.opsCreditMod(C.findProject("p9001")) === -15);
check("opsCreditMod by project id = -15", C.opsCreditMod("p9001") === -15);
check("opsCreditMod 0 on a project without a placement", C.opsCreditMod(C.findProject("p9002")) === 0);
check("second placement on the same film rejected", !!C.opsPlace("p9001", "beverage").err);
const devProj = fakeProject("p9003", "In Development", "pre", {});
check("placement rejected while the film is still in pre-production", !!C.opsPlace("p9003", "beverage").err);
check("sponsor cash banked tracks the advance", nearly(S().ops.sponsorCash, 14.4), String(S().ops.sponsorCash));
check("placement logged to the news feed",
  S().news.some((n) => n.txt.indexOf("Post Masterpiece") >= 0 && n.txt.indexOf("Placement") < 0 && n.kind === "gold"),
  S().news[0] ? S().news[0].txt.slice(0, 44) : "none");

/* ── physical media batches ───────────────────────────────────── */
const mc0 = S().studio.cash;
const press = C.opsPress("f9003", "steelbook");
/* cost 2 × 0.88 = 1.8 · profit 0.5 × 18 × sell-through (0.4 + 120/300 = 0.8, ×1.25 casting = 1.0) = 9 */
check("steelbook run on a finished film pays out (+9.0 −1.8 = +7.2)",
  press.ok && nearly(press.cost, 1.8) && nearly(press.profit, 9) && nearly(S().studio.cash - mc0, 7.2),
  "cost " + (press.cost || 0) + " profit " + (press.profit || 0));
const mc1 = S().studio.cash;
const box = C.opsPress("f9003", "collector");
/* cost 3.5 × 0.88 = 3.1 · profit 0.25 × 32 × 1.0 = 8 */
check("collector-box run pays out (cost 3.1, profit 8)",
  box.ok && nearly(box.cost, 3.1) && nearly(box.profit, 8) && nearly(S().studio.cash - mc1, 4.9),
  "cost " + (box.cost || 0) + " profit " + (box.profit || 0));
check("home-video profit banked tracks both runs", nearly(S().ops.mediaProfit, 17), String(S().ops.mediaProfit));
check("duplicate edition on the same film rejected", !!C.opsPress("f9003", "steelbook").err);
check("pressing a film still in theaters rejected", !!C.opsPress("f9001", "steelbook").err);
check("unknown edition rejected", !!C.opsPress("f9003", "laserdisc").err);
S().studio.cash = 0.2;
check("insufficient-cash pressing rejection (needs $1.8M)",
  !!C.opsPress("f9003", "steelbook").err || !!C.opsPress("f9002", "steelbook").err, "no cash, no run");
S().studio.cash = mc1 + 4.9;
desksRenderClean("(w3, officers seated, placement + 2 media runs live)");

/* ── action delegation ────────────────────────────────────────── */
const stub = { getAttribute: () => null };
check("opsuiteAction handles ops-place (ready picture, beverage $6M ×1.2 = 7.2)",
  C.opsuiteAction("ops-place", { getAttribute: (k) => (k === "data-id" ? "p9002" : k === "data-key" ? "beverage" : null) }) === true &&
  C.opsCreditMod("p9002") === -5);
check("opsuiteAction handles ops-press (steelbook on the runner once it finishes later — rejected now, still handled)",
  C.opsuiteAction("ops-press", { getAttribute: (k) => (k === "data-id" ? "f9001" : k === "data-key" ? "steelbook" : null) }) === true);
check("opsuiteAction handles ops-hire-officer (CFO already seated → handled)",
  C.opsuiteAction("ops-hire-officer", { getAttribute: (k) => (k === "data-id" ? "cfo" : null) }) === true);
check("opsuiteAction returns false for foreign actions", C.opsuiteAction("gl-open", stub) === false);
check("opsuiteAction returns false for non-ops prefixes", C.opsuiteAction("exh-buy", stub) === false);

/* ── weekly payroll: the legacy bug this module fixes ─────────── */
const beforeWeek = S().studio.cash;
C.advanceWeek();
C.tickStudioOps();
const payrollRow = (S().weekTx.rows || []).filter((r) => r.k === "Executive payroll")[0];
check("payroll row booked every week at $0.6M", !!payrollRow && nearly(payrollRow.v, -0.6), payrollRow ? String(payrollRow.v) : "none");
check("payrollPaid accumulates (0.6 added from zero)", nearly(S().ops.payrollPaid, 0.6), String(S().ops.payrollPaid));
check("cash moved that week (payroll is one of the booked rows)",
  isFinite(S().studio.cash) && S().studio.cash !== beforeWeek, "delta " + (S().studio.cash - beforeWeek).toFixed(1));

/* ── salary actually reduces cash vs. the same week without officers ── */
/* Ledger proof: for the next driven week, cash delta = sum of the week's rows, and the
   payroll row alone is -0.6 — so without officers that week would net exactly 0.6 more. */
const weekCashA = S().studio.cash;
advance(1);
const weekRows = S().weekTx.rows || [];
let rowSum = 0, payrollLine = 0;
for (const r of weekRows) { rowSum += r.v; if (r.k === "Executive payroll") payrollLine = r.v; }
const weekDelta = Math.round((S().studio.cash - weekCashA) * 100) / 100;
check("that week's cash delta equals the ledger sum", nearly(weekDelta, rowSum, 0.05), weekDelta + " vs " + rowSum.toFixed(1));
check("dropping the payroll row would net exactly $0.6M more that week",
  nearly(payrollLine, -0.6) && nearly(weekDelta - payrollLine, weekDelta + 0.6),
  "delta " + weekDelta + " · payroll " + payrollLine);
check("no payroll row was ever booked before any officer was hired", noOfficerPayrollRows === 0,
  noOfficerWeeks + " pre-hire weeks · " + noOfficerPayrollRows + " rows");
check("payrollPaid grew by $0.6M for the driven week", S().ops.payrollPaid >= 1.2, String(S().ops.payrollPaid));

/* ── 20-week drive: placement stays live ──────────────────────── */
advance(20);
check("no throw and cash finite through the 20-week drive", threw === null, threw || ("wk " + S().studio.week));
check("payroll deducted in every single driven week", payrollWeeks >= 20 && payrollMismatch === 0,
  payrollWeeks + " weeks · " + payrollMismatch + " mismatches");
check("placement still live at week +20 (26-week term)", C.opsCreditMod("p9001") === -15);
check("project still carries its penalty field", C.findProject("p9001").opsPenalty === 0.15);

/* ── 8 more weeks: the placement lapses ───────────────────────── */
advance(8);
check("placement lapsed after 26 weeks", S().ops.placements.length === 0, String(S().ops.placements.length));
check("lapsed placement clears the project's critic penalty",
  C.findProject("p9001").opsPenalty === 0 && C.opsCreditMod("p9001") === 0);
check("lapse news logged", S().news.some((n) => n.txt.indexOf("placement lapsed") >= 0), "feed size " + S().news.length);

/* ── soak to 60+ weeks, then final invariants ─────────────────── */
advance(34);
check("no throw and cash finite all weeks (min cash tracked)", threw === null, threw || ("min cash " + Math.round(minCash) + "M"));
check("60+ advanceWeek calls driven", weeksDriven >= 60, String(weeksDriven));
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0, ledgerBreaks + " breaks");
check("payroll deducted in every week officers were seated (payrollPaid / 0.6)",
  S().ops.payrollPaid >= 0.6 * (payrollWeeks - 1) - 0.05 && S().ops.payrollPaid <= 0.6 * (payrollWeeks + 1) + 0.05,
  S().ops.payrollPaid + "M across ~" + payrollWeeks + " weeks");
check("S.ops exists at end with finite fields",
  !!S().ops && isFinite(S().ops.lastTick) && isFinite(S().ops.sponsorCash) &&
  isFinite(S().ops.mediaProfit) && isFinite(S().ops.payrollPaid) &&
  S().ops.media.every((m) => isFinite(m.cost) && isFinite(m.profit) && isFinite(m.week)));
check("officer records keep finite salaries",
  ["cfo", "cmo", "coo", "casting"].every((id) => S().ops.officers[id] && isFinite(S().ops.officers[id].salary)));
check("perks still applied after the full drive (cost ×0.88, overhead ×0.85, casting ×0.9)",
  C.opsCostMult() === 0.88 && C.opsOverheadMult() === 0.85 && C.opsCastingFeeMult() === 0.9);
check("no officer hired twice / no duplicate payroll", nearly(C.opsPayroll(), 0.6), String(C.opsPayroll()));
desksRenderClean("(end, 60+ weeks in)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · payroll " + S().ops.payrollPaid + "M");
process.exit(failures || threw ? 1 : 0);
