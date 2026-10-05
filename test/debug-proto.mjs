import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SHIM = 'global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};global.DATA={};\n';

const body = SHIM + 
  fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "engine.js"), "utf8") + "\n" +
  `
newGame("indie", "Test"); 
G._noSave=true; 
G.tutorial=null;

for(let w=0; w<120; w++){
  if(w%6===0 && G.ideas.length && G.studio.cash>200){
    try{ greenlight({ idea:G.ideas[0], writer:null, director:null, producer:null, cast:[], budget:Math.round(neededBudget(G.ideas[0].genre,G.ideas[0].scale)), marketing:10, plan:"theatrical" }); }catch(e){}
  }
  (G.projects||[]).forEach(p=>{ if(p.phase==="ready" && !p.releaseWeek){ p.releaseWeek=G.week+1; p.marketingPaid=p.marketing; } });
  if(w===30 && !(G.prototypeData||{}).gameDevUnlocked){ G.studio.rep=55; G.studio.cash=Math.max(G.studio.cash,400); unlockGameDevLite(); }
  if((G.prototypeData||{}).gameDevUnlocked && !(G.prototypeData||{}).currentProject && w>32){
    startGameDevProject({ genre:"rpg", platform:"pc", theme:"fantasy", mechanic:"narrative", monetization:"premium" });
  }
  advanceWeeks(1);
  G.pendingChoice=null; G.pendingReport=null; G.pendingEarnings=null; G.pendingAuction=null; G.pendingSports=null;
}

const eventCounts={}; let total=0;
(G.talent||[]).forEach(t=>{ if(t.prototype && t.prototype.events){ t.prototype.events.forEach(e=>{ eventCounts[e.type]=(eventCounts[e.type]||0)+1; total++; }); } });
console.log("Life events:", eventCounts, "total:", total);
console.log("Expected types: career, personal, scandal, social, mentorship, feud");
const expected = ["career","personal","scandal","social","mentorship","feud"];
expected.forEach(e=>{ if(!eventCounts[e]) console.log("MISSING:", e); });

const levels=(G.talent||[]).map(t=>t.prototype?t.prototype.level:0);
console.log("Max level:", Math.max(0,...levels));
`;

const m = { exports: {} };
eval(body);