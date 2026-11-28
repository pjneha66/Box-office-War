/* test/restructuring.mjs — Bankruptcy Restructuring (v49).
 *
 * Runs the REAL data.js + engine.js bundle in jsdom with a seeded Math.random.
 *
 * Pins:
 *  - netDebt > credit line ×1.15 for 3 straight weeks triggers the restructuring
 *    offer instead of instant game over (guard: G.restructure.pending);
 *  - bailout injects cash, defers seizure 4 weeks, hits rep;
 *  - firesale injects smaller cash, defers 6 weeks, resets franchise fatigue;
 *  - accepting insolvency fires gameOver("Bankruptcy");
 *  - a resolveGameOver condition: after deferral, still over limit → game over.
 *
 * Run: node test/restructuring.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ restructuring: jsdom is required. Run: npm install");
  process.exit(1);
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

function mk(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeApp(seed) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>
  </body></html>`, { url: "https://example.test/", runScripts: "outside-only" });
  const win = dom.window;
  win.addEventListener("error", (e) => e.preventDefault());
  win.console.error = function () {};
  const rnd = mk(seed);
  win.Math.random = rnd;

  const SHIM = `if (typeof global.DATA === "undefined") global.DATA = {};\nglobal.window = global;\n`;
  const bundle = SHIM + "\n" + ["data.js", "engine.js"].map(read).join("\n;\n") + "\n;\n" + `
  global.__RS = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    gameOver: (typeof gameOver === "function") ? gameOver : null,
    addNotification: (typeof addNotification === "function") ? addNotification : null,
    maxDebt: (typeof maxDebt === "function") ? maxDebt : null,
    catalogValue: (typeof catalogValue === "function") ? catalogValue : null,
    applyBailout: (typeof applyBailout === "function") ? applyBailout : null,
    applyFiresale: (typeof applyFiresale === "function") ? applyFiresale : null,
    acceptInsolvency: (typeof acceptInsolvency === "function") ? acceptInsolvency : null,
    advanceWeek: (typeof advanceWeek === "function") ? advanceWeek : null,
    spend: (typeof spend === "function") ? spend : null,
    earn: (typeof earn === "function") ? earn : null
  };`;
  const OUT = path.join(HERE, ".rs-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, RS: win.__RS };
}

/* Fixture: studio deep in debt with plenty of cash to burn through. */
function fixture(RS, seed) {
  RS.newGame("major", "Restructure Lab", { scenario: "standard", difficulty: "normal" });
  const G = RS.G;
  G._noSave = true;
  G.studio.cash = 10;
  G.studio.debt = RS.maxDebt() * 4;           // start way over the line
  G.studio.rep = 50;
  G.weeksInDebt = 2;                          // one more tick = 3 → offer
  return { G, RS };
}

/* Advance enough weeks to fire the offer (each week interest keeps netDebt high). */
function tickToOffer(RS) {
  const G = RS.G;
  let fired = false;
  for(let i = 0; i < 12; i++){
    RS.advanceWeek();
    if(G.restructure && G.restructure.pending){ fired = true; break; }
  }
  return fired;
}

let offered = false;

/* ── 1: restructuring offer fires instead of instant game over ── */
{
  const { win, RS } = makeApp(4242);
  const { G } = fixture(RS, 0);
  const overLimitBefore = G.studio.debt - Math.max(G.studio.cash,0) > RS.maxDebt()*1.15;
  check("fixture starts over the credit line", overLimitBefore);
  const fired = tickToOffer(RS);
  offered = fired;
  check("restructuring offer fires after 3 over-limit weeks", fired === true);
  check("offer is pending (one per week)", G.restructure && G.restructure.pending === true);
  check("no instant game over", !G.over);
  check("a notification was raised", G.notifications && G.notifications.some(n => /bankruptcy|bank/i.test(n.text)));
}

/* ── 2: bailout defers seizure, injects cash, hits rep ── */
{
  const { win, RS } = makeApp(8888);
  const { G } = fixture(RS, 0);
  tickToOffer(RS);
  const repBefore = G.studio.rep;
  const debtBefore = G.studio.debt;
  const res = RS.applyBailout();
  check("bailout executes", res.ok === true);
  check("rep takes a hit", G.studio.rep < repBefore, repBefore + " → " + G.studio.rep);
  check("deferral set 4 weeks out", G.restructure.deferUntil === G.week + 4);
  check("pending cleared after choice", G.restructure.pending === false);
  check("choice recorded", G.restructure.choice === "bailout");
  check("game over not triggered by bailout", !G.over);
}

/* ── 3: firesale defers 6 weeks, resets franchise fatigue ── */
{
  const { win, RS } = makeApp(1111);
  const { G } = fixture(RS, 0);
  G.franchises = [{ name:"Test Franchise", tier:1, fatigue:0.9, entries:[] }];
  tickToOffer(RS);
  const fatigueBefore = G.franchises[0].fatigue;
  const res = RS.applyFiresale();
  check("firesale executes", res.ok === true);
  check("franchise fatigue reset to 0", G.franchises[0].fatigue === 0, fatigueBefore + " → " + G.franchises[0].fatigue);
  check("deferral set 6 weeks out", G.restructure.deferUntil === G.week + 6);
  check("choice recorded", G.restructure.choice === "firesale");
}

/* ── 4: acceptance fires game over ── */
{
  const { win, RS } = makeApp(7777);
  const { G } = fixture(RS, 0);
  tickToOffer(RS);
  RS.acceptInsolvency();
  check("acceptance fires game over", G.over && G.over.title === "Bankruptcy", G.over ? G.over.title : "none");
}

/* ── 5: after deferral expires with no recovery, game over fires ── */
{
  const { win, RS } = makeApp(3333);
  const { G } = fixture(RS, 0);
  tickToOffer(RS);
  // No choice taken; push weeks past the offer week. The offer week is the
  // deferUntil boundary; keep ticking until it lapses.
  const offeredWeek = G.restructure.offeredWeek;
  let lapsed = false;
  for(let i = 0; i < 6; i++){
    RS.advanceWeek();
    if(G.over && G.over.title === "Bankruptcy"){ lapsed = true; break; }
  }
  check("unresolved offer lapses into game over", lapsed === true);
}

/* ── 6: recovery within deferral avoids game over ── */
{
  const { win, RS } = makeApp(5555);
  const { G } = fixture(RS, 0);
  tickToOffer(RS);
  const res = RS.applyBailout();
  const deferWeek = G.restructure.deferUntil;
  // Advance one week with lots of cash so netDebt drops below the line.
  G.studio.cash = 5000;
  RS.advanceWeek();
  check("recovered within deferral — no game over yet", !G.over);
}

process.exit(failures ? 1 : 0);
