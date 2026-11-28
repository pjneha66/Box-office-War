/* ═════════════════════════════════════════════════════════════════════════
   EVENT-CINEMA.JS — One-night theater events (v49)
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════
   Books concerts, opera, live sports screenings and comedy specials into your
   theater chains for a single weekend. License fee up front; ticket price and
   PLF surcharge set by you; attendance rolls off chain screens, chain genre
   taste, price sensitivity and a weather factor. Profit pays out via
   earn("events", …).

   Design rules:
   • Every dollar flows through earn()/spend() — G.weekTx stays exact.
   • State is save-compatible: every G.eventCinema field is optional, lazily
     created by ensure(). Old saves simply have no G.eventCinema key.
   • No second payer: the weekly tick resolves booked events once and clears
     them; nothing else touches G.eventCinema.booked.
   • Roll is deterministic off G.week + event id (mulberry32), so the same
     booking resolves identically on every machine.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){

  const EventCinema = {
    version: "1.0.0",

    /* ── tuning ───────────────────────────────────────────────────────── */
    EVENTS: {
      concert:   { id:"concert",   name:"Arena Concert",        cost:8,  cap:0.60, draw:120000, taste:"musical",   tiers:[{id:"standard", price:14, mult:1.00},{id:"plf", price:22, mult:0.70}] },
      opera:     { id:"opera",     name:"Metropolitan Opera",   cost:5,  cap:0.40, draw: 60000, taste:"musical",   tiers:[{id:"standard", price:18, mult:1.00},{id:"plf", price:28, mult:0.65}] },
      sports:    { id:"sports",    name:"Live Sports Screening",cost:12, cap:0.70, draw:200000, taste:"sports",    tiers:[{id:"standard", price:16, mult:1.00},{id:"plf", price:26, mult:0.65}] },
      comedy:    { id:"comedy",    name:"Comedy Special",       cost:4,  cap:0.50, draw: 90000, taste:"comedy",    tiers:[{id:"standard", price:12, mult:1.00},{id:"plf", price:20, mult:0.75}] },
      premiere:  { id:"premiere",  name:"Premiere Q&A Screening",cost:3, cap:0.30, draw: 70000, taste:"drama",     tiers:[{id:"standard", price:20, mult:1.00},{id:"plf", price:32, mult:0.55}] }
    },

    /* 3 events rotate into the catalog each week, seeded off G.week. */
    catalog(G){
      const keys = Object.keys(this.EVENTS);
      const pool = keys.slice();
      const out = [];
      let s = ((G.week||1) * 1000003) >>> 0;
      for(let i = 0; i < 3 && pool.length; i++){
        s = (s * 1103515245 + 12345) >>> 0;
        const pick = pool.splice(s % pool.length, 1)[0];
        const e = this.EVENTS[pick];
        out.push({ id:e.id, name:e.name, cost:e.cost, cap:e.cap, draw:e.draw, taste:e.taste, tiers:e.tiers, week:G.week });
      }
      return out;
    },

    chainOf(id){
      const g = this._G();
      if(!g) return null;
      const def = (typeof DATA !== "undefined" && DATA.CHAINS) ? DATA.CHAINS.find(c => c.id === id) : null;
      const live = g.chains && Array.isArray(g.chains) ? g.chains.find(c => c.id === id) : null;
      if(!def) return null;
      return { id: def.id, name: def.name, screens: def.screens || 0, taste: def.taste || {}, rel: live ? live.rel : 50 };
    },

    chains(){
      const g = this._G();
      if(!g || !g.chains) return [];
      return g.chains.map(c => this.chainOf(c.id)).filter(Boolean);
    },

    /* ── state ────────────────────────────────────────────────────────── */
    ensure(g){
      if(!g) return null;
      g.eventCinema = g.eventCinema || {};
      const ec = g.eventCinema;
      ec.booked = ec.booked || [];   /* {eventId, chainId, tierId, price, week, cost, revenue, profit, attendance, resolved} */
      ec.history = ec.history || []; /* resolved events */
      return ec;
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
    _notify(text, type){
      const f=this._h("addNotification");
      if(f) f(text, type||"info");
      else this._log(text, type);
    },
    _chainRelDelta(chainId, delta){
      const g=this._G();
      if(!g || !g.chains) return;
      const c = g.chains.find(x => x.id === chainId);
      if(c) c.rel = Math.max(0, Math.min(100, (c.rel||50) + delta));
    },
    _rep(delta){
      const g=this._G();
      if(g && g.studio){
        const cl=this._h("clamp");
        g.studio.rep = cl ? cl(g.studio.rep+delta,5,99) : Math.max(5, Math.min(99, g.studio.rep+delta));
      }
    },
    _chance(q){
      const f=this._h("chance");
      if(f) return f(q);
      const r=this._h("rnd");
      return r ? r()<q : Math.random()<q;
    },

    /* deterministic roll for an event+week — same machine, same result */
    _roll(eventId, week, modulus){
      let s = (week * 1000003) >>> 0;
      for(let i = 0; i < eventId.length; i++) s = (s * 31 + eventId.charCodeAt(i)) >>> 0;
      s = (s * 1103515245 + 12345) >>> 0;
      return (s % modulus + modulus) % modulus;
    },

    /* ── booking ──────────────────────────────────────────────────────── */
    canBook(eventId, chainId, tierId, optG){
      const g = this._G(optG);
      if(!g) return { ok:false, err:"no game" };
      const ec = this.ensure(g);
      const ev = this.EVENTS[eventId];
      const tier = ev && ev.tiers.find(t => t.id === tierId);
      if(!ev || !tier) return { ok:false, err:"unknown event or price tier" };
      if(ec.booked.some(b => b.week === (g.week||1) && !b.resolved)) return { ok:false, err:"an event is already booked this weekend" };
      const chain = this.chainOf(chainId);
      if(!chain) return { ok:false, err:"unknown chain" };
      if(g.studio.cash < ev.cost) return { ok:false, err:"not enough cash for the license fee", need:ev.cost };
      return { ok:true, cost:ev.cost, draw:ev.draw, cap:chain.screens };
    },

    book(eventId, chainId, tierId, optG){
      const g = this._G(optG);
      if(!g) return { ok:false, err:"no game" };
      const chk = this.canBook(eventId, chainId, tierId, g);
      if(!chk.ok) return chk;
      const ev = this.EVENTS[eventId];
      const tier = ev.tiers.find(t => t.id === tierId);
      const chain = this.chainOf(chainId);

      /* attendance = draw × chain screens × genre taste × price sensitivity × weather */
      const tasteMult = (chain.taste && chain.taste[ev.taste]) || 1;
      const screensShare = Math.min(1, chain.screens||0);
      const weather = 0.7 + (this._roll(eventId+"w", g.week, 60) / 100); /* 0.70–1.29 */
      const priceSens = tier.mult;
      const attendance = Math.max(1, Math.round(ev.draw * screensShare * tasteMult * priceSens * weather));
      const revenue = Math.round(attendance * tier.price / 10000); /* in $M */
      const cost = ev.cost;
      const profit = revenue - cost;

      this._spend("licensing", cost);
      if(profit > 0) this._earn("events", profit);

      const entry = { eventId, chainId, tierId, price:tier.price, week:g.week, cost, revenue, profit, attendance, resolved:false };
      this._push(g, entry);
      this._save();

      const tone = profit >= 0 ? "gold" : "bad";
      this._log("🎟 Event cinema: "+ev.name+" grossed "+fmtM(revenue)+" — "+(profit>=0?"packed house":"sparse house")+".", tone);
      this._toast("Event cinema: "+ev.name+" "+(profit>=0?"grossed":"lost")+" "+fmtM(Math.abs(profit))+".", tone);
      this._notify("🎟 Event cinema: "+ev.name+" "+(profit>=0?"grossed":"lost")+" "+fmtM(Math.abs(profit))+".", tone);
      return { ok:true, attendance, revenue, cost, profit, tone };
    },

    _push(g, entry){
      const ec = g.eventCinema = g.eventCinema || {};
      ec.booked = ec.booked || [];
      ec.booked.push(entry);
    },

    /* ── weekly resolution ────────────────────────────────────────────── */
    tickWeekly(g){
      const gg = this._G(g);
      if(!gg) return;
      const ec = this.ensure(gg);
      const week = gg.week||1;
      for(const b of ec.booked){
        if(b.resolved || b.week !== week - 1) continue;
        const ev = this.EVENTS[b.eventId];
        b.resolved = true;
        if(b.profit > 0){
          this._rep(1);
          this._chainRelDelta(b.chainId, 3);
          this._log("🎟 "+ev.name+" played "+b.chainId+" — packed house, "+fmtM(b.revenue)+" gross.","gold");
          this._notify("🎟 "+ev.name+" played "+b.chainId+" — packed house, "+fmtM(b.revenue)+" gross.","gold");
        } else {
          this._rep(-2);
          this._chainRelDelta(b.chainId, -2);
          this._log("🎟 "+ev.name+" played "+b.chainId+" — sparse house, "+fmtM(Math.abs(b.profit))+" loss.","bad");
          this._notify("🎟 "+ev.name+" played "+b.chainId+" — sparse house, "+fmtM(Math.abs(b.profit))+" loss.","bad");
        }
        ec.history.push(b);
      }
      ec.booked = ec.booked.filter(b => b.resolved && b.week >= week - 4); /* keep 4 weeks of history */
    },

    /* ── UI ───────────────────────────────────────────────────────────── */
    renderDesk(g){
      const gg = this._G(g);
      if(!gg) return "<div class='card'>Event cinema data unavailable.</div>";
      this.ensure(gg);
      const week = gg.week||1;
      const cat = this.catalog(gg);
      const booked = (gg.eventCinema.booked||[]).filter(b => b.week === week && !b.resolved);

      let h="<div class='event-cinema-desk'>";

      /* catalog */
      h+="<div class='ec-section'><div class='ec-head'><b>THIS WEEK'S EVENTS</b><small>book one into a chain, set the price</small></div>";
      h+="<div class='ec-catalog'>";
      for(const ev of cat){
        h+="<div class='ec-card' data-ec-event='"+ev.id+"'>";
        h+="<div class='ec-card-head'><b>"+this._esc(ev.name)+"</b><span class='ec-cost'>license "+this._fmtM(ev.cost)+"</span></div>";
        h+="<div class='ec-card-body'>";
        h+="<div class='ec-draw'>est. draw "+this._fmtG(ev.draw/1000)+"K · taste: "+this._esc(ev.taste)+"</div>";
        h+="<div class='ec-chains'>";
        for(const chain of this.chains()){
          const taste = (chain.taste && chain.taste[ev.taste]) || 1;
          h+="<button class='ec-chain-btn"+((chain.rel||50)>=50?"":" ec-chain-cold")+"' data-ec-chain='"+chain.id+"'>"+
            this._esc(chain.name)+" <span class='ec-screens'>"+Math.round(chain.screens*100)+"% screens</span>"+
            "<span class='ec-taste'>"+(taste>1?"+"+Math.round((taste-1)*100)+"%":"")+"</span>"+
          "</button>";
        }
        h+="</div>";
        h+="<div class='ec-tiers'>";
        for(const t of ev.tiers){
          h+="<button class='ec-tier-btn"+(t.id==="standard"?" ec-selected":"")+"' data-ec-tier='"+t.id+"'>"+t.id.charAt(0).toUpperCase()+t.id.slice(1)+" $"+t.price+"</button>";
        }
        h+="</div>";
        h+="<div class='ec-actions'><button class='ec-book-btn' data-ec-book='"+ev.id+"'>Book</button></div>";
        h+="</div></div>";
      }
      h+="</div></div>";

      /* booked this week */
      if(booked.length){
        h+="<div class='ec-section'><div class='ec-head'><b>BOOKED THIS WEEKEND</b><small>resolves on the weekly tick</small></div>";
        h+="<div class='ec-booked'>";
        for(const b of booked){
          const ev = this.EVENTS[b.eventId];
          const chain = this.chains().find(c => c.id === b.chainId);
          h+="<div class='ec-booked-row'>"+this._esc(ev.name)+" → "+this._esc(chain?chain.name:b.chainId)+
            " · $"+b.price+" ticket · resolves after this week's tick</div>";
        }
        h+="</div></div>";
      }

      /* history */
      const recent = (gg.eventCinema.history||[]).slice(-4);
      if(recent.length){
        h+="<div class='ec-section'><div class='ec-head'><b>RECENT EVENTS</b><small>last 4 resolutions</small></div>";
        h+="<div class='ec-history'>";
        for(const b of recent){
          h+="<div class='ec-hist-row'>"+this._esc(this.EVENTS[b.eventId].name)+" · "+
            (b.profit>=0?"+"+this._fmtM(b.profit):this._fmtM(b.profit))+" · "+b.attendance.toLocaleString()+" tickets</div>";
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
      r.querySelectorAll("[data-ec-event]").forEach(card => {
        const chainBtns = card.querySelectorAll("[data-ec-chain]");
        const tierBtns = card.querySelectorAll("[data-ec-tier]");
        let selChain = null, selTier = null;
        chainBtns.forEach(b => b.onclick = () => {
          self._beep("click");
          chainBtns.forEach(x => x.classList.remove("ec-selected"));
          b.classList.add("ec-selected"); selChain = b.getAttribute("data-ec-chain");
        });
        tierBtns.forEach(b => b.onclick = () => {
          self._beep("click");
          tierBtns.forEach(x => x.classList.remove("ec-selected"));
          b.classList.add("ec-selected"); selTier = b.getAttribute("data-ec-tier");
        });
        const book = card.querySelector("[data-ec-book]");
        if(book) book.onclick = () => {
          if(!selChain || !selTier){ self._beep("bad"); self._toast("Pick a chain and a price tier.","bad"); return; }
          self._beep("click");
          const res = self.book(card.getAttribute("data-ec-event"), selChain, selTier);
          if(!res.ok){ self._beep("bad"); self._toast(res.err,"bad"); return; }
          self._toast("Event booked — "+this._fmtM(res.revenue)+" projected gross.","gold");
          self._render();
        };
      });
    }
  };

  /* expose */
  global.EventCinema = EventCinema;
  if(typeof global.openEventCinemaDesk !== "function"){
    global.openEventCinemaDesk = function(){ /* desk is rendered in-place via viewBoxOffice section */ };
  }

})(typeof window !== "undefined" ? window : globalThis);
