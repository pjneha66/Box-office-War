/* ═════════════════════════════════════════════════════════════════════════
   LOCATION-SCOUTING.JS — Global Location Scouting & Film Tax Credit Rebates
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Sim 2 (Location Scouting)
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

  const SHOOTING_LOCATIONS = [
    {
      id: "pinewood_uk",
      name: "London & Pinewood Studios (UK)",
      taxRebate: 0.25, // 25% cash tax rebate on production budget
      qualityBuff: 2,
      genresFavored: ["drama", "thriller", "action"],
      desc: "25% British Film Institute tax credit rebate on qualified spend. World-class crew and heritage stages.",
      weather: "Temperate Rain",
      fxClass: "weather-fx-rain"
    },
    {
      id: "iceland",
      name: "Iceland Glaciers & Volcanic Terrain",
      taxRebate: 0.15,
      qualityBuff: 6,
      genresFavored: ["scifi", "fantasy"],
      desc: "Stunning, alien-like natural topography. Adds +6 visual quality points to Sci-Fi and Fantasy epics.",
      weather: "Sub-Zero Blizzard",
      fxClass: "weather-fx-snow"
    },
    {
      id: "atlanta",
      name: "Atlanta Production Hub (Georgia, USA)",
      taxRebate: 0.28,
      qualityBuff: 1,
      genresFavored: ["action", "comedy", "horror"],
      desc: "Massive 28% production tax incentive. Deep soundstage availability and low overhead.",
      weather: "Southern Heat Haze",
      fxClass: "weather-fx-heat"
    },
    {
      id: "new_zealand",
      name: "New Zealand Natural Fjords",
      taxRebate: 0.20,
      qualityBuff: 5,
      genresFavored: ["fantasy", "adventure"],
      desc: "Pristine landscapes with world-renowned practical set infrastructure. Elevates award pedigree.",
      weather: "Misty Mountain Air",
      fxClass: "weather-fx-rain"
    },
    {
      id: "tokyo",
      name: "Tokyo & Kyoto Urban Corridors (Japan)",
      taxRebate: 0.10,
      qualityBuff: 4,
      genresFavored: ["action", "thriller", "scifi"],
      desc: "High visual atmosphere and street authenticity. Boosts opening weekend awareness in Asia-Pacific by +15%.",
      weather: "Cyberpunk Neon Fog",
      fxClass: "weather-fx-neon"
    }
  ];

  function getShootingLocation(locId){
    return SHOOTING_LOCATIONS.find(l => l.id === locId) || SHOOTING_LOCATIONS[0];
  }

  function applyLocationToProject(projectId, locId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };

    const project = (S.projects || []).find(p => p.id === projectId);
    if(!project) return { ok: false, error: "Project not found in pipeline." };

    const loc = getShootingLocation(locId);
    project.shootingLocation = loc.id;
    project.shootingLocationName = loc.name;

    // Calculate tax rebate
    const rebate = Math.round(project.budget * loc.taxRebate * 10) / 10;
    project.rebateEarned = rebate;

    // Quality buff if genre fits
    let qBuff = loc.qualityBuff;
    if(loc.genresFavored.includes(project.genre)){
      qBuff += 2;
    }
    project.locationQualityBuff = qBuff;

    if(typeof log === "function"){
      log("Scouted location \"" + loc.name + "\" for \"" + project.title + "\": +$" + rebate + "M tax credit, +" + qBuff + " quality points.", "gold");
    }

    return { ok: true, rebate, qualityBuff: qBuff };
  }

  function openLocationScoutingModal(projectId){
    const S = _getG();
    if(!S) return;

    let target = null;
    if(projectId){
      target = (S.projects || []).find(p => p.id === projectId);
    }
    if(!target){
      target = (S.projects || []).find(p => p.phase === "pre" || p.phase === "dev");
    }

    if(!target){
      if(typeof toast === "function") toast("No projects currently in pre-production or development.", "bad");
      return;
    }

    let h = "<h3>Global Location Scouting &amp; Tax Rebate Hub</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Select physical international shooting hubs for \"" + esc(target.title) + "\" (" + (target.genre || "").toUpperCase() + "). Qualify for direct state tax credits and genre authenticity bonuses.</div>";

    h += "<div class='grid g2'>";
    SHOOTING_LOCATIONS.forEach(loc => {
      const rebateM = Math.round(target.budget * loc.taxRebate * 10) / 10;
      const isFavored = loc.genresFavored.includes(target.genre);

      h += "<div class='card " + (loc.fxClass || "") + "' style='display:flex;flex-direction:column;justify-content:space-between;position:relative'>"+
        "<div>"+
          "<div class='spread'><b>" + esc(loc.name) + "</b><span class='tag " + (isFavored ? "green" : "") + "'>" + Math.round(loc.taxRebate * 100) + "% Rebate</span></div>"+
          "<div class='tiny' style='color:var(--gold);margin:4px 0'>Weather Atmosphere: <b>" + esc(loc.weather || "Clear") + "</b></div>"+
          "<div class='tiny muted' style='margin:4px 0 6px'>" + esc(loc.desc) + "</div>"+
          "<div class='tiny' style='margin:4px 0'>"+
            "Estimated Tax Cash Back: <b>+$" + rebateM + "M</b> | Visual Boost: <b>+" + (loc.qualityBuff + (isFavored ? 2 : 0)) + " pts</b>" +
          "</div>"+
          (isFavored ? "<div class='tiny pos' style='margin-top:4px'>Prime Genre Match (" + target.genre + ")</div>" : "")+
        "</div>"+
        "<div style='margin-top:10px'>"+
          "<button class='btn btn-sm btn-primary' style='width:100%' data-lockloc='" + target.id + ":" + loc.id + "'>Confirm Location ($" + rebateM + "M rebate)</button>"+
        "</div>"+
      "</div>";
    });
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    v.querySelectorAll("[data-lockloc]").forEach(b => {
      b.onclick = () => {
        const parts = b.dataset.lockloc.split(":");
        const res = applyLocationToProject(+parts[0], parts[1]);
        if(res.ok){
          if(typeof beep === "function") beep("gold");
          closeModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    });
  }

  const LocationScoutingModule = {
    SHOOTING_LOCATIONS,
    getShootingLocation,
    applyLocationToProject,
    openLocationScoutingModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = LocationScoutingModule;
  }
  global.LocationScoutingModule = LocationScoutingModule;
  global.getShootingLocation = getShootingLocation;
  global.applyLocationToProject = applyLocationToProject;
  global.openLocationScoutingModal = openLocationScoutingModal;
})(typeof window !== "undefined" ? window : global);
