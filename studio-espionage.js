/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-ESPIONAGE.JS — Industrial Espionage & Studio Intelligence Desk
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc (Spy & Rival Studio Controller)
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

  const ESPIONAGE_MISSIONS = {
    infiltrate_slate: {
      id: "infiltrate_slate",
      name: "Infiltrate Rival Production Slate",
      cost: 0.45, // $0.45M ($450k)
      riskPct: 5,
      desc: "Plant an industry mole inside a rival studio to steal their secret slate, upcoming genres, and planned release calendar."
    },
    poach_talent_intel: {
      id: "poach_talent_intel",
      name: "Talent Contract Intelligence",
      cost: 0.65, // $0.65M ($650k)
      riskPct: 10,
      desc: "Bribe rival agency liaisons to uncover talent contract expiration dates and renegotiation vulnerability."
    },
    counter_pr_leak: {
      id: "counter_pr_leak",
      name: "Tactical Press Leak / Counter-Marketing",
      cost: 1.25, // $1.25M
      riskPct: 20,
      desc: "Anonymously leak damaging development chaos stories to the trades about a rival's upcoming tentpole to suppress their opening buzz."
    }
  };

  function initStudioEspionage(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.espionage){
      S.espionage = {
        reports: [],
        discoveredIntel: {},
        scandalsTriggered: 0
      };
    }
    return S.espionage;
  }

  function executeEspionageMission(missionId, targetStudioName, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initStudioEspionage(S);

    const mission = ESPIONAGE_MISSIONS[missionId];
    if(!mission) return { ok: false, msg: "Invalid espionage mission: " + missionId };

    const cash = _getCashM(S);
    if(cash < mission.cost){
      return { ok: false, msg: "Insufficient funds for covert operation. Required: $" + mission.cost + "M" };
    }

    _modCashM(S, -mission.cost);

    const roll = Math.random() * 100;
    if(roll < mission.riskPct){
      S.espionage.scandalsTriggered++;
      if(S.studio && typeof S.studio.rep === "number"){
        S.studio.rep = Math.max(0, S.studio.rep - 4);
      }
      const scandalMsg = "COVERT OPERATION EXPOSED: Spy mission against " + targetStudioName + " leaked to press!";
      if(typeof log === "function") log(scandalMsg, "bad");
      return {
        ok: false,
        scandal: true,
        msg: scandalMsg
      };
    }

    let intelData = {};
    if(missionId === "infiltrate_slate"){
      intelData = {
        target: targetStudioName,
        slate: [
          { title: "Project Apex", genre: "sci-fi", budget: 180, targetWeek: ((S.week || 1) + 8) % 52, status: "post_production" },
          { title: "Shadow Dynasty", genre: "action", budget: 140, targetWeek: ((S.week || 1) + 16) % 52, status: "filming" }
        ],
        intelSummary: "Target is concentrating capital into two tentpoles. Recommend avoiding release dates in Week " + (((S.week || 1) + 8) % 52) + "."
      };
    } else if(missionId === "poach_talent_intel"){
      intelData = {
        target: targetStudioName,
        talentList: [
          { name: "Top-Billed A-Lister", role: "actor", contractExpiresInWeeks: 4, morale: "disgruntled", poachingDiscount: 0.20 },
          { name: "Visionary Auteur", role: "director", contractExpiresInWeeks: 12, morale: "neutral", poachingDiscount: 0.15 }
        ],
        intelSummary: "Key talent contracts are vulnerable. Fast signing bonuses can poach marquee talent without agency bidding wars."
      };
    } else if(missionId === "counter_pr_leak"){
      intelData = {
        target: targetStudioName,
        buzzSuppression: 22,
        intelSummary: "Smear leak syndicated by trade blogs. Rival opening weekend projections depressed by ~22%."
      };
    }

    const record = {
      missionId: mission.id,
      missionName: mission.name,
      targetStudioName,
      week: S.week || 1,
      intel: intelData
    };
    S.espionage.reports.unshift(record);

    if(typeof log === "function"){
      log("ESPIONAGE SUCCESS: " + mission.name + " against " + targetStudioName + " concluded with intel.", "gold");
    }

    return {
      ok: true,
      data: record,
      msg: "Mission concluded successfully without detection."
    };
  }

  function openStudioEspionageModal(){
    const S = _getG();
    if(!S) return;
    initStudioEspionage(S);

    const rivals = (S.rivals || []).map(r => r.name || r.id || "Rival Studio");
    const targetNames = rivals.length ? rivals : ["Apex Pictures", "Monolith Cinema Corp", "Starlight International"];

    let h = "<h3>Industrial Espionage &amp; Intelligence Desk</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Deploy undercover informants to infiltrate rival production slates, uncover expiring talent pacts, or leak counter-marketing stories to sabotage rival box office openings.</div>";

    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + (S.espionage.reports || []).length + "</div><div class='s-l'>Intel Dossiers</div></div>"+
      "<div class='stat'><div class='s-v'>" + targetNames.length + "</div><div class='s-l'>Rivals Monitored</div></div>"+
      "<div class='stat'><div class='s-v' style='color:" + (S.espionage.scandalsTriggered > 0 ? "var(--bad)" : "var(--good)") + "'>" + S.espionage.scandalsTriggered + "</div><div class='s-l'>Scandals Caught</div></div>"+
    "</div>";

    h += "<div class='section-title'>Commission Covert Operation</div><div class='grid g1' style='gap:8px'>";
    for(const key in ESPIONAGE_MISSIONS){
      const m = ESPIONAGE_MISSIONS[key];
      h += "<div class='card spread'>"+
        "<div>"+
          "<b>" + m.name + "</b><span class='tag' style='margin-left:6px'>Risk: " + m.riskPct + "%</span>"+
          "<div class='tiny muted' style='margin:4px 0'>" + m.desc + "</div>"+
          "<div class='tiny' style='color:var(--gold)'>Target: " + targetNames[0] + " | Cost: $" + m.cost + "M</div>"+
        "</div>"+
        "<div>"+
          "<button class='btn btn-sm btn-primary' data-spy='" + m.id + "' data-target='" + targetNames[0] + "'>Launch Op</button>"+
        "</div>"+
      "</div>";
    }
    h += "</div>";

    if((S.espionage.reports || []).length > 0){
      h += "<div class='section-title' style='margin-top:14px'>Interception Dossiers</div><div class='grid g1' style='gap:6px'>";
      S.espionage.reports.slice(0, 4).forEach(rep => {
        h += "<div class='card tiny'>"+
          "<div class='spread'><b>" + rep.missionName + " — Target: " + rep.targetStudioName + "</b><span class='tag'>Week " + rep.week + "</span></div>"+
          "<div class='muted' style='margin-top:4px'>" + (rep.intel.intelSummary || "Information archived.") + "</div>"+
        "</div>";
      });
      h += "</div>";
    }

    if(typeof openModal === "function"){
      const v = openModal(h);
      if(v){
        v.querySelectorAll("[data-spy]").forEach(btn => {
          btn.onclick = () => {
            const res = executeEspionageMission(btn.dataset.spy, btn.dataset.target, S);
            if(res.ok){
              if(typeof toast === "function") toast(res.msg, "good");
              openStudioEspionageModal();
              if(typeof render === "function") render();
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          };
        });
      }
    }
  }

  const StudioEspionageAPI = {
    ESPIONAGE_MISSIONS,
    initStudioEspionage,
    executeEspionageMission,
    openStudioEspionageModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = StudioEspionageAPI;
  }
  global.StudioEspionage = StudioEspionageAPI;
  global.openStudioEspionageModal = openStudioEspionageModal;
})(typeof window !== "undefined" ? window : global);
