/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — ui.js (rendering + interaction)
   ═══════════════════════════════════════════════════════════ */
"use strict";

let TAB = "studio";
let WZ = null;          // greenlight/pitch wizard state
let SCHEDULE = null;    // release scheduling state
let SOUND = true;

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
function beep(kind){
  const ac = audioCtx();
  if(!ac) return;
  try{ (STINGS[kind]||STINGS.click)(ac, ac.currentTime + 0.01); }catch(e){}
}

/* ═══════════ v4 motion: confetti burst ═══════════ */
function confetti(opts){
  opts = opts||{};
  if(typeof document==="undefined") return;
  try{ if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; }catch(e){}
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
  if(G.pendingEarnings) earningsModal();
  else if(G.pendingChoice) choiceModal();
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
  render();
  if(G.pendingEarnings) earningsModal();
  else if(G.pendingChoice) choiceModal();
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
  if(G.streamer) h+="<div class='card' style='border-left:3px solid var(--purple)'><b>📱 "+esc(G.streamer.name)+"</b> — "+G.streamer.subs.toFixed(1)+"M subs · +"+fmtM(G.streamer.income)+"/wk · ceiling "+streamerCeiling()+"M</div>";
  h+="<div class='card' style='border-left:3px solid var(--line)'><div class='spread'><span class='small muted'>🎞 Exhibitor relations</span><b class='"+(G.exhibitor>=50?"pos":"neg")+"'>"+Math.round(G.exhibitor||50)+"/100</b></div>"+meter(G.exhibitor||50,100)+"<div class='tiny muted'>Short windows anger exhibitors and swing openings ±5%.</div></div>";
  h+="<div class='section-title'>Market share — Year "+yr+" (worldwide gross)</div><div class='card'>";
  const rows=[{name:G.studio.name, ww:myYtd, me:true}].concat(G.rivals.map(r=>({name:r.name, ww:r.ytd})));
  const max=Math.max(1,...rows.map(r=>r.ww));
  rows.sort((a,b)=>b.ww-a.ww).forEach((r,i)=>{
    h+="<div class='chart-bar' style='margin:5px 0'><div class='cb-rank'>"+(i+1)+"</div><div><div class='cb-name'>"+(r.me?"⭐ ":"")+esc(r.name)+"</div></div>"+
       "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(6,r.ww/max*100)+"%;background:"+(r.me?"linear-gradient(90deg,#f5b942,#ffd479)":"#4a5570")+"'>"+fmtM(r.ww)+"</div></div></div>";
  });
  h+="</div>";
  if((G.achv||[]).length){
    h+="<div class='section-title'>🏅 Achievements ("+G.achv.length+")</div><div class='card'><div class='row'>"+
       G.achv.map(function(a){ return "<span class='tag gold' title='"+esc(a.desc)+"'>🏅 "+esc(a.title)+"</span>"; }).join("")+"</div></div>";
  }
  h+="<div class='card' style='display:flex;gap:8px;flex-wrap:wrap;align-items:center'>"+
     "<b>📸 Share your studio</b><span class='tiny muted' style='flex:1'>Snapshot your empire as a PNG card.</span>"+
     "<button class='btn btn-sm btn-primary' id='btnShareCard'>Generate card</button></div>";
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
function trendBoard(){
  const gs=Object.keys(DATA.GENRES).map(g=>({g, v:trendOf(g)})).sort((a,b)=>b.v-a.v);
  const weeksLeft=Math.max(0,(G.trendShiftAt||G.week)-G.week);
  let h="<div class='spread'><div class='section-title' style='margin:0'>📈 Genre trends</div>"+
        "<span class='tiny muted'>market re-rates in "+weeksLeft+" wk"+(weeksLeft===1?"":"s")+"</span></div>";
  h+="<div class='card trend-board'>";
  gs.forEach(function(row){
    const g=row.g, v=row.v, G0=DATA.GENRES[g], l=trendLabel(g);
    const pct=clamp((v-0.78)/(1.28-0.78)*100,3,100);
    h+="<div class='trend-row'><div class='tr-name'>"+G0.emoji+" "+G0.name+"</div>"+
       "<div class='tr-track'><div class='tr-fill "+(v>=1.07?"hot":v<=0.94?"cold":"")+"' style='width:"+pct+"%'></div></div>"+
       "<div class='tr-val'><span class='tag "+l.cls+"'>"+l.tag+"</span> <b>"+v.toFixed(2)+"×</b></div></div>";
  });
  h+="<div class='tiny muted' style='margin-top:6px'>Heat multiplies opening weekend and streaming appetite, and it shifts every quarter. Hits warm a genre up; flops cool it down.</div></div>";
  return h;
}
function viewDevelop(){
  let h="";
  h+=trendBoard();
  h+="<div class='spread'><div class='section-title' style='margin:0'>Script market</div>"+
     "<button class='btn btn-sm' id='btnPitchSeries'>📺 Pitch a Series</button></div>";
  h+="<div class='grid g2' style='margin-top:8px'>";
  for(const i of G.ideas){
    const S=DATA.SCALES[i.scale];
    const tl=trendLabel(i.genre);
    h+="<div class='card idea-card'><div class='spread'><h4>"+(DATA.GENRES[i.genre].emoji)+" "+esc(i.title)+"</h4>"+
      (i.hot?"<span class='tag red'>🔥 Hot spec</span>":"")+"</div>"+
      "<div class='idea-blurb'>“"+esc(i.blurb)+"”</div>"+
      "<div class='idea-meta'>"+gTag(i.genre)+"<span class='tag'>"+S.emoji+" "+S.name+"</span>"+
      "<span class='tag "+(i.script>=75?"green":i.script>=60?"gold":"")+"'>📝 Script "+i.script+"</span>"+
      "<span class='tag "+tl.cls+"'>"+tl.tag+" "+trendOf(i.genre).toFixed(2)+"×</span></div>"+
      "<div class='row' style='margin-top:10px'><span class='small muted'>Est. budget "+fmtM(neededBudget(i.genre,i.scale))+" · dev rights "+fmtM(devCostOf(i))+"</span></div>"+
      "<button class='btn btn-primary' style='margin-top:10px;width:100%' data-dev='"+i.id+"'>🎬 Develop this</button></div>";
  }
  h+="</div>";
  const freeA=freeTalent("actor").sort((a,b)=>b.power-a.power||b.skill-a.skill);
  const freeD=freeTalent("director").sort((a,b)=>b.power-a.power||b.skill-a.skill);
  const freeW=freeTalent("writer").sort((a,b)=>b.skill-a.skill||b.power-a.power);
  const freeP=freeTalent("producer").sort((a,b)=>b.skill-a.skill||b.power-a.power);
  h+="<div class='section-title'>✍️ Writers on the market ("+freeW.length+")</div><div class='grid g3'>";
  for(const w of freeW.slice(0,6)) h+=talentCard(w);
  if(!freeW.length) h+="<div class='card muted small'>Every writer in town is working.</div>";
  h+="</div>";
  h+="<div class='section-title'>🎫 Producers on the market ("+freeP.length+")</div><div class='grid g3'>";
  for(const p of freeP.slice(0,6)) h+=talentCard(p);
  if(!freeP.length) h+="<div class='card muted small'>No producers free — overruns will be on you.</div>";
  h+="</div>";
  h+="<div class='section-title'>🎬 Directors &amp; 🌟 cast</div><div class='grid g3'>";
  for(const d of freeD.slice(0,6)) h+=talentCard(d);
  h+="</div><div class='grid g3' style='margin-top:8px'>";
  for(const a of freeA.slice(0,9)) h+=talentCard(a);
  const hidden=freeA.length+freeD.length-15;
  if(hidden>0)h+="<div class='card muted small' style='display:flex;align-items:center;justify-content:center'>+ "+hidden+" more on the market → refreshed weekly</div>";
  h+="</div>";
  if((G.retired||[]).length){
    h+="<div class='section-title'>👋 Recently retired</div><div class='card'>";
    G.retired.slice(-6).reverse().forEach(function(r){
      h+="<div class='cost-line'><span>"+esc(r.name)+" <span class='tiny muted'>"+kindLabel(r.kind)+"</span></span><b class='muted'>age "+r.age+" · "+dateLabel(r.week)+"</b></div>";
    });
    h+="</div>";
  }
  return h;
}
function talentCard(t){
  const fee=actorFee(t);
  const icon={writer:"✍️",producer:"🎫",director:"🎬"}[t.kind] || (t.power>=4?"🌟":"🙂");
  let line;
  if(t.kind==="director")      line="Skill "+t.skill+" · fits "+DATA.GENRES[t.genreFit].name;
  else if(t.kind==="writer")   line="Skill "+t.skill+" · specialises in "+DATA.GENRES[t.genreFit].name;
  else if(t.kind==="producer") line="Skill "+t.skill+" · "+(t.skill>=80?"schedule shaver":t.skill<58?"overrun risk":"steady hand");
  else                         line="Skill "+t.skill+" · acting";
  return "<div class='card talent-card'><div class='t-avatar'>"+icon+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(t.name)+(t.trait?" <span class='tiny muted'>"+esc(t.trait)+"</span>":"")+"</div>"+
    "<div>"+stars(t.power)+"</div>"+
    "<div class='t-stats'>"+line+
    (t.age? " · age "+t.age:"")+
    (t.heat?" · <span class='gold'>heat ×"+t.heat+"</span>":"")+
    (t.scandal>0?" · <span class='neg'>⚠ scandal</span>":"")+
    (t.comeback?" · <span class='pos'>comeback</span>":"")+"</div>"+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(fee)+" fee</span></div></div></div>";
}

/* ── greenlight wizard (film & sequel) ── */
function startWizard(idea){
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], sub:2,
      budget:Math.round(neededBudget(idea.genre,idea.scale)), plan:"theatrical", presales:false,
      rating:"PG-13", location:"la", scriptPolish:false, premium:false};
  wizardModal();
}
function startSequel(film){
  const idea={ id:nid(), genre:film.genre, scale:film.scale, title:"(sequel)", blurb:"The saga continues…",
    script:clamp((film.quality?film.quality.overall:65)+5,55,95), hot:true, sequelOf:film };
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], sub:2, seqBudgetFixed:true,
      budget:Math.round(film.budget*1.3),
      rating:"PG-13", location:"la", scriptPolish:false, premium:false};
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
  return "<div class='card talent-card"+(opts.sel?" sel-card":"")+"' "+(opts.attr||"")+">"+
    "<div class='t-avatar'>"+icon+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(t.name)+(t.trait? " <span class='tiny muted'>"+esc(t.trait)+"</span>":"")+"</div>"+
    stars(t.power)+
    "<div class='t-stats'>"+line+
      (t.age? " · <span class='muted'>age "+t.age+"</span>":"")+
      (t.heat? " · <span class='gold'>heat ×"+t.heat+"</span>":"")+
      (t.scandal>0? " · <span class='neg'>⚠ scandal</span>":"")+
      (t.comeback? " · <span class='pos'>comeback</span>":"")+
    "</div>"+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(t))+"</span>"+
      (opts.sel?"<span class='tag green'>✓ attached</span>":"")+"</div></div></div>";
}
function wizardModal(){
  const S=DATA.SCALES[WZ.idea.scale];
  const step = WZ.sub;
  const gname = DATA.GENRES[WZ.idea.genre].name;
  let h="<h3>🎬 Greenlight: “"+esc(WZ.idea.title==="(sequel)"? sequelTitle0(WZ) : WZ.idea.title)+"”</h3>"+
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
    if(!ws.length) h+="<div class='card muted small'>Every writer in town is booked. You can shoot the spec as-is.</div>";
    h+="<div class='pick-list'>";
    ws.slice(0,10).forEach(function(w){ h+=crewCard(w,{genre:WZ.idea.genre, sel:!!(WZ.writer&&WZ.writer.id===w.id), attr:"data-writer='"+w.id+"'"}); });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzSkipWriter'>Shoot the spec as-is →</button>"+
       (WZ.writer? "<button class='btn btn-primary' id='wzNext'>To Director →</button>":"")+"</div>";
  }else if(step===3){
    const dirs=freeTalent("director").sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>A director shapes ~25% of quality. Genre fit adds a bonus. Bigger names also lift buzz.</p><div class='pick-list'>";
    dirs.slice(0,10).forEach(function(d){ h+=crewCard(d,{genre:WZ.idea.genre, sel:!!(WZ.director&&WZ.director.id===d.id), attr:"data-dir='"+d.id+"'"}); });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzBackWriter'>← Writer</button>"+
       (WZ.director? "<button class='btn btn-primary' id='wzNext'>To Cast →</button>":"")+"</div>";
  }else if(step===4){
    const acts=freeTalent("actor").sort((a,b)=>(b.power*20+b.skill)-(a.power*20+a.skill));
    h+="<p class='small muted'>Pick 1–3 leads. Star power (★) drives opening weekend; skill drives reviews. Scandal-hit stars come cheap — and cost you at the box office.</p><div class='pick-list'>";
    acts.slice(0,12).forEach(function(a){ h+=crewCard(a,{sel:WZ.cast.some(c=>c.id===a.id), attr:"data-cast='"+a.id+"'"}); });
    h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='wzBackDir'>← Director</button><button class='btn btn-primary' id='wzNext'>Continue with "+WZ.cast.length+" →</button></div>";
  }else if(step===5){
    const prods=freeTalent("producer").sort((a,b)=>b.skill-a.skill||b.power-a.power);
    h+="<p class='small muted'>A producer runs the floor: they cut the odds and the size of <b>cost overruns</b>, squeeze extra production value out of the same budget, and a great one shaves a week off the shoot. Skip it and every overrun lands on you.</p>";
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
    h+="<div class='tiny' style='margin-bottom:8px'>"+crewLine+"</div>";
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
    h+="<div class='small muted' style='margin:4px 0 6px'><b>Distribution plan</b> — commit now or keep options open</div><div class='plan-pick'>"+
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
    greenlight({ idea:WZ.idea, writer:WZ.writer, director:WZ.director, producer:WZ.producer, cast:WZ.cast,
      budget:WZ.budget, sequelOf:WZ.idea.sequelOf, plan:WZ.plan, presales:WZ.presales,
      rating:WZ.rating, location:WZ.location, scriptPolish:WZ.scriptPolish, premium:WZ.premium });
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

/* ═══════════ VIEW: productions ═══════════ */
function viewProductions(){
  let h="";
  const ready=readyProjects(), prod=inProdProjects();
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
      "<button class='btn btn-sm btn-danger' style='margin-top:8px' data-cancel='"+p.id+"'>✕ Shelve (lose spend)</button></div>";
  }
  h+="<div class='section-title'>Ready for release ("+ready.length+")</div>";
  if(!ready.length) h+="<div class='card muted small'>Nothing in the can yet.</div>";
  for(const p of ready){
    const rl=DATA.rating(p.rating), lo=DATA.location(p.location);
    h+="<div class='card'><div class='spread'><div><b>🎞 "+esc(p.title)+"</b> "+scoreBadge(p.quality.overall)+
      (p.prebuyAccepted?"<div class='tiny gold'>Sold to "+DATA.platform(p.prebuyPlatform).name+" — payable on delivery</div>":"")+"</div></div>"+
      "<div class='tiny muted' style='margin-top:6px'>Critics "+p.quality.critic+" · Audience "+p.quality.aud+" · budget "+fmtM(p.budget)+(p.overrun>0? " (incl. "+fmtM(p.overrun)+" overrun)":"")+" · breakeven "+fmtM(breakevenWW(p))+" WW</div>"+
      (p.writer||p.producer? "<div class='tiny muted'>"+(p.writer? "✍️ "+esc(p.writer.name)+" ("+(p.writerBonus>=0?"+":"")+p.writerBonus+" script)":"")+(p.producer? " · 🎫 "+esc(p.producer.name):"")+"</div>":"")+
      "<div class='row' style='margin-top:6px'><span class='tag "+(p.rating==="R"?"red":"blue")+"'>"+p.rating+"</span><span class='tag'>"+lo.name+" ("+Math.round(lo.rebate*100)+"%)</span>"+
        (p.premium?"<span class='tag gold'>🍿 IMAX/Premium</span>":"")+
        (p.scriptPolish?"<span class='tag green'>✍️ polish</span>":"")+"</div>"+
      (p.prebuyAccepted?"":"<div class='row' style='margin-top:10px'><button class='btn btn-primary' data-sched='"+p.id+"'>📅 Theatrical Release</button><button class='btn btn-alt' data-shop='"+p.id+"'>📺 Shop to Streamers</button>"+
        "<button class='btn btn-ghost' data-test='"+p.id+"'>🎬 Test screen &amp; reshoot</button></div>")+"</div>";
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
  SCHEDULE={p, week:G.week+4, marketing:recMarketing(p), sel:false, premium:!!p.premium, window:p.window||"45", dayAndDate:!!p.dayAndDate};
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
  h+="</div><div class='tiny muted' style='margin:2px 0 4px'>"+DATA.window(SCHEDULE.window||"45").desc+" <span class='muted'>(exhibitor mood: "+Math.round(G.exhibitor||50)+"/100)</span></div>";
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
    h+="<div class='calendar-row"+(SCHEDULE.week===w?" sel":"")+"' data-w='"+w+"'><div class='cal-when'><b>"+s.month+" W"+woyOf(w)+"</b><span>Year "+yearOf(w)+"</span></div>"+
      "<div class='cal-note'>"+heat+" "+(note? "<br>"+note : "<span class='muted'>clean weekend</span>")+"</div>"+
      "<div class='tiny muted'>opens ≈ "+fmtG(previewOpen(p,w))+"</div></div>";
  }
  h+="</div>";
  // summary
  const exp=previewOpen(p,SCHEDULE.week);
  const effMkt = SCHEDULE.premium? Math.round(SCHEDULE.marketing*1.08) : SCHEDULE.marketing;
  const be=breakevenWW({budget:p.budget, marketing:effMkt});
  h+="<div class='card' style='margin-top:10px'><div class='cost-line'><span>Expected opening (est.)</span><b id='scExp'>"+fmtG(exp)+" dom</b></div>"+
    "<div class='cost-line'><span>Breakeven</span><b id='scBe'>"+fmtG(be)+" WW</b></div>"+
    "<div class='cost-line'><span>Pay now (30% P&A)</span><b id='scPay'>"+fmtM(effMkt*0.3)+"</b></div></div>";
  h+="<div class='modal-actions'><button class='btn btn-primary' id='scGo'>📅 Lock the date</button></div>";
  const v=openModal(h,{onClose:()=>{SCHEDULE=null;}});
  const rg=v.querySelector("#scMkt");
  rg.oninput=()=>{
    SCHEDULE.marketing=+rg.value;
    $("#scMktV").textContent=fmtM(SCHEDULE.marketing);
    const e2=previewOpen(p,SCHEDULE.week);
    const effMkt = SCHEDULE.premium? Math.round(SCHEDULE.marketing*1.08) : SCHEDULE.marketing;
    const eEl=$("#scExp"), bEl=$("#scBe"), pEl=$("#scPay");
    if(eEl) eEl.textContent=fmtG(e2)+" dom";
    if(bEl) bEl.textContent=fmtG(breakevenWW({budget:p.budget, marketing:effMkt}))+" WW";
    if(pEl) pEl.textContent=fmtM(effMkt*0.3);
  };
  v.querySelectorAll("[data-w]").forEach(el=>el.onclick=()=>{ SCHEDULE.week=+el.dataset.w; beep("click"); schedModal(); });
  const pm=v.querySelector("#scPremium"); if(pm) pm.onclick=()=>{ SCHEDULE.premium=!SCHEDULE.premium; beep("click"); schedModal(); };
  v.querySelectorAll("[data-win]").forEach(b=>b.onclick=()=>{ SCHEDULE.window=b.dataset.win; beep("click"); schedModal(); });
  const dt=v.querySelector("#scDayToggle"); if(dt) dt.onclick=()=>{ SCHEDULE.dayAndDate=!SCHEDULE.dayAndDate; beep("click"); schedModal(); };
  v.querySelector("#scGo").onclick=()=>{
    const mkt = SCHEDULE.premium? Math.round(SCHEDULE.marketing*1.08) : SCHEDULE.marketing;
    const want=Math.round(mkt*0.3);
    // pay what you can now; the rest is due at release (advanceWeek collects it)
    const now=Math.min(want, Math.max(0, Math.floor(G.studio.cash)));
    p.releaseWeek=SCHEDULE.week; p.marketing=mkt; p.marketingPaid=now; p.premium=SCHEDULE.premium;
    p.window=SCHEDULE.window; p.dayAndDate=SCHEDULE.dayAndDate;
    G.studio.cash-=now;
    if(now<want) log("📅 “"+p.title+"” dated for "+seasonDateLabel(SCHEDULE.week)+" with "+fmtM(mkt)+" P&A — "+fmtM(now)+" paid now, "+fmtM(want-now)+" due at release (fees continue to accrue).","gold");
    else log("📅 “"+p.title+"” dated for "+seasonDateLabel(SCHEDULE.week)+" with "+fmtM(mkt)+" P&A"+(SCHEDULE.premium?" (+Premium/IMAX)":"")+" · "+(DATA.window(SCHEDULE.window).name)+(SCHEDULE.dayAndDate?" · day-and-date":"")+".","gold");
    beep("gold"); SCHEDULE=null; closeModal(); render();
  };
}
function previewOpen(p,w){
  const saved={m:p.marketing, r:p.releaseWeek, pr:p.premium};
  p.marketing=SCHEDULE?SCHEDULE.marketing:p.marketing; p.releaseWeek=w;
  if(SCHEDULE) p.premium=SCHEDULE.premium;
  const v=expectedOpening(p,w);
  p.marketing=saved.m; p.releaseWeek=saved.r; p.premium=saved.pr;
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
    h+="<div class='card review-card'><div class='spread'><div><b>"+esc(r.name)+"</b> <span class='tiny muted'>"+esc(r.outlet)+"</span></div>"+
       "<b class='"+(r.score>=70?"pos":r.score>=50?"":"neg")+"'>"+r.score+"/100</b></div>"+
       "<div class='small' style='margin-top:4px'>“"+esc(r.quote)+"”</div></div>";
  });
  if(f.reviewBombed) h+="<div class='card' style='border-left:3px solid var(--red)'><b>🍅 Review bombing</b><div class='tiny muted'>An organised pile-on cost this film "+f.reviewBombed+" audience points — and the word of mouth that goes with them.</div></div>";
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Close</button></div>";
  openModal(h);
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
      "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(7,c.gross/max*100)+"%;background:"+(c.mine?"linear-gradient(90deg,#f5b942,#ffd479)":(c.color||"#4a5570"))+"'>"+fmtG(c.gross)+"</div></div></div>";
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
      "<div class='weekly-gross-chart'>"+f.weekly.slice(-12).map(x=>"<div class='wg' style='height:"+Math.max(4,x.gross/f.opening*100)+"%' title='"+fmtG(x.gross)+"'></div>").join("")+"</div>"+
      "<div class='spread small' style='margin-top:6px'><span class='muted'>Tracking ≈ "+fmtG(projWW)+" WW vs "+fmtG(be)+" breakeven</span>"+
      "<span class='"+(projWW>=be?"pos":"neg")+"'>"+(projWW>=be?"on pace to profit":"below breakeven")+"</span></div>"+
      scoreSplit(f)+
      "<div class='row' style='margin-top:4px'><button class='btn btn-sm btn-ghost' data-reviews='"+f.id+"'>🗞 Read the reviews</button></div>"+
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
      ((f.reviews&&f.reviews.length)?" <button class='btn btn-sm btn-ghost' data-reviews='"+f.id+"'>🗞 "+(f.criticAvg||0)+"%</button>":"")+
      "<div class='tiny muted'>"+DATA.GENRES[f.genre].name+" · "+fmtM(f.budget)+" budget · "+fmtG(f.ww||0)+" WW"+
      (f.soldTo?" · licensed to "+f.soldTo:"")+(f.onOwn?" · on your platform":"")+(f.dayAndDate?" · 🎞 day-and-date":"")+" · "+(DATA.window(f.window||"45").name)+"</div></div>"+
      "<div style='text-align:right'><b class='"+(f.profit>=0?"pos":"neg")+"'>"+(f.profit>=0?"+":"")+fmtM(f.profit||0)+"</b><div class='tiny muted'>net</div>"+
      (G.streamer && !f.streamingOriginal && !f.soldTo && !f.onOwn && !f.inTheaters? "<button class='btn btn-sm btn-alt' style='margin-top:4px' data-movestr='"+f.id+"'>📱 → your platform</button>":"")+
      "</div></div>";
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
    h+="<div class='card'><div class='tiny muted' style='margin-bottom:6px'>Quarterly sealed-bid auctions (weeks 13/26/39/52) for soccer, hoops, racing and fights ($70–170M). Winning bumps subscribers and raises your content ceiling; the sport power decays ~1.5%/wk.</div>";
    const held=DATA.SPORTS.filter(s=>won.includes(s.id));
    if(held.length){ h+="<div class='row'>"; held.forEach(s=>{ h+="<span class='tag gold'>"+s.icon+" "+s.name+"</span>"; }); h+="</div>"; }
    else h+="<div class='tiny muted'>No sports rights yet. An auction will arrive near week 13, 26, 39 or 52.</div></div>";
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
  // 12-week cash-flow forecast
  const fc=forecastProject();
  h+="<div class='section-title'>📈 12-week cash-flow forecast</div><div class='card'><div class='tiny muted' style='margin-bottom:6px'>Rough projection of income vs commitments over the next 12 weeks.</div><div class='forecast-bars'>"+
    fc.rows.map(r=>"<div class='fg' title='"+dateLabel(r.week)+": "+(r.net>=0?"+":"")+fmtM(r.net)+" → "+fmtM(r.cash)+"'><i style='height:"+Math.max(4,clamp((fc.start? r.cash/fc.start:1),0,1)*100)+"%'></i><span>"+woyOf(r.week)+"</span></div>").join("")+
    "</div><div class='tiny muted' style='margin-top:4px'>Projected cash in 12 wks: <b class='"+(fc.rows.length&&fc.rows[fc.rows.length-1].cash>=0?"pos":"neg")+"'>"+fmtM(fc.rows.length?fc.rows[fc.rows.length-1].cash:st.cash)+"</b></div></div>";
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
  return h;
}

const PL_LABELS={theatrical:"🎬 Box office rentals", pvod:"🏠 Premium VOD", streaming:"📺 Streaming deals", series:"📺 Series licenses", empire:"🏰 Franchise & parks", library:"📚 Library licensing", presales:"🌍 Intl pre-sales", incentives:"🧾 Production incentives", production:"🎬 Production spend", marketing:"📣 Marketing (P&A)", talent:"🌟 Talent & fees", development:"📝 Development", overhead:"🏛 Overhead", interest:"🏦 Interest", studio:"🏗 Studio investment", streamer:"📱 Platform subs", pay1:"📺 Pay-1 TV", other:"❓ Other"};
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
  const shc=$("#btnShareCard"); if(shc) shc.onclick=function(){ shareStudioCard(); };
  const ls=$("#launchStreamer"); if(ls) ls.onclick=()=>{ if(launchStreamer()){beep("gold"); flashes(G.flash); render();} else toast("Need rep ≥40 and $250M to launch.","bad"); };
  $$("[data-sched]").forEach(b=>b.onclick=()=>{ beep("click"); startScheduling(+b.dataset.sched); });
  $$("[data-shop]").forEach(b=>b.onclick=()=>{
    shopToStreamers(+b.dataset.shop); beep("click");
    if(G.pendingAuction){ render(); auctionModal(); }
  });
  $$("[data-test]").forEach(b=>b.onclick=()=>{ beep("click"); testScreenModal(+b.dataset.test); });
  $$("[data-reviews]").forEach(b=>b.onclick=()=>{ beep("click"); reviewsModal(+b.dataset.reviews); });
  $$("[data-movestr]").forEach(b=>b.onclick=()=>{ if(moveToStreamer(+b.dataset.movestr)){beep("gold"); flashes(G.flash); render();} else toast("That film can't move to your platform.","bad"); });
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

/* ═══════════ live sports rights auction modal (v3) ═══════════ */
function sportsModal(){
  const a=G.pendingSports; if(!a) return;
  const pkg=a.pkg;
  const bid=pkg.rivalBid;
  let h="<h3>"+pkg.icon+" Live sports rights — "+esc(pkg.name)+"</h3>"+
    "<p class='small muted'>"+esc(pkg.blurb)+" A sealed-bid auction. Winning adds <b>+"+pkg.subBump+"M subs</b> and <b>+"+pkg.sportPower+" sports power</b> (raises your content ceiling, decays ~1.5%/wk). Rivals are in play.</p>"+
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
        frMeter("🧸 Merchandise", pips(fr.merch,3))+
        frMeter("🎡 Theme park", fr.tier>=2? pips(fr.park,2) : "<span class='tiny muted'>needs tier 2</span>")+
        frMeter("🎮 Game rights", fr.gameSold===fr.tier? "<span class='tiny pos'>licensed</span>":"<span class='tiny muted'>available</span>")+
        frMeter("💰 Earned", fmtM(fr.earned||0))+
        frMeter("😴 Fatigue", "<span class='"+((fr.fatigue||0)>0.3?"neg":(fr.fatigue||0)>0.15?"":"pos")+"'>"+Math.round((fr.fatigue||0)*100)+"%</span>")+
      "</div><div class='fr-actions'>"+
      "<button class='btn btn-sm btn-primary' data-fr-seq='"+fr.id+"'>⚡ Greenlight Sequel</button>"+
      (fr.merch<3? "<button class='btn btn-sm btn-alt' data-fr-merch='"+fr.id+"'>🧸 "+(fr.merch?"Upgrade merch":"Launch merch")+" · "+fmtM(merchCost(fr))+"</button>" : "<span class='tag green' style='align-self:center'>merch maxed</span>")+
      (fr.park<2? (fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-park='"+fr.id+"'>🎡 "+(fr.park?"Expand park":"Build attraction")+" · "+fmtM(parkCost(fr))+"</button>" : "<span class='tag' style='align-self:center'>🎡 park unlocks at tier 2</span>") : "<span class='tag green' style='align-self:center'>park maxed</span>")+
      (fr.gameSold!==fr.tier? "<button class='btn btn-sm btn-alt' data-fr-game='"+fr.id+"'>🎮 License game rights</button>":"")+
      "</div></div>";
  }
  h+="<div class='card'><b>How the empire works</b><div class='small muted' style='margin-top:4px'>Every entry adds <b>franchise fatigue</b> (smaller openings, weaker reviews) that only heals if you rest the brand for about half a year. Merch & parks pay every week and spike again whenever a franchise film hits theaters (decay resets). Game rights are one-time cash per tier. Franchise equity raises your catalog value and credit limit.</div></div>";
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
    "<div class='cost-line'><span>Awards</span><b>"+(o.stats.awards||[]).map(a=>a.cat).join(", ")||"none"+"</b></div>"+
    "</div></div><div class='modal-actions'><button class='btn btn-primary' id='goNew'>🎬 Found a new studio</button></div>";
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
  "<div class='card'><b>5. 💼 Survive</b><p class='small muted'>Overhead, interest and P&A never sleep. Loans bridge gaps; the credit line has limits. Hits build reputation, franchises and a valuable catalog. Flops build character.</p></div>"+
  "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Lights down, head rolled 🎬</button></div>";
  openModal(h,{noX:true});
}
