/* Rebuild empire-module harness: loads data.js + engine.js + empire.js in a VM sandbox
   (stubbed localStorage, stubbed UI globals — ui.js needs a DOM) and drives 60 weeks,
   exercising every Empire system through the real functions. Prints one line per check;
   exits non-zero on failure. Usage: node test/rebuild-empire.mjs */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

function makeCtx() {
  const ctx = {
    console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
    Number, String, Object, Array, Promise, navigator: {},
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    },
    /* minimal UI stubs (game/ui.js is not loaded here) */
    tag: (t, c) => `<span class="tag ${c || ""}">${t}</span>`,
    statrow: (k, v, c) => `<div class="statrow"><span class="k">${k}</span><span class="v num ${c || ""}">${v}</span></div>`,
    openSheet: (html) => { ctx.__lastSheet = html; },
    rerenderSheet: (html) => { ctx.__lastSheet = html; },
    closeSheet: () => {},
    pushToast: () => {},
    render: () => {}
  };
  const mem = {};
  return ctx;
}

let failures = 0;
function check(name, ok, extra) {
  console.log(`${ok ? "ok  " : "FAIL"} — ${name}${extra ? " · " + extra : ""}`);
  if (!ok) failures++;
}
function elx(attrs) { return { getAttribute: (n) => (n in attrs ? attrs[n] : null) }; }

/* ── load ── */
const ctx = makeCtx();
const sandbox = vm.createContext(ctx);
for (const f of ["data.js", "engine.js", "empire.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), sandbox, { filename: f });
}
check("empire.js defines tickEmpire / empireAction / EMPIRE_DESKS (6 desks)",
  typeof ctx.tickEmpire === "function" && typeof ctx.empireAction === "function"
  && Array.isArray(ctx.EMPIRE_DESKS) && ctx.EMPIRE_DESKS.length === 6);
check("engine drives weekly empire systems (integrator hook, no self-wrap)", typeof ctx.advanceWeek === "function" && ctx.advanceWeek.__empWrapped === undefined);

ctx.newGame("Test", "veteran");
const S = () => ctx.S;

/* ── insufficient-cash rejection first: pin cash to $2M, try to build the park ── */
S().studio.cash = 2;
const rejected = ctx.empireAction("emp-park-build", elx({}));
check("insufficient cash: park build rejected, cash untouched, no park created",
  rejected === true && !!S().emp && !S().emp.park && S().studio.cash === 2);
S().studio.cash = 900; // test bankroll so every desk can be exercised

/* ── seed franchises through the real greenlight path ── */
function seedFranchise(name) {
  const idea = S().ideas.slice().sort((a, b) => b.script - a.script)[0];
  const dir = S().market.find((t) => t.k === "dir" && !ctx.talentBusy(t));
  const act = S().market.find((t) => t.k === "actor" && !ctx.talentBusy(t));
  const r = ctx.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 0 });
  if (r.err) throw new Error("seed greenlight failed: " + r.err);
  const p = S().projects[S().projects.length - 1];
  p.franchiseOf = name;
  p.phaseLen = { pre: 1, shoot: 1, post: 1 }; // fast-track a real project
  return p;
}
seedFranchise("Aurora Saga");
seedFranchise("Iron Tide");

/* ── earnings ledger: accumulate by label prefix from each week's P&L ── */
const earns = {};
function bookEarns() {
  const tx = S().weekTx;
  if (!tx) return;
  for (const r of tx.rows) {
    for (const key of ["Theme park", "Merch ·", "Dome", "Theatre ·", "Shorts ·", "Cast album", "Tour ·", "Crossover payoff"]) {
      if (r.k.startsWith(key)) earns[key] = (earns[key] || 0) + r.v;
    }
  }
}

const flags = {
  crossoverDone: false, payoffSeen: false, merchLaunched: 0, merchExpiredNews: false,
  parkTier3: false, domeBuilt: false, namingAccepted: false, namingOfferForced: false,
  skyboxes: false, sportsBooked: false, stageYard: false, retool: false, reviews: null,
  recoup: false, adaptShow: false, tourLaunched: false, shortsMade: 0, discoveredLive: 0
};

function drive(w) {
  const st = S().studio;

  /* schedule anything that reached "ready" for next week (whisper marketing) */
  for (const p of S().projects) {
    if (p.phase === "ready" && p.releaseWeek == null) ctx.setRelease(p, st.week + 1, 0);
  }

  /* crossover once two franchises sit at heat 2+ */
  if (!flags.crossoverDone && w >= 5 && ctx.empCanCrossover()) {
    ctx.empireAction("emp-x-go", elx({}));
    if (S().emp.crossover && !S().emp.crossover.used) flags.crossoverDone = true;
  }

  /* merch lines on hot franchises (toys then apparel) */
  if (flags.crossoverDone && flags.merchLaunched < 2) {
    const src = S().emp.franchises.find((f) => f.heat >= 2 && !S().emp.merch.some((L) => L.srcType === "fr" && L.srcId === f.name));
    if (src) {
      const kind = flags.merchLaunched === 0 ? "toys" : "apparel";
      if (ctx.empireAction("emp-merch", elx({ "data-id": "fr:" + src.name, "data-key": kind }))) flags.merchLaunched++;
    }
  }

  /* theme park: build then expand to tier 3 */
  if (!S().emp.park) ctx.empireAction("emp-park-build", elx({}));
  if (S().emp.park && S().emp.park.tier < 3 && st.cash > 150) ctx.empireAction("emp-park-expand", elx({}));
  if (S().emp.park && S().emp.park.tier === 3) flags.parkTier3 = true;

  /* megadome: build, accept naming offer when it comes (forced after wk24 if RNG silent),
     skyboxes, sports package (no streamer in this sandbox → 12-week dome events) */
  if (!S().emp.dome && w >= 6) ctx.empireAction("emp-dome-build", elx({}));
  const D = S().emp.dome;
  if (D) {
    flags.domeBuilt = true;
    if (D.offer) { if (ctx.empireAction("emp-dome-naming", elx({}))) flags.namingAccepted = true; }
    else if (w >= 24 && !D.naming) { D.offer = true; flags.namingOfferForced = true; }
    if (!D.skyboxes && st.cash > 120) { if (ctx.empireAction("emp-dome-sky", elx({}))) flags.skyboxes = true; }
    if (!flags.sportsBooked && !D.sports && st.cash > 120) { if (ctx.empireAction("emp-dome-sports", elx({}))) flags.sportsBooked = true; }
  }

  /* stage: full musical lifecycle on The Yard */
  if (!flags.stageYard && w >= 5) {
    ctx.empireAction("emp-stage-open", elx({ "data-id": "yard" }));
    if (ctx.STAGE) {
      ctx.empireAction("emp-stage-src", elx({ "data-key": "orig" }));
      ctx.empireAction("emp-stage-cap", elx({ "data-idx": "0" }));
      ctx.empireAction("emp-stage-comp", elx({ "data-idx": "0" }));
      if (ctx.empireAction("emp-stage-go", elx({}))) flags.stageYard = true;
    }
  }
  const yard = S().emp.stage.shows.find((s) => s.house === "yard");
  if (yard && yard.phase === "previews" && yard.rettools < 2 && !flags.retool) {
    if (ctx.empireAction("emp-stage-retool", elx({ "data-id": yard.id }))) flags.retool = true;
  }
  if (yard && yard.phase === "run") {
    if (flags.reviews == null && yard.reviews != null) {
      flags.reviews = yard.reviews;
      if (yard.reviews < 72) { // force a tour-eligible show (driving, reviews are gauss'd)
        yard.reviews = 72;
        yard.occ = 0.35 + 0.72 * 0.5 + (yard.adapt ? 0.1 : 0);
      }
    }
    if (!flags.recoup && yard.recouped) flags.recoup = true;
    if (!flags.tourLaunched && yard.reviews >= 70 && yard.runWk >= 16 && !yard.tour) {
      if (ctx.empireAction("emp-stage-tour", elx({ "data-id": yard.id }))) flags.tourLaunched = true;
    }
  }

  /* stage: adapted show on Marquee once a recoup unlocks it */
  if (!flags.adaptShow && flags.recoup && w >= 13) {
    const done = S().films.find((f) => f.status === "done");
    if (done && (done.ww || 0) < 40) done.ww = 55; // guarantee an adaptation source (driving)
    const adapt = ctx.empAdaptFilms();
    if (adapt.length && ctx.empHouseUnlocked("marquee")) {
      ctx.empireAction("emp-stage-open", elx({ "data-id": "marquee" }));
      if (ctx.STAGE) {
        ctx.empireAction("emp-stage-src", elx({ "data-key": adapt[0].id }));
        ctx.empireAction("emp-stage-cap", elx({ "data-idx": "1" }));
        ctx.empireAction("emp-stage-comp", elx({ "data-idx": "1" }));
        if (ctx.empireAction("emp-stage-go", elx({}))) flags.adaptShow = true;
      }
    }
  }

  /* shorts: three seasons across the run */
  if (flags.shortsMade < 3 && (w === 10 || w === 14 || w === 18)) {
    if (ctx.empireAction("emp-shorts-go", elx({}))) flags.shortsMade++;
  }

  /* a third Aurora Saga film to pay the crossover off */
  if (flags.crossoverDone && !flags.payoffSeen && w === 6) seedFranchise("Aurora Saga");
}

/* ── the 60-week run ── */
let threw = null, nanWeek = null;
for (let w = 1; w <= 60; w++) {
  try {
    drive(w);
    ctx.advanceWeek();
    bookEarns();
    /* expiry news scrolls out of the 40-item feed — catch it while fresh */
    if (S().news.some((n) => n.txt.indexOf("run its course") >= 0)) flags.merchExpiredNews = true;
    const wkNews = S().news.filter((n) => n.w === S().studio.week && n.txt.indexOf("joins your roster") >= 0);
    flags.discoveredLive += wkNews.length;
    if (!isFinite(S().studio.cash)) nanWeek = w;
    if (S().over) break;
  } catch (e) { threw = { w, e }; break; }
}
const st = S().studio;
const yardEnd = S().emp.stage.shows.find((s) => s.house === "yard");
const marqEnd = S().emp.stage.shows.find((s) => s.house === "marquee");
flags.payoffSeen = !!(S().emp.crossover && S().emp.crossover.used) && earns["Crossover payoff"] === 15;

/* ── checks ── */
check("no throw across 60 advanceWeek() calls + all desk actions", !threw, threw ? `week ${threw.w}: ${threw.e.message}` : "");
check("cash finite every week", nanWeek == null && isFinite(st.cash), nanWeek != null ? `NaN at week ${nanWeek}` : `final ${Math.round(st.cash)}M`);
check("game not bankrupt before week 60", !S().over, `week ${st.week}`);
check("S.emp namespace exists with all system fields",
  !!S().emp && Array.isArray(S().emp.franchises) && Array.isArray(S().emp.counted) && Array.isArray(S().emp.merch)
  && S().emp.park && S().emp.dome && S().emp.stage && Array.isArray(S().emp.stage.shows) && Array.isArray(S().emp.shorts));
check("weekly tick ran every week (lastTick stamp)", S().emp.lastTick === st.week, `lastTick=${S().emp.lastTick} week=${st.week}`);

check("franchises auto-tracked from projects with franchiseOf",
  S().emp.franchises.length >= 2 && S().emp.franchises.every((f) => isFinite(f.heat) && isFinite(f.entries)),
  S().emp.franchises.map((f) => `${f.name} h${f.heat}/e${f.entries}`).join(", "));
check("released franchise films counted once (counted ids, heat/entries moved)",
  S().emp.counted.length >= 3 && S().emp.franchises.some((f) => f.entries >= 3) && S().emp.franchises.every((f) => f.heat >= 2));

check("crossover: executed, both heats +2, payoff $15M paid once on next release",
  flags.crossoverDone && flags.payoffSeen, `payoff=${earns["Crossover payoff"] || 0}M used=${S().emp.crossover && S().emp.crossover.used}`);

check("merch: 2 lines launched, royalties earned, both expired with news",
  flags.merchLaunched === 2 && (earns["Merch ·"] || 0) > 0 && S().emp.merch.length === 0 && flags.merchExpiredNews,
  `earned=${(earns["Merch ·"] || 0).toFixed(1)}M`);

check("park: built, expanded to tier 3 (×2.2), gates income moved",
  flags.parkTier3 && S().emp.park.tier === 3 && S().emp.park.mult === 2.2 && (earns["Theme park"] || 0) > 0,
  `earned=${(earns["Theme park"] || 0).toFixed(1)}M`);

check("dome: built, naming accepted (1.5/wk), skyboxes, sports booked then expired",
  flags.domeBuilt && flags.namingAccepted && flags.skyboxes && flags.sportsBooked && !S().emp.dome.sports && (earns["Dome"] || 0) > 0,
  `earned=${(earns["Dome"] || 0).toFixed(1)}M${flags.namingOfferForced ? " · offer forced after wk24 (RNG)" : ""}`);

check("stage: Yard show greenlit, retooled, opened with finite reviews, recouped (rep+3, album)",
  flags.stageYard && flags.retool && flags.reviews != null && isFinite(flags.reviews) && flags.recoup,
  `reviews=${flags.reviews} rep=${Math.round(st.rep)}`);

check("stage: income moved (gross, cast album, tour)",
  (earns["Theatre ·"] || 0) > 0 && (earns["Cast album"] || 0) > 0 && flags.tourLaunched && (earns["Tour ·"] || 0) > 3,
  `gross=${(earns["Theatre ·"] || 0).toFixed(0)}M album=${(earns["Cast album"] || 0).toFixed(1)}M tour=${(earns["Tour ·"] || 0).toFixed(1)}M`);

check("stage: full lifecycle — Yard closed by occupancy decay, Marquee adapt show ran",
  !!yardEnd && yardEnd.phase === "closed" && !!marqEnd && marqEnd.adapt === true && isFinite(marqEnd.occ),
  `yard=${yardEnd ? yardEnd.phase + ` ${Math.round(yardEnd.grossSum)}M` : "none"} marquee=${marqEnd ? marqEnd.phase : "none"}`);

check("shorts: 3 seasons produced, 24 episodes earned, all wrapped",
  flags.shortsMade === 3 && (earns["Shorts ·"] || 0) > 0 && S().emp.shorts.length === 0,
  `earned=${(earns["Shorts ·"] || 0).toFixed(1)}M`);

/* discovery is 15%/episode (RNG) — verify the mechanic deterministically via the real fn */
const before = S().market.length;
ctx.empDiscoverActor();
const t = S().market[S().market.length - 1];
check("shorts discovery: new actor, power<=3, fee matches FEE_ACTOR (and " + flags.discoveredLive + " discovered passively in 24 episodes)",
  S().market.length === before + 1 && t.k === "actor" && t.power <= 3 && t.fee === ctx.FEE_ACTOR[t.power - 1],
  `${t.n} ★${t.power}`);

/* desk renders smoke: every desk body is a non-empty string without NaN/undefined */
let renderSmoke = true;
for (const d of ctx.EMPIRE_DESKS) {
  const html = d.render();
  if (typeof html !== "string" || !html.length || html.includes("NaN") || html.includes("undefined")) {
    renderSmoke = false;
    console.log(`     desk ${d.id} render problem`);
  }
}
check("all 6 desk render() bodies are clean strings (no NaN/undefined)", renderSmoke);
ctx.empireAction("emp-desk", elx({ "data-id": "emp-stage" }));
check("emp-desk action opens a full sheet shell (title bar + body)",
  typeof ctx.__lastSheet === "string" && ctx.__lastSheet.indexOf("sheet-head") >= 0 && ctx.__lastSheet.indexOf("Greenlight a musical") >= 0);
check("unknown emp- action not swallowed (returns false for delegation)",
  ctx.empireAction("emp-zzz", elx({})) === false && ctx.empireAction("non-emp", elx({})) === false);

/* ── wave 3: shared universe, lore, fatigue, revival ── */
const W3Y = S().studio.year;

S().studio.cash = 2; // charter rejection without cash (two franchises exist from the run)
check("insufficient cash: universe charter rejected, cash untouched, nothing created",
  ctx.empireAction("emp-universe-charter", elx({})) === true && !S().emp.universe && S().studio.cash === 2);

check("franchiseOpeningMult: 1 without a chartered universe (franchise or not)",
  ctx.franchiseOpeningMult({ franchiseOf: "Aurora Saga" }) === 1 && ctx.franchiseOpeningMult({}) === 1);

S().studio.cash = 900;
ctx.empireAction("emp-universe-charter", elx({}));
check("charter: permanent universe, lore 85, $30M spent",
  !!S().emp.universe && S().emp.universe.chartered === true && S().emp.universe.lore === 85 && S().studio.cash === 870);

const mUni = ctx.franchiseOpeningMult({ franchiseOf: "Aurora Saga" });
check("franchiseOpeningMult: >1 with universe + 2 franchises (lore-scaled); non-franchise still 1",
  mUni > 1 && Math.abs(mUni - 1.18) < 1e-9 && ctx.franchiseOpeningMult({}) === 1, `mult=${mUni.toFixed(3)}`);

S().emp.frReleases[W3Y] = 3;
const mFat3 = ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" });
S().emp.frReleases[W3Y] = 5;
const mFat5 = ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" });
check("fatigue: 3 franchise releases in a year → −30 pts (×0.8); 5+ caps at −60 pts (×0.6)",
  Math.abs(mFat3 - mUni * 0.8) < 1e-9 && Math.abs(mFat5 - mUni * 0.6) < 1e-9,
  `m3=${mFat3.toFixed(3)} m5=${mFat5.toFixed(3)}`);

/* lore: quality-60+ franchise release → +3; flop (profit < −cost·0.35, settles at end of run) → −8 */
S().emp.frReleases[W3Y] = 1;
S().emp.universe.lore = 85;
S().emp.lastTick = S().studio.week - 1;
S().films.unshift({ id: "fLore1", title: "Lore Probe I", franchiseOf: "Aurora Saga", status: "done", cost: 100, profit: -40, quality: 55 });
ctx.tickEmpire(); /* flop settles → −8 */
S().emp.lastTick = S().studio.week - 1;
S().films.unshift({ id: "fLore2", title: "Lore Probe II", franchiseOf: "Iron Tide", status: "done", cost: 100, profit: 12, quality: 72 });
ctx.tickEmpire(); /* release counted, quality ≥ 60 → +3 */
check("lore: −8 on a franchise flop, +3 on a quality-60+ franchise release",
  S().emp.universe.lore === 80, `lore=${S().emp.universe.lore}`);

S().emp.universe.lore = 44;
S().emp.lastTick = S().studio.week - 1;
S().films.unshift({ id: "fLore3", title: "Lore Probe III", franchiseOf: "Aurora Saga", status: "done", cost: 100, profit: -60, quality: 30 });
ctx.tickEmpire();
check("lore clamped to 40–100", S().emp.universe.lore === 40, `lore=${S().emp.universe.lore}`);

/* revival: $8M per fatigued franchise → −14 relief stored, one-shot +18% armed */
S().emp.frReleases[W3Y] = 4;
S().emp.universe.lore = 85;
S().studio.cash = 900;
const mFat4 = ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" });
const fatBefore = ctx.empFatigueFor("Iron Tide");
const cashBefore = S().studio.cash;
const revOk = ctx.empireAction("emp-revival", elx({ "data-id": "Iron Tide" }));
const fatAfter = ctx.empFatigueFor("Iron Tide");
const mRev = ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" }); /* id-less probe: boost applies but is retained */
const mRelieved = mRev / 1.18;
check("revival: $8M action stores −14 relief (fatigue 60→46), eased mult beats fatigued mult, news logged",
  revOk === true && S().emp.fatigueRelief["Iron Tide"] === 14 && S().studio.cash === cashBefore - 8
  && fatBefore === 60 && fatAfter === 46
  && Math.abs(mFat4 - mUni * 0.6) < 1e-9
  && Math.abs(mRelieved - mUni * (1 - 46 / 150)) < 1e-9 && mRelieved > mFat4
  && S().news.some((n) => n.txt.indexOf("Revival campaign") >= 0),
  `mFat4=${mFat4.toFixed(3)} mRelieved=${mRelieved.toFixed(3)}`);

check("revival boost: +18% held for previews (id-less probe), consumed by a real release (p.id)",
  !!S().emp.revivalBoost["Iron Tide"]
  && Math.abs(ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" }) - mRev) < 1e-9
  && Math.abs(ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide", id: "pReal" }) - mRev) < 1e-9
  && !S().emp.revivalBoost["Iron Tide"]
  && Math.abs(ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" }) - mRelieved) < 1e-9);

S().emp.frReleases = { 9999: 5 };
S().emp.frYear = W3Y - 1;
ctx.franchiseOpeningMult({ franchiseOf: "Iron Tide" }); /* hook re-syncs the studio year */
check("fatigue counts reset when the studio year changes",
  !S().emp.frReleases[W3Y] && S().emp.frYear === W3Y, "");

S().emp.frReleases[W3Y] = 4; // fatigue a franchise so the revival rows render
const recouped = S().emp.stage.shows.filter((s) => s.recouped === true).length;
check("empRecoupCount counts recouped stage shows",
  ctx.empRecoupCount() === recouped && recouped >= 1, `count=${ctx.empRecoupCount()}`);

const uniHtml = ctx.EMPIRE_DESKS.find((d) => d.id === "emp-franchise").render();
check("franchise desk renders the shared-universe card (lore, fatigue, revival rows, expansion button) clean",
  typeof uniHtml === "string" && uniHtml.indexOf("Shared universe") >= 0 && uniHtml.indexOf("Revive") >= 0
  && uniHtml.indexOf("emp-uni-expand") >= 0 && uniHtml.indexOf("NaN") < 0 && uniHtml.indexOf("undefined") < 0, "");

/* ── wave 6: universe expansion ($12M, lore +8 clamped 100, 8-week cooldown) ── */
S().emp.universe.expandWk = null;
S().emp.universe.lore = 80;
S().studio.cash = 2;
check("expansion: insufficient cash rejected — lore and cash untouched",
  ctx.empireAction("emp-uni-expand", elx({})) === true && S().emp.universe.lore === 80 && S().studio.cash === 2, "");

const wkE = S().studio.week;
S().studio.cash = 900;
ctx.empireAction("emp-uni-expand", elx({}));
check("expansion: $12M spent, lore 80→88, exact news logged, week stamped",
  S().studio.cash === 888 && S().emp.universe.lore === 88 && S().emp.universe.expandWk === wkE
  && S().news.some((n) => n.txt === "The universe expands — new worlds, new characters."), `lore=${S().emp.universe.lore}`);

const reCd = ctx.empireAction("emp-uni-expand", elx({}));
const loreAfterRetry = S().emp.universe.lore, cashAfterRetry = S().studio.cash;
S().emp.universe.lore = 95;
S().emp.universe.expandWk = wkE - 8; /* cooldown elapsed */
ctx.empireAction("emp-uni-expand", elx({}));
check("cooldown: immediate retry rejected (lore/cash unchanged); after 8 wks allowed, lore clamped at 100",
  reCd === true && loreAfterRetry === 88 && cashAfterRetry === 888
  && S().emp.universe.lore === 100 && S().emp.universe.expandWk === wkE && S().studio.cash === 876,
  `lore=${S().emp.universe.lore} cash=${S().studio.cash}`);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
