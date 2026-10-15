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
              if(typeof beep === "function") beep("camera");
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

  function showAwardTrophyCeremony(awardTitle, filmTitle, nominee){
    if(typeof openModal !== "function") return;
    if(typeof beep === "function"){
      beep("fanfare");
      setTimeout(() => beep("cheer"), 450);
    }
    if(typeof confetti === "function"){
      confetti({ count: 160 });
    }

    let h = "<div style='text-align:center;padding:16px 8px;position:relative;overflow:hidden'>";
    h += "<div style='position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle, rgba(245,185,66,0.18) 0%, transparent 70%);pointer-events:none'></div>";
    h += "<div style='font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);font-weight:700'>Academy of Motion Picture Arts &amp; Sciences</div>";
    h += "<h2 style='margin:8px 0 4px;color:var(--gold)'>" + esc(awardTitle || "Best Picture") + " Winner</h2>";
    h += "<div class='tiny muted' style='margin-bottom:14px'>The envelope has been unsealed. Worldwide industry standing elevated.</div>";

    // Animated Golden Trophy SVG
    h += "<div style='margin:16px auto;width:96px;height:120px;filter:drop-shadow(0 0 16px rgba(245,185,66,0.6));animation:trophyFloat 2.4s ease-in-out infinite alternate'>";
    h += "<svg viewBox='0 0 64 80' width='100%' height='100%' fill='none' xmlns='http://www.w3.org/2000/svg'>";
    h += "<circle cx='32' cy='14' r='8' fill='#ffd479' stroke='#b88628' stroke-width='1.5'/>";
    h += "<path d='M26 22 L38 22 L35 48 L29 48 Z' fill='#f5b942' stroke='#b88628' stroke-width='1.5'/>";
    h += "<path d='M22 26 L26 36 M42 26 L38 36' stroke='#ffd479' stroke-width='2' stroke-linecap='round'/>";
    h += "<rect x='25' y='48' width='14' height='6' rx='1' fill='#ffd479'/>";
    h += "<rect x='20' y='54' width='24' height='12' rx='2' fill='#1e2636' stroke='#f5b942' stroke-width='1.5'/>";
    h += "<rect x='16' y='66' width='32' height='6' rx='1' fill='#111722' stroke='#b88628' stroke-width='1'/>";
    h += "</svg>";
    h += "</div>";

    h += "<div class='card film-frame-gold' style='margin:12px auto;max-width:380px;padding:12px'>";
    h += "<div style='font-size:18px;font-weight:800;color:var(--text)'>“" + esc(filmTitle || "Masterpiece") + "”</div>";
    if(nominee) h += "<div class='tiny muted' style='margin-top:4px'>Honoring: " + esc(nominee) + "</div>";
    h += "<div class='tiny' style='color:var(--gold);margin-top:6px'>+40 Studio Reputation | Box Office Re-Release Momentum</div>";
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:16px'><button class='btn btn-primary' onclick='closeModal()'>Accept Award with Honor</button></div>";
    h += "</div>";

    openModal(h);
  }

  const AwardsCampaignAPI = {
    CAMPAIGN_TIERS,
    AWARD_CATEGORIES,
    initAwardsCampaign,
    launchCampaign,
    getFilmAwardsLobbying,
    getActiveCampaigns,
    openAwardsCampaignModal,
    showAwardTrophyCeremony
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = AwardsCampaignAPI;
  }
  global.AwardsCampaign = AwardsCampaignAPI;
  global.openAwardsCampaignModal = openAwardsCampaignModal;
  global.showAwardTrophyCeremony = showAwardTrophyCeremony;
})(typeof window !== "undefined" ? window : global);
