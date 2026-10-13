/* ═════════════════════════════════════════════════════════════════════════
   MERCH-LICENSING.JS — Franchise Merchandise & Product Licensing Desk
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc (Merchandise Economy & Engine)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  function _getG(st){
    if(st) return st;
    if(typeof G !== "undefined") return G;
    if(typeof global !== "undefined" && global.G) return global.G;
    if(typeof window !== "undefined" && window.G) return window.G;
    return null;
  }

  function _getCashM(S){
    if(S && S.studio && typeof S.studio.cash === "number") return S.studio.cash;
    if(S && typeof S.cash === "number") return S.cash;
    return 0;
  }

  function _modCashM(S, deltaM){
    if(S && S.studio && typeof S.studio.cash === "number"){
      S.studio.cash = Math.round((S.studio.cash + deltaM) * 100) / 100;
    } else if(S && typeof S.cash === "number"){
      S.cash = Math.round((S.cash + deltaM) * 100) / 100;
    }
  }

  const LICENSING_CATEGORIES = {
    toys_action_figures: {
      id: "toys_action_figures",
      name: "Collectible Action Figures & Playsets",
      minPopularity: 65,
      minGross: 80, // $80M BO required
      advanceMultiplier: 0.05, // 5% of film box office advance
      weeklyRoyaltyPct: 0.015,
      durationWeeks: 52,
      desc: "Global distribution across toy retailers and high-end collector boutiques."
    },
    video_game: {
      id: "video_game",
      name: "AAA Console & Mobile Game Adaptation",
      minPopularity: 75,
      minGross: 150, // $150M BO required
      advanceMultiplier: 0.08,
      weeklyRoyaltyPct: 0.022,
      durationWeeks: 104,
      desc: "Licensed interactive game developed by premier external gaming publishers."
    },
    apparel_fast_fashion: {
      id: "apparel_fast_fashion",
      name: "Designer Streetwear & Apparel Line",
      minPopularity: 50,
      minGross: 50, // $50M BO required
      advanceMultiplier: 0.03,
      weeklyRoyaltyPct: 0.010,
      durationWeeks: 26,
      desc: "Capsule collections across international fashion retail chains."
    },
    theme_park_ride: {
      id: "theme_park_ride",
      name: "Theme Park Immersive Attraction",
      minPopularity: 85,
      minGross: 300, // $300M BO required
      advanceMultiplier: 0.12,
      weeklyRoyaltyPct: 0.035,
      durationWeeks: 156,
      desc: "Headline motion-simulator or dark-ride attraction at major global destination theme parks."
    }
  };

  function initMerchLicensing(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.merchandise){
      S.merchandise = {
        activeDeals: [],
        dealHistory: [],
        totalRoyaltyEarned: 0
      };
    }
    return S.merchandise;
  }

  function signMerchLicensingDeal(filmId, categoryId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initMerchLicensing(S);

    const cat = LICENSING_CATEGORIES[categoryId];
    if(!cat) return { ok: false, msg: "Invalid licensing category: " + categoryId };

    const film = (S.films || []).find(f => f.id === filmId || f.title === filmId);
    if(!film) return { ok: false, msg: "Film not found" };

    const totalGross = film.gross || film.boxOffice || film.revenue || (film.dom ? film.dom * 2 : 0);
    if(totalGross < cat.minGross){
      return {
        ok: false,
        msg: "Film has insufficient gross. Requires $" + cat.minGross + "M theatrical box office."
      };
    }

    const existing = S.merchandise.activeDeals.find(d => d.filmId === film.id && d.categoryId === categoryId);
    if(existing){
      return { ok: false, msg: "An active licensing deal in this category already exists for this film." };
    }

    const advanceCash = Math.max(1.0, Math.round(totalGross * cat.advanceMultiplier * 10) / 10);
    const weeklyRoyalty = Math.max(0.02, Math.round(advanceCash * 0.005 * cat.weeklyRoyaltyPct * 100 * 100) / 100);

    _modCashM(S, advanceCash);

    const deal = {
      id: "deal_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      filmId: film.id,
      filmTitle: film.title,
      categoryId: cat.id,
      categoryName: cat.name,
      advanceCash,
      weeklyRoyalty,
      weeksRemaining: cat.durationWeeks,
      totalDurationWeeks: cat.durationWeeks,
      startWeek: S.week || 1
    };

    S.merchandise.activeDeals.push(deal);

    if(typeof log === "function"){
      log("LICENSING DEAL SIGNED: " + cat.name + " for '" + film.title + "'. Upfront: +$" + advanceCash + "M, Royalty: +$" + (weeklyRoyalty * 1000).toFixed(0) + "k/wk.", "gold");
    }

    return {
      ok: true,
      deal,
      advanceCash,
      msg: "Licensing contract executed and advance deposited."
    };
  }

  function advanceMerchandiseWeek(state){
    const S = _getG(state);
    if(!S) return { totalRoyalty: 0, activeDealsCount: 0 };
    initMerchLicensing(S);

    let weeklyIncome = 0;
    const remainingDeals = [];

    S.merchandise.activeDeals.forEach(deal => {
      weeklyIncome += deal.weeklyRoyalty;
      deal.weeksRemaining--;

      if(deal.weeksRemaining > 0){
        remainingDeals.push(deal);
      } else {
        S.merchandise.dealHistory.push(deal);
        if(typeof log === "function"){
          log("Licensing contract expired: " + deal.categoryName + " for '" + deal.filmTitle + "'.", "");
        }
      }
    });

    S.merchandise.activeDeals = remainingDeals;
    weeklyIncome = Math.round(weeklyIncome * 100) / 100;
    S.merchandise.totalRoyaltyEarned = Math.round(((S.merchandise.totalRoyaltyEarned || 0) + weeklyIncome) * 100) / 100;

    if(weeklyIncome > 0){
      _modCashM(S, weeklyIncome);
    }

    return {
      totalRoyalty: weeklyIncome,
      activeDealsCount: remainingDeals.length
    };
  }

  function openMerchLicensingModal(){
    const S = _getG();
    if(!S) return;
    initMerchLicensing(S);

    const eligibleFilms = (S.films || []).filter(f => (f.gross || f.boxOffice || (f.dom ? f.dom * 2 : 0)) >= 50);
    const selectedFilm = eligibleFilms[0];

    const weeklyRunRate = (S.merchandise.activeDeals || []).reduce((acc, d) => acc + (d.weeklyRoyalty || 0), 0);

    let h = "<h3>Franchise Merchandise &amp; Product Licensing</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Monetize blockbuster intellectual property across action figures, AAA video games, designer streetwear, and destination theme park attractions for huge upfront advances and weekly royalties.</div>";

    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>$" + (S.merchandise.totalRoyaltyEarned || 0).toFixed(2) + "M</div><div class='s-l'>Total Royalties Earned</div></div>"+
      "<div class='stat'><div class='s-v'>" + (S.merchandise.activeDeals || []).length + "</div><div class='s-l'>Active Deals</div></div>"+
      "<div class='stat'><div class='s-v'>+$" + (weeklyRunRate * 1000).toFixed(0) + "k/wk</div><div class='s-l'>Weekly Cashflow</div></div>"+
    "</div>";

    if(!selectedFilm){
      h += "<div class='card tiny muted' style='margin-bottom:12px'>No films currently meet the minimum $50M box office threshold for merchandising. Score a box office hit to unlock commercial licensing!</div>";
    } else {
      const grossVal = selectedFilm.gross || selectedFilm.boxOffice || (selectedFilm.dom ? selectedFilm.dom * 2 : 0);
      h += "<div class='card' style='margin-bottom:12px'>"+
        "<div class='spread'><b>" + selectedFilm.title + "</b><span class='tag gold'>Box Office: $" + grossVal.toFixed(1) + "M</span></div>"+
      "</div>";

      h += "<div class='section-title'>Available Licensing Rights</div><div class='grid g2'>";
      for(const key in LICENSING_CATEGORIES){
        const cat = LICENSING_CATEGORIES[key];
        const gross = grossVal;
        const eligible = gross >= cat.minGross;
        const hasDeal = (S.merchandise.activeDeals || []).some(d => d.filmId === selectedFilm.id && d.categoryId === cat.id);

        h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
          "<div>"+
            "<div class='spread'><b>" + cat.name + "</b><span class='tag'>" + cat.durationWeeks + " wks</span></div>"+
            "<div class='tiny muted' style='margin:6px 0'>" + cat.desc + "</div>"+
            "<div class='tiny' style='color:var(--gold)'>Req Gross: $" + cat.minGross + "M | Royalty: ~" + (cat.weeklyRoyaltyPct * 100).toFixed(1) + "%</div>"+
          "</div>"+
          "<div style='margin-top:10px'>"+
            (hasDeal ? (
              "<button class='btn btn-sm' style='width:100%' disabled>Licensed</button>"
            ) : eligible ? (
              "<button class='btn btn-sm btn-primary' style='width:100%' data-merchdeal='" + cat.id + "' data-filmid='" + selectedFilm.id + "'>License IP Rights</button>"
            ) : (
              "<button class='btn btn-sm' style='width:100%' disabled>Req $" + cat.minGross + "M BO</button>"
            ))+
          "</div>"+
        "</div>";
      }
      h += "</div>";
    }

    if((S.merchandise.activeDeals || []).length > 0){
      h += "<div class='section-title' style='margin-top:14px'>Active Commercial Deals</div><div class='grid g1' style='gap:6px'>";
      S.merchandise.activeDeals.forEach(d => {
        h += "<div class='card tiny spread'><span>" + d.categoryName + " ('" + d.filmTitle + "')</span><span>+$" + (d.weeklyRoyalty * 1000).toFixed(0) + "k/wk</span><b>" + d.weeksRemaining + " wks left</b></div>";
      });
      h += "</div>";
    }

    if(typeof openModal === "function"){
      const v = openModal(h);
      if(v){
        v.querySelectorAll("[data-merchdeal]").forEach(btn => {
          btn.onclick = () => {
            const res = signMerchLicensingDeal(btn.dataset.filmid, btn.dataset.merchdeal, S);
            if(res.ok){
              if(typeof toast === "function") toast("Licensing contract executed! Advance: +$" + res.advanceCash + "M", "good");
              openMerchLicensingModal();
              if(typeof render === "function") render();
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          };
        });
      }
    }
  }

  const MerchLicensingAPI = {
    LICENSING_CATEGORIES,
    initMerchLicensing,
    signMerchLicensingDeal,
    advanceMerchandiseWeek,
    openMerchLicensingModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = MerchLicensingAPI;
  }
  global.MerchLicensing = MerchLicensingAPI;
  global.openMerchLicensingModal = openMerchLicensingModal;
})(typeof window !== "undefined" ? window : global);
