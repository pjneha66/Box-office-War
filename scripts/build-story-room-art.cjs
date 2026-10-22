/* Original 64px pixel-isometric furniture. Shared ink, wood and textile palette. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const names=['desk_SE','deskCorner_SE','chairDesk_NW','bookcaseOpen_SE','pottedPlant_SE','plantSmall1_SE','lampRoundFloor_SE','loungeSofa_SE','tableCoffee_SE','coatRackStanding_SE','kitchenCabinetDrawer_SE','kitchenCoffeeMachine_SE','loungeChairRelax_SE'];
const frames={};
function art(name){let body='';const ink='#243e42',wood='#9d7651',light='#d3ac75',cream='#f0dfb2',green='#547c69';
 const r=(x,y,w,h,c)=>body+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
 const poly=(ps,c)=>body+=`<polygon points="${ps.map(p=>p.join(',')).join(' ')}" fill="${c}"/>`;
 const pt=(x,y,h=0)=>[Math.round(32+(x-y)*13),Math.round(49+(x+y)*6.5-h)];
 function box(x,y,w,d,h,top=light,left=wood,right='#715c48',base=0){const a=pt(x,y,base),b=pt(x+w,y,base),c=pt(x+w,y+d,base),e=pt(x,y+d,base),up=p=>[p[0],p[1]-h];poly([e,c,up(c),up(e)],ink);poly([b,c,up(c),up(b)],ink);poly([up(a),up(b),up(c),up(e)],ink);poly([[e[0]+1,e[1]-1],[c[0],c[1]-1],[c[0],c[1]-h+1],[e[0]+1,e[1]-h+1]],left);poly([[b[0]-1,b[1]-1],[c[0],c[1]-1],[c[0],c[1]-h+1],[b[0]-1,b[1]-h+1]],right);poly([[a[0],a[1]-h+1],[b[0]-1,b[1]-h+1],[c[0],c[1]-h+1],[e[0]+1,e[1]-h+1]],top);}
 if(name.startsWith('desk')){
  for(const [x,y]of [[-1,-.4],[.7,-.4],[-1,.5],[.7,.5]])box(x,y,.15,.15,13,'#bf9a66','#856343','#5a4f3e');
  box(-1.15,-.55,2.3,1.15,4,light,wood,'#826747',13);
  const p=pt(.3,-.1,20);r(p[0]-9,p[1]-3,12,7,ink);r(p[0]-8,p[1]-4,10,6,'#718b80');r(p[0]-6,p[1]-8,7,5,cream);r(p[0]-5,p[1]-6,5,1,'#9d9a7b');for(let i=0;i<4;i++)r(p[0]-7+i*2,p[1]+1,1,1,cream);
  const q=pt(-.7,-.1,18);r(q[0]-4,q[1]-2,7,5,'#cbd0b2');r(q[0]-3,q[1]-3,6,4,cream);r(q[0]-2,q[1]-2,4,1,'#899a8e');
 }else if(name==='chairDesk_NW'||name==='loungeChairRelax_SE'){
  box(-.4,-.3,.8,.7,5,'#b1b49a','#596f64','#3b5952',6);box(-.4,-.4,.8,.15,17,'#bdc4a6',green,'#3b5952',8);for(const x of [-.35,.3])box(x,.2,.1,.1,8,wood,wood,ink);
 }else if(name==='bookcaseOpen_SE'){
  box(-.7,-.3,1.4,.6,36,'#c5a16b','#9b784f','#685641');
  for(let row=0;row<3;row++){const p=pt(-.62,.32,8+row*10);poly([[p[0],p[1]],[p[0]+17,p[1]+8],[p[0]+17,p[1]+1],[p[0],p[1]-7]],'#3d4b43');for(let i=0;i<6;i++){const x=p[0]+1+i*2,y=p[1]-5+Math.floor(i);r(x,y,2,6,['#9a6057','#75988a','#c4ad77','#7b8d9e'][i%4]);r(x,y+1,1,1,cream);}}
 }else if(name.includes('Plant')||name==='plantSmall1_SE'){
  box(-.25,-.25,.5,.5,8,'#b5a174','#977655','#6b6550');r(31,26,2,21,'#61724f');for(const [x,y,w,h]of [[25,24,5,10],[33,19,4,13],[23,33,7,6],[34,30,7,7],[28,16,4,14]]){r(x,y,w,h,ink);r(x+1,y+1,w-1,h-2,green);r(x+1,y+2,1,h-4,'#8ba47a');}
 }else if(name==='lampRoundFloor_SE'){
  box(-.3,-.3,.6,.6,2,'#c8b78b','#7e866c','#52685f');r(31,20,2,31,'#c0b28a');poly([[26,13],[35,17],[39,29],[24,23]],ink);poly([[27,14],[34,18],[37,27],[26,23]],cream);r(30,11,2,4,'#cfb47b');
 }else if(name==='loungeSofa_SE'||name==='loungeChairRelax_SE'){
  box(-1,-.4,2,.9,7,'#9fae8c','#627c69','#3e5c53',4);box(-1,-.55,2,.2,15,'#a8b68f','#6d8a71','#4d6a5c',7);for(const x of [-1, .8])box(x,-.3,.2,.9,10,'#a1b08b','#758a70','#4e6b5b',5);box(-.6,-.1,.55,.4,2,'#c6ba8f','#b2a67b','#807f64',12);
 }else if(name==='tableCoffee_SE'){
  for(const x of [-.5,.4])box(x,.1,.1,.1,8,wood,wood,ink);box(-.6,-.35,1.2,.7,3,light,wood,'#6f604a',8);const p=pt(0,0,13);r(p[0]-4,p[1],6,3,'#729185');r(p[0]-3,p[1]-1,5,2,cream);
 }else if(name==='coatRackStanding_SE'){
  box(-.35,-.35,.7,.7,2,light,wood,ink);r(31,15,2,37,wood);r(25,21,14,2,wood);r(25,18,2,5,wood);r(37,18,2,5,wood);r(34,24,4,10,'#647c72');
 }else if(name==='kitchenCabinetDrawer_SE'){
  box(-.65,-.4,1.3,.8,18,cream,wood,'#715d46');const p=pt(-.5,.45,11);r(p[0],p[1],11,1,'#5f5843');r(p[0]+4,p[1]-4,4,1,'#ceb887');
 }else if(name==='kitchenCoffeeMachine_SE'){
  box(-.3,-.25,.6,.5,13,'#8eaaa0','#405e59','#304b49');const p=pt(0,.25,8);r(p[0]-2,p[1]-4,5,6,ink);r(p[0]-1,p[1]+1,3,3,cream);r(p[0]+4,p[1]-6,1,1,'#d3b36f');
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" shape-rendering="crispEdges">${body}</svg>`;
}
(async()=>{const root=path.resolve(__dirname,'../assets/studio'),tiles=[];for(let i=0;i<names.length;i++){const x=i%5*128,y=Math.floor(i/5)*128;frames[names[i]]={x,y,w:128,h:128,ax:64,ay:98};tiles.push({input:await sharp(Buffer.from(art(names[i]))).resize(128,128,{kernel:'nearest'}).png().toBuffer(),left:x,top:y});}
 await sharp({create:{width:640,height:384,channels:4,background:'#00000000'}}).composite(tiles).png().toFile(path.join(root,'story-furniture.png'));fs.writeFileSync(path.join(root,'story-furniture.json'),JSON.stringify(frames,null,2)+'\n');const renderer=path.resolve(__dirname,'../studio-departments.js');fs.writeFileSync(renderer,fs.readFileSync(renderer,'utf8').replace(/const storyFrames=\{[^\n]+\};/,'const storyFrames='+JSON.stringify(frames)+';'));console.log('Built original story-room pixel furniture:',names.length);})();
