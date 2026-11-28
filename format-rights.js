/* ═════════════════════════════════════════════════════════════════════════
   FORMAT-RIGHTS.JS — Format & Remake Rights (v49)
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════
   After a film closes its theatrical run, the player can package it as a
   "format" — script bible + brand — and sell it to foreign studios who remake
   it in their own markets. Upfront fee on sale; backend royalties when a
   remake beats the original's opening.

   Design rules:
   • Every dollar flows through earn()/spend() — G.weekTx stays exact.
   • State is save-compatible: every G.formatRights field is optional, lazily
     created by ensure(). Old saves simply have no G.formatRights key.
   • No second payer: the weekly tick rolls remake chances once per sold
     format; nothing else touches G.formatRights.sold.
   • Roll is deterministic off G.week + film id (mulberry32).
   • Fatigue ties into the existing franchise system (engine.js:1476-1495).
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){

  const FormatRights = {
    version: "1.0.0",

    /* ── tuning ───────────────────────────────────────────────────────── */
    BASE_FACTOR: 0.03,     /* base share of worldwide gross paid upfront */
    TIER_FACTOR: 0.01,     /* +1% per franchise tier */
    MAX_FACTOR: 0.08,      /* absolute cap on the upfront factor */
    FATIGUE_CAP: 0.60,     /* fatigue can reduce fee by at most 60% */
    REMAKE_CHANCE: 0.05,   /* 5% per week per sold format that a remake is made */
    ROYALTY_SHARE: 0.25,   /* royalty = 25% of the upfront fee */
    MIN_AUDIENCE: 65,      /* film must score ≥65 audience to be formatable */
    MIN_WW: 20,            /* and gross ≥ $20M WW to be worth packaging */

    TERRITORIES: [
      "Northern Europe", "Latin America", "Southeast Asia", "India",
      "Middle East", "South Korea", "Australia", "France", "Italy", "Spain"
    ],

    /* ── state ────────────────────────────────────────────────────────── */
    ensure(g){
      if(!g) return null;
      g.formatRights = g.formatRights || {};
      const fr = g.formatRights;
      fr.sold = fr.sold || {};  // filmId -> {filmId, title, genre, ww, fee, soldWeek, remakeMarkets: []}
      return fr;
    },

    _G(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    _h(name){
      try {
        if(typeof global[name] === "function") return global[name];
        if(typeof window !== "undefined" && typeof window[name] === "function") return window[name];
      } catch(e){}
      return null;
    },
    _esc(s){ const f=this._h("esc"); return f? f(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
    _fmtM(x){ const f=this._h("fmtM"); return f? f(x) : "$"+Math.round((x||0)*10)/10+"M"; },
    _fmtG(x){ const f=this._h("fmtG"); return f? f(x) : Math.round((x||0)*10)/10; },
    _toast(m,k){ const f=this._h("toast"); if(f) f(m,k); },
    _beep(k){ const f=this._h("beep"); if(f) f(k||"click"); },
    _log(m,t){ const f=this._h("log"); if(f) f(m,t||""); },
    _notify(text, type){
      const f=this._h("addNotification");
      if(f) f(text, type||"info");
      else this._log(text, type);
    },
    _spend(cat,amt){
      const f=this._h("spend");
      if(f){ f(cat,amt); return true; }
      const g=this._G();
      if(g && g.studio){ g.studio.cash-=amt; return true; }
      return false;
    },
    _earn(cat,amt){
      const f=this._h("earn");
      if(f){ f(cat,amt); return true; }
      const g=this._G();
      if(g && g.studio){ g.studio.cash+=amt; return true; }
      return false;
    },
    _save(){ const f=this._h("saveGame"); if(f) f(); },
    _render(){ const f=this._h("render"); if(f) f(); },
    _chance(q){
      const f=this._h("chance");
      if(f) return f(q);
      const r=this._h("rnd");
      return r ? r()<q : Math.random()<q;
    },
    _roll(filmId, week, modulus){
      let s = (week * 1000003) >>> 0;
      for(let i = 0; i < filmId.length; i++) s = (s * 31 + filmId.charCodeAt(i)) >>> 0;
      s = (s * 1103515245 + 12345) >>> 0;
      return (s % modulus + modulus) % modulus;
    },
    _audience(f){
      const fAud = this._h("audienceScoreOf");
      if(fAud) return fAud(f);
      return f && f.quality && f.quality.aud != null ? f.quality.aud : 0;
    },
    _franchiseOf(f){
      const g = this._G();
      if(!g || !f || !f.franchiseName) return null;
      return (g.franchises||[]).find(x => x.name === f.franchiseName) || null;
    },

    /* ── eligibility ──────────────────────────────────────────────────── */
    eligibleFilms(g){
      const gg = this._G(g);
      if(!gg) return [];
      const out = [];
      const formatted = new Set();
      const frState = this.ensure(gg);
      for(const id in frState.sold) formatted.add(id);
      for(const f of (gg.films||[])){
        if(f.inTheaters) continue;                        /* must be closed */
        if(formatted.has(f.id)) continue;                 /* already packaged */
        if((f.ww||0) < this.MIN_WW) continue;             /* must be a real hit */
        if(this._audience(f) < this.MIN_AUDIENCE) continue; /* and well-received */
        out.push(f);
      }
      out.sort((a,b) => (b.ww||0) - (a.ww||0));
      return out;
    },

    /* fee = ww × (0.03 + tier×0.01, capped 0.08) × (1 − min(fatigue, 0.6)) */
    feeFor(f){
      const fr = this._franchiseOf(f);
      const tier = fr ? (fr.tier||0) : 0;
      let factor = this.BASE_FACTOR + tier * this.TIER_FACTOR;
      factor = Math.min(factor, this.MAX_FACTOR);
      const fatigue = fr ? Math.min((fr.fatigue||0), this.FATIGUE_CAP) : 0;
      return Math.round((f.ww||0) * factor * (1 - fatigue) * 10) / 10;
    },

    /* ── sale ─────────────────────────────────────────────────────────── */
    sellFormat(filmId, optG){
      const g = this._G(optG);
      if(!g) return { ok:false, err:"no game" };
      const frState = this.ensure(g);
      const f = (g.films||[]).find(x => x && String(x.id) === String(filmId));
      if(!f) return { ok:false, err:"film not found" };
      if(f.inTheaters) return { ok:false, err:"film is still in release" };
      if(frState.sold[filmId]) return { ok:false, err:"format already sold" };
      if((f.ww||0) < this.MIN_WW) return { ok:false, err:"film is not a big enough hit" };
      if(this._audience(f) < this.MIN_AUDIENCE) return { ok:false, err:"audience score too low" };

      const fee = this.feeFor(f);
      const territory = this.TERRITORIES[this._roll(filmId + "t", g.week, this.TERRITORIES.length)];

      this._earn("licensing", fee);

      const entry = {
        filmId: f.id,
        title: f.title,
        genre: f.genre,
        ww: f.ww||0,
        opening: f.opening||0,
        fee,
        soldWeek: g.week,
        remakeMarkets: [territory]
      };
      frState.sold[filmId] = entry;
      this._save();

      this._log("📼 Format sold: \""+f.title+"\" — "+fmtM(fee)+" upfront, remakes in "+territory+".","gold");
      this._notify("📼 Format sold: \""+f.title+"\" — "+fmtM(fee)+" upfront, remakes in "+territory+".","gold");
      this._toast("Format sold: \""+f.title+"\" — "+fmtM(fee)+" upfront.","gold");
      return { ok:true, fee, territory };
    },

    /* ── weekly backend: remake rolls + royalties ─────────────────────── */
    tickWeekly(g){
      const gg = this._G(g);
      if(!gg) return;
      const frState = this.ensure(gg);
      const week = gg.week||1;

      for(const id in frState.sold){
        const entry = frState.sold[id];
        const f = (gg.films||[]).find(x => x && String(x.id) === id);
        if(!f) continue;

        /* each week, a remake may be produced in a new territory market */
        if(this._chance(this.REMAKE_CHANCE)){
          const territory = this.TERRITORIES[this._roll(id + "r" + week, week, this.TERRITORIES.length)];
          if(entry.remakeMarkets.includes(territory)) continue; /* same market twice */
          entry.remakeMarkets.push(territory);

          /* remake opening = original opening × random band */
          const remakeOpening = f.opening * (0.70 + this._roll(id + "o" + week, week, 60) / 100);
          const beat = remakeOpening > (f.opening||1);
          if(beat){
            const royalty = Math.round(entry.fee * this.ROYALTY_SHARE * 10) / 10;
            this._earn("licensing", royalty);
            this._log("🎬 A remake of \""+f.title+"\" opened big in "+territory+" — royalty "+fmtM(royalty)+".","gold");
            this._notify("🎬 A remake of \""+f.title+"\" opened big in "+territory+" — royalty "+fmtM(royalty)+".","gold");
            this._toast("Remake royalty: "+fmtM(royalty)+" from "+territory+".","gold");
          }
        }
      }
    },

    /* ── UI ───────────────────────────────────────────────────────────── */
    renderDesk(g){
      const gg = this._G(g);
      if(!gg) return "<div class='card'>Format rights data unavailable.</div>";
      this.ensure(gg);
      const eligible = this.eligibleFilms(gg);
      const sold = gg.formatRights.sold || {};

      let h="<div class='format-rights-desk'>";

      /* eligible library */
      h+="<div class='fr-section'><div class='fr-head'><b>LIBRARY — PACKAGE AS FORMAT</b><small>closed runs · audience ≥65 · WW ≥ $20M</small></div>";
      h+="<div class='fr-list'>";
      if(eligible.length){
        for(const f of eligible){
          const fee = this.feeFor(f);
          const fr = this._franchiseOf(f);
          const tierTxt = fr ? " · tier "+fr.tier : "";
          h+="<div class='fr-card' data-fr-film='"+f.id+"'>";
          h+="<div class='fr-card-head'><b>"+this._esc(f.title)+"</b><span class='fr-fee'>"+this._fmtM(fee)+" upfront</span></div>";
          h+="<div class='fr-card-body'>";
          h+="<div class='fr-meta'>WW "+this._fmtG(f.ww)+" · aud "+Math.round(this._audience(f))+tierTxt+" · genre "+this._esc((DATA.GENRES&&DATA.GENRES[f.genre])?DATA.GENRES[f.genre].name:f.genre)+"</div>";
          h+="<div class='fr-actions'><button class='fr-sell-btn' data-fr-sell='"+f.id+"'>Package as format</button></div>";
          h+="</div></div>";
        }
      } else {
        h+="<div class='fr-empty'><p>No closed hits qualify yet. A film needs a $20M+ worldwide gross and audience ≥65 after its theatrical run ends.</p></div>";
      }
      h+="</div></div>";

      /* sold formats */
      const soldIds = Object.keys(sold);
      if(soldIds.length){
        h+="<div class='fr-section'><div class='fr-head'><b>SOLD FORMATS</b><small>upfront paid · royalties when remakes hit</small></div>";
        h+="<div class='fr-sold'>";
        for(const id of soldIds){
          const e = sold[id];
          const markets = (e.remakeMarkets||[]).join(", ");
          h+="<div class='fr-sold-row'>"+this._esc(e.title)+" · "+this._fmtM(e.fee)+" paid · "+esc(markets||"—")+"</div>";
        }
        h+="</div></div>";
      }
      h+="</div>";
      return h;
    },

    bindDesk(root){
      const r = root || (typeof document !== "undefined" ? document : null);
      if(!r || !r.querySelectorAll) return;
      const self = this;
      r.querySelectorAll("[data-fr-sell]").forEach(b=>{
        b.onclick=()=>{
          const id = b.getAttribute("data-fr-sell");
          self._beep("click");
          const res = self.sellFormat(id);
          if(!res.ok){ self._beep("bad"); self._toast(res.err,"bad"); return; }
          self._toast("Format packaged: "+fmtM(res.fee)+" upfront.","gold");
          self._render();
        };
      });
    }
  };

  /* expose */
  global.FormatRights = FormatRights;
  if(typeof global.openFormatRightsDesk !== "function"){
    global.openFormatRightsDesk = function(){ /* rendered in-place */ };
  }

})(typeof window !== "undefined" ? window : globalThis);
