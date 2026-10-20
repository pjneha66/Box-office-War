/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-LOT-2D.JS — Authentic Kairosoft 2D Studio Simulation Engine
   Box Office War — High-Performance 2D Canvas & Pixel Art Studio World
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
  let _buildModeType = null;
  let _floatingTexts = [];
  let _directingState = null; // { stageId, step: 0, timer: 0 }

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
    // Kairosoft 16-Bit Studio Scenes
    kairo_campus: "assets/2d/kairo_studio_campus.png",
    kairo_soundstage: "assets/2d/kairo_soundstage.png",
    kairo_writers: "assets/2d/kairo_writers_room.png",
    kairo_post: "assets/2d/kairo_post_suite.png",
    kairo_cinema: "assets/2d/kairo_cinema_theater.png",
    kairo_executive: "assets/2d/kairo_executive_office.png",

    // Buildings (Isometric Sprites)
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

  // Coordinate projections for campus grid overlay
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
    const bld = lot.buildings.find(b => b.id === buildingId);
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
    } else if (_directingState.step === 2) {
      _directingState.step = 3;
      _directingState.feedback = "Actors performing! Call 'CUT & PRINT IT!'";
      if (bld) addFloatingText("ACTION!", bld.grid_x + 1.5, bld.grid_y + 1.5, "#ef4444");
      _kairoStats.acting = Math.min(100, _kairoStats.acting + 7);
    } else if (_directingState.step === 3) {
      // Reward
      if (G && G.studio) {
        G.studio.rep = Math.min(99, G.studio.rep + 0.5);
        if (typeof log === "function") log("Director's cut approved on " + _directingState.title + ": +0.5 Studio Rep & +5 Hype.", "gold");
      }
      if (bld) {
        addFloatingText("PRINT IT! +5 HYPE", bld.grid_x + 1.5, bld.grid_y + 1.5, "#10b981");
      }
      _kairoStats.direction = Math.min(100, _kairoStats.direction + 8);
      _kairoStats.soundVfx = Math.min(100, _kairoStats.soundVfx + 6);
      _directingState = null;
    }
    renderInspector();
  }

  // Room view switcher
  function setLotView(view) {
    _currentLotView = view;
    // Update active state in nav bar tabs
    const tabs = document.querySelectorAll(".kairo-nav-tab");
    tabs.forEach(tab => {
      if (tab.dataset.view === view) tab.classList.add("active");
      else tab.classList.remove("active");
    });
    // Center camera for the new view
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

    // Update Kairosoft production points & aura
    updateKairosoftProduction(dt);

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

  // ── VIEW 1: Campus Lot (Wide Hollywood Studio Campus) ──
  function renderCampusView(ctx, dt) {
    const campusAsset = spriteCache["kairo_campus"];

    if (campusAsset && campusAsset.loaded) {
      // Draw 16-Bit Pixel Art Campus as the lot background
      const img = campusAsset.img;
      const scale = Math.max(_canvas.width / img.width, _canvas.height / img.height) * camera.zoom;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (_canvas.width - drawW) / 2 + (camera.x - _canvas.width / 2);
      const drawY = (_canvas.height - drawH) / 2 + (camera.y - _canvas.height / 3);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      // Sleek studio tarmac gradient fallback
      const grad = ctx.createLinearGradient(0, 0, 0, _canvas.height);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e293b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    }

    // Draw interactive Hotspot overlays on the campus
    drawCampusHotspots(ctx);

    // Overlay user-placed buildings and roaming staff agents
    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    if (engine) {
      const stateStr = engine.get_lot_state_json();
      const lot = JSON.parse(stateStr);

      // Render buildings placed on the lot
      for (const b of (lot.buildings || [])) {
        drawBuilding(ctx, b);
      }

      // Render animated agents walking on lot
      for (const a of (lot.agents || [])) {
        drawAgent(ctx, a);
      }

      // Hover grid highlight
      if (_hoveredGridPos && _hoveredGridPos.x >= 0 && _hoveredGridPos.x < (lot.cols || 24) &&
          _hoveredGridPos.y >= 0 && _hoveredGridPos.y < (lot.rows || 24)) {
        const hScr = gridToScreen(_hoveredGridPos.x, _hoveredGridPos.y);
        drawTileHighlight(ctx, hScr.x, hScr.y, _buildModeType ? "rgba(245, 197, 24, 0.45)" : "rgba(255, 255, 255, 0.2)");
      }
    }

    // Campus Quick Stat Banner
    drawCampusHud(ctx);
  }

  // Interactive hotspots on the Campus Map
  const CAMPUS_HOTSPOTS = [
    { id: "soundstage", name: "Soundstage 1", sub: "Filming & Sets", xPct: 0.22, yPct: 0.38, radius: 65, view: "soundstage" },
    { id: "writers", name: "Writers Bungalow", sub: "Screenplay Lab", xPct: 0.68, yPct: 0.35, radius: 55, view: "writers" },
    { id: "post", name: "Post & VFX Suite", sub: "Editing & Audio", xPct: 0.38, yPct: 0.58, radius: 60, view: "post" },
    { id: "cinema", name: "Cinema Marquee", sub: "Box Office Premiere", xPct: 0.82, yPct: 0.72, radius: 65, view: "cinema" },
    { id: "executive", name: "Executive Suite", sub: "HQ & Greenlight Desk", xPct: 0.50, yPct: 0.22, radius: 60, view: "executive" }
  ];

  function drawCampusHotspots(ctx) {
    const time = performance.now() * 0.003;
    for (const spot of CAMPUS_HOTSPOTS) {
      const sx = _canvas.width * spot.xPct + (camera.x - _canvas.width / 2) * 0.3;
      const sy = _canvas.height * spot.yPct + (camera.y - _canvas.height / 3) * 0.3;
      const isHovered = _hoveredHotspot === spot.id;

      ctx.save();
      // Glowing base circle
      const pulse = Math.sin(time + spot.xPct * 10) * 4;
      const r = (spot.radius + (isHovered ? 8 : 0) + pulse) * camera.zoom * 0.8;

      ctx.strokeStyle = isHovered ? "#f5c518" : "rgba(245, 197, 24, 0.6)";
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label badge
      const bw = 120;
      const bh = 34;
      const bx = sx - bw / 2;
      const by = sy - r - bh - 6;

      ctx.fillStyle = isHovered ? "rgba(15, 23, 42, 0.95)" : "rgba(15, 23, 42, 0.80)";
      ctx.strokeStyle = isHovered ? "#f5c518" : "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHovered ? "#f5c518" : "#ffffff";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(spot.name, sx, by + 14);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px system-ui, sans-serif";
      ctx.fillText(spot.sub + " [CLICK]", sx, by + 26);

      ctx.restore();
    }
  }

  function drawCampusHud(ctx) {
    ctx.save();
    const hudW = 240;
    const hudH = 54;
    const hudX = _canvas.width - hudW - 16;
    const hudY = 106;

    ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
    ctx.strokeStyle = "rgba(245, 197, 24, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText("HOLLYWOOD LOT CAMPUS", hudX + 12, hudY + 16);

    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("Click any building to enter interior", hudX + 12, hudY + 32);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("Or use room tabs above", hudX + 12, hudY + 46);

    ctx.restore();
  }

  // ── VIEW 2: Soundstage Interior (Active Film Production) ──
  function renderSoundstageView(ctx, dt) {
    const asset = spriteCache["kairo_soundstage"];
    drawRoomBackdrop(ctx, asset);

    // Live On-Air Blinking Red Indicator
    const time = performance.now();
    const blink = (Math.sin(time * 0.008) > 0);
    ctx.save();
    ctx.fillStyle = blink ? "#ef4444" : "#7f1d1d";
    ctx.beginPath();
    ctx.arc(36, 120, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText(blink ? "ON AIR / FILMING" : "STAGE RECORDING", 52, 124);
    ctx.restore();

    // Crew Animations & Auras
    drawSoundstageCrew(ctx, dt);

    // Kairosoft 4-Stat Live Scoreboard
    drawKairosoftScoreboard(ctx, "SOUNDSTAGE 1 — PRODUCTION SCORE");
  }

  function drawSoundstageCrew(ctx, dt) {
    const time = performance.now() * 0.003;
    const crew = [
      { role: "Director", x: _canvas.width * 0.28, y: _canvas.height * 0.65, color: "#f5c518", quote: "Action!" },
      { role: "Camera Operator", x: _canvas.width * 0.42, y: _canvas.height * 0.70, color: "#38bdf8", quote: "Rolling track..." },
      { role: "Lead Star", x: _canvas.width * 0.58, y: _canvas.height * 0.60, color: "#ec4899", quote: "Delivering monologue!" },
      { role: "Boom Operator", x: _canvas.width * 0.70, y: _canvas.height * 0.55, color: "#10b981", quote: "Audio levels clean" }
    ];

    for (let i = 0; i < crew.length; i++) {
      const c = crew[i];
      const bounce = Math.sin(time * 2 + i) * 3;
      const avKey = "avatar_" + ((i % 5) + 1).toString().padStart(2, "0");
      const cached = spriteCache[avKey];

      ctx.save();
      // Aura if In The Zone
      if (_kairoStats.inTheZoneAgent === i) {
        ctx.save();
        ctx.strokeStyle = "rgba(245, 197, 24, 0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y - 20, 28 + Math.sin(time * 6) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Sprite
      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, c.x - 22, c.y - 44 + bounce, 44, 44);
      } else {
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(c.x, c.y - 20 + bounce, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Role tag
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(c.x - 35, c.y + 4, 70, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(c.role, c.x, c.y + 15);

      // Speech bubble (cycle periodically)
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

    // Writers room anim
    const time = performance.now() * 0.003;
    const writers = [
      { name: "Head Screenwriter", x: _canvas.width * 0.35, y: _canvas.height * 0.62, quote: "Act III Plot Twist ready!" },
      { name: "Dialogue Polish", x: _canvas.width * 0.62, y: _canvas.height * 0.65, quote: "Punching up one-liners..." }
    ];

    for (let i = 0; i < writers.length; i++) {
      const w = writers[i];
      const bounce = Math.sin(time * 3 + i) * 2;
      const avKey = "avatar_" + ((i + 6)).toString().padStart(2, "0");
      const cached = spriteCache[avKey];

      ctx.save();
      if (cached && cached.loaded) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cached.img, w.x - 22, w.y - 44 + bounce, 44, 44);
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
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

      // Dialogue
      if (Math.sin(time * 1.5 + i) > 0.4) {
        ctx.fillStyle = "#fff";
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

    // Dynamic VU meter audio visualizer
    const time = performance.now() * 0.006;
    ctx.save();
    const meterX = _canvas.width * 0.45;
    const meterY = _canvas.height * 0.40;
    const barCount = 12;
    for (let i = 0; i < barCount; i++) {
      const h = Math.abs(Math.sin(time + i * 0.5)) * 35;
      const grad = ctx.createLinearGradient(0, meterY, 0, meterY - 35);
      grad.addColorStop(0, "#10b981");
      grad.addColorStop(0.7, "#f5c518");
      grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX + i * 8, meterY - h, 6, h);
    }
    ctx.restore();

    drawKairosoftScoreboard(ctx, "POST-PRODUCTION — SOUND & VFX MIX");
  }

  // ── VIEW 5: Cinema Theater (Box Office Premiere) ──
  function renderCinemaView(ctx, dt) {
    const asset = spriteCache["kairo_cinema"];
    drawRoomBackdrop(ctx, asset);

    // Screen dynamic flicker lighting
    const time = performance.now() * 0.004;
    const flicker = 0.15 + Math.sin(time * 8) * 0.05;
    ctx.save();
    ctx.fillStyle = `rgba(255, 240, 200, ${flicker})`;
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Critic scorecards banner
    const G = typeof window !== "undefined" ? window.G : null;
    const cardW = 280;
    const cardH = 68;
    const cardX = 20;
    const cardY = 106;

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.strokeStyle = "var(--gold)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "var(--gold)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("PREMIERE CRITIC REVIEW PADDLES", cardX + 12, cardY + 18);

    const scores = [9, 8, 10, 9];
    const critics = ["NYT", "Var", "THR", "Ebert"];
    for (let i = 0; i < 4; i++) {
      const px = cardX + 16 + i * 64;
      const py = cardY + 28;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(px, py, 54, 30);
      ctx.strokeStyle = "#38bdf8";
      ctx.strokeRect(px, py, 54, 30);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillText(critics[i], px + 4, py + 11);

      ctx.fillStyle = "#f5c518";
      ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(scores[i] + "/10", px + 8, py + 26);
    }
    ctx.restore();

    drawKairosoftScoreboard(ctx, "CINEMA MARQUEE — BOX OFFICE AUDIENCE");
  }

  // ── VIEW 6: Executive Office (HQ & War Chest) ──
  function renderExecutiveView(ctx, dt) {
    const asset = spriteCache["kairo_executive"];
    drawRoomBackdrop(ctx, asset);

    const G = typeof window !== "undefined" ? window.G : null;
    drawKairosoftScoreboard(ctx, "EXECUTIVE SUITE — STUDIO OVERVIEW");
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
    ctx.save();
    const boxW = 250;
    const boxH = 142;
    const boxX = _canvas.width - boxW - 16;
    const boxY = 106;

    // Outer frame with wood / gold trim
    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "rgba(245, 197, 24, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = "var(--gold)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText(title, boxX + 12, boxY + 16);

    const stats = [
      { label: "Scenario", val: Math.round(_kairoStats.scenario), color: "#38bdf8", max: 100 },
      { label: "Direction", val: Math.round(_kairoStats.direction), color: "#f5c518", max: 100 },
      { label: "Acting", val: Math.round(_kairoStats.acting), color: "#ec4899", max: 100 },
      { label: "Sound / VFX", val: Math.round(_kairoStats.soundVfx), color: "#a855f7", max: 100 }
    ];

    let startY = boxY + 26;
    for (const st of stats) {
      startY += 20;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.fillText(st.label, boxX + 12, startY + 8);

      // Meter bar background
      const barX = boxX + 85;
      const barW = 120;
      const barH = 9;
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(barX, startY, barW, barH);

      // Meter fill
      const fillW = Math.min(barW, (st.val / st.max) * barW);
      ctx.fillStyle = st.color;
      ctx.fillRect(barX, startY, fillW, barH);

      // Number text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(st.val), boxX + boxW - 12, startY + 8);
      ctx.textAlign = "left";
    }

    // Overall Quality Tier
    const avg = Math.round((_kairoStats.scenario + _kairoStats.direction + _kairoStats.acting + _kairoStats.soundVfx) / 4);
    const grade = avg >= 90 ? "S-TIER MASTERPIECE" : avg >= 75 ? "A-TIER HIT" : avg >= 60 ? "B-TIER SOLID" : "INDIE EXPERIMENTAL";

    ctx.fillStyle = "rgba(245, 197, 24, 0.15)";
    ctx.fillRect(boxX + 10, boxY + boxH - 24, boxW - 20, 18);
    ctx.fillStyle = "var(--gold)";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText("SCORE: " + avg + "/100 — " + grade, boxX + 14, boxY + boxH - 11);

    ctx.restore();
  }

  // Live simulation point generation
  function updateKairosoftProduction(dt) {
    _kairoStats.pointSpawnTimer += dt;
    _kairoStats.zoneTimer -= dt;

    if (_kairoStats.zoneTimer <= 0) {
      // Chance of triggering In The Zone aura
      if (Math.random() < 0.25) {
        _kairoStats.inTheZoneAgent = Math.floor(Math.random() * 4);
        _kairoStats.zoneTimer = 8.0;
        addFloatingText("IN THE ZONE! 2X POINTS", _canvas.width * 0.5, _canvas.height * 0.5, "#f5c518");
      } else {
        _kairoStats.inTheZoneAgent = null;
        _kairoStats.zoneTimer = 5.0;
      }
    }

    if (_kairoStats.pointSpawnTimer >= 2.5) {
      _kairoStats.pointSpawnTimer = 0;
      const boost = (_kairoStats.inTheZoneAgent !== null) ? 2 : 1;

      if (_currentLotView === "soundstage") {
        _kairoStats.direction = Math.min(99, _kairoStats.direction + 1 * boost);
        _kairoStats.acting = Math.min(99, _kairoStats.acting + 1 * boost);
        addFloatingText("+DIRECTION (+" + (3 * boost) + ")", _canvas.width * 0.35, _canvas.height * 0.6, "#f5c518");
        addFloatingText("+ACTING (+" + (4 * boost) + ")", _canvas.width * 0.55, _canvas.height * 0.6, "#ec4899");
      } else if (_currentLotView === "writers") {
        _kairoStats.scenario = Math.min(99, _kairoStats.scenario + 2 * boost);
        addFloatingText("+SCENARIO (+" + (5 * boost) + ")", _canvas.width * 0.45, _canvas.height * 0.58, "#38bdf8");
      } else if (_currentLotView === "post") {
        _kairoStats.soundVfx = Math.min(99, _kairoStats.soundVfx + 2 * boost);
        addFloatingText("+SOUND & VFX (+" + (4 * boost) + ")", _canvas.width * 0.50, _canvas.height * 0.55, "#a855f7");
      }
    }
  }

  // Floating text particles
  function renderFloatingTexts(ctx, dt) {
    for (let i = _floatingTexts.length - 1; i >= 0; i--) {
      const ft = _floatingTexts[i];
      ft.life -= dt * 0.8;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) {
        _floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life);
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  function drawViewWatermark(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "bold 10px system-ui, sans-serif";
    const label = _currentLotView.toUpperCase() + " INTERIOR";
    ctx.fillText(label, 16, _canvas.height - 16);
    ctx.restore();
  }

  function drawTileHighlight(ctx, sx, sy, fillStyle) {
    const w = TILE_W * camera.zoom;
    const h = TILE_H * camera.zoom;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx, sy - h / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.lineTo(sx, sy + h / 2);
    ctx.lineTo(sx - w / 2, sy);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = "#f5c518";
    ctx.lineWidth = 2;
    ctx.stroke();
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
    } else {
      const w = TILE_W * camera.zoom * b.span_w * 0.6;
      const h = TILE_H * camera.zoom * b.span_h * 0.8;
      const bHeight = 45 * camera.zoom;

      ctx.fillStyle = b.filming_active ? "#1e293b" : "#334155";
      ctx.strokeStyle = isSelected ? "#f5c518" : "#475569";
      ctx.lineWidth = isSelected ? 3 : 1;

      ctx.beginPath();
      ctx.moveTo(scr.x, scr.y - h / 2 - bHeight);
      ctx.lineTo(scr.x + w / 2, scr.y - bHeight);
      ctx.lineTo(scr.x, scr.y + h / 2 - bHeight);
      ctx.lineTo(scr.x - w / 2, scr.y - bHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (b.filming_active) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      const coneGrad = ctx.createRadialGradient(scr.x, scr.y - 40 * camera.zoom, 5, scr.x, scr.y, 60 * camera.zoom);
      coneGrad.addColorStop(0, "rgba(255, 230, 100, 0.8)");
      coneGrad.addColorStop(1, "rgba(255, 230, 100, 0)");
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y, 50 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Name badge
    const label = (b.name || "Soundstage") + (b.tier > 1 ? " #" + b.tier : "");
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

  function getAgentAvatarKey(a) {
    const rawId = typeof a.id === "number" ? a.id : (a.id ? a.id.toString().charCodeAt(0) : 1);
    const num = (Math.abs(rawId) % 25) + 1;
    return "avatar_" + num.toString().padStart(2, "0");
  }

  function getAgentRoleInfo(a) {
    if (a.kind_str === "director") return { role: "Director", color: "#f5c518", ring: "#f5c518", badge: "DIR" };
    if (a.kind_str === "star_actor") return { role: "A-List Talent", color: "#38bdf8", ring: "#38bdf8", badge: "STAR" };
    if (a.kind_str === "cameraman") return { role: "Cinematographer", color: "#10b981", ring: "#10b981", badge: "CREW" };
    if (a.kind_str === "audience") return { role: "Moviegoer", color: "#f43f5e", ring: "#f43f5e", badge: "FAN" };
    if (a.kind_str === "extra") return { role: "Supporting Cast", color: "#a855f7", ring: "#a855f7", badge: "CAST" };
    return { role: "Studio Crew", color: "#94a3b8", ring: "#94a3b8", badge: "CREW" };
  }

  function drawAgent(ctx, a) {
    const scr = gridToScreen(a.x, a.y);
    const avKey = getAgentAvatarKey(a);
    const cached = spriteCache[avKey] || spriteCache["male_idle"] || spriteCache["director"];
    const roleInfo = getAgentRoleInfo(a);

    ctx.save();
    // Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(scr.x, scr.y, 10 * camera.zoom, 5 * camera.zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Role Base Ring
    ctx.strokeStyle = roleInfo.ring;
    ctx.lineWidth = 2 * camera.zoom;
    ctx.beginPath();
    ctx.ellipse(scr.x, scr.y, 8 * camera.zoom, 4 * camera.zoom, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Sprite
    const charH = 38 * camera.zoom;
    const charW = 38 * camera.zoom;
    const bounce = a.state_str === "walking"
      ? Math.abs(Math.sin((a.anim_timer || 0) * 12)) * 3 * camera.zoom
      : Math.sin(performance.now() * 0.004 + (a.id || 0)) * 1 * camera.zoom;

    if (cached && cached.loaded) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cached.img, scr.x - charW / 2, scr.y - charH - bounce, charW, charH);
    } else {
      ctx.fillStyle = roleInfo.color;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y - 14 * camera.zoom - bounce, 8 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nameplate
    if (camera.zoom >= 0.85 || _selectedAgentId === a.id) {
      const label = a.name || roleInfo.role;
      ctx.font = "bold " + Math.max(9, Math.round(10 * camera.zoom)) + "px system-ui, sans-serif";
      const tw = ctx.measureText(label).width;
      const th = 14 * camera.zoom;
      const tx = scr.x - tw / 2 - 4;
      const ty = scr.y - charH - bounce - 14 * camera.zoom;

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = roleInfo.ring;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw + 8, th, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, scr.x, ty + th / 2);
      ctx.textAlign = "left";
    }

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
          for (const spot of CAMPUS_HOTSPOTS) {
            const sx = _canvas.width * spot.xPct + (camera.x - _canvas.width / 2) * 0.3;
            const sy = _canvas.height * spot.yPct + (camera.y - _canvas.height / 3) * 0.3;
            const dist = Math.hypot(sx - mouseX, sy - mouseY);
            if (dist <= spot.radius * camera.zoom) {
              foundHotspot = spot.id;
              break;
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
      camera.zoom = Math.max(0.5, Math.min(2.5, camera.zoom * zoomFactor));
    }, { passive: false });

    _canvas.addEventListener("click", e => {
      const rect = _canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // In Campus view: check click on hotspots to enter room interior
      if (_currentLotView === "campus") {
        for (const spot of CAMPUS_HOTSPOTS) {
          const sx = _canvas.width * spot.xPct + (camera.x - _canvas.width / 2) * 0.3;
          const sy = _canvas.height * spot.yPct + (camera.y - _canvas.height / 3) * 0.3;
          const dist = Math.hypot(sx - mouseX, sy - mouseY);
          if (dist <= spot.radius * camera.zoom) {
            setLotView(spot.view);
            if (typeof beep === "function") beep("click");
            return;
          }
        }
      }

      const gPos = screenToGrid(mouseX, mouseY);
      const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
      if (!engine) return;

      if (_buildModeType) {
        try {
          const res = engine.place_building(_buildModeType, gPos.x, gPos.y);
          if (res) {
            addFloatingText("CONSTRUCTED", gPos.x + 1, gPos.y + 1, "#10b981");
            _buildModeType = null;
            renderPalette();
          }
        } catch (err) {
          console.warn("Placement error:", err);
        }
        return;
      }

      const stateStr = engine.get_lot_state_json();
      const lot = JSON.parse(stateStr);

      // Check agent click
      let clickedAgent = null;
      for (const a of (lot.agents || [])) {
        const scr = gridToScreen(a.x, a.y);
        const dist = Math.hypot(scr.x - mouseX, (scr.y - 18 * camera.zoom) - mouseY);
        if (dist <= 24 * camera.zoom) {
          clickedAgent = a;
          break;
        }
      }

      if (clickedAgent) {
        _selectedAgentId = clickedAgent.id;
        _selectedBuildingId = null;
        renderAgentInspector(clickedAgent);
        return;
      }

      // Check building click
      let clickedBld = null;
      for (const b of (lot.buildings || [])) {
        if (gPos.x >= b.grid_x && gPos.x < b.grid_x + b.span_w &&
            gPos.y >= b.grid_y && gPos.y < b.grid_y + b.span_h) {
          clickedBld = b;
          break;
        }
      }

      _selectedBuildingId = clickedBld ? clickedBld.id : null;
      _selectedAgentId = null;
      renderInspector();
    });

    // Touch events for mobile
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
    });

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
          const factor = newDist / touchDist;
          camera.zoom = Math.max(0.5, Math.min(2.5, camera.zoom * factor));
        }
        touchDist = newDist;
      }
    });

    _canvas.addEventListener("touchend", () => {
      camera.isDragging = false;
      touchDist = 0;
    });
  }

  function resizeCanvas() {
    if (!_canvas) return;
    const parent = _canvas.parentElement;
    if (parent) {
      _canvas.width = parent.clientWidth || window.innerWidth;
      _canvas.height = Math.max(500, window.innerHeight - 150);
    }
  }

  // Agent Inspector Dossier
  function renderAgentInspector(agent) {
    const root = document.getElementById("lotInspectorRoot");
    if (!root) return;
    if (!agent) {
      root.innerHTML = "";
      root.style.display = "none";
      return;
    }

    root.style.display = "block";
    const avKey = getAgentAvatarKey(agent);
    const roleInfo = getAgentRoleInfo(agent);
    const imgSrc = ASSET_PATHS[avKey] || "assets/itch-avatars/Avatars_01.png";

    root.innerHTML = `
      <div class="lot-card itch-wood-panel">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="tag gold" style="font-size:10px">${roleInfo.badge} DOSSIER</span>
          <button id="btnCloseInspector" class="btn btn-ghost btn-sm" style="padding:2px 8px">✕</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;margin:10px 0">
          <div class="itch-avatar-frame">
            <img src="${imgSrc}" alt="${agent.name || roleInfo.role}" style="width:64px;height:64px;image-rendering:pixelated;object-fit:cover;border-radius:6px;display:block">
          </div>
          <div>
            <b style="font-size:14px;color:#fff">${agent.name || roleInfo.role}</b>
            <div style="font-size:12px;color:${roleInfo.color};font-weight:600">${roleInfo.role}</div>
            <div class="tiny muted" style="margin-top:2px">Status: ${agent.state_str || "Active on Lot"}</div>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.3);padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.08)">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
            <span class="muted">Morale / Energy</span>
            <span style="color:#10b981;font-weight:bold">95%</span>
          </div>
          <div class="itch-bar-container" style="width:100%;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden">
            <div style="width:95%;height:100%;background:#10b981"></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px">
          ${agent.kind_str === "director" ? `
            <button id="btnAgentDirect" class="btn btn-primary btn-sm">Assign to Next Production</button>
            <button id="btnAgentPitch" class="btn btn-alt btn-sm">Hear Director Pitch</button>
          ` : agent.kind_str === "star_actor" ? `
            <button id="btnAgentCast" class="btn btn-primary btn-sm">Attach Star to Slate</button>
            <button id="btnAgentPress" class="btn btn-alt btn-sm">Launch Press Interview (+Buzz)</button>
          ` : `
            <button id="btnAgentSnack" class="btn btn-primary btn-sm">Send to Craft Services (+Energy)</button>
            <button id="btnAgentGuide" class="btn btn-alt btn-sm">Assign Lot Duty</button>
          `}
          <button id="btnAgentFocus" class="btn btn-ghost btn-sm">Follow Character</button>
        </div>
      </div>
    `;

    document.getElementById("btnCloseInspector").onclick = () => {
      _selectedAgentId = null;
      renderAgentInspector(null);
    };

    const btnAgentFocus = document.getElementById("btnAgentFocus");
    if (btnAgentFocus) {
      btnAgentFocus.onclick = () => {
        const scr = gridToScreen(agent.x, agent.y);
        camera.x += (_canvas.width / 2 - scr.x);
        camera.y += (_canvas.height / 2 - scr.y);
        addFloatingText("FOLLOWING", agent.x, agent.y, "#f5c518");
      };
    }

    const btnSnack = document.getElementById("btnAgentSnack");
    if (btnSnack) {
      btnSnack.onclick = () => {
        addFloatingText("+MORALE BOOST", agent.x, agent.y, "#10b981");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnDirect = document.getElementById("btnAgentDirect");
    if (btnDirect && typeof window.switchTab === "function") {
      btnDirect.onclick = () => {
        if (typeof window.developModal === "function") window.developModal();
        else window.switchTab("develop");
      };
    }

    const btnCast = document.getElementById("btnAgentCast");
    if (btnCast && typeof window.switchTab === "function") {
      btnCast.onclick = () => {
        if (typeof window.talentModal === "function") window.talentModal();
        else window.switchTab("develop");
      };
    }

    const btnPress = document.getElementById("btnAgentPress");
    if (btnPress) {
      btnPress.onclick = () => {
        addFloatingText("+12 HYPEX", agent.x, agent.y, "#38bdf8");
        if (typeof beep === "function") beep("cash");
      };
    }

    const btnPitch = document.getElementById("btnAgentPitch");
    if (btnPitch && typeof window.buyScriptModal === "function") {
      btnPitch.onclick = () => window.buyScriptModal();
    }
  }

  // Building Inspector
  function renderInspector() {
    const root = document.getElementById("lotInspectorRoot");
    if (!root) return;
    if (!_selectedBuildingId) {
      root.innerHTML = "";
      root.style.display = "none";
      return;
    }

    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    if (!engine) return;
    const stateStr = engine.get_lot_state_json();
    const lot = JSON.parse(stateStr);
    const bld = (lot.buildings || []).find(b => b.id === _selectedBuildingId);
    if (!bld) {
      root.innerHTML = "";
      root.style.display = "none";
      return;
    }

    root.style.display = "block";
    const btype = bld.b_type || bld.type_str;

    let actionsHtml = "";
    if (btype === "soundstage" || btype === "virtual_led") {
      if (bld.filming_active) {
        if (_directingState && _directingState.stageId === bld.id) {
          const btnLabel = _directingState.step === 1 ? "Call 'Roll Camera!'" :
                           _directingState.step === 2 ? "Call 'Action!'" : "Call 'Cut & Print It!'";
          actionsHtml = `
            <div class="directing-box" style="margin-top:10px;padding:10px;background:rgba(245,197,24,0.12);border:1px solid var(--gold);border-radius:6px">
              <div style="font-weight:bold;color:var(--gold);font-size:12px">ACTIVE SHOOT DIRECTING</div>
              <p style="font-size:12px;margin:6px 0">${_directingState.feedback}</p>
              <button id="btnAdvanceDirecting" class="btn btn-primary btn-sm" style="width:100%">${btnLabel}</button>
            </div>
          `;
        } else {
          actionsHtml = `
            <button id="btnStartDirecting" class="btn btn-primary btn-sm" style="width:100%">Direct Scene (Minigame)</button>
            <button id="btnRushShoot" class="btn btn-alt btn-sm" style="width:100%">Rush Shoot (+Speed, -$2M)</button>
          `;
        }
      } else {
        actionsHtml = `
          <button id="btnGreenlightStage" class="btn btn-primary btn-sm" style="width:100%">Greenlight Film on this Stage</button>
          <button id="btnRentStage" class="btn btn-alt btn-sm" style="width:100%">Sublease to Commercial (+$1.5M)</button>
        `;
      }
    } else if (btype === "writers_bungalow") {
      actionsHtml = `
        <button id="btnCommissionScript" class="btn btn-primary btn-sm" style="width:100%">Commission Custom Screenplay</button>
      `;
    } else if (btype === "cinema_theater") {
      actionsHtml = `
        <button id="btnHostPremiere" class="btn btn-primary btn-sm" style="width:100%">Host Red Carpet Premiere</button>
      `;
    } else if (btype === "post_suite") {
      actionsHtml = `
        <button id="btnMasterAudio" class="btn btn-primary btn-sm" style="width:100%">Master Atmos Audio Track</button>
      `;
    } else if (btype === "backlot") {
      actionsHtml = `
        <button id="btnBacklotRent" class="btn btn-primary btn-sm" style="width:100%">Rent Set to TV Series (+$2.0M)</button>
      `;
    }

    root.innerHTML = `
      <div class="lot-card itch-wood-panel">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="tag gold" style="font-size:10px">FACILITY DOSSIER</span>
          <button id="btnCloseInspector" class="btn btn-ghost btn-sm" style="padding:2px 8px">✕</button>
        </div>
        <div style="margin:8px 0">
          <b style="font-size:15px;color:#fff">${bld.name}</b>
          <div style="font-size:12px;color:var(--gold);font-weight:600">Tier ${bld.tier} Upgrade Level</div>
          <div class="tiny muted">Footprint: ${bld.span_w}x${bld.span_h} • Grid: (${bld.grid_x}, ${bld.grid_y})</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;margin:10px 0">
          ${actionsHtml}
        </div>

        <div style="display:flex;gap:6px;margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px">
          <button id="btnUpgradeLotBuilding" class="btn btn-alt btn-sm" style="flex:1">Upgrade Tier ($15M)</button>
          <button id="btnDemolishLotBuilding" class="btn btn-ghost btn-sm" style="color:var(--red)">Demolish</button>
        </div>
      </div>
    `;

    document.getElementById("btnCloseInspector").onclick = () => {
      _selectedBuildingId = null;
      renderInspector();
    };

    const btnStartDir = document.getElementById("btnStartDirecting");
    if (btnStartDir) {
      btnStartDir.onclick = () => startDirectingScene(bld.id);
    }

    const btnAdvDir = document.getElementById("btnAdvanceDirecting");
    if (btnAdvDir) {
      btnAdvDir.onclick = () => advanceDirectingStep();
    }

    const btnUpgrade = document.getElementById("btnUpgradeLotBuilding");
    if (btnUpgrade) {
      btnUpgrade.onclick = () => {
        const newTier = engine.upgrade_building(bld.id);
        if (newTier) {
          addFloatingText("UPGRADED TO TIER " + newTier, bld.grid_x + 1, bld.grid_y + 1, "#f5c518");
          renderInspector();
        }
      };
    }

    const btnDemolish = document.getElementById("btnDemolishLotBuilding");
    if (btnDemolish) {
      btnDemolish.onclick = () => {
        if (confirm("Demolish " + bld.name + "?")) {
          engine.demolish_building(bld.id);
          _selectedBuildingId = null;
          renderInspector();
        }
      };
    }

    const btnGreenStage = document.getElementById("btnGreenlightStage");
    if (btnGreenStage && typeof window.developModal === "function") {
      btnGreenStage.onclick = () => window.developModal();
    }

    const btnRentStage = document.getElementById("btnRentStage");
    if (btnRentStage) {
      btnRentStage.onclick = () => {
        addFloatingText("+$1.5M COMMERCIAL RENT", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        const G = typeof window !== "undefined" ? window.G : null;
        if (G && G.studio) G.studio.cash = (G.studio.cash || 0) + 1.5;
        if (typeof beep === "function") beep("cash");
      };
    }

    const btnCommission = document.getElementById("btnCommissionScript");
    if (btnCommission && typeof window.buyScriptModal === "function") {
      btnCommission.onclick = () => window.buyScriptModal();
    }

    const btnPremiere = document.getElementById("btnHostPremiere");
    if (btnPremiere) {
      btnPremiere.onclick = () => {
        addFloatingText("+RED CARPET PREMIERE BUZZ", bld.grid_x + 1, bld.grid_y + 1, "#f5c518");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnAudio = document.getElementById("btnMasterAudio");
    if (btnAudio) {
      btnAudio.onclick = () => {
        addFloatingText("+DOLBY ATMOS MASTERED", bld.grid_x + 1, bld.grid_y + 1, "#38bdf8");
        if (typeof beep === "function") beep("cash");
      };
    }

    const btnBackRent = document.getElementById("btnBacklotRent");
    if (btnBackRent) {
      btnBackRent.onclick = () => {
        addFloatingText("+$2.0M BACKLOT RENT", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        const G = typeof window !== "undefined" ? window.G : null;
        if (G && G.studio) G.studio.cash = (G.studio.cash || 0) + 2;
        if (typeof beep === "function") beep("cash");
      };
    }
  }

  function renderPalette() {
    const root = document.getElementById("lotPaletteRoot");
    if (!root) return;
    const items = [
      { id: "soundstage", name: "Soundstage", cost: "$25M" },
      { id: "virtual_led", name: "LED Volume", cost: "$35M" },
      { id: "post_suite", name: "Post Suite", cost: "$18M" },
      { id: "writers_bungalow", name: "Writers Room", cost: "$12M" },
      { id: "cinema_theater", name: "Cinema Marquee", cost: "$30M" },
      { id: "backlot", name: "Backlot & Props", cost: "$20M" }
    ];

    root.innerHTML = `
      <div class="palette-bar itch-wood-panel" style="padding:10px 14px;border-radius:8px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="tiny muted" style="font-weight:bold;color:var(--gold)">BUILD FACILITY:</span>
          ${items.map(item => `
            <button class="btn btn-sm ${(_buildModeType === item.id) ? 'btn-primary' : 'btn-alt'}" data-btype="${item.id}">
              + ${item.name} <span class="tiny muted">(${item.cost})</span>
            </button>
          `).join("")}
          ${_buildModeType ? '<button id="btnCancelBuild" class="btn btn-ghost btn-sm" style="color:var(--red)">Cancel</button>' : ''}
        </div>
      </div>
    `;

    root.querySelectorAll("[data-btype]").forEach(btn => {
      btn.onclick = () => {
        _buildModeType = btn.dataset.btype;
        renderPalette();
      };
    });

    const btnCancel = document.getElementById("btnCancelBuild");
    if (btnCancel) {
      btnCancel.onclick = () => {
        _buildModeType = null;
        renderPalette();
      };
    }
  }

  function updateLotHud() {
    const G = typeof window !== "undefined" ? window.G : null;
    if (!G) return;
    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    const lot = engine ? JSON.parse(engine.get_lot_state_json()) : { buildings: [] };

    const elName = document.getElementById("lotHudStudioName");
    if (elName) elName.textContent = G.studio ? G.studio.name : "Studio Lot";

    const elCash = document.getElementById("lotHudCash");
    if (elCash && typeof window.fmtM === "function") elCash.textContent = window.fmtM(G.studio ? G.studio.cash : 0);

    const elDate = document.getElementById("lotHudDate");
    if (elDate && typeof window.dateLabel === "function") elDate.textContent = window.dateLabel(G.week);

    const elStages = document.getElementById("lotHudStages");
    if (elStages) {
      const activeStages = (lot.buildings || []).filter(b => b.filming_active).length;
      elStages.textContent = activeStages + " Filming";
    }
  }

  // Public Interface mounted to window
  const StudioLot2D = {
    mount(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      preloadAllAssets();

      container.innerHTML = `
        <div class="studiolot-viewport" style="position:relative;width:100%;height:100%;min-height:560px;background:#0c1017;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
          
          <!-- Top Kairosoft Control Console -->
          <div style="position:absolute;top:8px;left:10px;right:10px;z-index:20;display:flex;flex-direction:column;gap:6px;pointer-events:none">
            <!-- Row 1: Studio Info Left, Primary Production Buttons Right -->
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;pointer-events:none">
              <div class="kairo-hud-stats" style="pointer-events:auto;display:flex;align-items:center;gap:12px;background:rgba(15,23,42,0.92);padding:5px 12px;border-radius:6px;border:1px solid rgba(245,197,24,0.3)">
                <div class="itch-hud-stat">
                  <span class="lbl">Studio Lot</span>
                  <span id="lotHudStudioName" class="val" style="color:#fff">Box Office Studio</span>
                </div>
                <div class="itch-hud-stat">
                  <span class="lbl">War Chest</span>
                  <span id="lotHudCash" class="val" style="color:#10b981">$100.0M</span>
                </div>
                <div class="itch-hud-stat">
                  <span class="lbl">Calendar</span>
                  <span id="lotHudDate" class="val" style="color:var(--gold)">Y1 W1</span>
                </div>
                <div class="itch-hud-stat">
                  <span class="lbl">Active Shoots</span>
                  <span id="lotHudStages" class="val" style="color:#38bdf8">0 Filming</span>
                </div>
              </div>

              <div style="pointer-events:auto;display:flex;align-items:center;gap:6px">
                <button id="btnLotNextWeek" class="itch-btn-blue">Next Week (+1W)</button>
                <button id="btnLotFastWeek" class="itch-btn-blue">Fast (+4W)</button>
                <button id="btnLotDevelop" class="itch-btn-gold">+ Greenlight</button>
                <button id="btnTogglePalette" class="btn btn-alt btn-sm">Build Facility</button>
              </div>
            </div>

            <!-- Row 2: Room Switcher Tabs Left, Shortcuts Right -->
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;pointer-events:none">
              <div class="kairo-room-nav" style="pointer-events:auto;display:flex;gap:4px;background:rgba(15,23,42,0.92);padding:3px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.12)">
                <button class="kairo-nav-tab active" data-view="campus">Campus Lot</button>
                <button class="kairo-nav-tab" data-view="soundstage">Soundstage</button>
                <button class="kairo-nav-tab" data-view="writers">Writers Room</button>
                <button class="kairo-nav-tab" data-view="post">Post & VFX</button>
                <button class="kairo-nav-tab" data-view="cinema">Cinema Theater</button>
                <button class="kairo-nav-tab" data-view="executive">Executive Suite</button>
              </div>

              <div style="pointer-events:auto;display:flex;align-items:center;gap:4px;background:rgba(15,23,42,0.85);padding:3px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.1)">
                <button id="btnLotSlate" class="btn btn-alt btn-sm">Slate</button>
                <button id="btnLotTalent" class="btn btn-alt btn-sm">Talent</button>
                <button id="btnLotBoxOffice" class="btn btn-alt btn-sm">Box Office</button>
                <button id="btnLotFinance" class="btn btn-alt btn-sm">Finance</button>
              </div>
            </div>
          </div>

          <!-- Collapsible Facilities Build Palette Top Left (Default Hidden) -->
          <div id="lotPaletteRoot" style="position:absolute;top:104px;left:12px;z-index:25;display:none"></div>

          <!-- Camera Controls Bottom Left -->
          <div class="lot-controls" style="position:absolute;bottom:14px;left:14px;z-index:20;display:flex;gap:6px">
            <button id="btnZoomIn" class="btn btn-alt btn-sm" title="Zoom In">+</button>
            <button id="btnZoomOut" class="btn btn-alt btn-sm" title="Zoom Out">-</button>
            <button id="btnResetView" class="btn btn-alt btn-sm">Center Lot</button>
            <button id="btnFocusShoot" class="btn btn-primary btn-sm">Locate Set</button>
          </div>

          <!-- Inspector Drawer Top Right -->
          <div id="lotInspectorRoot" style="position:absolute;top:70px;right:14px;z-index:25;max-width:320px;display:none"></div>

          <!-- The Full 2D Game Canvas -->
          <canvas id="studioLotCanvas" style="display:block;width:100%;height:100%;cursor:grab"></canvas>
        </div>
      `;

      _canvas = document.getElementById("studioLotCanvas");
      _ctx = _canvas.getContext("2d");

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      // Center initial camera
      camera.x = _canvas.width / 2;
      camera.y = _canvas.height / 2;
      camera.zoom = 1.0;

      setupEvents();
      renderPalette();
      updateLotHud();

      // Hook Room Navigation Tabs
      document.querySelectorAll(".kairo-nav-tab").forEach(tab => {
        tab.onclick = () => {
          const view = tab.dataset.view;
          if (view) {
            setLotView(view);
            if (typeof beep === "function") beep("click");
          }
        };
      });

      document.getElementById("btnZoomIn").onclick = () => { camera.zoom = Math.min(2.5, camera.zoom * 1.2); };
      document.getElementById("btnZoomOut").onclick = () => { camera.zoom = Math.max(0.5, camera.zoom / 1.2); };
      document.getElementById("btnResetView").onclick = () => {
        camera.x = _canvas.width / 2;
        camera.y = _canvas.height / 2;
        camera.zoom = 1.0;
      };
      document.getElementById("btnFocusShoot").onclick = () => {
        setLotView("soundstage");
      };

      const palRoot = document.getElementById("lotPaletteRoot");
      document.getElementById("btnTogglePalette").onclick = () => {
        if (palRoot) {
          palRoot.style.display = (palRoot.style.display === "none") ? "block" : "none";
        }
      };

      // Wire in-canvas 2D game loops
      const btnNext = document.getElementById("btnLotNextWeek");
      if (btnNext) {
        btnNext.onclick = () => {
          if (typeof window.doWeek === "function") {
            window.doWeek(1);
            updateLotHud();
            addFloatingText("+WEEKLY PROGRESS", _canvas.width * 0.5, _canvas.height * 0.5, "#10b981");
            if (_selectedBuildingId) renderInspector();
          }
        };
      }

      const btnFast = document.getElementById("btnLotFastWeek");
      if (btnFast) {
        btnFast.onclick = () => {
          if (typeof window.doWeek === "function") {
            window.doWeek(4);
            updateLotHud();
            addFloatingText("+4 WEEKS ELAPSED", _canvas.width * 0.5, _canvas.height * 0.5, "#38bdf8");
            if (_selectedBuildingId) renderInspector();
          }
        };
      }

      const btnDev = document.getElementById("btnLotDevelop");
      if (btnDev) {
        btnDev.onclick = () => {
          if (typeof window.developModal === "function") window.developModal();
          else if (typeof window.switchTab === "function") window.switchTab("develop");
        };
      }

      const btnTal = document.getElementById("btnLotTalent");
      if (btnTal) {
        btnTal.onclick = () => {
          if (typeof window.talentModal === "function") window.talentModal();
          else if (typeof window.switchTab === "function") window.switchTab("develop");
        };
      }

      const btnSlate = document.getElementById("btnLotSlate");
      if (btnSlate) {
        btnSlate.onclick = () => {
          if (typeof window.switchTab === "function") window.switchTab("productions");
        };
      }

      const btnBox = document.getElementById("btnLotBoxOffice");
      if (btnBox) {
        btnBox.onclick = () => {
          if (typeof window.boxOfficeModal === "function") window.boxOfficeModal();
          else if (typeof window.switchTab === "function") window.switchTab("boxoffice");
        };
      }

      const btnFin = document.getElementById("btnLotFinance");
      if (btnFin) {
        btnFin.onclick = () => {
          if (typeof window.financeOverviewSheet === "function") window.financeOverviewSheet();
          else if (typeof window.switchTab === "function") window.switchTab("finance");
        };
      }

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
      window.removeEventListener("resize", resizeCanvas);
    },

    setView(v) {
      setLotView(v);
    },

    getView() {
      return _currentLotView;
    }
  };

  global.StudioLot2D = StudioLot2D;
})(typeof window !== "undefined" ? window : global);
