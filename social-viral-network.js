/* ═════════════════════════════════════════════════════════════════════════
   SOCIAL-VIRAL-NETWORK.JS — Viral Digital Marketing, CineTok & Creator Deals
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Social Dev Story (v2.5.1)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  function _getG(st){
    if(st && typeof st === "object" && (st.studio || st.projects || st.cash !== undefined)) return st;
    if(typeof G !== "undefined") return G;
    if(typeof global !== "undefined" && global.G) return global.G;
    if(typeof window !== "undefined" && window.G) return window.G;
    return null;
  }

  function _modCash(S, deltaM){
    if(S && S.studio && typeof S.studio.cash === "number"){
      S.studio.cash = Math.round((S.studio.cash + deltaM) * 100) / 100;
    } else if(S && typeof S.cash === "number"){
      S.cash = Math.round((S.cash + deltaM) * 100) / 100;
    }
  }

  // 1. Social Platforms
  const SOCIAL_PLATFORMS = [
    { id: "cinetok", name: "CineTok", icon: "📱", audience: "Gen-Z & Teens", algorithm: "High Virality", reachMult: 1.4 },
    { id: "blabber", name: "Blabber (X)", icon: "💬", audience: "Critics & Industry Insiders", algorithm: "Fast News Waves", reachMult: 1.1 },
    { id: "reelit", name: "Reelit", icon: "📸", audience: "Millennials & Fashion", algorithm: "Visual Glamour", reachMult: 1.2 },
    { id: "boxmoji", name: "BoxMoji Reddit", icon: "🤖", audience: "Film Buffs & Gamers", algorithm: "Deep Memes & Theories", reachMult: 1.3 }
  ];

  // 2. Live Ops Viral Marketing Campaigns (Social Dev Story Parity)
  const VIRAL_CAMPAIGNS = [
    {
      id: "tiktok_dance",
      name: "TikTok Audio & Dance Challenge",
      cost: 1.5,
      buzzBoost: 25,
      boxOfficeLegs: 0.15,
      desc: "Contract top short-form choreographers to turn the main theme song into a global viral trend."
    },
    {
      id: "streamer_raid",
      name: "Streamer & Influencer Early-Access",
      cost: 2.5,
      buzzBoost: 40,
      boxOfficeLegs: 0.12,
      desc: "Equip 50 leading Twitch & YouTube creators with VIP preview screening reaction licenses."
    },
    {
      id: "meme_warfare",
      name: "Organic Meme Warfare Blitz",
      cost: 0.8,
      buzzBoost: 18,
      boxOfficeLegs: 0.10,
      desc: "Seed high-context ironic reaction GIFs across Reddit and social forums to dominate pop culture."
    },
    {
      id: "cast_ama",
      name: "Cast Live AMA & Discord Townhall",
      cost: 1.2,
      buzzBoost: 22,
      boxOfficeLegs: 0.08,
      desc: "Direct celebrity fan interactions that soften harsh critic reviews and boost fan goodwill (+8 Rep)."
    },
    {
      id: "red_carpet_live",
      name: "Global Red Carpet Livestream Event",
      cost: 3.5,
      buzzBoost: 50,
      boxOfficeLegs: 0.20,
      desc: "Stream the world premiere in 4K with interactive chat and exclusive merch drops (#1 Trending guarantee)."
    },
    {
      id: "review_defense",
      name: "Anti-Brigade Review Defense Bot Shield",
      cost: 2.0,
      buzzBoost: 10,
      boxOfficeLegs: 0.15,
      desc: "Deploy automated sentiment monitoring and verified ticket-buyer weighting against review bombs."
    }
  ];

  // 3. Digital Brand Ambassadors & Content Creator Roster
  const CREATOR_ROSTER = [
    { id: "kai_cinemas", name: "Kai FilmStreams", reach: "14.2M Subs", fee: 1.8, specialty: "Action & Tentpole", perk: "+25% Opening Weekend Buzz" },
    { id: "valkyrie_review", name: "Valkyrie Plays", reach: "8.5M Subs", fee: 1.2, specialty: "Games & Sci-Fi", perk: "+30% Game Adaptation Hype" },
    { id: "popcorn_patrol", name: "Popcorn Patrol Podcast", reach: "5.1M Subs", fee: 0.7, specialty: "Indie & Mystery", perk: "+12 Critic Score Defense" },
    { id: "pixel_pete", name: "Pixel Pete Retro", reach: "4.8M Subs", fee: 0.6, specialty: "Animation & Family", perk: "+20% Family Audience Legs" }
  ];

  function _ensureSocialState(G){
    if(!G) return;
    if(!G.socialOps) G.socialOps = {};
    const so = G.socialOps;
    if(!so.activeCampaigns) so.activeCampaigns = [];
    if(!so.creatorDeals) so.creatorDeals = [];
    if(!so.trendingHashtags) so.trendingHashtags = [
      { tag: "#BoxOfficeWar", platform: "CineTok", volume: "1.4M", sentiment: "positive" },
      { tag: "#StudioPremiere", platform: "Blabber (X)", volume: "850K", sentiment: "positive" },
      { tag: "#OscarsBuzz", platform: "Reelit", volume: "620K", sentiment: "neutral" },
      { tag: "#FilmTheories", platform: "BoxMoji Reddit", volume: "490K", sentiment: "positive" }
    ];
  }

  // 4. Launch Social Campaign
  function launchSocialCampaign(campaignId, targetFilmId){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureSocialState(G);

    const camp = VIRAL_CAMPAIGNS.find(c => c.id === campaignId);
    if(!camp) return { ok: false, msg: "Invalid campaign" };

    if((G.studio ? G.studio.cash : G.cash) < camp.cost){
      return { ok: false, msg: "Insufficient cash: $" + camp.cost + "M required." };
    }

    _modCash(G, -camp.cost);

    // Find target film
    let targetTitle = "Active Slate";
    if(targetFilmId && G.films){
      const f = G.films.find(x => x.id === targetFilmId);
      if(f){
        targetTitle = f.title;
        f.social = f.social || { hype: 0, memes: 0, theories: 0, controversy: 0 };
        f.social.hype = (f.social.hype || 0) + camp.buzzBoost;
        f.legs = (f.legs || 1.0) + camp.boxOfficeLegs;
      }
    }

    const activeRecord = {
      id: "camp_" + Date.now(),
      campaign: camp,
      targetTitle: targetTitle,
      weeksActive: 4,
      whenWeek: G.week || 1
    };
    G.socialOps.activeCampaigns.push(activeRecord);

    // Refresh hashtags
    G.socialOps.trendingHashtags.unshift({
      tag: "#" + targetTitle.replace(/[^a-zA-Z0-9]/g, "") + "Trending",
      platform: "CineTok",
      volume: "3.2M",
      sentiment: "viral"
    });
    if(G.socialOps.trendingHashtags.length > 6) G.socialOps.trendingHashtags.pop();

    if(typeof log === "function"){
      log("📱 Social Media Blitz: Deployed " + camp.name + " for \"" + targetTitle + "\"! + " + camp.buzzBoost + " Buzz, +" + Math.round(camp.boxOfficeLegs*100) + "% Box Office Legs.", "gold");
    }

    return { ok: true, campaign: camp };
  }

  // 5. Sign Creator Deal
  function signCreatorDeal(creatorId){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureSocialState(G);

    const cr = CREATOR_ROSTER.find(c => c.id === creatorId);
    if(!cr) return { ok: false, msg: "Creator not found" };

    if((G.studio ? G.studio.cash : G.cash) < cr.fee){
      return { ok: false, msg: "Insufficient funds to sign " + cr.name };
    }

    _modCash(G, -cr.fee);
    G.socialOps.creatorDeals.push({
      creator: cr,
      signedWeek: G.week || 1,
      durationWeeks: 12
    });

    if(typeof log === "function"){
      log("🤝 Signed Digital Creator: " + cr.name + " (" + cr.reach + ") joined studio ambassador roster! " + cr.perk, "gold");
    }

    return { ok: true, creator: cr };
  }

  // 6. Interactive Social Modal
  function openSocialControlModal(){
    const G = _getG();
    if(!G) return;
    _ensureSocialState(G);

    const activeFilms = (G.films || []).filter(f => f.active || f.inTheaters || (f.weeksInRelease && f.weeksInRelease <= 12));

    let h = `
      <div class="modal-head">
        <h3>📱 Social Media &amp; Viral Control Room (Social Dev Story)</h3>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding-right:8px">
        <p class="small muted">Synthesized from <b>Social Dev Story</b>. Real-time platform radar, trending hashtag surveillance, viral influencer blitzes, and sentiment moderation.</p>

        <!-- Platform Radar -->
        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:6px">Active Social Platforms</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:8px">
            ${SOCIAL_PLATFORMS.map(p => `
              <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:8px">
                <div style="font-weight:700;font-size:13px">${p.icon} ${p.name}</div>
                <div class="tiny muted">${p.audience}</div>
                <div class="tiny" style="color:#38ef7d;margin-top:2px">${p.algorithm}</div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Trending Board -->
        <div class="card" style="margin-bottom:12px;background:rgba(0,0,0,0.3)">
          <div class="spread" style="margin-bottom:6px">
            <b>🔥 Real-Time Trending Hashtags</b>
            <span class="tag green tiny">Live State</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(G.socialOps.trendingHashtags || []).map(th => `
              <span class="tag ${th.sentiment==='viral'?'gold':th.sentiment==='positive'?'green':'blue'}" style="font-size:12px;padding:4px 8px">
                ${th.tag} <span class="tiny muted">(${th.volume})</span>
              </span>
            `).join("")}
          </div>
        </div>

        <!-- Target Film -->
        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:4px">Target Release / Production</div>
          <select id="socialTargetFilmSelect" style="width:100%;padding:8px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid #444;color:#fff">
            ${activeFilms.length ? activeFilms.map(f => `<option value="${f.id}">${f.title} (${f.genre})</option>`).join("") : `<option value="">Entire Studio Slate</option>`}
          </select>
        </div>

        <!-- Viral Campaigns Grid -->
        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:8px">Deploy Viral Campaign</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${VIRAL_CAMPAIGNS.map(c => `
              <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.04);padding:8px 12px;border-radius:8px">
                <div style="flex:1;margin-right:12px">
                  <b style="font-size:13px">${c.name}</b>
                  <div class="tiny muted">${c.desc}</div>
                  <div class="tiny" style="color:#38ef7d;margin-top:2px">+${c.buzzBoost} Buzz · +${Math.round(c.boxOfficeLegs*100)}% Box Office Legs</div>
                </div>
                <button class="btn btn-sm btn-alt" onclick="SocialViralNetwork.launchSocialCampaign('${c.id}', document.getElementById('socialTargetFilmSelect').value); closeModal(); if(typeof render==='function')render();">
                  Deploy ($${c.cost}M)
                </button>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Creator Ambassadors -->
        <div class="card">
          <div class="spread" style="margin-bottom:8px">
            <b>🌟 Creator Ambassador Program</b>
            <span class="tiny muted">${(G.socialOps.creatorDeals||[]).length} signed</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:8px">
            ${CREATOR_ROSTER.map(cr => `
              <div style="background:rgba(255,255,255,0.04);padding:8px;border-radius:8px">
                <div style="font-weight:700;font-size:13px">${cr.name}</div>
                <div class="tiny muted">${cr.reach} · ${cr.specialty}</div>
                <div class="tiny" style="color:#d4af37;margin:3px 0">${cr.perk}</div>
                <button class="btn btn-xs btn-alt" style="width:100%;margin-top:4px" onclick="SocialViralNetwork.signCreatorDeal('${cr.id}'); closeModal(); if(typeof render==='function')render();">
                  Sign ($${cr.fee}M)
                </button>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-primary" onclick="closeModal()">Close</button>
      </div>
    `;

    openModal(h);
  }

  // Export module
  const SocialViralNetwork = {
    SOCIAL_PLATFORMS: SOCIAL_PLATFORMS,
    VIRAL_CAMPAIGNS: VIRAL_CAMPAIGNS,
    CREATOR_ROSTER: CREATOR_ROSTER,
    launchSocialCampaign: launchSocialCampaign,
    signCreatorDeal: signCreatorDeal,
    openSocialControlModal: openSocialControlModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = SocialViralNetwork;
  }
  global.SocialViralNetwork = SocialViralNetwork;
  global.openSocialControlModal = openSocialControlModal;

})(typeof window !== "undefined" ? window : global);
