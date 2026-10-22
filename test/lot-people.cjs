'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
require('../studio-lot-engine');const actors=require('../studio-actors'),B=global.StudioLotBridge;
const g={week:1,studio:{cash:100},projects:[{id:'people',title:'The Human Element',phase:'pre',phaseWeek:0}]};
B.syncWithGameState(g);const e=B.engine;
assert.equal(e.agents.length,12);assert.equal(e.agents.filter(a=>a.crew_key).length,6);assert.equal(new Set(e.agents.map(a=>a.name)).size,12);
for(let i=0;i<3;i++)B.syncWithGameState(g);assert.equal(e.agents.length,12);
for(let i=0;i<1800;i++)e.tick(1/30);
assert(e.agents.every(a=>a.inside));assert.equal(new Set(e.agents.map(a=>actors.look(a))).size,12);
for(const key of ['story-editor','researcher']){const a=e.agents.find(a=>a.crew_key===key);assert(a.life.completed>0);assert.equal(e.buildings.find(b=>b.id===a.assigned_building_id).b_type,'writers_bungalow');}
for(const [key,role]of [['lighting','cameraman'],['sound','editor'],['vfx','editor']]){const a=e.agents.find(a=>a.crew_key===key);assert.equal(a.kind_str,role);assert(a.specialty);}
B.persist(g);const before=e.agents.map(a=>({id:a.id,look:actors.look(a),crew:a.crew_key}));B.syncWithGameState(JSON.parse(JSON.stringify(g)));assert.deepEqual(B.engine.agents.map(a=>({id:a.id,look:actors.look(a),crew:a.crew_key})),before);
console.log('PASS twelve unique persistent workers, six real specialty crew, no duplicates after sync/save/load');
const manifest=require('../assets/studio/people/manifest.json'),sources=require('../assets/vendor/lpc-revised/sources.json');
assert.equal(manifest.license,'OGA-BY 3.0');assert.equal(manifest.looks,24);assert.equal(manifest.animations.walk,8);assert.equal(sources.profiles.length,24);
const hashes=new Set();for(let i=0;i<24;i++){const bytes=fs.readFileSync('assets/studio/people/'+i+'.png');assert.equal(bytes.readUInt32BE(16),320);assert.equal(bytes.readUInt32BE(20),2048);hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));}assert.equal(hashes.size,24);
for(const source of Object.values(sources.files)){const bytes=fs.readFileSync('assets/vendor/lpc-revised/'+source.local),gitSha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');assert.equal(gitSha,source.sha);}
for(const direction of actors.directions)for(const state of actors.states)for(let n=0;n<8;n++){const f=actors.richFrame({state_str:state,kind_str:'cameraman',direction,velocity:1,walk_distance:n/4,state_time:n/2});assert(f.x>=0&&f.x+40<=320&&f.y>=0&&f.y+64<=2048);}
assert.equal(actors.richFrame({state_str:'walking',velocity:0,direction:'south',walk_distance:2}).state,'idle');
console.log('PASS 24 distinct licensed looks, immutable source blob verification, all rich animation frames in bounds');
