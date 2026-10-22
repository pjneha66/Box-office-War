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

  /* Story Department tools share the command shell: a header, numbered
     groups and flat controls. No legacy cards, no inline styles. */
  function deskEsc(v){ return (typeof esc === "function") ? esc(String(v==null?"":v)) : String(v==null?"":v); }
  function deskShell(opts){
    return `<div class="pitch-shell desk-shell">
      <header class="pitch-head"><div><span class="command-eyebrow">${opts.eyebrow}</span><h3>${opts.title}</h3><p>${opts.sub}</p></div>${opts.badge||""}</header>
      <div class="pitch-body solo"><section class="pitch-main">${opts.body}</section></div>
      <footer class="pitch-actions">${opts.actions||""}</footer>
    </div>`;
  }
  function deskGroup(label,desc,body){ return `<section class="pitch-group"><header><span class="command-eyebrow">${label}</span>${desc?`<p>${desc}</p>`:""}</header>${body}</section>`; }
  function deskStat(label,value,note,cls){ return `<div class="pitch-stat${cls?" "+cls:""}"><small>${label}</small><b>${value}</b>${note?`<em>${note}</em>`:""}</div>`; }
  function deskLine(label,value,cls){ return `<div class="pitch-line"><span>${label}</span><b class="${cls||""}">${value}</b></div>`; }

  // Talent Agency Packaging desk (Box Office Inc parity)
  global.openAgencyPackagingModal = function(){
    const g = BOW_AGENCY._getG();
    if(!g) return;
    BOW_AGENCY.init(g);
    const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
    const devProjects = (g.projects || []).filter(p => p.phase === "dev" || p.phase === "pre");

    const standing = BOW_AGENCY.AGENCIES.map(ag => {
      const score = (g.agencyRelations && g.agencyRelations[ag.id]) || 50;
      const tier = BOW_AGENCY.getAgencyTier(ag.id, g);
      return `<div class="pitch-side-block">
        <span class="command-eyebrow">${deskEsc(ag.name)}</span>
        ${deskLine("Specialty", deskEsc(ag.specialty))}
        ${deskLine("Standing", score + "/100", score >= 70 ? "pos" : score < 40 ? "neg" : "")}
        ${deskLine("Access tier", deskEsc(tier.badge))}
        <button class="develop-ghost desk-wide" data-retainer="${ag.id}">Retainer · −$2.0M → +15 standing</button>
      </div>`;
    }).join("");

    const bundles = BOW_AGENCY.PACKAGES.map(pkg => {
      const ag = BOW_AGENCY.AGENCIES.find(a => a.id === pkg.agency);
      const tier = BOW_AGENCY.getAgencyTier(pkg.agency, g);
      const cost = Math.round((pkg.baseCost * (1 - tier.discount)) * 10) / 10;
      const canAfford = (g.studio.cash || 0) >= cost;
      return `<button class="pitch-chip${canAfford ? "" : " off"}" data-pkg="${pkg.id}" aria-pressed="false" ${canAfford ? "" : "disabled"}>
        <i>▤</i><span>${deskEsc(pkg.name)}</span>
        <small>${deskEsc(ag ? ag.name : "Agency")} · ${fmtMFn(cost)} · quality +${pkg.qualityBoost} · chemistry +${pkg.chemistryBonus}%</small>
      </button>`;
    }).join("");

    const html = deskShell({
      eyebrow:"STORY DEPARTMENT / TOOL · TALENT",
      title:"Agency packaging",
      sub:"Sign pre-bundled packages of directors, marquee stars and writers. A warmer agency relationship buys a bigger discount.",
      badge:`<div class="pitch-head-score"><small>BUNDLES</small><b>${BOW_AGENCY.PACKAGES.length}</b><span>on the desk</span></div>`,
      body: deskGroup("RELATIONSHIP STANDING","Standing sets the discount tier. A retainer costs $2.0M and buys +15 standing.",
          `<div class="desk-grid">${standing}</div>`)
        + deskGroup("PRE-PACKAGED BUNDLES","Each package attaches to a picture already in development and lifts quality, chemistry and reputation.",
          `<div class="pitch-chips">${bundles}</div>`
          + `<div class="pitch-note">${devProjects.length ? devProjects.length + " picture(s) in development can take a package now." : "Nothing is in development — greenlight a picture first, then package it."}</div>`),
      actions:`<button class="develop-ghost" id="pkgClose">Close</button>`
    });

    const v = (typeof global.openModal === "function") ? global.openModal(html,{className:"command-pitch-modal command-agency-modal"}) : null;
    if(!v) return;
    const close = v.querySelector("#pkgClose"); if(close) close.onclick = () => { if(typeof global.closeModal === "function") global.closeModal(); };

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
          if(pick && devProjects[parseInt(pick,10)-1]) projId = devProjects[parseInt(pick,10)-1].id;
          else projId = devProjects[0].id;
        }
        if(BOW_AGENCY.signAgencyPackage(pkgId, projId)){
          if(typeof global.beep === "function") global.beep("gold");
          if(typeof global.render === "function") global.render();
          global.openAgencyPackagingModal();
        }
      };
    });
  };

  // Talent Agency ownership desk
  global.openTalentAgencyModal = function(){
    const g = BOW_AGENCY._getG();
    if(!g) return;
    BOW_AGENCY.init(g);
    const ag = g.myAgency;
    const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
    let body = "";

    if(!ag.founded){
      const canFound = BOW_AGENCY.canFoundAgency(g);
      body = deskGroup("FOUND THE AGENCY","An in-house branch represents your clients and collects a 10% packaging commission on every picture they board.",
          `<div class="pitch-grid4" data-kpi="founding">
             ${deskStat("FOUNDING CAPITAL","$"+BOW_AGENCY.FOUNDING_COST+"M","one-off")}
             ${deskStat("MINIMUM STANDING",BOW_AGENCY.REQUIRED_REP+"/100",(g.studio.rep||0)+"/100 today",(g.studio.rep||0)>=BOW_AGENCY.REQUIRED_REP?"good":"bad")}
             ${deskStat("COMMISSION","10%","of every package")}
             ${deskStat("STATUS",canFound?"READY":"LOCKED",canFound?"requirements met":"meet the standing first",canFound?"good":"bad")}
           </div>
           <input id="agencyName" class="pitch-input" type="text" maxlength="40" value="${deskEsc((g.studio.name||"Studio")+" Talent Agency")}" aria-label="Agency name">
           <div class="pitch-inline-note"><span>Name the branch, then found it.</span></div>`)
        + `<div class="pitch-warnings" hidden></div>`;
    } else {
      const clients = (g.talent || []).filter(t => ag.roster.includes(t.id));
      body = deskGroup("THE AGENCY","Your in-house representation branch and what it earns.",
          `<div class="pitch-grid4">
             ${deskStat("AGENCY",deskEsc(ag.name),"level "+ag.level)}
             ${deskStat("SIGNED ROSTER",ag.roster.length,"clients")}
             ${deskStat("WEEKLY COMMISSION",fmtMFn(ag.weeklyCommission||0),"per week")}
             ${deskStat("TOTAL BANKED",fmtMFn(ag.totalCommissions||0),"to date")}
           </div>`)
        + deskGroup("CLIENT ROSTER",clients.length?"Everyone the agency represents right now.":"No clients signed yet — packages and deals add them.",
          clients.length
            ? `<div class="pitch-pick-list desk-roster">${clients.map(t=>`<div class="pitch-pick desk-roster-row"><span class="cast-pick-main"><b>${deskEsc(t.name)}</b><small>${deskEsc(t.kind||"talent")}</small></span><span class="cast-pick-state">${t.bookedUntil>g.week?"ON SHOOT · W"+t.bookedUntil:"AVAILABLE"}</span></div>`).join("")}</div>`
            : `<div class="command-empty"><b>No clients on the books.</b><small>Sign a package at the packaging desk to seed the roster.</small></div>`);
    }

    const html = deskShell({
      eyebrow:"STORY DEPARTMENT / TOOL · AGENCY",
      title:"Talent agency",
      sub:"Represent your own clients and take a packaging commission on the pictures they board.",
      badge:`<div class="pitch-head-score"><small>${ag.founded?"CLIENTS":"STATUS"}</small><b>${ag.founded?ag.roster.length:"—"}</b><span>${ag.founded?"signed":"not founded"}</span></div>`,
      body,
      actions:`<button class="develop-ghost" id="btnGoPackagingDesk">Agency packaging desk →</button>`
        + (ag.founded ? "" : `<button class="develop-action" id="btnFoundAgency" ${BOW_AGENCY.canFoundAgency(g)?"":"disabled"}>Found the agency</button>`)
        + `<button class="develop-ghost" id="agencyClose">Close</button>`
    });

    const v = (typeof global.openModal === "function") ? global.openModal(html,{className:"command-pitch-modal command-agency-modal"}) : null;
    if(!v) return;
    const close = v.querySelector("#agencyClose"); if(close) close.onclick = () => { if(typeof global.closeModal === "function") global.closeModal(); };

    const bPack = v.querySelector("#btnGoPackagingDesk");
    if(bPack) bPack.onclick = function(){ global.openAgencyPackagingModal(); };

    const bFound = v.querySelector("#btnFoundAgency");
    if(bFound) bFound.onclick = function(){
      const input = v.querySelector("#agencyName");
      const agName = (input && input.value.trim()) || ((global.G && global.G.studio && global.G.studio.name) || "Studio") + " Talent Agency";
      if(BOW_AGENCY.foundAgency(agName)){
        if(typeof global.beep === "function") global.beep("gold");
        if(typeof global.render === "function") global.render();
        global.openTalentAgencyModal();
      }
    };
  };

})(typeof window !== "undefined" ? window : global);
