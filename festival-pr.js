/* ═════════════════════════════════════════════════════════════════════════
   FESTIVAL-PR.JS — Film Festival Circuit & Crisis PR Management System
   Box Office War — Modular Engine Extension
   (Synthesized from Box_Office_Inc and Cinema Simulator architectures)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_FESTIVAL_PR = {
    version: "1.0.0",

    FESTIVALS: [
      { id: "palais", name: "Palais d'Or (Cannes Tier)", seasonWeek: 20, entryCost: 1.5, prestige: 95, desc: "The premier international auteur showcase. Huge critical buzz and Golden Palm honors." },
      { id: "snowpeak", name: "Snowpeak Independent (Sundance Tier)", seasonWeek: 4, entryCost: 0.6, prestige: 85, desc: "Indie discovery launchpad. High buyer bidding and cult acclaim." },
      { id: "lido", name: "Lido International (Venice Tier)", seasonWeek: 36, entryCost: 1.2, prestige: 90, desc: "Autumn awards frontrunner circuit. Golden Lion pedigree and Oscar precursor traction." }
    ],

    PR_ACTIONS: {
      apology_tour: { name: "Public Apology Tour", cost: 1.2, repRestore: 6, desc: "Orchestrated late-night and magazine apology tour." },
      charity_grant: { name: "Philanthropic Foundation Grant", cost: 3.5, repRestore: 12, desc: "Headline-grabbing charitable foundation donation." },
      nda_settlement: { name: "Discreet Legal Settlement & NDA", cost: 5.0, repRestore: 15, desc: "Swift legal settlement with strict confidentiality." },
      spin_narrative: { name: "Narrative Reframing Campaign", cost: 2.0, repRestore: 8, desc: "Counter-leaks and defensive social media reframing." }
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
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

      // Acceptance and award chance based on quality and director skill
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
    },

    resolveCrisis(actionId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      const act = this.PR_ACTIONS[actionId];
      if(!act) return false;
      if((g.studio.cash || 0) < act.cost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("overhead", act.cost);
      else g.studio.cash -= act.cost;

      g.studio.rep = Math.min(99, (g.studio.rep || 50) + act.repRestore);
      if(g.scandals && g.scandals.length){
        g.scandals.shift(); // Clear active scandal
      }

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("CRISIS MITIGATED: Executed " + act.name + " (-" + fmtMFn(act.cost) + "). Studio Reputation +" + act.repRestore + ".", "good");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    }
  };

  global.BOW_FESTIVAL_PR = BOW_FESTIVAL_PR;

  // Global modal for Festivals & Crisis PR
  global.openFestivalPrModal = function(){
    const g = BOW_FESTIVAL_PR._getG();
    if(!g) return;
    const candidates = (g.projects || []).filter(p => p.phase === "ready").concat((g.films || []).slice(-4));
    const activeScandals = g.scandals || [];

    let h = "<h3>Film Festival Circuit & Crisis PR Desk</h3>";
    h += "<p class='tiny muted'>Premier prestige pictures on global festival circuits and deploy strategic PR crisis countermeasures when scandals strike.</p>";

    if(activeScandals.length){
      h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--red)'>";
      h += "<b class='neg'>[CRISIS] Active Studio / Talent Scandal Alert</b>";
      h += "<div class='tiny muted' style='margin:4px 0'>" + activeScandals[0].headline + "</div>";
      h += "<div class='small' style='margin-top:8px'><b>Select Crisis Countermeasure:</b></div><div class='grid g2' style='gap:6px;margin-top:4px'>";
      Object.keys(BOW_FESTIVAL_PR.PR_ACTIONS).forEach(aid => {
        const a = BOW_FESTIVAL_PR.PR_ACTIONS[aid];
        const canDo = (g.studio.cash || 0) >= a.cost;
        h += "<button class='btn btn-xs " + (canDo ? "btn-alt" : "btn-disabled") + "' data-crisis='" + aid + "'>" + a.name + " ($" + a.cost + "M)</button>";
      });
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

    v.querySelectorAll("[data-crisis]").forEach(b => {
      b.onclick = function(){
        const aid = b.dataset.crisis;
        if(BOW_FESTIVAL_PR.resolveCrisis(aid)){
          if(typeof global.beep === "function") global.beep("good");
          if(typeof global.render === "function") global.render();
          global.openFestivalPrModal();
        }
      };
    });

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
