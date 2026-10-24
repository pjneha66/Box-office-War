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

  /* Streamlined vignette — the active 2D simulation canvas above serves as the hero stage */
  function renderVignette(sceneImg, actorLeft, actorRight, bubbleText, bubbleTheme, tagText) {
    return "";
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
        ${renderVignette(
          "assets/2d/kairo_executive_office.png",
          "assets/2d/char_director.png",
          "assets/2d/char_star_actor.png",
          "★ WAR CHEST",
          "gold",
          "HQ SUITE"
        )}

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
        ${renderVignette(
          "assets/2d/kairo_studio_campus.png",
          "assets/2d/char_cameraman.png",
          "assets/2d/char_director.png",
          "LOT EXPAND",
          "cyan",
          "STAGES"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge cyan">[CAMPUS OPERATIONS &amp; FACILITIES]</span>
            <span class="kairo-dept-subtag">BACKLOT LOT 1-12</span>
          </div>
          <div class="kairo-dept-title">HOLLYWOOD PRODUCTION CAMPUS &amp; STAGES</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">LOT FACILITIES</span>
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
        ${renderVignette(
          "assets/2d/kairo_writers_room.png",
          "assets/itch-avatars/Avatars_05.png",
          "assets/2d/char_director.png",
          "+15 SCRIPT!",
          "gold",
          "WRITERS"
        )}

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
        ${renderVignette(
          "assets/2d/kairo_soundstage.png",
          "assets/2d/char_cameraman.png",
          "assets/2d/char_star_actor.png",
          "ACTION!",
          "red",
          "STAGE A"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge red">[STAGE A &amp; SHOOTING FLOOR]</span>
            <span class="kairo-dept-subtag">LIVE SOUNDSTAGES</span>
          </div>
          <div class="kairo-dept-title">PRINCIPAL PHOTOGRAPHY &amp; SOUNDSTAGES</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">ACTIVE SHOOTS</span>
              <span class="k-val red">${activeShoots} Cameras Rolling</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">IN POST &amp; VFX</span>
              <span class="k-val cyan">${postProds} Cutting Rooms</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">TOTAL PIPELINE</span>
              <span class="k-val gold">${inProd.length} Slated</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof testScreeningsModal==='function')testScreeningsModal();">Test Screenings</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openProductionInsuranceModal==='function')openProductionInsuranceModal();">Production Bond</button>
          <button class="kairo-btn-action" onclick="switchTab('studiolot')">View Soundstage</button>
        </div>
      </div>
    `;
  }

  /* 5. BOX OFFICE: Cinema Palace & Marquee */
  function renderBoxOfficeBanner(G, st, calStr) {
    const liveFilms = (G.films || []).filter(f => (f.weeks || 0) <= 6);
    const topFilm = liveFilms.sort((a,b)=>(b.weeklyGross||0)-(a.weeklyGross||0))[0];

    return `
      <div class="kairo-dept-banner kairo-banner-boxoffice">
        ${renderVignette(
          "assets/2d/kairo_cinema_theater.png",
          "assets/2d/char_star_actor.png",
          "assets/2d/char_audience.png",
          "SOLD OUT! ★",
          "gold",
          "THEATERS"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge yellow">[CINEMA THEATER MARQUEE]</span>
            <span class="kairo-dept-subtag">TICKET SALES &amp; EXHIBITION</span>
          </div>
          <div class="kairo-dept-title">PREMIERE PALACE &amp; WEEKEND BOX OFFICE</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">FILMS IN THEATERS</span>
              <span class="k-val gold">${liveFilms.length} Screens</span>
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
          <button class="kairo-btn-action gold" onclick="if(typeof clashAnalyticsModal==='function')clashAnalyticsModal();">Weekend Grosses</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openTheaterChainsModal==='function')openTheaterChainsModal();">Theater Chains</button>
          <button class="kairo-btn-action" onclick="if(typeof festivalPrModal==='function')festivalPrModal();">Audience Screenings</button>
        </div>
      </div>
    `;
  }

  /* 6. FANS: Fan Club, Mail Room & Convention Hall */
  function renderFansBanner(G, st, calStr) {
    const unreadMail = (G.fanMail || []).filter(m => !m.read).length;
    const fanCount = G.fans || 45000;

    return `
      <div class="kairo-dept-banner kairo-banner-fans">
        ${renderVignette(
          "assets/2d/kairo_cinema_theater.png",
          "assets/2d/char_audience.png",
          "assets/itch-avatars/Avatars_03.png",
          "+5K FANS!",
          "cyan",
          "FAN CLUB"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge magenta">[FAN RELATIONS &amp; AUDIENCE]</span>
            <span class="kairo-dept-subtag">CONVENTION HALL &amp; MAILROOM</span>
          </div>
          <div class="kairo-dept-title">GLOBAL FANDOM &amp; BRAND LOYALTY</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">FAN BASE</span>
              <span class="k-val magenta">${fanCount.toLocaleString()} Devotees</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">UNREAD FAN MAIL</span>
              <span class="k-val yellow">${unreadMail} Letters</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">FAN EXCITEMENT</span>
              <span class="k-val green">Electric 98%</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openSocialControlModal==='function')openSocialControlModal();else if(typeof fanConventionModal==='function')fanConventionModal();">Social &amp; CineTok Blitz</button>
          <button class="kairo-btn-action blue" onclick="if(typeof fanConventionModal==='function')fanConventionModal();">Comic-Con Hall H</button>
          <button class="kairo-btn-action" onclick="if(typeof crisisPrModal==='function')crisisPrModal();">Crisis PR War Room</button>
        </div>
      </div>
    `;
  }

  /* 7. OTT: Streaming Network Operations Center */
  function renderOttBanner(G, st, calStr) {
    const streamer = G.streamer || null;
    const subs = streamer ? (streamer.subs || 0) : 0;
    const rev = streamer ? (streamer.revenueWeekly || 0) : 0;

    return `
      <div class="kairo-dept-banner kairo-banner-ott">
        ${renderVignette(
          "assets/2d/kairo_post_suite.png",
          "assets/itch-avatars/Avatars_09.png",
          "assets/2d/char_director.png",
          "4K STREAM",
          "cyan",
          "NOC CLOUD"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge cyan">[STREAMING NETWORK NOC]</span>
            <span class="kairo-dept-subtag">GLOBAL CONTENT PIPELINE</span>
          </div>
          <div class="kairo-dept-title">ON-DEMAND OTT &amp; BINGE SERIES HUB</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">SUBSCRIBER BASE</span>
              <span class="k-val cyan">${subs > 0 ? (subs/1000000).toFixed(1) + "M Subs" : "Launch Streamer"}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">MONTHLY REVENUE</span>
              <span class="k-val green">${fmtM(rev * 4)}</span>
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
          <button class="kairo-btn-action gold" onclick="if(typeof startSeriesWizard==='function')startSeriesWizard();">Series Pitch</button>
          <button class="kairo-btn-action blue" onclick="if(typeof shopToStreamersModal==='function')shopToStreamersModal();">Streamer Auction</button>
          <button class="kairo-btn-action" onclick="if(typeof openStreamerTierModal==='function')openStreamerTierModal();">Manage Platform</button>
        </div>
      </div>
    `;
  }

  /* 8. LIVE TV: Broadcast Studio & Master Control Room */
  function renderLiveBanner(G, st, calStr) {
    const liveSubs = G.liveTvSubs || 0;

    return `
      <div class="kairo-dept-banner kairo-banner-live">
        ${renderVignette(
          "assets/2d/kairo_soundstage.png",
          "assets/2d/char_cameraman.png",
          "assets/itch-avatars/Avatars_02.png",
          "● ON AIR",
          "red",
          "CONTROL"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge red">[LIVE MASTER CONTROL]</span>
            <span class="kairo-dept-subtag">BROADCAST NETWORK</span>
          </div>
          <div class="kairo-dept-title">24/7 LIVE SATELLITE &amp; LINEAR TELEVISION</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">BROADCAST REACH</span>
              <span class="k-val red">${liveSubs > 0 ? (liveSubs/1000).toFixed(0)+"K" : "Linear Network"}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">SIGNAL STATUS</span>
              <span class="k-val green">1080p Satellite Synced</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">COMMERCIAL TIME</span>
              <span class="k-val gold">Premium CPMs</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof buySportsRightsModal==='function')buySportsRightsModal();">Live Sports Rights</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openStadiumManagementModal==='function')openStadiumManagementModal();else if(typeof syndicationModal==='function')syndicationModal();">Stadium &amp; Arena Hub</button>
          <button class="kairo-btn-action" onclick="if(typeof tvUpfrontsModal==='function')tvUpfrontsModal();">Ad Upfronts</button>
        </div>
      </div>
    `;
  }

  /* 9. EMPIRE: Media Conglomerate & Theme Parks */
  function renderEmpireBanner(G, st, calStr) {
    const franchises = G.franchises || [];
    const frCount = franchises.length;

    return `
      <div class="kairo-dept-banner kairo-banner-empire">
        ${renderVignette(
          "assets/2d/kairo_studio_campus.png",
          "assets/2d/char_director.png",
          "assets/itch-avatars/Avatars_01.png",
          "EMPIRE",
          "gold",
          "CONGLOM"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge gold">[MEDIA CONGLOMERATE]</span>
            <span class="kairo-dept-subtag">EXPEDITIONS &amp; PARKS</span>
          </div>
          <div class="kairo-dept-title">GLOBAL ENTERTAINMENT EMPIRE &amp; LICENSING</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">ACTIVE FRANCHISES</span>
              <span class="k-val gold">${frCount} Universes</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">THEME PARK ATTRACTIONS</span>
              <span class="k-val green">World Class</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">MERCHANDISE HEAT</span>
              <span class="k-val yellow">Global Supply</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof cinematicUniverseModal==='function')cinematicUniverseModal();">Cinematic Universe</button>
          <button class="kairo-btn-action blue" onclick="if(typeof merchLicensingModal==='function')merchLicensingModal();">Toy &amp; Merch Deals</button>
          <button class="kairo-btn-action" onclick="if(typeof dynastyLegacyModal==='function')dynastyLegacyModal();">Dynasty &amp; Trust</button>
        </div>
      </div>
    `;
  }

  /* 10. LIBRARY: Film Vault & Restorations */
  function renderLibraryBanner(G, st, calStr) {
    const films = G.films || [];
    const libraryFilms = films.filter(f => (f.weeks || 0) > 6);
    const catalogVal = libraryFilms.reduce((s, f) => s + (f.ww || 0) * 0.12, 0);

    return `
      <div class="kairo-dept-banner kairo-banner-library">
        ${renderVignette(
          "assets/2d/kairo_post_suite.png",
          "assets/itch-avatars/Avatars_12.png",
          "assets/2d/char_director.png",
          "4K VAULT",
          "cyan",
          "ARCHIVE"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge purple">[HERITAGE FILM VAULT]</span>
            <span class="kairo-dept-subtag">CATALOG PRESERVATION</span>
          </div>
          <div class="kairo-dept-title">HISTORICAL FILM ARCHIVE &amp; 4K REMASTERING</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">VAULTED TITLES</span>
              <span class="k-val purple">${libraryFilms.length} Classics</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CATALOG VALUATION</span>
              <span class="k-val green">${fmtM(catalogVal)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">MASTER PRESERVATION</span>
              <span class="k-val gold">Acetate &amp; Dolby 4K</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof filmRestorationModal==='function')filmRestorationModal();">4K UHD Remaster</button>
          <button class="kairo-btn-action blue" onclick="if(typeof territoryLicensingModal==='function')territoryLicensingModal();">Territory Rights</button>
          <button class="kairo-btn-action" onclick="if(typeof bondMarketModal==='function')bondMarketModal();">IP Securitization</button>
        </div>
      </div>
    `;
  }

  /* 11. GAMES: 8-Phase GDD Development Studio */
  function renderGamesBanner(G, st, calStr) {
    const games = G.gameStudioGames || [];
    const shipped = games.filter(g => g.shipped).length;

    return `
      <div class="kairo-dept-banner kairo-banner-games">
        ${renderVignette(
          "assets/2d/kairo_writers_room.png",
          "assets/itch-avatars/Avatars_15.png",
          "assets/itch-avatars/Avatars_22.png",
          "8-BIT GDD",
          "gold",
          "DEV LAB"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge green">[KAIROSOFT GAME DEV STORY]</span>
            <span class="kairo-dept-subtag">CONSOLE &amp; PC LAB</span>
          </div>
          <div class="kairo-dept-title">GAME STUDIO — 8-PHASE GDD PRODUCTION</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">TITLES SHIPPED</span>
              <span class="k-val green">${shipped} Games</span>
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
          <button class="kairo-btn-action gold" onclick="if(typeof openGddModal==='function')openGddModal();">Greenlight GDD Game</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openEngineBuilderModal==='function')openEngineBuilderModal();else if(typeof consoleDevKitModal==='function')consoleDevKitModal();">Engine &amp; Hardware</button>
          <button class="kairo-btn-action" onclick="if(typeof talentSabbaticalModal==='function')talentSabbaticalModal();">Send on Sabbatical</button>
        </div>
      </div>
    `;
  }

  /* 12. FINANCE: Corporate Treasury & Wall Street Ledger */
  /* v38.0: this banner used to print two string literals for every studio —
     `const profitMargin = 34.8` and a fixed "AAA Investment" grade — so a
     studio with $3M of cash, $900M of debt and reputation 8 was told it had a
     prime investment-grade balance sheet and a 34.8% return. All three action
     buttons were wired to bondMarketModal / ipoModal / cfoOfficeModal, none of
     which have ever existed, so they failed silently behind typeof guards.
     Every figure below is now read from the live career, and every button
     routes to a function that exists. The Treasury Desk (ui.js) owns the
     Finance tab's own heading; this banner is kept honest for any surface that
     still asks KairoTheme for it. */
  function renderFinanceBanner(G, st, calStr) {
    const debt = (st.debt || 0) + (st.mezzDebt || 0);

    /* Credit grade: read from the bond market's own rating function. */
    let grade = "\u2014", gradeName = "Not rated";
    try {
      const rateFn = (typeof getStudioCreditRating === "function") ? getStudioCreditRating
        : (typeof BondMarketModule !== "undefined" && BondMarketModule && typeof BondMarketModule.getStudioCreditRating === "function") ? BondMarketModule.getStudioCreditRating
        : (typeof FinanceDesk !== "undefined" && FinanceDesk ? null : null);
      if (rateFn) { const r = rateFn(G); if (r) { grade = r.grade; gradeName = r.name; } }
      else if (typeof FinanceDesk !== "undefined" && FinanceDesk && typeof FinanceDesk.creditRating === "function") {
        const r = FinanceDesk.creditRating(G); if (r) { grade = r.grade; gradeName = r.name; }
      }
    } catch (e) { grade = "\u2014"; gradeName = "Not rated"; }

    /* Margin: the trailing ledger, or an honest dash when there is no revenue. */
    let marginText = "\u2014", marginClass = "";
    try {
      if (typeof FinanceDesk !== "undefined" && FinanceDesk && typeof FinanceDesk.ledgerTrail === "function") {
        const t = FinanceDesk.ledgerTrail(G, 12);
        if (t && t.weeks > 0 && t.R > 0) {
          marginText = (t.margin >= 0 ? "+" : "\u2212") + Math.abs(t.margin) + "% net";
          marginClass = t.margin >= 0 ? "green" : "red";
        } else if (t && t.weeks > 0) {
          marginText = "no revenue";
          marginClass = "red";
        }
      }
    } catch (e) { marginText = "\u2014"; }

    const gradeClass = (grade === "AAA" || grade === "AA" || grade === "BBB") ? "gold" : "red";

    return `
      <div class="kairo-dept-banner kairo-banner-finance">
        ${renderVignette(
          "assets/2d/kairo_executive_office.png",
          "assets/itch-avatars/Avatars_07.png",
          "assets/2d/char_director.png",
          "+$$$ CASH",
          "gold",
          "TREASURY"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge gold">[WALL STREET &amp; TREASURY]</span>
            <span class="kairo-dept-subtag">${gradeName}</span>
          </div>
          <div class="kairo-dept-title">CORPORATE TREASURY &amp; CAPITAL ALLOCATION</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">LIQUID RESERVES</span>
              <span class="k-val green">${fmtM(st.cash)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">CORPORATE DEBT</span>
              <span class="k-val red">${fmtM(debt)}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">BOND RATING</span>
              <span class="k-val ${gradeClass}">${grade}</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">TRAILING 12-WK MARGIN</span>
              <span class="k-val ${marginClass || "cyan"}">${marginText}</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof openBondMarketModal==='function')openBondMarketModal();else if(typeof switchTab==='function')switchTab('finance');">Corporate Bonds</button>
          <button class="kairo-btn-action blue" onclick="if(typeof switchTab==='function'&&typeof financeSet==='function'){switchTab('finance');financeSet({sub:'ledger'});}else if(typeof switchTab==='function')switchTab('finance');">P&amp;L Ledger</button>
          <button class="kairo-btn-action" onclick="if(typeof switchTab==='function'&&typeof financeSet==='function'){switchTab('finance');financeSet({sub:'capital'});}else if(typeof switchTab==='function')switchTab('finance');">Capital &amp; Debt</button>
        </div>
      </div>
    `;
  }

  /* 13. NOTIFICATIONS: Studio Wire & Teletype Feed */
  function renderNotificationsBanner(G, st, calStr) {
    const unreadCount = (G.notifications || []).filter(n => !n.read).length;

    return `
      <div class="kairo-dept-banner kairo-banner-notifications">
        ${renderVignette(
          "assets/2d/kairo_writers_room.png",
          "assets/itch-avatars/Avatars_18.png",
          "assets/2d/char_cameraman.png",
          "STUDIO WIRE",
          "cyan",
          "NEWS DESK"
        )}

        <div class="kairo-dept-info">
          <div class="kairo-badge-row">
            <span class="kairo-dept-badge blue">[HOLLYWOOD DISPATCH &amp; TELETYPE]</span>
            <span class="kairo-dept-subtag">WIRE TRANSMISSIONS</span>
          </div>
          <div class="kairo-dept-title">STUDIO INTELLIGENCE &amp; WIRE NOTIFICATIONS</div>
          <div class="kairo-stats-strip">
            <div class="kairo-stat-chip">
              <span class="k-lbl">DISPATCH QUEUE</span>
              <span class="k-val yellow">${unreadCount} Unread Wires</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">PRIORITY LEVEL</span>
              <span class="k-val red">FLASH ALERT</span>
            </div>
            <div class="kairo-stat-chip">
              <span class="k-lbl">TELETYPE STATUS</span>
              <span class="k-val green">Real-Time Sync</span>
            </div>
          </div>
        </div>

        <div class="kairo-dept-actions">
          <button class="kairo-btn-action gold" onclick="if(typeof markAllNotificationsRead==='function')markAllNotificationsRead();">Clear Wires</button>
          <button class="kairo-btn-action blue" onclick="if(typeof openStudioEspionageModal==='function')openStudioEspionageModal();">Studio Espionage</button>
        </div>
      </div>
    `;
  }

  // Export to global scope
  global.KairoTheme = KairoTheme;

})(typeof window !== "undefined" ? window : globalThis);
