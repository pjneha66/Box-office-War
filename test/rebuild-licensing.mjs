/* Contract harness for the licensing module (game/licensing.js, wave 6).
   Mirrors test/rebuild-bizdeal.mjs: data.js + engine.js + licensing.js in a VM
   sandbox with a stubbed localStorage. ui.js is NOT loaded, so the ui helpers
   the desk renders call (`tag`, `statrow`) are stubbed on the sandbox. Drives
   60 advanceWeek() calls while exercising every licensing system through its
   real functions (accept/decline/expiry, office builds incl. one
   insufficient-cash rejection, hotels trickle), then asserts values.
   The weekly beat runs via ctx.tickLicensing() after each advanceWeek (engine
   wiring pending — integrator note). */
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
for (const f of ["data.js", "engine.js", "licensing.js"]) {
  if (!existsSync(path.join(gameDir, f))) { console.error("missing game/" + f); process.exit(1); }
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
/* ui helpers stubbed (desk renders call them) */
ctx.tag = (t, cls) => '<span class="tag' + (cls ? " " + cls : "") + '">' + t + "</span>";
ctx.statrow = (k, v) => '<div class="statrow"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";

const S = () => ctx.S;
const btn = (attrs) => ({ getAttribute: (k) => {
  if (attrs[k] != null) return attrs[k];
  const k2 = k.replace("data-", "");
  return attrs[k2] != null ? attrs[k2] : null;
} });
const PRIO = ["action", "scifi", "fantasy"]; /* high mass + legs → ww clears the buyer gates */

try {
  /* ── module shape ─────────────────────────────────────────────── */
  console.log("module shape");
  for (const fn of ["licEnsure", "tickLicensing", "licensingAction", "officeRegionalBonus",
    "forecastAdjust_licensing", "licAccept", "licDecline", "licBuildOffice"])
    check("defines " + fn + "()", typeof ctx[fn] === "function");
  check("defines LICENSING_DESKS (2 desks)", Array.isArray(ctx.LICENSING_DESKS) && ctx.LICENSING_DESKS.length === 2);
  const ids = ctx.LICENSING_DESKS.map((d) => d.id).sort().join(",");
  check("desk ids lic-market + lic-offices", ids === "lic-market,lic-offices", ids);
  const mk = ctx.LICENSING_DESKS.find((d) => d.id === "lic-market");
  const of = ctx.LICENSING_DESKS.find((d) => d.id === "lic-offices");
  check("lic-market: group 'Licensing', icon 📄", !!mk && mk.group === "Licensing" && mk.icon === "📄");
  check("lic-offices: group 'Licensing', icon 🏢", !!of && of.group === "Licensing" && of.icon === "🏢");
  check("desk entries have name/desc/render", ctx.LICENSING_DESKS.every((d) => d.name && d.desc && typeof d.render === "function"));
  check("forecastAdjust_licensing() → 0", ctx.forecastAdjust_licensing() === 0);

  /* ── lazy ensure ──────────────────────────────────────────────── */
  console.log("lazy ensure");
  ctx.newGame("Lic Test", "veteran");
  check("S.lic absent until first contact", S().lic === undefined);
  ctx.licEnsure();
  check("S.lic has offers/trickles/offices/total", !!S().lic && Array.isArray(S().lic.offers) && Array.isArray(S().lic.trickles) && !!S().lic.offices && S().lic.total === 0);
  ctx.licEnsure();
  check("ensure idempotent", S().lic.offers.length === 0 && S().lic.total === 0);
  check("officeRegionalBonus is 0 pre-data and pre-build", ctx.officeRegionalBonus("EU") === 0 && ctx.officeRegionalBonus("APAC") === 0);
  check("licAccept of unknown offer → err", ctx.licAccept("bogus").err != null);
  check("licensingAction returns false for foreign ids", ctx.licensingAction("tv-x", btn({})) === false && ctx.licensingAction("lic-bogus", btn({})) === false);

  /* ── 60-week drive ────────────────────────────────────────────── */
  console.log("60-week drive");
  let threw = null, badCashWeek = null, overWeek = null, greenErr = 0, capBreach = null;
  const seenIds = new Set(), acceptedIds = new Set(), declinedIds = new Set();
  const offeredFilms = new Set();
  let expiredCount = 0, acceptedFilmId = null, firstOfferBuyer = null, firstOfferAmt = null, acceptRow = null;
  let acceptTotalBefore = null, acceptTotalAfter = null;
  let declinedOk = false, staleReacceptErr = false, reofferLicensed = false;
  let cashCutRej = false, officeBuilt = {}, officeCashOk = true, officeIncomeWeeks = 0, officeIncomeVal = null;
  let trickleStartWk = null, trickleFilmTitle = null, hotelsRows = 0, totalBeforeTrickle = null, totalAfterTrickle = null;
  let marketOfferSnap = null, marketLicensedSnap = null, officesPreSnap = null;
  const endowNote = "harness endowment (mirrors direct-state precedents) so all three builds fit in 60 weeks";

  for (let w = 1; w <= 60; w++) {
    const st = S().studio;
    /* keep two productions running (offers need finished films) */
    if (S().projects.filter((p) => !p.releaseWeek).length < 2) {
      let idea = null;
      for (const g of PRIO) { idea = S().ideas.find((i) => i.genre === g); if (idea) break; }
      if (!idea) idea = S().ideas[0];
      if (idea) {
        const scale = st.cash > 30 ? "indie" : "micro";
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
    /* endowment: office builds are $93M total — top the coffers up mid-run */
    if (w >= 30 && st.cash < 45) st.cash += 30;

    /* week 12: insufficient-cash rejection on an office build (before any build) */
    if (w === 12 && Object.keys(officeBuilt).length === 0) {
      const c = st.cash;
      st.cash = 0.5;
      const bridged = ctx.licensingAction("lic-office", btn({ id: "lon" }));
      cashCutRej = bridged === true && st.cash === 0.5 && !S().lic.offices.lon;
      st.cash = c;
    }
    /* accept the first offer that ever lands (real action bridge) */
    const openOffers = S().lic.offers.slice();
    if (!acceptedIds.size && openOffers.length) {
      const o = openOffers[openOffers.length - 1];
      const f = ctx.findFilm(o.filmId);
      acceptedIds.add(o.id);
      acceptedFilmId = o.filmId;
      firstOfferBuyer = o.buyer; firstOfferAmt = o.amt;
      acceptTotalBefore = S().lic.total;
      const ok = ctx.licensingAction("lic-accept", btn({ id: o.id })) === true;
      /* the accept earns into the bucket archived by the PREVIOUS advanceWeek,
         so scan weekTx plus txHistory */
      const kWant = "Licensing · " + (f && f.licBuyer) + " · " + f.title;
      acceptRow = null;
      for (const bkt of [S().weekTx].concat(S().txHistory)) {
        const r = (bkt.rows || []).find((r) => r.k === kWant && Math.abs(r.v - o.amt) < 1e-9);
        if (r) { acceptRow = r; break; }
      }
      acceptTotalAfter = ok ? S().lic.total : null;
      trickleStartWk = ok && o.buyer === "hotels" ? w : trickleStartWk;
      if (ok && o.buyer === "hotels") { trickleFilmTitle = f.title; totalBeforeTrickle = S().lic.total; }
    }
    /* decline the next offer via the bridge (once something is accepted) */
    if (acceptedIds.size && !declinedIds.size) {
      const o = openOffers.find((q) => !acceptedIds.has(q.id));
      if (o) { declinedOk = ctx.licensingAction("lic-decline", btn({ id: o.id })) === true; declinedIds.add(o.id); staleReacceptErr = ctx.licAccept(o.id).err != null; }
    }
    /* take a natural hotels offer to exercise the trickle */
    if (acceptedIds.size && trickleStartWk == null && w <= 44) {
      const o = S().lic.offers.find((q) => q.buyer === "hotels");
      if (o) {
        const f = ctx.findFilm(o.filmId);
        totalBeforeTrickle = S().lic.total;
        if (ctx.licensingAction("lic-accept", btn({ id: o.id })) === true) {
          acceptedIds.add(o.id);
          trickleStartWk = w; trickleFilmTitle = f.title;
        }
      }
    }
    /* harness forcing (direct-state precedent, as in rebuild-bizdeal.mjs): if no
       done unlicensed film clears the Hotels ww ≥ 30 gate by week 40, lift one
       film's ww so the trickle is reachable inside 60 weeks */
    if ((w === 40 || w === 44 || w === 46) && trickleStartWk == null && !S().films.some((f) => f.status === "done" && !f.licensed && f.ww >= 30)) {
      const f = S().films.find((f) => f.status === "done" && !f.licensed);
      if (f) f.ww = Math.max(f.ww, 120);
    }
    /* office builds: first unbuilt office whenever affordable */
    if (w >= 13) {
      for (const od of ctx.LIC_OFFICES) {
        if (!officeBuilt[od.id] && !S().lic.offices[od.id] && st.cash >= od.cost + 8) {
          if (!officesPreSnap) officesPreSnap = ctx.LICENSING_DESKS[1].render(); /* pre-build snapshot */
          const before = st.cash;
          if (ctx.licensingAction("lic-office", btn({ id: od.id })) === true) {
            officeBuilt[od.id] = true;
            officeCashOk = officeCashOk && Math.abs(st.cash - (before - od.cost)) < 1e-9;
          }
          break;
        }
      }
    }
    /* backstop: if no hotels trickle started by week 44, craft one via the real accept path */
    if ((w === 44 || w === 46 || w === 48) && trickleStartWk == null) {
      let f = S().films.find((q) => q.status === "done" && !q.licensed && q.ww >= 30);
      if (!f) {
        f = S().films.find((q) => q.status === "done" && !q.licensed);
        if (f && f.ww < 30) f.ww = Math.max(f.ww, 120);
      }
      if (f) {
        const perWk = Math.round(f.ww * 0.0002 * 10000) / 10000;
        const amt = Math.round(f.ww * 0.0002 * 12 * 10) / 10;
        totalBeforeTrickle = S().lic.total;
        S().lic.offers.push({ id: "lo-t1", filmId: f.id, buyer: "hotels", amt, perWk, expires: w + 3 });
        if (ctx.licAccept("lo-t1") === true) {
          acceptedIds.add("lo-t1"); acceptedFilmId = acceptedFilmId || f.id;
          trickleStartWk = w; trickleFilmTitle = f.title;
        }
      }
    }

    try { ctx.advanceWeek(); } catch (e) { threw = { w, e }; break; }
    const openBefore = S().lic.offers.map((o) => o.id);
    ctx.tickLicensing();
    /* expired: open ids that vanished without an accept/decline */
    for (const id of openBefore) {
      if (!S().lic.offers.some((q) => q.id === id) && !acceptedIds.has(id) && !declinedIds.has(id)) expiredCount++;
    }
    for (const o of S().lic.offers) { seenIds.add(o.id); offeredFilms.add(o.filmId); }
    if (S().lic.offers.length > 4) capBreach = w;
    if (!isFinite(S().studio.cash)) badCashWeek = w;
    if (acceptedFilmId && S().lic.offers.some((q) => q.filmId === acceptedFilmId)) reofferLicensed = true;
    const rows = S().weekTx.rows || [];
    if (rows.some((r) => r.k === "Office income")) { officeIncomeWeeks++; officeIncomeVal = rows.find((r) => r.k === "Office income").v; }
    if (rows.some((r) => r.k.indexOf("Licensing · Hotels · ") === 0)) hotelsRows++;
    if (S().lic.offers.length && !marketOfferSnap) marketOfferSnap = ctx.LICENSING_DESKS[0].render();
    if (S().films.some((f) => f.licensed) && !marketLicensedSnap) marketLicensedSnap = ctx.LICENSING_DESKS[0].render();
    if (trickleStartWk != null && totalAfterTrickle == null) {
      if (S().lic.trickles.length === 0) totalAfterTrickle = S().lic.total;
      else if (w === 60) { totalAfterTrickle = S().lic.total; trickleStartWk = -trickleStartWk; /* flag unfinished */ }
    }
    /* idempotency probe: a second tick in the same week must be a no-op */
    if (w === 30) {
      const inBefore = S().weekTx.in, nBefore = S().lic.offers.length, totBefore = S().lic.total;
      ctx.tickLicensing();
      check("tickLicensing is idempotent per week (no double income)", S().weekTx.in === inBefore && S().lic.offers.length === nBefore && S().lic.total === totBefore);
      /* restore counters the probe did not touch */
    }
    if (S().over) { overWeek = w; break; }
  }

  /* ── results ──────────────────────────────────────────────────── */
  console.log("results");
  check("no throw across the drive", !threw, threw ? ("week " + threw.w + ": " + threw.e) : null);
  check("cash finite every week", badCashWeek == null, "week " + badCashWeek);
  check("studio survived the drive", !S().over, "bankrupt week " + overWeek);
  check("greenlight/schedule errors tolerated (counted)", greenErr < 20, greenErr);
  check("open offers never exceeded the 4 cap", capBreach == null, "week " + capBreach);

  check("offers generated (≥ 3 distinct)", seenIds.size >= 3, seenIds.size);
  check("first offer accepted via the action bridge", acceptedFilmId != null && acceptedIds.size >= 1, acceptedIds.size);
  check("accepted film marked licensed with buyer", acceptedFilmId != null && ctx.findFilm(acceptedFilmId).licensed === true && !!ctx.findFilm(acceptedFilmId).licBuyer);
  /* immediate income only exists for one-time buyers — Hotels pay via the trickle */
  if (firstOfferBuyer === "hotels") {
    check("Hotels acceptance pays no upfront fee (trickle starts)", acceptRow == null && acceptTotalAfter != null && Math.abs(acceptTotalAfter - acceptTotalBefore) < 1e-9, acceptTotalBefore + "→" + acceptTotalAfter);
  } else {
    check("acceptance earned 'Licensing · buyer · title' at the offer amount", !!acceptRow, acceptRow && acceptRow.k);
    check("S.lic.total grew by exactly the offer amount", acceptTotalAfter != null && Math.abs(acceptTotalAfter - (acceptTotalBefore + firstOfferAmt)) < 1e-9, acceptTotalBefore + "→" + acceptTotalAfter + " (amt " + firstOfferAmt + ")");
  }
  check("licensed film is never re-offered", !reofferLicensed);
  check("an offer was declined via the bridge", declinedOk);
  check("re-accepting a declined offer errors out", staleReacceptErr);
  check("at least one offer expired untouched", expiredCount >= 1, expiredCount);

  check("insufficient cash rejected (office build at $0.5M)", cashCutRej);
  check("all three offices built", Object.keys(officeBuilt).length === 3, Object.keys(officeBuilt).join(","));
  check("each build deducted exactly its cost", officeCashOk);
  check("weekly 'Office income' earned (≥ 5 weeks, last = 0.2×n)", officeIncomeWeeks >= 5 && officeIncomeVal != null && Math.abs(officeIncomeVal - 0.2 * ctx.licOfficeCount()) < 1e-9, officeIncomeWeeks + " wks, last " + officeIncomeVal);
  check("officeRegionalBonus London→EU 0.5", ctx.officeRegionalBonus("EU") === 0.5, ctx.officeRegionalBonus("EU"));
  check("officeRegionalBonus Tokyo+Seoul→APAC 1.0", ctx.officeRegionalBonus("APAC") === 1.0, ctx.officeRegionalBonus("APAC"));
  check("officeRegionalBonus CN 0", ctx.officeRegionalBonus("CN") === 0, ctx.officeRegionalBonus("CN"));

  check("hotels trickle started (natural or backstop)", trickleStartWk != null, trickleStartWk);
  check("hotels trickle paid 'Licensing · Hotels · …' rows", hotelsRows >= 1, hotelsRows);
  check("trickle income moved S.lic.total (≥ 0.1)", totalBeforeTrickle != null && totalAfterTrickle != null && totalAfterTrickle - totalBeforeTrickle >= 0.1,
    totalBeforeTrickle + "→" + totalAfterTrickle);
  check("trickle finished its 12 weeks inside the drive", trickleStartWk != null && trickleStartWk > 0 && S().lic.trickles.length === 0, "start wk " + Math.abs(trickleStartWk || 0));
  check("S.lic.total finite and positive", isFinite(S().lic.total) && S().lic.total > 0, S().lic.total);
  check("trickle weeks-left fields finite", S().lic.trickles.every((t) => isFinite(t.left) && isFinite(t.perWk)) || S().lic.trickles.length === 0);

  check("desk lic-market renders an offer with Accept/Decline", typeof marketOfferSnap === "string" && marketOfferSnap.indexOf('data-action="lic-accept"') >= 0 && marketOfferSnap.indexOf('data-action="lic-decline"') >= 0);
  check("desk lic-market lists licensed titles", typeof marketLicensedSnap === "string" && marketLicensedSnap.indexOf("Licensed titles") >= 0);
  check("desk lic-offices offered build buttons before building", typeof officesPreSnap === "string" && officesPreSnap.indexOf('data-action="lic-office"') >= 0);
  const ofSnap = ctx.LICENSING_DESKS[1].render();
  const mktSnap = ctx.LICENSING_DESKS[0].render();
  check("desk lic-offices shows built offices as Open", typeof ofSnap === "string" && ofSnap.indexOf("Open") >= 0 && ofSnap.indexOf("Office income") >= 0);
  check("desk lic-market renders an empty/state snapshot string", typeof mktSnap === "string" && mktSnap.indexOf("Licensing income to date") >= 0);
} catch (e) {
  fail++;
  console.error("HARNESS THREW: " + (e && e.stack ? e.stack : e));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
