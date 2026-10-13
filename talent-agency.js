/* ═════════════════════════════════════════════════════════════════════════
   TALENT-AGENCY.JS — Talent Agency Ownership & Client Packaging System
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_AGENCY = {
    version: "1.0.0",

    FOUNDING_COST: 90,
    REQUIRED_REP: 45,

    init(state){
      if(!state) return;
      state.myAgency = state.myAgency || {
        founded: false,
        name: "Titan Talent Partners",
        foundedWeek: 0,
        roster: [], // Talent IDs signed to your agency
        level: 1,
        totalCommissions: 0,
        weeklyCommission: 0,
        prestige: 60
      };
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    canFoundAgency(optState){
      const g = this._getG(optState);
      if(!g || !g.studio) return false;
      this.init(g);
      if(g.myAgency.founded) return false;
      return g.studio.cash >= this.FOUNDING_COST && g.studio.rep >= this.REQUIRED_REP;
    },

    foundAgency(agencyName, optState){
      const g = this._getG(optState);
      if(!g || !this.canFoundAgency(g)) return false;
      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("studio", this.FOUNDING_COST);
      else g.studio.cash -= this.FOUNDING_COST;

      g.myAgency.founded = true;
      g.myAgency.name = (agencyName && agencyName.trim()) || (g.studio.name + " Representation");
      g.myAgency.foundedWeek = g.week;

      // Automatically sign 2 promising talents to seed the roster
      const available = (g.talent || []).filter(t => !t.retired && !t.bookedUntil);
      if(available.length){
        const seeds = available.slice(0, 3);
        seeds.forEach(t => {
          t.agency = "player_agency";
          g.myAgency.roster.push(t.id);
        });
      }

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("TALENT AGENCY FOUNDED: Launched " + g.myAgency.name + " (-" + fmtMFn(this.FOUNDING_COST) + "). Now signing talent and earning packaging commissions.", "gold");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    signTalent(talentId, optState){
      const g = this._getG(optState);
      if(!g || !g.myAgency || !g.myAgency.founded) return false;
      const t = (g.talent || []).find(x => x.id === talentId);
      if(!t || t.retired) return false;
      if(g.myAgency.roster.includes(t.id)) return false;

      // Signing bonus = 35% of their fee
      const feeFn = (typeof actorFee === "function") ? actorFee : ((typeof global !== "undefined" && typeof global.actorFee === "function") ? global.actorFee : () => 4.0);
      const fee = feeFn(t);
      const signCost = Math.round(fee * 0.35 * 10) / 10;
      if((g.studio.cash || 0) < signCost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("studio", signCost);
      else g.studio.cash -= signCost;

      t.agency = "player_agency";
      g.myAgency.roster.push(t.id);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("Signed " + t.name + " (" + t.power + " Star " + t.kind + ") to " + g.myAgency.name + " representation (-" + fmtMFn(signCost) + ").", "good");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    // Weekly commissions tick when rivals book your agency's talent
    tickWeekly(state){
      this.init(state);
      const ag = state.myAgency;
      if(!ag.founded || !ag.roster.length) return 0;

      let weeklyComm = 0;
      const signedTalents = (state.talent || []).filter(t => ag.roster.includes(t.id) && !t.retired);

      signedTalents.forEach(t => {
        // Talent booked on outside productions or rival slates earns 10% agency commission
        if(t.bookedUntil && t.bookedUntil > state.week){
          const fee = (typeof global.actorFee === "function" ? global.actorFee(t) : 3.0);
          const comm = Math.round((fee * 0.10 / 12) * 100) / 100;
          weeklyComm += comm;
        } else if(Math.random() < 0.25) {
          // Commercial endorsements / guest spots
          weeklyComm += 0.05 * (t.power || 3);
        }
      });

      ag.weeklyCommission = Math.round(weeklyComm * 10) / 10;
      ag.totalCommissions += ag.weeklyCommission;

      if(ag.weeklyCommission >= 0.05){
        if(typeof global.earn === "function") global.earn("merch", ag.weeklyCommission);
        else state.studio.cash += ag.weeklyCommission;
      }
      return ag.weeklyCommission;
    }
  };

  global.BOW_AGENCY = BOW_AGENCY;

  // Global modal for Talent Agency
  global.openTalentAgencyModal = function(){
    const g = BOW_AGENCY._getG();
    if(!g) return;
    BOW_AGENCY.init(g);
    const ag = g.myAgency;

    let h = "<h3>Talent Agency Ownership</h3>";
    h += "<p class='tiny muted'>Build your own representation powerhouse. Assemble agency packaging deals for zero packaging fees and earn 10% commissions when rivals hire your stars.</p>";

    if(!ag.founded){
      const canFound = BOW_AGENCY.canFoundAgency(g);
      h += "<div class='card' style='border-left:3px solid var(--gold2)'>";
      h += "<b>Found an Agency Division</b>";
      h += "<div class='cost-line'><span>Capital Investment</span><b>$" + BOW_AGENCY.FOUNDING_COST + "M</b></div>";
      h += "<div class='cost-line'><span>Reputation Requirement</span><b>" + BOW_AGENCY.REQUIRED_REP + "/100</b></div>";
      h += "<div class='tiny muted' style='margin:6px 0'>Enter the two-sided talent market. Compete directly against Meridian, Crown, and Sterling.</div>";
      h += "<button class='btn btn-sm " + (canFound ? "btn-primary" : "btn-disabled") + "' id='btnFoundAgency' style='margin-top:8px;width:100%'>" + (canFound ? "Found Agency ($" + BOW_AGENCY.FOUNDING_COST + "M)" : "Requires $" + BOW_AGENCY.FOUNDING_COST + "M & Rep >= " + BOW_AGENCY.REQUIRED_REP) + "</button>";
      h += "</div>";
    } else {
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--gold2)'>";
      h += "<div class='spread'><b>" + ag.name + "</b><span class='pos'>Commissions: +" + fmtMFn(ag.weeklyCommission || 0) + "/wk</span></div>";
      h += "<div class='cost-line'><span>Clients Signed</span><b>" + ag.roster.length + " stars</b></div>";
      h += "<div class='cost-line'><span>Lifetime Commissions</span><b>" + fmtMFn(ag.totalCommissions || 0) + "</b></div>";
      h += "</div>";

      h += "<div class='small' style='margin-bottom:6px'><b>Sign Available Talent to Your Roster:</b></div>";
      const unsigned = (g.talent || []).filter(t => !t.retired && t.agency !== "player_agency").slice(0, 8);
      h += "<div class='card' style='max-height:180px;overflow-y:auto'>";
      unsigned.forEach(t => {
        const feeFn = (typeof actorFee === "function") ? actorFee : ((typeof global !== "undefined" && typeof global.actorFee === "function") ? global.actorFee : () => 4.0);
        const fee = feeFn(t);
        const signCost = Math.round(fee * 0.35 * 10) / 10;
        h += "<div class='spread' style='font-size:12px;padding:4px 0'>";
        h += "<span><b>" + t.name + "</b> (" + t.power + " Star " + t.kind + ")</span>";
        h += "<button class='btn btn-xs btn-alt' data-signtalent='" + t.id + "'>Sign ($" + signCost + "M)</button>";
        h += "</div>";
      });
      h += "</div>";

      if(ag.roster.length){
        h += "<div class='small' style='margin:12px 0 6px'><b>Your Client Roster:</b></div>";
        const myClients = (g.talent || []).filter(t => ag.roster.includes(t.id));
        h += "<div class='card' style='max-height:140px;overflow-y:auto'>";
        myClients.forEach(t => {
          h += "<div class='spread' style='font-size:12px;padding:3px 0'>";
          h += "<span><b>" + t.name + "</b> (" + t.kind + ")</span>";
          h += "<span class='tiny muted'>" + (t.bookedUntil > g.week ? "On shoot until W" + t.bookedUntil : "Available") + "</span>";
          h += "</div>";
        });
        h += "</div>";
      }
    }

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    const bFound = v.querySelector("#btnFoundAgency");
    if(bFound) bFound.onclick = function(){
      const agName = prompt("Name your talent agency:", (global.G.studio.name || "Studio") + " Talent Agency");
      if(agName && BOW_AGENCY.foundAgency(agName)){
        if(typeof global.beep === "function") global.beep("gold");
        if(typeof global.render === "function") global.render();
        global.openTalentAgencyModal();
      }
    };

    v.querySelectorAll("[data-signtalent]").forEach(b => {
      b.onclick = function(){
        const tid = +b.dataset.signtalent;
        if(BOW_AGENCY.signTalent(tid)){
          if(typeof global.beep === "function") global.beep("click");
          if(typeof global.render === "function") global.render();
          global.openTalentAgencyModal();
        } else {
          if(typeof global.toast === "function") global.toast("Insufficient funds for signing bonus.", "bad");
        }
      };
    });
  };

})(typeof window !== "undefined" ? window : global);
