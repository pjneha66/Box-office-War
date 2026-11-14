/* Contract harness for the deal-making module (game/bizdeal.js, wave 5).
   Mirrors test/rebuild-biz.mjs: data.js + engine.js + biz.js (integration
   target) + bizdeal.js in a VM sandbox with a stubbed localStorage. ui.js is
   NOT loaded, so the ui helpers the desk renders call (`tag`, `statrow`) are
   stubbed on the sandbox. Drives 60 advanceWeek() calls while exercising
   every bizdeal system through its real functions, then asserts values.
   The weekly beat runs via ctx.tickBizdeal() after each advanceWeek (engine
   does not call tickBizdeal yet — integrator wiring note). */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label + (extra != null ? " — " + extra : "")); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }

const mem = {};
const ctx = {
  console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
  Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  }
};
vm.createContext(ctx);
for (const f of ["data.js", "engine.js", "biz.js", "bizdeal.js"]) {
  if (!existsSync(path.join(gameDir, f))) { console.error("missing game/" + f); process.exit(1); }
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
/* ui helpers stubbed (desk renders call them) */
ctx.tag = (t) => '<span class="tag">' + t + "</span>";
ctx.statrow = (k, v) => '<div class="statrow"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";

const S = () => ctx.S;
const btn = (attrs) => ({ getAttribute: (k) => {
  if (attrs[k] != null) return attrs[k];
  const k2 = k.replace("data-", "");
  return attrs[k2] != null ? attrs[k2] : null;
} });
const PRIO_INTL = ["action", "scifi", "fantasy"];
const PRIO_EU = ["drama", "romance", "crime"];

try {
  /* ── module shape ─────────────────────────────────────────────── */
  console.log("module shape");
  for (const fn of ["dealEnsure", "tickBizdeal", "bizdealAction", "rivalDealClash", "hasPactWith",
    "screenCountMult", "dealRegionalMult", "forecastAdjust_bizdeal",
    "dealGift", "dealPress", "dealTrade", "dealPact", "dealScreen"])
    check("defines " + fn + "()", typeof ctx[fn] === "function");
  check("defines BIZDEAL_DESKS (2 desks)", Array.isArray(ctx.BIZDEAL_DESKS) && ctx.BIZDEAL_DESKS.length === 2);
  const rivalsDesk = ctx.BIZDEAL_DESKS.find((d) => d.id === "deal-rivals");
  check("deal-rivals desk: group 'Deals', icon 🤝", !!rivalsDesk && rivalsDesk.group === "Deals" && rivalsDesk.icon === "🤝");
  check("desk entries have name/desc/render", ctx.BIZDEAL_DESKS.every((d) => d.name && d.desc && typeof d.render === "function"));
  check("forecastAdjust_bizdeal() → 0", ctx.forecastAdjust_bizdeal() === 0);

  /* ── lazy ensure ──────────────────────────────────────────────── */
  console.log("lazy ensure");
  ctx.newGame("Deal Test", "veteran");
  const R1 = S().rivals[0].name, R2 = S().rivals[1].name, R3 = S().rivals[2].name;
  check("S.deal absent until first contact", S().deal === undefined);
  ctx.dealEnsure();
  check("S.deal has rel/pacts/screens/regional", !!S().deal && !!S().deal.rel && Array.isArray(S().deal.pacts) && !!S().deal.screens && !!S().deal.regional);
  check("regional starts 10/10/10", S().deal.regional.EU === 10 && S().deal.regional.APAC === 10 && S().deal.regional.CN === 10);
  check("dealRegionalMult at start ≈ 0.84", near(ctx.dealRegionalMult(), 0.84, 1e-9), ctx.dealRegionalMult());
  ctx.dealEnsure();
  check("ensure idempotent", S().deal.regional.EU === 10);
  check("hooks are safe pre-data: screenCountMult(null) → 1", ctx.screenCountMult(null) === 1);
  check("hooks are safe pre-data: hasPactWith → false", ctx.hasPactWith(R1) === false);

  /* ── 60-week drive ────────────────────────────────────────────── */
  console.log("60-week drive");
  let threw = null, badCashWeek = null, overWeek = null, greenErr = 0;
  let giftBefore = null, giftAfter = null, pressBefore = null, pressAfter = null;
  let pressFirstOk = false, pressCdRej = false, cashCutRej = false, pactGateRej = false;
  let tradeOk = false, tradeCdRej = false, tradeMarketStable = false, tradeNewPowerOk = false, tradeRelOk = false;
  let hostile92 = false, neutral1 = false;
  let relSign = null, pactSignedWk = null, pactUntil = null, pactExpiredWk = null, relAtExpiry = null, clashDuringPactOk = true, expiryNewsSeen = false;
  let wideGateRej = false, satGateRej = false, renegotiateRej = false, deskSegSnap = null;
  const screenObs = {};
  const SCREEN_KEYS = ["wide", "sat", "min", "std"];
  let screenIx = 0;
  let presale = null;

  for (let w = 1; w <= 60; w++) {
    const st = S().studio;
    /* keep two target-genre productions running (regional growth needs done films) */
    if (S().projects.filter((p) => !p.releaseWeek).length < 2) {
      let idea = null;
      for (const g of PRIO_INTL.concat(PRIO_EU)) { idea = S().ideas.find((i) => i.genre === g); if (idea) break; }
      if (idea) {
        const scale = st.cash > 45 ? "indie" : "micro";
        const budget = ctx.scaleOf(scale).budgets[0];
        const dir = S().market.filter((t) => t.k === "dir" && !ctx.talentBusy(t) && ctx.feeFor(t, budget) < budget * 0.35).sort((a, b) => b.skill - a.skill)[0];
        const act = S().market.filter((t) => t.k === "actor" && !ctx.talentBusy(t) && ctx.feeFor(t, budget) < budget * 0.35).sort((a, b) => b.skill - a.skill)[0];
        if (dir && act) { const r = ctx.greenlight(idea.id, { scale, bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 2 }); if (r.err) greenErr++; }
      }
    }
    for (const p of S().projects) {
      if (p.phase === "ready" && !p.releaseWeek) {
        const r = ctx.setRelease(p, st.week + 2, st.cash > 12 ? 2 : 0);
        if (r.err) greenErr++;
      }
    }
    if (st.cash < 10 && S().loans.length < 2) ctx.takeLoan();

    /* week 1: first gift via the real action bridge */
    if (w === 1 && giftBefore == null) {
      giftBefore = ctx.dealRelOf(R1);
      ctx.bizdealAction("deal-gift", btn({ rival: R1 }));
      giftAfter = ctx.dealRelOf(R1);
    }
    /* week 2: joint press (+12), then pact gate rejects low relations */
    if (w === 2) {
      pressBefore = ctx.dealRelOf(R1);
      pressFirstOk = ctx.dealPress(R1) === true;
      pressAfter = ctx.dealRelOf(R1);
      pactGateRej = ctx.dealPact(R1) === false;
    }
    /* week 3: insufficient-cash rejection (gift at $0.5M) + press cooldown */
    if (w === 3) {
      const c = st.cash;
      S().studio.cash = 0.5;
      const bridge = ctx.bizdealAction("deal-gift", btn({ rival: R1 }));
      cashCutRej = bridge === true && S().studio.cash === 0.5;
      S().studio.cash = c;
      pressCdRej = ctx.dealPress(R1) === false;
    }
    /* week 4: star trade */
    if (w === 4 && !tradeOk) {
      const ids0 = new Set(S().market.map((t) => t.id));
      const sz0 = S().market.length;
      tradeOk = ctx.dealTrade(R2) === true;
      const ids1 = new Set(S().market.map((t) => t.id));
      tradeMarketStable = S().market.length === sz0;
      const removed = [...ids0].filter((id) => !ids1.has(id));
      const added = [...ids1].filter((id) => !ids0.has(id));
      if (tradeOk && removed.length === 1 && added.length === 1) {
        const nt = S().market.find((t) => t.id === added[0]);
        tradeNewPowerOk = !!nt && nt.power >= 2 && nt.power <= 5;
      }
      tradeRelOk = ctx.dealRelOf(R2) === 5;
    }
    /* week 5: trade cooldown */
    if (w === 5 && !tradeCdRej) tradeCdRej = ctx.dealTrade(R2) === false;
    /* week 8: hostile vs neutral rivalDealClash (rel set directly — no action lowers rel) */
    if (w === 8) {
      neutral1 = ctx.rivalDealClash(R3) === 1;
      S().deal.rel[R3] = -60;
      hostile92 = ctx.rivalDealClash(R3) === 0.92;
      delete S().deal.rel[R3];
    }
    /* weekly gift to R1 until the pact signs */
    if (pactSignedWk == null && st.cash > 25 && !ctx.hasPactWith(R1))
      ctx.bizdealAction("deal-gift", btn({ rival: R1 }));
    /* sign the pact once relations ≥ 40 */
    if (pactSignedWk == null && ctx.dealRelOf(R1) >= 40 && st.cash >= 25) {
      relSign = ctx.dealRelOf(R1);
      if (ctx.bizdealAction("deal-pact", btn({ rival: R1 })) === true && ctx.hasPactWith(R1)) {
        pactSignedWk = st.week;
        pactUntil = S().deal.pacts[0].until;
        clashDuringPactOk = ctx.rivalDealClash(R1) === 1.1;
      }
    }
    /* screen deals: one per ready film, gate tests before raising chain relations */
    if (screenIx < SCREEN_KEYS.length) {
      const p = S().projects.find((q) => q.phase === "ready" && !q.screenDeal);
      if (p) {
        const key = SCREEN_KEYS[screenIx];
        if (screenIx === 1 && !deskSegSnap) deskSegSnap = ctx.BIZDEAL_DESKS[1].render(); /* ready, unlocked project */
        if (key === "wide") {
          S().biz.chains.rel = 50;
          wideGateRej = ctx.dealScreen(p.id, "wide") === false && !p.screenDeal;
          S().biz.chains.rel = 60;
        }
        if (key === "sat") {
          S().biz.chains.rel = Math.min(S().biz.chains.rel, 60);
          satGateRej = ctx.dealScreen(p.id, "sat") === false && !p.screenDeal;
          S().biz.chains.rel = 75;
        }
        if (ctx.dealScreen(p.id, key) === true) {
          screenObs[key] = { mult: ctx.screenCountMult(p), legs: p.screenLegs, rental: p.screenRental };
          if (screenIx === 0) renegotiateRej = ctx.dealScreen(p.id, "std") === false && p.screenDeal === "wide";
          screenIx++;
        }
      }
    }
    /* presale integration: MG offer must scale with regional rep (0.84 → 1.2) */
    if (!presale) {
      const p = S().projects.find((q) => ["shoot", "post", "ready"].indexOf(q.phase) >= 0);
      if (p) {
        S().deal.regional.EU = 10; S().deal.regional.APAC = 10; S().deal.regional.CN = 10;
        const m1 = ctx.dealRegionalMult();
        const g = ctx.genreOf(p.genre);
        const unscaled = ctx.scaleOf(p.scale).openBase * g.mass * 2.5;
        const ok1 = ctx.bizSellPresale(p.id, 0.15) === true;
        const mg1 = ok1 ? S().biz.presales[S().biz.presales.length - 1].mg : null;
        S().deal.regional.EU = 100; S().deal.regional.APAC = 100; S().deal.regional.CN = 100;
        const m2 = ctx.dealRegionalMult();
        let mg2 = null;
        if (ok1) {
          p.presale = 0;
          mg2 = ctx.bizSellPresale(p.id, 0.15) === true ? S().biz.presales[S().biz.presales.length - 1].mg : null;
          p.presale = 0;
        }
        S().deal.regional.EU = 10; S().deal.regional.APAC = 10; S().deal.regional.CN = 10;
        presale = { m1, m2, unscaled, intl: g.intl, mg1, mg2 };
      }
    }

    try { ctx.advanceWeek(); } catch (e) { threw = { w, e }; break; }
    ctx.tickBizdeal(); /* engine wiring pending — harness runs the weekly beat */
    if (!isFinite(S().studio.cash)) badCashWeek = w;
    if (pactSignedWk != null && pactExpiredWk == null && ctx.hasPactWith(R1) && ctx.rivalDealClash(R1) !== 1.1) clashDuringPactOk = false;
    if (pactSignedWk != null && pactExpiredWk == null && !ctx.hasPactWith(R1)) {
      pactExpiredWk = S().studio.week;
      relAtExpiry = ctx.dealRelOf(R1);
      expiryNewsSeen = S().news.some((n) => n.txt.indexOf("pact has expired") >= 0);
    }
    if (S().over) { overWeek = w; break; }
  }

  /* ── results ──────────────────────────────────────────────────── */
  console.log("results");
  check("no throw across the drive", !threw, threw ? ("week " + threw.w + ": " + threw.e) : null);
  check("cash finite every week", badCashWeek == null, "week " + badCashWeek);
  check("studio survived the drive", !S().over, "bankrupt week " + overWeek);
  check("greenlight/schedule errors tolerated (counted)", greenErr < 20, greenErr);

  check("gift dinner +8 relations", giftAfter === giftBefore + 8, giftBefore + "→" + giftAfter);
  check("joint press +12 relations", pressFirstOk && pressAfter === pressBefore + 12, pressBefore + "→" + pressAfter);
  check("press cooldown blocks 2nd within 8 wk", pressCdRej);
  check("pact gate rejects relations < 40", pactGateRej);
  check("insufficient cash rejected (gift at $0.5M)", cashCutRej);
  check("trade swaps exactly one market talent", tradeOk && tradeMarketStable);
  check("incoming star power = outgoing ±1 (2..5)", tradeNewPowerOk);
  check("trade grants +5 relations", tradeRelOk);
  check("trade cooldown blocks 2nd within 12 wk", tradeCdRej);
  check("neutral rival clash ×1", neutral1);
  check("hostile rival (rel ≤ -50) clash ×0.92", hostile92);

  check("pact signed (rel ≥ 40, $15M)", pactSignedWk != null, "sign week " + pactSignedWk);
  check("pact term = 26 weeks", pactUntil === pactSignedWk + 26, pactUntil);
  check("hasPactWith true during term + rivalDealClash ×1.1", pactSignedWk != null && clashDuringPactOk);
  check("pact expired before week 60", pactExpiredWk != null && pactExpiredWk < 60, pactExpiredWk);
  check("expiry lands on the scheduled week", pactExpiredWk === pactUntil);
  check("expiry logged in the news feed (same week)", expiryNewsSeen);
  check("relations drifted ≥ 10 points toward 0 over the term", relAtExpiry != null && relSign != null && relAtExpiry < relSign - 10, relSign + "→" + relAtExpiry);
  check("clash back to ×1 after expiry (rel > -50)", ctx.rivalDealClash(R1) === 1);

  check("all four screen deals negotiated", screenIx === 4, screenIx + "/4");
  check("wide gate rejected at relations 50", wideGateRej);
  check("saturation gate rejected at relations 60", satGateRej);
  check("renegotiation blocked once locked", renegotiateRej);
  check("screenCountMult min ×0.90", !!screenObs.min && screenObs.min.mult === 0.9);
  check("screenCountMult std ×1.00", !!screenObs.std && screenObs.std.mult === 1);
  check("screenCountMult wide ×1.06", !!screenObs.wide && screenObs.wide.mult === 1.06);
  check("screenCountMult sat ×1.12", !!screenObs.sat && screenObs.sat.mult === 1.12);
  check("Minimum stores p.screenRental +0.02", !!screenObs.min && screenObs.min.rental === 0.02);
  check("Saturation stores p.screenLegs -0.1", !!screenObs.sat && screenObs.sat.legs === -0.1);

  check("presale mult at rep 10 ≈ 0.84", !!presale && near(presale.m1, 0.84, 1e-9), presale && presale.m1);
  check("presale mult at rep 100 ≈ 1.2", !!presale && near(presale.m2, 1.2, 1e-9), presale && presale.m2);
  check("MG offer = base offer × 0.84", !!presale && presale.mg1 != null && Math.abs(presale.mg1 - Math.round(presale.unscaled * presale.intl * 0.15 * 0.35 * 0.84 * 10) / 10) <= 0.11, presale && presale.mg1);
  check("MG offer = base offer × 1.2 at rep 100", !!presale && presale.mg2 != null && Math.abs(presale.mg2 - Math.round(presale.unscaled * presale.intl * 0.15 * 0.35 * 1.2 * 10) / 10) <= 0.11, presale && presale.mg2);
  check("higher rep → strictly larger presale offer", !!presale && presale.mg2 != null && presale.mg2 > presale.mg1 * 1.35);

  let intlDone = 0, euDone = 0;
  S().films.forEach((f) => {
    if (!f.regionalCounted) return;
    if (PRIO_INTL.indexOf(f.genre) >= 0) intlDone++; else if (PRIO_EU.indexOf(f.genre) >= 0) euDone++;
  });
  check("at least one intl-heavy film completed", intlDone >= 1, intlDone);
  check("at least one EU-lean film completed", euDone >= 1, euDone);
  check("APAC rep grew from done films", S().deal.regional.APAC > 10, S().deal.regional.APAC);
  check("CN rep grew from done films", S().deal.regional.CN > 10, S().deal.regional.CN);
  check("EU rep grew from done films", S().deal.regional.EU > 10, S().deal.regional.EU);
  check("regional values within 0..100", ["EU", "APAC", "CN"].every((k) => S().deal.regional[k] >= 0 && S().deal.regional[k] <= 100 && isFinite(S().deal.regional[k])));
  check("rel values within -100..100", Object.keys(S().deal.rel).every((k) => isFinite(S().deal.rel[k]) && S().deal.rel[k] >= -100 && S().deal.rel[k] <= 100));

  check("bizdealAction returns false for foreign ids", ctx.bizdealAction("bogus-action", btn({})) === false);
  check("bizdealAction returns true for deal ids", S().studio.cash > 25 && ctx.bizdealAction("deal-gift", btn({ rival: R2 })) === true);
  const html1 = ctx.BIZDEAL_DESKS[0].render();
  const html2 = ctx.BIZDEAL_DESKS[1].render();
  check("desk deal-rivals renders with action buttons", typeof html1 === "string" && html1.indexOf('data-action="deal-gift"') >= 0 && html1.indexOf('data-action="deal-pact"') >= 0);
  check("desk deal-screens shows screen segs for an unlocked ready film", typeof deskSegSnap === "string" && deskSegSnap.indexOf('data-action="deal-screen"') >= 0);
  check("desk deal-screens renders regional section", typeof html2 === "string" && html2.indexOf("Regional reputation") >= 0);
} catch (e) {
  fail++;
  console.error("HARNESS THREW: " + (e && e.stack ? e.stack : e));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
