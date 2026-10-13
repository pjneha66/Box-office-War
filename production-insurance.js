/* ═════════════════════════════════════════════════════════════════════════
   PRODUCTION-INSURANCE.JS — Film Completion Guarantor & Risk Insurance
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

  const INSURANCE_TIERS = {
    overrun: {
      id: "overrun",
      name: "Budget Overrun Shield",
      premiumRate: 0.025, // 2.5% of film budget upfront
      coverage: 0.85, // 85% of any overrun absorbed by guarantor
      desc: "Protects against director shoot delays, bad weather, and reshoot overruns. Underwriter absorbs 85% of excess costs."
    },
    talent_indemnity: {
      id: "talent_indemnity",
      name: "Key Star & Cast Indemnity",
      premiumRate: 0.035, // 3.5% of film budget
      coverage: 0.90,
      desc: "Guarantees full financial coverage against sudden star illness, scandals, contract disputes, or emergency recasting."
    },
    full_completion: {
      id: "full_completion",
      name: "Comprehensive Hollywood Completion Bond",
      premiumRate: 0.05, // 5.0% of film budget
      coverage: 1.0, // 100% of all unplanned costs covered
      desc: "Full institutional completion guaranty. Eliminates all downside overrun risk, capping studio exposure exactly at greenlight budget."
    }
  };

  function initInsurance(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.insurancePolicies){
      S.insurancePolicies = [];
    }
    return S.insurancePolicies;
  }

  function buyInsurancePolicy(projectId, tierId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initInsurance(S);

    const project = (S.projects || []).find(p => p.id === projectId);
    if(!project) return { ok: false, error: "Project not found in pipeline." };

    const tier = INSURANCE_TIERS[tierId] || INSURANCE_TIERS.overrun;
    const premium = Math.max(0.2, Math.round(project.budget * tier.premiumRate * 10) / 10);

    if((S.studio.cash || 0) < premium){
      return { ok: false, error: "Insufficient funds to bind policy. Premium requires $" + premium + "M." };
    }

    // Check if project already insured
    if(S.insurancePolicies.some(p => p.projectId === projectId)){
      return { ok: false, error: "Project \"" + project.title + "\" already has an active policy bound." };
    }

    S.studio.cash = Math.round((S.studio.cash - premium) * 10) / 10;

    const policy = {
      id: "pol_" + Date.now() + "_" + project.id,
      projectId: project.id,
      projectTitle: project.title,
      tierId: tier.id,
      tierName: tier.name,
      coverageRate: tier.coverage,
      premiumPaid: premium,
      claimsSettled: 0,
      boundWeek: S.week
    };

    project.insurancePolicy = policy;
    S.insurancePolicies.push(policy);

    if(typeof log === "function"){
      log("Bound " + tier.name + " for \"" + project.title + "\" (premium -$" + premium + "M). Budget protected at " + Math.round(tier.coverage * 100) + "%.", "gold");
    }

    return { ok: true, policy };
  }

  function processOverrunClaim(projectId, overrunAmount, state){
    const S = _getG(state);
    if(!S || !S.insurancePolicies) return overrunAmount;

    const policy = S.insurancePolicies.find(p => p.projectId === projectId);
    if(!policy) return overrunAmount;

    const covered = Math.round(overrunAmount * policy.coverageRate * 10) / 10;
    const netCost = Math.max(0, Math.round((overrunAmount - covered) * 10) / 10);
    policy.claimsSettled = Math.round(((policy.claimsSettled || 0) + covered) * 10) / 10;

    if(typeof log === "function"){
      log("Guarantor settled $" + covered + "M overrun claim on \"" + policy.projectTitle + "\". Studio out-of-pocket: $" + netCost + "M.", "good");
    }

    return netCost;
  }

  function openInsuranceModal(projectId){
    const S = _getG();
    if(!S) return;

    let target = null;
    if(projectId){
      target = (S.projects || []).find(p => p.id === projectId);
    }
    if(!target){
      target = (S.projects || []).find(p => p.phase === "pre" || p.phase === "shoot");
    }

    if(!target){
      if(typeof toast === "function") toast("No active productions available to insure.", "bad");
      return;
    }

    let h = "<h3>Production Completion Guarantor &amp; Risk Insurance</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Underwrite budget protection policies for \"" + esc(target.title) + "\" (Budget: $" + target.budget + "M). Prevent catastrophic production cost spikes.</div>";

    h += "<div class='grid g3'>";
    for(const k in INSURANCE_TIERS){
      const tier = INSURANCE_TIERS[k];
      const prem = Math.max(0.2, Math.round(target.budget * tier.premiumRate * 10) / 10);
      const isBound = (target.insurancePolicy || {}).tierId === tier.id;

      h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
        "<div>"+
          "<div class='spread'><b>" + esc(tier.name) + "</b><span class='tag " + (tier.id === "full_completion" ? "gold" : "") + "'>" + Math.round(tier.coverage * 100) + "% Covered</span></div>"+
          "<div class='tiny muted' style='margin:6px 0'>" + esc(tier.desc) + "</div>"+
          "<div class='tiny' style='margin:4px 0'>Upfront Premium: <b>$" + prem + "M</b></div>"+
        "</div>"+
        "<div style='margin-top:10px'>"+
          (isBound ? (
            "<button class='btn btn-sm btn-alt' style='width:100%' disabled>Policy Active</button>"
          ) : (
            "<button class='btn btn-sm btn-primary' style='width:100%' data-buyins='" + target.id + ":" + tier.id + "'>Bind ($" + prem + "M)</button>"
          ))+
        "</div>"+
      "</div>";
    }
    h += "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    v.querySelectorAll("[data-buyins]").forEach(b => {
      b.onclick = () => {
        const parts = b.dataset.buyins.split(":");
        const res = buyInsurancePolicy(+parts[0], parts[1]);
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

  const InsuranceModule = {
    INSURANCE_TIERS,
    initInsurance,
    buyInsurancePolicy,
    processOverrunClaim,
    openInsuranceModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = InsuranceModule;
  }
  global.InsuranceModule = InsuranceModule;
  global.initInsurance = initInsurance;
  global.buyInsurancePolicy = buyInsurancePolicy;
  global.processOverrunClaim = processOverrunClaim;
  global.openInsuranceModal = openInsuranceModal;
})(typeof window !== "undefined" ? window : global);
