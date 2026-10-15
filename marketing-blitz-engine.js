/* ═════════════════════════════════════════════════════════════════════════
   MARKETING-BLITZ-ENGINE.JS — Super Bowl Ads, Comic-Con & Viral Campaigns
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc & Social Dev Story
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

  // Marketing Campaign Tiers
  const MARKETING_TIERS = [
    {
      id: "viral_guerrilla",
      name: "Viral Guerrilla Street Stunts & TikTok Leaks",
      costM: 0.50, // $500k
      buzzBonus: 15,
      demographicFocus: "teens",
      desc: "Subversive mysterious ARGs, pop-up installations, and staged viral videos capturing youth fandom."
    },
    {
      id: "late_night_junket",
      name: "Late-Night TV Talk Show & Press Junket Circuit",
      costM: 1.20, // $1.2M
      buzzBonus: 22,
      demographicFocus: "young_adults",
      desc: "Lead stars booked across Fallon, Kimmel, and Graham Norton for comedy sketches and prime interviews."
    },
    {
      id: "fast_food_tiein",
      name: "Global Fast-Food Kids Meal Toy Partnership",
      costM: 2.50, // $2.5M
      buzzBonus: 28,
      demographicFocus: "kids_family",
      desc: "Plastic figurine collectibles packed into 50 million kids meal boxes across North America and Europe."
    },
    {
      id: "comic_con_hall_h",
      name: "San Diego Comic-Con Hall H Extravaganza",
      costM: 3.50, // $3.5M
      buzzBonus: 35,
      demographicFocus: "young_adults",
      desc: "Star-studded Hall H reveal with exclusive trailers, concept art drops, and roaring 6,000-seat fan mania."
    },
    {
      id: "super_bowl_ad",
      name: "Super Bowl Sunday 30-Second Commercial Spot",
      costM: 8.00, // $8.0M
      buzzBonus: 50,
      demographicFocus: "all",
      desc: "The ultimate marketing spectacle watched live by 125 million viewers, locking guaranteed blockbuster awareness."
    }
  ];

  function initMarketingBlitz(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.marketingBlitz){
      S.marketingBlitz = {
        executedCampaigns: [],
        totalMarketingSpend: 0,
        superBowlSpotsAired: 0,
        hallHAppearances: 0
      };
    }
    return S.marketingBlitz;
  }

  // Launch a Marketing Campaign on an Active Project
  function launchCampaign(projectId, campaignId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initMarketingBlitz(S);

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found." };

    if(proj.released){
      return { ok: false, msg: "Cannot market an already released picture." };
    }

    const camp = MARKETING_TIERS.find(c => c.id === campaignId);
    if(!camp) return { ok: false, msg: "Campaign tier not found." };

    proj.activeCampaigns = proj.activeCampaigns || [];
    if(proj.activeCampaigns.includes(camp.id)){
      return { ok: false, msg: "This campaign is already active for this title." };
    }

    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < camp.costM){
      return { ok: false, msg: "Insufficient marketing funds ($" + camp.costM + "M required)." };
    }

    _modCash(S, -camp.costM);
    proj.activeCampaigns.push(camp.id);
    proj.buzz = Math.min(100, (proj.buzz || 50) + camp.buzzBonus);

    S.marketingBlitz.totalMarketingSpend += camp.costM;
    if(camp.id === "super_bowl_ad") S.marketingBlitz.superBowlSpotsAired += 1;
    if(camp.id === "comic_con_hall_h") S.marketingBlitz.hallHAppearances += 1;

    S.marketingBlitz.executedCampaigns.push({
      campaignId: camp.id,
      campaignName: camp.name,
      projectTitle: proj.title,
      costM: camp.costM,
      buzzBonus: camp.buzzBonus,
      week: S.week || 1
    });

    if(typeof log === "function"){
      log("[MARKETING BLITZ] Launched " + camp.name + " on \"" + proj.title + "\" (-$" + camp.costM + "M). Buzz skyrocketed to " + proj.buzz + "/100.", "gold");
    }

    return { ok: true, msg: camp.name + " launched (+ " + camp.buzzBonus + " Buzz)!" };
  }

  // UI Renderer Section
  function renderMarketingBlitzSection(state){
    const S = _getG(state);
    if(!S) return "";
    initMarketingBlitz(S);

    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>High-Impact Marketing Blitz Campaigns</b><span class='tag gold'>$" + S.marketingBlitz.totalMarketingSpend.toFixed(1) + "M Spent</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Super Bowl prime-time spots, San Diego Comic-Con Hall H showcases, and viral guerrilla street campaigns (Box Office Inc parity).</div>";

    h += "<div class='stat-hero' style='margin-bottom:10px'>" +
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + S.marketingBlitz.superBowlSpotsAired + "</div><div class='s-l'>Super Bowl Commercials</div></div>" +
      "<div class='stat'><div class='s-v'>" + S.marketingBlitz.hallHAppearances + "</div><div class='s-l'>Hall H Showcases</div></div>" +
      "<div class='stat'><div class='s-v'>" + S.marketingBlitz.executedCampaigns.length + "</div><div class='s-l'>Total Campaigns Deployed</div></div>" +
    "</div>";

    h += "<div class='grid g2' style='gap:8px;margin-bottom:10px'>";
    MARKETING_TIERS.forEach(c => {
      h += "<div style='background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border-left:3px solid var(--gold)'>" +
        "<div class='spread'><b>" + c.name.split(" ")[0] + " " + (c.name.split(" ")[1]||"") + "</b><span class='tag gold'>$" + c.costM + "M</span></div>" +
        "<div class='tiny muted' style='margin-top:2px'>" + c.desc + "</div>" +
        "<div class='tiny' style='color:var(--green);margin-top:4px'>Buzz Boost: +" + c.buzzBonus + " pts | Target: " + c.demographicFocus.toUpperCase() + "</div>" +
      "</div>";
    });
    h += "</div>";

    h += "<button class='btn btn-sm btn-primary' id='btnOpenMarketingBlitzModal' style='width:100%'>Open Marketing Blitz Command</button>";
    h += "</div>";
    return h;
  }

  // Open Full Marketing Blitz Modal
  function openMarketingBlitzModal(state){
    const S = _getG(state);
    if(!S) return;
    initMarketingBlitz(S);

    const unreleased = (S.projects || []).filter(p => !p.released);

    function renderInner(){
      let h = "<h3>Marketing Blitz &amp; Fandom Command Center</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Deploy high-impact marketing packages to maximize opening weekend awareness, fan fever, and trailer view records.</p>";

      if(!unreleased.length){
        h += "<div class='card' style='text-align:center;padding:16px'><div class='tiny muted'>No active unreleased projects available to market. Start a film in development first.</div></div>";
      } else {
        h += "<div class='section-title'>Active Slate Projects</div>";
        unreleased.forEach(p => {
          const activeCamps = p.activeCampaigns || [];
          h += "<div class='card' style='margin-bottom:8px'>" +
            "<div class='spread'><b>" + p.title + "</b><span class='tag gold'>Buzz: " + (p.buzz || 50) + "/100</span></div>" +
            "<div class='tiny muted' style='margin:4px 0 8px'>Genre: " + (p.genre || "Action") + " | Active Campaigns: " + (activeCamps.length ? activeCamps.join(", ") : "None") + "</div>" +
            "<div style='display:flex;gap:6px;flex-wrap:wrap'>" +
              MARKETING_TIERS.map(c => {
                const already = activeCamps.includes(c.id);
                return already ? "<button class='btn btn-xs' disabled>" + c.name.split(" ")[0] + " Active</button>"
                               : "<button class='btn btn-xs btn-alt btnLaunchCamp' data-proj-id='" + p.id + "' data-camp-id='" + c.id + "'>Deploy " + c.name.split(" ")[0] + " ($" + c.costM + "M)</button>";
              }).join("") +
            "</div>" +
          "</div>";
        });
      }

      h += renderMarketingBlitzSection(S);
      return h;
    }

    function wireEvents(container){
      container.querySelectorAll(".btnLaunchCamp").forEach(btn => {
        btn.onclick = () => {
          const res = launchCampaign(btn.dataset.projId, btn.dataset.campId, S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
            if(typeof render === "function") render();
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      });
    }

    const initialHtml = "<div id='mktgModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#mktgModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const S = _getG(state);

    const bMkt = root.querySelector("#btnOpenMarketingBlitzModal");
    if(bMkt){
      bMkt.onclick = () => {
        openMarketingBlitzModal(state);
      };
    }
  }

  const MarketingBlitzAPI = {
    MARKETING_TIERS,
    initMarketingBlitz,
    launchCampaign,
    renderMarketingBlitzSection,
    openMarketingBlitzModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = MarketingBlitzAPI;
  }
  global.MarketingBlitz = MarketingBlitzAPI;
  global.openMarketingBlitzModal = openMarketingBlitzModal;
})(typeof window !== "undefined" ? window : global);
