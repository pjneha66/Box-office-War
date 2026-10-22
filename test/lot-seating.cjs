const assert=require('node:assert/strict'),fs=require('node:fs'),sharp=require('sharp');
require('../studio-lot-engine');const actors=require('../studio-actors');
const previousImage=global.Image;global.Image=class{};require('../studio-departments');global.Image=previousImage;
const D=global.StudioDepartments;
(async()=>{
 for(const view of ['writers','post','executive','cinema'])for(let i=0;i<9;i++){
  const a={id:7,kind_str:view==='cinema'?'audience':'writer',inside:true,workstation:i,indoor_x:3+i%3*3,indoor_y:3+Math.floor(i/3)*3,direction:'south',state_str:'work',indoor_path:[],life:{task:{type:view==='cinema'?'screening':'work'}}},before=JSON.stringify(a),v=D.presentation(a,view);
  assert(v.renderSeat);assert.equal(v.direction,'east');assert.equal(actors.richFrame(v).row,10);assert.equal(JSON.stringify(a),before);
  a.state_str='walking';assert(!D.presentation(a,view).renderSeat);a.state_str='work';a.indoor_x+=.4;assert(!D.presentation(a,view).renderSeat);
 }
 const performers=[{id:10,kind_str:'cameraman',indoor_x:6,indoor_y:3,state_str:'work',life:{state:'perform',task:{type:'work'}}},{id:11,kind_str:'star_actor',indoor_x:9,indoor_y:3,state_str:'work',life:{state:'perform',task:{type:'work'}}}];assert.equal(D.presentation(performers[0],'soundstage',performers).direction,'east');assert.equal(D.presentation(performers[1],'soundstage',performers).direction,'west');
 assert(!D.presentation({inside:true,workstation:0,indoor_x:3,indoor_y:3,state_str:'rest',direction:'south',life:{task:{type:'available'}}},'soundstage').renderSeat);
 assert.equal(actors.richFrame({state_str:'rest',direction:'south'}).row,0);
 console.log('PASS nine workstation anchors: desks/patrons face screen upper-right only when seated; travel/standing poses and authority unchanged');
 const base='assets/vendor/lpc-revised/',sources=JSON.parse(fs.readFileSync(base+'sources.json')),layers=sources.profiles[0].layers.Sitting.map(p=>({input:base+sources.files[p].local}));
 const composed=await sharp({create:{width:192,height:256,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
 const expected=await sharp(composed).extract({left:140,top:192,width:40,height:64}).raw().toBuffer(),actual=await sharp('assets/studio/people/0.png').extract({left:0,top:640,width:40,height:64}).raw().toBuffer();assert.deepEqual(actual,expected);
 console.log('PASS seated source pose is retained pixel-for-pixel: no downward packing offset or leg truncation');
 const meta=JSON.parse(fs.readFileSync('assets/studio/department-furniture.json')),png=fs.readFileSync('assets/studio/department-furniture.png');assert.equal(Object.keys(meta).length,20);assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),1024);
 for(const f of Object.values(meta))assert(f.x>=0&&f.y>=0&&f.x+f.w<=1280&&f.y+f.h<=1024&&f.ax===128&&f.ay===208);
 const runtime=JSON.parse(fs.readFileSync('studio-departments.js','utf8').match(/const departmentFrames=(\{[^\n]+\});/)[1]);assert.deepEqual(runtime,meta);
 console.log('PASS 20 original matched props have valid atlas anchors and exact runtime metadata');
})().catch(e=>{console.error(e);process.exitCode=1;});
