/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-FACILITIES.JS — Physical Lot & Real Estate Infrastructure
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

  const FACILITY_TYPES = {
    soundstage: {
      id: "soundstage",
      name: "Soundstage Complex",
      desc: "Expands physical shooting space and production efficiency. Higher tiers allow concurrent shooting without congestion.",
      baseCost: 25, // $25M per tier
      maintenanceRate: 0.008, // 0.8% weekly
      qualityPerTier: 3,
      maxTier: 5
    },
    virtual_led: {
      id: "virtual_led",
      name: "LED Virtual Production Volume",
      desc: "Real-time in-camera visual effects. Slashes foreign location scouting costs while boosting CGI visual polish.",
      baseCost: 35, // $35M per tier
      maintenanceRate: 0.01,
      qualityPerTier: 5,
      maxTier: 5
    },
    post_suite: {
      id: "post_suite",
      name: "Post-Production Dolby Atmos Suite",
      desc: "State-of-the-art color grading, sound design, and master mixing. Directly elevates critical acclaim and review scores.",
      baseCost: 18, // $18M per tier
      maintenanceRate: 0.006,
      qualityPerTier: 4,
      maxTier: 5
    },
    backlot: {
      id: "backlot",
      name: "Modular Historic & Sci-Fi Backlot",
      desc: "Physical city streets and period sets. Slashes location fees by up to 25% on period, fantasy, and sci-fi productions.",
      baseCost: 20, // $20M per tier
      maintenanceRate: 0.007,
      qualityPerTier: 3,
      maxTier: 5
    }
  };

  function initFacilities(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.facilities){
      S.facilities = {
        soundstage: { tier: 0, rented: false },
        virtual_led: { tier: 0, rented: false },
        post_suite: { tier: 0, rented: false },
        backlot: { tier: 0, rented: false },
        totalMaintenancePaid: 0,
        totalRentalEarned: 0
      };
    }
    return S.facilities;
  }

  function getFacilityCost(typeId, currentTier){
    const def = FACILITY_TYPES[typeId];
    if(!def) return 0;
    return Math.round(def.baseCost * (currentTier + 1));
  }

  function upgradeFacility(typeId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initFacilities(S);
    const def = FACILITY_TYPES[typeId];
    if(!def) return { ok: false, error: "Unknown facility type" };

    const fac = S.facilities[typeId];
    if(fac.tier >= def.maxTier){
      return { ok: false, error: def.name + " is already at maximum tier (" + def.maxTier + ")." };
    }

    const cost = getFacilityCost(typeId, fac.tier);
    if((S.studio.cash || 0) < cost){
      return { ok: false, error: "Insufficient funds. Upgrade requires $" + cost + "M." };
    }

    S.studio.cash = Math.round((S.studio.cash - cost) * 10) / 10;
    fac.tier += 1;

    if(typeof log === "function"){
      log("Upgraded " + def.name + " to Tier " + fac.tier + " for $" + cost + "M.", "gold");
    }

    return { ok: true, tier: fac.tier, cost: cost };
  }

  function toggleFacilityRental(typeId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initFacilities(S);
    const fac = S.facilities[typeId];
    if(!fac || fac.tier === 0){
      return { ok: false, error: "Cannot lease an unbuilt facility." };
    }

    fac.rented = !fac.rented;
    const def = FACILITY_TYPES[typeId];
    if(typeof log === "function"){
      log(def.name + (fac.rented ? " leased to third-party productions for weekly income." : " returned to in-house studio reserve."), "");
    }

    return { ok: true, rented: fac.rented };
  }

  function getFacilityQualityBoost(state){
    const S = _getG(state);
    if(!S || !S.facilities) return 0;
    let boost = 0;
    for(const k in FACILITY_TYPES){
      const fac = S.facilities[k];
      if(fac && fac.tier > 0 && !fac.rented){
        boost += fac.tier * FACILITY_TYPES[k].qualityPerTier;
      }
    }
    return boost;
  }

  function getFacilityBudgetDiscount(genre, scale, state){
    const S = _getG(state);
    if(!S || !S.facilities) return 0;
    let discount = 0;
    const backlot = S.facilities.backlot;
    if(backlot && backlot.tier > 0 && !backlot.rented){
      if(genre === "scifi" || genre === "fantasy" || genre === "western" || genre === "war"){
        discount += backlot.tier * 0.04; // up to 20% discount
      }
    }
    const led = S.facilities.virtual_led;
    if(led && led.tier > 0 && !led.rented){
      discount += led.tier * 0.02; // up to 10% discount
    }
    return Math.min(0.28, discount);
  }

  function tickFacilitiesWeekly(state){
    const S = _getG(state);
    if(!S) return { maintenance: 0, rental: 0, net: 0 };
    initFacilities(S);

    let totalMaintenance = 0;
    let totalRental = 0;

    for(const k in FACILITY_TYPES){
      const def = FACILITY_TYPES[k];
      const fac = S.facilities[k];
      if(!fac || fac.tier === 0) continue;

      const facilityVal = def.baseCost * fac.tier;
      const maintenance = facilityVal * def.maintenanceRate;
      totalMaintenance += maintenance;

      if(fac.rented){
        // 1.5x maintenance yield in third-party rental payments
        const rentIncome = maintenance * 1.5;
        totalRental += rentIncome;
      }
    }

    totalMaintenance = Math.round(totalMaintenance * 10) / 10;
    totalRental = Math.round(totalRental * 10) / 10;
    const net = Math.round((totalRental - totalMaintenance) * 10) / 10;

    S.studio.cash = Math.round((S.studio.cash + net) * 10) / 10;
    S.facilities.totalMaintenancePaid = Math.round(((S.facilities.totalMaintenancePaid || 0) + totalMaintenance) * 10) / 10;
    S.facilities.totalRentalEarned = Math.round(((S.facilities.totalRentalEarned || 0) + totalRental) * 10) / 10;

    return { maintenance: totalMaintenance, rental: totalRental, net: net };
  }

  function openStudioFacilitiesModal(){
    const S = _getG();
    if(!S) return;
    initFacilities(S);

    let h = "<h3>Studio Real Estate &amp; Facilities Infrastructure</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Invest in soundstages, virtual production volumes, and backlots to enhance production quality, cut location overhead, or lease idle lots for recurring weekly cash.</div>";

    const qualityBoost = getFacilityQualityBoost(S);
    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>+" + qualityBoost + " pts</div><div class='s-l'>Active Quality Boost</div></div>"+
      "<div class='stat'><div class='s-v'>$" + (S.facilities.totalRentalEarned || 0) + "M</div><div class='s-l'>Total Rental Earned</div></div>"+
      "<div class='stat'><div class='s-v' style='color:var(--red)'>$" + (S.facilities.totalMaintenancePaid || 0) + "M</div><div class='s-l'>Maintenance Paid</div></div>"+
    "</div>";

    // ── Interactive Studio Campus Lot Map ──
    const soundFac = S.facilities.soundstage || { tier: 0, rented: false };
    const ledFac = S.facilities.virtual_led || { tier: 0, rented: false };
    const postFac = S.facilities.post_suite || { tier: 0, rented: false };
    const backFac = S.facilities.backlot || { tier: 0, rented: false };

    h += "<div style='font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px'>Studio Lot Campus Map</div>";
    h += "<div class='studio-campus-map'>";
    h += "<div class='studio-lot-tile " + (soundFac.tier > 0 ? "active-tier gold-tier" : "") + "' data-mapfocus='soundstage'>";
    h += "<div class='lot-icon'>🎬</div>";
    h += "<div class='lot-name'>Soundstage Lot</div>";
    h += "<div class='lot-status'>" + (soundFac.tier > 0 ? ("Tier " + soundFac.tier + " (" + (soundFac.rented ? "Leased" : "In-House") + ")") : "Vacant Lot") + "</div>";
    h += "</div>";

    h += "<div class='studio-lot-tile " + (ledFac.tier > 0 ? "active-tier gold-tier" : "") + "' data-mapfocus='virtual_led'>";
    h += "<div class='lot-icon'>🔮</div>";
    h += "<div class='lot-name'>LED Volume</div>";
    h += "<div class='lot-status'>" + (ledFac.tier > 0 ? ("Tier " + ledFac.tier + " (" + (ledFac.rented ? "Leased" : "In-House") + ")") : "Unbuilt") + "</div>";
    h += "</div>";

    h += "<div class='studio-lot-tile " + (postFac.tier > 0 ? "active-tier gold-tier" : "") + "' data-mapfocus='post_suite'>";
    h += "<div class='lot-icon'>🎧</div>";
    h += "<div class='lot-name'>Dolby Atmos Post</div>";
    h += "<div class='lot-status'>" + (postFac.tier > 0 ? ("Tier " + postFac.tier + " (" + (postFac.rented ? "Leased" : "In-House") + ")") : "Unbuilt") + "</div>";
    h += "</div>";

    h += "<div class='studio-lot-tile " + (backFac.tier > 0 ? "active-tier gold-tier" : "") + "' data-mapfocus='backlot'>";
    h += "<div class='lot-icon'>🏛️</div>";
    h += "<div class='lot-name'>Historic Backlot</div>";
    h += "<div class='lot-status'>" + (backFac.tier > 0 ? ("Tier " + backFac.tier + " (" + (backFac.rented ? "Leased" : "In-House") + ")") : "Open Land") + "</div>";
    h += "</div>";
    h += "</div>";

    h += "<div class='grid g2'>";
    for(const k in FACILITY_TYPES){
      const def = FACILITY_TYPES[k];
      const fac = S.facilities[k] || { tier: 0, rented: false };
      const nextCost = fac.tier < def.maxTier ? getFacilityCost(k, fac.tier) : 0;
      const maintenanceWk = fac.tier > 0 ? (def.baseCost * fac.tier * def.maintenanceRate).toFixed(2) : "0.00";
      const rentalWk = fac.tier > 0 ? (def.baseCost * fac.tier * def.maintenanceRate * 1.5).toFixed(2) : "0.00";

      h += "<div class='card' id='fac-card-" + k + "' style='display:flex;flex-direction:column;justify-content:space-between;transition:box-shadow 0.2s ease'>"+
        "<div>"+
          "<div class='spread'><b>" + esc(def.name) + "</b><span class='tag " + (fac.tier > 0 ? "gold" : "") + "'>Tier " + fac.tier + "/" + def.maxTier + "</span></div>"+
          "<div class='tiny muted' style='margin:6px 0'>" + esc(def.desc) + "</div>"+
          "<div class='tiny' style='margin:4px 0'>" +
            "Quality boost: +" + (fac.tier * def.qualityPerTier) + " pts | Maint: -$" + maintenanceWk + "M/wk" +
          "</div>"+
          (fac.tier > 0 ? (
            "<div class='tiny' style='margin-top:6px;padding:6px;background:rgba(255,255,255,0.03);border-radius:6px'>"+
              "<div class='spread'><span>Lease to Rivals:</span><b>" + (fac.rented ? "<span class='pos'>ACTIVE (+$" + rentalWk + "M/wk)</span>" : "<span class='muted'>IN-HOUSE USE</span>") + "</b></div>"+
            "</div>"
          ) : "")+
        "</div>"+
        "<div class='row' style='margin-top:10px;gap:6px'>"+
          (fac.tier < def.maxTier ? (
            "<button class='btn btn-sm btn-primary' style='flex:1' data-facupgrade='" + k + "'>Upgrade to T" + (fac.tier + 1) + " ($" + nextCost + "M)</button>"
          ) : (
            "<button class='btn btn-sm' style='flex:1' disabled>Max Level Reached</button>"
          ))+
          (fac.tier > 0 ? (
            "<button class='btn btn-sm btn-alt' data-factoggle='" + k + "'>" + (fac.rented ? "Reclaim Lot" : "Lease Out") + "</button>"
          ) : "")+
        "</div>"+
      "</div>";
    }
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    v.querySelectorAll("[data-mapfocus]").forEach(tile => {
      tile.onclick = () => {
        const targetId = tile.dataset.mapfocus;
        const targetCard = v.querySelector("#fac-card-" + targetId);
        if(targetCard){
          v.querySelectorAll(".card").forEach(c => { c.style.boxShadow = ""; c.style.borderColor = ""; });
          targetCard.style.boxShadow = "0 0 16px var(--gold-glow)";
          targetCard.style.borderColor = "var(--gold)";
          targetCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
          if(typeof beep === "function") beep("click");
        }
      };
    });
    v.querySelectorAll("[data-facupgrade]").forEach(b => {
      b.onclick = () => {
        const res = upgradeFacility(b.dataset.facupgrade);
        if(res.ok){
          if(typeof beep === "function") beep("gold");
          closeModal();
          openStudioFacilitiesModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    });
    v.querySelectorAll("[data-factoggle]").forEach(b => {
      b.onclick = () => {
        const res = toggleFacilityRental(b.dataset.factoggle);
        if(res.ok){
          if(typeof beep === "function") beep("click");
          closeModal();
          openStudioFacilitiesModal();
          if(typeof render === "function") render();
        }
      };
    });
  }

  const FacilitiesModule = {
    FACILITY_TYPES,
    initFacilities,
    getFacilityCost,
    upgradeFacility,
    toggleFacilityRental,
    getFacilityQualityBoost,
    getFacilityBudgetDiscount,
    tickFacilitiesWeekly,
    openStudioFacilitiesModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = FacilitiesModule;
  }
  global.FacilitiesModule = FacilitiesModule;
  global.initFacilities = initFacilities;
  global.upgradeFacility = upgradeFacility;
  global.toggleFacilityRental = toggleFacilityRental;
  global.getFacilityQualityBoost = getFacilityQualityBoost;
  global.getFacilityBudgetDiscount = getFacilityBudgetDiscount;
  global.tickFacilitiesWeekly = tickFacilitiesWeekly;
  global.openStudioFacilitiesModal = openStudioFacilitiesModal;
})(typeof window !== "undefined" ? window : global);
