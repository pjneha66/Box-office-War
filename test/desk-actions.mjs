/* Desk action contract.
   A desk that renders zero [data-action] controls is a dead end: the player opens
   it and can only close it. That is a legitimate design for a read-only dashboard
   (poster wall, trophy shelf, rival market share) and a bug for anything else.

   This test boots the real game, renders all 106 desks in a mature save (money,
   reputation, released films, weeks advanced) and asserts every desk either
   renders an interactive control or is declared in READONLY_DESKS in ui.js.
   That converts "some desks look dead" into an enforced, reviewable contract. */
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, "..", "game");

let failures = 0, checks = 0;
function check(name, ok, extra) {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
}

const html = fs
  .readFileSync(path.join(gameDir, "index.html"), "utf8")
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g, (_, f) =>
    "<script>\n" + fs.readFileSync(path.join(gameDir, f), "utf8") + "\n</script>"
  );

const vc = new VirtualConsole();
const errors = [];
vc.on("jsdomError", (e) => { if (!/CSS/.test(e.message)) errors.push(String(e.message).slice(0, 160)); });

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
await new Promise((r) => setTimeout(r, 900));

check("game boots with no script errors", errors.length === 0, errors[0] || "clean");

/* Mature save: cash, reputation, a release history and 40 weeks of simulation,
   so desks that legitimately gate on state have their state. */
w.eval(`
  newGame("Contract Test", "major", "std", "free");
  S.studio.cash = 2000; S.studio.rep = 90;
  for (var i = 0; i < 6; i++) {
    S.films.push({ id: "fc" + i, title: "Film " + i,
      genre: ["action","drama","comedy","horror","romance","crime"][i],
      scale: "mid", budget: 40, mkt: 20, cost: 60, supIds: [], quality: 70 + i,
      criticAvg: 60, freshPct: 60, aud: 65, quotes: [], opening: 25 + i, legs: 2.5,
      decay: 0.6, weeksOut: 9, dom: 60, ww: 120, intl: 60, weekly: [],
      releaseWeek: 1, season: "Summer", window: 45, status: "done", profit: 20 });
  }
  for (var k = 0; k < 40; k++) advanceWeek();
`);

const ids = JSON.parse(w.eval("JSON.stringify(collectDesks().map(d => d.id))"));
check("desks are collected", ids.length > 100, ids.length + " desks");

const readonlyDeclared = JSON.parse(w.eval("JSON.stringify(Object.keys(READONLY_DESKS))"));
const hintDeclared = JSON.parse(w.eval("JSON.stringify(Object.keys(UNLOCK_HINTS))"));
const declared = new Set(readonlyDeclared);
const hinted = new Set(hintDeclared);

const dead = [];
const throws = [];
const readOnly = [];
const explained = [];

for (const id of ids) {
  let r;
  try {
    r = JSON.parse(
      w.eval(`(function(){
        var d = findDesk(${JSON.stringify(id)});
        if (!d) return JSON.stringify({ missing: true });
        var h = d.render();
        var n = (h.match(/data-action/g) || []).length;
        var note = readonlyNote(d.id) + unlockNote(d.id, h);
        return JSON.stringify({ n: n, note: note.length });
      })()`)
    );
  } catch (e) {
    throws.push(id + ": " + e.message);
    continue;
  }
  if (r.missing) { dead.push(id + " (desk missing)"); continue; }
  if (r.n > 0) continue;
  /* No controls: acceptable only if the player is told why and what to do next. */
  if (declared.has(id)) readOnly.push(id);
  else if (hinted.has(id) && r.note > 0) explained.push(id);
  else dead.push(id);
}

check("every desk renders without throwing", throws.length === 0, throws.length ? throws.join(" | ") : ids.length + " rendered");
check(
  "every desk is interactive, read-only, or explains its next step",
  dead.length === 0,
  dead.length ? "unexplained dead desks: " + dead.join(", ") : ids.length + " covered (" + explained.length + " gated, " + readOnly.length + " read-only)"
);

/* The registries must not rot: a stale entry hides future regressions. */
const stale = readonlyDeclared.filter((id) => !ids.includes(id));
check("READONLY_DESKS lists only real desks", stale.length === 0, stale.length ? stale.join(", ") : readonlyDeclared.length + " entries all real");
const staleHints = hintDeclared.filter((id) => !ids.includes(id));
check("UNLOCK_HINTS lists only real desks", staleHints.length === 0, staleHints.length ? staleHints.join(", ") : hintDeclared.length + " entries all real");

/* A hint is state-dependent: a desk can be gated in a fresh studio and interactive
   later. So instead of demanding every hint be unused here, assert each hint is
   reachable at all — it must fire on some desk in the FRESH save, which is the
   state a new player actually meets. */
w.eval(`newGame("Fresh Test", "veteran", "std", "free");`);
const unreachable = [];
for (const id of hinted) {
  if (!ids.includes(id)) continue;
  const r = JSON.parse(w.eval(`(function(){
    var d = findDesk(${JSON.stringify(id)});
    if (!d) return JSON.stringify({ n: 1 });
    var h = d.render();
    return JSON.stringify({ n: (h.match(/data-action/g) || []).length });
  })()`));
  /* reachable = the desk offers no controls in a fresh save, so the hint shows */
  if (r.n > 0) unreachable.push(id);
}
check(
  "every UNLOCK_HINT is reachable in a fresh studio",
  unreachable.length === 0,
  unreachable.length ? "interactive even when fresh: " + unreachable.join(", ") : hinted.size + " hints reachable"
);

const interactive = ids.length - readOnly.length - explained.length;
check("interactive desks are the majority", interactive > readOnly.length + explained.length,
  interactive + " interactive · " + explained.length + " gated · " + readOnly.length + " read-only");

console.log("\n" + (failures ? failures + " FAILED" : "ALL " + checks + " CHECKS PASSED"));
process.exit(failures ? 1 : 0);
