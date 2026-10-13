/* ═════════════════════════════════════════════════════════════════════════
   THEATER-CHAINS.JS — Theater Chain Acquisition & Exhibition Empire
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_THEATERS = {
    version: "1.0.0",

    CHAIN_PRICING: {
      meridian: { price: 280, screensCount: 3600, concessionRate: 0.08, name: "Meridian Cinemas" },
      novastar: { price: 220, screensCount: 2880, concessionRate: 0.07, name: "NovaStar Cineplex" },
      lumen:    { price: 160, screensCount: 1920, concessionRate: 0.09, name: "Lumen Grand" },
      regent:   { price: 110, screensCount: 1440, concessionRate: 0.06, name: "Regent Arthouse" },
      starlite: { price: 70,  screensCount: 960,  concessionRate: 0.05, name: "Starlight Drive-Ins" }
    },

    FORMAT_UPGRADES: {
      imax:   { name: "Laser IMAX Auditoriums", cost: 35, boost: 0.12, ticketAdd: 4.5 },
      dolby:  { name: "Dolby Atmos Sound Suites", cost: 25, boost: 0.08, ticketAdd: 3.0 },
      vip:    { name: "VIP Dine-In Recliners", cost: 40, boost: 0.15, ticketAdd: 6.0 },
      motion: { name: "4DX Motion & Effects Halls", cost: 30, boost: 0.10, ticketAdd: 5.0 }
    },

    init(state){
      if(!state) return;
      state.ownedChains = state.ownedChains || [];
      state.chainUpgrades = state.chainUpgrades || {};
      state.exhibition = state.exhibition || {
        totalConcessionRev: 0,
        weeklyConcessions: 0,
        ownedScreenShare: 0
      };
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    canBuyChain(chainId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      this.init(g);
      if(g.ownedChains.includes(chainId)) return false;
      const def = this.CHAIN_PRICING[chainId];
      if(!def) return false;
      return g.studio && g.studio.cash >= def.price && g.studio.rep >= 45;
    },

    buyChain(chainId, optState){
      const g = this._getG(optState);
      if(!g || !this.canBuyChain(chainId, g)) return false;
      const def = this.CHAIN_PRICING[chainId];
      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("studio", def.price);
      else g.studio.cash -= def.price;

      g.ownedChains.push(chainId);
      this.recalcOwnedScreenShare(g);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("ACQUISITION: You bought " + def.name + " for " + fmtMFn(def.price) + "! You now control " + Math.round(g.exhibition.ownedScreenShare * 100) + "% of national cinema screens.", "gold");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    recalcOwnedScreenShare(state){
      this.init(state);
      const chains = (typeof DATA !== "undefined" && DATA.CHAINS) || (global.DATA && global.DATA.CHAINS) || [];
      let total = 0;
      for(const id of state.ownedChains){
        const c = chains.find(x => x.id === id);
        if(c) total += (c.screens || 0);
      }
      state.exhibition.ownedScreenShare = Math.round(total * 100) / 100;
      return state.exhibition.ownedScreenShare;
    },

    upgradeChainFormat(chainId, upgradeId, optState){
      const g = this._getG(optState);
      if(!g || !g.ownedChains.includes(chainId)) return false;
      const up = this.FORMAT_UPGRADES[upgradeId];
      if(!up) return false;
      g.chainUpgrades[chainId] = g.chainUpgrades[chainId] || [];
      if(g.chainUpgrades[chainId].includes(upgradeId)) return false;
      if(g.studio.cash < up.cost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("studio", up.cost);
      else g.studio.cash -= up.cost;

      g.chainUpgrades[chainId].push(upgradeId);
      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("Installed " + up.name + " across " + this.CHAIN_PRICING[chainId].name + " (-" + fmtMFn(up.cost) + "). Ticket yields boosted.", "good");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    // Weekly tick for concession stands revenue & exhibition profit
    tickWeekly(state){
      this.init(state);
      if(!state.ownedChains.length) return 0;
      let totalScreens = 0;
      let totalRate = 0;
      state.ownedChains.forEach(cid => {
        const p = this.CHAIN_PRICING[cid];
        if(p){
          totalScreens += p.screensCount;
          totalRate += p.concessionRate;
        }
      });

      // Format upgrade yield multipliers
      let upgradeBonus = 1;
      Object.keys(state.chainUpgrades).forEach(cid => {
        (state.chainUpgrades[cid] || []).forEach(uid => {
          const u = this.FORMAT_UPGRADES[uid];
          if(u) upgradeBonus += u.boost;
        });
      });

      // Admissions driven by films in theaters
      const activeFilms = (state.films || []).filter(f => f.inTheaters && f.weeksInRelease <= 12);
      const boVolume = activeFilms.reduce((a, f) => a + (f.gross || 5), 0);
      const baselineAttendance = Math.max(10, boVolume * 0.4);

      // Concession net profit = screens * attendance factor * concession rate * upgradeBonus
      const weeklyConcessions = Math.round((baselineAttendance * (totalRate / state.ownedChains.length) * (totalScreens / 2500) * upgradeBonus) * 10) / 10;

      state.exhibition.weeklyConcessions = Math.max(0.2, weeklyConcessions);
      state.exhibition.totalConcessionRev += state.exhibition.weeklyConcessions;

      if(typeof global.earn === "function"){
        global.earn("merch", state.exhibition.weeklyConcessions);
      } else {
        state.studio.cash += state.exhibition.weeklyConcessions;
      }
      return state.exhibition.weeklyConcessions;
    },

    // Hook called when calculating domestic theatrical studio rental share
    getExhibitionSplitMultiplier(state){
      this.init(state);
      const share = state.exhibition.ownedScreenShare || 0;
      // Normal distributor cut is ~50%. In owned screens, studio takes 100% (exhibitor + distributor).
      // Bonus = share * 0.50 (e.g. 30% screen share => +15% net theatrical revenue)
      return 1.0 + (share * 0.50);
    }
  };

  global.BOW_THEATERS = BOW_THEATERS;

  // Global modal for Theater Chains Management
  global.openTheaterChainsModal = function(){
    if(!global.G) return;
    BOW_THEATERS.init(global.G);
    const chains = (global.DATA && global.DATA.CHAINS) || [];
    const owned = global.G.ownedChains || [];
    const share = Math.round(global.G.exhibition.ownedScreenShare * 100);

    let h = "<h3>Exhibition Empire & Theater Chains</h3>";
    h += "<p class='tiny muted'>Acquire national cinema circuits to capture 100% box office splits on your screens and earn weekly concession revenues.</p>";

    h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--gold2)'>";
    h += "<div class='spread'><b>Domestic Screen Ownership: " + share + "%</b><span class='pos'>Concessions: +" + (typeof global.fmtM === "function" ? global.fmtM(global.G.exhibition.weeklyConcessions || 0) : "$" + (global.G.exhibition.weeklyConcessions || 0) + "M") + "/wk</span></div>";
    h += "<div class='tiny muted'>Owned screens pay 100% of box office to you instead of standard 50% distributor split.</div>";
    h += "</div>";

    h += "<div class='grid g2' style='gap:10px'>";
    chains.forEach(c => {
      const isOwned = owned.includes(c.id);
      const p = BOW_THEATERS.CHAIN_PRICING[c.id] || { price: 150, screensCount: 1500 };
      const ups = (global.G.chainUpgrades[c.id] || []);

      h += "<div class='card' style='" + (isOwned ? "border:1px solid var(--green);" : "") + "'>";
      h += "<div class='spread'><b>" + c.name + "</b>" + (isOwned ? "<span class='tag green'>OWNED</span>" : "<span class='tag'>" + (typeof global.fmtM === "function" ? global.fmtM(p.price) : "$" + p.price + "M") + "</span>") + "</div>";
      h += "<div class='tiny muted' style='margin:4px 0'>" + c.blurb + "</div>";
      h += "<div class='cost-line'><span>National Screens</span><b>" + Math.round((c.screens||0)*100) + "% (" + p.screensCount.toLocaleString() + " auditoriums)</b></div>";

      if(!isOwned){
        const canBuy = BOW_THEATERS.canBuyChain(c.id);
        h += "<button class='btn btn-sm " + (canBuy ? "btn-primary" : "btn-disabled") + "' data-buychain='" + c.id + "' style='margin-top:8px;width:100%'>" + (canBuy ? "Acquire Chain (" + (typeof global.fmtM === "function" ? global.fmtM(p.price) : "$" + p.price + "M") + ")" : "Requires $" + p.price + "M & Rep ≥45") + "</button>";
      } else {
        h += "<div class='small' style='margin-top:8px'><b>Auditorium Upgrades:</b></div>";
        Object.keys(BOW_THEATERS.FORMAT_UPGRADES).forEach(uid => {
          const up = BOW_THEATERS.FORMAT_UPGRADES[uid];
          const hasUp = ups.includes(uid);
          h += "<div class='spread' style='margin-top:4px;font-size:12px'>";
          h += "<span>" + up.name + "</span>";
          if(hasUp){
            h += "<span class='tag green'>Installed</span>";
          } else {
            h += "<button class='btn btn-xs btn-alt' data-upchain='" + c.id + ":" + uid + "'>+" + up.cost + "M</button>";
          }
          h += "</div>";
        });
      }
      h += "</div>";
    });
    h += "</div>";

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    v.querySelectorAll("[data-buychain]").forEach(b => {
      b.onclick = function(){
        const cid = b.dataset.buychain;
        if(BOW_THEATERS.buyChain(cid)){
          if(typeof global.beep === "function") global.beep("gold");
          if(typeof global.render === "function") global.render();
          global.openTheaterChainsModal();
        } else {
          if(typeof global.toast === "function") global.toast("Cannot acquire chain — check cash and studio reputation.", "bad");
        }
      };
    });

    v.querySelectorAll("[data-upchain]").forEach(b => {
      b.onclick = function(){
        const [cid, uid] = b.dataset.upchain.split(":");
        if(BOW_THEATERS.upgradeChainFormat(cid, uid)){
          if(typeof global.beep === "function") global.beep("cash");
          if(typeof global.render === "function") global.render();
          global.openTheaterChainsModal();
        } else {
          if(typeof global.toast === "function") global.toast("Insufficient cash for format upgrade.", "bad");
        }
      };
    });
  };

})(typeof window !== "undefined" ? window : global);
