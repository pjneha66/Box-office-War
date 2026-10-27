/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-LOT-ENGINE.JS — Canonical Spatial Simulation & Versioned Save Bridge
   Box Office War — Modular 2D Engine
   Zero Emojis Policy strictly enforced.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const AgentLife=global.StudioAgentLife||(typeof require==='function'?require('./studio-agent-life.js'):null);
  // Canonical deterministic spatial engine. Legacy WASM is capability-gated, never swapped mid-career.
  class JSLotEngineFallback {
    constructor(cols, rows) {
      this.cols = cols || 24;
      this.rows = rows || 24;
      this.current_week = 1;
      this.total_tickets_sold = 0;
      this.box_office_buzz = 1.0;
      this.next_id = 1;
      this.revision = 0;
      this.buildings = [];
      this.agents = [];
      this.life = new AgentLife(this);
      this.accumulator=0;this.alpha=0;
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

      this.spawn_agent("director", "Studio Director", 7.0, 7.0, 3);
      this.spawn_agent("cameraman", "Cinematographer", 6.0, 7.0, 3);
      this.spawn_agent("star_actor", "Leading Star", 8.0, 7.0, 3);
      this.spawn_agent("producer", "Studio Manager", Math.floor(this.cols / 2), this.rows - 4, 2);
      this.spawn_agent("writer", "Story Department", this.cols - 5, 15, 6);
      this.spawn_agent("editor", "Post-production Crew", 4, 12, 4);
    }

    can_place(typeStr, x, y) {
      const spans = {soundstage:[3,3],virtual_led:[3,3],led_volume:[3,3],post_suite:[2,2],writers_bungalow:[2,2],cinema_theater:[3,3],backlot:[3,2],prop_workshop:[3,2],executive:[2,2],studio_gate:[2,1],train_station:[3,2]};
      const span = spans[typeStr];
      if (!span || !Number.isInteger(x) || !Number.isInteger(y)) return false;
      for (let r=y;r<y+span[1];r++) for(let c=x;c<x+span[0];c++) {
        if (!this.walkable(c,r) || this.agents.some(a=>Math.floor(a.x)===c && Math.floor(a.y)===r)) return false;
      }
      // Preserve existing routes and every facility's south entrance.
      return !this.agents.some(a=>a.path.some(p=>p.x>=x&&p.x<x+span[0]&&p.y>=y&&p.y<y+span[1])) &&
        !this.buildings.some(b=>b.grid_x>=x&&b.grid_x<x+span[0]&&b.grid_y+b.span_h>=y&&b.grid_y+b.span_h<y+span[1]);
    }

    place_building(typeStr, x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y)) return 0;
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
        studio_gate: [2, 1],
        train_station: [3, 2]
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
        studio_gate: "Historic Studio Gate",
        train_station: "Regional Train Station"
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
      this.revision++;
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
      this.revision++;
      return true;
    }

    assign_production(buildingId, projectId, title, phase, progress) {
      const b = this.buildings.find(item => item.id === buildingId);
      if (!b) return false;
      b.active_project_id = projectId || null;
      b.active_title = title || "";
      b.active_phase = phase || "";
      b.progress = Math.max(0, Math.min(1, progress || 0));
      b.filming_active = phase === "shoot" || phase === "post" || phase === "production" || phase === "reshoot";
      return true;
    }

    start_directing(buildingId) {
      const b = this.buildings.find(item => item.id === buildingId);
      if (!b) return false;
      b.filming_active = true;
      if (!b.active_title) b.active_title = "Directing Take";
      return true;
    }

    advance_directing() {
      for(const a of this.agents.filter(a=>a.kind_str==='director')){this.life.ensure(a).bubble={text:'Ready for the next take.',until:this.life.time+2};}
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
        x: Math.floor(x) + 0.5,
        y: Math.floor(y) + 0.5,
        target_x: Math.round(x),
        target_y: Math.round(y),
        state_str: "idle",
        path: [],
        speed: speedMap[kindStr] || 2.0,
        anim_timer: 0,
        assigned_building_id: buildingId || null,
        costume_id: id % 5,
        state_time: 0, direction: 'south', inside: false, wait_time: 0,
        indoor_x: 1, indoor_y: 8, indoor_target_x: 3, indoor_target_y: 4
      };
      this.agents.push(agent);
      return id;
    }

    send_agent_to(agentId, tx, ty) {
      const a = this.agents.find(item => item.id === agentId);
      if (!a) return false;
      tx = Math.floor(tx); ty = Math.floor(ty);
      if (!this.walkable(tx, ty)) return false;
      const occupied = new Set(this.agents.filter(v=>v.id!==a.id&&!v.inside).map(v=>Math.floor(v.y)*this.cols+Math.floor(v.x)));
      const reserved = new Set(this.agents.filter(v=>v.id!==a.id&&v.path.length&&!v.inside).map(v=>v.target_y*this.cols+v.target_x));
      if(occupied.has(ty*this.cols+tx)||reserved.has(ty*this.cols+tx)) return false;
      const sx = Math.floor(a.x), sy = Math.floor(a.y);
      const queue = [[sx, sy]], previous = new Map([[sy * this.cols + sx, null]]);
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i];
        if (x === tx && y === ty) break;
        for (const [dx, dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
          const nx = x + dx, ny = y + dy, key = ny * this.cols + nx;
          if (!this.walkable(nx, ny) || previous.has(key) || occupied.has(key)) continue;
          previous.set(key, [x, y]); queue.push([nx, ny]);
        }
      }
      if (!previous.has(ty * this.cols + tx)) return false;
      const path = []; let x = tx, y = ty;
      while (x !== sx || y !== sy) {
        path.push({x, y}); [x,y] = previous.get(y * this.cols + x);
      }
      a.path = path.reverse();
      a.inside = false; a.wait_time = 0;
      a.target_x = tx; a.target_y = ty;
      this.set_state(a,path.length ? "walking" : "idle");
      return true;
    }

    set_state(a, state) {
      if(a.state_str!==state){a.state_str=state;a.state_time=0;}
    }

    walkable(x, y) {
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
        x < this.cols && y < this.rows && this.tiles[y * this.cols + x] !== 4 &&
        !this.buildings.some(b => x >= b.grid_x && x < b.grid_x + b.span_w &&
          y >= b.grid_y && y < b.grid_y + b.span_h);
    }

    assign_agent(agentId, buildingId, queueIfBusy=false) {
      const a = this.agents.find(a => a.id === agentId);
      const b = this.buildings.find(b => b.id === buildingId);
      if (!a || !b) return false;
      if(a.inside){
        if(a.assigned_building_id===buildingId)return true;
        if(a.transfer_building_id===buildingId)return true;
        a.transfer_building_id=buildingId;this.life.ensure(a).task=null;return true;
      }
      if(queueIfBusy)a.pending_building_id=buildingId;
      const entrances = [];
      for (let x = b.grid_x; x < b.grid_x + b.span_w; x++) {
        entrances.push([x, b.grid_y + b.span_h], [x, b.grid_y - 1]);
      }
      for (let y = b.grid_y; y < b.grid_y + b.span_h; y++) {
        entrances.push([b.grid_x - 1, y], [b.grid_x + b.span_w, y]);
      }
      const exitY=b.grid_y+Math.floor(b.span_h/2);
      for(let i=entrances.length-1;i>=0;i--)if(entrances[i][0]===b.grid_x+b.span_w&&entrances[i][1]===exitY)entrances.splice(i,1);
      const oldTarget = this.agents.filter(v=>v.id!==agentId&&v.assigned_building_id===buildingId).length;
      const offset = oldTarget % entrances.length;
      entrances.push(...entrances.splice(0,offset));
      for (const [x,y] of entrances) if (this.send_agent_to(agentId,x,y)) {
        a.pending_building_id=null; a.routed=true;
        a.assigned_building_id = buildingId; a.route_building_id=buildingId;
        const taken=new Set(this.agents.filter(v=>v.id!==agentId&&v.assigned_building_id===buildingId&&Number.isInteger(v.workstation)).map(v=>v.workstation));
        let slot=0;while(taken.has(slot))slot++;
        a.workstation=slot; a.indoor_x=1; a.indoor_y=8;
        a.indoor_target_x=3+(slot%3)*3; a.indoor_target_y=3+Math.floor(slot/3)*3;
        a.indoor_path=null;
        return true;
      }
      return false;
    }

    indoor_route(a) {
      const b=this.buildings.find(b=>b.id===a.assigned_building_id);
      const maxSlot=Math.max(a.workstation||0,...this.agents.filter(v=>v.assigned_building_id===b?.id).map(v=>v.workstation||0));
      const rows=Math.max(10,6+Math.ceil((maxSlot+1)/3)*3), blocked=new Set();
      if(['writers_bungalow','post_suite','executive'].includes(b?.b_type))for(let i=0;i<=Math.max(2,maxSlot);i++){
        const x=3+i%3*3,y=3+Math.floor(i/3)*3;blocked.add((y-1)*12+x);blocked.add((y-1)*12+x-1);
      }
      for(const v of this.agents)if(v.id!==a.id&&v.inside&&v.assigned_building_id===a.assigned_building_id){blocked.add(Math.round(v.indoor_y)*12+Math.round(v.indoor_x));if(v.indoor_path?.length)blocked.add(v.indoor_path[0].y*12+v.indoor_path[0].x);}
      const sx=Math.round(a.indoor_x),sy=Math.round(a.indoor_y),tx=Math.round(a.indoor_target_x),ty=Math.round(a.indoor_target_y);
      const q=[[sx,sy]],prev=new Map([[sy*12+sx,null]]);
      for(let i=0;i<q.length;i++) {const [x,y]=q[i];if(x===tx&&y===ty)break;
        for(const [dx,dy]of [[1,0],[0,-1],[-1,0],[0,1]]){const nx=x+dx,ny=y+dy,key=ny*12+nx;if(nx<1||nx>10||ny<1||ny>=rows||prev.has(key)||blocked.has(key))continue;prev.set(key,[x,y]);q.push([nx,ny]);}}
      if(!prev.has(ty*12+tx))return [];
      const result=[];let x=tx,y=ty;while(x!==sx||y!==sy){result.push({x,y});[x,y]=prev.get(y*12+x);}return result.reverse();
    }

    tick(dt,currentWeek) {
      if(!Number.isFinite(dt)||dt<=0)return;
      this.accumulator+=Math.min(.1,dt);
      while(this.accumulator+1e-9>=1/30){this.step(1/30,currentWeek);this.accumulator=Math.max(0,this.accumulator-1/30);}
      this.alpha=this.accumulator*30;
    }
    face(a,direction,dt){
      if(a.direction!==direction){a.direction=direction;a.turn_remaining=.1;}
      if(a.turn_remaining>0){a.turn_remaining=Math.max(0,a.turn_remaining-dt);this.set_state(a,'idle');return false;}return true;
    }
    step(dt, currentWeek) {
      this.current_week = currentWeek || this.current_week;
      const stepDt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      if (!stepDt) return;

      this.life.tick(stepDt);
      for (let i = 0; i < this.agents.length; i++) {
        const a = this.agents[i];
        a.previous={x:a.x,y:a.y,indoor_x:a.indoor_x,indoor_y:a.indoor_y,inside:a.inside,building:a.assigned_building_id};
        a.anim_timer += stepDt;
        a.state_time = (a.state_time||0) + stepDt;
        if(a.pending_building_id){a.retry_time=(a.retry_time||0)+stepDt;if(a.retry_time>.5){a.retry_time=0;this.assign_agent(a.id,a.pending_building_id,true);}}
        const assigned=this.buildings.find(b=>b.id===a.assigned_building_id);
        this.life.plan(a,assigned,stepDt);
        if(a.inside && !a.path.length){
          if(!assigned){a.inside=false;this.set_state(a,'react');continue;}

          if(!a.indoor_path)a.indoor_path=this.indoor_route(a);
          if(!a.indoor_path.length&&Math.hypot(a.indoor_x-a.indoor_target_x,a.indoor_y-a.indoor_target_y)>.02){
            a.wait_time=(a.wait_time||0)+stepDt;this.set_state(a,'idle');this.life.transition(a,'blocked','No indoor route; retrying without crossing furniture');
            if(a.wait_time>.5){this.life.ensure(a).navFailures++;a.indoor_path=null;a.wait_time=0;}continue;
          }
          const goal=a.indoor_path[0]||{x:a.indoor_target_x,y:a.indoor_target_y};
          const dx=goal.x-a.indoor_x,dy=goal.y-a.indoor_y,dist=Math.hypot(dx,dy);
          const obstructed=this.agents.some(v=>v.id!==a.id&&v.inside&&v.assigned_building_id===a.assigned_building_id&&Math.hypot(v.indoor_x-goal.x,v.indoor_y-goal.y)<.6);
          if(dist>.02&&obstructed){a.wait_time=(a.wait_time||0)+stepDt;this.set_state(a,'idle');if(a.wait_time>.5){a.indoor_path=this.indoor_route(a);a.wait_time=0;}continue;}
          if(dist>.02){
            const facing=Math.abs(dx)>Math.abs(dy)?dx>0?'east':'west':dy>0?'south':'north';if(!this.face(a,facing,stepDt))continue;
            a.velocity=Math.min(3,(a.velocity||0)+stepDt*8);const travel=Math.min(dist,stepDt*a.velocity);a.indoor_x+=dx/dist*travel;a.indoor_y+=dy/dist*travel;
            a.walk_distance=(a.walk_distance||0)+travel;
            a.direction=Math.abs(dx)>Math.abs(dy)?dx>0?'east':'west':dy>0?'south':'north';this.set_state(a,'walking');
            if(dist<=travel+.001)a.indoor_path.shift();
          }else if(a.indoor_path.length){a.indoor_x=goal.x;a.indoor_y=goal.y;a.walk_distance=(a.walk_distance||0)+dist;a.indoor_path.shift();continue;}
          else if(a.state_str==='celebrate' && a.state_time<1.5&&a.life.task?.type!=='screeningReaction' || a.state_str==='react'&&a.state_time<.6){/* finite reaction */}
          else {a.velocity=0;this.life.arrived(a,assigned,stepDt);}
          continue;
        }
        if (!a.path.length) a.velocity = 0;
        if (!a.path.length) {
          const atEntrance=assigned && a.route_building_id===assigned.id && Math.hypot(a.x-(a.target_x+.5),a.y-(a.target_y+.5))<.1;
          if(atEntrance){const entranceBusy=this.agents.some(v=>v.id!==a.id&&v.inside&&v.assigned_building_id===a.assigned_building_id&&Math.hypot(v.indoor_x-1,v.indoor_y-8)<.7);if(!entranceBusy){a.inside=true;this.set_state(a,'idle');}continue;}
          if(a.state_str!=='react'||a.state_time>.6)this.set_state(a,'rest');
        }
        if (a.path && a.path.length > 0) {
          const next = a.path[0];
          const dx = next.x + 0.5 - a.x;
          const dy = next.y + 0.5 - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (!this.walkable(next.x, next.y)) { a.path = [];a.pending_building_id=assigned?.id;this.life.ensure(a).navFailures++;this.life.transition(a,"blocked","Campus route invalidated; requesting another entrance");this.set_state(a,"react"); continue; }
          const blocked=this.agents.some(v=>v.id!==a.id&&!v.inside&&Math.floor(v.x)===next.x&&Math.floor(v.y)===next.y);
          if(blocked){
            a.wait_time=(a.wait_time||0)+stepDt;a.velocity=0;this.set_state(a,'idle');
            if(a.wait_time>.8){a.wait_time=0;this.send_agent_to(a.id,a.target_x,a.target_y);}
            continue;
          }
          a.wait_time=0;
          if(!this.face(a,Math.abs(dx)>Math.abs(dy)?dx>0?'east':'west':dy>0?'south':'north',stepDt))continue;
          const limit = a.path.length === 1 ? Math.min(a.speed, Math.sqrt(16 * dist)) : a.speed;
          a.velocity = Math.min(limit, (a.velocity || 0) + stepDt * 8);
          const step = a.velocity * stepDt;
          a.walk_distance = (a.walk_distance || 0) + Math.min(step, dist);

          if (dist <= step || dist < 0.05) {
            a.x = next.x + 0.5;
            a.y = next.y + 0.5;
            a.path.shift();
            if (a.path.length === 0) {
              const job = this.buildings.find(b=>b.id===a.assigned_building_id);
              this.set_state(a,"idle");
              a.velocity = 0;
            }
          } else {
            a.x += (dx / dist) * step;
            a.y += (dy / dist) * step;
            this.set_state(a,"walking");
          }
        }
      }

      this.agents=this.agents.filter(a=>!a.departed);
    }

    free_spawn() {
      for(let y=this.rows-1;y>=0;y--)for(let x=Math.floor(this.cols/2)-3;x<this.cols;x++)
        if(this.walkable(x,y)&&!this.agents.some(a=>!a.inside&&Math.floor(a.x)===x&&Math.floor(a.y)===y))return {x,y};
      return null;
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
          const spawn=this.free_spawn();if(!spawn)break;
          const spawnX=spawn.x,spawnY=spawn.y;
          const id = this.spawn_agent("audience", "Moviegoer " + this.next_id, spawnX, spawnY, cinema.id);
          this.assign_agent(id,cinema.id,true);
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
              b.efficiency_boost = 1.0 + ((b.tier - 1) * 0.15);
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
  // Legacy/custom project references may be talent IDs rather than objects.
  const talentRef=(G,t)=>t&&typeof t==='object'?t:(G.talent||[]).find(v=>String(v.id)===String(t));
  const StudioLotBridge = {
    engine: null,
    isWasm: false,
    backend: 'javascript',
    backendReason: 'Canonical JS supports spatial saves, indoors and crowd reservations. Legacy WASM has no matching protocol.',
    capabilities: Object.freeze({schema:1,pathfinding:true,interiors:true,crowdReservations:true}),
    clock: {paused:false,speed:1},
    setPaused(paused) {
      this.clock.paused=!!paused;
      if(typeof global.toggleAuto==='function'){
        if(paused){this._resumeAuto=typeof AUTO!=='undefined'&&!!AUTO;global.toggleAuto(false);}
        else if(this._resumeAuto){this._resumeAuto=false;global.toggleAuto(true);}
      }
      return this.clock.paused;
    },
    setSpeed(speed) { this.clock.speed=[1,2,4].includes(+speed)?+speed:1; return this.clock.speed; },

    async init() {
      if (this.engine) return this.engine;

      // The spatial save/path contract is currently implemented by JS only.
      // Do not silently change backend according to async UI initialization order.
      // Seamless fallback to JS mirror
      this.engine = new JSLotEngineFallback(24, 24);
      this.isWasm = false;
      console.log("[StudioLot] JavaScript spatial simulation initialized.");
      return this.engine;
    },

    getEngine() {
      if (!this.engine) {
        this.engine = new JSLotEngineFallback(24, 24);
      }
      return this.engine;
    },

    getLotState() {
      const eng = this.getEngine();
      try {
        const jsonStr = eng.get_lot_state_json();
        return JSON.parse(jsonStr);
      } catch (e) {
        return { buildings: [], agents: [], total_tickets_sold: 0, box_office_buzz: 1.0 };
      }
    },

    placeBuilding(type, x, y) {
      const eng = this.getEngine();
      const id = eng.can_place(type,x,y) ? eng.place_building(type, x, y) : 0;
      return { ok: !!id, id };
    },

    upgradeBuilding(id) {
      const eng = this.getEngine();
      return eng.upgrade_building(id);
    },

    demolishBuilding(id) {
      const eng = this.getEngine();
      return eng.demolish_building(id);
    },

    tick(dt) {
      const eng = this.getEngine();
      return eng.tick(dt);
    },

    syncWithGameState(G) {
      if (!G) return;
      const eng = this.getEngine();
      if (!eng) return;

      // Sync facilities
      if (G.facilities) {
        try {
          eng.sync_studio_facilities(JSON.stringify(G.facilities));
        } catch(e) {}
      }

      if (this._career !== G) {
        this._career = G;
        this.clock.paused=false;this._resumeAuto=false;
        if(global.StudioLot2D?.resetSelection)global.StudioLot2D.resetSelection();
        this.engine = new JSLotEngineFallback(24,24);
        const saved = G.studioLot;
        if (saved && saved.version === 1 && Array.isArray(saved.buildings)) {
          const fresh = this.engine;
          fresh.life.time=Math.max(0,Number(saved.simulation_time)||0);
          fresh.total_tickets_sold = Math.max(0, Number(saved.total_tickets_sold) || 0);
          fresh.box_office_buzz = Math.max(1, Math.min(10, Number(saved.box_office_buzz) || 1));
          // Recreate footprints through the validated placement API, not raw tile data.
          fresh.buildings = []; fresh.initStarterGrid(); fresh.next_id = 1;
          for (const b of saved.buildings) {
            const id = fresh.place_building(b.b_type,b.grid_x,b.grid_y);
            if (id) {
              const placed=fresh.buildings[fresh.buildings.length-1];
              // Restore metadata onto the just-created object: saved IDs may have gaps after demolition.
              Object.assign(placed,b,{grid_x:placed.grid_x,grid_y:placed.grid_y,span_w:placed.span_w,span_h:placed.span_h});
            }
          }
          fresh.next_id = Math.max(1,...fresh.buildings.map(b=>b.id+1));
          // Agent positions are presentation state: restore only walkable positions.
          fresh.agents = [];
          for (const a of saved.agents || []) if (fresh.walkable(Math.floor(a.x),Math.floor(a.y))) {
            const route=Array.isArray(a.path)&&a.path.every(p=>fresh.walkable(p.x,p.y))?a.path:[];
            fresh.agents.push({...a,path:route,routed:!!a.inside||route.length>0}); fresh.next_id=Math.max(fresh.next_id,a.id+1);
          }
        }
      }
      const core = this.engine;
      core.game=G;core.dispatchProject=this._dispatchProject||null;
      // Add the two new operations roles to early spatial saves without resetting layout/talent.
      for(const [kind,type,name]of [['writer','writers_bungalow','Story Department'],['editor','post_suite','Post-production Crew']]){
        if(!core.agents.some(a=>a.kind_str===kind&&a.talent_id==null)){
          const b=core.buildings.find(b=>b.b_type===type),spawn=core.free_spawn();
          if(b&&spawn)core.spawn_agent(kind,name,spawn.x,spawn.y,b.id);
        }
      }
      // Named operating units, not paid-talent duplicates or decorative crowd sprites.
      // Optional keys migrate once into old spatial saves; demolition never respawns a room.
      const operatingCrew=[
        ['story-editor','writer','writers_bungalow','Priya Desai',null,'Story editor'],
        ['researcher','writer','writers_bungalow','Julian Torres',null,'Story researcher'],
        ['lighting','cameraman','soundstage','Zara Okafor','lighting','Lighting technician'],
        ['sound','editor','post_suite','Hana Kim','audio','Sound editor'],
        ['vfx','editor','post_suite','Rafael Costa','vfx','VFX artist'],
        ['coordinator','producer','executive','Imani Reed',null,'Production coordinator']
      ];
      for(const [key,kind,type,name,specialty,title]of operatingCrew){
        if(core.agents.some(a=>a.crew_key===key))continue;
        const b=core.buildings.find(b=>b.b_type===type),spawn=core.free_spawn();if(!b||!spawn)continue;
        const id=core.spawn_agent(kind,name,spawn.x,spawn.y,b.id),a=core.agents.find(a=>a.id===id);
        Object.assign(a,{crew_key:key,specialty,job_title:title});
      }
      if (G.facilities) core.sync_studio_facilities(G.facilities);
      const previousProjects=new Map(core.buildings.map(b=>[b.id,{id:b.active_project_id,phase:b.active_phase}]));
      for (const b of core.buildings) {if(b.b_type==='cinema_theater')continue;core.assign_production(b.id,null,"","",0);b.suspended=false;}
      const used = new Set();
      const dispatchProjects=[...(G.projects||[])].sort((a,b)=>Number(String(b.id||b.title)===core.dispatchProject)-Number(String(a.id||a.title)===core.dispatchProject));
      for (const p of dispatchProjects) {
        const type = p.phase === "post" ? "post_suite" : ["shoot","reshoot","production"].includes(p.phase) ? "soundstage" : ["dev","pre"].includes(p.phase) ? "writers_bungalow" : null;
        const b = core.buildings.find(b=>!used.has(b.id) && (b.b_type===type || type==="soundstage" && b.b_type==="virtual_led"));
        if (!b) continue;
        used.add(b.id);
        core.assign_production(b.id,String(p.id || p.title),p.title,p.phase,(p.phaseWeek||0)/Math.max(1,p.phaseLen?.[p.phase]||10));
        b.work_phase_week=p.phaseWeek||0;b.suspended=(p.strikePause||0)>0;
      }
      // Reconcile actual contracted/booked talent, not the entire public talent directory.
      const required=new Map();
      const roleType={writer:'writers_bungalow',editor:'post_suite',producer:'executive',director:'soundstage',star_actor:'soundstage',cameraman:'soundstage'};
      for(const p of G.projects||[]){
        const stage=core.buildings.find(b=>b.active_project_id===String(p.id||p.title));
        for(const [kind,people] of [['writer',[p.writer||p.writerId]],['director',[p.director||p.directorId]],['producer',[p.producer||p.producerId]],['star_actor',p.cast||[]]]){
          for(const t of people.map(t=>talentRef(G,t)).filter(Boolean)) required.set(String(t.id),{t,kind,projectId:String(p.id||p.title),b:kind==='writer'?core.buildings.find(b=>b.b_type==='writers_bungalow'):kind==='producer'?core.buildings.find(b=>b.b_type==='executive'):['shoot','reshoot','production'].includes(p.phase)?stage:core.buildings.find(b=>b.b_type==='soundstage')});
        }
      }
      for(const t of G.talent||[]) if(t.contract || t.multiDeal || (G.talentPacts?.activeContracts||[]).some(c=>c.talentId===t.id)) {
        if(!required.has(String(t.id)))required.set(String(t.id),{t,kind:t.kind==='actor'?'star_actor':t.kind==='writer'?'writer':t.kind==='director'?'director':'producer'});
      }
      core.agents=core.agents.filter(a=>a.talent_id==null||required.has(String(a.talent_id)));
      for(const [key,{t,kind,b,projectId}] of required){
        let a=core.agents.find(a=>String(a.talent_id)===key);
        if(!a){const spawn=core.free_spawn();if(!spawn)continue;const id=core.spawn_agent(kind,t.name,spawn.x,spawn.y,null);a=core.agents.find(a=>a.id===id);a.talent_id=t.id;}
        a.name=t.name;a.kind_str=kind;a.project_id=projectId||null;const identity=core.life.ensure(a);if(Number.isFinite(t.skill))identity.skills[kind]=t.skill;a.economic_assignment=t.booked||'';
        const dest=b||core.buildings.find(b=>b.b_type===roleType[kind]);
        if(dest&&a.assigned_building_id!==dest.id){core.assign_agent(a.id,dest.id,true);}
      }
      const staff=new Map();
      for(const [id,t]of Object.entries(G.btl||{}))if(t)staff.set('btl:'+id,{name:t.name,kind:id==='dp'||/light/.test(id)?'cameraman':'editor',type:id==='dp'||/light/.test(id)?'soundstage':'post_suite'});
      for(const id of Object.keys(G.execs||{})){
        const def=(typeof DATA!=='undefined'?DATA.EXECS:[]).find(d=>d.id===id);
        staff.set('exec:'+id,{name:def?.name||id,kind:'producer',type:'executive'});
      }
      for(const [id,t]of Object.entries(G.studioOps?.hiredCSuite||{}))staff.set('csuite:'+id,{name:t.name,kind:'producer',type:'executive'});
      core.agents=core.agents.filter(a=>!a.staff_key||staff.has(a.staff_key));
      for(const [key,t]of staff){let a=core.agents.find(a=>a.staff_key===key);if(!a){const spawn=core.free_spawn();if(!spawn)continue;const id=core.spawn_agent(t.kind,t.name,spawn.x,spawn.y,null);a=core.agents.find(a=>a.id===id);a.staff_key=key;}
        a.specialty=key.includes('vfx')?'vfx':/sound|audio|composer/.test(key)?'audio':key.includes('light')?'lighting':null;
        const b=core.buildings.find(b=>b.b_type===t.type);if(b&&a.assigned_building_id!==b.id)core.assign_agent(a.id,b.id,true);
      }
      for(const a of core.agents){
        const job=core.buildings.find(b=>b.id===a.assigned_building_id);
        if(job && !a.path.length && !a.inside && !a.routed) {a.routed=core.assign_agent(a.id,job.id,true);}
        const previous=previousProjects.get(job?.id);
        const genuinelyCompleted=previous?.id&&((G.projects||[]).some(p=>String(p.id||p.title)===previous.id&&p.phase!==previous.phase)||(G.films||[]).some(f=>String(f.id||f.title)===previous.id));
        if(job && a.inside && genuinelyCompleted && !job.active_project_id){core.set_state(a,'celebrate');const l=core.life.ensure(a);l.mood='proud';l.bubble={text:'Phase complete!',until:core.life.time+3};}
      }
      const concern=G.studio?.cash<0?'Cash shortfall':(G.projects||[]).some(p=>(p.strikePause||0)>0)?'Production on hold':null;
      if(concern&&core.lastConcern!==concern){for(const a of core.agents){const l=core.life.ensure(a);l.mood='concerned';l.bubble={text:concern,until:core.life.time+3};}core.life.event('concern',concern,[]);}
      if(!concern&&core.lastConcern)for(const a of core.agents)core.life.ensure(a).mood='calm';core.lastConcern=concern;
      const seen = new Set(G.studioLot?.surges || []);
      for (const f of G.films || []) {
        const key = String(f.id || f.title);
        if (!seen.has(key) && (f.weeks||0)<=3 && (f.lastWeekGross||f.grossDom||0)>5) {
          core.trigger_box_office_surge(f.title,f.lastWeekGross||15);const cinema=core.buildings.find(b=>b.b_type==='cinema_theater');if(cinema){cinema.active_title=f.title;cinema.screening_success=(f.lastWeekGross||0)>20;}seen.add(key);
        }
      }
      G.studioLot = {version:1,simulation_time:core.life.time,buildings:core.buildings,agents:core.agents,total_tickets_sold:core.total_tickets_sold,box_office_buzz:core.box_office_buzz,surges:[...seen]};
    },

    resolveProductionWeek(p,G) {
      this._dispatchProject=String(p.id||p.title);
      this.syncWithGameState(G);
      const e=this.engine;e.dispatchProject=String(p.id||p.title);
      const roles=p.phase==='pre'||p.phase==='dev'?['writer']:p.phase==='post'?['editor']:['director','cameraman','star_actor'];
      const key=p.phase+'|'+p.phaseWeek;
      // Require actual booked talent where supplied; operating crews are the fallback,
      // never a substitute for an absent contracted writer/director/cast member.
      const booked={writer:[p.writer||p.writerId].filter(Boolean),director:[p.director||p.directorId].filter(Boolean),star_actor:p.cast||[]};
      const ready=()=>p.studioWork?.key===key&&roles.every(role=>booked[role]?.length?booked[role].every(ref=>{const t=talentRef(G,ref);if(!t)return false;const a=e.agents.find(a=>a.talent_id===t.id);return a&&(p.studioWork.byAgent?.[a.id]||0)>=8&&(p.studioWork.completedAgents?.[a.id]||0)>0;}):(p.studioWork.seconds[role]||0)>=8&&(p.studioWork.completedRoles?.[role]||0)>0);
      // Resolve an unobserved working shift through the SAME task/navigation engine.
      // Manual weeks do not depend on rendering, FPS, or minutes spent watching.
      for(let i=0;i<1800&&!ready();i++)e.tick(.1,G.week);
      const ok=ready();e.dispatchProject=null;this._dispatchProject=null;
      if(!ok&&p.studioWork?.delayWeek!==G.week){
        p.studioWork=p.studioWork||{version:1,key,seconds:{},completedTasks:0};p.studioWork.delayWeek=G.week;
        if(typeof global.log==='function')global.log('Production delayed: '+p.title+' needs an accessible workplace and available '+roles.join(', ')+'.','bad');
      }
      if(ok)p.studioWork.consumedWeek=G.week;
      return ok;
    },
    debugAgent(id) {return this.getEngine().life.inspect(id);},
    persist(G) {
      if (!G || this._career !== G) return;
      G.studioLot = {version:1, simulation_time:this.engine.life.time, buildings:this.engine.buildings, agents:this.engine.agents, total_tickets_sold:this.engine.total_tickets_sold, box_office_buzz:this.engine.box_office_buzz, surges:G.studioLot?.surges || []};

    }
  };

  global.StudioLotBridge = StudioLotBridge;
})(typeof window !== "undefined" ? window : global);
