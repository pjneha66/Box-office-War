/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — ui.js (rendering + interaction)
   ═══════════════════════════════════════════════════════════ */
"use strict";

let TAB = "dashboard";
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
  /* 📸 paparazzi camera flash + mechanical shutter snap */
  camera(ac,t){
    tone(ac,t,2400,0.06,{gain:0.04,type:"sine",glide:4800});
    noise(ac,t+0.05,0.09,{freq:3400,gain:0.065,q:1.2,decay:2.5});
    tone(ac,t+0.08,420,0.04,{gain:0.035,type:"square"});
  },
  /* 📽 vintage 35mm projector reel motor flutter */
  projector(ac,t){
    for(let i=0; i<6; i++){
      const at = t + i*0.065;
      tone(ac,at,180+(i%2?40:0),0.035,{gain:0.04,type:"square"});
      noise(ac,at+0.01,0.03,{freq:1800,gain:0.03,decay:3});
    }
  },
  /* 🚨 disaster rumble stinger on critical failure or PR crisis */
  disaster(ac,t){
    tone(ac,t,110,0.45,{gain:0.08,type:"sawtooth",glide:55,filter:400});
    tone(ac,t+0.12,82.4,0.55,{gain:0.075,type:"sawtooth",glide:45,filter:300});
    noise(ac,t+0.05,0.6,{freq:800,gain:0.045,decay:1.5});
  },
  /* 🥂 awards celebration crowd cheer & sparkle */
  cheer(ac,t){
    noise(ac,t,0.85,{freq:2200,gain:0.04,decay:1.2,q:0.5});
    [NOTE.C5,NOTE.E5,NOTE.G5,NOTE.C6].forEach((f,i)=>{
      tone(ac,t+0.15+i*0.05,f,0.4,{gain:0.035,type:"triangle"});
    });
  },
  /* Retro typewriter keystroke click */
  type(ac,t){ noise(ac,t,0.025,{freq:3600,gain:0.04,q:2,decay:4}); },
  /* Retro stat bubble pop */
  pop(ac,t){ tone(ac,t,988,0.05,{gain:0.045,type:"sine",glide:1318}); },
  /* In the zone inspiration aura */
  zone(ac,t){ [NOTE.C5,NOTE.E5,NOTE.G5,NOTE.B5,NOTE.C6].forEach((f,i)=>tone(ac,t+i*0.04,f,0.22,{gain:0.05,type:"square"})); },
  /* Retro 8-bit blip */
  blip(ac,t){ tone(ac,t,880,0.04,{gain:0.04,type:"square"}); tone(ac,t+0.04,1320,0.06,{gain:0.045,type:"square"}); }
};
/* v5: haptics — big beats buzz the phone (navigator.vibrate), if the user left it on */
let HAPTICS = true;
try{ HAPTICS = localStorage.getItem("bow_hap")!=="0"; }catch(e){}
function rumble(pattern){
  if(!HAPTICS) return;
  try{ if(navigator && navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
}
const HAPTIC_MAP = { fanfare:[35], cash:[20], drums:[25,40,25], smash:[40,60,40], buzz:[90], gold:[20,30,20], bad:[70], clap:[15], click:[6], chime:[18], good:[18], camera:[10,20,10], projector:[15,15,15], disaster:[80,100], cheer:[30,50,30], type:[5], pop:[10], zone:[30,50], blip:[8] };
let MUTE_UNTIL = 0;
try{ MUTE_UNTIL = +(localStorage.getItem("bow_mute_until")||0); }catch(e){}
function beep(kind){
  if(Date.now() < MUTE_UNTIL) return;
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
/* v19: theme system — five FeralUI-designed themes (see style.css v19 block).
   The accent token set swaps wholesale via body[data-theme]; semantic colors
   (green/red/blue) stay fixed. Persisted in localStorage like the language. */
let THEME = "gold";
try{ THEME = localStorage.getItem("bow_theme") || "gold"; }catch(e){}
const THEMES=[
  {id:"gold",      name:"Midnight Gold",    a:"#f5b942", b:"#10141f"},
  {id:"aurora",    name:"Aurora Night",     a:"#4dd6e8", b:"#0f1822"},
  {id:"violet",    name:"Violet Premiere",  a:"#b28fce", b:"#151027"},
  {id:"carpet",    name:"Red Carpet",       a:"#f09199", b:"#1e1114"},
  {id:"silver",    name:"Silver Screen",    a:"#c9ccd1", b:"#15171a"},
  {id:"cyberpunk", name:"Neon Cyberpunk",   a:"#00f0ff", b:"#070a14"},
  {id:"noir",      name:"1920s Film Noir",  a:"#d4af37", b:"#120f0c"},
  {id:"slate",     name:"Titanium Slate",   a:"#94a3b8", b:"#090d14"},
  {id:"emerald",   name:"Studio Emerald",   a:"#10b981", b:"#06130d"},
];
function applyTheme(t){
  if(t) THEME=t;
  if(!THEMES.some(x=>x.id===THEME)) THEME="gold";
  try{
    if(THEME==="gold") delete document.body.dataset.theme;
    else document.body.dataset.theme = THEME;
  }catch(e){}
  try{
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if(metaTheme){
      const colors = {
        gold:"#0b0e14", aurora:"#0a0f15", violet:"#0d0b16", carpet:"#120b0c",
        silver:"#0b0c0e", cyberpunk:"#070a14", noir:"#120f0c", slate:"#090d14", emerald:"#06130d"
      };
      const welcome=document.getElementById('startScreen');
      const onWelcome=welcome && welcome.style.display!=='none';
      metaTheme.setAttribute("content", onWelcome?'#181b1e':(colors[THEME] || "#0b0e14"));
    }
  }catch(e){}
  try{ localStorage.setItem("bow_theme", THEME); }catch(e){}
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
function genreIconHtml(genre, extraClass = ""){
  const g = DATA.genreOf(genre);
  if(g && g.icon){
    return `<img class="genre-icon-img ${extraClass}" src="${g.icon}" alt="${g.name||''}">`;
  }
  return "";
}
function gTag(genre){
  const g = DATA.genreOf(genre);
  const icon = genreIconHtml(genre);
  return "<span class='tag blue genre-badge-icon'>"+(icon?icon+" ":"")+(g?g.name:genre)+"</span>";
}
function scoreBadge(q){
  if(q>=80) return "<span class='tag green'>"+q+" · Acclaimed</span>";
  if(q>=60) return "<span class='tag gold'>"+q+" · Solid</span>";
  if(q>=40) return "<span class='tag'>"+q+" · Mixed</span>";
  return "<span class='tag red'>"+q+" · Panned</span>";
}
function toast(t,k){
  const host=$("#toasts"); if(!host) return;
  const d=document.createElement("div"); d.className="toast "+(k||""); d.textContent=t;
  host.appendChild(d); setTimeout(()=>d.remove(), 5200);
}
function flashes(list){ (list||[]).forEach(f=>toast(f.t, f.k)); }

/* ═══ v28.16: notification bell — everything lands in the 🔔 inbox; only main
   events (gold/bad) pop as toasts, capped so a busy week can never flood the
   screen. Weak events are inbox-only. Same-week duplicates (the flash list is
   flashed once per action AND per week tick) are recorded once. ═══ */
const TOAST_CAP=4;
function flashes(list){
  const items=(list||[]).filter(f=>f&&f.t);
  if(!items.length) return;
  if(G._nfWk!==G.week){ G._nfWk=G.week; G._nfK={}; }
  const seen={}; const queue=[];
  items.forEach(f=>{
    const key=(f.k||"info")+"|"+f.t;
    if(!G._nfK[key]){ G._nfK[key]=1; addNotification(f.t, f.k||"info", true); }
    if(!seen[key]){ seen[key]=1; queue.push(f); }
  });
  const main=queue.filter(f=>f.k==="gold"||f.k==="bad");
  const shown=main.slice(0,TOAST_CAP);
  shown.forEach(f=>toast(f.t, f.k));
  const hidden=main.length-shown.length + (queue.length-main.length);
  if(hidden>0) toast("🔔 "+hidden+" more in notifications","gold");
  updateBellBadge();
}
function updateBellBadge(){
  const el=$("#bellBadge"); if(!el) return;
  const n=(typeof G!=="undefined" && G && G.notifications)?G.notifications.filter(x=>!x.read).length:0;
  el.textContent=n>9?"9+":String(n);
  el.style.display=n?"flex":"none";
}
function notificationsModal(){
  INBOX.filter="all";
  INBOX.unread=new Set((G.notifications||[]).filter(n=>!n.read).map(n=>n.id));
  if(G.notifications && G.notifications.some(n=>!n.read)) markAllNotifRead();   // opening the inbox clears the badge
  renderInbox();
  updateBellBadge();
}

/* ═══════════ VISUAL HELPERS & COMPUTED CARDS ═══════════ */
/* v28 regression fix: two call sites passed an options object as the 2nd arg
   (width:"[object Object]"). Accept both positional args and {width,height,color}. */
function renderSparklineSVG(data, width=120, height=24, color="var(--gold)"){
  if(width && typeof width==="object"){ const o=width; width=o.width||120; height=o.height||24; color=o.color||"var(--gold)"; }
  if(!data || !Array.isArray(data) || data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const pts = data.map((val, i) => {
    const x = ((i / (data.length - 1)) * width).toFixed(1);
    const y = (height - ((val - min) / range) * (height - 4) - 2).toFixed(1);
    return `${x},${y}`;
  }).join(" ");
  return `<svg width="${width}" height="${height}" style="vertical-align:middle;overflow:visible"><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/></svg>`;
}

function renderDonutSVG(slices, size=90){
  const total = (slices||[]).reduce((s,x)=>s+(x.val||0),0) || 1;
  let acc = 0;
  const r = size * 0.36, cx = size / 2, cy = size / 2, stroke = size * 0.22;
  const circ = 2 * Math.PI * r;
  const paths = (slices||[]).map(s => {
    const pct = (s.val||0) / total;
    const dash = (pct * circ).toFixed(1);
    const gap = (circ - dash).toFixed(1);
    const offset = (-acc * circ).toFixed(1);
    acc += pct;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}"/>`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);border-radius:50%">${paths}</svg>`;
}

function studioXpProgressBar(){
  const lv = (typeof studioXpLevel==="function") ? studioXpLevel() : { id:"indie", name:"Indie Studio", level:1 };
  const levels = (typeof DATA!=="undefined" && DATA.STUDIO_XP_LEVELS) ? DATA.STUDIO_XP_LEVELS : [
    {id:"indie", name:"Indie", minRep:0},
    {id:"growing", name:"Growing", minRep:35},
    {id:"major", name:"Major", minRep:55},
    {id:"global", name:"Global", minRep:75},
    {id:"empire", name:"Empire", minRep:90}
  ];
  const curIdx = levels.findIndex(x=>x.id===lv.id);
  const activeIdx = curIdx >= 0 ? curIdx : 0;
  const pct = clamp(Math.round((activeIdx / (levels.length - 1)) * 100), 5, 100);
  let h = "<div class='xp-bar-container'><div class='xp-bar-track'><div class='xp-bar-fill' style='width:"+pct+"%'></div></div>";
  levels.forEach((l, i) => {
    const isCur = i === activeIdx;
    const isDone = i < activeIdx;
    h += "<div class='xp-node"+(isCur?" active":isDone?" done":"")+"' title='"+esc(l.name)+" (rep "+l.minRep+"+)'>"+(isDone?"✓ ":isCur?"👑 ":"")+esc(l.name)+"</div>";
  });
  h += "</div>";
  return h;
}

function studioDnaCard(){
  let s = {blockbuster:40, prestige:40, indie:40, franchise:40, streaming:40};
  try{ s = repScores(); }catch(e){}
  const arch = (DATA.ARCHETYPES && G.studio) ? DATA.ARCHETYPES.find(a=>a.id===G.studio.origin) : null;
  const traits = [];
  if(s.blockbuster >= 50) traits.push("💥 Mass-Market Tentpole Builder");
  if(s.prestige >= 50) traits.push("🏛 Oscar-Chasing Prestige House");
  if(s.indie >= 50) traits.push("🎬 Nimble Auteur-Driven Indie");
  if(s.franchise >= 50) traits.push("🏰 Franchise Transmedia Machine");
  if(s.streaming >= 50) traits.push("📱 Digital Platform Disruptor");
  if(!traits.length) traits.push("🎭 Eclectic Mid-Tier Producer");

  return "<div class='card' style='border-left:3px solid var(--purple)'>"+
    "<div class='spread'><b>🧬 Studio DNA &amp; Identity</b><span class='tag purple'>"+(arch ? arch.name : "Independent")+" Origin</span></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Your greenlight choices, budgets, and distribution shaped your studio's operational DNA:</div>"+
    "<div class='row' style='margin-top:6px'>"+traits.map(t=>"<span class='tag gold'>"+t+"</span>").join("")+"</div>"+
  "</div>";
}

function studioRecentReleasesCard(){
  const rel = (G.films||[]).filter(f=>f.ww && f.ww>0).slice(-5).reverse();
  if(!rel.length) return "";
  return "<div class='card' style='margin-top:8px'>"+
    "<div class='spread'><b>🎞 Recent Studio Releases</b><span class='tiny muted'>Last 5 films in library</span></div>"+
    "<div class='row' style='margin-top:6px;gap:6px;flex-wrap:wrap'>"+
      rel.map(f=>"<button class='btn btn-xs btn-alt' onclick=\"switchTab('boxoffice')\">"+(DATA.GENRES[f.genre]?DATA.GENRES[f.genre].emoji:"🎬")+" "+esc(f.title)+" ("+fmtG(f.ww)+")</button>").join("")+
    "</div>"+
  "</div>";
}

/* v27: influence currency card — earned from awards, hits and game launches */
function influenceCard(){
  const infl=G.studio.influence||0;
  const sources="Awards +5 · Smashes +2 · Acclaimed game launches +10 · Game of the Year +10";
  return "<div class='card' style='border-left:3px solid var(--blue)'>"+
    "<div class='spread'><b>🌐 Influence</b><span class='tag blue'>"+infl+"</span></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Industry goodwill you can spend. "+esc(sources)+".</div>"+
    "<div class='row' style='gap:6px;margin-top:6px;flex-wrap:wrap'>"+
      "<button class='btn btn-xs btn-alt' data-infl-masterclass='"+(infl>=10?"1":"0")+"' "+(infl>=10?"":"disabled")+">🎓 Masterclass +1000 XP (10)</button>"+
      "<button class='btn btn-xs btn-alt' data-infl-hype='"+(infl>=15?"1":"0")+"' "+(infl>=15?"":"disabled")+">📣 Hype surge +10% opening (15)</button>"+
    "</div></div>";
}

function talentFeudMap(){
  const feuds = G.feuds || [];
  if(!feuds.length) return "";
  return "<div class='card' style='border-left:3px solid var(--red);margin-top:8px'>"+
    "<div class='spread'><b>⚔️ Town Feud Map ("+feuds.length+")</b><span class='tag red'>Active Rivalries</span></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Casting feuding talent together risks set toxicity, schedule delays, and negative press.</div>"+
    "<div style='margin-top:6px;display:grid;gap:4px'>"+
      feuds.map(f=>{
        const t1 = talentById(f.a), t2 = talentById(f.b);
        return "<div class='cost-line'><span>🎭 <b>"+esc(t1?t1.name:f.a)+"</b> ⚔️ <b>"+esc(t2?t2.name:f.b)+"</b></span><b class='neg tiny'>Feud heat "+Math.round((f.heat||0.8)*100)+"%</b></div>";
      }).join("")+
    "</div>"+
  "</div>";
}

/* ═══════════ modal ═══════════ */
function announceSR(msg, isAssertive){
  if(typeof document==="undefined") return;
  const el = document.getElementById(isAssertive ? "srAlert" : "srAnnounce");
  if(el){
    el.textContent = "";
    setTimeout(()=>{ el.textContent = msg; }, 30);
  }
}

/* Convert legacy management dialog markup into a real workspace before modules bind
   their controls. Moving nodes preserves IDs, data attributes and element identity. */
function buildManagementWorkspace(dialog){
  if(dialog.querySelector('.command-dialog')) return;
  const oldTitle=dialog.querySelector('h3,h2');
  const original=oldTitle?oldTitle.textContent.trim():'Studio management';
  const identities=[
    [/Real Estate|Facilities Infrastructure/i,'Campus Works','Plan your next expansion. Build the spaces behind your films.'],
    [/Bond|Securitization/i,'Capital House','Review your credit position and fund your next chapter.'],
    [/Board of Directors|Quarterly Directives/i,'The Strategy Room','Track board confidence, quarterly goals, and your next commitments.'],
    [/Espionage|Intelligence Desk/i,'Intelligence Bureau','Manage industry intelligence and protect your competitive edge.'],
    [/Syndication/i,'Distribution Exchange','Put your catalogue to work beyond the theatrical window.'],
    [/Amenities|Floor Decor/i,'Campus Living','Shape the workplace your people return to every day.'],
    [/Restoration/i,'The Preservation Vault','Bring your catalogue back to the screen.'],
    [/Dynasty|Succession/i,'The Legacy Office','Plan the people and decisions that carry your studio forward.'],
    [/Cinematic Universe/i,'Worldbuilders','Connect your stories and shape the next crossover.'],
    [/Crisis|War Room/i,'Reputation Desk','Understand the pressure. Choose your response.'],
    [/Product Placement|Brand Deals/i,'Partnership Studio','Match your productions with the right commercial partners.']
  ];
  const identity=identities.find(([pattern])=>pattern.test(original));
  const title=identity?identity[1]:original;
  const description=identity?identity[2]:'Review your options and make your next studio decision.';
  if(oldTitle)oldTitle.remove();
  const body=document.createElement('div');body.className='workspace-content';
  Array.from(dialog.childNodes).forEach(node=>{if(!(node.nodeType===1&&node.classList.contains('modal-head')))body.appendChild(node);});
  const shell=document.createElement('section');shell.className='management-workspace';
  const hero=document.createElement('header');hero.className='workspace-hero';
  const eyebrow=document.createElement('span');eyebrow.className='command-eyebrow';eyebrow.textContent='STUDIO HQ / MANAGEMENT WORKSPACE';
  const heading=document.createElement('h2');heading.textContent=title;
  const subtitle=document.createElement('p');subtitle.textContent=description;
  const source=document.createElement('small');source.textContent=original;
  hero.append(eyebrow,heading,subtitle,source);
  const layout=document.createElement('div');layout.className='workspace-layout';
  const rail=document.createElement('aside');rail.className='workspace-rail';
  const caption=document.createElement('span');caption.className='command-eyebrow';caption.textContent='IN THIS WORKSPACE';rail.append(caption);
  const sections=Array.from(body.querySelectorAll('.section-title,h4')).filter(el=>el.textContent.trim());
  const targets=sections.length?sections:[body];
  targets.forEach((target,i)=>{
    const button=document.createElement('button');button.type='button';
    const num=document.createElement('small');num.textContent=String(i+1).padStart(2,'0');
    const label=document.createElement('span');label.textContent=sections.length?target.textContent.trim():'Overview & decisions';
    button.append(num,label);button.onclick=()=>{rail.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));target.scrollIntoView?.({behavior:motionOK()?'smooth':'instant',block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});};
    if(i===0)button.className='active';rail.append(button);
  });
  const note=document.createElement('p');note.className='workspace-note';note.textContent='Your current career · Year '+yearOf(G.week)+' / Week '+woyOf(G.week);rail.append(note);
  layout.append(rail,body);shell.append(hero,layout);dialog.append(shell);
  dialog.classList.add('command-workspace-modal');
  dialog.setAttribute('aria-label',title);dialog.removeAttribute('aria-labelledby');
}
function openModal(html, opts){
  opts=opts||{};
  // Store the element that triggered the modal for focus restoration
  const triggerEl = document.activeElement;
  closeModal();
  if(typeof document!=="undefined" && document.body) document.body.style.overflow="hidden";
  const veil=document.createElement("div"); veil.className="modal-veil";
  if(opts.locked) veil.dataset.locked="true";
  // Add ARIA attributes for accessibility
  const modalId = "modal-" + Date.now();
  veil.innerHTML="<div class='modal' role='dialog' aria-modal='true' id='"+modalId+"' aria-labelledby='"+modalId+"-title'>"+(opts.noX?"":"<div class='modal-head'><div id='"+modalId+"-title'></div><button class='modal-x' aria-label='Close modal'>✕</button></div>")+html+"</div>";
  // Management destinations share the command-deck interior, including nested dialogs.
  if(opts.className){
    // Explicit command skins (pitch studio, board verdict, inbox, location desk)
    // win over the tab default, so they look the same from every entry point.
    const dialog=veil.querySelector('.modal');
    dialog.classList.add('command-modal','command-develop-modal');
    String(opts.className).split(/\s+/).filter(Boolean).forEach(c=>dialog.classList.add(c));
    const title=dialog.querySelector('h3,h2');
    if(title){ dialog.setAttribute('aria-label',title.textContent.replace(/\s+/g,' ').trim()); }
  } else if(["dashboard","studio"].includes(TAB)){
    const dialog=veil.querySelector('.modal');
    dialog.classList.add('command-modal','command-management-modal');
    buildManagementWorkspace(dialog);
    const title=dialog.querySelector('h3,h2');
    if(title){ dialog.setAttribute('aria-label',title.textContent); }
  } else if(TAB==="develop"){
    // Story Department dialogs share the same shell and flat surface, but keep
    // their own flow (wizards, research desks) instead of the workshop layout.
    const dialog=veil.querySelector('.modal');
    dialog.classList.add('command-modal','command-develop-modal');
    const title=dialog.querySelector('h3,h2');
    if(title){ dialog.setAttribute('aria-label',title.textContent); }
  } else {
    // Every other screen's dialogs (box office, fans, OTT, finance, game studio)
    // kept the pre-redesign navy-and-gold surface. They are not rewritten one by
    // one; they share one produce chrome so the platform reads as one product.
    const dialog=veil.querySelector('.modal');
    dialog.classList.add('command-modal','command-legacy-modal');
    const title=dialog.querySelector('h3,h2');
    if(title){ dialog.setAttribute('aria-label',title.textContent); }
  }
  if(!opts.noX) veil.querySelector(".modal-x").onclick=()=>{ closeModal(triggerEl); if(opts.onClose) opts.onClose(); };
  if(!opts.locked) veil.addEventListener("click", e=>{ if(e.target===veil){ closeModal(triggerEl); if(opts.onClose) opts.onClose(); } });
  // Store trigger element reference on veil for focus restoration
  veil._triggerEl = triggerEl;
  $("#modalRoot").appendChild(veil);
  announceSR("Dialog opened.");
  const focusables = veil.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if(focusables.length){
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    // Auto-focus first focusable element
    first.focus();
    veil.addEventListener("keydown", function(e){
      if(e.key === "Tab"){
        if(e.shiftKey && document.activeElement === first){
          e.preventDefault();
          last.focus();
        } else if(!e.shiftKey && document.activeElement === last){
          e.preventDefault();
          first.focus();
        }
      } else if(e.key === "Escape" && !opts.locked){
        e.preventDefault();
        closeModal(triggerEl);
        if(opts.onClose) opts.onClose();
      }
    });
  }
  return veil;
}
function closeModal(triggerEl){
  if(typeof document!=="undefined" && document.body) document.body.style.overflow="";
  const veil = document.querySelector("#modalRoot .modal-veil");
  // Restore focus to trigger element (prefer passed, then veil's stored)
  const restoreEl = triggerEl || (veil && veil._triggerEl);
  if(restoreEl && typeof restoreEl.focus === "function"){
    restoreEl.focus();
  }
  $("#modalRoot").innerHTML="";
  announceSR("Dialog closed.");
}
function openCommandPalette(){
  let h = "<h3>⌨️ Command Palette</h3>";
  h += "<input type='text' id='cmdInput' placeholder='Search tabs or actions (Studio, Films, OTT, Greenlight)...' style='width:100%;padding:10px 12px;border-radius:10px;background:#0b0f18;border:1px solid var(--line2);color:var(--text);font-size:14px;margin-bottom:12px' autofocus>";
  h += "<div id='cmdList' style='display:grid;gap:6px;max-height:340px;overflow-y:auto'>";
  const CMDS = [
    { name: "🏛 Studio Overview", desc: "Jump to Studio control room", tab: "studio" },
    { name: "📝 Develop & Scripts", desc: "Browse scripts & trend board", tab: "develop" },
    { name: "🎬 Active Productions", desc: "Shooting slate & pipeline", tab: "productions" },
    { name: "📊 Box Office & Market", desc: "Weekly charts & library", tab: "boxoffice" },
    { name: "📬 Fans & Audience", desc: "Fan mail, buzz & trending", tab: "fans" },
    { name: "📺 OTT & Streaming", desc: "Streamer dashboard & licenses", tab: "ott" },
    { name: "🏰 Franchise Empire", desc: "Sequels, merchandise & parks", tab: "empire" },
    { name: "🎮 Game Studio", desc: "Video game adaptations", tab: "games" },
    { name: "💼 Finance & P&L", desc: "Ledger, loans & debt", tab: "finance" },
    { name: "🎥 Greenlight a Film", desc: "Open film greenlight wizard", action: "greenlight" },
    { name: "📺 Pitch a Series", desc: "Pitch an episodic series", action: "series" },
    { name: "💾 Save Studio", desc: "Save current state", action: "save" },
    { name: "⏩ Advance 1 Week", desc: "Simulate forward one week", action: "week" }
  ];
  CMDS.forEach(c => {
    h += "<div class='card cmd-item' data-cmd-tab='"+(c.tab||"")+"' data-cmd-action='"+(c.action||"")+"' style='cursor:pointer;padding:10px 12px;transition:background .15s'>"+
      "<b>"+c.name+"</b><div class='tiny muted'>"+c.desc+"</div></div>";
  });
  h += "</div>";
  const v = openModal(h);
  const inp = v.querySelector("#cmdInput");
  const items = v.querySelectorAll(".cmd-item");
  if(inp){
    inp.oninput = () => {
      const q = inp.value.toLowerCase();
      items.forEach(it => {
        const text = it.textContent.toLowerCase();
        it.style.display = text.includes(q) ? "" : "none";
      });
    };
  }
  items.forEach(it => {
    it.onclick = () => {
      closeModal();
      const tab = it.dataset.cmdTab;
      const act = it.dataset.cmdAction;
      if(tab){ switchTab(tab); }
      else if(act === "greenlight"){ startFilmPitchWizard(); }
      else if(act === "series"){ startSeriesWizard(); }
      else if(act === "save"){ saveGame(); toast("Studio saved!","good"); }
      else if(act === "week"){ const bw = $("#btnWeek"); if(bw) bw.click(); }
    };
  });
}
if(typeof window!=="undefined"){
  window.addEventListener("keydown", e=>{
    if(e.key==="Escape"){
      const veil=document.querySelector("#modalRoot .modal-veil");
      if(veil && !veil.dataset.locked){
        const x=veil.querySelector(".modal-x");
        if(x) x.click();
        else closeModal();
      }
    }
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==="k"){
      e.preventDefault();
      openCommandPalette();
    }
  });
}

/* ═══════════ boot ═══════════ */
window.addEventListener("DOMContentLoaded", ()=>{
  // start screen
  const names=["Parallax Pictures","Lighthouse Films","Meridian Studios","Blackwater Pics","Golden Hour Entertainment","Astra House"];
  const sug=$("#nameSuggests");
  if(sug){
    sug.innerHTML="";
    names.slice(0,4).forEach(n=>{ const b=document.createElement("button"); b.type="button"; b.textContent=n;
      b.onclick=()=>{ $("#studioName").value=n; beep("click"); }; sug.appendChild(b); });
  }
  const sInp=$("#studioName"); if(sInp && !sInp.value) sInp.value=names[rint(0,names.length-1)];
  let archSel=DATA.ARCHETYPES[1].id;
  const al=$("#archList");
  if(al){
    al.innerHTML="";
    const archAvatars = {
      auteur: "assets/itch-avatars/Avatars_01.png",
      producer: "assets/itch-avatars/Avatars_06.png",
      mogul: "assets/itch-avatars/Avatars_16.png"
    };
    DATA.ARCHETYPES.forEach(a=>{
      const cleanName = (a.name||"").replace(/^[^a-zA-Z0-9]+/, "");
      const avatarSrc = archAvatars[a.id] || "assets/itch-avatars/Avatars_01.png";
      const d=document.createElement("div"); d.className="arch"+(a.id===archSel?" sel":"");
      d.innerHTML="<div style='display:flex;gap:12px;align-items:center'>"+
        "<img src='"+avatarSrc+"' alt='"+cleanName+"' class='arch-avatar' style='width:52px;height:52px;border-radius:8px;border:2px solid var(--gold);background:#131b26;image-rendering:pixelated;object-fit:cover;flex-shrink:0'>"+
        "<div style='flex:1'>"+
          "<div class='arch-header'><h4>"+cleanName+"</h4><span class='arch-tag'>"+(a.id==="auteur"?"Creative Indie":a.id==="producer"?"Commercial Studio":"Conglomerate")+"</span></div>"+
          "<div class='a-sub'>"+a.sub+"</div>"+
        "</div>"+
      "</div>"+
      "<div class='a-stats' style='margin-top:8px'>"+
        "<span class='tag gold'>War Chest: "+fmtM(a.cash)+"</span>"+
        "<span class='tag blue'>Rep: "+a.rep+"</span>"+
        "<span class='tag'>Overhead: $"+a.overhead+"M/wk</span>"+
      "</div>";
      d.onclick=()=>{ archSel=a.id; $$(".arch").forEach(x=>x.classList.remove("sel")); d.classList.add("sel"); beep("click"); };
      al.appendChild(d);
    });
  }

  // Active Save Hero Card
  try{
    const sm = activeSaveMeta();
    const hero = $("#resumeHero");
    if(sm && hero){
      hero.style.display = "block";
      const rName = $("#resumeStudioName"); if(rName) rName.textContent = sm.name;
      const rMeta = $("#resumeMeta"); if(rMeta) rMeta.textContent = dateLabel(sm.week) + " · " + (DATA.SCENARIOS[sm.scenario]?.name || "Standard") + " Mode · Slot " + (sm.slot || 1);
      const rCash = $("#resumeCash"); if(rCash) rCash.textContent = fmtM(sm.cash);
      const rRep = $("#resumeStatRep"); if(rRep) rRep.textContent = "Reputation " + sm.rep;
      const rFilms = $("#resumeStatFilms"); if(rFilms) rFilms.textContent = sm.films + " Releases";
      const rFranch = $("#resumeStatFranchises"); if(rFranch) rFranch.textContent = sm.franchises + " Franchises";
      const btnHero = $("#btnResumeHero");
      if(btnHero){
        btnHero.onclick = ()=>{ const g = loadGame(); if(g){ enterApp(); } };
      }
    }
  }catch(e){}

  if(hasSave()) $("#btnContinue").style.display="block";
  $("#btnContinue").onclick=()=>{ const g=loadGame(); if(g){ enterApp(); } };
  $("#btnStart").onclick=()=>{
    const nm=($("#studioName").value||"Parallax Pictures").trim().slice(0,26);
    newGame(archSel, nm, {scenario:SEL.scenario, difficulty:SEL.difficulty, sandbox:SEL.sandbox, slot:SEL.slot, legacy:SEL.legacy});
    enterApp(true);
  };
  try{ buildStartOptions(); }catch(e){ console.warn("start options", e); }
  // topbar
  $("#btnWeek").onclick=()=>{ doWeek(1); };
  $("#btnFast").onclick=()=>{ doWeek(4); };
  $("#btnAuto").onclick=()=>{ toggleAuto(); beep("click"); };
  const paintSound=()=>{
    const el=$("#btnSound"); if(!el) return;
    el.classList.toggle("on",!!SOUND);
    el.setAttribute("aria-pressed",SOUND?"true":"false");
    el.innerHTML='<span class="sound-dot" aria-hidden="true"></span><span class="sound-label">SOUND</span><b>'+(SOUND?"ON":"OFF")+'</b>';
    el.title=SOUND?"Sound on — click to mute":"Sound off — click to enable";
  };
  $("#btnSound").onclick=()=>{ SOUND=!SOUND; localStorage.setItem("bow_snd", SOUND?"1":"0"); paintSound(); beep("click"); };
  SOUND = localStorage.getItem("bow_snd")!=="0"; paintSound();
  $("#btnBell").onclick=()=>{ beep("click"); notificationsModal(); };
  $("#btnSettings").onclick=()=>{ beep("click"); settingsModal(); };
  $("#btnHelp").onclick=()=>helpModal();
  // v10 spec §5: tappable HUD
  const cw=$("#chipCashWrap"); if(cw) cw.onclick=()=>{ beep("click"); financeOverviewSheet(); };
  const dw=$("#chipDateWrap"); if(dw) dw.onclick=()=>{ beep("click"); calendarModal(); };
  /* v28 SR audit: role="button" divs need Enter/Space activation */
  [[cw,()=>financeOverviewSheet()],[dw,()=>calendarModal()]].forEach(([el,fn])=>{
    if(!el) return;
    el.setAttribute("tabindex","0");
    el.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){ e.preventDefault(); beep("click"); fn(); }
    });
  });
  $("#btnAch") && ($("#btnAch").onclick=()=>{ beep("click"); achievementsModal(); });
  // tabs
  $$(".tab,.btab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  try{ applyChromeLang(); }catch(e){}
  applyMotionPref();
  applyTheme();
  installGestures();   // v5: swipe tabs + pull-to-advance on mobile
  // keyboard shortcuts
  document.addEventListener("keydown", e=>{
    if(e.target.tagName==="INPUT" || e.target.tagName==="TEXTAREA") return;
    if(e.key>="1" && e.key<="9"){ const tabs=["studio","develop","productions","boxoffice","fans","ott","empire","games","finance"]; switchTab(tabs[e.key-1]); }
    else if(e.code==="Space" && !e.shiftKey){ e.preventDefault(); doWeek(1); }
    else if(e.code==="Space" && e.shiftKey){ e.preventDefault(); doWeek(4); }
    else if(e.key==="r" || e.key==="R"){ e.preventDefault(); if(!G.over){ const rows=$$("[data-sched]"); if(rows.length) rows[0].click(); } }
    else if(e.key==="s" || e.key==="S"){ e.preventDefault(); saveGame(); toast("💾 Game saved"); }
    else if(e.key==="l" || e.key==="L"){ e.preventDefault(); const g=loadGame(); if(g){ render(); toast("📂 Game loaded"); } }
    else if(e.key==="h" || e.key==="H"){ e.preventDefault(); helpModal(); }
    else if(e.key==="p" && e.ctrlKey && e.shiftKey){ e.preventDefault(); if(G.prototype){ prototypeDebugModal(); } }
    else if((e.metaKey || e.ctrlKey) && e.key==="k"){ e.preventDefault(); openCommandPalette(); }
    else if(e.key==="ArrowLeft" || e.key==="ArrowRight"){
      const tabKeys = ["studio","develop","productions","boxoffice","fans","ott","empire","games","finance"];
      const idx = tabKeys.indexOf(TAB);
      if(idx !== -1){
        e.preventDefault();
        const nextIdx = (idx + (e.key==="ArrowRight"?1:-1) + tabKeys.length) % tabKeys.length;
        switchTab(tabKeys[nextIdx]);
      }
    }
    // Arrow key navigation for card grids (when focused)
    else if(e.key==="ArrowUp" || e.key==="ArrowDown" || e.key==="ArrowLeft" || e.key==="ArrowRight"){
      const active = document.activeElement;
      const card = active?.closest?.(".idea-card, .talent-card, .card[data-focusable]");
      if(card){
        const grid = card.closest(".grid, .pick-list, .grid.g2, .grid.g3");
        if(grid){
          e.preventDefault();
          const cards = Array.from(grid.querySelectorAll(".idea-card, .talent-card, .card[data-focusable]"));
          const idx = cards.indexOf(card);
          if(idx === -1) return;
          const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(c=>c!=="0px").length || 3;
          let nextIdx = idx;
          if(e.key==="ArrowRight") nextIdx = Math.min(idx + 1, cards.length - 1);
          else if(e.key==="ArrowLeft") nextIdx = Math.max(idx - 1, 0);
          else if(e.key==="ArrowDown") nextIdx = Math.min(idx + cols, cards.length - 1);
          else if(e.key==="ArrowUp") nextIdx = Math.max(idx - cols, 0);
          if(nextIdx !== idx) cards[nextIdx].focus();
        }
      }
    }
    else if(e.key==="Escape"){ closeModal(); }
  });
  // long-press fast on mobile
  let lp=null;
  $("#btnWeek").addEventListener("touchstart",()=>{ lp=setTimeout(()=>{ doWeek(4); lp="done"; },600); },{passive:true});
  $("#btnWeek").addEventListener("touchend",()=>{ if(lp&&lp!=="done"){clearTimeout(lp);} lp=null; });
  let lp2=null;
  $("#btnFast").addEventListener("touchstart",()=>{ lp2=setTimeout(()=>{ doWeek(4); lp2="done"; },600); },{passive:true});
  $("#btnFast").addEventListener("touchend",()=>{ if(lp2&&lp2!=="done"){clearTimeout(lp2);} lp2=null; });
  const fab=$("#fabWeek"); if(fab) fab.onclick=()=>{ doWeek(1); };
});
function enterApp(fresh){
  $("#startScreen").style.display="none";
  applyTheme();
  const app=$("#app");
  app.style.display="flex";
  try{ if(motionOK()){ app.style.animation="viewIn .45s cubic-bezier(.2,.85,.3,1)"; } }catch(e){}
  if(fresh){
    try{
      localStorage.setItem("bow_privacy_ok","1");
      localStorage.setItem("bow_coppa_ok","1");
    }catch(e){}
  }
  // Deep links open the requested management screen without changing saved careers.
  const entryView = new URLSearchParams(location.search).get("view");
  switchTab(["dashboard", "studio"].includes(entryView) ? entryView : "dashboard");
  render();
  if(G.pendingEarnings) earningsModal();
  else if(G.pendingChoice) choiceModal();
  else if(G.pendingDeepfake) deepfakeModal();
  else if(G.pendingAuction) auctionModal();
  else if(G.pendingSale) saleModal();
  else if(G.pendingSports) sportsModal();
  else if(G.pendingReport) reportModal();
  else if(G.over) gameOverModal();
}
function switchTab(t){
  if(t==="more"){ beep("click"); moreSheet(); return; }   // v10: mobile More sheet
  if(t==="develop") DEVELOP_SUB = "scripts";
  document.getElementById("app").dataset.activeTab = t;
  const stage = document.getElementById("studiolotGlobalStage");
  const viewEl = document.getElementById("view");
  if(stage){
    stage.style.display = t === "studiolot" ? "block" : "none";
    if (t === "studiolot") {
      stage.className = "studiolot-global-stage lot-full";
      if(viewEl) viewEl.classList.add("view-hidden-lot");
    } else {
      stage.className = "studiolot-global-stage lot-backdrop";
      if(viewEl) viewEl.classList.remove("view-hidden-lot");
    }
  }
  const roomMap = {
    studiolot: "campus",
    dashboard: "executive",
    studio: "campus",
    develop: "writers",
    productions: "soundstage",
    boxoffice: "cinema",
    fans: "cinema",
    ott: "post",
    live: "post",
    empire: "executive",
    library: "post",
    games: "post",
    finance: "executive",
    notifications: "executive"
  };
  const targetRoom = roomMap[t] || "campus";
  if(typeof StudioLot2D !== "undefined"){
    if(!document.querySelector("#studiolotContainer canvas")){
      try{ StudioLot2D.mount("studiolotContainer", targetRoom, { compact: t !== "studiolot" }); }catch(e){}
    } else {
      try{ StudioLot2D.setView(targetRoom); if(typeof StudioLot2D.resize==="function") StudioLot2D.resize(); }catch(e){}
    }
  }
  TAB=t; try{ beep("click"); }catch(e){}   // v28.9: never let audio/haptics kill the render flush
  $$(".tab,.btab").forEach(b=>{
    // The live 2D lot is entered from Studio, so Studio stays lit while you are on it.
    const match = b.dataset.tab===t || (t==="studiolot" && b.dataset.tab==="studio") || (b.id==="btabMore" && (t==="ott"||t==="empire"||t==="finance"||t==="games"));
    b.classList.toggle("active", match);
    b.setAttribute("aria-current", match?"true":"false");   // v27 a11y
  });
  /* v28.9: flush the debounced render immediately on tab switch — fixes the
     race where a fast click (or the UI test) hits a not-yet-rendered view */
  if(_renderTimer){ clearTimeout(_renderTimer); _renderTimer=null; }
  /* v28.9 mobile P2: remember per-tab scroll position */
  try{ TAB_SCROLL[TAB]=window.scrollY; }catch(e){}
  _renderImpl();
  try{ if(TAB_SCROLL[t]!=null) window.scrollTo(0, TAB_SCROLL[t]); else window.scrollTo(0,0); }catch(e){}
  const v=$("#view");   // v7: replay the entrance so the new tab glides in
  if(v && motionOK()){ v.classList.remove("view-enter"); void v.offsetWidth; v.classList.add("view-enter"); }
}
const TAB_SCROLL={};   // v28.9: tab → last scrollY
/* v10 spec §3: More — secondary systems as a bottom sheet */
/* v15: fold — one collapsible pattern for every wall-of-info section. The head
   row toggles the body in place (no re-render); open/closed state persists in
   localStorage so each section remembers how the player left it. */
function foldStore(){ try{ return JSON.parse(localStorage.getItem("bow_fold")||"{}"); }catch(e){ return {}; } }
function foldOpen(key, dflt){ const s=foldStore(); return (key in s)? !!s[key] : !!dflt; }
function fold(id, title, body, opts){
  opts=opts||{};
  const open=foldOpen(id, opts.open!==false);
  return "<div class='fold"+(open?" open":"")+"' data-foldbox='"+esc(id)+"'>"+
    "<div class='fold-head' data-fold='"+esc(id)+"' role='button' tabindex='0' aria-expanded='"+open+"'>"+
      "<span class='fold-caret' aria-hidden='true'>▸</span><b>"+title+"</b>"+
      (opts.tag? " <span class='tag "+(opts.tagCls||"")+"'>"+opts.tag+"</span>":"")+
      (opts.hint? " <span class='tiny muted'>"+opts.hint+"</span>":"")+"</div>"+
    "<div class='fold-body'"+(open?"":" style='display:none'")+">"+body+"</div></div>";
}
function bindFolds(root){
  (root||document).querySelectorAll("[data-fold]").forEach(h=>{
    const toggle=()=>{
      const key=h.dataset.fold;
      const box=h.closest("[data-foldbox]");
      const body=box&&box.querySelector(".fold-body");
      const nowOpen=!(box&&box.classList.contains("open"));
      if(box) box.classList.toggle("open", nowOpen);
      if(body) body.style.display=nowOpen? "" : "none";
      h.setAttribute("aria-expanded", nowOpen?"true":"false");
      const s=foldStore(); s[key]=nowOpen;
      try{ localStorage.setItem("bow_fold", JSON.stringify(s)); }catch(e){}
    };
    h.onclick=toggle;
    h.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); toggle(); } };
  });
}

/* v14 §56: what-if sandbox — fork the current state, roll forward, report. The
   real run never moves; each scenario forks fresh from the moment you tap. */
function whatIfModal(){
  const dated=G.projects.filter(p=>p.kind==="film"&&p.phase==="ready"&&p.releaseWeek>G.week);
  if(!dated.length){ toast("Date a film first — the sandbox forks the current state and rolls forward.","bad"); return; }
  const now={cash:G.studio.cash, ww:G.stats.totalWW, rep:G.studio.rep, films:G.stats.films};
  const scen=[
    {id:"plan", label:"📅 Release as planned", desc:"The current date and P&A stand."},
    {id:"late", label:"🗓 Slip 4 weeks later", desc:"The fork moves the date out a month."},
    {id:"hype", label:"📣 Roughly double the P&A", desc:"The fork adds ~100% marketing to the release."},
  ];
  let h="<h3>🔮 What-if sandbox</h3>"+
    "<div class='tiny muted'>Forks your studio as it stands right now"+(dated.length?" — testing “"+esc(dated[0].title)+"”":"")+" — rolls 16 weeks and reports. Nothing is saved, nothing changes.</div>"+
    "<div class='card' style='margin-top:8px'><div class='cost-line'><span>Cash now</span><b>"+fmtM(now.cash)+"</b></div>"+
    "<div class='cost-line'><span>WW gross now</span><b>"+fmtG(now.ww)+"</b></div>"+
    "<div class='cost-line'><span>Rep now</span><b>"+now.rep+"</b></div></div>"+
    "<div style='margin-top:8px'>"+scen.map(s=>"<div class='card' style='margin-top:6px'><div class='spread'><b>"+s.label+"</b><span class='row' style='gap:4px'><button class='btn btn-sm btn-alt' data-wif='"+s.id+"'>Run 16 wks</button><button class='btn btn-sm btn-ghost' data-wifshare='"+s.id+"' title='Copy a link that reopens this what-if with the same numbers'>🔗 Share</button></span></div><div class='tiny muted'>"+s.desc+"</div><div class='tiny muted' data-wifout='"+s.id+"' style='margin-top:4px'>Not simulated yet.</div></div>").join("")+"</div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Close</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-wif]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.wif;
    beep("click");
    const r=whatIf(id, 16);
    const outEl=v.querySelector("[data-wifout='"+id+"']");
    if(!outEl) return;
    if(!r.ok){ outEl.innerHTML="<span class='neg'>The fork hit a snag ("+esc(r.err||"unknown")+").</span>"; return; }
    outEl.innerHTML="16 wks later → cash <b class='"+(r.cash>=now.cash?"pos":"neg")+"'>"+fmtM(r.cash)+"</b> ("+(r.cash>=now.cash?"+":"")+fmtM(r.cash-now.cash)+") · WW "+fmtG(r.ww)+" · rep "+r.rep+" · "+r.films+" films"+(r.over?" · <b class='neg'>⚠ the fork went bankrupt</b>":"");
  });
  /* v31: shareable what-if links — the fork numbers ride in the URL hash */
  v.querySelectorAll("[data-wifshare]").forEach(b=>b.onclick=()=>{
    beep("click");
    if(typeof whatIfShareCopy==="function") whatIfShareCopy(b.getAttribute("data-wifshare"));
  });
  /* v31: opened from a shared link? auto-run the carried scenario once. */
  const _pend=window.__bowPendingWhatIf;
  if(_pend&&_pend.s){ window.__bowPendingWhatIf=null;
    toast("🔮 Shared what-if loaded — rolling the “"+_pend.s+"” fork for 16 weeks…","gold");
    setTimeout(()=>{ const b=v.querySelector("[data-wif='"+_pend.s+"']"); if(b) b.click(); }, 80);
  }
}
/* v14 §57/§59: hall of fame — this run's records + the finished-runs hall,
   every entry stamped with its run seed so a future leaderboard can read it. */
function hallOfFameModal(){
  let d=null; try{ d=hallOfFameData(); }catch(e){}
  let h="<h3>🏆 Hall of Fame</h3>";
  if(d){
    h+="<div class='tiny muted'>"+esc(d.studio)+" · run seed <span class='tag'>"+esc(d.seed)+"</span></div>"+
      "<div class='stat-hero' style='margin-top:8px'>"+
      statCard(fmtG(d.records.bestOpen),"Best opening")+
      statCard(fmtG(d.records.biggestWW),"Biggest film")+
      statCard(d.records.awards,"Awards")+
      statCard(d.records.hits+" / "+d.records.flops,"Hits / flops")+
      statCard(d.records.stars,"Sidewalk stars")+"</div>";
    if(d.top.length){
      h+="<div class='card' style='margin-top:8px'><b class='small'>Top films of this run</b>"+
        d.top.map(f=>"<div class='cost-line'><span>"+esc(f.title)+" <span class='tiny muted'>Y"+f.year+"</span></span><b>"+fmtG(f.ww)+"</b></div>").join("")+"</div>";
    }
  }
  const hall=(d&&d.hall)||[];
  h+="<div class='card' style='margin-top:8px'><b class='small'>Runs hall ("+hall.length+")</b>";
  if(!hall.length) h+="<div class='tiny muted'>Finish a run — in glory or red ink — and it's carved here: grade, score, gross, seed. Shaped so a future online leaderboard can read the same records.</div>";
  hall.slice(0,8).forEach(e=>{
    h+="<div class='cost-line'><span><b>"+esc(e.studio||"—")+"</b> <span class='tiny muted'>Y"+(e.years||"—")+" · "+(e.films||0)+" films"+(e.seed?" · seed "+esc(e.seed):"")+"</span></span>"+
      "<b class='tiny'>"+(e.grade||"")+" · "+fmtM(e.revenue||0)+" WW</b></div>";
  });
  h+="</div><div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Close</button></div>";
  openModal(h);
}
function moreSheet(){
  let h="<div class='modal-head'><h3>Quick Actions &amp; Studio Command Hub</h3></div>";
  h+="<div class='tiny muted' style='margin-bottom:12px'>Instant 1-click command center for all production, distribution, intelligence, and studio empire operations.</div>";

  // Section 1: Distribution & Licensing
  h+="<div class='card' style='margin-bottom:10px'>";
  h+="<div class='row spread' style='margin-bottom:6px'><b>[DISTRIBUTION &amp; MARKETS]</b><span class='tag blue'>Global Sales</span></div>";
  h+="<div class='grid g2' style='gap:6px'>";
  h+="<button class='btn btn-sm btn-alt' id='qaTerritory' style='text-align:left;padding:8px 10px'><b>Territory Licensing</b><div class='tiny muted'>Foreign MG &amp; backend deals</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaClash' style='text-align:left;padding:8px 10px'><b>Clash Radar</b><div class='tiny muted'>Counter-program rival releases</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaOtt' data-more-tab='ott' style='text-align:left;padding:8px 10px'><b>OTT Streamer</b><div class='tiny muted'>Manage subscriber tiers &amp; catalog</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaLiveTv' data-more-tab='live' style='text-align:left;padding:8px 10px'><b>Linear TV EPG</b><div class='tiny muted'>Program 24h broadcast schedule</div></button>";
  h+="</div></div>";

  // Section 2: Talent & Production Operations
  h+="<div class='card' style='margin-bottom:10px'>";
  h+="<div class='row spread' style='margin-bottom:6px'><b>[TALENT &amp; PRODUCTION]</b><span class='tag gold'>Slate Power</span></div>";
  h+="<div class='grid g2' style='gap:6px'>";
  h+="<button class='btn btn-sm btn-alt' id='qaAgency' style='text-align:left;padding:8px 10px'><b>Agency Packaging</b><div class='tiny muted'>CAA / WME star packages</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaContracts' style='text-align:left;padding:8px 10px'><b>Multi-Pic Contracts</b><div class='tiny muted'>Lock directors &amp; stars for 3-5 films</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaFacilities' style='text-align:left;padding:8px 10px'><b>Studio Facilities</b><div class='tiny muted'>Soundstages, VFX houses &amp; backlots</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaTestScreens' style='text-align:left;padding:8px 10px'><b>Test Screenings</b><div class='tiny muted'>Audience previews &amp; reshoots</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaScouting' style='text-align:left;padding:8px 10px'><b>Location Scouting</b><div class='tiny muted'>Global rebates &amp; tax credits</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaInsurance' style='text-align:left;padding:8px 10px'><b>Production Bonds</b><div class='tiny muted'>Completion insurance &amp; overrun shield</div></button>";
  h+="</div></div>";

  // Section 3: Corporate Strategy, Risk & Intelligence
  h+="<div class='card' style='margin-bottom:10px'>";
  h+="<div class='row spread' style='margin-bottom:6px'><b>[CORPORATE &amp; INTELLIGENCE]</b><span class='tag red'>Risk &amp; Defense</span></div>";
  h+="<div class='grid g2' style='gap:6px'>";
  h+="<button class='btn btn-sm btn-alt' id='qaCrisis' style='text-align:left;padding:8px 10px'><b>Crisis PR War Room</b><div class='tiny muted'>Spin doctor scandals &amp; leaks</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaSpy' style='text-align:left;padding:8px 10px'><b>Studio Espionage</b><div class='tiny muted'>Sabotage rivals &amp; steal scripts</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaMerch' data-more-tab='empire' style='text-align:left;padding:8px 10px'><b>Merchandising Empire</b><div class='tiny muted'>Toys, apparel &amp; theme park rights</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaBonds' data-more-tab='finance' style='text-align:left;padding:8px 10px'><b>Bond Debt Market</b><div class='tiny muted'>Issue institutional junk &amp; AAA notes</div></button>";
  h+="</div></div>";

  // Section 4: Prestige, Culture & Creative Live Ops
  h+="<div class='card' style='margin-bottom:12px'>";
  h+="<div class='row spread' style='margin-bottom:6px'><b>[PRESTIGE &amp; EXPANSION]</b><span class='tag purple'>Awards &amp; IP</span></div>";
  h+="<div class='grid g2' style='gap:6px'>";
  h+="<button class='btn btn-sm btn-alt' id='qaAwards' style='text-align:left;padding:8px 10px'><b>FYC Awards Campaigns</b><div class='tiny muted'>Guild screenings &amp; Oscar pushes</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaFestivals' style='text-align:left;padding:8px 10px'><b>Festival Circuit</b><div class='tiny muted'>Cannes, Venice &amp; Sundance premieres</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaConventions' style='text-align:left;padding:8px 10px'><b>Comic-Con Hall H</b><div class='tiny muted'>Teaser trailers &amp; fandom hype spikes</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaDynasty' style='text-align:left;padding:8px 10px'><b>Franchise Dynasty</b><div class='tiny muted'>Multi-generation studio lineage</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaGames' data-more-tab='games' style='text-align:left;padding:8px 10px'><b>Game Studio</b><div class='tiny muted'>Adapt IP into games &amp; live ops</div></button>";
  h+="<button class='btn btn-sm btn-alt' id='qaSandbox' style='text-align:left;padding:8px 10px'><b>Sandbox Creator</b><div class='tiny muted'>Custom talent, rivals &amp; franchises</div></button>";
  h+="</div></div>";

  // Utility row
  h+="<div class='row' style='gap:6px;flex-wrap:wrap;margin-bottom:10px'>"+
    "<button class='btn btn-sm btn-alt' id='moreAch'>Awards Ledger</button>"+
    "<button class='btn btn-sm btn-alt' id='moreHall'>Hall of Fame</button>"+
    "<button class='btn btn-sm btn-alt' id='moreFinanceLedger' data-more-tab='finance'>Finance Ledger</button>"+
    "<button class='btn btn-sm btn-alt' id='moreSet'>Settings</button>"+
    "<button class='btn btn-sm btn-alt' id='moreHelp'>Help &amp; Guide</button>"+
    "</div>";

  h+="<div class='row spread' style='align-items:center;padding:8px 12px;background:var(--card-sub);border-radius:var(--radius-sm);border:1px solid var(--line)'>"+
    "<button class='btn btn-xs btn-primary' id='moreSave'>Save Progress</button>"+
    "<span class='tiny muted' id='moreSaveInfo'>Box Office War v"+((typeof bowAppVersion==='function')?bowAppVersion():'32.3')+"</span>"+
    "</div>";

  const v=openModal(h);
  v.querySelectorAll("[data-more-tab]").forEach(b=>b.onclick=()=>{ closeModal(); switchTab(b.dataset.moreTab); });

  // Wire Distribution
  const btnTerritory = v.querySelector("#qaTerritory");
  if(btnTerritory) btnTerritory.onclick=()=>{ closeModal(); if(typeof global.openTerritoryDealsModal==='function') global.openTerritoryDealsModal(); else if(typeof BOW_TERRITORIES!=='undefined') BOW_TERRITORIES.openDesk(); };
  const btnClash = v.querySelector("#qaClash");
  if(btnClash) btnClash.onclick=()=>{ closeModal(); if(typeof clashAnalyticsModal==='function') clashAnalyticsModal(); else switchTab("boxoffice"); };
  const btnOtt = v.querySelector("#qaOtt");
  if(btnOtt) btnOtt.onclick=()=>{ closeModal(); switchTab("ott"); };
  const btnLiveTv = v.querySelector("#qaLiveTv");
  if(btnLiveTv) btnLiveTv.onclick=()=>{ closeModal(); switchTab("live"); };

  // Wire Talent & Production
  const btnAgency = v.querySelector("#qaAgency");
  if(btnAgency) btnAgency.onclick=()=>{ closeModal(); if(typeof agencyPackagingModal==='function') agencyPackagingModal(); else switchTab("develop"); };
  const btnContracts = v.querySelector("#qaContracts");
  if(btnContracts) btnContracts.onclick=()=>{ closeModal(); if(typeof contractDeskModal==='function') contractDeskModal(); else switchTab("studio"); };
  const btnFacilities = v.querySelector("#qaFacilities");
  if(btnFacilities) btnFacilities.onclick=()=>{ closeModal(); if(typeof facilitiesModal==='function') facilitiesModal(); else switchTab("studio"); };
  const btnTest = v.querySelector("#qaTestScreens");
  if(btnTest) btnTest.onclick=()=>{ closeModal(); if(typeof testScreeningsModal==='function') testScreeningsModal(); else switchTab("productions"); };
  const btnScouting = v.querySelector("#qaScouting");
  if(btnScouting) btnScouting.onclick=()=>{ closeModal(); if(typeof scoutingModal==='function') scoutingModal(); else switchTab("develop"); };
  const btnInsurance = v.querySelector("#qaInsurance");
  if(btnInsurance) btnInsurance.onclick=()=>{ closeModal(); if(typeof insuranceModal==='function') insuranceModal(); else switchTab("productions"); };

  // Wire Corporate & Risk
  const btnCrisis = v.querySelector("#qaCrisis");
  if(btnCrisis) btnCrisis.onclick=()=>{ closeModal(); if(typeof crisisPrModal==='function') crisisPrModal(); else switchTab("fans"); };
  const btnSpy = v.querySelector("#qaSpy");
  if(btnSpy) btnSpy.onclick=()=>{ closeModal(); if(typeof espionageModal==='function') espionageModal(); else switchTab("fans"); };
  const btnMerch = v.querySelector("#qaMerch");
  if(btnMerch) btnMerch.onclick=()=>{ closeModal(); if(typeof merchLicensingModal==='function') merchLicensingModal(); else switchTab("empire"); };
  const btnBonds = v.querySelector("#qaBonds");
  if(btnBonds) btnBonds.onclick=()=>{ closeModal(); if(typeof bondMarketModal==='function') bondMarketModal(); else switchTab("finance"); };

  // Wire Prestige & Expansion
  const btnAwards = v.querySelector("#qaAwards");
  if(btnAwards) btnAwards.onclick=()=>{ closeModal(); if(typeof awardsCampaignModal==='function') awardsCampaignModal(); else switchTab("fans"); };
  const btnFestivals = v.querySelector("#qaFestivals");
  if(btnFestivals) btnFestivals.onclick=()=>{ closeModal(); if(typeof festivalPrModal==='function') festivalPrModal(); else switchTab("boxoffice"); };
  const btnConventions = v.querySelector("#qaConventions");
  if(btnConventions) btnConventions.onclick=()=>{ closeModal(); if(typeof fanConventionModal==='function') fanConventionModal(); else switchTab("fans"); };
  const btnDynasty = v.querySelector("#qaDynasty");
  if(btnDynasty) btnDynasty.onclick=()=>{ closeModal(); if(typeof dynastyLegacyModal==='function') dynastyLegacyModal(); else switchTab("empire"); };
  const btnGames = v.querySelector("#qaGames");
  if(btnGames) btnGames.onclick=()=>{ closeModal(); switchTab("games"); };
  const btnSandbox = v.querySelector("#qaSandbox");
  if(btnSandbox) btnSandbox.onclick=()=>{ closeModal(); if(typeof customCreatorModal==='function') customCreatorModal(); else switchTab("develop"); };

  // Wire Utilities
  const btnAch = v.querySelector("#moreAch");
  if(btnAch) btnAch.onclick=()=>{ closeModal(); achievementsModal(); };
  const btnHall = v.querySelector("#moreHall");
  if(btnHall) btnHall.onclick=()=>{ closeModal(); hallOfFameModal(); };
  const btnFin = v.querySelector("#moreFinanceLedger");
  if(btnFin) btnFin.onclick=()=>{ closeModal(); financeOverviewSheet(); };
  const btnSet = v.querySelector("#moreSet");
  if(btnSet) btnSet.onclick=()=>{ closeModal(); settingsModal(); };
  const btnHelp = v.querySelector("#moreHelp");
  if(btnHelp) btnHelp.onclick=()=>{ closeModal(); helpModal(); };
  const btnSave = v.querySelector("#moreSave");
  if(btnSave) btnSave.onclick=()=>{ saveGame(); const i=v.querySelector("#moreSaveInfo"); if(i) i.textContent="Saved successfully"; beep("click"); };
}
/* v10 spec §5: tap the cash chip → finance overview drawer */
function financeOverviewSheet(){
  let burn=0; try{ burn=weeklyOverhead(); }catch(e){ burn=0; }
  const runway=Math.floor(Math.max(0,G.studio.cash)/Math.max(0.1,burn));
  let credit=0; try{ credit=maxDebt(); }catch(e){}
  const last=(G.txHistory&&G.txHistory.length)? G.txHistory[G.txHistory.length-1] : null;
  let h="<h3>💰 Studio finance</h3>"+
    "<div class='card'>"+
    "<div class='cost-line'><span>Cash on hand</span><b>"+fmtM(G.studio.cash)+"</b></div>"+
    "<div class='cost-line'><span>Debt</span><b class='"+(G.studio.debt>0.5?"neg":"")+"'>"+fmtM(G.studio.debt)+"</b></div>"+
    "<div class='cost-line'><span>Weekly burn (overhead)</span><b>"+fmtM(burn)+"</b></div>"+
    "<div class='cost-line'><span>Runway (zero revenue)</span><b>"+runway+" wks</b></div>"+
    "<div class='cost-line'><span>Credit capacity</span><b>"+fmtM(credit)+"</b></div>"+
    (last? "<div class='cost-line'><span>Last week net</span><b class='"+(last.net>=0?"pos":"neg")+"'>"+(last.net>=0?"+":"")+fmtM(last.net)+"</b></div>":"")+
    "</div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' id='foClose'>Close</button><button class='btn btn-primary' id='foOpen'>💼 Full ledger</button></div>";
  const v=openModal(h);
  v.querySelector("#foClose").onclick=closeModal;
  v.querySelector("#foOpen").onclick=()=>{ closeModal(); switchTab("finance"); };
}
let _advancingWeek = false;
function doWeek(n){
  if(_advancingWeek) return;
  if(!G || G.over){ if(G && G.over) gameOverModal(); return; }
  _advancingWeek = true;
  const btn = $("#btnWeek");
  if(btn) btn.classList.add("btn-advancing");
  try{
    WKSNAP={ cash:G.studio.cash, fromWeek:G.week, weeks:n };
    beep("clap");
    if(n===1) advanceWeek(); else advanceWeeks(n);
    afterTick();
  }finally{
    _advancingWeek = false;
    if(btn) btn.classList.remove("btn-advancing");
  }
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
  else if(G.pendingSale) saleModal();
  else if(G.pendingSports) sportsModal();
  else if(G.pendingReport) reportModal();
  else if(G.over) gameOverModal();
  else weekSummaryModal();   // v8: pop the week's report when nothing else needs you
}

/* ═══════════ top chips + render router ═══════════ */
/* v7: cash chip counts to its new value and flashes green/red on the way */
let LASTCASH=null, cashRaf=null;
function setCashChip(v){
  const el=$("#chipCash"); if(!el) return;
  const from=(typeof LASTCASH==="number" && isFinite(LASTCASH))?LASTCASH:v;
  LASTCASH=v;
  if(cashRaf){ cancelAnimationFrame(cashRaf); cashRaf=null; }
  if(Math.abs(v-from)<0.05 || !motionOK()){ el.textContent=fmtM(v); return; }
  const wrap=el.closest?el.closest(".chip"):null;
  if(wrap){ wrap.classList.remove("chip-flash-up","chip-flash-down"); void wrap.offsetWidth; wrap.classList.add(v>from?"chip-flash-up":"chip-flash-down"); }
  const t0=(typeof performance!=="undefined")?performance.now():Date.now();
  const dur=420;
  (function tick(now){
    const t=((typeof performance!=="undefined")?performance.now():Date.now())-t0;
    const k=Math.min(1,t/dur), e=1-Math.pow(1-k,3);
    el.textContent=fmtM(from+(v-from)*e);
    if(k<1){ cashRaf=(window.requestAnimationFrame||function(f){setTimeout(f,16);})(tick); }
    else{ el.textContent=fmtM(v); cashRaf=null; }
  })();
}
let _renderTimer = null;
function render(){
  if(_renderTimer) return; // debounce
  _renderTimer = setTimeout(() => {
    _renderTimer = null;
    _renderImpl();
  }, 0);
}
function _renderImpl(){
  if(!G) return;
  const tStart = (typeof performance!=="undefined") ? performance.now() : 0;
  try {
    $("#brandName").textContent=G.studio.name;
    setCashChip(G.studio.cash);
    $("#chipDebt").textContent=fmtM(G.studio.debt);
    $("#chipDebtWrap").style.display = G.studio.debt>0.5? "":"none";
    const xp = typeof studioXpLevel==="function" ? studioXpLevel() : null;
    $("#chipRep").textContent=Math.round(G.studio.rep) + (xp ? " · " + xp.badge : "");
    const hiM = (typeof hiMonth==="function")? hiMonth(woyOf(G.week)) : null;
    $("#chipDate").textContent = hiM
      ? "साल "+yearOf(G.week)+" · "+hiM+" · सप्ताह "+woyOf(G.week)
      : "Y"+yearOf(G.week)+" · "+DATA.seasonOf(woyOf(G.week)).month+" W"+woyOf(G.week);
    const v=$("#view");
    let h="";
    if(TAB==="dashboard") h=viewDashboard();
    else if(TAB==="studiolot") h=viewStudioLot2D();
    else if(TAB==="studio") h=viewStudio();
    else if(TAB==="develop") h=viewDevelop();
    else if(TAB==="productions") h=viewProductions();
    else if(TAB==="boxoffice") h=viewBoxOffice();
    else if(TAB==="fans") h=viewFans();
    else if(TAB==="ott") h=viewOTT();
    else if(TAB==="live") h=viewLive();
    else if(TAB==="empire") h=viewEmpire();
    else if(TAB==="library") h=viewLibrary();
    else if(TAB==="games") h=viewGames();
    else if(TAB==="finance") h=viewFinance();
    else if(TAB==="notifications") h=viewInboxScreen();
    if(TAB==="studio" && STUDIO_SUB!=="lot"){
      const identity={csuite:["Leadership","Build the team behind every production."],board:["Strategy","Set priorities. Meet commitments. Grow with purpose."],operations:["Workforce","Keep your people, partnerships, and productions healthy."],crisis:["Reputation","Protect your studio’s standing when the pressure rises."],heritage:["Legacy","Build the partnerships and stories that outlast a single film."]}[STUDIO_SUB];
      if(identity) h=commandSubpage("studio",identity[0],identity[1],h);
    }
    const tb = tutBanner();   // v5 interactive tutorial rides on top of every tab
    /* v34.6: fans joined the command desks, so the pixel banner would double up the header */
    const kairoBanner = (typeof KairoTheme !== "undefined" && !["studiolot", "dashboard", "studio", "develop", "productions", "boxoffice", "fans", "ott", "live", "empire", "notifications"].includes(TAB))
      ? KairoTheme.renderBanner(TAB, (TAB === "develop" ? (typeof DEVELOP_SUB !== "undefined" ? DEVELOP_SUB : null) : null))
      : "";
    v.dataset.screen = TAB;
    const commandNav = ["dashboard", "studio"].includes(TAB) ? commandSectionNav(TAB) : (TAB === "develop" ? commandDevelopNav() : "");
    v.innerHTML = (tb? tb : "") + kairoBanner + commandNav + h;
    bindView();
    bindFolds(v);   // v15: collapsible sections remember their state
    updateBellBadge();   // v28.16: keep the bell badge fresh on every render
    if(tStart && typeof performance!=="undefined"){
      const tDur = performance.now() - tStart;
      if(tDur > 50 && typeof console!=="undefined") console.debug("Render took", Math.round(tDur)+"ms");
    }
  } catch(err) {
    if(typeof console!=="undefined") console.error("Render boundary caught error:", err);
    const v = $("#view");
    if(v){
      const errMsg = (err && err.message) ? String(err.message).replace(/[<>]/g, "") : "Unknown display exception";
      v.innerHTML = "<div class='card' style='max-width:540px;margin:40px auto;text-align:center;padding:24px'>"+
        "<div style='font-size:18px;font-weight:bold;color:var(--gold);letter-spacing:1px;margin-bottom:8px'>[STUDIO RECOVERY INTERFACE]</div>"+
        "<h3 style='margin:12px 0 6px'>Something interrupted the studio</h3>"+
        "<p class='small muted' style='margin-bottom:12px'>A temporary display glitch occurred. Your save data is safe.</p>"+
        "<div class='tiny muted' style='background:rgba(255,255,255,0.04);padding:8px;border-radius:4px;margin-bottom:16px;font-family:monospace;word-break:break-word'>" + errMsg + "</div>"+
        "<div class='row' style='justify-content:center;gap:10px'>"+
        "<button class='btn btn-primary' onclick='location.reload()'>Reload Studio</button>"+
        "<button class='btn btn-alt' onclick='try{loadGame();}catch(e){}location.reload()'>Reload Last Save</button>"+
        "</div></div>";
    }
  }
}

/* ═══════════ VIEW: fans (v15) — the audience-facing desk ═══════════ */
let FAN_MAIL_FILTER = "all";

/* v34.6: what's next — a hardcoded changelog for the Fans desk. No network,
   no game state: the list ships with the build, newest version first.
   status: "shipped" (gold) | "active" (in progress, teal) | "planned" (muted). */
const NEXT_UPDATES = [
  { version:"34.9", label:"Live Desk — the broadcast command desk + Develop-a-Show lab (Live TV rebuilt: home, channels, shows, grid, stream, events, hosts)", status:"shipped" },
  { version:"34.8", label:"🟡 §45 Board verdicts on pitches — pass, notes, re-pitch", status:"planned" },
  { version:"34.7", label:"Streamer sub-tabs — originals, library, finance, sports, deals", status:"shipped" },
  { version:"34.6", label:"Fans desk rebrand + what's next roadmap", status:"shipped" },
  { version:"34.5", label:"Box office charts + produce dialogs", status:"shipped" },
  { version:"34.4", label:"Legacy dialog chrome", status:"shipped" }
];
/* chip class + label per status; unknown statuses fall back to "planned". */
const NEXT_UPDATE_STATUS = {
  shipped: ["gold","SHIPPED"],
  active:  ["teal","IN PROGRESS"],
  planned: ["muted","PLANNED"]
};
/* the running build's version, straight from the document head. */
function nextAppVersion(){
  try{
    if(typeof document==="undefined") return "";
    const m=document.querySelector('meta[name="app-version"]');
    return m ? String(m.getAttribute("content")||"").trim() : "";
  }catch(e){ return ""; }
}
function nextUpdatesPanel(items){
  const list = Array.isArray(items) ? items : NEXT_UPDATES;
  const shipped = list.filter(it=>it && it.status==="shipped").length;
  const version = nextAppVersion();
  const rows = list.length
    ? "<ol class='bo-next-list'>"+list.map(it=>{
        const st = NEXT_UPDATE_STATUS[it && it.status] || NEXT_UPDATE_STATUS.planned;
        return "<li class='bo-next-item "+esc((it&&it.status)||"planned")+"'>"+
          "<span class='bo-next-ver'>v"+esc((it&&it.version)||"—")+"</span>"+
          "<span class='bo-next-label'>"+esc((it&&it.label)||"Untitled update")+"</span>"+
          "<span class='bo-chip "+st[0]+"'>"+st[1]+"</span>"+
        "</li>";
      }).join("")+"</ol>"
    : "<div class='bo-next-empty'><b>The roadmap is empty.</b>"+
      "<p>Nothing is queued in this build. What ships next gets written here first.</p></div>";
  return "<section class='produce-panel bo-next' aria-label=\"What's next roadmap\">"+
    "<div class='produce-panel-head'><div>"+
      "<span class='command-eyebrow'>ROADMAP / FANS DESK</span>"+
      "<h2>📌 WHAT'S NEXT</h2>"+
      "<p>What already shipped and what is being built next — read-only, straight from this build.</p>"+
    "</div><span class='produce-stamp'>"+(version? "v"+esc(version) : "v—")+"</span></div>"+
    "<div class='bo-next-body'>"+
      "<div class='bo-kpis'>"+
        "<div class='bo-kpi'><small>APP VERSION</small><b>"+(version? esc(version):"—")+"</b><span>meta app-version</span></div>"+
        "<div class='bo-kpi'><small>ON THE LIST</small><b>"+list.length+"</b><span>updates tracked</span></div>"+
        "<div class='bo-kpi'><small>SHIPPED</small><b>"+shipped+"</b><span>of "+list.length+" done</span></div>"+
      "</div>"+rows+
    "</div></section>";
}

/* ── v34.6 Fans desk ────────────────────────────────────────────────────────
   Rebranded to the management chrome the other desks wear: one command header,
   one telemetry strip, produce panels underneath. The mailroom's IDs, data
   attributes and bindings are untouched (#btnMailRead, [data-mail-cat],
   [data-mail-reply], [data-mail-apology], #btnFanGala) and nothing here writes
   simulation state. Reads offline: trend tags, buzz and audience scores all
   come from existing helpers. */
const FAN_MAIL_CATS = [["all","All"],["love","💌 Love"],["demand","🙏 Demands"],["angry","😡 Angry"],["scandal","📰 Scandal"],["sub","📺 Subscribers"]];

function fansHead(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  return "<header class='command-heading'><div>"+
    "<span class='command-edition'>FANS DESK / YEAR "+yearOf(G.week)+"</span>"+
    "<span class='command-eyebrow'>AUDIENCE RELATIONS</span>"+
    "<h1>The fan desk</h1>"+
    "<p>Letters, trending noise and the people who buy the tickets. Answer them here — every reply moves buzz.</p>"+
    "</div><div class='command-date'><span>WEEK</span><b>"+String(w).padStart(2,"0")+"</b><small>"+esc(m.month)+"</small></div></header>";
}
/* one read of the audience numbers, shared by the telemetry strip and the pulse panel */
function fansAudienceStats(){
  const recent=(G.films||[]).filter(f=>f.ww>0).slice(-8);
  const audOf=f=>(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
  const avg=recent.length? Math.round(recent.reduce((a,f)=>a+audOf(f),0)/recent.length) : 0;
  const fav=recent.length? recent.slice().sort((a,b)=>audOf(b)-audOf(a))[0] : null;
  const replied=(G.mail||[]).filter(m=>m.replied).length;
  return {recent:recent, audOf:audOf, avg:avg, fav:fav, replied:replied};
}
function fansTelemetry(){
  const rawMail=(G.mail||[]);
  let unread=0; try{ unread=unreadMail(); }catch(e){}
  let trend=[]; try{ trend=trendingBoard()||[]; }catch(e){}
  let live=[]; try{ live=activeFilms()||[]; }catch(e){}
  const st=fansAudienceStats();
  return "<div class='command-telemetry'>"+
    commandMetric("UNREAD LETTERS", String(unread), rawMail.length+" in the pile")+
    commandMetric("TRENDING TAGS", String(trend.length), "Across the platforms")+
    commandMetric("LIVE RUNS", String(live.length), "Buzz on screens")+
    commandMetric("AUDIENCE SCORE", st.recent.length? st.avg+"%" : "—", st.recent.length? "Recent films" : "No releases yet")+
  "</div>";
}
function fansPanel(eyebrow,title,description,content,stamp,cls){
  return "<section class='produce-panel"+(cls? " "+cls:"")+"'><div class='produce-panel-head'><div>"+
    "<span class='command-eyebrow'>"+eyebrow+"</span><h2>"+title+"</h2>"+
    (description? "<p>"+description+"</p>":"")+
    "</div>"+(stamp? "<span class='produce-stamp'>"+stamp+"</span>":"")+"</div>"+content+"</section>";
}
function fansMailPanel(){
  const rawMail=(G.mail||[]);
  let unread=0; try{ unread=unreadMail(); }catch(e){}
  const mail=rawMail.filter(m=>FAN_MAIL_FILTER==="all"? true : m.kind===FAN_MAIL_FILTER);
  const filters="<div class='produce-filters fans-mail-filters' role='group' aria-label='Filter fan mail'>"+
    FAN_MAIL_CATS.map(function(cat){
      const k=cat[0], label=cat[1];
      const n = k==="all"? rawMail.length : rawMail.filter(m=>m.kind===k).length;
      const on = FAN_MAIL_FILTER===k;
      return "<button data-mail-cat='"+k+"' class='"+(on?"active":"")+"' aria-pressed='"+(on?"true":"false")+"'>"+label+"<b>"+n+"</b></button>";
    }).join("")+"</div>";
  const ICON={love:"💌", demand:"🙏", angry:"😡", scandal:"📰", sub:"📺"};
  let rows="";
  if(!mail.length){
    rows="<div class='bo-empty'><b>No letters in this category.</b><p>Release something people love — or love to hate — and the letters come.</p></div>";
  }else{
    rows="<div class='bo-mail-list'>"+mail.slice(0,14).map(function(m){
      const realIdx=rawMail.indexOf(m);
      let act="";
      if(m.kind==="love" && !m.replied) act="<button class='produce-ghost bo-mail-act' data-mail-reply='"+realIdx+"'>💌 Send thanks <small>+0.5% buzz</small></button>";
      else if(m.kind==="angry" && !m.replied) act="<button class='produce-ghost bo-mail-act' data-mail-apology='"+realIdx+"'>🕊️ Apologize <small>−scandal</small></button>";
      else if(m.replied) act="<span class='bo-chip good'>✓ REPLIED</span>";
      return "<article class='bo-mail-row"+(m.unread?" unread":"")+"'>"+
        "<span class='bo-mail-icon' aria-hidden='true'>"+(ICON[m.kind]||"✉️")+"</span>"+
        "<div class='bo-mail-main'>"+
          "<div class='bo-mail-top'><b>"+esc(m.from)+"</b>"+
            (m.unread? "<span class='bo-chip gold'>NEW</span>":"")+
            "<small>Y"+yearOf(m.w)+" W"+woyOf(m.w)+"</small></div>"+
          "<p>"+esc(m.text)+"</p>"+
          "<div class='bo-mail-foot'>"+(m.film? "<small>re: "+esc(m.film)+"</small>" : "<span></span>")+act+"</div>"+
        "</div></article>";
    }).join("")+"</div>";
    if(mail.length>14) rows+="<div class='bo-mail-more'>+"+(mail.length-14)+" older letters in the pile.</div>";
  }
  const aside="<div class='bo-panel-aside'>"+
    "<span class='produce-stamp'>"+(rawMail.length? rawMail.length+" LETTERS" : "INBOX EMPTY")+"</span>"+
    (rawMail.length? "<button class='produce-ghost' id='btnMailRead'>Mark all read</button>":"")+
  "</div>";
  const head="<div class='produce-panel-head'><div><span class='command-eyebrow'>MAILROOM</span>"+
    "<h2>📬 Fan mail"+(unread? " <small class='bo-count'>"+unread+" unread</small>":"")+"</h2>"+
    "<p>Love, demands and the occasional pile-on. Replying costs nothing and pays buzz.</p></div>"+aside+"</div>";
  return "<section class='produce-panel bo-mail'>"+head+filters+rows+"</section>";
}
function fansGalaPanel(){
  return "<section class='produce-panel bo-gala'>"+
    "<div class='produce-panel-head'><div><span class='command-eyebrow'>EVENT</span>"+
    "<h2>🎉 Host a fan gala</h2>"+
    "<p>Meet &amp; greet the faithful. Every theatrical title gets a bump and the room remembers it.</p></div>"+
    "<span class='produce-stamp'>$2M</span></div>"+
    "<div class='bo-gala-body'>"+
      "<div class='bo-chip-row'><span class='bo-chip gold'>+5% BUZZ</span><span class='bo-chip teal'>REP +1</span><span class='bo-chip muted'>ONE-OFF SPEND</span></div>"+
      "<button class='produce-action' id='btnFanGala'>🎉 Host gala — $2M</button>"+
    "</div></section>";
}
function fansTrendingPanel(){
  let tags=[]; try{ tags=trendingBoard()||[]; }catch(e){}
  const rows=tags.length? "<div class='bo-track-rows'>"+tags.map(function(tg){
    const soc=(DATA.SOCIALS||[]).find(s=>s.name===tg.plat);
    const heat=Math.max(1,Math.min(3, tg.heat||1));
    return "<div class='bo-track-row'>"+
      "<div class='bo-track-label'><span aria-hidden='true'>"+(soc? soc.icon : "💬")+"</span><span class='bo-track-text'>"+esc(tg.tag)+"<small>"+esc(tg.why)+"</small></span></div>"+
      "<div class='bo-track teal'><i style='width:"+Math.round(heat/3*100)+"%'></i></div>"+
      "<div class='bo-track-val'>"+esc(tg.plat)+"</div></div>";
  }).join("")+"</div>" : "<div class='bo-empty'><b>Quiet feeds.</b><p>Big openings, scandals and hot casts make noise. Nothing is loud this week.</p></div>";
  const body=fold("fans-trending","What the platforms are talking about", rows, {open:true, hint:tags.length? tags.length+" tags":""});
  return fansPanel("SOCIAL","📣 Trending",
    "Hashtags driven by real state — chart leaders, memes, scandals and feuds.",
    "<div class='bo-panel-body'>"+body+"</div>",
    tags.length? tags.length+" TAGS" : "QUIET", "bo-trending");
}
function fansBuzzPanel(){
  let live=[]; try{ live=activeFilms()||[]; }catch(e){}
  const figures=live.map(function(f){
    const buzz=Math.round(f.buzz||20);
    const bHist=(f.buzzHistory && f.buzzHistory.length>1)? f.buzzHistory : [buzz,buzz,buzz+3,buzz];
    return "<div class='bo-figure bo-buzz-figure'>"+
      "<div class='bo-figure-head'><b>"+esc(f.title)+"</b>"+
        "<span class='bo-chip "+(buzz>=60?"good":buzz<35?"bad":"gold")+"'>BUZZ "+buzz+"</span></div>"+
      "<div class='bo-buzz-momentum'><small>20-WK BUZZ MOMENTUM</small>"+
        renderSparklineSVG(bHist,{color:'#edc47c',width:96,height:18})+"</div>"+
      socialPanel(f)+"</div>";
  }).join("");
  const body=live.length? "<div class='bo-panel-body'><div class='bo-buzz-grid'>"+figures+"</div></div>"
    : "<div class='bo-empty'><b>The feeds are quiet.</b><p>Nothing is in theaters. Finish a picture and date it — buzz only moves when people can buy a ticket.</p><button class='produce-action' onclick=\"switchTab('productions')\">Open productions →</button></div>";
  return fansPanel("BUZZ","💬 Buzz on your films",
    "What each live run is doing to the timeline, week by week.",
    body, live.length? live.length+" LIVE" : "NO RUNS", "bo-buzz");
}
function fansPulsePanel(){
  const st=fansAudienceStats();
  const body=st.recent.length
    ? "<div class='bo-panel-body'><div class='bo-kpis'>"+
        "<div class='bo-kpi"+(st.avg>=70?" good":st.avg<50?" bad":"")+"'><small>AUDIENCE SCORE</small><b>"+st.avg+"%</b><span>Recent "+st.recent.length+" film"+(st.recent.length===1?"":"s")+"</span></div>"+
        "<div class='bo-kpi'><small>FAN FAVOURITE</small><b class='bo-kpi-title'>"+esc(st.fav.title)+"</b><span>Highest audience score</span></div>"+
        "<div class='bo-kpi'><small>REPLIES SENT</small><b>"+st.replied+"</b><span>Thanks and apologies</span></div>"+
      "</div><p class='bo-figure-cap'>Fan letters with real love behind them pay <b>+1% buzz</b> to a film still in theaters — once per film.</p></div>"
    : "<div class='bo-empty'><b>No audience yet.</b><p>Once a picture starts reporting, its audience score lands here.</p></div>";
  return fansPanel("AUDIENCE","⭐ Audience pulse",
    "How the people who actually bought tickets feel about the slate.",
    body, st.recent.length? st.avg+"%" : "NO DATA", "bo-pulse");
}

function viewFans(){
  return "<section class='command-deck command-produce command-fans'>"+
    fansHead()+fansTelemetry()+
    fansMailPanel()+fansGalaPanel()+
    fansTrendingPanel()+fansBuzzPanel()+fansPulsePanel()+
    nextUpdatesPanel()+
  "</section>";
}

/* ═══════════ VIEW: studio ═══════════ */
/* Control-room ops strip: read-only rollup of warnings, deadlines, production,
   market and rivals from existing state. No simulation writes here. */
/* v9: shared ops warnings — used by the studio control room AND the weekly report popup */
function opsWarnings(){
  const warns=[];
  try{
    const st=G.studio;
    if(st.cash<25) warns.push("Cash low ("+fmtM(st.cash)+") — bridge with loans or pre-sales.");
    try{ if(st.debt>0 && (st.debt-Math.max(st.cash,0))>maxDebt()) warns.push("Debt beyond credit line — bank watches. See Finance."); }catch(e){}
    if((G.weeksInDebt||0)>0) warns.push("Net debt over line "+G.weeksInDebt+"/3 wks — bankruptcy risk.");
    if(G.theaterCap>0) warns.push("Theater caps −45% box office for "+G.theaterCap+" wks.");
    if((G.unionMeter||0)>=(DATA.UNION?DATA.UNION.strikeAt:75)) warns.push("Guild strike risk — shoots may halt.");
    if((G.piracy||0)>=60) warns.push("Piracy "+Math.round(G.piracy||0)+"/100 bleeds live runs.");
    if(G.streamer && G.week-(G.streamer.lastContent||0)>6) warns.push("Streamer starved — churn bleeding subs.");
    if(G.pendingChoice) warns.push("A decision needs you (event choice pending).");
    if(G.pendingAuction) warns.push("Streaming auction waiting — pick a bid or keep theatrical.");
    if(G.pendingSale) warns.push("Festival market offer waiting — sell the picture or walk away.");
    if(G.pendingSports) warns.push("Sports rights auction expires W"+(G.pendingSports.expires||"?")+".");
    if(G.pendingDeepfake) warns.push("Deepfake drill open — 2-week clock running.");
    (G.offers||[]).filter(o=>o.expires-G.week<=1).forEach(o=>{ warns.push("Offer expiring: "+(o.filmTitle||o.seriesTitle||"deal")+" ("+fmtM(o.value)+")."); });
  }catch(e){}
  return warns;
}
function studioOpsCard(ctx){
  ctx=ctx||{};
  const warns=opsWarnings(), deadlines=[], prod=[], market=[], rivals=[];
  try{
    const st=G.studio, woy=woyOf(G.week);
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
    "<div class='card' style='border-left:3px solid var(--gold2)'><b>📬 The audience</b><div class='tiny muted' style='margin-top:4px'>"+unreadMail()+" unread fan letter(s) · trending tags · buzz — all on the Fans tab.</div>"+
      "<div class='row' style='margin-top:8px'><button class='btn btn-sm' onclick=\"switchTab('fans')\">Open Fans</button></div></div>"+
    "<div class='card'><b>📰 Recent</b><div class='tiny muted'>"+(G.news||[]).slice(0,3).map(n=>esc(n.t)).join("<br>")+"</div></div>"+
  "</div>";
}
function viewStudio(){
  const st = G.studio;
  const yr = yearOf(G.week);
  if(typeof STUDIO_SUB === "undefined") STUDIO_SUB = "lot";

  // Calculate infrastructure metrics
  const backlotData = (typeof StudioOperationsSuite !== "undefined" && StudioOperationsSuite.getBacklotData) ?
    StudioOperationsSuite.getBacklotData() : { stagesBuilt: 1, stagesOccupied: 0, discount: 0 };
  const csuiteData = (typeof StudioOperationsSuite !== "undefined" && StudioOperationsSuite.getCSuiteData) ?
    StudioOperationsSuite.getCSuiteData() : { hiredCount: 0, total: 4 };
  const staffStam = (typeof GameDevHardware !== "undefined" && GameDevHardware.getAverageStaffStamina) ?
    GameDevHardware.getAverageStaffStamina() : 85;

  let h = "";
  if(STUDIO_SUB === "lot") return commandStudio(backlotData, csuiteData, staffStam);

  if(STUDIO_SUB === "csuite"){
    if(typeof StudioOperationsSuite !== "undefined" && typeof StudioOperationsSuite.renderCSuiteSection === "function"){
      h += StudioOperationsSuite.renderCSuiteSection();
    }
    return h;
  }

  if(STUDIO_SUB === "board") return commandStrategyContent(G,false);

  if(STUDIO_SUB === "operations"){
    const exhibitor=Math.round(G.exhibitor??G.exhibRel??50), piracy=Math.round(G.piracy||0), guild=Math.round(G.unionMeter||0);
    const signals=[['01','Exhibition partners',exhibitor,'RELATIONSHIP HEALTH','Shorter release windows can strain exhibitor trust.'],['02','Catalogue protection',piracy,'PIRACY PRESSURE','Illicit copies reduce weekly theatrical revenue.'],['03','Guild temperature',guild,'LABOUR PRESSURE','AI productions and unsettled talks can increase guild tension.']];
    return `<div class="workforce-workspace"><section class="workforce-signals">${signals.map(([n,title,value,label,desc])=>`<article><header><span>${n} / OPERATING SIGNAL</span><b>${value}<small>/100</small></b></header><h2>${title}</h2><div class="workforce-signal-track"><i style="width:${clamp(value,0,100)}%"></i></div><small>${label}</small><p>${desc}</p>${n==='02'?`<button class="command-secondary" id="btnDeployAntiPiracy" ${G.studio.cash<4?'disabled':''}>Deploy protection · $4M</button>`:''}</article>`).join('')}</section>${typeof GameDevHardware!=='undefined'?GameDevHardware.renderStaffStaminaSection():''}<nav class="workforce-specialists" aria-label="Workforce specialist desks"><button id="btnOpenCrisisPr"><span>01 / PROTECT</span><b>Reputation desk ↗</b><small>Respond to production scandals and trade leaks.</small></button><button id="btnOpenEspionage"><span>02 / ANTICIPATE</span><b>Intelligence bureau ↗</b><small>Review rival activity and industry intelligence.</small></button></nav></div>`;
  }

  if(STUDIO_SUB === "crisis"){
    if(typeof HollywoodCrises !== "undefined" && typeof HollywoodCrises.renderCrisisCenterSection === "function"){
      h += HollywoodCrises.renderCrisisCenterSection();
    }
    return h;
  }

  // Heritage & Dynasty
  h += "<div class='section-title'>Studio Heritage &amp; Dynasty</div><div class='grid g2'>"+
    "<div class='card'><b>Dynasty &amp; Succession</b><div class='tiny muted' style='margin:4px 0'>Plan succession, prepare heirs, and preserve prestige across generations.</div>"+
    "<button class='btn btn-sm btn-primary' id='btnOpenDynasty'>Dynasty &amp; Heirs</button></div>"+
    "<div class='card'><b>Film Restoration Vault</b><div class='tiny muted' style='margin:4px 0'>Restore decayed catalog classics into pristine 4K HDR master prints for re-releases.</div>"+
    "<button class='btn btn-sm btn-primary' id='btnRestorationVault'>Restoration Vault</button></div>"+
    "<div class='card'><b>Multi-Picture Talent Pacts</b><div class='tiny muted' style='margin:4px 0'>Lock stars and directors into 3- or 5-picture commitments with volume discounts.</div>"+
    "<button class='btn btn-sm btn-primary' id='btnOpenContracts'>Talent Contracts</button></div>"+
    "<div class='card'><b>Shared Cinematic Universes</b><div class='tiny muted' style='margin:4px 0'>Link films across connected universes and build massive crossover team-up events.</div>"+
    "<button class='btn btn-sm btn-primary' id='btnOpenUniverses'>Cinematic Universes</button></div>"+
  "</div>";
  {
    const got = (typeof achCount==="function") ? achCount() : Object.keys(G.ach||{}).length;
    if(got){
      h += "<div class='section-title'>Achievements ("+got+"/"+(typeof achTotal==="function"?achTotal():"?")+")</div><div class='card'><div class='row'>";
      DATA.ACH.filter(a=>G.ach&&G.ach[a.id]).slice(-14).forEach(function(a){ h += "<span class='tag gold' title='"+esc(a.desc||"")+"'>"+esc(a.name)+"</span>"; });
      h += "</div></div>";
    }
  }
  return h;
}
function viewStudioLegacyRest(){
  let h = "";
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
  if(G.streamer) h+="<div class='card' style='border-left:3px solid var(--purple)'><b>📱 "+esc(G.streamer.name)+"</b> <button class='btn btn-xs btn-ghost' data-rename='st:0' title='Rebrand'>✏️</button> — "+G.streamer.subs.toFixed(1)+"M subs · +"+fmtM(G.streamer.income||G.streamer.totalRev||0)+"/wk · ceiling "+streamerCeiling()+"M</div>";
  h+="<div class='card' style='border-left:3px solid var(--line)'><div class='spread'><span class='small muted'>🎞 Exhibitor relations</span><b class='"+( (G.exhibitor??G.exhibRel??50)>=50?"pos":"neg")+"'>"+Math.round(G.exhibitor??G.exhibRel??50)+"/100</b></div>"+meter(G.exhibitor??G.exhibRel??50,100)+"<div class='tiny muted'>Short windows anger exhibitors and swing openings ±5%.</div></div>";
  /* v5: piracy meter (item 8) — windowing feeds it, the task force fights it */
  {
    const pl=(typeof piracyLabel==="function")? piracyLabel() : {tag:"",cls:""};
    h+="<div class='card' style='border-left:3px solid var(--line)'><div class='spread'><span class='small muted'>🏴‍☠️ Piracy meter</span><b>"+Math.round(G.piracy||0)+"/100 <span class='tag "+pl.cls+"'>"+pl.tag+"</span></b></div>"+
       meter(G.piracy||0,100,"linear-gradient(90deg,#5a6a90,#ff5d6c)")+
       "<div class='spread' style='margin-top:6px'><div class='tiny muted'>Drains weekly gross on live runs. The task force scrubs illicit copies.</div>"+
       "<button class='btn btn-xs btn-alt' id='btnDeployAntiPiracy'>🚨 Task Force ($4M)</button></div></div>";
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
       "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(6,r.ww/max*100)+"%;background:"+(r.me?"linear-gradient(90deg,var(--gold),var(--gold2))":"#4a5570")+"'>"+fmtM(r.ww)+"</div></div></div>";
  });
  h+="</div>";
  /* v32: Ventures & Expansions */
  h+="<div class='section-title'>Studio Ventures &amp; Expansions</div><div class='grid g2'>"+
    "<div class='card'><b>Production Facilities &amp; Lot</b><div class='tiny muted' style='margin:4px 0'>Build soundstages, LED virtual production volumes, and backlots. Lease idle space to rivals.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenFacilities'>Manage Studio Lot</button></div>"+
    "<div class='card'><b>TV Syndication Packages</b><div class='tiny muted' style='margin:4px 0'>License catalog films to national broadcast networks and cable syndication for weekly royalties.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenSyndication'>Syndication Desk</button></div>"+
    "<div class='card'><b>Corporate Bond Market</b><div class='tiny muted' style='margin:4px 0'>Issue fixed-coupon corporate debt notes (AAA to CCC) to raise massive production capital.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenBonds'>Bond Desk</button></div>"+
    "<div class='card'><b>Multi-Picture Talent Pacts</b><div class='tiny muted' style='margin:4px 0'>Lock stars and directors into 3- or 5-picture commitments with volume discounts.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenContracts'>Talent Contracts</button></div>"+
    "<div class='card'><b>Theater Chains</b><div class='tiny muted' style='margin:4px 0'>Own screens, capture 100% theatrical split and weekly concessions revenue.</div>"+
      "<button class='btn btn-sm btn-alt' id='btnOpenTheaters'>Manage Theater Chains</button></div>"+
    "<div class='card'><b>Talent Agency</b><div class='tiny muted' style='margin:4px 0'>Sign stars to your in-house agency, eliminate packaging fees, and collect rival commissions.</div>"+
      "<button class='btn btn-sm btn-alt' id='btnOpenTalentAgency'>Talent Agency Desk</button></div>"+
    "<div class='card'><b>Dynasty &amp; Legacy</b><div class='tiny muted' style='margin:4px 0'>Plan succession, prepare heirs, and preserve prestige across generations.</div>"+
      "<button class='btn btn-sm btn-alt' id='btnOpenDynasty'>Dynasty &amp; Heirs</button></div>"+
    "<div class='card'><b>Seeded Challenges</b><div class='tiny muted' style='margin:4px 0'>Compete on deterministic daily/weekly seeds and share score codes.</div>"+
      "<button class='btn btn-sm btn-alt' id='btnOpenChallenges'>Challenges &amp; Leaderboard</button></div>"+
    "<div class='card'><b>Board Directives &amp; Governance</b><div class='tiny muted' style='margin:4px 0'>Meet quarterly shareholder milestones for executive bonuses and board confidence.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenBoard'>Board of Directors</button></div>"+
    "<div class='card'><b>Studio Fan Club &amp; Conventions</b><div class='tiny muted' style='margin:4px 0'>Grow your fan community and host annual Hall H Comic-Con showcases for massive buzz.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenFanClub'>Fan Club &amp; Cons</button></div>"+
    "<div class='card'><b>Industrial Espionage Desk</b><div class='tiny muted' style='margin:4px 0'>Plant undercover informants to steal rival slates and sabotage clash openings.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenEspionage'>Espionage Desk</button></div>"+
    "<div class='card'><b>Franchise Merchandise Licensing</b><div class='tiny muted' style='margin:4px 0'>License blockbuster IP for action figures, video games, and theme park rides.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenMerch'>Merchandise Licensing</button></div>"+
    "<div class='card'><b>Shared Cinematic Universes</b><div class='tiny muted' style='margin:4px 0'>Link films across connected universes and build massive crossover team-up events.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenUniverses'>Cinematic Universes</button></div>"+
    "<div class='card'><b>FYC Awards Lobbying Campaign</b><div class='tiny muted' style='margin:4px 0'>Run trade print spreads and voter galas to capture Oscars and guild trophies.</div>"+
      "<button class='btn btn-sm btn-primary' id='btnOpenAwardsCampaign'>FYC Awards Desk</button></div>"+
  "</div>";
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
  try{ h+=studioDnaCard(); }catch(e){}
  try{ h+=studioRecentReleasesCard(); }catch(e){}
  try{ h+=influenceCard(); }catch(e){}
  try{ h+=talentFeudMap(); }catch(e){}
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
  if((G.repHistory||[]).length > 1){
    h+="<div class='spread' style='margin-top:8px'><span class='small muted'>52-Week Reputation Trend:</span>"+renderSparklineSVG(G.repHistory, 140, 24, "var(--gold)")+"</div>";
  }
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
    studioXpProgressBar()+
    "<div class='tiny muted' style='margin-top:4px'>"+repNext+". Reputation moves with hits, flops, awards and quarters.</div>"+
    "<div class='row' style='margin-top:8px'>"+un.map(u=>"<span class='tag "+(u[2]?"green":"")+"' title='"+u[3]+"'>"+(u[2]?"✓ ":"")+u[0]+" "+u[1]+"</span>").join("")+"</div></div>";
  h+="<div class='card'><b>📜 Legacy</b><div class='tiny muted'>Year "+yearOf(G.week)+" · "+(G.stats.films||0)+" films · "+fmtM(G.stats.totalWW||0)+" WW · "+
    ((G.stats.totalProfit||0)>=0?"+":"")+fmtM(G.stats.totalProfit||0)+" career profit · "+(G.stats.hits||0)+"/"+(G.stats.flops||0)+" hits/flops · "+
    awards+" awards"+(G.stats.bestFilm?" · best: “"+esc(G.stats.bestFilm)+"” "+fmtG(G.stats.bestOpen||0):"")+".</div></div>";
  return h;
}

/* ═══════════ VIEW: develop ═══════════ */
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
let SCRIPT_GENRE_FILTER = "all";
let DASHBOARD_SUB = "overview";
let STUDIO_SUB = "lot";
let DEVELOP_SUB = "scripts";   // v28.9: Develop sub-tab state
let BOXOFFICE_SUB = "chart";
let OTT_SUB = "home";          // v28.9 §15: streamer sub-tab state
let LIBRARY_SUB = "films";
let GAMES_SUB = "dev";

/* ═══════════ Central Pixel Art Icons for Subtabs ═══════════ */
const SUBTAB_PIXEL_ICONS = {
  // dashboard
  "dashboard:overview": "assets/itch-ui/icons/Icon_08.png",
  "dashboard:actions": "assets/bos2-icons/general/film-clapper.png",
  "dashboard:slate": "assets/bos2-icons/general/icons8-movie-ticket-100.png",
  "dashboard:macro": "assets/itch-ui/icons/Icon_01.png",
  // studio
  "studio:lot": "assets/2d/studio_gate.png",
  "studio:csuite": "assets/itch-ui/icons/Icon_11.png",
  "studio:board": "assets/itch-ui/icons/Icon_04.png",
  "studio:operations": "assets/itch-ui/icons/Icon_05.png",
  "studio:crisis": "assets/itch-ui/icons/Icon_10.png",
  "studio:heritage": "assets/itch-ui/icons/Icon_12.png",
  "studio:achievements": "assets/itch-ui/icons/Icon_09.png",
  "studio:sandbox": "assets/pixel-characters/char-robot.png",
  // develop
  "develop:scripts": "assets/bos2-icons/general/writer.png",
  "develop:demographics": "assets/bos2-icons/general/icons8-audience-100.png",
  "develop:creativity": "assets/2d/char_cameraman.png",
  "develop:ip": "assets/bos2-icons/logos/icons8-diamond-100.png",
  "develop:talent": "assets/bos2-icons/general/group.png",
  "develop:combos": "assets/itch-ui/icons/Icon_03.png",
  "develop:tax": "assets/bos2-icons/general/icons8-map-marker-90.png",
  "develop:packaging": "assets/bos2-icons/general/film-clapper.png",
  "develop:contracts": "assets/itch-ui/icons/Icon_04.png",
  "develop:agency": "assets/2d/char_star_actor.png",
  "develop:radar": "assets/itch-ui/icons/Icon_06.png",
  // productions
  "productions:all": "assets/bos2-icons/general/film-clapper.png",
  "productions:pre": "assets/itch-ui/icons/Icon_04.png",
  "productions:shoot": "assets/2d/char_director.png",
  "productions:post": "assets/2d/post_suite.png",
  "productions:ready": "assets/bos2-icons/general/icons8-movie-ticket-100.png",
  "productions:dated": "assets/bos2-icons/general/icons8-new-ticket-100.png",
  // boxoffice
  "boxoffice:chart": "assets/bos2-icons/general/icons8-ticket-100.png",
  "boxoffice:chains": "assets/2d/cinema_theater.png",
  "boxoffice:territories": "assets/bos2-icons/logos/icons8-biometric-passport-100.png",
  "boxoffice:awards": "assets/itch-ui/icons/Icon_12.png",
  "boxoffice:clash": "assets/itch-ui/icons/Icon_06.png",
  // fans
  "fans:all": "assets/pixel-characters/char-female-cheer.png",
  "fans:mail": "assets/itch-ui/icons/Icon_04.png",
  "fans:trending": "assets/bos2-icons/general/beat.png",
  "fans:viral": "assets/bos2-icons/logos/icons8-starburst-shape-100.png",
  // ott
  "ott:home": "assets/2d/virtual_led.png",
  "ott:originals": "assets/bos2-icons/logos/icons8-queen-crown-100.png",
  "ott:deals": "assets/itch-ui/icons/Icon_07.png",
  "ott:sports": "assets/bos2-icons/general/icons8-running-100.png",
  "ott:market": "assets/bos2-icons/logos/icons8-prism-96.png",
  // live
  "live:linear": "assets/2d/backlot.png",
  "live:stream": "assets/2d/char_cameraman.png",
  "live:events": "assets/bos2-icons/general/icons8-red-carpet-100.png",
  "live:studio": "assets/2d/soundstage.png",
  // library
  "library:films": "assets/bos2-icons/general/film-clapper.png",
  "library:series": "assets/2d/virtual_led.png",
  "library:physical": "assets/itch-ui/icons/Icon_02.png",
  "library:vault": "assets/itch-ui/icons/Icon_08.png",
  // empire
  "empire:home": "assets/2d/executive.png",
  "empire:franchises": "assets/bos2-icons/logos/icons8-queen-crown-100.png",
  "empire:universes": "assets/bos2-icons/logos/icons8-starburst-shape-100.png",
  "empire:divisions": "assets/itch-ui/icons/Icon_02.png",
  "empire:endgame": "assets/bos2-icons/logos/icons8-prism-96.png",
  // games
  "games:dev": "assets/pixel-characters/char-robot.png",
  "games:released": "assets/itch-ui/icons/Icon_09.png",
  "games:hardware": "assets/bos2-icons/logos/icons8-edge-level-96.png",
  "games:greenlight": "assets/bos2-icons/general/film-clapper.png",
  // finance
  "finance:pnl": "assets/itch-ui/icons/Icon_01.png",
  "finance:bonds": "assets/itch-ui/icons/Icon_04.png",
  "finance:dynasty": "assets/bos2-icons/logos/icons8-queen-crown-100.png",
  "finance:ipo": "assets/bos2-icons/general/film-clapper.png",
  "finance:ma": "assets/itch-ui/icons/Icon_08.png",
  // lot
  "lot:campus": "assets/2d/studio_gate.png",
  "lot:stage": "assets/2d/soundstage.png",
  "lot:writers": "assets/2d/writers_bungalow.png",
  "lot:post": "assets/2d/post_suite.png",
  "lot:cinema": "assets/2d/cinema_theater.png",
  "lot:executive": "assets/2d/executive.png",
  // cast
  "cast:all": "assets/bos2-icons/general/group.png",
  "cast:stars": "assets/itch-ui/icons/Icon_09.png",
  "cast:animals": "assets/bos2-icons/general/icons8-cat-footprint-100.png",
  "cast:unlock": "assets/itch-ui/icons/Icon_07.png",
  // wizard
  "wizard:writer": "assets/bos2-icons/general/writer.png",
  "wizard:director": "assets/2d/char_director.png",
  "wizard:actor": "assets/bos2-icons/general/group.png",
  "wizard:producer": "assets/bos2-icons/general/film-clapper.png",
  "wizard:stars": "assets/itch-ui/icons/Icon_09.png",
  "wizard:animals": "assets/bos2-icons/general/icons8-cat-footprint-100.png",
  "wizard:unlock": "assets/itch-ui/icons/Icon_07.png"
};

function getSubTabPixelIcon(tab, key){
  return SUBTAB_PIXEL_ICONS[tab + ":" + key] || SUBTAB_PIXEL_ICONS[key] || "";
}

/* ═══════════ Mobile sub-tab strip renderer ═══════════ */
/* Renders the horizontal sub-tab bar (#subTabs) based on the active tab.
   Called from bindView() so it stays in sync with TAB and sub-tab state. */
/* v31: data-driven — TAB_META (v31-features.js) is the single source of truth;
   adding a section's sub-tabs is one entry there, not another branch here. */
function renderSubTabs(){
  const bar = $("#subTabs");
  if(!bar) return;
  // These screens own a single branded navigation, shared across all viewports.
  // v34.6: fans joined them — its mailroom filter row is the only sub-nav now
  // (the strip's Mail/Trending/Viral chips wrote values the filter never read).
  if(TAB === "dashboard" || TAB === "studio" || TAB === "develop" || TAB === "boxoffice" || TAB === "fans" || TAB === "ott" || TAB === "live" || TAB === "empire"){
    bar.innerHTML = ""; bar.style.display = "none"; return;
  }
  const meta = (typeof TAB_META !== "undefined" && TAB_META) ? TAB_META[TAB] : null;
  if(!meta || !meta.length){ bar.innerHTML = ""; bar.style.display = "none"; return; }
  const attr = TAB_SUB_ATTR[TAB] || "data-sub";
  const ghost = TAB_SUB_GHOST[TAB] ? "btn-ghost" : "btn-alt";
  const activeKey = (TAB_SUB_ACTIVE[TAB] ? TAB_SUB_ACTIVE[TAB]() : (TAB_SUB_DEFAULT[TAB] || meta[0][0]));
  bar.innerHTML = meta.map(([key, label]) => {
    const ico = getSubTabPixelIcon(TAB, key);
    const icoHtml = ico ? "<img class='subtab-pixel-icon' src='"+ico+"' alt='' />" : "";
    return "<button class='btn btn-sm subtab-btn "+(key===activeKey ? "btn-primary active" : ghost)+"' "+attr+"='"+key+"'>"+icoHtml+"<span>"+label+"</span></button>";
  }).join("");
  bar.style.display = "flex";
}
/* ═══════════ VIEW: develop — the Story Department command deck ═══════════
   Seven sections share one landscape-first workspace. Every figure below is
   read from the live career; nothing is invented for the interface. */
const DEVELOP_SECTIONS = [
  ["scripts", "Scripts"],
  ["demographics", "Audience lab"],
  ["creativity", "Craft & vault"],
  ["ip", "Rights market"],
  ["talent", "Talent desk"],
  ["combos", "Combos codex"],
  ["tax", "Locations & partners"]
];
let DEVELOP_COMBO_FILTER = "all";

function developHeat(g){
  try{ return +trendOf(g) || 1; }catch(e){ return 1; }
}
function developMarketRows(){
  let rows=[];
  try{
    rows=Object.keys(DATA.GENRES).map(g=>({ g, heat:developHeat(g), delta:genreDelta(g), rec:genreRecent(g), comp:genreComp(g) }));
  }catch(e){ rows=[]; }
  return rows.sort((a,b)=>b.heat-a.heat);
}
function developWeekBadge(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  return `<div class="command-date"><span>WEEK</span><b>${String(w).padStart(2,"0")}</b><small>${esc(m.month)}</small></div>`;
}
function developHead(eyebrow,title,description){
  return `<header class="command-heading"><div><span class="command-edition">STORY DEPARTMENT / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${developWeekBadge()}</header>`;
}
function developPanel(eyebrow,title,description,content,action){
  return `<section class="develop-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">${eyebrow}</span><h2>${title}</h2>${description?`<p>${description}</p>`:""}</div>${action||""}</div>${content}</section>`;
}
/* A single numbered section switcher replaces the pixel-icon pill strip and
   the duplicated mobile sub-tab bar. */
function commandDevelopNav(){
  const active = DEVELOP_SECTIONS.some(s=>s[0]===DEVELOP_SUB) ? DEVELOP_SUB : "scripts";
  return `<nav class="command-section-nav command-develop-nav" aria-label="Story department sections">
    <div class="command-nav-brand"><span>STORY DEPARTMENT</span><small>WRITE / RIGHTS / CAST / SHOOT</small></div>
    <div class="command-nav-items">${DEVELOP_SECTIONS.map(([key,label],i)=>`<button data-devsub="${key}" class="${active===key?"active":""}" aria-current="${active===key?"page":"false"}"><small>0${i+1}</small><span>${label}</span></button>`).join("")}</div>
    <div class="command-nav-tools" role="group" aria-label="Story department tools"><span class="command-nav-tools-label">TOOLS</span><button id="btnOpenAgencyPackaging" aria-label="Agency packaging desk"><small>TOOL / TALENT</small><span>Agency packaging</span></button><button id="btnOpenContracts" aria-label="Picture partners and multi-picture contracts"><small>TOOL / CONTRACTS</small><span>Picture partners</span></button><button id="btnOpenTalentAgency" aria-label="Talent agency ownership"><small>TOOL / AGENCY</small><span>Talent agency</span></button></div>
  </nav>`;
}

function viewDevelop(){
  if(!DEVELOP_SECTIONS.some(s=>s[0]===DEVELOP_SUB)) DEVELOP_SUB="scripts";
  if(DEVELOP_SUB==="demographics") return commandDevelopAudience();
  if(DEVELOP_SUB==="creativity") return commandDevelopCraft();
  if(DEVELOP_SUB==="ip") return commandDevelopRights();
  if(DEVELOP_SUB==="talent") return commandDevelopTalent();
  if(DEVELOP_SUB==="combos") return commandDevelopCombos();
  if(DEVELOP_SUB==="tax") return commandDevelopLocations();
  return commandDevelopScripts();
}

/* ── 01 / Scripts ─────────────────────────────────────────────────────── */
function developScriptCard(i){
  const S=DATA.SCALES?DATA.SCALES[i.scale]:null, G0=DATA.GENRES[i.genre];
  const heat=developHeat(i.genre);
  const tl=(typeof trendLabel==="function")?trendLabel(i.genre):{tag:"",cls:""};
  let budget=0, dev=0;
  try{ budget=neededBudget(i.genre,i.scale); }catch(e){}
  try{ dev=devCostOf(i); }catch(e){}
  const timing = heat>=1.07 ? "HOT TIMING" : heat<=0.94 ? "COLD CYCLE" : "STEADY";
  return `<article class="develop-script">
    <header><span>${G0?G0.emoji+" "+esc(G0.name):esc(i.genre)}</span><b>${S?esc(S.name):esc(i.scale)}</b></header>
    <h3>${esc(i.title)}</h3>
    <p class="develop-script-blurb">“${esc(i.blurb)}”</p>
    <div class="develop-script-flags">${i.hot?'<span class="flag-hot">HOT SPEC</span>':""}${i.awareness?'<span class="flag-ip">KNOWN IP</span>':""}${i.crossover?'<span class="flag-crossover">CROSSOVER</span>':""}<span class="flag-timing ${heat>=1.07?"hot":heat<=0.94?"cold":""}">${timing}</span></div>
    <dl class="develop-script-stats"><div><dt>Script</dt><dd>${i.script}</dd></div><div><dt>Trend</dt><dd>${heat.toFixed(2)}×</dd></div><div><dt>Budget</dt><dd>${fmtM(budget)}</dd></div><div><dt>Dev rights</dt><dd>${fmtM(dev)}</dd></div></dl>
    ${i.pitch?`<p class="develop-script-pitch">Pitched ${i.pitch.score} · ${esc(i.pitch.verdict)}</p>`:""}
    <footer><button class="develop-ghost" data-pitch="${i.id}">Pitch</button><button class="develop-action" data-dev="${i.id}">Develop this film</button></footer>
  </article>`;
}
function developGenreFilterBar(){
  return `<div class="develop-filters" role="group" aria-label="Filter scripts by genre"><button data-filter-genre="all" class="${SCRIPT_GENRE_FILTER==="all"?"active":""}" aria-pressed="${SCRIPT_GENRE_FILTER==="all"}">All genres</button>${Object.keys(DATA.GENRES).map(gk=>`<button data-filter-genre="${gk}" class="${SCRIPT_GENRE_FILTER===gk?"active":""}" aria-pressed="${SCRIPT_GENRE_FILTER===gk}">${esc(DATA.GENRES[gk].name)}</button>`).join("")}</div>`;
}
function developSnapshot(){
  const rows=developMarketRows();
  const hot=rows.filter(r=>r.heat>=1.07).slice(0,3);
  const cold=rows.filter(r=>r.heat<=0.94).slice(-2).reverse();
  const season=DATA.seasonOf(woyOf(G.week));
  const top=rows[0], low=rows[rows.length-1];
  return `<section class="develop-snapshot">
    <header><span class="command-eyebrow">MARKET SNAPSHOT</span><h2>What the town is buying</h2><p>${esc(season.month)} corridor ×${season.season.toFixed(2)}${season.holiday?" · holiday legs":""}</p></header>
    ${hot.length?hot.map(r=>`<div class="develop-snapshot-row"><span>${DATA.GENRES[r.g].emoji} ${esc(DATA.GENRES[r.g].name)}</span><i><b style="width:${clamp((r.heat-0.78)/(1.28-0.78)*100,4,100)}%"></b></i><strong>${r.heat.toFixed(2)}×</strong></div>`).join(""):`<div class="develop-snapshot-empty">No genre is running above 1.07× this week.</div>`}
    <div class="develop-snapshot-divider"><span>COOLING</span></div>
    ${cold.length?cold.map(r=>`<div class="develop-snapshot-row cold"><span>${DATA.GENRES[r.g].emoji} ${esc(DATA.GENRES[r.g].name)}</span><i><b style="width:${clamp((r.heat-0.78)/(1.28-0.78)*100,4,100)}%"></b></i><strong>${r.heat.toFixed(2)}×</strong></div>`).join(""):`<div class="develop-snapshot-empty">Nothing is under 0.94× right now.</div>`}
    <footer><small>Hottest ${top?esc(DATA.GENRES[top.g].name):"—"} · coldest ${low?esc(DATA.GENRES[low.g].name):"—"}</small><button class="develop-link" onclick="document.getElementById('developTrends')?.scrollIntoView({block:'start'})">Genre board ↓</button></footer>
  </section>`;
}
function developRightsRail(){
  const items=(G.ipMarket||[]).slice(0,4);
  const body=items.length? `<div class="develop-rights">${items.map(it=>{
    const kind=(it.kind==="legacy")?"Legacy franchise":(it.kind==="custom")?"Your own IP":((DATA.IPKINDS&&DATA.IPKINDS.find(x=>x.id===it.kind))||{}).name||it.kind;
    return `<article><header><span>${esc(kind)}</span><b>${fmtM(it.price)}</b></header><h3>${esc(it.title)}</h3><p>${DATA.GENRES[it.genre]?esc(DATA.GENRES[it.genre].name):esc(it.genre)} · script +${it.boost} · awareness +${Math.round(it.buzz*100)}%</p><button class="develop-action" data-ip="${it.id}">Buy rights</button></article>`;
  }).join("")}</div>` : `<div class="command-empty"><b>No rights listed this week.</b><small>The literary market rotates every week. Check back after the next advance.</small></div>`;
  return developPanel("ON THE DESK","Rights you could own","Adapt a book, a classic, or your own catalogue instead of starting from a blank page.",body,`<button class="develop-ghost" data-devsub="ip">Full rights market ↗</button>`);
}
function developTrendBoard(){
  const rows=developMarketRows();
  const max=rows.reduce((m,r)=>Math.max(m,r.heat),1.28);
  return `<section class="develop-panel" id="developTrends"><div class="develop-panel-head"><div><span class="command-eyebrow">GENRE HEAT</span><h2>The genre board</h2><p>Heat multiplies opening weekend and streaming appetite. It re-rates every quarter; hits warm a genre, flops cool it.</p></div><span class="develop-stamp">RE-RATES IN ${Math.max(0,(G.trendShiftAt||G.week)-G.week)} WK</span></div>
  <div class="develop-trends">${rows.map(r=>{const G0=DATA.GENRES[r.g];const cls=r.heat>=1.07?"hot":r.heat<=0.94?"cold":"mid";const next=(1+(r.heat-1)*0.72).toFixed(2);return `<div class="develop-trend ${cls}"><span class="develop-trend-name">${G0.emoji} ${esc(G0.name)}</span><i><b style="width:${clamp(r.heat/max*100,4,100)}%"></b></i><span class="develop-trend-value">${r.heat.toFixed(2)}×</span><span class="develop-trend-next">next ~${next}×</span></div>`}).join("")}</div></section>`;
}
function developMarketTable(){
  const rows=developMarketRows();
  return `<section class="develop-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">52-WEEK READ</span><h2>Genre intelligence</h2><p>Your own runs and rival slates, measured against the current corridor.</p></div></div>
  <div class="develop-table-wrap"><table class="develop-table"><thead><tr><th scope="col">Genre</th><th scope="col">Heat</th><th scope="col">Quarter Δ</th><th scope="col">Your runs (52w)</th><th scope="col">Rivals dated (12w)</th><th scope="col">Verdict</th></tr></thead><tbody>${rows.map(r=>{const G0=DATA.GENRES[r.g];const cls=r.heat>=1.07?"good":r.heat<=0.94?"bad":"mid";return `<tr><th scope="row">${G0.emoji} ${esc(G0.name)}</th><td><b class="${cls}">${r.heat.toFixed(2)}×</b></td><td>${r.delta>0?"+":""}${r.delta.toFixed(2)}</td><td>${r.rec.n?`${r.rec.hits} hits · ${r.rec.flops} flops · ${r.rec.n} runs`:"no runs yet"}</td><td>${r.comp.live?r.comp.live+" live · ":""}${r.comp.soon} dated</td><td>${esc(genreOpp(r.g,r.heat,r.delta,r.rec,r.comp))}</td></tr>`}).join("")}</tbody></table></div></section>`;
}
function developSeasonStrip(){
  if(!DATA.seasonOf) return "";
  let cells="";
  for(let w=1;w<=52;w++){
    const s=DATA.seasonOf(w);
    const cls=s.season>=1.15?"hot":s.season<=0.9?"cold":"mid";
    const now=(woyOf(G.week)===w)?" now":"";
    cells+=`<span class="develop-season-cell ${cls}${now}" title="Week ${w} · ${esc(s.month)} · corridor ×${s.season.toFixed(2)}${s.holiday?" (holiday legs)":""}">${w}</span>`;
  }
  return `<section class="develop-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">RELEASE CORRIDOR</span><h2>Where the year is soft</h2><p>Seasonal demand by release week. Tentpoles open best in the gold corridor; platform plays survive the dead zone.</p></div></div><div class="develop-season">${cells}</div><footer class="develop-season-key"><span><i class="hot"></i>Prime ×1.15+</span><span><i class="mid"></i>Neutral</span><span><i class="cold"></i>Dead zone ≤×0.90</span><span class="develop-season-now">This week is outlined</span></footer></section>`;
}
function commandDevelopScripts(){
  const ideas=G.ideas||[];
  const rows=developMarketRows();
  const writers=(typeof freeTalent==="function")?freeTalent("writer").length:0;
  const weeksLeft=Math.max(0,(G.trendShiftAt||G.week)-G.week);
  const filtered=(SCRIPT_GENRE_FILTER==="all")?ideas:ideas.filter(i=>i.genre===SCRIPT_GENRE_FILTER);
  const top=rows[0], hottest=top&&top.heat>=1.07?top:null;
  const inSlate=(G.projects||[]).filter(p=>!p.released).length;
  return `<section class="command-deck command-develop">
    ${developHead("01 / SCRIPTS","Put a story into development.",`${esc(G.studio.name)} · ${inSlate} project(s) in the slate · ${ideas.length} draft(s) on the desk`)}
    <div class="command-telemetry">${commandMetric("DRAFTS ON THE DESK",ideas.length,"Specs ready to develop")}${commandMetric("WRITERS AVAILABLE",writers,"Free to take an assignment")}${commandMetric("HOTTEST GENRE",hottest?`${esc(DATA.GENRES[hottest.g].name)} · ${hottest.heat.toFixed(2)}×`:"No genre above 1.07×",hottest?"Develop into the heat":"Wait for a warmer cycle")}${commandMetric("MARKET RE-RATES",weeksLeft+" wk"+(weeksLeft===1?"":"s"),"Heat rotates every quarter")}</div>
    <div class="develop-lead">
      <section class="develop-brief">
        <span class="command-eyebrow">YOUR NEXT GREENLIGHT</span>
        <h2>${hottest?`${esc(DATA.GENRES[hottest.g].name)} is running at ${hottest.heat.toFixed(2)}×.`:`The market is flat this week.`}</h2>
        <p>${ideas.length?`Pick a spec, pitch it to the board, or greenlight it straight into development. A writer adds up to +11 to the script; a director shapes the tone.`:`Your desk is empty. Pitch a new film or buy rights to refill the development slate.`}</p>
        <div class="develop-brief-actions"><button class="develop-action" id="btnPitchFilm">Pitch a film <span>↗</span></button><button class="develop-ghost" id="btnPitchSeries">Pitch a series</button></div>
        <footer><span>ON THE DESK</span><b>${ideas.length} draft(s) · ${writers} writer(s) free</b><small>${filtered.length} matches your genre filter · ${inSlate} project(s) already in the slate</small></footer>
      </section>
      ${developSnapshot()}
    </div>
    <nav class="develop-tools" aria-label="Development tools">
      <button id="btnAIPitch"><small>SYNTH SCRIBE</small><span>AI pitch</span></button>
      <button id="btnStarSign"><small>CASTING</small><span>Create a superstar</span></button>
      <button id="btnCustomCreator"><small>WORLD BUILDING</small><span>Custom creator</span></button>
      <button id="btnBowShorts"><small>SHORT FORM</small><span>BOW Shorts</span></button>
      <button id="btnFestivalPr"><small>PUBLICITY</small><span>Festivals &amp; PR</span></button>
      <button id="btnClashAnalytics"><small>RELEASE PLANNING</small><span>Clash radar</span></button>
    </nav>
    <section class="develop-panel">
      <div class="develop-panel-head"><div><span class="command-eyebrow">SCRIPT MARKET</span><h2>Specs on the desk</h2><p>Each draft carries its own script score, scale, and dev price. Trend timing is checked against the live market.</p></div><span class="develop-stamp">${filtered.length} / ${ideas.length} SHOWN</span></div>
      ${developGenreFilterBar()}
      ${filtered.length?`<div class="develop-scripts">${filtered.map(developScriptCard).join("")}</div>`:`<div class="command-empty"><b>No specs match this filter.</b><small>Reset the filter, or pitch a new film to put something back on the desk.</small><button class="develop-ghost" onclick="SCRIPT_GENRE_FILTER='all';render();">Show all genres</button></div>`}
    </section>
    ${developRightsRail()}
    ${developTrendBoard()}
    ${developMarketTable()}
    ${developSeasonStrip()}
  </section>`;
}

/* ── 02 / Audience lab ────────────────────────────────────────────────── */
function commandDevelopAudience(){
  try{ if(typeof DemographicsEngine!=="undefined"&&typeof DemographicsEngine.initDemographics==="function") DemographicsEngine.initDemographics(G); }catch(e){}
  const last=(G.demographicEngine&&G.demographicEngine.lastScreeningResult)||null;
  const quadrants=(typeof DemographicsEngine!=="undefined"&&DemographicsEngine.AUDIENCE_QUADRANTS)||[];
  const active=(G.projects||[]).filter(p=>!p.released);
  const best=quadrants.length&&last?quadrants.map(q=>({q,score:last.appeal[q.id]||0})).sort((a,b)=>b.score-a.score)[0]:null;
  const quadCards=quadrants.length?quadrants.map(q=>{
    const score=last?(last.appeal[q.id]||0):null;
    const cls=score==null?"unscored":score>=70?"good":score>=45?"mid":"bad";
    return `<article class="develop-quadrant ${cls}"><header><b>${esc(q.name)}</b><strong>${score==null?"—":score+"%"}</strong></header><i><b style="width:${score==null?0:clamp(score,0,100)}%"></b></i><p>${esc(q.desc||"")}</p></article>`;
  }).join(""):`<div class="command-empty"><b>Audience model unavailable.</b><small>The demographics engine did not load.</small></div>`;
  const dial=(last&&last.dialData&&last.dialData.length)?`<div class="develop-dial">${last.dialData.map(d=>`<div><b>${d.score}%</b><i style="height:${clamp(d.score,10,100)}%"></i><small>${esc(String(d.timestamp).split(" ")[0])}</small></div>`).join("")}</div>`:`<div class="command-empty"><b>No dial curve on file.</b><small>Run a screening to plot the minute-by-minute focus-group reaction.</small></div>`;
  return `<section class="command-deck command-develop">
    ${developHead("02 / AUDIENCE LAB","Test the film before the public does.",`Focus-group your active slate across four audience quadrants, then send in a script doctor if the third act sags.`)}
    <div class="command-telemetry">${commandMetric("LAST SCREENED",last?esc(last.projectTitle):"None yet",last?"Most recent dial test":"Run your first test below")}${commandMetric("CRITICS SCORE",last?last.criticsScore+"%":"—",last&&last.certifiedFresh?"Certified fresh":"Awaiting a screening")}${commandMetric("AUDIENCE SCORE",last?last.audienceScore+"%":"—","Popcornmeter estimate")}${commandMetric("STRONGEST QUADRANT",best?esc(best.q.name):"—",best?best.score+"% affinity":"No dial data")}</div>
    <div class="develop-lead">
      <section class="develop-brief">
        <span class="command-eyebrow">THE RESEARCH DESK</span>
        <h2>${active.length?`${active.length} project(s) can be dial-tested.`:`Nothing to test yet.`}</h2>
        <p>${active.length?"A dial test costs $0.35M per project. You get a critics and audience estimate, four quadrant scores, and the minute the room disengages.":"Greenlight a film first. Dial tests only run on unreleased projects in the slate."}</p>
        <div class="develop-brief-actions"><button class="develop-action" id="btnOpenDemographicsModal" ${active.length?"":"disabled"}>Open the research desk <span>↗</span></button></div>
        <footer><span>WHAT IT COSTS</span><b>$0.35M per screening</b><small>Tests, comparisons, and script doctors all sit behind this desk.</small></footer>
      </section>
      <section class="develop-panel develop-inline-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">LATEST RESULT</span><h2>${last?esc(last.projectTitle):"No screening on file"}</h2><p>${last?"Four quadrants, measured on your actual project.":"Every dial test you run is recorded here until the next one."}</p></div></div><div class="develop-quadrants">${quadCards}</div></section>
    </div>
    ${developPanel("MINUTE BY MINUTE","Focus-group dial curve",last?"Where the room leaned in, and where it drifted.":"Run a screening to build the curve.","<div class=\"develop-dial-wrap\">"+dial+"</div>")}
    ${developPanel("HOW THE DESK WORKS","Three calls you can make","",`<div class="develop-steps"><article><small>01</small><h3>Dial-test a cut</h3><p>Spend $0.35M on an unreleased project. Quadrant affinity is checked against its genre, cast, and quality.</p></article><article><small>02</small><h3>Read the room</h3><p>Critics and audience estimates flag whether the film is landing before you commit marketing money.</p></article><article><small>03</small><h3>Hire a script doctor</h3><p>Third-act pacing problems can be fixed on an active project from the research desk.</p></article></div>`)}
  </section>`;
}

/* ── 03 / Craft & vault ───────────────────────────────────────────────── */
function commandDevelopCraft(){
  try{ if(typeof ProductionCreativity!=="undefined"&&typeof ProductionCreativity.initProductionCreativity==="function") ProductionCreativity.initProductionCreativity(G); }catch(e){}
  const suite=G.productionSuite||{};
  const level=suite.writersRoomLevel||1;
  const staff=suite.writersRoomHired||level*2;
  const sparks=(suite.directorSparksHistory||[]).length;
  const remakes=(suite.remakeVaultHistory||[]).length;
  const formats=(typeof ProductionCreativity!=="undefined"&&ProductionCreativity.CAMERA_LENS_FORMATS)||[];
  const projects=(G.projects||[]).filter(p=>!p.released);
  const upgradeCost=level*1.5;
  const lensCards=formats.map(f=>`<article class="develop-lens"><header><b>${esc(f.name)}</b><span>${fmtM(f.costM)}</span></header><p>${esc(f.desc)}</p><footer><span>+${f.craftBonus} quality</span>${f.prestigeBonus?`<span>+${f.prestigeBonus} prestige</span>`:""}${f.speedBonusPct?`<span>+${Math.round(f.speedBonusPct*100)}% schedule</span>`:""}${f.indieBonus?`<span>+${f.indieBonus} indie</span>`:""}</footer></article>`).join("");
  const projectRows=projects.length?projects.map(p=>{
    const pid=esc(p.id!=null?p.id:p.title);
    return `<div class="develop-fit"><div><small>${esc((p.genre||"film").toUpperCase())} / ${esc(p.phase||"development")}</small><b>${esc(p.title)}</b><span>${p.cameraFormatName?esc(p.cameraFormatName):"No lens rig fitted"}</span></div><select data-lens-for="${pid}" aria-label="Lens format for ${esc(p.title)}">${formats.map(f=>`<option value="${f.id}"${p.cameraFormat===f.id?" selected":""}>${esc(f.name)} · ${fmtM(f.costM)}</option>`).join("")}</select><button class="develop-action" data-fit-lens="${pid}">Fit lens</button><button class="develop-ghost" data-spark-lens="${pid}">Auteur spark</button></div>`;
  }).join(""):`<div class="command-empty"><b>No active project to fit.</b><small>Lens rigs and auteur sparks attach to films already in your slate.</small></div>`;
  return `<section class="command-deck command-develop">
    ${developHead("03 / CRAFT &amp; VAULT","Give the film a look, and the room a voice.",`Lens formats, the permanent writers room, and the classics you can remake.`)}
    <div class="command-telemetry">${commandMetric("WRITERS ROOM","Tier "+level,level>=5?"Maximum capacity":`Next tier ${fmtM(upgradeCost)}`)}${commandMetric("STAFF WRITERS",staff,"Permanent contract staff")}${commandMetric("AUTEUR SPARKS",sparks,"Logged creative detours")}${commandMetric("CLASSICS REMADE",remakes,"From your released catalogue")}</div>
    <div class="develop-lead">
      <section class="develop-brief">
        <span class="command-eyebrow">THE WRITERS ROOM</span>
        <h2>${level>=5?"Tier 5 · full quorum.":`Tier ${level} · room for ${staff} writers.`}</h2>
        <p>Each tier keeps two more screenwriters on contract, generating spec work between productions. Expansion costs $1.5M per tier and tops out at Tier 5.</p>
        <div class="develop-brief-actions">${level>=5?`<button class="develop-ghost" disabled>Maximum tier reached</button>`:`<button class="develop-action" id="btnExpandWritersRoom">Expand the room — ${fmtM(upgradeCost)}</button>`}<button class="develop-ghost" id="btnOpenRemakeVaultModal">Open the remake vault</button></div>
        <footer><span>VAULT</span><b>${remakes} classic(s) remade</b><small>Remakes inherit nostalgia awareness from the original release.</small></footer>
      </section>
      <section class="develop-panel develop-inline-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">LENS LIBRARY</span><h2>Camera &amp; format</h2><p>Fitted per project in the panel below. Quality bonuses are applied to the film immediately.</p></div></div><div class="develop-lenses">${lensCards||'<div class="command-empty"><b>No lens formats available.</b><small>The creativity suite did not load.</small></div>'}</div></section>
    </div>
    ${developPanel("FIT TO A PROJECT","Lens rigs and auteur sparks","Fitting a lens debits the format cost and raises the film's quality. An auteur spark is a random on-set detour: real cash for real quality.",`<div class="develop-fits">${projectRows}</div>`)}
  </section>`;
}

/* ── 04 / Rights market ───────────────────────────────────────────────── */
function commandDevelopRights(){
  const items=G.ipMarket||[];
  const franchises=(G.franchises||[]).length;
  const prices=items.map(i=>i.price);
  const cheapest=prices.length?Math.min.apply(null,prices):0;
  const boosts=items.map(i=>i.boost);
  const bestBoost=boosts.length?Math.max.apply(null,boosts):0;
  const cards=items.map(it=>{
    const kind=(it.kind==="legacy")?{emoji:"🌍",name:"Legacy franchise — a proven fanbase"}:it.kind==="custom"?{emoji:"✨",name:"Custom IP — created in your sandbox"}:((DATA.IPKINDS&&DATA.IPKINDS.find(x=>x.id===it.kind))||{emoji:"📚",name:it.kind});
    const affordable=G.studio.cash>=it.price;
    return `<article class="develop-right${it.kind==="legacy"?" legacy":""}"><header><span>${kind.emoji} ${esc(kind.name)}</span><b>${fmtM(it.price)}</b></header><h3>${esc(it.title)}</h3><div class="develop-right-meta"><span>${DATA.GENRES[it.genre]?DATA.GENRES[it.genre].emoji+" "+esc(DATA.GENRES[it.genre].name):esc(it.genre)}</span><span>Script +${it.boost}</span><span>Awareness +${Math.round(it.buzz*100)}%</span></div><footer><small>${affordable?"Cash on hand covers this":"Short "+fmtM(it.price-G.studio.cash)+" of the asking price"}</small><button class="develop-action" data-ip="${it.id}" ${affordable?"":"disabled"}>${it.kind==="legacy"?"Buy franchise rights":"Buy rights"}</button></footer></article>`;
  }).join("");
  return `<section class="command-deck command-develop">
    ${developHead("04 / RIGHTS MARKET","Own the story before someone else does.",`Public-domain classics, bestsellers, and franchise rights on the block this week.`)}
    <div class="command-telemetry">${commandMetric("LISTINGS THIS WEEK",items.length,"Rotates every advance")}${commandMetric("CHEAPEST RIGHTS",items.length?fmtM(cheapest):"—","Entry price on the board")}${commandMetric("BEST SCRIPT BOOST",items.length?"+"+bestBoost:"—","Applied to the adaptation")}${commandMetric("FRANCHISES OWNED",franchises,"In your stable")}</div>
    <div class="develop-lead">
      <section class="develop-brief"><span class="command-eyebrow">HOW RIGHTS WORK</span><h2>Buy once, adapt at will.</h2><p>A regular rights purchase drops a ready-made idea on your desk with the book's title, genre, and awareness. A legacy or custom franchise purchase goes straight into your franchise stable instead — check Empire for the entries.</p><footer><span>YOUR CASH</span><b>${fmtM(G.studio.cash)}</b><small>Rights are paid from development spend.</small></footer></section>
      <section class="develop-panel develop-inline-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">THE SHELF</span><h2>${items.length} title(s) on offer</h2><p>${items.length?"Prices and awareness change when the market refreshes.":"The market is empty right now."}</p></div></div>${items.length?`<div class="develop-rights compact">${cards}</div>`:`<div class="command-empty"><b>No rights this week.</b><small>Advance a week — the literary market restocks.</small></div>`}</section>
    </div>
    <p class="develop-note">Every purchase is logged to your development ledger and saved immediately. Existing saves keep their owned rights.</p>
  </section>`;
}

/* ── 05 / Talent desk ─────────────────────────────────────────────────── */
function commandDevelopTalent(){
  const watch=(G.watchlist||[]).map(id=>(G.talent||[]).find(t=>t.id===id)).filter(Boolean);
  const deals=(G.talent||[]).filter(t=>t.multiDeal);
  const freeA=(typeof freeTalent==="function")?freeTalent("actor"):[];
  const freeD=(typeof freeTalent==="function")?freeTalent("director"):[];
  const freeW=(typeof freeTalent==="function")?freeTalent("writer"):[];
  const freeP=(typeof freeTalent==="function")?freeTalent("producer"):[];
  freeA.sort((a,b)=>b.power-a.power||b.skill-a.skill);
  freeD.sort((a,b)=>b.power-a.power||b.skill-a.skill);
  freeW.sort((a,b)=>b.skill-a.skill||b.power-a.power);
  freeP.sort((a,b)=>b.skill-a.skill||b.power-a.power);
  const agencies=(DATA.AGENCIES||[]).map(ag=>{
    const roster=(typeof agencyRoster==="function"?agencyRoster(ag.id):[]).filter(t=>!t.bookedUntil);
    const power=roster.reduce((a,t)=>a+t.power,0);
    const excl=G.agencyDeals&&G.agencyDeals[ag.id]>G.week;
    return `<article class="develop-agency"><header><b>${esc(ag.name)}</b>${excl?`<span class="develop-badge on">EXCLUSIVE · ${G.agencyDeals[ag.id]-G.week} WK</span>`:`<span class="develop-badge">${fmtM(ag.dealCost)}</span>`}</header><p>${esc(ag.blurb)}</p><dl><div><dt>Free clients</dt><dd>${roster.length}</dd></div><div><dt>Combined power</dt><dd>${power}★</dd></div><div><dt>Client discount</dt><dd>−${Math.round(ag.disc*100)}%</dd></div><div><dt>Packaging fee</dt><dd>${Math.round((ag.packFee||0)*100)}%</dd></div></dl>${excl?`<footer><span>First-look in force${G.agencyExcl>G.week?" · town truce covers the rest":""}</span></footer>`:`<footer><span>${G.agencyExcl>G.week?"Town truce already covers this roster":`${Math.round(ag.dealWeeks/52)}-year exclusive`}</span><button class="develop-action" data-agdeal="${ag.id}">Sign exclusive — ${fmtM(ag.dealCost)}</button></footer>`}</article>`;
  }).join("");
  const crewRoles=[["dp","Cinematographer","Audience +skill/25 on every film"],["composer","Composer","Critics +skill/22 · Oscar trait +2"],["vfx","VFX house","Audience +skill/30 on spectacle · overruns −8%"]];
  let crew="";
  if(typeof btlSeedIfMissing==="function"){
    btlSeedIfMissing();
    crew=crewRoles.map(([role,name,eff])=>{
      const cur=G.btl?G.btl[role]:null;
      if(cur){
        return `<article class="develop-crew filled"><header><span>${esc(name)}</span><b>${esc(cur.name)}</b></header><p>${esc(cur.trait)} · skill ${cur.skill} · ${fmtM(cur.salary)}/wk</p><div class="develop-crew-meta"><span>LEVEL ${levelOf(cur)}</span><span>EFFECT ×${lvlMult(cur).toFixed(2)}</span><span>${cur.xp||0} SHIPPED</span></div><small>${esc(eff)}</small><footer><button class="develop-ghost" data-btlfire="${role}">Let go — ${fmtM(cur.salary*8)} severance</button></footer></article>`;
      }
      const market=(G.btlMarket&&G.btlMarket[role])||[];
      return `<article class="develop-crew empty"><header><span>${esc(name)}</span><b>Open slot</b></header><p>${esc(eff)}</p>${market.slice(0,3).map(c=>`<div class="develop-crew-bid"><div><b>${esc(c.name)}</b><small>${esc(c.trait)} · skill ${c.skill}</small></div><button class="develop-action" data-btlhire="${role}:${c.id}">Sign ${fmtM(c.fee)}</button></div>`).join("")||`<small class="develop-muted">No candidates this week.</small>`}</article>`;
    }).join("");
  }
  const watchList=`<div class="develop-watch"><article><header><span>WATCHLIST</span><b>${watch.length}</b></header>${watch.length?watch.map(t=>`<button class="develop-watch-row" onclick="talentModal(${t.id})"><span>${esc(t.name)}</span><small>${stars(t.power)} · ${fmtM(actorFee(t))}</small></button>`).join(""):`<p>Pin talent from any profile to track their quote here.</p>`}</article><article><header><span>MULTI-PICTURE DEALS</span><b>${deals.length}</b></header>${deals.length?deals.map(t=>`<button class="develop-watch-row" onclick="talentModal(${t.id})"><span>${esc(t.name)}</span><small>${t.multiDeal.left} film(s) left · −25%</small></button>`).join(""):`<p>No long-term deals running. Offer one from a talent profile or the picture-partner desk.</p>`}</article></div>`;
  const roster=(title,list,cap)=>list.length?`<section class="develop-roster-block${/^CAST/.test(title)?" cast-block":""}"><div class="develop-roster-head"><span class="command-eyebrow">${title}</span><b>${list.length} AVAILABLE</b></div><div class="develop-roster">${list.slice(0,cap).map(talentCard).join("")}</div></section>`:"";
  return `<section class="command-deck command-develop">
    ${developHead("05 / TALENT DESK","People are the production.",`Negotiate blanket deals, sign exclusives, keep a crew under contract, and work the open market.`)}
    <div class="command-telemetry">${commandMetric("WRITERS FREE",freeW.length,"Ready for assignment")}${commandMetric("DIRECTORS FREE",freeD.length,"Available to attach")}${commandMetric("CAST FREE",freeA.length,"Available for casting")}${commandMetric("DEALS RUNNING",deals.length,"Multi-picture agreements")}</div>
    <section class="develop-deals">
      <article class="develop-deal ${G.wrapDeal>0?"done":""}"><span class="command-eyebrow">TALENT FEES</span><h3>Wrap deal</h3><p>Next three pictures: every talent fee −20%.</p><b>${fmtM(20)}</b>${G.wrapDeal>0?`<footer><span class="develop-badge on">${G.wrapDeal} PICTURE(S) LEFT</span></footer>`:`<footer><button class="develop-action" id="btnWrap">Sign the deal</button></footer>`}</article>
      <article class="develop-deal ${G.agencyExcl>G.week?"done":""}"><span class="command-eyebrow">AGENCY RELATIONS</span><h3>Town-wide truce</h3><p>Two years of −15% on every quote, every agency. Packaging fees pause.</p><b>${fmtM(30)}</b>${G.agencyExcl>G.week?`<footer><span class="develop-badge on">${G.agencyExcl-G.week} WEEKS LEFT</span></footer>`:`<footer><button class="develop-action" id="btnAgency">Sign the truce</button></footer>`}</article>
      <article class="develop-deal"><span class="command-eyebrow">CASTING</span><h3>Superstar cameo</h3><p>While greenlighting, add a cameo for 30% of the star's fee: +6% buzz.</p><b>30%</b><footer><span class="develop-badge">OFFERED IN THE WIZARD</span></footer></article>
    </section>
    ${watchList}
    ${developPanel("AGENCY ROWS","The three houses",`Package two clients of the same agency in one film and they bill a packaging fee. An exclusive waives it and cuts their clients' quotes.`,agencies?`<div class="develop-agencies">${agencies}</div>`:`<div class="command-empty"><b>No agencies loaded.</b><small>The talent market did not initialise.</small></div>`)}
    ${developPanel("STUDIO-WIDE HIRES","Below-the-line crew",`Hired on a weekly retainer. Each one lifts every film you greenlight.`,crew?`<div class="develop-crew-grid">${crew}</div>`:`<div class="command-empty"><b>Crew market unavailable.</b><small>The crew system did not load.</small></div>`)}
    ${castPinsPanel()}
    ${roster("WRITERS ON THE MARKET",freeW,6)}${roster("PRODUCERS ON THE MARKET",freeP,6)}${roster("DIRECTORS ON THE MARKET",freeD,6)}${roster("CAST ON THE MARKET",freeA.filter(t=>!t.isAnimal),9)}${roster("ANIMAL STARS ON THE MARKET",freeA.filter(t=>t.isAnimal),6)}
    ${(G.retired||[]).length?developPanel("CAREERS THAT ENDED","Recently retired","",`<div class="develop-retired">${G.retired.slice(-8).reverse().map(r=>`<div><b>${esc(r.name)}</b><span>${esc(r.kind||"")} · age ${r.age||"—"} · ${esc(dateLabel?dateLabel(r.week):"")}</span></div>`).join("")}</div>`):""}
  </section>`;
}

/* ═══════════ cast directory — every performer, 1,000+ safe ═══════════ */
const CAST_DIR={q:"",filter:"all",limit:60};
function castPins(){
  if(typeof G==="undefined"||!G) return {film:null,series:null};
  G.castPins=G.castPins||{film:null,series:null};
  return G.castPins;
}
function castPinTalent(mode){
  const pin=castPins()[mode];
  if(pin==null) return null;
  return (G.talent||[]).find(t=>String(t.id)===String(pin))||null;
}
function castRoleLabel(t){
  if(!t) return "Talent";
  if(t.isAnimal) return "Animal actor"+(t.species?" · "+t.species:"");
  return {writer:"Writer",producer:"Producer",director:"Director",actor:"Actor"}[t.kind]||t.kind;
}
function castIsFree(t){
  if(!t) return false;
  if(G && G.allCastUnlocked) return true;
  return !(t.bookedUntil>G.week) && !t.retired;
}
const CAST_DIR_FILTERS=[["all","Everyone"],["free","Free now"],["animal","Animal actors"],["actor","Actors"],["director","Directors"],["writer","Writers"],["producer","Producers"],["pinned","Pinned"]];
function castDirRows(){
  const q=(CAST_DIR.q||"").trim().toLowerCase(), f=CAST_DIR.filter;
  const pins=castPins();
  const rows=(G.talent||[]).filter(t=>{
    if(!t) return false;
    if(f==="animal"&&!t.isAnimal) return false;
    if(f==="actor"&&(t.isAnimal||t.kind!=="actor")) return false;
    if(f==="director"&&(t.isAnimal||t.kind!=="director")) return false;
    if(f==="writer"&&(t.isAnimal||t.kind!=="writer")) return false;
    if(f==="producer"&&(t.isAnimal||t.kind!=="producer")) return false;
    if(f==="free"&&!castIsFree(t)) return false;
    if(f==="pinned"&&String(pins.film)!==String(t.id)&&String(pins.series)!==String(t.id)) return false;
    if(q){
      const hay=(String(t.name||"")+" "+String(t.species||"")+" "+String(t.kind||"")+" "+(t.abilityName||"")).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  rows.sort((a,b)=>Number(castIsFree(b))-Number(castIsFree(a)) || (b.power||0)-(a.power||0) || (b.skill||0)-(a.skill||0));
  return rows;
}
function castDirRow(t){
  const pins=castPins(), free=castIsFree(t), fee=(typeof actorFee==="function")?actorFee(t):(t.fee||0);
  const pf=String(pins.film)===String(t.id), ps=String(pins.series)===String(t.id);
  return `<article class="cast-row${free?"":" busy"}" data-cast-id="${t.id}"><div class="cast-row-id"><b>${esc(t.name)}</b><small>${esc(castRoleLabel(t))}${t.isAnimal?" 🐾":""}${t.abilityKnown&&t.abilityName?" · "+esc(t.abilityName):""}</small></div><div class="cast-row-stats"><b>${stars(t.power||0)}</b><small>Skill ${t.skill||0} · ${fmtM(fee)}</small></div><div class="cast-row-state"><span class="develop-badge${free?" on":""}">${free?"FREE NOW":"BOOKED · FROM W"+(t.bookedUntil||G.week)}</span></div><div class="cast-row-actions"><button class="develop-ghost" data-cast-profile="${t.id}">Profile</button><button class="develop-ghost${pf?" on":""}" data-cast-pin="film:${t.id}" aria-pressed="${pf}">${pf?"Pinned · film ✓":"Pin · film"}</button><button class="develop-ghost${ps?" on":""}" data-cast-pin="series:${t.id}" aria-pressed="${ps}">${ps?"Pinned · series ✓":"Pin · series"}</button></div></article>`;
}
function castDirPinsMarkup(){
  const f=castPinTalent("film"), se=castPinTalent("series");
  const chip=(t,mode,label)=>t?`<span class="cast-pin"><small>${label}</small><b>${esc(t.name)}</b><button data-cast-unpin="${mode}" aria-label="Unpin ${esc(t.name)}">✕</button></span>`:"";
  const a=chip(f,"film","NEXT FILM"), b=chip(se,"series","NEXT SERIES");
  return `<div class="cast-dir-pins-row${(a||b)?"":" is-empty"}">${a||b? (a+b) : "Pin a performer and they are attached the moment you open a film or series pitch."}</div>`;
}
function castDirSync(v){
  if(!v) return;
  const rows=castDirRows(), shown=rows.slice(0,CAST_DIR.limit), list=v.querySelector("#castDirList"), count=v.querySelector("#castDirCount");
  if(list) list.innerHTML=shown.length?shown.map(castDirRow).join(""):`<div class="command-empty"><b>No one matches this search.</b><small>Clear the box or switch back to Everyone.</small></div>`;
  if(count) count.innerHTML=`<b>${rows.length.toLocaleString()}</b> match${rows.length===1?"":"es"} · <b>${(G.talent||[]).length.toLocaleString()}</b> in the directory · <b>${(G.talent||[]).filter(castIsFree).length.toLocaleString()}</b> free now${rows.length>shown.length?` · showing ${shown.length}`:""}`;
  const more=v.querySelector("#castDirMore");
  if(more){ more.textContent=`Show ${Math.min(60,rows.length-shown.length)} more`; more.style.display=rows.length>shown.length?"":"none"; }
  const pins=v.querySelector("#castDirPins"); if(pins) pins.innerHTML=castDirPinsMarkup();
  const chips=v.querySelectorAll("[data-castfilter]");
  chips.forEach(b=>{ const on=b.dataset.castfilter===CAST_DIR.filter; b.classList.toggle("active",on); b.setAttribute("aria-pressed",on); });
}
function pinCast(id,mode,rerender){
  const t=(G.talent||[]).find(x=>String(x.id)===String(id));
  if(!t) return;
  const pins=castPins();
  if(String(pins[mode])===String(t.id)){ pins[mode]=null; toast(t.name+" unpinned."); }
  else if(!castIsFree(t)){ toast(t.name+" is booked until week "+(t.bookedUntil||"?"),"bad"); return; }
  else { pins[mode]=t.id; toast(t.name+" pinned for your next "+mode+(t.isAnimal?" — animal stars read on any call sheet.":"")+".","gold"); }
  if(typeof saveGame==="function") saveGame();
  if(typeof render==="function") render();
  if(rerender) rerender();
}
function unpinCast(mode,rerender){
  const pins=castPins(); const t=castPinTalent(mode);
  pins[mode]=null;
  if(t) toast(t.name+" unpinned.");
  if(typeof saveGame==="function") saveGame();
  if(typeof render==="function") render();
  if(rerender) rerender();
}
/* A pin is attached automatically when a film or series pitch opens, so a
   performer found in the directory is one click from the call sheet. */
function seedPinnedCast(mode,wz){
  if(!wz) return wz;
  const t=castPinTalent(mode);
  if(!t||!castIsFree(t)) return wz;
  if(!Array.isArray(wz.cast)) wz.cast=[];
  if(!wz.cast.some(c=>c&&c.id===t.id)) wz.cast.push(t);
  return wz;
}
function clearUsedCastPin(mode,cast){
  const pin=castPinTalent(mode);
  if(!pin||!Array.isArray(cast)||!cast.some(c=>c&&c.id===pin.id)) return;
  castPins()[mode]=null;
}
let CAST_SCOUT=null;
function castScoutRoster(force){
  if(!force && CAST_SCOUT && CAST_SCOUT.length) return CAST_SCOUT;
  const B=(typeof window!=="undefined")?window.BOS2:null;
  if(!B||typeof B.generateAnimalActor!=="function") return (CAST_SCOUT=[]);
  const species=(B.animals||[]).map(a=>a.id);
  const out=[];
  for(let i=0;i<3;i++) out.push(B.generateAnimalActor(species[Math.floor(Math.random()*species.length)]));
  for(let i=0;i<2;i++) out.push(B.generateHumanStar("actor"));
  out.push(B.generateHumanStar("writer"));
  const used=new Set((G.talent||[]).map(t=>String(t.id)));
  out.forEach(t=>{ while(used.has(String(t.id))) t.id=(typeof nid==="function"?nid():Math.floor(Math.random()*900000000)); used.add(String(t.id)); });
  CAST_SCOUT=out;
  return out;
}
function signScout(id){
  const t=(CAST_SCOUT||[]).find(x=>String(x.id)===String(id));
  if(!t) return false;
  if(!G.studio||G.studio.cash<4){ toast("Need $4M to sign this performer.","bad"); return false; }
  if((G.talent||[]).some(x=>String(x.id)===String(t.id))){ toast("Already in the directory.","bad"); return false; }
  G.talent.push(t);
  if(typeof signContract==="function" && !signContract(t.id,"multi")){
    G.talent=G.talent.filter(x=>x!==t);
    toast("The deal fell through.","bad");
    return false;
  }
  CAST_SCOUT=CAST_SCOUT.filter(x=>x!==t);
  if(typeof saveGame==="function") saveGame();
  toast(t.name+" signed to a three-picture deal.","gold");
  return true;
}
function castScoutMarkup(){
  const roster=castScoutRoster();
  const cards=roster.map(t=>{ const free=castIsFree(t); return `<article class="cast-scout-card"><header><b>${esc(t.name)}</b><span class="develop-badge${t.isAnimal?" on":""}">${t.isAnimal?"🐾 "+esc((t.species||"animal").toUpperCase()):"ACTOR"}</span></header><p>${stars(t.power)} · skill ${t.skill} · fee ${fmtM(actorFee(t))}</p><small>${t.abilityKnown&&t.abilityName?esc(t.abilityName):"Undisclosed read"}${free?"":" · booked"}</small><button class="develop-action" data-cast-sign="${t.id}">Sign 3-picture deal · $4M</button></article>`; }).join("");
  return `<details class="cast-scout"><summary>Scout room — sign new performers <span>${roster.length} on the wire</span></summary><p class="develop-muted">Fresh reads from the agencies. Signing moves them into your directory permanently on a three-picture deal.</p><div class="cast-scout-grid">${cards||`<div class="command-empty"><b>The wire is quiet.</b><small>Refresh to pull new reads.</small></div>`}</div><footer><button class="develop-ghost" id="castScoutRefresh">Refresh scout reports · $1.0M</button></footer></details>`;
}

function openCastDirectory(){
  if(typeof G==="undefined"||!G||!Array.isArray(G.talent)) return;
  if(!CAST_DIR.limit||CAST_DIR.limit<60) CAST_DIR.limit=60;
  CAST_DIR.q="";
  let h="<h3>Cast directory</h3>"+
    "<p class='tiny muted'>Every performer on the books, animal stars included. Search the whole roster, read a profile, then pin someone for your next film or series — the pin is waiting on the call sheet.</p>"+
    "<div class='cast-dir'><div class='cast-dir-tools'><input id='castDirSearch' class='cast-dir-search' type='search' placeholder='Search a name, species, or ability…' aria-label='Search the cast directory' autocomplete='off'>"+
    "<button class='develop-ghost' id='castDirUnlock'>Reveal every cast member</button></div>"+
    "<div class='develop-filters' role='group' aria-label='Filter the cast directory'>"+CAST_DIR_FILTERS.map(([k,label])=>`<button data-castfilter="${k}" class="${CAST_DIR.filter===k?"active":""}" aria-pressed="${CAST_DIR.filter===k}">${label} <b>${k==="all"?(G.talent||[]).length:k==="free"?(G.talent||[]).filter(castIsFree).length:k==="animal"?(G.talent||[]).filter(t=>t.isAnimal).length:""}</b></button>`).join("")+"</div>"+
    "<div class='cast-dir-pins' id='castDirPins'></div><div class='cast-dir-count' id='castDirCount'></div>"+
    "<div class='cast-dir-list' id='castDirList' role='list'></div>"+
    `<div id="castScoutWrap">${castScoutMarkup()}</div></div>`+
    "<div class='modal-actions'><button class='btn btn-ghost' id='castDirMore'>Show 60 more</button><button class='btn btn-primary' id='castDirDone'>Done</button></div>";
  const v=openModal(h);
  const dm=v.querySelector(".modal"); if(dm) dm.classList.add("cast-directory-modal");
  const refresh=()=>castDirSync(v);
  const search=v.querySelector("#castDirSearch");
  if(search) search.oninput=()=>{ CAST_DIR.q=search.value; CAST_DIR.limit=60; refresh(); };
  v.querySelectorAll("[data-castfilter]").forEach(b=>b.onclick=()=>{ CAST_DIR.filter=b.dataset.castfilter; CAST_DIR.limit=60; refresh(); });
  v.querySelector("#castDirMore").onclick=()=>{ CAST_DIR.limit=(CAST_DIR.limit||60)+60; refresh(); };
  v.querySelector("#castDirDone").onclick=()=>closeModal();
  const unlock=v.querySelector("#castDirUnlock");
  if(unlock) unlock.onclick=()=>{ if(typeof unlockAllCast==="function") unlockAllCast(); refresh(); if(typeof render==="function") render(); };
  const syncScout=()=>{ const wrap=v.querySelector("#castScoutWrap"); if(wrap) wrap.innerHTML=castScoutMarkup(); };
  v.addEventListener("click",ev=>{
    const prof=ev.target.closest("[data-cast-profile]");
    if(prof){ closeModal(); if(typeof talentModal==="function") talentModal(+prof.dataset.castProfile); return; }
    const sign=ev.target.closest("[data-cast-sign]");
    if(sign){ if(signScout(sign.dataset.castSign)){ syncScout(); refresh(); if(typeof render==="function") render(); } else beep("bad"); return; }
    if(ev.target.closest("#castScoutRefresh")){
      const btn=ev.target.closest("#castScoutRefresh");
      if(!G.studio||G.studio.cash<1){ toast("Need $1.0M for fresh scout reports.","bad"); return; }
      if(typeof spend==="function") spend("studio",1); else G.studio.cash-=1;
      castScoutRoster(true); syncScout(); if(typeof saveGame==="function") saveGame(); toast("Scout reports refreshed.","gold");
      return;
    }
    const pin=ev.target.closest("[data-cast-pin]");
    if(pin){ const [mode,id]=pin.dataset.castPin.split(":"); pinCast(id,mode,refresh); return; }
    const unpin=ev.target.closest("[data-cast-unpin]");
    if(unpin){ unpinCast(unpin.dataset.castUnpin,refresh); return; }
  });
  refresh();
}
window.openCastDirectory=openCastDirectory;

function castPickRow(t,opts){
  opts=opts||{};
  const sel=!!opts.sel, free=castIsFree(t), fee=(typeof actorFee==="function")?actorFee(t):(t.fee||0);
  const ability=(t.abilityKnown&&t.abilityName)?(" · "+esc(t.abilityName)):"";
  const pact=(typeof activePicturePact==="function")?activePicturePact(t):null;
  const meta=[esc(castRoleLabel(t))+(t.isAnimal?" 🐾":""),ability.replace(/^ · /,""),pact?("Studio partner · "+pact.picturesRemaining+" pictures"):"",t.multiDeal?("multi-picture · "+t.multiDeal.left+" left"):""].filter(Boolean).join(" · ");
  const state=sel?"ON CALL":pact?"PARTNER · "+pact.picturesRemaining+" PIC":"PICK";
  return `<button type="button" class="cast-pick${sel?" sel":""}${free?"":" busy"}" ${opts.attr||""} aria-pressed="${sel}"><span class="cast-pick-main"><b>${esc(t.name)}</b><small>${meta}</small></span><span class="cast-pick-stats"><b>${stars(t.power||0)}</b><small>Skill ${t.skill||0} · ${fmtM(fee)}</small></span><span class="cast-pick-state">${state}</span></button>`;
}
function castPinsPanel(){
  const total=(G.talent||[]).length, animals=(G.talent||[]).filter(t=>t.isAnimal).length;
  const freeN=(G.talent||[]).filter(castIsFree).length;
  const pins=castPins(), pf=castPinTalent("film"), ps=castPinTalent("series");
  const pinChip=(t,mode,label)=>t?`<span class="cast-pin"><small>${label}</small><b>${esc(t.name)}</b><button data-cast-unpin="${mode}" aria-label="Unpin ${esc(t.name)}">✕</button></span>`:"";
  const body=`<div class="cast-desk"><div class="cast-desk-stats"><div><small>ON THE BOOKS</small><b>${total.toLocaleString()}</b></div><div><small>FREE NOW</small><b>${freeN.toLocaleString()}</b></div><div><small>ANIMAL ACTORS</small><b>${animals.toLocaleString()}</b></div><div><small>PICTURE DEALS</small><b>${(G.talent||[]).filter(t=>t.multiDeal).length.toLocaleString()}</b></div></div><div class="cast-desk-pins">${pinChip(pf,"film","NEXT FILM")}${pinChip(ps,"series","NEXT SERIES")}${(!pf&&!ps)?`<span class="develop-muted">Pin a performer here and they board your next film or series automatically.</span>`:""}</div><div class="cast-desk-actions"><button class="develop-action" id="btnOpenCastDirectory" onclick="openCastDirectory()">Open the cast directory</button><button class="develop-ghost" onclick="if(typeof unlockAllCast==='function'){unlockAllCast();render();}">Reveal every cast member</button></div></div>`;
  return developPanel("CAST DIRECTORY",`Search all ${total.toLocaleString()} performers`,`Animal stars, leads, directors, writers and producers — one roster, filterable by availability, role, or species.`,`${body}`);
}
/* ── 06 / Combos codex ────────────────────────────────────────────────── */
function commandDevelopCombos(){
  const themes=DATA.THEMES||[], genres=Object.keys(DATA.GENRES||{});
  const known=G.comboKnown||{};
  let love=0,clash=0,unknown=0;
  genres.forEach(g=>themes.forEach(th=>{const s=known[g+"|"+th.id];if(s==="love")love++;else if(s==="clash")clash++;else unknown++;}));
  const total=genres.length*themes.length;
  const filters=[["all","All",total],["love","Matches",love],["clash","Clashes",clash],["unknown","Undiscovered",unknown]];
  const groups=genres.map(g=>{
    const chips=themes.map(th=>({th,state:known[g+"|"+th.id]||"unknown"})).filter(c=>DEVELOP_COMBO_FILTER==="all"||c.state===DEVELOP_COMBO_FILTER);
    if(!chips.length) return "";
    return `<section class="develop-combo-genre"><header><span>${DATA.GENRES[g].emoji}</span><h3>${esc(DATA.GENRES[g].name)}</h3><b>${chips.length} / ${themes.length}</b></header><div class="develop-combo-chips">${chips.map(c=>`<span class="develop-combo ${c.state}" title="${esc(c.th.name)} — ${c.state==="love"?"great match (+5 quality, +8% opening)":c.state==="clash"?"clash (−4 quality)":"not yet discovered"}"><b>${c.th.emoji||"#"}</b><span>${esc(c.th.name)}</span><i>${c.state==="love"?"★":c.state==="clash"?"✕":"?"}</i></span>`).join("")}</div></section>`;
  }).join("");
  return `<section class="command-deck command-develop">
    ${developHead("06 / COMBOS CODEX","Learn what your audience rewards.",`Genre × theme chemistry is discovered by releasing films. The codex records every pairing your studio has proved.`)}
    <div class="command-telemetry">${commandMetric("DISCOVERED",love+clash+" / "+total,"Pairings on record")}${commandMetric("GREAT MATCHES",love,"+5 quality · +8% opening")}${commandMetric("CLASHES",clash,"−4 quality")}${commandMetric("UNDISCOVERED",unknown,"Ship a film to reveal")}</div>
    <div class="develop-progress"><div><span style="width:${total?clamp((love+clash)/total*100,0,100):0}%"></span></div><small>${love+clash} of ${total} pairings discovered · ${Math.round(total?((love+clash)/total*100):0)}% of the codex</small></div>
    <div class="develop-filters" role="group" aria-label="Filter combos">${filters.map(([k,label,n])=>`<button data-combo-filter="${k}" class="${DEVELOP_COMBO_FILTER===k?"active":""}" aria-pressed="${DEVELOP_COMBO_FILTER===k}">${label} <b>${n}</b></button>`).join("")}</div>
    <div class="develop-combos">${groups||`<div class="command-empty"><b>Nothing matches this filter.</b><small>Switch back to “All” to see every pairing.</small></div>`}</div>
  </section>`;
}

/* ── 07 / Locations & partners ────────────────────────────────────────── */
/* ═══════════ LOCATION DESK — one scouting surface, always reachable ═══════════
   The Productions pill, the Dashboard incentives desk and Develop 07 all land
   here. Destinations are contracts, not decoration: every card assigns a real
   destination to a real picture (rebate + craft buff) or explains exactly what
   is missing. */
let LOC_DESK={projectId:null,focus:null};
function locationDeskData(){
  const D=(typeof FilmLocationsTax!=="undefined"&&FilmLocationsTax.DESTINATIONS)||{};
  const dests=Object.keys(D).map(k=>D[k]);
  const scout=(typeof LocationScouting!=="undefined"&&LocationScouting.SHOOTING_LOCATIONS)||[];
  const projects=(G.projects||[]).filter(p=>["pre","shoot","post","prod"].includes(p.phase||""));
  const collected=(G.filmLocations&&G.filmLocations.rebatesCollected)||0;
  return {dests,scout,projects,collected};
}
function openLocationDesk(projectId){
  if(projectId!=null) LOC_DESK.projectId=+projectId;
  const d=locationDeskData();
  if(!d.projects.some(p=>p.id===LOC_DESK.projectId)) LOC_DESK.projectId=d.projects[0]?d.projects[0].id:null;
  const stage=(p)=>({pre:"PRE-PRODUCTION",shoot:"SHOOTING",prod:"SHOOTING",post:"POST"}[p.phase]||String(p.phase||"").toUpperCase());
  const project=d.projects.find(p=>p.id===LOC_DESK.projectId)||null;
  const current=(dest)=>project&&((project.filmingDestination===dest.id)||(project.shootingLocation===dest.id));
  const fit=(dest)=>project&&(dest.bestGenres||[]).includes(project.genre);
  const rebate=(dest)=>project?Math.round(project.budget*(dest.taxRebatePct||0)*10)/10:null;
  const focus=LOC_DESK.focus?d.dests.find(x=>x.id===LOC_DESK.focus):null;

  const projectRail=d.projects.length
    ? `<div class="loc-projects">${d.projects.map(p=>`<button class="loc-project${p.id===LOC_DESK.projectId?" on":""}" data-locproj="${p.id}" aria-pressed="${p.id===LOC_DESK.projectId}"><span><b>${esc(p.title)}</b><small>${stage(p)} · ${esc((DATA.GENRES[p.genre]||{}).name||p.genre||"")} · ${fmtM(p.budget||0)}</small></span><em>${p.filmingDestination?esc((d.dests.find(x=>x.id===p.filmingDestination)||{name:"contracted"}).name):"no location"}</em></button>`).join("")}</div>`
    : `<div class="loc-empty"><b>No picture is in play.</b><p>Location contracts attach to pictures in pre-production, shooting, or post. Greenlight a picture and the commissions below become bookable.</p><button class="develop-action" id="locPitch">Pitch a film →</button></div>`;

  const cards=d.dests.map(dest=>{
    const isCur=current(dest), isFit=fit(dest), cash=rebate(dest);
    const craft=d.scout.find(x=>x.id===dest.id);
    return `<article class="loc-dest${isCur?" current":""}${LOC_DESK.focus===dest.id?" focus":""}" data-locfocus="${dest.id}">
      <header><div><span class="command-eyebrow">${esc(dest.region||"COMMISSION")}</span><b>${esc(dest.name)}</b></div><span class="loc-rebate">${Math.round((dest.taxRebatePct||0)*100)}%<small>REBATE</small></span></header>
      <p>${esc(dest.desc||"")}</p>
      <dl><div><dt>TRAVEL</dt><dd>${dest.travelCost?fmtM(dest.travelCost):"home lot"}</dd></div><div><dt>CRAFT</dt><dd>${craft?"+"+craft.qualityBuff+" pts":"—"}</dd></div><div><dt>BEST FOR</dt><dd>${esc((dest.bestGenres||[]).slice(0,2).join(" · ")||"any")}</dd></div></dl>
      <footer>
        ${isCur?`<small class="loc-status">✔ Contracted${project?" for "+esc(project.title):""}</small>`:isFit?`<small class="loc-status good">Genre match${cash!=null?" · +"+fmtM(cash)+" back":""}</small>`:`<small class="loc-status">${cash!=null?"+"+fmtM(cash)+" cash back on wrap":craft?craft.weather+" weather":"regional incentive"}</small>`}
        <button class="${isCur?"develop-ghost":"develop-action"}" data-dest-id="${dest.id}">${isCur?"Change location":"Contract"}</button>
      </footer>
    </article>`;
  }).join("");

  const dossier=focus?`<section class="loc-dossier">
      <header><span class="command-eyebrow">SCOUT FILE</span><h4>${esc(focus.name)}</h4><p>${esc(focus.desc||"")}</p></header>
      <div class="loc-dossier-grid">
        <div><small>TAX REBATE</small><b>${Math.round((focus.taxRebatePct||0)*100)}%</b><em>paid on wrap</em></div>
        <div><small>TRAVEL NOW</small><b>${focus.travelCost?fmtM(focus.travelCost):"$0"}</b><em>charged on contract</em></div>
        <div><small>${project?"CASH BACK":"SAMPLE"}</small><b>${project?fmtM(rebate(focus)||0):Math.round((focus.taxRebatePct||0)*40*10)/10+"M"}</b><em>${project?"on "+esc(project.title)+"'s budget":"on a $40M picture"}</em></div>
        <div><small>CRAFT BUFF</small><b>${(d=>d?"+"+d.qualityBuff:"—")(d.scout.find(x=>x.id===focus.id))}</b><em>on final quality</em></div>
      </div>
      <footer>${project?`<button class="develop-action" data-dest-id="${focus.id}">Contract for ${esc(project.title)}</button>`:`<button class="develop-action" id="locDossierPitch">Pitch a picture to use it</button>`}<button class="develop-ghost" data-locfocus="">Close file</button></footer>
    </section>`:"";

  const html=`<div class="loc-desk command-dialog">
    <header class="loc-head">
      <div><span class="command-eyebrow">LOCATION DESK / WORLDWIDE COMMISSIONS</span><h3>Where the next picture shoots.</h3><p>Every commission carries a government rebate paid when the picture wraps, a travel cost paid now, and a craft buff on location. Pick a picture, then book the ground it stands on.</p></div>
      <div class="loc-head-stats"><div><small>COMMISSIONS</small><b>${d.dests.length}</b></div><div><small>REBATES BANKED</small><b>${fmtM(d.collected)}</b></div><div><small>IN PLAY</small><b>${d.projects.length}</b></div></div>
    </header>
    <div class="loc-body">
      <aside class="loc-rail"><span class="command-eyebrow">PICTURES IN PLAY</span>${projectRail}<button class="develop-ghost loc-ledger" id="locLedger">Rebate ledger &amp; PLF circuits</button></aside>
      <section class="loc-main">${dossier}<div class="loc-dest-grid">${cards}</div></section>
    </div>
    <footer class="loc-actions"><button class="develop-ghost" id="locClose">Close</button>${project?`<span class="loc-actions-note">Contracting for <b>${esc(project.title)}</b> · ${fmtM(G.studio.cash)} cash on hand</span>`:`<span class="loc-actions-note">No picture eligible — pitch or greenlight one first.</span>`}</footer>
  </div>`;

  const v=openModal(html,{className:"command-location-modal"});
  const wire=(root)=>{
    root.querySelectorAll("[data-locproj]").forEach(b=>b.onclick=()=>{ LOC_DESK.projectId=+b.dataset.locproj; LOC_DESK.focus=null; beep("click"); openLocationDesk(); });
    root.querySelectorAll("[data-locfocus]").forEach(b=>b.onclick=(e)=>{ if(e.target.closest("[data-dest-id]")) return; LOC_DESK.focus=b.dataset.locfocus||null; beep("click"); openLocationDesk(); });
    root.querySelectorAll("[data-dest-id]").forEach(b=>b.onclick=(e)=>{
      e.stopPropagation();
      const destId=b.dataset.destId;
      if(!project){ LOC_DESK.focus=destId; openLocationDesk(); return; }
      const dest=d.dests.find(x=>x.id===destId);
      if(!dest) return;
      const res=(typeof FilmLocationsTax!=="undefined"&&typeof FilmLocationsTax.assignFilmingDestination==="function")
        ? FilmLocationsTax.assignFilmingDestination(project.id,dest.id,G) : {ok:false,msg:"Location system unavailable."};
      if(!res||!res.ok){ toast((res&&res.msg)||"Could not contract that location.","bad"); beep("bad"); return; }
      const craft=d.scout.find(x=>x.id===dest.id);
      if(craft){ project.shootingLocation=craft.id; project.shootingLocationName=craft.name; project.locationQualityBuff=craft.qualityBuff; }
      project.shootingLocationName=project.shootingLocationName||dest.name;
      beep("gold"); flashes(G.flash);
      toast(res.msg+(craft?" Craft +"+craft.qualityBuff+" pts on location.":""),"good");
      LOC_DESK.focus=dest.id;
      render(); openLocationDesk();
    });
    const close=root.querySelector("#locClose"); if(close) close.onclick=()=>{ beep("click"); closeModal(); };
    const ledger=root.querySelector("#locLedger"); if(ledger) ledger.onclick=()=>{ beep("click"); if(typeof FilmLocationsTax!=="undefined"&&FilmLocationsTax.openLocationsTaxModal) FilmLocationsTax.openLocationsTaxModal(); };
    const pitch=root.querySelector("#locPitch"); if(pitch) pitch.onclick=()=>{ beep("click"); closeModal(); startFilmPitchWizard(); };
    const dpitch=root.querySelector("#locDossierPitch"); if(dpitch) dpitch.onclick=()=>{ beep("click"); closeModal(); startFilmPitchWizard(); };
    const clear=root.querySelectorAll('[data-locfocus=""]'); clear.forEach(b=>b.onclick=()=>{ LOC_DESK.focus=null; beep("click"); openLocationDesk(); });
  };
  wire(v);
}

function commandDevelopLocations(){
  try{ if(typeof FilmLocationsTax!=="undefined"&&typeof FilmLocationsTax.initFilmLocationsTax==="function") FilmLocationsTax.initFilmLocationsTax(G); }catch(e){}
  try{ if(typeof LiveOpsCoPro!=="undefined"&&typeof LiveOpsCoPro.initLiveOpsCoPro==="function") LiveOpsCoPro.initLiveOpsCoPro(G); }catch(e){}
  const D=(typeof FilmLocationsTax!=="undefined"&&FilmLocationsTax.DESTINATIONS)||{};
  const destinations=Object.keys(D).map(k=>D[k]);
  const inProd=(G.projects||[]).filter(p=>["prod","pre","shoot","post"].includes(p.phase||""));
  const best=destinations.reduce((m,d)=>Math.max(m,d.taxRebatePct||0),0);
  const alliances=(typeof LiveOpsCoPro!=="undefined"&&LiveOpsCoPro.RIVAL_ALLIANCES)||[];
  const sponsors=(typeof StudioOperationsSuite!=="undefined"&&StudioOperationsSuite.SPONSOR_TIERS)||[];
  const animals=(typeof FilmLocationsTax!=="undefined"&&FilmLocationsTax.ANIMAL_TALENT)||{};
  const wardrobe=(typeof FilmLocationsTax!=="undefined"&&FilmLocationsTax.WARDROBE_COLLECTIONS)||{};
  const destCards=destinations.map(d=>`<article class="develop-destination"><header><b>${esc(d.name)}</b><span>${Math.round((d.taxRebatePct||0)*100)}% REBATE</span></header><p>${esc(d.desc||"")}</p><dl><div><dt>Region</dt><dd>${esc(d.region||"—")}</dd></div><div><dt>Travel cost</dt><dd>${fmtM(d.travelCost||0)}</dd></div></dl><footer>${inProd.length?`<small>Contract for “${esc(inProd[0].title)}”</small><button class="develop-action" data-dev-dest="${d.id}">Contract location</button>`:`<small>No in-production title to attach</small><button class="develop-ghost" data-dev-dest="${d.id}">Open scouting file</button>`}</footer></article>`).join("");
  const animalCards=Object.keys(animals).map(k=>{const a=animals[k];return `<article class="develop-partner"><header><b>${esc(a.name)}</b><span>${esc(a.species||"")}</span></header><p>${esc(a.desc||"")}</p><footer><span>Handler ${fmtM(a.handlerFee||0)}</span><span>Family +${Math.round((a.bonusFamilyPull||0)*100)}%</span><span>Quality +${a.bonusQuality||0}</span></footer></article>`;}).join("");
  const wardrobeCards=Object.keys(wardrobe).map(k=>{const w=wardrobe[k];return `<article class="develop-partner"><header><b>${esc(w.name)}</b><span>${fmtM(w.cost||0)}</span></header><p>${esc(w.desc||"")}</p><footer><span>Quality +${w.qualityBoost||0}</span><span>Costume odds +${Math.round((w.costumeAwardOdds||0)*100)}%</span></footer></article>`;}).join("");
  return `<section class="command-deck command-develop">
    ${developHead("07 / LOCATIONS &amp; PARTNERS","Where you shoot changes what you keep.",`Regional rebates, co-financing pacts, brand partners, and the creature and costume departments.`)}
    <div class="command-telemetry">${commandMetric("DESTINATIONS",destinations.length,"Certified commissions")}${commandMetric("BEST REBATE",Math.round(best*100)+"%","Cash back after wrap")}${commandMetric("IN PRODUCTION",inProd.length,inProd.length?"Eligible for location deals":"No shoot to attach")}${commandMetric("CO-PRO PARTNERS",alliances.length,"Studios open to risk sharing")}</div>
    <div class="develop-lead">
      <section class="develop-brief"><span class="command-eyebrow">THE SHOOTING DECISION</span><h2>${inProd.length?`${esc(inProd[0].title)} can shoot on location.`:`No shoot in production.`}</h2><p>${inProd.length?"Pick a commission and the rebate is settled when the film wraps post-production. Travel costs are paid now; the rebate arrives later.":"Location contracts attach to films in pre-production, production, or post. Greenlight something first."}</p><footer><span>STUDIO CASH</span><b>${fmtM(G.studio.cash)}</b><small>Travel costs come out of overhead.</small><button class="develop-ghost" id="btnDevelopLocationDesk">Open the location desk</button></footer></section>
      <section class="develop-panel develop-inline-panel"><div class="develop-panel-head"><div><span class="command-eyebrow">RISK SHARING</span><h2>Who will co-finance</h2><p>Partners cover 40-50% of a production budget against backend box office.</p></div></div><div class="develop-alliances">${alliances.map(p=>`<article><header><b>${esc(p.name)}</b><span>${Math.round((p.costSharePct||0)*100)}%</span></header><p>${esc(p.desc||"")}</p><footer><span>Rep ${p.partnerRep||"—"}</span><span>Backend ${Math.round((p.revSharePct||0)*100)}%</span></footer></article>`).join("")||`<div class="command-empty"><b>No partners listed.</b><small>The co-production desk did not load.</small></div>`}<div class="develop-panel-actions"><button class="develop-action" id="btnDevelopCoPro">Manage co-production pacts</button><button class="develop-ghost" id="btnDevelopSponsors">Brand placement desk</button></div></div></section>
    </div>
    ${developPanel("REGIONAL COMMISSIONS","Filming destinations",`Rebates are paid on wrap. Travel cost is charged when the location is contracted.`,destCards?`<div class="develop-destinations">${destCards}</div>`:`<div class="command-empty"><b>No destinations available.</b><small>The location system did not load.</small></div>`)}
    ${developPanel("COMMERCIAL PARTNERS","Brand placement tiers","Sponsor deals are negotiated per production and carry a critic-backlash risk.",sponsors.length?`<div class="develop-sponsors">${sponsors.map(sp=>`<article><header><b>${esc(sp.name)}</b><span>${fmtM(sp.cashAdvance||0)}</span></header><p>${esc(sp.desc||"")}</p><footer><span>${esc(sp.category||"")}</span><span>Backlash ${Math.round((sp.criticPenaltyRisk||0)*100)}%</span></footer></article>`).join("")}</div>`:`<div class="command-empty"><b>No sponsor tiers loaded.</b><small>The partnerships desk did not load.</small></div>`)}
    <div class="develop-two-up">
      ${developPanel("ANIMAL &amp; MASCOT ACTORS","Creature performers","Viral buzz and family-demographic multipliers on the production they join.",animalCards?`<div class="develop-partners">${animalCards}</div>`:`<div class="command-empty"><b>No animal talent listed.</b><small>The casting extension did not load.</small></div>`)}
      ${developPanel("COSTUME HOUSE","Wardrobe collections","Quality and costume-award odds added to the production.",wardrobeCards?`<div class="develop-partners">${wardrobeCards}</div>`:`<div class="command-empty"><b>No collections listed.</b><small>The costume catalogue did not load.</small></div>`)}
    </div>
  </section>`;
}

/* Talent profile: career stage + derived history. Stage from engine age/power/heat;/* Talent profile: career stage + derived history. Stage from engine age/power/heat;
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
  const icon=t.isAnimal? "🐾" : ({writer:"✍️",producer:"🎫",director:"🎬"}[t.kind] || (t.power>=4?"🌟":"🙂"));
  const role=castRoleLabel(t);
  const st=talentStage(t);
  let line;
  const fitName=(t.genreFit&&DATA.GENRES[t.genreFit])?DATA.GENRES[t.genreFit].name:null;
  if(t.kind==="director")      line="Skill "+t.skill+(fitName?" · fits "+fitName:" · any genre");
  else if(t.kind==="writer")   line="Skill "+t.skill+(fitName?" · specialises in "+fitName:" · any genre");
  else if(t.kind==="producer") line="Skill "+t.skill+" · "+(t.skill>=80?"schedule shaver":t.skill<58?"overrun risk":"steady hand");
  else if(t.isAnimal)          line="Skill "+t.skill+" · "+(t.species?t.species+" performer":"animal performer");
  else                         line="Skill "+t.skill+" · acting";
  const agTag = (t.agency && DATA.agency)? " <span class='tag blue' title='"+esc(DATA.agency(t.agency).name)+"'>"+esc(DATA.agency(t.agency).name.split(" ")[0])+"</span>" : "";
  const films=talentFilms(t);
  const frNames=[...new Set(films.map(f=>f.franchiseName).filter(Boolean))].slice(0,2);
  const last=films.slice(-1)[0];
  return "<div class='card talent-card'><div class='t-avatar'>"+(typeof talentAvatarSVG==="function"?talentAvatarSVG(t):icon)+"</div><div style='flex:1'>"+
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
    "<button class='btn btn-sm btn-ghost' onclick='talentModal("+t.id+")'>Profile</button>"+
    "<button class='btn btn-sm btn-ghost' onclick='characterSheet("+t.id+")' title='RPG character sheet'>📊 RPG</button></div></div></div>";
}
function talentModal(id){
  const t=(typeof talentById==="function")?talentById(+id):(G.talent||[]).find(x=>x.id===+id);
  if(!t) return;
  const fee=actorFee(t), st=talentStage(t), films=talentFilms(t);
  const role=castRoleLabel(t);
  let h="<h3>"+esc(t.name)+" <span class='tag'>"+role+"</span> <span class='tag "+st.cls+"'>"+st.s+"</span></h3>"+
    "<div class='tiny muted'>"+stars(t.power)+" · skill "+t.skill+" · age "+(t.age||"—")+" · "+(t.pics||0)+" pictures since Y"+(t.joinedYear||1)+"</div>"+
    "<div class='card' style='margin-top:8px'>"+
    "<div class='cost-line'><span>Salary ask</span><b>"+fmtM(fee)+"</b></div>"+
    "<div class='cost-line'><span>Popularity</span><b>"+(t.heat?"heat ×"+t.heat:"cool")+"</b></div>"+
    "<div class='cost-line'><span>Reputation</span><b>"+esc(talentRep(t))+"</b></div>"+
    "<div class='cost-line'><span>Availability</span><b>"+esc(talentAvail(t))+"</b></div>"+
    (t.isAnimal?"<div class='cost-line'><span>Species</span><b class='pos'>🐾 "+esc(t.species||"animal")+"</b></div>":"")+
    (t.isAnimal?"<div class='cost-line'><span>Castable in</span><b>Any film or series lead</b></div>":"")+
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
  /* v28: hidden ability panel — audition to reveal, or it surfaces after one collaboration */
  {
    const ab=talentAbility(t);
    h+="<div class='card' style='margin-top:8px'><b class='small'>🎭 Ability</b>";
    if(ab && t.abilityKnown){
      h+="<div class='cost-line'><span>"+(ab.emoji||"🎭")+" "+esc(ab.name)+" <span class='tag tiny "+(DATA.ABILITY_RARITY[ab.rarity]||{}).cls+"'>"+(DATA.ABILITY_RARITY[ab.rarity]||{}).name+"</span></span><b class='tiny'>"+esc(ab.blurb)+"</b></div>";
    }else if(ab){
      h+="<div class='tiny muted' style='margin:4px 0'>This candidate carries an <b>undisclosed ability</b>. Stage an audition read to find out — or work with them once and it will show itself.</div>"+
        "<button class='btn btn-sm btn-alt' onclick='auditionClick(event,"+t.id+")'>🎭 Audition read · "+fmtM(auditionCost(t))+"</button>";
    }else{
      h+="<div class='tiny muted' style='margin:4px 0'>No special ability on file — what you see (skill, power) is what you get.</div>";
    }
    h+="</div>";
  }
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
  const pinA=castPinTalent("film"), pinB=castPinTalent("series");
  h+="<div class='modal-actions'><button class='btn "+(pinA&&pinA.id===t.id?"btn-primary":"btn-alt")+"' data-tmodal-pin='film:"+t.id+"'>"+(pinA&&pinA.id===t.id?"🎬 Pinned for next film ✓":"🎬 Pin for next film")+"</button>"+
    "<button class='btn "+(pinB&&pinB.id===t.id?"btn-primary":"btn-alt")+"' data-tmodal-pin='series:"+t.id+"'>"+(pinB&&pinB.id===t.id?"📺 Pinned for next series ✓":"📺 Pin for next series")+"</button>"+
    "<button class='btn btn-alt' onclick='watchClick(event,"+t.id+")'>"+((G.watchlist||[]).includes(t.id)?"⭐ Remove from watchlist":"☆ Add to watchlist")+"</button>"+
    "<button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";
  const vm=openModal(h);
  vm.querySelectorAll("[data-contract]").forEach(b=>b.onclick=()=>{ if(signContract(t.id,b.dataset.contract)){ beep("gold"); flashes(G.flash); talentModal(t.id); } else beep("bad"); });
  vm.querySelectorAll("[data-tmodal-pin]").forEach(b=>b.onclick=()=>{ const [mode,id]=b.dataset.tmodalPin.split(":"); pinCast(id,mode); beep("click"); talentModal(t.id); });
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
function startWizard(idea, targetSub){
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], cameo:null, sub:targetSub||2,
      budget:Math.round(neededBudget(idea.genre,idea.scale)), plan:"theatrical", presales:false, deals:{},
      rating:"PG-13", location:"la", scriptPolish:false, premium:false,
      aiCast:false, aiScript:false, coProd:"none", theme:null, festStrategy:null, festMode:"premiere"};
  seedPinnedCast("film",WZ);
  wizardModal();
}
window.setWizardFilter = function(filterKind, step){
  if(WZ){
    if(step===2) WZ._wFilter = filterKind;
    else if(step===3) WZ._dFilter = filterKind;
    else if(step===4) WZ._cFilter = filterKind;
    else if(step===5) WZ._pFilter = filterKind;
    wizardModal();
  }
};
window.setWizardStep = function(step){
  if(WZ){
    WZ.sub = step;
    wizardModal();
  }
};
function startSequel(film){
  const idea={ id:nid(), genre:film.genre, scale:film.scale, title:"(sequel)", blurb:"The saga continues…",
    script:clamp((film.quality?film.quality.overall:65)+5,55,95), hot:true, sequelOf:film };
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], cameo:null, sub:2, seqBudgetFixed:true,
      budget:Math.round(film.budget*1.3),
      rating:"PG-13", location:"la", scriptPolish:false, premium:false, plan:"theatrical", presales:false,
      aiCast:false, aiScript:false, coProd:"none", theme:null, festStrategy:null, festMode:"premiere"};
  seedPinnedCast("film",WZ);
  wizardModal();
}
/* v4: one card renderer for every crew kind */
function crewCard(t, opts){
  opts=opts||{};
  const icon = t.isAnimal? "🐾" : ({writer:"✍️", director:"🎬", producer:"🎫", actor:(t.power>=4?"🌟":"🙂")}[t.kind]||"🙂");
  const fit = opts.genre && t.genreFit===opts.genre;
  const bonus = (t.kind==="writer" && opts.genre)? writerBonus(t, opts.genre) : null;
  let line;
  if(t.kind==="writer")        line = "Skill "+t.skill+" · "+(bonus>=0?"+":"")+bonus+" script"+(fit? " · <span class='pos'>fits "+DATA.GENRES[opts.genre].name+"</span>":"");
  else if(t.kind==="producer") line = "Skill "+t.skill+" · "+(t.skill>=80?"<span class='pos'>schedule shaver</span>":t.skill<58?"<span class='neg'>overrun risk</span>":"steady hand");
  else if(t.kind==="director") line = "Skill "+t.skill+(fit? " · <span class='pos'>fits "+DATA.GENRES[opts.genre].name+"</span>":"");
  else if(t.isAnimal)          line = "Skill "+t.skill+" · "+(t.species?esc(t.species)+" performer":"animal performer");
  else                         line = "Skill "+t.skill;
  const stg=(typeof talentStage==="function")?talentStage(t):{s:"",cls:""};
  let hint="";
  if(t.kind==="writer"&&opts.genre) hint="Hire: +"+bonus+" script (~30% of quality) for "+fmtM(actorFee(t))+".";
  else if(t.kind==="director") hint="Hire: ~25% of quality"+(fit?" + genre fit":"")+" for "+fmtM(actorFee(t))+".";
  else if(t.kind==="producer") hint="Hire: overruns ~"+overrunRisk(t.skill)+"%/wk for "+fmtM(actorFee(t))+".";
  else hint="Hire: "+t.power+"★ → opening ×"+starOpenMult(t.power)+" for "+fmtM(actorFee(t))+((t.scandal>0)?" · scandal taxes opening.":".");
  // v9 relationship tags
  let rel="";
  const fp=(typeof feudPartner==="function")? feudPartner(t) : null;
  if(t.wof) rel+=" <span class='tag gold' title='Walk of Fame — permanent heat'>🚶 Walk of Fame</span>";
  if((t.kind==="director" && ((t.museCount||0)>=3 || t.museGenre)) || t.museGenre) {
    const mgName = t.museGenre ? DATA.genreOf(t.museGenre).name : (opts.genre ? DATA.genreOf(opts.genre).name : "Auteur");
    rel+=" <span class='tag purple' title='3+ films together: +5% buzz on "+mgName+" films'>🪄 Muse of "+mgName+"</span>";
  }
  const picturePact = typeof activePicturePact==="function" ? activePicturePact(t) : null;
  if(picturePact) rel+=" <span class='tag green'>Studio partner · "+picturePact.picturesRemaining+" pictures · locked "+fmtM(picturePact.lockedRate)+"</span>";
  if(t.multiDeal) rel+=" <span class='tag green' title='Multi-picture deal: −25% fees for "+t.multiDeal.left+" more films'>📜 "+t.multiDeal.left+" films left</span>";
  if(t.training) rel+=" <span class='tag blue' title='At star school — skill rising'>🎓 in school "+t.training.weeksLeft+"w</span>";
  if(fp) rel+=" <span class='tag red' title='Active feud: never cast together'>⚔ feuds with "+esc(fp)+" <span class='tiny'>(85% tension)</span></span>";
  if(t.homegrown) rel+=" <span class='tag'>🌱 homegrown</span>";
  if((t.scandal||0)>0) rel+=" <span class='tag red' title='Toxic cast penalty: −"+Math.min(35, Math.round(t.scandal*20))+"% box office'>☣️ Toxic risk "+Math.min(100, Math.round(t.scandal*25))+"%</span>";
  if(t.power>=4 || (typeof WZ!=="undefined" && WZ && WZ.deals && WZ.deals[t.id]==="backend")) rel+=" <span class='tag tiny' title='Standard Hollywood backend package'>Backend: 2% rentals</span>";
  // v9 roster actions (inline handlers work inside modals too)
  let acts="";
  /* v28: hidden ability — audition to reveal, or it surfaces after one film together */
  const ab=talentAbility(t);
  if(ab && t.abilityKnown) rel+=" <span class='"+(DATA.ABILITY_RARITY[ab.rarity]||{}).cls+"' title='"+esc(ab.blurb)+"'>"+(ab.emoji||"🎭")+" "+esc(ab.name)+"</span>";
  if(ab && !t.abilityKnown && (typeof auditionCost==="function")) acts+="<button class='btn btn-xs btn-alt' onclick='auditionClick(event,"+t.id+")' title='Stage a read to reveal their hidden ability (3% of fee)'>🎭 Audition ("+fmtM(auditionCost(t))+")</button>";
  if(t.ability && !t.abilityKnown) rel+=" <span class='tag' title='Unknown ability — audition or work with them once to find out'>🎭 hidden ability</span>";
  if(typeof toggleWatch==="function") acts+="<button class='btn btn-xs btn-alt' onclick='watchClick(event,"+t.id+")' title='Pin to your watchlist'>"+((G.watchlist||[]).includes(t.id)?"⭐ watching":"☆ watch")+"</button>";
  if(!t.multiDeal && (typeof contractCost==="function")) acts+="<button class='btn btn-xs btn-alt' onclick='contractClick(event,"+t.id+")' title='Lock 3 films at −25% fees'>📜 3-film deal ("+fmtM(contractCost(t))+")</button>";
  if(t.age<=34 && !t.training && (typeof trainCost==="function")) acts+="<button class='btn btn-xs btn-alt' onclick='trainClick(event,"+t.id+")' title='Star school: skill +4-9, maybe +1★ ("+(t.homegrown?"homegrown −30%":"")+")'>🎓 Train ("+fmtM(trainCost(t))+")</button>";
  if(t.retired || t.age>=60 || (stg && stg.s==="Retired")) acts+="<button class='btn btn-xs btn-alt' data-comeback='"+t.id+"' title='Stage a comeback: $1.5M upfront, 60% chance to restore star power'>🌟 Fund Comeback ($1.5M)</button>";
  if(t.kind==="actor" && t.power>=4 && !opts.sel) acts+="<button class='btn btn-xs btn-alt' data-cameo='"+t.id+"' title='Offer cameo in rival project for $500k + rep'>🎭 Offer Cameo ($500k)</button>";
  const pTrend = t.powerHistory || [clamp((t.power||2)-1,1,5), clamp(t.age>45?(t.power||2)+1:(t.power||2)-1,1,5), t.power||2, t.power||2];
  return "<div class='card talent-card"+(opts.sel?" sel-card":"")+"' "+(opts.attr||"")+">"+
    "<div class='t-avatar'>"+(typeof talentAvatarSVG==="function"?talentAvatarSVG(t):icon)+"</div><div style='flex:1'>"+
    "<div class='t-name'>"+esc(t.name)+(t.trait? " <span class='tiny muted'>"+esc(t.trait)+"</span>":"")+"</div>"+
    "<div class='row' style='margin:2px 0'><span class='tag "+stg.cls+"'>"+stg.s+"</span>"+(t.isAnimal?"<span class='tag green' title='Animal star — castable in any film or series'>🐾 "+(t.species?esc(t.species).toUpperCase():"ANIMAL")+"</span>":"")+"</div>"+
    "<div class='row' style='align-items:center;gap:6px'>"+stars(t.power)+renderSparklineSVG(pTrend, {color:'#ffd166', width:36, height:13})+"</div>"+
    "<div class='t-stats'>"+line+
      (t.age? " · <span class='muted'>age "+t.age+"</span>":"")+
      (t.heat? " · <span class='gold'>heat ×"+t.heat+"</span>":"")+
      (t.scandal>0? " · <span class='neg'>⚠ scandal</span>":"")+
      (t.comeback? " · <span class='pos'>comeback</span>":"")+
    "</div>"+(rel? "<div class='row' style='margin-top:4px'>"+rel+"</div>":"")+
    "<div class='tiny muted' style='margin-top:2px'>"+hint+"</div>"+
    "<div class='row' style='margin-top:6px'><span class='tag gold'>💰 "+fmtM(actorFee(t))+"</span>"+
      (opts.sel?"<span class='tag green'>✓ attached</span>":"")+"</div>"+
    (acts? "<div class='row' style='margin-top:6px'>"+acts+"</div>":"")+"</div></div>";
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
/* ═══════════ greenlight desk — the development flow for a film ═══════════
   One shell, five numbered desks and a persistent deal sheet. Every figure is
   read from live studio state; nothing here is decorative. */
const GREENLIGHT_STEPS=[["writer","Writer"],["director","Director"],["cast","Cast"],["producer","Producer"],["deal","Deal"]];

function greenlightRead(){
  const idea=WZ.idea, S=(DATA.SCALES&&DATA.SCALES[idea.scale])||DATA.SCALES.mid;
  const base=idea.script+(WZ.scriptPolish?6:0);
  const wBonus=WZ.writer?writerBonus(WZ.writer,idea.genre):(WZ.aiScript?-(DATA.AI?DATA.AI.scrQualityPenalty:5):0);
  const script=Math.round(clamp(base+wBonus,20,99));
  const dirSkill=WZ.director?WZ.director.skill:50;
  const leads=WZ.aiCast?[]:(WZ.cast||[]);
  const castAvg=leads.length?Math.round(leads.reduce((s,c)=>s+(c.skill||0),0)/leads.length):(WZ.aiCast?45:55);
  const prodSkill=WZ.producer?WZ.producer.skill:45;
  const budget=WZ.budget||Math.round(neededBudget(idea.genre,idea.scale));
  const mkt=recMarketing({budget,scale:idea.scale,genre:idea.genre});
  const quality=Math.round(clamp(script*0.30+dirSkill*0.25+castAvg*0.25+prodSkill*0.10,25,98));
  const dev=devCostOf(idea)+(WZ.scriptPolish?Math.round(devCostOf(idea)*0.4):0);
  const fees=[WZ.writer,WZ.director,WZ.producer].filter(Boolean).reduce((s,c)=>s+actorFee(c),0)+leads.reduce((s,c)=>s+actorFee(c),0);
  const cameoFee=WZ.cameo?Math.round(actorFee(WZ.cameo)*0.3*10)/10:0;
  let packFee=0, packName="";
  if(typeof packagingCost==="function"){
    packFee=packagingCost(leads,budget)||0;
    if(packFee>0 && typeof packagingFeeOf==="function"){ const pa=packagingFeeOf(leads); packName=pa?pa.name:""; }
  }
  const allIn=dev+fees+cameoFee+packFee+budget;
  return {S,base,script,dirSkill,castAvg,prodSkill,budget,mkt,quality,dev,fees,cameoFee,packFee,packName,
    allIn, allInWithMkt:allIn+mkt, fullBreakeven:(allIn+mkt)/0.48, theatricalBreakeven:breakevenWW({budget,marketing:mkt})};
}
function greenlightAside(r){
  const name=t=>t?esc(t.name):"—";
  const leads=WZ.aiCast?[]:(WZ.cast||[]);
  return `<div class="pitch-side-block"><span class="command-eyebrow">THE PICTURE</span>
      ${pitchMoneyRow("Genre",esc((DATA.GENRES[WZ.idea.genre]||{}).name||"—"))}
      ${pitchMoneyRow("Scale",esc(r.S.name))}
      ${pitchMoneyRow("Spec script",String(WZ.idea.script))}
      ${pitchMoneyRow("After the rewrite",String(r.script),r.script>WZ.idea.script?"pos":(r.script<WZ.idea.script?"neg":""))}
      ${pitchMoneyRow("Projected quality",r.quality+"/100")}
      ${pitchMoneyRow("Market heat",(typeof trendOf==="function"?trendOf(WZ.idea.genre):1).toFixed(2)+"×")}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE ROOM</span>
      ${pitchMoneyRow("Writer",WZ.aiScript?"SynthScribe":name(WZ.writer))}
      ${pitchMoneyRow("Director",name(WZ.director))}
      ${pitchMoneyRow("Producer",name(WZ.producer))}
      ${pitchMoneyRow("Leads",WZ.aiCast?"AI cast":(leads.length?leads.map(c=>esc(String(c.name||"").split(" (")[0])).join(" · "):"none"))}
      ${pitchMoneyRow("Cameo",WZ.cameo?esc(WZ.cameo.name):"none")}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE MONEY</span>
      ${pitchMoneyRow("Rights + development",fmtM(r.dev))}
      ${pitchMoneyRow("Talent fees",fmtM(r.fees))}
      ${WZ.cameo?pitchMoneyRow("Cameo (30%)",fmtM(r.cameoFee)):""}
      ${r.packFee>0?pitchMoneyRow("Agency packaging",fmtM(r.packFee)):""}
      ${pitchMoneyRow("Negative cost",fmtM(r.budget))}
      ${pitchMoneyRow("Marketing (P&A)",fmtM(r.mkt))}
      ${pitchMoneyRow("All-in",fmtM(r.allIn))}
      ${pitchMoneyRow("Studio cash",fmtM(G.studio.cash))}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">WATCH OUT</span>
      ${WZ.producer?pitchMoneyRow("Overrun risk","~"+overrunRisk(WZ.producer.skill)+"%/wk"):pitchMoneyRow("Overrun risk","unprotected","neg")}
      ${WZ.presales?pitchMoneyRow("Pre-sales","international sold"):""}
      ${(WZ.cast||[]).some(c=>c.scandal>0)?pitchMoneyRow("Scandal","on the call sheet","neg"):""}
      ${WZ.aiScript||WZ.aiCast?pitchMoneyRow("Guilds","synthetic work flagged","neg"):""}
    </div>`;
}

function wizardModal(){
  if(!WZ || !WZ.idea) return;
  WZ.sub=Math.max(2,Math.min(6,Number(WZ.sub)||2));
  const step=WZ.sub, r=greenlightRead();
  const S=r.S, genre=WZ.idea.genre;
  const title=WZ.idea.title==="(sequel)"? sequelTitle0(WZ) : WZ.idea.title;
  let main="", actions="";

  const held=(owner,role,label,extra)=>owner
    ? `<div class="pitch-held"><div class="pitch-held-main"><small>${label}</small><b>${esc(owner.name)}</b><em>${esc(String(castRoleLabel(owner)))} · skill ${owner.skill||0} · ${fmtM(actorFee(owner))}${extra||""}</em></div><div class="pitch-held-actions"><button class="develop-ghost" data-clearrole="${role}">Remove</button><button class="develop-link" data-pickrole="${role}">Change</button></div></div>`
    : "";
  const browse=(role,count,label)=>`<div class="pitch-inline-note"><span>${count} free ${label} this week</span><button class="develop-link" data-pickrole="${role}">Open the directory →</button></div>`;

  if(step===2){
    const ws=freeTalent("writer").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(writerBonus(b,genre)-writerBonus(a,genre))||b.skill-a.skill);
    main=pitchGroup("THE PAGE",`Skill plus genre fit is worth up to <b>+11 script</b>. This spec reads <b>${r.base}</b>${WZ.writer?` → <b class="pos">${Math.round(clamp(r.base+writerBonus(WZ.writer,genre),20,99))}</b>`:""}.`,
        held(WZ.writer,"writer","WRITER ATTACHED")
        +`<div class="pitch-toggles"><button class="pitch-toggle${WZ.aiScript?" on":""}" id="wzAIw" aria-pressed="${!!WZ.aiScript}"><span>${WZ.aiScript?"✓ SynthScribe is writing it":"Let SynthScribe write it"}</span><small>free · flat ${DATA.AI?DATA.AI.scriptScore:65} page</small></button></div>`
        +(WZ.aiScript
          ? `<div class="pitch-note">No writer's voice: quality −${DATA.AI?DATA.AI.scrQualityPenalty:5}, the guilds heat up (strike risk), and the internet may revolt.</div>`
          : (ws.length
            ? `<div class="pitch-pick-list">${ws.filter(w=>!(WZ.writer&&WZ.writer.id===w.id)).slice(0,8).map(w=>castPickRow(w,{sel:!!(WZ.writer&&WZ.writer.id===w.id),attr:`data-writer="${w.id}"`})).join("")}</div>`+browse("writer",ws.length,"writers")
            : `<div class="command-empty"><b>Every writer in town is booked.</b><small>Shoot the spec as-is, or let SynthScribe take it.</small></div>`)));
    actions=`<button class="develop-ghost" id="wzSkipWriter">Shoot the spec as-is →</button>`
      +((WZ.writer||WZ.aiScript)?`<button class="develop-action" id="wzNext">To director →</button>`:`<span class="pitch-actions-hint">Attach a writer to move on</span>`);
  }

  if(step===3){
    const dirs=freeTalent("director").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(b.power*20+b.skill)-(a.power*20+a.skill));
    main=pitchGroup("THE DIRECTOR",`A director shapes about a quarter of the picture and most of how critics read it.`,
        held(WZ.director,"director","DIRECTOR ATTACHED")
        +(dirs.length
          ? `<div class="pitch-pick-list">${dirs.filter(d=>!(WZ.director&&WZ.director.id===d.id)).slice(0,8).map(d=>castPickRow(d,{sel:!!(WZ.director&&WZ.director.id===d.id),attr:`data-dir="${d.id}"`})).join("")}</div>`+browse("director",dirs.length,"directors")
          : `<div class="command-empty"><b>No director is free.</b><small>Advance a week — the market restocks.</small></div>`))
      +pitchGroup("THE READ",`What this chair does to the picture.`,
        `<div class="pitch-grid4">${pitchStat("DIRECTOR SKILL",(WZ.director?WZ.director.skill:50)+"/100","25% of quality")}${pitchStat("CRITICS","×"+(WZ.director&&WZ.director.genreFit===genre?"1.1 fit":"1.0"),"genre fit")}${pitchStat("OPENING","buzz",(WZ.director&&WZ.director.power>=4?"star director":"standard"))}${pitchStat("FEE",WZ.director?fmtM(actorFee(WZ.director)):"—","upfront")}</div>`);
    actions=`<button class="develop-ghost" id="wzBackWriter">← Writer</button><button class="develop-action" id="wzNext" ${WZ.director?"":"disabled"}>${WZ.director?"Cast the picture →":"Attach a director first"}</button>`;
  }

  if(step===4){
    const allActs=freeTalent("actor").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(b.power*30+b.skill)-(a.power*30+a.skill));
    const f=WZ._cFilter||"all";
    const filt=f==="stars"?allActs.filter(a=>a.power>=5):f==="animals"?allActs.filter(a=>a.isAnimal):allActs;
    const cast=WZ.cast||[];
    const head=filt.slice(0,30);
    const shown=cast.filter(c=>c&&!head.some(t=>t.id===c.id)).concat(filt).slice(0,30);
    const sp=cast.reduce((s,c)=>s+(c.power||0),0);
    main=pitchGroup("THE CALL SHEET",`Three leads carry a picture. Star power drives the opening; skill drives the reviews. Animal stars cast exactly like human leads.`,
        (cast.length?`<div class="pitch-grid4">${pitchStat("LEADS",cast.length+" attached",cast.map(c=>esc(String(c.name||"").split(" (")[0])).join(", "))}${pitchStat("STAR POWER",sp+"★","opening ×"+starOpenMult(sp))}${pitchStat("FEES",fmtM(cast.reduce((s,c)=>s+actorFee(c),0)),"upfront")}${pitchStat("SKILL AVG",Math.round(cast.reduce((s,c)=>s+(c.skill||0),0)/Math.max(1,cast.length))+"/100","quality read")}</div>`:"")
        +`<div class="pitch-filter-row">
            <button class="pitch-filter${f==="all"?" on":""}" data-glcast="all">All <b>${allActs.length}</b></button>
            <button class="pitch-filter${f==="stars"?" on":""}" data-glcast="stars">5★ <b>${allActs.filter(a=>a.power>=5).length}</b></button>
            <button class="pitch-filter${f==="animals"?" on":""}" data-glcast="animals">Animal stars <b>${allActs.filter(a=>a.isAnimal).length}</b></button>
            <button class="pitch-filter" data-pickcast="greenlight">Cast directory <b>${(G.talent||[]).length}</b></button>
          </div>`
        +(WZ.aiCast
          ? `<div class="pitch-note">Synthetic cast attached: no fees, no star opening, audience −${DATA.AI?DATA.AI.audPenalty:6}, and the guilds take note.</div>`
          : `<div class="pitch-pick-list">${shown.map(a=>castPickRow(a,{sel:cast.some(c=>c.id===a.id),attr:`data-cast="${a.id}"`})).join("")||`<div class="command-empty"><b>No performers free.</b><small>Advance a week.</small></div>`}</div>`
            +`<div class="pitch-inline-note"><span>Showing ${shown.length} of ${filt.length} free performers</span><button class="develop-link" data-pickcast="greenlight">Search all ${(G.talent||[]).length} on the books →</button></div>`))
      +pitchGroup("SYNTHETIC CAST",`Fully licensed digital doubles. Cheap, fast, radioactive.`,
        `<button class="pitch-toggle${WZ.aiCast?" on":""}" id="wzAIc" aria-pressed="${!!WZ.aiCast}"><span>${WZ.aiCast?"✓ Synthetic cast attached":"Attach a synthetic cast"}</span><small>fees $0 · audience −${DATA.AI?DATA.AI.audPenalty:6}</small></button>`)
      +pitchGroup("CAMEO",`One superstar in a single scene: 30% of their fee, +6% opening buzz.`,
        WZ.cameo
          ? `<div class="pitch-held"><div class="pitch-held-main"><small>CAMEO BOOKED</small><b>${esc(WZ.cameo.name)}</b><em>${fmtM(Math.round(actorFee(WZ.cameo)*0.3*10)/10)} · +6% opening buzz</em></div><div class="pitch-held-actions"><button class="develop-ghost" data-cameoclear>Remove</button><button class="develop-link" data-pickcameo="greenlight">Change</button></div></div>`
          : `<button class="pitch-toggle" id="wzCameo" aria-pressed="false"><span>Choose a cameo star</span><small>one scene · 30% fee · +6% buzz</small></button>`)
      +(function(){
        const dealStars=(WZ.cast||[]).filter(c=>(c.power||0)>=4);
        if(!dealStars.length) return "";
        WZ.deals=WZ.deals||{};
        return pitchGroup("AGENT PACKAGES",`4★+ stars will trade fee for a slice of the rentals.`,
          `<div class="pitch-toggles">${dealStars.map(c=>{
            const on=WZ.deals[c.id]==="backend";
            return `<button class="pitch-toggle${on?" on":""}" data-deal="${c.id}" aria-pressed="${on}"><span>${esc(c.name)}</span><small>${on?"fee −30% · +2% backend":"flat fee "+fmtM(actorFee(c))}</small></button>`;
          }).join("")}</div>`);
      })();
    actions=`<button class="develop-ghost" id="wzBackDir">← Director</button><button class="develop-action" id="wzNext">${WZ.aiCast?"Continue with AI cast":"Continue with "+((WZ.cast||[]).length)+" lead(s)"} →</button>`;
  }

  if(step===5){
    const prods=freeTalent("producer").sort((a,b)=>(b.skill-a.skill)||(b.power-a.power));
    main=pitchGroup("THE FLOOR",`A producer cuts the odds and the size of <b>cost overruns</b>, squeezes extra production value out of the same budget, and a great one shaves a week off the shoot.`,
        held(WZ.producer,"producer","PRODUCER ATTACHED")
        +(prods.length
          ? `<div class="pitch-pick-list">${prods.filter(p=>!(WZ.producer&&WZ.producer.id===p.id)).slice(0,8).map(p=>castPickRow(p,{sel:!!(WZ.producer&&WZ.producer.id===p.id),attr:`data-prod="${p.id}"`})).join("")}</div>`+browse("producer",prods.length,"producers")
          : `<div class="command-empty"><b>No producers free this week.</b><small>You will be running the floor yourself — overruns land on you.</small></div>`))
      +pitchGroup("THE READ",`What this chair does to the shoot.`,
        `<div class="pitch-grid4">${pitchStat("OVERRUN RISK",(WZ.producer?"~"+overrunRisk(WZ.producer.skill):"~"+overrunRisk(45))+"%/wk",WZ.producer?"smaller hits":"full-size hits",WZ.producer?"good":"bad")}${pitchStat("PRODUCTION VALUE",WZ.producer?(WZ.producer.skill>=80?"+schedule shave":"+"+clamp(Math.round((WZ.producer.skill-55)/6),-3,7)):"none","quality read")}${pitchStat("FEE",WZ.producer?fmtM(actorFee(WZ.producer)):"—","upfront")}${pitchStat("SAVES",WZ.producer?"~"+(WZ.producer.skill>=80?"1 wk":"0 wk"):"0 wk","shoot schedule")}</div>`);
    actions=`<button class="develop-ghost" id="wzBackCast">← Cast</button><button class="develop-action" id="wzNext">Budget &amp; deal →</button>`;
  }

  if(step===6){
    const weeks=S.pre[1]+S.shoot[1]+S.post[1];
    const planned=(WZ.plan||"theatrical");
    const alloc=WZ.alloc||(WZ.alloc={vfx:20,stunts:20,cast:20,music:20,design:20});
    const slices=[{label:"VFX",val:alloc.vfx,color:"#6c5ce7"},{label:"Stunts",val:alloc.stunts,color:"#e17055"},
      {label:"Cast",val:alloc.cast,color:"#ffd166"},{label:"Music",val:alloc.music,color:"#00cec9"},{label:"Design",val:alloc.design,color:"#a29bfe"}];
    const warnings=[];
    if(!WZ.producer) warnings.push("No producer attached — every cost overrun lands on you.");
    if(G.studio.cash<r.dev+r.fees+r.budget*0.2) warnings.push("Cash on hand may not cover the upfront commitment — Finance can arrange a loan.");
    if((WZ.cast||[]).reduce((s,c)=>s+(c.power||0),0)>=8) warnings.push("A-list ensemble: the stars demand 5% of rentals as backend points.");
    main=pitchGroup("NAME &amp; RATING",`Name it now, or let the studio name it on delivery.`,
        `<input id="wzTitle" class="pitch-input" type="text" maxlength="60" placeholder="Untitled picture" value="${esc(WZ.title||"")}" aria-label="Film name">
         <div class="pitch-filter-row" role="group" aria-label="MPAA rating">${DATA.RATINGS.map(rt=>`<button class="pitch-filter${WZ.rating===rt.id?" on":""}" data-rate="${rt.id}" aria-pressed="${WZ.rating===rt.id}">${esc(rt.name)}</button>`).join("")}</div>
         <div class="pitch-note">${esc((DATA.rating(WZ.rating)||{}).desc||"")}</div>`)
      +pitchGroup("THE BUDGET",`Negative cost and where it goes. Marketing is calculated from it at release.`,
        `<div class="pitch-slider"><input type="range" id="wzBudget" min="${S.bMin}" max="${Math.round(S.bMax*1.4)}" step="${S.bMin>=100?5:2}" value="${r.budget}" aria-label="Production budget"><span><b id="wzBudgetV">${fmtM(r.budget)}</b><small>negative cost</small></span></div>
         <div class="pitch-note">Typical ${esc(S.name)} range: ${fmtM(S.bMin)}–${fmtM(S.bMax)}. Genre need ≈ <b>${fmtM(neededBudget(genre,WZ.idea.scale))}</b>; underfunding hurts quality.</div>
         <div class="pitch-alloc"><div class="pitch-alloc-donut">${(typeof renderDonutSVG==="function")?renderDonutSVG(slices,78,10):""}</div>
         <div class="pitch-alloc-sliders">${[["vfx","VFX & spectacle"],["stunts","Stunts & action"],["cast","Cast & performances"],["music","Music & score"],["design","Production design"]].map(([k,label])=>
            `<div class="pitch-slider al-row"><input type="range" class="alSlider" data-al="${k}" min="0" max="50" step="5" value="${alloc[k]}" aria-label="${esc(label)}"><span><b id="al-${k}">${alloc[k]}%</b><small>${esc(label)}</small></span></div>`).join("")}</div></div>
         <div class="pitch-note">VFX lifts spectacle genres · stunts lift action · cast lifts audience · score and design lift critics.</div>`)
      +pitchGroup("THE SHOOT",`Where you shoot decides the rebate, the weather and the festival circuit.`,
        `<div class="pitch-chips">${DATA.LOCATIONS.map(l=>`<button type="button" class="pitch-chip${WZ.location===l.id?" on":""}" data-loc="${l.id}" aria-pressed="${WZ.location===l.id}"><span>${esc(l.name)}</span><small>${Math.round((l.rebate||0)*100)}% rebate${l.cap?" · cap "+fmtM(l.cap):""}</small></button>`).join("")}</div>
         <div class="pitch-note">${esc((DATA.location(WZ.location)||{}).blurb||"")}</div>
         <div class="pitch-toggles"><button class="pitch-toggle${WZ.scriptPolish?" on":""}" id="wzPolish" aria-pressed="${!!WZ.scriptPolish}"><span>${WZ.scriptPolish?"✓ Script polish booked":"Book a script polish"}</span><small>+6 script · +1 wk pre-production</small></button></div>`)
      +pitchGroup("THEME",`Affinity is hidden until you ship a pairing. A great match adds quality and heat; a clash quietly hurts.`,
        `<div class="pitch-chips"><button type="button" class="pitch-chip${!WZ.theme?" on":""}" data-theme="none" aria-pressed="${!WZ.theme}"><span>No theme</span><small>straight genre read</small></button>${(DATA.THEMES||[]).map(th=>{
          const key=DATA.comboKey(genre,th.id), known=(G.comboKnown||{})[key];
          const mark=known==="love"?"⭐":known==="clash"?"✖":"?";
          return `<button type="button" class="pitch-chip${WZ.theme===th.id?" on":""}" data-theme="${th.id}" aria-pressed="${WZ.theme===th.id}"><i>${th.emoji}</i><span>${esc(th.name)}</span><small>affinity ${mark}</small></button>`;
        }).join("")}</div>`)
      +pitchGroup("FESTIVAL ENTRY",`Premiere for buzz · competition needs a regional shoot · auction sells the picture.`,
        `<div class="pitch-chips"><button type="button" class="pitch-chip${!WZ.festStrategy?" on":""}" data-fest="none" aria-pressed="${!WZ.festStrategy}"><span>Direct release</span><small>no festival run</small></button>${(DATA.FESTIVALS||[]).map(f=>`<button type="button" class="pitch-chip${WZ.festStrategy===f.id?" on":""}" data-fest="${f.id}" aria-pressed="${WZ.festStrategy===f.id}"><i>${f.emoji}</i><span>${esc(f.name)}</span><small>prestige ×${f.prestige}</small></button>`).join("")}</div>`
        +(WZ.festStrategy?`<div class="pitch-filter-row">${[["premiere","World premiere"],["competition","Competition"],["auction","Market auction"]].map(([k,label])=>
            `<button class="pitch-filter${(WZ.festMode||"premiere")===k?" on":""}" data-festmode="${k}" aria-pressed="${(WZ.festMode||"premiere")===k}">${label}</button>`).join("")}</div>
          <div class="pitch-note">${esc(((DATA.FESTIVALS||[]).find(f=>f.id===WZ.festStrategy)||{}).blurb||"")}${WZ.location===(((DATA.FESTIVALS||[]).find(f=>f.id===WZ.festStrategy)||{}).region)?"":" Out-of-region entries earn a reduced bump."}</div>`:`<div class="pitch-note">Straight to market — no festival spend, no prestige bump.</div>`))
      +pitchGroup("THE DEAL",`Commit now or keep every door open until the picture is finished.`,
        `<div class="pitch-toggles">
          <button class="pitch-toggle${WZ.plan==="theatrical"?" on":""}" data-plan="theatrical" aria-pressed="${WZ.plan==="theatrical"}"><span>Theatrical release</span><small>box office upside</small></button>
          <button class="pitch-toggle${WZ.plan==="streaming"?" on":""}" data-plan="streaming" aria-pressed="${WZ.plan==="streaming"}"><span>Streaming original</span><small>guaranteed license</small></button>
          ${G.streamer?`<button class="pitch-toggle${WZ.plan==="own"?" on":""}" data-plan="own" aria-pressed="${WZ.plan==="own"}"><span>Own-streamer premiere</span><small>${esc(G.streamer.name)}</small></button>`:""}
          <button class="pitch-toggle${WZ.plan==="later"?" on":""}" data-plan="later" aria-pressed="${WZ.plan==="later"}"><span>Decide later</span><small>keep every door open</small></button>
          ${(planned!=="streaming"&&planned!=="own")?`<button class="pitch-toggle${WZ.presales?" on":""}" id="wzPresale" aria-pressed="${!!WZ.presales}"><span>${WZ.presales?"✓ International pre-sales sold":"Sell international pre-sales"}</span><small>+${fmtM(Math.round(r.budget*0.22))} cash now</small></button>`:""}
        </div>`)
      +((DATA.COPROD_PARTNERS&&WZ.mode==="film")
        ? pitchGroup("CO-PRODUCTION",`Split the budget and the risk with a partner.`,
            `<div class="pitch-toggles"><button class="pitch-toggle${!WZ.coProd||WZ.coProd==="none"?" on":""}" data-coprod="none" aria-pressed="${!WZ.coProd||WZ.coProd==="none"}"><span>No partner</span><small>you keep 100% of net</small></button>${DATA.COPROD_PARTNERS.map(cp=>
              `<button class="pitch-toggle${WZ.coProd===cp.id?" on":""}" data-coprod="${cp.id}" aria-pressed="${WZ.coProd===cp.id}"><span>${esc(cp.name)}</span><small>${cp.pct?"covers "+Math.round(cp.pct*100)+"% · keeps "+Math.round(cp.share*100)+"% of net":esc(cp.blurb||"partner")}</small></button>`).join("")}</div>`)
        : "")
      +pitchGroup("THE COST SHEET",`Every line is live: change the budget or the team and it re-adds — totals and breakeven update as you slide.`,
        `${pitchMoneyRow("Rights + development"+(WZ.scriptPolish?" (incl. polish)":""),fmtM(r.dev))}
         ${pitchMoneyRow("Crew & cast fees (upfront)",fmtM(r.fees))}
         ${WZ.cameo?pitchMoneyRow("🌟 Cameo — "+esc(WZ.cameo.name)+" (30% fee, +6% buzz)",fmtM(r.cameoFee)):""}
         ${r.packFee>0?pitchMoneyRow("Agency packaging fee"+(r.packName?" ("+esc(r.packName)+")":""),fmtM(r.packFee)):""}
         ${pitchMoneyRow("Production (paid weekly over ~"+weeks+" wks)",fmtM(r.budget))}
         ${(WZ.presales&&planned!=="streaming"&&planned!=="own")?pitchMoneyRow("Intl pre-sales (cash now)","+"+fmtM(Math.round(r.budget*0.22)),"pos"):""}
         ${pitchMoneyRow("Suggested marketing (at release)",`<span id="wzMkt">${fmtM(r.mkt)}</span>`)}
         <div class="pitch-line pitch-line-total"><span>Upfront commitment (ex-P&A)</span><b id="wzTot">${fmtM(r.allIn)}</b></div>
         <div class="pitch-line"><span>All-in with P&A</span><b id="wzTotMkt">${fmtM(r.allInWithMkt)}</b></div>
         <div class="pitch-note">Theatrical breakeven (budget+P&A only) ≈ <b>${fmtM(r.theatricalBreakeven)}</b> WW. To recoup the <em>full</em> investment — development, fees, production and P&A — the film needs ≈ <b id="wzBe">${fmtM(r.fullBreakeven)}</b> worldwide gross (exhibitors keep ~52%, studio sees ~48%).</div>`)
      +(warnings.length?`<div class="pitch-warnings">${warnings.map(w=>`<div>⚠ ${esc(w)}</div>`).join("")}</div>`:"");
    actions=`<button class="develop-ghost" id="wzBack">← Producer</button><button class="develop-action" id="wzGo">Greenlight the picture</button>`;
  }

  const v=openModal(pitchShell({
    eyebrow:"STORY DEPARTMENT / GREENLIGHT DESK",
    title:"Greenlight: “"+esc(title||"Untitled")+"”",
    sub:"Spec to call sheet. Every figure is read from your live studio state.",
    badge:`<div class="pitch-head-score"><small>PROJECTED QUALITY</small><b>${r.quality}</b><span>/100</span></div>`,
    steps:GREENLIGHT_STEPS, active:step-2, stepAttr:"glstep",
    main, aside:greenlightAside(r), actions
  }),{className:"command-pitch-modal command-greenlight-modal",onClose:()=>{WZ=null;}});

  v.querySelectorAll("[data-glstep]").forEach(b=>b.onclick=()=>{
    const n=+b.dataset.glstep;
    if(n<=step-2){ WZ.sub=n+2; beep("click"); wizardModal(); }
  });
  v.querySelectorAll("[data-pickrole]").forEach(b=>b.onclick=()=>{
    const role=b.dataset.pickrole;
    openTalentPicker({ role, all:true, multi:false, selected:WZ[role]?[WZ[role]]:[], cap:120,
      title:"Choose a "+role, eyebrow:"STORY DEPARTMENT / GREENLIGHT DESK",
      note:"Every "+role+" on the books, booked or free. The greenlight draft keeps its place.",
      onPick:list=>{ WZ[role]=list[0]||null; }, after:()=>wizardModal() });
  });
  v.querySelectorAll("[data-clearrole]").forEach(b=>b.onclick=()=>{ WZ[b.dataset.clearrole]=null; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-pickcast]").forEach(b=>b.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:true, max:8, selected:WZ.cast||[], cap:150,
    title:"Cast directory", eyebrow:"STORY DEPARTMENT / GREENLIGHT DESK · CALL SHEET",
    note:"Every performer on the books — leads, animal stars and studio partners. Selections land on this call sheet.",
    onPick:list=>{ WZ.cast=list.slice(0,8); }, after:()=>wizardModal() }));
  v.querySelectorAll("[data-pickcameo]").forEach(b=>b.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:false, rowAttr:"data-cameo", selected:WZ.cameo?[WZ.cameo]:[], cap:80,
    title:"Choose a cameo star", eyebrow:"STORY DEPARTMENT / GREENLIGHT DESK · CAMEO",
    note:"One scene, one star: 30% of their fee and +6% opening buzz.",
    onPick:list=>{ WZ.cameo=list[0]||null; }, after:()=>wizardModal() }));
  v.querySelectorAll("[data-glcast]").forEach(b=>b.onclick=()=>{ WZ._cFilter=b.dataset.glcast; beep("click"); wizardModal(); });
  const wtIn=v.querySelector("#wzTitle"); if(wtIn) wtIn.oninput=()=>{ WZ.title=wtIn.value; };
  // v9: budget allocation sliders — others rescale to keep the split at 100%
  v.querySelectorAll(".alSlider").forEach(sl=>sl.oninput=()=>{
    const k=sl.dataset.al; WZ.alloc[k]=+sl.value;
    const others=Object.keys(WZ.alloc).filter(x=>x!==k);
    const rest=100-WZ.alloc[k];
    const osum=others.reduce((s,x)=>s+WZ.alloc[x],0);
    if(osum>0) others.forEach(x=>{ WZ.alloc[x]=Math.max(0,Math.round(WZ.alloc[x]*rest/osum/5)*5); });
    let tot=Object.values(WZ.alloc).reduce((a,b)=>a+b,0);
    WZ.alloc[others[0]]=Math.max(0, WZ.alloc[others[0]]+(100-tot));
    Object.keys(WZ.alloc).forEach(x=>{ const el=$("#al-"+x); if(el) el.textContent=WZ.alloc[x]+"%"; });
  });
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
    if(i>=0){ WZ.cast.splice(i,1); if(WZ.deals) delete WZ.deals[t.id]; }
    else if(WZ.cast.length<3) WZ.cast.push(t);
    beep("click"); wizardModal();
  });
  const wzCameo=v.querySelector("#wzCameo"); if(wzCameo) wzCameo.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:false, rowAttr:"data-cameo", selected:WZ.cameo?[WZ.cameo]:[], cap:80,
    title:"Choose a cameo star", eyebrow:"STORY DEPARTMENT / GREENLIGHT DESK · CAMEO",
    note:"One scene, one star: 30% of their fee and +6% opening buzz. Pick from every performer on the books.",
    onPick:list=>{ WZ.cameo=list[0]||null; }, after:()=>wizardModal() });
  v.querySelectorAll("[data-cameoclear]").forEach(el=>el.onclick=()=>{ WZ.cameo=null; WZ.buzzCameo=false; beep("click"); wizardModal(); });
  v.querySelectorAll("[data-deal]").forEach(el=>el.onclick=()=>{   // v14: agent fee+backend packages
    WZ.deals=WZ.deals||{};
    const id=+el.dataset.deal;
    if(WZ.deals[id]==="backend") delete WZ.deals[id]; else WZ.deals[id]="backend";
    beep("click"); wizardModal();
  });
  v.querySelectorAll("[data-fest]").forEach(b=>b.onclick=()=>{
    WZ.festStrategy = b.dataset.fest==="none"? null : b.dataset.fest;
    beep("click"); wizardModal();
  });
  v.querySelectorAll("[data-festmode]").forEach(b=>b.onclick=()=>{
    WZ.festMode=b.dataset.festmode; beep("click"); wizardModal();
  });
  v.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{
    WZ.theme = b.dataset.theme==="none"? null : b.dataset.theme;
    beep("click"); wizardModal();
  });
  const nx=v.querySelector("#wzNext"); if(nx) nx.onclick=()=>{ WZ.sub=Math.min(6,WZ.sub+1); wizardModal(); };
  const skw=v.querySelector("#wzSkipWriter"); if(skw) skw.onclick=()=>{ WZ.writer=null; WZ.sub=3; wizardModal(); };
  const bw=v.querySelector("#wzBackWriter"); if(bw) bw.onclick=()=>{ WZ.sub=2; wizardModal(); };
  const bd=v.querySelector("#wzBackDir"); if(bd) bd.onclick=()=>{ WZ.sub=3; wizardModal(); };
  const bc=v.querySelector("#wzBackCast"); if(bc) bc.onclick=()=>{ WZ.sub=4; wizardModal(); };
  const bk=v.querySelector("#wzBack"); if(bk) bk.onclick=()=>{ WZ.sub=5; wizardModal(); };
  v.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{ WZ.plan=b.dataset.plan; if(WZ.plan==="streaming"||WZ.plan==="own") WZ.presales=false; beep("click"); wizardModal(); });
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
    const mEl=$("#wzMkt"), tEl=$("#wzTot"), tMktEl=$("#wzTotMkt"), bEl=$("#wzBe");
    let pf=0; if(typeof packagingCost==="function") pf=packagingCost(WZ.cast, WZ.budget);
    const cameoFee=WZ.cameo?Math.round(actorFee(WZ.cameo)*0.3*10)/10:0;
    const feeSum=[WZ.writer,WZ.director,WZ.producer].filter(Boolean).reduce((s,c)=>s+actorFee(c),0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0)+pf+cameoFee;
    const dev=devCostOf(WZ.idea)+(WZ.scriptPolish? Math.round(devCostOf(WZ.idea)*0.4):0);
    const allIn=dev+feeSum+WZ.budget;
    if(mEl) mEl.textContent=fmtM(mkt);
    if(tEl) tEl.textContent=fmtM(allIn);
    if(tMktEl) tMktEl.textContent=fmtM(allIn+mkt);
    if(bEl) bEl.textContent=fmtM((allIn+mkt)/0.48);
  }; }
  const go=v.querySelector("#wzGo");
  if(go) go.onclick=()=>{
    const tIn=v.querySelector("#wzTitle");
    let pf=0; if(typeof packagingCost==="function") pf=packagingCost(WZ.cast, WZ.budget);
    const fees=[WZ.writer,WZ.director,WZ.producer].filter(Boolean).reduce((s,c)=>s+actorFee(c),0)+WZ.cast.reduce((s,c)=>s+actorFee(c),0)+pf
      +(WZ.cameo? Math.round(actorFee(WZ.cameo)*0.3*10)/10 : 0);
    const dev=devCostOf(WZ.idea)+(WZ.scriptPolish? Math.round(devCostOf(WZ.idea)*0.4):0);
    if(G.studio.cash < dev+fees+WZ.budget*0.2){ toast("Not enough cash for upfront costs — visit Finance for a loan.","bad"); beep("bad"); return; }
    greenlight({ idea:WZ.idea, writer:WZ.aiScript? null : WZ.writer, director:WZ.director, producer:WZ.producer, cast:WZ.aiCast? [] : WZ.cast,
      cameo:WZ.cameo,
      budget:WZ.budget, sequelOf:WZ.idea.sequelOf, plan:WZ.plan, presales:WZ.presales,
      deals:WZ.deals||{},
      titleOverride: tIn? (tIn.value.trim()||null) : (WZ.title||null),
      alloc: WZ.alloc,
      rating:WZ.rating, location:WZ.location, scriptPolish:WZ.scriptPolish, premium:WZ.premium,
      aiCast:WZ.aiCast, aiScript:WZ.aiScript, coProd:(WZ.coProd==="none"? null : WZ.coProd),
      crossover: WZ.idea.crossover, spinoffFr: WZ.idea.spinoffFr,
      theme: WZ.theme||null,
      festStrategy: WZ.festStrategy, festMode: WZ.festMode||"premiere", universe: WZ.universe });
    clearUsedCastPin("film",WZ.aiCast? [] : WZ.cast);
    beep("gold"); WZ=null; closeModal(); render();
  };
}
function sequelTitle0(wz){ return wz.idea.sequelOf? sequelTitle(wz.idea.sequelOf.title) : "Sequel"; }
function pick0(a){ return a[Math.floor(Math.random()*a.length)]; }

/* ── series pitch wizard ── */
function startSeriesWizard(){
  WZ={mode:"series", genre:pick(["drama","thriller","scifi","comedy","horror","romance","fantasy","action"]),
      formatId:"standard", eps:8, perEp:6, platform:"streamflix", showrunner:null, cast:[], szStep:0};
  seedPinnedCast("series",WZ);
  seriesModal();
}
function seriesCastToggle(id){
  const t=(typeof talentById==="function")?talentById(+id):null;
  if(!t||!WZ) return;
  WZ.cast=WZ.cast||[];
  const i=WZ.cast.findIndex(c=>c&&c.id===t.id);
  if(i>=0) WZ.cast.splice(i,1);
  else if(WZ.cast.length<4) WZ.cast.push(t);
  else toast("A season carries four leads — remove one first.","bad");
}
function seriesPitchRead(){
  const plat=WZ.platform==="own"? ownPlatformStub() : DATA.platform(WZ.platform);
  const fmt=(DATA.SERIES_FORMATS||[]).find(f=>f.id===WZ.formatId)||null;
  const eps=WZ.eps||8, perEp=WZ.perEp||6, budget=eps*perEp;
  const cast=WZ.cast||[];
  const taste=(plat.taste&&plat.taste[WZ.genre])||1;
  const odds=(WZ.platform==="own"||plat.id==="own")?100:Math.round(clamp(0.22+65/160+(taste-1)*0.6+G.studio.rep/400+(perEp>=8?0.06:0)+(G.upgrades.ottrel?0.05:0),0.12,0.9)*100);
  const fees=(WZ.showrunner?actorFee(WZ.showrunner):0)+cast.reduce((a,c)=>a+actorFee(c),0);
  const concept=clamp(65+G.studio.devBonus*2,40,95);
  const q=clamp(Math.round(0.3*concept+0.25*(WZ.showrunner?WZ.showrunner.skill:56)+0.2*(cast.length?cast.reduce((a,c)=>a+(c.skill||0),0)/cast.length:55)+0.25*(45+55*clamp(perEp/12,0.4,1.1))),10,97);
  return {plat,fmt,eps,perEp,budget,cast,taste,odds,fees,concept,q,
    subs:Math.round((0.5+q/22)*10)/10, license:Math.round(budget*1.15)};
}
function seriesPitchAside(r){
  return `<div class="pitch-side-block"><span class="command-eyebrow">THE ORDER</span>
      ${pitchMoneyRow("Genre",esc((DATA.GENRES[WZ.genre]||{}).name||"—"))}
      ${pitchMoneyRow("Format",esc(r.fmt?r.fmt.name:"Standard Series"))}
      ${pitchMoneyRow("Season",r.eps+" eps × "+fmtM(r.perEp))}
      ${pitchMoneyRow("Season budget",fmtM(r.budget))}
      ${pitchMoneyRow("Showrunner",WZ.showrunner?esc(WZ.showrunner.name):"—")}
      ${pitchMoneyRow("Leads",r.cast.length?r.cast.map(c=>esc(c.name.split(" (")[0])).join(" · "):"None attached")}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE BUYER</span>
      <div class="pitch-buyer"><span class="pitch-buyer-logo">${r.plat.logo||"▶"}</span><div><b>${esc(r.plat.name)}</b><small>${esc(r.plat.blurb||"Streaming platform")}</small></div></div>
      ${pitchMoneyRow("Taste for genre",Math.round(r.taste*100)+"%",r.taste>=1.05?"pos":r.taste<0.95?"neg":"")}
      ${pitchMoneyRow("Greenlight odds","~"+r.odds+"%",r.odds>=55?"pos":r.odds>=35?"":"neg")}
      ${pitchMoneyRow("License if ordered",r.plat.id==="own"?"$0 — weekly ARPU":fmtM(r.license),r.plat.id==="own"?"":"pos")}
      ${r.plat.id==="own"?pitchMoneyRow("Subscribers / season","+"+r.subs+"M","pos"):""}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE READ</span>
      <div class="pitch-score"><b>${r.q}</b><span>/ 100</span><em>projected season quality</em></div>
      ${pitchMoneyRow("Concept",r.concept+"/100")}
      ${pitchMoneyRow("Showrunner",(WZ.showrunner?WZ.showrunner.skill:56)+"/100")}
      ${pitchMoneyRow("Cast skill",(r.cast.length?Math.round(r.cast.reduce((a,c)=>a+(c.skill||0),0)/r.cast.length):55)+"/100")}
      ${pitchMoneyRow("Talent fees",fmtM(r.fees))}
      ${pitchMoneyRow("Studio cash",fmtM(G.studio.cash))}
    </div>`;
}
function seriesModal(){
  if(WZ.szStep==null) WZ.szStep=0;
  WZ.szStep=Math.max(0,Math.min(PITCH_SERIES_STEPS.length-1,WZ.szStep));
  const step=WZ.szStep, r=seriesPitchRead();
  let main="", actions="";

  if(step===0){
    const genreChips=pitchChips(Object.keys(DATA.GENRES).map(g=>({value:g,label:DATA.GENRES[g].name,icon:DATA.GENRES[g].emoji,meta:"×"+(typeof developHeat==="function"?developHeat(g).toFixed(2):"1.00")})),{attr:"data-g",selected:WZ.genre});
    const fmtChips=pitchChips((DATA.SERIES_FORMATS||[]).map(f=>({value:f.id,label:f.name,icon:f.icon,meta:f.eps+" eps · "+fmtM(f.perEp)+"/ep"})),{attr:"data-szfmt",selected:WZ.formatId||"standard"});
    const dirs=freeTalent("director").concat(freeTalent("writer"))
      .sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(b.power*20+b.skill)-(a.power*20+a.skill));
    main=pitchGroup("GENRE & FORMAT",`What the service is buying. Format sets the episode count and per-episode spend.`,genreChips+fmtChips)
      +pitchGroup("THE ORDER",`Episode count and per-episode budget. Premium sits at $8M+ per episode.`,
        `<div class="pitch-slider"><input type="range" id="szEps" min="6" max="10" value="${WZ.eps}" aria-label="Episodes"><span><b id="szEpsV">${WZ.eps} eps</b><small>first season</small></span></div>
         <div class="pitch-slider"><input type="range" id="szPerEp" min="2" max="18" value="${WZ.perEp}" aria-label="Budget per episode"><span><b id="szPerEpV">${fmtM(WZ.perEp)}</b><small>per episode</small></span></div>
         <div class="pitch-note">Season budget <b id="szTotal">${fmtM(WZ.eps*WZ.perEp)}</b> — the service pays roughly 115% of it back as a license if they order.</div>`)
      +pitchGroup("SHOWRUNNER · REQUIRED",`Writers read as prestige TV; directors bring scale. Both run the room.`,
        (WZ.showrunner?`<div class="pitch-held"><div class="pitch-held-main"><small>RUNNING THE ROOM</small><b>${esc(WZ.showrunner.name)}</b><em>${esc(castRoleLabel(WZ.showrunner))} · skill ${WZ.showrunner.skill||0} · ${fmtM(actorFee(WZ.showrunner))}</em></div><div class="pitch-held-actions"><button class="develop-ghost" data-srclear>Remove</button><button class="develop-link" data-pickrole="showrunner">Change</button></div></div>`:"")
        +`<div class="pitch-pick-list">${dirs.slice(0,6).map(t=>castPickRow(t,{sel:!!(WZ.showrunner&&WZ.showrunner.id===t.id),attr:`data-sr="${t.id}"`})).join("")||`<div class="command-empty"><b>No showrunner free.</b><small>Advance a week.</small></div>`}</div>`
        +`<div class="pitch-inline-note"><span>${dirs.length} free writers &amp; directors</span><button class="develop-link" data-pickrole="showrunner">Open the directory →</button></div>`);
    actions=`<button class="develop-ghost" id="szCancel">Cancel</button><button class="develop-action" id="szToCast" ${WZ.showrunner?"":"disabled"}>${WZ.showrunner?"Cast the leads →":"Choose a showrunner first"}</button>`;
  }

  if(step===1){
    const acts=freeTalent("actor").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(b.power*30+b.skill)-(a.power*30+a.skill));
    const pinned=castPinTalent("series");
    const filt=(WZ.szCastFilter==="stars")?acts.filter(a=>a.power>=5):(WZ.szCastFilter==="animals")?acts.filter(a=>a.isAnimal):acts;
    const cast=WZ.cast||[];
    const head=filt.slice(0,80);
    const shown=cast.filter(c=>c&&!head.some(t=>t.id===c.id)).concat(filt).slice(0,80);
    main=pitchGroup("LEADS",`Four leads maximum. Animal stars sit on the same call sheet and lift the same season.`,
        (pinned?`<div class="pitch-note">Pinned from the directory: <b>${esc(pinned.name)}</b></div>`:"")
        +(cast.length?`<div class="pitch-grid4">${pitchStat("LEADS",cast.length+"/4",cast.map(c=>esc(c.name.split(" (")[0])).join(", "))}${pitchStat("STAR POWER",cast.reduce((a,c)=>a+(c.power||0),0)+"★","opening ×"+starOpenMult(cast.reduce((a,c)=>a+(c.power||0),0)))}${pitchStat("FEES",fmtM(cast.reduce((a,c)=>a+actorFee(c),0)),"due at greenlight")}${pitchStat("SKILL AVG",Math.round(cast.reduce((a,c)=>a+(c.skill||0),0)/cast.length)+"/100","quality read")}</div>`:"")
        +`<div class="pitch-filter-row">
            <button class="pitch-filter${!WZ.szCastFilter||WZ.szCastFilter==="all"?" on":""}" data-szf="all">All <b>${acts.length}</b></button>
            <button class="pitch-filter${WZ.szCastFilter==="stars"?" on":""}" data-szf="stars">5★ <b>${acts.filter(a=>a.power>=5).length}</b></button>
            <button class="pitch-filter${WZ.szCastFilter==="animals"?" on":""}" data-szf="animals">Animal stars <b>${acts.filter(a=>a.isAnimal).length}</b></button>
            <button class="pitch-filter" data-pickcast="series">Cast directory <b>${(G.talent||[]).length}</b></button>
          </div>`
        +`<div class="pitch-pick-list">${shown.map(a=>castPickRow(a,{sel:cast.some(c=>c&&c.id===a.id),attr:`data-szcast="${a.id}"`})).join("")||`<div class="command-empty"><b>No performers free.</b><small>Advance a week.</small></div>`}</div>`
        +(filt.length>shown.length?`<div class="pitch-inline-note">Showing the ${shown.length} strongest of ${filt.length} free performers.</div>`:""));
    actions=`<button class="develop-ghost" id="szBackFmt">← Format</button><button class="develop-action" id="szToPlat">${cast.length?"Continue with "+cast.length+" lead(s) →":"Pitch without leads →"}</button>`;
  }

  if(step===2){
    const plats=(G.streamer?[{id:"own",name:G.streamer.name+" (yours)",logo:"▶",blurb:"Your own service — no gatekeeper, paid in subscribers."}]:[]).concat(DATA.PLATFORMS.map(p=>({id:p.id,name:p.name,logo:p.logo,blurb:p.blurb})));
    main=pitchGroup("PLATFORM",`Who buys the season. Each service over-indexes on a different genre.`,
        `<div class="pitch-buyers">${plats.map(p=>`<button class="pitch-buyer-card${WZ.platform===p.id?" on":""}" data-p="${p.id}" aria-pressed="${WZ.platform===p.id}"><span class="pitch-buyer-logo">${p.logo||"▶"}</span><span><b>${esc(p.name)}</b><small>${esc(p.blurb||"")}</small></span>${WZ.platform===p.id?`<em>${r.odds}% odds</em>`:""}</button>`).join("")}</div>`)
      +pitchGroup("THE SERVICE'S TASTE",`How this buyer feels about your genre right now.`,
        `<div class="pitch-grid4">${pitchStat("TASTE",Math.round(r.taste*100)+"%",DATA.GENRES[WZ.genre].name,r.taste>=1.05?"good":r.taste<0.95?"bad":"")}${pitchStat("GREENLIGHT ODDS","~"+r.odds+"%",r.plat.id==="own"?"your own service":"estimate")}${pitchStat("SEASON BUDGET",fmtM(r.budget),r.eps+" eps")}${pitchStat("LICENSE IF ORDERED",r.plat.id==="own"?"ARPU":fmtM(r.license),"≈115% of budget")}</div>`);
    actions=`<button class="develop-ghost" id="szBackCast">← Cast</button><button class="develop-action" id="szToReview">Review the pitch →</button>`;
  }

  if(step===3){
    const warnings=[];
    if(!WZ.showrunner) warnings.push("No showrunner attached — the room has no captain.");
    if(G.studio.cash<r.fees) warnings.push("Cash on hand is short of the talent fees due at greenlight.");
    main=`<div class="pitch-review-hero"><span class="command-eyebrow">READY FOR THE BUYER</span><h4>${esc(WZ.title||"Untitled series")}</h4><p>${esc(DATA.GENRES[WZ.genre].name)} · ${esc(r.fmt?r.fmt.name:"Standard Series")} · ${r.eps} eps × ${fmtM(r.perEp)} · ${esc(r.plat.name)}</p></div>`
      +pitchGroup("SERIES NAME",`Leave it blank and the service titles it on order.`,
        `<input id="szTitle" class="pitch-input" type="text" maxlength="60" placeholder="Untitled series" value="${esc(WZ.title||"")}" aria-label="Series name">`)
      +pitchGroup("THE ORDER","What you are asking the buyer to commit to.",
        `<div class="pitch-grid4">${pitchStat("SEASON BUDGET",fmtM(r.budget),r.eps+" × "+fmtM(r.perEp))}${pitchStat("LICENSE IF ORDERED",r.plat.id==="own"?"ARPU":fmtM(r.license),"≈115% of budget")}${pitchStat("TALENT FEES",fmtM(r.fees),"due at greenlight")}${pitchStat("GREENLIGHT ODDS","~"+r.odds+"%",r.plat.id==="own"?"yours to make":"vs this buyer")}</div>`)
      +pitchGroup("THE ROOM","Everyone the buyer will ask about.",
        `<div class="pitch-roster">
          <div><small>SHOWRUNNER</small><b>${WZ.showrunner?esc(WZ.showrunner.name):"—"}</b><em>${WZ.showrunner?"skill "+WZ.showrunner.skill:""}</em></div>
          <div><small>LEADS</small><b>${r.cast.length?r.cast.length+" attached":"none"}</b><em>${r.cast.map(c=>esc(c.name.split(" (")[0])).join(", ")}</em></div>
          <div><small>GENRE</small><b>${esc(DATA.GENRES[WZ.genre].name)}</b><em>taste ${Math.round(r.taste*100)}%</em></div>
          <div><small>SEASON READ</small><b>${r.q}/100</b><em>projected quality</em></div>
        </div>`)
      +(warnings.length?`<div class="pitch-warnings">${warnings.map(w=>`<div>⚠ ${esc(w)}</div>`).join("")}</div>`:"");
    actions=`<button class="develop-ghost" id="szBackPlat">← Platform</button><button class="develop-action" id="szPitch">Pitch it to ${esc(r.plat.name)}</button>`;
  }

  const v=openModal(pitchShell({
    title:"Pitch a series",
    sub:"Format, room, buyer. One decision path — no gatekeeping you cannot see.",
    eyebrow:"TELEVISION / PITCH STUDIO",
    badge:`<div class="pitch-head-score"><small>ODDS</small><b>${r.odds}</b><span>%</span></div>`,
    steps:PITCH_SERIES_STEPS, active:step, stepAttr:"szstep",
    main, aside:seriesPitchAside(r), actions
  }),{className:"command-pitch-modal",onClose:()=>{WZ=null;}});

  v.querySelectorAll("[data-szstep]").forEach(b=>b.onclick=()=>{ const n=+b.dataset.szstep; if(n<=step){ WZ.szStep=n; beep("click"); seriesModal(); } });
  v.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ WZ.genre=b.dataset.g; beep("click"); seriesModal(); });
  v.querySelectorAll("[data-szfmt]").forEach(b=>b.onclick=()=>{
    const f=(DATA.SERIES_FORMATS||[]).find(x=>x.id===b.dataset.szfmt);
    WZ.formatId=b.dataset.szfmt;
    if(f){ WZ.eps=f.eps; WZ.perEp=f.perEp; }
    beep("click"); seriesModal();
  });
  const e1=v.querySelector("#szEps"); if(e1) e1.oninput=()=>{ WZ.eps=+e1.value; const a=$("#szEpsV"); if(a)a.textContent=WZ.eps+" eps"; const t=$("#szTotal"); if(t)t.textContent=fmtM(WZ.eps*WZ.perEp); };
  const e2=v.querySelector("#szPerEp"); if(e2) e2.oninput=()=>{ WZ.perEp=+e2.value; const a=$("#szPerEpV"); if(a)a.textContent=fmtM(WZ.perEp); const t=$("#szTotal"); if(t)t.textContent=fmtM(WZ.eps*WZ.perEp); };
  v.querySelectorAll("[data-sr]").forEach(el=>el.onclick=()=>{ const t=talentById(+el.dataset.sr); WZ.showrunner=(WZ.showrunner&&WZ.showrunner.id===t.id)?null:t; beep("click"); seriesModal(); });
  v.querySelectorAll("[data-szcast]").forEach(el=>el.onclick=()=>{ seriesCastToggle(el.dataset.szcast); beep("click"); seriesModal(); });
  v.querySelectorAll("[data-szf]").forEach(b=>b.onclick=()=>{ WZ.szCastFilter=b.dataset.szf; beep("click"); seriesModal(); });
  v.querySelectorAll("[data-pickrole]").forEach(b=>b.onclick=()=>{
    openTalentPicker({ role:"showrunner", all:true, multi:false, selected:WZ.showrunner?[WZ.showrunner]:[], cap:120,
      title:"Choose a showrunner", eyebrow:"TELEVISION / PITCH STUDIO · THE ROOM",
      note:"Writers read as prestige TV; directors bring scale. Every writer and director on the books is listed here, booked or free.",
      onPick:list=>{ WZ.showrunner=list[0]||null; }, after:()=>seriesModal() });
  });
  v.querySelectorAll("[data-srclear]").forEach(b=>b.onclick=()=>{ WZ.showrunner=null; beep("click"); seriesModal(); });
  v.querySelectorAll("[data-pickcast]").forEach(b=>b.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:true, max:4, selected:WZ.cast||[], cap:150,
    title:"Cast directory", eyebrow:"TELEVISION / PITCH STUDIO · LEADS",
    note:"Every performer on the books — leads, animal stars and studio partners. Four leads maximum; your pitch keeps its place.",
    onPick:list=>{ WZ.cast=list.slice(0,4); }, after:()=>seriesModal() }));
  v.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{ WZ.platform=b.dataset.p; beep("click"); seriesModal(); });
  const szT=v.querySelector("#szTitle"); if(szT) szT.oninput=()=>{ WZ.title=szT.value; };
  const cancel=v.querySelector("#szCancel"); if(cancel) cancel.onclick=()=>{ beep("click"); WZ=null; closeModal(); };
  const toCast=v.querySelector("#szToCast"); if(toCast) toCast.onclick=()=>{ if(!WZ.showrunner){ toast("Pick a showrunner first.","bad"); return; } WZ.szStep=1; beep("click"); seriesModal(); };
  const backFmt=v.querySelector("#szBackFmt"); if(backFmt) backFmt.onclick=()=>{ WZ.szStep=0; beep("click"); seriesModal(); };
  const toPlat=v.querySelector("#szToPlat"); if(toPlat) toPlat.onclick=()=>{ WZ.szStep=2; beep("click"); seriesModal(); };
  const backCast=v.querySelector("#szBackCast"); if(backCast) backCast.onclick=()=>{ WZ.szStep=1; beep("click"); seriesModal(); };
  const toRev=v.querySelector("#szToReview"); if(toRev) toRev.onclick=()=>{ WZ.szStep=3; beep("click"); seriesModal(); };
  const backPlat=v.querySelector("#szBackPlat"); if(backPlat) backPlat.onclick=()=>{ WZ.szStep=2; beep("click"); seriesModal(); };
  const pit=v.querySelector("#szPitch");
  if(pit) pit.onclick=()=>{
    const tIn=v.querySelector("#szTitle");
    const titleOverride=tIn?(tIn.value.trim()||null):(WZ.title||null);
    const mode={genre:WZ.genre, formatId:WZ.formatId, eps:WZ.eps, perEp:WZ.perEp, platformId:WZ.platform};
    const label=titleOverride||((DATA.GENRES[mode.genre]||{}).name||"Untitled")+" · "+(r.fmt?r.fmt.name:"Series");
    const res=pitchSeries({genre:WZ.genre, formatId:WZ.formatId, eps:WZ.eps, perEp:WZ.perEp, platformId:WZ.platform,
      titleOverride, showrunner:WZ.showrunner, cast:WZ.cast});
    if(res.ok) clearUsedCastPin("series",WZ.cast);
    beep(res.ok?"gold":"bad"); flashes(G.flash);
    WZ=null;
    const platName=mode.platformId==="own"?(G.streamer?G.streamer.name:"your service"):((DATA.PLATFORMS.find(p=>p.id===mode.platformId)||{name:"the platform"}).name);
    pitchResultModal({mode:"series", ok:!!res.ok, label, series:res.s||null, read:r, platform:platName});
  };
}

/* ═══════════ film pitch wizard — like series pitch ═══════════ */
/* ═══════════ talent picker — one directory, opened from every desk ═══════════
   The pitch studio and the greenlight desk both need the whole roster: leads,
   animal stars, directors, writers and producers. This picker layers over the
   desk (the draft stays in WZ), filters the live roster and writes the choice
   back before the desk re-renders. */
let PITCH_PICK=null;

function wzRerender(){
  if(!WZ) return;
  if(WZ.mode==="filmPitch") filmPitchModal();
  else if(WZ.mode==="series") seriesModal();
  else wizardModal();
}
function pickPool(role,all){
  const T=(typeof G!=="undefined"&&G&&Array.isArray(G.talent))?G.talent:[];
  const isCast=(role==="cast"||role==="actor");
  if(all){
    if(isCast) return T.filter(t=>t.kind==="actor");
    if(role==="crew") return T.filter(t=>t.kind==="writer"||t.kind==="director"||t.kind==="producer");
    if(role==="showrunner") return T.filter(t=>t.kind==="writer"||t.kind==="director");
    return T.filter(t=>t.kind===role);
  }
  if(isCast) return (typeof freeTalent==="function")?freeTalent("actor"):[];
  if(role==="showrunner") return freeTalent("director").concat(freeTalent("writer"));
  if(role==="crew") return freeTalent("writer").concat(freeTalent("director")).concat(freeTalent("producer"));
  return (typeof freeTalent==="function")?freeTalent(role):[];
}
function pickerFiltered(){
  const P=PITCH_PICK; if(!P) return [];
  const cfg=P.cfg||{};
  let pool=pickPool(cfg.role,cfg.all);
  const q=String(P.q||"").trim().toLowerCase();
  if(q) pool=pool.filter(t=>String(t.name||"").toLowerCase().includes(q)
    ||String(t.species||"").toLowerCase().includes(q)
    ||String(t.kind||"").toLowerCase().includes(q)
    ||((typeof castRoleLabel==="function")?castRoleLabel(t).toLowerCase().includes(q):false));
  if(P.filter==="free") pool=pool.filter(castIsFree);
  else if(P.filter==="stars") pool=pool.filter(t=>t.power>=5);
  else if(P.filter==="animal") pool=pool.filter(t=>t.isAnimal);
  return pool.sort((a,b)=>((b.power||0)*30+(b.skill||0))-((a.power||0)*30+(a.skill||0)));
}
function pickerChips(){
  const P=PITCH_PICK; if(!P) return "";
  const pool=pickPool(P.cfg.role,P.cfg.all);
  const defs=[["all","Everyone",pool.length],["free","Free now",pool.filter(castIsFree).length],
    ["stars","5★",pool.filter(t=>t.power>=5).length]];
  if(pool.some(t=>t.isAnimal)) defs.push(["animal","Animal stars",pool.filter(t=>t.isAnimal).length]);
  return defs.map(d=>`<button class="pitch-filter${P.filter===d[0]?" on":""}" data-pickfilter="${d[0]}" aria-pressed="${P.filter===d[0]}">${d[1]} <b>${d[2]}</b></button>`).join("");
}
function pickerPaint(){
  const P=PITCH_PICK; if(!P) return;
  const list=document.querySelector("#pickList"); if(!list) return;
  const rows=pickerFiltered(), cap=P.cfg.cap||120, attr=P.cfg.rowAttr||"data-pick";
  const shown=rows.slice(0,cap);
  list.innerHTML=shown.length
    ? shown.map(t=>castPickRow(t,{sel:P.sel.has(t.id),attr:`${attr}="${t.id}"`})).join("")
    : `<div class="command-empty"><b>Nobody matches that.</b><small>Clear the search or widen the filter.</small></div>`;
  list.querySelectorAll(`[${attr}]`).forEach(el=>{
    el.onclick=()=>pickerToggle(el.getAttribute(attr));
  });
  const cnt=document.querySelector("#pickCount");
  if(cnt) cnt.textContent=`${P.sel.size} selected · ${rows.length} match${rows.length===1?"":"es"}${rows.length>shown.length?" · showing "+shown.length:""}`;
  const filters=document.querySelector("#pickFilters");
  if(filters){ filters.innerHTML=pickerChips(); pickerBindFilters(); }
}
function pickerBindFilters(){
  document.querySelectorAll("[data-pickfilter]").forEach(b=>{
    b.onclick=()=>{ if(!PITCH_PICK) return; PITCH_PICK.filter=b.dataset.pickfilter; beep("click"); pickerPaint(); };
  });
}
function pickerToggle(id){
  const P=PITCH_PICK; if(!P) return;
  const t=(typeof talentById==="function")?talentById(+id):null;
  if(!t) return;
  if(!P.cfg.multi){ P.sel=new Set([t.id]); pickerCommit(); return; }
  if(P.sel.has(t.id)) P.sel.delete(t.id);
  else {
    if(P.cfg.max && P.sel.size>=P.cfg.max){ toast("That is the ceiling — remove someone first.","bad"); return; }
    P.sel.add(t.id);
  }
  beep("click"); pickerPaint();
}
function pickerCommit(){
  const P=PITCH_PICK; if(!P) return;
  const cfg=P.cfg, picked=[...P.sel].map(id=>talentById(id)).filter(Boolean);
  PITCH_PICK=null;
  closeModal();
  if(typeof beep==="function") beep("gold");
  if(cfg.onPick) cfg.onPick(picked);
  if(cfg.after) cfg.after();
}
function pickerDismiss(){
  const P=PITCH_PICK; if(!P) return;
  const cfg=P.cfg; PITCH_PICK=null; closeModal();
  if(cfg.after) cfg.after();
}
function openTalentPicker(cfg){
  cfg=cfg||{};
  PITCH_PICK={cfg, filter:"all", q:"", sel:new Set((cfg.selected||[]).filter(Boolean).map(t=>t.id))};
  const total=(G&&Array.isArray(G.talent))?G.talent.length:0;
  const html=`<div class="pitch-shell picker-shell">
    <header class="pitch-head"><div><span class="command-eyebrow">${esc(cfg.eyebrow||"STORY DEPARTMENT / TALENT DIRECTORY")}</span><h3>${esc(cfg.title||"Cast directory")}</h3><p>${esc(cfg.note||"Every performer on the books — human, animal and crew. Pick here and the desk keeps your draft.")}</p></div><div class="pitch-head-score"><small>ON THE BOOKS</small><b>${total}</b><span>people</span></div></header>
    <div class="picker-bar"><input id="pickQ" class="pitch-input" type="search" placeholder="Search a name, a role or a species" aria-label="Search the talent directory" autocomplete="off"><div class="pitch-filter-row" id="pickFilters" data-built="all">${pickerChips()}</div></div>
    <div class="picker-list-wrap"><div class="pitch-pick-list picker-list" id="pickList"></div></div>
    <footer class="pitch-actions"><button class="develop-ghost" id="pickCancel">Cancel</button><span class="picker-count" id="pickCount"></span><button class="develop-action" id="pickDone">${cfg.multi?"Add to the call sheet":"Choose"}</button></footer>
  </div>`;
  const v=openModal(html,{className:"command-pitch-modal command-talent-picker",onClose:()=>{PITCH_PICK=null; if(cfg.after) cfg.after();}});
  const q=v.querySelector("#pickQ");
  if(q) q.oninput=()=>{ if(!PITCH_PICK) return; PITCH_PICK.q=q.value; pickerPaint(); };
  pickerBindFilters();
  const done=v.querySelector("#pickDone"); if(done) done.onclick=()=>pickerCommit();
  const cancel=v.querySelector("#pickCancel"); if(cancel) cancel.onclick=()=>pickerDismiss();
  const first=v.querySelector(".cast-pick");
  if(first) first.focus({preventScroll:true});
  pickerPaint();
}

/* ═══════════ pitch studio — one shell for film & series pitches ═══════════ */
const PITCH_FILM_STEPS=[["concept","Concept"],["team","Team"],["cast","Cast"],["release","Release"],["review","Review"]];
const PITCH_SERIES_STEPS=[["format","Format"],["cast","Cast"],["platform","Platform"],["review","Review"]];
function pitchShell(opts){
  const steps=opts.steps||[], active=opts.active||0;
  const rail=steps.map((st,i)=>`<button class="pitch-step${i===active?" on":""}${i<active?" done":""}" ${opts.stepAttr?`data-${opts.stepAttr}="${i}"`:"disabled"} aria-current="${i===active?"step":"false"}"><small>${String(i+1).padStart(2,"0")}</small><span>${st[1]}</span></button>`).join("");
  return `<div class="pitch-shell">
    <header class="pitch-head"><div><span class="command-eyebrow">${opts.eyebrow||"STORY DEPARTMENT / PITCH STUDIO"}</span><h3>${opts.title}</h3><p>${opts.sub||""}</p></div>${opts.badge||""}</header>
    <nav class="pitch-steps" aria-label="Pitch steps">${rail}</nav>
    <div class="pitch-body${opts.aside?"":" solo"}">
      <section class="pitch-main">${opts.main}</section>
      ${opts.aside?`<aside class="pitch-aside">${opts.aside}</aside>`:""}
    </div>
    <footer class="pitch-actions">${opts.actions||""}</footer>
  </div>`;
}
function pitchGroup(label,desc,body){
  return `<section class="pitch-group"><header><span class="command-eyebrow">${label}</span>${desc?`<p>${desc}</p>`:""}</header>${body}</section>`;
}
function pitchChips(items,opts){
  opts=opts||{};
  return `<div class="pitch-chips">${items.map(it=>`<button type="button" class="pitch-chip${opts.selected===it.value?" on":""}" ${opts.attr}="${it.value}" aria-pressed="${opts.selected===it.value}">${it.icon?`<i>${it.icon}</i>`:""}<span>${it.label}</span>${it.meta?`<small>${it.meta}</small>`:""}</button>`).join("")}</div>`;
}
function pitchStat(label,value,note,cls){
  return `<div class="pitch-stat${cls?" "+cls:""}"><small>${label}</small><b>${value}</b>${note?`<em>${note}</em>`:""}</div>`;
}
function pitchMoneyRow(label,value,cls){
  return `<div class="pitch-line"><span>${label}</span><b class="${cls||""}">${value}</b></div>`;
}
function filmPitchEconomics(){
  const S=DATA.SCALES[WZ.scale]||DATA.SCALES.mid;
  const g=DATA.GENRES[WZ.genre]||DATA.GENRES.action;
  const dir=WZ.director, writer=WZ.writer, cast=WZ.cast||[];
  const budget=WZ.budget||Math.round(neededBudget(WZ.genre,WZ.scale));
  const mkt=recMarketing({budget,scale:WZ.scale,genre:WZ.genre});
  const fees=[dir,writer,WZ.producer].filter(Boolean).reduce((a,t)=>a+actorFee(t),0)+cast.reduce((a,c)=>a+actorFee(c),0);
  const totalCost=devCostOf({scale:WZ.scale,genre:WZ.genre,hot:false,script:65})+budget+mkt+fees;
  const trend=(typeof trendPull==="function")?trendPull(WZ.genre):1;
  const openEst=S.openBase*g.mass*trend*(WZ.rating==="R"?0.88:1.0)*(WZ.imax?1.08:1.0)*(WZ.premium?1.12:1.0)*(G.infl||1);
  const legsEst=clamp(2.2+g.legsAdj+0.02*(dir?dir.skill:55),1.45,4.4);
  const wwEst=openEst*legsEst/(1-g.intlShare);
  const revenue=Math.round(wwEst*0.48);
  const profit=Math.round(revenue-totalCost);
  const be=(budget+mkt)/0.48;
  const commercial=clamp(Math.round(wwEst/be*50),5,99);
  const critical=clamp(Math.round((dir?dir.skill:55)*0.4+(writer?writer.skill:55)*0.3+30+g.critic),5,99);
  const audience=clamp(Math.round((dir?dir.skill:55)*0.3+cast.reduce((a,c)=>a+c.power,0)*0.2+35+g.aud),5,99);
  const risk=Math.round(clamp((budget/S.bMax)*40+(WZ.rating==="R"?10:0)+(trend<0.94?15:0)+(WZ.scale==="tentpole"?10:0),5,99));
  const franchise=clamp(Math.round(g.merch*45+(WZ.scale==="tentpole"?25:WZ.scale==="mid"?10:0)),5,99);
  const score=Math.round(commercial*0.35+critical*0.2+audience*0.25+(100-risk)*0.2);
  const verdict=score>=70?"Board-ready":score>=50?"Viable, with caveats":"Likely a pass";
  return {commercial,critical,audience,risk,franchise,score,verdict,cost:Math.round(totalCost),revenue,profit,
    be:Math.round(be),openEst:Math.round(openEst*10)/10,legsEst:Math.round(legsEst*100)/100,
    wwEst:Math.round(wwEst),budget,mkt,fees};
}
function filmPitchAside(ev){
  const cast=WZ.cast||[];
  const read=(v)=>v>=65?"pos":v<45?"neg":"";
  return `<div class="pitch-side-block"><span class="command-eyebrow">THE PACKAGE</span>
      ${pitchMoneyRow("Genre",esc((DATA.GENRES[WZ.genre]||{}).name||"—"))}
      ${pitchMoneyRow("Scale",esc((DATA.SCALES[WZ.scale]||{}).name||"—"))}
      ${pitchMoneyRow("Budget",fmtM(ev.budget))}
      ${pitchMoneyRow("Director",WZ.director?esc(WZ.director.name):"—")}
      ${pitchMoneyRow("Writer",WZ.writer?esc(WZ.writer.name):(WZ.aiScript?"SynthScribe":"Spec as-is"))}
      ${pitchMoneyRow("Producer",WZ.producer?esc(WZ.producer.name):"Not attached")}
      ${pitchMoneyRow("Cast",cast.length?cast.map(c=>esc(c.name.split(" (")[0])).join(" · "):"No leads")}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE MONEY</span>
      ${pitchMoneyRow("Negative cost",fmtM(ev.budget))}
      ${pitchMoneyRow("Marketing (P&A)",fmtM(ev.mkt))}
      ${pitchMoneyRow("Talent fees",fmtM(ev.fees))}
      ${pitchMoneyRow("All-in",fmtM(ev.cost))}
      ${pitchMoneyRow("Studio cash",fmtM(G.studio.cash))}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE READ</span>
      <div class="pitch-score"><b>${ev.score}</b><span>/ 100</span><em>${esc(ev.verdict)}</em></div>
      ${pitchMoneyRow("Commercial",ev.commercial+"/100",read(ev.commercial))}
      ${pitchMoneyRow("Critical",ev.critical+"/100",read(ev.critical))}
      ${pitchMoneyRow("Audience",ev.audience+"/100",read(ev.audience))}
      ${pitchMoneyRow("Risk",ev.risk+"/100",ev.risk>=65?"neg":ev.risk<40?"pos":"")}
      ${pitchMoneyRow("Franchise",ev.franchise+"/100")}
    </div>
    <div class="pitch-side-block"><span class="command-eyebrow">THE FORECAST</span>
      ${pitchMoneyRow("Opening (domestic)",fmtG(ev.openEst))}
      ${pitchMoneyRow("Legs",ev.legsEst+"×")}
      ${pitchMoneyRow("Worldwide",fmtG(ev.wwEst))}
      ${pitchMoneyRow("Studio share",fmtM(ev.revenue))}
      ${pitchMoneyRow("Projected profit",(ev.profit>=0?"+":"")+fmtM(ev.profit),ev.profit>=0?"pos":"neg")}
      ${pitchMoneyRow("Breakeven WW",fmtG(ev.be))}
    </div>`;
}

/* ═══════════ board verdict — the animated result of every pitch ═══════════ */
function pitchVerdictCopy(o){
  if(o.mode==="series"){
    if(o.ok) return {state:"accepted", stamp:"ORDERED", head:"The service ordered the season.", sub:(o.platform||"The platform")+" committed to the full order.", tone:"good"};
    return {state:"rejected", stamp:"PASSED", head:"The service passed on the pitch.", sub:(o.platform||"The platform")+" is not buying this one — yet.", tone:"bad"};
  }
  if(o.board) return {state:"board", stamp:"BOARD VOTE FAILED", head:"The board voted it down.", sub:o.boardNote||"A tentpole needs a majority. Win the room back, or pitch smaller.", tone:"warn"};
  if(o.ok) return {state:"accepted", stamp:"ACCEPTED", head:"The board greenlit the picture.", sub:"Development starts now. The call sheet goes out this week.", tone:"good"};
  return {state:"rejected", stamp:"REJECTED", head:"The board passed.", sub:"The pitch did not clear. Nothing was spent beyond the pitch.", tone:"bad"};
}
function pitchResultModal(o){
  const c=pitchVerdictCopy(o);
  const ev=o.ev||{};
  const score=Math.round(ev.score||0);
  const rows=[];
  if(o.mode==="film"){
    rows.push(["Picture",esc(o.label)]);
    rows.push(["Package",esc((DATA.GENRES[o.genre]||{}).name||"")+(o.project?" · "+esc(o.project.rating):"")]);
    if(o.project) rows.push(["Budget",fmtM(o.project.budget||0)]);
    rows.push(["Board read",score+"/100 — "+esc(ev.verdict||c.state)]);
    rows.push(["Projected profit",((ev.profit||0)>=0?"+":"")+fmtM(ev.profit||0)]);
    rows.push(["Breakeven WW",fmtG(ev.be||0)]);
  }else{
    const r=o.read||{};
    rows.push(["Series",esc(o.label)]);
    rows.push(["Order",r.eps+" eps × "+fmtM(r.perEp||0)]);
    rows.push(["Buyer",esc(o.platform||"")]);
    rows.push(["Season budget",fmtM(r.budget||0)]);
    rows.push(["Season read",(r.q||0)+"/100"]);
    rows.push([o.ok?"License":"Odds","~"+ (r.odds||0) +"% pitch odds"]);
  }
  const tally=o.board?"❌ ❌ ❌ ✅ ❌":null;
  const html=`<div class="verdict" data-verdict="${c.state}">
    <div class="verdict-glow" aria-hidden="true"></div>
    <header class="verdict-head">
      <span class="command-eyebrow">${o.mode==="series"?"TELEVISION / BUYER DECISION":"DEVELOPMENT / BOARD ROOM"}</span>
      <h3>${c.head}</h3>
      <p>${esc(c.sub)}</p>
    </header>
    <div class="verdict-stamp-wrap"><div class="verdict-stamp ${c.tone}"><b>${c.stamp}</b><small>${o.mode==="series"?"NOTICE OF DECISION":"BOARD RESOLUTION"}</small></div></div>
    ${tally?`<div class="verdict-tally">${tally.split(" ").map((v,i)=>`<span style="--i:${i}">${v}</span>`).join("")}</div>`:""}
    <div class="verdict-rows">${rows.map((r,i)=>`<div class="verdict-row" style="--i:${i}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>
    <div class="verdict-meter" aria-hidden="true"><span style="--pct:${Math.max(4,Math.min(100,score||(o.read?o.read.q:0)))}%"></span></div>
    <footer class="verdict-actions">
      <button class="develop-ghost" id="vdAgain">${o.ok?"Pitch another":"Try again"}</button>
      <button class="develop-action" id="vdGo">${o.ok?(o.mode==="series"?"See the series slate":"Open the production slate"):"Back to the writers' room"}</button>
    </footer>
  </div>`;
  const v=openModal(html,{className:"command-pitch-modal command-verdict-modal",onClose:()=>{}});
  const anim=v.querySelector(".verdict");
  requestAnimationFrame(()=>{ if(anim) anim.classList.add("play"); });
  if(typeof motionOK==="function" && !motionOK()){ if(anim) anim.classList.add("nofx"); }
  const again=v.querySelector("#vdAgain");
  if(again) again.onclick=()=>{ beep("click"); closeModal(); if(o.mode==="series") startSeriesWizard(); else { switchTab("develop"); startFilmPitchWizard(); } };
  const go=v.querySelector("#vdGo");
  if(go) go.onclick=()=>{
    beep(o.ok?"gold":"click"); closeModal();
    if(o.mode==="series"){ if(o.ok){ switchTab("studiolot"); } else { switchTab("develop"); DEVELOP_SUB="scripts"; render(); } }
    else if(o.ok){ switchTab("productions"); }
    else { switchTab("develop"); DEVELOP_SUB="scripts"; render(); }
  };
}

function startFilmPitchWizard(){
  WZ={mode:"filmPitch", genre:pick(Object.keys(DATA.GENRES)),
      scale:"mid", budget:0, rating:"PG-13", location:"home", pattern:"wide", rollout:"day", window:45,
      imax:false, premium:false, soundtrack:false, dayAndDate:false, scriptPolish:false,
      coProduction:false, coProdPartner:null,
      cameo:false,
      director:null, writer:null, producer:null, cast:[]};
  seedPinnedCast("film",WZ);
  filmPitchModal();
}
function filmPitchModal(){
  if(WZ.fpStep==null) WZ.fpStep=0;
  WZ.fpStep=Math.max(0,Math.min(PITCH_FILM_STEPS.length-1,WZ.fpStep));
  const step=WZ.fpStep, ev=filmPitchEconomics();
  const S=DATA.SCALES[WZ.scale]||DATA.SCALES.mid;
  let main="", aside=filmPitchAside(ev), actions="";

  if(step===0){
    const genreChips=pitchChips(Object.keys(DATA.GENRES).map(g=>({value:g,label:DATA.GENRES[g].name,icon:DATA.GENRES[g].emoji,meta:(typeof developHeat==="function"?"×"+developHeat(g).toFixed(2):"")})),{attr:"data-g",selected:WZ.genre});
    const scaleChips=pitchChips(Object.keys(DATA.SCALES).map(k=>({value:k,label:DATA.SCALES[k].name,icon:DATA.SCALES[k].emoji,meta:"from "+fmtM(DATA.SCALES[k].bMin)})),{attr:"data-s",selected:WZ.scale});
    const budget=WZ.budget||Math.round(neededBudget(WZ.genre,WZ.scale));
    main=pitchGroup("GENRE",`What the market is buying this week. Hotter genres open bigger.`,genreChips)
      +pitchGroup("SCALE","How big the bet is. Tentpoles need a board vote.",scaleChips)
      +pitchGroup("BUDGET","The negative cost. Marketing is calculated from it and added on the review screen.",
        `<div class="pitch-slider"><input type="range" id="fpBudget" min="${S.bMin}" max="${Math.round(S.bMax*1.4)}" step="${S.bMin>=100?5:2}" value="${budget}" aria-label="Production budget"><span><b id="fpBudgetV">${fmtM(budget)}</b><small>negative cost</small></span></div>`)
      +`<div class="pitch-note">A ${esc(DATA.GENRES[WZ.genre].name)} picture at ${esc(S.name)} scale wants about ${fmtM(Math.round(neededBudget(WZ.genre,WZ.scale)))}. Market heat this week: ×${(typeof developHeat==="function"?developHeat(WZ.genre):1).toFixed(2)}.</div>`;
    actions=`<button class="develop-ghost" id="fpCancel">Cancel</button><button class="develop-action" id="fpNext" data-fpnext="1">Choose the team →</button>`;
  }

  if(step===1){
    const dirs=freeTalent("director").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(b.power*20+b.skill)-(a.power*20+a.skill));
    const ws=freeTalent("writer").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(writerBonus(b,WZ.genre)-writerBonus(a,WZ.genre))||b.skill-a.skill);
    const prods=freeTalent("producer").sort((a,b)=>(b.skill-a.skill)||(b.power-a.power));
    const held=(owner,role,label)=>owner
      ? `<div class="pitch-held"><div class="pitch-held-main"><small>${label}</small><b>${esc(owner.name)}</b><em>skill ${owner.skill||0} · ${fmtM(actorFee(owner))}${owner.isAnimal?" · 🐾":""}</em></div><div class="pitch-held-actions"><button class="develop-ghost" data-clearrole="${role}">Remove</button><button class="develop-link" data-pickrole="${role}">Change</button></div></div>`
      : "";
    const short=(list,owner,attr,cap)=>list.filter(t=>!(owner&&owner.id===t.id)).slice(0,cap||4).map(t=>castPickRow(t,{sel:!!(owner&&owner.id===t.id),attr:`${attr}="${t.id}"`})).join("")
      ||`<div class="command-empty"><b>Nobody else free for this chair.</b><small>Open the directory or advance a week.</small></div>`;
    const browse=(role,count,label)=>`<div class="pitch-inline-note"><span>${count} free ${label} this week</span><button class="develop-link" data-pickrole="${role}">Open the directory →</button></div>`;
    const chair=(role,label,owner,list)=>`<div class="pitch-chair"><small>${label}</small><b>${owner?esc(owner.name):"Not attached"}</b><em>${owner?("skill "+(owner.skill||0)+" · "+fmtM(actorFee(owner))):(list.length+" free this week")}</em><button class="develop-ghost" data-pickrole="${role}">${owner?"Change":"Choose"}</button></div>`;
    main=`<div class="pitch-team-strip">${chair("director","DIRECTOR · REQUIRED",WZ.director,dirs)}${chair("writer","WRITER · OPTIONAL",WZ.aiScript?null:WZ.writer,ws)}${chair("producer","PRODUCER · RECOMMENDED",WZ.producer,prods)}</div>`
      +pitchGroup("DIRECTOR · REQUIRED",
        `A director shapes about a quarter of the film's quality and its critics read.`,
        held(WZ.director,"director","DIRECTOR ATTACHED")
        +`<div class="pitch-pick-list">${short(dirs,WZ.director,"data-fpd",3)}</div>`+browse("director",dirs.length,"directors"))
      +pitchGroup("WRITER · OPTIONAL",
        `The page is about 30% of quality. Skill plus genre fit is worth up to +11 script.`,
        held(WZ.writer,"writer","WRITER ATTACHED")
        +`<button class="pitch-toggle${WZ.aiScript?" on":""}" id="fpAIw" aria-pressed="${!!WZ.aiScript}"><span>${WZ.aiScript?"✓ SynthScribe writes it":"Let SynthScribe write it"}</span><small>free · flat page · guild heat</small></button>`
        +(WZ.aiScript
          ? `<div class="pitch-note">SynthScribe delivers a flat ${DATA.AI?DATA.AI.scriptScore:65} page, −${DATA.AI?DATA.AI.scrQualityPenalty:5} craft, and the guilds notice.</div>`
          : `<div class="pitch-pick-list">${short(ws,WZ.writer,"data-fpw",3)}</div>`+browse("writer",ws.length,"writers")))
      +pitchGroup("PRODUCER · RECOMMENDED",
        `A producer lowers overrun risk and shaves wasted weeks. Without one, every overrun lands on you.`,
        held(WZ.producer,"producer","PRODUCER ATTACHED")
        +`<div class="pitch-pick-list">${short(prods,WZ.producer,"data-fpp",3)}</div>`+browse("producer",prods.length,"producers"));
    actions=`<button class="develop-ghost" id="fpBack">← Concept</button><button class="develop-action" data-fpnext="2" ${WZ.director?"":"disabled"}>${WZ.director?"Cast the film →":"Attach a director first"}</button>`;
  }

  if(step===2){
    const allActs=freeTalent("actor").sort((a,b)=>Number(!!activePicturePact(b))-Number(!!activePicturePact(a))||(b.power*30+b.skill)-(a.power*30+a.skill));
    const filt=(WZ._cFilter==="stars")?allActs.filter(a=>a.power>=5):(WZ._cFilter==="animals")?allActs.filter(a=>a.isAnimal):allActs;
    const cast=WZ.cast||[];
    const head=filt.slice(0,24);
    const shown=cast.filter(c=>c&&!head.some(t=>t.id===c.id)).concat(filt).slice(0,24);
    const cameoFee=WZ.cameo?Math.round(actorFee(WZ.cameo)*0.3*10)/10:0;
    main=pitchGroup("LEADS",
        `Up to eight leads. Star power multiplies the opening; skill carries the reviews. Animal stars cast exactly like human leads.`,
        (cast.length?`<div class="pitch-grid4">${pitchStat("LEADS",cast.length+"/8",cast.map(c=>esc(String(c.name||"").split(" (")[0])).join(", "))}${pitchStat("STAR POWER",cast.reduce((a,c)=>a+(c.power||0),0)+"★","opening ×"+starOpenMult(cast.reduce((a,c)=>a+(c.power||0),0)))}${pitchStat("FEES",fmtM(cast.reduce((a,c)=>a+actorFee(c),0)),"due at greenlight")}${pitchStat("SKILL AVG",Math.round(cast.reduce((a,c)=>a+(c.skill||0),0)/Math.max(1,cast.length))+"/100","quality read")}</div>`:"")
        +`<div class="pitch-filter-row">
          <button class="pitch-filter${!WZ._cFilter||WZ._cFilter==="all"?" on":""}" data-fpcastfilter="all">All <b>${allActs.length}</b></button>
          <button class="pitch-filter${WZ._cFilter==="stars"?" on":""}" data-fpcastfilter="stars">5★ <b>${allActs.filter(a=>a.power>=5).length}</b></button>
          <button class="pitch-filter${WZ._cFilter==="animals"?" on":""}" data-fpcastfilter="animals">Animal stars <b>${allActs.filter(a=>a.isAnimal).length}</b></button>
          <button class="pitch-filter" data-pickcast="film">Cast directory <b>${(G.talent||[]).length}</b></button>
        </div>`
        +`<div class="pitch-pick-list">${shown.map(a=>castPickRow(a,{sel:cast.some(c=>c.id===a.id),attr:`data-fpc="${a.id}"`})).join("")||`<div class="command-empty"><b>No performers free.</b><small>Advance a week.</small></div>`}</div>`
        +`<div class="pitch-inline-note"><span>Showing ${shown.length} of ${filt.length} free performers</span><button class="develop-link" data-pickcast="film">Search all ${(G.talent||[]).length} on the books →</button></div>`)
      +pitchGroup("CAMEO",
        `One superstar in a single scene: 30% of their fee, +6% opening buzz.`,
        WZ.cameo
          ? `<div class="pitch-held"><div class="pitch-held-main"><small>CAMEO BOOKED</small><b>${esc(WZ.cameo.name)}</b><em>${fmtM(cameoFee)} · +6% opening buzz</em></div><div class="pitch-held-actions"><button class="develop-ghost" id="fpCameoClear">Remove</button><button class="develop-link" data-pickcameo="film">Change</button></div></div>`
          : `<button class="pitch-toggle" id="fpCameo" aria-pressed="false"><span>Choose a cameo star</span><small>one scene · 30% fee · +6% buzz</small></button>`);
    actions=`<button class="develop-ghost" id="fpBack">← Team</button><button class="develop-action" data-fpnext="3">Distribution →</button>`;
  }

  if(step===3){
    main=pitchGroup("RATING",`The certificate changes who buys a ticket. R trims the opening but sharpens the reviews.`,
        pitchChips(DATA.RATINGS.map(r=>({value:r.id,label:r.id,icon:r.emoji})),{attr:"data-r",selected:WZ.rating}))
      +pitchGroup("SHOOT",`Rebates come back as cash during the shoot. Caps apply.`,
        pitchChips(DATA.LOCATIONS.map(l=>({value:l.id,label:l.name,meta:l.rebate+"% rebate"+(l.cap?" · cap "+fmtM(l.cap):"")})),{attr:"data-l",selected:WZ.location}))
      +pitchGroup("RELEASE PATTERN",`How wide you open.`,
        pitchChips(DATA.PATTERNS.map(p=>({value:p.id,label:p.label})),{attr:"data-pat",selected:WZ.pattern}))
      +pitchGroup("INTERNATIONAL ROLLOUT",`Day-and-date opens everywhere at once; a staggered rollout builds word of mouth.`,
        pitchChips(DATA.ROLLOUTS.map(r=>({value:r.id,label:r.label})),{attr:"data-roll",selected:WZ.rollout}))
      +pitchGroup("STREAMING WINDOW",`Days before it can stream. A short window trades theatrical legs for streaming cash.`,
        pitchChips(DATA.WINDOWS.map(w=>({value:String(w.d),label:w.label})),{attr:"data-win",selected:String(WZ.window)}))
      +pitchGroup("PACKAGE EXTRAS","Each choice adds cost or reach on the review screen.",
        `<div class="pitch-toggles">
          <button class="pitch-toggle${WZ.imax?" on":""}" data-imax><span>${WZ.imax?"✓ ":""}IMAX &amp; premium screens</span><small>opening +8%</small></button>
          <button class="pitch-toggle${WZ.premium?" on":""}" data-premium><span>${WZ.premium?"✓ ":""}Premium format</span><small>opening +12%</small></button>
          <button class="pitch-toggle${WZ.soundtrack?" on":""}" data-soundtrack><span>${WZ.soundtrack?"✓ ":""}Soundtrack release</span><small>merch &amp; buzz</small></button>
          <button class="pitch-toggle${WZ.dayAndDate?" on":""}" data-dad><span>${WZ.dayAndDate?"✓ ":""}Day-and-date</span><small>streaming day one</small></button>
          <button class="pitch-toggle${WZ.scriptPolish?" on":""}" data-polish><span>${WZ.scriptPolish?"✓ ":""}Script polish</span><small>+6 script, +40% dev cost</small></button>
          <button class="pitch-toggle${WZ.coProduction?" on":""}" data-coprod><span>${WZ.coProduction?"✓ ":""}Co-production</span><small>a partner covers the risk</small></button>
        </div>`
        +(WZ.coProduction?pitchGroup("CO-PRODUCTION PARTNER","They wire their share through production and keep a slice of net.",
          pitchChips(DATA.COPRO_PARTNERS.map(p=>({value:p.id,label:p.name,icon:p.emoji,meta:Math.round((p.pct||0)*100)+"% of budget"})),{attr:"data-cp",selected:WZ.coProdPartner})):""));
    actions=`<button class="develop-ghost" id="fpBack">← Cast</button><button class="develop-action" data-fpnext="4">Review the package →</button>`;
  }

  if(step===4){
    const dir=WZ.director, cast=WZ.cast||[];
    const warnings=[];
    if(!dir) warnings.push("No director attached — the pitch cannot go to the board.");
    if(G.studio.cash<ev.budget*0.2+ev.fees) warnings.push("Cash on hand may not cover the upfront costs — Finance can arrange a loan.");
    if(WZ.scale==="tentpole") warnings.push("Tentpoles go to a full board vote. Expect a tally, not a rubber stamp.");
    main=`<div class="pitch-review-hero"><span class="command-eyebrow">READY FOR THE BOARD</span><h4>${esc(WZ.title||"Untitled picture")}</h4><p>${esc(DATA.GENRES[WZ.genre].name)} · ${esc(S.name)} · ${fmtM(ev.budget)} negative · ${WZ.rating} · shoots ${esc((DATA.LOCATIONS.find(l=>l.id===WZ.location)||{name:"the home lot"}).name)}</p></div>`
      +pitchGroup("PICTURE NAME",`Leave it blank and the studio titles it on acceptance.`,
        `<input id="fpTitle" class="pitch-input" type="text" maxlength="60" placeholder="Untitled picture" value="${esc(WZ.title||"")}" aria-label="Film name">`)
      +pitchGroup("THE TEAM","Everyone who has to say yes.",
        `<div class="pitch-roster">
          <div><small>DIRECTOR</small><b>${dir?esc(dir.name):"—"}</b><em>${dir?"skill "+dir.skill:""}</em></div>
          <div><small>WRITER</small><b>${WZ.aiScript?"SynthScribe":(WZ.writer?esc(WZ.writer.name):"Spec as-is")}</b><em>${WZ.writer?"skill "+WZ.writer.skill:""}</em></div>
          <div><small>PRODUCER</small><b>${WZ.producer?esc(WZ.producer.name):"—"}</b><em>${WZ.producer?"skill "+WZ.producer.skill:""}</em></div>
          <div><small>LEADS</small><b>${cast.length?cast.length+" attached":"none"}</b><em>${cast.map(c=>esc(c.name.split(" (")[0])).join(", ")}</em></div>
        </div>`)
      +pitchGroup("THE NUMBERS","Real state, not projections of projections.",
        `<div class="pitch-grid4">
          ${pitchStat("NEGATIVE COST",fmtM(ev.budget),"budget")}
          ${pitchStat("ALL-IN",fmtM(ev.cost),"incl. P&A + fees")}
          ${pitchStat("BREAKEVEN WW",fmtG(ev.be),"to recoup")}
          ${pitchStat("PROJECTED PROFIT",(ev.profit>=0?"+":"")+fmtM(ev.profit),"studio share",ev.profit>=0?"good":"bad")}
        </div>`)
      +(warnings.length?`<div class="pitch-warnings">${warnings.map(w=>`<div>⚠ ${esc(w)}</div>`).join("")}</div>`:"");
    actions=`<button class="develop-ghost" id="fpBack">← Release</button><button class="develop-action" id="fpGo">Take it to the board</button>`;
  }

  const v=openModal(pitchShell({
    title:"Pitch a film",
    sub:"Concept to call sheet. Every figure comes from your live studio state.",
    badge:`<div class="pitch-head-score"><small>ROOM READ</small><b>${ev.score}</b><span>/100</span></div>`,
    steps:PITCH_FILM_STEPS, active:step, stepAttr:"fpstep",
    main, aside, actions
  }),{className:"command-pitch-modal",onClose:()=>{WZ=null;}});

  /* wiring */
  v.querySelectorAll("[data-fpstep]").forEach(b=>b.onclick=()=>{ const n=+b.dataset.fpstep; if(n<=step){ WZ.fpStep=n; beep("click"); filmPitchModal(); } });
  v.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{ WZ.genre=b.dataset.g; WZ.budget=Math.round(neededBudget(WZ.genre,WZ.scale)); beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{ WZ.scale=b.dataset.s; WZ.budget=Math.round(neededBudget(WZ.genre,WZ.scale)); beep("click"); filmPitchModal(); });
  const bud=v.querySelector("#fpBudget");
  if(bud) bud.oninput=()=>{ WZ.budget=+bud.value; const el=$("#fpBudgetV"); if(el) el.textContent=fmtM(WZ.budget); };
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
  v.querySelectorAll("[data-coprod]").forEach(b=>b.onclick=()=>{ WZ.coProduction=!WZ.coProduction; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-cp]").forEach(b=>b.onclick=()=>{ WZ.coProdPartner=b.dataset.cp; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-fpd]").forEach(el=>el.onclick=()=>{ const t=talentById(+el.dataset.fpd); WZ.director=(WZ.director&&WZ.director.id===t.id)?null:t; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-fpw]").forEach(el=>el.onclick=()=>{ const t=talentById(+el.dataset.fpw); WZ.writer=(WZ.writer&&WZ.writer.id===t.id)?null:t; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-fpp]").forEach(el=>el.onclick=()=>{ const t=talentById(+el.dataset.fpp); WZ.producer=(WZ.producer&&WZ.producer.id===t.id)?null:t; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-fpc]").forEach(el=>el.onclick=()=>{
    const t=talentById(+el.dataset.fpc); if(!t) return;
    const i=WZ.cast.findIndex(c=>c.id===t.id);
    if(i>=0) WZ.cast.splice(i,1);
    else if(WZ.cast.length<8) WZ.cast.push(t);
    else toast("Eight leads is the ceiling — remove one first.","bad");
    beep("click"); filmPitchModal();
  });
  v.querySelectorAll("[data-fpcastfilter]").forEach(b=>b.onclick=()=>{ WZ._cFilter=b.dataset.fpcastfilter; beep("click"); filmPitchModal(); });
  const aiw=v.querySelector("#fpAIw"); if(aiw) aiw.onclick=()=>{ WZ.aiScript=!WZ.aiScript; if(WZ.aiScript) WZ.writer=null; beep("click"); filmPitchModal(); };
  const cm=v.querySelector("#fpCameo"); if(cm) cm.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:false, rowAttr:"data-cameo", selected:WZ.cameo?[WZ.cameo]:[], cap:80,
    title:"Choose a cameo star", eyebrow:"STORY DEPARTMENT / PITCH STUDIO · CAMEO",
    note:"One scene, one star: 30% of their fee and +6% opening buzz. Leads already on the call sheet are not offered twice.",
    onPick:list=>{ WZ.cameo=list[0]||null; }, after:()=>filmPitchModal() });
  const cmClear=v.querySelector("#fpCameoClear"); if(cmClear) cmClear.onclick=()=>{ WZ.cameo=null; beep("click"); filmPitchModal(); };
  v.querySelectorAll("[data-pickrole]").forEach(b=>b.onclick=()=>{
    const role=b.dataset.pickrole;
    openTalentPicker({ role, all:true, multi:false, selected:WZ[role]?[WZ[role]]:[], cap:120,
      title:"Choose a "+role, eyebrow:"STORY DEPARTMENT / PITCH STUDIO",
      note:"The whole roster, not just this week's shortlist. Booked people can be attached — the schedule absorbs it.",
      onPick:list=>{ WZ[role]=list[0]||null; }, after:()=>filmPitchModal() });
  });
  v.querySelectorAll("[data-clearrole]").forEach(b=>b.onclick=()=>{ WZ[b.dataset.clearrole]=null; beep("click"); filmPitchModal(); });
  v.querySelectorAll("[data-pickcast]").forEach(b=>b.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:true, max:8, selected:WZ.cast||[], cap:150,
    title:"Cast directory", eyebrow:"STORY DEPARTMENT / PITCH STUDIO · LEADS",
    note:"Every performer on the books — leads, animal stars and studio partners. Selections go straight onto this call sheet; your pitch keeps its place.",
    onPick:list=>{ WZ.cast=list.slice(0,8); }, after:()=>filmPitchModal() }));
  v.querySelectorAll("[data-pickcameo]").forEach(b=>b.onclick=()=>openTalentPicker({
    role:"cast", all:true, multi:false, rowAttr:"data-cameo", selected:WZ.cameo?[WZ.cameo]:[], cap:80,
    title:"Choose a cameo star", eyebrow:"STORY DEPARTMENT / PITCH STUDIO · CAMEO",
    note:"One scene, one star: 30% of their fee and +6% opening buzz.",
    onPick:list=>{ WZ.cameo=list[0]||null; }, after:()=>filmPitchModal() }));
  const fpT=v.querySelector("#fpTitle"); if(fpT) fpT.oninput=()=>{ WZ.title=fpT.value; };
  v.querySelectorAll("[data-fpnext]").forEach(b=>b.onclick=()=>{ WZ.fpStep=+b.dataset.fpnext; beep("click"); filmPitchModal(); });
  const back=v.querySelector("#fpBack"); if(back) back.onclick=()=>{ WZ.fpStep=Math.max(0,step-1); beep("click"); filmPitchModal(); };
  const cancel=v.querySelector("#fpCancel"); if(cancel) cancel.onclick=()=>{ WZ=null; closeModal(); };
  const go=v.querySelector("#fpGo");
  if(go) go.onclick=()=>{
    const tIn=v.querySelector("#fpTitle");
    const cfg={titleOverride:tIn?(tIn.value.trim()||null):(WZ.title||null), genre:WZ.genre, scale:WZ.scale, budget:WZ.budget||Math.round(neededBudget(WZ.genre,WZ.scale)),
      rating:WZ.rating, location:WZ.location, pattern:WZ.pattern, rollout:WZ.rollout, window:WZ.window,
      imax:WZ.imax, premium:WZ.premium, soundtrack:WZ.soundtrack, dayAndDate:WZ.dayAndDate,
      scriptPolish:WZ.scriptPolish, director:WZ.director, writer:WZ.aiScript?null:WZ.writer, producer:WZ.producer, cast:WZ.cast,
      coProduction:WZ.coProduction, coProdPartner:WZ.coProdPartner, cameo:WZ.cameo||null};
    const label=cfg.titleOverride||((DATA.GENRES[cfg.genre]||{}).name||"Untitled")+" · "+((DATA.SCALES[cfg.scale]||{}).name||"Picture");
    const res=pitchFilm(cfg);
    if(res.ok) clearUsedCastPin("film",WZ.cast);
    beep(res.ok?"gold":"bad"); flashes(G.flash);
    WZ=null;
    pitchResultModal({
      mode:"film", ok:!!res.ok, board:!!res.board, label:(res.project&&res.project.title)||cfg.titleOverride||label, genre:cfg.genre,
      ev:res.ev||ev, project:res.project||null,
      boardNote:res.board?"The tentpole needed a full board vote and did not clear it.":""
    });
  };
}

/* ═══════════ VIEW: productions ═══════════ */
/* ═══════════ v7: acquired media (M&A firesales + libraries) ═══════════ */
function acquiredMediaSection(){
  if(typeof maSlateFilms!=="function") return "";
  let items=[]; try{ items=maSlateFilms(); }catch(e){ return ""; }
  if(!items.length) return "";
  const vaultFilms = typeof maVaultActive==="function" ? maVaultActive() : [];
  const vaultVal = typeof maVaultValue==="function" ? maVaultValue() : 0;

  let h="<div class='section-title'>Acquired media ("+items.length+")</div>"+
    "<div class='tiny muted' style='margin:-4px 0 8px'>Films picked up through M&amp;A — re-date the release, license them to a streamer for cash, or put them on your own platform.</div>";

  if(vaultFilms.length >= 2){
    const buyoutVal = Math.round(vaultVal * 2.3 * 10) / 10;
    h+="<div class='card' style='background:linear-gradient(135deg,rgba(245,185,66,.08),rgba(180,139,255,.05));border-color:rgba(245,185,66,.3);margin-bottom:12px'>"+
      "<div class='spread'><div><b>🏛 Acquired Vault Portfolio ("+vaultFilms.length+" titles)</b>"+
      "<div class='tiny muted'>Catalog valuation: <b class='gold'>"+fmtM(vaultVal)+"</b> · Instant buyout: <b class='pos'>"+fmtM(buyoutVal)+"</b></div></div>"+
      "<div class='row' style='gap:6px'>"+
      "<button class='btn btn-sm btn-alt' id='btnMaBrowse'>📖 Browse vault</button>"+
      "<button class='btn btn-sm btn-primary' id='btnMaBulkSell'>💰 Sell Outright ("+fmtM(buyoutVal)+")</button>"+
      "<button class='btn btn-sm btn-alt' id='btnMaBulkLicense'>📺 Bulk Streamer Deal</button>"+
      "<button class='btn btn-sm btn-ghost' id='btnMaFlipRival'>🤝 Flip to Rival</button>"+
      "</div></div></div>";
  }

  items.forEach(m=>{
    const bids=(typeof maLicenseBids==="function")? maLicenseBids(m.ref):[];
    const bidTop=bids.length? Math.max.apply(null, bids.map(b=>b.value)):0;
    h+="<div class='card'><div class='spread'><div style='min-width:0'>"+
      "<b>"+(DATA.GENRES[m.genre]?DATA.GENRES[m.genre].emoji:"🎬")+" "+esc(m.title)+"</b> "+(m.src==="rival"?"<span class='tag gold'>firesale</span>":"<span class='tag blue'>library</span>")+
      "<div class='tiny muted'>"+(DATA.GENRES[m.genre]?DATA.GENRES[m.genre].name:m.genre)+" · quality "+Math.round(m.quality)+" · est. opening "+fmtG(m.weight)+" dom"+
      (m.week>G.week? " · opens "+dateLabel(m.week) : " · in theaters now")+"</div></div>"+
      "<div style='text-align:right'><div class='tiny gold'>best bid ~"+fmtM(bidTop)+"</div><div class='tiny muted'>"+bids.length+" suitors</div></div></div>"+
      "<div class='row' style='margin-top:8px'>"+
      (m.week>G.week? "<button class='btn btn-sm btn-alt' data-madate='"+m.src+":"+m.id+"'>📅 Re-date</button>":"")+
      "<button class='btn btn-sm btn-primary' data-masell='"+m.src+":"+m.id+"'>📺 License / Stream</button></div></div>";
  });
  return h;
}
function maDateModal(src,id){
  const e=maFind(src,id); if(!e) return;
  const opts=[["In 2 wks",2],["In 6 wks",6],["In 12 wks",12],["Next quarter",26]];
  let h="<h3>📅 Re-date “"+esc(e.title)+"”</h3>"+
    "<div class='tiny muted' style='margin-bottom:10px'>Currently slated for "+dateLabel(e.week)+". Later dates dodge crowded weekends but cool buzz; avoid clashing with your own dated releases.</div>"+
    "<div class='plan-pick'>";
  opts.forEach(o=>{
    const wk=G.week+o[1];
    h+="<div class='plan-opt' data-maweek='"+wk+"'><h5>"+o[0]+" — "+dateLabel(wk)+"</h5><div class='p-sub'>"+DATA.seasonOf(woyOf(wk)).month+" · corridor ×"+DATA.seasonOf(woyOf(wk)).season.toFixed(2)+"</div></div>";
  });
  h+="</div><div class='modal-actions'><button class='btn btn-ghost' id='maDateClose'>Cancel</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-maweek]").forEach(el=>el.onclick=()=>{
    if(maMove(src,id,+el.dataset.maweek)){ beep("gold"); toast("📅 Release re-dated","good"); }
    closeModal(); render();
  });
  const c=v.querySelector("#maDateClose"); if(c) c.onclick=closeModal;
}
function maSellModal(src,id){
  const e=maFind(src,id); if(!e) return;
  const bids=maLicenseBids(e.ref);
  let h="<h3>📺 License “"+esc(e.title)+"”</h3>"+
    "<div class='tiny muted' style='margin-bottom:10px'>"+(DATA.GENRES[e.genre]?DATA.GENRES[e.genre].name:e.genre)+" · quality "+Math.round(e.quality)+" · est. opening "+fmtG(e.weight)+" dom. Upfront license instead of a theatrical run — the platform keeps the streaming upside.</div>";
  bids.forEach((b,i)=>{
    const pl=DATA.platform(b.platform);
    const tasteVal = (pl.taste && pl.taste[e.genre]) || 1;
    const tasteLabel = tasteVal >= 1.2 ? "<span class='tag green'>high appetite</span>" : tasteVal <= 0.85 ? "<span class='tag red'>low fit</span>" : "<span class='tag'>neutral</span>";
    h+="<div class='bid-card' data-mabid='"+i+"'><div class='platform-logo' style='background:"+pl.color+"'>"+pl.logo+"</div>"+
      "<div style='flex:1;min-width:0'><b>"+esc(pl.name)+"</b> "+tasteLabel+"<div class='tiny muted'>upfront license · paid immediately</div></div>"+
      "<b class='pos' style='font-size:16px'>"+fmtM(b.value)+"</b></div>";
  });
  if(G.streamer) h+="<div class='bid-card' data-maown='1'><div class='platform-logo' style='background:var(--purple)'>▶</div>"+
    "<div style='flex:1;min-width:0'><b>Put on "+esc(G.streamer.name)+"</b><div class='tiny muted'>no upfront cash — feeds your own library, +subs</div></div>"+
    "<span class='tag purple'>yours</span></div>";
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='maSellClose'>Keep theatrical</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-mabid]").forEach(el=>el.onclick=()=>{
    if(maAcceptLicense(src,id,+el.dataset.mabid)){ beep("gold"); toast("🤝 Licensed — cash wired","gold"); }
    closeModal(); render();
  });
  const own=v.querySelector("[data-maown]");
  if(own) own.onclick=()=>{
    if(maToOwnStreamer(src,id)){ beep("gold"); toast("▶ Streaming on your platform","good"); }
    closeModal(); render();
  };
  const c=v.querySelector("#maSellClose"); if(c) c.onclick=closeModal;
}
function maBulkLicenseModal(){
  const films = typeof maVaultActive==="function" ? maVaultActive() : [];
  if(!films.length) return;
  const val = typeof maVaultValue==="function" ? maVaultValue() : 0;
  let h="<h3>📺 Bulk Streaming Package Deal</h3>"+
    "<div class='tiny muted' style='margin-bottom:10px'>Bundle all "+films.length+" acquired catalog films into one master output package for an upfront licensing windfall.</div>";
  DATA.PLATFORMS.slice(0,5).forEach(pl=>{
    const pkgVal = Math.max(4, Math.round(val * 1.18 * (pl.generosity||1.0) * 10) / 10);
    h+="<div class='bid-card' data-mabulkplat='"+pl.id+"'><div class='platform-logo' style='background:"+pl.color+"'>"+pl.logo+"</div>"+
      "<div style='flex:1;min-width:0'><b>"+esc(pl.name)+"</b><div class='tiny muted'>"+pl.blurb+" · 15% package bonus</div></div>"+
      "<b class='pos' style='font-size:16px'>"+fmtM(pkgVal)+"</b></div>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='maBulkClose'>Cancel</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-mabulkplat]").forEach(el=>el.onclick=()=>{
    const pid = el.dataset.mabulkplat;
    const earned = maBulkLicense(pid);
    if(earned){ beep("cash"); toast("📺 Bulk package deal wired: +"+fmtM(earned),"gold"); }
    closeModal(); render();
  });
  const c=v.querySelector("#maBulkClose"); if(c) c.onclick=closeModal;
}
function maFlipRivalModal(){
  const films = typeof maVaultActive==="function" ? maVaultActive() : [];
  if(!films.length) return;
  const val = typeof maVaultValue==="function" ? maVaultValue() : 0;
  let h="<h3>🤝 Flip Catalog to Rival Studio</h3>"+
    "<div class='tiny muted' style='margin-bottom:10px'>Offload the entire "+films.length+"-film vault package to a competitor for quick liquidity. Tap a rival's 🪙 to lowball — 40% chance they take −25%.</div>";
  (G.rivals||[]).forEach(r=>{
    const flipVal = Math.round(val * 2.1 * 10) / 10;
    h+="<div class='bid-card' data-marival='"+esc(r.name)+"'><div class='platform-logo' style='background:"+r.color+"'>⚔️</div>"+
      "<div style='flex:1;min-width:0'><b>"+esc(r.name)+"</b><div class='tiny muted'>Buys package outright into their library</div></div>"+
      "<div class='row' style='gap:6px'><button class='btn btn-xs btn-ghost' data-macounter='"+esc(r.name)+"' title='Counter-offer: 40% chance they accept −25%'>🪙 −25%</button>"+
      "<b class='pos' style='font-size:16px'>"+fmtM(flipVal)+"</b></div></div>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='maFlipClose'>Cancel</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-marival]").forEach(el=>el.onclick=(e)=>{
    if(e.target.closest("[data-macounter]")) return;   // counter button handles itself
    const rname = el.dataset.marival;
    const earned = maSellToRival(rname);
    if(earned){ beep("cash"); toast("🤝 Vault flipped to "+rname+": +"+fmtM(earned),"gold"); }
    closeModal(); render();
  });
  v.querySelectorAll("[data-macounter]").forEach(el=>el.onclick=(e)=>{
    e.stopPropagation();
    const rname = el.dataset.macounter;
    const ok = maCounterRival(rname);
    if(ok){ beep("cash"); } else { beep("bad"); }
    closeModal(); render();
  });
  const c=v.querySelector("#maFlipClose"); if(c) c.onclick=closeModal;
}

/* v28.9: M&A library browser — sortable vault with per-film value breakdown */
function maVaultBrowser(sortKey){
  const films = typeof maVaultActive==="function" ? maVaultActive() : [];
  if(!films.length){ toast("Vault is empty — acquire a library from the M&A desk first.","bad"); return; }
  sortKey = sortKey || "value";
  const rows = films.map(f=>{
    const g=DATA.GENRES[f.genre]||{};
    const legs=clamp(1.6+(f.quality-30)*0.028+(g.legsAdj||0),1.45,3.8);
    const intl=clamp((g.intlShare)||0.5,0.1,0.85);
    const estWW=(f.opening||f.weight||6)*legs/(1-intl);
    const val=Math.max(1.5,Math.round(estWW*0.35*10)/10);
    return {f, legs:Math.round(legs*100)/100, estWW:Math.round(estWW*10)/10, val};
  });
  rows.sort((a,b)=>{
    if(sortKey==="quality") return b.f.quality-a.f.quality;
    if(sortKey==="title") return a.f.title.localeCompare(b.f.title);
    if(sortKey==="date") return (a.f.week||0)-(b.f.week||0);
    return b.val-a.val;
  });
  const total=rows.reduce((s,r)=>s+r.val,0);
  const sorts=[["value","💰 Value"],["quality","⭐ Quality"],["date","📅 Date"],["title","🔤 Title"]];
  let h="<h3>📖 Vault Browser — "+films.length+" titles</h3>"+
    "<div class='tiny muted' style='margin-bottom:8px'>Catalog value <b class='gold'>"+fmtM(Math.round(total*10)/10)+"</b> · valuation = projected WW × 35% library rate. Sort:</div>"+
    "<div class='row' style='gap:4px;margin-bottom:8px'>"+sorts.map(s=>"<button class='btn btn-xs "+(sortKey===s[0]?"btn-primary":"btn-alt")+"' data-masort='"+s[0]+"'>"+s[1]+"</button>").join("")+"</div>"+
    "<div style='max-height:340px;overflow-y:auto;overscroll-behavior:contain'>";
  rows.forEach(r=>{
    h+="<div class='card' style='margin-bottom:6px'><div class='spread'>"+
      "<div style='min-width:0'><b>"+(DATA.GENRES[r.f.genre]?DATA.GENRES[r.f.genre].emoji:"🎬")+" "+esc(r.f.title)+"</b>"+
      "<div class='tiny muted'>"+(DATA.GENRES[r.f.genre]?DATA.GENRES[r.f.genre].name:r.f.genre)+" · quality "+Math.round(r.f.quality)+" · est. open "+fmtG(r.f.opening||r.f.weight||6)+
      " · legs ×"+r.legs+" · est. WW "+fmtG(r.estWW)+(r.f.week&&r.f.week>G.week?" · opens "+dateLabel(r.f.week):"")+"</div></div>"+
      "<b class='gold'>"+fmtM(r.val)+"</b></div></div>";
  });
  h+="</div><div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-masort]").forEach(b=>b.onclick=()=>{ beep("click"); maVaultBrowser(b.dataset.masort); });
}

/* ═══════════ v8: week summary popup (pops after every Next Week) ═══════════ */
let WKSNAP=null;
function weekSummaryModal(){
  if(!WKSNAP) return;
  if(localStorage.getItem("bow_wksum")==="0" || AUTO){ WKSNAP=null; return; }
  const snap=WKSNAP; WKSNAP=null;
  const delta=Math.round((G.studio.cash-snap.cash)*10)/10;
  const news=G.news.filter(n=>n.w>G.week-snap.weeks).slice(0,7);
  const opened=G.films.filter(f=>f.releaseWeek && f.releaseWeek>G.week-snap.weeks && f.releaseWeek<=G.week);
  const live=G.films.filter(f=>f.inTheaters);
  const warns=(typeof opsWarnings==="function")? opsWarnings() : [];
  const isQuarter = (G.week % 13 === 0);
  const wantPopup = localStorage.getItem("bow_wksum") === "1" || opened.length > 0 || isQuarter || warns.length > 0;
  if(!wantPopup) return;

  const head='<div class="produce-modal-head"><span class="command-eyebrow">'+
      (snap.weeks>1? snap.weeks+" WEEKS LATER" : "THIS WEEK")+' / Y'+yearOf(G.week)+' · '+esc(DATA.seasonOf(woyOf(G.week)).month)+' W'+woyOf(G.week)+'</span>'+
    '<h3 class="'+(delta>=0?"pos":"neg")+'" style="font:600 30px/1.1 Georgia,serif">'+(delta>=0?"+":"−")+fmtM(Math.abs(delta))+'</h3>'+
    '<p>Net cash movement · '+(delta>=0?"the ledger likes you":"it happens to everyone")+'. '+
      (opened.length?opened.length+" picture"+(opened.length===1?"":"s")+" opened.":"Nothing opened this week.")+'</p></div>';

  let body='<div class="produce-modal-body">';
  if(opened.length){
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>OPENED THIS WEEK</b><span>'+opened.length+' release'+(opened.length===1?"":"s")+'</span></div><div class="bo-track-rows">'+
      opened.slice(0,4).map(f=>'<div class="bo-track-row"><span class="bo-track-label">'+esc(f.title)+'</span><span class="bo-track-val">'+fmtG(f.opening||0)+'<small>opening</small></span></div>').join("")+
    '</div></div>';
  }
  if(live.length){
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>IN THEATERS</b><span>'+live.length+' running</span></div><div class="bo-track-rows">'+
      live.slice(0,4).map(f=>'<div class="bo-track-row"><span class="bo-track-label">'+esc(f.title)+'</span><span class="bo-track-val">'+fmtG(f.ww||0)+'<small>worldwide</small></span></div>').join("")+
    '</div></div>';
  }
  if(news.length){
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>THE TRADE PAPERS</b><span>'+news.length+' stor'+(news.length===1?"y":"ies")+'</span></div><div class="bo-news">'+
      news.map(n=>'<div class="bo-news-row">'+n.t+'</div>').join("")+
    '</div></div>';
  }
  if(warns.length){
    body+='<div class="bo-callout bad"><b>WARNINGS ('+warns.length+')</b>'+
      warns.slice(0,5).map(w=>'<p>'+w+'</p>').join("")+'</div>';
  }
  body+='</div>';

  const foot='<div class="produce-modal-actions"><div class="bo-week-jump">'+
      '<button class="produce-ghost" data-wk-tab="studio">🏛 Studio</button>'+
      '<button class="produce-ghost" data-wk-tab="productions">🎬 Films</button>'+
      '<button class="produce-ghost" data-wk-tab="boxoffice">📊 Box office</button>'+
      '<button class="produce-ghost" data-wk-tab="develop">📝 Develop</button>'+
    '</div><div class="row" style="margin:0;gap:8px"><button class="produce-action" id="wkGo">Onward →</button></div></div>';

  const v=openModal(head+body+foot,{className:"command-produce-modal"});
  v.querySelectorAll("[data-wk-tab]").forEach(b=>b.onclick=()=>{ closeModal(); switchTab(b.dataset.wkTab); });
  const go=v.querySelector("#wkGo"); if(go) go.onclick=closeModal;
}

/* ═══════════ v8: rename anything ═══════════ */
function renameModal(kind,id){
  let cur="", title="";
  if(kind==="f"){ const f=G.films.find(x=>x.id===+id); cur=f&&f.title; title="Rename film"; }
  else if(kind==="s"){ const s=G.series.find(x=>x.id===+id); cur=s&&s.title; title="Rename series"; }
  else if(kind==="st"){ return rebrandStreamerModal(); }
  if(cur==null) return;
  let h="<h3>✏️ "+title+"</h3>"+
    "<input id='rnInput' type='text' maxlength='60' value='"+esc(cur)+"' style='width:100%;background:#0b0f18;border:1px solid var(--line2);color:var(--text);border-radius:11px;padding:12px;font-size:16px;outline:none'>"+
    "<div class='modal-actions'><button class='btn btn-ghost' id='rnCancel'>Cancel</button><button class='btn btn-primary' id='rnSave'>Save name</button></div>";
  const v=openModal(h);
  const inp=v.querySelector("#rnInput"); if(inp){ inp.focus(); inp.select(); }
  v.querySelector("#rnSave").onclick=()=>{
    const n=inp.value.trim();
    let ok=false;
    if(kind==="f") ok=renameFilm(+id,n);
    else if(kind==="s") ok=renameSeries(+id,n);
    else if(kind==="st") ok=renameStreamer(n);
    if(ok){ beep("gold"); toast("✏️ Renamed","good"); }
    closeModal(); render();
  };
  v.querySelector("#rnCancel").onclick=closeModal;
}

/* ═══════════ v34: platform rebrand — the OTT dialog, not a bare prompt ═══════════
   Reached from the platform card on OTT › Home and from the platform board, so
   the rebrand lives inside the surface it changes. Same IDs as the old rename
   dialog (rnInput / rnSave / rnCancel) so every existing binding and test keeps
   working; the dialog wears the command-produce shell and reports empty, saved
   and rejected states in place. */
function rebrandStreamerModal(){
  if(!G.streamer){ toast("No platform to rebrand yet — launch a streamer first.","bad"); return; }
  const cur=G.streamer.name||"";
  const html=`<div class="produce-modal-head"><span class="command-eyebrow">OTT / PLATFORM IDENTITY</span><h3>Rebrand your streamer</h3><p>A new name on the marquee. Subscribers, deals, sports rights and the library stay exactly where they are — the rebrand is free and takes effect immediately.</p></div>
    <div class="produce-modal-body">
      <div class="produce-modal-card">
        <label class="bo-rebrand-label" for="rnInput">Platform name</label>
        <input id="rnInput" class="bo-rebrand-input" type="text" maxlength="24" autocomplete="off" value="${esc(cur)}" placeholder="e.g. Meridian+">
        <p class="bo-rebrand-error" id="rnError" role="alert" aria-live="assertive" hidden></p>
        <p class="bo-rebrand-meta">${G.streamer.subs.toFixed(1)}M subscribers · ${fmtM(G.streamer.income||G.streamer.totalRev||0)}/wk · ceiling ${streamerCeiling()}M</p>
      </div>
      <div class="produce-modal-card">
        <h4>What the name carries</h4>
        <p>Subscribers recognise the platform, not the paperwork — churn, content ceiling and every signed deal are untouched by a rename. Up to 24 characters.</p>
      </div>
    </div>
    <div class="produce-modal-actions"><span class="bo-rebrand-note">No cash cost · keeps subscribers &amp; deals</span><div class="row" style="margin:0;gap:8px"><button class="produce-ghost" id="rnCancel">Cancel</button><button class="produce-action" id="rnSave">Save name</button></div></div>`;
  const v=openModal(html,{className:"command-produce-modal"});
  const inp=v.querySelector("#rnInput");
  const err=v.querySelector("#rnError");
  const showError=(msg)=>{ if(!err) return; err.textContent=msg; err.hidden=false; if(inp){ inp.classList.add("invalid"); inp.setAttribute("aria-invalid","true"); inp.focus(); } };
  const clearError=()=>{ if(!err) return; err.hidden=true; err.textContent=""; if(inp){ inp.classList.remove("invalid"); inp.removeAttribute("aria-invalid"); } };
  if(inp){
    inp.focus(); inp.select();
    inp.addEventListener("input",clearError);
    inp.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); save(); } });
  }
  function save(){
    const n=(inp?inp.value:"").trim();
    if(!n){ showError("Give the platform a name before saving."); return; }
    if(n===cur){ showError("That is already the platform name — nothing to change."); return; }
    let ok=false;
    try{ ok=renameStreamer(n); }catch(e){ ok=false; }
    if(!ok){ showError("That name was rejected by the platform desk. Try a different one."); return; }
    beep("gold"); toast("📱 Platform rebranded as \""+G.streamer.name+"\" — subscribers untouched.","good");
    closeModal(); render();
  }
  v.querySelector("#rnSave").onclick=save;
  v.querySelector("#rnCancel").onclick=closeModal;
}

/* ═══════════ v8: create your own superstar ═══════════ */
let SS={kind:"actor", power:3, skill:65};
function superstarModal(){
  const fee=starSignFee(SS.kind,SS.power,SS.skill);
  const kindLabel={actor:"🌟 Actor — stars multiply the opening",director:"🎬 Director — ~25% of quality",writer:"✍️ Writer — drives the script",producer:"🎫 Producer — keeps shoots on budget"};
  let h="<h3>🌟 Create your own superstar</h3>"+
    "<div class='tiny muted' style='margin-bottom:10px'>Mold talent from scratch — they join your roster forever (age, scandals and wage inflation still apply).</div>"+
    "<div class='card'><label class='field-label' for='ssName'>Stage name</label>"+
    "<input id='ssName' type='text' maxlength='28' placeholder='e.g. Rhea Stormborn' style='width:100%;background:#0b0f18;border:1px solid var(--line2);color:var(--text);border-radius:11px;padding:12px;font-size:15px;outline:none'></div>"+
    "<div class='card'><div class='small muted'>Role</div><div class='row'>"+
    Object.keys(kindLabel).map(k=>"<button class='btn btn-sm "+(SS.kind===k?"btn-primary":"")+"' data-ssk='"+k+"'>"+k.charAt(0).toUpperCase()+k.slice(1)+"</button>").join("")+
    "</div><div class='tiny muted' style='margin-top:4px'>"+kindLabel[SS.kind]+"</div></div>"+
    "<div class='card'><div class='slider-row'><span class='small muted'>Star power</span><input type='range' id='ssPow' min='1' max='5' step='1' value='"+SS.power+"'><span class='slider-val' id='ssPowV'>"+SS.power+"★</span></div>"+
    "<div class='slider-row'><span class='small muted'>Skill</span><input type='range' id='ssSkill' min='40' max='95' step='1' value='"+SS.skill+"'><span class='slider-val' id='ssSkillV'>"+SS.skill+"</span></div></div>"+
    "<div class='card'><div class='cost-total'><span>Signing bonus (paid now)</span><b class='gold'>"+fmtM(fee)+"</b></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Their quote "+fmtM(actorFee({kind:SS.kind, fee:Math.round((STAR_FEE[SS.kind]||STAR_FEE.actor)[SS.power-1]*(0.6+SS.skill/100)*10)/10, heat:0, scandal:0}))+" per project afterwards.</div></div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' id='ssCancel'>Cancel</button><button class='btn btn-primary' id='ssGo'>✍️ Sign "+fmtM(fee)+"</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-ssk]").forEach(b=>b.onclick=()=>{ SS.kind=b.dataset.ssk; beep("click"); superstarModal(); });
  const pw=v.querySelector("#ssPow"); if(pw) pw.oninput=()=>{ SS.power=+pw.value; $("#ssPowV").textContent=SS.power+"★";
    const sv=$("#ssSkillV"), fee2=starSignFee(SS.kind,SS.power,SS.skill); const g=v.querySelector("#ssGo"); if(g) g.textContent="✍️ Sign "+fmtM(fee2); };
  const sk=v.querySelector("#ssSkill"); if(sk) sk.oninput=()=>{ SS.skill=+sk.value; $("#ssSkillV").textContent=SS.skill;
    const fee2=starSignFee(SS.kind,SS.power,SS.skill); const g=v.querySelector("#ssGo"); if(g) g.textContent="✍️ Sign "+fmtM(fee2); };
  v.querySelector("#ssCancel").onclick=closeModal;
  v.querySelector("#ssGo").onclick=()=>{
    const nm=v.querySelector("#ssName");
    const res=createStar({name:nm?nm.value:"", kind:SS.kind, power:SS.power, skill:SS.skill});
    if(res.ok){ beep("gold"); confetti({count:80}); toast("🌟 "+res.t.name+" signed!","gold"); SS={kind:"actor", power:3, skill:65}; }
    else flashes(G.flash);
    closeModal(); render();
  };
}

/* v9: roster actions from crew cards (inline handlers — work inside modals) */
function contractClick(e,id){
  e.stopPropagation();
  if(signMultiFilmDeal(id)){ beep("gold"); toast("📜 Multi-picture deal signed","gold"); }
  else { beep("bad"); flashes(G.flash); }
  refreshTalentSurfaces();
}
function trainClick(e,id){
  e.stopPropagation();
  if(startTraining(id)){ beep("gold"); toast("🎓 Off to star school","good"); }
  else { beep("bad"); flashes(G.flash); }
  refreshTalentSurfaces();
}
/* v28: audition — pay a read fee to reveal a candidate's hidden ability */
function auditionClick(e,id){
  e.stopPropagation();
  if(doAudition(id)){ beep("gold"); }
  else { beep("bad"); flashes(G.flash); }
  refreshTalentSurfaces();
}
/* v28: talent watchlist pin */
function watchClick(e,id){
  e.stopPropagation();
  toggleWatch(id);
  const on=(G.watchlist||[]).includes(id);
  beep("click"); toast(on? "⭐ Added to watchlist" : "Removed from watchlist","");
  refreshTalentSurfaces();
}
function refreshTalentSurfaces(){
  if(typeof WZ!=="undefined" && WZ && document.querySelector(".modal")){
    if(WZ.mode==="series") seriesModal();
    else if(WZ.mode==="filmPitch") filmPitchModal();
    else wizardModal();
    return;
  }
  render();
}
/* v9: alt endings — a tested film ships one of two cuts */
function applyAltEnding(pid, kind){
  const p=G.projects.find(x=>x.id===pid); if(!p||!p.quality||p.altEnding) return false;
  p.altEnding=kind;
  if(kind==="critic"){
    p.quality.critic=clamp(p.quality.critic+4,5,99); p.quality.aud=clamp(p.quality.aud-4,5,99); p.quality.overall=clamp(p.quality.overall+1,8,98);
    log("🎬 “"+p.title+"” ships with the critics' ending (+4 critics, −4 audience).","");
  }else{
    p.quality.aud=clamp(p.quality.aud+4,5,99); p.quality.critic=clamp(p.quality.critic-4,5,99); p.quality.overall=clamp(p.quality.overall+1,8,98);
    log("🎬 “"+p.title+"” ships with the crowd-pleaser ending (+4 audience, −4 critics).","");
  }
  saveGame(); return true;
}
/* v10 Phase 2: own-streamer premiere confirmation (spec §14 + §88: show the commitment) */
function ownPremiereModal(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p||!G.streamer) return;
  const est=ownPremiereEstimate(p);
  const tier=(typeof DATA.tier==="function")? DATA.tier(G.streamer.tier||"premium") : {arpu:0.5};
  const wkRev=Math.round((G.streamer.subs+est.subs)*(tier.arpu||0.5)*10)/10;
  const sunk=Math.round(((p.budget||0)+(p.devCost||0)+(p.marketingPaid||0))*10)/10;
  let h="<h3>▶ Premiere on "+esc(G.streamer.name)+"</h3>"+
    "<div class='card'><div class='cost-line'><span>Overnight subscribers (est.)</span><b class='pos'>+"+est.subs+"M</b></div>"+
    "<div class='cost-line'><span>Box office</span><b>$0 — no theatrical run</b></div>"+
    "<div class='cost-line'><span>Platform revenue afterwards</span><b>≈ "+fmtM(wkRev)+"/wk (whole service)</b></div>"+
    "<div class='cost-line'><span>Already sunk (budget + dev + P&A paid)</span><b>"+fmtM(sunk)+"</b></div>"+
    "<div class='tiny muted' style='margin-top:6px'>Value arrives as subscribers, weekly ARPU and a bigger library ceiling — not as a licence cheque. Critics still review it; awards stay eligible. This cannot be undone.</div></div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' id='opCancel'>Keep it unreleased</button><button class='btn btn-primary' id='opGo'>▶ Premiere now</button></div>";
  const v=openModal(h);
  v.querySelector("#opCancel").onclick=closeModal;
  v.querySelector("#opGo").onclick=()=>{ if(finishOwnStreamerOriginal(p)){ beep("gold"); flashes(G.flash); } closeModal(); render(); };
}

let PROD_FILTER = "all";

function pipelineGantt(projs){
  if(!projs || !projs.length) return "";
  // Legacy Gantt kept for calendar compatibility; the Production Office renders its own produce-gantt.
  return "<div class='card gantt-chart' style='margin-bottom:12px'><div class='spread'><b class='small'>📊 Production Pipeline Gantt</b><span class='tiny muted'>"+projs.length+" active project(s)</span></div>"+
    "<div class='tiny muted' style='margin-bottom:8px'>Side-by-side timeline of projects moving through Pre, Shoot, and Post.</div>" +
    projs.map(p => {
      const L = p.phaseLen || {pre:2, shoot:4, post:3};
      const totalW = Math.max(1, L.pre + L.shoot + L.post);
      const preW = Math.round(L.pre / totalW * 100);
      const shootW = Math.round(L.shoot / totalW * 100);
      const postW = 100 - preW - shootW;
      const curIdx = {pre:0, shoot:1, post:2, reshoot:1}[p.phase] || 0;
      const doneWk = (curIdx>0?L.pre:0) + (curIdx>1?L.shoot:0) + (p.phaseWeek||0);
      const wksLeft = Math.max(1, totalW - doneWk);
      return "<div style='margin-bottom:6px'><div class='spread tiny'><b>" + DATA.GENRES[p.genre].emoji + " " + esc(p.title) + "</b><span class='muted'>~" + wksLeft + " wks to ready</span></div>" +
        "<div style='height:10px;border-radius:5px;background:rgba(255,255,255,.06);display:flex;overflow:hidden;margin-top:2px'>" +
          "<div style='width:" + preW + "%;background:" + (curIdx===0?"var(--gold)":"#3b82f6") + ";opacity:" + (curIdx>0?"0.4":"1") + "' title='Pre-prod'></div>" +
          "<div style='width:" + shootW + "%;background:" + (curIdx===1?"var(--gold)":"#10b981") + ";opacity:" + (curIdx>1?"0.4":curIdx<1?"0.2":"1") + "' title='Shoot'></div>" +
          "<div style='width:" + postW + "%;background:" + (curIdx===2?"var(--gold)":"#8b5cf6") + ";opacity:" + (curIdx<2?"0.2":"1") + "' title='Post'></div>" +
        "</div></div>";
    }).join("") + "</div>";
}
function produceGantt(projs){
  if(!projs || !projs.length) return "<div class='produce-gantt'><div class='produce-gantt-head'><b>Pipeline</b><small>No active shoots</small></div><div class='produce-empty'><b>The lot is quiet.</b><p>Greenlight a film in Develop and it appears here as a living timeline.</p></div></div>";
  return "<div class='produce-gantt'><div class='produce-gantt-head'><b>Pipeline — "+projs.length+" active</b><small>Pre · Shoot · Post</small></div>"+
    projs.map(p=>{
      const L=p.phaseLen||{pre:2,shoot:4,post:3};
      const totalW=Math.max(1,L.pre+L.shoot+L.post);
      const preW=Math.round(L.pre/totalW*100), shootW=Math.round(L.shoot/totalW*100), postW=100-preW-shootW;
      const curIdx={pre:0,shoot:1,post:2,reshoot:1}[p.phase]||0;
      const doneWk=(curIdx>0?L.pre:0)+(curIdx>1?L.shoot:0)+(p.phaseWeek||0);
      const wksLeft=Math.max(1,totalW-doneWk);
      const curCls=["pre","shoot","post"][curIdx]||"pre";
      return "<div class='produce-gantt-row'><div class='produce-gantt-label'><b>"+(DATA.GENRES[p.genre]?DATA.GENRES[p.genre].emoji:"🎬")+" "+esc(p.title)+"</b><span>~"+wksLeft+" wks to ready</span></div><div class='produce-gantt-bar'>"+
        "<i class='"+(curIdx>0?"done-pre":curIdx===0?"cur-pre":"pre")+"' style='width:"+preW+"%'></i>"+
        "<i class='"+(curIdx>1?"done-shoot":curIdx===1?"cur-shoot":"shoot")+"' style='width:"+shootW+"%'></i>"+
        "<i class='"+(curIdx===2?"cur-post":curIdx>2?"done-post":"post")+"' style='width:"+postW+"%'></i>"+
      "</div></div>";
    }).join("")+"</div>";
}
function produceBacklot(projs){
  const rolling=(projs||[]).filter(p=>p.phase==="shoot"||p.phase==="reshoot");
  const caption=rolling.length?"🎥 Rolling — "+rolling.map(p=>esc(p.title)).join(" · "):"🎬 Backlot on standby — greenlight a film to roll cameras";
  // Use animated pixel sprites if available, else fallback emoji crew
  let crewHtml="";
  try{
    if(typeof BK_ROWS!=="undefined" && typeof BK_PALS!=="undefined" && typeof bkSprite==="function"){
      const labels=["DIRECTOR","CAMERA","LEAD","CLAPPER"];
      const acts=["Blocking","Rolling","On set","Take 1"];
      crewHtml=labels.map((label,i)=>`<div class="produce-crew"><span class="produce-sprite">${bkSprite(BK_ROWS[i]||BK_ROWS[0], BK_PALS[i% BK_PALS.length])}</span><small>${label}</small><b>${acts[i]}</b></div>`).join("");
    } else throw new Error("no sprites");
  }catch(e){
    crewHtml="<div class='produce-crew'><i>🎬</i><small>DIRECTOR</small><b>Blocking</b></div>"+
    "<div class='produce-crew'><i>📷</i><small>CAMERA</small><b>Rolling</b></div>"+
    "<div class='produce-crew'><i>🎭</i><small>LEAD</small><b>On set</b></div>"+
    "<div class='produce-crew'><i>🎬</i><small>CLAPPER</small><b>Take 1</b></div>";
  }
  const isRolling = rolling.length>0;
  return "<div class='produce-backlot"+(isRolling?" rolling":" idle")+"' role='img' aria-label='Studio backlot with four departments at work'><div class='produce-backlot-hero'>"+
    crewHtml+
    "<div class='produce-backlot-rec"+(isRolling?"":" idle")+"'>"+(isRolling?"REC":"STANDBY")+"</div><div class='produce-track'><span></span><span></span><span></span></div></div>"+
    "<div class='produce-backlot-foot'><b>"+caption+"</b><span>"+(isRolling?rolling.length+" shooting":"lot dark")+"</span></div></div>";
}

/* ── v28.17: animated backlot set — four crew characters (director, camera
   operator, lead, clapper loader) drawn as crisp-edge pixel SVGs, all
   generated in code. Exclusive in-app art: nothing hotlinked, ships fully
   offline in web + APK. ── */
const BK_PALS=[
  {K:"#141824",S:"#e8b98a",H:"#2c3350",B:"#3d4f7c",P:"#232a3d"},
  {K:"#141824",S:"#d9a06b",H:"#4a3a28",B:"#5a6b4a",P:"#2b3038"},
  {K:"#141824",S:"#f0c49a",H:"#3a2418",B:"#c9962e",P:"#1d2333",G:"#ffd479"},
  {K:"#141824",S:"#c98d5e",H:"#6e2f2f",B:"#7a8aa0",P:"#39445c"}
];
const BK_ROWS=[
  "....KKKK....|...KHHHHK...|..KHHHHHHK..|..KKKKKKKK..|..KSSSSSSK..|..KSKSSKSK..|..KSSSSSSK..|...KSSSSK...|..KBBBBBBK..|.SKBBBBBBKS.|.SKBBBBBBKS.|..KBBBBBBK..|..KPPKKPPK..|..KPPKKPPK..|..KPPKKPPK..|.KKKK..KKKK.",
  "....KKKK....|...KHHHHK...|..KHHHHHHK..|..KSSSSSSK..|..KSKSSKSK..|..KSSSSSSK..|...KSSSSK...|..KBBBBBBK..|.SKBBBBBBKS.|.SKBBBBBBKS.|..KBBBBBBK..|..KBBBBBBK..|..KPPKKPPK..|..KPPKKPPK..|..KPPKKPPK..|.KKKK..KKKK.",
  "....KKKK....|...KHHHHK...|..KHHHHHHK..|..KHHHHHHK..|..KHSSSSHK..|..KHSKSKHK..|..KHSSSSHK..|...KSSSSK...|..KBBBBBBK..|.SKBBGGBBKS.|.SKBBBBBBKS.|..KBBBBBBK..|..KPPKKPPK..|..KPPKKPPK..|..KPPKKPPK..|.KKKK..KKKK.",
  "....KKKK....|...KHHHHK...|..KHHHHHHK..|..KSSSSSSK..|..KSKSSKSK..|..KSSSSSSK..|...KSSSSK...|..KBBBBBBK..|.SKBBBBBBKS.|.SKBBBBBBKS.|..KBBBBBBK..|..KPPPPPPK..|..KPPKKPPK..|..KPPKKPPK..|..KPPKKPPK..|.KKKK..KKKK."
];
function bkSprite(rows,pal){
  let r="";
  rows.split("|").forEach((row,y)=>{
    let x=0;
    for(const ch of row){ const c=pal[ch]; if(c) r+="<rect x='"+x+"' y='"+y+"' width='1.04' height='1.04' fill='"+c+"'/>"; x++; }
  });
  return "<svg class='px' viewBox='0 0 12 16' shape-rendering='crispEdges' aria-hidden='true' focusable='false'>"+r+"</svg>";
}
function backlotScene(){
  const rolling=inProdProjects().filter(p=>p.phase==="shoot"||p.phase==="reshoot");
  const crew=[
    ["bk-a1","bk-meg","DIRECTOR"],
    ["bk-a2","bk-cam","CAMERA"],
    ["bk-a3","bk-script","LEAD"],
    ["bk-a4","bk-board","CLAPPER"]
  ];
  let h="<div class='backlot' role='img' aria-label='Animated film set: director, camera operator, lead actor and clapper assistant at work'>";
  h+="<div class='bk-boom bk-boom1'></div><div class='bk-boom bk-boom2'></div>";
  h+="<div class='bk-rec"+(rolling.length?"":" bk-idle")+"'>"+(rolling.length?"REC":"STANDBY")+"</div>";
  h+="<div class='bk-crew'>";
  crew.forEach(([cls,prop,label],i)=>{
    h+="<div class='bk-actor "+cls+"'>"+bkSprite(BK_ROWS[i],BK_PALS[i])+"<i class='bk-prop "+prop+"'></i><b class='bk-name'>"+label+"</b></div>";
  });
  h+="</div><div class='bk-floor'></div>";
  h+="<div class='bk-caption'>"+(rolling.length
    ? "🎥 Rolling: "+rolling.map(p=>esc(p.title)).join(" · ")
    : "🎬 Backlot idle — greenlight a film to roll cameras.")+"</div>";
  h+="</div>";
  return h;
}

function produceHead(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  const dateBadge=`<div class="command-date"><span>WEEK</span><b>${String(w).padStart(2,"0")}</b><small>${esc(m.month)}</small></div>`;
  return `<header class="command-heading"><div><span class="command-edition">PRODUCTION OFFICE / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">02 / THE LOT</span><h1>From set to screen</h1><p>Physical production, post, and the handoff to distribution. Every dollar burns weekly; every week moves a film closer to the marquee.</p></div>${dateBadge}</header>`;
}
function produceTelemetry(){
  const inProd=inProdProjects(), ready=readyProjects();
  const datedReady=ready.filter(p=>!!p.releaseWeek).length;
  const fr=(G.films||[]).filter(f=>f.franchiseable).length;
  return `<div class="command-telemetry">${commandMetric("IN PRODUCTION",String(inProd.length),"On the floor")}${commandMetric("READY",String(ready.length),"In the can")}${commandMetric("DATED",String(datedReady),"With a date")}${commandMetric("FRANCHISES",String(fr),"Sequel-ready")}</div>`;
}
function produceBrief(){
  const inProd=inProdProjects(), ready=readyProjects();
  const total=inProd.length+ready.length;
  const headline=total===0?"Your lot is quiet.":total===1?`One picture is in motion — “${esc((inProd[0]||ready[0]).title)}” is moving.`:`${total} pictures are in motion.`;
  const cashNote=G.studio.cash<15?"Cash is tight — burns are real.":G.studio.cash<40?"Capital is workable. Watch the weekly burn.":"Capital is healthy for the slate.";
  return `<div class="produce-lead"><section class="produce-brief"><span class="command-eyebrow">THE LOT TODAY</span><h2>${headline}</h2><p>Shooting burns 70% of the negative cost, post finishes it, and pre-production buys you a clean script. Producer cover, location rebates, and insurance decide how painful the overruns are.</p><div class="produce-brief-actions"><button class="produce-ghost" onclick="if(typeof openLocationDesk==='function')openLocationDesk()">Location desk</button><button class="produce-action" onclick="calendarModal()">Release calendar</button></div><footer><span>STUDIO CASH</span><b>${fmtM(G.studio.cash)}</b><small>${cashNote} Overruns, rewrites and BTL lifts are paid from this balance.</small></footer></section><section class="produce-snapshot"><header><span class="command-eyebrow">HEALTH CHECK</span><h2>Where the slate stands</h2><p>Weekly spend, pipeline, and what needs your eyes before next Monday.</p></header>${produceSnapshotRows()}<footer><small>${inProd.length?inProd.length+" shooting or finishing · "+ready.length+" awaiting a date":"No active productions — develop a film first."}</small><button class="produce-link" onclick="switchTab('develop')">Develop a film →</button></footer></section></div>`;
}
function produceSnapshotRows(){
  const inProd=inProdProjects();
  const pre=inProd.filter(p=>p.phase==="pre").length, shoot=inProd.filter(p=>p.phase==="shoot").length, post=inProd.filter(p=>p.phase==="post").length, reshoot=inProd.filter(p=>p.phase==="reshoot").length;
  const total=Math.max(1,inProd.length);
  const rows=[
    ["Pre",pre,pre/total],
    ["Shoot",shoot,shoot/total],
    ["Post",post,post/total]
  ];
  if(reshoot) rows.push(["Reshoot",reshoot,reshoot/total]);
  if(!inProd.length) return `<div class="produce-snapshot-empty">Nothing is moving through the pipeline. The lot earns nothing while it idles.</div>`;
  return rows.map(([label,n,ratio])=>`<div class="produce-snapshot-row"><span>${label} — ${n}</span><i><b style="width:${Math.round(ratio*100)}%"></b></i><strong>${Math.round(ratio*100)}%</strong></div>`).join("")+
    `<div class="produce-snapshot-row"><span>Ready — ${readyProjects().length}</span><i><b style="width:${readyProjects().length?100:4}%"></b></i><strong>${readyProjects().length}</strong></div>`;
}
function produceTools(){
  return `<nav class="produce-tools" aria-label="Production tools"><button onclick="calendarModal()"><small>01 / RELEASE</small><span>Release Calendar</span></button><button onclick="if(typeof openLocationDesk==='function')openLocationDesk()"><small>02 / LOCATIONS</small><span>Location Scouting</span></button><button onclick="if(typeof openInsuranceModal==='function')openInsuranceModal()"><small>03 / GUARANTOR</small><span>Completion Insurance</span></button><button onclick="if(typeof openTestScreeningModal==='function')openTestScreeningModal();else if(typeof screeningModal==='function'){const r=readyProjects()[0];if(r)screeningModal(r.id)}"><small>04 / AUDIENCE</small><span>Test Screenings</span></button><button onclick="if(typeof StudioOperationsSuite!=='undefined'&&StudioOperationsSuite.renderProductPlacementModal)StudioOperationsSuite.renderProductPlacementModal()"><small>05 / BRANDS</small><span>Sponsors Desk</span></button></nav>`;
}
function producePanel(eyebrow,title,desc,content){
  return `<section class="produce-panel"><div class="produce-panel-head"><div><span class="command-eyebrow">${eyebrow}</span><h2>${title}</h2><p>${desc}</p></div></div>${content}</section>`;
}
function produceFilterBar(){
  const chips=[["all","All"],["pre","Pre"],["shoot","Shoot"],["post","Post"],["ready","Ready"],["dated","Dated"]];
  return `<div class="produce-filters" role="group" aria-label="Filter productions">${chips.map(([k,label])=>`<button data-filter-prod="${k}" class="${PROD_FILTER===k?"active":""}" aria-pressed="${PROD_FILTER===k}">${label}</button>`).join("")}</div>`;
}
function viewProductions(){
  const readyAll=readyProjects(), allProd=inProdProjects();
  // Fix filter: ready belongs to ready list; prod list only has pre/shoot/post/reshoot
  const prod = allProd.filter(p=>{
    if(PROD_FILTER==="all") return true;
    if(PROD_FILTER==="pre"||PROD_FILTER==="shoot"||PROD_FILTER==="post"||PROD_FILTER==="reshoot") return p.phase===PROD_FILTER;
    if(PROD_FILTER==="dated") return !!p.releaseWeek;
    if(PROD_FILTER==="ready") return false;
    return true;
  });
  let readyFiltered=readyAll;
  if(PROD_FILTER==="dated") readyFiltered=readyAll.filter(p=>!!p.releaseWeek);
  else if(PROD_FILTER==="ready") readyFiltered=readyAll.filter(p=>!p.releaseWeek);
  else if(["pre","shoot","post","reshoot"].includes(PROD_FILTER)) readyFiltered=[];

  let h=`<section class="command-deck command-produce">${produceHead()}${produceTelemetry()}${produceBrief()}${produceTools()}`;
  // Pipeline overview (gantt + backlot + lifecycle) as one panel
  h+=producePanel("PIPELINE","On the lot right now","How every active picture moves through the three phases — and who is actually on set today.",`<div class="produce-gantt">${produceGantt(allProd).replace(/^<div class='produce-gantt'>/,"").replace(/<\/div>$/,"")}</div>${produceBacklot(allProd)}<div class="produce-pipeline"><span>${allProd.length} IN MOTION</span> Pre ${allProd.filter(p=>p.phase==="pre").length} · Shoot ${allProd.filter(p=>p.phase==="shoot").length} · Post ${allProd.filter(p=>p.phase==="post").length}${allProd.filter(p=>p.phase==="reshoot").length?" · Reshoot "+allProd.filter(p=>p.phase==="reshoot").length:""} · Ready ${readyAll.length} <b>Concept → Script → Cast → <b>Production</b> → Post → Test → Marketing → Release</b></div>`);
  // Acquired media vault (if any) lives inside the same deck, not as legacy cards
  const vaultHtml=acquiredMediaSection();
  if(vaultHtml){
    // Convert legacy vault markup to produce panel: strip outer card wrappers and inject into produce-vault
    // We keep engine's vault logic but wrap it in our panel skin.
    // Extract vault Films list for redesigned list if available, else show legacy as fallback inside produce panel.
    try{
      const vaultItems=typeof maSlateFilms==="function"?maSlateFilms():[];
      if(vaultItems.length){
        const vaultVal=typeof maVaultValue==="function"?maVaultValue():0;
        const vaultFilms=typeof maVaultActive==="function"?maVaultActive():[];
        let vaultList=vaultItems.map(m=>{
          const genreName=(DATA.GENRES[m.genre]?DATA.GENRES[m.genre].name:m.genre);
          return `<div class="produce-vault-item"><div><b>${esc(m.title)}</b><small>${genreName} · quality ${Math.round(m.quality)} · est. open ${fmtG(m.weight||0)}</small></div><div style="text-align:right"><strong>${fmtM((typeof maLicenseBids==="function"?Math.max(0,...maLicenseBids(m.ref).map(b=>b.value)):0))||0}</strong><small>${m.src==="rival"?"firesale":"library"}</small></div><button class="produce-ghost" data-masell="${m.src}:${m.id}">License</button>${m.week>G.week?`<button class="produce-ghost" data-madate="${m.src}:${m.id}">Re-date</button>`:""}</div>`;
        }).join("");
        const buyout= vaultFilms.length>=2? `<div class="produce-vault-hero"><div><h3>Vault portfolio — ${vaultFilms.length} titles</h3><p>Catalog value ${fmtM(vaultVal)} · bulk actions are one tap away.</p></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="produce-ghost" id="btnMaBrowse">Browse vault</button><button class="produce-action" id="btnMaBulkSell">Sell vault</button><button class="produce-ghost" id="btnMaBulkLicense">Bulk license</button><button class="produce-ghost" id="btnMaFlipRival">Flip to rival</button></div></div>` : "";
        h+=producePanel("ACQUIRED","Acquired media — catalogue you own","Re-date a pickup, license it to a streamer, or sell the vault outright.",`<div class="produce-vault">${buyout}<div class="produce-vault-list">${vaultList}</div></div>`);
      } else {
        h+=producePanel("ACQUIRED","Acquired media","Films picked up through M&A — license them or fold them into your slate.",`<div style="padding:0 20px 18px">${vaultHtml}</div>`);
      }
    }catch(e){
      h+=producePanel("ACQUIRED","Acquired media","Catalogue holdings.",`<div style="padding:0 20px 18px">${vaultHtml}</div>`);
    }
  }
  // In Production
  h+=`<section class="produce-panel"><div class="produce-panel-head"><div><span class="command-eyebrow">ACTIVE SLATE</span><h2>In production — ${prod.length} ${PROD_FILTER!=="all"?`· ${PROD_FILTER}`:""}</h2><p>${prod.length?`Watch the weekly burn and give the crew what they need before the next phase rolls.`:`No films match “${PROD_FILTER}”. Switch the filter or greenlight a new picture.`}</p></div><span class="produce-stamp">${allProd.length} ACTIVE</span></div>${produceFilterBar()}`;
  if(!prod.length){
    h+=`<div class="produce-cards"><div class="produce-empty"><b>${PROD_FILTER==="ready"?"Ready films live below.":"Nothing is in that phase right now."}</b><p>${PROD_FILTER==="ready"?"The “Ready” slate is one panel down — those films are already in the can and waiting for a date.":PROD_FILTER==="dated"?"No in-production film is dated yet. Date a ready film in the next panel.":"Visit Develop to greenlight a film, then it appears here the next week."}</p>${!allProd.length?`<button class="produce-action" onclick="switchTab('develop')">Develop a film →</button>`:""}</div></div></section>`;
  } else {
    h+=`<div class="produce-cards">`;
    for(const p of prod){
      const S=DATA.SCALES[p.scale]||DATA.SCALES.mid;
      const ph=p.phase, L=p.phaseLen||{pre:2,shoot:4,post:3,reshoot:3};
      const genreName=DATA.GENRES[p.genre]?DATA.GENRES[p.genre].emoji+" "+DATA.GENRES[p.genre].name:esc(p.genre||"Feature");
      if(ph==="reshoot"){
        const weeks=L.reshoot||3, pc=clamp(Math.round((p.phaseWeek||0)/weeks*100),0,100);
        const burn=p.budget*0.08/Math.max(1,weeks);
        h+=`<article class="produce-card reshooting"><header><div><h3>${esc(p.title)}${p.franchiseName?` <small>FRANCHISE</small>`:""}</h3><div class="produce-card-meta">${genreName} · <span>${S.emoji} ${S.name}</span> · ${fmtM(p.budget)} · dir ${p.director?esc(p.director.name):"—"}</div></div><div class="produce-phase"><b>RESHOOT</b><small>Week ${Math.min((p.phaseWeek||0)+1,weeks)} of ${weeks}</small></div></header><div class="produce-progress"><i class="cur" style="width:${pc}%"></i></div><div class="produce-progress-labels"><span>Reshoot ${pc}%</span><span>burn ${fmtM(burn)}/wk · spent ${fmtM(p.spent||0)}</span></div><div class="produce-card-actions"><button class="produce-ghost" data-cancel="${p.id}" style="border-color:#8a5b52;color:#e9a99a">✕ Shelve</button></div></article>`;
        continue;
      }
      const curIdx={pre:0,shoot:1,post:2}[ph] ?? 0;
      const totalWk=(L.pre||2)+(L.shoot||4)+(L.post||3);
      const doneWk=(curIdx>0?(L.pre||2):0)+(curIdx>1?(L.shoot||4):0)+(p.phaseWeek||0);
      const wksLeft=Math.max(1,totalWk-doneWk);
      const burn=ph==="pre"?p.budget*0.10/Math.max(1,L.pre||2):ph==="shoot"?p.budget*0.70/Math.max(1,L.shoot||4)*(G.upgrades&&G.upgrades.backlot?0.88:1):p.budget*0.20/Math.max(1,L.post||3)*(G.upgrades&&G.upgrades.vfx?0.75:1);
      const phaseLabel={pre:"PRE",shoot:"SHOOT",post:"POST"}[ph]||ph.toUpperCase();
      const stageClass=ph==="shoot"?"shooting":ph==="post"?"posting":"";
      const nextText=ph==="pre"? (p.rewritten?"Finishing pre — shoot starts next.":"Rewrite for +6 script, then shoot."):ph==="shoot"?(p.producer?"Shooting — producer caps overruns.":"Shooting — no producer, watch overruns."): "Post — test screening next.";
      const canRewrite=ph==="pre"&&!p.rewritten;
      const canBtl=!p.btlAssigned;
      const btlCost=2, btlDisabled=G.studio.cash<btlCost;
      h+=`<article class="produce-card ${stageClass}"><header><div><h3>${esc(p.title)}${p.franchiseName?` <small>FRANCHISE</small>`:""}</h3><div class="produce-card-meta">${genreName} · <span>${S.emoji} ${S.name}</span> · ${fmtM(p.budget)}${p.overrun>0?` · <span style="color:#e9a99a">+${fmtM(p.overrun)} overrun</span>`:""} · 🎬 ${p.director?esc(p.director.name):"—"} · ✍️ ${p.writer?esc(p.writer.name):"—"} · 🎫 ${p.producer?esc(p.producer.name):`<span style="color:#e9a99a">none</span>`} · ${p.cast?p.cast.length:0} leads</div></div><div class="produce-phase"><b class="${ph==="shoot"?"gold":""}">${phaseLabel}</b>${p.strikePause>0?`<small style="color:#e9a99a">✊ strike ${p.strikePause}wks</small>`:""}${p.btlAssigned?`<small style="color:#b6dba8">👷 BTL on set</small>`:""}<small>Week ${doneWk+1} of ~${totalWk} · ~${wksLeft}wks left</small></div></header><div class="produce-progress">${["pre","shoot","post"].map((x,i)=>{const st=i<curIdx?"done":i===curIdx?"cur":"todo";return `<i class="${st}"></i>`}).join("")}</div><div class="produce-progress-labels"><span>Pre</span><span>Shoot</span><span>Post</span></div><div class="produce-stats"><span>Burn <b>${fmtM(burn)}/wk</b></span><span>Spent <b>${fmtM(p.spent||0)} of ${fmtM(p.budget)}</b></span><span>Cash <b>${fmtM(G.studio.cash)}</b></span><em>${p.shootingLocationName||p.location||"home lot"}</em></div><div class="produce-next">${nextText}</div><div class="produce-card-actions">${canRewrite?`<button class="produce-ghost" data-rewrite="${p.id}">✍️ Rewrite (${fmtM(Math.max(2,Math.round(p.budget*0.05)) )})</button>`:""}${canBtl?`<button class="produce-ghost" data-btl="${p.id}" ${btlDisabled?"disabled title='Need $2M cash'":""}>👷 BTL crew ($2M)</button>`:""}<button class="produce-ghost" data-cancel="${p.id}" style="border-color:#6f5a52;color:#d2b1a6">✕ Shelve</button></div></article>`;
    }
    h+=`</div></section>`;
  }
  // Ready for release
  h+=`<section class="produce-panel"><div class="produce-panel-head"><div><span class="command-eyebrow">DISTRIBUTION</span><h2>Ready for release — ${readyFiltered.length}${readyFiltered.length!==readyAll.length?` of ${readyAll.length}`:""}</h2><p>Test it, date it, and get it to screens. P&A, window, and corridors decide the opening.</p></div><span class="produce-stamp">${readyAll.length} IN THE CAN</span></div>`;
  if(!readyFiltered.length){
    h+=`<div class="produce-cards"><div class="produce-empty"><b>${readyAll.length?`No ready film matches “${PROD_FILTER}”.`:"Nothing in the can yet."}</b><p>${readyAll.length?"Switch the filter to “All” or “Ready” to see every finished picture.":"Finish a shoot and the film lands here — test screening, then theatrical or streaming."}</p></div></div></section>`;
  } else {
    h+=`<div class="produce-cards">`;
    for(const p of readyFiltered){
      let lo={name:"—",rebate:0}; try{ lo=DATA.location(p.location)||lo; }catch(e){}
      let breakeven="—"; try{ breakeven=fmtM(breakevenWW(p))+" WW"; }catch(e){}
      let legs="—"; try{ legs=legsOf({genre:p.genre, quality:p.quality, releaseWeek:G.week, pattern:p.pattern, rollout:p.rollout, imax:p.imax})+"×"; }catch(e){}
      const testedNote=p.tested?`<span>Test ✓</span>`:``;
      const readinessRows=`<div class="produce-release-readiness"><div><span>Release readiness</span><b>${p.tested?"Test ✓":"Test — screen it"} · P&A ≈ ${fmtM(recMarketing(p))} · ${p.releaseWeek?`Dated ${dateLabel(p.releaseWeek)}`:"Undated"} · legs ~${legs}</b></div>${p.releaseWeek&&p.advanceTotal?`<div><span>Advance sales</span><b style="color:#edc47c">${fmtM(p.advanceTotal)} over ${(p.advance||[]).length}w</b></div>`:""}${p.releaseWeek&&(p.promoOwed||0)>0?`<div><span>Promo</span><b>${p.promoDone||0} of ${p.promoOwed}${(p.promoEvents||[]).some(e=>e.kind==="backfire")?` <span style="color:#e9a99a">· backfire</span>`:""}</b></div>`:""}${p.releaseWeek&&(p.dropEvents||[]).length?`<div><span>Drops</span><b>${(p.dropEvents||[]).slice(-4).map(e=>{const c=typeof campaignDef==="function"?campaignDef(e.camp):null;return (c?c.icon+" "+c.name:e.camp)+(e.kind==="viral"?` <span style="color:#b6dba8">viral</span>`:e.kind==="whiff"?` <span style="color:#e9a99a">whiff</span>`:"");}).join(" · ")}</b></div>`:""}</div>`;
      const flags=`<div class="produce-release-flags"><span class="${p.rating==="R"?"flag-r":""}">${p.rating||"PG-13"}</span><span>${esc(lo.name)} (${Math.round((lo.rebate||0)*100)}%)</span>${p.premium?`<span class="flag-premium">🍿 IMAX/Premium</span>`:""}${p.scriptPolish?`<span style="color:#b6dba8;border-color:#5c7f57">✍️ polish</span>`:""}${p.franchiseName?`<span style="color:#c3b4e6;border-color:#6a5c8a">FRANCHISE</span>`:""}</div>`;
      const crewLine=(p.writer||p.producer)?`<div class="produce-card-meta">${p.writer?`✍️ ${esc(p.writer.name)} (${(p.writerBonus||0)>=0?"+":""}${p.writerBonus||0} script)`:""}${p.producer?` · 🎫 ${esc(p.producer.name)}`:""}</div>`:"";
      const soldBanner=p.prebuyAccepted?`<div class="produce-next" style="border-left-color:#8a7748">Sold to ${DATA.platform(p.prebuyPlatform)?DATA.platform(p.prebuyPlatform).name:"streamer"} — payable on delivery.</div>`:"";
      h+=`<article class="produce-release ${p.prebuyAccepted?"sold":"ready"}"><header><div><h3>🎞 ${esc(p.title)} <small>${p.quality?scoreBadge(p.quality.overall):""}</small></h3>${soldBanner}<div class="produce-card-meta">Critics ${p.quality?p.quality.critic:"—"} · Audience ${p.quality?p.quality.aud:"—"} · ${fmtM(p.budget)}${p.overrun>0?` (incl. ${fmtM(p.overrun)} overrun)`:""} · breakeven ${breakeven}</div>${crewLine}${flags}</div></header>${readinessRows}${p.prebuyAccepted?"":`<div class="produce-release-actions"><button class="produce-action" data-sched="${p.id}">📅 Theatrical Release</button><button class="produce-ghost" data-shop="${p.id}">📺 Shop to Streamers</button>${G.streamer?`<button class="produce-ghost" data-ownprem="${p.id}">▶ Premiere on ${esc(G.streamer.name)}</button>`:""}<button class="produce-ghost" data-test="${p.id}">🎬 Test screening</button>${p.releaseWeek?`<button class="produce-ghost" data-whatif="${p.id}">🔮 What-if</button>`:""}<button class="produce-ghost" data-screen="${p.id}">🧪 Report</button>${!p.reshoot&&p.quality&&p.quality.overall<62?`<button class="produce-ghost" data-reshoot="${p.id}">🎞 Reshoot (${fmtM(Math.max(3,Math.round(p.budget*0.08)) )})</button>`:""}</div>`}${p.tested&&!p.altEnding?`<div class="produce-alt"><small>Two endings survive the edit — pick one:</small><button class="produce-ghost" data-ending="critic" data-eid="${p.id}">🎭 Critics' cut</button><button class="produce-ghost" data-ending="aud" data-eid="${p.id}">🎉 Crowd-pleaser</button></div>`:p.altEnding?`<div class="produce-next">Ending locked: ${p.altEnding==="critic"?"critics' cut":"crowd-pleaser"}.</div>`:""}</article>`;
    }
    h+=`</div></section>`;
  }
  // Franchise opps
  const fr=(G.films||[]).filter(f=>f.franchiseable);
  h+=`<section class="produce-panel"><div class="produce-panel-head"><div><span class="command-eyebrow">FRANCHISE</span><h2>Sequel desk</h2><p>Land a big hit (2× breakeven + good reviews) and the follow-up greenlight lives here.</p></div><span class="produce-stamp">${fr.length} ELIGIBLE</span></div>`;
  if(!fr.length) h+=`<div class="produce-cards"><div class="produce-empty"><b>No sequel window open.</b><p>A theatrical smash that doubles its breakeven and scores with critics unlocks the next chapter.</p></div></div></section>`;
  else h+=`<div class="produce-franchise">${fr.slice(0,6).map(f=>`<div class="produce-franchise-card"><div><b>${DATA.GENRES[f.genre]?DATA.GENRES[f.genre].emoji:"🎬"} ${esc(f.title)}</b><small>${fmtG(f.ww||0)} WW · ${f.quality?scoreBadge(f.quality.overall):""}</small></div><button class="produce-action" data-seq="${f.id}">⚡ Sequel</button></div>`).join("")}</div></section>`;
  return h+`</section>`;
}



/* ── strategic release calendar: every weekend, everybody's films, warnings ── */
let CAL=null; // {filmId}
function calendarModal(){
  const dated=(G.projects||[]).filter(p=>p.releaseWeek>G.week).sort((a,b)=>a.releaseWeek-b.releaseWeek);
  if(!CAL) CAL={filmId:dated.length?dated[0].id:null};
  if(CAL.filmId&&!dated.some(p=>p.id===CAL.filmId)) CAL.filmId=dated.length?dated[0].id:null;
  const film=dated.find(p=>p.id===CAL.filmId)||null;
  let head=`<div class='produce-modal-head'><span class='command-eyebrow'>PRODUCTION OFFICE / RELEASE CALENDAR</span><h3>Release calendar — where you open decides the opening.</h3><p>Player + rival films, holidays, corridors, theatre caps and sports weeks. Pick a dated film, tap a weekend to move it — rivals may blink and corridors change the legs.</p></div>`;
  let body=`<div class='produce-modal-body'>`;
  body+=`<div class='produce-modal-card'><span class='command-eyebrow'>YOUR DATED FILMS</span><p class='tiny muted' style='margin:0 0 8px'>Tap a title, then a weekend below. Only dated pictures can be moved here — date one from Productions first.</p><div class='produce-filters' style='margin:0'>`;
  if(!dated.length) body+=`<span class='tiny muted'>No dated films — date one from Productions first.</span>`;
  else dated.forEach(p=>{ body+=`<button class='produce-ghost' style='min-height:32px;padding:6px 10px;${CAL.filmId===p.id?'background:#edc47c!important;color:#24332e!important;border-color:#edc47c!important':''}' data-calfilm='${p.id}'>${esc(p.title)} <small>· ${dateLabel(p.releaseWeek)}</small></button>`; });
  body+=`</div></div>`;
  body+=`<div class='produce-modal-card' style='padding:0;overflow:hidden'>`;
  body+=`<div style='max-height:360px;overflow-y:auto;display:grid;gap:0'>`;
  for(let w=G.week+2; w<=G.week+30; w++){
    const s=DATA.seasonOf(woyOf(w));
    const mine=(G.projects||[]).filter(o=>o.releaseWeek===w).map(o=>esc(o.title)).join(' · ');
    const rvs=[]; (G.rivals||[]).forEach(r=>{ (r.slate||[]).forEach(f=>{ if(f.week===w&&!f.dead) rvs.push(r.name.split(' ')[0]+': '+f.title+' ('+f.scale+')'); }); });
    const warns=weekWarnings(w, film);
    const tags=(s.holiday?`<span class='tag gold'>holiday ×${s.season.toFixed(2)}</span> `:``)+(s.season>=1.15?`<span class='tag gold'>corridor ×${s.season.toFixed(2)}</span>`:s.season<=0.9?`<span class='tag'>dead ×${s.season.toFixed(2)}</span>`:`<span class='tag'>×${s.season.toFixed(2)}</span>`);
    body+=`<div class='calendar-row${film&&film.releaseWeek===w?' sel':''}' data-calw='${w}' style='margin:0;border:0;border-bottom:1px solid #2c4038;border-radius:0;padding:10px 14px;background:${film&&film.releaseWeek===w?'#1f3a32':'transparent'}'>`+
      `<div class='cal-when'><b>${s.month} W${woyOf(w)}</b><span>Year ${yearOf(w)}</span></div>`+
      `<div class='cal-note'>${tags} ${mine?`<br><span class='mine-f'>${mine}</span>`:``}${rvs.length?`<br><span class='rival-f'>${rvs.slice(0,2).join(' · ')}</span>`:``}${warns.length?`<br>${warns.map(x=>`<span class='tag ${x.cls}'>${x.t}</span>`).join(' ')}`:``}</div>`+
      `<div class='tiny muted'>${film?`opens ≈ ${fmtG(previewOpen(film,w))}`:``}</div></div>`;
  }
  body+=`</div></div>`;
  body+=`</div>`;
  const html=head+body;
  const v=openModal(html,{className:'command-produce-modal',onClose:()=>{CAL=null;}});
  v.querySelectorAll('[data-calfilm]').forEach(b=>b.onclick=()=>{ CAL.filmId=+b.dataset.calfilm; beep('click'); calendarModal(); });
  v.querySelectorAll('[data-calw]').forEach(el=>el.onclick=()=>{
    if(!film){ toast('Pick a dated film first.','bad'); return; }
    if(moveReleaseDate(film.id,+el.dataset.calw)){ beep('gold'); flashes(G.flash); calendarModal(); }
    else toast('That weekend is too soon.','bad');
  });
}

/* ── release scheduling modal ── */
function startScheduling(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p) return;
  const rawReg=p.targetRegion;
  const initReg=Array.isArray(rawReg)? rawReg.slice() : (rawReg && rawReg!=="auto"? [rawReg] : []);
  SCHEDULE={p, week:G.week+4, marketing:recMarketing(p), sel:false, premium:!!p.premium, window:p.window||"45", dayAndDate:!!p.dayAndDate, boosts:[], camps:(p.campaigns||[]).slice(), plan:null, regions:initReg, appeal:false, ownWindow:!!p.ownWindow};
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
  /* v9: international markets — pick ONE or SEVERAL countries/regions for the release */
  h+="<div class='small muted' style='margin:10px 0 6px'>🌍 International markets <span class='tiny'>(tap to target one — or several — countries)</span></div><div class='row' id='scRegion'>";
  regionDefs().forEach(d=>{ h+="<button class='btn btn-sm "+(SCHEDULE.regions.includes(d.id)?"btn-primary":"")+"' data-region='"+d.id+"'>"+d.emoji+" "+d.name+"</button>"; });
  h+="</div><div class='tiny muted' style='margin:2px 0 4px'>"+
    (SCHEDULE.regions.length? "This release leans into "+SCHEDULE.regions.map(id=>{const d=regionDefs().find(x=>x.id===id); return d? d.emoji+" "+d.name : id;}).join(", ")+
      " — each +6% intl gross (first) / +3% (extra) and ×1.8 market share. Tap again to untap." :
      "No targeting: the film finds its own markets. Shoot-location rebates are separate (set in the wizard).")+
    "</div>"+
    "<div class='tiny muted' style='margin:2px 0 4px'>🌍 Dubbing & localization: −"+fmtM(localizationCost(p, SCHEDULE.regions.length? SCHEDULE.regions : "auto"))+" <span class='muted'>(dubs, subs, local P&A materials — charged at release; foreign-language productions print for less, staggered rollouts print for more)</span></div>";
  /* v9: rating appeal board */
  if(p.rating==="R"){
    h+="<div class='card' style='margin-top:8px;cursor:pointer' id='scAppeal'><div class='spread'><span class='small'>"+(SCHEDULE.appeal?"✅ ":"⬜ ")+"<b>⚖ Appeal the R rating</b> — fight the board for PG-13</span><span class='tag "+(SCHEDULE.appeal?"gold":"")+"'>"+fmtM(3)+" filing fee</span></div>"+
      "<div class='tiny muted'>~55% odds the board re-rates it PG-13 (bigger family audience). Lose and the press covers the fight (+3% buzz) while the cut stays R.</div></div>";
  }
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
      "<div class='p-sub'>targets "+(c.demos||[]).join(" + ")+" · ×1.5 hype on the film's strongest demo</div>"+
      "<div class='p-sub'>🗓 drops "+dropWeeks(c).map(off=>off+" wk"+(off>1?"s":"")+" out").join(" · ")+" — each drop rolls a reception event (viral ×1.5 / solid / whiff ×0.5)</div></div>";
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
      "<div class='cost-line'><span>🗓 Drop sequence</span><b class='tiny'>"+(SCHEDULE.camps.length? (function(){ let offs=[]; SCHEDULE.camps.forEach(id=>{ const c=campaignDef(id); if(c) dropWeeks(c).forEach(off=>offs.push(off)); }); offs=[...new Set(offs)].sort((a,b)=>b-a); return offs.map(off=>off+"w").join(" · ")+" out"; })() : "—")+"</b></div>"+
      "<div class='cost-line'><span>Hype</span><b class='pos'>+"+hype+"% opening</b></div>"+
      "<div class='cost-line'><span>Expected impact</span><b class='tiny'>"+expNote+"</b></div>"+
      "<div class='cost-line'><span>ROI (est. rentals ÷ spend)</span><b class='"+(parseFloat(String(roi).slice(1))>=1?"pos":"neg")+"'>"+roi+"</b></div></div>";
  }
  h+="<div class='row' id='scDay'>";
  h+="<div class='card' style='margin-top:4px;cursor:pointer;flex:1' id='scDayToggle'><div class='spread'><span class='small'>"+(SCHEDULE.dayAndDate?"✅ ":"⬜ ")+"<b>Day-and-date</b> — theater + your platform</span></div>"+
    "<div class='tiny muted'>−35% opening, but pushes your streamers' subscribers. Only if you own a platform.</div></div></div>";
  /* v10 Phase 2: hybrid — theatrical first, then your own streamer gets it */
  if(G.streamer){
    h+="<div class='card' style='margin-top:4px;cursor:pointer' id='scOwnWin'><div class='spread'><span class='small'>"+(SCHEDULE.ownWindow?"✅ ":"⬜ ")+"<b>Hybrid: after the theatrical run → "+esc(G.streamer.name)+"</b></span><span class='tag "+(SCHEDULE.ownWindow?"gold":"")+"'>+subs at window end</span></div>"+
      "<div class='tiny muted'>When the run ends the film becomes an exclusive on your platform (+subscribers, library ceiling). Skips pay-1 TV and external OTT bids for this title.</div></div>";
  }
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
  const myConflicts = weekendCompetitors(p,SCHEDULE.week).filter(c=>c.mine);
  if(myConflicts.length){
    h+="<div class='card' style='background:rgba(235,87,87,0.15);border:1px solid var(--bad);margin-top:8px'><div class='row'><span style='font-size:20px'>⚠️</span>"+
      "<div><b class='neg'>Internal Schedule Conflict!</b><div class='tiny muted'>You already have “"+esc(myConflicts[0].title)+"” dated for this exact weekend! Two of your own titles will cannibalize screens and audience.</div></div></div></div>";
  }
  h+="<div class='card' style='margin-top:10px'><div class='cost-line'><span>Expected opening (est.)</span><b id='scExp'>"+fmtG(exp)+" dom</b></div>"+
    "<div class='cost-line'><span>Breakeven</span><b id='scBe'>"+fmtG(be)+" WW</b></div>"+
    "<div class='cost-line'><span>🎟 Advance sales by opening (est.)</span><b id='scAdv'>"+fmtM(advancePreview(p,SCHEDULE.week))+"</b></div>"+
    "<div class='cost-line'><span>Dubbing & localization</span><b>−"+fmtM(localizationCost(p, SCHEDULE.regions.length? SCHEDULE.regions : "auto"))+"</b></div>"+
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
    const eEl=$("#scExp"), bEl=$("#scBe"), pEl=$("#scPay"), aEl=$("#scAdv");
    if(eEl) eEl.textContent=fmtG(e2)+" dom";
    if(bEl) bEl.textContent=fmtG(breakevenWW({budget:p.budget, marketing:effMkt}))+" WW";
    if(pEl) pEl.textContent=fmtM(effMkt*0.3);
    if(aEl) aEl.textContent=fmtM(advancePreview(p,SCHEDULE.week));
  };
  v.querySelectorAll("[data-w]").forEach(el=>el.onclick=()=>{ SCHEDULE.week=+el.dataset.w; beep("click"); schedModal(); });
  const pm=v.querySelector("#scPremium"); if(pm) pm.onclick=()=>{ SCHEDULE.premium=!SCHEDULE.premium; beep("click"); schedModal(); };
  v.querySelectorAll("[data-win]").forEach(b=>b.onclick=()=>{ SCHEDULE.window=b.dataset.win; beep("click"); schedModal(); });
  v.querySelectorAll("[data-region]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.region, i=SCHEDULE.regions.indexOf(id);
    if(i>=0) SCHEDULE.regions.splice(i,1); else SCHEDULE.regions.push(id);
    beep("click"); schedModal();
  });
  const ap=v.querySelector("#scAppeal"); if(ap) ap.onclick=()=>{ SCHEDULE.appeal=!SCHEDULE.appeal; beep("click"); schedModal(); };
  const dt=v.querySelector("#scDayToggle"); if(dt) dt.onclick=()=>{ SCHEDULE.dayAndDate=!SCHEDULE.dayAndDate; beep("click"); schedModal(); };
  const ow=v.querySelector("#scOwnWin"); if(ow) ow.onclick=()=>{ SCHEDULE.ownWindow=!SCHEDULE.ownWindow; beep("click"); schedModal(); };
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
    p.ownWindow=!!SCHEDULE.ownWindow;
    p.targetRegion=SCHEDULE.regions.length? SCHEDULE.regions.slice() : "auto";
    if(SCHEDULE.appeal && p.rating==="R" && G.studio.cash>=3){
      G.studio.cash-=3;
      if(chance(0.55+G.studio.rep/500)){
        p.rating="PG-13";
        log("⚖ The board flipped “"+p.title+"” to PG-13 on appeal — the family audience opens up.","gold");
      }else{
        p.buzzBonus=(p.buzzBonus||0)+0.03;
        log("⚖ Appeal denied — “"+p.title+"” keeps its R, but the fight made headlines (+3% buzz).","bad");
      }
    }
    p.mktBoosts=SCHEDULE.boosts.slice();
    if(SCHEDULE.boosts.includes("influencer")) p.buzzBonus=(p.buzzBonus||0)+(DATA.mktBoost("influencer").buzz||0.04);
    p.campaigns=SCHEDULE.camps.slice(); p.campaignPlan=SCHEDULE.plan;   // v13: effects now arrive as staggered drops (tickCampaignDrops), not all upfront
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
/* v12: advance-sales preview — reflects the P&A and campaigns currently picked in the modal */
function advancePreview(p, week){
  const savedC=(p.campaigns||[]).slice(), savedM=p.marketing;
  if(SCHEDULE){ p.campaigns=SCHEDULE.camps.slice(); p.marketing=SCHEDULE.marketing; }
  const v=advanceProjection(p, week);
  p.campaigns=savedC; p.marketing=savedM;
  return v;
}

/* ═══════════ v4: critic / audience split + named reviews ═══════════ */
function scoreSplit(f){
  const crit = f.criticAvg!=null? f.criticAvg : (f.quality? f.quality.critic:50);
  const aud  = audienceScoreOf(f);
  const fresh = f.freshPct!=null? f.freshPct : (crit>=60?100:0);
  const card=(label,value,tone,note)=>"<div class='bo-score-card"+(tone?" "+tone:"")+"'><small>"+label+"</small><b>"+value+"</b><span>"+note+"</span></div>";
  let h="<div class='bo-score'>"+
    card("CRITICS",crit+"%",crit>=70?"good":crit<50?"bad":"",(f.reviews&&f.reviews.length)?f.reviews.length+" reviews filed":"named critic consensus")+
    card("AUDIENCE",aud+"%",aud>=70?"good":aud<50?"bad":"","word of mouth")+
    card("FRESH",fresh+"%",fresh>=60?"good":"bad",fresh>=60?"certified fresh":"rotten")+
  "</div>";
  const meter=(label,value,tone)=>"<div class='bo-track-row'><span class='bo-track-label'>"+label+"<small>out of 100</small></span>"+
    "<span class='bo-track"+(tone?" "+tone:"")+"'><i style='width:"+clamp(value,0,100)+"%'></i></span>"+
    "<span class='bo-track-val'>"+Math.round(value)+"</span></div>";
  h+="<div class='bo-track-rows'>"+meter("Critics",crit,crit<50?" bad":"")+meter("Audience",aud,aud<50?" bad":"")+"</div>";
  if(f.reviewBombed) h+="<div class='bo-chip-row'><span class='bo-chip bad'>REVIEW BOMBED −"+f.reviewBombed+"</span></div>";
  return h;
}
function reviewsModal(fid){
  const f=G.films.find(x=>x.id===fid); if(!f) return;
  const revs=f.reviews||[];
  const posCount = revs.filter(r=>r.score>=60).length;
  const mixCount = revs.filter(r=>r.score>=40 && r.score<60).length;
  const negCount = revs.filter(r=>r.score<40).length;
  const totRevs = Math.max(1, posCount + mixCount + negCount);
  const crit = f.criticAvg!=null? f.criticAvg : (f.quality? f.quality.critic:50);
  const aud  = audienceScoreOf(f);

  const head='<div class="produce-modal-head"><span class="command-eyebrow">REVIEWS / '+esc((DATA.GENRES[f.genre]||{}).name||f.genre)+'</span>'+
    '<h3>“'+esc(f.title)+'”</h3>'+
    '<p>What the press desk and the paying audience said. Critics decide prestige and awards odds; the audience score decides how long the run holds.</p></div>';

  let body='<div class="produce-modal-body">';
  body+=scoreSplit(f);

  if(f.gdsJudges && f.gdsJudges.length){
    const hof=(f.gdsTotal>=32);
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>INDUSTRY CRITIC DESK</b><span class="'+(hof?"pos":"")+'">'+f.gdsTotal+' / 40 · '+(hof?"HALL OF FAME":"BELOW HALL OF FAME")+'</span></div>'+
      (hof?'<p class="bo-figure-cap">Golden Plaque awarded — reputation and sequel hype both lifted.</p>':'<p class="bo-figure-cap">32/40 required for Hall of Fame induction.</p>')+
      '<div class="bo-kpis">'+f.gdsJudges.map(j=>'<div class="bo-kpi'+(j.score>=8?" good":j.score<=4?" bad":"")+'"><small>'+esc(j.name)+'</small><b>'+j.score+'/10</b><span>'+esc(j.focus)+'</span></div>').join("")+'</div></div>';
  }

  if(revs.length){
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>SCORE DISTRIBUTION</b><span>'+posCount+' positive · '+mixCount+' mixed · '+negCount+' negative</span></div>'+
      ((typeof BOCharts!=="undefined")?BOCharts.split([
        {label:"Positive",value:posCount,tone:"gold"},
        {label:"Mixed",value:mixCount,tone:"muted"},
        {label:"Negative",value:negCount,tone:"bad"}
      ],{format:v=>v+" review"+(v===1?"":"s")}):"")+'</div>';
  } else {
    body+='<div class="produce-modal-card"><h4>No reviews filed</h4><p>Nothing has been screened for press yet. Critics weigh in from the first paid preview.</p></div>';
  }

  if(f.inTheaters){
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>LIVE OPS CAMPAIGNS</b><span>theatrical boosts</span></div>'+
      '<p class="bo-figure-cap">Spend while the film is on screens. Each campaign buys legs or buzz, and each one is booked against the picture, not the studio.</p>'+
      '<div class="produce-modal-grid">'+
        '<button class="produce-ghost" id="revLiveTiktok"><b>TikTok viral · $1.5M</b><small>+12% legs</small></button>'+
        '<button class="produce-ghost" id="revLiveMidnight"><b>Midnight stunt · $0.8M</b><small>+4 audience, +15% legs</small></button>'+
        '<button class="produce-ghost" id="revLiveBlitz"><b>Influencer tour · $2.2M</b><small>+22% weekly box office</small></button>'+
        '<button class="produce-ghost" id="revLiveLeak"><b>Controversy leak · $0.4M</b><small>+25% buzz, reputation risk</small></button>'+
      '</div></div>';
  }

  revs.slice().sort((a,b)=>b.score-a.score).forEach(function(r){
    const cats=r.cats||{};
    const criticDef = (DATA.CRITICS||[]).find(c=>c.name===r.name || c.id===r.id);
    let biasStr = "";
    if(criticDef){
      if(criticDef.hates && criticDef.hates.includes(f.genre)) biasStr = " · harsh on "+DATA.GENRES[f.genre].name.toLowerCase();
      else if(criticDef.loves && criticDef.loves.includes(f.genre)) biasStr = " · champion of "+DATA.GENRES[f.genre].name.toLowerCase();
      else if(criticDef.harsh > 4) biasStr = " · notorious cynic";
      else if(criticDef.harsh < -3) biasStr = " · generous scorer";
    }
    const cat=(k,label)=>cats[k]!=null?('<div class="bo-track-row"><span class="bo-track-label">'+label+'</span><span class="bo-track"><i style="width:'+clamp(cats[k],0,10)*10+'%"></i></span><span class="bo-track-val">'+cats[k]+'</span></div>'):"";
    body+='<div class="produce-modal-card review-card">'+
      '<div class="bo-figure-head"><b>'+esc(r.name)+'</b><span class="'+(r.score>=70?"pos":r.score>=50?"":"neg")+'">'+r.score+'/100'+(r.sentiment?" · "+r.sentiment:"")+'</span></div>'+
      '<p class="bo-figure-cap">'+esc(r.outlet)+biasStr+'</p>'+
      '<p class="bo-review-quote">“'+esc(r.quote)+'”</p>'+
      '<div class="bo-track-rows">'+cat("story","Story")+cat("direction","Direction")+cat("acting","Acting")+cat("production","Production")+cat("entertainment","Entertainment")+cat("originality","Originality")+'</div>'+
    '</div>';
  });

  if(f.reviewBombed) body+='<div class="bo-callout bad"><b>REVIEW BOMBING</b><p>An organised pile-on cost this film '+f.reviewBombed+' audience points — and the word of mouth that goes with them.</p></div>';
  body+='</div>';

  const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+revs.length+' review'+(revs.length===1?"":"s")+' · critics '+crit+'% · audience '+aud+'%</span>'+
    '<div class="row" style="margin:0;gap:8px"><button class="produce-ghost" id="revClose">Close</button></div></div>';

  const v=openModal(head+body+foot,{className:"command-produce-modal"});
  const cl=v.querySelector("#revClose"); if(cl) cl.onclick=()=>closeModal();
  const bTiktok = v.querySelector("#revLiveTiktok");
  if(bTiktok) bTiktok.onclick=()=>{ launchLiveOpsCampaign(f.id, "tiktok_viral"); closeModal(); reviewsModal(fid); };
  const bMid = v.querySelector("#revLiveMidnight");
  if(bMid) bMid.onclick=()=>{ launchLiveOpsCampaign(f.id, "midnight_stunt"); closeModal(); reviewsModal(fid); };
  const bBlitz = v.querySelector("#revLiveBlitz");
  if(bBlitz) bBlitz.onclick=()=>{ launchLiveOpsCampaign(f.id, "influencer_blitz"); closeModal(); reviewsModal(fid); };
  const bLeak = v.querySelector("#revLiveLeak");
  if(bLeak) bLeak.onclick=()=>{ launchLiveOpsCampaign(f.id, "leak_controversy"); closeModal(); reviewsModal(fid); };
}

/* ═══════════ v32: Individual Film Details & Full International Breakdown ═══════════ */
function openFilmDetailsModal(filmId){
  const f = (G.films||[]).find(x => x.id === +filmId || String(x.id)===String(filmId));
  if(!f) return;
  const sp = boSplit(f);
  const be = breakevenWW(f);
  const profit = Math.round((sp.ww - be) * 10) / 10;
  const domPct = sp.ww > 0 ? Math.round((sp.dom / sp.ww) * 100) : 50;
  const intlPct = 100 - domPct;
  const mult = boMult(f);
  const legs = boLegs(f);
  const crit = f.criticAvg != null ? f.criticAvg : (f.quality ? f.quality.critic : 50);
  const aud = (typeof audienceScoreOf === "function") ? audienceScoreOf(f) : (f.quality ? f.quality.aud : 50);
  const regs = (typeof regionSplit === "function") ? regionSplit(f) : [];
  const state = f.inTheaters ? "IN THEATERS" : f.soldTo ? "LICENSED TO "+String(f.soldTo).toUpperCase() : f.onOwn ? "ON PLATFORM" : "IN VAULT";

  const head='<div class="produce-modal-head"><span class="command-eyebrow">FILM DOSSIER / '+esc(((DATA.GENRES[f.genre]||{}).name||f.genre)).toUpperCase()+'</span>'+
    '<h3>'+esc(f.title)+'</h3>'+
    '<p>'+esc(f.rating||"PG-13")+' · '+state+' · released Y'+yearOf(f.releaseWeek||G.week)+' W'+woyOf(f.releaseWeek||G.week)+
    (f.franchiseName?' · franchise <b>'+esc(f.franchiseName)+'</b>':'')+'</p></div>';

  const kpi=(label,value,note,tone)=>"<div class='bo-kpi"+(tone?" "+tone:"")+"'><small>"+label+"</small><b>"+value+"</b>"+(note?"<span>"+note+"</span>":"")+"</div>";
  let body='<div class="produce-modal-body">';
  body+="<div class='bo-kpis'>"+
    kpi("Domestic",fmtG(sp.dom),domPct+"% of worldwide")+
    kpi("International",fmtG(sp.intl),intlPct+"% of worldwide")+
    kpi("Worldwide",fmtG(sp.ww),"all territories")+
    kpi("Net studio profit",(profit>=0?"+":"")+fmtM(profit),profit>=0?"above breakeven":"below breakeven",profit>=0?"good":"bad")+
    kpi("Production budget",fmtM(f.budget),"negative cost")+
    kpi("P&A marketing",fmtM(f.marketing||0),"prints and advertising")+
    kpi("Rentals received",fmtM(f.rentalsDom||Math.round(sp.dom*0.53*10)/10),"~53% of domestic")+
    kpi("Multiplier",mult+"×","worldwide ÷ opening",mult>=2.5?"good":mult<1.6?"bad":"")+
  "</div>";

  body+="<figure class='bo-figure'><div class='bo-figure-head'><b>REVENUE SPLIT</b><span>"+fmtG(sp.ww)+" worldwide</span></div>"+
    ((typeof BOCharts!=="undefined")?BOCharts.split([
      {label:"Domestic",value:sp.dom,tone:"gold"},
      {label:"International",value:sp.intl,tone:"teal"}
    ],{format:BOCharts.money}):"")+
    "<p class='bo-figure-cap'>Breakeven for this release is <b>"+fmtG(be)+"</b> worldwide. Legs stand at "+legs+"× the opening weekend.</p></figure>";

  if(regs && regs.length){
    const maxReg=Math.max.apply(null, regs.map(r=>r.gross||0).concat([0.1]));
    const rows=regs.map(r=>{
      const share=sp.ww>0?Math.round(((r.gross||0)/sp.ww)*100):0;
      return "<div class='bo-track-row'><span class='bo-track-label'>"+(r.emoji||"🌐")+" "+esc(r.name)+"<small>"+share+"% of worldwide</small></span>"+
        "<span class='bo-track teal'><i style='width:"+Math.max(2,(r.gross||0)/maxReg*100).toFixed(1)+"%'></i></span>"+
        "<span class='bo-track-val'>"+fmtG(r.gross||0)+"</span></div>";
    }).join("");
    body+="<div class='produce-modal-card'><div class='bo-figure-head'><b>INTERNATIONAL TERRITORIES</b><span>"+regs.length+" markets</span></div><div class='bo-track-rows'>"+rows+"</div>"+
      "<p class='bo-figure-cap'>Territorial splits settle as international runs expand. Deal terms are set at release; the desk only reports them.</p></div>";
  } else {
    body+="<div class='produce-modal-card'><h4>No territorial split yet</h4><p>Global splits settle as international runs expand across territories.</p></div>";
  }

  body+="<div class='produce-modal-card'><div class='bo-figure-head'><b>KEY CREATIVE</b><span>critics "+crit+"% · audience "+aud+"%</span></div>"+
    "<div class='bo-track-rows'>"+
      "<div class='bo-track-row'><span class='bo-track-label'>Director</span><span class='bo-track-val'>"+(f.director?esc(f.director.name):"In-house")+"</span></div>"+
      "<div class='bo-track-row'><span class='bo-track-label'>Writer</span><span class='bo-track-val'>"+(f.writer?esc(f.writer.name):"Studio staff")+"</span></div>"+
      "<div class='bo-track-row'><span class='bo-track-label'>Producer</span><span class='bo-track-val'>"+(f.producer?esc(f.producer.name):"Studio unit")+"</span></div>"+
      "<div class='bo-track-row'><span class='bo-track-label'>Top cast</span><span class='bo-track-val'>"+((f.cast||[]).map(c=>esc(c.name)).join(", ")||"Ensemble")+"</span></div>"+
    "</div></div>";
  body+="</div>";

  let actions='<button class="produce-ghost" id="dossierTerritoryDeals">🌍 Territory deals</button>'+
    (!f.inTheaters && typeof canRerelease === "function" && canRerelease(f) ? '<button class="produce-ghost" id="dossierRe">🎟 Theatrical re-release</button>' : "")+
    (!f.inTheaters && typeof canReboot === "function" && canReboot(f) ? '<button class="produce-ghost" id="dossierReboot">🔁 Franchise reboot</button>' : "")+
    (!f.inTheaters && !f.directorsCut && f.ww >= 100 ? '<button class="produce-ghost" id="dossierCut">✂ Director\'s cut</button>' : "")+
    (typeof MerchLicensing !== "undefined" ? '<button class="produce-action" id="dossierMerch">🧸 Sign merchandising</button>' : "")+
    (typeof SyndicationTV !== "undefined" ? '<button class="produce-ghost" id="dossierTV">📡 TV syndication</button>' : "");
  const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+fmtG(sp.ww)+' worldwide · '+fmtG(f.opening||0)+' opening · '+mult+'× multiplier</span>'+
    '<div class="bo-dossier-actions">'+actions+'<button class="produce-ghost" id="dossierClose">Close</button></div></div>';

  const v = openModal(head+body+foot,{className:"command-produce-modal"});
  const btnClose=v.querySelector("#dossierClose"); if(btnClose) btnClose.onclick=()=>closeModal();
  const bTerr = v.querySelector("#dossierTerritoryDeals");
  if(bTerr) bTerr.onclick = () => { closeModal(); if(typeof openTerritoryDealsModal === "function") openTerritoryDealsModal(f.id); };
  const btnRe = v.querySelector("#dossierRe");
  if(btnRe) btnRe.onclick = () => { closeModal(); if(typeof reReleaseFilm === "function") reReleaseFilm(f.id); render(); };
  const btnRb = v.querySelector("#dossierReboot");
  if(btnRb) btnRb.onclick = () => { closeModal(); if(typeof rebootFilm === "function") rebootFilm(f.id); render(); };
  const btnCut = v.querySelector("#dossierCut");
  if(btnCut) btnCut.onclick = () => { closeModal(); if(typeof makeDirectorsCut === "function") makeDirectorsCut(f); render(); };
  const btnMerch = v.querySelector("#dossierMerch");
  if(btnMerch) btnMerch.onclick = () => { closeModal(); if(typeof openMerchDeskModal === "function") openMerchDeskModal(); };
  const btnTV = v.querySelector("#dossierTV");
  if(btnTV) btnTV.onclick = () => { closeModal(); if(typeof openSyndicationModal === "function") openSyndicationModal(); };
}

/* ═══════════ VIEW: box office ═══════════ */
/* Box office: read-only visualization + WHY explainer from existing film data. */
function boSplit(f){
  try{
    const dom = Math.round((f.dom||0)*10)/10;
    const share = f.presales ? 0 : (DATA.GENRES[f.genre] ? DATA.GENRES[f.genre].intlShare : 0.45);
    let intl = (typeof f.intl === "number" && isFinite(f.intl)) ? f.intl : Math.max(0, Math.round(((f.ww||0) - dom)*10)/10);
    if(intl === 0 && !f.presales && dom > 0){
      intl = Math.max(0, Math.round((dom / Math.max(0.01, 1 - share) - dom) * 10) / 10);
    }
    const ww = (typeof f.ww === "number" && isFinite(f.ww) && f.ww > 0) ? f.ww : Math.round((dom + intl) * 10) / 10;
    return { dom, intl, ww };
  }catch(e){ return { dom: f.dom||0, intl: f.intl||0, ww: f.ww||f.dom||0 }; }
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
  if(!rows.length) return "<p class='bo-figure-cap'>No signal yet — the desk needs a weekend of data.</p>";
  return "<div class='bo-why'>"+rows.map(r=>"<div class='bo-why-row "+(r[0]==="+"?"up":"down")+"'><span class='bo-why-mark'>"+(r[0]==="+"?"+":"−")+"</span><span>"+r[1]+"</span></div>").join("")+"</div>";
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
  return "<article class='bo-rival rival-card' data-rival='"+esc(r.name)+"' style='cursor:pointer;border-left:3px solid "+(r.color||"#4e6355")+"'>"+
    "<header><div><h3 style='color:"+(r.color||"#f3e8cc")+"'>"+esc(r.name)+"</h3>"+
      "<small>#"+rank+" of "+all.length+" · "+share+"% share of the town</small></div>"+
      "<span class='bo-track-val'>"+fmtM(r.ytd||0)+"<small>YTD</small></span></header>"+
    "<span class='bo-track'><i style='width:"+Math.max(3,share)+"%'></i></span>"+
    "<p class='bo-rival-line'><span>Strategy</span><b>"+esc(meta.strategy)+"</b></p>"+
    "<p class='bo-rival-line'><span>Strength</span><b class='pos'>"+esc(meta.strength)+"</b></p>"+
    "<p class='bo-rival-line'><span>Weakness</span><b class='neg'>"+esc(meta.weakness)+"</b></p>"+
    "<p class='bo-rival-slate'><b>Dated</b> — "+(up.length?up.map(f=>esc(f.title)+" ("+DATA.GENRES[f.genre].name+"/"+f.scale+", "+dateLabel(f.week)+")").join(" · "):"nothing dated")+"</p>"+
    "<p class='bo-rival-slate'><b>Recent</b> — "+(done.length?done.map(f=>esc(f.title)+" "+fmtG(f.dom||0)+" dom"+((f.dom||0)>=(f.opening||0)*2.5?" 🔥":"")).join(" · "):"no releases yet")+"</p>"+
    (G.intel&&G.intel.until>G.week&&G.intel.name===r.name?"<span class='bo-chip gold'>INTEL ACTIVE</span>":"")+
  "</article>";
}
/* International dashboard: regional split of settled actuals. Live runs show
   estimates pro-rated from the current domestic pace; finished runs show final
   stored regions. Region grosses always sum to the film's intl total. */
function regionPanel(f){
  let regs=f.regions;
  try{ if(!regs||!regs.length) regs=regionSplit(f); }catch(e){ return ""; }
  if(!regs.length) return "";
  const lastWk=(f.weekly&&f.weekly.length)?f.weekly[f.weekly.length-1].gross:0;
  const live=!!f.inTheaters;
  const cities=cityRows(f);
  const intl=(f.ww||0)-(f.dom||0);
  const max=Math.max.apply(null, regs.map(r=>r.gross||0).concat([0.1]));
  let h="<div class='bo-track-rows'>";
  regs.forEach(r=>{
    const openEst=f.opening? Math.max(0,Math.round(f.opening*(r.gross/Math.max(1,intl))*10)/10):0;
    const wkEst=live? Math.max(0,Math.round(lastWk*(r.gross/Math.max(1,intl))*10)/10):0;
    const regAud = Math.round(clamp((r.aud || 50) + (r.audAdj || 0) + (f.foreignLang && r.id==="europe"? 5:0) - (f.genre==="horror" && r.id==="eastasia"? 8:0) - (f.genre==="comedy" && r.id==="eastasia"? 5:0), 20, 95));
    const pct=Math.max(2,(r.gross||0)/max*100);
    h+="<div class='bo-track-row'>"+
      "<span class='bo-track-label'>"+r.emoji+" "+esc(r.name)+"<small>aud "+regAud+" · "+r.share+"% of WW"+(r.note?" · "+esc(r.note):"")+"</small></span>"+
      "<span class='bo-track teal'><i style='width:"+pct.toFixed(1)+"%'></i></span>"+
      "<span class='bo-track-val'>"+fmtG(r.gross||0)+(live?"<small>"+fmtG(wkEst)+"/wk</small>":"<small>open ≈ "+fmtG(openEst)+"</small>")+"</span>"+
    "</div>";
    const cr=cities.find(x=>x.region.id===r.id);
    if(cr) h+="<div class='bo-region-cities'>🏙 "+cr.cities.map(c=>esc(c.name)+" <b>"+fmtG(c.gross)+"</b>").join(" · ")+"</div>";
  });
  h+="</div><p class='bo-figure-cap'>"+(live?"Estimates split from the live domestic pace; totals update nightly.":"Final regional split.")+" Levers: staggered rollout, the international campaign channel and a foreign-language bonus.</p>";
  return h;
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
    regs.forEach(r=>{
      const t = totals.find(x=>x.id===r.id);
      if(t){ t.gross += r.gross; t.count++; t.aud = t.count>0 ? Math.round((t.aud*(t.count-1) + r.aud)/t.count) : r.aud; }
    });
  });
  const totalIntl = totals.reduce((a,b)=>a+b.gross,0);
  const sorted = totals.slice().sort((a,b)=>b.gross-a.gross);
  const max = Math.max.apply(null, sorted.map(t=>t.gross).concat([0.1]));

  let h = "<div class='bo-kpis'>" +
    "<div class='bo-kpi'><small>TITLES REPORTING</small><b>" + films.length + "</b><span>films with international gross</span></div>" +
    "<div class='bo-kpi'><small>INTERNATIONAL</small><b>" + fmtG(totalIntl) + "</b><span>all-time, all markets</span></div>" +
    "<div class='bo-kpi'><small>TOP MARKET</small><b>" + (sorted[0] ? sorted[0].name : "—") + "</b><span>" + (sorted[0] ? fmtG(sorted[0].gross) + " · " + Math.round(sorted[0].gross/Math.max(1,totalIntl)*1000)/10 + "% of intl" : "no settled gross") + "</span></div>" +
    "<div class='bo-kpi'><small>MARKETS</small><b>" + sorted.filter(t=>t.gross>0).length + "</b><span>regions with receipts</span></div>" +
  "</div>";

  if(typeof BOCharts !== "undefined" && sorted.length){
    h += "<figure class='bo-figure'><div class='bo-figure-head'><b>INTERNATIONAL BY MARKET</b><span>" + fmtG(totalIntl) + " all-time</span></div>" +
      BOCharts.bars(sorted.map(t=>({label:(t.emoji||"")+" "+t.name.split(" ")[0], value:t.gross, tone:"teal"})), {aria:"International gross by market", format:BOCharts.money, compact:boCompact()}) +
      "<p class='bo-figure-cap'>Aggregated across every released picture, largest market first. Bars are gross, not share of the studio slate.</p></figure>";
  }

  h += "<div class='bo-track-rows'>";
  sorted.forEach(t=>{
    const pct = totalIntl>0 ? Math.round(t.gross/totalIntl*1000)/10 : 0;
    h += "<div class='bo-track-row'>" +
      "<span class='bo-track-label'>" + t.emoji + " " + esc(t.name) + "<small>" + t.count + " film" + (t.count===1?"":"s") + " · aud " + t.aud + "</small></span>" +
      "<span class='bo-track teal'><i style='width:" + Math.max(2, t.gross/max*100).toFixed(1) + "%'></i></span>" +
      "<span class='bo-track-val'>" + fmtG(t.gross) + "<small>" + pct + "% of intl</small></span>" +
    "</div>";
  });
  h += "</div>";
  return h;
}

/* Film comparison modal — side-by-side KPIs plus a shared comparison chart, so
   two runs are read on the same scale instead of two separate div stacks. */
function compareFilmsModal(){
  const sel = (G.compareSel||[]).map(id=>G.films.find(f=>f.id===id)).filter(Boolean);
  if(sel.length<2){ toast("Select at least 2 films to compare.","bad"); return; }
  const rows=sel.map(f=>{
    let be=0; try{ be=breakevenWW(f); }catch(e){ be=(f.budget||0)*2; }
    const mult=boMult(f), legs=boLegs(f);
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
    const crit=f.criticAvg!=null?f.criticAvg:(f.quality?f.quality.critic:50);
    const sp=boSplit(f);
    const verdict = f.streamingOriginal? "STREAMING ORIGINAL" :
      f.ww>=be*1.6? "SMASH" : f.ww>=be? "HIT" : f.ww>=be*0.75? "SOFT" : "FLOP";
    const tone = verdict==="SMASH"||verdict==="HIT" ? "good" : verdict==="SOFT" ? "gold" : "bad";
    return {f, be, mult, legs, aud, crit, sp, verdict, tone};
  });

  const head='<div class="produce-modal-head"><span class="command-eyebrow">LIBRARY / COMPARISON</span>'+
    '<h3>'+rows.length+' pictures, one scale</h3>'+
    '<p>Worldwide gross, legs and word of mouth side by side. Everything below reads off the same run data as the chart desk.</p></div>';

  let body='<div class="produce-modal-body">';
  if(typeof BOCharts!=="undefined"){
    body+="<figure class='bo-figure'><div class='bo-figure-head'><b>WORLDWIDE BY PICTURE</b><span>"+fmtG(rows.reduce((a,r)=>a+r.sp.ww,0))+" combined</span></div>"+
      BOCharts.bars(rows.map((r,i)=>({label:r.f.title.slice(0,12),value:r.sp.ww,tone:i===0?"gold":"muted"})),{aria:"Worldwide gross comparison",format:BOCharts.money,compact:boCompact()})+
      "<p class='bo-figure-cap'>"+rows.map((r,i)=>"<b"+(i===0?' style="color:#edc47c"':"")+">"+esc(r.f.title)+"</b> "+fmtG(r.sp.ww)).join(" · ")+"</p>"+
      "<p class='bo-figure-cap'>Domestic plus international, not adjusted for budget. A taller bar is not automatically the better release.</p></figure>";
  }

  body+='<div class="bo-compare-grid">';
  rows.forEach(r=>{
    const line=(label,value,tone)=>'<div class="bo-track-row"><span class="bo-track-label">'+label+'</span><span class="bo-track-val'+(tone?' '+tone:'')+'">'+value+'</span></div>';
    body+='<article class="produce-modal-card bo-compare-card">'+
      '<div class="bo-figure-head"><b>'+esc(r.f.title)+'</b><span class="bo-chip '+r.tone+'">'+r.verdict+'</span></div>'+
      '<div class="bo-track-rows">'+
        line("Budget",fmtM(r.f.budget||0))+
        line("Opening",fmtG(r.f.opening||0))+
        line("Domestic",fmtG(r.sp.dom))+
        line("International",fmtG(r.sp.intl))+
        line("Worldwide",fmtG(r.sp.ww))+
        line("Breakeven",fmtG(r.be))+
        line("Multiplier",r.mult+"×")+
        line("Legs",r.legs+"×")+
        line("Critics",r.crit+"%")+
        line("Audience",r.aud+"%")+
      '</div>'+
      ((typeof BOCharts!=="undefined")?BOCharts.split([
        {label:"Domestic",value:r.sp.dom,tone:"gold"},
        {label:"International",value:r.sp.intl,tone:"teal"}
      ],{format:BOCharts.money}):'')+
    '</article>';
  });
  body+='</div></div>';

  const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+rows.length+' selected · clears when you close</span>'+
    '<div class="row" style="margin:0;gap:8px"><button class="produce-ghost" id="compareClose">Close</button></div></div>';

  const v=openModal(head+body+foot,{className:"command-produce-modal",onClose:()=>{G.compareSel=[]; render();}});
  const cl=v.querySelector("#compareClose"); if(cl) cl.onclick=()=>closeModal();
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
  const myYtd=G.films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0);
  const all=[{n:"You",ww:myYtd}].concat(G.rivals.map(x=>({n:x.name,ww:x.ytd||0})));
  const tot=all.reduce((a,x)=>a+x.ww,0)||1;
  const rank=all.slice().sort((a,b)=>b.ww-a.ww).findIndex(x=>x.n===r.name)+1;
  const share=Math.round((r.ytd||0)/tot*100);
  const myShare=Math.round(myYtd/tot*100);
  const cash=r.cash||0, debt=r.debt||0, rep=r.rep||25;
  const kpi=(label,value,note)=>'<div class="bo-kpi"><small>'+label+'</small><b>'+value+'</b><span>'+note+'</span></div>';

  const head='<div class="produce-modal-head"><span class="command-eyebrow">COMPETITION / STUDIO DOSSIER</span>'+
    '<h3><span style="color:'+(r.color||"#edc47c")+'">●</span> '+esc(r.name)+'</h3>'+
    '<p>'+esc(r.blurb||"")+' · ranked #'+rank+' of '+all.length+' studios · '+share+'% market share · reputation '+rep+'</p></div>';

  let body='<div class="produce-modal-body">';
  body+='<div class="bo-kpis">'+
    kpi("YEAR TO DATE",fmtM(r.ytd||0),"worldwide gross")+
    kpi("MARKET SHARE",share+"%","you: "+myShare+"%")+
    kpi("REPUTATION",String(rep),"out of 100")+
    kpi("CASH / DEBT",fmtM(cash)+" / "+fmtM(debt),cash>=debt?"solvent":"leveraged",cash>=debt?"good":"bad")+
  '</div>';

  body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>HOW THEY COMPETE</b><span>'+esc(String(style||"balanced").toUpperCase())+'</span></div>'+
    '<p class="bo-figure-cap">'+esc(meta.strategy)+'</p>'+
    '<div class="bo-track-rows">'+
      '<div class="bo-track-row"><span class="bo-track-label">Strength</span><span class="bo-track-val pos">'+esc(meta.strength)+'</span></div>'+
      '<div class="bo-track-row"><span class="bo-track-label">Weakness</span><span class="bo-track-val neg">'+esc(meta.weakness)+'</span></div>'+
    '</div></div>';

  const slateRow=(f)=>'<div class="bo-track-row"><span class="bo-track-label">'+esc(f.title)+'<small>'+DATA.GENRES[f.genre].name+' / '+f.scale+'</small></span>'+
    '<span class="bo-track-val">'+dateLabel(f.week)+'</span></div>';
  body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>DATED SLATE</b><span>'+up.length+' upcoming</span></div>'+
    (up.length?'<div class="bo-track-rows">'+up.map(slateRow).join("")+'</div>':'<p class="bo-figure-cap">Nothing dated — this studio is holding its corridor cards.</p>')+'</div>';

  const doneRow=(f)=>'<div class="bo-track-row"><span class="bo-track-label">'+esc(f.title)+'<small>opened '+fmtG(f.opening||0)+'</small></span>'+
    '<span class="bo-track-val">'+fmtG(f.dom||0)+((f.dom||0)>=(f.opening||0)*2.5?'<small>strong legs</small>':'')+'</span></div>';
  body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>RECENT RELEASES</b><span>'+done.length+' on record</span></div>'+
    (done.length?'<div class="bo-track-rows">'+done.map(doneRow).join("")+'</div>':'<p class="bo-figure-cap">No releases yet this career.</p>')+'</div>';

  const hasYtd=(r.ytd||0)+(myYtd||0)>0;
  body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>HEAD TO HEAD</b><span>this year</span></div>'+
    (hasYtd?((typeof BOCharts!=="undefined")?BOCharts.split([
      {label:esc(r.name),value:Math.max(0,r.ytd||0),tone:"muted"},
      {label:"You",value:Math.max(0,myYtd),tone:"gold"}
    ],{format:BOCharts.money}):''):
      '<p class="bo-figure-cap">Neither studio has banked a release yet this year — the first opening weekend sets this market.</p>')+
    (hasYtd?'<p class="bo-figure-cap">Year-to-date worldwide gross across every studio in the market.</p>':'')+'</div>';
  body+='</div>';

  const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+fmtM(r.ytd||0)+' YTD · #'+rank+' of '+all.length+' · '+share+'% share</span>'+
    '<div class="row" style="margin:0;gap:8px"><button class="produce-ghost" onclick="closeModal()">Close</button></div></div>';

  openModal(head+body+foot,{className:"command-produce-modal"});
}

/* Audience demo panel — pre-release estimates vs post-release actuals:
   read off the actual opening and legs. Same card pre-release (screening) and live. */
function demoPanel(f){
  let pr;
  try{ pr=demoProfile(f); }catch(e){ return ""; }
  let h="<p class='bo-figure-cap'>Reach index <b>"+pr.potential+"/100</b> · converts the core at <b>"+pr.conversion+"</b> · retains at <b>"+pr.retention+"</b>.</p><div class='bo-track-rows'>";
  pr.rows.forEach(r=>{
    const pct=Math.max(2,clamp(r.appeal,0,100));
    const tone=r.appeal>=70?"":r.appeal<45?" bad":"";
    h+="<div class='bo-track-row'>"+
      "<span class='bo-track-label'>"+r.icon+" "+esc(r.name)+"<small>"+r.size+"% of market</small></span>"+
      "<span class='bo-track"+tone+"'><i style='width:"+pct+"%'></i></span>"+
      "<span class='bo-track-val'>"+r.appeal+"</span>"+
    "</div>";
  });
  h+="</div><p class='bo-figure-cap'>Strongest: <b>"+pr.strongest.icon+" "+esc(pr.strongest.name)+"</b> · weakest: "+pr.weakest.icon+" "+esc(pr.weakest.name)+". Aim pitch angles and campaign channels at the strongest crowd — matched channels hit ×1.5 hype.</p>";
  return h;
}
/* Social buzz panel: hype/memes/theories/controversy/sentiment from the film's
   real social state (tickBuzz writes it) plus live flags. Buzz nudges move
   openings, so this is signal — not decoration. */
function socialPanel(f){
  const s=f.social||{hype:0, memes:0, theories:0, controversy:0};
  const pos=(s.hype||0)+(s.memes?2:0)+(s.theories?1:0), neg=(s.controversy||0)+((f.cast||[]).some(c=>c.scandal>0)?1:0)+(f.reviewBombed?2:0);
  const sent=pos-neg>=2?"Positive":neg-pos>=2?"Negative":"Mixed";
  let h="<div class='bo-split'>";
  h+=(typeof BOCharts!=="undefined")?BOCharts.split([
    {label:"Positive signal",value:Math.max(0,pos),tone:"teal"},
    {label:"Negative signal",value:Math.max(0,neg),tone:"bad"}
  ],{format:v=>Math.round(v)+" pts"}):"";
  h+="</div><div class='bo-chip-row'><span class='bo-chip "+(sent==="Positive"?"good":sent==="Negative"?"bad":"gold")+"'>"+sent.toUpperCase()+"</span>";
  if(s.memes) h+="<span class='bo-chip good'>MEME MACHINE</span>";
  if(s.theories&&!s.memes) h+="<span class='bo-chip'>FAN THEORIES</span>";
  if(s.controversy) h+="<span class='bo-chip bad'>CONTROVERSY "+s.controversy+"</span>";
  if((f.cast||[]).some(c=>c.scandal>0)) h+="<span class='bo-chip bad'>STAR SCANDAL</span>";
  if(f.reviewBombed) h+="<span class='bo-chip bad'>BRIGADED SCORE</span>";
  h+="</div><p class='bo-figure-cap'>"+(pos+neg===0?"Quiet feeds. Big openings, beloved films and hot casts make noise.":"Hype is a leading indicator: it lifts the opening and the first two weekends.")+"</p>";
  return h;
}
function topRegionLine(f){
  try{
    let regs=f.regions; if(!regs||!regs.length) regs=regionSplit(f);
    const top=regs.slice().sort((a,b)=>b.gross-a.gross)[0];
    if(!top) return "";
    return "<div class='tiny muted'>Top region: "+top.emoji+" "+top.name+" "+fmtG(top.gross)+" ("+top.share+"% WW · aud "+top.aud+")</div>";
  }catch(e){ return ""; }
}
function boxOfficeCorridorForecast(){
  let h="<div class='section-title' style='margin-top:16px'>📅 12-Week Forward Release Corridor</div>"+
    "<div class='tiny muted' style='margin:-4px 0 8px'>Forward-looking seasonality, holiday corridor lifts, and competitive congestion across upcoming weekends.</div>";
  h+="<div class='grid' style='grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:6px'>";
  for(let i=1; i<=12; i++){
    const targetWk = G.week + i;
    const seas = DATA.seasonOf(woyOf(targetWk));
    const myDated = (G.projects||[]).filter(p=>p.releaseWeek===targetWk).length;
    const rivalDated = (G.rivals||[]).reduce((sum,r)=>sum + (r.slate||[]).filter(f=>f.week===targetWk).length, 0);
    const isPeak = seas.season >= 1.15 || seas.holiday;
    h+="<div class='card' style='padding:8px 4px;text-align:center;"+(isPeak?"border-color:rgba(245,185,66,.45);background:rgba(245,185,66,.06)":"")+"'>"+
      "<div class='tiny muted'>Wk "+targetWk+"</div>"+
      "<b style='font-size:12px'>"+seas.month+"</b>"+
      "<div class='tiny "+(seas.season>=1.1?"pos":seas.season<=0.9?"neg":"gold")+"'>×"+seas.season.toFixed(2)+"</div>"+
      "<div class='tiny' style='margin-top:3px'>"+(myDated?"<span class='gold'>🎬"+myDated+"</span> ":"")+(rivalDated?"<span class='muted'>⚔️"+rivalDated+"</span>":"<span class='tiny muted'>open</span>")+"</div>"+
      "</div>";
  }
  h+="</div>";
  return h;
}
function boxOfficeVaultBrowser(){
  const films = typeof maVaultActive==="function" ? maVaultActive() : [];
  if(!films.length) return "";
  let h="<div class='tiny muted' style='margin-bottom:8px'>Acquired catalog titles held in the vault. They can be given theatrical rollouts, sold outright, or licensed.</div><div class='grid g2'>";
  films.forEach(f=>{
    const estWW = Math.round((f.opening||f.weight||6) * 2.2 / (1 - clamp((DATA.GENRES[f.genre]&&DATA.GENRES[f.genre].intlShare)||0.5, 0.1, 0.85))*10)/10;
    h+="<div class='card'><div class='spread'><b>"+(DATA.GENRES[f.genre]?DATA.GENRES[f.genre].emoji:"🎞")+" "+esc(f.title)+"</b><span class='tag blue'>vault</span></div>"+
      "<div class='tiny muted'>"+(DATA.GENRES[f.genre]?DATA.GENRES[f.genre].name:f.genre)+" · quality "+Math.round(f.quality)+" · weight "+fmtG(f.weight||6)+"</div>"+
      "<div class='cost-line'><span>Est. Worldwide Potential</span><b class='gold'>~"+fmtG(estWW)+"</b></div>"+
      "<div class='cost-line'><span>Status</span><b>"+(f.week>G.week?"Dated Wk "+f.week:"Undated vault")+"</b></div>"+
      "</div>";
  });
  h+="</div>";
  return fold("vault-browser", "🏛 Acquired Library Vault ("+films.length+" titles)", h, {open:false});
}

/* ═══════════ VIEW: box office — one market desk, seven readings ═══════════
   Story Department rules apply here too: a single branded header, one numbered
   section rail, and produce panels inside. Every figure is read from the live
   career — runs, rival slates, chain relations and settled regions. */
const BOXOFFICE_SECTIONS = [
  ["chart","Theatrical chart"],
  ["chains","Mega-chains"],
  ["plf","PLF & concessions"],
  ["blitz","Marketing blitz"],
  ["territories","Territory deals"],
  ["awards","Awards circuit"],
  ["clash","Clash radar"]
];
const BOXOFFICE_COPY = {
  chart: ["03 / THE WEEKEND","What the town is paying to see","Every screen reports on Monday morning. This is who won the weekend, who is still earning, and where your own runs stand against the town."],
  chains: ["03 / SCREENS","The circuits decide how wide you open","Five chains hold most of the domestic screens. Booking relations set your print count; court them before the next date, not after."],
  plf: ["03 / PREMIUM","Large format is where the margin lives","IMAX and Dolby screens carry ticket surcharges and concession splits. Master the deliverables and the premium run pays for itself."],
  blitz: ["03 / CAMPAIGN","Marketing is a spend curve, not a switch","Outdoor, digital, radio and premieres each buy a different kind of attention. Pace the blitz against the corridor you actually dated."],
  territories: ["03 / TERRITORIES","Where the money crosses borders","Regional splits, local audience scores and city-level grosses. A strong domestic run still only tells half of the story."],
  awards: ["03 / SEASON","Awards are a second release","Bodies and festivals run on their own calendar. A campaign that lands in the right week reopens a picture that already closed."],
  clash: ["03 / COLLISION","Read the corridor before you date","Twelve weekends of seasonality, holidays and rival slates. Two tentpoles on one date costs both of them screens."]
};
function boxOfficeHead(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  const copy=BOXOFFICE_COPY[BOXOFFICE_SUB]||BOXOFFICE_COPY.chart;
  return `<header class="command-heading"><div><span class="command-edition">BOX OFFICE DESK / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">${copy[0]}</span><h1>${copy[1]}</h1><p>${copy[2]}</p></div><div class="command-date"><span>WEEK</span><b>${String(w).padStart(2,"0")}</b><small>${esc(m.month)}</small></div></header>`;
}
function boxOfficeTelemetry(){
  let chart=[]; try{ chart=weeklyChart()||[]; }catch(e){ chart=[]; }
  const weekDom=chart.reduce((a,c)=>a+(c.gross||0),0);
  let live=[]; try{ live=activeFilms()||[]; }catch(e){ live=[]; }
  const yourWw=live.reduce(function(a,f){ let sp={dom:f.dom||0,intl:0}; try{ sp=boSplit(f); }catch(e){} return a+(sp.dom||0)+(sp.intl||0); },0);
  return `<div class="command-telemetry">${commandMetric("DOMESTIC / WEEK",fmtG(weekDom),"Every picture")}${commandMetric("YOUR RUNS",String(live.length),"In theaters")}${commandMetric("YOUR WW",fmtG(yourWw),"Domestic + intl")}${commandMetric("ON THE BOARD",String(chart.length),"Films this week")}</div>`;
}
function boxOfficeNav(){
  const active=BOXOFFICE_SECTIONS.some(s=>s[0]===BOXOFFICE_SUB)?BOXOFFICE_SUB:"chart";
  return `<nav class="command-section-nav command-boxoffice-nav" aria-label="Box office sections"><div class="command-nav-brand"><span>BOX OFFICE DESK</span><small>CHART / SCREENS / TERRITORIES</small></div><div class="command-nav-items">${BOXOFFICE_SECTIONS.map(([key,label],i)=>`<button data-bosub="${key}" class="${active===key?"active":""}" aria-current="${active===key?"page":"false"}"><small>0${i+1}</small><span>${label}</span></button>`).join("")}</div><div class="command-nav-tools"><button id="btnBoScreenings" aria-label="Audience screenings — festival and press screenings"><small>TOOL / AUDIENCE</small><span>Screenings</span></button><button id="btnBoTheaters" aria-label="Theater chains desk"><small>TOOL / CIRCUITS</small><span>Theater chains</span></button><button id="btnBoGrosses" aria-label="Weekend grosses analytics"><small>TOOL / ANALYTICS</small><span>Weekend grosses</span></button><button id="btnBoLibrary" aria-label="Film library — open the catalogue"><small>TOOL / CATALOGUE</small><span>Film library</span></button></div></nav>`;
}
function boxOfficePanel(eyebrow,title,description,content,stamp){
  return `<section class="produce-panel"><div class="produce-panel-head"><div><span class="command-eyebrow">${eyebrow}</span><h2>${title}</h2>${description?`<p>${description}</p>`:""}</div>${stamp?`<span class="produce-stamp">${stamp}</span>`:""}</div>${content}</section>`;
}
function boxOfficeChartPanel(){
  let chart=[]; try{ chart=weeklyChart()||[]; }catch(e){ chart=[]; }
  if(!chart.length){
    return boxOfficePanel("THE WEEKEND CHART","Where the money went","Nothing is playing this week. A film earns nothing until it is dated.","<div class='bo-empty'><b>The multiplex is dark.</b><p>No picture is on screens right now. Finish a film, then date it from Productions to open a run.</p><button class='produce-action' onclick=\"switchTab('productions')\">Open productions →</button></div>","NO RUNS");
  }
  const max=Math.max(1,...chart.map(c=>c.gross||0));
  const rows=chart.map((c,i)=>`<div class="bo-chart-row${c.mine?" mine":""}"><span class="bo-rank">${String(i+1).padStart(2,"0")}</span><div class="bo-chart-name"><b>${c.mine?"🎬 ":""}${esc(c.title)}</b><small>${(DATA.GENRES[c.genre]||{}).name||esc(c.genre||"Feature")} · wk ${c.weeksOut}${c.mine?"":" · "+esc(c.studio||"independent")}</small></div><span class="bo-chart-bar"><i style="width:${Math.max(4,(c.gross||0)/max*100)}%${c.mine?"":";background:"+(c.color||"#4a5570")}"></i></span><b class="bo-chart-gross">${fmtG(c.gross||0)}</b></div>`).join("");
  const mine=chart.filter(c=>c.mine).length;
  return boxOfficePanel("THE WEEKEND CHART","Where the money went","Domestic gross for the current weekend, ranked. Gold bars are your pictures.","<div class=\"bo-chart\">"+rows+"</div><footer class=\"bo-foot\"><span>"+mine+" of yours on the board</span><b>Leader: "+esc(chart[0].title)+" · "+fmtG(chart[0].gross||0)+"</b></footer>",chart.length+" FILMS");
}
function boxOfficeCompetitionPanel(){
  const intel=(G.intel&&G.intel.until>G.week)?`<p class="produce-note">🕵 Intel active on ${esc(G.intel.name)} — ${G.intel.until-G.week} weeks left.</p>`:"";
  return boxOfficePanel("COMPETITION","The other studios","They date corridors by style, blink when you out-muscle their weekend, poach hot free talent and launch streamers. Slates re-seed yearly.",`<div class="produce-filters bo-actions"><button class="produce-ghost" id="btnDeployCounterIntel">🛡️ Counter-intel ($2M)</button><button class="produce-ghost" data-intel="1">🕵 Buy intel ($8M)</button></div>${intel}<div class="produce-cards bo-rivals">${(G.rivals||[]).map(rivalProfile).join("")}</div>`,`${(G.rivals||[]).length} RIVALS`);
}
/* The corridor as twelve weekend cells — seasonality, holiday lift and who is
   already dated. Same numbers as the legacy forecast, without its section title. */
function boxOfficeCorridorGrid(){
  const cells=[];
  for(let i=1;i<=12;i++){
    const w=G.week+i, seas=DATA.seasonOf(woyOf(w));
    const mine=(G.projects||[]).filter(p=>p.releaseWeek===w).length;
    const rivals=(G.rivals||[]).reduce((sum,r)=>sum+(r.slate||[]).filter(f=>f.week===w).length,0);
    const peak=seas.season>=1.15||!!seas.holiday;
    cells.push(`<div class="bo-weekend${peak?" peak":""}"><small>${seas.month} W${woyOf(w)}</small><b>×${seas.season.toFixed(2)}</b><span>${mine?`<em class="mine">${mine} yours</em>`:""}${rivals?`<em class="rivals">${rivals} rival</em>`:""}${!mine&&!rivals?`<em class="open">open</em>`:""}</span></div>`);
  }
  return `<div class="bo-weekends">${cells.join("")}</div>`;
}
function boxOfficeCorridorPanel(){
  return boxOfficePanel("CORRIDOR","The next twelve weekends","Seasonality, holiday lifts and who is already dated. A quiet weekend is an invitation; a crowded one costs you screens.",boxOfficeCorridorGrid(),"12 WEEKS");
}
function boxOfficeRunsPanel(){
  let live=[]; try{ live=activeFilms()||[]; }catch(e){ live=[]; }
  return boxOfficePanel("LIVE RUNS","Your films in theaters","Week-by-week gross, screen count and audience word of mouth for every picture still earning.","<div class=\"bo-runs\">"+boxOfficeRuns()+"</div>",`${live.length} RUNNING`);
}
function boxOfficeLibraryPanel(){
  return boxOfficePanel("CATALOGUE","Every picture you have released","Sort by worldwide gross, compare two titles, or open a dossier. Rename, re-release and reboot live here.","<div class=\"bo-lib\">"+boxOfficeLibrary()+"</div>",`${(G.films||[]).length} TITLES`);
}
function boxOfficeChainsPanel(){
  const cards=(DATA.CHAINS||[]).map(dc=>{
    const c=(typeof chainById==="function"?chainById(dc.id):null)||dc;
    const rel=Math.round(c.rel);
    const cost=(typeof chainCourtCost==="function")?chainCourtCost(c):0;
    const taste=(c.taste?Object.keys(c.taste):[]).slice(0,3).map(g=>(DATA.GENRES[g]||{}).name||g).join(", ");
    return `<article class="bo-chain-card"><header><div><h3>${c.emoji} ${esc(c.name)}</h3><small>${Math.round((c.screens||0)*100)}% of domestic screens</small></div><span class="bo-chain-rel ${rel>=65?"good":rel<40?"bad":""}">${rel}/100</span></header><p>${esc(c.blurb||"")}</p><dl><div><dt>Books generously</dt><dd>${esc(taste||"—")}</dd></div><div><dt>Court cost</dt><dd>${fmtM(cost)}</dd></div></dl><button class="produce-ghost" data-court="${c.id}">🤝 Court the circuit</button></article>`;
  }).join("");
  const circuits=(typeof FilmLocationsTax!=="undefined"&&typeof FilmLocationsTax.renderTheaterChainsSection==="function")?`<div class="bo-module">${FilmLocationsTax.renderTheaterChainsSection()}</div>`:"";
  return boxOfficePanel("MEGA-CHAINS","Booking relations decide your print count","A warm circuit gives you screens in the first week; a cold one buries you on two shows a day.",`<div class="produce-cards bo-chains">${cards||"<div class='bo-empty'><b>No circuits loaded.</b><p>The booking desk did not report.</p></div>"}</div>${circuits}`,`${(DATA.CHAINS||[]).length} CIRCUITS`);
}
function boxOfficeModulePanel(eyebrow,title,description,html,stamp){
  const body=html?`<div class="bo-module">${html}</div>`:`<div class="bo-empty"><b>This desk did not load.</b><p>The specialist module is unavailable in this build — nothing has been lost from your save.</p></div>`;
  return boxOfficePanel(eyebrow,title,description,body,stamp);
}
function boxOfficeTerritoriesPanel(){
  let summary=""; try{ summary=regionSummaryPanel()||""; }catch(e){}
  const body=summary||`<div class="bo-empty"><b>No settled international grosses yet.</b><p>Regional splits appear once a release starts reporting outside the domestic market.</p></div>`;
  return boxOfficePanel("TERRITORY DEALS","How the international split settles","Aggregated across every released picture. Open a run's dossier from the chart for city-level detail.",`<div class="bo-module bo-territories">${body}</div>`,`${(G.films||[]).filter(f=>f.ww>0).length} FILMS`);
}
function boxOfficeClashPanel(){
  return boxOfficePanel("CLASH RADAR","Where the next collision sits","Dated pictures on both sides of the aisle, plus the seasonality behind each weekend.",boxOfficeCorridorGrid()+"<div class=\"produce-cards bo-rivals\">"+(G.rivals||[]).map(rivalProfile).join("")+"</div>",`${(G.rivals||[]).length} RIVALS`);
}

/* Weekly curve for a run: screen reports first, then the raw weekly ledger.
   Labels carry the real week number so a run read mid-flight still lines up. */
/* Charts render on the client, so the desk can hand the kit a narrow viewBox
   on phones instead of shrinking a 640-wide drawing until the axis is unreadable. */
function boCompact(){ try{ return (typeof window!=="undefined" && window.innerWidth) ? window.innerWidth<760 : false; }catch(e){ return false; } }
function boRunSeries(f, limit){
  limit=limit||12;
  let rows=[];
  try{ rows=screenWeeks(f)||[]; }catch(e){ rows=[]; }
  if(rows.length){
    return rows.slice(-limit).map(r=>({ label:"W"+Math.max(1,(r.w||0)-(f.releaseWeek||0)+1), value:r.gross||0, note:(r.screens?Number(r.screens).toLocaleString("en-US")+" screens":"") }));
  }
  const all=f.weekly||[];
  const start=Math.max(0, all.length-limit);
  return all.slice(-limit).map((x,i)=>({ label:"W"+(start+i+1), value:x.gross||0 }));
}
function boWeekRows(f){
  let rows=[];
  try{ rows=screenWeeks(f)||[]; }catch(e){ rows=[]; }
  if(!rows.length) return "<p class='bo-figure-cap'>No weekly reports filed yet — the first one lands after the opening weekend.</p>";
  const body=rows.slice(-8).map(r=>{
    const wk=Math.max(1,(r.w||0)-(f.releaseWeek||0)+1);
    const wow = r.wow==null ? "<span class='bo-weeks-open'>opening</span>" : "<span class='"+(r.wow>=0?"pos":"neg")+"'>"+(r.wow>=0?"+":"")+r.wow+"%</span>";
    const psa = r.psa>=1000 ? "$"+(Math.round(r.psa/100)/10)+"M" : "$"+Math.round(r.psa||0)+"K";
    return "<div class='bo-weeks-row'><span>Wk "+wk+"</span><span>"+fmtG(r.gross||0)+"</span><span>"+Number(r.screens||0).toLocaleString("en-US")+"</span><span>"+psa+"</span><span>"+(r.occ||0)+"%</span><span>"+wow+"</span></div>";
  }).join("");
  return "<div class='bo-weeks'><div class='bo-weeks-head'><span>WEEK</span><span>GROSS</span><span>SCREENS</span><span>PER SCREEN</span><span>FULL</span><span>WOW</span></div>"+body+"</div>";
}
function boxOfficeRuns(){
  let h="";
  const live=activeFilms();
  if(!live.length) h+="<div class='bo-empty'><b>No active runs.</b><p>A film without a release date earns nothing — date a finished picture and the run opens here.</p><button class='produce-action' onclick=\"switchTab('productions')\">Go to productions →</button></div>";
  for(const f of live){
    const be=breakevenWW(f);
    const projWW=(f.dom/(1-DATA.GENRES[f.genre].intlShare));
    const sp=boSplit(f), mult=boMult(f), legs=boLegs(f);
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):f.quality.aud;
    const crit=f.criticAvg!=null?f.criticAvg:f.quality.critic;
    const daily=weekendDaily(f), weeks=screenWeeks(f);
    const lastWk = weeks.length ? weeks[weeks.length-1] : null;
    const domPct = Math.round((sp.dom / Math.max(0.1, sp.ww)) * 100);
    const health=Math.round(clamp((lastWk?lastWk.gross:0)/Math.max(1,f.opening)*100,0,100));
    const paceOk = projWW>=be;
    const series=boRunSeries(f);
    const chart=(typeof BOCharts!=="undefined")?BOCharts.area(series,{aria:"Weekly gross for "+f.title,format:BOCharts.money,compact:boCompact()}):"";
    const splitFig=(typeof BOCharts!=="undefined")?BOCharts.split([
      {label:"Domestic",value:sp.dom,tone:"gold"},
      {label:"International",value:sp.intl,tone:"teal"}
    ],{format:BOCharts.money}):"";
    const kpi=(label,value,note,tone)=>"<div class='bo-kpi"+(tone?" "+tone:"")+"'><small>"+label+"</small><b>"+value+"</b>"+(note?"<span>"+note+"</span>":"")+"</div>";
    const dailyBars=(typeof BOCharts!=="undefined")?BOCharts.bars(daily.map(d=>({label:d.day,value:d.gross||0})),{aria:"Opening weekend by day",format:BOCharts.money,compact:boCompact()}):"";

    const panelFolds=(function(){
      let out="";
      const rp=regionPanel(f); if(rp) out+=fold("regions:"+f.id,"🌍 International markets & cities",rp,{open:false});
      const dp=demoPanel(f); if(dp) out+=fold("demo:"+f.id,"🎯 Audience demographics",dp,{open:false});
      const soc=socialPanel(f); if(soc) out+=fold("social:"+f.id,"📣 Social buzz",soc,{open:false});
      return out;
    })();

    h+="<article class='produce-release bo-run'>"+
      "<header class='bo-run-head'><div><span class='command-eyebrow'>"+esc(DATA.GENRES[f.genre].name)+" / LIVE RUN</span>"+
        "<h3>"+DATA.GENRES[f.genre].emoji+" "+esc(f.title)+"</h3>"+
        "<p class='produce-release-meta'>Week "+f.weeksOut+" on screens · opened "+fmtG(f.opening||0)+" · critics "+crit+"% · audience "+aud+"%</p>"+
        "<div class='produce-release-flags'>"+
          "<span class='bo-chip "+(aud>=70?"good":aud<50?"bad":"")+"'>AUDIENCE "+aud+"%</span>"+
          "<span class='bo-chip "+(crit>=70?"good":crit<50?"bad":"")+"'>CRITICS "+crit+"%</span>"+
          (f.premium||f.imax?"<span class='bo-chip gold'>PREMIUM SCREENS</span>":"")+
          (f.reviewBombed?"<span class='bo-chip bad'>REVIEW BOMBED −"+f.reviewBombed+"</span>":"")+
        "</div></div>"+
        "<div class='bo-run-stamp'><b class='"+(paceOk?"pos":"neg")+"'>"+(paceOk?"ON PACE":"BELOW BREAKEVEN")+"</b><span>tracking "+fmtG(projWW)+" vs "+fmtG(be)+"</span><small>run health "+health+"% of opening</small></div>"+
      "</header>"+
      "<div class='bo-kpis'>"+
        kpi("Opening weekend",fmtG(f.opening||0),"wide release")+
        kpi("Domestic",fmtG(sp.dom),domPct+"% of worldwide")+
        kpi("International",fmtG(sp.intl),(100-domPct)+"% of worldwide"+(f.presales?" · pre-sold":""))+
        kpi("Worldwide",fmtG(sp.ww),"all territories")+
        kpi("Multiplier",mult+"×","total ÷ opening",mult>=2.5?"good":mult<1.6?"bad":"")+
        kpi("Legs",legs+"×","projected total ÷ opening")+
      "</div>"+
      "<div class='bo-run-figures'>"+
        "<figure class='bo-figure'><div class='bo-figure-head'><b>WEEKLY GROSS</b><span>"+(series.length?series[series.length-1].label+" · "+fmtG(series[series.length-1].value):"—")+"</span></div>"+chart+
          "<p class='bo-figure-cap'>Domestic gross per week on screens. A long flat tail is healthy; a cliff after week one is front-loading.</p></figure>"+
        "<figure class='bo-figure'><div class='bo-figure-head'><b>DOMESTIC / INTERNATIONAL</b><span>"+fmtG(sp.ww)+" total</span></div>"+splitFig+
          "<p class='bo-figure-cap'>Rentals land at roughly 53% of domestic gross, paid weekly: <b>"+fmtM(f.rentalsDom||0)+"</b> received so far.</p></figure>"+
      "</div>"+
      "<div class='produce-release-actions'>"+
        "<button class='produce-action' data-dossier='"+f.id+"'>📊 Open the full breakdown</button>"+
        "<button class='produce-ghost' data-reviews='"+f.id+"'>🗞 Read the reviews</button>"+
      "</div>"+
      fold("daily:"+f.id,"🎟 Opening weekend — daily",
        dailyBars+"<p class='bo-figure-cap'>"+daily.map(d=>"<b>"+d.day+"</b> "+fmtG(d.gross)).join(" · ")+"</p>",{open:false})+
      fold("weeks:"+f.id,"📊 Week-by-week",
        boWeekRows(f)+"<p class='bo-figure-cap'>Screens shrink as the run winds down; per-screen average and occupancy follow the gross.</p>",{open:false})+
      fold("why:"+f.id,"🧐 Why is this performing this way?",boWhy(f),{open:false})+
      panelFolds+
      (f.reviewBombed? "<div class='bo-callout bad'><b>REVIEW BOMBING IN PROGRESS</b><p>Audience score has taken −"+f.reviewBombed+" pts from brigading. "+(f.bombCountered?"Your fan-activation blunted the worst of it.":"Ride it out, or let counter-campaigns do their work next time.")+"</p></div>":"")+
      (G.piracy>=45? "<div class='bo-callout bad'><b>PIRACY</b><p>Draining this run by about "+Math.round(clamp(G.piracy/100,0,1)*(DATA.PIRACY?DATA.PIRACY.maxGrossDamage:0.1)*100)+"% of weekly gross.</p></div>":"")+
      scoreSplit(f)+
      (f.advanceTotal? "<p class='bo-figure-cap'>🎟 Advance tickets banked: <b>"+fmtM(f.advanceTotal)+"</b> — sold before opening day.</p>":"")+
      (f.locCost? "<p class='bo-figure-cap'>🌍 Dubbing &amp; localization: <b>"+fmtM(f.locCost)+"</b> — dubs, subs and local P&amp;A, itemized at release.</p>":"")+
    "</article>";
  }
  return h;
}

function boxOfficeLibrary(){
  let h="";
  const lib=G.films.slice().sort((a,b)=>(b.ww||0)-(a.ww||0));
  const compareSel = G.compareSel || [];
  h+="<div class='spread bo-lib-head'><div><span class='command-eyebrow'>SORTED BY WORLDWIDE GROSS</span><h2>Library ("+lib.length+")</h2></div>"+
    (compareSel.length>=2? "<button class='btn btn-sm btn-primary' id='btnCompareFilms'>⚖ Compare "+compareSel.length+" films</button>" : "")+"</div>";
  if(!lib.length) h+="<div class='bo-empty'><b>Your trophy shelf is empty.</b><p>Release a picture and its full box-office record files itself here.</p></div>";
  h+=boxOfficeVaultBrowser();
  h+="<div class='bo-library'>";
  lib.slice(0,15).forEach(f=>{
    const be=f.ww? breakevenWW(f):1;
    const verdict = f.streamingOriginal? "<span class='tag purple'>streaming original</span>" :
      f.ww>=be*1.6? "<span class='tag green'>SMASH</span>" : f.ww>=be? "<span class='tag green'>HIT</span>" :
      f.ww>=be*0.75? "<span class='tag gold'>soft</span>" : "<span class='tag red'>FLOP</span>";
    const isSel = compareSel.includes(f.id);
    const sp = boSplit(f);
    h+="<div class='film-row"+(isSel?" sel":"")+"' data-film-id='"+f.id+"'><div class='film-main'>"+
      "<div class='film-head'><input type='checkbox' "+(isSel?"checked":"")+" class='film-cb' data-fid='"+f.id+"'>"+
      "<b>"+esc(f.title)+"</b> "+verdict+" "+
      "<button class='btn btn-xs btn-ghost' data-rename='f:"+f.id+"' title='Rename'>✏️</button> "+
      ((f.awards&&f.awards.length)?"<span class='tiny'>🏆 "+f.awards.join(" · ")+"</span>":"")+
      ((f.reviews&&f.reviews.length)?" <button class='btn btn-sm btn-ghost' data-reviews='"+f.id+"'>🗞 "+(f.criticAvg||0)+"%</button>":"")+
      "</div>"+
      "<div class='film-breakdown-badge'>"+
        "<span>DOM: <b class='gold'>"+fmtG(sp.dom)+"</b></span>"+
        "<span>INTL: <b style='color:var(--cyan)'>"+fmtG(sp.intl)+"</b></span>"+
        "<span>WW: <b class='pos'>"+fmtG(sp.ww)+"</b></span>"+
      "</div>"+
      "<div class='tiny muted'>"+DATA.GENRES[f.genre].name+" · "+fmtM(f.budget)+" budget"+
      (f.targetRegion && f.targetRegion!=="auto"? " · 🎯 "+(Array.isArray(f.targetRegion)? f.targetRegion : [f.targetRegion]).map(id=>{const d=(typeof regionDefs==="function")?regionDefs().find(x=>x.id===id):null; return d? d.name:id;}).join(", "):"")+
      (f.soldTo?" · licensed to "+f.soldTo:"")+(f.onOwn?" · on your platform":"")+(f.dayAndDate?" · 🎞 day-and-date":"")+" · "+(DATA.window(f.window||"45").name)+"</div>"+
      (f.streamingOriginal?"":"<div class='tiny muted'>Opened "+fmtG(f.opening||0)+" · mult "+boMult(f)+"× · legs "+boLegs(f)+"× · critics "+(f.criticAvg!=null?f.criticAvg:(f.quality?f.quality.critic:"—"))+"% · audience "+((typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:"—"))+"%</div>"+
      (f.streamingOriginal?"":topRegionLine(f)))+
      "</div>"+
      "<div class='film-side'><b class='"+(f.profit>=0?"pos":"neg")+"'>"+(f.profit>=0?"+":"")+fmtM(f.profit||0)+"</b><div class='tiny muted'>net</div>"+
      "<button class='btn btn-xs btn-primary' style='margin-top:4px' data-dossier='"+f.id+"'>📊 Breakdown</button>"+
      (G.streamer && !f.streamingOriginal && !f.soldTo && !f.onOwn && !f.inTheaters? "<button class='btn btn-sm btn-alt' style='margin-top:4px' data-movestr='"+f.id+"'>📱 → your platform</button>":"")+
      (typeof canRerelease==="function" && canRerelease(f)? "<button class='btn btn-xs btn-alt' style='margin-top:4px' data-rerelease='"+f.id+"'>🎟 Re-release</button>":"")+
      (typeof canReboot==="function" && canReboot(f)? "<button class='btn btn-xs btn-alt' style='margin-top:4px' data-reboot='"+f.id+"'>🔁 Reboot</button>":"")+
      (!f.streamingOriginal && !f.inTheaters && !f.directorsCut && f.ww>=120? "<button class='btn btn-xs btn-alt' style='margin-top:4px' data-cut='"+f.id+"'>✂ Director's Cut</button>":"")+
      "</div></div>";
  });
  h+="</div>";
  return h;
}


/* Weekend grosses — the Monday-morning report as a branded dialog. Reads the
   same weekly chart the desk renders, plus screens and per-screen average for
   your own runs, so the numbers can never drift from the page behind it. */
function boxOfficeWeekendModal(){
  let chart=[]; try{ chart=weeklyChart()||[]; }catch(e){ chart=[]; }
  const live=(typeof activeFilms==="function")?activeFilms()||[]:[];
  const rows=chart.map((c,i)=>{
    const f=c.mine?(G.films||[]).find(x=>x.title===c.title):null;
    let wow=null, screens=null;
    try{
      if(f&&typeof screenWeeks==="function"){
        const w=screenWeeks(f);
        const last=w[w.length-1];
        if(last){ wow=last.wow; screens=last.screens; }
      }
    }catch(e){}
    return `<div class="produce-modal-card bo-weekend-report-row"><div class="bo-rank">${String(i+1).padStart(2,"0")}</div><div><h4>${c.mine?"🎬 ":""}${esc(c.title)}</h4><p>${(DATA.GENRES[c.genre]||{}).name||esc(c.genre||"Feature")} · week ${c.weeksOut}${c.mine?" · your release":" · "+esc(c.studio||"independent")}${screens?` · ${Number(screens).toLocaleString("en-US")} screens`:""}${wow!=null?` · ${wow>=0?"+":""}${wow}% WoW`:""}</p></div><b class="bo-weekend-report-gross">${fmtG(c.gross||0)}</b></div>`;
  }).join("");
  const total=chart.reduce((a,c)=>a+(c.gross||0),0);
  const mine=chart.filter(c=>c.mine).reduce((a,c)=>a+(c.gross||0),0);
  const head=`<div class="produce-modal-head"><span class="command-eyebrow">BOX OFFICE / WEEKEND GROSSES</span><h3>Weekend ${woyOf(G.week)}, Year ${yearOf(G.week)}</h3><p>Domestic gross for the weekend just closed, ranked across the whole town. Your pictures carry the film glyph; screens and week-on-week movement come from your own run reports.</p></div>`;
  const body=chart.length
    ? `<div class="produce-modal-body">${rows}</div>`
    : `<div class="produce-modal-body"><div class="produce-modal-card"><h4>Nothing played this weekend.</h4><p>The town reported no theatrical gross. Date a finished picture from Productions and the report fills itself in on Monday.</p></div></div>`;
  const foot=`<div class="produce-modal-actions"><span class="bo-rebrand-note">${chart.length} title${chart.length===1?"":"s"} · ${fmtG(total)} domestic · ${fmtG(mine)} yours</span><div class="row" style="margin:0;gap:8px"><button class="produce-ghost" id="boWeekendClose">Close</button></div></div>`;
  const v=openModal(head+body+foot,{className:"command-produce-modal"});
  const cl=v.querySelector("#boWeekendClose"); if(cl) cl.onclick=()=>closeModal();
  v.querySelectorAll(".bo-weekend-report-row").forEach(r=>{ r.onclick=()=>{ beep("click"); switchTab("library"); closeModal(); }; });
}

function viewBoxOffice(){
  if(typeof BOXOFFICE_SUB==="undefined" || !BOXOFFICE_SECTIONS.some(s=>s[0]===BOXOFFICE_SUB)) BOXOFFICE_SUB="chart";
  const head=boxOfficeHead()+boxOfficeTelemetry()+boxOfficeNav();
  let body="";
  if(BOXOFFICE_SUB==="chains") body=boxOfficeChainsPanel();
  else if(BOXOFFICE_SUB==="plf") body=boxOfficeModulePanel("PREMIUM FORMAT","PLF mastering & the concession stand","Large-format deliverables, screen scheduling and popcorn splits — the premium margin in one desk.",(typeof ExhibitionPLF!=="undefined"&&typeof ExhibitionPLF.renderExhibitionPLFSection==="function")?ExhibitionPLF.renderExhibitionPLFSection():"","PLF");
  else if(BOXOFFICE_SUB==="blitz") body=boxOfficeModulePanel("CAMPAIGN","Marketing blitz engine","Budget, channels and timing. Every spend line below moves the opening and the legs.",(typeof MarketingBlitz!=="undefined"&&typeof MarketingBlitz.renderMarketingBlitzSection==="function")?MarketingBlitz.renderMarketingBlitzSection():"","BLITZ");
  else if(BOXOFFICE_SUB==="awards") body=boxOfficeModulePanel("SEASON","The awards circuit","Bodies, festivals and the weeks they vote. A campaign here is a second release for a picture that already closed.",(typeof FilmLocationsTax!=="undefined"&&typeof FilmLocationsTax.renderAwardCircuitSection==="function")?FilmLocationsTax.renderAwardCircuitSection():"","SEASON");
  else if(BOXOFFICE_SUB==="territories") body=boxOfficeTerritoriesPanel();
  else if(BOXOFFICE_SUB==="clash") body=boxOfficeClashPanel();
  else body=boxOfficeChartPanel()+boxOfficeCompetitionPanel()+boxOfficeCorridorPanel()+boxOfficeRunsPanel()+boxOfficeLibraryPanel();
  return `<section class="command-deck command-produce command-boxoffice">${head}${body}</section>`;
}


/* ═══════════ VIEW: ott ═══════════ */
/* v34.7 OTT desk — one command shell and one navigation across every reading.
   All figures come from the existing streaming engine; the view adds no
   simulation state or economics. Historic action attributes stay in place. */
const OTT_SECTIONS = [["home","Home"],["originals","Originals"],["deals","Deals"],["sports","Sports"],["market","Market"]];
let OTT_HISTORY_MODE = "subs"; // view-only chart toggle; never written to the save

function ottHead(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  return `<header class="command-heading"><div><span class="command-edition">OTT DESK / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">STREAMING / COMMAND &amp; LICENSING</span><h1>The streamer command desk.</h1><p>Audience, originals, deals, sports and buyers — every streaming decision in one place.</p></div><div class="command-date"><span>WEEK</span><b>${String(w).padStart(2,"0")}</b><small>${esc(m.month)}</small></div></header>`;
}
function ottRisk(){
  try{ return churnRisk(); }catch(e){ return {level:"unknown",pct:0}; }
}
function ottTelemetry(){
  const st=G.streamer, risk=ottRisk();
  let ceiling=0; if(st){ try{ ceiling=streamerCeiling(); }catch(e){} }
  const headroom=st?Math.max(0,ceiling-(st.subs||0)):0;
  return `<div class="command-telemetry">${commandMetric("SUBSCRIBERS",st?fmtSubs(st.subs||0):"—",st?esc(st.name):"No platform launched")}${commandMetric("CEILING HEADROOM",st?fmtSubs(headroom):"—",st?fmtSubs(st.subs||0)+" of "+fmtSubs(ceiling)+" ceiling":"Launch to measure the room")}${commandMetric("REVENUE / WEEK",st?fmtM(st.income||0):"—",st?"Current streaming income":"No streaming income yet")}${commandMetric("CHURN RISK",st?(risk.level==="unknown"?"NO DATA":risk.level.toUpperCase()+" · "+risk.pct+"%"):"—",st?"Four-week subscriber trend":"No subscriber history")}</div>`;
}
function ottNav(){
  const active=OTT_SECTIONS.some(s=>s[0]===OTT_SUB)?OTT_SUB:"home";
  return `<nav class="command-section-nav command-ott-nav" aria-label="OTT desk sections"><div class="command-nav-brand"><span>OTT DESK</span><small>HOME / ORIGINALS / DEALS / SPORTS / MARKET</small></div><div class="command-nav-items">${OTT_SECTIONS.map(([key,label],i)=>{
    const icon=getSubTabPixelIcon("ott",key);
    return `<button data-ottsub="${key}" class="${active===key?"active":""}" aria-current="${active===key?"page":"false"}"><small>0${i+1}</small>${icon?`<img class="subtab-pixel-icon" src="${icon}" alt="" />`:""}<span>${label}</span></button>`;
  }).join("")}</div></nav>`;
}
function ottPanel(eyebrow,title,description,content,stamp,cls){
  return `<section class="produce-panel ${cls||""}"><div class="produce-panel-head"><div><span class="command-eyebrow">${eyebrow}</span><h2>${title}</h2>${description?`<p>${description}</p>`:""}</div>${stamp?`<div class="ott-panel-aside">${stamp}</div>`:""}</div><div class="ott-panel-body">${content}</div></section>`;
}
function ottEmpty(title,copy,action){
  return `<div class="ott-empty"><b>${title}</b><p>${copy}</p>${action||""}</div>`;
}
function ottMeter(value,max,label){
  const pct=Math.max(0,Math.min(100,(Number(value)||0)/Math.max(1,Number(max)||1)*100));
  return `<div class="ott-meter" role="meter" aria-label="${esc(label||"Progress")}" aria-valuemin="0" aria-valuemax="${Number(max)||0}" aria-valuenow="${Number(value)||0}"><i style="width:${pct.toFixed(2)}%"></i></div>`;
}
function ottRiskBadge(){
  const risk=ottRisk(), level=risk.level||"unknown";
  const label=level==="unknown"?"NO DATA":level.toUpperCase();
  return `<span class="ott-chip ott-risk-${esc(level)}">${label} · ${Number(risk.pct)||0}%</span>`;
}
/* C1 — the history collected by tickStreamer, finally given a reading. */
function ottSubscriberRoomPanel(){
  const st=G.streamer;
  if(!st) return ottPanel("SUBSCRIBER ROOM","Subscriber room","Sixteen weeks of subscribers and revenue, recorded by the existing weekly tick.",ottEmpty("No subscriber history yet.","Launch a platform and advance a week to begin its subscriber and revenue record."),"NO HISTORY","ott-subscriber-room");
  const history=Array.isArray(st.history)?st.history.slice(-16):[];
  const mode=OTT_HISTORY_MODE==="revenue"?"revenue":"subs";
  const points=history.map(x=>({label:"W"+woyOf(x.w),value:Number(mode==="subs"?x.subs:x.inc)||0,note:dateLabel(x.w)}));
  const chart=points.length&&typeof BOCharts!=="undefined"?BOCharts.area(points,{aria:mode==="subs"?"Subscriber history, last 16 weeks":"Streaming revenue history, last 16 weeks",format:mode==="subs"?(v=>fmtSubs(v)):(v=>fmtM(v)),compact:typeof boCompact==="function"?boCompact():false}):"";
  const toggle=`<div class="produce-filters ott-history-toggle" role="group" aria-label="Subscriber chart metric"><button data-ott-history="subs" class="${mode==="subs"?"active":""}" aria-pressed="${mode==="subs"}">Subscribers</button><button data-ott-history="revenue" class="${mode==="revenue"?"active":""}" aria-pressed="${mode==="revenue"}">Revenue</button></div>`;
  const kpis=`<div class="ott-kpis ott-kpis-three"><div class="ott-kpi"><small>PEAK SUBSCRIBERS</small><b>${fmtSubs(st.peak||st.subs||0)}</b><span>Career high for ${esc(st.name)}</span></div><div class="ott-kpi"><small>LIFETIME REVENUE</small><b>${fmtM(st.totalRev||0)}</b><span>Total streaming revenue</span></div><div class="ott-kpi"><small>CHURN RISK</small>${ottRiskBadge()}<span>Four-week subscriber trend</span></div></div>`;
  const figure=chart?`<div class="ott-chart" data-chart-mode="${mode}" data-history-count="${history.length}">${chart}</div>`:ottEmpty("The first weekly point has not landed.","Advance one week; tickStreamer will record subscribers and income here automatically.");
  return ottPanel("SUBSCRIBER ROOM","Subscriber room","The last 16 recorded weeks. Toggle subscribers against weekly revenue; the chart never alters the save.",toggle+kpis+figure,`${history.length} / 16 WEEKS`,"ott-subscriber-room");
}
function ottContentHealthOf(){
  const st=G.streamer, films=G.films||[];
  const graceWeeks=10+Math.min(26,films.length*2);
  const elapsed=st?G.week-(st.lastContent||0):0;
  return {graceWeeks,elapsed,starved:!!st&&elapsed>graceWeeks,weeksLeft:Math.max(0,graceWeeks-elapsed+1)};
}
/* C2 — use the exact starvation rule from tickStreamer, including its strict
   “greater than graceWeeks” boundary. */
function ottContentHealthPanel(){
  const st=G.streamer;
  if(!st) return ottPanel("CONTENT HEALTH","Content health","The same 10 + min(26, films × 2) grace rule used by the engine.",ottEmpty("No platform to feed.","Launch a streamer to see its exact content-grace countdown and eligible library moves."),"LOCKED","ott-content-health");
  const health=ottContentHealthOf(), films=G.films||[];
  const onPlatform=films.filter(f=>f.onOwn||f.onOwnPlatform);
  const unsold=films.filter(f=>!f.soldTo&&!f.streamingOriginal&&!f.onOwn&&!f.onOwnPlatform);
  const countdown=health.starved?"Churn has started — the content grace period has expired.":`${health.weeksLeft} week${health.weeksLeft===1?"":"s"} before churn starts`;
  const kpis=`<div class="ott-kpis ott-kpis-three"><div class="ott-kpi"><small>FILMS ON PLATFORM</small><b>${onPlatform.length}</b><span>Exclusive catalogue titles</span></div><div class="ott-kpi"><small>MONETIZABLE / UNSOLD</small><b>${unsold.length}</b><span>Released films without a buyer</span></div><div class="ott-kpi"><small>CONTENT GRACE</small><b>${health.graceWeeks} wk</b><span>10 + min(26, ${films.length} films × 2)</span></div></div>`;
  const status=`<div class="ott-countdown ${health.starved?"expired":""}"><b>${countdown}</b><span>Last content ${health.elapsed} week${health.elapsed===1?"":"s"} ago · starvation begins only after the ${health.graceWeeks}-week grace.</span></div>`;
  const rows=unsold.slice(0,6).map(f=>{
    const movable=!f.inTheaters;
    return `<div class="ott-library-row"><div><b>${esc(f.title)}</b><small>${esc((DATA.GENRES[f.genre]||{}).name||f.genre||"Feature")} · ${f.inTheaters?"still in theaters":"ready to move"}</small></div>${movable?`<button class="produce-ghost" data-movestr="${f.id}">📱 Move to platform</button>`:`<span class="ott-chip">AFTER THEATRICAL RUN</span>`}</div>`;
  }).join("");
  const library=rows?`<div class="ott-library-list">${rows}</div>${unsold.length>6?`<p class="ott-note">+${unsold.length-6} more unsold titles in the film library.</p>`:""}`:ottEmpty("No unsold catalogue titles.","Every released film is either assigned to a platform or already exclusive to yours.");
  return ottPanel("CONTENT HEALTH","Content health","A precise starvation countdown, plus released films that can move onto your service through moveToStreamer.",kpis+status+library,health.starved?"STARVED":"FED","ott-content-health");
}
/* C3 — EU quota reads and eligibility mirror euShareOf/euQuotaCheck. */
function ottEuQuotaPanel(){
  const st=G.streamer, EU=DATA.GLOBAL?DATA.GLOBAL.eu:{quota:.3,fine:5,freezeWeeks:4};
  let r={share:1,eu:0,total:0}; try{ r=euShareOf(); }catch(e){}
  const share=r.total?r.share:0, quota=EU.quota||.3, frozen=!!(st&&st.euFreeze>0);
  const status=!st?"Launch a streamer to enter EU quota reviews.":r.total<3?"Catalogue too small to audit — the engine reviews at three works.":frozen?`Growth frozen · ${st.euFreeze} week${st.euFreeze===1?"":"s"} left`:share>=quota?"Compliant with the European works quota.":`Below quota · ${fmtM(EU.fine)} fine and ${EU.freezeWeeks}-week growth freeze at review.`;
  const kpis=`<div class="ott-kpis"><div class="ott-kpi"><small>EUROPEAN WORKS</small><b>${r.eu} / ${r.total}</b><span>Eligible works / catalogue</span></div><div class="ott-kpi"><small>CURRENT SHARE</small><b>${Math.round(share*100)}%</b><span>Need ${Math.round(quota*100)}%</span></div><div class="ott-kpi"><small>FAILURE FINE</small><b>${fmtM(EU.fine)}</b><span>Charged at quota review</span></div><div class="ott-kpi"><small>GROWTH FREEZE</small><b>${frozen?st.euFreeze+" wk":"—"}</b><span>${frozen?"Weeks remaining":EU.freezeWeeks+" weeks on failure"}</span></div></div>`;
  const meter=`<div class="ott-quota-read"><div><b>${Math.round(share*100)}% / ${Math.round(quota*100)}% required</b><span>${status}</span></div>${ottMeter(share,quota,"EU quota compliance")}</div>`;
  const eligible=`<div class="ott-eligibility"><b>What counts as European works</b><div><span class="ott-chip">LONDON SHOOTS</span><span class="ott-chip">TORONTO SHOOTS</span><span class="ott-chip">QUEENSLAND SHOOTS</span><span class="ott-chip">ANY FOREIGN-LANGUAGE FILM</span></div><p>Exactly the locations and foreign-language flag read by euShareOf(). Series with completed seasons count toward the catalogue total.</p></div>`;
  return ottPanel("EU QUOTA","European works quota","Progress against DATA.GLOBAL.eu.quota, the existing fine and any live growth freeze.",kpis+meter+eligible,frozen?"FROZEN":share>=quota&&r.total>=3?"COMPLIANT":"QUOTA WATCH","ott-eu-quota");
}
function ottHomePanel(){
  const st=G.streamer;
  if(!st){
    let ok=false; try{ ok=canLaunchStreamer(); }catch(e){}
    const action=`<button class="produce-action" id="launchStreamer" ${ok?"":"disabled"}>🚀 Launch streamer — $140M</button>`;
    return ottPanel("YOUR PLATFORM","Your platform","Build a direct-to-consumer home for the catalogue. Launch needs $140M and reputation 35+.",ottEmpty("No streamer on the lot.","Launch here, then feed the platform with finished films, originals and live rights. Subscription tiers and audience analytics unlock with it.",action),"NOT LAUNCHED","ott-platform");
  }
  let ceiling=0; try{ ceiling=streamerCeiling(); }catch(e){}
  const tier=DATA.tier(st.tier||"premium");
  const body=`<div class="ott-kpis"><div class="ott-kpi"><small>PLATFORM</small><b>${esc(st.name)}</b><span>${esc(tier.name)}</span></div><div class="ott-kpi"><small>SUBSCRIBERS</small><b>${fmtSubs(st.subs||0)}</b><span>Peak ${fmtSubs(st.peak||st.subs||0)}</span></div><div class="ott-kpi"><small>CONTENT CEILING</small><b>${fmtSubs(ceiling)}</b><span>Current tier ×${tier.ceil.toFixed(2)}</span></div><div class="ott-kpi"><small>SPORTS POWER</small><b>${(st.sportsPower||0).toFixed(1)}</b><span>Decays ~1.5%/wk</span></div></div>${ottMeter(st.subs||0,Math.max(1,ceiling),"Subscriber ceiling")}${st.crackdown>0?`<p class="ott-note">🔐 Password crackdown active — churn doubled for ${st.crackdown} more weeks.</p>`:""}`;
  return ottPanel("YOUR PLATFORM","Your platform — "+esc(st.name),"The active service, its current tier and the room left before the content ceiling.",body,`<button class="produce-ghost" type="button" data-rebrand-streamer="1" aria-label="Rebrand your platform">✏️ Rebrand</button>`,"ott-platform");
}
function ottTierDelta(t,current,key,higherBetter,kind){
  if(!current) return "";
  if(t.id===current.id) return `<span class="ott-chip">CURRENT</span>`;
  const delta=(t[key]||0)-(current[key]||0);
  if(Math.abs(delta)<.00001) return `<span class="ott-chip">SAME</span>`;
  const better=higherBetter?delta>0:delta<0, sign=delta>0?"+":"−", magnitude=Math.abs(delta);
  const value=kind==="churn"?`${sign}${(magnitude*100).toFixed(1)} pp`:kind==="ceil"?`${sign}${magnitude.toFixed(2)}×`:`${sign}$${magnitude.toFixed(2)}`;
  return `<span class="ott-chip ${better?"better":"worse"}">${better?"BETTER":"WORSE"} ${value}</span>`;
}
/* C7 — every delta is a display comparison with DATA.tier(current). The promo
   button quotes t.cost, the exact field setStreamerTier spends. */
function ottTiersPanel(){
  const st=G.streamer, current=st?DATA.tier(st.tier||"premium"):null;
  const tiers=DATA.TIERS.map(t=>{
    const on=!!(current&&current.id===t.id), disabled=!on&&G.studio.cash<(t.cost||0);
    const price=t.cost?fmtM(t.cost).replace(".0M","M"):"no build fee";
    const listPrice=t.listCost?fmtM(t.listCost).replace(".0M","M"):"";
    return `<article class="ott-tier ${on?"active":""}" data-tier-card="${t.id}"><header><b>${esc(t.name)}</b>${on?`<span class="ott-chip">LIVE</span>`:""}</header><p>${esc(t.desc)}</p>${t.promo?`<div class="ott-promo-price"><span>PROMO RATE <b>${price}</b></span><span>LIST PRICE <b>${listPrice}</b></span></div>`:""}<dl><div><dt>ARPU / week</dt><dd><b>$${t.arpu.toFixed(2)}</b>${ottTierDelta(t,current,"arpu",true,"arpu")}</dd></div><div><dt>Ceiling multiplier</dt><dd><b>×${t.ceil.toFixed(2)}</b>${ottTierDelta(t,current,"ceil",true,"ceil")}</dd></div><div><dt>Base churn</dt><dd><b>${(t.churn*100).toFixed(1)}%/wk</b>${ottTierDelta(t,current,"churn",false,"churn")}</dd></div></dl>${!st?`<span class="ott-chip">LAUNCH TO SWITCH</span>`:on?`<span class="ott-chip">CURRENT TIER</span>`:`<button class="produce-action" data-tier="${t.id}" ${disabled?"disabled":""}>Switch — ${price}${t.promo?" promo":""}</button>`}</article>`;
  }).join("");
  const promo=DATA.TIERS.find(t=>t.promo);
  const note=st?`<p class="ott-note">Better/worse chips compare with ${esc(current.name)}. Switching calls setStreamerTier${promo?`; the promo button charges the displayed ${fmtM(promo.cost).replace(".0M","M")} promo rate, not the ${fmtM(promo.listCost).replace(".0M","M")} list price`:""}.</p>`:"";
  return ottPanel("SUBSCRIPTION TIERS","Subscription tiers","Three existing tiers with ARPU, ceiling, churn and delta-versus-current. Preview them before launch or switch from a live platform.",`<div class="ott-tier-grid">${tiers}</div>`+note,current?esc(current.name):"PREVIEW","ott-tiers");
}

function ottCrackdownPanel(){
  const st=G.streamer, active=!!(st&&st.crackdown>0), disabled=!st||active||G.studio.cash<20;
  const label=!st?"Launch a streamer first":active?`Active · ${st.crackdown} weeks left`:G.studio.cash<20?"Needs $20M cash":"Start crackdown — $20M";
  const body=`<div class="ott-action-row"><div><b>Paid accounts now, higher churn for eight weeks.</b><p>Cost $20M · rep −8 · churn ×2 for 8 weeks. The engine adds 20% of current subscribers immediately.</p></div><button class="produce-ghost" id="ottCrackdown" ${disabled?"disabled":""}>${label}</button></div>`;
  return ottPanel("AUDIENCE POLICY","Password-sharing crackdown","A one-off conversion push with an explicit reputation and churn trade-off.",body,active?"ACTIVE":"$20M","ott-crackdown");
}
/* C6 — series pipeline and recent-season record, with renewal expiry from the
   actual offer already sitting in G.offers. */
function ottOriginalsPanel(){
  const series=G.series||[];
  if(!series.length) return ottPanel("ORIGINALS DESK","Your series","Series bring steady license income, renewals and a reason to stay subscribed.",ottEmpty("No shows in the pipeline.","Pitch a series from Develop; its shoot, seasons and renewal offers will appear here.",`<button class="produce-action" onclick="switchTab('develop')">Open Develop →</button>`),"0 SERIES","ott-originals");
  const rows=series.map(s=>{
    const p=s.platform==="own"&&typeof ownPlatformStub==="function"?ownPlatformStub():DATA.platform(s.platform);
    const seasons=s.seasons||[], last=seasons[seasons.length-1];
    const format=(DATA.SERIES_FORMATS||[]).find(f=>f.id===s.formatId)||(DATA.SERIES_FORMATS||[])[0];
    const renewal=(G.offers||[]).find(o=>o.type==="renewal"&&o.seriesId===s.id);
    let phase="";
    if(s.phase==="shoot") phase=`🎬 Shooting S${seasons.length+1} · ${s.weeksLeft||0} weeks left · burn ${fmtM((s.budget||0)/Math.max(s.weeksLeft0||s.weeksLeft||1,1))}/wk`;
    else if(s.phase==="airing") phase=`📡 Airing on ${esc(p.name)} · ${s.airWeeks||0} week${s.airWeeks===1?"":"s"} left`;
    else if(s.status==="ended") phase="Ended";
    else if(s.status==="renewal_pending") phase=renewal?`Renewal pending · ${Math.max(0,(renewal.expires||G.week)-G.week)} weeks to answer`:"Renewal pending · offer not on file";
    else phase="Between seasons";
    const history=seasons.slice(-3).map(y=>`<div class="ott-data-row"><span>S${y.num} · ${s.eps||0} eps</span><b>${fmtM(y.license||0)} license · crit ${y.critic||"—"} · aud ${y.audience||y.viewership||"—"}</b></div>`).join("");
    const canSpin=seasons.length>=2&&seasons.some(x=>(x.viewership||0)>=58);
    return `<article class="ott-series" data-series-id="${s.id}"><header><div><b>📺 ${esc(s.title)}</b><button class="produce-ghost ott-icon-action" data-rename="s:${s.id}" aria-label="Rename ${esc(s.title)}">✏️</button></div><div class="ott-chip-row"><span class="ott-chip">${esc(p.name)}</span>${format?`<span class="ott-chip ott-format">${format.icon||"📺"} ${esc(format.name)}</span>`:""}</div></header><p>${gTag(s.genre)} · ${s.eps||0} eps × ${fmtM(s.perEp||0)} · ${seasons.length} season${seasons.length===1?"":"s"}</p><div class="ott-phase">${phase}</div>${last?ottMeter(last.viewership||0,100,"Last season buzz"):""}${history||`<p class="ott-note">No completed seasons yet.</p>`}<footer>${s.status!=="ended"?`<button class="produce-ghost" data-cancel-series="${s.id}">✕ Cancel series</button>`:""}${canSpin?`<button class="produce-ghost" data-spinoff-series="${s.id}">🎬 Film continuation</button>`:""}</footer></article>`;
  }).join("");
  return ottPanel("ORIGINALS DESK","Your series","Shoot burn, airing and between-season status, renewal countdowns, formats and the last three completed seasons.",`<div class="ott-series-list">${rows}</div>`,`${series.length} SERIES`,"ott-originals");
}

function ottOfferBudget(o){
  if(o.type==="film_ott"){
    const f=(G.films||[]).find(x=>x.id===o.filmId);
    return f?(f.budget||0):0;
  }
  if(o.type==="prebuy"){
    const p=(G.projects||[]).find(x=>x.id===o.projectId);
    return p?(p.budget||0):0;
  }
  if(o.type==="renewal") return o.budget||0;
  return o.budget||0;
}
/* C5 — open offers are a sorted decision queue, not an unsorted card dump. */
function ottDealsPanel(){
  const offers=(G.offers||[]).slice().sort((a,b)=>(b.value||0)-(a.value||0));
  if(!offers.length) return ottPanel("DEALS DESK","Deal offers","Licenses, originals pre-buys and season orders land here with a live expiry.",ottEmpty("No offers on the table.","Hits and finished runs attract bidders — especially during streaming wars."),"0 OFFERS","ott-deals");
  const cards=offers.map(o=>{
    const p=DATA.platform(o.platform), title=o.filmTitle||o.seriesTitle||"Untitled offer";
    const type=o.type==="film_ott"?"Theatrical → streaming":o.type==="prebuy"?"Pre-buy original":`Season ${o.seasonNum||"next"} order`;
    const budget=ottOfferBudget(o), value=o.value||0, weeks=(o.expires==null?G.week:o.expires)-G.week;
    const expiry=weeks>0?`expires in ${weeks} wk`:weeks===0?"expires this week":`expired ${Math.abs(weeks)} wk ago`;
    const comparison=budget>0?`${(value/budget).toFixed(2)}× budget`:"budget not on file";
    return `<article class="ott-offer" data-offer-id="${o.id}"><header><div><span class="ott-platform-logo">${esc(p.logo||"?")}</span><div><b>${esc(title)}</b><small>${esc(type)} · ${esc(p.name)}</small></div></div>${o.biddingWar?`<span class="ott-chip">🔥 BIDDING WAR</span>`:""}</header><div class="ott-offer-value"><div><b>${fmtM(value)}</b><span>${comparison}</span></div><span>${expiry}</span></div><footer><button class="produce-action" data-acc="${o.id}">✅ Accept</button>${o.countered?"":`<button class="produce-ghost" data-cnt="${o.id}">📈 Counter</button>`}<button class="produce-ghost" data-dec="${o.id}">✕ Decline</button></footer></article>`;
  }).join("");
  return ottPanel("DEALS DESK","Deal offers","Sorted by value. Compare each bid with its film or season budget before the expiry runs out.",`<div class="ott-offer-list">${cards}</div>`,`${offers.length} OFFERS`,"ott-deals");
}

function ottNextSportsAuction(){
  const woy=woyOf(G.week), weeks=[13,26,39,52];
  const target=weeks.find(w=>w>=woy)||13;
  return {target,weeks:(target-woy+52)%52};
}
/* C8 — auction calendar and sportEcon figures are reads of current state. */
function ottSportsPanel(){
  const st=G.streamer, won=G.sportsWon||[], next=ottNextSportsAuction();
  const held=DATA.SPORTS.filter(s=>won.includes(s.id));
  const pending=G.pendingSports;
  const auction=`<div class="ott-auction-countdown"><small>${pending?"AUCTION OPEN":"NEXT SEALED-BID AUCTION"}</small><b>${pending?`${esc((pending.pkg||{}).name||"Sports package")}`:`Week ${next.target} · ${next.weeks===0?"this week":next.weeks+" week"+(next.weeks===1?"":"s")}`}</b><span>${pending?`Answer within ${Math.max(0,(pending.expires||G.week)-G.week)} weeks`:"Auctions land on weeks 13 / 26 / 39 / 52"}</span></div>`;
  let rights="";
  if(!st) rights=ottEmpty("A platform is required for live sports.","Launch a streamer from Home, then bid in the quarterly sealed-bid auctions.");
  else{
    const rows=held.map(s=>{
      const d=(G.sportsDeals||{})[s.id]||{base:120,subBump:4.5}, e=sportEcon({id:s.id,base:d.base,subBump:d.subBump});
      return `<div class="ott-rights-row" data-sport-id="${s.id}"><div><b>${s.icon} ${esc(s.name)}</b><small>Won for ${fmtM(d.bid||d.base)}${d.week?` · ${dateLabel(d.week)}`:""}</small></div><dl><div><dt>Duration</dt><dd>${e.dur} weeks</dd></div><div><dt>Viewers</dt><dd>~${e.audience}M</dd></div><div><dt>Ads / week</dt><dd>+${fmtM(e.ad)}</dd></div><div><dt>Expected value</dt><dd>~${fmtM(e.revenue)}</dd></div></dl></div>`;
    }).join("");
    rights=`<div class="ott-sports-power"><span>SPORTS POWER</span><b>${(st.sportsPower||0).toFixed(1)}</b><small>Decays once at ~1.5%/wk</small></div>${rows?`<div class="ott-rights-list">${rows}</div>`:ottEmpty("No sports rights yet.","Your first sealed-bid auction arrives on the next 13 / 26 / 39 / 52 week.")}`;
  }
  const events=[["awardshow","Award show",25],["concert","Concert",40],["boxing","Boxing match",60]].map(e=>`<button class="produce-ghost" data-live-event="${e[0]}" ${!st||G.studio.cash<e[2]?"disabled":""}>${e[1]} — ${fmtM(e[2])}</button>`).join("");
  const eventBody=`<div class="ott-action-row"><div><b>One-off PPV licenses.</b><p>Award show $25M · concert $40M · boxing $60M. Revenue and subscriber effects settle immediately.</p></div><div class="ott-actions">${events}</div></div>`;
  return ottPanel("SPORTS DESK","Live sports rights","The next auction, held-rights economics from sportEcon(), and the single documented sports-power decay.",auction+rights,`${held.length} HELD`,"ott-sports")+ottPanel("LIVE EVENTS","Live event licensing","One-off events use the same licenseLiveEvent engine action; no new payout model.",eventBody,st?"PPV DESK":"NEEDS STREAMER","ott-live-events");
}

function ottStrongestGenre(){
  const genres=Object.keys(DATA.GENRES||{}), totals={};
  (G.films||[]).forEach(f=>{ if(DATA.GENRES[f.genre]) totals[f.genre]=(totals[f.genre]||0)+Math.max(0,f.ww||0); });
  const ranked=Object.keys(totals).filter(g=>totals[g]>0).sort((a,b)=>totals[b]-totals[a]);
  if(ranked.length) return {key:ranked[0],basis:"highest released worldwide gross"};
  const next=(G.projects||[])[0]||(G.ideas||[])[0]||(G.films||[])[0];
  if(next&&DATA.GENRES[next.genre]) return {key:next.genre,basis:"current development slate"};
  return {key:genres[0],basis:"default pitch genre"};
}
/* C4 — every buyer and every taste multiplier, ranked against the studio's
   strongest existing genre rather than a made-up market score. */
function ottBuyerFitPanel(){
  const strongest=ottStrongestGenre(), genre=strongest.key, genres=Object.keys(DATA.GENRES||{});
  const platforms=DATA.allPlatforms().slice().sort((a,b)=>{
    const fit=((b.taste||{})[genre]||1)-((a.taste||{})[genre]||1);
    return fit||((b.generosity||1)-(a.generosity||1))||String(a.name).localeCompare(String(b.name));
  });
  const entrants=new Set((G.extraPlatforms||[]).map(p=>p.id));
  const war=G.streamWar>0?`<div class="ott-war-banner"><b>⚔️ Streaming war</b><span>Offers +30% · ${G.streamWar} week${G.streamWar===1?"":"s"} left</span></div>`:"";
  const rows=platforms.map(p=>{
    const tastes=genres.map(g=>`<span class="ott-taste ${g===genre?"strong":""}" data-taste-genre="${g}"><small>${esc((DATA.GENRES[g]||{}).name||g)}</small><b>×${(((p.taste||{})[g]||1)).toFixed(2)}</b></span>`).join("");
    return `<tr data-buyer-id="${esc(p.id)}" class="${entrants.has(p.id)?"entrant":""}"><th scope="row"><b>${esc(p.name)}</b>${entrants.has(p.id)?`<span class="ott-chip">NEW ENTRANT</span>`:""}<small>${esc(p.blurb||"")}</small></th><td><div class="ott-taste-grid">${tastes}</div></td><td data-label="Generosity"><b>${Math.round((p.generosity||1)*100)}%</b></td><td data-label="Renew threshold"><b>${p.renew||0} buzz</b></td></tr>`;
  }).join("");
  const table=`<div class="ott-table-wrap"><table class="ott-buyer-table"><thead><tr><th>Buyer</th><th>Taste multipliers · ${esc((DATA.GENRES[genre]||{}).name||genre)} highlighted</th><th>Generosity</th><th>Renew threshold</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const note=`<p class="ott-note">Sorted for <b>${esc((DATA.GENRES[genre]||{}).name||genre)}</b>, your strongest genre by ${esc(strongest.basis)}. Missing tastes use the engine's neutral ×1.00.</p>`;
  return ottPanel("BUYER FIT","Who wants your next pitch","All platforms from DATA.allPlatforms(), their actual taste multipliers, generosity and renewal thresholds.",war+note+table,`${platforms.length} BUYERS`,"ott-buyer-fit");
}
function ottMarketPanel(){
  let rows=[]; try{ rows=platStats(); }catch(e){}
  const body=rows.length?`<div class="ott-platform-list">${rows.map(r=>`<article class="ott-platform"><header><span class="ott-platform-logo">${esc(r.logo||"?")}</span><div><b>${esc(r.name)}</b><small>${r.mine?"Your platform":r.share+"% market share"}</small></div><strong>${r.subs.toFixed(1)}M</strong></header>${ottMeter(r.subs,Math.max(...rows.map(x=>x.subs),1),"Subscriber share")}<dl><div><dt>ARPU</dt><dd>$${r.arpu.toFixed(2)}/wk</dd></div><div><dt>Churn</dt><dd>${r.churn.toFixed(2)}%/wk</dd></div><div><dt>Your deal spend</dt><dd>${fmtM(r.spend)}</dd></div><div><dt>Revenue (est.)</dt><dd>${fmtM(r.revenue)}/wk</dd></div></dl><p>${esc(r.blurb||"")}</p></article>`).join("")}</div>`:ottEmpty("No buyers are reporting.","Platform estimates appear once the market data is available.");
  return ottPanel("THE MARKET","The platforms","Subscriber, ARPU, churn and revenue estimates derived from real deals; your platform is included when live.",body,`${rows.length} PLATFORMS`,"ott-market");
}
/* C9 — cross-links only. Purchases stay at the existing studio investment
   desk; these descriptions name the multipliers engine.js actually reads. */
function ottRdPanel(){
  const effects=[
    {id:"ottrel",effect:"Film OTT offer value ×1.12 (+12%); renewal thresholds −4 buzz."},
    {id:"ottalgo",effect:"Subscriber ceiling ×1.15 (+15%); weekly churn ×0.80 (−20%)."},
    {id:"globalcdn",effect:"Film and pre-buy offer value ×1.18 (+18%); weekly acquisition +0.08M subscribers."}
  ];
  const rows=effects.map(e=>{
    const def=(DATA.UPGRADES||[]).find(u=>u.id===e.id)||{name:e.id,icon:"🔬"}, owned=!!(G.upgrades&&G.upgrades[e.id]);
    return `<article class="ott-rd-item ${owned?"owned":""}" data-ott-upgrade="${e.id}"><header><b>${def.icon||"🔬"} ${esc(def.name)}</b><span class="ott-chip">${owned?"OWNED":"NOT OWNED"}</span></header><p>${e.effect}</p></article>`;
  }).join("");
  const owned=effects.filter(e=>G.upgrades&&G.upgrades[e.id]).length;
  return ottPanel("R&D CROSS-LINKS","Streaming research","Owned-or-not status and the existing effects on offer value, ceiling, churn and acquisition. Research stays at the studio desk.",`<div class="ott-rd-grid">${rows}</div><div class="ott-action-row"><p>Review costs and unlock requirements with the other studio investments.</p><button class="produce-ghost" id="ottOpenRd">Open studio R&D desk →</button></div>`,`${owned} / 3 OWNED`,"ott-rd");
}
/* C10 — a pure projection of tickStreamer's current subscriber equation.
   No tick, save, sports, ceiling or content mutation is performed here. */
function ottSubscriberForecast(weeks){
  const st=G.streamer, count=weeks||12;
  if(!st) return {rows:[],ceiling:0,graceWeeks:0};
  const ceiling=streamerCeiling(), tier=DATA.tier(st.tier||"premium"), graceWeeks=10+Math.min(26,(G.films||[]).length*2);
  let subs=st.subs||0, crackdown=st.crackdown||0, euFreeze=st.euFreeze||0;
  const rows=[];
  for(let i=1;i<=count;i++){
    let churn=tier.churn||.006;
    if(G.upgrades&&G.upgrades.ottalgo) churn*=.80;
    if(crackdown>0){churn*=2;crackdown--;}
    churn=clamp(churn,.003,.025);
    const starved=(G.week+i)-(st.lastContent||0)>graceWeeks;
    let growth=(ceiling-subs)*.06-subs*churn;
    if(G.upgrades&&G.upgrades.globalcdn) growth+=.08;
    if(euFreeze>0){growth=Math.min(growth,0);euFreeze--;}
    if(starved) growth-=subs*.004;
    subs=clamp(subs+growth,.5,Math.ceil(ceiling*1.05));
    subs=Math.round(subs*100)/100;
    rows.push({week:G.week+i,subs});
  }
  return {rows,ceiling,graceWeeks};
}
function ottForecastPanel(){
  const st=G.streamer;
  if(!st) return ottPanel("12-WEEK FORECAST","Subscriber forecast","A read-only estimate from the current growth equation once a platform exists.",ottEmpty("Nothing to project yet.","Launch a streamer to estimate its subscribers 12 weeks from now."),"ESTIMATE","ott-forecast");
  const forecast=ottSubscriberForecast(12), rows=forecast.rows, last=rows[rows.length-1];
  const milestones=rows.filter((r,i)=>[2,5,8,11].includes(i)).map(r=>`<div><small>${dateLabel(r.week)}</small><b>${fmtSubs(r.subs)}</b></div>`).join("");
  const tier=DATA.tier(st.tier||"premium");
  const body=`<div class="ott-forecast-hero"><small>12-WEEK SUBSCRIBER FORECAST · ESTIMATE</small><b>${fmtSubs(last.subs)}</b><span>Projected for ${dateLabel(last.week)} · ${fmtSubs(st.subs||0)} today</span></div><div class="ott-forecast-milestones">${milestones}</div><p class="ott-assumptions"><b>Assumptions:</b> estimate only; the current ${fmtSubs(forecast.ceiling)} content ceiling and ${esc(tier.name)} tier stay constant. Each week applies 6% pull toward that ceiling, tier churn with existing ottalgo/crackdown modifiers, global CDN acquisition when owned, EU freezes, and starvation after the ${forecast.graceWeeks}-week content grace. No future sports, content, tier or save changes are simulated.</p>`;
  return ottPanel("12-WEEK FORECAST","Subscriber forecast","Projected from the current growth equation — a planning estimate, never a write to the save.",body,"READ-ONLY ESTIMATE","ott-forecast");
}
function viewOTT(){
  if(!OTT_SECTIONS.some(s=>s[0]===OTT_SUB)) OTT_SUB="home";
  let body="";
  if(OTT_SUB==="home") body=ottHomePanel()+ottSubscriberRoomPanel()+ottContentHealthPanel()+ottEuQuotaPanel()+ottTiersPanel()+ottCrackdownPanel()+ottRdPanel()+ottForecastPanel();
  else if(OTT_SUB==="originals") body=ottOriginalsPanel();
  else if(OTT_SUB==="deals") body=ottDealsPanel();
  else if(OTT_SUB==="sports") body=ottSportsPanel();
  else body=ottBuyerFitPanel()+ottMarketPanel();
  return `<section class="command-deck command-produce command-ott">${ottHead()}${ottNav()}${ottTelemetry()}${body}</section>`;
}

/* ═══════════ VIEW: notifications ═══════════ */
function notifKind(n){
  const t=n.type||"";
  if(t==="gold"||t==="good") return {key:"decisions",label:t==="gold"?"DEAL":"WIN"};
  if(t==="bad") return {key:"alerts",label:"ALERT"};
  if(t==="cemo") return {key:"market",label:"MARKET"};
  return {key:"notes",label:"NOTE"};
}
let INBOX={filter:"all",unread:null};
function inboxRowHtml(n,kind,isNew,withAction){
  return `<article class="inbox-row ${kind.key}${isNew?" is-new":""}"><span class="inbox-kind">${kind.label}</span><div class="inbox-copy"><p>${esc(n.text)}</p><small>${esc(dateLabel(n.week))}</small></div>${withAction&&!n.read?`<button class="inbox-read" data-nread="${n.id}" aria-label="Mark read">MARK READ</button>`:(isNew?`<em>NEW</em>`:"")}</article>`;
}
function inboxWeekHtml(rows,unread,withAction){
  const byWeek=[];
  rows.forEach(r=>{
    let bucket=byWeek[byWeek.length-1];
    if(!bucket||bucket.week!==r.n.week){ bucket={week:r.n.week,items:[]}; byWeek.push(bucket); }
    bucket.items.push(r);
  });
  return byWeek.map(b=>`<section class="inbox-week"><header><span>${esc(dateLabel(b.week))}${b.week===G.week?" · THIS WEEK":""}</span><small>${b.items.length} ${b.items.length===1?"entry":"entries"}</small></header>${b.items.map(({n,kind})=>inboxRowHtml(n,kind,unread.has(n.id),withAction)).join("")}</section>`).join("");
}
function inboxFilterDefs(rows){
  return [["all","Everything",rows.length],["decisions","Deals & wins",rows.filter(r=>r.kind.key==="decisions").length],["alerts","Alerts",rows.filter(r=>r.kind.key==="alerts").length],["market","Market",rows.filter(r=>r.kind.key==="market").length],["notes","Notes",rows.filter(r=>r.kind.key==="notes").length]];
}
let INBOX_PAGE={filter:"all"};
function viewInboxScreen(){
  const rows=(G.notifications||[]).slice().reverse().map(n=>({n,kind:notifKind(n)}));
  const filters=inboxFilterDefs(rows);
  const active=filters.some(f=>f[0]===INBOX_PAGE.filter)?INBOX_PAGE.filter:"all";
  const shown=active==="all"?rows:rows.filter(r=>r.kind.key===active);
  const unread=new Set(rows.filter(r=>!r.n.read).map(r=>r.n.id));
  const alerts=rows.filter(r=>r.kind.key==="alerts").length;
  const weekCount=rows.filter(r=>r.n.week===G.week).length;
  const empty=`<div class="inbox-empty"><b>${active==="all"?"The tray is empty.":"Nothing of that kind yet."}</b><p>${active==="all"?"Deals, crises, board decisions and market moves land here as the weeks turn. Advance a week from the header and the desk fills up.":"Switch the filter, or advance a week and the desk fills up."}</p><button class="command-secondary" id="inboxShowAll">Show everything</button></div>`;
  return `<section class="command-deck command-inbox-screen">
    <header class="command-heading"><div><span class="command-edition">OFFICE / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">INBOX / CORRESPONDENCE</span><h1>Everything the studio heard.</h1><p>Board decisions, crises, market moves and quiet notes. Nothing here is a metric you cannot act on.</p></div>${developWeekBadge()}</header>
    <div class="command-telemetry">${commandMetric("UNREAD",unread.size,unread.size?"Waiting on you":"Tray is clear")}${commandMetric("THIS WEEK",weekCount,"Recorded since Monday")}${commandMetric("ALERTS",alerts,"Overruns, crises, rivals")}${commandMetric("ARCHIVE",rows.length,"Last 100 transmissions")}</div>
    <div class="inbox-page">
      <nav class="inbox-filters" aria-label="Inbox filters">${filters.map(([k,label,count])=>`<button class="${active===k?"on":""}" data-inboxfilter="${k}" aria-pressed="${active===k}"><span>${label}</span><b>${count}</b></button>`).join("")}</nav>
      <div class="inbox-body" id="inboxBody">${shown.length?inboxWeekHtml(shown,unread,true):empty}</div>
      <footer class="inbox-actions"><span>${rows.length?`${unread.size} unread · ${rows.length} on file`:"Nothing recorded yet"}</span><span class="inbox-page-actions">${unread.size?`<button class="command-secondary" id="inboxMarkAll">Mark all read</button>`:""}<button class="command-secondary" id="inboxBell">Open the pop-up inbox</button></span></footer>
    </div>
  </section>`;
}
function bindInboxScreen(){
  $$("[data-inboxfilter]").forEach(b=>b.onclick=()=>{ INBOX_PAGE.filter=b.dataset.inboxfilter; beep("click"); render(); });
  const all=$("#inboxShowAll"); if(all) all.onclick=()=>{ INBOX_PAGE.filter="all"; beep("click"); render(); };
  $$("[data-nread]").forEach(b=>b.onclick=()=>{ markNotifRead(+b.dataset.nread); beep("click"); updateBellBadge(); render(); });
  const mark=$("#inboxMarkAll"); if(mark) mark.onclick=()=>{ markAllNotifRead(); beep("click"); updateBellBadge(); render(); };
  const bell=$("#inboxBell"); if(bell) bell.onclick=()=>{ beep("click"); notificationsModal(); };
}

function viewNotifications(){
  const all=(G.notifications||[]).slice().reverse();
  const rows=all.map(n=>({n,kind:notifKind(n)}));
  const unread=INBOX.unread instanceof Set?INBOX.unread:new Set();
  const filters=inboxFilterDefs(rows);
  const active=INBOX.filter||"all";
  const shown=active==="all"?rows:rows.filter(r=>r.kind.key===active);
  const weekCount=rows.filter(r=>r.n.week===G.week).length;
  const unreadN=rows.filter(r=>unread.has(r.n.id)).length;
  const body=shown.length?inboxWeekHtml(shown,unread,false):`<div class="inbox-empty"><b>${active==="all"?"The tray is empty.":"Nothing of that kind yet."}</b><p>${active==="all"?"Deals, crises, board decisions and market moves land here as the weeks turn.":"Switch the filter, or advance a week and the desk fills up."}</p><button class="develop-ghost" id="inboxAll">Show everything</button></div>`;
  return `<div class="inbox">
    <header class="inbox-head">
      <div><span class="command-eyebrow">OFFICE / NOTIFICATIONS</span><h3>The week's correspondence.</h3><p>Notifications fire as the weeks turn — every decision, crisis and market move the studio recorded. Opening the inbox clears the bell.</p></div>
      <div class="inbox-stats">
        <div><small>UNREAD AT OPEN</small><b>${unreadN}</b></div>
        <div><small>THIS WEEK</small><b>${weekCount}</b></div>
        <div><small>ARCHIVE</small><b>${rows.length}</b></div>
      </div>
    </header>
    <nav class="inbox-filters" aria-label="Notification filters">${filters.map(([k,label,count])=>`<button class="${active===k?"on":""}" data-nfilter="${k}" aria-pressed="${active===k}"><span>${label}</span><b>${count}</b></button>`).join("")}</nav>
    <div class="inbox-body">${body}</div>
    <footer class="inbox-actions"><span>${rows.length?`Most recent first · ${rows.length} entries on file`:"Nothing recorded yet"}</span><button class="develop-ghost" id="inboxClose">Close</button></footer>
  </div>`;
}
function renderInbox(){
  const v=openModal(viewNotifications(),{className:"command-inbox-modal"});
  v.querySelectorAll("[data-nfilter]").forEach(b=>b.onclick=()=>{ INBOX.filter=b.dataset.nfilter; beep("click"); renderInbox(); });
  const all=v.querySelector("#inboxAll"); if(all) all.onclick=()=>{ INBOX.filter="all"; beep("click"); renderInbox(); };
  const close=v.querySelector("#inboxClose"); if(close) close.onclick=()=>{ beep("click"); closeModal(); };
}

/* ═══════════ VIEW: finance ═══════════ */
function viewFinance(){
  const st=G.studio;
  const overhead=st.overhead+G.projects.length*0.12+G.series.filter(s=>s.phase==="shoot").length*0.15;
  const ft=finTrail(), fc2=finCommit();
  const mdOnce=maxDebt(), headroom=Math.round((mdOnce-st.debt)*10)/10; // perf: one O(films) pass per render
  
  // Week-to-week deltas
  const dCash = G.prevCash != null ? (st.cash - G.prevCash) : 0;
  const dCashLabel = (dCash >= 0 ? "+" : "") + fmtM(dCash);
  const dRep = G.prevRep != null ? (st.rep - G.prevRep) : 0;
  const dRepLabel = (dRep >= 0 ? "+" : "") + dRep.toFixed(1);

  let h="<div class='subnav-pills'>"+
    "<button class='subnav-pill active' onclick='window.scrollTo(0,0)'><img class='subtab-pixel-icon' src='assets/itch-ui/icons/Icon_01.png' alt='' /><span>P&amp;L Ledger</span></button>"+
    "<button class='subnav-pill' id='btnOpenBonds'><img class='subtab-pixel-icon' src='assets/itch-ui/icons/Icon_04.png' alt='' /><span>Corporate Bond Market</span></button>"+
    "<button class='subnav-pill' id='btnOpenDynasty'><img class='subtab-pixel-icon' src='assets/bos2-icons/logos/icons8-queen-crown-100.png' alt='' /><span>Dynasty &amp; Trust</span></button>"+
    "<button class='subnav-pill' onclick='ipoModal()'><img class='subtab-pixel-icon' src='assets/bos2-icons/general/film-clapper.png' alt='' /><span>Public Offering</span></button>"+
    "<button class='subnav-pill' onclick='maModal()'><img class='subtab-pixel-icon' src='assets/itch-ui/icons/Icon_08.png' alt='' /><span>M&amp;A Vault</span></button>"+
  "</div><div class='stat-hero'>"+
    statCard(fmtM(st.cash),"Cash ("+dCashLabel+" lw)","var(--gold2)")+
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
    "<div class='cost-line'><span>🏦 Debt stack (revolving + mezz + investor)</span><b class='neg'>"+fmtM(fc2.debt)+"</b></div>"+
    "<div class='cost-line' style='padding-left:12px'><span class='tiny muted'>↳ Bank credit principal</span><b>"+fmtM(st.debt)+" (intr: "+fmtM(st.debt*0.0018)+"/wk)</b></div>"+
    (st.mezzDebt>0? "<div class='cost-line' style='padding-left:12px'><span class='tiny muted'>↳ Mezzanine loan</span><b class='neg'>"+fmtM(st.mezzDebt)+" (intr: "+fmtM(st.mezzDebt*0.005)+"/wk)</b></div>":"")+
    (G.investorDebt>0? "<div class='cost-line' style='padding-left:12px'><span class='tiny muted'>↳ Investor buyout</span><b>"+fmtM(G.investorDebt)+" ($2.5M/wk, ~"+Math.ceil(G.investorDebt/2.5)+"wks left)</b></div>":"")+
    "<div class='cost-line'><span>🏛 Overhead run-rate</span><b>"+fmtM(fc2.oh)+"/wk</b></div>"+
    "<div class='cost-line'><span>🏦 Interest run-rate</span><b>"+fmtM(fc2.intr)+"/wk</b></div>"+
    "<div class='cost-line'><span>Credit headroom</span><b class='"+(headroom>=0?"pos":"neg")+"'>"+fmtM(headroom)+"</b></div></div>";
  
  // Debt Maturity Schedule
  h+="<div class='card' style='margin-top:6px'><b class='small'>🗓️ Debt Maturity Schedule</b>"+
    "<div class='cost-line'><span>Credit facility ($"+mdOnce+"M limit)</span><b>Revolving · rollover each week</b></div>"+
    (st.mezzDebt>0? "<div class='cost-line'><span>Mezzanine debt ($"+st.mezzDebt+"M)</span><b class='neg'>Due Year "+(yearOf(G.week)+1)+" · balloon settlement</b></div>":"")+
    (G.investorDebt>0? "<div class='cost-line'><span>Investor payout ($"+G.investorDebt+"M)</span><b>Retires in ~"+Math.ceil(G.investorDebt/2.5)+" weeks</b></div>":"")+
    "</div>";

  h+=plCard();
  h+="<div class='row' style='margin:8px 0'><button class='btn btn-sm btn-alt' id='btnExportCSV'>📥 Export P&L Ledger (CSV)</button></div>";
  /* v28.9: transaction search/filter over the trailing 12 weeks */
  const txWeeks=(G.txHistory||[]);
  if(txWeeks.length){
    h+="<div class='section-title'>🔎 Transaction search <span class='tiny muted'>(last "+txWeeks.length+" weeks)</span></div>"+
      "<div class='card'><input type='text' id='txSearch' placeholder='🔍 Filter by category (e.g. theatrical, marketing, talent)…' style='width:100%;padding:9px 12px;border-radius:10px;background:#0d1119;border:1px solid var(--line2);color:var(--text);font-size:13px' aria-label='Search transactions'>"+
      "<div id='txRows' style='margin-top:8px;max-height:280px;overflow-y:auto;overscroll-behavior:contain'>"+
      fnLedgerRows(txWeeks,"")+
      "</div></div>";
  }

  h+="<div class='grid g2'><div class='card'><h4>🏦 Credit facility</h4>"+
    "<p class='tiny muted'>Weekly interest 0.18% (≈9%/yr). Borrow to bridge production, but breakevens don't care about your loans.</p>"+
    "<div class='loan-row'><div class='small muted' style='margin:8px 0 4px'>Borrow</div><input type='range' id='fnLoan' min='10' max='"+Math.max(10,Math.round(headroom))+"' step='10' value='"+Math.round(Math.max(10,headroom/2))+"'><div class='spread'><b id='fnLoanV'></b><button class='btn btn-sm btn-primary' id='fnLoanGo'>Take loan</button></div></div>"+
    (st.debt>0? "<div class='loan-row'><div class='small muted' style='margin:12px 0 4px'>Repay</div><input type='range' id='fnRepay' min='1' max='"+Math.max(1,Math.min(Math.round(st.debt),Math.floor(st.cash)))+"' value='"+Math.max(1,Math.min(Math.round(st.debt/2),Math.floor(st.cash)))+"'><div class='spread'><b id='fnRepayV'></b><button class='btn btn-sm btn-alt' id='fnRepayGo'>Repay</button></div></div>":"")+
    (G.investorDebt>0? "<div class='tiny' style='margin-top:10px'>🕴 Investor payout remaining: <b class='neg'>"+fmtM(G.investorDebt)+"</b> ($2.5M/wk auto · ~"+Math.ceil(G.investorDebt/2.5)+" wks remaining)</div>":"")+
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
  h+="<div class='section-title'>Projected — 12-week cash-flow forecast</div><div class='card' title='Forecast assumptions: 8.5% cost of capital, catalog decay -1.5%/quarter, facility lease renewal week 52'><div class='tiny muted' style='margin-bottom:6px'>PROJECTED from locked-in runs, burns, dated P&A, overhead, interest, streamer (same engine math as the tick). Hover for assumptions.</div><div class='forecast-bars'>"+
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
  // v14: board of directors (§44–45)
  try{
    const b=G.board||[], avg=boardAvg();
    h+="<div class='section-title'>🏛 Board of directors</div><div class='card'>"+
      "<div class='cost-line'><span>Average approval</span><b class='"+(avg>=60?"pos":avg<40?"neg":"")+"'>"+avg+"/100</b></div>"+
      b.map(m=>{
        const td=(DATA.BOARD_TRAITS||[]).find(t=>t.trait===m.trait);
        return "<div class='cost-line'><span>"+(m.hawk?"🦅":"🎬")+" <b>"+esc(m.name)+"</b> <span class='tiny muted'>"+esc(m.trait)+" · "+esc((td&&td.desc)||"")+"</span></span><b class='"+(Math.round(m.approval)>=60?"pos":m.approval<40?"neg":"")+"'>"+Math.round(m.approval)+"/100</b></div>";
      }).join("")+
      "<div class='tiny muted' style='margin-top:4px'>Tentpoles go to a board vote at greenlight. Hits raise approval, flops sink it (hawks swing harder); quiet quarters drift back to neutral. Votes show in the log.</div></div>";
  }catch(e){}
  // executives
  h+="<div class='section-title'>👔 Executive hires</div><div class='grid g3'>";
  DATA.EXECS.forEach(e=>{
    const ex=(G.execs&&G.execs[e.id])? execObj(e.id) : null;
    const owned=!!ex;
    h+="<div class='card upg-card'><div class='u-i'>"+e.icon+"</div><div style='flex:1'><b>"+e.name+"</b><div class='tiny muted' style='margin:3px 0 8px'>"+e.blurb+"</div>"+
      (owned? "<span class='tag green'>✓ hired</span> <span class='tag'>Lv "+levelOf(ex)+"</span> <span class='tiny muted'>"+Math.round((ex.tenure||0)/52*10)/10+" yrs · effect ×"+lvlMult(ex).toFixed(2)+"</span>" : "<button class='btn btn-sm "+(st.cash>=e.cost?"btn-primary":"")+"' data-exec='"+e.id+"'>"+fmtM(e.cost)+"</button>")+"</div></div>";
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
  /* Financial Analysis Lab — DCF, Comps, LBO, Ratios */
  try{ h+=FINANCE_TOOLS.renderFinancialAnalysis(); }catch(e){}
  return h;
}
/* Headquarters: departments unifying upgrades, execs and buildable wings.
   Existing buys stay one tap away; new wings show cost/benefit/upkeep/unlocks. */
function hqBoard(st){
  let up=0; try{ up=hqUpkeep(); }catch(e){}
  let h="<div class='section-title'>🏢 Studio headquarters</div>"+
    "<div class='tiny muted' style='margin:-4px 0 6px'>One lot, eight departments. Facilities bill "+fmtM(up)+"/wk upkeep.</div>";
  /* v31: lot map — wings light up as they're built (renderer in v31-features.js) */
  try{ h+=hqFloorPlanSVG(); }catch(e){}
  h+="<div class='grid g2'>";
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
  /* v28.9: weekly % progress bar for the active research */
  let researchBar="";
  if(activeT){
    const total=activeT.total||techDefs().find(t=>t.id===activeT.id)?.weeks||activeT.left||1;
    const pct=Math.round(clamp((total-activeT.left)/total,0,1)*100);
    const def0=techDefs().find(t=>t.id===activeT.id);
    researchBar="<div class='card' style='margin-bottom:8px'><div class='spread'><b>🔬 "+esc((def0&&def0.name)||activeT.id)+" — "+pct+"% complete</b><span class='tag gold'>"+activeT.left+"w left</span></div>"+
      "<div style='height:8px;background:#0a0e16;border-radius:99px;overflow:hidden;border:1px solid var(--line);margin-top:6px'><div style='height:100%;width:"+pct+"%;background:linear-gradient(90deg,var(--gold),#ffdf9a);transition:width .5s'></div></div>"+
      "<div class='tiny muted' style='margin-top:4px'>"+activeT.left+" of "+total+" weeks remaining — breakthrough lands automatically.</div></div>";
  }
  h+="<div class='section-title'>🔬 Technology tree</div>"+
    (researchBar||"<div class='tiny muted' style='margin:-4px 0 6px'>One lab slot. Research takes weeks after you pay. Lab idle.</div>")+
    "<div class='grid g3'>";
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
/* v28.9: trailing-week transaction rows with a text filter (used by Finance search) */
function fnLedgerRows(txWeeks, q){
  q=(q||"").toLowerCase();
  let rows=[];
  txWeeks.slice().reverse().forEach(w=>{
    Object.keys(w.cats||{}).forEach(k=>{
      const label=PL_LABELS[k]||k;
      if(q && !label.toLowerCase().includes(q) && !k.includes(q)) return;
      rows.push({week:w.week, key:k, label, amt:w.cats[k]});
    });
  });
  if(!rows.length) return "<div class='tiny muted'>No matching transactions.</div>";
  return rows.slice(0,80).map(r=>
    "<div class='cost-line'><span>"+dateLabel(r.week)+" · "+esc(r.label)+"</span><b class='"+(r.amt>=0?"pos":"neg")+"'>"+(r.amt>=0?"+":"")+fmtM(r.amt)+"</b></div>"
  ).join("")+(rows.length>80? "<div class='tiny muted' style='text-align:center'>…"+(rows.length-80)+" more — refine the filter</div>":"");
}
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
  const debt=(G.studio.debt||0)+(G.studio.mezzDebt||0)+(G.investorDebt||0);
  let oh=0; try{ oh=weeklyOverhead(); }catch(e){ oh=G.studio.overhead||0; }
  let intr=0; try{ intr=(G.studio.debt||0)*interestRate()+(G.studio.mezzDebt||0)*0.005*(G.execs&&G.execs.cfo?0.7:1); }catch(e){}
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
  bindInboxScreen();
  /* v31: render the sub-tab strip FIRST so the data-* bindings below attach to
     the live chips — rendering it last replaced them with dead nodes. */
  renderSubTabs();
  $$("[data-dev]").forEach(b=>b.onclick=()=>{
    const idea=G.ideas.find(i=>i.id===+b.dataset.dev);
    if(idea){ beep("click"); startWizard(idea); }
  });
  $$("[data-pitch]").forEach(b=>b.onclick=()=>{ beep("click"); startPitch(+b.dataset.pitch); });
  const ps=$("#btnPitchSeries"); if(ps) ps.onclick=()=>{ beep("click"); startSeriesWizard(); };
  const ss=$("#btnStarSign"); if(ss) ss.onclick=()=>{ beep("click"); superstarModal(); };
  const pf=$("#btnPitchFilm"); if(pf) pf.onclick=()=>{ beep("click"); startFilmPitchWizard(); };
  const ai=$("#btnAIPitch"); if(ai) ai.onclick=()=>{ beep("click"); openAIPitchModal(); };
  const cc=$("#btnCustomCreator"); if(cc) cc.onclick=()=>{ beep("click"); customCreatorModal(); };
  const shc=$("#btnShareCard"); if(shc) shc.onclick=function(){ shareStudioCard(); };
  const btnTheaters=$("#btnOpenTheaters"); if(btnTheaters) btnTheaters.onclick=()=>{ beep("click"); if(typeof openTheaterChainsModal==="function") openTheaterChainsModal(); };
  const btnAgency=$("#btnOpenTalentAgency"); if(btnAgency) btnAgency.onclick=()=>{ beep("click"); if(typeof openTalentAgencyModal==="function") openTalentAgencyModal(); };
  const btnDynasty=$("#btnOpenDynasty"); if(btnDynasty) btnDynasty.onclick=()=>{ beep("click"); if(typeof openDynastyModal==="function") openDynastyModal(); };
  const btnChallenges=$("#btnOpenChallenges"); if(btnChallenges) btnChallenges.onclick=()=>{ beep("click"); if(typeof openChallengeModal==="function") openChallengeModal(); };
  const btnBowShorts=$("#btnBowShorts"); if(btnBowShorts) btnBowShorts.onclick=()=>{ beep("click"); if(typeof openBowShortsModal==="function") openBowShortsModal(); };
  const btnFestPr=$("#btnFestivalPr"); if(btnFestPr) btnFestPr.onclick=()=>{ beep("click"); if(typeof openFestivalPrModal==="function") openFestivalPrModal(); };
  const btnCrisisPr=$("#btnOpenCrisisPr"); if(btnCrisisPr) btnCrisisPr.onclick=()=>{ beep("click"); if(typeof openCrisisPrModal==="function") openCrisisPrModal(); };
  const btnSandbox=$("#btnOpenCustomSandbox"); if(btnSandbox) btnSandbox.onclick=()=>{ beep("click"); if(typeof openCustomSandboxModal==="function") openCustomSandboxModal(); };
  const btnAgencyPkg=$("#btnOpenAgencyPackaging"); if(btnAgencyPkg) btnAgencyPkg.onclick=()=>{ beep("click"); if(typeof openAgencyPackagingModal==="function") openAgencyPackagingModal(); };
  const btnTerrDeals=$("#btnOpenTerritoryDeals"); if(btnTerrDeals) btnTerrDeals.onclick=()=>{ beep("click"); if(typeof openTerritoryDealsModal==="function") openTerritoryDealsModal(); };
  const btnHolidays=$("#btnOpenHolidayCalendar"); if(btnHolidays) btnHolidays.onclick=()=>{ beep("click"); if(typeof openHolidayCalendarModal==="function") openHolidayCalendarModal(); };
  const btnVault=$("#btnRestorationVault"); if(btnVault) btnVault.onclick=()=>{ beep("click"); if(typeof openRestorationModal==="function") openRestorationModal(); };
  const btnFac=$("#btnOpenFacilities"); if(btnFac) btnFac.onclick=()=>{ beep("click"); if(typeof openStudioFacilitiesModal==="function") openStudioFacilitiesModal(); };
  const btnSyn=$("#btnOpenSyndication"); if(btnSyn) btnSyn.onclick=()=>{ beep("click"); if(typeof openSyndicationModal==="function") openSyndicationModal(); };
  const btnBnd=$("#btnOpenBonds"); if(btnBnd) btnBnd.onclick=()=>{ beep("click"); if(typeof openBondMarketModal==="function") openBondMarketModal(); };
  const btnCnt=$("#btnOpenContracts"); if(btnCnt) btnCnt.onclick=()=>{ beep("click"); if(typeof openTalentContractsModal==="function") openTalentContractsModal(); };
  const btnClash=$("#btnClashAnalytics"); if(btnClash) btnClash.onclick=()=>{ beep("click"); if(typeof openClashAnalyticsModal==="function") openClashAnalyticsModal(); };
  const btnBrd=$("#btnOpenBoard"); if(btnBrd) btnBrd.onclick=()=>{ beep("click"); if(typeof openBoardTargetsModal==="function") openBoardTargetsModal(); };
  const btnFan=$("#btnOpenFanClub"); if(btnFan) btnFan.onclick=()=>{ beep("click"); if(typeof openFanClubModal==="function") openFanClubModal(); };
  const btnSpy=$("#btnOpenEspionage"); if(btnSpy) btnSpy.onclick=()=>{ beep("click"); if(typeof openStudioEspionageModal==="function") openStudioEspionageModal(); };
  const btnMerch=$("#btnOpenMerch"); if(btnMerch) btnMerch.onclick=()=>{ beep("click"); if(typeof openMerchLicensingModal==="function") openMerchLicensingModal(); };
  const btnUni=$("#btnOpenUniverses"); if(btnUni) btnUni.onclick=()=>{ beep("click"); if(typeof openUniverseModal==="function") openUniverseModal(); };
  const btnFyc=$("#btnOpenAwardsCampaign"); if(btnFyc) btnFyc.onclick=()=>{ beep("click"); if(typeof openAwardsCampaignModal==="function") openAwardsCampaignModal(); };
  const ls=$("#launchStreamer"); if(ls) ls.onclick=()=>{ if(launchStreamer()){beep("gold"); flashes(G.flash); render();} else toast("Need rep ≥35 and $140M to launch.","bad"); };
  const crackdown=$("#ottCrackdown");
  if(crackdown) crackdown.onclick=()=>{
    if(!confirm("Start a password-sharing crackdown for $20M? Reputation −8 and churn ×2 for 8 weeks.")) return;
    const result=crackdownPasswordSharing();
    if(result&&result.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast(result&&result.err?result.err:"The crackdown is unavailable right now.","bad");
  };
  $$("[data-live-event]").forEach(b=>b.onclick=()=>{
    const fee={awardshow:25,concert:40,boxing:60}[b.dataset.liveEvent];
    if(!confirm("License this live event for "+fmtM(fee)+"? PPV revenue and subscriber effects settle immediately.")) return;
    const result=licenseLiveEvent(b.dataset.liveEvent);
    if(result&&result.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast(result&&result.err?result.err:"That live event is unavailable right now.","bad");
  });
  $$("[data-sched]").forEach(b=>b.onclick=()=>{ beep("click"); startScheduling(+b.dataset.sched); });
  $$("[data-ownprem]").forEach(b=>b.onclick=()=>{ beep("click"); ownPremiereModal(+b.dataset.ownprem); });
  $$("[data-ending]").forEach(b=>b.onclick=()=>{ if(applyAltEnding(+b.dataset.eid, b.dataset.ending)){ beep("gold"); flashes(G.flash); render(); } });
  $$("[data-rename]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); const p=b.dataset.rename.split(":"); beep("click"); renameModal(p[0], p[1]); });
  $$("[data-rebrand-streamer]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); beep("click"); rebrandStreamerModal(); });
  $$("[data-btlhire]").forEach(b=>b.onclick=()=>{ const [r,id]=b.dataset.btlhire.split(":"); if(hireBTL(r,+id)){ beep("gold"); flashes(G.flash); render(); } });
  $$("[data-btlfire]").forEach(b=>b.onclick=()=>{ if(fireBTL(b.dataset.btlfire)){ beep("click"); flashes(G.flash); render(); } });
  $$("[data-madate]").forEach(b=>b.onclick=()=>{ const p=b.dataset.madate.split(":"); beep("click"); maDateModal(p[0], p.slice(1).join(":")); });
  $$("[data-masell]").forEach(b=>b.onclick=()=>{ const p=b.dataset.masell.split(":"); beep("click"); maSellModal(p[0], p.slice(1).join(":")); });
  const bs=$("#btnMaBulkSell"); if(bs) bs.onclick=()=>{
    const v=maVaultValue(); if(!v) return;
    const cash=maSellVaultOutright();
    if(cash){ beep("cash"); toast("📚 Vault liquidated for +"+fmtM(cash),"gold"); render(); }
  };
  const bl=$("#btnMaBulkLicense"); if(bl) bl.onclick=()=>{ beep("click"); maBulkLicenseModal(); };
  const btnFlip=$("#btnMaFlipRival"); if(btnFlip) btnFlip.onclick=()=>{ beep("click"); maFlipRivalModal(); };
  $$("[data-shop]").forEach(b=>b.onclick=()=>{
    shopToStreamers(+b.dataset.shop); beep("click");
    if(G.pendingAuction){ render(); auctionModal(); }
  });
  $$("[data-test]").forEach(b=>b.onclick=()=>{ beep("click"); screeningModal(+b.dataset.test); });
  $$("[data-dossier]").forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); beep("click"); openFilmDetailsModal(+b.dataset.dossier); });
  $$("[data-reviews]").forEach(b=>b.onclick=()=>{ beep("click"); reviewsModal(+b.dataset.reviews); });
  $$("[data-movestr]").forEach(b=>b.onclick=()=>{ if(moveToStreamer(+b.dataset.movestr)){beep("gold"); flashes(G.flash); render();} else toast("That film can't move to your platform.","bad"); });
  // film comparison checkboxes
  $$(".film-cb").forEach(cb=>cb.onclick=(e)=>{ e.stopPropagation(); const id=+cb.dataset.fid; G.compareSel = G.compareSel||[]; if(cb.checked){ if(!G.compareSel.includes(id)) G.compareSel.push(id); } else { G.compareSel=G.compareSel.filter(x=>x!==id); } render(); });
  $$(".film-row").forEach(r=>r.onclick=(e)=>{ if(e.target.type==="checkbox") return; const id=+r.dataset.filmId; const cb=r.querySelector(".film-cb"); if(cb){ cb.checked=!cb.checked; cb.dispatchEvent(new Event("click")); }});
  $("#btnCompareFilms") && ($("#btnCompareFilms").onclick=()=>{ beep("click"); compareFilmsModal(); });
  $$("[data-cut]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.cut; const f=G.films.find(x=>x.id===id); if(f && makeDirectorsCut(f)){ beep("gold"); flashes(G.flash); render(); } });
  $$(".rival-card").forEach(c=>c.onclick=()=>{ const name=c.dataset.rival; const r=G.rivals.find(x=>x.name===name); if(r) rivalProfileModal(r); });
  // Library tab actions
  $$("[data-re]").forEach(b=>b.onclick=()=>{ const f=G.films.find(x=>x.id===+b.dataset.re); if(f) reReleaseFilm(f.id); beep("click"); });
  $$("[data-stream]").forEach(b=>b.onclick=()=>{ viewStreamingDeal(+b.dataset.stream); beep("click"); });
  $$("[data-dc]").forEach(b=>b.onclick=()=>{ const f=G.films.find(x=>x.id===+b.dataset.dc); if(f) releaseDirectorsCut(f.id); beep("gold"); });
  $$("[data-seq]").forEach(b=>b.onclick=()=>{ const s=G.series.find(x=>x.id===+b.dataset.seq); if(s) startSequel(s); beep("click"); });
  $$("[data-spin]").forEach(b=>b.onclick=()=>{ const s=G.series.find(x=>x.id===+b.dataset.spin); if(s) startSpinoff(s); beep("click"); });
  $$("[data-fr]").forEach(b=>b.onclick=()=>{ viewFranchiseDetail(b.dataset.fr); beep("click"); });
  $$("[data-fr-podcast]").forEach(b=>b.onclick=()=>{
    const r=launchPodcast(b.dataset.frPodcast);
    if(r&&r.ok){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast((r&&(r.err||r.reason))||"Cannot launch podcast right now.","bad"); render(); }
  });
  $$("[data-fr-merch]").forEach(b=>b.onclick=()=>{
    const r=upgradeMerch(b.dataset.frMerch);
    if(r&&r.ok){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast((r&&r.reason)||"Cannot upgrade merchandise right now.","bad"); render(); }
  });
  $$("[data-fr-park]").forEach(b=>b.onclick=()=>{
    const r=buildPark(b.dataset.frPark);
    if(r&&r.ok){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast((r&&r.reason)||"Cannot build park attraction right now.","bad"); render(); }
  });
  $$("[data-fr-sell]").forEach(b=>b.onclick=()=>{ franchiseSaleModal(b.dataset.frSell); beep("click"); });
  $$("[data-fr-game]").forEach(b=>b.onclick=()=>{
    const r=sellGameRights(b.dataset.frGame);
    if(r&&r.ok){ beep("cash"); flashes(G.flash); render(); }
    else { beep("bad"); toast((r&&r.reason)||"Game rights unavailable for this tier.","bad"); render(); }
  });
  $$("[data-fr-seq]").forEach(b=>b.onclick=()=>{
    const fr=frById(b.dataset.frSeq);
    const f=frResolvableFilm(fr);
    if(f){ beep("click"); startSequel(f); }
    else if(fr){ beep("click"); startSpinoff(fr); }   // no original on file (purchased IP) — open the wizard as the franchise's first entry
    else toast("Franchise record not found.","bad");
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
  $$("[data-em-filter]").forEach(b=>b.onclick=()=>{ EMPIRE_PORTFOLIO.filter=b.dataset.emFilter; beep("click"); render(); });
  $$("[data-em-sort]").forEach(b=>b.onclick=()=>{ EMPIRE_PORTFOLIO.sort=b.dataset.emSort; beep("click"); render(); });
  $$("[data-unipick]").forEach(b=>b.onclick=()=>{
    const fr=frById(b.dataset.unipick); if(!fr) return;
    const picks=uniPicksArr(), i=picks.findIndex(x=>String(x)===String(fr.id));
    if(i>=0) picks.splice(i,1); else picks.push(fr.id);
    beep("click");
    render();
  });
  const ug=$("#uniGo");
  if(ug) ug.onclick=()=>{
    const picks=uniPicksArr();
    if(picks.length<2){ toast("Pick at least two franchises.","bad"); beep("bad"); return; }
    if(foundUniverse(null, picks.slice())){ picks.length=0; beep("gold"); flashes(G.flash); render(); }
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
    if(typeof saveGame==="function") saveGame();
    beep("gold"); flashes(G.flash); render();
  };
  const agb=$("#btnAgency");
  if(agb) agb.onclick=()=>{
    if(G.studio.cash<30){ toast("The town-wide agency truce costs $30M.","bad"); return; }
    spend("studio",30); G.agencyExcl=G.week+104;
    log("🕴 You sign a town-wide truce with the agencies (−$30M): packaging fees pause while it lasts.","gold");
    if(typeof saveGame==="function") saveGame();
    beep("gold"); flashes(G.flash); render();
  };
  $$("[data-agdeal]").forEach(b=>b.onclick=()=>{ if(signAgencyDeal(b.dataset.agdeal)){ beep("gold"); flashes(G.flash); } render(); });
  $$("[data-ma]").forEach(b=>b.onclick=()=>{ if(maBuy(+b.dataset.ma)){ beep("gold"); flashes(G.flash); } render(); });
  $$("[data-fyc]").forEach(b=>b.onclick=()=>{ beep("click"); fycModal(+b.dataset.fyc); });
  $$("[data-fr-toys]").forEach(b=>b.onclick=()=>{
    const r=signToyLine(b.dataset.frToys);
    if(r&&r.ok){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast((r&&r.reason)||"Cannot sign toy line right now.","bad"); render(); }
  });
  $$("[data-fr-spin]").forEach(b=>b.onclick=()=>{ const fr=frById(b.dataset.frSpin); if(fr){ beep("click"); startSpinoff(fr); } });
  $$("[data-fr-tv]").forEach(b=>b.onclick=()=>{
    const res=franchiseTvSpinoff(b.dataset.frTv);
    if(res&&res.ok){ beep("gold"); flashes(G.flash); }
    else { beep("bad"); toast((res&&res.reason)||"TV spin-off could not be set up.","bad"); }
    render();
  });
  $$("[data-fr-more]").forEach(b=>b.onclick=()=>{ beep("click"); empireModal(b.dataset.frMore); });
  $$("[data-merchline]").forEach(b=>b.onclick=()=>{ const [fid,lid]=b.dataset.merchline.split(":"); if(launchMerchLine(+fid,lid)){ beep("cash"); flashes(G.flash); render(); } else beep("bad"); });
  $$("[data-rerelease]").forEach(b=>b.onclick=()=>{ rereleaseFilm(+b.dataset.rerelease); beep("gold"); flashes(G.flash); render(); });
  $$("[data-court]").forEach(b=>b.onclick=()=>{ courtChain(b.dataset.court); beep("gold"); flashes(G.flash); render(); });   // v12: warm up a theater chain
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
  $$("[data-ip]").forEach(b=>b.onclick=()=>{
    const res=buyIp(b.dataset.ip);
    if(res&&res.ok){ beep("gold"); flashes(G.flash); }
    else { beep("bad"); toast((res&&res.reason)||"Could not acquire those rights.","bad"); }
    render();
  });
  const ab=$("#btnAch"); if(ab) ab.onclick=()=>{ beep("click"); achievementsModal(); };
  /* ── v14 bindings: intel, label, what-if ── */
  $$("[data-intel]").forEach(b=>b.onclick=()=>{
    const rs=(G.rivals||[]);
    const activeName=(G.intel&&G.intel.until>G.week)?G.intel.name:null;
    const head='<div class="produce-modal-head"><span class="command-eyebrow">COMPETITION / INTEL</span>'+
      '<h3>Industrial espionage</h3>'+
      '<p>$8M to the right bagman buys a rival\'s next moves — dated slate, scales and where they are strong. Intel holds for eight weeks and shows on their card.</p></div>';
    const rows=rs.map(r=>{
      const active=activeName===r.name;
      return '<div class="bo-intel-row">'+
        '<div><h4><span style="color:'+(r.color||"#edc47c")+'">●</span> '+esc(r.name)+'</h4>'+
        '<p>'+esc(r.blurb||"")+' · '+fmtM(r.ytd||0)+' YTD</p></div>'+
        (active? '<span class="bo-chip gold">ACTIVE</span>'
               : '<button class="produce-ghost" data-buyintel="'+esc(r.name)+'">Buy · $8M</button>')+
      '</div>';
    }).join("");
    const body='<div class="produce-modal-body"><div class="bo-intel-list">'+rows+'</div>'+
      (activeName? '<p class="bo-figure-cap">Intel active on <b>'+esc(activeName)+'</b> — '+(G.intel.until-G.week)+' weeks of coverage left.</p>'
                 : '<p class="bo-figure-cap">Every purchase is booked against the studio cash, not the film budget.</p>')+'</div>';
    const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+rs.length+' rival studios tracked</span>'+
      '<div class="row" style="margin:0;gap:8px"><button class="produce-ghost" id="intelClose">Close</button></div></div>';
    const v=openModal(head+body+foot,{className:"command-produce-modal"});
    const cl=v.querySelector("#intelClose"); if(cl) cl.onclick=()=>closeModal();
    v.querySelectorAll("[data-buyintel]").forEach(bb=>bb.onclick=()=>{ if(buyIntel(bb.dataset.buyintel)){ closeModal(); beep("gold"); flashes(G.flash); render(); } });
  });
  $$("button[data-label]").forEach(b=>b.onclick=()=>{
    const lc=DATA.LABEL_COSTS||{};
    if(unlockLabel()){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast("Need "+fmtM(lc.unlock||60)+" cash to launch the music label.","bad"); render(); }
  });
  $$("[data-sign]").forEach(b=>b.onclick=()=>{
    const art=(DATA.ARTISTS||[]).find(x=>x.id===b.dataset.sign);
    if(signArtist(b.dataset.sign)){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast(art && G.studio.cash<art.fee ? "Need "+fmtM(art.fee)+" cash to sign "+art.name+"." : "Roster full (max 3 acts) or artist unavailable.","bad"); render(); }
  });
  $$("[data-dropartist]").forEach(b=>b.onclick=()=>{ if(dropArtist(b.dataset.dropartist)){ beep("click"); flashes(G.flash); render(); } });
  $$("[data-whatif]").forEach(b=>b.onclick=()=>{ beep("click"); whatIfModal(); });
  const mr=$("#btnMailRead"); if(mr) mr.onclick=()=>{ markMailRead(); beep("click"); render(); };
  /* ── v16 game studio bindings ── */
  $$("[data-games-unlock]").forEach(b=>b.onclick=()=>{ if(unlockGames()){ beep("gold"); flashes(G.flash); render(); } else beep("bad"); });
  $$("[data-gsrc]").forEach(b=>b.onclick=()=>{ GAMES.src=b.dataset.gsrc; beep("click"); render(); });
  $$("[data-gdev]").forEach(b=>b.onclick=()=>{ GAMES.dev=b.dataset.gdev; beep("click"); render(); });
  const gsGo=$("#gsGo"); if(gsGo) gsGo.onclick=()=>{
    if(!GAMES.src){ toast("Pick a source first — a franchise or a hit film.","bad"); return; }
    if(startGameDev(GAMES.src, GAMES.dev)){ beep("gold"); flashes(G.flash); render(); } else beep("bad");
  };
  /* ── prototype RPG: character sheets + in-house originals ── */
  $$("[data-pgdev-gdd]").forEach(b=>b.onclick=()=>{ beep("click"); gameDevGDDModal(); });
  $$("[data-pgdev-choice]").forEach(b=>b.onclick=()=>{
    const r=(typeof advanceGameDevPhase==="function")?advanceGameDevPhase(b.dataset.pgdevChoice):{ok:false,err:"RPG system offline"};
    if(r.ok){ beep("gold"); flashes(G.flash); if(r.launched) toast("🎮 Game launched!","good"); render(); } else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  /* ── v27 influence spends ── */
  $$("[data-infl-masterclass='1']").forEach(b=>b.onclick=()=>{
    const r=spendInfluence(10);
    if(r.ok){ const t=(G.talent||[]).slice().sort((a,b)=>((b.prototype||{}).level||1)-((a.prototype||{}).level||1))[0]; if(t&&t.id) gainXP(t.id,1000,"masterclass intensive"); beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  $$("[data-infl-hype='1']").forEach(b=>b.onclick=()=>{
    const r=spendInfluence(15);
    if(r.ok){ G.studio.hypeSurge=true; toast("📣 Hype surge armed — +10% on your next theatrical opening.","good"); beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });

  /* ── v20 interactive expansion bindings ── */
  $$("[data-fr-reboot]").forEach(b=>b.onclick=()=>{
    if(rebootFranchise(+b.dataset.frReboot)){ beep("gold"); flashes(G.flash); render(); }
  });
  $$("[data-mail-reply]").forEach(b=>b.onclick=()=>{
    if(replyMail(+b.dataset.mailReply, false)){ beep("gold"); flashes(G.flash); render(); }
  });
  $$("[data-mail-apology]").forEach(b=>b.onclick=()=>{
    if(replyMail(+b.dataset.mailApology, true)){ beep("good"); flashes(G.flash); render(); }
  });
  const fg=$("#btnFanGala");
  if(fg) fg.onclick=()=>{
    if(G.studio.cash < 2){ toast("Fan Gala requires $2M cash.","bad"); return; }
    spend("other", 2);
    G.projects.forEach(p=>{ p.buzzBonus = (p.buzzBonus||0) + 0.05; });
    G.films.forEach(f=>{ if(!f.archived) f.buzz = Math.min(100, (f.buzz||20) + 5); });
    G.studio.rep = clamp(G.studio.rep + 1, 5, 99);
    log("🎉 Fan Gala Hosted (−$2M): Fans celebrated across Hollywood! +5% buzz to theatrical titles, rep +1.","gold");
    beep("gold"); flashes(G.flash); render();
  };
  const ap=$("#btnDeployAntiPiracy");
  if(ap) ap.onclick=()=>{
    if(deployAntiPiracy()){ beep("gold"); flashes(G.flash); render(); }
  };
  const ci=$("#btnDeployCounterIntel");
  if(ci) ci.onclick=()=>{
    if(deployCounterIntel()){ beep("gold"); flashes(G.flash); render(); }
  };
  const expCsv=$("#btnExportCSV");
  if(expCsv) expCsv.onclick=()=>{
    exportLedgerCSV();
    beep("click");
  };
  /* v28.9: develop/OTT sub-tabs, vault browser, firesale counter, ledger search */
  $$("[data-dashsub]").forEach(b=>b.onclick=()=>{ DASHBOARD_SUB=b.dataset.dashsub; beep("click"); render(); });
  $$("[data-studiosub]").forEach(b=>b.onclick=()=>{ STUDIO_SUB=b.dataset.studiosub; beep("click"); render(); });
  $$("[data-devsub]").forEach(b=>b.onclick=()=>{ DEVELOP_SUB=b.dataset.devsub; beep("click"); render(); });
  $$("[data-filter-genre]").forEach(b=>b.onclick=()=>{ SCRIPT_GENRE_FILTER=b.dataset.filterGenre; beep("click"); render(); });
  $$("[data-cast-unpin]").forEach(b=>b.onclick=()=>{ beep("click"); unpinCast(b.dataset.castUnpin); });
  $$("[data-combo-filter]").forEach(b=>b.onclick=()=>{ DEVELOP_COMBO_FILTER=b.dataset.comboFilter; beep("click"); render(); });
  $$("[data-fit-lens]").forEach(b=>b.onclick=()=>{
    const wrap=b.closest(".develop-fit"), sel=wrap?wrap.querySelector("select"):null;
    if(!sel || typeof ProductionCreativity==="undefined" || typeof ProductionCreativity.applyCameraFormat!=="function") return;
    const res=ProductionCreativity.applyCameraFormat(b.dataset.fitLens, sel.value, G);
    if(res && res.ok){ if(typeof saveGame==="function") saveGame(); beep("gold"); flashes(G.flash); toast(res.msg,"good"); render(); }
    else toast((res&&res.msg)||"That lens could not be fitted.","bad");
  });
  $$("[data-spark-lens]").forEach(b=>b.onclick=()=>{
    if(typeof ProductionCreativity==="undefined" || typeof ProductionCreativity.triggerDirectorSpark!=="function") return;
    const res=ProductionCreativity.triggerDirectorSpark(b.dataset.sparkLens, G);
    if(res && res.ok){ if(typeof saveGame==="function") saveGame(); beep("gold"); flashes(G.flash); toast(res.msg,"good"); render(); }
    else toast((res&&res.msg)||"No auteur spark available.","bad");
  });
  const coProDesk=$("#btnDevelopCoPro");
  if(coProDesk) coProDesk.onclick=()=>{ beep("click"); if(typeof LiveOpsCoPro!=="undefined" && typeof LiveOpsCoPro.renderCoProductionModal==="function") LiveOpsCoPro.renderCoProductionModal(); };
  const sponsorDesk=$("#btnDevelopSponsors");
  if(sponsorDesk) sponsorDesk.onclick=()=>{ beep("click"); if(typeof StudioOperationsSuite!=="undefined" && typeof StudioOperationsSuite.renderProductPlacementModal==="function") StudioOperationsSuite.renderProductPlacementModal(); };
  /* Develop 07 destination cards: a contract opens the location desk on that commission. */
  $$("[data-dev-dest]").forEach(b=>b.onclick=()=>{ beep("click"); LOC_DESK.focus=b.dataset.devDest||null; openLocationDesk(); });
  const devLocDesk=$("#btnDevelopLocationDesk");
  if(devLocDesk) devLocDesk.onclick=()=>{ beep("click"); LOC_DESK.focus=null; openLocationDesk(); };
  $$("[data-bosub]").forEach(b=>b.onclick=()=>{ BOXOFFICE_SUB=b.dataset.bosub; beep("click"); render(); });
  const boLib=$("#btnBoLibrary");
  if(boLib) boLib.onclick=()=>{ beep("click"); switchTab("library"); };
  const boGross=$("#btnBoGrosses");
  if(boGross) boGross.onclick=()=>{ beep("click"); boxOfficeWeekendModal(); };
  const boTheaters=$("#btnBoTheaters");
  if(boTheaters) boTheaters.onclick=()=>{ beep("click"); if(typeof openTheaterChainsModal==="function") openTheaterChainsModal(); };
  const boScreen=$("#btnBoScreenings");
  if(boScreen) boScreen.onclick=()=>{ beep("click"); if(typeof openFestivalPrModal==="function") openFestivalPrModal(); else if(typeof festivalPrModal==="function") festivalPrModal(); else toast("The festival desk is unavailable in this build.","bad"); };
  $$("[data-ottsub]").forEach(b=>b.onclick=()=>{ OTT_SUB=b.dataset.ottsub; beep("click"); render(); });
  $$("[data-ott-history]").forEach(b=>b.onclick=()=>{ OTT_HISTORY_MODE=b.dataset.ottHistory==="revenue"?"revenue":"subs"; beep("click"); render(); });
  const ottRd=$("#ottOpenRd"); if(ottRd) ottRd.onclick=()=>{ beep("click"); switchTab("finance"); };
  $$("[data-libsub]").forEach(b=>b.onclick=()=>{ LIBRARY_SUB=b.dataset.libsub; beep("click"); render(); });
  $$("[data-gamestab]").forEach(b=>b.onclick=()=>{ GAMES_SUB=b.dataset.gamestab; beep("click"); render(); });

  const btnDLoc = $("#btnDashLocations"); if(btnDLoc) btnDLoc.onclick=()=>{ beep("click"); LOC_DESK.focus=null; openLocationDesk(); };
  const btnDSpo = $("#btnDashSponsors"); if(btnDSpo) btnDSpo.onclick=()=>{ beep("click"); if(typeof StudioOperationsSuite!=="undefined" && typeof StudioOperationsSuite.renderProductPlacementModal === "function") StudioOperationsSuite.renderProductPlacementModal(); };
  const btnDScout = $("#btnDashScout"); if(btnDScout) btnDScout.onclick=()=>{ beep("click"); if(typeof LiveOpsCoPro!=="undefined" && typeof LiveOpsCoPro.renderBlindBoxModal === "function") LiveOpsCoPro.renderBlindBoxModal(); };
  const btnDHw = $("#btnDashHardware"); if(btnDHw) btnDHw.onclick=()=>{ beep("click"); if(typeof GameDevHardware!=="undefined" && typeof GameDevHardware.renderHardwareModal === "function") GameDevHardware.renderHardwareModal(); };
  const btnDCo = $("#btnDashCoPro"); if(btnDCo) btnDCo.onclick=()=>{ beep("click"); if(typeof LiveOpsCoPro!=="undefined" && typeof LiveOpsCoPro.renderCoProductionModal === "function") LiveOpsCoPro.renderCoProductionModal(); };
  const btnDAwd = $("#btnDashAwards"); if(btnDAwd) btnDAwd.onclick=()=>{ beep("click"); if(typeof FilmLocationsTax!=="undefined" && typeof FilmLocationsTax.renderAwardCircuitModal === "function") FilmLocationsTax.renderAwardCircuitModal(); };
  const btnAmen = $("#btnOpenAmenities"); if(btnAmen) btnAmen.onclick=()=>{ beep("click"); if(typeof LiveOpsCoPro!=="undefined" && typeof LiveOpsCoPro.renderAmenitiesModal === "function") LiveOpsCoPro.renderAmenitiesModal(); };

  if(typeof StudioOperationsSuite!=="undefined" && typeof StudioOperationsSuite.bindEvents === "function") StudioOperationsSuite.bindEvents();
  if(typeof FilmLocationsTax!=="undefined" && typeof FilmLocationsTax.bindEvents === "function") FilmLocationsTax.bindEvents();
  if(typeof GameDevHardware!=="undefined" && typeof GameDevHardware.bindEvents === "function") GameDevHardware.bindEvents();
  if(typeof LiveOpsCoPro!=="undefined" && typeof LiveOpsCoPro.bindEvents === "function") LiveOpsCoPro.bindEvents();

  const mab=$("#btnMaBrowse"); if(mab) mab.onclick=()=>{ beep("click"); maVaultBrowser(); };
  $$("[data-macounter]").forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    const ok=maCounterRival(b.dataset.macounter);
    if(ok){ beep("cash"); } else { beep("bad"); }
    closeModal(); render();
  });
  const txs=$("#txSearch");
  if(txs) txs.oninput=()=>{
    const box=$("#txRows"); if(!box) return;
    box.innerHTML=fnLedgerRows(G.txHistory||[], txs.value);
  };
  $$("[data-tour]").forEach(b=>b.onclick=()=>{
    const lc=DATA.LABEL_COSTS||{};
    const tc=lc.tourCost!=null?lc.tourCost:8;
    if(tourArtist(b.dataset.tour)){ beep("gold"); flashes(G.flash); render(); }
    else { beep("bad"); toast("Need "+fmtM(tc)+" cash to stage a world stadium tour.","bad"); render(); }
  });
  $$("button[data-cameo]").forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    if(offerCameo(+b.dataset.cameo)){ beep("gold"); flashes(G.flash); render(); }
  });
  $$("[data-comeback]").forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    if(fundComeback(+b.dataset.comeback)){ beep("gold"); flashes(G.flash); render(); }
  });
  $$("[data-btl]").forEach(b=>b.onclick=()=>{
    const p=G.projects.find(x=>x.id===+b.dataset.btl);
    if(!p) return;
    if(G.studio.cash < 2){ toast("Assigning elite BTL crew costs $2M.","bad"); return; }
    spend("production", 2);
    p.btlAssigned = true;
    p.quality.overall = Math.min(99, (p.quality.overall||50) + 3);
    log("👷 Elite BTL Crew Assigned to “"+p.title+"” (−$2M): Cinematography & VFX polish +3 quality!","gold");
    beep("gold"); flashes(G.flash); render();
  });
  $$("[data-gplat]").forEach(b=>b.onclick=()=>{
    GAMES.platform = b.dataset.gplat;
    beep("click");
    render();
  });
  $$("[data-game-port]").forEach(b=>b.onclick=()=>{
    if(portGame(+b.dataset.gamePort)){ beep("gold"); flashes(G.flash); render(); }
  });
  $$("[data-game-sequel]").forEach(b=>b.onclick=()=>{
    const id=+b.dataset.gameSequel;
    const g = (G.gamesDiv&&G.gamesDiv.released||[]).find(x=>x.id===id);
    if(!g) return;
    g.isSequel = true;
    const devId = GAMES.dev || "partner";
    const dev = (DATA.GAME_DEVS||[]).find(d=>d.id===devId) || DATA.GAME_DEVS[0];
    if(G.studio.cash < dev.cost){ toast("Not enough cash for sequel dev up-front ("+fmtM(dev.cost)+").","bad"); return; }
    spend("games", dev.cost);
    const weeks = rint(dev.weeks[0], dev.weeks[1]);
    const title = g.title + " II";
    G.gamesDiv.projects.push({id:nid(), title, srcKey:"sequel:"+g.id, srcKind:"film", srcId:g.id, srcName:g.title,
      dev:dev.id, devName:dev.name, weeksLeft:weeks, weeks0:weeks, weekly:dev.weekly, base:dev.quality+5, power:80, spent:dev.cost, platform:GAMES.platform||"console"});
    log("🕹 Greenlit Sequel: “"+title+"” — "+dev.name+", ~"+weeks+" wks at "+fmtM(dev.weekly)+"/wk.","gold");
    beep("gold"); flashes(G.flash); render();
  });
  $$("[data-filter-prod]").forEach(b=>b.onclick=()=>{
    PROD_FILTER = b.dataset.filterProd;
    beep("click");
    render();
  });
  $$("[data-mail-cat]").forEach(b=>b.onclick=()=>{
    FAN_MAIL_FILTER = b.dataset.mailCat;
    beep("click");
    render();
  });
  /* ── v30 Live Broadcasting & Events bindings ── */
  $$("[data-livesub]").forEach(b=>b.onclick=()=>{
    if(G.live){ G.live.activeSub = b.dataset.livesub; G.live.subTab = b.dataset.livesub; beep("click"); render(); }
  });
  $$("[data-live-ch]").forEach(b=>b.onclick=()=>{
    if(G.live){ G.live.activeChannel = b.dataset.liveCh; beep("click"); render(); }
  });
  $$("[data-live-unlock]").forEach(b=>b.onclick=()=>{
    const chId = b.dataset.liveUnlock;
    const r = unlockLiveChannel(chId);
    if(r && r.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast((r && r.reason) || "Could not unlock this network.", "bad");
  });
  $$("[data-live-toggle]").forEach(b=>b.onclick=()=>{
    const chId = b.dataset.liveToggle;
    const ch = getLiveChannel(chId);
    if(ch){ setLiveChannelActive(chId, !ch.active); beep("click"); render(); }
  });
  $$("[data-live-slot]").forEach(b=>b.onclick=()=>{
    const [chId, hour] = b.dataset.liveSlot.split(":");
    beep("click");
    liveSlotModal(chId, +hour);
  });
  $$("[data-live-autofill]").forEach(b=>b.onclick=()=>{
    const [chId, strat] = b.dataset.liveAutofill.split(":");
    const chBefore = getLiveChannel(chId);
    const before = chBefore ? JSON.stringify(chBefore.schedule||[]) : "";
    autoFillSchedule(chId, strat);
    const chAfter = getLiveChannel(chId);
    const changed = !!chAfter && JSON.stringify(chAfter.schedule||[]) !== before;
    if(changed){ beep("gold"); toast("Broadcast grid updated ("+strat.replace(/_/g," ")+").", "good"); }
    else toast("Nothing to schedule — this strategy needs films or series in your library.", "bad");
    render();
  });
  $$("[data-live-clear]").forEach(b=>b.onclick=()=>{
    const chId = b.dataset.liveClear;
    if(!confirm("Clear all 24 slots on this channel? Every hour becomes Network Off-Air Filler.")) return;
    clearSchedule(chId);
    beep("click");
    toast("Broadcast schedule cleared.", "");
    render();
  });
  $$("[data-live-stream-toggle]").forEach(b=>b.onclick=()=>{
    const topicEl = document.querySelector("#liveStreamTopic"), qualEl = document.querySelector("#liveStreamQuality");
    const r = toggleLiveStream(topicEl ? topicEl.value : undefined, qualEl ? qualEl.value : undefined);
    if(r && r.ok){ beep(r.live ? "gold" : "click"); flashes(G.flash); }
    else toast((r && r.reason) || "Could not change the stream state.", "bad");
    render();
  });
  $$("[data-live-adbreak]").forEach(b=>b.onclick=()=>{
    const r = runLiveStreamAdBreak();
    if(r && r.ok){ beep("cash"); toast("Ad break aired: +"+fmtM(r.earned||0)+" ad revenue!", "gold"); }
    else toast((r && r.reason) || "Stream is offline or no active audience.", "bad");
    render();
  });
  $$("[data-live-fest-submit]").forEach(b=>b.onclick=()=>{
    const evId = b.dataset.liveFestSubmit;
    beep("click");
    liveFestSubmitModal(evId);
  });
  $$("[data-live-premiere]").forEach(b=>b.onclick=()=>{
    beep("click");
    livePremiereModal();
  });
  $$("[data-live-host-select]").forEach(b=>b.onclick=()=>{
    const hId = b.dataset.liveHostSelect;
    if(selectActiveHost(hId)){ beep("gold"); flashes(G.flash); render(); }
  });
  $$("[data-live-host-train]").forEach(b=>b.onclick=()=>{
    const hId = b.dataset.liveHostTrain;
    const r = trainLiveHost(hId);
    if(r && r.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast((r && r.reason) || "Host training failed.", "bad");
  });
  $$("[data-live-goto]").forEach(b=>b.onclick=()=>{
    if(G.live){ G.live.activeSub = b.dataset.liveGoto; G.live.subTab = b.dataset.liveGoto; beep("click"); render(); }
  });
  $$("[data-live-event-filter]").forEach(b=>b.onclick=()=>{ LIVE_EVENT_FILTER = b.dataset.liveEventFilter; beep("click"); render(); });
  $$("[data-live-premiere-host]").forEach(b=>b.onclick=()=>{
    const cityEl = document.querySelector("#livePremiereCity");
    const r = hostRedCarpetPremiere(+b.dataset.livePremiereHost, cityEl ? cityEl.value : undefined);
    if(r && r.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast((r && r.reason) || "Gala premiere failed.", "bad");
  });
  $$("[data-show-field]").forEach(el=>el.onchange=()=>{
    LIVE_SHOW_DRAFT[el.dataset.showField] = el.dataset.showField === "hour" ? +el.value : el.value;
    beep("click"); render();
  });
  $$("[data-live-show-create]").forEach(b=>b.onclick=()=>{
    const nameEl = document.querySelector("#liveShowName");
    const r = developLiveShow({ ...LIVE_SHOW_DRAFT, hour:+LIVE_SHOW_DRAFT.hour, name:nameEl ? nameEl.value : "" });
    if(r && r.ok){ beep("gold"); flashes(G.flash); toast("“"+r.show.name+"” is in the grid — first episode airs next week.", "good"); }
    else toast((r && r.reason) || "Could not develop that show.", "bad");
    render();
  });
  $$("[data-live-show-cancel]").forEach(b=>b.onclick=()=>{
    const show = getLiveShow(+b.dataset.liveShowCancel);
    if(show && !confirm("Cancel “"+show.name+"”? Its slot returns to filler and the season ends.")) return;
    const r = cancelLiveShow(+b.dataset.liveShowCancel);
    if(r && r.ok){ beep("click"); flashes(G.flash); render(); }
    else toast((r && r.reason) || "Could not cancel that show.", "bad");
  });
  $$("[data-live-show-renew]").forEach(b=>b.onclick=()=>{
    const r = renewLiveShow(+b.dataset.liveShowRenew);
    if(r && r.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast((r && r.reason) || "Could not renew that show.", "bad");
  });
  $$("[data-live-show-reschedule]").forEach(b=>b.onclick=()=>{
    const r = rescheduleLiveShow(+b.dataset.liveShowReschedule);
    if(r && r.ok){ beep("gold"); flashes(G.flash); render(); }
    else toast((r && r.reason) || "Could not reschedule that show.", "bad");
  });
  $$("[data-live-show-view]").forEach(b=>b.onclick=()=>{
    const show = getLiveShow(+b.dataset.liveShowView);
    if(show && G.live){ G.live.activeChannel = show.channel; G.live.activeSub = "linear"; G.live.subTab = "linear"; beep("click"); render(); }
  });

  /* ── Mobile sub-tab strip (rendered at the top of bindView so the
       data-* bindings above and below attach to the live chips) ── */
  $$("[data-fanfilter]").forEach(b=>b.onclick=()=>{ FAN_MAIL_FILTER=b.dataset.fanfilter; beep("click"); render(); });
  $$("[data-empiresub]").forEach(b=>b.onclick=()=>{
    if(typeof ensureEmpireState==="function") ensureEmpireState(G);
    else if(!G.empire) G.empire={subTab:"franchises",activeSub:"franchises"};
    G.empire.subTab = b.dataset.empiresub;
    G.empire.activeSub = b.dataset.empiresub;
    if(typeof saveGame==="function") saveGame();
    beep("click"); render();
  });
  $$("[data-empire-goto]").forEach(b=>b.onclick=()=>{
    if(typeof ensureEmpireState==="function") ensureEmpireState(G);
    else if(!G.empire) G.empire={subTab:"franchises",activeSub:"franchises"};
    G.empire.subTab = b.dataset.empireGoto;
    G.empire.activeSub = b.dataset.empireGoto;
    if(typeof saveGame==="function") saveGame();
    beep("click"); render();
  });
  $$("[data-gamestab]").forEach(b=>b.onclick=()=>{ /* Games tabs are view-only for now */ beep("click"); });

  /* Financial Analysis Lab bindings */
  if(typeof FINANCE_TOOLS !== 'undefined' && FINANCE_TOOLS.bindFinancialAnalysis){
    FINANCE_TOOLS.bindFinancialAnalysis();
  }

  /* 120-Feature Expansion Modules Event Bindings */
  if(typeof HollywoodCrises !== "undefined" && typeof HollywoodCrises.bindEvents === "function"){
    HollywoodCrises.bindEvents(document, G);
  }
  if(typeof DemographicsEngine !== "undefined" && typeof DemographicsEngine.bindEvents === "function"){
    DemographicsEngine.bindEvents(document, G);
  }
  if(typeof ProductionCreativity !== "undefined" && typeof ProductionCreativity.bindEvents === "function"){
    ProductionCreativity.bindEvents(document, G);
  }
  if(typeof ExhibitionPLF !== "undefined" && typeof ExhibitionPLF.bindEvents === "function"){
    ExhibitionPLF.bindEvents(document, G);
  }
  if(typeof MarketingBlitz !== "undefined" && typeof MarketingBlitz.bindEvents === "function"){
    MarketingBlitz.bindEvents(document, G);
  }

  if(typeof StudioLotBridge !== "undefined" && typeof StudioLot2D !== "undefined"){
    const roomMap = {
      studiolot: "campus",
      dashboard: "executive",
      studio: "campus",
      develop: "writers",
      productions: "soundstage",
      boxoffice: "cinema",
      fans: "cinema",
      ott: "post",
      live: "post",
      empire: "executive",
      library: "post",
      games: "post",
      finance: "executive",
      notifications: "executive"
    };
    const targetRoom = roomMap[TAB] || "campus";
    try {
      StudioLotBridge.syncWithGameState(G);
      if(!document.querySelector("#studiolotContainer canvas")){
        StudioLot2D.mount("studiolotContainer", targetRoom, { compact: TAB !== "studiolot" });
      } else {
        StudioLot2D.setView(targetRoom);
      }
    } catch(e) {
      console.warn("StudioLot mount fallback:", e);
    }
    StudioLotBridge.init().then(()=>{
      StudioLotBridge.syncWithGameState(G);
      if(!document.querySelector("#studiolotContainer canvas")){
        StudioLot2D.mount("studiolotContainer", targetRoom, { compact: TAB !== "studiolot" });
      }
    });
    const btnSync = $("#btnSyncLotState");
    if(btnSync) btnSync.onclick = ()=>{
      beep("click");
      StudioLotBridge.syncWithGameState(G);
    };
    const btnFacLot = $("#btnOpenFacilitiesFromLot");
    if(btnFacLot) btnFacLot.onclick = ()=>{
      beep("click");
      if(typeof openStudioFacilitiesModal === "function") openStudioFacilitiesModal();
    };
  }
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

/* v28: franchise transfer modal — rival buy-out offers for one of your brands */
function franchiseSaleModal(frId){
  const fr=frById(frId); if(!fr) return;
  const offs=franchiseOffers(fr);
  const exp=offs[0]&&offs[0].expires ? " · valid through "+dateLabel(offs[0].expires) : "";
  const lostWk=frWeeklyIncome(fr);
  let h="<h3>🤝 Sell the “"+esc(fr.name)+"” franchise?</h3>"+
    "<div class='tiny muted' style='margin-bottom:6px'>Selling banks cash today, forfeits "+(lostWk>0?"+"+fmtM(lostWk)+"/wk":"all future")+" merch &amp; park income forever, hands the brand to a rival, and costs −2 rep"+exp+".</div>";
  offs.forEach((o,i)=>{
    h+="<div class='bid-card'><div class='platform-logo' style='background:#2a3142'>🏢</div>"+
      "<div style='flex:1'><b>"+esc(o.rival? o.rival.name : "Unnamed buyer")+"</b><div class='tiny muted'>Outright purchase of all rights and future entries"+exp+".</div></div>"+
      "<b class='modal-offer-val'>"+fmtM(o.value)+"</b>"+
      "<button class='btn btn-primary btn-sm' data-froff='"+i+"'>Sell</button></div>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Not for sale</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-froff]").forEach(b=>b.onclick=()=>{
    if(sellFranchise(frId, offs[+b.dataset.froff])){ beep("gold"); flashes(G.flash); closeModal(); render(); }
    else beep("bad");
  });
}

/* v28: festival market-auction modal — rival buyout offers for a finished picture */
function saleModal(){
  const a=G.pendingSale; if(!a) return;
  const p=G.projects.find(x=>x.id===a.projectId);
  const fest=(DATA.FESTIVALS||[]).find(x=>x.id===a.festId);
  let h="<h3>🔨 "+(fest? esc(fest.emoji+" "+fest.name)+" market" : "Festival market")+" — “"+esc(p?p.title:"?")+"”</h3>";
  if(p) h+="<div class='tiny muted' style='margin-bottom:4px'>"+DATA.GENRES[p.genre].name+" · score "+p.quality.overall+"/100 · budget "+fmtM(p.budget)+" · selling means <b>they keep the picture</b> — you bank cash and rep now</div>";
  a.bids.forEach((b,i)=>{
    h+="<div class='bid-card'><div class='platform-logo' style='background:#2a3142'>🏢</div>"+
      "<div style='flex:1'><b>"+esc(b.rival? b.rival.name : "Unnamed buyer")+"</b><div class='tiny muted'>Wants it for their slate — film counts for them, not you.</div></div>"+
      "<b class='modal-offer-val'>"+fmtM(b.value)+"</b>"+
      "<button class='btn btn-primary btn-sm' data-sale='"+i+"'>Sell</button></div>";
  });
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='saleNo'>🎥 Walk away — keep the picture</button></div>";
  const v=openModal(h,{locked:true});
  v.querySelectorAll("[data-sale]").forEach(b=>b.onclick=()=>{
    acceptSale(+b.dataset.sale); beep("gold"); flashes(G.flash); closeModal(); render();
  });
  const no=v.querySelector("#saleNo");
  if(no) no.onclick=()=>{ declineSale(); beep("click"); closeModal(); render(); };
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

/* ═══════════ VIEW: library (v23) — released films & series vault ═══════════ */
function viewLibrary(){
  if(typeof LIBRARY_SUB === "undefined") LIBRARY_SUB = "films";
  const libTabs = [
    ["films", "Released Films"],
    ["series", "Television Series"],
    ["physical", "Physical 4K Media &amp; Box Sets"],
    ["vault", "Restoration Vault"]
  ];
  let h = "<div class='subnav-pills'>"+
    libTabs.map(([key, label]) => {
      const ic = getSubTabPixelIcon("library", key);
      const img = ic ? `<img class="subtab-pixel-icon" src="${ic}" alt="" />` : "";
      return `<button class='subnav-pill ${LIBRARY_SUB===key?"active":""}' data-libsub='${key}'>${img}<span>${label}</span></button>`;
    }).join("")+
  "</div>";

  if(LIBRARY_SUB === "physical"){
    if(typeof StudioOperationsSuite !== "undefined" && typeof StudioOperationsSuite.renderPhysicalMediaSection === "function") return h + StudioOperationsSuite.renderPhysicalMediaSection();
  }
  if(LIBRARY_SUB === "vault"){
    return h + "<div class='card'><b>Film Restoration Vault</b><div class='tiny muted' style='margin:4px 0 8px'>Digitize and remaster aged film prints to 4K Ultra HD.</div><button class='btn btn-primary' id='btnRestorationVault'>Open Restoration Vault</button></div>";
  }

  const releasedFilms = (G.films||[]).filter(f=>f.ww && f.ww>0);
  const releasedSeries = (G.series||[]).filter(s=>s.seasons?.length>0);
  
  // Filter state
  const filter = G.libFilter || { genre:"all", type:(LIBRARY_SUB==="series"?"series":"all"), year:"all", profit:"all", franchise:"all" };
  const genres = ["all", ...Object.keys(DATA.GENRES)];
  const types = ["all", "film", "series"];
  const years = ["all", ...[...new Set([
    ...releasedFilms.map(f=>yearOf(f.releaseWeek||G.week)),
    ...releasedSeries.flatMap(s=>s.seasons.map(se=>yearOf(se.when||G.week)))
  ])].sort((a,b)=>b-a)];
  const franchises = ["all", ...new Set([
    ...releasedFilms.map(f=>f.franchiseName).filter(Boolean),
    ...releasedSeries.map(s=>s.franchiseName).filter(Boolean)
  ])];
  
  // Apply filters
  let films = releasedFilms;
  let series = releasedSeries;
  if(LIBRARY_SUB==="series" || filter.type==="series") films = [];
  if(LIBRARY_SUB==="films" && filter.type==="film") series = [];
  if(filter.genre!=="all"){ films = films.filter(f=>f.genre===filter.genre); series = series.filter(s=>s.genre===filter.genre); }
  if(filter.year!=="all"){ 
    films = films.filter(f=>yearOf(f.releaseWeek||G.week)===filter.year);
    series = series.filter(s=>s.seasons.some(se=>yearOf(se.when||G.week)===filter.year));
  }
  if(filter.franchise!=="all"){
    films = films.filter(f=>f.franchiseName===filter.franchise);
    series = series.filter(s=>s.franchiseName===filter.franchise);
  }
  
  h+="<div class='spread'><div class='section-title' style='margin:0'>Library — "+(films.length+series.length)+" titles</div>"+
    "<div class='row' style='gap:6px'><button class='btn btn-sm btn-alt' id='btnRestorationVault'>Film Restoration</button>"+
    "<button class='btn btn-sm btn-ghost' onclick='openLibraryFilters()'>Filters</button></div></div>";
  
  // Filters bar
  h+="<div class='card' style='margin-bottom:8px'><div class='row' style='gap:6px;flex-wrap:wrap'>"+
    "<span class='small muted'>Type:</span>"+types.map(t=>"<button class='btn btn-xs "+(filter.type===t?"btn-primary":"btn-ghost")+"' data-lib-type='"+t+"'>"+({film:"🎬 Film",series:"📺 Series",all:"All"})[t]+"</button>").join("")+
    "<span class='small muted'>Genre:</span>"+genres.map(g=>"<button class='btn btn-xs "+(filter.genre===g?"btn-primary":"btn-ghost")+"' data-lib-genre='"+g+"' style='max-width:100px'>"+(g==="all"?"All":DATA.GENRES[g]?.emoji+" "+DATA.GENRES[g]?.name||g)+"</button>").join("")+
    "<span class='small muted'>Year:</span>"+years.map(y=>"<button class='btn btn-xs "+(filter.year===y?"btn-primary":"btn-ghost")+"' data-lib-year='"+y+"'>"+y+"</button>").join("")+
    "<span class='small muted'>Franchise:</span>"+franchises.map(f=>"<button class='btn btn-xs "+(filter.franchise===f?"btn-primary":"btn-ghost")+"' data-lib-franchise='"+esc(f)+"' style='max-width:120px'>"+(f==="all"?"All":esc(f))+"</button>").join("")+
  "</div></div>";
  
  // Films grid
  if(films.length){
    h+="<div class='section-title'>🎬 Films ("+films.length+")</div><div class='grid g3' style='margin-top:8px'>";
    films.sort((a,b)=>(b.ww||0)-(a.ww||0)).forEach(f=>{
      const be = breakevenWW(f);
      const profit = Math.round((f.ww||0) - be);
      const sp = boSplit(f);
      h+="<div class='card'><div class='spread'><b>"+(DATA.GENRES[f.genre]?DATA.GENRES[f.genre].emoji:"🎬")+" "+esc(f.title)+"</b>"+
        "<span class='tag "+(profit>=0?"pos":"neg")+"'>"+fmtG(sp.ww)+" WW</span></div>"+
        "<div class='tiny muted'>Y"+yearOf(f.releaseWeek)+" · "+DATA.GENRES[f.genre]?.name+" · "+fmtM(f.budget)+"M budget · "+
        (f.franchiseName?"🏰 "+esc(f.franchiseName)+" · ":"")+
        (profit>=0?"<span class='pos'>+"+fmtM(profit)+" profit</span>":"<span class='neg'>"+fmtM(profit)+" loss</span>")+"</div>"+
        "<div class='film-breakdown-badge'>"+
          "<span>DOM: <b class='gold'>"+fmtG(sp.dom)+"</b></span>"+
          "<span>INTL: <b style='color:var(--cyan)'>"+fmtG(sp.intl)+"</b></span>"+
          "<span>WW: <b class='pos'>"+fmtG(sp.ww)+"</b></span>"+
        "</div>"+
        "<div class='row' style='margin-top:6px;gap:4px'>"+
          "<button class='btn btn-xs btn-primary' data-dossier='"+f.id+"'>📊 Breakdown</button>"+
          "<button class='btn btn-xs btn-alt' data-re='"+f.id+"'>🎞 Re-release</button>"+
          (f.streamingOriginal||f.soldTo ? "<button class='btn btn-xs btn-alt' data-stream='"+f.id+"'>📺 Streaming</button>" : "")+
          (f.franchiseName ? "<button class='btn btn-xs btn-alt' data-fr='"+esc(f.franchiseName)+"'>🏰 Franchise</button>" : "")+
          "<button class='btn btn-xs btn-alt' data-dc='"+f.id+"'>🎬 Director's Cut</button>"+
        "</div></div>";
    });
    h+="</div>";
  }
  
  // Series grid
  if(series.length){
    h+="<div class='section-title'>📺 Series ("+series.length+")</div><div class='grid g3' style='margin-top:8px'>";
    series.sort((a,b)=>(b.totalViewers||0)-(a.totalViewers||0)).forEach(s=>{
      const totalEps = s.seasons.reduce((a,se)=>a+(se.episodes||0),0);
      h+="<div class='card'><div class='spread'><b>📺 "+esc(s.title)+"</b>"+
        "<span class='tag'>"+s.seasons.length+" seasons, "+totalEps+" eps</span></div>"+
        "<div class='tiny muted'>Y"+yearOf(s.seasons[0]?.when)+" · "+DATA.GENRES[s.genre]?.name+" · "+
        (s.franchiseName?"🏰 "+esc(s.franchiseName)+" · ":"")+
        fmtM(s.budget||0)+"M budget · "+fmtM(s.totalViewers||0)+"M peak viewers</div>"+
        "<div class='row' style='margin-top:6px;gap:4px'>"+
          "<button class='btn btn-xs btn-alt' data-seq='"+s.id+"'>🎬 New Season</button>"+
          "<button class='btn btn-xs btn-alt' data-spin='"+s.id+"'>📺 Spin-off</button>"+
          (s.franchiseName ? "<button class='btn btn-xs btn-alt' data-fr='"+esc(s.franchiseName)+"'>🏰 Franchise</button>" : "")+
        "</div></div>";
    });
    h+="</div>";
  }
  
  if(!films.length && !series.length){
    h+="<div class='card muted small' style='margin-top:16px;text-align:center'>Your vault is empty. Release a film or series to fill the shelves.</div>";
  }
  
  return h;
}

/* Filter modal */
function openLibraryFilters(){
  const filter = G.libFilter || { genre:"all", type:"all", year:"all", profit:"all", franchise:"all" };
  let h="<h3>🔍 Library Filters</h3>"+
    "<div class='card'><div class='small muted'>Genre</div><div class='row' style='flex-wrap:wrap;gap:4px'>"+
    ["all",...Object.keys(DATA.GENRES)].map(g=>"<button class='btn btn-sm "+(filter.genre===g?"btn-primary":"btn-ghost")+"' data-lib-genre='"+g+"'>"+(g==="all"?"All":DATA.GENRES[g]?.emoji+" "+DATA.GENRES[g]?.name||g)+"</button>").join("")+
    "</div></div>"+
    "<div class='card' style='margin-top:8px'><div class='small muted'>Type</div><div class='row' style='gap:4px'>"+
    ["all","film","series"].map(t=>"<button class='btn btn-sm "+(filter.type===t?"btn-primary":"btn-ghost")+"' data-lib-type='"+t+"'>"+({film:"🎬 Film",series:"📺 Series",all:"All"})[t]+"</button>").join("")+
    "</div></div>"+
    "<div class='card' style='margin-top:8px'><div class='small muted'>Year</div><div class='row' style='flex-wrap:wrap;gap:4px'>"+
    ["all",...[...new Set([
      ...(G.films||[]).map(f=>yearOf(f.releaseWeek||G.week)),
      ...(G.series||[]).flatMap(s=>s.seasons.map(se=>yearOf(se.when||G.week)))
    ])].sort((a,b)=>b-a)].map(y=>"<button class='btn btn-sm "+(filter.year===y?"btn-primary":"btn-ghost")+"' data-lib-year='"+y+"'>"+y+"</button>").join("")+
    "</div></div>"+
    "<div class='card' style='margin-top:8px'><div class='small muted'>Franchise</div><div class='row' style='flex-wrap:wrap;gap:4px'>"+
    ["all",...new Set([
      ...(G.films||[]).map(f=>f.franchiseName).filter(Boolean),
      ...(G.series||[]).map(s=>s.franchiseName).filter(Boolean)
    ])].map(f=>"<button class='btn btn-sm "+(filter.franchise===f?"btn-primary":"btn-ghost")+"' data-lib-franchise='"+esc(f)+"'>"+(f==="all"?"All":esc(f))+"</button>").join("")+
    "</div></div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Done</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-lib-genre]").forEach(b=>b.onclick=()=>{ G.libFilter.genre=b.dataset.libGenre; beep("click"); openLibraryFilters(); });
  v.querySelectorAll("[data-lib-type]").forEach(b=>b.onclick=()=>{ G.libFilter.type=b.dataset.libType; beep("click"); openLibraryFilters(); });
  v.querySelectorAll("[data-lib-year]").forEach(b=>b.onclick=()=>{ G.libFilter.year=b.dataset.libYear; beep("click"); openLibraryFilters(); });
  v.querySelectorAll("[data-lib-franchise]").forEach(b=>b.onclick=()=>{ G.libFilter.franchise=b.dataset.libFranchise; beep("click"); openLibraryFilters(); });
}

/* ═══════════ Cross-Media Timeline ── */
function crossMediaTimeline(){
  let h="<div class='empire-sub'>📅 Cross-Media Timeline</div>";
  const entries = [];
  (G.films||[]).filter(f=>f.ww).forEach(f=>{
    entries.push({type:"film", title:f.title, genre:f.genre, week:f.releaseWeek, ww:f.ww, franchise:f.franchiseName, icon:"🎬"});
  });
  (G.series||[]).forEach(s=>{
    s.seasons.forEach(se=>{
      entries.push({type:"series", title:s.title+" S"+se.num, genre:s.genre, week:se.when, viewers:se.viewership, franchise:s.franchiseName, icon:"📺"});
    });
  });
  if(G.gamesDiv?.released){
    G.gamesDiv.released.forEach(g=>{
      entries.push({type:"game", title:g.title, genre:"game", week:g.when, score:g.score, franchise:g.franchiseName, icon:"🎮"});
    });
  }
  (G.franchises||[]).forEach(fr=>{
    if(fr.merch>=1) entries.push({type:"merch", title:fr.name+" Merch Tier "+fr.merch, franchise:fr.name, week:fr.merchWeek||0, icon:"🧸"});
    if(fr.park>=1) entries.push({type:"park", title:fr.name+" Park Tier "+fr.park, franchise:fr.name, week:fr.parkWeek||0, icon:"🎡"});
  });
  entries.sort((a,b)=>(a.week||0)-(b.week||0));
  if(!entries.length){
    h+="<div class='empire-block empire-empty muted small'>No cross-media events yet. Release a film, launch a series, or build a franchise.</div>";
    return h;
  }
  h+="<div class='empire-block'><div class='timeline-container' style='position:relative;padding-left:24px'>";
  entries.forEach((e,i)=>{
    const color = {film:"var(--gold)",series:"var(--blue)",game:"var(--purple)",merch:"var(--green)",park:"var(--gold)"}[e.type]||"var(--dim)";
    const yr = yearOf(e.week||G.week);
    const w = woyOf(e.week||G.week);
    const franchiseTag = e.franchise ? "<span class='tiny muted'> · "+esc(e.franchise)+"</span>" : "";
    const details = e.ww ? "<span class='pos'>"+fmtG(e.ww)+" WW</span>" : (e.viewers?"<span class='pos'>"+e.viewers+"/100 viewers</span>" : (e.score?"<span class='gold'>"+e.score+"/100</span>":""));
    h+="<div class='timeline-item' style='position:relative;margin-bottom:16px;padding-left:16px;border-left:2px solid "+color+";'>"+
      "<div style='position:absolute;left:-22px;top:0;width:12px;height:12px;border-radius:50%;background:"+color+";border:2px solid var(--bg)'></div>"+
      "<div class='spread'><span class='tag' style='background:"+color+"20;color:"+color+"'>"+e.icon+" "+e.type.toUpperCase()+"</span>"+
      "<b style='margin-left:8px'>"+esc(e.title)+"</b>"+franchiseTag+details+"</div>"+
      "<div class='tiny muted'>Y"+yr+" W"+w+"</div>"+
    "</div>";
  });
  h+="</div></div>";
  return h;
}

/* ═══════════ Shared Universe Dashboard ── */
function sharedUniverseDashboard(){
  if(!G.universes || !G.universes.length){
    return "<div class='section-title'>🌌 Shared Universes</div><div class='card muted small'>No shared universes yet. Build two tier-2+ franchises and weave them together (Cost: $80M).</div>";
  }
  let h="<div class='section-title'>🌌 Shared Universes</div>";
  (G.universes||[]).forEach(u=>{
    const stats = uniStats(u);
    const continuity = stats.continuity || 0;
    h+="<div class='card'><div class='spread'><div><b>🌌 "+esc(u.name)+"</b>"+
      "<div class='tiny muted'>"+stats.frs.length+" brands · "+fmtG(stats.ww)+" WW · value "+fmtM(stats.value)+" · continuity "+continuity+"% · "+stats.fanbase+"</div></div>"+
      "<b class='"+(continuity>=70?"pos":continuity<40?"neg":"")+"'>"+(continuity>=70?"+5% openings":continuity<40?"−5% openings":"neutral")+"</b></div>"+
      "<div class='card' style='margin-top:8px'><b>🔗 Continuity Web</b>";
    u.franchises.forEach((fr,i)=>{
      const frObj = G.franchises.find(f=>f.name===fr);
      if(!frObj) return;
      const connections = u.franchises.filter((f,j)=>j!==i);
      if(connections.length){
        h+="<div class='tiny muted' style='margin-top:4px'><b>"+esc(fr)+"</b> ↔ "+connections.map(c=>esc(c)).join(", ")+"</div>";
      }
    });
    h+="</div>";
    h+="<div class='fr-meters' style='margin-top:8px'>";
    u.franchises.forEach(fr=>{
      const frObj = G.franchises.find(f=>f.name===fr);
      if(frObj){
        h+=frMeter(fr, fmtM(frObj.ww||0))+frMeter("Tier", frObj.tier)+frMeter("Fatigue", Math.round((frObj.fatigue||0)*100)+"%")+frMeter("Value", fmtM(frObj.earned||0));
      }
    });
    h+="</div></div>";
  });
  return h;
}

/* ═══════════ VIEW: game studio (v16) — the movie-game division ═══════════ */
let GAMES={src:null, dev:"partner", platform:"console"};
function viewGames(){
  if(typeof GAMES_SUB === "undefined") GAMES_SUB = "dev";
  const gameTabs = [
    ["dev", "In Development"],
    ["released", "Released Games"],
    ["hardware", "Hardware Platforms"],
    ["greenlight", "Greenlight Adaptation"]
  ];
  let h = "<div class='subnav-pills'>"+
    gameTabs.map(([key, label]) => {
      const ic = getSubTabPixelIcon("games", key);
      const img = ic ? `<img class="subtab-pixel-icon" src="${ic}" alt="" />` : "";
      return `<button class='subnav-pill ${GAMES_SUB===key?"active":""}' data-gamestab='${key}'>${img}<span>${label}</span></button>`;
    }).join("")+
  "</div>";

  if(GAMES_SUB === "hardware"){
    if(typeof GameDevHardware !== "undefined" && typeof GameDevHardware.renderHardwareSection === "function") return h + GameDevHardware.renderHardwareSection();
  }

  const D = G.gamesDiv || {unlocked:false, projects:[], released:[]};
  h += "<div class='section-title'>Game studio</div>";
  if(!D.unlocked){
    h += "<div class='card'><div class='spread'><div><b>Found the "+esc(G.studio.name)+" game studio</b>"+
      "<div class='tiny muted' style='margin-top:4px'>Turn your franchises and box-office hits into video games. Pick a developer house, platform, burn weekly through development, launch to a review score with a 12-week sales tail. A 70+ game re-heats its franchise brand, unlocks esports leagues, and allows porting deals.</div></div>"+
      "<button class='btn btn-primary' data-games-unlock='1'>Found it — "+fmtM(50)+"</button></div>"+
      "<div class='tiny muted' style='margin-top:6px'>+$0.4M/wk overhead once live. Up to 3 games in development at once.</div></div>";
    h += gameDevLiteHTML();
    return h;
  }
  h += "<div class='card'><div class='spread'><b>"+esc(G.studio.name)+" Interactive</b><span class='tag'>"+D.projects.length+"/3 in dev · "+D.released.length+" released</span></div></div>";
  h += gameDevLiteHTML();

  if(GAMES_SUB === "released"){
    h += "<div class='section-title'>Released games ("+D.released.length+")</div>";
    if(!D.released.length) h += "<div class='card muted small'>No releases yet — the first gold master is always the scariest.</div>";
    D.released.forEach(g=>{
      const platDef = (DATA.GAME_PLATFORMS||[]).find(p=>p.id===g.platform) || {name:g.platform||"Console"};
      h += "<div class='card'><div class='spread'><div><b>"+esc(g.title)+"</b> <span class='tag'>"+platDef.name+"</span>"+
        (g.score>=80? " <span class='tag gold'>Esports League (+$1.5M/wk)</span>":"")+
        "<div class='tiny muted'>Y"+yearOf(g.when)+" · "+fmtM(g.earned)+" earned"+(g.weeksLeft>0? " · +"+fmtM(g.weekly)+"/wk for "+g.weeksLeft+" more wks":" · sales tail ended")+"</div></div>"+
        "<div style='text-align:right'><div style='font-size:18px;font-weight:700' class='"+(g.score>=70?"pos":g.score<45?"neg":"gold")+"'>Review: "+g.score+"/100</div>"+
        "<div class='row' style='gap:4px;margin-top:4px'>"+
          (g.score>=65 && !g.isSequel ? "<button class='btn btn-xs btn-alt' data-game-sequel='"+g.id+"'>Sequel</button>" : "")+
          (!g.ported ? "<button class='btn btn-xs btn-alt' data-game-port='"+g.id+"'>Port Deals (+$4M)</button>" : "<span class='tag green tiny'>✓ Ported</span>")+
        "</div></div></div></div>";
    });
    return h;
  }

  if(GAMES_SUB === "greenlight"){
    const srcs = gameSources();
    h += "<div class='section-title'>Greenlight an adaptation</div>";
    if(!srcs.length){
      h += "<div class='card muted small'>No eligible sources — land a franchise (any tier) or a 1.2× breakeven release first, and keep them out of development.</div>";
    }else{
      h += "<div class='card'><div class='tiny muted' style='margin-bottom:6px'>Pick a source, target platform, then a developer house. Hotter sources make better games.</div>"+
        "<div class='small muted' style='margin-bottom:6px'>Source</div><div class='row' style='flex-wrap:wrap'>";
      srcs.slice(0,10).forEach(s=>{
        h += "<button class='btn btn-sm "+(GAMES.src===s.id?"btn-primary":"btn-alt")+"' data-gsrc='"+s.id+"'>"+esc(s.name)+" ("+s.heat.toFixed(1)+"x heat)</button>";
      });
      h += "</div></div>";
    }
    return h;
  }

  h += "<div class='section-title'>In development ("+D.projects.length+")</div>";
  if(!D.projects.length) h += "<div class='card muted small'>The dev floor is quiet — greenlight an adaptation.</div>";
  D.projects.forEach(pr=>{
    const pct=Math.round((1-pr.weeksLeft/pr.weeks0)*100);
    const platDef = (DATA.GAME_PLATFORMS||[]).find(p=>p.id===pr.platform) || {emoji:"🎮", name:pr.platform||"Console"};
    h+="<div class='card'><div class='spread'><div><b>🕹 "+esc(pr.title)+"</b> <span class='tag'>"+platDef.emoji+" "+platDef.name+"</span><div class='tiny muted'>"+esc(pr.devName)+" · "+fmtM(pr.weekly)+"/wk · "+pr.weeksLeft+" wk"+(pr.weeksLeft===1?"":"s")+" to gold master</div></div>"+
      "<span class='tag'>"+pct+"%</span></div>"+
      "<div style='height:8px;border-radius:6px;background:rgba(255,255,255,.08);margin-top:8px;overflow:hidden'><div style='height:100%;width:"+pct+"%;background:linear-gradient(90deg,var(--gold),var(--gold2))'></div></div></div>";
  });
  h+="<div class='section-title'>Released games ("+D.released.length+")</div>";
  if(!D.released.length) h+="<div class='card muted small'>No releases yet — the first gold master is always the scariest.</div>";
  D.released.forEach(g=>{
    const platDef = (DATA.GAME_PLATFORMS||[]).find(p=>p.id===g.platform) || {emoji:"🎮", name:g.platform||"Console"};
    h+="<div class='card'><div class='spread'><div><b>🎮 "+esc(g.title)+"</b> <span class='tag'>"+platDef.emoji+" "+platDef.name+"</span>"+
      (g.score>=80? " <span class='tag gold'>🏆 Esports League (+$1.5M/wk)</span>":"")+
      "<div class='tiny muted'>Y"+yearOf(g.when)+" · "+fmtM(g.earned)+" earned"+(g.weeksLeft>0? " · +"+fmtM(g.weekly)+"/wk for "+g.weeksLeft+" more wks":" · sales tail ended")+"</div></div>"+
      "<div style='text-align:right'><div style='font-size:18px;font-weight:700' class='"+(g.score>=70?"pos":g.score<45?"neg":"gold")+"'>Review: "+g.score+"/100</div>"+
      "<div class='row' style='gap:4px;margin-top:4px'>"+
        (g.score>=65 && !g.isSequel ? "<button class='btn btn-xs btn-alt' data-game-sequel='"+g.id+"'>⚡ Sequel</button>" : "")+
        (!g.ported ? "<button class='btn btn-xs btn-alt' data-game-port='"+g.id+"'>🚢 Port Deals (+$4M)</button>" : "<span class='tag green tiny'>✓ Ported</span>")+
      "</div></div></div></div>";
  });
  const srcs=gameSources();
  h+="<div class='section-title'>Greenlight an adaptation</div>";
  if(!srcs.length){
    h+="<div class='card muted small'>No eligible sources — land a franchise (any tier) or a 1.2× breakeven release first, and keep them out of development.</div>";
  }else{
    h+="<div class='card'><div class='tiny muted' style='margin-bottom:6px'>Pick a source, target platform, then a developer house. Hotter sources make better games.</div>"+
      "<div class='small muted' style='margin-bottom:6px'>Source</div><div class='row' style='flex-wrap:wrap'>";
    srcs.slice(0,10).forEach(s=>{
      h+="<button class='btn btn-sm"+(GAMES.src===s.key?" btn-primary":"")+"' data-gsrc='"+esc(s.key)+"'>"+s.emoji+" "+esc(s.name)+" <span class='tiny muted'>🔥"+s.heat+"</span></button>";
    });
    h+="</div>"+
      "<div class='small muted' style='margin:10px 0 6px'>Platform target</div><div class='row' style='flex-wrap:wrap;gap:4px'>"+
      (DATA.GAME_PLATFORMS||[]).map(p=>"<button class='btn btn-sm "+((GAMES.platform||"console")===p.id?"btn-primary":"")+"' data-gplat='"+p.id+"'>"+p.emoji+" "+p.name+" ("+p.mult+"× sales)</button>").join("")+
      "</div>"+
      "<div class='small muted' style='margin:10px 0 6px'>Developer house</div><div class='plan-pick'>";
    (DATA.GAME_DEVS||[]).forEach(d=>{
      h+="<div class='plan-opt"+(GAMES.dev===d.id?" sel":"")+"' data-gdev='"+d.id+"'><div class='spread'><h5>"+d.name+"</h5><span class='tag "+(GAMES.dev===d.id?"gold":"")+"'>"+fmtM(d.cost)+" + "+fmtM(d.weekly)+"/wk</span></div>"+
        "<div class='p-sub'>"+d.blurb+" Base quality ~"+d.quality+", "+d.weeks[0]+"–"+d.weeks[1]+" weeks.</div></div>";
    });
    h+="</div><div class='row' style='margin-top:10px'><button class='btn btn-primary' id='gsGo'>🕹 Greenlight the game</button></div></div>";
  }
  return h;
}

/* ═══════════ EMPIRE view ═══════════ */
const EMPIRE_SECTIONS = [["home","Home"],["franchises","Franchises"],["universes","Universes"],["divisions","Divisions"],["endgame","Endgame"]];
function empireSub(){
  if(typeof ensureEmpireState==="function") ensureEmpireState(G);
  const emp=(G&&G.empire)||{};
  const want=emp.activeSub||emp.subTab||"franchises";
  return EMPIRE_SECTIONS.some(s=>s[0]===want)?want:"franchises";
}
function empireNav(){
  const active=empireSub();
  return `<nav class="command-section-nav command-empire-nav" aria-label="Empire desk sections"><div class="command-nav-brand"><span>EMPIRE DESK</span><small>HOME / FRANCHISES / UNIVERSES / DIVISIONS / ENDGAME</small></div><div class="command-nav-items">${EMPIRE_SECTIONS.map(([key,label],i)=>{
    const icon=getSubTabPixelIcon("empire",key);
    return `<button data-empiresub="${key}" class="${active===key?"active":""}" aria-current="${active===key?"page":"false"}"><small>0${i+1}</small>${icon?`<img class="subtab-pixel-icon" src="${icon}" alt="" />`:""}<span>${label}</span></button>`;
  }).join("")}</div></nav>`;
}
/* ── v35.0 EMPIRE DESK shell — head, telemetry and produce-panel surfaces ── */
function empireHead(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  return `<header class="command-heading"><div><span class="command-edition">EMPIRE DESK / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">FRANCHISES / UNIVERSES / DIVISIONS / ENDGAME CROWN</span><h1>The empire command desk.</h1><p>Franchises, shared universes, divisions and the endgame crown — the global entertainment conglomerate, every empire decision in one place.</p></div><div class="command-date"><span>WEEK</span><b>${String(w).padStart(2,"0")}</b><small>${esc(m.month)}</small></div></header>`;
}
function empireTelemetry(){
  const ewb=(typeof empireWeeklyBreakdown==="function")?empireWeeklyBreakdown():{total:G.franchises.reduce((a,f)=>a+frWeeklyIncome(f),0)};
  const owned=(G.franchises||[]).length;
  const tier2=(G.franchises||[]).filter(f=>(f.tier||0)>=2).length;
  const earned=(G.franchises||[]).reduce((a,f)=>a+(f.earned||0),0);
  const ww=(G.franchises||[]).reduce((a,f)=>a+(f.ww||0),0);
  return `<div class="command-telemetry">${commandMetric("FRANCHISES OWNED",String(owned),tier2+" at tier 2+")}${commandMetric("EMPIRE INCOME / WEEK","+"+fmtM(ewb.total),"Settles weekly in tickEmpire()")}${commandMetric("FRANCHISE EARNINGS",fmtM(earned),"Lifetime, credited per brand")}${commandMetric("FRANCHISE WW GROSS",fmtG(ww),"Cumulative worldwide gross")}</div>`;
}
function empirePanel(eyebrow,title,description,content,aside,cls){
  return `<section class="produce-panel ${cls||""}"><div class="produce-panel-head"><div><span class="command-eyebrow">${eyebrow}</span><h2>${title}</h2>${description?`<p>${description}</p>`:""}</div>${aside?`<div class="empire-panel-aside">${aside}</div>`:""}</div><div class="empire-panel-body">${content}</div></section>`;
}
function empireShell(panelHtml){
  return `<section class="command-deck command-produce command-empire">${empireHead()}${empireNav()}${empireTelemetry()}${panelHtml}</section>`;
}
function empireAsideFan(){ return `<button class="btn btn-sm btn-alt" id="btnOpenFanClub">Fan Conventions ↗</button>`; }
function empireAsideUni(){ return `<button class="btn btn-sm btn-alt" id="btnOpenUniverses">Cinematic Universes Charter ↗</button>`; }
function empireAsideMerch(){ return `<button class="btn btn-sm btn-alt" id="btnOpenMerch">Merch &amp; Licensing Deals ↗</button>`; }

/* ── v35.0 C2 — Portfolio Desk: view-only sort & filter (session state, never saved) ── */
const EMPIRE_PORTFOLIO={ filter:"all", sort:"tier" };
function empirePortfolioList(){
  let list=(G.franchises||[]).slice();
  if(EMPIRE_PORTFOLIO.filter==="earning") list=list.filter(f=>frWeeklyIncome(f)>=0.1);
  else if(EMPIRE_PORTFOLIO.filter==="resting") list=list.filter(f=>frRestPlan(f).totalWks>0);
  else if(EMPIRE_PORTFOLIO.filter==="tier2") list=list.filter(f=>(f.tier||0)>=2);
  const s=EMPIRE_PORTFOLIO.sort;
  list.sort((a,b)=>{
    if(s==="name") return String(a.name).localeCompare(String(b.name));
    if(s==="ww") return (b.ww||0)-(a.ww||0);
    if(s==="income") return frWeeklyIncome(b)-frWeeklyIncome(a);
    if(s==="value") return franchiseValue(b)-franchiseValue(a);
    return (b.tier||0)-(a.tier||0) || String(a.name).localeCompare(String(b.name));
  });
  return list;
}
function empirePortfolio(){
  const list=empirePortfolioList();
  const filters=[["all","All brands"],["earning","Earning"],["resting","Resting"],["tier2","Tier 2+"]];
  const sorts=[["tier","Tier"],["ww","WW gross"],["income","Income/wk"],["value","Value"],["name","A–Z"]];
  let h="<div class='empire-block empire-portfolio'><div class='spread'><div class='empire-sub' style='margin:0'>📊 Portfolio desk</div><span class='tag'>"+list.length+" shown</span></div>";
  h+="<div class='row' style='gap:6px;flex-wrap:wrap;margin:8px 0'>"+
    filters.map(([k,l])=>"<button class='btn btn-xs "+(EMPIRE_PORTFOLIO.filter===k?"btn-primary":"btn-alt")+"' data-em-filter='"+k+"'>"+l+"</button>").join("")+
    "<span class='tiny muted' style='align-self:center;margin-left:6px'>Sort:</span>"+
    sorts.map(([k,l])=>"<button class='btn btn-xs "+(EMPIRE_PORTFOLIO.sort===k?"btn-primary":"btn-alt")+"' data-em-sort='"+k+"'>"+l+"</button>").join("")+
  "</div>";
  if(!list.length) h+="<div class='tiny muted'>No brands match this filter — clear it to see the whole stable.</div>";
  list.forEach(fr=>{
    const inc=frWeeklyIncome(fr), plan=frRestPlan(fr);
    const badges=((fr.custom?" <span class='tag purple'>🧪 custom IP</span>":"")+(fr.purchased?" <span class='tag gold'>🌍 purchased IP</span>":""));
    h+="<div class='empire-row empire-prow'><span><b>"+esc(fr.name)+"</b>"+badges+" <span class='tiny muted'>tier "+fr.tier+" · "+(fr.entries||[]).length+" entr"+((fr.entries||[]).length===1?"y":"ies")+"</span></span>"+
      "<span class='tiny'>"+fmtG(fr.ww||0)+" WW · "+(inc>=0.1?"+"+fmtM(inc)+"/wk":"—")+" · heat "+frHeatPct(fr)+"% · "+(plan.totalWks?"rest ~"+plan.totalWks+"w":"rested")+" · "+fmtM(franchiseValue(fr))+"</span></div>";
  });
  return h+"</div>";
}

/* ── v35.0 C4 — Sequel Timing Planner: countdown derives from tickFatigue() ── */
function empireSequelPlanner(fr){
  const plan=frRestPlan(fr), fat=Math.round((fr.fatigue||0)*100);
  let h="<div class='empire-block empire-planner'><div class='empire-sub'>⏱ Sequel timing planner</div>";
  h+="<div class='empire-row'><span>😴 Franchise fatigue</span><b class='"+((fr.fatigue||0)>0.3?"neg":(fr.fatigue||0)>0.15?"":"pos")+"'>"+fat+"%</b></div>";
  h+="<div class='empire-row'><span>🕰 Rest countdown <span class='tiny muted'>(tickFatigue rule: heals 0.4%/wk once the brand is quiet 26+ wks)</span></span><b>"+(plan.totalWks?"Resting: ~"+plan.totalWks+" wks to heal":"Brand rested & fresh")+"</b></div>";
  h+="<div class='empire-row'><span>🎬 Sequel call</span><b class='tiny'>"+frSequel(fr)+"</b></div>";
  h+="<div class='empire-row'><span>🎭 Spin-off call</span><b class='tiny'>"+frSpinoff(fr)+"</b></div>";
  return h+"</div>";
}

/* ── v35.0 C8 — IP Market & Sell: live listings + sealed-bid sales on real state ── */
function empireIpMarket(){
  const mkt=(G.ipMarket||[]).slice(0,6);
  let h="<div class='empire-block empire-ipsell'><div class='empire-sub'>🌍 IP market & sell</div>";
  h+="<div class='tiny muted' style='margin-bottom:6px'>Buy proven IP straight into the brand stable, or open a sealed-bid sale on any franchise — every offer below is real money on paper.</div>";
  if(!mkt.length) h+="<div class='tiny muted'>The market is empty — listings rotate in over the run.</div>";
  mkt.forEach(it=>{
    const kindName=(DATA.IPKINDS||[]).find(k=>k.id===it.kind);
    const canBuy=G.studio.cash>=it.price;
    h+="<div class='empire-row'><span><b>"+esc(it.title)+"</b> <span class='tiny muted'>"+(kindName?esc(kindName.name):(it.kind==="custom"?"custom franchise":"legacy franchise"))+" · boost +"+(it.boost||0)+"</span></span>"+
      "<button class='btn btn-sm "+(canBuy?"btn-primary":"btn-alt")+"' data-ip='"+it.id+"'"+(canBuy?"":" disabled title='Requires "+fmtM(it.price)+" cash'")+">Buy · "+fmtM(it.price)+(canBuy?"":" (need "+fmtM(it.price)+")")+"</button></div>";
  });
  (G.franchises||[]).forEach(fr=>{
    let top=0; try{ top=(franchiseOffers(fr)[0]||{}).value||0; }catch(e){}
    h+="<div class='empire-row'><span>🤝 Sell <b>"+esc(fr.name)+"</b> <span class='tiny muted'>sealed bids · 8-wk window</span></span>"+
      "<button class='btn btn-sm btn-alt' data-fr-sell='"+fr.id+"'>🤝 Sell IP · top bid "+fmtM(top)+"</button></div>";
  });
  return h+"</div>";
}

/* ── v35.0 C11 — Custom & Purchased Onboarding: guidance for owned special IP ── */
function empireOnboarding(){
  const customs=(G.franchises||[]).filter(f=>f.custom||f.purchased);
  let h="<div class='empire-block empire-onboard'><div class='empire-sub'>🧭 Custom & purchased IP · desk guide</div>";
  h+="<div class='tiny muted' style='margin-bottom:6px'>Every entry adds <b>franchise fatigue</b> (smaller openings, weaker reviews) that only heals if you rest the brand — see the sequel timing planner — or perform an active Brand Reboot. Merch &amp; parks pay every week and spike again whenever a franchise film hits theaters. Game rights are one-time cash per tier.</div>";
  if(!customs.length) h+="<div class='tiny muted'>Custom brands from the Creative Lab and purchased IP from the market land here with guidance the moment you own one.</div>";
  customs.forEach(fr=>{
    h+="<div class='empire-row'><span><b>"+esc(fr.name)+"</b>"+(fr.custom?" <span class='tag purple'>🧪 custom</span>":"")+(fr.purchased?" <span class='tag gold'>🌍 purchased</span>":"")+
      " <span class='tiny muted'>"+((fr.entries||[]).length?"keep the streak going":"no entries yet — greenlight the first entry on its dossier")+"</span></span>"+
      "<span class='tiny muted'>tier "+fr.tier+" · "+fmtG(fr.ww||0)+" WW</span></div>";
  });
  return h+"</div>";
}

/* ── v35.0 C5 — Merch & Parks: income split straight from frIncomeBreakdown() ── */
function merchParksRollup(){
  const M=DATA.MERCH_V2||{};
  let h="<div class='empire-block empire-merchparks'><div class='empire-sub'>🧸 Merch &amp; parks</div>";
  h+="<div class='tiny muted' style='margin-bottom:6px'>Weekly shelf + gate income with every live boost applied: holiday shelves ×"+(M.holidayMult||1.6)+" ("+(M.holidayMonths||[]).join(", ")+"), park summer ×"+(M.parkSummerMult||1.25)+" ("+(M.parkSummer||[]).join(", ")+"), toy lines ×"+(M.toyMult||1.3)+".</div>";
  if(!(G.franchises||[]).length) h+="<div class='tiny muted'>No brands yet — merch and parks unlock with your first franchise.</div>";
  (G.franchises||[]).forEach(fr=>{
    const b=frIncomeBreakdown(fr);
    h+="<div class='empire-row'><span><b>"+esc(fr.name)+"</b> <span class='tiny muted'>merch L"+(fr.merch||0)+(fr.toys?" · 🧒 toy line":"")+" · park "+(fr.park?"L"+fr.park:"—")+"</span></span>"+
      "<span class='tiny'>🧸 "+(b.merch>=0.1?"+"+fmtM(b.merch)+"/wk":"—")+" · 🎡 "+(b.park>=0.1?"+"+fmtM(b.park)+"/wk":"—")+(b.uniBonus>1?" · +"+Math.round((b.uniBonus-1)*100)+"% universe":"")+"</span></div>";
  });
  return h+"</div>";
}
function viewEmpire(){
  if(typeof ensureEmpireState==="function") ensureEmpireState(G);
  const active=empireSub();
  let h="";

  if(active==="home"){
    let goalsDone=0;
    try{ goalsDone=(endgameGoals()||[]).filter(g=>g.prog>=1).length; }catch(e){}
    const L=G.label||{unlocked:false, artists:[]};
    h+="<div class='empire-block empire-brief'><div class='spread'><b>Empire overview</b><span class='tag gold'>"+goalsDone+"/6 endgame</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>"+G.franchises.length+" franchise(s) · "+(G.universes||[]).length+" shared universe(s) · Music label "+(L.unlocked?"live ("+(L.artists||[]).length+"/3 acts)":"locked")+"</div>"+
      "<div class='row' style='margin-top:8px;gap:6px;flex-wrap:wrap'>"+
        "<button class='btn btn-sm btn-alt' data-empire-goto='franchises'>Franchises</button>"+
        "<button class='btn btn-sm btn-alt' data-empire-goto='universes'>Universes</button>"+
        "<button class='btn btn-sm btn-alt' data-empire-goto='divisions'>Divisions</button>"+
        "<button class='btn btn-sm btn-alt' data-empire-goto='endgame'>Endgame</button>"+
        "<button class='btn btn-sm btn-alt' onclick='switchTab(\"games\")'>Open Game Studio ↗</button>"+
      "</div></div>";
    if(!G.franchises.length){
      h+="<div class='empire-block empire-empty muted small'>No franchises yet. Land a theatrical <b>hit</b> — roughly 2× breakeven worldwide with reviews ≥66 — and the brand unlocks here: sequels, 🧸 merchandise, 🎮 game licenses and 🎡 theme-park attractions. Animation & fantasy merchandise best; parks need a tier-2 franchise.</div>";
    }
    try{ h+=crossMediaTimeline(); }catch(e){}
    return empireShell(empirePanel("EMPIRE / HOME","Empire home","Where the conglomerate stands today — holdings, the cross-media timeline and what needs you.",h,empireAsideFan()));
  }

  if(active==="universes"){
    try{ if(typeof uniBoard==="function") h+=uniBoard(); }catch(e){}
    return empireShell(empirePanel("EMPIRE / UNIVERSES","Universes","Shared-universe overlays — continuity rewards rested, coherent brands (±5% openings).",h,empireAsideUni()));
  }

  if(active==="divisions"){
    h+="<div class='row' style='margin-bottom:8px;gap:6px;flex-wrap:wrap'>"+
      "<button class='btn btn-sm btn-alt' onclick='switchTab(\"games\")'>Open Game Studio ↗</button>"+
    "</div>";
    /* v14: music label division (§32) */
    try{
      const L=G.label||{unlocked:false, artists:[]};
      const lc=DATA.LABEL_COSTS||{};
      const unlockCost=lc.unlock!=null?lc.unlock:60;
      const tourCost=lc.tourCost!=null?lc.tourCost:8;
      const tourBuzzPct=Math.round((lc.tourBuzzBonus!=null?lc.tourBuzzBonus:0.06)*100);
      const chartBuzzPct=Math.round((lc.chartBuzzBonus!=null?lc.chartBuzzBonus:0.02)*100);
      const tourChartWks=lc.tourChartWeeks!=null?lc.tourChartWeeks:8;
      const ovh=lc.overheadPerWeek!=null?lc.overheadPerWeek:0.3;
      const maxActs=lc.maxActs||3;
      h+="<div class='empire-sub'>🎵 Music label</div>";
      if(!L.unlocked){
        const canUnlock=G.studio.cash>=unlockCost;
        h+="<div class='empire-block empire-label'><div class='spread'><div><b>Launch the "+esc(G.studio.name)+" music label</b><div class='tiny muted'>Sign up to "+maxActs+" acts. Each earns weekly; when one charts, money ×3 for a month and your in-production musicals & concert films get +"+chartBuzzPct+"% buzz. Charts also feed the trending board's ecosystem.</div></div>"+
          "<button class='btn btn-primary' data-label='1'"+(canUnlock?"":" disabled title='Requires "+fmtM(unlockCost)+" cash'")+">Launch — "+fmtM(unlockCost)+(canUnlock?"":" (need "+fmtM(unlockCost)+")")+"</button></div>"+
          "<div class='tiny muted' style='margin-top:6px'>+"+fmtM(ovh)+"/wk overhead once live. Sign artists from the roster below.</div></div>";
      }else{
        h+="<div class='empire-block empire-label'><div class='spread'><b>🎧 "+esc(G.studio.name)+" Records</b><span class='tag'>"+L.artists.length+"/"+maxActs+" acts</span></div>";
        (L.artists||[]).forEach(a=>{
          const def=(DATA.ARTISTS||[]).find(x=>x.id===a.id)||{};
          const charting=(a.chartUntil||0)>G.week;
          const chartWksLeft=charting?Math.max(0,a.chartUntil-G.week):0;
          const artWk=(typeof labelArtistWeeklyIncome==="function")?labelArtistWeeklyIncome(a):(Math.round((0.08+0.14*(a.heat||1))*(charting?3:1)*10)/10);
          const canTour=G.studio.cash>=tourCost;
          const tourTip="Concert tour: "+fmtM(tourCost)+" upfront, variable tour gross, +"+tourBuzzPct+"% buzz for in-production musicals & concert films, "+tourChartWks+"-wk chart boost";
          h+="<div class='empire-row'><span>🎤 <b>"+esc(a.name)+"</b> <span class='tiny muted'>"+esc(def.vibe||"")+" · heat "+(a.heat||1)+(charting?" · <b class='pos'>CHARTING (×3 · "+chartWksLeft+" wk"+(chartWksLeft===1?"":"s")+" left)</b>":"")+"</span></span>"+
            "<div class='row' style='gap:6px;align-items:center'><b class='"+(charting?"pos":"")+"'>+"+fmtM(artWk)+"/wk</b>"+
            "<button class='btn btn-xs btn-alt' data-tour='"+a.id+"' title='"+tourTip+"'"+(canTour?"":" disabled")+">🎤 World Tour ("+fmtM(tourCost)+")</button>"+
            " <button class='btn btn-sm btn-ghost' data-dropartist='"+a.id+"'>✕</button></div></div>";
        });
        if(!L.artists.length) h+="<div class='tiny muted'>Empty roster — sign your first act below.</div>";
        h+="<div class='tiny muted' style='margin-top:6px'>Available acts:</div>";
        (DATA.ARTISTS||[]).filter(a=>!L.artists.some(x=>x.id===a.id)).forEach(a=>{
          const canSign=G.studio.cash>=a.fee && L.artists.length<maxActs;
          h+="<div class='empire-row'><span>🎤 <b>"+esc(a.name)+"</b> <span class='tiny muted'>"+esc(a.blurb)+"</span></span>"+
            "<button class='btn btn-sm "+(canSign?"btn-primary":"")+"' data-sign='"+a.id+"'"+(canSign?"":" disabled")+">Sign — "+fmtM(a.fee)+"</button></div>";
        });
        h+="</div>";
      }
    }catch(e){}
    try{ h+=merchParksRollup(); }catch(e){}
    try{ h+=merchBoard(); }catch(e){}
    try{ h+=divisionsPanel(); }catch(e){}
    return empireShell(empirePanel("EMPIRE / DIVISIONS","Divisions","Music label, film merchandising, publishing, comics and direct retail.",h,empireAsideMerch()));
  }

  if(active==="endgame"){
    try{ if(typeof endgameBoard==="function") h+=endgameBoard(); }catch(e){}
    return empireShell(empirePanel("EMPIRE / ENDGAME","Endgame","Six optional milestones toward the industry crown — the sandbox stays untouched.",h,""));
  }

  if(!G.franchises.length){
    h+="<div class='empire-block empire-empty muted small'>No franchises yet. Land a theatrical <b>hit</b> — roughly 2× breakeven worldwide with reviews ≥66 — and the brand unlocks here: sequels, 🧸 merchandise, 🎮 game licenses and 🎡 theme-park attractions. Animation & fantasy merchandise best; parks need a tier-2 franchise.</div>";
  }
  try{ h+=empirePortfolio(); }catch(e){}
  for(const fr of empirePortfolioList()){
    const g=DATA.GENRES[fr.genre];
    const inc=frWeeklyIncome(fr);
    const brk=frIncomeBreakdown(fr);
    const isShared = fr.universe || G.franchises.some(f2=>f2.id!==fr.id && f2.universe && f2.universe===fr.universe);
    const merchTier = (DATA.MERCH_TIERS||[])[fr.merch||0] || {icon:"🧸", name:"Tier "+(fr.merch||0)};

    h+="<div class='empire-block empire-dossier'><div class='fr-head'><div class='fr-emblem'>"+g.emoji+"</div>"+
      "<div style='flex:1;min-width:180px'><b>"+esc(fr.name)+"</b> <span class='tag gold'>tier "+fr.tier+"</span>"+
      (isShared? " <span class='tag purple'>🌌 Shared Universe (+10% cross-pollination)</span>":"")+
      "<div class='tiny muted'>"+fr.entries.length+" franchise hit"+(fr.entries.length>1?"s":"")+" · "+fmtG(fr.ww)+" WW · merch potential "+Math.round(g.merch*100)+"%</div></div>"+
      "<div style='text-align:right'><b class='"+(inc>=0.1?"pos":"muted")+"'>"+(inc>=0.1?"+"+fmtM(inc)+"/wk":"—")+"</b>"+
      (G.universeBonus?"<div class='tiny gold'>+15% universe</div>":"")+
      "<div class='tiny muted'>"+(frHeatPct(fr)<95? "cooling · "+frHeatPct(fr)+"%":"hot · "+frHeatPct(fr)+"%")+"</div></div></div>"+
      
      empireSequelPlanner(fr)+
      
      "<div class='fr-meters' style='margin-top:8px'>"+
        frMeter("💎 Value", fmtM(frValue(fr)))+
        frMeter("👥 Fanbase", "<span class='tiny'>"+frFanbase(fr)+"</span>")+
        frMeter("🔥 Heat", frHeatPct(fr)+"%")+
        frMeter("😴 Fatigue", "<span class='"+((fr.fatigue||0)>0.3?"neg":(fr.fatigue||0)>0.15?"":"pos")+"'>"+Math.round((fr.fatigue||0)*100)+"%</span>")+
        frMeter("🧸 Merchandise", merchTier.icon+" "+merchTier.name)+
        frMeter("🎡 Park", fr.tier>=2? (fr.park? "L"+fr.park+" · +"+fmtM(brk.park)+"/wk" : "<span class='tiny muted'>unbuilt</span>") : "<span class='tiny muted'>needs tier 2</span>")+
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
      "<button class='btn btn-sm btn-primary' data-fr-seq='"+fr.id+"'>⚡ "+(frResolvableFilm(fr)? "Greenlight Sequel":"Greenlight First Entry")+"</button>"+
      (fr.podcast? (fr.podcastDone? "<span class='tag' style='align-self:center'>🎙️ Podcast complete</span>" : "<span class='tag green' style='align-self:center'>🎙️ Podcast live · "+Math.max(0,(DATA.PODCAST?.duration||12)-(fr.podcastWeeks||0))+" wks left</span>")
        : (function(){
          const pc=DATA.PODCAST?.cost||0.5, dur=DATA.PODCAST?.duration||12, subs=DATA.PODCAST?.subsPerWeek||0.5, ok=G.studio.cash>=pc;
          const subCopy=G.streamer? "+"+subs+"M subs/wk to "+esc(G.streamer.name) : "needs own streamer for +"+subs+"M subs/wk";
          return "<button class='btn btn-sm btn-alt' data-fr-podcast='"+fr.id+"' title='"+dur+" wks · +1 rep · "+subCopy+"'"+(ok?"":" disabled")+">🎙️ Launch Podcast · "+fmtM(pc)+" ("+dur+" wks · "+(G.streamer?"+"+subs+"M subs/wk":"+1 rep, streamer req. for subs")+")</button>";
        })())+
      (fr.merch<3? (function(){
        const mc=merchCost(fr), ok=G.studio.cash>=mc;
        return "<button class='btn btn-sm btn-alt' data-fr-merch='"+fr.id+"'"+(ok?"":" disabled title='Requires "+fmtM(mc)+" cash'")+">🧸 "+(fr.merch?"Upgrade merch":"Launch merch")+" · "+fmtM(mc)+(ok?"":" (need "+fmtM(mc)+")")+"</button>";
      })() : "<span class='tag green' style='align-self:center'>merch maxed</span>")+
      (fr.park<3? (fr.tier>=2? (function(){
        const pc=parkCost(fr), ok=G.studio.cash>=pc;
        return "<button class='btn btn-sm btn-alt' data-fr-park='"+fr.id+"'"+(ok?"":" disabled title='Requires "+fmtM(pc)+" cash'")+">🎡 "+(fr.park?(fr.park===2?"Resort district":"Expand park"):"Build attraction")+" · "+fmtM(pc)+(ok?"":" (need "+fmtM(pc)+")")+"</button>";
      })() : "<span class='tag' style='align-self:center'>🎡 park unlocks at tier 2</span>") : "<span class='tag green' style='align-self:center'>park maxed</span>")+
      (fr.gameSold!==fr.tier? "<button class='btn btn-sm btn-alt' data-fr-game='"+fr.id+"'>🎮 License game rights (Tier "+fr.tier+": +"+fmtM(gameRightsPayout(fr))+")</button>":"")+
      (!fr.toys && fr.merch>=1? (function(){
        const tc=DATA.MERCH_V2? DATA.MERCH_V2.toyCost(fr.tier):45, ok=G.studio.cash>=tc;
        return "<button class='btn btn-sm btn-alt' data-fr-toys='"+fr.id+"'"+(ok?"":" disabled title='Requires "+fmtM(tc)+" cash'")+">🧒 Toy line · "+fmtM(tc)+(ok?"":" (need "+fmtM(tc)+")")+"</button>";
      })() : "")+
      ((fr.fatigue||0)>0.1? "<button class='btn btn-sm btn-alt' data-fr-reboot='"+fr.id+"'>✨ Brand Reboot ($25M)</button>":"")+
      "<button class='btn btn-sm btn-alt' data-fr-spin='"+fr.id+"'>🎬 Spin-off film</button>"+
      (fr.tier>=2? "<button class='btn btn-sm btn-alt' data-fr-tv='"+fr.id+"'>📺 TV spin-off</button>":"")+
      "<button class='btn btn-sm btn-alt' data-fr-sell='"+fr.id+"'>🤝 Sell IP · top bid "+fmtM((franchiseOffers(fr)[0]||{}).value||0)+"</button>"+
      "<button class='btn btn-sm' data-fr-more='"+fr.id+"'>⋯ More moves</button>"+
      "</div></div>";
  }
  try{ h+=empireIpMarket(); }catch(e){}
  try{ h+=empireOnboarding(); }catch(e){}
  if(((G.licensedOut||[]).length)){
    h+="<div class='empire-sub'>📦 Brands licensed out</div><div class='empire-block'>";
    (G.licensedOut||[]).forEach(function(L){
      h+="<div class='empire-row'><span>"+(L.kind==="goods"?"🥤":"🎬")+" “"+esc(L.name)+"” → "+esc(L.rival)+"</span><b class='muted tiny'>settles "+dateLabel(L.due)+"</b></div>";
    });
    h+="</div>";
  }
  return empireShell(empirePanel("EMPIRE / FRANCHISES","Franchises","Every brand in the stable — sequels, merch, parks, game rights and top sale bids.",h,empireAsideFan()));
}
/* Per-film merchandising dashboard: demand/cost/revenue/profit/brand per line.
   Weak films lose money on the shelf — check demand before manufacturing. */
function merchBoard(){
  /* $40M WW threshold matches merchEligible() — weak films never reach the shelf board */
  const cands=(G.films||[]).filter(f=>!f.streamingOriginal&&(f.ww||0)>=40)
    .sort((a,b)=>(b.ww||0)-(a.ww||0)).slice(0,6);
  if(!cands.length) return "";
  let h="<div class='empire-sub'>🧸 Film merchandising</div>";
  cands.forEach(f=>{
    const done=f.merchLines||[];
    const tot=done.reduce((a,m)=>a+(m.profit||0),0);
    h+="<div class='empire-block'><div class='spread'><div><b>"+esc(f.title)+"</b> <span class='tiny muted'>"+fmtG(f.ww||0)+" WW"+(f.franchiseName?" · "+esc(f.franchiseName):"")+"</span></div>"+
      "<b class='"+(tot>=0?"pos":"neg")+"'>"+(tot>=0?"+":"")+fmtM(Math.round(tot*10)/10)+" shelf</b></div>";
    if(done.length) h+="<div class='tiny muted' style='margin:4px 0'>"+done.map(m=>{ const d=merchLineDefs().find(x=>x.id===m.id)||{icon:"📦",name:m.id}; return d.icon+" "+d.name+" ("+(m.profit>=0?"+":"")+fmtM(m.profit)+")"; }).join(" · ")+"</div>";
    if(!f.merchDone){
      h+="<div class='grid g3' style='margin-top:6px'>";
      merchLineDefs().forEach(d=>{
        if(done.some(m=>m.id===d.id)) return;
        let plan=null; try{ plan=merchPlan(f,d.id); }catch(e){}
        if(!plan) return;
        h+="<div class='empire-block empire-merchline'><b>"+d.icon+" "+d.name+"</b>"+
          "<div class='tiny muted'>"+d.desc+"</div>"+
          "<div class='empire-row'><span>Demand</span><b class='"+(plan.demand>=60?"pos":plan.demand<40?"neg":"")+"'>"+plan.demand+"</b></div>"+
          "<div class='empire-row'><span>Cost → revenue</span><b>"+fmtM(plan.cost)+" → "+fmtM(plan.revenue)+"</b></div>"+
          "<div class='empire-row'><span>Profit · brand</span><b class='"+(plan.profit>=0?"pos":"neg")+"'>"+(plan.profit>=0?"+":"")+fmtM(plan.profit)+" · +"+plan.brand+"</b></div>"+
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
function uniPicksArr(){
  /* staged franchise ids for the next universe weave — persisted on the save
     (G.empire.uniPicks) and pruned whenever a pick no longer qualifies */
  if(!G.empire) G.empire={subTab:"franchises",activeSub:"franchises"};
  if(!Array.isArray(G.empire.uniPicks)) G.empire.uniPicks=[];
  G.empire.uniPicks=G.empire.uniPicks.filter(id=>{ const fr=frById(id); return fr&&fr.tier>=2; });
  return G.empire.uniPicks;
}
function uniBoard(){
  const list=G.universes||[];
  const picks=uniPicksArr();
  let h="<div class='empire-sub'>🌌 Franchise universes (optional)</div>";
  if(!list.length) h+="<div class='empire-block empire-empty muted small'>No universes — franchises stand alone just fine. Weave 2+ tier-2 franchises ($80M) to link them: continuity rewards rested brands (±5% openings).</div>";
  list.forEach(u=>{
    let st;
    try{ st=uniStats(u); }catch(e){ return; }
    h+="<div class='empire-block empire-universe'><div class='spread'><div><b>🌌 "+esc(u.name)+"</b>"+
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
    const canGo=picks.length>=2 && G.studio.cash>=30;
    const pickedNames=picks.map(x=>{ const fr=frById(x); return fr?fr.name:""; }).filter(Boolean);
    h+="<div class='empire-block empire-weave'><b class='small'>Weave a universe — $80M</b><div class='tiny muted'>Optional. Does not merge brands (unlike the old merge move).</div>"+
      "<div class='row' style='margin-top:6px'>"+elig.map(f=>"<button class='btn btn-sm "+(picks.some(x=>String(x)===String(f.id))?"btn-primary":"btn-alt")+"' data-unipick='"+f.id+"'>"+esc(f.name)+"</button>").join("")+"</div>"+
      "<div class='tiny muted' style='margin-top:4px'>Picked: <b id='uniPicks'>"+(pickedNames.length?esc(pickedNames.join(" × ")):"—")+"</b></div>"+
      "<div class='row' style='margin-top:6px'><button class='btn btn-sm btn-primary' id='uniGo'"+(canGo?"":" disabled title='Pick 2+ tier-2 franchises · needs $30M cash'")+">🌌 Found universe"+(canGo?"":" (need 2+ picks · $30M)")+"</button></div></div>";
  }
  return h;
}
function endgameBoard(){
  let goals, inf;
  try{ goals=endgameGoals(); inf=endgameInfluence(); }catch(e){ return ""; }
  const done=goals.filter(g=>g.prog>=1).length;
  let h="<div class='empire-sub'>👑 Endgame — industry empire ("+done+"/6, optional)</div><div class='empire-block empire-endgame'>"+
    "<div class='spread'><div><b>Industry influence</b><div class='tiny muted'>"+inf.share+"% market share · "+inf.talent+"★ talent network · "+fmtM(Math.round(inf.intl))+" intl WW</div></div>"+
    "<b class='gold'>"+done+"/6</b></div>";
  goals.forEach(g=>{
    h+="<div class='spread' style='margin-top:4px'><span class='small'>"+g.icon+" "+g.name+" <span class='tiny muted'>"+g.label+"</span></span>"+
      "<b class='tiny "+(g.prog>=1?"pos":"")+"'>"+(g.prog>=1?"✓":Math.round(g.prog*100)+"%")+"</b></div>"+meter(g.prog,1);
  });
  if((G.endgame||{}).crowned) h+="<div class='tiny gold' style='margin-top:4px'>👑 CROWNED Entertainment Empire.</div>";
  return h+"</div>";
}
/* Franchise dashboard: read-only rollups from fr fields + entries. Value IS
   catalogValue's franchise valuation (franchiseValue in engine.js); fanbase
   estimated from entries + WW. */
function frValue(fr){ return franchiseValue(fr); }
function frFanbase(fr){
  const ww=fr.ww||0;
  if(ww>=2000) return "Global phenomenon";
  if(ww>=800) return "Massive following";
  if(ww>=300) return "Loyal fanbase";
  if((fr.entries||[]).length>=2) return "Growing cult";
  return "New spark";
}
/* newest→oldest resolver: a franchise's own film records can outlive the
   films list (sold/pruned), and purchased IPs start with no films at all */
function frResolvableFilm(fr){
  if(!fr) return null;
  const ents=(fr.entries||[]).slice().reverse();
  for(const e of ents){
    const f=(G.films||[]).find(x=>x.id===e.filmId || String(x.id)===String(e.filmId));
    if(f) return f;
  }
  return null;
}
function frSequel(fr){
  if(!frResolvableFilm(fr)) return "New IP — greenlight entry 1";
  const fat=fr.fatigue||0;
  if(fat>0.45) return "Rest it — fatigue "+Math.round(fat*100)+"%";
  if(frHeatPct(fr)<60) return "Cooling — heat "+frHeatPct(fr)+"%";
  if((fr.tier||0)>=4) return "Eventize it — saga tier";
  return "Ready — heat "+frHeatPct(fr)+"%";
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
  let h="<div class='fr-timeline' style='margin-top:8px'><div class='tl-header'><b>🕰 Timeline</b> <span class='tiny muted'>(fatigue "+Math.round((fr.fatigue||0)*100)+"% · heat "+frHeatPct(fr)+"%)</span></div>";
  if(!ents.length){
    h+="<div class='tl-empty'>No films yet — greenlight the first entry</div>";
  }else{
    h+="<div class='tl-track'>";
    ents.forEach((e,i)=>{
      const r=(typeof frResolveEntry==="function")?frResolveEntry(e):{title:e.title,ww:e.ww||0,week:e.week||1,opening:e.opening,critic:e.criticAvg,profit:e.profit};
      const smash=(r.ww||0)>=300?" <span class='tl-breakout'>BREAKOUT</span>":"";
      const yrs=typeof yearOf==="function"?yearOf(r.week||1):(Math.floor((r.week||1)/52)+1);
      const w=typeof woyOf==="function"?woyOf(r.week||1):((r.week||1)%52||52);
      const metaParts=["Year "+yrs+", W"+w, fmtG(r.ww||0)+" WW"];
      if(r.opening!=null) metaParts.push(fmtG(r.opening)+" open");
      if(r.critic!=null) metaParts.push(Math.round(r.critic)+"% critics");
      const profitHtml=r.profit!=null ? "<div class='tl-profit'>Profit: <span class='"+(r.profit>=0?"pos":"neg")+"'>"+(r.profit>=0?"+":"")+fmtM(r.profit)+"</span></div>" : "";
      h+="<div class='tl-node'><div class='tl-marker'></div>"+
        "<div class='tl-content'><div class='tl-title'>"+esc(r.title)+smash+"</div>"+
        "<div class='tl-meta'>"+metaParts.join(" · ")+"</div>"+
        profitHtml+"</div></div>";
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
function frMeter(l,v){ return "<div class='empire-meter'><div class='fm-v'>"+v+"</div><div class='fm-l'>"+l+"</div></div>"; }
function pips(n,max){ let s="<span class='pips'>"; for(let i=1;i<=max;i++) s+= i<=n? "●":"<span class='off'>●</span>"; return s+"</span>"; }

/* ═══════════ choice / report / gameover modals ═══════════ */
function choiceModal(){
  const c=G.pendingChoice; if(!c) return;
  const head='<div class="produce-modal-head"><span class="command-eyebrow">'+(c.icon? c.icon+" · " : "")+"STUDIO DECISION"+
      (c.kind? " / "+esc(String(c.kind).toUpperCase()) : "")+'</span>'+
    '<h3>'+esc(c.title)+'</h3>'+
    '<p>'+esc(c.text)+'</p></div>';
  const body='<div class="produce-modal-body"><div class="bo-choice-list">'+
    c.choices.map(ch=>'<button class="produce-ghost bo-choice" data-ch="'+ch.i+'"><b>'+esc(ch.label)+'</b>'+
      (ch.hint?'<small>'+esc(ch.hint)+'</small>':'')+'</button>').join("")+
  '</div></div>';
  const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+
      (c.choices.length>1? "Pick one — the room is watching." : "Only one way out.")+'</span></div>';
  const v=openModal(head+body+foot,{noX:true,locked:true,className:"command-produce-modal"});
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
  const mine=(r.awards&&r.awards.wins)?r.awards.wins.filter(w=>w.mine):[];
  const kpi=(label,value,note,tone)=>'<div class="bo-kpi'+(tone?" "+tone:"")+'"><small>'+label+'</small><b>'+value+'</b><span>'+note+'</span></div>';

  const head='<div class="produce-modal-head"><span class="command-eyebrow">YEAR IN REVIEW / '+esc(String(DATA.AWARDS||"AWARDS"))+'</span>'+
    '<h3>Year '+r.year+' — the ledger closes</h3>'+
    '<p>Twelve months of releases, market share and the ceremony that settles the argument.</p></div>';

  let body='<div class="produce-modal-body">';
  body+='<div class="bo-kpis">'+
    kpi("WORLDWIDE",fmtM(r.myWW),"all pictures this year")+
    kpi("RELEASES",String(r.filmsReleased),"pictures shipped")+
    kpi("FILM NET",(r.profit>=0?"+":"")+fmtM(r.profit),r.profit>=0?"above breakeven":"below breakeven",r.profit>=0?"good":"bad")+
    kpi("TROPHIES",String(mine.length),mine.length?"won "+mine.map(w=>w.cat).join(", "):"no wins this year",mine.length?"good":"")+
  '</div>';

  if(r.standings && r.standings.length){
    const maxWW=Math.max.apply(null,r.standings.map(x=>x.ww||0).concat([0.1]));
    const rows=r.standings.map((x,i)=>{
      const pct=Math.max(2,(x.ww||0)/maxWW*100);
      return '<div class="bo-track-row"><span class="bo-track-label">'+(x.me?"★ ":"")+esc(x.name)+'<small>#'+(i+1)+'</small></span>'+
        '<span class="bo-track'+(x.me?"":" teal")+'"><i style="width:'+pct.toFixed(1)+'%"></i></span>'+
        '<span class="bo-track-val">'+fmtM(x.ww||0)+'</span></div>';
    }).join("");
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>MARKET SHARE</b><span>year '+r.year+'</span></div><div class="bo-track-rows">'+rows+'</div>'+
      '<p class="bo-figure-cap">Gold bar is your studio. Share is measured on worldwide gross, not cash in hand.</p></div>';
  }

  const noms=(r.awards&&r.awards.noms)||[], wins=(r.awards&&r.awards.wins)||[];
  if(noms.length||wins.length){
    let rows="";
    wins.forEach(w=>{ rows+='<div class="bo-track-row"><span class="bo-track-label">🏆 '+esc(w.cat)+(w.mine?" <small>you</small>":"")+'</span><span class="bo-track-val">'+esc(w.film)+'</span></div>'; });
    noms.forEach(n=>{ rows+='<div class="bo-track-row"><span class="bo-track-label">'+esc(n.title)+(n.mine?' <small>you</small>':'<small>'+esc(n.studio||"")+'</small>')+'</span><span class="bo-track-val">nominee</span></div>'; });
    body+='<div class="produce-modal-card"><div class="bo-figure-head"><b>NOMINATIONS &amp; WINS</b><span>'+wins.length+' won · '+noms.length+' nominated</span></div><div class="bo-track-rows">'+rows+'</div></div>';
  } else {
    body+='<div class="produce-modal-card"><h4>No nominations</h4><p>Nothing on the slate caught the voters this year. Prestige pictures and award campaigns change that.</p></div>';
  }
  body+='</div>';

  const foot='<div class="produce-modal-actions"><span class="bo-rebrand-note">'+fmtM(r.myWW)+' worldwide · '+r.filmsReleased+' release'+(r.filmsReleased===1?"":"s")+' · '+(mine.length?mine.length+" win"+(mine.length===1?"":"s"):"no wins")+'</span>'+
    '<div class="row" style="margin:0;gap:8px"><button class="produce-action" id="reportGo">Roll credits → Year '+(r.year+1)+'</button></div></div>';

  const v=openModal(head+body+foot,{noX:true,className:"command-produce-modal"});
  const go=v.querySelector("#reportGo"); if(go) go.onclick=()=>closeModal();
  beep("drums");
  if(mine.length) confetti({count:200});
}
function documentaryRetrospective(o){
  const hits = o.stats.hits || 0;
  const flops = o.stats.flops || 0;
  const total = o.stats.totalWW || 0;
  const best = o.stats.bestFilm || "their debut picture";
  const yr = Math.max(1, Math.ceil(o.week / 52));
  let story = "“When "+esc(G.studio.name)+" first broke ground "+yr+" year"+(yr===1?"":"s")+" ago, the industry was already in flux. ";
  if(hits >= flops){
    story += "Against steep odds, the lot delivered smash after smash, anchored by the legendary run of ‘"+esc(best)+"’. ";
  } else {
    story += "Ambition frequently outpaced reality in executive suites, though courage was never lacking. ";
  }
  story += "Over "+o.week+" tumultuous weeks, the studio banked "+fmtM(total)+" in worldwide ticket sales, weathered franchise fatigue and piracy storms, and left an indelible footprint in the cinematic canon. Though the gates have closed, Hollywood will remember the name.”";
  return "<div class='card' style='background:linear-gradient(135deg,rgba(245,185,66,0.06),rgba(0,0,0,0.4));border-left:3px solid var(--gold);margin-top:8px'>"+
    "<b class='small gold'>📽️ Documentary Retrospective: The Legacy of "+esc(G.studio.name)+"</b>"+
    "<p class='small muted' style='margin-top:6px;font-style:italic;line-height:1.5'>"+story+"</p></div>";
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
    "</div></div>"+legacySummaryCard()+documentaryRetrospective(o)+
    "<div class='modal-actions'><button class='btn btn-alt' id='btnCopyLegacy'>📋 Copy Legacy Card</button><button class='btn btn-primary' id='goNew'>🎬 Found a new studio</button></div>";
  const v=openModal(h,{noX:true,locked:true});
  const cl=v.querySelector("#btnCopyLegacy");
  if(cl){
    cl.onclick=()=>{
      const text = "🎬 BOX OFFICE WAR — Legacy of "+G.studio.name+"\n"+
        "• Survived: "+o.week+" weeks ("+Math.ceil(o.week/52)+" yrs)\n"+
        "• Worldwide Box Office: "+fmtM(o.stats.totalWW)+"\n"+
        "• Films: "+o.stats.films+" ("+(o.stats.hits||0)+" hits, "+(o.stats.flops||0)+" flops)\n"+
        "• Biggest Hit: "+(o.stats.bestFilm||"None")+" ("+fmtG(o.stats.bestOpen||0)+" opening)\n"+
        "• Final Cash: "+fmtM(G.studio.cash)+" | Rep: "+Math.round(G.studio.rep)+"/100\n"+
        "#BoxOfficeWar";
      try{
        if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
        toast("Legacy summary copied to clipboard!","good");
      }catch(e){
        toast("Copy failed — check permissions.","bad");
      }
    };
  }
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
  const chapters=[['start','01','From script to screen','The production loop'],['people','02','People & partnerships','Build your creative team'],['money','03','The business of movies','Cash flow and distribution'],['growth','04','Build a lasting studio','Franchises, markets, and survival']];
  const topics=[
    ['start','Your first greenlight','Buy a script in Develop, attach a director and cast, then review the budget before greenlighting. Production spends cash weekly through pre-production, shooting, and post-production. A high budget is not a guarantee of a hit.'],
    ['start','Choose your opening weekend','Use the release calendar to compare seasons and rival films. Summer and holidays can help openings; competing tentpoles split the audience. Finished films need a release date and a marketing plan.'],
    ['start','Opening weekend versus long legs','Star power, marketing, season, and competition shape the opening. Quality and audience response help determine legs: how long the film keeps earning after its first weekend.'],
    ['people','Writers, directors, and producers','A writer improves the screenplay. A director shapes quality and genre fit. Producers manage overrun risk and production value. Film development shows the cost and trade-offs before you commit.'],
    ['people','Multi-picture partners','Picture Partners locks a per-film quote after an upfront signing bonus. Find signed talent at the top of casting in Develop, with a Studio partner badge. A greenlit film consumes one commitment per participating partner. Signing does not clear an active production booking.'],
    ['people','Energy and recovery','Workforce shows the full active roster, sorted by energy. Use the recovery filter to find tired people. A retreat costs $0.2M and restores energy. Review Leadership separately to appoint business executives and see their ongoing payroll.'],
    ['money','Understand your breakeven','Box office gross is not studio income: exhibitors keep part of ticket sales. A rough worldwide breakeven guide is budget plus marketing divided by 0.48. Actual rentals vary by territory and distribution terms.'],
    ['money','Distribution is a strategic choice','Choose a theatrical release, streaming original, own-streamer premiere when available, or decide later. Finished films can be shopped to streamers; offers trade box-office risk for a negotiated payout. Catalogue titles can earn from later windows.'],
    ['money','Watch cash every week','Production, overhead, interest, and marketing all draw from cash. Domestic rentals arrive during theatrical runs; international settlements and later windows have different timing. Review Finance before taking on another film.'],
    ['growth','Read the market','Industry Pulse shows the economic cycle and recent profit history. Genre trends change audience appetite. Strong reviews, a suitable release date, and a financially sustainable slate matter as much as star names.'],
    ['growth','Franchises need room to breathe','Successful films can become franchises with sequels, merchandise, games, and other opportunities. Repeated sequels can accumulate fatigue. Resting a brand and refreshing its stories can be wiser than rushing another release.'],
    ['growth','Meet the board’s mandate','Strategy tracks quarterly directives, progress, potential rewards, and confidence. Keep reserves for debt and overhead. Loans can bridge a gap, but interest and limited credit can turn one failed release into a crisis.']
  ];
  const h=`<section class="command-dialog field-guide"><header class="command-dialog-hero"><div><span class="command-eyebrow">THE STUDIO FIELD GUIDE / PRODUCER’S EDITION</span><h2>Great stories. Smarter decisions.</h2><p>A practical handbook for your first film—and the studio that follows.</p></div><span class="guide-edition">12 ESSENTIALS<br>ONE STUDIO</span></header><div class="guide-layout"><nav class="guide-nav" aria-label="Guide chapters"><button data-guide-chapter="all" class="active" aria-pressed="true"><small>INDEX</small><b>The whole picture</b></button>${chapters.map(([key,n,title,desc])=>`<button data-guide-chapter="${key}" aria-pressed="false"><small>CHAPTER ${n}</small><b>${title}</b><span>${desc}</span></button>`).join('')}<p>Tip: keep an eye on cash, not just worldwide gross.</p></nav><section class="guide-reading"><label class="guide-search-label" for="helpSearch">FIND AN ANSWER</label><input id="helpSearch" type="search" placeholder="Search casting, breakeven, recovery…"><div class="guide-results">${topics.map(([chapter,title,body],i)=>`<article class="guide-topic" data-guide-topic="${chapter}"><span class="guide-topic-number">${String(i+1).padStart(2,'0')}</span><div><small>${chapters.find(c=>c[0]===chapter)[2]}</small><h3>${title}</h3><p>${body}</p></div></article>`).join('')}</div><p class="guide-no-results" hidden>No matching topics. Try “cash”, “casting”, or “release”.</p></section></div><footer class="command-dialog-footer modal-actions"><span>Make your next decision with confidence.</span><button class="command-primary btn" onclick="closeModal()">Lights down, back to studio</button></footer></section>`;
  const view=openModal(h);
  view.querySelector('.modal').classList.add('command-modal');
  const dialog=view.querySelector('[role="dialog"]');dialog.setAttribute('aria-label','Studio Field Guide');dialog.removeAttribute('aria-labelledby');
  let chapter='all';
  function filter(){
    const query=view.querySelector('#helpSearch').value.trim().toLowerCase();let count=0;
    view.querySelectorAll('[data-guide-topic]').forEach(topic=>{topic.hidden=(chapter!=='all'&&topic.dataset.guideTopic!==chapter)||!topic.textContent.toLowerCase().includes(query);if(!topic.hidden)count++;});
    view.querySelector('.guide-no-results').hidden=count>0;
  }
  view.querySelector('#helpSearch').oninput=filter;
  view.querySelectorAll('[data-guide-chapter]').forEach(button=>button.onclick=()=>{
    chapter=button.dataset.guideChapter;
    view.querySelectorAll('[data-guide-chapter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});filter();
  });
}

/* ── v28: Custom Creator modal ── */
function customCreatorModal(){
  const pools = getCustomPools();
  let h="<h3>✨ Custom Creator</h3>"+
    "<div class='tiny muted' style='margin-bottom:12px'>Create custom studios, people, or franchises that integrate into the game world.</div>"+
    "<div class='card' style='margin-bottom:8px'><div class='spread'><b>🏛 Studio</b></div>"+
      "<input type='text' id='ccStudioName' placeholder='Studio name (e.g. Silver Screen Pictures)' style='width:100%;margin-bottom:6px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text)'>"+
      "<textarea id='ccStudioDesc' placeholder='Description (optional)' style='width:100%;margin-bottom:8px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text);min-height:60px'></textarea>"+
      "<button class='btn btn-primary' onclick='createCustomStudioFromModal()'>Create Studio</button></div>"+
    "<div class='card' style='margin-bottom:8px'><div class='spread'><b>👤 Person</b></div>"+
      "<input type='text' id='ccPersonName' placeholder='Name (e.g. Jordan Lee)' style='width:100%;margin-bottom:6px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text)'>"+
      "<select id='ccPersonKind' style='width:100%;margin-bottom:6px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text)'>"+
        "<option value='actor'>Actor</option>"+
        "<option value='director'>Director</option>"+
        "<option value='writer'>Writer</option>"+
        "<option value='producer'>Producer</option>"+
      "</select>"+
      "<textarea id='ccPersonDesc' placeholder='Bio/notes (optional)' style='width:100%;margin-bottom:8px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text);min-height:60px'></textarea>"+
      "<button class='btn btn-primary' onclick='createCustomPersonFromModal()'>Create Person</button></div>"+
    "<div class='card'><div class='spread'><b>🌍 Franchise</b></div>"+
      "<input type='text' id='ccFranchiseName' placeholder='Franchise name (e.g. The Shadowverse)' style='width:100%;margin-bottom:6px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text)'>"+
      "<select id='ccFranchiseGenre' style='width:100%;margin-bottom:6px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text)'>"+
        Object.keys(DATA.GENRES).map(g=>"<option value='"+g+"'>"+DATA.GENRES[g].emoji+" "+DATA.GENRES[g].name+"</option>").join("")+
      "</select>"+
      "<textarea id='ccFranchiseDesc' placeholder='Lore/description (optional)' style='width:100%;margin-bottom:8px;padding:10px;border-radius:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text);min-height:60px'></textarea>"+
      "<button class='btn btn-primary' onclick='createCustomFranchiseFromModal()'>Create Franchise</button></div>"+
    "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";
  
  const v=openModal(h);
  v.querySelector("#ccStudioName")?.focus();
}
function createCustomStudioFromModal(){
  const name = document.getElementById("ccStudioName")?.value?.trim();
  const desc = document.getElementById("ccStudioDesc")?.value?.trim() || "";
  if(!name){ toast("Enter a studio name","bad"); return; }
  createCustomStudio(name, desc);
  toast("🏛 Studio created: "+name,"gold");
  closeModal(); customCreatorModal();
}
function createCustomPersonFromModal(){
  const name = document.getElementById("ccPersonName")?.value?.trim();
  const kind = document.getElementById("ccPersonKind")?.value || "actor";
  const desc = document.getElementById("ccPersonDesc")?.value?.trim() || "";
  if(!name){ toast("Enter a name","bad"); return; }
  createCustomPerson(name, kind, desc);
  toast("👤 Person created: "+name+" ("+kind+")","gold");
  closeModal(); customCreatorModal();
}
function createCustomFranchiseFromModal(){
  const name = document.getElementById("ccFranchiseName")?.value?.trim();
  const genre = document.getElementById("ccFranchiseGenre")?.value || "action";
  const desc = document.getElementById("ccFranchiseDesc")?.value?.trim() || "";
  if(!name){ toast("Enter a franchise name","bad"); return; }
  createCustomFranchise(name, genre, desc);
  toast("🌍 Franchise created: "+name,"gold");
  closeModal(); customCreatorModal();
}

/* v28: Prototype RPG debug panel (Ctrl+Shift+P) — visible when G.prototype is true */
function prototypeDebugModal(){
  if(!G.prototype){ toast("Prototype mode not enabled (start with sandbox option)","bad"); return; }
  const xpCurve = DATA.PROTOTYPE_XP_CURVE;
  const baseXp = DATA.PROTOTYPE_BASE_XP;
  const lifeWeights = (DATA.PROTOTYPE_LIFE_EVENTS||[]).map(e=>e.weight);
  const lifeTotal = lifeWeights.reduce((a,b)=>a+b,0);

  let h="<h3>🧪 Prototype Debug Panel</h3>"+
    "<div class='tiny muted' style='margin-bottom:8px'>Live tuning — changes apply immediately to the running prototype.</div>";

  // XP Curve
  h+="<div class='card'><div class='spread'><b>📈 XP Curve</b></div>"+
    "<div class='cost-line'><span>Base XP (L1→L2)</span><b>"+baseXp+"</b></div>"+
    "<div class='slider-row'><span class='small muted' style='min-width:120px'>Curve exponent</span>"+
      "<input type='range' id='dbgXpCurve' min='1.0' max='1.5' step='0.01' value='"+xpCurve+"'>"+
      "<span class='slider-val' id='dbgXpCurveV'>"+xpCurve+"</span></div>"+
    "<div class='tiny muted'>XP to next = Base × level^exponent. Lower = faster leveling.</div></div>";

  // Life event weights
  h+="<div class='card' style='margin-top:8px'><div class='spread'><b>🎭 Life Event Weights</b></div>"+
    (DATA.PROTOTYPE_LIFE_EVENTS||[]).map((e,i)=>
      "<div class='slider-row'><span class='small muted' style='min-width:120px'>"+e.icon+" "+e.desc+"</span>"+
        "<input type='range' class='dbgLifeWeight' data-idx='"+i+"' min='0' max='100' step='1' value='"+e.weight+"'>"+
        "<span class='slider-val'>"+e.weight+"</span>"+
        "<span class='tiny muted'> ~"+Math.round(e.weight/lifeTotal*100)+"%</span></div>"
    ).join("")+"</div>";

  // Equipment scaling
  h+="<div class='card' style='margin-top:8px'><div class='spread'><b>🎒 Equipment Quality Multiplier</b></div>"+
    "weapon,armor,accessory,prop".split(",").map(slot=>
      "<div class='slider-row'><span class='small muted' style='min-width:120px'>"+slot+"</span>"+
        "<input type='range' class='dbgEquipMult' data-slot='"+slot+"' min='0.5' max='3.0' step='0.1' value='1.0'>"+
        "<span class='slider-val'>1.0×</span></div>"
    ).join("")+"</div>";

  // Quick actions
  h+="<div class='card' style='margin-top:8px'><div class='spread'><b>⚡ Quick Actions</b></div>"+
    "<div class='row' style='gap:6px;flex-wrap:wrap'>"+
      "<button class='btn btn-sm btn-primary' id='dbgGiveXp'>Give selected talent +500 XP</button>"+
      "<button class='btn btn-sm btn-alt' id='dbgTriggerEvent'>Force life event on all</button>"+
      "<button class='btn btn-sm btn-alt' id='dbgUnlockAll'>Unlock all skill nodes</button>"+
      "<button class='btn btn-sm btn-alt' id='dbgMaxEquip'>Equip best gear on all</button>"+
    "</div></div>";

  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";

  const v=openModal(h);

  // XP curve slider
  const xpS=v.querySelector("#dbgXpCurve");
  const xpV=v.querySelector("#dbgXpCurveV");
  if(xpS && xpV){
    xpS.oninput=()=>{ DATA.PROTOTYPE_XP_CURVE=parseFloat(xpS.value); xpV.textContent=xpS.value; };
    xpS.onchange=()=>{ toast("XP curve set to "+DATA.PROTOTYPE_XP_CURVE); };
  }

  // Life event weight sliders
  v.querySelectorAll(".dbgLifeWeight").forEach(s=>{
    s.oninput=()=>{
      const idx=+s.dataset.idx;
      DATA.PROTOTYPE_LIFE_EVENTS[idx].weight=+s.value;
      s.nextElementSibling.textContent=s.value;
      s.nextElementSibling.nextElementSibling.textContent="~"+Math.round(s.value/lifeTotal*100)+"%";
    };
  });

  // Equipment multipliers
  v.querySelectorAll(".dbgEquipMult").forEach(s=>{
    s.oninput=()=>{ s.nextElementSibling.textContent=s.value+"×"; };
    s.onchange=()=>{
      const slot=s.dataset.slot;
      const mult=+s.value;
      (DATA.PROTOTYPE_EQUIPMENT[slot]||[]).forEach(item=>{
        item.quality=Math.round(item.quality*mult);
        item.scandalReduction=Math.round((item.scandalReduction||0)*mult);
        item.xpRate=Math.round((item.xpRate||0)*mult);
        ["cha","int","cre","dis","luk"].forEach(k=>{ item[k]=Math.round((item[k]||0)*mult); });
      });
      toast(slot+" equipment scaled by "+mult+"×");
    };
  });

  // Quick action buttons
  const give=v.querySelector("#dbgGiveXp");
  if(give) give.onclick=()=>{
    const sel = document.querySelector(".talent-card.sel-card");
    if(sel && sel.dataset.talentId){
      const t = G.talent.find(x=>x.id==+sel.dataset.talentId);
      if(t){ gainXP(t.id, 500, "debug"); toast("Gave +500 XP to "+t.name,"gold"); }
    } else toast("Select a talent card first","bad");
  };

  const trigger=v.querySelector("#dbgTriggerEvent");
  if(trigger) trigger.onclick=()=>{
    (G.talent||[]).forEach(t=>triggerLifeEvent(t.id));
    toast("Forced life events on all talents","gold");
  };

  const unlock=v.querySelector("#dbgUnlockAll");
  if(unlock) unlock.onclick=()=>{
    (G.talent||[]).forEach(t=>{
      if(t.prototype){
        ["star","method","magnet","visual","whisperer","tech","craft","voice","bankable","dealmaking","logistics","money"]
          .flatMap(b=> (DATA.PROTOTYPE_SKILL_TREES[t.kind]||{}).branches? (DATA.PROTOTYPE_SKILL_TREES[t.kind].branches.find(x=>x.id===b)||{nodes:[]}).nodes : [])
          .forEach(n=>{ if(n && !t.prototype.skillTree.nodes.includes(n.id)) t.prototype.skillTree.nodes.push(n.id); });
        t.prototype.skillPoints = 99;
      }
    });
    toast("All skill nodes unlocked + 99 skill points","gold");
    render();
  };

  const maxEq=v.querySelector("#dbgMaxEquip");
  if(maxEq) maxEq.onclick=()=>{
    (G.talent||[]).forEach(t=>{
      if(t.prototype){
        ["weapon","armor","accessory","prop"].forEach(slot=>{
          const items = DATA.PROTOTYPE_EQUIPMENT[slot]||[];
          if(items.length) equipItem(t.id, slot, items[items.length-1].id);
        });
      }
    });
    toast("Best equipment equipped on all","gold");
    render();
  };
}

/* v2/v3 additions */

function achievementsModal(){
  const count = DATA.ACH.filter(a=>G.ach[a.id]).length;
  const h = `<section class="command-dialog trophy-room"><header class="command-dialog-hero"><div><span class="command-eyebrow">STUDIO HQ / 07 / MILESTONES</span><h2>Trophy Room</h2><p>Every first. Every breakthrough. Your studio’s story, earned.</p></div><div class="trophy-total"><strong>${count}<small> / ${DATA.ACH.length}</small></strong><span>MILESTONES UNLOCKED</span></div></header><div class="trophy-progress" role="progressbar" aria-label="Achievements unlocked" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${DATA.ACH.length}"><span style="width:${count/DATA.ACH.length*100}%"></span></div><nav class="trophy-filters" aria-label="Milestone collection"><button data-trophy-filter="all" class="active" aria-pressed="true">The collection</button><button data-trophy-filter="earned" aria-pressed="false">Earned · ${count}</button><button data-trophy-filter="locked" aria-pressed="false">Next ambitions · ${DATA.ACH.length-count}</button></nav><div class="trophy-gallery">${DATA.ACH.map((a,i)=>{const got=!!G.ach[a.id];return `<article class="trophy-plaque ${got?'earned':'locked'}" data-earned="${got}"><div class="trophy-plaque-top"><span>NO. ${String(i+1).padStart(2,'0')}</span><small>${got?'EARNED':'NOT YET EARNED'}</small></div><div class="trophy-emblem" aria-hidden="true">${a.icon}</div><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p><footer>${got?'Unlocked · '+esc(dateLabel(G.ach[a.id])):'Your next chapter awaits'}</footer></article>`}).join('')}</div><p class="trophy-no-results" hidden>No milestones in this collection yet. Your next film could change that.</p><footer class="command-dialog-footer modal-actions"><span>Built through play. Preserved with your career.</span><button class="command-primary btn" onclick="closeModal()">Return to studio</button></footer></section>`;
  const veil = openModal(h);
  veil.querySelector('.modal').classList.add('command-modal');
  veil.querySelector('[role="dialog"]').setAttribute('aria-label','Trophy Room');
  veil.querySelectorAll('[data-trophy-filter]').forEach(button=>button.onclick=()=>{
    const filter=button.dataset.trophyFilter;
    veil.querySelectorAll('[data-trophy-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button?'true':'false');});
    let visible=0;
    veil.querySelectorAll('[data-earned]').forEach(card=>{card.hidden=filter!=='all' && (filter==='earned')!==(card.dataset.earned==='true');if(!card.hidden)visible++;});
    veil.querySelector('.trophy-no-results').hidden=visible>0;
  });
}

function buildStartOptions(){
  const wrap=$("#startOptions"); if(!wrap) return;
  let h="<label class='field-label' id='fieldScenario'>"+t("start.scenario")+"</label><div class='scen-row'>";
  Object.keys(DATA.SCENARIOS).forEach(id=>{
    const s=DATA.SCENARIOS[id];
    const sp = G?.scenarioProgress?.[id] || {};
    const won = sp.won ? " [Cleared]" : "";
    const bestRep = sp.bestRep ? " (best rep: "+sp.bestRep+")" : "";
    const cleanScenName = s.name;
    h+="<div class='scen"+(SEL.scenario===id?" sel":"")+"' data-scen='"+id+"'><h4>"+cleanScenName+won+"</h4><div class='a-sub'>"+s.desc+bestRep+"</div></div>";
  });
  h+="</div>";

  h+="<label class='field-label' id='fieldDifficulty'>"+t("start.difficulty")+"</label><div class='start-diff-row'>";
  Object.keys(DATA.DIFFICULTIES).forEach(id=>{
    const d=DATA.DIFFICULTIES[id];
    h+="<button type='button' class='btn btn-sm diff-btn"+(SEL.difficulty===id?" btn-primary sel":"")+"' data-diff='"+id+"' title='"+d.desc+"'>"+
      "<span class='diff-name'>"+d.name+"</span>"+
      "<span class='diff-sub'>"+(id==='easy'?'Rentals +12%':id==='hard'?'Rentals -12%':'Standard Market')+"</span>"+
      "</button>";
  });
  h+="</div>";

  h+="<div class='start-sandbox-wrap'><label class='sandbox-lbl'><input type='checkbox' id='chkSandbox'"+(SEL.sandbox?" checked":"")+"> Creative Sandbox Mode (Infinite Cash, No Bankruptcy, Instant Experimentation)</label></div>";

  h+="<label class='field-label'>"+t("start.slot")+"</label><div class='start-slot-grid' id='slotRow'>";
  for(let n=1;n<=3;n++){
    const m=slotMeta(n);
    const isSel = (SEL.slot === n);
    h+="<div class='start-slot-card"+(isSel?" sel":"")+"' data-slot='"+n+"' role='button' tabindex='0'>"+
      "<div class='slot-header'>"+
        "<span class='slot-num'>Slot "+n+"</span>"+
        "<span class='slot-status-pill "+(m?"occupied":"empty")+"'>"+(m?"Active Studio":"Empty Lot")+"</span>"+
      "</div>";
    if(m){
      h+="<div class='slot-studio-name'>"+esc(m.name)+"</div>"+
        "<div class='slot-meta-row'>"+
          "<span class='slot-date'>"+dateLabel(m.week)+"</span>"+
          "<span class='slot-cash'>"+fmtM(m.cash)+"</span>"+
          "<span class='slot-rep'>Rep "+m.rep+"</span>"+
        "</div>";
    } else {
      h+="<div class='slot-empty-title'>Empty Lot</div>"+
        "<div class='slot-empty-sub'>Ready for launch</div>";
    }
    h+="</div>";
  }
  h+="</div>";

  try{
    const hall=(typeof legacyHall==="function")?legacyHall():[];
    if(hall.length){
      h+="<label class='field-label'>Heirloom (Optional Legacy Bonus)</label><div class='row'>";
      h+="<button type='button' class='btn btn-sm "+(SEL.legacy===""?"btn-primary":"")+"' data-leg=''>Fresh start</button>";
      hall.slice(0,4).forEach((e,i)=>{
        h+="<button type='button' class='btn btn-sm "+(SEL.legacy==String(i)?"btn-primary":"")+"' data-leg='"+i+"' title='"+esc(e.grade)+" · "+fmtM(e.revenue)+" WW · "+e.films+" films'>Heir: "+esc(e.studio)+"</button>";
      });
      h+="</div><div class='tiny muted'>Heir of a hall studio: +$25M, +3 rep. Optional — normal play is untouched.</div>";
    }
  }catch(e){}
  wrap.innerHTML=h;
  $$("[data-scen]").forEach(el=>el.onclick=()=>{ SEL.scenario=el.dataset.scen; beep("click"); buildStartOptions(); });
  $$("[data-diff]").forEach(el=>el.onclick=()=>{ SEL.difficulty=el.dataset.diff; beep("click"); buildStartOptions(); });
  const chk=$("#chkSandbox"); if(chk) chk.onchange=()=>{ SEL.sandbox=chk.checked; };
  $$("[data-slot]").forEach(el=>{
    el.onclick=()=>{ SEL.slot=+el.dataset.slot; beep("click"); buildStartOptions(); };
    el.onkeydown=(e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); el.click(); } };
  });
  $$("[data-leg]").forEach(el=>el.onclick=()=>{ SEL.legacy=el.dataset.leg; beep("click"); buildStartOptions(); });
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

function changelogModal(){
  let h="<h3>📜 Box Office War — Complete Update Changelog (v20)</h3>"+
    "<div class='card' style='max-height:420px;overflow-y:auto;font-size:13px;line-height:1.5'>"+
    "<p><b>🎪 Festivals & Premieres:</b> Snowfall, Azure, Laguna, Telluride with specialized judging, buzz boosts, and festival premiere strategies.</p>"+
    "<p><b>📊 Market & Trends:</b> 52-week corridor heatmap, genre cycle badges, mean-reversion next quarter forecasts, and market timing indicators.</p>"+
    "<p><b>🏢 Studio Identity:</b> 52-week reputation sparkline, Studio DNA card, Level progression system (Indie to Empire), and executive approval tracking.</p>"+
    "<p><b>🎬 Production Intelligence:</b> Real-time quality & opening weekend predictors, best shoot location suggestions, Metacritic 3-color review distributions, and BTL crew allocations.</p>"+
    "<p><b>🌟 Talent Depth:</b> 6-quarter star power trajectories, toxic cast risk meters, comeback arc funding, and guest cameos.</p>"+
    "<p><b>🏰 Empire & Franchises:</b> Brand reboot deals, merch tier badges, theme park capacity, World Tours, and multi-platform game studio porting.</p>"+
    "<p><b>🛡️ Security & Guilds:</b> Active Anti-Piracy task force deployments, lot counter-intelligence against rogue leaks, and trade tariff indicators.</p>"+
    "<p><b>💼 Finance & Tools:</b> Interactive fan mail replies, week-to-week P&L comparisons, debt maturity schedules, CSV ledger exports, and save slot repair.</p>"+
    "</div>"+
    "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Back</button></div>";
  openModal(h);
}

let SETTINGS_PANEL='experience';
function settingsWorkspaceHTML(markup){
  const source=document.createElement('div');source.innerHTML=markup;
  const groups={experience:[],audio:[],access:[],career:[],saves:[],device:[]};
  const labels={experience:['Your experience','Language, currency, and visual identity.'],audio:['Sound & feedback','Tune the atmosphere and tactile feedback.'],access:['Comfort & accessibility','Make the studio feel right for you.'],career:['Career controls','Your studio identity and gameplay preferences.'],saves:['Save vault','Back up, restore, and manage your careers.'],device:['Device & privacy','Installation, local storage, and data controls.']};
  let footer='';
  Array.from(source.children).forEach(node=>{
    if(node.tagName==='H3')return;
    if(node.classList.contains('modal-actions')){footer=node.outerHTML;return;}
    const has=q=>!!node.querySelector(q);
    let group='device';
    if(has('#langEn,[data-curr],[data-theme]'))group='experience';
    else if(has('#sndTestClick,[data-hap]'))group='audio';
    else if(has('#fontMinus,[data-motion],[data-cb]'))group='access';
    else if(has('#stName,[data-wksum],#btnUnlockAllCastSettings'))group='career';
    else if(has('#saveCode,#saveNameInput'))group='saves';
    node.querySelectorAll('.card').forEach(el=>el.classList.replace('card','preference-block'));
    if(node.classList.contains('card'))node.classList.replace('card','preference-block');
    node.removeAttribute('style');
    // Remove legacy decorative emoji from settings labels, not control IDs/values.
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())walker.currentNode.textContent=walker.currentNode.textContent.replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu,'');
    groups[group].push(node.outerHTML);
  });
  return `<section class="command-dialog preferences-workspace"><header class="command-dialog-hero"><div><span class="command-eyebrow">STUDIO SYSTEMS / PERSONALISE YOUR PLAY</span><h2>Settings</h2><p>Your studio. Your pace. Your preferences.</p></div><span class="preferences-device">ON THIS DEVICE<br>LOCAL PREFERENCES</span></header><div class="preferences-layout"><nav class="preferences-nav" aria-label="Settings categories">${Object.entries(labels).map(([key,[title]],i)=>`<button data-pref-panel="${key}" class="${SETTINGS_PANEL===key?'active':''}" aria-pressed="${SETTINGS_PANEL===key}"><small>0${i+1}</small><span>${title}</span></button>`).join('')}<p>Your career stays intact when you change preferences.</p></nav><div class="preferences-content">${Object.entries(labels).map(([key,[title,desc]])=>`<section class="preferences-panel" data-pref-content="${key}" ${SETTINGS_PANEL===key?'':'hidden'}><header><span class="command-eyebrow">PREFERENCES / ${key.toUpperCase()}</span><h3>${title}</h3><p>${desc}</p></header>${groups[key].join('')}</section>`).join('')}</div></div><footer class="preferences-footer">${footer}</footer></section>`;
}
function wireSettingsWorkspace(view){
  view.querySelector('.modal').classList.add('command-modal');
  const dialog=view.querySelector('[role="dialog"]');dialog.setAttribute('aria-label','Settings');dialog.removeAttribute('aria-labelledby');
  view.querySelectorAll('[data-pref-panel]').forEach(button=>button.onclick=()=>{
    SETTINGS_PANEL=button.dataset.prefPanel;
    view.querySelectorAll('[data-pref-panel]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
    view.querySelectorAll('[data-pref-content]').forEach(panel=>panel.hidden=panel.dataset.prefContent!==SETTINGS_PANEL);
  });
}

function settingsModal(){
  let h="<h3>"+t("set.title")+"</h3>";
  h+="<div class='card'><div class='spread'><b>"+t("set.lang")+"</b><div class='row'>"+
    "<button class='btn btn-sm "+(LANG==="en"?"btn-primary":"")+"' id='langEn'>English</button>"+
    "<button class='btn btn-sm "+(LANG==="hi"?"btn-primary":"")+"' id='langHi'>हिन्दी</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Menus & chrome translate fully; long news copy stays in English.</div></div>";
  /* Currency formatting */
  const curCode = (typeof getActiveCurrencyCode==="function") ? getActiveCurrencyCode() : "USD";
  h+="<div class='card'><div class='spread'><b>Currency display</b><div class='row' style='gap:4px;flex-wrap:wrap'>"+
    ["USD","EUR","GBP","INR","JPY","CAD","AUD"].map(c=>"<button class='btn btn-sm "+(curCode===c?"btn-primary":"btn-alt")+"' data-curr='"+c+"'>"+c+"</button>").join("")+
    "</div></div><div class='tiny muted' style='margin-top:4px'>Formats box office, budgets, and ledgers in your selected currency (e.g. INR Crores, JPY Oku, EUR, GBP).</div></div>";
  h+="<div class='card'><div class='spread'><b>"+t("set.font")+"</b><div class='row'>"+
    "<button class='btn btn-sm' id='fontMinus'>A−</button><button class='btn btn-sm' id='fontReset'>A</button><button class='btn btn-sm' id='fontPlus'>A+</button></div></div>"+
    "<div class='tiny muted' id='fontSample' style='margin-top:6px;font-style:italic'>“The opening weekend numbers just rolled in — Hollywood never sleeps.”</div></div>";
  /* sound test panel & 10m mute & procedural soundtrack */
  const stEnabled = (typeof BOW_SOUNDTRACK!=="undefined" && BOW_SOUNDTRACK.enabled);
  h+="<div class='card'><div class='spread'><b>Sound &amp; Procedural Soundtrack</b><div class='row' style='gap:4px;flex-wrap:wrap'>"+
    "<button class='btn btn-sm btn-alt' id='sndTestClick'>Click</button>"+
    "<button class='btn btn-sm btn-alt' id='sndTestGold'>Gold</button>"+
    "<button class='btn btn-sm btn-alt' id='sndTestFanfare'>Fanfare</button>"+
    "<button class='btn btn-sm "+(stEnabled?"btn-primary":"btn-alt")+"' id='sndMusicToggle'>"+(stEnabled?"Music ON":"Music OFF")+"</button>"+
    "<button class='btn btn-sm "+(Date.now()<MUTE_UNTIL?"btn-primary":"btn-alt")+"' id='sndMuteToggle'>"+(Date.now()<MUTE_UNTIL?"Muted (10m)":"Mute 10m")+"</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Synthesized mood soundscapes adapt in real time to studio fortunes. Zero audio files required.</div></div>";
  /* v19: theme picker — five FeralUI-designed themes */
  h+="<div class='card'><div class='spread'><b>🎨 Theme</b><div class='row'>"+
    THEMES.map(th=>"<button class='btn btn-sm theme-swatch"+(THEME===th.id?" btn-primary":"")+"' data-theme='"+th.id+"'>"+
      "<span class='theme-dot' style='background:"+th.a+"'></span><span class='theme-dot' style='background:"+th.b+"'></span>"+th.name+"</button>").join("")+"</div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Five looks designed in the FeralUI gradient studio — the accent, panels, glows and buttons all follow. Your pick is remembered per device.</div></div>";
  /* v5: accessibility / feel */
  h+="<div class='card'><div class='spread'><b>🎞 Animations</b><div class='row'>"+
    ["auto","on","off"].map(m=>"<button class='btn btn-sm "+((MOTION||"auto")===m?"btn-primary":"")+"' data-motion='"+m+"'>"+({auto:"Auto",on:"On",off:"Off"})[m]+"</button>").join("")+
    "<button class='btn btn-sm btn-alt' id='btnTestMotion'>✨ Test</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>“Auto” follows your OS reduced-motion setting; confetti and slide-ins pause when motion is off.</div></div>";
  /* v31: color-blind cues (glyphs, not just hue) + PWA install */
  h+="<div class='card'><div class='spread'><b>🎨 Color-blind cues</b><div class='row'>"+
    "<button class='btn btn-sm "+(CB_CUES?"btn-primary":"")+"' data-cb='1'>On</button>"+
    "<button class='btn btn-sm "+(!CB_CUES?"btn-primary":"")+"' data-cb='0'>Off</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Adds ✓ ✕ ◆ ▲ ▼ glyphs to green / red / gold tags and ▲▼ to gains and losses, so colour is never the only signal. On by default.</div></div>";
  try{ h+=pwaInstallCardHTML(); }catch(e){}
  /* v27: privacy & data (GDPR-style controls — everything is local) */
  h+="<div class='card'><div class='spread'><b>🔒 Privacy &amp; your data</b><button class='btn btn-sm btn-alt' id='btnPrivacy'>Manage</button></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Box Office War stores everything on this device only — no accounts, no trackers, no analytics. Export or delete your data anytime.</div></div>";
  h+="<div class='card'><div class='spread'><b>📳 Haptics</b><div class='row'>"+
    "<button class='btn btn-sm "+(HAPTICS?"btn-primary":"")+"' data-hap='1'>On</button>"+
    "<button class='btn btn-sm "+(!HAPTICS?"btn-primary":"")+"' data-hap='0'>Off</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Rumbles on phone events — a hit lands different from a flop.</div></div>";
  /* v8: week summary popup preference */
  h+="<div class='card'><div class='spread'><b>📅 Weekly report popup</b><div class='row'>"+
    "<button class='btn btn-sm "+(localStorage.getItem("bow_wksum")!=="0"?"btn-primary":"")+"' data-wksum='1'>On</button>"+
    "<button class='btn btn-sm "+(localStorage.getItem("bow_wksum")==="0"?"btn-primary":"")+"' data-wksum='0'>Off</button></div></div>"+
    "<div class='tiny muted' style='margin-top:4px'>After every “Next Week”, a report pops: cash delta, openings, trade news — with jump-straight-to-a-tab buttons.</div></div>";
  /* v8: studio rename */
  h+="<div class='card'><div class='spread'><b>🏛 Studio name</b></div>"+
    "<div class='row' style='margin-top:8px'><input id='stName' type='text' maxlength='26' value='"+esc(G.studio.name)+"' style='flex:1;min-width:0;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:10px;padding:9px 11px;font-size:14px'>"+
    "<button class='btn btn-sm btn-alt' id='stNameSave'>Save</button></div></div>";
  h+="<div class='card'><div class='spread'><b>"+t("set.saves")+"</b></div>"+
    "<div class='row' style='margin-top:8px'><button class='btn btn-sm btn-alt' id='btnExport'>"+t("set.export")+"</button>"+
    "<button class='btn btn-sm btn-alt' id='btnImport'>"+t("set.import")+"</button></div>"+
    "<textarea id='saveCode' rows='3' placeholder='paste an import code here…' style='width:100%;margin-top:8px;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:10px;padding:8px;font-size:11px'></textarea>"+
    "<div class='row' style='margin-top:8px'><span class='small muted'>"+t("set.slot")+":</span>"+
    [1,2,3].map(n=>{
      const meta = slotMeta(n);
      const label = meta ? meta.name : ("Slot "+n);
      return "<div class='row' style='margin:4px 0;align-items:center;gap:6px'>"+
        "<button class='btn btn-sm "+((G.slot||1)===n?"btn-primary":"")+"' data-saveslot='"+n+"' style='min-width:70px'>Slot "+n+"</button>"+
        "<input type='text' value='"+esc(label)+"' data-slotname='"+n+"' placeholder='rename…' style='flex:1;max-width:160px;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:4px 8px;font-size:11px'>"+
        "<button class='btn btn-xs btn-ghost' data-delslot='"+n+"' title='Wipe slot "+n+"'>🗑️</button>"+
      "</div>";
    }).join("")+"</div>"+
    "<div class='section-title' style='margin-top:12px'>Named careers &amp; device backups</div>"+
    "<div class='card' style='margin-top:4px'>"+
      "<div class='row' style='gap:6px;margin-bottom:8px'>"+
        "<input id='saveNameInput' type='text' placeholder='Save name (e.g. my-career)' style='flex:1;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px'>"+
        "<button class='btn btn-sm btn-primary' id='btnSaveNamed'>☁️ Save Named</button>"+
      "</div>"+
      "<div id='namedSlotsList' style='margin-top:8px'></div>"+
      "<div class='row' style='margin-top:8px;gap:6px'>"+
        "<button class='btn btn-sm btn-alt' id='btnSyncIDB'>Back up on device</button>"+
        "<button class='btn btn-sm btn-alt' id='btnListIDB'>List device backups</button>"+
      "</div>"+
    "</div>"+
    "<div class='row' style='margin-top:10px;gap:6px;flex-wrap:wrap'>"+
      "<button class='btn btn-sm btn-alt' id='btnRepairSlots'>🔧 Repair Save Slots</button>"+
      "<button class='btn btn-sm btn-alt' id='btnAboutChangelog'>📜 Changelog</button>"+
      "<button class='btn btn-sm btn-ghost' id='btnResetSettings'>⚠️ Reset Settings</button>"+
    "</div></div>";
  /* Cast & Talent Unlocks */
  h+="<div class='card'><div class='spread'><b>Cast &amp; Talent Unlocks</b>"+
    "<button class='btn btn-sm btn-primary' id='btnUnlockAllCastSettings' style='background:#f5c518;color:#0f172a;font-weight:bold'>Unlock All Cast</button></div>"+
    "<div class='tiny muted' style='margin-top:4px'>Unlocks all 72 animal star species (Box Office Sim 2) and all 5-star superstar actors, directors, writers, and producers. Clears all booking locks.</div></div>";
  h+="<div class='modal-actions'><button class='btn btn-ghost' id='btnToMenu'>"+t("set.menu")+"</button>"+
    "<button class='btn btn-primary' onclick='closeModal()'>"+t("btn.close")+"</button></div>";
  const v=openModal(settingsWorkspaceHTML(h));
  wireSettingsWorkspace(v);
  const btnUac=v.querySelector("#btnUnlockAllCastSettings");
  if(btnUac) btnUac.onclick=()=>{ if(typeof unlockAllCast==="function") unlockAllCast(); beep("gold"); closeModal(); if(typeof render==="function") render(); };
  v.querySelector("#langEn").onclick=()=>{ setLang("en"); beep("click"); closeModal(); settingsModal(); render(); };
  v.querySelector("#langHi").onclick=()=>{ setLang("hi"); beep("click"); closeModal(); settingsModal(); render(); };
  const curFont=()=>parseFloat(localStorage.getItem("bow_font")||"15px");
  const setFont=(px)=>{ localStorage.setItem("bow_font",px+"px"); document.documentElement.style.fontSize=px+"px"; };
  v.querySelector("#fontMinus").onclick=()=>setFont(Math.max(12,curFont()-1));
  v.querySelector("#fontPlus").onclick=()=>setFont(Math.min(20,curFont()+1));
  v.querySelector("#fontReset").onclick=()=>setFont(15);
  v.querySelectorAll("[data-curr]").forEach(b=>b.onclick=()=>{
    if(typeof setActiveCurrencyCode==="function") setActiveCurrencyCode(b.dataset.curr);
    beep("click"); closeModal(); settingsModal(); render();
  });
  v.querySelector("#sndTestClick").onclick=()=>beep("click");
  v.querySelector("#sndTestGold").onclick=()=>beep("gold");
  v.querySelector("#sndTestFanfare").onclick=()=>beep("fanfare");
  const smt=v.querySelector("#sndMusicToggle");
  if(smt) smt.onclick=()=>{
    if(typeof BOW_SOUNDTRACK!=="undefined"){
      BOW_SOUNDTRACK.toggle();
      beep("click");
      closeModal(); settingsModal();
    }
  };
  v.querySelector("#sndMuteToggle").onclick=()=>{
    if(Date.now() < MUTE_UNTIL){
      MUTE_UNTIL = 0;
      localStorage.removeItem("bow_mute_until");
      toast("Audio unmuted.","good");
    } else {
      MUTE_UNTIL = Date.now() + 600000;
      localStorage.setItem("bow_mute_until", MUTE_UNTIL);
      toast("Audio muted for 10 minutes.","good");
    }
    closeModal(); settingsModal();
  };
  v.querySelector("#btnTestMotion").onclick=()=>{ confetti({count:60}); beep("gold"); };
  v.querySelectorAll("[data-motion]").forEach(b=>b.onclick=()=>{ MOTION=b.dataset.motion; localStorage.setItem("bow_motion",MOTION); applyMotionPref(); beep("click"); closeModal(); settingsModal(); });
  v.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{ applyTheme(b.dataset.theme); beep("click"); closeModal(); settingsModal(); });   // v19 theme picker
  v.querySelectorAll("[data-cb]").forEach(b=>b.onclick=()=>{ setCB(b.dataset.cb==="1"); beep("click"); closeModal(); settingsModal(); });   // v31 color-blind cues
  try{ bindPWAInstall(v); }catch(e){}   // v31 PWA install card
  v.querySelector("#btnPrivacy").onclick=()=>{ beep("click"); privacyModal(); };
  v.querySelectorAll("[data-hap]").forEach(b=>b.onclick=()=>{ HAPTICS=b.dataset.hap==="1"; localStorage.setItem("bow_hap",HAPTICS?"1":"0"); if(HAPTICS) rumble([20,40,20]); beep("click"); closeModal(); settingsModal(); });
  v.querySelectorAll("[data-wksum]").forEach(b=>b.onclick=()=>{ localStorage.setItem("bow_wksum",b.dataset.wksum); beep("click"); closeModal(); settingsModal(); });
  const stn=v.querySelector("#stNameSave");
  if(stn) stn.onclick=()=>{ if(renameStudio(v.querySelector("#stName").value)){ beep("gold"); toast("🏛 Studio renamed","good"); closeModal(); settingsModal(); render(); } };
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
  v.querySelectorAll("[data-delslot]").forEach(b=>b.onclick=()=>{
    const n=+b.dataset.delslot;
    try{ localStorage.removeItem("bow_slot"+n); }catch(e){}
    beep("click"); toast("Slot "+n+" wiped.","good"); closeModal(); settingsModal();
  });
  v.querySelector("#btnRepairSlots").onclick=()=>{
    if(typeof repairSaveSlots==="function") repairSaveSlots();
    beep("gold"); toast("Save slots verified & repaired.","good"); closeModal(); settingsModal();
  };
  v.querySelector("#btnAboutChangelog").onclick=()=>{
    closeModal(); changelogModal();
  };
  v.querySelector("#btnResetSettings").onclick=()=>{
    try{
      localStorage.removeItem("bow_lang");
      localStorage.removeItem("bow_font");
      localStorage.removeItem("bow_theme");
      localStorage.removeItem("bow_motion");
      localStorage.removeItem("bow_hap");
      localStorage.removeItem("bow_wksum");
      localStorage.removeItem("bow_mute_until");
    }catch(e){}
    setFont(15); setLang("en"); applyTheme("gold"); MOTION="auto"; HAPTICS=true; MUTE_UNTIL=0;
    toast("Settings reset to defaults.","good"); closeModal(); settingsModal(); render();
  };
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

  // Named slots handlers
  v.querySelector("#btnSaveNamed").onclick=async()=>{
    const name = v.querySelector("#saveNameInput").value.trim();
    if(!name){ toast("Enter a save name.","bad"); return; }
    G.saveName = name.slice(0,30);
    saveGame();
    beep("gold");
    toast("☁️ Saved as \""+G.saveName+"\"","good");
    closeModal(); settingsModal();
  };
  v.querySelector("#btnSyncIDB").onclick=async()=>{
    if(!G.saveName){ toast("Save a named slot first.","bad"); return; }
    beep("click");
    const ok = await saveToIDB(G.saveName, G);
    toast(ok?"Backed up on this device":"Device backup failed (private mode?)", ok?"good":"bad");
  };
  v.querySelector("#btnListIDB").onclick=async()=>{
    beep("click");
    const list = await listIDBSlots();
    const el = v.querySelector("#namedSlotsList");
    if(!list.length){ el.innerHTML = "<div class='tiny muted'>No device backups yet.</div>"; return; }
    el.innerHTML = list.map(s=>"<div class='cost-line'><span>☁️ "+esc(s.id)+"</span><b class='tiny muted'>"+new Date(s.timestamp).toLocaleString()+"</b></div>").join("");
  };
  // Render named slots list on open
  (async()=>{
    const named = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k?.startsWith("bow_named_")) named.push(k.replace("bow_named_",""));
    }
    const el = v.querySelector("#namedSlotsList");
    if(!named.length){ el.innerHTML = "<div class='tiny muted'>No named slots yet. Create one above.</div>"; return; }
    el.innerHTML = named.map(n=>{
      const m = namedSlotMeta(n);
      return "<div class='cost-line'><span>☁️ "+esc(m.saveName)+"</span>"+
        "<button class='btn btn-xs btn-alt' data-loadnamed='"+esc(n)+"'>Load</button>"+
        "<button class='btn xs btn-ghost' data-delnamed='"+esc(n)+"'>🗑️</button></div>";
    }).join("");
    v.querySelectorAll("[data-loadnamed]").forEach(b=>b.onclick=async()=>{
      beep("click");
      await loadNamedSlot(b.dataset.loadnamed);
      closeModal(); render();
    });
    v.querySelectorAll("[data-delnamed]").forEach(b=>b.onclick=async()=>{
      beep("click");
      localStorage.removeItem("bow_named_"+b.dataset.delnamed);
      closeModal(); settingsModal();
    });
  })();
}

function startSpinoff(fr){
  const idea={ id:nid(), genre:DATA.GENRES[fr.genre]?fr.genre:"action", scale:"mid", title:"(spin-off)",
    blurb:"A cheaper ride on the "+fr.name+" heat.", script:rint(55,78), hot:true, spinoffFr:fr, awareness:0 };
  WZ={mode:"film", idea, writer:null, director:null, producer:null, cast:[], cameo:null, sub:2, budget:Math.round(neededBudget(idea.genre,"mid")*0.45),
      plan:"theatrical", presales:false, rating:"PG-13", location:"la", foreignLang:false,
      aiCast:false, aiScript:false, coProd:"none"};
  wizardModal();
}

function autoWeekTick(){
  if(!G){toggleAuto(false);return;}
  if(document.hidden || (typeof StudioLotBridge!=='undefined'&&StudioLotBridge.clock.paused))return;
  if(G.pendingChoice||G.pendingReport||G.pendingEarnings||G.pendingAuction||G.pendingDeepfake||G.pendingSports||G.over)return;
  if(document.querySelector('#modalRoot .modal'))return;
  doWeek(1);
}
function toggleAuto(force){
  const want = (force===undefined)? !AUTO : force;
  if(want && !AUTO){
    if(typeof StudioLotBridge!=='undefined')StudioLotBridge.clock.paused=false;
    AUTO=setInterval(autoWeekTick,typeof autoIntervalMs==='function'?autoIntervalMs():1100);
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
    const churn=churnRisk();
    const churnTag = churn.level==="high"? "<span class='tag red'>📉 churn risk "+churn.pct+"%</span>"
      : churn.level==="medium"? "<span class='tag gold'>📉 churn "+churn.pct+"%</span>" : "";
    h+="<div class='stat-hero'>"+
      statCard(fmtSubs(s.subs),t("stat.subs")+" · "+esc(s.name),"var(--purple)")+
      statCard(fmtSubs(ceil),"Subscriber ceiling")+
      statCard("+"+fmtM(s.subs*0.5)+"/wk","Streamer revenue","var(--green)")+
      statCard(fmtM(s.totalRev),"Lifetime revenue")+
      statCard(Math.round(G.streamer.sportsPower||0),"Sports power")+
      statCard((G.mySports.length? G.mySports.map(x=>DATA.SPORTS.find(d=>d.id===x.kind).emoji).join(" "):"—"),"Sports held")+
    "</div>"+
    "<div class='card'>"+meter(s.subs, ceil, "linear-gradient(90deg,#b48bff,#e0c3ff)")+
    "<div class='tiny muted' style='margin-top:4px'>"+(churnTag? churnTag+" ":"")+(starved? "⚠️ Content-starved: churn is bleeding subscribers. Drop a library title or release day-and-date.":"Feeding schedule healthy. New content pauses churn.")+" Next sports auction: weeks 13/26/39/52.</div></div>";
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
  if(until==="rpg_sheet") ok = films.length>0 && (G.talent||[]).some(t=>t.prototype && (t.prototype.history||[]).length);
  if(until==="game_gdd") ok = !!((G.prototypeData||{}).gameDevUnlocked);
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
  const canCollab=G.studio.cash>=6, canDtv=G.studio.cash>=12, canPub=G.studio.cash>=15, canResort=G.studio.cash>=400, canCross=G.studio.cash>=40, canMerge=G.studio.cash>=150;
  let h="<h3>🏰 "+esc(fr.name)+" — empire moves</h3>"+
    "<div class='tiny muted'>Tier "+fr.tier+" · fatigue "+Math.round((fr.fatigue||0)*100)+"% · heat "+frHeatPct(fr)+"% (×"+frHeatMultOf(fr).toFixed(2)+" opening)</div>";
  h+="<div class='card' style='margin-top:8px'><div class='row'>"+
    (((fr.collabAt||0)>G.week)? "<span class='tag green'>🤝 collab live</span>" : "<button class='btn btn-sm btn-alt' id='emCollab'"+(canCollab?"":" disabled title='Requires $6M cash'")+">🤝 Brand collab · $6M"+(canCollab?"":" (need $6M)")+"</button>")+
    (((fr.dtvAt||0)>G.week)? "<span class='tag green'>📀 DTV in stores</span>" : "<button class='btn btn-sm btn-alt' id='emDtv'"+(canDtv?"":" disabled title='Requires $12–22M cash'")+">📀 DTV sequel · $12–22M"+(canDtv?"":" (need $12M+)")+"</button>")+
    (fr.publishing? "<span class='tag green'>📚 publishing arm</span>" : "<button class='btn btn-sm btn-alt' id='emPub'"+(canPub?"":" disabled title='Requires $15M cash'")+">📚 Publishing arm · $15M"+(canPub?"":" (need $15M)")+"</button>")+
  "</div></div>";
  h+="<div class='card'><div class='row'>"+
    (fr.resort? "<span class='tag green'>🏝 resort landmark open (+5 rep · $0/wk)</span>" : (fr.park>=1? "<button class='btn btn-sm btn-gold' id='emResort' title='Prestige landmark: +5 rep, $0/wk recurring income'"+(canResort?"":" disabled")+">🏝 Resort & cruise landmark · $400M (+5 rep · $0/wk)"+(canResort?"":" (need $400M)")+"</button>" : "<span class='tiny muted'>🏝 Resort landmark (+5 rep · $0/wk) unlocks after the first 🎡 attraction</span>"))+
  "</div></div>";
  h+="<div class='card'><b>📦 License it out</b><div class='tiny muted' style='margin:4px 0'>Hand the brand to a rival for a fat upfront fee + a backend settlement on “"+dateLabel(G.week+39)+"”-ish paper. Brand heat fades while it's away.</div><div class='row'>"+
    (((fr.licenseAt||0)>G.week)? "<span class='tag green'>already out</span>" :
      "<button class='btn btn-sm btn-alt' id='emLicFilm'>🎬 Film remake rights</button>"+
      (fr.merch>=1? "<button class='btn btn-sm btn-alt' id='emLicGoods'>🥤 Consumer goods</button>" : ""))+
  "</div></div>";
  if(others.length && fr.tier>=3){
    h+="<div class='card'><b>💥 Crossover film</b> <span class='tiny muted'>($40M · tentpole idea lands in Develop · both brands tier 3+)</span><div class='row' style='margin-top:6px'>"+
      others.filter(o=>o.tier>=3)
        .map(o=>"<button class='btn btn-sm btn-alt' data-em-cross='"+o.id+"'"+(canCross?"":" disabled title='Requires $40M cash'")+">× "+esc(o.name)+(canCross?"":" (need $40M)")+"</button>").join("")+
      (others.filter(o=>o.tier<3).length? "<span class='tiny muted'>"+others.filter(o=>o.tier<3).length+" brand(s) below tier 3</span>" : "")+
    "</div></div>";
  }
  if(others.length && !G.universeBonus){
    h+="<div class='card'><b>🌌 Weave a shared universe</b> <span class='tiny muted'>($150M · all franchise income +15% forever · one-time)</span><div class='row' style='margin-top:6px'>"+
      others
        .map(o=>"<button class='btn btn-sm btn-alt' data-em-merge='"+o.id+"'"+(canMerge?"":" disabled title='Requires $150M cash'")+">⚭ "+esc(o.name)+(canMerge?"":" (need $150M)")+"</button>").join("")+
    "</div></div>";
  }
  if(G.universeBonus){
    h+="<div class='card'><b>🌌 Shared universe active</b> — all franchise income <b class='gold'>+15%</b> forever.</div>";
  }
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>"+t("btn.close")+"</button></div>";
  const v=openModal(h);
  const go=(fn,arg)=>()=>{
    const r=fn.call(null,arg);
    if(r && r.ok){ beep("gold"); closeModal(); flashes(G.flash); render(); }
    else { beep("bad"); toast((r && r.reason) || "Requirements not met.", "bad"); }
  };
  const grab=id=>v.querySelector(id);
  if(grab("#emCollab")) grab("#emCollab").onclick=go(brandCollab, fr.id);
  if(grab("#emDtv"))    grab("#emDtv").onclick=go(dtvSequel, fr.id);
  if(grab("#emPub"))    grab("#emPub").onclick=go(launchPublishing, fr.id);
  if(grab("#emResort")) grab("#emResort").onclick=go(buildResort, fr.id);
  if(grab("#emLicFilm"))  grab("#emLicFilm").onclick=go(()=>licenseOut(fr.id,"film"));
  if(grab("#emLicGoods")) grab("#emLicGoods").onclick=go(()=>licenseOut(fr.id,"goods"));
  v.querySelectorAll("[data-em-cross]").forEach(b=>b.onclick=go(()=>crossoverEvent(fr.id,b.dataset.emCross)));
  v.querySelectorAll("[data-em-merge]").forEach(b=>b.onclick=go(()=>mergeUniverse(fr.id,b.dataset.emMerge)));
}

/* ═══════════ VIEW: 2D Studio Lot Simulation (Rust Core) ═══════════ */
function viewStudioLot2D(){
  return `<div class="studiolot-lot-footer" style="padding:10px 16px;text-align:center">
    <span class="tag gold">HOLLYWOOD 2D STUDIO LOT SIMULATION ACTIVE</span>
    <span class="tiny muted" style="margin-left:8px">Pan with drag · Zoom with mouse wheel or +/- · Click buildings &amp; characters</span>
  </div>`;
}

/* ═══════════ VIEW: dashboard (v17) — Live HQ summary ═══════════ */
/* Landscape command deck: derived entirely from the current career. */
function commandStrategyContent(state, inDialog){
  const board=typeof initBoardTargets==='function'?initBoardTargets(state):state.boardTargets||{};
  const confidence=board.confidence??75, weeks=13-((state.week-1)%13);
  const directives=board.activeDirectives||[];
  const dated=(state.projects||[]).filter(p=>p.releaseWeek>state.week).sort((a,b)=>a.releaseWeek-b.releaseWeek);
  return `<div class="strategy-workspace"><aside class="strategy-mandate"><span class="command-eyebrow">THE BOARD’S MANDATE</span><h2>Quarter ${board.currentQuarter||1}</h2><div class="strategy-confidence"><strong>${confidence}<small>%</small></strong><span>BOARD CONFIDENCE</span></div><div class="strategy-confidence-track"><i style="width:${clamp(confidence,0,100)}%"></i></div><p>${board.austerityMode?'Austerity is active. Restore board confidence by meeting your commitments.':'Your creative freedom is backed by results. Keep the next quarter on track.'}</p><dl><div><dt>Review in</dt><dd>${weeks} weeks</dd></div><div><dt>Governance</dt><dd>${board.austerityMode?'Austerity':'Healthy'}</dd></div><div><dt>Cash reserves</dt><dd>${fmtM(state.studio.cash)}</dd></div></dl>${inDialog?'<button class="command-primary" onclick="closeModal()">Return to strategy</button>':'<button class="command-primary" id="btnOpenBoard">Open board review ↗</button>'}</aside><section class="strategy-agenda"><header><span class="command-eyebrow">THIS QUARTER / ${directives.length} COMMITMENTS</span><h2>The decision agenda</h2><p>Targets, progress, and rewards—all in one place.</p></header><div class="strategy-directives">${directives.map((d,i)=>{
    const current=d.type==='cash_reserves'?state.studio.cash:(d.currentVal||0);
    const progress=d.completed?100:clamp(current/Math.max(1,d.targetVal||1)*100,0,100);
    const unit=d.type==='cash_reserves'||d.type==='theatrical_revenue';
    return `<article class="strategy-directive"><span class="strategy-number">0${i+1}</span><div><small>${d.completed?'COMMITMENT MET':'IN PROGRESS'}</small><h3>${esc(d.title)}</h3><p>${esc(d.desc)}</p><div class="strategy-target"><span>${unit?fmtM(current):current} / ${unit?fmtM(d.targetVal):d.targetVal}</span><b>${Math.round(progress)}%</b></div><div class="strategy-target-track"><i style="width:${progress}%"></i></div><footer>Target reward · ${fmtM(d.rewardCash||0)} · +${d.confidenceBuff||0} confidence</footer></div></article>`;
  }).join('')||'<div class="command-empty">No active directives this quarter.</div>'}</div><div class="strategy-horizon"><h3>${inDialog?'Review history':'On the horizon'}</h3>${inDialog?(board.quarterlyHistory||[]).slice(-4).reverse().map(r=>`<div><b>Quarter ${r.quarter}</b><span>${r.completedCount}/${r.totalCount} commitments · ${fmtM(r.bonusCash||0)} bonus</span></div>`).join('')||'<p>Your first review is still ahead.</p>':dated.slice(0,3).map(p=>`<div><b>${esc(p.title)}</b><span>Premiere in ${p.releaseWeek-state.week} weeks</span></div>`).join('')||'<p>No premieres scheduled. Plan your next release in Productions.</p>'}</div>${!inDialog?'<button class="command-secondary" onclick="switchTab(\'productions\')">Plan release calendar ↗</button>':''}</section></div>`;
}

function commandSubpage(tab,title,description,content){
  return `<section class="command-deck command-subpage"><header class="command-heading"><div><span class="command-eyebrow">${tab==='studio'?'STUDIO HQ':'DIRECTOR’S OFFICE'} / MANAGEMENT</span><h1>${title}</h1><p>${description}</p></div></header><div class="command-page-content">${content}</div></section>`;
}
function commandSectionNav(tab){
  const studio = tab === "studio";
  const sections = studio
    ? [["lot","Campus"],["csuite","Leadership"],["board","Strategy"],["operations","Workforce"],["crisis","Reputation"],["heritage","Legacy"]]
    : [["overview","Command deck"],["actions","Management desks"],["slate","Project tracker"],["macro","Industry pulse"]];
  const active = studio ? STUDIO_SUB : DASHBOARD_SUB;
  return `<nav class="command-section-nav" aria-label="${studio?'Studio':'Dashboard'} sections"><div class="command-nav-brand"><span>${studio?'STUDIO HQ':'DIRECTOR’S OFFICE'}</span><small>${studio?'PEOPLE / PLACES / POSSIBILITIES':'PLAN / PRODUCE / PREMIERE'}</small></div><div class="command-nav-items">${sections.map(([key,label],i)=>`<button ${studio?'data-studiosub':'data-dashsub'}="${key}" class="${active===key?'active':''}" aria-current="${active===key?'page':'false'}"><small>0${i+1}</small><span>${label}</span></button>`).join('')}</div>${studio?`<div class="command-nav-tools"><button id="btnAch" aria-label="Trophy Room — view achievements"><small>07 / MILESTONES</small><span>Trophy Room</span></button><button id="btnOpenCustomSandbox" aria-label="Creative Lab — sandbox creator"><small>08 / CUSTOM WORLDS</small><span>Creative Lab</span></button></div>`:''}</nav>`;
}
function commandMetric(label, value, note){
  return `<div class="command-metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}
function commandCampus(){
  const sites = [
    ['writers_bungalow','Story house','develop','01','Find your next story'],
    ['soundstage','Soundstage','productions','02','On the production floor'],
    ['post_suite','Post production','productions','03','Bring it all together'],
    ['cinema_theater','Premiere house','boxoffice','04','Meet your audience']
  ];
  return `<div class="command-campus"><div class="campus-road"></div>${sites.map(([art,name,tab,n,desc])=>`<button class="campus-building campus-${n}" onclick="switchTab('${tab}')"><img src="assets/studio/${art}.png" alt=""><span><small>SECTOR ${n}</small><b>${name}</b><em>${desc} ↗</em></span></button>`).join('')}<div class="campus-gate">${esc(G.studio.name)} <span>STUDIO CAMPUS / EST. YEAR 1</span></div></div>`;
}
function commandDashboard(){
  const st=G.studio, projects=(G.projects||[]).filter(p=>p.phase!=="delivered"), live=activeFilms();
  const history=(G.txHistory||[]).slice(-8), net=history.reduce((s,t)=>s+(t.net||0),0);
  const upcoming=projects.filter(p=>p.releaseWeek>G.week).sort((a,b)=>a.releaseWeek-b.releaseWeek);
  const ready=typeof readyProjects==='function'?readyProjects():[];
  const focus=ready.length?'Your next premiere is waiting.':!projects.length?'Every empire starts with a story.':'Keep the cameras rolling.';
  const target=ready.length?'productions':!projects.length?'develop':'productions';
  const phases=[['Development',p=>/^(pre|dev|development|script|writing)$/i.test(p.phase||'')],['In production',p=>!/^(pre|dev|development|script|writing|ready|complete)$/i.test(p.phase||'')],['Ready to release',p=>/ready|complete/i.test(p.phase||'')]];
  return `<section class="command-deck"><header class="command-heading"><div><span class="command-edition">NEW / COMMAND DECK</span><span class="command-eyebrow">THE EXECUTIVE DESK / YEAR ${yearOf(G.week)}</span><h1>This week, make history.</h1><p>${esc(st.name)} · Your studio at a glance.</p></div><div class="command-date"><span>WEEK</span><b>${String(woyOf(G.week)).padStart(2,'0')}</b><small>${esc(DATA.seasonOf(woyOf(G.week)).month)}</small></div></header>
  <div class="command-telemetry">${commandMetric('AVAILABLE CAPITAL',fmtM(st.cash),'Cash on hand')}${commandMetric('NET FLOW / '+history.length+'W',(net>=0?'+':'')+fmtM(net),history.length?'Recorded weekly profit':'Awaiting your first week')}${commandMetric('STUDIO REPUTATION',Math.round(st.rep)+'/100','Your industry standing')}${commandMetric('ON THE BIG SCREEN',live.length,'Active theatrical releases')}</div>
  <div class="command-main"><section class="command-brief"><span class="command-eyebrow">01 / YOUR NEXT MOVE</span><h2>${focus}</h2><p>${ready.length?`${ready.length} project(s) ready. Review your slate and plan the release.`:!projects.length?'Discover a script, assemble your cast, and turn a blank page into a box-office contender.':`${projects.length} project(s) in your slate. Check progress, shape the campaign, and prepare for opening night.`}</p><button class="command-primary" onclick="switchTab('${target}')">${target==='develop'?'Find a story':'Open production slate'} <span>↗</span></button><div class="command-brief-foot"><span>UP NEXT</span><b>${upcoming.length?esc(upcoming[0].title):'No premiere scheduled'}</b><small>${upcoming.length?'Week '+woyOf(upcoming[0].releaseWeek)+' · '+(upcoming[0].releaseWeek-G.week)+' weeks away':'Set a release date from Productions'}</small></div></section>
  <section class="command-pipeline"><div class="command-section-head"><div><span class="command-eyebrow">02 / THE SLATE</span><h2>From idea to opening night</h2></div><button onclick="switchTab('productions')">All projects ↗</button></div><div class="command-lanes">${phases.map(([name,test],i)=>{const list=projects.filter(test);return `<div class="command-lane"><header><span>0${i+1} / ${name}</span><b>${list.length}</b></header>${list.slice(0,3).map(p=>`<button class="command-project" onclick="switchTab('productions')"><small>${esc(p.genre||'Feature film')}</small><b>${esc(p.title)}</b><span>${esc(p.phase||'In progress')} · ${fmtM(p.budget||0)} ↗</span></button>`).join('')||`<div class="command-empty"><span>＋</span><b>${i===0?'A story starts here':'Stage is clear'}</b><small>${i===0?'Explore scripts in Develop':'Your projects will appear here'}</small></div>`}</div>`}).join('')}</div><footer class="command-signal"><span class="command-status-dot"></span> ${live.length?live.length+' release(s) competing at the box office':'The screens are waiting for your next release.'}<button onclick="switchTab('boxoffice')">Market report ↗</button></footer></section></div>
  <nav class="command-shortcuts" aria-label="Executive shortcuts"><button onclick="switchTab('studio')"><span>03 / BUILD</span><b>Your studio campus ↗</b></button><button onclick="switchTab('finance')"><span>04 / BALANCE</span><b>Finance &amp; ledger ↗</b></button><button data-dashsub="macro"><span>05 / WATCH</span><b>Industry outlook ↗</b></button><button data-dashsub="actions"><span>06 / EXPLORE</span><b>All management desks ↗</b></button></nav></section>`;
}
function commandStudio(backlot, csuite, stamina){
 return `<section class="command-deck command-studio"><header class="command-heading"><div><span class="command-edition">NEW / STUDIO CAMPUS</span><span class="command-eyebrow">STUDIO MANAGEMENT / CAMPUS OVERVIEW</span><h1>A home for big ideas.</h1><p>Enter a department. Build your capabilities. Make better movies.</p></div><button class="command-primary" onclick="switchTab('studiolot')">Enter live 2D lot ↗</button></header><div class="command-studio-grid"><section class="command-map"><div class="command-section-head"><span class="command-eyebrow">THE CAMPUS / SELECT A DEPARTMENT</span><span class="command-map-key">● INTERACTIVE DIRECTORY</span></div>${commandCampus()}<footer class="command-map-footer">DEVELOP → PRODUCE → POLISH → PREMIERE <span>One studio. Every part of the story.</span></footer></section><aside class="command-control"><span class="command-eyebrow">CAMPUS PULSE</span><h2>Behind the scenes</h2>${commandMetric('SOUNDSTAGES',backlot.stagesOccupied+' / '+backlot.stagesBuilt,'Occupied / built')}${commandMetric('TEAM STAMINA',Math.round(stamina)+'/100','Average staff energy')}${commandMetric('EXECUTIVE TEAM',csuite.hiredCount+' / '+csuite.total,'C-suite positions filled')}<button class="command-primary" id="btnOpenFacilities">Build &amp; upgrade ↗</button><button class="command-secondary" data-studiosub="operations">Manage operations ↗</button></aside></div><div class="command-shortcuts"><button data-studiosub="csuite"><span>PEOPLE</span><b>Executive board ↗</b></button><button data-studiosub="board"><span>STRATEGY</span><b>Board directives ↗</b></button><button id="btnOpenAmenities"><span>WORKPLACE</span><b>Decor &amp; amenities ↗</b></button><button id="btnOpenBonds"><span>EXPANSION</span><b>Capital &amp; bonds ↗</b></button></div><details class="command-services"><summary>More studio services <span>Syndication · Studio influence · Sharing</span></summary><div class="command-service-actions"><button id="btnOpenSyndication" class="btn">Syndication desk</button><button id="btnShareCard" class="btn">Share studio card</button></div>${typeof influenceCard==='function'?influenceCard():''}${typeof StudioOperationsSuite!=='undefined'&&StudioOperationsSuite.renderBacklotSection?StudioOperationsSuite.renderBacklotSection():''}</details></section>`;
}

function viewDashboard(){
  if(DASHBOARD_SUB==='overview') return commandDashboard();
  if(DASHBOARD_SUB==='actions'){
    const desks=[['develop','Story development','Find a screenplay and assemble your next film.'],['productions','Production office','Manage your active projects and release dates.'],['boxoffice','Theatrical market','Follow openings, competition, and theatrical runs.'],['ott','Streaming division','Manage series, originals, and streaming deals.'],['live','Broadcast division','Build and operate your television network.'],['finance','Finance office','Review cash, liabilities, and funding.']];
    return commandSubpage('dashboard','Management desks','Your next decision starts here.',`<div class="command-desk-grid">${desks.map(([tab,name,desc],i)=>`<button onclick="switchTab('${tab}')"><small>0${i+1} / ENTER DEPARTMENT</small><b>${name}</b><span>${desc}</span></button>`).join('')}</div><div class="command-section-head"><h2>Specialist partners</h2></div><div class="command-desk-grid">${[['btnDashLocations','Location incentives','Scout locations and tax rebates.'],['btnDashSponsors','Brand partnerships','Negotiate product placement.'],['btnDashScout','Talent discovery','Explore new industry connections.'],['btnDashHardware','Hardware division','Manage console hardware.'],['btnDashCoPro','Co-production desk','Build production partnerships.'],['btnDashAwards','Awards office','Plan your awards circuit.']].map(([id,name,desc])=>`<button id="${id}"><small>SPECIALIST DESK</small><b>${name}</b><span>${desc}</span></button>`).join('')}</div>`);
  }
  if(DASHBOARD_SUB==='slate'){
    const projects=(G.projects||[]).filter(p=>p.phase!=='delivered');
    return commandSubpage('dashboard','Project tracker','Every active project. One clear production view.',`<div class="command-section-head"><span class="command-eyebrow">${projects.length} ACTIVE PROJECTS</span><button onclick="switchTab('develop')">Develop a film ↗</button></div><div class="command-tracker">${projects.map(p=>`<article><div><small>${esc(p.kind||'film')} / ${esc(p.genre||'')}</small><h2>${esc(p.title)}</h2><span>${p.director?esc(p.director.name):'Director not attached'}</span></div><div><small>PRODUCTION PHASE</small><b>${esc(p.phase||'development')}</b></div><div><small>BUDGET</small><b>${fmtM(p.budget||0)}</b></div><div><small>PREMIERE</small><b>${p.releaseWeek?'Y'+yearOf(p.releaseWeek)+' / W'+woyOf(p.releaseWeek):'Not scheduled'}</b></div><button class="command-secondary" onclick="switchTab('productions')">Manage ↗</button></article>`).join('')||'<div class="command-empty"><b>Your slate is a blank canvas.</b><small>Develop a film to begin tracking production.</small></div>'}</div>`);
  }
  const phase=G.econCycle&&DATA.ECON_CYCLES.find(c=>c.id===G.econCycle.phase);
  const values=(G.txHistory||[]).slice(-8).map(t=>t.net||0);
  return commandSubpage('dashboard','Industry pulse','Read the market before your next move.',`<div class="command-telemetry">${commandMetric('ECONOMIC CYCLE',phase?esc(phase.name):'No cycle recorded',phase?G.econCycle.weeksLeft+' weeks remaining':'Awaiting market data')}${commandMetric('BOX OFFICE',econBoxOfficeMult().toFixed(2)+'×','Current market multiplier')}${commandMetric('BORROWING',econLoanRateMult().toFixed(2)+'×','Loan rate multiplier')}${commandMetric('STREAM CHURN',econStreamChurnMult().toFixed(2)+'×','Subscriber churn multiplier')}</div><section class="command-market-chart"><span class="command-eyebrow">RECORDED CASH FLOW / LAST ${values.length} WEEKS</span><h2>Profit, week by week</h2>${values.length?renderSparklineSVG(values,640,130,values[values.length-1]>=0?'#a9ce9e':'#e8a091'):'<div class="command-empty">Advance a week to start your cash-flow history.</div>'}</section>`);
}

/* ═══════════ VIEW: release calendar (v17) ═══════════ */
function viewCalendar(){
  const woy = woyOf(G.week);
  const yr = yearOf(G.week);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const weeksInMonth = [4,4,5,4,5,4,4,5,4,5,4,4];
  const monthStart = [0];
  for(let i=0;i<11;i++) monthStart.push(monthStart[i]+weeksInMonth[i]);
  
  let h="<div class='spread'><div class='section-title' style='margin:0'>📅 Release Calendar Y"+yr+"</div>"+
    "<button class='btn btn-sm btn-ghost' onclick='calendarModal()'>📅 Full Calendar Modal</button></div>";
  
  // Holiday markers
  const holidays = {48:"🎄 Christmas", 49:"🎄 Christmas", 50:"🎄 Christmas", 51:"🎄 Christmas", 52:"🎇 New Year"};
  
  // Build month grids
  for(let m=0;m<12;m++){
    const monthName = months[m];
    const start = monthStart[m]+1;
    const end = monthStart[m]+weeksInMonth[m];
    const isCurrentMonth = (woy >= start && woy <= end);
    
    h+="<div class='card"+(isCurrentMonth?"' style='border-color:var(--gold);box-shadow:0 0 16px rgba(245,185,66,.15)":"'")+">"+
      "<div class='spread'><b>"+monthName+"</b>"+
      "<span class='tiny muted'>W"+start+"–"+end+"</span></div>";
    
    h+="<div class='calendar-grid' style='display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:8px'>";
    // Weekday headers
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d=>{
      h+="<div class='cal-head' style='text-align:center;font-size:10px;color:var(--dim2);font-weight:700'>"+d+"</div>";
    });
    
    // Empty cells for first week alignment
    // Each month starts on week boundary, so we just show 4-5 rows of 7 cells
    const weeks = end - start + 1;
    for(let w=start; w<=end; w++){
      const isCurrentWeek = (w === woy);
      const datedFilms = (G.projects||[]).filter(p=>p.releaseWeek===w);
      const rivalFilms = (G.rivals||[]).flatMap(r=> (r.slate||[]).filter(f=>f.releaseWeek===w && f.live) );
      const isHoliday = holidays[w] || (DATA.seasonOf(w).holiday);
      
      let cellClass = "cal-cell"+(isCurrentWeek?" current":"")+(isHoliday?" holiday":"");
      let cellContent = "<div class='cal-week'>W"+w+"</div>";
      if(isHoliday) cellContent += "<div class='cal-holiday'>"+esc(holidays[w]||"Holiday")+"</div>";
      if(datedFilms.length) cellContent += "<div class='cal-mine'>"+datedFilms.map(f=>DATA.GENRES[f.genre]?DATA.GENRES[f.genre].emoji:"🎬"+" "+esc(f.title)).join("<br>")+"</div>";
      if(rivalFilms.length) cellContent += "<div class='cal-rival'>"+rivalFilms.map(f=>DATA.GENRES[f.genre]?DATA.GENRES[f.genre].emoji:"🎬"+" "+esc(f.title)).join("<br>")+"</div>";
      
      h+="<div class='"+cellClass+"' data-week='"+w+"' style='min-height:70px;padding:4px;background:#101522;border:1px solid var(--line);border-radius:8px;cursor:pointer'>"+cellContent+"</div>";
    }
    h+="</div></div>";
  }
  
  // Legend
  h+="<div class='card' style='margin-top:8px'><div class='row' style='gap:12px;flex-wrap:wrap'>"+
    "<span><span class='cal-cell current' style='width:16px;height:16px;display:inline-block;border:2px solid var(--gold);vertical-align:middle'></span> Current week</span>"+
    "<span><span class='cal-cell holiday' style='width:16px;height:16px;display:inline-block;background:rgba(245,185,66,.15);vertical-align:middle'></span> Holiday</span>"+
    "<span><span class='cal-mine' style='display:inline-block;width:16px;height:16px;background:var(--gold);border-radius:4px;vertical-align:middle'></span> Your film</span>"+
    "<span><span class='cal-rival' style='display:inline-block;width:16px;height:16px;background:var(--red);border-radius:4px;vertical-align:middle'></span> Rival film</span>"+
  "</div></div>";
  
  return h;
}

/* ═══════════ VIEW: film detail modal (v17) ═══════════ */
function filmDetailModal(filmId){
  const f = G.films.find(x=>x.id===filmId) || G.projects.find(x=>x.id===filmId);
  if(!f) return;
  const isReleased = f.ww && f.ww>0;
  const g = DATA.GENRES[f.genre] || {name:f.genre, emoji:"🎬"};
  const be = isReleased ? breakevenWW(f) : (f.budget? (f.budget + (f.marketing||recMarketing({budget:f.budget,scale:f.scale,genre:f.genre}))) / 0.48 : 0);
  
  // Territory breakdown
  let territoryHtml = "";
  if(f.territoryGross && Object.keys(f.territoryGross).length){
    territoryHtml = "<div class='section-title'>🌍 Multi-Territory Gross</div><div class='card'>";
    const total = Object.values(f.territoryGross).reduce((a,b)=>a+b,0);
    for(const [tid, gross] of Object.entries(f.territoryGross)){
      const t = DATA.territory(tid);
      const pct = total>0? Math.round(gross/total*100) : 0;
      territoryHtml += "<div class='cost-line'><span>"+t.emoji+" "+t.name+"</span><b>"+fmtG(gross)+" ("+pct+"%)</b></div>";
    }
    territoryHtml += "<div class='cost-line'><span>Total</span><b>"+fmtG(total)+"</b></div></div>";
  }
  
  // Weekly gross chart
  let weeklyHtml = "";
  if(f.weekly && f.weekly.length){
    const max = Math.max(1, ...f.weekly.map(w=>w.gross));
    weeklyHtml = "<div class='section-title'>📊 Week-by-Week Gross</div><div class='card'>";
    f.weekly.slice(-16).forEach(wk=>{
      weeklyHtml += "<div class='chart-bar' style='margin:4px 0'><div class='cb-rank'>W"+woyOf(wk.w)+"</div>"+
        "<div class='cb-track'><div class='cb-fill' style='width:"+Math.max(6, wk.gross/max*100)+"%;background:linear-gradient(90deg,var(--gold),var(--gold2))'>"+fmtM(wk.gross)+"</div></div></div>";
    });
    weeklyHtml += "</div>";
  }
  
  // Awards
  let awardsHtml = "";
  if(f.awards && f.awards.length){
    awardsHtml = "<div class='section-title'>🏆 Awards</div><div class='card'>";
    f.awards.forEach(a=>{
      awardsHtml += "<div class='cost-line'><span>"+a.emoji+" "+a.cat+"</span><b>"+esc(a.film)+"</b></div>";
    });
    awardsHtml += "</div>";
  }
  
  // Streaming status
  let streamingHtml = "";
  if(f.streamingOriginal || f.soldTo){
    streamingHtml = "<div class='section-title'>📺 Streaming</div><div class='card'>";
    if(f.streamingOriginal) streamingHtml += "<div class='cost-line'><span>Original for "+esc(G.streamer?.name||"your streamer")+"</span></div>";
    if(f.soldTo) streamingHtml += "<div class='cost-line'><span>Licensed to "+esc(f.soldTo)+"</span></div>";
    if(f.window) streamingHtml += "<div class='cost-line'><span>Window: "+f.window+"-day</span></div>";
    streamingHtml += "</div>";
  }
  
  // Franchise
  let franchiseHtml = "";
  if(f.franchiseName){
    const fr = G.franchises.find(x=>x.name===f.franchiseName);
    franchiseHtml = "<div class='section-title'>🏰 Franchise</div><div class='card'>";
    if(fr){
      franchiseHtml += "<div class='cost-line'><span>"+esc(fr.name)+" (Tier "+fr.tier+")</span></div>";
      franchiseHtml += "<div class='cost-line'><span>Fatigue</span><b>"+Math.round((fr.fatigue||0)*100)+"%</b></div>";
      franchiseHtml += "<div class='cost-line'><span>Merch tier</span><b>"+fr.merch+"</b></div>";
      franchiseHtml += "<div class='cost-line'><span>Park tier</span><b>"+fr.park+"</b></div>";
      franchiseHtml += "<div class='cost-line'><span>Franchise earnings</span><b>"+fmtM(fr.earned||0)+"</b></div>";
    }
    franchiseHtml += "<button class='btn btn-sm btn-alt' onclick=\"viewFranchiseDetail('"+esc(f.franchiseName)+"')\">View Franchise Graph</button>";
    franchiseHtml += "</div>";
  }
  
  let h="<h3>"+g.emoji+" "+esc(f.title)+" <span class='tiny muted'>("+f.scale+")</span></h3>"+
    "<div class='grid g2' style='margin-top:8px'>"+
      "<div class='card'><b>Director</b><div>"+esc(f.director?.name||"TBD")+"</div></div>"+
      "<div class='card'><b>Writer</b><div>"+esc(f.writer?.name||"TBD")+"</div></div>"+
      "<div class='card'><b>Producer</b><div>"+esc(f.producer?.name||"TBD")+"</div></div>"+
      "<div class='card'><b>Budget</b><div>"+fmtM(f.budget||0)+"</div></div>"+
      "<div class='card'><b>Marketing</b><div>"+fmtM(f.marketing||0)+"</div></div>"+
      (isReleased? "<div class='card'><b>WW Gross</b><div class='pos'>"+fmtG(f.ww)+" <span class='tiny'>("+(be?Math.round(f.ww/be*100)/100:"?")+"× breakeven)</span></div></div>":"")+
      (isReleased? "<div class='card'><b>Domestic</b><div>"+fmtG(f.dom||0)+"</div></div>":"")+
      (isReleased? "<div class='card'><b>Intl/China</b><div>"+fmtG((f.ww||0)-(f.dom||0))+"</div></div>":"")+
      "<div class='card'><b>Quality</b><div>"+scoreBadge(f.quality?.overall||0)+"</div></div>"+
      "<div class='card'><b>Critic / Audience</b><div>"+(f.quality?.critic||0)+" / "+(f.quality?.aud||0)+"</div></div>"+
      "<div class='card'><b>Genre</b><div>"+gTag(f.genre)+"</div></div>"+
      "<div class='card'><b>Rating</b><div>"+f.rating+"</div></div>"+
      "<div class='card'><b>Window</b><div>"+(f.window||45)+"-day</div></div>"+
      "<div class='card'><b>Location</b><div>"+(DATA.location(f.location)?.name||"LA")+"</div></div>"+
    "</div>"+
    (f.cast && f.cast.length? "<div class='section-title'>🎭 Cast</div><div class='card'><div class='row' style='flex-wrap:wrap;gap:6px'>"+
      f.cast.map(c=>"<span class='tag gold'>"+c.emoji+" "+esc(c.name)+" "+c.power+"★</span>").join("")+
      "</div></div>" : "")+
    territoryHtml+
    weeklyHtml+
    awardsHtml+
    streamingHtml+
    franchiseHtml+
    "<div class='modal-actions'>"+
    (isReleased && !f.directorsCut && (f.quality?.overall||0) >= 70 && (G.week - (f.releaseWeek||G.week)) >= 12 
      ? "<button class='btn btn-primary' onclick='releaseDirectorsCut("+f.id+")'>🎬 Director's Cut ($5M)</button>"
      : "")+
    (isReleased? "<button class='btn btn-primary' onclick='reReleaseFilm("+f.id+")'>🎞 Re-release</button>":"")+
    (f.streamingOriginal||f.soldTo? "<button class='btn btn-alt' onclick='viewStreamingDeal("+f.id+")'>📺 View Deal</button>":"")+
    "<button class='btn btn-ghost' onclick='closeModal()'>Close</button></div>";
  
  openModal(h);
}

/* ═══════════ Franchise Universe Graph (v17) ═══════════ */
function viewFranchiseDetail(franchiseName){
  const fr = G.franchises.find(x=>x.name===franchiseName);
  if(!fr) return;
  
  const graph = buildUniverseGraph();
  const nodes = graph.nodes.filter(n=>n.franchise===franchiseName);
  const edges = graph.edges.filter(e=>e.from.startsWith("f") && nodes.find(n=>n.id===e.from));
  
  // SVG layout
  const width = 700, height = 400;
  const centerX = width/2, centerY = height/2;
  const radius = 160;
  
  // Position nodes in a circle with the main film at center
  let nodePositions = {};
  const filmNodes = nodes.filter(n=>n.type==="film");
  const otherNodes = nodes.filter(n=>n.type!=="film");
  
  filmNodes.forEach((n,i)=>{
    const angle = (i/filmNodes.length)*Math.PI*2 - Math.PI/2;
    nodePositions[n.id] = { x:centerX+Math.cos(angle)*radius, y:centerY+Math.sin(angle)*radius };
  });
  otherNodes.forEach((n,i)=>{
    const angle = (i/otherNodes.length)*Math.PI*2 - Math.PI/2;
    const r = radius + 100;
    nodePositions[n.id] = { x:centerX+Math.cos(angle)*r, y:centerY+Math.sin(angle)*r };
  });
  
  let edgesSvg = "";
  edges.forEach(e=>{
    const from = nodePositions[e.from];
    const to = nodePositions[e.to];
    if(from && to){
      edgesSvg += "<line x1='"+from.x+"' y1='"+from.y+"' x2='"+to.x+"' y2='"+to.y+"' stroke='var(--line2)' stroke-width='2' marker-end='url(#arrowhead)'/>";
    }
  });
  
  let nodesSvg = "";
  nodes.forEach(n=>{
    const pos = nodePositions[n.id];
    if(!pos) return;
    const typeInfo = DATA.UNIVERSE_NODE_TYPES.find(t=>t.type===n.type) || {emoji:"🎬", color:"var(--gold)"};
    nodesSvg += "<g class='universe-node' onclick='filmDetailModal("+(n.id.startsWith("f")?n.id.slice(1):n.id)+")' style='cursor:pointer'>"+
      "<circle cx='"+pos.x+"' cy='"+pos.y+"' r='28' fill='"+typeInfo.color+"' stroke='var(--bg)' stroke-width='2'/>"+
      "<text x='"+pos.x+"' y='"+(pos.y+4)+"' text-anchor='middle' font-size='16px'>"+typeInfo.emoji+"</text>"+
      "<text x='"+pos.x+"' y='"+(pos.y+24)+"' text-anchor='middle' font-size='9px' fill='var(--dim)' style='max-width:100px'>"+esc(n.label)+"</text>"+
      "</g>";
  });
  
  let h="<h3>🌌 "+esc(franchiseName)+" Universe</h3>"+
    "<div class='tiny muted' style='margin-bottom:8px'>Tier "+fr.tier+" · Fatigue "+Math.round((fr.fatigue||0)*100)+"% · "+nodes.length+" entries</div>"+
    "<svg width='"+width+"' height='"+height+"' style='background:#0a0e16;border:1px solid var(--line);border-radius:12px'>"+
      "<defs>"+
        "<marker id='arrowhead' markerWidth='10' markerHeight='7' refX='9' refY='3.5' orient='auto'>"+
          "<polygon points='0 0, 10 3.5, 0 7' fill='var(--line2)'/>"+
        "</marker>"+
      "</defs>"+
      edgesSvg+
      nodesSvg+
    "</svg>"+
    "<div class='row' style='margin-top:12px;gap:8px;flex-wrap:wrap'>"+
    nodes.map(n=>{
      const typeInfo = DATA.UNIVERSE_NODE_TYPES.find(t=>t.type===n.type) || {emoji:"🎬", color:"var(--gold)"};
      return "<button class='btn btn-xs btn-alt' onclick='filmDetailModal("+(n.id.startsWith("f")?n.id.slice(1):n.id)+")'>"+typeInfo.emoji+" "+esc(n.label)+"</button>";
    }).join("")+
    "</div>"+
    "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Close</button></div>";
  
  openModal(h);
}

/* ═══════════ Animated Box Office Chart (v17) ═══════════ */
function renderAnimatedChart(data, opts={}){
  const {width=500, height=200, color="var(--gold)", duration=800, raceMode=false} = opts;
  const max = Math.max(1, ...data);
  const bars = data.map((val,i)=>({
    x: (i/(data.length-1))*(width-60)+30,
    y: height-20,
    h: (val/max)*(height-40),
    val: val,
    label: opts.labels?opts.labels[i]:""
  }));
  
  let svg = "<svg width='"+width+"' height='"+height+"' style='background:#0a0e16;border:1px solid var(--line);border-radius:8px'>";
  if(raceMode){
    svg += "<script>"+
      "const bars = document.querySelectorAll('.chart-bar-anim');"+
      "bars.forEach((b,i)=>{ b.style.transition='height 0s, opacity 0s'; b.style.height='0px'; b.style.opacity='0'; });"+
      "setTimeout(()=>{"+
        "bars.forEach((b,i)=>{ setTimeout(()=>{ b.style.transition='height "+duration+"ms ease-out, opacity 300ms'; b.style.height=b.dataset.h+'px'; b.style.opacity='1'; }, i*"+(duration/data.length)+"); });"+
      "}, 100);"+
    "<\/script>";
  }else{
    svg += "<style>@keyframes growUp{from{height:0}to{height:var(--h)}}.chart-bar-anim{animation:growUp "+duration+"ms ease-out forwards;}</style>";
  }
  
  bars.forEach(b=>{
    svg += "<rect class='chart-bar-anim' x='"+b.x+"' y='"+(b.y-b.h)+"' width='"+Math.max(20, 40/data.length)+"' height='0' data-h='"+b.h+"' fill='"+color+"' style='"+(raceMode?"":"--h:"+b.h+"px")+"'/>";
    if(b.label) svg += "<text x='"+b.x+"' y='"+(b.y+14)+"' text-anchor='middle' font-size='9px' fill='var(--dim)'>"+esc(b.label)+"</text>";
  });
  svg += "</svg>";
  return svg;
}

/* ═══════════ Executive Office View (v17) ═══════════ */
function viewExecOffice(){
  const state = execOfficeState();
  
  let h="<div class='spread'><div class='section-title' style='margin:0'>🏢 Executive Office</div>"+
    "<button class='btn btn-sm btn-ghost' onclick='switchTab(\"studio\")'>Back to Control Room</button></div>";
  
  // Desk layout
  h+="<div class='exec-office' style='display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px'>";
  
  // Left column - Script stack & Phone
  h+="<div class='card' style='grid-column:1'><b>📋 Script Stack</b>"+
    "<div class='cost-line'><span>Pending review</span><b>"+state.scriptsPending+"</b></div>"+
    "<div class='cost-line'><span>In development</span><b>"+state.filmsInProduction+"</b></div>"+
    "<div class='cost-line'><span>Ready, undated</span><b>"+state.filmsReady+"</b></div>"+
    "<button class='btn btn-sm btn-primary' style='margin-top:8px;width:100%' onclick=\"switchTab('develop')\">Review Scripts</button>"+
    "</div>";
  
  h+="<div class='card' style='grid-column:2'><b>📞 Phone</b>"+
    (state.unreadMail>0? 
      "<div class='cost-line'><span style='color:var(--gold)'>🔔 "+state.unreadMail+" unread messages</span></div>"+
      "<button class='btn btn-sm btn-primary' style='margin-top:4px;width:100%' onclick=\"switchTab('fans')\">Open Fan Mail</button>"
    : "<div class='tiny muted'>No messages</div>")+
    "</div>";
  
  // Right column - Whiteboard & Trophy shelf
  h+="<div class='card' style='grid-column:1'><b>📝 Whiteboard</b>"+
    "<div class='cost-line'><span>Active films</span><b>"+state.filmsInProduction+"</b></div>"+
    "<div class='cost-line'><span>Active series</span><b>"+(G.series.filter(s=>s.phase==="shoot").length)+"</b></div>"+
    "<button class='btn btn-sm btn-alt' style='margin-top:8px;width:100%' onclick=\"switchTab('productions')\">View Pipeline</button>"+
    "</div>";
  
  h+="<div class='card' style='grid-column:2'><b>🏆 Trophy Shelf</b>"+
    "<div class='cost-line'><span>Golden Reels</span><b>"+state.awardsCount+"</b></div>"+
    "<div class='cost-line'><span>Franchises</span><b>"+state.franchises+"</b></div>"+
    "<div class='cost-line'><span>Streamer subs</span><b>"+fmtSubs(state.streamerSubs)+"</b></div>"+
    "<button class='btn btn-sm btn-alt' style='margin-top:8px;width:100%' onclick=\"switchTab('empire')\">View Empire</button>"+
    "</div>";
  
  h+="</div>";
  
  // Market share mini
  h+="<div class='card' style='margin-top:12px'><b>🌍 Market Share Y"+yearOf(G.week)+"</b>";
  const myYtd = G.films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0);
  const rows=[{name:G.studio.name, ww:myYtd, me:true}].concat(G.rivals.map(r=>({name:r.name, ww:r.ytd})));
  const max=Math.max(1,...rows.map(r=>r.ww));
  rows.sort((a,b)=>b.ww-a.ww).forEach((r,i)=>{
    h+="<div class='spread' style='margin:4px 0'><span>"+(r.me?"⭐ ":"")+esc(r.name)+"</span>"+
      "<div class='bar' style='width:200px'><i style='width:"+Math.max(6,r.ww/max*100)+"%;background:"+(r.me?"linear-gradient(90deg,var(--gold),var(--gold2))":"#4a5570")+"'></i></div>"+
      "<b class='tiny'>"+fmtM(r.ww)+"</b></div>";
  });
  h+="</div>";
  
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Close</button></div>";
  
  openModal(h);
}

/* Helper: format subscriber count */
function fmtSubs(n){
  if(!Number.isFinite(n)) return "—";
  if(n>=1000) return (n/1000).toFixed(2)+"B";
  return n.toFixed(1)+"M";
}

function installGestures(){
  if(installGestures._done) return;
  installGestures._done=true;
  try{
    if(("ontouchstart" in window || (navigator && navigator.maxTouchPoints>0)) && !localStorage.getItem("bow_gesture_hint")){
      setTimeout(()=>{
        if(G && !G.over){
          toast("💡 Tip: Swipe ⇄ to switch tabs · pull down at top to advance week", "info");
          try{ localStorage.setItem("bow_gesture_hint", "1"); }catch(e){}
        }
      }, 1600);
    }
    /* v28: desktop keyboard coach mark — one-time Cmd+K hint */
    else if(!("ontouchstart" in window) && !(navigator && navigator.maxTouchPoints>0) && !localStorage.getItem("bow_kb_hint")){
      setTimeout(()=>{
        if(G && !G.over){
          toast("⌨️ Tip: ⌘K/Ctrl+K opens the command palette · Space advances a week", "info");
          try{ localStorage.setItem("bow_kb_hint", "1"); }catch(e){}
        }
      }, 1600);
    }
  }catch(e){}
  // v32.4: accidental pull-to-advance and swipe-tab gestures completely disabled
  // All week progression is strictly manual via explicit Next Week taps.
}

/* ═══════════ PROTOTYPE RPG: character sheets + in-house originals (v26) ═══════════ */
let CS={id:null, tab:"stats"};

function csRole(t){ return {writer:"Writer",producer:"Producer",director:"Director",actor:"Actor"}[t.kind]||t.kind; }
function csRarity(r){ return (DATA.PROTOTYPE_RARITY||{})[r] || {color:"#888"}; }
function csItemStat(it){
  const parts=[];
  if(it.quality) parts.push("+"+it.quality+" film quality");
  if(it.scandalReduction) parts.push(it.scandalReduction+"% scandal shield");
  if(it.xpRate) parts.push("+"+Math.round(it.xpRate*100)+"% XP");
  ["cha","int","cre","dis","luk"].forEach(k=>{ if(it[k]) parts.push("+"+it[k]+" "+k.toUpperCase()); });
  return parts.join(" · ")||"";
}
function csAttrRow(key, val, canSpend){
  const def=(DATA.PROTOTYPE_ATTRIBUTES||[]).find(a=>a.id===key)||{name:key,emoji:"•"};
  return "<div class='cost-line'><span>"+def.emoji+" "+def.name+"</span><span class='row' style='gap:6px'><b>"+Math.round(val)+"</b>"+
    (canSpend? "<button class='btn btn-xs btn-alt' data-cs-attr='"+key+"' title='Spend 1 skill point: +5 "+def.name+"'>+5</button>":"")+
    "</span></div><div style='margin:0 0 6px'>"+meter(val,100,"var(--blue)")+"</div>";
}

function characterSheet(id, tab){
  const t=(G.talent||[]).find(x=>x.id===+id);
  if(!t){ toast("Talent not found","bad"); return; }
  if(typeof initPrototypeTalent==="function") initPrototypeTalent(t);
  CS.id=t.id; if(tab) CS.tab=tab;
  const p=t.prototype;
  let h="<h3>📊 "+esc(t.name)+" <span class='tag gold'>Lv "+p.level+"</span> <span class='tag'>"+csRole(t)+"</span></h3>";
  h+="<div class='row' style='gap:4px;margin:8px 0'>"+[["stats","📈 Stats"],["equip","🎒 Gear"],["events","📜 Story"]].map(x=>
    "<button class='btn btn-sm "+(CS.tab===x[0]?"btn-primary":"btn-ghost")+"' data-cs-tab='"+x[0]+"'>"+x[1]+"</button>").join("")+"</div>";
  if(CS.tab==="stats") h+=csStatsHTML(t,p);
  else if(CS.tab==="equip") h+=csEquipHTML(t,p);
  else h+=csEventsHTML(t,p);
  h+="<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";
  const v=openModal(h);
  v.querySelectorAll("[data-cs-tab]").forEach(b=>b.onclick=()=>{ beep("click"); characterSheet(CS.id, b.dataset.csTab); });
  v.querySelectorAll("[data-cs-attr]").forEach(b=>b.onclick=()=>{
    const r=(typeof levelUpTalent==="function")?levelUpTalent(t.id, b.dataset.csAttr):{ok:false,err:"RPG system offline"};
    if(r.ok){ beep("gold"); flashes(G.flash); characterSheet(CS.id,"stats"); } else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  v.querySelectorAll("[data-cs-node]").forEach(b=>b.onclick=()=>{
    const r=(typeof unlockSkillNode==="function")?unlockSkillNode(t.id, b.dataset.csNode):{ok:false,err:"RPG system offline"};
    if(r.ok){ beep("gold"); flashes(G.flash); characterSheet(CS.id,"stats"); } else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  v.querySelectorAll("[data-cs-equip]").forEach(b=>b.onclick=()=>{
    const parts=b.dataset.csEquip.split(":");
    const r=(typeof equipItem==="function")?equipItem(t.id, parts[0], parts[1]):{ok:false,err:"RPG system offline"};
    if(r.ok){ beep("gold"); flashes(G.flash); characterSheet(CS.id,"equip"); } else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  v.querySelectorAll("[data-cs-unequip]").forEach(b=>b.onclick=()=>{
    if(typeof unequipItem==="function") unequipItem(t.id, b.dataset.csUnequip);
    beep("click"); characterSheet(CS.id,"equip");
  });
  v.querySelectorAll("[data-cs-branch]").forEach(b=>b.onclick=()=>{ CS.branch=b.dataset.csBranch; beep("click"); characterSheet(CS.id,"stats"); });
  v.querySelectorAll("[data-cs-mentor]").forEach(b=>b.onclick=()=>{
    const r=(typeof formMentorship==="function")?formMentorship(+b.dataset.csMentor, t.id):{ok:false,err:"RPG system offline"};
    if(r.ok){ beep("gold"); flashes(G.flash); characterSheet(CS.id,"stats"); } else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  v.querySelectorAll("[data-cs-unmentor]").forEach(b=>b.onclick=()=>{
    if(typeof endMentorship==="function") endMentorship(t.id);
    beep("click"); characterSheet(CS.id,"stats");
  });
  v.querySelectorAll("[data-cs-guild]").forEach(b=>b.onclick=()=>{
    const r=(typeof joinGuild==="function")?joinGuild(t.id, b.dataset.csGuild):{ok:false,err:"RPG system offline"};
    if(r.ok){ beep("gold"); flashes(G.flash); characterSheet(CS.id,"stats"); } else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  });
  const unguild=v.querySelector("[data-cs-unguild]");
  if(unguild) unguild.onclick=()=>{ if(typeof leaveGuild==="function") leaveGuild(t.id); beep("click"); characterSheet(CS.id,"stats"); };
  // Influence spend: masterclass intensive (+1000 XP for 10 influence)
  const infl=v.querySelector("[data-cs-intensive]");
  if(infl) infl.onclick=()=>{
    const r=(typeof spendInfluence==="function")?spendInfluence(10):{ok:false,err:"No influence system"};
    if(r.ok){ if(typeof gainXP==="function") gainXP(t.id, 1000, "masterclass intensive"); beep("gold"); flashes(G.flash); characterSheet(CS.id,"stats"); }
    else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  };
}

function csStatsHTML(t,p){
  const align=(DATA.PROTOTYPE_ALIGNMENTS||[]).find(a=>a.id===p.alignment)||{name:p.alignment||"—",emoji:"",desc:""};
  const moral=(DATA.PROTOTYPE_MORALS||[]).find(a=>a.id===p.moral)||{name:"Neutral",emoji:"🌗",desc:""};
  const eq=(typeof getEquipmentBonuses==="function")?getEquipmentBonuses(t):{quality:0,scandalReduction:0};
  let h="";
  h+="<div class='card'><div class='spread'><div><b>"+align.emoji+" "+esc(align.name)+" · "+moral.emoji+" "+esc(moral.name)+"</b>"+
    "<div class='tiny muted' style='margin-top:2px'>"+esc(align.desc||"")+"</div>"+
    "<div class='tiny muted'>"+esc(moral.desc||"")+"</div></div>"+
    "<div style='text-align:right'><span class='tag gold'>🔥 fame "+(p.fame||0)+"</span> <span class='tag red'>☠ infamy "+(p.infamy||0)+"</span>"+
    (p.guild? "<div class='tiny muted' style='margin-top:4px'>🤝 "+esc(((DATA.GUILDS||[]).find(g=>g.id===p.guild)||{}).name||"")+"</div>":"")+
    "</div></div>"+
    "<div style='margin-top:8px'><div class='cost-line'><span>XP to level "+((p.level||1)+1)+"</span><b>"+Math.round(p.xp||0)+" / "+Math.round(p.xpToNext||1)+"</b></div>"+
    meter(p.xp||0, p.xpToNext||1, "var(--gold)")+"</div>"+
    "<div class='tiny muted' style='margin-top:4px'>Equipment: +"+eq.quality+" film quality · "+eq.scandalReduction+"% scandal shield"+(eq.xpRate? " · +"+Math.round(eq.xpRate*100)+"% XP rate":"")+"</div>"+
    "<div class='row' style='gap:6px;margin-top:6px;flex-wrap:wrap'>"+
      (p.guild
        ? "<button class='btn btn-xs btn-ghost' data-cs-unguild='1'>Leave "+esc(((DATA.GUILDS||[]).find(g=>g.id===p.guild)||{}).name||"guild")+"</button>"
        : (DATA.GUILDS||[]).filter(g=>g.kinds.includes(t.kind)).map(g=>"<button class='btn btn-xs btn-alt' data-cs-guild='"+g.id+"' title='Weekly dues $"+g.dues+"M · "+esc(g.perk)+"'>Join "+esc(g.name)+"</button>").join(""))+
      ((G.studio.influence||0)>=10 ? "<button class='btn btn-xs btn-primary' data-cs-intensive='1' title='Spend 10 influence on a private masterclass'>🌐 Masterclass (+1000 XP · 10 infl)</button>" : "")+
    "</div></div>";
  const canSpend=(p.skillPoints||0)>0;
  h+="<div class='card' style='margin-top:8px'><div class='spread'><b class='small'>🧬 Attributes</b><span class='tag "+(canSpend?"gold":"")+"'>"+(p.skillPoints||0)+" SP</span></div>";
  (DATA.PROTOTYPE_ATTRIBUTES||[]).forEach(a=>{ h+=csAttrRow(a.id, (p.attributes||{})[a.id]||50, canSpend); });
  h+="<div class='tiny muted'>"+(canSpend? "Spend skill points: +5 to an attribute, or unlock a skill node below." : "Earn XP to level up — each level grants 1 skill point.")+"</div></div>";
  // 3 skill branches with selector
  const branches=skillBranches(t.kind);
  if(branches.length){
    CS.branch = CS.branch && branches.some(b=>b.id===CS.branch) ? CS.branch : branches[0].id;
    const cur=branches.find(b=>b.id===CS.branch);
    h+="<div class='card' style='margin-top:8px'><b class='small'>✨ Skill trees</b>"+
      "<div class='row' style='gap:4px;margin:6px 0'>"+branches.map(b=>
        "<button class='btn btn-xs "+(b.id===CS.branch?"btn-primary":"btn-ghost")+"' data-cs-branch='"+b.id+"'>"+esc(b.name)+"</button>").join("")+"</div>";
    const owned=p.skillTree.nodes||[];
    cur.nodes.forEach(n=>{
      const isOwned=owned.includes(n.id);
      const prereqOk=n.req===0 || (cur.nodes[n.req-1] && owned.includes(cur.nodes[n.req-1].id));
      h+="<div class='cost-line'><span>"+(isOwned?"✅":prereqOk?"🔓":"🔒")+" "+esc(n.name)+"</span>"+
        (isOwned? "<span class='tag green tiny'>Owned</span>"
                : "<button class='btn btn-xs "+(prereqOk&&p.skillPoints>=n.cost?"btn-primary":"btn-ghost")+"' data-cs-node='"+n.id+"'>"+(prereqOk? "Unlock · "+n.cost+" SP" : "Locked")+"</button>")+
        "</div>";
    });
    h+="</div>";
  }
  // Mentorship panel
  h+="<div class='card' style='margin-top:8px'><b class='small'>Mentorship</b>";
  if(p.mentor){
    const m=(G.talent||[]).find(x=>x.id===p.mentor);
    h+="<div class='cost-line'><span>Learning from "+esc(m?m.name:"—")+"</span><button class='btn btn-xs btn-ghost' data-cs-unmentor='1'>End</button></div>"+
      "<div class='tiny muted'>+40 XP/week flows to this talent while the mentorship runs.</div>";
  } else if(p.mentee){
    const j=(G.talent||[]).find(x=>x.id===p.mentee);
    h+="<div class='cost-line'><span>Teaching "+esc(j?j.name:"—")+"</span><button class='btn btn-xs btn-ghost' data-cs-unmentor='1'>End</button></div>"+
      "<div class='tiny muted'>The mentee gains weekly XP; you gain a little and a loyal ally.</div>";
  } else {
    let cands = (G.talent||[]).filter(x=>x.id!==t.id && x.prototype && (x.prototype.level||1)>=(p.level||1)+3 && !x.prototype.mentee);
    h+="<div class='tiny muted' style='margin:4px 0'>Choose a mentor at least three levels above this talent. Each mentor may teach one mentee.</div>"+
      "<div class='row' style='gap:4px'>"+(!cands.length?"<span class='tiny muted'>No eligible mentor available. Train a senior colleague first.</span>":"")+cands.slice(0,3).map(m=>
        "<button class='btn btn-xs btn-alt' data-cs-mentor='"+m.id+"'>Ask "+esc(m.name.split(" ")[0])+" (Lv "+(m.prototype.level||1)+")</button>").join("")+"</div>";
  }
  h+="</div>";
  const ms=p.milestones||[];
  if(ms.length) h+="<div class='tiny muted' style='margin-top:6px'>[MILESTONES] "+ms.length+" milestone"+(ms.length===1?"":"s")+" — see the Story tab.</div>";
  return h;
}

function csEquipHTML(t,p){
  let h="";
  [["weapon","Weapon"],["armor","Armor"],["accessory","Accessory"],["prop","Prop"]].forEach(pair=>{
    const slot=pair[0], label=pair[1];
    const curId=p.equipment[slot];
    const cur=curId? (DATA.PROTOTYPE_EQUIPMENT[slot]||[]).find(i=>i.id===curId) : null;
    h+="<div class='card' style='margin-top:8px'><b class='small'>"+label+"</b>";
    if(cur){
      h+="<div class='cost-line'><span style='color:"+csRarity(cur.rarity).color+"'>"+esc(cur.name)+" <span class='tiny muted'>"+cur.rarity+"</span></span>"+
        "<button class='btn btn-xs btn-ghost' data-cs-unequip='"+slot+"'>Remove</button></div>";
    } else {
      h+="<div class='tiny muted' style='margin:4px 0'>Empty slot — gear up below.</div>";
    }
    (DATA.PROTOTYPE_EQUIPMENT[slot]||[]).forEach(it=>{
      const owned=curId===it.id;
      h+="<div class='cost-line'><span style='color:"+csRarity(it.rarity).color+"'>"+esc(it.name)+"</span>"+
        "<span class='row' style='gap:6px'><span class='tiny muted'>"+csItemStat(it)+"</span>"+
        (owned? "<span class='tag green tiny'>Equipped</span>" : "<button class='btn btn-xs btn-alt' data-cs-equip='"+slot+":"+it.id+"'>Equip</button>")+"</span></div>";
    });
    h+="</div>";
  });
  return h;
}

function csEventsHTML(t,p){
  let h="";
  const evs=(p.events||[]).slice().reverse();
  h+="<div class='card'><b class='small'>Life events</b>"+
    (evs.length? evs.map(e=>"<div class='cost-line'><span>"+(e.icon||"•")+" "+esc(e.desc||e.type)+"</span><b class='tiny muted'>W"+e.week+"</b></div>").join("")
    : "<div class='tiny muted' style='margin-top:4px'>Nothing yet — life events roll each week.</div>")+"</div>";
  // Relationship web
  const rels=Object.entries(p.relationships||{}).map(([id,r])=>({ id:+id, ...r }))
    .map(r=>({ ...r, t:(G.talent||[]).find(x=>x.id===r.id) })).filter(r=>r.t)
    .sort((a,b)=>Math.abs(b.strength)-Math.abs(a.strength)).slice(0,6);
  h+="<div class='card' style='margin-top:8px'><b class='small'>🕸 Relationships</b>"+
    (rels.length? rels.map(r=>{
      const face = r.strength>=5?"🤜🤛 friend": r.strength<=-5?"⚔️ rival": r.strength>0?"🙂 warm": r.strength<0?"😒 frosty":"➖ neutral";
      return "<div class='cost-line'><span>"+face+" "+esc(r.t.name)+"</span><b class='tiny muted'>"+(r.strength>0?"+":"")+r.strength+"</b></div>";
    }).join("")
    : "<div class='tiny muted' style='margin-top:4px'>No bonds yet — ship films together and the web grows.</div>")+"</div>";
  const ms=(p.milestones||[]).slice().reverse();
  h+="<div class='card' style='margin-top:8px'><b class='small'>🏆 Milestones</b>"+
    (ms.length? ms.map(m=>"<div class='cost-line'><span>"+esc(String(m.type||"").replace(/_/g," "))+(m.project?" — "+esc(m.project):"")+"</span><b class='tiny muted'>W"+m.week+"</b></div>").join("")
    : "<div class='tiny muted' style='margin-top:4px'>Ship a film to earn first credits.</div>")+"</div>";
  const hist=(p.history||[]).slice(-8).reverse();
  h+="<div class='card' style='margin-top:8px'><b class='small'>📈 XP log</b>"+
    (hist.length? hist.map(x=>"<div class='cost-line'><span>"+(x.amount>=0?"+":"")+x.amount+" XP"+(x.source?" · "+esc(String(x.source).replace("film:","🎬 ").replace("award:","🏆 ").replace("mentorship:","🧑‍🏫 ")):"")+"</span><b class='tiny muted'>W"+x.week+"</b></div>").join("")
    : "<div class='tiny muted' style='margin-top:4px'>No XP yet.</div>")+"</div>";
  return h;
}

/* ── Game Dev: GDD-driven in-house originals (separate from the v16 adaptation studio) ── */
function gameDevLiteHTML(){
  const PD=G.prototypeData||{};
  if(!PD.gameDevUnlocked){
    return "<div class='card' style='margin-top:8px'><div class='spread'><b>🧪 In-house originals</b><span class='tag'>Locked</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Beyond franchise adaptations: fund an original game from your own studio. Unlocks at rep 40 &amp; $250M cash — you're at rep "+Math.round(G.studio.rep)+" &amp; "+fmtM(G.studio.cash)+".</div></div>";
  }
  let h="<div class='section-title'>🧪 In-house originals</div>";
  const pr=PD.currentProject;
  if(!pr){
    h+="<div class='card'><div class='spread'><div><b>Start an original game</b>"+
      "<div class='tiny muted' style='margin-top:4px'>Write a Game Design Doc: genre × platform × theme × mechanic × business model, then shepherd it through 8 dev phases.</div></div>"+
      "<button class='btn btn-primary' data-pgdev-gdd='1'>🎮 Write GDD</button></div></div>";
  } else {
    const phases=(DATA.PROTOTYPE_GAME_DEV||{}).phases||[];
    const phaseIdx=phases.findIndex(x=>x.id===pr.phase);
    const phaseDef=phases[phaseIdx]||{};
    const pct=Math.round(pr.progress||0);
    const gdef=(DATA.PROTOTYPE_GAME_DEV.genres||[]).find(g=>g.id===pr.genre)||{};
    const pdef=(DATA.PROTOTYPE_GAME_DEV.platforms||[]).find(p=>p.id===pr.platform)||{};
    const mdef=(DATA.PROTOTYPE_GAME_DEV.monetization||[]).find(m=>m.id===pr.monetization)||{};
    h+="<div class='card'><div class='spread'><div><b>🕹 "+esc(pr.title||"Untitled")+"</b> <span class='tag'>"+(gdef.emoji||"")+" "+esc(gdef.name||pr.genre)+"</span> <span class='tag'>"+(pdef.emoji||"")+" "+esc(pdef.name||pr.platform)+"</span> <span class='tag'>"+(mdef.emoji||"")+" "+esc(mdef.name||pr.monetization)+"</span>"+
      "<div class='tiny muted' style='margin-top:4px'>Quality "+Math.round(pr.quality||50)+"/100 · spent "+fmtM(pr.spent||0)+" of "+fmtM(pr.budget||50)+" · team "+((pr.team||[]).length)+"</div></div>"+
      "<span class='tag'>"+pct+"%</span></div>"+
      "<div style='display:flex;gap:3px;margin-top:8px'>"+phases.map((ph,i)=>
        "<div style='flex:1;text-align:center' title='"+esc(ph.name)+"'><div style='height:8px;border-radius:4px;background:"+(i<phaseIdx?"var(--green)":i===phaseIdx?"linear-gradient(90deg,var(--gold),var(--gold2) "+pct+"%,rgba(255,255,255,.08) "+pct+"%)":"rgba(255,255,255,.08)")+"'></div><div class='tiny muted' style='font-size:9px;margin-top:2px'>"+esc(ph.name.split(" ")[0])+"</div></div>").join("")+"</div>";
    if(pct>=100){
      h+="<div class='tiny muted' style='margin-top:8px'><b>Phase gate</b> — pick an approach to move forward:</div>";
      (((DATA.PROTOTYPE_GAME_DEV||{}).phaseChoices||{})[pr.phase]||[]).forEach(def=>{
        h+="<div class='small muted' style='margin-top:6px'><b>"+esc(def.label)+"</b></div><div class='row' style='gap:4px;margin-top:2px'>";
        (def.options||[]).forEach(o=>{ h+="<button class='btn btn-xs btn-alt' data-pgdev-choice='"+o.id+"' title='"+esc(o.desc||"")+"'>"+esc(o.label)+"</button>"; });
        h+="</div>";
      });
    } else {
      h+="<div class='tiny muted' style='margin-top:6px'>"+esc(phaseDef.desc||"In development")+" — advancing weeks makes progress. Choices unlock at 100%.</div>";
    }
    h+="</div>";
  }
  (PD.releasedGames||[]).slice(-5).reverse().forEach(g=>{
    const mdef=(DATA.PROTOTYPE_GAME_DEV.monetization||[]).find(m=>m.id===g.monetization)||{};
    h+="<div class='card'><div class='spread'><div><b>🎮 "+esc(g.title||"Game")+"</b>"+(g.goty?" <span class='tag gold'>🏆 GOTY</span>":"")+" <span class='tag'>"+(mdef.emoji||"")+" "+esc(mdef.name||g.monetization||"")+"</span> <span class='tag'>launched W"+(g.launchedWeek||0)+"</span>"+
      "<div class='tiny muted'>Quality "+(g.quality||0)+"/100 · "+fmtM(g.salesTotal||0)+" earned"+(g.salesLeft>0? " · +"+fmtM(g.weeklyBase||0)+"/wk for "+g.salesLeft+" more wks":" · tail ended")+
      ((g.liveOps||[]).length? " · "+(g.liveOps||[]).length+" live-ops events":"")+"</div></div>"+
      "<div style='font-size:18px;font-weight:700' class='"+((g.quality||0)>=70?"pos":(g.quality||0)<45?"neg":"gold")+"'>"+(g.quality||0)+"/100</div></div></div>";
  });
  return h;
}

/* GDD modal: genre × platform × theme × mechanic × monetization + title + team */
let GDD=null;
function gameDevGDDModal(){
  const GD=DATA.PROTOTYPE_GAME_DEV;
  GDD=GDD||{ genre:"rpg", platform:"pc", theme:"fantasy", mechanic:"narrative", monetization:"premium", title:"", team:[] };
  const g=GD.genres.find(x=>x.id===GDD.genre)||GD.genres[0];
  const p=GD.platforms.find(x=>x.id===GDD.platform)||GD.platforms[0];
  const themeFit=(GD.themes.find(t=>t.id===GDD.theme)||{fit:[]}).fit.includes(GDD.genre);
  const mechFit=(GD.mechanics.find(m=>m.id===GDD.mechanic)||{fit:[]}).fit.includes(GDD.genre);
  const budget=Math.round(50*g.costMult*p.costMult);
  let h="<h3>📋 Game Design Doc</h3>";
  h+="<input type='text' id='gddTitle' placeholder='Working title (optional)' maxlength='40' value='"+esc(GDD.title)+"' style='width:100%;padding:9px 12px;border-radius:10px;background:#0b0f18;border:1px solid var(--line2);color:var(--text);margin-bottom:8px'>";
  h+=gddRow("Genre", GD.genres.map(x=>({id:x.id, label:x.emoji+" "+x.name, title:x.blurb})), "genre");
  h+=gddRow("Platform", GD.platforms.map(x=>({id:x.id, label:x.emoji+" "+x.name, title:"cost ×"+x.costMult+" · reach ×"+x.reach})), "platform");
  h+=gddRow("Theme", GD.themes.map(x=>({id:x.id, label:x.emoji+" "+x.name, title:(x.fit.includes(GDD.genre)?"✓ fits "+g.name:"no synergy")})), "theme");
  h+=gddRow("Core Mechanic", GD.mechanics.map(x=>({id:x.id, label:x.emoji+" "+x.name, title:(x.fit.includes(GDD.genre)?"✓ fits "+g.name:"no synergy")})), "mechanic");
  h+=gddRow("Business Model", GD.monetization.map(x=>({id:x.id, label:x.emoji+" "+x.name, title:x.desc})), "monetization");
  h+="<div class='card' style='margin-top:8px'><div class='cost-line'><span>Dev budget</span><b>"+fmtM(budget)+"</b></div>"+
    "<div class='cost-line'><span>GDD synergy</span><b class='"+(themeFit&&mechFit?"pos":themeFit||mechFit?"gold":"neg")+"'>"+(themeFit?"theme ✓ ":"")+(mechFit?"mechanic ✓":"")+(themeFit&&mechFit?" — strong concept":(themeFit||mechFit)?"partial fit":"no fit — quality will suffer")+"</b></div></div>";
  h+="<div class='card' style='margin-top:8px'><b class='small'>👥 Team</b> <span class='tiny muted'>(pick up to 5 — their RPG stats shape quality)</span>"+
    "<div class='row' style='gap:4px;margin-top:6px;flex-wrap:wrap'>"+(G.talent||[]).slice(0,12).map(t=>
      "<button class='btn btn-xs "+(GDD.team.includes(t.id)?"btn-primary":"btn-ghost")+"' data-gdd-team='"+t.id+"'>"+esc(t.name.split(" ")[0])+" Lv"+((t.prototype||{}).level||1)+"</button>").join("")+"</div></div>";
  h+="<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Cancel</button>"+
    "<button class='btn btn-primary' id='gddGo'>🎮 Greenlight Game</button></div>";
  const v=openModal(h);
  v.querySelector("#gddTitle").oninput=e=>{ GDD.title=e.target.value; };
  v.querySelectorAll("[data-gdd]").forEach(b=>b.onclick=()=>{ GDD[b.dataset.gdd]=b.dataset.gddVal; beep("click"); gameDevGDDModal(); });
  v.querySelectorAll("[data-gdd-team]").forEach(b=>b.onclick=()=>{
    const id=+b.dataset.gddTeam;
    if(GDD.team.includes(id)) GDD.team=GDD.team.filter(x=>x!==id);
    else if(GDD.team.length<5) GDD.team.push(id);
    beep("click"); gameDevGDDModal();
  });
  v.querySelector("#gddGo").onclick=()=>{
    const r=startGameDevProject({...GDD, team: GDD.team});
    if(r.ok){ GDD=null; beep("gold"); flashes(G.flash); closeModal(); render(); }
    else { beep("bad"); if(r.err) toast(r.err,"bad"); }
  };
}
function gddRow(label, options, key){
  return "<div class='small muted' style='margin-top:8px'><b>"+label+"</b></div><div class='row' style='gap:4px;margin-top:2px;flex-wrap:wrap'>"+
    options.map(o=>"<button class='btn btn-xs "+(GDD[key]===o.id?"btn-primary":"btn-ghost")+"' data-gdd='"+key+"' data-gdd-val='"+o.id+"' title='"+esc(o.title||"")+"'>"+esc(o.label)+"</button>").join("")+"</div>";
}

/* ── v27: privacy & data controls (GDPR-style; everything is device-local) ── */
function privacyModal(consent){
  let h="";
  if(consent) h+="<h3>👋 Welcome to Box Office War</h3>";
  else h+="<h3>🔒 Privacy &amp; Your Data</h3>";
  h+="<div class='card'><b class='small'>What we store</b>"+
    "<div class='tiny muted' style='margin-top:4px'>Your saves, settings and game progress live <b>only in this browser</b> (localStorage + optional IndexedDB cloud slot). There are no accounts, no analytics, no trackers, no third-party requests from the game itself.</div></div>"+
    "<div class='card' style='margin-top:8px'><b class='small'>Your controls</b>"+
    "<div class='row' style='gap:6px;margin-top:6px;flex-wrap:wrap'>"+
      "<button class='btn btn-sm btn-alt' id='pvExport'>⬇️ Export all data (JSON)</button>"+
      "<button class='btn btn-sm btn-ghost' id='pvWipe'>🗑️ Delete everything</button>"+
    "</div>"+
    "<div class='tiny muted' style='margin-top:6px'>Export downloads every save slot, setting and slot name as one JSON file. Delete wipes all Box Office War keys from this device and reloads — permanent, so export first.</div></div>"+
    "<div class='tiny muted' style='margin-top:8px'>Playing offline changes nothing: the game never phones home.</div>"+
    "<div class='modal-actions'><button class='btn btn-primary' id='pvOk'>"+(consent? "Got it — let's make movies":"Done")+"</button></div>";
  const v=openModal(h,{noX:!!consent, locked:!!consent});
  v.querySelector("#pvOk").onclick=()=>{ try{ localStorage.setItem("bow_privacy_ok","1"); }catch(e){} closeModal(); if(consent) helpModal(); };
  v.querySelector("#pvExport").onclick=()=>{
    const dump={};
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith("bow_")) dump[k]=localStorage.getItem(k); }
    const blob=new Blob([JSON.stringify(dump,null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="box-office-war-export-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a); a.click(); a.remove();
    toast("⬇️ Data exported — check your downloads.","good"); beep("gold");
  };
  v.querySelector("#pvWipe").onclick=()=>{
    const really=confirm("Delete ALL Box Office War data on this device? This cannot be undone.");
    if(!really) return;
    const keys=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith("bow_")) keys.push(k); }
    keys.forEach(k=>localStorage.removeItem(k));
    if(typeof indexedDB!=="undefined" && indexedDB.deleteDatabase){ try{ indexedDB.deleteDatabase("bow_idb"); }catch(e){} }
    toast("🗑️ All local data deleted.","bad");
    setTimeout(()=>location.reload(), 400);
  };
}

/* ── v28: COPPA age gate ── */
function coppaModal(){
  let h="<h3>👋 Welcome to Box Office War</h3>"+
    "<div class='card'><b class='small'>Age verification required</b>"+
    "<div class='tiny muted' style='margin-top:6px'>This game stores your progress locally in your browser. No accounts, no tracking, no personal data collected. We need to confirm you are 13 or older to continue.</div>"+
    "<div class='row' style='margin-top:10px;gap:8px;flex-wrap:wrap'>"+
      "<button class='btn btn-primary' id='coppaYes'>✅ I am 13 or older</button>"+
      "<button class='btn btn-alt' id='coppaNo'>❌ I am under 13</button>"+
    "</div>"+
    "<div class='tiny muted' style='margin-top:8px'>If you are under 13, please ask a parent or guardian to play with you. No personal data is collected — this check is for COPPA compliance only.</div>"+
    "<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Cancel</button></div>";
  const v=openModal(h,{locked:true});
  v.querySelector("#coppaYes").onclick=()=>{
    try{ localStorage.setItem("bow_coppa_ok","1"); }catch(e){}
    closeModal();
    const consented = localStorage.getItem("bow_privacy_ok")==="1";
    if(consented) helpModal(); else privacyModal(true);
  };
  v.querySelector("#coppaNo").onclick=()=>{
    toast("Please play with a parent or guardian. Game features will be limited.","bad");
    closeModal();
  };
}

/* ═══════════════════════════════════════════════════════════════════
   v30: LIVE BROADCASTING, STREAMING, EVENTS & ANIMATED CHARACTERS
   ═══════════════════════════════════════════════════════════════════ */

/* v34.9 LIVE DESK — one command shell and one navigation across every Live TV
   reading. Every figure is read from G.live / DATA exactly as the engine
   writes it (slot.block, slot.title, ev.type, ev.desc, DATA.LIVE_COSTS);
   the view adds no simulation state or economics of its own. */
const LIVE_SECTIONS = [["home","Home"],["linear","Channels"],["shows","Shows"],["stream","Live Stream"],["events","Events"],["studio","Hosts"]];
let LIVE_EVENT_FILTER = "all"; // view-only calendar filter; never written to the save
const LIVE_STREAM_TOPICS = [["feature_premiere","Feature premiere"],["behind_scenes","Behind the scenes"],["awards_watch","Awards watch"],["sports_desk","Sports desk"],["catalog_marathon","Catalog marathon"]];
const LIVE_STREAM_QUALITIES = ["720p","1080p","4K"];
const LIVE_STRATEGIES = [
  ["prime_movies","Prime Movies","Prime time · 6pm–10pm","Your top-grossing films rotate through the five prime-time hours as Feature Film blocks.","films"],
  ["infomercials","Overnight Infomercials","Overnight · 12am–5am","Paid Programming fills the six overnight hours with sponsor blocks. No library needed.","none"],
  ["library_reruns","Library Reruns","Daytime · 6am–5pm","Series episodes and film encores alternate through the daytime hours from your library.","library"],
  ["full_syndication","Full Syndication","All 24 hours","The whole grid at once: infomercials overnight, films in prime time, series and reruns between.","library"]
];

function liveMoney(v){ v=Number(v)||0; return (v>0 && v<1) ? "$"+v+"M" : fmtM(v); }
function liveSub(){
  const live=G.live||{};
  const want=live.activeSub||live.subTab||"home";
  return LIVE_SECTIONS.some(s=>s[0]===want)?want:"home";
}
function liveStream(){
  const live=G.live||{};
  return live.streaming||live.stream||{};
}
function liveActiveChannels(){ return ((G.live||{}).channels||[]).filter(c=>c.unlocked&&c.active); }
function liveTotals(){
  const act=liveActiveChannels();
  return {
    viewers: act.reduce((s,c)=>s+(c.weeklyViewers||0),0),
    adRev: act.reduce((s,c)=>s+(c.weeklyAdRev||0),0),
    active: act.length,
    unlocked: ((G.live||{}).channels||[]).filter(c=>c.unlocked).length,
    total: ((G.live||{}).channels||[]).length
  };
}
function liveHostDef(){ const live=G.live||{}; return DATA.liveHost(live.activeHost||"rex")||(DATA.LIVE_HOSTS&&DATA.LIVE_HOSTS[0])||null; }
function liveHostStats(id){ return (((G.live||{}).hosts||{})[id])||{level:1,xp:0,charisma:75,energy:90}; }
function liveHostStage(host){
  if(!host) return "<div class='live-note'>No host active on stage</div>";
  if(host.id==="rex") return renderCharRex();
  if(host.id==="chloe") return renderCharChloe();
  if(host.id==="buck") return renderCharBuck();
  return renderCharReely();
}
function liveTitleOf(id){
  const f=(G.films||[]).find(x=>x.id===id)||(G.projects||[]).find(x=>x.id===id)||(G.series||[]).find(x=>x.id===id);
  return f?f.title:null;
}
function liveWeeksAway(ev){
  if(!ev||!ev.week) return null;
  return (ev.week - woyOf(G.week) + 52) % 52;
}
function liveNextEvent(){
  const dated=(DATA.LIVE_EVENTS||[]).filter(e=>e.week>0)
    .map(e=>({ev:e,away:liveWeeksAway(e)})).sort((a,b)=>a.away-b.away);
  return dated[0]||null;
}
function livePrimeProgrammed(ch){
  const prog=["movie","double_feature","marathon","series","live_event","special"];
  return (ch.schedule||[]).filter(s=>s.hour>=18&&s.hour<=22&&(s.contentId||prog.includes(s.block))).length;
}
function liveHead(){
  const w=woyOf(G.week), m=DATA.seasonOf(w);
  return `<header class="command-heading"><div><span class="command-edition">LIVE DESK / YEAR ${yearOf(G.week)}</span><span class="command-eyebrow">BROADCAST / SHOWS / STREAM / EVENTS / HOSTS</span><h1>The broadcast command desk.</h1><p>Broadcast &amp; Live Entertainment Network — channels, the 24-hour grid, the live stream, the event calendar and your on-air hosts — every broadcast decision in one place.</p></div><div class="command-date"><span>WEEK</span><b>${String(w).padStart(2,"0")}</b><small>${esc(m.month)}</small></div></header>`;
}
function liveNav(){
  const active=liveSub();
  return `<nav class="command-section-nav command-live-nav" aria-label="Live desk sections"><div class="command-nav-brand"><span>LIVE DESK</span><small>HOME / CHANNELS / SHOWS / STREAM / EVENTS / HOSTS</small></div><div class="command-nav-items">${LIVE_SECTIONS.map(([key,label],i)=>{
    const icon=getSubTabPixelIcon("live",key);
    return `<button data-livesub="${key}" class="${active===key?"active":""}" aria-current="${active===key?"page":"false"}"><small>0${i+1}</small>${icon?`<img class="subtab-pixel-icon" src="${icon}" alt="" />`:""}<span>${label}</span></button>`;
  }).join("")}</div></nav>`;
}
function liveTelemetry(){
  const t=liveTotals(), stream=liveStream(), onAir=!!stream.live, host=liveHostDef();
  const hs=host?liveHostStats(host.id):{level:1};
  return `<div class="command-telemetry">${commandMetric("LINEAR REACH / WEEK",t.viewers>0?t.viewers.toFixed(1)+"M":"0M",t.active+" active channel"+(t.active===1?"":"s"))}${commandMetric("LINEAR AD REVENUE / WEEK",fmtM(t.adRev),"Before weekly operating costs settle")}${commandMetric("LIVE STREAM",onAir?"ON AIR · "+(stream.ccv||0)+"M CCV":"OFF AIR",onAir?esc(stream.quality||"1080p")+" · "+esc(stream.topic||"feature_premiere"):"Start it from the Live Stream desk")}${commandMetric("ACTIVE HOST",host?esc(host.name):"—",host?"Level "+(hs.level||1)+" · "+esc(host.role||""):"No host selected")}</div>`;
}
function livePanel(eyebrow,title,description,content,stamp,cls){
  return `<section class="produce-panel ${cls||""}"><div class="produce-panel-head"><div><span class="command-eyebrow">${eyebrow}</span><h2>${title}</h2>${description?`<p>${description}</p>`:""}</div>${stamp?`<div class="live-panel-aside">${stamp}</div>`:""}</div><div class="live-panel-body">${content}</div></section>`;
}
function liveEmpty(title,copy,action){
  return `<div class="live-empty"><b>${title}</b><p>${copy}</p>${action||""}</div>`;
}
function liveKpis(items){
  return `<div class="live-kpis">${items.map(([k,v,n])=>`<div class="live-kpi"><small>${k}</small><b>${v}</b><span>${n}</span></div>`).join("")}</div>`;
}

function viewLive(){
  if(typeof ensureLiveState==="function") ensureLiveState(G);
  const active=liveSub();
  let body="";
  if(active==="linear") body=viewLiveLinear();
  else if(active==="shows") body=viewLiveShows();
  else if(active==="stream") body=viewLiveStream();
  else if(active==="events") body=viewLiveEvents();
  else if(active==="studio") body=viewLiveStudio();
  else body=viewLiveHome();
  return `<section class="command-deck command-produce command-live">${liveHead()}${liveNav()}${liveTelemetry()}${body}</section>`;
}

/* ── C1 · Broadcast home ── */
function viewLiveHome(){
  const live=G.live||{}, t=liveTotals(), stream=liveStream(), host=liveHostDef();
  const stats=live.stats||{}, evs=live.events||{submissions:{},premieres:[]};
  const next=liveNextEvent();
  const subs=Object.entries(evs.submissions||{});
  const prems=evs.premieres||[];
  const kpis=liveKpis([
    ["CHANNELS",t.unlocked+" / "+t.total+" unlocked",t.active+" broadcasting now"],
    ["LINEAR REACH",t.viewers>0?t.viewers.toFixed(1)+"M / wk":"0M / wk","Summed weekly viewers, active channels"],
    ["AD REVENUE",fmtM(t.adRev)+" / wk","Before operating costs settle weekly"],
    ["LIVE STREAM",stream.live?"ON AIR":"OFF AIR",stream.live?(stream.ccv||0)+"M CCV · peak "+(stream.peakCcv||0)+"M":"No broadcast running"],
    ["ACTIVE HOST",host?esc(host.name):"—",host?"Level "+(liveHostStats(host.id).level||1):"Pick one in Hosts"],
    ["NEXT LIVE EVENT",next?esc(next.ev.name):"—",next?(next.away===0?"Happening this week":"In "+next.away+" wk · week "+next.ev.week):"No dated events"],
    ["SHOWS ON AIR",String((live.shows||[]).filter(x=>x.status==="active").length),(function(){const top=(live.shows||[]).filter(x=>x.status==="active").sort((a,b)=>(b.lastRating||0)-(a.lastRating||0))[0];return top?"Top: "+esc(top.name)+(top.lastRating?" · rating "+top.lastRating:""):"Develop one in Shows";})()]
  ]);
  const pendingRows=[
    ...subs.map(([festId,filmId])=>{
      const ev=DATA.liveEvent(festId);
      return `<div class="live-row"><div><b>${esc(liveTitleOf(filmId)||"Submitted film")}</b><small>Festival submission · ${esc(ev?ev.name:festId)}${ev?" · week "+ev.week:""}</small></div><span class="live-chip">PENDING</span></div>`;
    }),
    ...prems.map(pr=>`<div class="live-row"><div><b>${esc(liveTitleOf(pr.filmId)||"Premiere film")}</b><small>Red carpet premiere · ${esc(String(pr.city||"la").toUpperCase())} · broadcasts on the next weekly tick</small></div><span class="live-chip">SCHEDULED</span></div>`)
  ].join("");
  const pending=pendingRows
    ? `<div class="live-rows">${pendingRows}</div>`
    : liveEmpty("Nothing in the pending tray.","Festival submissions and scheduled premieres queue here until their week arrives. Enter a film from the Events desk to see one tracked live.");
  const lifetime=liveKpis([
    ["BROADCAST PROFIT BANKED",fmtM(stats.totalBroadcastRev||0),"Lifetime net broadcast revenue kept by weekly ticks"],
    ["CUMULATIVE WEEKLY VIEWERS",((stats.totalViewersReached||0)).toFixed(1)+"M","Each week's reach added up over the whole career"],
    ["AWARDS WON",String(stats.awardsWon||0),"Via live awards broadcasts"],
    ["FESTIVALS WON",String(stats.festivalsWon||0),"Grand Jury wins from submissions"],
    ["PREMIERES HOSTED",String(stats.premieresHosted||0),"Red carpet galas staged"]
  ]);
  const guidance=[];
  if(!(G.films||[]).length && !(G.series||[]).length)
    guidance.push("Your library is empty: schedule strategies need released films or series. Until then the grid runs its default syndicated blocks.");
  if(!t.unlocked) guidance.push("No channel is unlocked yet — open Channels to launch your first network.");
  if(!stream.live) guidance.push("The live stream is off air. Going live earns weekly stream ad revenue and can convert viewers into streamer subscribers.");
  const guide=guidance.length?`<div class="live-guide">${guidance.map(g=>`<p>${g}</p>`).join("")}</div>`:"";
  const jumps=`<div class="live-jumps"><button class="produce-ghost" data-live-goto="linear">Open channels &amp; the grid</button><button class="produce-ghost" data-live-goto="stream">Open the stream control room</button><button class="produce-ghost" data-live-goto="events">Open the event calendar</button><button class="produce-ghost" data-live-goto="studio">Open the host studio</button></div>`;
  return livePanel("BROADCAST HOME","Broadcast home","The whole network at a glance — channels, reach, the stream, your host, and everything waiting in the pending tray.",kpis+guide+jumps,"WEEK "+woyOf(G.week),"live-home")
    + livePanel("PENDING TRAY","Pending submissions & premieres","Queued with the engine now; each resolves when its week or broadcast tick arrives.",pending,(subs.length+prems.length)+" PENDING","live-pending")
    + livePanel("LIFETIME RECORD","Lifetime broadcast record","Career totals from live.stats, labelled for exactly what the weekly ticks accumulate.",lifetime,"CAREER","live-lifetime");
}

/* ── C2/C3/C4/C10 · Channels desk ── */
function liveChannelCard(c){
  const def=DATA.liveChannel(c.id)||{};
  const live=G.live||{};
  const selected=c.id===(live.activeChannel||"bow_movies");
  const state=!c.unlocked?"LOCKED":(c.active?"ON AIR":"OFF-AIR");
  const canUnlock=G.studio.cash>=(def.cost||0);
  const figs=!c.unlocked
    ? `<div><dt>Unlock cost</dt><dd>${fmtM(def.cost||0)}</dd></div><div><dt>Base viewers</dt><dd>${def.baseViewers||0}M</dd></div><div><dt>Ad rate</dt><dd>${def.adRate||0}</dd></div>`
    : `<div><dt>Viewers / wk</dt><dd>${(c.weeklyViewers||0).toFixed(1)}M</dd></div><div><dt>Ad revenue / wk</dt><dd>${fmtM(c.weeklyAdRev||0)}</dd></div><div><dt>Operating cost</dt><dd>${fmtM(c.operatingCost||0)}</dd></div><div><dt>Prime programmed</dt><dd>${livePrimeProgrammed(c)} / 5</dd></div>`;
  const actions=[`<button class="${selected?"produce-action":"produce-ghost"}" data-live-ch="${c.id}">${selected?"Selected — schedule below":"Open schedule"}</button>`];
  if(!c.unlocked) actions.push(`<button class="produce-ghost" data-live-unlock="${c.id}" ${canUnlock?"":"disabled"}>Unlock (${fmtM(def.cost||0)})</button>`);
  else actions.push(`<button class="produce-ghost" data-live-toggle="${c.id}">${c.active?"Pause broadcast":"Resume broadcast"}</button>`);
  return `<article class="live-channel ${selected?"selected":""}">
    <header><b>${esc(def.emoji||"")} ${esc(def.name||c.id)}</b><span class="live-chip ${c.unlocked&&c.active?"on":""}">${state}</span></header>
    <p>${esc(def.desc||"")}</p>
    <dl><div><dt>Type</dt><dd>${esc(def.type||"general")}</dd></div>${figs}</dl>
    <footer>${actions.join("")}</footer>
  </article>`;
}
function liveStrategyDesk(ch){
  const films=(G.films||[]).length, series=(G.series||[]).length;
  const cards=LIVE_STRATEGIES.map(([id,name,daypart,desc,needs])=>{
    const needCopy=needs==="films"?films+" film"+(films===1?"":"s")+" in library":needs==="library"?films+" films · "+series+" series in library":"No library needed";
    const starved=(needs==="films"&&!films)||(needs==="library"&&!films&&!series&&id!=="full_syndication");
    return `<article class="live-strategy"><header><b>${name}</b><span class="live-chip">${esc(daypart)}</span></header><p>${desc}</p><small>${needCopy}${starved?" — this strategy cannot change the grid yet":""}</small><button class="produce-ghost" data-live-autofill="${ch.id}:${id}">Run on ${esc((DATA.liveChannel(ch.id)||{}).name||ch.id)}</button></article>`;
  }).join("");
  const controls=`<div class="live-controls"><button class="produce-ghost" data-live-toggle="${ch.id}">${ch.active?"Pause broadcast":"Resume broadcast"}</button><button class="produce-ghost" data-live-clear="${ch.id}">Clear Grid…</button><span>Clear replaces all 24 slots with Network Off-Air Filler and asks first.</span></div>`;
  return livePanel("SCHEDULE STRATEGY","Schedule strategy desk","The four auto-fill strategies autoFillSchedule actually implements — each card names the daypart it rewrites. A run only reports success when the grid really changes.",controls+`<div class="live-strategies">${cards}</div>`,"4 STRATEGIES","live-strategies-panel");
}
function liveEpg(ch){
  const rows=[];
  for(let hour=0;hour<24;hour++){
    const slot=(ch.schedule||[])[hour]||{hour,block:"rerun",contentId:null,title:null,sponsor:null,rating:null};
    const meta=(DATA.CHANNEL_SLOTS||[]).find(s=>(s.hour===hour||s.h===hour))||{label:hour+":00",weight:1,mult:1,prime:false,isPrimeTime:false};
    const block=(DATA.PROGRAM_BLOCKS||[]).find(b=>b.id===slot.block)||{label:"General Broadcast",name:"General Broadcast",adTier:1,dur:1};
    let quality=null;
    if(slot.contentId){
      const f=(G.films||[]).find(x=>x.id===slot.contentId);
      if(f) quality=(f.quality&&f.quality.overall)||null;
    }
    const prime=!!(meta.prime||meta.isPrimeTime);
    const bits=[esc(block.label||block.name||slot.block), (block.dur||1)+"h block", "ad tier "+(block.adTier!=null?block.adTier:1)+"×"];
    if(slot.sponsor) bits.push(esc(slot.sponsor));
    if(slot.rating!=null) bits.push("★"+slot.rating);
    if(quality!=null) bits.push("Q "+quality);
    rows.push(`<div class="live-epg-row ${prime?"prime":""}"><div class="live-epg-time"><b>${esc(meta.label||meta.name||hour+":00")}</b>${prime?'<span class="live-chip on">PRIME</span>':""}<small>weight ×${(meta.weight!=null?meta.weight:meta.mult||1).toFixed(2)}</small></div><div class="live-epg-main"><b>${esc(slot.title||"Syndicated Block")}</b><span>${bits.join(" · ")}</span></div><button class="produce-ghost" data-live-slot="${ch.id}:${hour}">Edit</button></div>`);
  }
  return `<div class="live-epg">${rows.join("")}</div>`;
}
function liveLedger(){
  const channels=((G.live||{}).channels||[]);
  const sponsors={};
  let paidTotal=0;
  const paidRows=channels.map(ch=>{
    const def=DATA.liveChannel(ch.id)||{};
    let paid=0;
    (ch.schedule||[]).forEach(s=>{
      if(s.sponsor) sponsors[s.sponsor]=(sponsors[s.sponsor]||0)+1;
      if(s.block==="infomercial") paid++;
    });
    paidTotal+=paid;
    return `<div class="live-row"><div><b>${esc(def.name||ch.id)}</b><small>${ch.unlocked?(ch.active?"On air":"Off-air"):"Locked"}</small></div><span>${paid} paid-programming slot${paid===1?"":"s"}</span></div>`;
  }).join("");
  const sponsorRows=Object.entries(sponsors).sort((a,b)=>b[1]-a[1])
    .map(([name,n])=>`<div class="live-row"><div><b>${esc(name)}</b><small>Sponsor currently in your schedules</small></div><span>${n} slot${n===1?"":"s"}</span></div>`).join("")
    || liveEmpty("No sponsors on the grid.","Schedule prime-time or paid-programming blocks and the engine attaches sponsors to those slots.");
  const tv=DATA.AD_INVENTORY&&DATA.AD_INVENTORY.tv||{}, streaming=DATA.AD_INVENTORY&&DATA.AD_INVENTORY.streaming||{};
  const rateRows=[
    ...Object.entries(tv).map(([k,v])=>`<div class="live-row"><div><b>TV · ${esc(k)}</b><small>Reference rate card</small></div><span>base ${fmtM(v.base||0)} · prime ×${v.primeMult||1}</span></div>`),
    ...Object.entries(streaming).map(([k,v])=>`<div class="live-row"><div><b>Streaming · ${esc(k)}</b><small>Reference rate card</small></div><span>base ${fmtM(v.base||0)} · CPM ${v.cpm||0}</span></div>`)
  ].join("");
  const windows=((DATA.RIGHTS_MARKET||{}).windows||[]).map(win=>`<div class="live-row"><div><b>${esc(win.name)}</b><small>${esc(win.desc||"")}</small></div><span>opens wk ${win.weeks} · ×${win.mult}</span></div>`).join("");
  const genrePremium=Object.entries((DATA.RIGHTS_MARKET||{}).genrePremium||{}).map(([g,m])=>`${esc(g)} ×${m}`).join(" · ");
  const participation=(DATA.EVENT_PARTICIPATION||[]).map(p=>`<div class="live-row"><div><b>${esc(p.label)}</b><small>${esc(p.desc||"")}</small></div><span>cost ×${p.costMult} · ${esc(p.revenue||"")}</span></div>`).join("");
  const body=`<p class="live-note"><b>Reference only.</b> Nothing is bought or sold from this ledger — it reads the sponsors your schedules already carry and the static DATA rate cards. Actual weekly ad revenue still settles in tickLiveBroadcasting.</p>`
    +`<h3 class="live-subhead">Sponsors on air now</h3><div class="live-rows">${sponsorRows}</div>`
    +`<h3 class="live-subhead">Paid programming by channel (${paidTotal} slots)</h3><div class="live-rows">${paidRows}</div>`
    +`<h3 class="live-subhead">Ad inventory rate cards (DATA)</h3><div class="live-rows">${rateRows}</div>`
    +`<h3 class="live-subhead">Rights windows (DATA)</h3><div class="live-rows">${windows}</div>${genrePremium?`<p class="live-note">Genre premiums: ${genrePremium}</p>`:""}`
    +`<h3 class="live-subhead">Event participation (DATA)</h3><div class="live-rows">${participation}</div>`;
  return livePanel("REFERENCE LEDGER","Sponsor, ad & rights reference ledger","What your grid already carries, plus the published rate cards — clearly separated from anything you can buy.",body,"READ-ONLY","live-ledger");
}
function viewLiveLinear(){
  const live=G.live||{};
  const channels=live.channels||[];
  const activeId=live.activeChannel||(channels[0]&&channels[0].id)||"bow_movies";
  const ch=channels.find(c=>c.id===activeId)||channels[0];
  const portfolio=livePanel("CHANNEL PORTFOLIO","Channel portfolio desk","Every network side by side — real type, state, unlock cost and weekly performance. Selecting a channel opens its actual schedule below.",
    channels.length?`<div class="live-channels">${channels.map(liveChannelCard).join("")}</div>`:liveEmpty("No channels exist yet.","Channel state initialises with your career; if this persists, the live state failed to load."),
    channels.filter(c=>c.unlocked).length+" / "+channels.length+" UNLOCKED","live-portfolio");
  if(!ch) return portfolio+liveLedger();
  const def=DATA.liveChannel(ch.id)||{};
  if(!ch.unlocked){
    return portfolio
      + livePanel("24-HOUR GRID","24-Hour Electronic Program Guide",esc(def.name||ch.id)+" is locked.",liveEmpty("This network is locked.",`Unlock ${esc(def.name||ch.id)} for ${fmtM(def.cost||0)} from the portfolio above to open its 24-hour program grid.`),"LOCKED","live-epg-panel")
      + liveLedger();
  }
  return portfolio
    + liveStrategyDesk(ch)
    + livePanel("24-HOUR GRID","24-Hour Electronic Program Guide",`The live grid for ${esc(def.name||ch.id)} — block, title, sponsor and rating exactly as the engine stores them. Edit any hour to reprogram it.`,liveEpg(ch),esc((def.name||ch.id).toUpperCase()),"live-epg-panel")
    + liveLedger();
}

/* ── D · Develop-a-Show lab ── */
let LIVE_SHOW_DRAFT = { format:"talk", theme:"cinema", host:"rex", set:"livingroom", audience:"adults", tier:"standard", sponsor:"none", channel:"bow_movies", hour:20 };
function liveShowMeter(label, val){
  const v=Math.max(0,Math.min(99,Number(val)||0));
  return `<div class="live-meter"><div><span>${label}</span><span>${Math.round(v)}</span></div><i role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="99" aria-valuenow="${Math.round(v)}"><b style="width:${v.toFixed(0)}%"></b></i></div>`;
}
function liveShowField(label, field, options){
  return `<label class="live-field">${label}<select data-show-field="${field}">${options}</select></label>`;
}
function liveShowLab(){
  const d=LIVE_SHOW_DRAFT;
  const rep=G.studio.rep||0;
  const lock=def=>def.minRep&&rep<def.minRep;
  const fmtOpts=(DATA.SHOW_FORMATS||[]).map(f=>`<option value="${f.id}" ${d.format===f.id?"selected":""} ${lock(f)?"disabled":""}>${esc(f.label)}${lock(f)?" — 🔒 Rep "+f.minRep:""}</option>`).join("");
  const themeOpts=(DATA.SHOW_THEMES||[]).map(t=>`<option value="${t.id}" ${d.theme===t.id?"selected":""}>${esc(t.label)} · Lv.${showCraftLevel("themes",t.id)}</option>`).join("");
  const hostOpts=(DATA.LIVE_HOSTS||[]).map(h=>{const s=liveHostStats(h.id);return `<option value="${h.id}" ${d.host===h.id?"selected":""}>${esc(h.name)} — ${esc(h.specialty||"")} · Lv.${s.level||1} · Cha ${s.charisma||75}</option>`;}).join("");
  const setOpts=(DATA.SHOW_SETS||[]).map(st=>`<option value="${st.id}" ${d.set===st.id?"selected":""} ${lock(st)?"disabled":""}>${esc(st.label)}${st.cost?" · +"+liveMoney(st.cost):" · included"}${lock(st)?" — 🔒 Rep "+st.minRep:""}</option>`).join("");
  const audOpts=(DATA.SHOW_AUDIENCES||[]).map(a=>`<option value="${a.id}" ${d.audience===a.id?"selected":""}>${esc(a.label)}</option>`).join("");
  const tierOpts=(DATA.SHOW_TIERS||[]).map(t=>`<option value="${t.id}" ${d.tier===t.id?"selected":""} ${lock(t)?"disabled":""}>${esc(t.label)} — dev ${liveMoney(t.dev)} · ${liveMoney(t.epCost)}/ep${lock(t)?" — 🔒 Rep "+t.minRep:""}</option>`).join("");
  const sponOpts=(DATA.SHOW_SPONSORS||[]).map(sp=>`<option value="${sp.id}" ${d.sponsor===sp.id?"selected":""} ${lock(sp)?"disabled":""}>${esc(sp.label)}${sp.bonus?" · +"+liveMoney(sp.bonus)+" up front · −"+sp.penalty+" rating":""}${lock(sp)?" — 🔒 Rep "+sp.minRep:""}</option>`).join("");
  const chOpts=((G.live||{}).channels||[]).map(c=>{const def=DATA.liveChannel(c.id)||{};return `<option value="${c.id}" ${d.channel===c.id?"selected":""} ${c.unlocked?"":"disabled"}>${esc(def.name||c.id)}${c.unlocked?(c.active?"":" · off-air"):" — locked "+fmtM(def.cost||0)}</option>`;}).join("");
  const hourOpts=(DATA.CHANNEL_SLOTS||[]).map(s=>`<option value="${s.hour}" ${Number(d.hour)===s.hour?"selected":""}>${esc(s.label)}${s.prime?" · PRIME":""} · ×${(s.mult||1).toFixed(2)}</option>`).join("");
  const preview=(typeof scoreShowConcept==="function")?scoreShowConcept({...d,hour:Number(d.hour)}):null;
  const ch=(getLiveChannel?getLiveChannel(d.channel):null);
  const canCreate=!!(preview&&preview.ok&&ch&&ch.unlocked&&G.studio.cash>=preview.totalDev);
  const previewHtml=preview?`<aside class="live-show-preview">
      <header><b>Concept preview</b><span class="live-chip ${preview.synergy==="Perfect combo"?"on":""}">${esc(preview.synergy||"")}</span></header>
      ${liveShowMeter("Concept (format × theme"+(preview.craftBonus?" · +"+preview.craftBonus+" mastery":"")+")",preview.concept)}
      ${liveShowMeter("Cast"+(preview.bestHost?" · born for this format":""),preview.cast)}
      ${liveShowMeter("Production ("+esc(preview.setLabel||"")+")",preview.production)}
      ${liveShowMeter("Audience fit",preview.audienceFit)}
      <div class="live-show-appeal"><span>APPEAL</span><b>${preview.appeal}</b></div>
      <dl>
        <div><dt>Development</dt><dd>${liveMoney(preview.totalDev)}</dd></div>
        <div><dt>Sponsor up front</dt><dd>${preview.sponsorBonus?"+"+liveMoney(preview.sponsorBonus):"—"}</dd></div>
        <div><dt>Episode cost</dt><dd>${liveMoney(preview.epCost)} / wk</dd></div>
        <div><dt>Season</dt><dd>12 episodes</dd></div>
      </dl>
      ${preview.reason?`<p class="live-note">🔒 ${esc(preview.reason)}</p>`:""}
      ${ch&&!ch.unlocked?`<p class="live-note">That channel is locked — unlock it in Channels first.</p>`:""}
      ${G.studio.cash<preview.totalDev?`<p class="live-note">Not enough cash — development needs ${liveMoney(preview.totalDev)}.</p>`:""}
    </aside>`:"";
  const form=`<div class="live-show-form">
    ${liveShowField("Format (genre)","format",fmtOpts)}
    ${liveShowField("Theme","theme",themeOpts)}
    ${liveShowField("Host / star","host",hostOpts)}
    ${liveShowField("Studio set","set",setOpts)}
    ${liveShowField("Target audience","audience",audOpts)}
    ${liveShowField("Production tier","tier",tierOpts)}
    ${liveShowField("Sponsor deal","sponsor",sponOpts)}
    ${liveShowField("Channel","channel",chOpts)}
    ${liveShowField("Time slot","hour",hourOpts)}
    <label class="live-field live-field-wide">Show name (blank = auto-name)<input id="liveShowName" type="text" maxlength="40" placeholder="e.g. Harbor Tonight" /></label>
  </div>
  <div class="live-show-create-row"><button class="produce-action" data-live-show-create="1" ${canCreate?"":"disabled"}>🎬 Develop show (${preview?liveMoney(preview.totalDev):"—"})</button><span>One episode airs every broadcast week on an active channel. Prime slots earn the most — and draw a rival show.</span></div>`;
  return livePanel("SHOW LAB","Develop a show","The TV Studio Story loop, BOW-style: pair a format with a theme it loves, cast the right host, dress the right set, pick your audience — then fight for ratings in a real slot on your grid.",
    `<div class="live-show-lab"><div>${form}</div>${previewHtml}</div>`,"12-EP SEASONS","live-show-lab-panel");
}
function liveShowCard(show){
  const fmt=DATA.showFormat(show.format)||{}, th=DATA.showTheme(show.theme)||{}, host=DATA.liveHost(show.host)||{};
  const chDef=DATA.liveChannel(show.channel)||{};
  const slotMeta=(DATA.CHANNEL_SLOTS||[])[show.hour]||{};
  const tier=DATA.showTier(show.tier)||{dev:3}, set=DATA.showSet(show.set)||{cost:0};
  const renewCost=Math.round((tier.dev+(set.cost||0))*0.5*10)/10;
  const profit=Math.round(((show.lifetimeRevenue||0)-(show.lifetimeCost||0))*10)/10;
  const statusChip={active:["ON AIR","on"],resting:["BETWEEN SEASONS",""],unscheduled:["UNSCHEDULED",""],cancelled:["CANCELLED",""]}[show.status]||[String(show.status||"").toUpperCase(),""];
  const bars=(show.history||[]).slice(-8).map(h=>`<i title="Rating ${h.rating} · ${h.viewers}M" style="height:${Math.max(8,h.rating)}%"></i>`).join("");
  const actions=[`<button class="produce-ghost" data-live-show-view="${show.id}">View in grid</button>`];
  if(show.status==="resting") actions.push(`<button class="produce-action" data-live-show-renew="${show.id}" ${G.studio.cash>=renewCost?"":"disabled"}>Renew S${show.season+1} (${liveMoney(renewCost)})</button>`);
  if(show.status==="unscheduled") actions.push(`<button class="produce-action" data-live-show-reschedule="${show.id}">Back into ${esc(slotMeta.label||show.hour+":00")} slot</button>`);
  if(show.status!=="cancelled") actions.push(`<button class="produce-ghost" data-live-show-cancel="${show.id}">Cancel…</button>`);
  return `<article class="live-show ${show.status==="cancelled"?"cancelled":""}">
    <header><b>${esc(show.name)}</b><span class="live-chip ${statusChip[1]}">${statusChip[0]}</span></header>
    <p>${esc(fmt.label||show.format)} × ${esc(th.label||show.theme)} · ${esc(host.name||show.host)} · ${esc(chDef.name||show.channel)} ${esc(slotMeta.label||show.hour+":00")}${slotMeta.prime?" · PRIME":""}</p>
    <div class="live-meter"><div><span>Season ${show.season} episodes</span><span>${show.episode} / 12</span></div><i><b style="width:${Math.min(100,show.episode/12*100).toFixed(0)}%"></b></i></div>
    <dl>
      <div><dt>Appeal</dt><dd>${show.scores?show.scores.appeal:0}</dd></div>
      <div><dt>Popularity</dt><dd>${Math.round(show.popularity||0)}</dd></div>
      <div><dt>Last rating</dt><dd>${show.lastRating?show.lastRating+" · "+show.lastViewers+"M":"—"}</dd></div>
      <div><dt>Fans</dt><dd>${(show.fans||0).toFixed(2)}M</dd></div>
      <div><dt>Last episode</dt><dd>${show.episode?liveMoney(show.lastRevenue||0)+" − "+liveMoney(show.lastCost||0):"airs next week"}</dd></div>
      <div><dt>Lifetime</dt><dd>${profit>=0?"+":"−"}${liveMoney(Math.abs(profit))}</dd></div>
    </dl>
    ${slotMeta.prime&&show.rival?`<p class="live-show-rival">⚔ Rival: “${esc(show.rival.name)}” (strength ${show.rival.strength}) — winning ${show.rival.wins||0}/${show.rival.battles||0} slot battles</p>`:""}
    ${bars?`<div class="live-show-bars" aria-label="Recent episode ratings">${bars}</div>`:""}
    <footer>${actions.join("")}</footer>
  </article>`;
}
function liveShowRoster(){
  const all=((G.live||{}).shows||[]);
  const order={active:0,resting:1,unscheduled:2,cancelled:3};
  const sorted=all.slice().sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||(b.lastRating||0)-(a.lastRating||0));
  const onAir=all.filter(s=>s.status==="active").length;
  return livePanel("ON AIR","Your shows","Every original programme you have developed — ratings, fans, money and the rival across the street. Seasons run 12 episodes; renew the hits, cancel the flops.",
    sorted.length?`<div class="live-shows">${sorted.map(liveShowCard).join("")}</div>`:liveEmpty("No original shows yet.","Use the Show Lab above: pick a format your host was born for, a theme it loves, and a prime-time slot. Your first hit starts paying for the second."),
    onAir+" ON AIR","live-shows-panel");
}
function liveComboCodex(){
  const rep=G.studio.rep||0;
  const fmtRows=(DATA.SHOW_FORMATS||[]).map(f=>{
    const locked=f.minRep&&rep<f.minRep;
    const loves=(f.loves||[]).map(t=>esc((DATA.showTheme(t)||{}).label||t)).join(", ");
    return `<div class="live-row"><div><b>${esc(f.label)}</b><small>${esc(f.desc||"")} · loves: ${loves}</small></div><span>${locked?"🔒 Rep "+f.minRep:"Lv."+showCraftLevel("formats",f.id)+" mastery"}</span></div>`;
  }).join("");
  const themeChips=(DATA.SHOW_THEMES||[]).map(t=>`<span class="live-chip">${esc(t.label)} · Lv.${showCraftLevel("themes",t.id)}</span>`).join(" ");
  const setRows=(DATA.SHOW_SETS||[]).map(st=>{
    const locked=st.minRep&&rep<st.minRep;
    const loves=(st.loves||[]).map(f=>esc((DATA.showFormat(f)||{}).label||f)).join(", ");
    return `<div class="live-row"><div><b>${esc(st.label)}</b><small>${esc(st.desc||"")} · built for: ${loves}</small></div><span>${locked?"🔒 Rep "+st.minRep:(st.cost?"+"+liveMoney(st.cost):"included")}</span></div>`;
  }).join("");
  const body=`<p class="live-note">Mastery is earned by making television: every episode aired adds format and theme XP (Lv.5 max), and higher mastery lifts the concept score of future shows.</p>`
    +`<h3 class="live-subhead">Formats &amp; the themes they love</h3><div class="live-rows">${fmtRows}</div>`
    +`<h3 class="live-subhead">Theme mastery</h3><div class="live-theme-chips">${themeChips}</div>`
    +`<h3 class="live-subhead">Studio sets</h3><div class="live-rows">${setRows}</div>`;
  return livePanel("COMBO CODEX","Combo codex","What loves what, what is still locked, and how polished your studio has become at each format and theme.",body,"REFERENCE","live-codex");
}
function viewLiveShows(){
  return liveShowLab()+liveShowRoster()+liveComboCodex();
}

/* ── C5 · Live stream control room ── */
function viewLiveStream(){
  const stream=liveStream(), onAir=!!stream.live, host=liveHostDef();
  const topic=stream.topic||"feature_premiere", quality=stream.quality||"1080p";
  const topics=LIVE_STREAM_TOPICS.some(t=>t[0]===topic)?LIVE_STREAM_TOPICS:[[topic,topic],...LIVE_STREAM_TOPICS];
  const qualities=LIVE_STREAM_QUALITIES.includes(quality)?LIVE_STREAM_QUALITIES:[quality,...LIVE_STREAM_QUALITIES];
  const monitor=`<div class="live-monitor">
    <div class="live-monitor-top"><span class="live-onair ${onAir?"on":""}"><i></i>${onAir?"LIVE ON AIR":"OFF AIR"}</span><span class="live-monitor-meta">${esc(quality)} · ${esc(topic)}</span></div>
    <div class="live-stage">${liveHostStage(host)}</div>
    <div class="live-ticker">BROADCASTING: ${esc((G.studio.name||"Studio").toUpperCase())} LIVE NETWORK · ${host?esc((host.role||"").toUpperCase()):"OFFICIAL STREAM"} · ACTIVE HOST: ${host?esc(host.name.toUpperCase()):"NONE"}</div>
  </div>`;
  const kpis=liveKpis([
    ["CURRENT CCV",onAir?(stream.ccv||0)+"M":"0M",onAir?"Concurrent viewers right now":"No audience while off air"],
    ["PEAK CCV",(stream.peakCcv||0)+"M","Best concurrent audience so far"],
    ["TOTAL HOURS",(stream.totalHours||0).toLocaleString()+" hrs","Streamed hours accumulated weekly"],
    ["SUB CONVERSIONS",((stream.subConversions||0)).toFixed(1)+"M","Viewers converted to streamer subs"],
    ["ACTIVE HOST",host?esc(host.name):"—",host?"Level "+(liveHostStats(host.id).level||1):"None selected"]
  ]);
  const controls=`<div class="live-stream-controls">
    <label>Topic<select id="liveStreamTopic" ${onAir?"disabled":""}>${topics.map(([v,l])=>`<option value="${esc(v)}" ${v===topic?"selected":""}>${esc(l)}</option>`).join("")}</select></label>
    <label>Quality<select id="liveStreamQuality" ${onAir?"disabled":""}>${qualities.map(q=>`<option value="${esc(q)}" ${q===quality?"selected":""}>${esc(q)}</option>`).join("")}</select></label>
    <button class="produce-action" data-live-stream-toggle="1">${onAir?"End Live Stream":"Start Live Stream"}</button>
    <button class="produce-ghost" data-live-adbreak="1" ${onAir?"":"disabled"}>Run Ad Break</button>
  </div>
  <p class="live-note">${onAir?"Topic and quality apply when a stream starts — end this broadcast to change them. Ad-break earnings depend on live CCV when the break airs and are reported exactly.":"Off air — pick a topic and quality, then start the stream. Ad breaks unlock while you are live; earnings depend on CCV at the moment the break airs."}</p>
  ${G.streamer?`<p class="live-note">Direct-to-Consumer Synergy: High live stream viewership feeds subscriber growth for your streamer <b>${esc(G.streamer.name)}</b>.</p>`:""}`;
  const msgs=stream.chatMessages||[];
  const chat=msgs.length
    ? `<div class="live-chat">${msgs.slice(-15).map(m=>m.isSuperChat
        ? `<div class="live-superchat"><div><b>${esc(m.user)}</b><span>$${m.amount} Super Chat</span></div><p>${esc(m.text)}</p></div>`
        : `<div class="live-chat-msg"><b>${esc(m.user)}:</b><span>${esc(m.text)}</span></div>`).join("")}</div>`
    : liveEmpty("No chat messages yet.","Start a live broadcast to engage viewers; chat and Super Chats land here as they arrive.");
  return livePanel("CONTROL ROOM","Live Studio Streaming Broadcast","Direct interactive transmission to global audiences — real CCV, hours and conversions from the stream state.",
    `<div class="live-stream-grid"><div>${monitor}${kpis}${controls}</div><div class="live-chat-col"><div class="live-chat-head"><b>Live Chat Feed</b><span class="live-chip ${onAir?"on":""}">${onAir?"Active":"Chat Paused"}</span></div>${chat}<p class="live-note">Chat auto-updates each week as viewers react to on-air talent and studio events.</p></div></div>`,
    onAir?"ON AIR":"OFF AIR","live-stream-panel");
}

/* ── C6/C7/C8 · Events desk ── */
function liveEventCard(ev){
  const away=liveWeeksAway(ev);
  const isNow=away===0;
  const live=G.live||{};
  const submittedId=((live.events||{}).submissions||{})[ev.id];
  let status;
  if(ev.type==="premiere") status="Any week — you schedule it";
  else if(!ev.week) status=ev.freq?("Every "+ev.freq+" weeks"):"No fixed week";
  else if(isNow) status="HAPPENING THIS WEEK";
  else status="In "+away+" wk"+(away===1?"":"s")+" · Week "+ev.week;
  const figs=[
    ["Prestige",String(ev.prestige||0)],
    ["Expected viewers",(ev.viewers||0)+"M"],
    ["Ad rate",String(ev.adRate||0)],
    ["Rights cost",ev.rightsCost?fmtM(ev.rightsCost):"—"],
    ["Duration",(ev.dur||1)+"d"],
    ["Event week",ev.week?String(ev.week):"—"]
  ].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  const extra=[
    ev.freq?"Recurs every "+ev.freq+" weeks":null,
    ev.market?"Market · "+(ev.buyers||0)+" buyers":null,
    ev.exclusive?"Exclusive rights":null,
    ev.categories&&ev.categories.length?"Categories: "+ev.categories.join(", "):null
  ].filter(Boolean).join(" · ");
  let action="";
  if(ev.type==="festival"){
    action=submittedId
      ? `<span class="live-chip on">SUBMITTED: ${esc(liveTitleOf(submittedId)||"Film")}</span><button class="produce-ghost" data-live-fest-submit="${ev.id}">Change submission ($${((DATA.LIVE_COSTS||{}).festivalFee)||0.25}M)</button>`
      : `<button class="produce-ghost" data-live-fest-submit="${ev.id}">Submit Film ($${((DATA.LIVE_COSTS||{}).festivalFee)||0.25}M)</button>`;
  } else if(ev.type==="premiere"){
    action=`<button class="produce-ghost" data-live-premiere="1">Host in this city (${liveMoney((DATA.LIVE_COSTS||{}).premiere||1.5)})</button>`;
  } else if(ev.type==="awards"){
    action=`<span class="live-chip">FYC CAMPAIGN READY</span>`;
  } else {
    action=`<span class="live-chip">AD SURGE WINDOW</span>`;
  }
  return `<article class="live-event ${isNow?"now":""}">
    <header><b>${esc(ev.emoji||"")} ${esc(ev.name)}</b><span class="live-chip ${isNow?"on":""}">${status}</span></header>
    <p>${esc(ev.desc||"")}</p>
    <dl>${figs}</dl>
    ${extra?`<small>${esc(extra)}</small>`:""}
    <footer><span class="live-chip">${esc(String(ev.type||"").toUpperCase())}</span>${action}</footer>
  </article>`;
}
function liveFestivalTracker(){
  const live=G.live||{}, fee=(DATA.LIVE_COSTS||{}).festivalFee||0.25;
  const eligible=(G.films||[]).filter(f=>!f.unreleased&&(f.quality&&f.quality.overall>=45));
  const subs=Object.entries(((live.events||{}).submissions)||{});
  const stats=live.stats||{};
  const eligRows=eligible.length
    ? eligible.slice(0,10).map(f=>`<div class="live-row"><div><b>${esc(f.title)}</b><small>${esc((DATA.GENRES[f.genre]||{}).name||f.genre||"")} · Quality ${(f.quality&&f.quality.overall)||50}</small></div><span>${G.studio.cash>=fee?"Entry "+liveMoney(fee):"Need "+liveMoney(fee)}</span></div>`).join("")
    : liveEmpty("No eligible films.","Festival entry needs a released film with Quality 45 or better. Release stronger pictures, then submit them from any festival card above.");
  const pendRows=subs.length
    ? subs.map(([festId,filmId])=>{
        const ev=DATA.liveEvent(festId), away=ev?liveWeeksAway(ev):null;
        return `<div class="live-row"><div><b>${esc(liveTitleOf(filmId)||"Submitted film")}</b><small>${esc(ev?ev.name:festId)}${ev?" · week "+ev.week+(away===0?" · judging this week":" · in "+away+" wks"):""}</small></div><span class="live-chip on">PENDING</span></div>`;
      }).join("")
    : liveEmpty("No pending submissions.","Submitted films appear here against their festival until the festival week processes them.");
  const body=`<p class="live-note">Entry fee ${liveMoney(fee)} per submission, charged once by submitFilmToFestival. Wins so far: <b>${stats.festivalsWon||0}</b> festival prize${(stats.festivalsWon||0)===1?"":"s"} — results are decided in the festival's own week and reported in the log.</p>`
    +`<h3 class="live-subhead">Eligible films</h3><div class="live-rows">${eligRows}</div>`
    +`<h3 class="live-subhead">Pending submissions</h3><div class="live-rows">${pendRows}</div>`;
  return livePanel("FESTIVAL TRACKER","Festival submission tracker","Eligible pictures, the real entry fee, and every film currently waiting on a jury.",body,subs.length+" PENDING","live-festival-tracker");
}
function livePremiereDesk(){
  const live=G.live||{}, cost=(DATA.LIVE_COSTS||{}).premiere||1.5;
  const cities=(DATA.LIVE_EVENTS||[]).filter(e=>e.type==="premiere");
  const candidates=(G.projects||[]).concat((G.films||[]).filter(f=>!f.archived)).slice(0,15);
  const scheduled=((live.events||{}).premieres)||[];
  const citySelect=`<label class="live-city-pick">Premiere city<select id="livePremiereCity">${cities.map(c=>`<option value="${esc(c.id.replace("premiere_",""))}">${esc(c.name)} — prestige ${c.prestige||0} · ${c.viewers||0}M viewers</option>`).join("")}</select></label>`;
  const rows=candidates.length
    ? candidates.map(f=>`<div class="live-row"><div><b>${esc(f.title)}</b><small>${esc((DATA.GENRES[f.genre]||{}).name||f.genre||"")} · current buzzBonus ${((f.buzzBonus||0)).toFixed(2)}</small></div><button class="produce-ghost" data-live-premiere-host="${f.id}" ${G.studio.cash>=cost?"":"disabled"}>Host Gala (${liveMoney(cost)})</button></div>`).join("")
    : liveEmpty("No pictures available for a premiere.","Active projects and released films can walk the red carpet. Develop or release a film first.");
  const schedRows=scheduled.length
    ? scheduled.map(pr=>`<div class="live-row"><div><b>${esc(liveTitleOf(pr.filmId)||"Premiere film")}</b><small>${esc(String(pr.city||"la").toUpperCase())} · queued week ${pr.week} · +0.25 buzzBonus when it broadcasts</small></div><span class="live-chip on">SCHEDULED</span></div>`).join("")
    : liveEmpty("No premieres scheduled.","Host a gala above and it queues here until the next weekly broadcast tick airs it.");
  const body=`<p class="live-note">A gala costs ${liveMoney(cost)}. It is queued immediately and broadcasts on the next weekly tick, applying <b>+0.25 buzzBonus exactly once</b> — no immediate double-count.</p>`
    +citySelect
    +`<div class="live-rows">${rows}</div>`
    +`<h3 class="live-subhead">Scheduled premieres</h3><div class="live-rows">${schedRows}</div>`;
  return livePanel("PREMIERE DESK","Premiere desk","Choose a city, pick a picture, and review what is already on the carpet calendar.",body,`<button class="produce-action" data-live-premiere="1">Host Red Carpet Premiere (${liveMoney(cost)})</button>`,"live-premiere-desk");
}
function viewLiveEvents(){
  const events=(DATA.LIVE_EVENTS||[]).slice().sort((a,b)=>{
    const aw=a.week?liveWeeksAway(a):999, bw=b.week?liveWeeksAway(b):999;
    return aw-bw || (b.prestige||0)-(a.prestige||0);
  });
  const filters=[["all","All"],["awards","Awards"],["festival","Festivals"],["sports","Sports"],["cultural","Cultural"],["premiere","Premieres"]];
  const active=filters.some(f=>f[0]===LIVE_EVENT_FILTER)?LIVE_EVENT_FILTER:"all";
  const shown=active==="all"?events:events.filter(e=>e.type===active);
  const chips=`<div class="produce-filters live-event-filters" role="group" aria-label="Filter events by type">${filters.map(([k,l])=>{
    const n=k==="all"?events.length:events.filter(e=>e.type===k).length;
    return `<button data-live-event-filter="${k}" class="${active===k?"active":""}" aria-pressed="${active===k}">${l} <b>${n}</b></button>`;
  }).join("")}</div>`;
  const calendar=livePanel("ANNUAL CALENDAR","Major Live Events, Festivals & Red Carpets","Every dated event on the broadcast calendar, nearest first — prestige, expected viewers and rights metadata straight from DATA. Filters are view-only.",
    chips+(shown.length?`<div class="live-events">${shown.map(liveEventCard).join("")}</div>`:liveEmpty("No events of this type.","Try another filter — the full calendar is one tap away.")),
    "WEEK "+woyOf(G.week)+" / 52","live-calendar");
  return calendar+liveFestivalTracker()+livePremiereDesk();
}

/* ── C9 · Host progression studio ── */
function viewLiveStudio(){
  const live=G.live||{}, hosts=DATA.LIVE_HOSTS||[], activeId=live.activeHost||"rex";
  const trainCost=(DATA.LIVE_COSTS||{}).hostTrain||1.0;
  const cards=hosts.map(host=>{
    const stats=liveHostStats(host.id);
    const level=stats.level||1, xp=stats.xp||0, threshold=level*100;
    const pct=Math.max(0,Math.min(100,xp/Math.max(1,threshold)*100));
    const isActive=host.id===activeId;
    const factor=(1+((stats.charisma||75)-50)*0.003).toFixed(2);
    return `<article class="live-host ${isActive?"active":""}">
      <div class="live-host-stage">${liveHostStage(host)}${isActive?'<span class="live-chip on">ON-AIR LEAD</span>':""}</div>
      <h3>${esc(host.name)}</h3>
      <p class="live-host-role">${esc(host.role||"")} · Lv. ${level}</p>
      <div class="live-xp"><div><span>Experience</span><span>${level>=10?xp+" XP · MAX LEVEL":xp+" / "+threshold+" XP to Lv."+(level+1)}</span></div><i role="meter" aria-label="Host experience" aria-valuemin="0" aria-valuemax="${threshold}" aria-valuenow="${Math.min(xp,threshold)}"><b style="width:${pct.toFixed(1)}%"></b></i></div>
      <dl>
        <div><dt>Charisma</dt><dd>${stats.charisma||70}</dd></div>
        <div><dt>Energy</dt><dd>${stats.energy||70}</dd></div>
        <div><dt>Trait</dt><dd>${esc(host.trait||"")}</dd></div>
        <div><dt>Specialty</dt><dd>${esc(host.specialty||"")}</dd></div>
        ${isActive?`<div><dt>On-air factor</dt><dd>×${factor}</dd></div>`:""}
      </dl>
      ${host.perk?`<p class="live-host-perk">Listed perk: ${esc(host.perk)}</p>`:""}
      ${host.quote?`<blockquote>“${esc(host.quote)}”</blockquote>`:""}
      <footer>${isActive?`<button class="produce-ghost" disabled>Active on Air</button>`:`<button class="produce-action" data-live-host-select="${host.id}">Set Active Host</button>`}<button class="produce-ghost" data-live-host-train="${host.id}" title="Media Training: Charisma +4, Energy +5" ${G.studio.cash>=trainCost?"":"disabled"}>Train (${liveMoney(trainCost)})</button></footer>
    </article>`;
  }).join("");
  return livePanel("HOST STUDIO","On-Air Personalities & Broadcast Studio","Levels use the engine's real threshold — a host levels up when XP passes level × 100. Perks and specialties are DATA flavour; the broadcast bonus in tickLiveBroadcasting comes from the active host's charisma, and energy does not drain.",
    hosts.length?`<div class="live-hosts">${cards}</div>`:liveEmpty("No hosts on the roster.","Host data ships with the game; if this persists, DATA failed to load."),
    hosts.length+" HOSTS","live-hosts-panel");
}

/* ═══════════════════════════════════════════════════════════════════
   LIVE TV MODALS
   ═══════════════════════════════════════════════════════════════════ */

function liveSlotModal(channelId, hour){
  const ch = getLiveChannel(channelId);
  if(!ch) return;
  const chDef = (typeof DATA.liveChannel === "function" ? DATA.liveChannel(channelId) : (DATA.LIVE_CHANNELS || []).find(c => c.id === channelId)) || {};
  const chName = chDef.name || ch.name || channelId;
  const currentSlot = (ch.schedule || [])[hour] || { hour, block: "rerun", contentId: null, title: null };
  const slotMeta = (DATA.CHANNEL_SLOTS || []).find(s => (s.hour === hour || s.h === hour)) || { name: hour + ":00", label: hour + ":00" };
  const curBlock = (DATA.PROGRAM_BLOCKS || []).find(b => b.id === currentSlot.block) || {};

  let h = "<h3>Program Slot: " + esc(chName) + " (" + esc(slotMeta.label || slotMeta.name) + ")</h3>"+
    "<div class='tiny muted' style='margin-bottom:12px'>Now: <b>" + esc(currentSlot.title || "Syndicated Block") + "</b> · " + esc(curBlock.label || currentSlot.block || "") + (currentSlot.sponsor ? " · " + esc(currentSlot.sponsor) : "") + (currentSlot.rating != null ? " · ★" + currentSlot.rating : "") + ". Assign a programming format or broadcast a feature film from your studio catalog.</div>" +
    ((typeof getLiveShow === "function" && currentSlot.contentId && getLiveShow(currentSlot.contentId)) ? "<div class='tiny' style='margin-bottom:10px'>📺 This hour carries one of your developed shows — reprogramming it will leave the show unscheduled (you can reschedule it from Shows).</div>" : "");

  h += "<div class='live-modal-group'><b>Programming Format Block</b>"+
    "<div class='row' style='gap:6px;flex-wrap:wrap;margin-top:8px'>";
  for(const block of DATA.PROGRAM_BLOCKS || []){
    const isSel = currentSlot.block === block.id && !currentSlot.contentId;
    const bName = block.name || block.label || block.id;
    const bTier = block.adTier !== undefined ? block.adTier : 1.0;
    h += "<button class='btn btn-sm " + (isSel ? "btn-primary" : "btn-alt") + "' id='slotBlock_" + block.id + "'>" + esc(bName) + " (" + bTier + "x)</button>";
  }
  h += "</div></div>";

  const eligibleFilms = (G.films || []).filter(f => !f.unreleased);
  h += "<div class='live-modal-group'><b>Broadcast Studio Catalog Film (" + eligibleFilms.length + " Available)</b>";
  if(!eligibleFilms.length){
    h += "<div class='tiny muted' style='margin-top:4px'>No released films in your library yet. Release films to air them on linear TV.</div>";
  } else {
    h += "<div style='max-height:160px;overflow-y:auto;margin-top:6px;display:flex;flex-direction:column;gap:4px'>";
    for(const f of eligibleFilms.slice(0, 20)){
      const isSel = currentSlot.contentId === f.id;
      h += "<div class='row spread' style='padding:5px 8px;border-radius:var(--radius-sm);background:var(--bg2);border:1px solid " + (isSel ? "var(--gold)" : "transparent") + "'>"+
        "<div><b>" + esc(f.title) + "</b> <span class='tiny muted'>" + esc((DATA.GENRES[f.genre]||{}).name || "") + " · Score: " + ((f.quality && f.quality.overall) || 50) + "</span></div>"+
        "<button class='btn btn-xs " + (isSel ? "btn-primary" : "btn-alt") + "' id='slotFilm_" + f.id + "'>" + (isSel ? "Scheduled" : "Select") + "</button>"+
        "</div>";
    }
    h += "</div>";
  }
  h += "</div>";

  h += "<div class='modal-actions'>"+
    "<button class='btn btn-ghost' onclick='closeModal()'>Close</button>"+
    "</div>";

  const v = openModal(h);

  for(const block of DATA.PROGRAM_BLOCKS || []){
    const btn = v.querySelector("#slotBlock_" + block.id);
    if(btn){
      btn.onclick = () => {
        scheduleChannelSlot(channelId, hour, block.id, null, null);
        beep("gold");
        closeModal();
        render();
      };
    }
  }

  for(const f of eligibleFilms.slice(0, 20)){
    const btn = v.querySelector("#slotFilm_" + f.id);
    if(btn){
      btn.onclick = () => {
        scheduleChannelSlot(channelId, hour, "movie", f.id, f.title);
        beep("gold");
        closeModal();
        render();
      };
    }
  }
}

function liveFestSubmitModal(eventId){
  const ev = DATA.liveEvent(eventId);
  if(!ev) return;

  const eligibleFilms = (G.films || []).filter(f => !f.unreleased && (f.quality && f.quality.overall >= 45));
  const festFee = (DATA.LIVE_COSTS && DATA.LIVE_COSTS.festivalFee) || 0.25;
  const existing = ((G.live.events || {}).submissions || {})[eventId];

  let h = "<h3>Festival Competition: " + esc(ev.name) + "</h3>"+
    "<div class='tiny muted' style='margin-bottom:12px'>" + esc(ev.desc || "") + " · Entry Fee: $" + festFee + "M · Week " + ev.week + " · Prestige " + (ev.prestige || 0) + "</div>"+
    (existing ? "<div class='tiny' style='margin-bottom:10px'>Already submitted: <b>" + esc(liveTitleOf(existing) || "Film") + "</b>. Submitting another film replaces it and charges the fee again.</div>" : "");

  if(!eligibleFilms.length){
    h += "<div class='live-modal-group muted small'>No films meet the minimum festival submission quality standard (Quality &gt;= 45). Produce higher quality pictures to enter competition.</div>";
  } else {
    h += "<div class='live-modal-group' style='max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:6px'>";
    for(const f of eligibleFilms){
      const qual = (f.quality && f.quality.overall) || 50;
      h += "<div class='row spread' style='padding:6px 10px;background:var(--bg2);border-radius:var(--radius-sm)'>"+
        "<div><b>" + esc(f.title) + "</b> <span class='tiny muted'>" + esc((DATA.GENRES[f.genre]||{}).name || "") + " · Score: " + qual + "</span></div>"+
        "<button class='btn btn-xs btn-primary' id='festSub_" + f.id + "' " + (G.studio.cash >= festFee ? "" : "disabled") + ">Submit ($" + festFee + "M)</button>"+
        "</div>";
    }
    h += "</div>";
    if(G.studio.cash < festFee) h += "<div class='tiny muted' style='margin-top:8px'>Not enough cash for the $" + festFee + "M entry fee.</div>";
  }

  h += "<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Cancel</button></div>";
  const v = openModal(h);

  for(const f of eligibleFilms){
    const btn = v.querySelector("#festSub_" + f.id);
    if(btn){
      btn.onclick = () => {
        const r = submitFilmToFestival(f.id, eventId);
        if(r && r.ok){
          beep("gold");
          closeModal();
          flashes(G.flash);
          render();
        } else {
          toast((r && r.reason) || "Cannot submit film.", "bad");
        }
      };
    }
  }
}

function livePremiereModal(){
  const upcomingFilms = (G.projects || []).concat((G.films || []).filter(f => !f.archived)).slice(0, 15);
  const premCost = (DATA.LIVE_COSTS && DATA.LIVE_COSTS.premiere) || 1.5;
  const cities = (DATA.LIVE_EVENTS || []).filter(e => e.type === "premiere");

  let h = "<h3>Host Red Carpet Star Gala Premiere</h3>"+
    "<div class='tiny muted' style='margin-bottom:12px'>Gala premieres cost " + liveMoney(premCost) + " cash. The premiere is queued now and broadcasts on the next weekly tick, applying +0.25 buzzBonus to the film exactly once.</div>"+
    "<label class='tiny muted' style='display:block;margin-bottom:12px'>Premiere city "+
    "<select id='premCity'>" + cities.map(c => "<option value='" + esc(c.id.replace("premiere_","")) + "'>" + esc(c.name) + " — prestige " + (c.prestige || 0) + "</option>").join("") + "</select></label>";

  if(!upcomingFilms.length){
    h += "<div class='live-modal-group muted small'>No active projects or theatrical titles available for a premiere gala.</div>";
  } else {
    h += "<div class='live-modal-group' style='max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:6px'>";
    for(const f of upcomingFilms){
      h += "<div class='row spread' style='padding:6px 10px;background:var(--bg2);border-radius:var(--radius-sm)'>"+
        "<div><b>" + esc(f.title) + "</b> <span class='tiny muted'>" + esc((DATA.GENRES[f.genre]||{}).name || "") + "</span></div>"+
        "<button class='btn btn-xs btn-primary' id='premGo_" + f.id + "' " + (G.studio.cash >= premCost ? "" : "disabled") + ">Host Gala (" + liveMoney(premCost) + ")</button>"+
        "</div>";
    }
    h += "</div>";
    if(G.studio.cash < premCost) h += "<div class='tiny muted' style='margin-top:8px'>Not enough cash — a gala needs " + liveMoney(premCost) + ".</div>";
  }

  h += "<div class='modal-actions'><button class='btn btn-ghost' onclick='closeModal()'>Cancel</button></div>";
  const v = openModal(h);

  for(const f of upcomingFilms){
    const btn = v.querySelector("#premGo_" + f.id);
    if(btn){
      btn.onclick = () => {
        const cityEl = v.querySelector("#premCity");
        const r = hostRedCarpetPremiere(f.id, cityEl ? cityEl.value : undefined);
        if(r && r.ok){
          beep("gold");
          closeModal();
          flashes(G.flash);
          render();
        } else {
          toast((r && r.reason) || "Gala premiere failed.", "bad");
        }
      };
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   LIVE ANIMATED VECTOR CHARACTERS (SVG + CSS KEYFRAMES)
   ═══════════════════════════════════════════════════════════════════ */

function renderCharRex(){
  return "<svg class='char-rex' viewBox='0 0 160 160' width='130' height='130' xmlns='http://www.w3.org/2000/svg'>"+
    // Studio backdrop monitor
    "<rect x='20' y='16' width='120' height='80' rx='6' fill='#0e1726' stroke='#1e293b' stroke-width='2'/>"+
    "<path d='M30 40 h100 M30 60 h100 M60 20 v70 M100 20 v70' stroke='#162238' stroke-width='1' stroke-dasharray='3 3'/>"+
    // Rex Body / Suit
    "<path class='char-chest' d='M40 160 L50 115 L66 120 L80 145 L94 120 L110 115 L120 160 Z' fill='#1e293b'/>"+
    "<polygon points='66,120 80,145 94,120 80,118' fill='#ffffff'/>"+
    "<polygon points='76,122 84,122 82,148 78,148' fill='#c53030'/>"+
    // Rex Head & Hair
    "<g class='char-head'>"+
    "<path d='M58 75 Q58 50 80 50 Q102 50 102 75 Q102 108 80 112 Q58 108 58 75 Z' fill='#fcd34d'/>"+
    "<path d='M54 62 Q60 38 80 38 Q100 38 106 62 Q96 48 80 50 Q64 48 54 62 Z' fill='#475569'/>"+
    // Eyes
    "<circle class='char-eye' cx='70' cy='72' r='3.5' fill='#0f172a'/>"+
    "<circle class='char-eye' cx='90' cy='72' r='3.5' fill='#0f172a'/>"+
    // Eyebrows
    "<path d='M65 65 L76 66 M95 66 L84 65' stroke='#334155' stroke-width='2' stroke-linecap='round'/>"+
    // Mouth
    "<ellipse class='char-mouth' cx='80' cy='94' rx='6' ry='2.5' fill='#b91c1c'/>"+
    "</g>"+
    // News Desk & Mic
    "<rect x='24' y='142' width='112' height='18' rx='2' fill='#0f172a' stroke='#334155' stroke-width='2'/>"+
    "<rect x='76' y='126' width='8' height='16' fill='#64748b'/>"+
    "<circle class='char-mic-light' cx='80' cy='123' r='5' fill='#ef4444'/>"+
    "</svg>";
}

function renderCharChloe(){
  return "<svg class='char-chloe' viewBox='0 0 160 160' width='130' height='130' xmlns='http://www.w3.org/2000/svg'>"+
    // Red Carpet Backdrop
    "<rect x='20' y='16' width='120' height='130' rx='6' fill='#180d18' stroke='#3b183b' stroke-width='2'/>"+
    "<line x1='30' y1='30' x2='130' y2='30' stroke='#f59e0b' stroke-width='2'/>"+
    // Chloe Gown & Body
    "<path class='char-chest' d='M44 160 L56 112 L70 120 L80 135 L90 120 L104 112 L116 160 Z' fill='#047857'/>"+
    // Glamour Necklace
    "<path d='M66 114 Q80 128 94 114' fill='none' stroke='#fcd34d' stroke-width='2.5'/>"+
    "<polygon class='char-sparkle' points='80,126 83,131 80,136 77,131' fill='#67e8f9'/>"+
    // Chloe Head & Updo Hairstyle
    "<g class='char-head'>"+
    "<circle cx='80' cy='46' r='20' fill='#b45309'/>"+
    "<path d='M60 76 Q60 54 80 54 Q100 54 100 76 Q100 106 80 108 Q60 106 60 76 Z' fill='#fed7aa'/>"+
    "<path d='M58 66 Q64 50 80 52 Q96 50 102 66 Q92 56 80 56 Q68 56 58 66 Z' fill='#b45309'/>"+
    // Sparkling Earring
    "<circle class='char-sparkle' cx='58' cy='82' r='2.5' fill='#67e8f9'/>"+
    "<circle class='char-sparkle' cx='102' cy='82' r='2.5' fill='#67e8f9'/>"+
    // Eyes & Smile
    "<circle class='char-eye' cx='71' cy='74' r='3' fill='#0f172a'/>"+
    "<circle class='char-eye' cx='89' cy='74' r='3' fill='#0f172a'/>"+
    "<path class='char-mouth' d='M73 92 Q80 98 87 92' fill='none' stroke='#be185d' stroke-width='2.5' stroke-linecap='round'/>"+
    "</g>"+
    // Handheld Golden Reporter Mic
    "<g class='char-hand-mic'>"+
    "<rect x='106' y='96' width='8' height='26' rx='2' fill='#d97706' transform='rotate(-20 106 96)'/>"+
    "<rect x='102' y='86' width='14' height='12' rx='2' fill='#ef4444' transform='rotate(-20 106 96)'/>"+
    "<circle cx='109' cy='82' r='6' fill='#f59e0b'/>"+
    "</g>"+
    "</svg>";
}

function renderCharBuck(){
  return "<svg class='char-buck' viewBox='0 0 160 160' width='130' height='130' xmlns='http://www.w3.org/2000/svg'>"+
    // Stadium Floodlights Background
    "<rect x='20' y='16' width='120' height='130' rx='6' fill='#09182a' stroke='#1e3a5f' stroke-width='2'/>"+
    "<circle cx='40' cy='36' r='8' fill='#38bdf8' opacity='0.3'/>"+
    "<circle cx='120' cy='36' r='8' fill='#38bdf8' opacity='0.3'/>"+
    // Equalizer bars
    "<rect class='char-vu' x='30' y='125' width='4' height='18' fill='#10b981'/>"+
    "<rect class='char-vu' x='38' y='118' width='4' height='25' fill='#f59e0b'/>"+
    "<rect class='char-vu' x='46' y='128' width='4' height='15' fill='#ef4444'/>"+
    // Buck Sports Broadcaster Jacket
    "<path class='char-chest' d='M42 160 L52 110 L70 115 L80 135 L90 115 L108 110 L118 160 Z' fill='#1d4ed8'/>"+
    "<polygon points='70,115 80,135 90,115' fill='#f8fafc'/>"+
    // Buck Head & Headset
    "<g class='char-head'>"+
    "<path d='M58 74 Q58 52 80 52 Q102 52 102 74 Q102 106 80 110 Q58 106 58 74 Z' fill='#fde047'/>"+
    "<path d='M56 60 Q66 42 80 42 Q94 42 104 60 Z' fill='#334155'/>"+
    // Broadcaster Headset
    "<path d='M54 75 Q54 36 80 36 Q106 36 106 75' fill='none' stroke='#0f172a' stroke-width='4'/>"+
    "<rect x='50' y='68' width='8' height='16' rx='2' fill='#475569'/>"+
    "<rect x='102' y='68' width='8' height='16' rx='2' fill='#475569'/>"+
    "<path d='M54 80 Q66 100 78 98' fill='none' stroke='#0f172a' stroke-width='2.5'/>"+
    "<circle cx='78' cy='98' r='3.5' fill='#ef4444'/>"+
    // Eyes & Expressive Mouth
    "<circle class='char-eye' cx='70' cy='72' r='3.5' fill='#0f172a'/>"+
    "<circle class='char-eye' cx='90' cy='72' r='3.5' fill='#0f172a'/>"+
    "<ellipse class='char-mouth' cx='80' cy='92' rx='7' ry='4' fill='#991b1b'/>"+
    "</g>"+
    "</svg>";
}

function renderCharReely(){
  return "<svg class='char-reely' viewBox='0 0 160 160' width='130' height='130' xmlns='http://www.w3.org/2000/svg'>"+
    // Backdrop Filmstrip Glow
    "<rect x='20' y='16' width='120' height='130' rx='6' fill='#17120a' stroke='#382a15' stroke-width='2'/>"+
    // Reely the Mascot Reel
    "<g class='char-reely-body' style='transform-origin:80px 80px'>"+
    // Outer 35mm Gold Reel
    "<circle class='char-wheel' cx='80' cy='80' r='46' fill='#f59e0b' stroke='#d97706' stroke-width='4'/>"+
    "<circle cx='80' cy='80' r='36' fill='#1f2937'/>"+
    // Reel Holes / Spokes
    "<circle cx='80' cy='56' r='10' fill='#0b0f19'/>"+
    "<circle cx='59' cy='92' r='10' fill='#0b0f19'/>"+
    "<circle cx='101' cy='92' r='10' fill='#0b0f19'/>"+
    "<circle cx='80' cy='80' r='7' fill='#f59e0b'/>"+
    // Big Cartoon Mascot Eyes
    "<g class='char-eyes'>"+
    "<ellipse cx='68' cy='74' rx='9' ry='12' fill='#ffffff'/>"+
    "<circle cx='70' cy='74' r='5' fill='#0f172a'/>"+
    "<circle cx='68' cy='71' r='2' fill='#ffffff'/>"+
    "<ellipse cx='92' cy='74' rx='9' ry='12' fill='#ffffff'/>"+
    "<circle cx='90' cy='74' r='5' fill='#0f172a'/>"+
    "<circle cx='88' cy='71' r='2' fill='#ffffff'/>"+
    "</g>"+
    // Mascot Cheerful Smile
    "<path class='char-mouth' d='M70 94 Q80 104 90 94' fill='none' stroke='#ef4444' stroke-width='3.5' stroke-linecap='round'/>"+
    // Celluloid Ribbon Arms
    "<path d='M34 82 Q20 60 28 44' fill='none' stroke='#f59e0b' stroke-width='4' stroke-linecap='round'/>"+
    "<path d='M126 82 Q140 60 132 44' fill='none' stroke='#f59e0b' stroke-width='4' stroke-linecap='round'/>"+
    // Dapper Red Bowtie
    "<polygon points='70,126 90,126 80,120' fill='#ef4444'/>"+
    "<polygon points='70,120 90,120 80,126' fill='#ef4444'/>"+
    "<circle cx='80' cy='123' r='3' fill='#991b1b'/>"+
    "</g>"+
    "</svg>";
}


/* ═══════════════════════════════════════════════════════════
   v29 UI additions merged into v30 for v31 release
   ═══════════════════════════════════════════════════════════ */

/* ── auto-play speed ── */
let AUTO_SPEED = 1;
try{ AUTO_SPEED = parseInt(localStorage.getItem("bow_autospeed")||"1",10); }catch(e){}
function autoIntervalMs(){ return Math.round(1100/AUTO_SPEED); }
function setAutoSpeed(n){
  AUTO_SPEED = [1,2,4].includes(+n)? +n : 1;
  if(typeof StudioLotBridge!=="undefined")StudioLotBridge.setSpeed(AUTO_SPEED);
  try{ localStorage.setItem("bow_autospeed", String(AUTO_SPEED)); }catch(e){}
  const b=document.getElementById("btnSpeed"); if(b) b.textContent=AUTO_SPEED+"×";
  if(AUTO){ clearInterval(AUTO); AUTO=setInterval(autoWeekTick, autoIntervalMs()); }
}

/* ── colour-blind cues ── */
let CB_CUES = true;
try{ CB_CUES = localStorage.getItem("bow_cb") !== "0"; }catch(e){}
function applyCbCues(){
  try{ document.body.classList.toggle("cb-cues", !!CB_CUES); }catch(e){}
}
applyCbCues();

/* ── calendar genre heat overlay ── */
/* ── chemistry web SVG ── */
function chemOf(a,b){
  if(!a||!b) return 0;
  const same=(a.genre===b.genre)?0.15:0;
  const tierDiff=Math.abs((a.power||0)-(b.power||0));
  const tierBonus=(tierDiff<=1)?0.2:(tierDiff<=2)?0.1:0;
  return clamp((a.power||0)*0.1 + (b.power||0)*0.1 + same + tierBonus + 0.1, 0, 1);
}
function filmsTogether(a,b){
  return (G.films||[]).filter(f=>f.cast && f.cast.find(c=>c.id===a.id) && f.cast.find(c=>c.id===b.id));
}
function chemistryWebSVG(cast, opts){
  opts=opts||{};
  const size=opts.size||280;
  const r=size*0.38;
  const cx=size/2, cy=size/2;
  const nodes=(cast||[]).slice(0,8);
  if(nodes.length<2) return "";
  let svg="<svg class='chem-wrap' viewBox='0 0 "+size+" "+size+"'>";
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const ch=chemOf(nodes[i],nodes[j]);
      if(ch<0.15) continue;
      const a1=(Math.PI*2*i/nodes.length)-Math.PI/2;
      const a2=(Math.PI*2*j/nodes.length)-Math.PI/2;
      const x1=cx+Math.cos(a1)*r, y1=cy+Math.sin(a1)*r;
      const x2=cx+Math.cos(a2)*r, y2=cy+Math.sin(a2)*r;
      const op=Math.round(ch*100)/100;
      const w=Math.max(1, ch*3);
      svg+="<line x1='"+fmtNum(x1,1)+"' y1='"+fmtNum(y1,1)+"' x2='"+fmtNum(x2,1)+"' y2='"+fmtNum(y2,1)+"' stroke='var(--gold)' stroke-width='"+fmtNum(w,1)+"' opacity='"+op+"'/>";
    }
  }
  for(let i=0;i<nodes.length;i++){
    const a=(Math.PI*2*i/nodes.length)-Math.PI/2;
    const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
    const t=nodes[i];
    svg+="<g class='chem-node'><circle cx='"+fmtNum(x,1)+"' cy='"+fmtNum(y,1)+"' r='18' fill='var(--bg-2)' stroke='var(--gold)' stroke-width='2'/>";
    svg+="<text x='"+fmtNum(x,1)+"' y='"+fmtNum(y,1)+"' text-anchor='middle' dominant-baseline='central' fill='var(--text)' font-size='11'>"+esc(t.name.split(" ")[0])+"</text></g>";
  }
  return svg+"</svg>";
}

/* ── deepfake modal ── */
function deepfakeModal(){
  if(!G || !G.pendingDeepfake) return;
  const df=G.pendingDeepfake;
  const tiers=deepfakeDifficulty();
  const tier=Math.min(df.tier||0, tiers.length-1);
  const cfg=tiers[tier];
  /* deterministic fake set per event — the same drill on every reopen */
  let _s=0; const _key=String((df.talentId||"x")+"|"+(df.week||G.week));
  for(let i=0;i<_key.length;i++) _s=(_s*31+_key.charCodeAt(i))>>>0;
  const _next=()=>{ _s=(_s*1103515245+12345)>>>0; return _s/4294967296; };
  const _nFake=Math.max(1, Math.min(cfg.frames-1, 1+tier));
  const fakes=new Set();
  for(let i=0;i<_nFake;i++) fakes.add(Math.min(cfg.frames-1, Math.floor(_next()*cfg.frames)));

  const totalTime = Math.max(16, (cfg.time || 8) * 2);
  let h="<div class='modal-head'><h3>Deepfake Forensic Drill</h3></div>";
  h+="<div class='modal-body'>";
  h+="<p>A viral synthetic video is circulating. Inspect the spectral forensic scan below and flag the synthetic anomaly frames before the clock runs out.</p>";
  h+="<div class='df-timer' id='dfTimer'>Time Remaining: "+totalTime+"s</div>";
  h+="<div class='df-frames' style='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;'>";
  for(let i=0;i<cfg.frames;i++){
    const isFake = fakes.has(i);
    const badge = isFake ?
      "<span class='tag red' style='font-size:9.5px;padding:2px 6px;margin-top:6px'>SYNTHETIC (Glitch 88%)</span>" :
      "<span class='tag green' style='font-size:9.5px;padding:2px 6px;margin-top:6px'>AUTHENTIC (Clean 96%)</span>";
    h+="<button class='df-frame' data-frame='"+i+"' style='flex:1;min-width:90px;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 6px'><b>Frame "+(i+1)+"</b>"+badge+"</button>";
  }
  h+="</div>";
  h+="<div class='tiny muted' style='margin-top:6px'>Flag every synthetic frame, then submit. Clock running out counts as a miss. Best streak: "+(G.dfStreak||0)+" · wins "+(G.dfWins||0)+" / losses "+(G.dfLosses||0)+"</div>";
  h+="<div class='df-actions' style='margin-top:14px;display:flex;gap:10px'><button class='btn btn-alt' id='dfDefer' style='flex:1'>Defer (-1 rep)</button><button class='btn btn-primary' id='dfSolve' style='flex:1'>Submit Verification</button></div>";
  h+="</div>";
  const v=openModal(h);

  const picked=new Set();
  let finished=false;
  let left=totalTime;
  const timerEl=v.querySelector("#dfTimer");
  const tick=setInterval(function(){
    left--;
    if(timerEl) timerEl.textContent="Time Remaining: "+left+"s";
    if(left<=0 && !finished){ finished=true; clearInterval(tick); submit(false, true); }
  }, 1000);
  try{ if(tick && tick.unref) tick.unref(); }catch(e){}
  function submit(correct, timedOut){
    if(finished) return;
    finished=true;
    clearInterval(tick);
    G.pendingDeepfake=null;
    resolveDeepfake(correct, {tier});
    if(correct){ G.dfWins=(G.dfWins||0)+1; beep("gold"); toast("[FORENSICS] Deepfake exposed! Streak "+(G.dfStreak||0)+" · +1 rep.","good"); }
    else { G.dfLosses=(G.dfLosses||0)+1; beep("bad"); toast(timedOut? "Out of time — the fake metastasized. Streak reset." : "Wrong frame flagged — the fake metastasized. Streak reset.","bad"); }
    saveGame();
    closeModal();
  }
  v.querySelectorAll("[data-frame]").forEach(b=>b.onclick=()=>{
    if(finished) return;
    const i=+b.getAttribute("data-frame");
    if(picked.has(i)){ picked.delete(i); b.classList.remove("df-picked"); }
    else { picked.add(i); b.classList.add("df-picked"); }
    beep("click");
  });
  const dfDefer=v.querySelector("#dfDefer");
  if(dfDefer) dfDefer.onclick=()=>{
    if(finished) return;
    finished=true; clearInterval(tick);
    G.pendingDeepfake=null;
    G.studio.rep=clamp(G.studio.rep-1,5,99);
    log("Deepfake deferred — the press noticed the delay. -1 rep.","bad");
    saveGame();
    closeModal();
  };
  const dfSolve=v.querySelector("#dfSolve");
  if(dfSolve) dfSolve.onclick=()=>{
    if(finished) return;
    const ok = picked.size===fakes.size && [...picked].every(x=>fakes.has(x));
    submit(ok, false);
  };
}

/* ── divisions panel ── */
function divisionsPanel(){
  let h="<div class='divisions-grid'>";
  // Game Studio
  const gs=G.gameStudio;
  h+="<div class='div-card'><div class='div-icon'>🎮</div><div class='div-main'><b>Game Studio</b>";
  h+="<div class='div-sub'>"+(gs? (gs.title||"In development") : "No active project")+"</div>";
  h+="</div><div class='div-side'>"+(gs? fmtMoney(gs.weekly||0)+"/wk" : "—")+"</div></div>";
  // Store
  const sl=storeLevel();
  h+="<div class='div-card'><div class='div-icon'>🏪</div><div class='div-main'><b>Merchandise</b>";
  h+="<div class='div-sub'>Level "+sl+" — direct retail stream</div>";
  h+="</div><div class='div-side'>"+fmtMoney(storeDirectIncome())+"/wk</div></div>";
  // Publishing
  const pub=(G.franchises||[]).filter(f=>f.publishing).length;
  const pubInc=(G.franchises||[]).reduce((s,f)=>s+publishingIncome(f),0);
  h+="<div class='div-card'><div class='div-icon'>📚</div><div class='div-main'><b>Publishing</b>";
  h+="<div class='div-sub'>"+pub+" franchise"+(pub!==1?"s":"")+" licensed</div>";
  h+="</div><div class='div-side'>"+fmtMoney(pubInc)+"/wk</div></div>";
  // Comics
  const com=(G.franchises||[]).reduce((s,f)=>s+(f.comics||0),0);
  const comInc=(G.franchises||[]).reduce((s,f)=>s+comicsIncome(f),0);
  h+="<div class='div-card'><div class='div-icon'>💬</div><div class='div-main'><b>Comics</b>";
  h+="<div class='div-sub'>"+com+" line"+(com!==1?"s":"")+" running</div>";
  h+="</div><div class='div-side'>"+fmtMoney(comInc)+"/wk</div></div>";
  h+="</div>";
  return h;
}

/* ── board vote modal ── */
function boardVoteModal(res){
  if(!res || !res.votes) return;
  let h="<div class='modal-head'><h3>🗳 Board Vote</h3></div><div class='modal-body'>";
  h+="<p>Greenlight vote for <b>"+esc(res.title||"Untitled")+"</b></p>";
  h+="<div class='vote-list'>";
  for(const v of res.votes){
    const cls=v.approved?"vote-yes":"vote-no";
    h+="<div class='vote-row "+cls+"'><span>"+esc(v.name)+"</span><span>"+(v.approved?"✓ Yes":"✕ No")+" ("+v.score+")</span></div>";
  }
  h+="</div>";
  h+="<p class='vote-result "+(res.passed?"pass":"fail")+"'>"+(res.passed?"✓ Approved":"✕ Rejected")+" — "+res.yes+"/"+res.total+"</p>";
  h+="</div>";
  openModal(h);
}

/* ── what-if share links ── */
function checkWhatIfLink(){
  if(!location.hash.startsWith("#whatif=")) return;
  try{
    const p=new URLSearchParams(location.hash.slice(8));
    const a=parseFloat(p.get("a")||"0"), b=parseFloat(p.get("b")||"0");
    if(a&&b) toast("What-if: "+fmtMoney(a)+" vs "+fmtMoney(b), "info");
  }catch(e){}
}

/* ── install prompt (PWA) ── */
function installPromptModal(){
  if(!window.__bowInstallPrompt){ toast("Install not available — try from browser menu.", "bad"); return; }
  window.__bowInstallPrompt.prompt();
  window.__bowInstallPrompt.userChoice.then(c=>{ if(c.outcome==="accepted") toast("Installing...", "good"); window.__bowInstallPrompt=null; });
}



function syncCommandHeaderHeight(){
  const header=document.querySelector('#app>.topbar'), app=document.getElementById('app');
  if(header&&app){const height=Math.ceil(header.getBoundingClientRect().bottom);if(height>0)app.style.setProperty('--command-header-height',height+'px');}
}
document.addEventListener('DOMContentLoaded',()=>{
  const header=document.querySelector('#app>.topbar');
  if(header&&typeof ResizeObserver!=='undefined')new ResizeObserver(syncCommandHeaderHeight).observe(header);
  window.addEventListener('resize',syncCommandHeaderHeight);syncCommandHeaderHeight();
});
