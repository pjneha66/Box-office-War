import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SHIM = 'global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};global.DATA={};\n';

const body = SHIM +
  fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "engine.js"), "utf8") + "\n" + `
const SCENARIOS = ["standard", "turnaround", "goldenage", "indiedarling", "franchisemachine"];
const WEEKS = 200;
let allPass = true;
const report = [];

for (const scen of SCENARIOS) {
  newGame(scen, scen.charAt(0).toUpperCase() + scen.slice(1) + " Studio", { scenario: scen });
  G._noSave = true; G.tutorial = null;

  let bankrupt = false;
  for (let w = 0; w < WEEKS && !G.over; w++) {
    // keep solvent to test scenario balance, not bankruptcy RNG
    if (G.studio.cash < 600) { G.studio.cash = 600; G.weeksInDebt = 0; G.studio.debt = Math.min(G.studio.debt || 0, 10); }
    // scripted player: greenlight when affordable
    if (w % 6 === 0 && G.ideas.length && G.studio.cash > 450) {
      const idea = G.ideas[0];
      try {
        greenlight({ idea, writer: null, director: null, producer: null, cast: [],
          budget: Math.round(neededBudget(idea.genre, idea.scale)), marketing: 10, plan: "theatrical" });
      } catch (e) {}
    }
    // release ready films
    (G.projects || []).forEach(p => { if (p.phase === "ready" && !p.releaseWeek) { p.releaseWeek = G.week + 1; p.marketingPaid = p.marketing; } });
    // clear pendings
    advanceWeeks(1);
    G.pendingChoice = null; G.pendingReport = null; G.pendingEarnings = null;
    if (G.pendingAuction && !G.pendingAuction.manual) G.pendingAuction = null;
    if (G.pendingSale) G.pendingSale = null;
    if (G.pendingSports) G.pendingSports = null;
  }

  const won = (G.scenarioProgress || {})[scen];
  const rep = G.studio.rep;
  const films = G.stats.films;
  const ww = Math.round(G.stats.totalWW);
  const pass = !G.over && rep >= 5 && films > 0;
  if (!pass) allPass = false;

  report.push({
    scenario: scen,
    weeks: G.over ? "BANKRUPT @ wk" + G.week : G.week,
    rep, films, ww,
    scenarioWon: !!(won && won.won),
    wonAt: won?.wonAt || null,
    bestRep: won?.bestRep || rep,
    status: pass ? "PASS" : "FAIL"
  });
}

console.log("═══ SCENARIO PLAYTHROUGH REPORT ═══");
report.forEach(r => {
  console.log((r.status === "PASS" ? "✅" : "❌") + " " + r.scenario +
    " · wk " + r.weeks + " · rep " + r.rep + " · " + r.films + " films · $" + r.ww + "M WW" +
    (r.scenarioWon ? " · 🏆 scenario won @ wk " + r.wonAt + " (best rep " + r.bestRep + ")" : ""));
});
console.log(allPass ? "\\nALL SCENARIOS PASSED ✅" : "\\nSCENARIO FAILURES DETECTED ❌");
process.exitCode = allPass ? 0 : 1;
`;

eval(body);