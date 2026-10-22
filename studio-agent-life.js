/* Deterministic task/needs layer. No DOM, timers, rendering or economic formulas. */
(function(root){
 'use strict';
 const jobs={vfx:[['Composite visual effects',12],['Review VFX shot',4]],audio:[['Mix dialogue and sound',12],['Listen to mix',4]],lighting:[['Set lighting for shot',8],['Check exposure',4]],writer:[['Draft screenplay',12],['Review script notes',4]],director:[['Prepare shot',4],['Direct take',10],['Review take',4]],star_actor:[['Rehearse scene',5],['Perform scene',10],['Review direction',4]],cameraman:[['Position camera',4],['Operate camera',12],['Check footage',4]],editor:[['Edit sequence',12],['Review picture and sound',5]],producer:[['Review production report',10],['Plan department meeting',4]]};
 const names=['Maya Chen','Leo Bennett','Amira Shah','Theo Brooks','Nina Park','Sam Rivera','Ada Morgan','Finn Okafor'];
 class AgentLife {
  constructor(engine){this.engine=engine;this.time=0;this.events=[];this.workSeconds=0;}
  ensure(a){
   if(typeof a.name!=='string'||!a.name.trim())a.name=names[(a.id-1)%names.length];
   a.appearance=a.appearance||{palette:a.id%4,variant:a.id%3};
   if(!Number.isInteger(a.appearance.look))a.appearance.look=((a.id-7)%24+24)%24;
   if(a.life?.version===1)return a.life;
   if(['Studio Director','Cinematographer','Leading Star','Studio Manager','Story Department','Post-production Crew'].includes(a.name))a.name=names[(a.id-1)%names.length];
   a.appearance=a.appearance||{palette:a.id%4,variant:a.id%3};
   return a.life={version:1,identity:'agent-'+a.id,role:a.kind_str,department:a.assigned_building_id,energy:85+(a.id%10),fatigue:0,mood:'calm',motivation:1,skills:{[a.kind_str]:45+a.id%25},relationships:{},task:null,cycle:0,completed:0,socialUntil:0,bubble:null,history:[],navFailures:0};
  }
  transition(a,state,reason){const l=this.ensure(a);if(l.state===state&&l.reason===reason)return;l.state=state;l.reason=reason;l.stateSince=this.time;l.history.push({at:+this.time.toFixed(2),state,reason});if(l.history.length>16)l.history.shift();}
  event(type,text,ids){this.events.push({at:this.time,type,text,ids});if(this.events.length>40)this.events.shift();}
  destination(a,x,y){a.indoor_target_x=Math.round(x);a.indoor_target_y=Math.round(y);a.indoor_path=null;}
  station(a){return {x:3+(a.workstation||0)%3*3,y:3+Math.floor((a.workstation||0)/3)*3};}
  task(a,type,label,duration,x,y){const l=this.ensure(a);l.task={type,label,duration,elapsed:0,x:Math.round(x),y:Math.round(y)};this.destination(a,x,y);this.transition(a,'travel','Going to '+label.toLowerCase());}
  context(a,b){return b?.active_project_id?b.active_project_id+'|'+b.active_phase+'|'+(b.work_phase_week||0):null;}
  plan(a,b,dt){
   const l=this.ensure(a);l.role=a.kind_str;l.department=a.assigned_building_id;
   if(l.bubble&&l.bubble.until<=this.time)l.bubble=null;
   if(!a.inside){this.transition(a,a.path.length?'commute':'wait',a.path.length?'Following campus route':'Waiting for an accessible entrance');return;}
   if(a.transfer_building_id){if(l.task?.type!=='exit')this.task(a,'exit','Leave department',0,10,8);return;}
   const key=this.context(a,b);
   if(l.context!==key){l.context=key;l.cycle=0;if(l.task?.type!=='exit'){l.task=null;this.transition(a,'choose','Production assignment changed');}}
   if(b?.suspended){if(l.task?.type!=='hold'){const p=this.station(a);this.task(a,'hold','Production on hold',3,p.x,p.y);l.mood='concerned';}return;}
   if(b?.take&&l.takePhase!==b.take.phase&&!['break','discussion','exit'].includes(l.task?.type)){l.takePhase=b.take.phase;l.task=null;this.transition(a,'choose','Director changed the take phase to '+b.take.phase);}
   if(l.task)return;
   const p=this.station(a);
   if(a.kind_str==='audience') {this.task(a,'screening','Watch screening',20,p.x,p.y);return;}
   if(l.energy<35){const spot=this.freePoint(a,2,7);this.task(a,'break','Take a break',12,spot.x,spot.y);return;}
   if(a.kind_str==='producer'&&l.visitingHome&&b?.id!==l.visitingHome){this.task(a,'inspection','Inspect production and hear crew feedback',5,p.x,p.y);return;}
   if(a.kind_str==='producer'&&l.cycle>0&&l.cycle%4===0&&this.time-(l.lastVisit||0)>90){
    const dest=this.engine.buildings.find(v=>v.active_project_id&&v.id!==b?.id);
    if(dest){l.lastVisit=this.time;l.visitingHome=b.id;this.engine.assign_agent(a.id,dest.id,true);return;}
   }
   if((!key||a.project_id&&a.project_id!==b?.active_project_id)&&a.kind_str!=='producer'){this.task(a,'available','Await production assignment',8+(a.id%5),p.x,p.y);return;}
   // Meetings require a willing nearby colleague; they never interrupt a working take.
   if(l.cycle>0&&l.cycle%3===0&&this.time>=l.socialUntil&&this.meet(a,b))return;
   if(b?.take&&['director','cameraman','star_actor'].includes(a.kind_str)){
    const labels={prepare:{director:'Prepare shot and signal crew',cameraman:'Position and check camera',star_actor:'Read direction'},rehearse:{director:'Give rehearsal feedback',cameraman:'Frame rehearsal',star_actor:'Rehearse scene'},take:{director:'Signal action and direct take',cameraman:'Operate camera during take',star_actor:'Perform scene'},review:{director:'Call cut and review take',cameraman:'Check recorded footage',star_actor:'Review the director’s notes'}};
    this.task(a,b.take.phase==='take'?'work':'review',a.specialty==='lighting'?({prepare:'Set lighting for the shot',rehearse:'Check exposure during rehearsal',take:'Hold lighting cues for the take',review:'Check lighting continuity'})[b.take.phase]:labels[b.take.phase][a.kind_str],Math.max(.5,b.take.duration-b.take.elapsed),p.x,p.y);return;
   }
   const routine=jobs[a.specialty]||jobs[a.kind_str]||jobs.editor,index=l.cycle%routine.length,[label,duration]=routine[index];
   this.task(a,index===0||a.kind_str==='star_actor'&&index===1||a.kind_str==='director'&&index===1?'work':'review',label,duration+(a.id%3),p.x,p.y);
  }
  freePoint(a,x,y){const e=this.engine;for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const px=x+dx,py=y+dy;if(!e.agents.some(v=>v.id!==a.id&&v.inside&&v.assigned_building_id===a.assigned_building_id&&(Math.hypot(v.indoor_x-px,v.indoor_y-py)<.8||v.life?.task?.x===px&&v.life?.task?.y===py)))return{x:px,y:py};}return this.station(a);}
  meet(a,b){const e=this.engine,l=this.ensure(a);const partner=e.agents.find(v=>v.id!==a.id&&v.inside&&v.assigned_building_id===b?.id&&v.kind_str!=='audience'&&this.time>=this.ensure(v).socialUntil&&['review','available'].includes(v.life.task?.type)&&v.life.state==='perform'&&Math.hypot(v.indoor_x-a.indoor_x,v.indoor_y-a.indoor_y)<=4);
   if(!partner){l.socialUntil=this.time+10;return false;}
   const p=this.freePoint(a,5,7),q=this.freePoint(partner,p.x+1,p.y);
   if(Math.hypot(p.x-q.x,p.y-q.y)>1.5)return false;
   const label=a.kind_str==='director'?'Discuss the last take':a.kind_str==='producer'?'Review the production plan':'Discuss script notes';
   for(const [v,point,other]of [[a,p,partner],[partner,q,a]]){const vl=this.ensure(v);vl.socialUntil=this.time+65;this.task(v,'discussion',label,4,point.x,point.y);vl.task.partner=other.id;vl.task.waitStarted=this.time;}
   return true;
  }
  arrived(a,b,dt){
   const l=this.ensure(a),t=l.task;if(t&&Math.hypot(a.indoor_x-t.x,a.indoor_y-t.y)>.05){this.engine.set_state(a,'idle');return;}if(!t){this.engine.set_state(a,'idle');return;}
   if(t.type==='exit'){
    const exits=[{x:b.grid_x+b.span_w,y:b.grid_y+Math.floor(b.span_h/2)}];for(let y=b.grid_y;y<b.grid_y+b.span_h;y++)exits.push({x:b.grid_x+b.span_w,y});
    for(let x=b.grid_x;x<b.grid_x+b.span_w;x++)exits.push({x,y:b.grid_y+b.span_h});
    const outside=exits.find(p=>this.engine.walkable(p.x,p.y)&&!this.engine.agents.some(v=>v.id!==a.id&&!v.inside&&Math.hypot(v.x-(p.x+.5),v.y-(p.y+.5))<.8));
    if(!outside){this.engine.set_state(a,'idle');this.transition(a,'blocked','Exit occupied; waiting for clearance');return;}
    a.x=outside.x+.5;a.y=outside.y+.5;
    const dest=a.transfer_building_id;a.transfer_building_id=null;a.inside=false;a.indoor_path=null;l.task=null;
    this.transition(a,'commute','Reached the department exit');
    if(dest)this.engine.assign_agent(a.id,dest,true);
    else {a.departing=true;const target=this.exitPoint(a);if(target)this.engine.send_agent_to(a.id,target.x,target.y);}
    return;
   }
   if(l.state==='travel'||l.state==='blocked'){this.transition(a,'arrive','Reached '+t.label.toLowerCase());l.arrivalPause=.25+(a.id%3)*.1;this.engine.set_state(a,'idle');return;}
   if(l.state==='arrive'){l.arrivalPause-=dt;if(l.arrivalPause>0)return;this.transition(a,'perform','Ready to '+t.label.toLowerCase());}
   if(t.type==='discussion'){
    const other=this.engine.agents.find(v=>v.id===t.partner),ot=other?.life?.task;
    if(!other||ot?.type!=='discussion'||ot.partner!==a.id){this.finish(a,'Conversation cancelled: colleague unavailable');return;}
    const distance=Math.hypot(other.indoor_x-a.indoor_x,other.indoor_y-a.indoor_y);
    if(distance>1.5||other.life.state==='travel'||other.life.state==='arrive'){this.engine.set_state(a,'idle');if(this.time-t.waitStarted>18)this.finish(a,'Meeting timed out');return;}
    if(!t.started){t.started=true;l.relationships[other.id]=(l.relationships[other.id]||0)+1;l.bubble={text:t.label,until:this.time+3};this.event('conversation',t.label,[a.id,other.id]);}
    a.direction=other.indoor_x>a.indoor_x?'east':'west';this.engine.set_state(a,'interact');
   }else if(t.type==='break'||t.type==='available'||t.type==='hold')this.engine.set_state(a,'rest');
   else if(t.type==='screeningReaction')this.engine.set_state(a,'celebrate');
   else if(t.type==='screening')this.engine.set_state(a,'interact');
   else if(t.type==='review'||t.type==='inspection')this.engine.set_state(a,'interact');
   else this.engine.set_state(a,'work');
   t.elapsed+=dt;
   if(t.type==='work'&&!b?.suspended&&(!b.take||b.take.ready&&b.take.phase==='take')&&b?.active_project_id&&(!a.project_id||a.project_id===b.active_project_id)&&this.context(a,b)===l.context){
    const p=(this.engine.game?.projects||[]).find(p=>String(p.id||p.title)===b.active_project_id);
    if(p){const key=p.phase+'|'+p.phaseWeek;if(!p.studioWork||p.studioWork.key!==key)p.studioWork={version:1,key,seconds:{},completedTasks:0,completedRoles:{}};p.studioWork.seconds[a.kind_str]=Math.min(30,(p.studioWork.seconds[a.kind_str]||0)+dt);p.studioWork.byAgent=p.studioWork.byAgent||{};p.studioWork.byAgent[a.id]=Math.min(30,(p.studioWork.byAgent[a.id]||0)+dt);}
    l.motivation=Math.max(.5,Math.min(1.15,.7+l.energy/250-(l.mood==='concerned'?.1:0)));l.energy=Math.max(0,l.energy-dt*.32);l.fatigue=Math.min(100,l.fatigue+dt*.25);this.workSeconds+=dt;
   }else if(t.type==='break'){l.energy=Math.min(100,l.energy+dt*4);l.fatigue=Math.max(0,l.fatigue-dt*3);}
   else l.energy=Math.min(100,l.energy+dt*.12);
   if(t.type==='screening')a.attendance_time=(a.attendance_time||0)+dt;
   if(t.elapsed>=t.duration){
    if(t.type==='screening'){l.mood=b?.screening_success?'delighted':'interested';l.bubble={text:b?.screening_success?'Loved that ending!':'An interesting screening.',until:this.time+2};this.task(a,'screeningReaction','React to screening',1.5,a.indoor_x,a.indoor_y);return;}
    if(t.type==='screeningReaction'){this.task(a,'exit','Leave screening',0,10,8);return;}
    if(t.type==='hold'){l.task=null;return;}
    this.finish(a,'Completed '+t.label.toLowerCase());
   }
  }
  finish(a,reason){const l=this.ensure(a),t=l.task;if(t?.type==='inspection'&&l.visitingHome){const home=l.visitingHome;l.visitingHome=null;this.engine.assign_agent(a.id,home,true);}l.completed++;l.cycle++;l.task=null;this.engine.set_state(a,'idle');this.transition(a,'choose',reason);if(t?.type==='work'){const p=this.engine.game?.projects?.find(p=>String(p.id||p.title)===this.engine.buildings.find(b=>b.id===a.assigned_building_id)?.active_project_id);if(p?.studioWork){p.studioWork.completedTasks++;p.studioWork.completedAgents=p.studioWork.completedAgents||{};p.studioWork.completedAgents[a.id]=(p.studioWork.completedAgents[a.id]||0)+1;p.studioWork.completedRoles=p.studioWork.completedRoles||{};p.studioWork.completedRoles[a.kind_str]=(p.studioWork.completedRoles[a.kind_str]||0)+1;}}}
  exitPoint(a){for(let x=0;x<this.engine.cols;x++)if(this.engine.walkable(x,this.engine.rows-1)&&!this.engine.agents.some(v=>v.id!==a.id&&!v.inside&&v.target_x===x&&v.target_y===this.engine.rows-1))return{x,y:this.engine.rows-1};return null;}
  tick(dt){
   this.time+=dt;
   for(const b of this.engine.buildings){
    if(!['soundstage','virtual_led'].includes(b.b_type)||!b.active_project_id){b.take=null;continue;}
    if(!b.take||b.take.project!==b.active_project_id)b.take={project:b.active_project_id,phase:'prepare',elapsed:0,duration:4,number:1};
    const crew=this.engine.agents.filter(a=>a.assigned_building_id===b.id&&a.inside);
    b.take.ready=!b.suspended&&['director','cameraman','star_actor'].every(role=>crew.some(a=>a.kind_str===role&&Math.hypot(a.indoor_x-this.station(a).x,a.indoor_y-this.station(a).y)<.1&&this.ensure(a).energy>=35&&!['break','discussion','exit'].includes(a.life.task?.type)));
    if(b.take.ready){b.take.elapsed+=dt;const next={prepare:['rehearse',5],rehearse:['take',10],take:['review',4],review:['prepare',4]};if(b.take.elapsed>=b.take.duration){if(b.take.phase==='take')for(const a of crew)if(a.life.task?.type==='work'&&a.life.task.elapsed>=8)this.finish(a,'Completed recorded take');const [phase,duration]=next[b.take.phase];if(phase==='prepare')b.take.number++;b.take.phase=phase;b.take.duration=duration;b.take.elapsed=0;this.event('take',phase==='take'?'Action':phase==='review'?'Cut':phase,crew.map(a=>a.id));}}
   }
   for(const a of this.engine.agents){
    const l=this.ensure(a);if(a.departing&&!a.path.length)a.departed=true;
    if(l.bubble&&l.bubble.until<=this.time)l.bubble=null;
   }
   if(Math.floor((this.time-dt)*2)===Math.floor(this.time*2))return;
   // Opportunistic greetings: real distance, same coordinate space, no work interruption.
   const agents=this.engine.agents;
   for(let i=0;i<agents.length;i++){
    const a=agents[i],l=this.ensure(a);if(this.time<(l.greetUntil||0)||a.kind_str==='audience'||a.state_str==='work')continue;
    const v=agents.slice(i+1).find(v=>v.inside===a.inside&&(!a.inside||v.assigned_building_id===a.assigned_building_id)&&v.kind_str!=='audience'&&v.state_str!=='work'&&this.time>=(this.ensure(v).greetUntil||0)&&Math.hypot((v.inside?v.indoor_x:v.x)-(a.inside?a.indoor_x:a.x),(v.inside?v.indoor_y:v.y)-(a.inside?a.indoor_y:a.y))<1.25);
    if(v){for(const [one,other]of [[a,v],[v,a]]){const state=this.ensure(one);state.greetUntil=this.time+60;state.bubble={text:'Hi, '+other.name.split(' ')[0]+'.',until:this.time+1.8};state.relationships[other.id]=(state.relationships[other.id]||0)+1;}this.event('greeting','Colleagues greeted',[a.id,v.id]);}
   }
  }
  inspect(id){const a=this.engine.agents.find(a=>a.id===id);if(!a)return null;return {id:a.id,name:a.name,role:a.kind_str,animation:a.state_str,facing:a.direction,destination:a.inside?{x:a.indoor_target_x,y:a.indoor_target_y}:{x:a.target_x,y:a.target_y},path:a.inside?a.indoor_path:a.path,life:this.ensure(a),time:this.time};}
 }
 root.StudioAgentLife=AgentLife;if(typeof module!=='undefined')module.exports=AgentLife;
})(typeof window!=='undefined'?window:globalThis);
