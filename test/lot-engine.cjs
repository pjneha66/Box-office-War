'use strict';
const assert=require('node:assert/strict');
require('../studio-lot-engine.js');
const bridge=global.StudioLotBridge;
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
let e=bridge.getEngine();
test('fallback routes around stage, never across footprint',()=>{
 const id=e.spawn_agent('extra','Route test',3,5,null);assert(e.send_agent_to(id,8,5));
 const a=e.agents.find(a=>a.id===id);assert(a.path.length>5);assert(a.path.every(p=>e.walkable(p.x,p.y)));
 for(let n=0;n<600;n++){e.tick(1/60);assert(e.walkable(Math.floor(a.x),Math.floor(a.y)));}
 assert.equal(a.path.length,0);assert.equal(a.x,8.5);assert.equal(a.y,5.5);
});
test('reject invalid routes without replacing current route',()=>{const a=e.agents[0];const before=JSON.stringify(a.path);assert.equal(e.send_agent_to(a.id,-1,5),false);assert.equal(e.send_agent_to(a.id,4,4),false);assert.equal(JSON.stringify(a.path),before);});
test('zero delta pauses every actor',()=>{const before=e.get_lot_state_json();e.tick(0);assert.equal(e.get_lot_state_json(),before);});
test('placement rejects bounds, fractions, collisions, occupied staff',()=>{assert(!e.can_place('soundstage',-1,0));assert(!e.can_place('soundstage',23,23));assert(!e.can_place('post_suite',1.5,1));assert(!e.can_place('post_suite',4,4));assert(!e.can_place('post_suite',7,7));assert(e.can_place('post_suite',0,0));});
const g={week:2,studio:{cash:100},projects:[{id:1,title:'Test',phase:'shoot',phaseWeek:1,phaseLen:{shoot:5}}],films:[{id:1,title:'Hit',weeks:1,lastWeekGross:20}],facilities:{}};
test('career sync assigns real projects, surge is idempotent',()=>{bridge.syncWithGameState(g);e=bridge.engine;const count=e.agents.length;const tickets=e.total_tickets_sold;bridge.syncWithGameState(g);assert.equal(e.agents.length,count);assert.equal(e.total_tickets_sold,tickets);assert.equal(e.buildings.find(b=>b.b_type==='soundstage').active_title,'Test');});
test('completed productions clear stale assignment',()=>{g.projects=[];bridge.syncWithGameState(g);assert(e.buildings.every(b=>!b.active_project_id&&!b.filming_active));});
test('layout persists through JSON career round trip',()=>{assert(bridge.placeBuilding('post_suite',0,0).ok);bridge.persist(g);const saved=JSON.parse(JSON.stringify(g));bridge.syncWithGameState(saved);assert.equal(bridge.engine.buildings.length,7);assert(bridge.engine.buildings.some(b=>b.grid_x===0&&b.grid_y===0));assert.equal(saved.studio.cash,100);assert.equal(bridge.engine.total_tickets_sold,g.studioLot.total_tickets_sold);});
test('old saves migrate non-destructively and careers are isolated',()=>{const old={week:20,studio:{cash:54},films:[],projects:[]};bridge.syncWithGameState(old);assert.equal(bridge.engine.buildings.length,6);assert.equal(old.studio.cash,54);assert.equal(old.studioLot.version,1);});
test('assigning employee routes to walkable entrance',()=>{e=bridge.engine;const a=e.agents[0], b=e.buildings.find(b=>b.b_type==='writers_bungalow');assert(e.assign_agent(a.id,b.id));assert.equal(a.assigned_building_id,b.id);assert(a.path.every(p=>e.walkable(p.x,p.y)));});
test('frame rate independent travel and direction updates',()=>{const Engine=e.constructor;const travel=dt=>{const c=new Engine(24,24);const a=c.agents[0];c.send_agent_to(a.id,10,7);for(let t=0;t<2/dt;t++)c.tick(dt);return a;};const a=travel(1/30),b=travel(1/60);assert(Math.abs(a.x-b.x)<0.1);assert.equal(a.direction,b.direction);assert(['east','west','north','south'].includes(a.direction));assert(a.walk_distance>0);});
console.log(`${passed} lot engine tests passed`);
