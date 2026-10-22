/* Simulated cutaway departments. Reads the canonical lot only; never advances it. */
(function(global){
 'use strict';
 const types={soundstage:['soundstage','virtual_led','led_volume'],writers:['writers_bungalow'],post:['post_suite'],cinema:['cinema_theater'],executive:['executive']};
 const titles={soundstage:'Production stage',writers:'Story & development',post:'Editing & finishing',cinema:'Premiere cinema',executive:'Studio office'};
 const hits=[];let current=null;let lastLayout=null;let projector=null;
 const furnitureFrames={"bookcaseOpen_SE":{"x":0,"y":0,"w":128,"h":128},"books_SE":{"x":128,"y":0,"w":128,"h":128},"cardboardBoxClosed_SE":{"x":256,"y":0,"w":128,"h":128},"cardboardBoxOpen_SE":{"x":384,"y":0,"w":128,"h":128},"chairCushion_SE":{"x":512,"y":0,"w":128,"h":128},"chairDesk_NW":{"x":0,"y":128,"w":128,"h":128},"coatRackStanding_SE":{"x":128,"y":128,"w":128,"h":128},"computerKeyboard_SE":{"x":256,"y":128,"w":128,"h":128},"computerScreen_SE":{"x":384,"y":128,"w":128,"h":128},"deskCorner_SE":{"x":512,"y":128,"w":128,"h":128},"desk_SE":{"x":0,"y":256,"w":128,"h":128},"kitchenCabinetDrawer_SE":{"x":128,"y":256,"w":128,"h":128},"kitchenCoffeeMachine_SE":{"x":256,"y":256,"w":128,"h":128},"lampRoundFloor_SE":{"x":384,"y":256,"w":128,"h":128},"loungeChairRelax_SE":{"x":512,"y":256,"w":128,"h":128},"loungeSofa_SE":{"x":0,"y":384,"w":128,"h":128},"plantSmall1_SE":{"x":128,"y":384,"w":128,"h":128},"pottedPlant_SE":{"x":256,"y":384,"w":128,"h":128},"rugRectangle_SE":{"x":384,"y":384,"w":128,"h":128},"tableCoffee_SE":{"x":512,"y":384,"w":128,"h":128},"televisionModern_SE":{"x":0,"y":512,"w":128,"h":128},"trashcan_SE":{"x":128,"y":512,"w":128,"h":128}};
 const furniture=new Image();let furnitureReady=false;furniture.onload=()=>{furnitureReady=true;};furniture.onerror=()=>console.warn('Furniture atlas unavailable; using geometric fallback.');furniture.src='assets/vendor/kenney-furniture/atlas.png';
 const storyFrames={"desk_SE":{"x":0,"y":0,"w":128,"h":128,"ax":64,"ay":98},"deskCorner_SE":{"x":128,"y":0,"w":128,"h":128,"ax":64,"ay":98},"chairDesk_NW":{"x":256,"y":0,"w":128,"h":128,"ax":64,"ay":98},"bookcaseOpen_SE":{"x":384,"y":0,"w":128,"h":128,"ax":64,"ay":98},"pottedPlant_SE":{"x":512,"y":0,"w":128,"h":128,"ax":64,"ay":98},"plantSmall1_SE":{"x":0,"y":128,"w":128,"h":128,"ax":64,"ay":98},"lampRoundFloor_SE":{"x":128,"y":128,"w":128,"h":128,"ax":64,"ay":98},"loungeSofa_SE":{"x":256,"y":128,"w":128,"h":128,"ax":64,"ay":98},"tableCoffee_SE":{"x":384,"y":128,"w":128,"h":128,"ax":64,"ay":98},"coatRackStanding_SE":{"x":512,"y":128,"w":128,"h":128,"ax":64,"ay":98},"kitchenCabinetDrawer_SE":{"x":0,"y":256,"w":128,"h":128,"ax":64,"ay":98},"kitchenCoffeeMachine_SE":{"x":128,"y":256,"w":128,"h":128,"ax":64,"ay":98},"loungeChairRelax_SE":{"x":256,"y":256,"w":128,"h":128,"ax":64,"ay":98}};
 const storyArt=new Image();let storyReady=false;storyArt.onload=()=>{storyReady=true;};storyArt.onerror=()=>console.warn('Story-room pixel atlas unavailable; using licensed fallback.');storyArt.src='assets/studio/story-furniture.png';
 const departmentFrames={"chair-base":{"x":0,"y":0,"w":256,"h":256,"ax":128,"ay":208},"chair-back":{"x":256,"y":0,"w":256,"h":256,"ax":128,"ay":208},"cinema-base":{"x":512,"y":0,"w":256,"h":256,"ax":128,"ay":208},"cinema-back":{"x":768,"y":0,"w":256,"h":256,"ax":128,"ay":208},"executive-desk":{"x":1024,"y":0,"w":256,"h":256,"ax":128,"ay":208},"post-desk":{"x":0,"y":256,"w":256,"h":256,"ax":128,"ay":208},"audio-desk":{"x":256,"y":256,"w":256,"h":256,"ax":128,"ay":208},"equipment-rack":{"x":512,"y":256,"w":256,"h":256,"ax":128,"ay":208},"speaker":{"x":768,"y":256,"w":256,"h":256,"ax":128,"ay":208},"light-stand":{"x":1024,"y":256,"w":256,"h":256,"ax":128,"ay":208},"camera-case":{"x":0,"y":512,"w":256,"h":256,"ax":128,"ay":208},"projector":{"x":256,"y":512,"w":256,"h":256,"ax":128,"ay":208},"studio-flat":{"x":512,"y":512,"w":256,"h":256,"ax":128,"ay":208},"grading-wall":{"x":768,"y":512,"w":256,"h":256,"ax":128,"ay":208},"film-poster":{"x":1024,"y":512,"w":256,"h":256,"ax":128,"ay":208},"awards-cabinet":{"x":0,"y":768,"w":256,"h":256,"ax":128,"ay":208},"meeting-table":{"x":256,"y":768,"w":256,"h":256,"ax":128,"ay":208},"reception-console":{"x":512,"y":768,"w":256,"h":256,"ax":128,"ay":208},"stage-monitor":{"x":768,"y":768,"w":256,"h":256,"ax":128,"ay":208},"film-cart":{"x":1024,"y":768,"w":256,"h":256,"ax":128,"ay":208}};
 const departmentArt=new Image();let departmentReady=false;departmentArt.onload=()=>{departmentReady=true;};departmentArt.onerror=()=>console.warn('Department furniture atlas unavailable');departmentArt.src='assets/studio/department-furniture.png';
 const screeningStill=new Image();let stillReady=false;screeningStill.onload=()=>{stillReady=true;};screeningStill.src='assets/studio/screening-still.png';
 const themes={writers:{title:'The writers’ room',kicker:'STUDIO / STORY & DEVELOPMENT',wall:'#dce0d3',trim:'#547c69'},executive:{title:'The studio office',kicker:'STUDIO / LEADERSHIP & STRATEGY',wall:'#e0d8bd',trim:'#52695d'},post:{title:'Picture, sound & finishing',kicker:'STUDIO / POST-PRODUCTION',wall:'#8eaaa7',trim:'#354e59'},soundstage:{title:'On the soundstage',kicker:'STUDIO / PRINCIPAL PHOTOGRAPHY',wall:'#a9b2a6',trim:'#3c5360'},cinema:{title:'The screening room',kicker:'STUDIO / PREMIERES & AUDIENCES',wall:'#bda99b',trim:'#694950'}};
 // A presentation pose, never a movement/task mutation. All stations face grid -y
 // (screen upper-right). LPC's east profile is the corresponding seated view.
 function presentation(a,view,peers=[]){
  const x=3+(a.workstation||0)%3*3,y=3+Math.floor((a.workstation||0)/3)*3;
  const desk=['writers','post','executive'].includes(view),screen=view==='cinema'&&a.kind_str==='audience';
  const seated=(desk||screen)&&a.inside&&a.state_str!=='walking'&&!a.indoor_path?.length&&Math.hypot(a.indoor_x-x,a.indoor_y-y)<.08&&['work','review','available','hold','screening','screeningReaction'].includes(a.life?.task?.type);
  let direction=seated?'east':a.direction;
  if(view==='soundstage'&&a.state_str!=='walking'&&a.life?.state==='perform'&&['work','review'].includes(a.life?.task?.type)){
   const target=a.kind_str==='star_actor'?peers.find(v=>v.kind_str==='cameraman'&&v.specialty!=='lighting'):peers.find(v=>v.kind_str==='star_actor');
   if(target){const dx=target.indoor_x-a.indoor_x,dy=target.indoor_y-a.indoor_y,sx=dx-dy,sy=(dx+dy)/2;if(Math.hypot(dx,dy)>.25)direction=Math.abs(sx)>Math.abs(sy)?sx>0?'east':'west':sy>0?'south':'north';}
  }
  return {...a,renderSeat:seated,direction};
 }
 const interiorOptions={
  style:{original:'Original room design',warm:'Warm wood & cream',slate:'Cool slate & teal',premiere:'Premiere burgundy'},
  floor:{original:'Original flooring',wood:'Timber boards',carpet:'Carpet',checker:'Checkered tiles'},
  seating:{original:'Original upholstery',sage:'Sage green',wine:'Wine red',navy:'Navy blue'},
  decor:{original:'Original decorations',plants:'Extra plants',awards:'Awards display'}
 };
 const finishes={warm:{wall:'#dfcfaf',trim:'#806248',floor:['#c2a275','#b7976c']},slate:{wall:'#a3b9ba',trim:'#395d69',floor:['#66838a','#607b83']},premiere:{wall:'#bca1a3',trim:'#713f50',floor:['#76515c','#6e4954']}};
 function interiorSettings(g,id){const raw=g?.lotInteriors?.[id]||{};return Object.fromEntries(Object.entries(interiorOptions).map(([key,values])=>[key,Object.hasOwn(values,raw[key])?raw[key]:'original']));}
 function setInteriorSettings(g,ids,settings){
  if(!g||!Array.isArray(ids)||!ids.length)return false;
  if(Object.keys(interiorOptions).some(key=>!Object.hasOwn(interiorOptions[key],settings?.[key])))return false;
  const next={...(g.lotInteriors||{})};for(const id of ids)next[id]={...settings};g.lotInteriors=next;return true;
 }
 const seatAtlases=new Map();
 function seatingAtlas(finish){
  if(finish==='original'||!departmentReady)return departmentArt;
  if(seatAtlases.has(finish))return seatAtlases.get(finish);
  const canvas=document.createElement('canvas');canvas.width=departmentArt.naturalWidth;canvas.height=departmentArt.naturalHeight;const c=canvas.getContext('2d');c.drawImage(departmentArt,0,0);
  const shades={sage:['#98aa90','#5e7869','#45615b','#adb89b','#658470','#46665d','#b2bf9c'],wine:['#aa6a64','#824e51','#683f47','#b77c70','#8a5358','#603e49','#bc8e79'],navy:['#6f8d9c','#435e75','#314656','#8ca2ad','#526b83','#344c65','#a4b8c0']}[finish];
  if(!shades)return departmentArt;
  const native=[['98aa90','5e7869','45615b','adb89b','658470','46665d','b2bf9c'],['aa6a64','824e51','683f47','b77c70','8a5358','603e49','bc8e79']],map=new Map();for(const row of native)row.forEach((hex,i)=>map.set(parseInt(hex,16),shades[i].slice(1).match(/../g).map(v=>parseInt(v,16))));
  const image=c.getImageData(0,0,1024,256),d=image.data;for(let i=0;i<d.length;i+=4){const color=map.get((d[i]<<16)|(d[i+1]<<8)|d[i+2]);if(color){d[i]=color[0];d[i+1]=color[1];d[i+2]=color[2];}}c.putImageData(image,0,0);seatAtlases.set(finish,canvas);return canvas;
 }
 const palette={floor:'#bdab8a',edge:'#667e7d',wall:'#dce0d3',ink:'#22343d',wood:'#ad8662',metal:'#526e7b',screen:'#8ac0bb'};
 function select(engine,view,id){const list=engine.buildings.filter(b=>types[view]?.includes(b.b_type));return list.find(b=>b.id===id)||list.find(b=>b.active_project_id)||list[0];}
 function draw(ctx,engine,view,id,width,height,selected,reduced,camera={x:0,y:0,zoom:1}){
  const building=select(engine,view,id);current=building;
  const interior=interiorSettings(typeof G!=='undefined'?G:global.G,building?.id),finish=finishes[interior.style],roomTheme=finish||themes[view];hits.length=0;
  ctx.fillStyle='#182c32';ctx.fillRect(0,0,width,height);
  const staff=engine.agents.filter(a=>a.inside&&a.assigned_building_id===building?.id);
  const slots=Math.max(view==='cinema'?9:3,...staff.map(a=>(a.workstation||0)+1));
  // Same workstation grid as the engine; a separate right-hand service strip
  // keeps large scenery off the traversable x=1..10 indoor navigation grid.
  const rows=Math.max(view==='writers'?10:12,3+Math.ceil(slots/3)*3),cols=14;
  const rawArea=camera.viewport||{x:16,y:76,w:width-32,h:Math.max(60,height-210)};
  const headerHeight=width>=1000?66:0;
  const area={...rawArea,y:rawArea.y+headerHeight,h:Math.max(60,rawArea.h-headerHeight)};
  const minX=-rows*30-35,maxX=cols*30+35,minY=view==='cinema'?-165:-95,maxY=(rows+cols)*15+35;
  const z=Math.max(.08,Math.min(1.6,area.w/(maxX-minX),area.h/(maxY-minY)))*camera.zoom;
  const ox=area.x+area.w/2-(minX+maxX)*z/2+camera.x,oy=area.y+area.h/2-(minY+maxY)*z/2+camera.y;
  const point=(x,y)=>({x:ox+(x-y)*30*z,y:oy+(x+y)*15*z});
  projector=point;
  const objects=[];
  lastLayout={view,interior:{...interior},stationFacing:'east',furnitureReady:departmentReady,seatAnchors:[],area:{...area},bounds:{x:ox+minX*z,y:oy+minY*z,w:(maxX-minX)*z,h:(maxY-minY)*z},cols,rows,stations:Array.from({length:slots},(_,i)=>({x:3+i%3*3,y:3+Math.floor(i/3)*3}))};
  function paintProp(name,x,y,size=72,lift=0){
   if(!furnitureReady&&!storyReady)return false;const pixel=storyReady&&storyFrames[name],f=pixel||furnitureFrames[name];if(!f)return false;
   const p=point(x,y),w=size*z*(pixel?1.4:1),ax=pixel?f.ax/128:.5,ay=pixel?f.ay/128:1;
   ctx.drawImage(pixel?storyArt:furniture,f.x,f.y,128,128,Math.round(p.x-w*ax),Math.round(p.y-w*ay-lift*z),Math.round(w),Math.round(w));return true;
  }
  function prop(name,x,y,size=72,lift=0,depthOffset=0){
   if(!furnitureReady)return false;
   objects.push({depth:x+y+depthOffset,draw:()=>paintProp(name,x,y,size,lift)});return true;
  }
  function media(name,x,y,depth=x+y){objects.push({depth,draw:()=>{
   if(!departmentReady)return;const f=departmentFrames[name];if(!f)return;
   const p=point(x,y),w=296*z;ctx.imageSmoothingEnabled=false;ctx.drawImage(name.startsWith('chair-')||name.startsWith('cinema-')?seatingAtlas(interior.seating):departmentArt,f.x,f.y,f.w,f.h,Math.round(p.x-w*f.ax/f.w),Math.round(p.y-w*f.ay/f.h),Math.round(w),Math.round(w));
  }});}
  function wallPanel(side,start,end,bottom,top,color){
   const a=side==='left'?point(.25,start):point(start,.25),b=side==='left'?point(.25,end):point(end,.25);
   ctx.beginPath();ctx.moveTo(a.x,a.y-top*z);ctx.lineTo(b.x,b.y-top*z);ctx.lineTo(b.x,b.y-bottom*z);ctx.lineTo(a.x,a.y-bottom*z);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#365762';ctx.lineWidth=2*z;ctx.stroke();
  }
  function tile(x,y,color){const p=point(x,y);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+30*z,p.y+15*z);ctx.lineTo(p.x,p.y+30*z);ctx.lineTo(p.x-30*z,p.y+15*z);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=view==='soundstage'?'#546a71':'#aa9c80';ctx.lineWidth=.5;ctx.stroke();}
  function block(x,y,w,d,h,color){const a=point(x,y),b=point(x+w,y),c=point(x+w,y+d),e=point(x,y+d);const face=(pts,col)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=col;ctx.fill();};
   const top=p=>({x:p.x,y:p.y-h*z});face([e,c,top(c),top(e)],'#5c6d69');face([b,c,top(c),top(b)],'#7f8c7d');face([top(a),top(b),top(c),top(e)],color);
  }
  // Materials follow department function; stable deterministic detail, no animated noise.
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const colors=view==='soundstage'?['#586a70','#607378']:view==='post'?['#798989','#82918d']:view==='cinema'?['#6c5756','#765e58']:['#c4b18e','#bfab87'];
   let color=colors[(x+y)%2];
   if(view==='writers'){
    color=['#c6b68e','#c1b08a','#caba94'][(x*3+y)%3];
    if(x>=2&&x<=10&&y>=2&&y<=4)color=(x+y)%2?'#6f8d7c':'#789481';
    if(x>=11&&y>=5)color=(x+y)%2?'#a69c7c':'#aea385';
    if(y===8&&x<11)color='#d7c79f';
   }
   if(view==='executive'){color=['#b7a27d','#bfad87','#b6a17b'][(x+y)%3];if(x>=2&&x<=10&&y>=2&&y<=7)color=(x+y)%2?'#698575':'#708c7b';}
   if(view==='post'){color=(x+y)%2?'#607b7e':'#698487';if(x>=2&&x<=10&&y>=2&&y<=9)color=(x+y)%2?'#425f67':'#49666d';if(x===1||x===11)color='#a69e82';}
   if(view==='soundstage'){color=(x+y)%2?'#637778':'#6a7e7d';if(x>=2&&x<=10&&y>=2&&y<=8)color=(x+y)%2?'#b29d79':'#bba684';if(x===11)color='#b4a477';}
   if(view==='cinema'){color=(x+y)%2?'#62434b':'#6a4850';if(x===1||x===11||y===11)color='#aa926f';if((x===4||x===7)&&y>1&&y<11)color='#886456';}
   if(finish)color=finish.floor[(x+y)%2];
   if(interior.floor==='wood')color=(x+y)%2?'#bea073':'#b6976c';
   if(interior.floor==='carpet')color=finish?finish.floor[0]:'#6b8076';
   if(interior.floor==='checker')color=(x+y)%2?'#b8b9a4':'#536d72';
   tile(x,y,color);
   if(interior.floor==='wood'||interior.floor==='original'&&(view==='writers'||view==='executive'||view==='soundstage'&&x>=2&&x<=10&&y>=2&&y<=8)){const a=point(x+.13,y+.08),b=point(x+.9,y+.08);ctx.strokeStyle='#d6c6a6';ctx.beginPath();ctx.moveTo(a.x,a.y+9*z);ctx.lineTo(b.x,b.y+9*z);ctx.stroke();}
  }
  block(0,0,cols,.22,view==='cinema'?136:60,roomTheme.wall);block(0,0,.22,rows,view==='cinema'?136:60,roomTheme.wall);
  block(0,0,cols,.24,22,roomTheme.trim);block(0,0,.24,rows,22,roomTheme.trim);
  block(0,0,cols,.25,25,'#b9a16a');block(0,0,.25,rows,25,'#b9a16a');
  block(0,rows,cols,.16,7,'#607c7c');block(cols,0,.16,rows,7,'#607c7c');
  // Windows and noticeboard use the wall plane, not screen-aligned rectangles.
  if(['writers','executive'].includes(view))for(let n=0;n<3;n++)wallPanel('left',1.3+n*3,2.8+n*3,30,54,'#a9c7bd');
  if(view==='writers')wallPanel('back',6,9.4,32,55,'#37565a');
  if(view==='post'||view==='cinema')for(let n=0;n<5;n++){wallPanel('left',.6+n*2,.6+n*2+1.3,8,view==='cinema'?126:54,n%2?'#405b60':'#344e57');if(view==='post')wallPanel('back',.7+n*2,.7+n*2+1.2,10,53,'#436169');}
  if(view==='executive'){wallPanel('back',5.6,10.8,20,55,'#5a7263');for(let n=0;n<4;n++)wallPanel('back',6+n*1.1,6.7+n*1.1,28,47,n%2?'#c2b185':'#9eaa8b');}

  if(view==='writers'){
   // A physical story board on the wall plane, not a floating screen overlay.
   wallPanel('back',5.6,11,27,56,'#8b795b');
   for(let i=0;i<6;i++){const x=6+(i%3)*1.5,h=34+Math.floor(i/3)*12;wallPanel('back',x,x+.85,h,h+8,['#dfd6b0','#b5c1a1','#c5a989'][i%3]);}
  }
  if(view==='writers'||view==='executive'){
    if(!prop('bookcaseOpen_SE',.65,3,80))block(.5,1,1,4,28,'#947c5e');
    prop('bookcaseOpen_SE',.65,5.3,80);
  }
  prop('pottedPlant_SE',1,.9,68);prop('pottedPlant_SE',12.8,1,68);
  if(view==='writers'||view==='executive'){
   prop('lampRoundFloor_SE',.65,rows-2.5,70);prop('loungeSofa_SE',12.2,rows-2.7,86);prop('tableCoffee_SE',12.2,rows-4.5,58);prop('coatRackStanding_SE',.65,rows-1,60);
   prop('kitchenCabinetDrawer_SE',12.2,3.4,68);prop('kitchenCoffeeMachine_SE',12.2,3.4,27,45);
  }
  if(view==='executive'){media('awards-cabinet',.65,7.8);media('meeting-table',12.2,7);media('film-poster',4,.3);}
  if(view==='post'){
   media('grading-wall',8,.3);media('equipment-rack',12.2,3.2);media('equipment-rack',12.2,5.5);media('speaker',.65,3.5);media('speaker',.65,7);media('film-cart',12.2,8.2);
  }
  if(view==='soundstage'){
   media('studio-flat',6,.3);media('studio-flat',9.6,.3);media('light-stand',.65,2.5);media('light-stand',12.2,2.8);media('stage-monitor',12.2,6);media('camera-case',.65,7.6);media('camera-case',12.2,8.5);media('film-cart',.65,5);
   // Tape marks belong to actual cast stations, not invented moving decorations.
   for(const a of staff.filter(a=>a.kind_str==='star_actor')){const x=3+(a.workstation||0)%3*3,y=3+Math.floor((a.workstation||0)/3)*3;const p=point(x,y);ctx.strokeStyle='#dbc789';ctx.lineWidth=2*z;ctx.beginPath();ctx.moveTo(p.x-7*z,p.y);ctx.lineTo(p.x+7*z,p.y);ctx.moveTo(p.x,p.y-4*z);ctx.lineTo(p.x,p.y+4*z);ctx.stroke();}
  }
  if(interior.decor==='plants')for(const x of [2,5,8,11])prop('pottedPlant_SE',x,rows-.6,60);
  if(interior.decor==='awards')for(const x of [2,6,10])media('awards-cabinet',x,rows-.6);
  if(view==='cinema'){
   // Screen is on the grid -y wall; every seat and seated patron faces it.
   wallPanel('back',2.8,10.2,9,130,'#283d46');wallPanel('back',3.05,9.95,14,125,'#aebeb0');
   const watching=staff.some(a=>a.life?.state==='perform'&&['screening','screeningReaction'].includes(a.life?.task?.type));
   if(stillReady&&watching){const a=point(3.08,.25),b=point(9.92,.25),h=110*z;ctx.save();ctx.transform((b.x-a.x)/160,(b.y-a.y)/160,0,h/80,a.x,a.y-125*z);ctx.imageSmoothingEnabled=false;ctx.drawImage(screeningStill,0,0,160,80);ctx.restore();}
   else wallPanel('back',3.08,9.92,15,125,'#596d71');
   wallPanel('back',2.4,2.8,4,134,'#81515a');wallPanel('back',10.2,10.6,4,134,'#81515a');
   media('speaker',.65,3);media('speaker',12.2,3);media('projector',12.2,9.5);media('film-poster',.65,7.5);media('reception-console',12.2,6);
   for(let i=0;i<slots;i++){const x=3+i%3*3,y=3+Math.floor(i/3)*3;media('cinema-base',x,y,x+y-.1);media('cinema-back',x,y,x+y+.35);}
  }

  if(['writers','post','executive'].includes(view)){

   for(let i=0;i<slots;i++){const x=3+i%3*3,y=3+Math.floor(i/3)*3;
    media('chair-base',x,y,x+y-.15);media('chair-back',x,y,x+y+.35);
    if(view==='writers')objects.push({depth:x+y-.2,draw:()=>paintProp('desk_SE',x,y-.9,82)});
    else media(view==='executive'?'executive-desk':staff.some(a=>a.workstation===i&&a.specialty==='audio')?'audio-desk':'post-desk',x,y,x+y-.2);
   }
  }
  for(const a of staff){const visual=global.StudioActors.position(a,engine.alpha),pose=presentation(a,view,staff),x=visual.indoor_x??1,y=visual.indoor_y??8;
   if(pose.renderSeat)lastLayout.seatAnchors.push({id:a.id,x:3+(a.workstation||0)%3*3,y:3+Math.floor((a.workstation||0)/3)*3,facing:pose.direction});
   objects.push({depth:x+y,draw:()=>{const p=point(x,y);const r=global.StudioActors.draw(ctx,pose,p.x,p.y,1.35*z,a.id===selected,reduced);hits.push({...r,id:a.id,kind:'agent'});}});
  }
  objects.sort((a,b)=>a.depth-b.depth);for(const item of objects)item.draw();
  if(headerHeight){
   const hx=rawArea.x+8,hy=rawArea.y+4;
   ctx.fillStyle='#a7baa8';ctx.font='600 10px system-ui';ctx.fillText(themes[view].kicker+' · ROOM ART 41',hx,hy+10);
   ctx.fillStyle='#f1dfb3';ctx.font='700 23px system-ui';ctx.fillText(themes[view].title,hx,hy+39);
   const working=staff.filter(a=>a.state_str==='work').length;
   const text=view==='cinema'?staff.filter(a=>a.life?.task?.type==='screening'&&a.life.state==='perform').length+' watching  /  '+slots+' seats':view==='soundstage'&&building?.take?'Take '+building.take.number+' · '+building.take.phase+' · '+staff.length+' crew':working+' working  /  '+staff.length+' in room';
   ctx.font='600 12px system-ui';ctx.textAlign='right';ctx.fillStyle='#b7cbb3';ctx.fillText(text,rawArea.x+rawArea.w-8,hy+28);ctx.textAlign='left';
   ctx.strokeStyle='#415c59';ctx.beginPath();ctx.moveTo(hx,hy+51);ctx.lineTo(rawArea.x+rawArea.w-8,hy+51);ctx.stroke();
  }

  ctx.font='600 15px system-ui';ctx.textAlign='left';ctx.fillStyle='#f2e7cd';
  const label=building?building.name:'No facility built';ctx.fillStyle='#15272e';ctx.fillRect(12,height-114,Math.min(width-24,680),43);ctx.fillStyle='#d1b47a';ctx.fillRect(12,height-114,3,43);ctx.fillStyle='#f2e7cd';ctx.fillText(titles[view]+' · '+label,18,height-98);
  ctx.font='12px system-ui';ctx.fillStyle='#c6d5cd';
  const status=building?.active_project_id?building.active_title+' · '+building.active_phase+' · '+Math.round(building.progress*100)+'%':view==='cinema'?(building?.active_title?'Screening · '+building.active_title+' · ':'')+staff.length+' guests attending · '+slots+' seats':'No production assigned · use Slate to develop or progress a film';
  ctx.fillText(status,18,height-80);

  return building;
 }
 function hit(x,y){return [...hits].reverse().find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)||null;}
 global.StudioDepartments={interiorOptions,interiorSettings,setInteriorSettings,project:(x,y)=>projector?.(x,y),draw,hit,select,types,getCurrent:()=>current,presentation,departmentArtReady:()=>departmentReady,artReady:()=>furnitureReady,pixelArtReady:()=>storyReady,layout:()=>lastLayout};
})(typeof window!=='undefined'?window:globalThis);
