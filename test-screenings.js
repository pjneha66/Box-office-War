/* ═════════════════════════════════════════════════════════════════════════
   TEST-SCREENINGS.JS — Post-Production Test Screenings & Emergency Reshoots
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc (Test Screening Controller)
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

  const SCREENING_TIERS = {
    focus_group: {
      id: "focus_group",
      name: "Small Focus Group Screening",
      cost: 0.15, // $0.15M ($150k)
      accuracyMargin: 8,
      desc: "100 curated cinephiles and genre fans in an intimate screening room."
    },
    demographic_wide: {
      id: "demographic_wide",
      name: "Broad Demographic Preview",
      cost: 0.45, // $0.45M ($450k)
      accuracyMargin: 4,
      desc: "500 diverse theatergoers across multiple suburban and urban test markets."
    },
    guild_secret: {
      id: "guild_secret",
      name: "Industry & Guild Blind Preview",
      cost: 0.95, // $0.95M ($950k)
      accuracyMargin: 1,
      desc: "Full auditorium of industry professionals under strict NDAs for maximum diagnostic fidelity."
    }
  };

  function conductTestScreening(filmId, tierId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };

    const tier = SCREENING_TIERS[tierId];
    if(!tier) return { ok: false, msg: "Invalid screening tier: " + tierId };

    const film = (S.films || []).find(f => f.id === filmId || f.title === filmId);
    if(!film) return { ok: false, msg: "Film not found" };

    if(film.status !== "post_production" && film.status !== "in_production" && film.status !== "ready" && film.status !== "scheduled"){
      return { ok: false, msg: "Test screenings can only be held for unreleased films in production or post-production." };
    }

    const cash = _getCashM(S);
    if(cash < tier.cost){
      return { ok: false, msg: "Insufficient cash. Required: $" + tier.cost + "M" };
    }

    _modCashM(S, -tier.cost);

    const trueQuality = film.quality || 70;
    const errorOffset = (Math.random() * 2 - 1) * tier.accuracyMargin;
    const projectedScore = Math.max(10, Math.min(100, Math.round(trueQuality + errorOffset)));

    let feedback = "";
    let reshootOpportunity = false;
    if(projectedScore >= 85){
      feedback = "Audience response was rapturous. Emotional beats resonated deeply; applause during climax.";
    } else if(projectedScore >= 70){
      feedback = "Positive reception overall, though some viewers noted minor pacing drag in Act 2.";
      reshootOpportunity = true;
    } else if(projectedScore >= 50){
      feedback = "Mixed reactions. The third act twist fell flat and chemistry between leads was questioned.";
      reshootOpportunity = true;
    } else {
      feedback = "Critical warning: audience walkouts recorded. Script logic flaws and weak visual effects criticized.";
      reshootOpportunity = true;
    }

    film.testScreeningResult = {
      tierId: tier.id,
      tierName: tier.name,
      projectedScore,
      feedback,
      reshootOpportunity,
      reshootExecuted: false,
      weekConducted: S.week || 1
    };

    if(typeof log === "function"){
      log("Test Screening conducted for '" + film.title + "' (" + tier.name + "). Projected: " + projectedScore + "/100.", "gold");
    }

    return {
      ok: true,
      result: film.testScreeningResult,
      msg: "Test screening completed."
    };
  }

  function executeEmergencyReshoots(filmId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };

    const film = (S.films || []).find(f => f.id === filmId || f.title === filmId);
    if(!film) return { ok: false, msg: "Film not found" };

    if(!film.testScreeningResult){
      return { ok: false, msg: "You must conduct a test screening before greenlighting emergency reshoots." };
    }

    if(film.testScreeningResult.reshootExecuted){
      return { ok: false, msg: "Emergency reshoots have already been executed for this film." };
    }

    const baseBudget = film.budget || 20; // in $M
    const reshootCost = Math.max(1.5, Math.min(12.0, Math.round(baseBudget * 0.15 * 10) / 10));

    const cash = _getCashM(S);
    if(cash < reshootCost){
      return { ok: false, msg: "Insufficient cash for reshoots. Cost: $" + reshootCost + "M" };
    }

    _modCashM(S, -reshootCost);
    film.budget = Math.round(((film.budget || baseBudget) + reshootCost) * 10) / 10;

    const qualityBuff = Math.floor(Math.random() * 7) + 6;
    film.quality = Math.min(100, (film.quality || 70) + qualityBuff);
    film.testScreeningResult.reshootExecuted = true;
    film.testScreeningResult.qualityBuff = qualityBuff;

    if(typeof log === "function"){
      log("EMERGENCY RESHOOTS COMPLETED for '" + film.title + "' (-$" + reshootCost + "M). Quality +" + qualityBuff + " to " + film.quality + ".", "good");
    }

    return {
      ok: true,
      qualityBuff,
      newQuality: film.quality,
      reshootCost,
      msg: "Reshoots wrapped successfully. Film quality significantly repaired!"
    };
  }

  function openTestScreeningModal(filmId){
    const S = _getG();
    if(!S) return;

    const unreleasedFilms = (S.films || []).filter(f => !f.inTheaters && (f.gross === 0 || f.gross === undefined));
    const film = unreleasedFilms.find(f => f.id === filmId || f.title === filmId) || unreleasedFilms[0];

    let h = "<h3>Post-Production Test Screenings &amp; Reshoots</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Screen early cuts before focus groups to forecast critic &amp; audience reaction. If reception is flawed, execute emergency reshoots to fix pacing and boost quality.</div>";

    if(!film){
      h += "<div class='card tiny muted'>No unreleased productions currently available for test screening. Greenlight a project first.</div>";
      if(typeof openModal === "function") openModal(h);
      return;
    }

    h += "<div class='card' style='margin-bottom:12px'>"+
      "<div class='spread'><b>" + film.title + "</b><span class='tag'>" + (film.genre || "Drama").toUpperCase() + "</span></div>"+
      "<div class='tiny muted' style='margin-top:4px'>Budget: $" + (film.budget || 20) + "M | Status: " + (film.status || "In Production") + "</div>"+
    "</div>";

    if(film.testScreeningResult){
      const res = film.testScreeningResult;
      const scoreColor = res.projectedScore >= 75 ? "var(--good)" : res.projectedScore >= 50 ? "var(--gold)" : "var(--bad)";
      h += "<div class='card' style='margin-bottom:14px;border-left:4px solid " + scoreColor + "'>"+
        "<div class='spread'><b>Screening Diagnosis (" + res.tierName + ")</b><span class='tag' style='color:" + scoreColor + "'>Score: " + res.projectedScore + "/100</span></div>"+
        "<div class='tiny' style='margin:6px 0;font-style:italic'>\"" + res.feedback + "\"</div>"+
        (res.reshootExecuted ? (
          "<div class='tiny' style='color:var(--good);font-weight:bold'>Emergency Reshoots Executed: Quality buffed by +" + res.qualityBuff + " pts!</div>"
        ) : res.reshootOpportunity ? (
          "<div style='margin-top:10px'>"+
            "<button class='btn btn-sm btn-primary' id='btnExecReshoot' data-filmid='" + film.id + "'>Greenlight Emergency Reshoots (15% Budget)</button>"+
          "</div>"
        ) : (
          "<div class='tiny' style='color:var(--good)'>No reshoots necessary. Audience feedback indicates hit potential!</div>"
        ))+
      "</div>";
    }

    h += "<div class='section-title'>Conduct Test Screening</div><div class='grid g1' style='gap:8px'>";
    for(const key in SCREENING_TIERS){
      const tier = SCREENING_TIERS[key];
      h += "<div class='card spread'>"+
        "<div>"+
          "<b>" + tier.name + "</b>"+
          "<div class='tiny muted' style='margin:4px 0'>" + tier.desc + "</div>"+
          "<div class='tiny' style='color:var(--gold)'>Accuracy Margin: &plusmn;" + tier.accuracyMargin + " pts</div>"+
        "</div>"+
        "<div>"+
          "<button class='btn btn-sm btn-primary' data-screening='" + tier.id + "' data-filmid='" + film.id + "'>Screen ($" + (tier.cost * 1000).toFixed(0) + "k)</button>"+
        "</div>"+
      "</div>";
    }
    h += "</div>";

    if(typeof openModal === "function"){
      const v = openModal(h);
      if(v){
        v.querySelectorAll("[data-screening]").forEach(btn => {
          btn.onclick = () => {
            const res = conductTestScreening(btn.dataset.filmid, btn.dataset.screening, S);
            if(res.ok){
              if(typeof toast === "function") toast("Test screening concluded!", "good");
              openTestScreeningModal(btn.dataset.filmid);
              if(typeof render === "function") render();
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          };
        });
        const reshootBtn = v.querySelector("#btnExecReshoot");
        if(reshootBtn){
          reshootBtn.onclick = () => {
            const res = executeEmergencyReshoots(reshootBtn.dataset.filmid, S);
            if(res.ok){
              if(typeof toast === "function") toast(res.msg, "good");
              openTestScreeningModal(reshootBtn.dataset.filmid);
              if(typeof render === "function") render();
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          };
        }
      }
    }
  }

  const TestScreeningsAPI = {
    SCREENING_TIERS,
    conductTestScreening,
    executeEmergencyReshoots,
    openTestScreeningModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = TestScreeningsAPI;
  }
  global.TestScreenings = TestScreeningsAPI;
  global.openTestScreeningModal = openTestScreeningModal;
})(typeof window !== "undefined" ? window : global);
