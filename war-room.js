/* ═════════════════════════════════════════════════════════════════════════
   WAR-ROOM.JS — Opening Night War Room (v48)
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════
   When a release walks into a contested weekend, this desk lets the player
   fight the opening day itself: five time blocks (Thursday previews →
   Morning → Matinee → Evening → Night), one opening-day move per block.

   Design rules (mirror box-office-collection-engine.js):
   • Every effect flows through ONE existing seam. No second payer anywhere:
       ownBoost  → BoxOfficeCollection.openingMultiplier()  (the 1.32 clamp
                   there still governs the total stack);
       suppress  → tickRivals() opening calc, gated to the plan week only;
       legsBoost → legsOf() via a guarded term.
   • The valve (weekly levers) is untouched — war-room moves are opening-only.
   • State is save-compatible: every G.warroom field is optional and lazily
     created by ensure(). Old saves simply have no G.warroom key.
   • Weeks are atomic: opening happens inside releaseFilm(), so the desk is a
     pre-opening COMMITMENT, not a live sim. Counters resolve at release.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){

  const WarRoom = {
    version: "1.0.0",

    /* ── tuning ───────────────────────────────────────────────────────── */
    CONFIG: {
      maxOwn:  0.12,   /* cap on the summed own-opening boost (rides under the
                          collection engine's 1.32 openingMultiplier clamp) */
      maxSup:  0.30,   /* cap on rival-opening suppression */
      maxLegs: 0.08,   /* cap on legs extension */
      baseCounter: 0.30,       /* rival counter-chance before personality */
      counterRiskWeight: 0.30, /* personality riskTolerance scaling */
      counterMin: 0.12,
      counterMax: 0.55,
      refundOnLapse: 0.5,      /* lapsed (never-released) plan refund fraction */
      planGraceWeeks: 1        /* a lapsed plan refunds after week+grace */
    },

    BLOCKS: [
      { id:"previews", name:"Thu Previews",  note:"The first gross of the war — hype built tonight carries into Friday morning." },
      { id:"morning",  name:"Friday Morning", note:"Office crowds and school trips. Price and screens are set overnight." },
      { id:"matinee",  name:"Matinee",        note:"The families' slot — cheap seats, big groups." },
      { id:"evening",  name:"Friday Evening", note:"Peak date-night demand. The screens war is won here." },
      { id:"night",    name:"Late Night",     note:"The discourse block — what the weekend's word-of-mouth seeds from." }
    ],

    /* One opening-day move per block. `own` lifts your opening, `sup` bleeds
       the rival's, `legs` stretches your run. Costs scale off the project's
       marketing budget (leverCost-style), clamped per move. */
    MOVES: [
      { block:"previews", id:"midnight_preview", name:"Midnight Preview Blitz", desc:"Lock 2,000 screens for 8pm Thursday shows.", costFrac:0.020, minCost:4, maxCost:18, own:0.050, sup:0.000, legs:0.000 },
      { block:"previews", id:"social_countdown", name:"Social Countdown Drop", desc:"Creator countdown stream + ticket-drop link.", costFrac:0.008, minCost:1, maxCost:6,  own:0.030, sup:0.000, legs:0.020 },
      { block:"previews", id:"fan_midnights",    name:"Fan-Club Midnights",    desc:"Cosplay screenings for the core fanbase.", costFrac:0.010, minCost:2, maxCost:8,  own:0.020, sup:0.000, legs:0.040 },

      { block:"morning",  id:"screen_push",      name:"Morning Screen Push",   desc:"Morning slots swapped to our film at the big chains.", costFrac:0.018, minCost:3, maxCost:15, own:0.050, sup:0.030, legs:0.000 },
      { block:"morning",  id:"counter_leak",     name:"Counter-Intel Leak",    desc:"" , costFrac:0.012, minCost:2, maxCost:10, own:0.000, sup:0.060, legs:0.000, spicy:true },

      { block:"matinee",  id:"price_cut",        name:"Matinee Price Cut",     desc:"$5 all seats before 4pm — volume over margin.", costFrac:0.014, minCost:2, maxCost:12, own:0.040, sup:0.020, legs:0.000 },
      { block:"matinee",  id:"family_pack",      name:"Family Four-Pack",      desc:"Bundled tickets + poster with every kid's ticket.", costFrac:0.008, minCost:1, maxCost:6,  own:0.030, sup:0.000, legs:0.030 },

      { block:"evening",  id:"influencer_blast", name:"Evening Influencer Wave", desc:"Every creator we know posts as showtimes start.", costFrac:0.022, minCost:4, maxCost:20, own:0.060, sup:0.000, legs:0.000 },
      { block:"evening",  id:"screen_swap",      name:"Premium Screen Swap",   desc:"IMAX/PLF auditoriums flipped to our title for tonight.", costFrac:0.020, minCost:4, maxCost:18, own:0.040, sup:0.040, legs:0.000 },

      { block:"night",    id:"results_blast",    name:"Results Hype Blast",    desc:"'Number ONE of the night' push while rivals sleep.", costFrac:0.010, minCost:2, maxCost:9,  own:0.030, sup:0.020, legs:0.000 },
      { block:"night",    id:"fan_screening",    name:"Late Fan Screening",    desc:"Midnight Q&A tour stops — the discourse seeds warm.", costFrac:0.008, minCost:1, maxCost:6,  own:0.010, sup:0.000, legs:0.050 }
    ],

    movesFor(blockId){ return this.MOVES.filter(m => m.block === blockId); },

    /* ── state ────────────────────────────────────────────────────────── */
    ensure(g){
      if(!g) return null;
      g.warroom = g.warroom || {};
      g.warroom.plans   = g.warroom.plans   || {};  /* committed, not yet released */
      g.warroom.armed   = g.warroom.armed   || {};  /* resolved at release, read by the seams */
      g.warroom.recaps  = g.warroom.recaps  || {};  /* filmId → post-release attribution */
      return g.warroom;
    },

    _G(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    /* ── helper resolution (house idiom, see theater-chains.js) ───────── */
    _h(name){
      try {
        if(typeof global[name] === "function") return global[name];
        if(typeof window !== "undefined" && typeof window[name] === "function") return window[name];
      } catch(e){}
      return null;
    },
    _esc(s){ const f=this._h("esc"); return f? f(s) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
    _fmtM(x){ const f=this._h("fmtM"); return f? f(x) : "$"+Math.round(x*10)/10+"M"; },
    _toast(m,k){ const f=this._h("toast"); if(f) f(m,k); },
    _beep(k){ const f=this._h("beep"); if(f) f(k||"click"); },
    _log(m,t){ const f=this._h("log"); if(f) f(m,t||""); },
    _spend(cat,amt){ const f=this._h("spend"); if(f){ f(cat,amt); return true; } const g=this._G(); if(g&&g.studio){ g.studio.cash-=amt; return true; } return false; },
    _earn(cat,amt){ const f=this._h("earn"); if(f){ f(cat,amt); return true; } const g=this._G(); if(g&&g.studio){ g.studio.cash+=amt; return true; } return false; },
    _save(){ const f=this._h("saveGame"); if(f) f(); },
    _render(){ const f=this._h("render"); if(f) f(); },

    /* ── engine queries (defensive: engine may load after us) ─────────── */
    _competitors(p, weekAbs){
      const f = this._h("weekendCompetitors");
      if(!f || !p) return [];
      try { return f(p, weekAbs) || []; } catch(e){ return []; }
    },
    _recMkt(p){
      try { const f=this._h("recMarketing"); if(f) return f(p); } catch(e){}
      return p && p.marketing ? p.marketing : 12;
    },
    _cash(g){ return g && g.studio ? (g.studio.cash||0) : 0; },

    moveCost(m, p){
      const mkt = (p && p.marketing) || this._recMkt(p) || 12;
      const raw = Math.round(mkt * m.costFrac);
      return Math.max(m.minCost, Math.min(m.maxCost, raw));
    },

    /* ── clash detection (the engine-accurate one: weekendCompetitors) ── */
    clashProjects(g){
      g = this._G(g) || this._G();
      if(!g) return [];
      const out = [];
      const projs = g.projects || [];
      for(const p of projs){
        if(!p || !p.releaseWeek || p.released) continue;
        if(p.releaseWeek < (g.week||1)) continue;
        const comps = this._competitors(p, p.releaseWeek).filter(c => !c.mine);
        if(comps.length) out.push({ p, comps, week: p.releaseWeek });
      }
      return out.sort((a,b)=>a.week-b.week);
    },

    planFor(projectId){ const s=this.ensure(this._G()); return s ? s.plans[projectId] : null; },

    /* ── commit / refund ──────────────────────────────────────────────── */
    commitPlan(projectId, picks){
      const g = this._G();
      if(!g) return { ok:false, err:"no game" };
      const s = this.ensure(g);
      const p = (g.projects||[]).find(x=>x && x.id===projectId);
      if(!p) return { ok:false, err:"project not found" };
      if(!p.releaseWeek) return { ok:false, err:"no release date set" };
      if(p.releaseWeek < g.week) return { ok:false, err:"release week already passed" };
      const comps = this._competitors(p, p.releaseWeek).filter(c=>!c.mine);
      if(!comps.length) return { ok:false, err:"no clash on that weekend" };
      if(s.plans[projectId]) return { ok:false, err:"a plan is already committed" };

      const moves = [];
      for(const block of this.BLOCKS){
        const pickId = picks && picks[block.id];
        if(!pickId || pickId==="hold") continue;
        const m = this.MOVES.find(x=>x.id===pickId && x.block===block.id);
        if(m) moves.push({ id:m.id, name:m.name, block:block.id, cost:this.moveCost(m,p), own:m.own, sup:m.sup, legs:m.legs });
      }
      if(!moves.length) return { ok:false, err:"nothing selected" };

      const spent = moves.reduce((a,m)=>a+m.cost,0);
      if(this._cash(g) < spent) return { ok:false, err:"not enough cash", need:spent };

      this._spend("marketing", spent);
      const plan = {
        filmId: p.id, title: p.title, week: p.releaseWeek,
        targetRival: comps[0].rival || null,
        moves, spent, committedWeek: g.week
      };
      s.plans[projectId] = plan;
      /* Suppressing a rival is offensive — rivals remember wars. */
      try {
        const mem = g.rivalAI && plan.targetRival && g.rivalAI[plan.targetRival];
        if(mem && typeof addRivalMemory==="function") addRivalMemory(g.rivalAI[plan.targetRival], "war");
      } catch(e){}
      this._log("⚔ WAR ROOM: opening-day plan committed for \""+p.title+"\" — "+moves.length+" move(s), "+this._fmtM(spent)+". The rival won't see it coming.","gold");
      this._save();
      return { ok:true, plan, spent };
    },

    cancelPlan(projectId){
      const g=this._G(); if(!g) return { ok:false };
      const s=this.ensure(g);
      const plan=s.plans[projectId];
      if(!plan) return { ok:false, err:"no plan" };
      const refund=Math.round(plan.spent*0.75);
      this._earn("marketing", refund);
      delete s.plans[projectId];
      this._log("WAR ROOM: plan for \""+plan.title+"\" cancelled — "+this._fmtM(refund)+" of "+this._fmtM(plan.spent)+" recovered.","");
      this._save();
      return { ok:true, refund };
    },

    /* ── release-time resolution (called from releaseFilm) ────────────── */
    beforeRelease(g, p){
      if(!g || !p) return;
      const s=this.ensure(g);
      const plan=s.plans[p.id];
      if(!plan) return;
      delete s.plans[p.id];

      /* rival counter rolls — one per move, weighted by the rival's personality */
      const mem = g.rivalAI && plan.targetRival ? g.rivalAI[plan.targetRival] : null;
      const risk = mem && mem.traits && typeof mem.traits.riskTolerance==="number" ? mem.traits.riskTolerance : 0.5;
      const cc = Math.max(this.CONFIG.counterMin, Math.min(this.CONFIG.counterMax,
        this.CONFIG.baseCounter + risk*this.CONFIG.counterRiskWeight));
      const chanceFn = this._h("chance");
      const rndFn = this._h("rnd");
      const roll = (q)=> chanceFn ? chanceFn(q) : (rndFn ? (rndFn() < q) : Math.random()<q);

      const recapMoves=[]; let own=0, sup=0, legs=0, countered=0;
      for(const m of plan.moves){
        const counteredMove = roll(cc);
        if(counteredMove){ countered++; recapMoves.push({ name:m.name, block:m.block, kept:false }); continue; }
        own+=m.own; sup+=m.sup; legs+=m.legs;
        recapMoves.push({ name:m.name, block:m.block, kept:true });
      }
      own  = Math.min(own,  this.CONFIG.maxOwn);
      sup  = Math.min(sup,  this.CONFIG.maxSup);
      legs = Math.min(legs, this.CONFIG.maxLegs);

      const rec = {
        filmId:p.id, title:p.title, week:plan.week, targetRival:plan.targetRival,
        spent:plan.spent, own, sup, legs, countered, moves:recapMoves,
        releaseWeek: p.releaseWeek || g.week
      };
      s.armed[p.id]  = rec;
      s.recaps[p.id] = rec;

      if(countered>0){
        this._log("⚔ "+(plan.targetRival||"The rival")+" countered "+countered+" of "+plan.moves.length+" war-room moves for \""+p.title+"\" — part of the opening-day plan was neutralized.","bad");
      } else {
        this._log("⚔ War room plan ran clean for \""+p.title+"\" — "+(plan.targetRival||"the rival")+" never reacted in time.","good");
      }
      return rec;
    },

    /* ── engine seam reads (all pure, defensive, cheap) ───────────────── */
    openingBoostFor(p, g){
      const gg=this._G(g);
      if(!gg || !p) return 0;
      const rec = gg.warroom && gg.warroom.armed && gg.warroom.armed[p.id];
      return rec ? rec.own : 0;
    },
    legsBoostFor(film, g){
      const gg=this._G(g);
      if(!gg || !film || !film.id) return 0;
      const rec = gg.warroom && gg.warroom.armed && gg.warroom.armed[film.id];
      return rec ? rec.legs : 0;
    },
    weekSuppression(g, weekAbs){
      const gg=this._G(g);
      if(!gg || !gg.warroom) return 0;
      let sup=0;
      for(const id in gg.warroom.armed){
        const rec=gg.warroom.armed[id];
        if(rec && rec.week===weekAbs) sup+=rec.sup;
      }
      return sup;
    },

    /* ── weekly housekeeping (guarded hook in advanceWeek) ────────────── */
    tickWeekly(g){
      const gg=this._G(g);
      if(!gg || !gg.warroom) return;
      const s=gg.warroom;

      /* resync plans after date moves; lapse-refund plans whose week passed */
      for(const id in s.plans){
        const plan=s.plans[id];
        const p=(gg.projects||[]).find(x=>x && x.id===id);
        if(p && p.releaseWeek && p.releaseWeek>=gg.week){ plan.week=p.releaseWeek; continue; }
        if(gg.week > plan.week + this.CONFIG.planGraceWeeks){
          const refund=Math.round(plan.spent*this.CONFIG.refundOnLapse);
          this._earn("marketing", refund);
          delete s.plans[id];
          this._log("WAR ROOM: the plan for \""+plan.title+"\" lapsed unused — "+this._fmtM(refund)+" recovered.","");
        }
      }
      /* armed entries expire after the legs read (first weekly tick) */
      for(const id in s.armed){
        const rec=s.armed[id];
        if(rec && gg.week > rec.week + 1) delete s.armed[id];
      }
    },

    /* ══ UI ════════════════════════════════════════════════════════════ */

    /* Pulsing clash banner — rendered on Productions and Box Office. */
    bannerHTML(g){
      const gg=this._G(g);
      if(!gg) return "";
      const clashes=this.clashProjects(gg);
      if(!clashes.length) return "";
      const items=clashes.slice(0,3).map(c=>{
        const comp=c.comps[0];
        const hasPlan=!!(gg.warroom && gg.warroom.plans[c.p.id]);
        return "<button class='warroom-banner-item' data-war-open='"+this._esc(c.p.id)+"'>"+
          "<b>"+this._esc(c.p.title)+"</b><span>vs "+this._esc(comp.title||"rival title")+
          (comp.rival? " · "+this._esc(comp.rival):"")+" · W"+c.week+"</span>"+
          (hasPlan? "<em>PLAN SET</em>" : "<em class='wr-hot'>OPEN WAR ROOM</em>")+
        "</button>";
      }).join("");
      return "<div class='warroom-banner' id='warroomBanner'><span class='warroom-banner-label'>⚔ CLASH WEEK</span>"+items+"</div>";
    },

    bindBanner(root){
      const r=root||this._h("document")||{} ;
      if(!r || !r.querySelectorAll) return;
      const self=this;
      r.querySelectorAll("[data-war-open]").forEach(b=>{
        b.onclick=()=>{ self._beep("click"); self.openDesk(b.getAttribute("data-war-open")); };
      });
    },

    _pct(x){ const v=Math.round(x*100); return (v>=0?"+":"")+v+"%"; },

    _moveRow(m, p, pickedId){
      const cost=this.moveCost(m,p);
      const eff=[];
      if(m.own)  eff.push("<i class='wr-up'>"+this._pct(m.own)+" opening</i>");
      if(m.sup)  eff.push("<i class='wr-down'>"+this._pct(-m.sup)+" rival</i>");
      if(m.legs) eff.push("<i class='wr-up'>"+this._pct(m.legs)+" legs</i>");
      const sel = pickedId===m.id ? " wr-picked" : "";
      return "<button class='warroom-move"+sel+"' data-wr-block='"+m.block+"' data-wr-move='"+m.id+"'>"+
        "<b>"+this._esc(m.name)+(m.spicy? " <span class='tag red' style='font-size:9px'>RISKY</span>":"")+"</b>"+
        "<small>"+this._esc(m.desc||"")+"</small>"+
        "<span class='wr-eff'>"+eff.join(" ")+"</span>"+
        "<em>"+this._fmtM(cost)+"</em>"+
      "</button>";
    },

    openDesk(projectId){
      const g=this._G();
      if(!g){ return; }
      this.ensure(g);
      const openModalFn=this._h("openModal");
      if(!openModalFn){ this._toast("The war room could not open (UI module missing).","bad"); return; }

      const film=(g.films||[]).find(x=>x&&x.id===projectId);
      const proj=(g.projects||[]).find(x=>x&&x.id===projectId);
      const recap=(g.warroom.recaps||{})[projectId];

      /* Released film with a war recap → attribution screen */
      if(film && (recap || film.warRecap)){
        const r=recap || film.warRecap;
        let h="<div class='modal-head'><h3>⚔ War Room — After-Action Report</h3></div><div class='modal-body'>";
        h+="<p class='tiny muted'>"+this._esc(r.title)+" · opening week "+r.week+" · spent "+this._fmtM(r.spent)+"</p>";
        h+="<div class='wr-recap'>";
        const blockName=(id)=>{ const b=this.BLOCKS.find(x=>x.id===id); return b?b.name:id; };
        for(const m of r.moves){
          h+="<div class='wr-recap-row'>"+(m.kept? "✅":"❌")+" <span>"+blockName(m.block)+" — "+this._esc(m.name)+"</span><b class='"+(m.kept?"wr-up":"wr-down")+"'>"+(m.kept?"landed":"countered")+"</b></div>";
        }
        h+="<div class='wr-recap-total'>"+
          "<span>Opening boost kept</span><b class='wr-up'>"+this._pct(r.own)+"</b></div>"+
          "<div class='wr-recap-total'><span>Rival suppression</span><b class='wr-down'>"+this._pct(-r.sup)+"</b></div>"+
          "<div class='wr-recap-total'><span>Legs extension</span><b class='wr-up'>"+this._pct(r.legs)+"</b></div>"+
        "</div>";
        if(film.opening) h+="<p class='tiny muted'>The picture opened at "+this._fmtM(film.opening)+".</p>";
        h+="</div>";
        openModalFn(h);
        return;
      }

      if(!proj){
        this._toast("No matching production found.","bad");
        return;
      }

      const comps=this._competitors(proj, proj.releaseWeek).filter(c=>!c.mine);
      if(!proj.releaseWeek || !comps.length){
        let h="<div class='modal-head'><h3>⚔ War Room</h3></div><div class='modal-body'><p>No contested weekend on this picture's date. The war room only opens for clash weeks.</p></div>";
        openModalFn(h);
        return;
      }

      const existing=this.planFor(projectId);
      const compList=comps.map(c=>"<span class='wr-comp'>"+this._esc(c.title||"Rival title")+(c.rival? " · "+this._esc(c.rival):"")+" <i>"+(c.scale||"mid")+"</i></span>").join("");

      let h="<div class='modal-head'><h3>⚔ Opening Night War Room</h3></div><div class='modal-body'>";
      h+="<p class='tiny muted'>"+this._esc(proj.title)+" opens W"+proj.releaseWeek+" against "+comps.length+" rival picture"+(comps.length>1?"s":"")+": "+compList+"</p>";
      h+="<p class='tiny muted'>Pick one opening-day move per block. Commitment costs cash up front; the rival may counter some moves on release morning.</p>";

      if(existing){
        h+="<div class='wr-plan-note'>A plan is committed for this picture — "+existing.moves.length+" move(s), "+this._fmtM(existing.spent)+". It resolves on release morning.</div>";
        h+="<div class='wr-actions'><button class='btn btn-alt' id='wrCancel'>Cancel plan (75% refund)</button></div>";
        const closeFn=this._h("closeModal");
        const v=openModalFn(h);
        const cancel=v.querySelector("#wrCancel");
        if(cancel) cancel.onclick=()=>{ this.cancelPlan(projectId); this._beep("click"); if(closeFn) closeFn(); this._render(); };
        return;
      } else {
        const picks={};   /* block → move id */
        const cash=this._cash(g);
        const costOf=(picksMap)=>{ let t=0; for(const b in picksMap){ const m=this.MOVES.find(x=>x.id===picksMap[b]); if(m) t+=this.moveCost(m,proj); } return t; };
        const render=(err)=>{
          const spent=costOf(picks);
          let hh="<div class='warroom-blocks'>";
          for(const block of this.BLOCKS){
            hh+="<div class='warroom-block'><div class='warroom-block-head'><b>"+this._esc(block.name)+"</b><small>"+this._esc(block.note)+"</small></div><div class='warroom-moves'>";
            for(const m of this.movesFor(block.id)) hh+=this._moveRow(m, proj, picks[block.id]);
            hh+="<button class='warroom-move wr-hold"+(picks[block.id]==="hold"?" wr-picked":"")+"' data-wr-block='"+block.id+"' data-wr-move='hold'><b>Hold — save the money</b><small>No move in this block.</small><em>$0</em></button>";
            hh+="</div></div>";
          }
          hh+="</div>";
          hh+="<div class='wr-commit'><span>Plan cost <b>"+this._fmtM(spent)+"</b> · cash "+this._fmtM(cash)+"</span>"+
            (err? "<em class='wr-down'>"+err+"</em>":"")+
            "<button class='btn btn-primary' id='wrCommit'"+(spent===0?" disabled":"")+">Commit War Plan</button></div>";
          body.innerHTML=hh;
          /* rewire */
          body.querySelectorAll("[data-wr-move]").forEach(btn=>{
            btn.onclick=()=>{
              const blk=btn.getAttribute("data-wr-block"), mv=btn.getAttribute("data-wr-move");
              this._beep("click");
              if(picks[blk]===mv) delete picks[blk]; else picks[blk]=mv;
              render();
            };
          });
          const commit=body.querySelector("#wrCommit");
          if(commit) commit.onclick=()=>{
            const res=this.commitPlan(projectId, picks);
            if(!res.ok){ this._beep("bad"); render(res.err||"cannot commit"); return; }
            this._beep("gold"); this._toast("War plan committed — "+this._fmtM(res.spent)+". It resolves on release morning.","gold");
            closeFn(); this._render();
          };
        };
        const closeFn=this._h("closeModal");
        const v=openModalFn("<div class='modal-head'><h3>⚔ Opening Night War Room</h3></div><div class='modal-body' id='wrBody'></div>");
        const body=v.querySelector("#wrBody");
        render();
        const cancel=v.querySelector("#wrCancel");
        if(cancel) cancel.onclick=()=>{ this.cancelPlan(projectId); this._beep("click"); closeFn(); this._render(); };
      }
    }
  };

  /* expose */
  global.WarRoom = WarRoom;
  if(typeof global.openWarRoomDesk !== "function"){
    global.openWarRoomDesk = function(projectId){ WarRoom.openDesk(projectId); };
  }

})(typeof window !== "undefined" ? window : globalThis);
