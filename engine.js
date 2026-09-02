/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — engine.js  (v3: The Studio-as-Empire build)
   The business simulation. All money in $Millions.
   Realism targets:
   • Studio keeps ~53% of domestic gross, ~42% of intl (blended, incl. China's ~25% take)
   • Breakeven ≈ (budget + marketing) / ~0.48 worldwide
   • Opening weekend = hype (stars × marketing × season × competition × craft choices)
   • Legs (total/opening) = f(quality). Horror: big open, short legs. Animation: long legs.
   v2 adds: ratings, rewrites, test screenings, IMAX, locations, talent loyalty/poaching,
   festivals, FYC, executives, IPO, mezzanine, output deals, spin-offs, shared universes,
   achievements, scenarios, difficulty, sandbox, 2%/yr inflation.
   v3 adds: own streamer, live sports rights, theatrical windowing & exhibitor relations,
   release patterns, franchise lifecycle (heat/fatigue, crossovers, DTV, reboots, licensing),
   IP market, auteurs, toxic stars, soundtracks, foreign-language, China censor, pay-1 ladder.
   ═══════════════════════════════════════════════════════════ */
"use strict";

let G = null; // global game state

/* ═══════════ state ═══════════ */
function newGame(archId, name, opts){
  opts = opts||{};
  const arch = DATA.ARCHETYPES.find(a=>a.id===archId) || DATA.ARCHETYPES[1];
  const scen = DATA.SCENARIOS[opts.scenario||"standard"] || DATA.SCENARIOS.standard;
  G = {
    v:3,
    studio:{ name: name || "Parallax Pictures",
             cash: arch.cash + (scen.cash||0),
             debt: Math.max(0,(scen.debt||0)),
             rep: clamp(arch.rep + (scen.rep||0), 5, 99),
             overhead: arch.overhead + (scen.overhead||0), archId: arch.id,
             flopPenalty: arch.flopPenalty + (scen.flopPenalty||0), devBonus: arch.devBonus },
    scenario: scen? (opts.scenario||"standard") : "standard",
    difficulty: DATA.DIFFICULTIES[opts.difficulty]? opts.difficulty : "normal",
    sandbox: !!opts.sandbox,
    slot: opts.slot||1,
    week: 1, // absolute
    upgrades:{},
    projects:[], films:[], series:[], offers:[], ideas:[], franchises:[],
    weekTx:{}, txHistory:[], pendingAuction:null,
    talent:[],
    rivals: DATA.RIVALS_DEF.map(r=>({ ...r, slate:[], ytd:0, filmsLive:[] })),
    news:[], flash:[],
    stats:{ films:0, seriesSeasons:0, totalWW:0, totalProfit:0, hits:0, flops:0, awards:[],
            bestOpen:0, bestFilm:null, shareHistory:[], streamSales:0 },
    investorDebt:0, investorPaid:0,
    streamWar:0, theaterCap:0,
    over:null, pendingReport:null, pendingChoice:null,
    weeksInDebt:0,
    /* v2 */
    execs:{}, ipo:false, quarterNet:0, mezz:0,
    outputDeal:0, wrapDeal:0, agencyExcl:0,
    ach:{}, festWins:[],
    extraPlatforms:[],
    ipMarket:[],
    /* v3 */
    streamer:null, sportsAuction:null, sportsPower:0, mySports:[],
    exhibRel:70,
  };
  genTalentPool();
  seedIdeas();
  seedRivalYear();
  refreshIpMarket(true);
  G.log = log;
  log("🎬 "+G.studio.name+" is founded ("+DATA.SCENARIOS[G.scenario].name+" · "+DATA.DIFFICULTIES[G.difficulty].name+(G.sandbox?" · sandbox":"")+"). "+arch.sub, "gold");
  log("💡 Tip: Greenlight a film in the Develop tab, or pitch a series in OTT & Series.", "");
  if(G.studio.debt>0) log("🧯 Turnaround: you inherited "+fmtM(G.studio.debt)+" of debt. Interest never sleeps.", "bad");
  saveGame();
  return G;
}

/* migrate any older save (v1) to the current schema */
function migrate(g){
  if(!g || typeof g!=="object") return null;
  G = g; // helpers below (genIpItem, yearOf…) read the live state
  g.v = 3;
  g.scenario = g.scenario||"standard";
  g.difficulty = DATA.DIFFICULTIES[g.difficulty]? g.difficulty : "normal";
  g.sandbox = !!g.sandbox; g.slot = g.slot||1;
  g.execs=g.execs||{}; g.ipo=!!g.ipo; g.quarterNet=g.quarterNet||0; g.mezz=g.mezz||0;
  g.outputDeal=g.outputDeal||0; g.wrapDeal=g.wrapDeal||0; g.agencyExcl=g.agencyExcl||0;
  g.ach=g.ach||{}; g.festWins=g.festWins||[];
  g.extraPlatforms=g.extraPlatforms||[]; g.ipMarket=g.ipMarket||[];
  g.streamer=g.streamer||null; g.sportsAuction=null; g.sportsPower=g.sportsPower||0; g.mySports=g.mySports||[];
  g.exhibRel=g.exhibRel||70;
  g.stats=g.stats||{}; g.stats.streamSales=g.stats.streamSales||0;
  (g.talent||[]).forEach(t=>{ if(t.pics===undefined){t.pics=0; t.joinedYear=t.joinedYear||1;} });
  (g.projects||[]).forEach(p=>{
    p.rating=p.rating||"PG-13"; p.location=p.location||"home";
    p.pattern=p.pattern||"wide"; p.rollout=p.rollout||"day";
    p.window=p.window||45; if(p.awareness===undefined)p.awareness=0;
  });
  if(!g.ipMarket.length) refreshIpMarket(true);
  return g;
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
  // difficulty-scaled markets: rentals & PVOD bend with difficulty
  if((cat==="theatrical"||cat==="pvod") && G.difficulty) amt = Math.round(amt*DATA.DIFFICULTIES[G.difficulty].rent*10)/10;
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

/* ═══════════ save / load (auto-save + 3 slots + export codes) ═══════════ */
function saveGame(){
  try{
    if(typeof localStorage==="undefined") return;
    const raw = JSON.stringify(G);
    localStorage.setItem("bow_save", raw);
    localStorage.setItem("bow_slot"+(G.slot||1), raw);
  }catch(e){}
}
function hasSave(){
  try{ return typeof localStorage!=="undefined" && !!localStorage.getItem("bow_save"); }catch(e){ return false; }
}
function slotMeta(n){
  try{
    const raw = localStorage.getItem("bow_slot"+n);
    if(!raw) return null;
    const j=JSON.parse(raw);
    return { name:j.studio.name, week:j.week, cash:j.studio.cash, scenario:j.scenario||"standard" };
  }catch(e){ return null; }
}
function loadSlot(n){
  try{
    const raw=localStorage.getItem("bow_slot"+n); if(!raw) return null;
    G = migrate(JSON.parse(raw)); G.log=log; saveGame(); return G;
  }catch(e){ return null; }
}
function loadGame(){
  try{
    const raw = (typeof localStorage!=="undefined") && localStorage.getItem("bow_save");
    if(!raw) return null;
    G = migrate(JSON.parse(raw));
    G.log = log;
    return G;
  }catch(e){ return null; }
}
function exportCode(){
  return btoa(unescape(encodeURIComponent(JSON.stringify(G))));
}
function importCode(code){
  try{
    const g = migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim())))));
    if(!g || !g.studio) return false;
    G = g; G.log = log; saveGame(); return true;
  }catch(e){ return false; }
}

/* ═══════════ calendar helpers ═══════════ */
function yearOf(w){ return Math.floor((w-1)/52)+1; }
function woyOf(w){ return ((w-1)%52)+1; }
function dateLabel(w){ return "Y"+yearOf(w)+" · W"+woyOf(w); }
function seasonOfW(w){ return DATA.seasonOf(woyOf(w)); }
/* v2: 2%/year inflation compounding across the whole market */
function infl(){ return Math.pow(1.02, yearOf(G?G.week:1)-1); }

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
function fmtSubs(v){ // subscribers in millions
  if(v>=1) return v.toFixed(1)+"M";
  return Math.round(v*1000)+"K";
}

/* ═══════════ talent (v2: loyalty classes, auteurs, toxic stars, poaching) ═══════════ */
function talentName(kind){
  const f = chance(.5)? pick(DATA.FIRST_M) : pick(DATA.FIRST_F);
  return f+" "+pick(DATA.LAST);
}
function genActor(hot, opts){
  opts=opts||{};
  const power = opts.power || (hot? rint(3,5) : rint(1,5));
  const skill = clamp(rint(45,88)+power*3+rint(-6,6), 40, 96);
  const fee = [0.3,1.2,4,12,25][power-1] * (hot? 1.2:1) * infl();
  return { id:nid(), kind:"actor", name:talentName(), power, skill,
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0, genreFit:null,
           pics:0, joinedYear:yearOf(G?G.week:1), toxic:false, cls:opts.cls||0 };
}
function genDirector(hot, fitGenre, opts){
  opts=opts||{};
  const power = opts.power || (hot? rint(3,5) : rint(1,5));
  const skill = clamp(rint(50,90)+power*2+rint(-5,5), 45, 97);
  const fee = [0.8,2,5,10,18][power-1]*(hot?1.15:1)*infl();
  const fits = Object.keys(DATA.GENRES);
  return { id:nid(), kind:"director", name:pick(DATA.DIR_FIRST)+" "+pick(DATA.LAST),
           power, skill, fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0,
           genreFit: fitGenre || pick(fits), pics:0, joinedYear:yearOf(G?G.week:1),
           auteur: chance(0.09), cls:opts.cls||0 };
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
function actorFee(t){
  let f = t.fee * (1+0.25*(t.heat||0));
  if(G.upgrades.agency) f*=0.85;
  if(t.pics>=2) f*=0.9;                       // v2 loyalty: repeat collaborators work cheaper
  if(G.wrapDeal>0) f*=0.8;                    // v3 wrap deal
  if(G.agencyExcl>G.week) f*=0.85;            // v3 agency exclusive
  if(G.execs && G.execs.casting) f*=0.9;      // v2 casting exec
  return Math.round(f*10)/10;
}
/* weekly: rivals try to poach your hot stars */
function tickPoaching(){
  if(!chance(0.022*DATA.DIFFICULTIES[G.difficulty].eventRate)) return;
  const cands = G.talent.filter(t=>!t.bookedUntil && ((t.heat||0)>=2 || (t.pics||0)>=2));
  if(!cands.length) return;
  const t=pick(cands);
  if(G.execs.casting && chance(0.6)){ log("🎭 Your Head of Casting fended off a poaching attempt on "+t.name+".","good"); return; }
  G.talent = G.talent.filter(x=>x!==t);
  log("🕶 "+pick(G.rivals).name+" poached "+t.name+" ("+t.power+"★) with an exclusive deal.","bad");
}

/* ═══════════ script ideas ═══════════ */
function makeTitle(genre){
  const T = DATA.TITLES[genre];
  if(!T) return pick(DATA.SHARED_TITLES);
  if(chance(.12)) return pick(DATA.SHARED_TITLES);
  if(genre==="fantasy"||genre==="animation") return pick(T.a)+" "+pick(T.b);
  const pre = T.p && chance(.35)? pick(T.p)+" " : "";
  return pre+pick(T.a)+" "+pick(T.b);
}
function genIdea(){
  const genre = pick(Object.keys(DATA.GENRES));
  const g = DATA.GENRES[genre];
  let scale = "mid";
  if(genre==="action"||genre==="scifi"||genre==="fantasy"||genre==="animation") scale = chance(.55)?"tentpole":"mid";
  else if(genre==="horror"||genre==="drama"||genre==="romance") scale = chance(.6)?"indie":"mid";
  else scale = pick(["indie","mid","mid"]);
  const hot = chance(.16);
  const script = clamp(rint(50,84) + (hot?8:0) + rint(-4,6), 42, 94);
  return { id:nid(), genre, scale, title:makeTitle(genre), blurb:pick(DATA.BLURBS[genre]),
           script, hot, awareness:0, born:G.week, lapses:G.week+12 };
}
function seedIdeas(){ for(let i=0;i<6;i++) G.ideas.push(genIdea()); }
function refreshIdeas(){
  G.ideas = G.ideas.filter(i=>i.lapses>G.week);
  if(G.ideas.length<7 && chance(.6)) G.ideas.push(genIdea());
}

/* ═══════════ v3: the IP market ═══════════ */
function genIpItem(){
  const k=pick(DATA.IPKINDS);
  const genre=pick(Object.keys(DATA.GENRES));
  const price=rint(3,40);
  const title = k.id==="pd"? pick(DATA.PD_TITLES) : makeTitle(genre);
  return { id:nid(), kind:k.id, genre, title, price,
           boost: Math.round(3+price*0.18), buzz: clamp(0.02+price*0.0022, 0.02, 0.12) };
}
function refreshIpMarket(seed){
  G.ipMarket = (G.ipMarket||[]).filter(i=>i.born+16>G.week);
  while(G.ipMarket.length<4){ const it=genIpItem(); it.born=G.week; G.ipMarket.push(it); }
  if(!seed && G.ipMarket.length>6) G.ipMarket.length=6;
}
function buyIp(id){
  const it=(G.ipMarket||[]).find(x=>x.id===id); if(!it) return;
  if(G.studio.cash<it.price){ log("💸 Not enough cash for those rights.","bad"); return; }
  spend("development", it.price);
  const idea = genIdea();
  idea.genre=it.kind==="pd"? idea.genre : it.genre;
  idea.title = it.title;
  idea.blurb = "Adaptation of "+DATA.IPKINDS.find(k=>k.id===it.kind).name.toLowerCase()+" “"+it.title+"”.";
  idea.script = clamp(rint(56,80)+it.boost, 48, 96);
  idea.awareness = it.buzz;
  idea.hot = idea.hot || it.buzz>=0.09;
  idea.lapses = G.week+20;
  G.ideas.push(idea);
  G.ipMarket = G.ipMarket.filter(x=>x!==it);
  log("📚 Bought “"+it.title+"” ("+DATA.IPKINDS.find(k=>k.id===it.kind).emoji+" "+fmtM(it.price)+") — script +"+it.boost+", built-in awareness. See Develop.","gold");
  saveGame();
}

/* ═══════════ quality & box office math ═══════════ */
function neededBudget(genre, scale){
  const S=DATA.SCALES[scale], gb=(DATA.GENRES[genre]||{budgetBias:1}).budgetBias;
  return (S.bMin+S.bMax)/2 * gb * infl();
}
function computeQuality(p){
  const g = DATA.GENRES[p.genre];
  const dirScore = p.director ? p.director.skill*(p.director.genreFit===p.genre?1.1:0.95) : 55;
  const castScore = p.cast.length? p.cast.reduce((s,c)=>s+c.skill,0)/p.cast.length : 52;
  const pv = clamp(p.budget/neededBudget(p.genre,p.scale), .55, 1.12);
  const prodScore = 52 + 48*pv;
  let craft = 0.30*p.script + 0.24*dirScore + 0.22*castScore + 0.24*prodScore;
  if(G.upgrades.vfx && p.scale==="tentpole") craft += 3;
  if(p.director && p.director.auteur) craft += 5;        // v3: auteurs elevate craft
  craft += gauss()*5.5;
  const overall = clamp(Math.round(craft), 8, 97);
  let criticBias = g.critic;
  if(p.rating==="R") criticBias += 4;                    // v2: critics like it darker
  if(p.foreignLang) criticBias += 3;                     // v3: foreign-language prestige
  const critic = clamp(Math.round(overall + criticBias + gauss()*3), 5, 99);
  const aud    = clamp(Math.round(overall + g.aud + Math.min(p.cast.reduce((s,c)=>s+c.power,0),8)*1.2 + gauss()*3), 5, 99);
  return { overall, critic, aud };
}
function recMarketing(p){ return Math.round(p.budget*DATA.SCALES[p.scale].mktRate * (p.imax?1.08:1)); }
function frHeatMult(p){
  if(!p.franchiseName) return 1;
  const fr=G.franchises.find(x=>x.name===p.franchiseName);
  if(!fr) return 1;
  return 0.82 + 0.36*fr.decay;   // v3: cold franchises open weak, hot ones soar
}
function expectedOpening(p, weekAbs){
  const S=DATA.SCALES[p.scale], g=DATA.GENRES[p.genre];
  let base = S.openBase * g.mass * (g.openBoost||1);
  if(p.foreignLang) base *= 0.75;                        // v3: subtitled = niche
  const starP = p.cast.reduce((s,c)=>s+c.power,0);
  const starF = 1 + 0.075*Math.min(starP, 6);
  const rec = recMarketing(p);
  let mktF = clamp(Math.pow(Math.max(p.marketing,1)/rec, 0.45), 0.5, 1.55) * (G.upgrades.marketing?1.10:1);
  if(G.execs.cmo) mktF *= 1.12;                          // v2 CMO
  const season = seasonOfW(weekAbs).season;
  const fr = p.franchise? frHeatMult(p)*1.35 : 1;
  const repF = 0.92 + G.studio.rep/600;
  const comp = competitionFactor(p, weekAbs);
  let hype = base*starF*mktF*season*fr*repF*comp;
  hype *= (1+(p.buzzBonus||0)) * (1+(p.awareness||0));
  // v2/v3 release craft
  const rating = DATA.RATINGS.find(r=>r.id===(p.rating||"PG-13")); if(rating) hype*=rating.open;
  if(p.imax) hype*=1.12;
  const pat = DATA.PATTERNS.find(x=>x.id===(p.pattern||"wide")); if(pat) hype*=pat.open;
  const roll = DATA.ROLLOUTS.find(x=>x.id===(p.rollout||"day")); if(roll) hype*=roll.open;
  if(p.dayAndDate) hype*=0.65;                           // v3: day-and-date cannibalizes the open
  hype *= 1 + (G.exhibRel-50)/50*0.05;                   // v3: exhibitor relations swing ±5%
  if(p.cast.some(c=>c.toxic && !c.rehabbed)) hype*=0.93; // v3: toxic stars poison openings
  return hype; // expected opening before noise
}
function competitionFactor(p, weekAbs){
  const others = weekendCompetitors(p, weekAbs);
  if(!others.length) return 1;
  const wSelf = Math.pow(Math.max(expectedWeightOf(p),1), 0.8);
  let sum = wSelf;
  others.forEach(o=>{ sum += Math.pow(o.weight,0.8); });
  const share = wSelf/sum;
  const crowd = others.length===1? 1.08 : others.length===2? 1.0 : 0.9;
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
  if(p){
    G.projects.forEach(o=>{ if(o!==p && o.releaseWeek===weekAbs) list.push({ mine:true, title:o.title, weight:expectedWeightOf(o) }); });
    G.films.forEach(o=>{ if(o.releaseWeek===weekAbs && o!==p) list.push({ mine:true, title:o.title, weight:o.opening }); });
  }
  return list;
}
/* v2: release-date chicken — rivals may blink and move off your weekend */
function playChicken(p, weekAbs){
  const myW = expectedWeightOf(p);
  let moved=0;
  G.rivals.forEach(r=>{
    const f=r.slate.find(f=>f.week===weekAbs && !f.dead && !f.live);
    if(f && f.weight < myW*1.15 && chance(0.55)){
      let nw = weekAbs + (chance(.5)?1:-1)*rint(1,3);
      if(nw>G.week+1){ f.week=nw; moved++;
        log("🐔 Release-date chicken: "+r.name+" blinks — “"+f.title+"” moves off your weekend.","good"); }
    }
  });
  return moved;
}
function legsOf(film){
  const g=DATA.GENRES[film.genre];
  let legs = 1.6 + (film.quality.overall-30)*0.028 + g.legsAdj;
  if(seasonOfW(film.releaseWeek).holiday) legs += 0.12;
  if(film.quality.aud>=85) legs += 0.08;
  if(film.piracyPenalty) legs -= film.piracyPenalty*8;
  const pat = DATA.PATTERNS.find(x=>x.id===(film.pattern||"wide")); if(pat) legs+=pat.legs;
  const roll = DATA.ROLLOUTS.find(x=>x.id===(film.rollout||"day")); if(roll) legs+=roll.legs;
  if(film.imax) legs+=0.05;
  return clamp(legs, 1.45, 4.4);
}
function breakevenWW(p){ return (p.budget + (p.marketing||recMarketing(p))) / 0.48; }

/* ═══════════ greenlight ═══════════ */
function devCostOf(idea){
  const base = { indie:2, mid:5, tentpole:12 }[idea.scale];
  return base + (idea.hot? rint(2,6):0);
}
function greenlight(cfg){
  // cfg: {idea, director, cast[], budget, sequelOf, plan, presales, rating, location, foreignLang, cameo, spinoffFr, crossover}
  const idea = cfg.idea;
  const S = DATA.SCALES[idea.scale];
  let fees = (cfg.director? actorFee(cfg.director):0) + cfg.cast.reduce((s,c)=>s+actorFee(c),0);
  if(cfg.cameo) fees += Math.round(actorFee(cfg.cameo)*0.3*10)/10;   // v3 cameo: 30% of fee
  const dev = devCostOf(idea);
  const p = {
    id:nid(), kind:"film", title:idea.title, genre:idea.genre, scale:idea.scale,
    script: idea.script, blurb: idea.blurb, hot:idea.hot,
    budget: cfg.budget, spent:0, devCost:dev,
    director: cfg.director, cast: cfg.cast, cameo: cfg.cameo||null,
    phase:"pre", phaseWeek:0,
    phaseLen:{ pre:rint(...S.pre), shoot:rint(...S.shoot), post:rint(...S.post) },
    releaseWeek:0, marketing:0, marketingPaid:0,
    franchise: !!(cfg.sequelOf) || !!cfg.spinoffFr || !!cfg.crossover,
    sequelOf: cfg.sequelOf? cfg.sequelOf.id : null,
    buzzBonus: (cfg.sequelOf? 0.15 : 0) + (cfg.crossover? 0.45 : 0) + (idea.awareness? 0:0),
    awareness: idea.awareness||0,
    strikePause:0,
    rating: cfg.rating||"PG-13",
    location: cfg.location||"home",
    foreignLang: !!cfg.foreignLang,
    rewritten:false, tested:false, reshoot:false,
    pattern:"wide", rollout:"day", window:45, imax:false, soundtrack:false, dayAndDate:false,
  };
  if(cfg.spinoffFr){ p.title = cfg.spinoffFr.name+": "+pick(DATA.SPINOFF_SUFFIX);
    p.franchiseName = cfg.spinoffFr.name;
    p.buzzBonus += 0.10 + 0.18*cfg.spinoffFr.decay; }
  if(cfg.sequelOf){ p.title = sequelTitle(cfg.sequelOf.title); p.franchiseName = cfg.sequelOf.franchiseName || cfg.sequelOf.title;
    p.buzzBonus += 0.0; }
  if(cfg.crossover){ p.franchiseName = cfg.crossover; }
  spend("development", dev);
  spend("talent", fees);
  if(G.wrapDeal>0) G.wrapDeal--;                        // v3 wrap deal consumes a picture
  p.plan = cfg.plan || "theatrical";
  const starP = cfg.cast.reduce((s,c)=>s+c.power,0);
  if(starP>=8){ p.backend = 0.05; }
  if(cfg.presales && p.plan!=="streaming"){
    p.presales = Math.round(p.budget*0.22);
    earn("presales", p.presales);
    log("🌍 International pre-sales on “"+p.title+"”: +"+fmtM(p.presales)+" (intl box office now goes to the buyers).","");
  }
  const total = p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post;
  if(cfg.director){ cfg.director.bookedUntil = G.week+total; cfg.director.booked = p.title; }
  cfg.cast.forEach(c=>{ c.bookedUntil=G.week+total; c.booked=p.title; });
  if(cfg.cameo){ cfg.cameo.bookedUntil=Math.max(cfg.cameo.bookedUntil||0, G.week+4); cfg.cameo.booked=p.title+" (cameo)"; }
  G.projects.push(p);
  G.ideas = G.ideas.filter(i=>i.id!==idea.id);
  const planLabel = {theatrical:"theatrical release",streaming:"streaming original",later:"decide distribution later"}[p.plan];
  const loc = DATA.LOCATIONS.find(l=>l.id===p.location);
  log("🎬 Greenlit: “"+p.title+"” ("+DATA.genreOf(p.genre).name+", "+fmtM(cfg.budget)+" budget, "+p.rating+(p.foreignLang?", foreign-language":"")+", shooting in "+(loc?loc.name:"home lot")+") — "+planLabel,"gold");
  return p;
}
function sequelTitle(t){
  const n = (t.match(/[IVX]+$/)||[null])[0];
  const romans=["II","III","IV","V","VI","VII","VIII","IX","X"];
  if(n){ const i=romans.indexOf(n); if(i>=0 && i<romans.length-1) return t.slice(0,t.length-n.length)+romans[i+1]; }
  return t+" II";
}
/* v2: pay for extra polish in pre-production */
function rewriteScript(pid){
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="pre" || p.rewritten) return;
  const cost=Math.max(2, Math.round(p.budget*0.05));
  if(G.studio.cash<cost){ log("💸 Can't afford the rewrite ("+fmtM(cost)+").","bad"); return; }
  spend("development", cost);
  p.rewritten=true; p.script=clamp(p.script+6,0,96); p.phaseLen.pre+=1;
  log("📝 “"+p.title+"” gets a polish pass (−"+fmtM(cost)+", script +6, +1 week pre).","good");
  saveGame();
}
/* v2: test screenings & reshoots on finished films */
function testScreening(pid){
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="ready" || !p.quality) return null;
  p.tested=true; saveGame();
  const legs=legsOf({genre:p.genre, quality:p.quality, releaseWeek:G.week, pattern:p.pattern, rollout:p.rollout, imax:p.imax});
  const spots=[];
  if(p.quality.overall<50) spots.push("third-act pacing");
  if(p.quality.aud<55) spots.push("lead chemistry");
  if(p.quality.critic<55) spots.push("tone");
  return { p, legs:Math.round(legs*100)/100, spots };
}
function reshootFilm(pid){
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="ready" || p.reshoot || !p.quality) return;
  const cost=Math.max(3, Math.round(p.budget*0.08));
  if(G.studio.cash<cost){ log("💸 Reshoots cost "+fmtM(cost)+" — not enough cash.","bad"); return; }
  spend("production", cost);
  p.reshoot=true;
  p.quality.overall=clamp(p.quality.overall+rint(5,8),0,97);
  p.quality.aud=clamp(p.quality.aud+4,0,99);
  p.budget+=cost;
  log("🎞 Reshoots wrapped on “"+p.title+"” (−"+fmtM(cost)+"). Test audiences score it higher now.","good");
  saveGame();
}

/* ═══════════ weekly production tick ═══════════ */
function tickProjects(){
  for(const p of G.projects){
    if(p.phase==="ready"||p.phase==="delivered") continue;
    if(p.strikePause>0){ p.strikePause--; if(p.strikePause===0) log("✊ Crews back on set for “"+p.title+"”",""); continue; }
    p.phaseWeek++;
    const L=p.phaseLen;
    let burn=0;
    if(p.phase==="pre")  burn = p.budget*0.10/L.pre;
    if(p.phase==="shoot"){ burn = p.budget*0.70/L.shoot * (G.upgrades.backlot?0.88:1); }
    if(p.phase==="post") burn = p.budget*0.20/L.post * (G.upgrades.vfx?0.75:1);
    burn = Math.round(burn*10)/10;
    spend("production", burn); p.spent += burn;
    if(p.phase==="shoot"){
      // v2 shoot locations: rebates actually offset the weekly burn
      const loc = DATA.LOCATIONS.find(l=>l.id===(p.location||"home")) || DATA.LOCATIONS[0];
      earn("incentives", burn*loc.rate);
    }
    if(p.phaseWeek >= L[p.phase]){
      p.phaseWeek=0;
      if(p.phase==="pre") p.phase="shoot";
      else if(p.phase==="shoot") p.phase="post";
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
function saleValueWithOutput(value){
  if(G.outputDeal>0) return Math.round(value*1.2);
  return Math.round(value);
}
function consumeOutput(){
  if(G.outputDeal>0){ G.outputDeal--; log("📜 Output deal applied (+20%). "+G.outputDeal+" sale(s) left on the deal.",""); }
}
function finishStreamingOriginal(p){
  const plat = DATA.platform(p.prebuyPlatform);
  const pay = saleValueWithOutput(p.prebuyValue); if(G.outputDeal>0) consumeOutput();
  earn("streaming", pay); G.stats.streamSales++;
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
  let expected = expectedOpening(p, G.week);
  // v3 soundtrack gamble resolves on release
  if(p.soundtrack){
    if(chance(0.30)){ p.soundHit=true; expected*=1.10; log("🎵 The single from “"+p.title+"” is CHARTING — +10% buzz!","gold"); }
    else log("🎵 The “"+p.title+"” single stalled. No chart action.","");
  }
  const noise = 0.85 + rnd()*0.34;
  let opening = clamp(expected*noise, 1.2, 320);
  if(G.theaterCap>0) opening *= 0.55;
  const q = p.quality;
  const film = {
    id:p.id, title:p.title, genre:p.genre, scale:p.scale,
    budget:p.budget, marketing:p.marketing, devCost:p.devCost,
    director:p.director, cast:p.cast, cameo:p.cameo||null, quality:q,
    releaseWeek:G.week, opening, weekly:[{w:G.week, gross:opening}],
    dom:opening, ww:0, studioRev:0, legs:0, decay:0, rentalsDom:opening*0.53,
    presales:p.presales||0, backend:p.backend||0,
    inTheaters:true, weeksOut:1, franchiseable:false, soldTo:null,
    piracyPenalty:0, awardsEligible:true, year:yearOf(G.week),
    franchiseName:p.franchiseName||null, sequelOf:p.sequelOf,
    franchiseableChecked:false,
    rating:p.rating, pattern:p.pattern||"wide", rollout:p.rollout||"day",
    windowDays:p.window||45, imax:!!p.imax, foreignLang:!!p.foreignLang,
    dayAndDate:!!p.dayAndDate, soundHit:!!p.soundHit, festWins:[],
  };
  G.films.push(film);
  G.projects = G.projects.filter(x=>x!==p);
  // v2: careers grow with repeat collaborations
  if(p.director){ p.director.bookedUntil=0; p.director.booked=null; p.director.pics=(p.director.pics||0)+1; p.director.lastUsed=G.week; }
  p.cast.forEach(c=>{ c.bookedUntil=0; c.booked=null; c.pics=(c.pics||0)+1; c.lastUsed=G.week; });
  if(p.cameo){ p.cameo.pics=(p.cameo.pics||0)+1; }
  G.stats.films++;
  const fr0 = film.franchiseName && G.franchises.find(x=>x.name===film.franchiseName);
  if(fr0) fr0.decay = 1;
  if(opening>G.stats.bestOpen){ G.stats.bestOpen=opening; G.stats.bestFilm=film.title; }
  earn("theatrical", opening*0.53);
  const label = opening>=100? "💥 MASSIVE opening": opening>=40? "🔥 Strong opening": opening>=12? "▶ Solid opening":"🎪 Limited release";
  const extra = film.dayAndDate? " (day-and-date on "+G.streamer.name+")" : film.imax? " (premium formats)":"";
  log(label+": “"+film.title+"” opens to "+fmtG(opening)+" domestic"+extra+" (+"+fmtM(opening*0.53)+" rentals this week).","gold");
  if(opening>=60) p.cast.forEach(c=>{ c.heat=Math.min(3,c.heat+1); });
  // v3: day-and-date feeds your streamer
  if(film.dayAndDate && G.streamer){
    const bump=clamp(opening*0.05, 0.5, 6);
    G.streamer.subs+=bump; G.streamer.lastContent=G.week;
    log("🛰 Day-and-date: "+fmtSubs(bump)+" new subscribers joined "+G.streamer.name+".","good");
  }
  return film;
}
function intlShareOf(f){
  let s = DATA.GENRES[f.genre].intlShare;
  if(f.foreignLang) s += 0.10;                  // v3: foreign-language travels
  if(f.censorCut) s = Math.max(0.15, s-0.08);   // v3: China censor board
  return clamp(s, 0.15, 0.85);
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
  // v3: China censor board rolls on china-dependent genres (before intl settles)
  if(!f.censorChecked && !f.presales && DATA.GENRES[f.genre].china>=0.14 && chance(0.35)){
    f.censorCut=true;
    log("🇨🇳 The censor board trimmed “"+f.title+"” for China — intl share −8pts.","bad");
  }
  f.censorChecked=true;
  const share = intlShareOf(f);
  const intlGross = f.dom/(1-share) - f.dom;
  f.ww = f.dom + intlGross;
  let intlRentals = 0;
  if(!f.presales){
    intlRentals = intlGross*0.42;
    const roll = DATA.ROLLOUTS.find(x=>x.id===(f.rollout||"day"));
    if(roll && roll.intl!==1) intlRentals*=roll.intl;   // staggered rollouts build intl
    earn("theatrical", intlRentals);
  }
  // v3 windowing: short windows boost PVOD, long ones soften it
  const win = DATA.WINDOWS.find(w=>w.d===(f.windowDays||45)) || DATA.WINDOWS[1];
  const pvod = Math.round(f.ww*0.055*clamp(f.quality.overall/70,0.7,1.4)*win.pvod);
  f.pvod = pvod; earn("pvod", pvod);
  // v3 pay-1 TV ladder: lands 6% of WW six weeks after the run
  f.pay1At = G.week+6;
  let backendPay = 0;
  if(f.backend){ backendPay = (f.rentalsDom + intlRentals)*f.backend; spend("talent", backendPay); }
  f.backendPaid = backendPay;
  f.studioRev = f.rentalsDom + intlRentals + pvod - backendPay;
  f.profit = f.studioRev + f.presales - f.budget - f.marketing - (f.devCost||0);
  if(f.soundHit){ const roy=Math.max(1,Math.round(f.ww*0.02)); earn("music", roy); f.profit+=roy; }
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
function maybePay1(){
  for(const f of G.films){
    if(f.pay1At && G.week>=f.pay1At && !f.pay1Done){
      f.pay1Done=true; f.pay1At=0;
      if(f.streamingOriginal) continue;
      const pay=Math.max(1, Math.round((f.ww||0)*0.06));
      earn("streaming", pay); f.profit+=pay; G.stats.totalProfit+=pay;
      log("📡 Pay-1 window: “"+f.title+"” licensed for "+fmtM(pay)+" (6% of WW).","good");
    }
  }
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
  // v2 output deals show up once you have a track record
  if(!G.outputDeal && G.films.length>=3 && chance(0.012)){
    const plat=pick(DATA.allPlatforms());
    G.offers.push({ id:nid(), type:"output", platform:plat.id, filmTitle:plat.name+" output deal", value:0, countered:false, expires:G.week+8 });
    log("📜 "+plat.name+" proposes an output deal: +20% on your next 3 streaming sales.","");
  }
}
function makeFilmOttOffer(f){
  const g=DATA.GENRES[f.genre];
  const plats = DATA.allPlatforms().map(p=>({p, score:p.generosity * (p.taste[f.genre]||1)})).sort((a,b)=>b.score-a.score);
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
  const plats = DATA.allPlatforms().map(x=>({x, s:x.generosity*(x.taste[p.genre]||1)})).sort((a,b)=>b.s-a.s);
  const chosen = pick(plats.slice(0,2));
  const margin = 1.12 + rnd()*0.33;
  const value = Math.round(p.budget*margin*chosen.x.generosity*(G.streamWar>0?1.25:1));
  G.offers.push({ id:nid(), type:"prebuy", projectId:p.id, filmTitle:p.title, platform:chosen.x.id,
    value, countered:false, expires:G.week+4 });
  log("📨 "+chosen.x.name+" offers to buy “"+p.title+"” as a streaming original: "+fmtM(value)+" (no theatrical run).","");
}
/* ═══ OTT auction: shop a finished film to streamers ═══ */
function makeAuctionBids(p){
  const q=p.quality.overall, g=DATA.GENRES[p.genre];
  const hype=1+(p.buzzBonus||0)+(p.awareness||0);
  const cand=DATA.allPlatforms().map(pl=>({pl,s:pl.generosity*(pl.taste[p.genre]||1)})).sort((a,b)=>b.s-a.s).slice(0,3);
  return cand.map(({pl,s})=>({ platform:pl.id,
    value:Math.max(3, Math.round(p.budget*(0.85+q/160)*g.otta*s*hype*(0.95+rnd()*0.22)*(G.streamWar>0?1.3:1)*(G.upgrades.ottrel?1.12:1)))
  })).sort((a,b)=>b.value-a.value);
}
function shopToStreamers(pid){
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="ready") return;
  G.pendingAuction={ projectId:pid, bids:makeAuctionBids(p), manual:true, countered:false };
}
/* v2: auction counters — ask for more… they may walk */
function counterAuction(){
  const a=G.pendingAuction; if(!a || a.countered) return;
  a.countered=true;
  const roll=rnd();
  if(roll<0.45){
    const mult=1.12+rnd()*0.10;
    a.bids.forEach(b=>b.value=Math.round(b.value*mult));
    log("📈 You pushed back at the auction — bids jump "+Math.round((mult-1)*100)+"%.","good");
  }else if(roll<0.75){
    if(a.bids.length>1){ const gone=a.bids.pop(); log("📉 "+DATA.platform(gone.platform).name+" walked out of the auction.","bad"); }
    else log("🤨 They held firm. The top bid stands.","");
  }else{
    log("🤨 They held firm. Bids unchanged.","");
  }
  saveGame();
}
function acceptAuction(i){
  const a=G.pendingAuction; if(!a) return;
  const bid=a.bids[i]; const p=G.projects.find(x=>x.id===a.projectId);
  G.pendingAuction=null;
  if(!p||!bid) return;
  let pay=bid.value;
  if(G.outputDeal>0){ pay=saleValueWithOutput(pay); consumeOutput(); }
  earn("streaming", pay); G.stats.streamSales++;
  const plat=DATA.platform(bid.platform);
  const f={ id:p.id, title:p.title, genre:p.genre, scale:p.scale, budget:p.budget,
    marketing:p.marketingPaid||0, devCost:p.devCost||0, quality:p.quality,
    streamingOriginal:true, platform:plat.name, soldTo:plat.name,
    releaseWeek:G.week, weekly:[], dom:0, ww:0, rentalsDom:0, studioRev:pay,
    profit:pay-p.budget-(p.devCost||0)-(p.marketingPaid||0),
    inTheaters:false, awardsEligible:true, year:yearOf(G.week) };
  G.films.push(f);
  G.projects=G.projects.filter(x=>x!==p);
  G.stats.films++; G.stats.totalProfit+=f.profit;
  if(p.director){ p.director.bookedUntil=0; p.director.booked=null; }
  p.cast.forEach(c=>{ c.bookedUntil=0; c.booked=null; });
  log("🤝 Sold “"+p.title+"” to "+plat.name+" as a streaming original for "+fmtM(pay)+" (no theatrical run).","gold");
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
    let pay=o.value;
    if(G.outputDeal>0){ pay=saleValueWithOutput(pay); consumeOutput(); }
    earn("streaming", pay); G.stats.streamSales++;
    f.soldTo = DATA.platform(o.platform).name; f.soldValue=pay;
    f.profit += pay; G.stats.totalProfit += pay;
    log("🤝 “"+f.title+"” licensed to "+f.soldTo+" for "+fmtM(pay),"gold");
  }else if(o.type==="prebuy"){
    const p = G.projects.find(x=>x.id===o.projectId); if(!p) return;
    p.prebuyAccepted=true; p.prebuyPlatform=o.platform; p.prebuyValue=o.value;
    if(p.phase==="ready"){
      // already finished — deliver & get paid now instead of dangling
      finishStreamingOriginal(p);
      log("🤝 “"+p.title+"” delivered to "+DATA.platform(o.platform).name+" — "+fmtM(o.value)+" collected.","gold");
    }else{
      log("🤝 “"+p.title+"” sold to "+DATA.platform(o.platform).name+" — "+fmtM(o.value)+" payable on delivery.","gold");
    }
  }else if(o.type==="renewal"){
    acceptRenewal(o);
  }else if(o.type==="output"){
    G.outputDeal=3;
    log("📜 Output deal signed with "+DATA.platform(o.platform).name+": +20% on your next 3 sales.","gold");
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

/* ═══════════ series (v2: reality/doc, limited vs ongoing) ═══════════ */
function seriesTitle(){
  let t = pick(DATA.SERIES_TITLES.a)+" "+pick(DATA.SERIES_TITLES.b);
  if(G.series.some(s=>s.title===t)) t += ": "+pick(["Origins","Legacy","Files","Nights"]);
  return t;
}
function pitchSeries(cfg){
  // cfg: {genre, eps, perEp, platformId, showrunner, cast[], format, titleOverride, oddsBonus}
  const plat = DATA.platform(cfg.platformId);
  const budget = cfg.eps*cfg.perEp;
  const concept = clamp(rint(50,80)+G.studio.devBonus*2, 40, 95);
  const taste = plat.taste[cfg.genre]||1;
  let p = 0.22 + concept/160 + (taste-1)*0.6 + G.studio.rep/400 + (cfg.perEp>=8?0.06:0) + (G.upgrades.ottrel?0.05:0) + (cfg.oddsBonus||0);
  if(DATA.SGENRES[cfg.genre]) p+=0.08; // cheap genres get the benefit of the doubt
  const s = {
    id:nid(), kind:"series", title: cfg.titleOverride||seriesTitle(), genre:cfg.genre, platform:cfg.platformId,
    eps:cfg.eps, perEp:cfg.perEp, budget, concept, format:cfg.format||"ongoing",
    showrunner:cfg.showrunner||null, cast:cfg.cast||[],
    seasons:[], phase:"shoot", weeksLeft:Math.round(cfg.eps*1.2+6),
    weeksLeft0:Math.round(cfg.eps*1.2+6),
    spent:0, status:"producing", viewership:0,
  };
  if(chance(clamp(p,0.12,0.92))){
    G.series.push(s);
    spend("talent", (cfg.showrunner?actorFee(cfg.showrunner):0) + (cfg.cast||[]).reduce((a,c)=>a+actorFee(c),0));
    if(cfg.showrunner){cfg.showrunner.bookedUntil=G.week+s.weeksLeft; cfg.showrunner.booked=s.title;}
    (cfg.cast||[]).forEach(c=>{c.bookedUntil=G.week+s.weeksLeft; c.booked=s.title;});
    log("📺 "+plat.name+" greenlit “"+s.title+"”"+(s.format==="limited"?" (limited series)":"")+" — "+cfg.eps+" eps × "+fmtM(cfg.perEp)+" ("+fmtM(budget)+" season budget).","gold");
    return {ok:true, s};
  }
  log("🚫 "+plat.name+" passed on your "+DATA.genreOf(cfg.genre).name+" pitch. Back to the whiteboard.","bad");
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
  const license = Math.round(s.budget*margin);
  earn("series", license);
  s.seasons.push({num, quality:q, license, viewership:0});
  if(s.showrunner){s.showrunner.bookedUntil=0;}
  s.cast.forEach(c=>{c.bookedUntil=0;});
  const v = clamp(Math.round(0.45*q + 16 + G.studio.rep/9 + ((plat.taste[s.genre]||1))*8 + gauss()*6), 5, 99);
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
  let renewAt = plat.renew - (G.upgrades.ottrel?4:0) - (DATA.SGENRES[s.genre]? DATA.SGENRES[s.genre].renewBonus:0);
  if(s.format==="limited") renewAt -= 8; // v2 economy: limited events renew harder
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
      const weight = S.openBase*DATA.GENRES[genre].mass*infl();
      return { week: (yr-1)*52+wk, title:makeTitle(genre), genre, scale, quality:q, weight,
               opening:0, dom:0, decay:0, weeksOut:0, live:false, dead:false, ytdGross:0 };
    });
  }
}
function range(a,b){ const r=[]; for(let i=a;i<=b;i++)r.push(i); return r; }
function tickRivals(){
  for(const r of G.rivals){
    for(const f of r.slate){
      if(f.week===G.week && !f.live && !f.dead){
        let opening = f.weight * (0.8+rnd()*0.45) * DATA.seasonOf(woyOf(G.week)).season;
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

/* ═══════════ finance (v2: execs, IPO, mezzanine, forecast) ═══════════ */
function catalogValue(){
  let v=0;
  for(const f of G.films){
    let base=(f.budget*0.2 + (f.ww||0)*0.025);
    if(f.soldTo||f.streamingOriginal) base*=0.45;
    base += (f.awards||[]).length*8;
    v+=base;
  }
  for(const fr of G.franchises){ v += fr.tier*15 + fr.merch*10 + fr.park*45 + (fr.resort?120:0) + (fr.publishing?20:0); }
  return v;
}
function maxDebt(){
  const inProd=G.projects.reduce((a,p)=>a+p.budget*0.55,0) + G.series.reduce((a,s)=>a+(s.phase==="shoot"?s.budget*0.55:0),0);
  return 150 + catalogValue()*0.6 + inProd;
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
/* v2: mezzanine debt — emergency money at 0.5%/week */
function takeMezz(amount){
  amount=Math.min(Math.round(amount), Math.round(150-G.mezz));
  if(amount<=0) return false;
  G.mezz+=amount; earn("financing", amount);
  log("🧨 Mezzanine drawn: "+fmtM(amount)+" at 0.5%/week. Expensive oxygen.","");
  saveGame(); return true;
}
function repayMezz(amount){
  amount=Math.min(Math.round(amount), G.mezz, Math.max(0,Math.floor(G.studio.cash)));
  if(amount<=0) return false;
  G.mezz-=amount; spend("financing", amount);
  log("🧨 Mezzanine repaid: "+fmtM(amount)+".","good");
  saveGame(); return true;
}
/* v2: IPO — raise $400M at rep 60+, shareholders punish weak quarters */
function doIPO(){
  if(G.ipo || G.studio.rep<60) return false;
  G.ipo=true; G.ipoYear=yearOf(G.week); earn("financing", 400);
  log("🔔 IPO! "+G.studio.name+" raises $400M on the public market. Shareholders expect results every quarter now.","gold");
  saveGame(); return true;
}
function hireExec(id){
  const e=DATA.EXECS.find(x=>x.id===id); if(!e || G.execs[id]) return;
  if(G.studio.cash<e.hire){ log("💸 "+e.name+" wants "+fmtM(e.hire)+" to sign.","bad"); return; }
  spend("studio", e.hire); G.execs[id]=true;
  log(e.icon+" Hired: "+e.name+" (−"+fmtM(e.hire)+", +"+fmtM(e.salary)+"M/wk). "+e.desc,"gold");
  saveGame();
}
function weeklyOverhead(){
  let o = G.studio.overhead + G.projects.length*0.12 + G.series.filter(s=>s.phase==="shoot").length*0.15;
  DATA.EXECS.forEach(e=>{ if(G.execs[e.id]) o+=e.salary; });
  return o;
}
function interestRate(){ return 0.0018*(G.execs.cfo?0.7:1); }
function tickFinance(){
  const st=G.studio;
  spend("overhead", weeklyOverhead());
  if(st.debt>0){ const int=Math.round(st.debt*interestRate()*10)/10; spend("interest", int); st.debt+=int; }
  if(G.mezz>0){ const int=Math.round(G.mezz*0.005*(G.execs.cfo?0.7:1)*10)/10; spend("interest", int); G.mezz+=int; }
  if(G.investorDebt>0){
    const pay=Math.min(G.investorDebt, 2.5);
    G.investorDebt-=pay; spend("financing", pay); G.investorPaid=(G.investorPaid||0)+pay;
    if(G.investorDebt<=0) log("🕴 Investor buyout fully repaid.","good");
  }
  earn("library", catalogValue()*0.0045);
  if(st.cash<0){ st.debt += -st.cash; st.cash=0; }
  if(G.sandbox) { G.weeksInDebt=0; return; }
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
/* v2: 12-week cash-flow forecast */
function cashflowForecast(){
  const out=[];
  const liveRuns = G.films.filter(f=>f.inTheaters).map(f=>{
    if(f.legs===0){ f.legs=legsOf(f); f.decay=1-1/f.legs; }
    return { f, next: f.opening*Math.pow(f.decay, f.weeksOut) };
  });
  for(let i=1;i<=12;i++){
    const w=G.week+i, items=[];
    items.push({label:"Overhead", amt:-weeklyOverhead()});
    if(G.studio.debt>0) items.push({label:"Interest", amt:-G.studio.debt*interestRate()});
    if(G.mezz>0) items.push({label:"Mezz interest", amt:-G.mezz*0.005});
    for(const p of G.projects){
      if(["pre","shoot","post"].includes(p.phase)){
        const L=p.phaseLen;
        const burn = p.phase==="pre"? p.budget*0.10/L.pre : p.phase==="shoot"? p.budget*0.70/L.shoot : p.budget*0.20/L.post;
        items.push({label:"“"+p.title+"” burn", amt:-burn});
        if(p.phase==="shoot"){ const loc=DATA.LOCATIONS.find(l=>l.id===(p.location||"home")); items.push({label:"rebate", amt:burn*(loc?loc.rate:0.08)}); }
      }
      if(p.phase==="ready" && p.releaseWeek && Math.abs(p.releaseWeek-w)<=1){
        items.push({label:"“"+p.title+"” P&A", amt:-(p.marketing-(p.marketingPaid||0))});
        items.push({label:"“"+p.title+"” opening rentals", amt:expectedOpening(p,w)*0.53});
      }
    }
    for(const s of G.series){ if(s.phase==="shoot") items.push({label:"“"+s.title+"” burn", amt:-s.budget/(s.weeksLeft0||s.weeksLeft||1)}); }
    liveRuns.forEach(r=>{
      if(r.next>=0.4){ items.push({label:"“"+r.f.title+"” rentals", amt:r.next*0.53}); r.next*=r.f.decay; }
    });
    items.push({label:"Library & empire", amt: catalogValue()*0.0045 + G.franchises.reduce((a,f)=>a+frWeeklyIncome(f),0)});
    if(G.streamer) items.push({label:"Streamer net", amt:G.streamer.subs*0.5});
    const net = items.reduce((a,x)=>a+x.amt,0);
    out.push({w, items:items.filter(x=>Math.abs(x.amt)>=0.5), net:Math.round(net*10)/10});
  }
  return out;
}

/* ═══════════ franchise empire (v3 lifecycle: heat, spin-offs, universes…) ═══════════ */
function upsertFranchise(f){
  let fr = G.franchises.find(x=>x.name===(f.franchiseName||f.title));
  if(!fr){
    fr = { id:nid(), name:f.franchiseName||f.title, tier:0, entries:[], ww:0,
           merch:0, park:0, resort:false, publishing:false, gameSold:0, decay:1,
           genre:f.genre, earned:0, built:G.week, collabAt:0, licenseAt:0, dtvAt:0 };
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
  const holidayToy = (woyOf(G.week)>=47)? 1.4 : 1;   // v3 holiday toy spike
  let inc = ( fr.merch? fr.merch*(0.9+fr.tier*0.55)*(g.merch||1)*fr.decay*holidayToy : 0 )
          + ( fr.park ? fr.park*(2.5+fr.tier*1.2)*fr.decay : 0 )
          + ( fr.resort ? 10*fr.decay : 0 )
          + ( fr.publishing ? 0.8 : 0 );
  if(G.universeBonus) inc *= (1+G.universeBonus);     // v2 shared universes
  return inc;
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
/* v3: resorts & cruises need a park */
function buildResort(id){
  const fr=frById(id); if(!fr || fr.resort || fr.park<1) return;
  if(G.studio.cash<400){ log("💸 Resorts & cruises cost $400M.","bad"); return; }
  spend("studio", 400); fr.resort=true;
  G.studio.rep=clamp(G.studio.rep+5,5,99);
  log("🏝 “"+fr.name+"” resorts & cruise line opened (−$400M). Vacationers now live inside your IP.","gold");
  saveGame();
}
/* v3: publishing arm */
function launchPublishing(id){
  const fr=frById(id); if(!fr || fr.publishing) return;
  if(G.studio.cash<15){ log("💸 A publishing arm costs $15M.","bad"); return; }
  spend("studio", 15); fr.publishing=true;
  log("📚 “"+fr.name+"” publishing arm launched — novels, comics, lore books (−$15M, +weekly).","gold");
  saveGame();
}
function sellGameRights(id){
  const fr=frById(id); if(!fr || fr.gameSold===fr.tier) return;
  const v=Math.round(20 + fr.tier*12 + Math.min(40, fr.ww/50));
  earn("empire", v); fr.gameSold=fr.tier;
  log("🎮 “"+fr.name+"” game rights licensed for "+fmtM(v)+".","gold");
  saveGame();
}
/* v2: brand-collab events */
function brandCollab(id){
  const fr=frById(id); if(!fr || (fr.collabAt||0)>G.week) return;
  if(G.studio.cash<6){ log("💸 A brand collab event costs $6M.","bad"); return; }
  spend("marketing", 6);
  fr.collabAt=G.week+26;
  fr.decay=Math.min(1, fr.decay+0.25);
  const bump=Math.round(2+fr.merch*2+rnd()*3);
  earn("empire", bump); G.studio.rep=clamp(G.studio.rep+1,5,99);
  log("🤝 “"+fr.name+"” × global brand collab dropped — heat up, +"+fmtM(bump)+" merch spike.","good");
  saveGame();
}
/* v3: DTV sequels — cheap direct-to-video brand upkeep */
function dtvSequel(id){
  const fr=frById(id); if(!fr || (fr.dtvAt||0)>G.week) return;
  const cost=rint(12,22);
  if(G.studio.cash<cost){ log("💸 DTV sequels run "+fmtM(cost)+".","bad"); return; }
  spend("production", cost);
  fr.dtvAt=G.week+13;
  const rev=Math.round(cost*(1.25+rnd()*0.3));
  earn("video", rev);
  fr.decay=Math.min(1, fr.decay+0.15);
  log("📀 “"+fr.name+" "+pick(DATA.SPINOFF_SUFFIX)+"” went straight to video (−"+fmtM(cost)+", +"+fmtM(rev)+" sales, brand heat up).","good");
  saveGame();
}
/* v3: license the franchise out to a rival */
function licenseOut(id){
  const fr=frById(id); if(!fr || (fr.licenseAt||0)>G.week) return;
  const rival=pick(G.rivals);
  const upfront=Math.round(10+fr.tier*6+rnd()*8);
  earn("empire", upfront);
  fr.licenseAt=G.week+39;
  fr.decay=Math.max(0.25, fr.decay-0.08);
  G.licensedOut=G.licensedOut||[];
  G.licensedOut.push({ name:fr.name, tier:fr.tier, rival:rival.name, due:G.week+rint(10,16) });
  log("🤝 "+rival.name+" licensed “"+fr.name+"” — "+fmtM(upfront)+" upfront, backend if their film hits.","gold");
  saveGame();
}
function tickLicensedOut(){
  if(!G.licensedOut) return;
  for(const L of [...G.licensedOut]){
    if(G.week>=L.due){
      G.licensedOut=G.licensedOut.filter(x=>x!==L);
      if(chance(0.45+L.tier*0.06)){
        const back=rint(10,35);
        earn("empire", back);
        log("💰 "+L.rival+"’s licensed “"+L.name+"” film hit — your backend: "+fmtM(back)+".","gold");
      }else{
        log("🤷 "+L.rival+"’s licensed “"+L.name+"” film fizzled. No backend.","");
      }
    }
  }
}
/* v2: shared universes — merge two franchises, all franchise income +15% forever */
function mergeUniverse(idA, idB){
  const a=frById(idA), b=frById(idB);
  if(!a||!b||a===b||G.universeBonus) return;
  if(G.studio.cash<150){ log("💸 Weaving a shared universe costs $150M.","bad"); return; }
  spend("studio", 150);
  a.name = a.name+" × "+b.name;
  a.tier += b.tier; a.ww += b.ww; a.entries=a.entries.concat(b.entries);
  a.merch=Math.max(a.merch,b.merch); a.park=Math.max(a.park,b.park);
  a.earned=(a.earned||0)+(b.earned||0);
  a.decay=Math.max(a.decay,b.decay);
  G.franchises=G.franchises.filter(x=>x!==b);
  G.universeBonus=0.15;
  G.studio.rep=clamp(G.studio.rep+4,5,99);
  log("🌌 SHARED UNIVERSE: “"+a.name+"” — all franchise income +15%, forever.","gold");
  saveGame();
}
/* v3: crossover event — two tier-3 brands, +45% buzz tentpole */
function crossoverEvent(idA, idB){
  const a=frById(idA), b=frById(idB);
  if(!a||!b||a===b||a.tier<3||b.tier<3) return;
  if(G.studio.cash<40){ log("💸 A crossover event costs $40M to mount.","bad"); return; }
  spend("development", 40);
  const idea = genIdea();
  idea.scale="tentpole"; idea.genre=a.genre;
  idea.title=a.name+" vs "+b.name;
  idea.blurb="The two biggest brands in your stable collide in one event film.";
  idea.script=clamp(rint(60,84),55,94); idea.awareness=0.45; idea.hot=true;
  idea.crossover=a.name+" × "+b.name; idea.lapses=G.week+26;
  G.ideas.push(idea);
  log("💥 Crossover event greenlit-ready: “"+idea.title+"” (+45% buzz tentpole) is in Develop.","gold");
  saveGame();
}
function tickEmpire(){
  for(const fr of G.franchises){
    const inc=frWeeklyIncome(fr);
    if(inc>=0.1){ earn("empire", inc); fr.earned=(fr.earned||0)+inc; }
    fr.decay=Math.max(0.25, fr.decay*(fr.park? 0.996 : 0.982));
  }
  tickLicensedOut();
}

/* ═══════════ v3: your own streamer ═══════════ */
function canLaunchStreamer(){ return !G.streamer && G.studio.rep>=40 && G.studio.cash>=250; }
function launchStreamer(name){
  if(G.streamer || G.studio.rep<40 || G.studio.cash<250) return false;
  spend("studio", 250);
  G.streamer={ name:(name||G.studio.name+"+").slice(0,24), subs:2.0, peak:2.0, sportsPower:0,
               lastContent:G.week, totalRev:0 };
  log("🛰 "+G.streamer.name+" is LIVE (−$250M). Subscribers pay $0.5M per 1M subs every week. Feed it content or watch churn eat you.","gold");
  saveGame(); return true;
}
function streamerCeiling(){
  const s=G.streamer; if(!s) return 0;
  let c = 6
    + catalogValue()/45
    + G.franchises.length*2
    + s.sportsPower*0.8
    + G.series.filter(x=>x.status!=="ended").length*1.2
    + G.films.filter(f=>f.onOwnPlatform).length*0.4;
  return clamp(Math.round(c*10)/10, 4, 60);
}
function tickStreamer(){
  const s=G.streamer; if(!s) return;
  s.sportsPower=Math.max(0,(s.sportsPower||0)*0.985);          // sports heat decays ~1.5%/wk
  const ceil=streamerCeiling();
  const starved = G.week-(s.lastContent||0) > 6;
  if(starved) s.subs*=0.992;                                    // churn: 0.8%/wk
  s.subs += (ceil - s.subs)*0.03;                               // grow toward the ceiling
  s.subs = clamp(s.subs, 0.1, 80);
  s.peak=Math.max(s.peak||0, s.subs);
  const rev=Math.round(s.subs*0.5*10)/10;
  earn("streamer", rev); s.totalRev=(s.totalRev||0)+rev;
}
/* v3: library moves — push any unsold film onto your platform */
function libraryMove(fid){
  const s=G.streamer; if(!s) return;
  const f=G.films.find(x=>x.id===fid);
  if(!f || f.soldTo || f.streamingOriginal || f.inTheaters || f.onOwnPlatform) return;
  f.onOwnPlatform=true; f.soldTo=s.name;
  const bump=Math.round((0.4+f.quality.overall/120)*100)/100;
  s.subs+=bump; s.lastContent=G.week;
  log("🛰 “"+f.title+"” now streams exclusively on "+s.name+" (+"+fmtSubs(bump)+" subs).","good");
  saveGame();
}
/* v3: quarterly sealed-bid sports auctions */
function maybeSportsAuction(){
  if(!G.streamer || G.sportsAuction) return;
  if(![13,26,39,52].includes(woyOf(G.week))) return;
  if(G.pendingChoice||G.pendingReport||G.pendingAuction) return;
  const kinds=[...DATA.SPORTS].sort(()=>rnd()-0.5).slice(0,3);
  G.sportsAuction={ week:G.week, packs:kinds.map(k=>({ kind:k.id, ask:rint(70,170), rival:rint(60,185) })) };
  log("🏟 Sealed-bid sports auction opens — soccer, hoops, racing, fights on the block.","");
}
function bidSports(i, amount){
  const a=G.sportsAuction; if(!a) return {win:false};
  const p=a.packs[i]; if(!p) return {win:false};
  const k=DATA.SPORTS.find(s=>s.id===p.kind);
  if(G.studio.cash<amount) { log("💸 You can't cover a "+fmtM(amount)+" bid.","bad"); return {win:false}; }
  a.packs=a.packs.filter(x=>x!==p);
  if(amount>=p.rival){
    spend("sports", amount);
    const bump=Math.round((2.5+rnd()*3.5)*10)/10;
    G.streamer.subs+=bump; G.streamer.lastContent=G.week;
    G.sportsPower=(G.sportsPower||0)+Math.round(amount/25);
    G.mySports.push({kind:p.kind, week:G.week});
    log(k.emoji+" WON "+k.name+" rights for "+fmtM(amount)+" — +"+fmtSubs(bump)+" instant subs, sports power up!","gold");
    saveGame();
    return {win:true};
  }
  log(k.emoji+" Outbid on "+k.name+" — a rival platform paid "+fmtM(p.rival)+".","bad");
  saveGame();
  return {win:false};
}
function skipSports(){ G.sportsAuction=null; saveGame(); }

/* ═══════════ v2: festivals & FYC ═══════════ */
function festivalFilms(){
  const yr=yearOf(G.week);
  return G.films.filter(f=>f.year===yr && f.quality && f.quality.critic>=58 && !(f.submittedFest))
    .concat(G.projects.filter(p=>p.phase==="ready" && p.quality && p.quality.critic>=58 && !p.submittedFest));
}
function tickFestivals(){
  const fest=DATA.FESTIVALS.find(x=>x.woy===woyOf(G.week));
  if(!fest || G.pendingChoice || G.pendingReport || G.pendingAuction || G.sportsAuction) return;
  const elig=festivalFilms();
  const choices=[];
  elig.slice(0,3).forEach(f=>{
    choices.push({ label:"Submit “"+f.title+"” (−$3M, critic "+f.quality.critic+")", run(G){
      spend("marketing", 3); f.submittedFest=true;
      const winP=clamp(0.25+f.quality.critic/180+(f.fyc?0.1:0), 0.2, 0.8);
      if(chance(winP)){
        const prize=rint(4,9);
        earn("other", prize);
        G.studio.rep=clamp(G.studio.rep+3,5,99);
        G.festWins.push({year:yearOf(G.week), fest:fest.name, film:f.title});
        if(f.inTheaters!==undefined && f.phase===undefined){ f.festWins=(f.festWins||[]); f.festWins.push(fest.name); f.festPrestige=(f.festPrestige||0)+10; }
        else f.buzzBonus=(f.buzzBonus||0)+0.08;
        G.log(fest.emoji+" "+fest.name+": “"+f.title+"” takes a prize! +"+fmtM(prize)+" purse, +3 rep, awards momentum.","gold");
      }else{
        G.studio.rep=clamp(G.studio.rep+1,5,99);
        if(f.phase==="ready") f.buzzBonus=(f.buzzBonus||0)+0.04;
        G.log(fest.emoji+" "+fest.name+": “"+f.title+"” screened well. No prize, but +1 rep.","");
      }
    }});
  });
  if(!choices.length) return;
  choices.push({ label:"Skip "+fest.name, run(G){} });
  G.pendingChoice={ icon:fest.emoji, title:fest.name+" is calling",
    text:"One of the four great festivals. A premiere here builds buzz, prize money and awards momentum.",
    choices:choices.map((c,i)=>({label:c.label, i})) };
  G._evtRun=choices;
}
function fycFilm(fid){
  const f=G.films.find(x=>x.id===fid);
  if(!f || f.fyc) return;
  if(woyOf(G.week)<44){ log("🗳 FYC campaigning runs weeks 48–52 (season heats from W44).",""); return; }
  if(G.studio.cash<4){ log("💸 FYC ads cost $4M.","bad"); return; }
  spend("marketing", 4); f.fyc=true;
  log("🗳 For-Your-Consideration campaign launched for “"+f.title+"” (−$4M, awards momentum up).","good");
  saveGame();
}

/* ═══════════ awards (year end) ═══════════ */
function runAwards(){
  const yr=yearOf(G.week)-1;
  const mine=G.films.filter(f=>f.year===yr && f.awardsEligible);
  const noms=[];
  for(const f of mine){
    const g=DATA.GENRES[f.genre];
    let prestige=f.quality.critic*(0.6+g.awards*0.5);
    prestige += (f.festPrestige||0) + (f.fyc?12:0);   // v2 festivals + FYC momentum
    if(prestige>=55) noms.push({title:f.title, f, prestige, mine:true});
  }
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
    log("Awards season came and went. No nominations for "+G.studio.name+".","bad");
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
  /* v2: yearly new talent class */
  const cls=[];
  for(let i=0;i<3;i++){ const t=genActor(false,{power:rint(1,2), cls:yr}); G.talent.push(t); cls.push(t.name); }
  if(chance(.6)){ const t=genDirector(false,null,{power:rint(1,2), cls:yr}); G.talent.push(t); cls.push(t.name); }
  log("🌱 New Faces of Year "+(yr+1)+" join the market: "+cls.slice(0,3).join(", ")+(cls.length>3?"…":"")+".","");
  /* v2: discovery of the year — a breakout mints a star */
  const breakouts=[];
  G.films.filter(f=>f.year===yr && f.opening>=45).forEach(f=>{
    (f.cast||[]).forEach(c=>{ if(c.power<=2) breakouts.push(c); });
  });
  if(breakouts.length){
    const c=pick(breakouts);
    c.power=Math.min(5,c.power+2); c.heat=Math.min(3,(c.heat||0)+2);
    log("💎 Discovery of the Year: "+c.name+" broke out — now a "+c.power+"★ force.","gold");
  }
  /* v3: career fade — unused talent loses power */
  let faded=0;
  G.talent.forEach(tt=>{
    if(!tt.pics && (yr-(tt.joinedYear||1))>=2 && tt.power>1 && chance(0.5)){ tt.power--; faded++; }
  });
  if(faded) log("🍂 "+faded+" talent name"+(faded>1?"s":"")+" faded a little without work.","");
}

/* ═══════════ events ═══════════ */
function tickEvents(){
  if(!chance(0.34*DATA.DIFFICULTIES[G.difficulty].eventRate)) return;
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

/* ═══════════ v2: library re-releases (104-week cooldown) ═══════════ */
function canRerelease(f){
  return !f.streamingOriginal && (f.ww||0)>=120 && !f.inTheaters
    && G.week-(f.releaseWeek||0)>=104 && G.week-(f.rereleasedAt||0)>=104;
}
function rereleaseFilm(fid){
  const f=G.films.find(x=>x.id===fid);
  if(!f || !canRerelease(f)) return;
  if(G.studio.cash<6){ log("💸 A re-release campaign costs $6M.","bad"); return; }
  spend("marketing", 6);
  const opening=clamp((f.ww||120)*0.06, 4, 25);
  const total=Math.round(opening*2.6);
  f.dom+=total; f.ww+=total;
  earn("theatrical", total*0.53);
  f.rereleasedAt=G.week;
  f.awards=f.awards||[];
  log("🎟 Anniversary re-release: “"+f.title+"” returns to theaters — "+fmtG(total)+" nostalgia gross.","gold");
  saveGame();
}
/* v3: reboots — recycle 6-year-old library titles */
function canReboot(f){
  return !f.streamingOriginal && G.week-(f.releaseWeek||0)>=312 && !f.rebooted;
}
function rebootFilm(fid){
  const f=G.films.find(x=>x.id===fid);
  if(!f || !canReboot(f)) return;
  f.rebooted=true;
  const idea=genIdea();
  idea.genre=f.genre; idea.title=f.title+" ("+pick(["Rebooted","Origins","Reawakened"])+")";
  idea.script=clamp(rint(58,82),50,92); idea.awareness=0.10; idea.lapses=G.week+20;
  idea.blurb="A fresh take on your "+(yearOf(G.week)-yearOf(f.releaseWeek))+"-year-old title "+f.title+".";
  G.ideas.push(idea);
  log("🔁 Rebooting “"+f.title+"” — the new take is in Develop (+awareness).","gold");
  saveGame();
}
/* v3: film continuations of shows (needs 2+ strong seasons) */
function seriesMovieIdea(sid){
  const s=G.series.find(x=>x.id===sid); if(!s) return;
  if(s.seasons.length<2 || !s.seasons.some(x=>x.viewership>=58)) return;
  const idea=genIdea();
  idea.genre=DATA.GENRES[s.genre]? s.genre : "thriller";
  idea.scale="mid";
  idea.title=s.title+": The Movie";
  idea.script=clamp(rint(60,84),55,93); idea.awareness=0.18; idea.hot=true; idea.lapses=G.week+20;
  idea.blurb="The story of "+s.title+" continues on the big screen.";
  G.ideas.push(idea);
  log("🎬 “"+s.title+"” gets a film continuation — the idea is in Develop.","gold");
  saveGame();
}
/* v3: TV spin-offs of franchises */
function franchiseTvSpinoff(fid){
  const fr=frById(fid); if(!fr || fr.tier<2) return;
  const res=pitchSeries({ genre: DATA.GENRES[fr.genre]? fr.genre:"action", eps:8, perEp:6,
    platformId:pick(DATA.allPlatforms()).id, showrunner:null, cast:[],
    titleOverride:fr.name+": The Series", oddsBonus:0.3 });
  if(res.ok) log("📺 The "+fr.name+" TV spin-off found a home.","gold");
  saveGame();
}

/* ═══════════ v2: achievements ═══════════ */
function tickAchievements(){
  for(const a of DATA.ACH){
    if(G.ach[a.id]) continue;
    let ok=false; try{ ok=a.check(G); }catch(e){}
    if(ok){
      G.ach[a.id]=G.week;
      log(a.icon+" Achievement unlocked: "+a.name+" — "+a.desc,"gold");
    }
  }
}

/* ═══════════ game over ═══════════ */
function gameOver(title, text){
  if(G.over) return;
  if(G.sandbox){ log("🧪 Sandbox: something would have ended the studio here. Not today.",""); return; }
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
  tickProjects();
  // releases due (or overdue — safety net)
  for(const p of [...G.projects]){
    if(p.phase==="ready" && !p.prebuyAccepted && p.releaseWeek && p.releaseWeek<=G.week){
      const rest = Math.max(0, p.marketing - p.marketingPaid);
      if(p.imax) spend("marketing", Math.round(rest*0.08)); // premium formats premium spend
      spend("marketing", rest);
      p.marketingPaid=(p.marketingPaid||0)+rest;
      releaseFilm(p);
    }
  }
  tickTheatrical();
  tickSeries();
  tickRivals();
  tickEmpire();
  tickStreamer();
  maybeOttOffers();
  maybePay1();
  G.offers=G.offers.filter(o=>o.expires>=G.week || o.type==="renewal");
  refreshIdeas();
  refreshIpMarket();
  if(chance(.18)) G.talent.push(chance(.6)?genActor(chance(.2)):genDirector(chance(.2)));
  G.talent=G.talent.filter(t=>!t.bookedUntil||t.bookedUntil>=G.week-30).slice(-52);
  tickPoaching();
  tickFestivals();
  tickEvents();
  maybeSportsAuction();
  tickAchievements();
  if(G.streamWar>0)G.streamWar--;
  if(G.theaterCap>0)G.theaterCap--;
  // exhibitor relations drift back toward neutral
  G.exhibRel = clamp(G.exhibRel + (60-G.exhibRel)*0.02, 10, 95);
  if(woyOf(G.week)===1 && G.week>1) yearWrap();
  const snap={ week:G.week, cats:{...G.weekTx}, net:weekNet(G.weekTx) };
  G.txHistory.push(snap);
  if(G.txHistory.length>12) G.txHistory.shift();
  // v2 IPO: shareholders judge each quarter
  if(G.ipo){
    G.quarterNet+=snap.net;
    if([13,26,39,52].includes(woyOf(G.week))){
      if(G.quarterNet<0){
        G.studio.rep=clamp(G.studio.rep-3,5,99);
        log("📉 Shareholders punish a weak quarter (−3 rep). The board wants a turnaround plan.","bad");
      }else{
        log("📈 Solid quarter reported to shareholders.","good");
      }
      G.quarterNet=0;
    }
  }
  saveGame();
  return G.flash;
}
function advanceWeeks(n){
  for(let i=0;i<n;i++){
    if(G.over||G.pendingChoice||G.pendingReport||G.pendingAuction||G.sportsAuction) break;
    advanceWeek();
  }
}

/* ═══════════ misc getters for UI ═══════════ */
function activeFilms(){ return G.films.filter(f=>f.inTheaters); }
function readyProjects(){ return G.projects.filter(p=>p.phase==="ready"); }
function inProdProjects(){ return G.projects.filter(p=>["pre","shoot","post"].includes(p.phase)); }
function seasonDateLabel(w){ const s=DATA.seasonOf(woyOf(w)); return s.month+" Y"+yearOf(w); }
