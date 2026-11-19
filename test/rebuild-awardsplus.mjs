/* Rebuild deep-awards harness (pattern from test/rebuild-consolehw.mjs): runs
   game/data.js + game/engine.js + game/awards.js + game/awardsplus.js in a VM sandbox
   with a stubbed localStorage. awards.js is loaded because the module extends its
   year-end flow and both shelves share one desk. ui.js needs a DOM, so the two ui
   helpers the desks render with (statrow/tag) are stubbed verbatim.
   Drives 60+ advanceWeek() calls across a year boundary so the real yearAwards() fires
   and awardsPlusCategories() runs from the engine, then exercises the module directly:
   empty/one/many year-film lists, a forced rival winner, the cash bonus ledger row,
   campaign purchase + odds lift + weekly decay, the action bridge and its
   insufficient-cash rejection. Prints one line per check; exits non-zero on failure. */
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
  statrow: (k, v, cls) =>
    '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "awards.js", "awardsplus.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "awardsplus.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("declares \"use strict\"", src.indexOf('"use strict";') >= 0);
check("exports tickAwardsPlus / awardsPlusCategories / awardsPlusNominees / awpOdds / awardsplusAction",
  typeof C.tickAwardsPlus === "function" && typeof C.awardsPlusCategories === "function" &&
  typeof C.awardsPlusNominees === "function" && typeof C.awpOdds === "function" &&
  typeof C.awardsplusAction === "function");
check("honors awards.js ownership: no S.aw namespace creation in the module",
  !src.includes("S.aw =") && !src.includes("S.aw.history.push"));
check("does not redefine awards.js's own functions",
  !/function\s+extraAwardCategories\b/.test(src) && !/function\s+awEnsure\b/.test(src) &&
  !/function\s+awRecord\b/.test(src) && !/function\s+awardsAction\b/.test(src) &&
  !/function\s+awBestActor\b/.test(src));
check("awards.js's extraAwardCategories is a different function object from awardsPlusCategories",
  typeof C.extraAwardCategories === "function" && C.awardsPlusCategories !== C.extraAwardCategories);
check("AWARDSPLUS_DESKS is an array of 2 'Awards' desks with unique ids",
  Array.isArray(C.AWARDSPLUS_DESKS) && C.AWARDSPLUS_DESKS.length === 2 &&
  C.AWARDSPLUS_DESKS.every((d) => d.id && d.group === "Awards" && d.icon && d.name && d.desc && typeof d.render === "function") &&
  C.AWARDSPLUS_DESKS[0].id !== C.AWARDSPLUS_DESKS[1].id);
check("desk ids are awp-history / awp-campaign",
  C.AWARDSPLUS_DESKS.map((d) => d.id).join(",") === "awp-history,awp-campaign");
check("six craft categories defined",
  Array.isArray(C.AWP_CATS) && C.AWP_CATS.length === 6 &&
  C.AWP_CATS.map((c) => c.name).join("|") ===
    "Best Cinematography|Best Production Design|Best Sound|Best Editing|Best Original Score|Best Ensemble");
check("AWARDSPLUS_ACHIEVEMENTS has >= 4 entries",
  Array.isArray(C.AWARDSPLUS_ACHIEVEMENTS) && C.AWARDSPLUS_ACHIEVEMENTS.length >= 4,
  String(C.AWARDSPLUS_ACHIEVEMENTS.length));

/* ── achievements: unique ids, defensive tests, tier 1..3 ─────── */
const achIds = C.AWARDSPLUS_ACHIEVEMENTS.map((a) => a.id);
check("achievement ids are unique", new Set(achIds).size === achIds.length, achIds.join(","));
check("achievement ids carry the module prefix",
  achIds.every((id) => id.indexOf("awp-") === 0), achIds.join(","));
let achOk = true, achBad = "";
C.newGame("Awards Test", "veteran");
for (const a of C.AWARDSPLUS_ACHIEVEMENTS) {
  if (!a.id || !a.name || !a.desc || [1, 2, 3].indexOf(a.tier) < 0 || typeof a.test !== "function") { achOk = false; achBad = a.id; break; }
  try {
    const r = a.test(S());
    if (r !== true && r !== false) { achOk = false; achBad = a.id + " returned " + r; break; }
  } catch (e) { achOk = false; achBad = a.id + " threw"; break; }
}
check("achievement tests run against a fresh save without throwing", achOk, achBad);

/* ── week 1: lazy ensure + double-tick guard ──────────────────── */
check("S.awp is absent on a fresh save (lazy ensure is real)", !S().awp);
C.tickAwardsPlus();
check("tickAwardsPlus created S.awp with finite counters",
  !!S().awp && isFinite(S().awp.lastTick) && isFinite(S().awp.wins) && isFinite(S().awp.rivalWins) &&
  isFinite(S().awp.cashWon) && isFinite(S().awp.repWon) && isFinite(S().awp.campaignsBought) &&
  isFinite(S().awp.campaignSpend) && Array.isArray(S().awp.history) && Array.isArray(S().awp.campaigns));
check("tickAwardsPlus set lastTick to the current week", S().awp.lastTick === S().studio.week);
S().awp.lastTick = S().studio.week;
S().awp.campaigns.push({ id: "awpT1", filmId: "fx", title: "Decay Probe", cat: "sound", boost: 8, weeks: 0, start: 0, spent: 2 });
const boostBefore = S().awp.campaigns[0].boost;
C.tickAwardsPlus();
check("double-tick guard: a second tick in the same week decays nothing",
  S().awp.campaigns[0] && S().awp.campaigns[0].boost === boostBefore,
  "boost " + S().awp.campaigns[0].boost);
S().awp.campaigns = [];

/* ── ceremony: empty, one film, many films ───────────────────── */
S().rFilms = [];
let emptyRes = null, emptyThrew = null;
try { emptyRes = C.awardsPlusCategories([]); } catch (e) { emptyThrew = e.message; }
check("awardsPlusCategories([]) runs without throwing and returns []",
  emptyThrew === null && Array.isArray(emptyRes) && emptyRes.length === 0, emptyThrew || "");
let undefRes = null, undefThrew = null;
try { undefRes = C.awardsPlusCategories(); } catch (e) { undefThrew = e.message; }
check("awardsPlusCategories(undefined) runs without throwing",
  undefThrew === null && Array.isArray(undefRes), undefThrew || "");

function mkFilm(id, title, genre, over) {
  const f = {
    id: id, title: title, genre: genre, scale: "mid", budget: 40, mkt: 10, cost: 60,
    quality: 78, criticAvg: 76, freshPct: 80, aud: 74, legs: 2.6,
    opening: 30, weeksOut: 2, dom: 60, ww: 120, status: "done",
    releaseWeek: S().studio.week, supIds: []
  };
  if (over) Object.keys(over).forEach((k) => { f[k] = over[k]; });
  S().films.unshift(f);
  return f;
}

const solo = mkFilm("fSolo", "Solo Craft", "scifi", { supIds: [] });
const soloRes = C.awardsPlusCategories([solo]);
check("one film: six categories awarded", soloRes.length === 6, String(soloRes.length));
check("one film with no rivals: the studio wins all six",
  soloRes.every((w) => w.mine === true));
check("history recorded six rows under S.awp (not S.aw)", S().awp.history.length === 6,
  String(S().awp.history.length));
check("history rows carry year, category, film, studio and mine flags",
  S().awp.history.every((h) => h.y === S().studio.year && h.cat && h.film && h.studio && typeof h.mine === "boolean"));

/* ── many films: weighted, explainable craft scoring ────────────
   The module is deliberately not deterministic: a jitter term and rival nominees
   mean the highest-scoring film can lose. So assert the MECHANISM (the category's
   scoring model ranks the expected film top) rather than a sampled outcome, and
   keep one sampled run only to prove the ceremony actually completes. */
S().awp.history = [];
S().films = [];
S().rFilms = [];
const scifi = mkFilm("fSci", "Orbital Drift", "scifi", { quality: 88, criticAvg: 86, aud: 80, budget: 150, legs: 3.2 });
const comedy = mkFilm("fCom", "Wedding Crashing", "comedy", { quality: 74, criticAvg: 70, aud: 84, budget: 25, legs: 2.2 });
const drama = mkFilm("fDra", "Quiet Season", "drama", { quality: 90, criticAvg: 88, aud: 66, budget: 18, legs: 3.0 });
const threeFilms = [scifi, comedy, drama];

/* rank every film by the module's own scoring model, jitter off */
function rankedFor(catId) {
  const cat = C.AWP_CATS.find((c) => c.id === catId);
  return threeFilms
    .map((f) => ({ film: f.title, score: C.awpScoreParts(cat, C.awpPlayerStats(f)) }))
    .sort((a, b) => b.score - a.score);
}
const cineRank = rankedFor("cinematography");
check("the scoring model puts the high-craft sci-fi film top for Cinematography",
  cineRank[0].film === "Orbital Drift",
  cineRank.map((r) => r.film + " " + r.score.toFixed(1)).join(" > "));
const ensRank = rankedFor("ensemble");
check("the scoring model puts a crowd-pleaser top for Ensemble",
  ensRank[0].film === "Wedding Crashing" || ensRank[0].film === "Quiet Season",
  ensRank.map((r) => r.film + " " + r.score.toFixed(1)).join(" > "));
check("genre affinity actually differentiates the categories",
  cineRank[0].film !== ensRank[0].film,
  "Cinematography " + cineRank[0].film + " vs Ensemble " + ensRank[0].film);

const manyRes = C.awardsPlusCategories(threeFilms);
check("many films: still six winners", manyRes.length === 6);
const byCat = {};
manyRes.forEach((w) => { byCat[w.catId] = w; });
check("all six categories resolved to a titled film",
  manyRes.every((w) => !!w.film && !!w.catId));
check("sampled ceremony awards the top-ranked film at least sometimes, never a stranger",
  manyRes.every((w) => threeFilms.some((f) => f.title === w.film)));
check("winners are weighted, not fixed: score differences exist between categories",
  new Set(manyRes.map((w) => w.score)).size > 1);

/* ── the cash bonus really moves the ledger ──────────────────── */
S().awp.history = [];
C.advanceWeek();
check("weekTx exists after advanceWeek (ledger available)", !!S().weekTx);
const cashBefore = S().studio.cash;
const bonusRes = C.awardsPlusCategories([scifi]);
const awardRows = (S().weekTx.rows || []).filter((r) => r.k.indexOf("Craft award") === 0);
const bonusSum = awardRows.reduce((a, r) => a + r.v, 0);
const expectedBonus = bonusRes.reduce((a, w) => a + (w.mine ? C.AWP_CATS.find((c) => c.id === w.catId).cash : 0), 0);
check("each craft win books a 'Craft award' ledger row", awardRows.length === 6, String(awardRows.length));
check("cash actually credited equals the sum of the six bonuses",
  nearly(bonusSum, expectedBonus, 0.001) && nearly(S().studio.cash - cashBefore, expectedBonus, 1.5),
  "+" + bonusSum.toFixed(1) + " vs +" + expectedBonus.toFixed(1));
check("reputation rose with the wins", S().studio.rep > 0);

/* ── rivals can win: forced with a crafted S.rFilms entry ─────── */
S().awp.history = [];
S().films = [];
const weak = mkFilm("fWeak", "Small Mercies", "drama", { quality: 46, criticAvg: 44, aud: 42, freshPct: 30, budget: 6, legs: 1.8 });
S().rFilms = [
  { id: "rfForce", title: "Titan Rises", rival: "Vortex Pictures", genre: "action",
    opening: 320, legs: 3.8, weeksOut: 2, status: "run" },
  { id: "rfForce2", title: "Neon Hymn", rival: "Solstice Films", genre: "scifi",
    opening: 210, legs: 3.4, weeksOut: 3, status: "run" }
];
const rivalRes = C.awardsPlusCategories([weak]);
const rivalWinners = rivalRes.filter((w) => !w.mine);
check("rival films can win categories (forced via S.rFilms)", rivalWinners.length >= 1,
  rivalWinners.map((w) => w.cat).join(", ") || "none");
check("a rival studio name is written into S.awp.history",
  S().awp.history.some((h) => h.mine === false && (h.studio === "Vortex Pictures" || h.studio === "Solstice Films")),
  S().awp.history.filter((h) => !h.mine).map((h) => h.studio + " · " + h.film).join(" / "));
check("the player can lose — the weak film did not sweep the night",
  rivalRes.some((w) => w.mine === false));
check("awardsPlusNominees() lists rival nominees with {cat,title,studio}",
  (() => {
    const n = C.awardsPlusNominees();
    return Array.isArray(n) && n.length === 6 && n.every((x) => x.cat && x.title && x.studio);
  })(), String(C.awardsPlusNominees().length));

/* ── campaigns: cost, odds, decay, rejection ─────────────────── */
S().rFilms = [];
S().films = [];
S().awp.campaigns = [];
S().awp.history = [];
const paper = mkFilm("fCamp", "The Long Take", "drama", { quality: 80, criticAvg: 82, aud: 68, budget: 30 });
const other = mkFilm("fOther", "Rival Within", "drama", { quality: 83, criticAvg: 84, aud: 70, budget: 35 });
const odBefore = C.awpOdds(paper.id, "cinematography");
S().studio.cash = 500;
const cBefore = S().studio.cash;
const buy = C.awpBuyCampaign(paper.id, "cinematography");
check("campaign purchase costs cash", buy.ok && nearly(cBefore - S().studio.cash, 2.5, 0.001),
  "paid " + (cBefore - S().studio.cash));
const odAfter = C.awpOdds(paper.id, "cinematography");
check("campaign improves the odds function", odAfter > odBefore,
  (odBefore * 100).toFixed(1) + "% → " + (odAfter * 100).toFixed(1) + "%");
check("duplicate campaign for the same film/category rejected",
  !!C.awpBuyCampaign(paper.id, "cinematography").err);
check("unknown category rejected", !!C.awpBuyCampaign(paper.id, "nope").err);
check("unknown film rejected", !!C.awpBuyCampaign("fNope", "sound").err);
S().studio.cash = 0.5;
const before0 = S().studio.cash;
const broke = C.awpBuyCampaign(other.id, "sound");
check("insufficient-cash campaign rejection leaves cash untouched",
  !!broke.err && S().studio.cash === before0, broke.err || "");
S().studio.cash = 500;

/* decay on the weekly tick */
S().awp.lastTick = S().studio.week - 1;
const b0 = C.awpCampaign(paper.id, "cinematography").boost;
C.tickAwardsPlus();
const b1 = C.awpCampaign(paper.id, "cinematography").boost;
check("campaigns decay on the weekly tick", b1 < b0, "boost " + b0 + " → " + b1);

/* ── action bridge ───────────────────────────────────────────── */
const stub = { getAttribute: () => null };
S().awp.campaigns = [];
S().studio.cash = 500;
const cAct = S().studio.cash;
check("awardsplusAction handles awp-campaign",
  C.awardsplusAction("awp-campaign", { getAttribute: (k) => (k === "data-id" ? paper.id : k === "data-key" ? "score" : null) }) === true);
check("action spent the campaign cost and opened a campaign",
  nearly(cAct - S().studio.cash, 2.5, 0.001) && !!C.awpCampaign(paper.id, "score"),
  "paid " + (cAct - S().studio.cash));
S().studio.cash = 0.2;
const cRej = S().studio.cash;
C.awardsplusAction("awp-campaign", { getAttribute: (k) => (k === "data-id" ? other.id : k === "data-key" ? "editing" : null) });
check("action path rejects insufficient cash without moving the ledger",
  S().studio.cash === cRej && !C.awpCampaign(other.id, "editing"));
S().studio.cash = 500;
check("awardsplusAction returns false for foreign actions",
  C.awardsplusAction("aw-hist", stub) === false && C.awardsplusAction("ops-press", stub) === false);

/* ── desks render clean (before the soak) ────────────────────── */
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.AWARDSPLUS_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + e.message; break; }
    if (typeof html !== "string" || !html.length) { bad = d.id + " empty"; break; }
    if (html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " contains NaN/undefined"; break; }
  }
  check("both desks render non-empty with no NaN " + label, bad === "", bad);
}
desksRenderClean("(campaigns live)");
check("history desk also shows the awards.js shelf defensively",
  (() => { const h = C.AWARDSPLUS_DESKS[0].render(); return h.indexOf("Classic awards") >= 0; })());

/* ── awards.js still works (integration, not replacement) ────── */
C.awEnsure();
S().aw.history = [];
S().awp.history = [];
const awFilms = [mkFilm("fAw1", "Lead Performance", "drama", { quality: 86, aud: 91 }),
                 mkFilm("fAw2", "Second Act", "comedy", { quality: 72, aud: 70 })];
let awThrew = null;
try { C.extraAwardCategories(awFilms); } catch (e) { awThrew = e.message; }
check("awards.js extraAwardCategories still awards its three categories",
  awThrew === null && S().aw.history.length === 3,
  awThrew || String(S().aw.history.length) + " rows");
C.awardsPlusCategories(awFilms);
check("awards.js wrote to S.aw, this module to S.awp — the shelves are separate",
  S().aw.history.length === 3 && S().awp.history.length === 6 &&
  S().aw.history.every((h) => ["Best Actor", "Best Director", "Best Original Song"].indexOf(h.cat) >= 0) &&
  S().awp.history.every((h) => !!h.catId),
  S().aw.history.length + " classic · " + S().awp.history.length + " craft");

/* ── long soak: 60+ weeks across the year boundary ───────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, boundaryCeremony = false;
const startHist = S().awp.history.length;
const startYear = S().studio.year;

/* a real release on the shelf so yearAwards() has a film to honour at week 52.
   The earlier checks already ran (and consumed) the year-1 ceremony, so this
   soak targets the NEXT season — a year is paid exactly once by design. */
const soakFilm = mkFilm("fSoak", "Year One Epic", "fantasy", { quality: 84, criticAvg: 82, aud: 78, budget: 120, legs: 3.1 });
S().yearOfFilms.push(soakFilm.id);
/* push the clock to the last week of the current year so the boundary comes fast */
S().studio.week = 47;
S().studio.woy = 47;
S().studio.year = 1;
S().awp.yearsAwarded = {};
S().awp.history = [];

for (let i = 0; i < 62; i++) {
  if (i % 10 === 0) S().studio.cash = 900;
  const before = S().studio.cash;
  try {
    C.advanceWeek();
  } catch (e) {
    threw = "week " + S().studio.week + ": " + (e.stack || e);
    break;
  }
  weeksDriven++;
  if (!isFinite(S().studio.cash)) { threw = "non-finite cash at week " + S().studio.week; break; }
  if (S().studio.cash < minCash) minCash = S().studio.cash;
  if (S().over) { threw = "studio went bankrupt at week " + S().studio.week; break; }
  if (!isFinite(before)) { threw = "non-finite cash before week " + S().studio.week; break; }
  if (S().awp.history.length >= startHist + 6) boundaryCeremony = true;
}
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("60+ advanceWeek cycles driven", weeksDriven >= 60, String(weeksDriven));
check("crossed a year boundary", S().studio.year > startYear,
  "year " + startYear + " → " + S().studio.year);
check("yearAwards fired and awardsPlusCategories logged six rows from the engine",
  boundaryCeremony, String(S().awp.history.length - startHist) + " rows");
check("cash stayed finite every week", isFinite(minCash), "min " + Math.round(minCash) + "M");

/* no season may be awarded twice by the automatic paths (engine ceremony and tick
   catch-up must not both pay out for one year). Scoped to the soak window: the
   harness itself replays year-1 ceremonies above on purpose. */
(() => {
  const seen = {}, dup = [];
  const rows = S().awp.history.slice(startHist);
  rows.forEach((h) => {
    const k = h.y + "|" + h.cat;
    if (seen[k]) dup.push(k);
    seen[k] = 1;
  });
  check("no season/category awarded twice by the automatic paths",
    dup.length === 0, dup.join(", ") || "none");
})();
check("every awarded season is marked in S.awp.yearsAwarded",
  Object.keys(S().awp.yearsAwarded || {}).length >= 1,
  Object.keys(S().awp.yearsAwarded || {}).join(","));

/* catch-up path: a season the engine skipped is awarded by the tick itself */
(() => {
  C.awpEnsure();
  const lastWeek = S().studio.week;
  const lastYear = S().studio.year;
  const Y = lastYear + 1;                        /* pretend we just rolled into year Y */
  delete S().awp.yearsAwarded[Y - 1];
  mkFilm("fSkip", "Skipped Season", "drama", {
    quality: 82, releaseWeek: (Y - 2) * 52 + 10     /* released inside the skipped season */
  });
  S().studio.year = Y;
  S().studio.week = (Y - 1) * 52 + 1;             /* woy 1 of year Y — catch-up window */
  S().awp.lastTick = 0;
  const before = S().awp.history.length;
  C.tickAwardsPlus();
  check("tick catch-up awards a season the engine skipped",
    S().awp.history.length > before && S().awp.yearsAwarded[Y - 1] === true,
    (S().awp.history.length - before) + " rows");
  S().awp.lastTick = 0;
  const again = S().awp.history.length;
  C.tickAwardsPlus();
  check("catch-up does not re-award the same season on the next tick",
    S().awp.history.length === again, String(S().awp.history.length - again) + " extra rows");
  S().studio.week = lastWeek;
  S().studio.year = lastYear;
})();

const yearCats = {};
S().awp.history.forEach((h) => { if (h.y === startYear) yearCats[h.cat] = true; });
check("all six categories appear in history at the year boundary",
  C.AWP_CATS.every((c) => yearCats[c.name]),
  Object.keys(yearCats).length + "/6");

const A = S().awp;
check("S.awp survives the soak with finite key fields",
  !!A && isFinite(A.lastTick) && isFinite(A.wins) && isFinite(A.rivalWins) && isFinite(A.cashWon) &&
  isFinite(A.repWon) && isFinite(A.campaignsBought) && isFinite(A.campaignSpend));
check("every history row is numerically finite", A.history.every((h) =>
  isFinite(h.y) && isFinite(h.w) && isFinite(h.bonus) && isFinite(h.rep)));
check("every campaign row is finite", A.campaigns.every((c) =>
  isFinite(c.boost) && isFinite(c.weeks) && isFinite(c.spent) && c.boost >= 0));
check("tick is idempotent per week after the soak",
  (() => {
    A.lastTick = S().studio.week - 1;
    A.campaigns = [{ id: "awpZ", filmId: "fZ", title: "Z", cat: "sound", boost: 5, weeks: 0, start: 0, spent: 1 }];
    C.tickAwardsPlus();
    const first = A.campaigns[0] && A.campaigns[0].boost;
    C.tickAwardsPlus();
    const second = A.campaigns[0] && A.campaigns[0].boost;
    A.campaigns = [];
    return first != null && first < 5 && second === first;
  })());

desksRenderClean("(after 60+ weeks)");

/* final: achievements still safe against the soaked state */
let finalAch = true, finalBad = "";
for (const a of C.AWARDSPLUS_ACHIEVEMENTS) {
  try { a.test(S()); } catch (e) { finalAch = false; finalBad = a.id; break; }
}
check("achievement tests do not throw against a soaked save", finalAch, finalBad);

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · craft wins " + S().awp.wins +
  " · rival wins " + S().awp.rivalWins);
process.exit(failures || threw ? 1 : 0);
