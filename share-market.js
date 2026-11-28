/* ═════════════════════════════════════════════════════════════════════════
   SHARE-MARKET.JS — Share Market completion (v48)
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════ Treasury desk ═════════════════════
   Completes the public-company arc the engine started in v2 (goPublic,
   tickPublic, earningsCall, secondaryOffering): buybacks, dividends, a real
   ownership stake, and a hostile-takeover arc that turns an undervalued
   stock into an endgame threat.

   Design rules:
   • The engine owns the price walk (tickPublic). This module never moves the
     price arbitrarily — reactions (dividend sentiment, tender premium,
     uncovered-dividend hit) are small, documented nudges.
   • All cash moves through spend()/earn() with ledger categories
     ("financing"/"dividends") so G.weekTx and the treasury lanes stay exact.
   • Save-compatible: every G.sharemarket field is optional; old saves get
     defaults lazily via ensure().
   • Takeover is survivable: an un-defended tender demotes you to a minority
     stake (austerity arc) instead of ending the run; accepting the tender
     is the hard game over.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){

  const ShareMarket = {
    version: "1.0.0",

    /* ── tuning ───────────────────────────────────────────────────────── */
    CONFIG: {
      buybackPremium: 1.06,
      dividendStep: 0.10,
      dividendMax: 0.50,
      divSentiment: 0.004,        /* price ×(1+0.004×$M paid) when covered */
      divSkipPriceHit: 0.97,      /* uncovered dividend: price ×0.97 */
      threatUndervalued60: 6,     /* threat/week when cap < 60% of book */
      threatUndervalued75: 3,     /* threat/week when cap < 75% of book */
      threatDrift: 1,             /* threat/week decay when 75-90% */
      threatDecay: 4,             /* threat/week decay when ≥90% */
      threatMax: 100,
      offerThreshold: 55,
      offerChance: 0.25,
      offerCooldown: 12,
      offerPremium: 1.15,
      offerWeeks: 4,
      pillCostFrac: 0.35,         /* poison-pill = 35% of the offer value */
      pillOwnership: 10,
      knightCostFrc: 0.20,        /* white-knight fee = 20% of market cap */
      demoteOwnership: 45,
      boardHitOnDemote: 15,
      demoteBoardDrain: 1        /* board approval/week while demoted */
    },

    /* ── state ────────────────────────────────────────────────────────── */
    ensure(g){
      if(!g) return null;
      g.sharemarket = g.sharemarket || {};
      const st = g.sharemarket;
      st.buybackShares = st.buybackShares || 0;
      st.buybackSpent  = st.buybackSpent  || 0;
      st.dividends     = st.dividends     || { perShare: 0, totalPaid: 0, quartersPaid: 0 };
      st.ownership     = (typeof st.ownership === "number") ? st.ownership : 100;
      st.lastShares    = (typeof st.lastShares === "number") ? st.lastShares : (g.public ? g.public.shares : 0);
      st.takeover      = st.takeover      || { threat: 0, activeOffer: null, lastOfferWeek: 0, demoted: false, offersSeen: 0 };
      st.takeover.activeOffer = st.takeover.activeOffer || null;
      return st;
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
        if(typeof globalThis !== "undefined" && typeof globalThis[name] === "function") return globalThis[name];
      } catch(e){}
      return null;
    },
    _esc(s){ const f=this._h("esc"); return f? f(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); },
    _fmtM(x){ const f=this._h("fmtM"); return f? f(x) : "$"+Math.round((x||0)*10)/10+"M"; },
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
    _marketCap(){
      const f=this._h("marketCap");
      if(f) return f();
      const g=this._G();
      return g && g.public ? Math.round(g.public.price*g.public.shares) : 0;
    },
    /* Book value total — the same components tickPublic() uses for book/share,
       scaled back up to a company total. */
    _bookTotal(g){
      try {
        const g2=g||this._G();
        if(!g2 || !g2.studio) return 1;
        const cat = this._h("catalogValue") ? this._h("catalogValue")() : 0;
        const streamer = g2.streamer ? (g2.streamer.subs||0)*18 : 0;
        return Math.max(1, cat + g2.studio.cash - (g2.studio.debt||0) + streamer);
      } catch(e){ return 1; }
    },
    _clamp(v,a,b){ return Math.max(a, Math.min(b, v)); },
    _chance(q){
      const f=this._h("chance");
      if(f) return f(q);
      const r=this._h("rnd");
      return r ? r()<q : Math.random()<q;
    },
    _pick(arr){
      const f=this._h("pick");
      if(f) return f(arr);
      return arr && arr.length ? arr[Math.floor(Math.random()*arr.length)] : null;
    },
    _rep(delta){
      const g=this._G();
      if(g && g.studio){
        const cl=this._h("clamp");
        g.studio.rep = cl ? cl(g.studio.rep+delta,5,99) : Math.max(5, Math.min(99, g.studio.rep+delta));
      }
    },

    /* ── ownership sync: secondaries dilute, buybacks restore ─────────── */
    syncOwnership(g){
      const g2=this._G(g);
      if(!g2) return;
      const st=this.ensure(g2);
      const P=g2.public;
      if(!P){ st.ownership=100; st.lastShares=0; return; }
      if(P.shares > st.lastShares){
        /* new shares sold (secondaryOffering) — everyone's stake shrinks */
        st.ownership = Math.max(20, st.ownership * (st.lastShares / Math.max(1, P.shares)));
      }
      /* shares below lastShares only happen through our own buyback, which
         updates ownership directly — just resync the watermark here. */
      st.lastShares = P.shares;
    },

    /* ── buyback ──────────────────────────────────────────────────────── */
    canBuyback(g){
      const g2=this._G(g);
      if(!g2 || !g2.public) return { ok:false, err:"You are not listed." };
      const st=this.ensure(g2);
      if(st.takeover.activeOffer) return { ok:false, err:"Defend the tender offer first — the pill below is your buyback." };
      if(g2.studio.cash < 5) return { ok:false, err:"Cash is too low to buy back meaningfully." };
      return { ok:true };
    },
    buybackShares(n, g){
      const g2=this._G(g);
      if(!g2) return { ok:false, err:"no game" };
      const chk=this.canBuyback(g2);
      if(!chk.ok) return chk;
      const st=this.ensure(g2);
      const P=g2.public;
      n = Math.max(1, Math.round(n||0));
      n = Math.min(n, Math.floor(P.shares*0.2));                       /* ≤20% of float per action */
      const premium = this.CONFIG.buybackPremium;
      n = Math.min(n, Math.floor(g2.studio.cash/(P.price*premium)));   /* afford clamp */
      if(n < 1) return { ok:false, err:"Not enough cash for even one share." };
      const price = Math.max(0.6, P.price*premium);
      const cost = Math.round(price*n);
      const sharesBefore = P.shares;
      const ownBefore = st.ownership;
      this._spend("financing", cost);
      P.shares -= n;
      st.ownership = Math.min(100, st.ownership * (sharesBefore / Math.max(1,P.shares)));
      st.buybackShares += n;
      st.buybackSpent += cost;
      st.lastShares = P.shares;
      this._log("🔁 Buyback: repurchased "+n+"M shares at $"+price.toFixed(2)+" (6% premium) for "+this._fmtM(cost)+" — ownership "+Math.round(ownBefore)+"% → "+Math.round(st.ownership)+"%.","gold");
      this._save();
      return { ok:true, shares:n, cost, ownership:st.ownership };
    },

    /* ── dividends ────────────────────────────────────────────────────── */
    setDividend(perShare, g){
      const g2=this._G(g);
      if(!g2 || !g2.public) return { ok:false, err:"You are not listed." };
      const st=this.ensure(g2);
      perShare = Math.round((perShare||0)*100)/100;
      perShare = Math.max(0, Math.min(this.CONFIG.dividendMax, perShare));
      const prev=st.dividends.perShare;
      st.dividends.perShare=perShare;
      if(perShare>prev){
        this._log("💵 Dividend raised to $"+perShare.toFixed(2)+"/share/quarter — shareholders cheer, the treasury will feel it.","gold");
      } else if(perShare<prev && prev>0){
        this._log("💵 Dividend cut to $"+perShare.toFixed(2)+"/share/quarter — the street remembers dividend cuts.","bad");
      }
      this._save();
      return { ok:true, perShare };
    },

    /* ── weekly tick: dividends, threat, offers, execution, recovery ──── */
    tickWeekly(g){
      const g2=this._G(g);
      if(!g2) return;
      this.syncOwnership(g2);
      const st=this.ensure(g2);
      const tk=st.takeover;
      if(!g2.public){
        tk.threat=Math.max(0, tk.threat-8);
        return;
      }
      const P=g2.public;

      /* dividends pay on the earnings-call weeks (13/26/39/52) */
      const woy = this._h("woyOf") ? this._h("woyOf")(g2.week) : ((g2.week-1)%52)+1;
      const callWeeks=(typeof DATA!=="undefined" && DATA.MARKET && DATA.MARKET.callWeeks) || [13,26,39,52];
      if(callWeeks.includes(woy) && st.dividends.perShare>0){
        const payout=Math.round(P.shares*st.dividends.perShare);
        if(g2.studio.cash >= payout){
          this._spend("dividends", payout);
          st.dividends.totalPaid+=payout;
          st.dividends.quartersPaid++;
          P.price = Math.max(0.6, Math.round((P.price*(1+this.CONFIG.divSentiment*payout))*100)/100);
          this._log("💵 Dividend paid: "+this._fmtM(payout)+" ("+P.shares+"M × $"+st.dividends.perShare.toFixed(2)+"/share). The street likes a covered payout.","good");
        } else {
          this._rep(-2);
          P.price = Math.max(0.6, Math.round((P.price*this.CONFIG.divSkipPriceHit)*100)/100);
          this._log("💵 Dividend skipped — the treasury could not cover "+this._fmtM(payout)+". Shareholders notice (−2 rep, price −3%).","bad");
        }
      }

      /* threat model: undervaluation vs the book total, with decay when valued */
      const bookTotal=this._bookTotal(g2);
      const cap=this._marketCap();
      const ratio=cap/Math.max(1,bookTotal);
      if(ratio<0.60) tk.threat+=this.CONFIG.threatUndervalued60;
      else if(ratio<0.75) tk.threat+=this.CONFIG.threatUndervalued75;
      else if(ratio>=0.90) tk.threat=Math.max(0, tk.threat-this.CONFIG.threatDecay);
      else tk.threat=Math.max(0, tk.threat-this.CONFIG.threatDrift);
      tk.threat=Math.min(this.CONFIG.threatMax, tk.threat);

      /* offer initiation */
      const candidates=(g2.rivals||[]).filter(r=>r && !r.acquiredBy && (r.style==="tentpole" || (g2.rivalAI && g2.rivalAI[r.name] && g2.rivalAI[r.name].personality==="aggressive")));
      if(!candidates.length) candidates=(g2.rivals||[]).filter(r=>r && !r.acquiredBy);
      if(tk.threat>=this.CONFIG.offerThreshold && !tk.activeOffer
         && (g2.week - tk.lastOfferWeek) >= this.CONFIG.offerCooldown
         && candidates.length && this._chance(this.CONFIG.offerChance)){
        const rival=this._pick(candidates);
        tk.activeOffer = {
          rival: rival.name,
          pricePerShare: Math.round(P.price*this.CONFIG.offerPremium*100)/100,
          totalM: Math.round(this._marketCap()*this.CONFIG.offerPremium),
          premium: this.CONFIG.offerPremium,
          weeksLeft: this.CONFIG.offerWeeks,
          born: g2.week
        };
        tk.offersSeen++;
        tk.lastOfferWeek=g2.week;
        this._log("🚨 HOSTILE TENDER: "+tk.activeOffer.rival+" bids "+this._fmtM(tk.activeOffer.totalM)+" ("+Math.round((this.CONFIG.offerPremium-1)*100)+"% premium) for your studio. The board demands a response.","bad");
        this._toast("🚨 Hostile tender from "+tk.activeOffer.rival+"! Open Finance → Equity to respond.","bad");
      }

      /* offer countdown → execution (the creation tick grants the full window) */
      if(tk.activeOffer && g2.week > tk.activeOffer.born){
        tk.activeOffer.weeksLeft--;
        if(tk.activeOffer.weeksLeft<=0){ this.executeTakeover(g2, st); }
      }

      /* demotion recovery: buy back to a majority */
      if(tk.demoted && st.ownership>=51){
        tk.demoted=false;
        this._rep(5);
        this._log("🗳 Control restored — you own "+Math.round(st.ownership)+"% again. The board seat is yours; the austerity arc closes.","good");
      }

      /* while demoted, the new majority owner bleeds the board */
      if(tk.demoted){
        (g2.board||[]).forEach(m=>{ m.approval=Math.max(0,(m.approval||50)-this.CONFIG.demoteBoardDrain); });
      }
    },

    /* ── defense actions ──────────────────────────────────────────────── */
    defendOffer(kind, g){
      const g2=this._G(g);
      if(!g2) return { ok:false, err:"no game" };
      const st=this.ensure(g2);
      const tk=st.takeover;
      const offer=tk.activeOffer;
      if(!offer) return { ok:false, err:"No tender offer active." };

      if(kind==="pill"){
        const cost=Math.round(offer.totalM*this.CONFIG.pillCostFrac);
        if(g2.studio.cash < cost) return { ok:false, err:"The poison pill needs "+this._fmtM(cost)+" — you have "+this._fmtM(g2.studio.cash)+".", need:cost };
        this._spend("financing", cost);
        st.ownership=Math.min(100, st.ownership+this.CONFIG.pillOwnership);
        tk.activeOffer=null;
        tk.threat=35;
        this._log("💊 Poison pill executed: "+this._fmtM(cost)+" of discounted buybacks to allies blunts the tender — ownership "+Math.round(st.ownership)+"%. "+offer.rival+" withdraws.","gold");
        this._save();
        return { ok:true, kind, cost };
      }
      if(kind==="knight"){
        const cost=Math.round(this._marketCap()*this.CONFIG.knightCostFrc);
        if(g2.studio.cash < cost) return { ok:false, err:"The white knight wants "+this._fmtM(cost)+" — you have "+this._fmtM(g2.studio.cash)+".", need:cost };
        this._spend("financing", cost);
        const knight=(g2.rivals||[]).find(r=>r && !r.acquiredBy && r.name!==offer.rival) || null;
        if(knight && g2.rivalAI && g2.rivalAI[knight.name]){
          g2.rivalAI[knight.name].trust=Math.min(100,(g2.rivalAI[knight.name].trust||50)+10);
        }
        tk.activeOffer=null;
        tk.threat=30;
        this._log("🛡 White knight: "+(knight?knight.name:"A friendly buyer")+" counter-bids and "+offer.rival+" retreats for "+this._fmtM(cost)+".","gold");
        this._save();
        return { ok:true, kind, cost };
      }
      if(kind==="accept"){
        tk.activeOffer=null;
        tk.threat=0;
        const goFn=this._h("gameOver");
        const text=offer.rival+" closed the tender at "+this._fmtM(offer.totalM)+". The studio you built is theirs now — "+(G.stats?G.stats.films||0:0)+" films, week "+g2.week+".";
        if(goFn) goFn("Hostile Takeover", text);
        this._log("🏚 The tender closed. "+text,"bad");
        this._save();
        return { ok:true, kind, ended:true };
      }
      return { ok:false, err:"Unknown defense." };
    },

    /* An un-defended tender executes: survivable demotion, not a hard end. */
    executeTakeover(g, st){
      const tk=st.takeover;
      const offer=tk.activeOffer;
      st.ownership=this.CONFIG.demoteOwnership;
      st.lastShares=(g.public?g.public.shares:st.lastShares);
      (g.board||[]).forEach(m=>{ m.approval=Math.max(0,(m.approval||50)-this.CONFIG.boardHitOnDemote); });
      if(g.public) g.public.price=Math.max(0.6, Math.round(g.public.price*1.02*100)/100);
      tk.demoted=true;
      tk.activeOffer=null;
      tk.threat=30;
      this._rep(-4);
      this._log("🏚 TAKEOVER EXECUTED: you defended nothing and "+(offer?offer.rival:"the raider")+" closed the tender. You keep the studio's soul — and "+this.CONFIG.demoteOwnership+"% of its shares. Buy back to 51% to take control again.","bad");
      this._toast("🏚 Takeover executed — you are a minority owner now. Restore 51% to regain control.","bad");
      this._save();
      return true;
    },

    /* ══ UI ═════════════════════════════════════════════════════════════ */
    _meter(pct, cls){
      return "<div class='sm-meter'><i class='"+cls+"' style='width:"+this._clamp(Math.round(pct),0,100)+"%'></i></div>";
    },
    _band(t){
      return t<30? {cls:"sm-ok", label:"Dormant"}
           : t<55? {cls:"sm-warn", label:"Restless"}
           :       {cls:"sm-hot", label:"RAIDER WATCH"};
    },

    marketPanelHTML(g){
      const g2=this._G(g);
      if(!g2 || !g2.public) return "";
      const st=this.ensure(g2);
      const P=g2.public;
      const tk=st.takeover;
      const div=st.dividends;
      const cash=g2.studio.cash||0;
      const ownerPct=Math.round(st.ownership);
      const band=this._band(tk.threat);
      const divQtr=Math.round(P.shares*div.perShare);
      const maxBB=Math.max(1, Math.min(Math.floor(P.shares*0.2), Math.floor(cash/(P.price*this.CONFIG.buybackPremium))));
      const divOpts=[0,0.10,0.20,0.30,0.50].map(v=>"<option value='"+v+"'"+(Math.abs(div.perShare-v)<0.005?" selected":"")+">"+(v===0?"No dividend":"$"+v.toFixed(2)+"/share")+"</option>").join("");

      let h="<div class='sm-panel'>";
      if(tk.activeOffer){
        const o=tk.activeOffer;
        h+="<div class='sm-alert'><b>🚨 HOSTILE TENDER from "+this._esc(o.rival)+"</b> — "+this._fmtM(o.totalM)+" ("+Math.round((o.premium-1)*100)+"% premium, $"+o.pricePerShare.toFixed(2)+"/share). "+o.weeksLeft+" week"+(o.weeksLeft===1?"":"s")+" to respond.</div>";
        h+="<div class='sm-actions'>"+
          "<button class='btn btn-sm btn-primary' data-sm-defend='pill'>💊 Poison pill — "+this._fmtM(Math.round(o.totalM*this.CONFIG.pillCostFrac))+"</button>"+
          "<button class='btn btn-sm btn-alt' data-sm-defend='knight'>🛡 White knight — "+this._fmtM(Math.round(this._marketCap()*this.CONFIG.knightCostFrc))+"</button>"+
          "<button class='btn btn-sm btn-ghost sm-danger' data-sm-defend='accept'>🏚 Accept — end the run</button>"+
        "</div>";
      } else if(tk.demoted){
        h+="<div class='sm-alert sm-warnbox'><b>🏚 UNDER NEW OWNERSHIP</b> — you hold "+ownerPct+"%. Buy back to 51% to take the board back.</div>";
      } else if(tk.threat>=30){
        h+="<div class='sm-alert sm-warnbox'><b>👁 Raider watch:</b> "+band.label+" ("+Math.round(tk.threat)+"/100). Undervalued stock attracts raiders — keep the price near book value.</div>";
      }

      h+="<div class='sm-grid'>"+
        "<div>"+
          "<div class='fin-line'><span>Ownership stake</span><b class='"+(ownerPct>=51?"pos":"neg")+"'>"+ownerPct+"%</b></div>"+
          this._meter(ownerPct,"sm-owner")+
          "<div class='fin-line'><span>Takeover threat</span><b class='"+(band.cls==="sm-hot"?"neg":band.cls==="sm-warn"?"":"pos")+"'>"+Math.round(tk.threat)+" · "+band.label+"</b></div>"+
          this._meter(tk.threat,band.cls)+
          "<div class='fin-line'><span>Buybacks to date</span><b>"+st.buybackShares+"M · "+this._fmtM(st.buybackSpent)+"</b></div>"+
          "<div class='fin-line'><span>Dividends paid</span><b>"+this._fmtM(div.totalPaid)+" · "+div.quartersPaid+" call"+(div.quartersPaid===1?"":"s")+"</b></div>"+
        "</div>"+
        "<div>"+
          "<div class='fin-slider'><label for='fnBB'>Buy back shares (max "+maxBB+"M affordable at a 6% premium)</label><input type='range' id='fnBB' min='1' max='"+maxBB+"' step='1' value='2'><div class='fin-slider-foot'><b id='fnBBV'></b><button class='btn btn-sm btn-alt' data-sm-bb>🔁 Buy back</button></div></div>"+
          "<div class='fin-slider'><label for='fnDiv'>Dividend policy — paid on earnings-call weeks</label><select id='fnDiv' data-sm-div>"+divOpts+"</select><div class='fin-slider-foot'><b>≈ "+this._fmtM(divQtr)+" / quarter</b></div></div>"+
          "<p class='tiny muted'>Raiders circle an undervalued studio: threat builds when market cap falls below ~75% of book value and cools when the price recovers. A poison pill or a white knight repels a tender; the pill also restores control while demoted.</p>"+
        "</div>"+
      "</div>";
      h+="</div>";
      return h;
    },

    bindFinanceDesk(root){
      const r=root||(typeof document!=="undefined"?document:null);
      if(!r || !r.querySelectorAll) return;
      const self=this;
      const slider=r.querySelector("#fnBB");
      const sliderV=r.querySelector("#fnBBV");
      const updateV=()=>{
        if(!slider || !sliderV) return;
        const n=+slider.value||0;
        const g=this._G();
        const price=g&&g.public? g.public.price*this.CONFIG.buybackPremium : 0;
        sliderV.textContent = n+"M shares · "+this._fmtM(Math.round(price*n));
      };
      updateV();
      if(slider) slider.oninput=updateV;

      const bb=r.querySelector("[data-sm-bb]");
      if(bb) bb.onclick=()=>{
        this._beep("click");
        const res=this.buybackShares(slider? +slider.value : 2);
        if(!res.ok){ this._beep("bad"); this._toast(res.err,"bad"); return; }
        this._toast("Buyback executed.","good");
        this._render();
      };

      const dv=r.querySelector("[data-sm-div]");
      if(dv) dv.onchange=()=>{
        this._beep("click");
        const res=this.setDividend(+dv.value);
        if(!res.ok){ this._beep("bad"); this._toast(res.err,"bad"); return; }
        this._toast("Dividend policy updated.","good");
        this._render();
      };

      r.querySelectorAll("[data-sm-defend]").forEach(b=>{
        b.onclick=()=>{
          const kind=b.getAttribute("data-sm-defend");
          this._beep("click");
          if(kind==="accept"){
            const ok=window.confirm ? window.confirm("Accept the tender? This ENDS your run — the studio becomes the raider's. Cannot be undone.") : true;
            if(!ok) return;
          }
          const res=this.defendOffer(kind);
          if(!res.ok){ this._beep("bad"); this._toast(res.err,"bad"); this._render(); return; }
          if(res.ended){ /* gameOver() handles routing */ }
          else { this._toast("Tender repelled.","gold"); }
          this._render();
        };
      });
    },

    openTakeoverModal(){
      const g=this._G();
      if(!g) return;
      const st=this.ensure(g);
      const offer=st.takeover.activeOffer;
      const openModalFn=this._h("openModal");
      if(!offer){ this._toast("No tender offer active.","bad"); return; }
      if(!openModalFn){ this._toast("The defense modal could not open (UI module missing).","bad"); return; }
      const o=offer;
      let h="<div class='modal-head'><h3>🚨 Hostile Tender — "+this._esc(o.rival)+"</h3></div><div class='modal-body'>";
      h+="<p><b>"+this._esc(o.rival)+"</b> offers "+this._fmtM(o.totalM)+" for the whole studio — a "+Math.round((o.premium-1)*100)+"% premium ($"+o.pricePerShare.toFixed(2)+"/share). The board demands a response within "+o.weeksLeft+" week"+(o.weeksLeft===1?"":"s")+", or the tender closes and you lose majority control.</p>";
      h+="<div class='sm-actions'>"+
        "<button class='btn btn-primary' data-sm-defend='pill'>💊 Poison pill — "+this._fmtM(Math.round(o.totalM*this.CONFIG.pillCostFrac))+", +"+this.CONFIG.pillOwnership+"% ownership</button>"+
        "<button class='btn btn-alt' data-sm-defend='knight'>🛡 White knight — "+this._fmtM(Math.round(this._marketCap()*this.CONFIG.knightCostFrc))+", a rival counter-bids</button>"+
        "<button class='btn btn-ghost sm-danger' data-sm-defend='accept'>🏚 Accept the money and end the run</button>"+
      "</div>";
      h+="<p class='tiny muted'>Letting it expire hands "+(Math.round(100-this.CONFIG.demoteOwnership))+"% to the raider and triggers the austerity arc — survivable, not fatal. Accepting is final.</p>";
      h+="</div>";
      const v=openModalFn(h);
      this.bindFinanceDesk(v);
    }
  };

  /* expose */
  global.ShareMarket = ShareMarket;
  if(typeof global.openTakeoverModal !== "function"){
    global.openTakeoverModal = function(){ ShareMarket.openTakeoverModal(); };
  }

})(typeof window !== "undefined" ? window : globalThis);
