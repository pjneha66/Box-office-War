/* ═════════════════════════════════════════════════════════════════════════
   STAGE-DIVISION.JS — Broadway, the West End and the road
   Box Office War — Modular Engine Extension (v39.1, "The Great White Way")

   The studio takes a lease on a theatre and produces live musicals: adapt a
   hit from the library or write an original book, hire a composer and a
   director/choreographer, open, and live off the weekly house. Tonys lift
   occupancy, cast albums feed the music label, national tours and staging
   licences are the parallel income.

   Design rules
   • Additive only. All state lives in G.stage and is created on first touch,
     so every existing save keeps loading with no migration step.
   • Every dollar moves through the engine's earn()/spend() under the "stage"
     category, so the Treasury desk reports it honestly.
   • One house holds one show. Houses are bought in order, and each new tier
     is a bigger room with a bigger fixed weekly cost — a flop bleeds, a hit
     pays for itself, and a Tony changes the maths.
   • The module never calls ui.js helpers at load time; every reference is
     guarded, so it also runs inside the headless smoke harness.

   Public API
     StageDivision.ensure(state)              → the G.stage record
     StageDivision.unlock(state)              → {ok, reason?}
     StageDivision.buyHouse(tier, state)      → {ok, reason?}
     StageDivision.candidates(state)          → adaptable library films
     StageDivision.stars(state)               → available leads
     StageDivision.quote(opts, state)         → {cost, reviews, low, high}
     StageDivision.greenlight(opts, state)    → {ok, show?, reason?}
     StageDivision.retool(id, state)          → {ok, reason?}
     StageDivision.launchTour(id, state)      → {ok, reason?}
     StageDivision.releaseAlbum(id, state)    → {ok, reason?}
     StageDivision.licenseShow(id, state)     → {ok, reason?}
     StageDivision.closeShow(id, state)       → {ok, reason?}
     StageDivision.cancelShow(id, state)      → {ok, reason?}
     StageDivision.tick(state)                → called from advanceWeek()
     StageDivision.summary(state)             → rollup for the UI
     StageDivision.renderPanel(state)         → HTML for the Empire desk
     StageDivision.bindEvents(doc, state)     → called from bindView()
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  "use strict";

  /* ───────────────────────────── tuning ─────────────────────────────
     Money is in $M, like the rest of the game. Gross is seats × yield ×
     occupancy; the weekly house cost is mostly fixed, which is what makes a
     half-full room lose money and a full one print it. */
  const PER_SEAT_GROSS = 0.0022;   // $M per seat per week in a full house
  const PREVIEW_OCC    = 0.28;     // previews play to a part-house
  const DECAY          = 0.004;    // occupancy lost per week after week 10
  const DECAY_AFTER    = 10;
  const LOW_OCC        = 0.30;     // six weeks under this and the show closes
  const LOW_WEEKS      = 6;
  const MAX_RUN        = 156;      // three years is a very long run
  const PREVIEW_WEEKS  = 3;
  const MAX_HISTORY    = 24;

  const VENUES = [
    { tier:1, id:"workshop", name:"The Yard Workshop", city:"Off-Broadway", seats:340,
      cost:45, rep:25, upkeep:0.10, runRate:0.0008, fixed:0.04,
      blurb:"A 340-seat black box off-Broadway. Cheap to run and cheap to fail in — the proving ground before Broadway." },
    { tier:2, id:"marquee", name:"The Marquee Theatre", city:"Broadway", seats:1000,
      cost:75, rep:40, upkeep:0.22, runRate:0.00095, fixed:0.08,
      blurb:"A 1,000-seat Broadway house under a lit marquee. Big enough for a standard book musical, and big enough to bleed." },
    { tier:3, id:"palace", name:"The Empire Palace", city:"Broadway & West End", seats:1800,
      cost:150, rep:58, upkeep:0.40, runRate:0.00105, fixed:0.08,
      blurb:"An 1,800-seat flagship with a West End transfer arrangement. Spectacle scale, spectacle risk." }
  ];

  const SCALES = [
    { id:"chamber",  name:"Chamber staging",   cost:6,  weeks:5, quality:0,  variance:5,  minVenue:1,
      blurb:"Small cast, a piano and a stool. Cheap, critic-friendly, limited upside." },
    { id:"standard", name:"Broadway standard", cost:16, weeks:7, quality:7,  variance:8,  minVenue:2,
      blurb:"Full orchestra, designed sets, a proper Broadway build." },
    { id:"spectacle",name:"Spectacle",         cost:30, weeks:9, quality:14, variance:12, minVenue:3,
      blurb:"Flying rigs, a water tank and a company of forty. The biggest swing you can take." }
  ];

  const COMPOSERS = [
    { id:"solene",  name:"Aria Solene",   fee:4,   skill:88, trait:"classical", blurb:"Conservatory-trained, awards-season royalty. Critics listen." },
    { id:"kestrel", name:"The Kestrels",  fee:3,   skill:82, trait:"classical", blurb:"Harmony trio the critics keep discovering." },
    { id:"nova",    name:"Nova Reyes",    fee:3.5, skill:78, trait:"pop",       blurb:"Arena pop with a hook in every bar. Fills seats, splits critics." },
    { id:"delta",   name:"MC Delta",      fee:2,   skill:70, trait:"pop",       blurb:"Beat-driven, radio-ready, relentlessly commercial." },
    { id:"chapel",  name:"Diesel Chapel", fee:2.5, skill:72, trait:"rock",      blurb:"Riff-heavy wall of sound. Either a triumph or a lawsuit." },
    { id:"wren",    name:"Wren",          fee:1.5, skill:64, trait:"indie",     blurb:"Bedroom-pop whisper, cheap and strange. Word of mouth does the rest." }
  ];

  const DIRECTORS = [
    { id:"brennan", name:"Hal Brennan",   fee:4,   skill:86, trait:"spectacle",  blurb:"Flying rigs and a revolve. Big, loud, expensive, unforgettable." },
    { id:"mori",    name:"Yuki Mori",     fee:3.5, skill:83, trait:"spectacle",  blurb:"Stage pictures that stop the show before anyone sings." },
    { id:"vale",    name:"Imogen Vale",   fee:3,   skill:80, trait:"intimate",   blurb:"Small gestures, long silences. Critics' favourite." },
    { id:"whitlock",name:"Dana Whitlock", fee:2,   skill:68, trait:"intimate",   blurb:"An actor's director with a taste for two-handers." },
    { id:"kask",    name:"Ronnie Kask",   fee:2.5, skill:74, trait:"commercial", blurb:"Knows exactly what a Tuesday audience wants." },
    { id:"grange",  name:"Otis Grange",   fee:1.5, skill:62, trait:"commercial", blurb:"Cheap, fast, shamelessly crowd-pleasing." }
  ];

  const ORIGINAL_TITLES = [
    "Paper Moons", "Neon Lullaby", "The Tin Palace", "Starlight & Sawdust", "Empire of Dust",
    "The Last Revue", "Sugar & Static", "Midnight at the Mirage", "Brass Hearts", "Hometown Hero",
    "The Velvet Riot", "Blue Hour", "Crown of Ashes", "Saturday's Child", "The Lighthouse Waltz"
  ];

  /* ─────────────────────────── small helpers ─────────────────────────── */
  function _clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function _rint(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
  function _round1(v){ return Math.round(v*10)/10; }
  function _round2(v){ return Math.round(v*100)/100; }
  function _M(v){
    if(typeof fmtM === "function") return fmtM(v);
    const s = v<0?"-":"", a = Math.abs(v);
    if(a>=1000) return s+"$"+(a/1000).toFixed(2)+"B";
    if(a>=100) return s+"$"+Math.round(a)+"M";
    if(a>=1) return s+"$"+a.toFixed(1)+"M";
    return s+"$"+Math.round(a*1000)+"K";
  }
  function _E(s){
    if(typeof esc === "function") return esc(s);
    return String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function _G(state){
    if(state && state.studio) return state;
    if(typeof G !== "undefined" && G) return G;
    if(global && global.G) return global.G;
    return null;
  }
  function _money(g, cat, delta){
    if(!delta || !isFinite(delta)) return;
    const amt = _round1(delta);
    if(!amt) return;
    const engine = _G();
    if(g === engine && typeof earn === "function"){ earn(cat, amt); return; }
    if(!g || !g.studio) return;
    g.studio.cash = _round1((g.studio.cash||0) + amt);
    g.weekTx = g.weekTx || {};
    g.weekTx[cat] = _round1((g.weekTx[cat]||0) + amt);
  }
  function _log(text, kind){
    if(typeof log === "function"){ log(text, kind); return; }
    const g = _G(); if(!g) return;
    g.news = g.news || [];
    g.news.unshift({ t:text, k:kind||"", w:g.week });
    if(g.news.length>140) g.news.length = 140;
    if(kind){ g.flash = g.flash || []; g.flash.push({t:text, k:kind}); }
  }
  function _rep(g, delta){
    if(!g || !g.studio) return;
    g.studio.rep = _clamp((g.studio.rep||0)+delta, 5, 99);
  }
  function _trend(genre, g){
    if(typeof trendOf === "function"){
      try{ const t = trendOf(genre); if(isFinite(t) && t>0) return t; }catch(e){}
    }
    if(g && g.trends && isFinite(g.trends[genre])) return g.trends[genre];
    return 1;
  }
  function _year(w){ return (typeof yearOf==="function") ? yearOf(w) : Math.floor((w-1)/52)+1; }
  function _woy(w){ return (typeof woyOf==="function") ? woyOf(w) : ((w-1)%52)+1; }
  function _toast(t,k){ if(typeof toast==="function") toast(t,k); }
  function _beep(k){ if(typeof beep==="function") beep(k); }
  function _render(){ if(typeof render==="function") render(); }

  function venueByTier(tier){ return VENUES.find(v => v.tier === Number(tier)) || null; }
  function scaleById(id){ return SCALES.find(s => s.id === id) || null; }
  function composerById(id){ return COMPOSERS.find(c => c.id === id) || null; }
  function directorById(id){ return DIRECTORS.find(d => d.id === id) || null; }

  /* ───────────────────────────── state ───────────────────────────── */
  function ensure(state){
    const g = _G(state);
    if(!g) return null;
    if(!g.stage || typeof g.stage !== "object" || Array.isArray(g.stage)) g.stage = {};
    const S = g.stage;
    if(!Array.isArray(S.houses))  S.houses  = [];
    if(!Array.isArray(S.shows))   S.shows   = [];
    if(!Array.isArray(S.history)) S.history = [];
    if(typeof S.unlocked !== "boolean") S.unlocked = false;
    if(typeof S.tonys !== "number") S.tonys = 0;
    if(typeof S.seq !== "number") S.seq = 0;
    if(typeof S.lastTonyYear !== "number") S.lastTonyYear = 0;
    if(typeof S.lifetimeGross !== "number") S.lifetimeGross = 0;
    if(typeof S.lifetimeNet !== "number") S.lifetimeNet = 0;
    /* Ids must never collide with shows restored from an older save. */
    if(!S.seq){
      const used = S.shows.concat(S.history).map(x => parseInt(String(x.id||"").replace(/\D/g,""),10) || 0);
      S.seq = used.length ? Math.max.apply(null, used) : 0;
    }
    return S;
  }

  function maxTier(S){
    return (S && S.houses && S.houses.length) ? Math.max.apply(null, S.houses.map(h => h.tier||0)) : 0;
  }
  function houseOf(S, sh){
    if(!sh || !sh.houseId) return null;
    return (S.houses||[]).find(h => h.id === sh.houseId) || null;
  }
  function houseName(S, sh){
    const h = houseOf(S, sh);
    const v = h ? venueByTier(h.tier) : (sh.houseTier ? venueByTier(sh.houseTier) : null);
    return v ? v.name : "the road";
  }

  /* ─────────────────────────── leasing ─────────────────────────── */
  function unlock(state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    if(S.unlocked) return { ok:false, reason:"The stage division is already open." };
    const v = VENUES[0];
    if((g.studio.rep||0) < v.rep){
      return { ok:false, reason:"The theatre owners want a reputation of "+v.rep+" (you have "+Math.round(g.studio.rep||0)+")." };
    }
    if((g.studio.cash||0) < v.cost){
      return { ok:false, reason:"Need "+_M(v.cost)+" cash for the lease and fit-out (have "+_M(g.studio.cash||0)+")." };
    }
    _money(g, "stage", -v.cost);
    S.unlocked = true;
    S.houses.push({ id:"house1", tier:1, bought:g.week });
    _log("🎭 The "+(g.studio.name||"studio")+" stage division opens at "+v.name+" ("+_M(v.cost)+"). Every Broadway empire starts in a black box.","gold");
    return { ok:true, venue:v };
  }

  function buyHouse(tier, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    if(!S.unlocked) return { ok:false, reason:"Open the stage division first." };
    const v = venueByTier(tier);
    if(!v) return { ok:false, reason:"Unknown venue tier." };
    if(S.houses.some(h => h.tier === v.tier)) return { ok:false, reason:v.name+" is already yours." };
    const prev = VENUES.find(x => x.tier === v.tier-1);
    if(prev && !S.houses.some(h => h.tier === prev.tier)){
      return { ok:false, reason:"Own "+prev.name+" before taking on "+v.name+"." };
    }
    if((g.studio.rep||0) < v.rep){
      return { ok:false, reason:"Requires reputation "+v.rep+" (you have "+Math.round(g.studio.rep||0)+")." };
    }
    if((g.studio.cash||0) < v.cost){
      return { ok:false, reason:"Need "+_M(v.cost)+" cash (have "+_M(g.studio.cash||0)+")." };
    }
    _money(g, "stage", -v.cost);
    S.houses.push({ id:"house"+v.tier, tier:v.tier, bought:g.week });
    _log("🏛 Leased "+v.name+" — "+v.seats+" seats in "+v.city+" ("+_M(v.cost)+", "+_M(v.upkeep)+"/wk upkeep).","gold");
    return { ok:true, venue:v };
  }

  /* ───────────────────────── casting a show ───────────────────────── */
  function candidates(state){
    const g = _G(state);
    if(!g) return [];
    return (g.films||[])
      .filter(f => f && !f.inTheaters && (f.ww||f.gross||0) >= 40)
      .sort((a,b) => (b.ww||b.gross||0)-(a.ww||a.gross||0))
      .slice(0, 14);
  }

  function stars(state){
    const g = _G(state);
    if(!g) return [];
    return (g.talent||[])
      .filter(t => t && t.kind === "actor" && (t.power||0) >= 3 && !t.retired &&
                   (!t.bookedUntil || t.bookedUntil <= g.week))
      .sort((a,b) => (b.power||0)-(a.power||0) || (b.skill||0)-(a.skill||0))
      .slice(0, 10);
  }

  function starFee(t){ return t ? _round1(_clamp((t.fee||4)*0.35, 1, 8)) : 0; }
  function starPower(t){ return t ? Math.round(t.power||0) : 0; }

  function sourceScoreOf(film){
    if(!film) return { score:_rint(46,72), ww:0, franchiseTier:0 };
    const overall = (film.quality && film.quality.overall != null) ? film.quality.overall : (film.critics != null ? film.critics : 60);
    const critic  = (film.quality && film.quality.critic  != null) ? film.quality.critic  : overall;
    return {
      score: _clamp(Math.round(overall*0.6 + critic*0.4), 20, 97),
      ww: film.ww || film.gross || 0,
      franchiseName: film.franchiseName || null
    };
  }

  function normalize(opts){
    opts = opts || {};
    const scale = scaleById(opts.scale) || SCALES[0];
    const composer = composerById(opts.composerId) || COMPOSERS[0];
    const director = directorById(opts.directorId) || DIRECTORS[0];
    return { scale, composer, director, sourceId: (opts.sourceId==null||opts.sourceId==="") ? "original" : String(opts.sourceId), starId: opts.starId || null };
  }

  function quote(opts, state){
    const g = _G(state);
    const o = normalize(opts);
    let film = null;
    if(o.sourceId !== "original" && g) film = (g.films||[]).find(f => String(f.id) === o.sourceId) || null;
    const star = o.starId ? (g ? (g.talent||[]).find(t => String(t.id) === String(o.starId)) : null) : null;
    const cost = _round1(o.scale.cost + o.composer.fee + o.director.fee + starFee(star));
    /* An original book has no track record to grade, so the projection sits at
       a neutral 58 and the range is wider. The room will decide on the night. */
    const src = film ? sourceScoreOf(film) : { score:58, ww:0, franchiseTier:0 };
    const extra = film ? 0 : 6;
    const comp = o.composer, dir = o.director;
    const trend = _trend("musical", g);
    const heat = _clamp((trend-0.95)*24, -5, 7);
    let q = 12 + 0.30*src.score + 0.22*comp.skill + 0.20*dir.skill + 0.14*o.scale.quality + 0.08*heat;
    if(comp.trait === "classical") q += 3;
    if(comp.trait === "indie") q += 1.5;
    if(comp.trait === "rock") q += 1.5;
    if(dir.trait === "spectacle") q += (o.scale.id === "spectacle" ? 4 : 1);
    if(dir.trait === "intimate") q += (["drama","romance","thriller"].includes(film ? film.genre : "drama") ? 4 : 1);
    if(star) q += starPower(star)*1.1;
    q = _clamp(Math.round(q), 10, 99);
    return {
      cost,
      reviews: q,
      low: _clamp(q - o.scale.variance - extra, 10, 99),
      high: _clamp(q + o.scale.variance + extra, 12, 99),
      starFee: starFee(star)
    };
  }

  function greenlight(opts, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    if(!S.unlocked) return { ok:false, reason:"Open the stage division before greenlighting a show." };
    const o = normalize(opts);
    if(o.scale.minVenue > maxTier(S)){
      const need = venueByTier(o.scale.minVenue);
      return { ok:false, reason:o.scale.name+" needs "+need.name+" — you do not own a suitable house yet." };
    }
    let film = null;
    if(o.sourceId !== "original"){
      film = (g.films||[]).find(f => String(f.id) === o.sourceId) || null;
      if(!film) return { ok:false, reason:"That title is no longer in the library." };
      if(film.inTheaters) return { ok:false, reason:"That film is still in theatres — adapt it once the run has closed." };
    }
    let star = null;
    if(o.starId){
      star = (g.talent||[]).find(t => String(t.id) === String(o.starId)) || null;
      if(!star) return { ok:false, reason:"That lead is no longer available." };
      if(star.bookedUntil && star.bookedUntil > g.week) return { ok:false, reason:star.name+" is booked on another production." };
    }
    const q = quote(o, g);
    if((g.studio.cash||0) < q.cost){
      return { ok:false, reason:"Need "+_M(q.cost)+" capitalised (have "+_M(g.studio.cash||0)+")." };
    }
    const src = film ? sourceScoreOf(film) : { score:_rint(46,72), ww:0, franchiseName:null };
    let franchiseTier = 0;
    if(film && film.franchiseName){
      const fr = (g.franchises||[]).find(x => x.name === film.franchiseName);
      if(fr) franchiseTier = fr.tier||0;
    }
    let title;
    if(film) title = film.title + (/\bmusical\b/i.test(film.title) ? " — On Stage" : " — The Musical");
    else {
      const used = (S.shows||[]).concat(S.history||[]).map(x => x.title);
      const pool = ORIGINAL_TITLES.filter(t => !used.includes(t));
      title = (pool.length ? pool[_rint(0, pool.length-1)] : "New Commission " + (S.seq+1));
    }
    S.seq++;
    const show = {
      id: "show" + S.seq,
      title,
      kind: film ? "adaptation" : "original",
      filmId: film ? film.id : null,
      sourceTitle: film ? film.title : "Original book",
      genre: film ? film.genre : ["drama","comedy","romance","fantasy","musical"][_rint(0,4)],
      sourceScore: src.score,
      sourceWW: src.ww || 0,
      sourceBonus: _clamp((src.ww||0)/6000, 0, 0.05),
      franchiseBonus: _clamp(franchiseTier*0.013, 0, 0.04),
      franchiseName: film ? (film.franchiseName||null) : null,
      scale: o.scale.id,
      composerId: o.composer.id,
      directorId: o.director.id,
      starId: star ? star.id : null,
      starName: star ? star.name : null,
      starPower: starPower(star),
      starBonus: _clamp(starPower(star)*0.012, 0, 0.06),
      starUntil: 0,
      capitalization: q.cost,
      phase: "rehearsal",
      weeksLeft: o.scale.weeks,
      houseId: null,
      houseTier: 0,
      previewOcc: 0,
      reviews: 0,
      weeksRun: 0,
      gross: 0,
      net: 0,
      lowWeeks: 0,
      retools: 0,
      occBonus: 0,
      grossMult: 1,
      tonyStatus: "",
      tonysWon: 0,
      tour: null,
      album: null,
      licensed: false,
      openedWeek: 0,
      closedWeek: 0,
      createdWeek: g.week
    };
    _money(g, "stage", -q.cost);
    S.shows.push(show);
    _log("🎭 Greenlit \""+title+"\" — "+_M(q.cost)+" capitalised, "+o.scale.weeks+" weeks of rehearsal. Projected reviews "+q.low+"–"+q.high+".","gold");
    return { ok:true, show, quote:q };
  }

  function retool(id, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    const sh = S.shows.find(x => x.id === id);
    if(!sh) return { ok:false, reason:"That show is not in development." };
    if(sh.phase !== "previews") return { ok:false, reason:"Retooling happens during previews only." };
    if((sh.retools||0) >= 2) return { ok:false, reason:"This show has already been retooled twice." };
    const cost = 2.5;
    if((g.studio.cash||0) < cost) return { ok:false, reason:"Need "+_M(cost)+" to retool (have "+_M(g.studio.cash||0)+")." };
    _money(g, "stage", -cost);
    sh.retools = (sh.retools||0) + 1;
    sh.net = _round1((sh.net||0) - cost);
    _log("🔧 \""+sh.title+"\" goes back into the rehearsal room mid-previews (−"+_M(cost)+"). The second act is tighter.","");
    return { ok:true, retools:sh.retools };
  }

  /* ─────────────────────────── the run ─────────────────────────── */
  function scoreShow(sh){
    const g = _G();
    const comp = composerById(sh.composerId) || COMPOSERS[0];
    const dir  = directorById(sh.directorId)  || DIRECTORS[0];
    const scale = scaleById(sh.scale) || SCALES[0];
    const trend = _trend("musical", g);
    const heat = _clamp((trend-0.95)*24, -5, 7);
    let q = 12 + 0.30*sh.sourceScore + 0.22*comp.skill + 0.20*dir.skill + 0.14*scale.quality + 0.08*heat;
    if(comp.trait === "classical") q += 3;
    if(comp.trait === "indie") q += 1.5;
    if(comp.trait === "rock") q += _rint(-2, 6);
    if(dir.trait === "spectacle") q += (sh.scale === "spectacle" ? 4 : 1);
    if(dir.trait === "intimate") q += (["drama","romance","thriller"].includes(sh.genre) ? 4 : 1);
    if(sh.starPower) q += sh.starPower*1.1;
    q += (sh.retools||0)*4;
    return _clamp(Math.round(q), 10, 99);
  }

  function occupancyOf(sh, g){
    const base = 0.10 + 0.85*Math.pow(_clamp(sh.reviews||0,0,100)/100, 1.5);
    let occ = base + (sh.sourceBonus||0) + (sh.franchiseBonus||0) + (sh.occBonus||0);
    if(sh.starPower && sh.starUntil && g && g.week < sh.starUntil) occ += (sh.starBonus||0);
    occ -= DECAY * Math.max(0, (sh.weeksRun||0) - DECAY_AFTER);
    return _clamp(occ, 0.12, 0.99);
  }

  function weeklyFor(sh, g){
    const v = venueByTier(sh.houseTier) || VENUES[0];
    const occ = (sh.phase === "previews") ? (sh.previewOcc || PREVIEW_OCC) : occupancyOf(sh, g);
    const gross = _round1(v.seats * PER_SEAT_GROSS * occ * (sh.grossMult||1));
    const cost = _round1(v.seats * v.runRate + v.fixed);
    return { seats:v.seats, occupancy:occ, gross, cost, net:_round1(gross - cost) };
  }

  function assignHouse(S, sh){
    const scale = scaleById(sh.scale) || SCALES[0];
    const busy = new Set((S.shows||[]).filter(x => x !== sh && (x.phase === "previews" || x.phase === "running")).map(x => x.houseId));
    const free = (S.houses||[])
      .filter(h => !busy.has(h.id) && (h.tier||0) >= scale.minVenue)
      .sort((a,b) => (b.tier||0)-(a.tier||0));
    const pick = free[0];
    if(!pick) return false;
    sh.houseId = pick.id;
    sh.houseTier = pick.tier;
    return true;
  }

  function startPreviews(g, S, sh){
    sh.phase = "previews";
    sh.weeksLeft = PREVIEW_WEEKS;
    sh.previewOcc = _clamp(PREVIEW_OCC + (sh.sourceBonus||0) + (sh.franchiseBonus||0), 0.2, 0.6);
    _log("🎟 \""+sh.title+"\" begins previews at "+houseName(S, sh)+" — "+PREVIEW_WEEKS+" weeks to fix it before the critics arrive.","good");
  }

  function openShow(g, S, sh){
    const scale = scaleById(sh.scale) || SCALES[0];
    sh.reviews = _clamp(scoreShow(sh) + _rint(-scale.variance, scale.variance), 12, 99);
    sh.phase = "running";
    sh.weeksRun = 0;
    sh.openedWeek = g.week;
    if(sh.starPower) sh.starUntil = g.week + 20;
    const r = sh.reviews;
    let verdict = "a mixed night", kind = "";
    if(r >= 85){ verdict = "a sensation"; kind = "gold"; _rep(g, 2); }
    else if(r >= 75){ verdict = "a hit with the critics"; kind = "good"; _rep(g, 1); }
    else if(r >= 55) verdict = "a polite reception";
    else if(r >= 40){ verdict = "a rough night"; kind = "bad"; }
    else { verdict = "a disaster"; kind = "bad"; _rep(g, -1); }
    _log("🌟 OPENING NIGHT: \""+sh.title+"\" opens at "+houseName(S, sh)+" to "+r+" reviews — "+verdict+".",kind);
  }

  /* ─────────────────────────── season ─────────────────────────── */
  function tonySeason(g, S){
    S.lastTonyYear = _year(g.week);
    const running = S.shows.filter(x => x.phase === "running" && (x.weeksRun||0) >= 4);
    if(!running.length) return;
    running.sort((a,b) => (b.reviews||0)-(a.reviews||0));
    let awarded = false;
    running.forEach(sh => {
      const roll = sh.reviews + _rint(-5,5) + (sh.tonysWon ? 4 : 0);
      if(!awarded && roll >= 84){
        awarded = true;
        sh.tonysWon = (sh.tonysWon||0) + 1;
        sh.tonyStatus = "winner";
        S.tonys = (S.tonys||0) + 1;
        sh.occBonus = _clamp((sh.occBonus||0) + 0.08, 0, 0.20);
        sh.grossMult = _round2((sh.grossMult||1) * 1.05);
        _rep(g, 3);
        _log("🏆 TONY WIN — \""+sh.title+"\" takes Best Musical. The house fills a little fuller for as long as it runs.","gold");
      } else if(roll >= 74){
        if(sh.tonyStatus !== "winner") sh.tonyStatus = "nominated";
        sh.occBonus = _clamp((sh.occBonus||0) + 0.03, 0, 0.20);
        _rep(g, 1);
        _log("🎗 TONY NOMINATION — \""+sh.title+"\" is up for Best Musical. The marquee gets a little brighter.","good");
      }
    });
  }

  /* ───────────────────────── parallel income ───────────────────────── */
  function launchTour(id, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    const sh = S.shows.find(x => x.id === id);
    if(!sh) return { ok:false, reason:"That show is not in the house." };
    if(sh.phase !== "running") return { ok:false, reason:"Only a running show can tour." };
    if(sh.tour) return { ok:false, reason:"A touring company is already on the road." };
    if((sh.reviews||0) < 65) return { ok:false, reason:"The reviews must reach 65 before a promoter will take the road." };
    if((sh.weeksRun||0) < 8) return { ok:false, reason:"Let the show play at least 8 weeks before touring." };
    const v = venueByTier(sh.houseTier) || VENUES[0];
    const cost = _round1(6 + v.seats/500);
    if((g.studio.cash||0) < cost) return { ok:false, reason:"Need "+_M(cost)+" to put a company on the road (have "+_M(g.studio.cash||0)+")." };
    _money(g, "stage", -cost);
    sh.tour = {
      started: g.week,
      weeksLeft: 24,
      weekly: _round2((0.6 + (sh.reviews||0)*0.005) * 0.5),
      total: 0
    };
    _log("🚌 \""+sh.title+"\" sends out a national tour — "+_M(cost)+" to mount, 24 weeks on the road.","good");
    return { ok:true, tour:sh.tour };
  }

  function releaseAlbum(id, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    const sh = S.shows.find(x => x.id === id);
    if(!sh) return { ok:false, reason:"That show is not in the house." };
    if(sh.phase !== "running") return { ok:false, reason:"A cast album needs a running show." };
    if(sh.album) return { ok:false, reason:"The cast album is already out." };
    if((sh.reviews||0) < 55) return { ok:false, reason:"Nobody wants a cast recording of a 40-review show." };
    const cost = 1.2;
    if((g.studio.cash||0) < cost) return { ok:false, reason:"Need "+_M(cost)+" to record and press the album." };
    const labelLive = !!(g.label && g.label.unlocked);
    const weekly = _round2((0.03 + (sh.reviews||0)/100*0.10) * (labelLive ? 1.6 : 1));
    _money(g, "stage", -cost);
    sh.album = { released: g.week, weeksLeft: 26, weekly, total: 0, labelBoost: labelLive };
    sh.occBonus = _clamp((sh.occBonus||0) + 0.01, 0, 0.20);
    _log("💿 The \""+sh.title+"\" cast album ships"+(labelLive ? " through your own label — full margin, no distributor cut" : "")+" — "+_M(weekly)+"/wk for 26 weeks.","good");
    return { ok:true, album:sh.album };
  }

  function licenseShow(id, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    const sh = S.shows.find(x => x.id === id);
    if(!sh) return { ok:false, reason:"That show is not in the house." };
    if(sh.phase !== "running") return { ok:false, reason:"Staging rights are licensed off a running production." };
    if(sh.licensed) return { ok:false, reason:"Those rights are already licensed." };
    if((sh.weeksRun||0) < 16) return { ok:false, reason:"Wait until the show has played 16 weeks — regional houses want a proven title." };
    const fee = _round1(3 + (sh.reviews||0)*0.09 + (sh.recouped ? 2 : 0));
    sh.licensed = true;
    _money(g, "stage", fee);
    _log("📜 Licensed \""+sh.title+"\" to regional and international houses for "+_M(fee)+" — the show stays yours, the rights travel.","gold");
    return { ok:true, fee };
  }

  function closeShow(id, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    const sh = S.shows.find(x => x.id === id);
    if(!sh) return { ok:false, reason:"That show is not in the house." };
    if(sh.phase !== "running" && sh.phase !== "previews") return { ok:false, reason:"Only a show in the house can be closed." };
    const weeks = sh.weeksRun||0;
    const profit = _round1((sh.net||0) - (sh.capitalization||0));
    sh.phase = "closed";
    sh.closedWeek = g.week;
    S.history.unshift({
      id: sh.id, title: sh.title, kind: sh.kind, genre: sh.genre, scale: sh.scale,
      reviews: sh.reviews, weeks, gross: _round1(sh.gross||0), net: _round1(sh.net||0),
      capitalization: sh.capitalization, profit, recouped: !!sh.recouped,
      tonysWon: sh.tonysWon||0, closedWeek: g.week, houseTier: sh.houseTier
    });
    if(S.history.length > MAX_HISTORY) S.history.length = MAX_HISTORY;
    S.shows = S.shows.filter(x => x !== sh);
    if(sh.recouped) _rep(g, 1);
    _log("🎭 CURTAIN: \""+sh.title+"\" closes after "+weeks+" weeks — lifetime "+(profit>=0 ? "profit " : "loss ")+_M(Math.abs(profit))+" on "+_M(sh.capitalization||0)+" capitalised."+(sh.recouped ? " It recouped." : ""), profit>=0 ? "" : "bad");
    pump(g, S);
    return { ok:true, profit };
  }

  function cancelShow(id, state){
    const g = _G(state), S = ensure(g);
    if(!g || !S) return { ok:false, reason:"No career is loaded." };
    const sh = S.shows.find(x => x.id === id);
    if(!sh) return { ok:false, reason:"That show is not in development." };
    if(sh.phase !== "rehearsal" && sh.phase !== "waiting") return { ok:false, reason:"That show has already opened — close it instead." };
    S.shows = S.shows.filter(x => x !== sh);
    _log("🗑 \""+sh.title+"\" is cancelled in rehearsal. The "+_M(sh.capitalization||0)+" already spent is gone.","bad");
    return { ok:true, sunk:sh.capitalization||0 };
  }

  function pump(g, S){
    (S.shows||[]).forEach(sh => {
      if(sh.phase === "waiting" && assignHouse(S, sh)) startPreviews(g, S, sh);
    });
  }

  /* ─────────────────────────── weekly tick ─────────────────────────── */
  function tick(state){
    const g = _G(state), S = ensure(g);
    if(!g || !S || !S.unlocked) return;

    // The lease is paid whether or not the house is lit.
    S.houses.forEach(h => {
      const v = venueByTier(h.tier);
      if(v) _money(g, "stage", -v.upkeep);
    });

    for(const sh of (S.shows||[]).slice()){
      if(sh.phase === "rehearsal"){
        sh.weeksLeft = Math.max(0, (sh.weeksLeft||0) - 1);
        if(sh.weeksLeft <= 0){
          if(assignHouse(S, sh)) startPreviews(g, S, sh);
          else sh.phase = "waiting";
        }
        continue;
      }
      if(sh.phase === "waiting"){
        if(assignHouse(S, sh)) startPreviews(g, S, sh);
        continue;
      }
      if(sh.phase === "previews"){
        const w = weeklyFor(sh, g);
        _money(g, "stage", w.net);
        sh.gross = _round1((sh.gross||0) + w.gross);
        sh.net = _round1((sh.net||0) + w.net);
        S.lifetimeGross = _round1((S.lifetimeGross||0) + w.gross);
        S.lifetimeNet = _round1((S.lifetimeNet||0) + w.net);
        sh.weeksLeft = Math.max(0, (sh.weeksLeft||0) - 1);
        if(sh.weeksLeft <= 0) openShow(g, S, sh);
        continue;
      }
      if(sh.phase !== "running") continue;

      const w = weeklyFor(sh, g);
      _money(g, "stage", w.net);
      sh.gross = _round1((sh.gross||0) + w.gross);
      sh.net = _round1((sh.net||0) + w.net);
      S.lifetimeGross = _round1((S.lifetimeGross||0) + w.gross);
      S.lifetimeNet = _round1((S.lifetimeNet||0) + w.net);
      sh.weeksRun = (sh.weeksRun||0) + 1;

      if(!sh.recouped && (sh.net||0) >= (sh.capitalization||0)){
        sh.recouped = true;
        _rep(g, 2);
        _log("💰 \""+sh.title+"\" has recouped its "+_M(sh.capitalization||0)+" capitalization. Everything from here is profit.","gold");
      }

      if(sh.tour && sh.tour.weeksLeft > 0){
        _money(g, "stage", sh.tour.weekly);
        sh.tour.total = _round1((sh.tour.total||0) + sh.tour.weekly);
        S.lifetimeNet = _round1((S.lifetimeNet||0) + sh.tour.weekly);
        sh.tour.weeksLeft--;
        if(sh.tour.weeksLeft === 0){
          _log("🚌 The \""+sh.title+"\" tour comes home after grossing "+_M(sh.tour.total||0)+" in net receipts.","good");
        }
      }
      if(sh.album && sh.album.weeksLeft > 0){
        _money(g, "stage", sh.album.weekly);
        sh.album.total = _round1((sh.album.total||0) + sh.album.weekly);
        S.lifetimeNet = _round1((S.lifetimeNet||0) + sh.album.weekly);
        sh.album.weeksLeft--;
      }

      const occ = weeklyFor(sh, g).occupancy;
      if(occ < LOW_OCC) sh.lowWeeks = (sh.lowWeeks||0) + 1;
      else sh.lowWeeks = 0;
      if(sh.lowWeeks >= LOW_WEEKS || sh.weeksRun >= MAX_RUN){
        closeShow(sh.id, g);
      }
    }

    if(_woy(g.week) === 24 && S.lastTonyYear !== _year(g.week)) tonySeason(g, S);
  }

  /* ─────────────────────────── rollups ─────────────────────────── */
  function summary(state){
    const g = _G(state), S = ensure(g);
    if(!g || !S){
      return { houses:0, running:0, developing:0, upkeep:0, weekly:0, lifetimeGross:0, lifetimeNet:0, tonys:0, capacity:0 };
    }
    let upkeep = 0, capacity = 0;
    S.houses.forEach(h => { const v = venueByTier(h.tier); if(v){ upkeep += v.upkeep; capacity += v.seats; } });
    let weekly = -upkeep;
    S.shows.forEach(sh => {
      if(sh.phase === "running" || sh.phase === "previews"){ weekly += weeklyFor(sh, g).net; }
      if(sh.phase === "running"){
        if(sh.tour && sh.tour.weeksLeft > 0) weekly += sh.tour.weekly;
        if(sh.album && sh.album.weeksLeft > 0) weekly += sh.album.weekly;
      }
    });
    return {
      houses: S.houses.length,
      capacity,
      running: S.shows.filter(s => s.phase === "running").length,
      previewing: S.shows.filter(s => s.phase === "previews").length,
      developing: S.shows.filter(s => s.phase === "rehearsal" || s.phase === "waiting").length,
      upkeep: _round1(upkeep) || 0,
      weekly: _round1(weekly) || 0,
      lifetimeGross: _round1(S.lifetimeGross||0),
      lifetimeNet: _round1(S.lifetimeNet||0),
      tonys: S.tonys||0
    };
  }

  /* ─────────────────────────── the desk ─────────────────────────── */
  function kpi(value, label){
    return "<div class='empire-meter'><div class='fm-v'>"+value+"</div><div class='fm-l'>"+label+"</div></div>";
  }

  function bar(pct, label, value){
    const p = _clamp(Math.round(pct), 0, 100);
    return "<div class='empire-progress'><div><span>"+_E(label)+"</span><b>"+_E(value)+"</b></div><i><b style='width:"+p+"%'></b></i></div>";
  }

  function reviewTag(r){
    if(r >= 85) return "<span class='tag green'>"+r+" · Sensation</span>";
    if(r >= 75) return "<span class='tag green'>"+r+" · Hit</span>";
    if(r >= 60) return "<span class='tag gold'>"+r+" · Solid</span>";
    if(r >= 45) return "<span class='tag'>"+r+" · Mixed</span>";
    return "<span class='tag red'>"+r+" · Panned</span>";
  }

  function showCard(sh, g, S){
    const v = venueByTier(sh.houseTier) || VENUES[0];
    const scale = scaleById(sh.scale) || SCALES[0];
    const w = weeklyFor(sh, g);
    const occPct = Math.round(w.occupancy*100);
    const recoupPct = sh.capitalization ? Math.min(100, Math.round((sh.net||0)/sh.capitalization*100)) : 0;
    const comp = composerById(sh.composerId) || COMPOSERS[0];
    const dir = directorById(sh.directorId) || DIRECTORS[0];
    const tony = sh.tonyStatus === "winner" ? " <span class='tag gold'>🏆 TONY</span>" : (sh.tonyStatus === "nominated" ? " <span class='tag'>🎗 NOMINATED</span>" : "");
    const tourLeft = sh.tour ? sh.tour.weeksLeft : 0;
    const albumLeft = sh.album ? sh.album.weeksLeft : 0;
    const previewing = sh.phase === "previews";
    const canTour = !sh.tour && sh.reviews >= 65 && (sh.weeksRun||0) >= 8;
    const canAlbum = !sh.album && sh.reviews >= 55;
    const canLicense = !sh.licensed && (sh.weeksRun||0) >= 16;
    let btns = "";
    if(previewing){
      const canRetool = (sh.retools||0) < 2;
      btns += "<button class='btn btn-xs btn-primary' data-stage-retool='"+_E(sh.id)+"'"+(canRetool?"":" disabled")+
        " title='Retool the show mid-previews: $2.5M, +4 projected review points ("+(sh.retools||0)+"/2 used)'>🔧 Retool</button>";
    } else {
      btns += "<button class='btn btn-xs btn-alt' data-stage-tour='"+_E(sh.id)+"'"+((canTour||sh.tour)?"":" disabled")+
        " title='"+(sh.tour ? "Touring now — "+tourLeft+" weeks left" : "Mount a 24-week national tour (~$"+(6+v.seats/500).toFixed(1)+"M)")+"'>"+
        (sh.tour ? "🚌 Touring "+tourLeft+"w" : "🚌 Tour")+"</button>";
      btns += "<button class='btn btn-xs btn-alt' data-stage-album='"+_E(sh.id)+"'"+((canAlbum||sh.album)?"":" disabled")+
        " title='"+(sh.album ? "Album selling — "+albumLeft+" weeks left" : "Record the cast album ($1.2M)")+"'>"+
        (sh.album ? "💿 "+_M(sh.album.weekly)+"/wk" : "💿 Cast album")+"</button>";
      btns += "<button class='btn btn-xs btn-alt' data-stage-license='"+_E(sh.id)+"'"+(canLicense?"":" disabled")+" title='"+(sh.licensed ? "Rights already licensed" : "License staging rights to regional houses (16 weeks in)")+"'>"+(sh.licensed ? "📜 Licensed" : "📜 License")+"</button>";
    }
    btns += "<button class='btn btn-xs btn-ghost' data-stage-close='"+_E(sh.id)+"'>(Close)</button>";

    return "<div class='empire-block stage-show'>"+
      "<div class='spread'><div><b>🎭 "+_E(sh.title)+"</b> "+tony+
        "<div class='tiny muted'>"+_E(v.name)+" · "+_E(scale.name)+" · book by "+_E(comp.name)+" · staged by "+_E(dir.name)+
        (sh.starName ? " · "+_E(sh.starName)+" above the title" : "")+"</div></div>"+
        (previewing ? "<span class='tag gold'>PREVIEWS · "+Math.max(0,sh.weeksLeft||0)+"w left</span>" : reviewTag(sh.reviews))+"</div>"+
      bar(occPct, previewing ? "Preview occupancy" : "Occupancy", occPct+"% · "+_M(w.gross)+" gross")+
      bar(recoupPct, "Recoupment", _M(sh.net||0)+" of "+_M(sh.capitalization||0))+
      "<div class='spread' style='margin-top:6px'><span class='tiny muted'>"+
        (previewing ? "Previewing" : "Week "+(sh.weeksRun||0))+" · net "+
        "<b class='"+(w.net>=0?"pos":"neg")+"'>"+(w.net>=0?"+":"")+_M(w.net)+"/wk</b> · lifetime "+
        "<b class='"+(sh.net>=0?"pos":"neg")+"'>"+_M(sh.net||0)+"</b>"+(sh.recouped?" · <b class='pos'>RECOUPED</b>":"")+"</span>"+
      "<span class='row' style='gap:5px;flex-wrap:wrap'>"+btns+"</span></div>"+
    "</div>";
  }

  function devCard(sh, g){
    const scale = scaleById(sh.scale) || SCALES[0];
    const comp = composerById(sh.composerId) || COMPOSERS[0];
    const dir = directorById(sh.directorId) || DIRECTORS[0];
    const waiting = sh.phase === "waiting";
    const totalWeeks = Math.max(1, scale.weeks);
    const left = waiting ? 0 : (sh.weeksLeft||0);
    const pct = waiting ? 100 : Math.round((1 - left/totalWeeks)*100);
    return "<div class='empire-block stage-dev'>"+
      "<div class='spread'><div><b>🎬 "+_E(sh.title)+"</b> <span class='tag'>"+_E(scale.name)+"</span>"+
        "<div class='tiny muted'>"+_E(comp.name)+" · "+_E(dir.name)+" · "+_M(sh.capitalization)+" capitalised"+
        (sh.starName ? " · "+_E(sh.starName) : "")+"</div></div>"+
        "<button class='btn btn-xs btn-ghost' data-stage-cancel='"+_E(sh.id)+"'>Cancel</button></div>"+
      bar(pct, waiting ? "Awaiting a free house" : "Rehearsals", waiting ? "queued" : left+" week"+(left===1?"":"s")+" to first preview")+
    "</div>";
  }

  function greenlightForm(g, S){
    const films = candidates(g);
    const leads = stars(g);
    const owned = maxTier(S);
    let srcOpts = "<option value='original'>✍️ Original book (new commission)</option>";
    films.forEach(f => {
      const ww = f.ww||f.gross||0;
      srcOpts += "<option value='"+_E(f.id)+"'>"+_E(f.title)+" — "+_M(ww)+" WW</option>";
    });
    let scaleOpts = "";
    SCALES.forEach(sc => {
      const ok = sc.minVenue <= owned;
      scaleOpts += "<option value='"+sc.id+"'"+((sc.id==="chamber")?" selected":"")+">"+_E(sc.name)+" — $"+sc.cost+"M · "+sc.weeks+"w rehearsal"+(ok?"":" · needs a bigger house")+"</option>";
    });
    let compOpts = COMPOSERS.map(c => "<option value='"+c.id+"'>"+_E(c.name)+" — $"+c.fee+"M · skill "+c.skill+" · "+c.trait+"</option>").join("");
    let dirOpts = DIRECTORS.map(d => "<option value='"+d.id+"'>"+_E(d.name)+" — $"+d.fee+"M · skill "+d.skill+" · "+d.trait+"</option>").join("");
    let starOpts = "<option value=''>No star above the title</option>" +
      leads.map(t => "<option value='"+_E(t.id)+"'>"+_E(t.name)+" — "+_M(starFee(t))+" · power "+(t.power||0)+"</option>").join("");

    return "<div class='empire-block stage-form-block'>"+
      "<div class='spread'><b>🎟 Develop a new show</b><span class='tag gold'>"+S.houses.length+" house"+(S.houses.length===1?"":"s")+"</span></div>"+
      "<div class='tiny muted' style='margin-top:3px'>A film adaptation arrives with a built-in audience; an original book is cheaper, riskier and entirely yours. Previews open automatically when a suitable house is free.</div>"+
      "<div class='stage-form'>"+
        "<label>Source<select id='stageSource'>"+srcOpts+"</select></label>"+
        "<label>Scale<select id='stageScale'>"+scaleOpts+"</select></label>"+
        "<label>Composer<select id='stageComposer'>"+compOpts+"</select></label>"+
        "<label>Director<select id='stageDirector'>"+dirOpts+"</select></label>"+
        "<label>Lead (optional)<select id='stageStar'>"+starOpts+"</select></label>"+
      "</div>"+
      "<div class='spread' style='margin-top:10px;gap:10px;flex-wrap:wrap'>"+
        "<span class='tiny muted' id='stageQuote'>Pick a source and a team to see the cost.</span>"+
        "<button class='btn btn-primary' data-stage-greenlight>Greenlight the show</button>"+
      "</div>"+
    "</div>";
  }

  function renderPanel(state){
    const g = _G(state);
    if(!g) return "";
    const S = ensure(g);
    if(!S) return "";
    const sm = summary(g);
    let h = "";

    h += "<div class='empire-block stage-hero'>"+
      "<div class='spread'><b>🎭 Stage division — the Great White Way</b>"+
      (sm.tonys ? "<span class='tag gold'>🏆 "+sm.tonys+" TONY AWARD"+(sm.tonys===1?"":"S")+"</span>" : "<span class='tag'>no Tonys yet</span>")+"</div>"+
      "<div class='tiny muted' style='margin-top:3px'>Live theatre is the slowest money in the business and the fastest reputation. One show per house, a fixed weekly burn, and a Tony that changes the maths.</div>"+
      "<div class='stage-kpis'>"+
        kpi(String(sm.houses), "Houses")+kpi(String(sm.running), "Running")+kpi(String(sm.developing), "In rehearsal")+
        kpi((sm.weekly>=0?"+":"")+_M(sm.weekly), "Net / week")+kpi(_M(sm.lifetimeGross), "Lifetime gross")+
      "</div></div>";

    if(!S.unlocked){
      const v = VENUES[0];
      const noRep = (g.studio.rep||0) < v.rep;
      const noCash = (g.studio.cash||0) < v.cost;
      h += "<div class='empire-block'>"+
        "<div class='spread'><div><b>Take the lease — "+_E(v.name)+"</b>"+
        "<div class='tiny muted'>"+_E(v.blurb)+" "+v.seats+" seats · "+_M(v.upkeep)+"/wk upkeep.</div></div>"+
        "<button class='btn btn-primary' data-stage-unlock"+(noRep||noCash?" disabled":"")+">Open — "+_M(v.cost)+"</button></div>"+
        "<div class='tiny muted' style='margin-top:6px'>Requires reputation "+v.rep+" (you have "+Math.round(g.studio.rep||0)+") and "+_M(v.cost)+" cash (you have "+_M(g.studio.cash||0)+")."+
        " Then: greenlight a show, survive the reviews, chase a Tony.</div></div>";
      return h;
    }

    /* ── houses ── */
    h += "<div class='empire-sub'>🏛 Houses</div>";
    S.houses.forEach(house => {
      const v = venueByTier(house.tier);
      if(!v) return;
      const occupant = S.shows.find(s => s.houseId === house.id && (s.phase === "previews" || s.phase === "running"));
      h += "<div class='empire-row'><span><b>"+_E(v.name)+"</b> <span class='tiny muted'>"+_E(v.city)+" · "+v.seats+" seats · "+_M(v.upkeep)+"/wk</span></span>"+
        "<span class='tag "+(occupant?"green":"")+"'>"+(occupant ? "🎭 "+_E(occupant.title) : "dark")+"</span></div>";
    });
    const next = VENUES.find(v => !S.houses.some(hh => hh.tier === v.tier) && v.tier === maxTier(S)+1);
    if(next){
      const noRep = (g.studio.rep||0) < next.rep;
      const noCash = (g.studio.cash||0) < next.cost;
      h += "<div class='empire-row'><span><b>"+_E(next.name)+"</b> <span class='tiny muted'>"+_E(next.blurb)+"</span>"+
        "<div class='tiny muted'>Rep "+next.rep+" · "+next.seats+" seats · "+_M(next.upkeep)+"/wk upkeep</div></span>"+
        "<button class='btn btn-sm btn-alt' data-stage-house='"+next.tier+"'"+(noRep||noCash?" disabled":"")+">Lease — "+_M(next.cost)+"</button></div>";
    }

    /* ── now playing ── */
    const live = S.shows.filter(s => s.phase === "running" || s.phase === "previews");
    h += "<div class='empire-sub'>🌟 Now playing</div>";
    if(live.length) live.forEach(sh => { h += showCard(sh, g, S); });
    else h += "<div class='empire-block muted small'>The houses are dark. Greenlight a show below and put the lights on.</div>";

    /* ── development ── */
    const dev = S.shows.filter(s => s.phase === "rehearsal" || s.phase === "waiting");
    if(dev.length){
      h += "<div class='empire-sub'>🎬 In rehearsal</div>";
      dev.forEach(sh => { h += devCard(sh, g); });
    }

    /* ── greenlight ── */
    h += "<div class='empire-sub'>📝 Development slate</div>";
    h += greenlightForm(g, S);

    /* ── curtain down ── */
    if(S.history.length){
      h += "<div class='empire-sub'>🎭 Curtain down</div>";
      S.history.slice(0,6).forEach(x => {
        h += "<div class='empire-row'><span><b>"+_E(x.title)+"</b> <span class='tiny muted'>"+x.weeks+" weeks · "+x.reviews+" reviews"+
          (x.tonysWon ? " · 🏆" : "")+"</span></span>"+
          "<span class='tiny "+(x.profit>=0?"pos":"neg")+"'>"+(x.profit>=0?"+":"")+_M(x.profit)+" lifetime</span></div>";
      });
    }

    return h;
  }

  /* ─────────────────────────── bindings ─────────────────────────── */
  function readForm(doc){
    const val = sel => { const el = doc.querySelector(sel); return el ? el.value : null; };
    return {
      sourceId: val("#stageSource") || "original",
      scale: val("#stageScale") || "chamber",
      composerId: val("#stageComposer") || COMPOSERS[0].id,
      directorId: val("#stageDirector") || DIRECTORS[0].id,
      starId: val("#stageStar") || null
    };
  }

  function refreshQuote(doc){
    const out = doc.querySelector("#stageQuote");
    if(!out) return;
    const g = _G();
    if(!g) return;
    const q = quote(readForm(doc), g);
    out.innerHTML = "Capitalisation <b>"+_M(q.cost)+"</b> · projected reviews <b>"+q.low+"–"+q.high+"</b> (mid "+q.reviews+")";
  }

  function bindEvents(doc, state){
    const d = doc || global.document;
    if(!d) return;
    const g = _G(state);

    ["#stageSource","#stageScale","#stageComposer","#stageDirector","#stageStar"].forEach(sel => {
      const el = d.querySelector(sel);
      if(el && !el.__stageBound){
        el.__stageBound = true;
        el.addEventListener("change", () => refreshQuote(d));
      }
    });
    refreshQuote(d);

    const act = (result, okMsg, okKind) => {
      if(result && result.ok){ _beep(okKind||"gold"); if(okMsg) _toast(okMsg,"good"); }
      else { _beep("bad"); _toast((result && result.reason) || "That did not work.", "bad"); }
      _render();
    };

    d.querySelectorAll("[data-stage-unlock]").forEach(b => {
      b.onclick = () => act(unlock(g), "🎭 Broadway unlocked");
    });
    d.querySelectorAll("[data-stage-house]").forEach(b => {
      b.onclick = () => act(buyHouse(+b.dataset.stageHouse, g), "🏛 House leased");
    });
    d.querySelectorAll("[data-stage-greenlight]").forEach(b => {
      b.onclick = () => {
        const opts = readForm(d);
        const r = greenlight(opts, g);
        if(r.ok) act(r, "🎭 \""+r.show.title+"\" greenlit — rehearsals begin");
        else act(r);
      };
    });
    d.querySelectorAll("[data-stage-retool]").forEach(b => {
      b.onclick = () => act(retool(b.dataset.stageRetool, g), "🔧 Retooled");
    });
    d.querySelectorAll("[data-stage-tour]").forEach(b => {
      b.onclick = () => act(launchTour(b.dataset.stageTour, g), "🚌 Touring company on the road");
    });
    d.querySelectorAll("[data-stage-album]").forEach(b => {
      b.onclick = () => act(releaseAlbum(b.dataset.stageAlbum, g), "💿 Cast album released");
    });
    d.querySelectorAll("[data-stage-license]").forEach(b => {
      b.onclick = () => act(licenseShow(b.dataset.stageLicense, g), "📜 Staging rights licensed");
    });
    d.querySelectorAll("[data-stage-close]").forEach(b => {
      b.onclick = () => act(closeShow(b.dataset.stageClose, g));
    });
    d.querySelectorAll("[data-stage-cancel]").forEach(b => {
      b.onclick = () => act(cancelShow(b.dataset.stageCancel, g));
    });
  }

  global.StageDivision = {
    /* data */
    VENUES, SCALES, COMPOSERS, DIRECTORS, ORIGINAL_TITLES,
    /* state + economy */
    ensure, unlock, buyHouse, candidates, stars, starFee,
    quote, greenlight, retool, launchTour, releaseAlbum, licenseShow,
    closeShow, cancelShow, tick, summary,
    /* ui */
    renderPanel, bindEvents,
    /* exposed for tests + other modules */
    _internals: { weeklyFor, occupancyOf, scoreShow, assignHouse, maxTier, venueByTier, scaleById, composerById, directorById, tonySeason }
  };
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
