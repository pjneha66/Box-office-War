/* ═════════════════════════════════════════════════════════════════════════
   BOND-MARKET.JS — Studio Corporate Bond & Credit Securitization Market
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

  const CREDIT_TIERS = {
    AAA: { grade: "AAA", coupon: 0.045, name: "Prime Investment Grade", minEquity: 150, minRep: 70 },
    AA:  { grade: "AA",  coupon: 0.060, name: "High Grade Investment", minEquity: 80,  minRep: 55 },
    BBB: { grade: "BBB", coupon: 0.085, name: "Medium Grade Corporate", minEquity: 20,  minRep: 40 },
    BB:  { grade: "BB",  coupon: 0.125, name: "Speculative High-Yield", minEquity: -10, minRep: 25 },
    CCC: { grade: "CCC", coupon: 0.180, name: "Substantial Risk / Distressed", minEquity: -100, minRep: 10 }
  };

  function initBondMarket(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.bonds){
      S.bonds = {
        activeBonds: [],
        maturedCount: 0,
        totalInterestServiced: 0
      };
    }
    return S.bonds;
  }

  function getStudioCreditRating(state){
    const S = _getG(state);
    if(!S) return CREDIT_TIERS.BBB;

    const cash = S.studio.cash || 0;
    const debt = (S.studio.debt || 0) + (S.studio.mezzDebt || 0);
    const netEquity = cash - debt;
    const rep = S.studio.rep || 25;

    if(netEquity >= CREDIT_TIERS.AAA.minEquity && rep >= CREDIT_TIERS.AAA.minRep) return CREDIT_TIERS.AAA;
    if(netEquity >= CREDIT_TIERS.AA.minEquity && rep >= CREDIT_TIERS.AA.minRep) return CREDIT_TIERS.AA;
    if(netEquity >= CREDIT_TIERS.BBB.minEquity && rep >= CREDIT_TIERS.BBB.minRep) return CREDIT_TIERS.BBB;
    if(netEquity >= CREDIT_TIERS.BB.minEquity && rep >= CREDIT_TIERS.BB.minRep) return CREDIT_TIERS.BB;
    return CREDIT_TIERS.CCC;
  }

  function issueCorporateBond(principalM, durationWeeks, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initBondMarket(S);

    const principal = Math.round(principalM);
    if(principal < 10 || principal > 200){
      return { ok: false, error: "Bond principal must be between $10M and $200M." };
    }

    if((S.bonds.activeBonds || []).length >= 4){
      return { ok: false, error: "Maximum of 4 concurrent bond series permitted in market circulation." };
    }

    const rating = getStudioCreditRating(S);
    const weeks = durationWeeks === 104 ? 104 : 52;
    const weeklyCoupon = Math.round(((principal * rating.coupon) / 52) * 100) / 100;

    const bond = {
      id: "bond_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      seriesName: S.studio.name + " Series " + (S.bonds.activeBonds.length + 1) + " Notes",
      principal: principal,
      couponAnnualRate: rating.coupon,
      creditGrade: rating.grade,
      weeklyCoupon: weeklyCoupon,
      durationWeeks: weeks,
      weeksRemaining: weeks,
      issuedWeek: S.week,
      interestPaid: 0
    };

    S.studio.cash = Math.round((S.studio.cash + principal) * 10) / 10;
    S.bonds.activeBonds.push(bond);

    if(typeof log === "function"){
      log("Issued $" + principal + "M in corporate bonds (" + rating.grade + " grade @ " + Math.round(rating.coupon * 1000) / 10 + "%). Coupon: $" + weeklyCoupon + "M/wk.", "gold");
    }

    return { ok: true, bond };
  }

  function buybackBond(bondId, state){
    const S = _getG(state);
    if(!S) return { ok: false, error: "No active state" };
    initBondMarket(S);

    const bond = S.bonds.activeBonds.find(b => b.id === bondId);
    if(!bond) return { ok: false, error: "Bond series not found." };

    // Early redemption penalty: 102% of principal
    const cost = Math.round(bond.principal * 1.02 * 10) / 10;
    if((S.studio.cash || 0) < cost){
      return { ok: false, error: "Insufficient funds to redeem bond early ($" + cost + "M needed)." };
    }

    S.studio.cash = Math.round((S.studio.cash - cost) * 10) / 10;
    S.bonds.activeBonds = S.bonds.activeBonds.filter(b => b.id !== bondId);
    S.bonds.maturedCount = (S.bonds.maturedCount || 0) + 1;

    if(typeof log === "function"){
      log("Retired and redeemed " + bond.seriesName + " early for $" + cost + "M.", "gold");
    }

    return { ok: true, redeemedPrincipal: bond.principal };
  }

  function tickBondsWeekly(state){
    const S = _getG(state);
    if(!S) return { interestServiced: 0, maturedM: 0 };
    initBondMarket(S);

    let totalCoupon = 0;
    let maturedPrincipal = 0;
    const remainingBonds = [];

    (S.bonds.activeBonds || []).forEach(bond => {
      bond.weeksRemaining -= 1;
      const coupon = bond.weeklyCoupon || 0;
      totalCoupon += coupon;
      bond.interestPaid = Math.round(((bond.interestPaid || 0) + coupon) * 100) / 100;

      if(bond.weeksRemaining <= 0){
        // Principal repayment at maturity
        maturedPrincipal += bond.principal;
        S.bonds.maturedCount = (S.bonds.maturedCount || 0) + 1;
        if(typeof log === "function"){
          log(bond.seriesName + " matured. Principal repayment of $" + bond.principal + "M settled.", "gold");
        }
      } else {
        remainingBonds.push(bond);
      }
    });

    totalCoupon = Math.round(totalCoupon * 100) / 100;
    S.bonds.activeBonds = remainingBonds;
    S.studio.cash = Math.round((S.studio.cash - (totalCoupon + maturedPrincipal)) * 10) / 10;
    S.bonds.totalInterestServiced = Math.round(((S.bonds.totalInterestServiced || 0) + totalCoupon) * 10) / 10;

    return { interestServiced: totalCoupon, maturedM: maturedPrincipal };
  }

  function openBondMarketModal(){
    const S = _getG();
    if(!S) return;
    initBondMarket(S);

    let h = "<h3>Corporate Bond &amp; Credit Securitization Desk</h3>";
    h += "<div class='tiny muted' style='margin-bottom:12px'>Raise large-scale capital via fixed-coupon corporate bond notes. Higher equity and studio reputation secure Investment Grade (AAA/AA) ratings with low financing costs.</div>";

    const rating = getStudioCreditRating(S);
    let activePrincipalTotal = 0;
    let activeWeeklyCoupons = 0;
    S.bonds.activeBonds.forEach(b => {
      activePrincipalTotal += b.principal;
      activeWeeklyCoupons += b.weeklyCoupon;
    });
    activeWeeklyCoupons = Math.round(activeWeeklyCoupons * 100) / 100;

    h += "<div class='stat-hero' style='margin-bottom:12px'>"+
      "<div class='stat'><div class='s-v' style='color:var(--gold)'>" + rating.grade + "</div><div class='s-l'>" + rating.name + "</div></div>"+
      "<div class='stat'><div class='s-v'>$" + activePrincipalTotal + "M</div><div class='s-l'>Active Bond Notes</div></div>"+
      "<div class='stat'><div class='s-v' style='color:var(--red)'>-$" + activeWeeklyCoupons + "M/wk</div><div class='s-l'>Weekly Coupon Servicing</div></div>"+
      "<div class='stat'><div class='s-v'>" + (Math.round(rating.coupon * 1000) / 10) + "%</div><div class='s-l'>Annual Benchmark Yield</div></div>"+
    "</div>";

    if(S.bonds.activeBonds.length){
      h += "<div class='section-title'>Active Circulating Bond Issues</div><div class='card' style='margin-bottom:12px'>";
      S.bonds.activeBonds.forEach(b => {
        h += "<div class='spread' style='padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)'>"+
          "<div><b>" + esc(b.seriesName) + "</b> <span class='tag " + (b.creditGrade === "AAA" || b.creditGrade === "AA" ? "gold" : "") + "'>" + b.creditGrade + " Grade</span>"+
            "<div class='tiny muted'>" + b.weeksRemaining + "/" + b.durationWeeks + " weeks to maturity | Coupon: $" + b.weeklyCoupon + "M/wk</div></div>"+
          "<div class='row' style='gap:8px'>"+
            "<div style='text-align:right'><b>$" + b.principal + "M</b><div class='tiny muted'>Paid: $" + b.interestPaid + "M</div></div>"+
            "<button class='btn btn-xs btn-alt' data-redeembond='" + b.id + "'>Redeem ($" + Math.round(b.principal * 1.02) + "M)</button>"+
          "</div>"+
        "</div>";
      });
      h += "</div>";
    }

    h += "<div class='section-title'>Issue New Corporate Bond Tranche</div><div class='card'>";
    h += "<div class='spread' style='margin-bottom:8px'><b>Select Principal Amount:</b>"+
      "<div class='row' style='gap:4px'>"+
        "<button class='btn btn-sm btn-alt' data-bondissue='25:52'>$25M (1y)</button>"+
        "<button class='btn btn-sm btn-alt' data-bondissue='50:52'>$50M (1y)</button>"+
        "<button class='btn btn-sm btn-primary' data-bondissue='100:104'>$100M (2y)</button>"+
        "<button class='btn btn-sm btn-alt' data-bondissue='150:104'>$150M (2y)</button>"+
      "</div>"+
    "</div>"+
    "<div class='tiny muted'>Bonds provide non-dilutive liquidity. Coupons are deducted automatically every week. Principal settles automatically at maturity.</div>"+
    "</div>";

    h += "<div class='modal-actions' style='margin-top:14px'>"+
      "<button class='btn btn-primary' onclick='closeModal()'>Close</button>"+
    "</div>";

    const v = openModal(h);
    v.querySelectorAll("[data-bondissue]").forEach(b => {
      b.onclick = () => {
        const parts = b.dataset.bondissue.split(":");
        const res = issueCorporateBond(+parts[0], +parts[1]);
        if(res.ok){
          if(typeof beep === "function") beep("gold");
          closeModal();
          openBondMarketModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    });
    v.querySelectorAll("[data-redeembond]").forEach(b => {
      b.onclick = () => {
        const res = buybackBond(b.dataset.redeembond);
        if(res.ok){
          if(typeof beep === "function") beep("click");
          closeModal();
          openBondMarketModal();
          if(typeof render === "function") render();
        } else {
          if(typeof toast === "function") toast(res.error, "bad");
        }
      };
    });
  }

  const BondMarketModule = {
    CREDIT_TIERS,
    initBondMarket,
    getStudioCreditRating,
    issueCorporateBond,
    buybackBond,
    tickBondsWeekly,
    openBondMarketModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = BondMarketModule;
  }
  global.BondMarketModule = BondMarketModule;
  global.initBondMarket = initBondMarket;
  global.getStudioCreditRating = getStudioCreditRating;
  global.issueCorporateBond = issueCorporateBond;
  global.buybackBond = buybackBond;
  global.tickBondsWeekly = tickBondsWeekly;
  global.openBondMarketModal = openBondMarketModal;
})(typeof window !== "undefined" ? window : global);
