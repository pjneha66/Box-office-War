/* ═════════════════════════════════════════════════════════════════════════
   CINEMATIC-UNIVERSE.JS — Cinematic Universe Continuity & Crossover Synergy
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

  function initCinematicUniverses(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.universes){
      S.universes = [];
    }
    return S.universes;
  }

  function createUniverse(name, leadFranchiseId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initCinematicUniverses(S);

    if(!name || !name.trim()){
      return { ok: false, error: "Universe requires a valid name." };
    }

    let franchise = (S.franchises || []).find(f => f.id === leadFranchiseId || f.name === leadFranchiseId);
    if(!franchise){
      franchise = {
        id: typeof leadFranchiseId === "number" ? leadFranchiseId : Date.now(),
        name: typeof leadFranchiseId === "string" ? leadFranchiseId : (name + " Core"),
        tier: 1,
        merch: 0,
        park: 0,
        entries: []
      };
      if(!S.franchises) S.franchises = [];
      S.franchises.push(franchise);
    }

    const cost = 30; // $30M to establish universe bible and IP legal foundation
    if((S.studio.cash || 0) < cost){
      return { ok: false, error: "Establishing a shared cinematic universe requires $" + cost + "M." };
    }

    S.studio.cash = Math.round((S.studio.cash - cost) * 10) / 10;

    const uni = {
      id: "uni_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: name.trim(),
      leadFranchiseId: franchise.id,
      leadFranchiseName: franchise.name,
      subFranchises: [franchise.name],
      loreConsistency: 85,
      yearlyReleaseCount: 0,
      totalEntries: 0,
      crossoverEventsCount: 0,
      createdWeek: S.week,
      lastReleaseYear: Math.floor(S.week / 52) + 1
    };

    S.universes.push(uni);

    if(typeof log === "function"){
      log("Chartered cinematic universe \"" + uni.name + "\" anchored by " + franchise.name + " (-$" + cost + "M).", "gold");
    }

    return { ok: true, universe: uni };
  }

  function addSubFranchiseToUniverse(universeId, franchiseId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initCinematicUniverses(S);

    const uni = S.universes.find(u => u.id === universeId);
    if(!uni) return { ok: false, error: "Universe not found." };

    const franchise = (S.franchises || []).find(f => f.id === franchiseId);
    if(!franchise) return { ok: false, error: "Franchise not found." };

    if(uni.subFranchises.includes(franchise.name)){
      return { ok: false, error: franchise.name + " is already an interconnected branch of this universe." };
    }

    uni.subFranchises.push(franchise.name);
    uni.loreConsistency = Math.min(100, uni.loreConsistency + 5);

    if(typeof log === "function"){
      log("Interconnected \"" + franchise.name + "\" into the " + uni.name + " cinematic universe.", "gold");
    }

    return { ok: true, subFranchises: uni.subFranchises };
  }

  function calculateUniverseFatigue(universe, currentWeek){
    if(!universe) return { fatigueScore: 0, decayMultiplier: 1.0 };
    const curYear = Math.floor(currentWeek / 52) + 1;
    if(universe.lastReleaseYear !== curYear){
      universe.yearlyReleaseCount = 0;
      universe.lastReleaseYear = curYear;
    }

    const count = universe.yearlyReleaseCount || 0;
    if(count <= 2){
      return { fatigueScore: 0, decayMultiplier: 1.0 };
    }

    const excess = count - 2;
    const fatigueScore = Math.min(60, excess * 25);
    const decayMultiplier = Math.max(0.65, Math.round((1.0 - fatigueScore * 0.006) * 100) / 100);

    return { fatigueScore, decayMultiplier };
  }

  function calculateCrossoverBonus(universe, involvedFranchiseNames){
    if(!universe) return 1.0;
    const count = (involvedFranchiseNames || []).length;
    if(count <= 1) return 1.0;

    const loreFactor = (universe.loreConsistency || 80) / 100;
    const bonus = 1.0 + (count - 1) * 0.18 * loreFactor;
    return Math.min(1.65, Math.round(bonus * 100) / 100);
  }

  function recordUniverseRelease(universeId, film, state){
    const S = _getG(state);
    if(!S || !S.universes) return;
    const uni = S.universes.find(u => u.id === universeId);
    if(!uni) return;

    uni.yearlyReleaseCount = (uni.yearlyReleaseCount || 0) + 1;
    uni.totalEntries = (uni.totalEntries || 0) + 1;

    // Check lore continuity
    if(film && film.writer){
      uni.loreConsistency = Math.min(100, (uni.loreConsistency || 80) + 3);
    } else {
      uni.loreConsistency = Math.max(40, (uni.loreConsistency || 80) - 8);
    }
  }

  function openUniverseModal(){
    const S = _getG();
    if(!S) return;
    initCinematicUniverses(S);

    let h = "<h3>Cinematic Universe &amp; Cross-Franchise Synergy</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Unify distinct franchises into a massive shared cinematic universe. Team-up crossover events capture enormous box office multipliers, while creative lore consistency mitigates franchise fatigue.</div>";

    const uniCount = S.universes.length;
    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v'>" + uniCount + "</div><div class='s-l'>Active Universes</div></div>"+
      "<div class='stat'><div class='s-v'>" + S.universes.reduce((a, u) => a + (u.totalEntries || 0), 0) + "</div><div class='s-l'>Total Universe Films</div></div>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>Up to +65%</div><div class='s-l'>Crossover Event Multiplier</div></div>"+
    "</div>";

    if(uniCount){
      h += "<div class='section-title'>Active Cinematic Universes</div><div class='grid g2' style='margin-bottom:14px'>";
      S.universes.forEach(u => {
        const fatigue = calculateUniverseFatigue(u, S.week);
        h += "<div class='card'>"+
          "<div class='spread'><b>" + esc(u.name) + "</b><span class='tag gold'>" + u.subFranchises.length + " Branches</span></div>"+
          "<div class='tiny muted' style='margin:4px 0'>Anchor: " + esc(u.leadFranchiseName) + " | Entries: " + u.totalEntries + "</div>"+
          "<div class='tiny' style='margin:6px 0'>"+
            "Lore Consistency: <b>" + u.loreConsistency + "/100</b> | Annual Releases: <b>" + u.yearlyReleaseCount + "/2 Safe</b>" +
          "</div>"+
          "<div class='tiny' style='margin:4px 0'>"+
            (fatigue.fatigueScore > 0 ? (
              "<span class='neg'>Fatigue Active: -" + fatigue.fatigueScore + "% (Decay: " + fatigue.decayMultiplier + "x)</span>"
            ) : (
              "<span class='pos'>Fatigue Pristine (0% Decay)</span>"
            ))+
          "</div>"+
          "<div class='tiny muted' style='margin-top:6px'>Interconnected IPs: " + u.subFranchises.map(x => esc(x)).join(", ") + "</div>"+
        "</div>";
      });
      h += "</div>";
    }

    h += "<div class='section-title'>Charter New Shared Cinematic Universe</div><div class='card'>";
    const availableFranchises = (S.franchises || []).filter(f => !S.universes.some(u => u.leadFranchiseId === f.id));

    if(!availableFranchises.length){
      h += "<div class='tiny muted'>Build or purchase an unchartered franchise to establish a new cinematic universe.</div>";
    } else {
      h += "<div class='row' style='gap:8px;margin-bottom:8px'>"+
        "<input id='uniNameInput' type='text' placeholder='Universe Name (e.g. Apex Vanguard Universe)' style='flex:1;background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px'>"+
        "<select id='uniFranchiseSelect' style='background:#0d1119;border:1px solid var(--line2);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px'>"+
          availableFranchises.map(f => "<option value='" + f.id + "'>" + esc(f.name) + "</option>").join("")+
        "</select>"+
        "<button class='btn btn-sm btn-primary' id='btnCharterUni'>Establish ($30M)</button>"+
      "</div>";
    }
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    const bCharter = v.querySelector("#btnCharterUni");
    if(bCharter){
      bCharter.onclick = () => {
        const name = (v.querySelector("#uniNameInput") || {}).value;
        const fId = +(v.querySelector("#uniFranchiseSelect") || {}).value;
        const res = createUniverse(name, fId);
        if(res.ok){
          if(typeof beep === "function") beep("gold");
          closeModal();
          openUniverseModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    }
  }

  function calculateUniverseSynergy(universeId, isCrossover, state){
    const S = _getG(state);
    if(!S || !S.universes) return { buzzMultiplier: 1.0, qualityBuff: 0 };
    const uni = S.universes.find(u => u.id === universeId);
    if(!uni) return { buzzMultiplier: 1.0, qualityBuff: 0 };
    const fatigue = calculateUniverseFatigue(uni, S.week || 1);
    let buzzMult = Math.max(0.85, 1.25 - (fatigue.penalty || 0));
    if(isCrossover){
      buzzMult *= 1.35;
    }
    return {
      buzzMultiplier: Math.round(buzzMult * 100) / 100,
      qualityBuff: isCrossover ? 4 : 2
    };
  }

  function addFilmToUniverse(universeId, film, state){
    return recordUniverseRelease(universeId, film, state);
  }

  const UniverseModule = {
    initCinematicUniverses,
    createUniverse,
    createCinematicUniverse: createUniverse,
    addSubFranchiseToUniverse,
    calculateUniverseFatigue,
    calculateCrossoverBonus,
    calculateUniverseSynergy,
    recordUniverseRelease,
    addFilmToUniverse,
    openUniverseModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = UniverseModule;
  }
  global.UniverseModule = UniverseModule;
  global.CinematicUniverse = UniverseModule;
  global.initCinematicUniverses = initCinematicUniverses;
  global.createUniverse = createUniverse;
  global.addSubFranchiseToUniverse = addSubFranchiseToUniverse;
  global.calculateUniverseFatigue = calculateUniverseFatigue;
  global.calculateCrossoverBonus = calculateCrossoverBonus;
  global.recordUniverseRelease = recordUniverseRelease;
  global.openUniverseModal = openUniverseModal;
})(typeof window !== "undefined" ? window : global);
