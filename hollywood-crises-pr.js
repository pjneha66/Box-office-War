/* ═════════════════════════════════════════════════════════════════════════
   HOLLYWOOD-CRISES-PR.JS — PR Crisis Center, Scandals & Legal Operations
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc (Crisis Management & Legal PR)
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

  // 1. Hollywood Crisis Types
  const CRISIS_CATALOG = [
    {
      id: "script_leak",
      title: "Confidential Third-Act Script Leak",
      category: "leak",
      severity: "moderate",
      repDamagePerWeek: 3,
      buzzPenaltyPct: 0.15,
      desc: "An early unwatermarked screenplay draft was leaked onto Reddit, spoiling plot twists and inciting fan speculation."
    },
    {
      id: "director_actor_feud",
      title: "Explosive On-Set Feud & Creative Clash",
      category: "production",
      severity: "high",
      repDamagePerWeek: 5,
      delayWeeks: 2,
      desc: "A heated physical and creative screaming match between the director and marquee lead halted shooting for days."
    },
    {
      id: "actor_tabloid_arrest",
      title: "Marquee Star Arrest & Tabloid Exposé",
      category: "talent",
      severity: "critical",
      repDamagePerWeek: 8,
      boxOfficePenaltyPct: 0.25,
      desc: "Your leading star was arrested in Sunset Boulevard following a high-speed incident, triggering national news coverage."
    },
    {
      id: "plagiarism_lawsuit",
      title: "Copyright Infringement & Plagiarism Claim",
      category: "legal",
      severity: "high",
      repDamagePerWeek: 4,
      claimDamagesM: 12.0,
      desc: "An indie screenwriter filed a federal copyright lawsuit claiming the upcoming tentpole copied their registered pitch."
    },
    {
      id: "cam_rip_piracy",
      title: "Pre-Release HD Cam-Rip Leak",
      category: "piracy",
      severity: "high",
      repDamagePerWeek: 2,
      boxOfficePenaltyPct: 0.30,
      desc: "An illegal high-definition theatrical print leaked on torrent trackers ahead of opening weekend."
    },
    {
      id: "guild_strike_threat",
      title: "Union Health & Residuals Grievance",
      category: "union",
      severity: "moderate",
      repDamagePerWeek: 3,
      delayWeeks: 3,
      desc: "IATSE and SAG union liaisons filed unfair labor practice complaints over brutal 16-hour soundstage turnaround times."
    }
  ];

  // 2. Mitigation Strategies
  const RESOLUTION_STRATEGIES = [
    {
      id: "public_apology",
      name: "Public Statement & Apology",
      costM: 0.25, // $250k
      reliefPct: 0.50,
      speedWeeks: 1,
      desc: "Issue a polished, humble press statement taking accountability and committing to corrective internal guidelines."
    },
    {
      id: "press_tour",
      name: "Goodwill Media Press Tour",
      costM: 0.75, // $750k
      reliefPct: 0.75,
      speedWeeks: 2,
      desc: "Deploy charismatic studio executives and stars on national morning shows and podcast interviews to control the narrative."
    },
    {
      id: "settlement_payout",
      name: "Confidential Settlement & Non-Disclosure",
      costM: 2.50, // $2.5M
      reliefPct: 0.90,
      speedWeeks: 1,
      desc: "Quietly pay out aggrieved parties under binding non-disclosure agreements with immediate public retraction clauses."
    },
    {
      id: "legal_action",
      name: "Aggressive Injunction & Retraction Litigation",
      costM: 5.00, // $5.0M
      reliefPct: 0.98,
      speedWeeks: 1,
      desc: "Retain high-powered Beverly Hills litigators to issue subpoenas, gag orders, and aggressive defamation counter-suits."
    }
  ];

  function initHollywoodCrises(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.crisisCenter){
      S.crisisCenter = {
        activeCrises: [],
        resolvedHistory: [],
        totalDamageAverted: 0,
        antiPiracyTechActive: false,
        fixerRetainerActive: false
      };
    }
    return S.crisisCenter;
  }

  // Trigger a crisis
  function triggerCrisis(crisisId, projectTitle, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initHollywoodCrises(S);

    const tmpl = CRISIS_CATALOG.find(c => c.id === crisisId) || CRISIS_CATALOG[0];
    const newCrisis = {
      instanceId: "cr_" + Date.now() + "_" + Math.floor(Math.random()*1000),
      id: tmpl.id,
      title: tmpl.title,
      projectTitle: projectTitle || "Studio General Operations",
      category: tmpl.category,
      severity: tmpl.severity,
      repDamagePerWeek: tmpl.repDamagePerWeek,
      buzzPenaltyPct: tmpl.buzzPenaltyPct || 0,
      boxOfficePenaltyPct: tmpl.boxOfficePenaltyPct || 0,
      claimDamagesM: tmpl.claimDamagesM || 0,
      weeksActive: 0,
      resolved: false,
      startWeek: S.week || 1
    };

    S.crisisCenter.activeCrises.push(newCrisis);

    if(typeof log === "function"){
      log("[HOLLYWOOD PR EMERGENCY] " + newCrisis.title + " impacting \"" + newCrisis.projectTitle + "\". Studio prestige under immediate media threat.", "bad");
    }

    return { ok: true, crisis: newCrisis };
  }

  // Resolve a crisis using selected strategy
  function resolveCrisis(instanceId, strategyId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initHollywoodCrises(S);

    const crisis = S.crisisCenter.activeCrises.find(c => c.instanceId === instanceId);
    if(!crisis) return { ok: false, msg: "Active crisis record not found." };

    const strat = RESOLUTION_STRATEGIES.find(s => s.id === strategyId);
    if(!strat) return { ok: false, msg: "Invalid resolution strategy selected." };

    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < strat.costM){
      return { ok: false, msg: "Insufficient treasury funds ($" + strat.costM + "M required)." };
    }

    _modCash(S, -strat.costM);

    // Apply relief
    crisis.resolved = true;
    crisis.resolutionStrategy = strat.name;
    crisis.resolvedWeek = S.week || 1;

    // Remove from active, push to history
    S.crisisCenter.activeCrises = S.crisisCenter.activeCrises.filter(c => c.instanceId !== instanceId);
    S.crisisCenter.resolvedHistory.push(crisis);
    S.crisisCenter.totalDamageAverted += Math.round(crisis.repDamagePerWeek * strat.reliefPct * 4);

    if(typeof log === "function"){
      log("[CRISIS RESOLUTION DEPLOYED] Executed " + strat.name + " on \"" + crisis.title + "\" (-$" + strat.costM + "M). Media narrative neutralized.", "good");
    }

    return { ok: true, msg: "Crisis resolved via " + strat.name + "!" };
  }

  // Retain Hollywood Celebrity Fixer
  function retainCelebrityFixer(state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initHollywoodCrises(S);

    if(S.crisisCenter.fixerRetainerActive){
      return { ok: false, msg: "Celebrity fixer is already on active annual retainer." };
    }

    const cost = 4.0; // $4.0M annual retainer
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < cost){
      return { ok: false, msg: "Insufficient cash for elite fixer retainer ($" + cost + "M required)." };
    }

    _modCash(S, -cost);
    S.crisisCenter.fixerRetainerActive = true;

    if(typeof log === "function"){
      log("[BLACK-BAG FIXER RETAINED] Contracted an elite Hollywood fixer (-$" + cost + "M). Crisis occurrence odds reduced by 60%.", "gold");
    }

    return { ok: true, msg: "Hollywood Fixer on retainer!" };
  }

  // Activate High-Security Anti-Piracy Watermarking
  function activateAntiPiracy(state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initHollywoodCrises(S);

    if(S.crisisCenter.antiPiracyTechActive){
      return { ok: false, msg: "Anti-piracy forensic watermarking already operational." };
    }

    const cost = 1.8; // $1.8M tech infrastructure
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < cost){
      return { ok: false, msg: "Insufficient cash ($" + cost + "M required)." };
    }

    _modCash(S, -cost);
    S.crisisCenter.antiPiracyTechActive = true;

    if(typeof log === "function"){
      log("[ANTI-PIRACY SECURITY] Installed forensic digital DCP watermarking (-$" + cost + "M). Theatrical leaks eliminated.", "gold");
    }

    return { ok: true, msg: "Anti-Piracy Suite active!" };
  }

  // Weekly crisis simulation process
  function processWeeklyCrises(state){
    const S = _getG(state);
    if(!S) return;
    initHollywoodCrises(S);

    const center = S.crisisCenter;
    let netRepLoss = 0;

    center.activeCrises.forEach(c => {
      c.weeksActive = (c.weeksActive || 0) + 1;
      netRepLoss += (c.repDamagePerWeek || 2);
    });

    if(netRepLoss > 0 && S.studio && typeof S.studio.rep === "number"){
      S.studio.rep = Math.max(0, Math.round((S.studio.rep - netRepLoss) * 10) / 10);
    }

    // Small random chance of incident if not protected
    const fixerProtect = center.fixerRetainerActive ? 0.02 : 0.06;
    if(center.activeCrises.length === 0 && Math.random() < fixerProtect){
      const unreleased = (S.projects || []).filter(p => !p.released);
      const projTitle = unreleased.length ? unreleased[Math.floor(Math.random()*unreleased.length)].title : "Studio Slate";
      const randomCrisis = CRISIS_CATALOG[Math.floor(Math.random() * CRISIS_CATALOG.length)];
      triggerCrisis(randomCrisis.id, projTitle, S);
    }
  }

  // UI Renderer Section
  function renderCrisisCenterSection(state){
    const S = _getG(state);
    if(!S) return "";
    initHollywoodCrises(S);

    const center = S.crisisCenter;
    const active = center.activeCrises || [];

    let h = "<div class='card' style='margin-bottom:12px;border-left:4px solid " + (active.length ? "var(--red)" : "var(--green)") + "'>";
    h += "<div class='spread'><b>Hollywood PR Crisis Center &amp; Media War Room</b><span class='tag " + (active.length ? "red" : "green") + "'>" + (active.length ? active.length + " Active Scandals" : "Clean Media Record") + "</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Hollywood scandals, paparazzi exposés, script leaks, and copyright litigation. Deploy strategic mitigations to defend studio prestige.</div>";

    if(!active.length){
      h += "<div style='background:rgba(255,255,255,0.03);padding:10px 14px;border-radius:4px;margin-bottom:10px;text-align:center'>" +
        "<span class='small' style='color:var(--green);font-weight:600'>No active PR emergencies or legal injunctions against studio slates.</span>" +
      "</div>";
    } else {
      h += "<div style='display:flex;flex-direction:column;gap:8px;margin-bottom:10px'>";
      active.forEach(c => {
        h += "<div style='background:rgba(255,50,50,0.08);border:1px solid rgba(255,100,100,0.25);padding:10px;border-radius:4px'>" +
          "<div class='spread'><b style='color:var(--red)'>[EMERGENCY] " + c.title + "</b><span class='tag red'>-" + c.repDamagePerWeek + " Rep/Wk</span></div>" +
          "<div class='tiny muted' style='margin:4px 0 6px'>Target: " + c.projectTitle + " | Category: " + c.category.toUpperCase() + "</div>" +
          "<div class='tiny' style='margin-bottom:8px'>" + c.desc + "</div>" +
          "<div style='display:flex;gap:6px;flex-wrap:wrap'>" +
            RESOLUTION_STRATEGIES.map(s =>
              "<button class='btn btn-xs btn-alt btnResolveCrisis' data-crisis-id='" + c.instanceId + "' data-strat-id='" + s.id + "'>" + s.name + " ($" + s.costM + "M)</button>"
            ).join("") +
          "</div>" +
        "</div>";
      });
      h += "</div>";
    }

    h += "<div style='display:flex;gap:8px;flex-wrap:wrap'>" +
      "<button class='btn btn-sm " + (center.fixerRetainerActive ? "btn-ghost" : "btn-primary") + "' id='btnRetainFixer' " + (center.fixerRetainerActive ? "disabled" : "") + ">" + (center.fixerRetainerActive ? "Fixer On Retainer" : "Retain Celebrity Fixer ($4.0M/yr)") + "</button>" +
      "<button class='btn btn-sm " + (center.antiPiracyTechActive ? "btn-ghost" : "btn-alt") + "' id='btnAntiPiracy' " + (center.antiPiracyTechActive ? "disabled" : "") + ">" + (center.antiPiracyTechActive ? "Anti-Piracy Watermarking Active" : "Forensic Watermarking ($1.8M)") + "</button>" +
    "</div>";

    h += "</div>";
    return h;
  }

  // Open Full Crisis Modal
  function openCrisisModal(state){
    const S = _getG(state);
    if(!S) return;
    initHollywoodCrises(S);

    function renderInner(){
      let h = "<h3>Hollywood PR Crisis Center &amp; Legal Operations</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Command studio reputation defenses, deploy crisis communication matrixes, and shut down hostile media cycles.</p>";
      h += renderCrisisCenterSection(S);
      return h;
    }

    function wireEvents(container){
      container.querySelectorAll(".btnResolveCrisis").forEach(btn => {
        btn.onclick = () => {
          const res = resolveCrisis(btn.dataset.crisisId, btn.dataset.stratId, S);
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

      const bFix = container.querySelector("#btnRetainFixer");
      if(bFix){
        bFix.onclick = () => {
          const res = retainCelebrityFixer(S);
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

      const bPir = container.querySelector("#btnAntiPiracy");
      if(bPir){
        bPir.onclick = () => {
          const res = activateAntiPiracy(S);
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
    }

    const initialHtml = "<div id='crisisModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#crisisModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const S = _getG(state);

    root.querySelectorAll(".btnResolveCrisis").forEach(btn => {
      btn.onclick = (e) => {
        if(e) e.stopPropagation();
        const res = resolveCrisis(btn.dataset.crisisId, btn.dataset.stratId, S);
        if(res.ok){
          if(typeof toast === "function") toast(res.msg, "good");
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.msg, "bad");
        }
      };
    });

    const bFix = root.querySelector("#btnRetainFixer");
    if(bFix){
      bFix.onclick = () => {
        const res = retainCelebrityFixer(S);
        if(res.ok){
          if(typeof toast === "function") toast(res.msg, "good");
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.msg, "bad");
        }
      };
    }

    const bPir = root.querySelector("#btnAntiPiracy");
    if(bPir){
      bPir.onclick = () => {
        const res = activateAntiPiracy(S);
        if(res.ok){
          if(typeof toast === "function") toast(res.msg, "good");
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.msg, "bad");
        }
      };
    }
  }

  const HollywoodCrisesAPI = {
    CRISIS_CATALOG,
    RESOLUTION_STRATEGIES,
    initHollywoodCrises,
    triggerCrisis,
    resolveCrisis,
    retainCelebrityFixer,
    activateAntiPiracy,
    processWeeklyCrises,
    renderCrisisCenterSection,
    openCrisisModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = HollywoodCrisesAPI;
  }
  global.HollywoodCrises = HollywoodCrisesAPI;
  global.openCrisisModal = openCrisisModal;
})(typeof window !== "undefined" ? window : global);
