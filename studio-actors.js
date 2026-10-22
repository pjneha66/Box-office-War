/* One sprite/animation owner shared by campus and department rendering. No RAF. */
(function(global){
 'use strict';
 const states=['idle','walk','work','interact','celebrate','react','rest'];
 const directions=['south','west','east','north'];
 const roles=['director','cameraman','star_actor','producer','writer','editor','audience'];
 const fps=[2,8,5,4,6,5,1],cache=new Map(),people=new Map();
 function frame(agent,reduced=false){
  const state=agent.state_str==='walking'?(agent.velocity===0?'idle':'walk'):agent.state_str;
  const row=Math.max(0,states.indexOf(state))*4+Math.max(0,directions.indexOf(agent.direction));
  const clock=state==='walk'?(agent.walk_distance||0)*4:(agent.state_time??agent.anim_timer??0)*fps[Math.max(0,states.indexOf(state))];
  const col=reduced?0:Math.floor(clock)%4;
  return {x:col*24,y:row*32,w:24,h:32,col,row,state};
 }
 function look(a){return Number.isInteger(a.appearance?.look)?((a.appearance.look%24)+24)%24:((a.id||7)-7+2400)%24;}
 function portrait(a){const n=look(a);return `background-position:-${n%8*64}px -${Math.floor(n/8)*64}px`;}
 function richFrame(a,reduced=false){const old=frame(a,reduced);let row=old.row;if(a.renderSeat&&old.state!=='walk')row=8+Math.max(0,directions.indexOf(a.direction));else if(['rest','work'].includes(old.state))row=Math.max(0,directions.indexOf(a.direction));if(!a.renderSeat&&old.state==='work'&&!['writer','editor','producer'].includes(a.kind_str))row=28+Math.max(0,directions.indexOf(a.direction));const clock=old.state==='walk'?(a.walk_distance||0)*4:(a.state_time??a.anim_timer??0)*2;const col=reduced?0:Math.floor(clock)%8;return {x:col*40,y:row*64,w:40,h:64,col,row,state:old.state,look:look(a),atlas:'lpc-revised'};}
 function load(){for(let i=0;i<24;i++){if(people.has(i))continue;const img=new Image(),entry={img,loaded:false};people.set(i,entry);img.onload=()=>entry.loaded=true;img.onerror=()=>console.warn('LPC character sheet unavailable:',i);img.src='assets/studio/people/'+i+'.png';}for(const role of roles){if(cache.has(role))continue;const img=new Image();const entry={img,loaded:false,failed:false};cache.set(role,entry);img.onload=()=>{entry.loaded=true;entry.variants=[img];
  const colors={director:[189,121,91],cameraman:[96,150,162],star_actor:[186,156,80],producer:[130,115,165],writer:[97,144,111],editor:[102,133,174],audience:[172,134,101]};
  for(const factor of [.8,1.12,.93]){const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height),rgb=colors[role];for(let i=0;i<pixels.data.length;i+=4)if(pixels.data[i]===rgb[0]&&pixels.data[i+1]===rgb[1]&&pixels.data[i+2]===rgb[2])for(let k=0;k<3;k++)pixels.data[i+k]=Math.round(rgb[k]*factor);c.putImageData(pixels,0,0);entry.variants.push(canvas);}
 };img.onerror=()=>{entry.failed=true;console.warn('Actor sheet missing:',role);};img.src='assets/studio/'+role+'.png';}}
 function position(a,alpha=1){const p=a.previous;if(!p||p.inside!==a.inside||p.building!==a.assigned_building_id)return a;const t=Math.max(0,Math.min(1,alpha));return {...a,x:p.x+(a.x-p.x)*t,y:p.y+(a.y-p.y)*t,indoor_x:p.indoor_x+(a.indoor_x-p.indoor_x)*t,indoor_y:p.indoor_y+(a.indoor_y-p.indoor_y)*t};}
 function draw(ctx,agent,x,y,scale,selected,reduced){
  const role=roles.includes(agent.kind_str)?agent.kind_str:'producer';const entry=cache.get(role);const f=frame(agent,reduced);
  const size=Math.max(.12,scale);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='rgba(16,30,31,.22)';ctx.beginPath();ctx.ellipse(x,y,7*size,2.5*size,0,0,Math.PI*2);ctx.fill();
  const detailed=people.get(look(agent));
  if(detailed?.loaded){const r=richFrame(agent,reduced);ctx.drawImage(detailed.img,r.x,r.y,40,64,Math.round(x-12.5*size),Math.round(y-(agent.renderSeat?35:39)*size),25*size,40*size);
   if(r.state==='work'&&!agent.renderSeat){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(size,size);ctx.fillStyle='#eadbb2';
    if(['writer','producer'].includes(role)){ctx.fillRect(5,-13,7,5);ctx.fillStyle='#435e60';ctx.fillRect(7,-12,4,1);ctx.fillRect(7,-10,3,1);}
    else if(role==='editor'){ctx.fillStyle='#334c58';ctx.fillRect(5,-13,8,5);ctx.fillStyle=agent.specialty==='audio'?'#e7c273':'#8fbfb5';for(let n=0;n<3;n++)ctx.fillRect(7+n*2,-12,1,2);}
    else if(role==='director'){ctx.fillStyle='#263941';ctx.fillRect(4,-16,9,6);ctx.fillStyle='#e4dbc4';ctx.fillRect(4,-16,9,2);}
    else if(role==='cameraman'&&agent.specialty!=='lighting'){ctx.fillStyle='#263941';ctx.fillRect(4,-19,10,6);ctx.fillStyle='#9abec0';ctx.fillRect(12,-18,3,3);}
    ctx.restore();}
  }else if(entry?.loaded)ctx.drawImage(entry.variants?.[agent.appearance?.palette||0]||entry.img,f.x,f.y,24,32,Math.round(x-12*size),Math.round(y-31*size),24*size,32*size);
  else {ctx.fillStyle='#86a8a0';ctx.fillRect(x-4*size,y-20*size,8*size,20*size);}
  if(selected){ctx.strokeStyle='#ffe1a0';ctx.lineWidth=2;ctx.strokeRect(x-13*size,y-32*size,26*size,34*size);}
  if(agent.life?.bubble){const text=agent.life.bubble.text;ctx.font='10px system-ui';const width=Math.min(180,ctx.measureText(text).width+12);ctx.fillStyle='#f0dfb9';ctx.fillRect(x-width/2,y-40*size-19,width,18);ctx.fillStyle='#263d3d';ctx.textAlign='center';ctx.fillText(text,x,y-40*size-6,width-8);ctx.textAlign='left';}
  const hitW=Math.max(44,26*size),hitH=Math.max(44,34*size);
  return {x:x-hitW/2,y:y-hitH+4,w:hitW,h:hitH};
 }
 const api={frame,richFrame,draw,load,position,look,portrait,states,directions,roles,cache,people};global.StudioActors=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
