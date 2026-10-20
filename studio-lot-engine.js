/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-LOT-ENGINE.JS — 2D Studio Lot Simulation Engine (Rust/WASM Bridge)
   Box Office War — Modular 2D Engine
   Zero Emojis Policy strictly enforced.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  // Module state
  let _wasmCore = null;
  let _wasmInstance = null;
  let _isWasmReady = false;

  // In-memory JavaScript mirror engine (provides 100% parity & offline fallback)
  class JSLotEngineFallback {
    constructor(cols, rows) {
      this.cols = cols || 24;
      this.rows = rows || 24;
      this.current_week = 1;
      this.total_tickets_sold = 0;
      this.box_office_buzz = 1.0;
      this.next_id = 1;
      this.buildings = [];
      this.agents = [];
      this.tiles = new Uint8Array(this.cols * this.rows); // 0=Grass, 1=Road, 2=Plaza, 3=ConcretePad, 4=Water

      this.initStarterGrid();
      this.initStarterStudio();
    }

    initStarterGrid() {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const idx = r * this.cols + c;
          if (c === Math.floor(this.cols / 2) || c === Math.floor(this.cols / 2) - 1) {
            this.tiles[idx] = 1; // Road
          } else if (r === Math.floor(this.rows / 2) || r === Math.floor(this.rows / 2) - 1) {
            this.tiles[idx] = 1; // Road
          } else if (r === 2 || r === this.rows - 3 || c === 2 || c === this.cols - 3) {
            this.tiles[idx] = 1; // Perimeter road
          } else if (c >= Math.floor(this.cols / 2) - 3 && c <= Math.floor(this.cols / 2) + 2 &&
                     r >= Math.floor(this.rows / 2) - 3 && r <= Math.floor(this.rows / 2) + 2) {
            if ((c === Math.floor(this.cols / 2) || c === Math.floor(this.cols / 2) - 1) &&
                (r === Math.floor(this.rows / 2) || r === Math.floor(this.rows / 2) - 1)) {
              this.tiles[idx] = 4; // Water fountain
            } else {
              this.tiles[idx] = 2; // Plaza
            }
          } else {
            this.tiles[idx] = 0; // Grass
          }
        }
      }
    }

    initStarterStudio() {
      this.place_building("studio_gate", Math.floor(this.cols / 2) - 1, this.rows - 2);
      this.place_building("executive", Math.floor(this.cols / 2) + 2, this.rows - 5);
      this.place_building("soundstage", 4, 4);
      this.place_building("post_suite", 4, 10);
      this.place_building("cinema_theater", this.cols - 6, 4);
      this.place_building("writers_bungalow", this.cols - 5, 12);

      this.spawn_agent("director", "Stanley Kubrick", 7.0, 7.0, 3);
      this.spawn_agent("cameraman", "Cinematographer", 6.0, 7.0, 3);
      this.spawn_agent("star_actor", "Leading Star", 8.0, 7.0, 3);
      this.spawn_agent("producer", "Executive Producer", Math.floor(this.cols / 2), this.rows - 4, 2);
    }

    place_building(typeStr, x, y) {
      const spanMap = {
        soundstage: [3, 3],
        virtual_led: [3, 3],
        led_volume: [3, 3],
        cinema_theater: [3, 3],
        post_suite: [2, 2],
        executive: [2, 2],
        writers_bungalow: [2, 2],
        backlot: [3, 2],
        prop_workshop: [3, 2],
        studio_gate: [2, 1]
      };
      const span = spanMap[typeStr] || [2, 2];
      const spanW = span[0];
      const spanH = span[1];

      if (x < 0 || y < 0 || x + spanW > this.cols || y + spanH > this.rows) return 0;

      for (const b of this.buildings) {
        if (!(x + spanW <= b.grid_x || x >= b.grid_x + b.span_w || y + spanH <= b.grid_y || y >= b.grid_y + b.span_h)) {
          return 0; // Collision
        }
      }

      for (let r = y; r < y + spanH; r++) {
        for (let c = x; c < x + spanW; c++) {
          this.tiles[r * this.cols + c] = 3; // ConcretePad
        }
      }

      const id = this.next_id++;
      const nameMap = {
        soundstage: "Soundstage Complex",
        virtual_led: "Virtual LED Volume",
        led_volume: "Virtual LED Volume",
        cinema_theater: "Premiere Cinema Marquee",
        post_suite: "Dolby Atmos Post Suite",
        executive: "Executive Suite",
        writers_bungalow: "Writers Guild Bungalow",
        backlot: "Modular Backlot & Props",
        prop_workshop: "Modular Backlot & Props",
        studio_gate: "Historic Studio Gate"
      };

      const bld = {
        id: id,
        b_type: typeStr,
        type_str: typeStr,
        name: (nameMap[typeStr] || typeStr) + " #" + id,
        tier: 1,
        grid_x: x,
        grid_y: y,
        span_w: spanW,
        span_h: spanH,
        active_project_id: null,
        active_title: "",
        active_phase: "",
        progress: 0.0,
        filming_active: false,
        crew_count: 0,
        efficiency_boost: 1.0
      };
      this.buildings.push(bld);
      return id;
    }

    upgrade_building(id) {
      const b = this.buildings.find(item => item.id === id);
      if (!b) return 0;
      if (b.tier >= 5) return b.tier;
      b.tier++;
      b.efficiency_boost += 0.15;
      return b.tier;
    }

    demolish_building(id) {
      const idx = this.buildings.findIndex(item => item.id === id);
      if (idx === -1) return false;
      const b = this.buildings[idx];
      for (let r = b.grid_y; r < b.grid_y + b.span_h; r++) {
        for (let c = b.grid_x; c < b.grid_x + b.span_w; c++) {
          this.tiles[r * this.cols + c] = 0; // Grass
        }
      }
      this.buildings.splice(idx, 1);
      return true;
    }

    assign_production(buildingId, projectId, title, phase, progress) {
      const b = this.buildings.find(item => item.id === buildingId);
      if (!b) return false;
      b.active_project_id = projectId || null;
      b.active_title = title || "";
      b.active_phase = phase || "";
      b.progress = Math.max(0, Math.min(1, progress || 0));
      b.filming_active = phase === "shoot" || phase === "post";
      return true;
    }

    spawn_agent(kindStr, name, x, y, buildingId) {
      const id = this.next_id++;
      const speedMap = {
        star_actor: 2.2,
        director: 2.5,
        cameraman: 2.0,
        producer: 2.4,
        audience: 1.8,
        paparazzi: 3.2,
        extra: 2.0
      };
      const agent = {
        id: id,
        kind_str: kindStr,
        name: name,
        x: x,
        y: y,
        target_x: Math.round(x),
        target_y: Math.round(y),
        state_str: "idle",
        path: [],
        speed: speedMap[kindStr] || 2.0,
        anim_timer: 0,
        assigned_building_id: buildingId || null,
        costume_id: id % 5
      };
      this.agents.push(agent);
      return id;
    }

    send_agent_to(agentId, tx, ty) {
      const a = this.agents.find(item => item.id === agentId);
      if (!a) return false;
      a.target_x = tx;
      a.target_y = ty;
      // Simple path: 1-2 waypoints across roads
      a.path = [{ x: tx, y: ty }];
      a.state_str = "walking";
      return true;
    }

    tick(dt, currentWeek) {
      this.current_week = currentWeek || this.current_week;
      const stepDt = Math.max(0.001, Math.min(0.1, dt || 0.016));

      for (let i = 0; i < this.agents.length; i++) {
        const a = this.agents[i];
        a.anim_timer += stepDt;
        if (a.path && a.path.length > 0) {
          const next = a.path[0];
          const dx = next.x + 0.5 - a.x;
          const dy = next.y + 0.5 - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const step = a.speed * stepDt;

          if (dist <= step || dist < 0.05) {
            a.x = next.x + 0.5;
            a.y = next.y + 0.5;
            a.path.shift();
            if (a.path.length === 0) {
              if (a.kind_str === "director" || a.kind_str === "cameraman" || a.kind_str === "star_actor") {
                a.state_str = "filming";
              } else if (a.kind_str === "audience") {
                a.state_str = "queuing";
              } else {
                a.state_str = "idle";
              }
            }
          } else {
            a.x += (dx / dist) * step;
            a.y += (dy / dist) * step;
            a.state_str = "walking";
          }
        }
      }

      if (this.agents.length > 25) {
        this.agents = this.agents.filter(a => !(a.kind_str === "audience" && a.state_str === "queuing" && a.anim_timer > 30));
      }
    }

    trigger_box_office_surge(filmTitle, grossM) {
      this.box_office_buzz = Math.max(1.0, Math.min(10.0, (grossM || 1) * 0.1));
      this.total_tickets_sold += Math.round((grossM || 1) * 100000);

      const cinema = this.buildings.find(b => b.b_type === "cinema_theater");
      if (cinema) {
        const cx = cinema.grid_x + 1;
        const cy = cinema.grid_y + cinema.span_h;
        const count = Math.max(2, Math.min(6, Math.round((grossM || 10) / 10)));
        for (let i = 0; i < count; i++) {
          const spawnX = Math.floor(this.cols / 2) + (i * 0.8) - 1.5;
          const spawnY = this.rows - 2;
          const id = this.spawn_agent("audience", "Moviegoer " + this.next_id, spawnX, spawnY, null);
          this.send_agent_to(id, cx + (i % 2), cy + Math.floor(i / 2));
        }
      }
    }

    sync_studio_facilities(jsonStr) {
      try {
        const parsed = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
        for (const key in parsed) {
          const item = parsed[key];
          if (item && item.tier != null) {
            const b = this.buildings.find(bld => bld.b_type === key || (key === "virtual_led" && bld.b_type === "led_volume"));
            if (b) {
              b.tier = Math.max(1, Math.min(5, item.tier));
              b.efficiency_boost = 1.0 + (b.tier * 0.15);
            }
          }
        }
      } catch (e) {}
    }

    get_lot_state_json() {
      return JSON.stringify({
        cols: this.cols,
        rows: this.rows,
        current_week: this.current_week,
        total_tickets_sold: this.total_tickets_sold,
        box_office_buzz: this.box_office_buzz,
        buildings: this.buildings,
        agents: this.agents
      });
    }

    get_tiles_flat() {
      return this.tiles;
    }

    calculate_lot_quality_multiplier() {
      let mult = 1.0;
      for (const b of this.buildings) {
        if (b.b_type === "soundstage") mult += b.tier * 0.03;
        if (b.b_type === "virtual_led" || b.b_type === "led_volume") mult += b.tier * 0.05;
        if (b.b_type === "post_suite") mult += b.tier * 0.04;
        if (b.b_type === "backlot" || b.b_type === "prop_workshop") mult += b.tier * 0.03;
        if (b.b_type === "writers_bungalow") mult += b.tier * 0.02;
      }
      return mult;
    }
  }

  // Unified public API
  const StudioLotBridge = {
    engine: null,
    isWasm: false,

    async init() {
      if (this.engine) return this.engine;

      // Attempt loading Rust WASM module
      try {
        if (typeof WebAssembly !== "undefined") {
          const wasmModule = await import("./pkg/box_office_core.js");
          if (wasmModule && wasmModule.default) {
            await wasmModule.default("./pkg/box_office_core_bg.wasm");
            if (wasmModule.StudioLotEngine) {
              this.engine = new wasmModule.StudioLotEngine(24, 24);
              this.isWasm = true;
              console.log("[StudioLot] Rust WebAssembly Simulation Engine online.");
              return this.engine;
            }
          }
        }
      } catch (err) {
        console.warn("[StudioLot] WASM load fallback to native JS simulation mirror:", err && err.message);
      }

      // Seamless fallback to JS mirror
      this.engine = new JSLotEngineFallback(24, 24);
      this.isWasm = false;
      console.log("[StudioLot] JavaScript Mirror Simulation Engine initialized.");
      return this.engine;
    },

    getEngine() {
      if (!this.engine) {
        this.engine = new JSLotEngineFallback(24, 24);
      }
      return this.engine;
    },

    syncWithGameState(G) {
      if (!G || !this.engine) return;
      // Sync facilities
      if (G.facilities) {
        this.engine.sync_studio_facilities(JSON.stringify(G.facilities));
      }

      // Sync active productions into soundstages
      if (G.projects && G.projects.length > 0) {
        const stateStr = this.engine.get_lot_state_json();
        const lot = JSON.parse(stateStr);
        const soundstages = (lot.buildings || []).filter(b => b.b_type === "soundstage" || b.b_type === "virtual_led" || b.type_str === "soundstage" || b.type_str === "virtual_led");

        let stageIdx = 0;
        for (const p of G.projects) {
          if (p.phase === "shoot" || p.phase === "post" || p.phase === "reshoot") {
            if (stageIdx < soundstages.length) {
              const stage = soundstages[stageIdx];
              const progress = (p.phaseWeek || 1) / Math.max(1, (p.phaseLen && p.phaseLen[p.phase]) || 10);
              this.engine.assign_production(stage.id, p.id || p.title, p.title, p.phase, progress);
              stageIdx++;
            }
          }
        }
      }

      // Check active box office releases
      if (G.films && G.films.length > 0) {
        const recentHit = G.films.find(f => (f.weeks || 0) <= 3 && (f.lastWeekGross || f.grossDom || 0) > 5);
        if (recentHit) {
          this.engine.trigger_box_office_surge(recentHit.title, recentHit.lastWeekGross || 15);
        }
      }
    }
  };

  global.StudioLotBridge = StudioLotBridge;
})(typeof window !== "undefined" ? window : global);
