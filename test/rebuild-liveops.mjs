/* Rebuild Live-Ops harness (pattern from test/rebuild-opsuite.mjs): runs game/data.js +
   game/engine.js + game/liveops.js in a VM sandbox with a stubbed localStorage. ui.js
   needs a DOM, so the two ui helpers the module renders with (statrow/tag) are stubbed
   verbatim. Drives advanceWeek() then tickLiveOps() (the integrator's wiring) for 60+
   weeks and exercises every system through the module's own functions: 60 blind-box
   scout pulls (odds, pity rails, cash), all four amenities (each hook must leave
   neutral), a co-production pact on an in-production project (advance lands, gross
   share returns, share repaid on release), a seasonal-challenge release that pays the
   bonus, and insufficient-cash rejections. Prints one line per check; exits non-zero
   on failure. */
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
for (const f of ["data.js", "engine.js", "liveops.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "liveops.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.assign", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickLiveOps/liveopsAction/liveopsEventMult/liveopsAmenityMods/liveopsOnRelease/liveopsCoprodShare",
  typeof C.tickLiveOps === "function" && typeof C.liveopsAction === "function" &&
  typeof C.liveopsEventMult === "function" && typeof C.liveopsAmenityMods === "function" &&
  typeof C.liveopsOnRelease === "function" && typeof C.liveopsCoprodShare === "function");
check("LIVEOPS_DESKS is an array of 3-4 shaped 'Live ops' desks",
  Array.isArray(C.LIVEOPS_DESKS) && C.LIVEOPS_DESKS.length >= 3 && C.LIVEOPS_DESKS.length <= 4 &&
  C.LIVEOPS_DESKS.every((d) => d.id && d.group === "Live ops" && d.icon && d.name && d.desc && typeof d.render === "function"));
check("odds table weights sum to exactly the denominator",
  C.LIVEOPS_RARITIES.reduce((a, r) => a + r.weight, 0) === C.LIVEOPS_WEIGHT_TOTAL,
  C.LIVEOPS_RARITIES.map((r) => r.id + " " + r.weight).join(" + ") + " = " + C.LIVEOPS_WEIGHT_TOTAL);
check("odds as fractions sum to 1.0",
  nearly(C.LIVEOPS_RARITIES.reduce((a, r) => a + r.weight / C.LIVEOPS_WEIGHT_TOTAL, 0), 1.0),
  C.LIVEOPS_RARITIES.map((r) => r.pct + "%").join(" / ") + " = 100%");
check("printed odds sum to exactly 100%",
  C.LIVEOPS_RARITIES.reduce((a, r) => a + r.pct, 0) === 100 &&
  C.LIVEOPS_RARITIES.every((r) => nearly(r.pct, r.weight / C.LIVEOPS_WEIGHT_TOTAL * 100, 1e-9)),
  C.LIVEOPS_RARITIES.map((r) => r.pct).join(" + ") + " = 100");

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
let earnRows = 0, spendRows = 0, releaseCalls = 0, badCashWeeks = 0;
const seenFilmIds = {};
function advance(n) {
  for (let i = 0; i < n; i++) {
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      C.tickLiveOps(); /* integrator wiring: engine calls tickLiveOps() after its own systems */
      /* integrator wiring: every fresh release goes through liveopsOnRelease(film) */
      for (const f of S().films) {
        if (seenFilmIds[f.id]) continue;
        seenFilmIds[f.id] = true;
        C.liveopsOnRelease(f);
        releaseCalls++;
      }
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { badCashWeeks++; threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
    const rows = (S().weekTx && S().weekTx.rows) || [];
    for (const r of rows) { if (r.v > 0) earnRows++; else if (r.v < 0) spendRows++; }
    if (!isFinite(st.cash) || !isFinite(before)) badCashWeeks++;
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.LIVEOPS_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("all desks render clean " + label, bad === "", bad);
}
function fakeProject(id, title, phase, budget) {
  const p = {
    id, title, genre: "drama", scale: "indie", budget, budgetNow: budget,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: null, releaseWeek: null,
    phase, phaseWk: 0, phaseLen: { pre: 2, shoot: 3, post: 4 },
    overrun: 0, scandal: false, buzz: 6, franchiseOf: null, prodScore: 55,
    quality: 70, qPreview: 70
  };
  S().projects.push(p);
  return p;
}
function fakeFilm(id, title, genre, ww, status) {
  const f = {
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality: 70, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening: 20, legs: 3.0, decay: 1 - 1 / 3, weeksOut: 4, dom: Math.round(ww * 0.6 * 10) / 10,
    weekly: [], releaseWeek: S().studio.week, season: "Winter", franchiseOf: null,
    status, ww
  };
  S().films.unshift(f);
  seenFilmIds[id] = true;
  return f;
}

/* ── week 1: lazy ensure + hook defaults + rejection ──────────── */
C.newGame("LiveOps Test", "veteran");
check("S.liveops is absent before the first hook call", !S().liveops);
C.tickLiveOps();
check("S.liveops namespace created lazily by tickLiveOps",
  !!S().liveops && Array.isArray(S().liveops.amenities) && Array.isArray(S().liveops.pacts) &&
  isFinite(S().liveops.pulls) && isFinite(S().liveops.pity) && isFinite(S().liveops.eventGross));
check("liveopsAmenityMods() neutral with nothing installed",
  C.liveopsAmenityMods().rep === 1 && C.liveopsAmenityMods().critic === 0 &&
  C.liveopsAmenityMods().crew === 1 && C.liveopsAmenityMods().overhead === 1);
check("liveopsEventMult is 1 for a genre the live event does not boost",
  C.liveopsEventMult("drama") === 1 && C.liveopsEventMult("docs") === 1);
check("liveopsCoprodShare 0 on a film without a pact", C.liveopsCoprodShare({ id: "pNope", title: "Nope" }) === 0);
check("liveopsCoprodShare 0 on a null film", C.liveopsCoprodShare(null) === 0);

const cash0 = S().studio.cash;
S().studio.cash = 1.0;
const poorPull = C.liveopsPull();
check("insufficient-cash pull rejection ($3.0M pack, we hold $1.0M)",
  !!poorPull.err && S().liveops.pulls === 0 && nearly(S().studio.cash, 1.0), poorPull.err || "");
const poorAmen = C.liveopsInstall("trophy");
check("insufficient-cash amenity rejection (trophy gallery needs $4.0M)", !!poorAmen.err && S().liveops.amenities.length === 0);
S().studio.cash = cash0;
check("unknown amenity id rejected", !!C.liveopsInstall("clown").err);
desksRenderClean("(w1, nothing bought)");

/* ── blind-box scouting: 60 pulls ─────────────────────────────── */
S().studio.cash = 400;
const marketBefore = S().market.length;
const rarityIds = C.LIVEOPS_RARITIES.map((r) => r.id);
let badRarity = null, pullsOk = 0, cashNonFinite = 0;
let spentOnPulls = 0;
for (let i = 0; i < 60; i++) {
  const cBefore = S().studio.cash;
  const r = C.liveopsPull();
  if (!r.ok) break;
  pullsOk++;
  spentOnPulls += cBefore - S().studio.cash;
  if (!isFinite(S().studio.cash)) cashNonFinite++;
  if (rarityIds.indexOf(r.rarity) < 0 && badRarity == null) badRarity = r.rarity;
  const t = S().market[S().market.length - 1];
  if (t.rarity !== r.rarity) badRarity = "talent tag mismatch " + t.rarity;
}
check("60 scout packs all pulled", pullsOk === 60, pullsOk + " pulls");
check("talent market grew by every pull", S().market.length === marketBefore + pullsOk,
  marketBefore + " → " + S().market.length);
check("every rolled rarity is in the odds table", badRarity === null, badRarity || "all common/rare/epic/legendary");
check("cash stayed finite through all 60 pulls", cashNonFinite === 0);
check("each pull cost exactly $3.0M", nearly(spentOnPulls, 60 * 3.0, 1e-6), spentOnPulls + "M spent");
/* the pity rails are deterministic — drive them directly rather than trusting luck */
const pityEpicCash = S().studio.cash;
S().liveops.pity = C.LIVEOPS_PITY_EPIC;
const pityEpic = C.liveopsPull();
check("epic pity fires at 20 dry pulls (forced epic, counter resets)",
  pityEpic.ok && pityEpic.forced === true && pityEpic.rarity === "epic" &&
  S().liveops.pity === 0 && nearly(pityEpicCash - S().studio.cash, 3),
  "rarity " + pityEpic.rarity + " · forced " + pityEpic.forced);
const pityLegCash = S().studio.cash;
S().liveops.pity = 0;
S().liveops.pityLegend = C.LIVEOPS_PITY_LEGEND;
const pityLeg = C.liveopsPull();
check("legendary pity fires at 40 pulls (forced icon, both counters reset)",
  pityLeg.ok && pityLeg.forced === true && pityLeg.rarity === "legendary" &&
  S().liveops.pity === 0 && S().liveops.pityLegend === 0 &&
  nearly(pityLegCash - S().studio.cash, 3),
  "rarity " + pityLeg.rarity + " · skill " + (pityLeg.talent ? pityLeg.talent.skill : "-"));
check("forced pulls pushed a real legendary into the market",
  S().market.some((t) => t.rarity === "legendary"));
check("pity counter never exceeded the epic rail during the streak",
  S().liveops.pity < C.LIVEOPS_PITY_EPIC, "pity " + S().liveops.pity);
check("rarity counts recorded and finite",
  rarityIds.every((id) => isFinite(S().liveops.rarityCounts[id] || 0)) &&
  rarityIds.reduce((a, id) => a + (S().liveops.rarityCounts[id] || 0), 0) === 62);
check("pity guarantees counted the two forced pulls",
  S().liveops.pityHits >= 2, String(S().liveops.pityHits));
check("last pull result card data recorded", !!S().liveops.lastPull && isFinite(S().liveops.lastPull.power) &&
  isFinite(S().liveops.lastPull.skill) && rarityIds.indexOf(S().liveops.lastPull.rarity) >= 0,
  S().liveops.lastPull ? S().liveops.lastPull.rarityName + " ★" + S().liveops.lastPull.power : "none");
check("a scouted talent is a real market entry with id/name/skill",
  S().market[S().market.length - 1].id != null && !!S().market[S().market.length - 1].n &&
  isFinite(S().market[S().market.length - 1].skill));
desksRenderClean("(after 60 pulls)");

/* ── amenities: every hook must leave neutral ─────────────────── */
const modsBefore = C.liveopsAmenityMods();
check("trophy gallery installs ok ($4.0M) and lifts reputation gain ×1.08",
  C.liveopsInstall("trophy").ok && C.liveopsAmenityMods().rep === 1.08,
  "rep ×" + C.liveopsAmenityMods().rep);
check("screening lounge installs ok ($3.0M) and adds +4 critic",
  C.liveopsInstall("lounge").ok && C.liveopsAmenityMods().critic === 4,
  "critic " + C.liveopsAmenityMods().critic);
check("studio gym installs ok ($2.0M) and lifts crew speed ×1.10",
  C.liveopsInstall("gym").ok && C.liveopsAmenityMods().crew === 1.1,
  "crew ×" + C.liveopsAmenityMods().crew);
check("daycare installs ok ($1.5M) and cuts overhead ×0.92",
  C.liveopsInstall("daycare").ok && C.liveopsAmenityMods().overhead === 0.92,
  "overhead ×" + C.liveopsAmenityMods().overhead);
const modsAfter = C.liveopsAmenityMods();
check("all four amenities installed",
  C.LIVEOPS_AMENITIES.every((a) => S().liveops.amenities.indexOf(a.id) >= 0), String(S().liveops.amenities.length));
check("every amenity moved its hook away from neutral",
  modsAfter.rep !== modsBefore.rep && modsAfter.critic !== modsBefore.critic &&
  modsAfter.crew !== modsBefore.crew && modsAfter.overhead !== modsBefore.overhead);
check("duplicate amenity rejected", !!C.liveopsInstall("gym").err);
desksRenderClean("(all amenities installed)");

/* ── co-production pact on a real in-production project ───────── */
const pactProj = fakeProject("p9001", "Shared Risk Feature", "post", 40);
const pc0 = S().studio.cash;
const pact = C.liveopsSignPact("p9001", "titan");
check("co-production pact signed on a post-production project, 50% advance = $20.0M",
  pact.ok && pact.share === 0.5 && nearly(S().studio.cash - pc0, 20), "advance " + (pact.advance || 0));
check("pact stored with its share under S.liveops.pacts",
  S().liveops.pacts.length === 1 && S().liveops.pacts[0].share === 0.5 &&
  S().liveops.pacts[0].projId === "p9001" && S().liveops.pacts[0].id.indexOf("lv") === 0);
const pactFilm = fakeFilm("f9001", "Shared Risk Feature", "drama", 100, "done");
check("liveopsCoprodShare(film) returns the 0.5 fraction owed", C.liveopsCoprodShare(pactFilm) === 0.5,
  "share " + C.liveopsCoprodShare(pactFilm));
check("second pact on the same project rejected", !!C.liveopsSignPact("p9001", "horizon").err);
check("pact on an unknown project rejected", !!C.liveopsSignPact("pNope", "titan").err);
check("pact with an unknown partner rejected", !!C.liveopsSignPact(pactProj.id, "spaceship").err);
check("40% partner priced off the same budget", C.LIVEOPS_PARTNERS[1].share === 0.4);

/* release the co-produced film through the hook: 50% of $100M goes back out */
const rc0 = S().studio.cash;
C.liveopsOnRelease(pactFilm);
check("release hook repaid 50% of gross to the partner (-$50.0M)",
  nearly(S().studio.cash - rc0, -50), "delta " + (S().studio.cash - rc0).toFixed(1));
check("coprodPaid banked the repayment", nearly(S().liveops.coprodPaid, 50), String(S().liveops.coprodPaid));
check("settled pact no longer owes a share", C.liveopsCoprodShare(pactFilm) === 0);
const rc1 = S().studio.cash;
C.liveopsOnRelease(pactFilm);
check("re-calling the hook never double-charges", nearly(S().studio.cash, rc1));

/* ── seasonal event: progress must actually increment and pay ──── */
const ev = C.liveopsEvent();
check("seasonal event follows (week/4)%3", C.liveopsEventIndex() === Math.floor(S().studio.week / 4) % 3,
  "index " + C.liveopsEventIndex() + " · " + ev.name);
check("liveopsEventMult boosts only the event genre",
  C.liveopsEventMult(ev.genre) === ev.mult && C.liveopsEventMult(ev.genre === "horror" ? "drama" : "horror") === 1,
  ev.genre + " ×" + C.liveopsEventMult(ev.genre));
const prog0 = S().liveops.eventGross;
const evFilmA = fakeFilm("f9002", "Event Opener", ev.genre, 25, "run");
C.liveopsOnRelease(evFilmA);
check("event gross incremented from a real release (+$25.0M)",
  nearly(S().liveops.eventGross - prog0, 25), "progress " + S().liveops.eventGross + "M / " + ev.target + "M");
const onceOnly = S().liveops.eventGross;
C.liveopsOnRelease(evFilmA);
check("the same film is not double-counted", nearly(S().liveops.eventGross, onceOnly),
  "progress " + S().liveops.eventGross + "M");
const rewardCash0 = S().studio.cash;
const evFilmB = fakeFilm("f9003", "Event Closer", ev.genre, ev.target + 20, "done");
C.liveopsOnRelease(evFilmB);
check("crossing the target pays the seasonal reward",
  S().liveops.eventRewarded === true && nearly(S().liveops.seasonCash, ev.reward) &&
  nearly(S().studio.cash - rewardCash0, ev.reward),
  "reward " + ev.reward + "M · progress " + S().liveops.eventGross + "M");
const afterPay = S().studio.cash;
C.liveopsOnRelease(evFilmB);
check("the seasonal reward is paid once only", nearly(S().studio.cash, afterPay) && S().liveops.eventRewarded);
check("claim after payout is rejected, not silent", !!C.liveopsClaim().err, C.liveopsClaim().err || "");
desksRenderClean("(pact settled, event paid)");

/* ── action delegation ────────────────────────────────────────── */
const stub = { getAttribute: () => null };
check("liveopsAction handles live-pull",
  C.liveopsAction("live-pull", stub) === true && S().liveops.pulls >= 61);
check("liveopsAction handles live-amenity (already owned → handled)",
  C.liveopsAction("live-amenity", { getAttribute: (k) => (k === "data-id" ? "gym" : null) }) === true);
check("liveopsAction handles live-coprod",
  C.liveopsAction("live-coprod", { getAttribute: (k) => (k === "data-id" ? "pNope" : k === "data-key" ? "titan" : null) }) === true);
check("liveopsAction handles live-claim (already banked → handled)",
  C.liveopsAction("live-claim", stub) === true);
check("liveopsAction returns false for foreign actions", C.liveopsAction("gl-open", stub) === false);
check("liveopsAction returns false for non-live prefixes", C.liveopsAction("ops-press", stub) === false);

/* ── 60+ week drive with real engine releases ─────────────────── */
S().studio.cash = Math.max(S().studio.cash, 260);
/* a ready film scheduled two weeks out so the engine's own release gate fires */
const sched1 = fakeProject("p9002", "Scheduled Opener", "ready", 30);
sched1.genre = "comedy"; sched1.mkt = 6; sched1.mktIdx = 2; sched1.releaseWeek = S().studio.week + 2;
const sched2 = fakeProject("p9003", "Second Slot", "ready", 24);
sched2.genre = "drama"; sched2.mkt = 5; sched2.mktIdx = 2; sched2.releaseWeek = S().studio.week + 14;
advance(60);
check("no throw and cash finite all weeks", threw === null, threw || ("wk " + S().studio.week));
check("60+ advanceWeek calls driven", weeksDriven >= 60, String(weeksDriven));
check("cash finite every single week", badCashWeeks === 0, badCashWeeks + " bad weeks");
check("at least one earn and one spend booked", earnRows > 0 && spendRows > 0,
  earnRows + " earn rows · " + spendRows + " spend rows");
check("real releases flowed through liveopsOnRelease", releaseCalls >= 1, releaseCalls + " releases");

/* ── end-state invariants ─────────────────────────────────────── */
const L = S().liveops;
check("S.liveops exists at end with finite fields",
  !!L && isFinite(L.pulls) && isFinite(L.pity) && isFinite(L.pityLegend) && isFinite(L.pityHits) &&
  isFinite(L.eventIdx) && isFinite(L.eventGross) && isFinite(L.eventRewarded === true ? 1 : 0) &&
  isFinite(L.coprodPaid) && isFinite(L.seasonCash) && isFinite(L.spentCash) && isFinite(L.lastTick),
  "pulls " + L.pulls + " · gross " + L.eventGross + "M · coprod " + L.coprodPaid + "M");
check("every pact record keeps finite money",
  L.pacts.every((p) => isFinite(p.share) && isFinite(p.advance) && isFinite(p.paid)),
  L.pacts.length + " pacts");
check("hook values still applied after the full drive",
  C.liveopsAmenityMods().rep === 1.08 && C.liveopsAmenityMods().critic === 4 &&
  C.liveopsAmenityMods().crew === 1.1 && C.liveopsAmenityMods().overhead === 0.92);
check("event multiplier still in range 1..1.5",
  C.liveopsEventMult("drama") >= 1 && C.liveopsEventMult("drama") <= 1.5);
check("market talent count is finite and sane", isFinite(S().market.length) && S().market.length > 40,
  String(S().market.length));
desksRenderClean("(end, 60+ weeks in)");

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · " +
  S().liveops.pulls + " pulls · " + releaseCalls + " releases hooked");
process.exit(failures || threw ? 1 : 0);
