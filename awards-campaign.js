/* ═════════════════════════════════════════════════════════════════════════
   AWARDS-CAMPAIGN.JS — FYC (For Your Consideration) Awards Campaign Engine
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc & Box Office Sim 2 (Awards Campaign)
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

  const CAMPAIGN_TIERS = {
    trade_spread: {
      id: "trade_spread",
      name: "Trade Print & Digital Spreads",
      cost: 0.75, // $0.75M ($750k)
      lobbyingBuff: 12,
      prestigeGain: 5,
      desc: "Full-page FYC ads across Variety, The Hollywood Reporter, and Deadline Hollywood."
    },
    screener_blitz: {
      id: "screener_blitz",
      name: "Digital Screeners & Voter Mailings",
      cost: 1.5, // $1.5M
      lobbyingBuff: 25,
      prestigeGain: 12,
      desc: "Exclusive voter portal access and physical presentation screener boxes sent to all voting branch members."
    },
    voter_receptions: {
      id: "voter_receptions",
      name: "Voter Galas & Director Q&As",
      cost: 3.0, // $3.0M
      lobbyingBuff: 45,
      prestigeGain: 25,
      desc: "Private guild screenings followed by curated receptions in London, New York, and Los Angeles."
    },
    grand_blitz: {
      id: "grand_blitz",
      name: "Full Industry Blitz Campaign",
      cost: 5.5, // $5.5M
      lobbyingBuff: 75,
      prestigeGain: 40,
      desc: "All-inclusive aggressive awards push with billboard takeovers, private lobbying dinners, and heavy PR junkets."
    }
  };

  const AWARD_CATEGORIES = [
    { id: "best_picture", name: "Best Picture", weight: 1.0 },
    { id: "best_director", name: "Best Director", weight: 0.8 },
    { id: "best_lead_actor", name: "Best Actor in a Leading Role", weight: 0.7 },
    { id: "best_lead_actress", name: "Best Actress in a Leading Role", weight: 0.7 },
    { id: "best_screenplay", name: "Best Original Screenplay", weight: 0.6 },
    { id: "best_vfx", name: "Best Visual Effects", weight: 0.5 },
    { id: "best_soundtrack", name: "Best Original Score", weight: 0.5 }
  ];

  function initAwardsCampaign(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.awardsCampaigns){
      S.awardsCampaigns = {
        active: [],
        history: []
      };
    }
    return S.awardsCampaigns;
  }

  function launchCampaign(filmId, tierId, categoryId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initAwardsCampaign(S);

    const tier = CAMPAIGN_TIERS[tierId];
    if(!tier) return { ok: false, msg: "Unknown campaign tier: " + tierId };

    const film = (S.films || []).find(f => f.id === filmId || f.title === filmId);
    if(!film) return { ok: false, msg: "Film not found" };

    const cashAvailable = _getCashM(S);
    if(cashAvailable < tier.cost){
      return { ok: false, msg: "Insufficient cash. Required: $" + tier.cost + "M" };
    }

    if(!film.campaigns){
      film.campaigns = [];
    }

    const existing = film.campaigns.find(c => c.categoryId === categoryId);
    if(existing){
      return { ok: false, msg: "A campaign for category " + categoryId + " is already active for this film" };
    }

    _modCashM(S, -tier.cost);

    const entry = {
      filmId: film.id,
      filmTitle: film.title,
      tierId: tier.id,
      tierName: tier.name,
      categoryId: categoryId || "best_picture",
      cost: tier.cost,
      lobbyingBuff: tier.lobbyingBuff,
      weekLaunched: S.week || 1,
      year: S.year || 1
    };

    film.campaigns.push(entry);
    film.awardsLobbyingScore = (film.awardsLobbyingScore || 0) + tier.lobbyingBuff;
    S.awardsCampaigns.active.push(entry);

    if(S.studio && typeof S.studio.rep === "number"){
      S.studio.rep = Math.min(100, S.studio.rep + Math.round(tier.prestigeGain / 5));
    }

    if(typeof log === "function"){
      log("Launched " + tier.name + " FYC campaign for '" + film.title + "' (-$" + tier.cost + "M). Lobbying score +" + tier.lobbyingBuff + ".", "gold");
    }

    return { ok: true, campaign: entry, msg: "Campaign launched successfully" };
  }

  function getFilmAwardsLobbying(film){
    if(!film) return 0;
    let score = film.awardsLobbyingScore || 0;
    if(film.campaigns && Array.isArray(film.campaigns)){
      score = film.campaigns.reduce((acc, c) => acc + (c.lobbyingBuff || 0), 0);
    }
    return score;
  }

  function getActiveCampaigns(state){
    const S = _getG(state);
    if(!S) return [];
    initAwardsCampaign(S);
    return S.awardsCampaigns.active || [];
  }

  function openAwardsCampaignModal(preselectedFilmId){
    const S = _getG();
    if(!S) return;
    initAwardsCampaign(S);

    const eligibleFilms = (S.films || []).filter(f => f.inTheaters || f.gross > 0 || (f.status && f.status.includes("release")));
    const selectedFilm = eligibleFilms.find(f => f.id === preselectedFilmId || f.title === preselectedFilmId) || eligibleFilms[0];

    let h = "<h3>For Your Consideration (FYC) Awards Campaign</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Lobby academy and guild voting branches with trade print spreads, private screener deliveries, and gala receptions to elevate nomination & award probabilities.</div>";

    if(!selectedFilm){
      h += "<div class='card tiny muted'>No eligible released productions available for awards consideration. Release a feature film first.</div>";
      if(typeof openModal === "function") openModal(h);
      return;
    }

    h += "<div class='card' style='margin-bottom:12px'>"+
      "<div class='spread'><b>" + (selectedFilm.title || "Film") + "</b><span class='tag gold'>Quality: " + (selectedFilm.quality || 70) + "</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Current Awards Lobbying Score: +" + getFilmAwardsLobbying(selectedFilm) + " pts</div>"+
    "</div>";

    h += "<div class='section-title'>Select Campaign Tier</div><div class='grid g2'>";
    for(const key in CAMPAIGN_TIERS){
      const tier = CAMPAIGN_TIERS[key];
      const hasTier = (selectedFilm.campaigns || []).some(c => c.tierId === tier.id);
      h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
        "<div>"+
          "<div class='spread'><b>" + tier.name + "</b><span class='tag'>$" + tier.cost + "M</span></div>"+
          "<div class='tiny muted' style='margin:6px 0'>" + tier.desc + "</div>"+
          "<div class='tiny' style='color:var(--gold)'>Lobbying: +" + tier.lobbyingBuff + " pts | Prestige: +" + tier.prestigeGain + "</div>"+
        "</div>"+
        "<div style='margin-top:10px'>"+
          (hasTier ? (
            "<button class='btn btn-sm' style='width:100%' disabled>Active</button>"
          ) : (
            "<button class='btn btn-sm btn-primary' style='width:100%' data-fyc='" + tier.id + "' data-filmid='" + selectedFilm.id + "'>Launch Campaign</button>"
          ))+
        "</div>"+
      "</div>";
    }
    h += "</div>";

    if(typeof openModal === "function"){
      const v = openModal(h);
      if(v){
        v.querySelectorAll("[data-fyc]").forEach(btn => {
          btn.onclick = () => {
            const res = launchCampaign(btn.dataset.filmid, btn.dataset.fyc, "best_picture", S);
            if(res.ok){
              if(typeof toast === "function") toast("FYC campaign launched successfully!", "good");
              openAwardsCampaignModal(btn.dataset.filmid);
              if(typeof render === "function") render();
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          };
        });
      }
    }
  }

  const AwardsCampaignAPI = {
    CAMPAIGN_TIERS,
    AWARD_CATEGORIES,
    initAwardsCampaign,
    launchCampaign,
    getFilmAwardsLobbying,
    getActiveCampaigns,
    openAwardsCampaignModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = AwardsCampaignAPI;
  }
  global.AwardsCampaign = AwardsCampaignAPI;
  global.openAwardsCampaignModal = openAwardsCampaignModal;
})(typeof window !== "undefined" ? window : global);
