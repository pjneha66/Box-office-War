/* Rebuild TV module harness: loads game/data.js + game/engine.js + game/tv.js in a VM
   sandbox (stubbed localStorage + minimal ui.js helpers), then drives 60 advanceWeek()
   calls while exercising every TV system through the real functions — launch, license,
   exclusive, series produce/air/renew/end-rejection, live launch/refresh/decay,
   syndication package tiers (gate boundaries, advance/royalty multiples, one-deal
   exclusivity, per-tier royalty tails), two-tap shutdown — including one
   insufficient-cash rejection. Prints one line per check; exits non-zero on failure.
   Usage: node test/rebuild-tv.mjs */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (detail ? " — " + detail : ""));
  if (!ok) failures++;
}

const elx = (attrs) => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null) });

function makeRun() {
  const mem = {};
  const toasts = [];
  const sheets = [];
  const baseCalls = [];
  const ctx = {
    console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array,
    setTimeout: (fn) => { fn(); }, // fire tv.js's deferred onAction wiring immediately
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    },
    // ui.js is not loaded in this sandbox — provide the tiny helpers tv.js renders with
    tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
    statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
    openSheet: (html) => { sheets.push(html); },
    rerenderSheet: (html) => { sheets.push(html); },
    closeSheet: () => {},
    render: () => {},
    pushToast: (txt, kind) => { toasts.push({ txt: String(txt), kind: kind || "" }); },
    onAction: (a) => { baseCalls.push(a); } // fake ui base to verify the wiring wrap
  };
  const sandbox = vm.createContext(ctx);
  for (const f of ["data.js", "engine.js", "tv.js"]) {
    vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), sandbox, { filename: f });
  }
  return { ctx, toasts, sheets, baseCalls };
}

const { ctx, toasts, baseCalls } = makeRun();
ctx.newGame("TV Test Studios", "veteran");
const S = () => ctx.S;

/* ── week 1, before any tick ──────────────────────────────────── */
check("streamer launch", ctx.tvAction("tv-launch-streamer", elx({})) === true && !!S().tv.streamer);
check("streamer state", S().tv.streamer.name === "TV Test Studios TV" && S().tv.streamer.subs === 0.4 && S().tv.streamer.licensed === 0);

const cashBeforeRej = S().studio.cash; // $20M left after the $60M launch
const rejHandled = ctx.tvAction("tv-exclusive", elx({})) === true;
const rejToasts = toasts.filter((t) => /Need/.test(t.txt)).length;
check("insufficient-cash rejection (exclusive @ $20M cash)",
  rejHandled && S().studio.cash === cashBeforeRej && S().tv.streamer.exclusives === 0 && rejToasts > 0,
  "toasts=" + rejToasts);

S().studio.cash += 150; // harness stipend so all systems can run for 60 weeks

ctx.tvAction("tv-series-genre", elx({ "data-key": "scifi" }));
ctx.tvAction("tv-series-tier", elx({ "data-idx": "0" }));
check("series greenlight (chips → tier $20M)", ctx.tvAction("tv-series-confirm", elx({})) === true && S().tv.series.length === 1 && S().tv.series[0].genre === "scifi");

check("live launch (default 4 blocks)", ctx.tvAction("tv-live-confirm", elx({})) === true && !!S().tv.live && S().tv.live.audience === 1);

/* wiring wrap: tv- actions are intercepted, others fall through to the ui base */
ctx.onAction("nav", elx({ "data-view": "studio" }));
check("onAction wiring (tv- intercepted, nav falls through)", baseCalls.join(",") === "nav");

/* ── tier gates & package table (direct against the real helpers) ─ */
function gateOf(ww, crit, id) {
  const t = ctx.TV_SYND_TIERS.find((x) => x.id === id);
  return ctx.tvSyndQualifies({ ww, criticAvg: crit }, t);
}
check("gate helper: PRIMETIME at ww 80 or critic 70, fails 79/69",
  gateOf(80, 0, "PRIMETIME") && gateOf(0, 70, "PRIMETIME") && !gateOf(79, 69, "PRIMETIME"));
check("gate helper: MATINEE at ww 25 or critic 50, fails 24/49",
  gateOf(25, 0, "MATINEE") && gateOf(0, 50, "MATINEE") && !gateOf(24, 49, "MATINEE"));
check("gate helper: CABLE-CULT at ww 5 or critic 30, fails 4/29",
  gateOf(5, 0, "CABLE-CULT") && gateOf(0, 30, "CABLE-CULT") && !gateOf(4, 29, "CABLE-CULT"));
check("tier table: 52/26/12 wks, advance ×1.6/1.0/0.6, royalty ×1.3/1.0/0.8", (() => {
  const g = (id) => ctx.TV_SYND_TIERS.find((x) => x.id === id);
  return ctx.TV_SYND_TIERS.length === 3 && g("PRIMETIME").wks === 52 && g("PRIMETIME").advMult === 1.6 && g("PRIMETIME").royMult === 1.3
    && g("MATINEE").wks === 26 && g("MATINEE").advMult === 1 && g("MATINEE").royMult === 1
    && g("CABLE-CULT").wks === 12 && g("CABLE-CULT").advMult === 0.6 && g("CABLE-CULT").royMult === 0.8;
})());

/* ── scripted weeks ───────────────────────────────────────────── */
const renewedIds = new Set();
let sawSeriesBurn = false, sawSeriesEarn = false, sawLiveAd = false, sawSyndEarn = false, sawUpkeep = false, sawStreamerEarn = false;
let maxEps = 0, renewedSeen = false, minAud = 1, refreshRaised = false, maxOffers = 0;
let declinedOnce = false, licensedOk = false, exclusiveOk = false, offerSeen = false;
let slateRejOk = false, allFinite = true, threw = null, stipends = 0;
let lastSeasonQuality = null;
let seeded = 0;

/* syndication tracking — films seeded at different ww/rating levels */
let primeId = null, matOnlyId = null, matDealId = null, cableOnlyId = null, noOfferId = null;
let primeTermsOk = false, matTermsOk = false, cabTermsOk = false, expiresOk = false;
let matOnlyGateOk = false, matDealGateOk = false, cableGateOk = false, noOfferGateOk = true;
let siblingCleanupOk = false, contractedRegenOk = true, staleAcceptRejected = false;
let regenAfterDecline = false, cable2Ok = false, cableDealOk = false, matDealOk = false;
const tailPaid = {};

function seedFilm(title, ww, crit) {
  const s = S();
  s.films.unshift({
    id: "f" + (s.seq++), title, genre: "comedy", scale: "indie", budget: 16, mkt: 8, cost: 30,
    quality: 62, criticAvg: crit == null ? 60 : crit, freshPct: 60, aud: 62, quotes: [], opening: 15, legs: 2.2, decay: 0.55,
    weeksOut: 10, dom: Math.round(ww / 1.6), weekly: [], releaseWeek: s.studio.week - 10,
    season: "Summer season", franchiseOf: null, status: "done", intl: Math.round(ww * 0.375), ww: ww, profit: 12
  });
  seeded++;
  return s.films[0].id;
}

function botFilms() {
  const s = S();
  s.projects.forEach((p) => { if (p.phase === "ready" && p.releaseWeek == null) ctx.setRelease(p, s.studio.week + 1, 2); });
  if (s.projects.filter((p) => p.releaseWeek == null).length >= 1 || s.studio.cash < 30) return;
  const ideas = s.ideas.slice().sort((a, b) => b.script - a.script);
  const idea = ideas[0];
  if (!idea) return;
  const dir = s.market.filter((t) => t.k === "dir" && !ctx.talentBusy(t)).sort((a, b) => b.skill - a.skill)[0];
  const act = s.market.filter((t) => t.k === "actor" && !ctx.talentBusy(t)).sort((a, b) => b.skill - a.skill)[0];
  if (!dir || !act) return;
  ctx.greenlight(idea.id, { scale: "indie", bIdx: 1, dirId: dir.id, actorId: act.id, mktIdx: 2 });
}

for (let i = 0; i < 60; i++) {
  const s = S();
  const w = s.studio.week;
  if (s.studio.cash < 40) { s.studio.cash += 150; stipends++; }
  botFilms();

  if (w === 8) {
    ctx.tvAction("tv-series-genre", elx({ "data-key": "drama" }));
    ctx.tvAction("tv-series-tier", elx({ "data-idx": "1" }));
    ctx.tvAction("tv-series-confirm", elx({}));
  }
  if (w === 20) {
    ctx.tvAction("tv-series-genre", elx({ "data-key": "comedy" }));
    ctx.tvAction("tv-series-tier", elx({ "data-idx": "2" }));
    ctx.tvAction("tv-series-confirm", elx({}));
  }
  if (w === 22) { // slate is full → greenlight must be rejected
    const toastsBefore = toasts.length;
    ctx.tvAction("tv-series-genre", elx({ "data-key": "horror" }));
    const handled = ctx.tvAction("tv-series-confirm", elx({})) === true;
    slateRejOk = handled && s.tv.series.length === 3 && toasts.length > toastsBefore;
  }
  s.tv.series.forEach((sn) => {
    if (sn.phase === "renew" && !renewedIds.has(sn.id)) {
      if (ctx.tvAction("tv-series-renew", elx({ "data-id": sn.id }))) renewedIds.add(sn.id);
    }
  });
  if (s.tv.live && w % 6 === 0 && s.studio.cash >= 4) {
    const before = s.tv.live.audience;
    ctx.tvAction("tv-live-refresh", elx({}));
    if (s.tv.live.audience > before) refreshRaised = true;
  }
  if (s.tv.streamer) {
    const lp = ctx.tvLicensePick();
    if (lp && s.tv.streamer.licensed < 2 && s.studio.cash >= lp.cost) licensedOk = ctx.tvAction("tv-license", elx({})) || licensedOk;
    if (w >= 28 && s.tv.streamer.exclusives === 0 && s.studio.cash >= 25) exclusiveOk = ctx.tvAction("tv-exclusive", elx({})) || exclusiveOk;
  }

  /* ── syndication packages ──────────────────────────────────── */
  const sy = s.tv.synd;
  if (sy.offers.length) offerSeen = true;
  if (w === 2) primeId = seedFilm("Prime Package", 95, 55);      // clears every gate via ww
  if (w === 4) matOnlyId = seedFilm("Matinee Only", 30, 20);     // ww gate: Matinee + Cable only
  if (w === 6) matDealId = seedFilm("Matinee Deal", 40, 30);     // ww gate: Matinee + Cable only
  if (w === 8) cableOnlyId = seedFilm("Cable Only", 8, 12);      // Cable cult only
  if (w === 9) noOfferId = seedFilm("No Offer", 3, 10);          // below every gate

  if (w === 3 && primeId) { // terms check, then accept PRIMETIME (siblings must clear)
    const mine = sy.offers.filter((o) => o.filmId === primeId);
    const pm = mine.find((o) => o.tier === "PRIMETIME");
    const mt = mine.find((o) => o.tier === "MATINEE");
    const cb = mine.find((o) => o.tier === "CABLE-CULT");
    if (pm && mt && cb) {
      const f = s.films.find((x) => x.id === primeId);
      const baseAdv = Math.round(f.ww * 0.03), baseRoy = Math.round(f.ww * 0.001 * 100) / 100;
      matTermsOk = mt.advance === baseAdv && mt.royalty === baseRoy && mt.wks === 26;
      primeTermsOk = pm.advance === Math.round(baseAdv * 1.6) && pm.royalty === Math.round(baseRoy * 1.3 * 100) / 100 && pm.wks === 52;
      cabTermsOk = cb.advance === Math.round(baseAdv * 0.6) && cb.royalty === Math.round(baseRoy * 0.8 * 100) / 100 && cb.wks === 12;
      expiresOk = pm.expires === w + 4 && mt.expires === w + 4 && cb.expires === w + 4;
      siblingCleanupOk = ctx.tvAction("tv-synd-accept", elx({ "data-id": pm.id })) === true
        && sy.deals.some((d) => d.filmId === primeId && d.tier === "PRIMETIME" && d.until === w + 52 && d.weekly === pm.royalty)
        && sy.offers.every((o) => o.filmId !== primeId);
    }
  }
  if (w === 5 && matOnlyId) { // accept CABLE-CULT (12-wk tail); no PRIMETIME offer may exist
    const mine = sy.offers.filter((o) => o.filmId === matOnlyId);
    const cb = mine.find((o) => o.tier === "CABLE-CULT");
    matOnlyGateOk = mine.length === 2 && !!cb && !mine.some((o) => o.tier === "PRIMETIME");
    if (cb && ctx.tvAction("tv-synd-accept", elx({ "data-id": cb.id })) === true) {
      cableDealOk = sy.deals.some((d) => d.filmId === matOnlyId && d.tier === "CABLE-CULT" && d.until === w + 12);
    }
  }
  if (w === 7 && matDealId) { // accept MATINEE (26-wk tail); no PRIMETIME offer may exist
    const mine = sy.offers.filter((o) => o.filmId === matDealId);
    const mt = mine.find((o) => o.tier === "MATINEE");
    matDealGateOk = mine.length === 2 && !!mt && !mine.some((o) => o.tier === "PRIMETIME");
    if (mt && ctx.tvAction("tv-synd-accept", elx({ "data-id": mt.id })) === true) {
      matDealOk = sy.deals.some((d) => d.filmId === matDealId && d.tier === "MATINEE" && d.until === w + 26);
    }
  }
  if (w === 9 && cableOnlyId) { // only Cable cult qualifies → decline it
    const mine = sy.offers.filter((o) => o.filmId === cableOnlyId);
    cableGateOk = mine.length === 1 && !!mine[0] && mine[0].tier === "CABLE-CULT";
    if (mine[0]) declinedOnce = ctx.tvAction("tv-synd-decline", elx({ "data-id": mine[0].id })) === true;
  }
  if (w === 10 && cableOnlyId) { // declined offer re-opens next tick → accept it
    const back = sy.offers.find((o) => o.filmId === cableOnlyId && o.tier === "CABLE-CULT");
    if (back && ctx.tvAction("tv-synd-accept", elx({ "data-id": back.id })) === true) cable2Ok = true;
    regenAfterDecline = cable2Ok;
  }
  if (w === 12 && primeId) { // stale offer for a contracted film must be withdrawn, not re-dealt
    const fake = { id: "tv" + (s.seq++), filmId: primeId, title: "Prime Package", tier: "MATINEE", advance: 1, royalty: 0.01, wks: 26, expires: w + 4 };
    sy.offers.push(fake);
    const dealsBefore = sy.deals.filter((d) => d.filmId === primeId).length;
    const toastsBefore = toasts.length;
    staleAcceptRejected = ctx.tvAction("tv-synd-accept", elx({ "data-id": fake.id })) === true /* handled, but rejected */
      && toasts.length > toastsBefore && /already under a syndication deal/.test(toasts[toasts.length - 1].txt)
      && sy.deals.filter((d) => d.filmId === primeId).length === dealsBefore
      && !sy.offers.some((o) => o.id === fake.id);
  }

  try {
    ctx.advanceWeek();
  } catch (e) {
    threw = e;
    break;
  }

  const s2 = S();
  if (!isFinite(s2.studio.cash)) allFinite = false;
  const txs = s2.txHistory || [];
  txs.forEach((tx) => {
    tx.rows.forEach((r) => {
      if (r.k.indexOf("Series · ") === 0) { if (r.v < 0) sawSeriesBurn = true; else sawSeriesEarn = true; }
      if (r.k === "Live TV · ad revenue") sawLiveAd = true;
      if (r.k.indexOf("Syndication · ") === 0 && r.v > 0) sawSyndEarn = true;
      if (r.k.indexOf("Streamer upkeep") === 0) sawUpkeep = true;
      if (r.k.indexOf("Streamer · ") === 0) sawStreamerEarn = true;
    });
  });
  s2.tv.series.forEach((sn) => {
    maxEps = Math.max(maxEps, sn.eps);
    if (sn.season >= 2) { renewedSeen = true; lastSeasonQuality = sn.quality; }
  });
  if (s2.tv.live) minAud = Math.min(minAud, s2.tv.live.audience);
  if (s2.tv.synd) {
    maxOffers = Math.max(maxOffers, s2.tv.synd.offers.length);
    s2.tv.synd.deals.forEach((d) => { // one-deal exclusivity: contracted films get no offers
      if (s2.tv.synd.offers.some((o) => o.filmId === d.filmId)) contractedRegenOk = false;
    });
    if (noOfferId && s2.tv.synd.offers.some((o) => o.filmId === noOfferId)) noOfferGateOk = false;
    /* count this week's royalty rows per title (txHistory is capped, count as they land) */
    if (txs[0]) ["Prime Package", "Matinee Deal", "Matinee Only", "Cable Only"].forEach((ti) => {
      if (txs[0].rows.some((r) => r.k === "Syndication · " + ti)) tailPaid[ti] = (tailPaid[ti] || 0) + 1;
    });
  }
}

const st = S();
check("60 advanceWeek calls without a throw", !threw, threw ? String(threw.stack || threw).slice(0, 160) : "");
check("cash finite every week", allFinite, "stipends=" + stipends);
check("tickTV ran via advanceWeek wrap", st.tv.lastTick === st.studio.week, "lastTick=" + st.tv.lastTick + " week=" + st.studio.week);
check("S.tv namespace complete", !!st.tv && Array.isArray(st.tv.series) && !!st.tv.synd
  && Array.isArray(st.tv.synd.offers) && Array.isArray(st.tv.synd.deals) && Array.isArray(st.tv.synd.archived));

check("streamer upkeep booked weekly", sawUpkeep);
check("streamer subscription income booked", sawStreamerEarn);
check("library title licensed", licensedOk && st.tv.streamer && st.tv.streamer.licensed >= 1, "licensed=" + (st.tv.streamer ? st.tv.streamer.licensed : "closed"));
check("exclusive produced (subs jumped)", exclusiveOk && st.tv.streamer && st.tv.streamer.exclusives >= 1 && st.tv.streamer.subs > 0.4,
  "subs=" + (st.tv.streamer ? st.tv.streamer.subs.toFixed(2) + "M" : "closed"));

check("series production burn booked", sawSeriesBurn);
check("series episode earn booked", sawSeriesEarn);
check("series aired a full season (8 eps)", maxEps >= 8, "maxEps=" + maxEps);
check("renewal moved a series to season 2", renewedSeen && lastSeasonQuality != null, "quality=" + lastSeasonQuality);
check("max-3 slate rejection", slateRejOk);

check("live ad revenue booked", sawLiveAd);
check("live audience decayed below 1.0", minAud < 1.0, "min=" + minAud.toFixed(3));
check("live refresh raised audience", refreshRaised);
check("live blocks locked to 4", st.tv.live && Object.keys(st.tv.live.blocks).filter((k) => st.tv.live.blocks[k]).length === 4);

check("syndication offers created", offerSeen && maxOffers >= 1, "maxOpen=" + maxOffers);
check("offers capped at 6", maxOffers <= 6);
check("syndication income booked to the ledger", sawSyndEarn);
check("offer declined recorded", declinedOnce);
check("MATINEE offer = base terms (advance 3% ww, royalty 0.1% ww, 26 wks)", matTermsOk);
check("PRIMETIME offer = advance ×1.6, royalty ×1.3, 52 wks", primeTermsOk);
check("CABLE-CULT offer = advance ×0.6, royalty ×0.8, 12 wks", cabTermsOk);
check("offers expire 4 weeks out", expiresOk);
check("gate: ww30/crit20 film draws Matinee + Cable cult, never Primetime", matOnlyGateOk);
check("gate: ww40/crit30 film draws Matinee + Cable cult, never Primetime", matDealGateOk);
check("gate: ww8/crit12 film draws only Cable cult", cableGateOk);
check("gate: ww3/crit10 film never draws an offer", noOfferGateOk);
check("accepting PRIMETIME records deal until acceptWeek+52 and pulls sibling-tier offers", siblingCleanupOk);
check("accepting MATINEE records deal until acceptWeek+26", matDealOk);
check("accepting CABLE-CULT records deal until acceptWeek+12", cableDealOk);
check("contracted films receive no new offers while their deal runs", contractedRegenOk);
check("stale offer for a contracted film is withdrawn, not double-dealt", staleAcceptRejected);
check("declined offer re-opens on the next tick", regenAfterDecline);

function archOf(title, tier) {
  return st.tv.synd.archived.some((d) => d.title === title && d.tier === tier);
}
check("PRIMETIME tail: 52 weekly royalties, then archived with tier",
  tailPaid["Prime Package"] === 52 && archOf("Prime Package", "PRIMETIME") && !st.tv.synd.deals.some((d) => d.title === "Prime Package"),
  "paid=" + tailPaid["Prime Package"]);
check("MATINEE tail: 26 weekly royalties, then archived with tier",
  tailPaid["Matinee Deal"] === 26 && archOf("Matinee Deal", "MATINEE"),
  "paid=" + tailPaid["Matinee Deal"]);
check("CABLE-CULT tails: 12 weekly royalties each, archived with tier",
  tailPaid["Matinee Only"] === 12 && tailPaid["Cable Only"] === 12 && archOf("Matinee Only", "CABLE-CULT") && archOf("Cable Only", "CABLE-CULT"),
  "paid=" + tailPaid["Matinee Only"] + "/" + tailPaid["Cable Only"]);

/* ── desks ────────────────────────────────────────────────────── */
const desks = ctx.TV_DESKS;
check("TV_DESKS: 4 entries, contract shape",
  Array.isArray(desks) && desks.length === 4 && desks.every((d) => d.id && d.group === "TV & Streaming" && d.icon && d.name && d.desc && typeof d.render === "function"));
let deskOk = true, deskBad = "";
desks.forEach((d) => {
  const h = d.render();
  if (typeof h !== "string" || h.indexOf("data-tvdesk") < 0 || /NaN|undefined/.test(h)) { deskOk = false; deskBad = d.id; }
});
check("desk HTML renders clean (marker, no NaN/undefined)", deskOk, deskBad);
check("streamer desk shows live stats", desks[0].render().indexOf("Subscribers") >= 0);
check("series desk shows greenlight picker", desks[1].render().indexOf("Greenlight a series") >= 0);
check("live desk shows audience", desks[2].render().indexOf("Audience") >= 0);
const syndHtml = desks[3].render();
check("synd desk shows offers, library, or empty state",
  syndHtml.indexOf("Syndicated library") >= 0 || syndHtml.indexOf("No offers") >= 0 || syndHtml.indexOf("Advance (now)") >= 0);
check("synd desk shows all three tiers with gates",
  ["Primetime", "Matinee", "Cable cult", "critics ≥ 70", "critics ≥ 50", "critics ≥ 30"].every((s) => syndHtml.indexOf(s) >= 0));
check("synd desk shows deal progress (wk left / run complete)",
  syndHtml.indexOf("wk left") >= 0 || syndHtml.indexOf("run complete") >= 0);

/* ── two-tap shutdown (after all income checks) ───────────────── */
check("shutdown first tap only arms pending flag",
  ctx.tvAction("tv-shutdown", elx({})) === true && !!st.tv.streamer && st.tv.streamer.pendingClose === true);
const cashBeforeDown = st.studio.cash;
check("shutdown second tap executes",
  ctx.tvAction("tv-shutdown", elx({})) === true && st.tv.streamer === null);
check("shutdown stops upkeep", (() => { ctx.advanceWeek(); const tx = S().txHistory[0]; return !tx || !tx.rows.some((r) => r.k.indexOf("Streamer upkeep") === 0); })(), "cash=" + fmSafe(S().studio.cash) + " (was " + cashBeforeDown.toFixed(1) + ")");

function fmSafe(x) { return isFinite(x) ? String(Math.round(x)) : "NaN"; }

console.log("\n" + (failures ? "FAILURES: " + failures : "ALL CHECKS PASSED") + " · week " + S().studio.week + " · cash " + fmSafe(S().studio.cash) + "M · seeded films=" + seeded);
process.exit(failures ? 1 : 0);
