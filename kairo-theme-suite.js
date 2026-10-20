/* ═════════════════════════════════════════════════════════════════════════
   KAIRO-THEME-SUITE.JS — Authentic 16-Bit Kairosoft Department Visual Suite
   Box Office War — Animated Simulation Headers & Pixel Department Banners
   Zero Emojis Policy strictly enforced.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){

  function esc(s){
    if(s==null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function fmtM(n){
    if(typeof window.fmtM === "function") return window.fmtM(n);
    return "$" + (Math.round((n || 0) * 10) / 10).toFixed(1) + "M";
  }

  const KairoTheme = {
    renderBanner(tab, subtab) {
      const G = typeof window !== "undefined" ? window.G : null;
      if (!G || !G.studio) return "";

      const st = G.studio;
      const yr = (typeof window.yearOf === "function" && G.week) ? window.yearOf(G.week) : 1;
      const woy = (typeof window.woyOf === "function" && G.week) ? window.woyOf(G.week) : 1;
      const calStr = "Y" + yr + " · W" + woy;

      switch(tab) {
        case "dashboard":
          return renderDashboardBanner(G, st, calStr);
        case "studio":
          return renderStudioBanner(G, st, calStr);
        case "develop":
          return renderDevelopBanner(G, st, calStr, subtab);
        case "productions":
          return renderProductionsBanner(G, st, calStr, subtab);
        case "boxoffice":
          return renderBoxOfficeBanner(G, st, calStr);
        case "fans":
          return renderFansBanner(G, st, calStr);
        case "ott":
          return renderOttBanner(G, st, calStr);
        case "live":
          return renderLiveBanner(G, st, calStr);
        case "empire":
          return renderEmpireBanner(G, st, calStr);
        case "library":
          return renderLibraryBanner(G, st, calStr);
        case "games":
          return renderGamesBanner(G, st, calStr);
        case "finance":
          return renderFinanceBanner(G, st, calStr);
        case "notifications":
          return renderNotificationsBanner(G, st, calStr);
        default:
          return "";
      }
    }
  };

  /* 1. DASHBOARD: Executive Penthouse & Boardroom */
  function renderDashboardBanner(G, st, calStr) {
    const liveFilms = (G.films || []).filter(f => (f.weeks || 0) <= 6).length;
    const inProd = (G.projects || []).filter(p => p.phase !== "ready").length;
    const totalWW = (G.films || []).reduce((sum, f) => sum + (f.ww || 0), 0);

    return `
      <div class="kairo-dept-banner kairo-banner-dashboard">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-boardroom">
            <div class="kairo-pixel-desk"></div>
            <div class="kairo-pixel-chair kairo-bob"></div>
            <div class="kairo-pixel-trophy kairo-glint"></div>
            <div class="kairo-pixel-window">
              <div class="kairo-pixel-cityline"></div>
            </div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge gold">[HQ EXECUTIVE BOARDROOM]</span>
            <span class="kairo-dept-subtag">CENTRAL COMMAND</span>
          </div>
          <div class="kairo-dept-title">${esc(st.name)} PENTHOUSE SUITE</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">WAR CHEST</span>
              <span class="k-val green">${fmtM(st.cash)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CALENDAR</span>
              <span class="k-val gold">${calStr}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">STUDIO PRESTIGE</span>
              <span class="k-val cyan">Tier ${Math.round(st.rep || 1)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">IN PRODUCTION</span>
              <span class="k-val yellow">${inProd} Projects</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CAREER GROSS</span>
              <span class="k-val blue">${fmtM(totalWW)} WW</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof developModal==='function')developModal();">+ Greenlight Film</button>
          <button class="kairo-btn-action blue" onclick="if(typeof talentModal==='function')talentModal();">Hire Talent</button>
          <button class="kairo-btn-action" onclick="switchTab('studiolot')">2D Studio Lot</button>
        </div>
      </div>
    `;
  }

  /* 2. STUDIO: Hollywood Campus & Backlot Facilities */
  function renderStudioBanner(G, st, calStr) {
    const facilities = G.facilities || [];
    const facilityCount = facilities.length || 6;

    return `
      <div class="kairo-dept-banner kairo-banner-studio">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-studio">
            <div class="kairo-pixel-gate"></div>
            <div class="kairo-pixel-watertower"></div>
            <div class="kairo-pixel-golfcart kairo-drive"></div>
            <div class="kairo-pixel-crane kairo-crane-swing"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge cyan">[CAMPUS OPERATIONS &amp; FACILITIES]</span>
            <span class="kairo-dept-subtag">BACKLOT LOT 1-12</span>
          </div>
          <div class="kairo-dept-title">HOLLYWOOD BACKLOT &amp; SOUNDSTAGE EXPANSION</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">LOT FOOTPRINT</span>
              <span class="k-val gold">24x24 Acres</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">ACTIVE STAGES</span>
              <span class="k-val green">${facilityCount} Stages &amp; Suites</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">STUDIO POWER</span>
              <span class="k-val cyan">100% Operational</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">LOT MORALE</span>
              <span class="k-val yellow">96% High Energy</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="switchTab('studiolot')">Enter 2D Lot World</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openStudioFacilitiesModal==='function')openStudioFacilitiesModal();">Upgrade Facilities</button>
          <button class="kairo-btn-action" onclick="if(typeof talentModal==='function')talentModal();">Roster &amp; Crew</button>
        </div>
      </div>
    `;
  }

  /* 3. DEVELOP: Writers Room & Script Development Lab */
  function renderDevelopBanner(G, st, calStr, subtab) {
    const ideas = G.ideas || [];
    const writers = (G.talent || []).filter(t => t.kind === "writer");
    const subLabel = subtab === "scripts" ? "SCREENPLAY WORKSHOP" :
                     subtab === "demographics" ? "DIAL TEST AUDIENCES" :
                     subtab === "creativity" ? "LENSES &amp; REMAKE VAULT" :
                     subtab === "ip" ? "LITERARY IP MARKET" :
                     subtab === "talent" ? "TALENT AGENCY RELATIONS" :
                     subtab === "combos" ? "GENRE &amp; SCALE CODEX" : "TAX REBATES &amp; CO-PRO";

    return `
      <div class="kairo-dept-banner kairo-banner-develop">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-writers">
            <div class="kairo-pixel-corkboard"></div>
            <div class="kairo-pixel-typewriter kairo-type-clatter"></div>
            <div class="kairo-pixel-coffeepot">
              <div class="kairo-pixel-steam kairo-steam-rise"></div>
            </div>
            <div class="kairo-pixel-writer kairo-bob"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge blue">[WRITERS BUNGALOW]</span>
            <span class="kairo-dept-subtag">${subLabel}</span>
          </div>
          <div class="kairo-dept-title">STORY DEVELOPMENT &amp; SCREENPLAY LAB</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">ACTIVE IDEAS</span>
              <span class="k-val gold">${ideas.length} Drafts</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">AVAILABLE WRITERS</span>
              <span class="k-val cyan">${writers.length} Scribes</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CREATIVE SYNERGY</span>
              <span class="k-val green">94% Brainstorm</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">INDUSTRY TRENDS</span>
              <span class="k-val yellow">Active Shift</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof developModal==='function')developModal();">+ Greenlight Pitch</button>
          <button class="kairo-btn-action blue" onclick="if(typeof buyScriptModal==='function')buyScriptModal();">Acquire Spec Script</button>
          <button class="kairo-btn-action" onclick="if(typeof openAgencyPackagingModal==='function')openAgencyPackagingModal();">CAA/WME Package</button>
        </div>
      </div>
    `;
  }

  /* 4. PRODUCTIONS: Active Soundstage & Filming Sets */
  function renderProductionsBanner(G, st, calStr, subtab) {
    const inProd = (G.projects || []).filter(p => p.phase !== "ready");
    const activeShoots = inProd.filter(p => p.phase === "shoot" || p.phase === "reshoot").length;
    const postProds = inProd.filter(p => p.phase === "post").length;

    return `
      <div class="kairo-dept-banner kairo-banner-productions">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-soundstage">
            <div class="kairo-pixel-lighttruss"></div>
            <div class="kairo-pixel-cameradolly kairo-dolly-roll"></div>
            <div class="kairo-pixel-tallylight kairo-tally-blink"></div>
            <div class="kairo-pixel-boommic kairo-boom-bob"></div>
            <div class="kairo-pixel-director kairo-bob"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge red">[STAGE RECORDING &amp; SLATE]</span>
            <span class="kairo-dept-subtag">LIVE ON-AIR</span>
          </div>
          <div class="kairo-dept-title">SOUNDSTAGE 1 — ACTIVE FILM PRODUCTIONS</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">ROLLING CAMERAS</span>
              <span class="k-val red">${activeShoots} Filming</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">POST &amp; VFX BAY</span>
              <span class="k-val cyan">${postProds} Cutting</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">STAGE SCHEDULE</span>
              <span class="k-val gold">${inProd.length} Total Projects</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">DIRECTOR MORALE</span>
              <span class="k-val green">100% In The Zone</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof calendarModal==='function')calendarModal();">Release Calendar</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openLocationScoutingModal==='function')openLocationScoutingModal();">Location Scouting</button>
          <button class="kairo-btn-action" onclick="if(typeof openInsuranceModal==='function')openInsuranceModal();">Production Insurance</button>
        </div>
      </div>
    `;
  }

  /* 5. BOX OFFICE: Grand Cinema Marquee & Red Carpet Premiere */
  function renderBoxOfficeBanner(G, st, calStr) {
    const films = G.films || [];
    const inTheaters = films.filter(f => (f.weeks || 0) <= 6);
    const topFilm = inTheaters.slice().sort((a,b) => (b.grossDom || 0) - (a.grossDom || 0))[0] || null;

    return `
      <div class="kairo-dept-banner kairo-banner-boxoffice">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-cinema">
            <div class="kairo-pixel-marquee kairo-marquee-glow">
              <div class="kairo-pixel-chaser"></div>
            </div>
            <div class="kairo-pixel-redcarpet"></div>
            <div class="kairo-pixel-crowd kairo-crowd-cheer"></div>
            <div class="kairo-pixel-popcorn kairo-popcorn-burst"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge gold">[CINEMA THEATER MARQUEE]</span>
            <span class="kairo-dept-subtag">TICKET SALES &amp; EXHIBITION</span>
          </div>
          <div class="kairo-dept-title">PREMIERE PALACE &amp; WEEKEND BOX OFFICE</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">FILMS IN THEATERS</span>
              <span class="k-val gold">${inTheaters.length} Screens</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">TOP MARQUEE</span>
              <span class="k-val cyan">${topFilm ? esc(topFilm.title) : "Sold Out"}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">AUDIENCE BUZZ</span>
              <span class="k-val green">A+ CinemaScore</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">MARKET SHARE</span>
              <span class="k-val yellow">Industry Leading</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof boxOfficeModal==='function')boxOfficeModal();">Weekend Grosses</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openTheaterChainsModal==='function')openTheaterChainsModal();">Theater Chains</button>
          <button class="kairo-btn-action" onclick="if(typeof openTestScreeningModal==='function')openTestScreeningModal();">Audience Screenings</button>
        </div>
      </div>
    `;
  }

  /* 6. FANS: Comic-Con Hall H & Fan Mailroom */
  function renderFansBanner(G, st, calStr) {
    const unread = (G.mail || []).filter(m => !m.read).length;
    const totalFans = (G.fanbase || (st.rep * 125000)) || 250000;

    return `
      <div class="kairo-dept-banner kairo-banner-fans">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-fans">
            <div class="kairo-pixel-stage"></div>
            <div class="kairo-pixel-fanposters kairo-wave"></div>
            <div class="kairo-pixel-mailbags"></div>
            <div class="kairo-pixel-cosplay kairo-bob"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge magenta">[COMIC-CON &amp; FANDOM]</span>
            <span class="kairo-dept-subtag">COMMUNITY RELATIONS</span>
          </div>
          <div class="kairo-dept-title">HALL H STAGE &amp; FAN MAIL ARCHIVE</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">DEVOTED FANDOM</span>
              <span class="k-val magenta">${Math.round(totalFans).toLocaleString()} Fans</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">UNREAD MAIL</span>
              <span class="k-val yellow">${unread} Letters</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">FAN FIDELITY</span>
              <span class="k-val green">99% Devotion</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">VIRAL HEAT</span>
              <span class="k-val cyan">Trending Globally</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openFanConventionModal==='function')openFanConventionModal();">Host Convention</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openFestivalModal==='function')openFestivalModal();">Film Festival PR</button>
          <button class="kairo-btn-action" onclick="if(typeof markAllMailRead==='function')markAllMailRead();">Sort All Mail</button>
        </div>
      </div>
    `;
  }

  /* 7. OTT & SERIES: Streaming Network NOC & Global Server Bay */
  function renderOttBanner(G, st, calStr) {
    const subs = G.streamer ? (G.streamer.subs || 0) : 0;
    const rev = G.streamer ? (G.streamer.monthlyRev || 0) : 0;

    return `
      <div class="kairo-dept-banner kairo-banner-ott">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-ott">
            <div class="kairo-pixel-serverrack">
              <div class="kairo-pixel-leds kairo-server-blink"></div>
            </div>
            <div class="kairo-pixel-satellite kairo-satellite-ping"></div>
            <div class="kairo-pixel-streamflow"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge cyan">[STREAMING NETWORK NOC]</span>
            <span class="kairo-dept-subtag">GLOBAL CONTENT PIPELINE</span>
          </div>
          <div class="kairo-dept-title">ON-DEMAND OTT &amp; BINGE SERIES HUB</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">SUBSCRIBER BASE</span>
              <span class="k-val cyan">${subs ? (subs.toFixed(1) + "M Subs") : "Launch Streamer"}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">MONTHLY REVENUE</span>
              <span class="k-val green">${fmtM(rev)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">UPTIME</span>
              <span class="k-val gold">99.99% Cloud SLA</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CONTENT VAULT</span>
              <span class="k-val yellow">4K Dolby Vision</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof streamerPitchModal==='function')streamerPitchModal();">Series Pitch</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openAuctionModal==='function')openAuctionModal();">Streamer Auction</button>
          <button class="kairo-btn-action" onclick="if(typeof launchStreamerModal==='function')launchStreamerModal();">Manage Platform</button>
        </div>
      </div>
    `;
  }

  /* 8. LIVE TV: Television Broadcast Control Room */
  function renderLiveBanner(G, st, calStr) {
    return `
      <div class="kairo-dept-banner kairo-banner-live">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-live">
            <div class="kairo-pixel-crtmonitors kairo-scanline"></div>
            <div class="kairo-pixel-audiomixer kairo-fader-bounce"></div>
            <div class="kairo-pixel-livebeacon kairo-tally-blink"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge red">[LIVE TELEVISION CONTROL]</span>
            <span class="kairo-dept-subtag">PRIME-TIME BROADCAST</span>
          </div>
          <div class="kairo-dept-title">BROADCAST MASTHEAD &amp; SYNDICATION BAY</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">PRIME-TIME SHARE</span>
              <span class="k-val red">24.2 Rating</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">AFFILIATE REACH</span>
              <span class="k-val gold">210 Markets</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">BROADCAST STATUS</span>
              <span class="k-val green">ON AIR LIVE</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">AD REVENUE</span>
              <span class="k-val yellow">$2.4M / Show</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof launchLiveBroadcast==='function')launchLiveBroadcast();">Broadcast Special</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openSyndicationModal==='function')openSyndicationModal();">TV Syndication</button>
          <button class="kairo-btn-action" onclick="if(typeof openCrisesWarRoomModal==='function')openCrisesWarRoomModal();">Crisis War Room</button>
        </div>
      </div>
    `;
  }

  /* 9. EMPIRE: Franchise Theme Park & Merchandising Factory */
  function renderEmpireBanner(G, st, calStr) {
    const franchises = G.franchises || [];

    return `
      <div class="kairo-dept-banner kairo-banner-empire">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-empire">
            <div class="kairo-pixel-castle"></div>
            <div class="kairo-pixel-coaster kairo-coaster-climb"></div>
            <div class="kairo-pixel-factorybelt kairo-conveyor-roll"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge purple">[FRANCHISE EMPIRE &amp; RESORTS]</span>
            <span class="kairo-dept-subtag">GLOBAL LICENSING</span>
          </div>
          <div class="kairo-dept-title">THEME PARK RESORT &amp; TOY MERCH FACTORY</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">ACTIVE UNIVERSES</span>
              <span class="k-val purple">${franchises.length} Franchises</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">PARK ATTRACTIONS</span>
              <span class="k-val gold">Thrill Level 5</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">MERCH PIPELINE</span>
              <span class="k-val green">Global Retail</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">LICENSING VAL</span>
              <span class="k-val cyan">Multi-Year Deals</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openUniverseModal==='function')openUniverseModal();">Build Universe</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openMerchModal==='function')openMerchModal();">Merch Licensing</button>
          <button class="kairo-btn-action" onclick="if(typeof openTerritoryModal==='function')openTerritoryModal();">Territory Rights</button>
        </div>
      </div>
    `;
  }

  /* 10. LIBRARY: Master Film Vault & 4K Restoration Lab */
  function renderLibraryBanner(G, st, calStr) {
    const films = G.films || [];
    const catVal = typeof window.catalogValue === "function" ? window.catalogValue() : (films.length * 8.5);

    return `
      <div class="kairo-dept-banner kairo-banner-library">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-library">
            <div class="kairo-pixel-vaultdoor"></div>
            <div class="kairo-pixel-filmcans"></div>
            <div class="kairo-pixel-restorescanner">
              <div class="kairo-pixel-laser kairo-laser-sweep"></div>
            </div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge gold">[MASTER ARCHIVAL VAULT]</span>
            <span class="kairo-dept-subtag">4K DIGITAL PRESERVATION</span>
          </div>
          <div class="kairo-dept-title">HISTORIC CATALOG &amp; FILM RESTORATION LAB</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">CATALOG VALUE</span>
              <span class="k-val gold">${fmtM(catVal)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">VAULTED TITLES</span>
              <span class="k-val cyan">${films.length} Classics</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">PRESERVATION</span>
              <span class="k-val green">100% Nitrate Safe</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">ANNUAL ROYALTIES</span>
              <span class="k-val yellow">Perpetual Cashflow</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openRestorationModal==='function')openRestorationModal();">4K Remaster</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openSyndicationModal==='function')openSyndicationModal();">Syndicate Catalog</button>
          <button class="kairo-btn-action" onclick="if(typeof calendarModal==='function')calendarModal();">Re-Release Date</button>
        </div>
      </div>
    `;
  }

  /* 11. GAMES: Game Dev Story Studio */
  function renderGamesBanner(G, st, calStr) {
    const games = G.games || [];
    const launched = games.filter(g => g.shipped);

    return `
      <div class="kairo-dept-banner kairo-banner-games">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-games">
            <div class="kairo-pixel-devcubicle"></div>
            <div class="kairo-pixel-crtgame">
              <div class="kairo-pixel-sprite kairo-sprite-jump"></div>
            </div>
            <div class="kairo-pixel-gamepad"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge green">[KAIROSOFT GAME DEV STORY]</span>
            <span class="kairo-dept-subtag">CONSOLE &amp; PC LAB</span>
          </div>
          <div class="kairo-dept-title">GAME STUDIO — 8-PHASE GDD PRODUCTION</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">TITLES SHIPPED</span>
              <span class="k-val green">${launched.length} Games</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">DEV ENGINE</span>
              <span class="k-val cyan">16-Bit Pixel Engine</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">COMMUNITY SCORE</span>
              <span class="k-val gold">92/100 Masterpiece</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">LIVE OPS</span>
              <span class="k-val yellow">Seasonal Passports</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openGddPitchModal==='function')openGddPitchModal();">Greenlight GDD Game</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openDevKitModal==='function')openDevKitModal();">Hardware Licenses</button>
          <button class="kairo-btn-action" onclick="if(typeof openSabbaticalModal==='function')openSabbaticalModal();">Send on Sabbatical</button>
        </div>
      </div>
    `;
  }

  /* 12. FINANCE: Wall Street Treasury Vault */
  function renderFinanceBanner(G, st, calStr) {
    const debt = st.debt || 0;
    const cash = st.cash || 0;

    return `
      <div class="kairo-dept-banner kairo-banner-finance">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-finance">
            <div class="kairo-pixel-goldvault kairo-gold-shine"></div>
            <div class="kairo-pixel-ledgermachine"></div>
            <div class="kairo-pixel-stockchart">
              <div class="kairo-pixel-trendline kairo-ticker-up"></div>
            </div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge gold">[WALL STREET &amp; TREASURY]</span>
            <span class="kairo-dept-subtag">WAR CHEST RESERVES</span>
          </div>
          <div class="kairo-dept-title">CORPORATE TREASURY &amp; CAPITAL ALLOCATION</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">LIQUID RESERVES</span>
              <span class="k-val green">${fmtM(cash)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CORPORATE DEBT</span>
              <span class="k-val red">${fmtM(debt)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">BOND RATING</span>
              <span class="k-val gold">AAA Investment</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">PROFIT MARGIN</span>
              <span class="k-val cyan">+34.8% RoIC</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openBondMarketModal==='function')openBondMarketModal();">Corporate Bonds</button>
          <button class="kairo-btn-action blue" onclick="if(typeof financeOverviewSheet==='function')financeOverviewSheet();">P&amp;L Statements</button>
          <button class="kairo-btn-action" onclick="if(typeof openCSuiteModal==='function')openCSuiteModal();">CFO Operations</button>
        </div>
      </div>
    `;
  }

  /* 13. NOTIFICATIONS: Studio Teletype & Press Dispatch */
  function renderNotificationsBanner(G, st, calStr) {
    return `
      <div class="kairo-dept-banner kairo-banner-notifs">
        <div class="kairo-dept-vignette">
          <div class="kairo-anim-notifs">
            <div class="kairo-pixel-teletype kairo-teletype-print"></div>
            <div class="kairo-pixel-newsbell kairo-bell-ring"></div>
          </div>
        </div>

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge yellow">[STUDIO TELETYPE DISPATCH]</span>
            <span class="kairo-dept-subtag">WIRE PRESS</span>
          </div>
          <div class="kairo-dept-title">HOLLYWOOD INTELLIGENCE &amp; WIRE NOTICES</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">WIRE STATUS</span>
              <span class="k-val green">Active Feed</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">TELEGRAMS</span>
              <span class="k-val gold">Real-Time Alerts</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action blue" onclick="if(typeof clearNotifications==='function')clearNotifications();">Acknowledge All</button>
        </div>
      </div>
    `;
  }

  global.KairoTheme = KairoTheme;

})(typeof window !== "undefined" ? window : global);
