/* ═════════════════════════════════════════════════════════════════════════
   PHYSICAL-MEDIA.JS — Physical Media & Collector's Editions (v49)
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════
   After a film closes theaters and pays PVOD, it can get a physical release:
   standard DVD/Blu-ray (4-6 week sell-through tail) or a limited Collector's
   Edition (steelbook, director's cut, cult premium). Manufacturing is paid
   up front; sell-through pays weekly until the edition sells out or fades.

   Design rules:
   • Every dollar flows through earn()/spend() — G.weekTx stays exact.
   • State is save-compatible: every G.physicalMedia field is optional, lazily
     created by ensure(). Old saves simply have no G.physicalMedia key.
   • No second payer: the weekly tick decrements sell-through once per active
     edition; nothing else touches G.physicalMedia.releases.
   • Rolls deterministic off G.week + film id (mulberry32).
   • endTheatrical() flags f.physicalEligible = true — no behavior change if
     this module is unused.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){

  const PhysicalMedia = {
    version: "1.0.0",

    /* ── tuning ───────────────────────────────────────────────────────── */
    EDITIONS: {
      standard: { id:"standard", name:"DVD & Blu-ray", cost:4, units:60, weeks:5, decay:0.70, cultBonus:0 },
      collector: { id:"collector", name:"Collector's Edition", cost:12, units:25, weeks:4, decay:0.55, cultBonus:0.15 }
    },
    MIN_QUALITY: 66,        /* collector's edition needs cult appeal */
    MIN_WW: 30,             /* film must gross ≥ $30M WW to justify a press run */
    SELL_THRESHOLD: 0.05    /* under 5% of units remaining = sold out */

    /* ── state ────────────────────────────────────────────────────────── */
  };
  PhysicalMedia.ensure = function(g){
    if(!g) return null;
    g.physicalMedia = g.physicalMedia || {};
    const pm = g.physicalMedia;
    pm.releases = pm.releases || []; /* {filmId, title, edition, units, unitsLeft, weeksLeft, cost, rev, soldOut} */
    return pm;
  };

  PhysicalMedia._G = function(state){
    if(state) return state;
    if(typeof G !== "undefined") return G;
    if(typeof global !== "undefined" && global.G) return global.G;
    if(typeof window !== "undefined" && window.G) return window.G;
    return null;
  };

  PhysicalMedia._h = function(name){
    try {
      if(typeof global[name] === "function") return global[name];
      if(typeof window !== "undefined" && typeof window[name] === "function") return window[name];
    } catch(e){}
    return null;
  };

  PhysicalMedia._esc = function(s){
    const f = this._h("esc");
    return f ? f(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  };

  PhysicalMedia._fmtM = function(x){
    const f = this._h("fmtM");
    return f ? f(x) : "$"+Math.round((x||0)*10)/10+"M";
  };

  PhysicalMedia._fmtG = function(x){
    const f = this._h("fmtG");
    return f ? f(x) : Math.round((x||0)*10)/10;
  };

  PhysicalMedia._toast = function(m,k){
    const f = this._h("toast");
    if(f) f(m,k);
  };

  PhysicalMedia._beep = function(k){
    const f = this._h("beep");
    if(f) f(k||"click");
  };

  PhysicalMedia._log = function(m,t){
    const f = this._h("log");
    if(f) f(m,t||"");
  };

  PhysicalMedia._notify = function(text, type){
    const f = this._h("addNotification");
    if(f) f(text, type||"info");
    else this._log(text, type);
  };

  PhysicalMedia._spend = function(cat,amt){
    const f = this._h("spend");
    if(f){ f(cat,amt); return true; }
    const g = this._G();
    if(g && g.studio){ g.studio.cash-=amt; return true; }
    return false;
  };

  PhysicalMedia._earn = function(cat,amt){
    const f = this._h("earn");
    if(f){ f(cat,amt); return true; }
    const g = this._G();
    if(g && g.studio){ g.studio.cash+=amt; return true; }
    return false;
  };

  PhysicalMedia._save = function(){
    const f = this._h("saveGame");
    if(f) f();
  };

  PhysicalMedia._render = function(){
    const f = this._h("render");
    if(f) f();
  };

  PhysicalMedia._chance = function(q){
    const f = this._h("chance");
    if(f) return f(q);
    const r = this._h("rnd");
    return r ? r()<q : Math.random()<q;
  };

  PhysicalMedia._roll = function(filmId, week, modulus){
    let s = (week * 1000003) >>> 0;
    for(let i = 0; i < filmId.length; i++) s = (s * 31 + filmId.charCodeAt(i)) >>> 0;
    s = (s * 1103515245 + 12345) >>> 0;
    return (s % modulus + modulus) % modulus;
  };

  PhysicalMedia._audience = function(f){
    const fAud = this._h("audienceScoreOf");
    if(fAud) return fAud(f);
    return f && f.quality && f.quality.aud != null ? f.quality.aud : 0;
  };

  /* ── eligibility ────────────────────────────────────────────────────── */
  PhysicalMedia.eligibleFilms = function(g){
    const gg = this._G(g);
    if(!gg) return [];
    const out = [];
    const released = new Set();
    const pm = this.ensure(gg);
    for(const r of pm.releases) released.add(r.filmId);
    for(const f of (gg.films||[])){
      if(f.inTheaters) continue;                        /* theatrical must be over */
      if(!f.physicalEligible) continue;                 /* endTheatrical flag not set */
      if(released.has(f.id)) continue;                  /* already got a press run */
      if((f.ww||0) < this.MIN_WW) continue;
      out.push(f);
    }
    out.sort((a,b) => (b.ww||0) - (a.ww||0));
    return out;
  };

  /* ── sale ───────────────────────────────────────────────────────────── */
  PhysicalMedia.planRelease = function(filmId, editionId, optG){
    const g = this._G(optG);
    if(!g) return { ok:false, err:"no game" };
    const pm = this.ensure(g);
    const ED = this.EDITIONS[editionId];
    if(!ED) return { ok:false, err:"unknown edition" };
    const f = (g.films||[]).find(x => x && String(x.id) === String(filmId));
    if(!f) return { ok:false, err:"film not found" };
    if(f.inTheaters) return { ok:false, err:"film is still in release" };
    if(!f.physicalEligible) return { ok:false, err:"not cleared for physical" };
    if(pm.releases.some(r => r.filmId === f.id)) return { ok:false, err:"edition already planned" };
    if((f.ww||0) < this.MIN_WW) return { ok:false, err:"film is not a big enough hit" };
    if(editionId === "collector" && this._audience(f) < this.MIN_QUALITY) return { ok:false, err:"needs cult appeal (audience ≥66)" };

    const cost = ED.cost;
    if(g.studio.cash < cost) return { ok:false, err:"not enough cash to press", need:cost };

    this._spend("physical", cost);

    /* units move off shelves each week; revenue per unit off WW-relative price */
    const unitPrice = editionId === "collector" ? 18 : 10;
    const revPerUnit = Math.round((f.ww||0) * 0.0008 * 10) / 10; /* per-unit take, $M */

    const release = {
      filmId: f.id,
      title: f.title,
      edition: editionId,
      name: ED.name,
      units: ED.units,
      unitsLeft: ED.units,
      weeksLeft: ED.weeks,
      cost,
      rev: 0,
      soldOut: false,
      revPerUnit,
      plannedWeek: g.week
    };
    pm.releases.push(release);
    this._save();

    this._log("💿 Physical release: \""+f.title+"\" — "+ED.name+", "+ED.units+" units pressed.","gold");
    this._notify("💿 Physical release: \""+f.title+"\" — "+ED.name+".","gold");
    this._toast("Physical release planned: "+ED.name+".","gold");
    return { ok:true, units: ED.units, cost, edition: ED.name };
  };

  /* ── weekly resolution ──────────────────────────────────────────────── */
  PhysicalMedia.tickWeekly = function(g){
    const gg = this._G(g);
    if(!gg) return;
    const pm = this.ensure(gg);
    const week = gg.week||1;

    for(const r of pm.releases){
      if(r.soldOut) continue;
      if(r.weeksLeft <= 0){
        r.soldOut = true;
        const left = r.unitsLeft;
        this._log("📦 "+ED_NAME(r.edition)+" sold out: \""+r.title+"\" — "+left+" units never pressed.","");
        continue;
      }
      /* sell-through: fraction of remaining stock leaves shelves this week */
      const decay = this.EDITIONS[r.edition].decay;
      const sold = Math.max(1, Math.round(r.unitsLeft * (1 - decay)));
      r.unitsLeft -= sold;
      r.weeksLeft--;
      if(r.weeksLeft <= 0){
        r.soldOut = true;
        const left = r.unitsLeft;
        this._log("📦 "+ED_NAME(r.edition)+" sold out: \""+r.title+"\" — "+left+" units never pressed.","");
        continue;
      }
      const rev = Math.round(sold * r.revPerUnit * 10) / 10;
      r.rev = Math.round((r.rev + rev) * 10) / 10;
      this._earn("physical", rev);
      this._log("💿 "+r.name+": \""+r.title+"\" — "+sold+" units, "+fmtM(rev)+".","gold");
    }
    pm.releases = pm.releases.filter(r => !r.soldOut || r.weeksLeft > -1).slice(-20);
  };

  function ED_NAME(editionId){
    const ED = PhysicalMedia.EDITIONS[editionId];
    return ED ? ED.name : editionId;
  }

  /* ── UI ─────────────────────────────────────────────────────────────── */
  PhysicalMedia.renderDesk = function(g){
    const gg = this._G(g);
    if(!gg) return "<div class='card'>Physical media data unavailable.</div>";
    this.ensure(gg);
    const eligible = this.eligibleFilms(gg);
    const pm = gg.physicalMedia;
    const active = (pm.releases||[]).filter(r => !r.soldOut && r.weeksLeft > 0);

    let h="<div class='physical-media-desk'>";

    /* eligible */
    h+="<div class='pm-section'><div class='pm-head'><b>AFTER THEATER — PHYSICAL PRESS RUN</b><small>closed runs · WW ≥ $30M · press run up front</small></div>";
    h+="<div class='pm-list'>";
    if(eligible.length){
      for(const f of eligible){
        h+="<div class='pm-card' data-pm-film='"+f.id+"'>";
        h+="<div class='pm-card-head'><b>"+this._esc(f.title)+"</b><span class='pm-ww'>WW "+this._fmtG(f.ww||0)+"</span></div>";
        h+="<div class='pm-card-body'>";
        h+="<div class='pm-meta'>aud "+Math.round(this._audience(f))+" · "+this._esc((DATA.GENRES&&DATA.GENRES[f.genre])?DATA.GENRES[f.genre].name:f.genre)+"</div>";
        h+="<div class='pm-editions'>";
        for(const key of ["standard","collector"]){
          const ED = this.EDITIONS[key];
          let disabled = "";
          if(key==="collector" && this._audience(f) < this.MIN_QUALITY) disabled=" pm-edition-disabled";
          h+="<button class='pm-edition-btn"+disabled+"' data-pm-edition='"+key+"'>"+ED.name+" · "+fmtM(ED.cost)+" press</button>";
        }
        h+="</div>";
        h+="<div class='pm-actions'><button class='pm-plan-btn' data-pm-plan='"+f.id+"'>Plan Release</button></div>";
        h+="</div></div>";
      }
    } else {
      h+="<div class='pm-empty'><p>No closed hits qualify yet. A film needs a $30M+ worldwide gross after its theatrical run ends.</p></div>";
    }
    h+="</div></div>";

    /* active releases */
    if(active.length){
      h+="<div class='pm-section'><div class='pm-head'><b>ON SHELVES NOW</b><small>sell-through tail · resolves each weekly tick</small></div>";
      h+="<div class='pm-active'>";
      for(const r of active){
        const pct = Math.round((r.unitsLeft / r.units) * 100);
        h+="<div class='pm-active-row'>"+this._esc(r.title)+" · "+r.name+": "+r.unitsLeft+"/"+r.units+" units ("+pct+"%) · "+fmtM(r.rev)+" earned</div>";
      }
      h+="</div></div>";
    }

    /* history */
    const done = (pm.releases||[]).filter(r => r.soldOut).slice(-4);
    if(done.length){
      h+="<div class='pm-section'><div class='pm-head'><b>SOLD OUT</b><small>last 4 press runs</small></div>";
      h+="<div class='pm-done'>";
      for(const r of done){
        h+="<div class='pm-done-row'>"+this._esc(r.title)+" · "+r.name+" · "+fmtM(r.rev)+" total</div>";
      }
      h+="</div></div>";
    }
    h+="</div>";
    return h;
  };

  PhysicalMedia.bindDesk = function(root){
    const r = root || (typeof document !== "undefined" ? document : null);
    if(!r || !r.querySelectorAll) return;
    const self = this;
    r.querySelectorAll("[data-pm-film]").forEach(card => {
      const editionBtns = card.querySelectorAll("[data-pm-edition]");
      let selEdition = null;
      editionBtns.forEach(b => b.onclick = () => {
        self._beep("click");
        editionBtns.forEach(x => x.classList.remove("pm-selected"));
        b.classList.add("pm-selected"); selEdition = b.getAttribute("data-pm-edition");
      });
      const plan = card.querySelector("[data-pm-plan]");
      if(plan) plan.onclick = () => {
        if(!selEdition){ self._beep("bad"); self._toast("Pick an edition.","bad"); return; }
        self._beep("click");
        const res = self.planRelease(card.getAttribute("data-pm-film"), selEdition);
        if(!res.ok){ self._beep("bad"); self._toast(res.err,"bad"); return; }
        self._toast("Press run planned: "+res.units+" units.","gold");
        self._render();
      };
    });
  };

  /* expose */
  global.PhysicalMedia = PhysicalMedia;
  if(typeof global.openPhysicalMediaDesk !== "function"){
    global.openPhysicalMediaDesk = function(){ /* rendered in-place */ };
  }

})(typeof window !== "undefined" ? window : globalThis);
