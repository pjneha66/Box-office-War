/* Headless smoke test runner.
   data.js and engine.js are plain browser scripts sharing one global scope.
   To run them under Node, this runner assembles both plus the AI driver
   (smoke-body.js) into one generated script — a single shared scope — then
   loads it with a static require and removes it again. */
"use strict";
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".smoke-generated.js");

const SHIM = "if(typeof global.window === 'undefined') global.window = global;\nglobal.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};\nif(typeof global.DATA === 'undefined') global.DATA = {};\n";

const dataJs = fs.readFileSync(path.join(ROOT, "data.js"), "utf8").replace(/"use strict";/g, "");
const engineJs = fs.readFileSync(path.join(ROOT, "engine.js"), "utf8").replace(/"use strict";/g, "");
const financeToolsJs = fs.readFileSync(path.join(ROOT, "finance-tools.js"), "utf8").replace(/"use strict";/g, "");
const challengeJs = fs.readFileSync(path.join(ROOT, "challenge-leaderboard.js"), "utf8").replace(/"use strict";/g, "");
const theatersJs = fs.readFileSync(path.join(ROOT, "theater-chains.js"), "utf8").replace(/"use strict";/g, "");
const soundtrackJs = fs.readFileSync(path.join(ROOT, "dynamic-soundtrack.js"), "utf8").replace(/"use strict";/g, "");
const dynastyJs = fs.readFileSync(path.join(ROOT, "dynasty-legacy.js"), "utf8").replace(/"use strict";/g, "");
const shortsJs = fs.readFileSync(path.join(ROOT, "bow-shorts.js"), "utf8").replace(/"use strict";/g, "");
const agencyJs = fs.readFileSync(path.join(ROOT, "talent-agency.js"), "utf8").replace(/"use strict";/g, "");
const restorationJs = fs.readFileSync(path.join(ROOT, "film-restoration.js"), "utf8").replace(/"use strict";/g, "");
const festivalPrJs = fs.readFileSync(path.join(ROOT, "festival-pr.js"), "utf8").replace(/"use strict";/g, "");
const facilitiesJs = fs.readFileSync(path.join(ROOT, "studio-facilities.js"), "utf8").replace(/"use strict";/g, "");
const syndicationJs = fs.readFileSync(path.join(ROOT, "syndication-tv.js"), "utf8").replace(/"use strict";/g, "");
const contractsJs = fs.readFileSync(path.join(ROOT, "talent-contracts.js"), "utf8").replace(/"use strict";/g, "");
const bondsJs = fs.readFileSync(path.join(ROOT, "bond-market.js"), "utf8").replace(/"use strict";/g, "");
const clashJs = fs.readFileSync(path.join(ROOT, "clash-analytics.js"), "utf8").replace(/"use strict";/g, "");
const universeJs = fs.readFileSync(path.join(ROOT, "cinematic-universe.js"), "utf8").replace(/"use strict";/g, "");
const scoutingJs = fs.readFileSync(path.join(ROOT, "location-scouting.js"), "utf8").replace(/"use strict";/g, "");
const insuranceJs = fs.readFileSync(path.join(ROOT, "production-insurance.js"), "utf8").replace(/"use strict";/g, "");
const awardsJs = fs.readFileSync(path.join(ROOT, "awards-campaign.js"), "utf8").replace(/"use strict";/g, "");
const boardJs = fs.readFileSync(path.join(ROOT, "board-targets.js"), "utf8").replace(/"use strict";/g, "");
const fanJs = fs.readFileSync(path.join(ROOT, "fan-conventions.js"), "utf8").replace(/"use strict";/g, "");
const testScreenJs = fs.readFileSync(path.join(ROOT, "test-screenings.js"), "utf8").replace(/"use strict";/g, "");
const spyJs = fs.readFileSync(path.join(ROOT, "studio-espionage.js"), "utf8").replace(/"use strict";/g, "");
const merchJs = fs.readFileSync(path.join(ROOT, "merch-licensing.js"), "utf8").replace(/"use strict";/g, "");
const territoryJs = fs.readFileSync(path.join(ROOT, "territory-licensing.js"), "utf8").replace(/"use strict";/g, "");
const sandboxJs = fs.readFileSync(path.join(ROOT, "custom-sandbox.js"), "utf8").replace(/"use strict";/g, "");
const filmLocTaxJs = fs.readFileSync(path.join(ROOT, "film-locations-tax.js"), "utf8").replace(/"use strict";/g, "");
const studioOpsJs = fs.readFileSync(path.join(ROOT, "studio-operations-suite.js"), "utf8").replace(/"use strict";/g, "");
const gameDevHwJs = fs.readFileSync(path.join(ROOT, "gamedev-console-hardware.js"), "utf8").replace(/"use strict";/g, "");
const liveOpsCoProJs = fs.readFileSync(path.join(ROOT, "live-ops-coproduction.js"), "utf8").replace(/"use strict";/g, "");
const crisesJs = fs.readFileSync(path.join(ROOT, "hollywood-crises-pr.js"), "utf8").replace(/"use strict";/g, "");
const demoJs = fs.readFileSync(path.join(ROOT, "demographics-audiences.js"), "utf8").replace(/"use strict";/g, "");
const prodCreativityJs = fs.readFileSync(path.join(ROOT, "production-creativity-suite.js"), "utf8").replace(/"use strict";/g, "");
const plfJs = fs.readFileSync(path.join(ROOT, "exhibition-plf-concessions.js"), "utf8").replace(/"use strict";/g, "");
const mktgBlitzJs = fs.readFileSync(path.join(ROOT, "marketing-blitz-engine.js"), "utf8").replace(/"use strict";/g, "");
const smokeBodyJs = fs.readFileSync(path.join(__dirname, "smoke-body.js"), "utf8").replace(/"use strict";/g, "");

const bundle = SHIM +
  dataJs + "\n" +
  engineJs + "\n" +
  financeToolsJs + "\n" +
  challengeJs + "\n" +
  theatersJs + "\n" +
  soundtrackJs + "\n" +
  dynastyJs + "\n" +
  shortsJs + "\n" +
  agencyJs + "\n" +
  restorationJs + "\n" +
  festivalPrJs + "\n" +
  facilitiesJs + "\n" +
  syndicationJs + "\n" +
  contractsJs + "\n" +
  bondsJs + "\n" +
  clashJs + "\n" +
  universeJs + "\n" +
  scoutingJs + "\n" +
  insuranceJs + "\n" +
  awardsJs + "\n" +
  boardJs + "\n" +
  fanJs + "\n" +
  testScreenJs + "\n" +
  spyJs + "\n" +
  merchJs + "\n" +
  territoryJs + "\n" +
  sandboxJs + "\n" +
  filmLocTaxJs + "\n" +
  studioOpsJs + "\n" +
  gameDevHwJs + "\n" +
  liveOpsCoProJs + "\n" +
  crisesJs + "\n" +
  demoJs + "\n" +
  prodCreativityJs + "\n" +
  plfJs + "\n" +
  mktgBlitzJs + "\n" +
  smokeBodyJs + "\n";

fs.writeFileSync(OUT, bundle);
try{
  require("./.smoke-generated.js");
}finally{
  try{ if(fs.existsSync(OUT)) fs.unlinkSync(OUT); }catch(e){}
}
