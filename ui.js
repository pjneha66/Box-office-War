/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — ui.js (rendering + interaction)
   ═══════════════════════════════════════════════════════════ */
"use strict";

let TAB = "studio";
let WZ = null;          // greenlight/pitch wizard state
let SCHEDULE = null;    // release scheduling state
let SOUND = true;

/* ═══════════ tiny sound synth (WebAudio, no assets) ═══════════ */
let AC = null;
function ac(){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==="suspended") AC.resume();
    return AC;
  }catch(e){ return null; }
}
function toneAt(c,f,when,dur,type,vol,slide){
  const o=c.createOscillator(), g=c.createGain();
  o.type=type||"sine";
  o.frequency.setValueAtTime(Math.max(30,f),when);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),when+dur);
  g.gain.setValueAtTime(0.0001,when);
  g.gain.linearRampToValueAtTime(vol,when+0.009);
  g.gain.exponentialRampToValueAtTime(0.001,when+dur);
  o.connect(g); g.connect(c.destination);
  o.start(when); o.stop(when+dur+0.05);
}
function noiseAt(c,when,dur,vol,freq){
  const len=Math.max(1,Math.floor(c.sampleRate*dur));
  const buf=c.createBuffer(1,len,c.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src=c.createBufferSource(); src.buffer=buf;
  const f=c.createBiquadFilter(); f.type="bandpass"; f.frequency.value=freq||2400; f.Q.value=0.8;
  const g=c.createGain(); g.gain.value=vol;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(when);
}
const SFX = {
  click(c,t){ toneAt(c,660,t,0.05,"sine",0.07); },
  good(c,t){ [523,659,784].forEach((f,i)=>toneAt(c,f,t+i*0.055,0.1,"sine",0.07)); },
  gold(c,t){ [659,880,1109,1319].forEach((f,i)=>toneAt(c,f,t+i*0.06,0.12,"triangle",0.075)); },
  bad(c,t){ toneAt(c,220,t,0.16,"sawtooth",0.05,160); toneAt(c,160,t+0.13,0.2,"sawtooth",0.045,110); },
  /* ka-ching: drawer click + two bright bell notes */
  cashreg(c,t){ noiseAt(c,t,0.045,0.13,3400); toneAt(c,988,t+0.05,0.09,"square",0.04); toneAt(c,1319,t+0.13,0.24,"triangle",0.085); toneAt(c,1976,t+0.13,0.18,"sine",0.05); },
  /* opening-weekend fanfare: rising triad + held top note + fifth underlay */
  fanfare(c,t){
    const seq=[[392,0,.12],[523,.12,.12],[659,.24,.12],[784,.36,.28],[1047,.66,.42]];
    seq.forEach(([f,dt,d])=>{ toneAt(c,f,t+dt,d,"triangle",0.09); toneAt(c,f/2,t+dt,d,"sine",0.045); });
    toneAt(c,1568,t+0.98,0.35,"sine",0.045);
    noiseAt(c,t+0.66,0.16,0.05,5200);
  },
  /* award-show drum roll into a hit */
  drums(c,t){
    [220,196,175,165,147,131].forEach((f,i)=>toneAt(c,f,t+i*0.09,0.1,"triangle",0.13,f*0.55));
    toneAt(c,110,t+0.58,0.42,"triangle",0.16,55);
    noiseAt(c,t+0.58,0.5,0.08,1100);
  },
  /* slate clap for greenlights */
  clap(c,t){ noiseAt(c,t,0.05,0.15,1700); toneAt(c,130,t,0.1,"sine",0.12,60); },
};
function beep(kind){
  if(!SOUND) return;
  const c=ac(); if(!c) return;
  try{ (SFX[kind==="cash"?"cashreg":kind]||SFX.click)(c, c.currentTime+0.01); }catch(e){}
}

/* ═══════════ confetti (DOM, respects reduced-motion) ═══════════ */
function confetti(n){
  try{
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  }catch(e){}
  const root=document.createElement("div");
  root.className="confetti-root";
  const colors=["#f5b942","#ffd479","#ff5d6c","#4dd6e8","#b48bff","#3ddc84","#ffffff"];
  for(let i=0;i<(n||110);i++){
    const s=document.createElement("span");
    s.className="cf";
    s.style.left=(Math.random()*100)+"vw";
    s.style.background=colors[i%colors.length];
    const sz=6+Math.random()*7;
    s.style.width=sz+"px"; s.style.height=(sz*(Math.random()<0.5?1:0.5))+"px";
    if(Math.random()<0.3) s.style.borderRadius="50%";
    s.style.animationDuration=(1.7+Math.random()*1.5)+"s";
    s.style.animationDelay=(Math.random()*0.35)+"s";
    root.appendChild(s);
  }
  document.body.appendChild(root);
  setTimeout(()=>root.remove(), 3800);
}

/* ═══════════ helpers ═══════════ */
const $ = s=>document.querySelector(s);
const $$ = s=>[...document.querySelectorAll(s)];
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function stars(n){ let s=""; for(let i=1;i<=5;i++) s+= i<=n? "★":"<span class='off'>★</span>"; return "<span class='stars'>"+s+"</span>"; }
function meter(v, max, cls){ return "<div class='bar'><i style='width:"+clamp(v/max*100,2,100)+"%"+(cls?";background:"+cls:"")+"'></i></div>"; }
function gTag(genre){ const g=DATA.GENRES[genre]; return "<span class='tag blue'>"+g.emoji+" "+g.name+"</span>"; }
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
/* toasts + the feel-good layer: stingers & confetti driven by log kinds */
function flashes(list){
  const kinds=new Set();
  (list||[]).forEach(f=>{ toast(f.t,f.k); if(f.k) kinds.add(f.k); });
  if(kinds.has("smash")){ beep("fanfare"); confetti(140); }
  else if(kinds.has("award")){ beep("drums"); confetti(110); }
  else if(kinds.has("fanfare")){ beep("fanfare"); }
}

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
  if(hasSave()) $("#btnContinue").style.display="block";
  $("#btnContinue").onclick=()=>{
    const g=loadGame();
    if(g){ enterApp(); }
    else{ toast("That save file was corrupted or too old to migrate — start a fresh studio.","bad"); beep("bad"); }
  };
  $("#btnStart").onclick=()=>{
    const nm=($("#studioName").value||"Parallax Pictures").trim().slice(0,26);
    newGame(archSel, nm); enterApp(true);
  };
  // topbar
  $("#btnWeek").onclick=()=>{ doWeek(1); };
  $("#btnFast").onclick=()=>{ doWeek(4); };
  $("#btnSound").onclick=()=>{ SOUND=!SOUND; localStorage.setItem("bow_snd", SOUND?"1":"0");
    $("#btnSound").textContent=SOUND?"🔊":"🔇"; beep("click"); };
  SOUND = localStorage.getItem("bow_snd")!=="0"; $("#btnSound").textContent=SOUND?"🔊":"🔇";
  $("#btnHelp").onclick=()=>helpModal();
  // tabs
  $$(".tab,.btab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  // long-press fast on mobile
  let lp=null;
  $("#btnWeek").addEventListener("touchstart",()=>{ lp=setTimeout(()=>{ doWeek(4); lp="done"; },600); },{passive:true});
  $("#btnWeek").addEventListener("touchend",()=>{ if(lp&&lp!=="done"){clearTimeout(lp);} lp=null; });
});
function enterApp(fresh){
  $("#startScreen").style.display="none";
  $("#app").style.display="flex";
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
  else if(G.pendingReport) reportModal();
  else if(G.over) gameOverModal();
}

/* ═══════════ top chips + render router ═══════════ */
function render(){
  if(!G) return;
  $("#brandName").textContent=G.studio.name;
  $("#chipCash").textContent=fmtM(G.studio.cash);
  $("#chipDebt").textContent=fmtM(G.studio.debt);
  $("#chipDebtWrap").style.display = G.studio.debt>0.5? "":"none";
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
    statCard(fmtM(st.cash),"Cash on hand")+
    statCard((lastNet>=0?"+":"")+fmtM(lastNet),"Last week net", lastNet>=0?"var(--green)":"var(--red)")+
    statCard(fmtM(st.debt),"Debt","var(--red)")+
    statCard(Math.round(st.rep)+"/100","Reputation","var(--gold2)")+
    statCard(fmtM(catalogValue()),"Catalog value")+
    statCard(G.stats.films,"Films released")+
    statCard(fmtM(G.stats.totalWW),"All-time WW gross")+
  "</div>";
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
  // ── Market pulse: genre demand cycle ──
  const trows=Object.keys(DATA.GENRES).map(k=>({k,h:trendOf(k)})).sort((a,b)=>b.h-a.h);
  h+="<div class='section-title'>Market pulse — what audiences crave <span class='tiny' style='text-transform:none;letter-spacing:0'>(drives every opening)</span></div><div class='card'>";
  trows.slice(0,3).concat(trows.slice(-2)).forEach((r,i)=>{
    const g=DATA.GENRES[r.k];
    const hot=r.h>=1.12, cold=r.h<=0.88;
    const pct=Math.round((r.h-0.5)/1.0*100);
    h+="<div class='pulse-row'><div class='pulse-name'>"+g.emoji+" "+g.name+"</div>"+
      "<div class='cb-track'><div class='cb-fill pulse-fill' style='width:"+clamp(pct,8,100)+"%;background:"+(hot?"linear-gradient(90deg,#ff9f43,#ff5d6c)":cold?"linear-gradient(90deg,#4a6a9e,#5aa2ff)":"#4a5570")+";animation-delay:"+(i*60)+"ms'>×"+r.h.toFixed(2)+"</div></div>"+
      "<div class='pulse-tag'>"+(hot?"<span class='tag hot'>hot</span>":cold?"<span class='tag cold'>cold</span>":"<span class='tag'>steady</span>")+"</div></div>";
  });
  h+="</div>";
  h+="<div class='section-title'>Market share — Year "+yr+" (worldwide gross)</div><div class='card'>";
  const rows=[{name:G.studio.name, ww:myYtd, me:true}].concat(G.rivals.map(r=>({name:r.name, ww:r.ytd})));
  const max=Math.max(1,...rows.map(r=>r.ww));
  rows.sort((a,b)=>b.ww-a.ww).forEach((r,i)=>{
    h+="<div class='chart-bar' style='margin:5px 0'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(r.me?"⭐ ":"")+esc(r.name)+"</div></div>"+
       "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(6,r.ww/max*100)+"%;background:"+(r.me?"linear-gradient(90deg,#f5b942,#ffd479)":"#4a5570")+" ;animation-delay:"+(i*70)+"ms'>"+fmtM(r.ww)+"</div></div></div>";
  });
  h+="</div>";
  h+="<div class='section-title'>Industry feed</div><div class='newsfeed'>";
  if(!G.news.length) h+="<div class='muted small'>No news yet. Make some.</div>";
  G.news.slice(0,40).forEach(n=>{
    h+="<div class='news-item "+n.k+"'><span class='n-i'>"+n.t.split(" ")[0]+"</span><span>"+esc(n.t.slice(n.t.split(" ")[0].length))+"</span><span class='n-w'>"+dateLabel(n.w)+"</span></div>";
  });
  h+="</div>";
  return h;
}
function statCard(v,l,c){ return "<div class='stat'><div class='s-v' style='"+(c?"color:"+c:"")+"'>"+v+"</div><div class='s-l'>"+l+"</div></div>"; }

/* ═══════════ VIEW: develop ═══════════ */
function viewDevelop(){
  let h="";
  h+="<div class='spread'><div class='section-title' style='margin:0'>Script market</div>"+
     "<button class='btn btn-sm' id='btnPitchSeries'>📺 Pitch a Series</button></div>";
  h+="<div class='grid g2' style='margin-top:8px'>";
  for(const i of G.ideas){
    const S=DATA.SCALES[i.scale];
    h+="<div class='card idea-card'><div class='spread'><h4>"+(DATA.GENRES[i.genre].emoji)+" "+esc(i.title)+"</h4>"+
      (i.hot?"<span class='tag red'>🔥 Hot spec</span>":"")+"</div>"+
      "<div class='idea-blurb'>“"+esc(i.blurb)+"”</div>"+
      "<div class='idea-meta'>"+gTag(i.genre)+"<span class='tag'>"+S.emoji+" "+S.name+"</span>"+
      "<span class='tag "+(i.script>=75?"green":i.script>=60?"gold":"")+"'>📝 Script "+i.script+"</span>"+
      trendTag(i.genre)+"</div>"+
      "<div class='row' style='margin-top:10px'><span class='small muted'>Est. budget "+fmtM(neededBudget(i.genre,i.scale))+" · dev rights "+fmtM(devCostOf(i))+"</span></div>"+
      "<button class='btn btn-primary' style='margin-top:10px;width:100%' data-dev='"+i.id+"'>🎬 Develop this</button></div>";
  }
  h+="</div>";
  h+="<div class='section-title'>Talent — available now</div>";
  const free=t=>!t.bookedUntil;
  const rank=(a,b)=>b.power-a.power||b.skill-a.skill;
  const freeD=G.talent.filter(t=>t.kind==="director"&&free(t)).sort(rank);
  const freeW=G.talent.filter(t=>t.kind==="writer"&&free(t)).sort(rank);
  const freeP=G.talent.filter(t=>t.kind==="producer"&&free(t)).sort(rank);
  const freeA=G.talent.filter(t=>t.kind==="actor"&&free(t)).sort(rank);
  h+="<div class='tiny muted' style='margin:0 0 6px'>🎬 Directors <span class='dim2'>· quality</span></div><div class='grid g3'>";
  for(const d of freeD.slice(0,3)) h+=talentCard(d);
  h+="</div>";
  h+="<div class='tiny muted' style='margin:10px 0 6px'>✍️ Screenwriters <span class='dim2'>· rewrite the script in pre-production (skill + genre fit drive the boost)</span></div><div class='grid g3'>";
  for(const w of freeW.slice(0,3)) h+=talentCard(w);
  h+="</div>";
  h+="<div class='tiny muted' style='margin:10px 0 6px'>🎞 Producers <span class='dim2'>· keep shoots on budget (overruns ♦ logistics) · top organizers trim a week of shooting</span></div><div class='grid g3'>";
  for(const p of freeP.slice(0,3)) h+=talentCard(p);
  h+="</div>";
  h+="<div class='tiny muted' style='margin:10px 0 6px'>🌟 Actors <span class='dim2'>· star power opens, skill sustains · faded stars are comeback bets</span></div><div class='grid g3'>";
  for(const a of freeA.slice(0,9)) h+=talentCard(a);
  const hidden=freeA.length+freeD.length+freeW.length+freeP.length-18;
  if(hidden>0)h+="<div class='card muted small' style='display:flex;align-items:center;justify-content:center'>+ "+hidden+" more on the market → refreshed weekly</div>";
  h+="</div>";
  return h;
}
function trendTag(genre){
  const t=trendOf(genre);
  if(t>=1.15) return "<span class='tag hot'>🔥 trending ×"+t.toFixed(2)+"</span>";
  if(t<=0.85) return "<span class='tag cold'>🧊 cooling ×"+t.toFixed(2)+"</span>";
  return "";
}
const KIND_ICON={actor:"🌟",director:"🎬",writer:"✍️",producer:"🎞"};
function talentCard(t){
  const fee=actorFee(t);
  const icon = t.kind==="actor"? (t.power>=4?"🌟":"🙂") : KIND_ICON[t.kind]||"🙂";
  let stats;
  if(t.kind==="director") stats="Skill "+t.skill+" · fits "+DATA.GENRES[t.genreFit].name;
  else if(t.kind==="writer") stats="Skill "+t.skill+" · writes "+DATA.GENRES[t.genreFit].name+" · rewrite ≈ "+(writerDeltaHint(t));
  else if(t.kind==="producer") stats="Skill "+t.skill+" · logistics "+t.logi+" · overrun risk ≈ "+overrunHint(t)+"/wk";
  else stats="Skill "+t.skill+" · acting";
  return "<div class='card talent-card'><div class='t-avatar'>"+icon+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(t.name)+"</div>"+
    "<div>"+stars(t.power)+(t.faded?" <span class='tag cold'>❄ faded</span>":"")+"</div>"+
    "<div class='t-stats'>"+stats+
    (t.heat?" · <span class='gold'>heat ×"+t.heat+"</span>":"")+"</div>"+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(fee)+" fee</span>"+
    (t.faded?"<span class='tag green'>comeback bet</span>":"")+"</div></div></div>";
}
function writerDeltaHint(w){
  const d=Math.round((w.skill-64)*0.45);
  return (d>=0?"+":"")+d+" script";
}
function overrunHint(p){
  const ch=clamp(0.05*(1.3-p.logi/100),0.008,0.09);
  return (ch*100).toFixed(1)+"%";
}

/* ── greenlight wizard (film & sequel) ── */
function startWizard(idea){
  WZ={mode:"film", idea, writer:null, producer:null, director:null, cast:[], sub:2, budget:Math.round(neededBudget(idea.genre,idea.scale)), plan:"theatrical", presales:false};
  wizardModal();
}
function startSequel(film){
  const idea={ id:nid(), genre:film.genre, scale:film.scale, title:"(sequel)", blurb:"The saga continues…",
    script:clamp((film.quality?film.quality.overall:65)+5,55,95), hot:true, sequelOf:film };
  WZ={mode:"film", idea, writer:null, producer:null, director:null, cast:[], sub:2, seqBudgetFixed:true, budget:Math.round(film.budget*1.3)};
  wizardModal();
}
/* the sequel-boost chip shown in the wizard header */
function wzBoostTag(){
  if(!WZ.idea.sequelOf) return "";
  const fr=G.franchises.find(x=>x.name===(WZ.idea.sequelOf.franchiseName||WZ.idea.sequelOf.title));
  const b=sequelBoostFor(fr||null);
  return "<span class='tag "+(b<1.2?"red":"purple")+"' title='Franchise fatigue: quick follow-ups open softer. Rest the brand 18+ months to recharge.'>boost ×"+b.toFixed(2)+(b<1.2?" · 🥱 fatigue":"")+"</span>";
}
function wizardModal(){
  const S=DATA.SCALES[WZ.idea.scale];
  const step = WZ.sub;
  let h="<h3>🎬 Greenlight: “"+esc(WZ.idea.title==="(sequel)"? sequelTitle0(WZ) : WZ.idea.title)+"”</h3>";
  const tr=trendOf(WZ.idea.genre);
  h+="<div class='row' style='margin:-2px 0 8px'>"+gTag(WZ.idea.genre)+
     "<span class='tag "+(tr>=1.15?"hot":tr<=0.85?"cold":"")+"' title='Genre demand drives opening weekend'>market ×"+tr.toFixed(2)+(tr>=1.15?" 🔥 hot":tr<=0.85?" 🧊 cold":"")+"</span>"+
     wzBoostTag()+"</div>";
  h+="<div class='wiz-step'><span class='done'>1 · Script</span>"+
    "<span class='"+(step===2?"on":(WZ.writer||WZ.producer)?"done":"")+"'>2 · Crew</span>"+
    "<span class='"+(step===3?"on":WZ.director?"done":"")+"'>3 · Director</span>"+
    "<span class='"+(step===4?"on":WZ.cast.length?"done":"")+"'>4 · Cast</span>"+
    "<span class='"+(step===5?"on":"")+"'>5 · Budget</span></div>";
  if(step===2){
    renderWizardCrew();
    return;
  }
  if(step===3){
    const dirs=G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil).sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>A director shapes ~25% of quality. Genre fit adds a bonus. Bigger names also lift buzz.</p><div class='pick-list'>";
    dirs.slice(0,10).forEach(d=>{
      const fit=d.genreFit===WZ.idea.genre;
      h+="<div class='card talent-card"+(WZ.director&&WZ.director.id===d.id?" sel-card":"")+"' data-dir='"+d.id+"'><div class='t-avatar'>🎬</div><div style='flex:1'>"+
        "<div class='t-name'>"+esc(d.name)+" <span class='tiny muted'>"+esc(pick0(DATA.DIR_TRAITS))+"</span></div>"+
        stars(d.power)+"<div class='t-stats'>Skill "+d.skill+(fit?" · <span class='pos'>fits "+DATA.GENRES[WZ.idea.genre].name+"</span>":"")+"</div>"+
        "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(d))+"</span></div></div></div>";
    });
    h+="</div>";
  }else if(step===4){
    const acts=G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil).sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>Pick 1–3 leads. Star power (★) drives opening weekend; skill drives reviews.</p><div class='pick-list'>";
    acts.slice(0,12).forEach(a=>{
      const sel=WZ.cast.some(c=>c.id===a.id);
      h+="<div class='card talent-card"+(sel?" sel-card":"")+"' data-cast='"+a.id+"'><div class='t-avatar'>"+(a.power>=4?"🌟":"🙂")+"</div><div style='flex:1'>"+
        "<div class='t-name'>"+esc(a.name)+"</div>"+stars(a.power)+
        "<div class='t-stats'>Skill "+a.skill+"</div>"+
        "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(a))+"</span>"+(sel?"<span class='tag green'>✓ cast</span>":"")+"</div></div></div>";
    });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzSkipCast'>Continue with "+WZ.cast.length+" →</button><button class='btn btn-primary' id='wzNext'>To Budget →</button></div>";
  }else{
    const fees=(WZ.director?actorFee(WZ.director):0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0)
      +(WZ.writer?actorFee(WZ.writer):0)+(WZ.producer?actorFee(WZ.producer):0);
    const dev=devCostOf(WZ.idea);
    const S2=DATA.SCALES[WZ.idea.scale];
    const weeks=S2.pre[1]+S2.shoot[1]+S2.post[1];
    const starP=WZ.cast.reduce((s,c)=>s+c.power,0);
    h+="<div class='small muted' style='margin:4px 0 6px'><b>Distribution plan</b> — commit now or keep options open</div><div class='plan-pick'>"+
      "<div class='plan-opt"+(WZ.plan==="theatrical"?" sel":"")+"' data-plan='theatrical'><h5>🎥 Theatrical release</h5><div class='p-sub'>Full box office upside (and risk). You set the date & P&A when it's finished.</div></div>"+
      "<div class='plan-opt"+(WZ.plan==="streaming"?" sel":"")+"' data-plan='streaming'><h5>📺 Streaming original</h5><div class='p-sub'>Platforms bid on delivery — guaranteed cash ≈ budget × quality, zero box office.</div></div>"+
      "<div class='plan-opt"+(WZ.plan==="later"?" sel":"")+"' data-plan='later'><h5>🤔 Decide later</h5><div class='p-sub'>Keep every door open: date it, shop it, or take incoming pre-buy offers.</div></div>"+
      "</div>";
    if(WZ.plan!=="streaming"){
      const pv=Math.round(WZ.budget*0.22);
      h+="<div class='card' style='margin-top:8px;cursor:pointer' id='wzPresale'><div class='spread'><span class='small'>"+(WZ.presales?"✅ ":"⬜ ")+"<b>International pre-sales</b> — take "+fmtM(pv)+" cash today</span><span class='tag "+(WZ.presales?"gold":"")+"'>"+(WZ.presales?"sold":"available")+"</span></div>"+
        "<div class='tiny muted'>Buyers take the international box office (~"+Math.round(DATA.GENRES[WZ.idea.genre].intlShare*100)+"% of gross). Great for cash flow; costs you upside on hits.</div></div>";
    }
    if(starP>=8) h+="<div class='tiny' style='margin-top:8px'>🌟 A-list ensemble: the stars demand <b>5% of rentals</b> as backend points.</div>";
    h+="<div class='card' style='margin-top:10px'><div class='slider-row'><span class='small muted'>Production budget</span>"+
      "<input type='range' id='wzBudget' min='"+S2.bMin+"' max='"+(S2.bMax*1.4)+"' step='"+(S2.bMin>=100?5:2)+"' value='"+WZ.budget+"'><span class='slider-val' id='wzBudgetV'>"+fmtM(WZ.budget)+"</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Typical "+S2.name+" range: "+fmtM(S2.bMin)+"–"+fmtM(S2.bMax)+" · genre needs ≈ "+fmtM(neededBudget(WZ.idea.genre,WZ.idea.scale))+" (underfunding hurts quality)</div></div>";
    const crewBits=[];
    if(WZ.writer) crewBits.push("✍️ "+WZ.writer.name);
    if(WZ.producer) crewBits.push("🎞 "+WZ.producer.name);
    if(WZ.director) crewBits.push("🎬 "+WZ.director.name);
    crewBits.push("🌟 ×"+WZ.cast.length);
    h+="<div class='card'><div class='cost-line'><span>Rights + development</span><b>"+fmtM(dev)+"</b></div>"+
      "<div class='cost-line'><span>Talent fees (upfront) <span class='tiny muted'>"+esc(crewBits.join(" · "))+"</span></span><b>"+fmtM(fees)+"</b></div>"+
      (WZ.producer? "<div class='cost-line'><span>Producer protection <span class='tiny muted'>overrun risk → ~"+overrunHint(WZ.producer)+"/wk"+(WZ.producer.logi>=85?" · shoot −1 wk":"")+"</span></span><b class='pos'>on</b></div>"
                  : "<div class='cost-line'><span>No producer <span class='tiny muted'>weekly overrun risk 5%/wk during the shoot</span></span><b class='neg'>exposed</b></div>")+
      "<div class='cost-line'><span>Production (paid weekly over ~"+weeks+" wks)</span><b>"+fmtM(WZ.budget)+"</b></div>"+
      (WZ.presales&&WZ.plan!=="streaming"? "<div class='cost-line'><span>Intl pre-sales (cash now)</span><b class='pos'>+"+fmtM(Math.round(WZ.budget*0.22))+"</b></div>":"")+
      "<div class='cost-line'><span>Suggested marketing (at release)</span><b id='wzMkt'>"+fmtM(recMarketing({budget:WZ.budget, scale:WZ.idea.scale, genre:WZ.idea.genre}))+"</b></div>"+
      "<div class='cost-total'><span>Total commitment</span><span class='gold' id='wzTot'>"+fmtM(dev+fees+WZ.budget)+"</span></div></div>";
    h+="<div class='tiny muted'>💡 Rule of thumb: a film needs ≈ <b id='wzBe'>"+fmtM(breakevenWW({budget:WZ.budget, marketing:recMarketing({budget:WZ.budget,scale:WZ.idea.scale,genre:WZ.idea.genre})}))+"</b> worldwide gross to break even (theaters keep ~half).</div>";
    h+="<div class='modal-actions'><button class='btn btn-ghost' id='wzBack'>← Cast</button><button class='btn btn-primary' id='wzGo'>🎥 Greenlight</button></div>";
  }
  const v=openModal(h, {onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-dir]").forEach(el=>el.onclick=()=>{ WZ.director=talentById(+el.dataset.dir); WZ.sub=4; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-cast]").forEach(el=>el.onclick=()=>{
    const t=talentById(+el.dataset.cast);
    const i=WZ.cast.findIndex(c=>c.id===t.id);
    if(i>=0) WZ.cast.splice(i,1);
    else if(WZ.cast.length<3) WZ.cast.push(t);
    beep("click"); wizardModal();
  });
  const nx=v.querySelector("#wzNext"); if(nx) nx.onclick=()=>{ WZ.sub=5; wizardModal(); };
  const sk=v.querySelector("#wzSkipCast"); if(sk) sk.onclick=()=>{ WZ.sub=5; wizardModal(); };
  const bk=v.querySelector("#wzBack"); if(bk) bk.onclick=()=>{ WZ.sub=4; wizardModal(); };
  v.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{ WZ.plan=b.dataset.plan; if(WZ.plan==="streaming") WZ.presales=false; beep("click"); wizardModal(); });
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
    const fees=(WZ.director?actorFee(WZ.director):0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0)
      +(WZ.writer?actorFee(WZ.writer):0)+(WZ.producer?actorFee(WZ.producer):0);
    const dev=devCostOf(WZ.idea);
    if(G.studio.cash < dev+fees+WZ.budget*0.2){ toast("Not enough cash for upfront costs — visit Finance for a loan.","bad"); beep("bad"); return; }
    const p=greenlight({ idea:WZ.idea, director:WZ.director, cast:WZ.cast, writer:WZ.writer, producer:WZ.producer, budget:WZ.budget, sequelOf:WZ.idea.sequelOf, plan:WZ.plan, presales:WZ.presales });
    beep("clap"); WZ=null; closeModal(); flashes(G.flash); render();
  };
}
/* ── wizard step 2: crew (writer & producer, both optional) ── */
function renderWizardCrew(){
  const tr=trendOf(WZ.idea.genre);
  let h="<h3>🎬 Greenlight: “"+esc(WZ.idea.title==="(sequel)"? sequelTitle0(WZ) : WZ.idea.title)+"”</h3>";
  h+="<div class='row' style='margin:-2px 0 8px'>"+gTag(WZ.idea.genre)+
     "<span class='tag "+(tr>=1.15?"hot":tr<=0.85?"cold":"")+"'>market ×"+tr.toFixed(2)+(tr>=1.15?" 🔥 hot":tr<=0.85?" 🧊 cold":"")+"</span>"+wzBoostTag()+"</div>";
  h+="<div class='wiz-step'><span class='done'>1 · Script</span><span class='on'>2 · Crew</span><span>3 · Director</span><span>4 · Cast</span><span>5 · Budget</span></div>";
  const wrs=G.talent.filter(x=>x.kind==="writer"&&!x.bookedUntil).sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
  const prs=G.talent.filter(x=>x.kind==="producer"&&!x.bookedUntil).sort((a,b)=>(b.power*20+b.logi)-(a.power*20+a.logi));
  h+="<p class='small muted'>Optional, but real: a <b>✍️ screenwriter</b> rewrites the script during pre-production (the script is ~30% of quality), and a <b>🎞 producer's</b> logistics shrink the weekly overrun risk on set.</p>";
  h+="<div class='small' style='margin:6px 0'>✍️ Screenwriter — the shooting draft lands when cameras roll</div><div class='pick-list'>";
  if(!wrs.length) h+="<div class='card muted small'>No writers free this week — the pool refreshes over time.</div>";
  wrs.slice(0,6).forEach(w=>{
    const fit=w.genreFit===WZ.idea.genre;
    const delta=Math.round((w.skill-64)*0.45+(fit?6:0));
    h+="<div class='card talent-card"+(WZ.writer&&WZ.writer.id===w.id?" sel-card":"")+"' data-wr='"+w.id+"'><div class='t-avatar'>✍️</div><div style='flex:1'>"+
      "<div class='t-name'>"+esc(w.name)+"</div>"+stars(w.power)+
      "<div class='t-stats'>Skill "+w.skill+" · rewrite ≈ <span class='"+(delta>=0?"pos":"neg")+"'>"+(delta>=0?"+":"")+delta+" script</span>"+(fit?" · <span class='pos'>"+DATA.GENRES[WZ.idea.genre].name+" specialist</span>":"")+"</div>"+
      "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(w))+"</span>"+(WZ.writer&&WZ.writer.id===w.id?"<span class='tag green'>✓ hired</span>":"")+"</div></div></div>";
  });
  h+="</div><div class='small' style='margin:12px 0 6px'>🎞 Producer — logistics vs. overruns (no producer = 5%/wk overrun risk)</div><div class='pick-list'>";
  if(!prs.length) h+="<div class='card muted small'>No producers free this week — the pool refreshes over time.</div>";
  prs.slice(0,5).forEach(p=>{
    h+="<div class='card talent-card"+(WZ.producer&&WZ.producer.id===p.id?" sel-card":"")+"' data-pd='"+p.id+"'><div class='t-avatar'>🎞</div><div style='flex:1'>"+
      "<div class='t-name'>"+esc(p.name)+"</div>"+stars(p.power)+
      "<div class='t-stats'>Skill "+p.skill+" · logistics "+p.logi+" · overrun risk ≈ "+overrunHint(p)+"/wk"+(p.logi>=85?" · <span class='pos'>trims shoot by 1 wk</span>":"")+"</div>"+
      "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(p))+"</span>"+(WZ.producer&&WZ.producer.id===p.id?"<span class='tag green'>✓ hired</span>":"")+"</div></div></div>";
  });
  h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzSkipCrew'>Run lean — no crew →</button><button class='btn btn-primary' id='wzNext2'>To Director →</button></div>";
  const v=openModal(h, {onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-wr]").forEach(el=>el.onclick=()=>{
    const t=talentById(+el.dataset.wr);
    WZ.writer = (WZ.writer && WZ.writer.id===t.id)? null : t;
    beep("click"); renderWizardCrew();
  });
  v.querySelectorAll("[data-pd]").forEach(el=>el.onclick=()=>{
    const t=talentById(+el.dataset.pd);
    WZ.producer = (WZ.producer && WZ.producer.id===t.id)? null : t;
    beep("click"); renderWizardCrew();
  });
  v.querySelector("#wzNext2").onclick=()=>{ WZ.sub=3; beep("click"); wizardModal(); };
  v.querySelector("#wzSkipCrew").onclick=()=>{ WZ.writer=null; WZ.producer=null; WZ.sub=3; beep("click"); wizardModal(); };
}
function sequelTitle0(wz){ return wz.idea.sequelOf? sequelTitle(wz.idea.sequelOf.title) : "Sequel"; }
function pick0(a){ return a[Math.floor(Math.random()*a.length)]; }

/* ── series pitch wizard ── */
function startSeriesWizard(){
  WZ={mode:"series", genre:pick(["drama","thriller","scifi","comedy","horror","romance","fantasy","action"]),
      eps:8, perEp:6, platform:"streamflix", showrunner:null, cast:[]};
  seriesModal();
}
function seriesModal(){
  const step = !WZ.showrunner? 1 : 2;
  let h="<h3>📺 Pitch a Series</h3>";
  if(step===1){
    h+="<div class='small muted' style='margin-bottom:8px'>Genre & format</div><div class='row' id='szGenres'>";
    Object.keys(DATA.GENRES).forEach(g=>{
      h+="<button class='btn btn-sm "+(WZ.genre===g?"btn-primary":"")+"' data-g='"+g+"'>"+DATA.GENRES[g].emoji+" "+DATA.GENRES[g].name+"</button>";
    });
    h+="</div><div class='card' style='margin-top:10px'><div class='slider-row'><span class='small muted'>Episodes</span><input type='range' id='szEps' min='6' max='10' value='"+WZ.eps+"'><span class='slider-val' id='szEpsV'>"+WZ.eps+" eps</span></div></div>";
    h+="<div class='card'><div class='slider-row'><span class='small muted'>Budget / episode</span><input type='range' id='szPerEp' min='2' max='18' value='"+WZ.perEp+"'><span class='slider-val' id='szPerEpV'>"+fmtM(WZ.perEp)+"</span></div><div class='tiny muted'>Season budget: <b id='szTotal'>"+fmtM(WZ.eps*WZ.perEp)+"</b> — $8M+/ep reads as premium.</div></div>";
    h+="<div class='small muted' style='margin:10px 0 8px'>Pick a showrunner (director)</div><div class='pick-list'>";
    G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil).sort((a,b)=>b.power-a.power).slice(0,6).forEach(d=>{
      h+="<div class='card talent-card' data-sr='"+d.id+"'><div class='t-avatar'>🎬</div><div style='flex:1'><div class='t-name'>"+esc(d.name)+"</div>"+stars(d.power)+"<div class='t-stats'>Skill "+d.skill+"</div><div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(d))+"</span></div></div></div>";
    });
    h+="</div>";
  }else{
    const plat=DATA.platform(WZ.platform);
    const odds=Math.round(clamp(0.22+65/160+(plat.taste[WZ.genre]||1-1)*0.6+G.studio.rep/400+(WZ.perEp>=8?0.06:0)+(G.upgrades.ottrel?0.05:0),0.12,0.9)*100);
    h+="<div class='card platform-card'><div class='platform-logo' style='background:"+plat.color+"'>"+plat.logo+"</div><div><b>"+plat.name+"</b><div class='tiny muted'>"+plat.blurb+"</div></div></div>";
    h+="<div class='card'><div class='cost-line'><span>Taste for "+DATA.GENRES[WZ.genre].name+"</span><b>"+(((plat.taste[WZ.genre]||1))*100).toFixed(0)+"%</b></div>"+
      "<div class='cost-line'><span>Season order ("+WZ.eps+" × "+fmtM(WZ.perEp)+")</span><b>"+fmtM(WZ.eps*WZ.perEp)+"</b></div>"+
      "<div class='cost-line'><span>License if greenlit (≈115% of budget)</span><b class='pos'>"+fmtM(WZ.eps*WZ.perEp*1.15)+"</b></div></div>";
    h+="<div class='small' style='margin:8px 0'>Estimated pitch odds: <b class='"+(odds>=55?"pos":odds>=35?"gold":"neg")+"'>~"+odds+"%</b></div>";
    h+="<div class='row' id='szPlats'>";
    DATA.PLATFORMS.forEach(p=>{
      h+="<button class='btn btn-sm "+(WZ.platform===p.id?"btn-primary":"")+"' data-p='"+p.id+"'>"+p.name+"</button>";
    });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='szBack'>← Back</button><button class='btn btn-primary' id='szPitch'>📡 Pitch it</button></div>";
  }
  const v=openModal(h,{onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ WZ.genre=b.dataset.g; beep("click"); seriesModal(); });
  const e1=v.querySelector("#szEps"); if(e1){ e1.oninput=()=>{ WZ.eps=+e1.value; $("#szEpsV").textContent=WZ.eps+" eps"; $("#szTotal").textContent=fmtM(WZ.eps*WZ.perEp); }; }
  const e2=v.querySelector("#szPerEp"); if(e2){ e2.oninput=()=>{ WZ.perEp=+e2.value; $("#szPerEpV").textContent=fmtM(WZ.perEp); $("#szTotal").textContent=fmtM(WZ.eps*WZ.perEp); }; }
  v.querySelectorAll("[data-sr]").forEach(el=>el.onclick=()=>{ WZ.showrunner=talentById(+el.dataset.sr); beep("click"); seriesModal(); });
  v.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{ WZ.platform=b.dataset.p; beep("click"); seriesModal(); });
  const bk=v.querySelector("#szBack"); if(bk) bk.onclick=seriesModal;
  const pit=v.querySelector("#szPitch");
  if(pit) pit.onclick=()=>{
    const res=pitchSeries({genre:WZ.genre, eps:WZ.eps, perEp:WZ.perEp, platformId:WZ.platform,
      showrunner:WZ.showrunner, cast:WZ.cast});
    beep(res.ok?"gold":"bad"); flashes(G.flash);
    WZ=null; closeModal(); render();
  };
}

/* ═══════════ VIEW: productions ═══════════ */
function viewProductions(){
  let h="";
  const ready=readyProjects(), prod=inProdProjects();
  h+="<div class='section-title'>In production ("+prod.length+")</div>";
  if(!prod.length) h+="<div class='card muted small'>No films shooting. Visit 📝 Develop to greenlight one.</div>";
  for(const p of prod){
    const S=DATA.SCALES[p.scale];
    const ph=p.phase; const L=p.phaseLen;
    const curIdx={pre:0,shoot:1,post:2}[ph];
    const totalWk=L.pre+L.shoot+L.post, doneWk=(curIdx>0?L.pre:0)+(curIdx>1?L.shoot:0)+p.phaseWeek;
    const burn = ph==="pre"? p.budget*0.10/L.pre : ph==="shoot"? p.budget*0.70/L.shoot*(G.upgrades.backlot?0.88:1) : p.budget*0.20/L.post*(G.upgrades.vfx?0.75:1);
    h+="<div class='card prod-card'><div class='spread'><div><b>"+DATA.GENRES[p.genre].emoji+" "+esc(p.title)+"</b>"+(p.franchiseName?" <span class='tag purple'>franchise</span>":"")+
      "<div class='tiny muted'>"+gTag(p.genre)+" <span class='tag'>"+S.emoji+" "+S.name+"</span> · budget "+fmtM(p.budget)+" · dir "+(p.director?esc(p.director.name):"—")+" · "+(p.cast?p.cast.length:0)+" leads"+
      (p.writer?" · ✍️ "+esc(p.writer.name)+(p.rewritten?" ✓":""):"")+(p.producer?" · 🎞 "+esc(p.producer.name):" · <span class='neg'>no producer (overruns!)</span>")+"</div></div>"+
      "<div style='text-align:right'><div class='tag "+(ph==="shoot"?"gold":"blue")+"'>"+({pre:"Pre-production",shoot:"Shooting",post:"Post-production"}[ph])+"</div>"+
      (p.strikePause>0?"<div class='tag red' style='margin-top:4px'>✊ strike "+p.strikePause+"wks</div>":"")+
      ((p.overruns||0)>0?"<div class='tag red' style='margin-top:4px'>⚠️ overruns +"+fmtM(p.overruns)+"</div>":"")+"</div></div>"+
      "<div class='phases'>"+["pre","shoot","post"].map((x,i)=>{
        const st= i<curIdx? "done": i===curIdx? "cur":"";
        const w = i<curIdx? 100 : i===curIdx? Math.round(p.phaseWeek/L[x]*100):0;
        return "<div class='ph "+st+"'><i style='width:"+w+"%'></i></div>"; }).join("")+
      "</div><div class='ph-labels'><span>Pre</span><span>Shoot</span><span>Post</span></div>"+
      "<div class='spread small' style='margin-top:8px'><span class='muted'>Week "+(doneWk+1)+" of ~"+totalWk+" · burn "+fmtM(burn)+"/wk</span>"+
      "<span class='muted'>spent "+fmtM(p.spent)+" of "+fmtM(p.budget)+"</span></div>"+
      "<button class='btn btn-sm btn-danger' style='margin-top:8px' data-cancel='"+p.id+"'>✕ Shelve (lose spend)</button></div>";
  }
  h+="<div class='section-title'>Ready for release ("+ready.length+")</div>";
  if(!ready.length) h+="<div class='card muted small'>Nothing in the can yet.</div>";
  for(const p of ready){
    h+="<div class='card'><div class='spread'><div><b>🎞 "+esc(p.title)+"</b> "+scoreBadge(p.quality.overall)+
      (p.prebuyAccepted?"<div class='tiny gold'>Sold to "+DATA.platform(p.prebuyPlatform).name+" — payable on delivery</div>":"")+"</div></div>"+
      "<div class='tiny muted' style='margin-top:6px'>Critics "+p.quality.critic+" · Audience "+p.quality.aud+" · budget "+fmtM(p.budget)+" · breakeven "+fmtM(breakevenWW(p))+" WW</div>"+
      (p.prebuyAccepted?"":"<div class='row' style='margin-top:10px'><button class='btn btn-primary' data-sched='"+p.id+"'>📅 Theatrical Release</button><button class='btn btn-alt' data-shop='"+p.id+"'>📺 Shop to Streamers</button></div>")+"</div>";
  }
  h+="<div class='section-title'>Franchise opportunities</div>";
  const fr=G.films.filter(f=>f.franchiseable);
  if(!fr.length) h+="<div class='card muted small'>Land a big hit (2× breakeven + good reviews) and sequels unlock here.</div>";
  for(const f of fr.slice(0,4)){
    h+="<div class='card'><div class='spread'><div><b>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</b><div class='tiny muted'>"+fmtG(f.ww)+" WW · "+scoreBadge(f.quality.overall)+"</div></div>"+
      "<button class='btn btn-sm btn-primary' data-seq='"+f.id+"'>⚡ Greenlight Sequel</button></div></div>";
  }
  return h;
}

/* ── release scheduling modal ── */
function startScheduling(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p) return;
  SCHEDULE={p, week:G.week+4, marketing:recMarketing(p), sel:false};
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
  h+="<div class='small muted' style='margin:10px 0 6px'>Pick a weekend (next 30 weeks):</div><div style='max-height:300px;overflow-y:auto;display:grid;gap:6px'>";
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
  // summary
  const exp=previewOpen(p,SCHEDULE.week);
  const be=breakevenWW({budget:p.budget, marketing:SCHEDULE.marketing});
  h+="<div class='card' style='margin-top:10px'><div class='cost-line'><span>Expected opening (est.)</span><b id='scExp'>"+fmtG(exp)+" dom</b></div>"+
    "<div class='cost-line'><span>Breakeven</span><b id='scBe'>"+fmtG(be)+" WW</b></div>"+
    "<div class='cost-line'><span>Pay now (30% P&A)</span><b id='scPay'>"+fmtM(SCHEDULE.marketing*0.3)+"</b></div></div>";
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
    if(pEl) pEl.textContent=fmtM(SCHEDULE.marketing*0.3);
  };
  v.querySelectorAll("[data-w]").forEach(el=>el.onclick=()=>{ SCHEDULE.week=+el.dataset.w; beep("click"); schedModal(); });
  v.querySelector("#scGo").onclick=()=>{
    const now=Math.round(SCHEDULE.marketing*0.3);
    if(G.studio.cash<now){ toast("Not enough cash for the P&A down payment.","bad"); return; }
    p.releaseWeek=SCHEDULE.week; p.marketing=SCHEDULE.marketing; p.marketingPaid=now;
    G.studio.cash-=now;
    log("📅 “"+p.title+"” dated for "+seasonDateLabel(SCHEDULE.week)+" with "+fmtM(p.marketing)+" P&A.","gold");
    beep("gold"); SCHEDULE=null; closeModal(); render();
  };
}
function previewOpen(p,w){
  const saved={m:p.marketing, r:p.releaseWeek};
  p.marketing=SCHEDULE?SCHEDULE.marketing:p.marketing; p.releaseWeek=w;
  const v=expectedOpening(p,w);
  p.marketing=saved.m; p.releaseWeek=saved.r;
  return v;
}

/* ═══════════ VIEW: box office ═══════════ */
function viewBoxOffice(){
  let h="";
  const chart=weeklyChart();
  h+="<div class='section-title'>This week's chart</div><div class='card chart-bars'>";
  if(!chart.length) h+="<div class='muted small'>Nothing in theaters — the multiplex is a graveyard.</div>";
  const max=Math.max(1,...chart.map(c=>c.gross));
  chart.forEach((c,i)=>{
    h+="<div class='chart-bar'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(c.mine?"🎬 ":"")+esc(c.title)+(c.mine?"":" <span class='tiny muted'>— "+esc(c.studio||"")+"</span>")+"</div>"+
      "<div class='cb-sub'>"+DATA.GENRES[c.genre].name+" · wk "+c.weeksOut+"</div></div>"+
      "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(7,c.gross/max*100)+"%;background:"+(c.mine?"linear-gradient(90deg,#f5b942,#ffd479)":(c.color||"#4a5570"))+" ;animation-delay:"+(i*55)+"ms'>"+fmtG(c.gross)+"</div></div></div>";
  });
  h+="</div>";
  const live=activeFilms();
  h+="<div class='section-title'>Your films in theaters ("+live.length+")</div>";
  if(!live.length) h+="<div class='card muted small'>No active runs. A film without a release date earns nothing.</div>";
  for(const f of live){
    const be=breakevenWW(f);
    const projWW=(f.dom/(1-DATA.GENRES[f.genre].intlShare));
    h+="<div class='card'><div class='spread'><div><b>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</b><div class='tiny muted'>wk "+f.weeksOut+" out · opened "+fmtG(f.opening)+" · "+scoreBadge(f.quality.overall)+"</div></div>"+
      "<div style='text-align:right'><b class='gold'>"+fmtG(f.dom)+"</b><div class='tiny muted'>domestic</div></div></div>"+
      "<div class='weekly-gross-chart'>"+f.weekly.slice(-12).map((x,xi)=>"<div class='wg' style='height:"+Math.max(4,x.gross/f.opening*100)+"%;animation-delay:"+(xi*45)+"ms' title='"+fmtG(x.gross)+"'></div>").join("")+"</div>"+
      "<div class='spread small' style='margin-top:6px'><span class='muted'>Tracking ≈ "+fmtG(projWW)+" WW vs "+fmtG(be)+" breakeven</span>"+
      "<span class='"+(projWW>=be?"pos":"neg")+"'>"+(projWW>=be?"on pace to profit":"below breakeven")+"</span></div>"+
      "<div class='tiny' style='margin-top:4px'>💰 Rentals received to date: <b class='gold'>"+fmtM(f.rentalsDom||0)+"</b> <span class='muted'>(~53% of domestic gross, paid weekly)</span>"+(f.presales?" · <span class='muted'>intl pre-sold</span>":"")+"</div></div>";
  }
  const lib=G.films.slice().sort((a,b)=>(b.ww||0)-(a.ww||0));
  h+="<div class='section-title'>Library ("+lib.length+")</div>";
  if(!lib.length) h+="<div class='card muted small'>Your trophy shelf is empty. For now.</div>";
  h+="<div class='card'>";
  lib.slice(0,15).forEach(f=>{
    const be=f.ww? breakevenWW(f):1;
    const verdict = f.streamingOriginal? "<span class='tag purple'>streaming original</span>" :
      f.ww>=be*1.6? "<span class='tag green'>SMASH</span>" : f.ww>=be? "<span class='tag green'>HIT</span>" :
      f.ww>=be*0.75? "<span class='tag gold'>soft</span>" : "<span class='tag red'>FLOP</span>";
    h+="<div class='film-row'><div><b>"+esc(f.title)+"</b> "+verdict+" "+
      ((f.awards&&f.awards.length)?"🏆 "+f.awards.join(" · "):"")+
      "<div class='tiny muted'>"+DATA.GENRES[f.genre].name+" · "+fmtM(f.budget)+" budget · "+fmtG(f.ww||0)+" WW"+
      (f.soldTo?" · licensed to "+f.soldTo:"")+"</div></div>"+
      "<div style='text-align:right'><b class='"+(f.profit>=0?"pos":"neg")+"'>"+(f.profit>=0?"+":"")+fmtM(f.profit||0)+"</b><div class='tiny muted'>net</div></div></div>";
  });
  h+="</div>";
  return h;
}

/* ═══════════ VIEW: ott ═══════════ */
function viewOTT(){
  let h="";
  h+="<div class='section-title'>Deal offers ("+G.offers.length+")</div>";
  if(!G.offers.length) h+="<div class='card muted small'>No offers on the table. Hits and finished runs attract bidders — especially during streaming wars.</div>";
  for(const o of G.offers){
    const p=DATA.platform(o.platform);
    const typeLabel = o.type==="film_ott"? "Theatrical → streaming license" : o.type==="prebuy"? "Buy-out as streaming original" : "Season "+o.seasonNum+" order";
    h+="<div class='card offer-card'><div class='spread'><div class='platform-card'><div class='platform-logo' style='background:"+p.color+"'>"+p.logo+"</div>"+
      "<div><b>"+esc(o.filmTitle||o.seriesTitle)+"</b><div class='tiny muted'>"+typeLabel+" · "+p.name+"</div></div></div>"+
      "<div style='text-align:right'><div class='modal-offer-val'>"+fmtM(o.value)+"</div><div class='tiny muted'>expires in "+(o.expires-G.week)+" wk</div></div></div>"+
      "<div class='modal-actions' style='margin-top:10px'>"+
      "<button class='btn btn-primary btn-sm' data-acc='"+o.id+"'>✅ Accept</button>"+
      (o.countered?"":"<button class='btn btn-alt btn-sm' data-cnt='"+o.id+"'>📈 Counter</button>")+
      "<button class='btn btn-ghost btn-sm' data-dec='"+o.id+"'>✕ Decline</button></div></div>";
  }
  h+="<div class='section-title'>Your series ("+G.series.length+")</div>";
  if(!G.series.length) h+="<div class='card muted small'>No shows yet. Series = steady license income + renewals. Pitch one from 📝 Develop.</div>";
  for(const s of G.series){
    const p=DATA.platform(s.platform);
    const last=s.seasons[s.seasons.length-1];
    h+="<div class='card'><div class='spread'><div><b>📺 "+esc(s.title)+"</b> <span class='tag purple'>"+p.name+"</span>"+
      (s.seasons.length?"<span class='tag'>"+s.seasons.length+" season"+(s.seasons.length>1?"s":"")+"</span>":"")+"</div>"+
      "<div class='tiny muted'>"+gTag(s.genre)+" · "+s.eps+" eps × "+fmtM(s.perEp)+"</div></div>";
    if(s.phase==="shoot") h+="<div class='small' style='margin-top:6px'>🎬 Shooting S"+(s.seasons.length+1)+" — "+s.weeksLeft+" weeks left · burn "+fmtM(s.budget/Math.max(s.weeksLeft0||s.weeksLeft,1))+"/wk</div>";
    else if(s.phase==="airing") h+="<div class='small' style='margin-top:6px'>📡 Airing on "+p.name+"…</div>";
    else h+="<div class='small muted' style='margin-top:6px'>"+(s.status==="ended"?"Ended":"Between seasons")+(last?" · last season buzz "+last.viewership+"/100":"")+"</div>";
    if(last) h+="<div style='margin-top:6px'>"+meter(last.viewership,100)+"</div>";
    h+="</div>";
  }
  h+="<div class='section-title'>The platforms</div><div class='grid g3'>";
  DATA.PLATFORMS.forEach(p=>{
    h+="<div class='card platform-card'><div class='platform-logo' style='background:"+p.color+"'>"+p.logo+"</div><div><b>"+p.name+"</b>"+
      "<div class='tiny muted'>"+p.blurb+"</div><div class='tiny muted' style='margin-top:4px'>pays "+Math.round((p.generosity-1)*100+100)+"% · renews above "+p.renew+" buzz</div></div></div>";
  });
  h+="</div>";
  return h;
}

/* ═══════════ VIEW: finance ═══════════ */
function viewFinance(){
  const st=G.studio;
  const overhead=st.overhead+G.projects.length*0.12+G.series.filter(s=>s.phase==="shoot").length*0.15;
  let h="<div class='stat-hero'>"+
    statCard(fmtM(st.cash),"Cash","var(--gold2)")+
    statCard(fmtM(st.debt),"Debt","var(--red)")+
    statCard(fmtM(maxDebt()),"Credit limit")+
    statCard(fmtM(catalogValue()),"Catalog value")+
    statCard(fmtM(overhead)+"/wk","Overhead")+
    statCard(fmtM(catalogValue()*0.0035)+"/wk","Library income")+
  "</div>";
  h+=plCard();
  h+="<div class='grid g2'><div class='card'><h4>🏦 Credit facility</h4>"+
    "<p class='tiny muted'>Weekly interest 0.18% (≈9%/yr). Borrow to bridge production, but breakevens don't care about your loans.</p>"+
    "<div class='loan-row'><div class='small muted' style='margin:8px 0 4px'>Borrow</div><input type='range' id='fnLoan' min='10' max='"+Math.max(10,Math.round(maxDebt()-st.debt))+"' step='10' value='"+Math.round(Math.max(10,(maxDebt()-st.debt)/2))+"'><div class='spread'><b id='fnLoanV'></b><button class='btn btn-sm btn-primary' id='fnLoanGo'>Take loan</button></div></div>"+
    (st.debt>0? "<div class='loan-row'><div class='small muted' style='margin:12px 0 4px'>Repay</div><input type='range' id='fnRepay' min='1' max='"+Math.max(1,Math.min(Math.round(st.debt),Math.floor(st.cash)))+"' value='"+Math.max(1,Math.min(Math.round(st.debt/2),Math.floor(st.cash)))+"'><div class='spread'><b id='fnRepayV'></b><button class='btn btn-sm btn-alt' id='fnRepayGo'>Repay</button></div></div>":"")+
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
  h+="<div class='section-title'>Studio investments</div><div class='grid g3'>";
  DATA.UPGRADES.forEach(u=>{
    const owned=!!G.upgrades[u.id];
    h+="<div class='card upg-card'><div class='u-i'>"+u.icon+"</div><div style='flex:1'><b>"+u.name+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+u.desc+"</div>"+
      (owned? "<span class='tag green'>✓ built</span>" : "<button class='btn btn-sm "+(st.cash>=u.cost?"btn-primary":"")+"' data-upg='"+u.id+"'>"+fmtM(u.cost)+"</button>")+"</div></div>";
  });
  h+="</div>";
  return h;
}

const PL_LABELS={theatrical:"🎬 Box office rentals", pvod:"🏠 Premium VOD", streaming:"📺 Streaming deals", series:"📺 Series licenses", empire:"🏰 Franchise & parks", library:"📚 Library licensing", presales:"🌍 Intl pre-sales", incentives:"🧾 Production incentives", production:"🎬 Production spend", marketing:"📣 Marketing (P&A)", talent:"🌟 Talent & fees", development:"📝 Development", overhead:"🏛 Overhead", interest:"🏦 Interest", studio:"🏗 Studio investment", other:"❓ Other"};
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
      G.txHistory.slice(-10).map((x,xi)=>"<div class='pb "+(x.net>=0?"up":"down")+"' style='height:"+Math.max(5,Math.abs(x.net)/mx*100)+"%;animation-delay:"+(xi*50)+"ms' title='"+(x.net>=0?"+":"")+fmtM(x.net)+"'></div>").join("")+
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
  $$("[data-sched]").forEach(b=>b.onclick=()=>{ beep("click"); startScheduling(+b.dataset.sched); });
  $$("[data-shop]").forEach(b=>b.onclick=()=>{
    shopToStreamers(+b.dataset.shop); beep("click");
    if(G.pendingAuction){ render(); auctionModal(); }
  });
  $$("[data-fr-merch]").forEach(b=>b.onclick=()=>{ upgradeMerch(+b.dataset.frMerch); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-park]").forEach(b=>b.onclick=()=>{ buildPark(+b.dataset.frPark); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-game]").forEach(b=>b.onclick=()=>{ sellGameRights(+b.dataset.frGame); beep("cash"); flashes(G.flash); render(); });
  $$("[data-fr-seq]").forEach(b=>b.onclick=()=>{
    const fr=frById(+b.dataset.frSeq);
    const ent=fr && fr.entries[fr.entries.length-1];
    const f=ent && G.films.find(x=>x.id===ent.filmId);
    if(f){ beep("click"); startSequel(f); } else toast("Original film record not found.","bad");
  });
  $$("[data-cancel]").forEach(b=>b.onclick=()=>{
    const p=G.projects.find(x=>x.id===+b.dataset.cancel); if(!p)return;
    G.projects=G.projects.filter(x=>x!==p);
    if(p.director){p.director.bookedUntil=0;p.director.booked=null;}
    if(p.producer){p.producer.bookedUntil=0;p.producer.booked=null;}
    if(p.writer){p.writer.bookedUntil=0;p.writer.booked=null;}
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
  // finance sliders
  const fl=$("#fnLoan");
  if(fl){ const upd=()=>$("#fnLoanV").textContent=fmtM(+fl.value); upd(); fl.oninput=upd;
    $("#fnLoanGo").onclick=()=>{ if(takeLoan(+fl.value)){beep("cash"); flashes(G.flash); render();} }; }
  const fr=$("#fnRepay");
  if(fr){ const upd=()=>$("#fnRepayV").textContent=fmtM(+fr.value); upd(); fr.oninput=upd;
    $("#fnRepayGo").onclick=()=>{ if(repayDebt(+fr.value)){beep("good"); flashes(G.flash); render();} }; }
}

/* ═══════════ streaming auction modal ═══════════ */
function auctionModal(){
  const a=G.pendingAuction; if(!a) return;
  const p=G.projects.find(x=>x.id===a.projectId);
  let h="<h3>📺 Streaming auction — “"+esc(p?p.title:"?")+"”</h3>";
  if(p) h+="<div class='tiny muted' style='margin-bottom:4px'>"+DATA.GENRES[p.genre].name+" · score "+p.quality.overall+"/100 · budget "+fmtM(p.budget)+" · selling means <b>no theatrical run</b></div>";
  a.bids.forEach((b,i)=>{
    const pl=DATA.platform(b.platform);
    h+="<div class='bid-card'><div class='platform-logo' style='background:"+pl.color+"'>"+pl.logo+"</div>"+
      "<div style='flex:1'><b>"+pl.name+"</b><div class='tiny muted'>"+pl.blurb+"</div></div>"+
      "<b class='modal-offer-val'>"+fmtM(b.value)+"</b>"+
      "<button class='btn btn-primary btn-sm' data-bid='"+i+"'>Accept</button></div>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='aucNo'>"+(a.manual? "Not now":"🎥 Keep it for theaters")+"</button></div>";
  const v=openModal(h,{locked:!a.manual, onClose:()=>{ if(G.pendingAuction && G.pendingAuction.manual) G.pendingAuction=null; }});
  v.querySelectorAll("[data-bid]").forEach(b=>b.onclick=()=>{
    acceptAuction(+b.dataset.bid); beep("gold"); flashes(G.flash); closeModal(); render();
  });
  const no=v.querySelector("#aucNo");
  if(no) no.onclick=()=>{ declineAuction(); beep("click"); closeModal(); render(); };
}

/* ═══════════ EMPIRE view ═══════════ */
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
  if(!G.franchises.length){
    h+="<div class='card muted small'>No franchises yet. Land a theatrical <b>hit</b> — roughly 2× breakeven worldwide with reviews ≥66 — and the brand unlocks here: sequels, 🧸 merchandise, 🎮 game licenses and 🎡 theme-park attractions. Animation & fantasy merchandise best; parks need a tier-2 franchise.</div>";
  }
  for(const fr of G.franchises){
    const g=DATA.GENRES[fr.genre];
    const inc=frWeeklyIncome(fr);
    h+="<div class='card'><div class='fr-head'><div class='fr-emblem'>"+g.emoji+"</div>"+
      "<div style='flex:1;min-width:180px'><b>"+esc(fr.name)+"</b> <span class='tag gold'>tier "+fr.tier+"</span>"+
      "<div class='tiny muted'>"+fr.entries.length+" franchise hit"+(fr.entries.length>1?"s":"")+" · "+fmtG(fr.ww)+" WW · merch potential "+Math.round(g.merch*100)+"%</div></div>"+
      "<div style='text-align:right'><b class='"+(inc>=0.1?"pos":"muted")+"'>"+(inc>=0.1?"+"+fmtM(inc)+"/wk":"—")+"</b>"+
      "<div class='tiny muted'>"+(fr.decay<0.95? "cooling · "+Math.round(fr.decay*100)+"%":"hot")+"</div></div></div>"+
      "<div class='fr-meters'>"+
        frMeter("🧸 Merchandise", pips(fr.merch,3))+
        frMeter("🎡 Theme park", fr.tier>=2? pips(fr.park,2) : "<span class='tiny muted'>needs tier 2</span>")+
        frMeter("🎮 Game rights", fr.gameSold===fr.tier? "<span class='tiny pos'>licensed</span>":"<span class='tiny muted'>available</span>")+
        frMeter("⚡ Sequel boost", (function(){ const b=sequelBoostFor(fr); return "<span class='"+(b<1.2?"neg":"pos")+"'>×"+b.toFixed(2)+"</span><span class='tiny muted'>"+(b<1.2?" 🥱 fatigue":" fresh")+"</span>"; })())+
        frMeter("💰 Earned", fmtM(fr.earned||0))+
      "</div><div class='fr-actions'>"+
      "<button class='btn btn-sm btn-primary' data-fr-seq='"+fr.id+"'>⚡ Greenlight Sequel</button>"+
      (fr.merch<3? "<button class='btn btn-sm btn-alt' data-fr-merch='"+fr.id+"'>🧸 "+(fr.merch?"Upgrade merch":"Launch merch")+" · "+fmtM(merchCost(fr))+"</button>" : "<span class='tag green' style='align-self:center'>merch maxed</span>")+
      (fr.park<2? (fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-park='"+fr.id+"'>🎡 "+(fr.park?"Expand park":"Build attraction")+" · "+fmtM(parkCost(fr))+"</button>" : "<span class='tag' style='align-self:center'>🎡 park unlocks at tier 2</span>") : "<span class='tag green' style='align-self:center'>park maxed</span>")+
      (fr.gameSold!==fr.tier? "<button class='btn btn-sm btn-alt' data-fr-game='"+fr.id+"'>🎮 License game rights</button>":"")+
      "</div></div>";
  }
  h+="<div class='card'><b>How the empire works</b><div class='small muted' style='margin-top:4px'>Merch & parks pay every week and spike again whenever a franchise film hits theaters (decay resets). Game rights are one-time cash per tier. Franchise equity raises your catalog value and credit limit. <b>Franchise fatigue</b>: quick follow-ups open softer (boost ×1.35 → down to ×1.05) — let a brand rest ~18 months and nostalgia recharges it.</div></div>";
  return h;
}
function frMeter(l,v){ return "<div class='fr-meter'><div class='fm-v'>"+v+"</div><div class='fm-l'>"+l+"</div></div>"; }
function pips(n,max){ let s="<span class='pips'>"; for(let i=1;i<=max;i++) s+= i<=n? "●":"<span class='off'>●</span>"; return s+"</span>"; }

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
  if(r.trendShift){
    const gHot=DATA.GENRES[r.trendShift.hot.k], gCold=DATA.GENRES[r.trendShift.cold.k];
    h+="<div class='section-title'>Year "+(r.year+1)+" market outlook</div><div class='card'>"+
      "<div class='cost-line'><span>"+gHot.emoji+" Genre of the moment</span><b class='pos'>"+gHot.name+" ×"+r.trendShift.hot.h.toFixed(2)+"</b></div>"+
      "<div class='cost-line'><span>"+gCold.emoji+" Cooling off</span><b class='neg'>"+gCold.name+" ×"+r.trendShift.cold.h.toFixed(2)+"</b></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Taste re-rolled for the new year — greenlight into the wave, date before it breaks.</div></div>";
  }
  h+="<div class='section-title'>Nominations & wins</div><div class='card'>";
  if(r.awards.noms.length){
    r.awards.noms.forEach(n=>{ h+="<div class='cost-line'><span>"+(n.mine?"🎬 ":"🎞 ")+esc(n.title)+(n.mine?"":" <span class='tiny muted'>— "+esc(n.studio||"")+"</span>")+"</span>"+(n.mine?"<span class='tag gold'>nominee</span>":"")+"</div>"; });
    r.awards.wins.forEach(w=>{ h+="<div class='cost-line'><span>🏆 "+w.cat+"</span><b>"+esc(w.film)+(w.mine?" 🎉":"")+"</b></div>"; });
  }else h+="<div class='muted small'>No nominations.</div>";
  h+="</div><div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Roll credits → Year "+(r.year+1)+"</button></div>";
  openModal(h,{noX:true});
  beep("drums");
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
    "<div class='cost-line'><span>Awards</span><b>"+(o.stats.awards||[]).map(a=>a.cat).join(", ")||"none"+"</b></div>"+
    "</div></div><div class='modal-actions'><button class='btn btn-primary' id='goNew'>🎬 Found a new studio</button></div>";
  const v=openModal(h,{noX:true,locked:true});
  v.querySelector("#goNew").onclick=()=>{ try{localStorage.removeItem("bow_save");}catch(e){} location.reload(); };
}

/* ═══════════ help ═══════════ */
function helpModal(){
  let h="<h3>❓ How the movie business works here</h3>"+
  "<div class='card'><b>1. 📝 Develop — scripts & crew</b><p class='small muted'>Buy a script, then build the package: a ✍️ <b>screenwriter</b> rewrites it during pre-production (skill + genre fit drive the boost), a 🎞 <b>producer's</b> logistics guard against weekly overruns, a 🎬 director shapes quality, and 🌟 stars open the film. Production burns cash weekly through pre → shoot → post.</p></div>"+
  "<div class='card'><b>2. 🌊 Ride the market</b><p class='small muted'>Genre taste cycles (see Market pulse on 🏛 Studio): horror gets hot, musicals cool off. Hot genres multiply your opening weekend; cold ones drag it. Greenlight into a rising wave — and date before it breaks.</p></div>"+
  "<div class='card'><b>3. 📅 Date it like a pro</b><p class='small muted'>Summer & holidays multiply openings; January and September are graveyards. Check the calendar for rival tentpoles — head-to-head weekends split the audience.</p></div>"+
  "<div class='card'><b>4. 📊 Box office math (real Hollywood rules)</b><p class='small muted'>Opening weekend = star power × marketing × season × <b>genre trend</b> × competition. Legs (total ÷ opening) come from quality — horrors die fast, animation runs for months. The studio keeps ≈53% domestic / ≈42% international, so <b>breakeven ≈ (budget + P&A) ÷ 0.48</b> worldwide.</p></div>"+
  "<div class='card'><b>5. 📺 Distribution: theaters or OTT</b><p class='small muted'>At greenlight pick a plan: 🎥 theatrical (full upside + risk), 📺 streaming original (platforms bid on delivery — guaranteed cash, no box office), or decide later. Finished films can be shopped to streamers anytime — 3 platforms bid, pick one. After the run, films earn PVOD + streaming licenses.</p></div>"+
  "<div class='card'><b>6. 💰 Weekly cash & P&L</b><p class='small muted'>Box office rentals (~53% of domestic gross) arrive <b>every week a film is playing</b>, intl rentals settle at end of run, and every dollar is itemized in Finance → This week's P&L. A-list ensembles take 5% backend; pre-sales & tax incentives smooth cash flow.</p></div>"+
  "<div class='card'><b>7. 🏰 Franchise empire (and fatigue)</b><p class='small muted'>Big hits (≈2× breakeven + good reviews) unlock a franchise: sequels, 🧸 merch lines (weekly income), 🎮 game licenses (one-time cash), and 🎡 theme parks (tier 2+). Milk the brand too fast and audiences tire (sequel boost ×1.35 → ×1.05); rest it ~18 months and nostalgia recharges.</p></div>"+
  "<div class='card'><b>8. 🎭 Talent careers</b><p class='small muted'>Stars fade when idle (cheaper fees — cast them in a good film to engineer a comeback), veterans retire, and new names arrive weekly. Your booking choices write Hollywood history.</p></div>"+
  "<div class='card'><b>9. 💼 Survive</b><p class='small muted'>Overhead, interest and P&A never sleep. Loans bridge gaps; the credit line has limits. Hits build reputation, franchises and a valuable catalog. Flops build character.</p></div>"+
  "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Lights down, head rolled 🎬</button></div>";
  openModal(h,{noX:true});
}
