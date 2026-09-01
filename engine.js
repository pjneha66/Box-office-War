/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — engine.js
   The business simulation. All money in $Millions.
   Realism targets:
   • Studio keeps ~53% of domestic gross, ~42% of intl (blended, incl. China's ~25% take)
   • Breakeven ≈ (budget + marketing) / ~0.48 worldwide
   • Opening weekend = hype (stars × marketing × season × competition)
   • Legs (total/opening) = f(quality). Horror: big open, short legs. Animation: long legs.
   ═══════════════════════════════════════════════════════════ */
"use strict";

let G = null; // global game state

/* ═══════════ state ═══════════ */
function newGame(archId, name){
  const arch = DATA.ARCHETYPES.find(a=>a.id===archId) || DATA.ARCHETYPES[1];
  G = {
    v:1,
    studio:{ name: name || "Parallax Pictures", cash: arch.cash, debt: 0, rep: arch.rep,
             overhead: arch.overhead, archId: arch.id, flopPenalty: arch.flopPenalty, devBonus: arch.devBonus },
    week: 1, // absolute
    upgrades:{},
    projects:[], films:[], series:[], offers:[], ideas:[],
    talent:[],
    rivals: DATA.RIVALS_DEF.map(r=>({ ...r, slate:[], ytd:0, filmsLive:[] })),
    news:[], flash:[],
    stats:{ films:0, seriesSeasons:0, totalWW:0, totalProfit:0, hits:0, flops:0, awards:[],
            bestOpen:0, bestFilm:null, shareHistory:[] },
    investorDebt:0, investorPaid:0,
    streamWar:0, theaterCap:0,
    over:null, pendingReport:null, pendingChoice:null,
    weeksInDebt:0,
  };
  genTalentPool();
  seedIdeas();
  seedRivalYear();
  G.log = log;
  log("🎬 "+G.studio.name+" is founded. "+arch.sub, "gold");
  log("💡 Tip: Greenlight a film in the Develop tab, or pitch a series in OTT & Series.", "");
  saveGame();
  return G;
}

function log(text, kind){
  if(!G) return;
  G.news.unshift({ t:text, k:kind||"", w:G.week });
  if(G.news.length>140) G.news.length=140;
  if(kind) G.flash.push({t:text, k:kind});
}

/* ═══════════ save / load ═══════════ */
function saveGame(){
  try{ if(typeof localStorage!=="undefined") localStorage.setItem("bow_save", JSON.stringify(G)); }catch(e){}
}
function hasSave(){
  try{ return typeof localStorage!=="undefined" && !!localStorage.getItem("bow_save"); }catch(e){ return false; }
}
function loadGame(){
  try{
    const raw = (typeof localStorage!=="undefined") && localStorage.getItem("bow_save");
    if(!raw) return null;
    G = JSON.parse(raw);
    G.log = log;
    return G;
  }catch(e){ return null; }
}

/* ═══════════ calendar helpers ═══════════ */
function yearOf(w){ return Math.floor((w-1)/52)+1; }
function woyOf(w){ return ((w-1)%52)+1; }
function dateLabel(w){ return "Y"+yearOf(w)+" · W"+woyOf(w); }
function seasonOfW(w){ return DATA.seasonOf(woyOf(w)); }

/* ═══════════ money format ═══════════ */
function fmtM(v){
  const s = v<0?"-":"";
  v = Math.abs(v);
  if(v===0) return "$0";
  if(v>=1000) return s+"$"+(v/1000).toFixed(2)+"B";
  if(v>=100)  return s+"$"+Math.round(v)+"M";
  if(v>=10)   return s+"$"+v.toFixed(1).replace(/\.0$/,"")+"M";
  if(v>=1)    return s+"$"+v.toFixed(1)+"M";
  return s+"$"+Math.round(v*1000)+"K";
}
function fmtG(v){ // gross, always M with sensible decimals
  if(v>=1000) return "$"+(v/1000).toFixed(2)+"B";
  if(v>=100)  return "$"+Math.round(v)+"M";
  return "$"+v.toFixed(1)+"M";
}

/* ═══════════ talent ═══════════ */
function talentName(kind){
  const f = chance(.5)? pick(DATA.FIRST_M) : pick(DATA.FIRST_F);
  return f+" "+pick(DATA.LAST);
}
function genActor(hot){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(45,88)+power*3+rint(-6,6), 40, 96);
  const fee = [0.3,1.2,4,12,25][power-1] * (hot? 1.2:1);
  return { id:nid(), kind:"actor", name:talentName(), power, skill,
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0, genreFit:null };
}
function genDirector(hot, fitGenre){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(50,90)+power*2+rint(-5,5), 45, 97);
  const fee = [0.8,2,5,10,18][power-1]*(hot?1.15:1);
  const fits = Object.keys(DATA.GENRES);
  return { id:nid(), kind:"director", name:pick(DATA.DIR_FIRST)+" "+pick(DATA.LAST),
           power, skill, fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0,
           genreFit: fitGenre || pick(fits) };
}
function genTalentPool(){
  G.talent = [];
  for(let i=0;i<22;i++) G.talent.push(genActor(false));
  for(let i=0;i<9;i++)  G.talent.push(genDirector(false));
  G.talent.push(genActor(true));
  G.talent.push(genDirector(true));
}
function spawnDirectorHot(){ G.talent.push(genDirector(true)); }
function talentById(id){ return G.talent.find(t=>t.id===id); }
function actorFee(t){ return t.fee * (1+0.25*t.heat) * (G.upgrades.agency?0.85:1); }

/* ═══════════ script ideas ═══════════ */
function makeTitle(genre){
  const T = DATA.TITLES[genre];
  if(chance(.12)) return pick(DATA.SHARED_TITLES);
  if(genre==="fantasy"||genre==="animation") return pick(T.a)+" "+pick(T.b);
  const pre = T.p && chance(.35)? pick(T.p)+" " : "";
  return pre+pick(T.a)+" "+pick(T.b);
}
function genIdea(){
  const genre = pick(Object.keys(DATA.GENRES));
  const g = DATA.GENRES[genre];
  // scale suggestion weighted by genre
  let scale = "mid";
  if(genre==="action"||genre==="scifi"||genre==="fantasy"||genre==="animation") scale = chance(.55)?"tentpole":"mid";
  else if(genre==="horror"||genre==="drama"||genre==="romance") scale = chance(.6)?"indie":"mid";
  else scale = pick(["indie","mid","mid"]);
  const hot = chance(.16);
  const script = clamp(rint(50,84) + (hot?8:0) + rint(-4,6), 42, 94);
  return { id:nid(), genre, scale, title:makeTitle(genre), blurb:pick(DATA.BLURBS[genre]),
           script, hot, born:G.week, lapses:G.week+12 };
}
function seedIdeas(){ for(let i=0;i<6;i++) G.ideas.push(genIdea()); }
function refreshIdeas(){
  G.ideas = G.ideas.filter(i=>i.lapses>G.week);
  if(G.ideas.length<7 && chance(.6)) G.ideas.push(genIdea());
}

/* ═══════════ quality & box office math ═══════════ */
function neededBudget(genre, scale){
  const S=DATA.SCALES[scale], gb=DATA.GENRES[genre].budgetBias;
  return (S.bMin+S.bMax)/2 * gb;
}
function computeQuality(p){
  const g = DATA.GENRES[p.genre];
  const dirScore = p.director ? p.director.skill*(p.director.genreFit===p.genre?1.1:0.95) : 55;
  const castScore = p.cast.length? p.cast.reduce((s,c)=>s+c.skill,0)/p.cast.length : 52;
  const pv = clamp(p.budget/neededBudget(p.genre,p.scale), .55, 1.12);
  const prodScore = 52 + 48*pv;
  let craft = 0.30*p.script + 0.24*dirScore + 0.22*castScore + 0.24*prodScore;
  if(G.upgrades.vfx && p.scale==="tentpole") craft += 3;
  craft += gauss()*5.5;
  const overall = clamp(Math.round(craft), 8, 97);
  const critic = clamp(Math.round(overall + g.critic + gauss()*3), 5, 99);
  const aud    = clamp(Math.round(overall + g.aud + Math.min(p.cast.reduce((s,c)=>s+c.power,0),8)*1.2 + gauss()*3), 5, 99);
  return { overall, critic, aud };
}
function recMarketing(p){ return Math.round(p.budget*DATA.SCALES[p.scale].mktRate); }
function expectedOpening(p, weekAbs){
  const S=DATA.SCALES[p.scale], g=DATA.GENRES[p.genre];
  let base = S.openBase * g.mass * (g.openBoost||1);
  const starP = p.cast.reduce((s,c)=>s+c.power,0);
  const starF = 1 + 0.075*Math.min(starP, 6); // cap ≈ 1.45
  const rec = recMarketing(p);
  const mktF = clamp(Math.pow(Math.max(p.marketing,1)/rec, 0.45), 0.5, 1.55) * (G.upgrades.marketing?1.10:1);
  const season = seasonOfW(weekAbs).season;
  const fr = p.franchise? 1.35 : 1;
  const repF = 0.92 + G.studio.rep/600;
  const comp = competitionFactor(p, weekAbs);
  const hype = base*starF*mktF*season*fr*repF*comp*(1+(p.buzzBonus||0));
  return hype; // expected opening before noise
}
function competitionFactor(p, weekAbs){
  const others = weekendCompetitors(p, weekAbs);
  if(!others.length) return 1;
  const wSelf = Math.pow(Math.max(expectedWeightOf(p),1), 0.8);
  let sum = wSelf;
  others.forEach(o=>{ sum += Math.pow(o.weight,0.8); });
  const share = wSelf/sum;
  const crowd = others.length===1? 1.08 : others.length===2? 1.0 : 0.9; // market expands a bit with 2, saturates with 3+
  return clamp(Math.pow(share,0.55)*crowd, 0.15, 1.08);
}
function expectedWeightOf(p){
  const S=DATA.SCALES[p.scale];
  return S.openBase * DATA.GENRES[p.genre].mass * (p.franchise?1.35:1) * clamp(Math.pow(Math.max(p.marketing,1)/Math.max(recMarketing(p),1),0.45),0.6,1.5);
}
function weekendCompetitors(p, weekAbs){
  const list = [];
  G.rivals.forEach(r=>{
    const f = r.slate.find(f=>f.week===weekAbs && !f.dead);
    if(f) list.push({ rival:r.name, weight:f.weight, title:f.title, scale:f.scale, genre:f.genre });
  });
  if(p){ // your own other films same weekend
    G.projects.forEach(o=>{ if(o!==p && o.releaseWeek===weekAbs) list.push({ mine:true, title:o.title, weight:expectedWeightOf(o) }); });
    G.films.forEach(o=>{ if(o.releaseWeek===weekAbs && o!==p) list.push({ mine:true, title:o.title, weight:o.opening }); });
  }
  return list;
}
function legsOf(film){
  const g=DATA.GENRES[film.genre];
  let legs = 1.6 + (film.quality.overall-30)*0.028 + g.legsAdj;
  if(seasonOfW(film.releaseWeek).holiday) legs += 0.12;
  if(film.quality.aud>=85) legs += 0.08;
  if(film.piracyPenalty) legs -= film.piracyPenalty*8;
  return clamp(legs, 1.45, 4.1);
}
function studioShareRev(dom, genre){
  const g=DATA.GENRES[genre];
  const ww = dom/(1-g.intlShare);
  const intl = ww-dom;
  return { ww, rev: dom*0.53 + intl*0.42 };
}
function breakevenWW(p){ // worldwilde gross needed
  return (p.budget + (p.marketing||recMarketing(p))) / 0.48;
}

/* ═══════════ greenlight ═══════════ */
function devCostOf(idea){
  const base = { indie:2, mid:5, tentpole:12 }[idea.scale];
  return base + (idea.hot? rint(2,6):0);
}
function greenlight(cfg){
  // cfg: {idea, director, cast[], budget, sequelOf}
  const idea = cfg.idea;
  const S = DATA.SCALES[idea.scale];
  const fees = (cfg.director? actorFee(cfg.director):0) + cfg.cast.reduce((s,c)=>s+actorFee(c),0);
  const dev = devCostOf(idea);
  const p = {
    id:nid(), kind:"film", title:idea.title, genre:idea.genre, scale:idea.scale,
    script: idea.script, blurb: idea.blurb, hot:idea.hot,
    budget: cfg.budget, spent:0, devCost:dev,
    director: cfg.director, cast: cfg.cast,
    phase:"pre", phaseWeek:0,
    phaseLen:{ pre:rint(...S.pre), shoot:rint(...S.shoot), post:rint(...S.post) },
    releaseWeek:0, marketing:0, marketingPaid:0,
    franchise: !!(cfg.sequelOf && cfg.sequelOf.franchiseable) || !!(cfg.sequelOf),
    sequelOf: cfg.sequelOf? cfg.sequelOf.id : null,
    buzzBonus: cfg.sequelOf? 0.15 : 0,
    strikePause:0,
  };
  if(cfg.sequelOf){ p.title = sequelTitle(cfg.sequelOf.title); p.franchiseName = cfg.sequelOf.franchiseName || cfg.sequelOf.title; }
  G.studio.cash -= (dev + fees);
  // book talent
  const total = p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post;
  if(cfg.director){ cfg.director.bookedUntil = G.week+total; cfg.director.booked = p.title; }
  cfg.cast.forEach(c=>{ c.bookedUntil=G.week+total; c.booked=p.title; });
  G.projects.push(p);
  G.ideas = G.ideas.filter(i=>i.id!==idea.id);
  log("🎬 Greenlit: “"+p.title+"” ("+DATA.GENRES[p.genre].name+", "+fmtM(cfg.budget)+" budget)","gold");
  return p;
}
function sequelTitle(t){
  const n = (t.match(/[IVX]+$/)||[null])[0];
  const romans=["II","III","IV","V","VI","VII","VIII","IX","X"];
  if(n){ const i=romans.indexOf(n); if(i>=0 && i<romans.length-1) return t.slice(0,t.length-n.length)+romans[i+1]; }
  return t+" II";
}

/* ═══════════ weekly production tick ═══════════ */
function tickProjects(){
  for(const p of G.projects){
    if(p.phase==="ready"||p.phase==="delivered") continue;
    if(p.strikePause>0){ p.strikePause--; if(p.strikePause===0) log("✊ Crews back on set for “"+p.title+"”",""); continue; }
    p.phaseWeek++;
    const L=p.phaseLen;
    // cash burn
    let burn=0;
    if(p.phase==="pre")  burn = p.budget*0.10/L.pre;
    if(p.phase==="shoot"){ burn = p.budget*0.70/L.shoot * (G.upgrades.backlot?0.88:1); }
    if(p.phase==="post") burn = p.budget*0.20/L.post * (G.upgrades.vfx?0.75:1);
    burn = Math.round(burn*10)/10;
    G.studio.cash -= burn; p.spent += burn;
    if(p.phaseWeek >= L[p.phase]){
      p.phaseWeek=0;
      if(p.phase==="pre") p.phase="shoot";
      else if(p.phase==="shoot") p.phase="post";
      else if(p.phase==="post"){
        p.quality = computeQuality(p);
        if(p.prebuyAccepted){
          finishStreamingOriginal(p);
        }else{
          p.phase="ready";
          log("🎞 “"+p.title+"” is finished! Score: "+p.quality.overall+"/100. Schedule its release.","good");
          maybePrebuyOffer(p);
        }
      }
    }
  }
}
function finishStreamingOriginal(p){
  const plat = DATA.platform(p.prebuyPlatform);
  const pay = p.prebuyValue;
  G.studio.cash += pay;
  if(p.director){ p.director.bookedUntil=0; p.director.booked=null; }
  p.cast.forEach(c=>{ c.bookedUntil=0; c.booked=null; });
  const f = { id:p.id, title:p.title, genre:p.genre, scale:p.scale, budget:p.budget,
    marketing:0, quality:p.quality, streamingOriginal:true, platform:plat.name,
    releaseWeek:G.week, weekly:[], dom:0, ww:0, studioRev:pay, profit:pay-p.budget-p.devCost,
    inTheaters:false, soldTo:plat.name, awardsEligible:true, year:yearOf(G.week) };
  G.films.push(f);
  G.projects = G.projects.filter(x=>x!==p);
  G.stats.films++; G.stats.totalProfit+=f.profit;
  log("📺 “"+p.title+"” delivered straight to "+plat.name+" for "+fmtM(pay),"gold");
}

/* ═══════════ theatrical release ═══════════ */
function releaseFilm(p){
  const expected = expectedOpening(p, G.week);
  const noise = 0.85 + rnd()*0.34;
  let opening = clamp(expected*noise, 1.2, 300);
  if(G.theaterCap>0) opening *= 0.55;
  const q = p.quality;
  const film = {
    id:p.id, title:p.title, genre:p.genre, scale:p.scale,
    budget:p.budget, marketing:p.marketing, devCost:p.devCost,
    director:p.director, cast:p.cast, quality:q,
    releaseWeek:G.week, opening, weekly:[{w:G.week, gross:opening}],
    dom:opening, ww:0, studioRev:0, legs:0, decay:0,
    inTheaters:true, weeksOut:1, franchiseable:false, soldTo:null,
    piracyPenalty:0, awardsEligible:true, year:yearOf(G.week),
    franchiseName:p.franchiseName||null, sequelOf:p.sequelOf,
    franchiseableChecked:false,
  };
  G.films.push(film);
  G.projects = G.projects.filter(x=>x!==p);
  // free talent
  if(p.director){ p.director.bookedUntil=0; p.director.booked=null; }
  p.cast.forEach(c=>{ c.bookedUntil=0; c.booked=null; });
  G.stats.films++;
  if(opening>G.stats.bestOpen){ G.stats.bestOpen=opening; G.stats.bestFilm=film.title; }
  const label = opening>=100? "💥 MASSIVE opening": opening>=40? "🔥 Strong opening": opening>=12? "▶ Solid opening":"🎪 Limited release";
  log(label+": “"+film.title+"” opens to "+fmtG(opening)+" domestic.","gold");
  // talent heat on big opens
  if(opening>=60) p.cast.forEach(c=>{ c.heat=Math.min(3,c.heat+1); });
  return film;
}
function tickTheatrical(){
  for(const f of G.films){
    if(!f.inTheaters) continue;
    if(f.legs===0){ f.legs=legsOf(f); f.decay = 1-1/f.legs; }
    let gross = f.opening * Math.pow(f.decay, f.weeksOut);
    if(G.theaterCap>0) gross*=0.55;
    const isHoliday = seasonOfW(G.week).holiday;
    if(isHoliday) gross*=1.18;
    f.weeksOut++;
    if(gross < Math.max(0.3, f.opening*0.006) || f.weeksOut>16){
      endTheatrical(f); continue;
    }
    f.weekly.push({w:G.week, gross});
    f.dom += gross;
  }
}
function endTheatrical(f){
  f.inTheaters=false;
  const { ww, rev } = studioShareRev(f.dom, f.genre);
  f.ww = ww; f.studioRev = rev;
  const pvod = Math.round(ww*0.055*clamp(f.quality.overall/70,0.7,1.4));
  f.pvod = pvod; G.studio.cash += pvod;
  f.profit = rev + pvod - f.budget - f.marketing - (f.devCost||0);
  G.stats.totalWW += ww; G.stats.totalProfit += f.profit;
  const be = breakevenWW(f);
  const verdict = ww>=be*1.6? "SMASH HIT": ww>=be? "HIT": ww>=be*0.75? "disappointment": "FLOP";
  if(ww>=be) G.stats.hits++; else G.stats.flops++;
  // reputation
  const dRep = ww>=be*1.6? 6: ww>=be? 3: ww>=be*0.75? -2: -4;
  G.studio.rep = clamp(G.studio.rep + dRep*(G.studio.flopPenalty||1), 5, 99);
  // franchise potential
  if(f.quality.overall>=66 && ww>=be*1.9){
    f.franchiseable=true;
    log("🏆 “"+f.title+"” final: "+fmtG(ww)+" WW — "+verdict+". Franchise potential!","gold");
  }else{
    log("🏁 “"+f.title+"” ends its run: "+fmtG(ww)+" WW — "+verdict+" ("+(f.profit>=0?"+":"")+fmtM(f.profit)+" net).", f.profit>=0?"good":"bad");
  }
  scheduleOttOffer(f, rint(2,5));
}

/* ═══════════ OTT: film licensing ═══════════ */
function qualityFactorOTT(f){ return clamp(0.55 + f.quality.overall/90, 0.7, 1.5); }
function scheduleOttOffer(f, delayWeeks){
  f.ottAt = G.week + delayWeeks;
}
function maybeOttOffers(){
  for(const f of G.films){
    if(f.ottAt && G.week>=f.ottAt && !f.soldTo && !f.streamingOriginal){
      f.ottAt = 0;
      makeFilmOttOffer(f);
    }
  }
}
function makeFilmOttOffer(f){
  const g=DATA.GENRES[f.genre];
  const plats = DATA.PLATFORMS.map(p=>({p, score:p.generosity * (p.taste[f.genre]||1)})).sort((a,b)=>b.score-a.score);
  const chosen = chance(.65)? plats[0] : pick(plats.slice(0,3));
  let value = (f.budget*0.5 + f.ww*0.06) * g.otta * chosen.p.generosity * qualityFactorOTT(f);
  if(G.streamWar>0) value*=1.3;
  if(G.upgrades.ottrel) value*=1.12;
  value = Math.round(value);
  G.offers.push({ id:nid(), type:"film_ott", filmId:f.id, filmTitle:f.title, platform:chosen.p.id,
    value, countered:false, expires:G.week+6 });
  log("📨 "+chosen.p.name+" wants to license “"+f.title+"” for "+fmtM(value),"");
}
function maybePrebuyOffer(p){
  if(p.scale==="indie" && !p.hot) return;
  if(!chance(p.hot? 0.7:0.35)) return;
  const plats = DATA.PLATFORMS.map(x=>({x, s:x.generosity*(x.taste[p.genre]||1)})).sort((a,b)=>b.s-a.s);
  const chosen = pick(plats.slice(0,2));
  const margin = 1.12 + rnd()*0.33;
  const value = Math.round(p.budget*margin*chosen.x.generosity*(G.streamWar>0?1.25:1));
  G.offers.push({ id:nid(), type:"prebuy", projectId:p.id, filmTitle:p.title, platform:chosen.x.id,
    value, countered:false, expires:G.week+4 });
  log("📨 "+chosen.x.name+" offers to buy “"+p.title+"” as a streaming original: "+fmtM(value)+" (no theatrical run).","");
}
function acceptOffer(o){
  if(o.type==="film_ott"){
    const f = G.films.find(x=>x.id===o.filmId); if(!f) return;
    G.studio.cash += o.value; f.soldTo = DATA.platform(o.platform).name; f.soldValue=o.value;
    f.profit += o.value; G.stats.totalProfit += o.value;
    log("🤝 “"+f.title+"” licensed to "+f.soldTo+" for "+fmtM(o.value),"gold");
  }else if(o.type==="prebuy"){
    const p = G.projects.find(x=>x.id===o.projectId); if(!p) return;
    p.prebuyAccepted=true; p.prebuyPlatform=o.platform; p.prebuyValue=o.value;
    log("🤝 “"+p.title+"” sold to "+DATA.platform(o.platform).name+" — "+fmtM(o.value)+" payable on delivery.","gold");
  }else if(o.type==="renewal"){
    acceptRenewal(o);
  }
  G.offers = G.offers.filter(x=>x.id!==o.id);
  saveGame();
}
function counterOffer(o){
  if(o.countered) return;
  o.countered=true;
  const p = 0.35 + G.studio.rep/300 + (DATA.platform(o.platform).generosity-1)*1.2 + (G.streamWar>0?0.15:0);
  if(chance(clamp(p,0.2,0.85))){
    o.value = Math.round(o.value*(1.18+rnd()*0.12));
    log("📈 Counter accepted: "+DATA.platform(o.platform).name+" raised their offer for “"+o.filmTitle+"” to "+fmtM(o.value),"good");
  }else if(chance(.5)){
    G.offers=G.offers.filter(x=>x.id!==o.id);
    log("📉 "+DATA.platform(o.platform).name+" walked away from “"+o.filmTitle+"”.","bad");
  }else{
    log("🤨 They grumbled but the original offer stands for “"+o.filmTitle+"”.","");
  }
  saveGame();
}
function declineOffer(o){
  G.offers = G.offers.filter(x=>x.id!==o.id);
  if(o.type==="renewal"){
    const s=G.series.find(x=>x.id===o.seriesId);
    if(s){ s.status="ended"; log("🚫 You declined renewal — “"+s.title+"” ends after "+s.seasons.length+" season(s).",""); }
  }
  saveGame();
}

/* ═══════════ series ═══════════ */
function seriesTitle(){
  let t = pick(DATA.SERIES_TITLES.a)+" "+pick(DATA.SERIES_TITLES.b);
  if(G.series.some(s=>s.title===t)) t += ": "+pick(["Origins","Legacy","Files","Nights"]);
  return t;
}
function pitchSeries(cfg){
  // cfg: {genre, eps, perEp, platformId, showrunner(director), cast[]}
  const plat = DATA.platform(cfg.platformId);
  const budget = cfg.eps*cfg.perEp;
  const concept = clamp(rint(50,80)+G.studio.devBonus*2, 40, 95);
  const taste = plat.taste[cfg.genre]||1;
  const p = 0.22 + concept/160 + (taste-1)*0.6 + G.studio.rep/400 + (cfg.perEp>=8?0.06:0) + (G.upgrades.ottrel?0.05:0);
  const s = {
    id:nid(), kind:"series", title:seriesTitle(), genre:cfg.genre, platform:cfg.platformId,
    eps:cfg.eps, perEp:cfg.perEp, budget, concept,
    showrunner:cfg.showrunner||null, cast:cfg.cast||[],
    seasons:[], phase:"shoot", weeksLeft:Math.round(cfg.eps*1.2+6),
    weeksLeft0:Math.round(cfg.eps*1.2+6),
    spent:0, status:"producing", viewership:0,
  };
  if(chance(clamp(p,0.12,0.9))){
    G.series.push(s);
    G.studio.cash -= (cfg.showrunner?actorFee(cfg.showrunner):0) + (cfg.cast||[]).reduce((a,c)=>a+actorFee(c),0);
    if(cfg.showrunner){cfg.showrunner.bookedUntil=G.week+s.weeksLeft; cfg.showrunner.booked=s.title;}
    (cfg.cast||[]).forEach(c=>{c.bookedUntil=G.week+s.weeksLeft; c.booked=s.title;});
    log("📺 "+plat.name+" greenlit “"+s.title+"” — "+cfg.eps+" eps × "+fmtM(cfg.perEp)+" ("+fmtM(budget)+" season budget).","gold");
    return {ok:true, s};
  }
  log("🚫 "+plat.name+" passed on your "+DATA.GENRES[cfg.genre].name+" pitch. Back to the whiteboard.","bad");
  return {ok:false};
}
function seriesQuality(s){
  const dirScore = s.showrunner? s.showrunner.skill*(s.showrunner.genreFit===s.genre?1.08:0.96):56;
  const castScore = s.cast.length? s.cast.reduce((a,c)=>a+c.skill,0)/s.cast.length:55;
  let q = 0.3*s.concept + 0.25*dirScore + 0.2*castScore + 0.25*(45+55*clamp(s.perEp/12,0.4,1.1));
  return clamp(Math.round(q+gauss()*5), 10, 97);
}
function tickSeries(){
  for(const s of G.series){
    if(s.phase==="shoot"){
      const burn = s.budget/(s.weeksLeft0||s.weeksLeft||1);
      s.spent += burn; G.studio.cash -= burn;
      s.weeksLeft--;
      if(s.weeksLeft<=0) deliverSeason(s);
    }else if(s.phase==="airing"){
      s.airWeeks--;
      if(s.airWeeks<=0) finishSeason(s);
    }
  }
}
function deliverSeason(s){
  const plat=DATA.platform(s.platform);
  const q=seriesQuality(s);
  const num=s.seasons.length+1;
  const margin = 1.15 + G.studio.rep/500 + (G.upgrades.ottrel?0.05:0);
  const license = Math.round(s.budget*margin);
  G.studio.cash += license;
  s.seasons.push({num, quality:q, license, viewership:0});
  // talent free
  if(s.showrunner){s.showrunner.bookedUntil=0;}
  s.cast.forEach(c=>{c.bookedUntil=0;});
  const v = clamp(Math.round(0.45*q + 16 + G.studio.rep/9 + (plat.taste[s.genre]||1)*8 + gauss()*6), 5, 99);
  s.pendingV = v;
  s.phase="airing"; s.airWeeks=4;
  G.stats.seriesSeasons++;
  log("📺 “"+s.title+"” S"+num+" dropped on "+plat.name+". License: "+fmtM(license)+".","gold");
}
function finishSeason(s){
  const plat=DATA.platform(s.platform);
  const season=s.seasons[s.seasons.length-1];
  season.viewership=s.pendingV; s.viewership=s.pendingV;
  const vLabel = season.viewership>=75? "a phenomenon 🔥": season.viewership>=58? "a hit": season.viewership>=45? "so-so": "a flop";
  log("📊 “"+s.title+"” S"+season.num+" completed its run — "+vLabel+" ("+season.viewership+"/100 buzz).", season.viewership>=58?"good":"bad");
  if(season.viewership>=72) G.studio.rep=clamp(G.studio.rep+3,5,99);
  if(season.viewership<40) G.studio.rep=clamp(G.studio.rep-2,5,99);
  const renewAt = plat.renew - (G.upgrades.ottrel?4:0);
  if(season.viewership>=renewAt && season.viewership>0){
    const nextBudget = Math.round(s.budget*1.08);
    const margin = 0.1 + season.viewership/220;
    const value = Math.round(nextBudget*(1+margin));
    s.status="renewal_pending";
    G.offers.push({ id:nid(), type:"renewal", seriesId:s.id, seriesTitle:s.title, seasonNum:season.num+1,
      platform:s.platform, value, budget:nextBudget, eps:s.eps, countered:false, expires:G.week+5 });
    log("📨 "+plat.name+" wants to renew “"+s.title+"” for S"+(season.num+1)+" — "+fmtM(value)+" season order.","");
  }else{
    s.status="ended";
    log("🚫 "+plat.name+" cancelled “"+s.title+"”.","bad");
  }
  s.phase="between";
}
function acceptRenewal(o){
  const s=G.series.find(x=>x.id===o.seriesId); if(!s)return;
  s.budget=o.budget; s.perEp=Math.round(o.budget/s.eps);
  s.weeksLeft0 = s.weeksLeft = Math.round(s.eps*1.2+6);
  s.phase="shoot"; s.status="producing";
  // re-book talent
  if(s.showrunner){s.showrunner.bookedUntil=G.week+s.weeksLeft;}
  s.cast.forEach(c=>{c.bookedUntil=G.week+s.weeksLeft;});
  log("✅ “"+s.title+"” renewed! S"+o.seasonNum+" — "+fmtM(o.value)+" covers a "+fmtM(o.budget)+" season.","gold");
}

/* ═══════════ rivals ═══════════ */
function seedRivalYear(){
  const yr = yearOf(G.week);
  for(const r of G.rivals){
    const count = r.style==="tentpole"? rint(6,9) : r.style==="prestige"? rint(9,13) : rint(11,15);
    const weeks=[];
    for(let i=0;i<count;i++){
      let wk = rint(1,52);
      // bias to corridors by style
      if(r.style==="tentpole" && chance(.7)) wk = pick([18,19,20,21,22,23,24,25,26,27,28,45,46,47,48,49,50,51]);
      if(r.style==="prestige" && chance(.6)) wk = pick([...range(36,44),...range(45,50),...range(1,6)]);
      if(weeks.includes(wk)){ i--; continue; }
      weeks.push(wk);
    }
    r.slate = weeks.map(wk=>{
      let scale = r.style==="tentpole"? pick(["tentpole","tentpole","mid"]) : r.style==="prestige"? pick(["mid","indie","mid"]) : pick(["mid","mid","indie","tentpole"]);
      let genre;
      if(r.style==="tentpole") genre = pick(["action","action","scifi","fantasy","animation"]);
      else if(r.style==="prestige") genre = pick(["drama","drama","musical","thriller","romance"]);
      else genre = pick(Object.keys(DATA.GENRES));
      const S=DATA.SCALES[scale];
      const q = clamp(rint(40,90) + gauss()*8, 20, 96);
      const weight = S.openBase*DATA.GENRES[genre].mass;
      return { week: (yr-1)*52+wk, title:makeTitle(genre), genre, scale, quality:q, weight,
               opening:0, dom:0, decay:0, weeksOut:0, live:false, dead:false, ytdGross:0 };
    });
  }
}
function range(a,b){ const r=[]; for(let i=a;i<=b;i++)r.push(i); return r; }
function tickRivals(){
  for(const r of G.rivals){
    for(const f of r.slate){
      if(f.week===G.week){
        // release
        let opening = f.weight * (0.8+rnd()*0.45) * DATA.seasonOf(woyOf(G.week)).season;
        // competition vs your films this weekend
        const mine = G.films.filter(x=>x.releaseWeek===G.week).map(x=>x.opening);
        const myW = mine.reduce((a,b)=>a+Math.pow(b,0.8),0);
        if(myW>0){
          const share = Math.pow(f.weight,0.8)/(Math.pow(f.weight,0.8)+myW);
          opening *= clamp(Math.pow(share,0.55)*1.08, 0.15, 1.08);
        }
        if(G.theaterCap>0) opening*=0.55;
        f.opening = clamp(opening, 0.5, 320); f.dom=opening; f.live=true; f.weeksOut=1; f.decay=0;
      }else if(f.live){
        if(!f.decay){
          const legs = clamp(1.6+(f.quality-30)*0.028+DATA.GENRES[f.genre].legsAdj,1.45,4.0);
          f.decay = 1-1/legs;
        }
        let gross = f.opening*Math.pow(f.decay, f.weeksOut);
        if(G.theaterCap>0) gross*=0.55;
        if(seasonOfW(G.week).holiday) gross*=1.18;
        f.weeksOut++;
        if(gross<Math.max(0.4,f.opening*0.006)||f.weeksOut>16){ f.live=false; f.dead=true; }
        else f.dom+=gross;
      }
    }
    r.ytd = r.slate.filter(f=>f.week>(yearOf(G.week)-1)*52).reduce((a,f)=>a+(f.dead||f.live? f.dom:0),0);
  }
}

/* ═══════════ chart ═══════════ */
function weeklyChart(){
  const rows=[];
  for(const f of G.films){
    const last=[...f.weekly].reverse().find(x=>x.w===G.week);
    if(last) rows.push({title:f.title, gross:last.gross, mine:true, genre:f.genre, weeksOut:f.weeksOut});
  }
  for(const r of G.rivals) for(const f of r.slate){
    if(f.live && f.weeksOut>1){ /* their current-week gross tracked implicitly in dom diff */ }
  }
  // rivals: approximate current weekly = opening*decay^ (weeksOut-1) — recompute
  for(const r of G.rivals) for(const f of r.slate){
    if(!f.live) continue;
    if(f.week===G.week){ rows.push({title:f.title, gross:f.opening, mine:false, studio:r.name, color:r.color, genre:f.genre, weeksOut:1}); }
    else{
      const legs=clamp(1.6+(f.quality-30)*0.028+DATA.GENRES[f.genre].legsAdj,1.45,4.0);
      const d=1-1/legs;
      let g=f.opening*Math.pow(d, f.weeksOut-1);
      if(G.theaterCap>0)g*=0.55; if(seasonOfW(G.week).holiday)g*=1.18;
      rows.push({title:f.title, gross:g, mine:false, studio:r.name, color:r.color, genre:f.genre, weeksOut:f.weeksOut});
    }
  }
  rows.sort((a,b)=>b.gross-a.gross);
  return rows.slice(0,8);
}

/* ═══════════ finance ═══════════ */
function catalogValue(){
  let v=0;
  for(const f of G.films){
    let base=(f.budget*0.2 + (f.ww||0)*0.025);
    if(f.soldTo||f.streamingOriginal) base*=0.45;
    base += (f.awards||[]).length*8;
    v+=base;
  }
  return v;
}
function maxDebt(){
  const inProd=G.projects.reduce((a,p)=>a+p.budget*0.55,0) + G.series.reduce((a,s)=>a+(s.phase==="shoot"?s.budget*0.55:0),0);
  return 150 + catalogValue()*0.6 + inProd;
}
function takeLoan(amount){
  amount=Math.min(Math.round(amount), Math.round(maxDebt()-G.studio.debt));
  if(amount<=0) return false;
  G.studio.debt+=amount; G.studio.cash+=amount;
  log("🏦 Borrowed "+fmtM(amount)+". Weekly interest accrues.","");
  saveGame(); return true;
}
function repayDebt(amount){
  amount=Math.min(Math.round(amount), G.studio.debt, Math.max(0,Math.floor(G.studio.cash)));
  if(amount<=0) return false;
  G.studio.debt-=amount; G.studio.cash-=amount;
  log("🏦 Repaid "+fmtM(amount)+" of debt.","good");
  saveGame(); return true;
}
function tickFinance(){
  const st=G.studio;
  const overhead = st.overhead + G.projects.length*0.12 + (G.series.filter(s=>s.phase==="shoot").length*0.15);
  st.cash -= overhead;
  if(st.debt>0){ const int=Math.round(st.debt*0.0018*10)/10; st.cash-=int; st.debt+=int; }
  if(G.investorDebt>0){
    const pay=Math.min(G.investorDebt, 2.5);
    G.investorDebt-=pay; st.cash-=pay; G.investorPaid=(G.investorPaid||0)+pay;
    if(G.investorDebt<=0) log("🕴 Investor buyout fully repaid.","good");
  }
  const cat = catalogValue()*0.0045;
  st.cash += cat;
  // negative cash becomes debt
  if(st.cash<0){ st.debt += -st.cash; st.cash=0; }
  // bankruptcy check: net debt (debt minus cash) deep beyond the credit line for 3 straight weeks
  const netDebt = st.debt - Math.max(st.cash,0);
  if(netDebt > maxDebt()*1.15){ G.weeksInDebt++; if(G.weeksInDebt>=3) gameOver("Bankruptcy","Net debt ("+fmtM(netDebt)+") stayed beyond your credit line ("+fmtM(maxDebt())+") for 3 straight weeks. The bank seized the lot."); }
  else G.weeksInDebt=0;
}
function buyUpgrade(id){
  const u=DATA.UPGRADES.find(x=>x.id===id); if(!u||G.upgrades[id]) return;
  if(G.studio.cash<u.cost) return;
  G.studio.cash-=u.cost; G.upgrades[id]=true;
  log(u.icon+" Built: "+u.name+" ("+fmtM(u.cost)+")","gold");
  saveGame();
}

/* ═══════════ awards (year end) ═══════════ */
function runAwards(){
  const yr=yearOf(G.week)-1;
  const mine=G.films.filter(f=>f.year===yr && f.awardsEligible);
  const noms=[];
  for(const f of mine){
    const g=DATA.GENRES[f.genre];
    const prestige=f.quality.critic*(0.6+g.awards*0.5);
    if(prestige>=55) noms.push({title:f.title, f, prestige, mine:true});
  }
  // rival prestige entries
  for(const r of G.rivals){
    const cnt=r.style==="prestige"?4:2;
    for(let i=0;i<cnt;i++){
      const g=pick(Object.keys(DATA.GENRES));
      const q=rint(55,93);
      noms.push({title:makeTitle(g), prestige:q*(0.6+DATA.GENRES[g].awards*0.5), mine:false, studio:r.name});
    }
  }
  noms.sort((a,b)=>b.prestige-a.prestige);
  const field=noms.slice(0,8);
  const results={noms:field, wins:[]};
  if(field.length){
    // best picture: weighted by prestige^2
    const tot=field.reduce((a,n)=>a+Math.pow(n.prestige,2),0);
    let r=rnd()*tot, winner=field[0];
    for(const n of field){ r-=Math.pow(n.prestige,2); if(r<=0){winner=n;break;} }
    results.bestPicture=winner;
    if(winner.mine){
      const f=winner.f;
      f.awards=f.awards||[]; f.awards.push("Best Picture");
      f.dom+=15; f.ww+=20; f.studioRev+=15; G.studio.cash+=15;
      G.studio.rep=clamp(G.studio.rep+7,5,99);
      G.stats.awards.push({year:yr, cat:"Best Picture", film:f.title});
      log("🏆 BEST PICTURE: “"+f.title+"”! +7 reputation, re-release bump.","gold");
      results.wins.push({cat:"Best Picture", film:f.title, mine:true});
    }else{
      results.wins.push({cat:"Best Picture", film:winner.title, mine:false, studio:winner.studio});
      log("🏆 "+DATA.AWARDS+": Best Picture went to “"+winner.title+"” ("+winner.studio+").","");
    }
    // acting/directing
    const myNoms=field.filter(n=>n.mine);
    if(myNoms.length){
      if(chance(.6)){
        const n=pick(myNoms); n.f.awards=n.f.awards||[];
        const cat=pick(["Best Director","Best Actor","Best Actress"]);
        n.f.awards.push(cat); G.studio.rep=clamp(G.studio.rep+3,5,99);
        G.stats.awards.push({year:yr, cat, film:n.f.title});
        log("🏆 "+cat+": “"+n.f.title+"” takes it home. +3 reputation.","gold");
        results.wins.push({cat, film:n.f.title, mine:true});
      }
    }
  }else{
    log("礼服 Season came and went. No nominations for "+G.studio.name+".","bad");
  }
  return results;
}
function yearWrap(){
  const yr=yearOf(G.week)-1;
  const myWW=G.films.filter(f=>f.year===yr).reduce((a,f)=>a+(f.ww||0),0);
  G.stats.totalWWAll=G.stats.totalWW;
  const standings=[{name:G.studio.name, ww:myWW, me:true}]
    .concat(G.rivals.map(r=>({name:r.name, ww:r.slate.filter(f=>yearOf(f.week)===yr).reduce((a,f)=>a+f.dom/(1-DATA.GENRES[f.genre].intlShare),0)})));
  standings.sort((a,b)=>b.ww-a.ww);
  G.stats.shareHistory.push({year:yr, standings:standings.map(s=>({name:s.name, ww:Math.round(s.ww), me:s.me}))});
  const awards=runAwards();
  G.pendingReport={ year:yr, myWW, standings, awards,
    filmsReleased:G.films.filter(f=>f.year===yr).length,
    profit:G.films.filter(f=>f.year===yr).reduce((a,f)=>a+(f.profit||0),0) };
  seedRivalYear();
}

/* ═══════════ events ═══════════ */
function tickEvents(){
  if(!chance(0.34)) return;
  const pool=DATA.EVENTS.filter(e=>!e.when||e.when(G));
  if(!pool.length) return;
  const totW=pool.reduce((a,e)=>a+e.w,0);
  let r=rnd()*totW, ev=pool[0];
  for(const e of pool){ r-=e.w; if(r<=0){ev=e;break;} }
  if(ev.kind==="choice"){
    G.pendingChoice={ icon:ev.icon, title:ev.title, text:(typeof ev.text==="function"? ev.text(G):ev.text),
      choices:ev.choices(G).map((c,i)=>({label:c.label, i})) };
    G._evtRun=ev.choices(G);
  }else{
    ev.run(G);
  }
}
function resolveChoice(i){
  const c=G._evtRun && G._evtRun[i];
  if(c && typeof c.run==="function") c.run(G);
  G.pendingChoice=null; G._evtRun=null;
  saveGame();
}

/* ═══════════ game over ═══════════ */
function gameOver(title, text){
  if(G.over) return;
  G.over={title, text, week:G.week, stats:G.stats};
  saveGame();
}

/* ═══════════ the weekly tick ═══════════ */
function advanceWeek(){
  if(!G||G.over) return [];
  G.week++;
  G.flash=[];
  tickFinance();
  tickProjects();
  // releases due (or overdue — safety net)
  for(const p of [...G.projects]){
    if(p.phase==="ready" && !p.prebuyAccepted && p.releaseWeek && p.releaseWeek<=G.week){
      const rest = p.marketing - p.marketingPaid;
      G.studio.cash -= Math.max(0,rest);
      releaseFilm(p);
    }
  }
  tickTheatrical();
  tickSeries();
  tickRivals();
  maybeOttOffers();
  // offer expiry
  G.offers=G.offers.filter(o=>o.expires>=G.week || o.type==="renewal");
  refreshIdeas();
  if(chance(.18)) G.talent.push(chance(.6)?genActor(chance(.2)):genDirector(chance(.2)));
  G.talent=G.talent.filter(t=>!t.bookedUntil||t.bookedUntil>=G.week-30).slice(-46);
  tickEvents();
  if(G.streamWar>0)G.streamWar--;
  if(G.theaterCap>0)G.theaterCap--;
  if(woyOf(G.week)===1 && G.week>1) yearWrap();
  saveGame();
  return G.flash;
}
function advanceWeeks(n){
  for(let i=0;i<n;i++){
    if(G.over||G.pendingChoice||G.pendingReport) break;
    advanceWeek();
  }
}

/* ═══════════ misc getters for UI ═══════════ */
function activeFilms(){ return G.films.filter(f=>f.inTheaters); }
function readyProjects(){ return G.projects.filter(p=>p.phase==="ready"); }
function inProdProjects(){ return G.projects.filter(p=>["pre","shoot","post"].includes(p.phase)); }
function seasonDateLabel(w){ const s=DATA.seasonOf(woyOf(w)); return s.month+" Y"+yearOf(w); }
