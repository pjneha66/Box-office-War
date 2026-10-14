/* ═════════════════════════════════════════════════════════════════════════
   STUDIO-OPERATIONS-SUITE.JS — Product Placement, Physical Media, Backlots & C-Suite
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Inc (Movie Sim Mechanics)
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

  // 1. In-Film Commercial Product Placement Deals
  const SPONSOR_TIERS = [
    {
      id: "automotive",
      name: "Luxury Automotive Hero Chase",
      category: "Vehicles",
      cashAdvance: 12.0, // +$12M cash
      criticPenaltyRisk: 0.15,
      desc: "Prominent high-speed chase sequence featuring flagship luxury electric sportscar."
    },
    {
      id: "smartphone",
      name: "Flagship Tech & Smartphone Placement",
      category: "Consumer Tech",
      cashAdvance: 8.0,
      criticPenaltyRisk: 0.10,
      desc: "Lead characters prominently use branded flagship smartphones and neural glasses."
    },
    {
      id: "beverage",
      name: "Energy Drink & Beverage Integration",
      category: "Beverage",
      cashAdvance: 5.0,
      criticPenaltyRisk: 0.05,
      desc: "Close-up hero drink placement in major action and hangout sequences."
    },
    {
      id: "luxury_watch",
      name: "Swiss Haute-Horlogerie Wristwear",
      category: "Luxury Fashion",
      cashAdvance: 6.0,
      criticPenaltyRisk: 0.05,
      desc: "Cinematic wrist macro-shots of diamond-bezel chronograph in tense countdowns."
    }
  ];

  // 2. Physical 4K UHD & Collector Box Set Manufacturing
  const PHYSICAL_FORMATS = {
    steelbook_4k: {
      id: "steelbook_4k",
      name: "Limited Edition 4K UHD Steelbook",
      unitCost: 4.0, // $4 to press and package
      retailPrice: 34.99,
      unitBatchSize: 0.5, // 500k units ($2.0M pressing cost)
      profitMarginPerUnit: 18.0
    },
    collector_box: {
      id: "collector_box",
      name: "Definitive Director's Cut Collector Box",
      unitCost: 8.0,
      retailPrice: 59.99,
      unitBatchSize: 0.25,
      profitMarginPerUnit: 32.0
    }
  };

  // 3. Physical Soundstages & Lot Expansion
  const SOUNDSTAGE_LOTS = [
    {
      id: "stage_alpha",
      name: "Mega Soundstage Alpha (50,000 sq ft)",
      cost: 25.0,
      budgetDiscountPct: 0.12, // 12% off in-house production budgets
      desc: "Soundproof massive stage with high-load gantry cranes and sound baffled ceilings."
    },
    {
      id: "horizon_tank",
      name: "Exterior Deep-Horizon Water Tank",
      cost: 18.0,
      budgetDiscountPct: 0.08,
      desc: "Submerged marine tank with wave generators and blue-screen infinity horizon."
    },
    {
      id: "led_volume",
      name: "Virtual Production LED Volume Wall",
      cost: 35.0,
      budgetDiscountPct: 0.15,
      desc: "Real-time Unreal Engine parallax LED stage eliminating green screen rotoscoping."
    },
    {
      id: "cgi_render_farm",
      name: "High-Density GPU CGI Render Farm",
      cost: 20.0,
      budgetDiscountPct: 0.05,
      desc: "In-house supercomputing cluster reducing post-production VFX schedules by 2 weeks."
    }
  ];

  // 4. Executive C-Suite Board Hires
  const CSUITE_OFFICERS = [
    {
      id: "cfo",
      title: "Chief Financial Officer (CFO)",
      name: "Evelyn Sterling",
      signingFee: 4.0,
      weeklySalary: 0.08,
      perk: "Reduces loan interest by 30% and boosts debt credit limit by +$50M.",
      code: "debt_shield"
    },
    {
      id: "cmo",
      title: "Chief Marketing Officer (CMO)",
      name: "Marcus Vance",
      signingFee: 5.0,
      weeklySalary: 0.10,
      perk: "+20% trailer buzz generation and unlocks viral social media blitzes.",
      code: "buzz_boost"
    },
    {
      id: "head_casting",
      title: "Head of Global Casting",
      name: "Helena Rostova",
      signingFee: 3.5,
      weeklySalary: 0.07,
      perk: "15% discount on A-list talent signing fees and doubles audition trait reveals.",
      code: "talent_discount"
    },
    {
      id: "coo",
      title: "Chief Operating Officer (COO)",
      name: "David H. Caine",
      signingFee: 4.5,
      weeklySalary: 0.09,
      perk: "Eliminates on-set production friction and prevents budget overruns.",
      code: "budget_shield"
    }
  ];

  function initStudioOperations(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.studioOps){
      S.studioOps = {
        totalSponsorCash: 0,
        activeProductPlacements: [],
        physicalDiscProfits: 0,
        ownedSoundstages: [],
        hiredCSuite: {}
      };
    }
    return S.studioOps;
  }

  // Sell product placement on a project
  function sellProductPlacement(projectId, sponsorId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initStudioOperations(S);

    const sp = SPONSOR_TIERS.find(s => s.id === sponsorId || (sponsorId === "auto_maker" && s.id === "automotive") || (sponsorId === "auto" && s.id === "automotive"));
    if(!sp) return { ok: false, msg: "Sponsor not found" };

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found" };

    proj.productPlacements = proj.productPlacements || [];
    if(proj.productPlacements.includes(sp.id)){
      return { ok: false, msg: "Sponsor category already locked on this project." };
    }

    proj.productPlacements.push(sp.id);
    _modCash(S, sp.cashAdvance);
    S.studioOps.totalSponsorCash = Math.round(((S.studioOps.totalSponsorCash || 0) + sp.cashAdvance) * 10) / 10;

    if(typeof log === "function"){
      log("[PRODUCT PLACEMENT] Signed " + sp.name + " for \"" + proj.title + "\". Upfront sponsorship cash: +$" + sp.cashAdvance + "M.", "gold");
    }

    return { ok: true, cash: sp.cashAdvance, cashEarned: sp.cashAdvance, msg: "Brand sponsorship deposited!" };
  }

  // Press a batch of physical 4K Steelbooks
  function pressPhysicalMediaBatch(filmId, formatId, unitsOrState, state){
    let actualState = state;
    if(unitsOrState && typeof unitsOrState === "object") {
      actualState = unitsOrState;
    }
    const S = _getG(actualState);
    if(!S) return { ok: false, msg: "State missing" };
    initStudioOperations(S);

    const fmt = PHYSICAL_FORMATS[formatId] || PHYSICAL_FORMATS["steelbook_4k"];
    if(!fmt) return { ok: false, msg: "Format not found" };

    const film = (S.films || []).find(f => f.id === filmId || f.title === filmId) || (S.projects || []).find(p => p.id === filmId || p.title === filmId);
    if(!film) return { ok: false, msg: "Film not found" };

    const batch = (typeof unitsOrState === "number" && unitsOrState > 0) ? (unitsOrState > 1000 ? unitsOrState / 1000000 : (unitsOrState > 10 ? unitsOrState / 100 : unitsOrState)) : fmt.unitBatchSize;
    const pressingCost = Math.round(fmt.unitCost * batch * 10) / 10;
    if((S.studio ? S.studio.cash : S.cash) < pressingCost){
      return { ok: false, msg: "Insufficient cash for pressing run ($" + pressingCost + "M required)." };
    }

    _modCash(S, -pressingCost);

    // Calculate retail sell-through profit based on box office pull
    const boGross = film.gross || film.ww || 50;
    const sellThroughRate = Math.min(1.0, 0.4 + (boGross / 300));
    const grossProfit = Math.round(batch * fmt.profitMarginPerUnit * sellThroughRate * 10) / 10;

    _modCash(S, grossProfit);
    S.studioOps.physicalDiscProfits = Math.round(((S.studioOps.physicalDiscProfits || 0) + grossProfit) * 10) / 10;

    if(typeof log === "function"){
      log("[PHYSICAL HOME VIDEO] Released " + fmt.name + " for \"" + film.title + "\". Manufacturing: -$" + pressingCost + "M, Retail Sell-Through: +$" + grossProfit + "M.", "gold");
    }

    return { ok: true, netProfit: grossProfit - pressingCost, msg: "Physical media run completed!" };
  }

  // Hire a C-Suite executive
  function hireCSuiteOfficer(officerId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initStudioOperations(S);

    const off = CSUITE_OFFICERS.find(o => o.id === officerId || o.code === officerId);
    if(!off) return { ok: false, msg: "Officer not found" };

    if(S.studioOps.hiredCSuite[off.id]){
      return { ok: false, msg: "Officer already contracted." };
    }

    if((S.studio ? S.studio.cash : S.cash) < off.signingFee){
      return { ok: false, msg: "Insufficient cash for signing fee ($" + off.signingFee + "M required)." };
    }

    _modCash(S, -off.signingFee);
    S.studioOps.hiredCSuite[off.id] = {
      name: off.name,
      title: off.title,
      weeklySalary: off.weeklySalary,
      perk: off.perk
    };

    if(typeof log === "function"){
      log("[EXECUTIVE APPOINTMENT] Appointed " + off.name + " as " + off.title + ". Signing bonus: -$" + off.signingFee + "M.", "gold");
    }

    return { ok: true, msg: off.title + " successfully appointed!" };
  }

  // Purchase a Soundstage Lot
  function purchaseSoundstageLot(stageId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initStudioOperations(S);

    const stage = SOUNDSTAGE_LOTS.find(s => s.id === stageId || (stageId === "lot_water_tank" && s.id === "horizon_tank") || (stageId === "water_tank" && s.id === "horizon_tank") || (stageId === "soundstage_1" && s.id === "stage_alpha"));
    if(!stage) return { ok: false, msg: "Stage not found" };

    S.studioOps.ownedSoundstages = S.studioOps.ownedSoundstages || [];
    if(S.studioOps.ownedSoundstages.includes(stage.id)){
      return { ok: false, msg: "Soundstage already owned on studio lot." };
    }

    if((S.studio ? S.studio.cash : S.cash) < stage.cost){
      return { ok: false, msg: "Insufficient cash for land and construction ($" + stage.cost + "M required)." };
    }

    _modCash(S, -stage.cost);
    S.studioOps.ownedSoundstages.push(stage.id);

    if(typeof log === "function"){
      log("[BACKLOT EXPANSION] Constructed " + stage.name + " on studio lot (-$" + stage.cost + "M). In-house production costs reduced by " + Math.round(stage.budgetDiscountPct*100) + "%.", "gold");
    }

    return { ok: true, msg: "Soundstage commissioned on lot!" };
  }

  // Open Product Placement & Brand Deals Modal
  function openProductPlacementModal(){
    const S = _getG();
    if(!S) return;
    initStudioOperations(S);

    const inProd = (S.projects || []).filter(p => p.phase === "prod" || p.phase === "pre" || p.phase === "post");

    function renderInner(){
      let h = "<h3>Commercial Product Placement &amp; Brand Sponsorship Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Integrate corporate brand placement slots into your in-production films for guaranteed upfront financing (Box Office Inc parity).</p>";

      h += "<div class='stat-hero' style='margin-bottom:12px'>"+
        "<div class='stat'><div class='s-v' style='color:var(--gold)'>$" + (S.studioOps.totalSponsorCash || 0).toFixed(1) + "M</div><div class='s-l'>Total Sponsorship Cash</div></div>"+
        "<div class='stat'><div class='s-v'>" + inProd.length + "</div><div class='s-l'>In-Production Pictures</div></div>"+
      "</div>";

      h += "<div class='section-title'>Available Corporate Brand Sponsorships</div><div class='grid g2' style='gap:8px'>";
      SPONSOR_TIERS.forEach(sp => {
        h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
          "<div>"+
            "<div class='spread'><b>" + sp.name + "</b><span class='tag gold'>+$" + sp.cashAdvance + "M Advance</span></div>"+
            "<div class='tiny muted' style='margin:4px 0'>" + sp.desc + "</div>"+
            "<div class='tiny' style='color:var(--blue)'>Category: " + sp.category + " | Penalty Risk: " + Math.round(sp.criticPenaltyRisk*100) + "%</div>"+
          "</div>"+
          "<div style='margin-top:10px'>";
        if(inProd.length){
          h += "<button class='btn btn-xs btn-primary' style='width:100%' data-sponsor-id='" + sp.id + "'>Sign Placement Deal</button>";
        } else {
          h += "<button class='btn btn-xs' style='width:100%' disabled>Need In-Production Film</button>";
        }
        h += "</div></div>";
      });
      h += "</div>";

      return h;
    }

    function wireEvents(container){
      container.querySelectorAll("[data-sponsor-id]").forEach(btn => {
        btn.onclick = () => {
          const spId = btn.dataset.sponsorId;
          if(inProd.length > 0){
            const targetProj = inProd[0];
            const res = sellProductPlacement(targetProj.id, spId, S);
            if(res.ok){
              if(typeof toast === "function") toast(res.msg, "good");
              container.innerHTML = renderInner();
              wireEvents(container);
            } else {
              if(typeof toast === "function") toast(res.msg, "bad");
            }
          }
        };
      });
    }

    const initialHtml = "<div id='sponsorsModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#sponsorsModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  const StudioOperationsAPI = {
    SPONSOR_TIERS,
    PHYSICAL_FORMATS,
    SOUNDSTAGE_LOTS,
    CSUITE_OFFICERS,
    initStudioOperations,
    sellProductPlacement,
    pressPhysicalMediaBatch,
    hireCSuiteOfficer,
    purchaseSoundstageLot,
    openProductPlacementModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = StudioOperationsAPI;
  }
  global.StudioOperationsSuite = StudioOperationsAPI;
  global.openProductPlacementModal = openProductPlacementModal;
})(typeof window !== "undefined" ? window : global);
