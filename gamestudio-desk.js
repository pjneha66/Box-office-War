/* ═════════════════════════════════════════════════════════════════════════
   GAMESTUDIO-DESK.JS — The Kairo-style Game Studio loop (Box Office War v37)
   ─────────────────────────────────────────────────────────────────────────
   A cohesive, self-contained game-development division engine:

   Phase 1  Planning & Proposal .... platform / genre / theme / directions / author
   Phase 2  Production Pipeline .... Alpha→Fun+Creativity, Beta→Graphics,
                                     Master→Sound, Debug→bug squash
   Phase 3  Bug → Research Data ... each squashed bug yields 1 floppy disk;
                                     shipping with bugs penalises reviews & sales
   Phase 4  Review Calculation .... 4 critics ×1–10 = /40 (Hall of Fame ≥32)
   Phase 5  Sales Decay Engine .... 8–12 week curve, December holiday surge,
                                     100K/1M/5M/10M/20M milestones
   Phase 6  Global Game Awards ..... December week 3, 5 categories + prize money

   Plus the progression economy: 8-job career tree levelled with Research Data,
   20 genres & a genre×theme synergy matrix, hardware platform licences and an
   in-house "Your Console", office tiers/skins, the traveling merchant's boost
   items, training/theme discovery, outsourced contracts, fatigue & burnout,
   market saturation, the 32-title rolling buffer, secret characters and the
   emergency bailout.

   Design rules (matching the rest of the codebase):
     • Pure, dependency-light: every function takes the state `G` explicitly and
       falls back to the module-scoped globals only when they exist. This makes
       the whole engine unit-testable in plain Node (no DOM).
     • Money is in $M (millions), the game's native unit; spec dollar figures are
       stored as dollars/1e6 so fmtM() prints the intended K/M values.
     • One shared source of truth: the UI, tests and tick all read the SAME
       helpers. A refused action returns {ok:false, reason}.
     • No invented UI numbers: calclab helpers (reviewPreview, salesPreview,
       directionCapacity …) are exposed for the view.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (global) {
  /* ─────────────────────────── tiny numeric toolkit ─────────────────────── */
  let _rng = Math.random;
  const rnd = () => _rng();
  const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const chance = (p) => rnd() < p;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const roundK = (v) => Math.round(v * 1000) / 1000; /* nearest $1K (0.001M) */
  const num = (v, d) => (Number.isFinite(v) ? v : d || 0);
  const woy = (w) => ((num(w, 1) - 1) % 52) + 1;
  const yearOf = (w) => Math.floor((num(w, 1) - 1) / 52) + 1;

  /* ─────────────────────────── state access ───────────────────────────── */
  function _getG(st) {
    if (st && typeof st === "object" && (st.studio || st.week !== undefined)) return st;
    try { if (typeof G !== "undefined") return G; } catch (e) {}
    if (global && global.G) return global.G;
    if (typeof window !== "undefined" && window.G) return window.G;
    return null;
  }
  function _cash(G) { return G && G.studio ? num(G.studio.cash, 0) : num(G && G.cash, 0); }
  function _money(G, delta) {
    /* The engine's earn()/spend() round to 0.1M, which would silently zero the
       K-scale contract/item fees this division uses. Mutate at $1K (0.001M)
       precision here and keep the P&L ledger in sync by hand. */
    delta = roundK(delta);
    if (G && G.studio && typeof G.studio.cash === "number") G.studio.cash = roundK(G.studio.cash + delta);
    else if (G && typeof G.cash === "number") G.cash = roundK(G.cash + delta);
    if (G && G.weekTx) G.weekTx.games = roundK((G.weekTx.games || 0) + delta);
  }
  function _log(G, text, kind) {
    if (typeof global.log === "function") { try { global.log(text, kind || ""); return; } catch (e) {} }
    if (G) { G.news = G.news || []; G.news.unshift({ t: text, k: kind || "", w: G.week }); }
  }
  function _save() { if (typeof global.saveGame === "function") { try { global.saveGame(); } catch (e) {} } }

  /* ─────────────────────────── DATA TABLES ────────────────────────────── */

  /* 20 genres (Zyanru). costMult scales the dev budget; base weights shape
     which production phase matters most to a critic. */
  const GENRES = [
    { id: "rpg",        name: "RPG",          emoji: "⚔️", costMult: 1.3, w: { fun: .30, cre: .30, gfx: .20, snd: .20 } },
    { id: "simulation", name: "Simulation",   emoji: "🏗️", costMult: 1.1, w: { fun: .30, cre: .25, gfx: .25, snd: .20 } },
    { id: "table",      name: "Table",        emoji: "🎲", costMult: .7,  w: { fun: .35, cre: .25, gfx: .20, snd: .20 } },
    { id: "action",     name: "Action",       emoji: "💥", costMult: 1.2, w: { fun: .35, cre: .20, gfx: .30, snd: .15 } },
    { id: "adventure",  name: "Adventure",    emoji: "🧭", costMult: 1.1, w: { fun: .25, cre: .35, gfx: .25, snd: .15 } },
    { id: "shooter",    name: "Shooter",      emoji: "🔫", costMult: 1.2, w: { fun: .35, cre: .15, gfx: .35, snd: .15 } },
    { id: "action_rpg", name: "Action RPG",   emoji: "🗡️", costMult: 1.4, w: { fun: .30, cre: .30, gfx: .25, snd: .15 } },
    { id: "racing",     name: "Racing",       emoji: "🏎️", costMult: 1.0, w: { fun: .35, cre: .15, gfx: .35, snd: .15 } },
    { id: "online_rpg", name: "Online RPG",   emoji: "🌐", costMult: 1.6, w: { fun: .30, cre: .25, gfx: .25, snd: .20 } },
    { id: "online_sim", name: "Online Sim",   emoji: "🛰️", costMult: 1.4, w: { fun: .30, cre: .25, gfx: .25, snd: .20 } },
    { id: "trivia",     name: "Trivia",       emoji: "❓", costMult: .5,  w: { fun: .35, cre: .30, gfx: .15, snd: .20 } },
    { id: "life",       name: "Life",         emoji: "🌱", costMult: .8,  w: { fun: .35, cre: .30, gfx: .15, snd: .20 } },
    { id: "board",      name: "Board",        emoji: "♟️", costMult: .6,  w: { fun: .35, cre: .25, gfx: .20, snd: .20 } },
    { id: "puzzle",     name: "Puzzle",       emoji: "🧩", costMult: .5,  w: { fun: .35, cre: .35, gfx: .15, snd: .15 } },
    { id: "music",      name: "Music",        emoji: "🎵", costMult: .8,  w: { fun: .25, cre: .25, gfx: .15, snd: .35 } },
    { id: "audio_novel",name: "Audio Novel",  emoji: "📖", costMult: .6,  w: { fun: .20, cre: .35, gfx: .10, snd: .35 } },
    { id: "motion",     name: "Motion",       emoji: "🏃", costMult: .9,  w: { fun: .40, cre: .20, gfx: .25, snd: .15 } },
    { id: "educational",name: "Educational",  emoji: "🎓", costMult: .6,  w: { fun: .30, cre: .30, gfx: .20, snd: .20 } },
    { id: "sim_rpg",    name: "Sim RPG",      emoji: "🛡️", costMult: 1.3, w: { fun: .30, cre: .30, gfx: .25, snd: .15 } },
    { id: "card_game",  name: "Card Game",    emoji: "🃏", costMult: .7,  w: { fun: .30, cre: .30, gfx: .20, snd: .20 } }
  ];

  const THEMES = [
    "fantasy", "dungeon", "monster", "medieval", "game_co", "town", "architecture", "train",
    "bookstore", "conv_store", "ninja", "martial_arts", "superhero", "robot", "detective",
    "mystery", "time_travel", "horror", "space", "war", "motorsport", "f1_racing", "drums",
    "dance", "pop_star", "high_school", "comedy", "romance", "stocks", "zombie", "dating",
    "art", "prehistoric", "samurai", "ogre", "pirate", "desert", "cowboy", "egypt", "airplane",
    "virtual_pet", "skiing", "swimming", "golf", "slots", "pinball", "horseshoes", "sci_fi",
    "spy", "animal", "historical", "comics", "cutie", "cosplay", "law"
  ];
  const THEME_LABEL = (t) => String(t || "").split("_").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  const BASE_THEMES = ["fantasy", "space", "robot", "town", "detective", "fantasy"]; /* always available at founding */

  /* Synergistic combinations (review & sales boost) and disasters (penalties).
     Keys are "genre|theme". Multipliers feed reviewPreview()/release(). */
  const SYNERGY_BOOST = {};
  const SYNERGY_BUST = {};
  (function buildSynergy() {
    const good = {
      rpg: ["fantasy", "dungeon", "monster", "medieval"],
      simulation: ["game_co", "town", "architecture", "train", "bookstore", "conv_store"],
      action: ["ninja", "martial_arts", "superhero", "robot"],
      adventure: ["detective", "mystery", "time_travel", "horror"],
      shooter: ["space", "robot", "war"],
      racing: ["motorsport", "f1_racing"],
      music: ["drums", "dance", "pop_star"],
      card_game: ["monster", "medieval"],
      trivia: ["high_school", "comedy"],
      life: ["romance", "high_school", "dating"],
      audio_novel: ["romance", "mystery", "horror"],
      sim_rpg: ["fantasy", "medieval", "war"],
      educational: ["animal", "town", "historical"],
      motion: ["martial_arts", "ninja", "sports" ]
    };
    Object.keys(good).forEach(g => good[g].forEach(t => { SYNERGY_BOOST[g + "|" + t] = 1.35; }));
    const bad = [
      ["trivia", "space"], ["action", "stocks"], ["audio_novel", "motorsport"],
      ["educational", "zombie"], ["educational", "horror"], ["music", "war"],
      ["racing", "fantasy"], ["puzzle", "horror"]
    ];
    bad.forEach(([g, t]) => { SYNERGY_BUST[g + "|" + t] = 0.55; });
  })();
  function synergyOf(genre, theme) {
    const k = genre + "|" + theme;
    if (SYNERGY_BUST[k]) return { mult: SYNERGY_BUST[k], tier: "disaster" };
    if (SYNERGY_BOOST[k]) return { mult: SYNERGY_BOOST[k], tier: "great" };
    return { mult: 1.0, tier: "neutral" };
  }

  /* 8 company directions (Houkou). Allocation is capped by directionCapacity(). */
  const DIRECTIONS = [
    { id: "cute",          name: "Cute",           emoji: "🧸" },
    { id: "realism",       name: "Realism",        emoji: "🎯" },
    { id: "simplicity",    name: "Simplicity",     emoji: "◻️" },
    { id: "game_world",    name: "Game World",     emoji: "🌍" },
    { id: "niche_appeal",  name: "Niche Appeal",   emoji: "🔮" },
    { id: "innovation",    name: "Innovation",     emoji: "💡" },
    { id: "polish",        name: "Polish",         emoji: "✨" },
    { id: "approachability",name: "Approachability",emoji: "🤝" }
  ];

  /* Commercial hardware platforms (Hard). cost = greenlight dev budget add,
     share = platform market share, royalty = platform holder's cut, license =
     one-off dev-kit cost. `free` platforms are licensed from the start. */
  const PLATFORMS = [
    { id: "pc",           name: "PC Game",        short: "PC",        type: "Home",     media: "Floppy / CD", share: .10, royalty: .05, license: 0,   cost: 1.0, free: true },
    { id: "microx_sx",    name: "Microx SX",      short: "MSX",       type: "Home",     media: "Cartridge",   share: .06, royalty: .10, license: .3,  cost: 1.2 },
    { id: "exodus",       name: "Exodus",         short: "EX",        type: "Home",     media: "Cartridge",   share: .11, royalty: .12, license: .5,  cost: 2.0 },
    { id: "ies",          name: "IES",            short: "IES",       type: "Home",     media: "Cartridge",   share: .13, royalty: .15, license: .6,  cost: 2.2 },
    { id: "super_ies",    name: "Super IES",      short: "S-IES",     type: "Home",     media: "Cartridge",   share: .14, royalty: .15, license: .7,  cost: 2.6 },
    { id: "playstatus",   name: "PlayStatus",     short: "PS",        type: "Home",     media: "CD-ROM",      share: .22, royalty: .12, license: 1.2, cost: 4.0 },
    { id: "uranus",       name: "Uranus",         short: "URN",       type: "Home",     media: "CD-ROM",      share: .09, royalty: .12, license: .6,  cost: 2.4 },
    { id: "playdion",     name: "Playdion",       short: "PD",        type: "Home",     media: "CD-ROM",      share: .05, royalty: .10, license: .4,  cost: 1.8 },
    { id: "playstatus2",  name: "PlayStatus 2",   short: "PS2",       type: "Home",     media: "DVD-ROM",     share: .28, royalty: .12, license: 1.8, cost: 5.5 },
    { id: "game_box",     name: "Game-Box",       short: "GBOX",      type: "Home",     media: "DVD-ROM",     share: .18, royalty: .10, license: 1.4, cost: 4.5 },
    { id: "game_kid",     name: "Game Kid",       short: "GK",        type: "Portable", media: "Cartridge",   share: .16, royalty: .10, license: .5,  cost: 1.5 },
    { id: "play_gear",    name: "Play Gear",      short: "PG",        type: "Portable", media: "Cartridge",   share: .07, royalty: .10, license: .4,  cost: 1.2 },
    { id: "game_swan",    name: "Game Swan",      short: "GSW",       type: "Portable", media: "Cartridge",   share: .08, royalty: .08, license: .4,  cost: 1.1 },
    { id: "intendro_dm",  name: "Intendro DM",    short: "IDS",       type: "Portable", media: "Dual Screen", share: .20, royalty: .11, license: 1.0, cost: 3.0 },
    { id: "virtual_kid",  name: "Virtual Kid",    short: "VK",        type: "Portable", media: "Cartridge",   share: .04, royalty: .09, license: .3,  cost: 1.0 }
  ];

  /* Job types & career progression tree. `req` lists prerequisite jobs needing
     level 5 before this job can be selected; levelData scales the data cost. */
  const JOBS = [
    { id: "coder",    name: "Coder",        tier: 1, emoji: "💻", stat: "Program",     req: [],                                desc: "Programmer — drives Alpha Fun." },
    { id: "writer",   name: "Writer",       tier: 1, emoji: "✍️", stat: "Scenario",    req: [],                                desc: "Scenario Writer — drives Creativity & proposals." },
    { id: "designer", name: "Designer",     tier: 1, emoji: "🎨", stat: "Graphics",    req: [],                                desc: "Graphics Artist — drives Beta Graphics." },
    { id: "sound",    name: "Snd. Eng.",    tier: 1, emoji: "🎧", stat: "Sound",       req: [],                                desc: "Sound Engineer — drives Master Sound." },
    { id: "director", name: "Director",     tier: 2, emoji: "🎬", stat: "All-round",   req: ["coder", "writer", "designer", "sound"], desc: "Needs Lvl 5 in all four base jobs." },
    { id: "producer", name: "Producer",     tier: 2, emoji: "📋", stat: "Direction",   req: ["director"],                       desc: "Needs Lvl 5 Director. Lifts direction capacity." },
    { id: "hardware", name: "Hard. Eng.",   tier: 3, emoji: "🛠️", stat: "Hardware",    req: ["director", "producer"],           desc: "Needs Lvl 5 Director + Producer. Unlocks Your Console." },
    { id: "hacker",   name: "Hacker",       tier: 3, emoji: "🥷", stat: "Ultimate",    req: ["coder", "writer", "designer", "sound", "director", "producer", "hardware"], desc: "Lvl 5 in all 7 prior jobs." }
  ];
  const jobOf = (id) => JOBS.find(j => j.id === id) || JOBS[0];

  /* Training methods (Edu): cost ($M as dollars/1e6), energy drain and the
     themes/parameters each method can surface. */
  const TRAINING = [
    { id: "stroll",     name: "Stroll",      cost: .001, energy: 10, focus: "program", stat: 2,  unlocks: ["town", "animal"] },
    { id: "reading",    name: "Reading",     cost: .002, energy: 15, focus: "scenario",stat: 4,  unlocks: ["fantasy", "historical", "comics"] },
    { id: "movie",      name: "Movie",       cost: .004, energy: 20, focus: "graphics",stat: 4,  unlocks: ["horror", "romance", "sci_fi", "spy"] },
    { id: "anime",      name: "Anime",       cost: .006, energy: 25, focus: "scenario",stat: 5,  unlocks: ["robot", "cutie", "cosplay", "ninja"] },
    { id: "game",       name: "Game",        cost: .010, energy: 30, focus: "program", stat: 6,  unlocks: ["game_co", "dungeon", "monster", "war"] },
    { id: "concert",    name: "Concert",     cost: .015, energy: 30, focus: "sound",   stat: 6,  unlocks: ["drums", "dance", "pop_star"] },
    { id: "net_surf",   name: "Net Surf",    cost: .020, energy: 35, focus: "program", stat: 6,  unlocks: ["stocks", "dating", "conv_store", "law"] },
    { id: "meditate",   name: "Meditate",    cost: .025, energy: 40, focus: "energy",  stat: 0,  unlocks: ["samurai", "martial_arts", "ogre"] },
    { id: "pinball",    name: "Pinball",     cost: .030, energy: 40, focus: "scenario",stat: 7,  unlocks: ["pinball", "slots", "horseshoes"] },
    { id: "college",    name: "College",     cost: .050, energy: 50, focus: "program", stat: 9,  unlocks: ["architecture", "egypt", "time_travel"] },
    { id: "lab_study",  name: "Lab Study",   cost: .080, energy: 60, focus: "program", stat: 11, unlocks: ["space", "airplane", "virtual_pet"] },
    { id: "short_trip", name: "Short Trip",  cost: .120, energy: 70, focus: "all",     stat: 8,  unlocks: ["skiing", "swimming", "golf"] },
    { id: "long_trip",  name: "Long Trip",   cost: .200, energy: 80, focus: "all",     stat: 12, unlocks: ["pirate", "desert", "cowboy"] },
    { id: "retreat",    name: "Retreat",     cost: .300, energy: 90, focus: "all",     stat: 16, unlocks: [] },
    { id: "jogging",    name: "Jogging",     cost: .350, energy: 95, focus: "energy",  stat: 0,  unlocks: [] },
    { id: "museum",     name: "Museum",      cost: .500, energy: 100,focus: "all",     stat: 18, unlocks: ["art", "medieval", "prehistoric"] }
  ];
  const trainingOf = (id) => TRAINING.find(t => t.id === id);

  /* Traveling merchant inventory (Item). Visits in May (woy 17-20) and
     November (woy 45-48). Price escalation: base × (1 + 0.25 × timesBought). */
  const ITEMS = [
    { id: "fun_boost",        name: "Fun Boost",            cost: .010, data: 6,  effect: "fun",     blurb: "×1.3 the active game's Fun." },
    { id: "creativity_boost", name: "Creativity Boost",     cost: .010, data: 6,  effect: "cre",     blurb: "×1.3 the active game's Creativity." },
    { id: "graphics_boost",   name: "Graphics Boost",       cost: .010, data: 6,  effect: "gfx",     blurb: "×1.3 the active game's Graphics." },
    { id: "sound_boost",      name: "Sound Boost",          cost: .010, data: 6,  effect: "snd",     blurb: "×1.3 the active game's Sound." },
    { id: "bug_spray",        name: "Bug Spray",            cost: .025, data: 10, effect: "bugs",    blurb: "Instantly squash up to 3 bugs (each yields data)." },
    { id: "self_help_book",   name: "Self-Help Book",       cost: .035, data: 15, effect: "inspire", blurb: "+Creativity inspiration to the active game." },
    { id: "dead_bull",        name: "Dead Bull",            cost: .050, data: 0,  effect: "energy",  blurb: "Recharge all staff energy to 100%." },
    { id: "career_manual",    name: "Career Change Manual", cost: .080, data: 0,  effect: "career",  blurb: "Grants one free job-class change for any employee." }
  ];
  const itemOf = (id) => ITEMS.find(i => i.id === id);

  /* Outsourced contract work (Anken). reward in $M (dollars/1e6), data range
     of floppy disks, work points and deadline in weeks. domain selects which
     staff stat drives progress. */
  const CONTRACTS = [
    { id: "comic_book",   name: "Comic Book Design",     domain: "graphics", reward: .015, dataMin: 4,  dataMax: 8,   work: 12,  weeks: 6,  difficulty: "Very Low" },
    { id: "ringtones",    name: "Mobile Ringtones",      domain: "sound",    reward: .018, dataMin: 4,  dataMax: 8,   work: 12,  weeks: 6,  difficulty: "Very Low" },
    { id: "scenario",     name: "Scenario Writing",      domain: "scenario", reward: .024, dataMin: 6,  dataMax: 12,  work: 16,  weeks: 7,  difficulty: "Low" },
    { id: "mascots",      name: "Local Mascots",         domain: "graphics", reward: .030, dataMin: 8,  dataMax: 14,  work: 18,  weeks: 7,  difficulty: "Low" },
    { id: "char_design",  name: "Character Designs",     domain: "graphics", reward: .045, dataMin: 10, dataMax: 18,  work: 22,  weeks: 8,  difficulty: "Medium" },
    { id: "transform_sfx",name: "Transformation SFX",    domain: "sound",    reward: .055, dataMin: 12, dataMax: 20,  work: 24,  weeks: 8,  difficulty: "Medium" },
    { id: "pinball_video",name: "Pinball Video",         domain: "program",  reward: .070, dataMin: 15, dataMax: 24,  work: 28,  weeks: 9,  difficulty: "Medium" },
    { id: "medieval_cgi", name: "Medieval CGI",          domain: "graphics", reward: .095, dataMin: 18, dataMax: 28,  work: 32,  weeks: 9,  difficulty: "Medium-High" },
    { id: "dev_tools",    name: "Game Dev Tools",        domain: "program",  reward: .120, dataMin: 20, dataMax: 32,  work: 36,  weeks: 10, difficulty: "Medium-High" },
    { id: "mini_games",   name: "Mini-Games",            domain: "mixed",    reward: .150, dataMin: 25, dataMax: 40,  work: 40,  weeks: 10, difficulty: "High" },
    { id: "kids_theme",   name: "Children's Theme Song", domain: "sound",    reward: .180, dataMin: 30, dataMax: 45,  work: 44,  weeks: 11, difficulty: "High" },
    { id: "game_engine",  name: "Game Engine",           domain: "program",  reward: .240, dataMin: 35, dataMax: 55,  work: 50,  weeks: 11, difficulty: "Very High" },
    { id: "movie_score",  name: "Movie Score",           domain: "sound",    reward: .280, dataMin: 40, dataMax: 60,  work: 56,  weeks: 12, difficulty: "Very High" },
    { id: "game_port",    name: "Game Port",             domain: "program",  reward: .330, dataMin: 45, dataMax: 70,  work: 62,  weeks: 12, difficulty: "Very High" },
    { id: "translation",  name: "Game Translation",      domain: "scenario", reward: .400, dataMin: 50, dataMax: 80,  work: 70,  weeks: 13, difficulty: "Elite" },
    { id: "console_analysis","name": "Console Analysis", domain: "hardware", reward: .500, dataMin: 60, dataMax: 100, work: 80,  weeks: 14, difficulty: "Maximum" }
  ];
  const contractOf = (id) => CONTRACTS.find(c => c.id === id);

  /* Global Game Awards (December, week 3 = woy 50). */
  const AWARDS = [
    { id: "grand_prize",   name: "Grand Prize",      emoji: "🏆", prize: 1.0,  desc: "Highest sales + review; needs ≥36/40 & 1M+ units." },
    { id: "runner_up",     name: "Runner Up Award",  emoji: "🥈", prize: .5,   desc: "Second-strongest all-round title of the year." },
    { id: "best_graphics", name: "Best Graphics",    emoji: "🖼️", prize: .1,   desc: "Highest Graphics point count." },
    { id: "best_music",    name: "Best Music",       emoji: "🎼", prize: .1,   desc: "Highest Sound point count." },
    { id: "worst",         name: "Golden Poo",       emoji: "💩", prize: -.3,  desc: "Lowest review & heavy bugs. −$300K penalty + fame loss." }
  ];

  /* July Game Dex (weeks 27–30) — booth tiers + staff costumes drive hype and
     demographic fan growth. A booth's cost buys a hype/fan turnout; the
     costume decides which fan demographic the crowd skews toward. */
  const GAME_DEX_BOOTHS = [
    { id: "small",  name: "Card-table booth", emoji: "🪑", cost: 0.2, hype: 6,  fans: 8  },
    { id: "medium", name: "Standard booth",   emoji: "🎪", cost: 0.6, hype: 14, fans: 20 },
    { id: "large",  name: "Mega showcase",    emoji: "🏟️", cost: 1.5, hype: 28, fans: 45 }
  ];
  const DEX_COSTUMES = [
    { id: "none",    name: "Street clothes", emoji: "👕", young: 0.34, adult: 0.33, everyone: 0.33 },
    { id: "mascot",  name: "Mascot suits",   emoji: "🐻", young: 0.60, adult: 0.15, everyone: 0.25 },
    { id: "cosplay", name: "Cosplay crew",   emoji: "🦸", young: 0.45, adult: 0.20, everyone: 0.35 },
    { id: "idol",    name: "Idol performers",emoji: "🎤", young: 0.30, adult: 0.55, everyone: 0.15 }
  ];

  /* Secret / legendary characters. */
  const SECRETS = [
    { id: "mister_x",   name: "Mister X",          emoji: "🎭", cond: "Win any Global Game Award trophy.",                          traits: "Elite Program & Scenario; fast learner." },
    { id: "king_ackbar",name: "King Ackbar",       emoji: "🛢️", cond: "Hold $10M+ cash and win Runner Up or Grand Prize.",        traits: "150+ Energy; high all-round stats." },
    { id: "grizzly",    name: "Grizzly Bearington",emoji: "🐻", cond: "Ship a 2M-selling hit and reach Office Tier 3 (8 desks).", traits: "Huge energy, fatigue-immune, high Scenario/Art." },
    { id: "chimp_z",    name: "Chimpan Z-Force",   emoji: "🐒", cond: "Win Best Graphics and Best Music awards.",                  traits: "Faster Hardware path; huge Graphic output." },
    { id: "kairobot",   name: "Kairobot",          emoji: "🤖", cond: "Win Grand Prize 3× and develop on Your Console.",           traits: "Starts as a Lvl-5 Hacker; 500+ in all stats." }
  ];

  const OFFICE_THEMES = [
    { id: "startup",   name: "Startup Garage" }, { id: "gamer",   name: "Gamer (RGB)" },
    { id: "space",     name: "Space Colony" },   { id: "onsen",   name: "Hot Springs" },
    { id: "dungeon",   name: "Dungeon" },         { id: "cat_cafe",name: "Cat Cafe" },
    { id: "kairo",     name: "Lifelike Kairo" },  { id: "power",   name: "Power Plant" },
    { id: "mystery",   name: "Mystery Office" },  { id: "aquatic", name: "Aquatic" },
    { id: "pirate",    name: "Pirate Cove" }
  ];
  const OFFICE_TIERS = [
    { tier: 1, name: "Small Office", desks: 4, cost: 0,    blurb: "The initial garage — 4 desks." },
    { tier: 2, name: "Medium Office",desks: 6, cost: .5,   blurb: "6 desks · $500K relocation." },
    { tier: 3, name: "Large Studio", desks: 8, cost: 2.0,  blurb: "8 desks · $2M relocation · unlocks the Hardware Lab & Your Console." }
  ];
  const OFFICE_FRONT_DESKS = ["Secretary Desk", "Cat Cafe Reception", "Train Front Desk", "Gamer Front Desk"];

  const PROCESSORS = [
    { id: "16bit",   name: "16-bit Chip",  cost: 0,   power: 1 },
    { id: "32bit",   name: "32-bit Chip",  cost: .5,  power: 2 },
    { id: "64bit",   name: "64-bit Chip",  cost: 1.5, power: 3 },
    { id: "potato",  name: "Potato Chip",  cost: .01, power: 0 }
  ];
  const MEDIA = ["Cartridge", "CD-ROM", "DVD-ROM", "BD-ROM", "Punch Cards"];
  const FORM_FACTORS = [{ id: "home", name: "Home Console" }, { id: "handheld", name: "Handheld / Portable" }];

  /* 4 sequential production milestones. */
  const PHASES = [
    { id: "alpha",  name: "Alpha",  from: 0,  to: 40,  param: ["fun", "cre"],  label: "Fun & Creativity" },
    { id: "beta",   name: "Beta",   from: 40, to: 80,  param: ["gfx"],         label: "Graphics" },
    { id: "master", name: "Master", from: 80, to: 100, param: ["snd"],         label: "Sound" },
    { id: "debug",  name: "Debug",  from: 100,to: 101, param: [],              label: "Bug Squashing" }
  ];
  const SALES_MILESTONES = [
    { units: 100000,   name: "100K Seller" },
    { units: 1000000,  name: "Million Seller" },
    { units: 5000000,  name: "5M Hit" },
    { units: 10000000, name: "10M Blockbuster" },
    { units: 20000000, name: "20M Legend" }
  ];

  /* ─────────────────────────── state init ─────────────────────────────── */
  const DEFAULTS = {
    researchData: 30,
    lifetimeData: 30,
    staff: [],
    active: null,
    catalog: [],
    purgedHallOfFame: [],
    contracts: [],
    contractHistory: [],
    awards: [],
    office: { tier: 1, theme: "startup", frontDesk: "Secretary Desk" },
    yourConsole: null,
    licensed: ["pc"],
    registers: { lastProposal: null, lastGraphics: null, lastAudio: null },
    recentGenre: null,
    recentTheme: null,
    consecutiveGenre: 0,
    consecutiveTheme: 0,
    fanbase: { young: 100, adult: 100, everyone: 100 },
    unlockedThemes: [],
    boostCounts: {},
    merchantVisited: {},
    secrets: {},
    hiredSecrets: [],
    careerTokens: 0,
    bailoutsUsed: 0,
    totalSales: 0,
    trophies: 0,
    lastAwardYear: 0,
    gameDexYear: 0,
    gameDexNotified: 0,
    gameDexHistory: [],
    dexHype: 0,
    foundedWeek: 0
  };
  function ensure(G) {
    G = _getG(G);
    if (!G) return null;
    if (!G.gameStudioDesk || typeof G.gameStudioDesk !== "object") G.gameStudioDesk = {};
    const s = G.gameStudioDesk;
    for (const k in DEFAULTS) {
      if (s[k] === undefined || s[k] === null) {
        s[k] = (typeof DEFAULTS[k] === "object" && !Array.isArray(DEFAULTS[k]))
          ? JSON.parse(JSON.stringify(DEFAULTS[k]))
          : (Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k]);
      }
    }
    /* always-available themes, merged without duplicates */
    if (!Array.isArray(s.unlockedThemes) || !s.unlockedThemes.length) s.unlockedThemes = [];
    BASE_THEMES.forEach(t => { if (!s.unlockedThemes.includes(t)) s.unlockedThemes.push(t); });
    /* seed a starter crew on founding so the loop is playable immediately */
    if (!s.staff.length && s.foundedWeek) {
      ["coder", "writer", "designer", "sound"].forEach((job, i) => {
        s.staff.push(_newStaff(job, i));
      });
    }
    return s;
  }
  let _staffSeq = 1;
  function _newStaff(job, seed) {
    const names = ["Ava Byte", "Ken Pixel", "Mira Render", "Rex Wav", "Jun Forge", "Lia Script", "Ohm Circuit", "Nova Brush"];
    const levels = { coder: 1, writer: 1, designer: 1, sound: 1, director: 0, producer: 0, hardware: 0, hacker: 0 };
    return {
      id: "gs" + (_staffSeq++) + "_" + num(seed, 0),
      name: names[num(seed, 0) % names.length],
      job,
      levels,
      energy: 100,
      hiredWeek: 0,
      secret: false
    };
  }
  function found(G) {
    G = _getG(G);
    if (!G) return { ok: false, reason: "Game state unavailable." };
    const s = ensure(G);
    if (s.foundedWeek) return { ok: false, reason: "The game studio is already founded." };
    /* Reuse the movie-game division gate ($50M) from the v16 studio. */
    const fee = 50;
    if (_cash(G) < fee) return { ok: false, reason: "Founding the game studio needs " + fee + "M cash." };
    _money(G, -fee);
    s.foundedWeek = G.week || 1;
    /* keep the v16 division flag in sync so legacy adaptations keep working */
    if (G.gamesDiv) { G.gamesDiv.unlocked = true; if (!G.gamesDiv.foundedWeek) G.gamesDiv.foundedWeek = G.week || 1; }
    else G.gamesDiv = { unlocked: true, projects: [], released: [], foundedWeek: G.week || 1 };
    ["coder", "writer", "designer", "sound"].forEach((job, i) => s.staff.push(_newStaff(job, i)));
    _log(G, "🎮 The " + (G.studio ? G.studio.name : "studio") + " Game Studio is founded — a 4-desk garage, a starter crew and 30 research data.", "gold");
    _save();
    return { ok: true };
  }
  function isFounded(G) { G = _getG(G); const s = G && G.gameStudioDesk; return !!(s && s.foundedWeek); }

  /* Also treat the legacy v16 gate as a founding path: if a save already has
     an unlocked gamesDiv but no desk state, adopt it. */
  function reconcileLegacy(G) {
    G = _getG(G);
    if (!G) return;
    const s = ensure(G);
    if (!s.foundedWeek && G.gamesDiv && G.gamesDiv.unlocked) {
      s.foundedWeek = (G.gamesDiv.foundedWeek) || G.week || 1;
      if (!s.staff.length) ["coder", "writer", "designer", "sound"].forEach((job, i) => s.staff.push(_newStaff(job, i)));
    }
  }

  /* ─────────────────────────── helpers ────────────────────────────────── */
  function genreOf(id) { return GENRES.find(g => g.id === id) || GENRES[0]; }
  function platformOf(id) { return PLATFORMS.find(p => p.id === id) || PLATFORMS[0]; }
  function directionCapacity(G) {
    G = _getG(G); const s = ensure(G);
    let cap = 4 + s.office.tier * 2; /* tier1 = 6, tier2 = 8, tier3 = 10 */
    if (staffSome(G, "producer")) cap += 2;
    if (staffSome(G, "director")) cap += 1;
    return cap;
  }
  function staffSome(G, job) {
    G = _getG(G); const s = ensure(G);
    return s.staff.some(t => !t.retired && (t.job === job || (t.levels && t.levels[job] >= 1)));
  }
  function staffLevel(G, job) {
    G = _getG(G); const s = ensure(G);
    let best = 0;
    s.staff.forEach(t => { if (t.retired) return; const lv = (t.levels && t.levels[job]) || (t.job === job ? 1 : 0); if (lv > best) best = lv; });
    return best;
  }
  function teamPower(G) {
    G = _getG(G); const s = ensure(G);
    return s.staff.filter(t => !t.retired).reduce((a, t) => a + Object.values(t.levels || {}).reduce((x, y) => x + y, 0), 0);
  }
  function avgEnergy(G) {
    G = _getG(G); const s = ensure(G);
    const live = s.staff.filter(t => !t.retired);
    if (!live.length) return 100;
    return Math.round(live.reduce((a, t) => a + num(t.energy, 100), 0) / live.length);
  }
  function isMerchantWeek(G) { G = _getG(G); const w = woy(G && G.week); return (w >= 17 && w <= 20) || (w >= 45 && w <= 48); }
  function merchantKey(G) { G = _getG(G); return yearOf(G && G.week) + "-" + (woy(G && G.week) <= 26 ? "may" : "nov"); }

  /* Burnout: the consecutive-assignment penalty (Lead Burnout). If the current
     milestone lead equals the previous project's lead, output × 0.40. */
  function burnoutFactor(register, assignee) {
    return (register && assignee && register === assignee) ? 0.40 : 1.0;
  }
  function saturation(G) {
    G = _getG(G); const s = ensure(G);
    const sameGenre = s.consecutiveGenre >= 1; /* two consecutive same-genre releases */
    const sameTheme = s.consecutiveTheme >= 1;
    return {
      sameGenre, sameTheme, both: sameGenre && sameTheme,
      firstWeekMult: (sameGenre && sameTheme) ? 0.60 : 1.0, /* −40% first-week */
      fanMult: sameGenre ? 0.85 : 1.0                        /* −15% fans */
    };
  }

  /* ─────────────────────────── review preview ─────────────────────────── */
  /* Deterministic-ish preview used by the UI and the final release. Returns the
     4 critic scores and the /40 total. `spread` adds a small random jitter. */
  function reviewOf(project, G, jitter) {
    G = _getG(G);
    const g = genreOf(project.genre);
    const syn = synergyOf(project.genre, project.theme).mult;
    const dirPoints = Object.values(project.directions || {}).reduce((a, b) => a + num(b, 0), 0);
    const dirBonus = Math.min(0.18, dirPoints * 0.015);
    const w = g.w;
    /* weighted parameter strength, normalized to ~0..1 */
    const strength =
      (num(project.fun) * w.fun + num(project.cre) * w.cre + num(project.gfx) * w.gfx + num(project.snd) * w.snd) / 100;
    const bugPenalty = Math.min(0.35, num(project.bugs) * 0.03);
    let base = (0.55 + strength / 55) * syn * (1 + dirBonus) - bugPenalty;
    base = clamp(base, 0.15, 1.15);
    const critics = [];
    for (let i = 0; i < 4; i++) {
      let s = base * 9 + 1;
      if (jitter !== false) s += (rnd() * 2 - 1);
      critics.push(clamp(Math.round(s), 1, 10));
    }
    const total = critics.reduce((a, b) => a + b, 0);
    const tier = total >= 32 ? "hall_of_fame" : total >= 25 ? "solid" : total >= 15 ? "mixed" : "flop";
    return { judges: critics, total, tier };
  }

  /* ─────────────────────────── sales preview ──────────────────────────── */
  const SALES_WEIGHTS = [0.30, 0.20, 0.15, 0.10, 0.075, 0.055, 0.04, 0.03, 0.022, 0.015, 0.008, 0.005];
  function holidayMult(weekAbs) { const w = woy(weekAbs); return (w === 50 || w === 51) ? 1.5 + rnd() * 0.5 : 1.0; }
  function salesPotential(project, reviewTotal, G) {
    G = _getG(G);
    const s = ensure(G);
    const isOwn = project.platform === "your_console";
    const plat = isOwn
      ? { share: Math.min(1, 0.15 + num(s.yourConsole && s.yourConsole.userbase, 0) / 40), royalty: 0 }
      : platformOf(project.platform);
    /* A proprietary console uses its OWN installed-base share, not a PC fallback. */
    const share = num(plat.share, 0.1);
    const royalty = num(plat.royalty, 0);
    const paramSum = num(project.fun) + num(project.cre) + num(project.gfx) + num(project.snd);
    const hype = 0.85 + Math.min(0.5, num(project.hype, 20) / 100);
    const sat = saturation(G);
    let potential = (paramSum / 40) * (reviewTotal / 40 + 0.4) * (0.55 + share) * hype * 8;
    potential *= (1 - royalty);
    if (isOwn) potential *= 1.15; /* 100% internal userbase capture, zero licensing */
    potential *= sat.firstWeekMult;
    return Math.max(0.2, round1(potential)); /* $M lifetime revenue */
  }
  function buildSalesPlan(project, reviewTotal, G) {
    G = _getG(G);
    const potential = salesPotential(project, reviewTotal, G);
    const releaseWeek = num(G && G.week, 1);
    const plan = SALES_WEIGHTS.map((w, i) => {
      const mult = holidayMult(releaseWeek + i);
      return round1(Math.max(0, potential * w * mult));
    });
    return { potential, plan };
  }
  function unitsForRevenue(revenueM) { return Math.round(num(revenueM) * 100000); } /* $1M ≈ 100K units */
  function milestonesFor(units) { return SALES_MILESTONES.filter(m => units >= m.units); }

  /* ─────────────────────────── greenlight ─────────────────────────────── */
  const TITLE_SUFFIX = ["Quest", "Chronicles", "Legends", "Odyssey", "Frontier", "Paradox", "Requiem", "Horizon"];
  function greenlight(G, opts) {
    G = _getG(G); const s = ensure(G);
    if (!s.foundedWeek) return { ok: false, reason: "Found the game studio first." };
    if (s.active) return { ok: false, reason: "A project is already in development — ship it first." };
    opts = opts || {};
    const genre = genreOf(opts.genre);
    const theme = (opts.theme && (s.unlockedThemes.includes(opts.theme) || THEMES.includes(opts.theme))) ? opts.theme : s.unlockedThemes[0];
    const platformId = opts.platform || "pc";
    const licensed = s.licensed.includes(platformId) || (platformId === "your_console" && s.yourConsole);
    if (!licensed) return { ok: false, reason: "You don't hold a dev-kit licence for " + (platformOf(platformId).name || platformId) + ". License it under Hardware." };

    const plat = platformId === "your_console" ? { cost: 2.0 } : platformOf(platformId);
    const budget = round1(Math.max(1.5, (2 + num(plat.cost, 1)) * genre.costMult));
    const author = opts.author === "gaichu" ? "gaichu" : "inhouse";
    let fee = author === "gaichu" ? 0.05 : 0; /* outsourced author flat fee */
    /* direction allocation capped at capacity */
    const directions = {};
    let allocated = 0; const cap = directionCapacity(G);
    DIRECTIONS.forEach(d => {
      const v = clamp(Math.round(num(opts.directions && opts.directions[d.id], 0)), 0, 6);
      const room = Math.max(0, cap - allocated);
      directions[d.id] = Math.min(v, room);
      allocated += directions[d.id];
    });

    /* Proposal (Kikaku): in-house employee success depends on Writing/Scenario;
       failure yields low initial Fun/Creativity. Outsourced = predictable base. */
    const proposalAssignee = author === "inhouse" ? (opts.proposalAssignee || _bestStaffId(G, "writer")) : "gaichu";
    const propBurnout = burnoutFactor(s.registers.lastProposal, proposalAssignee);
    let initFun, initCre;
    if (author === "gaichu") { initFun = 20; initCre = 20; }
    else {
      const writerLv = staffLevel(G, "writer");
      const success = writerLv >= 3 || chance(0.4 + writerLv * 0.1);
      initFun = success ? 26 : 12; initCre = success ? 26 : 12;
      if (!success) s.proposalFailed = true;
    }
    initFun = Math.round(initFun * propBurnout);
    initCre = Math.round(initCre * propBurnout);

    if (_cash(G) < budget + fee) return { ok: false, reason: "Not enough cash — this concept needs " + (round1(budget + fee)) + "M up front." };
    _money(G, -(budget + fee));

    const title = (opts.title && String(opts.title).trim().slice(0, 40)) || (THEME_LABEL(theme) + " " + pick(TITLE_SUFFIX));
    const graphicsLead = opts.graphicsLead || _bestStaffId(G, "designer");
    const audioLead = opts.audioLead || _bestStaffId(G, "sound");
    const project = {
      id: "gp" + Date.now() + "_" + Math.floor(rnd() * 1000),
      title,
      genre: genre.id,
      theme,
      platform: platformId,
      author,
      proposalAssignee,
      graphicsLead,
      audioLead,
      directions,
      budget,
      spent: round1(budget + fee),
      phase: "alpha",
      progress: 0,
      fun: initFun,
      cre: initCre,
      gfx: 0,
      snd: 0,
      bugs: 0,
      hype: 18 + rint(0, 6) + num(s.dexHype), /* Game Dex turnout banks toward the next launch */
      crunch: false,
      startedWeek: G.week || 1,
      crunchWeeks: 0,
      logs: []
    };
    s.active = project;
    s.dexHype = 0; /* consumed on greenlight */
    _log(G, "🕹 Greenlit \"" + title + "\" — " + genre.name + " × " + THEME_LABEL(theme) + " on " + (platformOf(platformId).name) + ". " + (author === "gaichu" ? "Outsourced author laid a steady foundation." : "In-house proposal set the tone."), "gold");
    _save();
    return { ok: true, project };
  }
  function _bestStaffId(G, job) {
    G = _getG(G); const s = ensure(G);
    let best = null, lv = -1;
    s.staff.forEach(t => { if (t.retired) return; const l = (t.levels && t.levels[job]) || (t.job === job ? 1 : 0); if (l > lv) { lv = l; best = t.id; } });
    return best;
  }
  function greenlightSequel(G, catalogId) {
    G = _getG(G); const s = ensure(G);
    if (s.active) return { ok: false, reason: "Finish the current project first." };
    const g = s.catalog.find(c => c.id === catalogId);
    if (!g) return { ok: false, reason: "That title is no longer on the active roster." };
    if (!g.hallOfFame) return { ok: false, reason: "Only Hall of Fame titles (32+/40) unlock sequels." };
    if (s.purgedHallOfFame.includes(g.franchiseKey)) return { ok: false, reason: "This franchise was purged from the 32-title buffer — its sequel rights are locked." };
    const res = greenlight(G, { title: g.title + " II", genre: g.genre, theme: g.theme, platform: g.platform, author: "inhouse" });
    if (res.ok && s.active) {
      s.active.fun = Math.round(g.fun * 0.7); s.active.cre = Math.round(g.cre * 0.7);
      s.active.gfx = Math.round(g.gfx * 0.7); s.active.snd = Math.round(g.snd * 0.7);
      s.active.isSequel = true; s.active.franchiseKey = g.franchiseKey;
      s.active.hype = Math.min(60, g.hype + 10);
    }
    return res;
  }

  /* ─────────────────────────── weekly production ──────────────────────── */
  function phaseOf(progress) {
    if (progress < 40) return "alpha";
    if (progress < 80) return "beta";
    if (progress < 100) return "master";
    return "debug";
  }
  function advanceWeek(G) {
    G = _getG(G); const s = ensure(G);
    const p = s.active;
    if (!p || p.phase === "released") return { ok: false };
    if (p.phase === "debug") return { ok: false, reason: "In debug — squash bugs, then release." };

    /* weekly burn */
    const burn = round1(Math.max(0.2, p.budget * 0.06));
    if (_cash(G) >= burn) { _money(G, -burn); p.spent = round1(num(p.spent) + burn); }
    else { p.overBudget = round1(num(p.overBudget) + burn); }

    /* velocity: base + team; crunch speeds at a cost of bugs/energy */
    const tp = teamPower(G);
    let velocity = 7 + Math.min(9, tp * 0.35) + (p.crunch ? 5 : 0);
    const energyFactor = 0.6 + avgEnergy(G) / 250; /* tired teams are slower */
    velocity *= energyFactor;
    p.progress = clamp(num(p.progress) + velocity, 0, 100);

    /* parameter generation by milestone, with burnout on repeat leads */
    const leadF = (job) => staffLevel(G, job) * 2 + 4;
    if (p.phase === "alpha") {
      const f = burnoutFactor(s.registers.lastProposal, p.proposalAssignee);
      p.fun += Math.round((5 + staffLevel(G, "coder") * 1.5 + rint(0, 3)) * f);
      p.cre += Math.round((5 + leadF("writer")) * f);
    } else if (p.phase === "beta") {
      const f = burnoutFactor(s.registers.lastGraphics, p.graphicsLead);
      p.gfx += Math.round((6 + staffLevel(G, "designer") * 2 + rint(0, 3)) * f);
    } else if (p.phase === "master") {
      const f = burnoutFactor(s.registers.lastAudio, p.audioLead);
      p.snd += Math.round((6 + staffLevel(G, "sound") * 2 + rint(0, 3)) * f);
    }

    /* Bug generation: fatigue, low programming, rush crunches. */
    const fatigue = 1 - avgEnergy(G) / 100;
    const lowProg = Math.max(0, 3 - staffLevel(G, "coder")) * 0.4;
    let bugChance = 0.35 + fatigue * 0.5 + lowProg * 0.15 + (p.crunch ? 0.35 : 0);
    const newBugs = (chance(bugChance) ? 1 : 0) + (chance(Math.max(0, bugChance - 0.5)) ? 1 : 0);
    p.bugs += newBugs;

    /* energy drain + crunch management */
    s.staff.forEach(t => { if (!t.retired) t.energy = clamp(num(t.energy, 100) - (p.crunch ? 7 : 3), 0, 100); });
    if (p.crunch) p.crunchWeeks++;

    /* phase transitions */
    const np = phaseOf(p.progress);
    if (np !== p.phase) {
      p.phase = np;
      if (np === "debug") _log(G, "🐞 \"" + p.title + "\" hit feature freeze — " + p.bugs + " bugs surfaced. Squash them for research data before release.", "");
      else _log(G, "🕹 \"" + p.title + "\" entered the " + np + " milestone.", "");
    }
    return { ok: true, progress: Math.round(p.progress), newBugs };
  }

  /* Bug squash → Research Data. Each squashed bug = 1 floppy disk. */
  function squashBugs(G, count) {
    G = _getG(G); const s = ensure(G);
    const p = s.active;
    if (!p) return { ok: false, reason: "No active project." };
    if (p.bugs <= 0) return { ok: false, reason: "No bugs left to squash." };
    const n = Math.min(p.bugs, Math.max(1, Math.round(num(count, 1))));
    p.bugs -= n;
    s.researchData += n;
    s.lifetimeData += n;
    return { ok: true, squashed: n, data: s.researchData };
  }

  /* Ignore crunch toggle (rush) — speeds progress, raises bug/energy risk. */
  function toggleCrunch(G) {
    G = _getG(G); const s = ensure(G);
    if (!s.active) return { ok: false, reason: "No active project." };
    s.active.crunch = !s.active.crunch;
    return { ok: true, crunch: s.active.crunch };
  }

  /* Release: review, sales plan, catalog, fanbase, saturation, registers, HoF. */
  function release(G) {
    G = _getG(G); const s = ensure(G);
    const p = s.active;
    if (!p) return { ok: false, reason: "No active project to release." };
    const review = reviewOf(p, G, true);
    const shippedBugs = p.bugs;
    /* releasing with bugs: review penalty already in reviewOf; extra returns/sales loss */
    const bugSalesMult = clamp(1 - shippedBugs * 0.04, 0.5, 1);
    const sales = buildSalesPlan(p, review.total, G);
    const plan = sales.plan.map(v => round1(v * bugSalesMult));
    const revenue = round1(plan.reduce((a, b) => a + b, 0));
    const units = unitsForRevenue(revenue);
    const milestones = milestonesFor(units);
    const sat = saturation(G);

    const plat = p.platform === "your_console" ? (s.yourConsole && s.yourConsole.name) || "Your Console" : platformOf(p.platform).name;
    const entry = {
      id: p.id,
      title: p.title,
      genre: p.genre,
      theme: p.theme,
      platform: p.platform,
      platformName: plat,
      fun: p.fun, cre: p.cre, gfx: p.gfx, snd: p.snd,
      bugs: shippedBugs,
      hype: p.hype,
      review: review.total,
      judges: review.judges,
      tier: review.tier,
      hallOfFame: review.tier === "hall_of_fame",
      isSequel: !!p.isSequel,
      franchiseKey: p.franchiseKey || (p.title || "title").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      revenue,
      units,
      milestones: milestones.map(m => m.name),
      salesPlan: plan,
      weekIndex: 0,
      tailWeeks: plan.length,
      releasedWeek: G.week || 1,
      year: yearOf(G.week || 1)
    };

    /* 32-title rolling buffer — releasing #33 purges #1. If the purged title
       was Hall of Fame, lock sequels for that franchise. */
    s.catalog.unshift(entry);
    if (s.catalog.length > 32) {
      const purged = s.catalog.pop();
      if (purged.hallOfFame && !s.purgedHallOfFame.includes(purged.franchiseKey)) s.purgedHallOfFame.push(purged.franchiseKey);
      s.totalSales = round1(num(s.totalSales) + num(purged.revenue));
    }

    /* Fanbase update: Hall of Fame spikes fans; flops damage; saturation shrinks. */
    const fb = s.fanbase;
    let delta = 0;
    if (review.tier === "hall_of_fame") delta = 40;
    else if (review.tier === "solid") delta = 18;
    else if (review.tier === "flop") delta = -30;
    else delta = 4;
    Object.keys(fb).forEach(k => { fb[k] = Math.max(0, Math.round(fb[k] * sat.fanMult + delta)); });

    /* Saturation tracker: consecutive same genre/theme */
    if (s.recentGenre === p.genre) s.consecutiveGenre++; else s.consecutiveGenre = 0;
    if (s.recentTheme === p.theme) s.consecutiveTheme++; else s.consecutiveTheme = 0;
    s.recentGenre = p.genre; s.recentTheme = p.theme;
    if (sat.both) _log(G, "📉 Market research: we've shipped too many " + genreOf(p.genre).name + " / " + THEME_LABEL(p.theme) + " games. The fan base is shrinking and first-week sales fell 40%.", "bad");

    /* Burnout registers carried to next project */
    s.registers.lastProposal = p.proposalAssignee;
    s.registers.lastGraphics = p.graphicsLead;
    s.registers.lastAudio = p.audioLead;
    s.proposalFailed = false;

    /* Hall of Fame reputation + franchise re-heat synergy with the movie side. */
    if (entry.hallOfFame) {
      s.trophies++;
      if (G.studio) G.studio.rep = clamp(num(G.studio.rep) + 2, 5, 99);
      if (G.franchises && G.franchises.length) {
        const match = G.franchises.find(f => entry.title.toLowerCase().includes(String(f.name).toLowerCase().slice(0, 6)));
        if (match) match.decay = clamp(num(match.decay, .5) + .1, 0, 1);
      }
    }
    if (units >= 2000000) s.had2M = true;

    s.active = null;
    const grade = entry.hallOfFame ? "🏆 HALL OF FAME" : review.tier === "flop" ? "💀 FLOP" : "✅";
    _log(G, grade + " \"" + entry.title + "\" scored " + review.total + "/40 (judges " + review.judges.join("/") + ") — " + units.toLocaleString() + " units projected" + (shippedBugs ? " with " + shippedBugs + " bugs left" : "") + ".", entry.hallOfFame ? "gold" : review.tier === "flop" ? "bad" : "");
    _save();
    return { ok: true, game: entry, revenue, units, review };
  }

  /* credit one week of a released title's sales tail; called from tick() */
  function creditSales(G) {
    G = _getG(G); const s = ensure(G);
    s.catalog.forEach(g => {
      if (g.weekIndex < g.salesPlan.length) {
        const amt = g.salesPlan[g.weekIndex];
        if (amt > 0) _money(G, amt);
        g.weekIndex++;
        if (g.weekIndex === g.salesPlan.length) g.tailEnded = true;
      }
    });
  }

  /* ─────────────────────────── research economy ───────────────────────── */
  function jobLevelDataCost(G, staff, job) {
    G = _getG(G); const s = ensure(G);
    const def = jobOf(job);
    const cur = (staff.levels && staff.levels[job]) || 0;
    if (cur >= 5) return Infinity;
    const base = def.tier === 1 ? 12 : def.tier === 2 ? 20 : 30;
    return base * (cur + 1);
  }
  function canSelectJob(G, staff, job) {
    G = _getG(G); const def = jobOf(job);
    if (!def.req.length) return { ok: true };
    for (const r of def.req) {
      if (((staff.levels && staff.levels[r]) || 0) < 5) return { ok: false, reason: "Requires Lvl 5 " + jobOf(r).name + "." };
    }
    return { ok: true };
  }
  function levelUpJob(G, staffId, job) {
    G = _getG(G); const s = ensure(G);
    const staff = s.staff.find(t => t.id === staffId);
    if (!staff) return { ok: false, reason: "Employee not found." };
    const gate = canSelectJob(G, staff, job);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const cur = staff.levels[job] || 0;
    if (cur >= 5) return { ok: false, reason: jobOf(job).name + " is already at Level 5." };
    const cost = jobLevelDataCost(G, staff, job);
    if (s.researchData < cost) return { ok: false, reason: "Needs " + cost + " research data (you have " + s.researchData + "). Squash bugs or finish contracts." };
    s.researchData -= cost;
    staff.levels[job] = cur + 1;
    staff.job = job; /* leveling a job makes it the active role */
    _log(G, "📈 " + staff.name + " reached " + jobOf(job).name + " Lv" + (cur + 1) + " (−" + cost + " data).", "");
    _save();
    return { ok: true, level: cur + 1, cost };
  }
  function changeCareer(G, staffId, job) {
    G = _getG(G); const s = ensure(G);
    const staff = s.staff.find(t => t.id === staffId);
    if (!staff) return { ok: false, reason: "Employee not found." };
    const gate = canSelectJob(G, staff, job);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const useToken = s.careerTokens > 0;
    const fee = useToken ? 0 : 0.08;
    if (!useToken && _cash(G) < fee) return { ok: false, reason: "A career change needs $80K (or a Career Change Manual)." };
    if (useToken) s.careerTokens--; else _money(G, -fee);
    staff.job = job;
    if (!staff.levels[job]) staff.levels[job] = 1;
    _log(G, "🔀 " + staff.name + " changed class to " + jobOf(job).name + (useToken ? " (manual)." : " (−$80K)."), "");
    _save();
    return { ok: true };
  }
  function hireStaff(G, job) {
    G = _getG(G); const s = ensure(G);
    const maxDesks = OFFICE_TIERS[s.office.tier - 1].desks;
    if (s.staff.filter(t => !t.retired).length >= maxDesks) return { ok: false, reason: "No free desks — expand the office (tier " + s.office.tier + " holds " + maxDesks + "). Hire via the Hardware/Office panel." };
    const fee = 0.1;
    if (_cash(G) < fee) return { ok: false, reason: "Hiring needs $100K." };
    _money(G, -fee);
    const t = _newStaff(jobOf(job).id, s.staff.length);
    s.staff.push(t);
    _log(G, "🧑‍💻 Hired " + t.name + " as a " + jobOf(job).name + " (−$100K).", "");
    _save();
    return { ok: true, staff: t };
  }
  function train(G, staffId, methodId) {
    G = _getG(G); const s = ensure(G);
    const staff = s.staff.find(t => t.id === staffId);
    if (!staff) return { ok: false, reason: "Employee not found." };
    const m = trainingOf(methodId);
    if (!m) return { ok: false, reason: "Unknown training method." };
    if (_cash(G) < m.cost) return { ok: false, reason: "Not enough cash for " + m.name + "." };
    if (num(staff.energy, 100) < m.energy) return { ok: false, reason: staff.name + " is too tired (needs " + m.energy + " energy)." };
    _money(G, -m.cost);
    staff.energy = clamp(num(staff.energy, 100) - m.energy, 0, 100);
    /* stat gains: focus param, plus a chance of a creativity spark */
    let discovered = null;
    if (m.focus !== "energy") {
      const jobMap = { program: "coder", scenario: "writer", graphics: "designer", sound: "sound" };
      const targets = m.focus === "all" ? ["coder", "writer", "designer", "sound"] : [jobMap[m.focus] || "coder"];
      targets.forEach(j => { staff.levels[j] = (staff.levels[j] || 0) + (m.focus === "all" ? Math.round(m.stat / 4) : Math.round(m.stat / 2)); });
    } else {
      staff.maxEnergyBonus = num(staff.maxEnergyBonus) + 10;
    }
    if (m.unlocks.length && chance(0.55)) {
      const pool = m.unlocks.filter(t => !s.unlockedThemes.includes(t));
      if (pool.length) { discovered = pick(pool); s.unlockedThemes.push(discovered); }
    }
    /* research data trickle from study */
    if (chance(0.4)) { s.researchData += 1; s.lifetimeData += 1; }
    _log(G, "🎓 " + staff.name + " trained via " + m.name + (discovered ? " and discovered the \"" + THEME_LABEL(discovered) + "\" theme!" : "."), discovered ? "gold" : "");
    _save();
    return { ok: true, discovered };
  }

  /* Merchant items: price escalation + scaled research cost. */
  function itemPrice(G, itemId) {
    G = _getG(G); const s = ensure(G);
    const it = itemOf(itemId); if (!it) return 0;
    const n = s.boostCounts[itemId] || 0;
    return roundK(it.cost * (1 + 0.25 * n));
  }
  function itemDataCost(G, itemId) {
    G = _getG(G); const s = ensure(G);
    const it = itemOf(itemId); if (!it) return 0;
    return it.data + Math.floor(num(s.lifetimeData) / 50);
  }
  function buyItem(G, itemId) {
    G = _getG(G); const s = ensure(G);
    if (!isMerchantWeek(G)) return { ok: false, reason: "The traveling salesman only visits in May and November." };
    const it = itemOf(itemId);
    if (!it) return { ok: false, reason: "Unknown item." };
    const price = itemPrice(G, itemId), data = itemDataCost(G, itemId);
    if (_cash(G) < price) return { ok: false, reason: "Not enough cash ($" + price + "M).", };
    if (s.researchData < data) return { ok: false, reason: "Needs " + data + " research data." };
    const p = s.active;
    if (["fun", "cre", "gfx", "snd"].includes(it.effect) && !p) return { ok: false, reason: "Boost items need an active game in development." };
    _money(G, -price);
    s.researchData -= data;
    s.boostCounts[itemId] = (s.boostCounts[itemId] || 0) + 1;
    let msg = it.name + " purchased.";
    const map = { fun: "fun", cre: "cre", gfx: "gfx", snd: "snd" };
    if (map[it.effect] && p) { p[map[it.effect]] = Math.round(num(p[map[it.effect]]) * 1.3); msg = it.name + " applied — " + it.effect.toUpperCase() + " ×1.3."; }
    else if (it.effect === "bugs" && p) { const sq = squashBugs(G, 3); msg = it.name + " surfaced & squashed " + (sq.squashed || 0) + " bugs."; }
    else if (it.effect === "inspire" && p) { p.cre += 12; msg = it.name + " sparked +12 Creativity."; }
    else if (it.effect === "energy") { s.staff.forEach(t => { if (!t.retired) t.energy = 100; }); msg = it.name + " recharged the whole studio."; }
    else if (it.effect === "career") { s.careerTokens++; msg = it.name + " added — one free career change is available."; }
    _log(G, "🛒 " + msg, "gold");
    _save();
    return { ok: true, msg };
  }

  /* ─────────────────────────── contracts ──────────────────────────────── */
  function takeContract(G, defId) {
    G = _getG(G); const s = ensure(G);
    if (s.contracts.length >= 3) return { ok: false, reason: "You can only run 3 contracts at once." };
    const def = contractOf(defId);
    if (!def) return { ok: false, reason: "Unknown contract." };
    if (s.contracts.some(c => c.defId === defId)) return { ok: false, reason: "That contract is already running." };
    const staff = s.staff.filter(t => !t.retired);
    if (!staff.length) return { ok: false, reason: "You need staff to take contract work." };
    const c = {
      id: "ct" + Date.now() + "_" + Math.floor(rnd() * 100),
      defId, name: def.name, domain: def.domain, reward: def.reward,
      dataMin: def.dataMin, dataMax: def.dataMax, work: def.work, progress: 0,
      weeksLeft: def.weeks, startedWeek: G.week || 1
    };
    s.contracts.push(c);
    _log(G, "📝 Took a contract: " + def.name + " — " + def.reward + "M on delivery, deadline in " + def.weeks + " weeks.", "");
    _save();
    return { ok: true, contract: c };
  }
  function domainPower(G, domain) {
    G = _getG(G);
    const map = { graphics: "designer", sound: "sound", scenario: "writer", program: "coder", hardware: "hardware", mixed: null };
    if (domain === "mixed") return Math.round(teamPower(G) * 0.5) + 2;
    const job = map[domain] || "coder";
    return staffLevel(G, job) * 2 + 2;
  }
  function tickContracts(G) {
    G = _getG(G); const s = ensure(G);
    const done = [];
    s.contracts.forEach(c => {
      c.progress += domainPower(G, c.domain);
      c.weeksLeft--;
      if (c.progress >= c.work) {
        const data = rint(c.dataMin, c.dataMax);
        _money(G, c.reward);
        s.researchData += data; s.lifetimeData += data;
        c.result = "success"; c.data = data;
        s.contractHistory.unshift({ ...c, completedWeek: G.week });
        done.push(c);
        _log(G, "✅ Contract delivered: " + c.name + " (+" + c.reward + "M, +" + data + " data).", "gold");
      } else if (c.weeksLeft <= 0) {
        c.result = "failed";
        s.contractHistory.unshift({ ...c, completedWeek: G.week });
        done.push(c);
        if (G.studio) G.studio.rep = clamp(num(G.studio.rep) - 2, 5, 99);
        _log(G, "⏰ Deadline missed for " + c.name + "! No payment — a client says they're never using your studio again. Reputation −2.", "bad");
      }
    });
    s.contracts = s.contracts.filter(c => !done.includes(c));
    if (s.contractHistory.length > 30) s.contractHistory.length = 30;
  }

  /* ─────────────────────────── office & hardware ──────────────────────── */
  function expandOffice(G, tier) {
    G = _getG(G); const s = ensure(G);
    const def = OFFICE_TIERS.find(t => t.tier === tier);
    if (!def) return { ok: false, reason: "Unknown office tier." };
    if (tier <= s.office.tier) return { ok: false, reason: "You already have this office or better." };
    if (tier !== s.office.tier + 1) return { ok: false, reason: "Upgrade one tier at a time." };
    if (_cash(G) < def.cost) return { ok: false, reason: def.name + " relocation needs " + def.cost + "M cash." };
    _money(G, -def.cost);
    s.office.tier = tier;
    _log(G, "🏢 Office upgraded to " + def.name + " (" + def.desks + " desks).", "gold");
    _save();
    return { ok: true };
  }
  function setOfficeTheme(G, themeId) {
    G = _getG(G); const s = ensure(G);
    if (!OFFICE_THEMES.some(t => t.id === themeId)) return { ok: false, reason: "Unknown studio skin." };
    s.office.theme = themeId; _save(); return { ok: true };
  }
  function setFrontDesk(G, name) {
    G = _getG(G); const s = ensure(G);
    if (!OFFICE_FRONT_DESKS.includes(name)) return { ok: false, reason: "Unknown front desk." };
    s.office.frontDesk = name; _save(); return { ok: true };
  }
  function hasHardwareEngineer(G) { return staffSome(G, "hardware"); }
  function licensePlatform(G, id) {
    G = _getG(G); const s = ensure(G);
    const p = PLATFORMS.find(x => x.id === id);
    if (!p) return { ok: false, reason: "Unknown platform." };
    if (s.licensed.includes(id)) return { ok: false, reason: "Dev-kit licence already active." };
    if (_cash(G) < p.license) return { ok: false, reason: "Needs " + (p.license ? p.license + "M cash" : "no fee") + " for the " + p.name + " dev kit." };
    _money(G, -p.license);
    s.licensed.push(id);
    _log(G, "🔑 Licensed the " + p.name + " dev kit (−" + fmtMlike(p.license) + "). You can now target it in a design doc.", "gold");
    _save();
    return { ok: true, platform: p };
  }
  function fmtMlike(v) { return v >= 1 ? "$" + v + "M" : "$" + Math.round(v * 1000) + "K"; }
  function buildYourConsole(G, cfg) {
    G = _getG(G); const s = ensure(G);
    if (s.yourConsole) return { ok: false, reason: "You already manufacture Your Console." };
    if (s.office.tier < 3) return { ok: false, reason: "Needs a Level 3 Large Studio (8 desks)." };
    if (!hasHardwareEngineer(G)) return { ok: false, reason: "Needs at least one active Hardware Engineer." };
    if (_cash(G) < 5) return { ok: false, reason: "Needs a $5M capital reserve." };
    const proc = PROCESSORS.find(p => p.id === (cfg && cfg.processor));
    if (!proc) return { ok: false, reason: "Pick a processor." };
    const media = (cfg && cfg.media) || MEDIA[0];
    const form = (cfg && cfg.form) || "home";
    const cost = round1(5 + num(proc.cost));
    if (_cash(G) < cost) return { ok: false, reason: "Needs " + cost + "M for the R&D build." };
    _money(G, -cost);
    s.yourConsole = {
      name: (cfg && cfg.name && String(cfg.name).slice(0, 32)) || "Your Console",
      processor: proc.id, processorName: proc.name, media,
      form, userbase: 0.5, launchedWeek: G.week || 1
    };
    if (!s.licensed.includes("your_console")) s.licensed.push("your_console");
    /* sync the v16 hardware module's proprietary flag if present */
    try { if (global.GameDevHardware && global.GameDevHardware.initGameDevHardware) { const h = global.GameDevHardware.initGameDevHardware(G); if (h) h.proprietaryConsoleActive = true; } } catch (e) {}
    _log(G, "🛠️ YOUR CONSOLE launched — " + s.yourConsole.name + " (" + proc.name + ", " + media + ", " + (form === "home" ? "home" : "handheld") + "). Zero third-party licensing fees; 100% internal userbase capture.", "gold");
    _save();
    return { ok: true, console: s.yourConsole };
  }

  /* ─────────────────────────── awards ─────────────────────────────────── */
  function runAwards(G) {
    G = _getG(G); const s = ensure(G);
    const yr = yearOf(G && G.week);
    const field = s.catalog.filter(g => g.year === yr);
    if (!field.length) return { ok: false, reason: "No eligible titles this year." };
    const results = [];
    /* Grand Prize: min 36/40 & 1M+ units, top overall (review×units). */
    const gp = field.filter(g => g.review >= 36 && g.units >= 1000000).sort((a, b) => (b.review * b.units) - (a.review * a.units))[0]
      || field.slice().sort((a, b) => (b.review + b.units / 1e6) - (a.review + a.units / 1e6))[0];
    if (gp) results.push({ category: "grand_prize", title: gp.title, prize: 1.0, gameId: gp.id });
    /* Runner Up: next-best overall, different title. */
    const ru = field.filter(g => !gp || g.id !== gp.id).sort((a, b) => b.review - a.review)[0];
    if (ru) results.push({ category: "runner_up", title: ru.title, prize: .5, gameId: ru.id });
    /* Best Graphics / Best Music. */
    const bg = field.slice().sort((a, b) => b.gfx - a.gfx)[0];
    const bm = field.slice().sort((a, b) => b.snd - a.snd)[0];
    if (bg) results.push({ category: "best_graphics", title: bg.title, prize: .1, gameId: bg.id });
    if (bm) results.push({ category: "best_music", title: bm.title, prize: .1, gameId: bm.id });
    /* Worst: low review (<15) & heavy bugs; else the weakest. */
    const worst = field.filter(g => g.review < 15 && g.bugs >= 3)[0] || field.slice().sort((a, b) => (a.review + a.bugs) - (b.review + b.bugs))[0];
    if (worst) results.push({ category: "worst", title: worst.title, prize: -.3, gameId: worst.id });

    results.forEach(r => {
      _money(G, r.prize);
      s.awards.unshift({ year: yr, week: G.week, category: r.category, title: r.title, prize: r.prize });
      if (["grand_prize", "runner_up", "best_graphics", "best_music"].includes(r.category)) s.trophies++;
      if (r.category === "worst" && G.studio) G.studio.rep = clamp(num(G.studio.rep) - 3, 5, 99);
      if (r.category === "grand_prize") {
        s.grandWins = num(s.grandWins) + 1;
        if (G.studio) G.studio.rep = clamp(num(G.studio.rep) + 4, 5, 99);
        Object.keys(s.fanbase).forEach(k => { s.fanbase[k] += 60; });
      }
    });
    if (s.awards.length > 40) s.awards.length = 40;
    s.lastAwardYear = yr;
    _log(G, "🏆 GLOBAL GAME AWARDS " + yr + ": Grand Prize → \"" + (gp ? gp.title : "none") + "\". " + results.length + " categories decided.", "gold");
    /* Secret unlock checks fire right after the ceremony. */
    checkSecrets(G);
    _save();
    return { ok: true, results };
  }

  /* ─────────────────────────── July Game Dex ──────────────────────────── */
  function isGameDexWeek(G) { G = _getG(G); const w = woy(G && G.week); return w >= 27 && w <= 30; }
  function runGameDex(G, opts) {
    G = _getG(G); const s = ensure(G);
    if (!s.foundedWeek) return { ok: false, reason: "Found the game studio first." };
    const yr = yearOf(G.week);
    if (s.gameDexYear === yr) return { ok: false, reason: "You've already exhibited at this year's Game Dex." };
    if (!isGameDexWeek(G)) return { ok: false, reason: "The Game Dex convention only runs in July (weeks 27–30)." };
    opts = opts || {};
    const booth = GAME_DEX_BOOTHS.find(b => b.id === opts.booth) || GAME_DEX_BOOTHS[0];
    const costume = DEX_COSTUMES.find(c => c.id === opts.costume) || DEX_COSTUMES[0];
    if (_cash(G) < booth.cost) return { ok: false, reason: "Not enough cash for the " + booth.name + " (" + fmtMlike(booth.cost) + ")." };
    /* Sending a staff member in costume is optional but lifts turnout 15%. */
    const lead = opts.staffId ? s.staff.find(t => t.id === opts.staffId && !t.retired) : null;
    const turnout = lead ? 1.15 : 1;
    const hype = Math.round(booth.hype * turnout);
    const fans = Math.round(booth.fans * turnout);
    _money(G, -booth.cost);
    /* Hype lands on the active project when one exists, otherwise banks toward
       the next greenlight; costume splits the new fans across demographics. */
    if (s.active) s.active.hype = num(s.active.hype) + hype;
    else s.dexHype = num(s.dexHype) + hype;
    const gained = {};
    Object.keys(s.fanbase).forEach(k => {
      const add = Math.round(fans * num(costume[k], 0.33));
      s.fanbase[k] = num(s.fanbase[k]) + add;
      gained[k] = add;
    });
    s.gameDexYear = yr;
    s.gameDexHistory.unshift({ year: yr, booth: booth.id, costume: costume.id, hype, fans, staff: lead ? lead.name : null });
    if (s.gameDexHistory.length > 12) s.gameDexHistory.length = 12;
    _log(G, "🎪 GAME DEX " + yr + ": " + booth.name + " with " + costume.name + " — +" + hype + " hype, +" + fans + " fans (" + Object.keys(gained).map(k => k + " +" + gained[k]).join(", ") + ")." + (s.active ? "" : " Hype banked for the next launch."), "gold");
    _save();
    return { ok: true, hype, fans, gained, booth: booth.id, costume: costume.id };
  }

  /* ─────────────────────────── secret characters ──────────────────────── */
  function awardWins(G, cat) { G = _getG(G); const s = ensure(G); return s.awards.filter(a => a.category === cat).length; }
  function checkSecrets(G) {
    G = _getG(G); const s = ensure(G);
    const trophies = s.trophies;
    const gpWins = awardWins(G, "grand_prize");
    const set = (id, ok) => { if (ok && !s.secrets[id]) { s.secrets[id] = true; _log(G, "🌟 Secret unlocked: " + SECRETS.find(x => x.id === id).name + " is now available at the Hollywood Talent Agent.", "gold"); } };
    set("mister_x", trophies >= 1);
    set("king_ackbar", _cash(G) >= 10 && (awardWins(G, "runner_up") + gpWins) >= 1);
    set("grizzly", !!s.had2M && s.office.tier >= 3);
    set("chimp_z", awardWins(G, "best_graphics") >= 1 && awardWins(G, "best_music") >= 1);
    set("kairobot", gpWins >= 3 && !!s.yourConsole);
  }
  function hireSecret(G, id) {
    G = _getG(G); const s = ensure(G);
    const def = SECRETS.find(x => x.id === id);
    if (!def) return { ok: false, reason: "Unknown character." };
    if (!s.secrets[id]) return { ok: false, reason: def.name + " is not unlocked — " + def.cond };
    if (s.hiredSecrets.includes(id)) return { ok: false, reason: def.name + " already works here." };
    const maxDesks = OFFICE_TIERS[s.office.tier - 1].desks;
    if (s.staff.filter(t => !t.retired).length >= maxDesks) return { ok: false, reason: "No free desks for a new hire." };
    const staff = _newStaff(id === "kairobot" ? "hacker" : id === "chimp_z" ? "hardware" : "director", s.staff.length);
    staff.name = def.name; staff.secret = true;
    const lv = id === "kairobot" ? 5 : 4;
    if (id === "kairobot") { Object.keys(staff.levels).forEach(j => staff.levels[j] = 5); staff.energy = 200; }
    else { staff.levels.coder = lv; staff.levels.writer = lv; staff.levels.designer = lv; staff.levels.sound = lv; staff.energy = id === "king_ackbar" || id === "grizzly" ? 150 : 110; }
    s.staff.push(staff);
    s.hiredSecrets.push(id);
    _log(G, "🌟 " + def.name + " joined the studio! " + def.traits, "gold");
    _save();
    return { ok: true, staff };
  }

  /* ─────────────────────────── emergency bailout ──────────────────────── */
  function checkBailout(G) {
    G = _getG(G); const s = ensure(G);
    if (_cash(G) >= 0 || !s.active) return { ok: false };
    if (s.bailoutsUsed < 1) {
      s.bailoutsUsed = 1;
      /* The emergency fund is a $150K grant (per spec) but, at movie-studio
         scale, that alone cannot lift a negative balance — so it bridges the
         studio back to a small +$5M working floor. One grace only. */
      const grant = roundK(Math.max(0.15, 5 - _cash(G)));
      _money(G, grant);
      _log(G, "🆘 Emergency government bailout: a $150K emergency fund plus a bridge to a +$5M working floor (injected +" + fmtMlike(grant) + ") keeps the game studio alive. A second insolvency cancels the project.", "gold");
      _save();
      return { ok: true, bailout: true, grant };
    }
    s.active = null;
    _log(G, "💀 Second insolvency — the game studio is bankrupt and the active project has been cancelled.", "bad");
    _save();
    return { ok: true, cancelled: true };
  }

  /* ─────────────────────────── weekly tick ────────────────────────────── */
  function tick(G) {
    G = _getG(G);
    if (!G) return;
    reconcileLegacy(G);
    const s = ensure(G);
    if (!s.foundedWeek) return;
    /* 1. production advances one week */
    advanceWeek(G);
    /* 2. credit released titles' sales tails (with December holiday surge baked
          into buildSalesPlan at ship time) */
    creditSales(G);
    /* 3. contracts progress / resolve on their deadlines */
    if (s.contracts.length) tickContracts(G);
    /* 4. staff energy recovers a little each week */
    s.staff.forEach(t => { if (!t.retired) t.energy = clamp(num(t.energy, 100) + 5, 0, 100 + num(t.maxEnergyBonus)); });
    /* 5. merchant arrival notice */
    if (isMerchantWeek(G) && !s.merchantVisited[merchantKey(G)]) {
      s.merchantVisited[merchantKey(G)] = true;
      _log(G, "🧳 The traveling salesman is in the lobby (May/November) — boost items, Bug Spray and Career Manuals are on sale under Studio.", "");
    }
    /* 6. Global Game Awards — December week 3 (woy 50), once per year */
    if (woy(G.week) === 50 && s.lastAwardYear !== yearOf(G.week)) runAwards(G);
    /* 6b. Game Dex (July) availability notice — attend once a year under Awards */
    if (isGameDexWeek(G) && s.gameDexYear !== yearOf(G.week) && s.gameDexNotified !== yearOf(G.week)) {
      s.gameDexNotified = yearOf(G.week);
      _log(G, "🎪 The Game Dex convention is on this month (July) — book a booth under Awards to build hype and win over new fans.", "");
    }
    /* 7. secret unlock conditions can be met any week */
    checkSecrets(G);
    /* 8. emergency bailout */
    checkBailout(G);
  }

  /* ─────────────────────────── view-model helpers ─────────────────────── */
  function activePreview(G) {
    G = _getG(G); const s = ensure(G);
    const p = s.active;
    if (!p) return null;
    const review = reviewOf(p, G, false);
    const sales = buildSalesPlan(p, review.total, G);
    return {
      reviewTotal: review.total, reviewTier: review.tier,
      potential: sales.potential,
      firstWeek: sales.plan[0],
      units: unitsForRevenue(round1(sales.plan.reduce((a, b) => a + b, 0))),
      milestones: milestonesFor(unitsForRevenue(round1(sales.plan.reduce((a, b) => a + b, 0)))).map(m => m.name)
    };
  }
  function summary(G) {
    G = _getG(G); const s = ensure(G);
    const hof = s.catalog.filter(g => g.hallOfFame).length;
    const totalUnits = s.catalog.reduce((a, g) => a + num(g.units), 0);
    return {
      founded: !!s.foundedWeek,
      researchData: s.researchData,
      lifetimeData: s.lifetimeData,
      active: !!s.active,
      catalogSize: s.catalog.length,
      hallOfFame: hof,
      trophies: s.trophies,
      totalUnits,
      fanbase: s.fanbase,
      officeTier: s.office.tier,
      licensed: s.licensed.length,
      hasConsole: !!s.yourConsole,
      contracts: s.contracts.length,
      avgEnergy: avgEnergy(G)
    };
  }

  /* ─────────────────────────── export ─────────────────────────────────── */
  const API = {
    /* test hooks */
    _setRng(fn) { _rng = typeof fn === "function" ? fn : Math.random; },
    _resetRng() { _rng = Math.random; },
    /* data */
    GENRES, THEMES, THEME_LABEL, DIRECTIONS, PLATFORMS, JOBS, TRAINING, ITEMS,
    CONTRACTS, AWARDS, SECRETS, GAME_DEX_BOOTHS, DEX_COSTUMES, OFFICE_THEMES, OFFICE_TIERS, OFFICE_FRONT_DESKS,
    PROCESSORS, MEDIA, FORM_FACTORS, PHASES, SALES_MILESTONES, SYNERGY_BOOST, SYNERGY_BUST,
    genreOf, platformOf, jobOf, synergyOf, trainingOf, itemOf, contractOf,
    /* state */
    ensure, found, isFounded, reconcileLegacy, summary, activePreview,
    /* core loop */
    greenlight, greenlightSequel, advanceWeek, squashBugs, toggleCrunch, release,
    reviewOf, salesPotential, buildSalesPlan, unitsForRevenue, milestonesFor,
    directionCapacity, burnoutFactor, saturation, holidayMult,
    /* economy */
    jobLevelDataCost, canSelectJob, levelUpJob, changeCareer, hireStaff, train,
    itemPrice, itemDataCost, buyItem, isMerchantWeek,
    takeContract, domainPower, tickContracts,
    expandOffice, setOfficeTheme, setFrontDesk, hasHardwareEngineer, licensePlatform, buildYourConsole,
    awardWins, checkSecrets, hireSecret, isGameDexWeek, runGameDex,
    /* tick */
    tick, runAwards, creditSales, checkBailout
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  global.GameStudioDesk = API;
})(typeof window !== "undefined" ? window : globalThis);
