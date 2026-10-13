/* ═════════════════════════════════════════════════════════════════════════
   DYNASTY-LEGACY.JS — Studio Dynasty & Heir New Game+ Engine
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_DYNASTY = {
    version: "1.0.0",

    HEIR_BACKGROUNDS: {
      heir_auteur: {
        name: "Film School Prodigy",
        desc: "Trained under European auteurs. Critical review baseline +12; Director hiring cost -20%.",
        startingRepBonus: 10,
        perks: { criticBonus: 12, dirDiscount: 0.20 }
      },
      heir_mogul: {
        name: "Wall Street Heir",
        desc: "Inherits banking syndicate ties. +25% inherited trust fund, -30% borrowing interest, +$60M credit limit.",
        startingRepBonus: 5,
        perks: { fundBoost: 0.25, interestDiscount: 0.30, creditBoost: 60 }
      },
      heir_nepo: {
        name: "Hollywood Royalty",
        desc: "Born into the industry. Starting reputation +20; A-list talent never reject script pitches.",
        startingRepBonus: 20,
        perks: { talentCharm: true, starLoyalty: 15 }
      },
      heir_innovator: {
        name: "Digital Native",
        desc: "Master of streaming & viral content. Starts with founded streamer and +20% viral reach.",
        startingRepBonus: 8,
        perks: { earlyStreamer: true, viralBoost: 0.20 }
      }
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    canStartNewGamePlus(optState){
      const state = this._getG(optState);
      if(!state || !state.studio) return false;
      const weeks = state.week || 1;
      const films = (state.films || []).length;
      const cash = state.studio.cash || 0;
      // Eligible if played at least 52 weeks (1 year) with at least 3 releases, or net worth > $200M
      return weeks >= 52 && (films >= 3 || cash >= 150);
    },

    calcInheritance(optState){
      const state = this._getG(optState);
      if(!state || !state.studio) return { cash: 40, rep: 25, heirlooms: [] };
      const currentCash = Math.max(0, state.studio.cash || 0);
      const valFn = (typeof studioValuation === "function") ? studioValuation : ((typeof global !== "undefined" && typeof global.studioValuation === "function") ? global.studioValuation : () => (currentCash * 1.5));
      const val = valFn();
      const trustFund = Math.min(180, Math.max(30, Math.round(val * 0.12)));
      const parentRep = Math.max(10, state.studio.rep || 10);
      const legacyRep = Math.min(48, Math.max(20, Math.round(parentRep * 0.35)));

      const topFilms = (state.films || [])
        .slice()
        .sort((a,b) => (b.ww || 0) - (a.ww || 0))
        .slice(0, 5);

      return {
        trustFund,
        legacyRep,
        parentName: state.studio.name || "Original Studio",
        generation: ((state.dynasty && state.dynasty.gen) || 1) + 1,
        topFilms
      };
    },

    launchDynasty(heirType, selectedHeirloomIds, heirStudioName, optState){
      const g = this._getG(optState);
      if(!g) return false;
      const heirDef = this.HEIR_BACKGROUNDS[heirType] || this.HEIR_BACKGROUNDS.heir_auteur;
      const inherit = this.calcInheritance(g);

      let startingCash = inherit.trustFund;
      if(heirDef.perks.fundBoost) startingCash = Math.round(startingCash * (1 + heirDef.perks.fundBoost));

      let startingRep = inherit.legacyRep + (heirDef.startingRepBonus || 0);

      // Collect heirloom films
      const heirlooms = [];
      if(Array.isArray(selectedHeirloomIds)){
        selectedHeirloomIds.forEach(id => {
          const f = (global.G.films || []).find(x => x.id === id);
          if(f){
            heirlooms.push({
              title: f.title,
              genre: f.genre,
              ww: f.ww,
              quality: f.quality,
              heirloom: true
            });
          }
        });
      }

      const dynastyMeta = {
        active: true,
        gen: inherit.generation,
        founder: inherit.parentName,
        heirType: heirType,
        heirName: heirDef.name,
        perks: heirDef.perks,
        heirlooms: heirlooms
      };

      // Restart game with heir advantages
      const studioName = (heirStudioName && heirStudioName.trim()) || (inherit.parentName + " Dynasty");
      if(typeof global.newGame === "function"){
        global.newGame("producer", studioName);
        global.G.dynasty = dynastyMeta;
        global.G.studio.cash = startingCash;
        global.G.studio.rep = startingRep;

        // Carry over heirloom IPs as starting franchises
        heirlooms.forEach(hl => {
          if(typeof global.upsertFranchise === "function"){
            global.upsertFranchise({
              franchiseName: hl.title,
              title: hl.title,
              genre: hl.genre,
              ww: hl.ww
            });
          }
        });

        // Digital Native early streamer perk
        if(heirDef.perks.earlyStreamer && typeof global.launchStreamer === "function"){
          global.G.studio.rep = Math.max(global.G.studio.rep, 40);
          global.G.studio.cash += 150;
          global.launchStreamer(studioName + " Prime");
        }

        const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
        const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
        if(logFn){
          logFn("DYNASTY ESTABLISHED: Generation " + dynastyMeta.gen + " takes the throne at " + studioName + "! Starting fund: " + fmtMFn(startingCash), "gold");
        }
        const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
        if(saveFn) saveFn();
        return true;
      }
      return false;
    }
  };

  global.BOW_DYNASTY = BOW_DYNASTY;

  // Global modal for Dynasty New Game+
  global.openDynastyModal = function(){
    const g = BOW_DYNASTY._getG();
    if(!g) return;
    const canNGP = BOW_DYNASTY.canStartNewGamePlus(g);
    const inherit = BOW_DYNASTY.calcInheritance(g);

    let h = "<h3>Studio Dynasty — New Game+</h3>";
    h += "<p class='tiny muted'>Pass the studio mantle to the next generation. Inherit family trust fund capital, reputation halo, and vault IP.</p>";

    if(!canNGP){
      h += "<div class='card' style='border-left:3px solid var(--red)'>";
      h += "<b>Dynasty Requirements Not Met</b>";
      h += "<div class='tiny muted' style='margin-top:4px'>A studio must operate for at least 52 weeks and produce 3 films before founding a dynasty heir.</div>";
      h += "</div>";
      if(typeof global.openModal === "function") global.openModal(h);
      return;
    }

    const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
    h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--gold2)'>";
    h += "<b>Generation " + inherit.generation + " Inheritance Package</b>";
    h += "<div class='cost-line'><span>Trust Fund Capital</span><b class='pos'>+" + fmtMFn(inherit.trustFund) + "</b></div>";
    h += "<div class='cost-line'><span>Legacy Reputation Halo</span><b>" + inherit.legacyRep + "/100</b></div>";
    h += "</div>";

    h += "<div class='small' style='margin-bottom:6px'><b>Choose Heir Background:</b></div><div class='grid g2' style='gap:8px'>";
    Object.keys(BOW_DYNASTY.HEIR_BACKGROUNDS).forEach(key => {
      const bg = BOW_DYNASTY.HEIR_BACKGROUNDS[key];
      h += "<div class='card' style='cursor:pointer' data-heirpick='" + key + "'>";
      h += "<div class='spread'><b>" + bg.name + "</b><input type='radio' name='radHeir' value='" + key + "' " + (key==="heir_auteur"?"checked":"") + "></div>";
      h += "<div class='tiny muted' style='margin-top:4px'>" + bg.desc + "</div>";
      h += "</div>";
    });
    h += "</div>";

    if(inherit.topFilms.length){
      h += "<div class='small' style='margin:12px 0 6px'><b>Select Vault Heirloom IPs (Max 2):</b></div>";
      h += "<div class='card' style='max-height:140px;overflow-y:auto'>";
      inherit.topFilms.forEach(f => {
        const fmtGFn = (typeof fmtG === "function") ? fmtG : ((typeof global !== "undefined" && typeof global.fmtG === "function") ? global.fmtG : x => "$" + x + "M");
        h += "<div class='spread' style='font-size:12px;padding:3px 0'>";
        h += "<span><b>" + f.title + "</b> (" + fmtGFn(f.ww) + ")</span>";
        h += "<input type='checkbox' class='chk-heirloom' value='" + f.id + "'>";
        h += "</div>";
      });
      h += "</div>";
    }

    h += "<div style='margin-top:12px'><label class='field-label' for='dynastyStudioName'>New Studio Name</label>";
    h += "<input id='dynastyStudioName' type='text' value='" + inherit.parentName + " Legacy' style='width:100%;padding:8px 10px;background:#06080e;border:1px solid var(--line2);color:var(--text);border-radius:8px'>";
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'><button class='btn btn-primary' id='btnConfirmDynasty' style='width:100%'>Crown Heir & Begin Dynasty</button></div>";

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    v.querySelectorAll("[data-heirpick]").forEach(c => {
      c.onclick = function(){
        const r = c.querySelector("input[type='radio']");
        if(r) r.checked = true;
      };
    });

    const btnGo = v.querySelector("#btnConfirmDynasty");
    if(btnGo) btnGo.onclick = function(){
      const rad = v.querySelector("input[name='radHeir']:checked");
      const heirType = rad ? rad.value : "heir_auteur";
      const chks = Array.from(v.querySelectorAll(".chk-heirloom:checked")).map(c => +c.value).slice(0, 2);
      const nameInp = v.querySelector("#dynastyStudioName");
      const sName = nameInp ? nameInp.value : (inherit.parentName + " Legacy");

      if(confirm("Crown your heir and restart as Generation " + inherit.generation + "? Your previous achievements will be recorded in the Hall of Fame.")){
        if(BOW_DYNASTY.launchDynasty(heirType, chks, sName)){
          if(typeof global.closeModal === "function") global.closeModal();
          if(typeof global.render === "function") global.render();
        }
      }
    };
  };

})(typeof window !== "undefined" ? window : global);
