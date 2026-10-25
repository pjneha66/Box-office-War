/* Box Office War — Next Wave studio systems (v41.0)
   Deepens existing television, distribution, ESG, campaign, challenge, modding,
   legacy, incident and save systems. All authored/imported data remains local. */
"use strict";
(function(root){
  const META_KEY="bow_ngplus_meta_v1";
  const CAMPAIGN_KEY="bow_custom_campaigns_v1";
  const SEASON_KEY="bow_seasonal_scores_v1";
  const BACKUP_PREFIX="bow_restore_safety_",LATEST_SAFETY_KEY=BACKUP_PREFIX+"latest";
  const ARCS={
    ensemble:{label:"Ensemble",desc:"Reward recurring cast chemistry."},
    mystery:{label:"Mystery arc",desc:"Build questions; land a stronger finale."},
    prestige:{label:"Prestige drama",desc:"More critic heat, slightly narrower audience."},
    episodic:{label:"Episode-of-the-week",desc:"Accessible episodes and a stronger audience hook."}
  };
  const FOCUSES={
    story:{label:"Story & writing",desc:"Steady quality and a clean schedule."},
    performance:{label:"Performances",desc:"Lift critic response from the cast."},
    spectacle:{label:"Production value",desc:"Add audience appeal; costs $0.5M per episode."}
  };
  const NG_PERKS=[
    {id:"cash",label:"Market connections",cost:1,desc:"Start the next studio with +$20M."},
    {id:"craft",label:"Writers’ room alumni",cost:1,desc:"Start with +3 development bonus."},
    {id:"talent",label:"Talent network",cost:2,desc:"Start with +2 reputation and a warm intro to the talent market."}
  ];
  const GUIDE_STEPS=[
    {title:"Greenlight your first project",body:"Open Develop and commission a film—or pitch a series from OTT & Series.",tab:"develop"},
    {title:"Finish a production",body:"Manage the shoot and post schedule until your project is ready, or complete a TV episode.",tab:"productions"},
    {title:"Put it in front of an audience",body:"Set a release date for the film, or let your commissioned season reach its platform.",tab:"productions"},
    {title:"Read the result",body:"Check opening, audience response and profit in Box Office. For a series, review ratings and the renewal offer.",tab:"boxoffice"}
  ];
  const INCIDENTS=[
    {id:"nw_data_breach",w:1,icon:"🛡️",title:"Cyberattack on the production network",kind:"choice",
      text:"A ransomware crew has encrypted dailies and payroll files. The studio can contain the breach, disclose it, or gamble on silence.",
      when:G=>!!G.projects?.some(p=>p.phase==="shoot"||p.phase==="post"),
      choices:G=>[
        {label:"Isolate systems and restore from backup (−$7M)",run:G=>{spendSafe("other",7);G.studio.rep=clampSafe(G.studio.rep+1,5,99);G.nextWave.incidentStats.contained++;say(G,"🛡️ The studio restored its dailies from an offline copy. Production loses a week, but no footage was exposed.","good");G.projects.filter(p=>p.phase==="shoot"||p.phase==="post").slice(0,2).forEach(p=>p.phaseWeek=Math.max(0,(p.phaseWeek||0)-1));}},
        {label:"Disclose promptly (−$3M, protect trust)",run:G=>{spendSafe("other",3);G.studio.rep=clampSafe(G.studio.rep+1,5,99);G.nextWave.incidentStats.disclosed++;say(G,"🗞️ A transparent disclosure kept the breach contained. Partners appreciate the direct response.","good");}},
        {label:"Keep quiet (no immediate cost, serious exposure)",run:G=>{G.studio.rep=clampSafe(G.studio.rep-4,5,99);G.studio.debt=(G.studio.debt||0)+6;G.nextWave.incidentStats.concealed++;say(G,"⚖️ The cover-up leaked. A legal claim adds $6M to debt and costs 4 reputation.","bad");}}
      ]},
    {id:"nw_script_leak",w:1,icon:"📄",title:"Unfinished script leak",kind:"choice",
      text:"A rough cut of the screenplay—not the finished film—has leaked to fan forums. The story is being judged before the actors or editors have shaped it.",
      when:G=>(G.projects||[]).some(p=>p.phase==="pre"||p.phase==="shoot"||p.phase==="post"),
      choices:G=>[
        {label:"Take the leak down and brief the cast (−$4M)",run:G=>{spendSafe("marketing",4);const p=(G.projects||[]).find(x=>["pre","shoot","post"].includes(x.phase));if(p){p.leakContained=true;p.buzzBonus=Math.max(-0.2,(p.buzzBonus||0)-0.02);}G.studio.rep=clampSafe(G.studio.rep+1,5,99);say(G,"🔒 The studio contained the script leak and aligned the cast before the trades ran with it.","good");}},
        {label:"Own the conversation (no cost, spoiler penalty)",run:G=>{const p=(G.projects||[]).find(x=>["pre","shoot","post"].includes(x.phase));if(p){p.leaked=true;p.buzzBonus=(p.buzzBonus||0)+0.05;p.qualityRisk=(p.qualityRisk||0)+2;}say(G,"📣 You turn the leak into a controlled preview. Buzz rises, but audiences have already seen key story beats.","");}},
        {label:"Ignore it (no cost, let the story spread)",run:G=>{const p=(G.projects||[]).find(x=>["pre","shoot","post"].includes(x.phase));if(p){p.leaked=true;p.qualityRisk=(p.qualityRisk||0)+5;}G.studio.rep=clampSafe(G.studio.rep-2,5,99);say(G,"🗞️ Spoilers spread through the trades. The title loses 2 reputation and takes a story-quality risk.","bad");}}
      ]},
    {id:"nw_labor_dispute",w:1,icon:"✊",title:"Crew contract dispute",kind:"choice",
      text:"Crew representatives say overtime and safety protections are lagging behind the slate. A settlement costs money now; a walkout costs weeks.",
      when:G=>(G.projects||[]).some(p=>p.phase==="shoot"),
      choices:G=>[
        {label:"Fund a safe-hours agreement (−$5M, no delay)",run:G=>{spendSafe("other",5);G.unionMeter=clampSafe((G.unionMeter||0)-18,0,100);G.nextWave.incidentStats.settled++;say(G,"🤝 A crew agreement is signed. The lot keeps moving and labour pressure falls.","good");}},
        {label:"Bring in mediators (−$2M, one-week pause)",run:G=>{spendSafe("other",2);G.projects.filter(p=>p.phase==="shoot").forEach(p=>{p.strikePause=(p.strikePause||0)+1;});G.unionMeter=clampSafe((G.unionMeter||0)-8,0,100);say(G,"🕊️ Mediation buys a week of talks. Shoots pause briefly while crews vote.","");}},
        {label:"Reject the claim (save cash, risk a stoppage)",run:G=>{G.unionMeter=clampSafe((G.unionMeter||0)+16,0,100);G.studio.rep=clampSafe(G.studio.rep-2,5,99);say(G,"🪧 The dispute escalates. Guild pressure rises and the studio loses 2 reputation.","bad");}}
      ]},
    {id:"nw_rights_claim",w:1,icon:"⚖️",title:"Chain-of-title claim",kind:"choice",
      text:"A writer claims that an unoptioned draft resembles a project on your slate. Counsel wants a decision before the dispute reaches the trades.",
      when:G=>(G.projects||[]).some(p=>p.phase!=="ready"&&!p.rightsCleared),
      choices:G=>[
        {label:"Commission a rights audit (−$4M)",run:G=>{spendSafe("legal",4);const p=(G.projects||[]).find(x=>x.phase!=="ready"&&!x.rightsCleared);if(p)p.rightsCleared=true;G.studio.rep=clampSafe(G.studio.rep+1,5,99);say(G,"📑 Counsel cleared the chain of title. The production can proceed with clean paperwork.","good");}},
        {label:"Settle quietly (−$9M, preserve schedule)",run:G=>{spendSafe("legal",9);const p=(G.projects||[]).find(x=>x.phase!=="ready");if(p){p.rightsCleared=true;p.spent=(p.spent||0)+1;}say(G,"🤝 A confidential settlement keeps the production on schedule, at a premium.","");}},
        {label:"Fight in court (save cash, delay and reputation risk)",run:G=>{const p=(G.projects||[]).find(x=>x.phase!=="ready");if(p)p.phaseWeek=Math.max(0,(p.phaseWeek||0)-2);G.studio.rep=clampSafe(G.studio.rep-3,5,99);say(G,"⚖️ The claim heads to court. Dailies are held and reputation slips by 3.","bad");}}
      ]}
  ];

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function round(n,d){const m=Math.pow(10,d||0);return Math.round((Number(n)||0)*m)/m;}
  function clampSafe(n,a,b){return Math.max(a,Math.min(b,Number(n)||0));}
  function packNumber(n,a,b,fallback){return n===undefined||n===null||n===""||!Number.isFinite(Number(n))?fallback:clampSafe(n,a,b);}
  function fmt(n){try{return typeof root.fmtM==="function"?root.fmtM(n):"$"+round(n,1)+"M";}catch(e){return "$"+round(n,1)+"M";}}
  function say(G,text,kind){if(G&&typeof G.log==="function")G.log(text,kind||"");else if(typeof root.log==="function")root.log(text,kind||"");}
  function spendSafe(category,amount){if(typeof root.spend==="function")root.spend(category,amount);else if(root.G?.studio)root.G.studio.cash-=amount;}
  function earnSafe(category,amount){if(typeof root.earn==="function")root.earn(category,amount);else if(root.G?.studio)root.G.studio.cash+=amount;}
  function stateOf(G){
    G=G||root.G;if(!G)return null;
    G.nextWave=G.nextWave&&typeof G.nextWave==="object"?G.nextWave:{};
    const n=G.nextWave;
    if(!Array.isArray(n.incidentArchive))n.incidentArchive=[];
    if(!n.incidentStats||typeof n.incidentStats!=="object")n.incidentStats={};
    ["contained","disclosed","concealed","settled"].forEach(k=>{if(!Number.isFinite(n.incidentStats[k]))n.incidentStats[k]=0;});
    if(!n.rivals||typeof n.rivals!=="object")n.rivals={};
    if(!Array.isArray(n.rivals.offers))n.rivals.offers=[];
    if(!Array.isArray(n.rivals.reactions))n.rivals.reactions=[];
    if(!Array.isArray(n.rivals.deals))n.rivals.deals=[];
    if(!Number.isFinite(n.rivals.lastPoachAt))n.rivals.lastPoachAt=0;
    if(!Number.isFinite(n.rivals.lastAcquisitionAt))n.rivals.lastAcquisitionAt=0;
    if(!n.franchisePlans||typeof n.franchisePlans!=="object")n.franchisePlans={};
    if(!n.calendar||typeof n.calendar!=="object")n.calendar={};
    if(!Array.isArray(n.calendar.weatherEvents))n.calendar.weatherEvents=[];
    return n;
  }
  function save(){try{if(typeof root.saveGame==="function")root.saveGame();}catch(e){}}
  function findById(list,id){return (list||[]).find(x=>String(x.id)===String(id))||null;}
  let contentIdCounter=0;
  function nextContentId(prefix,list){const used=new Set((list||[]).map(x=>String(x.id)));let id;do{id=prefix+Date.now().toString(36)+"_"+(++contentIdCounter).toString(36);}while(used.has(id));return id;}
  function safeText(s,max){return String(s||"").replace(/[<>]/g,"").trim().slice(0,max||80);}
  function clearCustomGenres(){
    const ids=Array.isArray(root._bowCustomGenreIds)?root._bowCustomGenreIds:[];
    ids.forEach(id=>{delete root.DATA?.GENRES?.[id];delete root.DATA?.GENRE_COLORS?.[id];});
    root._bowCustomGenreIds=[];
  }
  function applyCustomGenres(G){
    clearCustomGenres();const added=[];
    if(!root.DATA?.GENRES)return 0;
    (G?.custom?.genres||[]).slice(0,20).forEach(x=>{
      if(!x||!/^([a-z][a-z0-9_]{1,23})$/.test(x.id||"")||root.DATA.GENRES[x.id])return;
      const base=root.DATA.GENRES[x.base];if(!base||base.custom)return;
      const color=/^#[0-9a-f]{6}$/i.test(x.color||"")?x.color:(root.DATA.GENRE_COLORS?.[x.base]||"#7b88a8");
      root.DATA.GENRES[x.id]={...base,name:safeText(x.name,32)||base.name,emoji:safeText(x.emoji,8)||base.emoji||"🎬",mass:packNumber(x.mass,0.5,1.5,base.mass),legsAdj:packNumber(x.legsAdj,-0.5,0.5,base.legsAdj),intlShare:packNumber(x.intlShare,0.1,0.7,base.intlShare),critic:packNumber(x.critic,-10,10,base.critic),aud:packNumber(x.aud,-10,10,base.aud),otta:packNumber(x.otta,0.5,2,base.otta),awards:packNumber(x.awards,0,2,base.awards),budgetBias:packNumber(x.budgetBias,0.35,1.4,base.budgetBias),merch:packNumber(x.merch,0.2,1.5,base.merch),custom:true};
      if(root.DATA.GENRE_COLORS)root.DATA.GENRE_COLORS[x.id]=color;added.push(x.id);
      if(G.trends&&!Number.isFinite(G.trends[x.id]))G.trends[x.id]=1;
    });
    root._bowCustomGenreIds=added;return added.length;
  }
  function onNewGame(G,opts){
    opts=opts||{};const n=stateOf(G);if(!n)return;applyCustomGenres(G);
    n.campaignStartWeek=G.week||1;
    const campaign=(G.scenario&&root.DATA?.SCENARIOS?.[G.scenario])||null;
    if(campaign?.customCampaign){G.studio.cash=clampSafe(campaign.startCash,60,1200);G.studio.debt=clampSafe(campaign.startDebt,0,500);G.studio.rep=clampSafe(campaign.startRep,5,90);}
    if(campaign&&campaign.goal)n.campaignGoal=JSON.parse(JSON.stringify(campaign.goal));
    if(G.scenario==="producer_school"){n.guide={active:true,done:false,dismissed:false,step:0};G.tutorial=null;}
    else if(!G.tutorial||G.tutorial.done)n.guide={active:false,done:false,dismissed:false,step:0};
    if(opts.ngPerk){
      const perk=NG_PERKS.find(p=>p.id===opts.ngPerk),meta=metaInfo();
      if(perk&&meta.points>=perk.cost){
        meta.points-=perk.cost;meta.spent=(meta.spent||0)+perk.cost;writeMeta(meta);
        G.nextWave.ngPlusPerk=perk.id;
        if(perk.id==="cash")G.studio.cash+=20;
        if(perk.id==="craft")G.studio.devBonus=(G.studio.devBonus||0)+3;
        if(perk.id==="talent")G.studio.rep=clampSafe(G.studio.rep+2,5,99);
        say(G,"🌱 New Game+ · "+perk.label+" carries into this career.","gold");
      }else if(perk){say(G,"New Game+ perk not applied: earn more Legacy Credits by completing a career.","bad");}
    }
    if(G.scenario==="producer_school")say(G,"🎓 FIRST FILM LAB: follow the five short production steps above. Your goal is one released title earning $20M by week 52.","gold");
    save();
  }
  function metaInfo(){
    try{const m=JSON.parse(root.localStorage.getItem(META_KEY)||"{}");return {points:Math.max(0,Number(m.points)||0),earned:Math.max(0,Number(m.earned)||0),spent:Math.max(0,Number(m.spent)||0),runs:Array.isArray(m.runs)?m.runs:[]};}
    catch(e){return {points:0,earned:0,spent:0,runs:[]};}
  }
  function writeMeta(m){try{root.localStorage.setItem(META_KEY,JSON.stringify(m));}catch(e){}}
  function recordCareer(entry){
    if(!entry||!entry.seed)return null;
    const m=metaInfo();if(m.runs.includes(entry.seed))return m;
    const credits=Math.max(1,Math.min(5,Math.floor((Number(entry.score)||0)/300)));
    m.points+=credits;m.earned+=credits;m.runs.unshift(entry.seed);m.runs=m.runs.slice(0,20);writeMeta(m);return {credits,meta:m};
  }
  function ngPlusState(){const m=metaInfo();return {points:m.points,perks:NG_PERKS.map(p=>({...p,available:m.points>=p.cost}))};}

  function initializeSeriesSeason(series,G){
    if(!series)return null;G=G||root.G;const season=(series.seasons||[]).length+1;
    if(!series.episodeProduction||series.episodeProduction.season!==season){
      series.episodeProduction={season,arc:series.storyArc||"ensemble",focus:series.episodeFocus||"story",currentEpisode:1,weekInEpisode:0,weeksPerEpisode:2,episodes:[]};
      series.episodeRecords=[];
    }
    return series.episodeProduction;
  }
  function setSeriesPlan(id,field,value,G){
    G=G||root.G;const s=findById(G?.series,id);if(!s||!(["arc","focus"].includes(field)&&({arc:ARCS,focus:FOCUSES}[field][value])))return false;
    if(field==="arc")s.storyArc=value;else s.episodeFocus=value;
    const p=initializeSeriesSeason(s,G);p[field]=value;save();return true;
  }
  function episodeLabel(s,n){const total=Math.max(1,Number(s.eps)||8);return n===1?"Pilot":n===total?"Season finale":"Episode "+String(n).padStart(2,"0");}
  function scoreEpisode(s,plan,number,G){
    const dir=s.showrunner?.skill||56,cast=(s.cast||[]).length?(s.cast||[]).reduce((a,t)=>a+(t.skill||55),0)/s.cast.length:55;
    const budget=clampSafe((Number(s.perEp)||6)/12,0.4,1.1);
    let quality=0.3*(s.concept||60)+0.25*dir+0.2*cast+0.25*(45+55*budget);
    let audience=0,critic=0;
    if(plan.arc==="ensemble")quality+=(s.cast||[]).length>=3?4:1;
    if(plan.arc==="mystery")quality+=number===s.eps?9:2;
    if(plan.arc==="prestige"){critic+=5;audience-=2;}
    if(plan.arc==="episodic")audience+=4;
    if(plan.focus==="performance")critic+=4;
    if(plan.focus==="spectacle"){audience+=4;spendSafe("production",0.5);s.spent=(s.spent||0)+0.5;}
    if(plan.focus==="story")quality+=3;
    const score=clampSafe(Math.round(quality+G.studio.rep/35),10,98);
    return {season:plan.season,number,title:episodeLabel(s,number),quality:score,critic:clampSafe(score+critic,5,99),audience:clampSafe(score+audience,5,99),focus:plan.focus,arc:plan.arc,week:G.week,cost:round((s.perEp||0)/(plan.weeksPerEpisode||2)+(plan.focus==="spectacle"?0.5:0),1)};
  }
  function tickSeriesProduction(series,G,deliver){
    G=G||root.G;if(!series||series.phase!=="shoot")return false;
    const p=initializeSeriesSeason(series,G);if(!p)return false;
    p.arc=series.storyArc||p.arc||"ensemble";p.focus=series.episodeFocus||p.focus||"story";
    const number=Math.max(1,p.currentEpisode||1), wpe=p.weeksPerEpisode||2;
    p.weekInEpisode=(p.weekInEpisode||0)+1;
    const burn=round((series.perEp||series.budget/Math.max(1,series.eps||8))/wpe,1);
    spendSafe("production",burn);earnSafe("incentives",burn*0.06);series.spent=(series.spent||0)+burn;
    series.weeksLeft=Math.max(0,(series.weeksLeft||1)-1);
    if(p.weekInEpisode>=wpe){
      const ep=scoreEpisode(series,p,number,G);p.episodes.push(ep);p.currentEpisode=number+1;p.weekInEpisode=0;
      say(G,"📺 "+series.title+" · S"+p.season+"E"+String(number).padStart(2,"0")+" "+ep.title+" wraps — "+ep.quality+"/100 "+(number===series.eps?"(finale)":""),ep.quality>=72?"good":"");
      if(number>=series.eps){
        series.episodeRecords=p.episodes.slice();series.weeksLeft=0;
        if(typeof deliver==="function")deliver(series);
      }
    }
    return true;
  }
  function seasonRenewalAnalysis(series,offer,G){
    G=G||root.G;const last=(series?.seasons||[]).slice(-1)[0]||{};const rating=last.viewership||0;
    const own=(offer?.platform||series?.platform)==="own",cost=Number(offer?.budget)||Number(series?.budget)||0;
    const projected=own?Number(G?.studio?.cash)||0:Number(offer?.value)||0,margin=projected-cost;
    const threshold=Number((root.DATA?.platform?.(series.platform)||{}).renew)||55,financeOk=own?projected>=cost:margin>=0,renew=rating>=threshold&&financeOk;
    return {rating,cost,projected,margin,own,renew,reason:renew?(own?"Ratings clear the line and studio cash covers the next season.":"Ratings and license cover the order."):rating<threshold?"Audience is below the platform’s renewal line.":own?"The studio cannot fund the next season at this budget.":"The projected license is below production cost."};
  }

  function resourceIds(project,G){
    const people=[...(project.cast||[]),project.director,project.writer,project.producer].filter(Boolean);
    const crew=Array.isArray(project.crew)?project.crew:Array.isArray(project.btlCrew)?project.btlCrew:[];
    const bookedCrew=(project.scheduledWindow?.crewIds||[]).map(id=>({id}));
    const currentCrew=G?.btl?Object.values(G.btl).filter(Boolean):[];
    return [...new Set(people.concat(crew,bookedCrew,currentCrew).map(t=>String(t.id||t.name||"crew")).filter(Boolean))];
  }
  function projectWindow(project,G){
    if(project.scheduledWindow&&Number.isFinite(project.scheduledWindow.startWeek))return {start:project.scheduledWindow.startWeek,end:project.scheduledWindow.endWeek||project.scheduledWindow.startWeek+8};
    const remaining=project.phase==="shoot"?Math.max(1,(project.phaseLen?.shoot||10)-(project.phaseWeek||0)):Math.max(1,project.phaseLen?.shoot||10);
    const pre=project.phase==="pre"?Math.max(0,(project.phaseLen?.pre||4)-(project.phaseWeek||0)):0;
    return {start:G.week+pre,end:G.week+pre+remaining-1};
  }
  function sharedResources(a,b,G){
    if(a.location&&b.location&&a.location===b.location)return true;
    const aa=resourceIds(a,G),bb=new Set(resourceIds(b,G));return aa.some(id=>bb.has(id));
  }
  function scheduleConflicts(project,startWeek,G,ignoreId){
    const L=project.phaseLen||{shoot:10},duration=Math.max(1,Number(L.shoot)||10),end=startWeek+duration-1;
    return (G.projects||[]).filter(other=>other!==project&&String(other.id)!==String(ignoreId||project.id)&&["pre","shoot"].includes(other.phase)&&(!other.scheduledWindow||other.scheduledWindow.endWeek>=G.week)&&sharedResources(project,other,G))
      .map(other=>({project:other,window:projectWindow(other,G)})).filter(x=>startWeek<=x.window.end&&end>=x.window.start)
      .map(x=>({id:x.project.id,title:x.project.title,start:Math.max(startWeek,x.window.start),end:Math.min(end,x.window.end),location:x.project.location||null}));
  }
  function scheduleProject(id,startWeek,G){
    G=G||root.G;const p=findById(G?.projects,id);if(!p)return {ok:false,reason:"Production not found."};
    if(!["pre","shoot"].includes(p.phase))return {ok:false,reason:"Only pre-production or active shoots need a location and crew reservation."};
    startWeek=Math.max(G.week+1,Math.floor(Number(startWeek)||G.week+1));const conflicts=scheduleConflicts(p,startWeek,G);
    if(conflicts.length)return {ok:false,reason:"Window conflicts with "+conflicts.map(x=>x.title).join(", ")+".",conflicts};
    const duration=Math.max(1,Number(p.phaseLen?.shoot)||10);
    const crewIds=G.btl?Object.values(G.btl).filter(Boolean).map(t=>String(t.id||t.name)):[];
    p.scheduledWindow={startWeek,endWeek:startWeek+duration-1,duration,crewIds,weatherDelays:0};
    save();return {ok:true,window:p.scheduledWindow};
  }
  function scheduleNextClearSlot(id,G){
    G=G||root.G;const p=findById(G?.projects,id);if(!p)return {ok:false,reason:"Production not found."};
    for(let w=G.week+1;w<=G.week+104;w++)if(!scheduleConflicts(p,w,G).length)return scheduleProject(id,w,G);
    return {ok:false,reason:"No clear shared-talent/location window in the next 104 weeks."};
  }
  function calendarWarnings(G){
    G=G||root.G;if(!G)return [];
    const out=[];for(const p of G.projects||[]){if(p.scheduledWindow&&p.scheduledWindow.endWeek>=G.week&&["pre","shoot"].includes(p.phase)){const conflicts=scheduleConflicts(p,p.scheduledWindow.startWeek,G);conflicts.forEach(c=>out.push({project:p.title,other:c.title,week:c.start,reason:"overlapping cast, crew or location booking"}));}}
    return out;
  }

  function marketplaceOffers(film,G){
    G=G||root.G;if(!film||!root.BOW_TERRITORIES)return [];
    const regions=root.BOW_TERRITORIES.REGIONS||[];return regions.filter(r=>!(film.territoryDeals||{})[r.id]).map(r=>{
      const mg=root.BOW_TERRITORIES.calculateTerritoryOffer(film,r.id,"MINIMUM_GUARANTEE",G);
      const rev=root.BOW_TERRITORIES.calculateTerritoryOffer(film,r.id,"REVENUE_SHARE",G);
      return {filmId:film.id,title:film.title,regionId:r.id,regionName:r.name,marketShare:r.marketShare,mg,rev,expires:G.week+8};
    }).filter(o=>o.mg&&o.rev);
  }
  function signDistributionOffer(filmId,regionId,modelKey,localized,weeks,G){
    G=G||root.G;if(!root.BOW_TERRITORIES)return {ok:false,reason:"Territory marketplace has not loaded."};
    const duration=clampSafe(Math.floor(Number(weeks)||26),13,104),ok=root.BOW_TERRITORIES.signTerritoryDeal(filmId,regionId,modelKey,!!localized,G,duration);
    if(!ok)return {ok:false,reason:"The territory offer could not be signed. Check existing rights and localization cash."};
    const film=findById((G.projects||[]).concat(G.films||[]),filmId),deal=film?.territoryDeals?.[regionId];
    if(deal){deal.startWeek=G.week;deal.endWeek=G.week+duration;deal.windowWeeks=duration;}
    save();return {ok:true,deal};
  }

  function updateFranchiseLifecycle(fr,G){
    const entries=fr.entries||[];let last=entries.reduce((a,e)=>Math.max(a,Number(e.week)||0),Number(fr.built)||0);if(!last)last=G.week;
    const idle=Math.max(0,G.week-last);
    const parks=!!fr.park,divisions=[fr.merch,fr.park,fr.gameSold,fr.publishing,fr.comics,fr.toys].filter(Boolean).length;
    const stage=idle<52?"active":idle<156?"resting":"legacy";
    const health=clampSafe(78-(fr.fatigue||0)*48+Math.min(16,divisions*4)+(stage==="legacy"?5:0),0,100);
    fr.lifecycle={stage, weeksSinceEntry:idle, health, divisions, lastUpdated:G.week};
    return fr.lifecycle;
  }
  function franchiseRevive(id,G){
    G=G||root.G;const fr=findById(G?.franchises,id);if(!fr)return {ok:false,reason:"Franchise not found."};
    if((G.studio.cash||0)<8)return {ok:false,reason:"A revival campaign costs $8M."};
    spendSafe("marketing",8);fr.fatigue=clampSafe((fr.fatigue||0)-0.14,0,0.95);fr.decay=clampSafe((fr.decay||0)+0.18,0.2,1);
    fr.revivalAt=G.week;stateOf(G).franchisePlans[fr.id]={action:"revival",week:G.week};
    say(G,"📣 "+fr.name+" gets a cross-division revival campaign. Brand fatigue eases and its back-catalogue heats up.","good");save();return {ok:true};
  }

  function esgScore(G){
    G=G||root.G;try{return root.IndustryExpansion?.esgScore?root.IndustryExpansion.esgScore(G):0;}catch(e){return 0;}
  }
  function setESGTarget(target,G){
    G=G||root.G;target=Number(target);if(![25,45,65].includes(target))return {ok:false,reason:"Choose a 25, 45 or 65-point target."};
    const n=stateOf(G);if(n.esgCommitment?.status==="active")return {ok:false,reason:"Resolve the current sustainability pledge first."};
    if((G.studio.cash||0)<3)return {ok:false,reason:"The public ESG pledge requires a $3M audit and reporting budget."};
    spendSafe("other",3);n.esgCommitment={target,startWeek:G.week,dueWeek:G.week+52,status:"active",baseline:esgScore(G),grant:2+target*0.08};
    say(G,"🌱 Sustainability target filed: Carbon Score "+target+" by week "+(G.week+52)+". Falling short will cost reputation.","gold");save();return {ok:true,commitment:n.esgCommitment};
  }
  function auditESG(G){
    const n=stateOf(G),c=n?.esgCommitment;if(!c||c.status!=="active"||G.week<c.dueWeek)return;
    const score=esgScore(G);c.auditedWeek=G.week;c.score=score;
    if(score>=c.target){c.status="met";earnSafe("incentives",c.grant);G.studio.rep=clampSafe(G.studio.rep+2,5,99);say(G,"🌿 ESG audit passed: Carbon Score "+score+" exceeded "+c.target+". +"+fmt(c.grant)+" incentive and +2 reputation.","good");}
    else{c.status="missed";G.studio.rep=clampSafe(G.studio.rep-3,5,99);say(G,"⚠️ ESG audit missed: Carbon Score "+score+" / "+c.target+". Public trust costs 3 reputation.","bad");}
  }

  function loadCampaigns(){try{const c=JSON.parse(root.localStorage.getItem(CAMPAIGN_KEY)||"[]");return Array.isArray(c)?c:[];}catch(e){return [];}}
  function persistCampaigns(list){try{root.localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(list.slice(0,20)));return true;}catch(e){return false;}}
  function restoreCampaigns(){
    if(!root.DATA?.SCENARIOS)return 0;let added=0;
    loadCampaigns().forEach(c=>{if(!c||!/^custom_[a-z0-9_]+$/i.test(c.id||"")||root.DATA.SCENARIOS[c.id]||!c.goal||!c.name)return;
      root.DATA.SCENARIOS[c.id]={name:safeText(c.name,42),emoji:"🧩",cash:0,debt:0,rep:0,startCash:clampSafe(c.startCash,60,1200),startDebt:clampSafe(c.debt,0,500),startRep:clampSafe(c.rep,5,90),overhead:0,flopPenalty:0,desc:safeText(c.desc||"Player-authored campaign.",110),goal:{films:clampSafe(c.goal.films,1,20),gross:clampSafe(c.goal.gross,0,5000),deadlineWeeks:clampSafe(c.goal.deadlineWeeks,26,520)},customCampaign:true};added++;});
    return added;
  }
  function createCampaign(input){
    input=input||{};const name=safeText(input.name,42);if(!name)return {ok:false,reason:"Give the campaign a name."};
    const startCash=clampSafe(input.cash,60,1200),debt=clampSafe(input.debt,0,500),rep=clampSafe(input.rep,5,90);
    const goal={films:Math.floor(clampSafe(input.films,1,20)),gross:clampSafe(input.gross,0,5000),deadlineWeeks:Math.floor(clampSafe(input.deadline,26,520))};
    const all=loadCampaigns(),prefix="custom_"+Date.now().toString(36);let id=prefix,suffix=0;
    while(all.some(c=>c.id===id)||root.DATA?.SCENARIOS?.[id])id=prefix+"_"+(++suffix).toString(36);
    const campaign={id,name,startCash,debt,rep,desc:safeText(input.desc||"Meet your box-office goal before the deadline.",110),goal};
    all.unshift(campaign);if(!persistCampaigns(all))return {ok:false,reason:"Could not store the campaign in local browser storage."};
    restoreCampaigns();return {ok:true,campaign};
  }
  function campaignProgress(G){
    const c=stateOf(G)?.campaignGoal;if(!c)return null;const films=(G.films||[]).filter(f=>!f.streamingOriginal),gross=films.reduce((sum,f)=>sum+(f.ww||0),0);
    return {films:films.length,targetFilms:c.films||1,gross,targetGross:c.gross||0,deadline:c.deadlineWeeks||52,remaining:Math.max(0,(G.week||1)-(G.nextWave.campaignStartWeek||1)),met:films.length>=(c.films||1)&&gross>=(c.gross||0)};
  }

  function quarterSeason(G){const year=typeof root.yearOf==="function"?root.yearOf(G.week):Math.ceil(G.week/52),week=typeof root.woyOf==="function"?root.woyOf(G.week):((G.week-1)%52)+1;return year+"-Q"+(Math.floor((week-1)/13)+1);}
  function seasonalScores(){try{const s=JSON.parse(root.localStorage.getItem(SEASON_KEY)||"{}");return s&&typeof s==="object"?s:{};}catch(e){return {};}}
  function saveSeasonalScores(s){try{root.localStorage.setItem(SEASON_KEY,JSON.stringify(s));return true;}catch(e){return false;}}
  function encodeCode(obj){const raw=JSON.stringify(obj);try{return "BOWS1-"+root.btoa(unescape(encodeURIComponent(raw))).replace(/=+$/g,"");}catch(e){return "BOWS1-"+encodeURIComponent(raw);}}
  function decodeCode(code){try{const value=String(code||"").trim();if(value.length>2048||!value.startsWith("BOWS1-"))return null;const body=value.slice(6);let raw;try{raw=decodeURIComponent(escape(root.atob(body)));}catch(e){raw=decodeURIComponent(body);}const obj=JSON.parse(raw);if(!obj||obj.kind!=="bow-seasonal-score"||!Number.isFinite(+obj.score)||+obj.score<0||+obj.score>1000000000||!/^\d{1,3}-Q[1-4]$/.test(String(obj.season||""))||String(obj.studio||"").length>42||String(obj.seed||"").length>64)return null;return {...obj,score:Math.floor(+obj.score)};}catch(e){return null;}}
  function seasonalScore(G){return Math.max(0,Math.round((G.stats?.totalWW||0)+(G.stats?.totalProfit||0)*0.2+(G.stats?.awards||[]).length*80+(G.franchises||[]).length*30+(G.studio.rep||0)*6-(G.studio.debt||0)*0.25));}
  function archiveSeasonalScore(G){
    G=G||root.G;const season=quarterSeason(G),score=seasonalScore(G),payload={kind:"bow-seasonal-score",version:1,season,score,studio:safeText(G.studio.name,42),seed:G.seed||"local",week:G.week,awards:(G.stats?.awards||[]).length};
    const entry={...payload,code:encodeCode(payload),archivedAt:Date.now()};const all=seasonalScores();all[season]=all[season]||[];
    if(!all[season].some(x=>x.seed===entry.seed&&x.studio===entry.studio))all[season].push(entry);
    all[season].sort((a,b)=>b.score-a.score);all[season]=all[season].slice(0,50);saveSeasonalScores(all);return entry;
  }
  function importSeasonalCode(code){const p=decodeCode(code);if(!p)return {ok:false,reason:"That is not a valid Box Office War seasonal score code."};const all=seasonalScores();all[p.season]=all[p.season]||[];if(!all[p.season].some(x=>x.seed===p.seed&&x.studio===p.studio))all[p.season].push({...p,imported:true});all[p.season].sort((a,b)=>b.score-a.score);all[p.season]=all[p.season].slice(0,50);saveSeasonalScores(all);return {ok:true,entry:p};}
  function copyText(text){try{if(root.navigator?.clipboard?.writeText)return root.navigator.clipboard.writeText(text).then(()=>true).catch(()=>false);}catch(e){}return Promise.resolve(false);}

  function contentPack(G){
    G=G||root.G;const seenPeople=new Set(),people=[...(G?.custom?.people||[]),...(G?.talent||[]).filter(t=>t.custom)].filter(t=>{const key=String(t.id||t.name);if(seenPeople.has(key))return false;seenPeople.add(key);return true;});
    return {kind:"box-office-war-content-pack",schemaVersion:1,name:safeText(G?.customPackName||"Studio Content Pack",50),createdAt:new Date().toISOString(),
      films:(G?.ideas||[]).filter(x=>x.custom).slice(0,30).map(i=>({title:safeText(i.title,70),genre:i.genre,scale:i.scale,concept:safeText(i.concept,180),buzz:clampSafe(i.buzz,0,100),quality:clampSafe(i.quality?.overall||75,1,99)})),
      genres:(G?.custom?.genres||[]).slice(0,20).map(x=>({...x})),
      talent:people.slice(0,30).map(t=>({name:safeText(t.name,50),kind:t.kind,power:clampSafe(t.power,1,5),skill:clampSafe(t.skill,40,99),favGenre:t.favGenre||t.genreFit||"action",age:clampSafe(t.age,18,90)})),
      rivals:(G?.rivals||[]).filter(r=>r.custom).slice(0,20).map(r=>({name:safeText(r.name,50),style:r.style,cash:clampSafe(r.cash,1,2000),rep:clampSafe(r.rep,1,99),color:/^#[0-9a-f]{6}$/i.test(r.color||"")?r.color:"#6887ff"})),
      franchises:(G?.franchises||[]).filter(f=>f.custom).slice(0,20).map(f=>({name:safeText(f.name,50),genre:f.genre,tier:clampSafe(f.tier,1,6),lore:safeText(f.lore||"Custom franchise universe",180)})),
      campaigns:loadCampaigns().slice(0,20).map(c=>JSON.parse(JSON.stringify(c)))};
  }
  function importContentPack(raw,G){
    G=G||root.G;if(typeof raw==="string"&&raw.length>250000)return {ok:false,reason:"Content packs are limited to 250 KB."};
    let pack;try{pack=typeof raw==="string"?JSON.parse(raw):raw;if(JSON.stringify(pack).length>250000)return {ok:false,reason:"Content packs are limited to 250 KB."};}catch(e){return {ok:false,reason:"The content pack is not valid JSON."};}
    if(!pack||pack.kind!=="box-office-war-content-pack"||pack.schemaVersion!==1)return {ok:false,reason:"Unsupported pack type or schema version."};
    const scales=Object.keys(root.DATA?.SCALES||{}),added={films:0,genres:0,talent:0,rivals:0,franchises:0,campaigns:0};
    G.custom=G.custom||{};G.custom.people=G.custom.people||[];G.custom.genres=Array.isArray(G.custom.genres)?G.custom.genres:[];
    (Array.isArray(pack.genres)?pack.genres:[]).slice(0,20).forEach(x=>{const id=String(x.id||"").toLowerCase(),name=safeText(x.name,32),base=String(x.base||"drama");if(!/^([a-z][a-z0-9_]{1,23})$/.test(id)||!name||!root.DATA?.GENRES?.[base]||root.DATA.GENRES[base].custom||G.custom.genres.some(g=>g.id===id)||root.DATA.GENRES[id])return;G.custom.genres.push({id,name,base,emoji:safeText(x.emoji,8),color:/^#[0-9a-f]{6}$/i.test(x.color||"")?x.color:"",mass:packNumber(x.mass,0.5,1.5,undefined),legsAdj:packNumber(x.legsAdj,-0.5,0.5,undefined),intlShare:packNumber(x.intlShare,0.1,0.7,undefined),critic:packNumber(x.critic,-10,10,undefined),aud:packNumber(x.aud,-10,10,undefined),otta:packNumber(x.otta,0.5,2,undefined),awards:packNumber(x.awards,0,2,undefined),budgetBias:packNumber(x.budgetBias,0.35,1.4,undefined),merch:packNumber(x.merch,0.2,1.5,undefined)});added.genres++;});
    applyCustomGenres(G);const genres=Object.keys(root.DATA?.GENRES||{}),filmPitches=Array.isArray(pack.films)?pack.films:(Array.isArray(pack.ideas)?pack.ideas:[]);
    filmPitches.slice(0,30).forEach(i=>{const title=safeText(i.title,70);if(!title||!genres.includes(i.genre)||!scales.includes(i.scale))return;G.ideas.unshift({id:nextContentId("pack_idea_",G.ideas),title,genre:i.genre,scale:i.scale,concept:safeText(i.concept,180)||"Imported screenplay",buzz:clampSafe(i.buzz,1,100),quality:{overall:clampSafe(i.quality,1,99),craft:75,script:75},custom:true});added.films++;});
    (Array.isArray(pack.talent)?pack.talent:[]).slice(0,30).forEach(t=>{const name=safeText(t.name,50),kind=["actor","director","writer","producer"].includes(t.kind)?t.kind:"actor";if(!name||!genres.includes(t.favGenre||"action"))return;G.custom.people.push({id:nextContentId("pack_talent_",G.custom.people),name,kind,power:clampSafe(t.power,1,5),skill:clampSafe(t.skill,40,99),fee:Math.max(1,round(clampSafe(t.skill,40,99)/12,1)),favGenre:t.favGenre||"action",age:clampSafe(t.age,18,90),custom:true});added.talent++;});
    (Array.isArray(pack.rivals)?pack.rivals:[]).slice(0,20).forEach(r=>{const name=safeText(r.name,50),style=["tentpole","prestige","balanced","horror"].includes(r.style)?r.style:"balanced";if(!name)return;G.rivals.push({id:nextContentId("pack_rival_",G.rivals),name,style,cash:clampSafe(r.cash,1,2000),rep:clampSafe(r.rep,1,99),color:/^#[0-9a-f]{6}$/i.test(r.color||"")?r.color:"#6887ff",slate:[],ytd:0,filmsLive:[],custom:true});added.rivals++;});
    (Array.isArray(pack.franchises)?pack.franchises:[]).slice(0,20).forEach(f=>{const name=safeText(f.name,50);if(!name||!genres.includes(f.genre))return;G.franchises.push({id:nextContentId("pack_fr_",G.franchises),name,genre:f.genre,tier:clampSafe(f.tier,1,6),decay:0.85,entries:[],ww:0,merch:0,park:0,gameSold:0,earned:0,custom:true,lore:safeText(f.lore,180)});added.franchises++;});
    (Array.isArray(pack.campaigns)?pack.campaigns:[]).slice(0,20).forEach(c=>{if(!c||!c.goal)return;const x=createCampaign({name:c.name,cash:c.startCash,debt:c.debt,rep:c.rep,films:c.goal.films,gross:c.goal.gross,deadline:c.goal.deadlineWeeks,desc:c.desc});if(x.ok)added.campaigns++;});
    G.customPackName=safeText(pack.name,50)||"Imported content pack";say(G,"🧰 Imported pack “"+G.customPackName+"” · "+Object.entries(added).filter(x=>x[1]).map(x=>x[1]+" "+x[0]).join(", "),"good");save();return {ok:true,added};
  }

  function backupJSON(G){G=G||root.G;if(!G)return null;return JSON.stringify({kind:"box-office-war-save-backup",schemaVersion:1,exportedAt:new Date().toISOString(),save:G},null,2);}
  function validateBackup(text){
    let b;try{b=typeof text==="string"?JSON.parse(text):text;}catch(e){return {ok:false,reason:"The backup file is not valid JSON."};}
    if(b?.kind==="box-office-war-save-backup"){if(!b.save||typeof b.save!=="object"||!b.save.studio||!Array.isArray(b.save.projects)||!Array.isArray(b.save.films))return {ok:false,reason:"The backup is missing core career data."};return {ok:true,save:b.save};}
    if(b&&b.studio&&Array.isArray(b.projects)&&Array.isArray(b.films))return {ok:true,save:b};
    return {ok:false,reason:"This file does not contain a Box Office War career."};
  }
  function restoreBackup(text){
    const v=validateBackup(text);if(!v.ok)return v;
    try{root.localStorage.setItem(LATEST_SAFETY_KEY,JSON.stringify(root.G||{}));}catch(e){}
    let raw;try{raw=JSON.stringify(v.save);const code=root.btoa(unescape(encodeURIComponent(raw)));}catch(e){return {ok:false,reason:"This device could not prepare the import."};}
    try{const code=root.btoa(unescape(encodeURIComponent(raw))),importer=typeof root.importCode==="function"?root.importCode:(typeof importCode==="function"?importCode:null);if(!importer||!importer(code))return {ok:false,reason:"Save validation refused this backup; your current career is unchanged."};}
    catch(e){return {ok:false,reason:"The backup could not be restored: "+e.message};}
    return {ok:true,studio:root.G?.studio?.name||"Career"};
  }
  function restoreSafetySnapshot(){
    let raw=null;try{raw=root.localStorage.getItem(LATEST_SAFETY_KEY);}catch(e){}
    if(!raw)return {ok:false,reason:"No pre-restore safety snapshot is stored on this device."};
    return restoreBackup(raw);
  }
  function hasSafetySnapshot(){try{return !!root.localStorage.getItem(LATEST_SAFETY_KEY);}catch(e){return false;}}
  function downloadFile(name,content,type){
    try{const blob=new root.Blob([content],{type:type||"application/json"}),url=root.URL.createObjectURL(blob),a=root.document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>root.URL.revokeObjectURL(url),1000);return true;}catch(e){return false;}
  }

  function balanceReport(G){
    G=G||root.G;const checks=[];if(!G)return {checks:[{id:"game",ok:false,label:"Career loaded",detail:"No active save."}]};
    const cash=Number(G.studio?.cash),debt=Number(G.studio?.debt)||0;
    checks.push({id:"cash",ok:Number.isFinite(cash),label:"Cash ledger",detail:Number.isFinite(cash)?fmt(cash):"Cash is not a finite number."});
    checks.push({id:"debt",ok:Number.isFinite(debt)&&debt>=0,label:"Debt state",detail:fmt(debt)});
    const badProjects=(G.projects||[]).filter(p=>!Number.isFinite(Number(p.budget))||Number(p.budget)<0||!p.phase);
    checks.push({id:"projects",ok:badProjects.length===0,label:"Production records",detail:(G.projects||[]).length+" active · "+badProjects.length+" invalid"});
    const badFilms=(G.films||[]).filter(f=>!Number.isFinite(Number(f.ww||0))||!Number.isFinite(Number(f.releaseWeek||0)));
    checks.push({id:"films",ok:badFilms.length===0,label:"Release records",detail:(G.films||[]).length+" titles · "+badFilms.length+" invalid"});
    const conflicts=calendarWarnings(G);
    checks.push({id:"calendar",ok:conflicts.length===0,label:"Calendar conflicts",detail:conflicts.length?conflicts.map(c=>c.project+" / "+c.other).join("; "):"No reserved cast/location overlaps."});
    const deals=(G.films||[]).flatMap(f=>Object.values(f.territoryDeals||{})),expired=deals.filter(d=>d.endWeek&&d.endWeek<G.week).length;
    checks.push({id:"rights",ok:true,label:"Territory rights windows",detail:deals.length+" signed · "+expired+" expired (royalties stop at term end)"});
    checks.push({id:"episodes",ok:(G.series||[]).every(s=>!s.episodeRecords||Array.isArray(s.episodeRecords)),label:"Episode ledgers",detail:(G.series||[]).reduce((n,s)=>n+(s.episodeRecords||[]).length,0)+" episode records"});
    const all=(G.txHistory||[]).slice(-12).flatMap(x=>Object.values(x.cats||{})).every(Number.isFinite);
    checks.push({id:"transactions",ok:all,label:"Weekly transactions",detail:all?"Recent transaction values are finite.":"A recent category contains a non-number."});
    return {checks,passed:checks.filter(c=>c.ok).length,total:checks.length,week:G.week,studio:G.studio.name,cash,debt};
  }
  function balanceText(G){const r=balanceReport(G);return ["BOX OFFICE WAR BALANCE / REGRESSION SNAPSHOT",r.studio+" · week "+r.week,"Checks: "+r.passed+"/"+r.total,...r.checks.map(c=>(c.ok?"PASS":"FAIL")+" · "+c.label+" — "+c.detail)].join("\n");}

  function updateGuide(G){
    const n=stateOf(G),guide=n?.guide;if(!guide||!guide.active||guide.done)return guide;
    const created=(G.projects||[]).length+(G.films||[]).length+(G.series||[]).length>0;
    const ready=(G.projects||[]).some(p=>p.phase==="ready"||p.phase==="delivered")||(G.films||[]).length>0||(G.stats?.seriesSeasons||0)>0;
    const released=(G.stats?.films||0)>0||(G.stats?.seriesSeasons||0)>0;
    const result=(G.films||[]).some(f=>(f.ww||0)>0)||(G.series||[]).some(s=>(s.seasons||[]).some(x=>x.viewership>0));
    const slate=(G.stats?.films||0)+(G.stats?.seriesSeasons||0)>=2;
    const done=[created,ready,released,result,slate];
    while(guide.step<done.length&&done[guide.step])guide.step++;
    if(guide.step>=GUIDE_STEPS.length){guide.done=true;guide.active=false;guide.completedWeek=G.week;say(G,"🎓 FIRST FILM LAB complete — you have commissioned, released and reviewed your first title. Your studio is ready for the full market.","gold");}
    return guide;
  }
  function renderGuide(G){
    const guide=updateGuide(G);if(!guide||!guide.active||guide.done||guide.dismissed)return "";
    const step=GUIDE_STEPS[Math.min(guide.step,GUIDE_STEPS.length-1)],count=guide.step+1;
    return `<aside class="nw-guide" aria-label="First-run guided campaign"><div><span class="nw-eyebrow">FIRST FILM LAB · STEP ${count} OF ${GUIDE_STEPS.length}</span><h2>${esc(step.title)}</h2><p>${esc(step.body)}</p><div class="nw-progress" role="progressbar" aria-valuenow="${guide.step}" aria-valuemin="0" aria-valuemax="${GUIDE_STEPS.length}"><i style="width:${Math.round(guide.step/GUIDE_STEPS.length*100)}%"></i></div></div><div class="nw-guide-actions"><button class="nw-primary" data-nw-guide-tab="${step.tab}">Go to ${esc(step.tab==="develop"?"Develop":step.tab==="productions"?"Productions":"Box Office")} ↗</button><button class="nw-quiet" id="nwGuideHide" aria-label="Hide campaign guidance">Hide</button></div></aside>`;
  }

  function tickRivalStrategies(G){
    G=G||root.G;const n=stateOf(G);if(!n)return;const rv=n.rivals,week=G.week;
    for(const r of G.rivals||[])for(const f of r.slate||[]){
      if(f.week<=week||f.counterProgrammedAt)continue;
      const our=(G.projects||[]).filter(p=>p.releaseWeek&&Math.abs(p.releaseWeek-f.week)<=1&&p.phase!=="delivered");
      if(!our.length)continue;const target=our.sort((a,b)=>(b.scale==="tentpole")-(a.scale==="tentpole"))[0];
      if(target.scale==="tentpole"||target.marketing>40){const old=f.week,choices=[old-1,old+1,old+2].filter(w=>w>week&&!r.slate.some(x=>x!==f&&x.week===w));if(choices.length){f.week=choices[0];f.counterProgrammedAt=week;rv.reactions.unshift({week,kind:"counter-program",rival:r.name,title:f.title,against:target.title,from:old,to:f.week});say(G,"⚔️ "+r.name+" counter-programs “"+target.title+"” — “"+f.title+"” shifts to week "+f.week+".","");}}
    }
    (rv.offers||[]).forEach(o=>{
      if(o.status!=="open"||week<o.expires)return;const t=findById(G.talent,o.talentId);o.status="expired";
      if(!t||t.rivalProtectedUntil>week||t.bookedUntil>week){o.status="withdrawn";return;}
      t.rivalExclusiveUntil=week+13;t.bookedUntil=week+13;t.booked="exclusive to "+o.rivalName;o.status="accepted";
      const rival=(G.rivals||[]).find(x=>x.name===o.rivalName);if(rival)rival.cash=Math.max(0,(rival.cash||0)-o.fee);
      say(G,"🎭 "+o.rivalName+" signs "+t.name+" to a 13-week exclusive. A counteroffer would have kept the talent on the open market.","bad");
    });
    rv.offers=rv.offers.filter(o=>week<=o.expires+26);
    if(week-rv.lastPoachAt>=13){
      const talent=(G.talent||[]).filter(t=>!t.retired&&t.kind!=="animal"&&(!t.bookedUntil||t.bookedUntil<=week)&&(!t.rivalProtectedUntil||t.rivalProtectedUntil<=week));
      if(talent.length>0){const t=talent[(Math.floor(Math.random()*talent.length))],rivals=(G.rivals||[]).filter(r=>!r.acquiredBy&&(r.cash||0)>8);
        if(rivals.length){const rival=rivals[Math.floor(Math.random()*rivals.length)],fee=Math.max(2,round((t.fee||2)*1.2,1));rv.offers.push({id:"poach_"+week+"_"+String(t.id),talentId:t.id,talentName:t.name,rivalName:rival.name,fee,week,expires:week+3,status:"open"});rv.lastPoachAt=week;say(G,"📞 Talent bid: "+rival.name+" offers "+fmt(fee)+" for "+t.name+". Counter in the Next Wave desk within 3 weeks.","gold");}}
    }
    if(week-rv.lastAcquisitionAt>=26&&(G.rivals||[]).filter(r=>!r.acquiredBy).length>2){
      const active=(G.rivals||[]).filter(r=>!r.acquiredBy),buyer=active.slice().sort((a,b)=>(b.cash||0)-(a.cash||0))[0],target=active.filter(r=>r!==buyer).sort((a,b)=>(a.cash||0)-(b.cash||0))[0];
      if(buyer&&target&&Math.random()<0.28){const price=Math.max(20,round((target.cash||0)*0.3+(target.ytd||0)*0.08,1));if((buyer.cash||0)>=price){buyer.cash-=price;buyer.cash+=Math.round((target.cash||0)*0.65);buyer.acquisitions=(buyer.acquisitions||[]).concat(target.name);target.acquiredBy=buyer.name;target.cash=0;target.ytd=0;buyer.slate=(buyer.slate||[]).concat((target.slate||[]).filter(f=>f.week>week));rv.deals.unshift({week,buyer:buyer.name,target:target.name,price,kind:"acquisition"});rv.lastAcquisitionAt=week;say(G,"🏢 Rival acquisition: "+buyer.name+" absorbs "+target.name+" and its unreleased slate (reported value "+fmt(price)+").","gold");}}
    }
    const releases=(G.films||[]).filter(f=>f.releaseWeek===week&&!f.rivalReactionAt);
    releases.forEach(f=>{if((f.opening||f.ww||0)>=35){const rival=(G.rivals||[]).filter(r=>!r.acquiredBy).sort((a,b)=>(a.ytd||0)-(b.ytd||0))[0];if(rival){f.rivalReactionAt=week;rv.reactions.unshift({week,kind:"success-response",rival:rival.name,title:f.title});say(G,"📈 Rivals take note of “"+f.title+"”’s opening. "+rival.name+" redirects its next slate meeting toward your breakout genre.","good");}}});
    if(rv.reactions.length>40)rv.reactions.length=40;
  }
  function counterRivalOffer(id,G){
    G=G||root.G;const offers=stateOf(G)?.rivals.offers,o=offers?.find(x=>String(x.id)===String(id)&&x.status==="open");if(!o)return {ok:false,reason:"The rival bid has expired."};
    const t=findById(G.talent,o.talentId);if(!t)return {ok:false,reason:"That talent has left the market."};const price=Math.max(2,round((typeof root.actorFee==="function"?root.actorFee(t):t.fee||2)*1.25,1));
    if(G.studio.cash<price)return {ok:false,reason:"A matching exclusive costs "+fmt(price)+"."};spendSafe("talent",price);o.status="countered";o.counterCost=price;t.rivalProtectedUntil=G.week+26;t.rivalExclusiveUntil=0;t.bookedUntil=0;t.booked=null;t.contract={type:"exclusive",filmsLeft:null,until:G.week+26};say(G,"🤝 Counterbid accepted: "+t.name+" stays with your studio through week "+(G.week+26)+" ("+fmt(price)+").","good");save();return {ok:true,cost:price};
  }

  function tick(G){
    G=G||root.G;if(!G)return;const n=stateOf(G);if(!n)return;
    auditESG(G);updateGuide(G);
    for(const p of G.projects||[]){const w=p.scheduledWindow;if(!w||p.phase!=="shoot"||G.week<w.startWeek||G.week>w.endWeek||w.weatherWeek===G.week)continue;
      if(Math.random()<0.035){const pickupCost=0.8;w.weatherWeek=G.week;w.weatherDelays=(w.weatherDelays||0)+1;w.weatherReshoots=(w.weatherReshoots||0)+1;w.endWeek++;p.phaseLen=p.phaseLen||{};p.phaseLen.shoot=(p.phaseLen.shoot||10)+1;p.reshootCount=(p.reshootCount||0)+1;p.spent=(p.spent||0)+pickupCost;spendSafe("production",pickupCost);n.calendar.weatherEvents.unshift({week:G.week,project:p.title,type:"weather-pickup",delay:1,cost:pickupCost});say(G,"🌧️ Weather delay: "+p.title+" loses one exterior-shoot week and schedules a $0.8M pickup reshoot. Calendar reservation extended.","bad");}}
    for(const fr of G.franchises||[])updateFranchiseLifecycle(fr,G);
  }

  function renderDesk(G){
    G=G||root.G;const n=stateOf(G);if(!G||!n)return "<div class='card'>Next Wave systems are loading.</div>";
    const projects=(G.projects||[]).filter(p=>["pre","shoot"].includes(p.phase));
    const conflicts=calendarWarnings(G),offers=(n.rivals.offers||[]).filter(o=>o.status==="open"),guide=n.guide;
    const series=(G.series||[]).map(s=>{const p=initializeSeriesSeason(s,G),records=(s.episodeRecords||p?.episodes||[]).slice(-5).reverse();const epCount=(s.episodeRecords||p?.episodes||[]).length;
      const rating=(s.seasons||[]).slice(-1)[0]?.viewership||0,analysis=(G.offers||[]).filter(o=>o.type==="renewal"&&o.seriesId===s.id).map(o=>seasonRenewalAnalysis(s,o,G))[0];
      return `<article class="nw-row"><div class="nw-row-main"><b>${esc(s.title)}</b><small>Season ${p?.season||s.seasons.length+1} · ${epCount}/${s.eps} episodes · ${s.status||s.phase}</small>${analysis?`<small>Renewal check: ${rating}/100 audience · ${fmt(analysis.projected)} ${analysis.own?"studio cash":"order value"} / ${fmt(analysis.cost)} season cost · <strong class="${analysis.renew?'nw-ok':'nw-warn'}">${esc(analysis.reason)}</strong></small>`:""}${records.length?`<div class="nw-episode-list">${records.map(ep=>`<span title="${esc(ep.focus||"")} · ${esc(ep.arc||"")}">S${ep.season}E${String(ep.number).padStart(2,"0")} ${esc(ep.title)} · ${ep.quality}/100</span>`).join("")}</div>`:""}</div><label class="nw-field">Season arc<select data-nw-arc="${esc(s.id)}">${Object.keys(ARCS).map(k=>`<option value="${k}" ${(s.storyArc||"ensemble")===k?"selected":""}>${esc(ARCS[k].label)}</option>`).join("")}</select></label><label class="nw-field">Episode focus<select data-nw-focus="${esc(s.id)}">${Object.keys(FOCUSES).map(k=>`<option value="${k}" ${(s.episodeFocus||"story")===k?"selected":""}>${esc(FOCUSES[k].label)}</option>`).join("")}</select></label></article>`;
    }).join("")||`<p class="nw-muted">No series yet. Episode ledgers begin as soon as your next season enters production.</p>`;
    const schedule=projects.map(p=>{const w=p.scheduledWindow;return `<article class="nw-row"><div class="nw-row-main"><b>${esc(p.title)}</b><small>${esc(p.phase)} · ${w?`reserved weeks ${w.startWeek}–${w.endWeek}`:"no shoot window booked"}${w&&w.weatherReshoots?` · ${w.weatherReshoots} pickup reshoot(s)`:""} · ${esc(root.DATA?.location?.(p.location)?.name||p.location||"location TBD")}</small></div><button class="nw-action" data-nw-schedule="${esc(p.id)}">${w?"Find a conflict-free slot":"Book next clear window"}</button></article>`;}).join("")||`<p class="nw-muted">No productions currently need calendar holds.</p>`;
    const candidates=(G.films||[]).filter(f=>!f.streamingOriginal&&f.quality&&(f.inTheaters||G.week-(f.releaseWeek||0)<52)).slice(-4);
    const distro=candidates.map(f=>{const os=marketplaceOffers(f,G).slice(0,2);return `<article class="nw-row"><div class="nw-row-main"><b>${esc(f.title)}</b><small>${esc(f.genre)} · ${Object.keys(f.territoryDeals||{}).length}/4 territories licensed</small></div><div class="nw-offer-group">${os.map(o=>`<button class="nw-action" data-nw-distribute="${esc(f.id)}:${o.regionId}:MINIMUM_GUARANTEE">${esc(o.regionName)} · MG ${fmt(o.mg.upfront)}</button>`).join("")||`<span class="nw-muted">Territories licensed</span>`}</div></article>`;}).join("")||`<p class="nw-muted">Finish a film to receive territory-level distributor offers.</p>`;
    const franchises=(G.franchises||[]).map(fr=>{const l=updateFranchiseLifecycle(fr,G);return `<article class="nw-row"><div class="nw-row-main"><b>${esc(fr.name)}</b><small>${esc(l.stage)} · brand health ${l.health}/100 · ${l.divisions} active divisions · ${fr.entries?.length||0} story entries</small></div><button class="nw-action" data-nw-revive="${esc(fr.id)}" ${(G.studio.cash<8)?"disabled":""}>Revival campaign · $8M</button></article>`;}).join("")||`<p class="nw-muted">Franchise lifecycle reports connect here as IP is created.</p>`;
    const meta=ngPlusState(),season=quarterSeason(G),board=seasonalScores()[season]||[],guideProgress=campaignProgress(G),esg=n.esgCommitment;
    const report=balanceReport(G),calendarNotice=conflicts.length?conflicts.map(c=>`<li>${esc(c.project)} / ${esc(c.other)} · week ${c.week}</li>`).join(""):`<li>No cast, crew or location conflicts currently detected.</li>`;
    const rivalRows=offers.map(o=>`<article class="nw-row"><div class="nw-row-main"><b>${esc(o.rivalName)} bids for ${esc(o.talentName)}</b><small>${fmt(o.fee)} offer · expires week ${o.expires}</small></div><button class="nw-action" data-nw-counter="${esc(o.id)}">Counter · ${fmt(Math.max(2,(findById(G.talent,o.talentId)?.fee||2)*1.25))}</button></article>`).join("")||`<p class="nw-muted">No active rival talent bids. Offers can be countered for a 26-week exclusive.</p>`;
    const recentDeals=n.rivals.deals.slice(0,3).map(d=>`<li>W${d.week}: ${esc(d.buyer)} acquired ${esc(d.target)} · ${fmt(d.price)}</li>`).join("");
    const goal=guideProgress;
    return `<section class="nextwave-desk" aria-label="Next Wave studio systems"><header class="nw-hero"><div><span class="nw-eyebrow">STUDIO HQ / 09 / INDUSTRY INTELLIGENCE</span><h1>Next Wave</h1><p>Episode room, production calendar, distribution market and the systems that carry a studio into its next career.</p></div><div class="nw-hero-status"><small>CAREER CHECKS</small><b>${report.passed}/${report.total}</b><span>balance &amp; regression</span></div></header>
      ${guide&&guide.active?`<section class="nw-section nw-campaign-callout"><div><span class="nw-eyebrow">GUIDED CAMPAIGN · ${guide.done?"COMPLETE":"IN PROGRESS"}</span><h2>${guide.done?"First Film Lab cleared":"First Film Lab"}</h2><p>${guide.done?"Your first production loop is complete.":"A short playable introduction to greenlight → production → release → results."}</p>${goal?`<small>Goal ${goal.films}/${goal.targetFilms} titles · ${fmt(goal.gross)} / ${fmt(goal.targetGross)} gross · ${Math.max(0,goal.deadline-goal.remaining)} weeks left</small>`:""}</div><span class="nw-badge">${guide.done?"CLEARED":Math.min(guide.step+1,GUIDE_STEPS.length)+" / "+GUIDE_STEPS.length}</span></section>`:""}
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">01 / TELEVISION</span><h2>Episode production room</h2><p>Schedule episodes, choose a season arc and focus, then inspect episode-level quality before the platform decides on renewal.</p></div></div><div class="nw-list">${series}</div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">02 / PRODUCTION CONTROL</span><h2>Calendar &amp; crew availability</h2><p>Shared cast, department crew and locations are reserved together. Weather can push exterior shoots and automatically extend the hold.</p></div></div><div class="nw-list">${schedule}</div><div class="nw-conflicts" role="status"><b>Conflict scan</b><ul>${calendarNotice}</ul></div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">03 / COMPETITIVE INTELLIGENCE</span><h2>Rival studio moves</h2><p>Rivals bid for people, shift release dates around tentpoles, react to breakouts and can acquire a struggling studio.</p></div></div><div class="nw-list">${rivalRows}</div>${recentDeals?`<ul class="nw-history">${recentDeals}</ul>`:""}</section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">04 / SALES &amp; RIGHTS WINDOWS</span><h2>Distribution marketplace</h2><p>Compare minimum guarantees and revenue shares by territory. Each signed licence carries a clear 13–104 week rights term.</p></div><button class="nw-action" id="nwOpenTerritory">Open full rights desk ↗</button></div><div class="nw-list">${distro}</div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">05 / FRANCHISE PORTFOLIO</span><h2>Story-world lifecycle</h2><p>Track active, resting and legacy IP across film entries, merchandise, parks, games and publishing. A revival relieves fatigue across the brand.</p></div></div><div class="nw-list">${franchises}</div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">06 / ACCOUNTABILITY</span><h2>ESG targets &amp; audit</h2><p>Make a funded sustainability pledge and report against the existing green-production investments.</p></div><span class="nw-badge">CARBON ${esgScore(G)}/100</span></div>${esg?`<div class="nw-conflicts"><b>${esc(esg.status.toUpperCase())} · target ${esg.target} by week ${esg.dueWeek}</b><p>Current score ${esgScore(G)} · baseline ${esg.baseline} · audit window ${Math.max(0,esg.dueWeek-G.week)} weeks.</p></div>`:`<div class="nw-actions">${[25,45,65].map(x=>`<button class="nw-action" data-nw-esg="${x}" ${(G.studio.cash<3)?"disabled":""}>Pledge ${x} · $3M audit</button>`).join("")}</div><small class="nw-muted">A year later: beat the target for an incentive and reputation; miss it and public trust falls.</small>`}</section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">07 / CAMPAIGN DESIGNER</span><h2>Build a scenario</h2><p>Create a local, playable campaign with starting cash, debt, reputation, milestones and a win deadline.</p></div><button class="nw-action" id="nwBuildCampaign">Create campaign</button></div>${Object.keys(root.DATA?.SCENARIOS||{}).filter(id=>root.DATA.SCENARIOS[id].customCampaign).map(id=>`<span class="nw-badge">${esc(root.DATA.SCENARIOS[id].name)}</span>`).join("")}</section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">08 / SEASONAL CHALLENGE</span><h2>${esc(season)} leaderboard</h2><p>Quarterly scores are shareable codes and stored on this device. Cross-device/live rankings require a backend; no online leaderboard is claimed.</p></div><div class="nw-actions"><button class="nw-action" id="nwArchiveScore">Archive this career</button><button class="nw-action" id="nwImportScore">Import a seasonal code</button></div></div><div class="nw-list">${board.slice(0,5).map((x,i)=>`<article class="nw-row"><div class="nw-row-main"><b>#${i+1} · ${esc(x.studio)}</b><small>${x.score} pts · week ${x.week}${x.imported?" · imported code":" · local entry"}</small></div>${x.code?`<button class="nw-action" data-nw-copy-code="${esc(x.code)}">Copy code</button>`:""}</article>`).join("")||`<p class="nw-muted">No scores archived for this season.</p>`}</div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">09 / CREATOR TOOLS</span><h2>Modding &amp; content packs</h2><p>Import/export validated JSON for film pitches, genres, talent, rivals, franchises and scenarios. Packs contain data only—never executable scripts.</p></div><button class="nw-action" id="nwOpenPack">Manage content pack</button></div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">10 / CAREER PROGRESSION</span><h2>New Game+ &amp; milestones</h2><p>Finish a career to earn Legacy Credits. Spend them once when founding your next studio, or start fresh with no carry-over.</p></div><span class="nw-badge">${meta.points} LEGACY CREDIT${meta.points===1?"":"S"}</span></div><div class="nw-perk-grid">${meta.perks.map(p=>`<div><b>${esc(p.label)}</b><small>${esc(p.desc)} · cost ${p.cost}${p.available?" · available":" · locked"}</small></div>`).join("")}</div><small class="nw-muted">Current run milestones: ${typeof root.endgameGoals==="function"?root.endgameGoals().filter(x=>x.prog>=1).length:0}/6 endgame goals · ${(G.stats?.awards||[]).length} awards · ${G.stats?.films||0} film releases.</small></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">11 / SAVE VAULT</span><h2>Backup &amp; restore</h2><p>Export a readable career JSON or restore one after a validation check. Before restore, a safety copy of the current career is retained on this device.</p></div><button class="nw-action" id="nwSaveBackup">Backup / restore</button></div></section>
      <section class="nw-section"><div class="nw-section-head"><div><span class="nw-eyebrow">12 / BALANCE REGRESSION</span><h2>Economy &amp; feature checks</h2><p>Read-only sanity scan for the ledger, project records, episode histories, release rights and production-calendar conflicts.</p></div><button class="nw-action" id="nwCopyBalance">Copy report</button></div><div class="nw-check-grid">${report.checks.map(c=>`<div class="nw-check ${c.ok?"pass":"fail"}"><b>${c.ok?"✓":"!"} ${esc(c.label)}</b><small>${esc(c.detail)}</small></div>`).join("")}</div></section>
      <section class="nw-section nw-access"><span class="nw-eyebrow">ACCESS &amp; LOCALIZATION</span><p>Keyboard-operable actions and labelled controls are used throughout this desk. English, Hindi and Marathi are available in Settings; reduced motion and non-colour status cues remain supported there.</p><button class="nw-quiet" id="nwOpenSettings">Open accessibility &amp; language settings</button></section></section>`;
  }

  function bindView(scope){
    scope=scope||root.document;if(!scope)return;
    const done=(r,msg)=>{if(r?.ok){if(typeof root.toast==="function")root.toast(msg||"Saved.","good");if(typeof root.render==="function")root.render();}else if(typeof root.toast==="function")root.toast(r?.reason||"That action could not be completed.","bad");};
    scope.querySelectorAll("[data-nw-arc]").forEach(x=>x.onchange=()=>{setSeriesPlan(x.dataset.nwArc,"arc",x.value);if(typeof root.render==="function")root.render();});
    scope.querySelectorAll("[data-nw-focus]").forEach(x=>x.onchange=()=>{setSeriesPlan(x.dataset.nwFocus,"focus",x.value);if(typeof root.render==="function")root.render();});
    scope.querySelectorAll("[data-nw-schedule]").forEach(b=>b.onclick=()=>done(scheduleNextClearSlot(b.dataset.nwSchedule),"Production moved to the next conflict-free shoot window."));
    scope.querySelectorAll("[data-nw-counter]").forEach(b=>b.onclick=()=>done(counterRivalOffer(b.dataset.nwCounter),"Talent accepted your matching bid."));
    scope.querySelectorAll("[data-nw-revive]").forEach(b=>b.onclick=()=>done(franchiseRevive(b.dataset.nwRevive),"Franchise revival campaign booked."));
    scope.querySelectorAll("[data-nw-esg]").forEach(b=>b.onclick=()=>done(setESGTarget(+b.dataset.nwEsg),"ESG target filed."));
    scope.querySelectorAll("[data-nw-distribute]").forEach(b=>b.onclick=()=>{const [fid,rid,model]=b.dataset.nwDistribute.split(":");const choice=typeof root.prompt==="function"?root.prompt("Rights term in weeks: 13, 26, 52, or 104","26"):"26";if(choice===null)return;done(signDistributionOffer(fid,rid,model,false,+choice),"Territory offer signed with a fixed rights window.");});
    scope.querySelectorAll("[data-nw-copy-code]").forEach(b=>b.onclick=()=>copyText(b.dataset.nwCopyCode).then(ok=>{if(ok&&root.toast)root.toast("Seasonal code copied.","good");}));
    scope.querySelectorAll("[data-nw-guide-tab]").forEach(b=>b.onclick=()=>{stateOf(root.G).guide.dismissed=false;if(typeof root.switchTab==="function")root.switchTab(b.dataset.nwGuideTab);});
    const hide=scope.querySelector("#nwGuideHide");if(hide)hide.onclick=()=>{const g=stateOf(root.G)?.guide;if(g){g.dismissed=true;save();if(root.render)root.render();}};
    const openTerritory=scope.querySelector("#nwOpenTerritory");if(openTerritory)openTerritory.onclick=()=>root.openTerritoryDealsModal?.();
    const campaign=scope.querySelector("#nwBuildCampaign");if(campaign)campaign.onclick=()=>openCampaignBuilder();
    const archive=scope.querySelector("#nwArchiveScore");if(archive)archive.onclick=()=>{const x=archiveSeasonalScore(root.G);save();if(root.render)root.render();if(root.toast)root.toast("Score archived · "+x.score+" points. Copy its code from the board.","good");};
    const importScore=scope.querySelector("#nwImportScore");if(importScore)importScore.onclick=()=>{const code=typeof root.prompt==="function"?root.prompt("Paste a BOWS1 seasonal challenge code:"):null;if(!code)return;const r=importSeasonalCode(code);if(r.ok){root.toast?.("Seasonal score imported · "+r.entry.season,"good");root.render?.();}else root.toast?.(r.reason,"bad");};
    const pack=scope.querySelector("#nwOpenPack");if(pack)pack.onclick=()=>openPackModal();
    const backup=scope.querySelector("#nwSaveBackup");if(backup)backup.onclick=()=>openBackupModal();
    const copy=scope.querySelector("#nwCopyBalance");if(copy)copy.onclick=()=>copyText(balanceText(root.G)).then(ok=>{if(root.toast)root.toast(ok?"Balance report copied.":"Clipboard unavailable; see the on-screen checks.",ok?"good":"bad");});
    const settings=scope.querySelector("#nwOpenSettings");if(settings)settings.onclick=()=>root.settingsModal?.();
  }

  function openCampaignBuilder(){
    if(typeof root.openModal!=="function")return;
    const h=`<div class="nw-modal"><h3>🧩 Campaign designer</h3><p class="nw-muted">Custom scenarios stay in local storage and appear in the start-screen scenario list. Win by releasing the target number of films and reaching worldwide gross before the deadline.</p><div class="nw-form-grid"><label>Name<input id="nwcName" maxlength="42" value="My Box Office Challenge"></label><label>Starting cash ($M)<input id="nwcCash" type="number" min="60" max="1200" value="180"></label><label>Starting debt ($M)<input id="nwcDebt" type="number" min="0" max="500" value="0"></label><label>Starting reputation<input id="nwcRep" type="number" min="5" max="90" value="28"></label><label>Film releases to win<input id="nwcFilms" type="number" min="1" max="20" value="1"></label><label>Worldwide gross goal ($M)<input id="nwcGross" type="number" min="0" max="5000" value="100"></label><label>Deadline (weeks)<input id="nwcDeadline" type="number" min="26" max="520" value="104"></label><label>Campaign note<input id="nwcDesc" maxlength="110" value="Build a slate that earns the audience’s trust."></label></div><div class="modal-actions"><button class="btn btn-ghost" id="nwcCancel">Cancel</button><button class="btn btn-primary" id="nwcSave">Save campaign</button></div></div>`;
    const v=root.openModal(h);if(!v)return;v.querySelector("#nwcCancel").onclick=()=>root.closeModal();v.querySelector("#nwcSave").onclick=()=>{const $=id=>v.querySelector("#"+id);const r=createCampaign({name:$("nwcName").value,cash:+$("nwcCash").value,debt:+$("nwcDebt").value,rep:+$("nwcRep").value,films:+$("nwcFilms").value,gross:+$("nwcGross").value,deadline:+$("nwcDeadline").value,desc:$("nwcDesc").value});if(!r.ok){root.toast?.(r.reason,"bad");return;}root.closeModal();root.toast?.("Campaign saved. Choose it from the start-screen scenario cards.","good");root.render?.();};
  }
  function openPackModal(){
    if(typeof root.openModal!=="function")return;const pack=contentPack(root.G),json=JSON.stringify(pack,null,2);
    const h=`<div class="nw-modal"><h3>🧰 Studio content packs</h3><p class="nw-muted">This versioned format accepts JSON data only. Unknown fields and unsupported schemas are ignored or rejected; no scripts are executed.</p><textarea id="nwPackText" aria-label="Content pack JSON" rows="11" spellcheck="false">${esc(json)}</textarea><input type="file" id="nwPackFile" accept="application/json,.json" aria-label="Choose a content pack file"><div class="modal-actions"><button class="btn btn-ghost" id="nwPackCancel">Close</button><button class="btn btn-alt" id="nwPackDownload">Download current pack</button><button class="btn btn-primary" id="nwPackImport">Validate &amp; import</button></div></div>`;
    const v=root.openModal(h);if(!v)return;v.querySelector("#nwPackCancel").onclick=()=>root.closeModal();v.querySelector("#nwPackDownload").onclick=()=>downloadFile("box-office-war-content-pack.json",json);
    v.querySelector("#nwPackFile").onchange=e=>{const file=e.target.files?.[0];if(!file)return;const reader=new root.FileReader();reader.onload=()=>{v.querySelector("#nwPackText").value=String(reader.result||"");};reader.readAsText(file);};
    v.querySelector("#nwPackImport").onclick=()=>{const r=importContentPack(v.querySelector("#nwPackText").value,root.G);if(!r.ok){root.toast?.(r.reason,"bad");return;}root.closeModal();root.toast?.("Validated pack imported.","good");root.render?.();};
  }
  function openBackupModal(){
    if(typeof root.openModal!=="function")return;const json=backupJSON(root.G),recoverable=hasSafetySnapshot();
    const h=`<div class="nw-modal"><h3>💾 Career backup &amp; restore</h3><p class="nw-muted">Download the current career as readable JSON. Restore accepts this format or a raw career save; validation runs before replacing the active slot.</p><textarea id="nwBackupText" aria-label="Career backup JSON" rows="9" readonly>${esc(json||"")}</textarea><input type="file" id="nwBackupFile" accept="application/json,.json" aria-label="Choose a career backup file"><div class="modal-actions"><button class="btn btn-ghost" id="nwBackupClose">Close</button><button class="btn btn-alt" id="nwBackupDownload">Download backup</button><button class="btn btn-primary" id="nwBackupRestore">Validate &amp; restore</button><button class="btn btn-alt" id="nwBackupRecover" ${recoverable?"":"disabled"}>Restore safety snapshot</button></div><small class="nw-muted">A pre-restore safety snapshot is stored locally and can be restored here after an import.</small></div>`;
    const v=root.openModal(h);if(!v)return;v.querySelector("#nwBackupClose").onclick=()=>root.closeModal();v.querySelector("#nwBackupDownload").onclick=()=>downloadFile("box-office-war-"+String(root.G?.studio?.name||"career").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-week-"+(root.G?.week||0)+".json",json);
    v.querySelector("#nwBackupFile").onchange=e=>{const file=e.target.files?.[0];if(!file)return;const reader=new root.FileReader();reader.onload=()=>{v.querySelector("#nwBackupText").value=String(reader.result||"");};reader.readAsText(file);};
    v.querySelector("#nwBackupRestore").onclick=()=>{const r=restoreBackup(v.querySelector("#nwBackupText").value);if(!r.ok){root.toast?.(r.reason,"bad");return;}root.closeModal();root.toast?.("Career restored · "+r.studio,"good");root.render?.();};
    v.querySelector("#nwBackupRecover").onclick=()=>{const r=restoreSafetySnapshot();if(!r.ok){root.toast?.(r.reason,"bad");return;}root.closeModal();root.toast?.("Safety snapshot restored · "+r.studio,"good");root.render?.();};
  }

  function installIncidents(){
    if(!root.DATA?.EVENTS)return 0;let added=0;
    INCIDENTS.forEach(e=>{if(root.DATA.EVENTS.some(x=>x.id===e.id))return;root.DATA.EVENTS.push(e);added++;});return added;
  }
  installIncidents();

  root.NextWaveSuite={
    version:"41.0",ARCS,FOCUSES,NG_PERKS,GUIDE_STEPS,
    ensure:stateOf,onNewGame,recordCareer,metaInfo,ngPlusState,
    initializeSeriesSeason,setSeriesPlan,tickSeriesProduction,seasonRenewalAnalysis,
    scheduleProject,scheduleNextClearSlot,scheduleConflicts,calendarWarnings,
    marketplaceOffers,signDistributionOffer,updateFranchiseLifecycle,franchiseRevive,
    esgScore,setESGTarget,campaignProgress,createCampaign,restoreCampaigns,loadCampaigns,
    quarterSeason,seasonalScores,seasonalScore,archiveSeasonalScore,importSeasonalCode,decodeCode,
    contentPack,importContentPack,applyCustomGenres,clearCustomGenres,backupJSON,validateBackup,restoreBackup,restoreSafetySnapshot,hasSafetySnapshot,balanceReport,balanceText,
    updateGuide,renderGuide,tickRivalStrategies,counterRivalOffer,tick,renderDesk,bindView,installIncidents
  };
})(typeof window!=="undefined"?window:globalThis);
