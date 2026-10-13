/* ═════════════════════════════════════════════════════════════════════════
   SYNDICATION-TV.JS — Movie Syndication & Television Licensing Engine
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc Architecture
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

  const SYNDICATION_PACKAGES = [
    {
      id: "primetime",
      name: "Primetime Broadcast Network Package",
      desc: "Tier-1 national network broadcast. High upfront payment with a 52-week ongoing broadcast cycle. Requires high box office gross or critical acclaim.",
      minRating: 70,
      minWW: 80,
      durationWeeks: 52,
      upfrontMult: 0.08, // 8% of WW gross
      royaltyMult: 0.003 // 0.3% WW gross per week
    },
    {
      id: "matinee",
      name: "Weekend Matinee Movie Package",
      desc: "Weekend afternoon network rotation. 26-week broadcast agreement ideal for mainstream catalog films.",
      minRating: 50,
      minWW: 25,
      durationWeeks: 26,
      upfrontMult: 0.05,
      royaltyMult: 0.002
    },
    {
      id: "cable_cult",
      name: "Late-Night Cable & Cult Movie Bundle",
      desc: "Cable channel reruns and late-night genre spotlight. 12-week agreement suited for horror, cult classics, and mid-tier films.",
      minRating: 30,
      minWW: 5,
      durationWeeks: 12,
      upfrontMult: 0.03,
      royaltyMult: 0.0015
    }
  ];

  function initSyndication(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.syndication){
      S.syndication = {
        activeDeals: [],
        historicalDeals: [],
        totalUpfrontEarned: 0,
        totalRoyaltiesEarned: 0
      };
    }
    return S.syndication;
  }

  function calculateSyndicationOffer(film, pkgId){
    if(!film) return null;
    const pkg = SYNDICATION_PACKAGES.find(p => p.id === pkgId) || SYNDICATION_PACKAGES[1];
    const ww = film.ww || 10;
    const rating = film.review || film.score || 50;

    const meetsWW = ww >= pkg.minWW;
    const meetsRating = rating >= pkg.minRating;
    const eligible = meetsWW || meetsRating;

    const baseUpfront = ww * pkg.upfrontMult;
    const ratingBonus = (rating / 100) * (pkg.id === "primetime" ? 6 : 2);
    const upfront = Math.max(0.5, Math.round((baseUpfront + ratingBonus) * 10) / 10);

    const weeklyRoyalty = Math.max(0.05, Math.round((ww * pkg.royaltyMult + (rating / 500)) * 100) / 100);

    return {
      pkgId: pkg.id,
      pkgName: pkg.name,
      eligible,
      reason: !eligible ? "Requires $" + pkg.minWW + "M worldwide gross or " + pkg.minRating + "+ rating." : "Eligible",
      durationWeeks: pkg.durationWeeks,
      upfront,
      weeklyRoyalty
    };
  }

  function signSyndicationDeal(filmId, pkgId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initSyndication(S);

    const film = (S.films || []).find(f => f.id === filmId);
    if(!film){
      return { ok: false, error: "Film not found in library." };
    }

    // Check if film already under an active syndication deal
    const existing = S.syndication.activeDeals.find(d => d.filmId === filmId);
    if(existing){
      return { ok: false, error: film.title + " is already under an active TV syndication contract (" + existing.weeksRemaining + " weeks remaining)." };
    }

    const offer = calculateSyndicationOffer(film, pkgId);
    if(!offer || !offer.eligible){
      return { ok: false, error: offer ? offer.reason : "Ineligible package." };
    }

    const deal = {
      id: "syn_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      filmId: film.id,
      filmTitle: film.title,
      pkgId: offer.pkgId,
      pkgName: offer.pkgName,
      weeksRemaining: offer.durationWeeks,
      totalDuration: offer.durationWeeks,
      upfrontBonus: offer.upfront,
      weeklyRoyalty: offer.weeklyRoyalty,
      totalCollected: offer.upfront,
      signedWeek: S.week
    };

    S.studio.cash = Math.round((S.studio.cash + offer.upfront) * 10) / 10;
    S.syndication.totalUpfrontEarned = Math.round(((S.syndication.totalUpfrontEarned || 0) + offer.upfront) * 10) / 10;
    S.syndication.activeDeals.push(deal);

    if(typeof log === "function"){
      log("Signed " + pkgId + " TV syndication package for \"" + film.title + "\": +$" + offer.upfront + "M upfront, +$" + offer.weeklyRoyalty + "M/wk for " + offer.durationWeeks + " wks.", "gold");
    }

    return { ok: true, deal };
  }

  function tickSyndicationWeekly(state){
    const S = _getG(state);
    if(!S) return { totalPayout: 0, expired: 0 };
    initSyndication(S);

    let totalPayout = 0;
    let expiredCount = 0;
    const remainingDeals = [];

    (S.syndication.activeDeals || []).forEach(deal => {
      deal.weeksRemaining -= 1;
      const payout = deal.weeklyRoyalty || 0;
      totalPayout += payout;
      deal.totalCollected = Math.round(((deal.totalCollected || 0) + payout) * 100) / 100;

      if(deal.weeksRemaining <= 0){
        expiredCount += 1;
        S.syndication.historicalDeals.push(deal);
      } else {
        remainingDeals.push(deal);
      }
    });

    totalPayout = Math.round(totalPayout * 100) / 100;
    S.syndication.activeDeals = remainingDeals;
    S.studio.cash = Math.round((S.studio.cash + totalPayout) * 10) / 10;
    S.syndication.totalRoyaltiesEarned = Math.round(((S.syndication.totalRoyaltiesEarned || 0) + totalPayout) * 10) / 10;

    return { totalPayout, expired: expiredCount };
  }

  function openSyndicationModal(){
    const S = _getG();
    if(!S) return;
    initSyndication(S);

    let h = "<h3>Television Syndication &amp; Broadcast Licensing</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>License library films to broadcast networks and cable syndication. Secure upfront rights payments and long-term weekly royalty streams.</div>";

    const activeCount = S.syndication.activeDeals.length;
    let currentWeeklyFlow = 0;
    S.syndication.activeDeals.forEach(d => currentWeeklyFlow += d.weeklyRoyalty);
    currentWeeklyFlow = Math.round(currentWeeklyFlow * 100) / 100;

    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v'>" + activeCount + "</div><div class='s-l'>Active TV Deals</div></div>"+
      "<div class='stat'><div class='s-v' style='color:var(--green)'>+$" + currentWeeklyFlow + "M/wk</div><div class='s-l'>Current Royalty Flow</div></div>"+
      "<div class='stat'><div class='s-v'>$" + (S.syndication.totalUpfrontEarned || 0) + "M</div><div class='s-l'>Total Upfront Banked</div></div>"+
      "<div class='stat'><div class='s-v'>$" + (S.syndication.totalRoyaltiesEarned || 0) + "M</div><div class='s-l'>Total Royalties Banked</div></div>"+
    "</div>";

    if(S.syndication.activeDeals.length){
      h += "<div class='section-title'>Active Television Broadcast Contracts</div><div class='card' style='margin-bottom:12px'>";
      S.syndication.activeDeals.forEach(d => {
        h += "<div class='spread' style='padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)'>"+
          "<div><b>\"" + esc(d.filmTitle) + "\"</b> <span class='tag gold'>" + esc(d.pkgName.split(" ")[0]) + "</span><div class='tiny muted'>" + d.weeksRemaining + "/" + d.totalDuration + " weeks left</div></div>"+
          "<div style='text-align:right'><b class='pos'>+$" + d.weeklyRoyalty + "M/wk</b><div class='tiny muted'>Collected: $" + d.totalCollected + "M</div></div>"+
        "</div>";
      });
      h += "</div>";
    }

    h += "<div class='section-title'>Available Library Titles for Syndication</div>";
    const libraryFilms = (S.films || []).filter(f => (f.ww || 0) > 0 && !S.syndication.activeDeals.some(ad => ad.filmId === f.id));

    if(!libraryFilms.length){
      h += "<div class='card muted small'>No uncommitted library films available for new syndication packages.</div>";
    } else {
      h += "<div class='grid g2'>";
      libraryFilms.slice(0, 10).forEach(f => {
        h += "<div class='card'>"+
          "<div class='spread'><b>\"" + esc(f.title) + "\"</b><span class='tag'>$" + (f.ww || 0) + "M WW</span></div>"+
          "<div class='tiny muted' style='margin:4px 0'>Rating: " + (f.review || f.score || 50) + "/100 · Year " + (f.year || 1) + "</div>"+
          "<div style='margin-top:8px;display:flex;gap:4px;flex-direction:column'>";
        SYNDICATION_PACKAGES.forEach(pkg => {
          const offer = calculateSyndicationOffer(f, pkg.id);
          h += "<div class='spread' style='padding:4px;background:rgba(255,255,255,0.02);border-radius:6px'>"+
            "<div class='tiny'><b>" + pkg.id.toUpperCase() + "</b> (" + pkg.durationWeeks + "w): +$" + offer.upfront + "M up, +$" + offer.weeklyRoyalty + "M/w</div>"+
            (offer.eligible ? (
              "<button class='btn btn-xs btn-primary' data-syndicate='" + f.id + ":" + pkg.id + "'>Sign</button>"
            ) : (
              "<span class='tiny muted'>Locked</span>"
            ))+
          "</div>";
        });
        h += "</div></div>";
      });
      h += "</div>";
    }

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    v.querySelectorAll("[data-syndicate]").forEach(b => {
      b.onclick = () => {
        const parts = b.dataset.syndicate.split(":");
        const res = signSyndicationDeal(+parts[0], parts[1]);
        if(res.ok){
          if(typeof beep === "function") beep("gold");
          closeModal();
          openSyndicationModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    });
  }

  const SyndicationModule = {
    SYNDICATION_PACKAGES,
    initSyndication,
    calculateSyndicationOffer,
    signSyndicationDeal,
    tickSyndicationWeekly,
    openSyndicationModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = SyndicationModule;
  }
  global.SyndicationModule = SyndicationModule;
  global.initSyndication = initSyndication;
  global.calculateSyndicationOffer = calculateSyndicationOffer;
  global.signSyndicationDeal = signSyndicationDeal;
  global.tickSyndicationWeekly = tickSyndicationWeekly;
  global.openSyndicationModal = openSyndicationModal;
})(typeof window !== "undefined" ? window : global);
