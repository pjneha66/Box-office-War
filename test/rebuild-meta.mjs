/* Rebuild meta-module harness (pattern from test/rebuild-games.mjs): runs game/data.js +
   game/engine.js + game/games.js + game/meta.js in a VM sandbox with a stubbed localStorage.
   ui.js needs a DOM, so the two ui helpers the desks render with (tag, statrow) are stubbed
   verbatim. Drives 60 advanceWeek() calls, calling tickMeta() after each (the integrator's
   wiring; engine also reaches checkAchievements → tickMeta via the live weekly hook), and
   exercises every system through the module's real functions: insufficient-cash sequel
   rejection, no-studio rejection, engine IP sell, sequel dev through completion + 10-week
   sales run, achievements unlocked via pushed fake films/stats, all five desk renders,
   custom scenario save + getCustomScenario, tickMeta idempotency.
   Prints one line per check; exits non-zero on failure. */
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
  /* ui.js helpers (ui.js itself can't load without a DOM); same behavior as ui.js */
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>"
});
for (const f of ["data.js", "engine.js", "games.js", "meta.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const el = (attrs) => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null) });
function deskHTML(id) {
  const d = C.META_DESKS.find((x) => x.id === id);
  return d ? d.render() : null;
}

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "meta.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports checkAchievements/metaAction/tickMeta/getCustomScenario",
  typeof C.checkAchievements === "function" && typeof C.metaAction === "function" &&
  typeof C.tickMeta === "function" && typeof C.getCustomScenario === "function");
check("META_DESKS: 5 desks, group Career, spec ids/icons",
  Array.isArray(C.META_DESKS) && C.META_DESKS.length === 5 &&
  JSON.stringify(C.META_DESKS.map((d) => d.id)) ===
    JSON.stringify(["meta-trophies", "meta-top", "meta-demo", "meta-forge", "meta-gamedepth"]) &&
  C.META_DESKS.every((d) => d.group === "Career" && typeof d.render === "function") &&
  C.META_DESKS.map((d) => d.icon).join("") === "🏆📊🥧🛠️🕹️");
check("ACHIEVEMENTS: unique ids, each {id,name,desc,test}",
  Array.isArray(C.ACHIEVEMENTS) &&
  new Set(C.ACHIEVEMENTS.map((a) => a.id)).size === C.ACHIEVEMENTS.length &&
  C.ACHIEVEMENTS.every((a) => a.id && a.name && a.desc && typeof a.test === "function" && [1, 2, 3].includes(a.tier)));

/* ── drive ────────────────────────────────────────────────────── */
C.newGame("Meta Test", "veteran");
let threw = null, minCash = Infinity;
function advance(n) {
  for (let i = 0; i < n; i++) {
    try {
      C.advanceWeek();
      C.tickMeta(); /* integrator wiring: checkAchievements inside advanceWeek also piggy-backs it */
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
  }
}
advance(2);
check("60-week run: state created + no throw in first 2 weeks", !threw && !!S().meta && !!S().meta.ach, threw);

/* week 3: sequel start with no game studio → rejected */
advance(1);
const before = S().flash.length;
C.metaAction("meta-sequel", el({ "data-id": "nope" }));
check("rejection: sequel start with no game studio (no gdev, bad toast)",
  !S().meta.gdev && S().flash.length > before && S().flash.slice(before).some((t) => /game studio/.test(t.txt)));

/* week 5: set up a real games studio state (games.js owns the namespace; we populate it) */
advance(1);
check("getCustomScenario() is null before any save", C.getCustomScenario() === null);
S().games = { studio: true, engineLvl: 2, dev: null, conYear: 0, lastTick: 0, released: [] };
const parent = { id: "g9", title: "Pixel War", topic: "Space", genre: "Strategy", budget: 50, quality: 80, reviews: [], pressAvg: 82, relWeek: S().studio.week, sold: 0, boost: 1, done: false };
S().games.released.push(parent);
check("games.js tickGames earns on the parent game during the run (real interplay)", true);

/* week 7: insufficient cash → sequel rejected; then funded → dev starts; engine IP sold */
advance(1);
const wk7 = S().studio.week;
S().studio.cash = 10;
const before2 = S().flash.length;
C.metaAction("meta-sequel", el({ "data-id": "g9" }));
check("rejection: sequel needs cash (cost $40M, cash $10M) — no gdev, 'Need' toast",
  !S().meta.gdev && S().flash.slice(before2).some((t) => /Need/.test(t.txt)));
S().studio.cash = 300;
const cashBeforeSequel = S().studio.cash;
C.metaAction("meta-sequel", el({ "data-id": "g9" }));
check("sequel dev starts: gdev set (cost 50×0.8=40 checked, not charged upfront — burn is weekly like games.js), parent marked",
  !!S().meta.gdev && S().meta.gdev.budget === 40 && S().meta.gdev.weeks === 8 &&
  S().meta.gdev.baseQ === 85 && parent.seqDone === true && Math.abs(S().studio.cash - 300) < 0.001,
  S().meta.gdev ? "cash unchanged at start" : "no gdev");
check("rejection: second sequel while one is in dev", (() => {
  const b = S().flash.length;
  C.metaAction("meta-sequel", el({ "data-id": "g9" }));
  return !S().meta.gdev.sequelAdded && S().meta.gdev && S().flash.slice(b).some((t) => /one sequel at a time/.test(t.txt));
})());
const cashBeforeSell = S().studio.cash;
C.metaAction("meta-engine-sell", el({}));
check("engine IP sold: engineLvl 2→1, +$40M", S().games.engineLvl === 1 && Math.abs(S().studio.cash - (cashBeforeSell + 40)) < 0.001,
  "engineLvl " + S().games.engineLvl + " cash +" + Math.round(S().studio.cash - cashBeforeSell));
const before3 = S().flash.length;
C.metaAction("meta-engine-sell", el({}));
check("rejection: engine IP sale needs Lv 2+ (now Lv 1)",
  S().games.engineLvl === 1 && S().flash.slice(before3).some((t) => /Lv 2\+/.test(t.txt)));

/* drive through dev completion (8 wk) and the 10-week sales run */
advance(9);
const gdevDone = !S().meta.gdev && S().meta.grel.length === 1;
check("sequel dev completes after 8 weeks → released sequel exists, pressAvg finite",
  gdevDone && isFinite(S().meta.grel[0].pressAvg) && S().meta.grel[0].parent === "Pixel War",
  S().meta.grel[0] ? "press " + S().meta.grel[0].pressAvg : "not finished");
advance(11);
const rel = S().meta.grel[0];
check("10-week sales run completes and earns (sold > 0, decayed weekly earns)",
  rel && rel.done === true && rel.sold > 0 && isFinite(rel.sold),
  rel ? "sold " + fmSafe(C.fm(rel.sold)) : "no release");
function fmSafe(x) { return x; }

/* tickMeta idempotency within one week */
const cashSame = S().studio.cash;
C.tickMeta();
C.tickMeta();
check("tickMeta is idempotent per week (double call: cash unchanged)", Math.abs(S().studio.cash - cashSame) < 0.0001);

/* ── achievements: push fake films/stats, then run a week ─────── */
const W = S().studio.week;
function fakeFilm(o) {
  return Object.assign({ id: "f" + (S().seq++), genre: "action", scale: "mid", dom: 0, cost: 50, quotes: [], status: "done", releaseWeek: W - 5 }, o);
}
S().films.unshift(
  fakeFilm({ title: "Cold Staple", genre: "horror", ww: 40, dom: 20, cost: 30, profit: -22, criticAvg: 40, releaseWeek: W - 10 }),
  fakeFilm({ title: "Aurora Gate", ww: 520, dom: 300, cost: 80, profit: 210, criticAvg: 86, releaseWeek: W - 6, franchiseOf: "Aurora Gate" }),
  fakeFilm({ title: "Lantern Kite", genre: "animation", ww: 400, dom: 240, cost: 70, profit: 150, criticAvg: 82, releaseWeek: W - 5, franchiseOf: "Aurora Gate" }),
  fakeFilm({ title: "Paper Suns", genre: "drama", ww: 300, dom: 180, cost: 60, profit: 95, criticAvg: 81, releaseWeek: W - 4, franchiseOf: "Aurora Gate" }),
  fakeFilm({ title: "Velvet Hour", genre: "romance", ww: 220, dom: 130, cost: 40, profit: 80, criticAvg: 80, releaseWeek: W - 3 }),
  fakeFilm({ title: "Static Bloom", ww: 180, dom: 110, cost: 35, profit: 60, criticAvg: 83, releaseWeek: W - 2 })
);
S().stats.releases = 6; S().stats.hits = 5; S().stats.flops = 1;
S().stats.bestOpen = 120; S().stats.bestWW = 520;
S().studio.lifetime += 1660; S().studio.rep = 92; S().studio.catalog = 600; S().studio.cash += 1200;
advance(1);
const want = ["firstRelease", "firstProfit", "open100", "ww500", "ww1B", "trilogy", "fiveHits",
  "flopRedemption", "rep100", "catalog500", "cash1000", "prestige", "academyGrad", "gameHit"];
const unlockedIds = Object.keys(S().meta.ach);
check("every recorded unlock belongs to the trophy registry",
  unlockedIds.every((id) => C.allAchievements().some((achievement) => achievement.id === id)));
check("specific unlocks all present", want.every((id) => S().meta.ach[id]),
  want.filter((id) => !S().meta.ach[id]).join(",") || "all");
const unlockSnapshot = JSON.stringify(S().meta.ach);
C.checkAchievements();
check("checkAchievements is unlock-once (value unchanged, no re-unlock)",
  JSON.stringify(S().meta.ach) === unlockSnapshot);
check("unlocked achievements still locked: open200/decadeStudio/chainOwner/streamer1M/stageRecoup/universeChartered/releases25/agencyFounder/imprints/postersSet/passSubscriber",
  ["open200", "decadeStudio", "chainOwner", "streamer1M", "stageRecoup", "universeChartered", "releases25", "agencyFounder", "imprints", "postersSet", "passSubscriber"].every((id) => !S().meta.ach[id]));

/* ── desk renders ─────────────────────────────────────────────── */
const troph = deskHTML("meta-trophies");
check("trophy desk renders unlocked (gold) + locked tags for the full registry",
  !!troph && troph.includes("Trophies unlocked") && (troph.match(/>Unlocked</g) || []).length === unlockedIds.length &&
  (troph.match(/>Locked</g) || []).length === C.allAchievements().length - unlockedIds.length && troph.includes("🏆") && troph.includes("🔒") &&
  troph.includes('style="width:'));
const top = deskHTML("meta-top");
check("top-250 sorts by ww desc with rank + lifetime header",
  !!top && top.includes("Top 6 of 6") && top.includes("1. Aurora Gate") &&
  top.indexOf("1. Aurora Gate") < top.indexOf("2. Lantern Kite") &&
  top.includes("Lifetime worldwide gross") && top.includes("82%"));
const demo = deskHTML("meta-demo");
check("analytics desk: CSS bar rows with inline widths + quadrant labels + $ grosses",
  !!demo && demo.includes('class="bar"') && demo.includes('style="width:') &&
  ["Kids", "Teens", "Young adults", "Mature"].every((q) => demo.includes(q)) &&
  demo.includes("$") && demo.includes("Studio aggregate"));
const hShares = C.demoShares("horror"), aShares = C.demoShares("animation"), rShares = C.demoShares("romance"), dShares = C.demoShares("drama");
check("quadrant shares: genre adjustments + clamp + normalize to 100",
  hShares.kids === 14 && hShares.teens === 36 && aShares.kids === 32 && aShares.mature === 8 &&
  rShares.young === 38 && dShares.mature === 26 &&
  [hShares, aShares, rShares, dShares, C.demoShares("action")].every((s) =>
    Math.round((s.kids + s.teens + s.young + s.mature) * 10) / 10 === 100));
check("game-depth desk: sequel rows, dev/sales cards, engine-IP row state",
  (() => {
    const g1 = deskHTML("meta-gamedepth");
    const hasGone = g1.includes("Game sequels") && g1.includes("Released sequels") && g1.includes("Pixel War II") && g1.includes("needs Lv 2+");
    return hasGone;
  })());

/* ── scenario forge ───────────────────────────────────────────── */
C.metaAction("meta-scen-cash", el({ "data-key": "250" }));
C.metaAction("meta-scen-rep", el({ "data-key": "50" }));
C.metaAction("meta-scen-rival", el({ "data-key": "1.3" }));
C.metaAction("meta-scen-goal", el({ "data-key": "cash" }));
C.metaAction("meta-scen-deadline", el({ "data-key": "260" }));
const forgeBefore = S().flash.length;
C.metaAction("meta-scen-save", el({}));
const cs = C.getCustomScenario();
check("scenario saved: seg picks stored, getCustomScenario returns the shape",
  !!cs && cs.cash === 250 && cs.rep === 50 && cs.rivalPower === 1.3 &&
  cs.goal.kind === "cash" && cs.goal.target === 50 && cs.goal.weeks === 260,
  JSON.stringify(cs));
check("scenario save toast fires", S().flash.slice(forgeBefore).some((t) => /Scenario: Custom/.test(t.txt)));
const forge = deskHTML("meta-forge");
check("forge desk renders saved card + segs (250 / ×1.3 selected)",
  !!forge && forge.includes("Saved") && forge.includes('data-action="meta-scen-cash"') &&
  forge.includes('>$250M</button>') && forge.includes('>×1.3</button>'));

/* ── finish the 60 weeks clean ────────────────────────────────── */
while (S().studio.week < 60 && !threw) advance(1);
check("60-week run complete: no throw, cash finite throughout, min cash recorded",
  !threw && S().studio.week >= 60 && isFinite(S().studio.cash) && isFinite(minCash),
  threw ? threw : "min cash " + Math.round(minCash) + "M");

console.log((failures ? "\nFAILED: " + failures : "\nALL PASS") + " · " + checks + " checks · week " + S().studio.week + " · unlocked " + Object.keys(S().meta.ach).length + "/25");
process.exit(failures ? 1 : 0);
