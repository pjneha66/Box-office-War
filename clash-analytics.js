/* ═════════════════════════════════════════════════════════════════════════
   CLASH-ANALYTICS.JS — Box Office Clash & Counter-Programming Analytics
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

  function analyzeReleaseCongestion(targetWeek, genre, scale, state){
    const S = _getG(state);
    if(!S) return null;

    const w = targetWeek || S.week;
    // Find all scheduled releases in the same window (w-1 to w+1)
    const rivalsScheduled = [];
    (S.rivals || []).forEach(r => {
      // Rival upcoming releases
      (r.scheduled || r.upcoming || []).forEach(rel => {
        if(Math.abs(rel.releaseWeek - w) <= 1){
          rivalsScheduled.push({
            studio: r.name,
            title: rel.title,
            genre: rel.genre,
            scale: rel.scale || "medium",
            week: rel.releaseWeek,
            starPower: rel.starPower || 3
          });
        }
      });
    });

    // Check in-theater holdovers
    const holdovers = (S.films || []).concat(
      (S.rivals || []).flatMap(r => r.films || [])
    ).filter(f => f.active && f.releaseWeek && Math.abs(f.releaseWeek - w) <= 3);

    // Direct genre competitors
    const directCompetitors = rivalsScheduled.filter(r => r.genre === genre);
    // Large blockbusters in window
    const tentpoleThreats = rivalsScheduled.filter(r => r.scale === "tentpole" || r.scale === "blockbuster");

    let cannibalizationRate = 0;
    if(directCompetitors.length > 0){
      cannibalizationRate += directCompetitors.length * 0.12; // 12% drop per direct competitor
    }
    if(tentpoleThreats.length > 0 && genre !== "romance" && genre !== "comedy" && genre !== "horror"){
      cannibalizationRate += tentpoleThreats.length * 0.08;
    }

    // Counter-programming check
    let counterProgrammingBonus = 0;
    const isTentpoleCongested = tentpoleThreats.length >= 2;
    const isCounterGenre = (genre === "romance" || genre === "comedy" || genre === "horror" || genre === "drama");

    if(isTentpoleCongested && isCounterGenre){
      counterProgrammingBonus = 0.16; // +16% boost as alternative viewing
    }

    const netImpact = Math.round((counterProgrammingBonus - cannibalizationRate) * 100);

    let severity = "LOW";
    if(cannibalizationRate > 0.25) severity = "CRITICAL";
    else if(cannibalizationRate > 0.12) severity = "MODERATE";

    return {
      targetWeek: w,
      genre: genre,
      scale: scale,
      directCompetitorsCount: directCompetitors.length,
      directCompetitors: directCompetitors,
      tentpoleThreatsCount: tentpoleThreats.length,
      tentpoleThreats: tentpoleThreats,
      cannibalizationRate: Math.round(cannibalizationRate * 100),
      counterProgrammingBonus: Math.round(counterProgrammingBonus * 100),
      netImpactPercent: netImpact,
      severity: severity
    };
  }

  function openClashAnalyticsModal(filmId){
    const S = _getG();
    if(!S) return;

    let targetFilm = null;
    if(filmId){
      targetFilm = (S.projects || []).find(p => p.id === filmId) || (S.films || []).find(f => f.id === filmId);
    }
    if(!targetFilm){
      targetFilm = (S.projects || []).find(p => p.phase === "ready") || (S.projects || [])[0];
    }

    if(!targetFilm){
      if(typeof toast === "function") toast("No active film project available to evaluate release clash.", "bad");
      return;
    }

    const targetWeek = targetFilm.releaseWeek || (S.week + 3);
    const analysis = analyzeReleaseCongestion(targetWeek, targetFilm.genre, targetFilm.scale, S);

    let h = "<h3>Box Office Clash &amp; Counter-Programming Desk</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Real-time competitive theatrical window analysis. Identify direct demographic cannibalization against rival releases or seize counter-programming windfalls.</div>";

    h += "<div class='card' style='margin-bottom:12px'>"+
      "<div class='spread'><b>Target Title: \"" + esc(targetFilm.title) + "\"</b><span class='tag gold'>" + (targetFilm.genre || "action").toUpperCase() + " · " + (targetFilm.scale || "medium").toUpperCase() + "</span></div>"+
      "<div class='tiny muted'>Scheduled Theatrical Window: Week " + targetWeek + "</div>"+
    "</div>";

    const sevColor = analysis.severity === "CRITICAL" ? "var(--red)" : analysis.severity === "MODERATE" ? "var(--gold)" : "var(--green)";
    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v' style='color:" + sevColor + "'>" + analysis.severity + "</div><div class='s-l'>Clash Severity</div></div>"+
      "<div class='stat'><div class='s-v'>" + analysis.directCompetitorsCount + "</div><div class='s-l'>Same-Genre Competitors</div></div>"+
      "<div class='stat'><div class='s-v' style='color:" + (analysis.netImpactPercent >= 0 ? "var(--green)" : "var(--red)") + "'>" + (analysis.netImpactPercent >= 0 ? "+" : "") + analysis.netImpactPercent + "%</div><div class='s-l'>Net Opening Impact</div></div>"+
      "<div class='stat'><div class='s-v'>" + (analysis.counterProgrammingBonus > 0 ? "+" + analysis.counterProgrammingBonus + "%" : "0%") + "</div><div class='s-l'>Counter-Prog Bonus</div></div>"+
    "</div>";

    if(analysis.directCompetitors.length){
      h += "<div class='section-title'>Direct Same-Genre Rival Threats</div><div class='card' style='margin-bottom:12px'>";
      analysis.directCompetitors.forEach(dc => {
        h += "<div class='spread' style='padding:4px 0'>"+
          "<div><b>\"" + esc(dc.title) + "\"</b> (" + esc(dc.studio) + ")</div>"+
          "<div><span class='tag red'>-" + (dc.scale === "tentpole" ? "18%" : "12%") + " Cannibalization</span></div>"+
        "</div>";
      });
      h += "</div>";
    }

    if(analysis.counterProgrammingBonus > 0){
      h += "<div class='card' style='border-left:3px solid var(--green);margin-bottom:12px'>"+
        "<b>Counter-Programming Windfall Active:</b> Releasing a " + targetFilm.genre + " title on a heavy action tentpole weekend captures underserved demographics (+ " + analysis.counterProgrammingBonus + "% opening audience share)."+
      "</div>";
    }

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    openModal(h);
  }

  const ClashAnalyticsModule = {
    analyzeReleaseCongestion,
    openClashAnalyticsModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = ClashAnalyticsModule;
  }
  global.ClashAnalyticsModule = ClashAnalyticsModule;
  global.analyzeReleaseCongestion = analyzeReleaseCongestion;
  global.openClashAnalyticsModal = openClashAnalyticsModal;
  /* The dashboards and the marquee banner call this by its short name; without
     the alias those buttons were silently dead. One function, both names. */
  global.clashAnalyticsModal = openClashAnalyticsModal;
})(typeof window !== "undefined" ? window : global);
