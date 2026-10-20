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

    // Characters
    director: "assets/2d/char_director.png",
    cameraman: "assets/2d/char_cameraman.png",
    star_actor: "assets/2d/char_star_actor.png",
    extra: "assets/2d/char_extra.png",
    audience: "assets/2d/char_audience.png",
    male_idle: "assets/2d/char_male_idle.png",
    male_walk0: "assets/2d/char_male_walk0.png",
    male_walk1: "assets/2d/char_male_walk1.png",
    female_walk0: "assets/2d/char_female_walk0.png"
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

  function drawAgent(ctx, a) {
    const scr = gridToScreen(a.x, a.y);
    let spriteKey = "director";
    if (a.kind_str === "star_actor") spriteKey = "star_actor";
    else if (a.kind_str === "cameraman") spriteKey = "cameraman";
    else if (a.kind_str === "audience") spriteKey = "audience";
    else if (a.kind_str === "extra") spriteKey = "extra";
    else if (a.kind_str === "director") spriteKey = "director";
    else if (a.state_str === "walking") {
      spriteKey = (Math.floor((a.anim_timer || 0) * 4) % 2 === 0) ? "male_walk0" : "male_walk1";
    } else {
      spriteKey = "male_idle";
    }

    const cached = spriteCache[spriteKey] || spriteCache["male_idle"];

    ctx.save();
    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.ellipse(scr.x, scr.y, 8 * camera.zoom, 4 * camera.zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    if (cached && cached.loaded) {
      const img = cached.img;
      const charScale = 0.45 * camera.zoom;
      const drawW = img.width * charScale;
      const drawH = img.height * charScale;
      // Slight bounce on walking
      const bounce = a.state_str === "walking" ? Math.sin(a.anim_timer * 12) * 2 : 0;
      ctx.drawImage(img, scr.x - drawW / 2, scr.y - drawH + bounce, drawW, drawH);
    } else {
      // Circle fallback
      ctx.fillStyle = a.kind_str === "director" ? "#f59e0b" :
                      a.kind_str === "star_actor" ? "#ec4899" :
                      a.kind_str === "cameraman" ? "#3b82f6" : "#10b981";
      ctx.beginPath();
      ctx.arc(scr.x, scr.y - 10 * camera.zoom, 6 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
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

      // Check if a building was clicked
      const stateStr = engine.get_lot_state_json();
      const lot = JSON.parse(stateStr);
      let clickedBld = null;
      for (const b of (lot.buildings || [])) {
        if (gPos.x >= b.grid_x && gPos.x < b.grid_x + b.span_w &&
            gPos.y >= b.grid_y && gPos.y < b.grid_y + b.span_h) {
          clickedBld = b;
          break;
        }
      }

      _selectedBuildingId = clickedBld ? clickedBld.id : null;
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
      _canvas.height = Math.max(480, window.innerHeight - 170);
    }
  }

  // DOM Views (Inspector Drawer & Build Palette)
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

    let directingHtml = "";
    if (bld.filming_active) {
      if (_directingState && _directingState.stageId === bld.id) {
        const btnLabel = _directingState.step === 1 ? "Call 'Roll Camera!'" :
                         _directingState.step === 2 ? "Call 'Action!'" : "Call 'Cut & Print It!'";
        directingHtml = `
          <div class="directing-box" style="margin-top:12px;padding:10px;background:rgba(245,197,24,0.1);border:1px solid var(--gold);border-radius:6px">
            <div style="font-weight:bold;color:var(--gold);font-size:12px">ACTIVE SHOOT DIRECTING</div>
            <p style="font-size:12px;margin:6px 0">${_directingState.feedback}</p>
            <button id="btnAdvanceDirecting" class="btn btn-primary btn-sm" style="width:100%">${btnLabel}</button>
          </div>
        `;
      } else {
        directingHtml = `
          <button id="btnStartDirecting" class="btn btn-alt btn-sm" style="margin-top:10px;width:100%">Direct Scene</button>
        `;
      }
    }

    root.innerHTML = `
      <div class="lot-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-size:15px;color:var(--gold)">${bld.name}</b>
          <button id="btnCloseInspector" class="btn btn-ghost btn-sm" style="padding:2px 8px">✕</button>
        </div>
        <div class="tag-row" style="margin:8px 0">
          <span class="tag gold">Tier ${bld.tier} / 5</span>
          <span class="tag blue">${bld.b_type || bld.type_str}</span>
          ${bld.filming_active ? '<span class="tag red">Shooting Active</span>' : '<span class="tag muted">Idle</span>'}
        </div>
        ${bld.active_title ? `
          <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:4px;margin-bottom:8px">
            <div class="tiny muted">CURRENT PRODUCTION</div>
            <b style="color:#fff">${bld.active_title}</b>
            <div class="tiny muted" style="margin-top:4px">Phase: ${bld.active_phase} · Progress: ${Math.round((bld.progress || 0) * 100)}%</div>
          </div>
        ` : '<p class="tiny muted">No active movie currently scheduled on this soundstage.</p>'}
        ${directingHtml}
        <div class="row" style="gap:8px;margin-top:12px">
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
      <div class="palette-bar">
        <span class="tiny muted" style="font-weight:bold;margin-right:8px">BUILD PALETTE:</span>
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

  // Public Interface mounted to window
  const StudioLot2D = {
    mount(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;

      preloadAllAssets();

      container.innerHTML = `
        <div class="studiolot-viewport" style="position:relative;width:100%;height:100%;min-height:500px;background:#0c1017;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
          <div id="lotPaletteRoot" style="position:absolute;top:12px;left:12px;z-index:10"></div>
          <div class="lot-controls" style="position:absolute;bottom:16px;left:16px;z-index:10;display:flex;gap:6px">
            <button id="btnZoomIn" class="btn btn-alt btn-sm" title="Zoom In">+</button>
            <button id="btnZoomOut" class="btn btn-alt btn-sm" title="Zoom Out">-</button>
            <button id="btnResetView" class="btn btn-alt btn-sm">Center Lot</button>
            <button id="btnFocusShoot" class="btn btn-primary btn-sm">Locate Set</button>
          </div>
          <div id="lotInspectorRoot" style="position:absolute;top:12px;right:12px;z-index:10;max-width:280px;display:none"></div>
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
