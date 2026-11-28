/* test/share-market.mjs — Share Market completion (v48) logic tests.
 *
 * Runs the REAL data.js + engine.js + share-market.js bundle in jsdom with a
 * seeded Math.random (constant RNG is only pinned AFTER newGame, since a
 * constant stream hangs the engine's slate-seeding loops).
 *
 * Pins:
 *  - unlisted studios cannot buy back or set dividends;
 *  - buyback: premium pricing, share count, ownership restoration, ledger;
 *  - dividends: paid on call weeks, covered vs uncovered paths;
 *  - ownership sync: secondaries dilute;
 *  - takeover: threat → tender offer → pill/knight defense → acceptance
 *    (hard game over) → execution (survivable demotion) → recovery.
 *
 * Run: node test/share-market.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch (e) {
  console.error("❌ share-market: jsdom is required. Run: npm install");
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
  win.Math.random = mk(seed || 555);

  const SHIM = `if (typeof global.DATA === "undefined") global.DATA = {};\nglobal.window = global;\n`;
  const bundle = SHIM + "\n" + ["data.js", "engine.js", "share-market.js"]
    .map(read).join("\n;\n") + "\n;\n" + `
  global.__SM = {
    get G(){ return G; },
    newGame: (typeof newGame === "function") ? newGame : null,
    ShareMarket: (typeof ShareMarket !== "undefined") ? ShareMarket : null,
    goPublic: (typeof goPublic === "function") ? goPublic : null,
    marketCap: (typeof marketCap === "function") ? marketCap : null
  };`;
  const OUT = path.join(HERE, ".sm-generated.cjs");
  fs.writeFileSync(OUT, bundle);
  win.eval("global = this;");
  win.eval(fs.readFileSync(OUT, "utf8"));
  try { fs.unlinkSync(OUT); } catch {}
  return { win, SM: win.__SM };
}

/* listed studio with cash and a controlled price */
function listed(WR, opts) {
  opts = opts || {};
  WR.newGame("major", "Market Lab", { scenario: "standard", difficulty: "normal" });
  const G = WR.G;
  G._noSave = true;
  G.studio.cash = opts.cash != null ? opts.cash : 400;
  G.studio.rep = Math.max(G.studio.rep, 65);
  if (!WR.goPublic()) throw new Error("fixture: goPublic failed");
  if (opts.price != null) {
    G.public.price = opts.price;
    G.public.history = [opts.price];
  }
  WR.ShareMarket.ensure(G);          /* the desk opens → lazy state init */
  return G;
}

/* ── 1. unlisted studio ── */
{
  const { SM } = makeApp(101);
  SM.newGame("major", "Private Lab", { scenario: "standard", difficulty: "normal" });
  const G = SM.G;
  G._noSave = true;
  const st0 = SM.ShareMarket.ensure(G);
  check("ensure() lazily creates the sharemarket state", !!st0 && typeof st0.ownership === "number" && !!st0.takeover);
  check("unlisted buyback is refused", SM.ShareMarket.buybackShares(2, G).ok === false);
  check("unlisted dividend policy is refused", SM.ShareMarket.setDividend(0.2, G).ok === false);
  const t0 = G.sharemarket.takeover.threat;
  SM.ShareMarket.tickWeekly(G);
  check("threat decays while private", G.sharemarket.takeover.threat <= t0);
  check("ownership stays 100% while private", G.sharemarket.ownership === 100);
}

/* ── 2. buyback ── */
{
  const { SM } = makeApp(202);
  const G = listed(SM, { cash: 400, price: 20 });
  const P = G.public;
  const sharesBefore = P.shares;
  /* pre-dilute so the ownership restoration is observable (100% is capped) */
  G.sharemarket.ownership = 80;
  const ownBefore = G.sharemarket.ownership;
  const cashPre = G.studio.cash;          /* goPublic already added its $400M */
  const finBefore = G.weekTx.financing || 0;
  const res = SM.ShareMarket.buybackShares(2, G);
  const cost = Math.round(P.price * 1.06 * 2);
  check("buyback executes", res.ok === true, res.err || "");
  check("buyback charges the 6% premium", Math.abs((cashPre - G.studio.cash) - cost) < 0.01, "cost=" + cost);
  check("shares outstanding shrink by the buyback amount", P.shares === sharesBefore - 2, P.shares + " vs " + (sharesBefore - 2));
  check("buyback restores ownership proportionally", G.sharemarket.ownership > ownBefore,
    Math.round(ownBefore) + "% → " + Math.round(G.sharemarket.ownership) + "%");
  check("buyback lands in the financing ledger", (G.weekTx.financing || 0) === finBefore - cost);
  check("the buyback is tracked in state", G.sharemarket.buybackShares === 2);
}

/* ── 3. dividends ── */
{
  const { SM } = makeApp(303);
  const G = listed(SM, { cash: 400, price: 20 });
  const P = G.public;
  check("dividend policy set", SM.ShareMarket.setDividend(0.30, G).ok === true && G.sharemarket.dividends.perShare === 0.30);

  /* jump to an earnings-call week (woy 13) */
  const woy = ((G.week - 1) % 52) + 1;
  G.week += (13 - woy + 52) % 52;
  G.weekTx = {};
  const cashBefore = G.studio.cash;
  const priceBefore = P.price;
  SM.ShareMarket.tickWeekly(G);
  const payout = Math.round(P.shares * 0.30);
  check("covered dividend pays on the call week", Math.abs((cashBefore - G.studio.cash) - payout) < 0.01,
    "payout=" + payout);
  check("the dividend lands in its own ledger category", (G.weekTx.dividends || 0) === -payout);
  check("a covered dividend lifts the price slightly", P.price > priceBefore, priceBefore.toFixed(2) + " → " + P.price.toFixed(2));
  check("dividend totals are tracked", G.sharemarket.dividends.totalPaid === payout && G.sharemarket.dividends.quartersPaid === 1);

  /* uncovered path: drain cash, skip to the next call week */
  G.studio.cash = 0.5;
  G.week += 13;
  G.weekTx = {};
  const pricePre = P.price;
  SM.ShareMarket.tickWeekly(G);
  check("an uncovered dividend is skipped with a rep hit", G.sharemarket.dividends.totalPaid === payout,
    "totalPaid=" + G.sharemarket.dividends.totalPaid);
  check("an uncovered dividend dents the price", P.price < pricePre, pricePre.toFixed(2) + " → " + P.price.toFixed(2));
}

/* ── 4. ownership sync (secondaries dilute) ── */
{
  const { SM } = makeApp(404);
  const G = listed(SM, { cash: 400, price: 20 });
  const st = G.sharemarket;
  const P = G.public;
  const ownBefore = st.ownership;
  P.shares += 5;                     /* simulate secondaryOffering dilution */
  SM.ShareMarket.tickWeekly(G);
  check("new shares dilute the founder stake", st.ownership < ownBefore,
    Math.round(ownBefore) + "% → " + Math.round(st.ownership) + "%");
  check("the share watermark resyncs", st.lastShares === P.shares);
}

/* ── 5. tender offer → poison pill ── */
{
  const { win, SM } = makeApp(505);
  const G = listed(SM, { cash: 900, price: 5 });
  const st = G.sharemarket;
  const tk = st.takeover;
  tk.threat = 60;                    /* above the offer threshold */
  tk.lastOfferWeek = G.week - 20;    /* out of cooldown */
  win.Math.random = () => 0.001;     /* forced: the offer roll succeeds */
  SM.ShareMarket.tickWeekly(G);
  check("an undervalued, threatened studio attracts a tender", !!tk.activeOffer, tk.activeOffer ? tk.activeOffer.rival : "none");
  check("the tender carries a 15% premium", tk.activeOffer && Math.round(tk.activeOffer.premium * 100) === 115);
  check("the tender expires in 4 weeks", tk.activeOffer && tk.activeOffer.weeksLeft === 4);

  const ownBefore = st.ownership;
  const cashBefore = G.studio.cash;
  const finPre = G.weekTx.financing || 0;
  const offerTotal = tk.activeOffer.totalM;
  const res = SM.ShareMarket.defendOffer("pill", G);
  check("the poison pill executes", res.ok === true, res.err || "");
  check("the pill restores +10% ownership", st.ownership === Math.min(100, ownBefore + 10));
  check("the pill repels the offer", tk.activeOffer === null);
  check("threat cools after the pill", tk.threat === 35);
  check("the pill cost lands in the financing ledger",
    Math.abs((G.weekTx.financing || 0) - (finPre - Math.round(offerTotal * 0.35))) < 0.01,
    "fin=" + (G.weekTx.financing || 0) + " expected " + (finPre - Math.round(offerTotal * 0.35)));
  check("pill cost = 35% of the offer value", Math.abs((cashBefore - G.studio.cash) - Math.round(offerTotal * 0.35)) < 0.01,
    "cost=" + res.cost + " expected=" + Math.round(offerTotal * 0.35));
}

/* ── 6. acceptance is the hard game over ── */
{
  const { win, SM } = makeApp(606);
  const G = listed(SM, { cash: 50, price: 5 });
  const tk = G.sharemarket.takeover;
  tk.activeOffer = { rival: "Apex Pictures", pricePerShare: 5.75, totalM: 230, premium: 1.15, weeksLeft: 3 };
  const res = SM.ShareMarket.defendOffer("accept", G);
  check("accepting the tender ends the run", res.ok === true && res.ended === true);
  check("gameOver fired with the takeover title", !!G.over && G.over.title === "Hostile Takeover", G.over ? G.over.title : "none");
}

/* ── 7. execution is survivable, recovery via buyback ── */
{
  const { win, SM } = makeApp(707);
  const G = listed(SM, { cash: 60, price: 5 });
  const st = G.sharemarket;
  const tk = st.takeover;
  const boardBefore = (G.board || [{}])[0] ? (G.board[0].approval != null ? G.board[0].approval : 50) : 50;
  tk.activeOffer = { rival: "Apex Pictures", pricePerShare: 5.75, totalM: 230, premium: 1.15, weeksLeft: 1, born: G.week - 1 };
  SM.ShareMarket.tickWeekly(G);
  check("an un-defended tender executes", tk.demoted === true && tk.activeOffer === null);
  check("execution drops ownership to 45%", st.ownership === 45);
  check("execution hits the board", (G.board[0].approval) <= boardBefore - 14, boardBefore + " → " + G.board[0].approval);
  check("no game over fired on execution", !G.over);

  /* buy back to a majority → control restored */
  G.studio.cash = 500;
  G.public.price = 1;                /* cheap float so buybacks can reach 51% */
  let guard = 0;
  while (st.ownership < 51 && guard++ < 40) SM.ShareMarket.buybackShares(2, G);
  check("buybacks can restore the majority stake", st.ownership >= 51, Math.round(st.ownership) + "%");
  SM.ShareMarket.tickWeekly(G);
  check("control restored clears the demotion arc", tk.demoted === false);
}

process.exit(failures ? 1 : 0);
