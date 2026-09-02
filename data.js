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
];
/* platform lookup also includes streamers that entered mid-game (platform subscriber wars) */
DATA.allPlatforms = ()=>{
  const extra = (typeof G!=="undefined" && G && G.extraPlatforms)? G.extraPlatforms : [];
  return DATA.PLATFORMS.concat(extra);
};
DATA.platform = (id)=> DATA.allPlatforms().find(p=>p.id===id) || DATA.PLATFORMS.find(p=>p.id===id) || {name:"?", color:"#555", logo:"?"};
DATA.NEWSTREAMERS = ["VortexTV","PeakPlay","Fable+","Nebula Now","Zenith+","Bolt Stream"];

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
DATA.FESTIVALS = [
  {woy:9,  name:"Snowfall Festival",      emoji:"❄️", blurb:"The indie marketplace. Scrappy discoveries get bought here.",
   loves:["drama","thriller","truecrime","horror","romance"], prestige:1.0, market:1.5},
  {woy:20, name:"Azure Coast Festival",   emoji:"🌴", blurb:"The pale-blue carpet. Auterurs, foreign-language gems and scandal.",
   loves:["drama","musical","romance","fantasy","western"], prestige:1.4, market:1.1, foreign:true},
  {woy:36, name:"Laguna Film Festival",   emoji:"🛶", blurb:"Old-world prestige: where awards season quietly begins.",
   loves:["drama","war","musical","animation","romance"], prestige:1.2, market:1.2},
  {woy:43, name:"Harvest Telluride",      emoji:"🍂", blurb:"No market, no fuss — pure awards-momentum screening room.",
   loves:["drama","western","war","thriller","truecrime"], prestige:0.9, market:0.7},
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

/* ── Studio upgrades ── */
DATA.UPGRADES = [
  {id:"marketing", name:"In-house Marketing Dept", icon:"📣", cost:60,  desc:"+10% marketing power on every release hype."},
  {id:"vfx",       name:"VFX Division",            icon:"✨", cost:80,  desc:"Post-production costs −25%. Tentpole quality +3."},
  {id:"backlot",   name:"Studio Backlot",          icon:"🏗", cost:100, desc:"Shooting costs −12% on all productions."},
  {id:"agency",    name:"Talent Relations Office", icon:"🤝", cost:55,  desc:"Talent signing fees −15%."},
  {id:"ottrel",    name:"Streaming Relations",     icon:"🛰", cost:70,  desc:"All OTT offers +12%. Better renewal odds."},
];

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

/* ── Save schema v5 (see migrateSave step 5 in engine.js) ── */
DATA.SAVE_VERSION = 5;

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
