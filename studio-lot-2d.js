/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-LOT-2D.JS — 2D Isometric Studio Lot Canvas & Interactive Engine
   Box Office War — High-Performance 2D Renderer
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

  // Selected state
  let _selectedBuildingId = null;
  let _selectedAgentId = null;
  let _hoveredGridPos = null;
  let _buildModeType = null;
  let _floatingTexts = [];
  let _directingState = null; // { stageId, step: 0, timer: 0 }

  // Asset Caching
  const spriteCache = {};
  const ASSET_PATHS = {
    // Buildings
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

  // Coordinate projections
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

  // Floating text system
  function addFloatingText(text, gx, gy, color) {
    const scr = gridToScreen(gx, gy);
    _floatingTexts.push({
      text,
      x: scr.x,
      y: scr.y - 20,
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
    } else if (_directingState.step === 2) {
      _directingState.step = 3;
      _directingState.feedback = "Actors performing! Call 'CUT & PRINT IT!'";
      if (bld) addFloatingText("ACTION!", bld.grid_x + 1.5, bld.grid_y + 1.5, "#ef4444");
    } else if (_directingState.step === 3) {
      // Reward
      if (G && G.studio) {
        G.studio.rep = Math.min(99, G.studio.rep + 0.5);
        if (typeof log === "function") log("Director's cut approved on " + _directingState.title + ": +0.5 Studio Rep & +5 Hype.", "gold");
      }
      if (bld) {
        addFloatingText("PRINT IT! +5 HYPE", bld.grid_x + 1.5, bld.grid_y + 1.5, "#10b981");
      }
      _directingState = null;
    }
    renderInspector();
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

    // Clear Canvas
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    // Background Studio Atmosphere
    const grad = _ctx.createLinearGradient(0, 0, 0, _canvas.height);
    grad.addColorStop(0, "#0c1017");
    grad.addColorStop(1, "#151c28");
    _ctx.fillStyle = grad;
    _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    if (!engine) {
      _animId = requestAnimationFrame(render);
      return;
    }

    const stateStr = engine.get_lot_state_json();
    const lot = JSON.parse(stateStr);
    const cols = lot.cols || 24;
    const rows = lot.rows || 24;
    const tilesFlat = engine.get_tiles_flat ? engine.get_tiles_flat() : null;

    // 1. Draw Grid Ground Tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const scr = gridToScreen(c, r);
        // Frustum culling
        if (scr.x < -100 || scr.x > _canvas.width + 100 || scr.y < -100 || scr.y > _canvas.height + 100) continue;

        const tileType = tilesFlat ? tilesFlat[r * cols + c] : 0;
        drawGroundTile(_ctx, scr.x, scr.y, tileType, c, r);
      }
    }

    // Hover Highlight
    if (_hoveredGridPos && _hoveredGridPos.x >= 0 && _hoveredGridPos.x < cols && _hoveredGridPos.y >= 0 && _hoveredGridPos.y < rows) {
      const hScr = gridToScreen(_hoveredGridPos.x, _hoveredGridPos.y);
      drawTileHighlight(_ctx, hScr.x, hScr.y, _buildModeType ? "rgba(245, 197, 24, 0.4)" : "rgba(255, 255, 255, 0.2)");
    }

    // 2. Prepare Entities for Depth Sorting
    const entities = [];

    // Buildings
    for (const b of (lot.buildings || [])) {
      entities.push({
        type: "building",
        depth: (b.grid_x + b.span_w * 0.5) + (b.grid_y + b.span_h * 0.5),
        data: b
      });
    }

    // Agents
    for (const a of (lot.agents || [])) {
      entities.push({
        type: "agent",
        depth: a.x + a.y,
        data: a
      });
    }

    // Sort by depth
    entities.sort((a, b) => a.depth - b.depth);

    // 3. Render Entities
    for (const ent of entities) {
      if (ent.type === "building") {
        drawBuilding(_ctx, ent.data);
      } else if (ent.type === "agent") {
        drawAgent(_ctx, ent.data);
      }
    }

    // 4. Render Floating Text
    for (let i = _floatingTexts.length - 1; i >= 0; i--) {
      const ft = _floatingTexts[i];
      ft.life -= dt * 0.8;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) {
        _floatingTexts.splice(i, 1);
        continue;
      }
      _ctx.save();
      _ctx.globalAlpha = Math.max(0, ft.life);
      _ctx.font = "bold 13px system-ui, sans-serif";
      _ctx.fillStyle = ft.color;
      _ctx.strokeStyle = "#000";
      _ctx.lineWidth = 3;
      _ctx.strokeText(ft.text, ft.x, ft.y);
      _ctx.fillText(ft.text, ft.x, ft.y);
      _ctx.restore();
    }

    // 5. Draw HUD Overlays (Tickets ticker, active soundstages)
    drawHudOverlay(_ctx, lot);

    _animId = requestAnimationFrame(render);
  }

  function drawGroundTile(ctx, sx, sy, type, gx, gy) {
    const w = TILE_W * camera.zoom;
    const h = TILE_H * camera.zoom;

    // Use cached 2D isometric tile sprite if loaded
    const tileKey = type === 1 ? "tile_road" :
                    type === 2 ? "tile_plaza" :
                    type === 3 ? "tile_concrete" : "tile_grass";
    const cached = spriteCache[tileKey];
    if (cached && cached.loaded) {
      ctx.drawImage(cached.img, sx - w / 2, sy - h / 2, w, h);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx, sy - h / 2);
    ctx.lineTo(sx + w / 2, sy);
    ctx.lineTo(sx, sy + h / 2);
    ctx.lineTo(sx - w / 2, sy);
    ctx.closePath();

    if (type === 1) { // Road
      ctx.fillStyle = "#2a3441";
      ctx.fill();
      ctx.strokeStyle = "#1b232e";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Road center dashed line
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx - w / 4, sy - h / 4);
      ctx.lineTo(sx + w / 4, sy + h / 4);
      ctx.stroke();
    } else if (type === 2) { // Plaza
      ctx.fillStyle = "#3d4b5c";
      ctx.fill();
      ctx.strokeStyle = "#4d5d73";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 3) { // Concrete Pad
      ctx.fillStyle = "#4a5568";
      ctx.fill();
      ctx.strokeStyle = "#323c4a";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (type === 4) { // Water fountain
      ctx.fillStyle = "#0284c7";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else { // Grass
      ctx.fillStyle = ((gx + gy) % 2 === 0) ? "#1e3a29" : "#1a3324";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

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
    // Footprint center
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
      // Procedural Isometric Hangar fallback
      const w = TILE_W * camera.zoom * b.span_w * 0.6;
      const h = TILE_H * camera.zoom * b.span_h * 0.8;
      const bHeight = 45 * camera.zoom;

      ctx.fillStyle = b.filming_active ? "#1e293b" : "#334155";
      ctx.strokeStyle = isSelected ? "#f5c518" : "#475569";
      ctx.lineWidth = isSelected ? 3 : 1;

      // Base footprint
      ctx.beginPath();
      ctx.moveTo(scr.x, scr.y - h / 2 - bHeight);
      ctx.lineTo(scr.x + w / 2, scr.y - bHeight);
      ctx.lineTo(scr.x, scr.y + h / 2 - bHeight);
      ctx.lineTo(scr.x - w / 2, scr.y - bHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Active Filming Indicator / Spotlight Cone
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

      // On-Air Red Light Pill
      ctx.save();
      const pillY = scr.y - 75 * camera.zoom;
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(scr.x - 30, pillY, 60, 16, 8);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 0;
      ctx.fillText("ON AIR", scr.x, pillY + 8);
      ctx.restore();
    }

    // Building Title & Tier Badge
    ctx.save();
    const labelY = scr.y + 12 * camera.zoom;
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = isSelected ? "#f5c518" : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    const labelText = b.active_title ? b.active_title : b.name;
    const metrics = ctx.measureText(labelText);
    const boxW = Math.max(70, metrics.width + 16);

    ctx.beginPath();
    ctx.roundRect(scr.x - boxW / 2, labelY, boxW, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSelected ? "#f5c518" : "#f8fafc";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, scr.x, labelY + 9);

    // Progress Bar if production active
    if (b.active_title && b.progress != null) {
      const barW = boxW - 8;
      const barH = 3;
      const barX = scr.x - barW / 2;
      const barY = labelY + 21;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(barX, barY, barW * b.progress, barH);
    }

    ctx.restore();
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
    // 1. Soft Ground Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.ellipse(scr.x, scr.y, 10 * camera.zoom, 5 * camera.zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Role Base Ring
    ctx.strokeStyle = roleInfo.ring;
    ctx.lineWidth = 2 * camera.zoom;
    ctx.beginPath();
    ctx.ellipse(scr.x, scr.y, 8 * camera.zoom, 4 * camera.zoom, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Selection Reticle / Diamond
    if (_selectedAgentId === a.id) {
      const pulse = Math.sin(performance.now() * 0.008) * 4;
      ctx.strokeStyle = "#f5c518";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(scr.x, scr.y - 18 * camera.zoom, (18 + pulse) * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#f5c518";
      ctx.beginPath();
      ctx.moveTo(scr.x, scr.y - (38 + pulse) * camera.zoom);
      ctx.lineTo(scr.x - 5 * camera.zoom, scr.y - (45 + pulse) * camera.zoom);
      ctx.lineTo(scr.x + 5 * camera.zoom, scr.y - (45 + pulse) * camera.zoom);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Character Sprite (Itch pixel avatar)
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

    // 5. Nameplate / Status
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

  function drawHudOverlay(ctx, lot) {
    ctx.save();
    // Top right lot quick stats
    const padding = 16;
    const hudW = 220;
    const hudH = 68;
    const hudX = _canvas.width - hudW - padding;
    const hudY = padding;

    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("STUDIO LOT SIMULATION", hudX + 12, hudY + 18);

    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 13px system-ui, sans-serif";
    const soundstageCount = (lot.buildings || []).filter(b => b.b_type === "soundstage" || b.b_type === "virtual_led").length;
    ctx.fillText("Active Stages: " + soundstageCount, hudX + 12, hudY + 38);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "12px system-ui, sans-serif";
    const tickets = (lot.total_tickets_sold || 0).toLocaleString();
    ctx.fillText("Tickets Sold: " + tickets, hudX + 12, hudY + 56);

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
      const gPos = screenToGrid(mouseX, mouseY);

      const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
      if (!engine) return;

      if (_buildModeType) {
        // Place building mode
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

      // Check if an agent was clicked first
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

      // Check if a building was clicked
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

  // Agent Inspector (Itch Pixel Character Dossier)
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
    const G = typeof window !== "undefined" ? window.G : null;

    root.innerHTML = `
      <div class="lot-card itch-wood-panel">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="tag gold" style="font-size:10px">${roleInfo.badge} DOSSIER</span>
          <button id="btnCloseInspector" class="btn btn-ghost btn-sm" style="padding:2px 8px">✕</button>
        </div>
        <div style="display:flex;gap:12px;align-items:center;margin:10px 0">
          <div class="itch-avatar-frame">
            <img src="${imgSrc}" alt="${agent.name || roleInfo.role}" style="width:68px;height:68px;image-rendering:pixelated;object-fit:cover;border-radius:6px;display:block">
          </div>
          <div>
            <b style="font-size:15px;color:#fff">${agent.name || roleInfo.role}</b>
            <div style="font-size:12px;color:${roleInfo.color};font-weight:600">${roleInfo.role}</div>
            <div class="tiny muted" style="margin-top:2px">Status: ${agent.state_str || "Roaming Lot"}</div>
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

  // Building Inspector with Tycoon Action Suites
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
    const G = typeof window !== "undefined" ? window.G : null;
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
        <button id="btnPolishRoom" class="btn btn-alt btn-sm" style="width:100%">Writers Room Workshop (+4 Q)</button>
      `;
    } else if (btype === "cinema_theater") {
      actionsHtml = `
        <button id="btnViewBoxOffice" class="btn btn-primary btn-sm" style="width:100%">Weekend Box Office Charts</button>
        <button id="btnPremiereBlitz" class="btn btn-alt btn-sm" style="width:100%">Red Carpet Premiere Blitz</button>
      `;
    } else if (btype === "post_suite") {
      actionsHtml = `
        <button id="btnTestScreen" class="btn btn-primary btn-sm" style="width:100%">Audience Test Screening</button>
        <button id="btnScoreMaster" class="btn btn-alt btn-sm" style="width:100%">4K HDR & Orchestral Master</button>
      `;
    } else if (btype === "executive") {
      actionsHtml = `
        <button id="btnExecFinance" class="btn btn-primary btn-sm" style="width:100%">Financial Ledger & P&L</button>
        <button id="btnExecBonds" class="btn btn-alt btn-sm" style="width:100%">Issue Production Bonds</button>
      `;
    } else if (btype === "studio_gate") {
      actionsHtml = `
        <button id="btnGateScout" class="btn btn-primary btn-sm" style="width:100%">Scout A-List Stars & Directors</button>
        <button id="btnGateAgency" class="btn btn-alt btn-sm" style="width:100%">CAA / WME Talent Agency</button>
      `;
    } else if (btype === "backlot") {
      actionsHtml = `
        <button id="btnBacklotMerch" class="btn btn-primary btn-sm" style="width:100%">Theme Park & Merchandising</button>
        <button id="btnBacklotRent" class="btn btn-alt btn-sm" style="width:100%">Rent Backlot to Rival (+$2M)</button>
      `;
    }

    root.innerHTML = `
      <div class="lot-card itch-wood-panel">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:15px;color:var(--gold)">${bld.name}</b>
          <button id="btnCloseInspector" class="btn btn-ghost btn-sm" style="padding:2px 8px">✕</button>
        </div>
        <div class="tag-row" style="margin:8px 0">
          <span class="tag gold">Tier ${bld.tier} / 5</span>
          <span class="tag blue">${btype}</span>
          ${bld.filming_active ? '<span class="tag red">Shooting Active</span>' : '<span class="tag muted">Operational</span>'}
        </div>
        ${bld.active_title ? `
          <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:4px;margin-bottom:8px;border-left:3px solid var(--gold)">
            <div class="tiny muted">CURRENT PRODUCTION</div>
            <b style="color:#fff;font-size:13px">${bld.active_title}</b>
            <div class="tiny muted" style="margin-top:4px">Phase: ${bld.active_phase} · Progress: ${Math.round((bld.progress || 0) * 100)}%</div>
          </div>
        ` : ''}
        <div style="display:flex;flex-direction:column;gap:6px;margin:10px 0">
          ${actionsHtml}
        </div>
        <div class="row" style="gap:8px;margin-top:12px;border-top:1px solid rgba(255,255,255,0.1);padding-top:10px">
          <button id="btnUpgradeLotBuilding" class="btn btn-primary btn-sm" style="flex:1" ${bld.tier >= 5 ? 'disabled' : ''}>Upgrade Tier</button>
          <button id="btnDemolishLotBuilding" class="btn btn-ghost btn-sm" style="color:var(--red)">Demolish</button>
        </div>
      </div>
    `;

    document.getElementById("btnCloseInspector").onclick = () => {
      _selectedBuildingId = null;
      renderInspector();
    };

    const btnStartDir = document.getElementById("btnStartDirecting");
    if (btnStartDir) btnStartDir.onclick = () => startDirectingScene(bld.id);

    const btnAdvDir = document.getElementById("btnAdvanceDirecting");
    if (btnAdvDir) btnAdvDir.onclick = () => advanceDirectingStep();

    const btnRush = document.getElementById("btnRushShoot");
    if (btnRush) {
      btnRush.onclick = () => {
        addFloatingText("RUSHED SHOOT! +25%", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnGreen = document.getElementById("btnGreenlightStage");
    if (btnGreen && typeof window.switchTab === "function") {
      btnGreen.onclick = () => {
        if (typeof window.developModal === "function") window.developModal();
        else window.switchTab("develop");
      };
    }

    const btnRent = document.getElementById("btnRentStage");
    if (btnRent) {
      btnRent.onclick = () => {
        addFloatingText("+$1.5M SUBLEASE", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        if (G && G.studio) G.studio.cash = (G.studio.cash || 0) + 1.5;
        if (typeof beep === "function") beep("cash");
      };
    }

    const btnComm = document.getElementById("btnCommissionScript");
    if (btnComm && typeof window.buyScriptModal === "function") {
      btnComm.onclick = () => window.buyScriptModal();
    }

    const btnPolish = document.getElementById("btnPolishRoom");
    if (btnPolish) {
      btnPolish.onclick = () => {
        addFloatingText("+4 SCRIPT QUALITY", bld.grid_x + 1, bld.grid_y + 1, "#38bdf8");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnBox = document.getElementById("btnViewBoxOffice");
    if (btnBox && typeof window.boxOfficeModal === "function") {
      btnBox.onclick = () => window.boxOfficeModal();
    }

    const btnPrem = document.getElementById("btnPremiereBlitz");
    if (btnPrem) {
      btnPrem.onclick = () => {
        addFloatingText("+RED CARPET BLITZ", bld.grid_x + 1, bld.grid_y + 1, "#f5c518");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnTest = document.getElementById("btnTestScreen");
    if (btnTest) {
      btnTest.onclick = () => {
        addFloatingText("+TEST SCORE 88%", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnScore = document.getElementById("btnScoreMaster");
    if (btnScore) {
      btnScore.onclick = () => {
        addFloatingText("+DOLBY ATMOS MASTER", bld.grid_x + 1, bld.grid_y + 1, "#f5c518");
        if (typeof beep === "function") beep("gold");
      };
    }

    const btnFin = document.getElementById("btnExecFinance");
    if (btnFin && typeof window.financeOverviewSheet === "function") {
      btnFin.onclick = () => window.financeOverviewSheet();
    }

    const btnBonds = document.getElementById("btnExecBonds");
    if (btnBonds) {
      btnBonds.onclick = () => {
        addFloatingText("+$20M BOND ISSUED", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        if (G && G.studio) G.studio.cash = (G.studio.cash || 0) + 20;
        if (typeof beep === "function") beep("cash");
      };
    }

    const btnScout = document.getElementById("btnGateScout");
    if (btnScout && typeof window.talentModal === "function") {
      btnScout.onclick = () => window.talentModal();
    }

    const btnAgency = document.getElementById("btnGateAgency");
    if (btnAgency && typeof window.switchTab === "function") {
      btnAgency.onclick = () => {
        if (typeof window.talentModal === "function") window.talentModal();
        else window.switchTab("develop");
      };
    }

    const btnMerch = document.getElementById("btnBacklotMerch");
    if (btnMerch && typeof window.switchTab === "function") {
      btnMerch.onclick = () => window.switchTab("empire");
    }

    const btnBackRent = document.getElementById("btnBacklotRent");
    if (btnBackRent) {
      btnBackRent.onclick = () => {
        addFloatingText("+$2.0M BACKLOT RENT", bld.grid_x + 1, bld.grid_y + 1, "#10b981");
        if (G && G.studio) G.studio.cash = (G.studio.cash || 0) + 2;
        if (typeof beep === "function") beep("cash");
      };
    }

    document.getElementById("btnUpgradeLotBuilding").onclick = () => {
      const newTier = engine.upgrade_building(bld.id);
      if (newTier) {
        addFloatingText("UPGRADED TO TIER " + newTier, bld.grid_x + 1, bld.grid_y + 1, "#f5c518");
        renderInspector();
      }
    };

    document.getElementById("btnDemolishLotBuilding").onclick = () => {
      if (confirm("Demolish " + bld.name + "?")) {
        engine.demolish_building(bld.id);
        _selectedBuildingId = null;
        renderInspector();
      }
    };
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
      <div class="palette-bar itch-wood-panel">
        <span class="tiny muted" style="font-weight:bold;margin-right:8px;color:var(--gold)">BUILD FACILITY:</span>
        ${items.map(item => `
          <button class="btn btn-sm ${(_buildModeType === item.id) ? 'btn-primary' : 'btn-alt'}" data-btype="${item.id}">
            + ${item.name} <span class="tiny muted">(${item.cost})</span>
          </button>
        `).join("")}
        ${_buildModeType ? '<button id="btnCancelBuild" class="btn btn-ghost btn-sm" style="color:var(--red)">Cancel</button>' : ''}
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
        <div class="studiolot-viewport" style="position:relative;width:100%;height:100%;min-height:540px;background:#0c1017;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
          <!-- Top In-Canvas 2D HUD -->
          <div style="position:absolute;top:12px;left:12px;right:12px;z-index:10;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;pointer-events:none">
            <div class="itch-lot-hud" style="pointer-events:auto">
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

            <!-- In-Canvas Action Bar -->
            <div class="itch-action-bar" style="pointer-events:auto">
              <button id="btnLotNextWeek" class="itch-btn-blue">Next Week (+1W)</button>
              <button id="btnLotFastWeek" class="itch-btn-blue">Fast (+4W)</button>
              <button id="btnLotDevelop" class="itch-btn-gold">+ Greenlight</button>
              <button id="btnLotSlate" class="btn btn-alt btn-sm">Active Slate</button>
              <button id="btnLotTalent" class="btn btn-alt btn-sm">Talent</button>
              <button id="btnLotBoxOffice" class="btn btn-alt btn-sm">Box Office</button>
              <button id="btnLotFinance" class="btn btn-alt btn-sm">Finance</button>
            </div>
          </div>

          <!-- Build Palette Top Left -->
          <div id="lotPaletteRoot" style="position:absolute;top:76px;left:12px;z-index:10"></div>

          <!-- Camera Controls Bottom Left -->
          <div class="lot-controls" style="position:absolute;bottom:16px;left:16px;z-index:10;display:flex;gap:6px">
            <button id="btnZoomIn" class="btn btn-alt btn-sm" title="Zoom In">+</button>
            <button id="btnZoomOut" class="btn btn-alt btn-sm" title="Zoom Out">-</button>
            <button id="btnResetView" class="btn btn-alt btn-sm">Center Lot</button>
            <button id="btnFocusShoot" class="btn btn-primary btn-sm">Locate Set</button>
            <button id="btnTogglePalette" class="btn btn-alt btn-sm">Facilities Palette</button>
          </div>

          <!-- Inspector Drawer Top Right -->
          <div id="lotInspectorRoot" style="position:absolute;top:76px;right:12px;z-index:10;max-width:320px;display:none"></div>

          <canvas id="studioLotCanvas" style="display:block;width:100%;height:100%;cursor:grab"></canvas>
        </div>
      `;

      _canvas = document.getElementById("studioLotCanvas");
      _ctx = _canvas.getContext("2d");

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      // Center initial camera
      camera.x = _canvas.width / 2;
      camera.y = _canvas.height / 3;
      camera.zoom = 1.0;

      setupEvents();
      renderPalette();
      updateLotHud();

      document.getElementById("btnZoomIn").onclick = () => { camera.zoom = Math.min(2.5, camera.zoom * 1.2); };
      document.getElementById("btnZoomOut").onclick = () => { camera.zoom = Math.max(0.5, camera.zoom / 1.2); };
      document.getElementById("btnResetView").onclick = () => {
        camera.x = _canvas.width / 2;
        camera.y = _canvas.height / 3;
        camera.zoom = 1.0;
      };
      document.getElementById("btnFocusShoot").onclick = () => {
        const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
        if (!engine) return;
        const stateStr = engine.get_lot_state_json();
        const lot = JSON.parse(stateStr);
        const activeStage = (lot.buildings || []).find(b => b.filming_active);
        if (activeStage) {
          const scr = gridToScreen(activeStage.grid_x + 1, activeStage.grid_y + 1);
          camera.x += (_canvas.width / 2 - scr.x);
          camera.y += (_canvas.height / 2 - scr.y);
          _selectedBuildingId = activeStage.id;
          renderInspector();
        }
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
            // Spawn floating text on cinema and soundstage
            const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
            if (engine) {
              const lot = JSON.parse(engine.get_lot_state_json());
              const cinema = (lot.buildings || []).find(b => b.b_type === "cinema_theater");
              if (cinema) addFloatingText("+WEEKEND BOX OFFICE", cinema.grid_x + 1, cinema.grid_y + 1, "#10b981");
              const active = (lot.buildings || []).find(b => b.filming_active);
              if (active) addFloatingText("+SHOOT PROGRESS", active.grid_x + 1, active.grid_y + 1, "#f5c518");
            }
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
    }
  };

  global.StudioLot2D = StudioLot2D;
})(typeof window !== "undefined" ? window : global);
