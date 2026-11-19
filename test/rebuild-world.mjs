/* Rebuild world.js test: vm harness (data.js + engine.js + world.js only),
   80-week drive plus forced-arc exercises through tickWorld/worldAction.
   Math.random is stubbed INSIDE the vm sandbox (the context has its own
   intrinsics) to make chance()/pick() rolls deterministic per phase.
   Usage: node test/rebuild-world.mjs */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

const ctx = {};
const mem = {};
Object.assign(ctx, {
  console, JSON, Date, isFinite, isNaN, parseInt, parseFloat, Number, String, Object, Array, Promise,
  navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  }
});
const sandbox = vm.createContext(ctx);
for (const f of ["data.js", "engine.js", "world.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), sandbox, { filename: f });
}

ctx.newGame("World Test", "veteran");
const S = ctx.S;

let fails = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS" : "FAIL") + " — " + name + (detail ? " · " + detail : ""));
  if (!ok) fails++;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmSafe(x) { return String(Math.round(x * 10) / 10); }

/* deterministic helpers: tickWorld is lastTick-guarded, so manual progression
   resets the guard; random rolls are stubbed inside the vm sandbox */
function setRandom(r) {
  if (r == null) { vm.runInContext("Math.random = __realRandom;", sandbox); return; }
  ctx.__stubRandom = function () { return r; };
  vm.runInContext("if (typeof __realRandom === 'undefined') { __realRandom = Math.random; } Math.random = __stubRandom;", sandbox);
}
function wtick(rand) {
  S.world.lastTick = 0;
  setRandom(rand);
  try { ctx.tickWorld(); } finally { setRandom(null); }
}
function withRand(rand, fn) { setRandom(rand); try { return fn(); } finally { setRandom(null); } }
function forceArc(kind, rivalName) {
  S.world.arc = { kind, rival: rivalName, w0: S.studio.week, el: 0, awaiting: false, resolved: false, ignored: false };
  S.pending = null;
  S.world.star = null;
}
function optEl(idx) { return { getAttribute: (k) => (k === "data-idx" ? String(idx) : null) }; }

/* ── 1. 80-week drive through the real weekly path ───────────── */
let threw = null;
try {
  /* engine.js advanceWeek calls tickWorld() itself (lastTick-guarded), so the
     explicit call here is a no-op — kept to prove idempotency. */
  for (let w = 0; w < 80 && !S.over; w++) {
    ctx.advanceWeek();
    ctx.tickWorld();
    if (!isFinite(S.studio.cash)) throw new Error("cash not finite at week " + S.studio.week);
  }
} catch (e) { threw = e; }
check("80 weeks advanceWeek+tickWorld without throw", !threw, threw ? String(threw) : "");
check("cash finite after drive", isFinite(S.studio.cash), fmSafe(S.studio.cash));
check("S.world namespace exists", !!S.world && typeof S.world.rel === "object" && typeof S.world.nextArc === "number");
let relOk = true, relBad = "";
for (const k of Object.keys(S.world.rel)) {
  if (!(S.world.rel[k] >= -100 && S.world.rel[k] <= 100)) { relOk = false; relBad = k + "=" + S.world.rel[k]; }
}
check("relations within -100..100", relOk, relBad || Object.keys(S.world.rel).length + " rivals tracked");
check("arc/star state finite or null",
  (S.world.arc === null || isFinite(S.world.arc.el)) && (S.world.star === null || isFinite(S.world.star.el)));
check("WORLD_DESKS defined with 2 World desks",
  Array.isArray(ctx.WORLD_DESKS) && ctx.WORLD_DESKS.length === 2 && ctx.WORLD_DESKS.every((d) => d.group === "World"),
  ctx.WORLD_DESKS ? ctx.WORLD_DESKS.map((d) => d.id).join(",") : "missing");

/* ── 2. feud: wk-3 choice, public truce (+20 rel, -$4M, arc ends) ── */
S.over = false;
S.studio.cash = 200;
const rivName = S.rivals[0].name;
S.world.rel[rivName] = 0;
const cashBefore = S.studio.cash;
forceArc("feud", rivName);
wtick(0.99); wtick(0.99); wtick(0.99); /* el 1..3 */
check("feud wk-3 sets pending storyline",
  !!S.pending && S.pending.type === "storyline" && S.pending.arc === "feud" && S.pending.options.length === 3,
  S.pending ? S.pending.title : "no pending");
const handledTruce = ctx.worldAction("pending-opt", optEl(0));
check("worldAction handles pending-opt (truce)", handledTruce === true && S.pending === null);
check("truce resolves arc + rel +20 -$4M",
  S.world.arc === null && ctx.wRel(rivName) === 20 && Math.abs(S.studio.cash - (cashBefore - 4)) < 0.01,
  "rel " + Math.round(ctx.wRel(rivName)) + " cash " + fmSafe(S.studio.cash));

/* ── 3. feud: escalate — blink and no-blink branches ─────────── */
forceArc("feud", rivName);
wtick(0.99); wtick(0.99); wtick(0.99);
const relPreBlink = ctx.wRel(rivName);
withRand(0.1, () => ctx.worldAction("pending-opt", optEl(1))); /* <0.5 → they blink */
check("escalate: blink branch ends arc +10 rel",
  S.world.arc === null && S.pending === null && Math.abs(ctx.wRel(rivName) - (relPreBlink + 10)) < 0.01);
forceArc("feud", rivName);
wtick(0.99); wtick(0.99); wtick(0.99);
const relPreNo = ctx.wRel(rivName);
withRand(0.99, () => ctx.worldAction("pending-opt", optEl(1))); /* ≥0.5 → no blink */
check("escalate: no-blink continues arc -12 rel",
  S.world.arc !== null && S.world.arc.el === 3 && S.pending === null && Math.abs(ctx.wRel(rivName) - (relPreNo - 12)) < 0.01);

/* ── 4. double down: next processed week's gross docked 5% ───── */
S.films.unshift({ id: "wT1", title: "Dock Bait", genre: "action", status: "run", opening: 50, decay: 0.8, weeksOut: 1, weekly: [10], dom: 10, intl: 0, cost: 20 });
forceArc("feud", rivName);
wtick(0.99); wtick(0.99); wtick(0.99);
withRand(0.99, () => ctx.worldAction("pending-opt", optEl(2))); /* double down */
check("double down arms next-week dock", S.world.ddWeek === S.studio.week + 1, "ddWeek " + S.world.ddWeek);
ctx.advanceWeek(); /* the engine's own tickWorld() applies the dock */
/* Read the dock from the ledger row, not from cash: the same week can also
   book awards or other income, which would mask the deduction. */
const dockRow = (S.weekTx.rows || []).find((r) => r.k === "Feud retaliation at the box office");
const dockDelta = Math.round(Math.abs(dockRow ? dockRow.v : 0) * 10) / 10;
const g = S.films[0].weekly[S.films[0].weekly.length - 1];
const dockExp = Math.round((g * 0.05 * 0.52) * 10) / 10;
check("feud dock hits running films (-5% week gross rentals)",
  S.world.ddWeek === 0 && !!dockRow && Math.abs(dockDelta - dockExp) < 0.05 && dockDelta > 0,
  "gross " + fmSafe(g) + " dock " + fmSafe(dockDelta) + " expected " + fmSafe(dockExp));

/* ── 5. takeover: merger / poach / ignore-at-expiry ───────────── */
forceArc("takeover", rivName);
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99); /* el 1..4 */
check("takeover wk-4 choice offered",
  !!S.pending && S.pending.type === "storyline" && S.pending.arc === "takeover");
S.world.rel[rivName] = 0;
const cashPreMerge = S.studio.cash;
ctx.worldAction("pending-opt", optEl(0)); /* defensive merger $30M */
check("merger: -$30M rel +30 arc ends",
  S.world.arc === null && ctx.wRel(rivName) === 30 && Math.abs(S.studio.cash - (cashPreMerge - 30)) < 0.01);
forceArc("takeover", rivName);
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99);
const powerPre = S.rivals[0].power;
const cashPrePoach = S.studio.cash;
ctx.worldAction("pending-opt", optEl(1)); /* poach staff $12M */
check("poach: -$12M rival power -0.1",
  S.world.arc === null && Math.abs(S.rivals[0].power - (powerPre - 0.1)) < 0.001 && Math.abs(S.studio.cash - (cashPrePoach - 12)) < 0.01,
  "power " + S.rivals[0].power.toFixed(2));
forceArc("takeover", rivName);
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99);
const repPreIgnore = S.studio.rep;
ctx.worldAction("pending-opt", optEl(2)); /* ignore */
check("ignore keeps arc running to expiry", S.world.arc !== null && S.world.arc.ignored === true);
S.world.arc.el = 7; /* jump to the final week */
wtick(0.99); /* ≥0.4 → no takeover damage */
check("ignore expiry: 60% branch rides it out",
  S.world.arc === null && S.studio.rep === repPreIgnore);
forceArc("takeover", rivName);
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99);
ctx.worldAction("pending-opt", optEl(2));
S.world.arc.el = 7;
const repPreHit = S.studio.rep;
wtick(0.1); /* <0.4 → rep -5 (no streamer in this harness) */
check("ignore expiry: 40% branch rep -5 without streamer",
  S.world.arc === null && S.studio.rep === Math.max(0, repPreHit - 5), "rep " + S.studio.rep);

/* ── 6. alliance via the real auto-start path (stubbed rolls) ─── */
S.world.arc = null;
S.world.nextArc = S.studio.week;
S.world.star = null;
const allyRiv = S.rivals[Math.floor(0.5 * S.rivals.length)].name; /* pick() with r=0.5 */
S.world.rel[allyRiv] = 0;
wtick(0.5); /* rivals roll 0.5 → index 2; kinds roll 0.5 → "alliance" */
check("auto-start rolls an alliance arc",
  !!S.world.arc && S.world.arc.kind === "alliance" && S.world.arc.rival === allyRiv,
  S.world.arc ? S.world.arc.kind + " · " + S.world.arc.rival : "no arc");
check("alliance start rel +20", ctx.wRel(allyRiv) === 20, "rel " + Math.round(ctx.wRel(allyRiv)));
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99); /* el 1..6 */
check("alliance ends after 6 weeks", S.world.arc === null);

/* ── 7. star scandal saga: burn + cleanup + unaffordable guard ── */
const star = S.market[0];
star.power = 5;
star.heat = 2;
star.followersK = 100;
S.pending = null;
S.world.star = null;
check("wStartStar starts a 4-week saga", ctx.wStartStar(star.id) === true && S.world.star && S.world.star.tid === star.id);
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99); /* el 1..4 */
check("star wk-4 choice offered",
  !!S.pending && S.pending.type === "storyline" && S.pending.arc === "star" && S.pending.options.length === 2,
  S.pending ? S.pending.title : "no pending");
const cashPreBurn = S.studio.cash;
ctx.worldAction("pending-opt", optEl(1)); /* let it burn */
check("burn: followersK ×0.7, saga ends",
  S.world.star === null && star.followersK === 70 && S.studio.cash === cashPreBurn, "followersK " + star.followersK);
S.pending = null;
ctx.wStartStar(star.id);
S.studio.cash = 1; /* unaffordable cleanup */
wtick(0.99); wtick(0.99); wtick(0.99); wtick(0.99);
const pendingKept = !!S.pending && S.pending.type === "storyline";
const handledPoor = ctx.worldAction("pending-opt", optEl(0)); /* PR cleanup $2M */
check("insufficient cash: option rejected, pending kept",
  handledPoor === true && pendingKept && !!S.pending && S.studio.cash === 1);
S.studio.cash = 20;
ctx.worldAction("pending-opt", optEl(0));
check("cleanup: -$2M heat -1 saga ends",
  S.world.star === null && star.heat === 1 && Math.abs(S.studio.cash - 18) < 0.01, "heat " + star.heat);

/* ── 8. museum: rejection, build, income moves with awards ────── */
S.world.museum = null;
S.studio.cash = 10;
const rejected = ctx.worldAction("world-build-museum");
check("museum build rejected at $10M cash", rejected === true && S.world.museum === null && S.studio.cash === 10);
S.studio.cash = 100;
const built = ctx.worldAction("world-build-museum");
check("museum builds for $50M", built === true && !!S.world.museum && Math.abs(S.studio.cash - 50) < 0.01);
S.stats.milestones.firstRelease = true;
const incBefore = S.studio.cash;
const count = Object.keys(S.stats.milestones).length;
const rateExp = Math.round((0.2 + 0.05 * count) * 10) / 10;
S.world.lastTick = 0;
ctx.tickWorld();
const incDelta = Math.round((S.studio.cash - incBefore) * 10) / 10;
check("museum weekly income = 0.2 + 0.05 per award/milestone",
  Math.abs(incDelta - rateExp) < 0.01 && incDelta > 0, "count " + count + " +" + incDelta + "M");

/* ── 9. Best Picture capture at woy 52 (pre-yearAwards gate) ──── */
S.films.unshift({ id: "wT2", title: "Award Bait", genre: "drama", quality: 80, status: "done", opening: 30, dom: 30, intl: 10, ww: 40, profit: 5, cost: 10, weekly: [], weeksOut: 2 });
S.studio.week += (52 - ctx.woyOf(S.studio.week) + 52) % 52;
S.world.lastTick = 0;
S.world.awardYear = 0;
S.yearOfFilms = ["wT2"];
const winsBefore = S.world.awardWins;
ctx.tickWorld();
check("quality>=75 year captures one Best Picture win", S.world.awardWins === winsBefore + 1, "wins " + S.world.awardWins);
S.world.lastTick = 0;
S.yearOfFilms = [];
ctx.tickWorld();
check("award capture is once per year", S.world.awardWins === winsBefore + 1);
check("forecastAdjust_world is 0", ctx.forecastAdjust_world() === 0);

/* ── 10. desks render real HTML ───────────────────────────────── */
let deskOk = true, deskDetail = "";
for (const d of ctx.WORLD_DESKS) {
  const html = d.render();
  if (typeof html !== "string" || html.indexOf("statrow") < 0 || html.indexOf("card") < 0) { deskOk = false; deskDetail = d.id + " bad body"; }
}
check("both desks render statrow/card HTML", deskOk, deskDetail);
check("museum desk shows exhibits",
  ctx.WORLD_DESKS[1].render().indexOf("Best Picture exhibits") >= 0 && ctx.WORLD_DESKS[1].render().indexOf("First film") >= 0);
check("story desk lists every rival relation",
  S.rivals.every((r) => ctx.WORLD_DESKS[0].render().indexOf(esc(r.name)) >= 0),
  S.rivals.length + " rivals");

/* ── final invariants ─────────────────────────────────────────── */
let finalOk = true;
for (const k of Object.keys(S.world.rel)) if (!(S.world.rel[k] >= -100 && S.world.rel[k] <= 100)) finalOk = false;
check("relations still clamped after all phases", finalOk);
check("worldAwardCount = milestones + wins",
  ctx.worldAwardCount() === Object.keys(S.stats.milestones).length + S.world.awardWins,
  "count " + ctx.worldAwardCount());

console.log(fails === 0 ? "\nALL CHECKS PASSED" : "\n" + fails + " CHECK(S) FAILED");
process.exit(fails === 0 ? 0 : 1);
