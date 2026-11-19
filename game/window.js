/* Box Office War — rebuilt. Distribution window strategy (v46 module 6).
   Systems: every film leaves theaters on a dated window. A long theatrical exclusive
   holds screens and stretches the tail; a short window trades theatrical weeks for a
   bigger streaming cheque. The player picks per film, signs streamer output deals for
   up-front cash, and can buy an exclusive extension back on a film still in release.

   Engine hooks (all typeof-guarded on the engine side, already wired):
   - windowLegsMult(stub)  → theatrical legs multiplier at release (engine line 567).
                             The engine passes a STUB { window, genre } because the film
                             record does not exist yet, so this reads f.window and
                             f.genre ONLY — never S, never S.films, never an id.
   - windowRevenueMult(f)  → multiplier on the PVOD/streaming cheque at endTheatrical.
   - windowOnRelease(f)    → registers the outing period, credits output-deal slots.
   - tickWindow()          → advances windows, pays early PVOD, lapses deals.
   Actions (bridged by ui.js onAction): window-set, window-deal, window-extend.
   Desks (WINDOW_DESKS, group "Distribution"): window-strategy, window-deals.
   All state under S.win; windowEnsure() rebuilds it on an old save.
   Both multipliers return exactly 1 when nothing applies and are clamped positive —
   the engine multiplies raw values, so a 0 or a negative would erase a film's run.
   No self-wiring: the integrator calls tickWindow() inside advanceWeek(). */
"use strict";

/* ── window anchors ───────────────────────────────────────────────
   Continuous ramps through four anchor points, so any day count the release sheet
   or an old save can hold (0, 7, 17, 45, 90, 120...) lands on a sane multiplier.
   45 days is exactly neutral on both curves: the engine's own default. */
var WINDOW_PRESETS = [
  { days: 7,  id: "pvod",  short: "PVOD-first", name: "PVOD day-and-date",
    note: "Streaming the same week. A token theatrical run, a fat streaming cheque." },
  { days: 17, id: "short", short: "17-day",     name: "17-day short window",
    note: "Exhibitors grumble, the streamer pays a premium, the tail gets clipped." },
  { days: 45, id: "std",   short: "45-day",     name: "45-day standard",
    note: "The industry default. No bonus, no penalty on either side." },
  { days: 90, id: "excl",  short: "90-day",     name: "90-day theatrical exclusive",
    note: "Screens stay with you longer and the tail runs; streaming waits its turn." }
];

/* Streamer offers. Signing pays up front; each qualifying release fills one slot and
   pays the slot bonus. Nothing is ever clawed back — an unused slot is simply lost. */
var WINDOW_DEALS = [
  { id: "nightjar-daydate", streamer: "Nightjar", name: "Day-and-date bundle",
    pay: 12, bonus: 3, films: 4, minWindow: 0, maxWindow: 7, rep: 0, weeks: 18,
    note: "Four PVOD-first releases inside 18 weeks." },
  { id: "vantage-short", streamer: "Vantage+", name: "17-day short-window pact",
    pay: 22, bonus: 4, films: 3, minWindow: 0, maxWindow: 17, rep: 0, weeks: 26,
    note: "Three films on a 17-day window or shorter." },
  { id: "meridian-output", streamer: "Meridian", name: "Standard-window output deal",
    pay: 34, bonus: 6, films: 3, minWindow: 0, maxWindow: 45, rep: 25, weeks: 39,
    note: "Three films on the 45-day standard or shorter." },
  { id: "cinevault-exclusive", streamer: "CineVault", name: "Premium exclusive",
    pay: 46, bonus: 9, films: 2, minWindow: 90, maxWindow: 999, rep: 40, weeks: 52,
    note: "Two films on a full 90-day theatrical exclusive." }
];

/* ── small helpers ────────────────────────────────────────────── */
function windowRound1(x) { return Math.round(x * 10) / 10; }
function windowRound3(x) { return Math.round(x * 1000) / 1000; }
function windowWeek() {
  return (S && S.studio && isFinite(S.studio.week)) ? S.studio.week : 1;
}
function windowDaysOf(f) {
  if (!f || !isFinite(f.window)) return 45;
  var d = f.window;
  if (d < 0) d = 0;
  if (d > 365) d = 365;
  return d;
}
function windowPresetFor(days) {
  var d = isFinite(days) ? days : 45;
  if (d <= 10) return WINDOW_PRESETS[0];
  if (d <= 30) return WINDOW_PRESETS[1];
  if (d <= 60) return WINDOW_PRESETS[2];
  return WINDOW_PRESETS[3];
}
function windowPresetById(id) {
  var i;
  for (i = 0; i < WINDOW_PRESETS.length; i++) if (WINDOW_PRESETS[i].id === id) return WINDOW_PRESETS[i];
  return null;
}
function windowDealDef(id) {
  var i;
  for (i = 0; i < WINDOW_DEALS.length; i++) if (WINDOW_DEALS[i].id === id) return WINDOW_DEALS[i];
  return null;
}

/* ── state (lazy ensure — old saves have no S.win) ────────────── */
function windowStats() {
  return { released: 0, pvod: 0, pvodFilms: 0, deals: 0, dealsDone: 0,
           dealCash: 0, dealBonus: 0, extends: 0, extendSpend: 0,
           wPvod: 0, wShort: 0, wStd: 0, wExcl: 0 };
}
function windowEnsure() {
  if (!S) return false;
  if (!S.win || typeof S.win !== "object") S.win = {};
  var W = S.win, base, k;
  if (!isFinite(W.lastTick)) W.lastTick = 0;
  if (!Array.isArray(W.runs)) W.runs = [];
  if (!Array.isArray(W.deals)) W.deals = [];
  if (!Array.isArray(W.history)) W.history = [];
  if (!W.choice || typeof W.choice !== "object") W.choice = {};
  if (!W.stats || typeof W.stats !== "object") W.stats = {};
  base = windowStats();
  for (k in base) if (!isFinite(W.stats[k])) W.stats[k] = base[k];
  return true;
}
function windowStatKey(presetId) {
  if (presetId === "pvod") return "wPvod";
  if (presetId === "short") return "wShort";
  if (presetId === "std") return "wStd";
  return "wExcl";
}

/* ── engine hook 1: theatrical legs ───────────────────────────────
   Called from releaseFilm with a STUB { window, genre } — the film record is built a
   few lines below that call. Reads nothing but those two fields. 45 days is exactly
   1.000 so an untouched film behaves exactly as before this module existed. */
function windowLegsMult(f) {
  if (!f) return 1;
  var d = windowDaysOf(f), dev;
  if (d <= 0) dev = -0.10;
  else if (d < 17) dev = -0.10 + (d / 17) * 0.06;
  else if (d < 45) dev = -0.04 + ((d - 17) / 28) * 0.04;
  else if (d < 90) dev = ((d - 45) / 45) * 0.07;
  else dev = 0.07;
  /* Genre shapes how much the window matters, never whether it matters: the factor
     scales the deviation from neutral, so 45 days stays exactly 1 for every genre.
     Front-loaded genres survive a short window; slow burns need the long hold. */
  var gid = null, g = 1;
  if (f.genre && typeof genreOf === "function") gid = genreOf(f.genre).id;
  if (gid === "horror" || gid === "action") g = (d <= 30 ? 1.5 : 0.7);
  else if (gid === "drama" || gid === "animation" || gid === "musical") g = (d >= 90 ? 1.35 : 0.75);
  var mult = 1 + dev * g;
  mult = clamp(mult, 0.85, 1.12);
  if (!isFinite(mult) || mult <= 0) return 1;
  return windowRound3(mult);
}

/* ── engine hook 2: PVOD / streaming cheque ───────────────────────
   A streamer licence is close to a FIXED cheque, so the window moves it by a fixed
   number of dollars rather than by a percentage. That is what lets the trade-off
   actually bite: on a micro film a +$2.6M cheque dwarfs the few screens a long hold
   would win, while on a tentpole the extra theatrical weeks are worth far more than
   the same $2.6M. A pure ratio curve is scale invariant and would make one window
   strictly dominant for every film in the game — which is exactly what we must not
   ship. The multiplier the engine applies is therefore 1 + delta / base. */
var WINDOW_MULT_LO = 0.15, WINDOW_MULT_HI = 12;
var WINDOW_DEAL_BONUS = 1.4;      /* $M added when an open output deal matches the window */
function windowRefBase() { return 10.5; }
/* Millions added to (or taken from) the streaming cheque, by window length.
   45 days is exactly 0 so the engine default is never silently taxed. */
function windowDollarDelta(d) {
  if (d <= 0) return 2.60;
  if (d < 17) return 2.60 - (d / 17) * (2.60 - 1.15);
  if (d < 45) return 1.15 - ((d - 17) / 28) * 1.15;
  if (d < 90) return -((d - 45) / 45) * 4.20;
  return -4.20;
}
/* The cheque the engine is about to scale: (domestic + international) × 5.5%.
   endTheatrical has not written f.intl yet when it calls us, so international is
   reconstructed from the genre's usual share. No film id is ever consulted. */
function windowPvodBase(f) {
  var dom = (f && isFinite(f.dom) && f.dom > 0) ? f.dom : 0;
  if (!dom) return windowRefBase();
  var g = (typeof genreOf === "function") ? genreOf(f.genre) : null;
  var share = g ? clamp(g.intl, 0.1, 0.8) : 0.5;
  var intl = dom * share / (1 - share);
  var base = (dom + intl) * 0.055;
  if (!isFinite(base) || base <= 0) return windowRefBase();
  return base;
}
/* An open output deal is worth a fixed bonus cheque on top of the licence, for the
   same reason the window delta is fixed: a percentage addend would be scale
   invariant and would make long windows dominant on every film again. */
function windowDealBonus(days) {
  if (!S || !S.win || !Array.isArray(S.win.deals)) return 0;
  var i, r;
  for (i = 0; i < S.win.deals.length; i++) {
    r = S.win.deals[i];
    if (!r || r.done || r.expired) continue;
    if (days < (r.minWindow || 0) || days > (r.maxWindow != null ? r.maxWindow : 999)) continue;
    return WINDOW_DEAL_BONUS;
  }
  return 0;
}
function windowRevenueMult(f) {
  if (!f) return 1;
  var d = windowDaysOf(f);
  var base = windowPvodBase(f);
  var mult = 1 + windowDollarDelta(d) / base;
  mult += windowDealBonus(d) / base;
  mult = clamp(mult, WINDOW_MULT_LO, WINDOW_MULT_HI);
  if (!isFinite(mult) || mult <= 0) return 1;
  return windowRound3(mult);
}

/* Early PVOD money that lands while the film is still on screens. Capped against the
   production cost so a micro film can never out-earn its own budget on this line. */
function windowPvodCash(f) {
  var base = (isFinite(f.opening) ? f.opening : 0) * 0.045;
  if (!isFinite(base) || base <= 0) return 0;
  var cash = base * windowRevenueMult(f);
  var cap = (isFinite(f.cost) ? f.cost : 0) * 0.35;
  if (cap > 0 && cash > cap) cash = cap;
  if (!isFinite(cash) || cash <= 0) return 0;
  return windowRound1(cash);
}

/* ── engine hook 3: release registration ──────────────────────── */
/* Finds the open output deal a release should fill. Tightest window wins, so a
   day-and-date film feeds the day-and-date pact rather than the standard deal. */
function windowOpenDealFor(days) {
  if (!S || !S.win || !Array.isArray(S.win.deals)) return null;
  var i, r, best = null;
  for (i = 0; i < S.win.deals.length; i++) {
    r = S.win.deals[i];
    if (!r || r.done || r.expired) continue;
    if (days < (r.minWindow || 0)) continue;
    if (days > (r.maxWindow != null ? r.maxWindow : 999)) continue;
    if (!best || (r.maxWindow || 999) < (best.maxWindow || 999)) best = r;
  }
  return best;
}
function windowOnRelease(f) {
  if (!S || !f) return false;
  windowEnsure();
  var W = S.win, i, dup = false;
  var days = windowDaysOf(f);
  var pr = windowPresetFor(days);
  for (i = 0; i < W.runs.length; i++) if (W.runs[i] && W.runs[i].filmId === f.id) { dup = true; break; }
  if (dup) return false;                    /* idempotent: one run per film */
  var wk = windowWeek();
  W.runs.push({
    filmId: f.id, title: f.title, window: days, preset: pr.id,
    start: wk, pvodWk: wk + Math.max(1, Math.ceil(days / 7)),
    fired: false, pvd: 0
  });
  W.history.unshift({ title: f.title, window: days, preset: pr.id, week: wk, pvd: 0 });
  if (W.history.length > 20) W.history.length = 20;
  W.stats.released++;
  W.stats[windowStatKey(pr.id)]++;

  /* an open output deal takes one slot */
  var deal = windowOpenDealFor(days);
  if (deal) {
    deal.used++;
    deal.paid = windowRound1((deal.paid || 0) + deal.bonus);
    W.stats.dealBonus = windowRound1(W.stats.dealBonus + deal.bonus);
    earn(deal.bonus, "Output slot · " + deal.streamer);
    if (deal.used >= deal.films) {
      deal.done = true;
      W.stats.dealsDone++;
      log(deal.streamer + " completed its output deal — all " + deal.films + " slots delivered.", "good", "\uD83D\uDCC4");
    } else {
      log("\u201C" + f.title + "\u201D fills a " + deal.streamer + " slot (" + deal.used + "/" + deal.films + ").", "", "\uD83D\uDCC4");
    }
  }
  return true;
}

/* ── engine hook 4: weekly tick ───────────────────────────────── */
function tickWindow() {
  windowEnsure();                                    /* a fresh save has no S.win yet */
  if (S.win.lastTick === S.studio.week) return;      /* one pass per week, wired or not */
  S.win.lastTick = S.studio.week;
  var W = S.win, wk = S.studio.week, i, j, r, f, pay, fired = 0;

  /* 1. PVOD / streaming windows open on schedule */
  for (i = 0; i < W.runs.length; i++) {
    r = W.runs[i];
    if (!r || r.fired || wk < r.pvodWk) continue;
    r.fired = true;
    f = (typeof findFilm === "function") ? findFilm(r.filmId) : null;
    if (!f || f.status !== "run") continue;          /* already out of theaters: no double dip */
    pay = windowPvodCash(f);
    if (pay <= 0) continue;
    earn(pay, "PVOD window \u00B7 " + f.title);
    W.stats.pvod = windowRound1(W.stats.pvod + pay);
    W.stats.pvodFilms++;
    r.pvd = pay;
    for (j = 0; j < W.history.length; j++) {
      if (W.history[j].title === f.title) { W.history[j].pvd = pay; break; }
    }
    if (fired < 2) {
      log("\u201C" + f.title + "\u201D reaches PVOD on its " + r.window + "-day window \u2014 " + fm(pay) + " in early streaming.", "good", "\uD83D\uDCFA");
    }
    fired++;
  }

  /* 2. output deals lapse quietly when their term runs out */
  for (i = 0; i < W.deals.length; i++) {
    r = W.deals[i];
    if (!r || r.done || r.expired) continue;
    if (wk < r.expiresWk) continue;
    r.expired = true;
    log(r.streamer + " output deal lapsed with " + Math.max(0, r.films - r.used) + " slot(s) unfilled.", "", "\uD83D\uDCC4");
  }

  /* 3. keep the ledgers short */
  if (W.runs.length > 14) W.runs = W.runs.slice(W.runs.length - 14);
  if (W.history.length > 20) W.history.length = 20;
  return fired;
}

/* ── actions ──────────────────────────────────────────────────── */
function windowFindChoice(pid) {
  if (!S || !S.win || !S.win.choice) return null;
  var v = S.win.choice[pid];
  return isFinite(v) ? v : null;
}
/* Set the window on a film that is not dated yet. setRelease() then seeds the release
   sheet from p.window, so this is the "strategy" decision the release sheet confirms. */
function windowSetWindow(pid, daysStr) {
  var p = (pid && typeof findProject === "function") ? findProject(pid) : null;
  var days = parseInt(daysStr, 10);
  if (!p) { toast("That film is no longer on the lot.", "bad"); return false; }
  if (!isFinite(days) || days < 0) { toast("Pick a real window.", "bad"); return false; }
  if (p.releaseWeek != null) {
    toast("\u201C" + p.title + "\u201D is already dated \u2014 change the window in the release sheet.", "bad");
    return false;
  }
  var pr = windowPresetFor(days);
  p.window = pr.days;
  windowEnsure();
  S.win.choice[p.id] = pr.days;
  log("\u201C" + p.title + "\u201D is planned for a " + pr.short + " window.", "", "\uD83C\uDF9E\uFE0F");
  toast(pr.short + " window set for \u201C" + p.title + "\u201D.", "good");
  return true;
}
function windowSignDeal(did) {
  var d = windowDealDef(did), i, r;
  windowEnsure();
  if (!d) { toast("That deal is off the table.", "bad"); return false; }
  for (i = 0; i < S.win.deals.length; i++) {
    r = S.win.deals[i];
    if (r && r.id === d.id && !r.expired) { toast(d.streamer + " is already signed.", "bad"); return false; }
  }
  if ((S.studio.rep || 0) < d.rep) {
    toast("Reputation " + d.rep + " needed for the " + d.streamer + " deal.", "bad");
    return false;
  }
  S.win.deals.push({
    id: d.id, name: d.name, streamer: d.streamer,
    pay: d.pay, bonus: d.bonus, films: d.films, used: 0, paid: 0,
    minWindow: d.minWindow || 0, maxWindow: d.maxWindow != null ? d.maxWindow : 999,
    signedWk: windowWeek(), expiresWk: windowWeek() + d.weeks,
    done: false, expired: false
  });
  S.win.stats.deals++;
  S.win.stats.dealCash = windowRound1(S.win.stats.dealCash + d.pay);
  earn(d.pay, "Output deal \u00B7 " + d.streamer);
  log(d.streamer + " signs a " + d.name.toLowerCase() + " \u2014 " + fm(d.pay) + " up front for " + d.films + " film(s).", "good", "\uD83D\uDCC4");
  toast("+" + fm(d.pay) + " from " + d.streamer + ".", "gold");
  return true;
}
function windowExtendFee(f) {
  var open = isFinite(f.opening) ? f.opening : 0;
  var fee = 2 + open * 0.02;
  if (!isFinite(fee) || fee <= 0) fee = 2;
  return windowRound1(Math.min(fee, 20));
}
/* Buy screens back mid-run: the only window change that costs cash, and the only one
   that can be made after a film is out. Raises legs the way the engine's own recut
   reward does (clamp + recomputed decay). */
function windowExtendRun(fid) {
  var f = (fid && typeof findFilm === "function") ? findFilm(fid) : null, i, r;
  if (!f) { toast("That film has left the ledger.", "bad"); return false; }
  if (f.status !== "run") { toast("\u201C" + f.title + "\u201D has left theaters.", "bad"); return false; }
  var cur = windowDaysOf(f);
  if (cur >= 90) { toast("\u201C" + f.title + "\u201D already holds a 90-day exclusive.", "bad"); return false; }
  var fee = windowExtendFee(f);
  if (!isFinite(S.studio.cash) || S.studio.cash < fee) {
    toast("Need " + fm(fee) + " to buy the exclusive extension.", "bad");
    return false;
  }
  spend(fee, "Window extension \u00B7 " + f.title);
  f.window = Math.min(90, cur + 30);
  f.legs = clamp((isFinite(f.legs) ? f.legs : 2.2) + 0.06, 1.4, 4.4);
  f.decay = 1 - 1 / f.legs;
  windowEnsure();
  S.win.stats.extends++;
  S.win.stats.extendSpend = windowRound1(S.win.stats.extendSpend + fee);
  if (Array.isArray(S.win.runs)) {
    for (i = 0; i < S.win.runs.length; i++) {
      r = S.win.runs[i];
      if (r && r.filmId === f.id) { r.window = f.window; r.preset = windowPresetFor(f.window).id; break; }
    }
  }
  log("\u201C" + f.title + "\u201D holds screens for " + f.window + " days \u2014 extension bought for " + fm(fee) + ".", "good", "\uD83C\uDFAC");
  toast("Window extended to " + f.window + " days.", "good");
  return true;
}
function windowAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("window-") !== 0) return false;
  windowEnsure();
  var id = null, key = null;
  if (elx && elx.getAttribute) {
    id = elx.getAttribute("data-id");
    key = elx.getAttribute("data-key");
  }
  if (a === "window-set") windowSetWindow(id, key);
  else if (a === "window-deal") windowSignDeal(key || id);
  else if (a === "window-extend") windowExtendRun(id);
  else return false;
  saveGame();
  return true;
}

/* ── projections for the desk ─────────────────────────────────── */
function windowEstWW(p) {
  var w = 0;
  if (typeof bizProjectedWW === "function") {
    w = bizProjectedWW(p);
    if (isFinite(w) && w > 0) return w;
  }
  var g = genreOf(p.genre), sc = scaleOf(p.scale);
  if (!g || !sc) return 0;
  var rep = (S && S.studio && isFinite(S.studio.rep)) ? S.studio.rep : 0;
  var open = sc.openBase * g.mass * 1.216 * (1 + rep / 600);
  var legs = 2.3 + g.legs;
  var dom = open * legs * 0.9;
  var share = g.intl > 0.75 ? 0.75 : g.intl;
  var ww = dom / (1 - share);
  return (isFinite(ww) && ww > 0) ? ww : 0;
}
function windowShortestInUse() {
  if (!S || !S.win || !S.win.stats) return 45;
  var st = S.win.stats, out = 0, i, o;
  for (i = 0; i < WINDOW_PRESETS.length; i++) {
    o = WINDOW_PRESETS[i];
    if ((st[windowStatKey(o.id)] || 0) <= 0) continue;
    if (!out || o.days < out) out = o.days;
  }
  return out || 45;
}

/* ── desks ────────────────────────────────────────────────────── */
/* Absolute projection for one preset: what the picture is expected to take in
   theaters and what the streamer cheque behind it should be worth. The streaming
   figure is the engine's own cheque (WW × 5.5%) plus the fixed dollar the window
   adds, clamped the same way windowRevenueMult clamps it — so the desk and the
   ledger agree to the dollar instead of disagreeing by an order of magnitude. */
function windowProject(p, days) {
  var est = windowEstWW(p);
  var legsM = windowLegsMult({ window: days, genre: p.genre });
  var theat = est * 0.52 * legsM;
  var base = est * 0.055;
  var stream = base;
  if (base > 0) {
    var mult = 1 + (windowDollarDelta(days) + windowDealBonus(days)) / base;
    mult = clamp(mult, WINDOW_MULT_LO, WINDOW_MULT_HI);
    if (!isFinite(mult) || mult <= 0) mult = 1;
    stream = base * mult;
  } else {
    stream = base + windowDollarDelta(days);
  }
  if (!isFinite(theat) || theat < 0) theat = 0;
  if (!isFinite(stream) || stream < 0) stream = 0;
  return { theat: theat, stream: stream, total: theat + stream };
}
function windowProjectCard(p) {
  var g = genreOf(p.genre), sc = scaleOf(p.scale);
  var cur = (isFinite(p.window) && p.window > 0) ? p.window : 45;
  var pr = windowPresetFor(cur);
  var cls = pr.id === "std" ? "blue" : pr.id === "excl" ? "green" : "gold";
  var html = '<div class="card film"><div class="head"><div class="title">' + esc(p.title) + "</div>"
    + tag(pr.short, cls) + "</div>";
  html += '<div class="meta">' + tag(g.em + " " + g.name) + tag(sc.name)
    + tag(fm(p.budgetNow) + " budget")
    + (p.releaseWeek != null ? tag("Opens wk " + p.releaseWeek, "blue") : tag("No date yet", ""))
    + "</div>";
  html += '<div class="seg">';
  var i, o, t, best = -1, bestDays = cur, rows = [];
  for (i = 0; i < WINDOW_PRESETS.length; i++) {
    o = WINDOW_PRESETS[i];
    t = windowProject(p, o.days);
    rows.push({ o: o, t: t });
    if (t.total > best) { best = t.total; bestDays = o.days; }
    html += '<button class="' + (o.id === pr.id ? "on" : "") + '" data-action="window-set"'
      + ' data-id="' + p.id + '" data-key="' + o.days + '"'
      + (p.releaseWeek != null ? " disabled" : "") + ">" + o.short + "</button>";
  }
  html += "</div>";
  /* All four priced side by side: the trade-off has to be readable in dollars
     before the player commits, not discovered after the run closes. */
  for (i = 0; i < rows.length; i++) {
    html += statrow(rows[i].o.short + " window",
      fm(rows[i].t.theat) + " theatrical \u00B7 " + fm(rows[i].t.stream) + " streaming",
      rows[i].o.days === bestDays ? "up" : "");
  }
  html += "</div>";
  return html;
}
function windowRunCard(f) {
  var cur = windowDaysOf(f);
  var wkOut = isFinite(f.weeksOut) ? f.weeksOut : 0;
  var can = cur < 90 && f.status === "run";
  var fee = windowExtendFee(f);
  var html = '<div class="card film"><div class="head"><div class="title">' + esc(f.title) + "</div>"
    + tag(wkOut + " wk in", "blue") + "</div>";
  html += '<div class="meta">' + tag(cur + "-day window", cur >= 90 ? "green" : "gold")
    + tag("Legs \u00D7" + (isFinite(f.legs) ? f.legs.toFixed(2) : "\u2014"))
    + tag("Streaming \u00D7" + windowRevenueMult(f).toFixed(2)) + "</div>";
  html += statrow("Hold screens to 90 days (" + fm(fee) + ")",
    '<button class="btn sm" data-action="window-extend" data-id="' + f.id + '"'
    + (can && S.studio.cash >= fee ? "" : " disabled") + ">Extend</button>");
  html += "</div>";
  return html;
}
function windowStrategyDesk() {
  windowEnsure();
  var W = S.win, st = W.stats, html = "";
  html += '<div class="card">'
    + statrow("Films released", String(st.released))
    + statrow("PVOD window income", fm(st.pvod), st.pvod > 0 ? "up" : "")
    + statrow("Shortest window used", windowShortestInUse() + " days")
    + statrow("Extensions bought", st.extends + (st.extendSpend > 0 ? " \u00B7 " + fm(st.extendSpend) : ""))
    + "</div>";
  html += '<div class="sechead"><h2>Window per film</h2></div>';
  var i, p, n = 0;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (!p) continue;
    if (p.phase === "ready" && p.releaseWeek != null) continue; /* dated and awaiting the gate */
    html += windowProjectCard(p);
    n++;
  }
  if (!n) {
    html += '<div class="card"><div class="empty"><span class="em">\uD83C\uDFAC</span>No film on the lot to plan. '
      + "A long exclusive hold keeps screens and stretches the tail; a short window trades theatrical weeks "
      + "for a bigger streaming cheque.</div></div>";
  }
  html += '<div class="sechead"><h2>In theaters</h2></div>';
  var m = 0, f;
  for (i = 0; i < S.films.length && m < 3; i++) {
    f = S.films[i];
    if (!f || f.status !== "run") continue;
    html += windowRunCard(f);
    m++;
  }
  if (!m) html += '<div class="card"><div class="empty"><span class="em">\uD83C\uDF7F</span>Nothing of yours is on screens this week.</div></div>';
  return html;
}
function windowDealsDesk() {
  windowEnsure();
  var W = S.win, st = W.stats, html = "";
  var open = 0, i, r;
  for (i = 0; i < W.deals.length; i++) if (W.deals[i] && !W.deals[i].done && !W.deals[i].expired) open++;
  html += '<div class="card">'
    + statrow("Deals signed", String(st.deals))
    + statrow("Cash received", fm(st.dealCash), st.dealCash > 0 ? "up" : "")
    + statrow("Slot bonuses earned", fm(st.dealBonus), st.dealBonus > 0 ? "up" : "")
    + statrow("Open commitments", String(open))
    + "</div>";
  html += '<div class="sechead"><h2>On the table</h2></div>';
  var shown = 0;
  for (i = 0; i < WINDOW_DEALS.length; i++) {
    var d = WINDOW_DEALS[i], taken = false, j;
    for (j = 0; j < W.deals.length; j++) if (W.deals[j] && W.deals[j].id === d.id && !W.deals[j].expired) taken = true;
    if (taken) continue;
    var needRep = (S.studio.rep || 0) < d.rep;
    var winTxt = d.minWindow >= 90 ? "90-day or longer" : (d.maxWindow + "-day or shorter");
    html += '<div class="card film"><div class="head"><div class="title">' + esc(d.streamer) + " \u00B7 " + esc(d.name) + "</div>"
      + tag(fm(d.pay) + " up front", "gold") + "</div>";
    html += '<div class="meta">' + tag(winTxt, "blue") + tag(d.films + " film(s)")
      + tag(fm(d.bonus) + " a slot") + tag(d.weeks + " wk term")
      + (d.rep > 0 ? tag("Rep " + d.rep + "+", needRep ? "red" : "green") : "") + "</div>";
    html += statrow(esc(d.note), '<button class="btn primary sm" data-action="window-deal" data-key="'
      + d.id + '"' + (needRep ? " disabled" : "") + ">Sign</button>");
    html += "</div>";
    shown++;
  }
  if (!shown) html += '<div class="card"><div class="empty"><span class="em">\uD83D\uDCC4</span>Every offer is signed or lapsed. New terms arrive as your reputation grows.</div></div>';

  html += '<div class="sechead"><h2>Active commitments</h2></div>';
  var act = 0;
  for (i = 0; i < W.deals.length; i++) {
    r = W.deals[i];
    if (!r || r.done || r.expired) continue;
    var pct = Math.round((r.used / r.films) * 100);
    html += '<div class="card"><div class="head"><div class="title">' + esc(r.streamer) + "</div>"
      + tag(r.used + "/" + r.films + " slots", pct >= 100 ? "green" : "blue") + "</div>"
      + '<div class="bar' + (pct >= 100 ? " green" : "") + '"><i style="width:' + Math.min(100, pct) + '%"></i></div>'
      + statrow("Paid on signing", fm(r.pay))
      + statrow("Slot bonuses earned", fm(r.paid || 0), (r.paid || 0) > 0 ? "up" : "")
      + statrow("Expires", "wk " + r.expiresWk + (r.expiresWk > windowWeek() ? " (" + (r.expiresWk - windowWeek()) + " wk)" : " \u00B7 due"))
      + "</div>";
    act++;
  }
  if (!act) html += '<div class="card"><div class="empty"><span class="em">\uD83E\uDD1D</span>No streamer is holding a slot of yours.</div></div>';

  html += '<div class="sechead"><h2>Recent openings</h2></div>';
  if (!W.history.length) {
    html += '<div class="card"><div class="empty"><span class="em">\uD83D\uDCC5</span>No film has opened yet.</div></div>';
  } else {
    html += '<div class="card">';
    for (i = 0; i < W.history.length && i < 8; i++) {
      var h = W.history[i];
      html += statrow(esc(h.title) + " \u00B7 " + h.window + "d",
        (h.pvd > 0 ? fm(h.pvd) : "\u2014"), h.pvd > 0 ? "up" : "");
    }
    html += "</div>";
  }
  return html;
}

var WINDOW_DESKS = [
  { id: "window-strategy", group: "Distribution", icon: "\uD83C\uDF9E\uFE0F", name: "Window strategy",
    desc: "Pick the theatrical window film by film \u2014 the estimated rental and streaming trade-off in dollars before you commit.",
    render: windowStrategyDesk },
  { id: "window-deals", group: "Distribution", icon: "\uD83D\uDCC4", name: "Output deals",
    desc: "Streamer output deals that pay up front for a window commitment, with every slot tracked to its expiry.",
    render: windowDealsDesk }
];

/* ── achievements (merged by meta.js via allAchievements) ─────── */
var WINDOW_ACHIEVEMENTS = [
  { id: "window-first-pvod", tier: 1, name: "Second window",
    desc: "Collect your first PVOD window cheque.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && S.win.stats.pvodFilms >= 1; } },
  { id: "window-day-date", tier: 1, name: "Day and date",
    desc: "Release a film on a PVOD-first window.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && S.win.stats.wPvod >= 1; } },
  { id: "window-exclusive", tier: 2, name: "The long hold",
    desc: "Release a film on a full 90-day theatrical exclusive.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && S.win.stats.wExcl >= 1; } },
  { id: "window-four-doors", tier: 3, name: "Every door",
    desc: "Release films on all four window lengths.",
    test: function (S) {
      if (!S || !S.win || !S.win.stats) return false;
      var st = S.win.stats;
      return st.wPvod >= 1 && st.wShort >= 1 && st.wStd >= 1 && st.wExcl >= 1;
    } },
  { id: "window-first-deal", tier: 1, name: "Signed on the line",
    desc: "Sign your first streamer output deal.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && S.win.stats.deals >= 1; } },
  { id: "window-deal-done", tier: 2, name: "All slots delivered",
    desc: "Complete an output deal without letting a slot lapse.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && S.win.stats.dealsDone >= 1; } },
  { id: "window-pvod-25", tier: 2, name: "Streaming money",
    desc: "Bank $25M in PVOD window income across your career.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && isFinite(S.win.stats.pvod) && S.win.stats.pvod >= 25; } },
  { id: "window-buy-back", tier: 2, name: "Buy back the screens",
    desc: "Buy an exclusive extension on a film already in theaters.",
    test: function (S) { return !!S && !!S.win && !!S.win.stats && S.win.stats.extends >= 1; } }
];
