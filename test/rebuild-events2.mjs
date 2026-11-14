/* Rebuild events2-module harness (pattern from test/rebuild-meta.mjs): runs game/data.js +
   game/engine.js + game/events2.js in a VM sandbox with a stubbed localStorage. ui.js needs a
   DOM, so the ui helpers the module touches (tag, statrow, pushToast, closeSheet, render,
   refreshDeskSheet, drainFlash) are stubbed. Drives 60 advanceWeek() calls, calling
   tickEvents2() after each (the integrator's weekly wiring), then exercises every system
   through the module's real functions: premiere plan seg via events2Action + premiereApply
   (standard/grand lifts, cash spend, idempotency, insufficient-cash cancellation), award
   night via awardNightBegin + events2Action "pending-opt" (all three options incl. both bold-
   speech branches via a stubbed Math.random, winner effects, engine yearAwards() integration,
   busy-pending auto path), crisis years via a forced crisisYearRoll() (austerity savings row,
   fight-back buzz, borrow loan, deferred choice, next-year clear, lastTick guard), rival
   subscription wars (forced roll, all three resolutions, busy-pending skip), desk renders,
   and action fall-through for foreign pendings. Prints one line per check; exits non-zero. */
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

const toasts = [];
let sheetCloses = 0, renders = 0;
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
  /* ui.js helpers (ui.js can't load without a DOM); same behavior as ui.js */
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>",
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  pushToast: (txt, kind) => { toasts.push({ txt, kind }); },
  closeSheet: () => { sheetCloses++; },
  render: () => { renders++; },
  refreshDeskSheet: () => {},
  drainFlash: () => {}
});
for (const f of ["data.js", "engine.js", "events2.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const el = (attrs) => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null) });
function withRandom(v, fn) {
  const real = C.Math.random;
  C.Math.random = () => v;
  try { fn(); } finally { C.Math.random = real; }
}
function freshTx() { S().weekTx = { w: S().studio.week, in: 0, out: 0, rows: [] }; }
function repAfter(before, delta) { return Math.max(0, Math.min(100, before + delta)); }
function tickOnce() { S().ev2.lastTick = 0; C.tickEvents2(); }
function txRow(label) { return (S().weekTx.rows || []).find((r) => r.k === label); }

/* ── static contract checks ───────────────────────────────────── */
const src = readFileSync(path.join(gameDir, "events2.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports premiereApply/awardNightBegin/crisisYearRoll/tickEvents2/events2Action",
  ["premiereApply", "awardNightBegin", "crisisYearRoll", "tickEvents2", "events2Action"]
    .every((n) => typeof C[n] === "function"));
check("EVENTS2_DESKS: 2 desks, group Events, ids ev2-premiere + ev2-log, icons 🎬📜",
  Array.isArray(C.EVENTS2_DESKS) && C.EVENTS2_DESKS.length === 2 &&
  JSON.stringify(C.EVENTS2_DESKS.map((d) => d.id)) === JSON.stringify(["ev2-premiere", "ev2-log"]) &&
  C.EVENTS2_DESKS.every((d) => d.group === "Events" && typeof d.render === "function") &&
  C.EVENTS2_DESKS.map((d) => d.icon).join("") === "🎬📜");

/* ── drive 60 weeks (integrator wiring: advanceWeek + tickEvents2) ── */
C.newGame("Events Test", "veteran");
let threw = null, minCash = Infinity;
for (let w = 0; w < 60 && !threw; w++) {
  try {
    C.advanceWeek();
    C.tickEvents2();
    const c = S().studio.cash;
    if (!isFinite(c)) { threw = "week " + S().studio.week + ": cash not finite (" + c + ")"; break; }
    if (c < minCash) minCash = c;
  } catch (e) { threw = "week " + S().studio.week + ": " + (e.stack || e); }
}
check("60 advanceWeek+tickEvents2 runs with no throw", !threw, threw || "60 weeks");
check("cash stayed finite every week, min " + minCash.toFixed(1) + "M", minCash > -Infinity && isFinite(minCash));
check("S.ev2 lazy-ensured with plan/applied/history/lastTick",
  !!S().ev2 && ["none", "standard", "grand"].includes(S().ev2.plan) &&
  !!S().ev2.applied && Array.isArray(S().ev2.history) && typeof S().ev2.lastTick === "number");
check("lastTick guard holds (tickEvents2 twice = one processed week)", S().ev2.lastTick === S().studio.week);

/* ── (1) premiere night ───────────────────────────────────────── */
S().pending = null; S().crisis = null;
const cashNone = S().studio.cash;
check("plan seg defaults to none; none plan spends nothing",
  S().ev2.plan === "none" &&
  (C.premiereApply(null, { id: "fN", title: "Quiet One", opening: 20 }), true) &&
  S().ev2.applied.fN === undefined && Math.abs(S().studio.cash - cashNone) < 1e-9);

const cash0 = S().studio.cash, rep0 = S().studio.rep;
check("ev2-plan action switches to standard (returns true, persists)",
  C.events2Action("ev2-plan", el({ "data-key": "standard" })) === true && S().ev2.plan === "standard");
check("ev2-plan rejects unknown keys", C.events2Action("ev2-plan", el({ "data-key": "bogus" })) === true && S().ev2.plan === "standard");
const fS = { id: "fS", title: "Open Effort", opening: 20 };
C.premiereApply(null, fS);
check("standard premiere: $2M spent, opening ×1.04, rep +1, applied, news + toast",
  Math.abs(S().studio.cash - (cash0 - 2)) < 1e-9 &&
  fS.opening === Math.round(20 * 1.04 * 10) / 10 && fS.buzzNote === "Standard premiere" &&
  S().studio.rep === repAfter(rep0, 1) && S().ev2.applied.fS === true &&
  S().news[0].txt.includes("Premiere night") && S().flash.some((t) => t.txt.includes("Premiere lift")));
const cashAfterS = S().studio.cash, repAfterS = S().studio.rep;
C.premiereApply(null, fS);
check("premiereApply is idempotent per film (no double spend)",
  Math.abs(S().studio.cash - cashAfterS) < 1e-9 && S().studio.rep === repAfterS);

check("ev2-plan switches to grand", C.events2Action("ev2-plan", el({ "data-key": "grand" })) === true && S().ev2.plan === "grand");
const fG = { id: "fG", title: "Grand Effort", opening: 10 };
C.premiereApply(null, fG);
check("grand gala: $6M spent, opening ×1.08, rep +2, fans flavor in news",
  Math.abs(S().studio.cash - (cashAfterS - 6)) < 1e-9 &&
  fG.opening === Math.round(10 * 1.08 * 10) / 10 && fG.buzzNote === "Grand gala" &&
  S().studio.rep === repAfter(repAfterS, 2) &&
  S().news[0].txt.includes("Premiere night") && S().news[0].txt.includes("fans"));
const savedCash = S().studio.cash, savedRep = S().studio.rep;
S().studio.cash = 1;
const fB = { id: "fB", title: "Broke Effort", opening: 8 };
C.premiereApply(null, fB);
check("insufficient cash: premiere cancelled — no spend, applied marked, bad news",
  Math.abs(S().studio.cash - 1) < 1e-9 && S().ev2.applied.fB === true &&
  S().news[0].txt.includes("cancelled") && S().news[0].kind === "bad");
S().studio.cash = savedCash; S().studio.rep = savedRep;

/* ── (2) award night ──────────────────────────────────────────── */
S().pending = null;
const cat0 = S().studio.catalog, repA0 = S().studio.rep;
const noms = [{ id: "f1", title: "Nom A", quality: 82 }, { id: "f2", title: "Nom B", quality: 77 }];
const best = noms[0];
C.awardNightBegin(noms, best);
check("awardNightBegin creates a generic awards pending (3 options, exact text)",
  !!S().pending && S().pending.type === "awards" && S().pending.title === "🏆 Award night" &&
  S().pending.text === "Your films earned 2 nomination(s)." &&
  S().pending.options.length === 3 &&
  S().pending.options.map((o) => o.label).join("|") === "Attend humbly|Bold speech|Skip the show" &&
  S().pending.best === best && S().pending.nominees === noms);
const pdA = S().pending;
C.events2Action("pending-opt", el({ "data-idx": 0 }));
check("pending-opt idx0 (attend humbly): rep +2, winner effects rep +8 catalog +25, pending cleared",
  S().pending === null && sheetCloses > 0 && renders > 0 &&
  S().studio.rep === repAfter(repA0, 10) && S().studio.catalog === cat0 + 25 &&
  Array.isArray(S().yearOfFilms) && S().yearOfFilms.length === 0 &&
  S().news[0].txt.includes("takes Best Picture"));

const repB0 = S().studio.rep;
C.awardNightBegin(noms, best);
withRandom(0.01, () => C.events2Action("pending-opt", el({ "data-idx": 1 })));
const repBoldWin = S().studio.rep;
check("bold speech win branch (random<0.5): rep +5 + winner +8",
  repBoldWin === repAfter(repB0, 13) && S().pending === null);
C.awardNightBegin(noms, best);
withRandom(0.99, () => C.events2Action("pending-opt", el({ "data-idx": 1 })));
check("bold speech lose branch (random>0.5): rep -2 + winner +8",
  S().studio.rep === repAfter(repBoldWin, 6) && S().pending === null);
const repK0 = S().studio.rep;
C.awardNightBegin(noms, best);
C.events2Action("pending-opt", el({ "data-idx": 2 }));
check("skip the show: no option rep change, winner effects still land",
  S().pending === null && S().studio.rep === repAfter(repK0, 8) && S().studio.catalog >= cat0 + 75);

check("no-best award night: no winner effects, no-trophy news",
  (C.awardNightBegin(noms, null), C.events2Action("pending-opt", el({ "data-idx": 2 })), true) &&
  S().pending === null && S().news[0].txt.includes("without a trophy"));

/* engine integration: yearAwards() routes into awardNightBegin when noms exist */
const catE0 = S().studio.catalog, repE0 = S().studio.rep;
S().films.unshift({ id: "fE1", title: "Engine Epic", quality: 83 });
S().yearOfFilms = ["fE1"];
C.yearAwards();
check("engine yearAwards() hits awardNightBegin: pending created, yearOfFilms cleared by engine",
  !!S().pending && S().pending.type === "awards" && S().pending.text.includes("1 nomination") &&
  S().yearOfFilms.length === 0);
C.events2Action("pending-opt", el({ "data-idx": 0 }));
check("engine award night resolved: winner effects applied",
  S().pending === null && S().studio.catalog === catE0 + 25 && S().studio.rep === repAfter(repE0, 10));

/* busy-pending auto path: winner effects apply immediately, slot untouched */
const repZ0 = S().studio.rep;
S().pending = { type: "subwar", title: "fake", options: [] };
C.awardNightBegin(noms, best);
check("awardNightBegin with busy pending slot: auto winner effects, slot preserved",
  S().pending && S().pending.type === "subwar" && S().studio.rep === repAfter(repZ0, 8));

/* ── (3) crisis years ─────────────────────────────────────────── */
S().pending = null; S().crisis = null;
withRandom(0.01, () => C.crisisYearRoll());
check("forced crisisYearRoll (8%): S.crisis {year, mult 0.85} set + crisis pending with 3 options",
  !!S().crisis && S().crisis.year === S().studio.year && S().crisis.mult === 0.85 &&
  !!S().pending && S().pending.type === "crisis" && S().pending.title === "📉 Crisis year" &&
  S().pending.text === "The market will run soft all year." &&
  S().pending.options.length === 3 &&
  S().pending.options.map((o) => o.label).join("|") === "Austerity|Fight back|Borrow through it" &&
  S().news[0].txt.includes("crisis year begins"));
check("crisisYearRoll is a no-op while a crisis runs",
  (withRandom(0.01, () => C.crisisYearRoll()), true) && S().pending.type === "crisis");
const cashC0 = S().studio.cash;
C.events2Action("pending-opt", el({ "data-idx": 0 }));
check("crisis idx0 austerity: flag set, no spend, pending cleared",
  S().pending === null && S().crisis.austerity === true && Math.abs(S().studio.cash - cashC0) < 1e-9);
freshTx();
tickOnce();
const austRows = S().weekTx.rows.filter((r) => r.k === "Austerity savings");
check("austerity earn visible weekly: exactly one +0.5 'Austerity savings' row",
  austRows.length === 1 && austRows[0].v === 0.5);
C.tickEvents2(); /* no lastTick reset: the module's own guard must no-op this */
check("lastTick guard: bare second tickEvents2 same week does not double the savings",
  S().weekTx.rows.filter((r) => r.k === "Austerity savings").length === 1);

/* fight back */
S().pending = null; S().crisis = null;
withRandom(0.01, () => C.crisisYearRoll());
const cashF0 = S().studio.cash;
S().projects.push({ id: "pT", title: "Crisis Pic", phase: "shoot", buzz: 0 });
C.events2Action("pending-opt", el({ "data-idx": 1 }));
check("crisis idx1 fight back: $3M spent, flag set, pending cleared",
  S().pending === null && S().crisis.fight === true && Math.abs(S().studio.cash - (cashF0 - 3)) < 1e-9);
freshTx();
tickOnce();
check("fight back: announced slate +2 buzz per week",
  S().projects[S().projects.length - 1].buzz === 2);
/* borrow */
S().pending = null; S().crisis = null;
withRandom(0.01, () => C.crisisYearRoll());
const loans0 = S().loans.length, cashL0 = S().studio.cash;
C.events2Action("pending-opt", el({ "data-idx": 2 }));
check("crisis idx2 borrow: +$40M earned, loan {amt 40, rate 0.008} pushed",
  S().pending === null && S().loans.length === loans0 + 1 &&
  S().loans[S().loans.length - 1].amt === 40 && S().loans[S().loans.length - 1].rate === 0.008 &&
  Math.abs(S().studio.cash - (cashL0 + 40)) < 1e-9);
S().projects.pop();

/* deferred choice when the pending slot is busy */
S().pending = null; S().crisis = null;
S().pending = { type: "incident", kind: "cyber" };
withRandom(0.01, () => C.crisisYearRoll());
check("crisis with busy slot: crisis set, choice deferred via choicePending",
  !!S().crisis && S().crisis.choicePending === true && S().pending.type === "incident");
S().pending = null;
tickOnce();
check("deferred crisis choice shows once the slot frees",
  !!S().pending && S().pending.type === "crisis" && S().crisis.choicePending === false);

/* crisis clears the next year */
S().pending = null;
S().crisis.year = S().studio.year - 1;
tickOnce();
check("crisis clears when the studio enters the year after it",
  S().crisis === null && S().news[0].txt.includes("crisis year ends"));

/* ── (4) rival subscription attacks ───────────────────────────── */
S().pending = null; S().crisis = null;
S().tv = { streamer: { name: "Test TV", subs: 1.0 } };
withRandom(0.01, () => tickOnce());
check("subwar roll (6% while a streamer runs): generic pending with 3 options",
  !!S().pending && S().pending.type === "subwar" && S().pending.title === "⚔️ Subscription war" &&
  S().pending.options.length === 3 &&
  S().pending.options.map((o) => o.label).join("|") === "Match their discount|Exclusives blitz|Ignore" &&
  S().pending.options[2].cost === undefined);
const cashW0 = S().studio.cash;
C.events2Action("pending-opt", el({ "data-idx": 1 }));
check("subwar idx1 exclusives blitz: $4M spent, subs +0.5",
  S().pending === null && Math.abs(S().studio.cash - (cashW0 - 4)) < 1e-9 &&
  Math.abs(S().tv.streamer.subs - 1.5) < 1e-9);
withRandom(0.01, () => tickOnce());
const cashW1 = S().studio.cash;
C.events2Action("pending-opt", el({ "data-idx": 0 }));
check("subwar idx0 match discount: $10M spent, subs kept",
  S().pending === null && Math.abs(S().studio.cash - (cashW1 - 10)) < 1e-9 &&
  Math.abs(S().tv.streamer.subs - 1.5) < 1e-9);
withRandom(0.01, () => tickOnce());
C.events2Action("pending-opt", el({ "data-idx": 2 }));
check("subwar idx2 ignore: subs ×0.92",
  S().pending === null && Math.abs(S().tv.streamer.subs - 1.5 * 0.92) < 1e-6);
/* cheap rejection: unaffordable war options fall through to the loss branch */
withRandom(0.01, () => tickOnce());
const cashW2 = S().studio.cash, subsW2 = S().tv.streamer.subs;
S().studio.cash = 1;
C.events2Action("pending-opt", el({ "data-idx": 1 }));
check("subwar unaffordable blitz: no spend, loss branch applies",
  Math.abs(S().studio.cash - 1) < 1e-9 && Math.abs(S().tv.streamer.subs - subsW2 * 0.92) < 1e-6);
S().studio.cash = cashW2;
/* busy slot: no subwar roll */
S().pending = { type: "incident", kind: "cyber" };
withRandom(0.01, () => tickOnce());
check("subwar skipped while a pending occupies the slot",
  S().pending.type === "incident");

/* ── desks + action fall-through ──────────────────────────────── */
S().pending = null;
const premDesk = C.EVENTS2_DESKS.find((d) => d.id === "ev2-premiere").render();
check("premiere desk renders seg + plan buttons + cash, no undefined/NaN",
  premDesk.includes('data-action="ev2-plan"') && premDesk.includes('data-key="grand"') &&
  premDesk.includes("class=\"on\"") && premDesk.includes(C.fm(S().studio.cash)) &&
  !premDesk.includes("undefined") && !premDesk.includes("NaN"));
C.events2Action("ev2-plan", el({ "data-key": "none" }));
const logDesk = C.EVENTS2_DESKS.find((d) => d.id === "ev2-log").render();
check("event log desk lists history entries with weeks, no undefined/NaN",
  logDesk.includes("W") && logDesk.includes("Premiere") &&
  !logDesk.includes("undefined") && !logDesk.includes("NaN"));
check("events2Action returns false for foreign actions and foreign pendings",
  C.events2Action("tv-launch-streamer", el({})) === false &&
  (S().pending = { type: "incident", kind: "cyber" }, C.events2Action("pending-opt", el({ "data-idx": 0 })) === false) &&
  S().pending && S().pending.type === "incident");
S().pending = null;

/* one final real week after all the surgery */
let finalOk = true;
try { C.advanceWeek(); C.tickEvents2(); finalOk = isFinite(S().studio.cash); } catch (e) { finalOk = false; }
check("final advanceWeek+tickEvents2 after surgery: no throw, cash finite", finalOk);

console.log(failures ? "\n" + failures + "/" + checks + " checks FAILED" : "\nall " + checks + " checks passed");
process.exit(failures ? 1 : 0);
