/* Composite licensed LPC Revised layers. See assets/vendor/lpc-revised/NOTICE.md.
   Rebuilds entirely offline; no network dependency. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),base=path.join(root,'assets/vendor/lpc-revised'),source=require(path.join(base,'sources.json')),out=path.join(root,'assets/studio/people');
fs.mkdirSync(out,{recursive:true});const states=['idle','walk','work','interact','celebrate','react','rest'],directions=['south','west','east','north'],rows=[2,1,3,0];
(async()=>{
 const portraits=[];
 for(const p of source.profiles){
  const sheets={};
  for(const animation of ['Idle','Walk','Sitting']){
   const layers=p.layers[animation].map(file=>({input:path.join(base,source.files[file].local)})),m=await sharp(layers[0].input).metadata();
   sheets[animation]=await sharp({create:{width:m.width,height:m.height,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
  }
  // Two work rows: seated desk work and standing crew work. Other reactions
  // retain the artist's idle poses; we do not advertise invented emote frames.
  const tiles=[];
  for(let row=0;row<32;row++)for(let col=0;col<8;col++){
   const direction=rows[row%4],state=states[Math.floor(row/4)]||'standing-work',animation=state==='walk'?'Walk':state==='work'||state==='rest'?'Sitting':'Idle';
   const frame=animation==='Walk'?col:animation==='Sitting'?2:[0,1,2,1][col%4];
   const input=await sharp(sheets[animation]).extract({left:frame*64+12,top:direction*64,width:40,height:64}).png().toBuffer();
   tiles.push({input,left:col*40,top:row*64});
  }
  await sharp({create:{width:320,height:2048,channels:4,background:'#00000000'}}).composite(tiles).png().toFile(path.join(out,p.id+'.png'));
  const portrait=await sharp(sheets.Idle).extract({left:12,top:128+8,width:40,height:40}).resize(64,64,{kernel:'nearest'}).png().toBuffer();
  portraits.push({input:portrait,left:(p.id%8)*64,top:Math.floor(p.id/8)*64});
 }
 await sharp({create:{width:512,height:192,channels:4,background:'#00000000'}}).composite(portraits).png().toFile(path.join(out,'portraits.png'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({license:'OGA-BY 3.0',source:source.repository,commit:source.commit,looks:24,width:40,height:64,columns:8,rows:32,states,directions,animations:{walk:8,idle:3,sittingPoses:3},note:'Rest/desk work use seated pose; standing work and reactions use idle art with contextual tools/bubbles, not dedicated emote animations.'},null,2)+'\n');
 console.log('Built 24 licensed character looks, eight-frame walking and matching portrait atlas.');
})().catch(e=>{console.error(e);process.exitCode=1;});
