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
    comboKnown:{}, watchlist:[], pendingSale:null,
    over:null, pendingReport:null, pendingChoice:null,
    weeksInDebt:0,
    ipo:false, quarterNet:0, mezz:0,
    outputDeal:0, wrapDeal:0, agencyExcl:0,
    sportsPower:0, mySports:[],
    public:null,
    prototype: !!opts.sandbox,   // v28: prototype debug mode
    scenarioProgress: {}, // v28: track scenario wins/completions
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
    /* ── v12 state ── */
    chains: (DATA.CHAINS||[]).map(c=>({id:c.id, rel:c.rel})),   // booking relation persists per chain
    /* ── v14 state ── */
    seed: Date.now().toString(36).toUpperCase().slice(-6),   // §59: run seed (a label, not a secret) for the legacy hall
    board: (DATA.BOARD_TRAITS||[]).map(t=>({name:pick(t.names), trait:t.trait, hawk:!!t.hawk, approval:clamp(t.base+rint(-6,6),5,95)})),
    label: {unlocked:false, artists:[]},
    intel: null,
  };
  seedTrends();
  genTalentPool();
  if(typeof seedBTL==="function") seedBTL();
  seedIdeas();
  seedRivalYear();
  refreshIpMarket(true);
  scenarioKickoff(scen);
  if(opts.legacy!==undefined&&opts.legacy!==null&&opts.legacy!==""){
    try{ claimLegacy(opts.legacy); }catch(e){}
  }
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

/* ═══════════ save / load — versioned schema + migrations (v4) + named slots + IndexedDB sync (v23) ═══════════ */
const SAVE_KEY = "bow_save";
const IDB_NAME = "BoxOfficeWar";
const IDB_VERSION = 1;
let _idb = null;
let _saveIndicatorTimer = null;

function initIDB(){
  return new Promise((resolve, reject) => {
    if(typeof indexedDB==="undefined") return resolve(false);
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains("saves")) db.createObjectStore("saves", {keyPath: "id"});
      if(!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", {keyPath: "key"});
    };
    req.onsuccess = e => { _idb = e.target.result; resolve(true); };
    req.onerror = e => resolve(false);
  });
}

async function saveToIDB(slotName, data){
  if(!_idb) await initIDB();
  if(!_idb) return false;
  return new Promise((resolve) => {
    const tx = _idb.transaction("saves", "readwrite");
    tx.objectStore("saves").put({id: slotName, data, timestamp: Date.now()});
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function loadFromIDB(slotName){
  if(!_idb) await initIDB();
  if(!_idb) return null;
  return new Promise((resolve) => {
    const tx = _idb.transaction("saves", "readonly");
    const req = tx.objectStore("saves").get(slotName);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => resolve(null);
  });
}

async function listIDBSlots(){
  if(!_idb) await initIDB();
  if(!_idb) return [];
  return new Promise((resolve) => {
    const tx = _idb.transaction("saves", "readonly");
    const req = tx.objectStore("saves").getAll();
    req.onsuccess = () => resolve(req.result.map(r => ({id: r.id, timestamp: r.timestamp})));
    req.onerror = () => resolve([]);
  });
}

function showSaveIndicator(msg){
  const el = $("#saveIndicator");
  if(!el){
    const div = document.createElement("div");
    div.id = "saveIndicator";
    div.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:1000;padding:8px 12px;background:rgba(0,0,0,.8);color:var(--gold);border-radius:8px;font-size:12px;opacity:0;transition:opacity .2s";
    document.body.appendChild(div);
  }
  const el2 = $("#saveIndicator");
  el2.textContent = msg;
  el2.style.opacity = "1";
  if(_saveIndicatorTimer) clearTimeout(_saveIndicatorTimer);
  _saveIndicatorTimer = setTimeout(()=>{ el2.style.opacity = "0"; }, 1500);
}

function saveGame(){
  try{
    if(typeof localStorage==="undefined" || !G) return;
    if(G._noSave) return;   // v14: a what-if fork never writes over the real run
    G.v = DATA.SAVE_VERSION||4;
    const raw = JSON.stringify(G); // perf: serialize once, write twice
    localStorage.setItem(SAVE_KEY, raw);
    try{ localStorage.setItem("bow_slot"+(G.slot||1), raw); }catch(e){}
    // Named slot
    if(G.saveName) localStorage.setItem("bow_named_"+G.saveName, raw);
    // IndexedDB sync (async, fire-and-forget)
    if(G.saveName) saveToIDB(G.saveName, G);
    showSaveIndicator("💾 Saved" + (G.saveName?" as "+G.saveName:""));
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
function namedSlotMeta(name){
  try{
    const raw = localStorage.getItem("bow_named_"+name);
    if(!raw) return null;
    const j=JSON.parse(raw);
    return { name:j.studio.name, week:j.week, cash:j.studio.cash, scenario:j.scenario||"standard", saveName:name };
  }catch(e){ return null; }
}
async function loadSlot(n){
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
async function loadNamedSlot(name){
  try{
    const raw=localStorage.getItem("bow_named_"+name); if(!raw) return null;
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
async function loadIDBSlot(name){
  const data = await loadFromIDB(name);
  if(!data) return null;
  const problems = validateSave(data);
  if(problems.length) return null;
  const { save } = migrateSave(data);
  G = save; G.log=log; saveGame(); return G;
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
    s.comboKnown=s.comboKnown||{}; s.watchlist=s.watchlist||[]; s.pendingSale=s.pendingSale||null;
    s.custom = s.custom || { studios:[], people:[], franchises:[] };
    s.scenarioProgress = s.scenarioProgress || {};
    (s.talent||[]).forEach(t=>{ if(t.ability===undefined){ t.ability=genAbilityFor(t.kind, t.power||2); t.abilityKnown=false; } if(!t.powerByRegion){ t.powerByRegion={NA:t.power, EU:t.power, AS:t.power, LA:t.power, AF:t.power}; } });
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
  /* ── v12: theater chains — booking relations persist; films carry line items ── */
  6(s){
    if(!Array.isArray(s.chains)) s.chains = (DATA.CHAINS||[]).map(c=>({id:c.id, rel:c.rel}));
    (s.films||[]).forEach(f=>{ if(!Number.isFinite(f.locCost)) f.locCost=0; if(!Number.isFinite(f.advanceTotal)) f.advanceTotal=0; });
    return s;
  },
  /* ── v13: promo obligations ride the cast; films carry campaign legs ── */
  7(s){
    (s.projects||[]).forEach(p=>{
      if(p.promoOwed===undefined) p.promoOwed=Math.min(6, (p.cast||[]).length + (((p.cast||[]).reduce((a,c)=>a+(c.power||0),0))>=6?2:0));
      if(!Array.isArray(p.dropEvents)) p.dropEvents=[];
      if(!Array.isArray(p.promoEvents)) p.promoEvents=[];
    });
    (s.films||[]).forEach(f=>{ if(!Number.isFinite(f.campaignLegs)) f.campaignLegs=0; });
    return s;
  },
  /* ── v14: board seats, exec careers, staff levels, label, run seed ── */
  8(s){
    if(!Array.isArray(s.board) || !s.board.length) s.board=(DATA.BOARD_TRAITS||[]).map(t=>({name:(t.names||[])[0]||"Director", trait:t.trait, hawk:!!t.hawk, approval:t.base||50}));
    if(!s.seed) s.seed=Date.now().toString(36).toUpperCase().slice(-6);
    if(!s.label) s.label={unlocked:false, artists:[]};
    if(!Number.isFinite(s.intel) && !s.intel) s.intel=null;
    Object.keys(s.execs||{}).forEach(k=>{
      const e=s.execs[k];
      if(!e || typeof e!=="object") s.execs[k]={hired:s.week||1, tenure:rint(0,52), xp:rint(2,10)};
    });
    if(s.btl) ["dp","composer","vfx"].forEach(r=>{ if(s.btl[r] && typeof s.btl[r]==="object" && !Number.isFinite(s.btl[r].xp)) s.btl[r].xp=rint(0,6); });
    return s;
  },
  /* ── v17: multi-territory, economic cycles, franchise graph, exec office, dashboard ── */
  9(s){
    // Multi-territory box office
    if(!Array.isArray(s.films)) s.films=[];
    s.films.forEach(f=>{
      if(!f.territoryGross) f.territoryGross={};
      DATA.TERRITORIES.forEach(t=>{ if(!Number.isFinite(f.territoryGross[t.id])) f.territoryGross[t.id]=0; });
    });
    // Economic cycle state
    if(!s.econCycle) s.econCycle={ phase:"normal", weeksLeft:rint(104,208) };
    // Franchise universe graph (built from franchises + universes)
    if(!s.universes) s.universes=[];
    // Executive office view preferences
    if(!s.execOffice) s.execOffice={};
    // Dashboard view state
    if(!s.dashboard) s.dashboard={ lastViewed:G.week };
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
    const parsed = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if(validateSave(parsed).length) return false; // same bar as loadGame/loadSlot
    const g = migrateSave(parsed).save;
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
/* ── v28: hidden rarity-tiered abilities (mechanics study in REFERENCE-NOTES.md; original implementation) ── */
function genAbilityFor(kind, power){
  if(!DATA.ABILITIES) return null;
  const p = power||2;
  const odds = p>=5? 0.85 : p===4? 0.6 : p===3? 0.4 : 0.22;
  if(!chance(odds)) return null;
  const pool = DATA.ABILITIES.filter(a=>a.kind===kind);
  if(!pool.length) return null;
  const shift = p>=5? 26 : p===4? 14 : 0;
  const roll = rint(1,100) + shift;
  const rar = roll>=95? ["legendary"] : roll>=82? ["epic"] : roll>=55? ["rare"] : ["common"];
  const cands = pool.filter(a=>rar.includes(a.rarity));
  const chosen = pick(cands.length? cands : pool.filter(a=>a.rarity==="common"));
  return chosen? chosen.id : null;
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
           pics:0, joinedYear: yearOf(G?G.week:1),
           powerByRegion: {NA:power, EU:power, AS:power, LA:power, AF:power},
           ability:genAbilityFor("actor", power), abilityKnown:false };
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
           pics:0, joinedYear: yearOf(G?G.week:1), auteur: !!(opts&&opts.auteur),
           powerByRegion: {NA:power, EU:power, AS:power, LA:power, AF:power},
           ability:genAbilityFor("director", power), abilityKnown:false };
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
           trait: pick(DATA.WRITER_TRAITS), age: startAge(), scandal:0,
           powerByRegion: {NA:power, EU:power, AS:power, LA:power, AF:power},
           ability:genAbilityFor("writer", power), abilityKnown:false };
}
/* ── v4: PRODUCERS — they keep the shoot on budget and on schedule ── */
function genProducer(hot){
  const power = hot? rint(3,5) : rint(1,5);
  const skill = clamp(rint(50,90)+power*3+rint(-5,5), 45, 97);
  const fee = [0.5,1.4,3.2,7,13][power-1]*(hot?1.15:1);
  return { id:nid(), kind:"producer", name:pick(DATA.PROD_FIRST)+" "+pick(DATA.LAST), power, skill,
           agency:(DATA.AGENCIES? pick(DATA.AGENCIES).id : null),
           fee:Math.round(fee*10)/10, bookedUntil:0, heat:hot?1:0, genreFit:null,
           trait: pick(DATA.PROD_TRAITS), age: startAge(), scandal:0,
           powerByRegion: {NA:power, EU:power, AS:power, LA:power, AF:power},
           ability:genAbilityFor("producer", power), abilityKnown:false };
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

/* ── v28: Per-region star power (v28 follow-up) ── */
function effectivePower(t, region){
  if(!t) return 0;
  const base = t.power || 0;
  const byRegion = t.powerByRegion;
  if(!byRegion) return base;
  const r = byRegion[region];
  return r !== undefined ? r : base;
}

/* ── v28 ability helpers: effects are pure data summed off the attached talent ── */
function talentAbility(t){ return (t && t.ability)? DATA.abilityOf(t.ability) : null; }
function projectAbilities(p){
  const sum={overall:0,critic:0,aud:0,award:0,open:0,legs:0,intl:0,overrun:0};
  if(!p) return sum;
  const isSeq = !!(p.sequelOf || p.franchiseName);
  const add=(t)=>{
    const a=talentAbility(t); if(!a) return;
    if(a.specOnly && !["scifi","fantasy","action"].includes(p.genre)) return;
    if(a.bigOnly && p.scale!=="tentpole") return;
    if(a.seqOnly && !isSeq) return;
    const c=a.craft||{};
    sum.overall+=c.overall||0; sum.critic+=c.critic||0; sum.aud+=c.aud||0;
    sum.award+=a.award||0; sum.open+=a.open||0; sum.legs+=a.legs||0; sum.intl+=a.intl||0;
    sum.overrun+=a.overrun||0;
  };
  (p.cast||[]).forEach(add); add(p.director); add(p.writer); add(p.producer);
  return sum;
}
function abilityOpenMult(p){
  let m=1;
  m += projectAbilities(p).open;
  if(p && p.theme && DATA.comboOf(p.genre,p.theme)==="love") m+=0.08;
  return m;
}
/* v28: audition — pay a small read fee to reveal a candidate's hidden ability */
function auditionCost(t){ return Math.max(0.05, Math.round((actorFee(t)||0)*0.03*10)/10); }
function doAudition(id){
  const t=talentById(id); if(!t || t.abilityKnown) return false;
  const c=auditionCost(t);
  if(G.studio.cash < c){ log("💸 Not enough cash to stage an audition read on "+t.name+".","bad"); return false; }
  spend("development", c);
  t.abilityKnown=true;
  const a=talentAbility(t);
  log(a? "🎭 Audition read on "+t.name+": "+a.emoji+" "+a.name+" ("+DATA.ABILITY_RARITY[a.rarity].name+") — "+a.blurb+"."
      : "🎭 Audition read on "+t.name+": no special ability surfaced. Solid, not surprising.", a? "good":"");
  saveGame(); return true;
}
/* v28: talent watchlist — pin anyone for quick access from the talent hub */
function toggleWatch(id){
  G.watchlist=G.watchlist||[];
  const i=G.watchlist.indexOf(id);
  if(i>=0) G.watchlist.splice(i,1); else G.watchlist.push(id);
  saveGame();
}

/* ── v8: create-your-own superstar ── */
const STAR_FEE = { actor:[0.3,1.2,4,12,25], director:[0.8,2,5,10,18], writer:[0.4,1.1,2.8,6,12], producer:[0.5,1.4,3.2,7,13] };
function starSignFee(kind, power, skill){
  const base=(STAR_FEE[kind]||STAR_FEE.actor)[clamp(power,1,5)-1];
  return Math.round(base*(0.6+skill/100)*(2.2+power*0.5)*10)/10;
}
function createStar(cfg){
  const kind=cfg.kind, power=clamp(Math.round(cfg.power||3),1,5), skill=clamp(Math.round(cfg.skill||60),20,99);
  const name=String(cfg.name||"").trim().slice(0,28) || talentName(kind);
  const sign=starSignFee(kind,power,skill);
  if(G.studio.cash<sign){ log("💸 Signing "+name+" takes "+fmtM(sign)+" — you can't cover it.","bad"); return {ok:false}; }
  spend("talent", sign);
  const t={ id:nid(), kind, name, power, skill,
    fee:Math.round((STAR_FEE[kind]||STAR_FEE.actor)[power-1]*(0.6+skill/100)*10)/10,
    agency:null, bookedUntil:0, heat:0, genreFit: cfg.genreFit||null,
    age: clamp(Math.round(cfg.age||rint(22,34)),18,60), scandal:0, pics:0,
    joinedYear: yearOf(G.week), trait:"Homegrown", homegrown:true };
  G.talent.push(t);
  log("🌟 Signed "+name+" — "+kind+" · "+power+"★ · skill "+skill+". Signing bonus "+fmtM(sign)+".","gold");
  return {ok:true, t, sign};
}

/* ── v8: renaming ── */
function renameFilm(id, name){
  const f=G.films.find(x=>x.id===id); const n=String(name||"").trim().slice(0,60);
  if(!f || !n) return false;
  const old=f.title; f.title=n;
  G.talent.forEach(t=>{ if(t.booked===old) t.booked=n; });
  log("✏️ \""+old+"\" is now \""+n+"\".",""); saveGame(); return true;
}
function renameSeries(id, name){
  const s=G.series.find(x=>x.id===id); const n=String(name||"").trim().slice(0,60);
  if(!s || !n) return false;
  const old=s.title; s.title=n;
  G.talent.forEach(t=>{ if(t.booked===old) t.booked=n; });
  log("✏️ \""+old+"\" is now \""+n+"\".",""); saveGame(); return true;
}
function renameStreamer(name){
  if(!G.streamer) return false;
  const n=String(name||"").trim().slice(0,24); if(!n) return false;
  const old=G.streamer.name; G.streamer.name=n;
  G.films.forEach(f=>{ if(f.soldTo===old) f.soldTo=n; });
  log("📺 "+old+" rebranded as "+n+".","gold"); saveGame(); return true;
}
function renameStudio(name){
  const n=String(name||"").trim().slice(0,26); if(!n) return false;
  G.studio.name=n; saveGame(); return true;
}

/* ── v9: multi-picture contracts ── */
function contractCost(t){ return Math.round(actorFee(t)*1.5*10)/10; }
function signMultiFilmDeal(id){
  const t=talentById(id); if(!t||t.multiDeal) return false;
  const cost=contractCost(t);
  if(G.studio.cash<cost){ log("💸 Locking in "+t.name+" takes "+fmtM(cost)+" up front.","bad"); return false; }
  spend("talent", cost);
  t.multiDeal={left:3, disc:0.25};
  log("📜 Multi-picture deal: "+t.name+" is locked for 3 films at −25% fees — expect creative-control fights.","gold");
  saveGame(); return true;
}
/* ── v9: star school ── */
function trainCost(t){ return Math.round((t.fee*1.2+5)*(t.homegrown?0.7:1)*10)/10; }
function startTraining(id){
  const t=talentById(id); if(!t||t.training||t.age>34) return false;
  const cost=trainCost(t);
  if(G.studio.cash<cost){ log("💸 Star school charges "+fmtM(cost)+" up front.","bad"); return false; }
  spend("talent", cost);
  t.training={ weeksLeft:rint(8,12), skillGain:rint(4,9), powerOdds:(5-t.power)*0.14+0.05 };
  log("🎓 "+t.name+" enters star school — "+t.training.weeksLeft+" weeks of coaching ("+fmtM(cost)+").","");
  saveGame(); return true;
}
function tickTraining(){
  for(const t of G.talent){
    if(!t.training) continue;
    t.training.weeksLeft--;
    if(t.training.weeksLeft<=0){
      t.skill=clamp(t.skill+t.training.skillGain,20,99);
      let msg=t.name+" finished star school: skill now "+t.skill;
      if(chance(t.training.powerOdds)){ t.power=Math.min(5,t.power+1); msg+=", and the trade papers bump them to "+t.power+"★"; }
      log("🌟 "+msg+".","good");
      t.training=null;
    }
  }
}
/* ── v9: relationships — chemistry, feuds, muse directors ── */
function pairKey(a,b){ return a<b? a+"-"+b : b+"-"+a; }
function feudPartner(t){
  if(!G.feuds) return null;
  const k=G.feuds.find(k=>k.split("-").includes(String(t.id)));
  if(!k) return null;
  const [a,b]=k.split("-").map(Number);
  const other=a===t.id? b : a;
  const p=talentById(other); return p? p.name : "a rival star";
}
/* chemistry, feud penalties, muse bonuses, contract decrees — run at greenlight */
function applyGreenlightRelationships(p){
  G.chem=G.chem||{}; G.feuds=G.feuds||[];
  const cast=p.cast||[], dir=p.director;
  const crew=[dir, p.writer, p.producer].concat(cast).filter(Boolean);
  // multi-picture deals: creative-control fights first, then burn a film off the deal
  const fighters=crew.filter(t=>t.multiDeal);
  fighters.forEach(t=>{
    if((t.kind==="writer"||t.kind==="director") && chance(0.35)){
      p.script=clamp(p.script+5,5,99); p.phaseLen.pre+=1;
      log("📜 Creative control: "+t.name+" forces a page-one rewrite on \""+p.title+"\" (+5 script, +1 wk pre-production).","");
    }else if(t.kind==="actor" && p.rating==="R" && chance(0.4)){
      p.rating="PG-13";
      log("📜 Creative control: "+t.name+" (contracted) forces \""+p.title+"\" to a PG-13 cut.","");
    }
  });
  fighters.forEach(t=>{ t.multiDeal.left--; if(t.multiDeal.left<=0){ t.multiDeal=null; log("📜 "+t.name+"'s multi-picture deal has wrapped.",""); } });
  // cast pair chemistry / feuds
  for(let i=0;i<cast.length;i++) for(let j=i+1;j<cast.length;j++){
    const a=cast[i], b=cast[j], k=pairKey(a.id,b.id);
    if((G.feuds||[]).includes(k)){
      p.script=clamp(p.script-5,5,99); p.buzzBonus=(p.buzzBonus||0)-0.06; p.feudSet=true;
      log("⚔️ "+a.name+" and "+b.name+" are still feuding — the set is icy (script −5, buzz −6%).","bad");
    }else{
      G.chem[k]=(G.chem[k]||0)+1;
      if(G.chem[k]>=2){
        const bump=0.04*Math.min(3,G.chem[k]-1);
        p.buzzBonus=(p.buzzBonus||0)+bump;
        log("🤝 "+a.name+" & "+b.name+" reunite (chemistry ×"+G.chem[k]+") — buzz +"+Math.round(bump*100)+"%.","");
      }
    }
  }
  // fresh feuds: two big stars, no chemistry, hot sets (v28: a Talent Wrangler producer keeps the set calm)
  const calmProd = p.producer && (talentAbility(p.producer)||{}).calm;
  for(let i=0;i<cast.length;i++) for(let j=i+1;j<cast.length;j++){
    const a=cast[i], b=cast[j], k=pairKey(a.id,b.id);
    if(a.power>=4 && b.power>=4 && (G.chem[k]||0)<2 && !(G.feuds||[]).includes(k) && chance(calmProd?0.07:0.15)){
      G.feuds.push(k);
      log("⚔️ A tabloid feud erupts between "+a.name+" and "+b.name+" on the \""+p.title+"\" set — never cast them together."+(calmProd?" (Your producer half-contained it.)":""),"bad");
    }
  }
  // muse director: 3+ films together names them your muse for that genre
  if(dir){
    dir.museCount=(dir.museCount||0)+1;
    if(dir.museCount>=3 && !dir.museGenre){
      dir.museGenre=p.genre;
      log("🪄 "+dir.museCount+" films together — the trade papers now call "+dir.name+" your "+DATA.genreOf(p.genre).name+" muse.","gold");
    }else if(dir.museGenre===p.genre){
      p.buzzBonus=(p.buzzBonus||0)+0.05;
    }
  }
}
/* ── v9: Walk of Fame — big wins carve a star's place on the sidewalk ── */
function grantWalkOfFame(f, why){
  const honored=[f.director].concat(f.cast||[]).filter(Boolean);
  const names=[];
  honored.forEach(t=>{
    if(t.wof || !Number.isFinite(t.heat)) return;
    t.wof=true; t.heat=Math.min(3,t.heat+1); names.push(t.name);
  });
  if(names.length) log("🚶 Walk of Fame: "+names.join(", ")+(names.length>1?" get their sidewalk stars":" gets a sidewalk star")+" — "+why+" (permanent heat +1).","gold");
}
/* ── v9: below-the-line crew (DP, composer, VFX house) ── */
function genBTLCandidate(role){
  const skill=clamp(rint(50,92)+rint(-5,5),40,97);
  const traits={
    dp:["Anamorphic eye","Night-shoot specialist","Oscar-nominated lens","Steadicam poet"],
    composer:["Oscar-winning score","Synth minimalist","Theme-song hitmaker","Orchestral romantic"],
    vfx:["Photoreal renders","Practical-first shop","Volume-stage wizards","Invisible-effects ace"]};
  const fees={dp:[2,6,14], composer:[1.5,5,12], vfx:[3,8,18]};
  const band=skill>80?2:skill>62?1:0;
  return { id:nid(), role, name:talentName("director"), skill, trait:pick(traits[role]),
    fee:fees[role][band], salary:Math.round((0.08+band*0.12)*10)/10 };
}
function seedBTL(){
  G.btl={dp:null, composer:null, vfx:null};
  G.btlMarket={};
  ["dp","composer","vfx"].forEach(r=>{ G.btlMarket[r]=[genBTLCandidate(r),genBTLCandidate(r),genBTLCandidate(r)]; });
}
function btlSeedIfMissing(){ if(!G.btl || !G.btlMarket) seedBTL(); }
function hireBTL(role, id){
  btlSeedIfMissing();
  const cand=(G.btlMarket[role]||[]).find(c=>c.id===id); if(!cand || G.btl[role]) return false;
  if(G.studio.cash<cand.fee){ log("💸 Signing the "+cand.trait+" team takes "+fmtM(cand.fee)+".","bad"); return false; }
  spend("talent", cand.fee);
  G.btl[role]=cand;
  G.btlMarket[role]=G.btlMarket[role].filter(c=>c.id!==id);
  const roleNames={dp:"cinematographer",composer:"composer",vfx:"VFX house"};
  log("🎥 Hired "+cand.name+" as your "+roleNames[role]+" — "+cand.trait+", skill "+cand.skill+" ("+fmtM(cand.fee)+" signing, "+fmtM(cand.salary)+"/wk).","gold");
  saveGame(); return true;
}
function fireBTL(role){
  btlSeedIfMissing();
  const c=G.btl[role]; if(!c) return false;
  G.btl[role]=null;
  G.btlMarket[role].push(c);
  log("🎥 "+c.name+" is off the lot (severance "+fmtM(c.salary*8)+").","");
  spend("talent", c.salary*8);
  saveGame(); return true;
}
function actorFee(t){
  if(!t) return 0;
  const scandalDiscount = t.scandal>0? 0.55 : 1;
  let f = t.fee * (1+0.25*(t.heat||0)) * scandalDiscount;
  if(t.multiDeal) f *= (1-(t.multiDeal.disc||0.25)); // v9 multi-picture deal discount
  f *= contractMult(t); // talent deals cut the quote
  if(G.upgrades.agency) f*=0.85;
  if(t.pics>=2) f*=0.9;
  if(G.wrapDeal>0) f*=0.8;
  if(G.agencyExcl>G.week) f*=0.85;
  if(G.execs && (G.execs.casting || G.execs.cast)){ const cs=execObj(G.execs.casting?"casting":"cast"); f*=1-0.10*lvlMult(cs); }   // v14: a leveled casting head negotiates harder
  // v5: holding an exclusive with their agency cuts the quote (WME/CAA-style)
  if(t.agency && G.agencyDeals && G.agencyDeals[t.agency]>G.week){
    const ag = DATA.agency ? DATA.agency(t.agency) : null;
    f *= 1-(ag? ag.disc||0.15 : 0.15);
  }
  // v5: wage inflation — talent compound faster than the market
  f *= (G.wageInfl||1);
  return Math.round(f*10)/10;
}

/* ── talent contracts & relationships ──
   Deals live on t.contract (absent = single picture). Old saves just lack the
   field, so no migration is needed — every read guards for it. Chemistry
   (t.chem) accrues between co-stars; a reunion (+2% buzz) is logged, never silent. */
function contractDefs(){
  return [
    {id:"multi", name:"Multi-picture", icon:"🎬", cost:4, desc:"3 pictures, fees ×0.85. Counts down per greenlight."},
    {id:"exclusive", name:"Exclusive", icon:"🔒", cost:8, desc:"2 years, fees ×0.8, cannot be poached."},
    {id:"backend", name:"Backend", icon:"💰", cost:0, desc:"Upfront ×0.7, plus 2% of studio rentals at settlement."},
    {id:"bonus", name:"Bonus-based", icon:"🎯", cost:0, desc:"Upfront ×0.9, +$6M if the film beats breakeven."},
    {id:"franchise", name:"Franchise", icon:"🏰", cost:0, desc:"Fees ×0.8 for proven franchise faces (1+ franchise film)."},
  ];
}
function contractMult(t){
  const c=t&&t.contract; if(!c) return 1;
  if(c.type==="multi") return 0.85;
  if(c.type==="exclusive") return 0.8;
  if(c.type==="backend") return 0.7;
  if(c.type==="bonus") return 0.9;
  if(c.type==="franchise") return 0.8;
  return 1;
}
function signContract(tid, type){
  const t=G.talent.find(x=>x.id===+tid); if(!t) return false;
  const def=contractDefs().find(d=>d.id===type); if(!def) return false;
  if(t.contract) return false;
  if(type==="franchise" && !talentFilmsEngine(t).some(f=>f.franchiseName)){ log("🏰 Franchise deals need a proven franchise face.","bad"); return false; }
  if(G.studio.cash<def.cost){ log("💸 A "+def.name.toLowerCase()+" deal costs "+fmtM(def.cost)+".","bad"); return false; }
  spend("studio", def.cost);
  t.contract={type, week:G.week,
    filmsLeft:type==="multi"?3:null,
    weeksLeft:type==="exclusive"?104:null,
    until:type==="exclusive"?G.week+104:null};
  log(def.icon+" "+t.name+" signed a "+def.name.toLowerCase()+" deal (−"+fmtM(def.cost)+"). "+def.desc,"gold");
  if(type==="exclusive") log("📰 STAR SIGNS EXCLUSIVE DEAL: "+t.name+" is off the market for 2 years — rivals react.","gold");
  saveGame(); return true;
}
function talentFilmsEngine(t){
  try{ return (G.films||[]).filter(f=>((f.cast||[]).some(c=>c&&c.id===t.id))||(f.director&&f.director.id===t.id)||(f.writer&&f.writer.id===t.id)||(f.producer&&f.producer.id===t.id)); }
  catch(e){ return []; }
}
function tickContracts(){
  for(const t of (G.talent||[])){
    const c=t.contract; if(!c) continue;
    // Weekly decrement for weeksLeft (all contract types)
    if(c.weeksLeft!==null && c.weeksLeft!==undefined){
      c.weeksLeft--;
      if(c.weeksLeft <= 0){
        t.contract=null;
        log("🔓 "+t.name+"'s contract lapsed (time elapsed) — back on the open market.","");
        continue;
      }
    }
    // Exclusive expiry by time (backward compatibility)
    if(c.type==="exclusive" && c.until && G.week>=c.until){
      t.contract=null;
      log("🔓 "+t.name+"'s exclusive lapsed — back on the open market.","");
    }
  }
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
  const a=talentAbility(t);
  let w = weeks||DATA.CAREER.scandalCooldown;
  if(a && a.scandal) w *= 2;   // v28: Tabloid Magnet lives in the feed
  t.scandal = (t.scandal||0) + w;
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
  const a = pick(T.a);
  const pre = T.p && chance(.35) && !/^the\s/i.test(a)? pick(T.p)+" " : ""; // QA: no "The The …"
  return pre+a+" "+pick(T.b);
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
  let script = clamp(rint(50,84) + (hot?8:0) + rint(-4,6), 42, 94);
  try{ const rs=repScores(); if(rs.genre>=55&&genre===Object.keys(DATA.GENRES).find(g=>(DATA.GENRES[g].name||"")===rs.genreName)) script=clamp(script+3,42,96); }catch(e){}
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
  /* v28: abilities reshape fit math — Genre Shapeshifter counts as fit, Genre Savant doubles the fit bonus */
  const dAb=talentAbility(p.director);
  const dirFit = p.director ? ((p.director.genreFit===p.genre) || !!(dAb&&dAb.fitAll)) : false;
  const dirScore = p.director ? p.director.skill*(dirFit? ((dAb&&dAb.fitX2)?1.2:1.1) : 0.95) : 55;
  const castFitBonus = (p.cast||[]).some(c=>{ const a=talentAbility(c); return a&&a.fitAll; })? 3 : 0;
  // v5 AI: a synthetic cast acts at a fixed, slightly-off level
  const castScore = p.aiCast ? (DATA.AI? DATA.AI.castSkill:58)
                    : p.cast.length? p.cast.reduce((s,c)=>s+c.skill,0)/p.cast.length : 52;
  const pv = clamp(p.budget/neededBudget(p.genre,p.scale), .55, 1.12);
  let prodScore = 52 + 48*pv;
  if(p.producer) prodScore += clamp((p.producer.skill-55)/6, -3, 7);
  let craft = 0.30*scriptScoreOf(p) + 0.24*dirScore + 0.22*castScore + 0.24*prodScore;
  if(G.upgrades.vfx && p.scale==="tentpole") craft += 3;
  if(hqOwned("anim") && (p.genre==="animation"||p.genre==="fantasy")) craft += 2;
  if(techDone("cameras") && p.scale==="tentpole") craft += 2;
  if(techDone("cgi") && (p.genre==="scifi"||p.genre==="fantasy")) craft += 2;
  if(p.aiScript) craft -= (DATA.AI? DATA.AI.scrQualityPenalty:4);   // v5: the algorithm has no soul
  if(p.director && p.director.auteur) craft += 5;
  const fat = fatigueOfName(p.franchiseName);
  if(fat>0) craft -= fat/DATA.FATIGUE.max * DATA.FATIGUE.qualityHit;
  /* v28: talent ability craft points + genre×theme affinity (love +5 / clash −4) */
  const abSum=projectAbilities(p);
  craft += abSum.overall + castFitBonus;
  if(p.theme){
    const mood=DATA.comboOf(p.genre,p.theme);
    if(mood==="love") craft+=5;
    if(mood==="clash") craft-=4;
  }
  craft += gauss()*5.5;
  const overall = clamp(Math.round(craft), 8, 97);
  const rate = DATA.rating ? DATA.rating(p.rating) : null;
  let criticBias = g.critic + abSum.critic + (rate?rate.critic:0);
  if(!rate){
    if(p.rating==="R") criticBias += 4;
    if(p.foreignLang) criticBias += 3;
  } else {
    if(p.foreignLang) criticBias += 3;
  }
  const critic = clamp(Math.round(overall + criticBias + gauss()*3), 5, 99);
  let audRaw = overall + g.aud + abSum.aud + Math.min(p.cast.reduce((s,c)=>s+c.power,0),8)*1.2 + gauss()*3;
  if(p.aiCast) audRaw -= (DATA.AI? DATA.AI.audPenalty:9);          // v5: audiences smell the pixels
  // v9: budget allocation emphasis + below-the-line crew lean on the split
  let alAud=0, alCrit=0;
  const al=p.alloc;
  if(al){
    const spec=["scifi","fantasy","action","animation"].includes(p.genre);
    alAud += (spec?0.28:-0.06)*(al.vfx-20);
    alAud += 0.22*((["action","war","sports","horror"].includes(p.genre))?1:0.5)*(al.stunts-20);
    alAud += 0.10*(al.cast-20);
    alCrit += 0.15*(al.music-20) + 0.12*(al.design-20) - 0.05*Math.max(0,al.vfx-20);
  }
  if(G.btl){
    if(G.btl.dp) alAud += G.btl.dp.skill/25*lvlMult(G.btl.dp);
    if(G.btl.composer){ alCrit += G.btl.composer.skill/22*lvlMult(G.btl.composer); if((G.btl.composer.trait||"").includes("Oscar")) alCrit+=2; }
    if(G.btl.vfx && ["scifi","fantasy","action","animation"].includes(p.genre)) alAud += G.btl.vfx.skill/30*lvlMult(G.btl.vfx);
  }
  const aud    = clamp(Math.round(audRaw + alAud), 5, 99);
  const critic2 = clamp(Math.round(critic + alCrit), 5, 99);
  return { overall: clamp(Math.round((overall+critic2+aud)/3), 8, 98), critic: critic2, aud };
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
    // category card: each axis reuses the film's own inputs, pulled to the verdict
    const wBonus=(f.writer&&typeof writerBonus==="function")?writerBonus(f.writer,f.genre):0;
    const dirS=f.director?f.director.skill+((f.director.genreFit===f.genre)?6:0):55;
    const castS=(f.cast&&f.cast.length)?f.cast.reduce((a,x)=>a+x.skill,0)/f.cast.length:52;
    const fundS=52+48*clamp(f.budget/Math.max(1,(typeof neededBudget==="function")?neededBudget(f.genre,f.scale):f.budget),0.55,1.12);
    const blend=(b)=>clamp(Math.round(b*0.5+s*0.5+gauss()*4),3,100);
    const cats={story:blend(55+wBonus*2), direction:blend(dirS), acting:blend(castS),
      production:blend(fundS), entertainment:blend(f.quality.aud),
      originality:blend(70-(f.sequelOf?15:0)-(f.franchiseName?5:0)+(f.hot?5:0))};
    const sentiment=s>=68?"positive":s>=45?"mixed":"negative";
    panel.push({ id:c.id, name:c.name, outlet:c.outlet, score:s, quote:quoteFor(s), cats, sentiment });
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
/* ── dynamic industry economy: six bounded, mean-reverting indices ──
   theater/stream/adcost/prod/intl drift ±0.04/yr toward 1.0 inside hard clamps.
   Wages compound 2–4%/yr (same ~3% mean as before). Every hook multiplies an
   existing formula symmetrically — no new money, no runaways. */
function econState(){
  G.econ=G.econ||{theater:1, stream:1, adcost:1, prod:1, intl:1};
  return G.econ;
}
function econM(id){
  try{ const v=econState()[id]; return Number.isFinite(v)?v:1; }
  catch(e){ return 1; }
}
function econDrift(){
  const e=econState();
  const ranges={theater:[0.8,1.2], stream:[0.8,1.3], adcost:[0.9,1.3], prod:[0.95,1.25], intl:[0.9,1.2]};
  const notes=[];
  for(const k in ranges){
    const [lo,hi]=ranges[k];
    const next=clamp(e[k]+(1-e[k])*0.25+gauss()*0.02,lo,hi);
    const d=next-e[k];
    e[k]=Math.round(next*1000)/1000;
    if(Math.abs(d)>=0.03) notes.push(k+" "+(d>0?"up":"down"));
  }
  G.econHist=G.econHist||[];
  G.econHist.push({year:yearOf(G.week), theater:e.theater, stream:e.stream, adcost:e.adcost, prod:e.prod, intl:e.intl, wage:G.wageInfl});
  if(G.econHist.length>12) G.econHist.shift();
  if(notes.length) log("🏭 Industry shifts: "+notes.join(", ")+" — see the Industry Report.","");
  else log("🏭 Industry steady: costs, crowds and streamers near baseline.","");
}
function recMarketing(p){ return Math.round(p.budget*DATA.SCALES[p.scale].mktRate * (p.imax||p.premium?(techDone("premium")?1.04:1.08):1) * (G.infl||1) * econM("adcost")); }
/* ── living industry: timeline + state derived from real history ──
   No new simulation, no new state — every row below already happened. */
function industryTimeline(){
  const ev=[];
  try{
    ev.push({week:1, icon:"🎬", text:"\""+G.studio.name+"\" founded."});
    (G.films||[]).forEach(f=>{ if(!f.ww) return;
      let be=0; try{ be=breakevenWW(f); }catch(e){}
      if(f.ww>=be*1.6) ev.push({week:f.releaseWeek||1, icon:"💥", text:"\""+f.title+"\" smash ("+fmtG(f.ww)+" WW)."});
      else if(f.ww<be*0.55&&be>0) ev.push({week:f.releaseWeek||1, icon:"📉", text:"\""+f.title+"\" flops."});
    });
    (G.franchises||[]).forEach(fr=>{ ev.push({week:fr.built||1, icon:"🏰", text:"\""+fr.name+"\" becomes a franchise."}); });
    (G.universes||[]).forEach(u=>{ ev.push({week:u.founded||1, icon:"🌌", text:"Universe \""+u.name+"\" woven."}); });
    if(G.streamer) ev.push({week:G.streamer.launchedWeek||1, icon:"📱", text:"Streamer \""+G.streamer.name+"\" launches."});
    if(G.ipoYear) ev.push({week:(G.ipoYear-1)*52+1, icon:"🔔", text:"IPO raises $400M."});
    (G.stats.awards||[]).forEach(a=>{ ev.push({week:(a.year-1)*52+1, icon:"🏆", text:a.cat+" — \""+a.film+"\"."}); });
    (G.eventHist||[]).slice(0,10).forEach(e=>{ ev.push({week:e.week, icon:"📜", text:e.title}); });
  }catch(e){}
  return ev.filter(e=>e.week>0).sort((a,b)=>a.week-b.week).slice(-30);
}
function industryState(){
  const films=(G.films||[]);
  const ytd=films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0);
  let hot="—", hv=0, cold="—", cv=99;
  try{ for(const g of Object.keys(DATA.GENRES)){ const v=trendOf(g); if(v>hv){hv=v;hot=DATA.GENRES[g].name;} if(v<cv){cv=v;cold=DATA.GENRES[g].name;} } }catch(e){}
  const live=films.filter(f=>f.inTheaters).length;
  const rLive=(G.rivals||[]).reduce((a,r)=>a+(r.slate||[]).filter(f=>f.live).length,0);
  const hotAgents=(G.talent||[]).filter(t=>!t.bookedUntil&&(t.heat||0)>=2).length;
  const aud10=films.slice(-10).filter(f=>f.quality);
  const aud=aud10.length?Math.round(aud10.reduce((a,f)=>a+audienceScoreOf(f),0)/aud10.length):0;
  const platN=(typeof DATA.allPlatforms==="function"?DATA.allPlatforms():DATA.PLATFORMS).length;
  const techN=(G.tech&&G.tech.done)?Object.keys(G.tech.done).length:0;
  return [
    ["🌡️ Market", hot+" "+hv.toFixed(2)+"× · cold "+cold+" "+cv.toFixed(2)+"×"],
    ["⚔ Competition", (G.rivals||[]).length+" rivals · "+rLive+" live vs your "+live],
    ["🌟 Talent", (G.talent||[]).length+" pros · "+hotAgents+" hot free agents"],
    ["🎬 Box office", fmtM(ytd)+" YTD · best "+(G.stats.bestOpen?fmtG(G.stats.bestOpen):"—")],
    ["📱 Streaming", (G.streamer?G.streamer.subs.toFixed(1)+"M subs · ":"")+platN+" platforms bidding"],
    ["🏆 Awards", ((G.precursorWins||{}).count||0)+" precursors · "+(G.stats.awards||[]).length+" Reels"],
    ["🏭 Economy", "prices +"+Math.round(((G.infl||1)-1)*100)+"% · wages +"+Math.round(((G.wageInfl||1)-1)*100)+"%"],
    ["🔬 Technology", techN+" researched"+(G.tech&&G.tech.active?" · 1 in lab":"")],
    ["👥 Audience", aud?aud+"/100 recent pulse":"no releases yet"],
  ];
}

/* ── marketing campaigns: channel buys locked at dating, paid via P&A ──
   hype/awareness ride existing expectedOpening knobs; legs rides campaignLegs.
   Costs scale with picture size. State lives on p.campaigns (saved, no schema). */
function campaignDefs(){
  /* v13 (§17): drop = weeks before release when the channel's drop fires;
     channels with several offsets split their effect across those drops. */
  return [
    {id:"teaser", icon:"📼", name:"Teaser drop", cost:2, reach:30, hype:0.02, aware:0.01, legs:0.02, drop:[5], demos:["fans","teens"], desc:"First look. Cheap spark for the faithful."},
    {id:"trailer", icon:"🎞", name:"Trailer blitz", cost:5, reach:60, hype:0.04, aware:0.03, legs:0.03, drop:[3], demos:["adults","teens"], desc:"The main sell — theaters, TV, pre-rolls everywhere."},
    {id:"tv", icon:"📺", name:"TV spots", cost:9, reach:75, hype:0.06, aware:0.04, legs:0.02, drop:[2], demos:["adults","prestige"], desc:"Broadcast carpet-bomb. Reaches non-chronically-online humans."},
    {id:"social", icon:"📱", name:"Social machine", cost:3, reach:55, hype:0.05, aware:0.02, legs:0.05, drop:[5,3,1], demos:["teens","fans"], desc:"Always-on content. Word of mouth that compounds into legs."},
    {id:"outdoor", icon:"🪧", name:"Outdoor", cost:4, reach:40, hype:0.03, aware:0.03, legs:0.01, drop:[4], demos:["adults","kids"], desc:"Billboards and bus wraps. Pure awareness wallpaper."},
    {id:"influencer", icon:"🤳", name:"Influencer tour", cost:4, reach:50, hype:0.04, aware:0.02, legs:0.06, drop:[2], demos:["teens","fans"], desc:"Creators sell the vibe. Best long-tail per dollar."},
    {id:"intl", icon:"🌍", name:"International push", cost:6, reach:65, hype:0.03, aware:0.02, legs:0.03, drop:[2], demos:["adults","fans"], desc:"Dubbed trailers, regional premieres. Travels well."},
    {id:"premium", icon:"👑", name:"Premium event", cost:12, reach:90, hype:0.08, aware:0.05, legs:0.04, drop:[1], demos:["fans","adults"], desc:"Premieres, IMAX fan events, saturation. Event-ize it."},
  ];
}
function campaignDef(id){ return campaignDefs().find(c=>c.id===id) || null; }
function campaignScaleMult(scale){ return scale==="tentpole"?1.6 : scale==="indie"?0.6 : 1; }
function campaignCost(id, scale){ const c=campaignDef(id); return c? Math.round(c.cost*campaignScaleMult(scale)*10)/10 : 0; }
function campaignPlans(){
  return [
    {id:"blitz", name:"Blockbuster blitz", desc:"Everything, everywhere.", picks:["teaser","trailer","tv","social","outdoor","influencer","intl","premium"]},
    {id:"sleeper", name:"Sleeper build", desc:"Slow burn, strong legs.", picks:["teaser","trailer","social"]},
    {id:"prestige", name:"Prestige platform", desc:"Reviews + awareness.", picks:["trailer","social","outdoor","intl"]},
    {id:"viral", name:"Cheap & viral", desc:"Maximum buzz per dollar.", picks:["teaser","social","influencer"]},
  ];
}
/* Re-appliable: backs out the previously applied totals before adding the new mix. */
/* ═══════════ campaign sequence (v13): staggered drops with reception events ═══════════
   Channels no longer apply all at once at scheduling: each drop fires on its
   own week before release, rolls a reception event (viral / solid / whiff) and
   applies its slice of the channel's effect. Totals stay close to the old flat
   application; the reception roll adds variance and the log tells the story.
   Because awareness/buzz arrive as drops land, the advance curve builds too. */
function dropWeeks(c){ return (c&&c.drop&&c.drop.length)? c.drop : [2]; }
function dropDemoTop(p){
  let topDemo=null;
  try{ topDemo=demoProfile(p).strongest.id; }catch(e){}
  return topDemo;
}
function applyDrop(p, c, topDemo, compressed){
  const share=1/dropWeeks(c).length;
  const hit=topDemo&&(c.demos||[]).includes(topDemo);   // right message, right crowd
  let mult=1, kind="solid";
  if(!compressed){
    const roll=rnd();
    if(roll<0.18+(hit?0.10:0)){ mult=1.5; kind="viral"; }
    else if(roll>0.85){ mult=0.5; kind="whiff"; }
  }
  const bz=Math.round(c.hype*share*mult*(hit?1.5:1)*100)/100;
  const aw=Math.round(c.aware*share*mult*100)/100;
  p.buzzBonus=Math.round(((p.buzzBonus||0)+bz)*100)/100;
  p.awareness=Math.round(((p.awareness||0)+aw)*100)/100;
  p.campaignLegs=Math.round(((p.campaignLegs||0)+c.legs*share)*100)/100;
  return {kind, bz, aw, hit};
}
function tickCampaignDrops(){
  for(const p of G.projects){
    if(!p.releaseWeek || p.phase!=="ready" || p.releaseWeek<=G.week) continue;
    const weeksOut=p.releaseWeek-G.week;
    if(!p.dropped) p.dropped={};
    const topDemo=dropDemoTop(p);
    (p.campaigns||[]).forEach(id=>{
      const c=campaignDef(id); if(!c) return;
      dropWeeks(c).forEach(off=>{
        if(weeksOut>off || p.dropped[id+":"+off]) return;
        p.dropped[id+":"+off]=true;
        const r=applyDrop(p, c, topDemo, false);
        p.dropEvents=(p.dropEvents||[]).concat([{camp:id, w:G.week, kind:r.kind}]);
        const label=c.icon+" "+c.name+" for \""+p.title+"\"";
        const delta=" ("+(r.bz>=0?"+":"")+Math.round(r.bz*100)+"% buzz)";
        if(r.kind==="viral") log("🚀 "+label+" went VIRAL — shares everywhere "+delta+".","gold");
        else if(r.kind==="whiff") log("💩 "+label+" whiffed — the discourse shrugged "+delta+".","bad");
        else log("🎞 "+label+" landed "+delta+".","");
      });
    });
  }
}
/* drops that never got their week (film dated and released in one hop) fire
   compressed at release — the money's spent, the effect shouldn't vanish */
function firePendingDrops(p){
  if(!p.dropped) p.dropped={};
  const topDemo=dropDemoTop(p);
  (p.campaigns||[]).forEach(id=>{
    const c=campaignDef(id); if(!c) return;
    dropWeeks(c).forEach(off=>{
      if(p.dropped[id+":"+off]) return;
      p.dropped[id+":"+off]=true;
      applyDrop(p, c, topDemo, true);
    });
  });
}

/* ── promo obligations (§21): stars owe press; contract faces owe more ──
   Cast owe promo appearances while their film is dated; one fires per week
   pre-release. A scandal-hit or toxic cast turns them into liabilities. */
function promoOwedFor(cast){
  const starP=(cast||[]).reduce((s,c)=>s+(c.power||0),0);
  return Math.min(6, (cast||[]).length + (starP>=6?2:starP>=3?1:0) +
    ((cast||[]).some(c=>c.contract&&(c.contract.type==="exclusive"||c.contract.type==="multi"))?1:0));
}
function tickPromos(){
  for(const p of G.projects){
    if(!p.releaseWeek || p.phase!=="ready" || p.releaseWeek<=G.week) continue;
    const owed=p.promoOwed||0;
    if(!owed || (p.promoDone||0)>=owed) continue;
    const scandalous=(p.cast||[]).filter(c=>c&&(c.scandal>0||(c.toxic&&!c.rehabbed)));
    const face=(p.cast||[]).slice().sort((a,b)=>(b.power||0)-(a.power||0))[0];
    p.promoDone=(p.promoDone||0)+1;
    if(scandalous.length){
      p.buzzBonus=Math.round(((p.buzzBonus||0)-0.01)*100)/100;
      log("📰 "+scandalous[0].name+"'s promo stop for \""+p.title+"\" became a scandal segment (−1% buzz).","bad");
      p.promoEvents=(p.promoEvents||[]).concat([{w:G.week, kind:"backfire"}]);
    }else{
      p.buzzBonus=Math.round(((p.buzzBonus||0)+0.015)*100)/100;
      log("🎤 "+(face?face.name:"The cast")+" works the talk shows for \""+p.title+"\" (+1.5% buzz).","");
      p.promoEvents=(p.promoEvents||[]).concat([{w:G.week, kind:"hit"}]);
    }
  }
}

/* ── trending board (§18): hashtags derived from real state, read-only ──
   Every tag names the state that put it there; heat ranks the board. */
function trendingBoard(){
  const tags=[];
  const push=(tag, plat, why, heat)=>{ if(tag&&tag.length>1&&plat) tags.push({tag, plat, why, heat:heat||1}); };
  const hash=s=>"#"+String(s||"").replace(/[^A-Za-z0-9]/g,"");
  let leader=null, lg=0;
  (G.films||[]).forEach(f=>{ if(f.inTheaters){ const g=(f.weekly&&f.weekly.length)?f.weekly[f.weekly.length-1].gross:0; if(g>lg){ leader=f; lg=g; } } });
  if(leader) push(hash(leader.title), "CineTok", "charting at #1 this week", 3);
  (G.films||[]).forEach(f=>{
    const s=f.social;
    if(f.buzzBig) push(hash(f.title)+"Challenge", "CineTok", "the opening was that big", 2);
    if(s&&s.memes) push(hash(f.title), "Reelit", "meme machine — theories everywhere", 2);
    if(s&&s.acclaimFlag) push(hash(f.title), "Reelit", "critics can't leave it alone", 2);
    if(f.reviewBombed) push(hash(f.title)+"Gate", "Reelit", "the pile-on is the story", 2);
    const sc=(f.cast||[]).find(c=>c&&c.scandal>0);
    if(sc) push(hash(sc.name)+"Gate", "Blabber", sc.name+"'s scandal is drowning the press tour", 3);
  });
  (G.feuds||[]).forEach(k=>{
    const ids=String(k).split("-");
    const a=G.talent.find(t=>String(t.id)===ids[0]), b=G.talent.find(t=>String(t.id)===ids[1]);
    if(a&&b) push(hash(a.name)+"Vs"+hash(b.name), "Blabber", "the feud is still live", 2);
  });
  try{
    const hot=Object.keys(DATA.GENRES).map(g=>({g, t:trendOf(g)})).sort((a,b)=>b.t-a.t)[0];
    if(hot&&hot.t>=1.10) push(hash(hot.g)+"Szn", "CineTok", "the genre is running hot ("+hot.t.toFixed(2)+"×)", 1);
  }catch(e){}
  (G.projects||[]).forEach(p=>{ if(p.releaseWeek>G.week && (p.advanceTotal||0)>=1) push(hash(p.title)+"Countdown", "BoxMoji", fmtM(p.advanceTotal)+" in advance sales and counting", 2); });
  (G.retired||[]).slice(-2).forEach(t=>{ if(t&&t.name) push(hash(t.name), "Blabber", "carved a sidewalk star", 1); });
  return tags.sort((a,b)=>b.heat-a.heat).slice(0,6);
}

/* ═══════════ people & business depth (v14) ═══════════
   Board of directors with real votes, executive careers, staff skill levels,
   espionage, legal disputes, the music label — and the what-if fork. */

/* ── board of directors (§44–45): three seats; approval drifts with results ── */
function boardAvg(){
  const b=G.board||[];
  return b.length? Math.round(b.reduce((a,m)=>a+(m.approval||50),0)/b.length) : 50;
}
function boardShift(delta){
  (G.board||[]).forEach(m=>{ m.approval=clamp(Math.round(m.approval+delta*(m.hawk&&delta<0?1.3:1)),5,99); });
}
function boardVote(p){
  const members=G.board||[];
  if(!members.length) return {pass:true, votes:[]};
  const score=(p.quality&&p.quality.overall)||65;
  const votes=members.map(m=>{
    const odds=clamp(0.25 + (m.approval-40)/100 + (score-60)/120 + G.studio.rep/400 + (m.hawk&&(p.budget||0)>200?-0.12:0), 0.05, 0.95);
    return {name:m.name, yes:chance(odds)};
  });
  const yes=votes.filter(v=>v.yes).length;
  return {pass: yes*2>votes.length, votes};
}
function tickBoard(){
  if(G.week%13!==0) return;   // restless money: approvals drift toward 55 when the studio is quiet
  (G.board||[]).forEach(m=>{ m.approval=clamp(Math.round(m.approval+(55-m.approval)*0.1),5,99); });
}

/* ── executive careers (§46): tenure, raise demands, poaching, retirement ── */
function execObj(id){
  const e=G.execs && G.execs[id];
  if(e && typeof e==="object") return e;
  if(e) return (G.execs[id]={hired:G.week, tenure:rint(0,52), xp:rint(2,10)});   // legacy boolean save
  return null;
}
function tickExecCareers(){
  DATA.EXECS.forEach(def=>{
    const e=execObj(def.id); if(!e) return;
    e.tenure=(e.tenure||0)+1;
    if(e.tenure>0 && e.tenure%104===0){   // raise demand every ~2 years
      const ask=Math.round(def.salary*1.25*100)/100;
      if(G.studio.cash>=ask*26){ e.salary=ask; log("👔 "+def.name+" renegotiated — salary now "+fmtM(ask)+"/wk. Worth it: they stay.",""); }
      else if(chance(0.5)){ delete G.execs[def.id]; log("👔 "+def.name+" walked — the studio wouldn't match the raise. The effect is gone.","bad"); }
      else log("👔 "+def.name+" grumbled about pay but stayed. For now.","");
    }
    if(chance(0.002+((e.xp||0)>=12?0.002:0)) && (G.rivals||[]).length){
      const r=pick(G.rivals);
      delete G.execs[def.id];
      log("🕵 "+def.name+" was poached by "+r.name+" — a rival just got sharper.","bad");
    }
    if(e.tenure>=312 && chance(0.06)){
      delete G.execs[def.id];
      log("🎖 "+def.name+" retired after "+Math.round(e.tenure/52)+" years of service — a legend leaves the lot.","");
    }
  });
}

/* ── staff skill levels (§47): crew and execs level up from shipped work ── */
function levelOf(x){ return clamp(1+Math.floor(((x&&(x.xp||0))||0)/4), 1, 5); }
function lvlMult(x){ return 1+(levelOf(x)-1)*0.15; }

/* ── espionage (§42): rivals play dirty; you can buy intel ── */
function tickEspionage(){
  if(!G.rivals || !G.rivals.length) return;
  const dated=(G.projects||[]).filter(p=>p.kind==="film"&&p.releaseWeek>G.week);
  if(dated.length && chance(0.02)){   // a rival leaks your tracking to the trades
    const p=pick(dated);
    p.awareness=Math.max(0,(p.awareness||0)-0.05);
    log("🕵 A rival leaked \""+p.title+"\"'s soft tracking to the trades — chatter cooled (−5% awareness).","bad");
  }
  const shooting=(G.projects||[]).filter(p=>p.phase==="shoot");
  if(shooting.length && chance(0.012)){   // a rival's mole shops your script around
    const p=pick(shooting);
    const r=pick(G.rivals);
    r.slate=(r.slate||[]);
    r.slate.push({title:"Untitled "+DATA.GENRES[p.genre].name, genre:p.genre, scale:p.scale, week:G.week+rint(12,40), live:false, dead:false, mole:true});
    log("🕵 Mole alert: a rival got a look at \""+p.title+"\"'s script — they're rushing a similar project.","bad");
  }
}
function buyIntel(name){
  const r=(G.rivals||[]).find(x=>x.name===name); if(!r) return false;
  if(G.studio.cash<8){ log("💸 Buying intel runs $8M — the bagman doesn't do credit.","bad"); return false; }
  spend("other", 8);
  G.intel={name, until:G.week+8};
  const up=(r.slate||[]).filter(f=>!f.dead&&!f.live&&f.week>G.week).sort((a,b)=>a.week-b.week);
  log("🕵 The bagman delivers — "+r.name+"'s next moves: "+(up.length? up.slice(0,4).map(f=>f.title+" ("+DATA.GENRES[f.genre].name+(f.scale?", "+f.scale:"")+", "+dateLabel(f.week)+")").join(" · ") : "nothing dated")+". Intel good for 8 weeks.","gold");
  saveGame(); return true;
}

/* ── legal disputes (§50): fee suits and plagiarism claims ── */
function tickLegal(){
  if(G.pendingChoice || G.over) return;
  if(!chance(0.02)) return;
  if(rnd()<0.5){
    const films=G.films.filter(f=>(f.cast||[]).length&&(f.ww||0)>=30);
    const f=films.length?pick(films):null; if(!f) return;
    const star=pick(f.cast); if(!star) return;
    const settle=Math.round(Math.max(4,(f.ww||0)*0.01)*10)/10;
    G.pendingChoice={ icon:"⚖", title:"Legal dispute — "+star.name+" v. "+G.studio.name,
      text:"\""+star.name+"\" claims "+fmtM(settle)+" in unpaid backend on \""+f.title+"\". Settle quietly, or fight it in court.",
      choices:[{label:"🤝 Settle — "+fmtM(settle)},{label:"⚔ Fight it in court"}] };
    G._evtRun=[
      {label:"settle", run:()=>{ spend("other", settle); log("⚖ Settled with "+star.name+" for "+fmtM(settle)+" — the trade papers never heard a word.",""); }},
      {label:"fight", run:()=>{ if(chance(0.45+G.studio.rep/300)){ log("⚖ The court sided with the studio — the claim is dismissed. Rep intact.","good"); } else { const hit=Math.round(settle*2*10)/10; spend("other", hit); G.studio.rep=clamp(G.studio.rep-3,5,99); log("⚖ Lost in court: "+fmtM(hit)+" awarded plus legal bills — and the story ran for a week (−3 rep).","bad"); } }}
    ];
  }else{
    let hit=null;
    try{ hit=G.films.filter(f=>(f.ww||0)>=breakevenWW(f)*1.5).slice(-1)[0]; }catch(e){}
    const rival=(G.rivals||[]).length?pick(G.rivals):null;
    if(!hit||!rival) return;
    const stake=Math.round(Math.max(5,(hit.ww||0)*0.02)*10)/10;
    G.pendingChoice={ icon:"⚖", title:"Lawsuit — "+rival.name+" claims \""+hit.title+"\" stole their idea",
      text:rival.name+" says \""+hit.title+"\" is their shelved script with the serial numbers filed off. They want "+fmtM(stake)+".",
      choices:[{label:"🤝 License the idea — "+fmtM(stake)},{label:"⚔ See them in court"}] };
    G._evtRun=[
      {label:"license", run:()=>{ spend("other", stake); log("⚖ Licensed the contested idea from "+rival.name+" for "+fmtM(stake)+" — everyone saves face.",""); }},
      {label:"fight", run:()=>{ if(chance(0.4+G.studio.rep/300)){ log("⚖ Court found no substantial similarity — dismissed. Free PR, honestly.","good"); G.studio.rep=clamp(G.studio.rep+1,5,99); } else { spend("other", stake); G.studio.rep=clamp(G.studio.rep-2,5,99); log("⚖ Lost the plagiarism suit: "+fmtM(stake)+" damages (−2 rep).","bad"); } }}
    ];
  }
}

/* ── music label division (§32): sign artists, collect weekly, chart spikes ── */
function unlockLabel(){
  if(G.label&&G.label.unlocked) return false;
  if(G.studio.cash<60){ log("💸 Launching the label takes "+fmtM(60)+" of up-front investment.","bad"); return false; }
  spend("studio", 60);
  G.label={unlocked:true, artists:[]};
  log("🎵 The "+G.studio.name+" music label is live — sign artists and soundtrack your own pipeline (+$0.3M/wk overhead).","gold");
  saveGame(); return true;
}
function signArtist(id){
  if(!G.label||!G.label.unlocked) return false;
  G.label.artists=G.label.artists||[];
  if(G.label.artists.length>=3){ log("🎧 The label's roster is full (3 acts) — drop one before signing another.","bad"); return false; }
  const a=(DATA.ARTISTS||[]).find(x=>x.id===id); if(!a||G.label.artists.some(x=>x.id===id)) return false;
  if(G.studio.cash<a.fee){ log("💸 Signing "+a.name+" takes "+fmtM(a.fee)+" (advance + videos).","bad"); return false; }
  spend("talent", a.fee);
  G.label.artists.push({id:a.id, name:a.name, heat:a.heat||1, chartUntil:0, signed:G.week});
  log("🎧 Signed "+a.name+" to the label ("+fmtM(a.fee)+" advance). Their sound pairs with "+a.vibe+".","gold");
  saveGame(); return true;
}
function dropArtist(id){
  if(!G.label) return false;
  const before=(G.label.artists||[]).length;
  G.label.artists=(G.label.artists||[]).filter(x=>x.id!==id);
  if(G.label.artists.length<before){ log("📦 Dropped an act from the roster.",""); saveGame(); return true; }
  return false;
}
function tickLabel(){
  const L=G.label; if(!L||!L.unlocked) return;
  (L.artists||[]).forEach(a=>{
    let inc=0.08+0.14*(a.heat||1);
    if(a.chartUntil>G.week) inc*=3;
    else if(chance(0.035+0.01*(a.heat||1))){
      a.chartUntil=G.week+4;
      log("🎵 "+a.name+" is CHARTING — streaming and sync money ×3 for a month.","gold");
      G.projects.forEach(p=>{ if(p.genre==="musical"||p.genre==="concert") p.buzzBonus=Math.round(((p.buzzBonus||0)+0.02)*100)/100; });
    }
    earn("music", Math.round(inc*10)/10);
  });
}

/* ── what-if sandbox (§56): fork the state, roll forward, report — nothing saved ── */
function whatIf(scenario, weeks){
  const snap=JSON.parse(JSON.stringify(G));
  snap._noSave=true; snap.over=null;
  const real=G;
  let out={ok:false};
  try{
    G=snap;
    G.log=log;   // JSON.stringify drops function refs — rewire the logger on the fork
    const p=G.projects.find(x=>x.kind==="film"&&x.phase==="ready"&&x.releaseWeek>G.week);
    if(p && scenario==="late") p.releaseWeek+=4;
    if(p && scenario==="hype") p.marketing=(p.marketing||0)+Math.round((p.marketing||10)*1.0);
    for(let i=0;i<weeks && !G.over;i++){
      G.pendingChoice=null; G._evtRun=null; G.pendingReport=null;   // a projection never stops to ask
      advanceWeek();
    }
    out={ok:true, cash:G.studio.cash, ww:G.stats.totalWW, rep:G.studio.rep, films:G.stats.films, over:!!G.over};
  }catch(e){ out={ok:false, err:String(e)}; }
  G=real;
  return out;
}

/* ── hall of fame (§57) + async scaffold (§59): records + the past-runs hall ── */
function hallOfFameData(){
  const best=G.films.filter(f=>f.ww>0).sort((a,b)=>b.ww-a.ww).slice(0,5);
  return {
    studio:G.studio.name, seed:G.seed||"—",
    records:{
      bestOpen:G.stats.bestOpen||0, bestFilm:G.stats.bestFilm||"—",
      biggest:(best[0]&&best[0].title)||"—", biggestWW:(best[0]&&best[0].ww)||0,
      awards:(G.stats.awards||[]).length, hits:G.stats.hits||0, flops:G.stats.flops||0,
      stars:(G.retired||[]).length,
    },
    top:best.map(f=>({title:f.title, ww:f.ww, year:f.year})),
    hall:legacyHall(),
  };
}

/* ── fan mail (v15): the audience writes back, driven by real state ──
   Read-only flavor with one small hook: enough love mail on a live film pays
   +1% buzz once. The mailbox keeps the 30 most recent letters. */
function tickFanMail(){
  G.mail=G.mail||[];
  const push=(kind, from, text, film)=>{
    G.mail.unshift({w:G.week, kind, from, text, film:film||null, unread:true});
    if(G.mail.length>30) G.mail.length=30;
  };
  const name=()=>pick(DATA.FAN_NAMES||["A fan"]);
  (G.films||[]).filter(f=>f.inTheaters).forEach(f=>{
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
    const g=(DATA.GENRES[f.genre]||{}).name||f.genre;
    if(aud>=70 && chance(0.30)){
      f.mailLove=(f.mailLove||0)+1;
      push("love", name(), pick([
        "Saw \""+f.title+"\" twice opening weekend. Twice! Whatever you're doing with "+g+", keep doing it.",
        "My whole family saw \""+f.title+"\" — grandma laughed, the kids cheered, I cried a little. Thank you.",
        "Three words: more "+g+" like \""+f.title+"\". Best tickets I've bought in years.",
        "\""+f.title+"\" got me through a rough week. The third act is PERFECT. That's all.",
      ]), f.title);
      if(f.mailLove===3 && !f.mailBuzzed){
        f.mailBuzzed=true;
        f.buzzBonus=Math.round(((f.buzzBonus||0)+0.01)*100)/100;
        log("📬 Fan mail poured in for \""+f.title+"\" — the letterbox is overflowing (+1% buzz).","");
      }
    }
    if(f.reviewBombed && chance(0.4)){
      push("angry", name(), "Your comment sections are a WAR ZONE over \""+f.title+"\". Somebody do something about the brigading!!", f.title);
    }
    const sc=(f.cast||[]).find(c=>c&&c.scandal>0);
    if(sc && chance(0.3)){
      push("scandal", name(), "I don't care what "+sc.name+" did — I buy tickets for the MOVIES. But maybe read the room on the press tour?", f.title);
    }
  });
  (G.franchises||[]).forEach(fr=>{   // hot brands get asked for the next one
    if((fr.decay||0)>=0.9 && chance(0.25)){
      push("demand", name(), pick([
        "It's been a MINUTE since the last "+fr.name+". The group chat is starving. When??",
        "Petition for the next "+fr.name+" entry to start filming YESTERDAY. Signed, everyone I know.",
        "My "+fr.name+" Blu-rays are worn out. Take my money for the next one already.",
      ]), fr.name);
    }
  });
  if(G.streamer && G.streamer.subs>2 && chance(0.3)){
    push("sub", name(), pick([
      G.streamer.name+" is the only app I actually keep renewing. Whatever you're feeding the algorithm, keep feeding it.",
      "Bingeing your library again — three originals deep this month. More like this please.",
      "Cancelled two other streamers, kept "+G.streamer.name+". That's the whole review.",
    ]));
  }
  (G.films||[]).filter(f=>!f.inTheaters&&(f.ww||0)>0).slice(-6).forEach(f=>{
    try{
      if(f.ww<breakevenWW(f)*0.6 && f.releaseWeek>=G.week-8 && chance(0.15)){
        push("angry", name(), "I want my "+((DATA.GENRES[f.genre]||{}).name||"ticket")+" money back for \""+f.title+"\". That ending was a CRIME.", f.title);
      }
    }catch(e){}
  });
}
function unreadMail(){ return (G.mail||[]).filter(m=>m.unread).length; }
function markMailRead(){ (G.mail||[]).forEach(m=>{ m.unread=false; }); saveGame(); }

/* ── game studio (v16): the movie-game division — turn hits & franchises into games ──
   Unlock once, greenlight adaptations (source + developer house), burn weekly
   through development, launch to a review score with a 12-week sales tail.
   A 70+ game re-heats its franchise brand and earns a board nod. */
function unlockGames(){
  if(G.gamesDiv && G.gamesDiv.unlocked) return false;
  if(G.studio.cash<50){ log("💸 Founding the game studio takes "+fmtM(50)+" — engines, licenses, desks.","bad"); return false; }
  spend("studio", 50);
  G.gamesDiv={unlocked:true, projects:[], released:[]};
  log("🎮 The "+G.studio.name+" game studio is open — adapt your hits and franchises into playable worlds (+$0.4M/wk overhead).","gold");
  saveGame(); return true;
}
function gameSources(){
  const inDev=(((G.gamesDiv||{}).projects)||[]).map(p=>p.srcKey);
  const out=[];
  (G.franchises||[]).forEach(fr=>{
    out.push({key:"fr:"+fr.id, kind:"franchise", id:fr.id, name:fr.name, emoji:"🏰",
      heat:Math.round((fr.decay||0)*100), power:15+fr.tier*15+(fr.decay||0)*35,
      blurb:fr.entries.length+" hit"+(fr.entries.length>1?"s":"")+" · tier "+fr.tier});
  });
  (G.films||[]).filter(f=>{ try{ return (f.ww||0)>=breakevenWW(f)*1.2; }catch(e){ return false; } }).slice(-8).forEach(f=>{
    out.push({key:"film:"+f.id, kind:"film", id:f.id, name:f.title, emoji:(DATA.GENRES[f.genre]||{}).emoji||"🎬",
      heat:Math.round(clamp((f.ww||0)/Math.max(1,(f.opening||1)*2.2),0,4)*25), power:10+clamp((f.ww||0)/40,0,30),
      blurb:fmtG(f.ww)+" WW · "+((DATA.GENRES[f.genre]||{}).name||f.genre)});
  });
  return out.filter(s=>!inDev.includes(s.key));
}
function startGameDev(srcKey, devId){
  if(!G.gamesDiv || !G.gamesDiv.unlocked) return false;
  if((G.gamesDiv.projects||[]).length>=3){ log("🕹 The dev floor is full (3 projects) — ship one first.","bad"); return false; }
  const dev=(DATA.GAME_DEVS||[]).find(d=>d.id===devId); if(!dev) return false;
  const src=gameSources().find(s=>s.key===srcKey);
  if(!src){ log("🎮 That source is already in development (or no longer eligible).","bad"); return false; }
  if(G.studio.cash<dev.cost){ log("💸 "+dev.name+" wants "+fmtM(dev.cost)+" up front (plus "+fmtM(dev.weekly)+"/wk through development).","bad"); return false; }
  spend("games", dev.cost);
  const weeks=rint(dev.weeks[0], dev.weeks[1]);
  const title=src.kind==="franchise"? src.name+": "+pick(["The Game","Next Level","Legacy Mode","Open World","Rivals"]) : src.name+" — The Game";
  G.gamesDiv.projects.push({id:nid(), title, srcKey, srcKind:src.kind, srcId:src.id, srcName:src.name,
    dev:dev.id, devName:dev.name, weeksLeft:weeks, weeks0:weeks, weekly:dev.weekly, base:dev.quality, power:src.power, spent:dev.cost});
  log("🕹 Greenlit: \""+title+"\" — "+dev.name+", ~"+weeks+" wks at "+fmtM(dev.weekly)+"/wk.","gold");
  saveGame(); return true;
}
function tickGameStudio(){
  const D=G.gamesDiv; if(!D||!D.unlocked) return;
  const shipped=[];
  (D.projects||[]).forEach(pr=>{
    if(pr.weeksLeft>0){
      spend("games", pr.weekly); pr.spent=Math.round((pr.spent+pr.weekly)*10)/10;
      pr.weeksLeft--;
      if(pr.weeksLeft<=0){ releaseGame(pr); shipped.push(pr); }
    }
  });
  D.projects=(D.projects||[]).filter(p=>!shipped.includes(p));
}
function releaseGame(pr){
  const D=G.gamesDiv;
  const fr=pr.srcKind==="franchise"? frById(pr.srcId) : null;
  const heat=fr? (fr.decay||0.5) : 0.5;
  const score=clamp(Math.round(pr.base + pr.power*0.25 + (heat-0.5)*25 + (rnd()*16-8)), 5, 98);
  const total=Math.round((score/100)*(18+pr.power)*(0.8+rnd()*0.4)*10)/10;
  const launch=Math.round(total*0.35*10)/10;
  const weekly=Math.round((total-launch)/12*10)/10;
  earn("games", launch);
  D.released.unshift({id:pr.id, title:pr.title, score, total, earned:launch, weekly, weeksLeft:12, when:G.week});
  if(D.released.length>12) D.released.length=12;
  if(fr && score>=70){
    fr.decay=clamp((fr.decay||0)+0.1,0,1);
    (G.board||[]).forEach(m=>{ m.approval=clamp(m.approval+1,5,99); });
    log("🎮 "+pr.title+" launches to a "+score+"/100 — the "+fr.name+" brand runs hot again (+heat), "+fmtM(launch)+" launch weekend. The board is pleased.","gold");
  }
  else if(score<45) log("🎮 "+pr.title+" launches to a rough "+score+"/100 — the forums are merciless. "+fmtM(launch)+" launch weekend.","bad");
  else log("🎮 "+pr.title+" launches to a "+score+"/100. "+fmtM(launch)+" launch weekend, "+fmtM(weekly)+"/wk tail for a year.","");
}
function tickGameSales(){
  const D=G.gamesDiv; if(!D||!D.unlocked) return;
  (D.released||[]).forEach(g=>{
    if(g.weeksLeft>0){ earn("games", g.weekly); g.earned=Math.round((g.earned+g.weekly)*10)/10; g.weeksLeft--; }
  });
}

function expectedOpening(p, weekAbs){
  if(weekAbs == null) weekAbs = (p && p.releaseWeek) || (G && G.week) || 1;
  const S=DATA.SCALES[p.scale], g=DATA.GENRES[p.genre];
  let base = S.openBase * g.mass * (g.openBoost||1) * (G.infl||1);
  if(G.studio && G.studio.hypeSurge){ base*=1.10; } // v27: influence-bought hype surge (consumed at release)
  if(p.scale==="tentpole"&&repPerk("blockbuster")) base*=1.03; // blockbuster houses open big
  if(p.scale==="tentpole") base*=1+specBonus("blockbuster");
  base*=econM("theater"); // theater demand lifts or softens every opening
  if(p.genre==="horror") base*=1+specBonus("horror");
  if(p.genre==="action") base*=1+specBonus("action");
  if(p.genre==="animation"||p.genre==="fantasy") base*=1+specBonus("family");
  if(p.foreignLang) base *= 0.75;
  const starP = p.cast.reduce((s,c)=>s+effectivePower(c, "NA"),0);
  let starF = 1 + 0.075*Math.min(starP, 6);
  const scandalous = p.cast.filter(c=>c.scandal>0).length;
  if(scandalous) starF *= Math.max(0.82, 1 - 0.06*scandalous);
  if(p.cast.some(c=>c.toxic && !c.rehabbed)) starF *= 0.93;
  const rec = recMarketing(p);
  let mktEff = p.marketing || 0;
  if(mktEff > 45){ mktEff = 45 + Math.log10(1 + (mktEff - 45)) * 16; }
  let mktF = clamp(Math.pow(Math.max(mktEff,1)/rec, 0.45), 0.5, 1.55) * (G.upgrades.marketing?1.10:1) * (hqOwned("dist")?1.05:1);
  if(G.execs.cmo || (G.execs && G.execs.cmo)){ const cm=execObj("cmo"); if(cm) mktF*=1+0.12*lvlMult(cm); }   // v14: leveled CMO markets harder
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
  if(p.premium || p.imax) hype *= 1.12 * (techDone("td")?1.03:1);
  try{ hype*=uniMult(p); }catch(e){} // universe continuity cuts both ways
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
  hype *= chainScreenMult(p);                         // v12: friendlier chains book more screens — and a bigger opening
  return Number.isFinite(hype) ? hype : base;
}

function competitionFactor(p, weekAbs){
  const others = weekendCompetitors(p, weekAbs);
  if(!others.length) return 1;
  const wSelf = Math.pow(Math.max(expectedWeightOf(p),1), 0.8);
  let sum = wSelf;
  others.forEach(o=>{
    const w = Math.max(Number(o.weight)||0, 0.1);
    sum += Math.pow(w, 0.8);
  });
  const share = sum>0 ? wSelf/sum : 1;
  const crowd = others.length===1? 1.08 : others.length===2? 1.0 : 0.9; // market expands a bit with 2, saturates with 3+
  return clamp(Math.pow(share,0.55)*crowd, 0.15, 1.08);
}
function expectedWeightOf(p){
  const S=DATA.SCALES[p.scale];
  if(!S) return 6;
  const rate = DATA.rating ? DATA.rating(p.rating) : null;
  const ratingM = DATA.RATINGS ? DATA.RATINGS.find(r=>r.id===(p.rating||"PG-13")) : null;
  let w = S.openBase * (DATA.GENRES[p.genre]? DATA.GENRES[p.genre].mass : 1) * (G.infl||1) * (p.franchise?1.35:1)
    * (1-fatigueOfName(p.franchiseName)) * ((typeof trendPull==="function")? trendPull(p.genre) : 1)
    * (1+(rate?rate.open:0)) * (p.premium||p.imax?1.12:1)
    * (0.95 + (G.exhibitor||50)/1000)
    * (p.dayAndDate?0.65:1)
    * clamp(Math.pow(Math.max(p.marketing,1)/Math.max(recMarketing(p),1),0.45),0.6,1.5);
  if(ratingM) w *= ratingM.open;
  const pat = DATA.PATTERNS ? DATA.PATTERNS.find(x=>x.id===(p.pattern||"wide")) : null; if(pat) w*=pat.open;
  const roll = DATA.ROLLOUTS ? DATA.ROLLOUTS.find(x=>x.id===(p.rollout||"day")) : null; if(roll) w*=roll.open;
  if(typeof frHeatMult==="function" && p.franchiseName) w *= frHeatMult(p);
  return Number.isFinite(w) ? w : 6;
}

function weekendCompetitors(p, weekAbs){
  const list = [];
  G.rivals.forEach(r=>{
    const f = r.slate.find(f=>f.week===weekAbs && !f.dead);
    if(f) list.push({ rival:r.name, weight:Math.max(f.weight||f.opening||6, 0.1), title:f.title, scale:f.scale, genre:f.genre });
  });
  if(p){ // your own other theatrical films same weekend
    G.projects.forEach(o=>{ if(o!==p && o.releaseWeek===weekAbs) list.push({ mine:true, title:o.title, weight:Math.max(expectedWeightOf(o)||6, 0.1) }); });
    G.films.forEach(o=>{ if(!o.streamingOriginal && o.inTheaters && o.releaseWeek===weekAbs && o!==p) list.push({ mine:true, title:o.title, weight:Math.max(o.opening||o.weight||6, 0.1) }); });
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
  if(techDone("anim") && film.genre==="animation") legs+=0.1;
  if(film.genre==="animation") legs+=specBonus("animation");
  if(film.campaignLegs) legs+=film.campaignLegs; // marketing WOM buys a longer tail
  // v5: review embargo — anticipation helps when critics would have been kind; cover-ups get punished
  if(film.embargoActive) legs += (film.quality.critic>=55? 0.05 : -0.10);
  legs += projectAbilities(film).legs;   // v28: Legs Engine & friends stretch the tail
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

/* ═══════════ movie pitch battles — evaluate concepts before greenlight ═══════════
   Read-only estimates from existing knobs (scale base, genre mass/legs, trend,
   script). Pitch state rides on idea.pitch, so saves need no schema change. */
function pitchAngles(){
  return [
    {id:"four", name:"Four-quadrant", icon:"🍿", open:1.00, crit:0, aud:0, desc:"The widest net. No bonuses, no penalties."},
    {id:"family", name:"Family", icon:"🧸", open:1.08, crit:0, aud:4, desc:"+8% opening, +4 audience on animation/fantasy — flops elsewhere."},
    {id:"prestige", name:"Prestige", icon:"🏛", open:0.94, crit:6, aud:-2, desc:"Critics +6 on drama/musical/war, but −6% opening."},
    {id:"fans", name:"Genre fans", icon:"🔥", open:1.06, crit:-2, aud:3, desc:"+6% opening on horror/concert/thriller; critics −2."},
  ];
}
function pitchAngle(id){ return pitchAngles().find(a=>a.id===id) || pitchAngles()[0]; }
function pitchEval(idea, budget, angleId){
  const S=DATA.SCALES[idea.scale], g=DATA.GENRES[idea.genre], an=pitchAngle(angleId);
  const trend=(typeof trendPull==="function")?trendPull(idea.genre):1;
  const scriptF=clamp(idea.script/70,0.5,1.3);
  let fitOpen=1, fitCrit=0, fitAud=0;
  if(angleId==="family"){ if(idea.genre==="animation"||idea.genre==="fantasy"){fitOpen=1.08;fitAud=4;} else {fitOpen=0.95;fitAud=-3;} }
  if(angleId==="prestige"){ if(["drama","musical","war"].includes(idea.genre)){fitCrit=6;} else {fitCrit=2;} fitAud=-2; }
  if(angleId==="fans"){ if(["horror","concert","thriller"].includes(idea.genre)){fitOpen=1.06;fitAud=3;} else {fitOpen=1.0;} fitCrit=-2; }
  const openEst=S.openBase*g.mass*trend*scriptF*an.open*fitOpen*(G.infl||1);
  const legsEst=clamp(2.2+g.legsAdj+(idea.script-60)*0.02,1.45,4.4);
  const wwEst=openEst*legsEst/(1-g.intlShare);
  const mkt=recMarketing({budget, scale:idea.scale, genre:idea.genre});
  const cost=devCostOf(idea)+budget+mkt;
  const revenue=Math.round(wwEst*0.48);
  const profit=Math.round(revenue-cost);
  const be=(budget+mkt)/0.48;
  const commercial=clamp(Math.round(wwEst/be*50),5,99);
  const critical=clamp(Math.round(idea.script+g.critic+an.crit+fitCrit),5,99);
  const audience=clamp(Math.round(idea.script*0.6+30+g.aud+an.aud+fitAud),5,99);
  let risk=Math.round(clamp((budget/S.bMax)*40+(idea.script<60?25:idea.script<70?10:0)+(trend<0.94?15:0)+(idea.scale==="tentpole"?10:0),5,99));
  const franchise=clamp(Math.round(g.merch*45+(idea.scale==="tentpole"?25:idea.scale==="mid"?10:0)+(idea.hot?15:0)),5,99);
  const score=Math.round(commercial*0.35+critical*0.2+audience*0.25+(100-risk)*0.2);
  const verdict=score>=70?"Greenlight material":score>=50?"Viable with caveats":"Pass";
  return {commercial, critical, audience, risk, cost:Math.round(cost), revenue, profit,
    franchise, score, verdict, openEst:Math.round(openEst*10)/10, legsEst:Math.round(legsEst*100)/100, be:Math.round(be)};
}
function pitchSave(ideaId, angleId, budget){
  const idea=G.ideas.find(i=>i.id===+ideaId); if(!idea) return null;
  const ev=pitchEval(idea, budget, angleId);
  idea.pitch={angle:angleId, budget, score:ev.score, verdict:ev.verdict, week:G.week};
  saveGame();
  return ev;
}

/* ═══════════ film pitch wizard — like series pitch but for theatrical ═══════════ */
function pitchFilm(cfg){
  const S = DATA.SCALES[cfg.scale] || DATA.SCALES.mid;
  const g = DATA.GENRES[cfg.genre] || DATA.GENRES.action;
  const dir = cfg.director;
  const writer = cfg.writer;
  const producer = cfg.producer;
  const cast = cfg.cast || [];
  const budget = cfg.budget || Math.round(neededBudget(cfg.genre, cfg.scale));
  const mkt = recMarketing({budget, scale:cfg.scale, genre:cfg.genre});
  const totalCost = devCostOf({scale:cfg.scale, genre:cfg.genre, hot:false, script:65}) + budget + mkt;
  const trend = (typeof trendPull==="function")?trendPull(cfg.genre):1;
  const openEst = S.openBase * g.mass * trend * (cfg.rating==="R"?0.88:1.0) * (cfg.imax?1.08:1.0) * (cfg.premium?1.12:1.0) * (G.infl||1);
  const legsEst = clamp(2.2 + g.legsAdj + 0.02*(dir?dir.skill:55), 1.45, 4.4);
  const wwEst = openEst * legsEst / (1 - g.intlShare);
  const revenue = Math.round(wwEst * 0.48);
  const profit = Math.round(revenue - totalCost);
  const be = (budget + mkt) / 0.48;
  const commercial = clamp(Math.round(wwEst/be*50), 5, 99);
  const critical = clamp(Math.round((dir?dir.skill:55)*0.4 + (writer?writer.skill:55)*0.3 + 30 + g.critic), 5, 99);
  const audience = clamp(Math.round((dir?dir.skill:55)*0.3 + cast.reduce((s,c)=>s+c.power,0)*0.2 + 35 + g.aud), 5, 99);
  let risk = Math.round(clamp((budget/S.bMax)*40 + (cfg.rating==="R"?10:0) + (trend<0.94?15:0) + (cfg.scale==="tentpole"?10:0), 5, 99));
  const franchise = clamp(Math.round(g.merch*45 + (cfg.scale==="tentpole"?25:cfg.scale==="mid"?10:0)), 5, 99);
  const score = Math.round(commercial*0.35 + critical*0.2 + audience*0.25 + (100-risk)*0.2);
  const verdict = score>=70?"Greenlight material":score>=50?"Viable with caveats":"Pass";
  const ev = {commercial, critical, audience, risk, cost:Math.round(totalCost), revenue, profit,
    franchise, score, verdict, openEst:Math.round(openEst*10)/10, legsEst:Math.round(legsEst*100)/100, be:Math.round(be)};
  /* v14: tentpoles need an actual board vote (§44–45) */
  if(cfg.scale==="tentpole"){
    const vote=boardVote({quality:{overall:score}, budget});
    const tally=vote.votes.reduce((a,v)=>a+(v.yes?"✅":"❌"), "");
    if(!vote.pass){
      log("🏛 BOARD VOTE FAILED ("+tally+"): the "+fmtM(budget)+" tentpole doesn't get made. Win the board back with hits, or pitch smaller.","bad");
      return {ok:false, ev, board:true};
    }
    log("🏛 Board approved the "+fmtM(budget)+" tentpole ("+tally+"). Greenlight proceeds.","");
  }
  if(chance(clamp(0.15 + score/200 + G.studio.rep/500 + (G.upgrades.rd?0.05:0), 0.1, 0.9))){
    const p = {
      id:nid(), kind:"film", title:cfg.titleOverride || makeTitle(cfg.genre), genre:cfg.genre, scale:cfg.scale,
      script: (writer?writer.skill:65) + (cfg.scriptPolish?6:0), blurb: "Pitched concept", hot:false,
      budget: budget, budget0: budget, overrun:0, spent:0, devCost: devCostOf({scale:cfg.scale, genre:cfg.genre, hot:false, script:65}),
      director: dir, writer: writer||null, producer: producer||null, cast: cast, cameo: null,
      phase:"pre", phaseWeek:0,
      phaseLen:{ pre:rint(...S.pre)+(cfg.scriptPolish?1:0), shoot:rint(...S.shoot), post:rint(...S.post) },
      releaseWeek:0, marketing:0, marketingPaid:0,
      franchise: false, sequelOf:null,
      buzzBonus: 0, awareness:0,
      strikePause:0,
      rating: cfg.rating||"PG-13",
      location: cfg.location||"home",
      foreignLang: !!cfg.foreignLang,
      rewritten:false, tested:false, reshoot:false,
      pattern: cfg.pattern||"wide", rollout: cfg.rollout||"day", window: cfg.window||45, imax: !!cfg.imax, premium: !!cfg.premium, soundtrack: !!cfg.soundtrack, dayAndDate: !!cfg.dayAndDate,
      writerBonus: writer? (writer.genreFit===cfg.genre?4:2) : 0,
      aiCast: false, aiScript: false,
      rebateEarned: 0,
      coProd: cfg.coProduction ? {partner:cfg.coProdPartner, share:0.5, upfront:0, territories:{}} : cfg.coProd||null,
      mktBoosts: [],
    };
    p.promoOwed = promoOwedFor(cast);   // v13: stars owe press; contract faces owe more
    G.projects.push(p);
    if(typeof applyGreenlightRelationships==="function") applyGreenlightRelationships(p);
    if(dir){dir.bookedUntil=G.week+p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post; dir.booked=p.title;}
    if(writer){writer.bookedUntil=G.week+p.phaseLen.pre; writer.booked=p.title;}
    if(producer){producer.bookedUntil=G.week+p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post; producer.booked=p.title;}
    cast.forEach(c=>{c.bookedUntil=G.week+p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post; c.booked=p.title;});
    log("🎬 Film greenlit: \""+p.title+"\" — "+cfg.scale+" "+g.name+" @ "+fmtM(budget)+".","gold");
    return {ok:true, ev, project:p};
  }
  log("🚫 The board passed on \""+(cfg.titleOverride||"the concept")+"\". Rework and try again.","bad");
  return {ok:false, ev};
}

/* ═══════════ greenlight ═══════════ */
function devCostOf(idea){
  const base = { indie:2, mid:5, tentpole:12 }[idea.scale];
  const dev = base + (idea.hot? rint(2,6):0);
  let out = (typeof hqOwned==="function"&&hqOwned("rd"))? dev*0.85 : dev;
  if(techDone("ai")) out*=0.9;
  if(idea.scale==="indie"&&repPerk("indie")) out*=0.8; // indie houses develop cheap
  if(idea.scale==="indie") out*=1-specBonus("indie");
  return Math.round(out*10)/10;
}
function greenlight(cfg){
  const idea = cfg.idea;
  const S = DATA.SCALES[idea.scale];
  const aiCast = !!cfg.aiCast, aiScript = !!cfg.aiScript;
  if(aiCast) cfg.cast = [];                 // synthetic ensemble replaces the cast
  if(aiScript) cfg.writer = null;           // SynthScribe replaced the writer
  const crew = [cfg.director, cfg.writer, cfg.producer].filter(Boolean);
  /* v14: agent packages (§29) — a star can trade fee for backend points */
  const deals=cfg.deals||{};
  let fees = crew.reduce((s,c)=>s+actorFee(c),0) + cfg.cast.reduce((s,c)=>s+(deals[c.id]==="backend"? Math.round(actorFee(c)*0.7*10)/10 : actorFee(c)),0);
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
      id:nid(), kind:"film", title:(cfg.titleOverride? String(cfg.titleOverride).trim().slice(0,60) : "") || idea.title, genre:idea.genre, scale:idea.scale,
    script: idea.script + (polish?6:0), blurb: idea.blurb, hot:idea.hot,
    budget: cfg.budget, budget0: cfg.budget, overrun:0, spent:0, devCost:dev,
    director: cfg.director, writer: cfg.writer||null, producer: cfg.producer||null, cast: cfg.cast, cameo: cfg.cameo||null,
    phase:"pre", phaseWeek:0,
    phaseLen:{ pre:rint(...S.pre)+(polish?1:0), shoot:rint(...S.shoot), post:rint(...S.post) },
    releaseWeek:0, marketing:0, marketingPaid:0,
    franchise: !!(cfg.sequelOf) || !!cfg.spinoffFr || !!cfg.crossover,
    sequelOf: cfg.sequelOf? cfg.sequelOf.id : null,
    buzzBonus: (cfg.sequelOf? (repPerk("franchise")?0.2:0.15)+specBonus("franchise") : 0) + (cfg.crossover? 0.45 : 0) + (idea.awareness? 0:0),
    awareness: idea.awareness||0,
    strikePause:0,
    rating: cfg.rating||"PG-13",
    theme: cfg.theme||null,
    location: cfg.location||"home",
    foreignLang: !!cfg.foreignLang,
    rewritten:false, tested:false, reshoot:false,
    pattern: cfg.pattern||"wide", rollout: cfg.rollout||"day", window: cfg.window||45, imax: !!cfg.imax, premium: !!cfg.premium, soundtrack: !!cfg.soundtrack, dayAndDate: !!cfg.dayAndDate,
    writerBonus: 0,
    aiCast, aiScript,
    rebateEarned: 0,
    coProd: cfg.coProd||null,
    mktBoosts: [],
    festStrategy: cfg.festStrategy||null,
    universe: cfg.universe||null,
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
      log("🤝 Co-production: "+partner.name+" covers "+Math.round(partner.pct*100)+"% of \""+p.title+"\""+(treaty? " — treaty bonus: rebates +30%, critics warm up":"")+". They keep "+Math.round(partner.share*100)+"% of net.","gold");
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
  const backendStars=(cfg.cast||[]).filter(c=>deals[c.id]==="backend");
  if(backendStars.length){
    p.backend=Math.round(((p.backend||0)+0.02*backendStars.length)*100)/100;
    log("🤝 "+backendStars.map(c=>c.name).join(", ")+" traded fee for backend — −30% fee now, +2% of rentals each on a hit.","gold");
  }
  if(cfg.presales && p.plan!=="streaming" && p.plan!=="own"){
    p.presales = Math.round(p.budget*0.22);
    earn("presales", p.presales);
    log("🌍 International pre-sales on \""+p.title+"\": +"+fmtM(p.presales)+" (intl box office now goes to the buyers).","");
  }
  const total = p.phaseLen.pre+p.phaseLen.shoot+p.phaseLen.post;
  p.promoOwed = promoOwedFor(cfg.cast);   // v13: stars owe press; contract faces owe more
  if(cfg.director){ cfg.director.bookedUntil = G.week+total; cfg.director.booked = p.title; }
  if(cfg.writer){ cfg.writer.bookedUntil = G.week+total; cfg.writer.booked = p.title+" (writer)"; }
  if(cfg.producer){ cfg.producer.bookedUntil = G.week+total; cfg.producer.booked = p.title+" (producer)"; }
  cfg.cast.forEach(c=>{ c.bookedUntil=G.week+total; c.booked=p.title; });
  // contracts tick down, chemistry accrues between co-stars, reunions pay buzz
  [cfg.director, cfg.writer, cfg.producer].concat(cfg.cast||[]).forEach(t=>{
    if(t&&t.contract&&t.contract.type==="multi"&&t.contract.filmsLeft>0){
      t.contract.filmsLeft--;
      if(t.contract.filmsLeft<=0){ t.contract=null; log("📄 "+t.name+"'s multi-picture deal is fulfilled — renegotiate or pay list.",""); }
    }
  });
  (cfg.cast||[]).forEach((a,i)=>{ (cfg.cast||[]).forEach((b,j)=>{
    if(i<j){ a.chem=a.chem||{}; b.chem=b.chem||{};
      const prior=Math.min(a.chem[b.id]||0, b.chem[a.id]||0);
      a.chem[b.id]=(a.chem[b.id]||0)+1; b.chem[a.id]=(b.chem[a.id]||0)+1;
      if(prior>=2){ p.buzzBonus=Math.round(((p.buzzBonus||0)+0.02)*100)/100;
        log("🔥 Reunion: "+a.name+" × "+b.name+" together again (+2% buzz).","good"); }
    } }); });
  if(cfg.cameo){ cfg.cameo.bookedUntil=Math.max(cfg.cameo.bookedUntil||0, G.week+4); cfg.cameo.booked=p.title+" (cameo)"; }
  // v9: budget allocation emphasis (defaults 20/20/20/20/20) + talent relationships
  if(cfg.alloc){ const a=cfg.alloc; const t=(a.vfx||0)+(a.stunts||0)+(a.cast||0)+(a.music||0)+(a.design||0)||100;
    p.alloc={vfx:Math.round(a.vfx/t*100), stunts:Math.round(a.stunts/t*100), cast:Math.round(a.cast/t*100), music:Math.round(a.music/t*100), design:Math.round(a.design/t*100)}; }
  if(typeof applyGreenlightRelationships==="function") applyGreenlightRelationships(p);
  G.projects.push(p);
  G.ideas = G.ideas.filter(i=>i.id!==idea.id);
  const planLabel = {theatrical:"theatrical release",streaming:"streaming original",own:"own-streamer premiere",later:"decide distribution later"}[p.plan]||p.plan;
  const loc = DATA.LOCATIONS ? DATA.LOCATIONS.find(l=>l.id===p.location) : null;
  log("🎬 Greenlit: \""+p.title+"\" ("+DATA.genreOf(p.genre).name+", "+fmtM(cfg.budget)+" budget, "+p.rating+(p.foreignLang?", foreign-language":"")+", shooting in "+(loc?loc.name:"home lot")+") — "+planLabel,"gold");
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
    if(p.strikePause>0){ p.strikePause--; if(p.strikePause===0) log("✊ Crews back on set for \""+p.title+"\"",""); continue; }
    p.phaseWeek++;
    const L=p.phaseLen;
    // cash burn
    let burn=0;
    if(p.phase==="pre")  burn = p.budget*0.10/Math.max(1,L.pre) * econM("prod");
    if(p.phase==="shoot"){
      burn = p.budget*0.70/Math.max(1,L.shoot) * (G.upgrades.backlot?0.88:1) * (hqOwned("stage2")?0.95:1) * (techDone("virtual")?0.9:1) * econM("prod");
      // v4: cost overruns — weather, reshoot days, a star's trailer. Producers contain them.
      const prodSkill = p.producer? p.producer.skill : 45;
      let risk = clamp(0.15 - (prodSkill-45)/300, 0.03, 0.20) * (techDone("sets")?0.8:1);
      if(p.alloc) risk = clamp(risk + (p.alloc.stunts-20)*0.0012, 0.02, 0.26);   // v9: stunt-heavy shoots risk more
      if(p.feudSet) risk = clamp(risk+0.02, 0.02, 0.28);                          // v9: feuding co-stars destabilize the set
      const ovAdj = [p.producer, p.director].reduce((m,t)=>{ const a=talentAbility(t); return (a&&a.overrun)? m*(1+a.overrun):m; },1);
      risk = clamp(risk*ovAdj, 0.02, 0.26);                                       // v28: Budget Hawk / Crisis Fixer contain overruns
      if(G.btl && G.btl.vfx) risk *= Math.max(0.85, 1-0.08*lvlMult(G.btl.vfx));   // v14: a leveled VFX house keeps even more shots on budget
      if(chance(risk)){
        const size = Math.round(p.budget*(0.008+rnd()*0.017)*(p.producer? 0.6:1)*10)/10;
        p.overrun = Math.round(((p.overrun||0)+size)*10)/10;
        p.budget = Math.round((p.budget+size)*10)/10;
        burn += size;
        if(size>=1) log("💸 Overrun on \""+p.title+"\": +"+fmtM(size)+(p.producer? " (your producer capped it)":" — no producer on this one")+".","bad");
        if(!p.producer && typeof unionAdjust==="function") unionAdjust(2,"unmanaged overrun"); // v5: guilds notice chaos
      }
    }
    if(p.phase==="post") burn = p.budget*0.20/Math.max(1,L.post) * (G.upgrades.vfx?0.75:1) * (hqOwned("sound")?0.9:1) * (techDone("digital")?0.9:1) * econM("prod");
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
      log("🤖 Online backlash simmers around \""+p.title+"\"'s synthetic "+(p.aiCast?"cast":"script")+" — opening hype bleeding.","bad");
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
        log("🎬 Reshoot complete on \""+p.title+"\" — test audience score now "+p.quality.overall+"/100.","good");
      }
      else if(p.phase==="post"){
        p.quality = computeQuality(p);
        if(p.prebuyAccepted){
          finishStreamingOriginal(p);
        }else if(p.plan==="own"){
          if(G.streamer){ finishOwnStreamerOriginal(p); }
          else{ p.phase="ready"; p.plan="later"; log("📭 \""+p.title+"\" finished — but you have no streamer. Decide distribution.","bad"); maybePrebuyOffer(p); }
        }else if(p.plan==="streaming"){
          p.phase="ready";
          log("🎞 \""+p.title+"\" is finished! Score: "+p.quality.overall+"/100. Shopping it to the streamers…","good");
          G.pendingAuction = { projectId:p.id, bids:makeAuctionBids(p), manual:false };
        }else{
          p.phase="ready";
          if(p.festStrategy){
            const fest = (DATA.FESTIVALS||[]).find(x=>x.id===p.festStrategy) || (DATA.FESTIVALS||[])[0];
            const mode = p.festMode || "premiere";
            if(mode==="auction" && fest){
              /* v28: market auction — rivals bid for the finished picture; cash now, no theatrical upside */
              G.pendingSale = { projectId:p.id, festId:fest.id, bids:makeSaleBids(p, fest) };
              log("🎪 \""+p.title+"\" entered the "+fest.emoji+" "+fest.name+" market. Buyers are circling — take an offer or walk away.","gold");
            }else{
              /* v28: competition slots require the film to have shot in the festival's home region */
              const elig = mode!=="competition" || p.location===(fest&&fest.region);
              const prest = (fest? fest.prestige : 1.2) * (mode==="competition"? (elig?1.6:0.6) : 1);
              p.festPrestige = (p.festPrestige||0) + Math.round(8 * prest);
              p.buzzBonus = (p.buzzBonus||0) + 0.08 * prest;
              p.campaign = (p.campaign||0) + Math.round(5 * prest);
              log("🎪 Festival "+(mode==="competition"?"Competition":"Premiere")+": \""+p.title+"\" "
                +(mode==="competition"
                  ? (elig? "competes at" : "screens out of competition at (not shot in-region — reduced bump)")
                  : "held its world premiere at")
                +" "+(fest?fest.emoji+" "+fest.name:"the festival")+"! Critical buzz +"+Math.round(8*prest)+"%, awards momentum primed.","gold");
            }
          }
          /* v28: ship a genre×theme pairing once and its affinity is remembered forever */
          if(p.theme){
            const ckey=DATA.comboKey(p.genre,p.theme), mood=DATA.comboOf(p.genre,p.theme);
            if(mood!=="neutral" && !G.comboKnown[ckey]){
              G.comboKnown[ckey]=mood;
              const th=DATA.themeOf(p.theme);
              log(mood==="love"
                ? "🧩 Combo discovered: "+DATA.GENRES[p.genre].name+" × "+th.name+" is a GREAT match — +5 quality, +8% opening on every future pairing!"
                : "🧩 Combo discovered: "+DATA.GENRES[p.genre].name+" × "+th.name+" clashes — the pairing fell flat (−4 quality).","gold");
            }
          }
          /* v28: one film together reveals a collaborator's hidden ability */
          [p.director,p.writer,p.producer].concat(p.cast||[]).forEach(t=>{ if(t) t.abilityKnown=true; });
          log("🎞 \""+p.title+"\" is finished! Score: "+p.quality.overall+"/100. Date it theatrically or shop it to streamers.","good");
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
  log("📺 \""+p.title+"\" delivered straight to "+plat.name+" for "+fmtM(pay),"gold");
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
  log("🎬 \""+p.title+"\" goes back to the lot for reshoots — "+fmtM(fee)+", ~"+weeks+" weeks. Test audiences wanted more.","gold");
  saveGame();
  return true;
}

/* ═══════════ theatrical release ═══════════ */
function releaseFilm(p){
  firePendingDrops(p);   // v13: drops that never got their week fire compressed at release
  let expected = expectedOpening(p, G.week);
  const abOpen = abilityOpenMult(p);   // v28: Opening Draw, Movie Star Incarnate, great combos
  if(abOpen>1) expected *= abOpen;
  // v20: Animated fast-track bonus
  if(typeof animatedFastTrackBonus==="function") expected *= animatedFastTrackBonus(p);
  if(p.soundtrack){
    if(chance(0.30)){ p.soundHit=true; expected*=1.10; log("🎵 The single from \""+p.title+"\" is CHARTING — +10% buzz!","gold"); }
    else log("🎵 The \""+p.title+"\" single stalled. No chart action.","");
  }
  /* v12: advance tickets banked before opening day lift the opening (capped +6%) */
  const advTotal=Math.min(p.advanceTotal||0, Math.round(expected*0.06*10)/10);
  if(advTotal>0) expected=Math.min(expected*1.06, expected+advTotal);
  // v21: Streaming vs Theatrical War Meter
  if(typeof getWarMeterMult==="function"){
    const wm = getWarMeterMult();
    expected *= wm.theatrical;
  }
  const noise = 0.85 + rnd()*0.34;
  let opening = clamp(expected*noise, 1.2, 320);
  if(G.theaterCap>0) opening *= 0.55;
  if(G.studio && G.studio.hypeSurge){ G.studio.hypeSurge=false; log("🌐 Hype surge lands — the influence campaign adds +10% to the opening.","gold"); }
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
      log("🇨🇳 "+CG.quotaName+": \""+p.title+"\" missed its import slot — no China release. (−"+Math.round(chShare0*100)+"pts of WW share)","bad");
    }else{
      log("🇨🇳 \""+p.title+"\" won a China quota slot — full intl rollout cleared.","good");
    }
  }
  /* v12: dubbing & localization — an itemized cost, never a silent tax (§27) */
  const locTargets=Array.isArray(p.targetRegion)? p.targetRegion.slice() : (p.targetRegion && p.targetRegion!=="auto"? [p.targetRegion] : []);
  const locCost=localizationCost(p, p.targetRegion);
  if(locCost>0) spend("marketing", locCost);
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
    campaignLegs:p.campaignLegs||0,   // v13: campaign WOM now actually rides the released film's tail
    advanceTotal:advTotal, advance:(p.advance||[]).slice(), locCost,
    inTheaters:true, weeksOut:1, franchiseable:false, soldTo:null,
    theme:p.theme||null,
    piracyPenalty:0, awardsEligible:true, year:yearOf(G.week),
    franchiseName:p.franchiseName||null, sequelOf:p.sequelOf,
    franchiseableChecked:false, censorChecked:false,
  };
  if(typeof reviewFilm==="function") reviewFilm(film);
  G.films.push(film);
  G.projects = G.projects.filter(x=>x!==p);
  freeProjectTalent(p);
  // v28: decrement filmsLeft on multi-film contracts when a film is completed
  const crew = [p.director, p.writer, p.producer].concat(p.cast||[]).filter(Boolean);
  crew.forEach(t=>{
    if(t && t.contract && t.contract.type==="multi" && t.contract.filmsLeft!==null){
      t.contract.filmsLeft = Math.max(0, (t.contract.filmsLeft||3) - 1);
      if(t.contract.filmsLeft <= 0){
        t.contract = null;
        log("🔓 "+t.name+"'s multi-film contract fulfilled — back on the open market.","");
      }
    }
  });
  G.stats.films++;
  if(film.reviews && film.reviews.length){
    const top=film.reviews[0];
    log("🗞 "+top.outlet+" ("+top.name+"): "+top.score+"/100 — \""+top.quote+"\" · consensus "+film.criticAvg+" ("+film.freshPct+"% positive).", film.criticAvg>=65?"good":film.criticAvg<45?"bad":"");
  }
  const fr0 = film.franchiseName && G.franchises.find(x=>x.name===film.franchiseName);
  if(fr0) fr0.decay = 1;
  /* v14: shipped work levels up the staff (§47) */
  if(G.btl){ ["dp","composer","vfx"].forEach(r=>{ if(G.btl[r]) G.btl[r].xp=(G.btl[r].xp||0)+1; }); }
  Object.keys(G.execs||{}).forEach(k=>{ const e=G.execs[k]; if(e&&typeof e==="object") e.xp=(e.xp||0)+1; });
  if(typeof grantFilmXP==="function") grantFilmXP(film);
  if(opening>G.stats.bestOpen){ G.stats.bestOpen=opening; G.stats.bestFilm=film.title; }
  earn("theatrical", opening*0.53);
  if(typeof sfx==="function") sfx("fanfare");
  const label = opening>=100? "💥 MASSIVE opening": opening>=40? "🔥 Strong opening": opening>=12? "▶ Solid opening":"🎪 Limited release";
  log(label+": \""+film.title+"\" opens to "+fmtG(opening)+" domestic (+"+fmtM(opening*0.53)+" rentals this week).","gold");
  if(advTotal>0) log("🎟 Advance sales: "+fmtM(advTotal)+" banked for \""+film.title+"\" — opening day landed stronger.","");
  if(locCost>0) log("🌍 Dubbing & localization for "+(locTargets.length?locTargets.length+" targeted market(s)":"home markets")+": −"+fmtM(locCost)+" (dubs, subs, local P&A materials).","");
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
    // v17: Economic cycle box office multiplier
    if(typeof econBoxOfficeMult==="function") gross *= econBoxOfficeMult();
    f.weeksOut++;
    if(gross < Math.max(0.3, f.opening*0.006) || f.weeksOut>16){
      endTheatrical(f); continue;
    }
    // v17: Multi-territory gross breakdown
    if(typeof calcTerritoryGross==="function"){
      calcTerritoryGross(f, gross);
      f.dom += gross; // track domestic (US/CA) gross
      const rentals = gross*0.53;
      earn("theatrical", rentals);
      f.rentalsDom = (f.rentalsDom||0) + rentals;
    }else{
      f.dom += gross;
      const rentals = gross*0.53;
      earn("theatrical", rentals);
      f.rentalsDom = (f.rentalsDom||0) + rentals;
    }
    f.weekly.push({w:G.week, gross});
  }
}

/* ── v17: Multi-Territory Box Office ── */
const _territoryCache = new Map();
function calcTerritoryGross(film, weekGross){
  const genre = film.genre;
  const cacheKey = genre + "|" + Math.round(weekGross);
  if(_territoryCache.has(cacheKey)) return _territoryCache.get(cacheKey);
  
  const territories = DATA.TERRITORIES || [];
  const results = {};
  let total = 0;
  for(const t of territories){
    const genreMult = t.genre[genre] || 1.0;
    const riskMult = 1 - (t.risk || 0);
    const piracyMult = 1 - clamp((t.piracy||0)/100,0,1)*0.1;
    const share = t.share || 0;
    const gross = Math.round(weekGross * share * genreMult * riskMult * piracyMult * 10)/10;
    results[t.id] = gross;
    total += gross;
  }
  const result = { total, territories: results };
  _territoryCache.set(cacheKey, result);
  if(_territoryCache.size > 500) _territoryCache.clear(); // prevent memory bloat
  return result;
}

/* ── v17: Economic Cycles ── */
function tickEconomyCycle(){
  if(!G.econCycle) G.econCycle = { phase:"normal", weeksLeft:rint(104,208) };
  G.econCycle.weeksLeft--;
  if(G.econCycle.weeksLeft <= 0){
    const phases = DATA.ECON_CYCLES || [];
    const currentIdx = phases.findIndex(p=>p.id===G.econCycle.phase);
    let nextIdx = currentIdx;
    // Weighted random transition
    if(currentIdx===0){ nextIdx = chance(0.3)?1:0; } // boom -> normal
    else if(currentIdx===1){ nextIdx = chance(0.15)?0 : chance(0.15)?2 : chance(0.05)?3 : 1; } // normal -> boom/recession/streamglut
    else if(currentIdx===2){ nextIdx = chance(0.4)?1:2; } // recession -> normal
    else if(currentIdx===3){ nextIdx = chance(0.3)?1:3; } // streamglut -> normal
    if(nextIdx !== currentIdx){
      const old = G.econCycle.phase;
      G.econCycle.phase = phases[nextIdx].id;
      G.econCycle.weeksLeft = rint(phases[nextIdx].dur[0], phases[nextIdx].dur[1]);
      log("🏭 Economy shifts: "+phases[currentIdx].name+" → "+phases[nextIdx].name+". "+phases[nextIdx].desc,"gold");
      // Apply immediate effects
      if(G.econCycle.phase==="boom"){ G.infl = Math.min(1.08, G.infl*1.02); }
      else if(G.econCycle.phase==="recession"){ G.infl = Math.max(0.98, G.infl*0.98); }
    }else{
      G.econCycle.weeksLeft = rint(phases[currentIdx].dur[0], phases[currentIdx].dur[1]);
    }
  }
}
function econBoxOfficeMult(){
  const cycle = DATA.ECON_CYCLES.find(c=>c.id===G.econCycle?.phase);
  return cycle ? cycle.boxOffice : 1.0;
}
function econLoanRateMult(){
  const cycle = DATA.ECON_CYCLES.find(c=>c.id===G.econCycle?.phase);
  return cycle ? cycle.loanRate : 1.0;
}
function econStreamChurnMult(){
  const cycle = DATA.ECON_CYCLES.find(c=>c.id===G.econCycle?.phase);
  return cycle ? cycle.streamChurn : 1.0;
}

/* ── v17: Franchise Universe Graph builder ── */
function buildUniverseGraph(){
  const nodes = [];
  const edges = [];
  // Films from franchises
  for(const fr of G.franchises){
    for(const entry of fr.entries){
      const f = G.films.find(x=>x.id===entry.id);
      if(f) nodes.push({ id:"f"+f.id, type:"film", label:f.title, franchise:fr.name, year:f.year, gross:f.ww });
    }
    // TV series in franchise
    for(const s of G.series){
      if(s.franchiseName===fr.name){
        nodes.push({ id:"s"+s.id, type:"tv", label:s.title, franchise:fr.name, seasons:s.seasons.length, viewers:s.totalViewers });
        edges.push({ from:"f"+fr.entries[0].id, to:"s"+s.id, type:"spin-off" });
      }
    }
    // Games in franchise
    if(G.gamesDiv && G.gamesDiv.released){
      for(const g of G.gamesDiv.released){
        if(g.franchiseName===fr.name){
          nodes.push({ id:"g"+g.id, type:"game", label:g.title, franchise:fr.name, score:g.score, revenue:g.total });
          edges.push({ from:"f"+fr.entries[0].id, to:"g"+g.id, type:"game-adaptation" });
        }
      }
    }
    // Merch/Parks
    if(fr.merch>=1) nodes.push({ id:"m"+fr.id, type:"merch", label:fr.name+" Merch", franchise:fr.name, tier:fr.merch });
    if(fr.park>=1) nodes.push({ id:"p"+fr.id, type:"park", label:fr.name+" Park", franchise:fr.name, tier:fr.park });
  }
  return { nodes, edges };
}

/* ── v17: Geopolitical Events (data in DATA.GEO_EVENTS) ── */
function tryGeoEvent(){
  if(!DATA.GEO_EVENTS || !DATA.GEO_EVENTS.length) return;
  for(const evt of DATA.GEO_EVENTS){
    if(!G.geoEvents) G.geoEvents = {};
    if(G.geoEvents[evt.id]) continue; // already active or done
    if(chance(0.008)){ // ~0.8% chance per week
      G.geoEvents[evt.id] = { week:G.week, dur:evt.dur };
      log("🌍 "+evt.name+" — "+evt.desc,"gold");
      // Apply immediate effects
      if(evt.boxOfficeMult===0){
        for(const f of G.films){
          if(f.inTheaters){
            f.territoryGross = f.territoryGross || {};
            for(const tid of evt.territories) f.territoryGross[tid] = 0;
          }
        }
      }
    }
  }
  // Tick active events
  for(const id in G.geoEvents){
    const e = G.geoEvents[id];
    e.dur--;
    if(e.dur <= 0){
      const evt = DATA.GEO_EVENTS.find(x=>x.id===id);
      if(evt) log("🌍 "+evt.name+" has passed.","");
      delete G.geoEvents[id];
    }
  }
}

/* ── v17: Executive Office View state ── */
function execOfficeState(){
  return {
    scriptsPending: G.ideas.filter(i=>!i.pitch).length,
    filmsInProduction: G.projects.filter(p=>p.kind==="film"&&p.phase!=="ready").length,
    filmsReady: G.projects.filter(p=>p.kind==="film"&&p.phase==="ready"&&!p.releaseWeek).length,
    unreadMail: unreadMail(),
    awardsCount: (G.stats.awards||[]).length,
    franchises: G.franchises.length,
    streamerSubs: G.streamer? G.streamer.subs : 0,
  };
}

/* ═══════════ v20: Director's Cut DLC ── */
function releaseDirectorsCut(filmId){
  const f = G.films.find(x=>x.id===filmId);
  if(!f) return {ok:false, err:"Film not found"};
  if(!f.director) return {ok:false, err:"No director attached"};
  const age = G.week - (f.releaseWeek||G.week);
  if(age < (DATA.DIRECTORS_CUT?.minFilmAge||12)) return {ok:false, err:"Film too recent (need 12+ weeks)"};
  if((f.quality?.overall||0) < (DATA.DIRECTORS_CUT?.minScore||70)) return {ok:false, err:"Quality too low (need 70+)"};
  if(f.directorsCut) return {ok:false, err:"Director's Cut already released"};
  if(G.studio.cash < (DATA.DIRECTORS_CUT?.cost||5)) return {ok:false, err:"Insufficient funds"};
  spend("marketing", DATA.DIRECTORS_CUT.cost);
  f.directorsCut = true;
  const opening = Math.round((f.opening||0) * (DATA.DIRECTORS_CUT.openingMult||0.30));
  const runWeeks = DATA.DIRECTORS_CUT.runWeeks || 4;
  const dcFilm = {
    id:nid(), title:f.title+" (Director's Cut)", genre:f.genre, scale:"indie",
    budget:DATA.DIRECTORS_CUT.cost, marketing:DATA.DIRECTORS_CUT.cost,
    director:f.director, cast:f.cast, writer:f.writer, producer:f.producer,
    opening, releaseWeek:G.week, week:G.week, inTheaters:true, weeksOut:0,
    directorCut:true, parentId:f.id,
  };
  G.films.push(dcFilm);
  log("🎬 DIRECTOR'S CUT: \""+f.title+"\" re-released — "+fmtM(opening)+" opening, 4-week run.","gold");
  saveGame();
  return {ok:true, film:dcFilm};
}

/* ── v20: Documentary Arm ── */
function greenlightDocumentary(cfg){
  const budget = cfg.budget || rint(DATA.DOCUMENTARY.budgetMin, DATA.DOCUMENTARY.budgetMax);
  if(G.studio.cash < budget) return {ok:false, err:"Insufficient funds"};
  spend("development", budget);
  const doc = {
    id:nid(), title:cfg.title||makeTitle("documentary"), genre:"documentary", scale:"indie",
    budget, marketing:Math.round(budget*0.5), director:cfg.director, writer:cfg.writer,
    producer:cfg.producer, cast:[], releaseWeek:0, inTheaters:false, streamingOriginal:false,
    documentary:true, awardsWeight:DATA.DOCUMENTARY.awardsWeight||1.8,
  };
  G.projects.push(doc);
  log("🎥 DOCUMENTARY GREENLIT: \""+doc.title+"\" — $"+budget+"M, awards prestige.","gold");
  saveGame();
  return {ok:true, project:doc};
}

/* ── v20: Podcast / Audio Drama ── */
function launchPodcast(franchiseId){
  const fr = G.franchises.find(x=>x.id===franchiseId);
  if(!fr) return {ok:false, err:"Franchise not found"};
  if(fr.podcast) return {ok:false, err:"Podcast already launched"};
  const cost = DATA.PODCAST?.cost||0.5;
  if(G.studio.cash < cost) return {ok:false, err:"Insufficient funds"};
  spend("marketing", cost);
  fr.podcast = true;
  fr.podcastWeeks = 0;
  G.studio.rep = clamp(G.studio.rep + (DATA.PODCAST.repGain||1), 5, 99);
  log("🎙️ PODCAST LAUNCHED: "+fr.name+" — $"+cost+"M, +0.5M subs/wk for 12 weeks.","gold");
  saveGame();
  return {ok:true};
}

function tickPodcasts(){
  for(const fr of G.franchises){
    if(fr.podcast && !fr.podcastDone){
      fr.podcastWeeks = (fr.podcastWeeks||0) + 1;
      if(G.streamer){
        const boost = DATA.PODCAST.subsPerWeek||0.5;
        G.streamer.subs = Math.round((G.streamer.subs + boost)*100)/100;
      }
      if(fr.podcastWeeks >= 12){
        fr.podcastDone = true;
        log("🎙️ "+fr.name+" podcast completed its run.","gold");
      }
    }
  }
}

/* ── v20: Animated Series → Film Pipeline ── */
function checkAnimatedPipeline(){
  for(const s of G.series){
    if(s.genre==="animation" && s.seasons?.length >= (DATA.ANIMATED_PIPELINE.seasonsToUnlock||2) && !s.filmFastTrack){
      s.filmFastTrack = true;
      log("🎬 ANIMATED PIPELINE: \""+s.title+"\" unlocked theatrical fast-track (+15% opening, family bonus).","gold");
    }
  }
}

function animatedFastTrackBonus(film){
  if(film.animatedFastTrack) return DATA.ANIMATED_PIPELINE.fastTrackOpeningMult||1.15;
  if(film.genre==="animation" && film.familyBonus) return DATA.ANIMATED_PIPELINE.familyBonus||1.20;
  return 1.0;
}

/* ── v20: Foreign Co-production ── */
function addCoProduction(filmId, partnerId){
  const f = G.projects.find(p=>p.id===filmId) || G.films.find(f=>f.id===filmId);
  if(!f) return {ok:false, err:"Project not found"};
  const partner = DATA.COPRO_PARTNERS.find(p=>p.id===partnerId);
  if(!partner) return {ok:false, err:"Partner not found"};
  if(f.coProduction) return {ok:false, err:"Already has co-production partner"};
  const share = partner.budgetShare || 0.5;
  const upfront = Math.round(f.budget * share * 10)/10;
  f.coProduction = {partner:partnerId, share, upfront, territories:partner.territoryBoost||{}};
  earn("financing", upfront);
  // Apply territory boosts
  for(const [tid, mult] of Object.entries(partner.territoryBoost||{})){
    f.territoryBoost = f.territoryBoost||{};
    f.territoryBoost[tid] = (f.territoryBoost[tid]||1) * mult;
  }
  log("🤝 CO-PRODUCTION: \""+f.title+"\" partnered with "+partner.name+" — +"+fmtM(upfront)+" upfront, territory boosts applied.","gold");
  saveGame();
  return {ok:true, upfront, boosts:partner.territoryBoost};
}

/* ═══════════ v21: Talent Strikes ── */
function initGuildMeters(){
  if(!G.guildMeters){
    G.guildMeters = {};
    DATA.GUILDS.forEach(g=>{
      G.guildMeters[g.id] = { meter:rint(10,40), strikeActive:false, weeksLeft:0, settled:true };
    });
  }
}

function tickGuildMeters(){
  initGuildMeters();
  DATA.GUILDS.forEach(g=>{
    const gm = G.guildMeters[g.id];
    if(gm.strikeActive){
      gm.weeksLeft--;
      if(gm.weeksLeft <= 0){
        gm.strikeActive = false;
        gm.settled = true;
        gm.meter = Math.max(10, gm.meter - 20);
        log("✊ "+g.name+" strike ended — productions resume. Meter reset to "+gm.meter+".","good");
      }
      return;
    }
    if(gm.settled) return;
    // Meter drifts up weekly
    gm.meter = Math.min(100, gm.meter + rint(1,3));
    if(gm.meter >= g.strikeAt && chance(0.3)){
      gm.strikeActive = true;
      gm.weeksLeft = rint(g.settleWeeks[0], g.settleWeeks[1]);
      gm.settled = false;
      log("✊ "+g.name+" STRIKE! All "+g.role+"s walk out for "+gm.weeksLeft+" weeks.","bad");
    }
  });
}

function settleGuildStrike(guildId){
  const g = DATA.GUILDS.find(x=>x.id===guildId);
  if(!g) return {ok:false};
  const gm = G.guildMeters[g.id];
  if(!gm.strikeActive) return {ok:false, err:"No active strike"};
  const cost = rint(g.settleCost[0], g.settleCost[1]);
  if(G.studio.cash < cost) return {ok:false, err:"Insufficient funds"};
  spend("studio", cost);
  gm.strikeActive = false;
  gm.weeksLeft = 0;
  gm.meter = Math.max(10, gm.meter - 30);
  gm.settled = true;
  log("✊ "+g.name+" strike settled for "+fmtM(cost)+". Meter: "+gm.meter+".","good");
  saveGame();
  return {ok:true, cost};
}

function preemptiveGuildContract(guildId){
  const g = DATA.GUILDS.find(x=>x.id===guildId);
  if(!g) return {ok:false};
  const cost = g.preemptiveCost;
  if(G.studio.cash < cost) return {ok:false, err:"Insufficient funds"};
  spend("studio", cost);
  G.guildMeters[g.id].meter = Math.max(0, G.guildMeters[g.id].meter - 40);
  log("📝 Pre-emptive "+g.name+" contract signed ("+fmtM(cost)+"). Meter reduced.","good");
  saveGame();
  return {ok:true, cost};
}

/* ── v21: Casting Scandal ── */
function triggerCastingScandal(){
  const execs = G.talent.filter(t=>t.kind==="producer" || (t.kind==="director" && t.power>=4));
  if(!execs.length) return;
  const target = pick(execs);
  if(chance(DATA.CASTING_SCANDAL.baseChance)){
    G.pendingScandal = { target:target.id, week:G.week };
    log("📰 CASTING SCANDAL: "+target.name+" (power "+target.power+"★) embroiled in controversy.","bad");
  }
}

function resolveCastingScandal(action, usePR){
  const s = G.pendingScandal;
  if(!s) return {ok:false};
  const t = G.talent.find(x=>x.id===s.target);
  if(!t) return {ok:false};
  const cost = usePR ? DATA.CASTING_SCANDAL.prFirmCost : 0;
  if(cost && G.studio.cash < cost) return {ok:false, err:"Insufficient funds for PR firm"};
  if(cost) spend("studio", cost);
  if(action==="settle"){
    spend("studio", DATA.CASTING_SCANDAL.settleCost);
    G.studio.rep = clamp(G.studio.rep - 5, 5, 99);
    if(t) t.scandal = (t.scandal||0) + 52;
    log("📰 Scandal settled: paid "+fmtM(DATA.CASTING_SCANDAL.settleCost)+", exec removed, rep -5.","bad");
  }else if(action==="fight"){
    if(usePR && chance(0.5)) usePR = false; // PR firm may not help
    const clear = chance(DATA.CASTING_SCANDAL.fightClearChance);
    if(clear){
      G.studio.rep = clamp(G.studio.rep + 2, 5, 99);
      log("📰 Fight won: scandal cleared, rep +2.","good");
    }else{
      G.studio.rep = clamp(G.studio.rep - 15, 5, 99);
      if(t) t.scandal = (t.scandal||0) + 104;
      log("📰 Fight lost: scandal escalates, rep -15, exec radioactive.","bad");
    }
  }
  G.pendingScandal = null;
  saveGame();
  return {ok:true};
}

/* ── v21: Script Auction Bidding War ── */
function triggerScriptAuction(ideaId){
  const idea = G.ideas.find(i=>i.id===ideaId);
  if(!idea || idea.script < DATA.SCRIPT_AUCTION.qualityThreshold) return null;
  const rivals = rint(...DATA.SCRIPT_AUCTION.rivalBidders);
  G.pendingAuction = {
    ideaId: ideaId,
    rounds: DATA.SCRIPT_AUCTION.rounds,
    currentRound: 1,
    playerBid: 0,
    rivalBids: Array(rivals).fill().map(()=>rint(5,25)),
    playerWon: false,
  };
  log("🎬 SCRIPT AUCTION: \""+idea.title+"\" (quality "+idea.script+") — "+rivals+" rival bidders. 3 rounds.","gold");
  return G.pendingAuction;
}

function bidScriptAuction(bid){
  const a = G.pendingAuction;
  if(!a) return {ok:false};
  if(G.studio.cash < bid) return {ok:false, err:"Insufficient funds"};
  a.playerBid = bid;
  // Rivals counter-bid
  a.rivalBids = a.rivalBids.map(b=>b + rint(2,8));
  a.currentRound++;
  if(a.currentRound > 3){
    // Determine winner
    const maxBid = Math.max(a.playerBid, ...a.rivalBids);
    if(a.playerBid === maxBid){
      a.playerWon = true;
    }
    return resolveScriptAuction();
  }
  log("🎬 Auction Round "+(a.currentRound-1)+": your bid "+fmtM(bid)+", rivals: "+a.rivalBids.map(fmtM).join(", ")+".","");
  saveGame();
  return {ok:true, round:a.currentRound, rivalBids:a.rivalBids};
}

function resolveScriptAuction(){
  const a = G.pendingAuction;
  if(!a) return {ok:false};
  if(a.playerWon){
    const idea = G.ideas.find(i=>i.id===a.ideaId);
    if(!idea) return {ok:false};
    spend("development", a.playerBid);
    idea.auctionWon = true;
    idea.auctionPrice = a.playerBid;
    log("🎬 AUCTION WON: \""+idea.title+"\" secured for "+fmtM(a.playerBid)+"M!","gold");
  }else{
    log("🎬 Auction lost: rival secured the script for "+fmtM(Math.max(...a.rivalBids))+"M.","bad");
  }
  G.pendingAuction = null;
  saveGame();
  return {ok:true, won:a.playerWon};
}

/* ── v21: Streaming vs Theatrical War Meter ── */
function initWarMeter(){
  if(!G.warMeter) G.warMeter = DATA.WAR_METER.start;
}

function adjustWarMeter(delta){
  initWarMeter();
  G.warMeter = clamp(G.warMeter + delta, 0, 100);
  const wm = DATA.WAR_METER;
  if(G.warMeter <= 30){
    log("🏛 WAR METER: "+G.warMeter+" (Theatrical dominance — theatrical +15%, streaming slows).","gold");
  }else if(G.warMeter >= 70){
    log("📺 WAR METER: "+G.warMeter+" (Streaming dominance — streaming +15%, theatrical -15%).","gold");
  }else{
    log("⚖️ WAR METER: "+G.warMeter+" (Balanced).","");
  }
}

function getWarMeterMult(){
  initWarMeter();
  const wm = DATA.WAR_METER;
  if(G.warMeter <= 30) return { theatrical:1.15, streaming:0.95 };
  if(G.warMeter >= 70) return { theatrical:0.85, streaming:1.15 };
  return { theatrical:1.0, streaming:1.0 };
}

/* ═══════════ v24: Rival AI Personalities + Memory ── */
function initRivalAI(){
  if(!G.rivalAI) G.rivalAI = {};
  G.rivals.forEach(r=>{
    if(!G.rivalAI[r.name]){
      const pers = pick(DATA.RIVAL_PERSONALITIES);
      G.rivalAI[r.name] = {
        personality: pers.id,
        traits: {...pers.traits},
        memory: [],
        trust: 50,
        lastDealWeek: 0
      };
    }
  });
}

function getRivalAI(name){
  initRivalAI();
  return G.rivalAI[name];
}

function addRivalMemory(rivalName, type, details){
  const ai = getRivalAI(rivalName);
  if(!ai) return;
  const mem = DATA.RIVAL_MEMORY;
  ai.memory.push({type, details, week:G.week, weight:mem.weights[type]||1.0});
  if(ai.memory.length > mem.maxEntries) ai.memory.shift();
  if(type==="deal") ai.trust = Math.min(100, ai.trust + 5);
  else if(type==="poach" || type==="acquire") ai.trust = Math.max(0, ai.trust - 10);
  else if(type==="deal_rejected") ai.trust = Math.max(0, ai.trust - 5);
}

function decayRivalMemory(){
  const mem = DATA.RIVAL_MEMORY;
  Object.values(G.rivalAI||{}).forEach(ai=>{
    ai.memory.forEach(m=>{ m.weight *= mem.decayRate; });
    ai.memory = ai.memory.filter(m=>m.weight > 0.1);
  });
}

function getRivalTrust(rivalName){
  const ai = getRivalAI(rivalName);
  return ai ? ai.trust : 50;
}

function rivalDecisionGreenlight(rival, project){
  const ai = getRivalAI(rival.name);
  if(!ai) return {greenlight: true, budgetMult: 1.0};
  const t = ai.traits;
  let prob = 0.7;
  if(t.genrePref.includes(project.genre)) prob += 0.15;
  if(project.budget > rival.cash * 0.5) prob -= 0.2;
  prob *= t.riskTolerance;
  const recentPoach = ai.memory.some(m=>m.type==="poach" && G.week - m.week < 10);
  if(recentPoach) prob *= 0.8;
  return {greenlight: Math.random() < prob, budgetMult: t.budgetMult, marketingMult: t.marketingMult};
}

function rivalDecisionPoach(rival, talent){
  const ai = getRivalAI(rival.name);
  if(!ai) return false;
  const t = ai.traits;
  if(Math.random() > t.poachChance) return false;
  const fee = actorFee(talent);
  if(fee > rival.cash * 0.3) return false;
  const recent = ai.memory.some(m=>m.type==="poach" && m.details?.targetStudio===G.studio.name && G.week - m.week < 20);
  if(recent) return false;
  return Math.random() < 0.7;
}

function rivalDecisionAcquire(rival, targetRival){
  const ai = getRivalAI(rival.name);
  if(!ai) return false;
  const t = ai.traits;
  if(Math.random() > t.acquireChance) return false;
  const price = targetRival.ytd * 3;
  if(rival.cash < price * 1.2) return false;
  return Math.random() < 0.5;
}

function tickRivalAI(){
  initRivalAI();
  decayRivalMemory();
  G.rivals.forEach(r=>{
    if(!r.slate) r.slate = [];
    const ai = getRivalAI(r.name);
    if(!ai) return;
    if(r.slate.length < 3 && Math.random() < 0.3){
      // Simplified: would create rival project
    }
    if(Math.random() < 0.1){
      // Poaching logic
    }
    if(Math.random() < 0.05){
      // Acquisition logic
    }
  });
}

/* ── v21: AI-Generated Film ── */
function greenlightAIFilm(cfg){
  const budget = DATA.AI_FILM.budget;
  if(G.studio.cash < budget) return {ok:false, err:"Insufficient funds"};
  spend("development", budget);
  const p = {
    id:nid(), kind:"film", title:cfg.titleOverride || makeTitle("scifi")+" (AI)", genre:"scifi", scale:"indie",
    script: DATA.AI_FILM.qualityRange[0] + rint(0, DATA.AI_FILM.qualityRange[1]-DATA.AI_FILM.qualityRange[0]),
    blurb: "AI-generated concept", hot:false,
    budget: budget, budget0: budget, overrun:0, spent:0,
    devCost: devCostOf({scale:"indie", genre:"scifi", hot:false, script:65}),
    director:null, writer:null, producer:null, cast:[], cameo:null,
    phase:"pre", phaseWeek:0,
    phaseLen:{ pre:2, shoot:4, post:3 },
    releaseWeek:0, marketing:0, marketingPaid:0,
    franchise: false, sequelOf:null,
    buzzBonus: 0, awareness:0,
    strikePause:0,
    rating: "PG-13",
    location: "home",
    foreignLang: false,
    rewritten:false, tested:false, reshoot:false,
    pattern:"wide", rollout:"day", window:45, imax:false, premium:false, soundtrack:false, dayAndDate:false,
    writerBonus:0,
    aiCast:true, aiScript:true,
    rebateEarned:0,
    coProd:null,
    mktBoosts:[],
  };
  p.promoOwed = 0;
  G.projects.push(p);
  adjustWarMeter(DATA.AI_FILM.warMeterPush);
  log("🤖 AI FILM GREENLIT: \""+p.title+"\" — $"+budget+"M, quality "+p.script+". War meter +"+DATA.AI_FILM.warMeterPush+".","gold");
  return {ok:true, project:p};
}

/* ═══════════ v22: Production Chaos Engine ── */
function triggerChaosEvent(){
  // Only trigger during active production (shoot or post phase)
  const inProd = G.projects.filter(p=>p.phase==="shoot" || p.phase==="post");
  if(!inProd.length) return;
  // ~1% chance per week per production
  const target = pick(inProd);
  if(chance(0.01)){
    const evt = pick(DATA.CHAOS_EVENTS);
    G.pendingChaos = { projectId:target.id, event:evt, week:G.week };
    log("⚡ PRODUCTION CHAOS: \""+target.title+"\" — "+evt.name+". "+evt.desc,"bad");
  }
}

function resolveChaosEvent(choice){
  const c = G.pendingChaos;
  if(!c) return {ok:false};
  const p = G.projects.find(x=>x.id===c.projectId);
  const evt = c.event;
  if(!p || !evt) return {ok:false};
  let result = {ok:true};
  
  if(evt.id==="location_fire"){
    p.phaseLen.shoot = (p.phaseLen.shoot||0) + evt.delay;
    if(p.insured){ earn("insurance", evt.cost); log("🔥 Location fire covered by insurance — $"+fmtM(evt.cost)+" refunded.","good"); }
    else { spend("production", evt.cost); log("🔥 Location fire — +"+evt.delay+" weeks, −"+fmtM(evt.cost)+"M.","bad"); }
  }else if(evt.id==="lead_injury"){
    if(choice==="recast" && G.studio.cash >= evt.recastCost){
      spend("production", evt.recastCost);
      p.phaseLen.shoot = (p.phaseLen.shoot||0) + 1; // recast takes 1 week
      log("🤕 Lead recast for $"+fmtM(evt.recastCost)+"M — +1 week delay.","");
    }else{
      p.phaseLen.shoot = (p.phaseLen.shoot||0) + evt.delay;
      log("🤕 Lead injured — production paused "+evt.delay+" weeks.","bad");
    }
  }else if(evt.id==="director_walkout"){
    if(choice==="pay" && G.studio.cash >= evt.cost){
      spend("production", evt.cost);
      log("🚪 Director retained for $"+fmtM(evt.cost)+"M.","good");
    }else{
      p.quality = (p.quality||{}).overall ? clamp(p.quality.overall - evt.qualityHit, 10, 99) : 50;
      log("🚪 Director walked — quality −"+evt.qualityHit+".","bad");
    }
  }else if(evt.id==="budget_overrun"){
    const overrun = Math.round((p.budget - (p.spent||0)) * evt.overrunPct * 10)/10;
    p.overrun = (p.overrun||0) + overrun;
    log("💸 Budget overrun — remaining budget +"+evt.overrunPct*100+"% ("+fmtM(overrun)+"M).","bad");
  }else if(evt.id==="script_leak"){
    p.buzzBonus = (p.buzzBonus||0) + evt.hype/100;
    p.openingHit = (p.openingHit||0) + evt.openingHit;
    log("📰 Script leaked — hype +"+evt.hype+" but opening −"+(evt.openingHit*100)+"%.","");
  }else if(evt.id==="star_scandal"){
    if(choice==="reshoot" && G.studio.cash >= evt.reshootCost){
      spend("production", evt.reshootCost);
      log("⭐ Star scandal — reshot without star for $"+fmtM(evt.reshootCost)+"M.","");
    }else{
      p.quality = (p.quality||{}).overall ? clamp(p.quality.overall - evt.scoreHit, 10, 99) : 50;
      log("⭐ Star scandal — released as-is, quality −"+evt.scoreHit+".","bad");
    }
  }
  
  G.pendingChaos = null;
  saveGame();
  return result;
}

/* ── v22: Gemini AI Pitch Generator ── */
async function geminiPitch(concept){
  if(!process.env.GEMINI_API_KEY) return {ok:false, err:"GEMINI_API_KEY not set in environment"};

  const prompt = DATA.GEMINI.pitchPrompt + "\n\nUser concept: " + concept;

  try{
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
      method:"POST",
      headers:{"Content-Type":"application/json", "x-goog-api-key": process.env.GEMINI_API_KEY},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const json = JSON.parse(text);
    return {ok:true, pitch:json};
  }catch(e){
    return {ok:false, err:e.message};
  }
}

function openAIPitchModal(){
  let h="<h3>🤖 AI Pitch Generator</h3>"+
    "<div class='tiny muted' style='margin-bottom:12px'>Describe your film concept in plain English. Gemini will return a structured pitch.</div>"+
    "<textarea id='aiPitchInput' placeholder='e.g. A retired stuntman discovers a portal to 1920s Hollywood...' style='width:100%;min-height:80px;background:#0b0f18;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:10px;font-family:inherit;resize:vertical'></textarea>"+
    "<div class='modal-actions' style='margin-top:12px'>"+
    "<button class='btn btn-primary' onclick='generateAIPitch()'>Generate Pitch</button>"+
    "<button class='btn btn-ghost' onclick='closeModal()'>Cancel</button></div>"+
    "<div id='aiPitchResult' style='margin-top:12px'></div>";
  openModal(h);
}

async function generateAIPitch(){
  const input = document.getElementById("aiPitchInput");
  const resultEl = document.getElementById("aiPitchResult");
  if(!input?.value?.trim()){ beep("bad"); return; }
  resultEl.innerHTML = "<div class='tiny muted'>Generating...</div>";
  
  const res = await geminiPitch(input.value.trim());
  if(!res.ok){
    resultEl.innerHTML = "<div class='tiny neg'>Error: "+esc(res.err)+"</div>";
    beep("bad");
    return;
  }
  
  const p = res.pitch;
  // Pre-fill greenlight wizard
  WZ = {
    mode:"filmPitch", genre:p.genre, scale:p.scale, budget:p.budgetEstimate,
    rating:"PG-13", location:"home", pattern:"wide", rollout:"day", window:45,
    imax:false, premium:false, soundtrack:false, dayAndDate:false, scriptPolish:false,
    director:null, writer:null, producer:null, cast:[],
    titleOverride:p.title
  };
  
  resultEl.innerHTML = "<div class='card'><b>"+esc(p.title)+"</b> <span class='tag gold'>"+p.scale+"</span> <span class='tag'>"+p.genre+"</span>"+
    "<div class='tiny muted' style='margin-top:4px'>"+esc(p.tagline)+"</div>"+
    "<div class='cost-line'><span>Budget est.</span><b>"+fmtM(p.budgetEstimate)+"M</b></div>"+
    "<div class='cost-line'><span>Pred. score</span><b>"+p.predictedScore+"/100</b></div>"+
    "<div class='tiny muted' style='margin-top:6px'>Cast: "+p.castSuggestions.join(", ")+"</div>"+
    "<div class='tiny muted'>"+esc(p.concept)+"</div>"+
    "<button class='btn btn-sm btn-primary' style='margin-top:8px;width:100%' onclick='closeModal(); startFilmPitchWizard()'>Open in Greenlight Wizard</button></div>";
  beep("gold");
}

/* ═══════════ box office depth (v12): daily split, screens, advance sales, chains ═══════════
   Everything here is either a read-only derivation from stored fields (same
   result every read) or a bounded tick. The opening weekend splits Fri/Sat/Sun
   by genre temper; screens come from scale + theater-chain relations; advance
   sales bank weekly before release and lift the opening at most +6%. */

/* Fri/Sat/Sun split of the opening weekend (§11). Genre sets the temper —
   horror front-loads Friday, family films go Saturday-heavy — and audience
   WOM bends it: loved films hold the back half of the weekend. Totals always
   re-sum to the stored opening, so domestic never moves. */
function weekendDaily(f){
  const shapes={
    horror:[0.46,0.31,0.23], concert:[0.50,0.29,0.21], thriller:[0.40,0.34,0.26],
    action:[0.38,0.36,0.26], scifi:[0.37,0.36,0.27], western:[0.31,0.38,0.31], war:[0.32,0.38,0.30],
    animation:[0.26,0.44,0.30], fantasy:[0.30,0.41,0.29], comedy:[0.32,0.40,0.28], romance:[0.30,0.40,0.30],
    musical:[0.31,0.41,0.28], drama:[0.29,0.38,0.33], sports:[0.34,0.39,0.27], truecrime:[0.34,0.36,0.30],
  };
  const base=shapes[f.genre]||[0.34,0.38,0.28];
  const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
  const hold=clamp((aud-50)/100,-0.5,0.5);
  const wob=((((f.id||0)*7)%5)-2)/100;
  let fri=base[0]-hold*0.05+wob, sat=base[1]+hold*0.01, sun=base[2]+hold*0.04-wob;
  fri=clamp(fri,0.15,0.60); sat=clamp(sat,0.15,0.55); sun=clamp(sun,0.10,0.45);
  const open=Math.max(0,f.opening||0), tot=fri+sat+sun||1;
  return [{day:"Fri",gross:Math.round(open*fri/tot*10)/10},
          {day:"Sat",gross:Math.round(open*sat/tot*10)/10},
          {day:"Sun",gross:0}].map((r,i,arr)=>{ if(i===arr.length-1) r.gross=Math.round((open-arr[0].gross-arr[1].gross)*10)/10; return r; });
}

/* Peak screen count (§12): anchored to release scale and pattern, nudged by
   theater-chain relations and taste. Platform rollouts book a fraction. */
function screensOf(f){
  if(f.streamingOriginal) return 0;
  const base={indie:600, mid:2800, tentpole:4300}[f.scale]||2800;
  const pat=DATA.PATTERNS?DATA.PATTERNS.find(x=>x.id===(f.pattern||"wide")):null;
  let screens=Math.round(base*(pat&&pat.id==="platform"?0.12:1)*chainScreenMult(f));
  if(f.premium||f.imax) screens=Math.round(screens*1.02);
  return clamp(screens, 60, 4800);
}

/* Per-week exhibition rows from the stored weekly grosses: screens shrink
   through the run (~13%/wk, floored at 12% of peak), per-screen average follows
   the gross, occupancy reads against a sold-out week (~$48K/screen), and the
   WoW% column exposes the decay the engine has always run. */
function screenWeeks(f){
  const peak=screensOf(f);
  return (f.weekly||[]).map((wk,i)=>{
    const screens=Math.max(Math.round(peak*0.12), Math.round(peak*Math.pow(0.87,i)));
    const psa=Math.round(wk.gross*1000/Math.max(1,screens));
    const occ=clamp(Math.round(psa/48*100),2,98);
    const wow=i>0?Math.round((wk.gross/Math.max(0.001,f.weekly[i-1].gross)-1)*100):null;
    return {w:wk.w, gross:wk.gross, wow, screens, psa, occ};
  });
}

/* City-level breakdown (§26): top three regions, top three cities each.
   Fictional names per region (DATA.CITIES); splits are deterministic from the
   film id, so totals always re-sum to the region's gross. */
function cityRows(f){
  let regs=f.regions;
  try{ if(!regs||!regs.length) regs=regionSplit(f); }catch(e){ return []; }
  return regs.slice().sort((a,b)=>b.gross-a.gross).slice(0,3).map((r,ri)=>{
    const names=(DATA.CITIES&&DATA.CITIES[r.id])||["Capital City","Old Town","The Suburbs"];
    const ws=[0.46,0.32,0.22].map((w,ci)=>w+(((((f.id||0)*7+ri*13+ci*5)%7)-3)/120));
    const tot=ws.reduce((a,b)=>a+b,0)||1;
    let acc=0;
    const cities=names.map((nm,ci)=>{
      const gross=Math.round(r.gross*ws[ci]/tot*10)/10; acc+=gross;
      return {name:nm, gross};
    });
    if(cities.length) cities[cities.length-1].gross=Math.round((r.gross-acc+cities[cities.length-1].gross)*10)/10;
    return {region:r, cities};
  });
}

/* ── theater chains (§22): relation is courted, friendship books screens ──
   G.chains persists only {id, rel}; the definitions (name, screens, taste)
   live in DATA.CHAINS. chainById merges the two — everything reads through it. */
function chainById(id){
  const d=(DATA.CHAINS||[]).find(c=>c.id===id);
  if(!d) return null;
  const c=((G&&G.chains)||[]).find(x=>x.id===id);
  return {...d, rel:(c&&Number.isFinite(c.rel))? c.rel : d.rel};
}
function chainScreenMult(f){
  let m=1;
  (DATA.CHAINS||[]).forEach(dc=>{
    const c=chainById(dc.id); if(!c) return;
    const friend=clamp((c.rel-50)/100,-0.5,0.45);
    m+=c.screens*(friend*0.12+((c.taste&&f&&c.taste[f.genre])?0.05:0));
  });
  return Math.max(0.85, m);
}
function chainCourtCost(c){ return Math.round((6+c.screens*40)*10)/10; }
function courtChain(id){
  const c=chainById(id); if(!c) return false;
  const cost=chainCourtCost(c);
  if(G.studio.cash<cost){ log("💸 Courting "+c.name+" takes "+fmtM(cost)+" — and they've heard every pitch.","bad"); return false; }
  spend("marketing", cost);
  const bump=8+rint(0,6)+(G.studio.rep>=60?2:0);   // bounded, logged randomness
  const stored=(G.chains||[]).find(x=>x.id===id);
  if(stored) stored.rel=clamp((Number.isFinite(stored.rel)?stored.rel:c.rel)+bump,0,95);
  else G.chains=(G.chains||[]).concat([{id, rel:clamp(c.rel+bump,0,95)}]);
  log("🍿 "+c.name+" warms to the studio — booking relation +"+bump+" (now "+Math.round(chainById(id).rel)+"/100). Friendlier chains book more screens on release day.","gold");
  saveGame();
  return true;
}

/* ── advance tickets (§23): the curve banks weekly before opening day ──
   Dated, ready films accrue advance sales from awareness/hype/campaigns and
   chain relations. At release the banked total lifts the opening (≤ +6%). */
function advanceHeat(p){
  return clamp(Math.round((p.awareness||0)*60+(p.buzzBonus||0)*30+(p.campaigns||[]).length*5),0,100);
}
function advancePace(p, weeksOut){
  return (p.marketing||0)*0.006*(advanceHeat(p)/60)*(1+(chainScreenMult(p)-1)*0.5)*(weeksOut<2?1.5:weeksOut<4?1.0:0.6);
}
function tickAdvances(){
  for(const p of G.projects){
    if(!p.releaseWeek || p.phase!=="ready" || p.releaseWeek<=G.week) continue;
    const weeksOut=p.releaseWeek-G.week;
    const sales=Math.round(advancePace(p,weeksOut)*(0.8+rnd()*0.4)*100)/100;
    if(sales<0.02) continue;
    if(!Array.isArray(p.advance)) p.advance=[];
    p.advance.push({w:G.week, sales});
    p.advanceTotal=Math.round(((p.advanceTotal||0)+sales)*100)/100;
    if(p.advance.length===1) log("🎟 Advance tickets for \""+p.title+"\" are on sale — "+fmtM(sales)+" in the first week.","");
    else if(weeksOut===1) log("🎟 "+fmtM(p.advanceTotal)+" banked in advance for \""+p.title+"\" — opening day is here.","");
  }
}
/* Read-only projection for the schedule modal: what advance should bank by the
   chosen weekend at the current heat. */
function advanceProjection(p, weekAbs){
  const weeksOut=Math.max(0,(weekAbs||p.releaseWeek||G.week+4)-G.week);
  let total=0;
  for(let i=1;i<=weeksOut;i++) total+=advancePace(p, weeksOut-i);
  return Math.round(total*100)/100;
}

/* Dubbing & localization (§27): each targeted market adds dubs, subs and local
   P&A materials. Foreign-language productions need local prints only, and a
   staggered rollout re-prints for every wave. */
function localizationCost(p, regions){
  const targets=Array.isArray(regions)? regions : (regions && regions!=="auto"? [regions] : []);
  let cost=(p.budget||0)*(targets.length? 0.02+0.012*targets.length : 0.01);
  if(p.foreignLang) cost*=0.5;
  if((p.rollout||"day")==="staggered") cost*=1.15;
  cost=Math.round(cost*10)/10;
  return Math.min(cost, Math.round((p.budget||0)*0.06*10)/10);
}
/* ── international regions: deterministic split of the settled intl gross ──
   Weights start from genre intl mix, then reuse china/india/censor/presales flags.
   Pure function of stored fields → same result every read; totals always sum
   to the existing intl gross, so worldwide never moves. */
/* ── audience demographics: five segments scored from genre/rating/cast ──
   Appeal is explanatory, not a second quality model: it re-weights things the
   sim already uses (genre biases, R-rating, star power, heat). Marketing locks
   the loop: a campaign channel aimed at the film's strongest demo hits 1.5×. */
function demoSegments(){
  return [
    {id:"kids", name:"Kids & Family", icon:"🧒", size:18},
    {id:"teens", name:"Teens & YA", icon:"🎧", size:22},
    {id:"adults", name:"Adults 25–44", icon:"🎟", size:35},
    {id:"prestige", name:"Prestige 45+", icon:"🎭", size:12},
    {id:"fans", name:"Genre superfans", icon:"🔥", size:13},
  ];
}
function demoAppeal(p){
  const base={action:{kids:30,teens:70,adults:80,prestige:35,fans:85}, scifi:{kids:35,teens:75,adults:80,prestige:45,fans:90},
    fantasy:{kids:70,teens:70,adults:65,prestige:50,fans:85}, animation:{kids:95,teens:60,adults:70,prestige:55,fans:70},
    comedy:{kids:55,teens:65,adults:75,prestige:35,fans:45}, horror:{kids:15,teens:85,adults:60,prestige:25,fans:80},
    thriller:{kids:20,teens:55,adults:75,prestige:60,fans:60}, drama:{kids:25,teens:40,adults:65,prestige:90,fans:45},
    romance:{kids:30,teens:65,adults:75,prestige:55,fans:50}, musical:{kids:60,teens:60,adults:65,prestige:80,fans:60},
    western:{kids:25,teens:35,adults:60,prestige:75,fans:55}, war:{kids:20,teens:45,adults:65,prestige:85,fans:55},
    sports:{kids:55,teens:65,adults:70,prestige:50,fans:75}, concert:{kids:40,teens:90,adults:60,prestige:30,fans:95},
    truecrime:{kids:15,teens:55,adults:75,prestige:65,fans:70}}[p.genre]||{kids:40,teens:50,adults:60,prestige:50,fans:50};
  const starP=(p.cast||[]).reduce((s,c)=>s+(c.power||0),0);
  const heat=(p.cast||[]).reduce((s,c)=>s+(c.heat||0),0);
  const out={};
  for(const k in base) out[k]=base[k];
  if(p.rating==="R"){ out.kids=5; out.prestige=clamp(out.prestige+5,5,99); }
  out.adults=clamp(out.adults+Math.min(6,starP)*2,5,99);
  out.teens=clamp(out.teens+Math.min(6,starP),5,99);
  out.fans=clamp(out.fans+Math.min(4,heat)*3,5,99);
  if(p.foreignLang) out.prestige=clamp(out.prestige+6,5,99);
  for(const k in out) out[k]=Math.round(out[k]);
  return out;
}
function demoProfile(p){
  const seg=demoSegments(), ap=demoAppeal(p);
  const rows=seg.map(s=>({id:s.id, name:s.name, icon:s.icon, size:s.size, appeal:ap[s.id]}));
  const sorted=rows.slice().sort((a,b)=>b.appeal-a.appeal);
  const potential=Math.round(rows.reduce((a,r)=>a+r.size*r.appeal/100,0));
  const top=sorted[0], low=sorted[sorted.length-1];
  const baseOpen=DATA.SCALES[p.scale]?DATA.SCALES[p.scale].openBase*(DATA.GENRES[p.genre]?DATA.GENRES[p.genre].mass:1):30;
  const conversion=p.opening?clamp(Math.round(p.opening/Math.max(1,baseOpen)*50),5,99):clamp(Math.round(top.appeal*0.7),5,99);
  const retention=clamp(Math.round((ap.fans+ap.kids)/2),5,99);
  return {rows, strongest:top, weakest:low, potential, conversion, retention};
}
function regionDefs(){
  return [
    {id:"europe", name:"Europe", emoji:"🇪🇺", w:0.30},
    {id:"eastasia", name:"East Asia", emoji:"🌏", w:0.20},
    {id:"seasia", name:"SE Asia", emoji:"🌴", w:0.08},
    {id:"india", name:"India", emoji:"🇮🇳", w:0.08},
    {id:"latam", name:"Latin America", emoji:"🌎", w:0.12},
    {id:"me", name:"Middle East", emoji:"🕌", w:0.06},
    {id:"other", name:"Other intl", emoji:"🌐", w:0.16},
  ];
}
function regionSplit(f){
  const defs=regionDefs();
  // v9: targetRegion is one id ("europe"), "auto", or an array of ids (multi-country release)
  const raw=f.targetRegion;
  const targets=Array.isArray(raw)? raw : (raw && raw!=="auto"? [raw] : []);
  const intl=Math.max(0,(f.ww||0)-(f.dom||0))*(targets.length? 1+0.06+0.03*(targets.length-1) : 1);
  const g=DATA.GENRES[f.genre]||{};
  const ws=defs.map(d=>d.w);
  const at=id=>defs.findIndex(d=>d.id===id);
  targets.forEach(id=>{ if(at(id)>=0) ws[at(id)]*=1.8; });   // v8/v9: the release leans into its chosen markets
  if(f.chinaDenied) ws[at("eastasia")]*=0.35;            // missed the quota slot
  else if(f.censorCut) ws[at("eastasia")]*=0.7;          // trimmed for China
  else ws[at("eastasia")]+= (g.china||0)*0.5;            // full China rollout
  if(DATA.GLOBAL&&DATA.GLOBAL.india) ws[at("india")]+= (DATA.GLOBAL.india[f.genre]||0); // over-indexing
  if(f.foreignLang){ ws[at("europe")]+=0.06; ws[at("latam")]+=0.04; }  // travels well
  if(f.strictMarketsBan) ws[at("me")]*=0.5;             // midnight slots only
  if(f.genre==="horror"||f.genre==="concert") ws[at("eastasia")]*=0.6;
  const tot=ws.reduce((a,b)=>a+b,0)||1;
  const audBase=(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
  let acc=0;
  return defs.map((d,i)=>{
    let gross=Math.round(intl*ws[i]/tot*10)/10; acc+=gross;
    let aud=audBase+(((f.id||0)*7+i*13)%9)-4+(f.foreignLang&&d.id==="europe"?3:0);
    return {id:d.id, name:d.name, emoji:d.emoji, gross,
      share:f.ww?Math.round(gross/f.ww*1000)/10:0, aud:clamp(aud,1,99),
      note:f.presales?"pre-sold":""};
  }).map((r,i,arr)=>{ if(i===arr.length-1) r.gross=Math.round((intl-acc+r.gross)*10)/10; return r; }); // totals preserved
}
function endTheatrical(f){
  f.inTheaters=false;
  // v9: a 150M+ worldwide run carves sidewalk stars for the billed talent
  if(typeof grantWalkOfFame==="function" && (f.ww||0)>=150) grantWalkOfFame(f, "\""+f.title+"\" crossed "+fmtG(f.ww)+" worldwide");
  // v5: the censor board also sharpens scissors for R-ratings, horror and dark thrillers
  if(!f.censorChecked && !f.presales && !f.chinaDenied){
    const ch = DATA.GENRES[f.genre].china||0;
    let cutP = ch>=0.14? 0.35 : 0;
    if(f.rating==="R") cutP += 0.12;
    if((f.genre==="horror"||f.genre==="thriller") && ch>0) cutP += 0.15;
    if(cutP>0 && chance(clamp(cutP,0,0.6)) && ch>0.04){
      f.censorCut=true;
      log("🇨🇳 The censor board trimmed \""+f.title+"\" for China — intl share −8pts.","bad");
    }
  }
  if((f.genre==="horror" || f.rating==="R") && !f.presales && chance(0.2)){
    f.strictMarketsBan=true;
    log("🚫 Strict-market censors clipped \""+f.title+"\" — midnight slots only overseas (−3pts intl share).","bad");
  }
  f.censorChecked=true;
  let share = DATA.GENRES[f.genre].intlShare;
  if(typeof intlShareOf==="function") share = intlShareOf(f);
  else if(f.censorCut) share = Math.max(0, share-0.08);
  const intlGross = (f.dom/(1-share) - f.dom) * econM("intl");
  f.ww = f.dom + intlGross;
  try{ f.regions = regionSplit(f); }catch(e){}
  let intlRentals = 0;
  if(!f.presales){
    intlRentals = intlGross*0.42*(1+specBonus("intl"));
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
  let dealPay=0; // backend points + hit bonuses owed to contracted talent
  (f.cast||[]).forEach(t=>{
    if(!t||!t.contract) return;
    if(t.contract.type==="backend"){ const cut=Math.round((f.rentalsDom+intlRentals)*0.02*10)/10; dealPay+=cut; }
  });
  const be0=(f.budget+(f.marketing||0))/0.48;
  (f.cast||[]).forEach(t=>{
    if(t&&t.contract&&t.contract.type==="bonus"&&f.ww>=be0){ dealPay+=6; log("🎯 "+t.name+"'s hit bonus vests: +$6M (\""+f.title+"\" beat breakeven).","gold"); }
  });
  if(dealPay>0){ spend("talent", dealPay); f.dealPay=dealPay; }
  f.studioRev = f.rentalsDom + intlRentals + pvod - backendPay - dealPay;
  f.profit = f.studioRev + (f.presales||0) - f.budget - (f.marketing||0) - (f.devCost||0) - (f.locCost||0);
  if(f.coFinance && f.profit>0){
    const shareCo = Math.round(f.profit*(f.coFinance||0.3)*10)/10;
    spend("financing", shareCo); f.partnerShare=shareCo; f.profit-=shareCo;
    log("🤝 Co-financing partner takes "+fmtM(shareCo)+" of \""+f.title+"\"'s net.","");
  }
  // v5: co-production partner's slice of the upside
  if(f.coProd && f.profit>0){
    const cutPct = f.coProd.share||0.45;
    const shareP = Math.round(f.profit*cutPct*10)/10;
    spend("financing", shareP); f.coProdShare=shareP; f.profit-=shareP;
    log("🤝 Co-production partner "+f.coProd.name+" takes "+fmtM(shareP)+" ("+Math.round(cutPct*100)+"%) of \""+f.title+"\"'s net.","");
  }
  G.stats.totalWW += f.ww; G.stats.totalProfit += f.profit;
  const be = breakevenWW(f);
  const verdict = f.ww>=be*1.6? "SMASH HIT": f.ww>=be? "HIT": f.ww>=be*0.75? "disappointment": "FLOP";
  if(verdict==="SMASH HIT"){ if(typeof sfx==="function") sfx("smash"); G.confetti=true; }
  else if(verdict==="FLOP") if(typeof sfx==="function") sfx("buzz");
  if(f.ww>=be) G.stats.hits++; else G.stats.flops++;
  try{ specRelease(f); }catch(e){} // specialization XP follows the work, not a menu
  if(verdict==="SMASH HIT"){ // the town piles into what just worked
    G.hotGenre=f.genre;
    (f.cast||[]).forEach(c=>{ if(Number.isFinite(c.heat)) c.heat=Math.min(3,c.heat+1); });
    earnInfluence(2, "smash hit");
    log("🔥 The town wants more "+DATA.GENRES[f.genre].name+" — rivals are already circling the genre.","gold");
  }
  if(verdict==="FLOP"){ // talent confidence cools; quotes follow heat down
    (f.cast||[]).forEach(c=>{ if(Number.isFinite(c.heat)) c.heat=Math.max(0,c.heat-1); });
  }
  const dRep = f.ww>=be*1.6? 6: f.ww>=be? 3: f.ww>=be*0.75? -2: -4;
  G.studio.rep = clamp(G.studio.rep + dRep*(G.studio.flopPenalty||1), 5, 99);
  boardShift(Math.round(dRep*0.7));   // v14: the board reacts to every verdict (§44)
  // v5: spin-off quality — a cheap spin-off that flops drags the parent brand down with it
  if(f.franchiseName){
    const frParent = G.franchises.find(x=>x.name===f.franchiseName);
    if(frParent){
      if(f.ww < be*0.55){
        frParent.decay = Math.max(0.2, frParent.decay-0.15);
        frParent.fatigue = clamp((frParent.fatigue||0)+(DATA.FATIGUE.perEntry*0.7), 0, 0.95);
        log("💔 \""+f.title+"\" flopped hard enough to scar the "+frParent.name+" brand — heat down, fatigue up.","bad");
      }else if(f.ww>=be){
        frParent.decay = Math.min(1, frParent.decay+0.12);
      }
    }
  }
  if(f.quality.overall>=66 && f.ww>=be*1.9){
    f.franchiseable=true;
    upsertFranchise(f);
    log("🏆 \""+f.title+"\" final: "+fmtG(f.ww)+" WW — "+verdict+". Franchise unlocked — see 🏰 Empire!","gold");
  }else{
    log("🏁 \""+f.title+"\" ends its run: "+fmtG(f.ww)+" WW — "+verdict+" ("+(f.profit>=0?"+":"")+fmtM(f.profit)+" net; "+fmtM(f.studioRev)+" rentals received).", f.profit>=0?"good":"bad");
  }
  // v10 Phase 2: hybrid — after the theatrical run, the film lands on your streamer
  if(f.ownWindow && G.streamer){
    f.onOwn=true; f.soldTo=G.streamer.name;
    const bump=Math.round((0.4+((f.quality&&f.quality.overall)||55)/55)*10)/10;
    G.streamer.subs=Math.round((G.streamer.subs+bump)*100)/100;
    G.streamer.peak=Math.max(G.streamer.peak||0, G.streamer.subs);
    G.streamer.lastContent=G.week;
    log("📺 After its theatrical run, \""+f.title+"\" lands on "+G.streamer.name+" (+"+bump+"M subscribers).","gold");
  }else{
    scheduleOttOffer(f, rint(2,5));
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
}
function makeFilmOttOffer(f){
  const g=DATA.GENRES[f.genre];
  const plats = DATA.PLATFORMS.map(p=>({p, score:p.generosity * (p.taste[f.genre]||1)})).sort((a,b)=>b.score-a.score);
  const chosen = chance(.65)? plats[0] : pick(plats.slice(0,3));
  // Talent star power multiplier
  const castBoost = ((f.cast||[]).reduce((sum,c)=>sum + ((c.heat||0)*0.07) + (((c.skill||50)-50)*0.003), 0));
  let value = (f.budget*0.5 + f.ww*0.06) * g.otta * chosen.p.generosity * qualityFactorOTT(f) * (G.infl||1) * (repPerk("streaming")?1.05:1) * (1+specBonus("streaming")) * econM("stream")
            * (0.85 + trendOf(f.genre)*0.15/1) * (1 + clamp(castBoost, -0.05, 0.35));
  if(G.streamWar>0) value*=1.3;
  if(G.upgrades.ottrel) value*=1.12;
  if(G.upgrades.globalcdn) value*=1.18;
  value = Math.round(value);
  G.offers.push({ id:nid(), type:"film_ott", filmId:f.id, filmTitle:f.title, genre:f.genre, platform:chosen.p.id,
    value, countered:false, expires:G.week+6 });
  log("📨 "+chosen.p.name+" wants to license \""+f.title+"\" for "+fmtM(value),"");
}
function maybePrebuyOffer(p){
  if(p.scale==="indie" && !p.hot) return;
  if(!chance(p.hot? 0.7:0.35)) return;
  const plats = DATA.PLATFORMS.map(x=>({x, s:x.generosity*(x.taste[p.genre]||1)})).sort((a,b)=>b.s-a.s);
  const chosen = pick(plats.slice(0,2));
  const margin = 1.12 + rnd()*0.33;
  const castBoost = ((p.cast||[]).reduce((sum,c)=>sum + ((c.heat||0)*0.07) + (((c.skill||50)-50)*0.003), 0));
  const value = Math.round(p.budget*margin*chosen.x.generosity*(G.streamWar>0?1.25:1)*(G.infl||1)*clamp(trendOf(p.genre),0.85,1.2)*econM("stream")*(1+clamp(castBoost,-0.05,0.35))*(G.upgrades.globalcdn?1.18:1));
  G.offers.push({ id:nid(), type:"prebuy", projectId:p.id, filmTitle:p.title, genre:p.genre, platform:chosen.x.id,
    value, countered:false, expires:G.week+4 });
  log("📨 "+chosen.x.name+" offers to buy \""+p.title+"\" as a streaming original: "+fmtM(value)+" (no theatrical run).","");
}
/* ═══ OTT auction: shop a finished film to streamers ═══ */
function makeAuctionBids(p){
  const q=p.quality.overall, g=DATA.GENRES[p.genre];
  const hype=1+(p.buzzBonus||0);
  const cand=DATA.PLATFORMS.map(pl=>({pl,s:pl.generosity*(pl.taste[p.genre]||1)})).sort((a,b)=>b.s-a.s).slice(0,3);
  const castBoost = ((p.cast||[]).reduce((sum,c)=>sum + ((c.heat||0)*0.07) + (((c.skill||50)-50)*0.003), 0));
  return cand.map(({pl,s})=>({ platform:pl.id,
    value:Math.max(3, Math.round(p.budget*(0.85+q/160)*g.otta*s*hype*(0.95+rnd()*0.22)*(G.streamWar>0?1.3:1)*(G.upgrades.ottrel?1.12:1)*(G.upgrades.globalcdn?1.18:1)*(1+clamp(castBoost,-0.05,0.35))*(G.infl||1)*clamp(trendOf(p.genre),0.85,1.2)*econM("stream")))
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
  try{ specGain("streaming",1); }catch(e){}
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
  log("🤝 Sold \""+p.title+"\" to "+plat.name+" as a streaming original for "+fmtM(bid.value)+" (no theatrical run).","gold");
  saveGame();
}
function declineAuction(){
  const a=G.pendingAuction; if(!a) return;
  if(!a.manual){
    const p=G.projects.find(x=>x.id===a.projectId);
    if(p && p.phase==="ready") log("🎥 Keeping \""+p.title+"\" — date it theatrically whenever you're ready.","");
  }
  G.pendingAuction=null; saveGame();
}

/* ── v28: festival market auction — sell a finished picture outright to a rival studio ── */
function makeSaleBids(p, fest){
  const q=p.quality.overall;
  const buyers=(G.rivals||[]).slice();
  const bids=[];
  const n=Math.min(buyers.length, rint(2,3));
  for(let i=0;i<n;i++){
    const r=buyers.splice(rint(0,buyers.length-1),1)[0];
    const mult=(0.45+rnd()*0.25) * (fest && fest.market? fest.market/1.2 : 1) * (1+(q-55)/120);
    bids.push({ rival:r, value:Math.max(1, Math.round(p.budget*Math.max(0.6,mult)*10)/10) });
  }
  return bids.sort((a,b)=>b.value-a.value);
}
function acceptSale(i){
  const a=G.pendingSale; if(!a) return;
  const bid=a.bids[i]; const p=G.projects.find(x=>x.id===a.projectId);
  G.pendingSale=null;
  if(!p||!bid) return;
  earn("other", bid.value);
  const fest=(DATA.FESTIVALS||[]).find(x=>x.id===a.festId);
  const f={ id:p.id, title:p.title, genre:p.genre, scale:p.scale, budget:p.budget,
    marketing:p.marketingPaid||0, devCost:p.devCost||0, quality:p.quality,
    streamingOriginal:true, platform:(fest? fest.name : "a rival studio"), soldTo:(bid.rival? bid.rival.name : "rival"),
    releaseWeek:G.week, weekly:[], dom:0, ww:0, rentalsDom:0, studioRev:bid.value,
    profit:bid.value-p.budget-(p.devCost||0)-(p.marketingPaid||0),
    inTheaters:false, awardsEligible:false, year:yearOf(G.week), reviews:[] };
  G.films.push(f);
  G.projects=G.projects.filter(x=>x!==p);
  if(bid.rival) bid.rival.slate.push({title:p.title, genre:p.genre, scale:p.scale, week:G.week+rint(8,20), live:false, dead:false});
  G.studio.rep=clamp(G.studio.rep+2,5,99);
  G.stats.films++;
  freeProjectTalent(p);
  log("🤝 Sold \""+p.title+"\" to "+(bid.rival? bid.rival.name : "a rival studio")+" at the "+(fest?fest.name:"festival")+" market for "+fmtM(bid.value)+". Prestige +2, but they own the picture now.","gold");
  saveGame();
}
function declineSale(){
  const a=G.pendingSale; if(!a) return;
  const p=G.projects.find(x=>x.id===a.projectId);
  G.pendingSale=null;
  if(p && p.phase==="ready") log("🎥 Walked away from the "+(DATA.FESTIVALS.find(x=>x.id===a.festId)||{}).name+" market — \""+p.title+"\" is yours to date.","");
  saveGame();
}
/* ── streaming wars: platform stats derived from real deals, no new state ──
   Library = licensed + originals on each service. Subs/ARPU/churn are labeled
   estimates from library size and platform generosity/renew rates. */
function platTitles(pid){
  const pl=DATA.platform(pid);
  const films=(G.films||[]).filter(f=>(f.soldTo&&f.soldTo===pl.name)||(f.streamingOriginal&&f.platform===pl.name));
  const seasons=(G.series||[]).reduce((a,s)=>a+((s.platform===pid)?(s.seasons||[]).length:0),0);
  return {films, seasons,
    exclusives:films.filter(f=>f.streamingOriginal).length,
    spend:Math.round(films.reduce((a,f)=>a+(f.soldValue||(f.streamingOriginal?f.studioRev:0)||0),0)*10)/10
      + (G.series||[]).filter(s=>s.platform===pid).reduce((a,s)=>a+(s.seasons||[]).reduce((x,y)=>x+(y.license||0),0),0)};
}
function platStats(){
  if(!G) return [];
  const all=(typeof DATA.allPlatforms==="function")?DATA.allPlatforms():DATA.PLATFORMS;
  const rows=all.map(p=>{
    const t=platTitles(p.id);
    const subs=Math.round((14+t.films.length*2.2+t.exclusives*1.5+t.seasons*0.8+((p.generosity||1)-1)*25)*10)/10;
    const arpu=Math.round(0.5*(p.generosity||1)*100)/100;
    const churn=Math.round((100-(p.renew||55))*0.02*100)/100;
    return {id:p.id, name:p.name, color:p.color, logo:p.logo, mine:false,
      subs, arpu, churn:Math.max(0.2,churn), revenue:Math.round(subs*arpu*10)/10,
      titles:t.films.length, exclusives:t.exclusives, seasons:t.seasons, spend:Math.round(t.spend*10)/10, blurb:p.blurb||""};
  });
  if(G.streamer){
    const s=G.streamer, tier=(typeof DATA.tier==="function")?DATA.tier(s.tier||"premium"):{arpu:0.5,churn:0.008};
    rows.push({id:"mine", name:s.name, color:"#b48bff", logo:"▶", mine:true,
      subs:Math.round(s.subs*10)/10, arpu:tier.arpu||0.5, churn:Math.round((s.churn||tier.churn||0.008)*100*100)/100,
      revenue:Math.round(s.subs*(tier.arpu||0.5)*10)/10, titles:(G.films||[]).filter(f=>f.onOwn).length,
      exclusives:(G.films||[]).filter(f=>f.onOwn).length, seasons:0, spend:0, blurb:"Your platform"});
  }
  const tot=rows.reduce((a,r)=>a+r.subs,0)||1;
  rows.forEach(r=>r.share=Math.round(r.subs/tot*1000)/10);
  return rows.sort((a,b)=>b.subs-a.subs);
}
function recentSignings(){
  return (G.films||[]).filter(f=>f.soldTo||f.streamingOriginal).slice(-5).reverse()
    .map(f=>({title:f.title, to:f.soldTo||f.platform, value:f.soldValue||f.studioRev||0,
      kind:f.streamingOriginal?"original":"license"}));
}
function stokeAuction(){ // player-funded bidding war: heat the room for the top bid
  const a=G.pendingAuction; if(!a||a.stoked) return false;
  if(G.studio.cash<2){ log("💸 Stoke the bidding war costs $2M.","bad"); return false; }
  spend("marketing", 2); a.stoked=true;
  a.bids.forEach(b=>b.value=Math.round(b.value*1.15));
  a.bids.sort((x,y)=>y.value-x.value);
  log("🔥 Bidding war! Rival services pile in — top bid +15% (−$2M to stoke it).","gold");
  saveGame(); return true;
}

function acceptOffer(o){
  if(o.type==="film_ott"){
    const f = G.films.find(x=>x.id===o.filmId); if(!f) return;
    earn("streaming", o.value); f.soldTo = DATA.platform(o.platform).name; f.soldValue=o.value;
    try{ specGain("streaming",1); }catch(e){}
    f.profit += o.value; G.stats.totalProfit += o.value;
    log("🤝 \""+f.title+"\" licensed to "+f.soldTo+" for "+fmtM(o.value),"gold");
  }else if(o.type==="prebuy"){
    const p = G.projects.find(x=>x.id===o.projectId); if(!p) return;
    p.prebuyAccepted=true; p.prebuyPlatform=o.platform; p.prebuyValue=o.value;
    log("🤝 \""+p.title+"\" sold to "+DATA.platform(o.platform).name+" — "+fmtM(o.value)+" payable on delivery.","gold");
  }else if(o.type==="renewal"){
    acceptRenewal(o);
  }
  G.offers = G.offers.filter(x=>x.id!==o.id);
  saveGame();
}
function counterOffer(o){
  if(o.countered) return;
  o.countered=true;
  const title = o.filmTitle || o.seriesTitle || "Project";
  // Bidding war chance when streaming wars are hot or genre has momentum
  const gTrend = (o.genre && typeof trendOf==="function") ? trendOf(o.genre) : 1;
  if(chance(0.24) && (G.streamWar>0 || gTrend>1.03 || G.studio.rep>=45)){
    const rivals = DATA.PLATFORMS.filter(x=>x.id!==o.platform);
    const bidder = pick(rivals);
    if(bidder){
      const prevName = DATA.platform(o.platform).name;
      o.platform = bidder.id;
      o.value = Math.round(o.value * (1.28 + rnd()*0.18));
      o.biddingWar = true;
      log("🔥 BIDDING WAR! "+bidder.name+" swoops in over "+prevName+" with a massive "+fmtM(o.value)+" offer for \""+title+"\"!","gold");
      saveGame();
      return;
    }
  }
  const p = 0.35 + G.studio.rep/300 + (DATA.platform(o.platform).generosity-1)*1.2 + (G.streamWar>0?0.15:0);
  if(chance(clamp(p,0.2,0.85))){
    o.value = Math.round(o.value*(1.18+rnd()*0.12));
    log("📈 Counter accepted: "+DATA.platform(o.platform).name+" raised their offer for \""+title+"\" to "+fmtM(o.value),"good");
  }else if(chance(.5)){
    G.offers=G.offers.filter(x=>x.id!==o.id);
    log("📉 "+DATA.platform(o.platform).name+" walked away from \""+title+"\".","bad");
  }else{
    log("🤨 They grumbled but the original offer stands for \""+title+"\".","");
  }
  saveGame();
}
function declineOffer(o){
  G.offers = G.offers.filter(x=>x.id!==o.id);
  if(o.type==="renewal"){
    const s=G.series.find(x=>x.id===o.seriesId);
    if(s){ s.status="ended"; log("🚫 You declined renewal — \""+s.title+"\" ends after "+s.seasons.length+" season(s).",""); }
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
  const plat = cfg.platformId==="own"? ownPlatformStub() : DATA.platform(cfg.platformId);
  const fmt = (DATA.SERIES_FORMATS && DATA.SERIES_FORMATS.find(x=>x.id===cfg.formatId)) || (DATA.SERIES_FORMATS ? DATA.SERIES_FORMATS[0] : null);
  const eps = cfg.eps || (fmt ? fmt.eps : 8);
  const perEp = cfg.perEp || (fmt ? fmt.perEp : 6);
  const budget = eps*perEp;
  const concept = clamp(rint(50,80)+G.studio.devBonus*2, 40, 95);
  const taste = (plat.taste && plat.taste[cfg.genre]) || 1;
  const formatBonus = (fmt && fmt.id==="docuseries" && (plat.id==="prestigemax"||plat.id==="cinemavault"||plat.id==="orbittv")) ? 0.08 : 0;
  const p = 0.22 + concept/160 + (taste-1)*0.6 + G.studio.rep/400 + (perEp>=8?0.06:0) + (G.upgrades.ottrel?0.05:0) + (G.upgrades.ottalgo?0.04:0) + formatBonus + (cfg.oddsBonus||0);
  const s = {
    id:nid(), kind:"series", title:cfg.titleOverride||seriesTitle(), genre:cfg.genre, platform:cfg.platformId,
    formatId: fmt ? fmt.id : "standard", formatName: fmt ? fmt.name : "Series",
    spinFr: cfg.spinFr||null,
    eps, perEp, budget, concept,
    showrunner:cfg.showrunner||null, cast:cfg.cast||[],
    seasons:[], phase:"shoot", weeksLeft:Math.round(eps*1.2+6),
    weeksLeft0:Math.round(eps*1.2+6),
    spent:0, status:"producing", viewership:0,
  };
  if(cfg.platformId==="own" || chance(clamp(p,0.12,0.9))){
    G.series.push(s);
    spend("talent", (cfg.showrunner?actorFee(cfg.showrunner):0) + (cfg.cast||[]).reduce((a,c)=>a+actorFee(c),0));
    if(cfg.showrunner){cfg.showrunner.bookedUntil=G.week+s.weeksLeft; cfg.showrunner.booked=s.title;}
    (cfg.cast||[]).forEach(c=>{c.bookedUntil=G.week+s.weeksLeft; c.booked=s.title;});
    log("📺 "+plat.name+" greenlit "+(fmt?"["+fmt.name+"] ":"")+"\""+s.title+"\" — "+eps+" eps × "+fmtM(perEp)+" ("+fmtM(budget)+" budget).","gold");
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
  if(s.formatId==="docuseries") q += 4;
  if(s.formatId==="limitedevent") q += 6;
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
  const own = s.platform==="own" && G.streamer;
  const plat=own? ownPlatformStub() : DATA.platform(s.platform);
  const q=seriesQuality(s);
  const num=s.seasons.length+1;
  const margin = 1.15 + G.studio.rep/500 + (G.upgrades.ottrel?0.05:0);
  const license = own? 0 : Math.round(s.budget*margin*(G.infl||1));
  let ownSubs=0;
  if(own){
    // no license check — the season pays in subscribers and weekly ARPU (spec §9)
    ownSubs=Math.round((0.5+q/22)*10)/10;
    G.streamer.subs=Math.round((G.streamer.subs+ownSubs)*100)/100;
    G.streamer.peak=Math.max(G.streamer.peak||0, G.streamer.subs);
    G.streamer.lastContent=G.week;
  }else{
    earn("series", license);
  }
  const sGenre=DATA.GENRES[s.genre]||{critic:0,aud:0};
  s.seasons.push({num, quality:q, license, viewership:0, // series ratings ride the same biases as films
    critic:clamp(Math.round(q+sGenre.critic+gauss()*4),5,99),
    audience:0});
  // talent free
  if(s.showrunner){s.showrunner.bookedUntil=0;}
  s.cast.forEach(c=>{c.bookedUntil=0;});
  const v = clamp(Math.round(0.45*q + 16 + G.studio.rep/9 + (plat.taste[s.genre]||1)*8 + gauss()*6), 5, 99);
  s.pendingV = v;
  s.phase="airing"; s.airWeeks=4;
  G.stats.seriesSeasons++;
  log(own? "📺 \""+s.title+"\" S"+num+" premieres on "+G.streamer.name+" — +"+ownSubs+"M subscribers (no license — it earns weekly)."
        : "📺 \""+s.title+"\" S"+num+" dropped on "+plat.name+". License: "+fmtM(license)+".","gold");
}
function finishSeason(s){
  const plat = s.platform==="own"? ownPlatformStub() : DATA.platform(s.platform);
  const season=s.seasons[s.seasons.length-1];
  season.viewership=s.pendingV; s.viewership=s.pendingV;
  season.audience=clamp(Math.round(s.pendingV*0.6+(season.quality||60)*0.4),5,99);
  const vLabel = season.viewership>=75? "a phenomenon 🔥": season.viewership>=58? "a hit": season.viewership>=45? "so-so": "a flop";
  log("📊 \""+s.title+"\" S"+season.num+" completed its run — "+vLabel+" ("+season.viewership+"/100 buzz).", season.viewership>=58?"good":"bad");
  if(season.viewership>=72){ G.studio.rep=clamp(G.studio.rep+3,5,99);
    if(s.showrunner&&Number.isFinite(s.showrunner.heat)) s.showrunner.heat=Math.min(3,s.showrunner.heat+1);
    (s.cast||[]).forEach(c=>{ if(Number.isFinite(c.heat)) c.heat=Math.min(3,c.heat+1); }); // hits make talent expensive
  }
  if(season.viewership<40) G.studio.rep=clamp(G.studio.rep-2,5,99);
  const renewAt = plat.renew - (G.upgrades.ottrel?4:0);
  if(season.viewership>=renewAt && season.viewership>0){
    const nextBudget = Math.round(s.budget*1.08);
    const margin = 0.1 + season.viewership/220;
    const value = s.platform==="own"? 0 : Math.round(nextBudget*(1+margin)*(G.infl||1));
    s.status="renewal_pending";
    G.offers.push({ id:nid(), type:"renewal", seriesId:s.id, seriesTitle:s.title, seasonNum:season.num+1,
      platform:s.platform, value, budget:nextBudget, eps:s.eps, countered:false, expires:G.week+5 });
    log(s.platform==="own"? "📨 Your audience wants \""+s.title+"\" S"+(season.num+1)+" on "+plat.name+" — you fund the "+fmtM(nextBudget)+" season; it pays in subscribers."
      : "📨 "+plat.name+" wants to renew \""+s.title+"\" for S"+(season.num+1)+" — "+fmtM(value)+" season order.","");
  }else{
    s.status="ended";
    log("🚫 "+plat.name+" cancelled \""+s.title+"\".","bad");
  }
  // v5: spin-off quality — a TV spin-off that tanks drags the parent brand down
  if(s.spinFr && season.viewership<40){
    const fr=frById(s.spinFr);
    if(fr){ fr.decay=Math.max(0.2, fr.decay-0.15); fr.fatigue=clamp((fr.fatigue||0)+0.08, 0, 0.95);
      log("💔 The \""+s.title+"\" spin-off bombed — the "+fr.name+" brand takes the hit too.","bad"); }
  }
  s.phase="between";
}
function cancelSeries(sid){ // player pull: sunk costs stay, talent walks free
  const s=G.series.find(x=>x.id===+sid);
  if(!s||s.status==="ended") return false;
  if(s.showrunner){s.showrunner.bookedUntil=0; s.showrunner.booked=null;}
  (s.cast||[]).forEach(c=>{c.bookedUntil=0; c.booked=null;});
  s.status="ended"; s.phase="between";
  G.offers=(G.offers||[]).filter(o=>o.seriesId!==s.id);
  log("🚫 You cancelled \""+s.title+"\" after "+s.seasons.length+" season(s). The lot moves on.","");
  saveGame(); return true;
}
function acceptRenewal(o){
  const s=G.series.find(x=>x.id===o.seriesId); if(!s)return;
  s.budget=o.budget; s.perEp=Math.round(o.budget/s.eps);
  s.weeksLeft0 = s.weeksLeft = Math.round(s.eps*1.2+6);
  s.phase="shoot"; s.status="producing";
  // re-book talent
  if(s.showrunner){s.showrunner.bookedUntil=G.week+s.weeksLeft;}
  s.cast.forEach(c=>{c.bookedUntil=G.week+s.weeksLeft;});
  log("✅ \""+s.title+"\" renewed! S"+o.seasonNum+" — "+fmtM(o.value)+" covers a "+fmtM(o.budget)+" season.","gold");
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
      else genre = (G.hotGenre&&chance(.3))?G.hotGenre:pick(Object.keys(DATA.GENRES)); // rivals chase the hot genre
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
        let opening = f.weight * (0.8+rnd()*0.45) * DATA.seasonOf(woyOf(G.week)).season * trendPull(f.genre) * econM("theater");
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
    /* v28: rival slates integration - inject custom studios/franchises */
    if(G.custom && G.custom.studios && r.slate.length < 5 && chance(0.1)){
      const customStudio = pick(G.custom.studios);
      if(customStudio){
        r.slate.push({ 
          title:customStudio.name, 
          genre:pick(Object.keys(DATA.GENRES)), 
          scale:pick(["indie","mid","wide"]), 
          weight:Math.round((3+rnd()*8)*10)/10, 
          week:G.week+rint(8,20), 
          live:false, dead:false, 
          custom:true, 
          studio:customStudio.name 
        });
      }
    }
    if(G.custom && G.custom.franchises && r.slate.length < 5 && chance(0.1)){
      const customFr = pick(G.custom.franchises);
      if(customFr){
        r.slate.push({ 
          title:customFr.name+" "+rint(2,5), 
          genre:customFr.genre, 
          scale:pick(["indie","mid","wide"]), 
          weight:Math.round((4+rnd()*6)*10)/10, 
          week:G.week+rint(8,20), 
          live:false, dead:false, 
          custom:true, 
          franchise:customFr.name 
        });
      }
    }
    r.ytd = r.slate.filter(f=>f.week>(yearOf(G.week)-1)*52).reduce((a,f)=>a+(f.dead||f.live? f.dom:0),0);
  }
}

/* ── v18: Rival Acquisition ── */
function rivalAcquire(rivalId){
  const rival = G.rivals.find(r=>r.id===rivalId || r.name===rivalId);
  if(!rival) return {ok:false, err:"Rival not found"};
  
  // Check if rival is distressed (rep < 20 or bankrupt)
  const assetValue = catalogValueRival(rival);
  const price = Math.round(assetValue * 2 * 10)/10;
  
  if(rival.rep >= 20 && price < 500){
    return {ok:false, err:"Rival is not distressed enough for acquisition. Their reputation is "+rival.rep+"/100."};
  }
  
  // Board approval required for acquisitions >= $500M
  if(price >= 500){
    const vote = boardVote({quality:{overall:60}, budget:price});
    if(!vote.pass){
      return {ok:false, err:"Board rejected the acquisition ("+vote.votes.filter(v=>v.yes).length+"/3 votes)."};
    }
  }
  
  if(G.studio.cash < price){
    return {ok:false, err:"Insufficient funds. Need "+fmtM(price)+" but have "+fmtM(G.studio.cash)+"."};
  }
  
  spend("studio", price);
  
  // Inherit rival's slate, active productions, talent contracts, debt, IP library
  const inheritedFilms = [];
  for(const f of rival.slate){
    f.acquiredFrom = rival.name;
    inheritedFilms.push(f);
    G.films.push(f);
  }
  
  // Inherit talent contracts
  for(const t of G.talent){
    if(t.contract && t.contract.type==="exclusive" && t.contract.until > G.week){
      // Keep exclusive contracts
    }
  }
  
  // Integration cost: $50M over 4 weeks; -20% productivity during merger
  G.integrationCost = { total:50, weeksLeft:4, weeklyCost:12.5 };
  
  // Remove rival
  G.rivals = G.rivals.filter(r=>r!==rival);
  
  log("🏢 ACQUIRED "+rival.name.toUpperCase()+" for "+fmtM(price)+"! "+inheritedFilms.length+" films, active productions, and IP library inherited. Integration: $50M over 4 weeks (−20% productivity).","gold");
  
  saveGame();
  return {ok:true, price, films:inheritedFilms.length};
}

function catalogValueRival(rival){
  // Simplified valuation of rival's assets
  let v = rival.ytd * 3; // 3x annual revenue
  v += (rival.slate||[]).filter(f=>!f.dead && !f.live).length * 40; // pipeline value
  return Math.max(50, v);
}

/* ── v18: Rival Franchise Poaching ── */
function tryRivalFranchisePoach(){
  // Check for rival sequels in dev weeks 1-4 (talent not locked)
  for(const rival of G.rivals){
    for(const f of rival.slate){
      if(f.phase==="pre" && (f.phaseLen?.pre||0) <= 4 && f.sequelOf){
        // Trigger poach bid
        if(chance(0.15)){ // 15% chance per week
          const talent = f.cast? f.cast[0] : null;
          if(talent && !talent.loyalTo){
            const offer = Math.round(actorFee(talent) * 1.5 * 10)/10;
            return {rival:rival.name, film:f.title, talent:talent.name, offer:offer, filmId:f.id, talentId:talent.id};
          }
        }
      }
    }
  }
  return null;
}

function resolveFranchisePoach(rivalName, filmId, talentId, playerWon, playerOffer){
  const rival = G.rivals.find(r=>r.name===rivalName);
  const film = rival?.slate.find(f=>f.id===filmId);
  const talent = G.talent.find(t=>t.id===talentId);
  
  if(!rival || !film || !talent) return {ok:false};
  
  if(playerWon){
    // Player wins - rival cancels sequel, talent joins player
    film.cancelled = true;
    film.poachedBy = G.studio.name;
    talent.loyalTo = G.studio.name;
    talent.poached = true;
    spend("talent", playerOffer);
    log("🎬 POACHED "+talent.name+" from "+rivalName+"'s \""+film.title+"\"! Rival sequel cancelled.","gold");
  }else{
    // Rival counter-bids and locks talent
    const rivalOffer = Math.round(playerOffer * 1.1 * 10)/10;
    talent.fee = rivalOffer;
    talent.lockedTo = rivalName;
    log("🎬 "+rivalName+" counter-bid and locked "+talent.name+". Your $"+fmtM(playerOffer)+"M offer failed.","bad");
  }
  saveGame();
  return {ok:true};
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
  const libLic = catalogValue()*0.0045; // perf: O(films) once, not per forecast row
  for(let w=G.week+1; w<=G.week+12; w++){
    let net = -overhead;
    net += libLic;                              // library licensing
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
  else { const cf=execObj("cfo"); rate = 0.0018*(cf? 1-0.30*lvlMult(cf) : 1); }
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
  const def=e;
  if(G.studio.cash<def.cost){ log("💸 Hiring a "+def.name+" takes "+fmtM(def.cost)+".","bad"); return false; }
  spend("studio", def.cost); G.execs[id]={hired:G.week, tenure:0, xp:0};   // v14: execs are careers now
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
  if(G.streamer){ if(name){ G.streamer.name=name.slice(0,24); log("📱 Platform rebranded as \""+G.streamer.name+"\".",""); saveGame(); return true; } return false; }
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
  log("📱 "+G.streamer.name+" switches to \""+t.name+"\": $"+t.arpu.toFixed(2)+"/sub/wk, ceiling ×"+t.ceil.toFixed(2)+".","gold");
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
  if(G.upgrades && G.upgrades.ottalgo) base *= 1.15;
  const ceil = Math.min(Math.round(60*(tier.ceil||1)), Math.round(base));
  return clamp(ceil, 4, 85);
}

function tickStreamer(){
  if(G.streamer){
    if(!Array.isArray(G.streamer.subHistory)) G.streamer.subHistory=[];
    G.streamer.subHistory.push(G.streamer.subs||0);
    if(G.streamer.subHistory.length>12) G.streamer.subHistory.shift();
  }
  if(!G.streamer) return;
  const st=G.streamer;
  const tier = (typeof DATA.tier==="function")? DATA.tier(st.tier||"premium") : {ceil:1, arpu:0.5, churn:0.008};
  // decay sports power
  if(st.sportsPower>0) st.sportsPower = Math.max(0, st.sportsPower - st.sportsPower*0.015 - 0.02);
  st.sportsPower = Math.max(0, (st.sportsPower||0)*0.985);
  const ce=streamerCeiling();
  let churn = tier.churn||0.008;
  if(G.upgrades && G.upgrades.ottalgo) churn *= 0.80; // AI recommender reduces churn
  if(st.crackdown>0){ churn *= 2; st.crackdown--; if(st.crackdown===0) log("🔐 Crackdown churn has settled down.",""); }
  st.churn = churn;
  const starved = G.week-(st.lastContent||0) > 6;
  let growth = (ce - st.subs)*0.05 - st.subs*churn;
  if(G.upgrades && G.upgrades.globalcdn) growth += 0.06; // Global CDN boosts acquisition
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
  // Subscriber trend history for OTT analytics (last 16 weeks)
  st.history = st.history || [];
  st.history.push({w:G.week, subs:st.subs, inc:st.income});
  if(st.history.length>16) st.history.shift();
  if(st.subs>=25 && typeof unlockAchv==="function") unlockAchv("subs25", "The Empire Hits 25M", "Reach 25M subscribers on your platform.");
}

function moveToStreamer(fid){
  if(!G.streamer) return false;
  const f=G.films.find(x=>x.id===fid);
  if(!f || f.streamingOriginal || f.soldTo || f.onOwn || f.inTheaters) return false;
  f.onOwn = true; f.soldTo = G.streamer.name;
  G.streamer.subs = Math.round((G.streamer.subs + 0.3 + (f.quality?f.quality.overall/60:0))*100)/100;
  log("📺 \""+f.title+"\" moved to your platform "+G.streamer.name+" — exclusive. Content ceiling +.","gold");
  saveGame();
  return true;
}

/* ═══════════ v10 Phase 2: own-streamer distribution — a first-class release path ═══════════ */
function ownPlatformStub(){
  return { id:"own", name:G.streamer? G.streamer.name : "Your Platform", color:"#b48bff", logo:"▶",
    taste:{}, generosity:1, blurb:"Your own platform", renew:45 };
}
/* projected overnight subscribers for a direct-to-own-streamer release (spec §14) */
function ownPremiereEstimate(p){
  const q=(p.quality&&p.quality.overall)||Math.round(45+(p.script||60)/4);
  const fit=(DATA.GENRES[p.genre]||{aud:0}).aud/40;
  const mktBoost=1+Math.min(0.8,((p.marketing||0)/Math.max(20,(p.budget||40)))*0.6);
  const subs=Math.round(clamp(q/16,0.4,4.5)*Math.max(0.4,fit)*(1+(p.buzzBonus||0))*mktBoost*10)/10;
  return { subs:Math.max(0.2,subs), q };
}
/* convert a finished project into an original on YOUR platform: no box office,
   no license check — value arrives as subscribers, weekly ARPU and library ceiling */
function finishOwnStreamerOriginal(p){
  if(!G.streamer) return false;
  const q=p.quality||computeQuality(p);
  const est=ownPremiereEstimate(p);
  const f={ id:p.id, title:p.title, genre:p.genre, scale:p.scale, budget:p.budget,
    marketing:p.marketingPaid||0, devCost:p.devCost||0, quality:q,
    streamingOriginal:true, platform:G.streamer.name, soldTo:G.streamer.name, onOwn:true,
    releaseWeek:G.week, weekly:[], dom:0, ww:0, studioRev:0,
    profit:-((p.budget||0)+(p.devCost||0)+(p.marketingPaid||0)),
    inTheaters:false, awardsEligible:true, year:yearOf(G.week), reviews:[] };
  reviewFilm(f);
  G.films.push(f);
  G.projects=G.projects.filter(x=>x!==p);
  G.stats.films++;
  G.streamer.subs=Math.round((G.streamer.subs+est.subs)*100)/100;
  G.streamer.peak=Math.max(G.streamer.peak||0, G.streamer.subs);
  G.streamer.lastContent=G.week;
  freeProjectTalent(p);
  log("📺 \""+p.title+"\" premieres on "+G.streamer.name+" — +"+est.subs+"M subscribers overnight. It earns weekly from here, and the library ceiling grows.","gold");
  if(est.subs>=2) G.confetti=true;
  saveGame();
  return true;
}
function tickPay1(){
  for(const f of G.films){
    if(f.pay1At && G.week>=f.pay1At && !f.pay1Paid && !f.streamingOriginal && !f.onOwn){
      f.pay1Paid=true;
      const pay = Math.round((f.ww||0)*(f.pay1Rate||0.06));
      if(pay>0){ earn("pay1", pay); log("📺 Pay-1 TV window: \""+f.title+"\" lands "+fmtM(pay)+" (6% of WW).","good"); }
    }
  }
}

/* ═══════════ live sports rights (v3) — quarterly sealed-bid auctions ═══════════ */
/* Cricket joins the rights market (football = soccer). Guarded push so old
   saves and the DATA table stay compatible. */
if(typeof DATA!=="undefined"&&DATA.SPORTS&&!DATA.SPORTS.some(s=>s.id==="cricket")){
  DATA.SPORTS.push({id:"cricket", name:"Cricket Championship", icon:"🏏", blurb:"Fifty-over fever — massive live audiences, short season."});
}
/* Rights economics: duration/audience/ad/revenue estimates from package size.
   Display only — settlement still pays the existing sub bump + decaying power. */
function sportEcon(pkg){
  const dur={soccer:39, hoops:30, racing:26, fights:20, wrestling:26, esports:22, cricket:30}[pkg.id]||26;
  const audience=Math.round(pkg.base/6*10)/10;
  const ad=Math.round(audience*0.15*10)/10;
  const revenue=Math.round((pkg.subBump*0.5*Math.min(26,dur)+ad*dur)*10)/10;
  return {dur, audience, ad, revenue};
}
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
    G.sportsDeals=G.sportsDeals||{};
    G.sportsDeals[pkg.id]={base:pkg.base, subBump:pkg.subBump, sportPower:pkg.sportPower, week:G.week, bid};
    unlockAchv("sports", "Live & Buzzing", "Win a live sports rights package.");
    const ec=sportEcon(pkg);
    log(pkg.icon+" Won "+pkg.name+" rights for "+fmtM(bid)+" ("+ec.dur+"w season) — sports power +"+pkg.sportPower+", +"+pkg.subBump+"M subs, ~"+fmtM(ec.revenue)+" expected value.","gold");
  }else{
    log(pkg.icon+" Lost the "+pkg.name+" rights — a rival's "+fmtM(pkg.rivalBid)+" beat your "+fmtM(bid)+".","bad");
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
  /* v28: a purchased legacy franchise shows its built-in fanbase on the first entry */
  if(fr.purchased && fr.purchasedLeft>0){
    fr.purchasedLeft=0;
    fr.ww += 15;
    log("🌍 The built-in fanbase of the purchased \""+fr.name+"\" universe shows up at the box office.","good");
  }
  addFatigue(fr);   // v4: every entry burns a little audience goodwill
  G.studio.rep = clamp(G.studio.rep+1, 5, 99);
  if(fr.entries.length===1) log("🏰 FRANCHISE ANNOUNCED: \""+fr.name+"\" is now a universe — sequels, merch, parks.","gold");
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
  log("🧸 \""+fr.name+"\" toy line signed — action figures on shelves by the holidays (merch income ×1.3 forever).","gold");
  saveGame();
}
function upgradeMerch(id){
  const fr=frById(id); if(!fr || fr.merch>=3) return;
  const c=merchCost(fr); if(G.studio.cash<c) return;
  spend("studio", c); fr.merch++;
  G.studio.rep=clamp(G.studio.rep+1,5,99);
  const label=["","toy & apparel line","global merch program","full consumer-products empire"][fr.merch];
  log("🧸 \""+fr.name+"\": launched "+label+" (−"+fmtM(c)+", +weekly income).","gold");
  saveGame();
}
function buildPark(id){
  const fr=frById(id); if(!fr || fr.park>=3 || fr.tier<2) return;
  const c=parkCost(fr); if(G.studio.cash<c) return;
  spend("studio", c); fr.park++;
  G.studio.rep=clamp(G.studio.rep+3,5,99);
  const lvl=["","theme-park attraction built","second gate expansion opened","full resort district opened"][fr.park]||"expanded";
  log("🎡 \""+fr.name+"\": "+lvl+" (−"+fmtM(c)+"). A landmark for the studio.","gold");
  saveGame();
}
function sellGameRights(id){
  const fr=frById(id); if(!fr || fr.gameSold===fr.tier) return;
  const v=Math.round(20 + fr.tier*12 + Math.min(40, fr.ww/50));
  earn("empire", v); fr.gameSold=fr.tier;
  log("🎮 \""+fr.name+"\" game rights licensed for "+fmtM(v)+".","gold");
  saveGame();
}
/* ── per-film merchandising: one-shot licensing lines for eligible releases ──
   Demand reuses genre merch factor, audience score, WW scale and franchise
   heat — flops and adult dramas can absolutely lose money here. State lives on
   f.merchLines (saved, no schema change). */
function merchLineDefs(){
  return [
    {id:"toys", name:"Toys", icon:"🧸", cost:14, rev:1.5, desc:"Action figures & playsets. Kids carry it."},
    {id:"cloth", name:"Clothing", icon:"👕", cost:8, rev:1.2, desc:"Tees, hoodies, high-street lines."},
    {id:"collect", name:"Collectibles", icon:"🏆", cost:10, rev:1.35, desc:"Limited runs for superfans. Heat matters."},
    {id:"games", name:"Games", icon:"🎮", cost:22, rev:1.6, desc:"Licensed title. Expensive, spiky upside."},
    {id:"license", name:"Licensing", icon:"📦", cost:6, rev:1.15, desc:"Lunchboxes to bedding. Steady shelf rent."},
    {id:"brand", name:"Brand partnership", icon:"🤝", cost:12, rev:1.4, desc:"A global brand co-signs. Buzz required."},
  ];
}
function merchDemand(f, lineId){
  const g=DATA.GENRES[f.genre]||{merch:0.5};
  const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):(f.quality?f.quality.aud:50);
  let d=g.merch*45 + aud*0.35 + clamp(Math.log10(Math.max(10,f.ww||10))*12-8,0,22);
  if(f.franchiseName){ const fr=G.franchises.find(x=>x.name===f.franchiseName);
    if(fr) d+=fr.tier*6+(fr.decay||0)*10; }
  if(lineId==="toys"&&(f.genre==="animation"||f.genre==="fantasy")) d+=12;
  if(lineId==="games"&&(f.genre==="action"||f.genre==="scifi"||f.genre==="fantasy")) d+=8;
  if(lineId==="brand"&&(f.buzzBonus||0)<0.05) d-=15;
  if(lineId==="collect") d+=(f.reviewBombed?-10:8);
  return clamp(Math.round(d),5,99);
}
function merchPlan(f, lineId){
  const def=merchLineDefs().find(x=>x.id===lineId); if(!def) return null;
  const demand=merchDemand(f, lineId);
  const cost=Math.round(def.cost*(0.7+(f.budget||40)/120)*10)/10;
  const revenue=Math.round(cost*def.rev*(demand/55)*10)/10; // cold shelves lose money
  return {def, demand, cost, revenue, profit:Math.round((revenue-cost)*10)/10,
    brand:clamp(Math.round(demand/12+(f.franchiseName?2:0)),0,10)};
}
function merchEligible(f){
  return f&&!f.streamingOriginal&&(f.ww||0)>=40&&!(f.merchDone);
}
function launchMerchLine(fid, lineId){
  const f=G.films.find(x=>x.id===+fid); if(!f) return false;
  if(!merchEligible(f)) return false;
  if((f.merchLines||[]).some(m=>m.id===lineId)) return false;
  const plan=merchPlan(f, lineId); if(!plan) return false;
  if(G.studio.cash<plan.cost){ log("💸 The "+plan.def.name.toLowerCase()+" line costs "+fmtM(plan.cost)+".","bad"); return false; }
  spend("studio", plan.cost); earn("empire", plan.revenue);
  f.merchLines=(f.merchLines||[]).concat([{id:lineId, demand:plan.demand, cost:plan.cost, revenue:plan.revenue, profit:plan.profit, week:G.week}]);
  f.brand=(f.brand||0)+plan.brand;
  if(plan.profit>=0) log(plan.def.icon+" \""+f.title+"\" "+plan.def.name.toLowerCase()+" line: −"+fmtM(plan.cost)+" → +"+fmtM(plan.revenue)+" (demand "+plan.demand+").","gold");
  else log(plan.def.icon+" \""+f.title+"\" "+plan.def.name.toLowerCase()+" line flopped: −"+fmtM(plan.cost)+" → +"+fmtM(plan.revenue)+" (demand "+plan.demand+"). Not everything sells.","bad");
  saveGame(); return true;
}
function tickEmpire(){
  for(const fr of G.franchises){
    const inc=frWeeklyIncome(fr);
    if(inc>=0.1){ earn("empire", inc); fr.earned=(fr.earned||0)+inc; }
    fr.decay=Math.max(0.25, fr.decay*(fr.park? 0.996 : 0.982));
  }
}

/* ═══════════ awards (year end) ═══════════ */
/* ── awards season rollup: predicted noms, snub watch, spend, history ──
   Prestige mirrors runAwards exactly so the dashboard never promises a win. */
function awardPrestige(f){
  const g=DATA.GENRES[f.genre]||{awards:0.5};
  return (f.quality.critic+(f.campaign||0))*(0.6+g.awards*0.5)*(1+projectAbilities(f).award);  // v28: Awards Darling & co.
}
function awardSeason(){
  const yr=yearOf(G.week);
  const mine=G.films.filter(f=>f.year===yr&&f.awardsEligible&&f.quality);
  const rows=mine.map(f=>({f, prestige:Math.round(awardPrestige(f)*10)/10,
    nom:awardPrestige(f)>=55, snub:awardPrestige(f)>=50&&awardPrestige(f)<55})).sort((a,b)=>b.prestige-a.prestige);
  return {yr, rows,
    noms:rows.filter(r=>r.nom), snubs:rows.filter(r=>r.snub),
    spend:Math.round(mine.reduce((a,f)=>a+(f.campaignSpend||0),0)*10)/10,
    precursors:(G.precursorWins&&G.precursorWins.year===yr)?G.precursorWins.count:0,
    fest:(G.festWins||[]).filter(w=>w.year===yr),
    past:(G.stats.awards||[]).slice(-8).reverse(),
    last:G.lastAwards&&G.lastAwards.year===yr-1?G.lastAwards:null};
}
function awardHeatBump(f){ // wins make talent: heat up the billed cast & director
  [(f.director||null)].concat(f.cast||[]).forEach(t=>{
    if(t&&Number.isFinite(t.heat)) t.heat=Math.min(3,t.heat+1); });
}
/* ── reputation identities: earned from behavior, never just labels ──
   Six scores derive from released films, awards, franchises and streaming.
   Perks are purely additive unlocks at 55+ — nothing is ever taken away. */
function repScores(){
  const films=(G.films||[]).filter(f=>!f.streamingOriginal);
  const ww=films.reduce((a,f)=>a+(f.ww||0),0);
  const tentWW=films.filter(f=>f.scale==="tentpole").reduce((a,f)=>a+(f.ww||0),0);
  const bigOpen=films.filter(f=>(f.opening||0)>=100).length;
  const crits=films.filter(f=>f.quality).map(f=>f.quality.critic);
  const avgCrit=crits.length?crits.reduce((a,b)=>a+b,0)/crits.length:0;
  const awards=(G.stats.awards||[]).length;
  const indie=films.filter(f=>f.scale==="indie");
  const indieProfit=indie.reduce((a,f)=>a+(f.profit||0),0);
  const frWW=(G.franchises||[]).reduce((a,fr)=>a+(fr.ww||0),0);
  const byGenre={};
  films.forEach(f=>{ if(!f.genre||!DATA.GENRES[f.genre]) return;
    byGenre[f.genre]=byGenre[f.genre]||{n:0,profit:0}; byGenre[f.genre].n++; byGenre[f.genre].profit+=f.profit||0; });
  let topG=null; for(const g in byGenre){ if(!topG||byGenre[g].n>byGenre[topG].n) topG=g; }
  const streamFilms=(G.films||[]).filter(f=>f.streamingOriginal||f.soldTo).length;
  const cl=(v)=>clamp(Math.round(v),0,100);
  const scores={
    blockbuster: films.length?cl(tentWW/Math.max(1,ww)*80+bigOpen*10):0,
    prestige: films.length?cl((avgCrit-50)*2.5+awards*4):0,
    indie: cl(indie.length*12+(indieProfit>0&&indie.length?10:0)),
    franchise: cl(frWW/Math.max(1,ww)*80+(G.franchises||[]).length*5),
    genre: 0, genreName:"",
    streaming: cl(Math.min(100,(G.streamer?G.streamer.subs:0)*1.2+streamFilms*6+(G.stats.seriesSeasons||0)*4)),
  };
  if(topG&&films.length>=3){
    scores.genre=cl(byGenre[topG].n/films.length*100*(byGenre[topG].profit>0?1:0.5));
    scores.genreName=DATA.GENRES[topG]?DATA.GENRES[topG].name:topG;
  }
  return scores;
}
function repIdentity(){
  const s=repScores();
  const order=[["blockbuster","BLOCKBUSTER STUDIO"],["prestige","PRESTIGE STUDIO"],["indie","INDIE STUDIO"],["franchise","FRANCHISE STUDIO"],["genre","GENRE SPECIALIST"],["streaming","STREAMING GIANT"]];
  let best=null;
  for(const [k,label] of order){ if(s[k]>=40&&(!best||s[k]>best.v)) best={k,label,v:s[k]}; }
  return best||{k:"emerging",label:"EMERGING STUDIO",v:0};
}
function repPerk(k){ try{ return (repScores()[k]||0)>=55; }catch(e){ return false; } }
/* ── studio specializations: declared focus, XP from matching releases ──
   Levels 0–3 (xp 0/2/4/7), one active focus earning double, yearly decay for
   idle paths. Bonuses are small, capped, and stack with nothing permanent. */
function specDefs(){
  return [
    {id:"blockbuster", name:"Blockbuster", icon:"💥", desc:"Tentpole openings +1%/lvl."},
    {id:"prestige", name:"Prestige", icon:"🏛", desc:"Festival odds +2%/lvl."},
    {id:"horror", name:"Horror", icon:"👻", desc:"Horror openings +2%/lvl."},
    {id:"animation", name:"Animation", icon:"🎨", desc:"Animation legs +0.03/lvl."},
    {id:"family", name:"Family", icon:"🧸", desc:"Animation/fantasy openings +1.5%/lvl."},
    {id:"action", name:"Action", icon:"💪", desc:"Action openings +1.5%/lvl."},
    {id:"franchise", name:"Franchise", icon:"🏰", desc:"Sequel buzz +0.02/lvl."},
    {id:"streaming", name:"Streaming", icon:"📱", desc:"OTT offers +2%/lvl."},
    {id:"intl", name:"International", icon:"🌍", desc:"Intl rentals +1%/lvl."},
    {id:"indie", name:"Indie", icon:"🎬", desc:"Indie dev −5%/lvl."},
  ];
}
function specLvl(id){
  const xp=(G.spec&&G.spec.xp&&G.spec.xp[id])||0;
  return xp>=7?3:xp>=4?2:xp>=2?1:0;
}
function specBonus(id){
  const table={blockbuster:0.01, prestige:0.02, horror:0.02, animation:0.03, family:0.015,
    action:0.015, franchise:0.02, streaming:0.02, intl:0.01, indie:0.05};
  return specLvl(id)*(table[id]||0);
}
function specGain(id, n){
  G.spec=G.spec||{xp:{}, focus:null, log:[]};
  const mult=(G.spec.focus===id)?2:1;
  G.spec.xp[id]=Math.min(12,((G.spec.xp[id])||0)+n*mult);
  G.spec.gained=G.spec.gained||{}; G.spec.gained[id]=true;
  const wasFocused=G.spec.focus===id;
  const lvl=specLvl(id);
  if(n>0&&(G.spec["ann"+id]||0)!==lvl&&lvl>0){ G.spec["ann"+id]=lvl;
    log(specDefs().find(d=>d.id===id).icon+" Specialization: "+id+" reached level "+lvl+(wasFocused?" (focused)":"")+".","gold"); }
}
function specFocus(id){
  if(!(specDefs().some(d=>d.id===id))) return false;
  G.spec=G.spec||{xp:{}, focus:null, log:[]};
  if(G.spec.focus===id) return true;
  G.spec.focus=id;
  log("🎯 Studio focus: "+id+". Matching releases earn double XP; switch anytime.","gold");
  saveGame(); return true;
}
function specRelease(f){
  if(f.scale==="tentpole") specGain("blockbuster", f.ww>=breakevenWW(f)?2:1);
  if((f.quality||{}).critic>=70) specGain("prestige",1);
  if(f.genre==="horror") specGain("horror",1);
  if(f.genre==="animation") specGain("animation",1);
  if(["animation","fantasy","musical","comedy"].includes(f.genre)) specGain("family",1);
  if(f.genre==="action") specGain("action",1);
  if(f.franchiseName) specGain("franchise",1);
  if(f.scale==="indie") specGain("indie",1);
  try{
    const share=DATA.GENRES[f.genre]?DATA.GENRES[f.genre].intlShare:0.5;
    if(share>=0.55) specGain("intl",1);
  }catch(e){}
}
function specYearTick(){ // idle paths fade; the studio becomes what it ships
  G.spec=G.spec||{xp:{}, focus:null, log:[]};
  for(const id in (G.spec.xp||{})){
    if(G.spec.xp[id]>0&&!(G.spec.gained&&G.spec.gained[id])) G.spec.xp[id]--;
  }
  G.spec.gained={};
}
function runAwards(){
  const yr=yearOf(G.week)-1;
  const mine=G.films.filter(f=>f.year===yr && f.awardsEligible);
  const noms=[];
  for(const f of mine){
    const g=DATA.GENRES[f.genre];
    const prestige=(f.quality.critic + (f.campaign||0))*(0.6+g.awards*0.5)*(1+projectAbilities(f).award);   // v28: award-season abilities
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
  const myNoms=field.filter(n=>n.mine);
  if(myNoms.length) log("📣 AWARDS NOMINATIONS ANNOUNCED: "+myNoms.map(n=>"\""+n.title+"\"").join(" · ")+" — campaign spend meets destiny.","gold");
  if(field.length){
    // best picture: weighted by prestige^2
    const tot=field.reduce((a,n)=>a+Math.pow(n.prestige,2),0);
    let r=rnd()*tot, winner=field[0];
    for(const n of field){ r-=Math.pow(n.prestige,2); if(r<=0){winner=n;break;} }
    results.bestPicture=winner;
    if(winner.mine){
      const f=winner.f;
      f.awards=f.awards||[]; f.awards.push("Best Picture");
      if(typeof grantAwardXP==="function") grantAwardXP(f);
      f.dom+=15; f.ww+=20; f.studioRev+=15; earn("theatrical", 15);
      // v5: the Oscar bump — a post-win re-release gross worth ~25% of the P&A you spent
      const bump0 = DATA.OSCAR_BUMP? DATA.OSCAR_BUMP*(f.marketing||0)*0.6 : 0;
      const bump = Math.round((15 + bump0)*10)/10;
      if(bump>15){ f.dom+=bump; f.ww+=Math.round(bump*1.35); f.studioRev+=bump; earn("theatrical", bump*0.53); }
      f.oscarBumped=true;
      G.studio.rep=clamp(G.studio.rep+7,5,99);
      awardHeatBump(f); // the winners' next quote just went up
      if(typeof grantWalkOfFame==="function") grantWalkOfFame(f, "\""+f.title+"\" won Best Picture");
      G.stats.awards.push({year:yr, cat:"Best Picture", film:f.title});
      sfx("drums"); G.confetti=true;
      log("🏆 BEST PICTURE: \""+f.title+"\"! +7 reputation"+(bump>0? ", and the Oscar-bump re-release grosses "+fmtG(bump):"")+".","gold");
      results.wins.push({cat:"Best Picture", film:f.title, mine:true});
    }else{
      results.wins.push({cat:"Best Picture", film:winner.title, mine:false, studio:winner.studio});
      log("🏆 "+DATA.AWARDS+": Best Picture went to \""+winner.title+"\" ("+winner.studio+").","");
    }
    // acting/directing
    const myNoms=field.filter(n=>n.mine);
    if(myNoms.length){
      if(chance(.6)){
        const n=pick(myNoms); n.f.awards=n.f.awards||[];
        const cat=pick(["Best Director","Best Actor","Best Actress"]);
        n.f.awards.push(cat); G.studio.rep=clamp(G.studio.rep+3,5,99);
        awardHeatBump(n.f);
        if(typeof grantAwardXP==="function") grantAwardXP(n.f);
        G.stats.awards.push({year:yr, cat, film:n.f.title});
        const nudge = DATA.ACTING_BUMP? Math.round(DATA.ACTING_BUMP*(n.f.marketing||0)*0.6*10)/10 : 0;
        if(nudge>1){ n.f.dom+=nudge; n.f.ww+=nudge; earn("theatrical", nudge*0.53); n.f.studioRev+=nudge; }
        log("🏆 "+cat+": \""+n.f.title+"\" takes it home. +3 reputation"+(nudge>1?", +"+fmtG(nudge)+" victory-lap gross":"")+".","gold");
        results.wins.push({cat, film:n.f.title, mine:true});
      }
    }
  }else{
    log("礼服 Season came and went. No nominations for "+G.studio.name+".","bad");
  }
  // snubs: best of the rest, on the record + a stored season card for the dashboard
  const mySorted=noms.filter(n=>n.mine).sort((a,b)=>b.prestige-a.prestige);
  const snubbed=mySorted.filter(n=>!field.includes(n)&&n.prestige>=50).slice(0,2);
  snubbed.forEach(n=>{ log("😶 Snubbed: \""+n.title+"\" ("+Math.round(n.prestige)+" prestige) missed the field of "+field.length+". More campaign might have closed it.","bad"); });
  G.lastAwards={year:yr,
    noms:field.filter(n=>n.mine).map(n=>n.title),
    wins:results.wins.filter(w=>w.mine).map(w=>w.cat+" — "+w.film),
    snubs:snubbed.map(n=>n.title)};
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
  G.repHist=G.repHist||[];
  try{ const id=repIdentity(); G.repHist.push({year:yr, rep:Math.round(G.studio.rep), id:id.label}); }catch(e){}
  if(G.repHist.length>12) G.repHist.length=12;
  try{ specYearTick(); }catch(e){}
  const awards=runAwards();
  G.pendingReport={ year:yr, myWW, standings, awards,
    filmsReleased:G.films.filter(f=>f.year===yr).length,
    profit:G.films.filter(f=>f.year===yr).reduce((a,f)=>a+(f.profit||0),0) };
  // economy: yearly inflation compounds across the whole market
  G.infl = Math.round((G.infl||1) * (1+(DATA.INFLATION||0.02)) * 1000)/1000;
  log("📈 Inflation ticked up: the whole market is now ~"+Math.round(((G.infl-1)*100))+"% pricier than Year 1.","");
  // v5: wage inflation — talent quotes compound harder than the market (3%/yr), overhead creeps 2%/yr
  G.wageInfl = Math.round((G.wageInfl||1) * (1.02+rnd()*0.02) * 1000)/1000; // talent salaries: 2–4%/yr, ~3% mean
  try{ econDrift(); }catch(e){}
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

/* ═══════════ news + social buzz from real state ─────────
   Weekly: big openings, scandals, review bombs, beloved films and hot casts
   generate feed news AND small buzzBonus nudges (openings move). Rival smash
   openings get reported too. Nothing here invents events — only reacts. */
function tickBuzz(){
  for(const f of (G.films||[])){
    if(!f.inTheaters||!f.quality) continue;
    f.social=f.social||{hype:0, memes:0, theories:0, controversy:0};
    const s=f.social;
    if(!f.buzzBig&&f.opening>=60){
      f.buzzBig=true; s.hype+=2;
      log("💥 BLOCKBUSTER OPENS BIG: \""+f.title+"\" storms to "+fmtG(f.opening)+" — memes incoming.","gold");
    }
    const aud=(typeof audienceScoreOf==="function")?audienceScoreOf(f):f.quality.aud;
    if(aud>=80&&!s.memes&&chance(0.3)){
      s.memes=1; s.theories=1;
      f.buzzBonus=Math.round(((f.buzzBonus||0)+0.02)*100)/100;
      log("🐸 \""+f.title+"\" is a meme machine — fan theories everywhere (+2% buzz).","good");
    }
    if((f.cast||[]).some(c=>c.scandal>0)&&!s.scandalFlag){
      s.scandalFlag=true; s.controversy+=2;
      f.buzzBonus=Math.round(((f.buzzBonus||0)-0.02)*100)/100;
      log("📉 \""+f.title+"\" press tour drowned by its star's scandal (−2% buzz).","bad");
    }
    if(f.reviewBombed&&!s.bombFlag){
      s.bombFlag=true; s.controversy+=1;
      log("🍅 The pile-on against \""+f.title+"\" is now the story.","bad");
    }
    if(((f.quality||{}).overall||0)>=85&&!s.acclaimFlag){
      s.acclaimFlag=true; s.hype+=1;
      log("🌟 \""+f.title+"\" is critically untouchable — prestige glow (+buzz).","good");
    }
  }
  for(const r of (G.rivals||[])){
    for(const f of (r.slate||[])){
      if(f.week===G.week&&f.opening>=100&&!f.buzzNews){
        f.buzzNews=true;
        log("😤 Rival smash: "+r.name+"'s \""+f.title+"\" opens to "+fmtG(f.opening)+". The town notices.","bad");
      }
      if(f.week===G.week&&f.opening>=60&&f.scale==="tentpole"&&!f.frNews&&chance(0.4)){
        f.frNews=true;
        log("🏰 "+r.name+" fast-tracks a franchise around \""+f.title+"\".","bad");
      }
    }
  }
}
/* ═══════════ celebrity events: fictional names, real variables ─────────
   Merged into the DATA.EVENTS pool once, so choices/modals/news/history ride
   the existing pipeline. Every effect lands on rep, cash, talent, production
   or buzz — and each firing is recorded in G.eventHist for the log. */
function histEv(title, tone){
  G.eventHist=G.eventHist||[];
  G.eventHist.unshift({week:G.week, title, tone:tone||""});
  if(G.eventHist.length>80) G.eventHist.length=80;
}
DATA.CELEB_EVENTS=[
  {id:"celeb_controversy", w:3, icon:"😱", title:"Star controversy", kind:"choice",
   text:G=>{ const t=G.talent.find(t=>t.booked&&t.kind==="actor")||null; G._evtT=t;
     return t? t.name+" said the quiet part loud on a press tour. The clip has "+(2+G.week%5)+"M views.":"A star is trending for the wrong reasons."; },
   when:G=>G.talent.some(t=>t.booked&&t.kind==="actor"),
   choices:G=>[
     {label:"Apology tour (−$3M, cools it down)", run(G){ const t=G._evtT; spend("other",3);
       if(t){ t.scandal=Math.max(0,(t.scandal||0)-20); t.heat=0; }
       G.studio.rep=clamp(G.studio.rep+1,5,99);
       histEv("Apology tour for "+(t?t.name:"a star"),"good");
       G.log("🙏 Apology tour: sincere, brief, no sequel. The cycle moves on.","good"); }},
     {label:"No comment (rep −2, heat gone)", run(G){ const t=G._evtT;
       if(t) t.heat=0; G.studio.rep=clamp(G.studio.rep-2,5,99);
       histEv("No comment on "+(t?t.name:"a star")+" controversy","bad");
       G.log("🤐 No comment. The silence gets clipped too. Rep −2.","bad"); }}]},
  {id:"celeb_dispute", w:3, icon:"🎬", title:"Set dispute", kind:"choice",
   text:"A department head on a shoot is threatening to walk over turnaround times.",
   when:G=>G.projects.some(p=>p.phase==="shoot"),
   choices:G=>[
     {label:"Pay the crew +$4M (morale, +buzz)", run(G){ const p=pick(G.projects.filter(x=>x.phase==="shoot")); spend("other",4);
       if(p) p.buzzBonus=Math.round(((p.buzzBonus||0)+0.03)*100)/100;
       histEv("Set dispute settled with cash","good");
       G.log("🤝 You paid the crew. The set hums again (+buzz on \""+(p?p.title:"?")+"\").","good"); }},
     {label:"Hold the line (shoot pauses 2 wks)", run(G){ G.projects.filter(p=>p.phase==="shoot").forEach(p=>p.strikePause=(p.strikePause||0)+2);
       histEv("Set dispute → 2-week pause","bad");
       G.log("✊ You held the line. Shoots pause 2 weeks.","bad"); }}]},
  {id:"celeb_injury", w:2, icon:"🤕", title:"Actor injury", kind:"choice",
   text:G=>{ const t=G.talent.find(t=>t.booked&&t.kind==="actor")||null; G._evtT=t;
     return t? t.name+" twisted an ankle on a stunt — out for days, maybe weeks.":"A lead is injured on a stunt.";
   },
   when:G=>G.talent.some(t=>t.booked&&t.kind==="actor"&&G.projects.some(p=>p.phase==="shoot")),
   choices:G=>[
     {label:"Halt the shoot (pause 2 wks)", run(G){ G.projects.filter(p=>p.phase==="shoot").forEach(p=>p.strikePause=(p.strikePause||0)+2);
       histEv("Injury halt: 2-week pause","bad");
       G.log("🤕 Safety first. Shoots pause 2 weeks.","bad"); }},
     {label:"Shoot around it (+$2M overrun)", run(G){ const p=pick(G.projects.filter(x=>x.phase==="shoot"));
       if(p){ p.overrun=Math.round(((p.overrun||0)+2)*10)/10; p.budget=Math.round((p.budget+2)*10)/10; spend("production",2); }
       histEv("Injury: shot around it (+$2M)","");
       G.log("🎥 Stunt doubles and tight close-ups. +$2M overrun, schedule saved.",""); }}]},
  {id:"celeb_clash", w:2, icon:"💥", title:"Director clash", kind:"choice",
   text:G=>{ const t=G.talent.find(t=>t.booked&&t.kind==="director")||null; G._evtT=t;
     return t? t.name+" wants final cut — in writing, by Friday.":"Your director wants final cut."; },
   when:G=>G.talent.some(t=>t.booked&&t.kind==="director"),
   choices:G=>[
     {label:"Pay for peace (+$5M, they stay)", run(G){ const t=G._evtT; spend("talent",5);
       histEv("Director clash bought off","good");
       G.log("🕊️ Peace costs $5M. "+(t?t.name+" stays.":"The director stays."),"good"); }},
     {label:"Part ways (rep −1, no director)", run(G){ const t=G._evtT;
       if(t){ t.bookedUntil=0; t.booked=null; t.grudge=(t.grudge||0)+1;
         G.projects.forEach(p=>{ if(p.director&&p.director.id===t.id) p.director=null; }); }
       G.studio.rep=clamp(G.studio.rep-1,5,99);
       histEv("Director walked ("+(t?t.name:"?")+")","bad");
       G.log("🚪 Parted ways. The film continues directorless — quality will feel it.","bad"); }}]},
  {id:"celeb_viral", w:4, icon:"🎙", title:"Viral interview",
   text:"A late-night clip is everywhere: funny, human, quotable.",
   when:G=>G.talent.some(t=>t.booked),
   run(G){ const t=pick(G.talent.filter(x=>x.booked)); if(!t) return;
     t.heat=Math.min(3,(t.heat||0)+1);
     const p=G.projects.find(x=>x.title===(t.booked||"").replace(" (writer)","").replace(" (producer)","").replace(" (cameo)",""));
     if(p) p.buzzBonus=Math.round(((p.buzzBonus||0)+0.05)*100)/100;
     histEv(t.name+" goes viral","good");
     G.log("🎙️ "+t.name+" goes viral — charming, everywhere (+heat"+(p?", +buzz on \""+p.title+"\"":"")+").","good"); }},
  {id:"celeb_comeback", w:2, icon:"🌅", title:"Surprise comeback", kind:"choice",
   text:G=>{ const r=(G.retired||[])[(G.retired||[]).length-1]; G._evtR=r;
     return r? "Retired "+r.kind+" "+r.name+" is restless — comeback vehicle?":"A retired legend is restless."; },
   when:G=>(G.retired||[]).length>0,
   choices:G=>[
     {label:"Back them (they rejoin, heat ×2)", run(G){ const r=G._evtR; if(!r) return;
       const t=genActor(true); t.name=r.name; t.comeback=true; t.heat=2; t.age=r.age||50;
       G.retired=G.retired.filter(x=>x!==r); G.talent.push(t);
       histEv("Comeback: "+r.name,"gold");
       G.log("🌅 Comeback: "+r.name+" is back on the call sheet (heat ×2).","gold"); }},
     {label:"Let them rest", run(G){ histEv("Passed on a comeback",""); G.log("🌅 You let the legend rest.",""); }}]},
  {id:"celeb_endorse", w:3, icon:"💎", title:"Major endorsement",
   text:"A luxury house wants a face for the season.",
   when:G=>G.talent.some(t=>t.kind==="actor"&&(t.power||0)>=4),
   run(G){ const pool=G.talent.filter(t=>t.kind==="actor"&&(t.power||0)>=4); const t=pick(pool); if(!t) return;
     earn("other", 6); t.heat=Math.min(3,(t.heat||0)+1); G.studio.rep=clamp(G.studio.rep+1,5,99);
     histEv(t.name+" lands a luxury endorsement","good");
     G.log("💎 "+t.name+" lands a luxury endorsement: +$6M to the studio, +rep, +heat.","good"); }},
  {id:"celeb_apology", w:2, icon:"🙏", title:"Public apology", kind:"choice",
   text:G=>{ const t=G.talent.find(t=>t.scandal>0)||null; G._evtT=t;
     return t? t.name+" is ready to apologize properly — statement, donation, silence after.":"Someone wants to apologize."; },
   when:G=>G.talent.some(t=>t.scandal>0),
   choices:G=>[
     {label:"Stage it (−$2M, scandal cleared, rep +1)", run(G){ const t=G._evtT; spend("other",2);
       if(t) t.scandal=0; G.studio.rep=clamp(G.studio.rep+1,5,99);
       histEv("Staged apology for "+(t?t.name:"?"),"good");
       G.log("🙏 Apology staged and accepted. Scandal cleared.","good"); }},
     {label:"Let it rot", run(G){ histEv("Apology declined","bad"); G.log("🙏 No apology. The file stays open.","bad"); }}]},
  {id:"celeb_casting", w:3, icon:"📣", title:"Casting controversy", kind:"choice",
   text:G=>{ const t=G.talent.filter(t=>t.kind==="actor"&&(t.power||0)>=4&&!t.bookedUntil)[0]||null; G._evtT=t;
     return t? "Casting "+t.name+" has the internet divided down the middle.":"A dream casting splits the internet."; },
   when:G=>G.talent.some(t=>t.kind==="actor"&&(t.power||0)>=4&&!t.bookedUntil),
   choices:G=>[
     {label:"Defend it (rep +1, heat +1)", run(G){ const t=G._evtT;
       if(t) t.heat=Math.min(3,(t.heat||0)+1); G.studio.rep=clamp(G.studio.rep+1,5,99);
       histEv("Defended "+(t?t.name:"a casting")+" — it worked","good");
       G.log("📣 You defended the casting. The crowd came around.","good"); }},
     {label:"Back down (rep −1, quote −10%)", run(G){ const t=G._evtT;
       if(t) t.fee=Math.round(t.fee*0.9*10)/10; G.studio.rep=clamp(G.studio.rep-1,5,99);
       histEv("Caved on "+(t?t.name:"a casting"),"bad");
       G.log("📣 You caved. The quote drops 10% — so does your standing.","bad"); }}]},
];
if(!DATA.CELEB_MERGED){ DATA.CELEB_MERGED=true; DATA.EVENTS.push(...DATA.CELEB_EVENTS); }
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
/* ── career legacy: hall of fame across runs + optional heir bonus ──
   Hall lives in its own localStorage key — normal saves never touch it, and
   claiming an heirloom is opt-in at founding. */
const LEGACY_KEY="bow_legacy";
function legacyHall(){
  try{ const h=JSON.parse(localStorage.getItem(LEGACY_KEY)||"[]"); return Array.isArray(h)?h:[]; }
  catch(e){ return []; }
}
function careerLegacy(){
  const films=(G.films||[]);
  let smash=0;
  films.forEach(f=>{ try{ if(!f.streamingOriginal&&(f.ww||0)>=breakevenWW(f)*1.6) smash++; }catch(e){} });
  let val=0;
  try{ val=Math.round((G.studio.cash-(G.studio.debt||0)+catalogValue()+(G.streamer?(G.streamer.subs||0)*18:0))*10)/10; }catch(e){}
  const score=(G.stats.totalWW||0)/10 + (G.stats.totalProfit||0)/10 + (G.stats.films||0)*12 +
    (G.stats.seriesSeasons||0)*8 + (G.franchises||[]).length*50 + (G.stats.awards||[]).length*40 +
    smash*25 - (G.stats.flops||0)*8 + Math.max(0,val)/40 + (G.streamer?G.streamer.subs*2:0);
  const grade=score>=1500?"🎬 Living Legend":score>=700?"🏆 Mogul":score>=300?"⭐ Power Player":score>=100?"🎥 Working Studio":"🌱 Also Ran";
  return {studio:G.studio.name, weeks:G.week, years:yearOf(G.week),
    revenue:Math.round(G.stats.totalWW||0), profit:Math.round(G.stats.totalProfit||0),
    films:G.stats.films||0, series:G.stats.seriesSeasons||0, franchises:(G.franchises||[]).length,
    awards:(G.stats.awards||[]).length, smash, flops:G.stats.flops||0,
    value:val, subs:G.streamer?Math.round(G.streamer.subs*10)/10:0,
    achv:typeof achCount==="function"?achCount():0, score:Math.round(score), grade,
    seed:G.seed||null};
}
function recordLegacy(){
  try{
    const entry=careerLegacy(); entry.when=Date.now();
    const hall=legacyHall(); hall.unshift(entry);
    localStorage.setItem(LEGACY_KEY, JSON.stringify(hall.slice(0,8)));
    return entry;
  }catch(e){ return null; }
}
function claimLegacy(idx){
  const hall=legacyHall();
  const e=hall[+idx]; if(!e) return null;
  G.studio.cash+=25; G.studio.rep=clamp(G.studio.rep+3,5,99);
  log("🕊 Heir of \""+e.studio+"\" ("+e.grade+"): +$25M, +3 rep. A name opens doors.","gold");
  saveGame(); return e;
}
/* ── industry empire: optional late-game milestones, sandbox untouched ──
   Six goals tracked from real totals; completion is a log + custom
   achievement, never a gate. Crowned at 6/6. */
function endgameGoals(){
  const films=(G.films||[]);
  const domSum=films.reduce((a,f)=>a+(f.dom||0),0);
  const wwSum=films.reduce((a,f)=>a+(f.ww||0),0);
  let val=0;
  try{ val=(G.studio.cash-(G.studio.debt||0)+catalogValue()+(G.streamer?(G.streamer.subs||0)*18:0)); }catch(e){}
  const bestFr=(G.franchises||[]).slice().sort((a,b)=>(b.ww||0)-(a.ww||0))[0];
  const pic=(G.stats.awards||[]).some(a=>a.cat==="Best Picture");
  const myYtd=films.filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0);
  const rivalYtd=Math.max(1,...(G.rivals||[]).map(r=>r.ytd||0));
  return [
    {id:"boxoffice", name:"Dominate box office", icon:"💥", target:"$10B all-time WW", prog:clamp(wwSum/10000,0,1), label:fmtM(wwSum)+" / $10B"},
    {id:"streaming", name:"Dominate streaming", icon:"📱", target:"50M subs on your platform", prog:!G.streamer?0:clamp(G.streamer.subs/50,0,1), label:G.streamer?G.streamer.subs.toFixed(1)+"M / 50M":"no platform"},
    {id:"global", name:"Build a global studio", icon:"🌍", target:"$5B international gross", prog:clamp((wwSum-domSum)/5000,0,1), label:fmtM(Math.max(0,wwSum-domSum))+" / $5B"},
    {id:"franchise", name:"Legendary franchise", icon:"🏰", target:"one $2B franchise", prog:clamp((bestFr?bestFr.ww:0)/2000,0,1), label:bestFr?fmtM(bestFr.ww)+" / $2B ("+bestFr.name+")":"no franchise"},
    {id:"awards", name:"Major awards", icon:"🏆", target:"win Best Picture", prog:pic?1:clamp((G.stats.awards||[]).length/3,0,0.9), label:pic?"won":(G.stats.awards||[]).length+" awards"},
    {id:"empire", name:"Entertainment empire", icon:"🌌", target:"$2B studio value", prog:clamp(val/2000,0,1), label:fmtM(val)+" / $2B"},
  ].map(g=>Object.assign(g,{share:g.id==="boxoffice"&&myYtd>0?clamp(myYtd/Math.max(myYtd,rivalYtd),0,1):null}));
}
function endgameInfluence(){
  const myYtd=(G.films||[]).filter(f=>f.year===yearOf(G.week)).reduce((a,f)=>a+(f.ww||0),0);
  const tot=myYtd+(G.rivals||[]).reduce((a,r)=>a+(r.ytd||0),0)||1;
  return {share:Math.round(myYtd/tot*100),
    talent:(G.talent||[]).reduce((a,t)=>a+(t.power||0),0),
    intl:(G.films||[]).reduce((a,f)=>a+Math.max(0,(f.ww||0)-(f.dom||0)),0)};
}
function tickEndgame(){
  G.endgame=G.endgame||{done:{}};
  for(const g of endgameGoals()){
    if(g.prog>=1&&!G.endgame.done[g.id]){
      G.endgame.done[g.id]=G.week;
      unlockAchv("end_"+g.id, g.name, g.icon+" "+g.target+".");
      log(g.icon+" ENDGAME MILESTONE: "+g.name+" — "+g.target+".","gold");
      if(typeof sfx==="function") sfx("gold");
    }
  }
  const n=Object.keys(G.endgame.done).length;
  if(n>=6&&!G.endgame.crowned){
    G.endgame.crowned=G.week;
    unlockAchv("end_crown","Entertainment Empire","Complete all six endgame milestones.");
    if(typeof sfx==="function") sfx("smash"); G.confetti=true;
    log("👑 CROWNED: Entertainment Empire. The industry is yours.","gold");
  }
}
function gameOver(title, text){
  if(G.over) return;
  G.over={title, text, week:G.week, stats:G.stats};
  recordLegacy(); // the run enters the hall whether it ends in glory or red ink
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
  if(typeof tickContracts==="function") tickContracts();
  if(typeof tickResearch==="function") tickResearch();
  if(typeof tickFatigue==="function") tickFatigue();
  if(typeof tickPublic==="function") tickPublic();
  if(typeof tickProjects==="function") tickProjects();
  if(typeof tickCampaignDrops==="function") tickCampaignDrops();   // v13: staggered campaign drops fire pre-release
  if(typeof tickPromos==="function") tickPromos();                 // v13: promo appearances fire pre-release
  if(typeof tickAdvances==="function") tickAdvances();   // v12: advance sales bank weekly before release
  if(typeof tickBoard==="function") tickBoard();            // v14: board approval drifts
  if(typeof tickExecCareers==="function") tickExecCareers(); // v14: tenure, raises, poaching, retirement
  if(typeof tickEspionage==="function") tickEspionage();     // v14: rivals play dirty
  if(typeof tickLegal==="function") tickLegal();             // v14: disputes land on the desk
  if(typeof tickLabel==="function") tickLabel();             // v14: music label weekly income
  if(typeof tickGameStudio==="function") tickGameStudio();   // v16: game dev burns weekly, ships at gold master
  if(typeof tickGameSales==="function") tickGameSales();     // v16: released games' sales tail
  if(typeof tickFanMail==="function") tickFanMail();         // v15: the audience writes back
  for(const p of [...G.projects]){
    if(p.phase==="ready" && !p.prebuyAccepted && p.releaseWeek && p.releaseWeek<=G.week){
      const rest = Math.max(0, p.marketing - (p.marketingPaid||0));
      if(p.imax) spend("marketing", Math.round(rest*0.08));
      spend("marketing", rest);
      p.marketingPaid=(p.marketingPaid||0)+rest;
      releaseFilm(p);
    }
  }
  // v17: Economic cycle tick
  if(typeof tickEconomyCycle==="function") tickEconomyCycle();
  // v17: Geopolitical events
  if(typeof tryGeoEvent==="function") tryGeoEvent();
  // v20: Podcast ticks
  if(typeof tickPodcasts==="function") tickPodcasts();
  // v20: Animated pipeline check
  if(typeof checkAnimatedPipeline==="function") checkAnimatedPipeline();
  // v21: Guild strikes
  if(typeof tickGuildMeters==="function") tickGuildMeters();
  // v21: Casting scandal trigger
  if(typeof triggerCastingScandal==="function") triggerCastingScandal();
  // v21: War meter init
  if(typeof initWarMeter==="function") initWarMeter();
  // v22: Production chaos
  if(typeof triggerChaosEvent==="function") triggerChaosEvent();
  // v24: Rival AI
  if(typeof tickRivalAI==="function") tickRivalAI();
  // Prototype RPG systems
  if(typeof tickPrototypeSystems==="function") tickPrototypeSystems();
  if(typeof tickTheatrical==="function") tickTheatrical();
  if(typeof tickSeries==="function") tickSeries();
  if(typeof tickRivals==="function") tickRivals();
  if(typeof tickBuzz==="function") tickBuzz();
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
  /* v28: custom people integration - add custom people to talent pool */
  if(G.custom && G.custom.people){
    G.custom.people.forEach(cp=>{
      if(!G.talent.some(t=>t.id===cp.id) && chance(0.25)){
        const p = { ...cp, id:cp.id||nid(), kind:cp.kind||"actor", power:cp.power||3, 
          skill:cp.skill||70, fee:cp.fee||5, bookedUntil:0, heat:0, genreFit:null,
          age:cp.age||30, scandal:0, pics:0, joinedYear:yearOf(G.week),
          powerByRegion:{NA:cp.power||3, EU:cp.power||3, AS:cp.power||3, LA:cp.power||3, AF:cp.power||3},
          ability:genAbilityFor(cp.kind||"actor", cp.power||3), abilityKnown:false,
          prototype:{}, custom:true };
        G.talent.push(p);
      }
    });
  }
  G.talent=G.talent.filter(t=>!t.bookedUntil||t.bookedUntil>=G.week-30).slice(-52);
  if(typeof tickPoaching==="function") tickPoaching();
  if(typeof checkContractRenegotiation==="function") checkContractRenegotiation();
  if(typeof tickFestivals==="function") tickFestivals();
  if(typeof tickEvents==="function") tickEvents();
  if(typeof tickAchievements==="function") tickAchievements();
  if(typeof tickEndgame==="function") tickEndgame();
  if(typeof checkAchievements==="function") checkAchievements();
  if(typeof tickLicensedOut==="function") tickLicensedOut();
  if(typeof tickPiracy==="function") tickPiracy();
  if(typeof tickUnion==="function") tickUnion();
  if(typeof tickPrecursors==="function") tickPrecursors();
  if(typeof tickMa==="function") tickMa();
  if(typeof tickMaSlateRentals==="function") tickMaSlateRentals();
  if(typeof tickMaVault==="function") tickMaVault();
  if(typeof btlSeedIfMissing==="function") btlSeedIfMissing();   // v9: legacy saves
  if(typeof tickTraining==="function") tickTraining();           // v9: star school
  if(typeof G.week==="number" && G.week%13===0 && G.btlMarket){  // v9: quarterly BTL market rotation
    ["dp","composer","vfx"].forEach(r=>{
      const m=G.btlMarket[r]; if(!m||!m.length) return;
      m.splice(rint(0,m.length-1),1); m.push(genBTLCandidate(r));
    });
  }
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
  G.repHistory = G.repHistory || [];
  G.repHistory.push(G.studio.rep);
  if(G.repHistory.length > 52) G.repHistory.shift();
  if(typeof boardAvg==="function"){
G.boardHistory = G.boardHistory || [];
  G.boardHistory.push(boardAvg());
  if(G.boardHistory.length > 26) G.boardHistory.shift();
}
if(typeof performance!=="undefined" && performance.mark && performance.measure){
  performance.mark("bow_advance_end");
  try{ performance.measure("bow_advance_week", "bow_advance_start", "bow_advance_end"); }catch(e){}
}
// v28: Scenario progress tracking
if(G.scenario && !G.sandbox){
  const sc = G.scenarioProgress || (G.scenarioProgress = {});
  if(!sc[G.scenario]){
    sc[G.scenario] = { started: G.week, bestRep: G.studio.rep, won: false };
  }
  const sp = sc[G.scenario];
  sp.bestRep = Math.max(sp.bestRep || 0, G.studio.rep);
  // Win condition: rep >= 75 or survive 200 weeks
  if(!sp.won && (G.studio.rep >= 75 || G.week >= 200)){
    sp.won = true;
    sp.wonAt = G.week;
    log("🏆 SCENARIO COMPLETE: "+DATA.SCENARIOS[G.scenario].name+" won at week "+G.week+" (rep: "+G.studio.rep+")","gold");
  }
}
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
  log("🤝 \""+fr.name+"\" × global brand collab dropped — heat up, +"+fmtM(bump)+" merch spike.","good");
  saveGame();
}

function buildResort(id){
  const fr=frById(id); if(!fr || fr.resort || fr.park<1) return;
  if(G.studio.cash<400){ log("💸 Resorts & cruises cost $400M.","bad"); return; }
  spend("studio", 400); fr.resort=true;
  G.studio.rep=clamp(G.studio.rep+5,5,99);
  log("🏝 \""+fr.name+"\" resorts & cruise line opened (−$400M). Vacationers now live inside your IP.","gold");
  saveGame();
}

function buyIp(id){
  const it=(G.ipMarket||[]).find(x=>x.id===id); if(!it) return;
  /* v28: legacy/custom franchise listing — buy straight into the franchise stable */
  if(it.kind==="legacy" || it.kind==="custom"){
    if(G.studio.cash<it.price){ log("💸 Not enough cash for those rights.","bad"); return; }
    spend("development", it.price);
    G.franchises.push({ id:nid(), name:it.title, tier:1, entries:[], ww:0, merch:0, park:0, gameSold:0,
                        decay:1, genre:it.genre, earned:0, built:G.week, purchased:true, purchasedLeft:1,
                        custom: it.kind==="custom" });
    G.ipMarket = G.ipMarket.filter(x=>x!==it);
    log("🌍 Bought the \""+it.title+"\" franchise rights ("+fmtM(it.price)+") — proven IP with a ready fanbase. Your next entry gets a buzz bump. See Franchises.","gold");
    saveGame(); return;
  }
  if(G.studio.cash<it.price){ log("💸 Not enough cash for those rights.","bad"); return; }
  spend("development", it.price);
  const idea = genIdea();
  idea.genre=it.kind==="pd"? idea.genre : it.genre;
  idea.title = it.title;
  idea.blurb = "Adaptation of "+DATA.IPKINDS.find(k=>k.id===it.kind).name.toLowerCase()+" \""+it.title+"\".";
  idea.script = clamp(rint(56,80)+it.boost, 48, 96);
  idea.awareness = it.buzz;
  idea.hot = idea.hot || it.buzz>=0.09;
  idea.lapses = G.week+20;
  G.ideas.push(idea);
  G.ipMarket = G.ipMarket.filter(x=>x!==it);
  log("📚 Bought \""+it.title+"\" ("+DATA.IPKINDS.find(k=>k.id===it.kind).emoji+" "+fmtM(it.price)+") — script +"+it.boost+", built-in awareness. See Develop.","gold");
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

/* Director's cut / Extended edition — post-theatrical quality boost */
function makeDirectorsCut(f){
  const cost = Math.round(f.budget*0.15);
  if(G.studio.cash < cost){ toast("Need "+fmtM(cost)+" for director's cut.","bad"); beep("bad"); return false; }
  spend("studio", cost);
  f.directorsCut = true;
  f.quality.critic = clamp(f.quality.critic + 4, 0, 99);
  f.quality.overall = clamp(f.quality.overall + 3, 0, 99);
  f.legs = legsOf(f)*1.15; // legs boost
  f.rereleaseEligible = true;
  f.cutCost = cost;
  log("🎬 Director's cut completed for \""+f.title+"\" — critic +4, overall +3, legs +15%. Cost: "+fmtM(cost)+".","gold");
  beep("gold");
  return true;
}

/* Talent contract renegotiation — when heat ≥2 and under contract, they demand more */
function checkContractRenegotiation(){
  const renegotiations=[];
  (G.talent||[]).forEach(t=>{
    if(t.contract && (t.heat||0)>=2 && !t.renegotiated && chance(0.15)){
      const oldFee = actorFee(t);
      const mult = 1.2 + (t.heat||0)*0.15 + t.power*0.03;
      const newFee = Math.round(oldFee * mult * 10)/10;
      t.renegotiated = true;
      t.contract.renegotiated = true;
      t.contract.newFee = newFee;
      renegotiations.push({name:t.name, old:oldFee, new:newFee, heat:t.heat});
      log("💼 "+t.name+" (heat "+t.heat+") demands renegotiation — fee "+fmtM(oldFee)+" → "+fmtM(newFee)+".","gold");
    }
  });
  return renegotiations;
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
        items.push({label:"\""+p.title+"\" burn", amt:-burn});
        if(p.phase==="shoot"){ const loc=DATA.LOCATIONS.find(l=>l.id===(p.location||"home")); items.push({label:"rebate", amt:burn*(loc?loc.rebate:0.08)}); }
      }
      if(p.phase==="ready" && p.releaseWeek && Math.abs(p.releaseWeek-w)<=1){
        items.push({label:"\""+p.title+"\" P&A", amt:-(p.marketing-(p.marketingPaid||0))});
        items.push({label:"\""+p.title+"\" opening rentals", amt:expectedOpening(p,w)*0.53});
      }
    }
    for(const s of G.series){ if(s.phase==="shoot") items.push({label:"\""+s.title+"\" burn", amt:-s.budget/(s.weeksLeft0||s.weeksLeft||1)}); }
    liveRuns.forEach(r=>{
      if(r.next>=0.4){ items.push({label:"\""+r.f.title+"\" rentals", amt:r.next*0.53}); r.next*=r.f.decay; }
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
  log("💥 Crossover event greenlit-ready: \""+idea.title+"\" (+45% buzz tentpole) is in Develop.","gold");
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
  log("📀 \""+fr.name+" "+pick(DATA.SPINOFF_SUFFIX)+"\" went straight to video (−"+fmtM(cost)+", +"+fmtM(rev)+" sales, brand heat up).","good");
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
  f.campaignSpend = Math.round(((f.campaignSpend||0)+amt)*10)/10;
  f.fyc=true;
  log("🗳 FYC campaign on \""+f.title+"\" upgraded by "+fmtM(amt)+" — awards momentum +"+fresh+".","good");
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


/* ── v28: IP transfer market — rival buy-out offers for one of your franchises ── */
function franchiseOffers(fr){
  const base = Math.max(6, Math.round(((fr.ww||0)*0.07 + (fr.merch||0)*0.4 + (fr.tier||0)*3)*10)/10);
  const offs=[];
  for(let i=0;i<2;i++){
    const r=(G.rivals||[]).length? pick(G.rivals) : null;
    offs.push({ rival:r, value: Math.round(base*(0.75+rnd()*0.5)*10)/10 });
  }
  return offs.sort((a,b)=>b.value-a.value);
}
function sellFranchise(frId, offer){
  const fr=G.franchises.find(x=>x.id===frId); if(!fr || !offer) return false;
  const o=offer;
  earn("other", o.value);
  G.studio.rep=clamp(G.studio.rep-2,5,99);
  if(o.rival) o.rival.ytd=(o.rival.ytd||0);
  G.franchises=G.franchises.filter(x=>x!==fr);
  log("🤝 Sold the \""+fr.name+"\" franchise to "+(o.rival? o.rival.name : "a rival studio")+" for "+fmtM(o.value)+". The merch checks stop coming — rep takes a small hit.","gold");
  saveGame(); return true;
}
/* v28: rival-held legacy franchises occasionally hit the transfer market */
function genLegacyListing(){
  const genre=pick(Object.keys(DATA.GENRES));
  return { id:nid(), kind:"legacy", genre, title:makeTitle(genre), price:rint(22,64),
           boost:Math.round(6+rnd()*8), buzz:0.10, born:G.week };
}

function infl(){ return Math.pow(1.02, yearOf(G?G.week:1)-1); }

function interestRate(){ return 0.0018*(G.execs.cfo?0.7:1); }

function intlShareOf(f){
  let s = DATA.GENRES[f.genre].intlShare;
  s += projectAbilities(f).intl;                // v28: Global Icon travels
  /* v28: per-region star power boosts intl share — avg non-NA regional power */
  if(f.cast && f.cast.length){
    const nonNA = f.cast.reduce((s,c)=>s+effectivePower(c,"AS")+effectivePower(c,"EU")+effectivePower(c,"LA")+effectivePower(c,"AF"),0)/(f.cast.length*4);
    s += nonNA * 0.015;  // each point of regional power adds ~1.5% intl share
  }
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
  log("📚 \""+fr.name+"\" publishing arm launched — novels, comics, lore books (−$15M, +weekly).","gold");
  saveGame();
}

function libraryMove(fid){
  const s=G.streamer; if(!s) return false;
  const f=G.films.find(x=>x.id===fid);
  if(!f || f.soldTo || f.streamingOriginal || f.inTheaters || f.onOwnPlatform || f.onOwn) return false;
  f.onOwnPlatform=true; f.onOwn=true; f.soldTo=s.name;
  const bump=Math.round((0.4+f.quality.overall/120)*100)/100;
  s.subs+=bump; s.lastContent=G.week;
  log("📚 \""+f.title+"\" moved to "+s.name+" (+"+bump.toFixed(2)+"M subs).","good");
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
  log("🤝 "+rival.name+" licensed \""+fr.name+"\" — "+fmtM(upfront)+" upfront, backend if their film hits. (Your merch shelf sags while they hold the brand.)","gold");
  saveGame();
}


function maybePay1(){
  for(const f of G.films){
    if(f.pay1At && G.week>=f.pay1At && !f.pay1Done){
      f.pay1Done=true; f.pay1At=0;
      if(f.streamingOriginal) continue;
      const pay=Math.max(1, Math.round((f.ww||0)*0.06));
      earn("streaming", pay); f.profit+=pay; G.stats.totalProfit+=pay;
      log("📡 Pay-1 window: \""+f.title+"\" licensed for "+fmtM(pay)+" (6% of WW).","good");
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
  log("🌌 SHARED UNIVERSE: \""+a.name+"\" — all franchise income +15%, forever.","gold");
  saveGame();
}
/* ── franchise universes: optional overlay, franchises stand alone fine ──
   A universe links 2+ franchises without merging them. Continuity rewards
   rested, coherent brands (±5% opening); crowded slates confuse audiences. */
function foundUniverse(name, frIds){
  const frs=(frIds||[]).map(id=>frById(+id)).filter(fr=>fr);
  if(frs.length<2) return false;
  if(!frs.every(fr=>fr.tier>=2)){ log("🌌 Universes need tier-2+ franchises.","bad"); return false; }
  if(G.studio.cash<80){ log("💸 Weaving a universe costs $80M.","bad"); return false; }
  spend("studio", 80);
  G.universes=G.universes||[];
  const u={id:nid(), name:(name||frs.map(f=>f.name).join(" × ")).slice(0,40), frIds:frs.map(f=>f.id), founded:G.week};
  G.universes.push(u);
  G.studio.rep=clamp(G.studio.rep+2,5,99);
  log("🌌 Universe founded: \""+u.name+"\" — continuity will make or break it (+$80M weave).","gold");
  saveGame(); return u;
}
function uniOf(frName){
  return ((G.universes||[]).find(u=>u.frIds.some(id=>{ const fr=frById(id); return fr&&fr.name===frName; })))||null;
}
function uniStats(u){
  const frs=u.frIds.map(frById).filter(Boolean);
  const ww=frs.reduce((a,f)=>a+(f.ww||0),0);
  const fat=frs.length?frs.reduce((a,f)=>a+(f.fatigue||0),0)/frs.length:0;
  const recent=frs.reduce((a,f)=>a+(f.entries||[]).filter(e=>G.week-e.week<26).length,0);
  const continuity=clamp(Math.round(100-fat*100-Math.max(0,recent-1)*15),0,100);
  let val=0;
  try{ val=Math.round(frs.reduce((a,f)=>a+(typeof frValue==="function"?frValue(f):f.tier*15),0)*1.15); }catch(e){}
  return {frs, ww, continuity,
    fanbase:ww>=3000?"Multiversal":ww>=1200?"Saga-wide":"Cult crossover", value:val};
}
function uniMult(p){ // eventized coherence vs convoluted clutter
  if(!p||!p.franchiseName) return 1;
  const u=uniOf(p.franchiseName); if(!u) return 1;
  const c=uniStats(u).continuity;
  return c>=70?1.05:c<40?0.95:1;
}


function playChicken(p, weekAbs){
  const myW = expectedWeightOf(p);
  let moved=0;
  G.rivals.forEach(r=>{
    const f=r.slate.find(f=>f.week===weekAbs && !f.dead && !f.live);
    if(f && f.weight < myW*1.15 && chance(0.55)){
      let nw = weekAbs + (chance(.5)?1:-1)*rint(1,3);
      if(nw>G.week+1){ f.week=nw; moved++;
        log("🐔 Release-date chicken: "+r.name+" blinks — \""+f.title+"\" moves off your weekend.","good"); }
    }
  });
  return moved;
}
/* ── release calendar: per-week warnings + player date moves ──
   Read-only except moveReleaseDate. Rival response reuses playChicken. */
function weekWarnings(weekAbs, film){
  const out=[];
  try{
    const s=DATA.seasonOf(woyOf(weekAbs));
    const comps=weekendCompetitors(film||null, weekAbs).filter(c=>!c.mine);
    const heavy=comps.filter(c=>(c.scale||"")==="tentpole"||(c.weight||0)>60);
    if(comps.length>=2||heavy.length>=1) out.push({t:"HEAVY COMPETITION", cls:"red", d:comps.slice(0,2).map(c=>c.rival).join(" + ")});
    if(s.holiday&&comps.length<2) out.push({t:"HOLIDAY OPPORTUNITY", cls:"green", d:"holiday legs + corridor ×"+s.season.toFixed(2)});
    if(s.season<=0.9) out.push({t:"WEAK WINDOW", cls:"red", d:"dead corridor ×"+s.season.toFixed(2)});
    if(G.theaterCap>0&&weekAbs-G.week<G.theaterCap) out.push({t:"THEATER SHORTAGE", cls:"red", d:"caps −45% box office"});
    if(film&&film.franchiseName){
      const clash=G.projects.filter(o=>o!==film&&o.releaseWeek&&o.franchiseName===film.franchiseName&&Math.abs(o.releaseWeek-weekAbs)<26);
      if(clash.length) out.push({t:"FRANCHISE CLASH", cls:"red", d:"\""+clash[0].title+"\" eats the same fans"});
    }
    if([13,26,39,52].includes(woyOf(weekAbs))) out.push({t:"SPORTS BIDS", cls:"", d:"rights auction week — streamers distracted"});
    const expiring=(G.offers||[]).filter(o=>o.expires===weekAbs);
    if(expiring.length) out.push({t:"DEALS EXPIRE", cls:"gold", d:expiring.length+" offer(s) lapse"});
  }catch(e){}
  return out;
}
function moveReleaseDate(pid, weekAbs){
  const p=G.projects.find(x=>x.id===+pid);
  if(!p||!p.releaseWeek||!(weekAbs>G.week+1)) return false;
  const from=p.releaseWeek;
  p.releaseWeek=weekAbs;
  log("📅 \""+p.title+"\" moved "+dateLabel(from)+" → "+dateLabel(weekAbs)+".","gold");
  try{ playChicken(p, weekAbs); }catch(e){} // rivals react to the new date
  saveGame();
  return true;
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
  log("🔁 Rebooting \""+f.title+"\" — the new take is in Develop (+awareness).","gold");
  saveGame();
}

function refreshIpMarket(seed){
  G.ipMarket = (G.ipMarket||[]).filter(i=>i.born+16>G.week);
  /* v28: legacy franchise listings surface mid-run, never in the opening market */
  if(G.week>=10 && chance(0.18) && !G.ipMarket.some(i=>i.kind==="legacy")) G.ipMarket.push(genLegacyListing());
  /* v28: custom franchise integration - add custom franchises to IP market */
  if(G.custom && G.custom.franchises){
    G.custom.franchises.forEach(fr=>{
      if(!G.ipMarket.some(i=>i.id===fr.id) && chance(0.15)){
        G.ipMarket.push({ id:fr.id, kind:"legacy", genre:fr.genre, title:fr.name, 
          price:Math.round((fr.value||0)*2.5), boost:Math.round(5+(fr.value||0)*0.1), 
          buzz:0.12, born:G.week, custom:true });
      }
    });
  }
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
  log("🎟 Anniversary re-release: \""+f.title+"\" returns to theaters — "+fmtG(total)+" nostalgia gross.","gold");
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
  log("🎞 Reshoots wrapped on \""+p.title+"\" (−"+fmtM(cost)+"). Test audiences score it higher now.","good");
  saveGame();
}

function rewriteScript(pid){
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="pre" || p.rewritten) return;
  const cost=Math.max(2, Math.round(p.budget*0.05));
  if(G.studio.cash<cost){ log("💸 Can't afford the rewrite ("+fmtM(cost)+").","bad"); return; }
  spend("development", cost);
  p.rewritten=true; p.script=clamp(p.script+6,0,96); p.phaseLen.pre+=1;
  log("📝 \""+p.title+"\" gets a polish pass (−"+fmtM(cost)+", script +6, +1 week pre).","good");
  saveGame();
}

/* ── test screenings: audience-card breakdown from existing vars, no new quality model ── */
function screeningDetail(p){
  const g=DATA.GENRES[p.genre], q=p.quality;
  const castAvg=(p.cast&&p.cast.length)? p.cast.reduce((s,c)=>s+c.skill,0)/p.cast.length : 52;
  const fundClamp=clamp(p.budget/Math.max(1,neededBudget(p.genre,p.scale)),0.55,1.12);
  const r=(v)=>clamp(Math.round(v),5,99);
  /* v28.9: normalize screening metrics to consistent 0-100 scale for display */
  const baseAud = q.aud;
  const baseCrit = q.critic;
  const baseOver = q.overall;
  const rows=[
    ["Audience score", r(baseAud), baseAud>=70?"The room was on its feet.":baseAud>=55?"Polite applause, some walkouts.":"Bathroom breaks during act two."],
    ["Genre response", r(baseAud + g.aud + ((typeof trendOf==="function")? (trendOf(p.genre)-1)*30:0)), "How the genre is playing this quarter."],
    ["Pacing", r(baseOver + g.legsAdj*15), baseOver>=65?"Tight. Nobody checked a phone.":"Sags in the middle — the re-edit suite can help."],
    ["Cast", r((p.cast&&p.cast.length)? p.cast.reduce((s,c)=>s+c.skill,0)/p.cast.length : 52), (p.cast&&p.cast.length)? "The leads carry their scenes.":"No star readings taken."],
    ["Ending", r((baseOver+baseAud)/2), "The walk-out question: did the ending land?"],
    ["Visuals", r(baseOver + fundClamp*15), fundClamp<0.8?"Looks underfunded on the big screen.":"Looks like money."],
    ["Emotional pull", r(baseAud*0.6+baseOver*0.4+((g.awards||0)>1?3:0)), "Did anyone cry? (Prestige genres over-index.)"],
  ];
  let buzz=0;
  if(p.quality.overall>=75) buzz=0.06; else if(p.quality.overall>=60) buzz=0.02; else buzz=-0.03;
  if(p.cast.some(c=>(c.heat||0)>0)) buzz+=0.02;
  return {rows, buzz:Math.round(buzz*100)/100};
}
function reeditFilm(pid){ // tightened cut: cheap, small audience lift, once per film
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="ready" || p.reedited || !p.quality) return false;
  const cost=Math.max(2, Math.round(p.budget*0.03));
  if(G.studio.cash<cost){ log("💸 The re-edit costs "+fmtM(cost)+".","bad"); return false; }
  spend("post", cost); p.budget+=cost; p.reedited=true;
  p.quality.aud=clamp(p.quality.aud+rint(2,4),5,99);
  p.quality.overall=clamp(p.quality.overall+2,8,98);
  log("✂️ \""+p.title+"\" re-edited (−"+fmtM(cost)+", audience +~3). The pacing complaints quiet down.","good");
  saveGame(); return true;
}
function screeningPush(pid){ // marketing pivot off the cards: cash for buzz
  const p=G.projects.find(x=>x.id===pid);
  if(!p || p.phase!=="ready") return false;
  if(G.studio.cash<3){ log("💸 A marketing pivot costs $3M.","bad"); return false; }
  spend("marketing", 3);
  p.buzzBonus=(p.buzzBonus||0)+0.05; p.mktPivot=true;
  log("📣 \""+p.title+"\" marketing pivoted to what tested well (−$3M, +5% buzz).","gold");
  saveGame(); return true;
}
function delayRelease(pid){ // hold a dated film 3 weeks: cost, small anticipation bump
  const p=G.projects.find(x=>x.id===pid);
  if(!p || !p.releaseWeek || p.releaseWeek<=G.week) return false;
  if(G.studio.cash<1){ log("💸 Holding costs $1M.","bad"); return false; }
  spend("overhead", 1); p.releaseWeek+=3; p.delayed=true;
  p.buzzBonus=(p.buzzBonus||0)+0.02;
  log("⏳ \""+p.title+"\" delayed 3 weeks (−$1M holding, +2% anticipation).","");
  saveGame(); return true;
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
  log("🎬 \""+s.title+"\" gets a film continuation — the idea is in Develop.","gold");
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
    const winP=clamp(0.22+f.quality.critic/180+(loves?0.12:0)+(foreignEdge?DATA.FESTIVAL_FOREIGN_BONUS*1.5:0)+(f.fyc?0.1:0)+(repPerk("prestige")?0.05:0)+specBonus("prestige"), 0.15, 0.85);
    choices.push({ label:"Submit \""+f.title+"\" (−$3M, critic "+f.quality.critic+hit+", win ~"+Math.round(winP*100)+"%)", run(G){
      spend("marketing", 3); f.submittedFest=true;
      const prest = fest.prestige||1;
      if(chance(winP)){
        const prize=Math.round(rint(4,9)*prest);
        earn("other", prize);
        G.studio.rep=clamp(G.studio.rep+Math.round(3*prest),5,99);
        G.festWins.push({year:yearOf(G.week), fest:fest.name, film:f.title});
        if(f.inTheaters!==undefined && f.phase===undefined){ f.festWins=(f.festWins||[]); f.festWins.push(fest.name); f.festPrestige=(f.festPrestige||0)+Math.round(10*prest); f.campaign=(f.campaign||0)+Math.round(4*prest); }
        else { f.buzzBonus=(f.buzzBonus||0)+0.08*prest; f.campaign=(f.campaign||0)+Math.round(3*prest); }
        G.log(fest.emoji+" "+fest.name+": \""+f.title+"\" takes a prize! +"+fmtM(prize)+" purse, +rep, awards momentum.","gold");
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
        G.log(fest.emoji+" "+fest.name+": \""+f.title+"\" screened well"+(loves?" — the jury loved the fit":"")+". No prize, but +1 rep.","");
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
        log("🥤 "+L.rival+"'s \""+L.name+"\" merch royalties settle: +"+fmtM(roy)+".","good");
        continue;
      }
      if(chance(0.45+L.tier*0.06)){
        const back=rint(10,35);
        earn("empire", back);
        log("💰 "+L.rival+"\'s licensed \""+L.name+"\" film hit — your backend: "+fmtM(back)+".","gold");
      }else{
        log("🤷 "+L.rival+"\'s licensed \""+L.name+"\" film fizzled. No backend.","");
      }
    }
  }
}

function tickPoaching(){
  if(!chance(0.022*DATA.DIFFICULTIES[G.difficulty].eventRate)) return;
  const cands = G.talent.filter(t=>!t.bookedUntil && ((t.heat||0)>=2 || (t.pics||0)>=2));
  if(!cands.length) return;
  const t=pick(cands.filter(x=>!(x.contract&&x.contract.type==="exclusive"&&(x.contract.until||0)>G.week)));
  if(!t) return;
  if(G.execs.casting && chance(0.6)){ log("🎭 Your Head of Casting fended off a poaching attempt on "+t.name+".","good"); return; }
  G.talent = G.talent.filter(x=>x!==t);
  log("🕶 "+pick(G.rivals).name+" poached "+t.name+" ("+t.power+"★) with an exclusive deal.","bad");
}

function weeklyOverhead(){
  let o = G.studio.overhead + G.projects.length*0.12 + G.series.filter(s=>s.phase==="shoot").length*0.15;
  DATA.EXECS.forEach(e=>{ const ex=G.execs[e.id]; if(ex) o+=(typeof ex==="object"&&Number.isFinite(ex.salary))? ex.salary : e.salary; });
  o += hqUpkeep(); // headquarters facilities bill weekly maintenance
  if(G.btl){ ["dp","composer","vfx"].forEach(r=>{ if(G.btl[r]) o+=G.btl[r].salary; }); } // v9 crew retainers
  if(G.label && G.label.unlocked) o+=0.3; // v14 music label: A&R, studio time, sync paperwork
  if(G.gamesDiv && G.gamesDiv.unlocked) o+=0.4; // v16 game studio: engines, licenses, dev kits
  return Math.round(o*100)/100;
}
/* ── studio headquarters: departments unify existing buys + 5 buildable wings ──
   New wings only touch existing knobs (burn rates, mkt power, craft, dev cost).
   Owned flags live in G.hq (absent on old saves → treated as unowned). */
function hqDepts(){
  return [
    {id:"prod", name:"Production", icon:"🎬", items:[
      {id:"backlot", kind:"upgrade", name:"Studio Backlot", desc:"Shooting −12%.", cost:100, up:0},
      {id:"stage2", kind:"hq", name:"Production Stage II", desc:"Shoot burn −5%. Needs Backlot.", cost:120, up:0.15, req:{up:"backlot"}}]},
    {id:"mkt", name:"Marketing", icon:"📣", items:[
      {id:"marketing", kind:"upgrade", name:"Marketing Dept", desc:"+10% marketing power.", cost:60, up:0},
      {id:"cmo", kind:"exec", name:"Chief Marketing Officer", desc:"+12% hype.", cost:90, up:0}]},
    {id:"vfx", name:"VFX", icon:"✨", items:[{id:"vfx", kind:"upgrade", name:"VFX Division", desc:"Post −25%, tentpole +3.", cost:80, up:0}]},
    {id:"sound", name:"Sound", icon:"🔊", items:[{id:"sound", kind:"hq", name:"Sound Stage", desc:"Post burn −10%.", cost:60, up:0.1}]},
    {id:"anim", name:"Animation", icon:"🎨", items:[{id:"anim", kind:"hq", name:"Animation Wing", desc:"Animation/fantasy +2 quality.", cost:70, up:0.1}]},
    {id:"dist", name:"Distribution", icon:"🚚", items:[{id:"dist", kind:"hq", name:"Distribution Network", desc:"Marketing power +5%. Rep 30+.", cost:90, up:0.15, req:{rep:30}}]},
    {id:"stream", name:"Streaming", icon:"📱", items:[{id:"ottrel", kind:"upgrade", name:"Streaming Relations", desc:"OTT offers +12%.", cost:70, up:0}]},
    {id:"rnd", name:"R&D", icon:"🔬", items:[{id:"rd", kind:"hq", name:"R&D Lab", desc:"Development rights −15%.", cost:100, up:0.2}]},
  ];
}
function hqOwned(id){ return !!(G.hq&&G.hq[id]); }
function hqUpkeep(){
  let u=0;
  (hqDepts()||[]).forEach(d=>{(d.items||[]).forEach(it=>{ if(it.kind==="hq"&&hqOwned(it.id)) u+=it.up||0; });});
  return Math.round(u*100)/100;
}
function hqReqMet(it){
  if(!it.req) return true;
  if(it.req.up&&!G.upgrades[it.req.up]) return false;
  if(it.req.rep&&G.studio.rep<it.req.rep) return false;
  return true;
}
function buyHq(id){
  let def=null;
  (hqDepts()||[]).forEach(d=>{(d.items||[]).forEach(it=>{ if(it.id===id) def=it; });});
  if(!def||def.kind!=="hq"||hqOwned(id)) return false;
  if(!hqReqMet(def)){ log("🏢 "+def.name+" needs "+(def.req.up?"the "+def.req.up+" first":"rep "+def.req.rep+"+")+".","bad"); return false; }
  if(G.studio.cash<def.cost){ log("💸 "+def.name+" costs "+fmtM(def.cost)+".","bad"); return false; }
  spend("studio", def.cost);
  G.hq=G.hq||{}; G.hq[id]=true;
  log("🏢 Built: "+def.name+" (−"+fmtM(def.cost)+", +"+fmtM(def.up)+"/wk upkeep). "+def.desc,"gold");
  saveGame(); return true;
}
/* ── technology tree: pay + wait, one lab slot, chained prereqs ──
   Every tech maps to an existing knob (see the techDone guards). Research
   state lives in G.tech (absent on old saves → treated as empty). */
function techDefs(){
  return [
    {id:"digital", name:"Digital Production", icon:"💾", cost:40, weeks:4, req:null, benefit:"Post burn −10%."},
    {id:"cameras", name:"Advanced Cameras", icon:"📷", cost:60, weeks:6, req:"digital", benefit:"Tentpoles +2 craft."},
    {id:"cgi", name:"Advanced CGI", icon:"✨", cost:80, weeks:7, req:"digital", benefit:"Sci-fi/fantasy +2 craft."},
    {id:"virtual", name:"Virtual Production", icon:"🥽", cost:120, weeks:10, req:"cgi", benefit:"Shoot burn −10%."},
    {id:"sets", name:"Virtual Sets", icon:"🏗", cost:90, weeks:8, req:"virtual", benefit:"Overruns −20% likely."},
    {id:"td", name:"3D", icon:"🕶", cost:50, weeks:5, req:"cameras", benefit:"Premium/IMAX opening +3%."},
    {id:"premium", name:"Premium Formats", icon:"🍿", cost:70, weeks:6, req:"td", benefit:"Premium P&A surcharge 8%→4%."},
    {id:"anim", name:"Advanced Animation", icon:"🎨", cost:80, weeks:8, req:"digital", benefit:"Animation legs +0.1."},
    {id:"ai", name:"AI-Assisted Production", icon:"🤖", cost:150, weeks:12, req:"virtual", benefit:"Development −10%. Guilds watch you."},
  ];
}
function techDone(id){ return !!(G.tech&&G.tech.done&&G.tech.done[id]); }
function startResearch(id){
  const def=techDefs().find(t=>t.id===id); if(!def) return false;
  G.tech=G.tech||{done:{}, active:null};
  if(G.tech.done[id]||G.tech.active) return false;
  if(def.req&&!G.tech.done[def.req]) return false;
  if(G.studio.cash<def.cost){ log("💸 "+def.name+" research costs "+fmtM(def.cost)+".","bad"); return false; }
  spend("studio", def.cost);
  G.tech.active={id, left:def.weeks, total:def.weeks};   // v28.9: keep total for the % progress bar
  if(id==="ai"&&typeof unionAdjust==="function") unionAdjust(4,"AI research lab");
  log("🔬 Research started: "+def.name+" ("+def.weeks+" wks). "+def.benefit,"gold");
  saveGame(); return true;
}
function tickResearch(){
  const t=G.tech&&G.tech.active; if(!t) return;
  t.left--;
  if(t.left<=0){
    const def=techDefs().find(x=>x.id===t.id);
    G.tech.done[t.id]=G.week; G.tech.active=null;
    log("🔬 Breakthrough: "+(def?def.name:t.id)+" online. "+(def?def.benefit:""),"gold");
    if(typeof sfx==="function") sfx("good");
    saveGame();
  }
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
    log("🏰 LEGACY IP ON THE LOT: \""+title+"\" (tier-1 franchise, rested). Greenlight the sequel from Empire before the heat dies.","gold");
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
    log(pre.emoji+" "+pre.name+": \""+f.title+"\" wins! Awards momentum +"+pre.boost+" (and a "+fmtM(pre.cash)+" purse). The Golden Reels are listening.","gold");
    sfx("chime");
  }else{
    log(pre.emoji+" "+pre.name+": \""+winner.title+"\" ("+(winner.studio||"?" )+") wins the early-season prize.","");
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
  if(G.studio.cash<o.price){ log("💸 You can't cover "+fmtM(o.price)+" for \""+o.name+"\".","bad"); return false; }
  spend("studio", o.price);
  G.maOffers=G.maOffers.filter(x=>x.id!==id);
  G.maDeals=(G.maDeals||[]); G.maDeals.push({kind:o.kind, price:o.price, week:G.week, name:o.name});
  if(o.kind==="library"){
    G.maLibraries=(G.maLibraries||0)+1;
    // v7: the catalogue arrives as real, releasable media in your vault
    G.maVault=(G.maVault||[]);
    const n=rint(2,3);
    for(let i=0;i<n;i++){
      const genre=pick(Object.keys(DATA.GENRES));
      G.maVault.push({ id:nid(), title:makeTitle(genre), genre, quality:clamp(rint(44,68)+gauss()*5,25,85),
        weight:Math.round((3+rnd()*11)*10)/10, week:G.week+rint(4,16),
        opening:0, dom:0, live:false, dead:false, weeksOut:0, soldTo:null, source:"library" });
    }
    log("📚 Acquired an indie library ("+fmtM(o.price)+") — "+n+" catalog films land in your vault (Films tab), +"+(DATA.MA.library.catalogEach)+" catalog value, royalties flow weekly.","gold");
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
    log("🎞 Slate firesale: you now distribute "+taken.map(f=>"\""+f.title+"\"").join(" and ")+" — you keep the rentals, they take the credit-less writeoff.","gold");
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

/* ── v7 acquired media: re-date, license to a streamer, bulk deals, or put on your own platform ── */
/* Unified list of distributable acquired films: firesale rival slate + library vault */
function maSlateFilms(){
  const out=[];
  for(const r of G.rivals) for(const f of r.slate){
    if(f.distBy==="me" && !f.live && !f.dead) {
      if(!f.id) f.id = nid();   // v28.9: stable vault id — titles collide across rivals
      out.push({src:"rival", id:f.id, title:f.title, genre:f.genre, quality:f.quality, weight:f.opening||f.weight||6, week:f.week, ref:f});
    }
  }
  for(const f of (G.maVault||[])){
    if(!f.dead && !f.soldTo) out.push({src:"vault", id:f.id, title:f.title, genre:f.genre, quality:f.quality, weight:f.opening||f.weight, week:f.week, ref:f});
  }
  return out;
}
function maFind(src, id){
  return maSlateFilms().find(x=>x.src===src && (String(x.id)===String(id) || String(x.title)===String(id)));
}
/* streamer license bids for one acquired film — a share of its projected worldwide gross */
function maLicenseBids(f){
  const legs=clamp(1.6+(f.quality-30)*0.028+(DATA.GENRES[f.genre] ? DATA.GENRES[f.genre].legsAdj : 0),1.45,4.0);
  const open=f.opening||f.weight||6;
  const intl=clamp((DATA.GENRES[f.genre] && DATA.GENRES[f.genre].intlShare) || 0.5, 0.05, 0.92);
  const ww=open*legs/Math.max(0.05, 1-intl);  // guard div-by-zero
  const base=Math.max(2, Math.round(ww*0.42*clamp((f.quality||50)/60,0.55,1.15)));
  const plats=DATA.PLATFORMS.slice().sort(()=>rnd()-0.5).slice(0,3);
  return plats.map(p=>({platform:p.id, value:Math.max(2, Math.round(base*(p.generosity||1)*(0.9+rnd()*0.25)))}));
}
function maMove(src, id, week){
  const e=maFind(src,id); if(!e || !(week>G.week)) return false;
  e.ref.week=week;
  log("📅 \""+e.title+"\" re-dated — now opens in "+(week-G.week)+" wks.","");
  saveGame(); return true;
}
function maAcceptLicense(src, id, bidIndex){
  const e=maFind(src,id); if(!e) return false;
  const bid=maLicenseBids(e.ref)[bidIndex]; if(!bid) return false;
  earn("streaming", bid.value);
  e.ref.soldTo=DATA.platform(bid.platform).name; e.ref.soldValue=bid.value;
  if(src==="vault"){ e.ref.dead=true; } else { e.ref.distBy="ott"; }
  log("🤝 \""+e.title+"\" licensed to "+e.ref.soldTo+" for "+fmtM(bid.value)+" — no theatrical run.","gold");
  saveGame(); return true;
}
function maToOwnStreamer(src, id){
  if(!G.streamer) return false;
  const e=maFind(src,id); if(!e) return false;
  e.ref.soldTo=G.streamer.name;
  if(src==="vault"){ e.ref.dead=true; e.ref.onOwn=true; } else { e.ref.distBy="own"; }
  const subs=Math.round((0.5+(e.quality||50)/60)*10)/10;
  G.streamer.subs=Math.round((G.streamer.subs+subs)*100)/100;
  G.streamer.lastContent=G.week;
  log("▶ \""+e.title+"\" is now streaming on "+G.streamer.name+" (+"+subs+"M subs).","good");
  saveGame(); return true;
}

/* ── Acquired Library Bulk Operations (Sell Upfront, Bulk License, Rival Sale) ── */
/* v28.9: firesale counter-offer — lowball a rival; 40% chance they cave at −25% */
function maCounterRival(rivalName){
  const r=(G.rivals||[]).find(x=>x.name===rivalName); if(!r) return false;
  const films=(r.slate||[]).filter(f=>f.distBy==="me" && !f.live && !f.dead);
  if(!films.length) return false;
  const full=Math.round(maVaultValue() * 2.1 * 10) / 10;
  const countered=Math.round(full*0.75*10)/10;
  if(chance(0.4)){
    earn("licensing", countered);
    films.forEach(f=>{ f.dead=true; f.soldTo=rivalName; f.soldValue=Math.round(countered/films.length*10)/10; });
    log("🪙 "+rivalName+" took your −25% counter: the "+films.length+"-film package closes at "+fmtM(countered)+".","gold");
    saveGame(); return true;
  }
  log("🚫 "+rivalName+" rejects the counter — full price ("+fmtM(full)+") or nothing.","bad");
  saveGame(); return false;
}
function maVaultActive(){
  return (G.maVault||[]).filter(f=>!f.dead && !f.soldTo);
}
function maVaultValue(){
  const films = maVaultActive();
  if(!films.length) return 0;
  return films.reduce((sum, f)=>{
    const legs = clamp(1.6 + (f.quality-30)*0.028 + (DATA.GENRES[f.genre]?DATA.GENRES[f.genre].legsAdj:0), 1.45, 3.8);
    const estWW = (f.opening || f.weight || 6) * legs / (1 - clamp((DATA.GENRES[f.genre]&&DATA.GENRES[f.genre].intlShare)||0.5, 0.1, 0.85));
    return sum + Math.max(1.5, Math.round(estWW * 0.35 * 10) / 10);
  }, 0);
}
function maSellVaultOutright(){
  const films = maVaultActive();
  if(!films.length) return 0;
  const val = Math.round(maVaultValue() * 2.3 * 10) / 10;
  earn("licensing", val);
  films.forEach(f=>{ f.dead = true; f.soldTo = "Global Catalog Syndicate"; f.soldValue = Math.round(val / films.length * 10) / 10; });
  log("📚 Acquired Library Outright Sale: liquidated " + films.length + " catalog titles to Global Syndicate for +" + fmtM(val) + " cash.", "gold");
  saveGame();
  return val;
}
function maBulkLicense(platformId){
  const films = maVaultActive();
  if(!films.length) return 0;
  const plat = DATA.platform(platformId);
  const base = maVaultValue();
  // Bundle package bonus + platform generosity
  const val = Math.max(4, Math.round(base * 1.18 * (plat.generosity || 1.0) * 10) / 10);
  earn("streaming", val);
  films.forEach(f=>{ f.dead = true; f.soldTo = plat.name; f.soldValue = Math.round(val / films.length * 10) / 10; });
  log("📺 Bulk Streaming Package: licensed all " + films.length + " vault titles to " + plat.name + " for +" + fmtM(val) + " upfront.", "gold");
  saveGame();
  return val;
}
function maSellToRival(rivalName){
  const films = maVaultActive();
  if(!films.length) return 0;
  const val = Math.round(maVaultValue() * 2.1 * 10) / 10;
  earn("licensing", val);
  films.forEach(f=>{ f.dead = true; f.soldTo = rivalName; f.soldValue = Math.round(val / films.length * 10) / 10; });
  log("🤝 Catalog Flip: sold " + films.length + " vault films to rival " + rivalName + " for +" + fmtM(val) + ".", "gold");
  saveGame();
  return val;
}

/* library vault films open on their dated week and play like real releases with full lifetime earnings */
function tickMaVault(){
  for(const f of (G.maVault||[])){
    if(f.soldTo||f.dead) continue;
    // Vault idle decay: if held past week 52 with no date set, slight market decay
    if(!f.live && f.heldWeeks && f.heldWeeks > 52 && f.weight > 3){
      f.weight = Math.max(2.5, Math.round(f.weight * 0.99 * 10) / 10);
    }
    f.heldWeeks = (f.heldWeeks || 0) + 1;

    if(!f.live && G.week>=f.week){
      const opening=clamp((f.weight||6)*(0.8+rnd()*0.45)*DATA.seasonOf(woyOf(G.week)).season, 0.4, 220);
      f.opening=Math.round(opening*10)/10; f.dom=f.opening; f.live=true; f.weeksOut=1;
      earn("theatrical", f.opening*0.53); G.stats.totalWW+=f.opening;
      log("🎞 \""+f.title+"\" from your acquired library opened — "+fmtG(f.opening)+" dom.","");
    }else if(f.live){
      const legs=clamp(1.6+(f.quality-30)*0.028+(DATA.GENRES[f.genre]?DATA.GENRES[f.genre].legsAdj:0),1.45,4.0);
      const gross=f.opening*Math.pow(1-1/legs, f.weeksOut);
      f.weeksOut++;
      f.totalGross = (f.totalGross||0) + gross;  // track cumulative gross
      // End run if cumulative gross < 5% of opening OR single week too low OR max weeks
      if(f.totalGross < f.opening*0.05 || gross<Math.max(0.3,f.opening*0.006) || f.weeksOut>16){
        f.live=false; f.dead=true; f.completedTheatrical=true;
        const intlShare=clamp((DATA.GENRES[f.genre]&&DATA.GENRES[f.genre].intlShare)||0.5, 0.1, 0.85);
        const intlGross=(f.dom/(1-intlShare) - f.dom) * econM("intl");
        const intlRentals=Math.round(intlGross*0.53*10)/10;  // match regular films (53%)
        if(intlRentals>0){ earn("theatrical", intlRentals); }
        f.ww=Math.round((f.dom+intlGross)*10)/10;
        G.stats.totalWW+=intlGross;
        const pvod=Math.max(1, Math.round(f.ww*0.045*clamp((f.quality||50)/60, 0.6, 1.3)));
        earn("pvod", pvod);
        log("🏁 Acquired library film \""+f.title+"\" finished run: "+fmtG(f.ww)+" WW total (+"+fmtM(intlRentals)+" intl rentals, +"+fmtM(pvod)+" PVOD).","good");
        if(G.streamer){
          const bump=Math.round((0.35 + (f.quality||50)/70)*10)/10;
          G.streamer.subs=Math.round((G.streamer.subs+bump)*100)/100;
          G.streamer.lastContent=G.week;
          log("📺 \""+f.title+"\" now streaming on "+G.streamer.name+" (+"+bump+"M subs).","gold");
        }
      }else{
        earn("theatrical", gross*0.53);
        f.dom+=gross; G.stats.totalWW+=gross;
      }
    }
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

/* ── studio level progression ── */
function studioXpLevel(){
  const rep = G.studio ? G.studio.rep : 30;
  const lvls = DATA.STUDIO_XP_LEVELS || [
    {id:"indie", name:"Indie Boutique", minRep:0, maxRep:30, badge:"🌱 Indie"},
    {id:"growing", name:"Growing Label", minRep:30, maxRep:55, badge:"🌿 Growing"},
    {id:"major", name:"Major Studio", minRep:55, maxRep:75, badge:"🏛 Major"},
    {id:"global", name:"Global Conglom", minRep:75, maxRep:90, badge:"🌍 Global"},
    {id:"empire", name:"Media Empire", minRep:90, maxRep:100, badge:"👑 Empire"}
  ];
  return lvls.find(l => rep >= l.minRep && rep <= l.maxRep) || lvls[lvls.length-1];
}

/* ── active franchise fatigue healer ── */
function rebootFranchise(frId){
  const fr = frById(frId);
  if(!fr) return false;
  const cost = 25;
  if(G.studio.cash < cost){ log("💸 A brand reboot requires $25M in creative overhaul and focus testing.", "bad"); return false; }
  spend("marketing", cost);
  const before = Math.round((fr.fatigue||0)*100);
  fr.fatigue = Math.max(0, Math.round((fr.fatigue||0) * 0.45 * 100) / 100);
  fr.decay = Math.min(1.0, (fr.decay||0.5) + 0.15);
  log("🔄 Brand Reboot: "+fr.name+" received a full IP overhaul (−$25M). Fatigue dropped from "+before+"% to "+Math.round(fr.fatigue*100)+"%. Brand heat reignited!","gold");
  saveGame();
  return true;
}

/* ── comeback arc for retired talent ── */
function fundComeback(talentId){
  const t = talentById(talentId);
  if(!t) return false;
  const cost = 5;
  if(G.studio.cash < cost){ log("💸 Funding an industry comeback takes $5M in development and press packaging.", "bad"); return false; }
  spend("talent", cost);
  t.retired = false;
  t.power = Math.max(t.power, 6);
  t.heat = 2;
  t.scandal = 0;
  G.studio.rep = clamp(G.studio.rep + 1, 5, 99);
  log("🌟 Comeback Arc: Backed "+t.name+"'s grand Hollywood comeback (−$5M)! They are un-retired with 6★ star power and clear press.","gold");
  saveGame();
  return true;
}

/* ── active piracy mitigation ── */
function deployAntiPiracy(){
  const cost = 4;
  if(G.studio.cash < cost){ log("💸 Deploying the Anti-Piracy Task Force costs $4M in forensics and takedown notices.", "bad"); return false; }
  spend("other", cost);
  G.piracy = Math.max(0, Math.round(((G.piracy||0) - 18)*10)/10);
  log("🚨 Anti-Piracy Task Force deployed (−$4M) — illicit server farms seized and cam-rips scrubbed (−18% piracy).","good");
  saveGame();
  return true;
}

/* ── lot counter-intel & mole hunt ── */
function deployCounterIntel(){
  const cost = 2;
  if(G.studio.cash < cost){ log("💸 Deploying lot counter-intel costs $2M.", "bad"); return false; }
  spend("other", cost);
  G.moleActive = false;
  log("🛡️ Lot Security & Counter-Intel deployed (−$2M) — NDAs audited, rogue leaks plugged. Studio scripts are secure.","good");
  saveGame();
  return true;
}

/* ── interactive fan mail replies ── */
function replyMail(idx, isApology){
  const mail = (G.mail||[])[idx];
  if(!mail) return false;
  mail.replied = true;
  if(isApology){
    G.studio.scandal = Math.max(0, (G.studio.scandal||0) - 1);
    log("🕊️ Formal Studio Statement issued re: “"+(mail.film||mail.from)+"” — PR crisis blunted, studio scandal reduced.","good");
  } else {
    G.projects.forEach(p=>{ p.buzzBonus = (p.buzzBonus||0) + 0.005; });
    log("💌 Addressed fan letter with personal studio reply — community word-of-mouth boosted!","gold");
  }
  saveGame();
  return true;
}

/* ── touring music artist event ── */
function tourArtist(artistId){
  if(!G.label || !G.label.unlocked) return false;
  const a = (G.label.artists||[]).find(x=>x.id===artistId);
  if(!a) return false;
  const cost = 8;
  if(G.studio.cash < cost){ log("💸 Staging a world stadium tour requires $8M in stage production and advances.", "bad"); return false; }
  spend("talent", cost);
  const gross = Math.round((12 + (a.heat||1)*4 + rnd()*5)*10)/10;
  earn("music", gross);
  a.chartUntil = G.week + 8;
  G.projects.forEach(p=>{ if(p.genre==="musical"||p.genre==="concert") p.buzzBonus = (p.buzzBonus||0) + 0.06; });
  log("🎤 World Tour: "+a.name+" completed a 20-city stadium tour! Earned +"+fmtM(gross)+" gross, musical slate buzz primed.","gold");
  saveGame();
  return true;
}

/* ── guest cameo system ── */
function offerCameo(talentId){
  const t = talentById(talentId);
  if(!t || t.power < 5) return false;
  const pay = Math.round(t.power * 0.7 * 10)/10;
  earn("talent", pay);
  G.studio.rep = clamp(G.studio.rep + 1, 5, 99);
  log("🎭 Cameo Deal: "+t.name+" made a surprise weekend cameo in a rival blockbuster. Earned +"+fmtM(pay)+", studio rep +1.","gold");
  saveGame();
  return true;
}

/* ── financial ledger CSV export ── */
function exportLedgerCSV(){
  const ledger = G.ledger || [];
  if(!ledger.length){
    if(typeof toast==="function") toast("Ledger is empty — advance a few weeks first.","bad");
    return;
  }
  let csv = "Week,Year,Revenue,Expenses,Net,Theatrical,Streaming,Licensing,Merch,Production,Marketing,Talent,Overhead,Interest\n";
  ledger.forEach(row=>{
    csv += [
      row.w || 0,
      row.yr || yearOf(row.w||0),
      row.rev || 0,
      row.exp || 0,
      row.net || 0,
      row.theatrical || 0,
      row.streaming || 0,
      row.licensing || 0,
      row.merch || 0,
      row.production || 0,
      row.marketing || 0,
      row.talent || 0,
      row.overhead || 0,
      row.interest || 0
    ].join(",") + "\n";
  });
  if(typeof window!=="undefined" && window.Blob && window.document){
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `box_office_war_ledger_y${yearOf(G.week)}_w${woyOf(G.week)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if(typeof toast==="function") toast("📊 Ledger CSV exported successfully!","gold");
  }
}

/* ── save slot validation & repair ── */
function repairSaveSlots(){
  const reports = [];
  for(let i=1; i<=5; i++){
    const k = "bow_slot"+i;
    try {
      if(typeof localStorage==="undefined") continue;
      const raw = localStorage.getItem(k);
      if(!raw) continue;
      const data = JSON.parse(raw);
      let repaired = false;
      if(!data.stats){ data.stats = { totalWW:0, totalProfit:0, hits:0, flops:0 }; repaired = true; }
      if(!data.studio){ data.studio = { name:"Studio", cash:100, rep:30, debt:0 }; repaired = true; }
      if(!Array.isArray(data.films)){ data.films = []; repaired = true; }
      if(!Array.isArray(data.projects)){ data.projects = []; repaired = true; }
      if(!data.version){ data.version = 8; repaired = true; }
      if(repaired){
        localStorage.setItem(k, JSON.stringify(data));
        reports.push("Slot "+i+": Repaired missing structures.");
      } else {
        reports.push("Slot "+i+": Intact and healthy.");
      }
    } catch(e) {
      reports.push("Slot "+i+": Parse error: " + e.message);
    }
  }
  return reports;
}

/* ── game porting expansion ── */
function portGame(gameId, targetPlatformId){
  const D = G.gamesDiv;
  if(!D || !D.released) return false;
  const g = D.released.find(x => x.id === gameId);
  if(!g || g.ported) return false;
  const cost = 6;
  if(G.studio.cash < cost){ log("💸 Porting to a new platform requires $6M in optimization & QA.", "bad"); return false; }
  spend("games", cost);
  g.ported = targetPlatformId || "multi";
  const addedRev = Math.round(g.total * 0.38 * 10) / 10;
  earn("games", addedRev);
  g.earned = Math.round((g.earned + addedRev) * 10) / 10;
  log("🌐 Port Complete: “"+g.title+"” ported to "+(targetPlatformId?targetPlatformId.toUpperCase():"multi-platform")+"! Net expansion +"+fmtM(addedRev)+".","gold");
  saveGame();
  return true;
}

/* ═══════════ v18: Hedge Fund Investor ── */
function hedgeFundOffer(){
  // Random event weeks 52-104 if cash < $100M
  if(G.week < 52 || G.week > 104) return null;
  if(G.studio.cash >= 100) return null;
  if(G.hedgeCut) return null; // already have hedge fund
  if(chance(0.05)){ // 5% chance per week
    const offer = 200; // $200M
    const cut = 0.20; // 20% of all future net profits
    return {offer, cut, counterOffer:{offer:120, cut:0.12}};
  }
  return null;
}

function acceptHedgeFundOffer(counter){
  const offer = counter ? 120 : 200;
  const cut = counter ? 0.12 : 0.20;
  earn("financing", offer);
  G.hedgeCut = cut;
  log("🕴 HEDGE FUND DEAL: "+fmtM(offer)+"M for "+(cut*100)+"% of all future net profits. Permanent deduction.","gold");
  saveGame();
  return true;
}

/* ═══════════ v18: Bank Covenant Dashboard ── */
function checkBankCovenants(){
  const st = G.studio;
  const covenants = {
    debtEquity: { ratio: st.debt / Math.max(st.cash, 1), limit: 3.0, name:"Debt/Equity Ratio" },
    interestCoverage: { ratio: (st.cash + st.debt) / Math.max(st.debt * 0.0018, 1), limit: 2.0, name:"Interest Coverage" },
    minCash: { ratio: st.cash, limit: 50, name:"Minimum Cash Reserve" }
  };
  let breached = [];
  for(const [key, c] of Object.entries(covenants)){
    if(c.ratio > c.limit){
      breached.push(c);
    }
  }
  return {covenants, breached};
}

function applyCovenantBreach(){
  if(G.hedgeCut) return; // hedge fund already handles this
  spend("financing", 50);
  log("🏦 COVENANT BREACH: Bank demands immediate $50M payment. Credit line at risk.","bad");
}

/* ═══════════ v18: Revenue Sharing Deals ── */
function offerRevenueSharing(filmId){
  const film = G.projects.find(p=>p.id===filmId) || G.films.find(f=>f.id===filmId);
  if(!film) return {ok:false, err:"Film not found"};
  if(film.revenueShare) return {ok:false, err:"Already has revenue sharing deal"};
  
  const platform = pick(DATA.PLATFORMS);
  const share = 0.15 + Math.random() * 0.15; // 15-30%
  const upfront = Math.round(film.budget * share * 10)/10;
  
  film.revenueShare = {platform:platform.id, share, upfront};
  earn("streaming", upfront);
  
  log("🤝 REVENUE SHARING: Pre-sold streaming rights to "+platform.name+" for "+fmtM(upfront)+" ("+Math.round(share*100)+"%). Lose streaming rights permanently.","gold");
  saveGame();
  return {ok:true, platform:platform.id, share, upfront};
}

/* ═══════════ v18: Production Insurance ── */
function offerProductionInsurance(filmId){
  const film = G.projects.find(p=>p.id===filmId);
  if(!film) return {ok:false, err:"Project not found"};
  if(film.insured) return {ok:false, err:"Already insured"};
  
  const cost = Math.round(film.budget * 0.02 * 10)/10; // 2% of budget
  if(G.studio.cash < cost) return {ok:false, err:"Insufficient funds for insurance"};
  
  spend("production", cost);
  film.insured = true;
  film.insuranceCost = cost;
  
  log("🛡️ PRODUCTION INSURANCE: Insured \""+film.title+"\" for "+fmtM(cost)+" (2% budget). Chaos events will refund 80% of budget.","gold");
  saveGame();
  return {ok:true, cost};
}

function processInsuranceClaim(film){
  if(!film.insured) return 0;
  const refund = Math.round(film.budget * 0.8 * 10)/10;
  earn("insurance", refund);
  log("🛡️ INSURANCE CLAIM: \""+film.title+"\" chaos event covered — "+fmtM(refund)+" refunded (80% of budget).","gold");
  saveGame();
  return refund;
}

/* ═══════════ v18: NFT / Collectibles Drop ── */
function launchNFTDrop(franchiseId){
  const fr = G.franchises.find(f=>f.id===franchiseId);
  if(!fr) return {ok:false, err:"Franchise not found"};
  if(fr.nftDrop) return {ok:false, err:"NFT drop already launched for this franchise"};
  
  const revenue = 5 + Math.random() * 20; // $5-25M
  const tier = fr.tier;
  const mult = tier >= 3 ? 1.5 : tier >= 2 ? 1.2 : 1.0;
  const finalRevenue = Math.round(revenue * mult * 10)/10;
  
  // 30% chance fan backlash
  let repHit = 0;
  if(chance(0.30)){
    repHit = 5;
    G.studio.rep = clamp(G.studio.rep - repHit, 5, 99);
  }
  
  // 10% regulatory fine risk
  let fine = 0;
  if(chance(0.10)){
    fine = 10;
    spend("other", fine);
  }
  
  earn("nft", finalRevenue);
  fr.nftDrop = true;
  fr.nftRevenue = finalRevenue;
  
  let msg = "🧸 NFT DROP: "+fr.name+" collectibles launch — "+fmtM(finalRevenue)+" revenue";
  if(repHit) msg += " but fan backlash −"+repHit+" rep";
  if(fine) msg += " and $"+fine+"M regulatory fine";
  msg += ". Franchise fatigue slightly increased.";
  
  addFatigue(fr);
  
  log(msg, (repHit || fine) ? "bad" : "gold");
  saveGame();
  return {ok:true, revenue:finalRevenue, repHit, fine};
}

/* ═══════════ v18: Press Junket Wars ── */
function triggerPressJunket(){
  // Two films same weekend
  const myFilms = G.films.filter(f=>f.releaseWeek===G.week && f.inTheaters);
  const rivalFilms = G.rivals.flatMap(r=>r.slate.filter(f=>f.releaseWeek===G.week && f.live));
  
  if(myFilms.length > 0 && rivalFilms.length > 0){
    // Junket War modal fires
    return {myFilms, rivalFilms};
  }
  return null;
}

function resolvePressJunket(myDays, rivalDays){
  // Both studios bid $2M/day press slots (0-2 days each)
  const myCost = myDays * 2;
  const rivalCost = rivalDays * 2;
  
  spend("marketing", myCost);
  
  // Winner gets +5% critic score
  let winner = "rival";
  if(myDays > rivalDays) winner = "player";
  else if(myDays === rivalDays) winner = chance(0.5) ? "player" : "rival";
  
  if(winner === "player"){
    for(const f of myFilms){
      if(f.quality) f.quality.critic = Math.min(99, f.quality.critic + 5);
    }
    log("📰 JUNKET WAR WON: You out-spent the rival ("+myDays+" vs "+rivalDays+" days) — +5% critic score for your films!","gold");
  }else{
    log("📰 JUNKET WAR LOST: Rival out-spent you ("+rivalDays+" vs "+myDays+" days) — their films get the press boost.","bad");
  }
  saveGame();
  return {winner, myCost, rivalCost};
}

/* ═══════════ v19: Streamer Bundle Deals ── */
function offerStreamerBundle(){
  if(!G.streamer) return null;
  if(G.streamer.bundleDeal) return null;
  if(chance(0.03)){ // 3% chance per week
    const platform = pick(DATA.PLATFORMS.filter(p=>p.id!==(G.streamer.platform||"streamflix")));
    const subBoost = 0.08 + Math.random() * 0.07; // 8-15%
    const revenueShare = 0.25;
    const duration = 12; // weeks
    
    return {platform:platform.id, subBoost, revenueShare, duration};
  }
  return null;
}

function acceptStreamerBundle(bundle){
  G.streamer.bundleDeal = bundle;
  G.streamer.bundleWeeksLeft = bundle.duration;
  const boost = Math.round(G.streamer.subs * bundle.subBoost * 100)/100;
  G.streamer.subs = Math.round((G.streamer.subs + boost) * 100)/100;
  log("📦 BUNDLE DEAL: Partnered with "+DATA.platform(bundle.platform).name+" — +"+boost+"M subs, share "+(bundle.revenueShare*100)+"% revenue for "+bundle.duration+" weeks.","gold");
  saveGame();
  return true;
}

/* ═══════════ v19: Churn Heatmap ── */
function getChurnHeatmap(){
  if(!G.streamer || G.streamer.subs < 5) return null;
  
  const genres = Object.keys(DATA.GENRES);
  const heatmap = {};
  
  for(const genre of genres){
    const films = G.films.filter(f=>f.genre===genre && f.soldTo);
    if(films.length === 0) continue;
    
    // Estimate churn based on film performance
    let churn = 0;
    for(const f of films){
      if(f.quality && f.quality.aud < 50) churn += 0.02;
      if(f.quality && f.quality.critic < 50) churn += 0.01;
    }
    churn = Math.min(0.5, churn);
    heatmap[genre] = churn;
  }
  
  return heatmap;
}

/* ═══════════ v19: Password Sharing Crackdown ── */
function crackdownPasswordSharing(){
  if(!G.streamer || G.streamer.crackdown > 0) return {ok:false};
  
  const cost = 20;
  if(G.studio.cash < cost) return {ok:false, err:"Insufficient funds"};
  
  spend("marketing", cost);
  const boost = Math.round(G.streamer.subs * 0.20 * 100)/100; // 15-25%
  G.streamer.subs = Math.round((G.streamer.subs + boost) * 100)/100;
  G.streamer.crackdown = 8; // weeks
  
  G.studio.rep = clamp(G.studio.rep - 8, 5, 99);
  
  log("🔐 PASSWORD CRACKDOWN: +"+boost+"M paid subs over 8 weeks. Side effects: −8 rep, +20% churn week 1, negative trending hashtag.","gold");
  saveGame();
  return {ok:true, boost, crackdownWeeks:8};
}

/* ═══════════ v19: Live Events Streaming ── */
function licenseLiveEvent(eventType){
  if(!G.streamer) return {ok:false, err:"No streamer"};
  
  const events = {
    awardshow: {fee:25, ppv:9.99, viewPct:0.15, subBoost:0.03, desc:"Award Show"},
    concert: {fee:40, ppv:14.99, viewPct:0.25, subBoost:0.05, desc:"Concert"},
    boxing: {fee:60, ppv:49.99, viewPct:0.30, subBoost:0.04, desc:"Boxing Match"}
  };
  
  const event = events[eventType];
  if(!event) return {ok:false};
  
  if(G.studio.cash < event.fee) return {ok:false, err:"Insufficient funds"};
  
  spend("licensing", event.fee);
  const viewers = Math.round(G.streamer.subs * event.viewPct * 100)/100;
  const ppvRevenue = Math.round(viewers * event.ppv * 100)/100;
  const subBoost = Math.round(G.streamer.subs * event.subBoost * 100)/100;
  
  G.streamer.subs = Math.round((G.streamer.subs + subBoost) * 100)/100;
  earn("streaming", ppvRevenue);
  
  log("🎪 LIVE EVENT: "+event.desc+" — "+fmtM(ppvRevenue)+" PPV revenue, +"+subBoost+"M subs for 4 weeks.","gold");
  saveGame();
  return {ok:true, ppvRevenue, subBoost};
}

/* ═══════════ v19: Regional Language Content ── */
function commissionRegionalOriginal(region){
  const regions = {
    hindi: {budget:15, genre:"musical", boost:0.08, territory:"india"},
    korean: {budget:20, genre:"drama", boost:0.10, territory:"korea"},
    spanish: {budget:18, genre:"romance", boost:0.07, territory:"latam"},
    french: {budget:12, genre:"drama", boost:0.06, territory:"france"},
    japanese: {budget:25, genre:"animation", boost:0.12, territory:"japan"}
  };
  
  const config = regions[region];
  if(!config) return {ok:false};
  if(!G.streamer) return {ok:false, err:"No streamer"};
  if(G.studio.cash < config.budget) return {ok:false, err:"Insufficient funds"};
  
  spend("production", config.budget);
  
  // Create a streaming original
  const s = {
    id:nid(), title:"Regional Original: "+region, genre:config.genre,
    budget:config.budget, platform:"own", phase:"pre",
    weeksLeft:10, weeksLeft0:10, eps:8, perEp:config.budget/8,
    seasonNum:1, status:"regional", targetRegion:config.territory
  };
  G.series.push(s);
  
  // Boost international subs
  const boost = Math.round(G.streamer.subs * config.boost * 100)/100;
  G.streamer.subs = Math.round((G.streamer.subs + boost) * 100)/100;
  
  log("🌍 REGIONAL ORIGINAL: Commissioned "+region+" content — "+fmtM(config.budget)+"M budget, +"+boost+"M intl subs, boosts "+config.territory+" box office.","gold");
  saveGame();
  return {ok:true, boost};
}

/* ═══════════ v19: Piracy by Region Map ── */
function getPiracyMap(){
  const map = {};
  for(const t of DATA.TERRITORIES){
    let piracy = t.piracy || 20;
    // Adjust for active anti-piracy
    if(G.antiPiracyTerritories && G.antiPiracyTerritories.includes(t.id)){
      piracy = Math.max(5, piracy - 15);
    }
    map[t.id] = {name:t.name, piracy, lostRev:Math.round((t.share||0) * piracy * 0.1)};
  }
  return map;
}

function deployAntiPiracyRegion(territoryId){
  const cost = 8;
  if(G.studio.cash < cost) return {ok:false, err:"Insufficient funds"};
  
  spend("anti_piracy", cost);
  G.antiPiracyTerritories = G.antiPiracyTerritories || [];
  if(!G.antiPiracyTerritories.includes(territoryId)){
    G.antiPiracyTerritories.push(territoryId);
  }
  
  log("🛡️ ANTI-PIRACY: Deployed in "+DATA.territory(territoryId).name+" for 26 weeks (−$8M). Piracy reduced by ~15%.","gold");
  saveGame();
  return {ok:true};
}

/* ═══════════ PROTOTYPE RPG CHARACTER SYSTEM ── */

/* Initialize prototype data for a talent */
function initPrototypeTalent(talent){
  if(!talent.prototype) talent.prototype = {};
  const p = talent.prototype;
  if(!p.alignment) p.alignment = pick(DATA.PROTOTYPE_ALIGNMENT_OPTIONS);
  if(!p.moral) p.moral = pick(["kind","neutral","ruthless"]);
  if(!p.attributes) p.attributes = {...DATA.PROTOTYPE_ATTRIBUTE_DEFAULTS};
  if(!p.level) p.level = 1;
  if(!p.xp) p.xp = 0;
  if(!p.xpToNext) p.xpToNext = DATA.PROTOTYPE_BASE_XP;
  if(!p.skillPoints) p.skillPoints = 0;
  if(!p.equipment) p.equipment = { weapon: null, armor: null, accessory: null, prop: null };
  else { if(!("accessory" in p.equipment)) p.equipment.accessory = null; if(!("prop" in p.equipment)) p.equipment.prop = null; }
  if(!p.events) p.events = [];
  if(!p.skillTree) p.skillTree = { branch: null, nodes: [] };
  if(!p.milestones) p.milestones = [];
  if(!p.history) p.history = []; // Persistent history across saves
  if(!p.fame) p.fame = 0;
  if(!p.infamy) p.infamy = 0;
  if(!p.industryRespect) p.industryRespect = 0;
  if(!p.traits) p.traits = [];
  if(!p.quirks) p.quirks = [];
  if(!p.relationships) p.relationships = {};   // talentId → {type:"friend"|"rival"|"mentor"|"mentee", strength}
  if(p.mentor === undefined) p.mentor = null;  // talentId of mentor
  if(!p.guild) p.guild = null;                 // guild id
  if(!p.spWeeks) p.spWeeks = 0;                // weeks toward guild SP
  if(!p.bonuses) p.bonuses = {};               // aggregated skill-node production bonuses
  // legacy migration: old branch stored the NAME; map to new branch id
  if(p.skillTree.branch && !String(p.skillTree.branch).match(/^[a-z_]+$/)){
    const kind = talent.kind || "actor";
    const tree = (DATA.PROTOTYPE_SKILL_TREES[kind]||{}).branches||[];
    const byName = tree.find(b=>b.name===p.skillTree.branch);
    p.skillTree.branch = byName ? byName.id : (tree[0]?tree[0].id:null);
  }
}

/* Initialize prototype data for all talents */
function initPrototypeSystem(){
  if(!G.prototypeData) G.prototypeData = { version: 1 };
  if(!G.talent) return;
  G.talent.forEach(initPrototypeTalent);
}

/* ── v28: Custom Creator ── */
function createCustomStudio(name, desc){
  if(!G.custom) G.custom = { studios:[], people:[], franchises:[] };
  const s = DATA.customStudio(name, desc);
  G.custom.studios.push(s);
  /* v28 polish: custom studios enter the M&A deal book as rival acquisition targets */
  const rival = (G.rivals||[]).find(r=>r.name===name);
  if(!rival && G.rivals && G.rivals.length){
    // add to a random rival's slate as a co-production target
    const r = pick(G.rivals);
    r.slate.push({title: name+" Co-Production", genre: pick(Object.keys(DATA.GENRES)), scale:"mid", week: G.week+rint(20,50), live:false, dead:false, custom:true});
    log("🤝 "+r.name+" wants to co-produce with "+name+" — watch Films tab.","");
  }
  log("🏛 Custom studio created: "+name,"gold");
  saveGame();
  return s;
}
function createCustomPerson(name, kind, desc){
  if(!G.custom) G.custom = { studios:[], people:[], franchises:[] };
  const p = DATA.customPerson(name, kind, desc);
  G.custom.people.push(p);
  /* v28 polish: custom people join the real talent pool */
  const kindDefs = { actor:{skill:rint(55,80), feeBase:2}, director:{skill:rint(60,85), feeBase:3}, writer:{skill:rint(55,80), feeBase:1.5}, producer:{skill:rint(55,80), feeBase:2} };
  const kd = kindDefs[kind] || kindDefs.actor;
  const power = rint(2,4);
  const newTalent = {
    id: nid(), kind, name,
    power, skill: kd.skill,
    agency: (DATA.AGENCIES? pick(DATA.AGENCIES).id : null),
    fee: Math.round(kd.feeBase * power * 10)/10,
    bookedUntil:0, heat:1, genreFit: pick(Object.keys(DATA.GENRES)),
    age: rint(26,45), scandal:0, pics:0, joinedYear: yearOf(G.week),
    custom:true, customDesc: desc,
    powerByRegion: {NA:power, EU:power, AS:power, LA:power, AF:power},
    ability: genAbilityFor(kind, power), abilityKnown: false
  };
  G.talent.push(newTalent);
  initPrototypeTalent(newTalent);
  log("👤 "+name+" joins the talent pool ("+kind+", "+power+"★) — see Develop → Talent.","gold");
  saveGame();
  return p;
}
function createCustomFranchise(name, genre, desc){
  if(!G.custom) G.custom = { studios:[], people:[], franchises:[] };
  const f = DATA.customFranchise(name, genre, desc);
  G.custom.franchises.push(f);
  /* v28 polish: custom franchises surface in the IP market as a buyable listing */
  if(!G.ipMarket.some(i=>i.kind==="custom")){
    G.ipMarket.push({ id:nid(), kind:"custom", genre, title:name, price:rint(15,45),
      boost:Math.round(5+rnd()*8), buzz:0.08, born:G.week });
    log("🌍 Custom franchise \""+name+"\" listed in the IP Market.","gold");
  }
  saveGame();
  return f;
}
function getCustomPools(){
  if(!G.custom) G.custom = { studios:[], people:[], franchises:[] };
  return G.custom;
}

/* Gain XP for a talent */
function gainXP(talentId, amount, source){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return;
  initPrototypeTalent(talent);
  const p = talent.prototype;
  const oldLevel = p.level;
  const rate = 1 + (getEquipmentBonuses(talent).xpRate || 0);
  p.xp = (p.xp||0) + Math.round(amount * rate);
  
  // Check for level up
  while(p.xp >= (p.xpToNext||DATA.PROTOTYPE_BASE_XP)){
    p.xp -= (p.xpToNext||DATA.PROTOTYPE_BASE_XP);
    p.level = (p.level||1) + 1;
    p.xpToNext = Math.round(DATA.PROTOTYPE_BASE_XP * Math.pow(p.level, DATA.PROTOTYPE_XP_CURVE));
    p.skillPoints = (p.skillPoints||0) + 1;
    log("⭐ "+talent.name+" leveled up to Level "+p.level+"! (+1 Skill Point)","gold");
  }
  
  // Record in history
  p.history.push({ week: G.week, type: "xp_gain", amount: amount, source: source, level: p.level });
  
  // Apply to film/game production if active
  applyTalentStatsToProduction(talent);
  
  saveGame();
}

/* Apply talent stats to film/game production */
function applyTalentStatsToProduction(talent){
  const p = talent.prototype;
  if(!p) return;
  const attrs = p.attributes || DATA.PROTOTYPE_ATTRIBUTE_DEFAULTS;
  
  // Film production bonuses
  if(talent.kind === "actor" || talent.kind === "director" || talent.kind === "writer" || talent.kind === "producer"){
    // Charisma → marketing/hype boost
    // Intellect → script/quality boost
    // Creativity → originality/genre bonus
    // Discipline → schedule/budget adherence
    // Luck → random event modifiers
  }
}

/* Level up talent and allocate skill point */
function levelUpTalent(talentId, attributeChoice){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return {ok:false, err:"Talent not found"};
  initPrototypeTalent(talent);
  const p = talent.prototype;
  
  if(p.skillPoints <= 0) return {ok:false, err:"No skill points available"};
  if(!attributeChoice) return {ok:false, err:"No attribute chosen"};
  
  const attr = p.attributes;
  if(attr[attributeChoice] !== undefined){
    attr[attributeChoice] = Math.min(100, (attr[attributeChoice]||50) + 5);
    p.skillPoints--;
    log("📈 "+talent.name+" increased "+attributeChoice+" to "+attr[attributeChoice],"gold");
    saveGame();
    return {ok:true, attribute: attributeChoice, newValue: attr[attributeChoice]};
  }
  return {ok:false, err:"Invalid attribute"};
}

/* Skill branch helpers (3 branches per kind) */
function skillBranches(kind){
  const tree = DATA.PROTOTYPE_SKILL_TREES[kind] || {};
  return tree.branches || (tree.nodes ? [{ id:"legacy", name: tree.name||"Branch", nodes: tree.nodes }] : []);
}
function findSkillNode(kind, nodeId){
  for(const b of skillBranches(kind)){
    const n = b.nodes.find(x=>x.id===nodeId);
    if(n) return { branch: b, node: n };
  }
  return null;
}

/* Spend skill point on skill tree node */
function unlockSkillNode(talentId, nodeId){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return {ok:false, err:"Talent not found"};
  initPrototypeTalent(talent);
  const p = talent.prototype;

  const found = findSkillNode(talent.kind, nodeId);
  if(!found) return {ok:false, err:"Skill node not found"};
  const tree = found.branch, node = found.node;
  if(p.skillTree.nodes.includes(nodeId)) return {ok:false, err:"Already unlocked"};

  // Check prerequisites within the same branch
  if(node.req > 0){
    const prereqNode = tree.nodes[node.req - 1];
    if(!prereqNode || !p.skillTree.nodes.includes(prereqNode.id)){
      return {ok:false, err:"Prerequisite not met"};
    }
  }

  if(p.skillPoints < node.cost) return {ok:false, err:"Not enough skill points"};

  p.skillPoints -= node.cost;
  p.skillTree.nodes.push(nodeId);
  p.skillTree.branch = tree.id;

  // Apply node effect: attributes go straight in; production bonuses aggregate in p.bonuses
  if(node.effect){
    Object.entries(node.effect).forEach(([key,val])=>{
      if(["cha","int","cre","dis","luk"].includes(key)){
        talent.prototype.attributes[key] = (talent.prototype.attributes[key]||0) + val;
      } else {
        talent.prototype.bonuses[key] = (talent.prototype.bonuses[key]||0) + val;
      }
    });
  }

  log("✨ "+talent.name+" unlocked "+node.name+" ("+tree.name+")","gold");
  saveGame();
  return {ok:true, node: node.name};
}

/* Equip item to talent */
function equipItem(talentId, slot, itemId){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return {ok:false, err:"Talent not found"};
  initPrototypeTalent(talent);
  
  const item = DATA.PROTOTYPE_EQUIPMENT[slot]?.find(i=>i.id===itemId);
  if(!item) return {ok:false, err:"Item not found"};
  
  talent.prototype.equipment[slot] = itemId;
  log("🎒 "+talent.name+" equipped "+item.name,"gold");
  saveGame();
  return {ok:true, item: item.name};
}

/* Unequip item */
function unequipItem(talentId, slot){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return {ok:false};
  talent.prototype.equipment[slot] = null;
  log("📦 "+talent.name+" unequipped "+slot,"");
  saveGame();
  return {ok:true};
}

/* Get equipment bonuses for a talent (4 slots) — never mutates static data */
function getEquipmentBonuses(talent){
  initPrototypeTalent(talent);
  const p = talent.prototype;
  const bonuses = { quality: 0, scandalReduction: 0, xpRate: 0, attrs: { cha:0, int:0, cre:0, dis:0, luk:0 } };
  ["weapon","armor","accessory","prop"].forEach(slot=>{
    const id = p.equipment[slot];
    if(!id) return;
    const item = (DATA.PROTOTYPE_EQUIPMENT[slot]||[]).find(i=>i.id===id);
    if(!item) return;
    bonuses.quality += item.quality || 0;
    bonuses.scandalReduction += item.scandalReduction || 0;
    bonuses.xpRate += item.xpRate || 0;
    ["cha","int","cre","dis","luk"].forEach(k=>{ bonuses.attrs[k] += item[k] || 0; });
  });
  return bonuses;
}

/* Effective attributes = base + skill nodes (already merged into p.attributes) + gear */
function effectiveAttributes(talent){
  initPrototypeTalent(talent);
  const eq = getEquipmentBonuses(talent);
  const out = {};
  ["cha","int","cre","dis","luk"].forEach(k=>{ out[k] = clamp((talent.prototype.attributes[k]||50) + eq.attrs[k], 1, 100); });
  return out;
}

/* Trigger life event for a talent */
function triggerLifeEvent(talentId){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return;
  initPrototypeTalent(talent);

  // Roll for event (1 per week per talent max)
  const lastEvent = talent.prototype.events[talent.prototype.events.length-1];
  if(lastEvent && lastEvent.week === G.week) return; // Already had event this week

  const selectedEvent = weightedPick(DATA.PROTOTYPE_LIFE_EVENTS);
  if(!selectedEvent) return;

  // Pick template and fill placeholders
  const moral = DATA.PROTOTYPE_MORAL_EFFECTS[talent.prototype.moral] || {};
  const others = G.talent.filter(t=>t.id!==talent.id);
  const partner = others.length ? pick(others) : null;
  const genreName = partner && partner.genreFit && DATA.GENRES[partner.genreFit] ? DATA.GENRES[partner.genreFit].name : "summer";
  const template = pick(selectedEvent.templates)
    .replace("{name}", partner ? partner.name : "a rival studio")
    .replace("{genre}", genreName);
  const effects = {...(selectedEvent.effects || {})};

  // Moral axis: ruthless talents attract more scandal; good ones shake it faster
  if(selectedEvent.type === "scandal" && moral.scandalRisk) effects.scandal = Math.round((effects.scandal||0) * (1 + moral.scandalRisk));

  // Apply effects
  const p = talent.prototype;
  if(effects.xp) gainXP(talent.id, effects.xp, "life_event");
  if(effects.rep !== undefined) G.studio.rep = clamp((G.studio.rep||0) + effects.rep, 5, 99);
  if(effects.fame) talent.prototype.fame = (talent.prototype.fame||0) + effects.fame;
  if(effects.infamy) talent.prototype.infamy = (talent.prototype.infamy||0) + effects.infamy;
  if(effects.scandal) talent.prototype.scandal = (talent.prototype.scandal||0) + effects.scandal;
  if(effects.discipline !== undefined) talent.prototype.attributes.dis = clamp((talent.prototype.attributes.dis||50) + effects.discipline, 1, 100);

  // Social events move the relationship web
  if(selectedEvent.social && partner){
    bondTalent(talent.id, partner.id, selectedEvent.social.bond, selectedEvent.social.with);
    if(selectedEvent.social.with === "mentor"){
      // a craft moment with the mentor (or a prospective one) speeds the pair up
      if(partner.prototype && partner.prototype.mentee === talent.id) gainXP(talent.id, 60, "mentor_session");
      else if(talent.prototype.level >= (partner.prototype?partner.prototype.level:0) + 3 && chance(0.15) && !partner.prototype.mentor && !talent.prototype.mentee){
        formMentorship(talent.id, partner.id);
      }
    }
  }

  // Record event
  const eventRecord = {
    week: G.week,
    type: selectedEvent.type,
    icon: selectedEvent.icon,
    desc: template,
    effects: effects
  };
  talent.prototype.events.push(eventRecord);
  if(talent.prototype.events.length > 10) talent.prototype.events.shift(); // Keep last 10

  // Log event
  log(selectedEvent.icon+" "+selectedEvent.desc+": "+template,"gold");
  saveGame();

  return eventRecord;
}

/* Tick life events for all talents */
function tickLifeEvents(){
  if(!G.talent) return;
  G.talent.forEach(t=>triggerLifeEvent(t.id));
}

/* Add milestone to talent */
function addMilestone(talentId, type, projectName){
  const talent = G.talent.find(t=>t.id===talentId);
  if(!talent) return;
  initPrototypeTalent(talent);
  
  const milestone = { type, week: G.week, project: projectName };
  talent.prototype.milestones.push(milestone);
  
  // Grant bonus XP for milestones
  const xpRewards = { first_credit: 500, first_award: 2000, breakthrough: 3000 };
  if(xpRewards[type]) gainXP(talent.id, xpRewards[type], "milestone");
  
  log("🏆 Milestone: "+type+" for "+talent.name,"gold");
  saveGame();
}

/* Game Dev division unlock (rep 40 + $250M cash, auto-checked weekly) */
function unlockGameDevLite(){
  if(G.prototypeData?.gameDevUnlocked) return {ok:false, err:"Already unlocked"};
  if(!G.prototypeData) G.prototypeData = {};
  G.prototypeData.gameDevUnlocked = true;
  G.prototypeData.gameDevUnlockedWeek = G.week;
  log("🎮 GAME DEVELOPMENT DIVISION UNLOCKED! Build your own games.","gold");
  saveGame();
  return {ok:true};
}

/* weighted pick from [{weight}, ...] */
function weightedPick(list){
  if(!list || !list.length) return null;
  const total = list.reduce((s,x)=>s+(x.weight||1),0);
  let r = Math.random() * total;
  for(const x of list){ r -= (x.weight||1); if(r <= 0) return x; }
  return list[list.length-1];
}

/* ─── Relationship web + mentorship (Phase 2) ─── */
function bondTalent(aId, bId, delta, source){
  if(!G.talent || aId===bId) return;
  const a = G.talent.find(t=>t.id===aId), b = G.talent.find(t=>t.id===bId);
  if(!a || !b || !a.prototype || !b.prototype) return;
  initPrototypeTalent(a); initPrototypeTalent(b);
  const key = String(bId), rkey = String(aId);
  const ra = a.prototype.relationships[key] || (a.prototype.relationships[key] = { type:"collaborator", strength:0 });
  const rb = b.prototype.relationships[rkey] || (b.prototype.relationships[rkey] = { type:"collaborator", strength:0 });
  ra.strength = clamp(ra.strength + delta, -10, 10);
  rb.strength = clamp(rb.strength + delta, -10, 10);
  ra.type = rb.type = ra.strength >= 5 ? "friend" : ra.strength <= -5 ? "rival" : (source || "collaborator");
}

function formMentorship(mentorId, menteeId){
  const m = G.talent.find(t=>t.id===mentorId), j = G.talent.find(t=>t.id===menteeId);
  if(!m || !j) return {ok:false, err:"Talent not found"};
  initPrototypeTalent(m); initPrototypeTalent(j);
  if((m.prototype.level||1) < (j.prototype.level||1) + 3) return {ok:false, err:"Mentor must be 3+ levels above"};
  if(m.id === j.id) return {ok:false, err:"A talent cannot mentor themselves"};
  if(m.prototype.mentee) return {ok:false, err:"Mentor already has a mentee"};
  if(j.prototype.mentor) return {ok:false, err:"Mentee already has a mentor"};
  m.prototype.mentee = j.id; j.prototype.mentor = m.id;
  bondTalent(m.id, j.id, 3, "mentor");
  addMilestone(j.id, "mentorship", "mentored by "+m.name);
  log("🧑‍🏫 "+m.name+" takes "+j.name+" under their wing — weekly XP will flow.","gold");
  saveGame();
  return {ok:true};
}

function endMentorship(talentId){
  const t = G.talent.find(x=>x.id===talentId);
  if(!t || !t.prototype) return;
  const mId = t.prototype.mentor, jId = t.prototype.mentee;
  if(mId){ const m = G.talent.find(x=>x.id===mId); if(m) m.prototype.mentee = null; t.prototype.mentor = null; }
  if(jId){ const j = G.talent.find(x=>x.id===jId); if(j) j.prototype.mentor = null; t.prototype.mentee = null; }
  saveGame();
}

function tickMentorships(){
  if(!G.talent) return;
  G.talent.forEach(t=>{
    if(!t.prototype || !t.prototype.mentor) return;
    const m = G.talent.find(x=>x.id===t.prototype.mentor);
    if(!m){ t.prototype.mentor = null; return; }
    gainXP(t.id, 40, "mentorship:"+m.name);
    gainXP(m.id, 12, "mentoring:"+t.name);
  });
}

/* ─── Influence currency (Phase 4) ─── */
function earnInfluence(n, why){
  if(!n) return;
  G.studio.influence = clamp((G.studio.influence||0) + n, 0, 999);
  if(why) log("🌐 +"+n+" influence ("+why+")","");
}
function spendInfluence(n){
  if((G.studio.influence||0) < n) return {ok:false, err:"Not enough influence ("+n+" needed)"};
  G.studio.influence -= n;
  saveGame();
  return {ok:true};
}

/* ─── Guilds (Phase 6) ─── */
function joinGuild(talentId, guildId){
  const t = G.talent.find(x=>x.id===talentId);
  const gd = (DATA.GUILDS||[]).find(g=>g.id===guildId);
  if(!t || !gd) return {ok:false, err:"Guild not found"};
  if(t.kind!=="actor" && t.kind!=="writer" && t.kind!=="director" && t.kind!=="producer") return {ok:false, err:"No guild for this craft"};
  initPrototypeTalent(t);
  if(t.prototype.guild) return {ok:false, err:"Already in a guild"};
  t.prototype.guild = gd.id;
  log("🤝 "+t.name+" joins the "+gd.name+".","gold");
  saveGame();
  return {ok:true};
}
function leaveGuild(talentId){
  const t = G.talent.find(x=>x.id===talentId);
  if(!t || !t.prototype || !t.prototype.guild) return {ok:false};
  const gd = (DATA.GUILDS||[]).find(g=>g.id===t.prototype.guild);
  t.prototype.guild = null;
  log("📄 "+t.name+" leaves the "+(gd?gd.name:"guild")+".","");
  saveGame();
  return {ok:true};
}
function tickGuilds(){
  if(!G.talent) return;
  G.talent.forEach(t=>{
    if(!t.prototype || !t.prototype.guild) return;
    const gd = (DATA.GUILDS||[]).find(g=>g.id===t.prototype.guild);
    if(!gd){ t.prototype.guild = null; return; }
    if(G.studio.cash >= gd.dues) spend("guild_dues", gd.dues);
    t.prototype.spWeeks = (t.prototype.spWeeks||0) + 1;
    if(t.prototype.spWeeks >= 10){
      t.prototype.spWeeks = 0;
      t.prototype.skillPoints = (t.prototype.skillPoints||0) + 1;
      log("🤝 Guild professional development: "+t.name+" gains 1 skill point.","");
    }
  });
}

/* ─── Streamer churn prediction (Phase 6) ─── */
function churnRisk(){
  const s = G.streamer;
  if(!s || !s.subHistory || s.subHistory.length < 4) return { level:"unknown", pct:0 };
  const recent = s.subHistory.slice(-4);
  const drop = recent[recent.length-1] - recent[0];
  const pct = recent[0] > 0 ? Math.max(0, Math.round(-drop / recent[0] * 100)) : 0;
  const level = pct >= 8 ? "high" : pct >= 3 ? "medium" : "low";
  return { level, pct };
}

/* Game Dev — GDD-driven single project (Phase 3) */
function startGameDevProject(gdd){
  if(!G.prototypeData?.gameDevUnlocked) return {ok:false, err:"Game Dev not unlocked"};
  if(G.prototypeData.currentProject) return {ok:false, err:"A project is already in development"};
  gdd = gdd || {};
  const genre = (DATA.PROTOTYPE_GAME_DEV.genres||[]).find(g=>g.id===gdd.genre) || DATA.PROTOTYPE_GAME_DEV.genres[0];
  const plat = (DATA.PROTOTYPE_GAME_DEV.platforms||[]).find(p=>p.id===gdd.platform) || DATA.PROTOTYPE_GAME_DEV.platforms[0];
  const theme = (DATA.PROTOTYPE_GAME_DEV.themes||[]).find(t=>t.id===gdd.theme);
  const mech = (DATA.PROTOTYPE_GAME_DEV.mechanics||[]).find(m=>m.id===gdd.mechanic);
  const mon = (DATA.PROTOTYPE_GAME_DEV.monetization||[]).find(m=>m.id===gdd.monetization) || DATA.PROTOTYPE_GAME_DEV.monetization[0];

  // GDD fit: theme/mechanic matching the genre lifts quality
  const themeFit = theme && theme.fit.includes(genre.id) ? theme.quality : 0;
  const mechFit = mech && mech.fit.includes(genre.id) ? mech.quality : 0;

  const project = {
    id: nid(),
    title: (gdd.title && String(gdd.title).slice(0,40)) || pick(["Realm Saga","Hero Chronicles","Dungeon Legends","Fate Odyssey","Crystal Quest","Ember Wanderer"]),
    genre: genre.id, platform: plat.id,
    theme: theme? theme.id : null, mechanic: mech? mech.id : null,
    monetization: mon.id,
    phase: DATA.PROTOTYPE_GAME_DEV.phases[0].id,
    progress: 0,
    quality: clamp(50 + genre.quality*100 + themeFit*100 + mechFit*100 + (mon.qualityPenalty||0), 20, 100),
    budget: Math.round(50 * genre.costMult * plat.costMult),
    weekStarted: G.week,
    choices: [],
    team: Array.isArray(gdd.team)? gdd.team.slice(0,5).filter(id=>G.talent.some(t=>t.id===id)) : [],
    spent: 0
  };
  G.prototypeData.currentProject = project;
  log("🎮 Greenlit \""+project.title+"\" — "+genre.name+" on "+plat.name+" ("+mon.name+"). Pre-production begins.","gold");
  saveGame();
  return {ok:true, project};
}

function gameDevPhaseDef(phase){
  return ((DATA.PROTOTYPE_GAME_DEV||{}).phases||[]).find(ph=>ph.id===phase);
}

function gameDevChoiceOption(phase, choiceId){
  const defs = ((DATA.PROTOTYPE_GAME_DEV||{}).phaseChoices||{})[phase] || [];
  for(const def of defs){
    const opt = (def.options||[]).find(o=>o.id===choiceId);
    if(opt) return opt;
  }
  return null;
}

/* migrate an old 3-phase project into the 8-phase pipeline */
function migrateGameDevProject(){
  const pr = G.prototypeData && G.prototypeData.currentProject;
  if(!pr) return;
  const phases = DATA.PROTOTYPE_GAME_DEV.phases.map(p=>p.id);
  if(!phases.includes(pr.phase)){
    pr.phase = pr.phase === "prod" ? "prototype" : "launch"; // old pipeline mapped forward
    log("🕹 \""+(pr.title||"Project")+"\" moved to the expanded dev pipeline ("+pr.phase+").","");
  }
}

function advanceGameDevPhase(choice){
  if(!G.prototypeData?.currentProject) return {ok:false};
  const project = G.prototypeData.currentProject;
  migrateGameDevProject();
  const phases = DATA.PROTOTYPE_GAME_DEV.phases.map(p=>p.id);
  const phaseIdx = phases.indexOf(project.phase);
  if(phaseIdx < 0) return {ok:false};

  // Apply the phase choice's effects (fx: cost/quality/velocity/sales as +/- fractions)
  if(choice){
    const opt = gameDevChoiceOption(project.phase, choice);
    if(opt){
      project.choices.push({ phase: project.phase, choice, label: opt.label, week: G.week });
      const fx = opt.fx || {};
      if(fx.cost) project.budget = Math.max(5, Math.round(project.budget * (1 + fx.cost)));
      if(fx.quality) project.quality = clamp(project.quality + fx.quality*100, 20, 100);
      if(fx.velocity) project.fxVelocity = (project.fxVelocity||0) + fx.velocity;
      if(fx.sales) project.fxSales = (project.fxSales||0) + fx.sales;
    } else {
      project.choices.push({ phase: project.phase, choice, week: G.week });
    }
  }

  const nextIdx = phaseIdx + 1;
  if(nextIdx >= phases.length){
    // Gold shipped → commercial launch with monetization curve
    const mon = (DATA.PROTOTYPE_GAME_DEV.monetization||[]).find(m=>m.id===project.monetization) || DATA.PROTOTYPE_GAME_DEV.monetization[0];
    const plat = (DATA.PROTOTYPE_GAME_DEV.platforms||[]).find(p=>p.id===project.platform) || DATA.PROTOTYPE_GAME_DEV.platforms[0];
    const quality = Math.round(clamp(project.quality * (1 + Math.random() * 0.15), 20, 100));
    const upfront = Math.round(project.budget * (mon.upfront||0) * (0.6 + quality/150));
    if(upfront > 0) earn("game_revenue", upfront);
    const weeklyBase = Math.max(0.5, Math.round(project.budget * 0.06 * mon.mult * plat.reach * (0.5 + quality/120) * 10)/10);
    const released = {
      ...project, quality, launchedWeek: G.week, year: yearOf(G.week),
      weeklyBase, salesLeft: mon.tail, monTail: mon.tail, monSpike: mon.spike||0,
      salesTotal: upfront, liveOps: []
    };
    G.prototypeData.releasedGames = G.prototypeData.releasedGames || [];
    G.prototypeData.releasedGames.push(released);
    G.prototypeData.currentProject = null;

    log("🎮 GAME LAUNCHED: \""+project.title+"\" ("+mon.name+") — Quality: "+quality+"/100"+(upfront>0? ", "+fmtM(upfront)+" license up front":"")+", ~"+fmtM(weeklyBase)+"/wk for "+mon.tail+" wks.","gold");
    if(quality >= 80) earnInfluence(10, "acclaimed game launch");
    (project.team||[]).forEach(t=>{ if(t && t.id) addMilestone(t.id, "first_credit", project.title); });
    unlockAchv("first_game", "🎮 Game On", "Launched your first in-house game");
    saveGame();
    return {ok:true, launched:true, quality, upfront};
  }

  project.phase = phases[nextIdx];
  project.progress = 0;
  log("🎮 Phase advanced to: "+project.phase,"gold");
  saveGame();
  return {ok:true, phase: project.phase};
}

function workOnGameDev(){
  if(!G.prototypeData?.currentProject) return;
  const project = G.prototypeData.currentProject;
  migrateGameDevProject();
  const phaseDef = gameDevPhaseDef(project.phase);
  const phaseLen = (phaseDef && phaseDef.duration) || 3;

  // Weekly progress: finish the phase in its planned duration, sped up by team + choices
  const base = 100 / phaseLen;
  const teamBonus = Math.min(15, (project.team?.length||0) * 3);
  const velocity = (base + teamBonus) * (1 + (project.fxVelocity||0));
  project.progress = Math.min(100, project.progress + velocity);

  // Burn a slice of the budget each week, scaled by this phase's cost weight
  const costWeight = (phaseDef && phaseDef.costMult) || 0.1;
  const weeklyCost = Math.max(1, Math.round(project.budget * costWeight));
  if(G.studio.cash < weeklyCost){
    project.overBudget = (project.overBudget||0) + weeklyCost;
  } else {
    spend("production", weeklyCost);
    project.spent = (project.spent||0) + weeklyCost;
  }

  // Quality drifts through production phases
  if(["prototype","vertical","alpha","beta","content"].includes(project.phase)){
    project.quality = clamp(project.quality + (Math.random()-0.35)*5, 20, 100);
  }

  saveGame();
}

/* Live ops + weekly sales + annual game awards (Phase 3/6) */
function tickInHouseGames(){
  const PD = G.prototypeData;
  if(!PD || !PD.releasedGames || !PD.releasedGames.length) return;
  PD.releasedGames.forEach(g=>{
    if(!g.salesLeft || g.salesLeft <= 0) return;
    // Live-ops event roll (weekly, ~22% chance while the tail runs)
    if(chance(0.22)){
      const ev = weightedPick(DATA.PROTOTYPE_GAME_DEV.liveOps || []);
      if(ev){
        g.liveOps = g.liveOps || [];
        g.liveOps.push({ week: G.week, id: ev.id });
        if(ev.quality) g.quality = clamp(g.quality + ev.quality, 20, 100);
        g.salesBoost = (g.salesBoost||0) + ev.sales;
        log(ev.icon+" Live ops: "+ev.label+" for \""+g.title+"\" — sales refresh +"+Math.round(ev.sales*100)+"%.","");
      }
    }
    const weekly = g.weeklyBase * (1 + (g.salesBoost||0));
    earn("game_sales", weekly);
    g.salesTotal = Math.round(((g.salesTotal||0) + weekly)*10)/10;
    g.salesLeft--;
    if(g.salesLeft <= 0) log("🕹 \""+g.title+"\" sales tail has ended — "+fmtM(g.salesTotal||0)+" total.","");
  });
  // Annual game awards (Golden Joysticks of this universe): best game of the year
  const yr = yearOf(G.week);
  if((PD.lastGameAwardYear||0) < yr - 1 || (PD.lastGameAwardYear||0) === yr - 1 && !PD.gameAwarded){
    const lastYear = (PD.releasedGames||[]).filter(g=>g.year === yr - 1);
    if(lastYear.length){
      const best = lastYear.slice().sort((a,b)=>b.quality-a.quality)[0];
      log("🏆 "+(DATA.GAME_AWARDS||"Game Awards")+": \""+best.title+"\" wins Game of the Year (quality "+best.quality+"). +5 reputation, sales refresh.","gold");
      G.studio.rep = clamp(G.studio.rep + 5, 5, 99);
      best.salesLeft = Math.max(best.salesLeft||0, 4);
      best.goty = true;
      earnInfluence(10, "game of the year");
      unlockAchv("goty", "🏆 Game of the Year", "Won Game of the Year");
      PD.gameAwarded = true;
    }
    PD.lastGameAwardYear = yr;
  }
}

/* Integration: Apply talent stats to film/game production */
function applyTalentStatsToFilm(talent, film){
  initPrototypeTalent(talent);
  const attrs = effectiveAttributes(talent);
  const p = talent.prototype;
  const equip = getEquipmentBonuses(talent);
  const bonuses = p.bonuses || {};

  // Apply to film quality
  if(film.quality){
    film.quality.overall = (film.quality.overall||50)
      + (attrs.cha - 50) * 0.2  // Charisma → hype/marketing
      + (attrs.int - 50) * 0.3  // Intellect → script/quality
      + (attrs.cre - 50) * 0.2  // Creativity → originality
      + (attrs.dis - 50) * 0.1  // Discipline → schedule
      + (attrs.luk - 50) * 0.05 // Luck → random
      + equip.quality            // Equipment bonus
      + (bonuses.criticBonus || 0) * 10 + (bonuses.genreQuality || 0) * 10; // skill nodes
    film.quality.overall = clamp(film.quality.overall, 10, 100);
  }

  // Apply to scandal resistance
  if(film.scandalResistance !== undefined){
    film.scandalResistance += equip.scandalReduction;
  }
}

/* Apply talent stats to game dev project */
function applyTalentStatsToGameDev(talent, project){
  initPrototypeTalent(talent);
  const attrs = effectiveAttributes(talent);

  // Apply to game quality
  if(project.quality !== undefined){
    project.quality = clamp(project.quality
      + (attrs.int - 50) * 0.3   // Intellect → code quality
      + (attrs.cre - 50) * 0.2   // Creativity → design
      + (attrs.dis - 50) * 0.2   // Discipline → schedule
      + (attrs.cha - 50) * 0.1   // Charisma → marketing
      + (attrs.luk - 50) * 0.05, // Luck
      20, 100);
  }
}

/* Tick prototype systems */
function tickPrototypeSystems(){
  if(!G.talent) return;

  // Initialize prototype data for all talents
  G.talent.forEach(initPrototypeTalent);

  // Tick life events
  tickLifeEvents();

  // Relationship webs + mentorship + guilds (v27)
  tickMentorships();
  tickGuilds();

  // Tick game dev
  migrateGameDevProject();
  if(G.prototypeData?.currentProject){
    workOnGameDev();
  }

  // Weekly sales tails + live ops + annual game awards (v27)
  tickInHouseGames();

  // Check game dev unlock
  if(!G.prototypeData?.gameDevUnlocked && G.studio.rep >= 40 && G.studio.cash >= 250){
    unlockGameDevLite();
  }

  // Streamer churn early warning (v27)
  const churn = churnRisk();
  if(churn.level === "high" && (!G._churnWarned || G.week - G._churnWarned > 8)){
    G._churnWarned = G.week;
    log("📉 Churn alert: your streamer is bleeding ~"+churn.pct+"% of subscribers over the last month. Fresh originals or a price action will stem it.","bad");
  }

  // Apply talent stats to active productions
  G.projects.filter(p=>p.kind==="film" && p.phase!=="done").forEach(film=>{
    if(film.director) applyTalentStatsToFilm(film.director, film);
    if(film.writer) applyTalentStatsToFilm(film.writer, film);
    if(film.producer) applyTalentStatsToFilm(film.producer, film);
    (film.cast||[]).forEach(c=>applyTalentStatsToFilm(c, film));
  });

  // Apply to game dev
  if(G.prototypeData?.currentProject){
    if(G.prototypeData.currentProject.director) applyTalentStatsToGameDev(G.prototypeData.currentProject.director, G.prototypeData.currentProject);
    if(G.prototypeData.currentProject.writer) applyTalentStatsToGameDev(G.prototypeData.currentProject.writer, G.prototypeData.currentProject);
    (G.prototypeData.currentProject.team||[]).forEach(t=>applyTalentStatsToGameDev(t, G.prototypeData.currentProject));
  }
}

/* ── v27 mod hook: window.BOW_MODS = { data:{...}, onBoot:[fn(DATA,G),...] } ── */
if(typeof window!=="undefined" && window.BOW_MODS){
  try{
    Object.assign(DATA, window.BOW_MODS.data||{});
    (window.BOW_MODS.onBoot||[]).forEach(fn=>{ try{ fn(DATA, (typeof G!=="undefined")?G:null); }catch(e){} });
  }catch(e){}
}

/* Save/Load with prototype data persistence */
function savePrototypeData(){
  if(!G.prototypeData) return;
  // History is already in talent.prototype.history
}

/* Shipped film → XP for credited talent + one-time first-credit milestone */
function grantFilmXP(film){
  if(!G.talent || !film) return;
  const q = (film.quality && typeof film.quality==="object") ? (film.quality.overall||50) : (film.quality||50);
  const xp = Math.round(300 + q*5);  // v28 balance: increased from 200+3q to 300+5q
  const crew = [film.director, film.writer, film.producer].concat(film.cast||[]).filter(Boolean);
  crew.forEach(t=>{
    if(!t || !t.id || !G.talent.some(x=>x.id===t.id)) return;
    gainXP(t.id, xp, "film:"+film.title);
    const live = G.talent.find(x=>x.id===t.id);
    if(live && !(live.prototype.milestones||[]).some(m=>m.type==="first_credit")) addMilestone(t.id, "first_credit", film.title);
  });
  // Relationship web: working together builds bonds (and occasional friction)
  for(let i=0;i<crew.length;i++) for(let j=i+1;j<crew.length;j++){
    if(crew[i] && crew[j] && crew[i].id && crew[j].id && crew[i].id!==crew[j].id){
      bondTalent(crew[i].id, crew[j].id, chance(0.8)? 2 : -2, "collaborator");
    }
  }
}

/* Award win → big XP for the winning film's credited talent */
function grantAwardXP(film){
  if(!G.talent || !film) return;
  earnInfluence(5, "award season");
  const crew = [film.director, film.writer, film.producer].concat(film.cast||[]).filter(Boolean);
  crew.forEach(t=>{
    if(!t || !t.id || !G.talent.some(x=>x.id===t.id)) return;
    gainXP(t.id, 500, "award:"+film.title);
    const live = G.talent.find(x=>x.id===t.id);
    if(live && !(live.prototype.milestones||[]).some(m=>m.type==="first_award")) addMilestone(t.id, "first_award", film.title);
  });
}

function loadPrototypeData(){
  if(!G.prototypeData) return;
  G.talent.forEach(t=>{
    if(t.prototype && t.prototype.history){
      // History already loaded
    }
  });
}

/* ─── End of Prototype RPG System ─── */
