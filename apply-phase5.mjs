import fs from "fs";
import path from "path";

const uiPath = path.resolve("./ui.js");
let ui = fs.readFileSync(uiPath, "utf8");

// 1. Add viewDevelopIP and viewDevelopTalent functions (insert after viewCombosCodex)
// Find the end of viewCombosCodex and add the new functions
const combosCodexEnd = ui.indexOf("/* Talent profile: career stage + derived history.");
if (combosCodexEnd === -1) {
  console.error("Could not find viewCombosCodex end");
  process.exit(1);
}

// Find the Talent profile comment
const talentProfileComment = ui.indexOf("/* Talent profile: career stage + derived history.");
const insertPos = talentProfileComment;

const newFunctions = `
/* ── v28: Develop sub-tab helpers ── */
function viewDevelopIP(){
  let h="";
  try{
    if(G.ipMarket && G.ipMarket.length){
      h+="<div class='section-title'>📚 IP Market</div><div class='grid g3'>";
      (G.ipMarket||[]).forEach(it=>{
        const k=(it.kind==="legacy")? {emoji:"🌍", name:"Legacy franchise — proven IP with a built-in fanbase"}
              : (DATA.IPKINDS? DATA.IPKINDS.find(x=>x.id===it.kind) : null) || {emoji:"📚",name:it.kind};
        h+="<div class='card"+(it.kind==="legacy"?" gold":"")+"'><div class='spread'><b>"+k.emoji+" "+esc(it.title)+"</b><span class='tag gold'>"+fmtM(it.price)+"</span></div>"+
          "<div class='tiny muted'>"+esc(k.name||"")+" · "+gTag(it.genre)+" · script +"+it.boost+" · awareness +"+Math.round(it.buzz*100)+"%</div>"+
          "<button class='btn btn-sm btn-primary' style='margin-top:8px' data-ip='"+it.id+"'>"+(it.kind==="legacy"?"Buy franchise rights":"Buy rights")+"</button></div>";
      });
      h+="</div>";
    } else {
      h+="<div class='card muted small'>No IP available this week. Check back next week.</div>";
    }
  }catch(e){}
  return h;
}

function viewDevelopTalent(){
  let h="";
  try{
    // talent business
    h+="<div class='section-title'>🎫 Talent Business</div><div class='grid g3'>";
    h+="<div class='card'><b>🎫 Wrap deal — $20M</b><div class='tiny muted' style='margin:4px 0 8px'>Next 3 pictures: all talent fees −20%.</div>"+
      (G.wrapDeal>0? "<span class='tag green'>"+G.wrapDeal+" picture(s) left</span>" : "<button class='btn btn-sm btn-alt' id='btnWrap'>Sign wrap deal</button>")+"</div>";
    h+="<div class='card'><b>🖋 Town-wide agency truce — $30M</b><div class='tiny muted' style='margin:4px 0 8px'>2 years of −15% on every quote, every agency.</div>"+
      (G.agencyExcl>G.week? "<span class='tag green'>"+(G.agencyExcl-G.week)+" weeks left</span>" : "<button class='btn btn-sm btn-alt' id='btnAgency'>Sign truce</button>")+"</div>";
    h+="<div class='card'><b>🌟 Cameos</b><div class='tiny muted'>While greenlighting, add a superstar cameo for 30% of their fee — +6% buzz.</div></div>";
    h+="</div>";
    /* v28: talent watchlist + long-term deals overview */
    const watch=(G.watchlist||[]).map(id=>(G.talent||[]).find(t=>t.id===id)).filter(Boolean);
    const deals=(G.talent||[]).filter(t=>t.multiDeal);
    if(watch.length || deals.length){
      h+="<div class='section-title'>⭐ Watchlist & 📜 Active Deals</div><div class='grid g2'>";
      h+="<div class='card'><b class='small'>⭐ Watchlist</b>"+
        (watch.length? watch.map(t=>"<div class='cost-line'><span><span class='link' style='cursor:pointer' onclick='talentModal("+t.id+")'>"+esc(t.name)+"</span></span><b class='tiny'>"+stars(t.power)+" · "+fmtM(actorFee(t))+"</b></div>").join("")
        : "<div class='tiny muted'>Pin talent from their profile (☆ watch) to track them here.</div>")+"</div>";
      h+="<div class='card'><b class='small'>📜 Active multi-film deals</b>"+
        (deals.length? deals.map(t=>"<div class='cost-line'><span>"+esc(t.name)+"</span><b class='tiny'>"+t.multiDeal.left+" film(s) left · −25% fees</b></div>").join("")
        : "<div class='tiny muted'>No long-term deals running. Sign a 3-film deal from any talent card.</div>")+"</div>";
      h+="</div>";
    }
    /* v5: named talent agencies */
    if(DATA.AGENCIES){
      h+="<div class='section-title'>🕴 The Agencies</div><div class='tiny muted' style='margin:-4px 0 6px'>Package two clients of the same agency in one film and they bill a packaging fee. An exclusive first-look deal waives their fee and cuts their clients' quotes.</div><div class='grid g3'>";
      DATA.AGENCIES.forEach(function(ag){
        const roster = (typeof agencyRoster==="function"? agencyRoster(ag.id) : []).filter(t=>!t.bookedUntil);
        const power = roster.reduce((a,t)=>a+t.power,0);
        const excl = G.agencyDeals && G.agencyDeals[ag.id]>G.week;
        h+="<div class='card'><div class='spread'><b>"+ag.icon+" "+ag.name+"</b>"+(excl? "<span class='tag green'>exclusive · "+(G.agencyDeals[ag.id]-G.week)+" wks</span>":"")+"</div>"+
          "<div class='tiny muted' style='margin:4px 0'>"+ag.blurb+"</div>"+
          "<div class='tiny muted'>Free agents repped: "+roster.length+" · combined "+power+"★"+(G.agencyExcl>G.week?" · covered by your town-wide truce":"")+"</div>"+
          (excl? "" : "<button class='btn btn-sm btn-alt' style='margin-top:8px' data-agdeal='"+ag.id+"'>Sign exclusive — "+fmtM(ag.dealCost)+" · "+Math.round(ag.dealWeeks/52)+" yrs · clients −"+Math.round(ag.disc*100)+"%</button>")+
          "</div>";
      });
      h+="</div>";
    }
    // writers, producers, directors, cast
    try{
      const freeA=(typeof freeTalent==="function"? freeTalent("actor") : G.talent.filter(t=>t.kind==="actor"&&!t.bookedUntil)).sort((a,b)=>b.power-a.power||b.skill-a.skill);
      const freeD=(typeof freeTalent==="function"? freeTalent("director") : G.talent.filter(t=>t.kind==="director"&&!t.bookedUntil)).sort((a,b)=>b.power-a.power||b.skill-a.skill);
      const freeW=(typeof freeTalent==="function"? freeTalent("writer") : []).sort((a,b)=>b.skill-a.skill||b.power-a.power);
      const freeP=(typeof freeTalent==="function"? freeTalent("producer") : []).sort((a,b)=>b.skill-a.skill||b.power-a.power);
      if(freeW.length){
        h+="<div class='section-title'>✍️ Writers on the market ("+freeW.length+")</div><div class='grid g3'>";
        for(const w of freeW.slice(0,6)) h+=talentCard(w);
        h+="</div>";
      }
      if(freeP.length){
        h+="<div class='section-title'>🎫 Producers on the market ("+freeP.length+")</div><div class='grid g3'>";
        for(const p of freeP.slice(0,6)) h+=talentCard(p);
        h+="</div>";
      }
      /* v9: below-the-line crew */
      if(typeof btlSeedIfMissing==="function"){
        btlSeedIfMissing();
        const roleMeta={dp:{icon:"🎥",name:"Cinematographer",eff:"audience +skill/25 on every film"},composer:{icon:"🎼",name:"Composer",eff:"critics +skill/22 (Oscar trait +2)"},vfx:{icon:"💫",name:"VFX house",eff:"audience +skill/30 on spectacle genres, overruns −8%"}};
        h+="<div class='section-title'>🎥 Below-the-line crew <span class='tiny'>(studio-wide · weekly retainer)</span></div><div class='grid g3'>";
        ["dp","composer","vfx"].forEach(r=>{
          const meta=roleMeta[r], cur=G.btl[r];
          h+="<div class='card'><b>"+meta.icon+" "+meta.name+"</b>";
          if(cur){
            h+="<div class='tiny muted' style='margin-top:4px'>✅ <b>"+esc(cur.name)+"</b> — "+esc(cur.trait)+" · skill "+cur.skill+" · "+fmtM(cur.salary)+"/wk</div>"+
              "<div class='tiny' style='margin-top:2px'><span class='tag'>Lv "+levelOf(cur)+"</span> <span class='tag green'>effect ×"+lvlMult(cur).toFixed(2)+"</span> <span class='tiny muted'>"+(cur.xp||0)+" shipped films</span></div>"+
              "<div class='tiny muted'>"+meta.eff+"</div>"+
              "<button class='btn btn-sm btn-ghost' style='margin-top:6px' data-btlfire='"+r+"'>✕ Let go ("+fmtM(cur.salary*8)+" severance)</button>";
          }else{
            h+="<div class='tiny muted' style='margin-top:4px'>Slot empty — "+meta.eff+".</div>";
            (G.btlMarket[r]||[]).forEach(c=>{
              h+="<div class='bid-card' style='margin-top:6px'><div style='flex:1;min-width:0'><b class='small'>"+esc(c.name)+"</b>"+
                "<div class='tiny muted'>"+esc(c.trait)+" · skill "+c.skill+"</div></div>"+
                "<button class='btn btn-xs btn-primary' data-btlhire='"+r+":"+c.id+"'>Sign "+fmtM(c.fee)+"</button></div>";
            });
          }
          h+="</div>";
        });
        h+="</div>";
      }
      h+="<div class='section-title'>🎬 Directors & 🌟 cast</div><div class='grid g3'>";
      for(const d of freeD.slice(0,6)) h+=talentCard(d);
      h+="</div><div class='grid g3' style='margin-top:8px'>";
      for(const a of freeA.slice(0,9)) h+=talentCard(a);
      const hidden=freeA.length+freeD.length-15;
      if(hidden>0)h+="<div class='card muted small' style='display:flex;align-items:center;justify-content:center'>+ "+hidden+" more on the market → refreshed weekly</div>";
      h+="</div>";
    }catch(e){}
    if((G.retired||[]).length){
      h+="<div class='section-title'>👋 Recently retired</div><div class='card'>";
      G.retired.slice(-6).reverse().forEach(function(r){
        h+="<div class='cost-line'><span>"+esc(r.name)+" <span class='tiny muted'>"+(r.kind||"")+"</span></span><b class='muted'>age "+r.age+" · "+dateLabel(r.week)+"</b></div>";
      });
      h+="</div>";
    }
  }catch(e){}
  return h;
}

function viewCombosCodex(){
  let h="<div class='section-title'>🧩 Combos Codex</div>"+
    "<div class='tiny muted' style='margin-bottom:8px'>Discover hidden genre × theme affinities by releasing films. ⭐ = Great match (+5 quality, +8% opening). ✖ = Clash (−4 quality).</div>";
  const known = G.comboKnown || {};
  const themes = DATA.THEMES || [];
  const genres = Object.keys(DATA.GENRES || {});
  let discovered = 0;
  for(const g of genres) for(const th of themes){ const k=g+"|"+th.id; if(known[k]) discovered++; }
  h+="<div class='card'><div class='spread'><b>Progress</b><span class='tag gold'>"+discovered+" / "+(genres.length*themes.length)+" combos discovered</span></div>"+
    "<div style='height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-top:4px'><div style='height:100%;width:"+(discovered/(genres.length*themes.length)*100)+"%;background:var(--gold);transition:width .5s'></div></div></div>";
  h+="<div class='grid g4' style='margin-top:8px'>";
  for(const g of genres){
    for(const th of themes){
      const k=g+"|"+th.id, mood=known[k];
      const cls = mood==="love"?"pos":mood==="clash"?"neg":"muted";
      const icon = mood==="love"?"⭐":mood==="clash"?"✖":"?";
      h+="<div class='card "+cls+"' style='text-align:center;padding:12px 6px'><div class='tiny'>"+DATA.GENRES[g].emoji+" "+DATA.GENRES[g].name+" × "+th.emoji+" "+th.name+"</div>"+
        "<div class='small "+cls+"' style='margin-top:4px;font-size:18px'>"+icon+"</div>"+
        (mood==="love"?"<div class='tiny pos'>+5 quality, +8% opening</div>":
         mood==="clash"?"<div class='tiny neg'>−4 quality</div>":
         "<div class='tiny muted'>Unknown — ship a film to discover</div>")+"</div>";
    }
  }
  h+="</div>";
  return h;
}

/* Talent profile: career stage + derived history. Stage from engine age/power/heat;`;

ui = ui.slice(0, insertPos) + newFunctions + ui.slice(insertPos);
fs.writeFileSync(uiPath, ui);
console.log("Added viewDevelopIP, viewDevelopTalent, viewCombosCodex");