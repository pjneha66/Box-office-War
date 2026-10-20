/* ═════════════════════════════════════════════════════════════════════════
   SPORTS-STADIUM-DEALS.JS — Multi-Sport Stadium Complex, Naming Rights & Broadcast Deals
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Idle Sports Stadium Tycoon (v1.50.1)
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

  // 1. Stadium Facilities & Infrastructure Upgrades (From Idle Sports Stadium Tycoon)
  const STADIUM_UPGRADES = [
    {
      id: "seating_capacity",
      name: "Grandstand & Bleacher Expansion",
      levels: [
        { lvl: 1, cap: "15,000 Seats", cost: 0.0, weeklyTicketRev: 0.25 },
        { lvl: 2, cap: "35,000 Seats", cost: 12.0, weeklyTicketRev: 0.65 },
        { lvl: 3, cap: "60,000 Seats", cost: 28.0, weeklyTicketRev: 1.35 },
        { lvl: 4, cap: "85,000 Mega-Colosseum", cost: 50.0, weeklyTicketRev: 2.20 }
      ],
      desc: "Expands physical stadium seating to boost matchday ticket sales and attendance."
    },
    {
      id: "vip_skyboxes",
      name: "Luxury VIP Skybox Suites",
      levels: [
        { lvl: 1, cap: "Standard Lounges", cost: 0.0, weeklyVipRev: 0.10 },
        { lvl: 2, cap: "Corporate Suites", cost: 8.0, weeklyVipRev: 0.40 },
        { lvl: 3, cap: "Penthouse Founder Boxes", cost: 18.0, weeklyVipRev: 0.90 }
      ],
      desc: "Executive suites rented out to Fortune 500 executives, agents, and A-list celebrities."
    },
    {
      id: "concessions_court",
      name: "Gourmet Concessions & Craft Breweries",
      levels: [
        { lvl: 1, cap: "Hot Dogs & Soda", cost: 0.0, concessionMargin: 0.08 },
        { lvl: 2, cap: "Food Truck Boulevard", cost: 5.0, concessionMargin: 0.25 },
        { lvl: 3, cap: "Michelin Food Hall", cost: 14.0, concessionMargin: 0.55 }
      ],
      desc: "High-margin food and beverage franchises sharing food court royalties on game days."
    },
    {
      id: "broadcast_jumbotron",
      name: "Ultra-HD 4K Jumbotron & Broadcast Hub",
      levels: [
        { lvl: 1, cap: "Basic Scoreboard", cost: 0.0, broadcastMult: 1.0 },
        { lvl: 2, cap: "360-Degree Halo Screen", cost: 10.0, broadcastMult: 1.25 },
        { lvl: 3, cap: "IMAX Live Broadcast Hub", cost: 22.0, broadcastMult: 1.60 }
      ],
      desc: "Upgrades on-field broadcast tech, multiplying the bidding price of TV and streaming rights."
    }
  ];

  // 2. Corporate Stadium Naming Rights Deals (Multi-Year Mega Sponsorships)
  const NAMING_RIGHTS_SPONSORS = [
    {
      id: "apex_energy",
      name: "Apex Energy Colosseum",
      sponsorName: "Apex Clean Energy Corp",
      annualPayout: 18.0,
      durationWeeks: 52,
      minRepRequired: 30,
      blurb: "Flagship clean-tech conglomerate. Reliable annual capital injection."
    },
    {
      id: "lumina_tech",
      name: "Lumina Silicon Arena",
      sponsorName: "Lumina Semiconductor Group",
      annualPayout: 28.0,
      durationWeeks: 52,
      minRepRequired: 60,
      blurb: "Global AI and chipmaker giant paying top dollar for naming prestige."
    },
    {
      id: "titan_motors",
      name: "Titan Motor Speedway & Dome",
      sponsorName: "Titan Automotive Global",
      annualPayout: 38.0,
      durationWeeks: 52,
      minRepRequired: 75,
      blurb: "Luxury EV juggernaut providing massive multi-year stadium naming rights."
    }
  ];

  // 3. Live Sports Broadcast Packages (Expanded Sports Deals)
  const EXPANDED_SPORTS_PACKAGES = [
    {
      id: "pkg_football_premier",
      name: "Global Premier Football League",
      icon: "⚽",
      tier: "Mega Tier",
      rightsCost: 45.0,
      subBump: 6.5,
      adRevenueWeekly: 1.8,
      durationWeeks: 24,
      desc: "Sunday night primetime football with international fanatical devotion."
    },
    {
      id: "pkg_basketball_champions",
      name: "Championship Basketball League",
      icon: "🏀",
      tier: "A-List",
      rightsCost: 28.0,
      subBump: 4.2,
      adRevenueWeekly: 1.1,
      durationWeeks: 20,
      desc: "Fast-paced slam-dunk entertainment commanding premium Gen-Z live streaming."
    },
    {
      id: "pkg_grand_slam_tennis",
      name: "Grand Slam World Tennis Invitational",
      icon: "🎾",
      tier: "Prestige",
      rightsCost: 16.0,
      subBump: 2.5,
      adRevenueWeekly: 0.65,
      durationWeeks: 8,
      desc: "Summer hardcourt elegance drawing affluent demographics and luxury advertisers."
    },
    {
      id: "pkg_formula_grand_prix",
      name: "Sunset Grand Prix Championship",
      icon: "🏎",
      tier: "Ultra-High Octane",
      rightsCost: 35.0,
      subBump: 5.0,
      adRevenueWeekly: 1.4,
      durationWeeks: 16,
      desc: "High-speed hybrid turbo action with global street circuit drama."
    },
    {
      id: "pkg_esports_world_cup",
      name: "Apex Esports World Cup",
      icon: "🎮",
      tier: "Digital Gen-Z",
      rightsCost: 12.0,
      subBump: 3.8,
      adRevenueWeekly: 0.85,
      durationWeeks: 12,
      desc: "Sold-out arenas of professional gamers. Massive streaming numbers and chat engagement."
    }
  ];

  function _ensureStadiumState(G){
    if(!G) return;
    if(!G.stadium) G.stadium = {};
    const st = G.stadium;
    if(!st.unlocked) st.unlocked = true;
    if(!st.name) st.name = (G.studio ? G.studio.name : "Hollywood") + " Megadome";
    if(!st.facilityLevels) st.facilityLevels = {
      seating_capacity: 1,
      vip_skyboxes: 1,
      concessions_court: 1,
      broadcast_jumbotron: 1
    };
    if(!st.namingDeal) st.namingDeal = null;
    if(!st.activeSportsPackages) st.activeSportsPackages = [];
    if(!st.halftimeShows) st.halftimeShows = [];
  }

  // 4. Upgrade Stadium Facility
  function upgradeFacility(facilityId){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureStadiumState(G);

    const fac = STADIUM_UPGRADES.find(f => f.id === facilityId);
    if(!fac) return { ok: false, msg: "Facility not found" };

    const currentLvl = G.stadium.facilityLevels[facilityId] || 1;
    if(currentLvl >= fac.levels.length){
      return { ok: false, msg: "Facility already at maximum tier." };
    }

    const nextTier = fac.levels[currentLvl];
    if((G.studio ? G.studio.cash : G.cash) < nextTier.cost){
      return { ok: false, msg: "Insufficient funds: $" + nextTier.cost + "M required." };
    }

    _modCash(G, -nextTier.cost);
    G.stadium.facilityLevels[facilityId] = currentLvl + 1;

    if(typeof log === "function"){
      log("🏟 Stadium Expansion: Upgraded " + fac.name + " to Level " + (currentLvl + 1) + " (" + nextTier.cap + ")!", "gold");
    }

    return { ok: true, facility: fac, newLevel: currentLvl + 1 };
  }

  // 5. Sign Naming Rights Deal
  function signNamingRights(sponsorId){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureStadiumState(G);

    const sp = NAMING_RIGHTS_SPONSORS.find(s => s.id === sponsorId);
    if(!sp) return { ok: false, msg: "Sponsor not found" };

    const rep = (G.studio ? G.studio.rep : G.rep) || 50;
    if(rep < sp.minRepRequired){
      return { ok: false, msg: "Studio reputation too low (" + sp.minRepRequired + " required)." };
    }

    // Payout first annual tranche
    _modCash(G, sp.annualPayout);

    G.stadium.namingDeal = {
      sponsor: sp,
      stadiumDisplayName: sp.name,
      weeksRemaining: sp.durationWeeks,
      annualPayout: sp.annualPayout
    };

    if(typeof log === "function"){
      log("✍️ Naming Rights Megadeal: Signed with " + sp.sponsorName + "! Payout: +$" + sp.annualPayout + "M/year. Stadium re-christened: \"" + sp.name + "\"!", "gold");
    }

    return { ok: true, deal: G.stadium.namingDeal };
  }

  // 6. Buy Sports Broadcast Rights Package
  function buySportsRightsPackage(packageId){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureStadiumState(G);

    const pkg = EXPANDED_SPORTS_PACKAGES.find(p => p.id === packageId);
    if(!pkg) return { ok: false, msg: "Package not found" };

    if((G.studio ? G.studio.cash : G.cash) < pkg.rightsCost){
      return { ok: false, msg: "Insufficient capital: $" + pkg.rightsCost + "M required for rights acquisition." };
    }

    _modCash(G, -pkg.rightsCost);

    // Broadcast Tech Jumbotron Multiplier
    const jumbotronLvl = G.stadium.facilityLevels.broadcast_jumbotron || 1;
    const jumbotronBonus = jumbotronLvl === 3 ? 1.60 : jumbotronLvl === 2 ? 1.25 : 1.0;

    const actualAdRev = Math.round(pkg.adRevenueWeekly * jumbotronBonus * 100) / 100;
    const actualSubBump = Math.round(pkg.subBump * (1 + (jumbotronBonus - 1) * 0.5) * 10) / 10;

    const rightsRecord = {
      id: "sport_" + Date.now(),
      pkg: pkg,
      weeksLeft: pkg.durationWeeks,
      weeklyAdRev: actualAdRev,
      subBump: actualSubBump,
      whenWeek: G.week || 1
    };

    G.stadium.activeSportsPackages.push(rightsRecord);

    // Boost streamer subs if active
    if(G.streamer){
      G.streamer.subs = (G.streamer.subs || 10) + actualSubBump;
    }

    if(typeof log === "function"){
      log("🏆 Sports Rights Won: Acquired exclusive broadcast for " + pkg.name + "! +" + actualSubBump + "M Streaming Subs, +$" + actualAdRev + "M/wk Ad Revenue.", "gold");
    }

    return { ok: true, record: rightsRecord };
  }

  // 7. Weekly Stadium Tick
  function tickStadiumEngine(){
    const G = _getG();
    if(!G || !G.stadium || !G.stadium.facilityLevels) return;
    const st = G.stadium;

    // Calculate Weekly Revenue
    const seatLvl = st.facilityLevels.seating_capacity || 1;
    const vipLvl = st.facilityLevels.vip_skyboxes || 1;
    const concLvl = st.facilityLevels.concessions_court || 1;

    const seatRev = STADIUM_UPGRADES[0].levels[seatLvl - 1].weeklyTicketRev;
    const vipRev = STADIUM_UPGRADES[1].levels[vipLvl - 1].weeklyVipRev;
    const concRev = STADIUM_UPGRADES[2].levels[concLvl - 1].concessionMargin;

    let totalMatchdayRev = Math.round((seatRev + vipRev + concRev) * 100) / 100;

    // Active Sports Packages Weekly Ad Revenue
    let totalAdRev = 0;
    (st.activeSportsPackages || []).forEach(p => {
      totalAdRev += p.weeklyAdRev;
      p.weeksLeft--;
    });
    st.activeSportsPackages = (st.activeSportsPackages || []).filter(p => p.weeksLeft > 0);

    const netWeeklySportsCash = Math.round((totalMatchdayRev + totalAdRev) * 100) / 100;
    if(netWeeklySportsCash > 0){
      _modCash(G, netWeeklySportsCash);
    }
  }

  // 8. Interactive Modals
  function buySportsRightsModal(){
    const G = _getG();
    if(!G) return;
    _ensureStadiumState(G);

    let h = `
      <div class="modal-head">
        <h3>🏟 Live Sports Broadcast Rights &amp; Sports Deals</h3>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding-right:8px">
        <p class="small muted">Synthesized from <b>Idle Sports Stadium Tycoon</b>. Acquire global broadcast rights packages, stream live championship events, and boost streamer subscriptions &amp; weekly ad revenue.</p>

        <!-- Current Stadium Display -->
        <div class="card" style="margin-bottom:12px;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.3)">
          <div class="spread">
            <div>
              <b style="font-size:15px">🏟 ${G.stadium.namingDeal ? G.stadium.namingDeal.stadiumDisplayName : G.stadium.name}</b>
              <div class="tiny muted">${G.stadium.namingDeal ? "Sponsored by " + G.stadium.namingDeal.sponsor.sponsorName : "Naming Rights Available"}</div>
            </div>
            <button class="btn btn-sm btn-alt" onclick="SportsStadiumDeals.openStadiumManagementModal()">🏗 Manage Stadium Facilities</button>
          </div>
        </div>

        <!-- Available Broadcast Rights -->
        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:8px">Premier Sports Rights Packages</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${EXPANDED_SPORTS_PACKAGES.map(pkg => `
              <div style="background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:8px">
                <div class="spread" style="margin-bottom:4px">
                  <b>${pkg.icon} ${pkg.name}</b>
                  <span class="tag gold">${pkg.tier}</span>
                </div>
                <div class="tiny muted" style="margin-bottom:6px">${pkg.desc}</div>
                <div class="spread">
                  <div class="tiny" style="color:#38ef7d">
                    +${pkg.subBump}M Subs · +$${pkg.adRevenueWeekly}M/wk Ad Rev · ${pkg.durationWeeks} Wks
                  </div>
                  <button class="btn btn-sm btn-primary" onclick="SportsStadiumDeals.buySportsRightsPackage('${pkg.id}'); closeModal(); if(typeof render==='function')render();">
                    Bid &amp; Acquire ($${pkg.rightsCost}M)
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    `;

    openModal(h);
  }

  function openStadiumManagementModal(){
    const G = _getG();
    if(!G) return;
    _ensureStadiumState(G);

    let h = `
      <div class="modal-head">
        <h3>🏗 Stadium Complex Management (Idle Sports Tycoon)</h3>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding-right:8px">
        <p class="small muted">Upgrade seating, skyboxes, gourmet concessions, and broadcast jumbotrons to drive passive matchday cashflow.</p>

        <!-- Facilities List -->
        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:8px">Stadium Infrastructure Tiers</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${STADIUM_UPGRADES.map(f => {
              const currentLvl = G.stadium.facilityLevels[f.id] || 1;
              const currentTier = f.levels[currentLvl - 1];
              const nextTier = f.levels[currentLvl];
              return `
                <div style="background:rgba(255,255,255,0.04);padding:10px 12px;border-radius:8px">
                  <div class="spread" style="margin-bottom:4px">
                    <b>${f.name}</b>
                    <span class="tag cyan">Level ${currentLvl}: ${currentTier.cap}</span>
                  </div>
                  <div class="tiny muted" style="margin-bottom:6px">${f.desc}</div>
                  <div class="spread">
                    ${nextTier ? `
                      <span class="tiny" style="color:#d4af37">Next Tier: ${nextTier.cap} ($${nextTier.cost}M)</span>
                      <button class="btn btn-xs btn-alt" onclick="SportsStadiumDeals.upgradeFacility('${f.id}'); closeModal(); SportsStadiumDeals.openStadiumManagementModal(); if(typeof render==='function')render();">
                        Upgrade Tier
                      </button>
                    ` : `<span class="tag green tiny">MAX TIER REACHED</span>`}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Corporate Naming Rights -->
        <div class="card">
          <div class="small muted" style="margin-bottom:8px">Corporate Stadium Naming Rights Deals</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${NAMING_RIGHTS_SPONSORS.map(sp => `
              <div style="background:rgba(255,255,255,0.04);padding:8px 12px;border-radius:8px">
                <div class="spread" style="margin-bottom:3px">
                  <b>${sp.name}</b>
                  <span class="tag gold">+$${sp.annualPayout}M / Year</span>
                </div>
                <div class="tiny muted">${sp.blurb}</div>
                <div class="spread" style="margin-top:6px">
                  <span class="tiny muted">Requires ${sp.minRepRequired}+ Studio Rep</span>
                  <button class="btn btn-xs btn-alt" onclick="SportsStadiumDeals.signNamingRights('${sp.id}'); closeModal(); if(typeof render==='function')render();">
                    Sign Contract
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-primary" onclick="closeModal()">Close</button>
      </div>
    `;

    openModal(h);
  }

  // Export module
  const SportsStadiumDeals = {
    STADIUM_UPGRADES: STADIUM_UPGRADES,
    NAMING_RIGHTS_SPONSORS: NAMING_RIGHTS_SPONSORS,
    EXPANDED_SPORTS_PACKAGES: EXPANDED_SPORTS_PACKAGES,
    upgradeFacility: upgradeFacility,
    signNamingRights: signNamingRights,
    buySportsRightsPackage: buySportsRightsPackage,
    tickStadiumEngine: tickStadiumEngine,
    buySportsRightsModal: buySportsRightsModal,
    openStadiumManagementModal: openStadiumManagementModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = SportsStadiumDeals;
  }
  global.SportsStadiumDeals = SportsStadiumDeals;
  global.buySportsRightsModal = buySportsRightsModal;
  global.openStadiumManagementModal = openStadiumManagementModal;

})(typeof window !== "undefined" ? window : global);
