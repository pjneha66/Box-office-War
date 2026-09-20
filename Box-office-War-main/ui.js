/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — ui.js (rendering + interaction)
   ═══════════════════════════════════════════════════════════ */
"use strict";

let TAB = "studio";
let WZ = null;          // greenlight/pitch wizard state
let SCHEDULE = null;    // release scheduling state
let SOUND = true;
let AUTO = null;        // auto-play interval handle
let SEL = { scenario:"standard", difficulty:"normal", sandbox:false, slot:1, legacy:"" }; // start-screen meta picks
/* v5: reduced-motion preference: "auto" follows the OS, "off" kills animations, "on" forces them */
let MOTION = "auto";
try{ MOTION = localStorage.getItem("bow_motion") || "auto"; }catch(e){}

/* ═══════════ v4 sound: real WebAudio stings ═══════════ */
let AC = null;
function audioCtx(){
  if(!SOUND) return null;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==="suspended" && AC.resume) AC.resume();
    return AC;
  }catch(e){ return null; }
}
/* one shaped voice */
function tone(ac, t, freq, dur, opts){
  opts = opts||{};
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = opts.type || "sine";
  o.frequency.setValueAtTime(freq, t);
  if(opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(20,opts.glide), t+dur);
  const peak = (opts.gain==null? 0.08 : opts.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack||0.012));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = g;
  if(opts.filter){
    const f = ac.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = opts.filter;
    g.connect(f); node = f;
  }
  o.connect(g); node.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
/* short burst of filtered noise — cymbals, cash drawer, applause */
function noise(ac, t, dur, opts){
  opts = opts||{};
  const len = Math.max(1, Math.floor(ac.sampleRate*dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, opts.decay||2);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = opts.type || "bandpass";
  f.frequency.value = opts.freq || 3000;
  f.Q.value = opts.q || 1;
  const g = ac.createGain(); g.gain.value = opts.gain==null? 0.05 : opts.gain;
  src.connect(f); f.connect(g); g.connect(ac.destination);
  src.start(t); src.stop(t+dur+0.02);
}
const NOTE = {C4:261.6,D4:293.7,E4:329.6,F4:349.2,G4:392,A4:440,B4:493.9,C5:523.3,D5:587.3,E5:659.3,F5:698.5,G5:784,A5:880,C6:1046.5,G3:196,C3:130.8,E3:164.8,F3:174.6,A3:220};
/* the sting library */
const STINGS = {
  click(ac,t){ tone(ac,t,660,0.05,{gain:0.05,type:"triangle"}); },
  good(ac,t){ [NOTE.E5,NOTE.G5,NOTE.C6].forEach((f,i)=>tone(ac,t+i*0.06,f,0.16,{gain:0.06,type:"triangle"})); },
  bad(ac,t){ tone(ac,t,220,0.28,{gain:0.09,type:"sawtooth",glide:120,filter:900});
             tone(ac,t+0.12,165,0.34,{gain:0.08,type:"sawtooth",glide:80,filter:700}); },
  gold(ac,t){ [NOTE.C5,NOTE.E5,NOTE.G5,NOTE.C6].forEach((f,i)=>tone(ac,t+i*0.055,f,0.22,{gain:0.06,type:"triangle"})); },
  /* 🎬 opening fanfare — brassy triad stack when a film hits theaters */
  fanfare(ac,t){
    const notes=[[NOTE.C4,0],[NOTE.G4,0.10],[NOTE.C5,0.20],[NOTE.E5,0.30],[NOTE.G5,0.40]];
    notes.forEach(function(n){
      tone(ac,t+n[1],n[0],0.55,{gain:0.055,type:"sawtooth",filter:2200,attack:0.03});
      tone(ac,t+n[1],n[0]*2,0.4,{gain:0.02,type:"triangle"});
    });
    tone(ac,t+0.52,NOTE.C6,0.75,{gain:0.07,type:"triangle",attack:0.05});
    noise(ac,t+0.5,0.5,{freq:7000,gain:0.03,decay:3});
  },
  /* 💰 cash register — ding + drawer slam */
  cash(ac,t){
    tone(ac,t,1568,0.11,{gain:0.07,type:"square"});
    tone(ac,t+0.015,2093,0.13,{gain:0.045,type:"sine"});
    noise(ac,t+0.10,0.22,{freq:1400,gain:0.05,q:0.7,decay:1.6});
    tone(ac,t+0.16,196,0.16,{gain:0.04,type:"triangle"});
  },
  /* 🥁 award drums — timpani roll into the envelope */
  drums(ac,t){
    for(let i=0;i<14;i++){
      const at = t + i*0.055;
      tone(ac,at,72+(i%2?6:0),0.09,{gain:0.03+i*0.0035,type:"sine",filter:400});
    }
    tone(ac,t+0.82,64,0.75,{gain:0.11,type:"sine",filter:320,attack:0.005});
    noise(ac,t+0.82,0.7,{freq:5200,gain:0.045,decay:2.4});
    [NOTE.C5,NOTE.E5,NOTE.G5].forEach((f,i)=>tone(ac,t+0.9+i*0.02,f,0.9,{gain:0.045,type:"triangle",attack:0.04}));
  },
  /* 🎉 smash-hit chime */
  smash(ac,t){
    [NOTE.G4,NOTE.C5,NOTE.E5,NOTE.G5,NOTE.C6,NOTE.E5,NOTE.G5,NOTE.C6].forEach((f,i)=>
      tone(ac,t+i*0.045,f,0.35,{gain:0.055,type:"triangle"}));
    noise(ac,t+0.30,0.9,{freq:6000,gain:0.035,decay:1.2});
  },
  /* 📉 downgrade buzzer */
  buzz(ac,t){ tone(ac,t,150,0.4,{gain:0.07,type:"square",glide:70,filter:600}); },
  /* 📞 earnings-call chime */
  chime(ac,t){ tone(ac,t,880,0.28,{gain:0.05,type:"sine"}); tone(ac,t+0.14,1174,0.4,{gain:0.045,type:"sine"}); },
  /* 🎬 clapper snap on week advance */
  clap(ac,t){ noise(ac,t,0.09,{freq:2200,gain:0.045,q:0.6,decay:3}); tone(ac,t,320,0.06,{gain:0.04,type:"square"}); },
};
/* v5: haptics — big beats buzz the phone (navigator.vibrate), if the user left it on */
let HAPTICS = true;
try{ HAPTICS = localStorage.getItem("bow_hap")!=="0"; }catch(e){}
function rumble(pattern){
  if(!HAPTICS) return;
  try{ if(navigator && navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
}
const HAPTIC_MAP = { fanfare:[35], cash:[20], drums:[25,40,25], smash:[40,60,40], buzz:[90], gold:[20,30,20], bad:[70], clap:[15], click:[6], chime:[18], good:[18] };
function beep(kind){
  rumble(HAPTIC_MAP[kind] || HAPTIC_MAP.click);
  const ac = audioCtx();
  if(!ac) return;
  try{ (STINGS[kind]||STINGS.click)(ac, ac.currentTime + 0.01); }catch(e){}
}

/* ═══════════ v4 motion: confetti burst ═══════════ */
function motionOK(){
  if(MOTION==="off") return false;
  if(MOTION==="on") return true;
  try{ return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return true; }
}
function applyMotionPref(){
  try{ document.body.classList.toggle("rm-motion", !motionOK()); }catch(e){}
}
function confetti(opts){
  opts = opts||{};
  if(typeof document==="undefined") return;
  if(!motionOK()) return;
  const cvs = document.createElement("canvas");
  cvs.className = "confetti-canvas";
  const w = cvs.width = window.innerWidth || 800, h = cvs.height = window.innerHeight || 600;
  document.body.appendChild(cvs);
  const ctx = cvs.getContext && cvs.getContext("2d");
  if(!ctx){ cvs.remove(); return; }
  const colors = opts.colors || ["#f5b942","#ffd479","#ff5d6c","#4dd6e8","#b48bff","#7ee787"];
  const N = opts.count || 140;
  const parts = [];
  for(let i=0;i<N;i++){
    parts.push({
      x: w*(0.5 + (Math.random()-0.5)*0.5), y: h*0.28 + Math.random()*40,
      vx: (Math.random()-0.5)*11, vy: -6 - Math.random()*9,
      s: 4 + Math.random()*7, r: Math.random()*Math.PI, vr:(Math.random()-0.5)*0.34,
      c: colors[Math.floor(Math.random()*colors.length)], life: 1
    });
  }
  let frame = 0;
  const total = opts.frames || 150;
  const raf = window.requestAnimationFrame || function(fn){ return setTimeout(fn,16); };
  (function loop(){
    frame++;
    ctx.clearRect(0,0,w,h);
    for(const p of parts){
      p.vy += 0.28; p.vx *= 0.995;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      p.life = Math.max(0, 1 - frame/total);
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s/2, -p.s/2, p.s, p.s*0.62);
      ctx.restore();
    }
    if(frame < total) raf(loop);
    else cvs.remove();
  })();
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
  if(hasSave()) $("#btnContinue").style.display="block";
  $("#btnContinue").onclick=()=>{ const g=loadGame(); if(g){ enterApp(); } };
  $("#btnStart").onclick=()=>{
    const nm=($("#studioName").value||"Parallax Pictures").trim().slice(0,26);
    newGame(archSel, nm, {scenario:SEL.scenario, difficulty:SEL.difficulty, sandbox:SEL.sandbox, slot:SEL.slot, legacy:SEL.legacy});
    enterApp(true);
  };
  // v2 start options: scenario, difficulty, sandbox, slots (were declared but never wired)
  try{ buildStartOptions(); }catch(e){ console.warn("start options", e); }
  // topbar
  $("#btnWeek").onclick=()=>{ doWeek(1); };
  $("#btnFast").onclick=()=>{ doWeek(4); };
  $("#btnAuto").onclick=()=>{ toggleAuto(); beep("click"); };
  $("#btnSound").onclick=()=>{ SOUND=!SOUND; localStorage.setItem("bow_snd", SOUND?"1":"0");
    $("#btnSound").textContent=SOUND?"🔊":"🔇"; beep("click"); };
  SOUND = localStorage.getItem("bow_snd")!=="0"; $("#btnSound").textContent=SOUND?"🔊":"🔇";
  $("#btnSettings").onclick=()=>{ beep("click"); settingsModal(); };
  $("#btnHelp").onclick=()=>helpModal();
  $("#btnAch") && ($("#btnAch").onclick=()=>{ beep("click"); achievementsModal(); });
  // tabs
  $$(".tab,.btab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  try{ applyChromeLang(); }catch(e){}
  applyMotionPref();
  installGestures();   // v5: swipe tabs + pull-to-advance on mobile
  // keyboard shortcuts
  document.addEventListener("keydown", e=>{
    if(e.target.tagName==="INPUT" || e.target.tagName==="TEXTAREA") return;
    if(e.key>=="1" && e.key<="7"){ const tabs=["studio","develop","productions","boxoffice","ott","empire","finance"]; switchTab(tabs[e.key-1]); }
    else if(e.code==="Space" && !e.shiftKey){ e.preventDefault(); doWeek(1); }
    else if(e.code==="Space" && e.shiftKey){ e.preventDefault(); doWeek(4); }
    else if(e.key==="r" || e.key==="R"){ e.preventDefault(); if(!G.over){ const rows=$$("[data-sched]"); if(rows.length) rows[0].click(); } }
    else if(e.key==="s" || e.key==="S"){ e.preventDefault(); saveGame(); toast("💾 Game saved"); }
    else if(e.key==="l" || e.key==="L"){ e.preventDefault(); const g=loadGame(); if(g){ render(); toast("📂 Game loaded"); } }
    else if(e.key==="h" || e.key==="H"){ e.preventDefault(); helpModal(); }
    else if(e.key==="Escape"){ closeModal(); }
  });
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
  if(G.pendingEarnings) earningsModal();
  else if(G.pendingChoice) choiceModal();
  else if(G.pendingDeepfake) deepfakeModal();
  else if(G.pendingAuction) auctionModal();
  else if(G.pendingSports) sportsModal();
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
  beep("clap");
  if(n===1) advanceWeek(); else advanceWeeks(n);
  afterTick();
}
/* drain the engine's sound-effect bus, staggered so stings don't collide */
function playSfx(){
  const list = (G.sfx||[]).slice(0,4);
  G.sfx = [];
  list.forEach(function(k,i){ setTimeout(function(){ beep(k); }, 120 + i*520); });
  if(G.confetti){ G.confetti=false; setTimeout(function(){ confetti({count:170}); }, 220); }
}
function afterTick(){
  flashes(G.flash);
  playSfx();
  tutTrack();      // v5 tutorial
  render();
  if(G.pendingEarnings) earningsModal();
  else if(G.pendingChoice) choiceModal();
  else if(G.pendingDeepfake) deepfakeModal();
  else if(G.pendingAuction) auctionModal();
  else if(G.pendingSports) sportsModal();
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
  let h="";
  if(TAB==="studio") h=viewStudio();
  else if(TAB==="develop") h=viewDevelop();
  else if(TAB==="productions") h=viewProductions();
  else if(TAB==="boxoffice") h=viewBoxOffice();
  else if(TAB==="ott") h=viewOTT();
  else if(TAB==="empire") h=viewEmpire();
  else if(TAB==="finance") h=viewFinance();
  const tb = tutBanner();   // v5 interactive tutorial rides on top of every tab
  v.innerHTML = (tb? tb : "") + h;
  bindView();
}

/* ═══════════ VIEW: studio ═══════════ */
/* Control-room ops strip: read-only rollup of warnings, deadlines, production,
   market and rivals from existing state. No simulation writes here. */
function studioOpsCard(ctx){
  ctx=ctx||{};
  const warns=[], deadlines=[], prod=[], market=[], rivals=[];
  try{
    const st=G.studio, woy=woyOf(G.week);
    if(st.cash<25) warns.push("Cash low ("+fmtM(st.cash)+") — bridge with loans or pre-sales.");
    try{ if(st.debt>0 && (st.debt-Math.max(st.cash,0))>maxDebt()) warns.push("Debt beyond credit line — bank watches. See Finance."); }catch(e){}
    if((G.weeksInDebt||0)>0) warns.push("Net debt over line "+G.weeksInDebt+"/3 wks — bankruptcy risk.");
    if(G.theaterCap>0) warns.push("Theater caps −45% box office for "+G.theaterCap+" wks.");
    if((G.unionMeter||0)>=(DATA.UNION?DATA.UNION.strikeAt:75)) warns.push("Guild strike risk — shoots may halt.");
    if((G.piracy||0)>=60) warns.push("Piracy "+Math.round(G.piracy||0)+"/100 bleeds live runs.");
    if(G.streamer && G.week-(G.streamer.lastContent||0)>6) warns.push("Streamer starved — churn bleeding subs.");
    if(G.pendingChoice) warns.push("A decision needs you (event choice pending).");
    if(G.pendingAuction) warns.push("Streaming auction waiting — pick a bid or keep theatrical.");
    if(G.pendingSports) warns.push("Sports rights auction expires W"+(G.pendingSports.expires||"?")+".");
    if(G.pendingDeepfake) warns.push("Deepfake drill open — 2-week clock running.");
    (G.offers||[]).filter(o=>o.expires-G.week<=1).forEach(o=>{ warns.push("Offer expiring: "+(o.filmTitle||o.seriesTitle||"deal")+" ("+fmtM(o.value)+")."); });
    (ctx.dated||[]).slice(0,3).forEach(p=>{ deadlines.push("“"+p.title+"” dated "+dateLabel(p.releaseWeek)+"."); });
    const fests=(DATA.FESTIVALS||[]).filter(f=>f.woy>woy).slice(0,1);
    fests.forEach(f=>{ deadlines.push(f.emoji+" "+f.name+" W"+f.woy+" — submit eligible films."); });
    if([13,26,39,52].some(w=>w>woy)) deadlines.push("Next sports auction W"+[13,26,39,52].find(w=>w>woy)+"/52.");
    if(woy>=44&&woy<=52) deadlines.push("FYC voting open — campaign before week 1.");
    (G.projects||[]).filter(p=>p.strikePause>0).forEach(p=>{ prod.push("✊ “"+p.title+"” paused "+p.strikePause+" wks (strike)."); });
    (G.projects||[]).filter(p=>(p.overrun||0)>=1).forEach(p=>{ prod.push("Overrun “"+p.title+"” +"+fmtM(p.overrun)+"."); });
    (ctx.readyUnscheduled||[]).slice(0,3).forEach(p=>{ prod.push("“"+p.title+"” ready, undated — date or shop it."); });
    if(!(ctx.readyUnscheduled||[]).length && !inProdProjects().length && !G.projects.length) prod.push("Slate empty — develop a script.");
    const gs=Object.keys(DATA.GENRES).map(g=>({g, v:(typeof trendOf==="function"?trendOf(g):1)})).sort((a,b)=>b.v-a.v);
    gs.slice(0,2).forEach(r=>{ market.push(DATA.GENRES[r.g].emoji+" "+DATA.GENRES[r.g].name+" "+r.v.toFixed(2)+"× — develop here."); });
    if(G.streamWar>0) market.push("Streaming war: offers +30% for "+G.streamWar+" wks.");
    (G.rivals||[]).forEach(r=>{
      const live=(r.slate||[]).filter(f=>f.live);
      rivals.push(esc(r.name)+": "+fmtM(r.ytd||0)+" YTD"+(live.length?" · "+live.length+" live":""));
    });
  }catch(e){}
  function list(a, empty){ return a.length? a.map(x=>"<div class='cost-line'><span>"+x+"</span></div>").join("") : "<div class='tiny muted'>"+empty+"</div>"; }
  return "<div class='section-title'>Control room</div><div class='grid g2'>"+
    "<div class='card' style='border-left:3px solid var(--red)'><b>⚠ Warnings</b>"+list(warns,"All quiet.")+"</div>"+
    "<div class='card' style='border-left:3px solid var(--gold)'><b>📅 Deadlines</b>"+list(deadlines,"Nothing dated.")+
      "<div class='row' style='margin-top:8px'><button class='btn btn-sm' onclick=\"switchTab('productions')\">Open Films</button></div></div>"+
    "<div class='card' style='border-left:3px solid var(--blue)'><b>🎬 Production</b>"+list(prod,"Pipeline healthy.")+
      "<div class='row' style='margin-top:8px'><button class='btn btn-sm' onclick=\"switchTab('develop')\">Develop</button></div></div>"+
    "<div class='card' style='border-left:3px solid var(--green)'><b>📈 Market</b>"+list(market,"No signal.")+
      "<div class='row' style='margin-top:8px'><button class='btn btn-sm' onclick=\"switchTab('boxoffice')\">Charts</button></div></div>"+
    "<div class='card' style='border-left:3px solid var(--purple)'><b>⚔ Rivals</b>"+list(rivals,"No rival data.")+
      "<div class='row' style='margin-top:8px'><button class='btn btn-sm' onclick=\"switchTab('finance')\">Finance</button></div></div>"+
    "<div class='card'><b>📰 Recent</b><div class='tiny muted'>"+(G.news||[]).slice(0,3).map(n=>esc(n.t)).join("<br>")+"</div></div>"+
  "</div>";
}
function viewStudio(){
  const st=G.studio;
  const yr=yearOf(G.week);
  const myYtd=G.films.filter(f=>f.year===yr).reduce((a,f)=>a+(f.ww||0),0);
  const live=activeFilms().length, inProd=inProdProjects().length;
  const lastNet=G.txHistory && G.txHistory.length? G.txHistory[G.txHistory.length-1].net : 0;
  let rev12=0, net12=0;
  try{
    for(const s of (G.txHistory||[])){
      for(const k in (s.cats||{})){ const v=s.cats[k]||0; if(v>0 && k!=="financing") rev12+=v; }
      net12+=s.net||0;
    }
    rev12=Math.round(rev12*10)/10; net12=Math.round(net12*10)/10;
  }catch(e){}
  let studioVal=0;
  try{ studioVal=Math.round((st.cash-(st.debt||0)+catalogValue()+(G.streamer?(G.streamer.subs||0)*18:0))*10)/10; }catch(e){}
  const dated=(G.projects||[]).filter(p=>p.releaseWeek>G.week).sort((a,b)=>a.releaseWeek-b.releaseWeek);
  const readyUnscheduled=(typeof readyProjects==="function"?readyProjects():[]).filter(p=>!p.releaseWeek);
  const topFr=(G.franchises||[]).slice().sort((a,b)=>(b.decay||0)-(a.decay||0))[0]||null;
  const frHeat=topFr?Math.round((topFr.decay||0)*100):null;
  const awardCount=(G.festWins||[]).filter(w=>w.year===yr).length+(G.stats.awards||[]).filter(a=>a.year===yr).length;
  let h="<div class='stat-hero'>"+
    statCard(fmtM(st.cash),"Cash on hand")+
    statCard("+"+fmtM(rev12),"Revenue (12w)","var(--green)")+
    statCard((net12>=0?"+":"")+fmtM(net12),"Profit (12w)", net12>=0?"var(--green)":"var(--red)")+
    statCard(fmtM((st.debt||0)+(G.mezz||0)+(st.mezzDebt||0)),"Debt","var(--red)")+
    statCard(fmtM(studioVal),"Studio value")+
    statCard(Math.round(st.rep)+"/100","Reputation","var(--gold2)")+
    statCard("Y"+yr+" · W"+woyOf(G.week),"Current date")+
    statCard(String(inProd),"Active productions")+
    statCard(String(dated.length),"Upcoming releases")+
    statCard(fmtM(myYtd),"Box office Y"+yr)+
    statCard(G.streamer?fmtSubs(G.streamer.subs):"—","Streaming subs")+
    statCard(frHeat===null?"—":frHeat+"%","Franchise heat"+(topFr?" · "+esc(topFr.name):""))+
    statCard(String(awardCount),"Awards Y"+yr)+
  "</div>";
  h+=studioOpsCard({dated, readyUnscheduled, topFr, net12});
  // scenario / difficulty / sandbox / IPO / streamer / achievements (from main)
  try{
    const scen=DATA.SCENARIOS[G.scenario]||{emoji:"🎬",name:G.scenario||"Standard"};
    const diff=DATA.DIFFICULTIES[G.difficulty]||{emoji:"⚖️",name:G.difficulty||"Normal"};
    h+="<div class='card'><div class='row'>"+
      "<span class='tag gold'>"+scen.emoji+" "+scen.name+"</span>"+
      "<span class='tag blue'>"+diff.emoji+" "+diff.name+"</span>"+
      (G.sandbox?"<span class='tag purple'>🧪 sandbox</span>":"")+
      (G.ipo||G.public?"<span class='tag green'>🔔 public company</span>":"")+
      (G.streamer?"<span class='tag purple'>🛰 "+esc(G.streamer.name)+" · "+(typeof fmtSubs==="function"? fmtSubs(G.streamer.subs) : G.streamer.subs.toFixed(1)+"M")+" subs</span>":"")+
      (G.ach && Object.keys(G.ach).length?"<button class='btn btn-sm' id='btnAch'>🏆 "+Object.keys(G.ach).length+"/"+(DATA.ACH?DATA.ACH.length:15)+"</button>":"<button class='btn btn-sm' id='btnAch'>🏆 Achievements</button>")+
    "</div></div>";
  }catch(e){}

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
  if(G.streamer) h+="<div class='card' style='border-left:3px solid var(--purple)'><b>📱 "+esc(G.streamer.name)+"</b> — "+G.streamer.subs.toFixed(1)+"M subs · +"+fmtM(G.streamer.income||G.streamer.totalRev||0)+"/wk · ceiling "+streamerCeiling()+"M</div>";
  h+="<div class='card' style='border-left:3px solid var(--line)'><div class='spread'><span class='small muted'>🎞 Exhibitor relations</span><b class='"+( (G.exhibitor||G.exhibRel||50)>=50?"pos":"neg")+"'>"+Math.round(G.exhibitor||G.exhibRel||50)+"/100</b></div>"+meter(G.exhibitor||G.exhibRel||50,100)+"<div class='tiny muted'>Short windows anger exhibitors and swing openings ±5%.</div></div>";
  /* v5: piracy meter (item 8) — windowing feeds it, the task force fights it */
  {
    const pl=(typeof piracyLabel==="function")? piracyLabel() : {tag:"",cls:""};
    h+="<div class='card' style='border-left:3px solid var(--line)'><div class='spread'><span class='small muted'>🏴‍☠️ Piracy meter</span><b>"+Math.round(G.piracy||0)+"/100 <span class='tag "+pl.cls+"'>"+pl.tag+"</span></b></div>"+
       meter(G.piracy||0,100,"linear-gradient(90deg,#5a6a90,#ff5d6c)")+
       "<div class='tiny muted'>Drains weekly gross on live runs (up to −10% at 100). 90-day windows starve it; day-and-date feeds it; the 🛡 Anti-Piracy Task Force (see 💼 Finance → Studio investments) drains it constantly.</div></div>";
  }
  /* v5: guild relations meter (item 14) — unions watch AI productions, overruns and hardball */
  {
    const ul=(typeof unionLabel==="function")? unionLabel() : {tag:"",cls:""};
    const um = G.unionMeter||0;
    h+="<div class='card' style='border-left:3px solid var(--line)'><div class='spread'><span class='small muted'>✊ Guild relations</span><b>"+Math.round(um)+"/100 <span class='tag "+ul.cls+"'>"+ul.tag+"</span></b></div>"+
       meter(um,100, um>=60?"linear-gradient(90deg,#f5b942,#ff5d6c)":"linear-gradient(90deg,#3ddc84,#f5b942)")+
       "<div class='tiny muted'>AI productions, producerless overruns and stonewalled talks heat the guilds. Past "+(typeof DATA!=="undefined"&&DATA.UNION? DATA.UNION.strikeAt:75)+" the town walks out. Bargaining season: week "+(typeof DATA!=="undefined"&&DATA.UNION? DATA.UNION.negotiationWoy:30)+" each year.</div></div>";
  }
  // awards card from main if available
  if(typeof viewAwardsCard==="function"){
    try{ h+=viewAwardsCard(); }catch(e){}
  }
  try{ if(typeof awardsBoard==="function") h+=awardsBoard(); }catch(e){}
  h+="<div class='section-title'>Market share — Year "+yr+" (worldwide gross)</div><div class='card'>";
  const rows=[{name:G.studio.name, ww:myYtd, me:true}].concat(G.rivals.map(r=>({name:r.name, ww:r.ytd})));
  const max=Math.max(1,...rows.map(r=>r.ww));
  rows.sort((a,b)=>b.ww-a.ww).forEach((r,i)=>{
    h+="<div class='chart-bar' style='margin:5px 0'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(r.me?"⭐ ":"")+esc(r.name)+"</div></div>"+
       "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(6,r.ww/max*100)+"%;background:"+(r.me?"linear-gradient(90deg,#f5b942,#ffd479)":"#4a5570")+"'>"+fmtM(r.ww)+"</div></div></div>";
  });
  h+="</div>";
  { // v5: unified achievements — one shelf, counted once
    const got = (typeof achCount==="function")? achCount() : Object.keys(G.ach||{}).length;
    if(got){
      h+="<div class='section-title'>🏆 Achievements ("+got+"/"+(typeof achTotal==="function"?achTotal():"?")+")</div><div class='card'><div class='row'>";
      (G.achv||[]).slice(-14).forEach(function(a){ h+="<span class='tag gold' title='"+esc(a.desc||"")+"'>🏅 "+esc(a.title)+"</span>"; });
      if(got>14) h+="<span class='tag'>+"+(got-14)+" more — open the trophy room</span>";
      h+="</div></div>";
    }
  }
  try{ h+=progressionCard(); }catch(e){}
  try{ if(typeof repBoard==="function") h+=repBoard(); }catch(e){}
  try{ if(typeof specBoard==="function") h+=specBoard(); }catch(e){}
  try{ if(typeof econBoard==="function") h+=econBoard(); }catch(e){}
  try{ if(typeof industryBoard==="function") h+=industryBoard(); }catch(e){}
  try{ if(typeof legacyBoard==="function") h+=legacyBoard(); }catch(e){}
  h+="<div class='card' style='display:flex;gap:8px;flex-wrap:wrap;align-items:center'>"+
     "<b>📸 Share your studio</b><span class='tiny muted' style='flex:1'>Snapshot your empire as a PNG card.</span>"+
     "<button class='btn btn-sm btn-primary' id='btnShareCard'>Generate card</button></div>";
  h+="<div class='spread'><div class='section-title' style='margin:0'>Industry feed</div>"+
    "<button class='btn btn-sm' onclick='eventHistModal()'>📜 Event history ("+((G.eventHist||[]).length)+")</button></div><div class='newsfeed'>";
  if(!G.news.length) h+="<div class='muted small'>No news yet. Make some.</div>";
  G.news.slice(0,40).forEach(n=>{
    h+="<div class='news-item "+n.k+"'><span class='n-i'>"+n.t.split(" ")[0]+"</span><span>"+esc(n.t.slice(n.t.split(" ")[0].length))+"</span><span class='n-w'>"+dateLabel(n.w)+"</span></div>";
  });
  h+="</div>";
  return h;
}
/* Event history: every celebrity (and logged) beat, newest first. */
function eventHistModal(){
  const rows=(G.eventHist||[]);
  let h="<h3>📜 Event history</h3>";
  if(!rows.length) h+="<div class='card muted small'>No logged events yet — play a few weeks and the town will provide.</div>";
  else{ h+="<div class='card'>"; rows.slice(0,40).forEach(e=>{
      h+="<div class='cost-line'><span>"+esc(e.title)+"</span><b class='tiny muted'>"+dateLabel(e.week)+"</b></div>";
    }); h+="</div>"; }
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Close</button></div>";
  openModal(h);
}

function statCard(v,l,c, tip){ 
  const tt = tip ? " data-tooltip='"+esc(tip)+"'" : "";
  return "<div class='stat'"+tt+"><div class='s-v' style='"+(c?"color:"+c:"")+"'>"+v+"</div><div class='s-l'>"+l+"</div></div>"; 
}
/* Living industry: timeline of what actually happened + nine-domain state.
   Everything below already happened — this board only connects the dots. */
function industryBoard(){
  let tl, st;
  try{ tl=industryTimeline(); st=industryState(); }catch(e){ return ""; }
  let h="<div class='section-title'>Living industry</div><div class='grid g2'>"+
    "<div class='card'><b>🕰 Industry timeline</b><div class='tiny muted' style='margin:4px 0'>Cause → effect, across your career.</div>";
  if(!tl.length) h+="<div class='tiny muted'>Nothing major yet. Ship something.</div>";
  tl.slice(-12).forEach(e=>{ h+="<div class='cost-line'><span>"+e.icon+" "+esc(e.text)+"</span><b class='tiny muted'>"+dateLabel(e.week)+"</b></div>"; });
  h+="</div><div class='card'><b>🌐 Industry state</b><div class='tiny muted' style='margin:4px 0'>Nine domains, right now.</div>";
  st.forEach(r=>{ h+="<div class='cost-line'><span>"+r[0]+"</span><b class='tiny'>"+r[1]+"</b></div>"; });
  return h+"</div></div>";
}
/* Industry report: six bounded indices with plain-language reads + history. */
function econBoard(){
  let e, hist=[];
  try{ e=econState(); hist=G.econHist||[]; }catch(err){ return ""; }
  const pct=v=>Math.round((v-1)*100);
  const read=(id,v,up,down)=>"<div class='cost-line'><span>"+econName(id)+"</span><b class='"+(v>1.02?"pos":v<0.98?"neg":"")+"'>"+(pct(v)>=0?"+":"")+pct(v)+"% · "+(v>=1.02?up:v<=0.98?down:"near baseline")+"</b></div>";
  let h="<div class='section-title'>Industry report</div><div class='card'>"+
    read("theater",e.theater,"crowds back","empty seats")+
    read("stream",e.stream,"bidding wars","subscriber chill")+
    read("adcost",e.adcost,"pricey airtime","cheap reach")+
    read("prod",e.prod,"costly shoots","cheap shoots")+
    read("intl",e.intl,"abroad booms","abroad cools")+
    "<div class='cost-line'><span>Talent salaries</span><b>+"+Math.round(((G.wageInfl||1)-1)*100)+"% vs Y1</b></div>"+
    "<div class='cost-line'><span>Market prices</span><b>+"+Math.round(((G.infl||1)-1)*100)+"% vs Y1</b></div>";
  if(hist.length>1){
    h+="<div class='tiny muted' style='margin-top:6px'>Path: "+hist.slice(-6).map(r=>"Y"+r.year+" T"+Math.round(r.theater*100)+" S"+Math.round(r.stream*100)).join(" · ")+"</div>";
  }
  return h+"</div>";
}
function econName(id){
  return {theater:"🎟 Theater demand", stream:"📱 Streaming growth", adcost:"📣 Ad costs",
    prod:"🏗 Production costs", intl:"🌍 International growth"}[id]||id;
}
/* Studio profile: declared focus (double XP, switchable anytime), ten paths
   with levels from shipped work, strengths/weaknesses, recent movement. */
function specBoard(){
  let defs;
  try{ defs=specDefs(); }catch(e){ return ""; }
  const focus=(G.spec&&G.spec.focus)||null;
  const rows=defs.map(d=>({d, xp:((G.spec&&G.spec.xp&&G.spec.xp[d.id])||0), lvl:specLvl(d.id)}));
  rows.sort((a,b)=>b.xp-a.xp);
  const best=rows[0], worst=rows[rows.length-1];
  let h="<div class='section-title'>Studio profile</div><div class='card'>"+
    "<div class='spread'><div><b>Focus: "+(focus?focus:"none (pick one — double XP)")+"</b>"+
    "<div class='tiny muted'>Strength: "+(best.xp?best.d.icon+" "+best.d.name+" L"+best.lvl:"nothing shipped yet")+
    " · weakness: "+(worst.d.icon+" "+worst.d.name)+"</div></div></div>"+
    "<div class='row' style='margin-top:8px'>"+
    defs.map(d=>"<button class='btn btn-sm "+(focus===d.id?"btn-primary":"")+"' data-spec='"+d.id+"' title='"+d.desc+"'>"+d.icon+" "+d.name+"</button>").join("")+"</div></div>";
  h+="<div class='card'><b class='small'>Paths</b>";
  rows.forEach(r=>{
    h+="<div class='spread' style='margin-top:4px'><span class='small'>"+r.d.icon+" "+r.d.name+" <span class='tiny muted'>"+r.d.desc+"</span></span>"+
      "<b class='tiny'>L"+r.lvl+" · "+r.xp+"xp"+(focus===r.d.id?" · 🎯":"")+"</b></div>"+meter(Math.min(12,r.xp),12);
  });
  return h+"</div>";
}
/* Career legacy: to-date summary, hall of fame, and the closing card. */
function legacySummaryCard(){
  let L;
  try{ L=careerLegacy(); }catch(e){ return ""; }
  return "<div class='card' style='border-left:3px solid var(--gold)'><b>"+L.grade+" — “"+esc(L.studio)+"”</b>"+
    "<div class='cost-line'><span>Revenue / profit</span><b>"+fmtM(L.revenue)+" / "+(L.profit>=0?"+":"")+fmtM(L.profit)+"</b></div>"+
    "<div class='cost-line'><span>Films · series · franchises</span><b>"+L.films+" · "+L.series+" · "+L.franchises+"</b></div>"+
    "<div class='cost-line'><span>Smashes · flops · awards</span><b class='pos'>"+L.smash+"</b> · <b class='neg'>"+L.flops+"</b> · <b>"+L.awards+"</b></div>"+
    "<div class='cost-line'><span>Studio value · subs</span><b>"+fmtM(L.value)+" · "+L.subs+"M</b></div>"+
    "<div class='tiny muted'>Recorded in the hall of fame — future founders may claim the heirloom.</div></div>";
}
function legacyBoard(){
  let L, hall=[];
  try{ L=careerLegacy(); hall=legacyHall(); }catch(e){ return ""; }
  let h="<div class='section-title'>Career legacy</div><div class='card'>"+
    "<div class='spread'><div><b>"+L.grade+"</b><div class='tiny muted'>"+L.years+"y · "+L.films+" films · "+fmtM(L.revenue)+" WW</div></div>"+
    "<b class='gold'>"+L.score+" pts</b></div></div>";
  if(hall.length){
    h+="<div class='card'><b class='small'>🏛 Hall of fame</b>";
    hall.slice(0,5).forEach(e=>{
      h+="<div class='cost-line'><span>"+esc(e.grade)+" “"+esc(e.studio)+"” <span class='tiny muted'>"+e.films+" films · "+fmtM(e.revenue)+" WW</span></span><b class='tiny muted'>Y"+(e.years||"?")+"</b></div>";
    });
    h+="</div>";
  }
  return h;
}
/* Reputation board: identity earned from behavior, six tracked scores, perks
   unlocked (additive only), and yearly history. */
function repBoard(){
  let s, id;
  try{ s=repScores(); id=repIdentity(); }catch(e){ return ""; }
  const perks=[
    ["blockbuster","Tentpole openings +3%",s.blockbuster>=55],
    ["prestige","Festival odds +5%",s.prestige>=55],
    ["indie","Indie dev −20%",s.indie>=55],
    ["franchise","Sequel buzz +5pts",s.franchise>=55],
    ["genre","Home-genre scripts +3"+(s.genreName?" ("+s.genreName+")":""),s.genre>=55],
    ["streaming","OTT offers +5%",s.streaming>=55],
  ];
  let h="<div class='section-title'>Studio reputation</div><div class='card' style='border-left:3px solid var(--gold)'>"+
    "<div class='spread'><div><b>"+id.label+"</b><div class='tiny muted'>Earned from what you release — never just a label.</div></div>"+
    "<span class='tag gold'>⭐ "+Math.round(G.studio.rep)+"/100</span></div>";
  [["blockbuster","💥 Blockbuster",s.blockbuster],["prestige","🏛 Prestige",s.prestige],
   ["indie","🎬 Indie",s.indie],["franchise","🏰 Franchise",s.franchise],
   ["genre","🎯 Genre"+(s.genreName?" · "+s.genreName:""),s.genre],
   ["streaming","📱 Streaming",s.streaming]].forEach(r=>{
    h+="<div class='spread' style='margin-top:4px'><span class='small'>"+r[1]+"</span><b class='tiny'>"+r[2]+"</b></div>"+meter(r[2],100);
  });
  h+="<div class='row' style='margin-top:8px'>"+perks.map(p=>"<span class='tag "+(p[2]?"green":"")+"' title='"+p[1]+"'>"+(p[2]?"✓ ":"")+p[1]+"</span>").join("")+"</div>";
  if((G.repHist||[]).length) h+="<div class='tiny muted' style='margin-top:6px'>History: "+G.repHist.map(r=>"Y"+r.year+" "+r.rep+" ("+r.id+")").join(" · ")+"</div>";
  return h+"</div>";
}
/* Progression: display-only studio levels + unlocks + legacy from existing state.
   No new gates — every threshold mirrors an existing unlock or achievement. */
function studioLevel(){
  const films=G.stats.films||0, ww=G.stats.totalWW||0, hits=G.stats.hits||0, fr=(G.franchises||[]).length;
  const hasStream=!!G.streamer, hasIPO=!!(G.public||G.ipo);
  if((hasStream&&hasIPO)||ww>=5000) return {n:5, name:"Entertainment Empire", next:null};
  if(ww>=1000||hasStream||hasIPO) return {n:4, name:"Global Studio", next:"Entertainment Empire — IPO + streamer, or $5B WW"};
  if(films>=6&&(hits>=2||fr>=1)) return {n:3, name:"Major Studio", next:"Global Studio — $1B WW, a streamer, or an IPO"};
  if(films>=3||ww>=300) return {n:2, name:"Growing Studio", next:"Major Studio — 6 films with 2 hits or a franchise"};
  return {n:1, name:"Indie Studio", next:"Growing Studio — 3 films or $300M WW"};
}
function progressionCard(){
  const lv=studioLevel();
  const rep=Math.round(G.studio.rep||0);
  const repNext=rep<40?"Streamer unlocks at rep 40":rep<60?"IPO unlocks at rep 60":"All rep gates cleared";
  const awards=(G.stats.awards||[]).length+(G.festWins||[]).length;
  const un=[
    ["🎬", "First greenlight", (G.stats.films||0)>0||(G.projects||[]).length>0, "Develop a script"],
    ["💥", "First hit", (G.stats.hits||0)>=1, "Beat breakeven worldwide"],
    ["🏰", "Franchise born", (G.franchises||[]).length>=1, "2× breakeven + reviews ≥66"],
    ["📱", "Streamer live", !!G.streamer, "Rep 40 + $250M"],
    ["🔔", "Gone public", !!(G.public||G.ipo), "Rep 60"],
    ["🏆", "Awards shelf", awards>0, "Festivals → FYC → Reels"],
    ["💵", "$1B WW", (G.stats.totalWW||0)>=1000, fmtM(G.stats.totalWW||0)+" banked"]
  ];
  let h="<div class='section-title'>Studio progression</div><div class='card' style='border-left:3px solid var(--gold)'>"+
    "<div class='spread'><div><b>Level "+lv.n+" — "+lv.name+"</b><div class='tiny muted'>"+(lv.next||"Peak reached — build the legacy.")+"</div></div>"+
    "<span class='tag gold'>⭐ "+rep+" rep</span></div>"+
    "<div style='margin-top:6px'>"+meter(lv.n,5)+"</div>"+
    "<div class='tiny muted' style='margin-top:4px'>"+repNext+". Reputation moves with hits, flops, awards and quarters.</div>"+
    "<div class='row' style='margin-top:8px'>"+un.map(u=>"<span class='tag "+(u[2]?"green":"")+"' title='"+u[3]+"'>"+(u[2]?"✓ ":"")+u[0]+" "+u[1]+"</span>").join("")+"</div></div>";
  h+="<div class='card'><b>📜 Legacy</b><div class='tiny muted'>Year "+yearOf(G.week)+" · "+(G.stats.films||0)+" films · "+fmtM(G.stats.totalWW||0)+" WW · "+
    ((G.stats.totalProfit||0)>=0?"+":"")+fmtM(G.stats.totalProfit||0)+" career profit · "+(G.stats.hits||0)+"/"+(G.stats.flops||0)+" hits/flops · "+
    awards+" awards"+(G.stats.bestFilm?" · best: “"+esc(G.stats.bestFilm)+"” "+fmtG(G.stats.bestOpen||0):"")+".</div></div>";
  return h;
}

/* ═══════════ VIEW: develop ═══════════ */
function trendBoard(){
  const gs=Object.keys(DATA.GENRES).map(g=>({g, v:trendOf(g)})).sort((a,b)=>b.v-a.v);
  const weeksLeft=Math.max(0,(G.trendShiftAt||G.week)-G.week);
  let h="<div class='spread'><div class='section-title' style='margin:0'>📈 Genre trends</div>"+
        "<span class='tiny muted'>market re-rates in "+weeksLeft+" wk"+(weeksLeft===1?"":"s")+"</span></div>";
  h+="<div class='card trend-board'>";
  gs.forEach(function(row){
    const g=row.g, v=row.v, G0=DATA.GENRES[g], l=trendLabel(g);
    const pct=clamp((v-0.78)/(1.28-0.78)*100,3,100);
    let spark="";
    const hist=(G.trendHist&&G.trendHist[g])||[];
    if(hist.length>1){
      const mn=Math.min.apply(null,hist), mx=Math.max.apply(null,hist);
      spark="<div class='spark-mini'>"+hist.map(function(x){ return "<i style='height:"+Math.max(12,(mx>mn? (x-mn)/(mx-mn):0.5)*100)+"%'></i>"; }).join("")+"</div>";
    }
    h+="<div class='trend-row'><div class='tr-name'>"+G0.emoji+" "+G0.name+"</div>"+
       "<div class='tr-track'><div class='tr-fill "+(v>=1.07?"hot":v<=0.94?"cold":"")+"' style='width:"+pct+"%'></div>"+spark+"</div>"+
       "<div class='tr-val'><span class='tag "+l.cls+"'>"+l.tag+"</span> <b>"+v.toFixed(2)+"×</b></div></div>";
  });
  h+="<div class='tiny muted' style='margin-top:6px'>Heat multiplies opening weekend and streaming appetite, and it shifts every quarter. Hits warm a genre up; flops cool it down.</div></div>";
  return h;
}
/* Market report: read-only rollup per genre from trends, recent runs, slates, season. */
function genreDelta(g){
  try{
    const h=(G.trendHist&&G.trendHist[g])||[];
    if(h.length>1) return Math.round((h[h.length-1]-h[h.length-2])*100)/100;
  }catch(e){}
  return 0;
}
function genreRecent(g){
  let hits=0, flops=0, n=0;
  try{
    const mine=(G.films||[]).filter(f=>f.genre===g&&(G.week-(f.releaseWeek||0))<52&&f.ww);
    mine.forEach(f=>{ n++; let be=0; try{ be=breakevenWW(f); }catch(e){} if(f.ww>=be) hits++; else if(f.ww<be*0.75) flops++; });
    (G.rivals||[]).forEach(r=>{ (r.slate||[]).filter(f=>f.genre===g&&(f.live||f.dead)&&G.week-f.week<52&&(f.dom||0)>0).forEach(f=>{ n++; if((f.dom||0)/(1-(DATA.GENRES[g]?DATA.GENRES[g].intlShare:0.5))>=80) hits++; }); });
  }catch(e){}
  return {n, hits, flops};
}
function genreComp(g){
  let live=0, soon=0;
  try{
    (G.rivals||[]).forEach(r=>{ (r.slate||[]).forEach(f=>{
      if(f.genre!==g||f.dead) return;
      if(f.live) live++;
      else if(f.week>G.week&&f.week<=G.week+12) soon++;
    }); });
  }catch(e){}
  return {live, soon};
}
function genreOpp(g, heat, d, rec, comp){
  if(heat>=1.07&&comp.soon===0) return "Strong — hot + clear runway";
  if(heat>=1.07) return "Good — hot, mind "+comp.soon+" rival(s)";
  if(d>=0.03) return "Emerging — heating up, move early";
  if(heat<=0.85||(rec.flops>rec.hits&&rec.n>=2)) return "Avoid — cold + weak results";
  if(comp.soon>=2) return "Crowded — "+comp.soon+" rivals dated";
  return "Watch — neutral";
}
function marketReport(){
  let gs;
  try{ gs=Object.keys(DATA.GENRES).map(g=>({g, heat:trendOf(g)})).sort((a,b)=>b.heat-a.heat); }
  catch(e){ return ""; }
  const s=DATA.seasonOf(woyOf(G.week));
  const hot=gs.filter(r=>r.heat>=1.07), weak=gs.filter(r=>r.heat<=0.94), em=gs.filter(r=>{ const d=genreDelta(r.g); return d>=0.03&&r.heat<1.07; });
  let h="<div class='section-title'>Market report — "+s.month+" (corridor ×"+s.season.toFixed(2)+(s.holiday?", holiday legs":"")+")</div>"+
    "<div class='card'><div class='row'>"+
    "<span class='tag green'>🔥 Hot: "+(hot.length?hot.map(r=>DATA.GENRES[r.g].name).join(", "):"none")+"</span>"+
    "<span class='tag red'>🥶 Weak: "+(weak.length?weak.map(r=>DATA.GENRES[r.g].name).join(", "):"none")+"</span>"+
    (em.length?"<span class='tag gold'>🌱 Emerging: "+em.map(r=>DATA.GENRES[r.g].name).join(", ")+"</span>":"")+
    "</div><div class='tiny muted' style='margin-top:4px'>Seasonal: "+(s.season>=1.15?"tentpoles open big — date mass genres now.":s.season<=0.9?"dead zone — platform rollouts + legs genres hold better.":"mid corridor — clean weekends matter more than month.")+"</div></div>"+
    "<div class='grid g2' style='margin-top:8px'>";
  gs.forEach(r=>{
    const g=r.g, G0=DATA.GENRES[g], d=genreDelta(g), rec=genreRecent(g), comp=genreComp(g);
    h+="<div class='card'><div class='spread'><b>"+G0.emoji+" "+G0.name+"</b><span class='tag "+(r.heat>=1.07?"green":r.heat<=0.94?"red":"")+"'>"+r.heat.toFixed(2)+"× "+(d>0?"▲":d<0?"▼":"—")+"</span></div>"+
      "<div class='cost-line'><span>Current heat</span><b>"+r.heat.toFixed(2)+"×</b></div>"+
      "<div class='cost-line'><span>Trend</span><b>"+(d>0?"+":"")+d.toFixed(2)+"/qtr</b></div>"+
      "<div class='cost-line'><span>Recent (52w)</span><b>"+(rec.n?rec.hits+" hits · "+rec.flops+" flops · "+rec.n+" runs":"no runs")+"</b></div>"+
      "<div class='cost-line'><span>Competition</span><b>"+(comp.live?comp.live+" live · ":"")+comp.soon+" rival(s) dated 12w</b></div>"+
      "<div class='cost-line'><span>Opportunity</span><b class='tiny'>"+genreOpp(g, r.heat, d, rec, comp)+"</b></div></div>";
  });
  return h+"</div>";
}
function viewDevelop(){
  let h="";
  try{ if(typeof trendBoard==="function") h+=trendBoard(); }catch(e){}
  try{ if(typeof marketReport==="function") h+=marketReport(); }catch(e){}
  // new faces (main)
  try{
    const cls=(G.talent||[]).filter(t=>t.cls===yearOf(G.week));
    if(cls.length) h+="<div class='card' style='border-left:3px solid var(--green)'><b>🌟 New Faces of Year "+yearOf(G.week)+"</b><div class='tiny muted'>"+cls.slice(0,5).map(x=>esc(x.name)+" ("+x.power+"★)").join(" · ")+"</div></div>";
  }catch(e){}
  h+="<div class='spread'><div class='section-title' style='margin:0'>Script market</div>"+
     "<button class='btn btn-sm' id='btnPitchSeries'>📺 Pitch a Series</button>"+
     "<button class='btn btn-sm' id='btnPitchFilm' style='margin-left:8px'>🎬 Pitch a Film</button></div>";
  h+="<div class='grid g2' style='margin-top:8px'>";
  for(const i of G.ideas){
    const S=DATA.SCALES[i.scale];
    const tl=(typeof trendLabel==="function")? trendLabel(i.genre) : {tag:"",cls:""};
    const trendV=(typeof trendOf==="function")? trendOf(i.genre).toFixed(2) : "1.00";
    h+="<div class='card idea-card'><div class='spread'><h4>"+(DATA.GENRES[i.genre]?DATA.GENRES[i.genre].emoji:"🎬")+" "+esc(i.title)+"</h4>"+
      (i.hot?"<span class='tag red'>🔥 Hot spec</span>":"")+(i.awareness?"<span class='tag purple'>📚 known IP</span>":"")+(i.crossover?"<span class='tag gold'>💥 crossover</span>":"")+"</div>"+
      "<div class='idea-blurb'>“"+esc(i.blurb)+"”</div>"+
      "<div class='idea-meta'>"+gTag(i.genre)+"<span class='tag'>"+S.emoji+" "+S.name+"</span>"+
      "<span class='tag "+(i.script>=75?"green":i.script>=60?"gold":"")+"'>📝 Script "+i.script+"</span>"+
      (tl.tag?"<span class='tag "+tl.cls+"'>"+tl.tag+" "+trendV+"×</span>":"")+
      (i.awareness?"<span class='tag blue'>👁 awareness +"+Math.round(i.awareness*100)+"%</span>":"")+"</div>"+
      "<div class='row' style='margin-top:10px'><span class='small muted'>Est. budget "+fmtM(neededBudget(i.genre,i.scale))+" · dev rights "+fmtM(devCostOf(i))+"</span></div>"+
      (i.pitch?"<div class='row' style='margin-top:6px'><span class='tag gold'>🎤 pitched "+i.pitch.score+" · "+esc(i.pitch.verdict)+"</span></div>":"")+
      "<div class='row' style='margin-top:10px'><button class='btn btn-alt' style='flex:1' data-pitch='"+i.id+"'>🎤 Pitch</button>"+
      "<button class='btn btn-primary' style='flex:2' data-dev='"+i.id+"'>🎬 Develop this</button></div></div>";
  }
  h+="</div>";
  // IP market (main)
  try{
    if(G.ipMarket && G.ipMarket.length){
      h+="<div class='section-title'>📚 IP Market</div><div class='grid g3'>";
      (G.ipMarket||[]).forEach(it=>{
        const k=DATA.IPKINDS? DATA.IPKINDS.find(x=>x.id===it.kind) : {emoji:"📚",name:it.kind};
        h+="<div class='card'><div class='spread'><b>"+k.emoji+" "+esc(it.title)+"</b><span class='tag gold'>"+fmtM(it.price)+"</span></div>"+
          "<div class='tiny muted'>"+k.name+" · "+gTag(it.genre)+" · script +"+it.boost+" · awareness +"+Math.round(it.buzz*100)+"%</div>"+
          "<button class='btn btn-sm btn-primary' style='margin-top:8px' data-ip='"+it.id+"'>Buy rights</button></div>";
      });
      h+="</div>";
    }
  }catch(e){}
  // talent business (main)
  try{
    h+="<div class='section-title'>🎫 Talent Business</div><div class='grid g3'>";
    h+="<div class='card'><b>🎫 Wrap deal — $20M</b><div class='tiny muted' style='margin:4px 0 8px'>Next 3 pictures: all talent fees −20%.</div>"+
      (G.wrapDeal>0? "<span class='tag green'>"+G.wrapDeal+" picture(s) left</span>" : "<button class='btn btn-sm btn-alt' id='btnWrap'>Sign wrap deal</button>")+"</div>";
    h+="<div class='card'><b>🖋 Town-wide agency truce — $30M</b><div class='tiny muted' style='margin:4px 0 8px'>2 years of −15% on every quote, every agency.</div>"+
      (G.agencyExcl>G.week? "<span class='tag green'>"+(G.agencyExcl-G.week)+" weeks left</span>" : "<button class='btn btn-sm btn-alt' id='btnAgency'>Sign truce</button>")+"</div>";
    h+="<div class='card'><b>🌟 Cameos</b><div class='tiny muted'>While greenlighting, add a superstar cameo for 30% of their fee — +6% buzz.</div></div>";
    h+="</div>";
    /* v5: named talent agencies — packaging fees, exclusives, poaching wars */
    if(DATA.AGENCIES){
      h+="<div class='section-title'>🕴 The Agencies</div><div class='tiny muted' style='margin:-4px 0 6px'>Package two clients of the same agency in one film and they bill a packaging fee. An exclusive first-look deal waives their fee and cuts their clients' quotes.</div><div class='grid g3'>";
      DATA.AGENCIES.forEach(function(ag){
        const roster = (typeof agencyRoster==="function"? agencyRoster(ag.id) : []).filter(t=>!t.bookedUntil);
        const power = roster.reduce((a,t)=>a+t.power,0);
        const excl = G.agencyDeals && G.agencyDeals[ag.id]>G.week;
        h+="<div class='card'><div class='spread'><b>"+ag.icon+" "+ag.name+"</b>"+(excl? "<span class='tag green'>exclusive · "+(G.agencyDeals[ag.id]-G.week)+" wks</span>":"")+"</div>"+
          "<div class='tiny muted' style='margin:4px 0'>"+ag.blurb+"</div>"+
          "<div class='tiny muted'>Free agents repped: "+roster.length+" · combined "+power+"★"+(G.agencyExcl>G.week?" · covered by your town-wide truce":"")+"</div>"+
          (excl? "" : "<button class='btn btn-sm btn-alt' style='margin-top:8px' data-agdeal='"+ag.id+"'>Sign exclusive — "+fmtM(ag.dealCost)+" · "+Math.round(ag.dealWeeks/52)+" yrs · clients −"+Math.round(ag.disc*100)+"%</button>")+
          "</div>";
      });
      h+="</div>";
    }
  }catch(e){}
  // writers, producers, directors, cast (v4 + main)
  try{
    const freeA=(typeof freeTalent==="function"? freeTalent("actor") : G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil)).sort((a,b)=>b.power-a.power||b.skill-a.skill);
    const freeD=(typeof freeTalent==="function"? freeTalent("director") : G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil)).sort((a,b)=>b.power-a.power||b.skill-a.skill);
    const freeW=(typeof freeTalent==="function"? freeTalent("writer") : []).sort((a,b)=>b.skill-a.skill||b.power-a.power);
    const freeP=(typeof freeTalent==="function"? freeTalent("producer") : []).sort((a,b)=>b.skill-a.skill||b.power-a.power);
    if(freeW.length){
      h+="<div class='section-title'>✍️ Writers on the market ("+freeW.length+")</div><div class='grid g3'>";
      for(const w of freeW.slice(0,6)) h+=talentCard(w);
      h+="</div>";
    }
    if(freeP.length){
      h+="<div class='section-title'>🎫 Producers on the market ("+freeP.length+")</div><div class='grid g3'>";
      for(const p of freeP.slice(0,6)) h+=talentCard(p);
      h+="</div>";
    }
    h+="<div class='section-title'>🎬 Directors &amp; 🌟 cast</div><div class='grid g3'>";
    for(const d of freeD.slice(0,6)) h+=talentCard(d);
    h+="</div><div class='grid g3' style='margin-top:8px'>";
    for(const a of freeA.slice(0,9)) h+=talentCard(a);
    const hidden=freeA.length+freeD.length-15;
    if(hidden>0)h+="<div class='card muted small' style='display:flex;align-items:center;justify-content:center'>+ "+hidden+" more on the market → refreshed weekly</div>";
    h+="</div>";
  }catch(e){}

  if((G.retired||[]).length){
    h+="<div class='section-title'>👋 Recently retired</div><div class='card'>";
    G.retired.slice(-6).reverse().forEach(function(r){
      h+="<div class='cost-line'><span>"+esc(r.name)+" <span class='tiny muted'>"+(r.kind||"")+"</span></span><b class='muted'>age "+r.age+" · "+dateLabel(r.week)+"</b></div>";
    });
    h+="</div>";
  }
  return h;
}

/* Talent profile: career stage + derived history. Stage from engine age/power/heat;
   history from released films holding this talent's id. No invented stats. */
function talentStage(t){
  const C=(typeof DATA!=="undefined"&&DATA.CAREER)?DATA.CAREER:{primeLow:30,primeHigh:48};
  if(t.retired) return {s:"RETIRED", cls:""};
  if(t.comeback) return {s:"COMEBACK", cls:"green"};
  if((t.heat||0)>=2) return {s:"BREAKOUT", cls:"gold"};
  if((t.age||30)<C.primeLow) return {s:"RISING", cls:"blue"};
  if((t.age||30)>C.primeHigh+7) return {s:"VETERAN", cls:"purple"};
  if((t.age||30)>C.primeHigh) return {s:"DECLINING", cls:"red"};
  return {s:(t.power||0)>=4?"PEAK":"RISING", cls:(t.power||0)>=4?"green":"blue"};
}
function talentFilms(t){
  try{ return (G.films||[]).filter(f=>((f.cast||[]).some(c=>c&&c.id===t.id))||(f.director&&f.director.id===t.id)||(f.writer&&f.writer.id===t.id)||(f.producer&&f.producer.id===t.id)); }
  catch(e){ return []; }
}
function talentRep(t){
  if((t.scandal||0)>0) return "Radioactive — cheap, −opening";
  if(t.toxic&&!t.rehabbed) return "Box-office poison −7%";
  if(t.comeback) return "Rehabilitated";
  if(t.loyalTo) return "Loyal to "+t.loyalTo;
  return "Steady";
}
function talentAvail(t){
  if(t.bookedUntil>G.week) return "Booked: "+esc(t.booked||"")+" ("+(t.bookedUntil-G.week)+"w)";
  return "Free now";
}
function talentCard(t){
  const fee=actorFee(t);
  const icon={writer:"✍️",producer:"🎫",director:"🎬"}[t.kind] || (t.power>=4?"🌟":"🙂");
  const role={writer:"Writer",producer:"Producer",director:"Director",actor:"Actor"}[t.kind]||t.kind;
  const st=talentStage(t);
  let line;
  if(t.kind==="director")      line="Skill "+t.skill+" · fits "+DATA.GENRES[t.genreFit].name;
  else if(t.kind==="writer")   line="Skill "+t.skill+" · specialises in "+DATA.GENRES[t.genreFit].name;
  else if(t.kind==="producer") line="Skill "+t.skill+" · "+(t.skill>=80?"schedule shaver":t.skill<58?"overrun risk":"steady hand");
  else                         line="Skill "+t.skill+" · acting";
  const agTag = (t.agency && DATA.agency)? " <span class='tag blue' title='"+esc(DATA.agency(t.agency).name)+"'>"+esc(DATA.agency(t.agency).name.split(" ")[0])+"</span>" : "";
  const films=talentFilms(t);
  const frNames=[...new Set(films.map(f=>f.franchiseName).filter(Boolean))].slice(0,2);
  const last=films.slice(-1)[0];
  return "<div class='card talent-card'><div class='t-avatar'>"+icon+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(t.name)+agTag+(t.trait?" <span class='tiny muted'>"+esc(t.trait)+"</span>":"")+"</div>"+
    "<div class='row' style='margin:2px 0'><span class='tag'>"+role+"</span><span class='tag "+st.cls+"'>"+st.s+"</span>"+(t.heat?"<span class='tag gold'>🔥 heat ×"+t.heat+"</span>":"")+"</div>"+
    "<div>"+stars(t.power)+"</div>"+
    "<div class='t-stats'>"+line+
    (t.age? " · age "+t.age:"")+
    " · "+(t.pics||0)+" pics"+
    (t.scandal>0?" · <span class='neg'>⚠ scandal</span>":"")+
    "</div>"+
    "<div class='t-stats'>Popularity: "+(t.heat?"heat ×"+t.heat:"cool")+" · Rep: "+esc(talentRep(t))+" · "+esc(talentAvail(t))+"</div>"+
    (t.genreFit&&DATA.GENRES[t.genreFit]?"<div class='t-stats'>Genre affinity: "+DATA.GENRES[t.genreFit].emoji+" "+DATA.GENRES[t.genreFit].name+"</div>":"")+
    (frNames.length?"<div class='t-stats'>Franchises: "+frNames.map(esc).join(" · ")+"</div>":"")+
    (last?"<div class='t-stats'>Last: “"+esc(last.title)+"” · "+fmtG(last.ww||0)+" WW</div>":"<div class='t-stats'>Last: no releases yet</div>")+
    (t.kind==="actor"&&(t.power||0)>=4?"<div class='t-stats'>Backend: asks likely on 8★+ ensembles (5% of rentals)</div>":"")+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(fee)+" ask"+(Math.abs(fee-(t.fee||0))>0.05?" (list "+fmtM(t.fee||0)+")":"")+"</span>"+
    "<button class='btn btn-sm btn-ghost' onclick='talentModal("+t.id+")'>Profile</button></div></div></div>";
}
function talentModal(id){
  const t=(typeof talentById==="function")?talentById(+id):(G.talent||[]).find(x=>x.id===+id);
  if(!t) return;
  const fee=actorFee(t), st=talentStage(t), films=talentFilms(t);
  const role={writer:"Writer",producer:"Producer",director:"Director",actor:"Actor"}[t.kind]||t.kind;
  let h="<h3>"+esc(t.name)+" <span class='tag'>"+role+"</span> <span class='tag "+st.cls+"'>"+st.s+"</span></h3>"+
    "<div class='tiny muted'>"+stars(t.power)+" · skill "+t.skill+" · age "+(t.age||"—")+" · "+(t.pics||0)+" pictures since Y"+(t.joinedYear||1)+"</div>"+
    "<div class='card' style='margin-top:8px'>"+
    "<div class='cost-line'><span>Salary ask</span><b>"+fmtM(fee)+"</b></div>"+
    "<div class='cost-line'><span>Popularity</span><b>"+(t.heat?"heat ×"+t.heat:"cool")+"</b></div>"+
    "<div class='cost-line'><span>Reputation</span><b>"+esc(talentRep(t))+"</b></div>"+
    "<div class='cost-line'><span>Availability</span><b>"+esc(talentAvail(t))+"</b></div>"+
    (t.genreFit&&DATA.GENRES[t.genreFit]?"<div class='cost-line'><span>Genre affinity</span><b>"+DATA.GENRES[t.genreFit].emoji+" "+DATA.GENRES[t.genreFit].name+"</b></div>":"")+
    (t.agency&&DATA.agency&&DATA.agency(t.agency)?"<div class='cost-line'><span>Agency</span><b>"+esc(DATA.agency(t.agency).name)+"</b></div>":"")+
    (t.kind==="actor"?"<div class='cost-line'><span>Backend</span><b>"+((t.power||0)>=4?"Asks likely on 8★+ ensembles":"Unlikely")+"</b></div>":"")+
    "</div>";
  if(films.length){
    h+="<div class='section-title'>Recent performance ("+films.length+")</div><div class='card'>";
    films.slice(-4).reverse().forEach(f=>{
      h+="<div class='cost-line'><span>“"+esc(f.title)+"”"+(f.franchiseName?" · "+esc(f.franchiseName):"")+"</span><b>"+fmtG(f.ww||0)+" WW</b></div>";
    });
    h+="</div>";
  } else h+="<div class='card muted small' style='margin-top:8px'>No releases on record — price is potential, not proof.</div>";
  const fit = t.genreFit? "Genre fit "+(DATA.GENRES[t.genreFit]?DATA.GENRES[t.genreFit].name:"")+". " : "";
  const risk = (t.scandal>0)?"Risk: radioactive — cheap but taxes openings. ":((t.toxic&&!t.rehabbed)?"Risk: toxic until rehabbed. ":"");
  h+="<div class='card' style='margin-top:8px'><b class='small'>Hiring read</b><div class='tiny muted' style='margin-top:4px'>Cost "+fmtM(fee)+". "+fit+risk+
    (t.bookedUntil>G.week?"Busy until W"+t.bookedUntil+" — plan around it.":"Free now.")+"</div></div>";
  /* contracts: current deal + signing table (salary/bonus/backend/length left) */
  h+="<div class='card' style='margin-top:8px'><b class='small'>Contracts</b>";
  if(t.contract){
    const c=t.contract;
    h+="<div class='cost-line'><span>"+c.type+" deal</span><b>"+(c.type==="multi"?c.filmsLeft+" film(s) left":c.type==="exclusive"?Math.max(0,c.until-G.week)+"w left":"open-ended")+"</b></div>"+
      "<div class='tiny muted'>Quote ×"+contractMult(t)+(c.type==="backend"?" · +2% rentals at settlement":c.type==="bonus"?" · +$6M on a hit":"")+".</div>";
  } else {
    h+="<div class='tiny muted' style='margin:4px 0'>Single-picture terms. Offer a deal:</div><div class='row'>";
    contractDefs().forEach(d=>{ h+="<button class='btn btn-sm btn-alt' data-contract='"+d.id+"' title='"+d.desc+"'>"+d.icon+" "+d.name+" · "+fmtM(d.cost)+"</button>"; });
    h+="</div>";
  }
  h+="</div>";
  /* relationships: collaborators, chemistry, standing — all derived, all visible */
  { const co={};
    films.forEach(f=>{ ((f.cast||[]).concat(f.director?[f.director]:[])).forEach(o=>{ if(o&&o.id!==t.id) co[o.id]={n:o.name, c:(co[o.id]?co[o.id].c:0)+1}; }); });
    const pals=Object.values(co).sort((a,b)=>b.c-a.c).slice(0,3);
    const chems=Object.keys(t.chem||{}).map(id=>({id:+id, v:t.chem[id]})).sort((a,b)=>b.v-a.v).slice(0,3);
    const standing=(t.scandal>0)?"⚠ radioactive":(t.toxic&&!t.rehabbed)?"☠ conflict — box-office poison":(t.grudge>0)?"😤 holds a grudge":(t.comeback)?"🎭 comeback glow":(t.loyalTo)?"🤝 loyal":"Steady";
    h+="<div class='card' style='margin-top:8px'><b class='small'>Relationships</b>"+
      "<div class='cost-line'><span>Standing</span><b class='tiny'>"+standing+"</b></div>"+
      (pals.length?"<div class='tiny muted' style='margin-top:4px'>Preferred collaborators: "+pals.map(x=>esc(x.n)+" ×"+x.c).join(" · ")+"</div>":"")+
      (chems.length?"<div class='tiny muted'>Chemistry: "+chems.map(x=>{ const o=(G.talent||[]).find(y=>y.id===x.id); return esc(o?o.name:"#"+x.id)+" "+(x.v>=3?"🔥".repeat(Math.min(3,x.v)):"×"+x.v); }).join(" · ")+"</div>":"")+
      "<div class='tiny muted'>Reunited co-stars (×3+ together) open +2% buzz — logged at greenlight.</div></div>";
  }
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";
  const vm=openModal(h);
  vm.querySelectorAll("[data-contract]").forEach(b=>b.onclick=()=>{ if(signContract(t.id,b.dataset.contract)){ beep("gold"); flashes(G.flash); talentModal(t.id); } else beep("bad"); });
}

/* ── movie pitch battles: evaluate, revise, approve into the wizard ── */
let PZ=null; // pitch modal state {ideaId, angle, budget}
function startPitch(ideaId){
  const idea=G.ideas.find(i=>i.id===+ideaId); if(!idea) return;
  const S=DATA.SCALES[idea.scale];
  PZ={ideaId:idea.id, angle:(idea.pitch&&idea.pitch.angle)||"four",
      budget:(idea.pitch&&idea.pitch.budget)||Math.round(neededBudget(idea.genre,idea.scale)),
      bMin:S.bMin, bMax:Math.round(S.bMax*1.4)};
  pitchModal();
}
function pitchModal(){
  const idea=G.ideas.find(i=>i.id===PZ.ideaId); if(!idea){PZ=null;closeModal();return;}
  const ev=pitchEval(idea, PZ.budget, PZ.angle);
  let h="<h3>🎤 Pitch: “"+esc(idea.title)+"”</h3>"+
    "<div class='tiny muted'>"+esc(idea.blurb)+" · "+DATA.GENRES[idea.genre].name+" · script "+idea.script+"</div>"+
    "<div class='small muted' style='margin:10px 0 6px'><b>Target audience</b> — who is this for?</div><div class='plan-pick'>"+
    pitchAngles().map(a=>"<div class='plan-opt"+(PZ.angle===a.id?" sel":"")+"' data-angle='"+a.id+"'><h5>"+a.icon+" "+a.name+"</h5><div class='p-sub'>"+a.desc+"</div></div>").join("")+
    "</div>"+
    "<div class='card' style='margin-top:10px'><div class='slider-row'><span class='small muted'>Pitch budget</span>"+
    "<input type='range' id='pzBudget' min='"+PZ.bMin+"' max='"+PZ.bMax+"' step='"+(PZ.bMin>=100?5:2)+"' value='"+PZ.budget+"'>"+
    "<span class='slider-val' id='pzBudgetV'>"+fmtM(PZ.budget)+"</span></div></div>"+
    "<div class='card' style='margin-top:8px'><b class='small'>Room read — score "+ev.score+"/100 · "+esc(ev.verdict)+"</b>"+
    "<div class='cost-line'><span>Commercial potential</span><b class='"+(ev.commercial>=65?"pos":ev.commercial<45?"neg":"")+"'>"+ev.commercial+"/100</b></div>"+
    "<div class='cost-line'><span>Critical potential</span><b>"+ev.critical+"/100</b></div>"+
    "<div class='cost-line'><span>Audience potential</span><b>"+ev.audience+"/100</b></div>"+
    "<div class='cost-line'><span>Risk</span><b class='"+(ev.risk>=65?"neg":ev.risk<40?"pos":"")+"'>"+ev.risk+"/100</b></div>"+
    "<div class='cost-line'><span>Est. cost (dev + budget + P&A)</span><b>"+fmtM(ev.cost)+"</b></div>"+
    "<div class='cost-line'><span>Projected return (WW share)</span><b class='"+(ev.profit>=0?"pos":"neg")+"'>"+(ev.profit>=0?"+":"")+fmtM(ev.profit)+"</b></div>"+
    "<div class='cost-line'><span>Franchise potential</span><b>"+ev.franchise+"/100</b></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Opening ≈ "+fmtG(ev.openEst)+" dom · legs ~"+ev.legsEst+"× · breakeven ≈ "+fmtG(ev.be)+" WW. Estimates only — cast, date and competition decide the rest.</div></div>"+
    "<div class='modal-actions'><button class='btn btn-primary' id='pzGo'>✅ Approve → greenlight</button>"+
    "<button class='btn btn-alt' id='pzSave'>📝 Save pitch</button>"+
    "<button class='btn btn-ghost' id='pzNo'>✕ Pass (keep concept)</button></div>";
  const v=openModal(h,{onClose:()=>{PZ=null;}});
  v.querySelectorAll("[data-angle]").forEach(b=>b.onclick=()=>{ PZ.angle=b.dataset.angle; beep("click"); pitchModal(); });
  const rg=v.querySelector("#pzBudget");
  if(rg) rg.oninput=()=>{ PZ.budget=+rg.value; const el=$("#pzBudgetV"); if(el) el.textContent=fmtM(PZ.budget); };
  v.querySelector("#pzSave").onclick=()=>{ pitchSave(PZ.ideaId,PZ.angle,PZ.budget); beep("gold"); flashes(G.flash); PZ=null; closeModal(); render(); };
  v.querySelector("#pzNo").onclick=()=>{ log("🎤 You passed on pitching “"+idea.title+"” — the concept stays in the market.",""); beep("click"); PZ=null; closeModal(); render(); };
  v.querySelector("#pzGo").onclick=()=>{
    pitchSave(PZ.ideaId,PZ.angle,PZ.budget);
    const b=PZ.budget; PZ=null; closeModal();
    startWizard(idea); WZ.budget=b; wizardModal(); // pitched budget carries into casting flow
    beep("gold");
  };
}

/* ── greenlight wizard (film & sequel) ── */
function startWizard(idea){
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], sub:2,
      budget:Math.round(neededBudget(idea.genre,idea.scale)), plan:"theatrical", presales:false,
      rating:"PG-13", location:"la", scriptPolish:false, premium:false,
      aiCast:false, aiScript:false, coProd:"none"};
  wizardModal();
}
function startSequel(film){
  const idea={ id:nid(), genre:film.genre, scale:film.scale, title:"(sequel)", blurb:"The saga continues…",
    script:clamp((film.quality?film.quality.overall:65)+5,55,95), hot:true, sequelOf:film };
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], sub:2, seqBudgetFixed:true,
      budget:Math.round(film.budget*1.3),
      rating:"PG-13", location:"la", scriptPolish:false, premium:false, plan:"theatrical", presales:false,
      aiCast:false, aiScript:false, coProd:"none"};
  wizardModal();
}
/* v4: one card renderer for every crew kind */
function crewCard(t, opts){
  opts=opts||{};
  const icon = {writer:"✍️", director:"🎬", producer:"🎫", actor:(t.power>=4?"🌟":"🙂")}[t.kind]||"🙂";
  const fit = opts.genre && t.genreFit===opts.genre;
  const bonus = (t.kind==="writer" && opts.genre)? writerBonus(t, opts.genre) : null;
  let line;
  if(t.kind==="writer")        line = "Skill "+t.skill+" · "+(bonus>=0?"+":"")+bonus+" script"+(fit? " · <span class='pos'>fits "+DATA.GENRES[opts.genre].name+"</span>":"");
  else if(t.kind==="producer") line = "Skill "+t.skill+" · "+(t.skill>=80?"<span class='pos'>schedule shaver</span>":t.skill<58?"<span class='neg'>overrun risk</span>":"steady hand");
  else if(t.kind==="director") line = "Skill "+t.skill+(fit? " · <span class='pos'>fits "+DATA.GENRES[opts.genre].name+"</span>":"");
  else                         line = "Skill "+t.skill;
  const stg=(typeof talentStage==="function")?talentStage(t):{s:"",cls:""};
  let hint="";
  if(t.kind==="writer"&&opts.genre) hint="Hire: +"+bonus+" script (~30% of quality) for "+fmtM(actorFee(t))+".";
  else if(t.kind==="director") hint="Hire: ~25% of quality"+(fit?" + genre fit":"")+" for "+fmtM(actorFee(t))+".";
  else if(t.kind==="producer") hint="Hire: overruns ~"+overrunRisk(t.skill)+"%/wk for "+fmtM(actorFee(t))+".";
  else hint="Hire: "+t.power+"★ → opening ×"+starOpenMult(t.power)+" for "+fmtM(actorFee(t))+((t.scandal>0)?" · scandal taxes opening.":".");
  return "<div class='card talent-card"+(opts.sel?" sel-card":"")+"' "+(opts.attr||"")+">"+
    "<div class='t-avatar'>"+icon+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(t.name)+(t.trait? " <span class='tiny muted'>"+esc(t.trait)+"</span>":"")+"</div>"+
    "<div class='row' style='margin:2px 0'><span class='tag "+stg.cls+"'>"+stg.s+"</span></div>"+
    stars(t.power)+
    "<div class='t-stats'>"+line+
      (t.age? " · <span class='muted'>age "+t.age+"</span>":"")+
      (t.heat? " · <span class='gold'>heat ×"+t.heat+"</span>":"")+
      (t.scandal>0? " · <span class='neg'>⚠ scandal</span>":"")+
      (t.comeback? " · <span class='pos'>comeback</span>":"")+
    "</div>"+
    "<div class='tiny muted' style='margin-top:2px'>"+hint+"</div>"+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(t))+"</span>"+
      (opts.sel?"<span class='tag green'>✓ attached</span>":"")+"</div></div></div>";
}
/* Film flow: 10-stage pipeline strip + per-decision impact cards. Read-only. */
function filmFlowStrip(active){
  const stages=["Concept","Script","Cast","Production","Post","Test","Marketing","Release","Box office","Streaming"];
  return "<div class='wiz-step'>"+stages.map(s=>"<span class='"+(s===active?"on":([ "Concept"].includes(s)?"done":""))+"'>"+s+"</span>").join("")+"</div>";
}
function starOpenMult(starP){ return Math.round((1+0.075*Math.min(starP||0,6))*100)/100; }
function overrunRisk(skill){ return Math.round(clamp(0.15-((skill||45)-45)/300,0.03,0.20)*100); }
function decisionCard(rows){
  return "<div class='card' style='margin:8px 0'><div class='tiny muted' style='margin-bottom:4px'><b>Decision impact</b></div>"+
    rows.map(r=>"<div class='cost-line'><span>"+r[0]+"</span><b>"+r[1]+"</b></div>").join("")+"</div>";
}
function wizardModal(){
  const S=DATA.SCALES[WZ.idea.scale];
  const step = WZ.sub;
  const gname = DATA.GENRES[WZ.idea.genre].name;
  const flowActive={2:"Script",3:"Cast",4:"Cast",5:"Production",6:"Production"}[step]||"Concept";
  let h="<h3>🎬 Greenlight: “"+esc(WZ.idea.title==="(sequel)"? sequelTitle0(WZ) : WZ.idea.title)+"”</h3>"+
    filmFlowStrip(flowActive)+
    "<div class='wiz-step'>"+
      "<span class='done'>1 · Script</span>"+
      "<span class='"+(step===2?"on":WZ.writer?"done":"")+"'>2 · Writer</span>"+
      "<span class='"+(step===3?"on":WZ.director?"done":"")+"'>3 · Director</span>"+
      "<span class='"+(step===4?"on":WZ.cast.length?"done":"")+"'>4 · Cast</span>"+
      "<span class='"+(step===5?"on":WZ.producer?"done":"")+"'>5 · Producer</span>"+
      "<span class='"+(step===6?"on":"")+"'>6 · Budget</span>"+
    "</div>";
  if(step===2){
    const ws=freeTalent("writer").sort((a,b)=>(writerBonus(b,WZ.idea.genre)-writerBonus(a,WZ.idea.genre))||b.skill-a.skill);
    const base=WZ.idea.script+(WZ.scriptPolish?6:0);
    h+="<p class='small muted'>The writer drives the page — and the page is 30% of a film's quality. Skill plus genre fit is worth up to <b>+11 script</b>. This spec reads <b>"+base+"</b>"+
       (WZ.writer? " → <b class='pos'>"+Math.round(clamp(base+writerBonus(WZ.writer,WZ.idea.genre),20,99))+"</b>":"")+".</p>";
    if(DATA.AI){
      h+="<div class='card craft-block' style='cursor:pointer;margin-bottom:8px' id='wzAIw'><div class='spread'><span class='small'>"+(WZ.aiScript?"✅ ":"⬜ ")+"<b>🤖 SynthScribe</b> writes it overnight</span><span class='tag "+(WZ.aiScript?"gold":"")+"'>free · script "+DATA.AI.scriptScore+"</span></div>"+
        "<div class='tiny muted'>No writer's voice: quality −"+DATA.AI.scrQualityPenalty+", the guilds heat up (strike risk), and the internet may revolt. Cheap, fast, radioactive.</div></div>";
    }
    if(!ws.length && !WZ.aiScript) h+="<div class='card muted small'>Every writer in town is booked. You can shoot the spec as-is.</div>";
    if(!WZ.aiScript){
      h+="<div class='pick-list'>";
      ws.slice(0,10).forEach(function(w){ h+=crewCard(w,{genre:WZ.idea.genre, sel:!!(WZ.writer&&WZ.writer.id===w.id), attr:"data-writer='"+w.id+"'"}); });
      h+="</div>";
    }
    if(WZ.writer) h+=decisionCard([["Cost","+"+fmtM(actorFee(WZ.writer))+" fee"],["Script",base+" → "+Math.round(clamp(base+writerBonus(WZ.writer,WZ.idea.genre),20,99))],["Quality impact","Page ≈30% of quality"],["Box office","Via quality → legs + opening buzz"]]);
    else if(WZ.aiScript) h+=decisionCard([["Cost","$0"],["Script","SynthScribe "+DATA.AI.scriptScore],["Quality impact","−"+DATA.AI.scrQualityPenalty+" craft, flat page"],["Risk","Guild heat + backlash rolls"]]);
    else h+=decisionCard([["Cost","$0 as-is"],["Script",String(base)],["Quality impact","No writer bonus (up to +11 missed)"],["Risk","Weak page → weak legs"]]);
    h+="<div class='modal-actions'><button class='btn btn-ghost' id='wzSkipWriter'>Shoot the spec as-is →</button>"+
       ((WZ.writer||WZ.aiScript)? "<button class='btn btn-primary' id='wzNext'>To Director →</button>":"")+"</div>";
  }else if(step===3){
    const dirs=freeTalent("director").sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>A director shapes ~25% of quality. Genre fit adds a bonus. Bigger names also lift buzz.</p>";
    if(WZ.director) h+=decisionCard([["Cost","+"+fmtM(actorFee(WZ.director))+" fee"],["Quality impact","Skill "+WZ.director.skill+(WZ.director.genreFit===WZ.idea.genre?" · genre fit ×1.1":"")],["Critics","Fit directors review better"],["Box office","Via quality + buzz"]]);
    h+="<div class='pick-list'>";
    dirs.slice(0,10).forEach(function(d){ h+=crewCard(d,{genre:WZ.idea.genre, sel:!!(WZ.director&&WZ.director.id===d.id), attr:"data-dir='"+d.id+"'"}); });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzBackWriter'>← Writer</button>"+
       (WZ.director? "<button class='btn btn-primary' id='wzNext'>To Cast →</button>":"")+"</div>";
  }else if(step===4){
    const acts=freeTalent("actor").sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>Pick 1–3 leads. Star power (★) drives opening weekend; skill drives reviews. Scandal-hit stars come cheap — and cost you at the box office.</p>";
    { const sp=(WZ.cast||[]).reduce((s,c)=>s+c.power,0);
      if(WZ.aiCast) h+=decisionCard([["Cost","$0 fees"],["Audience impact","−"+DATA.AI.audPenalty+" score"],["Box office","No star power · hype ×0.97"],["Risk","Guild heat + backlash"]]);
      else if(sp>0) h+=decisionCard([["Star power",sp+"★ → opening ×"+starOpenMult(sp)],["Cost","+"+fmtM(WZ.cast.reduce((s,c)=>s+actorFee(c),0))+" fees"],["Critics / audience","Skill avg "+Math.round(WZ.cast.reduce((s,c)=>s+c.skill,0)/WZ.cast.length)],["Risk",WZ.cast.some(c=>c.scandal>0)?"Scandal cast −opening":"Clean"]]); }
    if(DATA.AI){
      h+="<div class='card craft-block' style='cursor:pointer;margin-bottom:8px' id='wzAIc'><div class='spread'><span class='small'>"+(WZ.aiCast?"✅ ":"⬜ ")+"<b>🤖 Synthetic cast</b> — fully licensed digital doubles</span><span class='tag "+(WZ.aiCast?"gold":"")+"'>cast fees $0</span></div>"+
        "<div class='tiny muted'>Zero fees upfront, but: audience score −"+DATA.AI.audPenalty+", no star opening power, no press tour, the guilds take note. The money you save buys P&A.</div></div>";
    }
    if(!WZ.aiCast){
      h+="<div class='pick-list'>";
      acts.slice(0,12).forEach(function(a){ h+=crewCard(a,{sel:WZ.cast.some(c=>c.id===a.id), attr:"data-cast='"+a.id+"'"}); });
      h+="</div>";
    }
    h+="<div class='modal-actions'><button class='btn btn-ghost' id='wzBackDir'>← Director</button><button class='btn btn-primary' id='wzNext'>Continue with "+(WZ.aiCast?"AI cast":WZ.cast.length)+" →</button></div>";
  }else if(step===5){
    const prods=freeTalent("producer").sort((a,b)=>b.skill-a.skill||b.power-a.power);
    h+="<p class='small muted'>A producer runs the floor: they cut the odds and the size of <b>cost overruns</b>, squeeze extra production value out of the same budget, and a great one shaves a week off the shoot. Skip it and every overrun lands on you.</p>";
    if(WZ.producer) h+=decisionCard([["Cost","+"+fmtM(actorFee(WZ.producer))+" fee"],["Overrun risk","~"+overrunRisk(WZ.producer.skill)+"%/wk, smaller hits"],["Quality impact",(WZ.producer.skill>=80?"+schedule shave, +value":"+"+clamp(Math.round((WZ.producer.skill-55)/6),-3,7)+" production value")],["Risk","None — protection"]]);
    else h+=decisionCard([["Cost","$0"],["Overrun risk","~"+overrunRisk(45)+"%/wk, full-size hits"],["Quality impact","No producer value"],["Risk","Every overrun lands on you"]]);
    if(!prods.length) h+="<div class='card muted small'>No producers free this week — you'll be running the floor yourself.</div>";
    h+="<div class='pick-list'>";
    prods.slice(0,10).forEach(function(p){ h+=crewCard(p,{sel:!!(WZ.producer&&WZ.producer.id===p.id), attr:"data-prod='"+p.id+"'"}); });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzBackCast'>← Cast</button><button class='btn btn-primary' id='wzNext'>To Budget →</button></div>";
  }else{
    const crew=[WZ.writer,WZ.director,WZ.producer].filter(Boolean);
    const fees=crew.reduce((s,c)=>s+actorFee(c),0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0);
    const dev=devCostOf(WZ.idea);
    const S2=DATA.SCALES[WZ.idea.scale];
    const weeks=S2.pre[1]+S2.shoot[1]+S2.post[1];
    const starP=WZ.cast.reduce((s,c)=>s+c.power,0);
    const polishCost = WZ.scriptPolish? Math.round(dev*0.4):0;
    const tl=trendLabel(WZ.idea.genre);
    h+="<div class='card' style='margin:2px 0 8px'><div class='spread'><span class='small'>"+DATA.GENRES[WZ.idea.genre].emoji+" <b>"+gname+"</b> market heat</span>"+
       "<span class='tag "+tl.cls+"'>"+tl.tag+" · "+trendOf(WZ.idea.genre).toFixed(2)+"×</span></div>"+
       "<div class='tiny muted'>Genre heat multiplies opening weekend and streaming appetite. It re-rates every quarter.</div></div>";
    const crewLine = crew.length? crew.map(c=>({writer:"✍️",director:"🎬",producer:"🎫"}[c.kind]+" "+esc(c.name))).join(" · ") : "<span class='muted'>no crew attached</span>";
    h+="<div class='tiny' style='margin-bottom:8px'>"+crewLine+((WZ.aiCast||WZ.aiScript)?" · <span class='tag purple'>🤖 synthetic</span>":"")+"</div>";
    /* v5: agency packaging-fee notice */
    if(typeof packagingCost==="function"){
      const pc=packagingCost(WZ.cast, WZ.budget);
      if(pc>0){
        const pa=packagingFeeOf(WZ.cast);
        h+="<div class='tiny gold' style='margin-bottom:8px'>🧾 Packaging fee: stacking "+pa.count+" "+pa.name+" clients triggers a "+fmtM(pc)+" packaging bill. An exclusive deal with them waives it.</div>";
      }
    }
    h+="<div class='small muted' style='margin:4px 0 6px'><b>Production craft</b> — creative &amp; logistics</div>";
    h+="<div class='craft-block'>";
    h+="<div class='tiny muted' style='margin:2px 0 4px'>🎬 MPAA rating</div><div class='row' id='wzRating'>";
    DATA.RATINGS.forEach(function(rt){ h+="<button class='btn btn-sm "+(WZ.rating===rt.id?"btn-primary":"")+"' data-rate='"+rt.id+"'>"+rt.name+"</button>"; });
    h+="</div><div class='tiny muted' style='margin-top:2px'>"+DATA.rating(WZ.rating).desc+"</div>";
    h+="<div class='tiny muted' style='margin:8px 0 4px'>🌍 Shoot location (filming rebate)</div><div class='row' id='wzLoc'>";
    DATA.LOCATIONS.forEach(function(lo){ h+="<button class='btn btn-sm "+(WZ.location===lo.id?"btn-primary":"")+"' data-loc='"+lo.id+"'>"+lo.name+" ("+Math.round(lo.rebate*100)+"%)</button>"; });
    h+="</div><div class='tiny muted' style='margin-top:2px'>"+DATA.location(WZ.location).blurb+"</div>";
    h+="<div class='card' style='margin-top:8px;cursor:pointer' id='wzPolish'><div class='spread'><span class='small'>"+(WZ.scriptPolish?"✅ ":"⬜ ")+"<b>Script polish</b> — +6 script, +1 wk pre-prod</span><span class='tag "+(WZ.scriptPolish?"gold":"")+"'>"+fmtM(polishCost)+"</span></div>"+
      "<div class='tiny muted'>A fresh-eyes rewrite pass lifts the writing (quality) but adds pre-production time. Worth it on weak scripts.</div></div>";
    h+="</div>";
    if(DATA.COPROD_PARTNERS && WZ.mode==="film"){
      h+="<div class='small muted' style='margin:10px 0 6px'><b>Co-production</b> — split budget &amp; risk with a partner <span class='tiny'>(treaty: shoot in a treaty jurisdiction with a foreign partner → rebates +30%, +rep)</span></div><div class='plan-pick'>";
      DATA.COPROD_PARTNERS.forEach(function(cp){
        h+="<div class='plan-opt"+((WZ.coProd||"none")===cp.id?" sel":"")+"' data-coprod='"+cp.id+"'><h5>"+cp.icon+" "+cp.name+(cp.pct? " · covers "+Math.round(cp.pct*100)+"% / keeps "+Math.round(cp.share*100)+"% of net":"")+"</h5><div class='p-sub'>"+cp.blurb+"</div></div>";
      });
      h+="</div>";
    }
    h+="<div class='small muted' style='margin:10px 0 6px'><b>Distribution plan</b> — commit now or keep options open</div><div class='plan-pick'>"+
      "<div class='plan-opt"+(WZ.plan==="theatrical"?" sel":"")+"' data-plan='theatrical'><h5>🎥 Theatrical release</h5><div class='p-sub'>Full box office upside (and risk). You set the date &amp; P&amp;A when it's finished.</div></div>"+
      "<div class='plan-opt"+(WZ.plan==="streaming"?" sel":"")+"' data-plan='streaming'><h5>📺 Streaming original</h5><div class='p-sub'>Platforms bid on delivery — guaranteed cash ≈ budget × quality, zero box office.</div></div>"+
      "<div class='plan-opt"+(WZ.plan==="later"?" sel":"")+"' data-plan='later'><h5>🤔 Decide later</h5><div class='p-sub'>Keep every door open: date it, shop it, or take incoming pre-buy offers.</div></div>"+
      "</div>";
    if(WZ.plan!=="streaming"){
      const pv=Math.round(WZ.budget*0.22);
      h+="<div class='card' style='margin-top:8px;cursor:pointer' id='wzPresale'><div class='spread'><span class='small'>"+(WZ.presales?"✅ ":"⬜ ")+"<b>International pre-sales</b> — take "+fmtM(pv)+" cash today</span><span class='tag "+(WZ.presales?"gold":"")+"'>"+(WZ.presales?"sold":"available")+"</span></div>"+
        "<div class='tiny muted'>Buyers take the international box office (~"+Math.round(DATA.GENRES[WZ.idea.genre].intlShare*100)+"% of gross). Great for cash flow; costs you upside on hits.</div></div>";
    }
    if(!WZ.producer) h+="<div class='tiny neg' style='margin-top:8px'>⚠ No producer attached — expect cost overruns during the shoot.</div>";
    if(starP>=8) h+="<div class='tiny' style='margin-top:8px'>🌟 A-list ensemble: the stars demand <b>5% of rentals</b> as backend points.</div>";
    h+="<div class='card' style='margin-top:10px'><div class='slider-row'><span class='small muted'>Production budget</span>"+
      "<input type='range' id='wzBudget' min='"+S2.bMin+"' max='"+(S2.bMax*1.4)+"' step='"+(S2.bMin>=100?5:2)+"' value='"+WZ.budget+"'><span class='slider-val' id='wzBudgetV'>"+fmtM(WZ.budget)+"</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Typical "+S2.name+" range: "+fmtM(S2.bMin)+"–"+fmtM(S2.bMax)+" · genre needs ≈ "+fmtM(neededBudget(WZ.idea.genre,WZ.idea.scale))+" (underfunding hurts quality)</div></div>";
    h+="<div class='card'><div class='cost-line'><span>Rights + development"+(WZ.scriptPolish?" (+script polish)":"")+"</span><b>"+fmtM(dev+polishCost)+"</b></div>"+
      "<div class='cost-line'><span>Crew &amp; cast fees (upfront)</span><b>"+fmtM(fees)+"</b></div>"+
      "<div class='cost-line'><span>Production (paid weekly over ~"+weeks+" wks)</span><b>"+fmtM(WZ.budget)+"</b></div>"+
      (WZ.presales&&WZ.plan!=="streaming"? "<div class='cost-line'><span>Intl pre-sales (cash now)</span><b class='pos'>+"+fmtM(Math.round(WZ.budget*0.22))+"</b></div>":"")+
      "<div class='cost-line'><span>Suggested marketing (at release)</span><b id='wzMkt'>"+fmtM(recMarketing({budget:WZ.budget, scale:WZ.idea.scale, genre:WZ.idea.genre}))+"</b></div>"+
      "<div class='cost-total'><span>Total commitment</span><span class='gold' id='wzTot'>"+fmtM(dev+polishCost+fees+WZ.budget)+"</span></div></div>";
    h+="<div class='tiny muted'>💡 Rule of thumb: a film needs ≈ <b id='wzBe'>"+fmtM(breakevenWW({budget:WZ.budget, marketing:recMarketing({budget:WZ.budget,scale:WZ.idea.scale,genre:WZ.idea.genre})}))+"</b> worldwide gross to break even (theaters keep ~half).</div>";
    { const mkt0=recMarketing({budget:WZ.budget, scale:WZ.idea.scale, genre:WZ.idea.genre});
      const be0=breakevenWW({budget:WZ.budget, marketing:mkt0});
      let legsEst="—"; try{ legsEst=legsOf({genre:WZ.idea.genre, quality:{overall:70,critic:65,aud:65}, releaseWeek:G.week, pattern:"wide", rollout:"day"})+"×"; }catch(e){}
      h+=decisionCard([["Cost",fmtM(dev+polishCost+fees+WZ.budget)+" total"],["Expected benefit","P&A ≈ "+fmtM(mkt0)+" → opening mass"],["Risk",(WZ.producer?"Overruns ~"+overrunRisk(WZ.producer.skill)+"%/wk":"No producer — overruns full")+(WZ.presales?"; presales cap intl upside":"")],["Quality",(WZ.writer?"Writer +"+writerBonus(WZ.writer,WZ.idea.genre):"No writer bonus")+" · trend "+trendOf(WZ.idea.genre).toFixed(2)+"×"],["Audience",DATA.GENRES[WZ.idea.genre].aud>=0?"+":""+DATA.GENRES[WZ.idea.genre].aud+" genre lean"],["Critics",(DATA.GENRES[WZ.idea.genre].critic>=0?"+":"")+DATA.GENRES[WZ.idea.genre].critic+" genre lean"+(WZ.rating==="R"?", R +edge":"")],["Box office","BE ≈ "+fmtM(be0)+" WW · legs ~"+legsEst]]); }
    h+="<div class='modal-actions'><button class='btn btn-ghost' id='wzBack'>← Producer</button><button class='btn btn-primary' id='wzGo'>🎥 Greenlight</button></div>";
  }
  const v=openModal(h, {onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-writer]").forEach(el=>el.onclick=()=>{
    const w=talentById(+el.dataset.writer);
    WZ.writer = (WZ.writer && WZ.writer.id===w.id)? null : w;
    beep("click"); wizardModal();
  });
  v.querySelectorAll("[data-dir]").forEach(el=>el.onclick=()=>{
    const d=talentById(+el.dataset.dir);
    WZ.director = (WZ.director && WZ.director.id===d.id)? null : d;
    beep("click"); wizardModal();
  });
  v.querySelectorAll("[data-prod]").forEach(el=>el.onclick=()=>{
    const p=talentById(+el.dataset.prod);
    WZ.producer = (WZ.producer && WZ.producer.id===p.id)? null : p;
    beep("click"); wizardModal();
  });
  v.querySelectorAll("[data-cast]").forEach(el=>el.onclick=()=>{
    const t=talentById(+el.dataset.cast);
    const i=WZ.cast.findIndex(c=>c.id===t.id);
    if(i>=0) WZ.cast.splice(i,1);
    else if(WZ.cast.length<3) WZ.cast.push(t);
    beep("click"); wizardModal();
  });
  const nx=v.querySelector("#wzNext"); if(nx) nx.onclick=()=>{ WZ.sub=Math.min(6,WZ.sub+1); wizardModal(); };
  const skw=v.querySelector("#wzSkipWriter"); if(skw) skw.onclick=()=>{ WZ.writer=null; WZ.sub=3; wizardModal(); };
  const bw=v.querySelector("#wzBackWriter"); if(bw) bw.onclick=()=>{ WZ.sub=2; wizardModal(); };
  const bd=v.querySelector("#wzBackDir"); if(bd) bd.onclick=()=>{ WZ.sub=3; wizardModal(); };
  const bc=v.querySelector("#wzBackCast"); if(bc) bc.onclick=()=>{ WZ.sub=4; wizardModal(); };
  const bk=v.querySelector("#wzBack"); if(bk) bk.onclick=()=>{ WZ.sub=5; wizardModal(); };
  v.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{ WZ.plan=b.dataset.plan; if(WZ.plan==="streaming") WZ.presales=false; beep("click"); wizardModal(); });
  const ps=v.querySelector("#wzPresale"); if(ps) ps.onclick=()=>{ WZ.presales=!WZ.presales; beep("click"); wizardModal(); };
  v.querySelectorAll("[data-rate]").forEach(b=>b.onclick=()=>{ WZ.rating=b.dataset.rate; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-loc]").forEach(b=>b.onclick=()=>{ WZ.location=b.dataset.loc; beep("click"); wizardModal(); });
  const pls=v.querySelector("#wzPolish"); if(pls) pls.onclick=()=>{ WZ.scriptPolish=!WZ.scriptPolish; beep("click"); wizardModal(); };
  const aiw=v.querySelector("#wzAIw"); if(aiw) aiw.onclick=()=>{ WZ.aiScript=!WZ.aiScript; if(WZ.aiScript) WZ.writer=null; beep("click"); wizardModal(); };
  const aic=v.querySelector("#wzAIc"); if(aic) aic.onclick=()=>{ WZ.aiCast=!WZ.aiCast; if(WZ.aiCast) WZ.cast=[]; beep("click"); wizardModal(); };
  v.querySelectorAll("[data-coprod]").forEach(b=>b.onclick=()=>{ WZ.coProd=b.dataset.coprod; beep("click"); wizardModal(); });
  const rg=v.querySelector("#wzBudget");
  if(rg){ rg.oninput=()=>{
    WZ.budget=+rg.value; $("#wzBudgetV").textContent=fmtM(WZ.budget);
    const mkt=recMarketing({budget:WZ.budget, scale:WZ.idea.scale, genre:WZ.idea.genre});
    const mEl=$("#wzMkt"), tEl=$("#wzTot"), bEl=$("#wzBe");
    const feeSum=[WZ.writer,WZ.director,WZ.producer].filter(Boolean).reduce((s,c)=>s+actorFee(c),0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0);
    if(mEl) mEl.textContent=fmtM(mkt);
    if(tEl) tEl.textContent=fmtM(devCostOf(WZ.idea)+(WZ.scriptPolish? Math.round(devCostOf(WZ.idea)*0.4):0)+feeSum+WZ.budget);
    if(bEl) bEl.textContent=fmtM(breakevenWW({budget:WZ.budget, marketing:mkt}));
  }; }
  const go=v.querySelector("#wzGo");
  if(go) go.onclick=()=>{
    const fees=[WZ.writer,WZ.director,WZ.producer].filter(Boolean).reduce((s,c)=>s+actorFee(c),0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0);
    const dev=devCostOf(WZ.idea)+(WZ.scriptPolish? Math.round(devCostOf(WZ.idea)*0.4):0);
    if(G.studio.cash < dev+fees+WZ.budget*0.2){ toast("Not enough cash for upfront costs — visit Finance for a loan.","bad"); beep("bad"); return; }
    greenlight({ idea:WZ.idea, writer:WZ.aiScript? null : WZ.writer, director:WZ.director, producer:WZ.producer, cast:WZ.aiCast? [] : WZ.cast,
      budget:WZ.budget, sequelOf:WZ.idea.sequelOf, plan:WZ.plan, presales:WZ.presales,
      rating:WZ.rating, location:WZ.location, scriptPolish:WZ.scriptPolish, premium:WZ.premium,
      aiCast:WZ.aiCast, aiScript:WZ.aiScript, coProd:(WZ.coProd==="none"? null : WZ.coProd),
      crossover: WZ.idea.crossover, spinoffFr: WZ.idea.spinoffFr });
    beep("gold"); WZ=null; closeModal(); render();
  };
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
    h+="<div class='small muted' style='margin:10px 0 8px'>Pick a showrunner — a director or a writer (writers read as prestige TV)</div><div class='pick-list'>";
    freeTalent("director").concat(freeTalent("writer")).sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill)).slice(0,8).forEach(function(d){
      h+=crewCard(d,{genre:WZ.genre, sel:!!(WZ.showrunner&&WZ.showrunner.id===d.id), attr:"data-sr='"+d.id+"'"});
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

/* ═══════════ film pitch wizard — like series pitch ═══════════ */
function startFilmPitchWizard(){
  WZ={mode:"filmPitch", genre:pick(["action","scifi","fantasy","animation","comedy","horror","thriller","drama","romance","musical","western","war","sports","concert","truecrime"]),
      scale:"mid", budget:0, rating:"PG-13", location:"home", pattern:"wide", rollout:"day", window:45,
      imax:false, premium:false, soundtrack:false, dayAndDate:false, scriptPolish:false,
      director:null, writer:null, producer:null, cast:[]};
  filmPitchModal();
}
function filmPitchModal(){
  const step = !WZ.director? 1 : (!WZ.writer? 2 : 3);
  let h="<h3>🎬 Pitch a Film</h3>";
  if(step===1){
    h+="<div class='small muted' style='margin-bottom:8px'>Genre & scale</div><div class='row' id='fpGenres'>";
    Object.keys(DATA.GENRES).forEach(g=>{
      h+="<button class='btn btn-sm "+(WZ.genre===g?"btn-primary":"")+"' data-g='"+g+"'>"+DATA.GENRES[g].emoji+" "+DATA.GENRES[g].name+"</button>";
    });
    h+="</div><div class='card' style='margin-top:10px'><div class='small muted'>Production scale</div><div class='row' id='fpScales'>";
    Object.keys(DATA.SCALES).forEach(s=>{
      h+="<button class='btn btn-sm "+(WZ.scale===s?"btn-primary":"")+"' data-s='"+s+"'>"+DATA.SCALES[s].emoji+" "+DATA.SCALES[s].name+"</button>";
    });
    h+="</div></div>";
    h+="<div class='card'><div class='slider-row'><span class='small muted'>Budget</span><input type='range' id='fpBudget' min='"+DATA.SCALES[WZ.scale].bMin+"' max='"+Math.round(DATA.SCALES[WZ.scale].bMax*1.4)+"' step='"+(DATA.SCALES[WZ.scale].bMin>=100?5:2)+"' value='"+Math.round(neededBudget(WZ.genre,WZ.scale))+"'><span class='slider-val' id='fpBudgetV'>"+fmtM(Math.round(neededBudget(WZ.genre,WZ.scale)))+"</span></div></div>";
  }else if(step===2){
    h+="<div class='small muted' style='margin-bottom:8px'>Distribution choices</div>";
    h+="<div class='card'><div class='small muted'>Rating</div><div class='row'>";
    DATA.RATINGS.forEach(r=>{
      h+="<button class='btn btn-sm "+(WZ.rating===r.id?"btn-primary":"")+"' data-r='"+r.id+"'>"+r.emoji+" "+r.id+"</button>";
    });
    h+="</div></div>";
    h+="<div class='card'><div class='small muted'>Shoot location</div><div class='row' id='fpLocs'>";
    DATA.LOCATIONS.forEach(l=>{
      h+="<button class='btn btn-sm "+(WZ.location===l.id?"btn-primary":"")+"' data-l='"+l.id+"'>"+l.name+" ("+l.rebate+"% rebate"+(l.cap?" · cap "+fmtM(l.cap):"")+")</button>";
    });
    h+="</div></div>";
    h+="<div class='card'><div class='small muted'>Release pattern</div><div class='row' id='fpPatterns'>";
    DATA.PATTERNS.forEach(p=>{
      h+="<button class='btn btn-sm "+(WZ.pattern===p.id?"btn-primary":"")+"' data-pat='"+p.id+"'>"+p.label+"</button>";
    });
    h+="</div></div>";
    h+="<div class='card'><div class='small muted'>Intl rollout</div><div class='row' id='fpRollouts'>";
    DATA.ROLLOUTS.forEach(r=>{
      h+="<button class='btn btn-sm "+(WZ.rollout===r.id?"btn-primary":"")+"' data-roll='"+r.id+"'>"+r.label+"</button>";
    });
    h+="</div></div>";
    h+="<div class='card'><div class='small muted'>Window</div><div class='row' id='fpWindows'>";
    DATA.WINDOWS.forEach(w=>{
      h+="<button class='btn btn-sm "+(WZ.window===w.d?"btn-primary":"")+"' data-win='"+w.d+"'>"+w.label+"</button>";
    });
    h+="</div></div>";
    h+="<div class='card'><div class='small muted'>Extras</div><div class='row' style='gap:8px'>";
    h+="<label class='btn btn-sm "+(WZ.imax?"btn-primary":"")+"' data-imax><input type='checkbox' style='display:none'>"+(WZ.imax?"✓":"")+" IMAX/Premium</label>";
    h+="<label class='btn btn-sm "+(WZ.premium?"btn-primary":"")+"' data-premium><input type='checkbox' style='display:none'>"+(WZ.premium?"✓":"")+" Premium format</label>";
    h+="<label class='btn btn-sm "+(WZ.soundtrack?"btn-primary":"")+"' data-soundtrack><input type='checkbox' style='display:none'>"+(WZ.soundtrack?"✓":"")+" Soundtrack</label>";
    h+="<label class='btn btn-sm "+(WZ.dayAndDate?"btn-primary":"")+"' data-dad><input type='checkbox' style='display:none'>"+(WZ.dayAndDate?"✓":"")+" Day-and-date</label>";
    h+="<label class='btn btn-sm "+(WZ.scriptPolish?"btn-primary":"")+"' data-polish><input type='checkbox' style='display:none'>"+(WZ.scriptPolish?"✓":"")+" Script polish</label>";
    h+="</div></div>";
  }else{
    const ev = (function(){
      const S = DATA.SCALES[WZ.scale] || DATA.SCALES.mid;
      const g = DATA.GENRES[WZ.genre] || DATA.GENRES.action;
      const dir = WZ.director;
      const writer = WZ.writer;
      const producer = WZ.producer;
      const cast = WZ.cast || [];
      const budget = WZ.budget || Math.round(neededBudget(WZ.genre, WZ.scale));
      const mkt = recMarketing({budget, scale:WZ.scale, genre:WZ.genre});
      const totalCost = devCostOf({scale:WZ.scale, genre:WZ.genre, hot:false, script:65}) + budget + mkt;
      const trend = (typeof trendPull==="function")?trendPull(WZ.genre):1;
      const openEst = S.openBase * g.mass * trend * (WZ.rating==="R"?0.88:1.0) * (WZ.imax?1.08:1.0) * (WZ.premium?1.12:1.0) * (G.infl||1);
      const legsEst = clamp(2.2 + g.legsAdj + 0.02*(dir?dir.skill:55), 1.45, 4.4);
      const wwEst = openEst * legsEst / (1 - g.intlShare);
      const revenue = Math.round(wwEst * 0.48);
      const profit = Math.round(revenue - totalCost);
      const be = (budget + mkt) / 0.48;
      const commercial = clamp(Math.round(wwEst/be*50), 5, 99);
      const critical = clamp(Math.round((dir?dir.skill:55)*0.4 + (writer?writer.skill:55)*0.3 + 30 + g.critic), 5, 99);
      const audience = clamp(Math.round((dir?dir.skill:55)*0.3 + cast.reduce((s,c)=>s+c.power,0)*0.2 + 35 + g.aud), 5, 99);
      let risk = Math.round(clamp((budget/S.bMax)*40 + (WZ.rating==="R"?10:0) + (trend<0.94?15:0) + (WZ.scale==="tentpole"?10:0), 5, 99));
      const franchise = clamp(Math.round(g.merch*45 + (WZ.scale==="tentpole"?25:WZ.scale==="mid"?10:0)), 5, 99);
      const score = Math.round(commercial*0.35 + critical*0.2 + audience*0.25 + (100-risk)*0.2);
      const verdict = score>=70?"Greenlight material":score>=50?"Viable with caveats":"Pass";
      return {commercial, critical, audience, risk, cost:Math.round(totalCost), revenue, profit,
        franchise, score, verdict, openEst:Math.round(openEst*10)/10, legsEst:Math.round(legsEst*100)/100, be:Math.round(be)};
    })();
    h+="<div class='card platform-card'><div class='platform-logo' style='background:#f5b942'>🎬</div><div><b>Greenlight Review</b><div class='tiny muted'>Internal evaluation — no platform gatekeeper for theatrical</div></div></div>";
    h+="<div class='card'><div class='cost-line'><span>Opening (est.)</span><b>"+fmtG(ev.openEst)+" dom</b></div>"+
      "<div class='cost-line'><span>Legs (est.)</span><b>"+ev.legsEst+"×</b></div>"+
      "<div class='cost-line'><span>Worldwide (est.)</span><b>"+fmtG(ev.openEst*ev.legsEst/(1-(DATA.GENRES[WZ.genre]||{intlShare:0.5}).intlShare))+"</b></div>"+
      "<div class='cost-line'><span>Total cost (dev+budget+P&A)</span><b>"+fmtM(ev.cost)+"</b></div>"+
      "<div class='cost-line'><span>Projected return (studio share)</span><b class='"+(ev.profit>=0?"pos":"neg")+"'>"+(ev.profit>=0?"+":"")+fmtM(ev.profit)+"</b></div>"+
      "<div class='cost-line'><span>Breakeven WW</span><b>"+fmtG(ev.be)+"</b></div></div>";
    h+="<div class='card'><b class='small'>Room read — score "+ev.score+"/100 · "+esc(ev.verdict)+"</b>"+
      "<div class='cost-line'><span>Commercial potential</span><b class='"+(ev.commercial>=65?"pos":ev.commercial<45?"neg":"")+"'>"+ev.commercial+"/100</b></div>"+
      "<div class='cost-line'><span>Critical potential</span><b>"+ev.critical+"/100</b></div>"+
      "<div class='cost-line'><span>Audience potential</span><b>"+ev.audience+"/100</b></div>"+
      "<div class='cost-line'><span>Risk</span><b class='"+(ev.risk>=65?"neg":ev.risk<40?"pos":"")+"'>"+ev.risk+"/100</b></div>"+
      "<div class='cost-line'><span>Franchise potential</span><b>"+ev.franchise+"/100</b></div></div>";
    h+="<div class='small muted' style='margin:10px 0'>Pick your team — director is mandatory</div>";
    h+="<div class='pick-list'>";
    freeTalent("director").sort((a,b)=>b.skill-a.skill).slice(0,8).forEach(function(d){
      h+=crewCard(d,{genre:WZ.genre, sel:!!(WZ.director&&WZ.director.id===d.id), attr:"data-fpd='"+d.id+"'"});
    });
    h+="</div>";
  }
  const v=openModal(h,{onClose:()=>{WZ=null;}});
  v.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ WZ.genre=b.dataset.g; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{ WZ.scale=b.dataset.s; WZ.budget=Math.round(neededBudget(WZ.genre,WZ.scale)); beep("click"); filmPitchModal(); });
  const bud=v.querySelector("#fpBudget"); if(bud){ bud.oninput=()=>{ WZ.budget=+bud.value; const el=$("#fpBudgetV"); if(el) el.textContent=fmtM(WZ.budget); }; }
  v.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{ WZ.rating=b.dataset.r; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{ WZ.location=b.dataset.l; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-pat]").forEach(b=>b.onclick=()=>{ WZ.pattern=b.dataset.pat; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-roll]").forEach(b=>b.onclick=()=>{ WZ.rollout=b.dataset.roll; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-win]").forEach(b=>b.onclick=()=>{ WZ.window=+b.dataset.win; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-imax]").forEach(b=>b.onclick=()=>{ WZ.imax=!WZ.imax; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-premium]").forEach(b=>b.onclick=()=>{ WZ.premium=!WZ.premium; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-soundtrack]").forEach(b=>b.onclick=()=>{ WZ.soundtrack=!WZ.soundtrack; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-dad]").forEach(b=>b.onclick=()=>{ WZ.dayAndDate=!WZ.dayAndDate; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-polish]").forEach(b=>b.onclick=()=>{ WZ.scriptPolish=!WZ.scriptPolish; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-fpd]").forEach(el=>el.onclick=()=>{ WZ.director=talentById(+el.dataset.fpd); beep("click"); filmPitchModal(); });
  if(step>=2){
    v.querySelectorAll("[data-fpw]").forEach(el=>el.onclick=()=>{ WZ.writer=talentById(+el.dataset.fpw); beep("click"); filmPitchModal(); });
    v.querySelectorAll("[data-fpp]").forEach(el=>el.onclick=()=>{ WZ.producer=talentById(+el.dataset.fpp); beep("click"); filmPitchModal(); });
    v.querySelectorAll("[data-fpc]").forEach(el=>el.onclick=()=>{ const t=talentById(+el.dataset.fpc); if(t){ const idx=WZ.cast.findIndex(c=>c.id===t.id); if(idx>=0) WZ.cast.splice(idx,1); else if(WZ.cast.length<4) WZ.cast.push(t); beep("click"); filmPitchModal(); }});
  }
  const bk=v.querySelector("#fpBack"); if(bk) bk.onclick=filmPitchModal;
  const go=v.querySelector("#fpGo");
  if(go) go.onclick=()=>{
    const res=pitchFilm({titleOverride:null, genre:WZ.genre, scale:WZ.scale, budget:WZ.budget,
      rating:WZ.rating, location:WZ.location, pattern:WZ.pattern, rollout:WZ.rollout, window:WZ.window,
      imax:WZ.imax, premium:WZ.premium, soundtrack:WZ.soundtrack, dayAndDate:WZ.dayAndDate,
      scriptPolish:WZ.scriptPolish, director:WZ.director, writer:WZ.writer, producer:WZ.producer, cast:WZ.cast, coProd:null});
    beep(res.ok?"gold":"bad"); flashes(G.flash);
    WZ=null; closeModal(); render();
  };
}

/* ═══════════ VIEW: productions ═══════════ */
function viewProductions(){
  let h="";
  const ready=readyProjects(), prod=inProdProjects();
  h+=filmFlowStrip("Production")+"<div class='tiny muted' style='margin:-4px 0 8px'>Concept → Script → Cast → <b>Production</b> → Post → Test → Marketing → Release → Box office → Streaming. Cards below show stage + next action.</div>";
  h+="<div class='row' style='margin-bottom:8px'><button class='btn btn-alt' onclick='calendarModal()'>📅 Release calendar — move dates, dodge rivals</button></div>";
  h+="<div class='section-title'>In production ("+prod.length+")</div>";
  if(!prod.length) h+="<div class='card muted small'>No films shooting. Visit 📝 Develop to greenlight one.</div>";
  for(const p of prod){
    const S=DATA.SCALES[p.scale];
    const ph=p.phase; const L=p.phaseLen;
    let phaseLabel = {pre:"Pre-production",shoot:"Shooting",post:"Post-production",reshoot:"🎬 Reshooting"}[ph]||ph;
    let progress;
    if(ph==="reshoot"){
      const weeks=L.reshoot||3, done=(p.phaseWeek*L.pre)||0;
      const pc=clamp(Math.round(p.phaseWeek/weeks*100),0,100);
      progress="<div class='phases'><div class='ph cur'><i style='width:"+pc+"%'></i></div></div><div class='ph-labels'><span>Reshoot</span></div>";
      const burn = p.budget*0.08/Math.max(1,weeks);
      h+="<div class='card prod-card'><div class='spread'><div><b>"+DATA.GENRES[p.genre].emoji+" "+esc(p.title)+"</b>"+(p.franchiseName?" <span class='tag purple'>franchise</span>":"")+
        "<div class='tiny muted'>"+gTag(p.genre)+" <span class='tag'>"+S.emoji+" "+S.name+"</span> · budget "+fmtM(p.budget)+" · dir "+(p.director?esc(p.director.name):"—")+"</div></div>"+
        "<div style='text-align:right'><div class='tag gold'>"+phaseLabel+"</div></div></div>"+
        progress+
        "<div class='spread small' style='margin-top:8px'><span class='muted'>Reshoot week "+Math.min(p.phaseWeek+1,weeks)+" of ~"+weeks+" · burn "+fmtM(burn)+"/wk</span>"+
        "<span class='muted'>spent "+fmtM(p.spent)+"</span></div>"+
        "<button class='btn btn-sm btn-danger' style='margin-top:8px' data-cancel='"+p.id+"'>✕ Shelve (lose spend)</button></div>";
      continue;
    }
    const curIdx={pre:0,shoot:1,post:2}[ph];
    const totalWk=L.pre+L.shoot+L.post, doneWk=(curIdx>0?L.pre:0)+(curIdx>1?L.shoot:0)+p.phaseWeek;
    const burn = ph==="pre"? p.budget*0.10/L.pre : ph==="shoot"? p.budget*0.70/L.shoot*(G.upgrades.backlot?0.88:1) : p.budget*0.20/L.post*(G.upgrades.vfx?0.75:1);
    progress="<div class='phases'>"+["pre","shoot","post"].map((x,i)=>{
      const st= i<curIdx? "done": i===curIdx? "cur":"";
      const w = i<curIdx? 100 : i===curIdx? Math.round(p.phaseWeek/L[x]*100):0;
      return "<div class='ph "+st+"'><i style='width:"+w+"%'></i></div>"; }).join("")+
      "</div><div class='ph-labels'><span>Pre</span><span>Shoot</span><span>Post</span></div>";
    h+="<div class='card prod-card'><div class='spread'><div><b>"+DATA.GENRES[p.genre].emoji+" "+esc(p.title)+"</b>"+(p.franchiseName?" <span class='tag purple'>franchise</span>":"")+
      "<div class='tiny muted'>"+gTag(p.genre)+" <span class='tag'>"+S.emoji+" "+S.name+"</span> · budget "+fmtM(p.budget)+(p.overrun>0? " <span class='neg'>(+"+fmtM(p.overrun)+" overrun)</span>":"")+" · 🎬 "+(p.director?esc(p.director.name):"—")+" · ✍️ "+(p.writer?esc(p.writer.name):"—")+" · 🎫 "+(p.producer?esc(p.producer.name):"<span class='neg'>none</span>")+" · "+(p.cast?p.cast.length:0)+" leads</div></div>"+
      "<div style='text-align:right'><div class='tag "+(ph==="shoot"?"gold":"blue")+"'>"+phaseLabel+"</div>"+
      (p.strikePause>0?"<div class='tag red' style='margin-top:4px'>✊ strike "+p.strikePause+"wks</div>":"")+"</div></div>"+
      progress+
      "<div class='spread small' style='margin-top:8px'><span class='muted'>Week "+(doneWk+1)+" of ~"+totalWk+" · burn "+fmtM(burn)+"/wk</span>"+
      "<span class='muted'>spent "+fmtM(p.spent)+" of "+fmtM(p.budget)+"</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Next: "+(ph==="pre"?(p.rewritten?"finish pre, then shoot":"rewrite for +6 script, then shoot"):ph==="shoot"?(p.producer?"ride the shoot — producer caps overruns":"watch overruns — no producer"):"finish post → test screening")+".</div>"+
      "<div class='row' style='margin-top:8px'>"+
      (ph==="pre" && !p.rewritten? "<button class='btn btn-sm btn-alt' data-rewrite='"+p.id+"'>✍️ Rewrite ("+fmtM(Math.max(2,Math.round(p.budget*0.05)))+")</button>":"")+
      "<button class='btn btn-sm btn-danger' data-cancel='"+p.id+"'>✕ Shelve</button></div></div>";
  }
  h+="<div class='section-title'>Ready for release ("+ready.length+")</div>";
  if(!ready.length) h+="<div class='card muted small'>Nothing in the can yet.</div>";
  for(const p of ready){
    const rl=DATA.rating(p.rating), lo=DATA.location(p.location);
    h+="<div class='card'><div class='spread'><div><b>🎞 "+esc(p.title)+"</b> "+scoreBadge(p.quality.overall)+
      (p.prebuyAccepted?"<div class='tiny gold'>Sold to "+DATA.platform(p.prebuyPlatform).name+" — payable on delivery</div>":"")+"</div></div>"+
      "<div class='tiny muted' style='margin-top:6px'>Critics "+p.quality.critic+" · Audience "+p.quality.aud+" · budget "+fmtM(p.budget)+(p.overrun>0? " (incl. "+fmtM(p.overrun)+" overrun)":"")+" · breakeven "+fmtM(breakevenWW(p))+" WW</div>"+
      (function(){ let legs="—"; try{ legs=legsOf({genre:p.genre, quality:p.quality, releaseWeek:G.week, pattern:p.pattern, rollout:p.rollout, imax:p.imax})+"×"; }catch(e){}
        const steps=[p.tested?"Test ✓":"Test — screen it", "P&A ≈ "+fmtM(recMarketing(p)), p.releaseWeek?"Dated "+dateLabel(p.releaseWeek):"Undated"];
        return "<div class='tiny muted' style='margin-top:4px'>Release readiness: "+steps.join(" · ")+" · legs ~"+legs+".</div>"; })()+
      (p.writer||p.producer? "<div class='tiny muted'>"+(p.writer? "✍️ "+esc(p.writer.name)+" ("+(p.writerBonus>=0?"+":"")+p.writerBonus+" script)":"")+(p.producer? " · 🎫 "+esc(p.producer.name):"")+"</div>":"")+
      "<div class='row' style='margin-top:6px'><span class='tag "+(p.rating==="R"?"red":"blue")+"'>"+p.rating+"</span><span class='tag'>"+lo.name+" ("+Math.round(lo.rebate*100)+"%)</span>"+
        (p.premium?"<span class='tag gold'>🍿 IMAX/Premium</span>":"")+
        (p.scriptPolish?"<span class='tag green'>✍️ polish</span>":"")+"</div>"+
      (p.prebuyAccepted?"":"<div class='row' style='margin-top:10px'><button class='btn btn-primary' data-sched='"+p.id+"'>📅 Theatrical Release</button><button class='btn btn-alt' data-shop='"+p.id+"'>📺 Shop to Streamers</button>"+
        "<button class='btn btn-ghost' data-test='"+p.id+"'>🎬 Test screen &amp; reshoot</button>"+
        "<button class='btn btn-ghost' data-screen='"+p.id+"'>🧪 Screening report</button>"+
        (!p.reshoot && p.quality.overall<62? "<button class='btn btn-ghost' data-reshoot='"+p.id+"'>🎞 Quick reshoot ("+fmtM(Math.max(3,Math.round(p.budget*0.08)))+")</button>":"")+
        "</div>")+"</div>";
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

/* ── strategic release calendar: every weekend, everybody's films, warnings ── */
let CAL=null; // {filmId}
function calendarModal(){
  const dated=(G.projects||[]).filter(p=>p.releaseWeek>G.week).sort((a,b)=>a.releaseWeek-b.releaseWeek);
  if(!CAL) CAL={filmId:dated.length?dated[0].id:null};
  if(CAL.filmId&&!dated.some(p=>p.id===CAL.filmId)) CAL.filmId=dated.length?dated[0].id:null;
  const film=dated.find(p=>p.id===CAL.filmId)||null;
  let h="<h3>📅 Release calendar</h3>"+
    "<div class='tiny muted'>Player + rival films, holidays, corridors, theater caps, sports weeks, expiring deals. Pick a dated film, tap a weekend to move it — rivals may blink.</div>";
  h+="<div class='small muted' style='margin:10px 0 6px'><b>Move</b></div><div class='row'>";
  if(!dated.length) h+="<span class='tiny muted'>No dated films — date one from Productions first.</span>";
  dated.forEach(p=>{ h+="<button class='btn btn-sm "+(CAL.filmId===p.id?"btn-primary":"")+"' data-calfilm='"+p.id+"'>"+esc(p.title)+" ("+dateLabel(p.releaseWeek)+")</button>"; });
  h+="</div><div style='max-height:320px;overflow-y:auto;display:grid;gap:6px;margin-top:8px'>";
  for(let w=G.week+2; w<=G.week+30; w++){
    const s=DATA.seasonOf(woyOf(w));
    const mine=(G.projects||[]).filter(o=>o.releaseWeek===w).map(o=>"“"+esc(o.title)+"”").join(" · ");
    const rvs=[]; (G.rivals||[]).forEach(r=>{ (r.slate||[]).forEach(f=>{ if(f.week===w&&!f.dead) rvs.push(r.name.split(" ")[0]+": "+f.title+" ("+f.scale+")"); }); });
    const warns=weekWarnings(w, film);
    const tags=(s.holiday?"<span class='tag gold'>🎄 holiday ×"+s.season.toFixed(2)+"</span> ":"")+
      (s.season>=1.15?"<span class='tag gold'>corridor ×"+s.season.toFixed(2)+"</span>":s.season<=0.9?"<span class='tag red'>dead ×"+s.season.toFixed(2)+"</span>":"<span class='tag'>×"+s.season.toFixed(2)+"</span>");
    h+="<div class='calendar-row"+(film&&film.releaseWeek===w?" sel":"")+"' data-calw='"+w+"'>"+
      "<div class='cal-when'><b>"+s.month+" W"+woyOf(w)+"</b><span>Year "+yearOf(w)+"</span></div>"+
      "<div class='cal-note'>"+tags+" "+(mine?"<br><span class='mine-f'>"+mine+"</span>":"")+(rvs.length?"<br><span class='rival-f'>"+rvs.slice(0,2).join(" · ")+"</span>":"")+
      (warns.length?"<br>"+warns.map(x=>"<span class='tag "+x.cls+"'>"+x.t+"</span>").join(" "):"")+"</div>"+
      "<div class='tiny muted'>"+(film?"opens ≈ "+fmtG(previewOpen(film,w)):"")+"</div></div>";
  }
  h+="</div><div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Close</button></div>";
  const v=openModal(h,{onClose:()=>{CAL=null;}});
  v.querySelectorAll("[data-calfilm]").forEach(b=>b.onclick=()=>{ CAL.filmId=+b.dataset.calfilm; beep("click"); calendarModal(); });
  v.querySelectorAll("[data-calw]").forEach(el=>el.onclick=()=>{
    if(!film){ toast("Pick a dated film first.","bad"); return; }
    if(moveReleaseDate(film.id,+el.dataset.calw)){ beep("gold"); flashes(G.flash); calendarModal(); }
    else toast("That weekend is too soon.","bad");
  });
}

/* ── release scheduling modal ── */
function startScheduling(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p) return;
  SCHEDULE={p, week:G.week+4, marketing:recMarketing(p), sel:false, premium:!!p.premium, window:p.window||"45", dayAndDate:!!p.dayAndDate, boosts:[], camps:(p.campaigns||[]).slice(), plan:null};
  if(p.mktBoosts) SCHEDULE.boosts = p.mktBoosts.slice();
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
  h+="<div class='card' style='margin-top:8px;cursor:pointer' id='scPremium'><div class='spread'><span class='small'>"+(SCHEDULE.premium?"✅ ":"⬜ ")+"<b>Premium/IMAX format</b> — +12% opening</span><span class='tag "+(SCHEDULE.premium?"gold":"")+"'>+"+fmtM(Math.round(SCHEDULE.marketing*0.08))+" P&A</span></div>"+
    "<div class='tiny muted'>Premium screens (IMAX, 4DX) draw the big-open crowd but cost more to platform. +8% P&A for +12% opening.</div></div>";
  h+="<div class='small muted' style='margin:10px 0 6px'>🎞 Theatrical windowing</div><div class='row' id='scWin'>";
  DATA.WINDOWS.forEach(w=>{ h+="<button class='btn btn-sm "+(SCHEDULE.window===w.id?"btn-primary":"")+"' data-win='"+w.id+"'>"+w.name+"</button>"; });
  h+="<div class='tiny muted' style='margin:2px 0 4px'>"+DATA.window(SCHEDULE.window||"45").desc+" <span class='muted'>(exhibitor mood: "+Math.round(G.exhibitor||50)+"/100 · piracy meter "+Math.round(G.piracy||0)+"/100 — 90-day windows starve it)</span></div>";
  /* v5: marketing campaign boosts (Super Bowl, influencers, embargoes) */
  if(DATA.MKT_BOOSTS){
    h+="<div class='small muted' style='margin:10px 0 6px'>📣 Campaign boosts <span class='tiny'>(stack onto P&A, charged up front)</span></div><div class='plan-pick'>";
    DATA.MKT_BOOSTS.forEach(function(m){
      const on=SCHEDULE.boosts.includes(m.id);
      h+="<div class='plan-opt"+(on?" sel":"")+"' data-boost='"+m.id+"'><div class='spread'><h5>"+m.icon+" "+m.name+"</h5><span class='tag "+(on?"gold":"")+"'>+"+fmtM(m.cost)+"</span></div><div class='p-sub'>"+m.desc+"</div></div>";
    });
    h+="</div>";
  }
  /* ── marketing campaigns: channels + strategy presets + live dashboard ── */
  h+="<div class='small muted' style='margin:10px 0 6px'>📣 Campaign plan <span class='tiny'>(paid via P&A · hype/awareness lift opening · WOM lifts legs)</span></div><div class='row' id='scPlans'>";
  campaignPlans().forEach(pl=>{ h+="<button class='btn btn-sm "+(SCHEDULE.plan===pl.id?"btn-primary":"")+"' data-plan='"+pl.id+"' title='"+pl.desc+"'>"+pl.name+"</button>"; });
  h+="</div><div class='plan-pick' style='margin-top:6px'>";
  campaignDefs().forEach(function(c){
    const on=SCHEDULE.camps.includes(c.id), cost=campaignCost(c.id, p.scale);
    h+="<div class='plan-opt"+(on?" sel":"")+"' data-camp='"+c.id+"'><div class='spread'><h5>"+c.icon+" "+c.name+"</h5><span class='tag "+(on?"gold":"")+"'>+"+fmtM(cost)+"</span></div>"+
      "<div class='p-sub'>"+c.desc+"</div>"+
      "<div class='p-sub'>reach "+c.reach+" · hype +"+Math.round(c.hype*100)+"% · aware +"+Math.round(c.aware*100)+"% · legs +"+c.legs.toFixed(2)+"×</div>"+
      "<div class='p-sub'>targets "+(c.demos||[]).join(" + ")+" · ×1.5 hype on the film's strongest demo</div></div>";
  });
  h+="</div>";
  { let reach=0, hype=0, cc=0, legsB=0;
    SCHEDULE.camps.forEach(id=>{ const c=campaignDef(id); if(!c) return; reach+=c.reach; hype+=c.hype; cc+=campaignCost(id,p.scale); legsB+=c.legs; });
    reach=Math.min(100,reach); hype=Math.round(hype*100); cc=Math.round(cc*10)/10;
    let roi="—", expNote="";
    try{
      const base=previewOpen(p,SCHEDULE.week);
      const legs=legsOf({genre:p.genre, quality:p.quality, releaseWeek:SCHEDULE.week, pattern:p.pattern, rollout:p.rollout, imax:p.imax, campaignLegs:legsB});
      const grossLift=(base*hype/100)*legs*0.53; // hype% of opening, held over legs, studio rentals
      roi=cc>0? "×"+(Math.round(grossLift/Math.max(1,cc)*10)/10) : "—";
      expNote="rentals lift ≈ "+fmtM(Math.max(0,grossLift))+" vs "+fmtM(cc)+" spend";
    }catch(e){}
    const paidNow=Math.round(schedMkt(p,true)*0.3*10)/10;
    h+="<div class='card' style='margin-top:8px'><b class='small'>Marketing dashboard</b>"+
      "<div class='cost-line'><span>Budget (P&A + campaigns)</span><b>"+fmtM(schedMkt(p,true))+"</b></div>"+
      "<div class='cost-line'><span>Spent (30% now)</span><b>"+fmtM(paidNow)+"</b></div>"+
      "<div class='cost-line'><span>Reach</span><b>"+reach+"/100</b></div>"+
      "<div class='cost-line'><span>Hype</span><b class='pos'>+"+hype+"% opening</b></div>"+
      "<div class='cost-line'><span>Expected impact</span><b class='tiny'>"+expNote+"</b></div>"+
      "<div class='cost-line'><span>ROI (est. rentals ÷ spend)</span><b class='"+(parseFloat(String(roi).slice(1))>=1?"pos":"neg")+"'>"+roi+"</b></div></div>";
  }
  h+="<div class='row' id='scDay'>";
  h+="<div class='card' style='margin-top:4px;cursor:pointer;flex:1' id='scDayToggle'><div class='spread'><span class='small'>"+(SCHEDULE.dayAndDate?"✅ ":"⬜ ")+"<b>Day-and-date</b> — theater + your platform</span></div>"+
    "<div class='tiny muted'>−35% opening, but pushes your streamers' subscribers. Only if you own a platform.</div></div></div>";
  h+="<div class='small muted' style='margin:10px 0 6px'>Pick a weekend (next 30 weeks):</div><div style='max-height:300px;overflow-y:auto;display:grid;gap:6px'>";
  for(let w=G.week+2; w<=G.week+30; w++){
    const s=DATA.seasonOf(woyOf(w));
    const comps=weekendCompetitors(p, w);
    let note="";
    comps.forEach(c=>{ note += c.mine? "<span class='mine-f'>vs your “"+esc(c.title)+"”</span> " : "<span class='rival-f'>"+c.rival+": "+esc(c.title)+"</span> "; });
    const heat = s.season>=1.15? "<span class='tag gold'>corridor ×"+s.season.toFixed(2)+"</span>" : s.season<=0.9? "<span class='tag red'>dead zone ×"+s.season.toFixed(2)+"</span>" : "<span class='tag'>×"+s.season.toFixed(2)+"</span>";
    let tlNote="";
    if(p.franchiseName && typeof timelineFactor==="function"){
      const tf=timelineFactor(p, w);
      if(tf<1) tlNote=" <span class='tag red'>🕰 timeline clutter −6%</span>";
      else if(tf>1.01) tlNote=" <span class='tag green'>🕰 event-ized +4%</span>";
    }
    h+="<div class='calendar-row"+(SCHEDULE.week===w?" sel":"")+"' data-w='"+w+"'><div class='cal-when'><b>"+s.month+" W"+woyOf(w)+"</b><span>Year "+yearOf(w)+"</span></div>"+
      "<div class='cal-note'>"+heat+tlNote+" "+(note? "<br>"+note : "<span class='muted'>clean weekend</span>")+"</div>"+
      "<div class='tiny muted'>opens ≈ "+fmtG(previewOpen(p,w))+"</div></div>";
  }
  h+="</div>";
  // summary
  const exp=previewOpen(p,SCHEDULE.week);
  const effMkt = schedMkt(p,true);
  const be=breakevenWW({budget:p.budget, marketing:effMkt});
  h+="<div class='card' style='margin-top:10px'><div class='cost-line'><span>Expected opening (est.)</span><b id='scExp'>"+fmtG(exp)+" dom</b></div>"+
    "<div class='cost-line'><span>Breakeven</span><b id='scBe'>"+fmtG(be)+" WW</b></div>"+
    "<div class='cost-line'><span>Pay now (30% P&A)</span><b id='scPay'>"+fmtM(effMkt*0.3)+"</b></div>"+
    "<div class='cost-line'><span>Cost</span><b>"+fmtM(effMkt)+" P&A total</b></div>"+
    "<div class='cost-line'><span>Risk</span><b>"+(weekendCompetitors(p,SCHEDULE.week).length? weekendCompetitors(p,SCHEDULE.week).length+" rival(s) that weekend":"clean weekend")+"</b></div>"+
    "<div class='cost-line'><span>Quality / critics / audience</span><b>"+p.quality.overall+" / "+p.quality.critic+" / "+p.quality.aud+"</b></div></div>";
  h+="<div class='modal-actions'><button class='btn btn-primary' id='scGo'>📅 Lock the date</button></div>";
  const v=openModal(h,{onClose:()=>{SCHEDULE=null;}});
  const rg=v.querySelector("#scMkt");
  rg.oninput=()=>{
    SCHEDULE.marketing=+rg.value;
    $("#scMktV").textContent=fmtM(SCHEDULE.marketing);
    const e2=previewOpen(p,SCHEDULE.week);
    const effMkt = schedMkt(p,true);
    const eEl=$("#scExp"), bEl=$("#scBe"), pEl=$("#scPay");
    if(eEl) eEl.textContent=fmtG(e2)+" dom";
    if(bEl) bEl.textContent=fmtG(breakevenWW({budget:p.budget, marketing:effMkt}))+" WW";
    if(pEl) pEl.textContent=fmtM(effMkt*0.3);
  };
  v.querySelectorAll("[data-w]").forEach(el=>el.onclick=()=>{ SCHEDULE.week=+el.dataset.w; beep("click"); schedModal(); });
  const pm=v.querySelector("#scPremium"); if(pm) pm.onclick=()=>{ SCHEDULE.premium=!SCHEDULE.premium; beep("click"); schedModal(); };
  v.querySelectorAll("[data-win]").forEach(b=>b.onclick=()=>{ SCHEDULE.window=b.dataset.win; beep("click"); schedModal(); });
  const dt=v.querySelector("#scDayToggle"); if(dt) dt.onclick=()=>{ SCHEDULE.dayAndDate=!SCHEDULE.dayAndDate; beep("click"); schedModal(); };
  v.querySelectorAll("[data-boost]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.boost;
    const i=SCHEDULE.boosts.indexOf(id);
    if(i>=0) SCHEDULE.boosts.splice(i,1); else SCHEDULE.boosts.push(id);
    beep("click"); schedModal();
  });
  v.querySelectorAll("[data-camp]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.camp;
    const i=SCHEDULE.camps.indexOf(id);
    if(i>=0) SCHEDULE.camps.splice(i,1); else SCHEDULE.camps.push(id);
    SCHEDULE.plan=null; beep("click"); schedModal();
  });
  v.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{
    const pl=campaignPlans().find(x=>x.id===b.dataset.plan); if(!pl) return;
    SCHEDULE.plan=pl.id; SCHEDULE.camps=pl.picks.slice();
    beep("click"); schedModal();
  });
  v.querySelector("#scGo").onclick=()=>{
    const mkt = schedMkt(p,true);
    const want=Math.round(mkt*0.3);
    // pay what you can now; the rest is due at release (advanceWeek collects it)
    const now=Math.min(want, Math.max(0, Math.floor(G.studio.cash)));
    p.releaseWeek=SCHEDULE.week; p.marketing=mkt; p.marketingPaid=now; p.premium=SCHEDULE.premium;
    p.window=SCHEDULE.window; p.dayAndDate=SCHEDULE.dayAndDate;
    p.mktBoosts=SCHEDULE.boosts.slice();
    if(SCHEDULE.boosts.includes("influencer")) p.buzzBonus=(p.buzzBonus||0)+(DATA.mktBoost("influencer").buzz||0.04);
    p.campaigns=SCHEDULE.camps.slice(); p.campaignPlan=SCHEDULE.plan; applyCampaigns(p);
    try{ playChicken(p, SCHEDULE.week); }catch(e){} // rivals blink at the dated weekend
    G.studio.cash-=now;
    if(now<want) log("📅 “"+p.title+"” dated for "+seasonDateLabel(SCHEDULE.week)+" with "+fmtM(mkt)+" P&A — "+fmtM(now)+" paid now, "+fmtM(want-now)+" due at release (fees continue to accrue).","gold");
    else log("📅 “"+p.title+"” dated for "+seasonDateLabel(SCHEDULE.week)+" with "+fmtM(mkt)+" P&A"+(SCHEDULE.premium?" (+Premium/IMAX)":"")+" · "+(DATA.window(SCHEDULE.window).name)+(SCHEDULE.dayAndDate?" · day-and-date":"")+".","gold");
    beep("gold"); SCHEDULE=null; closeModal(); render();
  };
}
/* scheduling P&A math: base slider (+premium) + v5 boosts [+ campaign channels] */
function schedMkt(p, withCamps){
  const boostC=(SCHEDULE?SCHEDULE.boosts:[]).reduce((a,b)=>a+((DATA.mktBoost(b)||{}).cost||0),0);
  const campC=(withCamps&&SCHEDULE?SCHEDULE.camps:[]).reduce((a,id)=>a+campaignCost(id,p.scale),0);
  return Math.round(((SCHEDULE&&SCHEDULE.premium? Math.round(SCHEDULE.marketing*1.08) : (SCHEDULE?SCHEDULE.marketing:p.marketing||0)) + boostC + campC)*10)/10;
}
function previewOpen(p,w){
  const saved={m:p.marketing, r:p.releaseWeek, pr:p.premium, mb:p.mktBoosts, bz:p.buzzBonus, aw:p.awareness};
  p.marketing=SCHEDULE?SCHEDULE.marketing:p.marketing; p.releaseWeek=w;
  if(SCHEDULE){
    p.premium=SCHEDULE.premium; p.mktBoosts=SCHEDULE.boosts.slice();
    let bz=0, aw=0, top=null;
    try{ top=demoProfile(p).strongest.id; }catch(e){}
    SCHEDULE.camps.forEach(id=>{ const c=campaignDef(id); if(!c) return;
      const hit=top&&(c.demos||[]).includes(top);
      bz+=c.hype*(hit?1.5:1); aw+=c.aware; });
    p.buzzBonus=(p.buzzBonus||0)+bz; p.awareness=(p.awareness||0)+aw;
  }
  const v=expectedOpening(p,w);
  p.marketing=saved.m; p.releaseWeek=saved.r; p.premium=saved.pr; p.mktBoosts=saved.mb; p.buzzBonus=saved.bz; p.awareness=saved.aw;
  return v;
}

/* ═══════════ v4: critic / audience split + named reviews ═══════════ */
function scoreSplit(f){
  const crit = f.criticAvg!=null? f.criticAvg : (f.quality? f.quality.critic:50);
  const aud  = audienceScoreOf(f);
  const fresh = f.freshPct!=null? f.freshPct : (crit>=60?100:0);
  return "<div class='split'>"+
    "<div class='sp-side'><div class='sp-face'>"+(crit>=70?"🍅":crit>=50?"🍂":"🤢")+"</div>"+
      "<div><b class='"+(crit>=70?"pos":crit>=50?"":"neg")+"'>"+crit+"%</b><div class='tiny muted'>critics"+((f.reviews&&f.reviews.length)? " ("+f.reviews.length+")":"")+"</div></div></div>"+
    "<div class='sp-side'><div class='sp-face'>"+(aud>=70?"🍿":aud>=50?"😐":"👎")+"</div>"+
      "<div><b class='"+(aud>=70?"pos":aud>=50?"":"neg")+"'>"+aud+"%</b><div class='tiny muted'>audience</div></div></div>"+
    "<span class='tag "+(fresh>=60?"green":"red")+"'>"+fresh+"% positive</span>"+
    (f.reviewBombed? "<span class='tag red'>🍅 review-bombed</span>":"")+
  "</div>";
}
function reviewsModal(fid){
  const f=G.films.find(x=>x.id===fid); if(!f) return;
  let h="<h3>🗞 Reviews — “"+esc(f.title)+"”</h3>"+scoreSplit(f);
  if(!(f.reviews||[]).length) h+="<div class='card muted small'>No reviews filed for this title.</div>";
  (f.reviews||[]).slice().sort((a,b)=>b.score-a.score).forEach(function(r){
    const cats=r.cats||{};
    const catRow=(k,label)=>"<div class='cost-line'><span>"+label+"</span><b>"+(cats[k]!=null?cats[k]:"—")+"</b></div>";
    h+="<div class='card review-card'><div class='spread'><div><b>"+esc(r.name)+"</b> <span class='tiny muted'>"+esc(r.outlet)+"</span>"+
       (r.sentiment?" <span class='tag "+(r.sentiment==="positive"?"green":r.sentiment==="negative"?"red":"")+"'>"+r.sentiment+"</span>":"")+"</div>"+
       "<b class='"+(r.score>=70?"pos":r.score>=50?"":"neg")+"'>"+r.score+"/100</b></div>"+
       "<div class='small' style='margin-top:4px'>“"+esc(r.quote)+"”</div>"+
       "<div class='grid g2' style='margin-top:6px'><div>"+
       catRow("story","📖 Story")+catRow("direction","🎬 Direction")+catRow("acting","🎭 Acting")+"</div><div>"+
       catRow("production","🏗 Production")+catRow("entertainment","🍿 Entertainment")+catRow("originality","💡 Originality")+"</div></div></div>";
  });
  if(f.reviewBombed) h+="<div class='card' style='border-left:3px solid var(--red)'><b>🍅 Review bombing</b><div class='tiny muted'>An organised pile-on cost this film "+f.reviewBombed+" audience points — and the word of mouth that goes with them.</div></div>";
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Close</button></div>";
  openModal(h);
}

/* ═══════════ VIEW: box office ═══════════ */
/* Box office: read-only visualization + WHY explainer from existing film data. */
function boSplit(f){
  try{
    const share=f.presales?0:(DATA.GENRES[f.genre]?DATA.GENRES[f.genre].intlShare:0.5);
    const ww=f.ww||(f.dom/(1-share))||0;
    return {dom:f.dom||0, intl:Math.max(0,ww-(f.dom||0)), ww};
  }catch(e){ return {dom:f.dom||0, intl:0, ww:f.ww||f.dom||0}; }
}
function boMult(f){
  const s=boSplit(f);
  return f.opening>0? Math.round(s.ww/f.opening*100)/100 : 0;
}
function boLegs(f){
  if(f.legs) return Math.round(f.legs*100)/100;
  try{ return Math.round(legsOf(f)*100)/100; }catch(e){ return 0; }
}
function boWhy(f){
  const rows=[];
  try{
    const starP=(f.cast||[]).reduce((a,c)=>a+(c.power||0),0);
    if(starP>=6) rows.push(["+","Star power "+starP+"★ carried the opening."]);
    else if(starP>=3) rows.push(["+","Solid cast ("+starP+"★) helped the opening."]);
    else if(!f.aiCast) rows.push(["-","No star power — opening leaned on concept + marketing."]);
    if(f.aiCast) rows.push(["-","Synthetic cast: no press tour, audiences cool (−hype, −audience)."]);
    let rec=0; try{ rec=recMarketing(f); }catch(e){}
    if(rec>0){
      if((f.marketing||0)>=rec) rows.push(["+","P&A "+fmtM(f.marketing||0)+" at/above the "+fmtM(rec)+" guide."]);
      else rows.push(["-","P&A "+fmtM(f.marketing||0)+" under the "+fmtM(rec)+" guide — opening left money out there."]);
    }
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
    if(aud>=75) rows.push(["+","Audience love ("+aud+") — long legs, strong word of mouth."]);
    else if(aud>=55) rows.push(["+","Audience OK ("+aud+") — average legs."]);
    else rows.push(["-","Weak word of mouth ("+aud+") — legs collapse after opening."]);
    const crit=f.criticAvg!=null?f.criticAvg:(f.quality?f.quality.critic:50);
    if(crit>=70) rows.push(["+","Critics endorse ("+crit+") — holds + prestige."]);
    else if(crit<45) rows.push(["-","Critics panned ("+crit+") — walk-ups die."]);
    try{ if(seasonOfW(f.releaseWeek).holiday) rows.push(["+","Holiday corridor lifted gross (+legs, +weekly)."]); }catch(e){}
    try{ const t=trendOf(f.genre); if(t>=1.07) rows.push(["+","Genre heat "+t.toFixed(2)+"× — the market wanted this."]); else if(t<=0.94) rows.push(["-","Cold genre ("+t.toFixed(2)+"×) — the market stayed home."]); }catch(e){}
    if(f.franchiseName) rows.push(["+","Franchise pull ("+esc(f.franchiseName)+") — built-in opening."]);
    try{ if(fatigueOfName(f.franchiseName)>0.2) rows.push(["-","Franchise fatigue — smaller openings, harsher reviews."]); }catch(e){}
    if(f.premium||f.imax) rows.push(["+","Premium/IMAX screens (+12% opening)."]);
    if(f.dayAndDate) rows.push(["-","Day-and-date: −35% opening for streamer subs."]);
    try{
      const comps=weekendCompetitors(f,f.releaseWeek||G.week).filter(c=>!c.mine);
      if(comps.length>=2) rows.push(["-","Crowded weekend ("+comps.length+" rivals) split the audience."]);
      else if(comps.length===1) rows.push(["-","Opened against "+comps[0].rival+" — shared the weekend."]);
      else rows.push(["+","Clean weekend — no rival tentpole opposite."]);
    }catch(e){}
    if((f.cast||[]).some(c=>c.scandal>0)) rows.push(["-","Scandal-hit cast discounted the opening."]);
    if(f.reviewBombed) rows.push(["-","Review bombing cost "+f.reviewBombed+" audience points."]);
    if(f.piracyPenalty) rows.push(["-","Piracy leak bled the legs."]);
    try{ if(G.piracy>=45) rows.push(["-","High piracy meter ("+Math.round(G.piracy)+") taxes every live run."]); }catch(e){}
    if(f.embargoActive) rows.push([(f.quality&&f.quality.critic>=55)?"+":"-","Review embargo "+((f.quality&&f.quality.critic>=55)?"built anticipation.":"backfired on weak reviews.")]);
  }catch(e){}
  if(!rows.length) return "<div class='tiny muted'>No signal yet.</div>";
  return rows.map(r=>"<div class='cost-line'><span><b class='"+(r[0]==="+"?"pos":"neg")+"'>"+r[0]+"</b> "+r[1]+"</span></div>").join("");
}
/* Rivals: read-only profiles from existing slate/ytd. Behavior (slates, chicken,
   poaching, bids, trends) already lives in engine.js; this surfaces it. */
function rivalProfile(r){
  const style=r.style||"balanced";
  const meta={
    tentpole:{strategy:"Blockbusters — summer/holiday corridors", strength:"Tentpole openings, corridor dating", weakness:"Prestige seasons, crowded weekends"},
    prestige:{strategy:"Prestige — awards + festivals", strength:"Reviews, awards momentum", weakness:"Tentpole corridors, small openings"},
    balanced:{strategy:"Volume — a bit of everything", strength:"Full slate, steady share", weakness:"No killer edge anywhere"}
  }[style]||{strategy:style, strength:"—", weakness:"—"};
  const up=(r.slate||[]).filter(f=>!f.dead&&!f.live&&f.week>G.week).sort((a,b)=>a.week-b.week).slice(0,4);
  const done=(r.slate||[]).filter(f=>(f.live||f.dead)&&(f.opening||0)>0).sort((a,b)=>b.week-a.week).slice(0,3);
  const all=[{n:"You",ww:G.films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0)}].concat(G.rivals.map(x=>({n:x.name,ww:x.ytd||0})));
  const tot=all.reduce((a,x)=>a+x.ww,0)||1;
  const rank=all.slice().sort((a,b)=>b.ww-a.ww).findIndex(x=>x.n===r.name)+1;
  const share=Math.round((r.ytd||0)/tot*100);
  return "<div class='card rival-card' data-rival='"+esc(r.name)+"' style='cursor:pointer;border-left:4px solid "+(r.color||"#fff")+"'><div class='spread'><div><b style='color:"+(r.color||"#fff")+"'>"+esc(r.name)+"</b>"+
    "<div class='tiny muted'>"+esc(r.blurb||"")+" · #"+rank+" share ("+share+"%)</div></div>"+
    "<span class='tag'>"+fmtM(r.ytd||0)+" YTD</span></div>"+
    "<div class='cost-line'><span>Strategy</span><b class='tiny'>"+meta.strategy+"</b></div>"+
    "<div class='cost-line'><span>Strength</span><b class='tiny pos'>"+meta.strength+"</b></div>"+
    "<div class='cost-line'><span>Weakness</span><b class='tiny neg'>"+meta.weakness+"</b></div>"+
    "<div class='tiny muted' style='margin-top:4px'><b>Current slate</b> — "+(up.length?up.map(f=>esc(f.title)+" ("+DATA.GENRES[f.genre].name+"/"+f.scale+", "+dateLabel(f.week)+")").join(" · "):"nothing dated")+ "</div>"+
    "<div class='tiny muted' style='margin-top:2px'><b>Recent</b> — "+(done.length?done.map(f=>esc(f.title)+" "+fmtG(f.dom||0)+" dom"+((f.dom||0)>=(f.opening||0)*2.5?" 🔥":"")).join(" · "):"no releases yet")+"</div></div>";
}
/* International dashboard: regional split of settled actuals. Live runs show
   estimates pro-rated from the current domestic pace; finished runs show final
   stored regions. Region grosses always sum to the film's intl total. */
function regionPanel(f){
  let regs=f.regions;
  try{ if(!regs||!regs.length) regs=regionSplit(f); }catch(e){ return ""; }
  const lastWk=(f.weekly&&f.weekly.length)?f.weekly[f.weekly.length-1].gross:0;
  const live=!!f.inTheaters;
  let h="<div class='card' style='margin:8px 0 0'><b class='small'>🌍 International markets</b>"+
    "<div class='tiny muted'>"+(live?"Estimates split from the live domestic pace — totals update nightly.":"Final regional split.")+" Levers: staggered rollout, intl campaign channel, foreign-language bonus.</div>";
  regs.forEach(r=>{
    const openEst=f.opening? Math.max(0,Math.round(f.opening*(r.gross/Math.max(1,((f.ww||0)-(f.dom||0))))*10)/10):0;
    const wkEst=live? Math.max(0,Math.round(lastWk*(r.gross/Math.max(1,((f.ww||0)-(f.dom||0))))*10)/10):0;
    h+="<div class='cost-line'><span>"+r.emoji+" "+r.name+" <span class='tiny muted'>aud "+r.aud+" · "+r.share+"% of WW"+(r.note?" · "+r.note:"")+"</span></span>"+
      "<b>"+fmtG(r.gross)+"<span class='tiny muted'> tot</span>"+(live?" · "+fmtG(wkEst)+"<span class='tiny muted'>/wk</span>":" · open ≈ "+fmtG(openEst))+"</b></div>";
  });
  return h+"</div>";
}

/* Regional summary across all films */
function regionSummaryPanel(){
  const films = [...G.films].filter(f=>f.ww && f.ww>0);
  if(!films.length) return "";
  const defs = regionDefs();
  const totals = defs.map(d=>({id:d.id, name:d.name, emoji:d.emoji, gross:0, count:0, aud:0}));
  films.forEach(f=>{
    let regs = f.regions;
    try{ if(!regs||!regs.length) regs=regionSplit(f); }catch(e){ return; }
    regs.forEach((r,i)=>{
      const t = totals.find(x=>x.id===r.id);
      if(t){
        t.gross += r.gross;
        t.count++;
        t.aud = t.count>0 ? Math.round((t.aud*(t.count-1) + r.aud)/t.count) : r.aud;
      }
    });
  });
  const totalIntl = totals.reduce((a,b)=>a+b.gross,0);
  let h="<div class='card' style='margin-bottom:12px'><b class='small'>🌍 Regional box office summary (all-time)</b>"+
    "<div class='tiny muted'>Aggregated across "+films.length+" released films. Total intl: <b class='gold'>"+fmtG(totalIntl)+"</b>.</div>";
  totals.sort((a,b)=>b.gross-a.gross).forEach(t=>{
    const pct = totalIntl>0 ? Math.round(t.gross/totalIntl*1000)/10 : 0;
    h+="<div class='cost-line'><span>"+t.emoji+" "+t.name+" <span class='tiny muted'>"+t.count+" films · aud "+t.aud+"</span></span>"+
      "<b>"+fmtG(t.gross)+"<span class='tiny muted'> ("+pct+"% of intl)</span></b></div>";
  });
return h+"</div>";
}

/* Film comparison modal */
function compareFilmsModal(){
  const sel = (G.compareSel||[]).map(id=>G.films.find(f=>f.id===id)).filter(Boolean);
  if(sel.length<2){ toast("Select at least 2 films to compare.","bad"); return; }
  let h="<h3>⚖ Film Comparison</h3>";
  h+="<div class='grid g2' style='margin-top:12px;max-height:70vh;overflow:auto'>";
  sel.forEach(f=>{
    const be=breakevenWW(f);
    const mult=boMult(f), legs=boLegs(f);
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):f.quality.aud;
    const crit=f.criticAvg!=null?f.criticAvg:f.quality.critic;
    const sp=boSplit(f);
    const verdict = f.streamingOriginal? "streaming original" :
      f.ww>=be*1.6? "SMASH" : f.ww>=be? "HIT" : f.ww>=be*0.75? "soft" : "FLOP";
    h+="<div class='card'><div style='border-bottom:2px solid "+(verdict==="SMASH"?"var(--green)":verdict==="HIT"?"var(--gold2)":verdict==="soft"?"var(--gold)":"var(--red)")+"';padding-bottom:8px;margin-bottom:8px>"+
      "<b>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</b> <span class='tag'>"+verdict+"</span></div>"+
      "<div class='cost-line'><span>Budget</span><b>"+fmtM(f.budget)+"</b></div>"+
      "<div class='cost-line'><span>Opening</span><b>"+fmtG(f.opening||0)+"</b></div>"+
      "<div class='cost-line'><span>Domestic</span><b>"+fmtG(sp.dom)+"</b></div>"+
      "<div class='cost-line'><span>Intl</span><b>"+fmtG(sp.intl)+"</b></div>"+
      "<div class='cost-line'><span>Worldwide</span><b>"+fmtG(sp.ww)+"</b></div>"+
      "<div class='cost-line'><span>Multiplier</span><b>"+mult+"×</b></div>"+
      "<div class='cost-line'><span>Legs</span><b>"+legs+"×</b></div>"+
      "<div class='cost-line'><span>Critics</span><b>"+crit+"%</b></div>"+
      "<div class='cost-line'><span>Audience</span><b>"+aud+"%</b></div>"+
      "<div class='cost-line'><span>Profit</span><b class='"+(f.profit>=0?"pos":"neg")+"'>"+(f.profit>=0?"+":"")+fmtM(f.profit||0)+"</b></div>"+
      "<div class='weekly-gross-chart' style='margin-top:8px'>"+(f.weekly||[]).slice(-12).map(x=>"<div class='wg' style='height:"+Math.max(4,x.gross/(f.opening||1)*100)+"%' title='"+fmtG(x.gross)+"'></div>").join("")+"</div>"+
      "</div>";
  });
  h+="</div>";
  openModal(h,{onClose:()=>{G.compareSel=[]; render();}});
}

/* Rival studio profile modal */
function rivalProfileModal(r){
  const style=r.style;
  const meta={
    tentpole:{strategy:"Blockbusters — summer/holiday corridors", strength:"Tentpole openings, corridor dating", weakness:"Prestige seasons, crowded weekends"},
    prestige:{strategy:"Prestige — awards + festivals", strength:"Reviews, awards momentum", weakness:"Tentpole corridors, small openings"},
    balanced:{strategy:"Volume — a bit of everything", strength:"Full slate, steady share", weakness:"No killer edge anywhere"}
  }[style]||{strategy:style, strength:"—", weakness:"—"};
  const up=(r.slate||[]).filter(f=>!f.dead&&!f.live&&f.week>G.week).sort((a,b)=>a.week-b.week).slice(0,6);
  const done=(r.slate||[]).filter(f=>(f.live||f.dead)&&(f.opening||0)>0).sort((a,b)=>b.week-a.week).slice(0,6);
  const all=[{n:"You",ww:G.films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0)}].concat(G.rivals.map(x=>({n:x.name,ww:x.ytd||0})));
  const tot=all.reduce((a,x)=>a+x.ww,0)||1;
  const rank=all.slice().sort((a,b)=>b.ww-a.ww).findIndex(x=>x.n===r.name)+1;
  const share=Math.round((r.ytd||0)/tot*100);
  const cash=r.cash||0, debt=r.debt||0, rep=r.rep||25;
  let h="<h3>🏢 "+esc(r.name)+" <span class='tiny' style='color:"+(r.color||"#fff")+"'>●</span></h3>"+
    "<div class='tiny muted'>"+esc(r.blurb||"")+" · #"+rank+" market share ("+share+"%) · rep "+rep+" · cash "+fmtM(cash)+" · debt "+fmtM(debt)+"</div>";
  h+="<div class='card' style='margin-top:12px'><b class='small'>Strategy</b><div class='tiny muted'>"+meta.strategy+"</div></div>";
  h+="<div class='card'><b class='small'>Strength / Weakness</b>"+
    "<div class='cost-line'><span>✅ Strength</span><b class='pos'>"+meta.strength+"</b></div>"+
    "<div class='cost-line'><span>❌ Weakness</span><b class='neg'>"+meta.weakness+"</b></div></div>";
  h+="<div class='card' style='margin-top:8px'><b class='small'>Current slate ("+up.length+")</b>"+
    "<div class='tiny muted'>"+(up.length?up.map(f=>"• "+esc(f.title)+" — "+DATA.GENRES[f.genre].name+"/"+f.scale+", "+dateLabel(f.week)).join("<br>"):"nothing dated")+"</div></div>";
  h+="<div class='card' style='margin-top:8px'><b class='small'>Recent releases ("+done.length+")</b>"+
    "<div class='tiny muted'>"+(done.length?done.map(f=>"• "+esc(f.title)+" — "+fmtG(f.dom||0)+" dom"+((f.dom||0)>=(f.opening||0)*2.5?" 🔥":"")).join("<br>"):"no releases yet")+"</div></div>";
  h+="<div class='card' style='margin-top:8px'><b class='small'>Head-to-head vs you</b>"+
    "<div class='cost-line'><span>Their YTD</span><b>"+fmtM(r.ytd||0)+"</b></div>"+
    "<div class='cost-line'><span>Your YTD</span><b>"+fmtM(G.films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0))+"</b></div>"+
    "<div class='cost-line'><span>Share gap</span><b class='"+(r.ytd>0?"neg":"pos")+"'>"+(r.ytd>0?"−":"+")+Math.abs(Math.round((r.ytd||0)/Math.max(1,(r.ytd||0)+G.films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0))*100))+"%</b></div></div>";
  openModal(h,{onClose:()=>{}});
}
}
   read off the actual opening and legs. Same card pre-release (screening) and live. */
function demoPanel(f){
  let pr;
  try{ pr=demoProfile(f); }catch(e){ return ""; }
  let h="<div class='card' style='margin:8px 0 0'><b class='small'>👥 Audience profile</b><div class='tiny muted'>Reach index "+pr.potential+"/100 · converts the core at "+pr.conversion+" · retains at "+pr.retention+".</div>";
  pr.rows.forEach(r=>{
    h+="<div class='cost-line'><span>"+r.icon+" "+r.name+" <span class='tiny muted'>"+r.size+"% of market</span></span><b class='"+(r.appeal>=70?"pos":r.appeal<45?"neg":"")+"'>"+r.appeal+"</b></div>";
  });
  h+="<div class='tiny muted' style='margin-top:4px'>Strongest: <b class='pos'>"+pr.strongest.icon+" "+pr.strongest.name+"</b> · weakest: "+pr.weakest.icon+" "+pr.weakest.name+". "+
    "Aim pitch angles + campaign channels at the strongest crowd — matched channels hit ×1.5 hype.</div></div>";
  return h;
}
/* Social buzz panel: hype/memes/theories/controversy/sentiment from the film's
   real social state (tickBuzz writes it) plus live flags. Buzz nudges move
   openings, so this is signal — not decoration. */
function socialPanel(f){
  const s=f.social||{hype:0, memes:0, theories:0, controversy:0};
  const pos=(s.hype||0)+(s.memes?2:0)+(s.theories?1:0), neg=(s.controversy||0)+((f.cast||[]).some(c=>c.scandal>0)?1:0)+(f.reviewBombed?2:0);
  const sent=pos-neg>=2?"Positive":neg-pos>=2?"Negative":"Mixed";
  return "<div class='card' style='margin:8px 0 0'><b class='small'>📣 Social buzz</b>"+
    "<div class='cost-line'><span>Hype</span><b class='"+(pos>neg?"pos":neg>pos?"neg":"")+"'>"+sent+" ("+pos+"👍 / "+neg+"👎)</b></div>"+
    (s.memes?"<div class='tiny pos'>🐸 Meme machine — fan theories everywhere.</div>":"")+
    (s.theories&&!s.memes?"<div class='tiny pos'>🔍 Fan theories brewing.</div>":"")+
    (s.controversy?"<div class='tiny neg'>🔥 Controversy level "+s.controversy+" — mainstream is watching.</div>":"")+
    ((f.cast||[]).some(c=>c.scandal>0)?"<div class='tiny neg'>📰 Star scandal is the conversation.</div>":"")+
    (f.reviewBombed?"<div class='tiny neg'>🍅 Brigaded score under review.</div>":"")+
    ((!s.memes&&!s.controversy)?"<div class='tiny muted'>Quiet feeds. Big openings, beloved films and hot casts make noise.</div>":"")+"</div>";
}
function topRegionLine(f){
  try{
    let regs=f.regions; if(!regs||!regs.length) regs=regionSplit(f);
    const top=regs.slice().sort((a,b)=>b.gross-a.gross)[0];
    if(!top) return "";
    return "<div class='tiny muted'>Top region: "+top.emoji+" "+top.name+" "+fmtG(top.gross)+" ("+top.share+"% WW · aud "+top.aud+")</div>";
  }catch(e){ return ""; }
}
function viewBoxOffice(){
  let h="";
  const chart=weeklyChart();
  h+="<div class='section-title'>This week's chart</div><div class='card chart-bars'>";
  if(!chart.length) h+="<div class='muted small'>Nothing in theaters — the multiplex is a graveyard.</div>";
  const max=Math.max(1,...chart.map(c=>c.gross));
  chart.forEach((c,i)=>{
    h+="<div class='chart-bar'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(c.mine?"🎬 ":"")+esc(c.title)+(c.mine?"":" <span class='tiny muted'>— "+esc(c.studio||"")+"</span>")+"</div>"+
      "<div class='cb-sub'>"+DATA.GENRES[c.genre].name+" · wk "+c.weeksOut+"</div></div>"+
      "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(7,c.gross/max*100)+"%;background:"+(c.mine?"linear-gradient(90deg,#f5b942,#ffd479)":(c.color||"#4a5570"))+"'>"+fmtG(c.gross)+"</div></div></div>";
  });
  h+="</div>";
h+="<div class='section-title'>Rival studios ("+G.rivals.length+")</div><div class='tiny muted' style='margin:-4px 0 8px'>They date corridors by style, blink when you out-muscle their weekend, poach hot free talent, outbid you on sports, and launch streamers. Slates re-seed yearly; heat follows genre trends like yours.</div><div class='grid g3'>"+
     G.rivals.map(rivalProfile).join("")+"</div>";
  h+=regionSummaryPanel();
  const live=activeFilms();
  h+="<div class='section-title'>Your films in theaters ("+live.length+")</div>";
  if(!live.length) h+="<div class='card muted small'>No active runs. A film without a release date earns nothing.</div>";
  for(const f of live){
    const be=breakevenWW(f);
    const projWW=(f.dom/(1-DATA.GENRES[f.genre].intlShare));
    const sp=boSplit(f), mult=boMult(f), legs=boLegs(f);
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):f.quality.aud;
    const crit=f.criticAvg!=null?f.criticAvg:f.quality.critic;
    h+="<div class='card'><div class='spread'><div><b>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</b><div class='tiny muted'>wk "+f.weeksOut+" out · opened "+fmtG(f.opening)+" · "+scoreBadge(f.quality.overall)+"</div></div>"+
      "<div style='text-align:right'><b class='gold'>"+fmtG(f.dom)+"</b><div class='tiny muted'>domestic</div></div></div>"+
      "<div class='stat-hero' style='margin-top:8px'>"+
        statCard(fmtG(f.opening),"Opening wknd")+
        statCard(fmtG(sp.dom),"Domestic")+
        statCard(fmtG(sp.intl),"International"+(f.presales?" (pre-sold)":""))+
        statCard(fmtG(sp.ww),"Worldwide")+
        statCard(mult+"×","Multiplier",0,"Total WW ÷ opening weekend. >2.5× = strong legs (animation, horror). <2× = front-loaded (concert, horror).")+
        statCard(legs+"×","Legs",0,"Projected total ÷ opening. Driven by quality, genre, audience score. Horror ~1.5×, Animation ~3×.")+
        statCard(crit+"%","Critics",0,"Named critic consensus (5 reviewers). Higher = better awards odds, stronger streaming appetite.")+
        statCard(aud+"%","Audience · WOM",0,"Audience score (Word of Mouth). Drives legs & streaming. Review bombing tanks this.")+
      "</div>"+
      "<div class='weekly-gross-chart'>"+f.weekly.slice(-12).map(x=>"<div class='wg' style='height:"+Math.max(4,x.gross/f.opening*100)+"%' title='"+fmtG(x.gross)+"'></div>").join("")+"</div>"+
      "<div class='tiny muted' style='margin-top:4px'>Weekly rentals (53% dom, paid weekly): "+f.weekly.slice(-6).map(x=>fmtG(x.gross*0.53)).join(" · ")+"</div>"+
      "<div class='spread small' style='margin-top:6px'><span class='muted'>Tracking ≈ "+fmtG(projWW)+" WW vs "+fmtG(be)+" breakeven · run health "+Math.round(clamp((f.weekly.length?f.weekly[f.weekly.length-1].gross:0)/Math.max(1,f.opening)*100,0,100))+"% of opening</span>"+
      "<span class='"+(projWW>=be?"pos":"neg")+"'>"+(projWW>=be?"on pace to profit":"below breakeven")+"</span></div>"+
      "<div class='card' style='margin:8px 0 0'><b class='small'>Why is this performing this way?</b><div style='margin-top:4px'>"+boWhy(f)+"</div></div>"+
      regionPanel(f)+demoPanel(f)+socialPanel(f)+
      (f.reviewBombed? "<div class='card' style='margin:6px 0;border-left:3px solid var(--red);padding:8px 10px'><b class='neg small'>🍅 REVIEW BOMBING in progress</b><div class='tiny muted'>Audience score has taken −"+f.reviewBombed+" pts from brigading. "+(f.bombCountered? "Your fan-activation blunted the worst of it.":"Ride it out, or let counter-campaigns do their work next time.")+"</div></div>":"")+
      (G.piracy>=45? "<div class='tiny neg' style='margin:2px 0'>🏴‍☠️ Piracy is draining this run (−"+Math.round(clamp(G.piracy/100,0,1)*(DATA.PIRACY?DATA.PIRACY.maxGrossDamage:0.1)*100)+"% weekly gross).</div>":"")+
      scoreSplit(f)+
      "<div class='row' style='margin-top:4px'><button class='btn btn-sm btn-ghost' data-reviews='"+f.id+"'>🗞 Read the reviews</button></div>"+
      "<div class='tiny' style='margin-top:4px'>💰 Rentals received to date: <b class='gold'>"+fmtM(f.rentalsDom||0)+"</b> <span class='muted'>(~53% of domestic gross, paid weekly)</span>"+(f.presales?" · <span class='muted'>intl pre-sold</span>":"")+"</div></div>";
  }
  const lib=G.films.slice().sort((a,b)=>(b.ww||0)-(a.ww||0));
  const compareSel = G.compareSel || [];
  h+="<div class='spread'><div class='section-title'>Library ("+lib.length+")</div>"+
    (compareSel.length>=2? "<button class='btn btn-sm btn-primary' id='btnCompareFilms'>⚖ Compare "+compareSel.length+" films</button>" : "")+"</div>";
  if(!lib.length) h+="<div class='card muted small'>Your trophy shelf is empty. For now.</div>";
  h+="<div class='card'>";
  lib.slice(0,15).forEach(f=>{
    const be=f.ww? breakevenWW(f):1;
    const verdict = f.streamingOriginal? "<span class='tag purple'>streaming original</span>" :
      f.ww>=be*1.6? "<span class='tag green'>SMASH</span>" : f.ww>=be? "<span class='tag green'>HIT</span>" :
      f.ww>=be*0.75? "<span class='tag gold'>soft</span>" : "<span class='tag red'>FLOP</span>";
    const isSel = compareSel.includes(f.id);
    h+="<div class='film-row"+(isSel?" sel":"")+"' data-film-id='"+f.id+"'><div style='display:flex;align-items:center;gap:8px'><input type='checkbox' "+(isSel?"checked":"")+" class='film-cb' data-fid='"+f.id+"' style='transform:scale(1.2)'>"+
      "<b>"+esc(f.title)+"</b> "+verdict+" "+
      ((f.awards&&f.awards.length)?"🏆 "+f.awards.join(" · "):"")+
      ((f.reviews&&f.reviews.length)?" <button class='btn btn-sm btn-ghost' data-reviews='"+f.id+"'>🗞 "+(f.criticAvg||0)+"%</button>":"")+
      "<div class='tiny muted'>"+DATA.GENRES[f.genre].name+" · "+fmtM(f.budget)+" budget · "+fmtG(f.ww||0)+" WW"+
      (f.soldTo?" · licensed to "+f.soldTo:"")+(f.onOwn?" · on your platform":"")+(f.dayAndDate?" · 🎞 day-and-date":"")+" · "+(DATA.window(f.window||"45").name)+"</div>"+
      (f.streamingOriginal?"":"<div class='tiny muted'>Opened "+fmtG(f.opening||0)+" · mult "+boMult(f)+"× · legs "+boLegs(f)+"× · critics "+(f.criticAvg!=null?f.criticAvg:(f.quality?f.quality.critic:"—"))+"% · audience "+((typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:"—"))+"%</div>"+
      (f.streamingOriginal?"":topRegionLine(f)))+"</div>"+
      "<div style='text-align:right'><b class='"+(f.profit>=0?"pos":"neg")+"'>"+(f.profit>=0?"+":"")+fmtM(f.profit||0)+"</b><div class='tiny muted'>net</div>"+
      (G.streamer && !f.streamingOriginal && !f.soldTo && !f.onOwn && !f.inTheaters? "<button class='btn btn-sm btn-alt' style='margin-top:4px' data-movestr='"+f.id+"'>📱 → your platform</button>":"")+
      (typeof canRerelease==="function" && canRerelease(f)? "<button class='btn btn-xs btn-alt' style='margin-top:4px' data-rerelease='"+f.id+"'>🎟 Re-release</button>":"")+
      (typeof canReboot==="function" && canReboot(f)? "<button class='btn btn-xs btn-alt' style='margin-top:4px' data-reboot='"+f.id+"'>🔁 Reboot</button>":"")+
      (!f.streamingOriginal && !f.inTheaters && !f.directorsCut && f.ww>=120? "<button class='btn btn-xs btn-alt' style='margin-top:4px' data-cut='"+f.id+"'>✂ Director's Cut</button>":"")+
      "</div></div>";
  });
  h+="</div>";
  return h;
}

/* ═══════════ VIEW: ott ═══════════ */
/* Streaming market dashboard: platform subs/ARPU/churn/spend/revenue/share
   derived from real deals, plus recent signings. Estimates labeled as such. */
function streamMarketBoard(){
  let rows;
  try{ rows=platStats(); }catch(e){ return ""; }
  const max=Math.max(1,...rows.map(r=>r.subs));
  let h="<div class='section-title'>Streaming market</div><div class='grid g2'>";
  rows.forEach(r=>{
    h+="<div class='card'><div class='spread'><div><b>"+esc(r.name)+"</b> "+(r.mine?"<span class='tag purple'>yours</span>":"<span class='tag'>"+r.share+"% share</span>")+"</div>"+
      "<b class='gold'>"+r.subs.toFixed(1)+"M subs</b></div>"+
      "<div style='margin:6px 0'>"+meter(r.subs,Math.max(max,1))+"</div>"+
      "<div class='cost-line'><span>ARPU</span><b>$"+r.arpu.toFixed(2)+"/wk</b></div>"+
      "<div class='cost-line'><span>Churn</span><b>"+r.churn.toFixed(2)+"%/wk</b></div>"+
      "<div class='cost-line'><span>Content spend (your deals)</span><b>"+fmtM(r.spend)+"</b></div>"+
      "<div class='cost-line'><span>Revenue (est.)</span><b class='pos'>+"+fmtM(r.revenue)+"/wk</b></div>"+
      "<div class='cost-line'><span>Library</span><b>"+r.titles+" titles · "+r.exclusives+" exclusives · "+r.seasons+" seasons</b></div>"+
      (r.blurb?"<div class='tiny muted'>"+r.blurb+"</div>":"")+"</div>";
  });
  h+="</div>";
  let signs;
  try{ signs=recentSignings(); }catch(e){ signs=[]; }
  h+="<div class='card' style='margin-top:8px'><b class='small'>Recent signings</b>"+
    (signs.length?signs.map(s=>"<div class='cost-line'><span>“"+esc(s.title)+"” → "+esc(s.to)+"</span><b>"+fmtM(s.value)+" "+s.kind+"</b></div>").join(""):"<div class='tiny muted'>No platform deals yet — finish a film and shop it.</div>")+"</div>";
  return h;
}
function viewOTT(){
  let h="";
  try{ h+=streamMarketBoard(); }catch(e){}
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
    else h+="<div class='small muted' style='margin-top:6px'>"+(s.status==="ended"?"Ended":s.status==="renewal_pending"?"Renewal offer pending":"Between seasons")+(last?" · last season buzz "+last.viewership+"/100":"")+"</div>";
    if(last) h+="<div style='margin-top:6px'>"+meter(last.viewership,100)+"</div>";
    h+="<div class='tiny muted' style='margin-top:6px'>✍️ "+(s.showrunner?esc(s.showrunner.name):"no showrunner")+" · "+(s.cast||[]).length+" cast · season budget "+fmtM(s.budget)+
      " · earned "+fmtM((s.seasons||[]).reduce((a,x)=>a+(x.license||0),0))+"</div>";
    (s.seasons||[]).slice(-3).forEach(y=>{
      h+="<div class='cost-line'><span>S"+y.num+" · "+s.eps+" eps · "+fmtM(y.license)+"</span><b class='tiny'>crit "+(y.critic||"—")+" · aud "+(y.audience||y.viewership||"—")+" · buzz "+(y.viewership||0)+"</b></div>";
    });
    const canSpin=(s.seasons||[]).length>=2&&(s.seasons||[]).some(x=>(x.viewership||0)>=58);
    h+="<div class='row' style='margin-top:8px'>"+
      (s.status!=="ended"?"<button class='btn btn-sm btn-danger' data-cancel-series='"+s.id+"'>✕ Cancel series</button>":"")+
      (canSpin?"<button class='btn btn-sm btn-alt' data-spinoff-series='"+s.id+"'>🎬 Film continuation</button>":"")+
      "</div>";
    h+="</div>";
  }
  // YOUR OWN STREAMER (v3)
  h+="<div class='section-title'>✨ Your platform</div>";
  if(!G.streamer){
    h+="<div class='card'><h4>📱 Launch your own streamer</h4>"+
      "<p class='small muted'>Build a direct-to-consumer platform: $250M at reputation ≥40. Subscribers pay $0.5/sub/wk, but your subscriber ceiling is built from your library, franchises, shows and sports rights. Starve it and subs bleed (0.8%/wk churn).</p>"+
      "<button class='btn btn-sm "+(G.studio.rep>=40&&G.studio.cash>=250?"btn-primary":"btn-ghost")+"' id='launchStreamer'>"+(G.studio.rep>=40? "🚀 Launch for $250M":"Launch (needs rep 40+ · current "+Math.round(G.studio.rep)+")")+"</button></div>";
  }else{
    const st=G.streamer;
    const ceil=streamerCeiling();
    h+="<div class='card' style='border-left:3px solid var(--purple)'><div class='spread'><div><b>📱 "+esc(st.name)+"</b> <span class='tag purple'>your platform</span></div>"+
      "<div style='text-align:right'><b class='gold'>"+st.subs.toFixed(1)+"M subs</b><div class='tiny muted'>+$"+st.income+"/wk</div></div></div>"+
      "<div class='tiny muted' style='margin-top:6px'>Content ceiling: <b>"+ceil+"M</b> · churn "+((st.churn||0.008)*100).toFixed(1)+"%/wk · sport power "+st.sportsPower.toFixed(1)+"</div>"+
      "<div style='margin-top:6px'>"+meter(st.subs, Math.max(ceil,1))+"</div>"+
      (st.crackdown>0? "<div class='tiny neg' style='margin-top:6px'>🔐 Password crackdown active — churn doubled for "+st.crackdown+" more weeks.</div>":"")+
      (function(){ if(typeof euShareOf!=="function"||!DATA.GLOBAL) return "";
        const r=euShareOf(); if(!r.total) return "";
        const ok=r.share>=DATA.GLOBAL.eu.quota;
        const note = st.euFreeze>0? " — GROWTH FROZEN "+st.euFreeze+" wks" : (ok? " ✓ compliant" : " — risk of fines");
        return "<div class='tiny " + (ok?"pos":"neg") + "' style='margin-top:6px'>🇪🇺 EU content quota: "+Math.round(r.share*100)+"% European works (need "+Math.round(DATA.GLOBAL.eu.quota*100)+"%"+note+"). London/Toronto/Queensland shoots &amp; foreign-language films count.</div>";
      })()+
      "<div class='tiny muted' style='margin-top:6px'>Feed it: move finished films onto the platform, or win live sports rights.</div></div>";
    h+="<div class='section-title'>💸 Subscription tiers</div><div class='grid g2'>";
    DATA.TIERS.forEach(function(t){
      const on=(st.tier||"premium")===t.id;
      h+="<div class='card "+(on?"tier-on":"")+"'><div class='spread'><b>"+(t.id==="ads"?"📺 ":"✨ ")+t.name+"</b>"+(on?"<span class='tag green'>✓ live</span>":"")+"</div>"+
        "<div class='tiny muted' style='margin:4px 0 8px'>"+t.desc+"</div>"+
        "<div class='cost-line'><span>Revenue / sub / wk</span><b>$"+t.arpu.toFixed(2)+"</b></div>"+
        "<div class='cost-line'><span>Ceiling multiplier</span><b>×"+t.ceil.toFixed(2)+"</b></div>"+
        "<div class='cost-line'><span>Base churn</span><b>"+(t.churn*100).toFixed(1)+"%/wk</b></div>"+
        (on? "" : "<button class='btn btn-sm btn-primary' style='margin-top:8px' data-tier='"+t.id+"'>"+(t.cost? "Switch — "+fmtM(t.cost):"Switch")+"</button>")+
        "</div>";
    });
    h+="</div>";
  }
  // LIVE SPORTS (v3)
  const won=G.sportsWon||[];
  h+="<div class='section-title'>🏆 Live sports rights"+(won.length? " · "+won.length+" held":"")+"</div>";
  if(!G.streamer){ h+="<div class='card muted small'>You need a live platform to carry sports. Launch a streamer first.</div>"; }
  else if(G.pendingSports){ /* handled by the modal opened after tick */ }
  else {
    h+="<div class='card'><div class='tiny muted' style='margin-bottom:6px'>Quarterly sealed-bid auctions (weeks 13/26/39/52) for soccer, hoops, racing, fights, wrestling, esports and cricket ($70–170M). Winning bumps subscribers and raises your content ceiling; the sport power decays ~1.5%/wk.</div>";
    const held=DATA.SPORTS.filter(s=>won.includes(s.id));
    if(held.length){ held.forEach(s=>{ const d=(G.sportsDeals||{})[s.id]||{base:120, subBump:4.5}; const e=sportEcon({id:s.id, base:d.base, subBump:d.subBump});
      h+="<div class='cost-line'><span>"+s.icon+" "+s.name+" <span class='tiny muted'>won "+fmtM(d.bid||d.base)+"</span></span><b class='tiny'>"+e.dur+"w · ~"+e.audience+"M viewers · +"+fmtM(e.ad)+"/wk ads · ~"+fmtM(e.revenue)+" value</b></div>"; }); }
    else h+="<div class='tiny muted'>No sports rights yet. An auction will arrive near week 13, 26, 39 or 52.</div></div>";
    if(held.length) h+="</div>";
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
  const ft=finTrail(), fc2=finCommit();
  const mdOnce=maxDebt(), headroom=Math.round((mdOnce-st.debt)*10)/10; // perf: one O(films) pass per render
  let h="<div class='stat-hero'>"+
    statCard(fmtM(st.cash),"Cash","var(--gold2)")+
    statCard("+"+fmtM(ft.R),"Revenue (trail)")+
    statCard(fmtM(ft.E),"Expenses (trail)")+
    statCard((ft.P>=0?"+":"")+fmtM(ft.P),"Profit (trail)",ft.P>=0?"var(--green)":"var(--red)")+
    statCard(fmtM(st.debt),"Debt","var(--red)")+
    statCard(fmtM(fc2.intr)+"/wk","Interest")+
  "</div>";
  h+="<div class='section-title'>Actual — trailing weeks</div>";
  h+="<div class='grid g2'><div class='card'><b>Revenue split</b>"+
    "<div class='cost-line'><span>🎬 Box office</span><b class='pos'>+"+fmtM(ft.rev.boxoffice)+"</b></div>"+
    "<div class='cost-line'><span>📺 Streaming (deals + platform + pay-1)</span><b class='pos'>+"+fmtM(ft.rev.streaming)+"</b></div>"+
    "<div class='cost-line'><span>📚 Licensing (series + library + PVOD + video)</span><b class='pos'>+"+fmtM(ft.rev.licensing)+"</b></div>"+
    "<div class='cost-line'><span>🏰 Merch / empire</span><b class='pos'>+"+fmtM(ft.rev.merch)+"</b></div>"+
    "<div class='cost-line'><span>❓ Other (music + incentives + pre-sales)</span><b class='pos'>+"+fmtM(ft.rev.other)+"</b></div></div>"+
    "<div class='card'><b>Expense split</b>"+
    "<div class='cost-line'><span>🎬 Production + development</span><b class='neg'>"+fmtM(ft.exp.prod)+"</b></div>"+
    "<div class='cost-line'><span>📣 Marketing</span><b class='neg'>"+fmtM(ft.exp.mkt)+"</b></div>"+
    "<div class='cost-line'><span>🌟 Talent</span><b class='neg'>"+fmtM(ft.exp.talent)+"</b></div>"+
    "<div class='cost-line'><span>🏛 Overhead</span><b class='neg'>"+fmtM(ft.exp.overhead)+"</b></div>"+
    "<div class='cost-line'><span>🏦 Interest</span><b class='neg'>"+fmtM(ft.exp.interest)+"</b></div>"+
    "<div class='cost-line'><span>🏗 Studio / empire builds</span><b class='neg'>"+fmtM(ft.exp.studio)+"</b></div></div></div>";
  h+="<div class='section-title'>Committed — obligations on the books</div>";
  h+="<div class='card'><div class='cost-line'><span>🎬 Production remaining (budget − spent)</span><b>"+fmtM(fc2.prod)+"</b></div>"+
    "<div class='cost-line'><span>📣 Marketing due on dated releases</span><b>"+fmtM(fc2.mkt)+"</b></div>"+
    "<div class='cost-line'><span>🏦 Debt stack (loans + mezz + investor)</span><b class='neg'>"+fmtM(fc2.debt)+"</b></div>"+
    "<div class='cost-line'><span>🏛 Overhead run-rate</span><b>"+fmtM(fc2.oh)+"/wk</b></div>"+
    "<div class='cost-line'><span>🏦 Interest run-rate</span><b>"+fmtM(fc2.intr)+"/wk</b></div>"+
    "<div class='cost-line'><span>Credit headroom</span><b class='"+(headroom>=0?"pos":"neg")+"'>"+fmtM(headroom)+"</b></div></div>";
  h+=plCard();
  h+="<div class='grid g2'><div class='card'><h4>🏦 Credit facility</h4>"+
    "<p class='tiny muted'>Weekly interest 0.18% (≈9%/yr). Borrow to bridge production, but breakevens don't care about your loans.</p>"+
    "<div class='loan-row'><div class='small muted' style='margin:8px 0 4px'>Borrow</div><input type='range' id='fnLoan' min='10' max='"+Math.max(10,Math.round(headroom))+"' step='10' value='"+Math.round(Math.max(10,headroom/2))+"'><div class='spread'><b id='fnLoanV'></b><button class='btn btn-sm btn-primary' id='fnLoanGo'>Take loan</button></div></div>"+
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
  // 12-week cash-flow forecast
  const fc=forecastProject();
  h+="<div class='section-title'>Projected — 12-week cash-flow forecast</div><div class='card'><div class='tiny muted' style='margin-bottom:6px'>PROJECTED from locked-in runs, burns, dated P&A, overhead, interest, streamer (same engine math as the tick — no new formulas).</div><div class='forecast-bars'>"+
    fc.rows.map(r=>"<div class='fg' title='"+dateLabel(r.week)+": "+(r.net>=0?"+":"")+fmtM(r.net)+" → "+fmtM(r.cash)+"'><i style='height:"+Math.max(4,clamp((fc.start? r.cash/fc.start:1),0,1)*100)+"%'></i><span>"+woyOf(r.week)+"</span></div>").join("")+
    "</div><div class='tiny muted' style='margin-top:4px'>Projected cash in 12 wks: <b class='"+(fc.rows.length&&fc.rows[fc.rows.length-1].cash>=0?"pos":"neg")+"'>"+fmtM(fc.rows.length?fc.rows[fc.rows.length-1].cash:st.cash)+"</b></div></div>";
  try{ h+="<div class='section-title'>Projected — week detail</div>"+forecastCard(); }catch(e){}
  // mezzanine + IPO
  const md=st.mezzDebt||0;
  h+="<div class='section-title'>🪜 Mezzanine & IPO</div><div class='grid g2'>";
  h+="<div class='card'><h4>🪜 Mezzanine debt</h4><p class='tiny muted'>Emergency money at 0.5%/wk interest (≈26%/yr) — expensive, but no credit-line cap. Only for a real crunch.</p>"+
     "<div class='loan-row'><div class='small muted' style='margin:8px 0 4px'>Borrow</div><input type='range' id='fnMezz' min='10' max='200' step='10' value='50'><div class='spread'><b id='fnMezzV'></b><button class='btn btn-sm btn-alt' id='fnMezzGo'>Take mezzanine</button></div></div>"+
     (md>0.5?"<div class='loan-row'><div class='small muted' style='margin:10px 0 4px'>Repay ("+fmtM(md)+" owed)</div><input type='range' id='fnMezzRepay' min='1' max='"+Math.max(1,Math.min(Math.round(md),Math.floor(st.cash)))+"' value='"+Math.max(1,Math.min(Math.round(md/2),Math.floor(st.cash)))+"'><div class='spread'><b id='fnMezzRepayV'></b><button class='btn btn-sm btn-primary' id='fnMezzRepayGo'>Repay</button></div></div>":"")+
     "</div>";
  if(G.public){
    const P=G.public;
    const hist=(P.history||[P.price]).slice(-40);
    const mn=Math.min.apply(null,hist), mx=Math.max.apply(null,hist);
    const spark=hist.map(function(v){ return "<i style='height:"+Math.max(6,(mx>mn? (v-mn)/(mx-mn):0.5)*100)+"%'></i>"; }).join("");
    const vsIpo=(P.price/DATA.MARKET.ipoPrice-1)*100;
    const le=P.lastEarnings;
    h+="<div class='card'><div class='spread'><h4 style='margin:0'>📊 "+esc(G.studio.name)+" <span class='tiny muted'>· listed</span></h4>"+
      "<div style='text-align:right'><b class='"+(vsIpo>=0?"pos":"neg")+"' style='font-size:20px'>$"+P.price.toFixed(2)+"</b>"+
      "<div class='tiny "+(vsIpo>=0?"pos":"neg")+"'>"+(vsIpo>=0?"+":"")+vsIpo.toFixed(1)+"% vs IPO</div></div></div>"+
      "<div class='stock-spark'>"+spark+"</div>"+
      "<div class='cost-line'><span>Market cap</span><b>"+fmtM(marketCap())+"</b></div>"+
      "<div class='cost-line'><span>Shares outstanding</span><b>"+P.shares+"M</b></div>"+
      "<div class='cost-line'><span>Analyst rating</span><b class='"+(/Buy/.test(P.rating||"")?"pos":/Sell/.test(P.rating||"")?"neg":"")+"'>"+(P.rating||"Hold")+"</b></div>"+
      "<div class='cost-line'><span>Downgrade streak</span><b class='"+((P.downgrades||0)>=2?"neg":"")+"'>"+(P.downgrades||0)+"</b></div>"+
      "<div class='cost-line'><span>Quarter-to-date net</span><b class='"+((P.quarterNet||0)>=0?"pos":"neg")+"'>"+((P.quarterNet||0)>=0?"+":"")+fmtM(P.quarterNet||0)+"</b></div>"+
      (le? "<div class='tiny muted' style='margin-top:6px'>Last call ("+dateLabel(le.week)+"): "+(le.beat?"beat":"missed")+" the street ("+fmtM(le.q)+" vs "+fmtM(le.expectation)+") · "+esc(le.analyst)+" → "+le.rating+"</div>":"")+
      "<div class='tiny muted' style='margin-top:6px'>Earnings calls land in weeks 13 / 26 / 39 / 52. Beat the street and the stock runs; miss twice and the analysts downgrade you.</div>"+
      "<div class='loan-row' style='margin-top:8px'><div class='small muted' style='margin:6px 0 4px'>Secondary offering (sell new shares)</div>"+
      "<input type='range' id='fnSec' min='1' max='10' step='1' value='2'><div class='spread'><b id='fnSecV'></b>"+
      "<button class='btn btn-sm btn-alt' id='fnSecGo'>🏛 Raise capital</button></div></div>"+
      "</div>";
  }else{
    h+="<div class='card'><h4>📊 IPO</h4><p class='tiny muted'>Raise $400M by going public. Requires reputation ≥60. Shareholders punish loss-making quarters.</p>"+
      "<button class='btn btn-sm "+(st.rep>=60?"btn-primary":"btn-ghost")+"' id='fnIpo'>"+(st.rep>=60?"Go public — $400M":"Go public (needs rep 60+ · current "+Math.round(st.rep)+")")+"</button></div>";
  }
  h+="</div>";
  /* v5: M&A desk — quarterly rotating acquisition offers */
  {
    const offers=(G.maOffers||[]).filter(o=>o.expires>G.week);
    h+="<div class='section-title'>🏦 M&amp;A desk</div>";
    h+="<div class='tiny muted' style='margin:-4px 0 6px'>Acquire indie libraries (catalog value + royalties), mini-streamers (+subs), or distressed rival slates (you distribute, you keep the rentals). The deal book rotates quarterly.</div>";
    if(G.maLibraries) h+="<div class='tiny gold' style='margin-bottom:6px'>📚 Libraries acquired: <b>"+G.maLibraries+"</b> — +"+fmtM(G.maLibraries*(DATA.MA? DATA.MA.library.catalogEach:42))+" permanent catalog value.</div>";
    if(offers.length){
      h+="<div class='grid g3'>";
      offers.forEach(function(o){
        h+="<div class='card upg-card'><div class='u-i'>"+o.icon+"</div><div style='flex:1'><b>"+esc(o.name)+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+esc(o.blurb)+"</div>"+
          "<div class='tiny muted'>expires in "+(o.expires-G.week)+" wks</div>"+
          "<button class='btn btn-sm "+(st.cash>=o.price?"btn-primary":"")+"' data-ma='"+o.id+"' style='margin-top:8px'>Acquire — "+fmtM(o.price)+"</button></div></div>";
      });
      h+="</div>";
    }else{
      h+="<div class='card muted small'>No acquisitions on the table this quarter. The deal book refreshes every 13 weeks (weeks 1 / 14 / 27 / 40).</div>";
    }
  }
  if((G.wageInfl||1)>1.001 || (G.infl||1)>1.001){
    h+="<div class='card'><div class='tiny muted'>📈 Inflation tracker — market ≈ +"+Math.round(((G.infl||1)-1)*100)+"% vs Year 1 · <b>talent quotes +"+Math.round(((G.wageInfl||1)-1)*100)+"%</b> (wage inflation compounds harder) · lot overhead compounds +2%/yr.</div></div>";
  }
  // executives
  h+="<div class='section-title'>👔 Executive hires</div><div class='grid g3'>";
  DATA.EXECS.forEach(e=>{
    const owned=!!G.execs[e.id];
    h+="<div class='card upg-card'><div class='u-i'>"+e.icon+"</div><div style='flex:1'><b>"+e.name+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+e.blurb+"</div>"+
      (owned? "<span class='tag green'>✓ hired</span>" : "<button class='btn btn-sm "+(st.cash>=e.cost?"btn-primary":"")+"' data-exec='"+e.id+"'>"+fmtM(e.cost)+"</button>")+"</div></div>";
  });
  h+="</div>";
  h+="<div class='section-title'>Studio investments</div><div class='grid g3'>";
  DATA.UPGRADES.forEach(u=>{
    const owned=!!G.upgrades[u.id];
    h+="<div class='card upg-card'><div class='u-i'>"+u.icon+"</div><div style='flex:1'><b>"+u.name+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+u.desc+"</div>"+
      (owned? "<span class='tag green'>✓ built</span>" : "<button class='btn btn-sm "+(st.cash>=u.cost?"btn-primary":"")+"' data-upg='"+u.id+"'>"+fmtM(u.cost)+"</button>")+"</div></div>";
  });
  h+="</div>";
  try{ h+=hqBoard(st); }catch(e){}
  return h;
}
/* Headquarters: departments unifying upgrades, execs and buildable wings.
   Existing buys stay one tap away; new wings show cost/benefit/upkeep/unlocks. */
function hqBoard(st){
  let up=0; try{ up=hqUpkeep(); }catch(e){}
  let h="<div class='section-title'>🏢 Studio headquarters</div>"+
    "<div class='tiny muted' style='margin:-4px 0 6px'>One lot, eight departments. Facilities bill "+fmtM(up)+"/wk upkeep.</div><div class='grid g2'>";
  hqDepts().forEach(d=>{
    h+="<div class='card'><b>"+d.icon+" "+d.name+"</b>";
    d.items.forEach(it=>{
      const owned=it.kind==="hq"?hqOwned(it.id):(it.kind==="exec"?!!G.execs[it.id]:!!G.upgrades[it.id]);
      const reqOk=it.kind==="hq"?hqReqMet(it):true;
      h+="<div class='cost-line'><span>"+it.name+" <span class='tiny muted'>"+it.desc+(it.kind==="hq"?" Upkeep "+fmtM(it.up)+"/wk.":"")+"</span></span>"+
        (owned?"<b class='pos tiny'>✓ live</b>":
          reqOk?"<button class='btn btn-sm "+(st.cash>=it.cost?"btn-primary":"")+"' data-hqbuy='"+it.kind+":"+it.id+"'>"+fmtM(it.cost)+"</button>":
          "<b class='tiny muted'>🔒 "+(it.req.up?"needs "+it.req.up:"rep "+it.req.rep+"+")+"</b>")+"</div>";
    });
    h+="</div>";
  });
  h+="</div>";
  /* technology tree: locked / available / researching / researched */
  const activeT=(G.tech&&G.tech.active)||null;
  h+="<div class='section-title'>🔬 Technology tree</div>"+
    "<div class='tiny muted' style='margin:-4px 0 6px'>One lab slot. Research takes weeks after you pay."+(activeT?" Researching: <b>"+activeT.id+" ("+activeT.left+"w left)</b>.":" Lab idle.")+"</div><div class='grid g3'>";
  techDefs().forEach(t=>{
    const done=techDone(t.id), isActive=activeT&&activeT.id===t.id;
    const avail=!done&&!isActive&&(!t.req||techDone(t.req));
    h+="<div class='card'><b>"+t.icon+" "+t.name+"</b><div class='tiny muted' style='margin:3px 0'>"+t.benefit+"</div>"+
      "<div class='tiny muted'>"+fmtM(t.cost)+" · "+t.weeks+" wks"+(t.req?" · needs "+t.req:"")+"</div><div style='margin-top:6px'>"+
      (done?"<span class='tag green'>✓ researched — active</span>":
        isActive?"<span class='tag gold'>🔬 "+activeT.left+"w left</span>":
        avail?"<button class='btn btn-sm "+(st.cash>=t.cost?"btn-primary":"")+"' data-tech='"+t.id+"'>Research</button>":
        "<span class='tag'>🔒 needs "+t.req+"</span>")+"</div></div>";
  });
  return h+"</div>";
}

const PL_LABELS={theatrical:"🎬 Box office rentals", pvod:"🏠 Premium VOD", streaming:"📺 Streaming deals", series:"📺 Series licenses", empire:"🏰 Franchise & parks", library:"📚 Library licensing", presales:"🌍 Intl pre-sales", incentives:"🧾 Production incentives", production:"🎬 Production spend", marketing:"📣 Marketing (P&A)", talent:"🌟 Talent & fees", development:"📝 Development", overhead:"🏛 Overhead", interest:"🏦 Interest", studio:"🏗 Studio investment", streamer:"📱 Platform subs", pay1:"📺 Pay-1 TV", music:"🎵 Soundtrack", video:"📀 Home video/DTV", cofinance:"🤝 Co-finance in", other:"❓ Other"};
/* Finance rollups: read-only sums over trailing txHistory. Buckets mirror earn/spend cats. */
function finTrail(){
  const rev={boxoffice:0, streaming:0, licensing:0, merch:0, other:0}, exp={prod:0, mkt:0, talent:0, overhead:0, interest:0, studio:0, other:0};
  try{
    for(const s of (G.txHistory||[])){
      const c=s.cats||{};
      rev.boxoffice+=Math.max(0,c.theatrical||0);
      rev.streaming+=Math.max(0,(c.streaming||0)+(c.streamer||0)+(c.pay1||0));
      rev.licensing+=Math.max(0,(c.series||0)+(c.library||0)+(c.pvod||0)+(c.video||0));
      rev.merch+=Math.max(0,c.empire||0);
      rev.other+=Math.max(0,(c.music||0)+(c.other||0)+(c.incentives||0)+(c.presales||0)+(c.cofinance||0));
      exp.prod+=Math.min(0,(c.production||0)+(c.development||0));
      exp.mkt+=Math.min(0,c.marketing||0);
      exp.talent+=Math.min(0,c.talent||0);
      exp.overhead+=Math.min(0,c.overhead||0);
      exp.interest+=Math.min(0,c.interest||0);
      exp.studio+=Math.min(0,(c.studio||0)+(c.empire||0));
      exp.other+=Math.min(0,(c.other||0)+(c.financing||0)*0);
    }
  }catch(e){}
  const R=rev.boxoffice+rev.streaming+rev.licensing+rev.merch+rev.other;
  const E=-(exp.prod+exp.mkt+exp.talent+exp.overhead+exp.interest+exp.studio+exp.other);
  return {rev, exp, R:Math.round(R*10)/10, E:Math.round(E*10)/10, P:Math.round((R-E)*10)/10};
}
function finCommit(){
  let prodRemain=0, mktDue=0;
  try{
    for(const p of (G.projects||[])){
      prodRemain+=Math.max(0,(p.budget||0)-(p.spent||0));
      if(p.releaseWeek&&p.releaseWeek>=G.week) mktDue+=Math.max(0,(p.marketing||0)-(p.marketingPaid||0));
    }
    for(const s of (G.series||[])){ if(s.phase==="shoot") mktDue+=0, prodRemain+=Math.max(0,(s.budget||0)-(s.spent||0)); }
  }catch(e){}
  const debt=(G.studio.debt||0)+(G.studio.mezzDebt||0)+(G.mezz||0)+(G.investorDebt||0);
  let oh=0; try{ oh=weeklyOverhead(); }catch(e){ oh=G.studio.overhead||0; }
  let intr=0; try{ intr=(G.studio.debt||0)*interestRate()+(G.studio.mezzDebt||0)*0.005+(G.mezz||0)*0.005; }catch(e){}
  return {prod:Math.round(prodRemain*10)/10, mkt:Math.round(mktDue*10)/10, debt:Math.round(debt*10)/10, oh:Math.round(oh*10)/10, intr:Math.round(intr*10)/10};
}
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
  $$("[data-pitch]").forEach(b=>b.onclick=()=>{ beep("click"); startPitch(+b.dataset.pitch); });
  const ps=$("#btnPitchSeries"); if(ps) ps.onclick=()=>{ beep("click"); startSeriesWizard(); };
  const pf=$("#btnPitchFilm"); if(pf) pf.onclick=()=>{ beep("click"); startFilmPitchWizard(); };
  const shc=$("#btnShareCard"); if(shc) shc.onclick=function(){ shareStudioCard(); };
  const ls=$("#launchStreamer"); if(ls) ls.onclick=()=>{ if(launchStreamer()){beep("gold"); flashes(G.flash); render();} else toast("Need rep ≥40 and $250M to launch.","bad"); };
  $$("[data-sched]").forEach(b=>b.onclick=()=>{ beep("click"); startScheduling(+b.dataset.sched); });
  $$("[data-shop]").forEach(b=>b.onclick=()=>{
    shopToStreamers(+b.dataset.shop); beep("click");
    if(G.pendingAuction){ render(); auctionModal(); }
  });
  $$("[data-test]").forEach(b=>b.onclick=()=>{ beep("click"); screeningModal(+b.dataset.test); });
  $$("[data-reviews]").forEach(b=>b.onclick=()=>{ beep("click"); reviewsModal(+b.dataset.reviews); });
  $$("[data-movestr]").forEach(b=>b.onclick=()=>{ if(moveToStreamer(+b.dataset.movestr)){beep("gold"); flashes(G.flash); render();} else toast("That film can't move to your platform.","bad"); });
  // film comparison checkboxes
  $$(".film-cb").forEach(cb=>cb.onclick=(e)=>{ e.stopPropagation(); const id=+cb.dataset.fid; G.compareSel = G.compareSel||[]; if(cb.checked){ if(!G.compareSel.includes(id)) G.compareSel.push(id); } else { G.compareSel=G.compareSel.filter(x=>x!==id); } render(); });
  $$(".film-row").forEach(r=>r.onclick=(e)=>{ if(e.target.type==="checkbox") return; const id=+r.dataset.filmId; const cb=r.querySelector(".film-cb"); if(cb){ cb.checked=!cb.checked; cb.dispatchEvent(new Event("click")); }});
  $("#btnCompareFilms") && ($("#btnCompareFilms").onclick=()=>{ beep("click"); compareFilmsModal(); });
  $$("[data-cut]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.cut; const f=G.films.find(x=>x.id===id); if(f && makeDirectorsCut(f)){ beep("gold"); flashes(G.flash); render(); } });
  $$(".rival-card").forEach(c=>c.onclick=()=>{ const name=c.dataset.rival; const r=G.rivals.find(x=>x.name===name); if(r) rivalProfileModal(r); });
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
    freeProjectTalent(p);
    G.studio.rep=clamp(G.studio.rep-2,5,99);
    log("🗑 Shelved “"+p.title+"”. Talent freed. Rep −2.","bad");
    beep("bad"); render();
  });
  $$("[data-seq]").forEach(b=>b.onclick=()=>{
    const f=G.films.find(x=>x.id===+b.dataset.seq);
    if(f){ beep("click"); startSequel(f); }
  });
  $$("[data-cancel-series]").forEach(b=>b.onclick=()=>{ if(cancelSeries(+b.dataset.cancelSeries)){ beep("bad"); flashes(G.flash); render(); } });
  $$("[data-spinoff-series]").forEach(b=>b.onclick=()=>{ seriesMovieIdea(+b.dataset.spinoffSeries); beep("gold"); flashes(G.flash); render(); });
  $$("[data-acc]").forEach(b=>b.onclick=()=>{ acceptOffer(G.offers.find(o=>o.id===+b.dataset.acc)); beep("gold"); flashes(G.flash); render(); });
  $$("[data-cnt]").forEach(b=>b.onclick=()=>{ counterOffer(G.offers.find(o=>o.id===+b.dataset.cnt)); beep("click"); flashes(G.flash); render(); });
  $$("[data-dec]").forEach(b=>b.onclick=()=>{ declineOffer(G.offers.find(o=>o.id===+b.dataset.dec)); beep("click"); render(); });
  $$("[data-spec]").forEach(b=>b.onclick=()=>{ if(specFocus(b.dataset.spec)){ beep("gold"); flashes(G.flash); render(); } });
  $$("[data-tech]").forEach(b=>b.onclick=()=>{ if(startResearch(b.dataset.tech)){ beep("gold"); flashes(G.flash); render(); } else beep("bad"); });
  $$("[data-unipick]").forEach(b=>b.onclick=()=>{
    const id=+b.dataset.unipick, i=UNIPICKS.indexOf(id);
    if(i>=0) UNIPICKS.splice(i,1); else UNIPICKS.push(id);
    beep("click");
    const names=UNIPICKS.map(x=>{ const fr=frById(x); return fr?fr.name:"#"+x; });
    const el=$("#uniPicks"); if(el) el.textContent=names.length?names.join(" × "):"—";
    b.classList.toggle("btn-primary");
  });
  const ug=$("#uniGo");
  if(ug) ug.onclick=()=>{
    if(UNIPICKS.length<2){ toast("Pick at least two franchises.","bad"); return; }
    if(foundUniverse(null, UNIPICKS.slice())){ UNIPICKS=[]; beep("gold"); flashes(G.flash); render(); }
    else beep("bad");
  };
  $$("[data-upg]").forEach(b=>b.onclick=()=>{ buyUpgrade(b.dataset.upg); beep("gold"); render(); });
  $$("[data-hqbuy]").forEach(b=>b.onclick=()=>{
    const [kind,id]=b.dataset.hqbuy.split(":");
    if(kind==="hq"){ if(buyHq(id)){ beep("gold"); flashes(G.flash); render(); } }
    else if(kind==="exec"){ if(hireExec(id)){ beep("gold"); flashes(G.flash); render(); } else toast("Not enough cash for that hire.","bad"); }
    else { buyUpgrade(id); beep("gold"); render(); }
  });
  // finance sliders
  const fl=$("#fnLoan");
  if(fl){ const upd=()=>$("#fnLoanV").textContent=fmtM(+fl.value); upd(); fl.oninput=upd;
    $("#fnLoanGo").onclick=()=>{ if(takeLoan(+fl.value)){beep("cash"); flashes(G.flash); render();} }; }
  const fr=$("#fnRepay");
  if(fr){ const upd=()=>$("#fnRepayV").textContent=fmtM(+fr.value); upd(); fr.oninput=upd;
    $("#fnRepayGo").onclick=()=>{ if(repayDebt(+fr.value)){beep("good"); flashes(G.flash); render();} }; }
  // mezzanine
  const mz=$("#fnMezz");
  if(mz){ const upd=()=>$("#fnMezzV").textContent=fmtM(+mz.value); upd(); mz.oninput=upd;
    $("#fnMezzGo").onclick=()=>{ if(mezzanineLoan(+mz.value)){beep("cash"); flashes(G.flash); render();} }; }
  const mzr=$("#fnMezzRepay");
  if(mzr){ const upd=()=>$("#fnMezzRepayV").textContent=fmtM(+mzr.value); upd(); mzr.oninput=upd;
    $("#fnMezzRepayGo").onclick=()=>{ if(repayMezzanine(+mzr.value)){beep("good"); flashes(G.flash); render();} }; }
  // IPO + execs
  const ipo=$("#fnIpo"); if(ipo) ipo.onclick=()=>{ if(goPublic()){beep("gold"); flashes(G.flash); render();} else toast("IPO needs reputation 60+, and you can only ever IPO once.","bad"); };
  $$("[data-tier]").forEach(b=>b.onclick=()=>{
    if(setStreamerTier(b.dataset.tier)){ beep("gold"); flashes(G.flash); render(); }
    else toast("Not enough cash to build that tier.","bad");
  });
  const sec=$("#fnSec");
  if(sec){
    const updS=function(){ const n=+sec.value; $("#fnSecV").textContent=n+"M shares ≈ "+fmtM(Math.round(G.public.price*n*0.93)); };
    updS(); sec.oninput=updS;
    $("#fnSecGo").onclick=function(){ if(secondaryOffering(+sec.value)){ beep("cash"); flashes(G.flash); render(); } };
  }
  $$("[data-exec]").forEach(b=>b.onclick=()=>{ if(hireExec(b.dataset.exec)){beep("gold"); flashes(G.flash); render();} else toast("Not enough cash for that hire.","bad"); });

  /* ── v5 bindings ── */
  const wrb=$("#btnWrap"); // QA: button rendered with no handler — wire the $20M/3-picture deal
  if(wrb) wrb.onclick=()=>{
    if(G.wrapDeal>0) return;
    if(G.studio.cash<20){ toast("The wrap deal costs $20M.","bad"); return; }
    spend("studio",20); G.wrapDeal=3;
    log("🎫 Wrap deal signed (−$20M): all talent fees −20% on your next 3 pictures.","gold");
    beep("gold"); flashes(G.flash); render();
  };
  const agb=$("#btnAgency");
  if(agb) agb.onclick=()=>{
    if(G.studio.cash<30){ toast("The town-wide agency truce costs $30M.","bad"); return; }
    spend("studio",30); G.agencyExcl=G.week+104;
    log("🕴 You sign a town-wide truce with the agencies (−$30M): packaging fees pause while it lasts.","gold");
    beep("gold"); flashes(G.flash); render();
  };
  $$("[data-agdeal]").forEach(b=>b.onclick=()=>{ if(signAgencyDeal(b.dataset.agdeal)){ beep("gold"); flashes(G.flash); } render(); });
  $$("[data-ma]").forEach(b=>b.onclick=()=>{ if(maBuy(+b.dataset.ma)){ beep("gold"); flashes(G.flash); } render(); });
  $$("[data-fyc]").forEach(b=>b.onclick=()=>{ beep("click"); fycModal(+b.dataset.fyc); });
  $$("[data-fr-toys]").forEach(b=>b.onclick=()=>{ signToyLine(+b.dataset.frToys); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-spin]").forEach(b=>b.onclick=()=>{ const fr=frById(+b.dataset.frSpin); if(fr){ beep("click"); startSpinoff(fr); } });
  $$("[data-fr-tv]").forEach(b=>b.onclick=()=>{ franchiseTvSpinoff(+b.dataset.frTv); beep("gold"); flashes(G.flash); render(); });
  $$("[data-fr-more]").forEach(b=>b.onclick=()=>{ beep("click"); empireModal(+b.dataset.frMore); });
  $$("[data-merchline]").forEach(b=>b.onclick=()=>{ const [fid,lid]=b.dataset.merchline.split(":"); if(launchMerchLine(+fid,lid)){ beep("cash"); flashes(G.flash); render(); } else beep("bad"); });
  $$("[data-rerelease]").forEach(b=>b.onclick=()=>{ rereleaseFilm(+b.dataset.rerelease); beep("gold"); flashes(G.flash); render(); });
  $$("[data-reboot]").forEach(b=>b.onclick=()=>{ rebootFilm(+b.dataset.reboot); beep("gold"); flashes(G.flash); render(); });
  $$("[data-rewrite]").forEach(b=>b.onclick=()=>{ rewriteScript(+b.dataset.rewrite); beep("click"); flashes(G.flash); render(); });
  $$("[data-reshoot]").forEach(b=>b.onclick=()=>{ reshootFilm(+b.dataset.reshoot); beep("gold"); flashes(G.flash); render(); });
  $$("[data-screen]").forEach(b=>b.onclick=()=>{
    const r=testScreening(+b.dataset.screen); beep("click");
    if(!r) return;
    let h="<h3>🧪 Screening report — “"+esc(r.p.title)+"”</h3>";
    h+="<div class='stat-hero'>"+statCard(r.p.quality.overall,"Overall")+statCard(r.p.quality.critic,"Critics")+statCard(r.p.quality.aud,"Audience")+statCard(r.legs+"×","Projected legs")+"</div>";
    h+= r.spots.length? "<div class='card' style='border-left:3px solid var(--gold)'>Focus groups flag: <b>"+r.spots.join(", ")+"</b>. Reshoots ("+fmtM(Math.max(3,Math.round(r.p.budget*0.08)))+") can lift the score.</div>"
      : "<div class='card' style='border-left:3px solid var(--green)'>Clean cards — the room loved it. Ship it.</div>";
    h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Noted</button>"+(r.spots.length && !r.p.reshoot? "<button class='btn btn-alt' id='scrRs'>🎞 Reshoot</button>":"")+"</div>";
    const v=openModal(h);
    const rs=v.querySelector("#scrRs"); if(rs) rs.onclick=()=>{ reshootFilm(r.p.id); closeModal(); flashes(G.flash); render(); };
  });
  const tsk=$("#tutSkip"); if(tsk) tsk.onclick=()=>{ G.tutorial={step:99,done:true}; beep("click"); render(); };
  $$("[data-ip]").forEach(b=>b.onclick=()=>{ buyIp(+b.dataset.ip); beep("gold"); flashes(G.flash); render(); });
  const ab=$("#btnAch"); if(ab) ab.onclick=()=>{ beep("click"); achievementsModal(); };
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
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='aucNo'>"+(a.manual? "Not now":"🎥 Keep it for theaters")+"</button>"+
    (a.manual&&!a.stoked?"<button class='btn btn-alt' id='aucStoke'>🔥 Stoke bidding war · $2M</button>":"")+"</div>";
  const v=openModal(h,{locked:!a.manual, onClose:()=>{ if(G.pendingAuction && G.pendingAuction.manual) G.pendingAuction=null; }});
  v.querySelectorAll("[data-bid]").forEach(b=>b.onclick=()=>{
    acceptAuction(+b.dataset.bid); beep("gold"); flashes(G.flash); closeModal(); render();
  });
  const st=v.querySelector("#aucStoke");
  if(st) st.onclick=()=>{ if(stokeAuction()){ beep("gold"); flashes(G.flash); closeModal(); render(); auctionModal(); } };
  const no=v.querySelector("#aucNo");
  if(no) no.onclick=()=>{ declineAuction(); beep("click"); closeModal(); render(); };
}

/* ═══════════ live sports rights auction modal (v3) ═══════════ */
function sportsModal(){
  const a=G.pendingSports; if(!a) return;
  const pkg=a.pkg;
  const bid=pkg.rivalBid;
  const ec=sportEcon(pkg);
  const heat=pkg.rivalBid>=pkg.base*1.25?"🔥 hot":pkg.rivalBid>=pkg.base?"🌡 warm":"❄ cold";
  let h="<h3>"+pkg.icon+" Live sports rights — "+esc(pkg.name)+"</h3>"+
    "<p class='small muted'>"+esc(pkg.blurb)+" A sealed-bid auction. Winning adds <b>+"+pkg.subBump+"M subs</b> and <b>+"+pkg.sportPower+" sports power</b> (raises your content ceiling, decays ~1.5%/wk). Rivals are in play.</p>"+
    "<div class='card'><b class='small'>Rights economics</b>"+
    "<div class='cost-line'><span>Rights cost (your bid)</span><b>you set it</b></div>"+
    "<div class='cost-line'><span>Season duration</span><b>"+ec.dur+" weeks</b></div>"+
    "<div class='cost-line'><span>Audience</span><b>~"+ec.audience+"M viewers</b></div>"+
    "<div class='cost-line'><span>Subscriber impact</span><b class='pos'>+"+pkg.subBump+"M subs</b></div>"+
    "<div class='cost-line'><span>Advertising value</span><b>+"+fmtM(ec.ad)+"/wk</b></div>"+
    "<div class='cost-line'><span>Expected revenue</span><b class='pos'>~"+fmtM(ec.revenue)+"</b></div>"+
    "<div class='cost-line'><span>Competing bids</span><b>"+heat+" — rivals circling near "+fmtM(bid)+"</b></div></div>"+
    "<div class='card'><div class='cost-line'><span>Package value</span><b>"+fmtM(pkg.base)+"</b></div>"+
    "<div class='cost-line'><span>Suggested winning bid</span><b>"+fmtM(bid)+"</b></div>"+
    "<div class='cost-line'><span>Your cash</span><b>"+fmtM(G.studio.cash)+"</b></div></div>"+
    "<div class='card'><div class='spread'><span class='small muted'>Your bid</span><input type='range' id='spBid' min='"+Math.max(5,Math.round(pkg.base*0.5))+"' max='"+Math.max(20,Math.round(pkg.base*2))+"' step='5' value='"+bid+"' style='flex:1'><b id='spBidV'>"+fmtM(bid)+"</b></div></div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' id='spPass'>Pass</button><button class='btn btn-primary' id='spGo'>🔒 Sealed bid</button></div>";
  const v=openModal(h,{noX:true,locked:true});
  const rg=v.querySelector("#spBid");
  if(rg){ const upd=()=>$("#spBidV").textContent=fmtM(+rg.value); rg.oninput=upd; }
  const pass=v.querySelector("#spPass"); if(pass) pass.onclick=()=>{ passSports(); beep("click"); closeModal(); render(); };
  const go=v.querySelector("#spGo");
  if(go) go.onclick=()=>{
    const b=+v.querySelector("#spBid").value;
    if(b>G.studio.cash){ toast("Not enough cash for that bid.","bad"); return; }
    resolveSports(b, pkg.id); beep(b>0?"gold":"bad"); flashes(G.flash); closeModal(); render();
  };
}

/* ═══════════ test screen & reshoot modal (v2) ═══════════ */
function testScreenModal(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p || p.phase!=="ready") return;
  const r=testScreenResult(p);
  const flag = r.flagged;
  const fee = Math.round(p.budget*0.12);
  let h="<h3>🎬 Test screening — “"+esc(p.title)+"”</h3>"+
    "<div class='small muted' style='margin-bottom:8px'>Your finished film screens for a preview audience.</div>"+
    "<div class='card'><div class='cost-line'><span>Critics (initial)</span><b>"+r.crit+"/100</b></div>"+
    "<div class='cost-line'><span>Test audience</span><b class='"+(r.screen>=60?"pos":"neg")+"'>"+r.screen+"/100</b></div>"+
    (flag? "<div class='tiny neg' style='margin-top:4px'>🚨 Test audiences flagged weak spots — a reshoot could fix them.</div>":
           "<div class='tiny pos' style='margin-top:4px'>🙌 Test audiences are on board with this cut.</div>")+"</div>";
  h+="<div class='modal-actions'>"+
    "<button class='btn btn-ghost' id='tsNo'>🎥 Release as-is</button>"+
    (p.prebuyAccepted? "":"<button class='btn btn-alt' data-reshoot='"+p.id+"'>🎬 Reshoot ("+fmtM(fee)+", ~"+rint(2,4)+" wks)</button>")+
    "</div>";
  const v=openModal(h,{onClose:()=>{} });
  const no=v.querySelector("#tsNo"); if(no) no.onclick=()=>{ closeModal(); render(); };
  const rs=v.querySelector("[data-reshoot]");
  if(rs) rs.onclick=()=>{
    if(beginReshoot(+rs.dataset.reshoot)){ beep("gold"); flashes(G.flash); closeModal(); render(); }
    else { toast("Not enough to reshoot now.","bad"); }
  };
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
      ((fr.fatigue||0)>0.15? "<div class='tiny "+((fr.fatigue||0)>0.35?"neg":"muted")+"' style='margin-top:4px'>😴 Franchise fatigue "+Math.round(fr.fatigue*100)+"% — the next entry opens "+Math.round(fr.fatigue*100)+"% smaller and reviews worse. Rest the brand ~6 months to heal it.</div>":"")+
      "<div class='fr-meters'>"+
        frMeter("💎 Value", fmtM(frValue(fr)))+
        frMeter("👥 Fanbase", "<span class='tiny'>"+frFanbase(fr)+"</span>")+
        frMeter("🔥 Heat", Math.round((fr.decay||0)*100)+"%")+
        frMeter("😴 Fatigue", "<span class='"+((fr.fatigue||0)>0.3?"neg":(fr.fatigue||0)>0.15?"":"pos")+"'>"+Math.round((fr.fatigue||0)*100)+"%</span>")+
        frMeter("🧸 Merchandise", pips(fr.merch,3))+
        frMeter("🎡 Theme park", fr.tier>=2? pips(fr.park,3) : "<span class='tiny muted'>needs tier 2</span>")+
        frMeter("🎬 Sequel", "<span class='tiny'>"+frSequel(fr)+"</span>")+
        frMeter("🎭 Spinoff", "<span class='tiny'>"+frSpinoff(fr)+"</span>")+
        frMeter("📺 Streaming", "<span class='tiny'>"+frStreamVal(fr)+"</span>")+
        frMeter("🎞 Films", String((fr.entries||[]).length))+
        frMeter("💰 Earned", fmtM(fr.earned||0))+
        frMeter("📈 Revenue/wk", "+"+fmtM(inc))+
      "</div>"+
      "<div class='tiny muted' style='margin-top:6px'>Revenue history: "+(fr.entries.length? fr.entries.slice(-4).map(e=>"“"+esc(e.title)+"” "+fmtG(e.ww||0)).join(" · "):"no entries yet")+" · empire total "+fmtM(fr.earned||0)+".</div>"+
      frTimeline(fr)+
      ((G.licensedOut||[]).filter(L=>L.name===fr.name).length? "<div class='tiny gold' style='margin-top:6px'>📦 Licensed out to "+(G.licensedOut.filter(L=>L.name===fr.name).map(L=>L.rival).join(", "))+" — backend pending; merch shelf sags while away.</div>":"")+
      "<div class='fr-actions'>"+
      "<button class='btn btn-sm btn-primary' data-fr-seq='"+fr.id+"'>⚡ Greenlight Sequel</button>"+
      (fr.merch<3? "<button class='btn btn-sm btn-alt' data-fr-merch='"+fr.id+"'>🧸 "+(fr.merch?"Upgrade merch":"Launch merch")+" · "+fmtM(merchCost(fr))+"</button>" : "<span class='tag green' style='align-self:center'>merch maxed</span>")+
      (fr.park<3? (fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-park='"+fr.id+"'>🎡 "+(fr.park?(fr.park===2?"Resort district":"Expand park"):"Build attraction")+" · "+fmtM(parkCost(fr))+"</button>" : "<span class='tag' style='align-self:center'>🎡 park unlocks at tier 2</span>") : "<span class='tag green' style='align-self:center'>park maxed</span>")+
      (fr.gameSold!==fr.tier? "<button class='btn btn-sm btn-alt' data-fr-game='"+fr.id+"'>🎮 License game rights</button>":"")+
      (!fr.toys && fr.merch>=1? "<button class='btn btn-sm btn-alt' data-fr-toys='"+fr.id+"'>🧒 Toy line · "+fmtM(DATA.MERCH_V2? DATA.MERCH_V2.toyCost(fr.tier):45)+"</button>":"")+
      "<button class='btn btn-sm btn-alt' data-fr-spin='"+fr.id+"'>🎬 Spin-off film</button>"+
      (fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-tv='"+fr.id+"'>📺 TV spin-off</button>":"")+
      "<button class='btn btn-sm' data-fr-more='"+fr.id+"'>⋯ More moves</button>"+
      "</div></div>";
  }
  h+="<div class='card'><b>How the empire works</b><div class='small muted' style='margin-top:4px'>Every entry adds <b>franchise fatigue</b> (smaller openings, weaker reviews) that only heals if you rest the brand for about half a year. Merch & parks pay every week and spike again whenever a franchise film hits theaters (decay resets). Game rights are one-time cash per tier. Franchise equity raises your catalog value and credit limit.</div></div>";
  try{ h+=merchBoard(); }catch(e){}
  try{ if(typeof uniBoard==="function") h+=uniBoard(); }catch(e){}
  try{ if(typeof endgameBoard==="function") h+=endgameBoard(); }catch(e){}
  if(((G.licensedOut||[]).length)){
    h+="<div class='section-title'>📦 Brands licensed out</div><div class='card'>";
    (G.licensedOut||[]).forEach(function(L){
      h+="<div class='cost-line'><span>"+(L.kind==="goods"?"🥤":"🎬")+" “"+esc(L.name)+"” → "+esc(L.rival)+"</span><b class='muted tiny'>settles "+dateLabel(L.due)+"</b></div>";
    });
    h+="</div>";
  }
  return h;
}
/* Per-film merchandising dashboard: demand/cost/revenue/profit/brand per line.
   Weak films lose money on the shelf — check demand before manufacturing. */
function merchBoard(){
  const cands=(G.films||[]).filter(f=>!f.streamingOriginal&&(f.ww||0)>=1)
    .sort((a,b)=>(b.ww||0)-(a.ww||0)).slice(0,6);
  if(!cands.length) return "";
  let h="<div class='section-title'>🧸 Film merchandising</div>";
  cands.forEach(f=>{
    const done=f.merchLines||[];
    const tot=done.reduce((a,m)=>a+(m.profit||0),0);
    h+="<div class='card'><div class='spread'><div><b>"+esc(f.title)+"</b> <span class='tiny muted'>"+fmtG(f.ww||0)+" WW"+(f.franchiseName?" · "+esc(f.franchiseName):"")+"</span></div>"+
      "<b class='"+(tot>=0?"pos":"neg")+"'>"+(tot>=0?"+":"")+fmtM(Math.round(tot*10)/10)+" shelf</b></div>";
    if(done.length) h+="<div class='tiny muted' style='margin:4px 0'>"+done.map(m=>{ const d=merchLineDefs().find(x=>x.id===m.id)||{icon:"📦",name:m.id}; return d.icon+" "+d.name+" ("+(m.profit>=0?"+":"")+fmtM(m.profit)+")"; }).join(" · ")+"</div>";
    if(!f.merchDone){
      h+="<div class='grid g3' style='margin-top:6px'>";
      merchLineDefs().forEach(d=>{
        if(done.some(m=>m.id===d.id)) return;
        let plan=null; try{ plan=merchPlan(f,d.id); }catch(e){}
        if(!plan) return;
        h+="<div class='card' style='padding:10px'><b>"+d.icon+" "+d.name+"</b>"+
          "<div class='tiny muted'>"+d.desc+"</div>"+
          "<div class='cost-line'><span>Demand</span><b class='"+(plan.demand>=60?"pos":plan.demand<40?"neg":"")+"'>"+plan.demand+"</b></div>"+
          "<div class='cost-line'><span>Cost → revenue</span><b>"+fmtM(plan.cost)+" → "+fmtM(plan.revenue)+"</b></div>"+
          "<div class='cost-line'><span>Profit · brand</span><b class='"+(plan.profit>=0?"pos":"neg")+"'>"+(plan.profit>=0?"+":"")+fmtM(plan.profit)+" · +"+plan.brand+"</b></div>"+
          "<button class='btn btn-sm "+(plan.profit>=0?"btn-primary":"")+"' style='margin-top:6px' data-merchline='"+f.id+":"+d.id+"'>Manufacture</button></div>";
      });
      h+="</div>";
    }
    h+="</div>";
  });
  return h;
}
/* Universe map + endgame dashboard. Universes are opt-in overlays; endgame
   tracks six optional milestones toward an industry crown. */
let UNIPICKS=[]; // staged franchise ids for the next universe weave
function uniBoard(){
  const list=G.universes||[];
  let h="<div class='section-title'>🌌 Franchise universes (optional)</div>";
  if(!list.length) h+="<div class='card muted small'>No universes — franchises stand alone just fine. Weave 2+ tier-2 franchises ($80M) to link them: continuity rewards rested brands (±5% openings).</div>";
  list.forEach(u=>{
    let st;
    try{ st=uniStats(u); }catch(e){ return; }
    h+="<div class='card'><div class='spread'><div><b>🌌 "+esc(u.name)+"</b>"+
      "<div class='tiny muted'>"+st.frs.length+" brands · "+fmtG(st.ww)+" WW · value "+fmtM(st.value)+" · continuity "+st.continuity+"% · "+st.fanbase+"</div></div>"+
      "<b class='"+(st.continuity>=70?"pos":st.continuity<40?"neg":"")+"'>"+(st.continuity>=70?"+5% openings":st.continuity<40?"−5% openings":"neutral")+"</b></div>";
    st.frs.forEach((fr,i)=>{
      const last3=(fr.entries||[]).slice(-3);
      h+="<div class='tiny' style='margin-top:6px'>"+(i?"├── ":"└── ")+"<b>"+esc(fr.name)+"</b> (tier "+fr.tier+")"+
        (last3.length?" → "+last3.map(e=>"“"+esc(e.title)+"” "+fmtG(e.ww||0)).join(" → "):"")+"</div>";
      (G.series||[]).filter(s=>s.spinFr===fr.id).forEach(s=>{
        h+="<div class='tiny muted'>&nbsp;&nbsp;&nbsp;&nbsp;│   └── 📺 "+esc(s.title)+"</div>";
      });
    });
    const cross=(G.ideas||[]).filter(x=>x.crossover&&st.frs.some(fr=>x.crossover.includes(fr.name)));
    cross.slice(0,2).forEach(x=>{ h+="<div class='tiny gold'>💥 Crossover in Develop: “"+esc(x.title)+"”</div>"; });
    h+="</div>";
  });
  const elig=(G.franchises||[]).filter(f=>f.tier>=2);
  if(elig.length>=2){
    h+="<div class='card'><b class='small'>Weave a universe — $80M</b><div class='tiny muted'>Optional. Does not merge brands (unlike the old merge move).</div>"+
      "<div class='row' style='margin-top:6px'>"+elig.map(f=>"<button class='btn btn-sm btn-alt' data-unipick='"+f.id+"'>"+esc(f.name)+"</button>").join("")+"</div>"+
      "<div class='tiny muted' style='margin-top:4px'>Picked: <b id='uniPicks'>—</b></div>"+
      "<div class='row' style='margin-top:6px'><button class='btn btn-sm btn-primary' id='uniGo'>🌌 Found universe</button></div></div>";
  }
  return h;
}
function endgameBoard(){
  let goals, inf;
  try{ goals=endgameGoals(); inf=endgameInfluence(); }catch(e){ return ""; }
  const done=goals.filter(g=>g.prog>=1).length;
  let h="<div class='section-title'>👑 Endgame — industry empire ("+done+"/6, optional)</div><div class='card'>"+
    "<div class='spread'><div><b>Industry influence</b><div class='tiny muted'>"+inf.share+"% market share · "+inf.talent+"★ talent network · "+fmtM(Math.round(inf.intl))+" intl WW</div></div>"+
    "<b class='gold'>"+done+"/6</b></div>";
  goals.forEach(g=>{
    h+="<div class='spread' style='margin-top:4px'><span class='small'>"+g.icon+" "+g.name+" <span class='tiny muted'>"+g.label+"</span></span>"+
      "<b class='tiny "+(g.prog>=1?"pos":"")+"'>"+(g.prog>=1?"✓":Math.round(g.prog*100)+"%")+"</b></div>"+meter(g.prog,1);
  });
  if((G.endgame||{}).crowned) h+="<div class='tiny gold' style='margin-top:4px'>👑 CROWNED Entertainment Empire.</div>";
  return h+"</div>";
}
/* Franchise dashboard: read-only rollups from fr fields + entries. Value mirrors
   catalogValue weights (tier/merch/park); fanbase estimated from entries + WW. */
function frValue(fr){ return (fr.tier||0)*15+(fr.merch||0)*10+(fr.park||0)*45+((fr.toys)?15:0); }
function frFanbase(fr){
  const ww=fr.ww||0;
  if(ww>=2000) return "Global phenomenon";
  if(ww>=800) return "Massive following";
  if(ww>=300) return "Loyal fanbase";
  if((fr.entries||[]).length>=2) return "Growing cult";
  return "New spark";
}
function frSequel(fr){
  const fat=fr.fatigue||0;
  if(fat>0.45) return "Rest it — fatigue "+Math.round(fat*100)+"%";
  if((fr.decay||0)<0.6) return "Cooling — rebuild heat first";
  if((fr.tier||0)>=4) return "Eventize it — saga tier";
  return "Ready — heat "+Math.round((fr.decay||0)*100)+"%";
}
function frSpinoff(fr){
  if((fr.tier||0)<2) return "Needs tier 2";
  if((fr.fatigue||0)>0.5) return "Risky — brand tired";
  return "Viable — tier "+fr.tier;
}
function frStreamVal(fr){
  try{
    const names=new Set((fr.entries||[]).map(e=>e.title));
    const mine=(G.films||[]).filter(f=>names.has(f.title)&&((f.soldTo&&!f.streamingOriginal)||f.onOwn||f.streamingOriginal));
    if(!mine.length) return "Unsold library";
    return mine.length+" title(s) placed";
  }catch(e){ return "—"; }
}
function frTimeline(fr){
  const ents=(fr.entries||[]).slice().sort((a,b)=>a.week-b.week);
  let h="<div class='fr-timeline' style='margin-top:8px'><div class='tl-header'><b>🕰 Timeline</b> <span class='tiny muted'>(fatigue "+Math.round((fr.fatigue||0)*100)+"% · heat "+Math.round((fr.decay||1)*100)+"%)</span></div>";
  if(!ents.length){
    h+="<div class='tl-empty'>No films yet — greenlight the first entry</div>";
  }else{
    h+="<div class='tl-track'>";
    ents.forEach((e,i)=>{
      const smash=(e.ww||0)>=300?" <span class='tl-breakout'>BREAKOUT</span>":"";
      const yrs=Math.floor(e.week/52)+1;
      const w=e.week%52||52;
      h+="<div class='tl-node'><div class='tl-marker'></div>"+
        "<div class='tl-content'><div class='tl-title'>"+esc(e.title)+smash+"</div>"+
        "<div class='tl-meta'>Year "+yrs+", W"+w+" · "+fmtG(e.ww||0)+" WW · "+fmtG(e.opening||0)+" open · "+(e.criticAvg||e.quality?.critic||"?")+"% critics</div>"+
        "<div class='tl-profit'>Profit: <span class='"+((e.profit||0)>=0?"pos":"neg")+"'>"+((e.profit||0)>=0?"+":"")+fmtM(e.profit||0)+"</span></div></div></div>";
      if(i<ents.length-1) h+="<div class='tl-gap'></div>";
    });
    h+="</div>";
  }
  const live=[];
  if(fr.merch) live.push("🧸 Merch L"+fr.merch);
  if(fr.toys) live.push("🧒 Toy line");
  if(fr.park) live.push("🎡 Park L"+fr.park);
  if(fr.resort) live.push("🏝 Resort");
  if(fr.gameSold===fr.tier&&fr.tier) live.push("🎮 Game licensed");
  if(fr.publishing) live.push("📚 Publishing");
  try{
    const names=new Set(ents.map(e=>e.title));
    const placed=(G.films||[]).filter(f=>names.has(f.title)&&(f.onOwn||f.streamingOriginal||f.soldTo)).length;
    if(placed) live.push("📺 Streaming ("+placed+")");
  }catch(e){}
  if(live.length) h+="<div class='tl-assets' style='margin-top:8px'><b>Active assets:</b> "+live.join(" · ")+"</div>";
  const lastWk=ents.length?ents[ents.length-1].week:(fr.built||G.week);
  const rested=G.week-lastWk>26;
  const fatigue=fr.fatigue||0;
  h+="<div class='tl-next' style='margin-top:8px;padding:8px;background:var(--card2);border:1px solid var(--line);border-radius:8px'>";
  if(fatigue>0.35){
    h+=rested?"<span class='pos'>✅ Rested enough — sequel window open</span>":"<span class='neg'>😴 Rest brand ~"+Math.max(0,Math.ceil(26-(G.week-lastWk)))+"w before Film "+(ents.length+1)+"</span>";
  }else{
    h+="<span class='pos'>⚡ Film "+(ents.length+1)+" window open</span>";
  }
  if(fatigue>0.15) h+=" <span class='muted'>(fatigue "+Math.round(fatigue*100)+"%)</span>";
  h+="</div></div>";
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
  v.querySelectorAll("[data-ch]").forEach(b=>b.onclick=()=>{
    resolveChoice(+b.dataset.ch); closeModal(); beep("click"); flashes(G.flash); render();
    if(G.pendingDeepfake) deepfakeModal();                 // v5: mini-game
    else if(G.pendingAuction) auctionModal();              // v5: festival sales market
    else if(G.pendingSports) sportsModal();
  });
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
  beep("drums");
  if(r.awards && r.awards.wins && r.awards.wins.some(function(w){ return w.mine; })) confetti({count:200});
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
    "<div class='cost-line'><span>Awards</span><b>"+(((o.stats.awards||[]).map(a=>a.cat).join(", "))||"none")+"</b></div>"+
    "</div></div>"+legacySummaryCard()+
    "<div class='modal-actions'><button class='btn btn-primary' id='goNew'>🎬 Found a new studio</button></div>";
  const v=openModal(h,{noX:true,locked:true});
  v.querySelector("#goNew").onclick=()=>{ try{localStorage.removeItem("bow_save");}catch(e){} location.reload(); };
}

/* ═══════════ v4: quarterly earnings call ═══════════ */
function earningsModal(){
  const e=G.pendingEarnings; if(!e) return;
  G.pendingEarnings=null;
  const P=G.public||{};
  let h="<div style='text-align:center'><div style='font-size:42px'>"+(e.beat?"📈":"📉")+"</div>"+
    "<h3>Q"+(Math.ceil(woyOf(e.week)/13))+" earnings call — Year "+yearOf(e.week)+"</h3></div>"+
    "<div class='card'>"+
      "<div class='cost-line'><span>Quarter net</span><b class='"+(e.q>=0?"pos":"neg")+"'>"+(e.q>=0?"+":"")+fmtM(e.q)+"</b></div>"+
      "<div class='cost-line'><span>Street expectation</span><b>"+fmtM(e.expectation)+"</b></div>"+
      "<div class='cost-line'><span>Result</span><b class='"+(e.beat?"pos":"neg")+"'>"+(e.beat?"BEAT":"MISS")+"</b></div>"+
      "<div class='cost-line'><span>Share price</span><b>"+(e.move>=0?"+":"")+"$"+e.move.toFixed(2)+" → $"+(P.price||0).toFixed(2)+"</b></div>"+
      "<div class='cost-line'><span>"+esc(e.analyst)+"</span><b class='"+(/Buy/.test(e.rating)?"pos":/Sell/.test(e.rating)?"neg":"")+"'>"+e.rating+"</b></div>"+
    "</div>"+
    "<p class='small muted'>"+(e.beat
        ? "“A clean quarter. The slate is working and the platform is compounding.”"
        : "“We remain concerned about content spend outpacing monetisation.”")+"</p>"+
    "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>End the call</button></div>";
  openModal(h,{noX:true});
  beep(e.beat?"chime":"buzz");
  if(e.beat && e.q > e.expectation*2) confetti({count:90});
}

/* ═══════════ v4: shareable studio card ═══════════ */
function studioCardData(){
  const yr=yearOf(G.week);
  const best=G.films.slice().sort((a,b)=>(b.ww||0)-(a.ww||0))[0];
  return {
    name:G.studio.name, date:"Year "+yr+" · Week "+woyOf(G.week),
    rows:[
      ["Cash", fmtM(G.studio.cash)],
      ["Reputation", Math.round(G.studio.rep)+"/100"],
      ["Films released", String(G.stats.films)],
      ["All-time WW gross", fmtM(G.stats.totalWW)],
      ["Hits / flops", G.stats.hits+" / "+G.stats.flops],
      ["Franchises", String(G.franchises.length)],
      ["Awards", String((G.stats.awards||[]).length)],
      ["Subscribers", G.streamer? G.streamer.subs.toFixed(1)+"M" : "—"],
      ["Share price", G.public? "$"+G.public.price.toFixed(2) : "private"],
    ],
    best: best? best.title+" — "+fmtG(best.ww||0)+" WW" : "No releases yet",
    achv:(G.achv||[]).slice(-3).map(a=>a.title),
  };
}
function drawStudioCard(){
  const d=studioCardData();
  const W=900, H=1150, c=document.createElement("canvas");
  c.width=W; c.height=H;
  const x=c.getContext("2d");
  const bg=x.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#0b0e14"); bg.addColorStop(0.6,"#141a26"); bg.addColorStop(1,"#0b0e14");
  x.fillStyle=bg; x.fillRect(0,0,W,H);
  x.strokeStyle="#f5b942"; x.lineWidth=6; x.strokeRect(24,24,W-48,H-48);
  x.textAlign="center";
  x.font="80px serif"; x.fillText("🎬", W/2, 150);
  x.fillStyle="#f5b942"; x.font="bold 54px Georgia, serif";
  x.fillText("BOX OFFICE WAR", W/2, 225);
  x.fillStyle="#ffffff"; x.font="bold 44px Georgia, serif";
  x.fillText(d.name, W/2, 300);
  x.fillStyle="#8b97ad"; x.font="26px Georgia, serif";
  x.fillText(d.date, W/2, 345);
  x.textAlign="left";
  let y=430;
  d.rows.forEach(function(r,i){
    x.fillStyle = i%2? "rgba(255,255,255,0.03)":"rgba(255,255,255,0.06)";
    x.fillRect(70, y-34, W-140, 52);
    x.fillStyle="#8b97ad"; x.font="26px Georgia, serif"; x.fillText(r[0], 96, y);
    x.fillStyle="#ffffff"; x.font="bold 30px Georgia, serif"; x.textAlign="right";
    x.fillText(r[1], W-96, y); x.textAlign="left";
    y+=62;
  });
  y+=18;
  x.fillStyle="#f5b942"; x.font="bold 26px Georgia, serif"; x.fillText("BIGGEST FILM", 96, y); y+=42;
  x.fillStyle="#ffffff"; x.font="28px Georgia, serif"; x.fillText(d.best.slice(0,42), 96, y); y+=56;
  if(d.achv.length){
    x.fillStyle="#f5b942"; x.font="bold 26px Georgia, serif"; x.fillText("RECENT ACHIEVEMENTS", 96, y); y+=40;
    x.fillStyle="#7ee787"; x.font="24px Georgia, serif";
    d.achv.forEach(function(a){ x.fillText("🏅 "+a.slice(0,40), 96, y); y+=36; });
  }
  x.textAlign="center"; x.fillStyle="#5c6780"; x.font="22px Georgia, serif";
  x.fillText("Founded, financed and survived in Box Office War", W/2, H-70);
  return c;
}
function shareStudioCard(){
  let c, url="";
  try{ c=drawStudioCard(); url=c.toDataURL? c.toDataURL("image/png"):""; }
  catch(e){ toast("Could not draw the card in this browser.","bad"); return; }
  let h="<h3>📸 Your studio card</h3><div class='share-card-wrap'><img src='"+url+"' alt='Studio card' class='share-card-img'></div>"+
    "<div class='modal-actions'><a class='btn btn-primary' download='"+G.studio.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase()+"-studio-card.png' href='"+url+"'>⬇ Download PNG</a>"+
    "<button class='btn btn-alt' id='shareCopy'>🔗 Copy summary</button>"+
    "<button class='btn btn-ghost' onclick='closeModal()'>Close</button></div>";
  const v=openModal(h);
  const cp=v.querySelector("#shareCopy");
  if(cp) cp.onclick=function(){
    const d=studioCardData();
    const txt="🎬 "+d.name+" — "+d.date+"\n"+d.rows.map(r=>r[0]+": "+r[1]).join("\n")+"\nBiggest film: "+d.best+"\n(Box Office War)";
    try{ navigator.clipboard.writeText(txt); toast("Summary copied to clipboard.","good"); }
    catch(e){ toast("Clipboard blocked by the browser.","bad"); }
  };
  beep("cash");
}

/* ═══════════ help ═══════════ */
function helpModal(){
  let h="<h3>❓ How the movie business works here</h3>"+
  "<div class='card'><b>1. 📝 Develop</b><p class='small muted'>Buy a script, attach a director (quality) and stars (opening weekend), set a budget. Production burns cash weekly through pre-production → shoot → post.</p></div>"+
  "<div class='card'><b>2. 📅 Date it like a pro</b><p class='small muted'>Summer & holidays multiply openings; January and September are graveyards. Check the calendar for rival tentpoles — head-to-head weekends split the audience.</p></div>"+
  "<div class='card'><b>3. 📊 Box office math (real Hollywood rules)</b><p class='small muted'>Opening weekend = star power × marketing × season × competition. Legs (total ÷ opening) come from quality — horrors die fast, animation runs for months. The studio keeps ≈53% domestic / ≈42% international, so <b>breakeven ≈ (budget + P&A) ÷ 0.48</b> worldwide.</p></div>"+
  "<div class='card'><b>4. 📺 Distribution: theaters or OTT</b><p class='small muted'>At greenlight pick a plan: 🎥 theatrical (full upside + risk), 📺 streaming original (platforms bid on delivery — guaranteed cash, no box office), or decide later. Finished films can be shopped to streamers anytime — 3 platforms bid, pick one. After the run, films earn PVOD + streaming licenses.</p></div>"+
  "<div class='card'><b>5. 💰 Weekly cash & P&L</b><p class='small muted'>Box office rentals (~53% of domestic gross) arrive <b>every week a film is playing</b>, intl rentals settle at end of run, and every dollar is itemized in Finance → This week's P&L. A-list ensembles take 5% backend; pre-sales & tax incentives smooth cash flow.</p></div>"+
  "<div class='card'><b>6. 🏰 Franchise empire</b><p class='small muted'>Big hits (≈2× breakeven + good reviews) unlock a franchise: sequels, 🧸 merch lines (weekly income), 🎮 game licenses (one-time cash), and 🎡 theme parks (tier 2+, big steady income). New releases re-heat the brand.</p></div>"+
  "<div class='card'><b>7. ✍️ Writers &amp; 🎫 producers</b><p class='small muted'>Attach a <b>writer</b> to lift the script (30% of quality) and a <b>producer</b> to contain cost overruns, add production value and shave the schedule. Go without a producer and every weather day, reshoot and trailer upgrade lands on your budget.</p></div>"+
  "<div class='card'><b>8. 📈 Genre trends</b><p class='small muted'>Every genre carries a heat multiplier that re-rates each quarter — horror can be red hot one year and ice cold the next. Heat moves opening weekend and streaming appetite, so time your slate to the cycle (and remember hits heat a genre up).</p></div>"+
  "<div class='card'><b>9. 🗞 Critics &amp; audiences</b><p class='small muted'>Five named critics review each release with their own harshness and genre biases. Their consensus becomes the film's critic score, while the audience score drives legs — and can be review-bombed.</p></div>"+
  "<div class='card'><b>10. 😴 Franchise fatigue &amp; careers</b><p class='small muted'>Every sequel adds fatigue: smaller openings and worse reviews until you rest the brand. Talent ages too — stars peak in their 30s and 40s, fade, retire, get caught in scandals (cheap to hire, costly at the box office) and can be handed a comeback.</p></div>"+
  "<div class='card'><b>11. 📊 Public markets &amp; tiers</b><p class='small muted'>After the IPO you have a share price, quarterly earnings calls, analyst ratings and secondary offerings. On your streamer, choose the premium-only tier or add an ad tier (−24% revenue per sub, +32% ceiling) and decide whether to crack down on password sharing.</p></div>"+
  "<div class='card'><b>12. 💼 Survive</b><p class='small muted'>Overhead, interest and P&A never sleep. Loans bridge gaps; the credit line has limits. Hits build reputation, franchises and a valuable catalog. Flops build character.</p></div>"+
  "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Lights down, head rolled 🎬</button></div>";
  openModal(h,{noX:true});
}

/* v2/v3 additions */

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
  try{
    const hall=(typeof legacyHall==="function")?legacyHall():[];
    if(hall.length){
      h+="<label class='field-label'>🕊 Heirloom (optional legacy bonus)</label><div class='row'>";
      h+="<button class='btn btn-sm "+(SEL.legacy===""?"btn-primary":"")+"' data-leg=''>Fresh start</button>";
      hall.slice(0,4).forEach((e,i)=>{
        h+="<button class='btn btn-sm "+(SEL.legacy==String(i)?"btn-primary":"")+"' data-leg='"+i+"' title='"+esc(e.grade)+" · "+fmtM(e.revenue)+" WW · "+e.films+" films'>🕊 "+esc(e.studio)+"</button>";
      });
      h+="</div><div class='tiny muted'>Heir of a hall studio: +$25M, +3 rep. Optional — normal play is untouched.</div>";
    }
  }catch(e){}
  wrap.innerHTML=h;
  $$("[data-scen]").forEach(el=>el.onclick=()=>{ SEL.scenario=el.dataset.scen; beep("click"); buildStartOptions(); });
  $$("[data-diff]").forEach(el=>el.onclick=()=>{ SEL.difficulty=el.dataset.diff; beep("click"); buildStartOptions(); });
  const chk=$("#chkSandbox"); if(chk) chk.onchange=()=>{ SEL.sandbox=chk.checked; };
  $$("[data-slot]").forEach(el=>el.onclick=()=>{ SEL.slot=+el.dataset.slot; beep("click"); buildStartOptions(); });
  $$("[data-leg]").forEach(el=>el.onclick=()=>{ SEL.legacy=el.dataset.leg; beep("click"); buildStartOptions(); });
}

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

function screeningModal(pid){
  const r=testScreening(pid);
  if(!r){ toast("Screening unavailable.","bad"); return; }
  const p=r.p;
  const exp=expectedOpening(p, G.week+3);
  const det=screeningDetail(p);
  const rsCost=fmtM(Math.max(3,Math.round(p.budget*0.08))), reCost=fmtM(Math.max(2,Math.round(p.budget*0.03)));
  let h="<h3>🧪 Test screening — “"+esc(p.title)+"”</h3>"+
    "<div class='tiny muted'>One recruited room, one night. Scores come from the film's own quality, cast, budget and genre heat — not a second model.</div>"+
    "<div class='card' style='margin-top:8px'><b class='small'>Audience card</b>"+
    det.rows.map(x=>"<div class='cost-line'><span>"+x[0]+" <span class='tiny muted'>"+x[2]+"</span></span><b class='"+(x[1]>=70?"pos":x[1]<50?"neg":"")+"'>"+x[1]+"</b></div>").join("")+
    "<div class='cost-line'><span>Overall buzz</span><b class='"+(det.buzz>=0?"pos":"neg")+"'>"+(det.buzz>=0?"+":"")+Math.round(det.buzz*100)+"%</b></div>"+
    "<div class='cost-line'><span>Tracking legs</span><b>×"+r.legs+"</b></div>"+
    "<div class='cost-line'><span>Rough opening (neutral wk)</span><b>"+fmtG(exp)+"</b></div></div>"+
    demoPanel(p);
  h+= r.spots.length? "<div class='card' style='border-left:3px solid var(--red)'><b>Weak spots flagged:</b> "+r.spots.join(", ")+".</div>"
    : "<div class='card' style='border-left:3px solid var(--green)'>Clean cards — the room loved it.</div>";
  h+="<div class='small muted' style='margin:10px 0 6px'><b>Final cut decision</b></div><div class='plan-pick'>"+
    "<div class='plan-opt' id='scAsIs'><h5>✅ Release as is</h5><div class='p-sub'>Free. Trust the film; book the date.</div></div>"+
    "<div class='plan-opt' id='scReshoot'><h5>🎞 Reshoot · "+rsCost+"</h5><div class='p-sub'>Overall +5–8, audience +4. Once per film."+(p.reshoot?" (done)":"")+"</div></div>"+
    "<div class='plan-opt' id='scReedit'><h5>✂️ Re-edit · "+reCost+"</h5><div class='p-sub'>Tightens pacing: audience +~3, overall +2. Once per film."+(p.reedited?" (done)":"")+"</div></div>"+
    "<div class='plan-opt' id='scMkt'><h5>📣 Change marketing · $3M</h5><div class='p-sub'>Sell what tested well: +5% buzz."+(p.mktPivot?" (done)":"")+"</div></div>"+
    "<div class='plan-opt' id='scDelay'><h5>⏳ Delay release · $1M</h5><div class='p-sub'>"+(p.releaseWeek&&p.releaseWeek>G.week?"Push 3 weeks, +2% anticipation.":"Needs a dated release first.")+"</div></div>"+
    "</div>";
  h+="<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Close</button></div>";
  const v=openModal(h);
  const done=(msg)=>{ closeModal(); flashes(G.flash); render(); if(msg) toast(msg,"gold"); };
  v.querySelector("#scAsIs").onclick=()=>{ p.screened="as-is"; p.buzzBonus=(p.buzzBonus||0)+det.buzz; saveGame(); log("🎬 “"+p.title+"” locked as is — final cut confirmed.","gold"); beep("gold"); done(); };
  v.querySelector("#scReshoot").onclick=()=>{ if(p.reshoot){ toast("Reshoots already done.","bad"); return; } if(reshootFilm(p.id)!==false){ beep("gold"); done(); } };
  v.querySelector("#scReedit").onclick=()=>{ if(reeditFilm(p.id)){ beep("gold"); done(); } };
  v.querySelector("#scMkt").onclick=()=>{ if(screeningPush(p.id)){ beep("gold"); done(); } };
  v.querySelector("#scDelay").onclick=()=>{ if(delayRelease(p.id)){ beep("gold"); done(); } else toast("Delay needs a future release date.","bad"); };
}

function settingsModal(){
  let h="<h3>"+t("set.title")+"</h3>";
  h+="<div class='card'><div class='spread'><b>"+t("set.lang")+"</b><div class='row'>"+
    "<button class='btn btn-sm "+(LANG==="en"?"btn-primary":"")+"' id='langEn'>English</button>"+
    "<button class='btn btn-sm "+(LANG==="hi"?"btn-primary":"")+"' id='langHi'>हिन्दी</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Menus & chrome translate fully; long news copy stays in English.</div></div>";
  h+="<div class='card'><div class='spread'><b>"+t("set.font")+"</b><div class='row'>"+
    "<button class='btn btn-sm' id='fontMinus'>A−</button><button class='btn btn-sm' id='fontReset'>A</button><button class='btn btn-sm' id='fontPlus'>A+</button></div></div></div>";
  /* v5: accessibility / feel */
  h+="<div class='card'><div class='spread'><b>🎞 Animations</b><div class='row'>"+
    ["auto","on","off"].map(m=>"<button class='btn btn-sm "+((MOTION||"auto")===m?"btn-primary":"")+"' data-motion='"+m+"'>"+({auto:"Auto",on:"On",off:"Off"})[m]+"</button>").join("")+"</div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>“Auto” follows your OS reduced-motion setting; confetti and slide-ins pause when motion is off.</div></div>";
  h+="<div class='card'><div class='spread'><b>📳 Haptics</b><div class='row'>"+
    "<button class='btn btn-sm "+(HAPTICS?"btn-primary":"")+"' data-hap='1'>On</button>"+
    "<button class='btn btn-sm "+(!HAPTICS?"btn-primary":"")+"' data-hap='0'>Off</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Rumbles on phone events — a hit lands different from a flop.</div></div>";
  h+="<div class='card'><div class='spread'><b>"+t("set.saves")+"</b></div>"+
    "<div class='row' style='margin-top:8px'><button class='btn btn-sm btn-alt' id='btnExport'>"+t("set.export")+"</button>"+
    "<button class='btn btn-sm btn-alt' id='btnImport'>"+t("set.import")+"</button></div>"+
    "<textarea id='saveCode' rows='3' placeholder='paste an import code here…' style='width:100%;margin-top:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:10px;padding:8px;font-size:11px'></textarea>"+
    "<div class='row' style='margin-top:8px'><span class='small muted'>"+t("set.slot")+":</span>"+
    [1,2,3].map(n=>{
      const meta = slotMeta(n);
      const label = meta ? meta.name : ("Slot "+n);
      return "<div class='row' style='margin:4px 0;align-items:center;gap:8px'>"+
        "<button class='btn btn-sm "+((G.slot||1)===n?"btn-primary":"")+"' data-saveslot='"+n+"' style='min-width:70px'>Slot "+n+"</button>"+
        "<input type='text' value='"+esc(label)+"' data-slotname='"+n+"' placeholder='rename…' style='flex:1;max-width:180px;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:4px 8px;font-size:11px'>"+
      "</div>";
    }).join("")+"</div></div>";
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
  v.querySelectorAll("[data-motion]").forEach(b=>b.onclick=()=>{ MOTION=b.dataset.motion; localStorage.setItem("bow_motion",MOTION); applyMotionPref(); beep("click"); closeModal(); settingsModal(); });
  v.querySelectorAll("[data-hap]").forEach(b=>b.onclick=()=>{ HAPTICS=b.dataset.hap==="1"; localStorage.setItem("bow_hap",HAPTICS?"1":"0"); if(HAPTICS) rumble([20,40,20]); beep("click"); closeModal(); settingsModal(); });
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
  v.querySelectorAll("[data-slotname]").forEach(inp=>inp.onblur=()=>{
    const n=+inp.dataset.slotname;
    const raw=localStorage.getItem("bow_slot"+n);
    if(raw){
      const j=JSON.parse(raw);
      j.studio.name = inp.value.trim().slice(0,26);
      localStorage.setItem("bow_slot"+n, JSON.stringify(j));
    }
  });
  v.querySelector("#btnToMenu").onclick=()=>{ saveGame(); if(AUTO)toggleAuto(false); location.reload(); };
}

function startSpinoff(fr){
  const idea={ id:nid(), genre:DATA.GENRES[fr.genre]?fr.genre:"action", scale:"mid", title:"(spin-off)",
    blurb:"A cheaper ride on the "+fr.name+" heat.", script:rint(55,78), hot:true, spinoffFr:fr, awareness:0 };
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], cameo:null, sub:2, budget:Math.round(neededBudget(idea.genre,"mid")*0.45),
      plan:"theatrical", presales:false, rating:"PG-13", location:"la", foreignLang:false,
      aiCast:false, aiScript:false, coProd:"none"};
  wizardModal();
}

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

function viewAwardsCard(){
  const woy=woyOf(G.week), yr=yearOf(G.week);
  let h="<div class='card'><div class='spread'><b>"+t("sec.awards")+"</b><span class='tiny muted'>"+DATA.AWARDS+" · week 1 next year</span></div>";
  const nextFest=DATA.FESTIVALS.find(f=>f.woy>=woy)||DATA.FESTIVALS[0];
  h+="<div class='tiny muted' style='margin-top:4px'>🎪 Festival circuit (each has its own taste &amp; sales market): "+
     DATA.FESTIVALS.map(f=>f.emoji+" <b>"+f.name+"</b> W"+f.woy+" — loves "+(f.loves||[]).map(g=>DATA.genreOf(g).name.toLowerCase()).join("/")).join(" · ")+
     ". Next: "+nextFest.name+" (W"+nextFest.woy+(nextFest.woy<woy?" next yr":"")+").</div>";
  h+="<div class='tiny muted' style='margin-top:4px'>🗳 Precursors "+DATA.PRECURSORS.map(p=>p.emoji+" "+p.name+" (W"+p.woy+")").join(" · ")+" — win them to stack awards momentum before the Golden Reels. Best Picture triggers an Oscar bump (+25% of P&A as re-release gross).</div>";
  const wins=G.festWins.filter(w=>w.year===yr);
  if(wins.length) h+="<div class='tiny' style='margin-top:4px'>🏅 This year: "+wins.map(w=>esc(w.film)+" @ "+w.fest).join(" · ")+"</div>";
  if(woy>=44){
    const elig=G.films.filter(f=>f.year===yr && f.quality && f.quality.critic>=60 && !f.fyc);
    if(elig.length){
      h+="<div class='small' style='margin-top:8px'><b>FYC campaigning</b> <span class='tiny muted'>(slider $2–20M · momentum scales with spend · weeks 48–52 voting)</span></div><div class='row' style='margin-top:6px'>";
      elig.slice(0,4).forEach(f=>{ h+="<button class='btn btn-sm btn-alt' data-fyc='"+f.id+"'>🗳 "+esc(f.title)+"</button>"; });
      h+="</div>";
    }else h+="<div class='tiny muted' style='margin-top:6px'>No eligible unrewarded films for FYC this year.</div>";
  }else{
    h+="<div class='tiny muted' style='margin-top:6px'>FYC campaigns open from week 44.</div>";
  }
  h+="</div>";
  return h;
}

/* Awards dashboard: predicted noms, snub watch, campaign ledger, history.
   Predictions reuse runAwards prestige math; nothing here guarantees a win. */
function awardsBoard(){
  let s;
  try{ s=awardSeason(); }catch(e){ return ""; }
  let h="<div class='section-title'>🏆 Awards dashboard — Year "+s.yr+"</div><div class='card'>"+
    "<div class='spread'><div><b>"+s.noms.length+" likely nomination(s)</b><span class='tiny muted'> · "+s.precursors+" precursor(s) · "+s.fest.length+" festival win(s)</span></div>"+
    "<b>🗳 "+fmtM(s.spend)+" campaigned</b></div>";
  if(s.rows.length){
    s.rows.slice(0,6).forEach(r=>{
      h+="<div class='cost-line'><span>“"+esc(r.f.title)+"” <span class='tiny muted'>crit "+r.f.quality.critic+" · aud "+r.f.quality.aud+" · "+DATA.GENRES[r.f.genre].name+" · momentum "+Math.round(r.f.campaign||0)+" · spent "+fmtM(r.f.campaignSpend||0)+"</span></span>"+
        "<b class='"+(r.nom?"pos":r.snub?"neg":"")+"'>"+r.prestige+(r.nom?" · NOM":"")+(r.snub?" · snub watch":"")+"</b></div>";
    });
  } else h+="<div class='tiny muted'>No eligible films yet — prestige pictures (critics 60+, drama/musical/war over-index) earn their way here.</div>";
  if(s.snubs.length) h+="<div class='tiny neg' style='margin-top:4px'>😶 Snub watch: "+s.snubs.map(r=>"“"+esc(r.f.title)+"”").join(" · ")+" — a late FYC push could close the gap.</div>";
  if(s.last) h+="<div class='tiny muted' style='margin-top:4px'>Last season: won "+(s.last.wins.length?s.last.wins.join("; "):"nothing")+(s.last.snubs.length?" · snubbed "+s.last.snubs.join(", "):"")+".</div>";
  if(s.past.length) h+="<div class='tiny muted' style='margin-top:4px'>Shelf: "+s.past.map(a=>a.cat+" (“"+esc(a.film)+"”)").join(" · ")+".</div>";
  return h+"</div>";
}
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

function wizardTitle(){
  if(WZ.idea.title==="(sequel)") return sequelTitle0(WZ);
  if(WZ.idea.title==="(spin-off)") return WZ.idea.spinoffFr.name+": "+DATA.SPINOFF_SUFFIX[0];
  return WZ.idea.title;
}

/* ══════════════════════════════════════════════════════════════════
   v5 UI additions — tutorial, deepfake game, gestures, FYC & empire modal
   ══════════════════════════════════════════════════════════════════ */

/* ── Interactive 5-week tutorial (continues across the top of every render) ── */
function tutBanner(){
  if(!G) return "";
  const T=G.tutorial;
  if(!T || T.done || T.step>=DATA.TUT_STEPS.length) return "";
  const s=DATA.TUT_STEPS[T.step];
  return "<div class='card' style='border-left:3px solid #6ee7ff;margin-bottom:10px'>"+
    "<div class='spread'><b>"+s.icon+" Tutorial · step "+(T.step+1)+" of "+DATA.TUT_STEPS.length+" — "+s.title+"</b>"+
    "<button class='btn btn-sm btn-ghost' id='tutSkip'>Skip ✕</button></div>"+
    "<div class='small muted' style='margin-top:4px'>"+s.text+"</div>"+
    "<div class='row' style='margin-top:6px'>"+
      DATA.TUT_STEPS.map((x,i)=>"<span class='tag' style='"+(i<T.step?"border-color:var(--green);color:var(--green)":i===T.step?"border-color:#6ee7ff;color:#6ee7ff":"")+"'>"+x.icon+"</span>").join("")+
    "</div></div>";
}

function tutTrack(){
  const T=G && G.tutorial;
  if(!T || T.done || T.step>=DATA.TUT_STEPS.length) return;
  const until=DATA.TUT_STEPS[T.step].until;
  const projs=G.projects||[], films=G.films||[];
  let ok=false;
  if(until==="wizard")   ok = !!document.querySelector("#wzBudget,[data-coprod],[data-wz]") || projs.length>0 || films.length>0;
  if(until==="greenlit") ok = projs.length>0 || films.length>0;
  if(until==="ready")    ok = projs.some(p=>p.phase==="ready") || films.length>0;
  if(until==="dated")    ok = projs.some(p=>p.phase==="ready" && p.releaseWeek) || films.length>0;
  if(until==="released") ok = films.length>0;
  if(!ok) return;
  T.step++;
  if(T.step>=DATA.TUT_STEPS.length){
    T.done=true;
    G.studio.rep=clamp(G.studio.rep+(DATA.TUT_REWARD.rep||1),5,99);
    log(DATA.TUT_REWARD.text,"gold");
    beep("gold");
  }else{
    toast("🎓 Tutorial "+(T.step)+"/"+DATA.TUT_STEPS.length+" — "+DATA.TUT_STEPS[T.step].title,"gold");
  }
  saveGame();
}

/* ── Deepfake detection mini-game: spot the ONE synthetic frame among 4 ── */
function deepfakeModal(){
  const d=G.pendingDeepfake; if(!d) return;
  const t=G.talent.find(x=>x.id===d.talentId);
  const name=t? t.name : "One of your stars";
  const real=[
    {shot:"🎤", desc:name+" at a chat-show desk — blinks twice mid-answer, mic rustle desyncs half a frame."},
    {shot:"🌆", desc:name+" leaving Nobu — paparazzi flash catches an awkward eye squint and natural motion blur."},
    {shot:"🎭", desc:"Behind-the-scenes clip — "+name+" laughs off-script, breath fog visible in the cold."},
  ];
  const fake={shot:"🧬", desc:"“Leaked” clip of "+name+" trashing fans — skin too smooth at the jawline, earrings swap sides between cuts, lips lag the audio."};
  const frames=()=>{ const f=real.slice(); f.splice(rint(0,3),0,fake); return f; };
  // keep the deck stable while the modal is open (re-renders redraw it)
  d.deck = d.deck || frames();
  d.fakeIdx = d.deck.indexOf(fake);
  let h="<h3>🧬 Deepfake alert</h3>"+
    "<div class='card' style='border-left:3px solid var(--red)'>A clip said to be <b>"+esc(name)+"</b> torching their own fanbase is going viral. Your forensic team pulled four frames from the footage. <b>Exactly one is synthetic.</b> Flag the fake in time and the debunk goes viral (+1 rep); flag a real one and the scandal lands for real.</div>"+
    "<div class='tiny muted'>Pick the frame that isn't real:</div>";
  d.deck.forEach((f,i)=>{
    h+="<button class='card btn-ghost' style='display:block;width:100%;text-align:left;margin-top:8px' data-frame='"+i+"'><span style='font-size:22px'>"+f.shot+"</span> <span class='small'>"+f.desc+"</span></button>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='dfDefer'>Stall the press (decide later)</button></div>";
  const v=openModal(h,{noX:true});
  v.querySelectorAll("[data-frame]").forEach(b=>b.onclick=()=>{
    const hit = (+b.dataset.frame)===d.fakeIdx;
    resolveDeepfake(hit);
    beep(hit?"gold":"bad");
    closeModal(); flashes(G.flash); render();
  });
  const df=v.querySelector("#dfDefer"); if(df) df.onclick=()=>{ closeModal(); toast("⏳ The internet convenes in 2 weeks if you don't.","bad"); render(); };
}

/* ── FYC campaign budget slider (item 5) ── */
function fycModal(fid){
  const f=G.films.find(x=>x.id===fid); if(!f) return;
  const spent=f.fyc;
  let h="<h3>🗳 FYC campaign — “"+esc(f.title)+"”</h3>"+
    "<div class='tiny muted'>Trade ads, screeners, luncheons, Q&amp;As. Every dollar becomes awards momentum — first push 110¢ on the dollar, top-ups 60¢. Critics' score "+f.criticAvg+" · audience "+f.audAvg+" · momentum now "+Math.round(f.campaign||0)+".</div>"+
    "<div class='card' style='margin-top:8px'><div class='spread small'><b>Budget</b><b id='fycV' class='gold'></b></div>"+
    "<input type='range' id='fycAmt' min='2' max='20' step='1' value='4' style='width:100%'>"+
    "<div class='tiny muted' style='margin-top:4px' id='fycProj'></div></div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>"+t("btn.close")+"</button>"+
    "<button class='btn btn-primary' id='fycGo'>Launch campaign</button></div>";
  const v=openModal(h);
  const amt=v.querySelector("#fycAmt");
  const upd=()=>{ const a=+amt.value;
    v.querySelector("#fycV").textContent=fmtM(a);
    v.querySelector("#fycProj").textContent="≈ +"+Math.round(a*1.1*(spent?0.6:1))+" momentum"+(a>(G.studio.cash)?" — more than you have in cash":"");
  };
  amt.oninput=upd; upd();
  v.querySelector("#fycGo").onclick=()=>{
    if(fycFilm(fid,+amt.value)){ beep("gold"); closeModal(); flashes(G.flash); render(); }
    else { beep("bad"); upd(); }
  };
}

/* ── Empire: the "⋯ More moves" sheet — collabs, DTV, resort, publishing,
      licensing out, crossovers and shared-universe weaves ── */
function empireModal(frId){
  const fr=frById(frId); if(!fr) return;
  const others=G.franchises.filter(x=>x!==fr);
  let h="<h3>🏰 "+esc(fr.name)+" — empire moves</h3>"+
    "<div class='tiny muted'>Tier "+fr.tier+" · fatigue "+Math.round((fr.fatigue||0)*100)+"% · heat "+Math.round(clamp(1-(fr.decay||0),0,1)*100)+"%</div>";
  h+="<div class='card' style='margin-top:8px'><div class='row'>"+
    (((fr.collabAt||0)>G.week)? "<span class='tag green'>🤝 collab live</span>" : "<button class='btn btn-sm btn-alt' id='emCollab'>🤝 Brand collab · $6M</button>")+
    (((fr.dtvAt||0)>G.week)? "<span class='tag green'>📀 DTV in stores</span>" : "<button class='btn btn-sm btn-alt' id='emDtv'>📀 DTV sequel · $12–22M</button>")+
    (fr.publishing? "<span class='tag green'>📚 publishing arm</span>" : "<button class='btn btn-sm btn-alt' id='emPub'>📚 Publishing arm · $15M</button>")+
  "</div></div>";
  h+="<div class='card'><div class='row'>"+
    (fr.resort? "<span class='tag green'>🏝 resort open</span>" : (fr.park>=1? "<button class='btn btn-sm btn-gold' id='emResort'>🏝 Resort & cruise line · $400M</button>" : "<span class='tiny muted'>🏝 Resort unlocks after the first 🎡 attraction</span>"))+
  "</div></div>";
  h+="<div class='card'><b>📦 License it out</b><div class='tiny muted' style='margin:4px 0'>Hand the brand to a rival for a fat upfront fee + a backend settlement on “"+dateLabel(G.week+39)+"”-ish paper. Brand heat fades while it's away.</div><div class='row'>"+
    (((fr.licenseAt||0)>G.week)? "<span class='tag green'>already out</span>" :
      "<button class='btn btn-sm btn-alt' id='emLicFilm'>🎬 Film remake rights</button>"+
      (fr.merch>=1? "<button class='btn btn-sm btn-alt' id='emLicGoods'>🥤 Consumer goods</button>" : ""))+
  "</div></div>";
  if(others.length && fr.tier>=3){
    h+="<div class='card'><b>💥 Crossover film</b> <span class='tiny muted'>($40M · tentpole idea lands in Develop · both brands tier 3+)</b><div class='row' style='margin-top:6px'>"+
      others.filter(o=>o.tier>=3)
        .map(o=>"<button class='btn btn-sm btn-alt' data-em-cross='"+o.id+"'>× "+esc(o.name)+"</button>").join("")+
      (others.filter(o=>o.tier<3).length? "<span class='tiny muted'>"+others.filter(o=>o.tier<3).length+" brand(s) below tier 3</span>" : "")+
    "</div></div>";
  }
  if(others.length && !G.universeBonus){
    h+="<div class='card'><b>🌌 Weave a shared universe</b> <span class='tiny muted'>($150M · all franchise income +15% forever · one-time)</b><div class='row' style='margin-top:6px'>"+
      others
        .map(o=>"<button class='btn btn-sm btn-alt' data-em-merge='"+o.id+"'>⚭ "+esc(o.name)+"</button>").join("")+
    "</div></div>";
  }
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>"+t("btn.close")+"</button></div>";
  const v=openModal(h);
  const go=(fn,arg)=>()=>{ fn.call(null,arg); beep("gold"); closeModal(); flashes(G.flash); render(); };
  const grab=id=>v.querySelector(id);
  if(grab("#emCollab")) grab("#emCollab").onclick=go(brandCollab, fr.id);
  if(grab("#emDtv"))    grab("#emDtv").onclick=go(dtvSequel, fr.id);
  if(grab("#emPub"))    grab("#emPub").onclick=go(launchPublishing, fr.id);
  if(grab("#emResort")) grab("#emResort").onclick=go(buildResort, fr.id);
  if(grab("#emLicFilm"))  grab("#emLicFilm").onclick=go(()=>licenseOut(fr.id,"film"));
  if(grab("#emLicGoods")) grab("#emLicGoods").onclick=go(()=>licenseOut(fr.id,"goods"));
  v.querySelectorAll("[data-em-cross]").forEach(b=>b.onclick=go(()=>crossoverEvent(fr.id,+b.dataset.emCross)));
  v.querySelectorAll("[data-em-merge]").forEach(b=>b.onclick=go(()=>mergeUniverse(fr.id,+b.dataset.emMerge)));
}

/* ── Mobile gestures (item 34): swipe between tabs · pull-down at top = next week ── */
function installGestures(){
  if(installGestures._done) return;
  installGestures._done=true;
  const ORDER=["studio","develop","productions","boxoffice","ott","empire","finance"];
  let sx=0, sy=0, topY=0, pulled=false;
  document.addEventListener("touchstart",e=>{
    if(!e.touches.length) return;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; topY=window.scrollY;
    pulled=false;
  },{passive:true});
  document.addEventListener("touchmove",e=>{
    if(!e.touches.length || !G || G.over) return;
    const dy=e.touches[0].clientY-sy, dx=e.touches[0].clientX-sx;
    // pull-to-refresh = advance one week, only when already at scroll top
    if(topY<=2 && window.scrollY<=2 && dy>95 && !pulled){
      pulled=true;
      if(document.querySelector("#modalRoot .modal-veil")) return;
      rumble([15,30,15]);
      toast("⏩ One week, on the house","");
      doWeek(1);
    }
  },{passive:true});
  document.addEventListener("touchend",e=>{
    if(!G || pulled || !e.changedTouches.length) return;
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>72 && Math.abs(dx)>Math.abs(dy)*1.5){
      if(document.querySelector("#modalRoot .modal-veil")) return;
      const i=ORDER.indexOf(TAB); if(i<0) return;
      const next=ORDER[clamp(dx<0? i+1 : i-1, 0, ORDER.length-1)];
      if(next!==TAB){ rumble(12); switchTab(next); }
    }
  },{passive:true});
}
