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
    projects:[], films:[], series:[], offers:[], ideas:[], franchises:[],
    weekTx:{}, txHistory:[], pendingAuction:null,
    talent:[],
    rivals: DATA.RIVALS_DEF.map(r=>({ ...r, slate:[], ytd:0, filmsLive:[] })),
    news:[], flash:[],
    stats:{ films:0, seriesSeasons:0, totalWW:0, totalProfit:0, hits:0, flops:0, awards:[],
            bestOpen:0, bestFilm:null, shareHistory:[] },
    investorDebt:0, investorPaid:0,
    streamWar:0, theaterCap:0,
    infl:1, execs:{}, lastClass:yearOf(1),
    streamer:null, pendingSports:null, sportsAuction:null, sportsWon:[], exhibitor:50, achv:[],
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

/* ═══════════ P&L ledger: every dollar flows through here ═══════════ */
function earn(cat, amt){
  if(!G || !amt) return;
  amt = Math.round(amt*10)/10;
  G.studio.cash += amt;
  G.weekTx[cat] = Math.round(((G.weekTx[cat]||0)+amt)*10)/10;
}
function spend(cat, amt){
  if(!G || !amt) return;
  amt = Math.round(amt*10)/10;
  G.studio.cash -= amt;
  G.weekTx[cat] = Math.round(((G.weekTx[cat]||0)-amt)*10)/10;
}
function weekNet(tx){ let n=0; for(const k in tx){ if(k!=="financing") n+=tx[k]; } return Math.round(n*10)/10; }

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
function actorFee(t){ return t.fee * (1+0.25*t.heat) * (G.upgrades.agency?0.85:1) * (G.execs && G.execs.cast ? 0.90 : 1); }

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
  const rate = DATA.rating(p.rating);
  const critic = clamp(Math.round(overall + g.critic + (rate?rate.critic:0) + gauss()*3), 5, 99);
  const aud    = clamp(Math.round(overall + g.aud + Math.min(p.cast.reduce((s,c)=>s+c.power,0),8)*1.2 + gauss()*3), 5, 99);
  return { overall, critic, aud };
}
function recMarketing(p){ return Math.round(p.budget*DATA.SCALES[p.scale].mktRate*(G.infl||1)); }
function expectedOpening(p, weekAbs){
  const S=DATA.SCALES[p.scale], g=DATA.GENRES[p.genre];
  let base = S.openBase * g.mass * (g.openBoost||1) * (G.infl||1);
  const starP = p.cast.reduce((s,c)=>s+c.power,0);
  const starF = 1 + 0.075*Math.min(starP, 6); // cap ≈ 1.45
  const rec = recMarketing(p);
  const mktF = clamp(Math.pow(Math.max(p.marketing,1)/rec, 0.45), 0.5, 1.55) * (G.upgrades.marketing?1.10:1) * (G.execs && G.execs.cmo ? 1.12 : 1);
  const season = seasonOfW(weekAbs).season;
  const fr = p.franchise? 1.35 : 1;
  const repF = 0.92 + G.studio.rep/600;
  const comp = competitionFactor(p, weekAbs);
  const rate = DATA.rating(p.rating);
  let hype = base*starF*mktF*season*fr*repF*comp*(1+(p.buzzBonus||0));
  hype *= (1 + (rate?rate.open:0));         // R = −12% opening
  if(p.premium) hype *= 1.12;               // IMAX/premium = +12% opening
  hype *= (0.95 + (G.exhibitor||50)/1000);  // exhibitor relations ±5%
  if(p.dayAndDate) hype *= 0.65;            // day-and-date = −35% opening
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
  const rate = DATA.rating(p.rating);
  let w = S.openBase * DATA.GENRES[p.genre].mass * (G.infl||1) * (p.franchise?1.35:1)
    * (1+(rate?rate.open:0)) * (p.premium?1.12:1)
    * (0.95 + (G.exhibitor||50)/1000)
    * (p.dayAndDate?0.65:1)
    * clamp(Math.pow(Math.max(p.marketing,1)/Math.max(recMarketing(p),1),0.45),0.6,1.5);
  return w;
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
function breakevenWW(p){ // worldwilde gross needed
  return (p.budget + (p.marketing||recMarketing(p))) / 0.48;
}

/* ═══════════ greenlight ═══════════ */
function devCostOf(idea){
  const base = { indie:2, mid:5, tentpole:12 }[idea.scale];
  return base + (idea.hot? rint(2,6):0);
}
function greenlight(cfg){
  // cfg: {idea, director, cast[], budget, sequelOf, rating, location, scriptPolish, premium}
  const idea = cfg.idea;
  const S = DATA.SCALES[idea.scale];
  const fees = (cfg.director? actorFee(cfg.director):0) + cfg.cast.reduce((s,c)=>s+actorFee(c),0);
  let dev = devCostOf(idea);
  const polish = !!cfg.scriptPolish;
  if(polish) dev += Math.round(dev*0.4);   // script polish costs ~40% of dev rights, +1 wk pre
  const p = {
    id:nid(), kind:"film", title:idea.title, genre:idea.genre, scale:idea.scale,
    script: idea.script + (polish?6:0), blurb: idea.blurb, hot:idea.hot,
    budget: cfg.budget, spent:0, devCost:dev,
    director: cfg.director, cast: cfg.cast,
    rating: cfg.rating || "PG-13", location: cfg.location || "la",
    premium: !!cfg.premium, scriptPolish: polish, window: cfg.window || "45", dayAndDate: !!cfg.dayAndDate,
    phase:"pre", phaseWeek:0,
    phaseLen:{ pre:rint(...S.pre)+(polish?1:0), shoot:rint(...S.shoot), post:rint(...S.post) },
    releaseWeek:0, marketing:0, marketingPaid:0,
    franchise: !!(cfg.sequelOf && cfg.sequelOf.franchiseable) || !!(cfg.sequelOf),
    sequelOf: cfg.sequelOf? cfg.sequelOf.id : null,
    buzzBonus: cfg.sequelOf? 0.15 : 0,
    strikePause:0,
  };
  if(cfg.sequelOf){ p.title = sequelTitle(cfg.sequelOf.title); p.franchiseName = cfg.sequelOf.franchiseName || cfg.sequelOf.title; }
  spend("development", dev);
  spend("talent", fees);
  p.plan = cfg.plan || "theatrical";
  const starP = cfg.cast.reduce((s,c)=>s+c.power,0);
  if(starP>=8){ p.backend = 0.05; }
  if(cfg.presales && p.plan!=="streaming"){
    p.presales = Math.round(p.budget*0.22);
    earn("presales", p.presales);
    log("🌍 International pre-sales on “"+p.title+"”: +"+fmtM(p.presales)+" (intl box office now goes to the buyers).","");
  }
  // book talent
  const total = p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post;
  if(cfg.director){ cfg.director.bookedUntil = G.week+total; cfg.director.booked = p.title; }
  cfg.cast.forEach(c=>{ c.bookedUntil=G.week+total; c.booked=p.title; });
  G.projects.push(p);
  G.ideas = G.ideas.filter(i=>i.id!==idea.id);
  log("🎬 Greenlit: “"+p.title+"” ("+DATA.GENRES[p.genre].name+", "+fmtM(cfg.budget)+" budget) — "+({theatrical:"theatrical release",streaming:"streaming original",later:"decide distribution later"})[p.plan],"gold");
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
    if(p.phase==="pre")  burn = p.budget*0.10/Math.max(1,L.pre);
    if(p.phase==="shoot"){ burn = p.budget*0.70/Math.max(1,L.shoot) * (G.upgrades.backlot?0.88:1); }
    if(p.phase==="post") burn = p.budget*0.20/Math.max(1,L.post) * (G.upgrades.vfx?0.75:1);
    if(p.phase==="reshoot") burn = p.budget*0.08/Math.max(1,(L.reshoot||3));
    burn = Math.round(burn*10)/10;
    spend("production", burn); p.spent += burn;
    if(p.phase==="shoot") earn("incentives", burn*DATA.location(p.location).rebate);
    if(p.phaseWeek >= (L[p.phase]||1)){
      p.phaseWeek=0;
      if(p.phase==="pre") p.phase="shoot";
      else if(p.phase==="shoot") p.phase="post";
      else if(p.phase==="reshoot"){
        p.reshootBonus = (p.reshootBonus||0) + rint(4,9);
        p.quality = computeQuality(p);
        p.quality.overall = clamp(p.quality.overall + p.reshootBonus, 8, 98);
        p.quality.critic  = clamp(p.quality.critic  + Math.round(p.reshootBonus/2), 5, 99);
        p.phase="ready";
        log("🎬 Reshoot complete on “"+p.title+"” — test audience score now "+p.quality.overall+"/100.","good");
      }
      else if(p.phase==="post"){
        p.quality = computeQuality(p);
        if(p.prebuyAccepted){
          finishStreamingOriginal(p);
        }else if(p.plan==="streaming"){
          p.phase="ready";
          log("🎞 “"+p.title+"” is finished! Score: "+p.quality.overall+"/100. Shopping it to the streamers…","good");
          G.pendingAuction = { projectId:p.id, bids:makeAuctionBids(p), manual:false };
        }else{
          p.phase="ready";
          log("🎞 “"+p.title+"” is finished! Score: "+p.quality.overall+"/100. Date it theatrically or shop it to streamers.","good");
          maybePrebuyOffer(p);
        }
      }
    }
  }
}
function finishStreamingOriginal(p){
  const plat = DATA.platform(p.prebuyPlatform);
  const pay = p.prebuyValue;
  earn("streaming", pay);
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

/* ═══════════ test screenings & reshoots (v2) ═══════════ */
function testScreenResult(p){
  // simulated preview audience vs the film's critic score
  const gap = rint(-10, 8);
  const screen = clamp(p.quality.overall + Math.round(gap/2), 20, 98);
  return { screen, crit: p.quality.overall, flagged: screen < p.quality.overall - 3,
           buzz: chance(0.22) ? 0.05 : 0 };
}
function beginReshoot(pid){
  const p=G.projects.find(x=>x.id===pid); if(!p || p.phase!=="ready") return false;
  const weeks = rint(2,4);
  p.phase="reshoot"; p.phaseWeek=0;
  if(!p.phaseLen) p.phaseLen={};
  p.phaseLen.reshoot = weeks;
  const fee = Math.round(p.budget*0.12);
  spend("production", fee); p.spent+=fee; p.reshootFee=fee;
  log("🎬 “"+p.title+"” goes back to the lot for reshoots — "+fmtM(fee)+", ~"+weeks+" weeks. Test audiences wanted more.","gold");
  saveGame();
  return true;
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
    rating:p.rating, premium:!!p.premium, location:p.location,
    releaseWeek:G.week, opening, weekly:[{w:G.week, gross:opening}],
    dom:opening, ww:0, studioRev:0, legs:0, decay:0, rentalsDom:opening*0.53,
    presales:p.presales||0, backend:p.backend||0,
    window:p.window||"45", dayAndDate:!!p.dayAndDate, onOwn:!!p.dayAndDate,
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
  const fr0 = film.franchiseName && G.franchises.find(x=>x.name===film.franchiseName);
  if(fr0) fr0.decay = 1;
  if(opening>G.stats.bestOpen){ G.stats.bestOpen=opening; G.stats.bestFilm=film.title; }
  earn("theatrical", opening*0.53);
  const label = opening>=100? "💥 MASSIVE opening": opening>=40? "🔥 Strong opening": opening>=12? "▶ Solid opening":"🎪 Limited release";
  log(label+": “"+film.title+"” opens to "+fmtG(opening)+" domestic (+"+fmtM(opening*0.53)+" rentals this week).","gold");
  // talent heat on big opens
  if(opening>=60) p.cast.forEach(c=>{ c.heat=Math.min(3,c.heat+1); });
  // exhibitor relations swing with the theatrical window you chose
  const win = DATA.window(film.window||"45");
  if(win && win.exh){ G.exhibitor = clamp((G.exhibitor||50) + win.exh, 0, 100); }
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
    const rentals = gross*0.53;
    earn("theatrical", rentals);
    f.rentalsDom = (f.rentalsDom||0) + rentals;
  }
}
function endTheatrical(f){
  f.inTheaters=false;
  const intlGross = f.dom/(1-DATA.GENRES[f.genre].intlShare) - f.dom;
  f.ww = f.dom + intlGross;
  let intlRentals = 0;
  if(!f.presales){ intlRentals = intlGross*0.42; earn("theatrical", intlRentals); }
  const win = DATA.window(f.window||"45");
  const pvod = Math.round(f.ww*0.055*clamp(f.quality.overall/70,0.7,1.4)*(win?win.pvod:1));
  f.pvod = pvod; earn("pvod", pvod);
  if(!f.streamingOriginal && !f.onOwn){ f.pay1Rate=0.06; f.pay1At=G.week+6; }  // PVOD → pay-1 ladder
  // day-and-date also boosts your streamer once the run ends
  if(f.dayAndDate && G.streamer){ G.streamer.subs = Math.round((G.streamer.subs + 0.2 + (f.quality.overall/100))*100)/100; }
  let backendPay = 0;
  if(f.backend){ backendPay = (f.rentalsDom + intlRentals)*f.backend; spend("talent", backendPay); }
  f.backendPaid = backendPay;
  f.studioRev = f.rentalsDom + intlRentals + pvod - backendPay;
  f.profit = f.studioRev + f.presales - f.budget - f.marketing - (f.devCost||0);
  G.stats.totalWW += f.ww; G.stats.totalProfit += f.profit;
  const be = breakevenWW(f);
  const verdict = f.ww>=be*1.6? "SMASH HIT": f.ww>=be? "HIT": f.ww>=be*0.75? "disappointment": "FLOP";
  if(f.ww>=be) G.stats.hits++; else G.stats.flops++;
  const dRep = f.ww>=be*1.6? 6: f.ww>=be? 3: f.ww>=be*0.75? -2: -4;
  G.studio.rep = clamp(G.studio.rep + dRep*(G.studio.flopPenalty||1), 5, 99);
  if(f.quality.overall>=66 && f.ww>=be*1.9){
    f.franchiseable=true;
    upsertFranchise(f);
    log("🏆 “"+f.title+"” final: "+fmtG(f.ww)+" WW — "+verdict+". Franchise unlocked — see 🏰 Empire!","gold");
  }else{
    log("🏁 “"+f.title+"” ends its run: "+fmtG(f.ww)+" WW — "+verdict+" ("+(f.profit>=0?"+":"")+fmtM(f.profit)+" net; "+fmtM(f.studioRev)+" rentals received).", f.profit>=0?"good":"bad");
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
  let value = (f.budget*0.5 + f.ww*0.06) * g.otta * chosen.p.generosity * qualityFactorOTT(f) * (G.infl||1);
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
  const value = Math.round(p.budget*margin*chosen.x.generosity*(G.streamWar>0?1.25:1)*(G.infl||1));
  G.offers.push({ id:nid(), type:"prebuy", projectId:p.id, filmTitle:p.title, platform:chosen.x.id,
    value, countered:false, expires:G.week+4 });
  log("📨 "+chosen.x.name+" offers to buy “"+p.title+"” as a streaming original: "+fmtM(value)+" (no theatrical run).","");
}
/* ═══ OTT auction: shop a finished film to streamers ═══ */
function makeAuctionBids(p){
  const q=p.quality.overall, g=DATA.GENRES[p.genre];
  const hype=1+(p.buzzBonus||0);
  const cand=DATA.PLATFORMS.map(pl=>({pl,s:pl.generosity*(pl.taste[p.genre]||1)})).sort((a,b)=>b.s-a.s).slice(0,3);
  return cand.map(({pl,s})=>({ platform:pl.id,
    value:Math.max(3, Math.round(p.budget*(0.85+q/160)*g.otta*s*hype*(0.95+rnd()*0.22)*(G.streamWar>0?1.3:1)*(G.upgrades.ottrel?1.12:1)*(G.infl||1)))
  })).sort((a,b)=>b.value-a.value);
}
function shopToStreamers(pid){
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="ready") return;
  G.pendingAuction={ projectId:pid, bids:makeAuctionBids(p), manual:true };
}
function acceptAuction(i){
  const a=G.pendingAuction; if(!a) return;
  const bid=a.bids[i]; const p=G.projects.find(x=>x.id===a.projectId);
  G.pendingAuction=null;
  if(!p||!bid) return;
  earn("streaming", bid.value);
  const plat=DATA.platform(bid.platform);
  const f={ id:p.id, title:p.title, genre:p.genre, scale:p.scale, budget:p.budget,
    marketing:p.marketingPaid||0, devCost:p.devCost||0, quality:p.quality,
    streamingOriginal:true, platform:plat.name, soldTo:plat.name,
    releaseWeek:G.week, weekly:[], dom:0, ww:0, rentalsDom:0, studioRev:bid.value,
    profit:bid.value-p.budget-(p.devCost||0)-(p.marketingPaid||0),
    inTheaters:false, awardsEligible:true, year:yearOf(G.week) };
  G.films.push(f);
  G.projects=G.projects.filter(x=>x!==p);
  G.stats.films++; G.stats.totalProfit+=f.profit;
  if(p.director){ p.director.bookedUntil=0; p.director.booked=null; }
  p.cast.forEach(c=>{ c.bookedUntil=0; c.booked=null; });
  log("🤝 Sold “"+p.title+"” to "+plat.name+" as a streaming original for "+fmtM(bid.value)+" (no theatrical run).","gold");
  saveGame();
}
function declineAuction(){
  const a=G.pendingAuction; if(!a) return;
  if(!a.manual){
    const p=G.projects.find(x=>x.id===a.projectId);
    if(p && p.phase==="ready") log("🎥 Keeping “"+p.title+"” — date it theatrically whenever you're ready.","");
  }
  G.pendingAuction=null; saveGame();
}

function acceptOffer(o){
  if(o.type==="film_ott"){
    const f = G.films.find(x=>x.id===o.filmId); if(!f) return;
    earn("streaming", o.value); f.soldTo = DATA.platform(o.platform).name; f.soldValue=o.value;
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
    spend("talent", (cfg.showrunner?actorFee(cfg.showrunner):0) + (cfg.cast||[]).reduce((a,c)=>a+actorFee(c),0));
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
      s.spent += burn; spend("production", burn);
      earn("incentives", burn*0.06);
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
  const license = Math.round(s.budget*margin*(G.infl||1));
  earn("series", license);
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
    const value = Math.round(nextBudget*(1+margin)*(G.infl||1));
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
      const weight = S.openBase*DATA.GENRES[genre].mass*(G.infl||1);
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
  for(const fr of G.franchises){ v += fr.tier*15 + fr.merch*10 + fr.park*45; }
  return v;
}
function maxDebt(){
  const inProd=G.projects.reduce((a,p)=>a+p.budget*0.55,0) + G.series.reduce((a,s)=>a+(s.phase==="shoot"?s.budget*0.55:0),0);
  return 150 + catalogValue()*0.6 + inProd;
}

/* ═══════════ 12-week cash-flow forecast (v2) ═══════════ */
function forecastProject(){
  // rough projection of the next 12 weeks for the Finance view
  if(!G) return {rows:[], start:G?G.studio.cash:0};
  const st=G.studio;
  const rows=[]; let cash=st.cash;
  const overhead = st.overhead + G.projects.length*0.12 + G.series.filter(s=>s.phase==="shoot").length*0.15;
  for(let w=G.week+1; w<=G.week+12; w++){
    let net = -overhead;
    net += catalogValue()*0.0045;               // library licensing
    // production burn + incentives
    for(const p of G.projects){
      if(p.phase==="pre") net -= p.budget*0.10/Math.max(1,p.phaseLen.pre);
      if(p.phase==="shoot") net -= p.budget*0.70/Math.max(1,p.phaseLen.shoot)*(G.upgrades.backlot?0.88:1)*(1-DATA.location(p.location).rebate);
      if(p.phase==="post") net -= p.budget*0.20/Math.max(1,p.phaseLen.post)*(G.upgrades.vfx?0.75:1);
      if(p.phase==="reshoot") net -= p.budget*0.08/Math.max(1,(p.phaseLen.reshoot||3));
    }
    for(const s of G.series){ if(s.phase==="shoot") net -= s.budget/(s.weeksLeft0||1); }
    // scheduled release: remaining P&A
    for(const p of G.projects){
      if(p.releaseWeek===w){ net -= Math.max(0, p.marketing - (p.marketingPaid||0)); }
    }
    // theatrical rentals (decay roughly)
    for(const f of G.films){
      if(!f.inTheaters) continue;
      const d = f.decay || (1-1/legsOf(f));
      let g = f.opening*Math.pow(d,f.weeksOut+(w-G.week));
      if(G.theaterCap>0) g*=0.55;
      if(g<Math.max(0.3,f.opening*0.006)) g=0;
      net += g*0.53;
    }
    // franchise income
    for(const fr of G.franchises) net += frWeeklyIncome(fr);
    // streamer subs + pay-1
    if(G.streamer) net += G.streamer.subs*0.5;
    // mezzanine / debt interest
    if(st.debt>0) net -= st.debt*0.0018*(G.execs&&G.execs.cfo?0.70:1);
    if(st.mezzDebt>0) net -= st.mezzDebt*0.005;
    cash += net;
    rows.push({week:w, net:Math.round(net*10)/10, cash:Math.round(cash*10)/10});
  }
  return {rows, start:st.cash};
}
function takeLoan(amount){
  amount=Math.min(Math.round(amount), Math.round(maxDebt()-G.studio.debt));
  if(amount<=0) return false;
  G.studio.debt+=amount; earn("financing", amount);
  log("🏦 Borrowed "+fmtM(amount)+". Weekly interest accrues.","");
  saveGame(); return true;
}
function repayDebt(amount){
  amount=Math.min(Math.round(amount), G.studio.debt, Math.max(0,Math.floor(G.studio.cash)));
  if(amount<=0) return false;
  G.studio.debt-=amount; spend("financing", amount);
  log("🏦 Repaid "+fmtM(amount)+" of debt.","good");
  saveGame(); return true;
}
function tickFinance(){
  const st=G.studio;
  const overhead = st.overhead + G.projects.length*0.12 + (G.series.filter(s=>s.phase==="shoot").length*0.15);
  spend("overhead", overhead);
  if(st.debt>0){ const int=Math.round(st.debt*0.0018*(G.execs&&G.execs.cfo?0.70:1)*10)/10; spend("interest", int); st.debt+=int; }
  if(st.mezzDebt>0){ const mz=Math.round(st.mezzDebt*0.005*10)/10; spend("interest", mz); st.mezzDebt+=mz; }
  if(G.investorDebt>0){
    const pay=Math.min(G.investorDebt, 2.5);
    G.investorDebt-=pay; spend("financing", pay); G.investorPaid=(G.investorPaid||0)+pay;
    if(G.investorDebt<=0) log("🕴 Investor buyout fully repaid.","good");
  }
  earn("library", catalogValue()*0.0045);
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
  spend("studio", u.cost); G.upgrades[id]=true;
  log(u.icon+" Built: "+u.name+" ("+fmtM(u.cost)+")","gold");
  saveGame();
}

/* ═══════════ executive hires (v2) ═══════════ */
function hireExec(id){
  const e=DATA.EXECS.find(x=>x.id===id); if(!e) return false;
  if(!G.execs) G.execs={};
  if(G.execs[id]) return false;
  if(G.studio.cash<e.cost) return false;
  spend("studio", e.cost); G.execs[id]=true;
  log(e.icon+" Hired: "+e.name+" ("+fmtM(e.cost)+").","gold");
  saveGame();
  return true;
}

/* ═══════════ mezzanine debt (v2) — emergency money at 0.5%/week ═══════════ */
function mezzanineLoan(amount){
  amount=Math.round(amount||0);
  if(amount<=0) return false;
  G.studio.mezzDebt=(G.studio.mezzDebt||0)+amount;
  G.studio.cash+=amount;
  G.weekTx.financing=(G.weekTx.financing||0)+amount;
  log("🪜 Mezzanine loan: +"+fmtM(amount)+" at 0.5%/wk. High-cost emergency money.","gold");
  saveGame();
  return true;
}
function repayMezzanine(amount){
  amount=Math.round(amount||0);
  const md=G.studio.mezzDebt||0;
  amount=Math.min(amount, md, Math.max(0,Math.floor(G.studio.cash)));
  if(amount<=0) return false;
  G.studio.mezzDebt=md-amount; G.studio.cash-=amount;
  G.weekTx.financing=(G.weekTx.financing||0)-amount;
  log("🪜 Mezzanine repaid: "+fmtM(amount)+".","good");
  saveGame();
  return true;
}

/* ═══════════ IPO (v2) — raise $400M at rep 60+; weak quarters get punished ═══════════ */
function goPublic(){
  if(G.public || G.studio.rep < 60) return false;
  G.public = { raise:400, ipoWeek:G.week, strikes:0 };
  G.studio.cash += 400;
  G.weekTx.financing=(G.weekTx.financing||0)+400;
  G.studio.rep = clamp(G.studio.rep+8,5,99);
  log("📊 IPO: you raised $400M (rep ≥60). Shareholders now watch your quarters — a losing streak will sting.","gold");
  saveGame();
  return true;
}
function tickPublic(){
  if(!G.public) return;
  const net = weekNet(G.weekTx||{});
  if(net < 0){ G.public.strikes=(G.public.strikes||0)+1; }
  else if(G.public.strikes>0){ G.public.strikes=Math.max(0,G.public.strikes-0.5); }
  if(G.public.strikes>=4){
    G.studio.rep = clamp(G.studio.rep-3,5,99);
    log("📉 Shareholders punish a weak quarter — rep −3. Fix the P&L.","bad");
    G.public.strikes=0;
  }
}

/* ═══════════ achievements (v3 meta) ═══════════ */
function unlockAchv(id, title, desc){
  G.achv = G.achv||[];
  if(G.achv.some(a=>a.id===id)) return;
  G.achv.push({id, title, desc, week:G.week});
  log("🏅 Achievement unlocked: "+title+" — "+desc,"gold");
}

/* ═══════════ your own streamer (v3) ═══════════ */
function launchStreamer(){
  if(G.streamer || G.studio.rep < 40) return false;
  if(G.studio.cash < 250) return false;
  spend("studio", 250);
  G.streamer = { name:(G.studio.name+"+").slice(0,20), launchedWeek:G.week, subs:2.5, sportsPower:0, churn:0.008, income:0 };
  log("📱 You launched "+G.streamer.name+" — $250M, "+G.streamer.subs+"M subs, $0.5/sub/wk. Build content (films, franchises, shows, sports) to raise your ceiling.","gold");
  unlockAchv("launch", "Streamer Barons", "Launch your own streaming platform.");
  saveGame();
  return true;
}
function streamerCeiling(){
  if(!G.streamer) return 0;
  const lib = G.films.length;
  const frw = G.franchises.reduce((a,f)=>a+f.tier,0);
  const showBuzz = G.series.reduce((a,s)=>a+(s.seasons.length? s.seasons.reduce((x,y)=>x+(y.viewership||0),0)/10:0),0);
  const sport = G.streamer.sportsPower||0;
  const base = 3 + lib*1.1 + frw*2.2 + showBuzz + sport*1.5;
  return Math.min(60, Math.round(base));
}
function tickStreamer(){
  if(!G.streamer) return;
  const st=G.streamer;
  const ce=streamerCeiling();
  // subs pull toward the content ceiling; starve the service and they bleed (churn)
  let growth = (ce - st.subs)*0.05 - st.subs*(st.churn||0.008);
  st.subs = clamp(st.subs + growth, 0, Math.ceil(ce*1.05));
  st.subs = Math.round(st.subs*100)/100;
  const income = st.subs*0.5;
  st.income = Math.round(income*10)/10;
  if(income>=0.05) earn("streamer", income);
  // sports power decays ~1.5%/wk
  if(st.sportsPower>0) st.sportsPower = Math.max(0, st.sportsPower - st.sportsPower*0.015 - 0.02);
  if(st.subs>=25) unlockAchv("subs25", "The Empire Hits 25M", "Reach 25M subscribers on your platform.");
}
function moveToStreamer(fid){
  if(!G.streamer) return false;
  const f=G.films.find(x=>x.id===fid);
  if(!f || f.streamingOriginal || f.soldTo || f.onOwn || f.inTheaters) return false;
  f.onOwn = true; f.soldTo = G.streamer.name;
  G.streamer.subs = Math.round((G.streamer.subs + 0.3 + (f.quality?f.quality.overall/60:0))*100)/100;
  log("📺 “"+f.title+"” moved to your platform "+G.streamer.name+" — exclusive. Content ceiling +.","gold");
  saveGame();
  return true;
}
function tickPay1(){
  for(const f of G.films){
    if(f.pay1At && G.week>=f.pay1At && !f.pay1Paid && !f.streamingOriginal && !f.onOwn){
      f.pay1Paid=true;
      const pay = Math.round((f.ww||0)*(f.pay1Rate||0.06));
      if(pay>0){ earn("pay1", pay); log("📺 Pay-1 TV window: “"+f.title+"” lands "+fmtM(pay)+" (6% of WW).","good"); }
    }
  }
}

/* ═══════════ live sports rights (v3) — quarterly sealed-bid auctions ═══════════ */
function makeSportsAuction(){
  const pool = DATA.SPORTS.filter(s=>!((G.sportsWon||[]).includes(s.id)));
  const sport = pool.length? pool[rint(0,pool.length-1)] : pick(DATA.SPORTS);
  const base = rint(70,170);
  return { pkg:{ id:sport.id, name:sport.name, icon:sport.icon, blurb:sport.blurb, base,
      rivalBid: Math.round(base*(0.95+rnd()*0.5)),
      sportPower: Math.round(base/12), subBump: Math.round((2.5+base/60)*10)/10 },
    week:G.week, expires:G.week+2 };
}
function resolveSports(bid, pkgId){
  const a=G.pendingSports; if(!a) return;
  const pkg=a.pkg;
  bid = Math.round(bid||0);
  G.pendingSports=null;
  if(bid>=pkg.rivalBid && bid>0){
    spend("studio", bid);
    G.streamer.sportsPower += pkg.sportPower;
    G.streamer.subs = Math.round((G.streamer.subs + pkg.subBump)*100)/100;
    G.sportsWon.push(pkg.id);
    unlockAchv("sports", "Live & Buzzing", "Win a live sports rights package.");
    log(pkg.icon+" Won "+pkg.name+" rights for "+fmtM(bid)+" — sports power +"+pkg.sportPower+", +"+pkg.subBump+"M subs.","gold");
  }else{
    log(pkg.icon+" Lost the "+pkg.name+" rights — a rival outbid your "+fmtM(bid)+".","bad");
  }
  saveGame();
}
function passSports(){
  const a=G.pendingSports; if(!a) return;
  G.pendingSports=null;
  log("🚫 You passed on "+a.pkg.name+" rights — a rival took them.","");
  saveGame();
}
function tickSportsAuctions(){
  if(!G.streamer) return;
  if(G.pendingSports) return;
  const woy = woyOf(G.week);
  if(woy===13||woy===26||woy===39||woy===52){
    G.pendingSports = makeSportsAuction();
  }
}

/* ═══════════ franchise empire (merch · games · parks) ═══════════ */
function upsertFranchise(f){
  let fr = G.franchises.find(x=>x.name===(f.franchiseName||f.title));
  if(!fr){
    fr = { id:nid(), name:f.franchiseName||f.title, tier:0, entries:[], ww:0,
           merch:0, park:0, gameSold:0, decay:1, genre:f.genre, earned:0, built:G.week };
    G.franchises.push(fr);
  }
  fr.tier++; fr.ww += f.ww||0;
  fr.entries.push({ filmId:f.id, title:f.title, ww:f.ww, week:G.week });
  fr.decay = 1;
  G.studio.rep = clamp(G.studio.rep+1, 5, 99);
}
function frById(id){ return G.franchises.find(x=>x.id===id); }
function merchCost(fr){ return [30+fr.tier*15, 80+fr.tier*20, 160+fr.tier*30][fr.merch] || 0; }
function parkCost(fr){ return fr.park===0? 180+fr.tier*50 : 350; }
function frWeeklyIncome(fr){
  const g=DATA.GENRES[fr.genre]||{merch:1};
  return ( fr.merch? fr.merch*(0.9+fr.tier*0.55)*g.merch*fr.decay : 0 )
       + ( fr.park ? fr.park*(2.5+fr.tier*1.2)*fr.decay : 0 );
}
function upgradeMerch(id){
  const fr=frById(id); if(!fr || fr.merch>=3) return;
  const c=merchCost(fr); if(G.studio.cash<c) return;
  spend("studio", c); fr.merch++;
  G.studio.rep=clamp(G.studio.rep+1,5,99);
  const label=["","toy & apparel line","global merch program","full consumer-products empire"][fr.merch];
  log("🧸 “"+fr.name+"”: launched "+label+" (−"+fmtM(c)+", +weekly income).","gold");
  saveGame();
}
function buildPark(id){
  const fr=frById(id); if(!fr || fr.park>=2 || fr.tier<2) return;
  const c=parkCost(fr); if(G.studio.cash<c) return;
  spend("studio", c); fr.park++;
  G.studio.rep=clamp(G.studio.rep+3,5,99);
  log("🎡 “"+fr.name+"”: "+(fr.park===1? "theme-park attraction built":"park expansion opened")+" (−"+fmtM(c)+"). A landmark for the studio.","gold");
  saveGame();
}
function sellGameRights(id){
  const fr=frById(id); if(!fr || fr.gameSold===fr.tier) return;
  const v=Math.round(20 + fr.tier*12 + Math.min(40, fr.ww/50));
  earn("empire", v); fr.gameSold=fr.tier;
  log("🎮 “"+fr.name+"” game rights licensed for "+fmtM(v)+".","gold");
  saveGame();
}
function tickEmpire(){
  for(const fr of G.franchises){
    const inc=frWeeklyIncome(fr);
    if(inc>=0.1){ earn("empire", inc); fr.earned=(fr.earned||0)+inc; }
    fr.decay=Math.max(0.25, fr.decay*(fr.park? 0.996 : 0.982));
  }
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
      f.dom+=15; f.ww+=20; f.studioRev+=15; earn("theatrical", 15);
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
  // economy: yearly inflation compounds across the whole market
  G.infl = Math.round((G.infl||1) * (1+(DATA.INFLATION||0.02)) * 1000)/1000;
  log("📈 Inflation ticked up: the whole market is now ~"+Math.round(((G.infl-1)*100))+"% pricier than Year 1.","");
  // yearly new talent class: fresh faces join the market
  G.lastClass = yr;
  G.talent.push(genActor(chance(0.2)), genActor(false), genActor(false));
  G.talent.push(genDirector(false));
  log("🌟 New Faces of Year "+yr+": fresh talent hits the market.","");
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
  G.weekTx={};
  tickFinance();
  tickPublic();
  tickStreamer();
  tickSportsAuctions();
  tickPay1();
  tickProjects();
  // releases due (or overdue — safety net)
  for(const p of [...G.projects]){
    if(p.phase==="ready" && !p.prebuyAccepted && p.releaseWeek && p.releaseWeek<=G.week){
      const rest = p.marketing - p.marketingPaid;
      spend("marketing", Math.max(0,rest));
      releaseFilm(p);
    }
  }
  tickTheatrical();
  tickSeries();
  tickRivals();
  tickEmpire();
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
  const snap={ week:G.week, cats:{...G.weekTx}, net:weekNet(G.weekTx) };
  G.txHistory.push(snap);
  if(G.txHistory.length>12) G.txHistory.shift();
  saveGame();
  return G.flash;
}
function advanceWeeks(n){
  for(let i=0;i<n;i++){
    if(G.over||G.pendingChoice||G.pendingReport||G.pendingAuction) break;
    advanceWeek();
  }
}

/* ═══════════ misc getters for UI ═══════════ */
function activeFilms(){ return G.films.filter(f=>f.inTheaters); }
function readyProjects(){ return G.projects.filter(p=>p.phase==="ready"); }
function inProdProjects(){ return G.projects.filter(p=>["pre","shoot","post","reshoot"].includes(p.phase)); }
function seasonDateLabel(w){ const s=DATA.seasonOf(woyOf(w)); return s.month+" Y"+yearOf(w); }
