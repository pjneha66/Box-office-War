/* ═════════════════════════════════════════════════════════════════════════
   TERRITORY-LICENSING.JS — International Territory Licensing & Sales
   Box Office War — Modular Engine Extension
   (Synthesized with 100% parity to Box_Office_Inc international-territory-licensing.md)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_TERRITORIES = {
    version: "1.0.0",

    REGIONS: [
      {
        id: "europe",
        name: "Europe",
        countries: "UK, France, Germany, Italy, Spain, Nordics",
        marketShare: 0.35,
        favoredGenres: ["drama", "thriller", "romance", "comedy"],
        baseMG: 12.0,
        desc: "High box office stability, strict quotas, strong festival appreciation."
      },
      {
        id: "apac",
        name: "Asia-Pacific",
        countries: "China, Japan, South Korea, India, Australia",
        marketShare: 0.42,
        favoredGenres: ["action", "scifi", "animation", "musical"],
        baseMG: 18.0,
        desc: "Massive scale, spectacle-driven appetite, high upside theatrical markets."
      },
      {
        id: "latam",
        name: "Latin America",
        countries: "Mexico, Brazil, Argentina, Colombia, Chile",
        marketShare: 0.14,
        favoredGenres: ["horror", "animation", "action", "comedy"],
        baseMG: 5.5,
        desc: "High family and horror cinema attendance, sensitive to local star voice dubbing."
      },
      {
        id: "mea",
        name: "Middle East & Africa",
        countries: "UAE, Saudi Arabia, South Africa, Egypt, Nigeria",
        marketShare: 0.09,
        favoredGenres: ["action", "thriller", "comedy"],
        baseMG: 4.0,
        desc: "Rapidly expanding luxury multiplex footprint with premium ticket pricing."
      }
    ],

    DEAL_MODELS: {
      MINIMUM_GUARANTEE: {
        id: "MG",
        name: "Minimum Guarantee (MG)",
        upfrontMult: 1.0,
        royaltyRate: 0.15, // 15% backend
        desc: "Guaranteed upfront payout banked immediately; 15% backend box office participation."
      },
      REVENUE_SHARE: {
        id: "REV_SHARE",
        name: "Revenue Share (RevShare)",
        upfrontMult: 0.20,
        royaltyRate: 0.55, // 55% backend
        desc: "Modest upfront advance; 55% high-leverage backend participation on foreign gross."
      }
    },

    LOCALIZATION_COST: 0.8, // $800k for professional dubbing & subbing
    LOCALIZATION_BOOST: 1.25, // +25% regional gross

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    // Calculate upfront and royalty projections for a given film and region
    calculateTerritoryOffer(film, regionId, modelKey, optState){
      const g = this._getG(optState);
      const region = this.REGIONS.find(r => r.id === regionId);
      const model = this.DEAL_MODELS[modelKey] || this.DEAL_MODELS.MINIMUM_GUARANTEE;
      if(!film || !region) return null;

      // Scale based on budget, quality/buzz, and genre synergy
      const b = film.budget || 30;
      const q = (film.quality && film.quality.overall) || 65;
      const genre = film.genre || "action";
      const isFavored = region.favoredGenres.includes(genre);
      const genreMult = isFavored ? 1.30 : 0.90;

      const starPower = (film.cast || []).reduce((acc, t) => acc + (t.starPower || t.skill || 60), 0) / Math.max(1, (film.cast || []).length);
      const starMult = 0.7 + (starPower / 100) * 0.6;

      const estTerritoryPotential = (b * 0.8 + (q / 100) * b) * region.marketShare * genreMult * starMult;
      const upfront = Math.round((estTerritoryPotential * 0.40 * model.upfrontMult) * 10) / 10;

      return {
        regionId,
        regionName: region.name,
        modelKey,
        modelName: model.name,
        upfront: Math.max(0.5, upfront),
        royaltyRate: model.royaltyRate,
        marketShare: region.marketShare,
        genreFit: isFavored ? "Strong Synergy (+30%)" : "Neutral Demand"
      };
    },

    signTerritoryDeal(filmId, regionId, modelKey, localize, optState, windowWeeks){
      const g = this._getG(optState);
      if(!g) return false;
      const f = (g.projects || []).find(p => p.id === filmId) || (g.films || []).find(f => f.id === filmId);
      if(!f) return false;

      f.territoryDeals = f.territoryDeals || {};
      if(f.territoryDeals[regionId]){
        return false; // Deal already signed for this region
      }

      const offer = this.calculateTerritoryOffer(f, regionId, modelKey, g);
      if(!offer) return false;

      let netCashDelta = offer.upfront;
      if(localize){
        if((g.studio.cash || 0) < this.LOCALIZATION_COST){
          return false; // Cannot afford localization
        }
        netCashDelta -= this.LOCALIZATION_COST;
      }

      // Bank upfront cash into studio
      if(netCashDelta > 0){
        if(typeof earn === "function") earn("presales", netCashDelta);
        else g.studio.cash += netCashDelta;
      } else if(netCashDelta < 0){
        if(typeof spend === "function") spend("marketing", Math.abs(netCashDelta));
        else g.studio.cash -= Math.abs(netCashDelta);
      }

      const rightsWeeks = Math.max(13, Math.min(104, Math.floor(Number(windowWeeks) || 52)));
      f.territoryDeals[regionId] = {
        modelKey,
        modelName: offer.modelName,
        upfront: offer.upfront,
        royaltyRate: offer.royaltyRate,
        localized: !!localize,
        signedWeek: g.week,
        startWeek: g.week,
        endWeek: g.week + rightsWeeks,
        windowWeeks: rightsWeeks,
        cumEarned: offer.upfront
      };

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");
      if(logFn){
        logFn("[TERRITORY DEAL] \"" + f.title + "\" licensed in " + offer.regionName + " (" + offer.modelName + "). Banked +" + fmtMFn(offer.upfront) + " upfront with " + Math.round(offer.royaltyRate*100) + "% backend." + (localize ? " [Dubbing & Subtitling Funded]" : ""), "gold");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    // Process weekly international box office royalties from signed territory deals
    tickWeeklyRoyalties(film, intlGross, optState){
      if(!film || !film.territoryDeals || !intlGross || intlGross <= 0) return 0;
      const g = this._getG(optState);
      let totalRoyalties = 0;

      this.REGIONS.forEach(reg => {
        const deal = film.territoryDeals[reg.id];
        if(!deal) return;
        if(g && Number.isFinite(deal.startWeek) && g.week < deal.startWeek) return;
        if(g && Number.isFinite(deal.endWeek) && g.week > deal.endWeek) return;
        let regGross = intlGross * reg.marketShare;
        if(deal.localized) regGross *= this.LOCALIZATION_BOOST;
        const royalty = regGross * deal.royaltyRate;
        deal.cumEarned = (deal.cumEarned || 0) + royalty;
        totalRoyalties += royalty;
      });

      if(totalRoyalties > 0 && g){
        if(typeof earn === "function") earn("boxoffice", totalRoyalties);
        else g.studio.cash += totalRoyalties;
      }
      return totalRoyalties;
    }
  };

  global.BOW_TERRITORIES = BOW_TERRITORIES;

  // Global interactive Territory Deals Modal
  global.openTerritoryDealsModal = function(optFilmId){
    const g = BOW_TERRITORIES._getG();
    if(!g) return;
    const candidates = (g.projects || []).filter(p => p.phase === "ready" || p.phase === "post" || p.phase === "prod").concat((g.films || []).filter(f => f.inTheaters || (g.week - f.releaseWeek < 12)));
    if(!candidates.length){
      if(typeof global.openModal === "function"){
        global.openModal("<h3>International Territory Licensing & Foreign Sales</h3><div class='card text-center' style='padding:24px 16px'><p class='muted'>No active in-production, completed, or currently releasing pictures available for foreign territory licensing. Greenlight a project to negotiate regional deals.</p></div>");
      }
      return;
    }

    let activeFilm = candidates.find(f => f.id === optFilmId) || candidates[0];
    let rightsTerm = 26;
    const fmtMFn = (typeof fmtM === "function") ? fmtM : (x => "$" + x + "M");

    function renderInnerContent(){
      activeFilm.territoryDeals = activeFilm.territoryDeals || {};
      let h = "<h3>International Territory Licensing Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:10px'>Negotiate theatrical and streaming distribution rights across global territories. Balance guaranteed upfront cash (Minimum Guarantee) against lucrative backend box office participation (Revenue Share).</p>";

      // Film selector dropdown/pills
      h += "<div style='display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px;touch-action:pan-x;'>";
      candidates.forEach(f => {
        const isSel = f.id === activeFilm.id;
        h += "<button class='btn btn-xs " + (isSel ? "btn-primary" : "btn-alt") + "' data-sel-film='" + f.id + "'>" + f.title + " (" + f.genre + ")</button>";
      });
      h += "</div>";

      h += "<div class='card' style='margin-bottom:12px'>";
      h += "<div class='row' style='justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;'>";
      h += "<div><b>Selected Picture:</b> <span class='gold'>\"" + activeFilm.title + "\"</span> <span class='muted tiny'>(" + (activeFilm.scale || "Standard") + " · Budget: " + fmtMFn(activeFilm.budget || 20) + ")</span></div>";
      h += "<div class='tiny muted'>Signed Regions: " + Object.keys(activeFilm.territoryDeals).length + "/4</div>";
      h += "</div></div>";
      h += "<label class='tiny muted' style='display:flex;align-items:center;gap:8px;margin:8px 0 12px'>Rights window"+
        "<select id='territoryRightsWindow' aria-label='Territory rights window' style='background:#101721;color:var(--text);border:1px solid var(--line2);border-radius:8px;padding:7px'>"+
        [[13,"13 weeks"],[26,"26 weeks"],[52,"52 weeks"],[104,"104 weeks"]].map(x=>"<option value='"+x[0]+"' "+(rightsTerm===x[0]?"selected":"")+">"+x[1]+"</option>").join("")+"</select></label>";

      h += "<div class='territory-deal-grid'>";
      BOW_TERRITORIES.REGIONS.forEach(reg => {
        const deal = activeFilm.territoryDeals[reg.id];
        h += "<div class='card territory-deal-card'>";
        h += "<div>";
        h += "<div class='row' style='justify-content:space-between'><b>" + reg.name + "</b><span class='tag blue'>" + Math.round(reg.marketShare*100) + "% World Mkt</span></div>";
        h += "<div class='tiny muted' style='margin:4px 0'>" + reg.countries + "</div>";
        h += "<div class='tiny' style='margin-bottom:8px'>" + reg.desc + "</div>";

        if(deal){
          h += "<div class='card card-sub' style='border-left:3px solid var(--green);padding:8px;margin-top:6px'>";
          h += "<b class='pos'>[LICENSED] " + deal.modelName + "</b>";
          h += "<div class='tiny muted' style='margin:3px 0'>Upfront: " + fmtMFn(deal.upfront) + " | Backend: " + Math.round(deal.royaltyRate*100) + "%" + (deal.localized ? " | Localized (+25%)" : "") + (deal.endWeek?" | Rights through W"+deal.endWeek:"") + "</div>";
          h += "<div class='tiny gold'>Cumulative Revenue Earned: " + fmtMFn(deal.cumEarned || deal.upfront) + "</div>";
          h += "</div>";
        } else {
          const mgOffer = BOW_TERRITORIES.calculateTerritoryOffer(activeFilm, reg.id, "MINIMUM_GUARANTEE", g);
          const revOffer = BOW_TERRITORIES.calculateTerritoryOffer(activeFilm, reg.id, "REVENUE_SHARE", g);

          h += "<div class='card card-sub' style='padding:6px;margin:4px 0'>";
          h += "<div class='row' style='justify-content:space-between'><b class='tiny'>Minimum Guarantee (MG):</b> <span class='gold tiny'>+" + fmtMFn(mgOffer.upfront) + " upfront</span></div>";
          h += "<div class='tiny muted'>15% backend royalty · Immediate risk-free cash injection</div>";
          h += "</div>";

          h += "<div class='card card-sub' style='padding:6px;margin:4px 0'>";
          h += "<div class='row' style='justify-content:space-between'><b class='tiny'>Revenue Share:</b> <span class='gold tiny'>+" + fmtMFn(revOffer.upfront) + " upfront</span></div>";
          h += "<div class='tiny muted'>55% backend royalty · High upside for box office juggernauts</div>";
          h += "</div>";

          h += "<label class='tiny muted' style='display:flex;align-items:center;gap:6px;margin:6px 0'>";
          h += "<input type='checkbox' id='chk_loc_" + reg.id + "' " + ((g.studio.cash || 0) >= BOW_TERRITORIES.LOCALIZATION_COST ? "" : "disabled") + "> Fund Dubbing & Local Subtitling (-$" + BOW_TERRITORIES.LOCALIZATION_COST + "M for +25% BO)";
          h += "</label>";

          h += "<div class='territory-actions-row'>";
          h += "<button class='btn btn-xs btn-primary territory-action-btn' data-deal-reg='" + reg.id + "' data-deal-model='MINIMUM_GUARANTEE'>Sign MG (15%)</button>";
          h += "<button class='btn btn-xs btn-alt territory-action-btn' data-deal-reg='" + reg.id + "' data-deal-model='REVENUE_SHARE'>Sign RevShare (55%)</button>";
          h += "</div>";
        }
        h += "</div></div>";
      });
      h += "</div>";
      return h;
    }

    function renderContent(){
      return "<div id='territoryModalInner' class='territory-modal-inner'>" + renderInnerContent() + "</div>";
    }

    const v = (typeof global.openModal === "function") ? global.openModal(renderContent()) : null;
    if(!v) return;

    function refresh(modalEl){
      const inner = modalEl.querySelector("#territoryModalInner");
      if(inner){
        inner.innerHTML = renderInnerContent();
      } else {
        const m = modalEl.querySelector(".modal") || modalEl;
        m.innerHTML = renderContent();
      }
      attachListeners(modalEl);
    }

    function attachListeners(modalEl){
      const rightsSelect=modalEl.querySelector("#territoryRightsWindow");
      if(rightsSelect) rightsSelect.onchange=()=>{ rightsTerm=Math.max(13,Math.min(104,parseInt(rightsSelect.value,10)||26)); };
      modalEl.querySelectorAll("[data-sel-film]").forEach(b => {
        b.onclick = function(){
          const fid = b.dataset.selFilm;
          activeFilm = candidates.find(f => String(f.id) === String(fid)) || activeFilm;
          refresh(modalEl);
        };
      });

      modalEl.querySelectorAll("[data-deal-reg]").forEach(b => {
        b.onclick = function(){
          const regId = b.dataset.dealReg;
          const modelKey = b.dataset.dealModel;
          const chk = modalEl.querySelector("#chk_loc_" + regId);
          const localize = chk ? chk.checked : false;

          if(BOW_TERRITORIES.signTerritoryDeal(activeFilm.id, regId, modelKey, localize, g, rightsTerm)){
            if(typeof global.beep === "function") global.beep("gold");
            if(typeof global.render === "function") global.render();
            refresh(modalEl);
          }
        };
      });
    }

    attachListeners(v);
  };

})(typeof window !== "undefined" ? window : global);
