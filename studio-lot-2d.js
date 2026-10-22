/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-LOT-2D.JS — Isometric Canvas, Input & Contextual Management
   Box Office War — Shared Simulation, Original Pixel Art, Desktop & Touch
   Zero Emojis Policy strictly enforced.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  let _canvas = null;
  let debugMode=new URLSearchParams(global.location?.search||'').get('simDebug')==='1';
  let _ctx = null;
  let _animId = null;
  let _lastTime = 0;
  let _events = null, _resizeObserver = null;
  let _hudTimer = 0;
  const metrics={frames:0,renderMs:0,simulationMs:0,maxRenderMs:0};
  let _battery = false, _lastPaint = 0, _qualityMode='auto', _adaptiveDpr=2;
  let _qualityFrames=0, _qualityElapsed=0, _qualityLast=0;
  let _viewBase = {x:0,y:0,zoom:1}, _campusCamera = null;
  let _terrain = null, _terrainEngine = null, _terrainRevision = -1;
  try { const saved=localStorage.getItem('bow_lot_quality');if(['auto','crisp','battery'].includes(saved))_qualityMode=saved;_battery=_qualityMode==='battery'; } catch(e) {}
  const reducedMotion = () => global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let _logicalWidth = 0, _logicalHeight = 0;
  const career = () => typeof G !== "undefined" ? G : global.G;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const costs = {soundstage:15,virtual_led:25,post_suite:8,writers_bungalow:5};
  function feedback(text) {
    const el = document.getElementById("lotStatus");
    if (el) el.textContent = text;
  }
  function persistLot() {
    global.StudioLotBridge.persist(career());
    if (typeof saveGame === "function") saveGame();
    updateLotHud();
  }
  function sceneViewport() {
    const canvasRect=_canvas?.getBoundingClientRect();
    const top=document.querySelector('.studiolot-viewport .kairo-top-bar')?.getBoundingClientRect();
    const deck=document.querySelector('.studiolot-viewport .kairo-bottom-deck')?.getBoundingClientRect();
    const panel=document.getElementById('lotInspectorRoot');
    const panelRect=panel&&panel.style.display!=='none'?panel.getBoundingClientRect():null;
    const y=Math.max(12,(top?.bottom||0)-(canvasRect?.top||0)+10);
    const bottom=Math.min(_logicalHeight-12,(deck?.top||_logicalHeight)-(canvasRect?.top||0))-72;
    const right=panelRect?Math.min(_logicalWidth-12,panelRect.left-(canvasRect?.left||0)-12):_logicalWidth-12;
    return {x:12,y,w:Math.max(180,right-12),h:Math.max(70,bottom-y)};
  }
  function centerCamera() {
    const area=sceneViewport(),engine=global.StudioLotBridge.getEngine();
    const minX=-(engine.rows+4)*32,maxX=(engine.cols+4)*32,minY=-130,maxY=(engine.cols+engine.rows+4)*16+12;
    camera.zoom=Math.max(.08,Math.min(1.3,area.w/(maxX-minX),area.h/(maxY-minY)));
    camera.x=area.x+area.w/2-(minX+maxX)/2*camera.zoom;
    camera.y=area.y+area.h/2-(minY+maxY)/2*camera.zoom;
    _viewBase={x:camera.x,y:camera.y,zoom:camera.zoom};
  }

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
  let _buildModeType = null, _touchSite = null;

  // Asset Caching
  const spriteCache = {};
  const ASSET_PATHS = {
    studio_van: "assets/vendor/kenney-cars/delivery_SE-trim.png",
    studio_car: "assets/vendor/kenney-cars/sedanSports_SE-trim.png",
    palm: "assets/vendor/kenney-nature/tree_palmDetailedTall_SE-trim.png",
    shrub: "assets/vendor/kenney-nature/plant_bushDetailed_SE-trim.png",
    // Kairosoft 16:9 Widescreen Studio Scenes
    kairo_campus: "assets/2d/kairo_studio_campus.png",
    kairo_soundstage: "assets/2d/kairo_soundstage.png",
    kairo_writers: "assets/2d/kairo_writers_room.png",
    kairo_post: "assets/2d/kairo_post_suite.png",
    kairo_cinema: "assets/2d/kairo_cinema_theater.png",
    kairo_executive: "assets/2d/kairo_executive_office.png",

    // Buildings (Isometric Sprites for Sandbox)
    soundstage: "assets/studio/soundstage.png",
    virtual_led: "assets/studio/virtual_led.png",
    post_suite: "assets/studio/post_suite.png",
    writers_bungalow: "assets/studio/writers_bungalow.png",
    studio_gate: "assets/studio/studio_gate.png",
    backlot: "assets/studio/backlot.png",
    cinema_theater: "assets/studio/cinema_theater.png",
    executive: "assets/studio/executive.png",

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

    spriteCache[key] = { img, loaded: false };
    img.onload = () => { spriteCache[key].loaded = true; };
    img.onerror = () => { spriteCache[key].failed = true; console.warn("Lot asset unavailable:", url); };
    img.src = url;
    return spriteCache[key];
  }

  function preloadAllAssets() {
    for (const k in ASSET_PATHS) {
      if (["studio_van","studio_car","palm","shrub","soundstage","virtual_led","post_suite","writers_bungalow","studio_gate","backlot","cinema_theater","executive"].includes(k)) loadAsset(k, ASSET_PATHS[k]);
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

  // Room view switcher
  function setLotView(view) {
    if(!['campus','soundstage','writers','post','cinema','executive'].includes(view))return;
    if(view!=='campus')cancelConstruction();
    const changed=_currentLotView!==view;
    const previousArea=changed&&_currentLotView==='campus'?sceneViewport():null;
    if(changed && _currentLotView==='campus')_campusCamera={x:camera.x,y:camera.y,zoom:camera.zoom};
    _currentLotView = view;
    const viewport=document.querySelector('.studiolot-viewport');if(viewport)viewport.dataset.lotView=view;
    if(changed){_selectedAgentId=null;if(view==='campus')_selectedBuildingId=null;const panel=document.getElementById('lotInspectorRoot');if(panel)panel.style.display='none';}
    if(previousArea&&_campusCamera)_campusCamera.x+=(sceneViewport().w-previousArea.w)/2;
    if(changed)feedback(view==='campus'?'Updated interiors: use Stage, Post & VFX, Cinema or Executive tabs above · Drag to pan':'Live department · Select staff for assignments · Campus returns to the lot');
    const tabs = document.querySelectorAll(".kairo-nav-tab");
    tabs.forEach(tab => {
      if (tab.dataset.view === view) tab.classList.add("active");
      else tab.classList.remove("active");
    });
    if (_canvas && changed) {
      centerCamera();
      if(view==='campus'&&_campusCamera)Object.assign(camera,_campusCamera);
    }
    updateLotHud();
  }

  // Main Render Loop
  function render(time) {
    if (!_canvas || !_ctx) return;
    if(_qualityMode==='auto'&&!document.hidden&&_qualityLast){
      _qualityFrames++;_qualityElapsed+=Math.min(250,time-_qualityLast);
      if(_qualityFrames>=120){if(_qualityElapsed/_qualityFrames>24&&_adaptiveDpr>1){_adaptiveDpr=1;resizeCanvas();feedback('Auto quality: pixel resolution reduced to keep the lot responsive.');}_qualityFrames=0;_qualityElapsed=0;}
    }
    _qualityLast=time;
    if (_battery && time - _lastPaint < 32) { _animId=requestAnimationFrame(render); return; }
    _lastPaint=time;
    const started=performance.now();
    const dt = document.hidden || global.StudioLotBridge.clock.paused ? 0 : _lastTime ? Math.min(0.1, (time - _lastTime) / 1000) : 0.016;
    _lastTime = time;

    // Simulation Tick
    const engine = global.StudioLotBridge ? global.StudioLotBridge.getEngine() : null;
    if (engine) {
      const currentWeek = (typeof G !== "undefined" && G && G.week) ? G.week : 1;
      for(let i=0;i<global.StudioLotBridge.clock.speed;i++) engine.tick(dt, currentWeek);
    }

    const simulated=performance.now();
    metrics.simulationMs+=simulated-started;
    _hudTimer += dt;
    if (_hudTimer > 0.5) { _hudTimer = 0; updateLotHud();
      const selected=engine.agents.find(a=>a.id===_selectedAgentId);
      const label=document.getElementById('lotAgentState');if(label&&selected)label.textContent=selected.kind_str+' · '+selected.state_str+(selected.inside?' · inside facility':' · on campus');
      const task=document.getElementById('lotAgentTask'),needs=document.getElementById('lotAgentNeeds');
      if(task&&selected)task.textContent=selected.life?.task?.label||selected.life?.reason||'Choosing task';
      if(needs&&selected)needs.textContent='Energy '+Math.round(selected.life?.energy||0)+'% · '+(selected.life?.mood||'calm');
    }

    if(document.getElementById('studiolotGlobalStage')?.classList.contains('lot-backdrop')) {
      _animId=requestAnimationFrame(render);return;
    }
    // Clear Canvas
    _ctx.clearRect(0, 0, _logicalWidth, _logicalHeight);

    if (_currentLotView === "campus") renderCampusView(_ctx,dt);
    else global.StudioDepartments.draw(_ctx,engine,_currentLotView,_selectedBuildingId,_logicalWidth,_logicalHeight,_selectedAgentId,reducedMotion(),{x:camera.x-_viewBase.x,y:camera.y-_viewBase.y,zoom:camera.zoom/_viewBase.zoom,viewport:sceneViewport()});

    let debug=document.getElementById('lotSimDebug');
    if(debugMode){
      if(!debug){debug=document.createElement('pre');debug.id='lotSimDebug';_canvas.parentElement.appendChild(debug);}
      const room=global.StudioDepartments.getCurrent();
      const a=engine.agents.find(a=>a.id===_selectedAgentId)||engine.agents.find(a=>_currentLotView==='campus'?!a.inside:a.inside&&a.assigned_building_id===room?.id)||engine.agents[0];
      if(!a){debug.textContent='No agents';_animId=requestAnimationFrame(render);return;}
      const info=engine.life.inspect(a.id),pose=_currentLotView==='campus'?a:global.StudioDepartments.presentation(a,_currentLotView,engine.agents.filter(v=>v.inside&&v.assigned_building_id===a.assigned_building_id)),frame=global.StudioActors.people.get(global.StudioActors.look(a))?.loaded?global.StudioActors.richFrame(pose,reducedMotion()):global.StudioActors.frame(pose,reducedMotion());
      debug.textContent=JSON.stringify({...info,renderPose:{facing:pose.direction,seated:!!pose.renderSeat},path:info.path?.slice(0,12),life:{...info.life,history:info.life.history.slice(-5)},frame,timing:metrics.simulationMs/Math.max(1,metrics.frames)},null,2);
      const visible=_currentLotView==='campus'?!a.inside:a.inside&&a.assigned_building_id===room?.id;
      const path=visible?(a.inside?a.indoor_path:a.path):[];_ctx.strokeStyle='#eaaf65';_ctx.beginPath();for(const [i,p]of(path||[]).entries()){const at=a.inside?global.StudioDepartments.project(p.x,p.y):gridToScreen(p.x+.5,p.y+.5);if(at)i?_ctx.lineTo(at.x,at.y):_ctx.moveTo(at.x,at.y);}_ctx.stroke();
    }else debug?.remove();
    if(!render.rosterTime||engine.life.time-render.rosterTime>=.5){render.rosterTime=engine.life.time;document.querySelectorAll('[data-crew-agent]').forEach(card=>{const a=engine.agents.find(a=>a.id===Number(card.dataset.crewAgent));if(a){card.querySelector('.people-task').textContent=a.life?.task?.label||'Choosing next task';card.querySelector('.people-energy').textContent='Energy '+Math.round(a.life?.energy||0)+'%';}});}
    const drawTime=performance.now()-simulated;
    metrics.frames++;metrics.renderMs+=drawTime;metrics.maxRenderMs=Math.max(metrics.maxRenderMs,drawTime);
    _animId = requestAnimationFrame(render);
  }

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  function tile(ctx,x,y,color,stroke) {
    const p=gridToScreen(x,y), w=32*camera.zoom,h=16*camera.zoom;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+w,p.y+h);
    ctx.lineTo(p.x,p.y+2*h);ctx.lineTo(p.x-w,p.y+h);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }
  function buildingBounds(b) {
    const p=gridToScreen(b.grid_x+b.span_w/2,b.grid_y+b.span_h/2);
    const w=(b.span_w+b.span_h)*24*camera.zoom,h=w*.875;
    return {x:p.x-w/2,y:p.y-h+16*camera.zoom,w,h};
  }
  function paintFacility(ctx,b) {
    const r=buildingBounds(b), z=camera.zoom;
    const colors={soundstage:'#456574',virtual_led:'#426a76',post_suite:'#767295',writers_bungalow:'#b28b60',cinema_theater:'#a96058',executive:'#697c8b',studio_gate:'#8e927e'};
    const asset=spriteCache[b.b_type];
    if(asset?.loaded) {
      ctx.imageSmoothingEnabled=false;ctx.drawImage(asset.img,r.x,r.y,r.w,r.h);
    } else {
      ctx.fillStyle='#26353c';ctx.fillRect(r.x+4*z,r.y+8*z,r.w,r.h);
      ctx.fillStyle=colors[b.b_type]||'#647c71';ctx.fillRect(r.x,r.y,r.w,r.h-5*z);
      ctx.fillStyle='#d5c9aa';ctx.fillRect(r.x,r.y,r.w,8*z);
      ctx.fillStyle='#26353c';ctx.fillRect(r.x+r.w/2-6*z,r.y+r.h-25*z,12*z,20*z);
    }
    if(_selectedBuildingId===b.id){ctx.strokeStyle='#ffe1a0';ctx.lineWidth=2;ctx.strokeRect(r.x-3,r.y-3,r.w+6,r.h+6);}
    if(z<.38&&_selectedBuildingId!==b.id)return; // overview labels must not dwarf their buildings
    ctx.font='600 '+Math.max(10,12*z)+'px system-ui';ctx.textAlign='center';
    const label=b.b_type.replaceAll('_',' '),tw=ctx.measureText(label).width;
    ctx.fillStyle='#19292f';ctx.fillRect(r.x+r.w/2-tw/2-5,r.y-18,tw+10,17);
    ctx.fillStyle='#f3ead7';ctx.fillText(label,r.x+r.w/2,r.y-5);ctx.textAlign='left';
  }
  // Original procedural pixel actor: feet are anchored to engine coordinates.
  // Walk cycle is distance-driven; job cycle is elapsed-time driven, never frame-driven.
  function paintAgent(ctx,a) {
    const visual=global.StudioActors.position(a,global.StudioLotBridge.getEngine().alpha),p=gridToScreen(visual.x,visual.y);
    return global.StudioActors.draw(ctx,a,p.x,p.y,camera.zoom,_selectedAgentId===a.id,reducedMotion());
  }
  function renderCampusView(ctx, dt) {
    const engine=global.StudioLotBridge.getEngine(), lot=engine;
    ctx.fillStyle='#182c32';ctx.fillRect(0,0,_logicalWidth,_logicalHeight);
    if(_terrainEngine!==engine||_terrainRevision!==engine.revision){
      if(!_terrain)_terrain=document.createElement('canvas');
      _terrain.width=(lot.cols+lot.rows)*32+64;_terrain.height=(lot.cols+lot.rows)*16+32;
      const c=_terrain.getContext('2d'),tiles=engine.get_tiles_flat(),origin=lot.rows*32;
      for(let y=0;y<lot.rows;y++)for(let x=0;x<lot.cols;x++){
        const sx=(x-y)*32+origin,sy=(x+y)*16;
        c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+32,sy+16);c.lineTo(sx,sy+32);c.lineTo(sx-32,sy+16);c.closePath();
        const kind=tiles[y*lot.cols+x];
        c.fillStyle=[(x*7+y*13)%3?'#6e8d71':'#748f73','#c6bea3','#d1c3a1','#7c8e87','#578c99'][kind];c.fill();c.strokeStyle=kind===0?'#718c70':'#a9ab95';c.lineWidth=.5;c.stroke();
        if(kind===0){c.fillStyle='#8ba17b';const n=(x*17+y*29)%19;c.fillRect(sx-8+n,sy+14,2,2);c.fillStyle='#5c7b64';c.fillRect(sx+8-n,sy+20,3,1);}

      }
      _terrainEngine=engine;_terrainRevision=engine.revision;
    }
    ctx.imageSmoothingEnabled=false;
    for(let y=-2;y<lot.rows+2;y++)for(let x=-2;x<lot.cols+2;x++)if(x<0||y<0||x>=lot.cols||y>=lot.rows)tile(ctx,x,y,'#49695b');
    // Visitor/production parking lies outside the playable build/navigation grid.
    for(let y=7;y<14;y++)for(let x=-4;x<0;x++)tile(ctx,x,y,'#5f7579');
    for(const y of [8,11]){
      for(const x of [-4,-3,-2])tile(ctx,x,y,'#6f8587','#a4b2ad');
      const p=gridToScreen(-3.1,y+.35);ctx.fillStyle='#cbd0ba';ctx.font=Math.max(8,9*camera.zoom)+'px system-ui';ctx.fillText(y===8?'PRODUCTION':'VISITOR',p.x-35*camera.zoom,p.y+28*camera.zoom);
    }
    // Raised campus foundation; the surrounding landscaping is outside the playable grid.
    const edges=[gridToScreen(0,lot.rows),gridToScreen(lot.cols,lot.rows),gridToScreen(lot.cols,0)];
    ctx.beginPath();edges.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));for(const p of [...edges].reverse())ctx.lineTo(p.x,p.y+10*camera.zoom);ctx.closePath();ctx.fillStyle='#3b5556';ctx.fill();
    ctx.drawImage(_terrain,camera.x-lot.rows*32*camera.zoom,camera.y,_terrain.width*camera.zoom,_terrain.height*camera.zoom);

    const objects=[...lot.buildings.map(b=>({depth:b.grid_x+b.grid_y+b.span_w+b.span_h, b})),...lot.agents.filter(a=>!a.inside).map(a=>({depth:a.x+a.y,a}))];
    for(const [x,y,key]of [[-1,2,'palm'],[-1,18,'palm'],[4,-1,'palm'],[10,-1,'palm'],[lot.cols-3,-1,'palm'],[lot.cols+.6,5,'shrub'],[5,lot.rows+.6,'shrub'],[-3,8.5,'studio_van'],[-3,11.5,'studio_car']])objects.push({depth:x+y,prop:{x,y,key}});
    objects.sort((a,b)=>a.depth-b.depth);
    for(const o of objects){
      if(o.b)paintFacility(ctx,o.b);else if(o.a)paintAgent(ctx,o.a);else{const a=spriteCache[o.prop.key];if(a?.loaded){const p=gridToScreen(o.prop.x,o.prop.y),w=({palm:72,shrub:42,studio_van:72,studio_car:60}[o.prop.key]||42)*camera.zoom,h=w*a.img.height/a.img.width;ctx.drawImage(a.img,p.x-w/2,p.y-h,w,h);}}
    }

    if(_buildModeType && _hoveredGridPos){
      const {x,y}=_hoveredGridPos, valid=engine.can_place(_buildModeType,x,y);
      const span=_buildModeType==='soundstage'||_buildModeType==='virtual_led'?3:2;
      for(let r=y;r<y+span;r++)for(let c=x;c<x+span;c++)tile(ctx,c,r,valid?'#75bb91':'#c16d65','#f7ead1');
    }
  }

  function zoomAt(factor,x=_logicalWidth/2,y=_logicalHeight/2) {
    const old=camera.zoom;camera.zoom=clamp(old*factor,0.25,2.5);
    camera.x=x-(x-camera.x)*camera.zoom/old;camera.y=y-(y-camera.y)*camera.zoom/old;
  }
  function activate(x,y,pointerType="mouse") {
    if(_currentLotView!=="campus") {
      const hit=global.StudioDepartments.hit(x,y);
      _selectedAgentId=hit?.id||null;renderInspector();return;
    }
    const engine=global.StudioLotBridge.getEngine(),g=career();
    if(_buildModeType){
      const pos=screenToGrid(x,y),cost=costs[_buildModeType];
      if(!engine.can_place(_buildModeType,pos.x,pos.y)) return feedback('Blocked site. Choose clear ground and keep entrances open.');
      if(!g?.studio || g.studio.cash<cost) return feedback('Not enough cash. This facility costs $'+cost+'M.');
      if(pointerType==='touch' && (!_touchSite||_touchSite.x!==pos.x||_touchSite.y!==pos.y)){
        _touchSite=pos;_hoveredGridPos=pos;feedback('Site valid. Tap this site again to confirm $'+cost+'M construction, or choose another site.');return;
      }
      const result=global.StudioLotBridge.placeBuilding(_buildModeType,pos.x,pos.y);
      if(!result.ok)return feedback('Construction unavailable at this site.');
      if(typeof spend==='function')spend('facilities',cost);else g.studio.cash-=cost;
      if(typeof log === 'function') log('Constructed '+_buildModeType.replaceAll('_',' ')+' for $'+cost+'M.','gold');
      _selectedBuildingId=result.id;_selectedAgentId=null;
      cancelConstruction();persistLot();renderInspector();feedback('Facility constructed. Select it for management.');return;
    }
    const agents=engine.agents.filter(a=>!a.inside);
    const objects=[...engine.buildings.map(b=>({b,depth:b.grid_x+b.grid_y+b.span_w+b.span_h})),...agents.map(a=>({a,depth:a.x+a.y}))].sort((a,b)=>b.depth-a.depth);
    let chosen=null;
    for(const object of objects){
      if(object.b){const r=buildingBounds(object.b);if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h){chosen=object;break;}}
      else {const visual=global.StudioActors.position(object.a,engine.alpha),p=gridToScreen(visual.x,visual.y),size=Math.max(.12,camera.zoom);if(Math.abs(x-p.x)<13*size&&y>p.y-32*size&&y<p.y+3){chosen=object;break;}}
    }
    // Generous touch fallback only on empty ground, never through a visible facility.
    if(!chosen){const a=agents.find(a=>{const visual=global.StudioActors.position(a,engine.alpha),p=gridToScreen(visual.x,visual.y);return Math.abs(x-p.x)<22&&y>p.y-40&&y<p.y+4;});if(a)chosen={a};}
    _selectedAgentId=chosen?.a?.id||null;_selectedBuildingId=chosen?.b?.id||null;
    renderInspector();
  }
  function setupEvents() {
    if(_events)_events.abort();_events=new AbortController();const signal=_events.signal;
    const pointers=new Map();let start=null,moved=false,lastDistance=0;
    const local=e=>{const r=_canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*_logicalWidth/r.width,y:(e.clientY-r.top)*_logicalHeight/r.height};};
    _canvas.style.touchAction='none';
    _canvas.addEventListener('pointerdown',e=>{const p=local(e);_hoveredGridPos=screenToGrid(p.x,p.y);pointers.set(e.pointerId,p);_canvas.setPointerCapture(e.pointerId);start=p;moved=false;if(pointers.size>1){moved=true;const v=[...pointers.values()];lastDistance=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);}}, {signal});
    _canvas.addEventListener('pointermove',e=>{const p=local(e);_hoveredGridPos=screenToGrid(p.x,p.y);const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,p);
      if(pointers.size===2){moved=true;const v=[...pointers.values()],d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(lastDistance)zoomAt(d/lastDistance,(v[0].x+v[1].x)/2,(v[0].y+v[1].y)/2);lastDistance=d;}
      else if(start && (moved||Math.hypot(p.x-start.x,p.y-start.y)>7)){moved=true;camera.x+=p.x-prev.x;camera.y+=p.y-prev.y;camera.x=clamp(camera.x,-1600, _logicalWidth+1600);camera.y=clamp(camera.y,-1000,_logicalHeight+1000);}}, {signal});
    _canvas.addEventListener('pointerup',e=>{const p=local(e);pointers.delete(e.pointerId);if(!moved && start)activate(p.x,p.y,e.pointerType);if(!pointers.size){start=null;lastDistance=0;}}, {signal});
    _canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);start=null;moved=true;lastDistance=0;}, {signal});
    _canvas.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);zoomAt(e.deltaY<0?1.1:1/1.1,p.x,p.y);},{passive:false,signal});
    window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||document.getElementById('studiolotGlobalStage')?.classList.contains('lot-backdrop')||e.target?.matches?.('input,textarea,select,[contenteditable]'))return;
      if(e.code==='F8'){debugMode=!debugMode;e.preventDefault();}
      if(e.key==='Escape'){const stage=document.getElementById('studiolotGlobalStage');if(stage?.classList.contains('lot-immersive')){stage.classList.remove('lot-immersive');document.getElementById('btnLotFullscreen').textContent='Expand';resizeCanvas();}cancelConstruction();_selectedAgentId=null;_selectedBuildingId=null;renderInspector();feedback('Selection cancelled.');}
      if(e.key==='0')centerCamera();if(e.key==='+'||e.key==='=')zoomAt(1.15);if(e.key==='-')zoomAt(1/1.15);
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();camera.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;camera.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;}
    },{signal});
    document.addEventListener('visibilitychange',()=>{_lastTime=0;_qualityLast=0;},{signal});
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
    const stage=document.getElementById('studiolotGlobalStage');
    if(stage&&!stage.classList.contains('lot-backdrop')){
      const bottom=Math.ceil(Math.max(0,document.getElementById('tabsNav')?.getBoundingClientRect().bottom||0,document.querySelector('.topbar')?.getBoundingClientRect().bottom||0));
      const value=bottom+'px';if(bottom&&stage.style.getPropertyValue('--lot-header-height')!==value)stage.style.setProperty('--lot-header-height',value);
    }
    if(stage){
      const toolbar=parent.querySelector('.kairo-top-bar')?.getBoundingClientRect().height||60;
      const deck=parent.querySelector('.kairo-bottom-deck')?.getBoundingClientRect().height||60;
      stage.style.setProperty('--lot-toolbar-height',Math.ceil(toolbar)+'px');stage.style.setProperty('--lot-deck-height',Math.ceil(deck)+'px');
    }
    const rect = parent.getBoundingClientRect();
    if((!rect.width||!rect.height)&&_logicalWidth&&_logicalHeight)return;
    const w = Math.round(rect.width) || window.innerWidth;
    let h = Math.round(rect.height);
    if (!h || h < 100) {
      h = window.innerHeight < 600 ? Math.max(220, window.innerHeight - 76) : 560;
    }
    const changed = _logicalWidth !== w || _logicalHeight !== h;
    _logicalWidth = w; _logicalHeight = h;
    const dpr = _battery ? 1 : Math.min(_qualityMode==='auto'?_adaptiveDpr:2, window.devicePixelRatio || 1);
    const bw=Math.round(w*dpr), bh=Math.round(h*dpr);
    if (_canvas.width !== bw || _canvas.height !== bh) { _canvas.width=bw; _canvas.height=bh; }
    if (_ctx) _ctx.setTransform(dpr,0,0,dpr,0,0);
    if (changed) centerCamera();
    if (_ctx) {
      _ctx.imageSmoothingEnabled = false;
    }
  }

  function updateLotHud() {
    updateStoryPanel();
    const clock=global.StudioLotBridge.clock;
    const pause=document.getElementById('lotPause'),speed=document.getElementById('lotSpeed');
    if(pause){const text=clock.paused?'Resume':'Pause';if(pause.textContent!==text)pause.textContent=text;pause.setAttribute('aria-pressed',String(clock.paused));}
    if(speed&&speed.textContent!==clock.speed+'×')speed.textContent=clock.speed+'×';
    const G = career();
    if (!G) return;
    const elName = document.getElementById("lotHudStudioName");
    const elCash = document.getElementById("lotHudCash");
    const elDate = document.getElementById("lotHudDate");
    const elStages = document.getElementById("lotHudStages");
    const debt = document.getElementById("lotHudDebt"), rep = document.getElementById("lotHudRep");
    if(debt) debt.textContent = '$'+(G.studio.debt||0).toFixed(1)+'M';
    if(rep) rep.textContent = Math.round(G.studio.rep||0);

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
      elStages.textContent = activeShoots + " active";
    }
  }

  function updateStoryPanel() {
    const card=document.querySelector('#lotInspectorRoot .lot-project-card');
    if(!card||_currentLotView!=='writers')return;
    const engine=global.StudioLotBridge.getEngine(),a=engine.agents.find(a=>a.id===_selectedAgentId);
    const room=global.StudioDepartments.select(engine,'writers',a?.assigned_building_id||_selectedBuildingId);
    const pct=Math.max(0,Math.min(100,Math.round((room?.progress||0)*100)));
    const key=[room?.id,room?.active_title,pct].join('|');if(card.dataset.key===key)return;card.dataset.key=key;
    card.innerHTML=room?.active_title?'<span class="lot-project-label">CURRENT PRODUCTION</span><strong>'+esc(room.active_title)+'</strong><div class="lot-project-meta">Script development <span>'+pct+'%</span></div><div class="lot-project-progress" role="progressbar" aria-label="Production phase progress" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+pct+'%"></i></div>':'<span class="lot-project-label">PRODUCTION</span><strong>Ready for the next story</strong><p>Develop a script and assign a production through Slate.</p>';
  }

  function cancelConstruction() {
    _buildModeType=null;_touchSite=null;_hoveredGridPos=null;
    const root=document.getElementById('lotPaletteRoot');if(root)root.style.display='none';
    const button=document.getElementById('btnTogglePalette');
    if(button){button.textContent='Build Facility';button.setAttribute('aria-expanded','false');}
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
        setLotView("campus");
        _touchSite=null;_hoveredGridPos=null;
        _buildModeType = btn.dataset.btype;
        _selectedAgentId=null;_selectedBuildingId=null;renderInspector();
        // The open palette covered almost the entire fitted campus on landscape phones.
        root.style.display='none';
        const toggle=document.getElementById('btnTogglePalette');
        toggle.textContent='Cancel build';toggle.setAttribute('aria-expanded','false');
        feedback('Choose clear ground for $'+costs[_buildModeType]+'M. Touch: tap a site twice to confirm. Cancel build or Escape cancels.');
        if (typeof beep === "function") beep("click");
      });
    });

    const btnClose = document.getElementById("btnClosePalette");
    if (btnClose) {
      btnClose.addEventListener("click", () => {
        cancelConstruction();
        feedback('Construction cancelled.');
      });
    }
  }

  function openInteriors(roomId) {
    const g=career(),engine=global.StudioLotBridge.getEngine(),departments=global.StudioDepartments;
    const views={soundstage:'soundstage',virtual_led:'soundstage',writers_bungalow:'writers',post_suite:'post',cinema_theater:'cinema',executive:'executive'};
    const rooms=engine.buildings.filter(b=>views[b.b_type]);
    if(!g||!rooms.length||typeof global.openModal!=='function')return feedback('No room interiors are available.');
    cancelConstruction();
    const room=roomId!=null?rooms.find(b=>b.id===Number(roomId)):_currentLotView==='campus'?null:departments.select(engine,_currentLotView,_selectedBuildingId);
    if(!room){
      global.openModal(`<section class="lot-interior-picker"><h2>Choose a room to customise</h2><p>Every room has its own saved interior. Changing one never changes another.</p><div class="interior-room-grid">${rooms.map(b=>`<button class="interior-room-card" data-interior-room="${b.id}"><strong>${esc(b.name)}</strong><span>${esc(departments.interiorOptions.style[departments.interiorSettings(g,b.id).style])}</span><span>Customise this room →</span></button>`).join('')}</div></section>`);
      document.querySelectorAll('[data-interior-room]').forEach(button=>button.onclick=()=>openInteriors(Number(button.dataset.interiorRoom)));
    }else{
      const settings=departments.interiorSettings(g,room.id);
      global.openModal(`<section class="lot-interiors" data-room-id="${room.id}"><div class="interior-editor-heading"><div><h2>${esc(room.name)} · Interior</h2><p>Only this room changes · Free cosmetic choices</p></div><button id="interiorRooms" class="btn btn-alt">Other rooms</button></div><div class="interior-fields">${Object.entries(departments.interiorOptions).map(([key,values])=>`<label>${{style:'Wall & trim palette',floor:'Flooring',seating:'Chair & theatre upholstery',decor:'Decorations'}[key]}<select id="interior-${key}">${Object.entries(values).map(([value,label])=>`<option value="${value}" ${settings[key]===value?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`).join('')}</div><p id="interiorHint" role="status">Choose finishes, then Save this room. Nothing changes until you save.</p><div class="interior-actions"><button id="interiorApply" class="btn btn-primary">Save this room · Free</button><button id="interiorReset" class="btn btn-alt">Restore this room</button><button id="interiorCancel" class="btn btn-ghost">Cancel</button></div></section>`);
      const apply=reset=>{
        if(!engine.buildings.some(b=>b.id===room.id))return feedback('This room is no longer available.');
        const next=Object.fromEntries(Object.keys(departments.interiorOptions).map(key=>[key,reset?'original':document.getElementById('interior-'+key).value]));
        if(!departments.setInteriorSettings(g,[room.id],next))return feedback('Interior settings are unavailable.');
        global.closeModal();persistLot();_selectedBuildingId=room.id;_selectedAgentId=null;setLotView(views[room.b_type]);
        // Keep the changed room unobscured, rather than opening an inspector over it.
        const panel=document.getElementById('lotInspectorRoot');if(panel)panel.style.display='none';
        feedback(room.name+' · '+(reset?'Original interior restored':'Interior saved')+' · Other rooms unchanged · No cash charged.');
      };
      document.getElementById('interiorApply').onclick=()=>apply(false);
      document.getElementById('interiorReset').onclick=()=>apply(true);
      document.getElementById('interiorCancel').onclick=()=>global.closeModal();
      document.getElementById('interiorRooms').onclick=()=>openInteriors('picker');
      for(const key of Object.keys(departments.interiorOptions))document.getElementById('interior-'+key).onchange=()=>{document.getElementById('interiorHint').textContent='Unsaved choices for '+room.name+' · Save this room to apply.';};
    }
    const heading=document.querySelector('.modal:has(.lot-interiors) .modal-head>div, .modal:has(.lot-interior-picker) .modal-head>div');if(heading)heading.textContent='ROOM INTERIORS · INDIVIDUAL ROOMS';
  }

  function openCastHiring() {
    const g=career();if(!g||typeof global.signContract!=='function')return feedback('Contracts are unavailable.');
    const hired=t=>!!(t.contract||t.multiDeal||(g.talentPacts?.activeContracts||[]).some(c=>String(c.talentId)===String(t.id)));
    global.openModal(`<section class="lot-hiring"><div class="hiring-heading"><h2>Cast & contracts</h2><button id="hiringPeople" class="btn btn-alt">Back to People</button></div><p>Sign available talent to your studio. Signing costs are shown below; project fees still apply. Hires appear immediately in People.</p><div class="hiring-filters"><label>Role<select id="hiringRole"><option value="actor">Actors / cast</option><option value="director">Directors</option><option value="writer">Writers</option><option value="producer">Producers</option><option value="all">All roles</option></select></label><label>Find talent<input id="hiringSearch" type="search" placeholder="Search by name"></label><label>Contract<select id="hiringDeal">${global.contractDefs().filter(d=>['multi','exclusive'].includes(d.id)).map(d=>`<option value="${d.id}">${esc(d.name)} · $${d.cost}M signing</option>`).join('')}</select></label></div><p id="hiringStatus" role="status">Choose a cast member to hire.</p><div class="hiring-columns"><section><h3>Available to hire <span id="hiringCount"></span></h3><div id="hiringAvailable" class="hiring-list"></div></section><section><h3>Your signed talent <span id="hiredCount"></span></h3><div id="hiringRoster" class="hiring-list"></div></section></div></section>`);
    const render=()=>{
      const role=document.getElementById('hiringRole').value,query=document.getElementById('hiringSearch').value.trim().toLowerCase(),deal=global.contractDefs().find(d=>d.id===document.getElementById('hiringDeal').value);
      const signed=(g.talent||[]).filter(hired),available=(g.talent||[]).filter(t=>['actor','director','writer','producer'].includes(t.kind)&&!hired(t)&&!t.retired&&t.unlocked!==false&&!(t.bookedUntil>g.week)&&(role==='all'||t.kind===role)&&t.name.toLowerCase().includes(query));
      document.getElementById('hiringCount').textContent='('+available.length+')';document.getElementById('hiredCount').textContent='('+signed.length+')';
      const card=(t,signed)=>`<article class="hiring-card" ${signed?'data-hired-talent':'data-available-talent'}="${t.id}"><div><strong>${esc(t.name)}</strong><span>${esc(t.kind)} · Skill ${Math.round(t.skill||0)} · ${Math.round(t.power||0)}/5 stars</span><span>${signed?esc(t.contract?.type||'Multi-picture')+' contract':esc(deal.desc)}</span><span>List fee: $${Math.round((t.fee||0)*10)/10}M per project</span></div>${signed?'<b>Signed</b>':`<button class="btn btn-primary" data-hire-talent="${t.id}">Hire · $${deal.cost}M</button>`}</article>`;
      document.getElementById('hiringAvailable').innerHTML=available.map(t=>card(t,false)).join('')||'<p>No available talent matches. Try another role or search.</p>';
      document.getElementById('hiringRoster').innerHTML=signed.map(t=>card(t,true)).join('')||'<p>No signed cast yet. Your first hire will appear here.</p>';
      document.querySelectorAll('[data-hire-talent]').forEach(button=>button.onclick=()=>{
        const t=g.talent.find(t=>String(t.id)===button.dataset.hireTalent),type=document.getElementById('hiringDeal').value,def=global.contractDefs().find(d=>d.id===type),status=document.getElementById('hiringStatus');
        if(!t||hired(t)||t.retired||t.bookedUntil>g.week)return status.textContent='This talent is no longer available.';
        if(g.studio.cash<def.cost)return status.textContent='Not enough cash. Signing requires $'+def.cost+'M.';
        button.disabled=true;
        if(!global.signContract(t.id,type)){button.disabled=false;return status.textContent='Contract could not be signed. No hire was added.';}
        global.StudioLotBridge.syncWithGameState(g);persistLot();render();status.textContent=t.name+' hired · Added to your signed talent and People · Saved.';
      });
    };
    document.getElementById('hiringRole').onchange=render;document.getElementById('hiringSearch').oninput=render;document.getElementById('hiringDeal').onchange=render;
    document.getElementById('hiringPeople').onclick=openPeople;render();
    const heading=document.querySelector('.modal:has(.lot-hiring) .modal-head>div');if(heading)heading.textContent='STUDIO / HIRE & CONTRACTS';
  }

  function openPeople() {
    if(typeof global.openModal!=='function')return feedback('People panel is unavailable.');
    const engine=global.StudioLotBridge.getEngine(),crew=engine.agents.filter(a=>a.kind_str!=='audience');
    global.openModal(`<section class="lot-people"><div class="people-eyebrow">STUDIO PERSONNEL / LIVE ROSTER</div><h2>Your people</h2><p class="people-intro">${crew.length} people · Persistent identities, real departments and current tasks. Select a person to find them on the lot.</p><div class="people-grid">${crew.map(a=>{const b=engine.buildings.find(b=>b.id===a.assigned_building_id);return `<button class="people-card" data-crew-agent="${a.id}"><span class="people-portrait" style="${global.StudioActors.portrait(a)}" aria-hidden="true"></span><span class="people-details"><strong>${esc(a.name)}</strong><span class="people-role">${esc(a.job_title||a.specialty||a.kind_str.replaceAll('_',' '))}</span><span class="people-room">${esc(b?.name||'On campus')}</span><span class="people-task">${esc(a.life?.task?.label||'Arriving at the studio')}</span><span class="people-energy">Energy ${Math.round(a.life?.energy||0)}%</span></span><span class="people-locate" aria-hidden="true">↗</span></button>`;}).join('')}</div><div class="people-footer"><button id="peopleTalent" class="btn btn-primary">Hire & contracts</button><button id="peopleCredits" class="btn btn-alt">Character art credits</button><span>Portraits match the people in your rooms.</span></div></section>`);
    const heading=document.querySelector('.modal:has(.lot-people) .modal-head>div');if(heading)heading.textContent='STUDIO PERSONNEL';
    document.querySelectorAll('[data-crew-agent]').forEach(button=>button.onclick=()=>{
      const a=engine.agents.find(a=>a.id===Number(button.dataset.crewAgent));if(!a)return;
      const b=engine.buildings.find(b=>b.id===a.assigned_building_id),views={soundstage:'soundstage',virtual_led:'soundstage',writers_bungalow:'writers',post_suite:'post',executive:'executive',cinema_theater:'cinema'};
      global.closeModal();setLotView(a.inside?(views[b?.b_type]||'campus'):'campus');_selectedAgentId=a.id;_selectedBuildingId=b?.id||null;renderInspector();
    });
    document.getElementById('peopleTalent').onclick=openCastHiring;
    document.getElementById('peopleCredits').onclick=()=>global.openModal(`<section class="lot-people"><div class="people-eyebrow">ART / ATTRIBUTION</div><h2>LPC Revised character art</h2><p>Artwork by Stephen Challener (Redshrike), Eliza Wyatt (DeathsDarling), Durrani, Benjamin K. Smith (BenCreating), Johannes Sjölund (Wulax), bluecarrot16 and Thecilekli.</p><p>Licensed under OGA-BY 3.0. Modified here by compositing clothing, hair and skin layers, cropping animations, and making portraits and tool overlays.</p><p>Discovered through the LPC Character Generator on itch.io; artwork imported from the artist-maintained LPC Revised repository, not from the generator executable.</p><p><a href="https://pflat.itch.io/lpc-character-generator" target="_blank" rel="noopener">itch.io discovery</a> · <a href="https://github.com/ElizaWy/LPC" target="_blank" rel="noopener">Original artwork</a> · <a href="assets/vendor/lpc-revised/NOTICE.md" target="_blank" rel="noopener">Bundled credits & source details</a></p></section>`);
  }

  function renderInspector() {
    const root = document.getElementById("lotInspectorRoot");
    if (!root) return;
    const wasOpen=root.style.display!=='none';
    const engine=global.StudioLotBridge.getEngine();
    const a=engine.agents.find(a=>a.id===_selectedAgentId),b=engine.buildings.find(b=>b.id===_selectedBuildingId);
    if(!a&&!b){root.style.display='none';if(wasOpen&&_currentLotView==='campus')centerCamera();return;}
    root.style.display='block';
    const views={soundstage:'soundstage',virtual_led:'soundstage',post_suite:'post',writers_bungalow:'writers',cinema_theater:'cinema',executive:'executive'};
    if(a){
      root.innerHTML=`<section class="lot-inspector"><div class="people-inspector-head"><span class="people-portrait" style="${global.StudioActors.portrait(a)}" aria-hidden="true"></span><div><strong>${esc(a.name)}</strong><span class="people-role">${esc(a.job_title||a.specialty||a.kind_str.replaceAll('_',' '))}</span></div></div><p id="lotAgentTask">${esc(a.life?.task?.label||a.life?.reason||'Choosing task')}</p><p id="lotAgentNeeds">Energy ${Math.round(a.life?.energy||0)}% · ${esc(a.life?.mood||'calm')}</p><p id="lotAgentState">${esc(a.kind_str)} · ${esc(a.state_str)}</p><p>${esc(a.economic_assignment|| (a.talent_id!=null ? "Contracted talent · available" : "Studio operations crew"))}</p><label>Assignment<select id="lotAssignment">${engine.buildings.filter(b=>b.b_type!=='studio_gate').map(b=>`<option value="${b.id}" ${b.id===a.assigned_building_id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label><button id="lotAssign">Assign destination</button><button id="lotContract">Talent & contracts</button><button id="lotClose">Close</button></section>`;
      root.querySelector('#lotContract').onclick=()=>{if(a.talent_id!=null&&typeof talentModal==='function')talentModal(a.talent_id);else if(typeof switchTab==='function')switchTab('develop');};
      root.querySelector('#lotAssign').onclick=()=>{const id=Number(root.querySelector('select').value);feedback(engine.assign_agent(a.id,id)?'Employee routed to facility entrance.':'No accessible route to this facility.');persistLot();renderInspector();};
    }else{
      const definition=global.FacilitiesModule?.FACILITY_TYPES?.[b.b_type];
      const equipment=career()?.facilities?.[b.b_type]?.tier||0;
      const price=definition?definition.baseCost*(equipment+1):0;
      root.innerHTML=`<section class="lot-inspector"><strong>${esc(b.name)}</strong><p>${esc(b.active_title||'Available')} · ${b.span_w}×${b.span_h} campus tiles</p><p>${definition?'Equipment tier '+equipment+'/'+definition.maxTier:'Studio operations facility'}</p><p>${b.active_project_id?esc(b.active_phase)+' · '+Math.round(b.progress*100)+'%':'Assign productions through Slate.'}</p><button id="lotVisit">Visit department</button>${definition?`<button id="lotEquipment" ${equipment>=definition.maxTier?'disabled':''}>Upgrade equipment · $${price}M</button>`:''}${views[b.b_type]?'<button id="lotInterior">Customise this interior</button>':''}<button id="lotUpgrade">Facilities management</button><button id="lotClose">Close</button></section>`;
      root.querySelector('#lotVisit').onclick=()=>{setLotView(views[b.b_type]||'executive');feedback('Department view. Return to Campus to manage the layout.');};
      const upgrade=root.querySelector('#lotEquipment');
      if(upgrade)upgrade.onclick=()=>{const result=global.upgradeFacility(b.b_type,career());if(!result.ok)return feedback(result.error);global.StudioLotBridge.syncWithGameState(career());persistLot();renderInspector();feedback('Equipment upgraded to tier '+result.tier+' for $'+result.cost+'M.');};
      const interiorButton=root.querySelector('#lotInterior');if(interiorButton)interiorButton.onclick=()=>openInteriors(b.id);
      root.querySelector('#lotUpgrade').onclick=()=>{if(typeof openStudioFacilitiesModal==='function')openStudioFacilitiesModal();else feedback('Facility management is unavailable.');};
    }
    if(_currentLotView==='writers'){
      const section=root.querySelector('.lot-inspector');
      section.insertAdjacentHTML('afterbegin','<div class="lot-inspector-kicker">STORY DEPARTMENT</div>');
      const room=global.StudioDepartments.select(engine,'writers',a?.assigned_building_id||b?.id);
      section.insertAdjacentHTML('beforeend','<div class="lot-project-card"></div>');
      updateStoryPanel();
    }
    if(!wasOpen&&_currentLotView==='campus')centerCamera();
    root.querySelector('#lotClose').onclick=()=>{_selectedBuildingId=null;_selectedAgentId=null;renderInspector();};
  }

  // Public Interface mounted to window
  const StudioLot2D = {
    mount(containerId, initialView, options) {
      const container = document.getElementById(containerId);
      if (!container) return;

      preloadAllAssets();
      global.StudioActors.load();

      const existing=container.querySelector("#studioLotCanvas");
      if (existing && _canvas===existing && _ctx && _animId) {
        if (initialView) setLotView(initialView);
        resizeCanvas();
        updateLotHud();
        return;
      }

      this.unmount();
      _lastTime=0;
      container.innerHTML = `
        <div class="studiolot-viewport">
          
          <!-- Top Kairosoft Control Console (Clean Single Row) -->
          <div class="kairo-top-bar">
            <!-- Room Switcher Tabs Left -->
            <div class="kairo-room-nav">
              <button class="kairo-nav-tab active" data-view="campus"><img class="subtab-pixel-icon" src="assets/studio/studio_gate.png" alt="" /><span>Campus</span></button>
              <button class="kairo-nav-tab" data-view="soundstage"><img class="subtab-pixel-icon" src="assets/studio/soundstage.png" alt="" /><span>Stage</span></button>
              <button class="kairo-nav-tab" data-view="writers"><img class="subtab-pixel-icon" src="assets/studio/writers_bungalow.png" alt="" /><span>Writers</span></button>
              <button class="kairo-nav-tab" data-view="post"><img class="subtab-pixel-icon" src="assets/studio/post_suite.png" alt="" /><span>Post &amp; VFX</span></button>
              <button class="kairo-nav-tab" data-view="cinema"><img class="subtab-pixel-icon" src="assets/studio/cinema_theater.png" alt="" /><span>Cinema</span></button>
              <button class="kairo-nav-tab" data-view="executive"><img class="subtab-pixel-icon" src="assets/studio/executive.png" alt="" /><span>Executive</span></button>
            </div>

            <!-- Studio Telemetry + Stats Toggle + Fullscreen Right -->
            <div class="kairo-top-right">
              <div class="kairo-hud-stats">
                <div class="itch-hud-stat"><span class="lbl">DEBT</span><span id="lotHudDebt" class="val"></span></div>
                <div class="itch-hud-stat"><span class="lbl">REP</span><span id="lotHudRep" class="val"></span></div>
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
              <button id="lotQuality" class="btn btn-alt btn-sm" title="Cycle Auto adaptive resolution, Crisp high resolution, and Battery 30 FPS cap">Quality</button><button id="lotPause" class="btn btn-alt btn-sm">Pause</button><button id="lotSpeed" class="btn btn-alt btn-sm">1×</button>
              <button id="btnLotFullscreen" class="btn btn-alt btn-sm" title="Toggle Fullscreen 2D Lot">Expand</button>
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
              <button id="btnLotInteriors" class="btn btn-alt btn-sm">Room interiors</button>
              <button id="btnTogglePalette" aria-controls="lotPaletteRoot" aria-expanded="false" class="btn btn-alt btn-sm">Build Facility</button>
            </div>

            <!-- Right: Studio Management & Production Actions -->
            <div class="lot-action-dock">
              <button id="btnLotSlate" class="btn btn-alt btn-sm">Slate</button>
              <button id="btnLotTalent" class="btn btn-alt btn-sm" style="color:#6ee7b7;font-weight:bold" title="Find staff, inspect tasks, hire and manage contracts">People</button>
              <button id="btnLotBoxOffice" class="btn btn-alt btn-sm">Box Office</button>
              <button id="btnLotFinance" class="btn btn-alt btn-sm">Finance</button>
              <button id="btnLotDevelop" class="itch-btn-gold" style="cursor:pointer;margin-left:2px">+ Develop</button>
              <button id="btnLotFastWeek" class="itch-btn-blue" style="cursor:pointer">Fast (+4W)</button>
              <button id="btnLotNextWeek" class="itch-btn-blue" style="cursor:pointer;font-weight:bold">Next Week (+1W)</button>
            </div>
          </div>

          <!-- Inspector Drawer Top Right -->
          <div id="lotInspectorRoot" style="position:absolute;top:50px;right:14px;z-index:30;max-width:320px;display:none"></div>

          <div id="lotStatus" role="status" aria-live="polite">Updated interiors: use Stage, Post & VFX, Cinema or Executive tabs above · Drag to pan</div>
          <!-- The Full 2D Game Canvas -->
          <canvas id="studioLotCanvas" tabindex="0" role="application" aria-label="Studio lot. Drag to pan, scroll or pinch to zoom. Select a facility or staff member. Arrow keys pan, Escape cancels." style="display:block;width:100%;height:100%;cursor:grab"></canvas>
        </div>
      `;

      _canvas = document.getElementById("studioLotCanvas");
      _ctx = _canvas ? _canvas.getContext("2d") : null;
      _resizeObserver?.disconnect();
      if (typeof ResizeObserver !== "undefined") { _resizeObserver=new ResizeObserver(resizeCanvas);_resizeObserver.observe(_canvas.parentElement);for(const el of [document.querySelector('.topbar'),document.getElementById('tabsNav')])if(el)_resizeObserver.observe(el); }

      resizeCanvas();
      window.removeEventListener("resize", resizeCanvas);
      window.addEventListener("resize", resizeCanvas);

      if (initialView) {
        setLotView(initialView);
      } else {
        camera.x = _canvas ? _logicalWidth / 2 : 0;
        camera.y = _canvas ? _logicalHeight / 2 : 0;
        camera.zoom = 1.0;
      }

      centerCamera();
      setupEvents();
      renderPalette();

      // Hook control buttons
      const btnNext = document.getElementById("btnLotNextWeek");
      if (btnNext) {
        btnNext.onclick = () => {
          if (typeof window.doWeek === "function") window.doWeek(1);
          else if (typeof window.advanceWeek === "function") window.advanceWeek();
          else if (typeof window.nextWeek === "function") window.nextWeek();
          updateLotHud();
        };
      }

      const btnFast = document.getElementById("btnLotFastWeek");
      if (btnFast) {
        btnFast.onclick = () => {
          if (typeof window.doWeek === "function") window.doWeek(4);
          else if (typeof window.fastWeek === "function") window.fastWeek();
          updateLotHud();
        };
      }

      const btnDev = document.getElementById("btnLotDevelop");
      if (btnDev) {
        btnDev.onclick = () => {
          if (typeof window.switchTab === "function") window.switchTab('develop');
          if(typeof toast==='function')toast('Choose a script in Develop to begin a production.','info');
        };
      }

      document.getElementById('btnLotInteriors').onclick=()=>openInteriors();
      const btnTogglePal = document.getElementById("btnTogglePalette");
      if (btnTogglePal) {
        btnTogglePal.onclick = () => {
          const root = document.getElementById("lotPaletteRoot");
          if (root) {
            if(_buildModeType || root.style.display !== 'none'){
              cancelConstruction();feedback('Construction cancelled.');
            }else{
              root.style.display='block';btnTogglePal.setAttribute('aria-expanded','true');renderPalette();
            }
          }
        };
      }

      const quality=document.getElementById('lotQuality');
      quality.textContent={auto:'Auto',crisp:'Crisp',battery:'Battery'}[_qualityMode];
      quality.onclick=()=>{
        _qualityMode=_qualityMode==='auto'?'crisp':_qualityMode==='crisp'?'battery':'auto';_battery=_qualityMode==='battery';_adaptiveDpr=2;_qualityFrames=0;_qualityElapsed=0;
        quality.textContent={auto:'Auto',crisp:'Crisp',battery:'Battery'}[_qualityMode];
        try{localStorage.setItem('bow_lot_quality',_qualityMode);}catch(e){}
        resizeCanvas();feedback(_battery?'Battery: 30 FPS cap, 1× pixels.':_qualityMode==='crisp'?'Crisp: full pixel resolution, up to 60 FPS.':'Auto: adapts resolution if measured frame cadence is slow.');
      };
      document.getElementById('lotPause').onclick = () => {global.StudioLotBridge.setPaused(!global.StudioLotBridge.clock.paused);updateLotHud();feedback(global.StudioLotBridge.clock.paused?'Paused. Auto-weeks and staff stopped; Next Week still steps manually.':'Simulation resumed.');};
      document.getElementById('lotSpeed').onclick = () => {const speed=global.StudioLotBridge.clock.speed===1?2:global.StudioLotBridge.clock.speed===2?4:1;if(typeof setAutoSpeed==='function')setAutoSpeed(speed);else global.StudioLotBridge.setSpeed(speed);updateLotHud();};
      const btnZoomIn = document.getElementById("btnZoomIn");
      if (btnZoomIn) btnZoomIn.onclick = () => { zoomAt(1.2); };

      const btnZoomOut = document.getElementById("btnZoomOut");
      if (btnZoomOut) btnZoomOut.onclick = () => { zoomAt(1/1.2); };

      const btnReset = document.getElementById("btnResetView");
      if (btnReset) {
        btnReset.onclick = () => {
          centerCamera();
        };
      }

      const btnFocus = document.getElementById("btnFocusShoot");
      if (btnFocus) {
        btnFocus.onclick = () => {
          setLotView("soundstage");
          playViewSting("soundstage");
        };
      }

      const btnFull = document.getElementById("btnLotFullscreen");
      if (btnFull) {
        btnFull.onclick = () => {
          const stage = document.getElementById("studiolotGlobalStage");
          if (stage) {
            stage.classList.toggle("lot-immersive");
            btnFull.textContent=stage.classList.contains("lot-immersive")?"Restore":"Expand";
            resizeCanvas();
          }
        };
      }

      const btnSlate = document.getElementById("btnLotSlate");
      if (btnSlate) btnSlate.onclick = () => { if (typeof window.switchTab === "function") window.switchTab("productions"); };

      const btnTalent = document.getElementById("btnLotTalent");
      if (btnTalent) {
        btnTalent.onclick = () => {
          openPeople();
        };
      }

      const btnBO = document.getElementById("btnLotBoxOffice");
      if (btnBO) btnBO.onclick = () => { if (typeof window.switchTab === "function") window.switchTab("boxoffice"); };

      const btnFin = document.getElementById("btnLotFinance");
      if (btnFin) btnFin.onclick = () => { if (typeof window.switchTab === "function") window.switchTab("finance"); };

      // Room nav tabs
      const roomTabs = container.querySelectorAll(".kairo-nav-tab");
      roomTabs.forEach(tab => {
        tab.setAttribute('aria-label',tab.textContent.trim());
        tab.title=tab.textContent.trim();
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
      _events?.abort(); _resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      if (_animId) {
        cancelAnimationFrame(_animId);
        _animId = null;
      }
      _canvas = null;
      _ctx = null;
    },

    resetSelection() {
      _selectedAgentId=null;_selectedBuildingId=null;_buildModeType=null;_touchSite=null;
      renderInspector();
    },

    setView(viewName) {
      setLotView(viewName);
    },

    diagnostics() {return {...metrics,quality:_qualityMode,pixelRatio:_canvas?_canvas.width/_logicalWidth:0,backend:global.StudioLotBridge.backend,agents:global.StudioLotBridge.getEngine().agents.length};},
    resetDiagnostics() {metrics.frames=0;metrics.renderMs=0;metrics.simulationMs=0;metrics.maxRenderMs=0;},
    boundsForBuilding(id) {
      const b=global.StudioLotBridge.getEngine().buildings.find(b=>b.id===id);
      return b?buildingBounds(b):null;
    },
    project: gridToScreen,
    unproject: screenToGrid,
    getCamera() { return {...camera}; },
    getView() {
      return _currentLotView;
    },

    resize() {
      resizeCanvas();
    },

    focusBuilding(bId) {
      _selectedBuildingId = bId;
      const b=global.StudioLotBridge.getEngine().buildings.find(b=>b.id===bId);
      const view=Object.entries(global.StudioDepartments.types).find(([k,v])=>v.includes(b?.b_type))?.[0]||'campus';
      setLotView(view);
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
