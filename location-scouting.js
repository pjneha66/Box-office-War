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

    /* Pictures live in the pipeline (projects) until release, then in the film
       library. Both can carry a scouting record, so accept either. */
    const project = (S.projects || []).find(p => p.id === projectId)
      || (S.films || []).find(f => f.id === projectId);
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
    if(typeof project.shootingLocationName !== "string") project.shootingLocationName = loc.name;

    return { ok: true, rebate, qualityBuff: qBuff };
  }

  /* One scouting surface for the whole game: the location desk owns the
     destination cards, the contract action and the cash-back maths. Older
     callers that passed a project id still land on it, with that picture
     pre-selected; callers with no shoot get the desk's own empty state
     instead of a dead toast. */
  function openLocationScoutingModal(projectId){
    const S = _getG();
    if(!S) return;
    let target = null;
    if(projectId){
      target = (S.projects || []).find(p => p.id === +projectId || p.id === projectId);
    }
    if(!target){
      target = (S.projects || []).find(p => ["pre","dev","shoot","prod","post"].includes(p.phase));
    }
    if(typeof global.openLocationDesk === "function"){
      global.openLocationDesk(target ? target.id : null);
      return;
    }
    if(!target){
      if(typeof toast === "function") toast("No projects currently in pre-production or development.", "bad");
    }
  }

  /* Scout a hub for a picture: pays the travel premium, books the location and
     reports the rebate + craft buff the engine will apply. */
  function scoutLocationForProject(projectId, locId, travelBudget, state){
    const S = _getG(state);
    if(!S) return { ok:false, msg:"No active state" };
    const loc = getShootingLocation(locId);
    const travel = Math.round((loc.travelCost || 0) * 10) / 10;
    const cash = S.studio ? S.studio.cash : S.cash;
    if(travel > 0 && (typeof cash === "number") && cash < travel){
      return { ok:false, msg:"Travel to " + loc.name + " needs " + "$" + travel + "M in cash." };
    }
    const res = applyLocationToProject(projectId, loc.id, S);
    if(!res.ok) return { ok:false, msg:res.error };
    if(travel > 0){
      if(S.studio) S.studio.cash = Math.round((S.studio.cash - travel) * 100) / 100;
      else if(typeof S.cash === "number") S.cash = Math.round((S.cash - travel) * 100) / 100;
    }
    return { ok:true, location:loc, taxRebateCash:res.rebate, qualityBuff:res.qualityBuff,
      msg:"Scouted " + loc.name + " for a $" + res.rebate + "M rebate and +" + res.qualityBuff + " craft." };
  }

  const LocationScoutingModule = {
    SHOOTING_LOCATIONS,
    getShootingLocation,
    applyLocationToProject,
    scoutLocationForProject,
    openLocationScoutingModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = LocationScoutingModule;
  }
  global.LocationScoutingModule = LocationScoutingModule;
  /* The engine and the location desk read `LocationScouting`; expose the same
     object under both names so scouted hubs actually buff final craft. */
  global.LocationScouting = LocationScoutingModule;
  global.getShootingLocation = getShootingLocation;
  global.applyLocationToProject = applyLocationToProject;
  global.openLocationScoutingModal = openLocationScoutingModal;
})(typeof window !== "undefined" ? window : global);
