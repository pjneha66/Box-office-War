/* ═════════════════════════════════════════════════════════════════════════
   BOW-SHORTS.JS — Vertical & Short-Form Video Division
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_SHORTS = {
    version: "1.0.0",

    FORMATS: {
      teaser_skit: {
        name: "Viral Skit / Meme Drop",
        cost: 0.15,
        turnaroundWeeks: 1,
        platform: "cinetok",
        baseViews: 12.0,
        buzzBoost: 0.05,
        desc: "Fast, punchy short for CineTok. Drives instant algorithmic reach."
      },
      behind_scenes: {
        name: "Set Leak / Behind-The-Scenes",
        cost: 0.25,
        turnaroundWeeks: 1,
        platform: "reelit",
        baseViews: 8.5,
        buzzBoost: 0.09,
        desc: "Controlled leak from the studio lot. Boosts awareness of upcoming film slates."
      },
      micro_drama: {
        name: "Vertical Micro-Series",
        cost: 0.75,
        turnaroundWeeks: 2,
        platform: "cinetok",
        baseViews: 28.0,
        buzzBoost: 0.06,
        desc: "Multi-part vertical soap opera. High monetization from platform creator splits."
      },
      blabber_debate: {
        name: "Hot Take / Cast Discourse",
        cost: 0.10,
        turnaroundWeeks: 1,
        platform: "blabber",
        baseViews: 6.0,
        buzzBoost: 0.04,
        desc: "Manufactured controversy clip trending across Blabber."
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
      state.shortsDivision = state.shortsDivision || {
        activeShorts: [],
        completedShorts: [],
        totalViews: 0,
        totalEarnings: 0,
        weeklyShortsIncome: 0
      };
    },

    produceShort(formatId, tiedProjectId, title, optState){
      const g = this._getG(optState);
      if(!g) return false;
      this.init(g);
      const fmt = this.FORMATS[formatId];
      if(!fmt) return false;
      if((g.studio.cash || 0) < fmt.cost) return false;

      const spendFn = (typeof spend === "function") ? spend : ((typeof global !== "undefined" && typeof global.spend === "function") ? global.spend : null);
      if(spendFn) spendFn("marketing", fmt.cost);
      else g.studio.cash -= fmt.cost;

      const shortObj = {
        id: "short_" + Date.now() + "_" + Math.floor(Math.random()*1000),
        title: title || (fmt.name + " #" + (g.shortsDivision.completedShorts.length + 1)),
        formatId: formatId,
        tiedProjectId: tiedProjectId || null,
        createdWeek: g.week,
        dueWeek: g.week + fmt.turnaroundWeeks,
        views: 0,
        revenue: 0,
        activeWeeks: 4
      };

      g.shortsDivision.activeShorts.push(shortObj);
      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
      if(logFn){
        logFn("SHORTS: Commissioned \"" + shortObj.title + "\" for -" + fmtMFn(fmt.cost) + ". Ready in " + fmt.turnaroundWeeks + " week.", "good");
      }
      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    tickWeekly(state){
      this.init(state);
      const div = state.shortsDivision;
      let weeklyIncome = 0;

      // Advance production of new shorts
      const nowReady = [];
      div.activeShorts = div.activeShorts.filter(s => {
        if(state.week >= s.dueWeek){
          nowReady.push(s);
          return false;
        }
        return true;
      });

      // Handle releases
      nowReady.forEach(s => {
        const fmt = this.FORMATS[s.formatId] || this.FORMATS.teaser_skit;
        const trendMultiplier = (typeof trendOf === "function") ? trendOf("comedy") : ((typeof global !== "undefined" && typeof global.trendOf === "function") ? global.trendOf("comedy") : 1.0);
        const viralRoll = 0.7 + Math.random() * 0.8;
        const viewsM = Math.round(fmt.baseViews * trendMultiplier * viralRoll * 10) / 10;
        s.views = viewsM;

        // If linked to active film project, inject buzz directly
        const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
        if(s.tiedProjectId && Array.isArray(state.projects)){
          const p = state.projects.find(x => x.id === s.tiedProjectId);
          if(p){
            p.buzz = Math.round(((p.buzz || 10) + (fmt.buzzBoost * 100)) * 10) / 10;
            if(logFn){
              logFn("\"" + s.title + "\" clocked " + viewsM + "M views! Injected +" + Math.round(fmt.buzzBoost * 100) + "% buzz into \"" + p.title + "\".", "gold");
            }
          }
        } else {
          if(logFn){
            logFn("\"" + s.title + "\" launched on " + fmt.platform.toUpperCase() + " with " + viewsM + "M views!", "gold");
          }
        }
        div.completedShorts.push(s);
      });

      // Monetize active shorts (last 4 weeks)
      div.completedShorts.forEach(s => {
        if(s.activeWeeks > 0){
          s.activeWeeks--;
          // Ad split ~ $0.025M per million views decaying over time
          const weeklyRev = Math.round((s.views * 0.025 * (s.activeWeeks / 4)) * 100) / 100;
          if(weeklyRev > 0){
            weeklyIncome += weeklyRev;
            s.revenue += weeklyRev;
            div.totalEarnings += weeklyRev;
          }
        }
      });

      div.weeklyShortsIncome = Math.round(weeklyIncome * 10) / 10;
      if(weeklyIncome >= 0.05){
        const earnFn = (typeof earn === "function") ? earn : ((typeof global !== "undefined" && typeof global.earn === "function") ? global.earn : null);
        if(earnFn) earnFn("merch", weeklyIncome);
        else state.studio.cash += weeklyIncome;
      }
      return weeklyIncome;
    }
  };

  global.BOW_SHORTS = BOW_SHORTS;

  // Global modal for BOW Shorts Division
  global.openBowShortsModal = function(){
    const g = BOW_SHORTS._getG();
    if(!g) return;
    BOW_SHORTS.init(g);
    const div = g.shortsDivision;
    const activeProjects = (g.projects || []).filter(p => p.phase !== "released");

    let h = "<h3>BOW Shorts — Vertical Content Division</h3>";
    h += "<p class='tiny muted'>Produce ultra-fast, viral short-form micro-content for CineTok and Reelit to monetize ad views and hype up theatrical releases.</p>";

    const fmtMFn = (typeof fmtM === "function") ? fmtM : ((typeof global !== "undefined" && typeof global.fmtM === "function") ? global.fmtM : x => "$" + x + "M");
    h += "<div class='card' style='margin-bottom:12px;border-left:3px solid var(--purple)'>";
    h += "<div class='spread'><b>Social Shorts Performance</b><span class='pos'>Earnings: +" + fmtMFn(div.weeklyShortsIncome || 0) + "/wk</span></div>";
    h += "<div class='tiny muted'>Total Catalog Views: " + Math.round(div.completedShorts.reduce((a,b)=>a+(b.views||0), 0)) + "M views · Lifetime Revenue: " + fmtMFn(div.totalEarnings || 0) + "</div>";
    h += "</div>";

    h += "<div class='small' style='margin-bottom:6px'><b>Commission a New Short Drop:</b></div>";
    h += "<div class='grid g2' style='gap:8px'>";
    Object.keys(BOW_SHORTS.FORMATS).forEach(fid => {
      const f = BOW_SHORTS.FORMATS[fid];
      const canAfford = (g.studio.cash || 0) >= f.cost;
      h += "<div class='card'>";
      h += "<div class='spread'><b>" + f.name + "</b><span class='tag'>" + fmtMFn(f.cost) + "</span></div>";
      h += "<div class='tiny muted' style='margin:4px 0'>" + f.desc + "</div>";
      h += "<div class='cost-line'><span>Turnaround</span><b>" + f.turnaroundWeeks + " wk</b></div>";
      h += "<button class='btn btn-sm " + (canAfford ? "btn-primary" : "btn-disabled") + "' data-createshort='" + fid + "' style='margin-top:8px;width:100%'>Produce Drop</button>";
      h += "</div>";
    });
    h += "</div>";

    if(div.completedShorts.length){
      h += "<div class='small' style='margin:12px 0 6px'><b>Recent Short Releases:</b></div>";
      h += "<div class='card' style='max-height:140px;overflow-y:auto'>";
      div.completedShorts.slice(-6).reverse().forEach(s => {
        h += "<div class='spread' style='font-size:12px;padding:3px 0'>";
        h += "<span>" + s.title + "</span>";
        h += "<span class='pos'>" + s.views + "M views (+" + fmtMFn(s.revenue) + ")</span>";
        h += "</div>";
      });
      h += "</div>";
    }

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    v.querySelectorAll("[data-createshort]").forEach(b => {
      b.onclick = function(){
        const fid = b.dataset.createshort;
        let tiedId = null;
        if(activeProjects.length){
          const pick = prompt("Tie to an in-production film for buzz injection? Enter project number (or cancel for standalone):\n" +
            activeProjects.map((p, idx) => (idx+1) + ". " + p.title).join("\n"));
          if(pick && activeProjects[parseInt(pick,10)-1]){
            tiedId = activeProjects[parseInt(pick,10)-1].id;
          }
        }
        if(BOW_SHORTS.produceShort(fid, tiedId)){
          if(typeof global.beep === "function") global.beep("click");
          if(typeof global.render === "function") global.render();
          global.openBowShortsModal();
        }
      };
    });
  };

})(typeof window !== "undefined" ? window : global);
