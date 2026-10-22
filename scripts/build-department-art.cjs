/* Original matched pixel-isometric production furniture. NE-facing stations:
   worker (0,0), desk (0,-1), monitor on far edge, chair back on +y edge.
   No downloaded assets; deterministic SVG -> nearest-neighbour PNG atlas. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const names=['chair-base','chair-back','cinema-base','cinema-back','executive-desk','post-desk','audio-desk','equipment-rack','speaker','light-stand','camera-case','projector','studio-flat','grading-wall','film-poster','awards-cabinet','meeting-table','reception-console','stage-monitor','film-cart'];
const frames={};
function art(name){let s='';const ink='#263d43',gold='#c6a16a',cream='#e8dfbd',metal='#587778';
const r=(x,y,w,h,c)=>s+=`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${w}" height="${h}" fill="${c}"/>`;
const poly=(p,c)=>s+=`<polygon points="${p.map(q=>q.map(Math.round).join(',')).join(' ')}" fill="${c}"/>`;
const pt=(x,y,h=0)=>[64+(x-y)*13,104+(x+y)*6.5-h];
function box(x,y,w,d,h,top=gold,left='#8b6c50',right='#655446',base=0){const a=pt(x,y,base),b=pt(x+w,y,base),c=pt(x+w,y+d,base),e=pt(x,y+d,base),up=p=>[p[0],p[1]-h];poly([e,c,up(c),up(e)],ink);poly([b,c,up(c),up(b)],ink);poly([up(a),up(b),up(c),up(e)],ink);poly([[e[0]+1,e[1]-1],[c[0],c[1]-1],[c[0],c[1]-h+1],[e[0]+1,e[1]-h+1]],left);poly([[b[0]-1,b[1]-1],[c[0],c[1]-1],[c[0],c[1]-h+1],[b[0]-1,b[1]-h+1]],right);poly([[a[0],a[1]-h+1],[b[0]-1,b[1]-h+1],[c[0],c[1]-h+1],[e[0]+1,e[1]-h+1]],top);}
function plane(x,y,w,height,bottom,color){const a=pt(x,y,bottom),b=pt(x+w,y,bottom);poly([a,b,[b[0],b[1]-height],[a[0],a[1]-height]],ink);poly([[a[0]+1,a[1]-1],[b[0]-1,b[1]-1],[b[0]-1,b[1]-height+1],[a[0]+1,a[1]-height+1]],color);}
function monitor(x,y,w=1,base=20){box(x+w*.4,y,.15,.2,4,metal,ink,ink,base-4);plane(x,y,w,10,base,'#415c64');for(let i=0;i<3;i++){const a=pt(x+.12,y,base+2+i*2),b=pt(x+w-.12,y,base+2+i*2);poly([a,b,[b[0],b[1]-1],[a[0],a[1]-1]],i%2?'#9bbba9':'#d4bc84');}}
if(name==='chair-base'||name==='cinema-base'){
 const movie=name==='cinema-base';for(const x of [-.38,.32])for(const y of [-.2,.23])box(x,y,.1,.1,4,metal,metal,ink);
 box(-.46,-.32,.92,.74,3,movie?'#aa6a64':'#98aa90',movie?'#824e51':'#5e7869',movie?'#683f47':'#45615b',4);
 if(movie)for(const x of [-.58,.43])box(x,-.28,.15,.75,3,'#b18c69','#76565a','#533d46',7);
}else if(name==='chair-back'||name==='cinema-back'){
 const movie=name==='cinema-back';box(-.46,.32,.92,.14,movie?9:6,movie?'#b77c70':'#adb89b',movie?'#8a5358':'#658470',movie?'#603e49':'#46665d',7);
 const a=pt(-.35,.47,11),b=pt(.35,.47,11);poly([a,b,[b[0],b[1]-1],[a[0],a[1]-1]],movie?'#bc8e79':'#b2bf9c');
}else if(['executive-desk','post-desk','audio-desk'].includes(name)){
 const exec=name==='executive-desk',audio=name==='audio-desk';for(const x of [-1,.9])for(const y of [-1.6,-.65])box(x,y,.13,.13,11,metal,metal,ink);
 box(-1.1,-1.7,2.2,1.3,3,exec?'#bd9b6d':'#81938e',exec?'#886749':'#526c6c',exec?'#695741':'#3c565c',11);
 box(-.85,-.65,1.4,.33,1,exec?'#5a7768':'#304c53',metal,ink,15);
 if(exec){monitor(-.2,-1.5,.85,18);const p=pt(-.7,-1.1,16);r(p[0]-3,p[1]-2,6,4,cream);r(p[0]-2,p[1]-1,4,1,'#9f9e80');box(.75,-1.3,.25,.4,2,'#293f45',ink,ink,15);}
 else{monitor(-.95,-1.5,.9,19);monitor(.08,-1.5,.9,19);for(let n=0;n<7;n++){const p=pt(-.65+n*.18,-.53,17);r(p[0],p[1],1,audio?3:1,n%3?'#b1c3b3':'#d5ad77');}if(audio)for(const x of [-1.1,1])box(x,-1.6,.22,.3,7,'#597476','#273e48','#263b43',15);}
}else if(name==='equipment-rack'||name==='awards-cabinet'){
 const awards=name==='awards-cabinet';box(-.7,-.25,1.4,.6,32,awards?'#b59c74':'#7c9390',awards?'#887054':'#3f5d66',awards?'#625441':'#304b54');
 for(let n=0;n<4;n++){const p=pt(-.58,.36,5+n*7);poly([[p[0],p[1]],[p[0]+14,p[1]+7],[p[0]+14,p[1]+2],[p[0],p[1]-5]],'#243e45');for(let i=0;i<5;i++)r(p[0]+1+i*2,p[1]-2+i,1,2,awards?gold:(i%2?'#97b5a2':gold));}
}else if(name==='speaker'){box(-.32,-.26,.64,.52,22,'#728781','#31494f','#22383f');const p=pt(-.2,.27,7);for(const dy of [0,-9]){r(p[0],p[1]+dy,5,6,ink);r(p[0]+1,p[1]+dy+1,3,4,'#617579');}}
else if(name==='light-stand'){for(const x of [-.5,.45])box(x,0,.1,.1,2,metal,metal,ink);r(63,67,2,38,metal);box(-.5,-.25,1,.5,9,'#42545a','#e0d1a2','#243b43',31);const p=pt(-.4,.26,35);r(p[0]+1,p[1]-3,8,5,cream);}
else if(name==='camera-case'||name==='film-cart'){box(-.6,-.35,1.2,.7,12,'#6d8583','#3d5c63','#2b454e');for(const x of [-.5,.45])box(x,.3,.12,.12,2,ink,ink,ink);const p=pt(-.45,.36,8);r(p[0]+2,p[1]-2,5,2,gold);if(name==='film-cart')monitor(-.5,-.15,.8,18);}
else if(name==='projector'){box(-.5,-.3,1,.6,11,'#a6af9e','#607579','#41585f',12);box(-.3,-.05,.5,.45,5,'#b3bea9','#3b5660','#243e48',18);box(-.7,-.35,1.4,.9,3,gold,metal,ink,10);for(const x of [-.6,.5])box(x,.25,.1,.1,10,metal,metal,ink);}
else if(name==='studio-flat'){
 plane(-1.7,0,3.4,45,0,'#c5bba0');for(let n=0;n<8;n++){const p=pt(-1.65+n*.4,.02,3);r(p[0],p[1]-38,1,35,'#aea891');}plane(-1.5,.04,1.1,27,12,'#769a99');plane(.2,.04,1.1,27,12,'#577b87');for(const x of [-1.3,.4]){const p=pt(x,.07,24);r(p[0],p[1]-7,1,16,cream);}box(-1.8,-.05,3.6,.2,3,'#d5c59d',gold,ink);
}else if(name==='grading-wall'){
 plane(-1.7,0,3.4,32,12,'#233d49');plane(-1.55,.02,3.1,25,15,'#547984');for(let i=0;i<7;i++){const p=pt(-1.4+i*.42,.04,18);r(p[0],p[1]-3-i%3*3,4,5+i%3*3,['#b2b497','#718f91','#c6ac7f'][i%3]);}
}else if(name==='film-poster'){plane(-.6,0,1.2,30,12,'#b99a72');plane(-.5,.02,1,27,13,'#345a68');const p=pt(-.35,.04,29);r(p[0],p[1],7,1,cream);r(p[0]+2,p[1]+3,5,7,'#bc996e');r(p[0],p[1]+13,7,1,cream);}
else if(name==='meeting-table'){for(const x of [-.7,.6])box(x,.1,.12,.12,9,metal,metal,ink);box(-.9,-.5,1.8,1,3,'#c5ab7e','#8c7153','#665644',9);const p=pt(0,0,13);r(p[0]-4,p[1]-2,6,4,cream);}
else if(name==='reception-console'){box(-.7,-.3,1.4,.6,17,'#c8b58b','#907759','#685846');monitor(-.3,-.1,.6,20);}
else if(name==='stage-monitor'){monitor(-.65,0,1.3,24);box(-.2,.05,.15,.15,24,metal,metal,ink);box(-.6,-.2,1.2,.5,2,metal,metal,ink);}
return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" shape-rendering="crispEdges">${s}</svg>`;
}
(async()=>{const tiles=[];for(let i=0;i<names.length;i++){const x=i%5*256,y=Math.floor(i/5)*256;frames[names[i]]={x,y,w:256,h:256,ax:128,ay:208};tiles.push({input:await sharp(Buffer.from(art(names[i]))).resize(256,256,{kernel:'nearest'}).png().toBuffer(),left:x,top:y});}const root=path.resolve(__dirname,'../assets/studio');await sharp({create:{width:1280,height:Math.ceil(names.length/5)*256,channels:4,background:'#00000000'}}).composite(tiles).png().toFile(path.join(root,'department-furniture.png'));fs.writeFileSync(path.join(root,'department-furniture.json'),JSON.stringify(frames,null,2)+'\n');const renderer=path.resolve(__dirname,'../studio-departments.js');fs.writeFileSync(renderer,fs.readFileSync(renderer,'utf8').replace(/const departmentFrames=\{[^\n]*\};/,'const departmentFrames='+JSON.stringify(frames)+';'));let scene='<rect width="160" height="80" fill="#304b60"/><rect y="42" width="160" height="38" fill="#567478"/><rect x="124" y="9" width="11" height="11" fill="#e2d3ad"/>';for(let n=0;n<15;n++){const x=n*12-4,h=15+(n*7%22);scene+=`<rect x="${x}" y="${65-h}" width="11" height="${h}" fill="${n%2?'#38565f':'#78928a'}"/>`;for(let yy=69-h;yy<63;yy+=6)for(let xx=x+2;xx<x+10;xx+=4)scene+=`<rect x="${xx}" y="${yy}" width="2" height="3" fill="${(xx+yy)%3?'#c7b991':'#9eaea1'}"/>`;}scene+='<rect y="65" width="160" height="15" fill="#253f4a"/><rect y="68" width="160" height="1" fill="#a89e7f"/><rect x="28" y="53" width="4" height="15" fill="#243b43"/><rect x="27" y="49" width="5" height="5" fill="#d0b28c"/><rect x="37" y="55" width="4" height="13" fill="#bf9278"/><rect x="37" y="51" width="4" height="4" fill="#d4bb90"/>';await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" shape-rendering="crispEdges">${scene}</svg>`)).png().toFile(path.join(root,'screening-still.png'));console.log('Built',names.length,'matched original department props');})();
