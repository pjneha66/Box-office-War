/* Box Office War — rebuilt. Corporate finance module (read-only analytics) — all state under S.fin.
   Desk "Corporate finance": 5-year DCF valuation (WACC 10% + terminal value), comparable companies
   (the 4 rivals), key ratios, and a desk-local currency display (fmc) that never touches fm().
   Finance moves no cash: forecastAdjust() → 0, kept uniform with library.js (finance.js loads last
   among forecast contributors, so the engine's 12-week forecast behavior is unchanged).
   No weekly tick is needed (the engine calls none for this module) — the desk reads live engine state.
   Wiring: ui.js bridges finAction() for "fin-*" actions; desks registered via FINANCE_DESKS. */
"use strict";

/* ── state (lazy ensure — old saves have no S.fin) ───────────── */
function finEnsure() {
  if (!S.fin) S.fin = { currency: "USD" };
  if (!S.fin.currency) S.fin.currency = "USD";
}

/* Desk-local currency display. Fixed illustrative rates; $M stays the canonical stored unit. */
var FIN_CURRENCIES = {
  USD: { sym: "$", rate: 1,    unit: "M"  },
  INR: { sym: "₹", rate: 8.3,  unit: "Cr" },  /* $1M ≈ ₹8.3 crore */
  JPY: { sym: "¥", rate: 1.5,  unit: "億" },  /* $1M ≈ ¥150M = 1.5 oku */
  EUR: { sym: "€", rate: 0.92, unit: "M"  },
  GBP: { sym: "£", rate: 0.79, unit: "M"  }
};
var FIN_CURRENCY_LIST = [
  { id: "USD", label: "USD $" },
  { id: "INR", label: "₹ Cr" },
  { id: "JPY", label: "¥ 億" },
  { id: "EUR", label: "€" },
  { id: "GBP", label: "£" }
];
function fmc(x) {
  finEnsure();
  if (!isFinite(x)) return "—";
  var c = FIN_CURRENCIES[S.fin.currency] || FIN_CURRENCIES.USD;
  var v = x * c.rate, a = Math.abs(v), body;
  if (c.unit === "M" && a >= 950) body = (a / 1000).toFixed(2) + "B";
  else body = a >= 100 ? String(Math.round(a)) : a.toFixed(1);
  return (v < 0 ? "-" : "") + c.sym + body + c.unit;
}

/* ── DCF: 5 projected years, 10% WACC, terminal = FCF5 × 8 ───── */
function finAgencyWk() {
  if (!S.agency || !S.agency.founded) return 0;
  var com = 0, i, t;
  for (i = 0; i < S.agency.clients.length; i++) { t = findTalent(S.agency.clients[i]); if (t) com += t.power * 0.08; }
  return com;
}
function finForecastStats() {
  var rows = forecast12(), i, net = 0, inn = 0;
  for (i = 0; i < rows.length; i++) { net += rows[i].inn - rows[i].out; inn += rows[i].inn; }
  var n = Math.max(1, rows.length);
  return { wkNet: net / n, wkInn: inn / n };
}
function finFcfYears() {
  var fs = finForecastStats();
  var royWk = S.studio.catalog * 0.004;                     /* engine's weekly library royalty */
  var otherWk = Math.max(0, fs.wkInn - royWk - finAgencyWk()); /* recurring non-royalty income (streamer/game flows via forecastAdjust) */
  var fcf = [fs.wkNet * 52, fs.wkNet * 52], i;
  var recurring = (royWk + otherWk) * 52;
  for (i = 3; i <= 5; i++) fcf.push(recurring * Math.pow(0.9, i - 2)); /* 10% annual decay on later years */
  return fcf;
}
function finDcf() {
  var fcf = finFcfYears(), pv = 0, i, w = 0.10;
  for (i = 0; i < 5; i++) pv += (fcf[i] || 0) / Math.pow(1 + w, i + 1);
  var tv = (fcf[4] || 0) * 8;
  pv += tv / Math.pow(1 + w, 5);
  return { fcf: fcf, tv: tv, value: pv };
}

/* ── key ratios (annualized from the 10-week txHistory window) ── */
function finIncome52() {
  var t = S.txHistory, i, inn = 0;
  for (i = 0; i < t.length; i++) inn += t[i].in;
  return t.length ? inn * 52 / t.length : 0;
}
function finDebt() {
  var d = S.mezz || 0, i;
  for (i = 0; i < S.loans.length; i++) d += S.loans[i].amt;
  return d;
}
function finInterestWk() {
  var it = (S.mezz || 0) * 0.012, i;
  for (i = 0; i < S.loans.length; i++) it += S.loans[i].amt * S.loans[i].rate;
  return it;
}
function finRatios() {
  var income = finIncome52(), debt = finDebt();
  var net = 0, inn = 0, i;
  for (i = 0; i < S.txHistory.length; i++) { net += S.txHistory[i].in - S.txHistory[i].out; inn += S.txHistory[i].in; }
  return {
    debt: debt,
    income: income,
    debtEarnings: debt / Math.max(1, income),
    cover: income / Math.max(0.1, finInterestWk() * 52),
    margin: net / Math.max(0.1, inn)   /* weekly margin over the txHistory window */
  };
}

/* ── comparable companies: estVal = ytd × 8, verdict vs median ──
   Note: the rebuilt engine seeds S.rivals[].ytd at 0 and does not accumulate it yet —
   rows show whatever the engine currently tracks (zeros until that feed exists). */
function finComps() {
  var rows = [], mults = [], i, r, m;
  for (i = 0; i < S.rivals.length; i++) {
    r = S.rivals[i];
    m = r.ytd > 0 ? 8 : null;   /* estVal = ytd × 8, so a priced rival always trades at the model's 8× */
    if (m != null) mults.push(m);
    rows.push({ name: r.name, ytd: r.ytd, val: r.ytd * 8, mult: m });
  }
  mults.sort(function (a, b) { return a - b; });
  var med = mults.length
    ? (mults.length % 2 ? mults[(mults.length - 1) / 2] : (mults[mults.length / 2 - 1] + mults[mults.length / 2]) / 2)
    : 8;                        /* fall back to the model multiple when no rival is priced */
  return { rows: rows, med: med };
}
function finVerdict(myMult, med) {
  if (myMult >= med * 1.15) return { t: "Premium", c: "gold" };
  if (myMult <= med * 0.85) return { t: "Discount", c: "red" };
  return { t: "Fair", c: "blue" };
}

/* ── desk ─────────────────────────────────────────────────────── */
function finDesk() {
  finEnsure();
  var html = '<div data-findesk="corp">';
  var dcf = finDcf(), f = dcf.fcf, i;
  html += '<div class="sechead"><h2>Studio DCF valuation</h2></div><div class="card">';
  html += statrow("FCF year 1 · forecast12 net × 52", fmc(f[0]), f[0] >= 0 ? "up" : "down");
  html += statrow("FCF year 2 · forecast12 net × 52", fmc(f[1]), f[1] >= 0 ? "up" : "down");
  html += statrow("FCF year 3 · royalties + recurring ×0.9", fmc(f[2]), f[2] >= 0 ? "up" : "down");
  html += statrow("FCF year 4 · ×0.9²", fmc(f[3]), f[3] >= 0 ? "up" : "down");
  html += statrow("FCF year 5 · ×0.9³", fmc(f[4]), f[4] >= 0 ? "up" : "down");
  html += statrow("Terminal value · FCF5 × 8", fmc(dcf.tv));
  html += statrow("Discount rate (WACC)", "10%");
  html += '<div class="statrow"><span class="k"><b>Valuation — PV of FCF + terminal</b></span><span class="v num up"><b>' + fmc(dcf.value) + "</b></span></div>";
  html += "</div>";

  var comps = finComps();
  var myMult = dcf.value / Math.max(1, finIncome52());
  var verdict = finVerdict(myMult, comps.med);
  html += '<div class="sechead"><h2>Comparable companies</h2></div><div class="card">';
  for (i = 0; i < comps.rows.length; i++) {
    var cr = comps.rows[i];
    html += '<div class="statrow"><span class="k">' + esc(cr.name) + '</span><span class="v num">'
      + fmc(cr.ytd) + " ytd · " + (cr.ytd > 0 ? fmc(cr.val) : "—")
      + (cr.mult != null ? " · " + cr.mult.toFixed(1) + "×" : "") + "</span></div>";
  }
  html += statrow("Median EV/Revenue (rivals)", comps.med.toFixed(1) + "×");
  html += statrow("Your multiple · valuation ÷ revenue run-rate", myMult.toFixed(2) + "×");
  html += '<div class="statrow"><span class="k">Verdict vs rivals</span><span class="v">' + tag(verdict.t, verdict.c) + "</span></div>";
  html += "</div>";

  var ra = finRatios();
  html += '<div class="sechead"><h2>Key ratios</h2></div><div class="card">';
  html += statrow("Total debt", fmc(ra.debt));
  html += statrow("Income run-rate (annualized)", fmc(ra.income));
  html += statrow("Debt ÷ earnings", ra.debtEarnings.toFixed(2) + "×", ra.debtEarnings > 3 ? "down" : "");
  html += statrow("Interest coverage", finInterestWk() > 0 ? ra.cover.toFixed(1) + "×" : "n/a — no debt");
  html += statrow("Weekly margin (10-wk window)", Math.round(ra.margin * 100) + "%", ra.margin >= 0 ? "up" : "down");
  html += "</div>";

  html += '<div class="sechead"><h2>Currency</h2></div><div class="card">'
    + '<div class="field-label">Desk display currency — this desk only; fm() everywhere else is unchanged</div>'
    + '<div class="seg">';
  for (i = 0; i < FIN_CURRENCY_LIST.length; i++) {
    var cu = FIN_CURRENCY_LIST[i];
    html += '<button class="' + (S.fin.currency === cu.id ? "on" : "") + '" data-action="fin-currency" data-key="' + cu.id + '">' + cu.label + "</button>";
  }
  html += "</div></div></div>";
  return html;
}

/* ── commit + action delegation (ui calls finAction first) ────── */
function finCommit() {
  saveGame();
  if (typeof render === "function") render();
}
function finAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("fin-") !== 0) return false;
  finEnsure();
  if (a === "fin-currency") {
    var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
    if (key && FIN_CURRENCIES[key]) S.fin.currency = key;
    finCommit();
    return true;
  }
  return false;
}

var FINANCE_DESKS = [
  { id: "fin-desk", group: "Finance desk", icon: "💼", name: "Corporate finance",
    desc: "Read-only analytics: 5-year DCF valuation, comparable rivals, key ratios, desk-local currency.",
    render: finDesk }
];

function forecastAdjust_finance() { return 0; } /* finance moves no cash — uniform with library.js */
