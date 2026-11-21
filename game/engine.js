/* Box Office War — rebuilt. Simulation engine (DOM-free).
   Money in $M · one global state S · persisted to localStorage.
   Math ported & simplified from the v41 engine (see rebuild-notes/engine-audit.md):
   opening = scale.openBase × genre factors × star × marketing × season × rep × clash
   legs    = 1.55 + (quality-30)×0.026 + genre.legs ± WOM, weekly gross decays geometrically. */
"use strict";

/* ── tiny helpers ─────────────────────────────────────────────── */
function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function rf(a, b) { return Math.random() * (b - a) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return Math.random() < p; }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.577; }
function fm(x) {
  if (!isFinite(x)) return "$—";
  var neg = x < 0, a = Math.abs(x), s;
  if (a >= 950) s = "$" + (a / 1000).toFixed(2) + "B";
  else if (a >= 10) s = "$" + Math.round(a) + "M";
  else s = "$" + a.toFixed(1) + "M";
  return neg ? "-" + s : s;
}
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function genName() { return pick(FIRST_NAMES) + " " + pick(LAST_NAMES); }
function genTitle() { return pick(TITLE_A) + " " + pick(TITLE_B).trim(); }

/* ── state ────────────────────────────────────────────────────── */
var S = null;
var SAVE_KEY = "bow2.save.v1";
var WEEKS_PER_YEAR = 52;

function woyOf(week) { return ((week - 1) % WEEKS_PER_YEAR) + 1; }

function newState(name, originId, diff) {
  var o = null, i;
  for (i = 0; i < ORIGINS.length; i++) if (ORIGINS[i].id === originId) o = ORIGINS[i];
  S = {
    v: 1,
    over: false,
    origin: o.id,
    diff: diff || "std",
    studio: { name: name, cash: o.cash, rep: o.rep, week: 1, woy: 1, year: 1, catalog: 0, lifetime: 0 },
    upg: { post: 0, backlot: 0 },
    loans: [],
    econ: { box: 1 },
    seq: 1,
    market: [],           // available talent (not currently booked)
    ideas: [],            // 6 scripts on the development desk
    projects: [],         // films being made: pre → shoot → post → ready
    films: [],            // my released films
    series: [],           // series in production or airing
    rFilms: [],           // rival films (recent, capped)
    rivals: [],           // studios with release slots
    news: [],             // newest first, capped
    weekTx: null,         // current week P&L
    txHistory: [],        // last 10 weeks
    pending: null,        // a modal choice the player must answer
    flash: [],            // toasts queued by this week's tick
    agency: { founded: false, clients: [] },
    lot: { writers: 0, crew: 0, vfx: 0 },
    trends: {},
    mezz: 0, strike: 0, piracy: 0,
    stats: { releases: 0, hits: 0, flops: 0, bestOpen: 0, bestWW: 0, milestones: {} },
    yearOfFilms: []       // film ids released this year, for the year-end awards
  };
  var j;
  var rpm = diff === "easy" ? 0.88 : diff === "hard" ? 1.15 : 1;
  for (j = 0; j < RIVAL_DEFS.length; j++) S.rivals.push({ name: RIVAL_DEFS[j].name, style: RIVAL_DEFS[j].style, strategy: RIVAL_DEFS[j].strategy || "", power: Math.round(rf(0.85, 1.15) * rpm * 100) / 100, slots: [], ytd: 0, lastRel: null });
  var k;
  for (k = 0; k < 20; k++) S.market.push(genTalent("actor"));
  for (k = 0; k < 9; k++) S.market.push(genTalent("dir"));
  S.market.push(genTalent("actor", "star"));
  S.market.push(genTalent("actor", "star"));
  S.market.push(genTalent("dir", "star"));
  while (S.ideas.length < 6) S.ideas.push(genIdea());
  GENRES.forEach(function (g) { S.trends[g.id] = 1; });
  seedRivalSlots();
  if (diff === "easy") S.studio.cash = Math.round(o.cash * 1.3);
  if (diff === "hard") S.studio.cash = Math.round(o.cash * 0.75);
  log("Welcome to " + name + ". Six scripts are waiting on your desk.", "gold", "🎬");
  return S;
}

function saveGame() {
  try {
    var prev = localStorage.getItem(SAVE_KEY);
    if (prev) {
      localStorage.setItem(SAVE_KEY + ".bak2", localStorage.getItem(SAVE_KEY + ".bak1") || "");
      localStorage.setItem(SAVE_KEY + ".bak1", localStorage.getItem(SAVE_KEY + ".bak0") || "");
      localStorage.setItem(SAVE_KEY + ".bak0", prev);
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch (e) { /* private mode — play on */ }
}
function loadGame() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    var s = JSON.parse(raw);
    if (!s || s.v !== 1 || !s.studio) return false;
    S = s;
    return true;
  } catch (e) { return false; }
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

/* ── ledger ───────────────────────────────────────────────────── */
function spend(amount, label) {
  amount = Math.round(amount * 10) / 10;
  S.studio.cash -= amount;
  if (S.weekTx) { S.weekTx.out += amount; S.weekTx.rows.push({ k: label, v: -amount }); }
}
function earn(amount, label) {
  amount = Math.round(amount * 10) / 10;
  S.studio.cash += amount;
  S.studio.lifetime += 0; /* lifetime tracks gross, not profit */
  if (S.weekTx) { S.weekTx.in += amount; S.weekTx.rows.push({ k: label, v: amount }); }
}
function log(txt, kind, ico) {
  S.news.unshift({ w: S.studio.week, y: S.studio.year, txt: txt, kind: kind || "", ico: ico || "🗞️" });
  if (S.news.length > 40) S.news.length = 40;
}
function toast(txt, kind) { S.flash.push({ txt: txt, kind: kind || "" }); }

/* ── calendar ─────────────────────────────────────────────────── */
function seasonOf(woy) {
  if (woy <= 3)  return { s: 0.78, name: "January doldrums", hol: false, scare: false };
  if (woy <= 8)  return { s: 0.92, name: "Winter", hol: false, scare: false };
  if (woy <= 17) return { s: 1.00, name: "Spring", hol: false, scare: false };
  if (woy <= 21) return { s: 1.08, name: "Early summer", hol: false, scare: false };
  if (woy <= 34) return { s: 1.22, name: "Summer season", hol: false, scare: false };
  if (woy <= 39) return { s: 1.00, name: "Fall", hol: false, scare: false };
  if (woy <= 44) return { s: 1.02, name: "Awards corridor", hol: false, scare: true };
  if (woy <= 47) return { s: 1.10, name: "Holidays ramp-up", hol: true, scare: false };
  return { s: 1.30, name: "Holiday corridor", hol: true, scare: false };
}

/* ── talent ───────────────────────────────────────────────────── */
function genTalent(kind, tier) {
  var r = Math.random(), power = r < 0.30 ? 1 : r < 0.60 ? 2 : r < 0.80 ? 3 : r < 0.94 ? 4 : 5;
  if (tier === "star") power = Math.max(power, 4);
  if (tier === "cheap") power = Math.min(power, 3);
  var fit = [pick(GENRES).id];
  if (chance(0.5)) fit.push(pick(GENRES).id);
  return {
    id: "t" + (S.seq++), k: kind, n: genName(),
    power: power,
    skill: clamp(ri(35, 68) + power * 7 + ri(0, 10), 30, 97),
    fee: kind === "actor" ? FEE_ACTOR[power - 1] : FEE_DIR[power - 1],
    ability: chance(power >= 4 ? 0.55 : 0.3) ? pick(ABILITIES).id : null,
    fit: fit,
    age: ri(24, 58), heat: 0,
    bookedUntil: 0
  };
}
function feeFor(t, budget) {
  var f = t.fee * clamp(budget / 120, 0.1, 1.05);
  if (t.ability === "bankable") f *= 0.85;
  if (isAgencyClient(t)) f *= 0.9;
  if (t.picDeal) f *= t.picDeal.pics >= 5 ? 0.75 : 0.85;
  if (S.heirAuteur && t.k === "dir") f *= 0.8;
  if (typeof agencyFeeMult === "function") f *= agencyFeeMult(t) || 1;
  if (typeof opsCastingFeeMult === "function") f *= opsCastingFeeMult() || 1;
  /* mentored talent signs cheaper — loyalty from the programme (mentor.js) */
  if (typeof mentorFeeMult === "function") f *= mentorFeeMult(t) || 1;
  /* v46: legacy studio tier improves talent terms (legacy.js) */
  if (typeof legacyFeeMult === "function") f *= legacyFeeMult(t) || 1;
  return Math.round(f * 10) / 10;
}
/* Supporting actors: each costs half a normal fee at the film's budget, and up to three may join a lead. */
var MAX_SUPPORT = 3;
function supportFee(t, budget) { return Math.round(feeFor(t, budget) * 0.5 * 10) / 10; }
/* Audience pull from supporting actors: each star above power 2 adds 0.5, capped at +3. Old saves have no supIds, so they get 0. */
function supportBonus(p) {
  var ids = (p && p.supIds) || [], sum = 0, i, t;
  for (i = 0; i < ids.length; i++) { t = findTalent(ids[i]); if (t) sum += Math.max(0, t.power - 2) * 0.5; }
  return Math.min(3, sum);
}
/* Opening multiplier from supporting cast: a strong bench sells tickets on the poster.
   Tuned so the greenlight estimate and the real release agree — both read this one
   function, so the number shown before greenlight is the number the film opens on
   (before the release-week randomisation). */
function supportOpenMult(p) {
  var b = supportBonus(p);            /* 0 … 3 audience points */
  if (!(b > 0)) return 1;
  return 1 + b * 0.06;                /* up to +18% opening with a full three-star bench */
}
function findTalent(id) { var i; for (i = 0; i < S.market.length; i++) if (S.market[i].id === id) return S.market[i]; return null; }
function findProject(id) { var i; for (i = 0; i < S.projects.length; i++) if (S.projects[i].id === id) return S.projects[i]; return null; }
function findFilm(id) { var i; for (i = 0; i < S.films.length; i++) if (S.films[i].id === id) return S.films[i]; return null; }
function findIdea(id) { var i; for (i = 0; i < S.ideas.length; i++) if (S.ideas[i].id === id) return S.ideas[i]; return null; }
function talentBusy(t) { return t.bookedUntil > S.studio.week; }

/* Talent market size. Raised from 34 so a lead can be paired with supporting actors. */
var MARKET_CAP = 60;
function churnTalent() {
  var n = 0, i;
  for (i = S.market.length - 1; i >= 0; i--) {
    if (!talentBusy(S.market[i]) && S.market[i].power <= 2 && chance(0.02)) S.market.splice(i, 1); /* quiet attrition */
  }
  if (chance(0.15) && S.market.length < MARKET_CAP) { S.market.push(genTalent("actor")); n++; }
  if (chance(0.10) && S.market.length < MARKET_CAP) { S.market.push(genTalent("dir")); n++; }
  return n;
}

/* ── development desk ─────────────────────────────────────────── */
function genIdea(franchiseOf) {
  var g = pick(GENRES);
  var script = clamp(ri(48, 84) + (chance(0.15) ? ri(6, 10) : 0) + Math.min(S.lot ? S.lot.writers : 0, 10) * 0.5, 42, 95);
  var idea = {
    id: "i" + (S.seq++),
    title: genTitle(), genre: g.id, script: script,
    price: Math.round((0.4 + script * 0.028) * 10) / 10,
    born: S.studio.week,
    theme: chance(0.4) ? pick(THEMES).id : null,
    franchiseOf: franchiseOf || null
  };
  if (franchiseOf) idea.price = Math.round(idea.price * 2.5 * 10) / 10;
  return idea;
}
function refreshIdeas() {
  var i;
  for (i = S.ideas.length - 1; i >= 0; i--) {
    if (S.studio.week - S.ideas[i].born > 14) S.ideas.splice(i, 1);
  }
  while (S.ideas.length < 6) S.ideas.push(genIdea());
}
function scoutScripts() {
  if (S.studio.cash < 1) return false;
  spend(1, "Scouting");
  S.ideas.push(genIdea());
  toast("Scouts delivered a new script.", "");
  return true;
}

/* Pitch your own concept: pay a development fee to put a bespoke idea on the desk. */
function pitchIdea(genreId, themeId, title) {
  if (S.studio.cash < 2) return { err: "Need $2M to develop a pitch." };
  if (S.ideas.length >= 8) return { err: "The desk is full — greenlight a script first." };
  spend(2, "Pitch development");
  var g = genreOf(genreId || pick(GENRES).id);
  var script = clamp(ri(52, 82) + Math.min(S.lot ? S.lot.writers : 0, 10) * 0.5, 42, 95);
  var idea = {
    id: "i" + (S.seq++),
    title: String(title || genTitle()).slice(0, 42),
    genre: g.id, script: script,
    price: Math.round((0.4 + script * 0.028) * 10) / 10,
    born: S.studio.week,
    theme: themeId || null,
    franchiseOf: null,
    pitched: true
  };
  S.ideas.push(idea);
  log("💡 Your pitch “" + idea.title + "” (" + g.name + ") clears development and lands on the desk.", "", "💡");
  return { ok: true, id: idea.id };
}

/* ── projects ─────────────────────────────────────────────────── */
function scaleAllowed(sc) { return S.studio.rep >= sc.rep; }

function greenlight(ideaId, cfg) {
  var idea = findIdea(ideaId);
  var sc = scaleOf(cfg.scale), dir = findTalent(cfg.dirId), act = findTalent(cfg.actorId);
  if (!idea || !dir || !act) return { err: "Pick a director and a lead actor." };
  if (!scaleAllowed(sc)) return { err: "Reputation " + sc.rep + " required for " + sc.name + "." };
  if (talentBusy(dir) || talentBusy(act)) return { err: "That talent is booked on another film." };
  var sup = [], si, st;
  var supIds = (cfg.supportIds || []).slice(0, MAX_SUPPORT);
  for (si = 0; si < supIds.length; si++) {
    st = findTalent(supIds[si]);
    if (!st || st.k !== "actor" || st === act || st === dir || sup.indexOf(st) >= 0) return { err: "Pick supporting actors from the list." };
    if (talentBusy(st)) return { err: st.n + " is booked on another film." };
    sup.push(st);
  }
  var budget = sc.budgets[cfg.bIdx];
  var scriptCost = Math.round(idea.price * (S.origin === "indie" ? 0.75 : 1) * 10) / 10;
  var dirFee = feeFor(dir, budget), actFee = feeFor(act, budget);
  if (cfg.packaged) { dirFee = Math.round(dirFee * 0.75 * 10) / 10; actFee = Math.round(actFee * 0.75 * 10) / 10; }
  var supFees = sup.map(function (t) { return supportFee(t, budget); });
  var supTotal = Math.round(supFees.reduce(function (a, b) { return a + b; }, 0) * 10) / 10;
  var upfront = scriptCost + dirFee + actFee + supTotal;
  if (S.studio.cash < upfront) return { err: "Need " + fm(upfront) + " upfront for script and talent." };

  spend(scriptCost, "Script · " + idea.title);
  spend(dirFee, "Director · " + dir.n);
  spend(actFee, "Lead · " + act.n);
  sup.forEach(function (t, i) { spend(supFees[i], "Supporting · " + t.n); });
  dir.bookedUntil = S.studio.week + 40; /* cleared when the film wraps its run */
  act.bookedUntil = S.studio.week + 40;
  sup.forEach(function (t) { t.bookedUntil = S.studio.week + 40; });

  var p = {
    id: "p" + (S.seq++),
    title: idea.title, genre: idea.genre, scale: sc.id,
    budget: budget, budgetNow: budget,
    script: idea.script + (idea.franchiseOf ? 5 : 0) + (cfg.packaged ? 4 : 0),
    dirId: dir.id, actId: act.id, dirFee: dirFee, actFee: actFee,
    supIds: sup.map(function (t) { return t.id; }),
    scriptCost: scriptCost,
    mktIdx: cfg.mktIdx != null ? cfg.mktIdx : 1,
    mkt: null, releaseWeek: null,
    phase: "pre", phaseWk: 0,
    phaseLen: { pre: ri(sc.pre[0], sc.pre[1]), shoot: ri(sc.shoot[0], sc.shoot[1]), post: ri(sc.post[0], sc.post[1]) },
    overrun: 0, scandal: false, buzz: 0,
    franchiseOf: idea.franchiseOf || null,
    theme: idea.theme || null,
    packaged: !!cfg.packaged,
    prodScore: 55 + S.upg.post * 3 + Math.min((S.lot.crew || 0) * 1.2 + (S.lot.vfx || 0) * 1.6, 12)
  };
  if (dir.ability === "method" || act.ability === "method") p.phaseLen.pre += 1;
  if (dir.ability === "fast" || act.ability === "fast") { p.phaseLen.shoot = Math.max(1, p.phaseLen.shoot - 2); p.noOverrun = true; }
  S.projects.push(p);
  var ix = S.ideas.indexOf(idea);
  if (ix >= 0) S.ideas.splice(ix, 1);
  log("Greenlit “" + p.title + "” — " + sc.name + " " + genreOf(p.genre).name + ", " + fm(budget) + " budget. " + esc(dir.n) + " directs, " + esc(act.n) + " stars.", "", "🎬");
  toast("“" + p.title + "” is in development.", "good");
  return { ok: true };
}

function tickProjects() {
  var i, p, frac, wk, burn, dir;
  /* shoot scheduling: overlapping productions strain the crew */
  var shoots = 0;
  for (i = 0; i < S.projects.length; i++) if (S.projects[i].phase === "shoot") shoots++;
  for (i = S.projects.length - 1; i >= 0; i--) {
    p = S.projects[i];
    if (p.phase === "ready") continue; /* awaiting release gate — no further burn */
    if (p.delayWk > 0) { p.delayWk--; spend(p.budget * 0.02, "Standing costs · " + p.title); continue; }
    p.phaseWk++;
    if (p.phase === "shoot" && shoots >= 2 && S.upg.backlot < 2) {
      p.overlapWk = (p.overlapWk || 0) + 1;
      if (p.overlapWk === 1) log("🎬 Two shoots share the lot — “" + p.title + "” loses focus while crews overlap.", "", "🎬");
    }
    frac = p.phase === "pre" ? 0.10 : p.phase === "shoot" ? 0.70 : 0.20;
    wk = p.phaseLen[p.phase];
    var lm = (typeof bizLocationMods === "function") ? bizLocationMods(p) : null;
    burn = (p.budgetNow * frac) / wk * (lm && lm.costMult ? lm.costMult : 1) * (S.strike > 0 ? 1.2 : 1);
    /* v46: guild relations drive the real labour multiplier (labor.js) */
    if (typeof laborCostMult === "function") burn *= laborCostMult() || 1;
    /* CFO lever: production cost discipline (opsuite.js) */
    if (typeof opsCostMult === "function") burn *= opsCostMult() || 1;
    spend(burn, "Production · " + p.title);
    if (p.phase === "shoot") {
      dir = findTalent(p.dirId);
      var risk = p.noOverrun ? 0 : clamp(0.15 - S.upg.backlot * 0.045 - ((dir ? dir.skill : 45) - 45) / 300, 0.03, 0.20);
      if (chance(risk)) {
        p.budgetNow += p.budget * 0.015;
        p.overrun++;
        log("“" + p.title + "” went over schedule — +" + fm(p.budget * 0.015) + " (overrun #" + p.overrun + ").", "bad", "⚠️");
      }
    }
    if (p.phaseWk >= wk) {
      if (p.phase === "pre") { p.phase = "shoot"; p.phaseWk = 0; }
      else if (p.phase === "shoot") { p.phase = "post"; p.phaseWk = 0; }
      else {
        p.phase = "ready"; p.phaseWk = 0;
        if (lm && lm.rebate) earn(Math.min(Math.round(p.budgetNow * lm.rebate * 10) / 10, lm.rebateCap || 9999), "Shoot rebate · " + p.title);
        computeQuality(p); log("“" + p.title + "” wrapped post-production. Ready for a release date.", "good", "🎞️"); toast("“" + p.title + "” is ready to schedule.", "good");
      }
    }
  }
}

function computeQuality(p) {
  var dir = findTalent(p.dirId), act = findTalent(p.actId);
  var g = genreOf(p.genre);
  var dirScore = (dir ? dir.skill : 45) + (dir && dir.fit.indexOf(p.genre) >= 0 ? 6 : 0);
  var castSkill = (act ? act.skill : 45) + (act && act.fit.indexOf(p.genre) >= 0 ? 6 : 0);
  var craft = 0.32 * p.script + 0.26 * dirScore + 0.24 * castSkill + 0.18 * p.prodScore + gauss() * 5.5;
  if (p.franchiseOf) craft += 2;
  if (p.theme) {
    for (var ti = 0; ti < THEMES.length; ti++) {
      if (THEMES[ti].id === p.theme && THEMES[ti].loves.indexOf(p.genre) >= 0) { craft += 5; break; }
    }
  }
  if (p.reshootBoost) craft += p.reshootBoost;
  if (p.leaked) craft -= 4;
  if (p.leakQ) craft -= 6;
  if (dir && dir.ability === "award") craft += 3;
  if (act && act.ability === "award") craft += 3;
  if (dir && dir.ability === "method") craft += 2;
  if (act && act.ability === "method") craft += 2;
  if (dir && dir.ability === "improv") craft += 4;
  if (act && act.ability === "improv") craft += 4;
  if (typeof chemCraftMod === "function") craft += chemCraftMod(p.dirId, p.actId) || 0;
  if (typeof techCraftBonus === "function") craft += techCraftBonus() || 0;
  if (typeof crewMods === "function") { var cmw = crewMods(p); if (cmw && cmw.craft) craft += cmw.craft; }
  if (typeof masteryCraftMod === "function") craft += masteryCraftMod(p.genre) || 0;
  /* talent mentoring: a graduate in the lead/director chair lifts the room (mentor.js) */
  if (typeof mentorCraftMod === "function") craft += mentorCraftMod(p.dirId, p.actId) || 0;
  /* v46: pre-planned sequels are better written (sequel.js) */
  if (typeof sequelCraftMod === "function") craft += sequelCraftMod(p) || 0;
  /* v46: assigned craft departments — DP, production design, sound, pre-viz (craft.js) */
  if (typeof craftDeptMods === "function") {
    var _cdm = craftDeptMods(p);
    if (_cdm && _cdm.craft) craft += _cdm.craft;
  }
  if (p.extendCraft) craft += p.extendCraft;
  if (p.reshootScene) craft += 2;
  if (p.cameoBoost) craft += p.cameoBoost;
  if (p.locationShoot) craft += 3;
  if (S.heirAuteur) craft += 2;
  craft -= Math.min(p.overlapWk || 0, 6) * 0.8;
  var lmQ = (typeof bizLocationMods === "function") ? bizLocationMods(p) : null;
  if (lmQ && lmQ.craft) craft += lmQ.craft;
  if (typeof bizQualityBonus === "function") craft += bizQualityBonus(p) || 0;
  var cm = (typeof creativeProjectMods === "function") ? creativeProjectMods(p) : null;
  if (cm && cm.craft) craft += cm.craft;
  p.quality = clamp(Math.round(craft), 5, 98);
  p.qPreview = clamp(Math.round(craft + gauss() * 6), 5, 98); /* what the studio thinks it has */
}

/* ── release & box office ─────────────────────────────────────── */
function setRelease(p, weekAbs, mktIdx, windowDays) {
  if (weekAbs <= S.studio.week) return { err: "Pick a future week." };
  if (weekAbs > S.studio.week + 12) return { err: "At most 12 weeks ahead." };
  p.mktIdx = mktIdx;
  p.window = windowDays || 45;
  var season = seasonOf(woyOf(p.releaseWeek));
  var seasonMult = season.hol ? 1.10 : (season.s >= 1.2 ? 1.05 : (season.s < 0.9 ? 0.90 : 1.0));
  var mkt = Math.round(p.budget * scaleOf(p.scale).mktRate * MKT_TIERS[mktIdx].mult * seasonMult * 10) / 10;
  if (S.studio.cash < mkt) return { err: "Need " + fm(mkt) + " free for the campaign." };
  spend(mkt, "Marketing · " + p.title);
  p.mkt = mkt;
  p.releaseWeek = weekAbs;
  log("“" + p.title + "” locks " + fm(mkt) + " in marketing and opens in " + (weekAbs - S.studio.week) + " week(s).", "", "📣");
  return { ok: true };
}

/* Weight of all rival films scheduled to open in a given week. */
function rivalWeightAt(weekAbs) {
  var w = 0, r, i;
  for (r = 0; r < S.rivals.length; r++) {
    for (i = 0; i < S.rivals[r].slots.length; i++) {
      if (S.rivals[r].slots[i].week === weekAbs && !S.rivals[r].slots[i].done) w += S.rivals[r].slots[i].openEst;
    }
  }
  return w;
}
function myWeightAt(weekAbs) {
  var w = 0, i;
  for (i = 0; i < S.projects.length; i++) {
    if (S.projects[i].releaseWeek === weekAbs && S.projects[i].phase === "ready") {
      w += scaleOf(S.projects[i].scale).openBase * genreOf(S.projects[i].genre).mass;
    }
  }
  return w;
}
function sameGenreRivalCount(weekAbs, genre) {
  var n = 0, r, i;
  for (r = 0; r < S.rivals.length; r++) {
    for (i = 0; i < S.rivals[r].slots.length; i++) {
      var s = S.rivals[r].slots[i];
      if (s.week >= weekAbs - 1 && s.week <= weekAbs + 1 && !s.done && s.genre === genre) n++;
    }
  }
  return n;
}
function holdoverCount() {
  var n = 0, i, l = filmsInRelease();
  for (i = 0; i < l.length; i++) if (l[i].opening >= 20) n++;
  return n;
}
function clashSeverity(weekAbs, myOpen) {
  var base = 1;
  var rw = rivalWeightAt(weekAbs);
  if (rw > 0) base = 1 / (1 + Math.pow(rw / Math.max(myOpen, 1), 0.8));
  if (base >= 0.85) return "LOW";
  return base >= 0.65 ? "MODERATE" : "CRITICAL";
}
function clashFactor(weekAbs, myOpen, genre) {
  var f = 1;
  var rw = rivalWeightAt(weekAbs);
  if (rw > 0) f = clamp(1 / (1 + Math.pow(rw / Math.max(myOpen, 1), 0.8)), 0.45, 1);
  var hc = holdoverCount();
  if (hc > 2) f *= 0.94;
  else if (hc > 0) f *= 0.97;
  if (genre) {
    if (["romance", "comedy", "horror", "drama"].indexOf(genre) >= 0 && rw > myOpen * 2) f *= 1.16;
    var same = sameGenreRivalCount(weekAbs, genre);
    if (same > 0) f *= Math.max(0.6, 1 - 0.12 * same);
  }
  return clamp(f, 0.4, 1.2);
}

function expectedOpening(p) {
  var g = genreOf(p.genre), sc = scaleOf(p.scale);
  var season = seasonOf(woyOf(p.releaseWeek));
  var act = findTalent(p.actId);
  var starF = 1 + 0.09 * Math.min(act ? act.power : 2, 5.5);
  if (p.scandal) starF *= 0.88;
  if (g.id === "horror" && season.scare) starF *= 1.25;
  var recM = Math.max(p.budget * sc.mktRate, 0.8);
  var mktF = clamp(Math.pow(Math.max(p.mkt, 0.8) / recM, 0.45), 0.5, 1.6);
  var repF = 0.92 + S.studio.rep / 600;
  var frF = p.franchiseOf ? 1.30 : 1;
  var buzzF = 1 + p.buzz * 0.02;
  var abF = 1;
  if (act && act.ability === "crowd") abF *= 1.08;
  if (p.franchiseOf && act && act.ability === "franchise") abF *= 1.08;
  var open = sc.openBase * g.mass * g.open * starF * mktF * season.s * repF * frF * buzzF * abF * S.econ.box;
  open *= supportOpenMult(p); /* supporting cast — the greenlight estimate reads the same factor */
  open *= ((S.trends && S.trends[p.genre]) || 1);
  /* v43.2: Collection Command — circuit screens, booking corridor, discount Tuesday lift the opening */
  if (typeof BoxOfficeCollection !== "undefined" && BoxOfficeCollection.openingMultiplier) open *= BoxOfficeCollection.openingMultiplier(p);
  if (typeof chemOpenMult === "function") open *= chemOpenMult(p) || 1;
  if (typeof socialBuzzMult === "function") open *= socialBuzzMult(p) || 1;
  if (typeof ticketPricingMult === "function") open *= ticketPricingMult(p) || 1;
  if (typeof masteryOpenMult === "function") open *= masteryOpenMult(p.genre) || 1;
  if (typeof screenCountMult === "function") open *= screenCountMult(p) || 1;
  if (typeof techOpenMult === "function") open *= techOpenMult() || 1;
  if (typeof plfOpeningMult === "function") open *= plfOpeningMult(p) || 1;
  if (typeof franchiseOpeningMult === "function") open *= franchiseOpeningMult(p) || 1;
  if (typeof imprintOpeningMult === "function") open *= imprintOpeningMult(p) || 1;
  if (typeof bizOpenMult === "function") open *= bizOpenMult(p) || 1;
  /* live ops: seasonal event genre multiplier (liveops.js) */
  if (typeof liveopsEventMult === "function") open *= liveopsEventMult(p.genre) || 1;
  /* marketing blitz campaigns bought for this release (mktblitz.js) */
  if (typeof blitzOpenMult === "function") open *= blitzOpenMult(p) || 1;
  /* v46: planned sequel anticipation, decaying per shipped entry (sequel.js) */
  if (typeof sequelOpenMult === "function") open *= sequelOpenMult(p) || 1;
  /* v46: studio legacy tier reach and brand weight (legacy.js) */
  if (typeof legacyOpenMult === "function") open *= legacyOpenMult(p) || 1;
  /* v46: legacy tier lifts the reputation factor that feeds the opening */
  if (typeof legacyRepBonus === "function") open *= (1 + (legacyRepBonus() || 0) / 100);
  /* v46: a bought counter-programming slot shields the opening (rivals.js) */
  if (typeof rivalCounterMult === "function") open *= rivalCounterMult(p) || 1;
  open *= rf(0.8, 1.25);
  open *= clashFactor(p.releaseWeek, open, p.genre);
  return clamp(open, 0.5, 320);
}

function reviewFilm(p, q) {
  var g = genreOf(p.genre), i, c, score, quotes = [];
  var scores = [];
  for (i = 0; i < 5; i++) {
    c = pick(CRITICS);
    var adj = c.harsh + (c.loves.indexOf(p.genre) >= 0 ? 4 : 0) - (c.hates.indexOf(p.genre) >= 0 ? 4 : 0);
    if (typeof criticRelAdj === "function") adj += criticRelAdj(c.n) || 0;
    score = clamp(Math.round(q + g.critic + adj + gauss() * 3), 5, 98);
    scores.push(score);
    var bank = score >= 75 ? QUOTE_GOOD : score >= 45 ? QUOTE_MID : QUOTE_BAD;
    quotes.push({ n: c.n, score: score, q: pick(bank).replace("{S}", p.title) });
  }
  var avg = 0, fresh = 0;
  for (i = 0; i < scores.length; i++) { avg += scores[i]; if (scores[i] >= 60) fresh++; }
  return { quotes: quotes, criticAvg: Math.round(avg / scores.length), freshPct: Math.round((fresh / scores.length) * 100) };
}

function releaseFilm(p) {
  var g = genreOf(p.genre);
  var opening = expectedOpening(p);
  var act0 = findTalent(p.actId), dir0 = findTalent(p.dirId);
  var qEff = p.quality - (p.recut ? 2 : 0) - (p.cut ? 2 : 0);
  var shield = (act0 && act0.ability === "shield") || (dir0 && dir0.ability === "shield") ? 3 : 0;
  /* campaign buzz lands before the review so it reaches the same release */
  if (typeof blitzBuzzAdd === "function") p.buzz = (p.buzz || 0) + (blitzBuzzAdd(p) || 0);
  var _bCritic = (typeof blitzCriticAdj === "function") ? (blitzCriticAdj(p) || 0) : 0;
  /* live ops amenity: screening lounge lifts critics (liveops.js) */
  if (typeof liveopsAmenityMods === "function") _bCritic += liveopsAmenityMods().critic || 0;
  /* v46: colour grade and final mix move the review score (craft.js) */
  if (typeof craftCriticAdj === "function") _bCritic += craftCriticAdj(p) || 0;
  var rv = reviewFilm(p, qEff + shield + _bCritic + ((typeof opsCreditMod === "function") ? (opsCreditMod(p) || 0) : 0));
  var act = act0;
  var cmR = (typeof creativeProjectMods === "function") ? creativeProjectMods(p) : null;
  /* v46: assigned craft departments also lift the audience score (craft.js) */
  var _cdmA = (typeof craftDeptMods === "function") ? craftDeptMods(p) : null;
  var aud = clamp(Math.round(qEff + g.aud + Math.min(act ? act.power : 2, 6) * 1.2 + supportBonus(p) + (p.recut ? 5 : 0) + (p.ratingAud || 0) + (p.pricingAud || 0) + (p.cameoAud || 0) + (cmR && cmR.aud ? cmR.aud : 0) + (_cdmA && _cdmA.aud ? _cdmA.aud : 0) + gauss() * 3), 5, 99);
  var season = seasonOf(woyOf(p.releaseWeek));
  var legs = 1.8 + (qEff - 30) * 0.03 + g.legs
    + (aud >= 80 ? 0.10 : aud <= 40 ? -0.15 : 0)
    + (season.hol ? 0.10 : 0);
  if (act && act.ability === "legs") legs += 0.10;
  if (cmR && cmR.legs) legs += cmR.legs;
  if (p.pricingLegs) legs += p.pricingLegs;
  if (p.screenLegs) legs += p.screenLegs;
  /* v46: a long theatrical-exclusive hold keeps screens and lengthens the tail (window.js).
     Passed a stub carrying the release window, since the film record is built below. */
  if (typeof windowLegsMult === "function") legs *= windowLegsMult({ window: p.window || 45, genre: p.genre }) || 1;
  /* v46: sound mix and pre-viz add real legs (craft.js) */
  if (_cdmA && _cdmA.legs) legs += _cdmA.legs;
  /* v43.2: Collection Command — levers extend the tail */
  if (typeof BoxOfficeCollection !== "undefined" && BoxOfficeCollection.legsBonus) legs += BoxOfficeCollection.legsBonus(f);
  legs = clamp(legs, 1.4, 4.4);
  var cost = Math.round((p.budgetNow + p.mkt + p.dirFee + p.actFee + p.scriptCost) * 10) / 10;
  var f = {
    id: "f" + (S.seq++), title: p.title, genre: p.genre, scale: p.scale,
    budget: p.budgetNow, mkt: p.mkt, cost: cost,
    dirId: p.dirId, actId: p.actId, supIds: p.supIds || [],
    quality: qEff, criticAvg: rv.criticAvg, freshPct: rv.freshPct, aud: aud, quotes: rv.quotes,
    opening: Math.round(opening * 10) / 10,
    legs: legs, decay: 1 - 1 / legs,
    weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: p.releaseWeek, season: season.name,
    franchiseOf: p.franchiseOf || null,
    presale: p.presale || 0, revShare: p.revShare || 0, insured: !!p.insured,
    screenRental: p.screenRental || 0,
    window: p.window || 45,
    status: "run"
  };
  S.films.unshift(f);
  S.stats.releases++;
  S.yearOfFilms.push(f.id);
  if (f.opening > S.stats.bestOpen) S.stats.bestOpen = f.opening;
  S.projects.splice(S.projects.indexOf(p), 1);
  if (S.stats.milestones && !S.stats.milestones.firstRelease) { S.stats.milestones.firstRelease = true; toast("🎬 Milestone: your first film is in theaters!", "good"); }
  log("“" + f.title + "” opens to " + fm(f.opening) + " — critics " + rv.criticAvg + "%, audiences " + aud + "%.", f.opening >= 40 ? "gold" : "", "🎟️");
  toast("“" + f.title + "” opens at " + fm(f.opening) + "!", f.opening >= 30 ? "good" : "");
  if (typeof chainWindowBump === "function") chainWindowBump(p.window || 45);
  if (typeof premiereApply === "function") premiereApply(p, f);
  /* consume the release-time campaign rows (mktblitz.js) */
  if (typeof blitzOnRelease === "function") blitzOnRelease(p);
  /* live ops: seasonal challenge credit + co-production gross share settle (liveops.js) */
  if (typeof liveopsCoprodShare === "function") {
    var _cpShare = liveopsCoprodShare(f) || 0;
    if (_cpShare > 0) spend(f.opening * _cpShare, "Co-production share · " + f.title);
  }
  if (typeof liveopsOnRelease === "function") liveopsOnRelease(f);
  /* v46: a planned sequel consumes its plan entry on release (sequel.js) */
  if (typeof sequelOnRelease === "function") sequelOnRelease(f);
  /* v46: distribution window registers the film's outing period (window.js) */
  if (typeof windowOnRelease === "function") windowOnRelease(f);
  return f;
}

function tickTheatrical() {
  var i, f, g, gross;
  for (i = S.films.length - 1; i >= 0; i--) {
    f = S.films[i];
    if (f.status !== "run") continue;
    g = genreOf(f.genre);
    f.weeksOut++;
    gross = f.opening * Math.pow(f.decay, f.weeksOut) * (seasonOf(woyOf(S.studio.week)).hol ? 1.18 : 1) * S.econ.box * (S.piracy > 0 ? 0.94 : 1);
    if (typeof BoxOfficeCollection !== "undefined" && BoxOfficeCollection.grossMultiplier) gross *= BoxOfficeCollection.grossMultiplier(f);
    if (typeof exhibitionGrossMult === "function") gross *= exhibitionGrossMult(f) || 1;
    gross = Math.round(gross * 10) / 10;
    if (gross < Math.max(0.25, f.opening * 0.006) || f.weeksOut > 16) { endTheatrical(f); continue; }
    f.dom += gross;
    f.weekly.push(gross);
    earn(gross * 0.52 * (typeof rentalSplitMult === "function" ? rentalSplitMult() : 1) * (1 + (f.screenRental || 0)), "Box office · " + f.title);
  }
}

function endTheatrical(f) {
  var g = genreOf(f.genre);
  var act = findTalent(f.actId);
  var share = clamp(g.intl + (act && act.ability === "intl" ? 0.05 : 0) + (typeof bizIntlBonus === "function" ? bizIntlBonus() : 0), 0.1, 0.8);
  var intl = f.dom * share / (1 - share);
  var intlRentals = intl * 0.42 * (1 - (f.presale || 0) - (f.revShare || 0) * 0.55);
  var pvod = (f.dom + intl) * 0.055 * (act && act.ability === "cult_icon" ? 1.35 : 1);
  /* v46: the chosen distribution window sets what the streaming cheque is worth (window.js) */
  if (typeof windowRevenueMult === "function") pvod *= windowRevenueMult(f) || 1;
  var ww = f.dom + intl;
  f.intl = Math.round(intl * 10) / 10;
  f.ww = Math.round(ww * 10) / 10;
  f.status = "done";
  earn(intlRentals, "International · " + f.title);
  earn(pvod, "Streaming & PVOD · " + f.title);
  S.studio.catalog += ww * 0.35;
  var rentMult = (typeof rentalSplitMult === "function" ? rentalSplitMult() : 1) * (1 + (f.screenRental || 0));
  var profit = f.dom * 0.52 * rentMult + intlRentals + pvod - f.cost;
  f.profit = Math.round(profit * 10) / 10;
  if (profit > 0) {
    S.stats.hits++;
    S.studio.rep = clamp(S.studio.rep + (ww >= f.cost * 2 ? 3 : 1), 0, 100);
  } else if (profit < -f.cost * 0.35) {
    S.stats.flops++;
    S.studio.rep = clamp(S.studio.rep - 3, 0, 100);
  }
  if (f.insured && profit < -f.cost * 0.5) {
    earn(Math.round(f.cost * 0.2 * 10) / 10, "Insurance claim · " + f.title);
    log("The completion bond pays out on “" + f.title + "”.", "good", "🛡️");
  }
  if (ww > S.stats.bestWW) S.stats.bestWW = ww;
  S.studio.lifetime += ww;
  var dir = findTalent(f.dirId);
  if (dir) { dir.bookedUntil = 0; if (profit > 0) { dir.heat = Math.min(dir.heat + 1, 3); dir.skill = Math.min(97, dir.skill + 2); } }
  if (act) { act.bookedUntil = 0; if (profit > 0) { act.heat = Math.min(act.heat + 1, 3); act.skill = Math.min(97, act.skill + 1); } }
  (f.supIds || []).forEach(function (id) { var st = findTalent(id); if (st) { st.bookedUntil = 0; if (profit > 0) st.heat = Math.min(st.heat + 1, 3); } });
  if (act && act.picDeal) {
    act.picDeal.pics--;
    if (act.picDeal.pics <= 0) { act.picDeal = null; log(act.n + "'s multi-picture deal is fulfilled.", "", "🤝"); }
  }
  /* Sequel opportunity */
  if (ww >= f.cost * 2.2 && f.quality >= 68 && !f.franchiseOf) {
    S.ideas.unshift(genIdea(f.title));
    log("“" + f.title + "” is a hit — a sequel pitch has landed on your desk.", "gold", "🚀");
  }
  var verdict = profit >= f.cost * 0.5 ? "a smash" : profit > 0 ? "a hit" : profit > -f.cost * 0.35 ? "a miss" : "a flop";
  log("“" + f.title + "” ends its run: " + fm(ww) + " worldwide — " + verdict + " (" + (profit >= 0 ? "+" : "") + fm(profit) + ").", profit > 0 ? "good" : "bad", profit > 0 ? "💰" : "📉");
  toast("“" + f.title + "”: " + fm(ww) + " worldwide, " + (profit >= 0 ? "+" : "") + fm(profit) + " net.", profit > 0 ? "good" : "bad");
}

/* ── rivals ───────────────────────────────────────────────────── */
var RIVAL_GENRES = {
  tentpole: ["action", "scifi", "fantasy", "animation"],
  prestige: ["drama", "crime", "romance", "docs", "musical"],
  genre: ["horror", "thriller", "comedy", "romance"]
};
function seedRivalSlots() {
  var r, i, n, woy, g, scId, sc, week;
  for (r = 0; r < S.rivals.length; r++) {
    var alive = 0;
    for (i = 0; i < S.rivals[r].slots.length; i++) if (!S.rivals[r].slots[i].done && S.rivals[r].slots[i].week > S.studio.week) alive++;
    if (alive >= 3) continue;
    n = ri(6, 10);
    for (i = 0; i < n; i++) {
      var pool = RIVAL_GENRES[S.rivals[r].style];
      g = genreOf(pick(pool));
      if (S.rivals[r].style === "tentpole") scId = chance(0.6) ? "tentpole" : "mid";
      else if (S.rivals[r].style === "prestige") scId = chance(0.55) ? "indie" : "mid";
      else scId = chance(0.5) ? "micro" : "indie";
      sc = scaleOf(scId);
      if (S.rivals[r].style === "tentpole") woy = chance(0.6) ? ri(18, 34) : ri(46, 52);
      else if (S.rivals[r].style === "prestige") woy = chance(0.6) ? ri(34, 46) : ri(1, 8);
      else woy = ri(1, 52);
      week = S.studio.week - (woyOf(S.studio.week) - 1) + woy; /* within the current game year */
      if (week <= S.studio.week + 1) week += WEEKS_PER_YEAR;
      var openEst = sc.openBase * g.mass * rf(0.7, 1.3) * S.rivals[r].power * (1 + S.econ.box * 0.1);
      S.rivals[r].slots.push({ week: week, title: genTitle(), genre: g.id, openEst: Math.round(openEst * 10) / 10, quality: ri(42, 88), announced: false, done: false });
    }
    S.rivals[r].slots.sort(function (a, b) { return a.week - b.week; });
  }
}
function tickRivals() {
  var r, i, slot, g, season, open, legs, decay, gross, weeksOut;
  var aw = (typeof espAnnounceWindow === "function") ? espAnnounceWindow() : 8;
  /* counter-programming AI: rivals dodge your tentpole weekends */
  for (r = 0; r < S.rivals.length; r++) {
    for (i = 0; i < S.rivals[r].slots.length; i++) {
      var sl = S.rivals[r].slots[i];
      if (sl.done || sl.week <= S.studio.week + 2) continue;
      var myTent = 0;
      for (var pj = 0; pj < S.projects.length; pj++) {
        var pp = S.projects[pj];
        if (pp.releaseWeek != null && Math.abs(pp.releaseWeek - sl.week) <= 2 && pp.scale === "tentpole") myTent = pp.budget;
      }
      if (myTent > 0 && sl.openEst < myTent * 0.6 && chance(0.55)) {
        sl.week = Math.max(S.studio.week + 3, sl.week + (chance(0.5) ? -2 : 2));
        sl.announced = false;
        log(S.rivals[r].name + " moves “" + sl.title + "” off your tentpole weekend.", "", "🗓️");
      }
    }
  }
  for (r = 0; r < S.rivals.length; r++) {
    for (i = 0; i < S.rivals[r].slots.length; i++) {
      slot = S.rivals[r].slots[i];
      if (slot.done) continue;
      if (!slot.announced && slot.week - S.studio.week <= aw && slot.week > S.studio.week) {
        slot.announced = true;
        log(S.rivals[r].name + " schedules “" + slot.title + "” for week " + slot.week + ".", "", "🗓️");
      }
      if (slot.week === S.studio.week) {
        g = genreOf(slot.genre);
        season = seasonOf(woyOf(S.studio.week));
        open = slot.openEst * season.s * S.econ.box * rf(0.85, 1.2);
        var myW = myWeightAt(S.studio.week);
        if (myW > 0) open *= clamp(1 / (1 + Math.pow(myW / Math.max(open, 1), 0.8)), 0.45, 1);
      if (typeof rivalDealClash === "function") open *= rivalDealClash(S.rivals[r].name) || 1;
        /* v46: rivals react to your dominance — aggressive when behind, cowed when crushed (rivals.js) */
        if (typeof rivalReactionMult === "function") open *= rivalReactionMult(S.rivals[r].name) || 1;
        legs = clamp(1.8 + (slot.quality - 30) * 0.03 + g.legs, 1.4, 4.4);
        decay = 1 - 1 / legs;
        var rec = { id: "rf" + (S.seq++), title: slot.title, genre: slot.genre, rival: S.rivals[r].name, opening: Math.round(open * 10) / 10, legs: legs, decay: decay, weeksOut: 0, weekly: [], status: "run" };
        S.rFilms.unshift(rec);
        S.rivals[r].lastRel = rec.id;
        slot.done = true;
        log(S.rivals[r].name + " opens “" + slot.title + "” (" + g.name + ") this week.", "", "🎬");
      }
    }
  }
  /* rival films decay weekly */
  for (i = S.rFilms.length - 1; i >= 0; i--) {
    var f = S.rFilms[i];
    if (f.status !== "run") continue;
    f.weeksOut++;
    gross = f.opening * Math.pow(f.decay, f.weeksOut) * (seasonOf(woyOf(S.studio.week)).hol ? 1.18 : 1) * S.econ.box;
    /* Attribute the gross to the studio that released it. Without this the whole
       rival economy was dead data: S.rivals[].ytd stayed 0 forever, so the rival
       leaderboard showed 0M for every studio, the finance desk's comparable-company
       valuation never priced a rival (it guards on ytd > 0), and
       libStrongestRival()/libWeakestRival() both always returned rivals[0]. */
    if (f.rival) {
      var rr = rivalByName(f.rival);
      if (rr) {
        rr.ytd = Math.round((rr.ytd + gross) * 10) / 10;
        rr.lifetime = Math.round(((rr.lifetime || 0) + gross) * 10) / 10;
      }
    }
    if (gross < Math.max(0.25, f.opening * 0.006) || f.weeksOut > 16) { f.status = "done"; continue; }
    f.weekly.push(gross);
  }
  if (S.rFilms.length > 40) S.rFilms.length = 40;
  seedRivalSlots();
}

/* Rival lookup by display name — rival films carry only the name string. */
function rivalByName(name) {
  var i;
  for (i = 0; i < S.rivals.length; i++) if (S.rivals[i].name === name) return S.rivals[i];
  return null;
}
function filmsInRelease() {
  var out = [], i;
  for (i = 0; i < S.films.length; i++) if (S.films[i].status === "run") out.push(S.films[i]);
  for (i = 0; i < S.rFilms.length; i++) if (S.rFilms[i].status === "run") out.push(S.rFilms[i]);
  return out;
}
function weeklyChart() {
  var rows = [], i, list = filmsInRelease();
  for (i = 0; i < list.length; i++) {
    var f = list[i];
    var wk = f.weeksOut === 0 ? f.opening : (f.weekly.length ? f.weekly[f.weekly.length - 1] : f.opening);
    rows.push({ title: f.title, gross: wk, mine: !f.rival, rival: f.rival || null });
  }
  rows.sort(function (a, b) { return b.gross - a.gross; });
  return rows.slice(0, 8);
}

/* ── weekly events ────────────────────────────────────────────── */
function tickEvents() {
  if (!chance(0.30)) return;
  var roll = Math.random(), i, p, f;
  if (roll < 0.18) { /* scandal */
    if (typeof prRetainer === "function" && prRetainer()) {
      log("The crisis team killed a tabloid story before print.", "good", "🧯");
    } else {
    var targets = [];
    for (i = 0; i < S.projects.length; i++) {
      var act = findTalent(S.projects[i].actId);
      if (act && act.power >= 4 && !S.projects[i].scandal) targets.push(S.projects[i]);
    }
    if (targets.length) {
      p = pick(targets);
      p.scandal = true;
      S.pending = { type: "scandal", projectId: p.id, title: p.title, fee: 3 };
      log("🚨 Tabloids explode around " + findTalent(p.actId).n + " — “" + p.title + "” may take a hit at the box office.", "bad", "🚨");
    } else log("A rival studio weathered its own scandal this week. Schadenfreude is free.", "", "🚨");
    }
  } else if (roll < 0.34) { /* rave */
    var running = [];
    for (i = 0; i < S.films.length; i++) if (S.films[i].status === "run" && S.films[i].weeksOut >= 1) running.push(S.films[i]);
    if (running.length) {
      f = pick(running);
      f.legs = clamp(f.legs + 0.06, 1.4, 4.4); f.decay = 1 - 1 / f.legs;
      log("Critics rally behind “" + f.title + "” — word of mouth strengthens.", "good", "🏅");
    } else log("Trade papers celebrate the summer of auteur cinema. Nothing to do with you. Yet.", "", "🏅");
  } else if (roll < 0.50) { /* viral moment */
    if (S.projects.length) {
      p = pick(S.projects);
      p.buzz += 3;
      log("A teaser for “" + p.title + "” goes viral — buzz +" + p.buzz + ".", "good", "📱");
    } else log("The internet spent the week arguing about a rival's trailer. Engagement: yours: zero.", "", "📱");
  } else if (roll < 0.62) { /* economy */
    S.econ.box = clamp(S.econ.box + rf(-0.06, 0.06), 0.85, 1.15);
    var cyc = S.econ.box >= 1.08 ? "boom conditions" : S.econ.box >= 0.98 ? "a stable market" : "recession jitters";
    log("Economy: " + cyc + " — box-office climate ×" + S.econ.box.toFixed(2) + ".", "", "📈");
  } else if (roll < 0.74) { /* litigation */
    var risky = [];
    for (i = 0; i < S.projects.length; i++) {
      p = S.projects[i];
      if (!p.cleared && (p.phase === "pre" || p.phase === "shoot")) risky.push(p);
    }
    if (risky.length && chance(0.5)) {
      p = pick(risky);
      p.delayWk = 2;
      spend(p.budget * 0.05, "Legal settlement · " + p.title);
      log("⚖️ A chain-of-title dispute stalls “" + p.title + "” — two weeks and " + fm(p.budget * 0.05) + " gone. Clear titles from the Develop slate.", "bad", "⚖️");
    } else log("The lawyers bill quietly this week. Nothing explodes.", "", "⚖️");
  } else if (roll < 0.77 + ((typeof laborStrikeMod === "function") ? (laborStrikeMod() || 0) : 0)) { /* guild strike */
    if (S.strike > 0) log("The strike holds. Picket lines and cold coffee.", "bad", "🪧");
    else { S.strike = 6; log("🪧 A guild strike is called — production costs +20% for six weeks.", "bad", "🪧"); }
  } else if (roll < 0.80) { /* piracy */
    if (filmsInRelease().some(function (x) { return !x.rival; })) {
      S.piracy = 4;
      log("🏴‍☠️ A piracy wave hits — your theatrical grosses run 6% soft for four weeks.", "bad", "🏴‍☠️");
    } else log("The watermark scanners find nothing worth stealing.", "", "🏴‍☠️");
  } else if (roll < 0.84) { /* choice incidents */
    var kind = pick(["cyber", "leak", "dispute"]);
    if (kind === "leak" && !S.projects.length) { log("Security audit finds nothing to leak. Boring.", "", "🔐"); }
    else if (kind === "cyber") {
      S.pending = { type: "incident", kind: "cyber" };
      log("🔐 Hackers breach the studio's press servers.", "bad", "🔐");
    } else if (kind === "dispute") {
      S.pending = { type: "incident", kind: "dispute" };
      log("🪧 A crew dispute is brewing on the lot.", "bad", "🪧");
    } else {
      var leakP = null;
      for (i = 0; i < S.projects.length; i++) if (S.projects[i].phase === "post" || S.projects[i].phase === "ready") leakP = S.projects[i];
      if (leakP) {
        S.pending = { type: "incident", kind: "leak", projectId: leakP.id };
        log("📁 A workprint of “" + leakP.title + "” is circulating online.", "bad", "📁");
      } else log("The trades chase a rumor about a rival's reshoots.", "", "📁");
    }
  } else if (roll < 0.92) { /* festival */
    if (woyOf(S.studio.week) >= 34 && woyOf(S.studio.week) <= 38) {
      var prestige = null;
      for (i = 0; i < S.projects.length; i++) {
        p = S.projects[i];
        if ((p.phase === "post" || p.phase === "ready") && ["drama", "crime", "romance", "docs", "musical"].indexOf(p.genre) >= 0) prestige = p;
      }
      if (prestige) { S.studio.rep = clamp(S.studio.rep + 4, 0, 100); log("“" + prestige.title + "” wins big at the fall festival — reputation +4.", "gold", "🏆"); }
      else log("Festival season closes. The guilds drank all the good wine.", "", "🏆");
    } else log("Industry chatter: agents are golfing. Nothing is happening. Everything is being decided.", "", "🗞️");
  } else {
    log(pick([
      "A-list agent lunches dominated the week. Somewhere, a deal was made.",
      "Exhibitors quietly upgraded their projection bulbs. The movies glow brighter.",
      "A legendary star was seen touring your backlot. Interesting.",
      "Trade papers speculate which studio will blink first this holiday."
    ]), "", "🗞️");
  }
}

/* ── facilities, loans ────────────────────────────────────────── */
function upgradeCost(key) {
  var lv = S.upg[key];
  var u = UPGRADES[key];
  if (lv >= u.levels.length) return null;
  return u.levels[lv].cost;
}
function buyUpgrade(key) {
  var cost = upgradeCost(key);
  if (cost == null || S.studio.cash < cost) return false;
  spend(cost, "Facility · " + UPGRADES[key].name);
  S.upg[key]++;
  log(UPTdate(key), "good", "🏗️");
  toast(UPTdate(key), "good");
  return true;
}
function UPTdate(key) {
  return UPGRADES[key].name + " upgraded — " + UPGRADES[key].levels[S.upg[key] - 1].desc + ".";
}
function takeLoan() {
  if (S.loans.length >= 2) return false;
  S.loans.push({ amt: 30, rate: 0.006 });
  earn(30, "Emergency loan");
  log("The bank wires $30M. Interest: 0.6% per week until repaid.", "bad", "🏦");
  toast("+$30M emergency loan. Interest accrues weekly.", "bad");
  return true;
}
function repayLoan() {
  if (!S.loans.length || S.studio.cash < 30) return false;
  S.loans.shift();
  spend(30, "Loan repayment");
  log("Loan repaid in full. The bank sends a fruit basket.", "good", "🏦");
  toast("Loan repaid.", "good");
  return true;
}

/* ── talent agency, lot staff, trends, poaching ──────────────── */
function isAgencyClient(t) { return !!(S && S.agency && S.agency.founded && S.agency.clients.indexOf(t.id) >= 0); }
function foundAgency() {
  if (S.agency.founded || S.studio.cash < 25) return false;
  spend(25, "Found talent agency");
  S.agency.founded = true;
  log("Your in-house talent agency opens its doors — commissions will follow.", "gold", "🤝");
  toast("Talent agency founded.", "good");
  return true;
}
function signClient(tid) {
  var t = findTalent(tid);
  if (!S.agency.founded || !t || talentBusy(t) || S.agency.clients.length >= 3 || S.agency.clients.indexOf(tid) >= 0 || t.power < 3) return false;
  var bonus = Math.round(t.power * 2 * 10) / 10;
  if (S.studio.cash < bonus) return false;
  spend(bonus, "Signing bonus · " + t.n);
  S.agency.clients.push(tid);
  t.picDeal = { pics: 3 };
  log(t.n + " signs a three-picture deal — exclusive representation, fees down 15%.", "good", "🤝");
  return true;
}
function upgradeDeal(tid) {
  var t = findTalent(tid);
  if (!t || !S.agency.founded || S.agency.clients.indexOf(tid) < 0 || !t.picDeal || t.picDeal.pics >= 5) return false;
  var bonus = Math.round(t.power * 1.5 * 10) / 10;
  if (S.studio.cash < bonus) return false;
  spend(bonus, "Deal renegotiation · " + t.n);
  t.picDeal.pics = 5;
  log(t.n + " upgrades to a five-picture deal — fees down 25%.", "good", "🤝");
  return true;
}
function dropClient(tid) {
  var ix = S.agency.clients.indexOf(tid);
  if (ix < 0) return false;
  var t = findTalent(tid);
  S.agency.clients.splice(ix, 1);
  if (t) { t.picDeal = null; log(t.n + " leaves your agency roster.", "", "🤝"); }
  return true;
}
var LOT_ROLES = { writers: { n: "Writers room", wage: 0.04, d: "better scripts on the desk" }, crew: { n: "Production crew", wage: 0.05, d: "higher production values" }, vfx: { n: "VFX unit", wage: 0.06, d: "higher production values" } };
function hireLotStaff(kind) {
  if (!LOT_ROLES[kind] || S.lot[kind] >= 10 || S.studio.cash < 0.5) return false;
  spend(0.5, "Hire " + LOT_ROLES[kind].n.toLowerCase());
  S.lot[kind]++;
  return true;
}
function fireLotStaff(kind) {
  if (!LOT_ROLES[kind] || S.lot[kind] <= 0) return false;
  S.lot[kind]--;
  log(LOT_ROLES[kind].n + " is one staff member lighter.", "", "🎬");
  return true;
}
function tickMine() {
  var st = S.studio, i, t;
  if (S.strike > 0) S.strike--;
  if (S.piracy > 0) S.piracy--;
  /* crisis years: at a year boundary a hard year may begin */
  if (st.woy === 1 && !S.crisisDone && typeof crisisYearRoll === "function") { S.crisisDone = true; crisisYearRoll(); }
  if (st.woy === 2) S.crisisDone = false;
  /* genre trends drift every quarter */
  if ([1, 14, 27, 40].indexOf(st.woy) >= 0) {
    var moved = null, biggest = 0;
    GENRES.forEach(function (g) {
      var old = S.trends[g.id] || 1;
      var nw = clamp(old * rf(0.9, 1.12), 0.7, 1.4);
      S.trends[g.id] = Math.round(nw * 100) / 100;
      if (Math.abs(nw - old) > biggest) { biggest = Math.abs(nw - old); moved = g; }
    });
    if (moved && biggest > 0.08) log(moved.em + " " + moved.name + " is trending " + (S.trends[moved.id] > 1 ? "hot" : "cold") + " this quarter.", "", "📈");
  }
  /* lot staff wages */
  var wages = Math.round((S.lot.writers * 0.04 + S.lot.crew * 0.05 + S.lot.vfx * 0.06) * 100) / 100;
  if (wages > 0) spend(wages, "Lot staff wages");
  /* in-house agency commissions */
  if (S.agency.founded) {
    var com = 0;
    for (i = 0; i < S.agency.clients.length; i++) {
      t = findTalent(S.agency.clients[i]);
      if (t) com += t.power * 0.08;
    }
    if (com > 0) earn(Math.round(com * 100) / 100, "Agency commissions");
  }
  /* rivals poach your stars */
  var poachP = S.agency.founded ? 0.008 : 0.025;
  /* v46: the more you dominate, the bigger a scalp your stars become (rivals.js) */
  if (typeof rivalWarPoachBoost === "function") poachP += rivalWarPoachBoost() || 0;
  if (chance(poachP)) {
    var cands = [];
    for (i = 0; i < S.market.length; i++) {
      t = S.market[i];
      if (!talentBusy(t) && t.power >= 4 && !isAgencyClient(t)) cands.push(t);
    }
    if (cands.length) {
      var poacher = pick(S.rivals);
      if (typeof hasPactWith === "function" && hasPactWith(poacher.name)) return;
      var v = pick(cands);
      S.pending = { type: "poach", tid: v.id, rival: poacher.name, fee: Math.round(feeFor(v, 60) * 0.5 * 10) / 10 };
      log("🕵️ " + v.n + " is being courted by " + S.pending.rival + " over lunch.", "bad", "🕵️");
    }
  }
}


/* ── series: greenlight → shoot → air → OTT sale or own-streamer release ── */
var SERIES_BUDGETS = [10, 16, 24];
function genSeriesTitle() { return pick(TITLE_A) + " " + pick(TITLE_B).trim(); }
function greenlightSeries(genreId, bIdx) {
  var g = genreOf(genreId);
  var budget = SERIES_BUDGETS[bIdx] || SERIES_BUDGETS[1];
  if (S.studio.cash < budget) return { err: "Need " + fm(budget) + " to greenlight a series." };
  if (S.series.length >= 3) return { err: "Three series already in production." };
  var quality = clamp(ri(48, 86) + Math.min(S.lot.writers, 10) * 0.4 + (g.id === "drama" || g.id === "crime" ? 3 : 0), 40, 96);
  var p = {
    id: "fs" + (S.seq++), title: genSeriesTitle(), genre: genreId, scale: "series",
    budget: budget, quality: quality, eps: ri(6, 10),
    phase: "shooting", phaseWk: 0, shootLen: ri(6, 9),
    weeksOut: 0, grossSum: 0, rating: null, outlet: null, done: false
  };
  spend(budget, "Series · " + p.title);
  S.series.push(p);
  log("Greenlit series “" + p.title + "” — " + g.em + " " + g.name + ", " + p.eps + " episodes for " + fm(budget) + ".", "", "📺");
  toast("“" + p.title + "” is in production.", "good");
  return { ok: true, id: p.id };
}
function findSeries(id) { var i; for (i = 0; i < S.series.length; i++) if (S.series[i].id === id) return S.series[i]; return null; }
function tickSeries() {
  var i, p, g, season, weekly, rating;
  for (i = S.series.length - 1; i >= 0; i--) {
    p = S.series[i];
    if (p.done) continue;
    g = genreOf(p.genre);
    season = seasonOf(woyOf(S.studio.week));
    if (p.phase === "shooting") {
      p.phaseWk++;
      spend(Math.round(p.budget * 0.7 / p.shootLen * 10) / 10, "Series shoot · " + p.title);
      if (p.phaseWk >= p.shootLen) {
        p.phase = "aired"; p.phaseWk = 0;
        log("“" + p.title + "” wraps and heads to its premiere week.", "good", "📺");
      }
      continue;
    }
    if (p.phase === "aired") {
      p.weeksOut++;
      rating = clamp(Math.round(p.quality + gauss() * 5 + (season.hol ? 3 : 0)), 5, 99);
      p.rating = p.rating == null ? rating : Math.round((p.rating * (p.weeksOut - 1) + rating) / p.weeksOut);
      weekly = Math.round(p.budget * 0.06 * (p.rating / 60) * season.s * 10) / 10;
      if (p.outlet === "streamer") {
        weekly = Math.round(weekly * 1.35 * 10) / 10;
        if (S.tv && S.tv.streamer) S.tv.streamer.subs = Math.round((S.tv.streamer.subs + 0.05 + p.rating / 1400) * 100) / 100;
      }
      earn(weekly, "Series · " + p.title);
      p.grossSum = Math.round((p.grossSum + weekly) * 10) / 10;
      if (p.weeksOut >= p.eps) {
        p.done = true;
        S.studio.catalog += p.grossSum * 0.3;
        if (p.outlet !== "streamer") log("“" + p.title + "” finale scored " + p.rating + "/100 — " + fm(p.grossSum) + " over its run.", p.rating >= 70 ? "good" : "", "📺");
        else log("“" + p.title + "” finale drove subscribers on your streamer — " + fm(p.grossSum) + " total.", "good", "📺");
      }
    }
  }
}
/* Sell the finished series to an external platform (one-time rights fee). */
function sellSeriesOtt(id) {
  var p = findSeries(id);
  if (!p || !p.done || p.outlet) return { err: "That series cannot be sold yet." };
  var g = genreOf(p.genre);
  var offer = Math.round((p.grossSum * 0.9 + p.rating * 0.35 + g.mass * 4) * 10) / 10;
  earn(offer, "OTT sale · " + p.title);
  p.outlet = "sold";
  log("Sold “" + p.title + "” streaming rights for " + fm(offer) + " — a platform wanted the finale audience.", "gold", "💸");
  toast("Rights sold for " + fm(offer) + ".", "good");
  return { ok: true, offer: offer };
}
/* Release the finished series on your OWN streamer (needs tv.js streamer). */
function releaseSeriesStreamer(id) {
  var p = findSeries(id);
  if (!p || !p.done || p.outlet) return { err: "That series is not ready." };
  if (typeof S === "undefined" || !S.tv || !S.tv.streamer) return { err: "Launch your own streaming platform first (Playing → Broadcast → Streaming platform)." };
  p.outlet = "streamer";
  S.tv.streamer.subs = Math.round((S.tv.streamer.subs + 0.3 + p.rating / 250) * 100) / 100;
  S.tv.streamer.exclusives = (S.tv.streamer.exclusives || 0) + 1;
  log("“" + p.title + "” lands exclusive on your streamer — subscriber bump and a new exclusive badge.", "gold", "📺");
  toast("Exclusive release on your streamer.", "good");
  return { ok: true };
}

/* ── milestones & awards ──────────────────────────────────────── */
function milestone(id, txt) {
  if (S.stats.milestones[id]) return;
  S.stats.milestones[id] = true;
  toast("✨ " + txt, "gold");
  log("Milestone: " + txt, "gold", "✨");
}
function checkMilestones() {
  if (S.stats.hits >= 1) milestone("firstProfit", "First profitable release");
  if (S.stats.bestOpen >= 100) milestone("open100", "First $100M opening");
  if (S.studio.lifetime >= 1000) milestone("lifetime1B", "One billion dollars in lifetime gross");
  if (S.studio.rep >= 90) milestone("rep90", "The A-list wants to work with you");
  var seq = false, i;
  for (i = 0; i < S.films.length; i++) if (S.films[i].franchiseOf) seq = true;
  if (seq) milestone("sequel", "Your first franchise sequel is in production");
}
function yearAwards() {
  var best = null, i, f, bestScore = -1, noms = [];
  for (i = 0; i < S.yearOfFilms.length; i++) {
    f = findFilm(S.yearOfFilms[i]);
    if (f && f.quality >= 70) noms.push({ id: f.id, title: f.title, quality: f.quality });
    if (f && f.quality >= 75) {
      var sc = f.quality + (typeof awardPoints === "function" ? (awardPoints(f.id) || 0) * 3 : 0);
      if (sc > bestScore) { bestScore = sc; best = f; }
    }
  }
  /* The year's films are consumed here, BEFORE any early return: the awards-night
     pending flow used to return early and silently skip every below-the-line
     category, so the deeper awards desk stayed empty for a whole career. */
  var _yearFilms = S.yearOfFilms.map(function (id) { return findFilm(id); }).filter(function (x) { return x; });
  if (typeof extraAwardCategories === "function") extraAwardCategories(_yearFilms);
  /* v46: below-the-line categories — cinematography, design, sound, editing, score, ensemble */
  if (typeof awardsPlusCategories === "function") awardsPlusCategories(_yearFilms);
  if (typeof awardNightBegin === "function" && noms.length) { awardNightBegin(noms, best); S.yearOfFilms = []; return; }
  if (best) {
    S.studio.rep = clamp(S.studio.rep + 8, 0, 100);
    S.studio.catalog += 25;
    log("🏆 Year " + S.studio.year + " awards: “" + best.title + "” takes Best Picture. Reputation +8.", "gold", "🏆");
    toast("🏆 “" + best.title + "” wins Best Picture!", "gold");
  } else if (S.yearOfFilms.length) {
    log("Awards night passes without a trophy for your studio. Next year.", "", "🏆");
  }
  S.yearOfFilms = [];
}

/* ── the weekly heartbeat ─────────────────────────────────────── */
function advanceWeek() {
  if (S.over) return;
  var st = S.studio;
  st.week++;
  st.woy = woyOf(st.week);
  if (st.woy === 1) {
    st.year++;
    /* rival year-to-date gross resets with the studio's year, so the leaderboard
       measures the current season rather than an ever-growing lifetime total */
    var _ri;
    for (_ri = 0; _ri < S.rivals.length; _ri++) S.rivals[_ri].ytd = 0;
  }
  if (st.woy === 18) log("Summer season opens — marketing costs rise, openings surge.", "gold", "☀️");
  if (st.woy === 26) { log("Midsummer festival — audiences surge, marketing discounted.", "good", "🎪"); earn(2, "Festival bonus"); }
  if (st.woy === 44) { log("Awards corridor — prestige campaigns cost less.", "good", "🏆"); }
  if (st.woy === 48) log("Holiday corridor opens — premium pricing window.", "gold", "🎄");
  if (st.woy === 50) { log("Holiday gala — premium ticket surge.", "gold", "🎄"); earn(3, "Holiday bonus"); }
  if (st.week % 10 === 0 && typeof chance === "function" && chance(0.35)) { log("Seasonal event: " + (chance(0.5) ? "festival buzz lifts the lot." : "a piracy wave trims margins."), chance(0.5) ? "good" : "bad", chance(0.5) ? "🎪" : "🏴‍☠️"); }
  S.weekTx = { w: st.week, in: 0, out: 0, rows: [] };
  S.flash = [];

  /* standing costs */
  var _cmo = (typeof challengeMod === "function") ? challengeMod() : null;
  var _opsOH = (typeof opsOverheadMult === "function") ? (opsOverheadMult() || 1) : 1;
  /* live ops amenity: daycare cuts overhead (liveops.js) */
  if (typeof liveopsAmenityMods === "function") _opsOH *= liveopsAmenityMods().overhead || 1;
  spend((0.25 + ORIGINS.reduce(function (a, o) { return o.id === S.origin ? o.overhead : a; }, 0)
        + S.upg.post * 0.05 + S.upg.backlot * 0.05 + (S.diff === "hard" ? 0.2 : 0))
        * (_cmo && _cmo.overheadMult ? _cmo.overheadMult : 1) * _opsOH, "Overhead");
  if (st.catalog > 0) earn(st.catalog * 0.004, "Library royalties");
  if (S.loans.length) {
    var interest = 0;
    var cmod = (typeof challengeMod === "function") ? challengeMod() : null;
    for (var li = 0; li < S.loans.length; li++) interest += S.loans[li].amt * S.loans[li].rate;
    /* v46: a legacy-tier studio borrows cheaper (legacy.js) */
    if (typeof legacyFinancingMult === "function") interest *= legacyFinancingMult() || 1;
    spend(interest * (cmod && cmod.interestMult ? cmod.interestMult : 1), "Loan interest");
  }
  if (S.mezz > 0) spend(S.mezz * 0.012, "Mezzanine interest");

  tickProjects();

  /* release gate: ready films scheduled for this week go out */
  var gi;
  for (gi = S.projects.length - 1; gi >= 0; gi--) {
    var gp = S.projects[gi];
    if (gp.phase === "ready" && gp.releaseWeek != null && gp.releaseWeek <= st.week) releaseFilm(gp);
  }

  tickTheatrical();
  /* v43.2: Collection Command — pays lever uplift, merch windows, library levy */
  if (typeof BoxOfficeCollection !== "undefined" && BoxOfficeCollection.tick) BoxOfficeCollection.tick(S);
  tickRivals();
  tickEvents();

  if (typeof tickTV === "function") tickTV();
  if (typeof tickEmpire === "function") tickEmpire();
  if (typeof tickPR === "function") tickPR();
  if (typeof tickBiz === "function") tickBiz();
  if (typeof tickOTT === "function") tickOTT();
  if (typeof tickGames === "function") tickGames();
  if (typeof tickLibrary === "function") tickLibrary();
  if (typeof tickExhibition === "function") tickExhibition();
  if (typeof tickCreative === "function") tickCreative();
  if (typeof tickPeople === "function") tickPeople();
  if (typeof tickMedia === "function") tickMedia();
  if (typeof tickStrategy === "function") tickStrategy();
  if (typeof tickMeta === "function") tickMeta();
  if (typeof tickTech === "function") tickTech();
  if (typeof tickEvents2 === "function") tickEvents2();
  if (typeof tickMeta2 === "function") tickMeta2();
  if (typeof tickBizdeal === "function") tickBizdeal();
  /* wave-6/7 module ticks — wired in v42.5 (previously defined but never called) */
  if (typeof tickCrew === "function") tickCrew();
  if (typeof tickMastery === "function") tickMastery();
  if (typeof tickWorld === "function") tickWorld();
  if (typeof tickLicensing === "function") tickLicensing();
  if (typeof tickSocial === "function") tickSocial();
  if (typeof tickStad === "function") tickStad();
  if (typeof tickTalentAgency === "function") tickTalentAgency();
  if (typeof tickFestivals === "function") tickFestivals();
  if (typeof tickSocial === "function") tickSocial();
  if (typeof tickStad === "function") tickStad();
  if (typeof tickCameo === "function") tickCameo();
  /* studio ops: executive payroll + placement expiry (opsuite.js) */
  if (typeof tickStudioOps === "function") tickStudioOps();
  /* live ops: seasonal rollover, pity decay (liveops.js) */
  if (typeof tickLiveOps === "function") tickLiveOps();
  /* marketing campaigns: window decay and pruning (mktblitz.js) */
  if (typeof tickMktBlitz === "function") tickMktBlitz();
  /* console platform + first-party hardware: stages, royalties (consolehw.js) */
  if (typeof tickConsoleHW === "function") tickConsoleHW();
  /* v46 wave: rival war room, sequel plans, craft departments, mentoring,
     studio legacy, distribution windows, guild relations, deep awards (each own file) */
  if (typeof tickRivalWar === "function") tickRivalWar();
  if (typeof tickSequel === "function") tickSequel();
  if (typeof tickCraft === "function") tickCraft();
  if (typeof tickMentor === "function") tickMentor();
  if (typeof tickLegacy === "function") tickLegacy();
  if (typeof tickWindow === "function") tickWindow();
  if (typeof tickLabor === "function") tickLabor();
  if (typeof tickAwardsPlus === "function") tickAwardsPlus();
  tickMine();
  tickSeries();

  churnTalent();  if (typeof seedFollowings === "function") seedFollowings();
  refreshIdeas();
  if (st.woy === WEEKS_PER_YEAR) yearAwards();
  checkMilestones();
  checkScenario();
  if (typeof checkAchievements === "function") checkAchievements();

  if (S.weekTx) {
    S.txHistory.unshift(S.weekTx);
    if (S.txHistory.length > 10) S.txHistory.length = 10;
  }
  if (st.cash < 0 && st.cash > -25) log("Cash is negative (" + fm(st.cash) + "). Consider an emergency loan in the Ledger.", "bad", "🏦");
  if (st.cash <= -25) {
    S.over = true;
    var legacyScore = Math.round(st.lifetime + S.stats.hits * 80);
    if (legacyScore >= 500) {
      var lc = { fund: clamp(Math.round((st.cash + st.catalog + st.lifetime * 0.2) * 0.12), 30, 180), halo: clamp(Math.round(st.rep * 0.35), 0, 48), heir: null, gen: (S.gen || 1) + 1, films: [] };
      var fj;
      for (fj = 0; fj < S.films.length && lc.films.length < 2; fj++) if (S.films[fj].franchiseOf) lc.films.push(S.films[fj].franchiseOf);
      try { localStorage.setItem("bow2.legacy.v1", JSON.stringify({ score: legacyScore, name: st.name, year: st.year, carry: lc })); } catch (e) {}
    }
    log("Creditors seize the studio gates. Game over.", "bad", "💀");
  }
  saveGame();
  return S.flash;
}

function newGame(name, originId, diff, scenarioId) {
  wipeSave();
  var legacy = null;
  try { legacy = JSON.parse(localStorage.getItem("bow2.legacy.v1") || "null"); } catch (e) {}
  newState(name, originId, diff);
  /* v47: seed follower counts at day one. seedFollowings() used to run only from
     advanceWeek, so a studio's first picture opened with a flat socialBuzzMult
     and every star looked like a social nobody on the Develop talent shortlist. */
  if (typeof seedFollowings === "function") seedFollowings();
  var sc = null, si;
  for (si = 0; si < SCENARIOS.length; si++) if (SCENARIOS[si].id === (scenarioId || "free")) sc = SCENARIOS[si];
  if (sc && sc.id !== "free") {
    if (sc.cash != null) S.studio.cash = sc.cash;
    if (sc.rep != null) S.studio.rep = sc.rep;
    if (sc.debt) S.loans.push({ amt: sc.debt, rate: 0.005 });
    S.scenario = { id: sc.id, n: sc.n, goal: sc.goal, deadline: S.studio.week + sc.goal.weeks, done: false };
    log("🎯 Scenario: " + sc.n + " — " + sc.d, "gold", "🎯");
  }
  if (legacy && (legacy.score >= 500 || legacy.carry)) {
    var carry = legacy.carry || null;
    var bonus = carry ? carry.fund : Math.min(50, Math.round(legacy.score / 100));
    S.studio.cash += Math.round(bonus * (carry && carry.heir === "wall" ? 1.25 : 1));
    S.studio.rep = clamp(S.studio.rep + (carry ? carry.halo : 5) + (carry && carry.heir === "royalty" ? 20 : 0), 0, 100);
    if (carry && carry.heir === "auteur") S.heirAuteur = true;
    if (carry && carry.heir === "digital") { S.studio.catalog += 150; log("Inherited streaming library: catalog $150M from day one.", "gold", "📺"); }
    if (carry && carry.films) for (var fi2 = 0; fi2 < carry.films.length; fi2++) S.ideas.unshift(genIdea(carry.films[fi2]));
    if (carry) { S.gen = carry.gen || 2; log("👑 Generation " + S.gen + " — the " + legacy.name + " dynasty continues.", "gold", "👑"); }
    else log("Dynasty: the " + legacy.name + " estate invests $" + bonus + "M in the new studio.", "gold", "👑");
    toast("👑 Dynasty heirloom: +$" + bonus + "M starting capital.", "gold");
  }
  saveGame();
}

/* ── mezzanine debt ───────────────────────────────────────────── */
function drawMezz() {
  var cur = S.mezz || 0;
  if (cur >= 60) return false;
  var step = Math.min(20, 60 - cur);
  S.mezz = cur + step;
  earn(step, "Mezzanine facility");
  log("Mezzanine draw +" + fm(step) + " at 1.2%/week.", "bad", "🏦");
  toast("+" + fm(step) + " mezzanine debt.", "bad");
  return true;
}
function repayMezz() {
  var cur = S.mezz || 0;
  if (cur <= 0 || S.studio.cash < 20) return false;
  var pay = Math.min(20, cur);
  S.mezz = Math.round((cur - pay) * 10) / 10;
  spend(pay, "Mezzanine repayment");
  log("Mezzanine repaid to " + fm(S.mezz) + ".", "good", "🏦");
  return true;
}

/* ── dynasty succession (voluntary NG+) ─────────────────────── */
function studioValuation() { return Math.round((S.studio.cash + S.studio.catalog + S.studio.lifetime * 0.2) * 10) / 10; }
function canRetire() { return S.studio.week >= 52 && (S.stats.releases >= 3 || S.studio.cash >= 150); }
function retire(heirId) {
  if (!canRetire()) return { err: "Retire after 52 weeks with 3 releases or $150M cash." };
  if (["auteur", "wall", "royalty", "digital"].indexOf(heirId) < 0) return { err: "Pick an heir." };
  var val = studioValuation();
  var carry = {
    fund: clamp(Math.round(val * 0.12), 30, 180),
    halo: clamp(Math.round(S.studio.rep * 0.35), 0, 48),
    heir: heirId,
    gen: (S.gen || 1) + 1,
    films: []
  };
  var franch = [], i;
  for (i = 0; i < S.films.length; i++) if (S.films[i].franchiseOf) franch.push(S.films[i].franchiseOf);
  for (i = 0; i < S.films.length && franch.length < 2; i++) {
    if (S.films[i].ww && S.films[i].ww >= S.films[i].cost * 2 && !S.films[i].franchiseOf) franch.push(S.films[i].title);
  }
  carry.films = franch.slice(0, 2);
  try { localStorage.setItem("bow2.legacy.v1", JSON.stringify({ score: Math.round(S.studio.lifetime + S.stats.hits * 80), name: S.studio.name, year: S.studio.year, carry: carry })); } catch (e) {}
  return { ok: true, carry: carry };
}

/* ── production choices: rush / extend / reshoot a scene ────── */
function rushFilm(pid) {
  var p = findProject(pid);
  if (!p || p.phase !== "shoot" || p.rushed || S.studio.cash < p.budget * 0.12) return false;
  spend(p.budget * 0.12, "Rush · " + p.title);
  p.rushed = true;
  p.phaseLen.shoot = Math.max(1, p.phaseLen.shoot - 1);
  log("“" + p.title + "” goes into rush mode — one week faster, money burns.", "", "⚡");
  return true;
}
function extendFilm(pid) {
  var p = findProject(pid);
  if (!p || p.phase !== "shoot" || p.extended || S.studio.cash < p.budget * 0.05) return false;
  spend(p.budget * 0.05, "Extended takes · " + p.title);
  p.extended = true;
  p.extendCraft = 3;
  p.phaseLen.shoot += 1;
  log("“" + p.title + "” gets extended takes — one more week, better film.", "good", "🎬");
  return true;
}
function reshootScene(pid) {
  var p = findProject(pid);
  if (!p || p.phase !== "shoot" || p.reshotScene || S.studio.cash < p.budget * 0.06) return false;
  spend(p.budget * 0.06, "Reshoot a scene · " + p.title);
  p.reshotScene = true;
  log("One scene of “" + p.title + "” gets reshot with a new idea.", "good", "🎬");
  return true;
}

/* ── scenario win check ───────────────────────────────────── */
function checkScenario() {
  if (!S.scenario || S.scenario.done) return;
  var g = S.scenario.goal, okNow = false;
  if (g.kind === "firstProfit" && S.stats.hits >= 1) okNow = true;
  if (g.kind === "cash" && S.studio.cash >= g.target) okNow = true;
  if (g.kind === "franchise") {
    var rc = 0;
    if (typeof empRecoupCount === "function") rc = empRecoupCount();
    else if (S.emp && S.emp.stage && S.emp.stage.shows) { for (var ri2 = 0; ri2 < S.emp.stage.shows.length; ri2++) if (S.emp.stage.shows[ri2].recouped) rc++; }
    if (rc >= 3 || S.studio.rep >= 80) okNow = true;
  }
  if (okNow) {
    S.scenario.done = true;
    S.studio.rep = clamp(S.studio.rep + 5, 0, 100);
    toast("🎯 Scenario achieved: " + S.scenario.n + "! Reputation +5.", "gold");
    log("🎯 Scenario achieved — " + S.scenario.n + ". The board sends champagne.", "gold", "🎯");
    return;
  }
  if (S.studio.week > S.scenario.deadline) {
    S.scenario.failed = true;
    log("The " + S.scenario.n + " deadline passed. The scenario is failed — play on.", "bad", "🎯");
  }
}

/* ── combined cashflow adjustments from every module ──────────────
   This used to live in ui.js, which meant the sim layer depended on the view
   layer: a headless run (balance sim, harnesses) silently lost every module's
   recurring income because ui.js was never loaded. It also only aggregated four
   modules, so the other fourteen published forecastAdjust_* hooks were dead.
   The engine owns its own forecast; ui.js now just reads it. */
function forecastAdjust(weekAbs) {
  var n = 0;
  if (typeof forecastAdjust_tv === "function") n += forecastAdjust_tv(weekAbs) || 0;
  if (typeof forecastAdjust_ott === "function") n += forecastAdjust_ott(weekAbs) || 0;
  if (typeof forecastAdjust_games === "function") n += forecastAdjust_games(weekAbs) || 0;
  if (typeof forecastAdjust_strategy === "function") n += forecastAdjust_strategy(weekAbs) || 0;
  if (typeof forecastAdjust_awards === "function") n += forecastAdjust_awards(weekAbs) || 0;
  if (typeof forecastAdjust_bizdeal === "function") n += forecastAdjust_bizdeal(weekAbs) || 0;
  if (typeof forecastAdjust_cameo === "function") n += forecastAdjust_cameo(weekAbs) || 0;
  if (typeof forecastAdjust_crew === "function") n += forecastAdjust_crew(weekAbs) || 0;
  if (typeof forecastAdjust_finance === "function") n += forecastAdjust_finance(weekAbs) || 0;
  if (typeof forecastAdjust_library === "function") n += forecastAdjust_library(weekAbs) || 0;
  if (typeof forecastAdjust_licensing === "function") n += forecastAdjust_licensing(weekAbs) || 0;
  if (typeof forecastAdjust_mastery === "function") n += forecastAdjust_mastery(weekAbs) || 0;
  if (typeof forecastAdjust_media === "function") n += forecastAdjust_media(weekAbs) || 0;
  if (typeof forecastAdjust_people === "function") n += forecastAdjust_people(weekAbs) || 0;
  if (typeof forecastAdjust_rivalwar === "function") n += forecastAdjust_rivalwar(weekAbs) || 0;
  if (typeof forecastAdjust_slots === "function") n += forecastAdjust_slots(weekAbs) || 0;
  if (typeof forecastAdjust_tech === "function") n += forecastAdjust_tech(weekAbs) || 0;
  if (typeof forecastAdjust_world === "function") n += forecastAdjust_world(weekAbs) || 0;
  if (typeof forecastAdjust_mentor === "function") n += forecastAdjust_mentor(weekAbs) || 0;
  return n;
}

/* ── 12-week cashflow forecast (display) ──────────────────────── */
function forecast12() {
  var rows = [], w, i;
  for (w = 1; w <= 12; w++) {
    var wkAbs = S.studio.week + w;
    var out = 0.25 + ORIGINS.reduce(function (a, o) { return o.id === S.origin ? o.overhead : a; }, 0)
      + S.upg.post * 0.05 + S.upg.backlot * 0.05 + (S.diff === "hard" ? 0.2 : 0);
    out += S.lot.writers * 0.04 + S.lot.crew * 0.05 + S.lot.vfx * 0.06;
    if (S.mezz) out += S.mezz * 0.012;
    for (i = 0; i < S.loans.length; i++) out += S.loans[i].amt * S.loans[i].rate;
    var inn = S.studio.catalog * 0.004;
    if (S.agency.founded) {
      for (i = 0; i < S.agency.clients.length; i++) { var t = findTalent(S.agency.clients[i]); if (t) inn += t.power * 0.08; }
    }
    for (i = 0; i < S.projects.length; i++) {
      var p = S.projects[i];
      if (p.phase === "ready") continue;
      var totalWks = p.phaseLen.pre + p.phaseLen.shoot + p.phaseLen.post;
      var doneWks = p.phase === "pre" ? p.phaseWk : p.phase === "shoot" ? p.phaseLen.pre + p.phaseWk : p.phaseLen.pre + p.phaseLen.shoot + p.phaseWk;
      var left = Math.max(0, totalWks - doneWks);
      if (left > 0 && w <= left) out += (p.budgetNow * (1 - doneWks / totalWks)) / left;
    }
    if (typeof forecastAdjust === "function") inn += forecastAdjust(wkAbs) || 0;
    rows.push({ w: wkAbs, inn: Math.round(inn * 10) / 10, out: Math.round(out * 10) / 10 });
  }
  return rows;
}

/* ── chain relations react to theatrical windows ───────────── */
function chainWindowBump(windowDays) {
  if (S.biz && S.biz.chains) {
    S.biz.chains.rel = clamp((S.biz.chains.rel || 50) + (windowDays >= 90 ? 6 : windowDays <= 17 ? -8 : 0), 0, 100);
    if (windowDays <= 17) log("Exhibitors grumble about the short theatrical window.", "", "🎟️");
    else if (windowDays >= 90) log("Exhibitors reward the long theatrical window.", "good", "🎟️");
  }
}

/* ── script clearance & recuts ───────────────────────────── */
function clearTitles(pid) {
  var p = findProject(pid);
  if (!p || p.cleared || (p.phase !== "pre" && p.phase !== "shoot") || S.studio.cash < 1.5) return false;
  spend(1.5, "Chain-of-title clearance · " + p.title);
  p.cleared = true;
  log("Chain of title cleared on “" + p.title + "” — litigation risk gone.", "good", "📜");
  return true;
}
function recutFilm(pid) {
  var p = findProject(pid);
  if (!p || p.recut || p.phase !== "ready" || S.studio.cash < 2) return false;
  spend(2, "Recut · " + p.title);
  p.recut = true;
  log("“" + p.title + "” recut for a wider audience — critics may sniff, crowds will come.", "", "✂️");
  return true;
}
