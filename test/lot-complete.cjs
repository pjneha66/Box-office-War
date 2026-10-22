'use strict';
const assert=require('node:assert/strict');
require('../studio-lot-engine.js');const actors=require('../studio-actors.js');
const bridge=global.StudioLotBridge,Engine=bridge.getEngine().constructor;let checks=0;
function test(name,fn){fn();checks++;console.log('PASS',name);}
function run(e,seconds){for(let i=0;i<seconds*60;i++)e.tick(1/60);}
test('all seven states / four directions select in-bounds frames, distance drives walk',()=>{
 const seen=new Set();for(const state of actors.states)for(const direction of actors.directions){for(let i=0;i<4;i++){const f=actors.frame({state_str:state,direction,state_time:i/4,walk_distance:i/4});assert(f.x>=0&&f.x+24<=96&&f.y>=0&&f.y+32<=896);seen.add(f.row);}}
 assert.equal(seen.size,28);assert.notEqual(actors.frame({state_str:'walking',direction:'east',walk_distance:0}).x,actors.frame({state_str:'walking',direction:'east',walk_distance:.25}).x);
 assert.equal(actors.frame({state_str:'work',state_time:1},true).col,0);
});
test('generated atlas metadata and dimensions match the runtime contract',()=>{
 const fs=require('node:fs'),meta=JSON.parse(fs.readFileSync('assets/studio/actors.json','utf8'));
 assert.deepEqual(meta.states,actors.states);assert.deepEqual(meta.directions,actors.directions);assert.deepEqual(meta.roles,actors.roles);
 for(const role of meta.roles){const png=fs.readFileSync('assets/studio/'+role+'.png');assert.equal(png.readUInt32BE(16),96);assert.equal(png.readUInt32BE(20),896);}
});
test('staff route, enter correct workplaces and occupy unique desks',()=>{
 const g={studio:{cash:100},projects:[{id:1,title:'Script',phase:'pre'}]};bridge.syncWithGameState(g);const e=bridge.engine;run(e,40);
 assert(e.agents.every(a=>a.inside));assert(e.agents.find(a=>a.kind_str==='writer').life.completed>0);assert(['work','interact','idle','walking','rest'].includes(e.agents.find(a=>a.kind_str==='writer').state_str));assert.equal(e.agents.find(a=>a.kind_str==='editor').state_str,'rest');
 const crew=e.agents.filter(a=>a.assigned_building_id===3);assert.equal(new Set(crew.map(a=>a.workstation)).size,crew.length);
});
test('booked writers retain appropriate department across film phases, public directory is excluded',()=>{
 const t={id:101,name:'Real Writer',kind:'writer',booked:'Film'};const market={id:102,name:'Public Market',kind:'actor'};
 const g={studio:{cash:100},projects:[{id:2,title:'Film',phase:'pre',writer:t}],talent:[t,market]};bridge.syncWithGameState(g);let e=bridge.engine;
 let a=e.agents.find(a=>a.talent_id===101);assert(a);assert(!e.agents.some(a=>a.talent_id===102));assert.equal(e.buildings.find(b=>b.id===a.assigned_building_id).b_type,'writers_bungalow');
 run(e,40);g.projects[0].phase='shoot';bridge.syncWithGameState(g);assert.equal(e.buildings.find(b=>b.id===a.assigned_building_id).b_type,'writers_bungalow');run(e,40);
 g.projects[0].phase='post';bridge.syncWithGameState(g);assert.equal(e.buildings.find(b=>b.id===a.assigned_building_id).b_type,'writers_bungalow');run(e,40);assert(a.inside);
 g.projects=[];g.talent[0].booked=null;bridge.syncWithGameState(g);assert(!e.agents.some(a=>a.talent_id===101));
});
test('contracted talent persists available, departed talent is removed on sync',()=>{
 const g={studio:{cash:100},projects:[],talent:[{id:8,name:'Retainer',kind:'actor',contract:{type:'exclusive'}}]};bridge.syncWithGameState(g);assert(bridge.engine.agents.some(a=>a.talent_id===8));g.talent[0].contract=null;bridge.syncWithGameState(g);assert(!bridge.engine.agents.some(a=>a.talent_id===8));
});
test('hired below-the-line and executive crews appear once and leave when fired',()=>{
 const g={studio:{cash:100},projects:[],btl:{dp:{id:9,name:'Hired Camera Unit'}},execs:{cfo:{hired:1}},studioOps:{hiredCSuite:{head:{name:'Hired Chief'}}}};
 bridge.syncWithGameState(g);const e=bridge.engine;assert.equal(e.agents.filter(a=>a.staff_key).length,3);bridge.syncWithGameState(g);assert.equal(e.agents.filter(a=>a.staff_key).length,3);run(e,45);assert(e.agents.filter(a=>a.staff_key).every(a=>a.inside));g.btl={};g.execs={};g.studioOps.hiredCSuite={};bridge.syncWithGameState(g);assert(!e.agents.some(a=>a.staff_key));
});
test('crowd reservations prevent overlaps and all audiences arrive/depart in bounded time',()=>{
 const e=new Engine(24,24);for(let i=0;i<10;i++)e.trigger_box_office_surge('Premiere '+i,30);
 let min=Infinity;for(let frame=0;frame<60*300;frame++){e.tick(1/60);if(frame%10)continue;const a=e.agents.filter(a=>!a.inside);for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)min=Math.min(min,Math.hypot(a[i].x-a[j].x,a[i].y-a[j].y));}
 assert(min>=.49,`minimum spacing ${min}`);assert(!e.agents.some(a=>a.kind_str==='audience'));assert(e.agents.every(a=>e.walkable(Math.floor(a.x),Math.floor(a.y))));
});
test('celebrate and react are event-driven and return to valid resting/work states',()=>{
 const g={studio:{cash:100},projects:[{id:3,title:'Finish',phase:'shoot'}]};bridge.syncWithGameState(g);const e=bridge.engine;run(e,30);g.projects[0].phase='post';bridge.syncWithGameState(g);const a=e.agents.find(a=>a.kind_str==='director');assert.equal(a.state_str,'celebrate');run(e,2);assert.equal(a.state_str,'rest');e.set_state(a,'react');run(e,1);assert.equal(a.state_str,'rest');
});
test('indoor positions, assignments and state survive JSON save/resume',()=>{
 const g={studio:{cash:100},projects:[{id:4,title:'Edit',phase:'post'}]};bridge.syncWithGameState(g);run(bridge.engine,35);bridge.persist(g);const before=bridge.engine.agents.map(a=>({id:a.id,inside:a.inside,x:a.indoor_x,y:a.indoor_y,station:a.workstation}));const save=JSON.parse(JSON.stringify(g));bridge.syncWithGameState(save);assert.deepEqual(bridge.engine.agents.map(a=>({id:a.id,inside:a.inside,x:a.indoor_x,y:a.indoor_y,station:a.workstation})),before);
});
test('restoring demolished starter buildings preserves IDs and footprints without overwriting siblings',()=>{
 const g={studio:{cash:100},projects:[]};bridge.syncWithGameState(g);bridge.engine.demolish_building(1);bridge.placeBuilding('post_suite',0,0);bridge.persist(g);
 const before=bridge.engine.buildings.map(b=>({id:b.id,type:b.b_type,x:b.grid_x,y:b.grid_y}));bridge.syncWithGameState(JSON.parse(JSON.stringify(g)));
 assert.deepEqual(bridge.engine.buildings.map(b=>({id:b.id,type:b.b_type,x:b.grid_x,y:b.grid_y})),before);
});
test('clock speed and pause are explicit without mutating career data',()=>{bridge.setPaused(true);assert(bridge.clock.paused);bridge.setSpeed(4);assert.equal(bridge.clock.speed,4);bridge.setSpeed(99);assert.equal(bridge.clock.speed,1);bridge.setPaused(false);assert(!bridge.clock.paused);});
console.log(checks+' complete-lot contract tests passed');
