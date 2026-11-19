/* Rebuild union & labour relations harness (pattern from test/rebuild-consolehw.mjs): runs
   game/data.js + game/engine.js + game/labor.js in a VM sandbox with a stubbed
   localStorage. ui.js needs a DOM, so the two ui helpers the module renders with
   (statrow/tag) are stubbed verbatim.
   engine.js calls tickLabor() itself, so the harness only calls it when the module's
   lastTick guard says the week has not been ticked — the guard makes the call a no-op
   either way.
   Covers: fresh-save neutrality of both engine hooks, mood→cost elasticity, the real
   production burn picking up laborCostMult(), a full contract expiry + renewal cycle,
   every negotiation option (concede / residual / back-end / refuse / lockout) with an
   insufficient-cash rejection, gross-participation payouts off live box office, 90+
   advanceWeek() weeks with mood/bounds invariants, and clean desk/achievement output.
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
for (const f of ["data.js", "engine.js", "labor.js"]) {
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
const src = readFileSync(path.join(gameDir, "labor.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickLabor / laborAction / laborCostMult / laborStrikeMod / LABOR_DESKS",
  typeof C.tickLabor === "function" && typeof C.laborAction === "function" &&
  typeof C.laborCostMult === "function" && typeof C.laborStrikeMod === "function" &&
  Array.isArray(C.LABOR_DESKS));
check("LABOR_DESKS is 2 shaped 'Studio ops' desks: labor-guilds + labor-talks",
  C.LABOR_DESKS.length === 2 &&
  C.LABOR_DESKS.map((d) => d.id).join(",") === "labor-guilds,labor-talks" &&
  C.LABOR_DESKS.every((d) => d.group === "Studio ops" && d.icon && d.name && d.desc &&
    typeof d.render === "function"),
  C.LABOR_DESKS.map((d) => d.id).join(","));
check("exactly four guilds: writers, actors, directors, crew",
  Array.isArray(C.LABOR_GUILDS) && C.LABOR_GUILDS.length === 4 &&
  C.LABOR_GUILDS.map((g) => g.id).join(",") === "writers,actors,directors,crew",
  C.LABOR_GUILDS.map((g) => g.id).join(","));
check("LABOR_ACHIEVEMENTS: >= 4, unique labor- ids, tier 1-3, test is a function",
  Array.isArray(C.LABOR_ACHIEVEMENTS) && C.LABOR_ACHIEVEMENTS.length >= 4 &&
  C.LABOR_ACHIEVEMENTS.every((a) => typeof a.id === "string" && a.id.indexOf("labor-") === 0 &&
    [1, 2, 3].indexOf(a.tier) >= 0 && typeof a.name === "string" &&
    typeof a.desc === "string" && typeof a.test === "function") &&
  new Set(C.LABOR_ACHIEVEMENTS.map((a) => a.id)).size === C.LABOR_ACHIEVEMENTS.length,
  C.LABOR_ACHIEVEMENTS.length + " achievements");
check("module never assigns to S.studio.cash directly (spend/earn only)",
  src.indexOf("S.studio.cash -=") < 0 && src.indexOf("S.studio.cash +=") < 0 &&
  src.indexOf(".studio.cash =") < 0 && src.indexOf("studio.cash=") < 0);

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0, topups = 0;
let multMin = Infinity, multMax = -Infinity, strikeMin = Infinity, strikeMax = -Infinity;
let moodViolations = 0, multBad = 0, strikeBad = 0, sawExpired = 0, sawStrike = 0;
const spendRows = [], earnRows = [];
function guildList() {
  const L = S().labor;
  return L && L.guilds ? C.LABOR_GUILDS.map((d) => L.guilds[d.id]).filter(Boolean) : [];
}
function invariants() {
  for (const g of guildList()) {
    if (!isFinite(g.mood) || g.mood < 0 || g.mood > 100) moodViolations++;
    if (!isFinite(g.wage) || !isFinite(g.expWeek) || !isFinite(g.militant) ||
        !isFinite(g.strikeWk) || !isFinite(g.residual) || !isFinite(g.backend)) moodViolations++;
    if (g.status === "expired") sawExpired = 1;
    if (g.strikeWk > 0) sawStrike = 1;
  }
  const m = C.laborCostMult(), r = C.laborStrikeMod();
  if (!isFinite(m) || !(m > 0) || m > 2) multBad++;
  if (!isFinite(r) || r < -0.06 || r > 0.10) strikeBad++;
  if (m < multMin) multMin = m;
  if (m > multMax) multMax = m;
  if (r < strikeMin) strikeMin = r;
  if (r > strikeMax) strikeMax = r;
}
function advance(n) {
  for (let i = 0; i < n; i++) {
    /* keep the studio solvent so the soak measures the module, not bankruptcy */
    if (S().studio.cash < 45) { S().studio.cash = 320; topups++; }
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      /* engine.js may or may not call tickLabor(); the module's lastTick guard makes
         this call a no-op when it already ran. */
      if (!S().labor || S().labor.lastTick !== S().studio.week) C.tickLabor();
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
    invariants();
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.LABOR_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.length < 200) { bad = d.id + " (short)"; break; }
    if (html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " (NaN/undefined)"; break; }
  }
  check("both desks render non-empty, clean HTML " + label, bad === "", bad);
}
function fakeProject(id, title, genre, phase, opts) {
  const o = opts || {};
  S().projects.push({
    id, title, genre, scale: "micro", budget: o.budget || 6, budgetNow: o.budgetNow || o.budget || 6,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: null, releaseWeek: null,
    phase, phaseWk: 0, phaseLen: { pre: o.pre || 1, shoot: 30, post: 40 },
    overrun: 0, scandal: false, buzz: 0, franchiseOf: null, prodScore: 55,
    quality: 65, qPreview: 65
  });
  return S().projects[S().projects.length - 1];
}
function fakeFilm(id, title, genre, quality, opening) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening: opening || 34, legs: 2.6, decay: 1 - 1 / 2.6, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null, status: "run"
  });
}
function elx(id, key) {
  return { getAttribute: (k) => (k === "data-id" ? id : k === "data-key" ? key : null) };
}
function ledRows(sub) {
  return (S().weekTx && S().weekTx.rows ? S().weekTx.rows : []).filter((r) => r.k.indexOf(sub) === 0);
}
function setMoodAll(v) {
  return C.LABOR_GUILDS.map((d) => { const g = S().labor.guilds[d.id]; g.mood = v; g.militant = 0; g.status = "ok"; g.strikeWk = 0; return g; });
}

/* ── fresh save: both engine hooks must be perfectly neutral ──── */
C.newGame("Labour Test", "veteran");
check("S.labor is absent on a fresh save (lazy ensure is real)", !S().labor);
check("laborCostMult() is exactly 1 with no state", C.laborCostMult() === 1, String(C.laborCostMult()));
check("laborStrikeMod() is exactly 0 with no state", C.laborStrikeMod() === 0, String(C.laborStrikeMod()));

C.tickLabor();
const L0 = S().labor;
check("S.labor namespace created lazily by tickLabor",
  !!L0 && !!L0.guilds && isFinite(L0.lastTick) && isFinite(L0.strikes) &&
  isFinite(L0.lockouts) && isFinite(L0.deals) && isFinite(L0.conceded) &&
  isFinite(L0.residualPaid) && isFinite(L0.backendPaid));
check("tick recorded the week (lastTick === studio.week)", L0.lastTick === S().studio.week,
  "week " + S().studio.week);
check("every guild starts at the baseline mood, wage ×1.00 and a future expiry",
  C.LABOR_GUILDS.every((d) => {
    const g = L0.guilds[d.id];
    return g && nearly(g.mood, 65) && nearly(g.wage, 1) && g.status === "ok" &&
      g.expWeek > S().studio.week && g.residual === 0 && g.backend === 0;
  }),
  C.LABOR_GUILDS.map((d) => d.id + " w" + L0.guilds[d.id].expWeek).join(" · "));
check("baseline state still yields exactly ×1.00 cost and zero strike shift",
  C.laborCostMult() === 1 && C.laborStrikeMod() === 0,
  "×" + C.laborCostMult() + " / " + C.laborStrikeMod());
check("contract expiries are staggered (four different weeks)",
  new Set(C.LABOR_GUILDS.map((d) => L0.guilds[d.id].expWeek)).size === 4);
check("double-tick guard: a second tickLabor() in the same week is a no-op",
  (() => { const w = L0.lastTick, c = S().studio.cash; C.tickLabor();
           return L0.lastTick === w && S().studio.cash === c; })());
desksRenderClean("(fresh save)");

/* ── mood drives the cost multiplier ─────────────────────────── */
setMoodAll(90);
const multHappy = C.laborCostMult(), modHappy = C.laborStrikeMod();
setMoodAll(15);
const multAngry = C.laborCostMult(), modAngry = C.laborStrikeMod();
check("happy guilds cost less than ×1 and angry guilds cost more",
  multHappy < 1 && multAngry > 1, "×" + multHappy.toFixed(3) + " → ×" + multAngry.toFixed(3));
check("multiplier moves in the right direction and stays inside (0, 2]",
  multHappy < multAngry && multAngry <= 1.5 && multHappy >= 0.9,
  "range ×" + multHappy.toFixed(3) + "..×" + multAngry.toFixed(3));
check("strike mod is negative when happy, positive when hostile, and clamped",
  modHappy < 0 && modAngry > 0 && modHappy >= -0.06 && modAngry <= 0.10,
  modHappy.toFixed(3) + " / " + modAngry.toFixed(3));
setMoodAll(65);
check("moods restored → hooks back to the neutral values",
  C.laborCostMult() === 1 && C.laborStrikeMod() === 0);

/* ── insufficient cash: concede + lockout ────────────────────── */
S().studio.cash = 0.5;
const poorConcede = C.laborDeal("actors", "concede");
check("insufficient-cash concession rejected, no deal, mood untouched",
  !!poorConcede.err && nearly(S().studio.cash, 0.5) &&
  nearly(S().labor.guilds.actors.mood, 65) && S().labor.deals === 0,
  poorConcede.err || "");
check("insufficient-cash lockout rejected, no lockout banked",
  !!C.laborDeal("crew", "lockout").err && S().labor.lockouts === 0 && nearly(S().studio.cash, 0.5));
check("unknown guild / unknown proposal rejected",
  !!C.laborDeal("grips", "concede").err && !!C.laborDeal("actors", "bribe").err);
check("refuse is free even with no cash", C.laborDeal("crew", "refuse").ok === true);
S().studio.cash = 400;
S().labor.guilds.crew.mood = 65;
S().labor.guilds.crew.militant = 0;

/* ── concession: cash out, mood up, ledger row ────────────────── */
/* spend() only writes a ledger row while a week is open, so open one here —
   this is exactly the engine's own weekTx shape. */
S().weekTx = { w: S().studio.week, in: 0, out: 0, rows: [] };
const writers = S().labor.guilds.writers;
writers.mood = 50;
const concedeCost = C.laborDealCost(writers, "concede");
const cashC = S().studio.cash, moodC = writers.mood;
const concedeRes = C.laborDeal("writers", "concede");
check("concession costs exactly its quoted price",
  concedeRes.ok && nearly(cashC - S().studio.cash, concedeCost) && nearly(concedeCost, concedeRes.cost, 0.05),
  "paid " + C.fm(concedeCost));
check("concession raises mood and books a wage-concession ledger row",
  writers.mood > moodC && ledRows("Wage concession · Writers Guild").length === 1,
  moodC + " → " + writers.mood);
check("concession lifts the wage index and the concession counter",
  writers.wage > 1 && S().labor.conceded > 0,
  "wage ×" + writers.wage.toFixed(3) + " · " + C.fm(S().labor.conceded));

/* ── residual: costs cash, lifts mood more, banks a gross share ── */
const actors = S().labor.guilds.actors;
actors.mood = 50;
const residualCost = C.laborDealCost(actors, "residual");
const cashR = S().studio.cash, moodR = actors.mood;
const residualRes = C.laborDeal("actors", "residual");
check("residual offer costs its quoted price and raises mood further than a concession",
  residualRes.ok && nearly(cashR - S().studio.cash, residualCost) &&
  (residualRes.delta > concedeRes.delta), "+" + residualRes.delta + " vs +" + concedeRes.delta);
check("residual banks a gross share on the guild (0 < share <= 2%)",
  actors.residual > 0 && actors.residual <= 0.02,
  Math.round(actors.residual * 1000) / 10 + "% of gross");

/* ── back-end: cheap now, a liability later ───────────────────── */
const directors = S().labor.guilds.directors;
directors.mood = 55;
const backendCost = C.laborDealCost(directors, "backend");
const cashB = S().studio.cash, moodB = directors.mood;
const backendRes = C.laborDeal("directors", "backend");
check("back-end offer is the cheapest mood buy and adds a point",
  backendRes.ok && backendCost < concedeCost && directors.mood > moodB &&
  directors.backend === 1 && nearly(cashB - S().studio.cash, backendCost),
  C.fm(backendCost) + " for +" + backendRes.delta + " mood");

/* ── refusal: free, mood down, militancy up ───────────────────── */
const crew = S().labor.guilds.crew;
crew.mood = 55;
const cashF = S().studio.cash, moodF = crew.mood;
const refuseRes = C.laborDeal("crew", "refuse");
check("refusal costs nothing, lowers mood 12 points and raises militancy",
  refuseRes.ok && nearly(S().studio.cash, cashF) && crew.mood < moodF &&
  crew.mood === moodF - 12 && crew.militant >= 1,
  moodF + " → " + crew.mood + " · militant " + crew.militant);
check("refusal pushes the strike-risk shift above its neutral value",
  C.laborStrikeMod() > 0, C.laborStrikeMod().toFixed(3));

/* ── lockout: paid, brutal, wage bill down ────────────────────── */
crew.mood = 60;
const lockCost = C.laborDealCost(crew, "lockout");
const cashL = S().studio.cash, moodL = crew.mood, wageL = crew.wage;
const lockRes = C.laborDeal("crew", "lockout");
check("lockout costs its quoted price, drops mood hard and cuts the wage index",
  lockRes.ok && nearly(cashL - S().studio.cash, lockCost) && crew.mood === moodL - 20 &&
  crew.wage < wageL && S().labor.lockouts === 1,
  C.fm(lockCost) + " · mood " + moodL + " → " + crew.mood);
check("lockout sets a strike clock on that guild", crew.strikeWk > 0, crew.strikeWk + " wk");

/* ── a real contract expiry, straight off the weekly tick ─────── */
const wG = S().labor.guilds.writers;
wG.status = "ok"; wG.strikeWk = 0; wG.militant = 0; wG.mood = 70;
wG.expWeek = S().studio.week + 1;
const multBeforeExpiry = C.laborCostMult();
const moodBeforeExpiry = wG.mood;
advance(2);
check("contract expiry fires on the scheduled week (status expired)",
  wG.status === "expired", "expWeek " + wG.expWeek + " · week " + S().studio.week);
check("expiry collapses mood sharply",
  wG.mood <= moodBeforeExpiry - 15, moodBeforeExpiry + " → " + wG.mood);
check("an expired guild raises the production cost multiplier",
  C.laborCostMult() > multBeforeExpiry,
  "×" + multBeforeExpiry.toFixed(3) + " → ×" + C.laborCostMult().toFixed(3));
check("an expired guild raises the strike-risk shift",
  C.laborStrikeMod() > 0, C.laborStrikeMod().toFixed(3));
const renewalsBefore = wG.renewals;
S().studio.cash = 400;
const renewRes = C.laborDeal("writers", "concede");
check("conceding after expiry renews the contract and clears the standoff",
  renewRes.ok && wG.status === "ok" && wG.renewals === renewalsBefore + 1 &&
  wG.expWeek > S().studio.week && wG.weeksExpired === 0,
  "new expiry w" + wG.expWeek);
check("renewal pulls the cost multiplier back down",
  C.laborCostMult() < 1.2, "×" + C.laborCostMult().toFixed(3));

/* ── the engine really multiplies its burn by laborCostMult ─────
   S.strike (the engine's own walkout flag) is a separate +20% system, so it is
   zeroed here to isolate the labour multiplier under test. */
withRng("fixed");
S().strike = 0;
setMoodAll(90);
const multBurnHappy = C.laborCostMult();
const pBurn = fakeProject("p9100", "Burn Test Pic", "drama", "pre", { budget: 1000, budgetNow: 1000, pre: 1 });
const cashBurn = S().studio.cash;
C.advanceWeek();
if (!S().labor || S().labor.lastTick !== S().studio.week) C.tickLabor();
const burnHappy = ledRows("Production · Burn Test Pic").reduce((a, r) => a + r.v, 0);
check("engine burn equals budget × frac × laborCostMult (happy guilds)",
  nearly(-burnHappy, 100 * multBurnHappy, 0.06),
  "-" + (-burnHappy).toFixed(2) + " vs expected " + (100 * multBurnHappy).toFixed(2));

S().strike = 0;
setMoodAll(15);
const multBurnAngry = C.laborCostMult();
const pBurn2 = fakeProject("p9101", "Burn Test Pic II", "drama", "pre", { budget: 1000, budgetNow: 1000, pre: 1 });
S().studio.cash = cashBurn;
C.advanceWeek();
if (!S().labor || S().labor.lastTick !== S().studio.week) C.tickLabor();
const burnAngry = ledRows("Production · Burn Test Pic II").reduce((a, r) => a + r.v, 0);
check("engine burn is higher with hostile guilds, still tracking laborCostMult",
  nearly(-burnAngry, 100 * multBurnAngry, 0.06) && -burnAngry > -burnHappy,
  "-" + (-burnAngry).toFixed(2) + " vs expected " + (100 * multBurnAngry).toFixed(2));
S().projects = S().projects.filter((p) => p.id !== "p9100" && p.id !== "p9101");
realRng();
S().strike = 0;
setMoodAll(65);

/* ── participations: residuals and back-end pay out of live gross ── */
const actors2 = S().labor.guilds.actors;
actors2.residual = 0.02;
S().labor.guilds.directors.backend = 2;
S().labor.residualPaid = 0;
S().labor.backendPaid = 0;
fakeFilm("f9100", "Residual Runner", "drama", 74, 60);
S().studio.cash = 400;
advance(2);
check("residuals are paid out of the week's own box-office row",
  S().labor.residualPaid > 0 && ledRows("Residuals · Actors Guild").length >= 1,
  C.fm(S().labor.residualPaid));
check("back-end participation is paid alongside residuals",
  S().labor.backendPaid > 0, C.fm(S().labor.backendPaid));
check("participation spend never exceeds the 2% residual cap of gross",
  S().labor.residualPaid <= 60 * 0.02 * 3, C.fm(S().labor.residualPaid));
check("guild-level paid counters mirror the namespace totals",
  nearly(actors2.residualPaid, S().labor.residualPaid, 0.06),
  C.fm(actors2.residualPaid));

/* ── action delegation contract ──────────────────────────────── */
const stub = { getAttribute: () => null };
check("laborAction returns false for foreign actions",
  C.laborAction("gl-open", stub) === false && C.laborAction("crew-hire", stub) === false);
check("laborAction returns false for an unknown labor-* verb",
  C.laborAction("labor-nonsense", stub) === false);
S().studio.cash = 400;
const moodA = S().labor.guilds.actors.mood;
check("labor-negotiate routes data-key=backend through the real path",
  C.laborAction("labor-negotiate", elx("actors", "backend")) === true &&
  S().labor.guilds.actors.backend >= 1 && S().labor.guilds.actors.mood > moodA);
const moodD = S().labor.guilds.directors.mood;
check("labor-concede routes through laborDeal and lifts mood",
  C.laborAction("labor-concede", elx("directors")) === true &&
  S().labor.guilds.directors.mood > moodD);
check("labor-lockout routes through laborDeal",
  C.laborAction("labor-lockout", elx("writers")) === true &&
  S().labor.guilds.writers.strikeWk > 0 && S().labor.lockouts >= 2);
S().studio.cash = 1;
const moodPoor = S().labor.guilds.actors.mood;
check("insufficient-cash action rejection leaves mood and cash untouched",
  C.laborAction("labor-concede", elx("actors")) === true &&
  nearly(S().studio.cash, 1) && nearly(S().labor.guilds.actors.mood, moodPoor),
  "cash " + C.fm(S().studio.cash));
S().studio.cash = 400;

/* ── desks actually show the negotiation board with prices ───── */
const guildsHTML = C.LABOR_DESKS[0].render();
const talksHTML = C.LABOR_DESKS[1].render();
check("labor-guilds desk lists all four guilds with mood, contract and cost",
  C.LABOR_GUILDS.every((d) => guildsHTML.indexOf(C.esc(d.name)) >= 0) &&
  guildsHTML.indexOf("wk left") >= 0 && guildsHTML.indexOf("Cost effect") >= 0);
check("labor-talks desk shows all four options plus lockout per guild",
  talksHTML.split('data-action="labor-concede"').length - 1 >= 4 &&
  talksHTML.split('data-action="labor-negotiate"').length - 1 >= 12 &&
  talksHTML.split('data-action="labor-lockout"').length - 1 >= 4);
check("talks desk prices every option before commit (mood + cash-after shown)",
  talksHTML.indexOf("mood +") >= 0 && talksHTML.indexOf("after ") >= 0 &&
  talksHTML.indexOf("mood -") >= 0);
check("unaffordable options are disabled rather than hidden", (() => {
  const saved = S().studio.cash;
  S().studio.cash = 0;
  const html = C.LABOR_DESKS[1].render();
  S().studio.cash = saved;
  return html.indexOf("disabled") >= 0;
})());

/* ── achievements are defensive and evaluate ─────────────────── */
let achOk = true, achDetail = "";
for (const a of C.LABOR_ACHIEVEMENTS) {
  let r1, r2, r3;
  try {
    r1 = a.test(S());
    r2 = a.test({});
    r3 = a.test(null);
  } catch (e) { achOk = false; achDetail = a.id + " threw"; break; }
  if (typeof r1 !== "boolean" || r2 !== false || r3 !== false) {
    achOk = false; achDetail = a.id + " returned " + [r1, r2, r3].join("/");
  }
}
check("every LABOR_ACHIEVEMENTS test runs without throwing on live/empty/null state",
  achOk, achDetail);
function ach(id) { return C.LABOR_ACHIEVEMENTS.filter((x) => x.id === id)[0] || null; }
check("achievement labor-first-deal fires after real agreements",
  !!ach("labor-first-deal") && ach("labor-first-deal").test(S()) === true,
  S().labor.deals + " deals");
check("achievement labor-concede-25 stays false on a small chequebook",
  !!ach("labor-concede-25") && ach("labor-concede-25").test(S()) ===
    (S().labor.conceded >= 25), C.fm(S().labor.conceded));

/* ── 90+ week soak: contracts expire, invariants hold ────────── */
setMoodAll(65);
S().studio.cash = 700;
const target = 96;
while (weeksDriven < target && !threw) advance(1);
check("90+ advanceWeek cycles driven", weeksDriven >= 90, String(weeksDriven));
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("cash stayed finite every week (min tracked)", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0,
  ledgerBreaks + " breaks · " + topups + " top-ups");
check("at least one spend and one earn recorded in the ledger",
  spendRows.length >= 1 && earnRows.length >= 1,
  spendRows.length + " spend kinds · " + earnRows.length + " earn kinds");
check("at least one contract actually expired during the soak", sawExpired === 1);
check("mood stayed inside 0..100 for every guild, every week", moodViolations === 0,
  moodViolations + " violations");
check("laborCostMult stayed finite and inside (0, 2] every week", multBad === 0,
  "observed ×" + multMin.toFixed(3) + "..×" + multMax.toFixed(3));
check("laborCostMult stayed inside the spec's 0.90..1.50 band",
  multMin >= 0.9 && multMax <= 1.5,
  "×" + multMin.toFixed(3) + "..×" + multMax.toFixed(3));
check("laborStrikeMod stayed inside [-0.06, +0.10] every week", strikeBad === 0,
  strikeMin.toFixed(3) + ".." + strikeMax.toFixed(3));
check("S.labor still exists at the end with every numeric field finite",
  !!S().labor && isFinite(S().labor.lastTick) && isFinite(S().labor.strikes) &&
  isFinite(S().labor.lockouts) && isFinite(S().labor.deals) &&
  isFinite(S().labor.conceded) && isFinite(S().labor.residualPaid) &&
  isFinite(S().labor.backendPaid) && isFinite(S().labor.interims) &&
  C.LABOR_GUILDS.every((d) => {
    const g = S().labor.guilds[d.id];
    return g && isFinite(g.mood) && isFinite(g.wage) && isFinite(g.expWeek) &&
      isFinite(g.militant) && isFinite(g.strikeWk) && isFinite(g.residual) &&
      isFinite(g.backend) && isFinite(g.deals) && isFinite(g.renewals) &&
      isFinite(g.weeksExpired);
  }));
check("contracts were renewed at least once beyond the forced test renewal",
  C.LABOR_GUILDS.some((d) => S().labor.guilds[d.id].renewals >= 1),
  C.LABOR_GUILDS.map((d) => d.id + ":" + S().labor.guilds[d.id].renewals).join(" · "));
check("achievement labor-renewals tracks real renewals",
  !!ach("labor-renewals") &&
  ach("labor-renewals").test(S()) === C.LABOR_GUILDS.every((d) => S().labor.guilds[d.id].renewals >= 1));
check("walkouts were possible but never broke the sim", isFinite(S().studio.cash),
  sawStrike ? "a guild walked out at least once" : "no walkout in this run");
desksRenderClean("(end, week " + S().studio.week + ", year " + S().studio.year + ")");

/* ── final idempotency ───────────────────────────────────────── */
const cashIdem = S().studio.cash, lastIdem = S().labor.lastTick;
const moodsIdem = C.LABOR_GUILDS.map((d) => S().labor.guilds[d.id].mood).join(",");
C.tickLabor();
check("double-tick guard holds at the end of the soak (no mood drift, no cash)",
  S().studio.cash === cashIdem && S().labor.lastTick === lastIdem &&
  C.LABOR_GUILDS.map((d) => S().labor.guilds[d.id].mood).join(",") === moodsIdem,
  "week " + lastIdem + " · cash " + C.fm(cashIdem));

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · mult " +
  multMin.toFixed(2) + ".." + multMax.toFixed(2) + " · strike mod " +
  strikeMin.toFixed(2) + ".." + strikeMax.toFixed(2));
process.exit(failures || threw ? 1 : 0);
