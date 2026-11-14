/* Rebuild finance-module harness (pattern from test/rebuild-games.mjs): runs game/data.js +
   game/engine.js + game/finance.js in a VM sandbox with a stubbed localStorage. ui.js needs a DOM,
   so the two string helpers the desk renders with (tag, statrow) are stubbed verbatim from ui.js.
   Finance is read-only analytics — there are no spend paths to reject and no weekly tick; the
   harness drives 60 advanceWeek() calls, then exercises all four desk systems through the module's
   real functions: DCF (finite + positive on a healthy library), comparables, key ratios (with a
   live loan on the books), and the desk-local currency toggle (fmc strings change per currency).
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
  /* ui.js string helpers (ui.js itself can't load without a DOM); same behavior as ui.js */
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>"
});
for (const f of ["data.js", "engine.js", "finance.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

function stub(key) {
  return { getAttribute: (k) => (k === "data-key" && key != null ? key : null) };
}
function deskHtml() { return C.FINANCE_DESKS[0].render(); }
function deskClean(label) {
  let html = null, bad = "";
  try { html = deskHtml(); } catch (e) { bad = "threw: " + e.message; }
  if (!bad && (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0)) bad = "dirty output";
  check("fin-desk renders clean " + label, bad === "", bad);
}

/* ── static contract checks ───────────────────────────────────── */
const src = readFileSync(path.join(gameDir, "finance.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports finAction / fmc / forecastAdjust / finEnsure",
  typeof C.finAction === "function" && typeof C.fmc === "function" &&
  typeof C.forecastAdjust === "function" && typeof C.finEnsure === "function");
check("FINANCE_DESKS is a shaped 1-desk array (fin-desk / Finance desk)",
  Array.isArray(C.FINANCE_DESKS) && C.FINANCE_DESKS.length === 1 &&
  C.FINANCE_DESKS[0].id === "fin-desk" && C.FINANCE_DESKS[0].group === "Finance desk" &&
  C.FINANCE_DESKS[0].icon === "💼" && C.FINANCE_DESKS[0].name === "Corporate finance" &&
  typeof C.FINANCE_DESKS[0].render === "function");

/* ── week 1: lazy ensure + desk shape ─────────────────────────── */
C.newGame("Fin Test Studios", "veteran");
check("forecastAdjust() → 0 (finance moves no cash)", C.forecastAdjust(50) === 0);
deskHtml();
check("S.fin namespace created lazily by desk render", !!S().fin && S().fin.currency === "USD");
let html = deskHtml();
check("desk carries marker + all four sections + currency seg",
  html.indexOf('data-findesk="corp"') >= 0 && html.indexOf("Studio DCF valuation") >= 0 &&
  html.indexOf("Comparable companies") >= 0 && html.indexOf("Key ratios") >= 0 &&
  html.indexOf("fin-currency") >= 0);
check("comparables table lists all 4 rivals",
  S().rivals.every((r) => html.indexOf(r.name.replace("&", "&amp;")) >= 0)); /* desk esc()s names */
deskClean("(week 1, fresh studio)");
check("finAction returns false for foreign actions", C.finAction("gl-open", stub()) === false);

/* ── 60 driven weeks: cash finite, no throw ───────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
for (let i = 0; i < 60; i++) {
  try { C.advanceWeek(); } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); break; }
  weeksDriven++;
  if (!isFinite(S().studio.cash)) { threw = "non-finite cash at week " + S().studio.week; break; }
  if (S().studio.cash < minCash) minCash = S().studio.cash;
  if (S().over) { threw = "bankrupt at week " + S().studio.week; break; }
}
check("no throw and cash finite all 60 weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("60 advanceWeek calls driven", weeksDriven >= 60, String(weeksDriven));
deskClean("(week 61, after 60 driven weeks)");

/* ── DCF: finite always; finite + positive on a healthy library ── */
let dcf = C.finDcf();
check("DCF finite on the raw run state (value may be negative)",
  isFinite(dcf.value) && dcf.fcf.every((v) => isFinite(v)) && isFinite(dcf.tv), "value " + Math.round(dcf.value) + "M");
S().studio.catalog = 200; /* healthy library: royalties 0.8M/wk cover overhead 0.65M/wk */
dcf = C.finDcf();
check("DCF finite positive with a healthy catalog", isFinite(dcf.value) && dcf.value > 0, "value " + Math.round(dcf.value) + "M");
check("terminal value = FCF5 × 8", nearly(dcf.tv, dcf.fcf[4] * 8, 1e-6));
check("FCF years 1-2 from forecast12 net × 52", nearly(dcf.fcf[0], dcf.fcf[1]));
check("FCF years 3-5 decay ×0.9 per year",
  nearly(dcf.fcf[3], dcf.fcf[2] * 0.9, 1e-6) && nearly(dcf.fcf[4], dcf.fcf[2] * 0.81, 1e-6));
deskClean("(healthy catalog)");

/* ── key ratios: finite with a live loan on the books ──────────── */
check("emergency loan taken", C.takeLoan() === true && C.finDebt() === 30);
const ra = C.finRatios();
check("ratios finite: debt÷earnings, interest coverage, weekly margin",
  isFinite(ra.debtEarnings) && isFinite(ra.cover) && isFinite(ra.margin),
  "de " + ra.debtEarnings.toFixed(2) + "× · cover " + ra.cover.toFixed(2) + "× · margin " + Math.round(ra.margin * 100) + "%");
check("debt÷earnings uses total debt ÷ max(1, income)", nearly(ra.debtEarnings, 30 / Math.max(1, ra.income), 1e-9));
check("repay loan restores debt to 0", C.repayLoan() === true && C.finDebt() === 0);
deskClean("(after loan cycle)");

/* ── currency switch: fmc strings change per currency ──────────── */
const probe = 12.3456;
const outs = {};
for (const cur of ["USD", "INR", "JPY", "EUR", "GBP"]) {
  S().fin.currency = cur;
  outs[cur] = C.fmc(probe);
  check("fmc(" + probe + ") renders " + cur + " → " + outs[cur],
    typeof outs[cur] === "string" && outs[cur].indexOf("NaN") < 0 && outs[cur].indexOf("—") < 0);
}
check("all five currency strings differ", new Set(Object.values(outs)).size === 5, Object.values(outs).join(" | "));
check("INR shows crores, JPY shows oku", outs.INR.indexOf("Cr") >= 0 && outs.JPY.indexOf("億") >= 0);
check("fmc guards non-finite", C.fmc(NaN) === "—" && C.fmc(Infinity) === "—");
S().fin.currency = "USD";

check("action switches currency to INR", C.finAction("fin-currency", stub("INR")) === true && S().fin.currency === "INR");
check("currency change persisted via saveGame()",
  JSON.parse(mem["bow2.save.v1"]).fin.currency === "INR");
check("desk reflects INR", deskHtml().indexOf("₹") >= 0 && deskHtml().indexOf("Cr") >= 0);
check("desk renders clean in every currency",
  ["USD", "INR", "JPY", "EUR", "GBP"].every((cur) => {
    S().fin.currency = cur;
    const h = deskHtml();
    return typeof h === "string" && h.indexOf("NaN") < 0 && h.indexOf("undefined") < 0;
  }));
check("action switches back to USD", C.finAction("fin-currency", stub("USD")) === true && S().fin.currency === "USD");
deskClean("(final, USD)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
