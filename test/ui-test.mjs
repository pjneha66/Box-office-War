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
  .replace(/<script src="i18n.js"><\/script>/, () => "<script>"+fs.readFileSync(path.join(ROOT,"i18n.js"),"utf8")+"<\/script>")
  .replace(/<script src="ui.js"><\/script>/, () => "<script>"+fs.readFileSync(path.join(ROOT,"ui.js"),"utf8")+"<\/script>")
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/, ""); // no service worker in jsdom

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

const dismissSideModals = () => {
  // like a focused player mid-sprint: decline passively raised auctions, stall deepfakes, skip sports auctions
  if(g().pendingAuction){ const nb=$("#aucNo"); if(nb) click(nb); }
  if(g().pendingDeepfake){ const df=$("#dfDefer"); if(df) click(df); }
  if(g().pendingSports){ const sk=$("#sportsSkip"); if(sk) click(sk); }
};

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
      return est <= g().studio.cash*0.45;
    });
    if(!btn) click($("#btnWeek"));
  }
  if(!btn) throw new Error("no affordable idea found");
  click(btn);
  if(!$$("[data-writer]").length && !$("#wzSkipWriter")) throw new Error("writer step missing");
});
step("attach writer (v4)", ()=>{
  const w=$$("[data-writer]")[0];
  if(w){ click(w); if(!window.eval("WZ.writer")) throw new Error("writer not attached"); click($("#wzNext")); }
  else click($("#wzSkipWriter"));
  if(!$$("[data-dir]").length) throw new Error("director picker empty");
});
step("pick director + cast + producer + confirm", ()=>{
  click($$("[data-dir]")[0]);
  click($("#wzNext"));
  if(!$$("[data-cast]").length) throw new Error("cast picker empty");
  click($$("[data-cast]")[0]);
  click($$("[data-cast]")[1]||$$("[data-cast]")[0]);
  click($$("[data-cast]")[2]||$$("[data-cast]")[0]);
  if($$("[data-cast]").length<3) errors.push("expected 3 cast picks possible");
  click($("#wzNext"));
  const prod=$$("[data-prod]")[0];
  if(prod){ click(prod); if(!window.eval("WZ.producer")) throw new Error("producer not attached"); }
  click($("#wzNext"));
  if(!$("#wzBudget")) throw new Error("budget slider missing");
  if(!$$("[data-plan]").length) throw new Error("distribution plan picker missing");
  click($$("[data-plan]").find(b=>b.dataset.plan==="later"));
  if(!$("#wzPresale")) throw new Error("presales toggle missing");
  click($("#wzPresale"));
  click($$("[data-plan]").find(b=>b.dataset.plan==="theatrical"));
  click($("#wzGo"));
  if(!g() || g().projects.length<1) throw new Error("project not created");
});

step("fast-forward to ready", ()=>{
  for(let i=0;i<60 && g(); i++){
    click($("#btnFast"));
    if(g().pendingChoice){ const b=$$("[data-ch]")[0]; if(b) click(b); }
    if(g().pendingReport){ const b=$$(".modal-actions .btn").pop(); if(b) click(b); }
    dismissSideModals();
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
  // like a real player: if the P&A down payment is out of reach, bridge it with a loan
  window.eval("if(G.studio.cash < 40) takeLoan(60)");
  click($("#scGo"));
  if(!g().projects.some(p=>p.releaseWeek>0)) throw new Error("not scheduled");
});
step("run to release + theatrical", ()=>{
  for(let i=0;i<40 && g(); i++){
    click($("#btnFast"));
    if(g().pendingChoice){ const b=$$("[data-ch]")[0]; if(b) click(b); }
    if(g().pendingReport){ const b=$$(".modal-actions .btn").pop(); if(b) click(b); }
    dismissSideModals();
    if(g().films.some(f=>f.inTheaters)) break;
  }
  if(!g().films.some(f=>f.inTheaters)) throw new Error("never hit theaters");
});
step("box office view shows film in theaters section", ()=>{
  click($(".tab[data-tab='boxoffice']"));
  if(!$("#view").innerHTML.includes("Your films in theaters")) throw new Error("section missing");
});
step("v4 named critics reviewed the release", ()=>{
  const f=g().films.find(x=>x.reviews && x.reviews.length);
  if(!f) throw new Error("no film carries reviews");
  if(!Number.isFinite(f.criticAvg)) throw new Error("no critic consensus");
  const btn=$$("[data-reviews]")[0];
  if(!btn) throw new Error("reviews button missing");
  click(btn);
  if(!$(".review-card")) throw new Error("review cards missing in modal");
  window.eval("closeModal()");
});
step("v4 genre trend board renders in Develop", ()=>{
  click($(".tab[data-tab='develop']"));
  if(!$(".trend-board")) throw new Error("trend board missing");
  if($$(".trend-row").length !== Object.keys(window.eval("DATA.GENRES")).length) throw new Error("trend rows incomplete");
  if(!$("#view").innerHTML.includes("Writers on the market")) throw new Error("writer market missing");
  if(!$("#view").innerHTML.includes("Producers on the market")) throw new Error("producer market missing");
});
step("v4 streamer tiers + password crackdown state", ()=>{
  window.eval("G.studio.rep=Math.max(G.studio.rep,45); G.studio.cash=Math.max(G.studio.cash,700); launchStreamer(); render();");
  click($(".tab[data-tab='ott']"));
  const t=$$("[data-tier]")[0];
  if(!t) throw new Error("tier switch missing");
  click(t);
  if(g().streamer.tier!=="ads") throw new Error("tier did not switch");
});
step("v4 IPO, stock panel and earnings call", ()=>{
  window.eval("G.studio.rep=70; G.studio.cash=Math.max(G.studio.cash,300); goPublic(); render();");
  click($(".tab[data-tab='finance']"));
  if(!$(".stock-spark")) throw new Error("stock sparkline missing");
  if(!$("#fnSec")) throw new Error("secondary offering control missing");
  window.eval("earningsCall()");
  window.eval("earningsModal()");
  if(!$("#view")) throw new Error("view gone");
  window.eval("closeModal()");
  if(!Number.isFinite(g().public.price)) throw new Error("share price not finite");
});
step("v4 share-your-studio card", ()=>{
  click($(".tab[data-tab='studio']"));
  const b=$("#btnShareCard");
  if(!b) throw new Error("share card button missing");
  const data=window.eval("studioCardData()");
  if(!data || !data.rows || data.rows.length<8) throw new Error("card data incomplete");
});
step("v4 save schema is versioned and migrates", ()=>{
  window.eval("saveGame()");
  const raw=window.localStorage.getItem("bow_save");
  const j=JSON.parse(raw);
  if(j.v!==window.eval("DATA.SAVE_VERSION")) throw new Error("save not stamped");
  const legacy=JSON.parse(raw); legacy.v=1; delete legacy.trends;
  const migrated=window.eval("migrateSave")(legacy);
  if(!migrated.save.trends) throw new Error("migration failed");
  if(window.eval("validateSave")({}).length===0) throw new Error("validator too permissive");
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
step("v2 start options were on the start screen", ()=>{
  const rawHtml = html;
  if(!rawHtml.includes("startOptions")) throw new Error("startOptions container missing");
});
step("v2 scenario/difficulty/sandbox/slots render at boot", ()=>{
  // reload-free check: the game started via defaults (standard/normal/slot 1)
  const j = JSON.parse(window.localStorage.getItem("bow_save"));
  if(j.scenario!=="standard" || j.difficulty!=="normal" || j.slot!==1) throw new Error("meta not saved: "+JSON.stringify([j.scenario,j.difficulty,j.slot]));
});
step("v2 achievements modal opens", ()=>{
  click($(".tab[data-tab='studio']"));
  const btn=$("#btnAch"); if(!btn) throw new Error("achievements button missing");
  click(btn);
  if(!window.document.querySelector(".modal")) throw new Error("ach modal not open");
  click(window.document.querySelector(".modal-actions .btn"));
});
step("v2 settings modal + Hindi toggle + back to English", ()=>{
  click($("#btnSettings"));
  if(!window.document.querySelector(".modal")) throw new Error("settings modal not open");
  const hi=[...window.document.querySelectorAll(".modal .btn")].find(b=>b.textContent.includes("हिन्दी"));
  if(!hi) throw new Error("hindi button missing");
  click(hi);
  if(window.localStorage.getItem("bow_lang")!=="hi") throw new Error("lang not persisted");
  if(!$("#btnWeek").textContent.includes("अगला")) throw new Error("chrome not translated: "+$("#btnWeek").textContent);
  click($("#btnSettings"));
  const en=[...window.document.querySelectorAll(".modal .btn")].find(b=>b.textContent.trim()==="English");
  click(en);
  if(!$("#btnWeek").textContent.toLowerCase().includes("next")) throw new Error("chrome not back in english");
  click([...window.document.querySelectorAll(".modal-actions .btn")].pop());
});
step("v2 executives hire", ()=>{
  click($(".tab[data-tab='finance']"));
  window.eval("G.studio.cash=400");
  click($(".tab[data-tab='finance']"));
  const btn=$$("[data-exec]")[0]; if(!btn) throw new Error("exec buttons missing");
  click(btn);
  if(!Object.keys(g().execs).length) throw new Error("exec not hired");
});
step("v3 streamer launch + library move", ()=>{
  window.eval("G.studio.cash=400; G.studio.rep=55; launchStreamer('TestStream')");
  if(!g().streamer) throw new Error("streamer not launched");
  click($(".tab[data-tab='ott']"));
  if(!$("#view").innerHTML.includes("TestStream")) throw new Error("streamer card missing");
});
step("v3 IP market renders & buys", ()=>{
  click($(".tab[data-tab='develop']"));
  if(!$$("[data-ip]").length) throw new Error("IP market items missing");
  window.eval("G.studio.cash=200");
  const before=g().ideas.length;
  click($$("[data-ip]")[0]);
  if(g().ideas.length<=before) throw new Error("IP buy did not add an idea");
});
step("v2 rewrite / test-screening flows", ()=>{
  // fabricate a pre-production project and a ready project
  window.eval(`G.projects.push({id:9872, kind:"film", title:"Rewrite Me", genre:"drama", scale:"indie", script:60, budget:10, spent:1, devCost:2, director:null, cast:[], phase:"pre", phaseWeek:0, phaseLen:{pre:3,shoot:4,post:4}, releaseWeek:0, marketing:0, marketingPaid:0, buzzBonus:0, location:"atlanta", rating:"R"})`);
  window.eval(`G.projects.push({id:9873, kind:"film", title:"Screen Me", genre:"drama", scale:"indie", script:60, budget:10, spent:10, devCost:2, director:null, cast:[], phase:"ready", phaseWeek:0, phaseLen:{pre:1,shoot:1,post:1}, releaseWeek:0, marketing:0, marketingPaid:0, buzzBonus:0, quality:{overall:52,critic:50,aud:55}})`);
  click($(".tab[data-tab='productions']"));
  const rw=$$("[data-rewrite]").find(b=>+b.dataset.rewrite===9872);
  if(!rw) throw new Error("rewrite button missing");
  click(rw);
  const p1=g().projects.find(x=>x.id===9872);
  if(!p1.rewritten || p1.script<=60) throw new Error("rewrite did not apply");
  const sc=$$("[data-screen]").find(b=>+b.dataset.screen===9873);
  if(!sc) throw new Error("screening button missing");
  click(sc);
  if(!window.document.querySelector(".modal")) throw new Error("screening modal not open");
  click(window.document.querySelector(".modal-actions .btn"));
  const rs=$$("[data-reshoot]").find(b=>+b.dataset.reshoot===9873);
  if(!rs) throw new Error("reshoot button missing (quality 52)");
  click(rs);
  const p2=g().projects.find(x=>x.id===9873);
  if(!p2.reshoot) throw new Error("reshoot did not apply");
});
step("run 30 more weeks stays stable", ()=>{
  for(let i=0;i<30 && g(); i++){
    if(g().sportsAuction){ const sk=$$("#sportsSkip")[0]||window.document.querySelector("#sportsSkip"); if(sk){ click(sk); } }
    click($("#btnFast"));
    if(g().pendingChoice){ const b=$$("[data-ch]")[0]; if(b) click(b); }
    if(g().pendingReport){ const b=$$(".modal-actions .btn").pop(); if(b) click(b); }
    dismissSideModals();
  }
  if(!g() || !Number.isFinite(g().studio.cash)) throw new Error("cash not finite");
});

console.log("");
if(errors.length){ console.log("ERRORS:"); errors.forEach(e=>console.log(" -", e)); process.exit(1); }
console.log("UI TEST PASSED ✅");
