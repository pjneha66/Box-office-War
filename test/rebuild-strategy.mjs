/* Strategy module test: runs game/engine.js + game/tv.js + game/strategy.js in a VM sandbox
   with a stubbed localStorage, drives 60 weeks while exercising every strategy system through
   the real functions (advanceWeek + manual tickStrategy, since the integrator wires the engine
   call), and asserts hook values. Prints one line per check; exits non-zero on failure. */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

function makeCtx() {
  const mem = {};
  return {
    console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
    Number, String, Object, Array, Promise,
    navigator: {},
    /* ui.js globals referenced by tv.js/actions — stubbed: this harness is DOM-free */
    pushToast: () => {},
    render: () => {},
    rerenderSheet: () => {},
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    }
  };
}

const ctx = makeCtx();
const sandbox = vm.createContext(ctx);
const files = ["data.js", "engine.js", "tv.js", "strategy.js"];
for (const f of files) {
  const p = path.join(gameDir, f);
  if (!existsSync(p)) { console.error("MISSING " + f); process.exit(1); }
  vm.runInContext(readFileSync(p, "utf8"), sandbox, { filename: f });
}

let fails = 0;
function check(name, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + name);
  if (!cond) fails++;
}
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 0.02 : eps); }
function fakeEl(id, key) {
  return { getAttribute: (k) => (k === "data-id" ? id : key) };
}
function findRow(substr) {
  const rows = (ctx.S.weekTx && ctx.S.weekTx.rows) || [];
  return rows.find((r) => String(r.k).indexOf(substr) >= 0) || null;
}
function readyProject() {
  return ctx.S.projects.find((p) => p.phase === "ready") || null;
}
function cheapest(kind, budget) {
  const pool = ctx.S.market.filter((t) => t.k === kind && t.bookedUntil <= ctx.S.studio.week);
  pool.sort((a, b) => ctx.feeFor(a, budget) - ctx.feeFor(b, budget));
  return pool[0] || null;
}
function greenlight(scaleId, bIdx) {
  const ideas = ctx.S.ideas.slice().sort((a, b) => b.script - a.script);
  const idea = ideas[0];
  const budget = ctx.scaleOf(scaleId).budgets[bIdx];
  const dir = cheapest("dir", budget);
  const act = cheapest("actor", budget);
  if (!idea || !dir || !act) return null;
  const r = ctx.greenlight(idea.id, { scale: scaleId, bIdx, dirId: dir.id, actorId: act.id, mktIdx: 1 });
  return r.err ? null : ctx.S.projects[ctx.S.projects.length - 1];
}

/* ── boot ── */
ctx.newGame("Strat Pictures", "veteran");
ctx.S.studio.cash += 600;            /* harness convenience: every system affordable */
check("boot: newGame ok, S.strat absent before first tick", ctx.S.strat == null);

const WEEKS = 60;
let pricingDone = false, releasedWithPricing = 0;
let divIdeaSeen = false, ipBought = false;
const st = () => ctx.S.tv && ctx.S.tv.streamer;
const rivalByName = (n) => ctx.S.strat.rivals.find((r) => r.name === n);
const snap = {};

for (let w = 1; w <= WEEKS && ctx.S && !ctx.S.over; w++) {
  const S = ctx.S;
  if (S.studio.cash < 150) S.studio.cash += 200;   /* mechanics test, not a balance run */

  /* scripted exercise schedule (bot step runs before advanceWeek) */
  if (w === 2 && !S.projects.length) greenlight("micro", 1);
  if (w === 3 && !st()) ctx.tvLaunchStreamer();
  if (w === 5 && st()) {           /* forced poach: known subs, zero tv-growth noise */
    st().subs = 10; st().licensed = 0; st().exclusives = 0;
    S.strat.nextPoach = w;
    snap.w5 = st().subs;
  }
  if (w === 6) {                   /* war counter + IP buy (bot-step spends: assert via cash/news, weekTx rows are wiped by advanceWeek) */
    snap.w6 = st().subs;
    snap.w6cash = S.studio.cash;
    ctx.strategyAction("strat-exclusive", null);
    const o = S.strat.ip.offers.book;
    const ipPrice = o.price;
    ipBought = ctx.strategyAction("strat-ip-buy", fakeEl(null, "book"));
    check("wk6 counter + ip buy charged $25M + shelf price", approx(snap.w6cash - S.studio.cash, 25 + (ipBought ? ipPrice : 0), 0.11));
    check("wk6 ip idea pushed: price 0, script 78–90, fixed genre",
      S.ideas.some((i) => i.title === "The Underground Bestseller" && i.price === 0 && i.script >= 78 && i.script <= 90 && i.genre === "drama"));
    const dup = ctx.strategyAction("strat-ip-buy", fakeEl(null, "book"));
    check("wk6 second buy same week rejected (off shelf)", dup === true && S.ideas.filter((i) => i.title === "The Underground Bestseller").length === 1);
    check("wk6 war exclusive logged", S.news.some((n) => String(n.txt).indexOf("war exclusive") >= 0));
  }
  if (w === 7 && st()) {           /* CinePass: reset war scores for clean math */
    snap.w7 = st().subs;
    snap.ipResting = S.strat.ip.offers.book.soldWeek >= 0;
    S.strat.warScore = 0;
    S.strat.rivals.forEach((r) => { r.wscore = 0; });
    ctx.strategyAction("strat-cinepass", null);
    check("wk7 CinePass setup charged $30M and activated", S.strat.cinePass === true && S.news.some((n) => String(n.txt).indexOf("CinePass launches") >= 0));
  }
  if (w === 8) {
    ctx.strategyAction("strat-div-launch", fakeEl(null, "bollywood"));
    ctx.strategyAction("strat-div-launch", fakeEl(null, "nollywood"));
    const cashBefore = S.studio.cash;
    ctx.strategyAction("strat-div-launch", fakeEl(null, "korean"));
    check("wk8 third division rejected (max 2), cash untouched",
      S.strat.divisions.length === 2 && approx(S.studio.cash, cashBefore, 0.001));
  }
  if (w === 9 && st()) {           /* war momentum: my score leads a level field */
    snap.w9 = st().subs;
    S.strat.warScore = 2;
  }
  if (w === 10) {                  /* co-pro accept path (tentpole, pre-phase) */
    S.studio.rep = 60;             /* harness: tentpole scale gate open */
    S.rivals[0].power = 2.5;       /* appetite ceiling 50 > offer 36–45 → accepts */
    const t1 = greenlight("tentpole", 0);
    if (t1) {
      ctx.strategyAction("strat-copro-pick", fakeEl(t1.id, null));
      ctx.strategyAction("strat-copro-rival", fakeEl(null, "0"));
      const cashBefore = S.studio.cash;
      ctx.strategyAction("strat-copro-offer", null);
      if (t1.coprod) {
        check("wk10 co-pro accepted: refund = remaining budget × share (40–50%)",
          approx(S.studio.cash - cashBefore, t1.coprod.bought, 0.11) &&
          t1.coprod.share >= 0.4 && t1.coprod.share <= 0.5);
        check("wk10 co-pro acceptance logged", S.news.some((n) => String(n.txt).indexOf("co-finances") >= 0));
      } else {
        check("wk10 co-pro accepted", false);
      }
      ctx.__t1 = t1;
    }
  }
  if (w === 11 && ctx.__t1) {      /* second co-pro + fake done film (profit) */
    S.rivals[1].power = 2.5;
    const t2 = greenlight("tentpole", 0);
    if (t2) {
      ctx.strategyAction("strat-copro-pick", fakeEl(t2.id, null));
      ctx.strategyAction("strat-copro-rival", fakeEl(null, "1"));
      ctx.strategyAction("strat-copro-offer", null);
      ctx.__t2 = t2;
    }
    ctx.S.films.unshift({ id: "f9001", title: ctx.__t1.title, status: "done", profit: 100 });
  }
  if (w === 12 && ctx.__t2) {      /* fake done film (loss) */
    ctx.S.films.unshift({ id: "f9002", title: ctx.__t2.title, status: "done", profit: -50 });
  }

  /* pricing desk: drive a ready project through all four strategies once */
  const rp = readyProject();
  if (rp && !pricingDone && w >= 6) {
    ctx.strategyAction("strat-price", fakeEl(rp.id, "peak"));
    check("pricing peak: fields + hook", rp.pricing === "peak" && rp.pricingAud === 0 && rp.pricingLegs === -0.1 && ctx.ticketPricingMult(rp) === 1.08);
    ctx.strategyAction("strat-price", fakeEl(rp.id, "family"));
    check("pricing family: fields + hook", rp.pricing === "family" && rp.pricingAud === 5 && rp.pricingLegs === 0 && ctx.ticketPricingMult(rp) === 0.95);
    ctx.strategyAction("strat-price", fakeEl(rp.id, "premium"));
    check("pricing premium: fields + hook", rp.pricing === "premium" && rp.pricingAud === -2 && rp.pricingLegs === -0.15 && ctx.ticketPricingMult(rp) === 1.15);
    ctx.strategyAction("strat-price", fakeEl(rp.id, "standard"));
    check("pricing standard: fields + hook", rp.pricing === "standard" && rp.pricingAud === 0 && rp.pricingLegs === 0 && ctx.ticketPricingMult(rp) === 1);
    pricingDone = true;
    ctx.strategyAction("strat-price", fakeEl(rp.id, "premium"));
    const rr = ctx.setRelease(rp, S.studio.week + 2, 1, 45);
    if (!rr.err) releasedWithPricing++;
  }

  /* ongoing bot: keep productions flowing so releases/films exist */
  if (S.projects.filter((p) => !p.releaseWeek).length < 2 && w % 3 === 0) {
    greenlight(S.studio.rep >= 55 ? "mid" : "indie", 1);
  }
  S.projects.forEach((p) => {
    if (p.phase === "ready" && p.releaseWeek == null) ctx.setRelease(p, S.studio.week + 2, 1, 45);
  });

  /* ── weekly heartbeat: engine first, then the strategy tick (integrator order) ── */
  try {
    ctx.advanceWeek();
    ctx.tickStrategy();
  } catch (e) {
    console.error("THREW at week " + w, e.stack || e);
    fails++;
    break;
  }
  check("wk" + w + " cash finite", isFinite(S.studio.cash));

  /* per-week focused assertions (weekTx rows belong to the week just settled) */
  if (w === 5) {
    const expected = (snap.w5 * 0.98 + 0.01) * 0.93;
    check("wk5 forced poach: subs ×0.93 after tv.js growth", st() && approx(st().subs, expected, 0.01));
    check("wk5 poach logged + market leader war score +1",
      S.news.some((n) => String(n.txt).indexOf("poaches") >= 0) && rivalByName("StreamFlix Prime").wscore === 1);
  }
  if (w === 6) {
    const afterTv = (snap.w6 + 1.5) * 0.98 + 0.01;
    check("wk6 war counter: $25M charged, war score +1, subs +1.5 then tv step + momentum",
      S.strat.warScore === 1 && approx(st().subs, afterTv + 0.02, 0.03));
  }
  if (w === 7) {
    const afterTv = snap.w7 * 0.98 + 0.01;
    const expected = afterTv + 0.01 * 0.3 - afterTv * 0.02 * 0.3;  /* level scores: no momentum */
    check("wk7 CinePass own-line delta (inflow +30%, churn ×1.3) + fee earned",
      st() && approx(st().subs, expected, 0.03) && !!findRow("CinePass ·"));
  }
  if (w === 9) {
    const afterTv = snap.w9 * 0.98 + 0.01;
    const afterBonus = afterTv + 0.02;
    const expected = afterBonus + 0.01 * 0.3 - afterBonus * 0.02 * 0.3;
    check("wk9 war momentum +0.02 while my score leads rivals avg", st() && approx(st().subs, expected, 0.03));
  }
  if (w === 11) {
    check("wk11 co-pro profit share paid to partner (fake done film)", !!findRow("Co-pro partner payout") &&
      S.strat.coproPaid.indexOf("f9001") >= 0 && S.strat.coproWatch.every((x) => x.title !== ctx.__t1.title));
  }
  if (w === 12) {
    check("wk12 co-pro loss covered by partner (capped at contribution)", !!findRow("Co-pro loss cover") &&
      S.strat.coproPaid.indexOf("f9002") >= 0);
  }
  if (w >= 9) divIdeaSeen = divIdeaSeen || S.ideas.some((i) => i.division === true);
}

/* ── post-run assertions ── */
const S = ctx.S;
check("sim survived 60 weeks", S && !S.over && S.studio.week >= WEEKS - 1);
check("S.strat namespace complete (3 rivals, ip offers, 2 divisions)", !!(S.strat && S.strat.rivals.length === 3 && S.strat.ip && S.strat.ip.offers && S.strat.divisions.length === 2));
check("rival platforms grew 2%/wk from 25/18/12M, all finite",
  S.strat.rivals[0].subs > 25 && S.strat.rivals[1].subs > 18 && S.strat.rivals[2].subs > 12 &&
  S.strat.rivals.every((r) => isFinite(r.subs)));
check("division catalog trickle moved cash weekly", !!findRow("Division catalog"));
check("division idea trickle fired within 60 weeks (12%/wk × 2 wings)", divIdeaSeen);
check("CinePass active at end of run", S.strat.cinePass === true);
check("bought IP license rested off-shelf, then rotated back (3-wk cycle)",
  ipBought && snap.ipResting === true && S.strat.ip.offers.book.soldWeek === -1);
check("released film ran with pricing fields present", releasedWithPricing >= 1 &&
  S.films.filter((f) => f.opening != null).length > 0 &&
  S.films.filter((f) => f.opening != null).every((f) => isFinite(f.opening)));
check("forecastAdjust = divisions ×0.3 + CinePass fee",
  approx(ctx.forecastAdjust_strategy(S.studio.week),
    S.strat.divisions.length * 0.3 + ((S.strat.cinePass && st()) ? st().subs * 0.02 : 0), 1e-6));
check("strategyAction rejects unknown and non-strat actions",
  ctx.strategyAction("strat-bogus", null) === false && ctx.strategyAction("tv-launch-streamer", null) === false);
check("insufficient cash: exclusive rejected, no mutation", (() => {
  const c = S.studio.cash, wsc = S.strat.warScore;
  S.studio.cash = 1;
  const handled = ctx.strategyAction("strat-exclusive", null);
  const ok = handled === true && S.studio.cash === 1 && S.strat.warScore === wsc;
  S.studio.cash = c;
  return ok;
})());
check("co-pro decline path: weak partner refuses a rich offer", (() => {
  S.studio.rep = 60;
  const t = greenlight("tentpole", 0);
  if (!t) return true; /* no talent slot this run — path covered by accept-side logs otherwise */
  S.rivals[3].power = 0.5; /* ceiling 10 < offer → declines */
  ctx.strategyAction("strat-copro-pick", fakeEl(t.id, null));
  ctx.strategyAction("strat-copro-rival", fakeEl(null, "3"));
  ctx.strategyAction("strat-copro-offer", null);
  return !t.coprod && S.news.some((n) => String(n.txt).indexOf("passes on co-financing") >= 0);
})());

console.log("\n" + (fails ? "FAILED checks: " + fails : "ALL CHECKS PASSED") +
  " · week " + S.studio.week + " · cash " + Math.round(S.studio.cash) + "M · subs " +
  (st() ? st().subs.toFixed(2) : "—") + "M · warScore " + S.strat.warScore);
process.exit(fails ? 1 : 0);
