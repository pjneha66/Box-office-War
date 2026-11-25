/* Rebuild Posters-module harness (pattern from test/rebuild-library.mjs): runs game/data.js +
   game/engine.js + game/posters.js in a VM sandbox with a stubbed localStorage and the two ui
   helpers the desks render with (statrow/tag — ui.js itself needs a DOM). Posters is a display
   module with no weekly tick, so after the determinism/purity/desk checks it drives 60
   advanceWeek() weeks to prove the module never breaks the sim and S.posters survives
   save → load. Prints one line per check; exits non-zero on failure. */
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
  /* ui.js helpers (same behavior as ui.js) */
  statrow: (k, v, cls) => '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>",
  tag: (txt, cls) => '<span class="tag ' + (cls || "") + '">' + txt + "</span>"
});
for (const f of ["data.js", "engine.js", "posters.js"]) {
  vm.runInContext(readFileSync(path.join(gameDir, f), "utf8"), ctx, { filename: f });
}
const C = ctx;

function elx(id, key) { return { getAttribute: (k) => (k === "data-id" ? id : key) }; }
function mkFilm(id, title, genre, wk, ww) {
  return { id, title, genre, scale: "mid", budget: 40, mkt: 20, cost: 60, dirId: "t1", actId: "t2",
    quality: 70, criticAvg: 60, freshPct: 60, aud: 66, opening: 40, legs: 2.1, decay: 1 - 1 / 2.1,
    weeksOut: 6, dom: Math.round(ww * 0.63 * 10) / 10, weekly: [], releaseWeek: wk,
    season: "Summer season", franchiseOf: null, status: "done", quotes: [] };
}

/* ── static contract checks ───────────────────────────────────── */
const src = readFileSync(path.join(gameDir, "posters.js"), "utf8");
for (const tok of ["?.", "??", ".flatMap(", ".flat(", "Object.fromEntries", "globalThis", "Math.random"]) {
  check("ES2017-safe + seeded only: no '" + tok + "'", !src.includes(tok));
}
check("posterSVG / posterAction / POSTER_DESKS / POSTER_PALETTES exported",
  typeof C.posterSVG === "function" && typeof C.posterAction === "function" &&
  Array.isArray(C.POSTER_DESKS) && C.POSTER_PALETTES && typeof C.POSTER_PALETTES === "object");
check("POSTER_DESKS = 2 desks in group 'The lobby' (posters-wall, posters-studio)",
  C.POSTER_DESKS.length === 2 &&
  C.POSTER_DESKS.map((d) => d.id).join(",") === "posters-wall,posters-studio" &&
  C.POSTER_DESKS.every((d) => d.group === "The lobby" && d.icon && d.name && typeof d.render === "function"));
check("a palette for every supported genre",
  Object.keys(C.POSTER_PALETTES).sort().join(",") === C.GENRES.map((g) => g.id).sort().join(","));

/* ── new game + 3 fake done films ─────────────────────────────── */
C.newGame("Test", "veteran");
const f1 = mkFilm("f9001", "Crimson Horizon", "action", 20, 140);
const f2 = mkFilm("f9002", "Silent Tide", "action", 30, 95);
const f3 = mkFilm("f9003", "Neon Kingdom Rises", "scifi", 40, 70);
C.S.films.unshift(f3, f2, f1);

const a1 = C.posterSVG(f1);
check("posterSVG(f) is an <svg> string with wrapped title, credit, year, gradient",
  typeof a1 === "string" && a1.includes("<svg") && a1.includes("CRIMSON") && a1.includes("HORIZON") &&
  a1.includes("A TEST PICTURE") && a1.includes("YEAR 1") && a1.includes("linearGradient"));
check("stable: same film → byte-identical output twice", a1 === C.posterSVG(f1));
check("differs between two films (different seeds, same genre)", a1 !== C.posterSVG(f2));
{
  const vs = [0, 1, 2, 3].map((v) => C.posterSVG(f1, v));
  let distinct = true;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (vs[i] === vs[j]) distinct = false;
  check("4 seed-offset variants (0-3) are pairwise distinct", distinct);
}
C.postEnsure(); C.S.posters.f9001 = 2;
check("posterSVG uses the stored variant seed", C.posterSVG(f1) === C.posterSVG(f1, 2));
delete C.S.posters.f9001;
{
  const snap = JSON.stringify(C.S);
  C.posterSVG(f1); C.posterSVG(f2, 1); C.posterSVG(f3, 3);
  check("posterSVG is pure — S unchanged after calls", JSON.stringify(C.S) === snap);
}
C.S.posters = null;
check("posterSVG survives a missing S.posters (old save)", typeof C.posterSVG(f1) === "string" && C.posterSVG(f1).includes("<svg"));
C.POSTER_DESKS[0].render();
check("desk render lazily re-creates S.posters", !!C.S.posters && typeof C.S.posters === "object");

let maxLen = 0, ok = true;
for (const g of C.GENRES) {
  const svg = C.posterSVG({ id: "gx" + g.id, title: "The " + g.name + " Test", genre: g.id, releaseWeek: 10, opening: 10, dom: 20 });
  maxLen = Math.max(maxLen, svg.length);
  if (!svg.includes("<svg") || svg.length >= 4096) ok = false;
}
for (let v = 0; v < 4; v++) {
  const svg = C.posterSVG(f1, v);
  maxLen = Math.max(maxLen, svg.length);
  if (svg.length >= 4096) ok = false;
}
check("all 12 genre posters + 4 variants render < 4KB", ok, "max " + maxLen + " chars");

/* ── desks ────────────────────────────────────────────────────── */
const wall = C.POSTER_DESKS[0].render();
check("Poster wall uses .deskgrid and embeds posterSVG output", wall.includes("deskgrid") && wall.includes(a1) && wall.includes("Silent Tide"));
check("Poster studio starts with the film picker", C.POSTER_DESKS[1].render().includes("poster-pick"));
check("poster-pick selects a released film", C.posterAction("poster-pick", elx("f9001")) === true);
const p0 = C.posterSVG(f1, 0);
check("Poster studio previews the picked film", C.POSTER_DESKS[1].render().includes(p0) && C.POSTER_DESKS[1].render().includes("poster-variant"));
check("poster-variant switches the preview", C.posterAction("poster-variant", elx(null, "2")) === true && C.POSTER_DESKS[1].render().includes(C.posterSVG(f1, 2)));
check("poster-set stores S.posters[filmId] = variant and saves",
  C.posterAction("poster-set", elx(null, null)) === true && C.S.posters.f9001 === 2 && (mem["bow2.save.v1"] || "").includes('"posters"'));
check("Poster wall now renders the stored variant", C.POSTER_DESKS[0].render().includes(C.posterSVG(f1, 2)));
check("posterAction rejects foreign/unknown actions", C.posterAction("film-open", elx("f9001")) === false && C.posterAction("poster-bogus", elx(null, null)) === false);

/* ── sim integration: the module never breaks a week ──────────── */
let weeks = 0, bad = null;
for (let i = 0; i < 60 && !bad; i++) {
  try {
    C.advanceWeek();
    weeks++;
    if (!isFinite(C.S.studio.cash)) bad = "non-finite cash week " + C.S.studio.week;
    if (C.S.over) bad = "bankrupt week " + C.S.studio.week;
  } catch (e) { bad = "week " + C.S.studio.week + ": " + (e.stack || e); }
}
check("60 advanceWeek() weeks with posters loaded: no throw, cash finite, never bankrupt",
  !bad && weeks === 60, bad || ("cash " + Math.round(C.S.studio.cash)));
check("S.posters + stored variant survive save → load",
  C.loadGame() === true && C.S.posters.f9001 === 2 && C.posterSVG(f1) === C.posterSVG(f1, 2));

console.log((failures ? "FAIL" : "ALL PASS") + "  " + (checks - failures) + "/" + checks + " checks");
process.exit(failures ? 1 : 0);
