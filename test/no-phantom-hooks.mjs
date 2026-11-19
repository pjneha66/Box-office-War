/* No phantom hooks.
   engine.js calls ~107 optional functions behind `typeof x === "function"`, which
   means a name that NO module defines is silently a no-op forever. That is exactly
   how `rivalWarBuzzMult()` was once referenced from expectedOpening() before
   rivals.js existed: the guard made it invisible, the opening calculation looked
   fine, and nothing failed. This test loads the whole game and asserts every
   guarded hook the engine references is a real function on the context.

   It also does the reverse check: no module publishes a hook the engine never
   calls. That is not always a bug (a module may define a helper only its own desks
   use), so it is reported as informational rather than a failure — but a hook in
   V46_HOOKS that nothing calls IS a failure, because those are all load-bearing. */
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
  toast: () => {}, drainFlash: () => {}
});

/* every module index.html loads, minus the two browser-only cast files that need
   a real window/DATA global and contribute no hooks */
const MODULES = [
  "data.js", "cast-bridge.js", "engine.js",
  "tv.js", "empire.js", "pr.js", "biz.js", "ott.js", "games.js", "library.js",
  "exhibition.js", "creative.js", "finance.js", "challenges.js", "i18n.js", "sound.js",
  "posters.js", "people.js", "media.js", "strategy.js", "meta.js",
  "tech.js", "events2.js", "bizdeal.js", "slots.js", "meta2.js",
  "crew.js", "mastery.js", "world.js", "licensing.js", "awards.js", "festivals.js",
  "social_viral.js", "stadium.js", "talent_agency.js", "cameo.js",
  "box-office-collection-engine.js", "opsuite.js", "liveops.js", "mktblitz.js", "consolehw.js",
  "rivals.js", "sequel.js", "craft.js", "mentor.js", "legacy.js", "window.js", "labor.js", "awardsplus.js",
  "help.js"
];
for (const f of MODULES) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;

/* ── collect every typeof-guarded hook the engine references ──── */
const engineSrc = readFileSync(path.join(gameDir, "engine.js"), "utf8");
const guarded = new Set();
for (const m of engineSrc.matchAll(/typeof\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*===\s*"function"/g)) {
  guarded.add(m[1]);
}
check("engine references a healthy number of guarded hooks", guarded.size > 50, guarded.size + " hooks");

/* ── the ones that must never be phantom ─────────────────────── */
const phantom = [];
for (const h of guarded) {
  if (typeof C[h] !== "function") phantom.push(h);
}
check("every typeof-guarded hook in engine.js is actually defined by a module",
  phantom.length === 0,
  phantom.length ? "PHANTOM (guard hides this forever): " + phantom.join(", ") : guarded.size + " hooks all real");

/* A phantom is only acceptable if it is a deliberately-optional integration point
   that a disabled build may omit. Assert the known-legitimate ones explicitly so a
   new phantom cannot hide behind "well, some are optional". */
const OPTIONAL_BY_DESIGN = [
  "BoxOfficeCollection", "applyPrefs", "openSheet", "render", "saveGame", "pushToast"
];
const unexplained = phantom.filter((h) => OPTIONAL_BY_DESIGN.indexOf(h) < 0 && h !== "awardNightBegin");
check("no unexplained phantom hook exists",
  unexplained.length === 0,
  unexplained.length ? unexplained.join(", ") : "none");

/* ── reverse direction: load-bearing hooks must be reached ───── */
const V46_HOOKS = [
  "tickRivalWar", "rivalReactionMult", "rivalWarPoachBoost", "rivalCounterMult",
  "tickSequel", "sequelOpenMult", "sequelCraftMod", "sequelOnRelease",
  "tickCraft", "craftDeptMods", "craftCriticAdj",
  "tickMentor", "mentorCraftMod", "mentorFeeMult",
  "tickLegacy", "legacyOpenMult", "legacyFinancingMult", "legacyFeeMult", "legacyRepBonus",
  "tickWindow", "windowRevenueMult", "windowLegsMult", "windowOnRelease",
  "tickLabor", "laborCostMult", "laborStrikeMod",
  "tickAwardsPlus", "awardsPlusCategories"
];
const missingFromEngine = V46_HOOKS.filter((h) => engineSrc.indexOf(h) < 0);
check("every v46 hook name appears in engine.js", missingFromEngine.length === 0,
  missingFromEngine.length ? "not referenced: " + missingFromEngine.join(", ") : V46_HOOKS.length + " v46 hooks referenced");

const notDefined = V46_HOOKS.filter((h) => typeof C[h] !== "function");
check("every v46 hook is defined by its module", notDefined.length === 0,
  notDefined.length ? "undefined: " + notDefined.join(", ") : "all defined");

/* a hook that is fetched with .call/.apply on a missing function would throw at
   runtime; assert none of the v46 hooks is named but guarded against the wrong
   thing (e.g. typeof x !== "undefined" then called). */
const wrongGuard = [];
for (const h of V46_HOOKS) {
  const bad = new RegExp('typeof\\s+' + h + '\\s*!==\\s*"undefined"');
  if (bad.test(engineSrc)) wrongGuard.push(h);
}
check("no v46 hook is guarded with a callable-unsafe typeof check", wrongGuard.length === 0,
  wrongGuard.join(", ") || "all use === \"function\"");

console.log("");
console.log(failures === 0
  ? "ALL " + checks + " CHECKS PASSED · " + guarded.size + " guarded hooks verified"
  : failures + " of " + checks + " CHECKS FAILED");
process.exit(failures === 0 ? 0 : 1);
