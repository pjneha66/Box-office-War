import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs"; import path from "path";
const ROOT="/Users/poshstudio/Box-office-War";
const read=(f)=>fs.readFileSync(path.join(ROOT,f),"utf8");
const tab=process.argv[2]||"studio", weeks=+(process.argv[3]||0);
let html=read("index.html")
  .replace(/<link rel="stylesheet" href="style.css">/, ()=>"<style>"+read("style.css")+"</style>")
  .replace(/<script src="data.js"><\/script>/, ()=>"<script>"+read("data.js")+"<\/script>")
  .replace(/<script src="engine.js"><\/script>/, ()=>"<script>"+read("engine.js")+"<\/script>")
  .replace(/<script src="i18n.js"><\/script>/, ()=>"<script>"+read("i18n.js")+"<\/script>")
  .replace(/<script src="ui.js"><\/script>/, ()=>"<script>"+read("ui.js")+"<\/script>")
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/, "");
const vc=new VirtualConsole(); const errs=[];
vc.on("jsdomError", e=>errs.push(e.message));
const dom=new JSDOM(html,{runScripts:"dangerously",url:"http://localhost/",pretendToBeVisual:true,virtualConsole:vc});
const {window}=dom; window.AudioContext=undefined;
await new Promise(r=>setTimeout(r,250));
window.eval("render=function(){_renderImpl();}; try{confetti=function(){};}catch(e){}");
window.eval('newGame("producer","Meridian Pictures"); enterApp(false); try{closeModal();}catch(e){}');
for(let i=0;i<weeks;i++) window.eval('try{doWeek(1);}catch(e){} try{closeModal();}catch(e){} try{ if(G.pendingChoice)G.pendingChoice=null; if(G.pendingAuction&&!G.pendingAuction.manual)G.pendingAuction=null; if(G.pendingSports)G.pendingSports=null; if(G.pendingDeepfake)G.pendingDeepfake=null; if(G.pendingEarnings)G.pendingEarnings=null; if(G.pendingReport)G.pendingReport=null; G.studio.cash=Math.max(G.studio.cash,320);}catch(e){}');
window.eval(`G.studio.cash=780; G.studio.rep=Math.max(G.studio.rep,54); G.week=Math.max(G.week,120);
G.franchises=[{id:1,name:"Meridian",genre:"action",tier:3,merch:3,park:1,toys:true,decay:0.86,fatigue:0.12,ww:612,earned:210,createdWeek:3,publishing:true,comics:2,podcast:true}];
G.store={level:2,launchedWeek:40};
G.gamesDiv={unlocked:true,projects:[{id:1,title:"Meridian: Frontline",dev:"aaa",devName:"Ironclad",weeksLeft:9,weeks0:26,weekly:1.4,spent:36,power:82,platform:"console"}],released:[{id:2,title:"Paper Kingdoms Online",platform:"pc",score:83,earned:64,weekly:1.8,weeksLeft:6,when:G.week-6}]};
G.label={unlocked:true,artists:[{id:"nova",name:"NOVA REYES",heat:3,chartUntil:G.week+10}]};
G.streamer={name:"Meridian+",subs:14.2,churn:0.009,income:6.4,sportsPower:2,totalRev:210,tier:"ads",history:[]};
for(var i=0;i<12;i++) G.streamer.history.push({w:G.week-11+i,subs:8.5+i*0.5});
G.hq={backlot:true,sound:true}; G.upgrades={marketing:true,vfx:true};
G.trendHist={}; Object.keys(DATA.GENRES).forEach(function(g){ G.trendHist[g]=[0.9,0.95,1.02,1.08,1.12]; });
G.ideas=G.ideas.slice(0,8);`);
window.eval("try{closeModal();}catch(e){}");
window.eval(`switchTab(${JSON.stringify(tab)}); render();`);
window.eval('try{var t=document.getElementById("toasts"); if(t) t.innerHTML="";}catch(e){}');
const body=window.document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g,"").replace(/<div id="toasts"[^>]*>[\s\S]*$/,"");
fs.writeFileSync(`/tmp/shot_${tab}.html`,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`+
  `<style>${read("style.css")}</style>`+
  `<style>*,*::before,*::after{animation-delay:0s !important;animation-duration:.001s !important;transition:none !important}</style>`+
  `</head><body>${body}</body></html>`);
console.log("shot", tab, window.eval("G.week"), errs.length? "ERR "+errs[0] : "clean");
