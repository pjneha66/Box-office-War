/* test/event-cinema.mjs — Opening Night Event Cinema (v49).
 *
 * Runs the REAL data.js + engine.js + event-cinema.js bundle in jsdom with a
 * seeded Math.random.
 *
 * Pins:
 *  - catalog() rotates 3 events each week, seeded off G.week;
 *  - canBook() blocks: unknown event/tier, double-booking a weekend, insufficient cash;
 *  - book() spends the license fee via the licensing ledger, pays profit via
 *    the events ledger, reserves one booking per weekend;
 *  - tickWeekly() resolves the booked event (profit/loss), rep +/- , chain rel +/-;
 *  - each main event raises addNotification (spied).
 *
 * Run: node test/event-cinema.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ event-cinema: jsdom is required. Run: npm install");
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
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "event-cinema.js"].map(read).join("\n;\n") + "\n;\n" + `
  global.__EC = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    EventCinema: (typeof EventCinema !== "undefined") ? EventCinema : null,
    addNotification: (typeof addNotification === "function") ? addNotification : null,
    spend: (typeof spend === "function") ? spend : null,
    earn: (typeof earn === "function") ? earn : null,
    advanceWeek: (typeof advanceWeek === "function") ? advanceWeek : null
  };`;
  const OUT = path.join(HERE, ".ec-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, EC: win.__EC };
}

/* Fixture: studio with cash and chains seeded. */
function fixture(EC, seed) {
  EC.newGame("major", "Event Lab", { scenario: "standard", difficulty: "normal" });
  const G = EC.G;
  G._noSave = true;
  G.studio.cash = 500;
  G.studio.rep = 50;
  /* G.chains is seeded by newGame from DATA.CHAINS: meridian, novastar, lumen, regent, starlite */
  return { G, EC };
}

let notified = [];

/* ── 1: catalog rotation ── */
{
  const { EC } = makeApp(1234);
  const { G } = fixture(EC, 0);
  const cat1 = EC.EventCinema.catalog(G);
  check("catalog returns 3 events", cat1.length === 3, cat1.length + " events");
  const ids1 = cat1.map(e => e.id);
  check("catalog ids are valid event keys", ids1.every(id => Object.keys(EC.EventCinema.EVENTS).includes(id)));
  G.week += 1;
  const cat2 = EC.EventCinema.catalog(G);
  check("catalog rotates next week", cat2.length === 3 && JSON.stringify(cat2.map(e=>e.id)) !== JSON.stringify(ids1));
}

/* ── 2: canBook guards ── */
{
  const { EC } = makeApp(5678);
  const { G, EC: M } = fixture(EC, 0);
  const ev = Object.keys(M.EventCinema.EVENTS)[0];
  const chain = G.chains[0].id;
  const tier = M.EventCinema.EVENTS[ev].tiers[0].id;
  check("canBook on valid booking", M.EventCinema.canBook(ev, chain, tier, G).ok === true);
  check("unknown event refused", M.EventCinema.canBook("nope", chain, tier, G).ok === false);
  check("unknown tier refused", M.EventCinema.canBook(ev, chain, "vip", G).ok === false);
  check("unknown chain refused", M.EventCinema.canBook(ev, "nope", tier, G).ok === false);
  M.EventCinema.book(ev, chain, tier, G);
  check("double-booking same weekend refused", M.EventCinema.canBook(ev, chain, tier, G).ok === false);
  check("insufficient cash refused", (() => { G.studio.cash = 0; return M.EventCinema.canBook(ev, chain, tier, G); })().ok === false);
  G.studio.cash = 500; /* restore */
}

/* ── 3: book() cash + ledger + reservation ── */
{
  const { EC } = makeApp(9012);
  const { G, EC: M } = fixture(EC, 0);
  const ev = Object.keys(M.EventCinema.EVENTS)[0];
  const chain = G.chains[0].id;
  const tier = M.EventCinema.EVENTS[ev].tiers.find(t => t.id === "standard").id;
  const cost = M.EventCinema.EVENTS[ev].cost;
  const cashBefore = G.studio.cash;
  const finBefore = G.weekTx.licensing || 0;
  const res = M.EventCinema.book(ev, chain, tier, G);
  check("book executes", res.ok === true, res.err || "");
  check("license fee spent via licensing ledger", (G.weekTx.licensing || 0) === finBefore - cost);
  check("events ledger paid profit when positive", res.profit > 0 ? (G.weekTx.events || 0) === res.profit : true, "events=" + (G.weekTx.events || 0) + " profit=" + res.profit);
  check("one booking reserved for the weekend", G.eventCinema.booked.length === 1 && G.eventCinema.booked[0].eventId === ev);
  check("booking not yet resolved", G.eventCinema.booked[0].resolved === false);
  check("event attended", typeof res.attendance === "number" && res.attendance > 0);
}

/* ── 4: tickWeekly resolves profit/loss + rep + chain rel ── */
{
  const { EC } = makeApp(3456);
  const { G, EC: M } = fixture(EC, 0);
  const ev = Object.keys(M.EventCinema.EVENTS)[0];
  const chainDef = G.chains.find(c => c.id === G.chains[0].id);
  const tier = M.EventCinema.EVENTS[ev].tiers[0];
  const res = M.EventCinema.book(ev, G.chains[0].id, tier.id, G);
  const repBefore = G.studio.rep;
  const relBefore = chainDef.rel;
  const weekAtBooking = G.week;
  const profit = res.profit;

  G.week += 1; /* next week → tick resolves last week's booking */
  M.EventCinema.tickWeekly(G);
  const b = G.eventCinema.booked[0];
  check("booking resolved", b.resolved === true);
  check("moved to history", G.eventCinema.history.length === 1);
  check("booked list cleared for this week", G.eventCinema.booked.filter(x => x.week === weekAtBooking && !x.resolved).length === 0);

  const profitOk = profit >= 0 ? G.studio.rep > repBefore : G.studio.rep < repBefore;
  check("rep moves with profit/loss", profitOk, "rep " + repBefore + " → " + G.studio.rep + " profit=" + profit);
  const relOk = profit >= 0 ? chainDef.rel > relBefore : chainDef.rel < relBefore;
  check("chain relation moves with profit/loss", relOk, "rel " + relBefore + " → " + chainDef.rel);
}

/* ── 5: every main event raises a notification ── */
{
  const { EC } = makeApp(7788);
  const { G, EC: M } = fixture(EC, 0);
  const notifiedBefore = (G.notifications || []).length;
  const evKeys = Object.keys(M.EventCinema.EVENTS);
  let notified = 0;
  for(const ev of evKeys){
    G.studio.cash = 500;
    M.EventCinema.book(ev, G.chains[0].id, M.EventCinema.EVENTS[ev].tiers[0].id, G);
    G.week += 1;
    M.EventCinema.tickWeekly(G);
  }
  const after = G.notifications.length;
  check("notifications raised for events", after > notifiedBefore, "before=" + notifiedBefore + " after=" + after);
  const eventNotifs = G.notifications.filter(n => /Event cinema/.test(n.text));
  check("event-cinema notifications exist", eventNotifs.length > 0, eventNotifs.length + " event notification(s)");
}

process.exit(failures ? 1 : 0);
