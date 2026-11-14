/* Rebuild OTT-module harness (pattern from test/rebuild-pr.mjs): runs game/data.js +
   game/engine.js + game/ott.js in a VM sandbox with a stubbed localStorage. ui.js needs
   a DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed verbatim.
   Drives 40 advanceWeek() calls, calling tickOTT() after each (the integrator wiring —
   engine.js does not call tickOTT itself yet), and exercises offer generation, accept,
   decline + cooldown, expiry, the cap, window thresholds and forecastAdjust through the
   module's real functions. Prints one line per check; exits non-zero on failure. */
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
for (const f of ["data.js", "engine.js", "ott.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const stubId = (id) => ({ getAttribute: (k) => (k === "data-id" ? id : null) });
const stubBare = { getAttribute: () => null };

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "ott.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickOTT/ottAction/forecastAdjust",
  typeof C.tickOTT === "function" && typeof C.ottAction === "function" && typeof C.forecastAdjust === "function");
check("OTT_DESKS is the ott-deals desk in TV & Streaming",
  Array.isArray(C.OTT_DESKS) && C.OTT_DESKS.length === 1 &&
  C.OTT_DESKS[0].id === "ott-deals" && C.OTT_DESKS[0].group === "TV & Streaming" &&
  C.OTT_DESKS[0].icon === "📺" && C.OTT_DESKS[0].name === "OTT deals" &&
  typeof C.OTT_DESKS[0].desc === "string" && typeof C.OTT_DESKS[0].render === "function");

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
let capHeld = true, forecastOk = true, tailRows = 0;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek();
      C.tickOTT(); /* integrator wiring: test calls tickOTT after each advanceWeek */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
    if (S().ott.offers.length > 4) capHeld = false;
    const fa = C.forecastAdjust(st.week);
    if (!(typeof fa === "number" && isFinite(fa) && fa >= 0)) forecastOk = false;
    if (S().weekTx) for (const r of S().weekTx.rows) if (r.k === "OTT tail · Prestige Fake") tailRows++;
  }
}
function fakeFilm(id, title, genre, opts) {
  const o = opts || {};
  const opening = o.opening || 30, legs = o.legs || 4;
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening, legs, decay: 1 - 1 / legs, weeksOut: o.weeksOut || 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null,
    window: o.window != null ? o.window : 45,
    status: "run"
  });
}
function desksRenderClean(label, wantButtons) {
  let html = null, bad = "";
  try { html = C.OTT_DESKS[0].render(); } catch (e) { bad = "threw: " + e.message; }
  if (!bad && (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0)) bad = "bad html";
  if (!bad && wantButtons && html.indexOf('data-action="ott-accept"') < 0) bad = "no accept button";
  check("desk renders clean " + label, bad === "", bad);
}

/* ── week 1: lazy ensure ──────────────────────────────────────── */
C.newGame("OTT Test Studios", "major");
C.tickOTT();
check("S.ott namespace created lazily by tickOTT", !!S().ott);
check("8 platforms seeded at rel 50",
  S().ott.platforms.length === 8 && S().ott.platforms.every((p) => p.rel === 50 && p.n && isFinite(p.generosity)),
  S().ott.platforms.map((p) => p.n + ":" + p.rel).join(","));
check("offers/deals/declined start empty", S().ott.offers.length === 0 && S().ott.deals.length === 0 && Object.keys(S().ott.declined).length === 0);
const fa0 = C.forecastAdjust(1);
check("forecastAdjust returns a number ≥ 0 pre-deals", typeof fa0 === "number" && fa0 >= 0 && fa0 === 0, String(fa0));

/* seed released films directly into S.films (window 45 default / 90 long / 17 short) */
fakeFilm("fA", "Prestige Fake", "drama", { window: 45, legs: 4, opening: 30 });
fakeFilm("fB", "Long Haul Epic", "action", { window: 90, legs: 4.4, opening: 40 });
fakeFilm("fC", "Quick Laughs", "comedy", { window: 17, legs: 3.5, opening: 25 });

/* ── insufficient-window path: weeksOut below the pay-1 week ──── */
advance(1); /* w2 — every film weeksOut 1 */
check("no offers while weeksOut below threshold (w2)", S().ott.offers.length === 0, "offers " + S().ott.offers.length);
advance(3); /* w5 — fC (window 17 → week 3) eligible since w4 */
const cOffer = S().ott.offers.find((o) => o.filmId === "fC");
check("short-window film got its offer (fC, weeksOut ≥ 3)", !!cOffer, cOffer ? "from " + cOffer.platId : "none");
check("best-taste platform bids on comedy (Peacocke)", cOffer && cOffer.platId === "peacocke", cOffer ? cOffer.platId : "none");
check("no offer for window-45 film yet (weeksOut 4 < 7)", !S().ott.offers.some((o) => o.filmId === "fA"));
check("no offer for window-90 film yet (weeksOut 4 < 13)", !S().ott.offers.some((o) => o.filmId === "fB"));
advance(3); /* w8 — fA (window 45 → week 7) eligible since w8 */
const aOffer = S().ott.offers.find((o) => o.filmId === "fA");
check("window-45 film got its offer at weeksOut 7", !!aOffer, aOffer ? "from " + aOffer.platId : "none");
check("best-taste platform bids on drama (Appletv+)", aOffer && aOffer.platId === "appletv", aOffer ? aOffer.platId : "none");
check("pay1 = ww×0.30×generosity×taste×windowMult×rf ∈ [43,65]",
  aOffer && isFinite(aOffer.pay1) && aOffer.pay1 >= 43 && aOffer.pay1 <= 65, aOffer ? "$" + aOffer.pay1 + "M" : "none");
check("tail = pay1×0.02 rounded to cents",
  aOffer && nearly(aOffer.tail, Math.round(aOffer.pay1 * 0.02 * 100) / 100), aOffer ? "$" + aOffer.tail + "M" : "none");
check("offer expires 4 weeks out", aOffer && aOffer.expires === S().studio.week + 4, aOffer ? "exp " + aOffer.expires : "none");
check("open offers capped at 4", S().ott.offers.length <= 4, String(S().ott.offers.length));
desksRenderClean("(w8, two open offers)", true);

/* ── accept: pay-1 now, deal recorded, rel +5, news ───────────── */
const pay1 = aOffer.pay1, tail = aOffer.tail, wk8 = S().studio.week;
const cash0 = S().studio.cash;
check("ottAction routes ott-accept", C.ottAction("ott-accept", stubId(aOffer.id)) === true);
check("pay-1 earned immediately", nearly(S().studio.cash - cash0, pay1), "+" + (S().studio.cash - cash0).toFixed(1));
const deal = S().ott.deals.find((d) => d.filmId === "fA");
check("deal recorded with tail, until wk+8", !!deal && nearly(deal.weekly, tail) && deal.until === wk8 + 8 && deal.since === wk8,
  deal ? "since " + deal.since + " until " + deal.until : "none");
check("platform rel +5 on accept", S().ott.platforms.find((p) => p.id === "appletv").rel === 55);
check("offer removed on accept", !S().ott.offers.some((o) => o.id === aOffer.id));
check("news logged for the deal", S().news[0] && S().news[0].txt.indexOf("Prestige Fake") >= 0, S().news[0] ? S().news[0].txt.slice(0, 40) : "none");
check("ledger row 'OTT deal · title' = pay1",
  S().weekTx.rows.some((r) => r.k === "OTT deal · Prestige Fake" && nearly(r.v, pay1)));

/* forecastAdjust: tails scheduled for weeks since+1 .. until */
check("forecastAdjust(accept week) = 0", C.forecastAdjust(wk8) === 0, String(C.forecastAdjust(wk8)));
check("forecastAdjust(wk+1) = tail", nearly(C.forecastAdjust(wk8 + 1), tail), String(C.forecastAdjust(wk8 + 1)));
check("forecastAdjust(until) = tail", nearly(C.forecastAdjust(wk8 + 8), tail), String(C.forecastAdjust(wk8 + 8)));
check("forecastAdjust(until+1) = 0", C.forecastAdjust(wk8 + 9) === 0, String(C.forecastAdjust(wk8 + 9)));
S().ott.deals.push({ filmId: "fx", title: "Synth", platId: "maxx", tail: 0.5, weekly: 0.5, since: wk8 + 1, until: wk8 + 4 });
check("forecastAdjust sums concurrent deals", nearly(C.forecastAdjust(wk8 + 2), tail + 0.5), String(C.forecastAdjust(wk8 + 2)));
S().ott.deals.splice(S().ott.deals.findIndex((d) => d.filmId === "fx"), 1);

/* ── decline: rel −3, 12-week cooldown for that film+platform ─── */
const pC = S().ott.platforms.find((p) => p.id === "peacocke");
check("ottAction routes ott-decline", C.ottAction("ott-decline", stubId(cOffer.id)) === true);
check("platform rel −3 on decline", pC.rel === 47, String(pC.rel));
check("declined map set {filmId+platId: week}", S().ott.declined["fCpeacocke"] === S().studio.week);
check("offer removed on decline", S().ott.offers.length === 0, String(S().ott.offers.length));

/* ── tails paid weekly; cooldown redirects the re-bid ─────────── */
advance(1); /* w9 — first tail week; fC re-bids without Peacocke */
check("weekly tail paid ('OTT tail · title')",
  S().weekTx.rows.some((r) => r.k === "OTT tail · Prestige Fake" && nearly(r.v, tail, 0.06)),
  S().weekTx.rows.filter((r) => r.k.indexOf("OTT tail") === 0).map((r) => r.k + "=" + r.v).join(","));
const cRe = S().ott.offers.find((o) => o.filmId === "fC");
check("declined platform skipped during cooldown", cRe && cRe.platId !== "peacocke", cRe ? "from " + cRe.platId : "none");
check("film re-offered by another platform", !!cRe, cRe ? "from " + cRe.platId : "none");

/* ── expiry: unaccepted offers die at their expires week ──────── */
advance(5); /* w14 — fC's w9 offer (exp 13) swept; fB (window 90 → week 13) eligible */
check("expired offer removed (fC w9 offer gone)", !S().ott.offers.some((o) => o.id === (cRe && cRe.id)));
check("expired offer re-bid in same tick", !!S().ott.offers.find((o) => o.filmId === "fC"), "offers " + S().ott.offers.length);
const bOffer = S().ott.offers.find((o) => o.filmId === "fB");
check("window-90 film got its offer at weeksOut 13", !!bOffer, bOffer ? "from " + bOffer.platId : "none");
check("best-taste platform bids on action (PrimeVideoy)", bOffer && bOffer.platId === "primevideoy", bOffer ? bOffer.platId : "none");
desksRenderClean("(w14, window-90 offer open)", true);
advance(5); /* w19 — fB's offer (exp 18) swept */
check("window-90 offer expired unaccepted", !S().ott.offers.some((o) => o.filmId === "fB"), "offers " + S().ott.offers.length);

/* ── cooldown lift: after 12 weeks the platform bids again ────── */
advance(5); /* w24 */
fakeFilm("fE", "Late Comedy", "comedy", { window: 17, legs: 4.4, opening: 30, weeksOut: 5 });
S().ott.declined["fEpeacocke"] = S().studio.week - 12; /* simulate the 12 weeks passed */
S().ott.lastTick = 0;
C.tickOTT();
const eOffer = S().ott.offers.find((o) => o.filmId === "fE");
check("cooldown lifted after 12 weeks (Peacocke re-bids)", eOffer && eOffer.platId === "peacocke", eOffer ? "from " + eOffer.platId : "none");
check("ottAction decline on the re-bid", C.ottAction("ott-decline", stubId(eOffer.id)) === true);
S().ott.lastTick = 0;
C.tickOTT();
const eRe = S().ott.offers.find((o) => o.filmId === "fE");
check("fresh cooldown redirects re-bid away from Peacocke", eRe && eRe.platId !== "peacocke", eRe ? "from " + eRe.platId : "none");

/* ── rel drift toward 50 by 0.5/wk ────────────────────────────── */
S().ott.platforms.find((p) => p.id === "maxx").rel = 60;
S().ott.platforms.find((p) => p.id === "huluu").rel = 30;
S().ott.lastTick = 0;
C.tickOTT();
check("rel drifts down toward 50 (60 → 59.5)", S().ott.platforms.find((p) => p.id === "maxx").rel === 59.5,
  String(S().ott.platforms.find((p) => p.id === "maxx").rel));
check("rel drifts up toward 50 (30 → 30.5)", S().ott.platforms.find((p) => p.id === "huluu").rel === 30.5,
  String(S().ott.platforms.find((p) => p.id === "huluu").rel));

/* ── cap: 4 open offers block new bids even for eligible films ── */
const wkCap = S().studio.week;
for (let i = 1; i <= 4; i++) S().ott.offers.push({ id: "fake" + i, filmId: "fx" + i, title: "Fake " + i, platId: "maxx", pay1: 5, tail: 0.1, expires: wkCap + 10 });
fakeFilm("fF", "Horror Token", "horror", { window: 45, legs: 4, opening: 30, weeksOut: 10 });
S().ott.lastTick = 0;
C.tickOTT();
check("cap holds: no 5th offer created for eligible film",
  S().ott.offers.length === 5 && !S().ott.offers.some((o) => o.filmId === "fF"), "offers " + S().ott.offers.length);
S().ott.offers = S().ott.offers.filter((o) => o.id.indexOf("fake") !== 0);

/* ── run out the 40 weeks; deal expiry + final invariants ─────── */
advance(17); /* total 40 advanceWeek calls */
check("no throw, cash finite, no bankruptcy across all 40 weeks", threw === null, threw || weeksDriven + " weeks, min cash " + Math.round(minCash) + "M");
check("40 advanceWeek calls driven", weeksDriven === 40, String(weeksDriven));
check("open-offer cap held every ticked week", capHeld);
check("forecastAdjust returned a finite number ≥ 0 every week", forecastOk);
check("exactly 8 weekly tails paid for the accepted deal", tailRows === 8, String(tailRows));
check("deal dropped after its 8-week run", S().ott.deals.length === 0, "deals " + S().ott.deals.length);
check("S.ott namespace exists at end", !!S().ott);
check("platform relations all finite in [0,100]",
  S().ott.platforms.length === 8 && S().ott.platforms.every((p) => isFinite(p.rel) && p.rel >= 0 && p.rel <= 100));
check("all open offers finite (pay1/tail/expires)",
  S().ott.offers.every((o) => isFinite(o.pay1) && isFinite(o.tail) && isFinite(o.expires)));
const cashUnknown = S().studio.cash, nOffersUnknown = S().ott.offers.length;
check("ottAction ignores foreign actions", C.ottAction("gl-open", stubBare) === false);
check("ottAction ignores unknown ott-* actions", C.ottAction("ott-foo", stubBare) === false);
check("unknown offer ids: routed, no throw, no state change",
  C.ottAction("ott-accept", stubBare) === true && C.ottAction("ott-accept", stubId("ottNope")) === true &&
  C.ottAction("ott-decline", stubId("ottNope")) === true &&
  S().studio.cash === cashUnknown && S().ott.offers.length === nOffersUnknown);
desksRenderClean("(w41, empty state)", false);

console.log("\n" + (failures || threw ? "FAILED " + (failures + (threw ? 1 : 0)) + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
