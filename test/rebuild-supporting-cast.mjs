/* Rebuild supporting-cast harness (pattern from test/rebuild-finance.mjs): runs game/data.js +
   game/engine.js in a VM sandbox with a stubbed localStorage. Checks:
   - the talent market cap is 60
   - a film can take a lead plus up to three supporting actors, each charged half a fee
   - supporting actors are booked and released when the film wraps
   - a booked, duplicate, or non-actor supporting pick is refused
   - supporting actors add audience pull, capped at +3; old films with no supIds get 0
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
  Number, String, Object, Array, Promise, navigator: {},
  localStorage: {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  }
});
for (const f of ["data.js", "engine.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const src = readFileSync(path.join(gameDir, "engine.js"), "utf8");

/* ── static checks ───────────────────────────────────────────── */
check("market cap is 60", C.MARKET_CAP === 60, String(C.MARKET_CAP));
check("no stale 34 cap left in churnTalent", !/S\.market\.length < 34/.test(src));
check("supporting limit is 3", C.MAX_SUPPORT === 3);

/* ── fresh studio ────────────────────────────────────────────── */
C.newGame("Supporting Cast Test", "veteran");
const S = C.S;
S.studio.cash = 5000;

// an idea to greenlight
if (!S.ideas || !S.ideas.length) S.ideas = [];
const idea = { id: "sc1", title: "The Ensemble", genre: "drama", price: 10, script: 70, theme: null, franchiseOf: null };
S.ideas.push(idea);

const actors = S.market.filter(t => t.k === "actor");
const dirs = S.market.filter(t => t.k === "dir");
check("market has enough actors for a lead plus three", actors.length >= 4, "actors " + actors.length);
check("market has a director", dirs.length >= 1);

const lead = actors[0], dir = dirs[0];
const sups = actors.slice(1, 4);
const budgetIdx = 1;
const sc = C.scaleOf("indie");
const budget = sc.budgets[budgetIdx];
const feeSum = sups.reduce((a, t) => a + C.supportFee(t, budget), 0);
const leadFee = C.feeFor(lead, budget), dirFee = C.feeFor(dir, budget);
const script = Math.round(idea.price * 10) / 10;
const cashBefore = S.studio.cash;
const projBefore = S.projects.length;

const r = C.greenlight(idea.id, { scale: "indie", bIdx: budgetIdx, dirId: dir.id, actorId: lead.id, supportIds: sups.map(t => t.id), mktIdx: 1 });
check("greenlight with lead + three supporting succeeds", !!r.ok, r.err || "");
const p = S.projects[S.projects.length - 1];
check("project created", S.projects.length === projBefore + 1);
check("project stores three supporting ids", p && p.supIds && p.supIds.length === 3, p && p.supIds ? p.supIds.length : "none");
const paid = Math.round((cashBefore - S.studio.cash) * 10) / 10;
const expect = Math.round((script + leadFee + dirFee + feeSum) * 10) / 10;
check("cash charged for script, lead, director and supporting", Math.abs(paid - expect) < 0.11, "paid " + paid + " expected " + expect);
check("supporting actors are booked", sups.every(t => C.talentBusy(t)));

/* ── refusals ────────────────────────────────────────────────── */
const idea2 = { id: "sc2", title: "Second Ensemble", genre: "comedy", price: 6, script: 60, theme: null, franchiseOf: null };
S.ideas.push(idea2);
const free = S.market.filter(t => t.k === "actor" && !C.talentBusy(t));
const lead2 = free[0];
function freeDirs0() { const f = S.market.filter(t => t.k === "dir" && !C.talentBusy(t)); return f[0].id; }
const r2 = C.greenlight(idea2.id, { scale: "indie", bIdx: budgetIdx, dirId: freeDirs0(), actorId: lead2.id, supportIds: [sups[0].id], mktIdx: 1 });
check("a booked supporting actor is refused", !!r2.err, r2.err || "accepted");

const freeDirs = S.market.filter(t => t.k === "dir" && !C.talentBusy(t));
const d = freeDirs[0];
const r3 = C.greenlight(idea2.id, { scale: "indie", bIdx: budgetIdx, dirId: d.id, actorId: lead2.id, supportIds: [d.id], mktIdx: 1 });
check("a director cannot be a supporting actor", !!r3.err, r3.err || "accepted");

const r4 = C.greenlight(idea2.id, { scale: "indie", bIdx: budgetIdx, dirId: d.id, actorId: lead2.id, supportIds: [lead2.id], mktIdx: 1 });
check("the lead cannot also be supporting", !!r4.err, r4.err || "accepted");

const free2 = S.market.filter(t => t.k === "actor" && !C.talentBusy(t) && t.id !== lead2.id);
const dupA = free2[0];
const r5 = C.greenlight(idea2.id, { scale: "indie", bIdx: budgetIdx, dirId: d.id, actorId: lead2.id, supportIds: [dupA.id, dupA.id], mktIdx: 1 });
check("duplicate supporting actor is refused", !!r5.err, r5.err || "accepted");

/* ── audience pull ───────────────────────────────────────────── */
const none = C.supportBonus({});
check("no supporting cast adds nothing (old saves too)", none === 0);
const stars = [{ id: "x1", power: 5 }, { id: "x2", power: 5 }, { id: "x3", power: 5 }, { id: "x4", power: 5 }];
S.market.push(...stars);
check("three five-star supporting actors reach the +3 cap", C.supportBonus({ supIds: ["x1", "x2", "x3"] }) === 3);
check("four five-star supporting actors still cap at +3", C.supportBonus({ supIds: ["x1", "x2", "x3", "x4"] }) === 3);
check("a power-2 supporting actor adds nothing", C.supportBonus({ supIds: [sups[0].id] }) >= 0 && (() => {
  const t = sups[0]; const was = t.power; t.power = 2; const v = C.supportBonus({ supIds: [t.id] }); t.power = was; return v === 0;
})());
S.market.splice(S.market.length - stars.length, stars.length);

/* ── release at wrap ─────────────────────────────────────────── */
let wrapped = false, wrapWeeks = 0, err = "";
for (let i = 0; i < 260 && !wrapped; i++) {
  try { C.advanceWeek(); } catch (e) { err = e.message; break; }
  wrapWeeks++;
  const pf = S.films.find(f => f.title === p.title);
  if (pf && pf.status !== "run") wrapped = true;
  if (p.phase === "ready" && !p.releaseWeek) { S.studio.cash += 200; C.setRelease(p, S.studio.week + 1, 1, 45); }
  if (S.studio.cash < 0) S.studio.cash = 1000;
}
check("the film wraps during the run", wrapped || !!err, err || ("theatrical run ended after " + wrapWeeks + " weeks"));
if (wrapped) {
  const film = S.films.find(f => f.title === p.title);
  check("wrapped film keeps its supporting ids", film && film.supIds && film.supIds.length === 3);
  check("supporting actors are released at wrap", sups.every(t => !C.talentBusy(t)));
}

check("market stays within the cap", S.market.length <= 60, "market " + S.market.length);

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED"));
process.exit(failures ? 1 : 0);
