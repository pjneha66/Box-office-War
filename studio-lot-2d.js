/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-LOT-2D.JS — Premium Authentic Kairosoft 2D Studio Simulation
   Box Office War — High-Performance 16:9 Widescreen Pixel Art Studio World
   Zero Emojis Policy strictly enforced.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  let _canvas = null;
  let _ctx = null;
  let _animId = null;
  let _lastTime = 0;

  // Camera & Viewport
  const camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    targetX: 0,
    targetY: 0
  };

  const TILE_W = 64;
  const TILE_H = 32;

  // View Navigation: "campus" | "soundstage" | "writers" | "post" | "cinema" | "executive"
  let _currentLotView = "campus";

  // Selected state
  let _selectedBuildingId = null;
  let _selectedAgentId = null;
  let _hoveredGridPos = null;
  let _hoveredHotspot = null;
  let _pointerScreen = { x: -9999, y: -9999 };
  let _buildModeType = null;
  let _floatingTexts = [];
  let _directingState = null; // { stageId, step: 0, timer: 0 }
  let _showStatBoard = true; // Kairosoft production stat HUD toggle

  // Kairosoft Live Production State
  const _kairoStats = {
    scenario: 52,
    direction: 68,
    acting: 64,
    soundVfx: 48,
    targetQuality: 75,
    progress: 0.45,
    inTheZoneAgent: null,
    zoneTimer: 0,
    pointSpawnTimer: 0
  };

  // Asset Caching
  const spriteCache = {};
  const ASSET_PATHS = {
    // Kairosoft 16:9 Widescreen Studio Scenes
    kairo_campus: "assets/2d/kairo_studio_campus.png",
    kairo_soundstage: "assets/2d/kairo_soundstage.png",
    kairo_writers: "assets/2d/kairo_writers_room.png",
    kairo_post: "assets/2d/kairo_post_suite.png",
    kairo_cinema: "assets/2d/kairo_cinema_theater.png",
    kairo_executive: "assets/2d/kairo_executive_office.png",

    // Buildings (Isometric Sprites for Sandbox)
    soundstage: "assets/2d/soundstage.png",
    virtual_led: "assets/2d/virtual_led.png",
    post_suite: "assets/2d/post_suite.png",
    writers_bungalow: "assets/2d/writers_bungalow.png",
    studio_gate: "assets/2d/studio_gate.png",
    backlot: "assets/2d/backlot.png",
    cinema_theater: "assets/2d/cinema_theater.png",
    executive: "assets/2d/executive.png",

    // Ground tiles
    tile_road: "assets/2d/tile_road.png",
    tile_plaza: "assets/2d/tile_plaza.png",
    tile_concrete: "assets/2d/tile_concrete.png",
    tile_grass: "assets/2d/tile_grass.png",

    // Legacy Characters
    director: "assets/2d/char_director.png",
    cameraman: "assets/2d/char_cameraman.png",
    star_actor: "assets/2d/char_star_actor.png",
    extra: "assets/2d/char_extra.png",
    audience: "assets/2d/char_audience.png",
    male_idle: "assets/2d/char_male_idle.png",
    male_walk0: "assets/2d/char_male_walk0.png",
    male_walk1: "assets/2d/char_male_walk1.png",
    female_walk0: "assets/2d/char_female_walk0.png",

    // Kairosoft & Tycoon Reference Pixel Characters
    char_robot: "assets/pixel-characters/char-robot.png",
    char_zombie: "assets/pixel-characters/char-zombie.png",
    char_male_1: "assets/pixel-characters/char-male-1.png",
    char_male_2: "assets/pixel-characters/char-male-2.png",
    char_male_cheer: "assets/pixel-characters/char-male-cheer.png",
    char_female_1: "assets/pixel-characters/char-female-1.png",
    char_female_2: "assets/pixel-characters/char-female-2.png",
    char_female_cheer: "assets/pixel-characters/char-female-cheer.png",

    // 25 Itch Pixel Avatars
    avatar_01: "assets/itch-avatars/Avatars_01.png",
    avatar_02: "assets/itch-avatars/Avatars_02.png",
    avatar_03: "assets/itch-avatars/Avatars_03.png",
    avatar_04: "assets/itch-avatars/Avatars_04.png",
    avatar_05: "assets/itch-avatars/Avatars_05.png",
    avatar_06: "assets/itch-avatars/Avatars_06.png",
    avatar_07: "assets/itch-avatars/Avatars_07.png",
    avatar_08: "assets/itch-avatars/Avatars_08.png",
    avatar_09: "assets/itch-avatars/Avatars_09.png",
    avatar_10: "assets/itch-avatars/Avatars_10.png",
    avatar_11: "assets/itch-avatars/Avatars_11.png",
    avatar_12: "assets/itch-avatars/Avatars_12.png",
    avatar_13: "assets/itch-avatars/Avatars_13.png",
    avatar_14: "assets/itch-avatars/Avatars_14.png",
    avatar_15: "assets/itch-avatars/Avatars_15.png",
    avatar_16: "assets/itch-avatars/Avatars_16.png",
    avatar_17: "assets/itch-avatars/Avatars_17.png",
    avatar_18: "assets/itch-avatars/Avatars_18.png",
    avatar_19: "assets/itch-avatars/Avatars_19.png",
    avatar_20: "assets/itch-avatars/Avatars_20.png",
    avatar_21: "assets/itch-avatars/Avatars_21.png",
    avatar_22: "assets/itch-avatars/Avatars_22.png",
    avatar_23: "assets/itch-avatars/Avatars_23.png",
    avatar_24: "assets/itch-avatars/Avatars_24.png",
    avatar_25: "assets/itch-avatars/Avatars_25.png",

    // Itch UI Graphics
    itch_banner: "assets/itch-ui/banners/Banner.png",
    itch_banner_slots: "assets/itch-ui/banners/Banner_Slots.png",
    itch_btn_blue: "assets/itch-ui/buttons/BigBlueButton_Regular.png",
    itch_btn_red: "assets/itch-ui/buttons/BigRedButton_Regular.png",
    itch_btn_round: "assets/itch-ui/buttons/SmallBlueRoundButton_Regular.png",
    itch_wood: "assets/itch-ui/wood/WoodTable.png",
    itch_paper: "assets/itch-ui/papers/RegularPaper.png"
  };

  function loadAsset(key, url) {
    if (spriteCache[key]) return spriteCache[key];
    const img = new Image();
    img.src = url;
    spriteCache[key] = { img, loaded: false };
    img.onload = () => { spriteCache[key].loaded = true; };
    return spriteCache[key];
  }

  function preloadAllAssets() {
    for (const k in ASSET_PATHS) {
      loadAsset(k, ASSET_PATHS[k]);
    }
  }

  // Coordinate projections for sandbox grid overlay
  function gridToScreen(gx, gy) {
    const sx = (gx - gy) * (TILE_W / 2) * camera.zoom + camera.x;
    const sy = (gx + gy) * (TILE_H / 2) * camera.zoom + camera.y;
    return { x: sx, y: sy };
  }

  function screenToGrid(sx, sy) {
    const adjX = (sx - camera.x) / camera.zoom;
    const adjY = (sy - camera.y) / camera.zoom;
    const gx = (adjX / (TILE_W / 2) + adjY / (TILE_H / 2)) / 2;
    const gy = (adjY / (TILE_H / 2) - adjX / (TILE_W / 2)) / 2;
    return { x: Math.floor(gx), y: Math.floor(gy) };
  }

  // Floating text particle system
  function addFloatingText(text, gx, gy, color) {
    let sx = gx;
    let sy = gy;
    if (typeof gx === "number" && gx < 100 && typeof gy === "number" && gy < 100) {
      const scr = gridToScreen(gx, gy);
      sx = scr.x;
      sy = scr.y - 20;
    }
    _floatingTexts.push({
      text,
      x: sx,
      y: sy,
      color: color || "#f5c518",
      life: 1.0,
      vy: -35
    });
  }

  // Directing Minigame
  function startDirectingScene(buildingId) {
    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    if (!engine) return;
    const stateStr = engine.get_lot_state_json();
    const lot = JSON.parse(stateStr);
    const bld = lot.buildings ? lot.buildings.find(b => b.id === buildingId) : null;
    if (!bld) return;

    _directingState = {
      stageId: buildingId,
      title: bld.active_title || "Untitled Production",
      step: 1, // 1: Call Roll, 2: Action, 3: Cut & Print
      timer: 0,
      feedback: "Call 'Quiet on set!' to begin the shot."
    };
    renderInspector();
  }

  function advanceDirectingStep() {
    if (!_directingState) return;
    const G = typeof window !== "undefined" ? window.G : null;
    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    const stateStr = engine ? engine.get_lot_state_json() : "{}";
    const lot = JSON.parse(stateStr);
    const bld = lot.buildings ? lot.buildings.find(b => b.id === _directingState.stageId) : null;

    if (_directingState.step === 1) {
      _directingState.step = 2;
      _directingState.feedback = "Cameras rolling! Call 'ACTION!'";
      if (bld) addFloatingText("ROLLING CAMERA", bld.grid_x + 1.5, bld.grid_y + 1.5, "#3b82f6");
      _kairoStats.direction = Math.min(100, _kairoStats.direction + 5);
      if (typeof beep === "function") beep("click");
    } else if (_directingState.step === 2) {
      _directingState.step = 3;
      _directingState.feedback = "Actors performing! Call 'CUT & PRINT IT!'";
      if (bld) addFloatingText("ACTION!", bld.grid_x + 1.5, bld.grid_y + 1.5, "#ef4444");
      _kairoStats.acting = Math.min(100, _kairoStats.acting + 7);
      if (typeof beep === "function") beep("clap");
    } else if (_directingState.step === 3) {
      if (G && G.studio) {
        G.studio.rep = Math.min(99, G.studio.rep + 0.5);
        if (typeof log === "function") log("Director cut approved on " + _directingState.title + ": +0.5 Studio Rep & +5 Hype.", "gold");
      }
      if (bld) {
        addFloatingText("PRINT IT! +5 HYPE", bld.grid_x + 1.5, bld.grid_y + 1.5, "#10b981");
      }
      _kairoStats.direction = Math.min(100, _kairoStats.direction + 8);
      _kairoStats.soundVfx = Math.min(100, _kairoStats.soundVfx + 6);
      if (typeof beep === "function") beep("good");
      _directingState = null;
    }
    renderInspector();
  }

  // Room view switcher
  function setLotView(view) {
    _currentLotView = view;
    const tabs = document.querySelectorAll(".kairo-nav-tab");
    tabs.forEach(tab => {
      if (tab.dataset.view === view) tab.classList.add("active");
      else tab.classList.remove("active");
    });
    if (_canvas) {
      camera.x = _canvas.width / 2;
      camera.y = _canvas.height / 2;
      camera.zoom = 1.0;
    }
    updateLotHud();
  }

  // Main Render Loop
  function render(time) {
    if (!_canvas || !_ctx) return;
    const dt = _lastTime ? Math.min(0.1, (time - _lastTime) / 1000) : 0.016;
    _lastTime = time;

    // Simulation Tick
    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    if (engine) {
      const currentWeek = (typeof G !== "undefined" && G && G.week) ? G.week : 1;
      engine.tick(dt, currentWeek);
    }

    // Spawn floating points periodically (Kairosoft active stat cadence)
    _kairoStats.pointSpawnTimer += dt;
    if (_kairoStats.pointSpawnTimer > 1.2) {
      _kairoStats.pointSpawnTimer = 0;
      spawnPeriodicStatPoint();
    }

    // Clear Canvas
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    // Render active view
    if (_currentLotView === "campus") {
      renderCampusView(_ctx, dt);
    } else if (_currentLotView === "soundstage") {
      renderSoundstageView(_ctx, dt);
    } else if (_currentLotView === "writers") {
      renderWritersView(_ctx, dt);
    } else if (_currentLotView === "post") {
      renderPostView(_ctx, dt);
    } else if (_currentLotView === "cinema") {
      renderCinemaView(_ctx, dt);
    } else if (_currentLotView === "executive") {
      renderExecutiveView(_ctx, dt);
    }

    // Render Floating Text Particles across all views
    renderFloatingTexts(_ctx, dt);

    // Draw active Room View Watermark
    drawViewWatermark(_ctx);

    _animId = requestAnimationFrame(render);
  }

  function spawnPeriodicStatPoint() {
    let pool = [];
    if (_currentLotView === "writers") {
      pool = [
        { t: "+1 SCENARIO", c: "#38bdf8" },
        { t: "+2 SCRIPT", c: "#f5c518" },
        { t: "[IDEA!]", c: "#ffffff" },
        { t: "+1 DIALOGUE", c: "#34d399" }
      ];
      _kairoStats.scenario = Math.min(100, _kairoStats.scenario + 1);
    } else if (_currentLotView === "soundstage") {
      pool = [
        { t: "+2 ACTING", c: "#ec4899" },
        { t: "+1 DIRECTION", c: "#f5c518" },
        { t: "+1 CAMERA", c: "#a855f7" },
        { t: "[ACTION!]", c: "#ffffff" }
      ];
      _kairoStats.acting = Math.min(100, _kairoStats.acting + 1);
    } else if (_currentLotView === "post") {
      pool = [
        { t: "+2 SOUND FX", c: "#a855f7" },
        { t: "+1 COLOR GRADE", c: "#ec4899" },
        { t: "+2 MASTER MIX", c: "#38bdf8" },
        { t: "[SYNC!]", c: "#10b981" }
      ];
      _kairoStats.soundVfx = Math.min(100, _kairoStats.soundVfx + 1);
    } else if (_currentLotView === "cinema") {
      pool = [
        { t: "+5 BUZZ", c: "#f5c518" },
        { t: "[STANDING OVATION]", c: "#ffffff" },
        { t: "[10/10 MASTERPIECE]", c: "#10b981" },
        { t: "+3 BOX OFFICE", c: "#38bdf8" }
      ];
    } else if (_currentLotView === "executive") {
      pool = [
        { t: "+$120K ROYALTY", c: "#10b981" },
        { t: "+1 REPUTATION", c: "#f5c518" },
        { t: "[GREENLIT!]", c: "#38bdf8" },
        { t: "+2 OSCAR ODDS", c: "#fb7185" }
      ];
    } else {
      pool = [
        { t: "[CAMPUS ACTIVE]", c: "#f5c518" },
        { t: "+1 STUDIO BUZZ", c: "#38bdf8" },
        { t: "[ROLLING CART]", c: "#10b981" }
      ];
    }
    const p = pool[Math.floor(Math.random() * pool.length)];
    const rx = _canvas.width * (0.28 + Math.random() * 0.44);
    const ry = _canvas.height * (0.45 + Math.random() * 0.25);
    addFloatingText(p.t, rx, ry, p.c);
  }

  // ── VIEW 1: Campus Lot (Wide Hollywood Studio Campus) ──
  // Interactive hotspots pinned to building coordinates on 1376x768 16:9 campus image
  const CAMPUS_HOTSPOTS = [
    { id: "soundstage",  name: "Soundstage 1",       sub: "Filming & Sets",        xPct: 0.50, yPct: 0.22, radius: 55, view: "soundstage" },
    { id: "soundstage2", name: "Soundstage 2",       sub: "Active Shoot",          xPct: 0.67, yPct: 0.30, radius: 55, view: "soundstage" },
    { id: "writers",     name: "Writers Bungalow",   sub: "Screenplay Lab",        xPct: 0.43, yPct: 0.49, radius: 50, view: "writers" },
    { id: "post",        name: "Post & VFX Suite",   sub: "Editing & Audio",       xPct: 0.12, yPct: 0.44, radius: 55, view: "post" },
    { id: "cinema",      name: "Cinema Marquee",     sub: "Box Office Premiere",   xPct: 0.16, yPct: 0.70, radius: 60, view: "cinema" },
    { id: "executive",   name: "Studio Tower & HQ",  sub: "Executive Desk",        xPct: 0.27, yPct: 0.18, radius: 50, view: "executive" }
  ];

  // ── Ambient footstep dust particles (purely decorative) ──
  const _campusDust = [];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function spawnDust(x, y, zoom, tint) {
    if (_campusDust.length > 60) return;
    _campusDust.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 14 * zoom,
      vy: -6 * zoom - Math.random() * 8 * zoom,
      r: (1.4 + Math.random() * 2.2) * zoom,
      life: 1,
      tint: tint || "rgba(210,200,175,"
    });
  }

  function renderCampusDust(ctx, dt) {
    for (let i = _campusDust.length - 1; i >= 0; i--) {
      const d = _campusDust[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 6 * dt;            // settle
      d.r += 6 * dt;             // expand
      d.life -= dt * 1.5;
      if (d.life <= 0) { _campusDust.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.life) * 0.5;
      ctx.fillStyle = d.tint + (Math.max(0, d.life) * 0.5).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Animated Golf Carts along campus road networks
  const _campusGolfCarts = [
    { t: 0.15, speed: 0.045, dir: 1, hue: "#facc15", driver: "char_male_2", path: [
      { x: 0.39, y: 0.82 }, // Studio Gate
      { x: 0.47, y: 0.66 }, // Main Ave
      { x: 0.55, y: 0.48 }, // Stage Junction
      { x: 0.64, y: 0.38 }  // Stage 1 & 2
    ]},
    { t: 0.65, speed: 0.035, dir: -1, hue: "#7dd3fc", driver: "char_female_1", path: [
      { x: 0.18, y: 0.76 }, // Cinema plaza
      { x: 0.31, y: 0.70 }, // South road
      { x: 0.42, y: 0.58 }  // Writers loop
    ]}
  ];

  // Animated staff pedestrians on campus walkways.
  // speed is normalized path units/sec; phase drives the walk cycle,
  // wait is the pause taken when the walker reaches either end of its path.
  const _campusStaff = [
    { name: "Director", role: "Stanley K.", av: "char_director", color: "#f5c518", path: [{x:0.52, y:0.35}, {x:0.62, y:0.38}], t: 0.2, speed: 0.06, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Stage 1 call time!" },
    { name: "Lead Star", role: "Guy Wesley", av: "char_male_1", color: "#ec4899", path: [{x:0.41, y:0.56}, {x:0.49, y:0.52}], t: 0.7, speed: 0.05, dir: -1, wait: 1.2, phase: 0, idle: 0, flip: -1, quote: "Reviewing script notes" },
    { name: "Starlet", role: "Sofia Kennedy", av: "char_female_1", color: "#a855f7", path: [{x:0.36, y:0.68}, {x:0.44, y:0.64}], t: 0.3, speed: 0.05, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Costume fitting done" },
    { name: "Kairo Mascot", role: "Kairobot", av: "char_robot", color: "#38bdf8", path: [{x:0.25, y:0.75}, {x:0.35, y:0.72}], t: 0.5, speed: 0.065, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "[KAIRO DEV!]" },
    { name: "Method Zombie", role: "Boris Z.", av: "char_zombie", color: "#10b981", path: [{x:0.75, y:0.42}, {x:0.85, y:0.40}], t: 0.8, speed: 0.04, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "[METHOD ACTING!]" },
    { name: "Cameraman", role: "Cinematographer", av: "char_cameraman", color: "#38bdf8", path: [{x:0.48, y:0.68}, {x:0.54, y:0.54}], t: 0.4, speed: 0.055, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Anamorphic lenses set" },
    { name: "Screenwriter", role: "Quentin S.", av: "char_male_2", color: "#10b981", path: [{x:0.38, y:0.50}, {x:0.44, y:0.48}], t: 0.9, speed: 0.04, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "Act III climax finished" },
    { name: "Stunt Lead", role: "Action Jack", av: "char_male_cheer", color: "#f97316", path: [{x:0.60, y:0.55}, {x:0.68, y:0.52}], t: 0.1, speed: 0.07, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Stunt rig certified!" },
    { name: "Stunt Double", role: "Elena Jump", av: "char_female_cheer", color: "#ec4899", path: [{x:0.55, y:0.45}, {x:0.63, y:0.48}], t: 0.6, speed: 0.06, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "High fall ready!" },
    { name: "Boom Op", role: "Audio Ava", av: "female_walk0", color: "#06b6d4", path: [{x:0.46, y:0.38}, {x:0.53, y:0.42}], t: 0.4, speed: 0.05, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Mic levels balanced" },
    { name: "Studio Chief", role: "David O.", av: "avatar_03", color: "#eab308", path: [{x:0.65, y:0.30}, {x:0.72, y:0.32}], t: 0.5, speed: 0.045, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "Box office looking huge" },
    { name: "Animal Actor", role: "Barnaby Bear", av: "avatar_19", color: "#854d0e", path: [{x:0.70, y:0.52}, {x:0.78, y:0.55}], t: 0.2, speed: 0.035, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Growl cue practiced" },

    /* ── added cast: more bodies, more roles, more life ── */
    { name: "Runner", role: "PA Casey", av: "male_walk0", color: "#38bdf8", path: [{x:0.30, y:0.60}, {x:0.44, y:0.44}, {x:0.58, y:0.40}], t: 0.15, speed: 0.10, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Coffee run for Stage 2!" },
    { name: "Publicist", role: "Mara V.", av: "char_female_2", color: "#f472b6", path: [{x:0.14, y:0.62}, {x:0.24, y:0.66}], t: 0.55, speed: 0.055, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "No comment, please" },
    { name: "Security", role: "Guard Ray", av: "char_male_1", color: "#60a5fa", path: [{x:0.345, y:0.80}, {x:0.425, y:0.79}], t: 0.35, speed: 0.03, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Lot pass, please" },
    { name: "VFX Artist", role: "Nina R.", av: "char_female_1", color: "#a78bfa", path: [{x:0.10, y:0.50}, {x:0.20, y:0.53}], t: 0.75, speed: 0.05, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "Rendering the final shot" },
    { name: "Costumer", role: "Ivy L.", av: "char_female_2", color: "#fbbf24", path: [{x:0.40, y:0.60}, {x:0.50, y:0.63}], t: 0.45, speed: 0.05, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Fitting at 4pm" },
    { name: "Gaffer", role: "Lou T.", av: "char_male_cheer", color: "#fb923c", path: [{x:0.56, y:0.30}, {x:0.66, y:0.26}], t: 0.6, speed: 0.05, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Striking the rig" },
    { name: "Composer", role: "Hans E.", av: "char_male_2", color: "#34d399", path: [{x:0.20, y:0.42}, {x:0.30, y:0.40}], t: 0.25, speed: 0.04, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "The score needs strings" },
    { name: "Intern", role: "Timmy", av: "char_male_1", color: "#22d3ee", path: [{x:0.62, y:0.62}, {x:0.72, y:0.58}, {x:0.80, y:0.55}], t: 0.05, speed: 0.085, dir: 1, wait: 0, phase: 0, idle: 0, flip: 1, quote: "Which stage again?!" },
    { name: "Crafty", role: "Snack Cart", av: "avatar_19", color: "#f59e0b", path: [{x:0.33, y:0.72}, {x:0.47, y:0.70}], t: 0.9, speed: 0.03, dir: -1, wait: 0, phase: 0, idle: 0, flip: -1, quote: "Popcorn? $12" }
  ];

  function getPathPoint(path, progress) {
    const p = Math.max(0, Math.min(1, progress));
    const totalSegments = path.length - 1;
    const seg = Math.min(totalSegments - 1, Math.floor(p * totalSegments));
    const localT = (p * totalSegments) - seg;
    const p0 = path[seg];
    const p1 = path[seg + 1];
    return {
      x: p0.x + (p1.x - p0.x) * localT,
      y: p0.y + (p1.y - p0.y) * localT
    };
  }

  function renderCampusView(ctx, dt) {
    const campusAsset = spriteCache["kairo_campus"];
    let drawX = 0, drawY = 0, drawW = _canvas.width, drawH = _canvas.height;

    if (campusAsset && campusAsset.loaded) {
      const img = campusAsset.img;
      const scale = Math.max(_canvas.width / img.width, _canvas.height / img.height) * camera.zoom;
      drawW = img.width * scale;
      drawH = img.height * scale;
      drawX = (_canvas.width - drawW) / 2 + (camera.x - _canvas.width / 2);
      drawY = (_canvas.height - drawH) / 2 + (camera.y - _canvas.height / 2);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, _canvas.height);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e293b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    // 1. Render Animated Golf Carts along studio roadways
    renderCampusGolfCarts(ctx, drawX, drawY, drawW, drawH, dt);

    // 2. Render Roaming Studio Staff along walkways
    renderCampusPedestrians(ctx, drawX, drawY, drawW, drawH, dt);

    // 3. Ambient footstep dust kicked up by the cast
    renderCampusDust(ctx, dt);

    // 3. Render Active Filming Live Indicator over Soundstages
    renderCampusActiveShootGlow(ctx, drawX, drawY, drawW, drawH);

    // 4. Render Interactive Golden Hotspot Plaques
    drawCampusHotspots(ctx, drawX, drawY, drawW, drawH);

    // 5. Render custom user sandbox buildings ONLY if Build Mode is active
    if (_buildModeType) {
      const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
      if (engine) {
        const stateStr = engine.get_lot_state_json();
        const lot = JSON.parse(stateStr);
        for (const b of (lot.buildings || [])) {
          drawBuilding(ctx, b);
        }
        if (_hoveredGridPos && _hoveredGridPos.x >= 0 && _hoveredGridPos.x < (lot.cols || 24)) {
          const hScr = gridToScreen(_hoveredGridPos.x, _hoveredGridPos.y);
          drawTileHighlight(ctx, hScr.x, hScr.y, "rgba(245, 197, 24, 0.45)");
        }
      }
    }

    // 6. Campus Quick Stat Banner
    drawCampusHud(ctx);
  }

  function renderCampusGolfCarts(ctx, ox, oy, ow, oh, dt) {
    /* nightness drives the headlight cone; LotLife owns the clock */
    var nightness = 0;
    try {
      if (global.LotLife && typeof global.LotLife.mood === "function") {
        nightness = Math.max(0, Math.min(1, 1 - global.LotLife.mood().light));
      }
    } catch (e) { nightness = 0; }

    for (const cart of _campusGolfCarts) {
      cart.t += cart.speed * cart.dir * dt;
      if (cart.t > 1.0) { cart.t = 1.0; cart.dir = -1; }
      else if (cart.t < 0.0) { cart.t = 0.0; cart.dir = 1; }

      const pt = getPathPoint(cart.path, cart.t);
      const cx = ox + ow * pt.x;
      const cy = oy + oh * pt.y;

      /* wheels roll with distance travelled; body bobs on the suspension */
      cart.wheel = (cart.wheel || 0) + cart.speed * cart.dir * dt * 26;
      const bob = Math.abs(Math.sin(cart.wheel * 1.5)) * 1.1 * camera.zoom;
      const cyB = cy - bob;
      const cw = 24 * camera.zoom;
      const ch = 15 * camera.zoom;

      /* tyre dust trailing the rear wheel */
      if (Math.random() < 0.25) {
        spawnDust(cx - cart.dir * cw * 0.5, cy + 1 * camera.zoom, camera.zoom, "rgba(190,182,160,");
      }

      ctx.save();

      /* ground shadow shrinks as the body lifts */
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4, (14 - bob * 0.6) * camera.zoom, (6 - bob * 0.3) * camera.zoom, 0, 0, Math.PI * 2);
      ctx.fill();

      /* headlight cone after dark */
      if (nightness > 0.25) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.22 * nightness;
        ctx.fillStyle = "#ffe9b0";
        ctx.beginPath();
        ctx.moveTo(cx + cart.dir * cw * 0.5, cyB - ch * 0.45);
        ctx.lineTo(cx + cart.dir * (cw * 0.5 + 46 * camera.zoom), cyB - ch * 0.95);
        ctx.lineTo(cx + cart.dir * (cw * 0.5 + 46 * camera.zoom), cyB + ch * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      /* body */
      ctx.fillStyle = cart.hue;
      ctx.strokeStyle = "#7c4a03";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - cw / 2, cyB - ch, cw, ch, 3);
      ctx.fill();
      ctx.stroke();

      /* side stripe so the body reads as a vehicle, not a block */
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(cx - cw / 2 + 2, cyB - ch * 0.45, cw - 4, 2 * camera.zoom);

      /* roof canopy */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - cw / 2 + 2, cyB - ch - 8 * camera.zoom, cw - 4, 3 * camera.zoom);
      ctx.strokeStyle = "#475569";
      ctx.strokeRect(cx - cw / 2 + 2, cyB - ch - 8 * camera.zoom, cw - 4, 3 * camera.zoom);
      ctx.beginPath();
      ctx.moveTo(cx - cw / 2 + 3, cyB - ch);
      ctx.lineTo(cx - cw / 2 + 3, cyB - ch - 6 * camera.zoom);
      ctx.moveTo(cx + cw / 2 - 3, cyB - ch);
      ctx.lineTo(cx + cw / 2 - 3, cyB - ch - 6 * camera.zoom);
      ctx.stroke();

      /* driver: a sprite that bobs with the suspension */
      const drv = spriteCache[cart.driver];
      const dsz = 15 * camera.zoom;
      if (drv && drv.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        ctx.translate(cx - cart.dir * cw * 0.16, cyB - ch - dsz * 0.42 - bob * 0.4);
        if (cart.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(drv.img, -dsz / 2, -dsz / 2, dsz, dsz);
        ctx.restore();
      }

      /* wheels: hub + two spokes that visibly rotate */
      const wr = 3.4 * camera.zoom;
      for (const side of [-1, 1]) {
        const wx = cx + side * 7.4 * camera.zoom;
        const wy = cy + 0.5 * camera.zoom;
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(226,232,240,.75)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let s = 0; s < 2; s++) {
          const a = cart.wheel + s * Math.PI / 2;
          ctx.moveTo(wx - Math.cos(a) * wr * 0.72, wy - Math.sin(a) * wr * 0.72);
          ctx.lineTo(wx + Math.cos(a) * wr * 0.72, wy + Math.sin(a) * wr * 0.72);
        }
        ctx.stroke();
        /* hub cap */
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.arc(wx, wy, wr * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }

      /* headlamp bulb */
      ctx.fillStyle = nightness > 0.25 ? "#fff3c4" : "#e2e8f0";
      ctx.beginPath();
      ctx.arc(cx + cart.dir * (cw / 2 - 1), cyB - ch * 0.45, 1.6 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function renderCampusPedestrians(ctx, ox, oy, ow, oh, dt) {
    /* Depth-sort so nearer walkers overlap the ones behind them. */
    const order = [];
    for (let i = 0; i < _campusStaff.length; i++) {
      const p = _campusStaff[i];

      /* ── walk state machine: walk → pause at the end of the path → turn ── */
      if (p.wait > 0) {
        p.wait -= dt;
        p.idle += dt;
        if (p.wait <= 0) p.dir = -p.dir;      // turn around once the pause ends
      } else {
        const before = p.t;
        p.t += p.speed * p.dir * dt;
        if (p.t >= 1.0) { p.t = 1.0; p.wait = 0.7 + Math.random() * 2.4; }
        else if (p.t <= 0.0) { p.t = 0.0; p.wait = 0.7 + Math.random() * 2.4; }
        /* cycle speed scales with how fast the body is actually moving */
        p.phase += dt * (7 + p.speed * 110);
        /* a footfall lands each time the cycle crosses the ground plane */
        if (before !== p.t && Math.sin(p.phase) < 0 && Math.sin(p.phase - dt * (7 + p.speed * 110)) >= 0) {
          const pp = getPathPoint(p.path, p.t);
          spawnDust(ox + ow * pp.x, oy + oh * pp.y, camera.zoom, "rgba(205,196,172,");
        }
      }
      p.flip += (p.dir - p.flip) * Math.min(1, dt * 9);   // eased turn, not a snap

      const pt = getPathPoint(p.path, p.t);
      order.push({ p: p, i: i, px: ox + ow * pt.x, py: oy + oh * pt.y });
    }
    order.sort((a, b) => a.py - b.py);

    for (const o of order) {
      const p = o.p, i = o.i, px = o.px, py = o.py;
      const moving = p.wait <= 0;
      const z = camera.zoom;

      /* ── the walk cycle: bob, lean and squash driven off one phase ── */
      const s = Math.sin(p.phase);
      const bob = moving
        ? Math.abs(s) * 3.4 * z
        : Math.sin(p.idle * 1.7) * 0.7 * z;                       // idle breathing
      const lean = moving ? s * 0.055 : Math.sin(p.idle * 0.9) * 0.012;
      const sq = moving ? 1 + Math.sin(p.phase * 2) * 0.035 : 1 + Math.sin(p.idle * 1.7) * 0.012;

      const cached = spriteCache[p.av];
      const sz = 28 * z;
      const top = py - sz * 0.5 - bob;

      ctx.save();

      /* ground shadow tightens as the body rises */
      const lift = clamp(bob / (3.4 * z), 0, 1);
      ctx.fillStyle = "rgba(0,0,0," + (0.30 - lift * 0.10).toFixed(3) + ")";
      ctx.beginPath();
      ctx.ellipse(px, py, (7 - lift * 1.6) * z, (3 - lift * 0.7) * z, 0, 0, Math.PI * 2);
      ctx.fill();

      /* contact patch: a faint dark ellipse under the feet while moving */
      if (moving) {
        ctx.fillStyle = "rgba(0,0,0,0.10)";
        ctx.beginPath();
        ctx.ellipse(px, py - 0.5 * z, 9 * z, 2.6 * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      /* sprite with eased facing, lean and squash */
      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        ctx.translate(px, top);
        ctx.rotate(lean * (p.flip < 0 ? -1 : 1));
        ctx.scale(p.flip < 0 ? -1 : 1, 1);
        ctx.scale(1 / sq, sq);
        ctx.drawImage(cached.img, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, top - 4 * z, 6 * z, 0, Math.PI * 2);
        ctx.fill();
      }

      /* a little hat/role pip so roles read at a glance */
      if (z >= 0.9) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(px - 1.4 * z, top - sz * 0.52 - 2 * z, 2.8 * z, 2.2 * z);
        ctx.globalAlpha = 1;
      }

      // ── Label discipline ────────────────────────────────────────────
      // A dozen permanent name pills turned the lot into noise. Now only
      // the character under the cursor speaks, plus one rotating "focus"
      // character every ~5 s, so the campus reads as a working set.
      const focusIdx = Math.floor(performance.now() / 5200) % _campusStaff.length;
      const isFocus = i === focusIdx;
      const nearCursor = Math.hypot(px - _pointerScreen.x, py - _pointerScreen.y) < 118;

      if (_hoveredHotspot === null && (nearCursor || isFocus)) {
        const label = nearCursor ? p.role : p.name;
        ctx.font = "700 9px ui-monospace, SFMono-Regular, monospace";
        const tw = ctx.measureText(label).width;
        const bw = tw + 12;
        const bh = 14;
        const by = top - bh - 6;

        // leader line pins the tag to its sprite
        ctx.strokeStyle = nearCursor ? "rgba(245,197,24,0.9)" : "rgba(245,197,24,0.30)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, by + bh);
        ctx.lineTo(px, top + sz * 0.45);
        ctx.stroke();

        ctx.fillStyle = "rgba(8,12,20,0.92)";
        ctx.strokeStyle = nearCursor ? p.color : "rgba(245,197,24,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(px - bw / 2, by, bw, bh, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = nearCursor ? "#ffffff" : "#ffe6ad";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px, by + bh / 2 + 0.5);
        ctx.textBaseline = "alphabetic";
      }

      // One speaker at a time — chatter should feel like a film set,
      // not a chatroom. Only the focus character ever talks, and only when
      // it is standing still, so the line lands while the player can read it.
      if (isFocus && !moving && p.idle > 0.35 && Math.sin(p.idle * 2.2) > 0.55) {
        const line = p.quote;
        ctx.font = "700 9px ui-monospace, SFMono-Regular, monospace";
        const qw = ctx.measureText(line).width + 14;
        const qh = 16;
        const qy = top - qh - 24;
        /* bubble pops in with a slight overshoot as the line starts */
        const grow = Math.min(1, (p.idle - 0.35) * 4);
        const gs = 0.82 + grow * 0.18;

        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.strokeStyle = "rgba(8,12,20,0.85)";
        ctx.lineWidth = 1;
        ctx.save();
        ctx.translate(px, qy + qh);
        ctx.scale(gs, gs);
        ctx.translate(-px, -(qy + qh));
        ctx.beginPath();
        ctx.roundRect(px - qw / 2, qy, qw, qh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px - 4, qy + qh);
        ctx.lineTo(px + 4, qy + qh);
        ctx.lineTo(px, qy + qh + 5);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(line, px, qy + qh / 2 + 0.5);
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      }
      ctx.restore();
    }
  }

  function renderCampusActiveShootGlow(ctx, ox, oy, ow, oh) {
    const G = typeof window !== "undefined" ? window.G : null;
    if (!G) return;
    const inProd = (G.projects || []).filter(p => p.phase !== "ready");
    if (!inProd.length) return;

    const time = performance.now();
    const pulse = 0.5 + Math.sin(time * 0.008) * 0.4;
    const activeTitle = inProd[0].title || "Summer Blockbuster";

    // Stage 1 coordinates
    const sx = ox + ow * 0.50;
    const sy = oy + oh * 0.16;

    ctx.save();
    // Glowing red "ON AIR" banner above soundstage
    ctx.fillStyle = `rgba(239, 68, 68, ${0.85 * pulse})`;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sx - 70, sy - 28, 140, 22, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("[FILMING] " + activeTitle.slice(0, 14), sx, sy - 14);
    ctx.restore();
  }

  function drawCampusHotspots(ctx, ox, oy, ow, oh) {
    const time = performance.now() * 0.003;
    for (const spot of CAMPUS_HOTSPOTS) {
      const sx = ox + ow * spot.xPct;
      const sy = oy + oh * spot.yPct;
      const isHovered = _hoveredHotspot === spot.id;

      ctx.save();
      // Subtle pulse ring on hover
      if (isHovered) {
        const pulse = Math.sin(time * 8) * 4;
        ctx.strokeStyle = "rgba(245, 197, 24, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, (spot.radius + pulse) * camera.zoom * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Elegant Kairosoft Wooden Plaque Badge
      const bw = 136;
      const bh = 34;
      const bx = sx - bw / 2;
      const by = sy - (spot.radius * camera.zoom * 0.5) - bh;

      // Drop shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 2, bw, bh, 5);
      ctx.fill();

      // Plaque body
      ctx.fillStyle = isHovered ? "rgba(26, 36, 60, 0.96)" : "rgba(15, 23, 42, 0.90)";
      ctx.strokeStyle = isHovered ? "#ffd479" : "rgba(245, 197, 24, 0.5)";
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 5);
      ctx.fill();
      ctx.stroke();

      // Golden corner studs
      ctx.fillStyle = "#ffd479";
      ctx.fillRect(bx + 3, by + 3, 2, 2);
      ctx.fillRect(bx + bw - 5, by + 3, 2, 2);
      ctx.fillRect(bx + 3, by + bh - 5, 2, 2);
      ctx.fillRect(bx + bw - 5, by + bh - 5, 2, 2);

      // Title & Subtitle
      ctx.fillStyle = isHovered ? "#ffd479" : "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(spot.name, sx, by + 14);

      ctx.fillStyle = isHovered ? "#38bdf8" : "#94a3b8";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(spot.sub + (isHovered ? " [ENTER]" : ""), sx, by + 26);

      ctx.restore();
    }
  }

  function drawCampusHud(ctx) {
    ctx.save();
    const hudW = 230;
    const hudH = 50;
    const hudX = _canvas.width - hudW - 14;
    const hudY = 96;

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "rgba(245, 197, 24, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText("HOLLYWOOD PRODUCTION CAMPUS", hudX + 10, hudY + 16);

    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Click any building plaque to enter", hudX + 10, hudY + 31);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillText("Or switch rooms using tabs above", hudX + 10, hudY + 43);

    ctx.restore();
  }

  // ── VIEW 2: Soundstage Interior (Active Film Production) ──
  function renderSoundstageView(ctx, dt) {
    const asset = spriteCache["kairo_soundstage"];
    drawRoomBackdrop(ctx, asset);

    const time = performance.now();
    // Live Volumetric Stage Lights pulsing on green screen
    ctx.save();
    const lightPulse = 0.20 + Math.sin(time * 0.003) * 0.05;
    const coneGrad = ctx.createRadialGradient(_canvas.width * 0.52, _canvas.height * 0.20, 20, _canvas.width * 0.52, _canvas.height * 0.55, _canvas.width * 0.35);
    coneGrad.addColorStop(0, `rgba(255, 245, 180, ${lightPulse * 1.5})`);
    coneGrad.addColorStop(0.6, `rgba(100, 255, 120, ${lightPulse * 0.8})`);
    coneGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = coneGrad;
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    ctx.restore();

    // Live On-Air Blinking Red Indicator
    const blink = (Math.sin(time * 0.008) > 0);
    ctx.save();
    ctx.fillStyle = blink ? "#ef4444" : "#7f1d1d";
    ctx.beginPath();
    ctx.arc(36, 114, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(blink ? "ON AIR / FILMING" : "STAGE RECORDING", 50, 118);
    ctx.restore();

    // Animated Camera Dolly tracking along track
    const dollyT = 0.5 + Math.sin(time * 0.001) * 0.4;
    const dollyX = _canvas.width * (0.32 + dollyT * 0.20);
    const dollyY = _canvas.height * (0.72 - dollyT * 0.06);

    ctx.save();
    // Dolly glow
    ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
    ctx.beginPath();
    ctx.ellipse(dollyX, dollyY, 18, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crew Animations & Speech Bubbles
    drawSoundstageCrew(ctx, dt);

    // Clapperboard Snap Animation trigger
    drawClapperSnap(ctx, time);

    // Kairosoft 4-Stat Live Scoreboard
    drawKairosoftScoreboard(ctx, "SOUNDSTAGE 1 — PRODUCTION SCORE");
  }

  let _lastClapSnap = 0;
  function drawClapperSnap(ctx, time) {
    const cycle = (time % 8000);
    if (cycle < 1200) {
      if (time - _lastClapSnap > 7000) {
        _lastClapSnap = time;
        if (typeof beep === "function") beep("clap");
        addFloatingText("+25 DIRECTION", _canvas.width * 0.54, _canvas.height * 0.65, "#f5c518");
      }
      const p = cycle / 1200;
      const angle = (p < 0.3) ? (0.3 - p) * 1.5 : 0;

      ctx.save();
      const cx = _canvas.width * 0.54;
      const cy = _canvas.height * 0.68;
      ctx.translate(cx, cy);

      // Slate base
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-22, 0, 44, 30);
      ctx.strokeRect(-22, 0, 44, 30);

      ctx.fillStyle = "#f5c518";
      ctx.font = "bold 8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TAKE 3", 0, 18);

      // Slate stick
      ctx.save();
      ctx.rotate(-angle);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-22, -8, 44, 8);
      ctx.fillStyle = "#000000";
      ctx.fillRect(-15, -8, 6, 8);
      ctx.fillRect(-3, -8, 6, 8);
      ctx.fillRect(9, -8, 6, 8);
      ctx.restore();

      ctx.restore();
    }
  }

  function drawSoundstageCrew(ctx, dt) {
    const time = performance.now() * 0.003;
    const crew = [
      { role: "Director", x: _canvas.width * 0.74, y: _canvas.height * 0.74, color: "#f5c518", quote: "Action! Great emotion!", av: "char_director" },
      { role: "Camera Operator", x: _canvas.width * 0.38, y: _canvas.height * 0.76, color: "#38bdf8", quote: "Focus locked on lead", av: "char_cameraman" },
      { role: "Lead Star", x: _canvas.width * 0.54, y: _canvas.height * 0.62, color: "#ec4899", quote: "Delivering monologue!", av: "char_male_1" },
      { role: "Starlet", x: _canvas.width * 0.63, y: _canvas.height * 0.64, color: "#a855f7", quote: "Dramatic reaction shot!", av: "char_female_1" },
      { role: "Boom Operator", x: _canvas.width * 0.32, y: _canvas.height * 0.54, color: "#10b981", quote: "Audio levels clean", av: "avatar_11" },
      { role: "Studio Mascot", x: _canvas.width * 0.84, y: _canvas.height * 0.68, color: "#38bdf8", quote: "[KAIROBOT ON SET]", av: "char_robot" },
      { role: "Stunt Double", x: _canvas.width * 0.18, y: _canvas.height * 0.72, color: "#f97316", quote: "Action sequence ready!", av: "char_male_cheer" }
    ];

    for (let i = 0; i < crew.length; i++) {
      const c = crew[i];
      const bounce = Math.sin(time * 2 + i) * 3;
      const cached = spriteCache[c.av];

      ctx.save();
      if (_kairoStats.inTheZoneAgent === i) {
        ctx.save();
        ctx.strokeStyle = "rgba(245, 197, 24, 0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y - 20, 28 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, c.x - 22, c.y - 44 + bounce, 44, 44);
      } else {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(c.x, c.y - 20 + bounce, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(c.x - 36, c.y + 4, 72, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(c.role, c.x, c.y + 15);

      if (Math.sin(time + i * 2) > 0.6) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(c.x - 45, c.y - 68, 90, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText(c.quote, c.x, c.y - 55);
      }
      ctx.restore();
    }
  }

  // ── VIEW 3: Writers Bungalow (Screenplay Lab) ──
  function renderWritersView(ctx, dt) {
    const asset = spriteCache["kairo_writers"];
    drawRoomBackdrop(ctx, asset);

    const time = performance.now() * 0.003;

    // Steam particles rising from the coffee pot (around x: 0.17, y: 0.58)
    ctx.save();
    const potX = _canvas.width * 0.17;
    const potY = _canvas.height * 0.58;
    for (let i = 0; i < 4; i++) {
      const stY = potY - ((time * 30 + i * 15) % 40);
      const stX = potX + Math.sin(time * 3 + i) * 4;
      const alpha = 1.0 - (((time * 30 + i * 15) % 40) / 40);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * alpha})`;
      ctx.beginPath();
      ctx.arc(stX, stY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Writers room anim
    const writers = [
      { name: "Head Screenwriter", x: _canvas.width * 0.36, y: _canvas.height * 0.62, av: "char_male_2", quote: "Act III Plot Twist ready!" },
      { name: "Dialogue Polish", x: _canvas.width * 0.54, y: _canvas.height * 0.72, av: "char_female_2", quote: "Punching up one-liners..." },
      { name: "Story AI Consultant", x: _canvas.width * 0.70, y: _canvas.height * 0.64, av: "char_robot", quote: "Pacing formula verified!" }
    ];

    for (let i = 0; i < writers.length; i++) {
      const w = writers[i];
      const bounce = Math.sin(time * 3 + i) * 2;
      const cached = spriteCache[w.av];

      ctx.save();
      // Random "In The Zone" Flame Aura
      if (Math.sin(time * 0.4 + i * 3) > 0.8) {
        ctx.save();
        const auraGrad = ctx.createRadialGradient(w.x, w.y - 20, 10, w.x, w.y - 20, 40);
        auraGrad.addColorStop(0, "rgba(245, 197, 24, 0.9)");
        auraGrad.addColorStop(0.5, "rgba(239, 68, 68, 0.6)");
        auraGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(w.x, w.y - 20, 38 + Math.sin(time * 12) * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Typewriter paper curl & typing motion
      const typeStrike = Math.abs(Math.sin(time * 14 + i * 3)) * 3;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(w.x - 6, w.y - 12 - typeStrike, 12, 10);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(w.x - 4, w.y - 10 - typeStrike, 8, 1);
      ctx.fillRect(w.x - 4, w.y - 8 - typeStrike, 6, 1);

      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, w.x - 22, w.y - 44 + bounce, 44, 44);
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = "#f5c518";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(w.x - 45, w.y + 4, 90, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(w.name, w.x, w.y + 15);

      if (Math.sin(time * 0.8 + i * 4) > 0.82) {
        ctx.fillStyle = "#f5c518";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(w.x - 24, w.y - 75, 48, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("[IDEA!]", w.x, w.y - 64);
      } else if (Math.sin(time * 1.5 + i) > 0.5) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(w.x - 60, w.y - 68, 120, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText(w.quote, w.x, w.y - 55);
      }
      ctx.restore();
    }

    drawKairosoftScoreboard(ctx, "WRITERS BUNGALOW — SCRIPT QUALITY");
  }

  // ── VIEW 4: Post-Production & VFX Suite ──
  function renderPostView(ctx, dt) {
    const asset = spriteCache["kairo_post"];
    drawRoomBackdrop(ctx, asset);

    // Dynamic 16-band LED VU meter audio visualizer on mixer desk
    const time = performance.now() * 0.006;
    ctx.save();
    const meterX = _canvas.width * 0.66;
    const meterY = _canvas.height * 0.45;
    const barCount = 14;
    for (let i = 0; i < barCount; i++) {
      const h = Math.abs(Math.sin(time * 1.4 + i * 0.4)) * 32;
      const grad = ctx.createLinearGradient(0, meterY, 0, meterY - 32);
      grad.addColorStop(0, "#10b981");
      grad.addColorStop(0.7, "#f5c518");
      grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX + i * 6, meterY - h, 4, h);
    }
    ctx.restore();

    // Timeline Playhead cursor sweep on editing monitor
    ctx.save();
    const monX = _canvas.width * 0.28;
    const monY = _canvas.height * 0.38;
    const monW = 120;
    const playheadX = monX + ((time * 25) % monW);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, monY);
    ctx.lineTo(playheadX, monY + 60);
    ctx.stroke();
    ctx.restore();

    // Animated Post & Broadcast Artists
    const artists = [
      { role: "Audio Mixer", x: _canvas.width * 0.28, y: _canvas.height * 0.70, av: "char_male_2", color: "#38bdf8", quote: "Dialogue normalization 100%" },
      { role: "VFX Colorist", x: _canvas.width * 0.44, y: _canvas.height * 0.62, av: "char_female_1", color: "#ec4899", quote: "Master color grade locked" },
      { role: "Lead Editor", x: _canvas.width * 0.62, y: _canvas.height * 0.68, av: "female_walk0", color: "#10b981", quote: "Director's cut assembled!" }
    ];
    for (let i = 0; i < artists.length; i++) {
      const art = artists[i];
      const bounce = Math.sin(time * 0.5 + i) * 2;
      const cached = spriteCache[art.av];
      ctx.save();
      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, art.x - 22, art.y - 44 + bounce, 44, 44);
      }
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = art.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(art.x - 45, art.y + 4, 90, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(art.role, art.x, art.y + 15);

      if (Math.sin(time * 0.3 + i * 2) > 0.4) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(art.x - 65, art.y - 68, 130, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText(art.quote, art.x, art.y - 55);
      }
      ctx.restore();
    }

    drawKairosoftScoreboard(ctx, "POST-PRODUCTION — SOUND & VFX MIX");
  }

  // ── VIEW 5: Cinema Theater (Box Office Premiere) ──
  // STRICTLY ZERO EMOJIS — Retro pixel reaction symbols & gold stars
  function renderCinemaView(ctx, dt) {
    const asset = spriteCache["kairo_cinema"];
    drawRoomBackdrop(ctx, asset);

    const time = performance.now();

    // Golden Projection Beam from upper booth onto silver screen
    ctx.save();
    const beamPulse = 0.20 + Math.sin(time * 0.005) * 0.06;
    const beamGrad = ctx.createLinearGradient(_canvas.width * 0.34, _canvas.height * 0.12, _canvas.width * 0.82, _canvas.height * 0.24);
    beamGrad.addColorStop(0, `rgba(255, 245, 180, ${beamPulse * 1.6})`);
    beamGrad.addColorStop(1, "rgba(255, 255, 255, 0.02)");
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(_canvas.width * 0.34, _canvas.height * 0.12);
    ctx.lineTo(_canvas.width * 0.72, _canvas.height * 0.06);
    ctx.lineTo(_canvas.width * 0.94, _canvas.height * 0.45);
    ctx.lineTo(_canvas.width * 0.36, _canvas.height * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Popcorn kernels popping inside illuminated glass cart (x: 0.15, y: 0.52)
    ctx.save();
    const popX = _canvas.width * 0.15;
    const popY = _canvas.height * 0.52;
    for (let k = 0; k < 6; k++) {
      const popT = ((time * 0.008 + k * 1.2) % 3);
      if (popT < 1.0) {
        const kx = popX + Math.sin(k * 2) * 12;
        const ky = popY - popT * 18 + (popT * popT) * 18;
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(kx, ky, 3, 3);
      }
    }
    ctx.restore();

    // Critic scorecards banner
    const cardW = 280;
    const cardH = 68;
    const cardX = 20;
    const cardY = 96;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "var(--gold)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "var(--gold)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("PREMIERE CRITIC REVIEW PADDLES", cardX + 12, cardY + 18);

    const scores = [9, 8, 10, 9];
    const critics = ["NYT", "Var", "THR", "Ebert"];
    for (let i = 0; i < 4; i++) {
      const px = cardX + 14 + i * 64;
      const py = cardY + 28;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(px, py, 54, 30);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(px, py, 54, 30);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillText(critics[i], px + 4, py + 11);

      ctx.fillStyle = "#f5c518";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText(scores[i] + "/10", px + 8, py + 25);
    }
    // Flashing Paparazzi camera strobes
    ctx.save();
    for (let f = 0; f < 3; f++) {
      const flashT = (time * 0.007 + f * 1.7) % 2.5;
      if (flashT < 0.12) {
        const fx = _canvas.width * (0.28 + f * 0.18);
        const fy = _canvas.height * (0.64 + Math.sin(f * 3) * 0.08);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(fx, fy, 18 + f * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Animated Red Carpet & Audience Crew (ZERO EMOJIS — reference game pixel characters)
    const redCarpetCrew = [
      { role: "Paparazzi Press", x: _canvas.width * 0.22, y: _canvas.height * 0.74, av: "char_cameraman", tag: "[FLASH! FLASH!]" },
      { role: "Red Carpet Star", x: _canvas.width * 0.38, y: _canvas.height * 0.68, av: "char_star_actor", tag: "[PREMIERE STAR]" },
      { role: "Cheering Fan", x: _canvas.width * 0.50, y: _canvas.height * 0.72, av: "char_female_cheer", tag: "[AUTOGRAPH PLEASE!]" },
      { role: "Opening Buff", x: _canvas.width * 0.62, y: _canvas.height * 0.74, av: "char_male_cheer", tag: "[10/10 MASTERPIECE]" },
      { role: "Studio Mascot", x: _canvas.width * 0.74, y: _canvas.height * 0.70, av: "char_robot", tag: "[BOX OFFICE #1]" },
      { role: "VIP Cameo", x: _canvas.width * 0.85, y: _canvas.height * 0.72, av: "char_zombie", tag: "[METHOD ACTING]" }
    ];

    for (let i = 0; i < redCarpetCrew.length; i++) {
      const aud = redCarpetCrew[i];
      const bounce = Math.sin(time * 0.005 + i * 1.3) * 3;
      const cached = spriteCache[aud.av];
      ctx.save();
      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, aud.x - 22, aud.y - 44 + bounce, 44, 44);
      }
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = "#f5c518";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(aud.x - 48, aud.y + 4, 96, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(aud.role, aud.x, aud.y + 15);

      if (Math.sin(time * 0.003 + i * 2) > 0.4) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(aud.x - 65, aud.y - 64, 130, 18, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(aud.tag, aud.x, aud.y - 52);
      }
      ctx.restore();
    }

    drawKairosoftScoreboard(ctx, "CINEMA MARQUEE — RED CARPET PREMIERE");
  }

  // ── VIEW 6: Executive Office (HQ & War Chest) ──
  function renderExecutiveView(ctx, dt) {
    const asset = spriteCache["kairo_executive"];
    drawRoomBackdrop(ctx, asset);

    const time = performance.now();
    const G = typeof window !== "undefined" ? window.G : null;
    const stCash = (G && G.studio) ? "$" + (Math.round((G.studio.cash||0)*10)/10).toFixed(1) + "M" : "$0M";
    const stRep = (G && G.studio) ? Math.round(G.studio.rep||1) : 1;

    // Oscar Statuettes sparkling glints in display case (around x: 0.10, y: 0.50)
    ctx.save();
    for (let s = 0; s < 3; s++) {
      const glintTime = (time * 0.004 + s * 1.5) % 4;
      if (glintTime < 0.6) {
        const gx = _canvas.width * 0.10 + (s % 2) * 16;
        const gy = _canvas.height * 0.46 + Math.floor(s / 2) * 24;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(gx - 3, gy, 7, 1);
        ctx.fillRect(gx, gy - 3, 1, 7);
      }
    }
    ctx.restore();

    // Animated Executive Staff (Reference game pixel characters)
    const execs = [
      { role: "Studio Boss", x: _canvas.width * 0.60, y: _canvas.height * 0.58, av: "char_male_1", color: "#f5c518", quote: "Greenlight approved!" },
      { role: "CFO Treasurer", x: _canvas.width * 0.36, y: _canvas.height * 0.72, av: "char_female_2", color: "#10b981", quote: "War Chest: " + stCash },
      { role: "VP Marketing", x: _canvas.width * 0.50, y: _canvas.height * 0.74, av: "char_female_cheer", color: "#ec4899", quote: "Global campaign live!" },
      { role: "AI Strategist", x: _canvas.width * 0.76, y: _canvas.height * 0.70, av: "char_robot", color: "#38bdf8", quote: "ROI Model: +48%" }
    ];

    for (let i = 0; i < execs.length; i++) {
      const ex = execs[i];
      const bounce = Math.sin(time * 0.003 + i) * 2;
      const cached = spriteCache[ex.av];

      ctx.save();
      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, ex.x - 22, ex.y - 44 + bounce, 44, 44);
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = ex.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ex.x - 45, ex.y + 4, 90, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ex.role, ex.x, ex.y + 15);

      if (Math.sin(time * 0.002 + i) > 0.4) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(ex.x - 65, ex.y - 68, 130, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ex.quote, ex.x, ex.y - 55);
      }
      ctx.restore();
    }

    drawKairosoftScoreboard(ctx, "EXECUTIVE SUITE — STUDIO HQ & FINANCES");
  }

  function drawRoomBackdrop(ctx, asset) {
    if (asset && asset.loaded) {
      const img = asset.img;
      const scale = Math.max(_canvas.width / img.width, _canvas.height / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (_canvas.width - drawW) / 2;
      const drawY = (_canvas.height - drawH) / 2;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, _canvas.height);
      grad.addColorStop(0, "#111827");
      grad.addColorStop(1, "#1f2937");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }
  }

  // ── Kairosoft Live 4-Stat Scoreboard ──
  function drawKairosoftScoreboard(ctx, title) {
    if (_currentLotView === "campus") return;
    // In the short cinematic banner the room is cropped; a floating score
    // panel there just reads as clutter. Keep it for the full-height lot.
    if (_canvas.height < 420) return;
    
    const curScore = Math.round((_kairoStats.scenario + _kairoStats.direction + _kairoStats.acting + _kairoStats.soundVfx) / 4);

    if (!_showStatBoard) {
      // Draw compact minimized pill
      ctx.save();
      const pillW = 126;
      const pillH = 22;
      const pillX = _canvas.width - pillW - 14;
      const pillY = 54;
      ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
      ctx.strokeStyle = "rgba(245, 197, 24, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f5c518";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SCORE: " + curScore + "/100", pillX + pillW / 2, pillY + 15);
      ctx.restore();
      return;
    }

    ctx.save();
    const boxW = 224;
    const boxH = 124;
    const boxX = _canvas.width - boxW - 14;
    const boxY = 52; // Completely clear below the single top bar

    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = "rgba(245, 197, 24, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "var(--gold)";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.fillText(title, boxX + 10, boxY + 15);

    const stats = [
      { name: "Scenario", val: _kairoStats.scenario, color: "#38bdf8" },
      { name: "Direction", val: _kairoStats.direction, color: "#f5c518" },
      { name: "Acting", val: _kairoStats.acting, color: "#ec4899" },
      { name: "Sound / VFX", val: _kairoStats.soundVfx, color: "#a855f7" }
    ];

    for (let i = 0; i < stats.length; i++) {
      const s = stats[i];
      const sy = boxY + 28 + i * 19;

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillText(s.name, boxX + 10, sy);

      // Bar track
      const barX = boxX + 74;
      const barW = 90;
      const barH = 6;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(barX, sy - 6, barW, barH);

      // Bar fill
      ctx.fillStyle = s.color;
      ctx.fillRect(barX, sy - 6, barW * (s.val / 100), barH);

      // Val text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(s.val.toString(), boxX + boxW - 10, sy);
      ctx.textAlign = "left";
    }

    // Target quality badge
    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 8.5px system-ui, sans-serif";
    ctx.fillText("SCORE: " + curScore + "/100 — " + (curScore >= 75 ? "BLOCKBUSTER QUALITY" : "INDIE EXPERIMENTAL"), boxX + 10, boxY + boxH - 9);

    ctx.restore();
  }

  // Floating text particles (Kairosoft glowing pixel badges)
  function renderFloatingTexts(ctx, dt) {
    for (let i = _floatingTexts.length - 1; i >= 0; i--) {
      const ft = _floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt * 0.85;

      if (ft.life <= 0) {
        _floatingTexts.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life));
      ctx.font = "bold 10px monospace, system-ui, sans-serif";
      const tw = ctx.measureText(ft.text).width;
      const pad = 6;
      const bw = tw + pad * 2;
      const bh = 18;

      // Draw pixel badge
      ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
      ctx.strokeStyle = ft.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(ft.x - bw / 2, ft.y - bh / 2, bw, bh, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ft.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // Room view watermark
  function drawViewWatermark(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "bold 9px monospace";
    ctx.fillText(_currentLotView.toUpperCase() + " INTERIOR", 14, _canvas.height - 12);
    ctx.restore();
  }

  // Sandbox tile / building helpers
  function drawTileHighlight(ctx, sx, sy, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx, sy - TILE_H * camera.zoom / 2);
    ctx.lineTo(sx + TILE_W * camera.zoom / 2, sy);
    ctx.lineTo(sx, sy + TILE_H * camera.zoom / 2);
    ctx.lineTo(sx - TILE_W * camera.zoom / 2, sy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBuilding(ctx, b) {
    const centerGx = b.grid_x + (b.span_w - 1) * 0.5;
    const centerGy = b.grid_y + (b.span_h - 1) * 0.5;
    const scr = gridToScreen(centerGx, centerGy);

    const isSelected = _selectedBuildingId === b.id;
    const spriteKey = b.b_type || b.type_str;
    const cached = spriteCache[spriteKey];

    ctx.save();
    if (cached && cached.loaded) {
      const img = cached.img;
      const drawW = img.width * camera.zoom * 0.85;
      const drawH = img.height * camera.zoom * 0.85;
      const drawX = scr.x - drawW / 2;
      const drawY = scr.y - drawH + (TILE_H * camera.zoom * 0.5);

      if (isSelected) {
        ctx.shadowColor = "#f5c518";
        ctx.shadowBlur = 15;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    // Name badge
    const label = (b.name || "Stage") + (b.tier > 1 ? " #" + b.tier : "");
    ctx.font = "bold " + Math.max(9, Math.round(11 * camera.zoom)) + "px system-ui, sans-serif";
    const tw = ctx.measureText(label).width;
    const badgeW = tw + 12;
    const badgeH = 16 * camera.zoom;
    const badgeX = scr.x - badgeW / 2;
    const badgeY = scr.y + (TILE_H * camera.zoom * 0.5) + 4;

    ctx.fillStyle = isSelected ? "#f5c518" : "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
    ctx.fill();

    ctx.fillStyle = isSelected ? "#0f172a" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, scr.x, badgeY + badgeH / 2);
    ctx.textAlign = "left";
    ctx.restore();
  }

  // Event handlers
  function setupEvents() {
    if (!_canvas) return;

    _canvas.addEventListener("mousedown", e => {
      camera.isDragging = true;
      camera.dragStartX = e.clientX;
      camera.dragStartY = e.clientY;
    });

    window.addEventListener("mousemove", e => {
      if (!_canvas) return;
      const rect = _canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      _pointerScreen.x = mouseX;
      _pointerScreen.y = mouseY;

      if (camera.isDragging) {
        const dx = e.clientX - camera.dragStartX;
        const dy = e.clientY - camera.dragStartY;
        camera.x += dx;
        camera.y += dy;
        camera.dragStartX = e.clientX;
        camera.dragStartY = e.clientY;
      } else {
        _hoveredGridPos = screenToGrid(mouseX, mouseY);

        // Check if mouse hovers over any campus hotspot
        if (_currentLotView === "campus") {
          let foundHotspot = null;
          const campusAsset = spriteCache["kairo_campus"];
          if (campusAsset && campusAsset.loaded) {
            const img = campusAsset.img;
            const scale = Math.max(_canvas.width / img.width, _canvas.height / img.height) * camera.zoom;
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const drawX = (_canvas.width - drawW) / 2 + (camera.x - _canvas.width / 2);
            const drawY = (_canvas.height - drawH) / 2 + (camera.y - _canvas.height / 2);

            for (const spot of CAMPUS_HOTSPOTS) {
              const sx = drawX + drawW * spot.xPct;
              const sy = drawY + drawH * spot.yPct;
              const dist = Math.hypot(sx - mouseX, sy - mouseY);
              if (dist <= spot.radius * camera.zoom) {
                foundHotspot = spot.id;
                break;
              }
            }
          }
          _hoveredHotspot = foundHotspot;
          _canvas.style.cursor = foundHotspot ? "pointer" : "grab";
        }
      }
    });

    window.addEventListener("mouseup", () => {
      camera.isDragging = false;
    });

    _canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      camera.zoom = Math.max(0.6, Math.min(2.5, camera.zoom * zoomFactor));
    }, { passive: false });

    _canvas.addEventListener("click", e => {
      const rect = _canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // In Campus view: check click on hotspots to enter room interior
      if (_currentLotView === "campus") {
        const campusAsset = spriteCache["kairo_campus"];
        if (campusAsset && campusAsset.loaded) {
          const img = campusAsset.img;
          const scale = Math.max(_canvas.width / img.width, _canvas.height / img.height) * camera.zoom;
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (_canvas.width - drawW) / 2 + (camera.x - _canvas.width / 2);
          const drawY = (_canvas.height - drawH) / 2 + (camera.y - _canvas.height / 2);

          for (const spot of CAMPUS_HOTSPOTS) {
            const sx = drawX + drawW * spot.xPct;
            const sy = drawY + drawH * spot.yPct;
            const dist = Math.hypot(sx - mouseX, sy - mouseY);
            if (dist <= spot.radius * camera.zoom) {
              setLotView(spot.view);
              playViewSting(spot.view);
              return;
            }
          }
        }
      }
    });

    // Touch events for mobile landscape gaming
    let touchDist = 0;
    _canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        camera.isDragging = true;
        camera.dragStartX = e.touches[0].clientX;
        camera.dragStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    _canvas.addEventListener("touchmove", e => {
      if (e.touches.length === 1 && camera.isDragging) {
        const dx = e.touches[0].clientX - camera.dragStartX;
        const dy = e.touches[0].clientY - camera.dragStartY;
        camera.x += dx;
        camera.y += dy;
        camera.dragStartX = e.touches[0].clientX;
        camera.dragStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchDist > 0) {
          const ratio = newDist / touchDist;
          camera.zoom = Math.max(0.6, Math.min(2.5, camera.zoom * ratio));
        }
        touchDist = newDist;
      }
    }, { passive: true });

    _canvas.addEventListener("touchend", () => {
      camera.isDragging = false;
      touchDist = 0;
    });

    // Keyboard shortcuts (1-6 for views, +/- for zoom)
    window.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "1") { setLotView("campus"); playViewSting("campus"); }
      else if (e.key === "2") { setLotView("soundstage"); playViewSting("soundstage"); }
      else if (e.key === "3") { setLotView("writers"); playViewSting("writers"); }
      else if (e.key === "4") { setLotView("post"); playViewSting("post"); }
      else if (e.key === "5") { setLotView("cinema"); playViewSting("cinema"); }
      else if (e.key === "6") { setLotView("executive"); playViewSting("executive"); }
      else if (e.key === "+" || e.key === "=") { camera.zoom = Math.min(2.5, camera.zoom * 1.15); }
      else if (e.key === "-") { camera.zoom = Math.max(0.6, camera.zoom * 0.85); }
      else if (e.key === "0") {
        camera.x = _canvas.width / 2;
        camera.y = _canvas.height / 2;
        camera.zoom = 1.0;
      }
    });

    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        resizeCanvas();
        if (_canvas) {
          camera.x = _canvas.width / 2;
          camera.y = _canvas.height / 2;
        }
      }, 150);
    });
  }

  function playViewSting(view) {
    if (typeof beep !== "function") return;
    if (view === "soundstage") beep("clap");
    else if (view === "writers") beep("type");
    else if (view === "post") beep("good");
    else if (view === "cinema") beep("fanfare");
    else if (view === "executive") beep("cash");
    else beep("gold");
  }

  function resizeCanvas() {
    if (!_canvas) return;
    const parent = _canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = Math.round(rect.width) || window.innerWidth;
    let h = Math.round(rect.height);
    if (!h || h < 100) {
      h = window.innerHeight < 600 ? Math.max(220, window.innerHeight - 76) : 560;
    }
    _canvas.width = w;
    _canvas.height = h;
    if (_ctx) {
      _ctx.imageSmoothingEnabled = false;
    }
  }

  function updateLotHud() {
    const G = typeof window !== "undefined" ? window.G : null;
    if (!G) return;
    const elName = document.getElementById("lotHudStudioName");
    const elCash = document.getElementById("lotHudCash");
    const elDate = document.getElementById("lotHudDate");
    const elStages = document.getElementById("lotHudStages");

    if (elName && G.studio) elName.textContent = G.studio.name || "Box Office Studio";
    if (elCash && G.studio) {
      elCash.textContent = "$" + (Math.round((G.studio.cash||0)*10)/10).toFixed(1) + "M";
    }
    if (elDate) {
      const yr = (typeof window.yearOf === "function") ? window.yearOf(G.week) : 1;
      const woy = (typeof window.woyOf === "function") ? window.woyOf(G.week) : 1;
      elDate.textContent = "Y" + yr + " W" + woy;
    }
    if (elStages) {
      const activeShoots = (G.projects || []).filter(p => p.phase !== "ready").length;
      elStages.textContent = activeShoots + " Filming";
    }
  }

  function renderPalette() {
    const root = document.getElementById("lotPaletteRoot");
    if (!root) return;
    const types = [
      { id: "soundstage", name: "Stage 2", cost: 15 },
      { id: "virtual_led", name: "LED Volume", cost: 25 },
      { id: "post_suite", name: "Atmos Suite", cost: 8 },
      { id: "writers_bungalow", name: "Writer Pod", cost: 5 }
    ];

    let h = `<div class="palette-bar" style="display:flex;gap:6px;background:rgba(15,23,42,0.95);border:1px solid var(--gold);padding:8px;border-radius:8px">`;
    h += `<span style="font-size:11px;font-weight:700;color:var(--gold);margin-right:4px">EXPAND CAMPUS:</span>`;
    for (const t of types) {
      const active = _buildModeType === t.id ? "style='border-color:#10b981;background:#064e3b'" : "";
      h += `<button class="btn btn-sm btn-alt" data-btype="${t.id}" ${active}>+ ${t.name} ($${t.cost}M)</button>`;
    }
    h += `<button id="btnClosePalette" class="btn btn-sm btn-ghost">Done</button>`;
    h += `</div>`;
    root.innerHTML = h;

    root.querySelectorAll("button[data-btype]").forEach(btn => {
      btn.addEventListener("click", () => {
        _buildModeType = btn.dataset.btype;
        renderPalette();
        if (typeof beep === "function") beep("click");
      });
    });

    const btnClose = document.getElementById("btnClosePalette");
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        _buildModeType = null;
        root.style.display = "none";
      });
    }
  }

  function renderInspector() {
    const root = document.getElementById("lotInspectorRoot");
    if (!root) return;
    if (!_selectedBuildingId && !_directingState) {
      root.style.display = "none";
      return;
    }
    root.style.display = "block";
    if (_directingState) {
      root.innerHTML = `
        <div style="background:rgba(15,23,42,0.96);border:2px solid #ef4444;border-radius:8px;padding:12px;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.6)">
          <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">[ACTIVE PRODUCTION SHOOT]</div>
          <div style="font-size:14px;font-weight:bold;margin-bottom:8px">${_directingState.title}</div>
          <p style="font-size:11px;color:#94a3b8;margin-bottom:10px">${_directingState.feedback}</p>
          <button id="btnAdvanceShot" class="btn btn-primary" style="width:100%">CALL: ${_directingState.step === 1 ? "ROLL CAMERA" : _directingState.step === 2 ? "ACTION!" : "CUT & PRINT IT!"}</button>
        </div>
      `;
      const btn = document.getElementById("btnAdvanceShot");
      if (btn) btn.onclick = () => advanceDirectingStep();
      return;
    }

    root.innerHTML = `
      <div style="background:rgba(15,23,42,0.96);border:1px solid var(--gold);border-radius:8px;padding:12px;color:#fff">
        <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:6px">FACILITY SELECTED</div>
        <button id="btnDirectScene" class="btn btn-primary btn-sm" style="width:100%;margin-bottom:6px">Start Directing Take</button>
        <button id="btnCloseInspector" class="btn btn-ghost btn-sm" style="width:100%">Close</button>
      </div>
    `;
    const btnD = document.getElementById("btnDirectScene");
    if (btnD) btnD.onclick = () => startDirectingScene(_selectedBuildingId);
    const btnC = document.getElementById("btnCloseInspector");
    if (btnC) btnC.onclick = () => { _selectedBuildingId = null; renderInspector(); };
  }

  // Public Interface mounted to window
  const StudioLot2D = {
    mount(containerId, initialView, options) {
      const container = document.getElementById(containerId);
      if (!container) return;

      preloadAllAssets();

      if (container.querySelector("#studioLotCanvas")) {
        if (initialView) setLotView(initialView);
        resizeCanvas();
        updateLotHud();
        return;
      }

      container.innerHTML = `
        <div class="studiolot-viewport">
          
          <!-- Top Kairosoft Control Console (Clean Single Row) -->
          <div class="kairo-top-bar">
            <!-- Room Switcher Tabs Left -->
            <div class="kairo-room-nav">
              <button class="kairo-nav-tab active" data-view="campus"><img class="subtab-pixel-icon" src="assets/2d/studio_gate.png" alt="" /><span>Campus</span></button>
              <button class="kairo-nav-tab" data-view="soundstage"><img class="subtab-pixel-icon" src="assets/2d/soundstage.png" alt="" /><span>Stage</span></button>
              <button class="kairo-nav-tab" data-view="writers"><img class="subtab-pixel-icon" src="assets/2d/writers_bungalow.png" alt="" /><span>Writers</span></button>
              <button class="kairo-nav-tab" data-view="post"><img class="subtab-pixel-icon" src="assets/2d/post_suite.png" alt="" /><span>Post &amp; VFX</span></button>
              <button class="kairo-nav-tab" data-view="cinema"><img class="subtab-pixel-icon" src="assets/2d/cinema_theater.png" alt="" /><span>Cinema</span></button>
              <button class="kairo-nav-tab" data-view="executive"><img class="subtab-pixel-icon" src="assets/2d/executive.png" alt="" /><span>Executive</span></button>
            </div>

            <!-- Studio Telemetry + Stats Toggle + Fullscreen Right -->
            <div class="kairo-top-right">
              <div class="kairo-hud-stats">
                <div class="itch-hud-stat">
                  <span class="lbl">WAR CHEST</span>
                  <span id="lotHudCash" class="val" style="color:#10b981;font-weight:700">$100.0M</span>
                </div>
                <div class="itch-hud-stat">
                  <span class="lbl">CALENDAR</span>
                  <span id="lotHudDate" class="val" style="color:var(--gold);font-weight:700">Y1 W1</span>
                </div>
                <div class="itch-hud-stat">
                  <span class="lbl">ACTIVE</span>
                  <span id="lotHudStages" class="val" style="color:#38bdf8;font-weight:700">0 Filming</span>
                </div>
              </div>
              <button id="btnToggleStats" class="btn btn-alt btn-sm" title="Toggle Production Stats HUD">Stats HUD</button>
              <button id="btnLotFullscreen" class="btn btn-alt btn-sm" title="Toggle Fullscreen 2D Lot">Lot Full</button>
            </div>
          </div>

          <!-- Collapsible Facilities Build Palette Top Left -->
          <div id="lotPaletteRoot" style="position:absolute;top:50px;left:12px;z-index:30;display:none"></div>

          <!-- Bottom Kairosoft Command Deck -->
          <div class="kairo-bottom-deck">
            <!-- Left: Camera Controls & Build -->
            <div class="lot-controls">
              <button id="btnZoomIn" class="btn btn-alt btn-sm" title="Zoom In">+</button>
              <button id="btnZoomOut" class="btn btn-alt btn-sm" title="Zoom Out">-</button>
              <button id="btnResetView" class="btn btn-alt btn-sm">Center</button>
              <button id="btnFocusShoot" class="btn btn-primary btn-sm">Locate Set</button>
              <button id="btnTogglePalette" class="btn btn-alt btn-sm">Build Facility</button>
            </div>

            <!-- Right: Studio Management & Production Actions -->
            <div class="lot-action-dock">
              <button id="btnLotSlate" class="btn btn-alt btn-sm">Slate</button>
              <button id="btnLotTalent" class="btn btn-alt btn-sm" style="color:#6ee7b7;font-weight:bold" title="Open Box Office Sim 2 Talent Market & Animal Actors">BOS2 Talent</button>
              <button id="btnLotBoxOffice" class="btn btn-alt btn-sm">Box Office</button>
              <button id="btnLotFinance" class="btn btn-alt btn-sm">Finance</button>
              <button id="btnLotDevelop" class="itch-btn-gold" style="cursor:pointer;margin-left:2px">+ Greenlight</button>
              <button id="btnLotFastWeek" class="itch-btn-blue" style="cursor:pointer">Fast (+4W)</button>
              <button id="btnLotNextWeek" class="itch-btn-blue" style="cursor:pointer;font-weight:bold">Next Week (+1W)</button>
            </div>
          </div>

          <!-- Inspector Drawer Top Right -->
          <div id="lotInspectorRoot" style="position:absolute;top:50px;right:14px;z-index:30;max-width:320px;display:none"></div>

          <!-- The Full 2D Game Canvas -->
          <canvas id="studioLotCanvas" style="display:block;width:100%;height:100%;cursor:grab"></canvas>
        </div>
      `;

      _canvas = document.getElementById("studioLotCanvas");
      _ctx = _canvas ? _canvas.getContext("2d") : null;

      resizeCanvas();
      window.removeEventListener("resize", resizeCanvas);
      window.addEventListener("resize", resizeCanvas);

      if (initialView) {
        setLotView(initialView);
      } else {
        camera.x = _canvas ? _canvas.width / 2 : 0;
        camera.y = _canvas ? _canvas.height / 2 : 0;
        camera.zoom = 1.0;
      }

      setupEvents();
      renderPalette();

      // Hook control buttons
      const btnNext = document.getElementById("btnLotNextWeek");
      if (btnNext) {
        btnNext.onclick = () => {
          if (typeof window.advanceWeek === "function") window.advanceWeek();
          else if (typeof window.nextWeek === "function") window.nextWeek();
          updateLotHud();
        };
      }

      const btnFast = document.getElementById("btnLotFastWeek");
      if (btnFast) {
        btnFast.onclick = () => {
          if (typeof window.fastWeek === "function") window.fastWeek();
          updateLotHud();
        };
      }

      const btnDev = document.getElementById("btnLotDevelop");
      if (btnDev) {
        btnDev.onclick = () => {
          if (typeof window.developModal === "function") window.developModal();
        };
      }

      const btnTogglePal = document.getElementById("btnTogglePalette");
      if (btnTogglePal) {
        btnTogglePal.onclick = () => {
          const root = document.getElementById("lotPaletteRoot");
          if (root) {
            root.style.display = root.style.display === "none" ? "block" : "none";
            if (root.style.display === "block") renderPalette();
          }
        };
      }

      const btnZoomIn = document.getElementById("btnZoomIn");
      if (btnZoomIn) btnZoomIn.onclick = () => { camera.zoom = Math.min(2.5, camera.zoom * 1.2); };

      const btnZoomOut = document.getElementById("btnZoomOut");
      if (btnZoomOut) btnZoomOut.onclick = () => { camera.zoom = Math.max(0.6, camera.zoom * 0.8); };

      const btnReset = document.getElementById("btnResetView");
      if (btnReset) {
        btnReset.onclick = () => {
          camera.x = _canvas.width / 2;
          camera.y = _canvas.height / 2;
          camera.zoom = 1.0;
        };
      }

      const btnFocus = document.getElementById("btnFocusShoot");
      if (btnFocus) {
        btnFocus.onclick = () => {
          setLotView("soundstage");
          playViewSting("soundstage");
        };
      }

      const btnStats = document.getElementById("btnToggleStats");
      if (btnStats) {
        btnStats.onclick = () => {
          _showStatBoard = !_showStatBoard;
          btnStats.style.borderColor = _showStatBoard ? "var(--gold)" : "rgba(255,255,255,0.2)";
          btnStats.style.color = _showStatBoard ? "var(--gold)" : "#94a3b8";
        };
      }

      const btnFull = document.getElementById("btnLotFullscreen");
      if (btnFull) {
        btnFull.onclick = () => {
          const stage = document.getElementById("studiolotGlobalStage");
          if (stage) {
            stage.classList.toggle("lot-full");
            resizeCanvas();
          }
        };
      }

      const btnSlate = document.getElementById("btnLotSlate");
      if (btnSlate) btnSlate.onclick = () => { if (typeof window.switchTab === "function") window.switchTab("productions"); };

      const btnTalent = document.getElementById("btnLotTalent");
      if (btnTalent) {
        btnTalent.onclick = () => {
          if (typeof window.openBOS2TalentModal === "function") {
            window.openBOS2TalentModal();
          } else if (typeof window.talentModal === "function") {
            window.talentModal();
          }
        };
      }

      const btnBO = document.getElementById("btnLotBoxOffice");
      if (btnBO) btnBO.onclick = () => { if (typeof window.switchTab === "function") window.switchTab("boxoffice"); };

      const btnFin = document.getElementById("btnLotFinance");
      if (btnFin) btnFin.onclick = () => { if (typeof window.switchTab === "function") window.switchTab("finance"); };

      // Room nav tabs
      const roomTabs = container.querySelectorAll(".kairo-nav-tab");
      roomTabs.forEach(tab => {
        tab.addEventListener("click", () => {
          const view = tab.dataset.view;
          setLotView(view);
          playViewSting(view);
        });
      });

      // Start RAF loop
      if (!_animId) {
        _lastTime = performance.now();
        _animId = requestAnimationFrame(render);
      }
    },

    unmount() {
      if (_animId) {
        cancelAnimationFrame(_animId);
        _animId = null;
      }
      _canvas = null;
      _ctx = null;
    },

    setView(viewName) {
      setLotView(viewName);
    },

    getView() {
      return _currentLotView;
    },

    resize() {
      resizeCanvas();
    },

    focusBuilding(bId) {
      _selectedBuildingId = bId;
      setLotView("soundstage");
      playViewSting("soundstage");
      renderInspector();
    },

    focusActiveShoot() {
      setLotView("soundstage");
      playViewSting("soundstage");
    }
  };

  global.StudioLot2D = StudioLot2D;
})(typeof window !== "undefined" ? window : global);
