/* ═════════════════════════════════════════════════════════════════════════
   DEMOGRAPHICS-AUDIENCES.JS — Four-Quadrant Demographics & Dial Test Screenings
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Silver Screen Story & Box Office Sim 2
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

  const AUDIENCE_QUADRANTS = [
    {
      id: "kids_family",
      name: "Kids & Family (Under 13)",
      sharePct: 0.22,
      favoredGenres: ["animation", "adventure", "comedy", "family"],
      favoredThemes: ["animals", "superheroes", "magic", "sports"],
      decayRate: 0.85, // High repeat viewing and weekend legs
      desc: "Massive holiday and Saturday morning turnout. Driven by parent-approved ratings and character merchandising."
    },
    {
      id: "teens",
      name: "Teens & High Schoolers (13-17)",
      sharePct: 0.28,
      favoredGenres: ["horror", "action", "scifi", "romance"],
      favoredThemes: ["monsters", "dystopia", "time_travel", "slasher"],
      decayRate: 0.90, // Fast opening weekend rushes with high social buzz
      desc: "High opening weekend front-loading. Driven by viral TikTok word-of-mouth and PG-13 jump scares."
    },
    {
      id: "young_adults",
      name: "Young Adults (18-34)",
      sharePct: 0.32,
      favoredGenres: ["action", "thriller", "scifi", "comedy"],
      favoredThemes: ["cyberpunk", "heist", "space", "dark_comedy"],
      decayRate: 0.88,
      desc: "The core theatrical demographic commanding late-night Thursday previews and premium IMAX ticket sales."
    },
    {
      id: "mature_seniors",
      name: "Mature & Prestige Seekers (35+)",
      sharePct: 0.18,
      favoredGenres: ["drama", "historical", "crime", "biopic"],
      favoredThemes: ["war", "political", "courtroom", "investigation"],
      decayRate: 0.78, // Very strong long-tail word-of-mouth legs
      desc: "Awards-driven cinephiles and weekend matinee crowds. Prioritizes screenplay nuance and acting pedigree over explosions."
    }
  ];

  function initDemographics(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.demographicEngine){
      S.demographicEngine = {
        lastScreeningResult: null,
        trackedFilms: {},
        audienceAnalytics: {
          kidsShare: 0.22,
          teensShare: 0.28,
          youngAdultsShare: 0.32,
          matureShare: 0.18
        }
      };
    }
    return S.demographicEngine;
  }

  // Calculate Demographic Resonance for a Project
  function evaluateDemographicAppeal(project, state){
    const S = _getG(state);
    const genre = (project && project.genre ? project.genre.toLowerCase() : "drama");
    const theme = (project && project.theme ? project.theme.toLowerCase() : "general");

    const scores = {};
    AUDIENCE_QUADRANTS.forEach(q => {
      let base = 50;
      if(q.favoredGenres.includes(genre)) base += 25;
      if(q.favoredThemes.includes(theme)) base += 20;
      // Rating adjustments
      const rating = project && project.rating ? project.rating : "PG-13";
      if(q.id === "kids_family"){
        if(rating === "G" || rating === "PG") base += 15;
        if(rating === "R") base = 5;
      }
      if(q.id === "mature_seniors"){
        if(genre === "drama" || genre === "historical") base += 15;
      }
      scores[q.id] = Math.min(100, Math.max(10, base));
    });

    return scores;
  }

  // Conduct Minute-by-Minute Dial Test Screening
  function runDialTestScreening(projectId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initDemographics(S);

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Active project not found." };

    const cost = 0.35; // $350k research agency fee
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < cost){
      return { ok: false, msg: "Insufficient cash for focus group dial screening ($" + cost + "M required)." };
    }

    _modCash(S, -cost);

    const appeal = evaluateDemographicAppeal(proj, S);

    // Generate 6-point minute-by-minute dial test curve
    const minutes = ["0m (Opening)", "25m (Inciting)", "50m (Midpoint)", "75m (Dark Hour)", "100m (Climax)", "120m (Resolution)"];
    const dialData = minutes.map((m, idx) => {
      const noise = Math.floor(Math.random() * 14) - 7;
      let val = 65;
      if(idx === 0) val = 75; // Strong start
      if(idx === 2) val = 70; // Midpoint
      if(idx === 3) val = 60; // Sagging pace
      if(idx === 4) val = 85; // Big climax
      if(idx === 5) val = 80;
      return {
        timestamp: m,
        score: Math.min(100, Math.max(30, val + noise))
      };
    });

    // Compute Rotten Tomatoes Critics Consensus & Audience Popcornmeter
    const avgAppeal = Math.round((appeal.kids_family + appeal.teens + appeal.young_adults + appeal.mature_seniors) / 4);
    const criticsScore = Math.min(99, Math.max(35, Math.round(avgAppeal * 0.8 + (proj.quality || 65) * 0.2)));
    const audienceScore = Math.min(99, Math.max(40, Math.round(avgAppeal * 0.7 + (proj.buzz || 60) * 0.3)));

    const result = {
      projectId: proj.id,
      projectTitle: proj.title,
      week: S.week || 1,
      appeal,
      dialData,
      criticsScore,
      audienceScore,
      certifiedFresh: criticsScore >= 75,
      recommendation: criticsScore >= 75 ? "Lock final cut for wide theatrical release." : "Consider emergency script doctor polish or pick-up reshoots."
    };

    S.demographicEngine.lastScreeningResult = result;
    S.demographicEngine.trackedFilms[proj.id] = result;

    if(typeof log === "function"){
      log("[FOCUS GROUP DIAL SCREENING] Completed research on \"" + proj.title + "\". Critics Score: " + criticsScore + "% | Audience Score: " + audienceScore + "%. " + result.recommendation, "gold");
    }

    return { ok: true, result, msg: "Dial test screening complete!" };
  }

  // Script Doctor Emergency Rewrite
  function hireScriptDoctor(projectId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initDemographics(S);

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found." };

    if(proj.released){
      return { ok: false, msg: "Cannot rewrite an already released film." };
    }

    const cost = 1.5; // $1.5M script doctor fee
    const cash = S.studio ? S.studio.cash : S.cash;
    if(cash < cost){
      return { ok: false, msg: "Insufficient cash ($" + cost + "M required)." };
    }

    _modCash(S, -cost);

    proj.quality = Math.min(100, (proj.quality || 60) + 10);
    proj.scriptDoctorHired = true;

    if(typeof log === "function"){
      log("[SCRIPT DOCTOR POLISH] Top Hollywood script doctor punched up \"" + proj.title + "\" third act (-$" + cost + "M). Quality rating elevated to " + proj.quality + "/100.", "gold");
    }

    return { ok: true, msg: "Script doctor polish completed (+10 Quality)!" };
  }

  // UI Renderer Section
  function renderDemographicsSection(state){
    const S = _getG(state);
    if(!S) return "";
    initDemographics(S);

    const last = S.demographicEngine.lastScreeningResult;

    let h = "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>Four-Quadrant Demographics &amp; Audience Testing</b><span class='tag gold'>" + (last ? last.projectTitle : "Research Suite") + "</span></div>";
    h += "<div class='tiny muted' style='margin:4px 0 10px'>Measure audience resonance across 4 core demographic quadrants (Kids, Teens, Young Adults, Seniors) and review real-time focus group dial graphs (Silver Screen Story parity).</div>";

    if(!last){
      h += "<div style='background:rgba(255,255,255,0.03);padding:12px;border-radius:4px;text-align:center;margin-bottom:10px'>" +
        "<div class='tiny muted'>No recent dial test focus group conducted. Select an active project to run a $0.35M audience test.</div>" +
      "</div>";
    } else {
      h += "<div class='stat-hero' style='margin-bottom:10px'>" +
        "<div class='stat'><div class='s-v' style='color:" + (last.criticsScore >= 75 ? "var(--green)" : "var(--gold)") + "'>" + last.criticsScore + "%</div><div class='s-l'>Tomatometer (" + (last.certifiedFresh ? "Certified Fresh" : "Fresh") + ")</div></div>" +
        "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + last.audienceScore + "%</div><div class='s-l'>Audience Popcornmeter</div></div>" +
      "</div>";

      h += "<div class='section-title'>Audience Quadrant Affinity</div>";
      h += "<div class='grid g2' style='gap:8px;margin-bottom:10px'>";
      AUDIENCE_QUADRANTS.forEach(q => {
        const score = last.appeal[q.id] || 50;
        const col = score >= 70 ? "var(--green)" : score >= 45 ? "var(--gold)" : "var(--red)";
        h += "<div style='background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border-left:3px solid " + col + "'>" +
          "<div class='spread'><b>" + q.name + "</b><span style='font-size:12px;font-weight:bold;color:" + col + "'>" + score + "%</span></div>" +
          "<div style='background:rgba(255,255,255,0.1);height:4px;border-radius:2px;overflow:hidden;margin:4px 0'>" +
            "<div style='background:" + col + ";width:" + score + "%;height:100%'></div>" +
          "</div>" +
          "<div class='tiny muted'>" + q.desc + "</div>" +
        "</div>";
      });
      h += "</div>";

      h += "<div class='section-title'>Minute-by-Minute Focus Group Dial Curve</div>";
      h += "<div style='display:flex;gap:6px;margin-bottom:10px;background:rgba(0,0,0,0.25);padding:10px;border-radius:6px;overflow-x:auto'>";
      last.dialData.forEach(d => {
        h += "<div style='flex:1;min-width:60px;text-align:center'>" +
          "<div style='font-size:11px;font-weight:bold;color:var(--gold)'>" + d.score + "%</div>" +
          "<div style='height:40px;display:flex;align-items:flex-end;justify-content:center;margin:4px 0'>" +
            "<div style='background:var(--gold);width:16px;height:" + Math.round((d.score/100)*40) + "px;border-radius:2px'></div>" +
          "</div>" +
          "<div class='tiny muted' style='font-size:9px'>" + d.timestamp.split(" ")[0] + "</div>" +
        "</div>";
      });
      h += "</div>";
    }

    h += "<button class='btn btn-sm btn-primary' id='btnOpenDemographicsModal' style='width:100%'>Run Demographic Dial Screening</button>";
    h += "</div>";
    return h;
  }

  // Open Full Demographics & Script Doctor Modal
  function openDemographicsModal(state){
    const S = _getG(state);
    if(!S) return;
    initDemographics(S);

    const projs = (S.projects || []).filter(p => !p.released);

    function renderInner(){
      let h = "<h3>Audience Demographics &amp; Script Doctor Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Dial-test active projects with suburban focus groups, diagnose third-act pacing issues, and dispatch script doctors.</p>";

      if(!projs.length){
        h += "<div class='card' style='text-align:center;padding:16px'><div class='tiny muted'>No active unreleased projects in pre-production or editing. Greenlight a film first.</div></div>";
      } else {
        h += "<div class='section-title'>Active Slate Projects</div>";
        projs.forEach(p => {
          h += "<div class='card' style='margin-bottom:8px'>" +
            "<div class='spread'><b>" + p.title + "</b><span class='tag gold'>" + (p.genre || "Drama") + " · Quality " + (p.quality || 60) + "/100</span></div>" +
            "<div class='tiny muted' style='margin:4px 0 8px'>Phase: " + (p.phase || "development") + " | Budget: $" + (p.budget || 20) + "M</div>" +
            "<div style='display:flex;gap:6px;flex-wrap:wrap'>" +
              "<button class='btn btn-xs btn-primary btnRunDial' data-proj-id='" + p.id + "'>Run Dial Focus Test ($0.35M)</button>" +
              "<button class='btn btn-xs btn-alt btnHireDoctor' data-proj-id='" + p.id + "'>Script Doctor Rewrite ($1.5M, +10 Quality)</button>" +
            "</div>" +
          "</div>";
        });
      }

      h += renderDemographicsSection(S);
      return h;
    }

    function wireEvents(container){
      container.querySelectorAll(".btnRunDial").forEach(btn => {
        btn.onclick = () => {
          const res = runDialTestScreening(btn.dataset.projId, S);
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

      container.querySelectorAll(".btnHireDoctor").forEach(btn => {
        btn.onclick = () => {
          const res = hireScriptDoctor(btn.dataset.projId, S);
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

    const initialHtml = "<div id='demographicsModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#demographicsModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function bindEvents(container, state){
    const root = container || (typeof document !== "undefined" ? document : null);
    if(!root) return;
    const btnD = root.querySelector("#btnOpenDemographicsModal");
    if(btnD){
      btnD.onclick = () => {
        openDemographicsModal(state);
      };
    }
  }

  const DemographicsAPI = {
    AUDIENCE_QUADRANTS,
    initDemographics,
    evaluateDemographicAppeal,
    runDialTestScreening,
    hireScriptDoctor,
    renderDemographicsSection,
    openDemographicsModal,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = DemographicsAPI;
  }
  global.DemographicsEngine = DemographicsAPI;
  global.openDemographicsModal = openDemographicsModal;
})(typeof window !== "undefined" ? window : global);
