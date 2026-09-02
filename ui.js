/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — ui.js (rendering + interaction)  [v3 build]
   ═══════════════════════════════════════════════════════════ */
"use strict";

let TAB = "studio";
let WZ = null;          // greenlight/pitch wizard state
let SCHEDULE = null;    // release scheduling state
let SOUND = true;
let AUTO = null;        // auto-play interval
let SEL = { scenario:"standard", difficulty:"normal", sandbox:false, slot:1 };

/* ═══════════ tiny sound ═══════════ */
let AC = null;
function beep(kind){
  if(!SOUND) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    const seq = {click:[[660,.05]], cash:[[520,.06],[780,.09]], good:[[520,.05],[660,.05],[880,.12]],
                 bad:[[220,.14],[160,.18]], gold:[[660,.06],[880,.06],[1100,.14]]}[kind]||[[600,.05]];
    let t=AC.currentTime;
    for(const [f,d] of seq){
      const o=AC.createOscillator(), g=AC.createGain();
      o.type="sine"; o.frequency.value=f;
      g.gain.setValueAtTime(.08,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
      o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t+d+.02); t+=d;
    }
  }catch(e){}
}

/* ═══════════ helpers ═══════════ */
const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
function esc(s){ return String(s).replace(/[&<>\"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function stars(n){ let s=""; for(let i=1;i<=5;i++) s+= i<=n? "★":"<span class='off'>★</span>"; return "<span class='stars'>"+s+"</span>"; }
function meter(v, max, cls){ return "<div class='bar'><i style='width:"+clamp(v/max*100,2,100)+"%"+(cls?";background:"+cls:"")+"'></i></div>"; }
function gTag(genre){ const g=DATA.genreOf(genre); return "<span class='tag blue'>"+g.emoji+" "+g.name+"</span>"; }
function scoreBadge(q){
  if(q>=80) return "<span class='tag green'>"+q+" · Acclaimed</span>";
  if(q>=60) return "<span class='tag gold'>"+q+" · Solid</span>";
  if(q>=40) return "<span class='tag'>"+q+" · Mixed</span>";
  return "<span class='tag red'>"+q+" · Panned</span>";
}
function toast(t,k){ 
  const d=document.createElement("div"); d.className="toast "+(k||""); d.textContent=t;
  $("#toasts").appendChild(d); setTimeout(()=>d.remove(), 5200);
}
function flashes(list){ (list||[]).forEach(f=>toast(f.t, f.k)); }

/* ═══════════ modal ═══════════ */
function openModal(html, opts){
  opts=opts||{};
  closeModal();
  const veil=document.createElement("div"); veil.className="modal-veil";
  veil.innerHTML="<div class='modal'>"+(opts.noX?"":"<div class='modal-head'><div></div><button class='modal-x'>✕</button></div>")+html+"</div>";
  if(!opts.noX) veil.querySelector(".modal-x").onclick=()=>{ closeModal(); if(opts.onClose) opts.onClose(); };
  if(!opts.locked) veil.addEventListener("click", e=>{ if(e.target===veil){ closeModal(); if(opts.onClose) opts.onClose(); } });
  $("#modalRoot").appendChild(veil);
  return veil;
}
function closeModal(){ $("#modalRoot").innerHTML=""; }

/* ═══════════ boot ═══════════ */
window.addEventListener("DOMContentLoaded", ()=>{
  // start screen
  const names=["Parallax Pictures","Lighthouse Films","Meridian Studios","Blackwater Pics","Golden Hour Entertainment","Astra House"];
  const sug=$("#nameSuggests");
  names.slice(0,4).forEach(n=>{ const b=document.createElement("button"); b.textContent=n;
    b.onclick=()=>{ $("#studioName").value=n; beep("click"); }; sug.appendChild(b); });
  $("#studioName").value=names[rint(0,names.length-1)];
  let archSel=DATA.ARCHETYPES[1].id;
  const al=$("#archList");
  DATA.ARCHETYPES.forEach(a=>{
    const d=document.createElement("div"); d.className="arch"+(a.id===archSel?" sel":"");
    d.innerHTML="<h4>"+a.name+"</h4><div class='a-sub'>"+a.sub+"</div><div class='a-stats'>"+
      "<span class='tag gold'>💰 "+fmtM(a.cash)+"</span><span class='tag blue'>⭐ rep "+a.rep+"</span><span class='tag'>🧾 $"+a.overhead+"M/wk overhead</span></div>";
    d.onclick=()=>{ archSel=a.id; $$(".arch").forEach(x=>x.classList.remove("sel")); d.classList.add("sel"); beep("click"); };
    al.appendChild(d);
  });
  buildStartOptions();
  if(hasSave()) $("#btnContinue").style.display="block";
  $("#btnContinue").onclick=()=>{ const g=loadGame(); if(g){ enterApp(); } };
  $("#btnStart").onclick=()=>{
    const nm=($("#studioName").value||"Parallax Pictures").trim().slice(0,26);
    newGame(archSel, nm, {scenario:SEL.scenario, difficulty:SEL.difficulty, sandbox:SEL.sandbox, slot:SEL.slot});
    enterApp(true);
  };
  // topbar
  $("#btnWeek").onclick=()=>{ doWeek(1); };
  $("#btnFast").onclick=()=>{ doWeek(4); };
  $("#btnSound").onclick=()=>{ SOUND=!SOUND; localStorage.setItem("bow_snd", SOUND?"1":"0");
    $("#btnSound").textContent=SOUND?"🔊":"🔇"; beep("click"); };
  SOUND = localStorage.getItem("bow_snd")!=="0"; $("#btnSound").textContent=SOUND?"🔊":"🔇";
  $("#btnHelp").onclick=()=>helpModal();
  $("#btnSettings").onclick=()=>settingsModal();
  $("#btnAuto").onclick=()=>toggleAuto();
  // tabs
  $$(".tab,.btab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  // long-press fast on mobile
  let lp=null;
  $("#btnWeek").addEventListener("touchstart",()=>{ lp=setTimeout(()=>{ doWeek(4); lp="done"; },600); },{passive:true});
  $("#btnWeek").addEventListener("touchend",()=>{ if(lp&&lp!=="done"){clearTimeout(lp);} lp=null; });
  // v2 text size
  try{ const fs=localStorage.getItem("bow_font"); if(fs) document.documentElement.style.fontSize=fs; }catch(e){}
  applyChromeLang();
});
/* v2: scenarios, difficulty, sandbox, 3 save slots on the start screen */
function buildStartOptions(){
  const wrap=$("#startOptions"); if(!wrap) return;
  let h="<label class='field-label' id='fieldScenario'>"+t("start.scenario")+"</label><div class='scen-row'>";
  Object.keys(DATA.SCENARIOS).forEach(id=>{
    const s=DATA.SCENARIOS[id];
    h+="<div class='scen"+(SEL.scenario===id?" sel":"")+"' data-scen='"+id+"'><h4>"+s.emoji+" "+s.name+"</h4><div class='a-sub'>"+s.desc+"</div></div>";
  });
  h+="</div><label class='field-label' id='fieldDifficulty'>"+t("start.difficulty")+"</label><div class='row'>";
  Object.keys(DATA.DIFFICULTIES).forEach(id=>{
    const d=DATA.DIFFICULTIES[id];
    h+="<button class='btn btn-sm diff"+(SEL.difficulty===id?" btn-primary":"")+"' data-diff='"+id+"' title='"+d.desc+"'>"+d.emoji+" "+d.name+"</button>";
  });
  h+="<label class='sandbox-lbl'><input type='checkbox' id='chkSandbox'"+(SEL.sandbox?" checked":"")+"> "+t("start.sandbox")+"</label></div>";
  h+="<label class='field-label'>"+t("start.slot")+"</label><div class='row' id='slotRow'>";
  for(let n=1;n<=3;n++){
    const m=slotMeta(n);
    h+="<button class='btn btn-sm slot"+(SEL.slot===n?" btn-primary":"")+"' data-slot='"+n+"'>Slot "+n+(m? " · "+esc(m.name)+" · "+dateLabel(m.week):" · empty")+"</button>";
  }
  h+="</div>";
  wrap.innerHTML=h;
  $$("[data-scen]").forEach(el=>el.onclick=()=>{ SEL.scenario=el.dataset.scen; beep("click"); buildStartOptions(); });
  $$("[data-diff]").forEach(el=>el.onclick=()=>{ SEL.difficulty=el.dataset.diff; beep("click"); buildStartOptions(); });
  const chk=$("#chkSandbox"); if(chk) chk.onchange=()=>{ SEL.sandbox=chk.checked; };
  $$("[data-slot]").forEach(el=>el.onclick=()=>{ SEL.slot=+el.dataset.slot; beep("click"); buildStartOptions(); });
}
function enterApp(fresh){
  $("#startScreen").style.display="none";
  $("#app").style.display="flex";
  applyChromeLang();
  if(fresh) setTimeout(helpModal, 400);
  render();
  if(G.pendingChoice) choiceModal();
  else if(G.pendingReport) reportModal();
  else if(G.over) gameOverModal();
}
function switchTab(t){
  TAB=t; beep("click");
  $$(".tab,.btab").forEach(b=>b.classList.toggle("active", b.dataset.tab===t));
  render();
}
function doWeek(n){
  if(G.over){ gameOverModal(); return; }
  if(n===1) advanceWeek(); else advanceWeeks(n);
  beep(n===1?"click":"good");
  afterTick();
}
function afterTick(){
  flashes(G.flash);
  render();
  if(G.pendingChoice) choiceModal();
  else if(G.pendingAuction) auctionModal();
  else if(G.sportsAuction) sportsModal();
  else if(G.pendingReport) reportModal();
  else if(G.over) gameOverModal();
  if(AUTO && (G.pendingChoice||G.pendingAuction||G.sportsAuction||G.pendingReport||G.over)) toggleAuto(false);
}
/* v2: auto-play weeks */
function toggleAuto(force){
  const want = (force===undefined)? !AUTO : force;
  if(want && !AUTO){
    AUTO=setInterval(()=>{ if(!G){toggleAuto(false);return;} doWeek(1); },1100);
    $("#btnAuto").classList.add("btn-primary"); $("#btnAuto").textContent=t("btn.autoOn");
  }else if(!want && AUTO){
    clearInterval(AUTO); AUTO=null;
    $("#btnAuto").classList.remove("btn-primary"); $("#btnAuto").textContent=t("btn.auto");
  }
}

/* ═══════════ top chips + render router ═══════════ */
function render(){
  if(!G) return;
  $("#brandName").textContent=G.studio.name;
  $("#chipCash").textContent=fmtM(G.studio.cash);
  $("#chipDebt").textContent=fmtM(G.studio.debt+(G.mezz||0));
  $("#chipDebtWrap").style.display = (G.studio.debt+G.mezz)>0.5? "":"none";
  $("#chipRep").textContent=Math.round(G.studio.rep);
  $("#chipDate").textContent="Y"+yearOf(G.week)+" · "+DATA.seasonOf(woyOf(G.week)).month+" W"+woyOf(G.week);
  const v=$("#view");
  if(TAB==="studio") v.innerHTML=viewStudio();
  else if(TAB==="develop") v.innerHTML=viewDevelop();
  else if(TAB==="productions") v.innerHTML=viewProductions();
  else if(TAB==="boxoffice") v.innerHTML=viewBoxOffice();
  else if(TAB==="ott") v.innerHTML=viewOTT();
  else if(TAB==="empire") v.innerHTML=viewEmpire();
  else if(TAB==="finance") v.innerHTML=viewFinance();
  bindView();
}

/* ═══════════ VIEW: studio ═══════════ */
function viewStudio(){
  const st=G.studio;
  const yr=yearOf(G.week);
  const myYtd=G.films.filter(f=>f.year===yr).reduce((a,f)=>a+(f.ww||0),0);
  const live=activeFilms().length, inProd=inProdProjects().length;
  const lastNet=G.txHistory && G.txHistory.length? G.txHistory[G.txHistory.length-1].net : 0;
  let h="<div class='stat-hero'>"+
    statCard(fmtM(st.cash),t("stat.cash"))+
    statCard((lastNet>=0?"+":"")+fmtM(lastNet),t("stat.lastnet"), lastNet>=0?"var(--green)":"var(--red)")+
    statCard(fmtM(st.debt+(G.mezz||0)),t("stat.debt"),"var(--red)")+
    statCard(Math.round(st.rep)+"/100",t("stat.rep"),"var(--gold2)")+
    statCard(fmtM(catalogValue()),t("stat.catalog"))+
    statCard(G.stats.films,t("stat.films"))+
    statCard(fmtM(G.stats.totalWW),t("stat.ww"))+
  "</div>";
  const scen=DATA.SCENARIOS[G.scenario], diff=DATA.DIFFICULTIES[G.difficulty];
  h+="<div class='card'><div class='row'>"+
    "<span class='tag gold'>"+scen.emoji+" "+scen.name+"</span>"+
    "<span class='tag blue'>"+diff.emoji+" "+diff.name+"</span>"+
    (G.sandbox?"<span class='tag purple'>🧪 sandbox</span>":"")+
    (G.ipo?"<span class='tag green'>🔔 public company</span>":"")+
    (G.streamer?"<span class='tag purple'>🛰 "+esc(G.streamer.name)+" · "+fmtSubs(G.streamer.subs)+" subs</span>":"")+
    (Object.keys(G.ach).length?"<button class='btn btn-sm' id='btnAch'>🏆 "+Object.keys(G.ach).length+"/"+DATA.ACH.length+"</button>":"<button class='btn btn-sm' id='btnAch'>🏆 "+t("ach.title")+"</button>")+
  "</div></div>";
  if(live||inProd||G.series.some(s=>s.phase!=="between"&&s.status!=="ended")){
    h+="<div class='card'><div class='row'>"+
      (live?"<span class='tag gold'>🎥 "+live+" in theaters</span>":"")+
      (inProd?"<span class='tag blue'>🎬 "+inProd+" in production</span>":"")+
      (G.series.filter(s=>s.phase==="shoot").length?"<span class='tag purple'>📺 "+G.series.filter(s=>s.phase==="shoot").length+" series shooting</span>":"")+
      (G.offers.length?"<span class='tag green'>📨 "+G.offers.length+" deal"+(G.offers.length>1?"s":"")+" pending</span>":"")+
    "</div></div>";
  }
  if(G.streamWar>0) h+="<div class='card' style='border-left:3px solid var(--purple)'><b>⚔️ Streaming war</b> — offers +30% for "+G.streamWar+" more weeks.</div>";
  if(G.theaterCap>0) h+="<div class='card' style='border-left:3px solid var(--red)'><b>🦠 Theater capacity limits</b> — box office −45% for "+G.theaterCap+" more weeks.</div>";
  h+=viewAwardsCard();
  h+="<div class='section-title'>"+t("sec.share")+" — Year "+yr+" (worldwide gross)</div><div class='card'>";
  const rows=[{name:G.studio.name, ww:myYtd, me:true}].concat(G.rivals.map(r=>({name:r.name, ww:r.ytd})));
  const max=Math.max(1,...rows.map(r=>r.ww));
  rows.sort((a,b)=>b.ww-a.ww).forEach((r,i)=>{
    h+="<div class='chart-bar' style='margin:5px 0'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(r.me?"⭐ ":"")+esc(r.name)+"</div></div>"+
       "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(6,r.ww/max*100)+"%;background:"+(r.me?"linear-gradient(90deg,#f5b942,#ffd479)":"#4a5570")+"'>"+fmtM(r.ww)+"</div></div></div>";
  });
  h+="</div>";
  h+="<div class='section-title'>"+t("sec.feed")+"</div><div class='newsfeed'>";
  if(!G.news.length) h+="<div class='muted small'>No news yet. Make some.</div>";
  G.news.slice(0,40).forEach(n=>{
    h+="<div class='news-item "+n.k+"'><span class='n-i'>"+n.t.split(" ")[0]+"</span><span>"+esc(n.t.slice(n.t.split(" ")[0].length))+"</span><span class='n-w'>"+dateLabel(n.w)+"</span></div>";
  });
  h+="</div>";
  return h;
}
/* v2: festivals + FYC campaigning live here */
function viewAwardsCard(){
  const woy=woyOf(G.week), yr=yearOf(G.week);
  let h="<div class='card'><div class='spread'><b>"+t("sec.awards")+"</b><span class='tiny muted'>"+DATA.AWARDS+" · week 1 next year</span></div>";
  const nextFest=DATA.FESTIVALS.find(f=>f.woy>=woy)||DATA.FESTIVALS[0];
  h+="<div class='tiny muted' style='margin-top:4px'>🎪 Festivals: "+DATA.FESTIVALS.map(f=>f.emoji+" W"+f.woy).join(" · ")+" — submit finished/ready films for buzz, prizes & momentum. Next: "+nextFest.name+" (W"+nextFest.woy+(nextFest.woy<woy?" next yr":"")+").</div>";
  const wins=G.festWins.filter(w=>w.year===yr);
  if(wins.length) h+="<div class='tiny' style='margin-top:4px'>🏅 This year: "+wins.map(w=>esc(w.film)+" @ "+w.fest).join(" · ")+"</div>";
  if(woy>=44){
    const elig=G.films.filter(f=>f.year===yr && f.quality && f.quality.critic>=60 && !f.fyc);
    if(elig.length){
      h+="<div class='small' style='margin-top:8px'><b>FYC campaigning</b> <span class='tiny muted'>($4M each · weeks 48–52 voting, +awards momentum)</span></div><div class='row' style='margin-top:6px'>";
      elig.slice(0,4).forEach(f=>{ h+="<button class='btn btn-sm btn-alt' data-fyc='"+f.id+"'>🗳 "+esc(f.title)+" · $4M</button>"; });
      h+="</div>";
    }else h+="<div class='tiny muted' style='margin-top:6px'>No eligible unrewarded films for FYC this year.</div>";
  }else{
    h+="<div class='tiny muted' style='margin-top:6px'>FYC campaigns open from week 44.</div>";
  }
  h+="</div>";
  return h;
}
function statCard(v,l,c){ return "<div class='stat'><div class='s-v' style='"+(c?"color:"+c:"")+"'>"+v+"</div><div class='s-l'>"+l+"</div></div>"; }

/* ═══════════ VIEW: develop ═══════════ */
function viewDevelop(){
  let h="";
  h+="<div class='spread'><div class='section-title' style='margin:0'>"+t("sec.market")+"</div>"+
     "<button class='btn btn-sm' id='btnPitchSeries'>📺 Pitch a Series</button></div>";
  // v2: new faces banner
  const cls=G.talent.filter(x=>x.cls===yearOf(G.week));
  if(cls.length) h+="<div class='card' style='border-left:3px solid var(--green)'><b>"+t("sec.newfaces")+" of Year "+yearOf(G.week)+"</b><div class='tiny muted'>"+cls.slice(0,5).map(x=>esc(x.name)+" ("+x.power+"★)").join(" · ")+"</div></div>";
  h+="<div class='grid g2' style='margin-top:8px'>";
  for(const i of G.ideas){
    const S=DATA.SCALES[i.scale];
    h+="<div class='card idea-card'><div class='spread'><h4>"+(DATA.GENRES[i.genre].emoji)+" "+esc(i.title)+"</h4>"+
      (i.hot?"<span class='tag red'>🔥 Hot spec</span>":"")+(i.awareness?"<span class='tag purple'>📚 known IP</span>":"")+(i.crossover?"<span class='tag gold'>💥 crossover</span>":"")+"</div>"+
      "<div class='idea-blurb'>“"+esc(i.blurb)+"”</div>"+
      "<div class='idea-meta'>"+gTag(i.genre)+"<span class='tag'>"+S.emoji+" "+S.name+"</span>"+
      "<span class='tag "+(i.script>=75?"green":i.script>=60?"gold":"")+"'>📝 Script "+i.script+"</span>"+
      (i.awareness?"<span class='tag blue'>👁 awareness +"+Math.round(i.awareness*100)+"%</span>":"")+"</div>"+
      "<div class='row' style='margin-top:10px'><span class='small muted'>Est. budget "+fmtM(neededBudget(i.genre,i.scale))+" · dev rights "+fmtM(devCostOf(i))+"</span></div>"+
      "<button class='btn btn-primary' style='margin-top:10px;width:100%' data-dev='"+i.id+"'>🎬 Develop this</button></div>";
  }
  h+="</div>";
  // v3: IP market
  h+="<div class='section-title'>"+t("sec.ipmarket")+"</div><div class='grid g3'>";
  (G.ipMarket||[]).forEach(it=>{
    const k=DATA.IPKINDS.find(x=>x.id===it.kind);
    h+="<div class='card'><div class='spread'><b>"+k.emoji+" "+esc(it.title)+"</b><span class='tag gold'>"+fmtM(it.price)+"</span></div>"+
      "<div class='tiny muted'>"+k.name+" · "+gTag(it.genre)+" · script +"+it.boost+" · awareness +"+Math.round(it.buzz*100)+"%</div>"+
      "<button class='btn btn-sm btn-primary' style='margin-top:8px' data-ip='"+it.id+"'>Buy rights</button></div>";
  });
  h+="</div>";
  // v3: talent business
  h+="<div class='section-title'>"+t("sec.talentbiz")+"</div><div class='grid g3'>";
  h+="<div class='card'><b>🎫 Wrap deal — $20M</b><div class='tiny muted' style='margin:4px 0 8px'>Next 3 pictures: all talent fees −20%.</div>"+
    (G.wrapDeal>0? "<span class='tag green'>"+G.wrapDeal+" picture(s) left</span>" : "<button class='btn btn-sm btn-alt' id='btnWrap'>Sign wrap deal</button>")+"</div>";
  h+="<div class='card'><b>🖋 Agency exclusive — $30M</b><div class='tiny muted' style='margin:4px 0 8px'>2 years of −15% on every quote.</div>"+
    (G.agencyExcl>G.week? "<span class='tag green'>"+(G.agencyExcl-G.week)+" weeks left</span>" : "<button class='btn btn-sm btn-alt' id='btnAgency'>Sign exclusive</button>")+"</div>";
  h+="<div class='card'><b>🌟 Cameos</b><div class='tiny muted'>While greenlighting, add a superstar cameo for 30% of their fee — +6% buzz.</div></div>";
  h+="</div>";
  h+="<div class='section-title'>"+t("sec.talent")+"</div>";
  const freeA=G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil).sort((a,b)=>b.power-a.power||b.skill-a.skill);
  const freeD=G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil).sort((a,b)=>b.power-a.power||b.skill-a.skill);
  h+="<div class='grid g3'>";
  for(const d of freeD.slice(0,6)) h+=talentCard(d);
  h+="</div><div class='grid g3' style='margin-top:8px'>";
  for(const a of freeA.slice(0,9)) h+=talentCard(a);
  const hidden=freeA.length+freeD.length-15;
  if(hidden>0)h+="<div class='card muted small' style='display:flex;align-items:center;justify-content:center'>+ "+hidden+" more on the market → refreshed weekly</div>";
  h+="</div>";
  return h;
}
function talentCard(tt){
  const fee=actorFee(tt);
  const badges=
    (tt.auteur?"<span class='tag purple'>auteur +5 craft · no sequels</span>":"")+
    (tt.toxic&&!tt.rehabbed?"<span class='tag red'>toxic −7% opens</span>":"")+
    ((tt.pics||0)>=2?"<span class='tag green'>loyal −10%</span>":(tt.pics? "<span class='tag'>"+tt.pics+" pic"+(tt.pics>1?"s":"")+" w/ studio</span>":""))+
    (tt.cls?"<span class='tag blue'>class of Y"+(tt.cls+0)+"</span>":"");
  const rehab=(tt.toxic&&!tt.rehabbed)? "<button class='btn btn-sm btn-danger' data-rehab='"+tt.id+"'>🧘 Rehab $5M</button>":"";
  return "<div class='card talent-card'><div class='t-avatar'>"+(tt.kind==="director"?"🎬":tt.power>=4?"🌟":"🙂")+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(tt.name)+"</div>"+
    "<div>"+stars(tt.power)+"</div>"+
    "<div class='t-stats'>"+(tt.kind==="director"?"Skill "+tt.skill+" · fits "+DATA.GENRES[tt.genreFit].name:"Skill "+tt.skill+" · acting")+
    (tt.heat?" · <span class='gold'>heat ×"+tt.heat+"</span>":"")+"</div>"+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(fee)+" fee</span>"+badges+rehab+"</div></div></div>";
}

/* ── greenlight wizard (film, sequel, spin-off, crossover) ── */
function startWizard(idea){
  WZ={mode:"film", idea, director:null, cast:[], cameo:null, sub:2, budget:Math.round(neededBudget(idea.genre,idea.scale)),
      plan:"theatrical", presales:false, rating:"PG-13", location:"home", foreignLang:false};
  if(idea.scale==="tentpole") WZ.budget=Math.max(WZ.budget, DATA.SCALES.tentpole.bMin);
  if(idea.spinoffFr) WZ.budget=Math.round(neededBudget(idea.genre,idea.scale)*0.45);
  wizardModal();
}
function startSequel(film){
  const idea={ id:nid(), genre:film.genre, scale:film.scale, title:"(sequel)", blurb:"The saga continues…",
    script:clamp((film.quality?film.quality.overall:65)+5,55,95), hot:true, sequelOf:film, awareness:0 };
  WZ={mode:"film", idea, director:null, cast:[], cameo:null, sub:2, seqBudgetFixed:true, budget:Math.round(film.budget*1.3),
      plan:"theatrical", presales:false, rating:"PG-13", location:"home", foreignLang:false};
  wizardModal();
}
function startSpinoff(fr){
  const idea={ id:nid(), genre:DATA.GENRES[fr.genre]?fr.genre:"action", scale:"mid", title:"(spin-off)",
    blurb:"A cheaper ride on the "+fr.name+" heat.", script:rint(55,78), hot:true, spinoffFr:fr, awareness:0 };
  WZ={mode:"film", idea, director:null, cast:[], cameo:null, sub:2, budget:Math.round(neededBudget(idea.genre,"mid")*0.45),
      plan:"theatrical", presales:false, rating:"PG-13", location:"home", foreignLang:false};
  wizardModal();
}
function wizardTitle(){
  if(WZ.idea.title==="(sequel)") return sequelTitle0(WZ);
  if(WZ.idea.title==="(spin-off)") return WZ.idea.spinoffFr.name+": "+DATA.SPINOFF_SUFFIX[0];
  return WZ.idea.title;
}
function wizardModal(){
  const step = WZ.sub;
  let h="<h3>🎬 Greenlight: “"+esc(wizardTitle())+"”</h3>"+
    "<div class='wiz-step'><span class='done'>1 · Script</span><span class='"+(step===2?"on":WZ.director?"done":"")+"'>2 · Director</span><span class='"+(step===3?"on":WZ.cast.length?"done":"")+"'>3 · Cast</span><span class='"+(step===4?"on":"")+"'>4 · Budget</span></div>";
  if(step===2){
    const isSequel=!!WZ.idea.sequelOf;
    const dirs=G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil&&(!isSequel||!t.auteur)).sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>A director shapes ~25% of quality. Genre fit adds a bonus. Auteurs add +5 craft but refuse sequels.</p><div class='pick-list'>";
    dirs.slice(0,10).forEach(d=>{
      const fit=d.genreFit===WZ.idea.genre;
      h+="<div class='card talent-card"+(WZ.director&&WZ.director.id===d.id?" sel-card":"")+"' data-dir='"+d.id+"'><div class='t-avatar'>🎬</div><div style='flex:1'>"+
        "<div class='t-name'>"+esc(d.name)+(d.auteur?" <span class='tag purple'>auteur</span>":"")+"</div>"+
        stars(d.power)+"<div class='t-stats'>Skill "+d.skill+(fit?" · <span class='pos'>fits "+DATA.GENRES[WZ.idea.genre].name+"</span>":"")+"</div>"+
        "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(d))+"</span></div></div></div>";
    });
    h+="</div>";
  }else if(step===3){
    const acts=G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil).sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>Pick 1–3 leads. Star power (★) drives opening weekend; skill drives reviews.</p><div class='pick-list'>";
    acts.slice(0,12).forEach(a=>{
      const sel=WZ.cast.some(c=>c.id===a.id);
      h+="<div class='card talent-card"+(sel?" sel-card":"")+"' data-cast='"+a.id+"'><div class='t-avatar'>"+(a.power>=4?"🌟":"🙂")+"</div><div style='flex:1'>"+
        "<div class='t-name'>"+esc(a.name)+(a.toxic&&!a.rehabbed?" <span class='tag red'>toxic</span>":"")+"</div>"+stars(a.power)+
        "<div class='t-stats'>Skill "+a.skill+((a.pics||0)>=2?" · loyal (−10% fee)":"")+"</div>"+
        "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(a))+"</span>"+(sel?"<span class='tag green'>✓ cast</span>":"")+"</div></div></div>";
    });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzSkipCast'>Continue with "+WZ.cast.length+" →</button>"+
       "<button class='btn btn-alt' id='wzCameo'>🌟 Cameo…</button><button class='btn btn-primary' id='wzNext'>To Budget →</button></div>";
  }else{
    const fees=(WZ.director?actorFee(WZ.director):0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0)+(WZ.cameo?Math.round(actorFee(WZ.cameo)*0.3):0);
    const dev=devCostOf(WZ.idea);
    const S2=DATA.SCALES[WZ.idea.scale];
    const weeks=S2.pre[1]+S2.shoot[1]+S2.post[1];
    const starP=WZ.cast.reduce((s,c)=>s+c.power,0);
    h+="<div class='small muted' style='margin:4px 0 6px'><b>Distribution plan</b> — commit now or keep options open</div><div class='plan-pick'>"+
      "<div class='plan-opt"+(WZ.plan==="theatrical"?" sel":"")+"' data-plan='theatrical'><h5>🎥 Theatrical release</h5><div class='p-sub'>Full box office upside (and risk). You set the date & P&A when it's finished.</div></div>"+
      "<div class='plan-opt"+(WZ.plan==="streaming"?" sel":"")+"' data-plan='streaming'><h5>📺 Streaming original</h5><div class='p-sub'>Platforms bid on delivery — guaranteed cash ≈ budget × quality, zero box office.</div></div>"+
      "<div class='plan-opt"+(WZ.plan==="later"?" sel":"")+"' data-plan='later'><h5>🤔 Decide later</h5><div class='p-sub'>Keep every door open: date it, shop it, or take incoming pre-buy offers.</div></div>"+
      "</div>";
    // v2 creative options: rating, shoot location, foreign language
    h+="<div class='grid g2' style='margin-top:8px'><div class='card'><div class='small muted' style='margin-bottom:6px'><b>MPAA rating</b></div><div class='row'>";
    DATA.RATINGS.forEach(r=>{ h+="<button class='btn btn-sm "+(WZ.rating===r.id?"btn-primary":"")+"' data-rating='"+r.id+"' title='"+r.desc+"'>"+r.emoji+" "+r.id+"</button>"; });
    h+="</div><div class='tiny muted' style='margin-top:6px'>"+(DATA.RATINGS.find(r=>r.id===WZ.rating).desc)+"</div></div>";
    h+="<div class='card'><div class='small muted' style='margin-bottom:6px'><b>Shoot location</b> <span class='tiny'>(rebates offset weekly burn)</span></div><div class='row'>";
    DATA.LOCATIONS.forEach(l=>{ h+="<button class='btn btn-sm "+(WZ.location===l.id?"btn-primary":"")+"' data-loc='"+l.id+"' title='"+l.desc+"'>"+l.flag+" "+l.name+"</button>"; });
    h+="</div><div class='tiny muted' style='margin-top:6px'>"+(DATA.LOCATIONS.find(l=>l.id===WZ.location).desc)+"</div></div></div>";
    h+="<div class='card' style='margin-top:8px;cursor:pointer' id='wzForeign'><div class='spread'><span class='small'>"+(WZ.foreignLang?"✅ ":"⬜ ")+"<b>🌏 Foreign-language film</b></span><span class='tiny muted'>critics +3 · intl share +10pts · mass appeal ×0.75</span></div></div>";
    if(WZ.cameo) h+="<div class='card' style='margin-top:8px'><div class='spread'><span class='small'>🌟 Cameo: <b>"+esc(WZ.cameo.name)+"</b> ("+fmtM(Math.round(actorFee(WZ.cameo)*0.3))+", +6% buzz)</span><button class='btn btn-sm' id='wzCameoDrop'>✕</button></div></div>";
    if(WZ.plan!=="streaming"){
      const pv=Math.round(WZ.budget*0.22);
      h+="<div class='card' style='margin-top:8px;cursor:pointer' id='wzPresale'><div class='spread'><span class='small'>"+(WZ.presales?"✅ ":"⬜ ")+"<b>International pre-sales</b> — take "+fmtM(pv)+" cash today</span><span class='tag "+(WZ.presales?"gold":"")+"'>"+(WZ.presales?"sold":"available")+"</span></div>"+
        "<div class='tiny muted'>Buyers take the international box office (~"+Math.round(DATA.GENRES[WZ.idea.genre].intlShare*100)+"% of gross). Great for cash flow; costs you upside on hits.</div></div>";
    }
    if(starP>=8) h+="<div class='tiny' style='margin-top:8px'>🌟 A-list ensemble: the stars demand <b>5% of rentals</b> as backend points.</div>";
    if(WZ.idea.spinoffFr) h+="<div class='tiny gold' style='margin-top:8px'>💥 Spin-off: tier-2 budget (45%), riding "+esc(WZ.idea.spinoffFr.name)+" heat ("+Math.round(WZ.idea.spinoffFr.decay*100)+"% hot).</div>";
    if(WZ.idea.crossover) h+="<div class='tiny gold' style='margin-top:8px'>💥 Crossover event: +45% buzz baked in.</div>";
    h+="<div class='card' style='margin-top:10px'><div class='slider-row'><span class='small muted'>Production budget</span>"+
      "<input type='range' id='wzBudget' min='"+S2.bMin+"' max='"+(S2.bMax*1.4)+"' step='"+(S2.bMin>=100?5:2)+"' value='"+WZ.budget+"'><span class='slider-val' id='wzBudgetV'>"+fmtM(WZ.budget)+"</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Typical "+S2.name+" range: "+fmtM(S2.bMin)+"–"+fmtM(S2.bMax)+" · genre needs ≈ "+fmtM(neededBudget(WZ.idea.genre,WZ.idea.scale))+" (underfunding hurts quality)"+(WZ.idea.spinoffFr?" · spin-off target 45%":"")+"</div></div>";
    h+="<div class='card'><div class='cost-line'><span>Rights + development</span><b>"+fmtM(dev)+"</b></div>"+
      "<div class='cost-line'><span>Talent fees (upfront"+(WZ.wrapDeal>0?" · wrap deal −20%":"")+")</span><b>"+fmtM(fees)+"</b></div>"+
      "<div class='cost-line'><span>Production (paid weekly over ~"+weeks+" wks"+(WZ.location!=="home"?" · "+DATA.LOCATIONS.find(l=>l.id===WZ.location).flag+" rebates":"")+")</span><b>"+fmtM(WZ.budget)+"</b></div>"+
      (WZ.presales&&WZ.plan!=="streaming"? "<div class='cost-line'><span>Intl pre-sales (cash now)</span><b class='pos'>+"+fmtM(Math.round(WZ.budget*0.22))+"</b></div>":"")+
      "<div class='cost-line'><span>Suggested marketing (at release)</span><b id='wzMkt'>"+fmtM(recMarketing({budget:WZ.budget, scale:WZ.idea.scale, genre:WZ.idea.genre}))+"</b></div>"+
      "<div class='cost-total'><span>Total commitment</span><span class='gold' id='wzTot'>"+fmtM(dev+fees+WZ.budget)+"</span></div></div>";
    h+="<div class='tiny muted'>💡 Rule of thumb: a film needs ≈ <b id='wzBe'>"+fmtM(breakevenWW({budget:WZ.budget, marketing:recMarketing({budget:WZ.budget,scale:WZ.idea.scale,genre:WZ.idea.genre})}))+"</b> worldwide gross to break even (theaters keep ~half).</div>";
    h+="<div class='modal-actions'><button class='btn btn-ghost' id='wzBack'>← Cast</button><button class='btn btn-primary' id='wzGo'>"+t("btn.greenlight")+"</button></div>";
  }
  const v=openModal(h, {onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-dir]").forEach(el=>el.onclick=()=>{ WZ.director=talentById(+el.dataset.dir); WZ.sub=3; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-cast]").forEach(el=>el.onclick=()=>{
    const tt=talentById(+el.dataset.cast);
    const i=WZ.cast.findIndex(c=>c.id===tt.id);
    if(i>=0) WZ.cast.splice(i,1);
    else if(WZ.cast.length<3) WZ.cast.push(tt);
    beep("click"); wizardModal();
  });
  const nx=v.querySelector("#wzNext"); if(nx) nx.onclick=()=>{ WZ.sub=4; wizardModal(); };
  const sk=v.querySelector("#wzSkipCast"); if(sk) sk.onclick=()=>{ WZ.sub=4; wizardModal(); };
  const bk=v.querySelector("#wzBack"); if(bk) bk.onclick=()=>{ WZ.sub=3; wizardModal(); };
  const cm=v.querySelector("#wzCameo"); if(cm) cm.onclick=()=>cameoPicker();
  const cd=v.querySelector("#wzCameoDrop"); if(cd) cd.onclick=()=>{ WZ.cameo=null; wizardModal(); };
  v.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{ WZ.plan=b.dataset.plan; if(WZ.plan==="streaming") WZ.presales=false; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-rating]").forEach(b=>b.onclick=()=>{ WZ.rating=b.dataset.rating; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-loc]").forEach(b=>b.onclick=()=>{ WZ.location=b.dataset.loc; beep("click"); wizardModal(); });
  const fo=v.querySelector("#wzForeign"); if(fo) fo.onclick=()=>{ WZ.foreignLang=!WZ.foreignLang; beep("click"); wizardModal(); };
  const ps=v.querySelector("#wzPresale"); if(ps) ps.onclick=()=>{ WZ.presales=!WZ.presales; beep("click"); wizardModal(); };
  const rg=v.querySelector("#wzBudget");
  if(rg){ rg.oninput=()=>{
    WZ.budget=+rg.value; $("#wzBudgetV").textContent=fmtM(WZ.budget);
    const mkt=recMarketing({budget:WZ.budget, scale:WZ.idea.scale, genre:WZ.idea.genre});
    const mEl=$("#wzMkt"), tEl=$("#wzTot"), bEl=$("#wzBe");
    if(mEl) mEl.textContent=fmtM(mkt);
    if(tEl) tEl.textContent=fmtM(devCostOf(WZ.idea)+(WZ.director?actorFee(WZ.director):0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0)+WZ.budget);
    if(bEl) bEl.textContent=fmtM(breakevenWW({budget:WZ.budget, marketing:mkt}));
  }; }
  const go=v.querySelector("#wzGo");
  if(go) go.onclick=()=>{
    const fees=(WZ.director?actorFee(WZ.director):0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0);
    const dev=devCostOf(WZ.idea);
    if(G.studio.cash < dev+fees+WZ.budget*0.2){ toast("Not enough cash for upfront costs — visit Finance for a loan.","bad"); beep("bad"); return; }
    if(WZ.idea.sequelOf && WZ.director && WZ.director.auteur){ toast("Auteurs refuse sequels — pick another director.","bad"); beep("bad"); return; }
    const cfg={ idea:WZ.idea, director:WZ.director, cast:WZ.cast, budget:WZ.budget,
      sequelOf:WZ.idea.sequelOf, spinoffFr:WZ.idea.spinoffFr, crossover:WZ.idea.crossover,
      plan:WZ.plan, presales:WZ.presales, rating:WZ.rating, location:WZ.location,
      foreignLang:WZ.foreignLang, cameo:WZ.cameo };
    greenlight(cfg);
    beep("gold"); WZ=null; closeModal(); render();
  };
}
/* v3: cameo picker — superstar scene for 30% of fee, +6% buzz */
function cameoPicker(){
  const sups=G.talent.filter(t=>t.kind==="actor"&&t.power>=4&&!t.bookedUntil).sort((a,b)=>b.power-a.power);
  let h="<h3>🌟 Cast a cameo</h3><p class='small muted'>One scene, one superstar. You pay 30% of their fee, the trailer gets +6% buzz.</p><div class='pick-list'>";
  if(!sups.length) h+="<div class='muted small'>No power-4+ stars free right now.</div>";
  sups.slice(0,8).forEach(a=>{
    h+="<div class='card talent-card' data-cameo='"+a.id+"'><div class='t-avatar'>🌟</div><div style='flex:1'><div class='t-name'>"+esc(a.name)+"</div>"+stars(a.power)+
      "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(Math.round(actorFee(a)*0.3))+"</span><span class='tag green'>+6% buzz</span></div></div></div>";
  });
  h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='camBack'>← Back</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-cameo]").forEach(el=>el.onclick=()=>{
    WZ.cameo=talentById(+el.dataset.cameo); WZ.buzzCameo=true; beep("gold"); wizardModal();
  });
  v.querySelector("#camBack").onclick=()=>wizardModal();
}
function sequelTitle0(wz){ return wz.idea.sequelOf? sequelTitle(wz.idea.sequelOf.title) : "Sequel"; }

/* ── series pitch wizard (v2: reality/doc + limited vs ongoing) ── */
function startSeriesWizard(){
  WZ={mode:"series", genre:pick(["drama","thriller","scifi","comedy","horror","romance","fantasy","action"]),
      eps:8, perEp:6, platform:"streamflix", showrunner:null, cast:[], format:"ongoing"};
  seriesModal();
}
function seriesModal(){
  const step = !WZ.showrunner? 1 : 2;
  let h="<h3>📺 Pitch a Series</h3>";
  if(step===1){
    h+="<div class='small muted' style='margin-bottom:8px'>Genre & format — reality and documentary are cheap and renew-friendly</div><div class='row' id='szGenres'>";
    Object.keys(DATA.GENRES).forEach(g=>{
      h+="<button class='btn btn-sm "+(WZ.genre===g?"btn-primary":"")+"' data-g='"+g+"'>"+DATA.GENRES[g].emoji+" "+DATA.GENRES[g].name+"</button>";
    });
    Object.keys(DATA.SGENRES).forEach(g=>{
      h+="<button class='btn btn-sm "+(WZ.genre===g?"btn-primary":"")+"' data-g='"+g+"'>"+DATA.SGENRES[g].emoji+" "+DATA.SGENRES[g].name+"</button>";
    });
    h+="</div>";
    h+="<div class='row' style='margin-top:8px'><span class='small muted'>Format:</span>"+
      "<button class='btn btn-sm "+(WZ.format==="ongoing"?"btn-primary":"")+"' data-fmt='ongoing'>🔁 Ongoing</button>"+
      "<button class='btn btn-sm "+(WZ.format==="limited"?"btn-primary":"")+"' data-fmt='limited'>🎯 Limited event (renews harder)</button></div>";
    const perEpMax = DATA.SGENRES[WZ.genre]? DATA.SGENRES[WZ.genre].perEpMax : 18;
    if(WZ.perEp>perEpMax) WZ.perEp=perEpMax;
    h+="<div class='card' style='margin-top:10px'><div class='slider-row'><span class='small muted'>Episodes</span><input type='range' id='szEps' min='6' max='10' value='"+WZ.eps+"'><span class='slider-val' id='szEpsV'>"+WZ.eps+" eps</span></div></div>";
    h+="<div class='card'><div class='slider-row'><span class='small muted'>Budget / episode</span><input type='range' id='szPerEp' min='2' max='"+perEpMax+"' value='"+WZ.perEp+"'><span class='slider-val' id='szPerEpV'>"+fmtM(WZ.perEp)+"</span></div><div class='tiny muted'>Season budget: <b id='szTotal'>"+fmtM(WZ.eps*WZ.perEp)+"</b> — $8M+/ep reads as premium.</div></div>";
    h+="<div class='small muted' style='margin:10px 0 8px'>Pick a showrunner (director)</div><div class='pick-list'>";
    G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil).sort((a,b)=>b.power-a.power).slice(0,6).forEach(d=>{
      h+="<div class='card talent-card' data-sr='"+d.id+"'><div class='t-avatar'>🎬</div><div style='flex:1'><div class='t-name'>"+esc(d.name)+"</div>"+stars(d.power)+"<div class='t-stats'>Skill "+d.skill+"</div><div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(d))+"</span></div></div></div>";
    });
    h+="</div>";
  }else{
    const plat=DATA.platform(WZ.platform);
    const odds=Math.round(clamp(0.22+65/160+((plat.taste[WZ.genre]||1)-1)*0.6+G.studio.rep/400+(WZ.perEp>=8?0.06:0)+(G.upgrades.ottrel?0.05:0)+(DATA.SGENRES[WZ.genre]?0.08:0),0.12,0.92)*100);
    h+="<div class='card platform-card'><div class='platform-logo' style='background:"+plat.color+"'>"+plat.logo+"</div><div><b>"+plat.name+"</b><div class='tiny muted'>"+plat.blurb+"</div></div></div>";
    h+="<div class='card'><div class='cost-line'><span>Taste for "+DATA.genreOf(WZ.genre).name+"</span><b>"+(((plat.taste[WZ.genre]||1))*100).toFixed(0)+"%</b></div>"+
      "<div class='cost-line'><span>Season order ("+WZ.eps+" × "+fmtM(WZ.perEp)+")</span><b>"+fmtM(WZ.eps*WZ.perEp)+"</b></div>"+
      "<div class='cost-line'><span>License if greenlit (≈115% of budget)</span><b class='pos'>"+fmtM(WZ.eps*WZ.perEp*1.15)+"</b></div></div>";
    h+="<div class='small' style='margin:8px 0'>Estimated pitch odds: <b class='"+(odds>=55?"pos":odds>=35?"gold":"neg")+"'>~"+odds+"%</b>"+(WZ.format==="limited"?" · <span class='tag purple'>limited</span>":"")+"</div>";
    h+="<div class='row' id='szPlats'>";
    DATA.allPlatforms().forEach(p=>{
      h+="<button class='btn btn-sm "+(WZ.platform===p.id?"btn-primary":"")+"' data-p='"+p.id+"'>"+p.name+"</button>";
    });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='szBack'>← Back</button><button class='btn btn-primary' id='szPitch'>"+t("btn.pitch")+"</button></div>";
  }
  const v=openModal(h,{onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ WZ.genre=b.dataset.g; beep("click"); seriesModal(); });
  v.querySelectorAll("[data-fmt]").forEach(b=>b.onclick=()=>{ WZ.format=b.dataset.fmt; beep("click"); seriesModal(); });
  const e1=v.querySelector("#szEps"); if(e1){ e1.oninput=()=>{ WZ.eps=+e1.value; $("#szEpsV").textContent=WZ.eps+" eps"; $("#szTotal").textContent=fmtM(WZ.eps*WZ.perEp); }; }
  const e2=v.querySelector("#szPerEp"); if(e2){ e2.oninput=()=>{ WZ.perEp=+e2.value; $("#szPerEpV").textContent=fmtM(WZ.perEp); $("#szTotal").textContent=fmtM(WZ.eps*WZ.perEp); }; }
  v.querySelectorAll("[data-sr]").forEach(el=>el.onclick=()=>{ WZ.showrunner=talentById(+el.dataset.sr); beep("click"); seriesModal(); });
  v.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{ WZ.platform=b.dataset.p; beep("click"); seriesModal(); });
  const bk=v.querySelector("#szBack"); if(bk) bk.onclick=seriesModal;
  const pit=v.querySelector("#szPitch");
  if(pit) pit.onclick=()=>{
    const res=pitchSeries({genre:WZ.genre, eps:WZ.eps, perEp:WZ.perEp, platformId:WZ.platform,
      showrunner:WZ.showrunner, cast:WZ.cast, format:WZ.format});
    beep(res.ok?"gold":"bad"); flashes(G.flash);
    WZ=null; closeModal(); render();
  };
}

/* ═══════════ VIEW: productions ═══════════ */
function viewProductions(){
  let h="";
  const ready=readyProjects(), prod=inProdProjects();
  h+="<div class='section-title'>"+t("sec.prod")+" ("+prod.length+")</div>";
  if(!prod.length) h+="<div class='card muted small'>No films shooting. Visit 📝 Develop to greenlight one.</div>";
  for(const p of prod){
    const S=DATA.SCALES[p.scale];
    const ph=p.phase; const L=p.phaseLen;
    const curIdx={pre:0,shoot:1,post:2}[ph];
    const totalWk=L.pre+L.shoot+L.post, doneWk=(curIdx>0?L.pre:0)+(curIdx>1?L.shoot:0)+p.phaseWeek;
    const burn = ph==="pre"? p.budget*0.10/L.pre : ph==="shoot"? p.budget*0.70/L.shoot*(G.upgrades.backlot?0.88:1) : p.budget*0.20/L.post*(G.upgrades.vfx?0.75:1);
    const loc=DATA.LOCATIONS.find(l=>l.id===(p.location||"home"));
    h+="<div class='card prod-card'><div class='spread'><div><b>"+DATA.GENRES[p.genre].emoji+" "+esc(p.title)+"</b>"+(p.franchiseName?" <span class='tag purple'>franchise</span>":"")+
      (p.foreignLang?" <span class='tag blue'>🌏 foreign-language</span>":"")+
      "<div class='tiny muted'>"+gTag(p.genre)+" <span class='tag'>"+S.emoji+" "+S.name+"</span> <span class='tag'>"+p.rating+"</span> <span class='tag'>"+(loc?loc.flag:"🏠")+" "+(loc?loc.name:"home")+"</span> · budget "+fmtM(p.budget)+" · dir "+(p.director?esc(p.director.name):"—")+" · "+(p.cast?p.cast.length:0)+" leads"+(p.cameo?" + 🌟 cameo":"")+"</div></div>"+
      "<div style='text-align:right'><div class='tag "+(ph==="shoot"?"gold":"blue")+"'>"+({pre:"Pre-production",shoot:"Shooting",post:"Post-production"}[ph])+"</div>"+
      (p.strikePause>0?"<div class='tag red' style='margin-top:4px'>✊ strike "+p.strikePause+"wks</div>":"")+"</div></div>"+
      "<div class='phases'>"+["pre","shoot","post"].map((x,i)=>{
        const st= i<curIdx? "done": i===curIdx? "cur":"";
        const w = i<curIdx? 100 : i===curIdx? Math.round(p.phaseWeek/L[x]*100):0;
        return "<div class='ph "+st+"'><i style='width:"+w+"%'></i></div>"; }).join("")+
      "</div><div class='ph-labels'><span>Pre</span><span>Shoot</span><span>Post</span></div>"+
      "<div class='spread small' style='margin-top:8px'><span class='muted'>Week "+(doneWk+1)+" of ~"+totalWk+" · burn "+fmtM(burn)+"/wk"+(ph==="shoot"&&loc?" · rebate "+Math.round(loc.rate*100)+"%":"")+"</span>"+
      "<span class='muted'>spent "+fmtM(p.spent)+" of "+fmtM(p.budget)+"</span></div>"+
      "<div class='row' style='margin-top:8px'>"+
      (ph==="pre"&&!p.rewritten? "<button class='btn btn-sm btn-alt' data-rewrite='"+p.id+"'>📝 Rewrite script · "+fmtM(Math.max(2,Math.round(p.budget*0.05)))+"</button>":"")+
      (p.rewritten?"<span class='tag green'>script polished</span>":"")+
      "<button class='btn btn-sm btn-danger' data-cancel='"+p.id+"'>✕ Shelve (lose spend)</button></div></div>";
  }
  h+="<div class='section-title'>"+t("sec.ready")+" ("+ready.length+")</div>";
  if(!ready.length) h+="<div class='card muted small'>Nothing in the can yet.</div>";
  for(const p of ready){
    const reshot=p.reshoot?"<span class='tag green'>reshot</span>":"";
    h+="<div class='card'><div class='spread'><div><b>🎞 "+esc(p.title)+"</b> "+scoreBadge(p.quality.overall)+" "+reshot+
      (p.prebuyAccepted?"<div class='tiny gold'>Sold to "+DATA.platform(p.prebuyPlatform).name+" — payable on delivery</div>":"")+"</div></div>"+
      "<div class='tiny muted' style='margin-top:6px'>Critics "+p.quality.critic+" · Audience "+p.quality.aud+" · budget "+fmtM(p.budget)+" · breakeven "+fmtM(breakevenWW(p))+" WW</div>"+
      (p.prebuyAccepted?"":"<div class='row' style='margin-top:10px'><button class='btn btn-primary' data-sched='"+p.id+"'>📅 "+t("btn.schedule").replace("📅 ","")+"</button><button class='btn btn-alt' data-shop='"+p.id+"'>"+t("btn.shop").replace("📺 ","📺 ")+"</button>"+
      "<button class='btn btn-ghost btn-sm' data-screen='"+p.id+"'>🧪 Test screening</button>"+
      (!p.reshoot&&p.quality.overall<68? "<button class='btn btn-alt btn-sm' data-reshoot='"+p.id+"'>🎞 Reshoots · "+fmtM(Math.max(3,Math.round(p.budget*0.08)))+"</button>":"")+
      "</div>")+"</div>";
  }
  h+="<div class='section-title'>"+t("sec.frops")+"</div>";
  const fr=G.films.filter(f=>f.franchiseable);
  if(!fr.length) h+="<div class='card muted small'>Land a big hit (2× breakeven + good reviews) and sequels unlock here.</div>";
  for(const f of fr.slice(0,4)){
    h+="<div class='card'><div class='spread'><div><b>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</b><div class='tiny muted'>"+fmtG(f.ww)+" WW · "+scoreBadge(f.quality.overall)+"</div></div>"+
      "<button class='btn btn-sm btn-primary' data-seq='"+f.id+"'>⚡ Greenlight Sequel</button></div></div>";
  }
  return h;
}
function screeningModal(pid){
  const r=testScreening(pid);
  if(!r){ toast("Screening unavailable.","bad"); return; }
  const p=r.p;
  const exp=expectedOpening(p, G.week+3);
  let h="<h3>🧪 Test screening — “"+esc(p.title)+"”</h3>"+
    "<div class='card'><div class='cost-line'><span>Overall</span><b>"+p.quality.overall+"/100</b></div>"+
    "<div class='cost-line'><span>Critics (predicted)</span><b>"+p.quality.critic+"</b></div>"+
    "<div class='cost-line'><span>Audiences</span><b>"+p.quality.aud+"</b></div>"+
    "<div class='cost-line'><span>Tracking legs</span><b>×"+r.legs+"</b></div>"+
    "<div class='cost-line'><span>Rough opening (neutral wk)</span><b>"+fmtG(exp)+"</b></div></div>";
  h+= r.spots.length? "<div class='card' style='border-left:3px solid var(--red)'><b>Weak spots flagged:</b> "+r.spots.join(", ")+".<div class='tiny muted' style='margin-top:4px'>Reshoots can fix this before release.</div></div>"
    : "<div class='card' style='border-left:3px solid var(--green)'>Test audiences loved it. Ship it.</div>";
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Noted</button></div>";
  openModal(h);
}

/* ── release scheduling modal (v3: windowing, patterns, rollout, IMAX, D&D, soundtrack) ── */
function startScheduling(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p) return;
  SCHEDULE={p, week:G.week+4, marketing:recMarketing(p), sel:false,
    imax:false, window:45, pattern:"wide", rollout:"day", soundtrack:false, dayAndDate:false};
  schedModal();
}
function schedModal(){
  const p=SCHEDULE.p;
  const rec=recMarketing(p);
  let h="<h3>📅 Release “"+esc(p.title)+"”</h3>";
  h+="<div class='card'><div class='slider-row'><span class='small muted'>P&A / marketing</span>"+
    "<input type='range' id='scMkt' min='"+Math.round(rec*0.25)+"' max='"+Math.round(rec*2)+"' step='1' value='"+SCHEDULE.marketing+"'>"+
    "<span class='slider-val' id='scMktV'>"+fmtM(SCHEDULE.marketing)+"</span></div>"+
    "<div class='tiny muted'>Recommended "+fmtM(rec)+" ("+Math.round(DATA.SCALES[p.scale].mktRate*100)+"% of budget). 30% paid now, 70% on release.</div></div>";
  // v3 release craft
  h+="<div class='grid g2'>";
  h+="<div class='card'><div class='small muted'><b>Release pattern</b></div><div class='row' style='margin-top:6px'>";
  DATA.PATTERNS.forEach(x=>{ h+="<button class='btn btn-sm "+(SCHEDULE.pattern===x.id?"btn-primary":"")+"' data-pat='"+x.id+"' title='"+x.desc+"'>"+x.label+"</button>"; });
  h+="</div><div class='tiny muted' style='margin-top:4px'>"+DATA.PATTERNS.find(x=>x.id===SCHEDULE.pattern).desc+"</div></div>";
  h+="<div class='card'><div class='small muted'><b>Intl rollout</b></div><div class='row' style='margin-top:6px'>";
  DATA.ROLLOUTS.forEach(x=>{ h+="<button class='btn btn-sm "+(SCHEDULE.rollout===x.id?"btn-primary":"")+"' data-roll='"+x.id+"' title='"+x.desc+"'>"+x.label+"</button>"; });
  h+="</div><div class='tiny muted' style='margin-top:4px'>"+DATA.ROLLOUTS.find(x=>x.id===SCHEDULE.rollout).desc+"</div></div>";
  h+="<div class='card'><div class='small muted'><b>Theatrical window</b> <span class='tiny'>(exhibitor relations: "+Math.round(G.exhibRel)+"/100)</span></div><div class='row' style='margin-top:6px'>";
  DATA.WINDOWS.forEach(x=>{ h+="<button class='btn btn-sm "+(SCHEDULE.window===x.d?"btn-primary":"")+"' data-win='"+x.d+"' title='"+x.desc+"'>"+x.label+"</button>"; });
  h+="</div><div class='tiny muted' style='margin-top:4px'>"+DATA.WINDOWS.find(x=>x.d===SCHEDULE.window).desc+"</div></div>";
  h+="<div class='card'><div class='small muted'><b>Extras</b></div>"+
    "<div class='row' style='margin-top:6px'>"+
    "<button class='btn btn-sm "+(SCHEDULE.imax?"btn-primary":"")+"' id='scImax'>🎞 Premium/IMAX (+12% open, +8% P&A)</button>"+
    "<button class='btn btn-sm "+(SCHEDULE.soundtrack?"btn-primary":"")+"' id='scSound'>🎵 Soundtrack push ($5M, 30% charts)</button>"+
    (G.streamer? "<button class='btn btn-sm "+(SCHEDULE.dayAndDate?"btn-primary":"")+"' id='scDaD'>🛰 Day-and-date (−35% open, +subs)</button>":"")+
    "</div></div>";
  h+="</div>";
  h+="<div class='small muted' style='margin:10px 0 6px'>Pick a weekend (next 30 weeks):</div><div style='max-height:280px;overflow-y:auto;display:grid;gap:6px'>";
  for(let w=G.week+2; w<=G.week+30; w++){
    const s=DATA.seasonOf(woyOf(w));
    const comps=weekendCompetitors(p, w);
    let note="";
    comps.forEach(c=>{ note += c.mine? "<span class='mine-f'>vs your “"+esc(c.title)+"”</span> " : "<span class='rival-f'>"+c.rival+": "+esc(c.title)+"</span> "; });
    const heat = s.season>=1.15? "<span class='tag gold'>corridor ×"+s.season.toFixed(2)+"</span>" : s.season<=0.9? "<span class='tag red'>dead zone ×"+s.season.toFixed(2)+"</span>" : "<span class='tag'>×"+s.season.toFixed(2)+"</span>";
    h+="<div class='calendar-row"+(SCHEDULE.week===w?" sel":"")+"' data-w='"+w+"'><div class='cal-when'><b>"+s.month+" W"+woyOf(w)+"</b><span>Year "+yearOf(w)+"</span></div>"+
      "<div class='cal-note'>"+heat+" "+(note? "<br>"+note : "<span class='muted'>clean weekend</span>")+"</div>"+
      "<div class='tiny muted'>opens ≈ "+fmtG(previewOpen(p,w))+"</div></div>";
  }
  h+="</div>";
  const exp=previewOpen(p,SCHEDULE.week);
  const be=breakevenWW({budget:p.budget, marketing:SCHEDULE.marketing});
  h+="<div class='card' style='margin-top:10px'><div class='cost-line'><span>Expected opening (est.)</span><b id='scExp'>"+fmtG(exp)+" dom</b></div>"+
    "<div class='cost-line'><span>Breakeven</span><b id='scBe'>"+fmtG(be)+" WW</b></div>"+
    "<div class='cost-line'><span>Pay now (30% P&A"+(SCHEDULE.soundtrack?" + soundtrack":"")+")</span><b id='scPay'>"+fmtM(SCHEDULE.marketing*0.3+(SCHEDULE.soundtrack?5:0))+"</b></div></div>";
  h+="<div class='tiny muted'>🐔 If you outweigh a rival on the same weekend, they may blink and move. 🎭 Exhibitor relations ("+Math.round(G.exhibRel)+") swing openings ±5%.</div>";
  h+="<div class='modal-actions'><button class='btn btn-primary' id='scGo'>📅 Lock the date</button></div>";
  const v=openModal(h,{onClose:()=>{SCHEDULE=null;}});
  const rg=v.querySelector("#scMkt");
  rg.oninput=()=>{
    SCHEDULE.marketing=+rg.value;
    $("#scMktV").textContent=fmtM(SCHEDULE.marketing);
    const e2=previewOpen(p,SCHEDULE.week);
    const eEl=$("#scExp"), bEl=$("#scBe"), pEl=$("#scPay");
    if(eEl) eEl.textContent=fmtG(e2)+" dom";
    if(bEl) bEl.textContent=fmtG(breakevenWW({budget:p.budget, marketing:SCHEDULE.marketing}))+" WW";
    if(pEl) pEl.textContent=fmtM(SCHEDULE.marketing*0.3+(SCHEDULE.soundtrack?5:0));
  };
  v.querySelectorAll("[data-w]").forEach(el=>el.onclick=()=>{ SCHEDULE.week=+el.dataset.w; beep("click"); schedModal(); });
  v.querySelectorAll("[data-pat]").forEach(el=>el.onclick=()=>{ SCHEDULE.pattern=el.dataset.pat; beep("click"); schedModal(); });
  v.querySelectorAll("[data-roll]").forEach(el=>el.onclick=()=>{ SCHEDULE.rollout=el.dataset.roll; beep("click"); schedModal(); });
  v.querySelectorAll("[data-win]").forEach(el=>el.onclick=()=>{ SCHEDULE.window=+el.dataset.win; beep("click"); schedModal(); });
  const im=v.querySelector("#scImax"); if(im) im.onclick=()=>{ SCHEDULE.imax=!SCHEDULE.imax; beep("click"); schedModal(); };
  const so=v.querySelector("#scSound"); if(so) so.onclick=()=>{ SCHEDULE.soundtrack=!SCHEDULE.soundtrack; beep("click"); schedModal(); };
  const dd=v.querySelector("#scDaD"); if(dd) dd.onclick=()=>{ SCHEDULE.dayAndDate=!SCHEDULE.dayAndDate; beep("click"); schedModal(); };
  v.querySelector("#scGo").onclick=()=>{
    const now=Math.round(SCHEDULE.marketing*0.3)+(SCHEDULE.soundtrack?5:0);
    if(G.studio.cash<now){ toast("Not enough cash for the P&A down payment.","bad"); return; }
    p.releaseWeek=SCHEDULE.week; p.marketing=SCHEDULE.marketing; p.marketingPaid=Math.round(SCHEDULE.marketing*0.3);
    p.imax=SCHEDULE.imax; p.window=SCHEDULE.window; p.pattern=SCHEDULE.pattern;
    p.rollout=SCHEDULE.rollout; p.soundtrack=SCHEDULE.soundtrack; p.dayAndDate=SCHEDULE.dayAndDate&&!!G.streamer;
    if(SCHEDULE.soundtrack) spend("marketing",5);
    G.studio.cash-=Math.round(SCHEDULE.marketing*0.3);
    // v3: window choice moves exhibitor relations
    const win=DATA.WINDOWS.find(w=>w.d===SCHEDULE.window);
    if(win&&win.rel) G.exhibRel=clamp(G.exhibRel+win.rel,10,95);
    log("📅 “"+p.title+"” dated for "+seasonDateLabel(SCHEDULE.week)+" — "+fmtM(p.marketing)+" P&A, "+win.label+" window, "+DATA.PATTERNS.find(x=>x.id===p.pattern).label.toLowerCase()+".","gold");
    playChicken(p, SCHEDULE.week);
    beep("gold"); SCHEDULE=null; closeModal(); render();
  };
}
function previewOpen(p,w){
  const saved={m:p.marketing, r:p.releaseWeek, imax:p.imax, pattern:p.pattern, rollout:p.rollout, dad:p.dayAndDate};
  if(SCHEDULE){ p.marketing=SCHEDULE.marketing; p.imax=SCHEDULE.imax; p.pattern=SCHEDULE.pattern; p.rollout=SCHEDULE.rollout; p.dayAndDate=SCHEDULE.dayAndDate; }
  p.releaseWeek=w;
  const v=expectedOpening(p,w);
  p.marketing=saved.m; p.releaseWeek=saved.r; p.imax=saved.imax; p.pattern=saved.pattern; p.rollout=saved.rollout; p.dayAndDate=saved.dad;
  return v;
}

/* ═══════════ VIEW: box office ═══════════ */
function viewBoxOffice(){
  let h="";
  const chart=weeklyChart();
  h+="<div class='section-title'>"+t("sec.chart")+"</div><div class='card chart-bars'>";
  if(!chart.length) h+="<div class='muted small'>Nothing in theaters — the multiplex is a graveyard.</div>";
  const max=Math.max(1,...chart.map(c=>c.gross));
  chart.forEach((c,i)=>{
    h+="<div class='chart-bar'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(c.mine?"🎬 ":"")+esc(c.title)+(c.mine?"":" <span class='tiny muted'>— "+esc(c.studio||"")+"</span>")+"</div>"+
      "<div class='cb-sub'>"+DATA.genreOf(c.genre).name+" · wk "+c.weeksOut+"</div></div>"+
      "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(7,c.gross/max*100)+"%;background:"+(c.mine?"linear-gradient(90deg,#f5b942,#ffd479)":(c.color||"#4a5570"))+"'>"+fmtG(c.gross)+"</div></div></div>";
  });
  h+="</div>";
  const live=activeFilms();
  h+="<div class='section-title'>"+t("sec.live")+" ("+live.length+")</div>";
  if(!live.length) h+="<div class='card muted small'>No active runs. A film without a release date earns nothing.</div>";
  for(const f of live){
    const be=breakevenWW(f);
    const projWW=(f.dom/(1-intlShareOf(f)));
    h+="<div class='card'><div class='spread'><div><b>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</b>"+(f.imax?" <span class='tag gold'>IMAX</span>":"")+(f.dayAndDate?" <span class='tag purple'>day-and-date</span>":"")+(f.foreignLang?" <span class='tag blue'>🌏</span>":"")+
      "<div class='tiny muted'>wk "+f.weeksOut+" out · opened "+fmtG(f.opening)+" · "+scoreBadge(f.quality.overall)+"</div></div>"+
      "<div style='text-align:right'><b class='gold'>"+fmtG(f.dom)+"</b><div class='tiny muted'>domestic</div></div></div>"+
      "<div class='weekly-gross-chart'>"+f.weekly.slice(-12).map(x=>"<div class='wg' style='height:"+Math.max(4,x.gross/f.opening*100)+"%' title='"+fmtG(x.gross)+"'></div>").join("")+"</div>"+
      "<div class='spread small' style='margin-top:6px'><span class='muted'>Tracking ≈ "+fmtG(projWW)+" WW vs "+fmtG(be)+" breakeven</span>"+
      "<span class='"+(projWW>=be?"pos":"neg")+"'>"+(projWW>=be?"on pace to profit":"below breakeven")+"</span></div>"+
      "<div class='tiny' style='margin-top:4px'>💰 Rentals received to date: <b class='gold'>"+fmtM(f.rentalsDom||0)+"</b> <span class='muted'>(~53% of domestic gross, paid weekly)</span>"+(f.presales?" · <span class='muted'>intl pre-sold</span>":"")+"</div></div>";
  }
  const lib=G.films.slice().sort((a,b)=>(b.ww||0)-(a.ww||0));
  h+="<div class='section-title'>"+t("sec.library")+" ("+lib.length+")</div>";
  if(!lib.length) h+="<div class='card muted small'>Your trophy shelf is empty. For now.</div>";
  h+="<div class='card'>";
  lib.slice(0,15).forEach(f=>{
    const be=f.ww? breakevenWW(f):1;
    const verdict = f.streamingOriginal? "<span class='tag purple'>streaming original</span>" :
      f.ww>=be*1.6? "<span class='tag green'>SMASH</span>" : f.ww>=be? "<span class='tag green'>HIT</span>" :
      f.ww>=be*0.75? "<span class='tag gold'>soft</span>" : "<span class='tag red'>FLOP</span>";
    const acts=
      (canRerelease(f)? "<button class='btn btn-sm btn-alt' data-rerelease='"+f.id+"'>🎟 Re-release</button>":"")+
      (canReboot(f)? "<button class='btn btn-sm btn-ghost' data-reboot='"+f.id+"'>🔁 Reboot</button>":"");
    h+="<div class='film-row'><div><b>"+esc(f.title)+"</b> "+verdict+" "+
      ((f.awards&&f.awards.length)?"🏆 "+f.awards.join(" · "):"")+
      ((f.festWins&&f.festWins.length)?" 🎪"+f.festWins.length:"")+
      "<div class='tiny muted'>"+DATA.genreOf(f.genre).name+" · "+fmtM(f.budget)+" budget · "+fmtG(f.ww||0)+" WW"+
      (f.soldTo?" · "+(f.onOwnPlatform?"on your streamer":"licensed to "+f.soldTo):"")+"</div>"+
      (acts?"<div class='row' style='margin-top:4px'>"+acts+"</div>":"")+"</div>"+
      "<div style='text-align:right'><b class='"+(f.profit>=0?"pos":"neg")+"'>"+(f.profit>=0?"+":"")+fmtM(f.profit||0)+"</b><div class='tiny muted'>net</div></div></div>";
  });
  h+="</div>";
  return h;
}

/* ═══════════ VIEW: ott (v3: your streamer + sports) ═══════════ */
function viewOTT(){
  let h="";
  h+=viewStreamerCard();
  h+="<div class='section-title'>"+t("sec.offers")+" ("+G.offers.length+")</div>";
  if(G.outputDeal>0) h+="<div class='card' style='border-left:3px solid var(--green)'><b>📜 Output deal active</b> — next "+G.outputDeal+" streaming sale(s) pay +20%.</div>";
  if(!G.offers.length) h+="<div class='card muted small'>No offers on the table. Hits and finished runs attract bidders — especially during streaming wars.</div>";
  for(const o of G.offers){
    const p=DATA.platform(o.platform);
    const typeLabel = o.type==="film_ott"? "Theatrical → streaming license" : o.type==="prebuy"? "Buy-out as streaming original" : o.type==="output"? "Output deal (+20% on next 3 sales)" : "Season "+o.seasonNum+" order";
    h+="<div class='card offer-card'><div class='spread'><div class='platform-card'><div class='platform-logo' style='background:"+p.color+"'>"+p.logo+"</div>"+
      "<div><b>"+esc(o.filmTitle||o.seriesTitle)+"</b><div class='tiny muted'>"+typeLabel+" · "+p.name+"</div></div></div>"+
      "<div style='text-align:right'>"+(o.value? "<div class='modal-offer-val'>"+fmtM(o.value)+"</div>":"")+
      "<div class='tiny muted'>expires in "+(o.expires-G.week)+" wk</div></div></div>"+
      "<div class='modal-actions' style='margin-top:10px'>"+
      "<button class='btn btn-primary btn-sm' data-acc='"+o.id+"'>"+t("btn.accept")+"</button>"+
      (o.countered||o.type==="output"?"":"<button class='btn btn-alt btn-sm' data-cnt='"+o.id+"'>"+t("btn.counter")+"</button>")+
      "<button class='btn btn-ghost btn-sm' data-dec='"+o.id+"'>"+t("btn.decline")+"</button></div></div>";
  }
  h+="<div class='section-title'>"+t("sec.series")+" ("+G.series.length+")</div>";
  if(!G.series.length) h+="<div class='card muted small'>No shows yet. Series = steady license income + renewals. Pitch one from 📝 Develop (reality & documentary are cheap and renew-friendly).</div>";
  for(const s of G.series){
    const p=DATA.platform(s.platform);
    const last=s.seasons[s.seasons.length-1];
    const contOk=s.seasons.length>=2&&s.seasons.some(x=>x.viewership>=58);
    h+="<div class='card'><div class='spread'><div><b>📺 "+esc(s.title)+"</b> <span class='tag purple'>"+p.name+"</span>"+
      (s.format==="limited"?"<span class='tag blue'>limited</span>":"")+
      (s.seasons.length?"<span class='tag'>"+s.seasons.length+" season"+(s.seasons.length>1?"s":"")+"</span>":"")+"</div>"+
      "<div class='tiny muted'>"+gTag(s.genre)+" · "+s.eps+" eps × "+fmtM(s.perEp)+"</div></div>";
    if(s.phase==="shoot") h+="<div class='small' style='margin-top:6px'>🎬 Shooting S"+(s.seasons.length+1)+" — "+s.weeksLeft+" weeks left · burn "+fmtM(s.budget/Math.max(s.weeksLeft0||s.weeksLeft,1))+"/wk</div>";
    else if(s.phase==="airing") h+="<div class='small' style='margin-top:6px'>📡 Airing on "+p.name+"…</div>";
    else h+="<div class='small muted' style='margin-top:6px'>"+(s.status==="ended"?"Ended":"Between seasons")+(last?" · last season buzz "+last.viewership+"/100":"")+"</div>";
    if(last) h+="<div style='margin-top:6px'>"+meter(last.viewership,100)+"</div>";
    if(s.status==="ended"&&contOk) h+="<button class='btn btn-sm btn-alt' style='margin-top:8px' data-smovie='"+s.id+"'>🎬 Make a film continuation</button>";
    h+="</div>";
  }
  h+="<div class='section-title'>"+t("sec.platforms")+"</div><div class='grid g3'>";
  DATA.allPlatforms().forEach(p=>{
    h+="<div class='card platform-card'><div class='platform-logo' style='background:"+p.color+"'>"+p.logo+"</div><div><b>"+p.name+"</b>"+
      "<div class='tiny muted'>"+p.blurb+"</div><div class='tiny muted' style='margin-top:4px'>pays "+Math.round((p.generosity-1)*100+100)+"% · renews above "+p.renew+" buzz</div></div></div>";
  });
  h+="</div>";
  return h;
}
/* v3: your own streamer + live sports */
function viewStreamerCard(){
  let h="";
  if(!G.streamer){
    const ok=canLaunchStreamer();
    h+="<div class='card' style='border-left:3px solid var(--purple)'><div class='spread'><b>"+t("sec.streamer")+"</b>"+
      "<button class='btn btn-sm "+(ok?"btn-primary":"")+"' id='btnLaunchStream' "+(ok?"":"disabled")+">🚀 Launch — $250M · rep 40+</button></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Subscribers pay $0.5M per 1M subs weekly. Growth heads for a ceiling built from your library, franchises, sports & shows — starve it and churn bleeds 0.8%/wk. "+
      (G.studio.rep<40? "Needs reputation "+Math.round(G.studio.rep)+"/40.": ok? "Ready when you are.":"Needs $250M cash.")+"</div></div>";
  }else{
    const s=G.streamer, ceil=streamerCeiling();
    const starved=G.week-(s.lastContent||0)>6;
    h+="<div class='stat-hero'>"+
      statCard(fmtSubs(s.subs),t("stat.subs")+" · "+esc(s.name),"var(--purple)")+
      statCard(fmtSubs(ceil),"Subscriber ceiling")+
      statCard("+"+fmtM(s.subs*0.5)+"/wk","Streamer revenue","var(--green)")+
      statCard(fmtM(s.totalRev),"Lifetime revenue")+
      statCard(Math.round(G.sportsPower||0),"Sports power")+
      statCard((G.mySports.length? G.mySports.map(x=>DATA.SPORTS.find(d=>d.id===x.kind).emoji).join(" "):"—"),"Sports held")+
    "</div>"+
    "<div class='card'>"+meter(s.subs, ceil, "linear-gradient(90deg,#b48bff,#e0c3ff)")+
    "<div class='tiny muted' style='margin-top:4px'>"+(starved? "⚠️ Content-starved: churn is bleeding subscribers. Drop a library title or release day-and-date.":"Feeding schedule healthy. New content pauses churn.")+" Next sports auction: weeks 13/26/39/52.</div></div>";
    const movable=G.films.filter(f=>!f.soldTo&&!f.streamingOriginal&&!f.inTheaters&&!f.onOwnPlatform).slice(0,6);
    if(movable.length){
      h+="<div class='card'><b>📚 Library moves</b> <span class='tiny muted'>— push unsold films onto "+esc(s.name)+" (+subs)</span><div class='row' style='margin-top:6px'>";
      movable.forEach(f=>{ h+="<button class='btn btn-sm btn-alt' data-move='"+f.id+"'>"+esc(f.title)+"</button>"; });
      h+="</div></div>";
    }
  }
  return h;
}

/* ═══════════ VIEW: finance (v2: execs, IPO, mezz, forecast) ═══════════ */
function viewFinance(){
  const st=G.studio;
  const overhead=weeklyOverhead();
  let h="<div class='stat-hero'>"+
    statCard(fmtM(st.cash),"Cash","var(--gold2)")+
    statCard(fmtM(st.debt),"Debt","var(--red)")+
    statCard(fmtM(G.mezz||0),"Mezzanine","var(--red)")+
    statCard(fmtM(maxDebt()),t("stat.credit"))+
    statCard(fmtM(catalogValue()),t("stat.catalog"))+
    statCard(fmtM(overhead)+"/wk",t("stat.overhead"))+
  "</div>";
  h+=plCard();
  h+="<div class='section-title'>"+t("sec.forecast")+"</div>"+forecastCard();
  h+="<div class='grid g2'><div class='card'><h4>🏦 Credit facility</h4>"+
    "<p class='tiny muted'>Weekly interest "+(Math.round(interestRate()*10000)/100)+"% (≈"+Math.round(interestRate()*5200)+"%/yr"+(G.execs.cfo?", CFO discount applied":"")+")</p>"+
    "<div class='loan-row'><div class='small muted' style='margin:8px 0 4px'>Borrow</div><input type='range' id='fnLoan' min='10' max='"+Math.max(10,Math.round(maxDebt()-st.debt))+"' step='10' value='"+Math.round(Math.max(10,(maxDebt()-st.debt)/2))+"'><div class='spread'><b id='fnLoanV'></b><button class='btn btn-sm btn-primary' id='fnLoanGo'>"+t("btn.loan")+"</button></div></div>"+
    (st.debt>0? "<div class='loan-row'><div class='small muted' style='margin:12px 0 4px'>Repay</div><input type='range' id='fnRepay' min='1' max='"+Math.max(1,Math.min(Math.round(st.debt),Math.floor(st.cash)))+"' value='"+Math.max(1,Math.min(Math.round(st.debt/2),Math.floor(st.cash)))+"'><div class='spread'><b id='fnRepayV'></b><button class='btn btn-sm btn-alt' id='fnRepayGo'>"+t("btn.repay")+"</button></div></div>":"")+
    (G.investorDebt>0? "<div class='tiny' style='margin-top:10px'>🕴 Investor payout remaining: <b class='neg'>"+fmtM(G.investorDebt)+"</b> ($2.5M/wk auto)</div>":"")+
    "</div>";
  h+="<div class='card'><h4>📈 Career P&L</h4><div class='ledger'>"+
    "<div class='cost-line'><span>Films released</span><b>"+G.stats.films+"</b></div>"+
    "<div class='cost-line'><span>Seasons delivered</span><b>"+G.stats.seriesSeasons+"</b></div>"+
    "<div class='cost-line'><span>All-time WW gross</span><b>"+fmtM(G.stats.totalWW)+"</b></div>"+
    "<div class='cost-line'><span>Hits / flops</span><b class='pos'>"+G.stats.hits+"</b> / <b class='neg'>"+G.stats.flops+"</b></div>"+
    "<div class='cost-line'><span>Biggest opening</span><b>"+(G.stats.bestOpen?fmtG(G.stats.bestOpen)+" — "+esc(G.stats.bestFilm||""):"-")+"</b></div>"+
    "<div class='cost-line'><span>Net career profit (films)</span><b class='"+(G.stats.totalProfit>=0?"pos":"neg")+"'>"+(G.stats.totalProfit>=0?"+":"")+fmtM(G.stats.totalProfit)+"</b></div>"+
    "</div></div></div>";
  h+="<div class='section-title'>"+t("sec.corp")+"</div><div class='grid g3'>";
  h+="<div class='card'><b>🔔 IPO</b><div class='tiny muted' style='margin:4px 0 8px'>Raise $400M at reputation 60+. Shareholders punish weak quarters (−3 rep).</div>"+
    (G.ipo? "<span class='tag green'>public since Y"+(G.ipoYear||1)+"</span>" :
      st.rep>=60? "<button class='btn btn-sm btn-primary' id='btnIPO'>Ring the bell · +$400M</button>" : "<span class='tag'>needs rep "+Math.round(st.rep)+"/60</span>")+"</div>";
  h+="<div class='card'><b>🧨 Mezzanine debt</b><div class='tiny muted' style='margin:4px 0 8px'>Emergency money at 0.5%/week. Up to $150M, outside the credit line.</div>"+
    "<div class='row'>"+(G.mezz<150? "<button class='btn btn-sm btn-alt' id='btnMezz'>Draw $"+Math.min(50,150-Math.round(G.mezz))+"M</button>":"")+
    (G.mezz>0? "<button class='btn btn-sm btn-ghost' id='btnMezzRepay'>Repay $"+Math.min(Math.round(G.mezz),Math.floor(st.cash))+"M</button>":"")+"</div>"+
    (G.mezz>0?"<div class='tiny neg' style='margin-top:6px'>Burning "+fmtM(G.mezz*0.005)+"/wk in interest</div>":"")+"</div>";
  h+="<div class='card'><b>🧾 Inflation</b><div class='tiny muted' style='margin-top:4px'>The market compounds +2%/yr. Year "+yearOf(G.week)+" price level: ×"+infl().toFixed(2)+" on talent, budgets & rival slates.</div></div>";
  h+="</div>";
  h+="<div class='section-title'>"+t("sec.execs")+"</div><div class='grid g3'>";
  DATA.EXECS.forEach(e=>{
    const owned=!!G.execs[e.id];
    h+="<div class='card upg-card'><div class='u-i'>"+e.icon+"</div><div style='flex:1'><b>"+e.name+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+e.desc+" · salary "+fmtM(e.salary)+"/wk</div>"+
      (owned? "<span class='tag green'>✓ on staff</span>" : "<button class='btn btn-sm "+(st.cash>=e.hire?"btn-primary":"")+"' data-exec='"+e.id+"'>Hire · "+fmtM(e.hire)+"</button>")+"</div></div>";
  });
  h+="</div>";
  h+="<div class='section-title'>"+t("sec.invest")+"</div><div class='grid g3'>";
  DATA.UPGRADES.forEach(u=>{
    const owned=!!G.upgrades[u.id];
    h+="<div class='card upg-card'><div class='u-i'>"+u.icon+"</div><div style='flex:1'><b>"+u.name+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+u.desc+"</div>"+
      (owned? "<span class='tag green'>✓ built</span>" : "<button class='btn btn-sm "+(st.cash>=u.cost?"btn-primary":"")+"' data-upg='"+u.id+"'>"+fmtM(u.cost)+"</button>")+"</div></div>";
  });
  h+="</div>";
  return h;
}
function forecastCard(){
  const fc=cashflowForecast();
  const mx=Math.max(1,...fc.map(x=>Math.abs(x.net)));
  let h="<div class='card'><div class='pl-bars' style='height:80px'>";
  fc.forEach(x=>{ h+="<div class='pb "+(x.net>=0?"up":"down")+"' style='height:"+Math.max(6,Math.abs(x.net)/mx*100)+"%' title='"+dateLabel(x.w)+": "+(x.net>=0?"+":"")+fmtM(x.net)+"'></div>"; });
  h+="</div><div class='tiny muted' style='margin-top:6px'>Next 12 weeks, from what's already locked in (runs, burns, dated P&A, overhead, interest, streamer). Total: <b class='"+(fc.reduce((a,x)=>a+x.net,0)>=0?"pos":"neg")+"'>"+fmtM(fc.reduce((a,x)=>a+x.net,0))+"</b></div>";
  h+="<div class='ledger' style='margin-top:8px'>";
  fc.slice(0,4).forEach(x=>{
    h+="<div class='cost-line'><span>"+dateLabel(x.w)+" <span class='tiny muted'>"+x.items.slice(0,3).map(i=>esc(i.label)).join(", ")+(x.items.length>3?"…":"")+"</span></span><b class='"+(x.net>=0?"pos":"neg")+"'>"+(x.net>=0?"+":"")+fmtM(x.net)+"</b></div>";
  });
  h+="</div></div>";
  return h;
}
const PL_LABELS={theatrical:"🎬 Box office rentals", pvod:"🏠 Premium VOD", streaming:"📺 Streaming deals", series:"📺 Series licenses", empire:"🏰 Franchise & parks", library:"📚 Library licensing", presales:"🌍 Intl pre-sales", incentives:"🧾 Production incentives", production:"🎬 Production spend", marketing:"📣 Marketing (P&A)", talent:"🌟 Talent & fees", development:"📝 Development", overhead:"🏛 Overhead", interest:"🏦 Interest", studio:"🏗 Studio investment", streamer:"🛰 Your streamer", video:"📀 Home video", music:"🎵 Soundtracks", sports:"🏟 Sports rights", other:"❓ Other"};
function plCard(){
  const tx=G.weekTx||{};
  const cats=Object.keys(tx).filter(k=>Math.abs(tx[k])>=0.05);
  if(!cats.length && !G.txHistory.length) return "";
  const net=weekNet(tx);
  let h="<div class='card'><div class='spread'><h4 style='margin:0'>📊 This week's P&L <span class='tiny muted'>(live)</span></h4>"+
    "<b class='"+(net>=0?"pos":"neg")+"'>"+(net>=0?"+":"")+fmtM(net)+" net</b></div>";
  const inc=cats.filter(k=>tx[k]>0), cost=cats.filter(k=>tx[k]<0);
  if(inc.length){ h+="<div style='margin-top:8px'>"; inc.forEach(k=>h+="<div class='cost-line'><span>"+(PL_LABELS[k]||k)+"</span><b class='pos'>+"+fmtM(tx[k])+"</b></div>"); h+="</div>"; }
  if(cost.length){ h+="<div style='margin-top:6px'>"; cost.forEach(k=>h+="<div class='cost-line'><span>"+(PL_LABELS[k]||k)+"</span><b class='neg'>"+fmtM(tx[k])+"</b></div>"); h+="</div>"; }
  if((tx.financing||0)!==0) h+="<div class='tiny muted' style='margin-top:4px'>🏦 Financing (loans/investors, not P&L): "+fmtM(tx.financing)+"</div>";
  if(G.txHistory.length>1){
    const mx=Math.max(1,...G.txHistory.map(x=>Math.abs(x.net)));
    h+="<div class='tiny muted' style='margin-top:10px'>Net by week</div><div class='pl-bars'>"+
      G.txHistory.slice(-10).map(x=>"<div class='pb "+(x.net>=0?"up":"down")+"' style='height:"+Math.max(5,Math.abs(x.net)/mx*100)+"%' title='"+(x.net>=0?"+":"")+fmtM(x.net)+"'></div>").join("")+
      "</div>";
  }
  h+="</div>";
  return h;
}

/* ═══════════ view bindings ═══════════ */
function bindView(){
  $$("[data-dev]").forEach(b=>b.onclick=()=>{
    const idea=G.ideas.find(i=>i.id===+b.dataset.dev);
    if(idea){ beep("click"); startWizard(idea); }
  });
  const ps=$("#btnPitchSeries"); if(ps) ps.onclick=()=>{ beep("click"); startSeriesWizard(); };
  $$("[data-ip]").forEach(b=>b.onclick=()=>{ buyIp(+b.dataset.ip); beep("gold"); flashes(G.flash); render(); });
  const wr=$("#btnWrap"); if(wr) wr.onclick=()=>{
    if(G.studio.cash<20){ toast("Wrap deals cost $20M.","bad"); return; }
    spend("talent",20); G.wrapDeal=3; log("🎫 Wrap deal signed — next 3 pictures get −20% talent fees.","gold"); beep("gold"); render(); };
  const ag=$("#btnAgency"); if(ag) ag.onclick=()=>{
    if(G.studio.cash<30){ toast("Agency exclusives cost $30M.","bad"); return; }
    spend("talent",30); G.agencyExcl=G.week+104; log("🖋 Agency exclusive signed — all quotes −15% for 2 years.","gold"); beep("gold"); render(); };
  $$("[data-rehab]").forEach(b=>b.onclick=()=>{
    const tt=talentById(+b.dataset.rehab); if(!tt) return;
    if(G.studio.cash<5){ toast("Rehab costs $5M.","bad"); return; }
    spend("talent",5); tt.toxic=false; tt.rehabbed=true;
    log("🧘 "+tt.name+" completes rehab — the tabloids move on.","good"); beep("good"); flashes(G.flash); render();
  });
  $$("[data-rewrite]").forEach(b=>b.onclick=()=>{ rewriteScript(+b.dataset.rewrite); beep("click"); flashes(G.flash); render(); });
  $$("[data-screen]").forEach(b=>b.onclick=()=>{ beep("click"); screeningModal(+b.dataset.screen); });
  $$("[data-reshoot]").forEach(b=>b.onclick=()=>{ reshootFilm(+b.dataset.reshoot); beep("good"); flashes(G.flash); render(); });
  $$("[data-sched]").forEach(b=>b.onclick=()=>{ beep("click"); startScheduling(+b.dataset.sched); });
  $$("[data-shop]").forEach(b=>b.onclick=()=>{
    shopToStreamers(+b.dataset.shop); beep("click");
    if(G.pendingAuction){ render(); auctionModal(); }
  });
  $$("[data-rerelease]").forEach(b=>b.onclick=()=>{ rereleaseFilm(+b.dataset.rerelease); beep("gold"); flashes(G.flash); render(); });
  $$("[data-reboot]").forEach(b=>b.onclick=()=>{ rebootFilm(+b.dataset.reboot); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fyc]").forEach(b=>b.onclick=()=>{ fycFilm(+b.dataset.fyc); beep("gold"); flashes(G.flash); render(); });
  $$("[data-move]").forEach(b=>b.onclick=()=>{ libraryMove(+b.dataset.move); beep("good"); flashes(G.flash); render(); });
  $$("[data-smovie]").forEach(b=>b.onclick=()=>{ seriesMovieIdea(+b.dataset.smovie); beep("gold"); flashes(G.flash); switchTab("develop"); });
  const ls=$("#btnLaunchStream"); if(ls) ls.onclick=()=>{
    openModal("<h3>🛰 Name your streamer</h3><input id='streamName' type='text' maxlength='24' value='"+esc(G.studio.name+"+")+"' style='width:100%;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:11px;padding:12px;font-size:15px'>"+
      "<div class='tiny muted' style='margin:8px 0'>−$250M to launch. Subs pay $0.5M per 1M subs weekly; the ceiling grows with your library, franchises, sports & shows.</div>"+
      "<div class='modal-actions'><button class='btn btn-primary' id='goLaunch'>🚀 Launch</button></div>")
      .querySelector("#goLaunch").onclick=()=>{
        const nm=($("#streamName").value||G.studio.name+"+").trim();
        if(launchStreamer(nm)){ beep("gold"); flashes(G.flash); closeModal(); render(); }
      };
  };
  // empire bindings
  $$("[data-fr-merch]").forEach(b=>b.onclick=()=>{ upgradeMerch(+b.dataset.frMerch); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-park]").forEach(b=>b.onclick=()=>{ buildPark(+b.dataset.frPark); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-game]").forEach(b=>b.onclick=()=>{ sellGameRights(+b.dataset.frGame); beep("cash"); flashes(G.flash); render(); });
  $$("[data-fr-resort]").forEach(b=>b.onclick=()=>{ buildResort(+b.dataset.frResort); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-pub]").forEach(b=>b.onclick=()=>{ launchPublishing(+b.dataset.frPub); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-collab]").forEach(b=>b.onclick=()=>{ brandCollab(+b.dataset.frCollab); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-dtv]").forEach(b=>b.onclick=()=>{ dtvSequel(+b.dataset.frDtv); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-license]").forEach(b=>b.onclick=()=>{ licenseOut(+b.dataset.frLicense); beep("cash"); flashes(G.flash); render(); });
  $$("[data-fr-tv]").forEach(b=>b.onclick=()=>{ franchiseTvSpinoff(+b.dataset.frTv); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-spin]").forEach(b=>b.onclick=()=>{
    const fr=frById(+b.dataset.frSpin);
    if(fr){ beep("click"); startSpinoff(fr); }
  });
  $$("[data-fr-seq]").forEach(b=>b.onclick=()=>{
    const fr=frById(+b.dataset.frSeq);
    const ent=fr && fr.entries[fr.entries.length-1];
    const f=ent && G.films.find(x=>x.id===ent.filmId);
    if(f){ beep("click"); startSequel(f); }
    else if(fr){ beep("click"); startSpinoff(fr); }
  });
  const uni=$("#btnUniverse"); if(uni) uni.onclick=()=>{
    const two=G.franchises.slice().sort((a,b)=>b.tier-a.tier);
    if(two.length>=2) mergeUniverse(two[0].id, two[1].id);
    flashes(G.flash); render();
  };
  const cross=$("#btnCrossover"); if(cross) cross.onclick=()=>{
    const elig=G.franchises.filter(f=>f.tier>=3).sort((a,b)=>b.ww-a.ww);
    if(elig.length>=2) crossoverEvent(elig[0].id, elig[1].id);
    flashes(G.flash); render();
  };
  $$("[data-cancel]").forEach(b=>b.onclick=()=>{
    const p=G.projects.find(x=>x.id===+b.dataset.cancel); if(!p)return;
    G.projects=G.projects.filter(x=>x!==p);
    if(p.director){p.director.bookedUntil=0;p.director.booked=null;}
    p.cast.forEach(c=>{c.bookedUntil=0;c.booked=null;});
    G.studio.rep=clamp(G.studio.rep-2,5,99);
    log("🗑 Shelved “"+p.title+"”. Talent freed. Rep −2.","bad");
    beep("bad"); render();
  });
  $$("[data-seq]").forEach(b=>b.onclick=()=>{
    const f=G.films.find(x=>x.id===+b.dataset.seq);
    if(f){ beep("click"); startSequel(f); }
  });
  $$("[data-acc]").forEach(b=>b.onclick=()=>{ acceptOffer(G.offers.find(o=>o.id===+b.dataset.acc)); beep("gold"); flashes(G.flash); render(); });
  $$("[data-cnt]").forEach(b=>b.onclick=()=>{ counterOffer(G.offers.find(o=>o.id===+b.dataset.cnt)); beep("click"); flashes(G.flash); render(); });
  $$("[data-dec]").forEach(b=>b.onclick=()=>{ declineOffer(G.offers.find(o=>o.id===+b.dataset.dec)); beep("click"); render(); });
  $$("[data-upg]").forEach(b=>b.onclick=()=>{ buyUpgrade(b.dataset.upg); beep("gold"); render(); });
  $$("[data-exec]").forEach(b=>b.onclick=()=>{ hireExec(b.dataset.exec); beep("gold"); flashes(G.flash); render(); });
  const ipo=$("#btnIPO"); if(ipo) ipo.onclick=()=>{ if(doIPO()){ G.ipoYear=yearOf(G.week); beep("gold"); flashes(G.flash); render(); } };
  const mz=$("#btnMezz"); if(mz) mz.onclick=()=>{ takeMezz(50); beep("cash"); flashes(G.flash); render(); };
  const mzr=$("#btnMezzRepay"); if(mzr) mzr.onclick=()=>{ repayMezz(Math.min(Math.round(G.mezz),Math.floor(G.studio.cash))); beep("good"); flashes(G.flash); render(); };
  const ach=$("#btnAch"); if(ach) ach.onclick=()=>achievementsModal();
  // finance sliders
  const fl=$("#fnLoan");
  if(fl){ const upd=()=>$("#fnLoanV").textContent=fmtM(+fl.value); upd(); fl.oninput=upd;
    $("#fnLoanGo").onclick=()=>{ if(takeLoan(+fl.value)){beep("cash"); flashes(G.flash); render();} }; }
  const fr=$("#fnRepay");
  if(fr){ const upd=()=>$("#fnRepayV").textContent=fmtM(+fr.value); upd(); fr.oninput=upd;
    $("#fnRepayGo").onclick=()=>{ if(repayDebt(+fr.value)){beep("good"); flashes(G.flash); render();} }; }
}

/* ═══════════ streaming auction modal (v2: counters) ═══════════ */
function auctionModal(){
  const a=G.pendingAuction; if(!a) return;
  const p=G.projects.find(x=>x.id===a.projectId);
  let h="<h3>📺 Streaming auction — “"+esc(p?p.title:"?")+"”</h3>";
  if(p) h+="<div class='tiny muted' style='margin-bottom:4px'>"+DATA.GENRES[p.genre].name+" · score "+p.quality.overall+"/100 · budget "+fmtM(p.budget)+" · selling means <b>no theatrical run</b>"+(G.outputDeal>0?" · <span class='pos'>output deal +20% on sale</span>":"")+"</div>";
  a.bids.forEach((b,i)=>{
    const pl=DATA.platform(b.platform);
    h+="<div class='bid-card'><div class='platform-logo' style='background:"+pl.color+"'>"+pl.logo+"</div>"+
      "<div style='flex:1'><b>"+pl.name+"</b><div class='tiny muted'>"+pl.blurb+"</div></div>"+
      "<b class='modal-offer-val'>"+fmtM(b.value)+"</b>"+
      "<button class='btn btn-primary btn-sm' data-bid='"+i+"'>Accept</button></div>";
  });
  h+="<div class='modal-actions'>"+(a.countered?"":"<button class='btn btn-alt' id='aucCounter'>📈 Ask for more…</button>")+
    "<button class='btn btn-ghost' id='aucNo'>"+(a.manual? "Not now":"🎥 Keep it for theaters")+"</button></div>";
  const v=openModal(h,{locked:!a.manual, onClose:()=>{ if(G.pendingAuction && G.pendingAuction.manual) G.pendingAuction=null; }});
  v.querySelectorAll("[data-bid]").forEach(b=>b.onclick=()=>{
    acceptAuction(+b.dataset.bid); beep("gold"); flashes(G.flash); closeModal(); render();
  });
  const ct=v.querySelector("#aucCounter");
  if(ct) ct.onclick=()=>{ counterAuction(); beep("click"); flashes(G.flash); closeModal(); auctionModal(); render(); };
  const no=v.querySelector("#aucNo");
  if(no) no.onclick=()=>{ declineAuction(); beep("click"); closeModal(); render(); };
}

/* ═══════════ v3 sports auction modal ═══════════ */
function sportsModal(){
  const a=G.sportsAuction; if(!a) return;
  let h="<h3>🏟 Sealed-bid sports auction</h3>"+
    "<div class='tiny muted'>Quarterly rights auction (weeks 13/26/39/52). Sealed bids: beat the rival platform's hidden number to win. Wins bring instant subscribers and raise your streamer's ceiling.</div>";
  a.packs.forEach((p,i)=>{
    const k=DATA.SPORTS.find(s=>s.id===p.kind);
    h+="<div class='card' style='margin-top:8px'><div class='spread'><b>"+k.emoji+" "+k.name+"</b><span class='tag'>asking "+fmtM(p.ask)+"</span></div>"+
      "<div class='loan-row'><input type='range' class='sportBid' data-i='"+i+"' min='60' max='200' step='5' value='"+Math.min(200,Math.max(60,p.ask))+"'>"+
      "<div class='spread'><b class='sportBidV'>"+fmtM(Math.min(200,Math.max(60,p.ask)))+"</b>"+
      "<button class='btn btn-sm btn-primary' data-bidSports='"+i+"'>Submit sealed bid</button></div></div></div>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='sportsSkip'>Pass this quarter</button></div>";
  const v=openModal(h,{noX:true,locked:true});
  v.querySelectorAll(".sportBid").forEach(r=>r.oninput=()=>{ r.closest(".card").querySelector(".sportBidV").textContent=fmtM(+r.value); });
  v.querySelectorAll("[data-bidSports]").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.bidSports;
    const slider=v.querySelector(".sportBid[data-i='"+i+"']");
    bidSports(i, +slider.value);
    beep("cash"); flashes(G.flash);
    if(G.sportsAuction && G.sportsAuction.packs.length){ closeModal(); sportsModal(); } else { closeModal(); render(); }
  });
  v.querySelector("#sportsSkip").onclick=()=>{ skipSports(); beep("click"); closeModal(); render(); };
}

/* ═══════════ EMPIRE view (v3 lifecycle) ═══════════ */
function viewEmpire(){
  let h="";
  const weekly=G.franchises.reduce((a,f)=>a+frWeeklyIncome(f),0);
  const earned=G.franchises.reduce((a,f)=>a+(f.earned||0),0);
  const ww=G.franchises.reduce((a,f)=>a+f.ww,0);
  h+="<div class='stat-hero'>"+
    statCard(G.franchises.length,"Franchises")+
    statCard("+"+fmtM(weekly)+"/wk","Empire income","var(--green)")+
    statCard(fmtM(earned),"Empire earnings")+
    statCard(fmtG(ww),"Franchise WW gross")+
  "</div>";
  if(G.universeBonus) h+="<div class='card' style='border-left:3px solid var(--gold)'><b>🌌 Shared universe active</b> — all franchise income +15%, forever.</div>";
  else if(G.franchises.length>=2){
    h+="<div class='card'><div class='spread'><div><b>🌌 Weave a Shared Universe — $150M</b><div class='tiny muted'>Merge your two biggest franchises. All franchise income +15% forever.</div></div>"+
      "<button class='btn btn-sm "+(G.studio.cash>=150?"btn-primary":"")+"' id='btnUniverse'>Merge top two</button></div></div>";
  }
  const crossOk=G.franchises.filter(f=>f.tier>=3);
  if(crossOk.length>=2){
    h+="<div class='card'><div class='spread'><div><b>💥 Crossover event — $40M</b><div class='tiny muted'>Two tier-3+ brands collide: a +45% buzz tentpole lands in Develop.</div></div>"+
      "<button class='btn btn-sm "+(G.studio.cash>=40?"btn-primary":"")+"' id='btnCrossover'>Mount the crossover</button></div></div>";
  }
  if(!G.franchises.length){
    h+="<div class='card muted small'>No franchises yet. Land a theatrical <b>hit</b> — roughly 2× breakeven worldwide with reviews ≥66 — and the brand unlocks here: sequels, spin-offs, 🧸 merch, 🎮 games, 🎡 parks, 🏝 resorts and 📚 publishing. Brand heat is visible: cold franchises open weak.</div>";
  }
  for(const fr of G.franchises){
    const g=DATA.GENRES[fr.genre]||{merch:1,emoji:"🎞"};
    const inc=frWeeklyIncome(fr);
    const heatPct=Math.round(fr.decay*100);
    const heatTag=fr.decay>=0.85?"<span class='tag gold'>🔥 hot</span>":fr.decay>=0.5?"<span class='tag'>warm</span>":"<span class='tag red'>❄ cold — opens weak</span>";
    h+="<div class='card'><div class='fr-head'><div class='fr-emblem'>"+g.emoji+"</div>"+
      "<div style='flex:1;min-width:180px'><b>"+esc(fr.name)+"</b> <span class='tag gold'>tier "+fr.tier+"</span> "+heatTag+
      "<div class='tiny muted'>"+fr.entries.length+" franchise hit"+(fr.entries.length>1?"s":"")+" · "+fmtG(fr.ww)+" WW · merch potential "+Math.round((g.merch||1)*100)+"%</div>"+
      "<div style='margin-top:4px'>"+meter(fr.decay,1, fr.decay>=0.5?"linear-gradient(90deg,#f5b942,#ffd479)":"linear-gradient(90deg,#5aa2ff,#9cc7ff)")+"<span class='tiny muted'>brand heat "+heatPct+"% — rebuilt by new releases</span></div></div>"+
      "<div style='text-align:right'><b class='"+(inc>=0.1?"pos":"muted")+"'>"+(inc>=0.1?"+"+fmtM(inc)+"/wk":"—")+"</b>"+
      "<div class='tiny muted'>"+(woyOf(G.week)>=47?"🎄 toy spike ×1.4":"")+"</div></div></div>"+
      "<div class='fr-meters'>"+
        frMeter("🧸 Merchandise", pips(fr.merch,3))+
        frMeter("🎡 Theme park", fr.tier>=2? pips(fr.park,2) : "<span class='tiny muted'>needs tier 2</span>")+
        frMeter("🎮 Game rights", fr.gameSold===fr.tier? "<span class='tiny pos'>licensed</span>":"<span class='tiny muted'>available</span>")+
        frMeter("🏝 Resort", fr.resort? "<span class='tiny pos'>open</span>":"<span class='tiny muted'>"+(fr.park>=1?"available":"needs park")+"</span>")+
        frMeter("📚 Publishing", fr.publishing? "<span class='tiny pos'>live</span>":"<span class='tiny muted'>$15M</span>")+
        frMeter("💰 Earned", fmtM(fr.earned||0))+
      "</div><div class='fr-actions'>"+
      "<button class='btn btn-sm btn-primary' data-fr-seq='"+fr.id+"'>⚡ Sequel</button>"+
      "<button class='btn btn-sm btn-alt' data-fr-spin='"+fr.id+"'>🧬 Spin-off (45% budget)</button>"+
      (fr.merch<3? "<button class='btn btn-sm btn-alt' data-fr-merch='"+fr.id+"'>🧸 "+(fr.merch?"Upgrade merch":"Launch merch")+" · "+fmtM(merchCost(fr))+"</button>" : "")+
      (fr.park<2&&fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-park='"+fr.id+"'>🎡 "+(fr.park?"Expand park":"Build attraction")+" · "+fmtM(parkCost(fr))+"</button>":"")+
      (fr.gameSold!==fr.tier? "<button class='btn btn-sm btn-alt' data-fr-game='"+fr.id+"'>🎮 License game rights</button>":"")+
      ((fr.collabAt||0)<=G.week? "<button class='btn btn-sm btn-alt' data-fr-collab='"+fr.id+"'>🤝 Brand collab · $6M</button>":"")+
      ((fr.dtvAt||0)<=G.week? "<button class='btn btn-sm btn-alt' data-fr-dtv='"+fr.id+"'>📀 DTV sequel · $12–22M</button>":"")+
      ((fr.licenseAt||0)<=G.week? "<button class='btn btn-sm btn-alt' data-fr-license='"+fr.id+"'>🤝 License out to rival</button>":"")+
      (fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-tv='"+fr.id+"'>📺 TV spin-off pitch</button>":"")+
      (!fr.resort&&fr.park>=1? "<button class='btn btn-sm btn-alt' data-fr-resort='"+fr.id+"'>🏝 Resort & cruise · $400M</button>":"")+
      (!fr.publishing? "<button class='btn btn-sm btn-ghost' data-fr-pub='"+fr.id+"'>📚 Publishing · $15M</button>":"")+
      "</div></div>";
  }
  h+="<div class='card'><b>"+t("emp.how")+"</b><div class='small muted' style='margin-top:4px'>Merch & parks pay every week (×1.4 toy spike in weeks 47–52) and re-heat whenever a franchise film hits theaters. Cold franchises open weak — keep them warm with releases, DTV sequels, collabs. Game rights & licensing are burst cash. Resorts need a park; publishing arms are cheap upkeep.</div></div>";
  return h;
}
function frMeter(l,v){ return "<div class='fr-meter'><div class='fm-v'>"+v+"</div><div class='fm-l'>"+l+"</div></div>"; }
function pips(n,max){ let s="<span class='pips'>"; for(let i=1;i<=max;i++) s+= i<=n? "●":"<span class='off'>●</span>"; return s+"</span>"; }

/* ═══════════ achievements modal ═══════════ */
function achievementsModal(){
  let h="<h3>"+t("ach.title")+" — "+Object.keys(G.ach).length+"/"+DATA.ACH.length+"</h3><div class='grid g2'>";
  DATA.ACH.forEach(a=>{
    const got=!!G.ach[a.id];
    h+="<div class='card' style='"+(got?"border-color:var(--goldDim)":"opacity:.75")+"'><div class='spread'><b>"+a.icon+" "+a.name+"</b>"+
      (got?"<span class='tag gold'>✓ "+dateLabel(G.ach[a.id])+"</span>":"<span class='tag'>"+t("ach.locked")+"</span>")+"</div>"+
      "<div class='tiny muted'>"+a.desc+"</div></div>";
  });
  h+="</div><div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>"+t("btn.close")+"</button></div>";
  openModal(h);
}

/* ═══════════ settings modal (v2: lang, text size, auto, save codes, slots) ═══════════ */
function settingsModal(){
  let h="<h3>"+t("set.title")+"</h3>";
  h+="<div class='card'><div class='spread'><b>"+t("set.lang")+"</b><div class='row'>"+
    "<button class='btn btn-sm "+(LANG==="en"?"btn-primary":"")+"' id='langEn'>English</button>"+
    "<button class='btn btn-sm "+(LANG==="hi"?"btn-primary":"")+"' id='langHi'>हिन्दी</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Menus & chrome translate fully; long news copy stays in English.</div></div>";
  h+="<div class='card'><div class='spread'><b>"+t("set.font")+"</b><div class='row'>"+
    "<button class='btn btn-sm' id='fontMinus'>A−</button><button class='btn btn-sm' id='fontReset'>A</button><button class='btn btn-sm' id='fontPlus'>A+</button></div></div></div>";
  h+="<div class='card'><div class='spread'><b>"+t("set.saves")+"</b></div>"+
    "<div class='row' style='margin-top:8px'><button class='btn btn-sm btn-alt' id='btnExport'>"+t("set.export")+"</button>"+
    "<button class='btn btn-sm btn-alt' id='btnImport'>"+t("set.import")+"</button></div>"+
    "<textarea id='saveCode' rows='3' placeholder='paste an import code here…' style='width:100%;margin-top:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:10px;padding:8px;font-size:11px'></textarea>"+
    "<div class='row' style='margin-top:8px'><span class='small muted'>"+t("set.slot")+":</span>"+
    [1,2,3].map(n=>"<button class='btn btn-sm "+((G.slot||1)===n?"btn-primary":"")+"' data-saveslot='"+n+"'>Slot "+n+"</button>").join("")+"</div></div>";
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='btnToMenu'>"+t("set.menu")+"</button>"+
    "<button class='btn btn-primary' onclick='closeModal()'>"+t("btn.close")+"</button></div>";
  const v=openModal(h);
  v.querySelector("#langEn").onclick=()=>{ setLang("en"); beep("click"); closeModal(); settingsModal(); render(); };
  v.querySelector("#langHi").onclick=()=>{ setLang("hi"); beep("click"); closeModal(); settingsModal(); render(); };
  const curFont=()=>parseFloat(localStorage.getItem("bow_font")||"15px");
  const setFont=(px)=>{ localStorage.setItem("bow_font",px+"px"); document.documentElement.style.fontSize=px+"px"; };
  v.querySelector("#fontMinus").onclick=()=>setFont(Math.max(12,curFont()-1));
  v.querySelector("#fontPlus").onclick=()=>setFont(Math.min(20,curFont()+1));
  v.querySelector("#fontReset").onclick=()=>setFont(15);
  v.querySelector("#btnExport").onclick=()=>{
    const ta=v.querySelector("#saveCode"); ta.value=exportCode(); ta.select();
    try{ navigator.clipboard&&navigator.clipboard.writeText(ta.value); }catch(e){}
    toast("Save code ready — copy it somewhere safe.","good");
  };
  v.querySelector("#btnImport").onclick=()=>{
    const code=v.querySelector("#saveCode").value;
    if(importCode(code)){ toast("Save imported!","good"); closeModal(); render(); }
    else toast("That code didn't parse.","bad");
  };
  v.querySelectorAll("[data-saveslot]").forEach(b=>b.onclick=()=>{
    G.slot=+b.dataset.saveslot; saveGame(); beep("click"); toast("Saved to slot "+G.slot,"good"); closeModal(); settingsModal();
  });
  v.querySelector("#btnToMenu").onclick=()=>{ saveGame(); if(AUTO)toggleAuto(false); location.reload(); };
}

/* ═══════════ choice / report / gameover modals ═══════════ */
function choiceModal(){
  const c=G.pendingChoice; if(!c) return;
  let h="<div style='text-align:center;font-size:44px'>"+c.icon+"</div><h3 style='text-align:center'>"+esc(c.title)+"</h3>"+
    "<p class='small muted' style='text-align:center'>"+esc(c.text)+"</p><div class='modal-actions'>";
  c.choices.forEach(ch=>{ h+="<button class='btn btn-alt' data-ch='"+ch.i+"'>"+esc(ch.label)+"</button>"; });
  h+="</div>";
  const v=openModal(h,{noX:true,locked:true});
  v.querySelectorAll("[data-ch]").forEach(b=>b.onclick=()=>{ resolveChoice(+b.dataset.ch); closeModal(); beep("click"); flashes(G.flash); render(); });
}
function reportModal(){
  const r=G.pendingReport; if(!r) return;
  G.pendingReport=null;
  let h="<div style='text-align:center'><div style='font-size:44px'>🏆</div><h3>Year "+r.year+" — "+DATA.AWARDS+"</h3></div>";
  h+="<div class='card'><div class='cost-line'><span>Your worldwide gross</span><b>"+fmtM(r.myWW)+"</b></div>"+
    "<div class='cost-line'><span>Films released</span><b>"+r.filmsReleased+"</b></div>"+
    "<div class='cost-line'><span>Film net (released this yr)</span><b class='"+(r.profit>=0?"pos":"neg")+"'>"+(r.profit>=0?"+":"")+fmtM(r.profit)+"</b></div></div>";
  h+="<div class='section-title'>Market share</div><div class='card'>";
  r.standings.forEach((s,i)=>{ h+="<div class='cost-line'><span>"+(i+1)+". "+(s.me?"⭐ ":"")+esc(s.name)+"</span><b>"+fmtM(s.ww)+"</b></div>"; });
  h+="</div>";
  h+="<div class='section-title'>Nominations & wins</div><div class='card'>";
  if(r.awards.noms.length){
    r.awards.noms.forEach(n=>{ h+="<div class='cost-line'><span>"+(n.mine?"🎬 ":"🎞 ")+esc(n.title)+(n.mine?"":" <span class='tiny muted'>— "+esc(n.studio||"")+"</span>")+"</span>"+(n.mine?"<span class='tag gold'>nominee</span>":"")+"</div>"; });
    r.awards.wins.forEach(w=>{ h+="<div class='cost-line'><span>🏆 "+w.cat+"</span><b>"+esc(w.film)+(w.mine?" 🎉":"")+"</b></div>"; });
  }else h+="<div class='muted small'>No nominations.</div>";
  h+="</div><div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Roll credits → Year "+(r.year+1)+"</button></div>";
  openModal(h,{noX:true});
  beep("gold");
}
function gameOverModal(){
  const o=G.over; if(!o) return;
  let h="<div class='gameover-wrap'><div class='go-i'>🎬</div><h2>"+esc(o.title)+"</h2>"+
    "<p class='muted'>"+esc(o.text)+"</p></div>"+
    "<div class='card'><div class='ledger'>"+
    "<div class='cost-line'><span>Weeks survived</span><b>"+o.week+"</b></div>"+
    "<div class='cost-line'><span>Films released</span><b>"+o.stats.films+"</b></div>"+
    "<div class='cost-line'><span>All-time WW gross</span><b>"+fmtM(o.stats.totalWW)+"</b></div>"+
    "<div class='cost-line'><span>Biggest opening</span><b>"+(o.stats.bestOpen?fmtG(o.stats.bestOpen)+" — "+esc(o.stats.bestFilm||""):"-")+"</b></div>"+
    "<div class='cost-line'><span>Awards</span><b>"+((o.stats.awards||[]).map(a=>a.cat).join(", ")||"none")+"</b></div>"+
    "<div class='cost-line'><span>Achievements</span><b>"+Object.keys(G.ach).length+"/"+DATA.ACH.length+"</b></div>"+
    "</div></div><div class='modal-actions'><button class='btn btn-primary' id='goNew'>🎬 Found a new studio</button></div>";
  const v=openModal(h,{noX:true,locked:true});
  v.querySelector("#goNew").onclick=()=>{ try{localStorage.removeItem("bow_save");}catch(e){} location.reload(); };
}

/* ═══════════ help ═══════════ */
function helpModal(){
  let h="<h3>"+t("help.title")+"</h3>"+
  "<div class='card'><b>1. 📝 Develop</b><p class='small muted'>Buy a script (or 📚 IP rights: books, comics, true stories), attach a director (quality; auteurs +5 craft but refuse sequels) and stars (opening weekend), set a budget, rating (R = −12% open, critics +4), shoot location (Atlanta 14% / London 18% weekly rebates) and go foreign-language for prestige.</p></div>"+
  "<div class='card'><b>2. 🛠 Polish before release</b><p class='small muted'>Rewrite scripts in pre-production (+script, +1 week). Test-screen finished films; reshoot the weak spots. Add a 🌟 cameo for 30% of a superstar's fee.</p></div>"+
  "<div class='card'><b>3. 📅 Date it like a pro</b><p class='small muted'>Corridors multiply openings; check the calendar — rivals may blink off your weekend. Choose wide vs platform, staggered intl, 17/45/90-day windows (they move exhibitor relations ±5% on openings), IMAX (+12% open), soundtracks, even day-and-date on your own streamer.</p></div>"+
  "<div class='card'><b>4. 📊 Box office math</b><p class='small muted'>Opening = stars × marketing × season × competition × craft choices. Legs come from quality. Studio keeps ≈53% dom / ≈42% intl → breakeven ≈ (budget + P&A) ÷ 0.48 WW. After the run: PVOD, then pay-1 TV at week +6 (6% of WW). China's censor board can trim china-heavy films.</p></div>"+
  "<div class='card'><b>5. 📺 OTT & your own streamer</b><p class='small muted'>Shop finished films (auction — you can counter), take output deals (+20% ×3), pitch series incl. reality/documentary and limited events. At rep 40 launch your own streamer ($250M): subs pay $0.5M/1M subs weekly, grow toward a ceiling, churn when starved. Buy live sports quarterly for instant subs.</p></div>"+
  "<div class='card'><b>6. 🏰 Franchise lifecycle</b><p class='small muted'>Hits unlock brands with visible heat: sequels, 45%-budget spin-offs, merch, games, parks, resorts, publishing, DTV upkeep, collabs, licensing to rivals, TV spin-offs — plus shared universes (+15% forever) and tier-3 crossovers (+45% buzz). Old library titles can be re-released (104-wk cooldown) or rebooted.</p></div>"+
  "<div class='card'><b>7. 💼 The office</b><p class='small muted'>Hire a CMO (+12% hype), casting head (−10% fees, anti-poaching), CFO (−30% interest). IPO at rep 60 (+$400M, shareholders judge quarters). Mezzanine debt at 0.5%/wk. Watch the 12-week forecast. Inflation compounds 2%/yr.</p></div>"+
  "<div class='card'><b>8. 🏆 Prestige & meta</b><p class='small muted'>4 festivals a year, FYC campaigns weeks 48–52, then the Golden Reels. 15 achievements, 3 scenarios, 3 difficulties, sandbox, 3 save slots, export/import codes, 🌐 Hindi/English toggle, auto-play and PWA offline install.</p></div>"+
  "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Lights down, head rolled 🎬</button></div>";
  openModal(h,{noX:true});
}
