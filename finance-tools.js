/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — finance-tools.js
   In-game financial analysis tools:
   • DCF (Discounted Cash Flow) franchise valuation
   • Comparable studio analysis (comps)
   • LBO screening for IP acquisitions
   • Key ratio dashboards
   All money in $Millions (USD).
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ── DCF assumptions (in-game, slightly simplified) ── */
const DCF = {
  wacc: 0.10,           // 10% weighted avg cost of capital
  terminalGrowth: 0.02, // 2% terminal growth (long-run inflation)
  forecastYears: 5,     // 5-year explicit forecast
  taxRate: 0.25,        // effective tax rate
};

/* ── Comp universe: rival studios as public comps ── */
const COMP_UNIVERSE = [
  { id:"apex",       name:"Apex Pictures",       revMult:1.35, ebitdaMargin:0.22, netMargin:0.08,  evRev:3.2, evEbitda:12.5, pe:18 },
  { id:"horizon",    name:"Horizon Studios",     revMult:1.10, ebitdaMargin:0.18, netMargin:0.05,  evRev:2.5, evEbitda:11.0, pe:16 },
  { id:"luminary",   name:"Luminary Films",      revMult:0.95, ebitdaMargin:0.25, netMargin:0.12,  evRev:4.0, evEbitda:14.0, pe:22 },
  { id:"marquee",    name:"Marquee Entertainment",revMult:1.20, ebitdaMargin:0.20, netMargin:0.07,  evRev:2.8, evEbitda:12.0, pe:17 },
  { id:"verve",      name:"Verve Media Group",   revMult:1.05, ebitdaMargin:0.15, netMargin:0.03,  evRev:2.0, evEbitda:10.0, pe:14 },
];

/* ═══════════════════════════════════════════════════════════
   FRANCHISE DCF VALUATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Project franchise free cash flows for DCF
 * @param {Object} fr - franchise object
 * @returns {Array} yearly FCF projections
 */
function projectFranchiseFCF(fr){
  const g = DATA.GENRES[fr.genre];
  const tier = fr.tier || 1;
  const fatigue = fr.fatigue || 0;
  const decay = fr.decay || 0.8;

  // Base weekly income from franchise
  const weeklyIncome = frWeeklyIncome(fr);
  const annualIncome = weeklyIncome * 52;

  // Franchise value drivers
  const merchIncome = annualIncome * (fr.merch || 0) * 0.15; // merch scales with tier
  const parkIncome = (fr.park || 0) >= 2 ? annualIncome * 0.25 * (fr.park || 0) : 0;
  const gameIncome = (fr.gameSold || 0) >= tier ? annualIncome * 0.10 : 0; // one-time but annualized
  const streamingIncome = annualIncome * 0.20; // streaming window value
  const sequelOptionValue = annualIncome * 0.30 * (1 - fatigue); // option value of sequels

  const totalAnnualCF = annualIncome + merchIncome + parkIncome + gameIncome + streamingIncome + sequelOptionValue;

  // Project forward with decay and fatigue
  const projections = [];
  for(let y=1; y<=DCF.forecastYears; y++){
    const yearFatigue = Math.max(0, fatigue - (y-1)*0.15); // fatigue heals over time if rested
    const yearDecay = Math.max(0.3, decay * Math.pow(0.85, y-1)); // natural decay
    const yearCF = totalAnnualCF * yearDecay * (1 - yearFatigue * 0.5);

    // Tax
    const fcf = yearCF * (1 - DCF.taxRate);
    projections.push({ year: y, fcf: Math.round(fcf * 10) / 10 });
  }
  return projections;
}

/**
 * DCF valuation for a franchise
 * @param {Object} fr - franchise object
 * @returns {Object} DCF result
 */
function franchiseDCF(fr){
  const projections = projectFranchiseFCF(fr);
  const wacc = DCF.wacc;
  const tg = DCF.terminalGrowth;

  // Discount explicit forecast
  let pvExplicit = 0;
  projections.forEach(p => {
    pvExplicit += p.fcf / Math.pow(1 + wacc, p.year);
  });

  // Terminal value (Gordon growth model)
  const terminalFCF = projections[projections.length - 1].fcf * (1 + tg);
  const terminalValue = terminalFCF / (wacc - tg);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, DCF.forecastYears);

  const enterpriseValue = pvExplicit + pvTerminal;

  // Net debt adjustment (franchise-level debt is studio-level, so EV = equity value here)
  const equityValue = enterpriseValue;

  // Sensitivity table
  const sensitivity = [];
  for(let w = wacc - 0.02; w <= wacc + 0.02; w += 0.01){
    for(let g = tg - 0.01; g <= tg + 0.01; g += 0.005){
      const tv = terminalFCF / (w - g);
      const ev = projections.reduce((sum, p) => sum + p.fcf / Math.pow(1 + w, p.year), 0) + tv / Math.pow(1 + w, DCF.forecastYears);
      sensitivity.push({ wacc: Math.round(w*1000)/10, g: Math.round(g*1000)/10, ev: Math.round(ev * 10) / 10 });
    }
  }

  return {
    enterpriseValue: Math.round(enterpriseValue * 10) / 10,
    equityValue: Math.round(equityValue * 10) / 10,
    pvExplicit: Math.round(pvExplicit * 10) / 10,
    pvTerminal: Math.round(pvTerminal * 10) / 10,
    terminalValue: Math.round(terminalValue * 10) / 10,
    projections,
    sensitivity,
    wacc: Math.round(wacc * 1000) / 10,
    terminalGrowth: Math.round(tg * 1000) / 10,
    assumptions: {
      forecastYears: DCF.forecastYears,
      taxRate: DCF.taxRate,
      baseWeeklyIncome: frWeeklyIncome(fr),
      fatigue: Math.round((fr.fatigue||0)*100),
      decay: Math.round((fr.decay||1)*100),
    }
  };
}

/* ═══════════════════════════════════════════════════════════
   COMPARABLE STUDIO ANALYSIS (COMPS)
   ═══════════════════════════════════════════════════════════ */

/**
 * Calculate studio's key metrics for comps
 * @returns {Object} studio metrics
 */
function studioMetrics(){
  const st = G.studio;
  const films = G.films;
  const franchises = G.franchises;

  // Trailing 12-month (52 weeks) revenue
  const trailRev = finTrail().R;
  const trailEBITDA = finTrail().P + finTrail().exp.interest + finTrail().exp.talent * 0.3; // rough proxy
  const trailNet = finTrail().P;

  // Enterprise value (market cap + net debt)
  const mktCap = G.public ? marketCap() : trailRev * 3; // private: 3x revenue heuristic
  const netDebt = st.debt - Math.max(0, st.cash);
  const ev = mktCap + netDebt;

  // Franchise portfolio value
  const franchiseValue = franchises.reduce((sum, fr) => sum + (fr.earned || 0) * 1.5, 0); // rough multiple

  return {
    revenue: Math.round(trailRev * 10) / 10,
    ebitda: Math.round(trailEBITDA * 10) / 10,
    netIncome: Math.round(trailNet * 10) / 10,
    ev: Math.round(ev * 10) / 10,
    marketCap: Math.round(mktCap * 10) / 10,
    netDebt: Math.round(netDebt * 10) / 10,
    franchiseValue: Math.round(franchiseValue * 10) / 10,
    filmsReleased: G.stats.films,
    hits: G.stats.hits,
    flops: G.stats.flops,
    hitRate: G.stats.films > 0 ? Math.round(G.stats.hits / G.stats.films * 100) : 0,
    avgWWPerFilm: G.stats.films > 0 ? Math.round(G.stats.totalWW / G.stats.films * 10) / 10 : 0,
    rep: Math.round(st.rep),
    cash: Math.round(st.cash * 10) / 10,
  };
}

/**
 * Run comparable analysis against rival studios
 * @returns {Object} comps analysis
 */
function runComps(){
  const my = studioMetrics();
  const comps = COMP_UNIVERSE.map(c => {
    // Scale rival metrics to their revenue multiple
    const rev = my.revenue * c.revMult;
    const ebitda = rev * c.ebitdaMargin;
    const net = rev * c.netMargin;
    const ev = rev * c.evRev;

    return {
      name: c.name,
      revenue: Math.round(rev * 10) / 10,
      ebitda: Math.round(ebitda * 10) / 10,
      netIncome: Math.round(net * 10) / 10,
      ev: Math.round(ev * 10) / 10,
      evRev: c.evRev,
      evEbitda: c.evEbitda,
      pe: c.pe,
      ebitdaMargin: Math.round(c.ebitdaMargin * 1000) / 10,
      netMargin: Math.round(c.netMargin * 1000) / 10,
    };
  });

  // Calculate implied valuation from comps
  const medianEVRev = median(comps.map(c => c.evRev));
  const medianEVEbitda = median(comps.map(c => c.evEbitda));
  const medianPE = median(comps.map(c => c.pe));

  const impliedEVFromRev = my.revenue * medianEVRev;
  const impliedEVFromEbitda = my.ebitda > 0 ? my.ebitda * medianEVEbitda : impliedEVFromRev;
  const impliedEqFromPE = my.netIncome > 0 ? my.netIncome * medianPE : impliedEVFromRev;

  const impliedEV = Math.round((impliedEVFromRev + impliedEVFromEbitda) / 2 * 10) / 10;
  const impliedEq = Math.round(impliedEqFromPE * 10) / 10;

  // Premium/discount to comps
  const actualEV = my.ev;
  const premDisc = actualEV > 0 ? Math.round((actualEV - impliedEV) / impliedEV * 1000) / 10 : 0;

  return {
    myMetrics: my,
    comps,
    medianMultiples: {
      evRev: medianEVRev,
      evEbitda: medianEVEbitda,
      pe: medianPE,
    },
    impliedEV,
    impliedEq,
    premiumDiscount: premDisc,
    verdict: premDisc > 15 ? "Premium" : premDisc < -15 ? "Discount" : "In-line",
  };
}

function median(arr){
  const sorted = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
}

/* ═══════════════════════════════════════════════════════════
   LBO SCREENING FOR IP ACQUISITIONS
   ═══════════════════════════════════════════════════════════ */

/**
 * LBO screen for a potential franchise/IP acquisition
 * @param {Object} target - target franchise or IP (from ipMarket or rival)
 * @param {Object} assumptions - leverage assumptions
 * @returns {Object} LBO result
 */
function lboScreen(target, assumptions){
  const lev = assumptions || {};
  const leverage = lev.leverage || 4.0;      // 4x EBITDA
  const costOfDebt = lev.costOfDebt || 0.08; // 8% interest
  const holdYears = lev.holdYears || 5;
  const exitMultiple = lev.exitMultiple || 10.0;

  // Target metrics (if IP from market, use its earnings potential)
  const ebitda = target.estEbitda || (target.earned || 0) / 5; // rough annual EBITDA
  const purchasePrice = ebitda * leverage;

  // Debt schedule
  const debt = purchasePrice * 0.7; // 70% debt
  const equity = purchasePrice * 0.3;

  // Annual cash flows
  let remainingDebt = debt;
  let totalInterest = 0;
  for(let y=1; y<=holdYears; y++){
    const interest = remainingDebt * costOfDebt;
    const fcf = ebitda * (1 - DCF.taxRate) - interest;
    const principalPaydown = Math.max(0, fcf * 0.5); // 50% sweep
    remainingDebt = Math.max(0, remainingDebt - principalPaydown);
    totalInterest += interest;
  }

  // Exit
  const exitEV = ebitda * exitMultiple;
  const exitEquity = exitEV - remainingDebt;
  const moic = (exitEquity + equity * 0) / equity; // no dividends in this simple model
  const irr = Math.pow(moic, 1/holdYears) - 1;

  return {
    purchasePrice: Math.round(purchasePrice * 10) / 10,
    leverage,
    equityInvested: Math.round(equity * 10) / 10,
    debt: Math.round(debt * 10) / 10,
    holdYears,
    exitMultiple,
    exitEquity: Math.round(exitEquity * 10) / 10,
    moic: Math.round(moic * 100) / 100,
    irr: Math.round(irr * 1000) / 10,
    annualEbitda: Math.round(ebitda * 10) / 10,
    totalInterest: Math.round(totalInterest * 10) / 10,
    verdict: irr >= 0.20 ? "Attractive" : irr >= 0.15 ? "Marginal" : "Pass",
  };
}

/* ═══════════════════════════════════════════════════════════
   KEY RATIO DASHBOARD
   ═══════════════════════════════════════════════════════════ */

function keyRatios(){
  const st = G.studio;
  const m = studioMetrics();

  return {
    // Liquidity
    cashToDebt: st.debt > 0 ? Math.round(st.cash / st.debt * 100) / 100 : Infinity,
    currentRatio: st.cash / (st.overhead * 4), // cash vs 4 weeks overhead

    // Leverage
    debtToEbitda: m.ebitda > 0 ? Math.round((st.debt / m.ebitda) * 100) / 100 : Infinity,
    netDebtToEbitda: m.ebitda > 0 ? Math.round((m.netDebt / m.ebitda) * 100) / 100 : Infinity,
    interestCoverage: finTrail().exp.interest > 0 ? Math.round((m.ebitda / finTrail().exp.interest) * 100) / 100 : Infinity,

    // Profitability
    ebitdaMargin: m.revenue > 0 ? Math.round(m.ebitda / m.revenue * 1000) / 10 : 0,
    netMargin: m.revenue > 0 ? Math.round(m.netIncome / m.revenue * 1000) / 10 : 0,
    roic: (st.cash + st.debt) > 0 ? Math.round(m.netIncome / (st.cash + st.debt) * 1000) / 10 : 0,
    roe: G.public && m.netIncome > 0 ? Math.round(m.netIncome / m.marketCap * 1000) / 10 : null,

    // Efficiency
    revPerFilm: m.filmsReleased > 0 ? Math.round(m.revenue / m.filmsReleased * 10) / 10 : 0,
    franchiseYield: m.franchiseValue > 0 ? Math.round(frWeeklyIncomeTotal() * 52 / m.franchiseValue * 1000) / 10 : 0,

    // Market
    evRev: m.revenue > 0 ? Math.round(m.ev / m.revenue * 100) / 100 : 0,
    evEbitda: m.ebitda > 0 ? Math.round(m.ev / m.ebitda * 100) / 100 : 0,
    pe: m.netIncome > 0 ? Math.round(m.marketCap / m.netIncome * 100) / 100 : 0,
  };
}

function frWeeklyIncomeTotal(){
  return G.franchises.reduce((a,f)=>a+frWeeklyIncome(f),0);
}

/* ═══════════════════════════════════════════════════════════
   RENDER HELPERS FOR UI
   ═══════════════════════════════════════════════════════════ */

function renderDCFCard(fr){
  const dcf = franchiseDCF(fr);
  const g = DATA.GENRES[fr.genre];

  let h = "<div class='card'><div class='spread'><b>"+g.emoji+" "+esc(fr.name)+" DCF Valuation</b><span class='tag gold'>Tier "+fr.tier+"</span></div>";
  h += "<div class='cost-line'><span>Enterprise Value</span><b class='pos'>"+fmtM(dcf.enterpriseValue)+"M</b></div>";
  h += "<div class='cost-line'><span>Equity Value</span><b class='pos'>"+fmtM(dcf.equityValue)+"M</b></div>";
  h += "<div class='tiny muted' style='margin:4px 0'>PV Explicit: "+fmtM(dcf.pvExplicit)+"M · PV Terminal: "+fmtM(dcf.pvTerminal)+"M</div>";

  h += "<details style='margin-top:8px'><summary class='small'>📊 5-Year FCF Projections</summary><div class='small' style='margin-top:6px'>";
  dcf.projections.forEach(p => {
    h += "<div class='cost-line'><span>Year "+p.year+"</span><b class='pos'>"+fmtM(p.fcf)+"M</b></div>";
  });
  h += "</div></details>";

  h += "<details style='margin-top:6px'><summary class='small'>⚙️ Sensitivity (WACC × Terminal Growth)</summary><div class='small' style='margin-top:6px'>";
  h += "<table style='width:100%;border-collapse:collapse;font-size:11px'><thead><tr><th>WACC\\g</th>";
  const growths = [0.01, 0.015, 0.02, 0.025, 0.03];
  growths.forEach(g => h += "<th>"+(g*100).toFixed(1)+"%</th>");
  h += "</tr></thead><tbody>";
  const waccs = [0.08, 0.09, 0.10, 0.11, 0.12];
  waccs.forEach(w => {
    h += "<tr><td><b>"+(w*100).toFixed(1)+"%</b></td>";
    growths.forEach(g => {
      const tv = dcf.projections[dcf.projections.length-1].fcf * (1+g);
      const termVal = tv / (w - g);
      const ev = dcf.projections.reduce((sum, p) => sum + p.fcf / Math.pow(1+w, p.year), 0) + termVal / Math.pow(1+w, DCF.forecastYears);
      const cls = ev > dcf.enterpriseValue ? "pos" : "neg";
      h += "<td class='"+cls+"'>"+fmtM(Math.round(ev*10)/10)+"</td>";
    });
    h += "</tr>";
  });
  h += "</tbody></table></div></details>";

  h += "<div class='tiny muted' style='margin-top:6px'>WACC: "+dcf.wacc+"% · Terminal growth: "+dcf.terminalGrowth+"% · Tax: "+(DCF.taxRate*100)+"%</div>";
  h += "</div>";
  return h;
}

function renderCompsCard(){
  const comps = runComps();

  let h = "<div class='card'><div class='spread'><b>📊 Comparable Studio Analysis</b><span class='tag "+(comps.premiumDiscount>0?'gold':comps.premiumDiscount<0?'red':'')+"'>"+comps.verdict+"</span></div>";

  h += "<div class='cost-line'><span>Implied EV (comps)</span><b>"+fmtM(comps.impliedEV)+"M</b></div>";
  h += "<div class='cost-line'><span>Actual EV</span><b>"+fmtM(comps.myMetrics.ev)+"M</b></div>";
  h += "<div class='cost-line'><span>Premium / (Discount)</span><b class='"+(comps.premiumDiscount>=0?'pos':'neg')+"'>"+(comps.premiumDiscount>=0?'+':'')+comps.premiumDiscount+"%</b></div>";

  h += "<div class='tiny muted' style='margin:6px 0'>Median multiples: EV/Rev "+comps.medianMultiples.evRev+"x · EV/EBITDA "+comps.medianMultiples.evEbitda+"x · P/E "+comps.medianMultiples.pe+"x</div>";

  h += "<details style='margin-top:8px'><summary class='small'>🏢 Comp Universe</summary><div class='small' style='margin-top:6px'>";
  h += "<table style='width:100%;border-collapse:collapse;font-size:11px'><thead><tr><th>Studio</th><th>Rev</th><th>EBITDA</th><th>EV</th><th>EV/Rev</th><th>EV/EBITDA</th><th>P/E</th></tr></thead><tbody>";
  comps.comps.forEach(c => {
    h += "<tr><td><b>"+esc(c.name)+"</b></td><td>"+fmtM(c.revenue)+"</td><td>"+fmtM(c.ebitda)+"</td><td>"+fmtM(c.ev)+"</td><td>"+c.evRev+"x</td><td>"+c.evEbitda+"x</td><td>"+c.pe+"x</td></tr>";
  });
  h += "<tr style='border-top:1px solid var(--line2)'><td><b>Your Studio</b></td><td>"+fmtM(comps.myMetrics.revenue)+"</td><td>"+fmtM(comps.myMetrics.ebitda)+"</td><td>"+fmtM(comps.myMetrics.ev)+"</td><td>"+(comps.myMetrics.revenue?Math.round(comps.myMetrics.ev/comps.myMetrics.revenue*100)/100:0)+"x</td><td>"+(comps.myMetrics.ebitda?Math.round(comps.myMetrics.ev/comps.myMetrics.ebitda*100)/100:0)+"x</td><td>"+(comps.myMetrics.netIncome?Math.round(comps.myMetrics.marketCap/comps.myMetrics.netIncome*100)/100:0)+"x</td></tr>";
  h += "</tbody></table></div></details>";

  h += "</div>";
  return h;
}

function renderLBOCard(target){
  const lbo = lboScreen(target, { leverage: 4.0, costOfDebt: 0.08, holdYears: 5, exitMultiple: 10.0 });

  let h = "<div class='card'><div class='spread'><b>🏦 LBO Screen: "+esc(target.name||"Target")+"</b><span class='tag "+(lbo.verdict==='Attractive'?'green':lbo.verdict==='Marginal'?'gold':'red')+"'>"+lbo.verdict+"</span></div>";

  h += "<div class='cost-line'><span>Purchase Price (Leverage "+lbo.leverage+"x EBITDA)</span><b>"+fmtM(lbo.purchasePrice)+"M</b></div>";
  h += "<div class='cost-line'><span>Equity Invested (30%)</span><b>"+fmtM(lbo.equityInvested)+"M</b></div>";
  h += "<div class='cost-line'><span>Debt (70%)</span><b class='neg'>"+fmtM(lbo.debt)+"M</b></div>";
  h += "<div class='cost-line'><span>Annual EBITDA</span><b class='pos'>"+fmtM(lbo.annualEbitda)+"M</b></div>";
  h += "<div class='cost-line'><span>Exit Equity (Year "+lbo.holdYears+")</span><b class='pos'>"+fmtM(lbo.exitEquity)+"M</b></div>";
  h += "<div class='cost-line'><span>MOIC</span><b>"+lbo.moic+"x</b></div>";
  h += "<div class='cost-line'><span>IRR</span><b class='"+(lbo.irr>=20?'pos':lbo.irr>=15?'gold':'neg')+"'>"+lbo.irr+"%</b></div>";

  h += "<div class='tiny muted' style='margin-top:6px'>Assumptions: "+(lbo.leverage*100)+"% debt at "+(lbo.totalInterest/lbo.debt*100).toFixed(1)+"% interest, "+lbo.holdYears+"yr hold, "+lbo.exitMultiple+"x exit multiple</div>";

  h += "</div>";
  return h;
}

function renderRatiosCard(){
  const r = keyRatios();

  let h = "<div class='card'><b>📐 Key Financial Ratios</b>";

  h += "<div class='section-title' style='margin:10px 0 6px;font-size:12px'>Liquidity & Leverage</div>";
  h += "<div class='cost-line'><span>Cash / Debt</span><b>"+(r.cashToDebt===Infinity?'∞':r.cashToDebt.toFixed(2))+"x</b></div>";
  h += "<div class='cost-line'><span>Debt / EBITDA</span><b class='"+(r.debtToEbitda>5?'neg':r.debtToEbitda>3?'gold':'pos')+"'>"+(r.debtToEbitda===Infinity?'∞':r.debtToEbitda.toFixed(2))+"x</b></div>";
  h += "<div class='cost-line'><span>Net Debt / EBITDA</span><b class='"+(r.netDebtToEbitda>3?'neg':r.netDebtToEbitda>1.5?'gold':'pos')+"'>"+(r.netDebtToEbitda===Infinity?'∞':r.netDebtToEbitda.toFixed(2))+"x</b></div>";
  h += "<div class='cost-line'><span>Interest Coverage</span><b class='"+(r.interestCoverage<2?'neg':r.interestCoverage<4?'gold':'pos')+"'>"+(r.interestCoverage===Infinity?'∞':r.interestCoverage.toFixed(2))+"x</b></div>";

  h += "<div class='section-title' style='margin:10px 0 6px;font-size:12px'>Profitability</div>";
  h += "<div class='cost-line'><span>EBITDA Margin</span><b>"+r.ebitdaMargin+"%</b></div>";
  h += "<div class='cost-line'><span>Net Margin</span><b class='"+(r.netMargin>=0?'pos':'neg')+"'>"+r.netMargin+"%</b></div>";
  h += "<div class='cost-line'><span>ROIC</span><b class='"+(r.roic>=10?'pos':r.roic>=5?'gold':'neg')+"'>"+r.roic+"%</b></div>";
  h += "<div class='cost-line'><span>ROE</span><b>"+(r.roe===null?'N/A':r.roe+"%")+"</b></div>";

  h += "<div class='section-title' style='margin:10px 0 6px;font-size:12px'>Market Multiples</div>";
  h += "<div class='cost-line'><span>EV / Revenue</span><b>"+r.evRev+"x</b></div>";
  h += "<div class='cost-line'><span>EV / EBITDA</span><b>"+r.evEbitda+"x</b></div>";
  h += "<div class='cost-line'><span>P / E</span><b>"+r.pe+"x</b></div>";
  h += "<div class='cost-line'><span>Franchise Yield</span><b class='pos'>"+r.franchiseYield+"%</b></div>";

  h += "</div>";
  return h;
}

/* ═══════════════════════════════════════════════════════════
   MAIN ENTRY: RENDER FINANCIAL ANALYSIS SECTION
   ═══════════════════════════════════════════════════════════ */

function renderFinancialAnalysis(){
  if(!G || !G.franchises.length) return "<div class='card muted small'>Build a franchise first to unlock financial analysis.</div>";

  let h = "<div class='section-title'>📐 Financial Analysis Lab</div>";

  // Key Ratios
  h += renderRatiosCard();

  // Comps
  h += renderCompsCard();

  // Franchise DCF selector
  h += "<div class='section-title' style='margin-top:10px'>🏰 Franchise DCF Valuation</div>";
  h += "<div class='card'><div class='small muted' style='margin-bottom:6px'>Select a franchise to run a DCF valuation:</div>";
  h += "<div class='row' style='gap:8px;flex-wrap:wrap'>";
  G.franchises.forEach(fr => {
    const dcf = franchiseDCF(fr);
    h += "<button class='btn btn-sm btn-alt' data-dcf='"+fr.id+"'>"+DATA.GENRES[fr.genre].emoji+" "+esc(fr.name)+" — "+fmtM(dcf.equityValue)+"M</button>";
  });
  h += "</div></div>";

  // Placeholder for selected DCF
  h += "<div id='dcfDetail' style='margin-top:8px'></div>";

  // LBO Screen for IP Market acquisitions
  if(G.ipMarket && G.ipMarket.length){
    h += "<div class='section-title' style='margin-top:10px'>🏦 LBO Screen — IP Market Targets</div>";
    h += "<div class='card'><div class='small muted' style='margin-bottom:6px'>Screen potential acquisitions from the IP Market:</div>";
    h += "<div class='row' style='gap:8px;flex-wrap:wrap'>";
    G.ipMarket.slice(0, 6).forEach(ip => {
      h += "<button class='btn btn-sm btn-alt' data-lbo='"+ip.id+"'>"+esc(ip.name)+" ("+fmtM(ip.price)+"M)</button>";
    });
    h += "</div></div>";
    h += "<div id='lboDetail' style='margin-top:8px'></div>";
  }

  return h;
}

/* Bind interactive buttons for DCF/LBO detail views */
function bindFinancialAnalysis(){
  // DCF detail buttons
  document.querySelectorAll('[data-dcf]').forEach(btn => {
    btn.onclick = () => {
      const fr = G.franchises.find(f => f.id === btn.dataset.dcf);
      if(fr){
        document.getElementById('dcfDetail').innerHTML = renderDCFCard(fr);
      }
    };
  });

  // LBO detail buttons
  document.querySelectorAll('[data-lbo]').forEach(btn => {
    btn.onclick = () => {
      const ip = G.ipMarket.find(i => i.id === btn.dataset.lbo);
      if(ip){
        document.getElementById('lboDetail').innerHTML = renderLBOCard(ip);
      }
    };
  });
}

/* Export for global scope */
window.FINANCE_TOOLS = {
  franchiseDCF,
  runComps,
  lboScreen,
  keyRatios,
  studioMetrics,
  renderFinancialAnalysis,
  bindFinancialAnalysis,
};