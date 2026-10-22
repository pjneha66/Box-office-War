/* ═════════════════════════════════════════════════════════════════════════
   BOARD-TARGETS.JS — Board of Directors Quarterly Directives & Confidence
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Sim 2 (Board Objectives & Studio Stats)
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

  function initBoardTargets(state){
    const S = _getG(state);
    if(!S) return null;
    if(!S.boardTargets || typeof S.boardTargets !== "object" || Array.isArray(S.boardTargets)){
      S.boardTargets = {
        confidence: 75, // 0 to 100
        currentQuarter: 1,
        quarterStartWeek: 1,
        activeDirectives: [],
        completedDirectives: [],
        quarterlyHistory: [],
        austerityMode: false
      };
      generateQuarterlyDirectives(S);
    }
    return S.boardTargets;
  }

  function generateQuarterlyDirectives(state){
    const S = _getG(state);
    if(!S) return [];
    if(!S.boardTargets || !S.boardTargets.activeDirectives) initBoardTargets(S);

    const q = Math.floor(((S.week || 1) - 1) / 13) + 1;
    S.boardTargets.currentQuarter = q;
    S.boardTargets.quarterStartWeek = (q - 1) * 13 + 1;

    const cashPool = _getCashM(S) || 50;
    const boTarget = Math.max(40, Math.round(cashPool * 1.5));
    const minQuality = 75;

    const directives = [
      {
        id: "bo_target_q" + q,
        title: "Theatrical Revenue Milestone",
        desc: "Generate at least $" + boTarget + "M in theatrical revenue this quarter.",
        type: "theatrical_revenue",
        targetVal: boTarget, // in $M
        currentVal: 0,
        completed: false,
        rewardCash: 5.0, // in $M
        confidenceBuff: 12
      },
      {
        id: "quality_target_q" + q,
        title: "Critical Acclaim Quota",
        desc: "Release at least 1 production with a final Quality score >= " + minQuality + ".",
        type: "release_quality",
        targetVal: minQuality,
        currentVal: 0,
        completed: false,
        rewardCash: 4.0, // in $M
        confidenceBuff: 10
      },
      {
        id: "reserves_target_q" + q,
        title: "Solvency & Reserve Maintenance",
        desc: "Maintain cash balance above $" + Math.round(cashPool * 0.5) + "M at quarter close.",
        type: "cash_reserves",
        targetVal: Math.round(cashPool * 0.5), // in $M
        currentVal: 0,
        completed: false,
        rewardCash: 3.0, // in $M
        confidenceBuff: 8
      }
    ];

    S.boardTargets.activeDirectives = directives;
    return directives;
  }

  function trackFilmRelease(film, state){
    const S = _getG(state);
    if(!S || !S.boardTargets || !S.boardTargets.activeDirectives) return;

    S.boardTargets.activeDirectives.forEach(d => {
      if(d.type === "release_quality" && !d.completed){
        if(film.quality >= d.targetVal){
          d.currentVal = film.quality;
          d.completed = true;
          if(typeof log === "function"){
            log("Board Directive Satisfied: Critical Acclaim Quota met by '" + film.title + "' (Score: " + film.quality + ")!", "gold");
          }
        }
      }
    });
  }

  function trackBoxOfficeRevenue(amountM, state){
    const S = _getG(state);
    if(!S || !S.boardTargets || !S.boardTargets.activeDirectives) return;

    S.boardTargets.activeDirectives.forEach(d => {
      if(d.type === "theatrical_revenue" && !d.completed){
        d.currentVal = (d.currentVal || 0) + amountM;
        if(d.currentVal >= d.targetVal){
          d.completed = true;
          if(typeof log === "function"){
            log("Board Directive Satisfied: Theatrical Revenue Milestone reached!", "gold");
          }
        }
      }
    });
  }

  function evaluateQuarterClose(state){
    const S = _getG(state);
    if(!S) return null;
    initBoardTargets(S);

    const b = S.boardTargets;
    if(!b || !b.activeDirectives) return null;

    const currentCash = _getCashM(S);
    b.activeDirectives.forEach(d => {
      if(d.type === "cash_reserves"){
        d.currentVal = currentCash;
        if(d.currentVal >= d.targetVal){
          d.completed = true;
        }
      }
    });

    const completedCount = b.activeDirectives.filter(d => d.completed).length;
    const totalCount = b.activeDirectives.length;
    let confidenceDelta = 0;
    let bonusCash = 0;

    if(completedCount === totalCount){
      confidenceDelta = 15;
      bonusCash = 10.0;
      b.confidence = Math.min(100, b.confidence + confidenceDelta);
      _modCashM(S, bonusCash);
      if(typeof log === "function"){
        log("Quarterly Board Review: OUTSTANDING! 100% directives achieved. Confidence +15% (Now " + b.confidence + "%). Bonus: +$" + bonusCash + "M.", "gold");
      }
    } else if(completedCount > 0){
      confidenceDelta = 5;
      bonusCash = 3.0;
      b.confidence = Math.min(100, b.confidence + confidenceDelta);
      _modCashM(S, bonusCash);
      if(typeof log === "function"){
        log("Quarterly Board Review: ACCEPTABLE. " + completedCount + "/" + totalCount + " directives achieved. Confidence +5% (Now " + b.confidence + "%).", "gold");
      }
    } else {
      confidenceDelta = -18;
      b.confidence = Math.max(0, b.confidence + confidenceDelta);
      if(typeof log === "function"){
        log("Quarterly Board Review: POOR PERFORMANCE. 0 directives met. Board confidence dropped by 18% (Now " + b.confidence + "%).", "bad");
      }
    }

    b.austerityMode = (b.confidence < 30);
    if(b.austerityMode && typeof log === "function"){
      log("WARNING: Board of Directors entered AUSTERITY MODE due to low confidence (" + b.confidence + "%).", "bad");
    }

    b.quarterlyHistory.push({
      quarter: b.currentQuarter,
      week: S.week,
      completedCount,
      totalCount,
      confidence: b.confidence,
      bonusCash
    });

    generateQuarterlyDirectives(S);

    return {
      completedCount,
      totalCount,
      confidence: b.confidence,
      bonusCash,
      austerityMode: b.austerityMode
    };
  }

  function advanceBoardWeek(state){
    const S = _getG(state);
    if(!S) return;
    initBoardTargets(S);

    const week = S.week || 1;
    if(week % 13 === 0){
      return evaluateQuarterClose(S);
    }
    return null;
  }

  function openBoardTargetsModal(){
    const S = _getG();
    if(!S) return;
    initBoardTargets(S);

    const h = "<section class='command-dialog strategy-review'><header class='command-dialog-hero'><div><span class='command-eyebrow'>STUDIO HQ / GOVERNANCE</span><h2>The Strategy Room</h2><p>Your quarterly commitments, confidence, and review history.</p></div></header>" + commandStrategyContent(S,true) + "</section>";
    const view = openModal(h);
    view.querySelector('.modal').classList.add('command-modal');
  }

  const BoardTargetsAPI = {
    initBoardTargets,
    generateQuarterlyDirectives,
    trackFilmRelease,
    trackBoxOfficeRevenue,
    evaluateQuarterClose,
    advanceBoardWeek,
    openBoardTargetsModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = BoardTargetsAPI;
  }
  global.BoardTargets = BoardTargetsAPI;
  global.openBoardTargetsModal = openBoardTargetsModal;
})(typeof window !== "undefined" ? window : global);
