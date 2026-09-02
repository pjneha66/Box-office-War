/* UI integration test — requires jsdom: npm i jsdom, then: node test/ui-test.mjs
   Boots the real index.html + scripts, then plays like a human: founds a studio, greenlights a film
   (with distribution plan + pre-sales), dates the release, rides the theatrical run, shops a film to
   streamers via the auction modal, builds the franchise empire, and checks save/load. */
"use strict";
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs"; import path from "path";
const ROOT = "/home/user/Box-office-War";

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace(/<script src="data.js"><\/script>/, () => "<script>"+fs.readFileSync(path.join(ROOT,"data.js"),"utf8")+"<\/script>")
  .replace(/<script src="engine.js"><\/script>/, () => "<script>"+fs.readFileSync(path.join(ROOT,"engine.js"),"utf8")+"<\/script>")
  .replace(/<script src="ui.js"><\/script>/, () => "<script>"+fs.readFileSync(path.join(ROOT,"ui.js"),"utf8")+"<\/script>");

const virtualConsole = new VirtualConsole();
let pageErrors = [];
virtualConsole.on("jsdomError", e => pageErrors.push("jsdomError: "+e.message));
virtualConsole.on("error", (...a) => pageErrors.push("console.error: "+a.join(" ")));

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true, virtualConsole });
const { window } = dom;
window.AudioContext = undefined;

// wait for DOMContentLoaded listeners to fire in jsdom
if (window.document.readyState !== "complete") {
  await new Promise(r => { window.document.addEventListener("load", r); setTimeout(r, 300); });
}
await new Promise(r => setTimeout(r, 50));

const g = () => window.eval("G");
const errors = pageErrors.slice();
const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const click = el => { if(!el) { errors.push("click target missing"); return; } el.dispatchEvent(new window.Event("click", {bubbles:true})); };

function step(name, fn){ try{ fn(); console.log("✓", name); }catch(e){ errors.push(name+": "+e.message); console.log("✗", name, e.message); } }

step("start screen renders archetypes", ()=>{
  if($$(".arch").length!==3) throw new Error("archetypes missing");
  if(!$("#btnStart")) throw new Error("start button missing");
});
step("found studio", ()=>{
  $("#studioName").value = "Test Studio";
  click($("#btnStart"));
  if($("#app").style.display==="none") throw new Error("app not shown");
});
step("help modal auto-opens and closes", async ()=>{
  await new Promise(r=>setTimeout(r,500));
  const btn = $$(".modal-actions .btn").pop();
  click(btn);
});
step("chips populated", ()=>{
  if(!$("#chipCash").textContent.includes("$")) throw new Error("cash chip bad: "+$("#chipCash").textContent);
  if(!$("#chipDate").textContent.includes("Y1")) throw new Error("date chip bad");
});

for(const t of ["develop","productions","boxoffice","ott","finance","studio"]){
  step("tab "+t, ()=>{ click($(".tab[data-tab='"+t+"']")); if(!$("#view").innerHTML) throw new Error("empty view"); });
}

step("advance 3 weeks", ()=>{ for(let i=0;i<3;i++) click($("#btnWeek")); });

step("open develop + start wizard", ()=>{
  click($(".tab[data-tab='develop']"));
  // pick an affordable script like a real player (retry while the market rotates)
  let btn=null;
  for(let tries=0; tries<12 && !btn; tries++){
    const cards=$$("[data-dev]");
    btn=cards.find(c=>{
      const i=g().ideas.find(x=>x.id===+c.dataset.dev);
      if(!i || i.scale==="tentpole") return false;
      const est=window.eval("neededBudget('"+i.genre+"','"+i.scale+"')");
      return est <= g().studio.cash*0.35; // room for crew fees + production burn
    });
    if(!btn) click($("#btnWeek"));
  }
  if(!btn) throw new Error("no affordable idea found");
  click(btn);
  if(!$$("[data-dir]").length && !window.document.querySelector("#wzNext2")) throw new Error("neither crew step nor director picker appeared");
});
step("pick crew (writer + producer), director, cast + confirm", ()=>{
  // crew step: writers/producers are optional but the buttons must exist
  const next2=$("#wzNext2");
  if(!next2) throw new Error("crew step missing (no #wzNext2)");
  // like a sane player: pick affordable cards, not the priciest names on the market
  const byFee = els => els.slice().sort((a,b)=>{
    const f=id=>window.eval("actorFee(G.talent.find(t=>t.id==="+id+"))");
    return f(+a.dataset.wr||+a.dataset.pd||+a.dataset.dir||+a.dataset.cast)-f(+b.dataset.wr||+b.dataset.pd||+b.dataset.dir||+b.dataset.cast);
  });
  const cash=g().studio.cash;
  const wrs=byFee($$("[data-wr]")); if(wrs.length && window.eval("actorFee(G.talent.find(t=>t.id==="+(+wrs[0].dataset.wr)+"))") < cash*0.06) click(wrs[0]);
  const pds=byFee($$("[data-pd]")); if(pds.length && window.eval("actorFee(G.talent.find(t=>t.id==="+(+pds[0].dataset.pd)+"))") < cash*0.08) click(pds[0]);
  click($("#wzNext2"));
  if(!$$("[data-dir]").length) throw new Error("director picker empty");
  const dirs=byFee($$("[data-dir]"));
  click(dirs[0]);
  if(!$$("[data-cast]").length) throw new Error("cast picker empty");
  const casts=byFee($$("[data-cast]"));
  if(casts.length<3) errors.push("expected 3 cast picks possible");
  let spent=0; for(let i=0;i<Math.min(3,casts.length);i++){
    const id=casts[i].dataset.cast;
    const fee=window.eval("actorFee(G.talent.find(t=>t.id==="+id+"))");
    if(spent+fee > g().studio.cash*0.25) break; // don't blow the down payment on stars
    spent+=fee; click(casts[i]);
  }
  click($("#wzNext"));
  if(!$("#wzBudget")) throw new Error("budget slider missing");
  if(!$$("[data-plan]").length) throw new Error("distribution plan picker missing");
  click($$("[data-plan]").find(b=>b.dataset.plan==="later"));
  if(!$("#wzPresale")) throw new Error("presales toggle missing");
  click($("#wzPresale"));
  click($$("[data-plan]").find(b=>b.dataset.plan==="theatrical"));
  click($("#wzGo"));
  if(!g() || g().projects.length<1) throw new Error("project not created");
  const pr=g().projects[0];
  if(!("writer" in pr) || !("producer" in pr)) throw new Error("crew fields missing on project");
});
step("genre trends exist and are sane", ()=>{
  const G2=g();
  if(!G2.trends) throw new Error("no trends on state");
  const vals=Object.values(G2.trends);
  if(!vals.length || !vals.every(v=>Number.isFinite(v) && v>0.3 && v<1.8)) throw new Error("trend values broken");
});

step("fast-forward to ready", ()=>{
  for(let i=0;i<60 && g(); i++){
    click($("#btnFast"));
    if(g().pendingChoice){ const b=$$("[data-ch]")[0]; if(b) click(b); }
    if(g().pendingReport){ const b=$$(".modal-actions .btn").pop(); if(b) click(b); }
    if(g().projects.some(p=>p.phase==="ready") || g().films.length>0) break;
  }
  if(!g().projects.some(p=>p.phase==="ready") && !g().films.length) throw new Error("never ready");
});
step("schedule release via modal", ()=>{
  // a real player bridges the P&A down payment with the credit facility if needed
  window.eval("if(G.studio.cash < 30 && G.studio.debt < maxDebt()-100) takeLoan(120)");
  click($(".tab[data-tab='productions']"));
  const btn=$$("[data-sched]")[0];
  if(!btn) throw new Error("no sched button (maybe already released)");
  click(btn);
  const rows=$$("[data-w]"); if(!rows.length) throw new Error("calendar empty");
  click(rows[rows.length-1]);
  click($("#scGo"));
  if(!g().projects.some(p=>p.releaseWeek>0)) throw new Error("not scheduled");
});
step("run to release + theatrical", ()=>{
  for(let i=0;i<40 && g(); i++){
    click($("#btnFast"));
    if(g().pendingChoice){ const b=$$("[data-ch]")[0]; if(b) click(b); }
    if(g().pendingReport){ const b=$$(".modal-actions .btn").pop(); if(b) click(b); }
    if(g().films.some(f=>f.inTheaters)) break;
  }
  if(!g().films.some(f=>f.inTheaters)) throw new Error("never hit theaters");
});
step("box office view shows film in theaters section", ()=>{
  click($(".tab[data-tab='boxoffice']"));
  if(!$("#view").innerHTML.includes("Your films in theaters")) throw new Error("section missing");
});
step("empire tab renders", ()=>{
  click($(".tab[data-tab='empire']"));
  if(!$("#view").innerHTML.includes("Franchises")) throw new Error("empire header missing");
});
step("finance shows live P&L", ()=>{
  click($(".tab[data-tab='finance']"));
  if(!$("#view").innerHTML.includes("This week") || !$("#view").innerHTML.includes("P&amp;L")) throw new Error("P&L card missing");
});
step("shop a finished film to streamers (auction modal)", ()=>{
  window.eval(`G.projects.push({id:9871, kind:"film", title:"Neon X", genre:"scifi", scale:"mid", script:72, budget:40, spent:40, devCost:5, director:null, cast:[], phase:"ready", phaseWeek:0, phaseLen:{pre:1,shoot:1,post:1}, releaseWeek:0, marketing:0, marketingPaid:0, quality:{overall:78,critic:80,aud:82}, buzzBonus:0})`);
  click($(".tab[data-tab='productions']"));
  const btn=$$("[data-shop]").find(b=>+b.dataset.shop===9871);
  if(!btn) throw new Error("shop button missing on ready film");
  click(btn);
  if(!$$("[data-bid]").length) throw new Error("auction bids missing");
  click($$("[data-bid]")[0]);
  const sold=window.eval("G.films.find(f=>f.id===9871)");
  if(!sold || !sold.streamingOriginal || !sold.soldTo) throw new Error("auction sale failed");
});
step("empire actions (franchise + merch + game)", ()=>{
  window.eval(`upsertFranchise({franchiseName:"Neon X Saga", title:"Neon X", genre:"scifi", ww:600})`);
  click($(".tab[data-tab='empire']"));
  if(!$$("[data-fr-merch]").length) throw new Error("merch button missing");
  click($$("[data-fr-merch]")[0]);
  const fr=window.eval("G.franchises[G.franchises.length-1]");
  if(!fr || fr.merch<1) throw new Error("merch upgrade failed");
  if(!$$("[data-fr-game]").length) throw new Error("game license button missing");
  click($$("[data-fr-game]")[0]);
  if(!$$("[data-fr-seq]").length) throw new Error("sequel button missing");
});
step("finance view + sliders", ()=>{
  click($(".tab[data-tab='finance']"));
  if(!$("#fnLoan")) throw new Error("loan slider missing");
});
step("series pitch wizard", ()=>{
  click($(".tab[data-tab='develop']"));
  click($("#btnPitchSeries"));
  if(!$$("[data-g]").length) throw new Error("genre chips missing");
  const sr=$$("[data-sr]")[0]; if(!sr) throw new Error("no showrunner");
  click(sr);
  if(!$("#szPitch")) throw new Error("pitch button missing");
  click($("#szPitch"));
});
step("ott view", ()=>{
  click($(".tab[data-tab='ott']"));
  if(!$("#view").innerHTML.includes("The platforms")) throw new Error("platforms missing");
});
step("save exists in localStorage", ()=>{
  const raw = window.localStorage.getItem("bow_save");
  if(!raw) throw new Error("no save");
  const j = JSON.parse(raw);
  if(!j.studio || !j.studio.name) throw new Error("save malformed");
});
step("loadGame roundtrip", ()=>{
  const g = window.eval("loadGame()");
  if(!g || g.studio.name!=="Test Studio") throw new Error("loadGame failed");
});
step("v1 save migrates without breaking", ()=>{
  // simulate an old (v1) save: no trends, no careers, no crew fields
  const j = JSON.parse(window.localStorage.getItem("bow_save"));
  delete j.v; delete j.trends;
  j.talent.forEach(t=>{ delete t.careerWeeks; delete t.retireAt; delete t.faded; delete t.lastWork; delete t.spawnWeek; });
  (j.projects||[]).forEach(p=>{ delete p.writer; delete p.producer; delete p.overruns; delete p.franchiseBoost; });
  window.localStorage.setItem("bow_save", JSON.stringify(j));
  const g = window.eval("loadGame()");
  if(!g) throw new Error("migration returned null");
  if(g.v<2) throw new Error("not upgraded to v2");
  if(!g.trends || !Number.isFinite(Object.values(g.trends)[0])) throw new Error("trends not initialized by migration");
  if(g.talent.some(t=>!Number.isFinite(t.careerWeeks)||!Number.isFinite(t.retireAt))) throw new Error("careers not backfilled");
  if((g.projects||[]).some(p=>p.overruns===undefined)) throw new Error("project fields not backfilled");
  window.eval("saveGame()");
});
step("corrupt save is rejected cleanly", ()=>{
  window.localStorage.setItem("bow_save", "{not json !!");
  const g = window.eval("loadGame()");
  if(g) throw new Error("corrupt save should return null");
  window.localStorage.setItem("bow_save", JSON.stringify({hello:1}));
  const g2 = window.eval("loadGame()");
  if(g2) throw new Error("foreign blob should return null");
  window.eval("saveGame()"); // restore the good save
});
step("run 30 more weeks stays stable", ()=>{
  for(let i=0;i<30 && g(); i++){
    click($("#btnFast"));
    if(g().pendingChoice){ const b=$$("[data-ch]")[0]; if(b) click(b); }
    if(g().pendingReport){ const b=$$(".modal-actions .btn").pop(); if(b) click(b); }
  }
  if(!g() || !Number.isFinite(g().studio.cash)) throw new Error("cash not finite");
});

console.log("");
if(errors.length){ console.log("ERRORS:"); errors.forEach(e=>console.log(" -", e)); process.exit(1); }
console.log("UI TEST PASSED ✅");
