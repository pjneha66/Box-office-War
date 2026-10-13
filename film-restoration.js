/* ═════════════════════════════════════════════════════════════════════════
   FILM-RESTORATION.JS — Film Restoration, Remastering & Archive Vault
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_RESTORATION = {
    version: "1.0.0",

    TIERS: {
      remaster_4k: {
        name: "4K HDR Digital Remaster",
        cost: 4.5,
        weeksNeeded: 4,
        catalogBoost: 0.25,
        desc: "Precision frame-by-frame 4K digital restoration from original negative prints."
      },
      directors_archive: {
        name: "Restored Director's Definitive Edition",
        cost: 8.0,
        weeksNeeded: 6,
        catalogBoost: 0.40,
        qualityBonus: 10,
        desc: "Includes newly unearthed footage and audio mixes approved by the filmmaker."
      },
      atmos_deluxe: {
        name: "Dolby Atmos / 70mm Roadshow Master",
        cost: 12.0,
        weeksNeeded: 8,
        catalogBoost: 0.60,
        anniversaryMultiplier: 1.8,
        desc: "Archival-grade ultra-high resolution remaster formatted for premium wide-format roadshows."
      }
    },

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    init(state){
      if(!state) return;
      state.restorationVault = state.restorationVault || {
        inProgress: [], // { filmId, tierId, dueWeek, startWeek }
        restoredFilms: {} // filmId -> { tierId, completedWeek, boost }
      };
    },

    canRestore(filmId, tierId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      this.init(g);
      const f = (g.films || []).find(x => x.id === filmId);
      if(!f || f.inTheaters) return false;
      const tier = this.TIERS[tierId];
      if(!tier) return false;
      if(g.restorationVault.restoredFilms[filmId]) return false; // Already restored
      if(g.restorationVault.inProgress.some(p => p.filmId === filmId)) return false;
      return (g.studio.cash || 0) >= tier.cost;
    },

    startRestoration(filmId, tierId, optState){
      const g = this._getG(optState);
      if(!g || !this.canRestore(filmId, tierId, g)) return false;
      const tier = this.TIERS[tierId];
      const f = (g.films || []).find(x => x.id === filmId);

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("studio", tier.cost);
      else g.studio.cash -= tier.cost;

      g.restorationVault.inProgress.push({
        filmId: filmId,
        tierId: tierId,
        title: f.title,
        startWeek: g.week,
        dueWeek: g.week + tier.weeksNeeded
      });

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("ARCHIVE: Started " + tier.name + " on \"" + f.title + "\" (-" + fmtMFn(tier.cost) + "). Ready in " + tier.weeksNeeded + " weeks.", "gold");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    tickWeekly(state){
      this.init(state);
      const vault = state.restorationVault;
      const completed = [];
      vault.inProgress = vault.inProgress.filter(p => {
        if(state.week >= p.dueWeek){
          completed.push(p);
          return false;
        }
        return true;
      });

      completed.forEach(c => {
        const tier = this.TIERS[c.tierId];
        vault.restoredFilms[c.filmId] = {
          tierId: c.tierId,
          completedWeek: state.week,
          boost: tier.catalogBoost
        };
        const f = (state.films || []).find(x => x.id === c.filmId);
        if(f){
          f.restored = true;
          f.catalogVal = Math.round(((f.catalogVal || 10) * (1 + tier.catalogBoost)) * 10) / 10;
          if(tier.qualityBonus && f.quality){
            f.quality.overall = Math.min(99, (f.quality.overall || 60) + tier.qualityBonus);
          }
        }
        const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
        if(logFn){
          logFn("RESTORATION COMPLETE: \"" + c.title + "\" (" + tier.name + ") is now preserved in 4K HDR. Catalog valuation boosted by +" + Math.round(tier.catalogBoost * 100) + "%.", "gold");
        }
      });
    },

    // Launch anniversary premium roadshow re-release
    launchAnniversaryRoadshow(filmId, optState){
      const g = this._getG(optState);
      if(!g) return false;
      this.init(g);
      const f = (g.films || []).find(x => x.id === filmId);
      if(!f || !f.restored || f.inTheaters) return false;

      const pCost = 5.0; // Marketing cost for roadshow
      if((g.studio.cash || 0) < pCost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("marketing", pCost);
      else g.studio.cash -= pCost;

      const baseGross = f.ww || 100;
      const clampFn = (typeof clamp === "function") ? clamp : ((v, lo, hi) => Math.max(lo, Math.min(hi, v)));
      const opening = Math.round(clampFn(baseGross * 0.12, 8, 35) * 10) / 10;
      const totalRoadshow = Math.round(opening * 2.8 * 10) / 10;
      const studioShare = Math.round(totalRoadshow * 0.55 * 10) / 10;

      const earnFn = (typeof earn === "function") ? earn : ((typeof global !== "undefined" && typeof global.earn === "function") ? global.earn : null);
      if(earnFn) earnFn("boxOffice", studioShare);
      else g.studio.cash += studioShare;

      f.ww = (f.ww || 0) + totalRoadshow;
      f.reReleased = g.week;

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtGFn = (typeof fmtG === "function") ? fmtG : ((typeof global !== "undefined" && typeof global.fmtG === "function") ? global.fmtG : x => "$" + x + "M");
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("ANNIVERSARY ROADSHOW: Restored \"" + f.title + "\" grossed +" + fmtGFn(totalRoadshow) + " worldwide (+" + fmtMFn(studioShare) + " studio net)!", "gold");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    }
  };

  global.BOW_RESTORATION = BOW_RESTORATION;

  // Global modal for Film Restoration
  global.openRestorationModal = function(){
    const g = BOW_RESTORATION._getG();
    if(!g) return;
    BOW_RESTORATION.init(g);
    const vault = g.restorationVault;
    const library = (g.films || []).filter(f => !f.inTheaters);

    let h = "<h3>Film Restoration & Archive Vault</h3>";
    h += "<p class='tiny muted'>Remaster classic library titles into 4K HDR and Dolby Atmos to permanently enhance streaming catalog royalties and unlock Anniversary Roadshows.</p>";

    if(vault.inProgress.length){
      h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--gold2)'>";
      h += "<b>Lab Remastering in Progress:</b>";
      vault.inProgress.forEach(p => {
        h += "<div class='cost-line'><span>" + p.title + " (" + BOW_RESTORATION.TIERS[p.tierId].name + ")</span><b>Ready W" + p.dueWeek + "</b></div>";
      });
      h += "</div>";
    }

    h += "<div class='small' style='margin-bottom:6px'><b>Library Titles Available for Restoration:</b></div>";
    if(!library.length){
      h += "<div class='card'><div class='tiny muted'>No catalog titles in your library yet. Produce and release films first!</div></div>";
    } else {
      h += "<div class='card' style='max-height:220px;overflow-y:auto'>";
      library.forEach(f => {
        const isRestored = !!vault.restoredFilms[f.id];
        const isLabor = vault.inProgress.some(p => p.filmId === f.id);
        const fmtGFn = (typeof fmtG === "function") ? fmtG : ((typeof global !== "undefined" && typeof global.fmtG === "function") ? global.fmtG : x => "$" + x + "M");
        h += "<div class='spread' style='font-size:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06)'>";
        h += "<div><b>" + f.title + "</b> <span class='tiny muted'>(" + fmtGFn(f.ww||0) + ")</span></div>";
        if(isLabor){
          h += "<span class='tag'>In Lab</span>";
        } else if(isRestored){
          h += "<button class='btn btn-xs btn-primary' data-roadshow='" + f.id + "'>Roadshow Release ($5M)</button>";
        } else {
          h += "<div style='display:flex;gap:4px'>";
          h += "<button class='btn btn-xs btn-alt' data-restore='" + f.id + ":remaster_4k'>4K ($4.5M)</button>";
          h += "<button class='btn btn-xs btn-alt' data-restore='" + f.id + ":directors_archive'>Director's ($8M)</button>";
          h += "</div>";
        }
        h += "</div>";
      });
      h += "</div>";
    }

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    v.querySelectorAll("[data-restore]").forEach(b => {
      b.onclick = function(){
        const [fid, tid] = b.dataset.restore.split(":");
        if(BOW_RESTORATION.startRestoration(+fid, tid)){
          if(typeof global.beep === "function") global.beep("gold");
          if(typeof global.render === "function") global.render();
          global.openRestorationModal();
        } else {
          if(typeof global.toast === "function") global.toast("Cannot start restoration — verify budget and availability.", "bad");
        }
      };
    });

    v.querySelectorAll("[data-roadshow]").forEach(b => {
      b.onclick = function(){
        const fid = +b.dataset.roadshow;
        if(BOW_RESTORATION.launchAnniversaryRoadshow(fid)){
          if(typeof global.beep === "function") global.beep("cash");
          if(typeof global.render === "function") global.render();
          global.openRestorationModal();
        } else {
          if(typeof global.toast === "function") global.toast("Insufficient cash for roadshow campaign ($5M required).", "bad");
        }
      };
    });
  };

})(typeof window !== "undefined" ? window : global);
