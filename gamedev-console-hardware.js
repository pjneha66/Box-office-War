/* ═════════════════════════════════════════════════════════════════════════
   GAMEDEV-CONSOLE-HARDWARE.JS — Platform Licensing, Proprietary Console & Staff Stamina
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Game Dev Story (v2.6.9)
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

  // 1. External Gaming Platforms & Dev Kits
  const GAMING_PLATFORMS = [
    {
      id: "microx_boxone",
      name: "Microx BoxOne",
      marketShare: 0.32,
      devKitCost: 2.0, // $2.0M dev kit license
      platformRoyaltyRate: 0.15,
      desc: "North American powerhouse console with robust online multiplayer userbase."
    },
    {
      id: "intendro_switcher",
      name: "Intendro Switcher",
      marketShare: 0.38,
      devKitCost: 2.5,
      platformRoyaltyRate: 0.12,
      desc: "Mass-market hybrid handheld dominating family, party, and casual gaming."
    },
    {
      id: "playstatus_5",
      name: "PlayStatus 5",
      marketShare: 0.45,
      devKitCost: 3.5,
      platformRoyaltyRate: 0.18,
      desc: "High-spec global juggernaut favored by cinematic action and RPG blockbusters."
    },
    {
      id: "cyberdeck_pc",
      name: "CyberDeck Open PC",
      marketShare: 0.50,
      devKitCost: 0.5,
      platformRoyaltyRate: 0.10,
      desc: "Global open desktop gaming platform with low barriers and massive international reach."
    }
  ];

  // 2. Proprietary Studio Hardware Development
  const PROPRIETARY_HARDWARE = {
    id: "parallax_hyper_console",
    name: "Parallax HyperConsole 64-Bit",
    minRepRequired: 75,
    rdCost: 350.0, // $350M R&D investment
    installedBaseMultiplier: 1.5,
    thirdPartyRoyaltyPerWeek: 0.25, // +$250k/wk in third party royalties
    desc: "The ultimate studio flex: engineer your own proprietary gaming hardware ecosystem."
  };

  // 3. Multi-Tier Recruitment Agencies & Headhunters
  const RECRUITMENT_TIERS = [
    {
      id: "school_scout",
      name: "Film & Gaming University Showcase",
      cost: 0.2, // $200k
      guarantee: "Talent with high potential and fresh energy",
      minSkill: 50
    },
    {
      id: "trade_classifieds",
      name: "Variety & Trade Press Open Call",
      cost: 0.8,
      guarantee: "Experienced mid-level industry veterans",
      minSkill: 65
    },
    {
      id: "boutique_agency",
      name: "Century City Boutique Talent Agency",
      cost: 2.5,
      guarantee: "A-List breakout talent with verified rare abilities",
      minSkill: 78
    },
    {
      id: "global_headhunter",
      name: "Zurich Executive Search & Headhunters",
      cost: 6.0,
      guarantee: "Legendary industry visionaries with guaranteed Tier 4 traits",
      minSkill: 88
    }
  ];

  function initGameDevHardware(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.gameDevHardware){
      S.gameDevHardware = {
        licensedPlatforms: ["cyberdeck_pc"],
        proprietaryConsoleActive: false,
        consoleUnitsSold: 0,
        weeklyConsoleRoyalties: 0,
        staffStamina: {} // talentId -> stamina (0 to 100)
      };
    }
    return S.gameDevHardware;
  }

  // Acquire platform dev kit license
  function acquireDevKitLicense(platformId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initGameDevHardware(S);

    const plat = GAMING_PLATFORMS.find(p => p.id === platformId || (platformId === "microx" && p.id === "microx_boxone") || (platformId === "intendro" && p.id === "intendro_switcher") || (platformId === "playstatus" && p.id === "playstatus_5") || (platformId === "pc" && p.id === "cyberdeck_pc"));
    if(!plat) return { ok: false, msg: "Platform not found" };

    if(S.gameDevHardware.licensedPlatforms.includes(plat.id)){
      return { ok: false, msg: "Dev kit license already active." };
    }

    if((S.studio ? S.studio.cash : S.cash) < plat.devKitCost){
      return { ok: false, msg: "Insufficient cash for dev kit ($" + plat.devKitCost + "M required)." };
    }

    _modCash(S, -plat.devKitCost);
    S.gameDevHardware.licensedPlatforms.push(plat.id);

    if(typeof log === "function"){
      log("[HARDWARE DEV KIT] Acquired official " + plat.name + " SDK license (-$" + plat.devKitCost + "M). In-house games can now target this console ecosystem.", "gold");
    }

    return { ok: true, msg: plat.name + " SDK license acquired!" };
  }

  // Build Proprietary Console
  function buildProprietaryConsole(state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initGameDevHardware(S);

    if(S.gameDevHardware.proprietaryConsoleActive){
      return { ok: false, msg: "Proprietary hardware already manufactured." };
    }

    const rep = (S.studio ? S.studio.rep : S.rep) || 0;
    if(rep < PROPRIETARY_HARDWARE.minRepRequired){
      return { ok: false, msg: "Requires Studio Reputation " + PROPRIETARY_HARDWARE.minRepRequired + "+ (Current: " + Math.round(rep) + ")." };
    }

    if((S.studio ? S.studio.cash : S.cash) < PROPRIETARY_HARDWARE.rdCost){
      return { ok: false, msg: "Insufficient cash for hardware R&D ($" + PROPRIETARY_HARDWARE.rdCost + "M required)." };
    }

    _modCash(S, -PROPRIETARY_HARDWARE.rdCost);
    S.gameDevHardware.proprietaryConsoleActive = true;
    S.gameDevHardware.licensedPlatforms.push("proprietary_hyper");

    if(typeof log === "function"){
      log("[PROPRIETARY HARDWARE LAUNCH] Manufactured the " + PROPRIETARY_HARDWARE.name + "! Earning +$" + (PROPRIETARY_HARDWARE.thirdPartyRoyaltyPerWeek * 1000).toFixed(0) + "k/wk in third-party platform cuts.", "gold");
    }

    return { ok: true, msg: "Proprietary Console launched globally!" };
  }

  // Send Talent on Rest Sabbatical
  function sendOnSabbatical(talentId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initGameDevHardware(S);

    const talent = (S.talent || []).find(t => t.id === talentId || t.name === talentId) || { id: talentId, name: "Staff Talent " + talentId };

    const spaCost = 0.2; // $200k luxury retreat
    _modCash(S, -spaCost);

    S.gameDevHardware.staffStamina[talent.id] = 100;
    talent.scandal = Math.max(0, (talent.scandal || 0) - 15);

    if(typeof log === "function"){
      log("[SABBATICAL REST] " + talent.name + " completed a Swiss spa retreat. Stamina fully restored to 100% and scandal cooled.", "gold");
    }

    return { ok: true, msg: "Stamina fully restored!" };
  }

  // Open Hardware & Sabbatical Management Modal
  function openHardwareDeskModal(){
    const S = _getG();
    if(!S) return;
    initGameDevHardware(S);

    function renderInner(){
      let h = "<h3>Game Dev Platform Licensing &amp; Console Hardware Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>License external console dev kits, launch your own proprietary gaming hardware, and manage staff stamina (Game Dev Story parity).</p>";

      h += "<div class='stat-hero' style='margin-bottom:12px'>"+
        "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + S.gameDevHardware.licensedPlatforms.length + "</div><div class='s-l'>Licensed Platforms</div></div>"+
        "<div class='stat'><div class='s-v'>" + (S.gameDevHardware.proprietaryConsoleActive ? "ACTIVE" : "UNBUILT") + "</div><div class='s-l'>Proprietary Console</div></div>"+
      "</div>";

      h += "<div class='section-title'>Gaming Hardware &amp; Dev Kits</div><div class='grid g2' style='gap:8px'>";
      GAMING_PLATFORMS.forEach(p => {
        const owned = S.gameDevHardware.licensedPlatforms.includes(p.id);
        h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
          "<div>"+
            "<div class='spread'><b>" + p.name + "</b><span class='tag " + (owned ? "green" : "gold") + "'>" + (owned ? "SDK Licensed" : "$" + p.devKitCost + "M SDK") + "</span></div>"+
            "<div class='tiny muted' style='margin:4px 0'>" + p.desc + "</div>"+
            "<div class='tiny' style='color:var(--blue)'>Market Share: " + Math.round(p.marketShare*100) + "% | Royalty: " + Math.round(p.platformRoyaltyRate*100) + "%</div>"+
          "</div>"+
          "<div style='margin-top:10px'>"+
            (owned ? "<button class='btn btn-xs' style='width:100%' disabled>Licensed</button>"
                   : "<button class='btn btn-xs btn-primary' style='width:100%' data-plat-id='" + p.id + "'>Acquire SDK License</button>")+
          "</div></div>";
      });
      h += "</div>";

      if(!S.gameDevHardware.proprietaryConsoleActive){
        h += "<div class='section-title' style='margin-top:14px'>Proprietary Hardware Project</div>";
        h += "<div class='card'>"+
          "<div class='spread'><b>" + PROPRIETARY_HARDWARE.name + "</b><span class='tag purple'>$" + PROPRIETARY_HARDWARE.rdCost + "M R&amp;D</span></div>"+
          "<div class='tiny muted' style='margin:6px 0'>" + PROPRIETARY_HARDWARE.desc + "</div>"+
          "<div class='tiny gold'>Req: Rep " + PROPRIETARY_HARDWARE.minRepRequired + "+ | Passive Royalty: +$" + (PROPRIETARY_HARDWARE.thirdPartyRoyaltyPerWeek*1000).toFixed(0) + "k/wk</div>"+
          "<button class='btn btn-sm btn-primary' id='btnBuildConsole' style='margin-top:10px;width:100%'>Manufacture Proprietary Console</button>"+
        "</div>";
      }

      return h;
    }

    function wireEvents(container){
      container.querySelectorAll("[data-plat-id]").forEach(btn => {
        btn.onclick = () => {
          const res = acquireDevKitLicense(btn.dataset.platId, S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      });

      const bCons = container.querySelector("#btnBuildConsole");
      if(bCons){
        bCons.onclick = () => {
          const res = buildProprietaryConsole(S);
          if(res.ok){
            if(typeof toast === "function") toast(res.msg, "good");
            container.innerHTML = renderInner();
            wireEvents(container);
          } else {
            if(typeof toast === "function") toast(res.msg, "bad");
          }
        };
      }
    }

    const initialHtml = "<div id='hardwareModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#hardwareModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function getAverageStaffStamina(state){
    const S = _getG(state);
    if(!S) return 85;
    initGameDevHardware(S);
    const talent = S.talent || [];
    if(!talent.length) return 85;
    let sum = 0;
    talent.forEach(t => {
      const st = (S.gameDevHardware.staffStamina && typeof S.gameDevHardware.staffStamina[t.id] === "number")
        ? S.gameDevHardware.staffStamina[t.id]
        : 85;
      sum += st;
    });
    return Math.round(sum / talent.length);
  }

  function renderStaffStaminaSection(state){
    const S = _getG(state);
    if(!S) return "";
    initGameDevHardware(S);
    const talent = S.talent || [];
    const avg = getAverageStaffStamina(S);
    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>Staff Stamina &amp; Sabbaticals (Burnout Protection)</b><span class='tag " + (avg >= 70 ? "green" : avg >= 40 ? "gold" : "red") + "'>Avg " + avg + "%</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Exhausted talent suffer severe production debuffs and high scandal vulnerability. Send tired staff to Swiss luxury wellness retreats to restore stamina.</div>";
    if(!talent.length){
      h += "<div class='tiny muted'>No contracted talent currently on the roster.</div>";
    } else {
      h += "<div style='display:flex;flex-direction:column;gap:6px'>";
      talent.slice(0, 6).forEach(t => {
        const stam = (S.gameDevHardware.staffStamina && typeof S.gameDevHardware.staffStamina[t.id] === "number") ? S.gameDevHardware.staffStamina[t.id] : 85;
        const color = stam >= 70 ? "var(--green)" : stam >= 40 ? "var(--gold)" : "var(--red)";
        h += "<div style='display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:6px 10px;border-radius:4px;gap:8px'>" +
          "<div style='flex:1;min-width:120px'>" +
            "<div style='font-size:12px;font-weight:600'>" + t.name + " <span class='tiny muted'>(" + (t.kind || "talent") + ")</span></div>" +
            "<div style='background:rgba(255,255,255,0.1);height:4px;border-radius:2px;overflow:hidden;margin-top:4px'>" +
              "<div style='background:" + color + ";width:" + stam + "%;height:100%'></div>" +
            "</div>" +
          "</div>" +
          "<div style='font-size:11px;font-weight:bold;color:" + color + ";min-width:35px;text-align:right'>" + stam + "%</div>" +
          "<button class='btn btn-xs btn-alt btnSendSabbatical' data-sabbatical-id='" + t.id + "' style='font-size:10px;padding:3px 8px'>Rest ($0.2M)</button>" +
        "</div>";
      });
      h += "</div>";
    }
    h += "</div>";
    return h;
  }

  function renderHardwareSection(state){
    const S = _getG(state);
    if(!S) return "";
    initGameDevHardware(S);
    const licensed = S.gameDevHardware.licensedPlatforms || [];
    const consoleActive = S.gameDevHardware.proprietaryConsoleActive;
    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>Console Dev Kits &amp; Proprietary Hardware</b><span class='tag " + (consoleActive ? "purple" : "gold") + "'>" + (consoleActive ? "Proprietary Console Active" : licensed.length + " Dev Kits Licensed") + "</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Acquire platform development licenses (PlayStatus, BoxOne, Switcher) and manufacture proprietary studio gaming hardware ecosystems (Game Dev Story parity).</div>";
    h += "<div class='grid g2' style='gap:8px;margin-bottom:10px'>";
    GAMING_PLATFORMS.forEach(p => {
      const owned = licensed.includes(p.id);
      h += "<div style='background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border-left:3px solid " + (owned ? "var(--green)" : "var(--gold)") + "'>" +
        "<div class='spread'><b>" + p.name + "</b><span class='tag " + (owned ? "green" : "gold") + "'>" + (owned ? "Active" : "$" + p.devKitCost + "M") + "</span></div>" +
        "<div class='tiny muted' style='margin-top:2px'>Share: " + Math.round(p.marketShare*100) + "% | Royalty: " + Math.round(p.platformRoyaltyRate*100) + "%</div>" +
      "</div>";
    });
    h += "</div>";
    h += "<button class='btn btn-sm btn-primary' id='btnOpenHardwareDesk' style='width:100%'>Open Hardware &amp; Platform Desk</button>";
    h += "</div>";
    return h;
  }

  function renderHardwareModal(state){
    openHardwareDeskModal();
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const S = _getG(state);

    root.querySelectorAll(".btnSendSabbatical").forEach(btn => {
      btn.onclick = (e) => {
        if(e) e.stopPropagation();
        const id = btn.dataset.sabbaticalId;
        const res = sendOnSabbatical(id, S);
        if(res.ok){
          if(typeof toast === "function") toast(res.msg, "good");
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.msg, "bad");
        }
      };
    });

    const btnDesk = root.querySelector("#btnOpenHardwareDesk");
    if(btnDesk){
      btnDesk.onclick = () => {
        openHardwareDeskModal();
      };
    }
  }

  const GameDevHardwareAPI = {
    GAMING_PLATFORMS,
    PROPRIETARY_HARDWARE,
    RECRUITMENT_TIERS,
    initGameDevHardware,
    acquireDevKitLicense,
    buildProprietaryConsole,
    sendOnSabbatical,
    openHardwareDeskModal,
    getAverageStaffStamina,
    renderStaffStaminaSection,
    renderHardwareSection,
    renderHardwareModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = GameDevHardwareAPI;
  }
  global.GameDevHardware = GameDevHardwareAPI;
  global.openHardwareDeskModal = openHardwareDeskModal;
})(typeof window !== "undefined" ? window : global);
