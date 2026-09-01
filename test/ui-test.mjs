/* UI integration test — requires jsdom:  npm i jsdom  (run from this folder or anywhere: node test/ui-test.mjs)
   Boots the real index.html + scripts, then plays like a human: founds a studio, greenlights a film,
   dates the release, rides the theatrical run, pitches a series, checks save/load. */
// eslint-disable-next-line no-unused-vars
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
  const cards=$$("[data-dev]"); if(!cards.length) throw new Error("no idea cards");
  // pick an affordable one like a real player (indie/mid)
  let btn=cards.find(c => (g().ideas.find(i=>i.id===+c.dataset.dev)||{}).scale!=="tentpole") || cards[0];
  click(btn);
  if(!$$("[data-dir]").length) throw new Error("director picker empty");
});
step("pick director + cast + confirm", ()=>{
  click($$("[data-dir]")[0]);
  if(!$$("[data-cast]").length) throw new Error("cast picker empty");
  click($$("[data-cast]")[0]);
  click($$("[data-cast]")[1]||$$("[data-cast]")[0]);
  click($$("[data-cast]")[2]||$$("[data-cast]")[0]);
  if($$("[data-cast]").length<3) errors.push("expected 3 cast picks possible");
  click($("#wzNext"));
  if(!$("#wzBudget")) throw new Error("budget slider missing");
  click($("#wzGo"));
  if(!g() || g().projects.length<1) throw new Error("project not created");
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
