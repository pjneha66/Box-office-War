/* Rebuild people-module test: runs game/data.js + game/engine.js + game/people.js in a VM
   sandbox with stubbed localStorage/ui helpers, then exercises followings, chemistry hooks,
   lifecycles (deterministic via a seeded PRNG) and the academy flow.
   engine.js does not call tickPeople yet (integrator wiring) — per the module contract the
   harness calls tickPeople itself after advanceWeek. Usage: node test/rebuild-people.mjs */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? "PASS  " : "FAIL  ") + name + (ok || detail == null ? "" : " — " + detail));
  if (!ok) failures++;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCtx() {
  const mem = {};
  const toasts = [];
  const ctx = {
    console, Math, JSON, Date, isFinite, isNaN, parseInt, parseFloat,
    Number, String, Object, Array,
    navigator: {},
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    },
    /* ui.js stubs (people.js calls render/rerenderSheet/pushToast/tag) */
    render: () => {},
    openSheet: () => {},
    rerenderSheet: () => {},
    closeSheet: () => {},
    pushToast: (txt, kind) => { toasts.push({ txt: String(txt), kind: kind || "" }); },
    tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
  };
  ctx.__toasts = toasts;
  return ctx;
}

const ctx = makeCtx();
const sandbox = vm.createContext(ctx);
for (const f of ["data.js", "engine.js", "people.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), sandbox, { filename: f });
}

ctx.newGame("People Test", "veteran");
const S = ctx.S;
const el = (id) => ({ getAttribute: (k) => (k === "data-id" ? id : null) });
const tickNext = () => { ctx.advanceWeek(); S.studio.cash = Math.max(S.studio.cash, 100); ctx.tickPeople(); };

/* ── 1. contract shape ───────────────────────────────────────── */
const desks = ctx.PEOPLE_DESKS;
check("PEOPLE_DESKS: 2 entries, contract shape",
  Array.isArray(desks) && desks.length === 2 && desks.every((d) =>
    d.id && d.group === "Talent" && d.icon && d.name && d.desc && typeof d.render === "function")
  && desks[0].id === "ppl-chem" && desks[1].id === "ppl-academy");
let deskOk = true, deskBad = "";
desks.forEach((d) => {
  const h = d.render();
  if (typeof h !== "string" || h.indexOf("data-ppldesk") < 0 || /NaN|undefined/.test(h)) { deskOk = false; deskBad = d.id; }
});
check("desk HTML renders clean (marker, no NaN/undefined)", deskOk, deskBad);
check("forecastAdjust() returns 0", ctx.forecastAdjust_people() === 0);

/* ── 2. followings: lazy seed via first tick ─────────────────── */
ctx.tickPeople();
const seeded = S.market.every((t) => t.followersK >= 5 && isFinite(t.followersK));
check("tickPeople seeds followersK for every market talent (≥5, finite)", seeded,
  S.market.filter((t) => !t.followersK).length + " missing");
const powerSum = S.market.reduce((a, t) => a + t.followersK / (t.power * 10), 0);
check("seeding follows followersK = ri(5,50)·power range", powerSum >= S.market.length * 0.5 && powerSum <= S.market.length * 5,
  "mean ratio " + (powerSum / S.market.length).toFixed(2));

/* ── 3. socialBuzzMult ───────────────────────────────────────── */
const buzzLead = S.market.find((t) => t.k === "actor");
buzzLead.followersK = 40;
check("socialBuzzMult: 40K → 1.01", Math.abs(ctx.socialBuzzMult({ actId: buzzLead.id }) - 1.01) < 1e-9);
buzzLead.followersK = 600;
check("socialBuzzMult: 600K → cap boundary 1.15", Math.abs(ctx.socialBuzzMult({ actId: buzzLead.id }) - 1.15) < 1e-9);
buzzLead.followersK = 9000;
check("socialBuzzMult: caps at 1.15", Math.abs(ctx.socialBuzzMult({ actId: buzzLead.id }) - 1.15) < 1e-9);
check("socialBuzzMult: no lead → 0 (engine treats as neutral)", ctx.socialBuzzMult({ actId: "t999999" }) === 0);

/* ── 4. release bumps + chemistry on completed films ─────────── */
/* power ≤ 3 picks: star drift (±10%/wk) only touches power ≥ 4, so the math stays exact */
const lead = S.market.find((t) => t.k === "actor" && t.power <= 3);
const dir = S.market.find((t) => t.k === "dir" && t.power <= 3);
lead.followersK = 100; dir.followersK = 200;
S.films.unshift({
  id: "fTEST1", title: "Hit Film", genre: "action", scale: "mid", budget: 40, mkt: 10, cost: 50,
  dirId: dir.id, actId: lead.id, status: "done", profit: 50, opening: 12, weeksOut: 5, dom: 60, weekly: [], window: 45
});
tickNext();
check("hit: lead actor followersK ×1.25", Math.abs(lead.followersK - 125) < 0.01, String(lead.followersK));
check("hit: director followersK ×1.15", Math.abs(dir.followersK - 230) < 0.01, String(dir.followersK));
check("hit: first pairing score 50+12 = 62", S.ppl.chem[dir.id + "|" + lead.id].score === 62);
check("chemCraftMod after hit (score 62) = 0.72", Math.abs(ctx.chemCraftMod(dir.id, lead.id) - 0.72) < 1e-9);
check("chemOpenMult after hit (score 62) = 1.024", Math.abs(ctx.chemOpenMult({ dirId: dir.id, actId: lead.id }) - 1.024) < 1e-9);
check("film marked seen (no double bump)", S.ppl.seenFilmIds.indexOf("fTEST1") >= 0);
ctx.tickPeople();
check("tickPeople idempotent per week (followersK unchanged on re-tick)", Math.abs(lead.followersK - 125) < 0.01);

const act2 = S.market.find((t) => t.k === "actor" && t !== lead && t.power <= 3);
const dir2 = S.market.find((t) => t.k === "dir" && t !== dir && t.power <= 3);
act2.followersK = 100; dir2.followersK = 200;
S.films.unshift({
  id: "fTEST2", title: "Flop Film", genre: "action", scale: "mid", budget: 100, mkt: 20, cost: 120,
  dirId: dir2.id, actId: act2.id, status: "done", profit: -60, opening: 6, weeksOut: 4, dom: 20, weekly: [], window: 45
});
tickNext();
check("flop (profit < −35% cost): lead ×0.8", Math.abs(act2.followersK - 80) < 0.01, String(act2.followersK));
check("flop: director ×0.85", Math.abs(dir2.followersK - 170) < 0.01, String(dir2.followersK));
check("flop: pair score 50−8 = 42", S.ppl.chem[dir2.id + "|" + act2.id] && S.ppl.chem[dir2.id + "|" + act2.id].score === 42);

S.ppl.chem["x|y"] = { d: "x", a: "y", score: 79, duo: false };
check("chemCraftMod below duo bar: score 79 → +1.74 (no bonus)", Math.abs(ctx.chemCraftMod("x", "y") - 1.74) < 1e-9);
check("chemCraftMod range floor: score 0 → −3", (() => {
  S.ppl.chem["x|y"].score = 0; return Math.abs(ctx.chemCraftMod("x", "y") + 3) < 1e-9;
})());
check("chemCraftMod duo boundary: score 80 → 1.8 + 2 = 3.8", (() => {
  S.ppl.chem["x|y"].score = 80; return Math.abs(ctx.chemCraftMod("x", "y") - 3.8) < 1e-9;
})());
check("chemCraftMod range ceiling: score 100 (duo) → +3 +2 = 5", (() => {
  S.ppl.chem["x|y"].score = 100; return Math.abs(ctx.chemCraftMod("x", "y") - 5) < 1e-9;
})());
check("chemOpenMult range: score 0 → 0.9, score 100 → 1.1", (() => {
  S.ppl.chem["x|y"].score = 0;
  const lo = ctx.chemOpenMult({ dirId: "x", actId: "y" });
  S.ppl.chem["x|y"].score = 100;
  const hi = ctx.chemOpenMult({ dirId: "x", actId: "y" });
  return Math.abs(lo - 0.9) < 1e-9 && Math.abs(hi - 1.1) < 1e-9;
})());
check("chemOpenMult: unpaired → 0 (neutral)", ctx.chemOpenMult({ dirId: "nope", actId: "nope2" }) === 0);
S.ppl.chem["x|y"].score = 50;

/* ── 5. legendary duo: news exactly once ─────────────────────── */
const duoCount = () => S.news.filter((n) => n.txt.indexOf("legendary duo") >= 0).length;
S.films.unshift({
  id: "fTEST3", title: "Duo Film", genre: "comedy", scale: "indie", budget: 30, mkt: 8, cost: 38,
  dirId: dir.id, actId: lead.id, status: "done", profit: 20, opening: 9, weeksOut: 4, dom: 45, weekly: [], window: 45
});
tickNext(); /* 62 + 12 = 74 — not yet */
check("score 74 — no duo yet", S.ppl.chem[dir.id + "|" + lead.id].score === 74 && duoCount() === 0);
S.films.unshift({
  id: "fTEST4", title: "Duo Film II", genre: "comedy", scale: "indie", budget: 30, mkt: 8, cost: 38,
  dirId: dir.id, actId: lead.id, status: "done", profit: 25, opening: 10, weeksOut: 4, dom: 50, weekly: [], window: 45
});
tickNext(); /* 74 + 12 = 86 → duo */
const pair = S.ppl.chem[dir.id + "|" + lead.id];
check("duo pair score 86, flagged duo", pair.score === 86 && pair.duo === true, "score " + pair.score);
check("duo news logged exactly once", duoCount() === 1, String(duoCount()));
check("chemCraftMod duo = (86−50)·0.06 + 2 = 4.16", Math.abs(ctx.chemCraftMod(dir.id, lead.id) - 4.16) < 1e-9);
S.films.unshift({
  id: "fTEST5", title: "Duo Film III", genre: "comedy", scale: "indie", budget: 30, mkt: 8, cost: 38,
  dirId: dir.id, actId: lead.id, status: "done", profit: 15, opening: 9, weeksOut: 4, dom: 40, weekly: [], window: 45
});
tickNext(); /* 86 + 12 → 98 */
check("duo news still exactly once (no repeat)", duoCount() === 1, String(duoCount()));

/* ── 6. lifecycles: retire / comeback / legend / aging (seeded PRNG) ── */
const realRandom = Math.random;
Math.random = mulberry32(12345);
try {
  const star = S.market.find((t) => t.power >= 4);
  star.age = 58;
  let rolls = 0, retired = false;
  while (rolls < 400 && !retired) { ctx.pplYearlyRolls(); rolls++; retired = !!S.ppl.retired.find((t) => t.id === star.id); }
  check("star (power≥4, age 58) retires within seeded rolls and lands in S.ppl.retired", retired, rolls + " rolls");
  check("retirement news logged", S.news.some((n) => n.txt.indexOf(star.n) >= 0 && n.txt.indexOf("announces retirement") >= 0));
  const powerAtRetire = star.power;
  let back = false;
  while (rolls < 900 && !back) { ctx.pplYearlyRolls(); rolls++; back = !!S.market.find((t) => t.id === star.id); }
  check("retired legend comes back within seeded rolls", back, rolls + " rolls");
  check("comeback surrenders one power notch", star.power === Math.max(1, powerAtRetire - 1), powerAtRetire + "→" + star.power);
  check("comeback news logged", S.news.some((n) => n.txt.indexOf("comes out of retirement") >= 0));
  const mid = S.market.find((t) => t.age >= 50 && !t.legend && t.power < 4);
  if (!mid) {
    const cand = S.market.find((t) => !t.legend);
    if (cand) cand.age = 50;
  }
  const mid2 = S.market.find((t) => t.age >= 50 && !t.legend);
  let lrolls = 0;
  while (mid2 && lrolls < 400 && !mid2.legend) { ctx.pplYearlyRolls(); lrolls++; }
  check("age-50 talent gains legend status within seeded rolls", !mid2 || mid2.legend === true);
  if (mid2) check("legend flag grants heat +1", mid2.heat >= 1, "heat " + mid2.heat);
  check("aging: yearly rolls advance age", rolls >= 10 && star.age > 58);
} finally {
  Math.random = realRandom;
}

/* ── 7. academy flow ─────────────────────────────────────────── */
const rejectedToast = () => ctx.__toasts.some((t) => t.txt.indexOf("Need") >= 0);
S.studio.cash = 1;
const before = S.ppl.academy.length;
ctx.__toasts.length = 0;
ctx.peopleAction("ppl-enroll", el(null));
check("enroll rejected on insufficient cash (state unchanged, toast shown)",
  S.ppl.academy.length === before && S.studio.cash === 1 && rejectedToast());
S.studio.cash = 100;
check("enroll works: $6M spent, prospect created (age 16, power 1)",
  ctx.peopleAction("ppl-enroll", el(null)) === true && S.ppl.academy.length === before + 1 && Math.abs(S.studio.cash - 94) < 1e-9
  && S.ppl.academy[0].age === 16 && S.ppl.academy[0].power === 1);
ctx.peopleAction("ppl-enroll", el(null));
ctx.peopleAction("ppl-enroll", el(null));
const fullCash = S.studio.cash;
ctx.peopleAction("ppl-enroll", el(null));
check("max 3 prospects enforced (4th rejected, no charge)", S.ppl.academy.length === 3 && Math.abs(S.studio.cash - fullCash) < 1e-9);
const p1 = S.ppl.academy[0];
const skill0 = p1.skill;
S.studio.cash = 1;
ctx.peopleAction("ppl-train", el(p1.id));
check("train rejected on insufficient cash (state unchanged)", p1.trainings === 0 && S.studio.cash === 1);
S.studio.cash = 20;
const t1 = S.studio.cash;
check("train 1: $4M, skill +8", ctx.peopleAction("ppl-train", el(p1.id)) === true && p1.skill === Math.min(97, skill0 + 8) && Math.abs(S.studio.cash - (t1 - 4)) < 1e-9);
ctx.peopleAction("ppl-train", el(p1.id));
ctx.peopleAction("ppl-train", el(p1.id));
check("train caps at 3 blocks (4th rejected, no charge)", p1.trainings === 3 && Math.abs(S.studio.cash - (t1 - 12)) < 1e-9);
const mk = S.market.length;
tickNext();
const grad = S.market.find((t) => t.n === p1.n);
check("graduate after 3 trainings: power 1+⌊3/2⌋=2, joins market, academy slot freed",
  S.ppl.academy.length === 2 && !!grad && grad.power === 2 && Math.abs(grad.fee - ctx.FEE_ACTOR[1]) < 1e-9,
  "market +" + (S.market.length - mk) + " gradPower " + (grad && grad.power));
check("graduate news logged", S.news.some((n) => n.txt.indexOf("Academy graduate") >= 0));
const p2 = S.ppl.academy[0];
p2.weeks = 51;
tickNext();
const grad2 = S.market.find((t) => t.n === p2.n);
check("graduate after 52 weeks (no trainings → power 1)",
  S.ppl.academy.length === 1 && !!grad2 && grad2.power === 1, "found " + !!grad2);

/* ── 8. action dispatch ──────────────────────────────────────── */
check("peopleAction ignores foreign prefixes", ctx.peopleAction("tv-license", el(null)) === false && ctx.peopleAction("empire-x", el(null)) === false);
check("peopleAction ignores unknown ppl- actions", ctx.peopleAction("ppl-bogus", el(null)) === false);

/* ── 9. 60-week soak through the real pipeline ───────────────── */
const driftStar = S.market.find((t) => t.power >= 4);
const starF0 = driftStar ? driftStar.followersK : 0;
let threw = null;
S.studio.cash = Math.max(S.studio.cash, 500);
try {
  for (let w = 0; w < 60; w++) {
    tickNext();
    if (!isFinite(S.studio.cash)) throw new Error("cash not finite at week " + S.studio.week);
    S.market.forEach((t) => { if (!isFinite(t.followersK) || t.followersK < 1) throw new Error("bad followersK " + t.followersK); });
    for (const k in S.ppl.chem) {
      if (S.ppl.chem.hasOwnProperty(k)) {
        const sc = S.ppl.chem[k].score;
        if (sc < 0 || sc > 100 || !isFinite(sc)) throw new Error("chem score out of range " + sc);
      }
    }
    S.ppl.academy.forEach((p) => { if (!isFinite(p.skill) || !isFinite(p.weeks)) throw new Error("bad academy fields"); });
    if (S.ppl.retired.some((t) => !isFinite(t.age))) throw new Error("bad retired age");
  }
} catch (e) { threw = e; }
check("60 advanceWeek()+tickPeople cycles: no throw, cash/followersK/chem/academy/retired all finite & in range", threw === null, threw && threw.message);
check("star followings moved over the soak (drift + bumps are live)", !driftStar || Math.abs(driftStar.followersK - starF0) > 0.01,
  starF0 + "→" + (driftStar && driftStar.followersK));
check("S.ppl namespace intact after soak", !!S.ppl && Array.isArray(S.ppl.retired) && Array.isArray(S.ppl.seenFilmIds) && Array.isArray(S.ppl.academy));
deskOk = true;
desks.forEach((d) => { const h = d.render(); if (/NaN|undefined/.test(h)) deskOk = false; });
check("desk HTML still clean after 60-week soak", deskOk);

console.log(failures ? "\n" + failures + " check(s) FAILED" : "\nAll checks passed");
process.exit(failures ? 1 : 0);
