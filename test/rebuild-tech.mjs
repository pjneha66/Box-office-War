/* Rebuild Tech-module harness (pattern from test/rebuild-library.mjs): runs game/data.js +
   game/engine.js + game/tech.js in a VM sandbox with a stubbed localStorage. ui.js needs a
   DOM, so the two ui helpers the desk renders with (statrow/tag) are stubbed verbatim.
   Research progress is week-based, so the brief's drive pattern (advanceWeek + tickTech
   each cycle) completes Sound on exactly the 6th cycle; tickTech extra calls are idempotent.
   Asserts: lazy ensure, upfront cost, insufficient-cash rejection, no-cancel/no-skip
   sequencing, done list + news gold on completion, techCraftBonus/techOpenMult values and
   compounding, no partial effects while researching, desk renders clean at every state,
   and 62 advanceWeek() calls with finite cash throughout.
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
function nearly(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }

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
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "tech.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module + wiring sources ───── */
const src = readFileSync(path.join(gameDir, "tech.js"), "utf8");
const engineSrc = readFileSync(path.join(gameDir, "engine.js"), "utf8");
const uiSrc = readFileSync(path.join(gameDir, "ui.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("does not self-wrap advanceWeek/onAction (no reassignment, no direct call)",
  !/advanceWeek\s*=/.test(src) && !/onAction\s*=/.test(src) &&
  !src.includes("advanceWeek(") && !src.includes("onAction("));
check("exports tickTech/techAction/techCraftBonus/techOpenMult/forecastAdjust_tech",
  typeof C.tickTech === "function" && typeof C.techAction === "function" &&
  typeof C.techCraftBonus === "function" && typeof C.techOpenMult === "function" &&
  typeof C.forecastAdjust_tech === "function");
check("TECH_DESKS is 1 desk: Technology / tech-tree / 🔬",
  Array.isArray(C.TECH_DESKS) && C.TECH_DESKS.length === 1 &&
  C.TECH_DESKS[0].id === "tech-tree" && C.TECH_DESKS[0].group === "Technology" &&
  C.TECH_DESKS[0].icon === "🔬" && C.TECH_DESKS[0].name === "Research tree" &&
  typeof C.TECH_DESKS[0].render === "function");
check("engine wiring LIVE: computeQuality adds techCraftBonus, expectedOpening multiplies techOpenMult",
  engineSrc.includes('craft += techCraftBonus() || 0') && engineSrc.includes('open *= techOpenMult() || 1'));
check("ui wiring LIVE: onAction bridges techAction", uiSrc.includes('typeof techAction === "function"'));

/* ── drive helpers ───────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null;
function cycle(n) { /* advanceWeek + tickTech, n times, guarded */
  for (let i = 0; i < n; i++) {
    try { C.advanceWeek(); C.tickTech(); } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); return false; }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return false; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over || st.cash <= -25) { threw = "studio bankrupt at week " + st.week; return false; }
  }
  return true;
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.TECH_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw: " + e.message; break; }
    if (typeof html !== "string" || html.indexOf("undefined") >= 0 || html.indexOf("NaN") >= 0) { bad = d.id; break; }
  }
  check("desk renders clean " + label, bad === "", bad);
}
const stub = { getAttribute: () => null };

/* ── week 1: lazy ensure + cold hooks ────────────────────────── */
C.newGame("Tech Test Studios", "veteran");
C.tickTech();
check("S.tech namespace created lazily by tickTech: {done:[], researching:null}",
  !!S().tech && Array.isArray(S().tech.done) && S().tech.done.length === 0 && S().tech.researching === null);
check("forecastAdjust_tech() is 0 (with and without week arg)", C.forecastAdjust_tech() === 0 && C.forecastAdjust_tech(42) === 0);
check("cold hooks: craft bonus 0, opening mult ×1", C.techCraftBonus() === 0 && C.techOpenMult() === 1);
check("chain starts at Sound (Silent Era skipped, never researchable)", C.techNext().id === "sound");
desksRenderClean("(w1, empty tree)");

/* ── insufficient-cash rejection ─────────────────────────────── */
S().studio.cash = 5;
check("research rejected without cash: handled, no state change, no spend",
  C.techAction("tech-research", stub) === true && S().tech.researching === null && S().studio.cash === 5 &&
  S().tech.done.length === 0 && S().news.every((n) => n.txt.indexOf("Research begins") < 0));

/* ── research Sound: upfront cost, 6 weeks, done + gold news ─── */
S().studio.cash = 3000;
const cash0 = S().studio.cash;
check("Sound research starts via techAction", C.techAction("tech-research", stub) === true &&
  S().tech.researching && S().tech.researching.id === "sound" && S().tech.researching.started === S().studio.week);
check("Sound cost 18 paid upfront", nearly(cash0 - S().studio.cash, 18), String(S().studio.cash));
check("start logged to news", S().news.some((n) => n.txt.indexOf("Research begins: Sound") >= 0));
let deskHtml = C.TECH_DESKS[0].render();
check("desk while researching: progress bar + disabled button",
  deskHtml.indexOf('class="bar"') >= 0 && deskHtml.indexOf("disabled") >= 0 && deskHtml.indexOf("0/6 wks") >= 0);
check("no effects while researching", C.techCraftBonus() === 0 && C.techOpenMult() === 1);
check("second research rejected while lab is busy (no skip, no cancel path)",
  C.techAction("tech-research", stub) === true && S().tech.researching.id === "sound" && nearly(S().studio.cash, 2982));
check("no cancel action exists", C.techAction("tech-cancel", stub) === false);
check("foreign actions ignored", C.techAction("tv-launch-streamer", stub) === false && C.techAction("tech-nonsense", stub) === false && C.techAction("tech-research", null) === true);

check("5 weeks pass: still researching, no completion", cycle(5) && threw === null &&
  S().tech.researching && S().tech.researching.id === "sound" && S().tech.done.length === 0);
check("6th week completes Sound (done, gold news)", cycle(1) && threw === null &&
  S().tech.done.length === 1 && S().tech.done[0] === "sound" && S().tech.researching === null &&
  S().studio.week === 7 && S().news.some((n) => n.kind === "gold" && n.txt.indexOf("Sound research complete") >= 0));
check("tickTech idempotent: extra call does not duplicate done", (C.tickTech(), S().tech.done.length === 1));
check("hooks after Sound: craft +2, openings ×1.02",
  C.techCraftBonus() === 2 && nearly(C.techOpenMult(), 1.02, 1e-9), "craft " + C.techCraftBonus() + " mult " + C.techOpenMult().toFixed(4));
desksRenderClean("(Sound done)");

/* ── Color: partial research has no effects, then completes ──── */
check("next tech is Color", C.techNext().id === "color");
check("Color research starts", C.techAction("tech-research", stub) === true && S().tech.researching.id === "color");
check("3 weeks in: still researching, effects unchanged (no partial credit)",
  cycle(3) && threw === null && S().tech.researching.id === "color" && S().tech.done.length === 1 &&
  C.techCraftBonus() === 2 && nearly(C.techOpenMult(), 1.02, 1e-9));
deskHtml = C.TECH_DESKS[0].render();
check("desk shows 3/8 progress and 5 weeks remaining", deskHtml.indexOf("3/8 wks") >= 0 && deskHtml.indexOf("5 weeks left") >= 0);
check("5 more weeks complete Color", cycle(5) && threw === null &&
  S().tech.done.length === 2 && S().tech.done.join(",") === "sound,color" && S().tech.researching === null);
check("hooks compound: craft +5, openings ×1.0506",
  C.techCraftBonus() === 5 && nearly(C.techOpenMult(), 1.02 * 1.03, 1e-9), "craft " + C.techCraftBonus() + " mult " + C.techOpenMult().toFixed(4));

/* ── insufficient cash mid-chain ─────────────────────────────── */
S().studio.cash = 50;
check("Widescreen ($60M) rejected at cash 50: no state change",
  C.techAction("tech-research", stub) === true && S().tech.researching === null && S().studio.cash === 50 && S().tech.done.length === 2);
S().studio.cash = 3000;

/* ── the rest of the chain, one tech at a time ───────────────── */
const rest = [["widescreen", 8, 8, 1.02 * 1.03 * 1.04], ["digital", 10, 12, 1.02 * 1.03 * 1.04 * 1.05], ["imax", 10, 16, 1.02 * 1.03 * 1.04 * 1.05 * 1.06], ["vprod", 12, 21, 1.02 * 1.03 * 1.04 * 1.05 * 1.06 * 1.08]];
let ok = true;
for (const [id, wks, craft, mult] of rest) {
  if (!C.techAction("tech-research", stub) || !S().tech.researching || S().tech.researching.id !== id) { threw = "start " + id + " failed"; ok = false; break; }
  if (!cycle(wks) || threw !== null) { ok = false; break; }
  if (S().tech.done.indexOf(id) < 0 || S().tech.researching !== null) { threw = id + " not done after " + wks + " weeks"; ok = false; break; }
  if (C.techCraftBonus() !== craft || !nearly(C.techOpenMult(), mult, 1e-6)) { threw = id + " hooks wrong: craft " + C.techCraftBonus() + " mult " + C.techOpenMult().toFixed(6); ok = false; break; }
}
check("Widescreen→Digital→IMAX→Virtual Production researched in order, hooks compound to +21 craft / ×1.3134",
  ok && threw === null && S().tech.done.join(",") === "sound,color,widescreen,digital,imax,vprod",
  "craft " + C.techCraftBonus() + " mult " + C.techOpenMult().toFixed(6));
check("tree exhausted: techNext() null, tree-full empty state", C.techNext() === null && C.TECH_DESKS[0].render().indexOf("The whole tree is yours") >= 0);
check("research action on a full tree rejected cleanly",
  C.techAction("tech-research", stub) === true && S().tech.researching === null);
desksRenderClean("(full tree)");

/* ── 8 idle weeks to clear the 60-week contract requirement ──── */
check("8 idle weeks driven, cash finite every week (62 total)", cycle(8) && threw === null, weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");

/* ── final state checks ──────────────────────────────────────── */
check("weeks driven ≥ 60 (contract requirement)", weeksDriven >= 60, String(weeksDriven));
check("S.tech fields finite and NaN-free", JSON.stringify(S().tech).indexOf("NaN") < 0 && S().tech.done.length === 6 && S().tech.researching === null);
check("S.studio.cash finite at end", isFinite(S().studio.cash), Math.round(S().studio.cash) + "M");
desksRenderClean("(after 62-week run)");

console.log("\n" + (failures || threw ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") + " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M");
process.exit(failures || threw ? 1 : 0);
