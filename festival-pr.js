/* ═════════════════════════════════════════════════════════════════════════
   FESTIVAL-PR.JS — Film Festival Circuit & Crisis PR Management System
   Box Office War — Modular Engine Extension
   (Synthesized with 100% parity to Box_Office_Inc Crisis PR System & Film Festival Circuit)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_FESTIVAL_PR = {
    version: "2.0.0",

    FESTIVALS: [
      { id: "palais", name: "Palais d'Or (Cannes Tier)", seasonWeek: 20, entryCost: 1.5, prestige: 95, desc: "The premier international auteur showcase. Huge critical buzz and Golden Palm honors." },
      { id: "snowpeak", name: "Snowpeak Independent (Sundance Tier)", seasonWeek: 4, entryCost: 0.6, prestige: 85, desc: "Indie discovery launchpad. High buyer bidding and cult acclaim." },
      { id: "lido", name: "Lido International (Venice Tier)", seasonWeek: 36, entryCost: 1.2, prestige: 90, desc: "Autumn awards frontrunner circuit. Golden Lion pedigree and Oscar precursor traction." }
    ],

    // Parity with Box_Office_Inc crisis-management-pr-system.md
    CRISIS_STRATEGIES: {
      PUBLIC_APOLOGY: {
        key: "PUBLIC_APOLOGY",
        name: "Public Apology",
        cost: 0.05, // $50,000
        mitigation: 0.50, // 50% damage relief
        repRestore: 5,
        desc: "Coordinated public statement and televised apology. 50% damage mitigation."
      },
      PRESS_TOUR: {
        key: "PRESS_TOUR",
        name: "Press Tour Charm Offensive",
        cost: 0.10, // $100,000
        mitigation: 0.70, // 70% damage relief
        repRestore: 10,
        desc: "High-profile morning shows, podcast circuit, and trade interviews. 70% damage mitigation."
      },
      SETTLEMENT_PAYOUT: {
        key: "SETTLEMENT_PAYOUT",
        name: "Confidential Settlement Payout",
        cost: 0.25, // $250,000
        mitigation: 0.90, // 90% damage relief
        repRestore: 18,
        desc: "Discreet financial settlement with ironclad non-disclosure agreement. 90% damage mitigation."
      },
      LEGAL_ACTION: {
        key: "LEGAL_ACTION",
        name: "Aggressive Injunction & Legal Action",
        cost: 0.50, // $500,000
        mitigation: 0.95, // 95% damage relief
        repRestore: 25,
        desc: "Immediate cease-and-desist filings and defamation litigation to suppress claims. 95% damage mitigation."
      }
    },

    // Legacy backwards compatibility alias
    get PR_ACTIONS(){
      return {
        apology_tour: { name: this.CRISIS_STRATEGIES.PUBLIC_APOLOGY.name, cost: this.CRISIS_STRATEGIES.PUBLIC_APOLOGY.cost, repRestore: this.CRISIS_STRATEGIES.PUBLIC_APOLOGY.repRestore, desc: this.CRISIS_STRATEGIES.PUBLIC_APOLOGY.desc },
        charity_grant: { name: this.CRISIS_STRATEGIES.PRESS_TOUR.name, cost: this.CRISIS_STRATEGIES.PRESS_TOUR.cost, repRestore: this.CRISIS_STRATEGIES.PRESS_TOUR.repRestore, desc: this.CRISIS_STRATEGIES.PRESS_TOUR.desc },
        nda_settlement: { name: this.CRISIS_STRATEGIES.SETTLEMENT_PAYOUT.name, cost: this.CRISIS_STRATEGIES.SETTLEMENT_PAYOUT.cost, repRestore: this.CRISIS_STRATEGIES.SETTLEMENT_PAYOUT.repRestore, desc: this.CRISIS_STRATEGIES.SETTLEMENT_PAYOUT.desc },
        spin_narrative: { name: this.CRISIS_STRATEGIES.LEGAL_ACTION.name, cost: this.CRISIS_STRATEGIES.LEGAL_ACTION.cost, repRestore: this.CRISIS_STRATEGIES.LEGAL_ACTION.repRestore, desc: this.CRISIS_STRATEGIES.LEGAL_ACTION.desc }
      };
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    // Calculate weekly reputation decay from unresolved scandals
    calculateWeeklyReputationImpact(optState){
      const g = this._getG(optState);
      if(!g || !g.scandals || !g.scandals.length) return 0;
      let totalDamage = 0;
      g.scandals.forEach(s => {
        const severity = s.severity || 1;
        const weeklyDrain = severity * 1.5;
        totalDamage += weeklyDrain;
      });
      return Math.round(totalDamage * 10) / 10;
    },

    // Apply weekly crisis damage tick
    tickWeeklyCrisis(optState){
      const g = this._getG(optState);
      if(!g || !g.scandals || !g.scandals.length) return;
      const damage = this.calculateWeeklyReputationImpact(g);
      if(damage > 0 && g.studio){
        g.studio.rep = Math.max(1, (g.studio.rep || 50) - damage);
        const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
        if(logFn && Math.random() < 0.4){
          logFn("🚨 PR CONTROVERSY: Active media scandal decayed studio prestige by -" + damage + " pts this week.", "bad");
        }
      }
    },

    evaluateCrisisResolution(strategyKey, optScandalIdx, optState){
      const g = this._getG(optState);
      if(!g) return false;
      const strat = this.CRISIS_STRATEGIES[strategyKey] || this.CRISIS_STRATEGIES.PUBLIC_APOLOGY;
      if((g.studio.cash || 0) < strat.cost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("overhead", strat.cost);
      else g.studio.cash -= strat.cost;

      g.studio.rep = Math.min(99, (g.studio.rep || 50) + strat.repRestore);

      let resolvedHeadline = "Active studio controversy";
      if(g.scandals && g.scandals.length){
        const idx = (typeof optScandalIdx === "number" && g.scandals[optScandalIdx]) ? optScandalIdx : 0;
        resolvedHeadline = g.scandals[idx].headline || resolvedHeadline;
        g.scandals.splice(idx, 1);
      }

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("CRISIS MITIGATED [" + strat.name + "]: " + resolvedHeadline + " neutralized (-" + fmtMFn(strat.cost) + "). Prestige +" + strat.repRestore + " pts (" + Math.round(strat.mitigation * 100) + "% mitigation).", "good");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    resolveCrisis(actionId, optState){
      // Support legacy actionId or new strategyKey
      const map = {
        apology_tour: "PUBLIC_APOLOGY",
        charity_grant: "PRESS_TOUR",
        nda_settlement: "SETTLEMENT_PAYOUT",
        spin_narrative: "LEGAL_ACTION"
      };
      const key = map[actionId] || actionId;
      return this.evaluateCrisisResolution(key, 0, optState);
    },

    submitFestival(filmId, festId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      const f = (g.films || []).find(x => x.id === filmId) || (g.projects || []).find(x => x.id === filmId);
      if(!f) return false;
      const fest = this.FESTIVALS.find(x => x.id === festId);
      if(!fest) return false;
      if((g.studio.cash || 0) < fest.entryCost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("marketing", fest.entryCost);
      else g.studio.cash -= fest.entryCost;

      const q = (f.quality && f.quality.overall) || 65;
      const roll = Math.random() * 100;
      const wonPrize = roll < (q * 0.65);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      if(wonPrize){
        g.studio.rep = Math.min(99, (g.studio.rep || 50) + 5);
        if(f.quality) f.quality.critic = Math.min(99, (f.quality.critic || 55) + 12);
        f.festivalWinner = fest.name;
        if(logFn){
          logFn("FESTIVAL TRIUMPH: \"" + f.title + "\" won the Grand Jury Prize at " + fest.name + "! Critical score +12, Studio Rep +5.", "gold");
        }
      } else {
        if(f.quality) f.quality.critic = Math.min(99, (f.quality.critic || 55) + 4);
        if(logFn){
          logFn("FESTIVAL SCREENING: \"" + f.title + "\" received warm applause at " + fest.name + " (+4 critical score).", "good");
        }
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    }
  };

  global.BOW_FESTIVAL_PR = BOW_FESTIVAL_PR;

  // Dedicated Crisis PR War Room modal (Box Office Inc parity)
  global.openCrisisPrModal = function(){
    const g = BOW_FESTIVAL_PR._getG();
    if(!g) return;
    const activeScandals = g.scandals || [];
    const weeklyDrain = BOW_FESTIVAL_PR.calculateWeeklyReputationImpact(g);
    const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");

    let h = "<h3>🚨 Studio Crisis PR Management & War Room</h3>";
    h += "<p class='tiny muted'>Deploy rapid countermeasures against Hollywood media scandals, leak controversies, and public boycotts to protect studio valuation and release momentum.</p>";

    h += "<div class='card' style='margin-bottom:12px;background:rgba(255,50,50,0.06);border-left:4px solid var(--red)'>";
    h += "<div class='row' style='justify-content:space-between;align-items:center'>";
    h += "<div><b>Active Crisis Level:</b> <span class='tag " + (activeScandals.length ? "red" : "green") + "'>" + activeScandals.length + " Unresolved Emergencies</span></div>";
    h += "<div><b>Weekly Prestige Drain:</b> <b class='neg'>" + (weeklyDrain > 0 ? "-" + weeklyDrain + " pts/wk" : "0 pts/wk") + "</b></div>";
    h += "</div></div>";

    if(!activeScandals.length){
      h += "<div class='card text-center' style='padding:24px 16px'>";
      h += "<div style='font-size:2rem;margin-bottom:8px'>🛡️</div>";
      h += "<b>All Clear on the Studio Lot</b>";
      h += "<p class='tiny muted' style='margin-top:4px'>No active talent scandals, production walkouts, or media boycotts currently threatening studio operations.</p>";
      h += "</div>";
    } else {
      activeScandals.forEach((scandal, sIdx) => {
        h += "<div class='card' style='margin-bottom:12px'>";
        h += "<div class='row' style='justify-content:space-between'>";
        h += "<b class='neg'>[INCIDENT #" + (sIdx+1) + "] " + (scandal.headline || "Controversy Leaked to Press") + "</b>";
        h += "<span class='tag red'>Severity " + (scandal.severity || 1) + "/3</span>";
        h += "</div>";
        h += "<div class='tiny muted' style='margin:6px 0'>" + (scandal.detail || "Media outlets and trade magazines are reporting damaging allegations. Audience sentiment is declining.") + "</div>";
        h += "<div class='small' style='margin:10px 0 6px 0'><b>Select PR Mitigation Strategy:</b></div>";
        h += "<div class='grid g2' style='gap:8px'>";
        Object.keys(BOW_FESTIVAL_PR.CRISIS_STRATEGIES).forEach(sKey => {
          const strat = BOW_FESTIVAL_PR.CRISIS_STRATEGIES[sKey];
          const canAfford = (g.studio.cash || 0) >= strat.cost;
          h += "<div class='card card-sub' style='padding:8px'>";
          h += "<div class='row' style='justify-content:space-between'><b>" + strat.name + "</b><span class='gold'>" + fmtMFn(strat.cost) + "</span></div>";
          h += "<div class='tiny muted' style='margin:4px 0'>" + strat.desc + "</div>";
          h += "<div class='tiny green' style='margin-bottom:6px'>Mitigation: " + Math.round(strat.mitigation*100) + "% · Prestige +" + strat.repRestore + "</div>";
          h += "<button class='btn btn-xs " + (canAfford ? "btn-primary" : "btn-disabled") + "' data-strat='" + sKey + "' data-sidx='" + sIdx + "' style='width:100%'>" +
               (canAfford ? "Deploy " + strat.name : "Insufficient Cash") + "</button>";
          h += "</div>";
        });
        h += "</div></div>";
      });
    }

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    v.querySelectorAll("[data-strat]").forEach(btn => {
      btn.onclick = function(){
        const stratKey = btn.dataset.strat;
        const sIdx = parseInt(btn.dataset.sidx, 10);
        if(BOW_FESTIVAL_PR.evaluateCrisisResolution(stratKey, sIdx)){
          if(typeof global.beep === "function") global.beep("good");
          if(typeof global.render === "function") global.render();
          global.openCrisisPrModal();
        }
      };
    });
  };

  // Film Festival circuit modal
  global.openFestivalPrModal = function(){
    const g = BOW_FESTIVAL_PR._getG();
    if(!g) return;
    const candidates = (g.projects || []).filter(p => p.phase === "ready").concat((g.films || []).slice(-4));
    const activeScandals = g.scandals || [];

    let h = "<h3>Film Festival Circuit & Premieres</h3>";
    h += "<p class='tiny muted'>Premier prestige pictures on global festival circuits to capture Grand Jury honors, Oscar buzz precursors, and international critical acclaim.</p>";

    if(activeScandals.length){
      h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--red)'>";
      h += "<div class='row' style='justify-content:space-between;align-items:center'>";
      h += "<div><b class='neg'>[CRISIS] " + activeScandals.length + " Active Scandal Alert(s)</b><div class='tiny muted'>" + activeScandals[0].headline + "</div></div>";
      h += "<button class='btn btn-sm btn-alt' id='btnGoCrisisDesk'>Open PR War Room</button>";
      h += "</div></div>";
    }

    h += "<div class='small' style='margin-bottom:6px'><b>Submit Pictures to Festival Circuit:</b></div>";
    h += "<div class='grid g2' style='gap:8px'>";
    BOW_FESTIVAL_PR.FESTIVALS.forEach(fest => {
      h += "<div class='card'>";
      h += "<b>" + fest.name + "</b>";
      h += "<div class='tiny muted' style='margin:4px 0'>" + fest.desc + "</div>";
      h += "<div class='cost-line'><span>Entry Fee</span><b>$" + fest.entryCost + "M</b></div>";
      if(candidates.length){
        h += "<button class='btn btn-sm btn-primary' data-fest='" + fest.id + "' style='margin-top:8px;width:100%'>Submit Selection</button>";
      } else {
        h += "<div class='tiny muted' style='margin-top:8px'>No completed films currently ready for circuit submission.</div>";
      }
      h += "</div>";
    });
    h += "</div>";

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    const btnCrisis = v.querySelector("#btnGoCrisisDesk");
    if(btnCrisis){
      btnCrisis.onclick = function(){
        global.openCrisisPrModal();
      };
    }

    v.querySelectorAll("[data-fest]").forEach(b => {
      b.onclick = function(){
        const fid = b.dataset.fest;
        const pick = prompt("Enter number of film to submit:\n" +
          candidates.map((c, idx) => (idx+1) + ". " + c.title).join("\n"));
        if(pick && candidates[parseInt(pick,10)-1]){
          const film = candidates[parseInt(pick,10)-1];
          if(BOW_FESTIVAL_PR.submitFestival(film.id, fid)){
            if(typeof global.beep === "function") global.beep("gold");
            if(typeof global.render === "function") global.render();
            global.openFestivalPrModal();
          }
        }
      };
    });
  };

})(typeof window !== "undefined" ? window : global);
