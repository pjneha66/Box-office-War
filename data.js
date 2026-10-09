/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — data.js
   Static game data: genres, scales, calendar, OTT platforms,
   talent name pools, title generators, archetypes, events,
   v2/v3 expansion data (difficulty, scenarios, execs, festivals,
   sports, IP market, achievements…).
   All money is in $Millions (USD).
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ── RNG helpers ── */
function rnd(){ return Math.random(); }
function rint(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function chance(p){ return Math.random() < p; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function gauss(){ // ~N(0,1)
  let u=0,v=0;
  while(u===0)u=Math.random(); while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
let _id=1;
function nid(){ return _id++; }

const DATA = {};

/* ── Genres ──
   mass      : opening-weekend mass appeal multiplier
   legsAdj   : added to legs multiplier (word-of-mouth stamina)
   intlShare : fraction of worldwide gross from intl + china
   china     : china share of WW (studio keeps only ~25% there)
   critic    : critic score bias
   aud       : audience score bias
   ott       : streaming appetite multiplier
   awards    : awards weight (prestige)
   budgetBias: cost multiplier for same scale
*/
DATA.GENRES = {
  action:   {name:"Action",      emoji:"💥", mass:1.25, legsAdj:-0.10, intlShare:0.63, china:0.20, critic:-4, aud:+4,  otta:1.05, awards:0.5, budgetBias:1.15, merch:1.10},
  scifi:    {name:"Sci-Fi",      emoji:"🚀", mass:1.20, legsAdj:-0.05, intlShare:0.60, china:0.20, critic:+0, aud:+3,  otta:1.15, awards:0.7, budgetBias:1.20, merch:1.20},
  fantasy:  {name:"Fantasy",     emoji:"🐉", mass:1.12, legsAdj:+0.05, intlShare:0.58, china:0.14, critic:+1, aud:+2,  otta:1.10, awards:0.8, budgetBias:1.20, merch:1.35},
  animation:{name:"Animation",   emoji:"🎨", mass:1.20, legsAdj:+0.45, intlShare:0.60, china:0.15, critic:+4, aud:+5,  otta:1.25, awards:0.8, budgetBias:1.10, merch:1.50},
  comedy:   {name:"Comedy",      emoji:"😂", mass:1.05, legsAdj:+0.00, intlShare:0.33, china:0.02, critic:-5, aud:+3,  otta:1.00, awards:0.3, budgetBias:0.85, merch:0.70},
  horror:   {name:"Horror",      emoji:"👻", mass:0.92, legsAdj:-0.35, intlShare:0.48, china:0.00, critic:-8, aud:+0,  otta:1.30, awards:0.1, budgetBias:0.60, openBoost:1.45, merch:0.50},
  thriller: {name:"Thriller",    emoji:"🔪", mass:0.90, legsAdj:+0.05, intlShare:0.42, china:0.04, critic:+2, aud:+1,  otta:1.15, awards:0.6, budgetBias:0.85, merch:0.50},
  drama:    {name:"Drama",       emoji:"🎭", mass:0.70, legsAdj:+0.25, intlShare:0.42, china:0.03, critic:+7, aud:-3,  otta:1.05, awards:1.6, budgetBias:0.75, merch:0.25},
  romance:  {name:"Romance",     emoji:"💘", mass:0.80, legsAdj:+0.15, intlShare:0.35, china:0.02, critic:+2, aud:+2,  otta:1.10, awards:0.7, budgetBias:0.70, merch:0.40},
  musical:  {name:"Musical",     emoji:"🎵", mass:0.95, legsAdj:+0.30, intlShare:0.40, china:0.02, critic:+4, aud:+2,  otta:1.00, awards:1.3, budgetBias:0.90, merch:0.80},
  /* ── v4 genres ── */
  western:  {name:"Western",     emoji:"🤠", mass:0.82, legsAdj:+0.12, intlShare:0.34, china:0.02, critic:+3, aud:+1,  otta:1.00, awards:1.1, budgetBias:0.90, merch:0.45},
  war:      {name:"War",         emoji:"🎖", mass:0.95, legsAdj:+0.14, intlShare:0.50, china:0.07, critic:+4, aud:+3,  otta:1.05, awards:1.35,budgetBias:1.10, merch:0.35},
  sports:   {name:"Sports",      emoji:"🏟", mass:0.90, legsAdj:+0.22, intlShare:0.28, china:0.02, critic:+2, aud:+6,  otta:1.10, awards:0.9, budgetBias:0.80, merch:0.60},
  concert:  {name:"Concert Film",emoji:"🎤", mass:1.00, legsAdj:-0.45, intlShare:0.45, china:0.01, critic:+1, aud:+7,  otta:1.35, awards:0.2, budgetBias:0.35, openBoost:1.40, merch:0.95},
  truecrime:{name:"True Crime",  emoji:"🔎", mass:0.78, legsAdj:+0.06, intlShare:0.32, china:0.00, critic:+2, aud:+2,  otta:1.45, awards:0.7, budgetBias:0.60, merch:0.20},
};

/* ── Series-only genres (v2: cheap, renewal-friendly) ── */
DATA.SGENRES = {
  reality:      {name:"Reality",      emoji:"🎤", ott:1.05, awards:0.1, perEpMax:5,  renewBonus:8},
  documentary:  {name:"Documentary",  emoji:"🎥", ott:1.00, awards:0.4, perEpMax:6,  renewBonus:6},
};
DATA.genreOf = (id)=> DATA.GENRES[id] || DATA.SGENRES[id] || {name:id, emoji:"🎞"};

/* ── Production scales ── */
DATA.SCALES = {
  indie:    {name:"Indie",        emoji:"🎬", bMin:4,   bMax:25,  shoot:[4,6],   post:[4,7],   pre:[2,4],  openBase:9,   mktRate:0.55},
  mid:      {name:"Mid-Budget",   emoji:"🎥", bMin:28,  bMax:90,  shoot:[6,9],   post:[7,11],  pre:[3,5],  openBase:30,  mktRate:0.60},
  tentpole: {name:"Tentpole",     emoji:"🌌", bMin:110, bMax:280, shoot:[9,13],  post:[12,18], pre:[4,6],  openBase:100, mktRate:0.85},
};

/* ── 52-week calendar → month, season multiplier, holiday legs bump ── */
const _M = [ // month, weeks
  ["Jan",4],["Feb",4],["Mar",5],["Apr",4],["May",5],["Jun",4],
  ["Jul",4],["Aug",5],["Sep",4],["Oct",5],["Nov",4],["Dec",4]
];
const _SEASON = {Jan:0.80, Feb:0.80, Mar:0.95, Apr:1.00, May:1.18, Jun:1.15, Jul:1.20, Aug:0.98, Sep:0.85, Oct:1.02, Nov:1.28, Dec:1.32};
DATA.WEEKS = []; // idx 0..51 → {m, month, season, holiday}
(function(){
  let w=0;
  for(const [m,n] of _M){ for(let i=0;i<n;i++){ DATA.WEEKS.push({m, month:m, season:_SEASON[m], holiday:(m==="Nov"||m==="Dec")}); } w+=n; }
})();
DATA.seasonOf = (weekIdx)=> DATA.WEEKS[((weekIdx-1)%52+52)%52];

/* ── OTT platforms ── */
DATA.PLATFORMS = [
  {id:"streamflix", name:"StreamFlix", color:"#e50914", logo:"S", generosity:1.22, renew:58, taste:{horror:1.2,thriller:1.15,scifi:1.15,action:1.1,drama:1.0,comedy:1.0,romance:1.0,animation:1.05,fantasy:1.05,musical:0.9,reality:1.05,documentary:1.0}, blurb:"The giant. Pays big, cancels fast."},
  {id:"bingebox",   name:"BingeBox",   color:"#00a8e1", logo:"B", generosity:1.08, renew:52, taste:{comedy:1.25,romance:1.2,reality:1.3,drama:1.05,thriller:1.0,horror:1.0,action:0.95,scifi:0.95,animation:1.0,fantasy:0.95,musical:1.1,documentary:0.9}, blurb:"Binge-first. Loves comfort TV."},
  {id:"prestigemax",name:"PrestigeMax",color:"#7b2cbf", logo:"P", generosity:1.12, renew:50, taste:{drama:1.35,musical:1.2,thriller:1.1,romance:1.05,comedy:0.95,horror:0.9,action:0.9,scifi:0.95,animation:0.9,fantasy:1.0,documentary:1.25,reality:0.7}, blurb:"Awards darling. Prestige over profit."},
  {id:"magicplus",  name:"Magic+",     color:"#1ce3ff", logo:"M", generosity:1.15, renew:54, taste:{animation:1.4,fantasy:1.25,action:1.1,scifi:1.1,family:1,comedy:0.95,drama:0.85,horror:0.7,thriller:0.85,romance:0.9,musical:1.15,reality:1.1,documentary:0.8}, blurb:"Family empire. Four-quadrant only."},
  {id:"orbittv",    name:"OrbitTV",    color:"#ff9f1c", logo:"O", generosity:0.92, renew:60, taste:{documentary:1.3,horror:1.1,thriller:1.05,drama:1.0,comedy:1.0,romance:1.05,action:0.9,scifi:0.9,animation:0.85,fantasy:0.9,musical:0.95,reality:1.15}, blurb:"Budget streamer. Lowballs, but loyal."},
  {id:"cinemavault",name:"CinemaVault",color:"#d4af37", logo:"C", generosity:1.06, renew:48, taste:{drama:1.45,romance:1.25,documentary:1.4,thriller:1.05,musical:1.1,horror:0.75,action:0.7,animation:0.85,comedy:0.95,scifi:0.9,fantasy:0.85,reality:0.6}, blurb:"Cinephile haven. Criterion-style prestige curation."},
  {id:"animepulse", name:"AnimePulse", color:"#ff4d88", logo:"A", generosity:1.10, renew:55, taste:{animation:1.55,fantasy:1.35,scifi:1.3,horror:1.15,action:1.2,comedy:1.05,drama:0.9,romance:1.1,musical:0.95,documentary:0.8,reality:0.7}, blurb:"Youth & animation powerhouse. Cult followings."},
  {id:"primeaction",name:"PrimeAction",color:"#00e676", logo:"X", generosity:1.20, renew:56, taste:{action:1.4,thriller:1.3,scifi:1.25,horror:1.2,comedy:1.05,fantasy:1.1,drama:0.95,romance:0.85,animation:0.9,musical:0.75,documentary:0.85,reality:1.0}, blurb:"Adrenaline & popcorn hits. High bids for spectacle."},
];
/* series formats: docuseries, comedy specials, limited events */
DATA.SERIES_FORMATS = [
  {id:"standard", name:"Standard Series", eps:8, perEp:6, icon:"📺", desc:"Classic 8-ep episodic series · steady audience build", costMult:1.0, buzzMult:1.0},
  {id:"docuseries", name:"Prestige Docuseries", eps:4, perEp:4, icon:"🎙️", desc:"Deep-dive 4-ep investigative series · critical darling, low burn", costMult:0.65, buzzMult:1.18},
  {id:"comedyspecial", name:"Comedy / Event Special", eps:2, perEp:3, icon:"🎤", desc:"Fast 2-ep stand-up or variety special · quick turnaround", costMult:0.45, buzzMult:1.05},
  {id:"limitedevent", name:"Star-Studded Limited Event", eps:6, perEp:10, icon:"🌟", desc:"6-ep high-budget mini-series · massive opening buzz & awards push", costMult:1.6, buzzMult:1.35}
];
/* platform lookup also includes streamers that entered mid-game (platform subscriber wars) */
DATA.allPlatforms = ()=>{
  const extra = (typeof G!=="undefined" && G && G.extraPlatforms)? G.extraPlatforms : [];
  return DATA.PLATFORMS.concat(extra);
};
DATA.platform = (id)=> DATA.allPlatforms().find(p=>p.id===id) || DATA.PLATFORMS.find(p=>p.id===id) || {name:"?", color:"#555", logo:"?"};
DATA.NEWSTREAMERS = ["VortexTV","PeakPlay","Fable+","Nebula Now","Zenith+","Bolt Stream","Chronos","Starlight"];

/* ── Rival studios ── */
DATA.RIVALS_DEF = [
  {name:"Apex Pictures",   color:"#ff5d6c", style:"tentpole",  blurb:"Blockbuster factory"},
  {name:"Lantern & Co",    color:"#b48bff", style:"prestige",  blurb:"Awards bait specialists"},
  {name:"Nimbus Studios",  color:"#4dd6e8", style:"balanced",  blurb:"Volume hitters"},
];

/* ── Archetypes (start choices) ── */
DATA.ARCHETYPES = [
  {id:"auteur", name:"🎬 Indie Auteur", cash:45, rep:38, overhead:0.4, devBonus:6, flopPenalty:0.7,
   sub:"Critical darling, tiny war chest. Creativity +6. Flops hurt less."},
  {id:"producer", name:"💼 Rising Producer", cash:130, rep:28, overhead:0.9, devBonus:2, flopPenalty:1.0,
   sub:"Balanced start. Enough to make a mid-budget bet or two."},
  {id:"mogul", name:"🚁 Mogul Backing", cash:420, rep:22, overhead:2.2, devBonus:0, flopPenalty:1.5,
   sub:"Deep pockets, impatient investors. Flops hurt your standing ×1.5."},
];

/* ── v2 meta: difficulties, scenarios ── */
DATA.DIFFICULTIES = {
  easy:   {name:"Easy",   emoji:"🌤", rent:1.12, eventRate:0.8, desc:"Rentals +12% · milder events"},
  normal: {name:"Normal", emoji:"⚖️", rent:1.00, eventRate:1.0, desc:"The industry as it is"},
  hard:   {name:"Hard",   emoji:"🔥", rent:0.88, eventRate:1.3, desc:"Rentals −12% · harsher events"},
};
DATA.SCENARIOS = {
  standard:   {name:"Standard",     emoji:"🎬", cash:0,   debt:0,   rep:0,   overhead:0,   flopPenalty:0,
               desc:"Found a studio and climb from nothing."},
  turnaround: {name:"Turnaround",   emoji:"🧯", cash:-20, debt:180, rep:-6,  overhead:0.2, flopPenalty:0,
               desc:"You inherited a sinking lot: $180M debt, bruised reputation. Survive, rebuild, redeem."},
  goldenage:  {name:"Golden Age",   emoji:"👑", cash:260, debt:0,   rep:+10, overhead:0.8, flopPenalty:0.4,
               desc:"A war chest and a pedigree — but the board expects trophies. Flops sting harder."},
  indiedarling:{name:"Indie Darling", emoji:"🌹", cash:-35, debt:0,  rep:+12, overhead:-0.2, flopPenalty:0.55, devBonus:5,
               desc:"Festival-bred credibility: high rep, tiny bank account. Critics love you; the bank doesn't. Script quality is everything."},
  franchisemachine:{name:"Franchise Machine", emoji:"🏰", cash:180, debt:60, rep:+4, overhead:1.3, flopPenalty:1.2,
               desc:"You bought a tired-but-beloved IP with your seed money. One legacy franchise is already on the lot — feed it fresh entries without burning it out."},
};

/* ── v2 content options ── */
DATA.RATINGS = [
  {id:"PG-13", emoji:"🍿", open:1.00, critic:0, desc:"Four-quadrant. The masses show up."},
  {id:"R",     emoji:"🔞", open:0.88, critic:+4, desc:"−12% opening, but critics like it darker."},
];
/* (v1 location table removed — see the authoritative v5 list below) */
DATA.WINDOWS = [
  {d:17, label:"17-day",  pvod:1.15, rel:-10, desc:"PVOD +15% · exhibitors fume (−10 relations)"},
  {d:45, label:"45-day",  pvod:1.00, rel:0,   desc:"The industry standard"},
  {d:90, label:"90-day",  pvod:0.85, rel:+6,  desc:"PVOD −15% · theaters love you (+6 relations)"},
];
DATA.PATTERNS = [
  {id:"wide",     label:"Wide release",     open:1.08, legs:0.00, desc:"+8% opening, everywhere at once"},
  {id:"platform", label:"Platform rollout", open:0.75, legs:0.35, desc:"−25% opening, much longer legs"},
];
DATA.ROLLOUTS = [
  {id:"day",       label:"Day-and-date worldwide", open:1.00, legs:0.00, intl:1.00, desc:"One weekend, whole planet"},
  {id:"staggered", label:"Staggered intl rollout", open:0.88, legs:0.15, intl:1.12, desc:"−12% open, +legs, intl builds week by week"},
];

/* ── v12 exhibition: named theater chains (§22) ──
   screens: share of the domestic screen count this chain controls (independents hold the rest)
   taste:   genres the chain books generously (+screens on release day)
   rel:     starting booking relation with your studio (0–100) — court them for more screens */
DATA.CHAINS = [
  {id:"meridian", name:"Meridian Cinemas",    emoji:"🎞", screens:0.30, taste:{action:1.15,scifi:1.15,fantasy:1.1,war:1.05},      rel:55, blurb:"The national multiplex giant — wherever a mall went up, Meridian followed."},
  {id:"novastar", name:"NovaStar Cineplex",   emoji:"🍿", screens:0.24, taste:{animation:1.2,romance:1.1,comedy:1.05,sports:1.05}, rel:48, blurb:"Family-first suburban palaces with the biggest lobby standees."},
  {id:"lumen",    name:"Lumen Grand",         emoji:"✨", screens:0.16, taste:{scifi:1.15,concert:1.2,musical:1.1},                rel:50, blurb:"Big-format premium auditoriums in the toniest postcodes."},
  {id:"regent",   name:"Regent Arthouse",     emoji:"🏛", screens:0.12, taste:{drama:1.25,truecrime:1.15,western:1.1,war:1.1},     rel:60, blurb:"Platform-release houses in every college town."},
  {id:"starlite", name:"Starlight Drive-Ins", emoji:"🌙", screens:0.08, taste:{horror:1.25,comedy:1.1},                            rel:42, blurb:"Nostalgic lots on the edge of town. Cheap prints, loyal crowds."},
];

/* ── v12 city-level box office (§26): fictional cities per release region ── */
DATA.CITIES = {
  europe:["Bright Harbour","Kesselstadt","Valmont-sur-Mer"],
  eastasia:["Xinyu Harbour","Kaicheng","Motomachi"],
  seasia:["Kota Laut","Pantai Raya","Mueang Mai"],
  india:["Roshanpur","Kalighat Heights","Navgaon"],
  latam:["Puerto Cielo","Villa Sombra","Costa Verde"],
  me:["Al Sahra City","Wadi Nassim","Jabal Rihab"],
  other:["Port Meridian","Cap Aurora","Highbridge"],
};

/* ── v13 social: fictional platforms (§18) — trending hashtags are driven by state ── */
DATA.SOCIALS = [
  {id:"cinetok", name:"CineTok",  icon:"🎵", blurb:"Short-form video. Where trailers live or die in 48 hours."},
  {id:"blabber", name:"Blabber",  icon:"💬", blurb:"The real-time rage machine. Scandals and feuds trend here first."},
  {id:"reelit",  name:"Reelit",   icon:"🧵", blurb:"The film-nerd forum. Theories, leaks, pile-ons."},
  {id:"boxmoji", name:"BoxMoji",  icon:"📊", blurb:"Tracking-obsessed prognosticators. Advance sales talk."},
];

/* ── v14 board of directors (§44–45): three seats, drawn at founding ──
   hawk: votes harder against big budgets when unhappy; base: starting approval */
DATA.BOARD_TRAITS = [
  {trait:"ex-studio head",  names:["Vera Kessler","Dana Whitlock","Marge Ohanian"], hawk:false, base:58, desc:"Greenlit a hundred pictures. Votes with the creator when the pitch is strong."},
  {trait:"money hawk",      names:["Alden Price","Ruth Castellanos","Ivo Brandt"],  hawk:true,  base:44, desc:"Counts every zero. Big budgets need a strong pitch to clear the hawk."},
  {trait:"legend producer", names:["Solomon Rae","Pilar Fontaine","Gus Amaro"],     hawk:false, base:62, desc:"Old-school. Loves stars, hates overruns, rewards hits."},
];

/* ── v14 music label roster (§32): up to 3 acts on the label ──
   fee: signing advance; heat: 1-3 baseline; vibe: which films they soundtrack */
DATA.ARTISTS = [
  {id:"nova",   name:"NOVA REYES",    fee:8,  heat:3, vibe:"pop blockbusters",  blurb:"Arena-scale pop voice. Charts when the wind blows."},
  {id:"kehlani",name:"The Kestrels",  fee:4,  heat:2, vibe:"prestige drama",    blurb:"Harmony trio the critics keep discovering."},
  {id:"diesel", name:"Diesel Chapel", fee:5,  heat:2, vibe:"action & thriller", blurb:"Riff-heavy wall of sound built for car chases."},
  {id:"wren",   name:"Wren",          fee:3,  heat:1, vibe:"indie & animation", blurb:"Bedroom-pop whisper. Sync-deals out of proportion."},
  {id:"mcd",    name:"MC Delta",      fee:6,  heat:2, vibe:"sports & comedy",   blurb:"Locker-room anthems, every one of them."},
  {id:"aria",   name:"Aria Solene",   fee:7,  heat:3, vibe:"musicals",          blurb:"Trained, towering, awards-season favorite."},
];

/* ── v15 fan mail (§18-adjacent flavor): the people who buy the tickets write back ── */
DATA.FAN_NAMES = [
  "Sam T.","Priya K.","the Okafor family","Marcus D.","Lena V.","dieharddanny42","Aunt Bex",
  "the Chen twins","Rosa M.","filmboy_jai","Grandpa Walt","the Mehta sisters","Tomas R.","Keisha J.",
  "bandagedthumb","the Alvarez crew","Noor H.","Paulie & the kids","midnight_marge","Dev P.",
];

/* ── v16 game studio: developer houses for the movie-game division ──
   cost: up-front fee; weekly: burn through development; quality: base score */
DATA.GAME_DEVS = [
  {id:"inhouse", name:"In-house team",    cost:12, weeks:[8,12], quality:55, weekly:0.8, blurb:"Cheap and loyal — scrappy games, thin ceilings."},
  {id:"partner", name:"Partner studio",   cost:30, weeks:[6,9],  quality:72, weekly:1.5, blurb:"Proven genre houses — solid games, real burn."},
  {id:"elite",   name:"Elite AAA house",  cost:70, weeks:[5,8],  quality:88, weekly:3,   blurb:"The best in the business. Costs like it, delivers like it."},
];

/* ── v2 executives ── */
DATA.EXECS = [
  {id:"cmo",     icon:"📣", name:"Chief Marketing Officer", hire:40, salary:0.40, desc:"+12% hype on every release"},
  {id:"casting", icon:"🎭", name:"Head of Casting",         hire:30, salary:0.30, desc:"Talent fees −10% · stars much harder to poach"},
  {id:"cfo",     icon:"🧮", name:"Chief Financial Officer", hire:35, salary:0.35, desc:"All loan interest −30%"},
];

/* ── v2 festivals → v5 circuit: each festival has its own taste & a sales market ──
   loves   : premiere a film in a loved genre and your win odds + buzz jump
   prestige: multiplies prize money, buzz and awards momentum from a win
   market  : strength of the acquisitions floor — a win invites premium streamer auctions/offers  */
/* ── v28 festival entry modes: region ties a Competition slot to a shoot location (see festModesOf) ── */
DATA.FESTIVALS = [
  {id:"snowfall",  woy:9,  name:"Snowfall Festival",      emoji:"❄️", region:"london",    blurb:"The indie marketplace. Scrappy discoveries get bought here.",
   loves:["drama","thriller","truecrime","horror","romance"], prestige:1.0, market:1.5},
  {id:"azure",     woy:20, name:"Azure Coast Festival",   emoji:"🌴", region:"australia", blurb:"The pale-blue carpet. Auterurs, foreign-language gems and scandal.",
   loves:["drama","musical","romance","fantasy","western"], prestige:1.4, market:1.1, foreign:true},
  {id:"laguna",    woy:36, name:"Laguna Film Festival",   emoji:"🛶", region:"la",        blurb:"Old-world prestige: where awards season quietly begins.",
   loves:["drama","war","musical","animation","romance"], prestige:1.2, market:1.2},
  {id:"telluride", woy:43, name:"Harvest Telluride",      emoji:"🍂", region:"atlanta",   blurb:"No market, no fuss — pure awards-momentum screening room.",
   loves:["drama","western","war","thriller","truecrime"], prestige:0.9, market:0.7},
];

/* ── v28 TALENT ABILITIES — hidden rarity-tiered passives, revealed by audition or first collaboration.
   Pure data: engine sums craft/open/legs/intl/award/overrun across attached talent. ── */
DATA.ABILITY_RARITY = {
  common:   {name:"Common",   cls:"tag",     weight:70},
  rare:     {name:"Rare",     cls:"tag blue", weight:22},
  epic:     {name:"Epic",     cls:"tag purple", weight:7},
  legendary:{name:"Legendary",cls:"tag gold", weight:1},
};
DATA.ABILITIES = [
  /* actors */
  {id:"crowd",      kind:"actor",   rarity:"common",   name:"Crowd-Pleaser",       emoji:"🍿", craft:{aud:2},  blurb:"+2 audience score"},
  {id:"critfav",    kind:"actor",   rarity:"common",   name:"Critics' Favorite",   emoji:"🖋", craft:{critic:2}, blurb:"+2 critic score"},
  {id:"grinder",    kind:"actor",   rarity:"common",   name:"First On Set",        emoji:"⏱", craft:{overall:1}, blurb:"+1 overall"},
  {id:"tabloid",    kind:"actor",   rarity:"common",   name:"Tabloid Magnet",      emoji:"📰", scandal:1, blurb:"Scandal risk doubles"},
  {id:"opendraw",   kind:"actor",   rarity:"rare",     name:"Opening Draw",        emoji:"🎟", open:0.06, blurb:"+6% opening weekend"},
  {id:"chameleon",  kind:"actor",   rarity:"rare",     name:"Method Chameleon",    emoji:"🦎", craft:{overall:3}, blurb:"+3 overall"},
  {id:"genremag",   kind:"actor",   rarity:"rare",     name:"Genre Shapeshifter",  emoji:"🎭", fitAll:1, blurb:"Counts as genre-fit in any genre"},
  {id:"globalicon", kind:"actor",   rarity:"epic",     name:"Global Icon",         emoji:"🌍", intl:0.10, craft:{aud:2}, blurb:"+10% international share, +2 audience"},
  {id:"awardsdar",  kind:"actor",   rarity:"epic",     name:"Awards Darling",      emoji:"🏆", award:0.10, craft:{critic:3}, blurb:"+10% award odds, +3 critics"},
  {id:"legsengine", kind:"actor",   rarity:"epic",     name:"Legs Engine",         emoji:"🏃", legs:0.12, blurb:"+12% box-office legs"},
  {id:"moviestar",  kind:"actor",   rarity:"legendary",name:"Movie Star Incarnate",emoji:"✨", open:0.08, craft:{aud:4, critic:2}, blurb:"+8% opening, +4 audience, +2 critics"},
  /* directors */
  {id:"steady",     kind:"director",rarity:"common",   name:"Steady Hand",         emoji:"🧭", overrun:-0.03, blurb:"−3% weekly overrun risk"},
  {id:"visualsty",  kind:"director",rarity:"common",   name:"Visual Stylist",      emoji:"🖼", craft:{overall:2}, specOnly:1, blurb:"+2 overall on spectacle genres"},
  {id:"actorwhis",  kind:"director",rarity:"rare",     name:"Actor Whisperer",     emoji:"🫱", craft:{aud:3}, blurb:"+3 audience (casts perform better)"},
  {id:"genresav",   kind:"director",rarity:"rare",     name:"Genre Savant",        emoji:"🧠", fitX2:1, blurb:"Genre-fit bonus doubled"},
  {id:"auteurvoice",kind:"director",rarity:"epic",     name:"Auteur Voice",        emoji:"🎙", craft:{critic:5}, blurb:"+5 critics"},
  {id:"spectacle",  kind:"director",rarity:"epic",     name:"Spectacle Architect", emoji:"🌉", craft:{aud:4}, bigOnly:1, blurb:"+4 audience on tentpoles"},
  {id:"generational",kind:"director",rarity:"legendary",name:"Generational Talent",emoji:"🕯", craft:{overall:6}, award:0.08, blurb:"+6 overall, +8% award odds"},
  /* writers */
  {id:"punchup",    kind:"writer",  rarity:"common",   name:"Punch-Up Artist",     emoji:"🥊", craft:{aud:2}, blurb:"+2 audience"},
  {id:"prestigepen",kind:"writer",  rarity:"common",   name:"Prestige Pen",        emoji:"🪶", craft:{critic:2}, blurb:"+2 critics"},
  {id:"twist",      kind:"writer",  rarity:"rare",     name:"Twist Specialist",    emoji:"🌀", craft:{overall:3}, blurb:"+3 overall"},
  {id:"franchiseau",kind:"writer",  rarity:"rare",     name:"Saga Architect",      emoji:"🏛", craft:{overall:3}, seqOnly:1, blurb:"+3 overall on sequels"},
  {id:"voicegen",   kind:"writer",  rarity:"epic",     name:"Voice Of A Generation",emoji:"📣", craft:{critic:5, aud:2}, blurb:"+5 critics, +2 audience"},
  /* producers */
  {id:"budgethawk", kind:"producer",rarity:"common",   name:"Budget Hawk",         emoji:"🦅", overrun:-0.04, blurb:"−4% weekly overrun risk"},
  {id:"schedsav",   kind:"producer",rarity:"common",   name:"Schedule Savant",     emoji:"📅", overrun:-0.02, craft:{overall:1}, blurb:"−2% overruns, +1 overall"},
  {id:"crisisfix",  kind:"producer",rarity:"rare",     name:"Crisis Fixer",        emoji:"🧯", overrun:-0.05, blurb:"−5% weekly overrun risk"},
  {id:"talentwrang",kind:"producer",rarity:"rare",     name:"Talent Wrangler",     emoji:"🪢", calm:1, blurb:"Calms one active feud"},
  {id:"awardsop",   kind:"producer",rarity:"epic",     name:"Awards-Season Operator",emoji:"🎰", award:0.12, blurb:"+12% award odds"},
];
DATA.abilityOf = (id)=> (DATA.ABILITIES||[]).find(a=>a.id===id) || null;

/* ── v28 THEMES — Kairosoft-style hidden genre×theme affinities, discovered by shipping ── */
DATA.THEMES = [
  {id:"heist",     name:"Heist",            emoji:"💰", loves:["action","thriller","comedy","truecrime"],    hates:["musical","animation"]},
  {id:"revenge",   name:"Revenge",          emoji:"🗡", loves:["thriller","drama","action","western"],       hates:["comedy","concert"]},
  {id:"firstlove", name:"First Love",       emoji:"🌸", loves:["romance","drama","musical"],                 hates:["horror","war"]},
  {id:"dystopia",  name:"Dystopia",         emoji:"🏚", loves:["scifi","thriller","war"],                    hates:["comedy","romance"]},
  {id:"buddies",   name:"Buddy Adventure",  emoji:"🤝", loves:["comedy","action","animation"],               hates:["truecrime","drama"]},
  {id:"haunted",   name:"Haunted House",    emoji:"🕯", loves:["horror","thriller","truecrime"],             hates:["musical","sports"]},
  {id:"courtroom", name:"Courtroom",        emoji:"⚖️", loves:["drama","thriller","truecrime"],              hates:["fantasy","animation"]},
  {id:"space",     name:"Space Frontier",   emoji:"🛰", loves:["scifi","action","fantasy"],                  hates:["romance","western"]},
  {id:"biopic",    name:"Rise & Fall",      emoji:"📈", loves:["drama","musical","sports","war"],            hates:["horror","scifi"]},
  {id:"zombies",   name:"Outbreak",         emoji:"🧟", loves:["horror","action","thriller"],                hates:["romance","musical"]},
  {id:"underdog",  name:"Underdog Story",   emoji:"🔔", loves:["sports","drama","comedy"],                   hates:["scifi","fantasy"]},
  {id:"timeloop",  name:"Time Loop",        emoji:"⏳", loves:["scifi","comedy","romance","fantasy"],        hates:["western","war"]},
  {id:"spy",       name:"Spy Conspiracy",   emoji:"🕶", loves:["action","thriller","war"],                   hates:["animation","musical"]},
  {id:"homecoming",name:"Family Homecoming",emoji:"🏡", loves:["drama","romance","comedy"],                  hates:["horror","action"]},
];
DATA.themeOf = (id)=> (DATA.THEMES||[]).find(t=>t.id===id) || null;
/* affinity: love → +5 craft & +8% opening; clash → −4 craft. Key "genre|theme". */
DATA.comboKey = (genre, theme)=> genre+"|"+theme;
DATA.comboOf = (genre, theme)=>{
  const th=DATA.themeOf(theme); if(!th) return "neutral";
  if(th.loves.includes(genre)) return "love";
  if(th.hates.includes(genre)) return "clash";
  return "neutral";
};

/* ── v28: Custom Creator pools (studio/person/franchise) ── */
DATA.CUSTOM_POOLS = {
  studios: [],
  people: [],
  franchises: []
};
DATA.customStudio = (name, desc)=> ({ id:nid(), name, desc, created:G?.week||1, films:0, value:0 });
DATA.customPerson = (name, kind, desc)=> ({ id:nid(), name, kind, desc, created:G?.week||1, power:3, skill:70, fee:5 });
DATA.customFranchise = (name, genre, desc)=> ({ id:nid(), name, genre, desc, created:G?.week||1, films:0, value:0 });
DATA.customPools = ()=> DATA.CUSTOM_POOLS;

/* ── v16 game studio platform options ── */
DATA.GAME_PLATFORMS = [
  {id:"mobile",  name:"Mobile",  emoji:"📱", cost:8,  weeks:14, mult:0.9,  targetAud:"Casual & Microtransactions", desc:"Low dev cost, fast ship, steady ad/IAP revenue."},
  {id:"pc",      name:"PC",      emoji:"💻", cost:22, weeks:22, mult:1.35, targetAud:"Core & Modding Community",  desc:"Strong critical ceiling, digital sales, community hype."},
  {id:"console", name:"Console", emoji:"🎮", cost:45, weeks:32, mult:1.95, targetAud:"Mass AAA Market",          desc:"Massive launch momentum, physical/digital retail blockbuster."}
];

/* ── studio XP levels & progression ── */
DATA.STUDIO_XP_LEVELS = [
  {id:"indie",   name:"Indie Boutique", minRep:0,  maxRep:30, badge:"🌱 Indie",  color:"#6ee7b7"},
  {id:"growing", name:"Growing Label",  minRep:30, maxRep:55, badge:"🌿 Growing",color:"#93c5fd"},
  {id:"major",   name:"Major Studio",   minRep:55, maxRep:75, badge:"🏛 Major",  color:"#f5b942"},
  {id:"global",  name:"Global Conglom", minRep:75, maxRep:90, badge:"🌍 Global", color:"#c084fc"},
  {id:"empire",  name:"Media Empire",   minRep:90, maxRep:100,badge:"👑 Empire", color:"#fb7185"}
];

/* ── merchandise tier visual indicators ── */
DATA.MERCH_TIERS = [
  {tier:0, name:"None",             emoji:"⚪", icon:"🏷️", label:"No Merch"},
  {tier:1, name:"Novelty & Stickers",emoji:"🏷️", icon:"🏷️", label:"Tier 1: Stickers & Toys"},
  {tier:2, name:"Apparel Line",     emoji:"👕", icon:"👕", label:"Tier 2: Apparel & Posters"},
  {tier:3, name:"Retail Outlets",   emoji:"🏬", icon:"🏬", label:"Tier 3: Mall Boutiques"},
  {tier:4, name:"Global Brand",     emoji:"🏰", icon:"🏰", label:"Tier 4: Global Brand Empire"}
];

/* ── global trade tension stages ── */
DATA.TRADE_STAGES = [
  {stage:"peace",   name:"Open Trade",      emoji:"🕊️", penalty:0,    desc:"Free market access, regular foreign revenues."},
  {stage:"tension", name:"Tariff Tensions", emoji:"⚠️", penalty:0.08, desc:"Import inspection delays (−8% foreign gross)."},
  {stage:"war",     name:"Full Trade War",  emoji:"⚔️", penalty:0.22, desc:"Retaliatory quotas & freeze (−22% foreign gross)."}
];

/* ── v3 live sports packages ── */
DATA.SPORTS = [
  {id:"soccer", name:"Soccer League",   emoji:"⚽"},
  {id:"hoops",  name:"Hoops League",    emoji:"🏀"},
  {id:"racing", name:"Motorsport Tour", emoji:"🏎️"},
  {id:"fights", name:"Fight League",    emoji:"🥊"},
];

/* ── v3 IP market ── */
DATA.IPKINDS = [
  {id:"book",  name:"Bestselling novel",      emoji:"📖"},
  {id:"comic", name:"Comic book / graphic novel", emoji:"🦸"},
  {id:"true",  name:"True story rights",      emoji:"📰"},
  {id:"pd",    name:"Public-domain classic",  emoji:"🏛️"},
];
DATA.PD_TITLES = ["Hamlet","The Odyssey","Twenty Thousand Leagues","Pride & Prejudice","Moby-Dick","Dracula","The Jungle Book","War of the Worlds"];

/* ── Talent name pools ── */
DATA.FIRST_M = ["Jack","Elias","Roman","Kai","Dante","Micah","Orion","Caleb","Leon","Adrian","Marcus","Theo","Rhys","Julian","Cassius","Miles","Owen","Silas","Nico","Amir","Diego","Ravi","Kenji","Idris","Mateo","Finn","Xavier","Gideon","Ezra","Malik"];
DATA.FIRST_F = ["Ava","Nova","Seraphina","Maya","Juno","Isla","Celeste","Naomi","Priya","Zara","Elena","Freya","Amara","Lucia","Tessa","Rhea","Kira","Anika","Simone","Valentina","Odessa","Meera","Aiko","Camila","Sienna","Delphine","Imogen","Zoe","Nadia","Leah"];
DATA.LAST = ["Vance","Sterling","Marlowe","Castellano","Okafor","Lindqvist","Beaumont","Nakamura","Delacroix","Volkov","Ashford","Ramirez","Whitlock","Osei","Kapoor","Tanaka","Moreau","Sterling-Black","Halloran","Ferreira","Novak","Adeyemi","Kuznetsov","Petrov","Solemani","Draven","Winters","Marchetti","Okonkwo","St. Clair"];
DATA.DIR_FIRST = ["Vera","Greta","Deniz","Alejandro","Yuki","Farida","Caleb","Ines","Malik","Sofia","Anders","Leila","Tobias","Ren","Camille","Darius","Hana","Otto","Nadia","Emil"];
DATA.DIR_TRAITS = ["the visionary","the perfectionist","the provocateur","the craftsman","the poet","the showman","the iconoclast","the classicist"];

/* ── Title generators per genre ── */
DATA.TITLES = {
  action:   {a:["Iron","Crimson","Final","Steel","Savage","Last","Broken","Blood","Rogue","Zero"],b:["Protocol","Horizon","Reckoning","Vengeance","Directive","Sanction","Kingdom","Legacy","Impact","Line"],p:["The"]},
  scifi:    {a:["Neon","Stellar","Quantum","Silent","Orbital","Chrome","Event","Parallax","Void","Genesis"],b:["Horizon","Cascade","Protocol","Entity","Frontier","Signal","Apex","Drift","Codex","Rift"],p:["The","Beyond","After"]},
  fantasy:  {a:["The Ember","The Hollow","The Silver","The Ashen","The Verdant","The Shattered","The Gilded","The Crimson"],b:["Crown","Throne","Blade","Kingdom","Covenant","Sorrows","Road","Gates","Saga","Ring"]},
  animation:{a:["Pip","Bolt","Luna","Tiny","Migo","Rusty","Peanut","Zuzu","Gus","Beeboo"],b:["& the Great Beyond","Saves the World",": A Wild Tale","& the Lost City","'s Big Adventure","& Friends Forever",": Rise of the Fluff","& the Star Sea"]},
  comedy:   {a:["My Best Friend's","The Worst","Nobody Wants","Employee of","We Broke","Grandma's","Totally","How to Lose"],b:["Wedding","Vacation","Mascot","Christmas","Band","Boss","Roadtrip","Baby","Reunion","Hotline"]},
  horror:   {a:["The Whispering","Smile","The Long","Night of","The Hollow","Don't","The Attic","Crawl","They Follow","The Ritual"],b:["House","Lake","Dark","Night","Watchers","Breathe","Beneath","Doll","Hours","Mourning"]},
  thriller: {a:["The Silent","Gone","The Girl","No Way","Behind","The Inside","Cold","Safe","The Missing"],b:["Witness","Girl","From Home","Out","Closed Doors","Job","Case","Harbor","Place","Piece"]},
  drama:    {a:["The Weight","A Gentle","Fields of","The Last","Ordinary","Paper","Somebody's","The Long","Bitter"],b:["of Water","December","Grace","Goodbye","Men","Stars","Son","Way Home","Harvest","Symphony"]},
  romance:  {a:["Love &","The Summer","Letters to","Two Weeks","Almost","Meet Me","Every","Falling"],b:["Other Words","We Fell","Berlin","in Lisbon","Perfect","at Midnight","Little Lie","for You","Again"]},
  musical:  {a:["Sing!","The Rhythm","Dance","Voices","Encore","Beat","The Melody"],b:["Street","of the Night","Machine","Carry Us","& Encore","of the City","Club","Society"]},
  western:  {a:["The Dust","Red","The Last","Blood on the","Hard","The Pale","Six","Dry"],b:["Riders","Territory","Outlaw","Mesa","Country","Rider","Bullets","Creek","Frontier"],p:["The"]},
  war:      {a:["The Long","Iron","Cold","The Last","Silent","Broken","November","Ashes of"],b:["Retreat","Ridge","Convoy","Battalion","Harbor","Winter","Crossing","Sky","Front"],p:["The"]},
  sports:   {a:["The Underdogs","Final","Overtime","The Comeback","Ninety","Full","The Long"],b:["Season","Whistle","Round","Court","Minutes","Count","Shot","Run","Mile"]},
  concert:  {a:["Live at","One Night","The","Stadium","Unplugged:","Encore:","World Tour:"],b:["the Forum","Only","Farewell Tour","Lights","The Reunion","Midnight Set","Homecoming"]},
  truecrime:{a:["The","Case File:","The Vanishing of","Dial","The","Cold Case:","The Long"],b:["Confession","Room 12","Marisol Vega","M for Murder","Lakeside Killer","Silence","Investigation"]},
};
DATA.SHARED_TITLES = ["Echoes","The Long Goodbye","Midnight Sun","Paper Kingdoms","Glass Hearts","The Ninth Life","Sugar & Salt","Wildfire","The Understudy","Ghost Season"];

/* ── Series title bits ── */
DATA.SERIES_TITLES = {a:["North","Crown","Silent","Bright","Broken","Golden","Iron","Hidden","Crimson","Pale"],b:["Harbor","Street","Valley","Heights","Precinct","Shores","Files","County","Society","Sessions"]};

/* ── Spin-off / crossover bits ── */
DATA.SPINOFF_SUFFIX = ["Origins","Rising","Legacy","Protocol","Untamed","Chronicles","Reign","Reloaded"];

/* ── Concept blurbs (flavor for ideas) ── */
DATA.BLURBS = {
  action:["A retired stuntman takes one last job — and uncovers a cartel's ghost fleet.","After a heist goes wrong, five strangers must trust each other to survive one night in Lagos.","A bodyguard with nothing left protects the witness everyone wants dead."],
  scifi:["Humanity's first FTL crew wakes up 400 years off-course — Earth is silent.","A city where memories are traded like currency. One clerk keeps a forbidden recollection.","Terraformers on Mars find the soil is already claimed."],
  fantasy:["A blacksmith's apprentice forges a blade that remembers its previous owners.","Seven houses, one dying dragon, and a peace treaty written in blood.","The last librarian of a fallen kingdom discovers maps to living gods."],
  animation:["A stubborn little robot opens a bakery in a town that hates new things.","A yodeling yeti dreams of the opera stage.","Two rival garden gnomes must save the greenhouse from a heatwave."],
  comedy:["A destination wedding is hijacked by the bride's ex — who's now the officiant.","Three mismatched night-shift guards inherit a haunted discount store.","A family road trip goes viral for all the wrong reasons."],
  horror:["A sleep-study lab discovers something feeds on the fourth stage of dreams.","The new neighbors only come out during solar eclipses.","A deaf teenager realizes the entity haunting her house hunts by sound — and she's immune."],
  thriller:["A translator at a UN summit overhears a sentence that shouldn't exist.","A true-crime podcaster's new subject is her own brother.","Six witnesses. Six stories. Only one is lying — badly."],
  drama:["A jailed pianist gets one weekend of freedom to play for his dying mother.","Three generations of women run the last lighthouse on the coast.","A factory town's final shift, and the manager who must lay off everyone — including himself."],
  romance:["Two rival food-truck owners get stuck catering the same wedding.","A widowed beekeeper and a runaway violinist share a train across Eastern Europe.","A second-chance romance at a school reunion neither wanted to attend."],
  musical:["A shuttered theater puts on one final show with the neighborhood's misfits.","A rapper's detour into musical theater becomes the story of the block.","A once-famous dance crew reunites for a televised wedding."],
  western:["A widowed rancher rides three states to bury a man who wronged her.","The last marshal of a dying town makes one final, terrible bargain.","Two brothers on opposite sides of a range war meet at the same river crossing."],
  war:["A field surgeon's unit is cut off for eleven days behind the line.","A radio operator must relay orders she knows will kill her brother's battalion.","Three soldiers carry a wounded stranger across sixty miles of occupied country."],
  sports:["A disgraced coach takes over the worst youth team in the league.","A sprinter with one season left in her knees chases a record nobody believes in.","A small-town squad plays the national champions and refuses to lose politely."],
  concert:["Three sold-out nights, one farewell tour, and a band that hates each other.","A pop icon's stadium show, filmed the week her label dropped her.","A legendary reunion set, recorded in one take, in the rain."],
  truecrime:["Twelve tapes, one confession, and a detective who never believed it.","A cold case reopens when a podcast listener recognizes the wallpaper.","The dramatized story of the fraudster who bought an entire town."],
};

/* ── Studio upgrades (v7: tiered progression) ──
   Tiers gate by reputation so early game stays affordable and late game rewards growth.
   Effects are read by engine.js via G.upgrades[id]; unknown ids are harmless. */
DATA.UPGRADES = [
  /* Tier 1 — founding lot (rep 0+) */
  {id:"marketing", name:"Marketing Department",   icon:"📣", cost:60,  tier:1, cat:"Growth",    desc:"+10% hype on every release campaign."},
  {id:"agency",    name:"Talent Relations Office",icon:"🤝", cost:55,  tier:1, cat:"Production",desc:"Signing fees −15% on all talent deals."},
  {id:"legal",     name:"Legal & Contracts Desk", icon:"⚖️", cost:45,  tier:1, cat:"Finance",   desc:"Fewer contract disputes; renegotiations −20% pricier."},
  {id:"antipiracy",name:"Anti-Piracy Unit",       icon:"🛡", cost:50,  tier:1, cat:"Growth",    desc:"Piracy leaks bleed 60% less of your theatrical gross."},
  /* Tier 2 — established player (rep 35+) */
  {id:"vfx",       name:"VFX Division",           icon:"✨", cost:80,  tier:2, cat:"Production",desc:"Post costs −25%. Tentpole craft +3."},
  {id:"backlot",   name:"Studio Backlot",         icon:"🏗", cost:100, tier:2, cat:"Production",desc:"Shoot burn −12% on every production."},
  {id:"ottrel",    name:"Streaming Relations",    icon:"🛰", cost:70,  tier:2, cat:"Growth",    desc:"OTT offers +12%, better renewal odds."},
  {id:"ottalgo",   name:"SynthStream AI Recommender", icon:"🤖", cost:85, tier:2, cat:"Growth", desc:"Streamer subscriber ceiling +15% and platform churn −20%."},
  {id:"rd",        name:"R&D Lab",                icon:"🔬", cost:90,  tier:2, cat:"Production",desc:"+5% development-success chance on greenlit scripts."},
  /* Tier 3 — major studio (rep 55+) */
  {id:"distribution",name:"Distribution Network", icon:"🎟", cost:140, tier:3, cat:"Growth",    desc:"Wide-release openings +8%; fewer screens lost mid-run."},
  {id:"music",     name:"Music Publishing Arm",   icon:"🎵", cost:120, tier:3, cat:"Finance",   desc:"Soundtrack revenue +25% on every scored release."},
  {id:"globalcdn", name:"Global Streaming CDN",   icon:"📡", cost:135, tier:3, cat:"Growth",    desc:"International streaming license bids +18% and +2M streamer subs."},
  {id:"archive",   name:"Restoration Archive",    icon:"📚", cost:110, tier:3, cat:"Finance",   desc:"Library licensing value +15% forever."},
  /* Tier 4 — global conglomerate (rep 75+) */
  {id:"globalnet", name:"Global Distribution Net",icon:"🌐", cost:220, tier:4, cat:"Growth",    desc:"International grosses +10%; co-pro quota deals easier."},
  {id:"theme",     name:"Theme Park Division",    icon:"🎢", cost:260, tier:4, cat:"Empire",    desc:"Franchise park income +30% and parks pay back faster."},
  {id:"lotempire", name:"Backlot Mega-Complex",   icon:"🏟", cost:200, tier:4, cat:"Production",desc:"Shoot burn another −8%; reshoots half price."},
];
DATA.UPGRADE_TIERS = [
  {tier:1, name:"Founding Lot",      rep:0,  icon:"🌱"},
  {tier:2, name:"Established Player",rep:35, icon:"🏢"},
  {tier:3, name:"Major Studio",      rep:55, icon:"🎬"},
  {tier:4, name:"Global Conglomerate",rep:75,icon:"👑"},
];
DATA.upgradeTierMet = function(u){ const t=DATA.UPGRADE_TIERS.find(x=>x.tier===u.tier); return !t || (G.studio.rep>=t.rep); };

/* ── Executive hires (v2) ── */
DATA.EXECS = [
  {id:"cmo",  name:"Chief Marketing Officer", icon:"📣", cost:90,  blurb:"+12% hype on every release.", key:"cmo"},
  {id:"cast", name:"Head of Casting",         icon:"🤝", cost:70,  blurb:"−10% on all talent fees.", key:"cast"},
  {id:"cfo",  name:"Chief Financial Officer", icon:"💼", cost:110, blurb:"−30% interest on all debt.", key:"cfo"},
];

/* ── Shoot locations: filming rebate % off the shoot burn (v2) ──
   v5 tax credits: every jurisdiction now carries a per-picture CAP and an AUDIT risk
   (an audit claws back 40% of the rebates you banked on that film, plus a fine). */
DATA.LOCATIONS = [
  {id:"la",         name:"Los Angeles", flag:"🌴", rebate:0.00, cap:0,    audit:0,    treaty:false, blurb:"The home lot. No rebate, zero risk — and zero paperwork."},
  {id:"atlanta",    name:"Atlanta",     flag:"🍑", rebate:0.14, cap:30,   audit:0.03, treaty:false, blurb:"Georgia credit: 14% of shoot spend, capped at $30M per picture. Audits are rare and polite."},
  {id:"london",     name:"London",      flag:"🎡", rebate:0.18, cap:45,   audit:0.05, treaty:true,  blurb:"UK credit: 18% capped at $45M/picture. Treaty-eligible for co-productions; counts as EU-quota content."},
  {id:"newmexico",  name:"New Mexico",  flag:"🌵", rebate:0.20, cap:22,   audit:0.09, treaty:false, blurb:"Aggressive 20% credit, low $22M cap. Auditors have been paying extra attention lately."},
  {id:"toronto",    name:"Toronto",     flag:"🍁", rebate:0.13, cap:20,   audit:0.03, treaty:true,  blurb:"Canada: 13% capped at $20M/picture. Treaty-eligible (co-productions). Reliable paymaster."},
  {id:"queensland", name:"Queensland",  flag:"🦘", rebate:0.22, cap:35,   audit:0.15, treaty:true,  blurb:"Australia: the juiciest credit in the world (22%, $35M cap) — and the nosiest film office (15% audit odds)."},
];
DATA.location = (id)=> DATA.LOCATIONS.find(l=>l.id===id) || (id==="home"? DATA.LOCATIONS[0] : DATA.LOCATIONS[0]);

/* ── MPAA rating choice (v2): PG-13 for the masses vs R (critics like it darker) ── */
DATA.RATINGS = [
  {id:"PG-13", name:"PG-13", open:0.00,   critic:0,  mass:1.00, desc:"The masses. Wide, four-quadrant, safest opening."},
  {id:"R",     name:"R",     open:-0.12,  critic:5,  mass:0.94, desc:"Darker. −12% opening, critics like the edge."},
];
DATA.rating = (id)=> DATA.RATINGS.find(r=>r.id===id) || DATA.RATINGS[0];

/* ── Economy: yearly inflation compounding across the whole market (v3) ── */
DATA.INFLATION = 0.02;   // 2%/year

/* ── Live sports rights packages (v3) ── */
DATA.SPORTS = [
  {id:"soccer", name:"Premier Football League", icon:"⚽", blurb:"Global reach, weekend juggernaut."},
  {id:"hoops",  name:"National Basketball Circuit", icon:"🏀", blurb:"Year-round live appointment viewing."},
  {id:"racing", name:"Grand Prix Racing",        icon:"🏎️", blurb:"Season-long drama, big PPV bumps."},
  {id:"fights", name:"Combat Championship",      icon:"🥊", blurb:"Event-driven spikes, loyal PPV base."},
  /* v5: live events beyond stick-and-ball */
  {id:"wrestling", name:"Global Wrestling Circuit", icon:"🤼", blurb:"Weekly PPV spectacle — cheap to buy, rabid young fans, sticky subs." },
  {id:"esports",   name:"Championship Gaming League", icon:"🎮", blurb:"Sold-out arenas of streamers. Gen-Z subs in bulk, ceiling soars." },
];
DATA.sport = (id)=> DATA.SPORTS.find(s=>s.id===id);

/* ── Theatrical windows (v3): 17/45/90-day ── */
DATA.WINDOWS = [
  {id:"17", name:"Short (17-day)", days:17, pvod:1.15, exh:-8,  desc:"+15% PVOD, but angers exhibitors (openings swing ±5%)."},
  {id:"45", name:"Standard (45-day)", days:45, pvod:1.00, exh:0, desc:"The usual compromise."},
  {id:"90", name:"Long (90-day)",  days:90, pvod:0.85, exh:5,  desc:"−15% PVOD, exhibitors love the exclusivity."},
];
DATA.window = (id)=> DATA.WINDOWS.find(w=>w.id===id) || DATA.WINDOWS[1];

/* ── Random events (weekly pool) ── */
/* kinds: 'cash' instant | 'choice' modal (choices[{label,effect}]) — effects are fn(G) */
DATA.EVENTS = [
  {id:"trailer_viral", w:6, icon:"🔥", title:"Trailer goes viral!",
   text:"A leaked sizzle reel from one of your sets is blowing up online. Free buzz.",
   run(G){ const p=pick(G.projects.filter(x=>x.phase!=="done"))||pick(G.projects); if(!p)return; p.buzzBonus=(p.buzzBonus||0)+0.12; G.log("🔥 Viral buzz on “"+p.title+"” (+hype)","good"); }},
  {id:"tax_incentive", w:5, icon:"🧾", title:"Production incentive",
   text:"A filming rebate clears: you get 8% back on one in-production budget.",
   run(G){ const p=pick(G.projects.filter(x=>x.phase==="shoot"||x.phase==="post")); if(!p)return; const back=Math.round(p.budget*0.08); earn("incentives",back); G.log("🧾 Tax rebate: +$"+back+"M on “"+p.title+"”","good"); }},
  {id:"piracy", w:4, icon:"🏴‍☠️", title:"Piracy leak",
   text:"A CAM copy of one of your theatrical releases is everywhere. Some gross will bleed.",
   run(G){ const f=pick(G.films.filter(x=>x.inTheaters)); if(!f)return; f.piracyPenalty=(f.piracyPenalty||0)+0.06; G.log("🏴‍☠️ Piracy hit on “"+f.title+"” (−legs)","bad"); }},
  {id:"star_scandal", w:4, icon:"📰", title:"Star scandal", kind:"choice",
   text:(G)=>{const t=G.talent.find(t=>t.booked&&t.kind==="actor")||null; G._evtT=t; return t? t.name+" (power "+t.power+"★) is trending for all the wrong reasons — tabloid storm.":"(no cast available)";},
   when(G){ return G.talent.some(t=>t.booked&&t.kind==="actor"); },
   choices:(G)=>[
     {label:"Publicly back them (−$8M PR, keep talent)", run(G){G.studio.cash-=8; G.log("📰 You stood by your star","good");}},
     {label:"Distance the studio (rep +1, talent goes radioactive)", run(G){
        G.studio.rep=clamp(G.studio.rep+1,5,99);
        const t=G._evtT;
        if(t){ t.grudge=(t.grudge||0)+1; if(typeof scandalHit==="function") scandalHit(t); }
        G.log("📰 Statement issued. "+(t? t.name+" is radioactive for a while — and cheap.":"Talent noticed."),"bad");
     }},
   ]},
  {id:"strike", w:3, icon:"✊", title:"Crew strike threat",
   text:"Below-the-line crews are demanding better rates. Productions pause for 2 weeks unless you pay up.",
   when(G){ return G.projects.some(p=>p.phase==="shoot"); }, kind:"choice",
   choices:(G)=>[
     {label:"Pay crews +$6M (no delay)", run(G){spend("other",6); G.log("✊ Crews paid — no stoppage","good");}},
     {label:"Refuse (shoots pause 2 wks)", run(G){G.projects.filter(p=>p.phase==="shoot").forEach(p=>p.strikePause=2); G.log("✊ Strike! Shoots paused 2 weeks","bad");}},
   ]},
  {id:"stream_war", w:3, icon:"⚔️", title:"Streaming war heats up",
   text:"Two platforms are fighting over subscribers. Licensing offers spike +30% for 10 weeks.",
   run(G){ G.streamWar=10; G.log("⚔️ Streaming war! Offers +30% for 10 weeks","gold"); }},
  {id:"new_streamer", w:3, icon:"🛰", title:"Platform subscriber wars",
   text:"A rival is bankrolling a brand-new streaming service. One more bidder enters the market — for now.",
   when(G){ return (G.extraPlatforms||[]).length<2 && G.films.length>=1; },
   run(G){
     const used=DATA.allPlatforms().map(p=>p.name);
     const name=pick(DATA.NEWSTREAMERS.filter(n=>!used.includes(n))||["Apex+"]);
     const gen={ id:"new"+nid(), name, color:pick(["#22c55e","#f472b6","#38bdf8","#facc15","#a78bfa"]), logo:name[0],
       generosity:1.18, renew:55, taste:{}, blurb:"Fresh money. Hungry for content — pays a premium." };
     Object.keys(DATA.GENRES).forEach(k=>gen.taste[k]=0.95+rnd()*0.25);
     gen.taste.reality=1.0; gen.taste.documentary=1.0;
     G.extraPlatforms.push(gen);
     G.log("🛰 "+pick(G.rivals).name+" launches "+name+" — a new streamer enters the bidding wars!","gold");
   }},
  {id:"pandemic", w:2, icon:"🦠", title:"Theater capacity limits",
   text:"A health scare caps theater occupancy. Box office −45% for 8 weeks. (It happened before…)",
   run(G){ G.theaterCap=8; G.log("🦠 Theater caps! Box office −45% for 8 weeks","bad"); }},
  {id:"award_bump", w:4, icon:"🌟", title:"Catalog renaissance",
   text:"A critic's retrospective celebrates your library. Extra licensing income this week.",
   when(G){ return G.films.length>1; },
   run(G){ const bonus=Math.round(catalogValue()*0.03)+2; earn("library",bonus); G.log("🌟 Catalog licensing spike +$"+bonus+"M","good"); }},
  {id:"indie_fest", w:4, icon:"🎪", title:"Festival buzz",
   text:"An indie darling you flirted with wins a festival. You can lock their next project cheap.",
   when(G){ return true; }, kind:"choice",
   choices:(G)=>[
     {label:"Sign them (−$4M, new hot writer-director added)", run(G){spend("talent",4); spawnDirectorHot(); G.log("🎪 Hot new director joined the market","good");}},
     {label:"Pass", run(G){}},
   ]},
  {id:"investor", w:3, icon:"🕴", title:"Investor circles",
   text:"Private money offers $50M for a slice of future profits (pay back $70M over time).",
   when(G){ return true; }, kind:"choice",
   choices:(G)=>[
     {label:"Take the $50M", run(G){earn("financing",50); G.studio.investorDebt=(G.studio.investorDebt||0)+70; G.log("🕴 Investor cash +$50M (owe $70M)","good");}},
     {label:"Stay independent", run(G){G.log("🕴 You passed on outside money","");}},
   ]},
  {id:"toxic_tabloid", w:3, icon:"🗞", title:"Tabloid storm",
   text:"A loose-cannon star on your payroll is melting down in public. Openings suffer until it's handled.",
   when(G){ return G.talent.some(t=>t.kind==="actor"&&!t.toxic&&t.pics>0); }, kind:"choice",
   choices:(G)=>[
     {label:"Ignore it", run(G){ const t=G.talent.find(t=>t.kind==="actor"&&!t.toxic&&t.pics>0); if(t){t.toxic=true; G.log("🗞 "+t.name+" is now box-office poison (−7% openings until rehab)","bad");} }},
     {label:"Pay for PR containment (−$3M)", run(G){spend("other",3); G.log("🗞 Contained. For now.","");}},
   ]},
];

/* ── Award show name ── */
DATA.AWARDS = "The Golden Reel Awards";

/* ── Achievements (v2/v3: 15 of them) ── */
DATA.ACH = [
  {id:"green",     icon:"🎬", name:"Slate Starter",   desc:"Greenlight your first film",            check:G=>G.projects.length>0||G.stats.films>0},
  {id:"open100",   icon:"💥", name:"Century Club",    desc:"$100M+ opening weekend",                check:G=>G.stats.bestOpen>=100},
  {id:"hit",       icon:"🔥", name:"It's a Hit",      desc:"Land your first theatrical hit",        check:G=>G.stats.hits>=1},
  {id:"smash",     icon:"🌟", name:"Smash Maker",     desc:"A film grosses 1.6× breakeven",         check:G=>G.films.some(f=>f.ww&&f.ww>=breakevenWW(f)*1.6)},
  {id:"franchise", icon:"🏰", name:"Franchise Born",  desc:"Unlock your first franchise",           check:G=>G.franchises.length>=1},
  {id:"empire",    icon:"🎡", name:"Empire Builder",  desc:"Merch + theme park on one franchise",   check:G=>G.franchises.some(f=>f.merch>=1&&f.park>=1)},
  {id:"award",     icon:"🏆", name:"Best Picture",    desc:"Win Best Picture at the Golden Reels",  check:G=>(G.stats.awards||[]).some(a=>a.cat==="Best Picture")},
  {id:"stream5",   icon:"📺", name:"Streaming Machine",desc:"Sell 5 films to streamers",            check:G=>G.films.filter(f=>f.soldTo||f.streamingOriginal).length>=5},
  {id:"billion",   icon:"💵", name:"Billion-Grosser", desc:"$1B all-time worldwide gross",          check:G=>G.stats.totalWW>=1000},
  {id:"watercool", icon:"📡", name:"Watercooler",     desc:"A season posts 75+ buzz",               check:G=>G.series.some(s=>s.seasons.some(x=>x.viewership>=75))},
  {id:"subs25",    icon:"🛰", name:"25M Club",        desc:"25M subscribers on your own streamer",  check:G=>!!(G.streamer&&G.streamer.subs>=25)},
  {id:"ipo",       icon:"🔔", name:"Going Public",    desc:"Ring the bell — complete an IPO",       check:G=>!!G.ipo},
  {id:"year3",     icon:"⏳", name:"Survivor",        desc:"Reach Year 3",                          check:G=>yearOf(G.week)>=3},
  {id:"warchest",  icon:"🏦", name:"War Chest",       desc:"$500M cash with no debt",               check:G=>G.studio.cash>=500&&G.studio.debt<=0.5},
   {id:"fullslate", icon:"🖐", name:"Full Slate",      desc:"5 of your films in theaters same week", check:G=>G.films.filter(f=>f.inTheaters).length>=5},
   /* ── v27 RPG + game dev achievements ── */
   {id:"level10",   icon:"⭐", name:"A-List Evolution", desc:"Raise a talent to Level 10",           check:G=>(G.talent||[]).some(t=>t.prototype&&t.prototype.level>=10)},
   {id:"games3",    icon:"🕹", name:"Triple Play",      desc:"Launch 3 in-house games",              check:G=>((G.prototypeData||{}).releasedGames||[]).length>=3},
   {id:"mentor",    icon:"🧑‍🏫", name:"Passing the Torch", desc:"Run an active mentorship",            check:G=>(G.talent||[]).some(t=>t.prototype&&t.prototype.mentor)},
   {id:"slots4",    icon:"🎒", name:"Fully Kitted",     desc:"All 4 equipment slots filled on one talent", check:G=>(G.talent||[]).some(t=>t.prototype&&t.prototype.equipment&&Object.values(t.prototype.equipment).every(Boolean))},
   {id:"genres7",   icon:"🧭", name:"Genre Explorer",   desc:"Launch in-house games in 4 different genres", check:G=>new Set(((G.prototypeData||{}).releasedGames||[]).map(g=>g.genre)).size>=4},
   {id:"influence", icon:"🌐", name:"Power Broker",     desc:"Bank 50 influence",                    check:G=>(G.studio||{}).influence>=50},
   {id:"guilded",   icon:"🤝", name:"Union Made",       desc:"3 talents in their guilds",            check:G=>(G.talent||[]).filter(t=>t.prototype&&t.prototype.guild).length>=3},
   {id:"liveops",   icon:"🔧", name:"Games as a Service", desc:"Run 3 live-ops events on one game",  check:G=>((G.prototypeData||{}).releasedGames||[]).some(g=>(g.liveOps||[]).length>=3)}
 ];

/* ── Fictional "real world" flavor news (rival headlines) ── */
DATA.FLAVOR = [
  "Apex announces a shared universe of shared universes.",
  "Lantern & Co's latest sweeps the festival circuit.",
  "Nimbus greenlights three sequels and a reboot.",
  "Exhibitors complain about shrinking theatrical windows.",
  "StreamFlix posts record subscriber growth.",
  "Analysts warn the mid-budget theatrical film is 'endangered'.",
  "MoviePass 2.0 shuts down after 6 weeks.",
  "A24-style marketing becomes the new textbook case.",
];

/* ═══════════════════════════════════════════════════════════
   v4 — WRITERS & PRODUCERS · GENRE CYCLES · NAMED CRITICS ·
        TALENT CAREERS · FRANCHISE FATIGUE · STOCK & TIERS
   ═══════════════════════════════════════════════════════════ */

/* ── Save schema version (see migrateSave in engine.js) ── */
DATA.SAVE_VERSION = 4;

/* ── Writer & producer flavor ── */
DATA.WRITER_TRAITS  = ["the structuralist","the dialogue surgeon","the world-builder","the punch-up king",
                       "the character miner","the twist merchant","the wounded romantic","the joke machine"];
DATA.PROD_TRAITS    = ["the fixer","the line-item hawk","the schedule tyrant","the union whisperer",
                       "the logistics savant","the crisis manager","the deal closer","the set diplomat"];
DATA.PROD_FIRST     = ["Marla","Desmond","Hattie","Bruno","Yolanda","Peter","Ines","Gus","Ada","Toshiro",
                       "Bev","Reggie","Sunita","Colm","Margit","Ozzy","Lena","Hank"];

/* ── Named critics (v4): each has an outlet, harshness and genre bias ── */
DATA.CRITICS = [
  {id:"holloway", name:"Ruth Holloway",  outlet:"The Ledger",      harsh:+6, loves:["drama","war","western"],           hates:["horror","concert"]},
  {id:"okonjo",   name:"Femi Okonjo",    outlet:"Reel Culture",    harsh:-2, loves:["action","scifi","sports"],         hates:["musical"]},
  {id:"varga",    name:"Petra Varga",    outlet:"Cine Quarterly",  harsh:+9, loves:["drama","thriller","truecrime"],    hates:["animation","comedy"]},
  {id:"delaney",  name:"Sean Delaney",   outlet:"The Marquee",     harsh:-4, loves:["comedy","romance","concert"],      hates:["war"]},
  {id:"ishida",   name:"Kaori Ishida",   outlet:"Frame By Frame",  harsh:+2, loves:["animation","fantasy","musical"],   hates:["truecrime"]},
  {id:"brooks",   name:"Dante Brooks",   outlet:"Popcorn Report",  harsh:-7, loves:["horror","action","sports"],        hates:["drama"]},
  {id:"lindgren", name:"Astrid Lindgren",outlet:"Northern Screen",  harsh:+4, loves:["scifi","thriller","western"],      hates:["romance"]},
  {id:"mercado",  name:"Julio Mercado",  outlet:"Butaca",          harsh:0,  loves:["romance","musical","truecrime"],   hates:["scifi"]},
];
DATA.CRITIC_QUOTES = {
  rave:  ["a triumph of pure cinema.","the year's most alive picture.","hands you your heart back, bruised.",
          "big, brave and beautifully made.","the rare crowd-pleaser with a soul."],
  good:  ["confident, generous filmmaking.","works far better than it should.","sturdy, satisfying craft.",
          "a couple of scenes will follow you home."],
  mixed: ["handsome, hollow, harmless.","half a great film, twice too long.","competent and completely weightless.",
          "keeps promising a movie it never makes."],
  bad:   ["an expensive shrug.","loud, lazy and endless.","a rough week for everyone involved.",
          "the algorithm dreamed this and no one woke up."],
};

/* ── Genre trends / market cycles (v4) ──
   Each genre carries a heat value that drifts every quarter.
   heat ≈ 1.0 neutral · >1.10 hot · <0.90 cooling. It multiplies opening weekend and OTT appetite. */
DATA.TREND = {
  min: 0.78, max: 1.28, drift: 0.10, revertPull: 0.18, shiftWeeks: 13,
  labels: [
    {at:1.18, tag:"🔥 red hot",  cls:"green"},
    {at:1.07, tag:"📈 rising",   cls:"gold"},
    {at:0.94, tag:"➖ steady",   cls:""},
    {at:0.85, tag:"📉 cooling",  cls:"red"},
    {at:0.00, tag:"🥶 ice cold", cls:"red"},
  ],
  headlines: {
    hot:  ["{g} is the hottest thing in town — every studio wants one.",
           "Analysts: the {g} boom shows no sign of slowing.",
           "A surprise {g} smash has buyers scrambling for scripts."],
    cold: ["Buyers say the {g} bubble has burst.",
           "Exhibitors report {g} fatigue at the multiplex.",
           "Three {g} flops in a row have the town spooked."],
  },
};

/* ── Franchise fatigue (v4): milk a brand and audiences check out ── */
DATA.FATIGUE = {
  perEntry: 0.14,        // fatigue added per franchise entry released
  recentWindow: 78,      // weeks — entries inside this window hurt most
  recoverPerWeek: 0.004, // rest the brand and it heals
  max: 0.62,             // caps the opening penalty
  qualityHit: 10,        // max quality points lost at full fatigue
};

/* ── Talent careers (v4): ages, retirement, scandal, comeback ── */
DATA.CAREER = {
  minAge: 22, maxStartAge: 58,
  retireFrom: 59,           // retirement rolls start here
  retireChancePerYear: 0.26,
  primeLow: 30, primeHigh: 48,
  scandalCooldown: 40,      // weeks radioactive
};

/* ── Streamer tiers (v4): ad-supported vs premium ── */
DATA.TIERS = [
  {id:"premium", name:"Premium only",  arpu:0.50, ceil:1.00, churn:0.008, cost:0,
   desc:"One clean ad-free tier. Highest revenue per sub, smallest addressable market."},
  {id:"ads",     name:"Ad tier + premium", arpu:0.38, ceil:1.32, churn:0.006, cost:60,
   desc:"Cheap ad-supported tier: −24% revenue per sub, but +32% ceiling and stickier subs. $60M to build ad tech."},
];
DATA.tier = (id)=> DATA.TIERS.find(t=>t.id===id) || DATA.TIERS[0];

/* ── Public markets (v4): stock price, earnings calls, analysts ── */
DATA.MARKET = {
  ipoPrice: 20, shares: 40,      // 40M shares × $20 = $800M cap at IPO
  callWeeks: [13,26,39,52],
  driftPerNetM: 0.011,           // $ per share per $M weekly net
  repInfluence: 0.004,
  analysts: ["Kestrel Capital","Ridgeline Partners","Vontier Research","Harbourstone","Blue Axis Equity"],
};

/* ── v4 random events (appended to the weekly pool) ── */
DATA.EVENTS.push(
  {id:"review_bomb", w:4, icon:"🍅", title:"Review bombing", kind:"choice",
   text:(G)=>{ const f=pick(G.films.filter(x=>x.inTheaters)); G._evtF=f;
      return f? ("An organised pile-on is tanking the audience score of “"+f.title+"” — bots, brigades, the lot. Counter it or ride it out?")
              : "An organised pile-on is tanking one of your releases."; },
   when(G){ return G.films.some(f=>f.inTheaters); },
   choices:(G)=>[
     {label:"Fan-activation counter-campaign (−$4M, halve the damage)", run(G){
        const f=G._evtF; if(!f) return; spend("marketing",4);
        const hit=Math.round(rint(8,20)/2);
        f.quality.aud=clamp(f.quality.aud-hit,5,99); f.reviewBombed=(f.reviewBombed||0)+hit; f.piracyPenalty=(f.piracyPenalty||0)+0.01;
        f.bombCountered=true;
        G.log("🍿 Your fans mobilised — “"+f.title+"” took a reduced hit ("+("−"+hit)+" audience).","good");
     }},
     {label:"Ride it out (full pile-on)", run(G){
        const f=G._evtF; if(!f) return;
        const hit=rint(8,20);
        f.quality.aud=clamp(f.quality.aud-hit,5,99); f.reviewBombed=(f.reviewBombed||0)+hit; f.piracyPenalty=(f.piracyPenalty||0)+0.02;
        G.log("🍅 Review bombing hits “"+f.title+"” — audience score −"+hit+".","bad");
     }},
   ]},
  {id:"awards_campaign", w:3, icon:"🏆", title:"Awards campaign", kind:"choice",
   text:"Your consultants want a full-blown Golden Reel campaign for your best-reviewed film of the year.",
   when(G){ return G.films.some(f=>f.year===yearOfW(G.week) && f.quality && f.quality.critic>=70); },
   choices:(G)=>[
     {label:"Fund the campaign (−$14M, prestige +)", run(G){
        const pool=G.films.filter(f=>f.year===yearOfW(G.week)&&f.quality&&f.quality.critic>=70)
                          .sort((a,b)=>b.quality.critic-a.quality.critic);
        spend("marketing",14);
        if(pool[0]){ pool[0].campaign=(pool[0].campaign||0)+8; G.log("🏆 Awards campaign launched for “"+pool[0].title+"”.","gold"); }
     }},
     {label:"Skip it — save the money", run(G){ G.log("🏆 You skipped awards season. Bold.",""); }},
   ]},
  {id:"password_crackdown", w:3, icon:"🔐", title:"Password sharing crackdown", kind:"choice",
   text:"Your platform's data team says a third of households are sharing logins. Crack down?",
   when(G){ return !!G.streamer && G.streamer.subs>4; },
   choices:(G)=>[
     {label:"Crack down (+subs now, churn spikes 12 wks)", run(G){
        const bump=Math.round(G.streamer.subs*0.16*100)/100;
        G.streamer.subs=Math.round((G.streamer.subs+bump)*100)/100;
        G.streamer.crackdown=12;
        G.log("🔐 Crackdown: +"+bump+"M paid accounts, but churn doubles for 12 weeks.","gold");
     }},
     {label:"Leave it alone", run(G){ G.log("🔐 You let the freeloaders stream in peace.",""); }},
   ]},
  {id:"writer_room", w:4, icon:"✍️", title:"Spec script bidding war", kind:"choice",
   text:"A red-hot spec is going out wide tomorrow morning. Pre-empt it?",
   choices:(G)=>[
     {label:"Pre-empt (−$6M, hot script + hot writer)", run(G){
        spend("development",6);
        if(typeof spawnWriterHot==="function") spawnWriterHot();
        if(G.ideas){ const i=genIdea(); i.hot=true; i.script=clamp(i.script+10,60,96); G.ideas.push(i); }
        G.log("✍️ You pre-empted the town's hottest spec.","good");
     }},
     {label:"Let it go wide", run(G){ G.log("✍️ A rival pre-empted the spec.",""); }},
   ]},
  {id:"comeback", w:3, icon:"🎭", title:"Comeback offer", kind:"choice",
   text:"A once-huge star, currently radioactive, wants a comeback vehicle with you — cheap.",
   when(G){ return G.talent.some(t=>t.scandal>0 && t.power>=3); },
   choices:(G)=>[
     {label:"Rehabilitate them (−$3M PR, scandal cleared)", run(G){
        const t=pick(G.talent.filter(x=>x.scandal>0&&x.power>=3)); if(!t) return;
        spend("talent",3); t.scandal=0; t.heat=Math.min(3,(t.heat||0)+1); t.comeback=true;
        G.log("🎭 Comeback arc: "+t.name+" is back in business with you.","gold");
     }},
     {label:"Not our problem", run(G){ G.log("🎭 You passed on the comeback story.",""); }},
   ]},
  {id:"cofinance", w:4, icon:"🤝", title:"Co-financing offer", kind:"choice",
   text:"A finance partner offers to cover 30% of one production in exchange for 35% of its upside.",
   when(G){ return G.projects.some(p=>p.phase==="pre"||p.phase==="shoot"); },
   choices:(G)=>[
     {label:"Take the partner (cash now, share the upside)", run(G){
        const p=pick(G.projects.filter(x=>x.phase==="pre"||x.phase==="shoot")); if(!p) return;
        const cash=Math.round(p.budget*0.30);
        earn("financing",cash); p.coFinance=0.35;
        G.log("🤝 Co-financing on “"+p.title+"”: +"+fmtM(cash)+" now, partner keeps 35% of net.","good");
     }},
     {label:"Keep 100%", run(G){ G.log("🤝 You kept the whole picture.",""); }},
   ]}
);

/* helper used by v4 events before engine.js loads its own yearOf */
function yearOfW(w){ return Math.floor((w-1)/52)+1; }

/* ═══════════════════════════════════════════════════════════
   v5 — AI & SYNTHETIC MEDIA · GLOBAL MARKETS · CO-PRODUCTIONS
        TALENT AGENCIES · AWARDS/PRECURSORS · MARKETING ·
        PIRACY · MERCH/PARKS DEPTH · M&A · TAX CREDITS v2 ·
        UNION NEGOTIATIONS · WAGE INFLATION · TUTORIAL
   ═══════════════════════════════════════════════════════════ */

/* ── Save schema v8 (see migrateSave step 8 in engine.js) ── */
DATA.SAVE_VERSION = 8;

/* ── Talent agencies (v5): WME/CAA-style shops with rosters ──
   Every piece of talent is repped by one of these. Casting 2+ clients
   of the same agency in one picture triggers a PACKAGING FEE.
   An exclusive deal with an agency waives their packaging fee and
   cuts their clients' quotes — until a poaching war heats up. */
DATA.AGENCIES = [
  {id:"meridian", name:"Meridian Talent Group", icon:"🌐", fee:0.04, blurb:"The biggest book in town. Package two of their clients in one film and they bill you a 4% packaging fee.", dealCost:30, dealWeeks:104, disc:0.15},
  {id:"crown",    name:"Crown Artists",         icon:"👑", fee:0.05, blurb:"Prestige-leaning roster: stars who win things and know it. 5% packaging fee on stacked casts.", dealCost:36, dealWeeks:104, disc:0.18},
  {id:"sterling", name:"Sterling Bureau",       icon:"💼", fee:0.03, blurb:"Scrappy volume house. Cheap packaging (3%), thinner top end.", dealCost:22, dealWeeks:104, disc:0.12},
];
DATA.agency = (id)=> DATA.AGENCIES.find(a=>a.id===id) || null;

/* ── AI & synthetic media (v5) ──
   aiCast  : licensed digital doubles replace the lead cast — zero cast fees,
             but audiences smell it (audience −, weak opening mass), guilds fume.
   aiScript: SynthScribe writes overnight — free writer, flat mediocre page.
   AI productions roll the backlash dice weekly and can trigger audience revolt. */
DATA.AI = {
  castSkill: 58,           // the synthetic ensemble never quite acts human
  castPower: 1,            // no star power to open on
  audPenalty: 9,           // audience score hit for a fully synthetic cast
  scriptScore: 56,         // SynthScribe's page quality
  scrQualityPenalty: 4,    // overall craft ding
  unionKick: 9,            // union-meter bump per AI production greenlit
  backlashWeekly: 0.018,   // weekly odds per AI-flagged project in production
};
DATA.AI_RUNTIME = { deepfakePicks: 4 }; // clip count in the detection mini-game

/* ── Global markets (v5) ── */
DATA.GLOBAL = {
  china: {
    quotaName: "The 34-slot import quota",
    basePass: 0.55,                // base odds your import wins a slot
    repPerSlot: 0.003,             // reputation helps the ministry like you
    rPenalty: 0.18,                // R-rated imports struggle at the censor board
    horrorPenalty: 0.28,           // horror effectively can't pass
    kidFriendly: 0.08,             // animation/family genres are favoured
    recutCost: 3,                  // pay to recut and re-submit
  },
  eu: { quota: 0.30, fine: 5, freezeWeeks: 4, bonusSubs: 0.6 }, // streamer must carry ≥30% European-works
  india: { // genres that over-index in Indian theatrical (added to intl share)
    musical:+0.05, romance:+0.04, action:+0.03, drama:+0.02, sports:+0.03, fantasy:+0.02,
  },
};

/* ── Awards overhaul (v5): precursor shows + campaign budgets + Oscar bump ── */
DATA.PRECURSORS = [
  {woy:46, name:"Critics Circle Prize",  emoji:"🗞", boost:6, cash:2},
  {woy:49, name:"Industry Guild Awards", emoji:"🤝", boost:8, cash:3},
];
DATA.OSCAR_BUMP  = 0.25; // Best Picture win adds a re-release bump worth +25% of its P&A
DATA.ACTING_BUMP = 0.08; // acting/directing win nudges the same picture too

/* ── Marketing campaign boosts (v5), chosen when you date the release ── */
DATA.MKT_BOOSTS = [
  {id:"superbowl", icon:"🏈", name:"Super Bowl spot", cost:7, open:1.08,
   desc:"$7M for 30 seconds in the Big Game. +8% opening hype."},
  {id:"influencer", icon:"🤳", name:"Influencer junket", cost:2.5, open:1.04, buzz:0.04,
   desc:"Fly 40 creators through Vegas. +4% opening, +4% buzz. Gen-Z does the rest."},
  {id:"embargo", icon:"🤐", name:"Review embargo", cost:1, open:1.03,
   desc:"Hold reviews until opening Friday. +3% opening — but if critics hate it anyway, the audience backlash bites your legs."},
];
DATA.mktBoost = (id)=> DATA.MKT_BOOSTS.find(m=>m.id===id) || null;

/* ── Piracy & windowing (v5) ── */
DATA.PIRACY = {
  start: 18, drift: 0.35,        // meter drifts up weekly
  decayWithUpgrade: 1.0,         // anti-piracy task force drains this much extra/wk
  window90: -4,                  // each 90-day-window release washes the meter down
  window17: +3,                  // each 17-day-window release feeds the torrents
  dayAndDate: +6,                // day-and-date is pirate Christmas
  leakDivisor: 55,               // meter % → event severity
  maxGrossDamage: 0.10,          // at meter 100, live films lose 10% of weekly gross
};

/* ── Merch & parks depth (v5) ── */
DATA.MERCH_V2 = {
  toyCost: (tier)=> 25 + tier*10,        // one-off toy-line licensing deal
  toyMult: 1.30,                         // permanent merch income boost
  holidayMonths: ["Nov","Dec"],          // holiday toy spike…
  holidayMult: 1.6,
  parkSummer: ["Jun","Jul","Aug"],       // park summer-season spike
  parkSummerMult: 1.25,
};

/* ── M&A desk (v5): rotating acquisition offers each quarter ── */
DATA.MA = {
  library:   { name:"Indie library bundle", icon:"📚", costMin:45, costMax:95,  catalogEach:42, blurb:"A boutique distributor's back catalogue — permanent catalog value + weekly royalty flow." },
  ministream:{ name:"Mini-streamer",        icon:"📱", costMin:160, costMax:230, subs:6, power:2, blurb:"A niche service with loyal subs. Buy it, fold it in: +6M subscribers, ceiling perks." },
  rivalslate:{ name:"Rival slate firesale", icon:"🎞", costMin:60, costMax:130, films:2, blurb:"A distressed rival sells off two finished films. You distribute them and keep the rentals." },
};

/* ── Union negotiations (v5): guild relations meter ── */
DATA.UNION = {
  start: 25, drift: 0.22,        // weekly upward pressure as the town talks wages
  aiKick: 9,                     // per AI production greenlit
  refuseStrike: +18,             // hardball at the picket line
  concede: -28,                  // a generous contract settles everyone down
  settle: -12,
  negotiationWoy: 30,            // the Summer of Demands — every year, week 30
  strikeAt: 75,                  // past this, a general strike fires
  strikePause: 3,                // weeks all shoots stop
};

/* ── Wage inflation (v5): talent quotes compound faster than the market ── */
DATA.WAGE_INFLATION = 0.03; // 3%/yr, on top of the 2% general inflation

/* ── Festival flavour (v5) ── */
DATA.FESTIVAL_FOREIGN_BONUS = 0.08; // foreign-language films travel well on the circuit

/* ── Interactive 5-week tutorial (v5) ── */
DATA.TUT_STEPS = [
  {icon:"🎬", title:"Welcome to the business", until:"wizard",
   text:"You've got a studio name, a little cash and zero films. Hit 📝 Develop and open a script from the script market."},
  {icon:"✍️", title:"Attach the package", until:"greenlit",
   text:"Pick a writer (lifts the script), a director (shapes the film) and stars (open the weekend) — a producer protects your budget during the shoot. Set a sane budget and 🎥 Greenlight."},
  {icon:"🔥", title:"Now it cooks", until:"ready",
   text:"Production burns cash weekly through pre → shoot → post. Hit ▶ Next Week (or ⏩×4) and watch the pipeline in 🎬 Productions."},
  {icon:"📅", title:"Date it like a pro", until:"dated",
   text:"Your film is in the can! In Productions tap Theatrical Release, set your P&A, and pick a clean weekend — summer and the holidays open bigger; rival tentpoles split the audience."},
  {icon:"📊", title:"Cash the receipts", until:"released",
   text:"Rentals (~53% of domestic gross) arrive every week it plays. Track it in 📊 Box Office and read the itemized P&L in 💼 Finance. Cash beats everything."},
  {icon:"📊", title:"Level up your people", until:"rpg_sheet",
   text:"Every talent is an RPG character now. Open a 📊 RPG sheet on the Develop tab — spend skill points, gear up, and watch XP flow from every release."},
  {icon:"🎮", title:"Games beyond adaptations", until:"game_gdd",
   text:"At rep 40 & $250M cash the games tab unlocks In-House Originals — write a GDD (genre × platform × theme × model) and ship your own IP."}
];
DATA.TUT_REWARD = { rep:1, text:"🎓 Tutorial complete — +1 rep. Now go build an empire." };

/* ── v5 achievements join the main list (unified with the v4 meta set) ── */
DATA.ACH.push(
  {id:"open200",   icon:"🚀", name:"Double Century",   desc:"$200M+ opening weekend",                  check:G=>G.stats.bestOpen>=200},
  {id:"subs50",    icon:"🛰", name:"Satellite Empire", desc:"50M subscribers on your own streamer",    check:G=>!!(G.streamer&&G.streamer.subs>=50)},
  {id:"ten",       icon:"🎞", name:"Slate Machine",    desc:"Release ten films",                       check:G=>G.stats.films>=10},
  {id:"ww5b",      icon:"💵", name:"Five Billion Club",desc:"Cross $5B in all-time worldwide gross",   check:G=>G.stats.totalWW>=5000},
  {id:"saga",      icon:"🏰", name:"Saga Builder",     desc:"Grow a franchise to tier 4",              check:G=>G.franchises.some(fr=>fr.tier>=4)},
  {id:"acclaim",   icon:"🍅", name:"Critical Darling", desc:"Land a 90+ critics' consensus",           check:G=>G.films.some(f=>f.criticAvg>=90)},
  {id:"redemption",icon:"🎭", name:"Second Act",       desc:"Bankroll a scandal-hit star's comeback",  check:G=>G.talent.some(t=>t.comeback)},
  {id:"range",     icon:"🎪", name:"Genre Omnivore",   desc:"Release five films across the v4 genres", check:G=>G.films.filter(f=>f.genre==="concert"||f.genre==="truecrime"||f.genre==="western"||f.genre==="war"||f.genre==="sports").length>=5},
  {id:"launch",    icon:"📱", name:"Streamer Barons",  desc:"Launch your own streaming platform",      check:G=>!!G.streamer},
  {id:"stock3x",   icon:"📈", name:"Triple Bagger",    desc:"Triple your share price after the IPO",   check:G=>!!(G.public&&G.public.price>=DATA.MARKET.ipoPrice*3)},
  {id:"sports",    icon:"🏟", name:"Live & Buzzing",   desc:"Win a live sports rights package",        check:G=>(((G.sportsWon||[]).length)+((G.mySports||[]).length))>=1},
  /* v5 originals */
  {id:"aifilm",    icon:"🤖", name:"Synthetic Dreams", desc:"Greenlight a fully AI-assisted production", check:G=>(G.projects||[]).concat(G.films||[]).some(p=>p.aiCast||p.aiScript)},
  {id:"globalite", icon:"🌍", name:"Location Scout",   desc:"Shoot films in 3 different jurisdictions", check:G=>{ const s=new Set((G.projects||[]).concat(G.films||[]).map(p=>p.location||"la")); return s.size>=3; }},
  {id:"merchmogul",icon:"🧸", name:"Merch Mogul",      desc:"Build a tier-3 consumer-products empire",  check:G=>G.franchises.some(f=>f.merch>=3)},
  {id:"dealmaker", icon:"🤝", name:"The Dealmaker",    desc:"Close 3 M&A acquisitions",                 check:G=>((G.maDeals||[]).length>=3)},
  {id:"peacemaker",icon:"🕊", name:"Guild Diplomat",   desc:"Sign 2 guild contracts without a strike",  check:G=>!!(G.unionStats&&G.unionStats.signed>=2)},
  {id:"precursor", icon:"🗳", name:"Season Player",    desc:"Win 3 precursor awards in a single season",check:G=>!!(G.precursorWins&&G.precursorWins.count>=3)},
);


/* ── Co-production partners (v5): split budget & risk with a rival or foreign studio ──
   pct   : fraction of the budget they wire you at greenlight
   share : fraction of NET profit they keep forever (yes, it's steep — that's the business)
   foreign partners unlock treaty bonuses when you shoot in a treaty jurisdiction */
DATA.COPROD_PARTNERS = [
  {id:"none",      name:"Go it alone",                icon:"🎬", pct:0,    share:0,    foreign:false, blurb:"You keep every risk and every dollar."},
  {id:"apex",      name:"Apex Pictures (rival)",      icon:"🏔", pct:0.40, share:0.45, foreign:false, blurb:"Your tentpole rival splits the risk: they wire 40% of budget and keep 45% of net. Co-opetition, Hollywood style."},
  {id:"kyoto",     name:"Kyōto Film Partners",        icon:"⛩️", pct:0.50, share:0.50, foreign:true,  blurb:"Foreign studio money: half the budget covered, half the net surrendered. Treaty jurisdiction +30% rebates, +prestige."},
  {id:"europa",    name:"Europa Film Alliance",       icon:"🎞", pct:0.35, share:0.38, foreign:true,  blurb:"European co-pro with softer terms — pair with London/Toronto/Queensland for treaty bonuses."},
];

/* ── v5 random events (appended to the weekly pool) ── */
DATA.EVENTS.push(
  /* AI backlash — the town turns on synthetic productions */
  {id:"ai_backlash", w:5, icon:"🤖", title:"Synthespian backlash", kind:"choice",
   text:"Clips of your AI-generated production have the internet furious: 'uncanny', 'soulless', '#NotMyMeryl' is trending. The guilds are watching how you respond.",
   when(G){ return (G.projects||[]).concat(G.films||[]).some(p=>p.aiCast||p.aiScript); },
   choices:(G)=>[
     {label:"Pledge human-first creativity (rep +1, guilds calm down)", run(G){
        G.studio.rep=Math.min(99, G.studio.rep+1);
        if(typeof unionAdjust==="function") unionAdjust(-8,"human-first pledge");
        G.log("🤖 You pledged human-led creativity. The trades approve; #NotMyMeryl dies down.","good");
     }},
     {label:"Double down on the tech (audience goodwill −, guilds heat up)", run(G){
        (G.films||[]).forEach(f=>{ if(f.aiCast||f.aiScript){ f.quality.aud=Math.max(5,f.quality.aud-7); f.piracyPenalty=(f.piracyPenalty||0)+0.02; }});
        if(typeof unionAdjust==="function") unionAdjust(+10,"doubled down on AI");
        G.studio.rep=Math.max(5, G.studio.rep-2);
        G.log("🤖 You told the internet it's the future. The internet disagreed — audience scores on your synthetic slate dropped.","bad");
     }},
   ]},
  /* Deepfake leak → the detection mini-game (player hunts the fake frame) */
  {id:"deepfake_leak", w:4, icon:"🧬", title:"Deepfake clip circulating", kind:"choice",
   text:(G)=>{ const t=(G.talent||[]).filter(x=>x.kind==="actor"&&x.power>=3); G._evtT=t.length?pick(t):null;
      return G._evtT? ("A convincing fake video of "+G._evtT.name+" is everywhere — endorsing things, saying worse. Your crisis team pulled four frames from the feed; one carries the deepfake's tell.")
                    : "A convincing fake clip of one of your stars is everywhere."; },
   when(G){ return G.talent.some(t=>t.kind==="actor"&&t.power>=3); },
   choices:(G)=>[
     {label:"Run the deepfake-detection drill (mini-game)", run(G){
        G.pendingDeepfake = { talentId: G._evtT? G._evtT.id:null, week:G.week };
        G.log("🧬 Detection drill opened — find the fake frame before the entertainment press does.","gold");
     }},
     {label:"Ignore it (60% scandal risk)", run(G){
        const t=G._evtT;
        if(t && Math.random()<0.6){ if(typeof scandalHit==="function") scandalHit(t); G.log("🧬 The fake stuck — "+t.name+" is radioactive for a while.","bad"); }
        else G.log("🧬 The clip burned itself out by Tuesday.","");
     }},
   ]},
  /* EU content quota spot-check (fires only when you own a streamer) */
  {id:"eu_quota", w:3, icon:"🇪🇺", title:"EU content quota review",
   text:"Brussels is auditing platforms against the 30% European-works rule. Your catalogue is up for review.",
   when(G){ return !!G.streamer; },
   run(G){ if(typeof euQuotaCheck==="function") euQuotaCheck(); }},
  /* Tax credit audit — v2 credits carry real paperwork risk */
  {id:"tax_audit", w:3, icon:"🧾", title:"Tax credit audit", kind:"choice",
   text:(G)=>{ const f=(G.films||[]).filter(x=>x.rebateEarned>3 && !x.audited); G._evtF=f.length?pick(f):null;
      return G._evtF? ("Revenue agents are auditing the "+G._evtF.title+" production credit ("+fmtM0(f.rebateEarned)+" claimed). The file is… creative.")
                    : "Revenue agents are sniffing around your incentive claims."; },
   when(G){ return (G.films||[]).some(f=>f.rebateEarned>3 && !f.audited) || (G.projects||[]).some(p=>p.rebateEarned>3 && !p.audited); },
   choices:(G)=>[
     {label:"Settle quietly (−40% of the rebates claimed)", run(G){
        const f=G._evtF || (G.projects||[]).find(p=>p.rebateEarned>3 && !p.audited); if(!f) return; f.audited=true;
        const claw=Math.round((f.rebateEarned||5)*0.4*10)/10; if(typeof spend==="function") spend("other", claw);
        G.log("🧾 Audit settled on “"+f.title+"”: −"+fmtM0(claw)+" clawed back.","bad");
     }},
     {label:"Fight it (50/50: keep everything, or clawback + $4M fine)", run(G){
        const f=G._evtF || (G.projects||[]).find(p=>p.rebateEarned>3 && !p.audited); if(!f) return; f.audited=true;
        if(Math.random()<0.5){ G.studio.rep=Math.min(99,G.studio.rep+1); G.log("🧾 Audit WON on “"+f.title+"” — every rebate dollar survives. +1 rep.","gold"); }
        else{ const claw=Math.round((f.rebateEarned||5)*0.4*10)/10+4; if(typeof spend==="function") spend("other", claw); G.studio.rep=Math.max(5,G.studio.rep-1); G.log("🧾 Audit LOST on “"+f.title+"”: −"+fmtM0(claw)+" with a fine on top. −1 rep.","bad"); }
     }},
   ]},
  /* Agency poaching war over your biggest free star */
  {id:"agency_war", w:3, icon:"🕴", title:"Packaging war heats up", kind:"choice",
   text:(G)=>{ const t=(G.talent||[]).filter(x=>x.kind==="actor"&&x.power>=4&&!x.bookedUntil); G._evtT=t.length?pick(t):null;
      const ag=G._evtT&&DATA.agency? DATA.agency(G._evtT.agency):null;
      return G._evtT? ((ag?ag.name:"An agency")+" is dangling "+G._evtT.name+" at every studio in town. Lock them with a rich holding deal, or let the market play it?")
                    : "Agencies are at war over the A-list."; },
   when(G){ return G.talent.some(t=>t.kind==="actor"&&t.power>=4&&!t.bookedUntil); },
   choices:(G)=>[
     {label:"Pay a holding deal (−$6M, they warm up and wait)", run(G){
        const t=G._evtT; if(!t) return; if(typeof spend==="function") spend("talent",6);
        t.heat=Math.min(3,(t.heat||0)+1); t.loyalTo=G.studio.name;
        G.log("🕴 "+t.name+" signs a holding deal with you — warmed up and off the market's mind.","good");
     }},
     {label:"Let them shop (their quote jumps ~25%)", run(G){
        const t=G._evtT; if(t){ t.fee=Math.round(t.fee*1.25*10)/10; G.log("🕴 "+t.name+"'s quote just jumped. Agencies gonna agency.",""); }
     }},
   ]},
  /* M&A: distressed-asset firesale */
  {id:"ma_firesale", w:3, icon:"🏦", title:"Distressed-asset firesale", kind:"choice",
   text:(G)=>{ const price=38+((G.week*7)%40); G._evtPrice=price;
      return "A minnow distributor is going under: its whole library is on the block at ~$"+price+"M. Catalog value and steady royalties forever."; },
   when(G){ return G.week>30 && G.studio.cash>30; },
   choices:(G)=>[
     {label:"Buy the library (pay the firesale price, +catalog value)", run(G){
        const price=G._evtPrice||50; if(G.studio.cash<price){ G.log("💸 Couldn't cover the firesale price.","bad"); return; }
        if(typeof spend==="function") spend("studio", price);
        G.maLibraries=(G.maLibraries||0)+1; G.maDeals=(G.maDeals||[]); G.maDeals.push({kind:"library", week:G.week, price});
        G.log("📚 Library acquired in the firesale — catalog value up by ~"+fmtM0(Math.round(price*0.9))+", royalties flow weekly.","gold");
     }},
     {label:"Pass on the carrion", run(G){ G.log("🏦 You let the vultures have it.",""); }},
   ]}
);

/* tiny money formatter usable inside data.js events (engine's fmtM wins once loaded) */
function fmtM0(v){ return "$"+(Math.round(v*10)/10)+"M"; }

/* ═══════════════════════════════════════════════════════════
   v17 — WORLD & UI FOUNDATIONS
   ═══════════════════════════════════════════════════════════ */

/* ── Multi-Territory Box Office: 8 territories with genre multipliers, political risk, piracy base ── */
DATA.TERRITORIES = [
  {id:"uscan",    name:"US/Canada",       share:0.40, emoji:"🇺🇸🇨🇦", risk:0,   piracy:18,  genre:{action:1.15, scifi:1.10, fantasy:1.08, animation:1.05, comedy:1.00, horror:0.95, thriller:1.02, drama:0.90, romance:0.85, musical:0.95, western:0.88, war:1.05, sports:0.90, concert:1.10, truecrime:1.05}},
  {id:"china",    name:"China",           share:0.20, emoji:"🇨🇳",   risk:0.15, piracy:35,  genre:{action:1.25, scifi:1.15, fantasy:1.05, animation:1.20, comedy:0.70, horror:0.30, thriller:0.85, drama:0.60, romance:0.50, musical:0.65, western:0.40, war:0.90, sports:0.75, concert:0.80, truecrime:0.40}},
  {id:"india",    name:"India",           share:0.08, emoji:"🇮🇳",   risk:0.05, piracy:28,  genre:{action:1.10, scifi:1.05, fantasy:1.00, animation:1.15, comedy:1.20, horror:0.80, thriller:0.95, drama:1.10, romance:1.35, musical:1.40, western:0.60, war:0.85, sports:1.25, concert:1.05, truecrime:1.10}},
  {id:"uk",       name:"United Kingdom",  share:0.06, emoji:"🇬🇧",   risk:0,   piracy:12,  genre:{action:1.08, scifi:1.08, fantasy:1.12, animation:1.05, comedy:1.15, horror:1.00, thriller:1.05, drama:1.10, romance:1.05, musical:1.15, western:0.95, war:1.10, sports:1.00, concert:1.10, truecrime:1.15}},
  {id:"france",   name:"France",          share:0.05, emoji:"🇫🇷",   risk:0,   piracy:15,  genre:{action:0.95, scifi:1.05, fantasy:1.08, animation:1.15, comedy:1.10, horror:1.05, thriller:1.08, drama:1.15, romance:1.20, musical:1.10, western:0.90, war:1.05, sports:0.90, concert:1.05, truecrime:1.10}},
  {id:"japan",    name:"Japan",           share:0.07, emoji:"🇯🇵",   risk:0,   piracy:8,   genre:{action:1.10, scifi:1.15, fantasy:1.20, animation:1.30, comedy:0.85, horror:1.15, thriller:1.00, drama:1.00, romance:0.95, musical:1.05, western:0.80, war:0.95, sports:0.85, concert:1.20, truecrime:1.00}},
  {id:"latam",    name:"Latin America",   share:0.07, emoji:"🌎",   risk:0.08, piracy:32,  genre:{action:1.20, scifi:1.05, fantasy:1.10, animation:1.25, comedy:1.10, horror:1.15, thriller:1.00, drama:0.95, romance:1.10, musical:1.05, western:0.90, war:0.95, sports:1.15, concert:1.10, truecrime:1.05}},
  {id:"rest",     name:"Rest of World",   share:0.07, emoji:"🌍",   risk:0.10, piracy:25,  genre:{action:1.05, scifi:1.05, fantasy:1.05, animation:1.05, comedy:1.00, horror:1.00, thriller:1.00, drama:1.00, romance:1.00, musical:1.00, western:0.95, war:1.00, sports:1.00, concert:1.00, truecrime:1.00}},
];
DATA.territory = (id)=> DATA.TERRITORIES.find(t=>t.id===id) || DATA.TERRITORIES[0];

/* ── Economic Cycles ── */
DATA.ECON_CYCLES = [
  {id:"boom",       name:"Boom",        emoji:"📈", dur:[104,208], boxOffice:1.15, loanRate:0.75, streamChurn:0.95, desc:"Theaters packed, money cheap, streamers bleed subs."},
  {id:"normal",     name:"Normal",      emoji:"➖", dur:[104,208], boxOffice:1.00, loanRate:1.00, streamChurn:1.00, desc:"Business as usual."},
  {id:"recession",  name:"Recession",   emoji:"📉", dur:[78,156], boxOffice:0.80, loanRate:1.35, streamChurn:1.08, desc:"Tickets down, rates up, audiences stay home."},
  {id:"streamglut", name:"Streaming Glut", emoji:"📺", dur:[78,156], boxOffice:0.90, loanRate:1.10, streamChurn:1.25, desc:"Too many services, churn spikes, licensing fees crash."},
];

/* ── Geopolitical Events (for v18, data defined here) ── */
DATA.GEO_EVENTS = [
  {id:"china_ban",       name:"China Import Ban",       emoji:"🚫🇨🇳", dur:26, territories:["china"],   boxOfficeMult:0,   desc:"China closes its doors — zero revenue for 26 weeks."},
  {id:"india_boom",      name:"India Box Office Boom",  emoji:"📈🇮🇳", dur:8,  territories:["india"],   boxOfficeMult:1.40,desc:"India surges +40% for 8 weeks."},
  {id:"eu_quota",        name:"EU Content Quota",       emoji:"🇪🇺",   dur:26, territories:["france","uk"], boxOfficeMult:0.80, desc:"EU quota rules — France/UK mult 0.8, must commission local."},
  {id:"us_tariff",       name:"US Import Tariffs",      emoji:"🇺🇸",   dur:13, territories:["uscan"],     boxOfficeMult:1.0,  distCostMult:1.15, desc:"Tariffs raise international distribution costs +15%."},
];

/* ── Production Chaos Events (for v22, data defined here) ── */
DATA.CHAOS_EVENTS = [
  {id:"location_fire",    name:"Location Fire",       emoji:"🔥",  delay:2, cost:5,   insurable:true,  desc:"Set ablaze — +2 weeks, +$5M. Insurable."},
  {id:"lead_injury",      name:"Lead Injury",         emoji:"🤕",  delay:4, cost:0,   insurable:true,  recastCost:8, desc:"Star injured — +4 weeks delay OR recast for $8M."},
  {id:"director_walkout", name:"Director Walkout",    emoji:"🚪",  delay:0, cost:15,  insurable:false, qualityHit:10, desc:"Director quits — quality −10 OR pay $15M to retain."},
  {id:"budget_overrun",   name:"Budget Overrun",      emoji:"💸",  delay:0, cost:0,   insurable:false, overrunPct:0.15, desc:"Remaining budget balloons +15%."},
  {id:"script_leak",      name:"Script Leak",         emoji:"📰",  delay:0, cost:0,   insurable:false, hype:+5, openingHit:0.08, desc:"Script leaks — hype +5 but opening −8% from spoilers."},
  {id:"star_scandal",     name:"Star Scandal",        emoji:"⭐",  delay:0, cost:8,   insurable:false, reshootCost:8, scoreHit:15, desc:"Star scandal — reshoot without them ($8M) OR release as-is (−15 audience)."},
];

/* ── Franchise Universe Graph node types ── */
DATA.UNIVERSE_NODE_TYPES = [
  {type:"film",    label:"Film",    emoji:"🎬", shape:"circle",    color:"#f5b942"},
  {type:"tv",      label:"TV",      emoji:"📺", shape:"square",    color:"#5aa2ff"},
  {type:"game",    label:"Game",    emoji:"🎮", shape:"diamond",   color:"#b48bff"},
  {type:"park",    label:"Park",    emoji:"🎢", shape:"hexagon",   color:"#3ddc84"},
  {type:"merch",   label:"Merch",   emoji:"🧸", shape:"triangle",  color:"#ff5d6c"},
];

/* ═══════════════════════════════════════════════════════════
   v20 — CONTENT EXPANSION
   ═══════════════════════════════════════════════════════════ */

/* ── Director's Cut DLC ── */
DATA.DIRECTORS_CUT = {
  cost: 5,           // $5M
  openingMult: 0.30, // 30% of original opening
  runWeeks: 4,       // 4-week limited run
  minFilmAge: 12,    // weeks since release
  minScore: 70,      // quality threshold
};

/* ── Documentary Arm ── */
DATA.DOCUMENTARY = {
  genre: "documentary",
  budgetMin: 2,
  budgetMax: 8,
  noCast: true,
  awardsWeight: 1.8,
  streamingDelay: 4,
};

/* ── Podcast / Audio Drama ── */
DATA.PODCAST = {
  cost: 0.5,         // $500K
  duration: 4,       // weeks to produce
  subsPerWeek: 0.5,  // +0.5M subs/week for 12 weeks
  repGain: 1,
  awarenessBoost: 5, // franchise awareness +5%
};

/* ── Animated Series → Film Pipeline ── */
DATA.ANIMATED_PIPELINE = {
  seriesBudgetMin: 25,
  seriesBudgetMax: 40,
  seriesEps: 12,
  seasonsToUnlock: 2,
  fastTrackOpeningMult: 1.15,
  familyBonus: 1.20,
};

/* ── Foreign Co-production Partners ── */
DATA.COPRO_PARTNERS = [
  {id:"bollywood", name:"Bollywood Partner", emoji:"🇮🇳", territoryBoost:{india:2.5}, budgetShare:0.60, risk:"Star dates locked", desc:"India 2.5× boost, 60/40 budget split."},
  {id:"korean", name:"Korean Partner", emoji:"🇰🇷", territoryBoost:{korea:2.0, latam:1.3}, budgetShare:0.50, risk:"Theatrical hold 8 wks", desc:"Korea 2.0× + Asia 1.3×, 50/50 split."},
  {id:"french", name:"French Partner", emoji:"🇫🇷", territoryBoost:{france:1.8, uk:1.2}, budgetShare:0.50, risk:"Public funding strings", desc:"France 1.8× + EU 1.2×, 50/50 split."},
];

/* ── SAVE_VERSION bump for v20 ── */
DATA.SAVE_VERSION = 10;

/* ══════════════════════════════════════════════════════════
   v21 — DRAMA & CRISIS EVENTS
   ═══════════════════════════════════════════════════════════ */

/* ── Talent Strikes (Three Guilds) ── */
DATA.GUILDS = [
  {id:"wga", name:"Writers Guild", emoji:"✍️", role:"writer", color:"#4dd6e8", strikeAt:80, settleCost:[30,80], settleWeeks:[4,16], preemptiveCost:20},
  {id:"dga", name:"Directors Guild", emoji:"🎬", role:"director", color:"#b48bff", strikeAt:80, settleCost:[35,90], settleWeeks:[4,16], preemptiveCost:22},
  {id:"sag", name:"Actors Guild", emoji:"🎭", role:"actor", color:"#ff5d6c", strikeAt:80, settleCost:[40,100], settleWeeks:[4,16], preemptiveCost:25},
];

/* ── Casting Scandal ── */
DATA.CASTING_SCANDAL = {
  baseChance: 0.015,     // 1.5%/week per senior exec/producer
  settleCost: 40,        // $40M + -5 rep
  fightClearChance: 0.5, // 50% clear
  fightEscalateRep: -15, // 50% escalate to -15 rep
  prFirmCost: 10,        // $10M PR firm reduces damage 50%
};

/* ── Script Auction ── */
DATA.SCRIPT_AUCTION = {
  qualityThreshold: 85,  // hot scripts trigger auction
  rivalBidders: [1,2],   // 1-2 AI rivals
  rounds: 3,             // 3 rounds
};

/* ── Streaming vs Theatrical War Meter ── */
DATA.WAR_METER = {
  min: 0, max: 100,
  start: 50,             // neutral
  theatricalBoost: 15,   // <30: theatrical +15%
  streamingBoost: 15,    // >70: streaming +15%, theatrical -15%
};

/* ── AI-Generated Film ── */
DATA.AI_FILM = {
  budget: 10,            // $10M
  qualityRange: [40,60], // always 40-60
  piracyResist: 0.5,     // +50% piracy resistance
  openingMult: 0.4,      // opening ×0.4
  streamingTail: 2.0,    // streaming long tail ×2.0
  warMeterPush: 5,       // each use pushes meter +5 toward streaming
};

/* ── SAVE_VERSION bump for v21 ── */
DATA.SAVE_VERSION = 11;

/* ══════════════════════════════════════════════════════════
   v22 — PRODUCTION CHAOS & AI POLISH
   ═══════════════════════════════════════════════════════════ */

/* ── Production Chaos Events (fire during production) ── */
DATA.CHAOS_EVENTS = [
  {id:"location_fire",    name:"Location Fire",       emoji:"🔥",  delay:2, cost:5,   insurable:true,  desc:"Set ablaze — +2 weeks, +$5M. Insurable."},
  {id:"lead_injury",      name:"Lead Injury",         emoji:"🤕",  delay:4, cost:0,   insurable:true,  recastCost:8, desc:"Star injured — +4 weeks delay OR recast for $8M."},
  {id:"director_walkout", name:"Director Walkout",    emoji:"🚪",  delay:0, cost:15,  insurable:false, qualityHit:10, desc:"Director quits — quality −10 OR pay $15M to retain."},
  {id:"budget_overrun",   name:"Budget Overrun",      emoji:"💸",  delay:0, cost:0,   insurable:false, overrunPct:0.15, desc:"Remaining budget balloons +15%."},
  {id:"script_leak",      name:"Script Leak",         emoji:"📰",  delay:0, cost:0,   insurable:false, hype:+5, openingHit:0.08, desc:"Script leaks — hype +5 but opening −8% from spoilers."},
  {id:"star_scandal",     name:"Star Scandal",        emoji:"⭐",  delay:0, cost:8,   insurable:false, reshootCost:8, scoreHit:15, desc:"Star scandal — reshoot without them ($8M) OR release as-is (−15 audience)."},
];

/* ── Gemini AI Pitch Generator ── */
DATA.GEMINI = {
  endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
  pitchPrompt: `You are a Hollywood development executive. Generate a film pitch from a user concept.
Return ONLY valid JSON with these exact keys:
{
  "title": "string (max 60 chars)",
  "tagline": "string (max 120 chars)",
  "genre": "one of: action,scifi,fantasy,animation,comedy,horror,thriller,drama,romance,musical,western,war,sports,concert,truecrime,documentary",
  "scale": "one of: indie,mid,tentpole",
  "budgetEstimate": "number (millions)",
  "castSuggestions": ["string (3-5 names)"],
  "predictedScore": "number 1-100",
  "concept": "string (1-2 sentences expanding the user's idea)"
}`,
};

/* ── SAVE_VERSION bump for v22 ── */
DATA.SAVE_VERSION = 12;

/* ══════════════════════════════════════════════════════════
   v24 — RIVAL AI PERSONALITIES + MEMORY
   ═══════════════════════════════════════════════════════════ */

/* ── Rival Personality Archetypes ── */
DATA.RIVAL_PERSONALITIES = [
  {id:"aggressive", name:"🦁 Aggressive", emoji:"🦁", 
   traits:{riskTolerance:0.8, budgetMult:1.3, marketingMult:1.2, genrePref:["action","scifi","fantasy","horror"], 
           poachChance:0.3, acquireChance:0.2, dealStyle:"hardball"},
   desc:"Swings for the fences. Big budgets, big marketing, loves tentpoles. Will poach your stars."},
  {id:"prestige", name:"🏛 Prestige", emoji:"🏛",
   traits:{riskTolerance:0.3, budgetMult:0.9, marketingMult:1.1, genrePref:["drama","musical","war","western","documentary"],
           poachChance:0.1, acquireChance:0.15, dealStyle:"selective"},
   desc:"Quality over quantity. Awards bait, festival darlings. Rarely poaches, but buys libraries."},
  {id:"volume", name:"🏭 Volume", emoji:"🏭",
   traits:{riskTolerance:0.5, budgetMult:1.0, marketingMult:0.9, genrePref:["comedy","action","thriller","romance"],
           poachChance:0.15, acquireChance:0.25, dealStyle:"pragmatic"},
   desc:"High volume, mid-budget. Steady slate, grabs undervalued talent. Opportunistic acquirer."},
  {id:"streamer", name:"📱 Streamer-First", emoji:"📱",
   traits:{riskTolerance:0.6, budgetMult:1.1, marketingMult:1.3, genrePref:["horror","thriller","documentary","truecrime","animation"],
           poachChance:0.2, acquireChance:0.3, dealStyle:"data-driven"},
   desc:"OTT-focused. Data-driven greenlights, heavy marketing. Buys IP for streaming originals."},
  {id:"opportunist", name:"🎲 Opportunist", emoji:"🎲",
   traits:{riskTolerance:0.7, budgetMult:1.2, marketingMult:1.0, genrePref:["action","horror","concert","sports"],
           poachChance:0.25, acquireChance:0.2, dealStyle:"aggressive"},
   desc:"Reactive. Jumps on trends, buys distressed assets, poaches when you're weak. Unpredictable."}
];

/* ── Rival Memory System ── */
DATA.RIVAL_MEMORY = {
  // Memory types: "deal", "poach", "acquire", "war", "deal_rejected", "poach_failed"
  maxEntries: 50,
  decayRate: 0.98, // per week
  weights: { deal: 1.0, poach: 1.5, acquire: 2.0, war: 1.5, deal_rejected: 0.8, poach_failed: 1.2 }
};

/* ═════════════════════════════════════════════════════════
   PROTOTYPE RPG CHARACTER SYSTEM DATA
   ════════════════════════════════════════════════════════ */

// 3-axis alignment system (Lawful/Neutral/Chaotic) + moral axis (Good/Neutral/Evil) = 9-grid
DATA.PROTOTYPE_ALIGNMENTS = [
  {id:"lawful", name:"Lawful", emoji:"⚖️", desc:"Order, tradition, hierarchy. +10% contract compliance, -10% creative freedom"},
  {id:"neutral", name:"Neutral", emoji:"⚪", desc:"Balance, pragmatism. No alignment bonuses or penalties"},
  {id:"chaotic", name:"Chaotic", emoji:"🌪️", desc:"Freedom, innovation, rebellion. +15% creative output, -15% schedule adherence"}
];
DATA.PROTOTYPE_MORALS = [
  {id:"kind", name:"Good", emoji:"☀️", desc:"Beloved professional. +fan loyalty, scandals fade 25% faster, asks +5%"},
  {id:"neutral", name:"Neutral", emoji:"🌗", desc:"No moral lean. No bonuses or penalties"},
  {id:"ruthless", name:"Ruthless", emoji:"🌑", desc:"Feared operator. +negotiation power (fees −5%), +scandal risk, rivals respect them"}
];
// 9-grid effects: [lawful][kind] → production + personal modifiers
DATA.PROTOTYPE_ALIGNMENT_GRID = {
  lawful:   { kind: { contractCompliance:0.10, creativeFreedom:-0.10, scheduleAdherence:0.05 }, ruthless:{}, neutral:{} },
  neutral:  { kind: {}, neutral:{}, ruthless:{} },
  chaotic:  { kind: { contractCompliance:-0.05, creativeFreedom:0.15, scheduleAdherence:-0.15 }, ruthless:{}, neutral:{} }
};
DATA.PROTOTYPE_MORAL_EFFECTS = {
  kind:     { scandalDecay: 0.25, fanLoyalty: 0.10, feeMult: 1.05 },
  neutral:  { scandalDecay: 0, fanLoyalty: 0, feeMult: 1 },
  ruthless: { scandalDecay: -0.25, feeMult: 0.95, scandalRisk: 0.15 }
};

// 5 core attributes (1-100 scale)
DATA.PROTOTYPE_ATTRIBUTES = [
  {id:"cha", name:"Charisma", emoji:"✨", desc:"Audience appeal, negotiation, star power"},
  {id:"int", name:"Intellect", emoji:"🧠", desc:"Script quality, direction skill, problem solving"},
  {id:"cre", name:"Creativity", emoji:"🎨", desc:"Originality, improvisation, artistic vision"},
  {id:"dis", name:"Discipline", emoji:"📋", desc:"Reliability, schedule adherence, professionalism"},
  {id:"luk", name:"Luck", emoji:"🍀", desc:"Random event modifiers, serendipity"}
];

// XP curve: XP = BASE * level^1.15 (flattened from 1.35 for prototype balance)
DATA.PROTOTYPE_XP_CURVE = 1.15;
DATA.PROTOTYPE_BASE_XP = 600;

// 3-axis alignment effects on production
DATA.PROTOTYPE_ALIGNMENT_EFFECTS = {
  lawful: { contractCompliance: 0.10, creativeFreedom: -0.10, scheduleAdherence: 0.05 },
  neutral: { contractCompliance: 0, creativeFreedom: 0, scheduleAdherence: 0 },
  chaotic: { contractCompliance: -0.05, creativeFreedom: 0.15, scheduleAdherence: -0.15 }
};

// 5 core attributes (1-100)
DATA.PROTOTYPE_ATTRIBUTE_DEFAULTS = { cha: 50, int: 50, cre: 50, dis: 50, luk: 50 };

// 3-axis alignment for talents
DATA.PROTOTYPE_ALIGNMENT_OPTIONS = ["lawful", "neutral", "chaotic"];

// Equipment system (4 slots: Weapon, Armor, Accessory, Prop) - 5 rarities
DATA.PROTOTYPE_EQUIPMENT = {
  weapon: [
    { id: "script_basic", name: "Basic Script", rarity: "common", quality: 5, cost: 1 },
    { id: "script_solid", name: "Solid Script", rarity: "uncommon", quality: 10, cost: 3 },
    { id: "script_oscar", name: "Oscar Bait Script", rarity: "rare", quality: 20, cost: 10 },
    { id: "script_franchise", name: "Franchise IP", rarity: "epic", quality: 30, cost: 30 },
    { id: "script_legendary", name: "Legendary IP", rarity: "legendary", quality: 50, cost: 100 }
  ],
  armor: [
    { id: "pr_basic", name: "Junior Publicist", rarity: "common", scandalReduction: 5, cost: 1 },
    { id: "pr_agency", name: "PR Agency", rarity: "uncommon", scandalReduction: 15, cost: 5 },
    { id: "pr_crisis", name: "Crisis Manager", rarity: "rare", scandalReduction: 25, cost: 15 },
    { id: "pr_elite", name: "Elite Firm", rarity: "epic", scandalReduction: 40, cost: 40 },
    { id: "pr_legendary", name: "Legendary Fixer", rarity: "legendary", scandalReduction: 60, cost: 100 }
  ],
  accessory: [
    { id: "acc_lucky_pen", name: "Lucky Fountain Pen", rarity: "common", luk: 2, cost: 1 },
    { id: "acc_wardrobe", name: "Signature Wardrobe", rarity: "uncommon", cha: 4, cost: 5 },
    { id: "acc_watch", name: "Legendary Watch", rarity: "rare", cha: 6, luk: 4, cost: 15 },
    { id: "acc_entourage", name: "Loyal Entourage", rarity: "epic", cha: 8, dis: 4, cost: 40 },
    { id: "acc_mythic", name: "Mythmaker Ring", rarity: "legendary", cha: 10, luk: 8, xpRate: 0.10, cost: 100 }
  ],
  prop: [
    { id: "prop_planner", name: "Bullet Planner", rarity: "common", dis: 2, cost: 1 },
    { id: "prop_coach", name: "Acting Coach", rarity: "uncommon", dis: 4, int: 2, cost: 5 },
    { id: "prop_muse", name: "Personal Muse", rarity: "rare", cre: 6, cost: 15 },
    { id: "prop_archive", name: "Idea Archive", rarity: "epic", cre: 8, int: 4, cost: 40 },
    { id: "prop_grimoire", name: "Craft Grimoire", rarity: "legendary", int: 8, cre: 8, xpRate: 0.15, cost: 100 }
  ]
};

// Rarity tiers with colors
DATA.PROTOTYPE_RARITY = {
  common: { color: "#888", multiplier: 1.0 },
  uncommon: { color: "#0f0", multiplier: 1.5 },
  rare: { color: "#08f", multiplier: 2.0 },
  epic: { color: "#f0f", multiplier: 3.0 },
  legendary: { color: "#fd0", multiplier: 5.0 }
};

// Skill trees — 3 branches per talent type (Phase 1 full scope)
DATA.PROTOTYPE_SKILL_TREES = {
  actor: {
    branches: [
      { id:"star", name:"Star Power", nodes: [
        { id: "charisma_1", name: "Charisma Boost I", cost: 2, effect: { cha: 5 }, req: 0 },
        { id: "charisma_2", name: "Charisma Boost II", cost: 4, effect: { cha: 10 }, req: 1 },
        { id: "audience_draw", name: "Audience Draw", cost: 5, effect: { openingBonus: 0.10 }, req: 2 },
        { id: "franchise_anchor", name: "Franchise Anchor", cost: 8, effect: { sequelNegotiation: 0.25 }, req: 3 }
      ]},
      { id:"method", name:"Method Craft", nodes: [
        { id: "m_immerse", name: "Deep Immersion", cost: 2, effect: { int: 4 }, req: 0 },
        { id: "m_range", name: "Chameleon Range", cost: 4, effect: { cre: 6 }, req: 1 },
        { id: "m_critdar", name: "Critic Darling", cost: 5, effect: { criticBonus: 0.10 }, req: 2 },
        { id: "m_transformation", name: "The Transformation", cost: 8, effect: { genreQuality: 0.15, criticBonus: 0.05 }, req: 3 }
      ]},
      { id:"magnet", name:"Box Office Magnet", nodes: [
        { id: "b_openings", name: "Opening Magnet", cost: 2, effect: { openingBonus: 0.05 }, req: 0 },
        { id: "b_intl", name: "International Pull", cost: 4, effect: { intlBonus: 0.08 }, req: 1 },
        { id: "b_payday", name: "Backend Player", cost: 5, effect: { backendEase: 0.20 }, req: 2 },
        { id: "b_event", name: "Event Film Status", cost: 8, effect: { openingBonus: 0.15, intlBonus: 0.10 }, req: 3 }
      ]}
    ]
  },
  director: {
    branches: [
      { id:"visual", name:"Visual Storytelling", nodes: [
        { id: "visual_style", name: "Visual Style I", cost: 2, effect: { cre: 5 }, req: 0 },
        { id: "auteur_sig", name: "Auteur Signature", cost: 5, effect: { criticBonus: 0.10 }, req: 1 },
        { id: "genre_mastery", name: "Genre Mastery", cost: 8, effect: { genreQuality: 0.20 }, req: 2 }
      ]},
      { id:"whisperer", name:"Actor Whisperer", nodes: [
        { id: "w_trust", name: "Set Trust", cost: 2, effect: { cha: 4 }, req: 0 },
        { id: "w_perf", name: "Career Performances", cost: 5, effect: { castLift: 0.15 }, req: 1 },
        { id: "w_ensemble", name: "Ensemble Alchemy", cost: 8, effect: { castLift: 0.10, criticBonus: 0.08 }, req: 2 }
      ]},
      { id:"tech", name:"Technical Innovation", nodes: [
        { id: "t_schedules", name: "Shot-list Discipline", cost: 2, effect: { dis: 5 }, req: 0 },
        { id: "t_fx", name: "FX Innovation", cost: 5, effect: { genreQuality: 0.10 }, req: 1 },
        { id: "t_under_budget", name: "Under-Budget Wizard", cost: 8, effect: { overrunReduction: 0.20, scheduleAdherence: 0.10 }, req: 2 }
      ]}
    ]
  },
  writer: {
    branches: [
      { id:"craft", name:"Craft Mastery", nodes: [
        { id: "script_craft", name: "Script Craft I", cost: 2, effect: { int: 5 }, req: 0 },
        { id: "dialogue_master", name: "Dialogue Master", cost: 5, effect: { scriptQuality: 0.15 }, req: 1 },
        { id: "genre_spec", name: "Genre Specialist", cost: 8, effect: { genreScriptBonus: 0.20 }, req: 2 }
      ]},
      { id:"voice", name:"Distinct Voice", nodes: [
        { id: "v_perspective", name: "Fresh Perspective", cost: 2, effect: { cre: 5 }, req: 0 },
        { id: "v_prestige", name: "Prestige Pen", cost: 5, effect: { criticBonus: 0.12 }, req: 1 },
        { id: "v_original", name: "Totally Original", cost: 8, effect: { genreScriptBonus: 0.12, scriptQuality: 0.10 }, req: 2 }
      ]},
      { id:"bankable", name:"Bankable Pages", nodes: [
        { id: "k_hook", name: "Killer Hook", cost: 2, effect: { openingBonus: 0.05 }, req: 0 },
        { id: "k_leaning", name: "Four-Quadrant Polish", cost: 5, effect: { intlBonus: 0.08 }, req: 1 },
        { id: "k_universe", name: "Universe Builder", cost: 8, effect: { sequelNegotiation: 0.15, scriptQuality: 0.08 }, req: 2 }
      ]}
    ]
  },
  producer: {
    branches: [
      { id:"dealmaking", name:"Dealmaking", nodes: [
        { id: "budget_wizard", name: "Budget Wizard I", cost: 2, effect: { dis: 5 }, req: 0 },
        { id: "schedule_master", name: "Schedule Master", cost: 5, effect: { overrunReduction: 0.10 }, req: 1 },
        { id: "studio_whisperer", name: "Studio Whisperer", cost: 8, effect: { greenlightBoost: 0.15 }, req: 2 }
      ]},
      { id:"logistics", name:"Iron Logistics", nodes: [
        { id: "l_permits", name: "Permits Whisperer", cost: 2, effect: { dis: 4 }, req: 0 },
        { id: "l_bond", name: "Completion Bond", cost: 5, effect: { overrunReduction: 0.15 }, req: 1 },
        { id: "l_army", name: "Crew Army", cost: 8, effect: { scheduleAdherence: 0.15, overrunReduction: 0.10 }, req: 2 }
      ]},
      { id:"money", name:"Money Machine", nodes: [
        { id: "m_rebates", name: "Rebate Hunter", cost: 2, effect: { dis: 3 }, req: 0 },
        { id: "m_cofin", name: "Co-Finance Network", cost: 5, effect: { greenlightBoost: 0.10 }, req: 1 },
        { id: "m_pre_sales", name: "Pre-Sales Ace", cost: 8, effect: { intlBonus: 0.10, greenlightBoost: 0.08 }, req: 2 }
      ]}
    ]
  }
};

// Life events (3 types)
DATA.PROTOTYPE_LIFE_EVENTS = [
  { type: "career", weight: 50, icon: "🎬", desc: "Career Opportunity",
    templates: [
      "Offered lead role in {genre} tentpole",
      "Director {name} wants you for passion project",
      "Studio offers multi-picture deal",
      "Casting director recommends you for {genre} film"
    ],
    effects: { xp: 300, rep: 2, fame: 3 }
  },
  { type: "personal", weight: 20, icon: "💔", desc: "Personal Crisis",
    templates: [
      "Health scare forces production delay",
      "Relationship stress affects performance",
      "Family emergency pulls you from set",
      "Burnout requires mandatory hiatus"
    ],
    effects: { xp: -50, rep: -2, discipline: -5, scandal: 5 }
  },
  { type: "scandal", weight: 30, icon: "📰", desc: "Scandal Risk",
    templates: [
      "Leaked photos spark tabloid frenzy",
      "Controversial quote goes viral",
      "Legal trouble from past contract",
      "Social media controversy erupts"
    ],
    effects: { xp: 50, rep: -10, fame: 5, scandal: 15, infamy: 10 }
  },
  { type: "social", weight: 25, icon: "🤝", desc: "Industry Buzz",
    templates: [
      "Spotted lunching with {name} — collaboration rumors swirl",
      "Praises {name}'s latest work in an interview",
      "{name} sends a public thank-you gift",
      "Co-hosts a charity gala with {name}"
    ],
    effects: { xp: 120, fame: 2 },
    social: { with: "collaborator", bond: 2 }
  },
  { type: "mentorship", weight: 15, icon: "🧑‍🏫", desc: "Craft Moment",
    templates: [
      "Late-night script session with {name} pays off",
      "Shadows {name} on set to study the craft",
      "{name} shares hard-won career advice",
      "Runs lines with {name} until dawn"
    ],
    effects: { xp: 200 },
    social: { with: "mentor", bond: 3 }
  },
  { type: "feud", weight: 10, icon: "⚡", desc: "Creative Tension",
    templates: [
      "Clashes with {name} over a rewritten scene",
      "Press asks about the {name} rivalry — handles it badly",
      "{name} takes a swing at their process in an interview",
      "Walks off a shared project after creative differences with {name}"
    ],
    effects: { xp: 80, rep: -2, fame: 3 },
    social: { with: "collaborator", bond: -3 }
  }
];

// Game Dev full expansion (single active project, 8 dev phases, GDD, 7 genres, 5 platforms)
DATA.PROTOTYPE_GAME_DEV = {
  genres: [
    { id:"rpg", name:"RPG", emoji:"⚔️", costMult:1.2, quality:0.05, blurb:"Deep systems, long dev, devoted fans" },
    { id:"strategy", name:"Strategy", emoji:"♟️", costMult:1.0, quality:0.03, blurb:"Systems-heavy, critics love polish" },
    { id:"sim", name:"Simulation", emoji:"🏗️", costMult:1.1, quality:0.04, blurb:"Slow burn, strong long tail" },
    { id:"roguelike", name:"Roguelike", emoji:"💀", costMult:0.8, quality:0.02, blurb:"Cheap, replayable, cult appeal" },
    { id:"horror", name:"Horror", emoji:"👻", costMult:0.7, quality:0.0, blurb:"Low cost, spiky word of mouth" },
    { id:"puzzle", name:"Puzzle", emoji:"🧩", costMult:0.5, quality:-0.05, blurb:"Tiny budgets, mobile darling" },
    { id:"sports", name:"Sports", emoji:"🏟️", costMult:1.3, quality:0.0, blurb:"Annualized, license-hungry, reliable" }
  ],
  platforms: [
    { id:"pc", name:"PC", emoji:"🖥️", costMult:1.0, reach:1.0, price:1.0 },
    { id:"console", name:"Console", emoji:"🎮", costMult:1.4, reach:1.2, price:1.2 },
    { id:"mobile", name:"Mobile", emoji:"📱", costMult:0.6, reach:1.8, price:0.4 },
    { id:"hybrid", name:"Hybrid Handheld", emoji:"🔀", costMult:1.1, reach:1.1, price:1.1 },
    { id:"cloud", name:"Cloud Streaming", emoji:"☁️", costMult:0.9, reach:1.4, price:0.7 }
  ],
  themes: [
    { id:"fantasy", name:"High Fantasy", emoji:"🐉", fit:["rpg","strategy"], quality:0.05 },
    { id:"scifi", name:"Sci-Fi", emoji:"🚀", fit:["strategy","roguelike"], quality:0.05 },
    { id:"noir", name:"Noir", emoji:"🕵️", fit:["horror","puzzle"], quality:0.05 },
    { id:"cozy", name:"Cozy", emoji:"🌻", fit:["sim","puzzle"], quality:0.05 },
    { id:"gritty", name:"Gritty Realism", emoji:"🩸", fit:["sports","horror"], quality:0.05 }
  ],
  mechanics: [
    { id:"turnbased", name:"Turn-Based Depth", emoji:"🎯", fit:["strategy","rpg"], quality:0.06 },
    { id:"realtime", name:"Real-Time Action", emoji:"⚡", fit:["roguelike","sports"], quality:0.06 },
    { id:"building", name:"Base Building", emoji:"🧱", fit:["sim","strategy"], quality:0.06 },
    { id:"narrative", name:"Story-Driven", emoji:"📖", fit:["rpg","horror"], quality:0.06 },
    { id:"procedural", name:"Procedural Generation", emoji:"🎲", fit:["roguelike","puzzle"], quality:0.06 }
  ],
  monetization: [
    { id:"premium", name:"Premium", emoji:"💳", desc:"One price. Steady tail, no boost.", mult:1.0, tail:12, spike:0 },
    { id:"premium_dlc", name:"Premium + DLC", emoji:"📦", desc:"Paid expansions refresh the tail twice.", mult:1.0, tail:16, spike:0.5 },
    { id:"f2p_iap", name:"Free-to-Play + IAP", emoji:"🎁", desc:"Huge reach, whale revenue, review risk.", mult:1.5, tail:20, spike:0.8, qualityPenalty:8 },
    { id:"subscription", name:"Subscription (Game Pass)", emoji:"🎫", desc:"Flat license up front, small tail.", mult:0.6, tail:6, upfront:1.6 },
    { id:"ad_supported", name:"Ad-Supported", emoji:"📺", desc:"Free game, ad pennies pile up.", mult:0.8, tail:18, spike:0.2, qualityPenalty:4 },
    { id:"freemium", name:"Freemium", emoji:"🪙", desc:"Base free, cosmetics paid.", mult:1.2, tail:15, spike:0.4 }
  ],
  phases: [
    { id:"pre", name:"Pre-production", duration: 3, costMult: 0.10, desc: "Concept, GDD, team hiring" },
    { id:"prototype", name:"Prototype", duration: 3, costMult: 0.10, desc: "Core loop on screen" },
    { id:"vertical", name:"Vertical Slice", duration: 4, costMult: 0.15, desc: "One polished level proves the game" },
    { id:"alpha", name:"Alpha", duration: 5, costMult: 0.20, desc: "Feature complete, rough everywhere" },
    { id:"beta", name:"Beta", duration: 5, costMult: 0.15, desc: "Content complete, bug hunting" },
    { id:"content", name:"Content Complete", duration: 4, costMult: 0.10, desc: "Final art, audio, localization" },
    { id:"gold", name:"Gold Master", duration: 3, costMult: 0.10, desc: "Certification, day-one patch" },
    { id:"launch", name:"Launch", duration: 2, costMult: 0.10, desc: "Marketing push, release" }
  ],
  phaseChoices: {
    pre: [
      { id: "scope", label: "Scope", options: [
        { id: "tight", label: "Tight Scope", desc: "Focused vision, -20% cost, -10% quality", fx: { cost: -0.2, quality: -0.10 } },
        { id: "standard", label: "Standard", desc: "Balanced scope", fx: {} },
        { id: "ambitious", label: "Ambitious", desc: "Feature-rich, +30% cost, +15% quality", fx: { cost: 0.3, quality: 0.15 } }
      ]},
      { id: "team", label: "Team", options: [
        { id: "small", label: "Small Core Team", desc: "5 people, -30% cost, -10% velocity", fx: { cost: -0.3, velocity: -0.10 } },
        { id: "standard", label: "Standard Team", desc: "15 people, balanced", fx: {} },
        { id: "large", label: "Large Team", desc: "40 people, +50% cost, +20% velocity", fx: { cost: 0.5, velocity: 0.20 } }
      ]}
    ],
    prototype: [
      { id: "core_loop", label: "Core Loop", options: [
        { id: "tight_loop", label: "Tight Loop", desc: "Small and fun, +velocity, -features", fx: { velocity: 0.15, quality: -0.05 } },
        { id: "systems_loop", label: "Systems Soup", desc: "Everything at once, slow start, +quality", fx: { velocity: -0.15, quality: 0.10 } }
      ]}
    ],
    vertical: [
      { id: "art_style", label: "Art Direction", options: [
        { id: "stylized", label: "Stylized", desc: "Cheaper, timeless look", fx: { cost: -0.10, quality: 0.0 } },
        { id: "realistic", label: "Realistic", desc: "Expensive, impressive", fx: { cost: 0.25, quality: 0.10 } }
      ]}
    ],
    alpha: [
      { id: "freeze", label: "Feature Discipline", options: [
        { id: "freeze_now", label: "Freeze Features", desc: "Ship what works, +velocity, -quality", fx: { velocity: 0.20, quality: -0.08 } },
        { id: "one_more", label: "One More Feature", desc: "Scope creep risk, +quality", fx: { velocity: -0.15, quality: 0.12 } }
      ]}
    ],
    beta: [
      { id: "testing", label: "Testing Strategy", options: [
        { id: "open_beta", label: "Open Beta", desc: "Hype + free QA, review risk", fx: { quality: -0.05, sales: 0.10, velocity: 0.10 } },
        { id: "closed_beta", label: "Closed Beta", desc: "Quiet polish", fx: { quality: 0.08, velocity: -0.10 } }
      ]}
    ],
    content: [
      { id: "pace", label: "Pace", options: [
        { id: "crunch", label: "Crunch", desc: "Fast, quality suffers, team hates it", fx: { velocity: 0.25, quality: -0.15 } },
        { id: "steady", label: "Steady Pace", desc: "Healthy and predictable", fx: {} },
        { id: "polish", label: "Extra Polish", desc: "Slow, gleaming", fx: { velocity: -0.15, quality: 0.12 } }
      ]}
    ],
    gold: [
      { id: "cert", label: "Certification", options: [
        { id: "day_one_patch", label: "Day-One Patch", desc: "Ship now, fix fast, review risk", fx: { quality: -0.06, velocity: 0.20 } },
        { id: "clean_gold", label: "Clean Gold", desc: "Delay to polish", fx: { quality: 0.08, velocity: -0.15 } }
      ]}
    ],
    launch: [
      { id: "marketing", label: "Marketing Push", options: [
        { id: "minimal", label: "Minimal", desc: "Word of mouth only, -20% launch sales", fx: { sales: -0.20, cost: -0.10 } },
        { id: "standard", label: "Standard", desc: "Normal campaign", fx: {} },
        { id: "blitz", label: "Blitz", desc: "Massive campaign, +25% launch sales", fx: { sales: 0.25, cost: 0.15 } }
      ]}
    ]
  },
  liveOps: [
    { id:"patch", label:"Balance Patch", icon:"🔧", desc:"+small sales refresh, +quality", quality:2, sales:0.05, weight:40 },
    { id:"content_drop", label:"Content Drop", icon:"📦", desc:"+medium sales refresh", quality:0, sales:0.15, weight:30 },
    { id:"expansion", label:"Expansion", icon:"🌍", desc:"+big spike, extends tail", quality:3, sales:0.30, weight:15 },
    { id:"crossover", label:"Film Crossover Event", icon:"🎬", desc:"Your studio's films advertise the game", quality:0, sales:0.25, weight:15 }
  ]
};

// Talent guilds (Phase 6) — membership costs weekly dues, grants professional perks
DATA.GUILDS = [
  { id:"sag", name:"Screen Performers Guild", kinds:["actor"], icon:"🎭", dues:0.4, perk:"+1 SP per 10 weeks · scandals heal faster · +3% minimum fee" },
  { id:"lodge", name:"Writers Lodge", kinds:["writer"], icon:"✍️", dues:0.2, perk:"+1 SP per 10 weeks · script credit bonus · +3% minimum fee" },
  { id:"circle", name:"Directors Circle", kinds:["director"], icon:"🎬", dues:0.3, perk:"+1 SP per 10 weeks · critic goodwill · +3% minimum fee" },
  { id:"alliance", name:"Producers Alliance", kinds:["producer"], icon:"🎫", dues:0.25, perk:"+1 SP per 10 weeks · smoother overruns · +3% minimum fee" }
];

/* ═══════════════════════════════════════════════════════════
   v30 — LIVE TV / STREAMING / EVENTS SYSTEM
   ═══════════════════════════════════════════════════════════ */

/* ── Linear TV Channels (Live TV) ──
   Channels broadcast 24/7 with scheduled programming blocks.
   Player can buy/launch channels, acquire rights, sell ad slots. */
DATA.LIVE_CHANNELS = [
  {id:"bow_movies", name:"BOW Movies", emoji:"🎬", type:"movies", genrePref:["action","scifi","fantasy","animation","comedy","thriller"], baseViewers:1.2, adRate:0.8, cost:15, desc:"Blockbuster & family movies. Prime-time gold."},
  {id:"bow_prestige", name:"BOW Prestige", emoji:"🏛", type:"prestige", genrePref:["drama","musical","war","western","documentary","truecrime"], baseViewers:0.6, adRate:1.5, cost:12, desc:"Awards bait, cinema classics. High CPM, niche audience."},
  {id:"bow_action", name:"BOW Action", emoji:"💥", type:"genre", genrePref:["action","war","sports","concert"], baseViewers:0.9, adRate:1.0, cost:10, desc:"Adrenaline 24/7. Male 18-49 sweet spot."},
  {id:"bow_family", name:"BOW Family", emoji:"👨‍👩‍👧‍👦", type:"family", genrePref:["animation","comedy","fantasy","musical","concert"], baseViewers:1.0, adRate:0.9, cost:8, desc:"Co-viewing king. Advertisers love the whole family."},
  {id:"bow_late", name:"BOW After Dark", emoji:"🌙", type:"late", genrePref:["horror","thriller","truecrime","concert"], baseViewers:0.4, adRate:1.8, cost:6, desc:"Cult following. Horror/thriller midnight movies."},
  {id:"bow_sports", name:"BOW Sports", emoji:"🏟", type:"sports", genrePref:["sports","concert"], baseViewers:1.5, adRate:2.2, cost:25, desc:"Live sports rights. Massive reach, premium ads."},
  {id:"bow_news", name:"BOW News", emoji:"📰", type:"news", genrePref:[], baseViewers:0.8, adRate:1.2, cost:5, desc:"Breaking news, entertainment edition. Low cost, steady."},
  {id:"bow_kids", name:"BOW Kids", emoji:"🧸", type:"kids", genrePref:["animation","family"], baseViewers:0.7, adRate:1.3, cost:7, desc:"Cartoons & family films. Toy ads print money."},
];

/* Channel time slots (24 slots = 1 hour each) */
DATA.CHANNEL_SLOTS = [
  {h:0, label:"12am", prime:false, mult:0.15},
  {h:1, label:"1am", prime:false, mult:0.10},
  {h:2, label:"2am", prime:false, mult:0.08},
  {h:3, label:"3am", prime:false, mult:0.07},
  {h:4, label:"4am", prime:false, mult:0.06},
  {h:5, label:"5am", prime:false, mult:0.08},
  {h:6, label:"6am", prime:false, mult:0.20},
  {h:7, label:"7am", prime:false, mult:0.35},
  {h:8, label:"8am", prime:false, mult:0.40},
  {h:9, label:"9am", prime:false, mult:0.45},
  {h:10, label:"10am", prime:false, mult:0.50},
  {h:11, label:"11am", prime:false, mult:0.55},
  {h:12, label:"12pm", prime:false, mult:0.60},
  {h:13, label:"1pm", prime:false, mult:0.65},
  {h:14, label:"2pm", prime:false, mult:0.70},
  {h:15, label:"3pm", prime:false, mult:0.80},
  {h:16, label:"4pm", prime:false, mult:0.95},
  {h:17, label:"5pm", prime:false, mult:1.10},
  {h:18, label:"6pm", prime:true, mult:1.30},
  {h:19, label:"7pm", prime:true, mult:1.50},
  {h:20, label:"8pm", prime:true, mult:1.60},
  {h:21, label:"9pm", prime:true, mult:1.55},
  {h:22, label:"10pm", prime:true, mult:1.35},
  {h:23, label:"11pm", prime:false, mult:0.80},
];

/* Programming block types for channel scheduling */
DATA.PROGRAM_BLOCKS = [
  {id:"movie", label:"Feature Film", dur:2, cost:0, revenue:"ads", desc:"2hr movie block. Ad revenue by viewers."},
  {id:"double_feature", label:"Double Feature", dur:4, cost:0, revenue:"ads", desc:"4hr back-to-back. Strong retention."},
  {id:"marathon", label:"Franchise Marathon", dur:6, cost:0, revenue:"ads", desc:"6hr binge. Super-fans stay all night."},
  {id:"series", label:"Series Block", dur:1, cost:0, revenue:"ads", desc:"1hr episodic. Builds appointment viewing."},
  {id:"live_event", label:"Live Event", dur:3, cost:0, revenue:"ads+premium", desc:"Live premiere/awards/sports. Premium CPM."},
  {id:"special", label:"Behind-the-Scenes Special", dur:1, cost:1, revenue:"ads", desc:"Making-of, interviews. Low cost filler."},
  {id:"rerun", label:"Library Rerun", dur:1, cost:0, revenue:"ads", desc:"Cheap filler from your library."},
  {id:"infomercial", label:"Paid Programming", dur:1, cost:0, revenue:"fixed", desc:"Guaranteed $0.05M/slot. No viewers needed."},
];

/* ── Streaming Platform (VOD + Live) ──
   Your owned streaming service. Compete with StreamFlix, BingeBox, etc. */
DATA.STREAMING = {
  tiers: [
    {id:"free", name:"Free (AVOD)", emoji:"🆓", price:0, adLoad:8, viewers:1.0, desc:"Ad-supported. Max reach."},
    {id:"basic", name:"Basic", emoji:"📺", price:5.99, adLoad:0, viewers:0.35, desc:"Ad-free HD. Steady subs."},
    {id:"premium", name:"Premium 4K", emoji:"✨", price:12.99, adLoad:0, viewers:0.20, desc:"4K HDR, 4 streams. Whales."},
    {id:"live", name:"Live TV Add-on", emoji:"🔴", price:9.99, adLoad:0, viewers:0.15, desc:"Linear channels + DVR. Cord-cutters."},
  ],
  contentTypes: [
    {id:"film", label:"Film", revShare:0.70, window:45},
    {id:"series", label:"Series", revShare:0.75, window:0},
    {id:"live", label:"Live Channel", revShare:0.85, window:0},
    {id:"event", label:"Live Event", revShare:0.90, window:0},
    {id:"shorts", label:"Shorts/Clips", revShare:0.50, window:0},
  ],
  metrics: {
    churnBase: 0.045,      // 4.5% monthly
    churnContent: -0.015,  // per 10 quality pts above 60
    churnPrice: 0.008,     // per $1 above $10
    acquisitionCost: 45,   // $ per sub
    arpuAd: 2.5,           // $/month free tier
  },
};

/* ── Live Events Calendar ──
   Major tentpole events player can bid for rights, produce, or cover. */
DATA.LIVE_EVENTS = [
  // Awards Season
  {id:"oscars", name:"Academy Awards", emoji:"🏆", type:"awards", week:8, dur:1, prestige:100, viewers:18, adRate:4.5, rightsCost:120, categories:["best_picture","director","actor","actress","script"], desc:"The big night. Your nominees = free marketing."},
  {id:"globes", name:"Golden Globes", emoji:"🌐", type:"awards", week:4, dur:1, prestige:75, viewers:12, adRate:3.2, rightsCost:60, categories:["drama","comedy","director","actor","actress"], desc:"Boozy precursor. Sets Oscar narratives."},
  {id:"emmys", name:"Emmy Awards", emoji:"📺", type:"awards", week:36, dur:1, prestige:65, viewers:8, adRate:2.8, rightsCost:40, categories:["drama","comedy","limited","actor","actress"], desc:"TV's biggest night. Your shows shine."},
  {id:"guilds", name:"Guild Awards (SAG/DGA/WGA)", emoji:"🎭", type:"awards", week:6, dur:1, prestige:60, viewers:5, adRate:2.0, rightsCost:25, categories:["ensemble","director","writer"], desc:"Industry-voted. Best Oscar predictor."},
  {id:"critics", name:"Critics Choice", emoji:"⭐", type:"awards", week:5, dur:1, prestige:50, viewers:4, adRate:1.8, rightsCost:18, categories:["picture","director","acting"], desc:"Critics' darlings. Momentum builder."},

  // Film Festivals
  {id:"cannes", name:"Cannes Film Festival", emoji:"🇫🇷", type:"festival", week:20, dur:2, prestige:95, viewers:2, adRate:1.5, rightsCost:0, market:true, buyers:25, desc:"Palme d'Or hunt. Market = buy/sell rights."},
  {id:"venice", name:"Venice Film Festival", emoji:"🇮🇹", type:"festival", week:34, dur:2, prestige:90, viewers:1.5, adRate:1.3, rightsCost:0, market:true, buyers:20, desc:"Fall festival launchpad. Oscar buzz starts here."},
  {id:"tiff", name:"Toronto (TIFF)", emoji:"🇨🇦", type:"festival", week:37, dur:2, prestige:85, viewers:2.5, adRate:1.4, rightsCost:0, market:true, buyers:30, desc:"People's Choice = Oscar frontrunner. Big market."},
  {id:"sundance", name:"Sundance", emoji:"🏔", type:"festival", week:4, dur:2, prestige:80, viewers:1, adRate:1.0, rightsCost:0, market:true, buyers:35, desc:"Indie mecca. Breakout hits & bidding wars."},
  {id:"berlin", name:"Berlinale", emoji:"🇩🇪", type:"festival", week:10, dur:2, prestige:75, viewers:0.8, adRate:0.9, rightsCost:0, market:true, buyers:18, desc:"Political, arty. Golden Bear prestige."},
  {id:"sxsw", name:"SXSW", emoji:"🎸", type:"festival", week:11, dur:2, prestige:60, viewers:1.2, adRate:1.1, rightsCost:0, market:true, buyers:22, desc:"Tech+film+music. Genre breakouts live here."},

  // Major Premieres (your films)
  {id:"premiere_la", name:"LA Premiere", emoji:"🌴", type:"premiere", week:0, dur:0.5, prestige:30, viewers:0.5, adRate:2.0, rightsCost:0, desc:"Red carpet. Press junket. Hype engine."},
  {id:"premiere_nyc", name:"NYC Premiere", emoji:"🗽", type:"premiere", week:0, dur:0.5, prestige:28, viewers:0.4, adRate:1.8, rightsCost:0, desc:"East coast launch. Critics screenings."},
  {id:"premiere_london", name:"London Premiere", emoji:"🇬🇧", type:"premiere", week:0, dur:0.5, prestige:25, viewers:0.3, adRate:1.5, rightsCost:0, desc:"European launch. Intl press."},
  {id:"premiere_tokyo", name:"Tokyo Premiere", emoji:"🇯🇵", type:"premiere", week:0, dur:0.5, prestige:22, viewers:0.35, adRate:1.6, rightsCost:0, desc:"Asian market kickoff. Anime/manga collabs."},

  // Sports (licensed)
  {id:"superbowl", name:"Super Bowl", emoji:"🏈", type:"sports", week:5, dur:1, prestige:40, viewers:110, adRate:7.0, rightsCost:500, exclusive:true, desc:"Biggest TV event. Halftime = cultural moment."},
  {id:"worldcup", name:"FIFA World Cup Final", emoji:"⚽", type:"sports", week:0, dur:1, prestige:45, viewers:90, adRate:6.0, rightsCost:400, exclusive:true, freq:208, desc:"Every 4 years. Global phenomenon."},
  {id:"olympics", name:"Olympic Games", emoji:"🏅", type:"sports", week:0, dur:14, prestige:50, viewers:60, adRate:4.0, rightsCost:800, exclusive:true, freq:208, desc:"17 days. Multi-sport. National pride."},
  {id:"nba_finals", name:"NBA Finals", emoji:"🏀", type:"sports", week:24, dur:14, prestige:35, viewers:15, adRate:3.5, rightsCost:180, exclusive:false, desc:"Best-of-7. Urban demo. Sneaker culture."},
  {id:"world_series", name:"World Series", emoji:"⚾", type:"sports", week:42, dur:10, prestige:30, viewers:12, adRate:3.0, rightsCost:120, exclusive:false, desc:"Fall classic. Family co-viewing."},

  // Cultural Events
  {id:"met_gala", name:"Met Gala", emoji:"👗", type:"cultural", week:18, dur:1, prestige:40, viewers:3, adRate:2.5, rightsCost:15, desc:"Fashion's biggest night. Celebrity = buzz."},
  {id:"comic_con", name:"San Diego Comic-Con", emoji:"🦸", type:"cultural", week:28, dur:4, prestige:55, viewers:1.5, adRate:1.8, rightsCost:10, market:true, buyers:50, desc:"Fandom central. Trailers drop. IP deals happen."},
  {id:"d23", name:"D23 Expo", emoji:"✨", type:"cultural", week:32, dur:3, prestige:50, viewers:2, adRate:2.0, rightsCost:8, market:true, buyers:30, desc:"Disney's show. But every studio shows up."},
];

/* Event participation types for player */
DATA.EVENT_PARTICIPATION = [
  {id:"broadcast", label:"Broadcast Rights", costMult:1.0, revenue:"ads", control:0.3, desc:"Air the event. Sell ads. No creative control."},
  {id:"produce", label:"Produce Coverage", costMult:1.5, revenue:"ads+sponsor", control:0.7, desc:"Your crew, your talent. Sponsorship packages."},
  {id:"host", label:"Host Ceremony", costMult:2.0, revenue:"ads+sponsor+license", control:1.0, desc:"Own the IP. License globally. Maximum upside."},
  {id:"submit", label:"Submit Film/Series", costMult:0.1, revenue:"prestige", control:0.0, desc:"Enter your content. Win = marketing rocket fuel."},
];

/* Ad inventory & pricing */
DATA.AD_INVENTORY = {
  tv: {
    spot30: {base:0.05, primeMult:3.0, targetMult:{18_49:1.5, 25_54:1.3, families:1.2}},
    spot60: {base:0.09, primeMult:2.8, targetMult:{18_49:1.4, 25_54:1.2, families:1.1}},
    sponsorship: {base:0.5, primeMult:2.0, targetMult:{18_49:1.6, 25_54:1.4}},
    integration: {base:1.0, primeMult:1.5, targetMult:{18_49:1.8, 25_54:1.5}}, // branded content
  },
  streaming: {
    preRoll: {base:0.015, cpm:25},
    midRoll: {base:0.025, cpm:35},
    postRoll: {base:0.008, cpm:18},
    pause: {base:0.012, cpm:30},
    sponsored: {base:0.05, cpm:50}, // sponsored content row
  },
};

/* Rights acquisition market (for films/series to air on your channels/streaming) */
DATA.RIGHTS_MARKET = {
  windows: [
    {name:"Pay-1 (First Window)", weeks:0, mult:1.0, desc:"Day-and-date with theatrical/streaming premiere"},
    {name:"Pay-2 (Early)", weeks:12, mult:0.7, desc:"After PVOD/early streaming"},
    {name:"Pay-3 (Library)", weeks:52, mult:0.35, desc:"Deep library. Cheap filler."},
    {name:"Syndication", weeks:104, mult:0.2, desc:"Rerun rights. Pennies per play."},
  ],
  genrePremium: {action:1.2, horror:1.15, comedy:1.1, animation:1.25, sports:2.0, concert:1.3, documentary:0.8},
  freshnessDecay: 0.005, // per week after window opens
};

/* ── Live On-Air Hosts & Animated Personalities ── */
DATA.LIVE_HOSTS = [
  {
    id: "rex",
    name: "Rex Sterling",
    role: "Chief News & Primetime Anchor",
    avatar: "male-show",
    color: "#3b82f6",
    quote: "Good evening, Hollywood. Tonight the box office numbers speak for themselves.",
    perk: "+15% news & movie broadcast viewers",
    specialty: "movies",
    trait: "Gravitas"
  },
  {
    id: "chloe",
    name: "Chloe Glamour",
    role: "Red Carpet & Gala Hostess",
    avatar: "female-show",
    color: "#f5b942",
    quote: "Darlings! The fashion, the stars, the drama—it is all happening live on our carpet!",
    perk: "+25% premiere & awards show buzz",
    specialty: "prestige",
    trait: "Glamour"
  },
  {
    id: "buck",
    name: "Coach Buck",
    role: "Live Sports & Action Caster",
    avatar: "male-cheer",
    color: "#22c55e",
    quote: "Unbelievable play! The crowd is on their feet and the ratings are through the roof!",
    perk: "+30% sports rights & action broadcast reach",
    specialty: "sports",
    trait: "High Voltage"
  },
  {
    id: "reely",
    name: "Reely the Reel",
    role: "Animated Studio Mascot",
    avatar: "mascot",
    color: "#a855f7",
    quote: "Roll camera! Pop the corn! We are making cinema history every single week!",
    perk: "+20% kids & family animation ratings",
    specialty: "family",
    trait: "Playful"
  }
];

DATA.liveChannel = (id) => (DATA.LIVE_CHANNELS || []).find(c => c.id === id);
DATA.liveEvent = (id) => (DATA.LIVE_EVENTS || []).find(e => e.id === id);
DATA.liveHost = (id) => (DATA.LIVE_HOSTS || []).find(h => h.id === id);

/* Live tab state (added to game state) */
DATA.LIVE_DEFAULTS = {
  channels: [],           // owned channels {id, schedule[24], adSold[24]}
  activeChannel: "bow_movies",
  activeHost: "rex",
  subTab: "linear",
  streaming: {            // streaming service state
    live: false,
    topic: "feature_premiere",
    quality: "1080p",
    ccv: 1.2,
    peakCcv: 1.2,
    totalHours: 0,
    subConversions: 0,
    chatMessages: []
  },
  events: {               // event participation
    bids: {},             // active rights bids
    won: [],              // won rights {eventId, type, week}
    produced: [],         // produced coverage {eventId, week, cost, revenue}
    submissions: {},      // festival submissions {festId: filmId}
    premieres: []         // hosted premieres
  },
  hosts: {
    rex: { level: 1, xp: 0, charisma: 75, energy: 90 },
    chloe: { level: 1, xp: 0, charisma: 82, energy: 95 },
    buck: { level: 1, xp: 0, charisma: 78, energy: 88 },
    reely: { level: 1, xp: 0, charisma: 70, energy: 100 }
  },
  adSales: {              // ad inventory sold
    tv: {},               // {channelId_slot: {advertiser, rate, weeks}}
    streaming: {},        // {format: {sold, rate}}
  },
  schedule: [],           // unified schedule for UI
};

/* ── SAVE_VERSION bump for v30 ── */
DATA.SAVE_VERSION = 14;

