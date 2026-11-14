/* Box Office War — rebuilt. Empire & Franchises module (game/empire.js).
   Systems: franchise tracking + crossover events · shared universe (lore, fatigue,
   revival campaigns) · merchandising lines · theme park ·
   sports megadome · stage division (three playhouses, musical lifecycle) · shorts studio.
   All state lives under S.emp (lazy ensure for old saves). Weekly parts run in
   tickEmpire(); player actions in empireAction(a, elx); desk bodies exported as
   EMPIRE_DESKS. Money in $M.
   Note: the integrator hooks (tickEmpire call inside advanceWeek, empireAction
   delegation, desk-opener UI) are not present in the current engine.js/ui.js, so this
   file self-wraps advanceWeek and self-opens its own sheets. The week-stamp guard keeps
   tickEmpire a no-op once the in-engine hook also fires. */
"use strict";

/* ── data ─────────────────────────────────────────────────────── */
var EMP_HOUSES = [
  { id: "yard",    name: "The Yard",    seats: 340,  lease: 0.25, capMult: 0.25, note: "Always available." },
  { id: "marquee", name: "Marquee",     seats: 1000, lease: 0.5,  capMult: 1.0,  note: "Unlocks when a show recoups, or reputation reaches 50." },
  { id: "empire",  name: "Empire Hall", seats: 1800, lease: 0.8,  capMult: 1.5,  note: "Unlocks at reputation 75." }
];
var EMP_MERCH = [
  { id: "toys",    name: "Toys",    cost: 15, wks: 12, mult: 1.2 },
  { id: "apparel", name: "Apparel", cost: 8,  wks: 10, mult: 0.6 },
  { id: "game",    name: "Game",    cost: 40, wks: 16, mult: 2.5 }
];
var EMP_PARK = { costs: [80, 60, 90], mults: [1, 1.6, 2.2] };
var EMP_CAPS = [20, 40, 60];
var EMP_COMPOSERS = [{ fee: 2, bonus: 0 }, { fee: 5, bonus: 3 }, { fee: 10, bonus: 6 }];

var STAGE = null;    /* in-desk greenlight form state */
var CUR_DESK = null; /* desk currently open in the sheet */

/* ── state ────────────────────────────────────────────────────── */
function empEnsure() {
  if (!S) return;
  if (!S.emp) S.emp = {};
  var e = S.emp;
  if (typeof e.lastTick !== "number") e.lastTick = 0;
  if (!e.franchises) e.franchises = [];
  if (!e.counted) e.counted = [];
  if (!e.merch) e.merch = [];
  if (!e.shorts) e.shorts = [];
  if (typeof e.shortsMade !== "number") e.shortsMade = 0;
  if (!e.stage) e.stage = {};
  if (!e.stage.shows) e.stage.shows = [];
  if (!e.frReleases) e.frReleases = {};
  if (typeof e.frYear !== "number") e.frYear = S.studio.year;
  if (!e.fatigueRelief) e.fatigueRelief = {};
  if (!e.revivalBoost) e.revivalBoost = {};
  if (!e.loreCounted) e.loreCounted = [];
  /* crossover / park / dome / universe stay null until the player builds or charters them */
}
function empFindFr(name) {
  var i;
  for (i = 0; i < S.emp.franchises.length; i++) if (S.emp.franchises[i].name === name) return S.emp.franchises[i];
  return null;
}
function empHeatSum() {
  var t = 0, i;
  for (i = 0; i < S.emp.franchises.length; i++) t += S.emp.franchises[i].heat;
  return t;
}
function empHouse(id) {
  var i;
  for (i = 0; i < EMP_HOUSES.length; i++) if (EMP_HOUSES[i].id === id) return EMP_HOUSES[i];
  return null;
}
function empFindShow(id) {
  var i;
  for (i = 0; i < S.emp.stage.shows.length; i++) if (S.emp.stage.shows[i].id === id) return S.emp.stage.shows[i];
  return null;
}
function empShowAt(houseId) {
  var i;
  for (i = 0; i < S.emp.stage.shows.length; i++) {
    if (S.emp.stage.shows[i].house === houseId && S.emp.stage.shows[i].phase !== "closed") return S.emp.stage.shows[i];
  }
  return null;
}
function empMarqueeUnlocked() {
  var i;
  if (S.studio.rep >= 50) return true;
  for (i = 0; i < S.emp.stage.shows.length; i++) if (S.emp.stage.shows[i].recouped) return true;
  return false;
}
function empHouseUnlocked(id) {
  if (id === "yard") return true;
  if (id === "marquee") return empMarqueeUnlocked();
  return S.studio.rep >= 75;
}
function empMerchDef(kind) {
  var i;
  for (i = 0; i < EMP_MERCH.length; i++) if (EMP_MERCH[i].id === kind) return EMP_MERCH[i];
  return null;
}
/* A film-based line has no franchise heat; scale it off the film's worldwide gross
   (spec leaves this open): 1 heat per $150M ww, clamped 1..4. */
function empLineHeat(L) {
  var i, fr, f;
  if (L.srcType === "fr") {
    fr = empFindFr(L.srcId);
    return fr ? fr.heat : 0;
  }
  f = findFilm(L.srcId);
  return f ? clamp(Math.round((f.ww || 0) / 150), 1, 4) : 0;
}

/* ── wave 3: shared universe — lore, crossover scaling, fatigue, revival ── */
function empYearSync() {
  if (S.emp.frYear !== S.studio.year) {
    S.emp.frYear = S.studio.year;
    S.emp.frReleases = {}; /* new studio year: franchise-release counts (fatigue) reset */
  }
}
function empFrCount() { return S.emp.frReleases[S.studio.year] || 0; }
function empGlobalFatigue() {
  var c = empFrCount();
  return c > 2 ? Math.min(60, (c - 2) * 30) : 0;
}
function empFatigueFor(name) {
  return Math.max(0, empGlobalFatigue() - (S.emp.fatigueRelief[name] || 0));
}
/* Engine hook (expectedOpening). Crossover premium only with a chartered universe —
   the engine already grants sequels ×1.30 on its own. The one-shot revival boost is
   consumed only by a real release: ui previews call this with an id-less probe. */
function franchiseOpeningMult(p) {
  if (!S) return 1;
  empEnsure();
  empYearSync();
  if (!S.emp.universe || !p || !p.franchiseOf) return 1;
  var mult = 1 + 0.18 * (S.emp.franchises.length - 1) * (S.emp.universe.lore / 85);
  mult = Math.min(mult, 1.65);
  mult *= 1 - empFatigueFor(p.franchiseOf) / 150;
  if (S.emp.revivalBoost[p.franchiseOf]) {
    mult *= 1.18;
    if (p.id) delete S.emp.revivalBoost[p.franchiseOf];
  }
  return mult;
}
/* Scenario hook: stage shows that have recouped their capitalisation */
function empRecoupCount() {
  if (!S || !S.emp || !S.emp.stage || !S.emp.stage.shows) return 0;
  var n = 0, i;
  for (i = 0; i < S.emp.stage.shows.length; i++) if (S.emp.stage.shows[i].recouped === true) n++;
  return n;
}

/* ── small ui/ledger guards (ui.js may not be loaded in tests) ── */
function empToast(txt, kind) {
  if (typeof pushToast === "function") pushToast(txt, kind);
  else if (typeof toast === "function") toast(txt, kind);
}
function empAttr(elx, n) { return elx && elx.getAttribute ? elx.getAttribute(n) : null; }
function empAfterAction() {
  saveGame();
  if (typeof render === "function") render();
  empRerenderDesk();
}
function empDesk(id) {
  var i;
  for (i = 0; i < EMPIRE_DESKS.length; i++) if (EMPIRE_DESKS[i].id === id) return EMPIRE_DESKS[i];
  return null;
}
function empDeskShell(d) {
  return '<div class="sheet-head"><h3>' + d.icon + " " + esc(d.name) + '</h3>'
    + '<button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div>'
    + '<div class="sheet-body">' + d.render() + "</div>";
}
function empOpenDesk(id) {
  var d = empDesk(id);
  if (!d) return;
  CUR_DESK = id;
  if (typeof openSheet === "function") openSheet(empDeskShell(d));
}
function empRerenderDesk() {
  if (!CUR_DESK) return;
  if (typeof el === "function") { var w = el("sheetWrap"); if (!w || w.hidden) { CUR_DESK = null; return; } }
  if (typeof rerenderSheet !== "function") return;
  var d = empDesk(CUR_DESK);
  if (d) rerenderSheet(empDeskShell(d));
}

/* ── weekly tick ──────────────────────────────────────────────── */
function tickEmpire() {
  if (!S || S.over) return;
  empEnsure();
  if (S.emp.lastTick === S.studio.week) return; /* once per week, even if engine also calls us */
  S.emp.lastTick = S.studio.week;
  empYearSync();
  /* fatigue event: fans review-bomb a running franchise film */
  if (empGlobalFatigue() >= 20 && chance(0.1)) {
    var fbf = [];
    for (var fbi = 0; fbi < S.films.length; fbi++) if (S.films[fbi].status === "run" && S.films[fbi].franchiseOf) fbf.push(S.films[fbi]);
    if (fbf.length) {
      var fb = pick(fbf);
      fb.legs = Math.max(1.4, fb.legs - 0.08);
      fb.decay = 1 - 1 / fb.legs;
      log("👎 Franchise fatigue — fans review-bomb “" + fb.title + "”. Legs weaken.", "bad", "👎");
    }
  }
  empTickFranchises();
  empTickLore();
  empTickMerch();
  empTickPark();
  empTickDome();
  empTickStage();
  empTickShorts();
  saveGame();
}

/* (1) franchises: auto-track projects, count released films, pay off crossovers */
function empTickFranchises() {
  var i, p, f, fr;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (!p.franchiseOf || empFindFr(p.franchiseOf)) continue;
    S.emp.franchises.push({ name: p.franchiseOf, entries: 1, heat: 1 });
    log("🚀 “" + p.franchiseOf + "” is now a tracked franchise — heat and merchandising go live.", "gold", "🚀");
  }
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (!f.franchiseOf || S.emp.counted.indexOf(f.id) >= 0) continue;
    S.emp.counted.push(f.id);
    fr = empFindFr(f.franchiseOf);
    if (!fr) { fr = { name: f.franchiseOf, entries: 0, heat: 0 }; S.emp.franchises.push(fr); }
    fr.heat++; fr.entries++;
    S.emp.frReleases[S.studio.year] = (S.emp.frReleases[S.studio.year] || 0) + 1;
    if (S.emp.universe && f.quality >= 60) S.emp.universe.lore = clamp(S.emp.universe.lore + 3, 40, 100);
    log("🚀 “" + f.title + "” extends the " + f.franchiseOf + " franchise — heat " + fr.heat + "."
      + (S.emp.universe ? " Universe lore " + S.emp.universe.lore + "." : ""), "", "🚀");
    var x = S.emp.crossover;
    if (x && !x.used && (x.a === f.franchiseOf || x.b === f.franchiseOf)) {
      x.used = true;
      earn(15, "Crossover payoff · " + x.a + " × " + x.b);
      log("💥 Crossover event pays off — “" + x.a + "” × “" + x.b + "” earns " + fm(15) + " one-time.", "gold", "💥");
    }
  }
}

/* (1b) lore: franchise flops (profit settles at end of run) dent the shared universe */
function empTickLore() {
  if (!S.emp.universe) return;
  var i, f;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (!f.franchiseOf || f.status !== "done" || typeof f.profit !== "number" || S.emp.loreCounted.indexOf(f.id) >= 0) continue;
    S.emp.loreCounted.push(f.id);
    if (f.profit < -f.cost * 0.35) {
      S.emp.universe.lore = clamp(S.emp.universe.lore - 8, 40, 100);
      log("📉 The “" + f.franchiseOf + "” flop dents the shared universe — lore falls to " + S.emp.universe.lore + ".", "bad", "🌐");
    }
  }
}

/* (2) merch: weekly royalties, expiry with news */
function empTickMerch() {
  var i, L, def;
  for (i = S.emp.merch.length - 1; i >= 0; i--) {
    L = S.emp.merch[i];
    def = empMerchDef(L.kind);
    if (!def) { S.emp.merch.splice(i, 1); continue; }
    if (S.studio.week >= L.until) {
      S.emp.merch.splice(i, 1);
      log("🧸 The " + def.name.toLowerCase() + " line for “" + L.srcName + "” has run its course.", "", "🧸");
      continue;
    }
    earn(empLineHeat(L) * def.mult * 0.4, "Merch · " + def.name + " · " + L.srcName);
  }
}

/* (3) theme park */
function empTickPark() {
  var P = S.emp.park;
  if (!P) return;
  earn((0.5 + 0.15 * empHeatSum()) * P.mult, "Theme park gates");
}

/* (4) sports megadome */
function empTickDome() {
  var D = S.emp.dome;
  if (!D) return;
  if (D.naming) {
    if (S.studio.week >= D.naming.until) { D.naming = null; log("🏟️ The naming-rights deal ended — the sign comes down.", "", "🏟️"); }
    else earn(D.naming.weekly, "Dome naming rights");
  }
  if (D.skyboxes) earn(0.8, "Dome skyboxes");
  if (D.sports) {
    if (S.studio.week >= D.sports.until) D.sports = null;
    else earn(1, "Dome sports events");
  }
  if (!D.naming && !D.offer && (S.studio.week % 52) >= 10 && (S.studio.week % 52) <= 50 && chance(0.25)) {
    D.offer = true;
    log("🏟️ A brand wants its name on your megadome — " + fm(1.5) + "/wk for 52 weeks. Accept at the Empire desk.", "gold", "🏟️");
  }
}

/* (5) stage division: rehearse → previews → run, lease, recoup, album, close */
function empTickStage() {
  var i, sh, h, gross, proj;
  for (i = 0; i < S.emp.stage.shows.length; i++) {
    sh = S.emp.stage.shows[i];
    if (sh.album) {
      if (S.studio.week < sh.album.until) earn(0.4, "Cast album · " + sh.title);
      else sh.album = null;
    }
    if (sh.tour) {
      if (S.studio.week < sh.tour.until) earn(1.8, "Tour · " + sh.title);
      else sh.tour = null;
    }
    if (sh.phase === "closed") continue;
    sh.total++;
    h = empHouse(sh.house);
    if (sh.phase === "rehearse") {
      sh.age++;
      spend(sh.cap / 4, "Rehearsals · " + sh.title);
      if (sh.age >= 4) { sh.phase = "previews"; sh.age = 0; log("🎭 “" + sh.title + "” starts previews at " + h.name + " — tickets at 40%.", "", "🎭"); }
      continue;
    }
    if (sh.phase === "previews") {
      sh.age++;
      proj = 45 + sh.cap / 10 + sh.compBonus + (sh.adapt ? 5 : 0) + sh.revBoost;
      gross = Math.round(h.seats * (0.0012 + proj / 80000) * 0.4 * 10) / 10;
      earn(gross, "Theatre · " + sh.title);
      sh.grossSum += gross; sh.lastGross = gross;
      spend(h.lease, "House lease · " + h.name);
      if (sh.age >= 3) {
        sh.reviews = clamp(Math.round(45 + sh.cap / 10 + sh.compBonus + (sh.adapt ? 5 : 0) + sh.revBoost + gauss() * 8), 5, 98);
        sh.occ = 0.35 + sh.reviews / 100 * 0.5 + (sh.adapt ? 0.1 : 0);
        sh.phase = "run"; sh.age = 0; sh.runWk = 0;
        log("🎭 “" + sh.title + "” opens officially — reviews " + sh.reviews + "/100, " + Math.round(sh.occ * 100) + "% house.", sh.reviews >= 60 ? "good" : "", "🎭");
      }
      continue;
    }
    /* run */
    sh.age++; sh.runWk++;
    gross = Math.round(h.seats * (0.0012 + sh.reviews / 80000) * sh.occ * 10) / 10;
    earn(gross, "Theatre · " + sh.title);
    sh.grossSum += gross; sh.lastGross = gross;
    spend(h.lease, "House lease · " + h.name);
    sh.occ = sh.occ * 0.975;
    if (sh.occ < 0.3) sh.lowStreak++; else sh.lowStreak = 0;
    if (!sh.recouped && sh.grossSum >= sh.cap * 2) {
      var wasUnlocked = empHouseUnlocked("marquee");
      sh.recouped = true;
      S.studio.rep = clamp(S.studio.rep + 3, 0, 100);
      sh.album = { until: S.studio.week + 26 };
      log("🎭 “" + sh.title + "” recoups its " + fm(sh.cap) + " capitalisation — reputation +3, cast album records for 26 weeks.", "gold", "🎭");
      if (!wasUnlocked && empHouseUnlocked("marquee")) log("🎭 Marquee Theatre (1,000 seats) is now available.", "gold", "🎭");
    }
    if (sh.lowStreak >= 6 || sh.total > 100) {
      sh.phase = "closed";
      log("🎭 “" + sh.title + "” closes at " + h.name + " after " + sh.total + " weeks — " + fm(sh.grossSum) + " grossed.", "", "🎭");
    }
  }
}

/* (6) shorts: 8 weekly episodes per season, chance of talent discovery */
function empTickShorts() {
  var i, se;
  for (i = S.emp.shorts.length - 1; i >= 0; i--) {
    se = S.emp.shorts[i];
    se.eps--;
    earn(ri(20, 120) / 100, "Shorts · " + se.label);
    if (chance(0.15)) empDiscoverActor();
    if (se.eps <= 0) { S.emp.shorts.splice(i, 1); log("📱 " + se.label + " wrapped.", "", "📱"); }
  }
}
function empDiscoverActor() {
  if (S.market.length >= 40) return;
  var t = genTalent("actor");
  t.power = Math.min(t.power, 3); /* shorts find raw talent */
  t.fee = FEE_ACTOR[t.power - 1];
  S.market.push(t);
  log("📱 Shorts discovery: " + t.n + " goes viral and joins your roster (★" + t.power + ").", "good", "📱");
}

/* ── actions ──────────────────────────────────────────────────── */
function empCanCrossover() {
  var n = 0, i;
  for (i = 0; i < S.emp.franchises.length; i++) if (S.emp.franchises[i].heat >= 2) n++;
  if (n < 2) return false;
  if (S.emp.crossover && !S.emp.crossover.used) return false;
  return S.studio.cash >= 30;
}
function empDoCrossover() {
  var el = [], i;
  for (i = 0; i < S.emp.franchises.length; i++) if (S.emp.franchises[i].heat >= 2) el.push(S.emp.franchises[i]);
  el.sort(function (a, b) { return b.heat - a.heat || b.entries - a.entries; });
  if (el.length < 2) { empToast("Need two franchises at heat 2 or higher.", "bad"); return; }
  if (S.emp.crossover && !S.emp.crossover.used) { empToast("A crossover event is already in play.", "bad"); return; }
  if (S.studio.cash < 30) { empToast("Need " + fm(30) + " for a crossover event.", "bad"); return; }
  spend(30, "Crossover event · " + el[0].name + " × " + el[1].name);
  el[0].heat += 2; el[1].heat += 2;
  S.emp.crossover = { a: el[0].name, b: el[1].name, used: false };
  log("💥 Crossover event greenlit: “" + el[0].name + "” × “" + el[1].name + "”. Heat surges on both — the next release of either pays " + fm(15) + ".", "gold", "💥");
  empToast("Crossover event is live.", "good");
}

/* wave 3: charter the shared universe ($30M, permanent, needs two franchises) */
function empDoCharter() {
  if (S.emp.universe) { empToast("The shared universe is already chartered.", "bad"); return; }
  if (S.emp.franchises.length < 2) { empToast("Chartering a universe needs two tracked franchises.", "bad"); return; }
  if (S.studio.cash < 30) { empToast("Need " + fm(30) + " to charter a shared universe.", "bad"); return; }
  spend(30, "Shared universe charter");
  S.emp.universe = { chartered: true, lore: 85 };
  /* grandfather films whose runs already ended pre-charter — lore only reacts to
     flops that settle while the universe exists */
  for (var i = 0; i < S.films.length; i++) {
    if (S.films[i].franchiseOf && S.films[i].status === "done" && S.emp.loreCounted.indexOf(S.films[i].id) < 0) S.emp.loreCounted.push(S.films[i].id);
  }
  log("🌐 Shared universe chartered — franchise openings now scale with lore and fatigue (lore starts at 85).", "gold", "🌐");
  empToast("Shared universe chartered.", "good");
}
/* wave 3: $8M revival per fatigued franchise — −14 fatigue pts + one-shot +18% next opening */
function empDoRevival(name) {
  if (!S.emp.universe) { empToast("Charter a shared universe first.", "bad"); return; }
  if (!name || !empFindFr(name)) { empToast("No such franchise.", "bad"); return; }
  if (empFatigueFor(name) <= 0) { empToast("“" + name + "” is not fatigued right now.", "bad"); return; }
  if (S.studio.cash < 8) { empToast("Need " + fm(8) + " for a revival campaign.", "bad"); return; }
  spend(8, "Revival campaign · " + name);
  S.emp.fatigueRelief[name] = (S.emp.fatigueRelief[name] || 0) + 14;
  S.emp.revivalBoost[name] = true;
  log("📢 Revival campaign for “" + name + "” — fatigue −14 pts, and its next release opens +18%.", "gold", "📢");
  empToast("Revival campaign is live.", "good");
}

function empHasLine(srcType, srcId) {
  var i;
  for (i = 0; i < S.emp.merch.length; i++) if (S.emp.merch[i].srcType === srcType && S.emp.merch[i].srcId === srcId) return true;
  return false;
}
function empMerchSources() {
  var out = [], i, fr, f;
  for (i = 0; i < S.emp.franchises.length; i++) {
    fr = S.emp.franchises[i];
    if (fr.heat >= 2 && !empHasLine("fr", fr.name)) out.push({ dataId: "fr:" + fr.name, name: fr.name, note: "heat " + fr.heat });
  }
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status === "done" && (f.ww || 0) >= 150 && !empHasLine("film", f.id)) out.push({ dataId: "film:" + f.id, name: f.title, note: fm(f.ww) + " ww" });
  }
  return out;
}
function empDoMerch(dataId, kind) {
  var def = empMerchDef(kind), srcType, srcId, srcName, fr, f;
  if (!def || !dataId) { empToast("Pick a property and a line.", "bad"); return; }
  srcType = dataId.indexOf("fr:") === 0 ? "fr" : "film";
  srcId = dataId.slice(srcType === "fr" ? 3 : 5);
  if (srcType === "fr") {
    fr = empFindFr(srcId);
    if (!fr || fr.heat < 2) { empToast("That franchise is not hot enough for merch.", "bad"); return; }
    srcName = fr.name;
  } else {
    f = findFilm(srcId);
    if (!f || f.status !== "done" || (f.ww || 0) < 150) { empToast("That film does not qualify for merch.", "bad"); return; }
    srcName = f.title;
  }
  if (empHasLine(srcType, srcId)) { empToast("“" + srcName + "” already has a merch line.", "bad"); return; }
  if (S.studio.cash < def.cost) { empToast("Need " + fm(def.cost) + " for a " + def.name.toLowerCase() + " line.", "bad"); return; }
  spend(def.cost, "Merch · " + def.name + " · " + srcName);
  S.emp.merch.push({ id: "em" + (S.seq++), kind: kind, srcType: srcType, srcId: srcId, srcName: srcName, until: S.studio.week + def.wks });
  log("🧸 " + def.name + " line launches for “" + srcName + "” — " + def.wks + " weeks of royalties.", "gold", "🧸");
  empToast(def.name + " line is on shelves.", "good");
}

function empDoParkBuild() {
  if (S.emp.park) { empToast("The park is already open.", "bad"); return; }
  if (S.studio.cash < 80) { empToast("Need " + fm(80) + " to build the park.", "bad"); return; }
  spend(80, "Theme park construction");
  S.emp.park = { tier: 1, mult: 1 };
  log("🎢 Theme park opens on the backlot — gates earn weekly, boosted by franchise heat.", "gold", "🎢");
  empToast("Theme park is open.", "good");
}
function empDoParkExpand() {
  var P = S.emp.park, cost;
  if (!P) { empToast("Build the park first.", "bad"); return; }
  if (P.tier >= 3) { empToast("The park is at maximum size.", "bad"); return; }
  cost = EMP_PARK.costs[P.tier];
  if (S.studio.cash < cost) { empToast("Need " + fm(cost) + " to expand.", "bad"); return; }
  spend(cost, "Theme park expansion");
  P.tier++; P.mult = EMP_PARK.mults[P.tier - 1];
  log("🎢 Park expansion opens — income ×" + P.mult + ".", "gold", "🎢");
  empToast("Park expanded to tier " + P.tier + ".", "good");
}

function empDoDomeBuild() {
  if (S.emp.dome) { empToast("The megadome already stands.", "bad"); return; }
  if (S.studio.cash < 70) { empToast("Need " + fm(70) + " to break ground.", "bad"); return; }
  spend(70, "Sports megadome construction");
  S.emp.dome = { naming: null, offer: false, skyboxes: false, sports: null, sportsWk: 0 };
  log("🏟️ Sports megadome opens. Naming-rights suitors will come calling.", "gold", "🏟️");
  empToast("Megadome is open.", "good");
}
function empDoDomeNaming() {
  var D = S.emp.dome;
  if (!D || !D.offer) { empToast("No naming-rights offer on the table.", "bad"); return; }
  D.offer = false;
  D.naming = { weekly: 1.5, until: S.studio.week + 52 };
  log("🏟️ Naming-rights deal signed — " + fm(1.5) + "/wk for 52 weeks.", "gold", "🏟️");
  empToast("Naming rights sold.", "good");
}
function empDoDomeSky() {
  var D = S.emp.dome;
  if (!D) { empToast("Build the megadome first.", "bad"); return; }
  if (D.skyboxes) { empToast("Skyboxes are already built.", "bad"); return; }
  if (S.studio.cash < 30) { empToast("Need " + fm(30) + " for the skyboxes.", "bad"); return; }
  spend(30, "Dome skyboxes");
  D.skyboxes = true;
  log("🏟️ Skyboxes open — " + fm(0.8) + "/wk, permanently.", "gold", "🏟️");
  empToast("Skyboxes built.", "good");
}
function empDoDomeSports() {
  var D = S.emp.dome;
  if (!D) { empToast("Build the megadome first.", "bad"); return; }
  if (D.sportsWk && S.studio.week - D.sportsWk < 52) { empToast("The sports package can be booked once per year.", "bad"); return; }
  if (S.studio.cash < 25) { empToast("Need " + fm(25) + " for the sports package.", "bad"); return; }
  spend(25, "Dome sports package");
  D.sportsWk = S.studio.week;
  if (S.tv && S.tv.streamer) {
    S.tv.streamer.subs = (S.tv.streamer.subs || 0) + 2;
    log("🏟️ Sports package lands on your streamer — subscribers +2M.", "gold", "🏟️");
  } else {
    D.sports = { until: S.studio.week + 12 };
    log("🏟️ Sports package booked — dome events gross " + fm(1) + "/wk for 12 weeks.", "", "🏟️");
  }
  empToast("Sports package booked.", "good");
}

/* stage: greenlight form + commit + retool + tour */
function empStageFormOpen(houseId) {
  var h = empHouse(houseId);
  if (!h) return;
  if (!empHouseUnlocked(houseId)) { empToast(h.name + " is not unlocked yet.", "bad"); return; }
  if (empShowAt(houseId)) { empToast(h.name + " already has a show on its stage.", "bad"); return; }
  STAGE = { house: houseId, srcFilm: null, capIdx: 0, compIdx: 0 };
  empRerenderDesk();
}
function empAdaptFilms() {
  var out = [], i;
  for (i = 0; i < S.films.length; i++) {
    if (S.films[i].status === "done" && (S.films[i].ww || 0) >= 40) out.push(S.films[i]);
  }
  return out;
}
function empStageGo() {
  var h, comp, src, adapt, srcName, show;
  if (!STAGE) { empToast("Pick a house first.", "bad"); return false; }
  h = empHouse(STAGE.house);
  if (!h || !empHouseUnlocked(h.id) || empShowAt(h.id)) { STAGE = null; return false; }
  comp = EMP_COMPOSERS[STAGE.compIdx];
  if (S.studio.cash < comp.fee) { empToast("Need " + fm(comp.fee) + " for the composer.", "bad"); return false; }
  adapt = false; srcName = null; src = null;
  if (STAGE.srcFilm) {
    src = findFilm(STAGE.srcFilm);
    if (src && src.status === "done" && (src.ww || 0) >= 40) { adapt = true; srcName = src.title; }
  }
  spend(comp.fee, "Composer · " + h.name);
  show = {
    id: "em" + (S.seq++), title: genTitle(), house: h.id,
    cap: Math.round(EMP_CAPS[STAGE.capIdx] * h.capMult * 10) / 10, compFee: comp.fee, compBonus: comp.bonus,
    adapt: adapt, srcFilm: adapt ? src.id : null, srcName: srcName,
    phase: "rehearse", age: 0, total: 0, runWk: 0,
    revBoost: 0, rettools: 0, reviews: null, occ: 0, grossSum: 0, lastGross: 0,
    recouped: false, lowStreak: 0, tour: null, album: null
  };
  S.emp.stage.shows.push(show);
  log("🎭 “" + show.title + "” enters rehearsal at " + h.name + (adapt ? " — adapted from “" + srcName + "”" : "") + ". Capitalisation " + fm(show.cap) + ".", "", "🎭");
  STAGE = null;
  empToast("Rehearsals begin.", "good");
  return true;
}
function empDoRetool(showId) {
  var sh = empFindShow(showId);
  if (!sh || sh.phase !== "previews") { empToast("Retools are only possible during previews.", "bad"); return; }
  if (sh.rettools >= 2) { empToast("This show has already been retooled twice.", "bad"); return; }
  if (S.studio.cash < 2.5) { empToast("Need " + fm(2.5) + " for a retool.", "bad"); return; }
  spend(2.5, "Retool · " + sh.title);
  sh.rettools++; sh.revBoost += 4;
  log("🔧 “" + sh.title + "” gets a retool during previews — projections +4.", "", "🎭");
}
function empDoTour(showId) {
  var sh = empFindShow(showId);
  if (!sh || sh.phase !== "run" || sh.tour) { empToast("No running show to tour.", "bad"); return; }
  if (sh.reviews < 70 || sh.runWk < 16) { empToast("Tours need reviews 70+ and a 16-week run.", "bad"); return; }
  if (S.studio.cash < 12) { empToast("Need " + fm(12) + " upfront for the tour.", "bad"); return; }
  spend(12, "Tour · " + sh.title);
  sh.tour = { until: S.studio.week + 10 };
  log("🎭 “" + sh.title + "” launches a touring production — " + fm(1.8) + "/wk for 10 weeks.", "gold", "🎭");
  empToast("Tour is on the road.", "good");
}

function empDoShorts() {
  if (S.studio.cash < 5) { empToast("Need " + fm(5) + " to produce a season.", "bad"); return; }
  spend(5, "Shorts season");
  S.emp.shortsMade++;
  S.emp.shorts.push({ id: "em" + (S.seq++), label: "Season " + S.emp.shortsMade, eps: 8 });
  log("📱 Shorts season " + S.emp.shortsMade + " commissioned — eight weekly episodes.", "", "📱");
  empToast("Shorts season commissioned.", "good");
}

function empireAction(a, elx) {
  if (typeof a !== "string" || a.indexOf("emp-") !== 0) return false;
  if (!S || S.over) return false;
  empEnsure();
  switch (a) {
    case "emp-desk": empOpenDesk(empAttr(elx, "data-id")); return true;
    case "emp-x-go": empDoCrossover(); empAfterAction(); return true;
    case "emp-universe-charter": empDoCharter(); empAfterAction(); return true;
    case "emp-revival": empDoRevival(empAttr(elx, "data-id")); empAfterAction(); return true;
    case "emp-merch": empDoMerch(empAttr(elx, "data-id"), empAttr(elx, "data-key")); empAfterAction(); return true;
    case "emp-park-build": empDoParkBuild(); empAfterAction(); return true;
    case "emp-park-expand": empDoParkExpand(); empAfterAction(); return true;
    case "emp-dome-build": empDoDomeBuild(); empAfterAction(); return true;
    case "emp-dome-naming": empDoDomeNaming(); empAfterAction(); return true;
    case "emp-dome-sky": empDoDomeSky(); empAfterAction(); return true;
    case "emp-dome-sports": empDoDomeSports(); empAfterAction(); return true;
    case "emp-stage-open": empStageFormOpen(empAttr(elx, "data-id")); return true;
    case "emp-stage-cancel": STAGE = null; empRerenderDesk(); return true;
    case "emp-stage-src":
      if (STAGE) { STAGE.srcFilm = empAttr(elx, "data-key") === "orig" ? null : empAttr(elx, "data-key"); empRerenderDesk(); }
      return true;
    case "emp-stage-cap":
      if (STAGE) { STAGE.capIdx = clamp(+(empAttr(elx, "data-idx") || 0) || 0, 0, 2); empRerenderDesk(); }
      return true;
    case "emp-stage-comp":
      if (STAGE) { STAGE.compIdx = clamp(+(empAttr(elx, "data-idx") || 0) || 0, 0, 2); empRerenderDesk(); }
      return true;
    case "emp-stage-go": if (empStageGo()) empAfterAction(); return true;
    case "emp-stage-retool": empDoRetool(empAttr(elx, "data-id")); empAfterAction(); return true;
    case "emp-stage-tour": empDoTour(empAttr(elx, "data-id")); empAfterAction(); return true;
    case "emp-shorts-go": empDoShorts(); empAfterAction(); return true;
  }
  return false;
}

/* ── desks ────────────────────────────────────────────────────── */
/* wave 3: shared universe card — charter, lore, yearly fatigue, revival campaigns */
function empDeskUniverse() {
  var html = '<div class="sechead"><h2>Shared universe</h2></div><div class="card">';
  if (!S.emp.universe) {
    var needFr = S.emp.franchises.length < 2;
    html += statrow("Status", "Not chartered")
      + statrow("Effect", "Franchise openings scale with lore, up to ×1.65")
      + '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-universe-charter" '
      + (needFr || S.studio.cash < 30 ? "disabled" : "") + ">Charter universe · " + fm(30) + "</button></div>"
      + '<div class="empty" style="padding:6px 0 0">' + (needFr ? "Needs two tracked franchises · " : "")
      + "Cash after: " + fm(S.studio.cash - 30) + " · chartering is permanent.</div>";
    return html + "</div>";
  }
  var i, eff = empGlobalFatigue(), fatigued = false;
  html += statrow("Lore", S.emp.universe.lore + " / 100", S.emp.universe.lore >= 85 ? "up" : "")
    + statrow("Franchises linked", S.emp.franchises.length)
    + statrow("Franchise releases this year", empFrCount())
    + statrow("Franchise fatigue", eff > 0 ? eff + " pts · openings ×" + Math.round((1 - eff / 150) * 100) / 100 : "None", eff > 0 ? "" : "up");
  for (i = 0; i < S.emp.franchises.length; i++) {
    var fr = S.emp.franchises[i], pts = empFatigueFor(fr.name);
    if (pts <= 0) continue;
    fatigued = true;
    html += '<div class="statrow"><span class="k">' + esc(fr.name) + " · " + pts + " pts fatigue</span>"
      + '<button class="btn sm" data-action="emp-revival" data-id="' + esc(fr.name) + '" '
      + (S.studio.cash < 8 ? "disabled" : "") + ">Revive · " + fm(8) + "</button></div>";
  }
  if (fatigued) html += '<div class="empty" style="padding:6px 0 0">A revival campaign eases that franchise by 14 pts and opens its next film +18%.</div>';
  html += '<div class="empty" style="padding:6px 0 0">Quality franchise releases +3 lore · flops −8 · fatigue builds past 2 franchise releases a year.</div>';
  return html + "</div>";
}

function empDeskFranchises() {
  empEnsure();
  if (!S) return "";
  var html = "", i, fr, x;
  if (!S.emp.franchises.length) {
    html += '<div class="empty"><span class="em">🚀</span>No franchises tracked yet. Greenlight a sequel pitch (or any project marked as a franchise) to begin.</div>';
    return html;
  }
  html += '<div class="sechead"><h2>Tracked franchises</h2></div><div class="card">';
  for (i = 0; i < S.emp.franchises.length; i++) {
    fr = S.emp.franchises[i];
    html += statrow(esc(fr.name), "heat " + fr.heat + " · " + fr.entries + " film" + (fr.entries === 1 ? "" : "s"), fr.heat >= 2 ? "up" : "");
  }
  html += "</div>";
  html += empDeskUniverse();
  x = S.emp.crossover;
  html += '<div class="sechead"><h2>Crossover event</h2></div><div class="card">';
  if (x && !x.used) {
    html += statrow("In play", esc(x.a) + " × " + esc(x.b), "up")
      + '<div class="empty" style="padding:6px 0 2px">The next release of either franchise pays ' + fm(15) + ".</div>";
  } else {
    html += statrow("Status", x ? "Last event paid out" : "No event yet", "");
  }
  html += '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-x-go" ' + (empCanCrossover() ? "" : "disabled")
    + ">Crossover · " + fm(30) + "</button></div>"
    + '<div class="empty" style="padding:6px 0 0">Picks your two hottest franchises · cash after ' + fm(S.studio.cash - 30) + " · needs two at heat 2+.</div></div>";
  return html;
}

function empDeskMerch() {
  empEnsure();
  if (!S) return "";
  var html = '<div class="sechead"><h2>Active lines</h2></div><div class="card">', i, j, L, def, srcs, s, d2;
  if (!S.emp.merch.length) html += '<div class="empty" style="padding:10px 0 2px"><span class="em">🧸</span>No lines running.</div>';
  for (i = 0; i < S.emp.merch.length; i++) {
    L = S.emp.merch[i];
    def = empMerchDef(L.kind);
    html += statrow(def.name + " · " + esc(L.srcName),
      fm(empLineHeat(L) * def.mult * 0.4) + "/wk · " + Math.max(L.until - S.studio.week, 0) + " wks left", "up");
  }
  html += "</div>";
  srcs = empMerchSources();
  html += '<div class="sechead"><h2>Launch a line</h2></div>';
  if (!srcs.length) {
    html += '<div class="empty"><span class="em">🧸</span>Nothing qualifies yet — needs a franchise at heat 2+, or a finished film past ' + fm(150) + " worldwide.</div>";
  } else {
    for (i = 0; i < srcs.length; i++) {
      s = srcs[i];
      html += '<div class="card"><div class="statrow"><span class="k">' + esc(s.name) + "</span><span class=\"v\">" + tag(s.note, "gold") + "</span></div>"
        + '<div class="foot btnrow">';
      for (j = 0; j < EMP_MERCH.length; j++) {
        d2 = EMP_MERCH[j];
        html += '<button class="btn sm" data-action="emp-merch" data-id="' + esc(s.dataId) + '" data-key="' + d2.id + '" '
          + (S.studio.cash < d2.cost ? "disabled" : "") + ">" + d2.name + " · " + fm(d2.cost) + "</button>";
      }
      html += "</div></div>";
    }
  }
  return html;
}

function empDeskPark() {
  empEnsure();
  if (!S) return "";
  var P = S.emp.park;
  var html = '<div class="sechead"><h2>Theme park</h2></div><div class="card">';
  if (!P) {
    html += statrow("Status", "Not built")
      + statrow("Weekly gates", fm(0.5) + " + " + fm(0.15) + " × total franchise heat")
      + '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-park-build" '
      + (S.studio.cash < 80 ? "disabled" : "") + ">Build park · " + fm(80) + "</button></div>"
      + '<div class="empty" style="padding:6px 0 0">Cash after: ' + fm(S.studio.cash - 80) + "</div></div>";
    return html;
  }
  html += statrow("Tier", P.tier + " / 3")
    + statrow("Income multiplier", "×" + P.mult)
    + statrow("Weekly gates", fm((0.5 + 0.15 * empHeatSum()) * P.mult), "up");
  if (P.tier < 3) {
    var cost = EMP_PARK.costs[P.tier];
    html += '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-park-expand" '
      + (S.studio.cash < cost ? "disabled" : "") + ">Expand · " + fm(cost) + " → ×" + EMP_PARK.mults[P.tier] + "</button></div>"
      + '<div class="empty" style="padding:6px 0 0">Cash after: ' + fm(S.studio.cash - cost) + "</div>";
  } else {
    html += '<div class="empty" style="padding:6px 0 0">Fully expanded — the biggest park in town.</div>';
  }
  return html + "</div>";
}

function empDeskDome() {
  empEnsure();
  if (!S) return "";
  var D = S.emp.dome;
  var html = '<div class="sechead"><h2>Sports megadome</h2></div><div class="card">';
  if (!D) {
    html += statrow("Status", "Not built")
      + '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-dome-build" '
      + (S.studio.cash < 70 ? "disabled" : "") + ">Build dome · " + fm(70) + "</button></div>"
      + '<div class="empty" style="padding:6px 0 0">Cash after: ' + fm(S.studio.cash - 70) + "</div></div>";
    return html;
  }
  if (D.naming) html += statrow("Naming rights", fm(D.naming.weekly) + "/wk · " + Math.max(D.naming.until - S.studio.week, 0) + " wks left", "up");
  else if (D.offer) html += statrow("Naming offer on the table", fm(1.5) + "/wk × 52 wks")
    + '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-dome-naming">Accept naming deal</button></div>';
  else html += statrow("Naming rights", "No offer on the table");
  if (D.skyboxes) html += statrow("Skyboxes", "+" + fm(0.8) + "/wk", "up");
  else html += '<div class="statrow"><span class="k">Skyboxes (' + fm(30) + " → +" + fm(0.8) + '/wk)</span>'
    + '<button class="btn sm" data-action="emp-dome-sky" ' + (S.studio.cash < 30 ? "disabled" : "") + ">Build</button></div>";
  if (D.sports) html += statrow("Sports events", fm(1) + "/wk · " + Math.max(D.sports.until - S.studio.week, 0) + " wks left", "up");
  else html += '<div class="statrow"><span class="k">Sports package (' + fm(25) + (S.tv && S.tv.streamer ? " · +2M streamer subs" : " · " + fm(1) + "/wk × 12 wks") + ')</span>'
    + '<button class="btn sm" data-action="emp-dome-sports" '
    + ((D.sportsWk && S.studio.week - D.sportsWk < 52) || S.studio.cash < 25 ? "disabled" : "") + ">Book</button></div>";
  return html + "</div>";
}

function empStageFormHTML() {
  var h = empHouse(STAGE.house);
  var html = '<div class="sechead"><h2>Greenlight · ' + esc(h.name) + "</h2></div><div class=\"card\">";
  var adapt = empAdaptFilms(), i;
  html += '<div class="field-label">Source</div><div class="seg">';
  html += '<button class="' + (STAGE.srcFilm ? "" : "on") + '" data-action="emp-stage-src" data-key="orig">Original</button>';
  for (i = 0; i < adapt.length && i < 6; i++) {
    html += '<button class="' + (STAGE.srcFilm === adapt[i].id ? "on" : "") + '" data-action="emp-stage-src" data-key="' + adapt[i].id + '">'
      + esc(adapt[i].title) + "</button>";
  }
  if (!adapt.length) html += "<button disabled>No film to adapt</button>";
  html += "</div>";
  html += '<div class="field-label">Capitalisation</div><div class="seg">';
  var capH = empHouse(STAGE.house);
  for (i = 0; i < EMP_CAPS.length; i++) {
    html += '<button class="' + (STAGE.capIdx === i ? "on" : "") + '" data-action="emp-stage-cap" data-idx="' + i + '">' + fm(EMP_CAPS[i] * (capH ? capH.capMult : 1)) + "</button>";
  }
  html += "</div>";
  html += '<div class="field-label">Composer</div><div class="seg">';
  for (i = 0; i < EMP_COMPOSERS.length; i++) {
    html += '<button class="' + (STAGE.compIdx === i ? "on" : "") + '" data-action="emp-stage-comp" data-idx="' + i + '">'
      + fm(EMP_COMPOSERS[i].fee) + " · +" + EMP_COMPOSERS[i].bonus + " reviews</button>";
  }
  html += "</div>";
  var comp = EMP_COMPOSERS[STAGE.compIdx];
  html += '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-stage-go" '
    + (S.studio.cash < comp.fee ? "disabled" : "") + ">Rehearse · " + fm(comp.fee) + " now, " + fm(EMP_CAPS[STAGE.capIdx] * (capH ? capH.capMult : 1) / 4) + "/wk after</button>"
    + '<button class="btn sm" data-action="emp-stage-cancel">Cancel</button></div></div>';
  return html;
}

function empDeskStage() {
  empEnsure();
  if (!S) return "";
  var html = '<div class="sechead"><h2>Playhouses</h2></div>', i, h, sh;
  for (i = 0; i < EMP_HOUSES.length; i++) {
    h = EMP_HOUSES[i];
    sh = empShowAt(h.id);
    var unlocked = empHouseUnlocked(h.id);
    html += '<div class="card film"><div class="head"><div class="title">🎭 ' + esc(h.name) + "</div>"
      + tag(h.seats + " seats · " + fm(h.lease) + "/wk lease", unlocked ? "blue" : "") + "</div>";
    if (!unlocked) {
      html += '<div class="meta">' + tag("🔒 " + h.note) + "</div>";
    } else if (!sh) {
      html += '<div class="foot btnrow"><button class="btn sm grow" data-action="emp-stage-open" data-id="' + h.id + '">Greenlight a musical</button></div>';
    } else if (sh.phase === "rehearse") {
      html += '<div class="meta">' + tag("Rehearsals · " + Math.max(4 - sh.age, 0) + " wks left", "blue")
        + tag(fm(sh.cap) + " cap")
        + (sh.adapt ? tag("Adapted" + (sh.srcName ? " from “" + esc(sh.srcName) + "”" : ""), "blue") : "") + "</div>";
    } else if (sh.phase === "previews") {
      html += '<div class="meta">' + tag("Previews · " + Math.max(3 - sh.age, 0) + " wks left", "gold")
        + tag(fm(sh.lastGross) + "/wk (40%)")
        + (sh.rettools ? tag(sh.rettools + "× retooled", "blue") : "") + "</div>";
      if (sh.rettools < 2) {
        html += '<div class="foot btnrow"><button class="btn sm" data-action="emp-stage-retool" data-id="' + sh.id + '" '
          + (S.studio.cash < 2.5 ? "disabled" : "") + ">Retool · " + fm(2.5) + " → +4 projected</button></div>";
      }
    } else { /* run */
      html += '<div class="meta">' + tag("Reviews " + sh.reviews + "/100", sh.reviews >= 60 ? "green" : "red")
        + tag(Math.round(sh.occ * 100) + "% house")
        + tag(fm(sh.lastGross) + "/wk", "gold")
        + tag(sh.recouped ? "Recouped" : "Not recouped", sh.recouped ? "gold" : "")
        + (sh.album ? tag("Cast album", "blue") : "")
        + (sh.tour ? tag("On tour", "blue") : "") + "</div>";
      if (!sh.tour && sh.reviews >= 70 && sh.runWk >= 16) {
        html += '<div class="foot btnrow"><button class="btn sm" data-action="emp-stage-tour" data-id="' + sh.id + '" '
          + (S.studio.cash < 12 ? "disabled" : "") + ">Launch tour · " + fm(12) + "</button></div>";
      }
    }
    html += "</div>";
  }
  if (STAGE) html += empStageFormHTML();
  var closed = [];
  for (i = 0; i < S.emp.stage.shows.length; i++) if (S.emp.stage.shows[i].phase === "closed") closed.push(S.emp.stage.shows[i]);
  if (closed.length) {
    html += '<div class="sechead"><h2>Closed runs</h2></div><div class="card">';
    for (i = Math.max(closed.length - 3, 0); i < closed.length; i++) {
      html += statrow(esc(closed[i].title), fm(closed[i].grossSum) + " grossed · " + closed[i].total + " wks");
    }
    html += "</div>";
  }
  return html;
}

function empDeskShorts() {
  empEnsure();
  if (!S) return "";
  var html = '<div class="sechead"><h2>Shorts studio</h2></div><div class="card">';
  html += statrow("Seasons produced", S.emp.shortsMade)
    + statrow("Per episode", fm(0.2) + "–" + fm(1.2))
    + '<div class="foot btnrow"><button class="btn primary sm grow" data-action="emp-shorts-go" '
    + (S.studio.cash < 5 ? "disabled" : "") + ">Produce a season · " + fm(5) + "</button></div>";
  var i;
  for (i = 0; i < S.emp.shorts.length; i++) html += statrow(S.emp.shorts[i].label, S.emp.shorts[i].eps + " episodes left", "");
  html += "</div>"
    + '<div class="empty"><span class="em">📱</span>Eight weekly episodes per season — and a 15% chance each one discovers new talent for your roster.</div>';
  return html;
}

var EMPIRE_DESKS = [
  { id: "emp-franchise", group: "Empire & Franchises", icon: "🚀", name: "Franchises & crossover", desc: "Track franchise heat and launch crossover events.", render: empDeskFranchises },
  { id: "emp-merch", group: "Empire & Franchises", icon: "🧸", name: "Merchandising", desc: "Toys, apparel and game lines on hot properties.", render: empDeskMerch },
  { id: "emp-park", group: "Empire & Franchises", icon: "🎢", name: "Theme park", desc: "Gate income scaled by total franchise heat.", render: empDeskPark },
  { id: "emp-dome", group: "Empire & Franchises", icon: "🏟️", name: "Sports megadome", desc: "Naming rights, skyboxes and a sports package.", render: empDeskDome },
  { id: "emp-stage", group: "Empire & Franchises", icon: "🎭", name: "Stage division", desc: "Three playhouses — greenlight and run musicals.", render: empDeskStage },
  { id: "emp-shorts", group: "Empire & Franchises", icon: "📱", name: "Shorts studio", desc: "Weekly short seasons; a talent scout on the side.", render: empDeskShorts }
];

/* Wiring lives in engine.js (tickEmpire) and ui.js (empireAction + desk shell) — no self-wiring needed. */
