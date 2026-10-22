/* Original pixel art. Deterministic build; no downloaded or copied game assets.
   24x32 frames, four columns, seven states x four direction rows. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const states=['idle','walk','work','interact','celebrate','react','rest'];
const directions=['south','west','east','north'];
const roles={director:'#bd795b',cameraman:'#6096a2',star_actor:'#ba9c50',producer:'#8273a5',writer:'#61906f',editor:'#6685ae',audience:'#ac8665'};
const out=path.resolve(__dirname,'../assets/studio');fs.mkdirSync(out,{recursive:true});
function sprite(role,color,state,dir,f){
 let svg='';const rect=(x,y,w,h,c)=>svg+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
 const skin='#dbac80',ink='#273440',pants='#334c60';
 const step=state==='walk'?[0,2,0,-2][f]:0;
 const seated=state==='rest'||state==='work'&&['writer','editor','producer','audience'].includes(role);
 const bob=state==='celebrate'?[0,-2,-3,-1][f]:state==='react'?[0,1,0,-1][f]:0;
 const bodyY=(seated?17:15)+bob;
 rect(5,29,14,2,'#344c42');
 rect(8,24+bob+(seated?0:step),3,seated?5:6,ink);rect(13,24+bob+(seated?0:-step),3,seated?5:6,ink);
 rect(7,bodyY,10,10,ink);rect(8,bodyY+1,8,8,color);
 rect(8,6+bob,8,10,ink);rect(9,7+bob,6,8,skin);rect(8,5+bob,8,4,ink);
 if(dir!=='north'){rect(dir==='west'?9:dir==='east'?14:10,11+bob,1,1,ink);if(dir==='south')rect(14,11+bob,1,1,ink);}
 else rect(9,9+bob,6,4,ink);
 if(state==='celebrate'){rect(4,10+bob+f%2,3,8,color);rect(17,10+bob-f%2,3,8,color);rect(4,8+bob,3,3,skin);rect(17,8+bob,3,3,skin);}
 else if(state==='react'){rect(4,15+bob,4,3,skin);rect(17,15+bob,4,3,skin);rect(11,13+bob,3,2,ink);}
 else {const hand=state==='work'||state==='interact'?f%2*2:step;rect(5,bodyY+2,3,7,color);rect(17,bodyY+2,3,7,color);rect(5,bodyY+7+hand,3,2,skin);rect(17,bodyY+7-hand,3,2,skin);}
 if(state==='work'||state==='interact'){
  if(role==='writer'){rect(15,23,7,4,'#f0e1b6');rect(17+f%2,21,1,5,ink);}
  if(role==='editor'){rect(3,22,6,4,'#9bc8c3');rect(17,23-f%2,4,2,'#e4d6b5');}
  if(role==='producer'){rect(16,20,6,6,'#e4d6b5');rect(18,21+f%2,3,1,ink);}
  if(role==='director'){rect(16,18-f%2,7,6,ink);rect(16,18-f%2,7,1,'#e4d6b5');rect(17,20-f%2,2,1,'#e4d6b5');}
  if(role==='cameraman'){rect(15,16,8,6,ink);rect(21,17,3,4,'#97bab6');rect(18,14,3,2,ink);}
  if(role==='star_actor'){rect(19,15-f%2*2,2,7,skin);}
  if(role==='audience'){rect(17,21,5,6,'#c36c59');rect(17,20,5,2,'#f3d58e');}
 }
 if(state==='idle'||state==='rest'){if(f===2&&dir!=='north'){rect(dir==='west'?9:dir==='east'?14:10,11+bob,2,1,skin);if(dir==='south')rect(13,11+bob,2,1,skin);}rect(9,bodyY+5,6,1,f%2?'#8b9d86':color);}
 if(role==='director')rect(7,5+bob,11,2,'#5e4854');
 if(role==='cameraman')rect(8,5+bob,9,2,'#6397a3');
 return svg;
}
(async()=>{for(const [role,color]of Object.entries(roles)){
 let body='';states.forEach((state,s)=>directions.forEach((dir,d)=>{for(let f=0;f<4;f++)body+=`<g transform="translate(${f*24},${(s*4+d)*32})">${sprite(role,color,state,dir,f)}</g>`;}));
 await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="896" shape-rendering="crispEdges">${body}</svg>`)).png().toFile(path.join(out,role+'.png'));
 }
 const metadata={version:1,width:24,height:32,columns:4,states,directions,roles:Object.keys(roles),fps:{idle:2,walk:8,work:5,interact:4,celebrate:6,react:5,rest:1}};
 fs.writeFileSync(path.join(out,'actors.json'),JSON.stringify(metadata,null,2)+'\n');console.log('Built 7 original actor sheets, 112 frames each.');
})().catch(e=>{console.error(e);process.exitCode=1;});

/* Distinct isometric facility silhouettes, same pixel grid/palette/lighting. */
function facility(type){
 let out='';
 const poly=(points,c)=>out+=`<polygon points="${points}" fill="${c}" stroke="#31444b" stroke-width="1"/>`;
 const r=(x,y,w,h,c)=>out+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
 function box(x,y,w,d,h,roof,left,right){
  const p=(a,b)=>[80+(a-b)*4,140+(a+b)*2];
  const a=p(x,y),b=p(x+w,y),c=p(x+w,y+d),e=p(x,y+d);
  poly(`${e} ${c} ${c[0]},${c[1]-h} ${e[0]},${e[1]-h}`,left);
  poly(`${b} ${c} ${c[0]},${c[1]-h} ${b[0]},${b[1]-h}`,right);
  poly(`${a[0]},${a[1]-h} ${b[0]},${b[1]-h} ${c[0]},${c[1]-h} ${e[0]},${e[1]-h}`,roof);
  return {a,b,c,e};
 }
 poly('8,137 80,100 152,137 80,174','#607b64');
 const base=box(-8,-8,16,16,7,'#bbb39a','#8b927d','#707f73');
 if(type==='studio_gate'){
  box(-7,-3,3,6,52,'#d1c4a1','#b9ad8c','#8c9a86');box(4,-3,3,6,52,'#d1c4a1','#b9ad8c','#8c9a86');
  box(-7,-3,14,2,57,'#d3c9a6','#c3b58f','#93a18d');r(61,107,37,8,'#304d59');
 }else if(type==='soundstage'||type==='virtual_led'){
  box(-7,-7,14,14,43,'#7f9ba1','#547583','#385566');
  box(-6,-6,12,12,47,'#91a7a5','#6c8b92','#456772');
  r(45,124,28,22,'#243a47');r(49,126,20,2,'#a7b6aa');r(49,131,20,2,'#a7b6aa');r(49,136,20,2,'#a7b6aa');
  r(92,118,21,12,type==='virtual_led'?'#88bbb4':'#d8bd79');r(96,121,13,2,'#324c56');
  for(let i=0;i<3;i++)r(66+i*13,98+i*3,9,4,'#344e58');
 }else if(type==='post_suite'){
  box(-6,-7,13,13,48,'#aaa9b3','#737b99','#515f7b');box(-3,-4,7,7,57,'#c3bcb6','#8490a0','#626f8a');
  r(39,118,32,10,'#243d51');for(let i=0;i<4;i++)r(41+i*8,120,5,6,'#9dbfbd');r(91,119,8,24,'#263f4e');
  poly('96,84 108,77 112,83 100,92','#c8c5b1');r(99,88,2,12,'#3e5361');
 }else if(type==='writers_bungalow'){
  box(-7,-6,14,12,29,'#b9a87c','#bfa77f','#9f926f');
  poly('24,107 79,71 136,109 80,139','#638570');poly('24,107 80,139 80,145 24,113','#405e57');
  r(48,124,12,12,'#b3cebc');r(64,132,10,15,'#324b4e');r(48,129,12,2,'#486860');
  box(-8,3,15,3,9,'#a8b499','#889d7f','#637d6b');
 }else if(type==='cinema_theater'){
  box(-7,-7,14,14,39,'#bd9f8b','#a65e57','#874d54');
  box(-8,1,16,5,25,'#dbc185','#c59467','#ab745b');r(30,124,45,10,'#edd8a2');
  r(38,139,12,14,'#293e4a');r(53,145,12,14,'#293e4a');r(83,93,29,20,'#d5c59d');r(86,96,23,14,'#314e60');
 }else if(type==='executive'){
  box(-5,-5,10,10,63,'#c7c4ae','#b2b8a7','#7a9693');
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)r(49+col*10,98+row*13+col*5,6,9,'#3d6374');
  box(-6,-6,12,12,68,'#d6cdb3','#a4b4a3','#7e9e95');r(89,120,9,27,'#2b4e5a');
 }else{
  box(-7,-5,14,10,28,'#b3aa8c','#8f927a','#6e8475');
  box(-5,-3,5,5,37,'#958771','#786a58','#6c6b5a');r(90,126,22,19,'#364e53');
 }
 // Planted corners keep scale and shadow treatment identical across facilities.
 for(const [x,y]of [[19,145],[132,145]]){r(x+4,y,3,10,'#5e6653');poly(`${x},${y} ${x+5},${y-15} ${x+12},${y} ${x+6},${y+4}`,'#527c62');}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="140" viewBox="0 40 160 140" shape-rendering="crispEdges">${out}</svg>`;
}
(async()=>{for(const type of ['soundstage','virtual_led','post_suite','writers_bungalow','studio_gate','backlot','cinema_theater','executive'])await sharp(Buffer.from(facility(type))).png().toFile(path.join(out,type+'.png'));console.log('Built 8 original isometric facilities.');})().catch(e=>{console.error(e);process.exitCode=1;});
