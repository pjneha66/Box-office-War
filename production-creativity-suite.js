/* ═════════════════════════════════════════════════════════════════════════
   PRODUCTION-CREATIVITY-SUITE.JS — Director Sparks, Writers' Room & Remake Vault
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Silver Screen Story & TV Studio Story
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

  // Camera & Lens Technical Formats
  const CAMERA_LENS_FORMATS = [
    {
      id: "digital_arri",
      name: "Arri Alexa Mini LF (Modern Digital 4K)",
      costM: 0.20,
      craftBonus: 3,
      speedBonusPct: 0.10,
      desc: "Industry workhorse providing pristine dynamic range, high reliability, and rapid daily shooting setups."
    },
    {
      id: "anamorphic_35mm",
      name: "Panavision C-Series 35mm Anamorphic Film",
      costM: 0.65,
      craftBonus: 8,
      prestigeBonus: 5,
      desc: "Rich organic photochemical grain, oval bokeh, and cinematic horizontal lens flares favored by elite auteurs."
    },
    {
      id: "ultra_panavision_70mm",
      name: "Ultra Panavision 70mm Super-Widescreen",
      costM: 1.80,
      craftBonus: 15,
      prestigeBonus: 12,
      desc: "Epic 2.76:1 aspect ratio film format used for colossal blockbusters and prestige historical monuments."
    },
    {
      id: "vintage_16mm",
      name: "Arriflex 16mm Vintage Photochemical",
      costM: 0.15,
      craftBonus: 5,
      indieBonus: 10,
      desc: "Gritty, tactile texture providing authentic low-budget realism for psychological horror and period indies."
    }
  ];

  function initProductionCreativity(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.productionSuite){
      S.productionSuite = {
        writersRoomHired: 0,
        writersRoomLevel: 1,
        specScriptsGenerated: [],
        stuntSafetyLevel: 1, // 1 to 5
        directorSparksHistory: [],
        remakeVaultHistory: []
      };
    }
    return S.productionSuite;
  }

  // Trigger a Director Creative Spark Event during filming
  function triggerDirectorSpark(projectId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initProductionCreativity(S);

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Active shooting project not found." };

    const sparks = [
      {
        title: "Improvised Third-Act Masterstroke",
        bonusQuality: 8,
        costM: 0.5,
        desc: "Director envisioned an unscripted climactic confrontation on set. Grants +8 quality for $0.5M overtime."
      },
      {
        title: "Midnight Natural Magic Hour Reshoot",
        bonusQuality: 12,
        costM: 1.2,
        desc: "Cast and crew held overnight to catch real desert sunrise lighting. Grants +12 quality for $1.2M cost."
      },
      {
        title: "Original Orchestral Motif Spark",
        bonusQuality: 6,
        costM: 0.3,
        desc: "Director and composer collaborated on a haunting main character motif. Grants +6 quality for $0.3M."
      }
    ];

    const chosen = sparks[Math.floor(Math.random() * sparks.length)];
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < chosen.costM){
      return { ok: false, msg: "Insufficient cash for director creative spark overtime ($" + chosen.costM + "M required)." };
    }

    _modCash(S, -chosen.costM);
    proj.quality = Math.min(100, (proj.quality || 60) + chosen.bonusQuality);
    proj.directorSparkActive = true;

    S.productionSuite.directorSparksHistory.push({
      title: chosen.title,
      projectTitle: proj.title,
      bonusQuality: chosen.bonusQuality,
      costM: chosen.costM,
      week: S.week || 1
    });

    if(typeof log === "function"){
      log("[DIRECTOR CREATIVE SPARK] " + chosen.title + " on \"" + proj.title + "\" (+ " + chosen.bonusQuality + " Quality, -$" + chosen.costM + "M).", "gold");
    }

    return { ok: true, spark: chosen, msg: chosen.title + " executed!" };
  }

  // Upgrade or Expand the Writers' Room
  function expandWritersRoom(state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initProductionCreativity(S);

    const currentLevel = S.productionSuite.writersRoomLevel || 1;
    if(currentLevel >= 5){
      return { ok: false, msg: "Writers' Room Quorum already at maximum Tier 5 capacity." };
    }

    const cost = currentLevel * 1.5; // $1.5M, $3.0M, $4.5M...
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < cost){
      return { ok: false, msg: "Insufficient cash ($" + cost + "M required)." };
    }

    _modCash(S, -cost);
    S.productionSuite.writersRoomLevel = currentLevel + 1;
    S.productionSuite.writersRoomHired = (currentLevel + 1) * 2;

    if(typeof log === "function"){
      log("[WRITERS' ROOM EXPANDED] Upgraded Studio Writers' Room to Tier " + S.productionSuite.writersRoomLevel + " (-$" + cost + "M). " + S.productionSuite.writersRoomHired + " contract staff writers generating quarterly spec scripts.", "gold");
    }

    return { ok: true, msg: "Writers' Room expanded to Tier " + S.productionSuite.writersRoomLevel + "!" };
  }

  // Remake an Archived Classic Film
  function commissionClassicRemake(originalFilmTitle, modernBudgetM, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initProductionCreativity(S);

    const budget = modernBudgetM || 50;
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < budget){
      return { ok: false, msg: "Insufficient cash for remake budget ($" + budget + "M required)." };
    }

    const title = originalFilmTitle || "Legacy Classic";
    const remakeTitle = title + " (Modern Remake)";

    _modCash(S, -budget);

    const newProject = {
      id: "remake_" + Date.now(),
      title: remakeTitle,
      originalTitle: title,
      genre: "action",
      phase: "development",
      budget: budget,
      quality: 75,
      buzz: 85, // Massive pre-existing nostalgia awareness
      isRemake: true,
      legacyBonus: 0.35,
      weekStarted: S.week || 1
    };

    S.projects = S.projects || [];
    S.projects.push(newProject);

    S.productionSuite.remakeVaultHistory.push({
      remakeTitle,
      originalTitle: title,
      budget,
      week: S.week || 1
    });

    if(typeof log === "function"){
      log("[CLASSIC REMAKE GREENLIT] Commissioned \"" + remakeTitle + "\" (-$" + budget + "M). Inherits +35% baseline nostalgia tracking from original film.", "gold");
    }

    return { ok: true, project: newProject, msg: "Remake greenlit!" };
  }

  // Select Camera & Lens Format for a Project
  function applyCameraFormat(projectId, formatId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found." };

    const fmt = CAMERA_LENS_FORMATS.find(f => f.id === formatId);
    if(!fmt) return { ok: false, msg: "Format not found." };

    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < fmt.costM){
      return { ok: false, msg: "Insufficient cash ($" + fmt.costM + "M required)." };
    }

    _modCash(S, -fmt.costM);
    proj.cameraFormat = fmt.id;
    proj.cameraFormatName = fmt.name;
    proj.quality = Math.min(100, (proj.quality || 60) + fmt.craftBonus);

    if(typeof log === "function"){
      log("[CINEMATOGRAPHY LENS RIG] Fitted " + fmt.name + " on \"" + proj.title + "\" (-$" + fmt.costM + "M, +" + fmt.craftBonus + " Quality).", "gold");
    }

    return { ok: true, msg: fmt.name + " equipped!" };
  }

  // UI Renderer Section
  function renderProductionCreativitySection(state){
    const S = _getG(state);
    if(!S) return "";
    initProductionCreativity(S);

    const roomLvl = S.productionSuite.writersRoomLevel || 1;
    const roomStaff = (roomLvl * 2);

    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>Production Creativity, Lenses &amp; Remake Vault</b><span class='tag gold'>Writers Room T" + roomLvl + "</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Equip anamorphic and 70mm Panavision lenses, harness midnight director creative sparks, expand the permanent writers room, and reboot catalog classics (Silver Screen Story parity).</div>";

    h += "<div class='section-title'>Cinematography Camera Stocks &amp; Lens Formats</div>";
    h += "<div class='grid g2' style='gap:8px;margin-bottom:10px'>";
    CAMERA_LENS_FORMATS.forEach(f => {
      h += "<div style='background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border-left:3px solid var(--gold)'>" +
        "<div class='spread'><b>" + f.name + "</b><span class='tag gold'>$" + f.costM + "M</span></div>" +
        "<div class='tiny muted' style='margin-top:2px'>" + f.desc + "</div>" +
        "<div class='tiny' style='color:var(--green);margin-top:4px'>Craft Bonus: +" + f.craftBonus + " Quality</div>" +
      "</div>";
    });
    h += "</div>";

    h += "<div class='stat-hero' style='margin-bottom:10px'>" +
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + roomStaff + " Writers</div><div class='s-l'>Staff Screenwriters (Tier " + roomLvl + ")</div></div>" +
      "<div class='stat'><div class='s-v'>" + S.productionSuite.directorSparksHistory.length + "</div><div class='s-l'>Auteur Sparks Logged</div></div>" +
      "<div class='stat'><div class='s-v'>" + S.productionSuite.remakeVaultHistory.length + "</div><div class='s-l'>Classics Remade</div></div>" +
    "</div>";

    h += "<div style='display:flex;gap:8px;flex-wrap:wrap'>" +
      "<button class='btn btn-sm btn-primary' id='btnExpandWritersRoom'>Upgrade Writers Room ($" + (roomLvl * 1.5) + "M)</button>" +
      "<button class='btn btn-sm btn-alt' id='btnOpenRemakeVaultModal'>Open Classics Remake Vault</button>" +
    "</div>";

    h += "</div>";
    return h;
  }

  // Open Remake Vault Modal
  function openRemakeVaultModal(state){
    const S = _getG(state);
    if(!S) return;
    initProductionCreativity(S);

    const released = (S.projects || []).filter(p => p.released);

    function renderInner(){
      let h = "<h3>Classics Remake &amp; Reboot Vault</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Remake older catalog blockbusters with modern CGI budgets and contemporary stars, inheriting 35% nostalgia fanbase multipliers.</p>";

      if(!released.length){
        h += "<div class='card' style='text-align:center;padding:16px'><div class='tiny muted'>No archived released titles in studio catalog. Release films to build a legacy vault.</div></div>";
      } else {
        h += "<div class='section-title'>Archived Catalog Titles Available for Reboot</div>";
        released.slice(-6).forEach(p => {
          h += "<div class='card' style='margin-bottom:8px'>" +
            "<div class='spread'><b>" + p.title + "</b><span class='tag green'>Archived Classic</span></div>" +
            "<div class='tiny muted' style='margin:4px 0 8px'>Genre: " + (p.genre || "Action") + " | Historical Gross: $" + (p.wwGross || 150) + "M</div>" +
            "<button class='btn btn-xs btn-primary btnRebootFilm' data-film-title='" + p.title + "'>Greenlight $40M Modern Reboot (+35% Nostalgia Tracking)</button>" +
          "</div>";
        });
      }
      return h;
    }

    function wireEvents(container){
      container.querySelectorAll(".btnRebootFilm").forEach(btn => {
        btn.onclick = () => {
          const res = commissionClassicRemake(btn.dataset.filmTitle, 40, S);
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

    const initialHtml = "<div id='remakeModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#remakeModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const S = _getG(state);

    const bExp = root.querySelector("#btnExpandWritersRoom");
    if(bExp){
      bExp.onclick = () => {
        const res = expandWritersRoom(S);
        if(res.ok){
          if(typeof toast === "function") toast(res.msg, "good");
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.msg, "bad");
        }
      };
    }

    const bRem = root.querySelector("#btnOpenRemakeVaultModal");
    if(bRem){
      bRem.onclick = () => {
        openRemakeVaultModal(S);
      };
    }
  }

  const ProductionCreativityAPI = {
    CAMERA_LENS_FORMATS,
    initProductionCreativity,
    triggerDirectorSpark,
    expandWritersRoom,
    commissionClassicRemake,
    applyCameraFormat,
    renderProductionCreativitySection,
    openRemakeVaultModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = ProductionCreativityAPI;
  }
  global.ProductionCreativity = ProductionCreativityAPI;
  global.openRemakeVaultModal = openRemakeVaultModal;
})(typeof window !== "undefined" ? window : global);
