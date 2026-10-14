/* ═════════════════════════════════════════════════════════════════════════
   LIVE-OPS-COPRODUCTION.JS — Blind-Box Scouting, Seasonal Events, Decor & Co-Pro
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

  // 1. Gacha Blind-Box Scouting Rarity Drops
  const GACHA_RARITIES = [
    { id: "common", name: "Working Pro (Common)", weight: 70, minSkill: 55, power: 2 },
    { id: "rare", name: "Rising Star (Rare)", weight: 22, minSkill: 72, power: 3 },
    { id: "super_rare", name: "Marquee Lead (Super Rare SR)", weight: 7, minSkill: 84, power: 4 },
    { id: "ultra_rare", name: "Industry Icon (Ultra Rare UR)", weight: 1, minSkill: 95, power: 5 }
  ];

  // 2. Rotating Seasonal Live Events & Festival Passports
  const SEASONAL_EVENTS = [
    {
      id: "summer_horror_nights",
      name: "Summer Midnight Horror Screams",
      durationWeeks: 4,
      boostGenre: "horror",
      boostMultiplier: 1.40,
      rewardBonusCash: 15.0,
      targetGross: 100, // Deliver $100M BO in Horror
      desc: "Box office returns on Horror pictures amplified by +40% during late summer midnight screenings."
    },
    {
      id: "holiday_family_cheer",
      name: "Holiday Winter Family Carnival",
      durationWeeks: 4,
      boostGenre: "animation",
      boostMultiplier: 1.50,
      rewardBonusCash: 25.0,
      targetGross: 150,
      desc: "Massive family cinema turnout doubling Animation and Adventure ticket receipts."
    },
    {
      id: "sci_fi_future_con",
      name: "Global Sci-Fi FutureCon Expo",
      durationWeeks: 4,
      boostGenre: "scifi",
      boostMultiplier: 1.35,
      rewardBonusCash: 20.0,
      targetGross: 120,
      desc: "Global fandom surge generating explosive buzz multipliers on Sci-Fi and Fantasy tentpoles."
    }
  ];

  // 3. Studio Workstation & Floor Decor Buffs
  const STUDIO_AMENITIES = [
    {
      id: "espresso_bar",
      name: "Barista Espresso Lounge",
      cost: 1.5,
      buffText: "All active writing and editing phases gain +5% weekly speed.",
      code: "speed_boost"
    },
    {
      id: "writers_retreat",
      name: "Soundproof Screenwriters' Solarium",
      cost: 2.5,
      buffText: "+10% screenplay quality rating across all developed scripts.",
      code: "script_quality"
    },
    {
      id: "private_screening_room",
      name: "4K Dolby Atmos Private Screening Room",
      cost: 4.0,
      buffText: "+15% test-screening audience score accuracy and buzz preservation.",
      code: "screening_boost"
    },
    {
      id: "trophy_gallery",
      name: "Marble Awards & Golden Plaque Gallery",
      cost: 3.0,
      buffText: "Permanent +5 Studio Reputation boost and improves A-list hire odds.",
      code: "rep_buff"
    }
  ];

  // 4. Co-Production Studio Alliances
  const RIVAL_ALLIANCES = [
    {
      id: "titan_mega",
      name: "Titan Pictures Co-Financing Pact",
      costSharePct: 0.50, // They pay 50% of budget
      revSharePct: 0.50,  // They get 50% of global BO
      partnerRep: 85,
      desc: "Split $300M+ mega-tentpole production expenses 50/50 to eliminate downside risk."
    },
    {
      id: "horizon_indie",
      name: "Horizon Film Syndicate Co-Op",
      costSharePct: 0.40,
      revSharePct: 0.40,
      partnerRep: 70,
      desc: "Co-produce mid-budget awards contenders with shared festival marketing capital."
    }
  ];

  function initLiveOpsCoPro(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.liveOpsCoPro){
      S.liveOpsCoPro = {
        scoutPullsCount: 0,
        activeSeasonalEvent: SEASONAL_EVENTS[0].id,
        eventProgressGross: 0,
        ownedAmenities: [],
        coProductionDeals: []
      };
    }
    return S.liveOpsCoPro;
  }

  // Pull a Gacha Talent Scout
  function pullGachaTalentScout(state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initLiveOpsCoPro(S);

    const pullCost = 3.0; // $3.0M per pull
    if((S.studio ? S.studio.cash : S.cash) < pullCost){
      return { ok: false, msg: "Insufficient cash for talent scouting ($" + pullCost + "M required)." };
    }

    _modCash(S, -pullCost);

    // Roll rarity
    const roll = Math.floor(Math.random() * 100);
    let chosenRarity = GACHA_RARITIES[0];
    if(roll >= 99){
      chosenRarity = GACHA_RARITIES[3]; // Ultra Rare UR
    } else if(roll >= 92){
      chosenRarity = GACHA_RARITIES[2]; // Super Rare SR
    } else if(roll >= 70){
      chosenRarity = GACHA_RARITIES[1]; // Rare
    }

    const firstNames = (typeof DATA !== "undefined" && DATA.FIRST_M) ? DATA.FIRST_M : ["Alexander","Julian","Victor","Elena","Sophia"];
    const lastNames = (typeof DATA !== "undefined" && DATA.LAST) ? DATA.LAST : ["Vance","Sterling","Cross","Blackwood","Winter"];
    const name = firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];

    const newTalent = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name,
      kind: "actor",
      power: chosenRarity.power,
      skill: chosenRarity.minSkill + Math.floor(Math.random() * 10),
      salary: chosenRarity.power * 0.4,
      fee: chosenRarity.power * 2.5,
      rarityTag: chosenRarity.name,
      scouted: true
    };

    S.talent = S.talent || [];
    S.talent.push(newTalent);
    S.liveOpsCoPro.scoutPullsCount = (S.liveOpsCoPro.scoutPullsCount || 0) + 1;

    if(typeof log === "function"){
      log("[TALENT SCOUT] Pulled " + chosenRarity.name + ": " + newTalent.name + " (" + newTalent.power + "★, Skill " + newTalent.skill + "). Added to studio roster!", "gold");
    }

    return {
      ok: true,
      talent: newTalent,
      card: { tier: chosenRarity.id.toUpperCase(), name: newTalent.name },
      rarity: chosenRarity,
      msg: "Discovered " + newTalent.name + " (" + chosenRarity.name + ")!"
    };
  }

  // Install a Studio Workstation Amenity
  function installAmenity(amenityId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initLiveOpsCoPro(S);

    const amen = STUDIO_AMENITIES.find(a => a.id === amenityId);
    if(!amen) return { ok: false, msg: "Amenity not found" };

    S.liveOpsCoPro.ownedAmenities = S.liveOpsCoPro.ownedAmenities || [];
    if(S.liveOpsCoPro.ownedAmenities.includes(amen.id)){
      return { ok: false, msg: "Amenity already installed on studio floor." };
    }

    if((S.studio ? S.studio.cash : S.cash) < amen.cost){
      return { ok: false, msg: "Insufficient cash for amenity installation ($" + amen.cost + "M required)." };
    }

    _modCash(S, -amen.cost);
    S.liveOpsCoPro.ownedAmenities.push(amen.id);

    if(amen.id === "trophy_gallery" && S.studio){
      S.studio.rep = Math.min(100, (S.studio.rep || 50) + 5);
    }

    if(typeof log === "function"){
      log("[STUDIO AMENITY] Installed " + amen.name + " (-$" + amen.cost + "M). " + amen.buffText, "gold");
    }

    return { ok: true, msg: amen.name + " commissioned!" };
  }

  // Sign a Co-Production Studio Pact
  function signCoProductionPact(projectId, allianceId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initLiveOpsCoPro(S);

    const pact = RIVAL_ALLIANCES.find(a => a.id === allianceId || (allianceId === "titan_pictures" && a.id === "titan_mega") || (allianceId === "titan" && a.id === "titan_mega") || (allianceId === "horizon" && a.id === "horizon_indie"));
    if(!pact) return { ok: false, msg: "Alliance not found" };

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found" };

    proj.coProductionPact = pact.id;
    proj.coProducerName = pact.name;
    proj.budgetCostDiscount = pact.costSharePct;

    // Refund 50% of allocated budget back to studio cash
    const refund = Math.round((proj.budget || 20) * pact.costSharePct * 10) / 10;
    _modCash(S, refund);

    S.liveOpsCoPro.coProductionDeals.push({
      projectTitle: proj.title,
      pactName: pact.name,
      savings: refund,
      week: S.week || 1
    });

    if(typeof log === "function"){
      log("[CO-PRODUCTION ALLIANCE] Signed " + pact.name + " on \"" + proj.title + "\". Partner covered " + Math.round(pact.costSharePct*100) + "% of budget (+$" + refund + "M returned to treasury).", "gold");
    }

    return { ok: true, savings: refund, msg: "Co-production alliance signed!" };
  }

  // Open Talent Scout & Live Ops Modal
  function openTalentScoutModal(){
    const S = _getG();
    if(!S) return;
    initLiveOpsCoPro(S);

    function renderInner(){
      let h = "<h3>Blind-Box Talent Scouting &amp; Live Ops Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Discover breakout actors and directors through industry premiere talent scouting, seasonal challenges, and studio floor amenities (Social Dev Story parity).</p>";

      h += "<div class='stat-hero' style='margin-bottom:12px'>"+
        "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + (S.liveOpsCoPro.scoutPullsCount || 0) + "</div><div class='s-l'>Total Talent Scouts</div></div>"+
        "<div class='stat'><div class='s-v'>" + (S.liveOpsCoPro.ownedAmenities || []).length + "</div><div class='s-l'>Floor Amenities</div></div>"+
      "</div>";

      h += "<div class='section-title'>Premiere Blind-Box Talent Scouting ($3.0M / Scout)</div>";
      h += "<div class='card' style='text-align:center;padding:16px'>"+
        "<div style='font-size:16px;font-weight:bold;margin-bottom:6px'>Hollywood Red Carpet Discovery Pack</div>"+
        "<div class='tiny muted' style='margin-bottom:12px'>Pull guaranteed certified talent with rarity drops: Common (70%), Rare (22%), Super Rare SR (7%), Ultra Rare UR (1%).</div>"+
        "<button class='btn btn-sm btn-primary' id='btnPullScout' style='min-width:200px'>Scout New Star Talent ($3.0M)</button>"+
      "</div>";

      h += "<div class='section-title' style='margin-top:14px'>Studio Floor Decor &amp; Workstation Amenities</div><div class='grid g2' style='gap:8px'>";
      STUDIO_AMENITIES.forEach(a => {
        const owned = (S.liveOpsCoPro.ownedAmenities || []).includes(a.id);
        h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
          "<div>"+
            "<div class='spread'><b>" + a.name + "</b><span class='tag " + (owned ? "green" : "gold") + "'>" + (owned ? "Installed" : "$" + a.cost + "M") + "</span></div>"+
            "<div class='tiny muted' style='margin:4px 0'>" + a.buffText + "</div>"+
          "</div>"+
          "<div style='margin-top:10px'>"+
            (owned ? "<button class='btn btn-xs' style='width:100%' disabled>Installed</button>"
                   : "<button class='btn btn-xs btn-alt' style='width:100%' data-amenity-id='" + a.id + "'>Install Amenity</button>")+
          "</div></div>";
      });
      h += "</div>";

      return h;
    }

    function wireEvents(container){
      const bPull = container.querySelector("#btnPullScout");
      if(bPull){
        bPull.onclick = () => {
          const res = pullGachaTalentScout(S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
            if(typeof render === "function") render();
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      }

      container.querySelectorAll("[data-amenity-id]").forEach(btn => {
        btn.onclick = () => {
          const res = installAmenity(btn.dataset.amenityId, S);
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

    const initialHtml = "<div id='scoutModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#scoutModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function renderSeasonalBanner(state){
    const S = _getG(state);
    if(!S) return "";
    initLiveOpsCoPro(S);
    const week = S.week || 1;
    const seasonIdx = Math.floor((week / 4) % SEASONAL_EVENTS.length);
    const ev = SEASONAL_EVENTS[seasonIdx] || SEASONAL_EVENTS[0];
    const targetGross = ev.targetGross || 100;
    const progressGross = S.liveOpsCoPro.eventProgressGross || 0;
    const pct = Math.min(100, Math.round((progressGross / targetGross) * 100));

    let h = "<div class='card' style='background:linear-gradient(135deg, rgba(218,165,32,0.12), rgba(20,30,48,0.7));border-left:4px solid var(--gold);margin-bottom:12px;padding:10px 14px'>";
    h += "<div class='spread'><b style='color:var(--gold)'>[SEASONAL EVENT] " + ev.name + "</b><span class='tag gold'>" + (ev.boostGenre ? ev.boostGenre.toUpperCase() : "EVENT") + " +" + Math.round((ev.boostMultiplier - 1) * 100) + "% BO</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 8px'>" + ev.desc + "</div>";
    h += "<div style='display:flex;align-items:center;gap:10px'>";
    h += "<div style='flex:1;background:rgba(255,255,255,0.1);height:6px;border-radius:3px;overflow:hidden'><div style='background:var(--gold);width:" + pct + "%;height:100%'></div></div>";
    h += "<div class='tiny' style='color:var(--gold);font-weight:bold'>$" + Math.round(progressGross) + "M / $" + targetGross + "M (" + pct + "%)</div>";
    h += "</div>";
    h += "</div>";
    return h;
  }

  function renderCoProductionSection(state){
    const S = _getG(state);
    if(!S) return "";
    initLiveOpsCoPro(S);
    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>Co-Production Studio Alliances &amp; Risk Sharing</b><span class='tag blue'>Syndicate Deals</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Partner with rival studios to co-finance expensive productions. Partners cover 40-50% of the production budget in exchange for backend box office splits (Social Dev Story parity).</div>";
    h += "<div class='grid g2' style='gap:8px;margin-bottom:10px'>";
    RIVAL_ALLIANCES.forEach(p => {
      h += "<div style='background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border-left:3px solid var(--blue)'>" +
        "<div class='spread'><b>" + p.name + "</b><span class='tag blue'>" + Math.round(p.costSharePct * 100) + "% Co-Finance</span></div>" +
        "<div class='tiny muted' style='margin-top:2px'>" + p.desc + "</div>" +
        "<div class='tiny' style='color:var(--gold);margin-top:4px'>Partner Rep: " + p.partnerRep + " | Backend Cut: " + Math.round(p.revSharePct * 100) + "%</div>" +
      "</div>";
    });
    h += "</div>";
    h += "<button class='btn btn-sm btn-alt' id='btnOpenCoProDesk' style='width:100%'>Manage Co-Production Pacts</button>";
    h += "</div>";
    return h;
  }

  function renderBlindBoxModal(state){
    openTalentScoutModal();
  }

  function renderAmenitiesModal(state){
    openTalentScoutModal();
  }

  function renderCoProductionModal(state){
    const S = _getG(state);
    if(!S) return;
    initLiveOpsCoPro(S);

    const projs = (S.projects || []).filter(p => !p.released && !p.coProductionPact);

    function renderInner(){
      let h = "<h3>Co-Production Studio Alliances</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Sign co-financing pacts on active projects to immediately recoup 40-50% of the budget from partner studios.</p>";

      if(!projs.length){
        h += "<div class='card' style='text-align:center;padding:16px'><div class='tiny muted'>No active unreleased projects available for co-production financing. Start a project in pre-production first.</div></div>";
      } else {
        h += "<div class='section-title'>Eligible Active Projects</div>";
        projs.forEach(p => {
          h += "<div class='card' style='margin-bottom:8px'>";
          h += "<div class='spread'><b>" + p.title + "</b><span class='tag gold'>Budget: $" + (p.budget || 20) + "M</span></div>";
          h += "<div class='tiny muted' style='margin:4px 0 8px'>Genre: " + (p.genre || "Drama") + " | Phase: " + (p.phase || "development") + "</div>";
          h += "<div style='display:flex;gap:6px;flex-wrap:wrap'>";
          RIVAL_ALLIANCES.forEach(a => {
            const savings = Math.round((p.budget || 20) * a.costSharePct * 10) / 10;
            h += "<button class='btn btn-xs btn-alt btnSignPact' data-proj-id='" + p.id + "' data-pact-id='" + a.id + "'>Sign " + a.name + " (Recoup +$" + savings + "M)</button>";
          });
          h += "</div></div>";
        });
      }
      return h;
    }

    function wireEvents(container){
      container.querySelectorAll(".btnSignPact").forEach(btn => {
        btn.onclick = () => {
          const res = signCoProductionPact(btn.dataset.projId, btn.dataset.pactId, S);
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

    const initialHtml = "<div id='coProModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#coProModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const btnCo = root.querySelector("#btnOpenCoProDesk");
    if(btnCo){
      btnCo.onclick = () => {
        renderCoProductionModal(state);
      };
    }
  }

  const LiveOpsCoProAPI = {
    GACHA_RARITIES,
    SEASONAL_EVENTS,
    STUDIO_AMENITIES,
    RIVAL_ALLIANCES,
    initLiveOpsCoPro,
    pullGachaTalentScout,
    installAmenity,
    signCoProductionPact,
    openTalentScoutModal,
    renderSeasonalBanner,
    renderCoProductionSection,
    renderBlindBoxModal,
    renderCoProductionModal,
    renderAmenitiesModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = LiveOpsCoProAPI;
  }
  global.LiveOpsCoPro = LiveOpsCoProAPI;
  global.openTalentScoutModal = openTalentScoutModal;
})(typeof window !== "undefined" ? window : global);
