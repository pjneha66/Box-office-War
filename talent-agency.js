/* ═════════════════════════════════════════════════════════════════════════
   TALENT-AGENCY.JS — Talent Agency Ownership & Client Packaging System
   Box Office War — Modular Engine Extension
   (Synthesized with 100% parity to Box_Office_Inc talent-agency-packaging-system.md)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_AGENCY = {
    version: "2.0.0",

    FOUNDING_COST: 90,
    REQUIRED_REP: 45,

    // Premier Hollywood Talent Agencies (Box_Office_Inc parity)
    AGENCIES: [
      {
        id: "caa",
        name: "CAA (Creative Artists Agency)",
        prestige: 98,
        specialty: "A-List Tentpoles & Blockbuster Packages",
        desc: "Century City juggernaut controlling top-grossing directors and marquee movie stars.",
        bonusType: "blockbuster"
      },
      {
        id: "wme",
        name: "WME (William Morris Endeavor)",
        prestige: 94,
        specialty: "High-Concept Franchises & Global Stars",
        desc: "Beverly Hills powerhouse blending music, sports, and crossover screen idols.",
        bonusType: "crossover"
      },
      {
        id: "uta",
        name: "UTA (United Talent Agency)",
        prestige: 90,
        specialty: "Indie Darlings, Comedy & Sci-Fi Visionaries",
        desc: "Fast-moving agency known for packaging viral breakout comedies and high-ROI thrillers.",
        bonusType: "indie"
      },
      {
        id: "gersh",
        name: "The Gersh Agency",
        prestige: 86,
        specialty: "Character Actors & Auteur Precursors",
        desc: "Historic bi-coastal agency representing Oscar-nominated character craftspeople.",
        bonusType: "auteur"
      }
    ],

    PACKAGES: [
      {
        id: "auteur_package",
        name: "Auteur Prestige Package",
        agency: "gersh",
        desc: "Festival-winning Director + Method Lead Actor + Award-Winning Screenwriter.",
        baseCost: 22.0,
        qualityBoost: 16,
        repBoost: 4,
        chemistryBonus: 18
      },
      {
        id: "blockbuster_package",
        name: "Blockbuster Powerhouse Package",
        agency: "caa",
        desc: "High-Octane Action Director + A-List Magnet Superstar + Top VFX Supervisor.",
        baseCost: 38.0,
        qualityBoost: 22,
        repBoost: 6,
        chemistryBonus: 22
      },
      {
        id: "indie_breakout",
        name: "Indie Festival Breakout Package",
        agency: "uta",
        desc: "Breakthrough Sundance Director + Rising Star Lead + Acclaimed Screenwriter.",
        baseCost: 14.0,
        qualityBoost: 14,
        repBoost: 3,
        chemistryBonus: 15
      }
    ],

    init(state){
      if(!state) return;
      state.myAgency = state.myAgency || {
        founded: false,
        name: "Titan Talent Partners",
        foundedWeek: 0,
        roster: [],
        level: 1,
        totalCommissions: 0,
        weeklyCommission: 0,
        prestige: 60
      };

      // Agency relations dictionary (0-100 standing)
      state.agencyRelations = state.agencyRelations || {
        caa: 65,
        wme: 60,
        uta: 70,
        gersh: 75
      };
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    getAgencyTier(agencyId, optState){
      const g = this._getG(optState);
      this.init(g);
      const score = (g && g.agencyRelations && g.agencyRelations[agencyId]) || 50;
      if(score >= 80) return { tier: "PREFERRED", discount: 0.25, badge: "Preferred (25% Off)", cls: "gold" };
      if(score >= 40) return { tier: "STANDARD", discount: 0.00, badge: "Standard Terms", cls: "blue" };
      return { tier: "RESTRICTED", discount: -0.20, badge: "Restricted (+20% Surcharge)", cls: "red" };
    },

    improveAgencyStanding(agencyId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      this.init(g);
      const retainerCost = 2.0; // $2M agency retainer
      if((g.studio.cash || 0) < retainerCost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("overhead", retainerCost);
      else g.studio.cash -= retainerCost;

      g.agencyRelations[agencyId] = Math.min(100, (g.agencyRelations[agencyId] || 50) + 15);
      const ag = this.AGENCIES.find(a => a.id === agencyId) || { name: agencyId.toUpperCase() };

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      if(logFn){
        logFn("🤝 AGENCY RELATIONS: Sent executive retainer to " + ag.name + " (-$2M). Standing increased to " + g.agencyRelations[agencyId] + "/100.", "good");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    signAgencyPackage(pkgId, optProjectId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      this.init(g);
      const pkg = this.PACKAGES.find(p => p.id === pkgId);
      if(!pkg) return false;

      const tierInfo = this.getAgencyTier(pkg.agency, g);
      const finalCost = Math.round((pkg.baseCost * (1 - tierInfo.discount)) * 10) / 10;
      if((g.studio.cash || 0) < finalCost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("production", finalCost);
      else g.studio.cash -= finalCost;

      // Improve relationship with agency upon signing
      g.agencyRelations[pkg.agency] = Math.min(100, (g.agencyRelations[pkg.agency] || 50) + 5);

      // Attach to project if specified, or boost active in-dev slate
      let targetProj = (g.projects || []).find(p => p.id === optProjectId) || (g.projects || []).find(p => p.phase === "dev" || p.phase === "pre");
      if(targetProj){
        targetProj.packageApplied = pkg.name;
        targetProj.quality = targetProj.quality || { overall: 65, craft: 65, script: 65 };
        targetProj.quality.overall = Math.min(99, targetProj.quality.overall + pkg.qualityBoost);
        targetProj.chemistryBonus = (targetProj.chemistryBonus || 0) + pkg.chemistryBonus;
      }

      g.studio.rep = Math.min(99, (g.studio.rep || 50) + pkg.repBoost);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
      if(logFn){
        logFn("📦 TALENT PACKAGE SIGNED: Contracted " + pkg.name + " (-" + fmtMFn(finalCost) + "). " + (targetProj ? "Attached to \"" + targetProj.title + "\" (+ " + pkg.qualityBoost + " quality, +" + pkg.chemistryBonus + "% chemistry)." : "Talent pool enhanced."), "gold");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
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
      const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
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
      const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
      if(logFn){
        logFn("Signed " + t.name + " (" + t.power + " Star " + t.kind + ") to " + g.myAgency.name + " representation (-" + fmtMFn(signCost) + ").", "good");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    tickWeeklyCommissions(optState){
      const g = this._getG(optState);
      if(!g || !g.myAgency || !g.myAgency.founded) return;
      this.init(g);

      let weeklyComm = 0;
      const feeFn = (typeof actorFee === "function") ? actorFee : ((typeof global !== "undefined" && typeof global.actorFee === "function") ? global.actorFee : () => 4.0);
      const rosterTalent = (g.talent || []).filter(t => g.myAgency.roster.includes(t.id));

      rosterTalent.forEach(t => {
        if(t.bookedUntil && t.bookedUntil > g.week){
          const fee = feeFn(t);
          weeklyComm += (fee * 0.10) / 8; // 10% agency packaging commission over shoot
        }
      });

      weeklyComm = Math.round(weeklyComm * 10) / 10;
      g.myAgency.weeklyCommission = weeklyComm;
      if(weeklyComm > 0){
        g.myAgency.totalCommissions += weeklyComm;
        if(typeof earn === "function") earn("other", weeklyComm);
        else g.studio.cash += weeklyComm;
      }
    },

    tickWeekly(optState){
      return this.tickWeeklyCommissions(optState);
    }
  };

  global.BOW_AGENCY = BOW_AGENCY;

  // Dedicated Talent Agency Packaging Modal (Box Office Inc parity)
  global.openAgencyPackagingModal = function(){
    const g = BOW_AGENCY._getG();
    if(!g) return;
    BOW_AGENCY.init(g);
    const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
    const devProjects = (g.projects || []).filter(p => p.phase === "dev" || p.phase === "pre");

    let h = "<h3>💼 Hollywood Talent Agency Packaging & Relations</h3>";
    h += "<p class='tiny muted'>Partner with Hollywood's premier talent agencies (CAA, WME, UTA, Gersh) to sign pre-bundled packages of Directors, Marquee Stars, and Screenwriters at volume discounts.</p>";

    // Agency Standing Dashboard
    h += "<div class='small' style='margin-bottom:6px'><b>Agency Relationship Standing:</b></div>";
    h += "<div class='grid g2' style='gap:8px;margin-bottom:14px'>";
    BOW_AGENCY.AGENCIES.forEach(ag => {
      const score = (g.agencyRelations && g.agencyRelations[ag.id]) || 50;
      const tier = BOW_AGENCY.getAgencyTier(ag.id, g);
      h += "<div class='card' style='padding:10px'>";
      h += "<div class='row' style='justify-content:space-between;align-items:center'><b>" + ag.name + "</b><span class='tag " + tier.cls + "'>" + tier.badge + "</span></div>";
      h += "<div class='tiny muted' style='margin:4px 0'>" + ag.specialty + "</div>";
      h += "<div class='cost-line'><span>Relationship Score</span><b>" + score + "/100</b></div>";
      h += "<button class='btn btn-xs btn-alt' data-retainer='" + ag.id + "' style='margin-top:6px;width:100%'>Send Retainer (-$2.0M for +15 Standing)</button>";
      h += "</div>";
    });
    h += "</div>";

    // Pre-packaged Bundles
    h += "<div class='small' style='margin-bottom:6px'><b>Available Pre-Packaged Bundles:</b></div>";
    h += "<div class='grid g3' style='gap:8px'>";
    BOW_AGENCY.PACKAGES.forEach(pkg => {
      const ag = BOW_AGENCY.AGENCIES.find(a => a.id === pkg.agency);
      const tier = BOW_AGENCY.getAgencyTier(pkg.agency, g);
      const cost = Math.round((pkg.baseCost * (1 - tier.discount)) * 10) / 10;
      const canAfford = (g.studio.cash || 0) >= cost;

      h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>";
      h += "<div>";
      h += "<b>" + pkg.name + "</b>";
      h += "<div class='tiny gold' style='margin:2px 0'>" + (ag ? ag.name : "Agency") + " · " + tier.badge + "</div>";
      h += "<div class='tiny muted' style='margin:6px 0'>" + pkg.desc + "</div>";
      h += "<div class='tiny green'>Quality +" + pkg.qualityBoost + " · Chemistry +" + pkg.chemistryBonus + "% · Rep +" + pkg.repBoost + "</div>";
      h += "</div>";
      h += "<div style='margin-top:10px'>";
      h += "<div class='cost-line'><span>Package Fee</span><b class='gold'>" + fmtMFn(cost) + "</b></div>";
      h += "<button class='btn btn-sm " + (canAfford ? "btn-primary" : "btn-disabled") + "' data-pkg='" + pkg.id + "' style='width:100%;margin-top:6px'>" +
           (canAfford ? "Contract Package" : "Insufficient Cash") + "</button>";
      h += "</div></div>";
    });
    h += "</div>";

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    v.querySelectorAll("[data-retainer]").forEach(btn => {
      btn.onclick = function(){
        const agId = btn.dataset.retainer;
        if(BOW_AGENCY.improveAgencyStanding(agId)){
          if(typeof global.beep === "function") global.beep("good");
          if(typeof global.render === "function") global.render();
          global.openAgencyPackagingModal();
        }
      };
    });

    v.querySelectorAll("[data-pkg]").forEach(btn => {
      btn.onclick = function(){
        const pkgId = btn.dataset.pkg;
        let projId = null;
        if(devProjects.length){
          const pick = prompt("Attach package to which in-development project?\n" +
            devProjects.map((p, idx) => (idx+1) + ". " + p.title + " (" + p.phase + ")").join("\n") + "\n(Or press OK/Enter to attach to first ready)");
          if(pick && devProjects[parseInt(pick,10)-1]){
            projId = devProjects[parseInt(pick,10)-1].id;
          } else {
            projId = devProjects[0].id;
          }
        }
        if(BOW_AGENCY.signAgencyPackage(pkgId, projId)){
          if(typeof global.beep === "function") global.beep("gold");
          if(typeof global.render === "function") global.render();
          global.openAgencyPackagingModal();
        }
      };
    });
  };

  // Legacy Talent Agency Ownership modal
  global.openTalentAgencyModal = function(){
    const g = BOW_AGENCY._getG();
    if(!g) return;
    BOW_AGENCY.init(g);
    const ag = g.myAgency;
    const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");

    let h = "<h3>🎭 Talent Agency Ownership & Roster</h3>";
    h += "<p class='tiny muted'>Manage your in-house talent agency branch, represent A-list talent, and earn recurring 10% packaging commissions on external and studio productions.</p>";

    h += "<div style='margin-bottom:12px'><button class='btn btn-sm btn-alt' id='btnGoPackagingDesk'>Go to Agency Packaging System (CAA/WME/UTA/Gersh)</button></div>";

    if(!ag.founded){
      h += "<div class='card' style='text-align:center;padding:24px 16px'>";
      h += "<b>Found Your Studio's Talent Agency</b>";
      h += "<p class='tiny muted' style='margin:8px 0'>Establish an internal talent representation branch to sign exclusive clients and collect lucrative 10% packaging commissions.</p>";
      h += "<div class='cost-line'><span>Founding Capital Required</span><b>$" + BOW_AGENCY.FOUNDING_COST + "M</b></div>";
      h += "<div class='cost-line'><span>Minimum Studio Prestige</span><b>" + BOW_AGENCY.REQUIRED_REP + "/100</b></div>";
      const canFound = BOW_AGENCY.canFoundAgency(g);
      h += "<button class='btn btn-sm " + (canFound ? "btn-primary" : "btn-disabled") + "' id='btnFoundAgency' style='margin-top:12px'>" +
           (canFound ? "Found Talent Agency" : "Requirements Not Met") + "</button>";
      h += "</div>";
    } else {
      h += "<div class='card' style='margin-bottom:12px'>";
      h += "<div class='row' style='justify-content:space-between'><b>" + ag.name + "</b><span class='gold'>Level " + ag.level + "</span></div>";
      h += "<div class='row' style='margin-top:8px'>";
      h += "<div class='stat-card'><span>Signed Roster</span><b>" + ag.roster.length + " clients</b></div>";
      h += "<div class='stat-card'><span>Weekly Commissions</span><b>" + fmtMFn(ag.weeklyCommission || 0) + "/wk</b></div>";
      h += "<div class='stat-card'><span>Total Commissions Banked</span><b>" + fmtMFn(ag.totalCommissions || 0) + "</b></div>";
      h += "</div></div>";

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

    const bPack = v.querySelector("#btnGoPackagingDesk");
    if(bPack){
      bPack.onclick = function(){
        global.openAgencyPackagingModal();
      };
    }

    const bFound = v.querySelector("#btnFoundAgency");
    if(bFound) bFound.onclick = function(){
      const agName = prompt("Name your talent agency:", (global.G.studio.name || "Studio") + " Talent Agency");
      if(agName && BOW_AGENCY.foundAgency(agName)){
        if(typeof global.beep === "function") global.beep("gold");
        if(typeof global.render === "function") global.render();
        global.openTalentAgencyModal();
      }
    };
  };

})(typeof window !== "undefined" ? window : global);
