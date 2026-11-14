/* Box Office War — rebuilt. Business & Industry module (biz).
   Bonds & credit rating · board mandates · tiered production insurance ·
   shooting locations · theater chains · territory pre-sales (MG / rev-share,
   region fit, terms, localization) · espionage (passive + active missions) ·
   industry programs · ESG pledges · studio imprints · stock readout ·
   film restoration.
   All state lives under S.biz (lazy ensure). Hooks the engine may call:
   bizOpenMult / bizQualityBonus / bizIntlBonus / bizLocationMods /
   espAnnounceWindow / presaleShare / imprintOpeningMult / imprintCriticBonus /
   espionageSuppression. */
"use strict";

/* ── state (lazy ensure — old saves have no S.biz) ────────────── */
function ensure() {
  if (!S) return;
  if (!S.biz) S.biz = {};
  var b = S.biz;
  if (!b.bonds) b.bonds = [];
  if (!b.board) b.board = { conf: 60, mandate: null, due: 0 };
  if (b.board.conf == null) b.board.conf = 60;
  if (b.board.due == null) b.board.due = 0;
  if (b.board.offer === undefined) b.board.offer = null;
  if (!b.insurance) b.insurance = [];
  if (!b.insTiers) b.insTiers = {};
  if (!b.insTitles) b.insTitles = {};
  if (!b.locations) b.locations = [];
  if (!b.chains) b.chains = { rel: 50, imax: false, eventWk: 0 };
  if (b.chains.rel == null) b.chains.rel = 50;
  if (b.chains.imax == null) b.chains.imax = false;
  if (b.chains.eventWk == null) b.chains.eventWk = 0;
  if (!b.presales) b.presales = [];
  if (!b.presaleCfg) b.presaleCfg = {};
  if (!b.esp) b.esp = { level: 0, lastIntel: 0 };
  if (b.esp.level == null) b.esp.level = 0;
  if (b.esp.lastIntel == null) b.esp.lastIntel = 0;
  if (!b.esp.intel) b.esp.intel = {};
  if (!b.esp.suppressed) b.esp.suppressed = {};
  if (!b.programs) b.programs = { esg: false, press: false, loc: false, label: false };
  if (!b.esgPledge) b.esgPledge = null;
  if (!b.imprints) b.imprints = { owned: {}, active: null };
  if (!b.stock) b.stock = { last: 10 };
  if (b.stock.last == null) b.stock.last = 10;
  if (!b.restored) b.restored = [];
  if (!b.esgQueue) b.esgQueue = [];
}

/* ── engine hooks ─────────────────────────────────────────────── */
function bizOpenMult(p) {
  if (!S) return 1;
  ensure();
  var m = 0.96 + S.biz.chains.rel / 400;
  if (S.biz.chains.imax && p && ["action", "scifi", "fantasy"].indexOf(p.genre) >= 0) m *= 1.06;
  return m;
}
function bizQualityBonus(p) {
  if (!S) return 0;
  ensure();
  var g = p ? p.genre : "", q = 0;
  if (S.biz.programs.label && (g === "drama" || g === "crime" || g === "docs")) q += 3;
  return q + imprintCriticBonus(p);
}
function bizIntlBonus() { if (!S) return 0; ensure(); return S.biz.programs.loc ? 0.03 : 0; }
function bizLocationMods(p) {
  if (!S || !p || !p.location) return null;
  ensure();
  for (var i = 0; i < BIZ_LOCS.length; i++) {
    if (BIZ_LOCS[i].id === p.location) {
      var L = BIZ_LOCS[i], m = { craft: L.craft, costMult: L.costMult, rebate: L.rebate || 0 };
      if (L.intlBonus) m.intlBonus = L.intlBonus;
      if (L.rebateCap != null) m.rebateCap = L.rebateCap;
      return m;
    }
  }
  return null;
}
function espAnnounceWindow() { if (!S) return 8; ensure(); return 8 + 3 * S.biz.esp.level; }
function presaleShare(film) { return film && film.presale ? film.presale : 0; }

/* ── studio imprints (one active at a time) ───────────────────── */
var BIZ_IMPRINTS = [
  { key: "prestige", name: "Prestige Classics", cost: 30, desc: "+4 critics on drama, crime and docs" },
  { key: "genre",    name: "Genre Label",       cost: 25, desc: "+3.5% opening on horror, thriller, action, scifi" },
  { key: "family",   name: "Family Tree",       cost: 20, desc: "+2.5% opening on every release" }
];
function imprintOpeningMult(p) {
  if (!S || !p) return 1;
  ensure();
  var a = S.biz.imprints.active;
  if (a === "genre" && ["horror", "thriller", "action", "scifi"].indexOf(p.genre) >= 0) return 1.035;
  if (a === "family") return 1.025;
  return 1;
}
function imprintCriticBonus(p) {
  if (!S || !p) return 0;
  ensure();
  if (S.biz.imprints.active !== "prestige") return 0;
  return ["drama", "crime", "docs"].indexOf(p.genre) >= 0 ? 4 : 0;
}
function bizBuyImprint(key) {
  ensure();
  var i, def = null;
  for (i = 0; i < BIZ_IMPRINTS.length; i++) if (BIZ_IMPRINTS[i].key === key) def = BIZ_IMPRINTS[i];
  if (!def) return false;
  var im = S.biz.imprints;
  if (im.owned[key] && im.active === key) { toast(def.name + " is already the active imprint.", ""); return false; }
  /* owning is one-time; pointing the active imprint at a different label costs the $5M switch */
  var cost = (im.owned[key] ? 0 : def.cost) + (im.active && im.active !== key ? 5 : 0);
  if (S.studio.cash < cost) { toast("Need " + fm(cost) + " for " + def.name + ".", "bad"); return false; }
  spend(cost, "Imprint · " + def.name);
  im.owned[key] = true;
  im.active = key;
  log(def.name + " is now the active imprint — " + def.desc + ".", "good", "🏷️");
  return true;
}

/* ── credit & bonds ───────────────────────────────────────────── */
var BIZ_RATINGS = [
  { min: 80, name: "AAA", cap: 120, rate: 0.003 },
  { min: 65, name: "AA",  cap: 90,  rate: 0.004 },
  { min: 50, name: "A",   cap: 70,  rate: 0.005 },
  { min: 35, name: "BBB", cap: 50,  rate: 0.006 },
  { min: 20, name: "BB",  cap: 30,  rate: 0.008 },
  { min: 8,  name: "B",   cap: 15,  rate: 0.010 },
  { min: 0,  name: "CCC", cap: 0,   rate: 0.012 }
];
function bizDebtTotal() {
  var d = 0, i;
  for (i = 0; i < S.loans.length; i++) d += S.loans[i].amt;
  ensure();
  for (i = 0; i < S.biz.bonds.length; i++) d += S.biz.bonds[i].amt;
  return d;
}
function bizScore() { return S.studio.rep * 0.5 + (S.studio.cash > 0 ? 10 : -20) + (bizDebtTotal() < 100 ? 10 : 0); }
function bizRating() {
  var s = bizScore(), i;
  for (i = 0; i < BIZ_RATINGS.length; i++) if (s >= BIZ_RATINGS[i].min) return BIZ_RATINGS[i];
  return BIZ_RATINGS[BIZ_RATINGS.length - 1];
}
function bizBondsOutstanding() {
  ensure();
  var d = 0, i;
  for (i = 0; i < S.biz.bonds.length; i++) d += S.biz.bonds[i].amt;
  return d;
}
function bizBondInterest() {
  ensure();
  var raw = 0, i;
  for (i = 0; i < S.biz.bonds.length; i++) raw += S.biz.bonds[i].amt * S.biz.bonds[i].rate;
  if (raw > 0) spend(raw, "Bond interest");
  return raw;
}
function bizIssueBond() {
  ensure();
  var r = bizRating();
  if (r.cap < 10) { toast("Rating " + r.name + " — the market will not take your paper.", "bad"); return false; }
  if (bizBondsOutstanding() + 10 > r.cap) { toast("Bond cap " + fm(r.cap) + "M reached at rating " + r.name + ".", "bad"); return false; }
  S.biz.bonds.push({ amt: 10, rate: r.rate });
  earn(10, "Bonds issued");
  log("Issued " + fm(10) + " of studio bonds at " + (r.rate * 100).toFixed(1) + "%/wk (rating " + r.name + ").", "", "🏦");
  return true;
}
function bizRepayBond() {
  ensure();
  if (!S.biz.bonds.length) { toast("No bonds outstanding.", ""); return false; }
  var b = S.biz.bonds[0];
  if (S.studio.cash < b.amt) { toast("Need " + fm(b.amt) + " free to repay the oldest bond.", "bad"); return false; }
  S.biz.bonds.shift();
  spend(b.amt, "Bond repayment");
  log("Repaid " + fm(b.amt) + " of bonds. The credit desk breathes easier.", "good", "🏦");
  return true;
}

/* ── board mandates ───────────────────────────────────────────── */
function bizMandateFor(kind) {
  if (kind === "rep") { var x = Math.round(S.studio.rep + 8); return { kind: "rep", txt: "Grow reputation to " + x, target: x }; }
  if (kind === "cash") return { kind: "cash", txt: "Bank +$40M cash", target: Math.round((S.studio.cash + 40) * 10) / 10 };
  if (kind === "sequel") return { kind: "sequel", txt: "Release a sequel", target: 1 };
  return { kind: "release", txt: "Release a film this quarter", target: 1 };
}
function bizMandateMet(m) {
  var i, n;
  if (m.kind === "rep") return S.studio.rep >= m.target;
  if (m.kind === "cash") return S.studio.cash >= m.target;
  if (m.kind === "sequel") {
    for (i = 0; i < S.films.length; i++) if (S.films[i].franchiseOf && S.films[i].releaseWeek > m.from) return true;
    return false;
  }
  n = 0;
  for (i = 0; i < S.films.length; i++) if (S.films[i].releaseWeek > m.from) n++;
  return n >= m.target;
}
function bizBoardTick() {
  ensure();
  var b = S.biz.board, woy = woyOf(S.studio.week);
  if ((woy === 13 || woy === 26 || woy === 39 || woy === 52) && !b.mandate && !(b.offer && b.offer.length)) {
    var kinds = ["release", "rep", "cash", "sequel"], offer = [];
    while (offer.length < 3) offer.push({ kind: kinds.splice(Math.floor(Math.random() * kinds.length), 1)[0] });
    b.offer = offer;
    log("The board convenes for its quarterly review — three mandates on the table.", "", "🏛️");
    if (b.conf >= 85) { earn(5, "Board confidence bonus"); log("Strong board confidence pays a quarterly bonus.", "gold", "🏛️"); }
  }
  b.conf = clamp(b.conf - 0.5, 5, 100);
  if (b.mandate && S.studio.week >= b.mandate.due) {
    var m = b.mandate;
    if (bizMandateMet(m)) {
      b.conf = clamp(b.conf + 12, 5, 100);
      earn(8, "Board mandate bonus");
      log("Board mandate met — " + m.txt + ". Confidence rises.", "good", "🏛️");
    } else {
      b.conf = clamp(b.conf - 12, 5, 100);
      log("Board mandate missed — " + m.txt + ". Confidence falls.", "bad", "🏛️");
    }
    b.mandate = null;
  }
  if (b.conf < 25) {
    spend(0.15, "Board austerity");
    if (!b.aust) { b.aust = true; log("Confidence is rock-bottom — the board imposes austerity (-$0.2M/wk).", "bad", "🏛️"); }
  } else b.aust = false;
}
function bizPickMandate(idx) {
  ensure();
  var b = S.biz.board;
  if (!b.offer || !b.offer.length || b.mandate) { toast("No mandate offer to accept.", ""); return false; }
  if (!(idx >= 0) || idx >= b.offer.length) return false;
  var m = bizMandateFor(b.offer[idx].kind);
  m.from = S.studio.week;
  m.due = S.studio.week + 13;
  b.mandate = m;
  b.offer = null;
  log("The board sets a mandate: " + m.txt + " (13 weeks).", "", "🏛️");
  return true;
}

/* ── production insurance (tiered) ────────────────────────────── */
var BIZ_INS_TIERS = [
  { id: "basic",   name: "Basic",     rate: 0.025, desc: "85% of overrun costs back at wrap" },
  { id: "keystar", name: "KeyStar",   rate: 0.035, desc: "scandals handled free by the insurer" },
  { id: "full",    name: "Full bond", rate: 0.05,  desc: "flop claim raised to 40% of cost" }
];
function bizInsTierDef(tier) {
  for (var i = 0; i < BIZ_INS_TIERS.length; i++) if (BIZ_INS_TIERS[i].id === tier) return BIZ_INS_TIERS[i];
  return null;
}
function bizInsure(pid, tier) {
  ensure();
  var p = findProject(pid), T = bizInsTierDef(tier);
  if (!p || !T) { toast("Pick a production and a policy tier.", "bad"); return false; }
  if (p.insured || ["pre", "shoot", "post"].indexOf(p.phase) < 0) { toast("That production cannot be insured.", "bad"); return false; }
  var prem = Math.round(p.budget * T.rate * 10) / 10;
  if (S.studio.cash < prem) { toast("Need " + fm(prem) + " free for the premium.", "bad"); return false; }
  spend(prem, "Insurance · " + p.title);
  p.insured = true;
  p.insTier = T.id;
  S.biz.insurance.push(p.id);
  S.biz.insTiers[p.id] = T.id;
  S.biz.insTitles[p.id] = p.title;
  log(p.title + " is insured (" + T.name + " " + T.rate * 100 + "% premium " + fm(prem) + ") — " + T.desc + ".", "", "🛡️");
  return true;
}
/* Overrun refund at wrap: each overrun added budget×1.5% during the shoot
   (engine.js). Tiers refund 85% of that at wrap; legacy policies (old saves,
   flat 4% premium, no tier) refund 50%. */
function bizInsWrapTick() {
  ensure();
  var i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.phase !== "ready" || !p.insured || p.claimed || !(p.overrun > 0)) continue;
    var rate = (p.insTier === "basic" || p.insTier === "keystar" || p.insTier === "full") ? 0.85 : 0.5;
    var refund = Math.round(p.overrun * p.budget * 0.015 * rate * 10) / 10;
    p.claimed = true;
    if (refund > 0) {
      earn(refund, "Overrun claim · " + p.title);
      log("The insurer pays " + fm(refund) + " on " + Math.round(rate * 100) + "% of “" + p.title + "” overruns.", "good", "🛡️");
    }
  }
}
/* KeyStar tier: scandals on covered productions are handled free, weekly. */
function bizKeystarTick() {
  ensure();
  var i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.insTier !== "keystar" || !p.scandal) continue;
    p.scandal = false;
    if (S.pending && S.pending.type === "scandal" && S.pending.projectId === p.id) S.pending = null;
    log("KeyStar insurer handled the “" + p.title + "” scandal — no fee, no box-office hit.", "good", "🛡️");
  }
}
/* Film→tier resolution: the engine copies only p.insured onto the film, so the
   tier travels via the S.biz.insTiers/insTitles maps keyed by project id. */
function bizFilmTier(f) {
  if (f.bizTier) return f.bizTier;
  var keys = Object.keys(S.biz.insTiers), i;
  for (i = 0; i < keys.length; i++) {
    if (findProject(keys[i])) continue; /* still shooting — not released yet */
    if (S.biz.insTitles[keys[i]] === f.title) {
      f.bizTier = S.biz.insTiers[keys[i]];
      return f.bizTier;
    }
  }
  return null;
}
/* Full bond: engine pays 20% of cost on insured flops (profit < -cost×0.5);
   the full tier tops it up to 40% (the extra 20% differential, paid once). */
function bizInsClaimTick() {
  ensure();
  var i, f;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (!f.insured || f.bizPaid || f.status !== "done") continue;
    if (bizFilmTier(f) !== "full") continue;
    if (!(f.profit < -f.cost * 0.5)) continue;
    var extra = Math.round(f.cost * 0.2 * 10) / 10;
    f.bizPaid = true;
    earn(extra, "Insurance claim · full bond · " + f.title);
    log("The full bond tops up “" + f.title + "” by " + fm(extra) + " (claim raised to 40%).", "good", "🛡️");
  }
}

/* ── locations ────────────────────────────────────────────────── */
var BIZ_LOCS = [
  { id: "london",  name: "London",      craft: 3, costMult: 1.05, rebate: 0 },
  { id: "iceland", name: "Iceland",     craft: 0, costMult: 1,    rebate: 0.2,  rebateCap: 15 },
  { id: "atlanta", name: "Atlanta",     craft: 0, costMult: 0.92, rebate: 0 },
  { id: "tokyo",   name: "Tokyo",       craft: 2, costMult: 1,    intlBonus: 0.05 },
  { id: "nz",      name: "New Zealand", craft: 2, costMult: 1,    rebate: 0.15 }
];
function bizAssignLocation(pid, locId) {
  ensure();
  var p = findProject(pid), i, L = null;
  for (i = 0; i < BIZ_LOCS.length; i++) if (BIZ_LOCS[i].id === locId) L = BIZ_LOCS[i];
  if (!p || !L) { toast("Pick a production and a location.", "bad"); return false; }
  if (["pre", "shoot"].indexOf(p.phase) < 0) { toast("Locations lock before post-production.", "bad"); return false; }
  if (p.location) { toast("That production already has a location.", ""); return false; }
  if (S.studio.cash < 1) { toast("Need " + fm(1) + " for legal fees.", "bad"); return false; }
  spend(1, "Location legal · " + p.title);
  p.location = L.id;
  S.biz.locations.push({ pid: p.id, loc: L.id, week: S.studio.week });
  log(p.title + " moves its shoot to " + L.name + " (legal fees " + fm(1) + ").", "", "🌍");
  return true;
}

/* ── theater chains ───────────────────────────────────────────── */
function bizChainsTick() {
  ensure();
  var c = S.biz.chains;
  if (c.rel > 50) c.rel = Math.max(50, c.rel - 0.5);
}
function bizHostPremiere() {
  ensure();
  var c = S.biz.chains;
  if (c.eventWk && S.studio.week - c.eventWk < 8) { toast("The exhibitors just visited — cooldown " + (8 - (S.studio.week - c.eventWk)) + " wk.", ""); return false; }
  if (S.studio.cash < 2) { toast("Need " + fm(2) + " for a premiere.", "bad"); return false; }
  spend(2, "Exhibitor premiere");
  c.rel = clamp(c.rel + 8, 0, 100);
  c.eventWk = S.studio.week;
  log("Star-studded exhibitor premiere — theater relations +8.", "good", "🎟️");
  return true;
}
function bizImaxDeal() {
  ensure();
  var c = S.biz.chains;
  if (c.imax) { toast("The IMAX deal is already signed.", ""); return false; }
  if (c.rel < 60) { toast("Theater relations must reach 60 first.", "bad"); return false; }
  if (S.studio.cash < 30) { toast("Need " + fm(30) + " for the IMAX deal.", "bad"); return false; }
  spend(30, "IMAX deal");
  c.imax = true;
  log("IMAX deal signed — premium formats book wider openings.", "gold", "🎟️");
  return true;
}

/* ── territory pre-sales (MG + rev-share) ─────────────────────── */
var BIZ_REGIONS = [
  { id: "eu",   name: "Europe", loves: ["drama", "crime"] },
  { id: "apac", name: "APAC",   loves: ["action", "scifi"] },
  { id: "latam", name: "LATAM", loves: ["action", "horror"] },
  { id: "mea",  name: "MEA",    loves: ["comedy", "animation"] }
];
var BIZ_TERMS = [
  { wk: 13,  mult: 0.6 },
  { wk: 26,  mult: 0.8 },
  { wk: 52,  mult: 1.0 },
  { wk: 104, mult: 1.3 }
];
function bizRegionDef(id) {
  for (var i = 0; i < BIZ_REGIONS.length; i++) if (BIZ_REGIONS[i].id === id) return BIZ_REGIONS[i];
  return null;
}
function bizTermMult(wk) {
  for (var i = 0; i < BIZ_TERMS.length; i++) if (BIZ_TERMS[i].wk === wk) return BIZ_TERMS[i].mult;
  return 1;
}
function bizPresaleCfg(pid) {
  ensure();
  if (!S.biz.presaleCfg[pid]) S.biz.presaleCfg[pid] = { term: 52, loc: false };
  return S.biz.presaleCfg[pid];
}
function bizProjectedWW(p) {
  /* bizdeal.js: regional reputation (EU/APAC/CN) lifts presale offers ×0.8–1.2 (avg rep /250) */
  var rm = (typeof dealRegionalMult === "function") ? dealRegionalMult() : 1;
  return scaleOf(p.scale).openBase * genreOf(p.genre).mass * 2.5 * rm;
}
function bizSellPresale(pid, share, type, regionId) {
  ensure();
  var p = findProject(pid);
  if (!p) { toast("Unknown project.", "bad"); return false; }
  if (["shoot", "post", "ready"].indexOf(p.phase) < 0) { toast("Pre-sales open once shooting has started.", "bad"); return false; }
  if (!share || share <= 0) { toast("Pick a share to sell.", "bad"); return false; }
  if (type === "rev") return bizSellRevShare(p, share, regionId);
  /* minimum guarantee (existing deal type) */
  if ((p.presale || 0) + share > 0.25) {
    toast("Only " + Math.round((0.25 - (p.presale || 0)) * 100) + "% of international remains un-sold.", "bad");
    return false;
  }
  var mg = Math.round(bizProjectedWW(p) * genreOf(p.genre).intl * share * 0.35 * 10) / 10;
  earn(mg, "Pre-sales · " + p.title);
  p.presale = (p.presale || 0) + share;
  S.biz.presales.push({ pid: p.id, title: p.title, share: share, mg: mg, week: S.studio.week, type: "mg" });
  log("Pre-sold " + Math.round(share * 100) + "% of " + p.title + " international for " + fm(mg) + " MG.", "good", "🌐");
  return true;
}
/* Revenue share: 20% of the projected intl gross for that share is paid
   upfront, scaled by region genre fit (±30%), rights term and localization;
   the engine claws back revShare×55% of intl rentals at end-of-run. */
function bizSellRevShare(p, share, regionId) {
  var R = bizRegionDef(regionId);
  if (!R) { toast("Pick a territory for the rev-share deal.", "bad"); return false; }
  if (share !== 0.15 && share !== 0.25) { toast("Rev-share deals sell 15% or 25%.", "bad"); return false; }
  if ((p.revShare || 0) + share > 0.25) {
    toast("Only " + Math.round((0.25 - (p.revShare || 0)) * 100) + "% of " + R.name + " remains un-sold.", "bad");
    return false;
  }
  var cfg = bizPresaleCfg(p.id);
  if (cfg.loc && S.studio.cash < 0.8) { toast("Need " + fm(0.8) + " for localization.", "bad"); return false; }
  var fit = R.loves.indexOf(p.genre) >= 0 ? 1.3 : 0.7;
  var up = Math.round(bizProjectedWW(p) * genreOf(p.genre).intl * share * 0.2 * fit * bizTermMult(cfg.term) * (cfg.loc ? 1.25 : 1) * 10) / 10;
  if (cfg.loc) spend(0.8, "Localization · " + p.title);
  earn(up, "Rev-share deal · " + p.title + " · " + R.name);
  p.revShare = (p.revShare || 0) + share;
  S.biz.presales.push({ pid: p.id, title: p.title, share: share, mg: up, week: S.studio.week, type: "rev", region: R.id, term: cfg.term, loc: !!cfg.loc });
  log(R.name + " takes " + Math.round(share * 100) + "% of " + p.title + " for " + fm(up) + " upfront (" + Math.round(fit * 100) + "% fit, " + cfg.term + "-wk term" + (cfg.loc ? ", localized" : "") + ").", "good", "🌐");
  return true;
}
function bizPresaleCfgSet(pid, key, val) {
  ensure();
  var p = findProject(pid);
  if (!p) return false;
  var cfg = bizPresaleCfg(pid);
  if (key === "term") {
    var wk = parseInt(val, 10), valid = false, i;
    for (i = 0; i < BIZ_TERMS.length; i++) if (BIZ_TERMS[i].wk === wk) valid = true;
    if (!valid) return false;
    cfg.term = wk;
  }
  else if (key === "loc") cfg.loc = val === "1" || val === "true";
  else return false;
  return true;
}

/* ── espionage (passive ops + active missions) ────────────────── */
var BIZ_OPS = {
  intel: { name: "Intel",          cost: 0.65, risk: 0.05 },
  leak:  { name: "Counter-PR leak", cost: 1.25, risk: 0.10 },
  sabot: { name: "Script sabotage", cost: 2.50, risk: 0.15 }
};
function bizEspBuild() {
  ensure();
  var e = S.biz.esp, costs = [10, 25, 50];
  if (e.level >= 3) { toast("The espionage desk is fully built.", ""); return false; }
  var cost = costs[e.level];
  if (S.studio.cash < cost) { toast("Need " + fm(cost) + " to expand the espionage desk.", "bad"); return false; }
  spend(cost, "Espionage desk");
  e.level++;
  log("Espionage desk expanded to level " + e.level + " — wider announce window, better odds.", "", "🕵️");
  return true;
}
function bizEspOp(rivalName, op) {
  ensure();
  var O = BIZ_OPS[op], r = null, i;
  if (!O) return false;
  for (i = 0; i < S.rivals.length; i++) if (S.rivals[i].name === rivalName) r = S.rivals[i];
  if (!r) { toast("Unknown rival.", "bad"); return false; }
  if (op === "leak" && S.biz.esp.suppressed[rivalName]) { toast(rivalName + "'s next opening is already suppressed.", ""); return false; }
  if (op === "sabot" && S.biz.esp.deepLeak === rivalName) { toast(rivalName + "'s script is already sabotaged.", ""); return false; }
  if (S.studio.cash < O.cost) { toast("Need " + fm(O.cost) + " for the " + O.name.toLowerCase() + " mission.", "bad"); return false; }
  spend(O.cost, "Espionage · " + O.name + " · " + rivalName);
  if (chance(O.risk)) {
    S.studio.rep = clamp(S.studio.rep - 4, 0, 100);
    log("Espionage: the " + O.name.toLowerCase() + " team was caught at " + rivalName + " — reputation -4.", "bad", "🕵️");
    return true;
  }
  if (op === "intel") {
    var slots = [];
    for (i = 0; i < r.slots.length; i++) if (!r.slots[i].done && r.slots[i].week > S.studio.week) slots.push(r.slots[i]);
    slots.sort(function (a, b) { return a.week - b.week; });
    var top = slots.slice(0, 3), txt = [];
    S.biz.esp.intel[rivalName] = [];
    for (i = 0; i < top.length; i++) {
      S.biz.esp.intel[rivalName].push({ title: top[i].title, week: top[i].week, genre: top[i].genre, quality: top[i].quality });
      txt.push("“" + top[i].title + "” (wk " + top[i].week + ", Q" + top[i].quality + ")");
    }
    log(txt.length ? "Espionage: intel on " + rivalName + " — " + txt.join(", ") + "." : "Espionage: " + rivalName + " has no future slots to scout.", "", "🕵️");
  } else if (op === "sabot") {
    S.biz.esp.deepLeak = rivalName;
    log("Script sabotage planted — " + rivalName + "'s next opening will run 15% soft (one shot).", "good", "🕵️");
  } else {
    S.biz.esp.suppressed[rivalName] = true;
    log("Counter-PR leak seeded — " + rivalName + "'s next opening will run 22% soft (one shot).", "good", "🕵️");
  }
  return true;
}
/* Engine hook: a suppressed rival's next opening runs at ×0.78 — once, then clears. */
function espionageSuppression(rivalName) {
  if (!S) return 1;
  ensure();
  if (S.biz.esp.deepLeak === rivalName) {
    delete S.biz.esp.deepLeak;
    return 0.85;
  }
  if (S.biz.esp.suppressed[rivalName]) {
    delete S.biz.esp.suppressed[rivalName];
    return 0.78;
  }
  return 1;
}
function bizEspTick() {
  ensure();
  var e = S.biz.esp;
  if (e.level <= 0 || !chance(0.03 * e.level)) return;
  if (chance(0.05)) {
    S.studio.rep = clamp(S.studio.rep - 2, 0, 100);
    log("Espionage: operatives caught on a rival's lot — reputation -2.", "bad", "🕵️");
    return;
  }
  e.lastIntel = S.studio.week;
  if (chance(0.5)) {
    var idea = genIdea();
    S.ideas.push(idea);
    log("Espionage: operatives lifted a script — " + idea.title + " lands on your desk.", "gold", "🕵️");
  } else {
    var slots = [], r, i;
    for (r = 0; r < S.rivals.length; r++)
      for (i = 0; i < S.rivals[r].slots.length; i++)
        if (!S.rivals[r].slots[i].done && S.rivals[r].slots[i].week > S.studio.week) slots.push({ riv: S.rivals[r], slot: S.rivals[r].slots[i] });
    if (slots.length) {
      var hit = pick(slots);
      log("Espionage: intel says " + hit.riv.name + " will open " + hit.slot.title + " in week " + woyOf(hit.slot.week) + ".", "", "🕵️");
    } else log("Espionage: agents came back empty-handed this week.", "", "🕵️");
  }
}

/* ── industry programs ────────────────────────────────────────── */
var BIZ_PROGRAMS = [
  { key: "esg",   name: "ESG initiative",    cost: 15, desc: "earn 3% of a film's budget back at release" },
  { key: "press", name: "Press office",      cost: 10, desc: "scheduled projects gain +1 buzz per week" },
  { key: "loc",   name: "Localization wing", cost: 20, desc: "+3% international share on every release" },
  { key: "label", name: "Prestige label",    cost: 25, desc: "+3 quality on drama, crime and docs" }
];
function bizBuyProgram(key) {
  ensure();
  var i, pr = null;
  for (i = 0; i < BIZ_PROGRAMS.length; i++) if (BIZ_PROGRAMS[i].key === key) pr = BIZ_PROGRAMS[i];
  if (!pr) return false;
  if (S.biz.programs[key]) { toast(pr.name + " is already active.", ""); return false; }
  if (S.studio.cash < pr.cost) { toast("Need " + fm(pr.cost) + " for " + pr.name + ".", "bad"); return false; }
  spend(pr.cost, pr.name);
  S.biz.programs[key] = true;
  log(pr.name + " launched — " + pr.desc + ".", "good", "🏭");
  return true;
}
function bizEsgTick() {
  ensure();
  if (!S.biz.programs.esg) return;
  var i, j, p, f;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (!p.esgMarked) {
      p.esgMarked = true;
      S.biz.esgQueue.push({ id: p.id, title: p.title, budget: p.budget });
      if (S.biz.esgQueue.length > 40) S.biz.esgQueue.shift();
    }
  }
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.esgPaid) continue;
    for (j = 0; j < S.biz.esgQueue.length; j++) {
      if (S.biz.esgQueue[j].title === f.title) {
        var reb = Math.round(S.biz.esgQueue[j].budget * 0.03 * 10) / 10;
        f.esgPaid = true;
        S.biz.esgQueue.splice(j, 1);
        earn(reb, "ESG rebate · " + f.title);
        log("ESG initiative: " + f.title + " earns a " + fm(reb) + " green rebate.", "good", "🌱");
        break;
      }
    }
  }
}
function bizPressTick() {
  ensure();
  if (!S.biz.programs.press) return;
  var i;
  for (i = 0; i < S.projects.length; i++)
    if (S.projects[i].releaseWeek != null) S.projects[i].buzz += 1;
}

/* ── ESG pledges (file a catalog-growth target) ───────────────── */
var BIZ_ESG_TARGETS = [25, 45, 65];
function bizFileEsg(target) {
  ensure();
  if (S.biz.esgPledge) { toast("An ESG pledge is already on file.", ""); return false; }
  if (BIZ_ESG_TARGETS.indexOf(target) < 0) { toast("Pick a pledge target of 25, 45 or 65.", "bad"); return false; }
  if (S.studio.cash < 3) { toast("Need " + fm(3) + " for the filing fee.", "bad"); return false; }
  spend(3, "ESG pledge filing");
  S.biz.esgPledge = { target: target, due: S.studio.week + 52, startCatalog: S.studio.catalog, startWeek: S.studio.week };
  log("ESG pledge filed: grow the catalog by " + fm(target * 2) + " within 52 weeks for a " + fm(target * 0.8) + "M grant.", "", "🌱");
  return true;
}
function bizEsgPledgeTick() {
  ensure();
  var pl = S.biz.esgPledge;
  if (!pl || S.studio.week < pl.due) return;
  var growth = S.studio.catalog - pl.startCatalog;
  S.biz.esgPledge = null;
  if (growth >= pl.target * 2) {
    earn(Math.round(pl.target * 0.8 * 10) / 10, "ESG pledge grant");
    S.studio.rep = clamp(S.studio.rep + 2, 0, 100);
    log("ESG pledge met — catalog grew " + fm(growth) + ". Grant " + fm(pl.target * 0.8) + "M, reputation +2.", "good", "🌱");
  } else {
    S.studio.rep = clamp(S.studio.rep - 3, 0, 100);
    log("ESG pledge missed — catalog grew only " + fm(growth) + " of " + fm(pl.target * 2) + " needed. Reputation -3.", "bad", "🌱");
  }
}

/* ── stock readout ────────────────────────────────────────────── */
function bizStockPrice() {
  return Math.round((8 + S.studio.rep / 8 + Math.min(S.studio.cash, 300) / 50 + S.studio.catalog / 200) * 10) / 10;
}
function bizStockTick() {
  ensure();
  var price = bizStockPrice(), move = Math.round((price - S.biz.stock.last) * 10) / 10;
  if (Math.abs(move) >= 2)
    log("BOW shares " + (move > 0 ? "climb" : "slide") + " to " + fm(price) + " (" + (move > 0 ? "+" : "") + move.toFixed(1) + ").", move > 0 ? "good" : "bad", "📈");
  S.biz.stock.last = price;
}

/* ── restoration ──────────────────────────────────────────────── */
function bizRestore(id) {
  ensure();
  var f = findFilm(id);
  if (!f || f.status !== "done" || !(f.ww >= 50)) { toast("Only released films grossing $50M+ WW can be restored.", "bad"); return false; }
  if (f.restored || S.biz.restored.indexOf(id) >= 0) { toast("Already restored.", ""); return false; }
  if (S.studio.cash < 6) { toast("Need " + fm(6) + " free for restoration.", "bad"); return false; }
  spend(6, "Restoration · " + f.title);
  f.restored = true;
  S.biz.restored.push(f.id);
  S.studio.catalog += 8;
  log(f.title + " returns in a 4K restoration — catalog +8.", "gold", "🎞️");
  return true;
}

/* ── weekly tick (engine calls tickBiz() after its own systems) ─ */
function tickBiz() {
  if (!S || S.over) return;
  ensure();
  bizBondInterest();
  bizBoardTick();
  bizChainsTick();
  bizInsWrapTick();
  bizKeystarTick();
  bizInsClaimTick();
  bizEsgPledgeTick();
  bizEsgTick();
  bizPressTick();
  bizEspTick();
  bizStockTick();
}

/* ── desk helpers ─────────────────────────────────────────────── */
function bizAfter() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function attr(elx, k) { return elx && elx.getAttribute ? elx.getAttribute(k) : null; }
function bizPhase(ph) { return { pre: "Pre-production", shoot: "Shooting", post: "Post-production", ready: "Ready" }[ph] || ph; }

/* ── desks ────────────────────────────────────────────────────── */
function deskCredit() {
  ensure();
  var r = bizRating(), out = bizBondsOutstanding(), raw = 0, i, html = "";
  for (i = 0; i < S.biz.bonds.length; i++) raw += S.biz.bonds[i].amt * S.biz.bonds[i].rate;
  html += '<div class="card">'
    + statrow("Credit score", bizScore().toFixed(1) + " &nbsp;" + tag(r.name, r.name === "CCC" ? "red" : r.name === "BBB" || r.name === "BB" || r.name === "B" ? "" : "green"))
    + statrow("Bond cap · rate", fm(r.cap) + " · " + (r.rate * 100).toFixed(1) + "%/wk")
    + statrow("Outstanding bonds", fm(out) + (raw > 0 ? " · " + (raw * 100).toFixed(1) + "%/wk interest" : ""))
    + statrow("Cash after issuing", fm(S.studio.cash + 10))
    + "</div>";
  if (S.biz.bonds.length) {
    html += '<div class="sechead"><h2>Bonds outstanding</h2></div><div class="card">';
    for (i = 0; i < S.biz.bonds.length; i++)
      html += statrow("Bond " + (i + 1), fm(S.biz.bonds[i].amt) + " @ " + (S.biz.bonds[i].rate * 100).toFixed(1) + "%/wk");
    html += "</div>";
  }
  html += '<div class="sechead"><h2>Actions</h2></div><div class="card">'
    + statrow("Issue a $10M bond (earns $10M now)",
      '<button class="btn primary sm" data-action="biz-bond-issue"' + (r.cap < 10 || out + 10 > r.cap ? " disabled" : "") + ">Issue</button>")
    + statrow("Repay oldest bond" + (S.biz.bonds.length ? " (" + fm(S.biz.bonds[0].amt) + ")" : ""),
      '<button class="btn sm" data-action="biz-bond-repay"' + (!S.biz.bonds.length || S.studio.cash < S.biz.bonds[0].amt ? " disabled" : "") + ">Repay</button>")
    + "</div>";
  return html;
}
function deskBoard() {
  ensure();
  var b = S.biz.board, html = "", m = b.mandate, i;
  html += '<div class="card">'
    + statrow("Board confidence", Math.round(b.conf) + " / 100")
    + '<div class="bar' + (b.conf < 25 ? " red" : b.conf >= 85 ? " green" : "") + '"><i style="width:' + Math.round(b.conf) + '%"></i></div>'
    + (b.conf < 25 ? statrow("Austerity", "-" + fm(0.15) + "/wk") : "")
    + "</div>";
  if (m) {
    var left = Math.max(0, m.due - S.studio.week), n = 0, prog;
    if (m.kind === "rep") prog = "&#9733; " + Math.round(S.studio.rep) + " / " + m.target;
    else if (m.kind === "cash") prog = fm(S.studio.cash) + " / " + fm(m.target);
    else {
      for (i = 0; i < S.films.length; i++) if (S.films[i].releaseWeek > m.from) n++;
      prog = n + " / " + m.target;
    }
    html += '<div class="card">'
      + statrow("Active mandate · " + left + " wk left", tag("due W" + woyOf(m.due), "blue"))
      + statrow(esc(m.txt), prog)
      + "</div>";
  } else if (b.offer && b.offer.length) {
    html += '<div class="sechead"><h2>Pick a quarterly mandate</h2></div><div class="card">';
    for (i = 0; i < b.offer.length; i++) {
      var label = b.offer[i].kind === "rep" ? "Grow reputation" : b.offer[i].kind === "cash" ? "Bank +$40M cash" : b.offer[i].kind === "sequel" ? "Release a sequel" : "Release a film this quarter";
      html += statrow(label, '<button class="btn primary sm" data-action="biz-board-pick" data-idx="' + i + '">Accept</button>');
    }
    html += "</div>";
  } else {
    html += '<div class="empty"><span class="em">🏛️</span>No mandate. The board reconvenes at the next quarterly review.</div>';
  }
  return html;
}
function deskMarket() {
  ensure();
  var html = "", i, f, any = false, rows = "";
  var price = bizStockPrice(), mv = Math.round((price - S.biz.stock.last) * 10) / 10;
  html += '<div class="card">'
    + statrow("BOW share price", fm(price) + " (" + (mv >= 0 ? "+" : "") + mv.toFixed(1) + " wk)")
    + statrow("Library catalog", fm(S.studio.catalog))
    + "</div>";
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "done" || !(f.ww >= 50) || f.restored || S.biz.restored.indexOf(f.id) >= 0) continue;
    any = true;
    rows += statrow(esc(f.title) + " · WW " + fm(f.ww),
      '<button class="btn sm" data-action="biz-restore" data-id="' + f.id + '"' + (S.studio.cash < 6 ? " disabled" : "") + ">Restore $6M</button>");
  }
  html += '<div class="sechead"><h2>Restoration vault (+8 catalog each)</h2></div>';
  html += any ? '<div class="card">' + rows + "</div>" : '<div class="empty"><span class="em">🎞️</span>No library titles worth restoring yet.</div>';
  return html;
}
function deskInsurance() {
  ensure();
  var html = "", i, t, p, T, any = false, rows = "";
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.insured || ["pre", "shoot", "post"].indexOf(p.phase) < 0) continue;
    any = true;
    var brow = '<div class="btnrow">';
    for (t = 0; t < BIZ_INS_TIERS.length; t++) {
      T = BIZ_INS_TIERS[t];
      var prem = Math.round(p.budget * T.rate * 10) / 10;
      brow += '<button class="btn sm" data-action="biz-insure" data-id="' + p.id + '" data-tier="' + T.id + '"' + (S.studio.cash < prem ? " disabled" : "") + ">" + T.name + " " + fm(prem) + "</button>";
    }
    brow += "</div>";
    rows += '<div class="card">' + statrow(bizPhase(p.phase) + " · " + esc(p.title), "budget " + fm(p.budget)) + brow + "</div>";
  }
  html += '<div class="card">' + statrow("Active policies", String(S.biz.insurance.length)) + "</div>";
  html += '<div class="sechead"><h2>Policy tiers</h2></div><div class="card">';
  for (t = 0; t < BIZ_INS_TIERS.length; t++) {
    T = BIZ_INS_TIERS[t];
    html += statrow(T.name + " · " + T.rate * 100 + "% of budget", T.desc);
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Uninsured productions</h2></div>';
  html += any ? rows : '<div class="empty"><span class="em">🛡️</span>Every production is covered.</div>';
  return html;
}
function deskLocations() {
  ensure();
  var html = "", i, j, p, L;
  html += '<div class="sechead"><h2>Location pool</h2></div><div class="card">';
  for (i = 0; i < BIZ_LOCS.length; i++) {
    L = BIZ_LOCS[i];
    var fx = [];
    if (L.craft) fx.push("+" + L.craft + " craft");
    if (L.costMult !== 1) fx.push("cost ×" + L.costMult);
    if (L.rebate) fx.push(Math.round(L.rebate * 100) + "% rebate" + (L.rebateCap != null ? " · cap " + fm(L.rebateCap) : ""));
    if (L.intlBonus) fx.push("+" + Math.round(L.intlBonus * 100) + "% intl");
    html += statrow(L.name, fx.length ? fx.join(" · ") : "—");
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Assign to a shoot ($1M legal)</h2></div>';
  var any = false;
  for (j = 0; j < S.projects.length; j++) {
    p = S.projects[j];
    if (["pre", "shoot"].indexOf(p.phase) < 0 || p.location) continue;
    any = true;
    var brow = '<div class="btnrow">';
    for (i = 0; i < BIZ_LOCS.length; i++)
      brow += '<button class="btn sm" data-action="biz-loc-assign" data-id="' + p.id + '" data-loc="' + BIZ_LOCS[i].id + '"' + (S.studio.cash < 1 ? " disabled" : "") + ">" + BIZ_LOCS[i].name + "</button>";
    html += '<div class="card">' + statrow(esc(p.title), bizPhase(p.phase)) + brow + "</div>";
  }
  if (!any) html += '<div class="empty"><span class="em">🌍</span>No productions scouting right now.</div>';
  if (S.biz.locations.length) {
    html += '<div class="sechead"><h2>Assigned shoots</h2></div><div class="card">';
    for (j = 0; j < S.biz.locations.length; j++) {
      var a = findProject(S.biz.locations[j].pid), locName = "—";
      for (i = 0; i < BIZ_LOCS.length; i++) if (BIZ_LOCS[i].id === S.biz.locations[j].loc) locName = BIZ_LOCS[i].name;
      html += statrow(a ? esc(a.title) : "Production", tag(locName, "blue"));
    }
    html += "</div>";
  }
  return html;
}
function deskChains() {
  ensure();
  var c = S.biz.chains, cd = c.eventWk ? Math.max(0, 8 - (S.studio.week - c.eventWk)) : 0;
  var html = '<div class="card">'
    + statrow("Theater relations", Math.round(c.rel) + " / 100")
    + '<div class="bar"><i style="width:' + Math.round(c.rel) + '%"></i></div>'
    + statrow("Opening multiplier", "×" + bizOpenMult({ genre: "action" }).toFixed(2))
    + statrow("IMAX deal", c.imax ? tag("Signed", "green") : tag("Relations &#8805; 60 to unlock", "blue"))
    + (cd ? statrow("Premiere cooldown", cd + " wk") : "")
    + "</div>";
  html += '<div class="sechead"><h2>Actions</h2></div><div class="card">'
    + statrow("Host exhibitor premiere ($2M · +8 relations)",
      '<button class="btn primary sm" data-action="biz-premiere"' + (cd || S.studio.cash < 2 ? " disabled" : "") + ">Host</button>")
    + statrow("Sign the IMAX deal ($30M · permanent)",
      '<button class="btn primary sm" data-action="biz-imax"' + (c.imax || c.rel < 60 || S.studio.cash < 30 ? " disabled" : "") + ">Sign</button>")
    + "</div>";
  return html;
}
function deskPresales() {
  ensure();
  var html = "", rows = "", i, j, p, any = false;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (["shoot", "post", "ready"].indexOf(p.phase) < 0) continue;
    any = true;
    var ww = bizProjectedWW(p), g = genreOf(p.genre), cfg = bizPresaleCfg(p.id);
    var sold = "MG " + Math.round((p.presale || 0) * 100) + "% · rev " + Math.round((p.revShare || 0) * 100) + "%";
    var mg15 = Math.round(ww * g.intl * 0.15 * 0.35 * 10) / 10;
    var mg25 = Math.round(ww * g.intl * 0.25 * 0.35 * 10) / 10;
    var seg = '<div class="seg">';
    for (j = 0; j < BIZ_TERMS.length; j++)
      seg += '<button class="' + (cfg.term === BIZ_TERMS[j].wk ? "on" : "") + '" data-action="biz-presale-cfg" data-id="' + p.id + '" data-key="term" data-val="' + BIZ_TERMS[j].wk + '">' + BIZ_TERMS[j].wk + "wk</button>";
    seg += "</div>";
    var seg2 = '<div class="seg">';
    seg2 += '<button class="' + (!cfg.loc ? "on" : "") + '" data-action="biz-presale-cfg" data-id="' + p.id + '" data-key="loc" data-val="0">Standard</button>';
    seg2 += '<button class="' + (cfg.loc ? "on" : "") + '" data-action="biz-presale-cfg" data-id="' + p.id + '" data-key="loc" data-val="1">Localized +$0.8M</button>';
    seg2 += "</div>";
    var rev = '<div class="btnrow">', rev25 = '<div class="btnrow">';
    for (j = 0; j < BIZ_REGIONS.length; j++) {
      var R = BIZ_REGIONS[j], fit = R.loves.indexOf(p.genre) >= 0 ? 1.3 : 0.7;
      var up15 = Math.round(ww * g.intl * 0.15 * 0.2 * fit * bizTermMult(cfg.term) * (cfg.loc ? 1.25 : 1) * 10) / 10;
      var up25 = Math.round(ww * g.intl * 0.25 * 0.2 * fit * bizTermMult(cfg.term) * (cfg.loc ? 1.25 : 1) * 10) / 10;
      var need = cfg.loc ? 0.8 : 0;
      rev += '<button class="btn sm" data-action="biz-presale" data-id="' + p.id + '" data-share="0.15" data-type="rev" data-region="' + R.id + '"' + ((p.revShare || 0) + 0.15 > 0.25 || S.studio.cash < need ? " disabled" : "") + ">" + R.name + " " + fm(up15) + "</button>";
      rev25 += '<button class="btn sm" data-action="biz-presale" data-id="' + p.id + '" data-share="0.25" data-type="rev" data-region="' + R.id + '"' + ((p.revShare || 0) + 0.25 > 0.25 || S.studio.cash < need ? " disabled" : "") + ">" + R.name + " " + fm(up25) + "</button>";
    }
    rev += "</div>";
    rev25 += "</div>";
    rows += '<div class="card">'
      + statrow(esc(p.title), bizPhase(p.phase) + " · " + sold)
      + statrow("Projected worldwide", fm(ww / ((typeof dealRegionalMult === "function") ? dealRegionalMult() : 1)))
      + '<div class="field-label">Rights term (scales the upfront)</div>' + seg
      + '<div class="field-label">Localization (+$0.8M per deal · offer ×1.25)</div>' + seg2
      + '<div class="field-label">Minimum guarantee</div>'
      + '<div class="btnrow">'
      + '<button class="btn primary sm" data-action="biz-presale" data-id="' + p.id + '" data-share="0.15"' + ((p.presale || 0) + 0.15 > 0.25 ? " disabled" : "") + ">MG 15% · " + fm(mg15) + "</button>"
      + '<button class="btn sm" data-action="biz-presale" data-id="' + p.id + '" data-share="0.25"' + ((p.presale || 0) + 0.25 > 0.25 ? " disabled" : "") + ">MG 25% · " + fm(mg25) + "</button>"
      + "</div>"
      + '<div class="field-label">Revenue share · 20% upfront + 55% backend</div>'
      + rev
      + rev25
      + "</div>";
  }
  html += '<div class="sechead"><h2>Territory pre-sales</h2></div>';
  html += any ? rows : '<div class="empty"><span class="em">🌐</span>Nothing in shoot, post or ready to pre-sell.</div>';
  return html;
}
function deskEspionage() {
  ensure();
  var e = S.biz.esp, costs = [10, 25, 50], html = "", i, j;
  html += '<div class="card">'
    + statrow("Espionage level", e.level + " / 3")
    + statrow("Rival announce window", espAnnounceWindow() + " wk")
    + statrow("Weekly operation odds", Math.round(0.03 * e.level * 100) + "%")
    + (e.lastIntel ? statrow("Last passive operation", "week " + e.lastIntel) : "")
    + "</div>";
  html += '<div class="sechead"><h2>Actions</h2></div><div class="card">';
  if (e.level >= 3) html += statrow("Desk fully built", tag("Level 3", "gold"));
  else html += statrow("Expand the desk (" + fm(costs[e.level]) + ")",
    '<button class="btn primary sm" data-action="biz-esp-build"' + (S.studio.cash < costs[e.level] ? " disabled" : "") + ">Build</button>");
  html += "</div>";
  html += '<div class="sechead"><h2>Active missions · 5% / 10% caught (&#9733; -4 rep)</h2></div>';
  for (i = 0; i < S.rivals.length; i++) {
    var rv = S.rivals[i], intel = S.biz.esp.intel[rv.name], rows = "";
    if (intel && intel.length) {
      for (j = 0; j < intel.length; j++)
        rows += statrow(esc(intel[j].title) + " · wk " + intel[j].week, tag(intel[j].genre + " · Q" + intel[j].quality, "blue"));
    }
    html += '<div class="card">'
      + statrow(rv.name, S.biz.esp.suppressed[rv.name] ? tag("Opening suppressed", "gold") : intel && intel.length ? tag("Intel stored", "green") : "no intel")
      + rows
      + '<div class="btnrow">'
      + '<button class="btn sm" data-action="biz-esp-op" data-rival="' + esc(rv.name) + '" data-op="intel"' + (S.studio.cash < BIZ_OPS.intel.cost ? " disabled" : "") + ">Intel " + fm(BIZ_OPS.intel.cost) + "</button>"
      + '<button class="btn sm" data-action="biz-esp-op" data-rival="' + esc(rv.name) + '" data-op="leak"' + (S.studio.cash < BIZ_OPS.leak.cost || S.biz.esp.suppressed[rv.name] ? " disabled" : "") + ">Leak " + fm(BIZ_OPS.leak.cost) + "</button>"
      + '<button class="btn sm" data-action="biz-esp-op" data-rival="' + esc(rv.name) + '" data-op="sabot"' + (S.studio.cash < BIZ_OPS.sabot.cost || S.biz.esp.deepLeak === rv.name ? " disabled" : "") + ">Sabotage " + fm(BIZ_OPS.sabot.cost) + "</button>"
      + "</div></div>";
  }
  return html;
}
function deskPrograms() {
  ensure();
  var html = "", i;
  html += '<div class="sechead"><h2>One-time industry programs</h2></div><div class="card">';
  for (i = 0; i < BIZ_PROGRAMS.length; i++) {
    var pr = BIZ_PROGRAMS[i], on = S.biz.programs[pr.key];
    html += statrow(pr.name + " (" + fm(pr.cost) + ") — " + pr.desc,
      on ? tag("Active", "green") : '<button class="btn primary sm" data-action="biz-prog" data-key="' + pr.key + '"' + (S.studio.cash < pr.cost ? " disabled" : "") + ">Buy</button>");
  }
  html += "</div>";
  html += '<div class="sechead"><h2>ESG pledge (filing $3M · 52 weeks)</h2></div>';
  var pl = S.biz.esgPledge;
  if (pl) {
    var growth = S.studio.catalog - pl.startCatalog;
    html += '<div class="card">'
      + statrow("Pledge on file", "grow catalog by " + fm(pl.target * 2))
      + statrow("Catalog growth since filing", fm(growth) + " / " + fm(pl.target * 2))
      + statrow("Due", "week " + pl.due + " (" + Math.max(0, pl.due - S.studio.week) + " wk left)")
      + "</div>";
  } else {
    html += '<div class="card">';
    for (i = 0; i < BIZ_ESG_TARGETS.length; i++)
      html += statrow("Target " + BIZ_ESG_TARGETS[i] + " · grant " + fm(BIZ_ESG_TARGETS[i] * 0.8) + "M",
        '<button class="btn primary sm" data-action="biz-esg-file" data-target="' + BIZ_ESG_TARGETS[i] + '"' + (S.studio.cash < 3 ? " disabled" : "") + ">File $3M</button>");
    html += "</div>";
  }
  html += '<div class="sechead"><h2>Studio imprints (one active · $5M to switch)</h2></div><div class="card">';
  for (i = 0; i < BIZ_IMPRINTS.length; i++) {
    var im = BIZ_IMPRINTS[i], owned = S.biz.imprints.owned[im.key], act = S.biz.imprints.active === im.key;
    var tot = (owned ? 0 : im.cost) + (S.biz.imprints.active && S.biz.imprints.active !== im.key ? 5 : 0);
    html += statrow(im.name + " — " + im.desc,
      act ? tag("Active", "green") : '<button class="btn primary sm" data-action="biz-imprint" data-key="' + im.key + '"' + (S.studio.cash < tot ? " disabled" : "") + ">" + (owned ? "Switch " : "Buy ") + fm(tot) + "</button>");
  }
  html += "</div>";
  return html;
}

var BIZ_DESKS = [
  { id: "biz-credit",    group: "Finance",      icon: "🏦", name: "Credit & bonds",        desc: "Issue corporate bonds against your credit rating; repay weekly interest.", render: deskCredit },
  { id: "biz-board",     group: "Finance",      icon: "🏛️", name: "Studio board",          desc: "Quarterly mandates, confidence and austerity.", render: deskBoard },
  { id: "biz-market",    group: "Finance",      icon: "📈", name: "Stock & restoration",   desc: "Share price readout and 4K restorations of library hits.", render: deskMarket },
  { id: "biz-insurance", group: "Production",   icon: "🛡️", name: "Production insurance",  desc: "Tiered policies: overrun refunds, scandal cover, full flop bonds.", render: deskInsurance },
  { id: "biz-locations", group: "Production",   icon: "🌍", name: "Locations",             desc: "Shoot abroad for rebates, craft and international appeal.", render: deskLocations },
  { id: "biz-chains",    group: "Distribution", icon: "🎟️", name: "Theater chains",        desc: "Premieres and an IMAX deal widen your openings.", render: deskChains },
  { id: "biz-presales",  group: "Distribution", icon: "🌐", name: "Territory pre-sales",   desc: "MG or rev-share deals by territory, with terms and localization.", render: deskPresales },
  { id: "biz-espionage", group: "Intrigue",     icon: "🕵️", name: "Espionage desk",        desc: "Passive ops plus intel and counter-PR missions against rivals.", render: deskEspionage },
  { id: "biz-programs",  group: "Industry",     icon: "🏭", name: "Programs & imprints",   desc: "ESG programs and pledges, industry wings, studio imprints.", render: deskPrograms }
];

/* ── actions (ui.js onAction tries bizAction first-to-true) ───── */
function bizAction(a, elx) {
  if (typeof a !== "string" || a.indexOf("biz-") !== 0) return false;
  var r = false;
  switch (a) {
    case "biz-bond-issue": r = bizIssueBond(); break;
    case "biz-bond-repay": r = bizRepayBond(); break;
    case "biz-board-pick": r = bizPickMandate(parseInt(attr(elx, "data-idx"), 10) || 0); break;
    case "biz-insure":     r = bizInsure(attr(elx, "data-id"), attr(elx, "data-tier")); break;
    case "biz-loc-assign": r = bizAssignLocation(attr(elx, "data-id"), attr(elx, "data-loc")); break;
    case "biz-premiere":   r = bizHostPremiere(); break;
    case "biz-imax":       r = bizImaxDeal(); break;
    case "biz-presale":    r = bizSellPresale(attr(elx, "data-id"), parseFloat(attr(elx, "data-share")), attr(elx, "data-type"), attr(elx, "data-region")); break;
    case "biz-presale-cfg": r = bizPresaleCfgSet(attr(elx, "data-id"), attr(elx, "data-key"), attr(elx, "data-val")); break;
    case "biz-esp-build":  r = bizEspBuild(); break;
    case "biz-esp-op":     r = bizEspOp(attr(elx, "data-rival"), attr(elx, "data-op")); break;
    case "biz-esg-file":   r = bizFileEsg(parseInt(attr(elx, "data-target"), 10)); break;
    case "biz-imprint":    r = bizBuyImprint(attr(elx, "data-key")); break;
    case "biz-prog":       r = bizBuyProgram(attr(elx, "data-key")); break;
    case "biz-restore":    r = bizRestore(attr(elx, "data-id")); break;
    default: return false;
  }
  bizAfter();
  return true;
}
