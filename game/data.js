/* Box Office War — rebuilt. Static data & name banks.
   Money in $M. Tuning distilled from the v41 engine audit (see rebuild-notes/engine-audit.md). */
"use strict";

var GENRES = [
  { id: "action",   name: "Action",      em: "💥", mass: 1.25, legs: -0.10, intl: 0.62, open: 1.00, critic: -2, aud: +2 },
  { id: "comedy",   name: "Comedy",      em: "😂", mass: 1.00, legs: -0.05, intl: 0.42, open: 0.95, critic: -1, aud: +2 },
  { id: "drama",    name: "Drama",       em: "🎭", mass: 0.78, legs: +0.25, intl: 0.52, open: 0.80, critic: +6, aud: -4 },
  { id: "horror",   name: "Horror",      em: "👻", mass: 0.95, legs: -0.35, intl: 0.40, open: 1.45, critic: -5, aud: +3 },
  { id: "scifi",    name: "Sci-Fi",      em: "🚀", mass: 1.15, legs:  0.00, intl: 0.60, open: 1.00, critic:  0, aud: +2 },
  { id: "romance",  name: "Romance",     em: "❤️", mass: 0.82, legs:  0.00, intl: 0.45, open: 0.85, critic: -2, aud: +2 },
  { id: "thriller", name: "Thriller",    em: "🔪", mass: 0.95, legs: +0.05, intl: 0.55, open: 0.95, critic: +2, aud:  0 },
  { id: "animation",name: "Animation",   em: "🎨", mass: 1.20, legs: +0.45, intl: 0.58, open: 1.05, critic: +3, aud: +5 },
  { id: "fantasy",  name: "Fantasy",     em: "🐉", mass: 1.10, legs: +0.10, intl: 0.62, open: 1.00, critic: -1, aud: +2 },
  { id: "crime",    name: "Crime",       em: "🕵️", mass: 0.85, legs: +0.15, intl: 0.48, open: 0.85, critic: +4, aud: -2 },
  { id: "musical",  name: "Musical",     em: "🎵", mass: 0.75, legs: +0.30, intl: 0.50, open: 0.80, critic: +1, aud: +2 },
  { id: "docs",     name: "Documentary", em: "🎥", mass: 0.50, legs: +0.20, intl: 0.35, open: 0.55, critic: +8, aud: -6 }
];
function genreOf(id) { for (var i = 0; i < GENRES.length; i++) if (GENRES[i].id === id) return GENRES[i]; return GENRES[0]; }

/* Production scales. budgets = three pickable sizes; weeks = [min,max] per phase. */
var SCALES = [
  { id: "micro",    name: "Micro",      budgets: [3, 5, 8],     openBase: 4.5,  mktRate: 0.45, pre: [1, 2], shoot: [2, 3], post: [1, 2], rep: 0 },
  { id: "indie",    name: "Indie",      budgets: [10, 16, 24],  openBase: 11,   mktRate: 0.50, pre: [2, 3], shoot: [4, 6], post: [3, 5], rep: 0 },
  { id: "mid",      name: "Mid-budget", budgets: [30, 55, 80],  openBase: 34,   mktRate: 0.55, pre: [2, 4], shoot: [6, 9], post: [5, 8], rep: 30 },
  { id: "tentpole", name: "Tentpole",   budgets: [90, 140, 200],openBase: 105,  mktRate: 0.80, pre: [3, 5], shoot: [9, 13], post: [8, 12], rep: 55 }
];
function scaleOf(id) { for (var i = 0; i < SCALES.length; i++) if (SCALES[i].id === id) return SCALES[i]; return SCALES[0]; }

/* Marketing tiers: spend expressed as a multiple of the recommended spend (budget × mktRate). */
var MKT_TIERS = [
  { id: "whisper",name: "Whisper",  mult: 0.05 },
  { id: "min",  name: "Minimal", mult: 0.30 },
  { id: "std",  name: "Standard",mult: 1.00 },
  { id: "heavy",name: "Heavy",   mult: 1.80 },
  { id: "blitz",name: "Blitz",   mult: 3.00 }
];

/* Star fees by power (1-5), scaled to the film's budget at hire time. */
var FEE_ACTOR = [0.4, 1.5, 5, 12, 26];
var FEE_DIR   = [1.0, 2.5, 6, 11, 20];

/* Talent abilities (one per person, rolled at generation). */
var ABILITIES = [
  { id: "crowd",     n: "Box-office anchor",   d: "+8% opening" },
  { id: "award",     n: "Award magnet",        d: "+3 quality" },
  { id: "method",    n: "Method legend",       d: "+2 quality, +1 pre-production week" },
  { id: "franchise", n: "Franchise magnet",    d: "+8% opening on sequels" },
  { id: "shield",    n: "Critical shield",     d: "critics +3" },
  { id: "bankable",  n: "Bankable",            d: "fee -15%" },
  { id: "legs",      n: "Long-runner",         d: "+0.10 legs" },
  { id: "intl",      n: "International star",  d: "+10% international" },
  { id: "fast",      n: "Fast shooter",        d: "-2 shoot weeks, no overruns" },
  { id: "improv",    n: "Improv master",       d: "+4 quality" },
  { id: "cult",      n: "Cult icon",           d: "+35% streaming value" }
];

/* Studio origins. */
var ORIGINS = [
  { id: "indie",   name: "Indie Darling",    cash: 35,  rep: 20, overhead: 0.10, perk: "Sharp instincts — scripts cost 25% less." },
  { id: "veteran", name: "Studio Veteran",   cash: 80,  rep: 35, overhead: 0.40, perk: "A respected name — reputation opens doors." },
  { id: "major",   name: "Media Conglomerate", cash: 160, rep: 50, overhead: 1.20, perk: "Deep pockets — tentpoles greenlit from day one." }
];

/* Facilities you can build, level by level. */
var UPGRADES = {
  post:    { name: "Post-production wing", levels: [ { cost: 25, desc: "+3 craft on every film" },   { cost: 60, desc: "+3 more craft" },   { cost: 120, desc: "+3 more craft" } ] },
  backlot: { name: "Backlot & stages",     levels: [ { cost: 18, desc: "Fewer production overruns" }, { cost: 45, desc: "Even fewer overruns" }, { cost: 90, desc: "Runaways fear you" } ] }
};

/* Rival studios. */
var RIVAL_DEFS = [
  { name: "Meridian Pictures", style: "tentpole" },
  { name: "Solstice Films",    style: "prestige" },
  { name: "Titan Global",      style: "tentpole" },
  { name: "Crown & Banner",    style: "genre" }
];

/* Named critics: a harshness bias plus genres they love or hate. */
var CRITICS = [
  { n: "Vivian Cho, The Rollstone Journal", harsh: -2, loves: ["drama", "crime"],      hates: ["horror", "action"] },
  { n: "Marcus Bell, Screen Daily Gazette", harsh: -4, loves: ["scifi", "thriller"],   hates: ["romance", "musical"] },
  { n: "Priya Anand, Cinephile Wire",       harsh: +2, loves: ["docs", "drama"],       hates: ["comedy"] },
  { n: "Hal Wexler, Marquee & Reel",        harsh: 0,  loves: ["action", "fantasy"],   hates: ["docs"] },
  { n: "June Park, The Screening Room",     harsh: +1, loves: ["animation", "musical"],hates: ["crime"] },
  { n: "Dov Rabin, Celluloid Report",       harsh: -3, loves: ["crime", "thriller"],   hates: ["musical", "docs"] },
  { n: "Sofía Reyes, Lantern Reviews",      harsh: +1, loves: ["romance", "drama"],    hates: ["horror", "scifi"] },
  { n: "Ted Okafor, Popcorn Verdict",       harsh: -1, loves: ["comedy", "action"],    hates: ["docs", "drama"] }
];

/* Name banks for talent and films. */
var FIRST_NAMES = ["Dax", "Mara", "Jude", "Selene", "Roman", "Ava", "Cole", "Nadia", "Rex", "Imogen", "Silas", "Thea", "Miles", "Zara", "Hugo", "Elena", "Cassius", "Wren", "Otto", "Livia", "Jonah", "Sable", "Felix", "Iris", "Dante", "Cleo", "Ash", "Nova", "Levi", "Maeve"];
var LAST_NAMES = ["Sterling", "Voss", "Marchetti", "Okafor", "Lindqvist", "Delacroix", "Tanaka", "Reyes", "Blackwood", "Kovac", "Ashford", "Moreau", "Santiago", "Winterbourne", "Halloran", "Petrov", "Amari", "Duval", "Kestrel", "Navarro", "Fairbanks", "Osei", "Vance", "Marlowe", "Ibarra", "Thorne", "Castellanos", "Wilder", "Sinclair", "Adeyemi"];

var TITLE_A = ["Crimson", "Midnight", "Broken", "Golden", "Silent", "Electric", "Forgotten", "Neon", "Savage", "Velvet", "Iron", "Paper", "Wild", "Last", "Hidden", "Scarlet", "Hollow", "Distant", "Sacred", "Restless"];
var TITLE_B = ["Horizon", "Empire", "Sky", "Witness", "Reckoning", "Season", "Signal", "Crown", "Tide", "Echo", "Legacy", "Hour", " Kingdom", "Circuit", "Veil", "Storm", "Heist", "Dance", "Frontier", "Letter"];

/* Review quote banks (slots: {T} title). */
var QUOTE_GOOD = [
  "\u201C{S} is the real thing — confident, alive, and impossible to shake.\u201D",
  "\u201CA triumph. {S} announces a studio at the top of its game.\u201D",
  "\u201CYou will laugh, you will gasp, and you will not forget {S}.\u201D",
  "\u201CThe year's most purely enjoyable night at the movies: {S}.\u201D",
  "\u201C{S} earns every frame. Devastating and delightful.\u201D"
];
var QUOTE_MID = [
  "\u201C{S} is solid, watchable, and a little safe.\u201D",
  "\u201CFine craftsmanship, modest ambition — {S} delivers exactly what it promises.\u201D",
  "\u201C{S} coasts on charm when it should sprint.\u201D"
];
var QUOTE_BAD = [
  "\u201C{S} is a beautiful poster wrapped around a hollow movie.\u201D",
  "\u201CA misfire from frame one. {S} never finds its footing.\u201D",
  "\u201C{S} plays like a rough cut of a better film that got away.\u201D",
  "\u201CI have seen summer marketing budgets better spent than {S}.\u201D"
];

/* Random weekly events. */
var EVENT_ICONS = { scandal: "🚨", rave: "🏅", meme: "📱", econ: "📈", festival: "🏆", chatter: "🗞️" };

/* Themes — hidden genre chemistry on development ideas. */
var THEMES = [
  { id: "heist",     n: "Heist gone wrong",       loves: ["crime", "thriller", "action"] },
  { id: "second",    n: "Second chances",         loves: ["drama", "romance", "musical"] },
  { id: "ai",        n: "Rogue AI",               loves: ["scifi", "thriller"] },
  { id: "smalltown", n: "Small-town secrets",     loves: ["drama", "crime", "romance"] },
  { id: "revenge",   n: "Cold revenge",           loves: ["action", "thriller", "crime"] },
  { id: "foundfam",  n: "Found family",           loves: ["animation", "comedy", "fantasy"] },
  { id: "haunt",     n: "The house remembers",    loves: ["horror", "thriller"] },
  { id: "underdog",  n: "Underdog triumph",       loves: ["comedy", "musical", "romance"] },
  { id: "plague",    n: "The spreading dark",     loves: ["horror", "scifi"] },
  { id: "legacy",    n: "Legacy & inheritance",   loves: ["drama", "fantasy", "crime"] }
];

/* Start scenarios. */
var SCENARIOS = [
  { id: "free",       n: "Free studio",       d: "No goal — build your empire at your own pace." },
  { id: "lab",        n: "First Film Lab",    d: "Start $25M. Goal: your first profitable release within 60 weeks.", cash: 25, rep: 15, goal: { kind: "firstProfit", weeks: 60 } },
  { id: "turnaround", n: "Turnaround",        d: "Start $5M — and $80M in debt. Goal: reach $50M cash within 104 weeks.", cash: 5, debt: 80, goal: { kind: "cash", target: 50, weeks: 104 } },
  { id: "franchise",  n: "Franchise empire",  d: "Goal: three recouped musicals, or reputation 80, within 260 weeks.", goal: { kind: "franchise", weeks: 260 } }
];
