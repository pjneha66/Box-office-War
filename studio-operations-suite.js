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
      let head = `<div class="produce-modal-head"><span class="command-eyebrow">PRODUCTION OFFICE / BRANDS</span><h3>Product placement &amp; brand sponsorship desk</h3><p>Integrate corporate placement slots into in-production films for guaranteed upfront financing. Cash now, creative note later.</p></div>`;
      let body = `<div class="produce-modal-body"><div style="display:flex;gap:12px;margin-bottom:12px">`+
        `<div class="produce-modal-card" style="flex:1;text-align:center"><div style="font:600 22px Georgia,serif;color:#edc47c">${fmtM(S.studioOps.totalSponsorCash||0)}</div><div style="font:8px ui-monospace,monospace;letter-spacing:1px;color:#93a692">TOTAL SPONSORSHIP CASH</div></div>`+
        `<div class="produce-modal-card" style="flex:1;text-align:center"><div style="font:600 22px Georgia,serif;color:#f2edda">${inProd.length}</div><div style="font:8px ui-monospace,monospace;letter-spacing:1px;color:#93a692">IN-PRODUCTION PICTURES</div></div>`+
      `</div>`;
      body += `<div style="font:14px Georgia,serif;color:#edc47c;margin:10px 0 8px">Available Corporate Brand Sponsorships</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">`;
      SPONSOR_TIERS.forEach(sp => {
        body += `<div class='produce-modal-card' style='display:flex;flex-direction:column;justify-content:space-between'>`+
          `<div>`+
            `<div class='spread'><b>${esc(sp.name)}</b><span class='tag gold'>+${fmtM(sp.cashAdvance)} Advance</span></div>`+
            `<div class='tiny muted' style='margin:4px 0'>${esc(sp.desc)}</div>`+
            `<div class='tiny' style='color:#7fb4d6'>Category: ${esc(sp.category)} · Penalty Risk: ${Math.round(sp.criticPenaltyRisk*100)}%</div>`+
          `</div>`+
          `<div style='margin-top:10px'>`;
        if(inProd.length){
          body += `<button class='produce-action' style='width:100%' data-sponsor-id='${sp.id}'>Sign Placement Deal</button>`;
        } else {
          body += `<button class='produce-ghost' style='width:100%' disabled>Need In-Production Film</button>`;
        }
        body += `</div></div>`;
      });
      body += `</div></div>`;
      let foot = `<div class='produce-modal-actions'><span class='tiny muted'>Brand cash is upfront — critic penalty is on release</span><button class='produce-ghost' onclick='closeModal()'>Close</button></div>`;
      return head+body+foot;
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
      const v = openModal(initialHtml,{className:'command-produce-modal command-dialog'});
      if(v){
        const inner = v.querySelector("#sponsorsModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  function getBacklotData(){
    const S = _getG();
    const ops = initStudioOperations(S);
    const owned = (ops && ops.ownedSoundstages) ? ops.ownedSoundstages : [];
    let discount = 0;
    owned.forEach(id => {
      const st = SOUNDSTAGE_LOTS.find(s => s.id === id);
      if(st) discount += st.budgetDiscountPct;
    });
    return {
      stagesBuilt: Math.max(1, owned.length + 1),
      stagesOccupied: (S && S.projects ? S.projects.filter(p => p.phase === "shoot").length : 0),
      discount: Math.min(0.5, discount)
    };
  }

  function getCSuiteData(){
    const S = _getG();
    const ops = initStudioOperations(S);
    const hired = (ops && ops.hiredCSuite) ? Object.keys(ops.hiredCSuite).length : 0;
    return { hiredCount: hired, total: CSUITE_OFFICERS.length };
  }

  function renderBacklotSection(){
    const S = _getG();
    const ops = initStudioOperations(S);
    const owned = (ops && ops.ownedSoundstages) ? ops.ownedSoundstages : [];
    let h = "<div class='section-title'>Studio Backlot Soundstages &amp; Virtual Production Stages</div>";
    h += "<p class='tiny muted' style='margin-bottom:8px'>Expand physical infrastructure to slash in-house production budgets and shoot complex VFX on lot.</p>";
    h += "<div class='grid g2' style='gap:8px'>";
    SOUNDSTAGE_LOTS.forEach(st => {
      const isOwned = owned.includes(st.id);
      h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
        "<div><div class='spread'><b>" + st.name + "</b>" +
        (isOwned ? "<span class='tag green'>CONSTRUCTED</span>" : "<span class='tag gold'>$" + st.cost + "M Build</span>") + "</div>"+
        "<div class='tiny muted' style='margin:4px 0'>" + st.desc + "</div>"+
        "<div class='tiny' style='color:var(--green)'>Production Discount: -" + Math.round(st.budgetDiscountPct*100) + "% per shoot</div></div>"+
        "<div style='margin-top:8px'>";
      if(isOwned){
        h += "<button class='btn btn-xs' style='width:100%' disabled>Active on Studio Backlot</button>";
      } else {
        h += "<button class='btn btn-xs btn-primary' style='width:100%' data-stage-buy='" + st.id + "'>Build Stage (-$" + st.cost + "M)</button>";
      }
      h += "</div></div>";
    });
    h += "</div>";
    return h;
  }

  function renderCSuiteSection(){
    const S=_getG(), ops=initStudioOperations(S), hired=ops.hiredCSuite||{};
    const seated=CSUITE_OFFICERS.filter(off=>hired[off.id]);
    const payroll=seated.reduce((sum,off)=>sum+off.weeklySalary,0);
    return `<div class="leadership-workspace"><aside class="leadership-brief"><span class="command-eyebrow">THE EXECUTIVE TABLE</span><h2>People behind<br>the pictures.</h2><div class="leadership-seats"><strong>${seated.length}<small> / ${CSUITE_OFFICERS.length}</small></strong><span>LEADERSHIP SEATS FILLED</span></div><div class="leadership-seat-map" aria-label="${seated.length} filled executive seats">${CSUITE_OFFICERS.map(off=>`<span class="${hired[off.id]?'filled':''}">${esc(off.id==='head_casting'?'CAST':off.id.toUpperCase())}</span>`).join('')}</div><dl><div><dt>Weekly payroll</dt><dd>$${payroll.toFixed(2)}M</dd></div><div><dt>Open appointments</dt><dd>${CSUITE_OFFICERS.length-seated.length}</dd></div></dl><p>Appoint specialists to strengthen the business behind your films. Each seat has a one-time signing fee and a weekly salary.</p></aside><section class="leadership-roster"><header><span class="command-eyebrow">APPOINTMENTS / YOUR EXECUTIVE TEAM</span><h2>Build your inner circle.</h2></header>${CSUITE_OFFICERS.map((off,i)=>{
      const active=!!hired[off.id];
      return `<article class="leadership-profile ${active?'appointed':''}" data-officer-id="${off.id}"><div class="leadership-profile-number">0${i+1}<small>${active?'SEATED':'OPEN SEAT'}</small></div><div class="leadership-person"><small>${esc(off.title)}</small><h3>${esc(off.name)}</h3><p>${esc(off.perk)}</p><div class="leadership-terms"><span>SIGNING <b>$${off.signingFee.toFixed(1)}M</b></span><span>WEEKLY <b>$${(off.weeklySalary*1000).toFixed(0)}k</b></span></div></div><div class="leadership-appointment">${active?'<span class="leadership-active">Contract Active</span>':`<button class="command-primary" data-csuite-hire="${off.id}" ${S.studio.cash<off.signingFee?'disabled':''}>Appoint leader ↗</button><small>${S.studio.cash<off.signingFee?'Insufficient signing capital':'One-time signing fee applies'}</small>`}</div></article>`;
    }).join('')}</section></div>`;
  }

  function renderProductPlacementSection(){
    let h = "<div class='section-title' style='margin-top:14px'>Commercial Product Placement &amp; Brand Sponsorships</div>";
    h += "<p class='tiny muted' style='margin-bottom:8px'>Monetize in-production projects with high-value brand tie-ins (Box Office Inc parity).</p>";
    h += "<div class='grid g2' style='gap:8px'>";
    SPONSOR_TIERS.forEach(sp => {
      h += "<div class='card'>"+
        "<div class='spread'><b>" + sp.name + "</b><span class='tag gold'>+$" + sp.cashAdvance + "M Upfront</span></div>"+
        "<div class='tiny muted' style='margin:4px 0'>" + sp.desc + "</div>"+
        "<div class='tiny' style='color:var(--purple)'>Category: " + sp.category + " | Critic Backlash Risk: " + Math.round(sp.criticPenaltyRisk*100) + "%</div>"+
      "</div>";
    });
    h += "</div>";
    return h;
  }

  function renderPhysicalMediaSection(){
    let h = "<div class='section-title'>Physical Home Video &amp; 4K Collector Editions</div>";
    h += "<div class='grid g2' style='gap:8px'>";
    for(const k in PHYSICAL_FORMATS){
      const fmt = PHYSICAL_FORMATS[k];
      h += "<div class='card'>"+
        "<div class='spread'><b>" + fmt.name + "</b><span class='tag green'>$" + fmt.retailPrice + " Retail</span></div>"+
        "<div class='tiny muted' style='margin:4px 0'>Manufacturing run: " + (fmt.unitBatchSize*1000).toFixed(0) + "k units at $" + fmt.unitCost + "/unit.</div>"+
        "<div class='tiny gold'>Expected Margin: $" + fmt.profitMarginPerUnit + " per unit sold</div>"+
      "</div>";
    }
    h += "</div>";
    return h;
  }

  function bindEvents(){
    const S = _getG();
    if(!S) return;
    document.querySelectorAll("[data-stage-buy]").forEach(btn => {
      btn.onclick = () => {
        const stageId = btn.dataset.stageBuy;
        const res = purchaseSoundstageLot(stageId, S);
        if(res.ok && typeof toast === "function") toast(res.msg, "good");
        else if(typeof toast === "function") toast(res.msg, "bad");
        if(res.ok && typeof saveGame === "function") saveGame();
        if(typeof render === "function") render();
      };
    });
    document.querySelectorAll("[data-csuite-hire]").forEach(btn => {
      btn.onclick = () => {
        const offId = btn.dataset.csuiteHire;
        const res = hireCSuiteOfficer(offId, S);
        if(res.ok && typeof toast === "function") toast(res.msg, "good");
        else if(typeof toast === "function") toast(res.msg, "bad");
        if(res.ok && typeof saveGame === "function") saveGame();
        if(typeof render === "function") render();
      };
    });
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
    openProductPlacementModal,
    renderProductPlacementModal: openProductPlacementModal,
    getBacklotData,
    getCSuiteData,
    renderBacklotSection,
    renderCSuiteSection,
    renderProductPlacementSection,
    renderPhysicalMediaSection,
    bindEvents
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = StudioOperationsAPI;
  }
  global.StudioOperationsSuite = StudioOperationsAPI;
  global.openProductPlacementModal = openProductPlacementModal;
})(typeof window !== "undefined" ? window : global);
