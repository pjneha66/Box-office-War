/* Rebuild craft-departments harness (pattern from test/rebuild-consolehw.mjs): runs
   game/data.js + game/engine.js + game/craft.js in a VM sandbox with a stubbed
   localStorage. ui.js needs a DOM, so the two ui helpers the module renders with
   (statrow/tag) are stubbed verbatim.
   engine.js calls tickCraft() itself now, so the harness only calls it when the module's
   lastTick guard says the week has not been ticked — the guard makes the call a no-op
   whether the integrator has wired the hook or not.
   Drives 80+ advanceWeek() calls while exercising every action through the real
   craftAction: hire a head in each of the four departments, insufficient-cash rejection
   on hire/assign/fire, assign each head to a real project, verify the effect is scoped
   to the assigned project, verify the weekly retainer reaches the ledger, verify
   freshness decay, replacement, severance and the double-tick guard.
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
for (const f of ["data.js", "engine.js", "craft.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;

/* ── static contract checks on the module source ──────────────── */
const src = readFileSync(path.join(gameDir, "craft.js"), "utf8");
for (const tok of ["=>", "`", "const ", "let ", "?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "class "]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickCraft / craftAction / craftDeptMods / craftCriticAdj / CRAFT_DESKS",
  typeof C.tickCraft === "function" && typeof C.craftAction === "function" &&
  typeof C.craftDeptMods === "function" && typeof C.craftCriticAdj === "function" &&
  Array.isArray(C.CRAFT_DESKS));
check("CRAFT_DESKS is 2 'Production' desks: craft-depts + craft-assign",
  C.CRAFT_DESKS.length === 2 &&
  C.CRAFT_DESKS.map((d) => d.id).join(",") === "craft-depts,craft-assign" &&
  C.CRAFT_DESKS.every((d) => d.group === "Production" && d.icon && d.name && d.desc && typeof d.render === "function"),
  C.CRAFT_DESKS.map((d) => d.id).join(","));
check("four departments only: cinematography, design, sound, previz",
  Array.isArray(C.CRAFT_DEPTS) && C.CRAFT_DEPTS.length === 4 &&
  C.CRAFT_DEPTS.map((d) => d.id).join(",") === "cinematography,design,sound,previz",
  C.CRAFT_DEPTS.map((d) => d.id).join(","));
check("module does not duplicate crew.js roles (no dp/editor/composer department)",
  !C.CRAFT_DEPTS.some((d) => /^(dp|editor|composer)$/.test(d.id)) &&
  src.indexOf("CREW_") < 0 && src.indexOf("crewMods") < 0);
check("CRAFT_ACHIEVEMENTS: >= 4, unique ids, tier 1-3, test is a function",
  Array.isArray(C.CRAFT_ACHIEVEMENTS) && C.CRAFT_ACHIEVEMENTS.length >= 4 &&
  C.CRAFT_ACHIEVEMENTS.every((a) => typeof a.id === "string" && a.id.indexOf("craft-") === 0 &&
    [1, 2, 3].indexOf(a.tier) >= 0 && typeof a.name === "string" &&
    typeof a.desc === "string" && typeof a.test === "function") &&
  new Set(C.CRAFT_ACHIEVEMENTS.map((a) => a.id)).size === C.CRAFT_ACHIEVEMENTS.length,
  C.CRAFT_ACHIEVEMENTS.length + " achievements");

/* ── drive helpers ────────────────────────────────────────────── */
let weeksDriven = 0, minCash = Infinity, threw = null, ledgerBreaks = 0, topups = 0;
const spendRows = [], earnRows = [];
function advance(n) {
  for (let i = 0; i < n; i++) {
    /* keep the studio solvent so the soak measures the module, not bankruptcy */
    if (S().studio.cash < 60) { S().studio.cash = 320; topups++; }
    const before = S().studio.cash;
    try {
      C.advanceWeek();
      /* engine.js may or may not call tickCraft(); the module's lastTick guard makes
         this call a no-op when it already ran. */
      if (!S().craft || S().craft.lastTick !== S().studio.week) C.tickCraft();
    } catch (e) {
      threw = "week " + S().studio.week + ": " + (e.stack || e);
      return;
    }
    weeksDriven++;
    const st = S().studio;
    if (!isFinite(st.cash)) { threw = "non-finite cash at week " + st.week; return; }
    if (st.cash < minCash) minCash = st.cash;
    if (S().over) { threw = "studio went bankrupt at week " + st.week; return; }
    const rows = S().weekTx ? S().weekTx.rows : [];
    let sum = 0;
    for (const r of rows) {
      sum += r.v;
      if (r.v < 0 && spendRows.indexOf(r.k) < 0) spendRows.push(r.k);
      if (r.v > 0 && earnRows.indexOf(r.k) < 0) earnRows.push(r.k);
    }
    if (!nearly(st.cash - before, sum, 0.05)) ledgerBreaks++;
  }
}
function desksRenderClean(label) {
  let bad = "";
  for (const d of C.CRAFT_DESKS) {
    let html = null;
    try { html = d.render(); } catch (e) { bad = d.id + " threw"; break; }
    if (typeof html !== "string" || html.length < 80) { bad = d.id + " (short)"; break; }
    if (html.indexOf("NaN") >= 0 || /undefined/.test(html)) { bad = d.id + " (NaN/undefined)"; break; }
  }
  check("both desks render non-empty, clean HTML " + label, bad === "", bad);
}
function fakeProject(id, title, genre, phase, opts) {
  const o = opts || {};
  S().projects.push({
    id, title, genre, scale: "micro", budget: o.budget || 6, budgetNow: o.budget || 6,
    script: 60, dirId: "t0", actId: "t0", dirFee: 1, actFee: 1, scriptCost: 1,
    mktIdx: 1, mkt: null, releaseWeek: null,
    phase, phaseWk: 0, phaseLen: { pre: o.pre || 30, shoot: o.shoot || 30, post: o.post || 60 },
    overrun: 0, scandal: false, buzz: 0, franchiseOf: null, prodScore: 55,
    quality: 65, qPreview: 65
  });
}
function fakeFilm(id, title, genre, quality) {
  S().films.unshift({
    id, title, genre, scale: "indie", budget: 20, mkt: 8, cost: 30,
    dirId: "t0", actId: "t0", quality, criticAvg: 70, freshPct: 75, aud: 70, quotes: [],
    opening: 34, legs: 2.6, decay: 1 - 1 / 2.6, weeksOut: 0, dom: 0, weekly: [],
    releaseWeek: S().studio.week, season: "Winter", franchiseOf: null, status: "run"
  });
}
function elx(id, key) {
  return { getAttribute: (k) => (k === "data-id" ? id : k === "data-key" ? key : null) };
}
function ledRows(sub) {
  return (S().weekTx && S().weekTx.rows ? S().weekTx.rows : []).filter((r) => r.k.indexOf(sub) === 0);
}

/* ── week 1: lazy ensure, boards, invariants ──────────────────── */
C.newGame("Craft Test", "veteran");
check("S.craft is absent on a fresh save (lazy ensure is real)", !S().craft);
C.tickCraft();
check("S.craft namespace created lazily by tickCraft",
  !!S().craft && !!S().craft.heads && !!S().craft.pool && !!S().craft.assign &&
  !!S().craft.fresh && !!S().craft.morale &&
  isFinite(S().craft.lastTick) && isFinite(S().craft.retainersPaid) &&
  isFinite(S().craft.hires) && isFinite(S().craft.assigns));
check("tick recorded the week (lastTick === studio.week)",
  S().craft.lastTick === S().studio.week, "week " + S().studio.week);
check("every department has a 3-candidate board",
  C.CRAFT_DEPTS.every((d) => Array.isArray(S().craft.pool[d.id]) && S().craft.pool[d.id].length === 3));
const cands0 = C.CRAFT_DEPTS.map((d) => S().craft.pool[d.id].map((c) => c.id).join("/")).join(",");
check("candidate invariants: tier 1-3, retainer matches table, sign = retainer×3, id cr-prefixed",
  C.CRAFT_DEPTS.every((d) => S().craft.pool[d.id].every((c) =>
    c.tier >= 1 && c.tier <= 3 && c.dept === d.id &&
    isFinite(c.retainer) && nearly(c.retainer, C.CRAFT_RETAIN[d.id][c.tier - 1]) &&
    nearly(c.sign, Math.round(c.retainer * 3 * 10) / 10) &&
    typeof c.n === "string" && c.n.length > 2 && c.id.indexOf("cr") === 0)));
check("craftDeptMods(p) is null-safe (no project → zeros)",
  C.craftDeptMods(null).craft === 0 && C.craftDeptMods({}).craft === 0);
check("craftCriticAdj(p) is null-safe", C.craftCriticAdj(null) === 0 && C.craftCriticAdj({}) === 0);
check("craftPayroll() is 0 before any hire", C.craftPayroll() === 0);
check("double-tick guard: second tickCraft() in the same week is a no-op",
  (() => { const c = S().studio.cash; const p0 = S().craft.retainersPaid; C.tickCraft();
           return S().studio.cash === c && S().craft.retainersPaid === p0; })());

/* ── boards rotate weekly ─────────────────────────────────────── */
advance(1);
const cands1 = C.CRAFT_DEPTS.map((d) => S().craft.pool[d.id].map((c) => c.id).join("/")).join(",");
check("candidate boards rotate every week", cands0 !== cands1, "6 new names per week");
check("rotation keeps every department at 3 candidates",
  C.CRAFT_DEPTS.every((d) => S().craft.pool[d.id].length === 3));

/* ── fixtures: real projects in pre / shoot / post ────────────── */
fakeProject("p9001", "Craft Pic", "drama", "pre");
fakeProject("p9002", "Craft Pic II", "comedy", "pre");
fakeProject("p9003", "Craft Pic III", "scifi", "shoot");
fakeProject("p9004", "Craft Pic IV", "crime", "post");
/* a film already in theatres: proves the ledger carries income alongside craft costs */
fakeFilm("f9001", "Craft Running", "drama", 74);
const p1 = C.findProject("p9001");
const p2 = C.findProject("p9002");
const p3 = C.findProject("p9003");
const p4 = C.findProject("p9004");
check("craftDeptMods before any staff: zeros", C.craftDeptMods(p1).craft === 0 &&
  C.craftDeptMods(p1).aud === 0 && C.craftDeptMods(p1).legs === 0);

/* ── insufficient cash: hire ─────────────────────────────────── */
const cheapest = (deptId) => S().craft.pool[deptId].slice().sort((a, b) => a.sign - b.sign)[0];
S().studio.cash = 0.2;
const poorHire = C.craftHire(cheapest("cinematography").id, "cinematography");
check("insufficient-cash hire rejected, no head seated, cash untouched",
  !!poorHire.err && !S().craft.heads.cinematography && S().studio.cash === 0.2, poorHire.err || "");
check("unknown department rejected", !!C.craftHire(cheapest("sound").id, "catering").err);
S().studio.cash = 400;

/* ── hire a head in each of the four departments via craftAction ── */
const hired = {};
let signSum = 0;
let hireOk = true;
for (const d of C.CRAFT_DEPTS) {
  const c = cheapest(d.id);
  hired[d.id] = c;
  signSum += c.sign;
  hireOk = hireOk && C.craftAction("craft-hire", elx(c.id, d.id)) === true &&
    !!S().craft.heads[d.id] && S().craft.heads[d.id].id === c.id;
}
check("a head hired in every department through craftAction", hireOk,
  C.CRAFT_DEPTS.map((d) => d.n + "=" + hired[d.id].n).join(" · "));
check("hire ledger rows: 4 signing fees booked",
  ledRows("Craft signing · ").length === 4, ledRows("Craft signing · ").length + " rows");
check("hires counter + retainer payroll match the board",
  S().craft.hires === 4 && nearly(C.craftPayroll(), Math.round(
    C.CRAFT_DEPTS.reduce((a, d) => a + hired[d.id].retainer, 0) * 10) / 10));
check("head snapshot carries tier/retainer/contract (until = week + 26)",
  C.CRAFT_DEPTS.every((d) => {
    const h = S().craft.heads[d.id];
    return h.tier === hired[d.id].tier && nearly(h.retainer, hired[d.id].retainer) &&
      h.until === h.week + C.CRAFT_CONTRACT;
  }));
check("hiring a candidate twice is rejected", !!C.craftHire(hired.sound.id, "sound").err);

/* ── insufficient cash: assign ────────────────────────────────── */
const soundHead = S().craft.heads.sound;
const assignFee = Math.round(soundHead.retainer * 2 * 10) / 10;
S().studio.cash = 0.05;
const poorAssign = C.craftAssign("p9001", "sound");
check("insufficient-cash assign rejected (needs " + C.fm(assignFee) + "), no assignment",
  !!poorAssign.err && !S().craft.assign.p9001 && S().studio.cash === 0.05, poorAssign.err || "");
check("unknown project id rejected on assign", !!C.craftAssign("p-nope", "sound").err);
check("unknown department rejected on assign", !!C.craftAssign("p9001", "stunts").err);
S().studio.cash = 400;

/* ── assign each head to a real project ──────────────────────── */
const targets = { cinematography: "p9001", design: "p9002", sound: "p9003", previz: "p9004" };
const projOf = { p9001: p1, p9002: p2, p9003: p3, p9004: p4 };
let assignOk = true;
for (const d of C.CRAFT_DEPTS) {
  assignOk = assignOk && C.craftAction("craft-assign", elx(targets[d.id], d.id)) === true &&
    S().craft.assign[targets[d.id]] === d.id;
}
check("every head assigned to a real project through craftAction", assignOk,
  C.CRAFT_DEPTS.map((d) => d.id + "→" + targets[d.id]).join(" · "));
check("assignments banked (assigns === 4)", S().craft.assigns === 4);
check("freshness starts at 100%", C.CRAFT_DEPTS.every((d) => S().craft.fresh[targets[d.id]] === 100));

/* ── scoping: mods apply to the assigned project ONLY ────────── */
const mods1 = C.craftDeptMods(p1);
check("assigned project (cinematography) gets a nonzero craft lift", mods1.craft > 0,
  "craft +" + mods1.craft + " · aud +" + mods1.aud + " · legs +" + mods1.legs);
check("unassigned project gets zeros", (() => {
  fakeProject("p9099", "Unassigned", "drama", "pre");
  const z = C.craftDeptMods(C.findProject("p9099"));
  return z.craft === 0 && z.aud === 0 && z.legs === 0;
})());
check("a project cannot take two departments", !!C.craftAssign("p9001", "design").err);
check("a head cannot work two films at once", !!C.craftAssign("p9002", "cinematography").err);
check("each assigned project reports its own department's lift",
  C.CRAFT_DEPTS.every((d) => C.craftDeptMods(projOf[targets[d.id]]).craft > 0),
  C.CRAFT_DEPTS.map((d) => d.id + " +" + C.craftDeptMods(projOf[targets[d.id]]).craft).join(" · "));
/* the engine hook is live in this tree: the craft add must reach computeQuality */
check("computeQuality picks up the department lift through the live engine hook", (() => {
  const realGauss = C.gauss;
  C.gauss = () => 0;
  C.computeQuality(p1);
  const withDept = p1.quality;
  const savedAssign = S().craft.assign.p9001;
  delete S().craft.assign.p9001;
  C.computeQuality(p1);
  const without = p1.quality;
  S().craft.assign.p9001 = savedAssign;
  C.computeQuality(p1);
  C.gauss = realGauss;
  return withDept - without === mods1.craft;
})(), "quality +" + mods1.craft);

check("craftCriticAdj: sound mix lifts critics on its own project",
  C.craftCriticAdj(p3) > 0, "+" + C.craftCriticAdj(p3));
check("craftCriticAdj: 0 on a project with only production design",
  C.craftCriticAdj(p2) === 0, String(C.craftCriticAdj(p2)));
check("craftCriticAdj never exceeds the department's tier value",
  (() => {
    for (const d of C.CRAFT_DEPTS) {
      const t = targets[d.id], head = S().craft.heads[d.id];
      if (!head) continue;
      const cap = C.CRAFT_EFF[d.id].critic[head.tier - 1];
      if (C.craftCriticAdj(projOf[t]) > cap) return false;
    }
    return true;
  })());

/* ── the retainer really hits the ledger every week ──────────── */
let payrollSum = 0;
for (const d of C.CRAFT_DEPTS) payrollSum += S().craft.heads[d.id].retainer;
payrollSum = Math.round(payrollSum * 10) / 10;
const retainersBefore = S().craft.retainersPaid;
const cashBefore = S().studio.cash;
advance(1);
const retRows = ledRows("Craft retainer · ");
check("weekly tick pays one retainer row per seated head",
  retRows.length === 4, retRows.length + " rows");
check("retainer rows sum to the department payroll",
  nearly(retRows.reduce((a, r) => a + r.v, 0), -payrollSum, 0.05), C.fm(payrollSum) + "/wk");
check("retainersPaid grew by exactly one week's payroll",
  nearly(S().craft.retainersPaid - retainersBefore, payrollSum, 0.05),
  C.fm(S().craft.retainersPaid));
check("weekly cash delta reconciles with the ledger rows (payroll included)",
  (() => {
    const rows = S().weekTx && S().weekTx.rows ? S().weekTx.rows : [];
    let sum = 0;
    for (const r of rows) sum += r.v;
    return isFinite(cashBefore) && nearly(S().studio.cash - cashBefore, sum, 0.05);
  })(), "delta " + (S().studio.cash - cashBefore).toFixed(1) + "M");
check("retainers reached the weekly tx history",
  S().txHistory.some((w) => w.rows.some((r) => r.k.indexOf("Craft retainer · ") === 0)));

/* ── freshness decays 5%/wk toward the 55 floor ──────────────── */
const freshTick = S().craft.fresh.p9001;
check("freshness decayed one step (5%/wk) on the first ticked week", freshTick === 95, freshTick + "%");
advance(4);
const freshAfter = S().craft.fresh.p9001;
check("freshness decayed 5% for each of the 5 weeks since assignment", freshAfter === 75,
  freshAfter + "%");
const modsDecayed = C.craftDeptMods(p1);
check("decayed freshness still yields a positive craft lift", modsDecayed.craft > 0,
  "craft +" + modsDecayed.craft);
check("freshness floors at 55% and stops there",
  (() => { advance(20); return S().craft.fresh.p9001 === 55; })(),
  "fresh " + S().craft.fresh.p9001 + "%");
check("a tier-3 department still adds craft at the freshness floor", (() => {
  const h = S().craft.heads.cinematography;
  if (!h || h.tier < 3) return true;
  return C.craftDeptMods(p1).craft >= 1;
})());

/* ── replacing a head clears their assignment ────────────────── */
const oldHead = S().craft.heads.cinematography;
const replacement = S().craft.pool.cinematography[0];
const cashRep = S().studio.cash;
const rep = C.craftHire(replacement.id, "cinematography");
check("replace a department head (signing fee paid, head swapped)",
  rep.ok && S().craft.heads.cinematography.id === replacement.id &&
  nearly(cashRep - S().studio.cash, replacement.sign) &&
  S().craft.heads.cinematography.id !== oldHead.id, "→ " + replacement.n + " T" + replacement.tier);
check("replacement clears the old head's assignment",
  !S().craft.assign.p9001 && !S().craft.fresh.p9001);
check("released department no longer lifts that project", C.craftDeptMods(p1).craft === 0);
check("re-hiring the same head is rejected",
  !!C.craftHire(S().craft.heads.cinematography.id, "cinematography").err);
/* fire that head through the action bridge, then re-seat the department */
const firedRep = C.craftAction("craft-fire", elx("cinematography"));
check("craft-fire through craftAction empties the seat", firedRep === true && !S().craft.heads.cinematography);
check("firing an already-vacant department is rejected", !!C.craftFire("cinematography").err);
/* hire the replacement again and re-assign so the department is staffed for the soak */
const c2 = S().craft.pool.cinematography[0];
S().studio.cash = 400;
C.craftAction("craft-hire", elx(c2.id, "cinematography"));
check("re-assign after the swap works", C.craftAction("craft-assign", elx("p9001", "cinematography")) === true &&
  S().craft.assign.p9001 === "cinematography");

/* ── insufficient cash: fire, then a real severance ──────────── */
const designHead = S().craft.heads.design;
const sev = Math.round(designHead.retainer * 1.5 * 10) / 10;
S().studio.cash = 0.05;
const poorFire = C.craftFire("design");
check("insufficient-cash release rejected (needs " + C.fm(sev) + " severance)",
  !!poorFire.err && !!S().craft.heads.design && S().studio.cash === 0.05, poorFire.err || "");
S().studio.cash = 400;
const payrollPreFire = C.craftPayroll();
const cashFire = S().studio.cash;
check("release pays the severance and empties the seat",
  C.craftFire("design").ok && !S().craft.heads.design &&
  nearly(cashFire - S().studio.cash, sev), C.fm(sev));
check("the released head's assignment is gone (project keeps working)",
  !S().craft.assign.p9002 && !!C.findProject("p9002"));
check("department with no head reports zeros", C.craftDeptMods(p2).craft === 0);
check("craftPayroll dropped by exactly the released retainer",
  nearly(C.craftPayroll(), Math.round((payrollPreFire - designHead.retainer) * 10) / 10),
  C.fm(payrollPreFire) + " → " + C.fm(C.craftPayroll()) + "/wk");
/* re-seat production design so the "full house" achievement is reachable */
const d2 = S().craft.pool.design[0];
C.craftAction("craft-hire", elx(d2.id, "design"));
C.craftAction("craft-assign", elx("p9002", "design"));
/* one more swap so the eight-hire career milestone is genuinely earned */
const swapSound = S().craft.pool.sound[0];
check("eighth hire: sound mix head replaced again",
  C.craftAction("craft-hire", elx(swapSound.id, "sound")) === true && S().craft.hires >= 8,
  S().craft.hires + " hires");
C.craftAction("craft-assign", elx("p9003", "sound"));

/* ── a department leaves when its film wraps post ─────────────── */
fakeProject("p9005", "Craft Wrap", "drama", "post", { post: 2 });
const p5 = C.findProject("p9005");
const wrapDept = "previz";
const wrapHead = S().craft.heads[wrapDept];
/* the previz head is busy on p9004 — clear it, then lend it to the wrapping film */
C.craftAssign("p9004", "none");
check("previz head lent to the project that is about to wrap",
  C.craftAssign("p9005", wrapDept).ok && S().craft.assign.p9005 === wrapDept);
const wrapsBefore = isFinite(wrapHead.releases) ? wrapHead.releases : 0;
advance(4);
check("assignment is dropped once the film leaves pre/shoot/post",
  !S().craft.assign.p9005, "project phase " + p5.phase);
check("the wrap is counted on the head (house-style achievement can fire)",
  S().craft.heads[wrapDept] && S().craft.heads[wrapDept].releases === wrapsBefore + 1,
  "releases " + (S().craft.heads[wrapDept] ? S().craft.heads[wrapDept].releases : "head gone"));
check("no craft lift is left on the wrapped project", C.craftDeptMods(p5).craft === 0);
check("assignment can be cleared explicitly while the film is still shooting",
  (() => {
    C.craftAssign("p9004", "none");
    return !S().craft.assign.p9004;
  })());
C.craftAssign("p9004", "previz");

/* ── action delegation contract ───────────────────────────────── */
const stub = { getAttribute: () => null };
check("craftAction returns false for foreign actions",
  C.craftAction("gl-open", stub) === false && C.craftAction("crew-hire", stub) === false);
check("craftAction handles an unknown craft-* verb by returning false",
  C.craftAction("craft-nonsense", stub) === false);
check("craftAction clears an assignment via data-key=none",
  C.craftAction("craft-assign", elx("p9004", "none")) === true && !S().craft.assign.p9004);
check("clearing an unassigned project is rejected", !!C.craftAssign("p9004", "none").err);
C.craftAction("craft-assign", elx("p9004", "previz"));

/* ── achievements are defensive and actually evaluate ─────────── */
let achOk = true, achDetail = "";
for (const a of C.CRAFT_ACHIEVEMENTS) {
  let r1, r2, r3;
  try {
    r1 = a.test(S());
    r2 = a.test({});
    r3 = a.test(null);
  } catch (e) { achOk = false; achDetail = a.id + " threw"; break; }
  if (typeof r1 !== "boolean" || r2 !== false || r3 !== false) {
    achOk = false; achDetail = a.id + " returned " + [r1, r2, r3].join("/");
  }
}
check("every CRAFT_ACHIEVEMENTS test runs without throwing on live/empty/null state",
  achOk, achDetail);
function ach(id) {
  const a = C.CRAFT_ACHIEVEMENTS.filter((x) => x.id === id)[0];
  return a ? a : null;
}
check("achievement craft-first-head fires on the live save", (() => {
  const a = ach("craft-first-head"); return !!a && a.test(S()) === true;
})());
check("achievement craft-full-house fires (all four departments seated)", (() => {
  const a = ach("craft-full-house");
  return !!a && C.CRAFT_DEPTS.every((d) => !!S().craft.heads[d.id]) && a.test(S()) === true;
})(), C.CRAFT_DEPTS.map((d) => (S().craft.heads[d.id] ? "seated" : "vacant")).join("/"));
check("achievement craft-first-assignment fires", (() => {
  const a = ach("craft-first-assignment"); return !!a && a.test(S()) === true;
})());
check("desk renders clean (staffed, mid-production)", (() => {
  desksRenderClean("");
  return true;
})());
check("craft-depts desk shows hire/replace buttons",
  C.CRAFT_DESKS[0].render().indexOf('data-action="craft-hire"') >= 0);
check("craft-assign desk shows assign buttons and the clear control",
  C.CRAFT_DESKS[1].render().indexOf('data-action="craft-assign"') >= 0 &&
  C.CRAFT_DESKS[1].render().indexOf('data-key="none"') >= 0);

/* ── 80+ week soak: invariants, ledger, cash ─────────────────── */
const target = 84;
while (weeksDriven < target && !threw) advance(1);
check("80+ advanceWeek cycles driven", weeksDriven >= 80, String(weeksDriven));
check("no throw across the whole drive", threw === null, threw || ("week " + S().studio.week));
check("cash stayed finite every week (min tracked)", isFinite(minCash), "min " + Math.round(minCash) + "M");
check("ledger balanced every week (cash delta = sum of week rows)", ledgerBreaks === 0,
  ledgerBreaks + " breaks · " + topups + " top-ups");
check("at least one spend row and one earn row recorded in the ledger",
  spendRows.length >= 1 && earnRows.length >= 1,
  spendRows.length + " spend kinds · " + earnRows.length + " earn kinds");
check("the craft retainer cost is visible as a distinct spend line",
  spendRows.some((k) => k.indexOf("Craft retainer · ") === 0),
  spendRows.filter((k) => k.indexOf("Craft ") === 0).join(" / "));
check("craft retainer is a recurring ledger line (not a one-off)",
  S().txHistory.some((w) => w.rows.some((r) => r.k.indexOf("Craft retainer · ") === 0)));
check("S.craft still exists at the end with every numeric field finite",
  !!S().craft && isFinite(S().craft.lastTick) && isFinite(S().craft.retainersPaid) &&
  isFinite(S().craft.hires) && isFinite(S().craft.assigns) &&
  isFinite(S().craft.renewals) && isFinite(S().craft.poolWk) &&
  C.CRAFT_DEPTS.every((d) => isFinite(S().craft.morale[d.id])) &&
  C.CRAFT_DEPTS.every((d) => (S().craft.pool[d.id] || []).every((c) =>
    isFinite(c.tier) && isFinite(c.retainer) && isFinite(c.sign) && isFinite(c.wk))));
check("every seated head has finite tier/retainer/until and a positive tier",
  (() => {
    for (const d of C.CRAFT_DEPTS) {
      const h = S().craft.heads[d.id];
      if (!h) continue;
      if (!isFinite(h.tier) || h.tier < 1 || h.tier > 3) return false;
      if (!isFinite(h.retainer) || h.retainer <= 0) return false;
      if (!isFinite(h.until) || h.until <= S().studio.week) return false;
    }
    return true;
  })(),
  C.CRAFT_DEPTS.map((d) => (S().craft.heads[d.id] ? S().craft.heads[d.id].n : "vacant")).join(" · "));
check("retainers actually accumulated over 80 weeks (> $40M paid)",
  S().craft.retainersPaid > 40, C.fm(S().craft.retainersPaid));
check("achievement craft-retainers-40 fires after the soak",
  ach("craft-retainers-40").test(S()) === true, C.fm(S().craft.retainersPaid));
check("achievement craft-hires-8 fires after repeated hiring",
  ach("craft-hires-8").test(S()) === true, S().craft.hires + " hires");
check("contracts renewed at least once across 80 weeks", S().craft.renewals >= 1,
  S().craft.renewals + " renewals");
check("assignments survived the soak (still scoped, still positive)",
  C.CRAFT_DEPTS.every((d) => {
    const t = targets[d.id];
    if (!S().craft.assign[t]) return true; /* cleared is legal, must not be negative */
    return C.craftDeptMods(projOf[t]).craft > 0;
  }));
check("no orphaned assignments (every key is a live project with a seated head)",
  (() => {
    for (const pid in S().craft.assign) {
      if (!C.findProject(pid)) return false;
      const h = S().craft.heads[S().craft.assign[pid]];
      if (!h) return false;
    }
    return true;
  })());
check("every week in the soak ticked the module exactly once (lastTick tracks studio.week)",
  S().craft.lastTick === S().studio.week, "lastTick " + S().craft.lastTick + " · week " + S().studio.week);
check("retainer spend is a large, steady share of the ledger (a real recurring cost, not a one-off)",
  S().craft.retainersPaid > 80 && S().craft.retainersPaid < 1000,
  C.fm(S().craft.retainersPaid) + " over " + weeksDriven + " weeks");
desksRenderClean("(end, week " + S().studio.week + ", year " + S().studio.year + ")");

/* ── idempotency after the engine has already ticked ─────────── */
const cashIdem = S().studio.cash;
const paidIdem = S().craft.retainersPaid;
C.tickCraft();
check("double-tick guard holds at the end of the soak (no duplicate payroll)",
  S().studio.cash === cashIdem && S().craft.retainersPaid === paidIdem,
  "cash " + C.fm(cashIdem));

console.log("\n" + (failures ? "FAILED " + failures + "/" + checks : "ALL " + checks + " CHECKS PASSED") +
  " · " + weeksDriven + " weeks · min cash " + Math.round(minCash) + "M · retainers " +
  S().craft.retainersPaid + "M");
process.exit(failures || threw ? 1 : 0);
