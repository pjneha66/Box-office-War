/* Cross-module integration harness ("everything is actually wired").
   Each feature module has its own unit harness, but those run with only that one
   module loaded — so they cannot tell whether the ENGINE actually calls the hooks.
   This harness loads the whole game (every module, exactly as game/index.html does),
   then proves for every v46 hook that the engine's own code path reaches it.

   Method: install a call-spy on the context. Each module defines its hooks as plain
   global functions, so we snapshot the function, replace it with a wrapper that counts
   calls and delegates, then drive the real engine. A hook that is never called while
   the game runs is dead code and the check fails.
   This is the only test that catches "module written, hook never wired". */
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
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  esc: (s) => String(s == null ? "" : s),
  drainFlash: () => {}, toast: () => {}
});

/* ui.js boots at load and needs a DOM; mini-stub sufficient for it to load and
   for collectDesks()/deskHome()/each render() to run without a browser. */
const elStub = () => ({
  style: {}, className: "", innerHTML: "", textContent: "", value: "", dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  setAttribute() {}, getAttribute: () => null, removeAttribute() {},
  appendChild() {}, removeChild() {}, insertBefore() {}, replaceChild() {},
  addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
  querySelector: () => null, querySelectorAll: () => [], closest: () => null,
  scrollIntoView() {}, scrollTop: 0, scrollHeight: 0, offsetHeight: 0,
  children: [], childNodes: [], parentNode: null, firstChild: null, lastChild: null
});
ctx.window = ctx;
ctx.document = {
  body: elStub(), head: elStub(), documentElement: elStub(),
  getElementById: () => elStub(), querySelector: () => elStub(), querySelectorAll: () => [],
  createElement: () => elStub(), createTextNode: () => elStub(),
  addEventListener() {}, removeEventListener() {}, cookie: "",
  visibilityState: "visible", hidden: false
};
ctx.addEventListener = () => {};
ctx.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {}, removeListener() {} });
ctx.location = { href: "http://localhost/", hash: "", reload() {} };
ctx.screen = { width: 412, height: 915, orientation: { type: "portrait-primary" } };
ctx.innerWidth = 412; ctx.innerHeight = 915; ctx.devicePixelRatio = 2;
ctx.requestAnimationFrame = (fn) => { try { fn(0); } catch (e) {} return 0; };
ctx.cancelAnimationFrame = () => {};
ctx.setTimeout = (fn) => { try { fn(); } catch (e) {} return 0; };
ctx.clearTimeout = () => {};
ctx.Audio = function () { return { play() {}, pause() {}, cloneNode() { return this; }, volume: 0 }; };
ctx.Image = function () { return elStub(); };

/* Every game module, in the order game/index.html loads them. */
const MODULES = [
  /* cast-banks / box-office-sim-2-cast need a browser (window/DATA globals) and add
     no v46 hooks — cast-bridge falls back cleanly when they are absent. */
  "data.js", "cast-bridge.js", "engine.js",
  "tv.js", "empire.js", "pr.js", "biz.js", "ott.js", "games.js", "library.js",
  "exhibition.js", "creative.js", "finance.js", "challenges.js", "i18n.js", "sound.js",
  "posters.js", "people.js", "media.js", "strategy.js", "meta.js",
  "tech.js", "events2.js", "bizdeal.js", "slots.js", "meta2.js",
  "crew.js", "mastery.js", "world.js", "licensing.js", "awards.js", "festivals.js",
  "social_viral.js", "stadium.js", "talent_agency.js", "cameo.js",
  "box-office-collection-engine.js", "opsuite.js", "liveops.js", "mktblitz.js", "consolehw.js",
  "rivals.js", "sequel.js", "craft.js", "mentor.js", "legacy.js", "window.js", "labor.js", "awardsplus.js",
  "help.js", "ui.js"
];

/* Load each file, tolerating a module that is not present yet (partial wave). */
const loaded = [], missing = [];
for (const f of MODULES) {
  try {
    vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
    loaded.push(f);
  } catch (e) {
    if (e.code === "ENOENT" || /Cannot find module/.test(String(e.message))) { missing.push(f); continue; }
    console.log("FAIL  " + f + " threw while loading: " + e.message);
    failures++; checks++;
  }
}
const C = ctx;

/* ── the hooks under test, grouped by the module that owns them ──
   Each entry: [hookName, description]. A hook is only required if its owner
   module is loaded and the function actually exists. */
const HOOKS = {
  "rivals.js": ["tickRivalWar", "rivalReactionMult", "rivalWarPoachBoost", "rivalCounterMult"],
  "sequel.js": ["tickSequel", "sequelOpenMult", "sequelCraftMod", "sequelOnRelease"],
  "craft.js": ["tickCraft", "craftDeptMods", "craftCriticAdj"],
  "mentor.js": ["tickMentor", "mentorCraftMod", "mentorFeeMult"],
  "legacy.js": ["tickLegacy", "legacyOpenMult", "legacyFinancingMult", "legacyFeeMult", "legacyRepBonus"],
  "window.js": ["tickWindow", "windowRevenueMult", "windowLegsMult", "windowOnRelease"],
  "labor.js": ["tickLabor", "laborCostMult", "laborStrikeMod"],
  "awardsplus.js": ["tickAwardsPlus", "awardsPlusCategories"]
};

/* ── instrument: count every call ───────────────────────────────── */
const calls = Object.create(null);
function spy(name) {
  const orig = C[name];
  if (typeof orig !== "function") return false;
  calls[name] = 0;
  C[name] = function () {
    calls[name]++;
    return orig.apply(this, arguments);
  };
  return true;
}
let spied = 0, absent = [];
for (const owner of Object.keys(HOOKS)) {
  if (missing.indexOf(owner) >= 0) continue;
  for (const h of HOOKS[owner]) {
    if (spy(h)) spied++;
    else absent.push(h);
  }
}
check("every declared hook exists on the context", absent.length === 0,
  absent.length ? "missing: " + absent.join(", ") : spied + " hooks instrumented");

/* ── drive a real career that exercises the systems ────────────── */
C.newGame("Integration", "veteran");
const S = C.S;

function pickTalent(kind, minPower) {
  let best = null;
  for (const t of S.market) {
    if (t.k !== kind) continue;
    if (minPower && t.power < minPower) continue;
    if (!best || t.skill > best.skill) best = t;
  }
  return best;
}

/* Greenlight films through the ENGINE's own greenlight(), then let setRelease +
   advanceWeek drive pre -> shoot -> post -> ready -> release. That is the only path
   that runs tickProjects (and therefore laborCostMult / opsCostMult) as well as
   computeQuality (mentorCraftMod / sequelCraftMod / craftDeptMods) and endTheatrical.
   Hand-building "ready" projects would skip pre-production entirely and silently
   leave the labour hooks untested. */
function slatesome() {
  /* keep two projects in flight; greenlight rejects busy talent, so retry a few */
  for (let attempt = 0; attempt < 6 && S.projects.length < 2; attempt++) {
    if (!S.ideas.length) S.ideas.push(C.genIdea());
    const idea = S.ideas[0];
    const dir = pickTalent("dir", 2), act = pickTalent("actor", 2);
    if (!dir || !act) return;
    if (C.talentBusy(dir) || C.talentBusy(act)) {
      /* free them: a career should not stall because one actor stayed booked */
      dir.bookedUntil = 0; act.bookedUntil = 0;
    }
    const cfg = { scale: "mid", bIdx: 1, dirId: dir.id, actorId: act.id, mktIdx: 1, supportIds: [] };
    if (!C.scaleAllowed(C.scaleOf("mid"))) cfg.scale = "indie", cfg.bIdx = 0;
    const before = S.projects.length;
    const res = C.greenlight(idea.id, cfg);
    if (res && res.err) { S.ideas.splice(0, 1); continue; }
    /* greenlight() returns { ok: true }; the project itself is now on S.projects */
    if (S.projects.length > before) {
      const p = S.projects[S.projects.length - 1];
      /* schedule it so releaseFilm fires once it reaches "ready" */
      try { C.setRelease(p, S.studio.week + 8, 1, 45); } catch (e) {}
    }
  }
}

let threw = 0, cashBad = 0, weeks = 0;
for (let w = 0; w < 220; w++) {
  /* Wiring test, not a balance test: keep the studio solvent so the engine keeps
     ticking through a full 220 weeks. Otherwise a mid-career bankruptcy freezes
     advanceWeek() and every late hook (release-time, awards) never runs. */
  if (S.studio.cash < 200) S.studio.cash += 250;
  if (S.over) S.over = false;
  /* carry debt so the weekly interest path (and legacyFinancingMult) really runs */
  if (!S.loans.length && S.studio.week === 40) S.loans.push({ amt: 30, rate: 0.006 });
  slatesome();
  try {
    C.advanceWeek();
    weeks++;
  } catch (e) {
    threw++;
    if (threw <= 2) console.log("      week error: " + e.message);
  }
  if (!isFinite(S.studio.cash)) cashBad++;
}
check("220 driven weeks without a throw", threw === 0, threw + " throws");
check("cash stayed finite every week", cashBad === 0, cashBad + " bad weeks");
check("the career actually released films", S.stats.releases >= 5, S.stats.releases + " releases");

/* ── assert every hook was actually CALLED by the engine ──────── */
const dead = [];
for (const owner of Object.keys(HOOKS)) {
  if (missing.indexOf(owner) >= 0) continue;
  for (const h of HOOKS[owner]) {
    if (typeof calls[h] !== "number") continue;    /* wasn't instrumented */
    if (calls[h] === 0) dead.push(owner + ":" + h);
  }
}
check("no v46 hook is dead code (engine reaches all of them)",
  dead.length === 0, dead.length ? "never called: " + dead.join(", ") : "all " + spied + " fired");

/* ── per-hook call counts, printed for the record ────────────── */
const hot = Object.keys(calls).filter((k) => calls[k] > 0)
  .sort((a, b) => calls[b] - calls[a]);
console.log("      fired: " + hot.map((k) => k + "×" + calls[k]).join("  "));

/* ── desks all resolve into a real tab (no orphan desks) ─────── */
const allDesks = C.collectDesks();
const desks = allDesks.filter((d) => d && d.id);
check("collectDesks() returns the full desk set", desks.length >= 90, desks.length + " desks");

const orphan = [];
for (const d of desks) {
  const h = C.deskHome ? C.deskHome(d) : null;
  if (!h || !h.tab) { orphan.push(d.id); continue; }
  /* deskHome() falls back to business/finance for an unknown group — that is the
     real signal of an unmapped desk, so check the group is actually declared. */
  if (h.tab === "gear") continue;              /* Slots & Help live in the gear menu by design */
  const declared = (C.DESK_GROUPS && C.DESK_GROUPS[h.tab] || []).some((sub) => sub.key === h.sub && sub.groups.indexOf(d.group) >= 0);
  if (!declared) orphan.push(d.id + "(" + d.group + " -> " + h.tab + "/" + h.sub + ")");
}
check("every desk resolves to a real tab (no orphans)", orphan.length === 0,
  orphan.length ? orphan.join(", ") : "all mapped");

const ids = Object.create(null), dup = [];
for (const d of desks) { if (ids[d.id]) dup.push(d.id); ids[d.id] = true; }
check("every desk id is unique", dup.length === 0, dup.join(", ") || "no duplicates");

/* ── every desk renders without throwing and without NaN ─────── */
const broken = [], nan = [];
for (const d of desks) {
  if (typeof d.render !== "function") continue;
  let html = null;
  try { html = d.render(); } catch (e) { broken.push(d.id + ": " + e.message); continue; }
  if (typeof html !== "string" || !html.trim()) { broken.push(d.id + ": empty"); continue; }
  if (html.indexOf("NaN") >= 0 || html.indexOf("undefined") >= 0) {
    nan.push(d.id);
    const at = html.indexOf("NaN") >= 0 ? html.indexOf("NaN") : html.indexOf("undefined");
    console.log("      leak in " + d.id + ": " + JSON.stringify(html.slice(Math.max(0, at - 200), at + 60)));
  }
}
check("every desk renders real HTML", broken.length === 0, broken.slice(0, 4).join(" | ") || desks.length + " desks rendered");
check("no desk leaks NaN or undefined into the markup", nan.length === 0, nan.slice(0, 6).join(", ") || "clean");

/* ── achievements from every module are visible ──────────────── */
const ach = C.allAchievements();
check("achievement list includes module trophies", ach.length > 25, ach.length + " achievements");
const achIds = Object.create(null), achDup = [];
for (const a of ach) { if (achIds[a.id]) achDup.push(a.id); achIds[a.id] = true; }
check("achievement ids unique across all modules", achDup.length === 0, achDup.join(", ") || "unique");

/* ── and the trophy desk renders all of them ─────────────────── */
let trophyHtml = "";
try { trophyHtml = C.metaTrophyDesk(); } catch (e) { trophyHtml = ""; }
check("trophy desk renders the merged list", trophyHtml.indexOf(String(ach.length)) >= 0,
  "count " + ach.length + " in header");

console.log("");
if (missing.length) console.log("note: modules not present yet: " + missing.join(", "));
console.log(failures === 0
  ? "ALL " + checks + " CHECKS PASSED · " + weeks + " weeks · " + S.stats.releases + " releases"
  : failures + " of " + checks + " CHECKS FAILED");
process.exit(failures === 0 ? 0 : 1);
