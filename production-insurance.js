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

    let head = `<div class='produce-modal-head'><span class='command-eyebrow'>PRODUCTION OFFICE / GUARANTOR</span><h3>Completion guarantor &amp; risk insurance</h3><p>Underwrite budget protection for &quot;${esc(target.title)}&quot; — budget ${fmtM(target.budget)}. Prevent catastrophic overruns, star claims and weather delays. Premium is paid up front; claims are settled from the same desk.</p></div>`;
    let body = `<div class='produce-modal-body'><div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px'>`;
    for(const k in INSURANCE_TIERS){
      const tier = INSURANCE_TIERS[k];
      const prem = Math.max(0.2, Math.round(target.budget * tier.premiumRate * 10) / 10);
      const isBound = (target.insurancePolicy || {}).tierId === tier.id;
      body += `<div class='produce-modal-card' style='display:flex;flex-direction:column;justify-content:space-between'>`+
        `<div>`+
          `<div class='spread'><b>${esc(tier.name)}</b><span class='tag ${tier.id === "full_completion" ? "gold" : ""}'>${Math.round(tier.coverage * 100)}% Covered</span></div>`+
          `<div class='tiny muted' style='margin:6px 0'>${esc(tier.desc)}</div>`+
          `<div class='tiny' style='margin:4px 0'>Upfront Premium: <b>${fmtM(prem)}</b></div>`+
        `</div>`+
        `<div style='margin-top:10px'>`+
          (isBound ? `<button class='produce-ghost' style='width:100%' disabled>Policy Active</button>` : `<button class='produce-action' style='width:100%' data-buyins='${target.id}:${tier.id}'>Bind (${fmtM(prem)})</button>`)+
        `</div>`+
      `</div>`;
    }
    body += `</div></div>`;
    let foot = `<div class='produce-modal-actions'><span class='tiny muted'>${target.insurancePolicy ? `Active: ${esc(target.insurancePolicy.tierName)} — ${Math.round(target.insurancePolicy.coverageRate*100)}% covered` : `Choose a tier — the premium is debited from ${fmtM(S.studio.cash)} cash on hand`}</span><button class='produce-ghost' onclick='closeModal()'>Close</button></div>`;
    const v = openModal(head+body+foot,{className:'command-produce-modal'});
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
