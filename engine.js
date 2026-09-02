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
function newGame(archId, name, opts){
  opts = opts||{};
  const arch = DATA.ARCHETYPES.find(a=>a.id===archId) || DATA.ARCHETYPES[1];
  const scen = DATA.SCENARIOS[opts.scenario||"standard"] || DATA.SCENARIOS.standard;
  G = {
    v: (DATA.SAVE_VERSION||4),
    studio:{ name: name || "Parallax Pictures",
             cash: arch.cash + (scen.cash||0),
             debt: Math.max(0,(scen.debt||0)),
             rep: clamp(arch.rep + (scen.rep||0), 5, 99),
             overhead: arch.overhead + (scen.overhead||0), archId: arch.id,
             flopPenalty: arch.flopPenalty + (scen.flopPenalty||0), devBonus: arch.devBonus + (scen.devBonus||0) },
    scenario: scen? (opts.scenario||"standard") : "standard",
    difficulty: DATA.DIFFICULTIES[opts.difficulty]? opts.difficulty : "normal",
    sandbox: !!opts.sandbox,
    slot: opts.slot||1,
    week: 1,
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
    infl:1, execs:{}, lastClass:yearOf(1),
    streamer:null, pendingSports:null, sportsAuction:null, sportsWon:[], exhibitor:50, exhibRel:70,
    achv:[], ach:{}, festWins:[], extraPlatforms:[], ipMarket:[], trends:{}, trendShiftAt:0, pendingEarnings:null, retired:[],
    over:null, pendingReport:null, pendingChoice:null,
    weeksInDebt:0,
    ipo:false, quarterNet:0, mezz:0,
    outputDeal:0, wrapDeal:0, agencyExcl:0,
    sportsPower:0, mySports:[],
    public:null,
    sfx:[],
    /* ── v5 state ── */
    piracy: (DATA.PIRACY? DATA.PIRACY.start : 18),
    unionMeter: (DATA.UNION? DATA.UNION.start : 25),
    unionStats: { signed:0, strikes:0 },
    wageInfl: 1,
    trendHist: {},
    agencyDeals: {},          // agencyId → week the exclusive lapses
    maOffers: [], maDeals: [], maLibraries: 0, maFetchedAt: 0,
    pendingDeepfake: null,
    precursorWins: { year:0, count:0 },
    tut: opts.tutorial===false ? null : { step:0, done:false },
    aiInUse: 0,
  };
  seedTrends();
  genTalentPool();
  seedIdeas();
  seedRivalYear();
  refreshIpMarket(true);
  scenarioKickoff(scen);
  G.log = log;
  log("🎬 "+G.studio.name+" is founded ("+DATA.SCENARIOS[G.scenario].name+" · "+DATA.DIFFICULTIES[G.difficulty].name+(G.sandbox?" · sandbox":"")+") . "+arch.sub, "gold");
  log("💡 Tip: Greenlight a film in the Develop tab, or pitch a series in OTT & Series.", "");
  if(G.studio.debt>0) log("🧯 Turnaround: you inherited "+fmtM(G.studio.debt)+" of debt. Interest never sleeps.", "bad");
  saveGame();
  return G;
}


/* v4: sound-effect bus — the UI drains this each tick and plays real stings */
function sfx(kind){ if(!G) return; G.sfx = G.sfx||[]; if(G.sfx.length<6) G.sfx.push(kind); }
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

/* ═══════════ save / load — versioned schema + migrations (v4) ═══════════ */
const SAVE_KEY = "bow_save";
function saveGame(){
  try{
    if(typeof localStorage==="undefined" || !G) return;
    G.v = DATA.SAVE_VERSION||4;
    const raw = JSON.stringify(G);
    localStorage.setItem(SAVE_KEY, raw);
    try{ localStorage.setItem("bow_slot"+(G.slot||1), raw); }catch(e){}
  }catch(e){}
}
function hasSave(){
  try{ return typeof localStorage!=="undefined" && !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; }
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
    let parsed = JSON.parse(raw);
    const problems = validateSave(parsed);
    if(problems.length){
      console.warn("Save rejected:", problems.join("; "));
      return null;
    }
    const { save } = migrateSave(parsed);
    G = save; G.log=log; saveGame(); return G;
  }catch(e){ return null; }
}
function validateSave(s){
  const problems=[];
  if(!s || typeof s!=="object") return ["save is not an object"];
  if(!s.studio || typeof s.studio!=="object") problems.push("missing studio");
  else{
    if(!Number.isFinite(s.studio.cash)) problems.push("studio.cash is not a number");
    if(!Number.isFinite(s.studio.rep))  problems.push("studio.rep is not a number");
  }
  if(!Number.isFinite(s.week) || s.week<1) problems.push("bad week counter");
  for(const k of ["projects","films","series","offers","ideas","franchises","talent","rivals","news"]){
    if(!Array.isArray(s[k])) problems.push("missing array: "+k);
  }
  return problems;
}
const SAVE_MIGRATIONS = {
  2(s){
    s.execs=s.execs||{}; s.ipo=!!s.ipo; s.quarterNet=s.quarterNet||0; s.mezz=s.mezz||0;
    s.outputDeal=s.outputDeal||0; s.wrapDeal=s.wrapDeal||0; s.agencyExcl=s.agencyExcl||0;
    s.ach=s.ach||{}; s.festWins=s.festWins||[];
    s.extraPlatforms=s.extraPlatforms||[]; s.ipMarket=s.ipMarket||[];
    s.streamer=s.streamer||null; s.sportsAuction=null; s.sportsPower=s.sportsPower||0; s.mySports=s.mySports||[];
    s.exhibRel=s.exhibRel||70; s.exhibitor=s.exhibitor||50;
    s.stats=s.stats||{}; s.stats.streamSales=s.stats.streamSales||0;
    (s.talent||[]).forEach(t=>{ if(t.pics===undefined){t.pics=0; t.joinedYear=t.joinedYear||1;} });
    (s.projects||[]).forEach(p=>{
      p.rating=p.rating||"PG-13"; p.location=p.location||"home";
      p.pattern=p.pattern||"wide"; p.rollout=p.rollout||"day";
      p.window=p.window||45; if(p.awareness===undefined)p.awareness=0;
    });
    return s;
  },
  3(s){
    if(!s.streamer) s.streamer=null;
    if(!s.sportsAuction) s.sportsAuction=null;
    if(!Number.isFinite(s.sportsPower)) s.sportsPower=0;
    if(!Array.isArray(s.mySports)) s.mySports=[];
    if(!Number.isFinite(s.exhibRel)) s.exhibRel=70;
    if(!Number.isFinite(s.exhibitor)) s.exhibitor=50;
    if(!s.upgrades) s.upgrades={};
    if(!Number.isFinite(s.infl)) s.infl=1;
    if(!s.execs) s.execs={};
    return s;
  },
  4(s){
    s.trends = s.trends && typeof s.trends==="object" ? s.trends : {};
    for(const g of Object.keys(DATA.GENRES)) if(!Number.isFinite(s.trends[g])) s.trends[g]=1;
    if(!Number.isFinite(s.trendShiftAt)) s.trendShiftAt = 0;
    if(!Array.isArray(s.retired)) s.retired=[];
    if(!Array.isArray(s.achv)) s.achv=[];
    if(!Array.isArray(s.sportsWon)) s.sportsWon=[];
    if(!Number.isFinite(s.exhibitor)) s.exhibitor=50;
    if(!Number.isFinite(s.exhibRel)) s.exhibRel=70;
    if(!s.execs) s.execs={};
    if(!s.upgrades) s.upgrades={};
    if(!Number.isFinite(s.infl)) s.infl=1;
    s.pendingEarnings = s.pendingEarnings||null;
    if(!Array.isArray(s.festWins)) s.festWins=[];
    if(!s.ach) s.ach={};
    if(!Array.isArray(s.extraPlatforms)) s.extraPlatforms=[];
    if(!Array.isArray(s.ipMarket)) s.ipMarket=[];
    if(!Number.isFinite(s.sportsPower)) s.sportsPower=0;
    if(!Array.isArray(s.mySports)) s.mySports=[];
    if(!Number.isFinite(s.mezz)) s.mezz=0;
    if(!Number.isFinite(s.quarterNet)) s.quarterNet=0;
    if(!Number.isFinite(s.outputDeal)) s.outputDeal=0;
    if(!Number.isFinite(s.wrapDeal)) s.wrapDeal=0;
    if(!Number.isFinite(s.agencyExcl)) s.agencyExcl=0;
    (s.talent||[]).forEach(t=>{
      if(!Number.isFinite(t.age)) t.age = rint(26,52);
      if(!Number.isFinite(t.scandal)) t.scandal = 0;
      if(!t.kind) t.kind = "actor";
      if(t.pics===undefined) t.pics=0;
      if(t.joinedYear===undefined) t.joinedYear=1;
    });
    (s.films||[]).forEach(f=>{ if(!Array.isArray(f.reviews)) f.reviews=[]; });
    (s.franchises||[]).forEach(fr=>{ if(!Number.isFinite(fr.fatigue)) fr.fatigue=0; if(!Number.isFinite(fr.decay)) fr.decay=0.5; });
    if(s.streamer){
      if(!s.streamer.tier) s.streamer.tier="premium";
      if(!Number.isFinite(s.streamer.crackdown)) s.streamer.crackdown=0;
      if(!Number.isFinite(s.streamer.subs)) s.streamer.subs=0;
    }
    if(s.public && !Number.isFinite(s.public.price)){
      s.public.price = DATA.MARKET.ipoPrice;
      s.public.shares = DATA.MARKET.shares;
      s.public.history = [DATA.MARKET.ipoPrice];
      s.public.downgrades = 0;
    }
    (s.projects||[]).forEach(p=>{
      if(!p.rating) p.rating="PG-13";
      if(!p.location) p.location="home";
      if(!p.pattern) p.pattern="wide";
      if(!p.rollout) p.rollout="day";
      if(!p.window) p.window=45;
      if(p.awareness===undefined) p.awareness=0;
    });
    return s;
  },
  /* ── v5: agencies, piracy/union meters, wage inflation, M&A, trend history, tutorial ── */
  5(s){
    if(!Number.isFinite(s.piracy)) s.piracy = DATA.PIRACY? DATA.PIRACY.start : 18;
    if(!Number.isFinite(s.unionMeter)) s.unionMeter = DATA.UNION? DATA.UNION.start : 25;
    s.unionStats = s.unionStats || {signed:0, strikes:0};
    if(!Number.isFinite(s.wageInfl)) s.wageInfl = 1;
    s.trendHist = s.trendHist && typeof s.trendHist==="object" ? s.trendHist : {};
    for(const g of Object.keys(DATA.GENRES)){
      if(!Array.isArray(s.trendHist[g])) s.trendHist[g] = [ (s.trends && Number.isFinite(s.trends[g]))? s.trends[g] : 1 ];
    }
    if(!s.agencyDeals || typeof s.agencyDeals!=="object") s.agencyDeals = {};
    if(!Array.isArray(s.maOffers)) s.maOffers = [];
    if(!Array.isArray(s.maDeals)) s.maDeals = [];
    if(!Number.isFinite(s.maLibraries)) s.maLibraries = 0;
    if(!Number.isFinite(s.maFetchedAt)) s.maFetchedAt = 0;
    if(s.pendingDeepfake===undefined) s.pendingDeepfake = null;
    if(!s.precursorWins || typeof s.precursorWins!=="object") s.precursorWins = {year:0, count:0};
    if(s.tut===undefined) s.tut = null;            // tutorial is a fresh-game experience
    if(!Number.isFinite(s.aiInUse)) s.aiInUse = 0;
    (s.talent||[]).forEach(t=>{ if(!t.agency && DATA.AGENCIES && DATA.AGENCIES.length) t.agency = DATA.AGENCIES[(t.id||0) % DATA.AGENCIES.length].id; });
    (s.projects||[]).forEach(p=>{ if(p.location==="home") p.location="la"; if(!Number.isFinite(p.rebateEarned)) p.rebateEarned=0; });
    (s.films||[]).forEach(f=>{ if(f.location==="home") f.location="la"; if(!Number.isFinite(f.rebateEarned)) f.rebateEarned=0; });
    if(s.studio && !Number.isFinite(s.studio.devBonus)) s.studio.devBonus = 0;
    return s;
  },
};
function migrateSave(s){
  const target = DATA.SAVE_VERSION||4;
  let from = Number.isFinite(s.v)? s.v : 1;
  const applied=[];
  for(let v=from+1; v<=target; v++){
    const step=SAVE_MIGRATIONS[v];
    if(step){ s=step(s)||s; applied.push(v); }
  }
  if(!applied.length && SAVE_MIGRATIONS[target]) s = SAVE_MIGRATIONS[target](s)||s;
  s.v = target;
  return { save:s, applied };
}
function migrate(g){
  if(!g || typeof g!=="object") return null;
  const { save } = migrateSave(g);
  return save;
}
function loadGame(){
  try{
    const raw = (typeof localStorage!=="undefined") && localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    let parsed = JSON.parse(raw);
    const problems = validateSave(parsed);
    if(problems.length){
      try{ localStorage.setItem(SAVE_KEY+"_broken", raw); localStorage.removeItem(SAVE_KEY); }catch(e){}
      console.warn("Save rejected:", problems.join("; "));
      return null;
    }
    const fromV = Number.isFinite(parsed.v)? parsed.v : 1;
    const { save, applied } = migrateSave(parsed);
    G = save;
    G.log = log;
    if(applied.length) log("💾 Save upgraded from schema v"+fromV+" → v"+G.v+". Your studio carried over intact.","");
    return G;
  }catch(e){ console.warn("Save could not be read:", e && e.message); return null; }
}
function exportCode(){
  try{ return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); }catch(e){ return ""; }
}
function importCode(code){
  try{
    const g = migrateSave(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))).save;
    if(!g || !g.studio) return false;
    G = g; G.log = log; saveGame(); return true;
  }catch(e){ return false; }
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
function startAge(){ return rint(DATA.CAREER.minAge, DATA.CAREER.maxStartAge); }
function genActor(hot, opts){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(45,88)+power*3+rint(-6,6), 40, 96);
  const fee = [0.3,1.2,4,12,25][power-1] * (hot? 1.2:1);
  return { id:nid(), kind:"actor", name:talentName(), power, skill,
           agency:(DATA.AGENCIES? pick(DATA.AGENCIES).id : null),
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0, genreFit:null,
           age: hot? rint(24,38) : (typeof startAge==="function"? startAge() : rint(26,52)), scandal:0,
           pics:0, joinedYear: yearOf(G?G.week:1) };
}

function genDirector(hot, fitGenre, opts){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(50,90)+power*2+rint(-5,5), 45, 97);
  const fee = [0.8,2,5,10,18][power-1]*(hot?1.15:1);
  const fits = Object.keys(DATA.GENRES);
  return { id:nid(), kind:"director", name:pick(DATA.DIR_FIRST)+" "+pick(DATA.LAST),
           power, skill, agency:(DATA.AGENCIES? pick(DATA.AGENCIES).id : null),
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0,
           genreFit: fitGenre || pick(fits), age: hot? rint(28,42) : (typeof startAge==="function"? startAge() : rint(26,52)), scandal:0,
           pics:0, joinedYear: yearOf(G?G.week:1), auteur: !!(opts&&opts.auteur) };
}

/* ── v4: WRITERS — they drive the script score ── */
function genWriter(hot, fitGenre){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(48,88)+power*3+rint(-6,6), 42, 97);
  const fee = [0.4,1.1,2.8,6,12][power-1]*(hot?1.2:1);
  return { id:nid(), kind:"writer", name:talentName(), power, skill,
           agency:(DATA.AGENCIES? pick(DATA.AGENCIES).id : null),
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0,
           genreFit: fitGenre || pick(Object.keys(DATA.GENRES)),
           trait: pick(DATA.WRITER_TRAITS), age: startAge(), scandal:0 };
}
/* ── v4: PRODUCERS — they keep the shoot on budget and on schedule ── */
function genProducer(hot){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(50,90)+power*3+rint(-5,5), 45, 97);
  const fee = [0.5,1.4,3.2,7,13][power-1]*(hot?1.15:1);
  return { id:nid(), kind:"producer", name:pick(DATA.PROD_FIRST)+" "+pick(DATA.LAST), power, skill,
           agency:(DATA.AGENCIES? pick(DATA.AGENCIES).id : null),
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0, genreFit:null,
           trait: pick(DATA.PROD_TRAITS), age: startAge(), scandal:0 };
}
function genTalentPool(){
  G.talent = [];
  for(let i=0;i<22;i++) G.talent.push(genActor(false));
  for(let i=0;i<9;i++)  G.talent.push(genDirector(false));
  for(let i=0;i<8;i++)  G.talent.push(genWriter(false));
  for(let i=0;i<7;i++)  G.talent.push(genProducer(false));
  G.talent.push(genActor(true));
  G.talent.push(genDirector(true));
  G.talent.push(genWriter(true));
}

function spawnDirectorHot(){ G.talent.push(genDirector(true)); }
function spawnWriterHot(){ if(G) G.talent.push(genWriter(true)); }
function talentById(id){ return G.talent.find(t=>t.id===id); }
function talentByKind(kind){ return G.talent.filter(t=>t.kind===kind); }
function freeTalent(kind){ return G.talent.filter(t=>t.kind===kind && !t.bookedUntil && !(t.retired)); }
function actorFee(t){
  if(!t) return 0;
  const scandalDiscount = t.scandal>0? 0.55 : 1;
  let f = t.fee * (1+0.25*(t.heat||0)) * scandalDiscount;
  if(G.upgrades.agency) f*=0.85;
  if(t.pics>=2) f*=0.9;
  if(G.wrapDeal>0) f*=0.8;
  if(G.agencyExcl>G.week) f*=0.85;
  if(G.execs && (G.execs.casting || G.execs.cast)) f*=0.9;
  // v5: holding an exclusive with their agency cuts the quote (WME/CAA-style)
  if(t.agency && G.agencyDeals && G.agencyDeals[t.agency]>G.week){
    const ag = DATA.agency ? DATA.agency(t.agency) : null;
    f *= 1-(ag? ag.disc||0.15 : 0.15);
  }
  // v5: wage inflation — talent compound faster than the market
  f *= (G.wageInfl||1);
  return Math.round(f*10)/10;
}

/* ── v4 careers: ageing, prime-years drift, retirement, scandals ── */
function ageTalent(){
  const C=DATA.CAREER;
  const retiring=[];
  for(const t of G.talent){
    t.age = (t.age||startAge()) + 1;
    if(t.scandal>0) t.scandal = Math.max(0, t.scandal-52);
    // skill drifts up to prime, then slowly down; star power fades late
    if(t.age < C.primeLow)       t.skill = clamp(t.skill + rint(0,3), 20, 98);
    else if(t.age <= C.primeHigh) t.skill = clamp(t.skill + rint(-1,2), 20, 98);
    else                          t.skill = clamp(t.skill + rint(-3,1), 20, 98);
    if(t.age > C.primeHigh+8 && chance(0.35) && t.power>1) t.power--;
    if((t.heat||0) > 0 && chance(0.5)) t.heat--;
    if(t.age >= C.retireFrom && !t.bookedUntil && chance(C.retireChancePerYear)) retiring.push(t);
  }
  for(const t of retiring){
    t.retired = true;
    G.retired = G.retired||[];
    G.retired.push({ name:t.name, kind:t.kind, age:t.age, week:G.week });
    log("👋 "+t.name+" ("+kindLabel(t.kind)+", "+t.age+") announces retirement after a long career.","");
  }
  G.talent = G.talent.filter(t=>!t.retired);
}
function kindLabel(k){ return {actor:"actor", director:"director", writer:"writer", producer:"producer"}[k]||k; }
function scandalHit(t, weeks){
  if(!t) return;
  t.scandal = (t.scandal||0) + (weeks||DATA.CAREER.scandalCooldown);
  t.heat = 0;
}
function tickCareers(){
  for(const t of G.talent){ if(t.scandal>0) t.scandal--; }
}

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

/* ═══════════ v4: genre trends / market cycles ═══════════ */
function seedTrends(){
  G.trends={};
  for(const g of Object.keys(DATA.GENRES)) G.trends[g] = Math.round((0.92+rnd()*0.20)*100)/100;
  // one genre always starts genuinely hot so the first year has a story
  G.trends[pick(Object.keys(DATA.GENRES))] = 1.18;
  G.trendShiftAt = G.week + DATA.TREND.shiftWeeks;
}
function trendOf(genre){
  if(!G || !G.trends) return 1;
  const v = G.trends[genre];
  return Number.isFinite(v)? v : 1;
}
/* the market only passes ~75% of a genre's heat through to opening weekend */
function trendPull(genre){ return 1 + (trendOf(genre)-1)*0.75; }
function trendLabel(genre){
  const v=trendOf(genre);
  for(const l of DATA.TREND.labels){ if(v>=l.at) return l; }
  return DATA.TREND.labels[DATA.TREND.labels.length-1];
}
/* Trends drift every quarter: mean-reverting random walk, nudged by what actually performed. */
function shiftTrends(){
  const T=DATA.TREND;
  const movers=[];
  for(const g of Object.keys(DATA.GENRES)){
    const cur = trendOf(g);
    // recent performance feedback: your & rivals' hits in this genre heat the genre up
    let perf=0;
    for(const f of G.films){
      if(f.genre!==g || !f.ww) continue;
      if(G.week - (f.releaseWeek||0) > 52) continue;
      perf += f.ww >= breakevenWW(f)*1.4 ? 0.05 : f.ww < breakevenWW(f)*0.7 ? -0.04 : 0;
    }
    const revert = (1-cur)*T.revertPull;
    const next = clamp(cur + revert + gauss()*T.drift*0.55 + clamp(perf,-0.10,0.12), T.min, T.max);
    const delta = next-cur;
    G.trends[g] = Math.round(next*100)/100;
    // v5: remember each quarter's heat for the sparkline history
    G.trendHist = G.trendHist||{};
    G.trendHist[g] = (G.trendHist[g]||[]).concat(next);
    if(G.trendHist[g].length>20) G.trendHist[g].shift();
    movers.push({g, delta, next});
  }
  movers.sort((a,b)=>b.delta-a.delta);
  const up=movers[0], down=movers[movers.length-1];
  if(up && up.delta>0.05){
    log("📈 "+pick(DATA.TREND.headlines.hot).replace("{g}", DATA.GENRES[up.g].name)+" (heat "+G.trends[up.g].toFixed(2)+"×)","good");
  }
  if(down && down.delta<-0.05){
    log("📉 "+pick(DATA.TREND.headlines.cold).replace("{g}", DATA.GENRES[down.g].name)+" (heat "+G.trends[down.g].toFixed(2)+"×)","bad");
  }
}
function tickTrends(){
  if(!G.trends || !Object.keys(G.trends).length) seedTrends();
  if(!G.trendShiftAt) G.trendShiftAt = G.week + DATA.TREND.shiftWeeks;
  if(G.week >= G.trendShiftAt){
    shiftTrends();
    G.trendShiftAt = G.week + DATA.TREND.shiftWeeks;
  }
}

/* ═══════════ v4: franchise fatigue ═══════════ */
function fatigueOfName(name){
  if(!name) return 0;
  const fr = G.franchises.find(x=>x.name===name);
  if(!fr) return 0;
  return clamp(fr.fatigue||0, 0, DATA.FATIGUE.max);
}
function addFatigue(fr){
  if(!fr) return;
  fr.fatigue = clamp((fr.fatigue||0) + DATA.FATIGUE.perEntry, 0, 0.95);
}
function tickFatigue(){
  for(const fr of G.franchises){
    if(!Number.isFinite(fr.fatigue)) fr.fatigue=0;
    const last = fr.entries.length? fr.entries[fr.entries.length-1].week : fr.built||0;
    if(G.week - last > 26) fr.fatigue = Math.max(0, fr.fatigue - DATA.FATIGUE.recoverPerWeek);
  }
}

/* ═══════════ quality & box office math ═══════════ */
function neededBudget(genre, scale){
  const S=DATA.SCALES[scale], gb=DATA.GENRES[genre].budgetBias;
  return (S.bMin+S.bMax)/2 * gb;
}
function computeQuality(p){
  const g = DATA.GENRES[p.genre];
  const dirScore = p.director ? p.director.skill*(p.director.genreFit===p.genre?1.1:0.95) : 55;
  // v5 AI: a synthetic cast acts at a fixed, slightly-off level
  const castScore = p.aiCast ? (DATA.AI? DATA.AI.castSkill:58)
                    : p.cast.length? p.cast.reduce((s,c)=>s+c.skill,0)/p.cast.length : 52;
  const pv = clamp(p.budget/neededBudget(p.genre,p.scale), .55, 1.12);
  let prodScore = 52 + 48*pv;
  if(p.producer) prodScore += clamp((p.producer.skill-55)/6, -3, 7);
  let craft = 0.30*scriptScoreOf(p) + 0.24*dirScore + 0.22*castScore + 0.24*prodScore;
  if(G.upgrades.vfx && p.scale==="tentpole") craft += 3;
  if(p.aiScript) craft -= (DATA.AI? DATA.AI.scrQualityPenalty:4);   // v5: the algorithm has no soul
  if(p.director && p.director.auteur) craft += 5;
  const fat = fatigueOfName(p.franchiseName);
  if(fat>0) craft -= fat/DATA.FATIGUE.max * DATA.FATIGUE.qualityHit;
  craft += gauss()*5.5;
  const overall = clamp(Math.round(craft), 8, 97);
  const rate = DATA.rating ? DATA.rating(p.rating) : null;
  let criticBias = g.critic + (rate?rate.critic:0);
  if(!rate){
    if(p.rating==="R") criticBias += 4;
    if(p.foreignLang) criticBias += 3;
  } else {
    if(p.foreignLang) criticBias += 3;
  }
  const critic = clamp(Math.round(overall + criticBias + gauss()*3), 5, 99);
  let audRaw = overall + g.aud + Math.min(p.cast.reduce((s,c)=>s+c.power,0),8)*1.2 + gauss()*3;
  if(p.aiCast) audRaw -= (DATA.AI? DATA.AI.audPenalty:9);          // v5: audiences smell the pixels
  const aud    = clamp(Math.round(audRaw), 5, 99);
  return { overall, critic, aud };
}

/* v4: the writer drives the page. Genre fit and skill add on top of the spec's own score. */
function writerBonus(writer, genre){
  if(!writer) return 0;
  const fit = writer.genreFit===genre? 1.25 : 0.9;
  return Math.round(clamp((writer.skill-52)/4.2, -3, 11) * fit * 10)/10;
}
function scriptScoreOf(p){
  if(p.aiScript) return clamp((DATA.AI? DATA.AI.scriptScore:56) + (p.rewritten? 6:0), 20, 99); // v5 SynthScribe
  return clamp((p.script||55) + (p.writerBonus||0), 20, 99);
}

/* ═══════════ v4: named critics — a real critic/audience split ═══════════ */
function quoteFor(score){
  if(score>=85) return pick(DATA.CRITIC_QUOTES.rave);
  if(score>=68) return pick(DATA.CRITIC_QUOTES.good);
  if(score>=45) return pick(DATA.CRITIC_QUOTES.mixed);
  return pick(DATA.CRITIC_QUOTES.bad);
}
function reviewFilm(f){
  const base = f.quality.critic;
  const panel = [];
  const pool = DATA.CRITICS.slice();
  const n = Math.min(5, pool.length);
  for(let i=0;i<n;i++){
    const c = pool.splice(rint(0,pool.length-1),1)[0];
    let s = base - c.harsh + gauss()*7;
    if(c.loves.includes(f.genre)) s += 7;
    if(c.hates.includes(f.genre)) s -= 9;
    s = clamp(Math.round(s), 3, 100);
    panel.push({ id:c.id, name:c.name, outlet:c.outlet, score:s, quote:quoteFor(s) });
  }
  f.reviews = panel;
  f.criticAvg = Math.round(panel.reduce((a,r)=>a+r.score,0)/panel.length);
  f.freshPct  = Math.round(panel.filter(r=>r.score>=60).length/panel.length*100);
  // the published consensus becomes the film's critic score
  f.quality.critic = clamp(Math.round(f.quality.critic*0.45 + f.criticAvg*0.55), 5, 99);
  return panel;
}
function audienceScoreOf(f){
  return clamp((f.quality? f.quality.aud:50) - Math.round((f.reviewBombed||0)*0.35), 1, 99);
}
function recMarketing(p){ return Math.round(p.budget*DATA.SCALES[p.scale].mktRate * (p.imax||p.premium?1.08:1) * (G.infl||1)); }

function expectedOpening(p, weekAbs){
  const S=DATA.SCALES[p.scale], g=DATA.GENRES[p.genre];
  let base = S.openBase * g.mass * (g.openBoost||1) * (G.infl||1);
  if(p.foreignLang) base *= 0.75;
  const starP = p.cast.reduce((s,c)=>s+c.power,0);
  let starF = 1 + 0.075*Math.min(starP, 6);
  const scandalous = p.cast.filter(c=>c.scandal>0).length;
  if(scandalous) starF *= Math.max(0.82, 1 - 0.06*scandalous);
  if(p.cast.some(c=>c.toxic && !c.rehabbed)) starF *= 0.93;
  const rec = recMarketing(p);
  let mktF = clamp(Math.pow(Math.max(p.marketing,1)/rec, 0.45), 0.5, 1.55) * (G.upgrades.marketing?1.10:1);
  if(G.execs.cmo || (G.execs && G.execs.cmo)) mktF *= 1.12;
  const season = seasonOfW(weekAbs).season;
  let fr = 1;
  if(p.franchise){
    if(typeof frHeatMult==="function") fr = frHeatMult(p)*1.35;
    else fr = 1.35;
  }
  const fatigue = 1 - fatigueOfName(p.franchiseName);
  const trend = (typeof trendPull==="function")? trendPull(p.genre) : 1;
  const repF = 0.92 + G.studio.rep/600;
  const comp = competitionFactor(p, weekAbs);
  const rate = DATA.rating ? DATA.rating(p.rating) : null;
  const ratingM = DATA.RATINGS ? DATA.RATINGS.find(r=>r.id===(p.rating||"PG-13")) : null;
  let hype = base*starF*mktF*season*fr*fatigue*trend*repF*comp*(1+(p.buzzBonus||0))*(1+(p.awareness||0));
  if(rate) hype *= (1 + (rate.open||0));
  else if(ratingM) hype *= ratingM.open;
  if(p.premium || p.imax) hype *= 1.12;
  const pat = DATA.PATTERNS ? DATA.PATTERNS.find(x=>x.id===(p.pattern||"wide")) : null; if(pat) hype*=pat.open;
  const roll = DATA.ROLLOUTS ? DATA.ROLLOUTS.find(x=>x.id===(p.rollout||"day")) : null; if(roll) hype*=roll.open;
  if(p.dayAndDate) hype *= 0.65;
  if(p.aiCast) hype *= 0.97;                          // v5: no junkets, no press tour
  if(p.aiBacklash) hype *= Math.max(0.85, 1-p.aiBacklash);   // v5: internet outrage compounds
  (p.mktBoosts||[]).forEach(b=>{ const m=DATA.mktBoost? DATA.mktBoost(b):null; if(m&&m.open) hype*=m.open; }); // v5 boosts
  hype *= timelineFactor(p, weekAbs);                 // v5: shared-universe timeline management
  const exhib = G.exhibRel || G.exhibitor || 50;
  hype *= 1 + (exhib-50)/50*0.05;
  hype *= (0.95 + (G.exhibitor||50)/1000);
  return hype;
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
  const rate = DATA.rating ? DATA.rating(p.rating) : null;
  const ratingM = DATA.RATINGS ? DATA.RATINGS.find(r=>r.id===(p.rating||"PG-13")) : null;
  let w = S.openBase * DATA.GENRES[p.genre].mass * (G.infl||1) * (p.franchise?1.35:1)
    * (1-fatigueOfName(p.franchiseName)) * ((typeof trendPull==="function")? trendPull(p.genre) : 1)
    * (1+(rate?rate.open:0)) * (p.premium||p.imax?1.12:1)
    * (0.95 + (G.exhibitor||50)/1000)
    * (p.dayAndDate?0.65:1)
    * clamp(Math.pow(Math.max(p.marketing,1)/Math.max(recMarketing(p),1),0.45),0.6,1.5);
  if(ratingM) w *= ratingM.open;
  const pat = DATA.PATTERNS ? DATA.PATTERNS.find(x=>x.id===(p.pattern||"wide")) : null; if(pat) w*=pat.open;
  const roll = DATA.ROLLOUTS ? DATA.ROLLOUTS.find(x=>x.id===(p.rollout||"day")) : null; if(roll) w*=roll.open;
  if(typeof frHeatMult==="function" && p.franchiseName) w *= frHeatMult(p);
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
  const aud = (typeof audienceScoreOf==="function")? audienceScoreOf(film) : film.quality.aud;
  if(aud>=85) legs += 0.08;
  if(aud<=40) legs -= 0.10;
  if(film.piracyPenalty) legs -= film.piracyPenalty*8;
  const pat = DATA.PATTERNS ? DATA.PATTERNS.find(x=>x.id===(film.pattern||"wide")) : null; if(pat) legs+=pat.legs;
  const roll = DATA.ROLLOUTS ? DATA.ROLLOUTS.find(x=>x.id===(film.rollout||"day")) : null; if(roll) legs+=roll.legs;
  if(film.imax || film.premium) legs+=0.05;
  // v5: review embargo — anticipation helps when critics would have been kind; cover-ups get punished
  if(film.embargoActive) legs += (film.quality.critic>=55? 0.05 : -0.10);
  return clamp(legs, 1.45, 4.4);
}

function breakevenWW(p){ // worldwilde gross needed
  return (p.budget + (p.marketing||recMarketing(p))) / 0.48;
}

/* free every crew member attached to a project (v4: incl. writer & producer) */
function freeProjectTalent(p){
  if(!p) return;
  [p.director, p.writer, p.producer].forEach(t=>{ if(t){ t.bookedUntil=0; t.booked=null; } });
  (p.cast||[]).forEach(c=>{ c.bookedUntil=0; c.booked=null; });
}

/* ═══════════ greenlight ═══════════ */
function devCostOf(idea){
  const base = { indie:2, mid:5, tentpole:12 }[idea.scale];
  return base + (idea.hot? rint(2,6):0);
}
function greenlight(cfg){
  const idea = cfg.idea;
  const S = DATA.SCALES[idea.scale];
  const aiCast = !!cfg.aiCast, aiScript = !!cfg.aiScript;
  if(aiCast) cfg.cast = [];                 // synthetic ensemble replaces the cast
  if(aiScript) cfg.writer = null;           // SynthScribe replaced the writer
  const crew = [cfg.director, cfg.writer, cfg.producer].filter(Boolean);
  let fees = crew.reduce((s,c)=>s+actorFee(c),0) + cfg.cast.reduce((s,c)=>s+actorFee(c),0);
  if(cfg.cameo) fees += Math.round(actorFee(cfg.cameo)*0.3*10)/10;
  // v5: agency packaging fee — stack 2+ clients of one agency and they bill a % of budget
  const packCost = (typeof packagingCost==="function")? packagingCost(cfg.cast, cfg.budget) : 0;
  if(packCost>0){
    fees += packCost;
    const packAg = packagingFeeOf(cfg.cast);
    log("🧾 Packaging fee: "+(packAg.name||"the agency")+" bills "+fmtM(packCost)+" for stacking "+packAg.count+" of their clients on one call sheet.","");
  }
  let dev = devCostOf(idea);
  const polish = !!cfg.scriptPolish;
  if(polish) dev += Math.round(dev*0.4);
  const p = {
    id:nid(), kind:"film", title:idea.title, genre:idea.genre, scale:idea.scale,
    script: idea.script + (polish?6:0), blurb: idea.blurb, hot:idea.hot,
    budget: cfg.budget, budget0: cfg.budget, overrun:0, spent:0, devCost:dev,
    director: cfg.director, writer: cfg.writer||null, producer: cfg.producer||null, cast: cfg.cast, cameo: cfg.cameo||null,
    phase:"pre", phaseWeek:0,
    phaseLen:{ pre:rint(...S.pre)+(polish?1:0), shoot:rint(...S.shoot), post:rint(...S.post) },
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
    pattern: cfg.pattern||"wide", rollout: cfg.rollout||"day", window: cfg.window||45, imax: !!cfg.imax, premium: !!cfg.premium, soundtrack: !!cfg.soundtrack, dayAndDate: !!cfg.dayAndDate,
    writerBonus: 0,
    aiCast, aiScript,
    rebateEarned: 0,
    coProd: cfg.coProd||null,
    mktBoosts: [],
  };
  if(p.writer) p.writerBonus = writerBonus(p.writer, p.genre);
  // v5: AI & synthetic media — cheap, but the guilds notice
  if((aiCast||aiScript) && DATA.AI){ G.aiInUse=(G.aiInUse||0)+1; if(typeof unionAdjust==="function") unionAdjust(DATA.AI.unionKick, "AI production"); }
  // v5: co-production — the partner wires their share through production, takes a slice of net
  if(cfg.coProd && DATA.COPROD_PARTNERS){
    const partner = DATA.COPROD_PARTNERS.find(x=>x.id===cfg.coProd);
    if(partner && partner.pct>0){
      const treaty = !!(cfg.location && DATA.location(cfg.location).treaty && partner.foreign);
      p.coProd = { partner:partner.id, name:partner.name, share:partner.share, pct:partner.pct, treaty };
      earn("cofinance", Math.round(cfg.budget*partner.pct));
      log("🤝 Co-production: "+partner.name+" covers "+Math.round(partner.pct*100)+"% of “"+p.title+"”"+(treaty? " — treaty bonus: rebates +30%, critics warm up":"")+". They keep "+Math.round(partner.share*100)+"% of net.","gold");
      if(treaty){ G.studio.rep=clamp(G.studio.rep+2,5,99); }
    }
  }
  if(cfg.spinoffFr){ p.title = cfg.spinoffFr.name+": "+pick(DATA.SPINOFF_SUFFIX||["Origins","Reckoning"]); p.franchiseName = cfg.spinoffFr.name; p.buzzBonus += 0.10 + 0.18*(cfg.spinoffFr.decay||0.5); }
  if(cfg.sequelOf){ p.title = sequelTitle(cfg.sequelOf.title); p.franchiseName = cfg.sequelOf.franchiseName || cfg.sequelOf.title; }
  if(cfg.crossover){ p.franchiseName = cfg.crossover; }
  spend("development", dev);
  spend("talent", fees);
  if(G.wrapDeal>0) G.wrapDeal--;
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
  if(cfg.writer){ cfg.writer.bookedUntil = G.week+total; cfg.writer.booked = p.title+" (writer)"; }
  if(cfg.producer){ cfg.producer.bookedUntil = G.week+total; cfg.producer.booked = p.title+" (producer)"; }
  cfg.cast.forEach(c=>{ c.bookedUntil=G.week+total; c.booked=p.title; });
  if(cfg.cameo){ cfg.cameo.bookedUntil=Math.max(cfg.cameo.bookedUntil||0, G.week+4); cfg.cameo.booked=p.title+" (cameo)"; }
  G.projects.push(p);
  G.ideas = G.ideas.filter(i=>i.id!==idea.id);
  const planLabel = {theatrical:"theatrical release",streaming:"streaming original",later:"decide distribution later"}[p.plan];
  const loc = DATA.LOCATIONS ? DATA.LOCATIONS.find(l=>l.id===p.location) : null;
  log("🎬 Greenlit: “"+p.title+"” ("+DATA.genreOf(p.genre).name+", "+fmtM(cfg.budget)+" budget, "+p.rating+(p.foreignLang?", foreign-language":"")+", shooting in "+(loc?loc.name:"home lot")+") — "+planLabel,"gold");
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
    if(p.phase==="shoot"){
      burn = p.budget*0.70/Math.max(1,L.shoot) * (G.upgrades.backlot?0.88:1);
      // v4: cost overruns — weather, reshoot days, a star's trailer. Producers contain them.
      const prodSkill = p.producer? p.producer.skill : 45;
      const risk = clamp(0.15 - (prodSkill-45)/300, 0.03, 0.20);
      if(chance(risk)){
        const size = Math.round(p.budget*(0.008+rnd()*0.017)*(p.producer? 0.6:1)*10)/10;
        p.overrun = Math.round(((p.overrun||0)+size)*10)/10;
        p.budget = Math.round((p.budget+size)*10)/10;
        burn += size;
        if(size>=1) log("💸 Overrun on “"+p.title+"”: +"+fmtM(size)+(p.producer? " (your producer capped it)":" — no producer on this one")+".","bad");
        if(!p.producer && typeof unionAdjust==="function") unionAdjust(2,"unmanaged overrun"); // v5: guilds notice chaos
      }
    }
    if(p.phase==="post") burn = p.budget*0.20/Math.max(1,L.post) * (G.upgrades.vfx?0.75:1);
    if(p.phase==="reshoot") burn = p.budget*0.08/Math.max(1,(L.reshoot||3));
    burn = Math.round(burn*10)/10;
    spend("production", burn); p.spent += burn;
    // v5: tax credits v2 — rebates are per-picture CAPPED, treaty co-pros get +30%
    if(p.phase==="shoot"){
      const loc=DATA.location(p.location);
      let reb = burn*loc.rebate;
      if(loc.cap){ reb = Math.min(reb, Math.max(0, loc.cap-(p.rebateEarned||0))); }
      if(reb>0 && p.coProd && p.coProd.treaty) reb*=1.3;
      reb = Math.round(reb*100)/100;
      if(reb>0){ earn("incentives", reb); p.rebateEarned=(p.rebateEarned||0)+reb; }
    }
    // v5: AI & synthetic media — the internet never really calms down
    if((p.aiCast||p.aiScript) && DATA.AI && chance(DATA.AI.backlashWeekly)){
      p.aiBacklash = Math.min(0.15, (p.aiBacklash||0)+0.01);
      log("🤖 Online backlash simmers around “"+p.title+"”'s synthetic "+(p.aiCast?"cast":"script")+" — opening hype bleeding.","bad");
    }
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
  freeProjectTalent(p);
  const f = { id:p.id, title:p.title, genre:p.genre, scale:p.scale, budget:p.budget,
    marketing:0, quality:p.quality, streamingOriginal:true, platform:plat.name,
    releaseWeek:G.week, weekly:[], dom:0, ww:0, studioRev:pay, profit:pay-p.budget-p.devCost,
    inTheaters:false, soldTo:plat.name, awardsEligible:true, year:yearOf(G.week), reviews:[] };
  reviewFilm(f);
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
  let expected = expectedOpening(p, G.week);
  if(p.soundtrack){
    if(chance(0.30)){ p.soundHit=true; expected*=1.10; log("🎵 The single from “"+p.title+"” is CHARTING — +10% buzz!","gold"); }
    else log("🎵 The “"+p.title+"” single stalled. No chart action.","");
  }
  const noise = 0.85 + rnd()*0.34;
  let opening = clamp(expected*noise, 1.2, 320);
  if(G.theaterCap>0) opening *= 0.55;
  const q = p.quality;
  /* v5 global markets: the China import-quota roll happens on release day */
  let chinaDenied = false;
  const chShare0 = DATA.GENRES[p.genre].china||0;
  if(chShare0>0 && DATA.GLOBAL && DATA.GLOBAL.china && !p.presales){
    const CG=DATA.GLOBAL.china;
    let pass = CG.basePass + G.studio.rep*CG.repPerSlot;
    if(p.rating==="R") pass-=CG.rPenalty;
    if(p.genre==="horror") pass-=CG.horrorPenalty;
    if(p.genre==="animation"||p.genre==="fantasy") pass+=CG.kidFriendly;
    if(p.censorCut) pass-=0.15;
    if(!chance(clamp(pass,0.05,0.95))){
      chinaDenied = true;
      log("🇨🇳 "+CG.quotaName+": “"+p.title+"” missed its import slot — no China release. (−"+Math.round(chShare0*100)+"pts of WW share)","bad");
    }else{
      log("🇨🇳 “"+p.title+"” won a China quota slot — full intl rollout cleared.","good");
    }
  }
  const film = {
    id:p.id, title:p.title, genre:p.genre, scale:p.scale,
    budget:p.budget, marketing:p.marketing, devCost:p.devCost,
    director:p.director, writer:p.writer||null, producer:p.producer||null, cast:p.cast, cameo:p.cameo||null, quality:q,
    overrun:p.overrun||0, coFinance:p.coFinance||0, reviews:[],
    aiCast:!!p.aiCast, aiScript:!!p.aiScript, aiBacklash:p.aiBacklash||0,
    rebateEarned:p.rebateEarned||0, coProd:p.coProd||null,
    mktBoosts:p.mktBoosts||[], embargoActive:(p.mktBoosts||[]).includes("embargo"),
    chinaDenied,
    rating:p.rating, premium:!!p.premium, imax:!!p.imax, location:p.location, foreignLang:!!p.foreignLang,
    pattern:p.pattern||"wide", rollout:p.rollout||"day", window:p.window||45, windowDays:p.window||45,
    dayAndDate:!!p.dayAndDate, onOwn:!!p.dayAndDate, onOwnPlatform:!!p.dayAndDate,
    releaseWeek:G.week, opening, weekly:[{w:G.week, gross:opening}],
    dom:opening, ww:0, studioRev:0, legs:0, decay:0, rentalsDom:opening*0.53,
    presales:p.presales||0, backend:p.backend||0,
    inTheaters:true, weeksOut:1, franchiseable:false, soldTo:null,
    piracyPenalty:0, awardsEligible:true, year:yearOf(G.week),
    franchiseName:p.franchiseName||null, sequelOf:p.sequelOf,
    franchiseableChecked:false, censorChecked:false,
  };
  if(typeof reviewFilm==="function") reviewFilm(film);
  G.films.push(film);
  G.projects = G.projects.filter(x=>x!==p);
  freeProjectTalent(p);
  G.stats.films++;
  if(film.reviews && film.reviews.length){
    const top=film.reviews[0];
    log("🗞 "+top.outlet+" ("+top.name+"): "+top.score+"/100 — “"+top.quote+"” · consensus "+film.criticAvg+" ("+film.freshPct+"% positive).", film.criticAvg>=65?"good":film.criticAvg<45?"bad":"");
  }
  const fr0 = film.franchiseName && G.franchises.find(x=>x.name===film.franchiseName);
  if(fr0) fr0.decay = 1;
  if(opening>G.stats.bestOpen){ G.stats.bestOpen=opening; G.stats.bestFilm=film.title; }
  earn("theatrical", opening*0.53);
  if(typeof sfx==="function") sfx("fanfare");
  const label = opening>=100? "💥 MASSIVE opening": opening>=40? "🔥 Strong opening": opening>=12? "▶ Solid opening":"🎪 Limited release";
  log(label+": “"+film.title+"” opens to "+fmtG(opening)+" domestic (+"+fmtM(opening*0.53)+" rentals this week).","gold");
  if(opening>=60) p.cast.forEach(c=>{ c.heat=Math.min(3,(c.heat||0)+1); });
  const win = (typeof DATA.window==="function")? DATA.window(film.window||"45") : null;
  if(win && win.exh){ G.exhibitor = clamp((G.exhibitor||50) + win.exh, 0, 100); }
  const win2 = DATA.WINDOWS ? DATA.WINDOWS.find(w=>w.d===(film.windowDays||45)) : null;
  if(win2 && win2.rel){ G.exhibRel = clamp((G.exhibRel||70) + win2.rel, 10, 95); }
  /* v5: windowing policy feeds (or starves) the piracy economy */
  if(typeof piracyAdjust==="function" && DATA.PIRACY){
    const wid = (typeof DATA.window==="function")? DATA.window(film.window||"45").id : String(film.windowDays||45);
    if(wid==="90") piracyAdjust(DATA.PIRACY.window90, "90-day window");
    else if(wid==="17") piracyAdjust(DATA.PIRACY.window17, "17-day window");
    if(film.dayAndDate) piracyAdjust(DATA.PIRACY.dayAndDate, "day-and-date release");
  }
  return film;
}

function tickTheatrical(){
  for(const f of G.films){
    if(!f.inTheaters) continue;
    if(f.legs===0){ f.legs=legsOf(f); f.decay = 1-1/f.legs; }
    let gross = f.opening * Math.pow(f.decay, f.weeksOut);
    if(G.theaterCap>0) gross*=0.55;
    if(G.piracy && DATA.PIRACY) gross *= 1 - clamp(G.piracy/100,0,1)*DATA.PIRACY.maxGrossDamage;  // v5: piracy meter bleeds live runs
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
  // v5: the censor board also sharpens scissors for R-ratings, horror and dark thrillers
  if(!f.censorChecked && !f.presales && !f.chinaDenied){
    const ch = DATA.GENRES[f.genre].china||0;
    let cutP = ch>=0.14? 0.35 : 0;
    if(f.rating==="R") cutP += 0.12;
    if((f.genre==="horror"||f.genre==="thriller") && ch>0) cutP += 0.15;
    if(cutP>0 && chance(clamp(cutP,0,0.6)) && ch>0.04){
      f.censorCut=true;
      log("🇨🇳 The censor board trimmed “"+f.title+"” for China — intl share −8pts.","bad");
    }
  }
  if((f.genre==="horror" || f.rating==="R") && !f.presales && chance(0.2)){
    f.strictMarketsBan=true;
    log("🚫 Strict-market censors clipped “"+f.title+"” — midnight slots only overseas (−3pts intl share).","bad");
  }
  f.censorChecked=true;
  let share = DATA.GENRES[f.genre].intlShare;
  if(typeof intlShareOf==="function") share = intlShareOf(f);
  else if(f.censorCut) share = Math.max(0, share-0.08);
  const intlGross = f.dom/(1-share) - f.dom;
  f.ww = f.dom + intlGross;
  let intlRentals = 0;
  if(!f.presales){
    intlRentals = intlGross*0.42;
    const roll = DATA.ROLLOUTS ? DATA.ROLLOUTS.find(x=>x.id===(f.rollout||"day")) : null;
    if(roll && roll.intl!==1) intlRentals*=roll.intl;
    earn("theatrical", intlRentals);
  }
  const win = (typeof DATA.window==="function")? DATA.window(f.window||"45") : null;
  const win2 = DATA.WINDOWS ? DATA.WINDOWS.find(w=>w.d===(f.windowDays||45)) : null;
  const pvodMult = win? win.pvod : (win2? win2.pvod : 1);
  const pvod = Math.round(f.ww*0.055*clamp(f.quality.overall/70,0.7,1.4)*pvodMult);
  f.pvod = pvod; earn("pvod", pvod);
  f.pay1At = G.week+6;
  if(!f.streamingOriginal && !f.onOwn && !f.onOwnPlatform){ f.pay1Rate=0.06; }
  if(f.dayAndDate && G.streamer){ G.streamer.subs = Math.round((G.streamer.subs + 0.2 + (f.quality.overall/100))*100)/100; }
  let backendPay = 0;
  if(f.backend){ backendPay = (f.rentalsDom + intlRentals)*f.backend; spend("talent", backendPay); }
  f.backendPaid = backendPay;
  f.studioRev = f.rentalsDom + intlRentals + pvod - backendPay;
  f.profit = f.studioRev + (f.presales||0) - f.budget - (f.marketing||0) - (f.devCost||0);
  if(f.coFinance && f.profit>0){
    const shareCo = Math.round(f.profit*(f.coFinance||0.3)*10)/10;
    spend("financing", shareCo); f.partnerShare=shareCo; f.profit-=shareCo;
    log("🤝 Co-financing partner takes "+fmtM(shareCo)+" of “"+f.title+"”'s net.","");
  }
  // v5: co-production partner's slice of the upside
  if(f.coProd && f.profit>0){
    const cutPct = f.coProd.share||0.45;
    const shareP = Math.round(f.profit*cutPct*10)/10;
    spend("financing", shareP); f.coProdShare=shareP; f.profit-=shareP;
    log("🤝 Co-production partner "+f.coProd.name+" takes "+fmtM(shareP)+" ("+Math.round(cutPct*100)+"%) of “"+f.title+"”'s net.","");
  }
  if(f.soundHit){ const roy=Math.max(1,Math.round(f.ww*0.02)); earn("music", roy); f.profit+=roy; }
  G.stats.totalWW += f.ww; G.stats.totalProfit += f.profit;
  const be = breakevenWW(f);
  const verdict = f.ww>=be*1.6? "SMASH HIT": f.ww>=be? "HIT": f.ww>=be*0.75? "disappointment": "FLOP";
  if(verdict==="SMASH HIT"){ if(typeof sfx==="function") sfx("smash"); G.confetti=true; }
  else if(verdict==="FLOP") if(typeof sfx==="function") sfx("buzz");
  if(f.ww>=be) G.stats.hits++; else G.stats.flops++;
  const dRep = f.ww>=be*1.6? 6: f.ww>=be? 3: f.ww>=be*0.75? -2: -4;
  G.studio.rep = clamp(G.studio.rep + dRep*(G.studio.flopPenalty||1), 5, 99);
  // v5: spin-off quality — a cheap spin-off that flops drags the parent brand down with it
  if(f.franchiseName){
    const frParent = G.franchises.find(x=>x.name===f.franchiseName);
    if(frParent){
      if(f.ww < be*0.55){
        frParent.decay = Math.max(0.2, frParent.decay-0.15);
        frParent.fatigue = clamp((frParent.fatigue||0)+(DATA.FATIGUE.perEntry*0.7), 0, 0.95);
        log("💔 “"+f.title+"” flopped hard enough to scar the "+frParent.name+" brand — heat down, fatigue up.","bad");
      }else if(f.ww>=be){
        frParent.decay = Math.min(1, frParent.decay+0.12);
      }
    }
  }
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
  let value = (f.budget*0.5 + f.ww*0.06) * g.otta * chosen.p.generosity * qualityFactorOTT(f) * (G.infl||1)
            * (0.85 + trendOf(f.genre)*0.15/1);
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
  const value = Math.round(p.budget*margin*chosen.x.generosity*(G.streamWar>0?1.25:1)*(G.infl||1)*clamp(trendOf(p.genre),0.85,1.2));
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
    value:Math.max(3, Math.round(p.budget*(0.85+q/160)*g.otta*s*hype*(0.95+rnd()*0.22)*(G.streamWar>0?1.3:1)*(G.upgrades.ottrel?1.12:1)*(G.infl||1)*clamp(trendOf(p.genre),0.85,1.2)))
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
    inTheaters:false, awardsEligible:true, year:yearOf(G.week), reviews:[] };
  reviewFilm(f);
  G.films.push(f);
  G.projects=G.projects.filter(x=>x!==p);
  G.stats.films++; G.stats.totalProfit+=f.profit;
  freeProjectTalent(p);
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
  const plat = DATA.platform(cfg.platformId);
  const budget = cfg.eps*cfg.perEp;
  const concept = clamp(rint(50,80)+G.studio.devBonus*2, 40, 95);
  const taste = plat.taste[cfg.genre]||1;
  const p = 0.22 + concept/160 + (taste-1)*0.6 + G.studio.rep/400 + (cfg.perEp>=8?0.06:0) + (G.upgrades.ottrel?0.05:0) + (cfg.oddsBonus||0);
  const s = {
    id:nid(), kind:"series", title:cfg.titleOverride||seriesTitle(), genre:cfg.genre, platform:cfg.platformId,
    spinFr: cfg.spinFr||null,
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
  const gname = (DATA.genreOf? DATA.genreOf(cfg.genre).name : cfg.genre);
  log("🚫 "+plat.name+" passed on your "+gname+" pitch. Back to the whiteboard.","bad");
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
  // v5: spin-off quality — a TV spin-off that tanks drags the parent brand down
  if(s.spinFr && season.viewership<40){
    const fr=frById(s.spinFr);
    if(fr){ fr.decay=Math.max(0.2, fr.decay-0.15); fr.fatigue=clamp((fr.fatigue||0)+0.08, 0, 0.95);
      log("💔 The “"+s.title+"” spin-off bombed — the "+fr.name+" brand takes the hit too.","bad"); }
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
      const weight = S.openBase*DATA.GENRES[genre].mass*(G.infl||1)*trendPull(genre);
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
        let opening = f.weight * (0.8+rnd()*0.45) * DATA.seasonOf(woyOf(G.week)).season * trendPull(f.genre);
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
  if(G.maLibraries) v += G.maLibraries * (DATA.MA? DATA.MA.library.catalogEach : 42);  // v5 M&A libraries
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
  let overhead = st.overhead;
  if(typeof weeklyOverhead==="function") overhead = weeklyOverhead();
  else overhead = st.overhead + G.projects.length*0.12 + (G.series.filter(s=>s.phase==="shoot").length*0.15);
  spend("overhead", overhead);
  let rate = 0.0018;
  if(typeof interestRate==="function") rate = interestRate();
  else rate = 0.0018*(G.execs&& (G.execs.cfo || G.execs.cfo)?0.70:1);
  if(st.debt>0){ const int=Math.round(st.debt*rate*10)/10; spend("interest", int); st.debt+=int; }
  if(st.mezzDebt>0){ const mz=Math.round(st.mezzDebt*0.005*10)/10; spend("interest", mz); st.mezzDebt+=mz; }
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
  G.public = { raise:400, ipoWeek:G.week, strikes:0,
               price: DATA.MARKET.ipoPrice, shares: DATA.MARKET.shares,
               history:[DATA.MARKET.ipoPrice], downgrades:0, quarterNet:0, lastCall:G.week,
               rating:"Hold", secondaries:0 };
  G.studio.cash += 400;
  G.weekTx.financing=(G.weekTx.financing||0)+400;
  G.studio.rep = clamp(G.studio.rep+8,5,99);
  log("📊 IPO priced at $"+DATA.MARKET.ipoPrice.toFixed(2)+" — you raised $400M ("+DATA.MARKET.shares+"M shares). Wall Street is watching every quarter now.","gold");
  unlockAchv("ipo","Ticker Symbol","Take your studio public.");
  saveGame();
  return true;
}
function marketCap(){ return G.public? Math.round(G.public.price*G.public.shares) : 0; }
/* Weekly: the share price drifts with the P&L, reputation and franchise equity. */
function tickPublic(){
  if(!G.public) return;
  const P=G.public, M=DATA.MARKET;
  const net = weekNet(G.weekTx||{});
  P.quarterNet = Math.round(((P.quarterNet||0)+net)*10)/10;
  if(net < 0){ P.strikes=(P.strikes||0)+1; }
  else if(P.strikes>0){ P.strikes=Math.max(0,P.strikes-0.5); }
  if(P.strikes>=4){
    G.studio.rep = clamp(G.studio.rep-3,5,99);
    log("📉 Shareholders punish a weak quarter — rep −3. Fix the P&L.","bad");
    P.strikes=0;
  }
  // price walk: sentiment (weekly P&L, reputation) plus a slow pull toward book value
  const book = Math.max(1, (catalogValue() + G.studio.cash - G.studio.debt + (G.streamer? G.streamer.subs*18:0)) / Math.max(1,P.shares));
  let move = net*M.driftPerNetM
           + (G.studio.rep-50)*M.repInfluence
           + (book - P.price)*0.02
           - (G.studio.debt/1600)
           + gauss()*0.16;
  P.price = Math.max(0.6, Math.round((P.price + move)*100)/100);
  P.history = P.history||[];
  P.history.push(P.price);
  if(P.history.length>120) P.history.shift();
  if(P.price >= M.ipoPrice*3) unlockAchv("stock3x","Triple Bagger","Triple your share price after the IPO.");
  if(P.price <= M.ipoPrice*0.35 && !P.delistWarned){
    P.delistWarned = true;
    log("🚨 The stock has lost two thirds of its IPO value. The board is asking uncomfortable questions.","bad");
  }
  // quarterly earnings call
  const woy = woyOf(G.week);
  if(M.callWeeks.includes(woy) && P.lastCall !== G.week){
    P.lastCall = G.week;
    earningsCall();
  }
}
/* Quarterly earnings call: beat or miss, then the analysts react. */
function earningsCall(){
  const P=G.public;
  const q = Math.round((P.quarterNet||0)*10)/10;
  P.quarterNet = 0;
  const expectation = Math.round((8 + G.studio.rep/6 + (G.streamer? G.streamer.subs*0.8:0))*10)/10;
  const beat = q >= expectation;
  const gap = q - expectation;
  const analyst = pick(DATA.MARKET.analysts);
  let move = clamp(gap*0.08, -6, 8);
  if(beat){
    P.rating = q > expectation*2 ? "Strong Buy" : "Buy";
    P.downgrades = Math.max(0, (P.downgrades||0)-1);
    G.studio.rep = clamp(G.studio.rep+1,5,99);
  }else{
    P.rating = gap < -expectation ? "Sell" : "Hold";
    P.downgrades = (P.downgrades||0)+1;
    if(P.downgrades>=2){ G.studio.rep = clamp(G.studio.rep-2,5,99); move -= 1.2; }
  }
  P.price = Math.max(0.6, Math.round((P.price+move)*100)/100);
  P.lastEarnings = { week:G.week, q, expectation, beat, analyst, rating:P.rating, move:Math.round(move*100)/100 };
  G.pendingEarnings = P.lastEarnings;
  sfx(beat? "chime":"buzz");
  log((beat?"📈":"📉")+" Earnings call: quarter net "+fmtM(q)+" vs street "+fmtM(expectation)+" — "+
      analyst+" moves to "+P.rating+". Shares "+(move>=0?"+":"")+"$"+move.toFixed(2)+" → $"+P.price.toFixed(2)+".", beat?"good":"bad");
}
/* Sell new shares into a strong market (dilutes, but it's free money at a high price). */
function secondaryOffering(shares){
  if(!G.public) return false;
  shares = Math.max(1, Math.round(shares||2));
  const P=G.public;
  const discount = 0.93;                    // priced below market
  const raise = Math.round(P.price*shares*discount);
  if(raise<=0) return false;
  P.shares += shares;
  P.secondaries = (P.secondaries||0)+1;
  P.price = Math.max(0.6, Math.round((P.price*(1-0.02*shares/Math.max(1,P.shares))*100 - 15)/100*100)/100);
  G.studio.cash += raise;
  G.weekTx.financing=(G.weekTx.financing||0)+raise;
  log("🏛 Secondary offering: "+shares+"M new shares raised "+fmtM(raise)+" (dilution — price eased to $"+P.price.toFixed(2)+").","gold");
  saveGame();
  return true;
}

/* ═══════════ achievements — v5 UNIFIED: single store in G.ach, descriptors in DATA.ACH ═══════════ */
function achMeta(id){
  const a = (DATA.ACH||[]).find(x=>x.id===id);
  return a? {icon:a.icon, title:a.name, desc:a.desc} : {icon:"🏅", title:id, desc:""};
}
function unlockAchv(id, title, desc){
  if(!G) return;
  G.ach = G.ach||{};
  if(G.ach[id]) return;
  G.ach[id] = G.week;
  const meta = achMeta(id);
  if(title || desc){ meta.title = title||meta.title; meta.desc = desc||meta.desc; }
  G.achv = G.achv||[];
  G.achv.push({id, title:meta.title, desc:meta.desc, week:G.week});
  if(G.achv.length>60) G.achv.shift();
  log("🏅 Achievement unlocked: "+meta.title+" — "+meta.desc,"gold");
}
function achCount(){ return Object.keys(G.ach||{}).length; }
function achTotal(){ return (DATA.ACH||[]).length; }

/* v5: milestones are all covered by the unified DATA.ACH loop (tickAchievements) */
function checkAchievements(){ /* kept for call-order compatibility; DATA.ACH handles these now */ }

/* ═══════════ your own streamer (v3) ═══════════ */
function canLaunchStreamer(){ return !G.streamer && G.studio.rep>=40 && G.studio.cash>=250; }
function launchStreamer(name){
  if(G.streamer){ if(name){ G.streamer.name=name.slice(0,24); log("📱 Platform rebranded as “"+G.streamer.name+"”.",""); saveGame(); return true; } return false; }
  if(G.studio.rep < 40) return false;
  if(G.studio.cash < 250) return false;
  spend("studio", 250);
  const tier = "premium";
  G.streamer = {
    name: (name|| (G.studio.name+"+")).slice(0,24),
    launchedWeek: G.week,
    subs: 2.5,
    peak: 2.5,
    sportsPower: 0,
    churn: 0.008,
    income: 0,
    totalRev: 0,
    lastContent: G.week,
    tier: tier,
    crackdown: 0,
    adRevenue: 0
  };
  log("📱 You launched "+G.streamer.name+" — $250M, "+G.streamer.subs+"M subs, $0.5/sub/wk. Build content (films, franchises, shows, sports) to raise your ceiling.","gold");
  if(typeof unlockAchv==="function") unlockAchv("launch", "Streamer Barons", "Launch your own streaming platform.");
  saveGame();
  return true;
}

/* v4: ad tier vs premium tier */
function setStreamerTier(id){
  if(!G.streamer) return false;
  const t=DATA.tier(id);
  if(!t || G.streamer.tier===t.id) return false;
  if(t.cost>0){
    if(G.studio.cash < t.cost) return false;
    spend("studio", t.cost);
  }
  G.streamer.tier=t.id;
  G.streamer.churn=t.churn;
  log("📱 "+G.streamer.name+" switches to “"+t.name+"”: $"+t.arpu.toFixed(2)+"/sub/wk, ceiling ×"+t.ceil.toFixed(2)+".","gold");
  saveGame();
  return true;
}
function streamerCeiling(){
  if(!G.streamer) return 0;
  const s=G.streamer;
  const tier = (typeof DATA.tier==="function")? DATA.tier(s.tier||"premium") : {ceil:1, arpu:0.5, churn:0.008};
  // v4 + v3 combined ceiling
  const lib = G.films.length;
  const frw = G.franchises.reduce((a,f)=>a+f.tier,0);
  const showBuzz = G.series.reduce((a,ser)=>a+(ser.seasons && ser.seasons.length? ser.seasons.reduce((x,y)=>x+(y.viewership||0),0)/10:0),0);
  const sport = s.sportsPower||0;
  const catalog = (typeof catalogValue==="function")? catalogValue() : 0;
  let base = (3 + lib*1.1 + frw*2.2 + showBuzz + sport*1.5) * (tier.ceil||1);
  // add v3 components
  base += catalog/45 + G.franchises.length*0.5 + G.series.filter(x=>x.status!=="ended").length*0.3 + G.films.filter(f=>f.onOwnPlatform||f.onOwn).length*0.2;
  const ceil = Math.min(Math.round(60*(tier.ceil||1)), Math.round(base));
  return clamp(ceil, 4, 80);
}

function tickStreamer(){
  if(!G.streamer) return;
  const st=G.streamer;
  const tier = (typeof DATA.tier==="function")? DATA.tier(st.tier||"premium") : {ceil:1, arpu:0.5, churn:0.008};
  // decay sports power
  if(st.sportsPower>0) st.sportsPower = Math.max(0, st.sportsPower - st.sportsPower*0.015 - 0.02);
  st.sportsPower = Math.max(0, (st.sportsPower||0)*0.985);
  const ce=streamerCeiling();
  let churn = tier.churn||0.008;
  if(st.crackdown>0){ churn *= 2; st.crackdown--; if(st.crackdown===0) log("🔐 Crackdown churn has settled down.",""); }
  st.churn = churn;
  const starved = G.week-(st.lastContent||0) > 6;
  let growth = (ce - st.subs)*0.05 - st.subs*churn;
  if(st.euFreeze>0){ growth = Math.min(growth, 0); st.euFreeze--; }   // v5: EU quota freezes growth
  if(starved) growth -= st.subs*0.008;
  st.subs = clamp(st.subs + growth, 0.1, Math.ceil(ce*1.05));
  st.subs = Math.round(st.subs*100)/100;
  st.peak = Math.max(st.peak||0, st.subs);
  const income = st.subs*(tier.arpu||0.5);
  st.income = Math.round(income*10)/10;
  st.totalRev = (st.totalRev||0) + st.income;
  if(income>=0.05) earn("streamer", income);
  st.lastContent = st.lastContent||G.week;
  if(st.subs>=25 && typeof unlockAchv==="function") unlockAchv("subs25", "The Empire Hits 25M", "Reach 25M subscribers on your platform.");
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
  addFatigue(fr);   // v4: every entry burns a little audience goodwill
  G.studio.rep = clamp(G.studio.rep+1, 5, 99);
}
function frById(id){ return G.franchises.find(x=>x.id===id); }
function merchCost(fr){ return [30+fr.tier*15, 80+fr.tier*20, 160+fr.tier*30][fr.merch] || 0; }
function parkCost(fr){ return [180+fr.tier*50, 350, 520][fr.park] || 0; }
function frWeeklyIncome(fr){
  const g=DATA.GENRES[fr.genre]||{merch:1};
  const M=DATA.MERCH_V2||{};
  const mo = DATA.seasonOf(((G.week-1)%52)+1).month;
  // v5: toy lines compound the merch program; holiday shelves spike it
  const merchBoost = (M.holidayMonths||[]).includes(mo)? (M.holidayMult||1.6) : 1;
  const parkBoost  = (M.parkSummer||[]).includes(mo)?  (M.parkSummerMult||1.25) : 1;
  const toy = fr.toys? (M.toyMult||1.3) : 1;
  // v5 licensing-out: while a rival controls the film rights, your shelf income sags
  const licDrag = (G.licensedOut||[]).some(L=>L.name===fr.name)? 0.9 : 1;
  return ( fr.merch? fr.merch*(0.9+fr.tier*0.55)*g.merch*fr.decay*toy*merchBoost*licDrag : 0 )
       + ( fr.park ? fr.park*(2.5+fr.tier*1.2)*fr.decay*parkBoost : 0 );
}
/* v5: toy-line licensing deal — one-off fee, permanent merch multiplier */
function signToyLine(id){
  const fr=frById(id); if(!fr || fr.toys || fr.merch<1) return;
  const c=(DATA.MERCH_V2? DATA.MERCH_V2.toyCost(fr.tier) : 45);
  if(G.studio.cash<c){ log("💸 Toy-line deal costs "+fmtM(c)+".","bad"); return; }
  spend("empire", c); fr.toys=true;
  G.studio.rep=clamp(G.studio.rep+1,5,99);
  log("🧸 “"+fr.name+"” toy line signed — action figures on shelves by the holidays (merch income ×1.3 forever).","gold");
  saveGame();
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
  const fr=frById(id); if(!fr || fr.park>=3 || fr.tier<2) return;
  const c=parkCost(fr); if(G.studio.cash<c) return;
  spend("studio", c); fr.park++;
  G.studio.rep=clamp(G.studio.rep+3,5,99);
  const lvl=["","theme-park attraction built","second gate expansion opened","full resort district opened"][fr.park]||"expanded";
  log("🎡 “"+fr.name+"”: "+lvl+" (−"+fmtM(c)+"). A landmark for the studio.","gold");
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
    const prestige=(f.quality.critic + (f.campaign||0))*(0.6+g.awards*0.5);
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
      // v5: the Oscar bump — a post-win re-release gross worth ~25% of the P&A you spent
      const bump0 = DATA.OSCAR_BUMP? DATA.OSCAR_BUMP*(f.marketing||0)*0.6 : 0;
      const bump = Math.round((15 + bump0)*10)/10;
      if(bump>15){ f.dom+=bump; f.ww+=Math.round(bump*1.35); f.studioRev+=bump; earn("theatrical", bump*0.53); }
      f.oscarBumped=true;
      G.studio.rep=clamp(G.studio.rep+7,5,99);
      G.stats.awards.push({year:yr, cat:"Best Picture", film:f.title});
      sfx("drums"); G.confetti=true;
      log("🏆 BEST PICTURE: “"+f.title+"”! +7 reputation"+(bump>0? ", and the Oscar-bump re-release grosses "+fmtG(bump):"")+".","gold");
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
        const nudge = DATA.ACTING_BUMP? Math.round(DATA.ACTING_BUMP*(n.f.marketing||0)*0.6*10)/10 : 0;
        if(nudge>1){ n.f.dom+=nudge; n.f.ww+=nudge; earn("theatrical", nudge*0.53); n.f.studioRev+=nudge; }
        log("🏆 "+cat+": “"+n.f.title+"” takes it home. +3 reputation"+(nudge>1?", +"+fmtG(nudge)+" victory-lap gross":"")+".","gold");
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
  // v5: wage inflation — talent quotes compound harder than the market (3%/yr), overhead creeps 2%/yr
  G.wageInfl = Math.round((G.wageInfl||1) * (1+(DATA.WAGE_INFLATION||0.03)) * 1000)/1000;
  G.studio.overhead = Math.round(G.studio.overhead*1.02*100)/100;
  log("💼 Cost of doing business: talent quotes +3% (wage inflation), lot overhead up 2%.","");
  // yearly new talent class: fresh faces join the market
  G.lastClass = yr;
  ageTalent();   // v4: everyone gets a year older — primes peak, veterans retire
  G.talent.push(genActor(chance(0.2)), genActor(false), genActor(false));
  G.talent.push(genDirector(false));
  G.talent.push(genWriter(chance(0.25)));
  G.talent.push(genProducer(false));
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
  G.sfx=G.sfx||[];
  G.weekTx={};
  tickFinance();
  if(typeof tickTrends==="function") tickTrends();
  if(typeof tickCareers==="function") tickCareers();
  if(typeof tickFatigue==="function") tickFatigue();
  if(typeof tickPublic==="function") tickPublic();
  if(typeof tickProjects==="function") tickProjects();
  for(const p of [...G.projects]){
    if(p.phase==="ready" && !p.prebuyAccepted && p.releaseWeek && p.releaseWeek<=G.week){
      const rest = Math.max(0, p.marketing - (p.marketingPaid||0));
      if(p.imax) spend("marketing", Math.round(rest*0.08));
      spend("marketing", rest);
      p.marketingPaid=(p.marketingPaid||0)+rest;
      releaseFilm(p);
    }
  }
  if(typeof tickTheatrical==="function") tickTheatrical();
  if(typeof tickSeries==="function") tickSeries();
  if(typeof tickRivals==="function") tickRivals();
  if(typeof tickEmpire==="function") tickEmpire();
  if(typeof tickStreamer==="function") tickStreamer();
  if(typeof tickSportsAuctions==="function") tickSportsAuctions();
  if(typeof tickPay1==="function") tickPay1();
  if(typeof maybePay1==="function") maybePay1();
  if(typeof maybeOttOffers==="function") maybeOttOffers();
  G.offers=G.offers.filter(o=>o.expires>=G.week || o.type==="renewal");
  if(typeof refreshIdeas==="function") refreshIdeas();
  if(typeof refreshIpMarket==="function") refreshIpMarket();
  if(chance(.18)) G.talent.push(chance(.6)?genActor(chance(.2)):genDirector(chance(.2)));
  G.talent=G.talent.filter(t=>!t.bookedUntil||t.bookedUntil>=G.week-30).slice(-52);
  if(typeof tickPoaching==="function") tickPoaching();
  if(typeof tickFestivals==="function") tickFestivals();
  if(typeof tickEvents==="function") tickEvents();
  if(typeof tickAchievements==="function") tickAchievements();
  if(typeof checkAchievements==="function") checkAchievements();
  if(typeof tickLicensedOut==="function") tickLicensedOut();
  if(typeof tickPiracy==="function") tickPiracy();
  if(typeof tickUnion==="function") tickUnion();
  if(typeof tickPrecursors==="function") tickPrecursors();
  if(typeof tickMa==="function") tickMa();
  if(typeof tickMaSlateRentals==="function") tickMaSlateRentals();
  if(G.pendingDeepfake && G.week - (G.pendingDeepfake.week||G.week) >= 2){
    log("🧬 The deepfake deadline passed — the internet convened its own jury.","bad");
    if(typeof resolveDeepfake==="function") resolveDeepfake(chance(0.35));
  }
  if(G.pendingSports && G.pendingSports.expires && G.week>G.pendingSports.expires){
    log("🏟 The sports rights auction closed without you — the package went elsewhere.","");
    G.pendingSports=null;
  }
  if(G.streamWar>0)G.streamWar--;
  if(G.theaterCap>0)G.theaterCap--;
  if(G.exhibRel!==undefined) G.exhibRel = clamp(G.exhibRel + (60-G.exhibRel)*0.02, 10, 95);
  if(G.exhibitor!==undefined) G.exhibitor = clamp(G.exhibitor + (50-G.exhibitor)*0.02, 0, 100);
  if(woyOf(G.week)===1 && G.week>1) yearWrap();
  const snap={ week:G.week, cats:{...G.weekTx}, net:weekNet(G.weekTx) };
  G.txHistory.push(snap);
  if(G.txHistory.length>12) G.txHistory.shift();
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
  if(typeof ageTalent==="function" && woyOf(G.week)===1) ageTalent();
  saveGame();
  return G.flash;
}

function advanceWeeks(n){
  for(let i=0;i<n;i++){
    if(G.over||G.pendingChoice||G.pendingReport||G.pendingAuction||
       (G.pendingSports && G.pendingSports.expires>G.week)) break;
    advanceWeek();
  }
}


/* ═══════════ misc getters for UI ═══════════ */
function activeFilms(){ return G.films.filter(f=>f.inTheaters); }
function readyProjects(){ return G.projects.filter(p=>p.phase==="ready"); }
function inProdProjects(){ return G.projects.filter(p=>["pre","shoot","post","reshoot"].includes(p.phase)); }
function seasonDateLabel(w){ const s=DATA.seasonOf(woyOf(w)); return s.month+" Y"+yearOf(w); }

/* === v2/v3 additions === */

/* removed: legacy sealed-bid pack flow superseded by tickSportsAuctions (v3)+v5 line-up */

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

function buildResort(id){
  const fr=frById(id); if(!fr || fr.resort || fr.park<1) return;
  if(G.studio.cash<400){ log("💸 Resorts & cruises cost $400M.","bad"); return; }
  spend("studio", 400); fr.resort=true;
  G.studio.rep=clamp(G.studio.rep+5,5,99);
  log("🏝 “"+fr.name+"” resorts & cruise line opened (−$400M). Vacationers now live inside your IP.","gold");
  saveGame();
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

function canLaunchStreamer(){ return !G.streamer && G.studio.rep>=40 && G.studio.cash>=250; }

function canReboot(f){
  return !f.streamingOriginal && G.week-(f.releaseWeek||0)>=312 && !f.rebooted;
}

function canRerelease(f){
  return !f.streamingOriginal && (f.ww||0)>=120 && !f.inTheaters
    && G.week-(f.releaseWeek||0)>=104 && G.week-(f.rereleasedAt||0)>=104;
}

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

function consumeOutput(){
  if(G.outputDeal>0){ G.outputDeal--; log("📜 Output deal applied (+20%). "+G.outputDeal+" sale(s) left on the deal.",""); }
}

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

function doIPO(){
  if(G.ipo || G.studio.rep<60) return false;
  G.ipo=true; G.ipoYear=yearOf(G.week); earn("financing", 400);
  log("🔔 IPO! "+G.studio.name+" raises $400M on the public market. Shareholders expect results every quarter now.","gold");
  saveGame(); return true;
}

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


function festivalFilms(){
  const yr=yearOf(G.week);
  return G.films.filter(f=>f.year===yr && f.quality && f.quality.critic>=58 && !(f.submittedFest))
    .concat(G.projects.filter(p=>p.phase==="ready" && p.quality && p.quality.critic>=58 && !p.submittedFest));
}

function fmtSubs(v){ // subscribers in millions
  if(v>=1) return v.toFixed(1)+"M";
  return Math.round(v*1000)+"K";
}

function frHeatMult(p){
  if(!p.franchiseName) return 1;
  const fr=G.franchises.find(x=>x.name===p.franchiseName);
  if(!fr) return 1;
  return 0.82 + 0.36*fr.decay;   // v3: cold franchises open weak, hot ones soar
}

function franchiseTvSpinoff(fid){
  const fr=frById(fid); if(!fr || fr.tier<2) return;
  const res=pitchSeries({ genre: DATA.GENRES[fr.genre]? fr.genre:"action", eps:8, perEp:6,
    platformId:pick(DATA.allPlatforms()).id, showrunner:null, cast:[],
    titleOverride:fr.name+": The Series", oddsBonus:0.3 });
  if(res.ok) log("📺 The "+fr.name+" TV spin-off found a home.","gold");
  saveGame();
}

function fycFilm(fid, amt){
  const f=G.films.find(x=>x.id===fid);
  if(!f) return false;
  if(woyOf(G.week)<44){ log("🗳 FYC campaigning runs weeks 48–52 (season heats from W44).",""); return false; }
  amt = clamp(Math.round(amt||4), 2, 20);
  if(G.studio.cash<amt){ log("💸 FYC ads cost "+fmtM(amt)+".","bad"); return false; }
  spend("marketing", amt);
  // v5: campaign budget slider — every extra dollar buys momentum, with diminishing returns on repeat pushes
  const fresh = Math.round(amt*1.1*(f.fyc? 0.6 : 1));
  f.campaign = (f.campaign||0)+fresh;
  f.fyc=true;
  log("🗳 FYC campaign on “"+f.title+"” upgraded by "+fmtM(amt)+" — awards momentum +"+fresh+".","good");
  saveGame(); return true;
}

function genIpItem(){
  const k=pick(DATA.IPKINDS);
  const genre=pick(Object.keys(DATA.GENRES));
  const price=rint(3,40);
  const title = k.id==="pd"? pick(DATA.PD_TITLES) : makeTitle(genre);
  return { id:nid(), kind:k.id, genre, title, price,
           boost: Math.round(3+price*0.18), buzz: clamp(0.02+price*0.0022, 0.02, 0.12) };
}


function infl(){ return Math.pow(1.02, yearOf(G?G.week:1)-1); }

function interestRate(){ return 0.0018*(G.execs.cfo?0.7:1); }

function intlShareOf(f){
  let s = DATA.GENRES[f.genre].intlShare;
  if(f.foreignLang) s += 0.10;                  // v3: foreign-language travels
  if(f.censorCut) s = Math.max(0.15, s-0.08);   // v3: China censor board
  if(f.chinaDenied) s = Math.max(0.10, s-(DATA.GENRES[f.genre].china||0));  // v5: missed the quota slot
  if(f.strictMarketsBan) s = Math.max(0.10, s-0.03);                        // v5: R/horror censors
  if(DATA.GLOBAL && DATA.GLOBAL.india){                 // v5: Indian theatrical over-indexing
    const b = DATA.GLOBAL.india[f.genre]||0;
    if(b) s += b;
  }
  return clamp(s, 0.15, 0.85);
}

function launchPublishing(id){
  const fr=frById(id); if(!fr || fr.publishing) return;
  if(G.studio.cash<15){ log("💸 A publishing arm costs $15M.","bad"); return; }
  spend("studio", 15); fr.publishing=true;
  log("📚 “"+fr.name+"” publishing arm launched — novels, comics, lore books (−$15M, +weekly).","gold");
  saveGame();
}

function libraryMove(fid){
  const s=G.streamer; if(!s) return false;
  const f=G.films.find(x=>x.id===fid);
  if(!f || f.soldTo || f.streamingOriginal || f.inTheaters || f.onOwnPlatform || f.onOwn) return false;
  f.onOwnPlatform=true; f.onOwn=true; f.soldTo=s.name;
  const bump=Math.round((0.4+f.quality.overall/120)*100)/100;
  s.subs+=bump; s.lastContent=G.week;
  log("📚 “"+f.title+"” moved to "+s.name+" (+"+bump.toFixed(2)+"M subs).","good");
  saveGame(); return true;
}
function moveToStreamer(fid){
  return libraryMove(fid);
}


function licenseOut(id, kind){
  kind = kind||"film";
  const fr=frById(id); if(!fr || (fr.licenseAt||0)>G.week) return;
  const rival=pick(G.rivals);
  G.licensedOut=G.licensedOut||[];
  if(kind==="goods"){
    // consumer-goods license: rich upfront, brand keeps control of the screen rights
    const upfront=Math.round(14+fr.tier*9+rnd()*10);
    earn("empire", upfront);
    fr.licenseAt=G.week+26;
    fr.decay=Math.max(0.25, fr.decay-0.04);
    G.licensedOut.push({ name:fr.name, tier:fr.tier, rival:rival.name+" Consumer Goods", kind:"goods", due:G.week+rint(8,12), flat:true });
    log("🥤 "+fr.name+" merchandise licensed to "+rival.name+" Consumer Goods — "+fmtM(upfront)+" upfront, royalties on top.","gold");
    saveGame();
    return;
  }
  const upfront=Math.round(10+fr.tier*6+rnd()*8);
  earn("empire", upfront);
  fr.licenseAt=G.week+39;
  fr.decay=Math.max(0.25, fr.decay-0.08);
  G.licensedOut.push({ name:fr.name, tier:fr.tier, rival:rival.name, kind:"film", due:G.week+rint(10,16) });
  log("🤝 "+rival.name+" licensed “"+fr.name+"” — "+fmtM(upfront)+" upfront, backend if their film hits. (Your merch shelf sags while they hold the brand.)","gold");
  saveGame();
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

/* removed: legacy sealed-bid pack flow superseded by tickSportsAuctions (v3)+v5 line-up */

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

function refreshIpMarket(seed){
  G.ipMarket = (G.ipMarket||[]).filter(i=>i.born+16>G.week);
  while(G.ipMarket.length<4){ const it=genIpItem(); it.born=G.week; G.ipMarket.push(it); }
  if(!seed && G.ipMarket.length>6) G.ipMarket.length=6;
}

function repayMezz(amount){
  amount=Math.min(Math.round(amount), G.mezz, Math.max(0,Math.floor(G.studio.cash)));
  if(amount<=0) return false;
  G.mezz-=amount; spend("financing", amount);
  log("🧨 Mezzanine repaid: "+fmtM(amount)+".","good");
  saveGame(); return true;
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

function saleValueWithOutput(value){
  if(G.outputDeal>0) return Math.round(value*1.2);
  return Math.round(value);
}

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

/* removed: legacy sealed-bid pack flow superseded by tickSportsAuctions (v3)+v5 line-up */


function takeMezz(amount){
  amount=Math.min(Math.round(amount), Math.round(150-G.mezz));
  if(amount<=0) return false;
  G.mezz+=amount; earn("financing", amount);
  log("🧨 Mezzanine drawn: "+fmtM(amount)+" at 0.5%/week. Expensive oxygen.","");
  saveGame(); return true;
}

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

function tickFestivals(){
  const fest=DATA.FESTIVALS.find(x=>x.woy===woyOf(G.week));
  if(!fest || G.pendingChoice || G.pendingReport || G.pendingAuction) return;
  const elig=festivalFilms();
  const choices=[];
  elig.slice(0,4).forEach(f=>{
    const loves = (fest.loves||[]).includes(f.genre);
    const foreignEdge = fest.foreign && f.foreignLang;
    const hit = loves? " 😍 taste fit" : "";
    const winP=clamp(0.22+f.quality.critic/180+(loves?0.12:0)+(foreignEdge?DATA.FESTIVAL_FOREIGN_BONUS*1.5:0)+(f.fyc?0.1:0), 0.15, 0.85);
    choices.push({ label:"Submit “"+f.title+"” (−$3M, critic "+f.quality.critic+hit+", win ~"+Math.round(winP*100)+"%)", run(G){
      spend("marketing", 3); f.submittedFest=true;
      const prest = fest.prestige||1;
      if(chance(winP)){
        const prize=Math.round(rint(4,9)*prest);
        earn("other", prize);
        G.studio.rep=clamp(G.studio.rep+Math.round(3*prest),5,99);
        G.festWins.push({year:yearOf(G.week), fest:fest.name, film:f.title});
        if(f.inTheaters!==undefined && f.phase===undefined){ f.festWins=(f.festWins||[]); f.festWins.push(fest.name); f.festPrestige=(f.festPrestige||0)+Math.round(10*prest); f.campaign=(f.campaign||0)+Math.round(4*prest); }
        else { f.buzzBonus=(f.buzzBonus||0)+0.08*prest; f.campaign=(f.campaign||0)+Math.round(3*prest); }
        G.log(fest.emoji+" "+fest.name+": “"+f.title+"” takes a prize! +"+fmtM(prize)+" purse, +rep, awards momentum.","gold");
        /* v5: the sales market — a win on the circuit invites premium acquisitions interest */
        if((fest.market||1)>=1 && !f.soldTo && !f.streamingOriginal){
          if(f.phase==="ready"){
            const bids=makeAuctionBids(f).map(b=>({platform:b.platform, value:Math.round(b.value*(1+0.12*(fest.market||1)))}));
            if(bids.length){ G.pendingAuction={ projectId:f.id, bids, manual:true, festWin:fest.name }; G.log("🛍 Acquisitions frenzy at "+fest.name+" — streamers are bidding on the winner.","gold"); }
          }else if(f.inTheaters===false && !f.soldTo){
            scheduleOttOffer(f, 1);
            G.filmOttPremium = G.filmOttPremium||{};
            G.filmOttPremium[f.id]=(fest.market||1)*0.12;   // gentle premium on the next license offer
            G.log("🛍 The "+fest.name+" win has buyers circling — expect a premium offer.","gold");
          }
        }
      }else{
        G.studio.rep=clamp(G.studio.rep+1,5,99);
        if(f.phase==="ready") f.buzzBonus=(f.buzzBonus||0)+0.04;
        G.log(fest.emoji+" "+fest.name+": “"+f.title+"” screened well"+(loves?" — the jury loved the fit":"")+". No prize, but +1 rep.","");
      }
    }});
  });
  if(!choices.length) return;
  choices.push({ label:"Skip "+fest.name, run(G){} });
  G.pendingChoice={ icon:fest.emoji, title:fest.name+" is calling",
    text:(fest.blurb||"One of the four great festivals.")+" It loves "+(fest.loves||[]).map(g=>DATA.genreOf(g).name.toLowerCase()).join(", ")+". Prestige ×"+(fest.prestige||1)+", acquisitions market ×"+(fest.market||1)+".",
    choices:choices.map((c,i)=>({label:c.label, i})) };
  G._evtRun=choices;
}

function tickLicensedOut(){
  if(!G.licensedOut) return;
  for(const L of [...G.licensedOut]){
    if(G.week>=L.due){
      G.licensedOut=G.licensedOut.filter(x=>x!==L);
      if(L.flat||L.kind==="goods"){
        const roy=Math.round((3+L.tier*2+rnd()*6)*10)/10;
        earn("empire", roy);
        log("🥤 "+L.rival+"'s “"+L.name+"” merch royalties settle: +"+fmtM(roy)+".","good");
        continue;
      }
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

function tickPoaching(){
  if(!chance(0.022*DATA.DIFFICULTIES[G.difficulty].eventRate)) return;
  const cands = G.talent.filter(t=>!t.bookedUntil && ((t.heat||0)>=2 || (t.pics||0)>=2));
  if(!cands.length) return;
  const t=pick(cands);
  if(G.execs.casting && chance(0.6)){ log("🎭 Your Head of Casting fended off a poaching attempt on "+t.name+".","good"); return; }
  G.talent = G.talent.filter(x=>x!==t);
  log("🕶 "+pick(G.rivals).name+" poached "+t.name+" ("+t.power+"★) with an exclusive deal.","bad");
}

function weeklyOverhead(){
  let o = G.studio.overhead + G.projects.length*0.12 + G.series.filter(s=>s.phase==="shoot").length*0.15;
  DATA.EXECS.forEach(e=>{ if(G.execs[e.id]) o+=e.salary; });
  return o;
}



/* ═══════════════════════════════════════════════════════════
   v5 ENGINE ADDITIONS
   AI & synthetic media · global markets · co-productions ·
   talent agencies · precursors · piracy · unions · M&A ·
   wage inflation · timeline management · deepfake mini-game
   ═══════════════════════════════════════════════════════════ */

/* ── scenario kickoffs (v5): Indie Darling & Franchise Machine ── */
function scenarioKickoff(scen){
  if(!scen) return;
  if(scen.devBonus) log("🌹 "+scen.name+": your development instincts are worth +"+scen.devBonus+" on every concept.","gold");
  if(G.scenario==="indiedarling"){
    // festival-bred: two extra read-worthy indie specs hit your desk
    for(let i=0;i<2;i++){
      const it=genIdea(); it.scale="indie"; it.script=clamp(rint(70,86),60,92); it.hot=chance(0.5);
      it.blurb="A script your festival contacts slipped you first. "+it.blurb;
      G.ideas.push(it);
    }
    log("🌹 Your festival contacts slip you two hot indie specs nobody else has read (in Develop).","gold");
  }
  if(G.scenario==="franchisemachine"){
    // a legacy hit is already on the lot — tier-1 franchise, rested brand, some back-value
    const genre = pick(["action","scifi","fantasy","animation","adventure"].filter(g=>DATA.GENRES[g])) ;
    const title = makeTitle(DATA.GENRES[genre]? genre : "action");
    const legacy = { id:nid(), title, genre, scale:"tentpole", budget:180, marketing:85, devCost:12,
      quality:{overall:74, critic:71, aud:82}, releaseWeek:0, weekly:[], opening:96, dom:268, ww:652,
      rentalsDom:142, studioRev:310, profit:120, inTheaters:false, weeksOut:14, franchiseable:true,
      franchiseName:title, soldTo:"Paramount+ (archival deal)", awardsEligible:false, year:Math.max(1,yearOf(G.week)-3),
      reviews:[], piracyPenalty:0, rebateEarned:0, window:"45", rating:"PG-13", location:"la" };
    G.films.push(legacy);
    upsertFranchise(legacy);
    const fr=G.franchises[0];
    if(fr){ fr.decay=0.85; fr.fatigue=0.06; }
    G.stats.totalWW += 652;   // it's in your catalog history
    log("🏰 LEGACY IP ON THE LOT: “"+title+"” (tier-1 franchise, rested). Greenlight the sequel from Empire before the heat dies.","gold");
  }
}

/* ── talent agencies (v5): packaging fee calculator ── */
function packagingFeeOf(cast){
  const counts={}; (cast||[]).forEach(c=>{ if(c.agency) counts[c.agency]=(counts[c.agency]||0)+1; });
  let best=null, n=0;
  for(const id in counts){ if(counts[id]>n){ n=counts[id]; best=id; } }
  if(!best || n<2) return {fee:0, agency:null, count:n};
  const ag = DATA.agency? DATA.agency(best) : null;
  if(!ag) return {fee:0, agency:null, count:0};
  if(G.agencyDeals && G.agencyDeals[best]>G.week) return {fee:0, agency:best, count:n, waived:true}; // exclusive: waived
  return {agency:best, count:n, rate:ag.fee||0.04, name:ag.name}; // fee applied to budget at greenlight
}
function packagingCost(cast, budget){
  const p=packagingFeeOf(cast);
  if(!p.rate) return 0;
  return Math.round(Math.min(budget*p.rate, 14)*10)/10;
}
function signAgencyDeal(id){
  const ag=DATA.agency? DATA.agency(id):null; if(!ag) return false;
  if(G.agencyDeals[id]>G.week) return false;
  if(G.studio.cash<ag.dealCost){ log("💸 "+ag.name+" exclusivity costs "+fmtM(ag.dealCost)+".","bad"); return false; }
  spend("studio", ag.dealCost);
  G.agencyDeals[id]=G.week+ag.dealWeeks;
  log(ag.icon+" Signed an exclusive first-look with "+ag.name+" ("+ag.dealWeeks+" wks): their packaging fees waived, their clients −"+Math.round(ag.disc*100)+"%.","gold");
  saveGame(); return true;
}
function agencyRoster(id){ return (G.talent||[]).filter(t=>t.agency===id && !t.retired); }

/* ── AI & synthetic media (v5): deepfake mini-game resolution ── */
function resolveDeepfake(correct){
  const d=G.pendingDeepfake; if(!d) return;
  const t=G.talent.find(x=>x.id===d.talentId);
  G.pendingDeepfake=null;
  if(correct){
    G.studio.rep=clamp(G.studio.rep+1,5,99);
    log("🧬 Deepfake exposed before deadline — your debunk goes viral. "+(t? t.name+" is cleared.":"")+" +1 rep.","gold");
    sfx("chime");
  }else{
    if(t && typeof scandalHit==="function") scandalHit(t);
    G.studio.rep=clamp(G.studio.rep-1,5,99);
    log("🧬 You flagged the wrong frame — the fake metastasized. "+(t? t.name+" goes radioactive.":"The press feasts."),"bad");
    sfx("buzz");
  }
  saveGame();
}

/* ── piracy & windowing (v5) ── */
function piracyAdjust(x, why){
  G.piracy = clamp(Math.round(((G.piracy||0)+x)*10)/10, 0, 100);
}
function piracyLabel(){
  const p=G.piracy||0;
  return p>=60? {tag:"🏴‍☠️ rampant", cls:"red"} : p>=40? {tag:"🦜 leaking", cls:"red"} : p>=25? {tag:"🌊 drifting", cls:"gold"} : {tag:"🛡 contained", cls:"green"};
}
function tickPiracy(){
  const P=DATA.PIRACY||{drift:0.35, decayWithUpgrade:1};
  G.piracy = G.piracy||P.start;
  G.piracy += P.drift * (G.upgrades.antipiracy? 0.4 : 1);
  if(G.upgrades.antipiracy) G.piracy -= P.decayWithUpgrade;
  G.piracy = clamp(Math.round(G.piracy*100)/100, 0, 100);
}

/* ── union negotiations (v5) ── */
function unionAdjust(x, why){
  G.unionMeter = clamp(Math.round(((G.unionMeter||0)+x)*10)/10, 0, 100);
  if(Math.abs(x)>=8 && why) log("✊ Guild relations "+(x>0? "worsen":"improve")+" ("+why+").", x>0?"bad":"good");
}
function unionLabel(){
  const u=G.unionMeter||0;
  return u>=70? {tag:"✊ strike watch", cls:"red"} : u>=50? {tag:"😤 tense", cls:"gold"} : u>=30? {tag:"🤝 negotiating", cls:""} : {tag:"🕊 harmonious", cls:"green"};
}
function tickUnion(){
  const U=DATA.UNION||{drift:0.22, negotiationWoy:30, strikeAt:75, strikePause:3, concede:-28, refuseStrike:18};
  G.unionMeter = clamp((G.unionMeter||U.start) + U.drift, 0, 100);
  // the negotiation week: a real bargaining event
  if(woyOf(G.week)===U.negotiationWoy && !G.pendingChoice && !G.pendingReport && !G.pendingAuction){
    if(G._unionAsked===yearOf(G.week)) { /* once per year */ } else {
      G._unionAsked=yearOf(G.week);
      G.pendingChoice={ icon:"✊", title:"Guild contract negotiations",
        text:"The below-the-line unions and the writers' guild both have deals expiring. Rank-and-file patience: "+Math.round(G.unionMeter)+"/100 heated. A generous master contract costs $12M now (fees +2% permanently) and ends strike talk. Hardball saves cash — this week.",
        choices:[
          {label:"Sign the generous deal (−$12M, quotes +2%, unions content)", i:0},
          {label:"Stonewall them (unions heat up)", i:1},
        ] };
      G._evtRun=[
        {label:"", run(GG){ spend("talent",12); unionAdjust(U.concede,"master contract signed"); G.unionStats.signed++;
          G.feeInfl=Math.round(((G.feeInfl||0)+0.02)*100)/100;
          G.log("✊ Three-year master contract signed. Guilds stand down (quotes +2%).","good"); }},
        {label:"", run(GG){ unionAdjust(U.refuseStrike,"stone-walled negotiations");
          if((G.unionMeter||0)>=U.strikeAt-10 && chance(0.5)) triggerUnionStrike();
          else G.log("✊ Soft muttering on the lots. Nobody's out — yet.","bad"); }},
      ];
    }
  }
  if((G.unionMeter||0)>=U.strikeAt) triggerUnionStrike();
}
function triggerUnionStrike(){
  if(G._strikeAtWeek===G.week) return;
  G._strikeAtWeek=G.week;
  const U=DATA.UNION||{strikePause:3, settle:-12};
  let hit=0;
  G.projects.forEach(p=>{ if(p.phase==="shoot"){ p.strikePause=(p.strikePause||0)+U.strikePause; hit++; } });
  G.unionMeter=45; G.unionStats.strikes++;
  G.studio.rep=clamp(G.studio.rep-3,5,99);
  log("🪧 GENERAL STRIKE! The guilds walk — "+(hit? hit+" shoot(s) down for "+U.strikePause+" weeks":"productions idle")+". Rep −3. Sign better contracts or watch the lots burn.","bad");
  sfx("buzz");
}

/* ── global markets (v5): EU content quota math ── */
function euShareOf(){
  const pool=(G.films||[]).filter(f=>!f.streamingOriginal || f.platform===undefined || true);
  const total=(G.films||[]).length + (G.series||[]).filter(s=>s.seasons.length).length;
  if(!total) return {share:1, eu:0, total:0};
  const eu=(G.films||[]).filter(f=>["london","toronto","queensland"].includes(f.location||"la") || f.foreignLang).length;
  return {share:eu/total, eu, total};
}
function euQuotaCheck(){
  if(!G.streamer) return;
  const EU=DATA.GLOBAL? DATA.GLOBAL.eu : {quota:0.3, fine:5, freezeWeeks:4, bonusSubs:0.6};
  const r=euShareOf();
  if(r.total<3){ log("🇪🇺 EU quota review: catalogue too small to audit yet — no action.",""); return; }
  if(r.share>=EU.quota){
    G.streamer.subs=Math.round((G.streamer.subs+EU.bonusSubs)*100)/100;
    G.streamer.euOK=(G.streamer.euOK||0)+1;
    log("🇪🇺 EU quota PASSED ("+Math.round(r.share*100)+"% European works) — Brussels clears you; +"+EU.bonusSubs+"M subs in goodwill.","gold");
  }else{
    spend("other", EU.fine);
    G.streamer.euFreeze=EU.freezeWeeks;
    log("🇪🇺 EU quota FAILED ("+Math.round(r.share*100)+"% < "+Math.round(EU.quota*100)+"% European works) — "+fmtM(EU.fine)+" fine, growth frozen "+EU.freezeWeeks+" wks. Shoot in London/Toronto or make a foreign-language picture.","bad");
  }
}

/* ── awards overhaul (v5): precursor season ── */
function tickPrecursors(){
  const woy=woyOf(G.week);
  const pre=(DATA.PRECURSORS||[]).find(p=>p.woy===woy);
  if(!pre) return;
  if(G._precursorAt===G.week) return;
  G._precursorAt=G.week;
  const yr=yearOf(G.week);
  const field=[];
  for(const f of G.films){
    if(f.year!==yr || !f.quality || !f.awardsEligible) continue;
    const g=DATA.GENRES[f.genre];
    const prestige=(f.quality.critic+(f.campaign||0)+(f.festPrestige||0))*(0.6+g.awards*0.5);
    if(prestige>=52) field.push({title:f.title, prestige, f, mine:true});
  }
  if(!field.length) return;
  for(const r of G.rivals){
    const g=pick(Object.keys(DATA.GENRES)); const q=rint(56,92);
    field.push({title:makeTitle(g), prestige:q*(0.6+DATA.GENRES[g].awards*0.5), mine:false, studio:r.name});
  }
  const tot=field.reduce((a,n)=>a+Math.pow(n.prestige,2),0);
  let r0=rnd()*tot, winner=field[0];
  for(const n of field){ r0-=Math.pow(n.prestige,2); if(r0<=0){ winner=n; break; } }
  if(winner.mine){
    const f=winner.f;
    f.campaign=(f.campaign||0)+pre.boost;
    earn("other", pre.cash);
    f.precursors=(f.precursors||[]); f.precursors.push(pre.name);
    G.precursorWins = G.precursorWins||{year:0,count:0};
    if(G.precursorWins.year===yr) G.precursorWins.count++; else G.precursorWins={year:yr, count:1};
    G.studio.rep=clamp(G.studio.rep+1,5,99);
    log(pre.emoji+" "+pre.name+": “"+f.title+"” wins! Awards momentum +"+pre.boost+" (and a "+fmtM(pre.cash)+" purse). The Golden Reels are listening.","gold");
    sfx("chime");
  }else{
    log(pre.emoji+" "+pre.name+": “"+winner.title+"” ("+(winner.studio||"?" )+") wins the early-season prize.","");
  }
}

/* ── M&A desk (v5): quarterly rotating acquisition offers ── */
function tickMa(){
  const woy=woyOf(G.week);
  if(woy%13!==1) { return; }
  if(G.maFetchedAt===yearOf(G.week)*100+Math.ceil(woy/13)) return;
  G.maFetchedAt=yearOf(G.week)*100+Math.ceil(woy/13);
  const MA=DATA.MA; const offers=[];
  { const price=rint(MA.library.costMin, MA.library.costMax);
    offers.push({id:nid(), kind:"library", name:MA.library.name, icon:MA.library.icon, price, blurb:MA.library.blurb, expires:G.week+6}); }
  const price2=rint(MA.ministream.costMin, MA.ministream.costMax);
  offers.push({id:nid(), kind:"ministream", name:MA.ministream.name, icon:MA.ministream.icon, price:price2, blurb:MA.ministream.blurb, expires:G.week+6});
  if(G.rivals.some(r=>r.slate.some(f=>!f.dead && !f.live && f.week>G.week))){
    const price3=rint(MA.rivalslate.costMin, MA.rivalslate.costMax);
    offers.push({id:nid(), kind:"rivalslate", name:MA.rivalslate.name, icon:MA.rivalslate.icon, price:price3, blurb:MA.rivalslate.blurb, expires:G.week+6});
  }
  G.maOffers = offers;
  log("🏦 The M&A desk circulates this quarter's deal book — see 💼 Finance.","");
}
function maBuy(id){
  const o=(G.maOffers||[]).find(x=>x.id===id); if(!o) return false;
  if(G.studio.cash<o.price){ log("💸 You can't cover "+fmtM(o.price)+" for “"+o.name+"”.","bad"); return false; }
  spend("studio", o.price);
  G.maOffers=G.maOffers.filter(x=>x.id!==id);
  G.maDeals=(G.maDeals||[]); G.maDeals.push({kind:o.kind, price:o.price, week:G.week, name:o.name});
  if(o.kind==="library"){
    G.maLibraries=(G.maLibraries||0)+1;
    log("📚 Acquired an indie library ("+fmtM(o.price)+") — +"+(DATA.MA.library.catalogEach)+" catalog value, royalties flow weekly.","gold");
  }else if(o.kind==="ministream"){
    G.maLibraries=(G.maLibraries||0)+1;
    const subs=(DATA.MA.ministream.subs||6);
    if(G.streamer){
      G.streamer.subs=Math.round((G.streamer.subs+subs)*100)/100;
      G.streamer.sportsPower=(G.streamer.sportsPower||0)+(DATA.MA.ministream.power||2);
      G.streamer.lastContent=G.week;
      log("📱 Mini-streamer acquired and folded into "+G.streamer.name+": +"+subs+"M subs ("+fmtM(o.price)+").","gold");
    }else{
      // folding the target becomes your streamer
      G.streamer={ name:"AcquiredFlix", launchedWeek:G.week, subs:subs, peak:subs, sportsPower:0,
        churn:0.008, income:0, totalRev:0, lastContent:G.week, tier:"premium", crackdown:0, adRevenue:0 };
      log("📱 Mini-streamer acquired — it's now YOUR platform with "+subs+"M subs. Rename optional; feeding it isn't.","gold");
    }
  }else if(o.kind==="rivalslate"){
    const taken=[];
    for(const r of G.rivals){
      for(const f of r.slate){
        if(!f.dead && !f.live && f.week>G.week && taken.length<2 && f.scale!=="tentpole"){
          f.distBy="me"; taken.push(f);
        }
      }
      if(taken.length>=2) break;
    }
    if(!taken.length){ earn("financing", o.price); G.maDeals.pop(); log("🤷 The firesale had nothing worth distributing — refund issued.",""); saveGame(); return false; }
    G.maSlate=(G.maSlate||[]);
    taken.forEach(f=>{ G.maSlate.push({title:f.title, week:f.week}); });
    log("🎞 Slate firesale: you now distribute "+taken.map(f=>"“"+f.title+"”").join(" and ")+" — you keep the rentals, they take the credit-less writeoff.","gold");
  }
  saveGame(); return true;
}
// rival releases you've acquired pay your rent
function tickMaSlateRentals(){
  for(const r of G.rivals) for(const f of r.slate){
    if(f.distBy!=="me" || !f.live || f.dead) continue;
    const legs=clamp(1.6+(f.quality-30)*0.028+DATA.GENRES[f.genre].legsAdj,1.45,4.0);
    const d=1-1/legs;
    let g=(f.opening||f.weight||4)*Math.pow(d, Math.max(0,f.weeksOut-1));
    if(G.theaterCap>0) g*=0.55;
    if(g>0.4){ earn("theatrical", g*0.50); G.stats.totalWW+=g; }
  }
}

/* ── shared-universe timeline management (v5) ── */
function timelineFactor(p, weekAbs){
  if(!p.franchiseName) return 1;
  let clutter=false, gap=0;
  for(const o of (G.projects||[])){
    if(o===p || o.franchiseName!==p.franchiseName || !o.releaseWeek) continue;
    const d=Math.abs(o.releaseWeek-weekAbs);
    if(d<=6) clutter=true;
    gap=Math.max(gap, weekAbs-o.releaseWeek>0? weekAbs-o.releaseWeek : 0);
  }
  for(const f of (G.films||[])){
    if(f.franchiseName!==p.franchiseName || !f.releaseWeek) continue;
    const d=weekAbs-f.releaseWeek;
    if(d>0 && d<=6) clutter=true;
  }
  const fr=G.franchises.find(x=>x.name===p.franchiseName);
  if(fr && fr.entries && fr.entries.length){
    const last=fr.entries[fr.entries.length-1].week||0;
    if(weekAbs-last>=26) gap=Math.max(gap, weekAbs-last);
  }
  if(clutter) return 0.94;   // timeline clutter — audiences can't track the canon
  if(gap>=26) return 1.04;   // properly rested entries feel like EVENTS
  return 1;
}

/* weekly piracy + union + precursor + M&A hooks into the main tick */
