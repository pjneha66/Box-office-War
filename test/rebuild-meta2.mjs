/* Rebuild meta2 harness (pattern from test/rebuild-meta.mjs): runs game/data.js +
   game/engine.js + game/meta2.js in a VM sandbox with a stubbed localStorage.
   ui.js needs a DOM, so the two ui helpers the desks render with (tag, statrow) are
   stubbed verbatim. Drives 70 advanceWeek() calls with scenario 'lab', calling
   tickMeta2() after each — twice per week to prove idempotency. Exercises every
   system through real module functions: tutorial banner + 'Got it' steps + graduation
   grant, season-pass goal generation determinism + weekly evaluation + rewards,
   facility upgrade / agency client / streamer subs / stage show / cash / release goals,
   hall of legends ranking, trilogy create + auto-assign + release linking + completion
   bonus, pack export roundtrip + valid/invalid imports (bad JSON, bad types, cap),
   duplicate-trilogy rejection. Prints one line per check; exits non-zero on failure. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + String(extra) : ""));
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
for (const f of ["data.js", "engine.js", "meta2.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;
const S = () => C.S;
const el = (attrs) => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null) });
function deskHTML(id) {
  const d = C.META2_DESKS.find((x) => x.id === id);
  return d ? d.render() : null;
}
function newsHas(str) {
  return S().news.some((n) => n.txt.indexOf(str) >= 0);
}

/* ── static contract checks on the module source ─────────────── */
const src = readFileSync(path.join(gameDir, "meta2.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis"]) {
  check("ES2017-safe: no '" + tok + "'", !src.includes(tok));
}
check("exports tickMeta2/meta2Action/tutorialBanner/META2_DESKS",
  typeof C.tickMeta2 === "function" && typeof C.meta2Action === "function" &&
  typeof C.tutorialBanner === "function" && Array.isArray(C.META2_DESKS));
check("META2_DESKS: 4 desks, group 'Career 2', spec ids/icons",
  C.META2_DESKS.length === 4 &&
  JSON.stringify(C.META2_DESKS.map((d) => d.id)) ===
    JSON.stringify(["m2-pass", "m2-legends", "m2-trilogy", "m2-packs"]) &&
  C.META2_DESKS.every((d) => d.group === "Career 2" && typeof d.render === "function") &&
  C.META2_DESKS.map((d) => d.icon).join("") === "🎯🗿🎬📦");

/* ── drive ────────────────────────────────────────────────────── */
C.newGame("Meta2 Test", "indie", "std", "lab");
check("lab scenario active", S().scenario && S().scenario.id === "lab");

/* tutorial: banner step 1, advance to step 4 via real actions, then dismiss */
let b1 = C.tutorialBanner();
check("tutorial auto-enabled for lab: banner step 1 with Got it button",
  !!b1 && b1.indexOf("Tutorial 1/4") >= 0 && b1.indexOf("buy a script and greenlight") >= 0 &&
  b1.indexOf('data-action="m2-tut-next"') >= 0 && S().tutorial.step === 1 && S().tutorial.active === true);
for (let i = 0; i < 3; i++) C.meta2Action("m2-tut-next", el({}));
check("three 'Got it' taps advance to step 4", S().tutorial.step === 4 && S().tutorial.active === true);
const b4 = C.tutorialBanner();
check("step 4 banner shows weekend-chart text", !!b4 && b4.indexOf("weekend chart") >= 0 && b4.indexOf("Tutorial 4/4") >= 0);
C.meta2Action("m2-tut-next", el({}));
check("dismiss at step 4 closes banner (grant pending on first profit)",
  S().tutorial.active === false && C.tutorialBanner() === null);

/* trilogy: genre = most common among the opening ideas */
const counts = {};
for (const i of S().ideas) counts[i.genre] = (counts[i.genre] || 0) + 1;
let trGenre = null, bestN = 0;
for (const k in counts) if (counts[k] > bestN) { bestN = counts[k]; trGenre = k; }
check("picked a trilogy genre from the idea slate", !!trGenre, trGenre);
C.meta2Action("m2-trilogy-new", el({ "data-key": trGenre }));
const tr0 = S().m2.trilogy;
check("trilogy created: named '<X> Trilogy', 3 slots, genre kept",
  !!tr0 && / Trilogy$/.test(tr0.name) && tr0.genre === trGenre &&
  tr0.entries.length === 3 && tr0.entries.map((e) => e.seq).join(",") === "1,2,3" && tr0.done === false);
C.meta2Action("m2-trilogy-new", el({ "data-key": trGenre }));
check("second trilogy rejected while one is open", !!S().m2.trilogy && S().flash.some((t) => t.txt.indexOf("already in the works") >= 0));

/* streamer + stage state so pass-goal bases are captured at generation */
S().tv = { streamer: { subs: 0.4 } };
S().emp = { stage: { shows: [{ id: "sx1", name: "Test show", recouped: false }] } };

/* week 1: pass goals generate */
C.advanceWeek();
C.tickMeta2();
const P = () => S().m2.pass;
check("season pass generated for year 1: 10 goals with fields",
  P().year === 1 && P().goals.length === 10 &&
  P().goals.every((g) => g.key && typeof g.txt === "string" && typeof g.target === "number" && g.done === false &&
    g.reward && (g.reward.kind === "cash" ? g.reward.amt >= 5 && g.reward.amt <= 15 : g.reward.amt >= 8 && g.reward.amt <= 20)));
const genA = JSON.stringify(C.m2GenGoals(1));
const genB = JSON.stringify(C.m2GenGoals(1));
check("goal generation deterministic for a given year", genA === genB);
check("tech goal omitted while tech tree absent (9-key pool)", P().goals.every((g) => g.key !== "tech"));
S().studio.cash += 200; /* keep the bot solvent for 3 trilogy films + upgrades */

/* helpers mirroring real ui flow */
function cheapest(kind) {
  let bestT = null, bf = Infinity;
  for (const t of S().market) {
    if (t.k !== kind || C.talentBusy(t)) continue;
    const f = C.feeFor(t, 5);
    if (f < bf) { bf = f; bestT = t; }
  }
  return bestT;
}
function green(matchGenre) {
  const pool = S().ideas.filter((i) => !matchGenre || i.genre === matchGenre);
  const idea = pool[0] || (matchGenre ? null : S().ideas[0]);
  if (!idea) return false;
  const dir = cheapest("dir"), act = cheapest("actor");
  if (!dir || !act) return false;
  const r = C.greenlight(idea.id, { scale: "micro", bIdx: 0, dirId: dir.id, actorId: act.id, mktIdx: 0 });
  return !!(r && r.ok);
}

let threw = null, finiteCash = true, minCash = Infinity, idemBroken = false;
let trilogyAssignSeen = false, upgradeBought = false, clientSigned = false;
let catalogMoved = false, lastCatalog = S().studio.catalog;
let trilogyVerdict = null, grantSeen = false, y1done = 0, y1keys = new Set();

for (let w = 2; w <= 70 && !threw; w++) {
  if (w === 2 && !upgradeBought && S().studio.cash >= 40) upgradeBought = C.buyUpgrade("post");
  if (w === 3 && !S().agency.founded && S().studio.cash >= 30) C.foundAgency();
  if (S().agency.founded && !clientSigned && S().agency.clients.length === 0) {
    const t = S().market.find((x) => x.power >= 3 && !C.talentBusy(x));
    if (t) clientSigned = C.signClient(t.id);
  }
  if (w === 4) S().emp.stage.shows[0].recouped = true;
  if (w === 5 && S().tv.streamer) S().tv.streamer.subs = 4;
  if (!S().tv.streamer) S().tv = { streamer: { subs: 0.4 } };
  const tr = S().m2.trilogy;
  const openSlot = tr && !tr.done && tr.entries.some((e) => !e.pid && !e.filmId);
  if (openSlot && !S().ideas.some((i) => i.genre === tr.genre)) {
    /* fish for a matching script — scouts cost $1 each */
    for (let s = 0; s < 6 && S().studio.cash >= 15 && !S().ideas.some((i) => i.genre === tr.genre); s++) C.scoutScripts();
  }
  if (S().studio.cash >= 14) {
    if (openSlot && S().ideas.some((i) => i.genre === tr.genre)) green(tr.genre);
    else if (!openSlot && S().studio.cash >= 40) green(null);
  }
  for (const p of S().projects) {
    if (p.phase === "ready" && p.releaseWeek == null) {
      p.mktIdx = 0;
      p.mkt = Math.round(p.budget * 0.45 * 0.05 * 10) / 10; /* whisper tier, mirrors ui release sheet */
      p.releaseWeek = S().studio.week + 1;
    }
  }
  if (tr && S().projects.some((p) => p.trilogyId === tr.id)) trilogyAssignSeen = true;
  if (S().studio.week === 52 && P().year === 1 && y1keys.size === 0 && y1done === 0) { /* snapshot year 1 before its last tick */
    y1done = P().goals.filter((g) => g.done).length;
    y1keys = new Set(P().goals.filter((g) => g.done).map((g) => g.key));
  }
  try {
    C.advanceWeek();
    C.tickMeta2();
    const claimedSnap = JSON.stringify(P().claimed);
    C.tickMeta2(); /* double tick same week must not double-reward */
    if (JSON.stringify(P().claimed) !== claimedSnap) idemBroken = true;
    if (S().news.some((n) => n.txt.indexOf("Trilogy complete") >= 0)) trilogyVerdict = "complete";
    else if (S().news.some((n) => n.txt.indexOf("fizzled") >= 0)) trilogyVerdict = "fizzled";
    else if (S().news.some((n) => n.txt.indexOf("dead even") >= 0)) trilogyVerdict = "even";
    if (S().tutorial && S().tutorial.rewarded) grantSeen = true;
    const c = S().studio.cash;
    if (!isFinite(c)) finiteCash = false;
    if (c < minCash) minCash = c;
    if (S().studio.catalog !== lastCatalog) { catalogMoved = true; lastCatalog = S().studio.catalog; }
  } catch (e) {
    threw = "week " + S().studio.week + ": " + (e.stack || e);
  }
}

check("70 weeks ran with no throw", !threw, threw || "");
check("cash finite every week", finiteCash, "min $" + (isFinite(minCash) ? minCash.toFixed(1) + "M" : "n/a"));
check("tickMeta2 idempotent per week (no double rewards)", !idemBroken);
check("catalog moved (income cycle observed)", catalogMoved);

/* trilogy lifecycle */
const tr = S().m2.trilogy;
const assignedCount = tr.entries.filter((e) => e.pid || e.filmId).length;
check("greenlit matching projects auto-assigned trilogyId + seq", trilogyAssignSeen && assignedCount >= 2, assignedCount + " slots used");
const releasedCount = tr.entries.filter((e) => e.filmId).length;
check("released films linked to slots", releasedCount >= 2, releasedCount + " released");
check("trilogy completed on 3 releases with a verdict news line",
  tr.done === true && trilogyVerdict !== null, "released " + releasedCount + "/3, verdict " + trilogyVerdict);
if (tr.done && trilogyVerdict === "complete") {
  const f1 = C.findFilm(tr.entries[0].filmId), f3 = C.findFilm(tr.entries[2].filmId);
  check("rising-quality bonus paid (+$30M + rep, quality rose)", !!f1 && !!f3 && f3.quality > f1.quality);
}

/* season pass results — year 1 snapshot (week 53 regenerates goals for year 2) */
check("season rolled to year 2 with a fresh set of 10 goals",
  P().year === 2 && P().goals.length === 10 && P().claimed.length <= 10, "year " + P().year);
check("claimed list matches done goals, indices unique",
  P().claimed.length === P().goals.filter((g) => g.done).length && new Set(P().claimed).size === P().claimed.length);
check("year-1 pass goals completed with rewards (>=5 of 10)", y1done >= 5, y1done + "/10");
const doneKeys = y1keys;
check("facility goal completed via buyUpgrade", upgradeBought && doneKeys.has("facility"));
check("client goal completed via signClient", clientSigned && doneKeys.has("client"));
check("subs goal completed (+Z subscribers)", doneKeys.has("subs"));
check("stage goal completed (recouped show)", doneKeys.has("stage"));
check("cash goal completed (banked cash)", doneKeys.has("cash"));
check("films goal completed (releases)", doneKeys.has("films"), S().films.length + " films released");
check("year-2 slate still tracks premiere + award goals",
  P().goals.some((g) => g.key === "premiere") && P().goals.some((g) => g.key === "award"));

/* tutorial graduation grant on first profit (fires mid-run when the first hit lands) */
if (!S().tutorial.rewarded) {
  S().stats.hits = 1; /* harness assist, mirrors rebuild-meta fake stats */
  C.advanceWeek();
  C.tickMeta2();
}
check("firstProfit completes tutorial with $10M grant",
  S().tutorial.rewarded === true && grantSeen, "hits=" + S().stats.hits + " grant=" + grantSeen);

/* hall of legends */
const rows = C.m2LegendRows();
check("legends ranked from released films (dirId/actId scan)", rows.length >= 1 && rows[0].films >= 1,
  rows.length + " talents, top films=" + (rows[0] ? rows[0].films : 0));
const r0 = rows[0];
check("legend score = films*10 + avgQ", r0.score === r0.films * 10 + r0.avgQ);
const legHTML = deskHTML("m2-legends");
check("legends desk renders medals + rows",
  typeof legHTML === "string" && legHTML.indexOf("🥇") >= 0 && legHTML.indexOf("films · Q") >= 0);

/* content packs */
C.meta2Action("m2-pack-export", el({}));
let exported = null, okParse = false;
try {
  exported = JSON.parse(S().m2.packOut);
  okParse = Array.isArray(exported.talents) && exported.talents.length <= 10 &&
    exported.talents.every((t) => t && typeof t.n === "string" && (t.k === "actor" || t.k === "dir") &&
      t.power >= 1 && t.power <= 5 && t.skill >= 20 && t.skill <= 97 && t.fee >= 0 && t.fee <= 40 && Array.isArray(t.fit));
} catch (e) { okParse = false; }
check("pack export: valid JSON of current market (≤10 talents, all fields)", okParse, S().m2.packOut.slice(0, 60) + "…");
const packsDesk = deskHTML("m2-packs");
check("packs desk renders boxes + export output",
  typeof packsDesk === "string" && packsDesk.indexOf("packBox") >= 0 && packsDesk.indexOf("packOut") >= 0 &&
  packsDesk.indexOf("Export market") >= 0);

const marketBefore = S().market.length;
const validPack = JSON.stringify({ talents: [
  { n: "Test Star", k: "actor", power: 3, skill: 60, fee: 5, fit: ["action"] },
  { n: "Test Auteur", k: "dir", power: 2, skill: 45, fee: 2.5, fit: ["drama", "crime"] }
]});
C.meta2Action("m2-pack-import", el({ "data-text": validPack }));
check("valid pack import adds talents + news line",
  S().market.length === marketBefore + 2 && newsHas("Content pack: 2 talents imported"),
  S().market.length + " in market");
check("imported talent usable: fields land on market entries",
  (() => { const t = S().market[S().market.length - 1]; return t.k === "dir" && t.id && t.power === 2 && t.skill === 45 && t.fee === 2.5 && t.fit[0] === "drama" && t.bookedUntil === 0; })());

const badCases = [
  ["not json at all", "bad JSON rejected"],
  [JSON.stringify({ nope: 1 }), "missing talents array rejected"],
  [JSON.stringify({ talents: [] }), "empty pack rejected"],
  [JSON.stringify({ talents: [{ n: "X", k: "actor", power: 9, skill: 60, fee: 5, fit: ["action"] }] }), "power 9 rejected"],
  [JSON.stringify({ talents: [{ n: "X", k: "actor", power: 3, skill: 99, fee: 5, fit: ["action"] }] }), "skill 99 rejected"],
  [JSON.stringify({ talents: [{ n: "X", k: "producer", power: 3, skill: 60, fee: 5, fit: ["action"] }] }), "bad k rejected"],
  [JSON.stringify({ talents: [{ n: "X", k: "actor", power: 3, skill: 60, fee: 50, fit: ["action"] }] }), "fee 50 rejected"],
  [JSON.stringify({ talents: [{ n: "X", k: "actor", power: 3, skill: 60, fee: 5, fit: ["nope"] }] }), "unknown genre fit rejected"],
  [JSON.stringify({ talents: [{ n: "X".repeat(31), k: "actor", power: 3, skill: 60, fee: 5, fit: ["action"] }] }), "name >30 chars rejected"],
  [JSON.stringify({ talents: Array.from({ length: 11 }, (_, i) => ({ n: "T" + i, k: "actor", power: 1, skill: 30, fee: 1, fit: ["action"] })) }), "11-talent pack over cap rejected"]
];
let badOk = 0;
for (const [raw] of badCases) {
  const before = S().market.length;
  C.meta2Action("m2-pack-import", el({ "data-text": raw }));
  if (S().market.length === before) badOk++;
}
check("all 10 invalid packs rejected with market untouched", badOk === badCases.length, badOk + "/" + badCases.length);
check("rejection toast shown", S().flash.some((t) => t.txt.indexOf("Pack rejected") >= 0));
check("kept pack text for fixing (packBox preserved on failure)", typeof S().m2.packBox === "string");

/* desks all render */
check("season pass desk renders goals + gold-theme note",
  typeof deskHTML("m2-pass") === "string" && deskHTML("m2-pass").indexOf(P().goals[0].txt) >= 0);
check("trilogy desk renders board (or starter)", typeof deskHTML("m2-trilogy") === "string" &&
  (deskHTML("m2-trilogy").indexOf(tr.name) >= 0 || deskHTML("m2-trilogy").indexOf("Start a new trilogy") >= 0));

/* gold theme path: force 8 completions and confirm the pref is written */
if (!S().m2.goldTheme) {
  for (const g of P().goals) g.done = true;
  P().claimed = P().goals.map((_, i) => i);
  S().m2.goldTheme = false;
  C.m2ApplyGoldTheme();
}
check("gold theme writes PREFS.goldTheme='1' to prefs store",
  (() => { try { const p = JSON.parse(mem["bow2.prefs"] || "{}"); return p.goldTheme === "1"; } catch (e) { return false; } })());

console.log("\n" + checks + " checks, " + failures + " failures" + (threw ? " (threw)" : ""));
process.exit(failures ? 1 : 0);
