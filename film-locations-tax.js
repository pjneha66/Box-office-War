/* ═════════════════════════════════════════════════════════════════════════
   FILM-LOCATIONS-TAX.JS — Global Filming, Tax Rebates, Animals & PLF Screens
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Box Office Sim 2 (Locations, Animals, Clothes, Theaters, Awards)
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

  // 1. Global Filming Destinations with Government Tax Rebates
  const DESTINATIONS = {
    atlanta: {
      id: "atlanta",
      name: "Atlanta, Georgia",
      region: "North America",
      taxRebatePct: 0.30, // 30% production budget tax credit
      travelCost: 1.0, // $1.0M
      bestGenres: ["action", "comedy", "superhero"],
      desc: "World-class soundstages with the industry's highest production tax credit incentives."
    },
    vancouver: {
      id: "vancouver",
      name: "Vancouver, Canada",
      region: "North America",
      taxRebatePct: 0.28,
      travelCost: 1.2,
      bestGenres: ["scifi", "horror", "drama"],
      desc: "Hollywood North offering versatile metropolitan and forested locations with aggressive film subsidies."
    },
    pinewood_uk: {
      id: "pinewood_uk",
      name: "Pinewood Studios, United Kingdom",
      region: "Europe",
      taxRebatePct: 0.25,
      travelCost: 2.0,
      bestGenres: ["fantasy", "action", "period"],
      desc: "Legendary European soundstages with an established 25% British Film Institute tax credit."
    },
    iceland: {
      id: "iceland",
      name: "Icelandic Glaciers & Volcanic Tundra",
      region: "Europe",
      taxRebatePct: 0.35,
      travelCost: 2.5,
      bestGenres: ["scifi", "adventure", "fantasy"],
      desc: "Alien, breathtaking glacial landscapes offering massive scenic authenticity and a 35% state rebate."
    },
    new_zealand: {
      id: "new_zealand",
      name: "New Zealand Soundstages & Fjords",
      region: "Oceania",
      taxRebatePct: 0.20,
      travelCost: 3.0,
      bestGenres: ["fantasy", "adventure"],
      desc: "Epic natural vistas suited for grand multi-part fantasy franchises with seasoned local crews."
    },
    morocco: {
      id: "morocco",
      name: "Ouarzazate, Morocco",
      region: "Africa/Middle East",
      taxRebatePct: 0.20,
      travelCost: 1.8,
      bestGenres: ["action", "historical", "adventure"],
      desc: "Iconic desert dunes and ancient fortress sets favored by major historical blockbusters."
    },
    tokyo: {
      id: "tokyo",
      name: "Tokyo Metropolis, Japan",
      region: "Asia",
      taxRebatePct: 0.15,
      travelCost: 2.5,
      bestGenres: ["action", "scifi", "cyberpunk"],
      desc: "Dense neon streets and cutting-edge urban aesthetics boosting Asian box office pull by +25%."
    },
    hollywood_lot: {
      id: "hollywood_lot",
      name: "Standard Hollywood Studio Lot",
      region: "North America",
      taxRebatePct: 0.05,
      travelCost: 0.0,
      bestGenres: ["all"],
      desc: "Standard in-house shooting on native studio backlots with zero travel overhead."
    }
  };

  // 2. Animal & Creature Performers Division
  const ANIMAL_TALENT = [
    {
      id: "buster_dog",
      name: "Buster the Golden Retriever",
      species: "Canine",
      handlerFee: 0.4, // $0.4M
      bonusFamilyPull: 0.20, // +20% family demographic pull
      bonusQuality: 4,
      desc: "Award-winning studio canine beloved by family and holiday audiences."
    },
    {
      id: "thunder_horse",
      name: "Thunder the Friesian Stallion",
      species: "Equine",
      handlerFee: 0.6,
      bonusFamilyPull: 0.10,
      bonusQuality: 6,
      desc: "Majestic warhorse trained for high-intensity action choreography and historical battles."
    },
    {
      id: "cleo_cat",
      name: "Cleopatra the Black Cat",
      species: "Feline",
      handlerFee: 0.2,
      bonusFamilyPull: 0.05,
      bonusQuality: 3,
      desc: "Expressive feline specialist delivering chilling atmospheric tension for horror and mystery."
    },
    {
      id: "barnaby_chimp",
      name: "Barnaby the Certified Primate",
      species: "Primate",
      handlerFee: 0.9,
      bonusFamilyPull: 0.25,
      bonusQuality: 7,
      desc: "Screen-tested primate performer generating massive viral buzz and comedy acclaim."
    }
  ];

  // 3. Costume & Haute-Couture Wardrobe Department
  const WARDROBE_COLLECTIONS = [
    {
      id: "period_gowns",
      name: "Victorian & Royal Gala Wardrobe",
      cost: 2.5,
      qualityBoost: 7,
      costumeAwardOdds: 0.40,
      apparelMerchBoost: 0.15,
      desc: "Hand-stitched silk corsetry and period velvet gowns designed for prestige historical epics."
    },
    {
      id: "tactical_armor",
      name: "Tactical Exosuit & Armored Battle Gear",
      cost: 4.0,
      qualityBoost: 8,
      costumeAwardOdds: 0.25,
      apparelMerchBoost: 0.30,
      desc: "Modular titanium-reinforced superhero and combat exosuits driving high toy/merchandise sales."
    },
    {
      id: "designer_couture",
      name: "Parisian Haute Couture & Runway Wardrobe",
      cost: 3.0,
      qualityBoost: 6,
      costumeAwardOdds: 0.35,
      apparelMerchBoost: 0.25,
      desc: "Modern luxury runway fashion providing prestige polish and celebrity buzz."
    }
  ];

  // 4. Premium Large Format (PLF) & Theater Circuit Bidding
  const THEATER_CIRCUITS = [
    {
      id: "amc_imax",
      name: "AMC IMAX 70mm & Dolby Cinema Circuit",
      screens: 2200,
      plfMultiplier: 1.35, // +35% opening weekend box office boost
      upfrontBiddingCost: 5.0, // $5M bidding advance
      desc: "Global flagship IMAX 70mm screens guaranteeing maximum premium ticket surcharges."
    },
    {
      id: "regal_4dx",
      name: "Regal RPX & 4DX Motion Theater Network",
      screens: 1800,
      plfMultiplier: 1.25,
      upfrontBiddingCost: 3.5,
      desc: "Immersive sensory motion seats and premium large screens across North American multiplexes."
    },
    {
      id: "cineworld_eur",
      name: "Cineworld & Odeon European Circuit",
      screens: 1500,
      plfMultiplier: 1.20,
      upfrontBiddingCost: 2.5,
      desc: "Premier theatrical chain across the UK, France, and Western European capitals."
    }
  ];

  // 5. Multi-Ceremony Award Bodies
  const AWARD_CIRCUITS = [
    { id: "critics_guild", name: "National Critics Circle Awards", week: 6, focus: "Artistic Craft & Screenwriting" },
    { id: "popcorn_awards", name: "Global Popcorn Blockbuster Awards", week: 24, focus: "VFX, Fan Favorites & Box Office Hits" },
    { id: "foreign_press", name: "International Globe Foreign Press", week: 46, focus: "Drama, Comedy & World Cinema" },
    { id: "academy_oscars", name: "The Academy Golden Reels", week: 52, focus: "Best Picture & Cinematic Excellence" }
  ];

  function initFilmLocationsTax(state){
    const S = _getG(state);
    if(!S) return;
    if(!S.filmLocations){
      S.filmLocations = {
        rebatesCollected: 0,
        activeDestinations: {},
        animalContracts: [],
        wardrobeEquipped: {},
        theaterAgreements: [],
        awardHistory: []
      };
    }
    return S.filmLocations;
  }

  // Contract a filming destination for an in-production project
  function assignFilmingDestination(projectId, destinationId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initFilmLocationsTax(S);

    const dest = DESTINATIONS[destinationId];
    if(!dest) return { ok: false, msg: "Destination not found" };

    const proj = (S.projects || []).find(p => p.id === projectId || p.title === projectId);
    if(!proj) return { ok: false, msg: "Project not found" };

    if(dest.travelCost > 0){
      if((S.studio ? S.studio.cash : S.cash) < dest.travelCost){
        return { ok: false, msg: "Insufficient cash for destination travel ($" + dest.travelCost + "M required)." };
      }
      _modCash(S, -dest.travelCost);
    }

    proj.filmingDestination = dest.id;
    proj.taxRebatePct = dest.taxRebatePct;

    if(typeof log === "function"){
      log("[LOCATION SCOUTING] \"" + proj.title + "\" contracted location shoot in " + dest.name + " (" + Math.round(dest.taxRebatePct*100) + "% Government Tax Rebate).", "gold");
    }

    return { ok: true, msg: "Filming location booked with " + Math.round(dest.taxRebatePct*100) + "% tax credit!" };
  }

  // Settle tax rebate upon project completion
  function settleTaxRebate(project, state){
    const S = _getG(state);
    if(!S || !project || !project.filmingDestination) return 0;
    initFilmLocationsTax(S);

    const dest = DESTINATIONS[project.filmingDestination];
    const pct = project.taxRebatePct || (dest ? dest.taxRebatePct : 0);
    if(!pct) return 0;

    const budget = project.budget || 20;
    const rebateAmount = Math.round(budget * pct * 10) / 10;

    if(rebateAmount > 0){
      _modCash(S, rebateAmount);
      S.filmLocations.rebatesCollected = Math.round(((S.filmLocations.rebatesCollected || 0) + rebateAmount) * 10) / 10;
      if(typeof log === "function"){
        log("[TAX REBATE CASHED] State audit approved: +$" + rebateAmount + "M production tax credit returned on \"" + project.title + "\".", "gold");
      }
    }
    return rebateAmount;
  }

  // Book an IMAX / PLF Circuit Carriage Agreement
  function signPLFCarriageAgreement(filmId, circuitId, state){
    const S = _getG(state);
    if(!S) return { ok: false, msg: "State missing" };
    initFilmLocationsTax(S);

    const circuit = THEATER_CIRCUITS.find(c => c.id === circuitId);
    if(!circuit) return { ok: false, msg: "Circuit not found" };

    const film = (S.films || []).find(f => f.id === filmId || f.title === filmId);
    if(!film) return { ok: false, msg: "Film not found" };

    if((S.studio ? S.studio.cash : S.cash) < circuit.upfrontBiddingCost){
      return { ok: false, msg: "Insufficient cash for circuit bidding ($" + circuit.upfrontBiddingCost + "M required)." };
    }

    _modCash(S, -circuit.upfrontBiddingCost);

    film.plfCircuit = circuit.id;
    film.plfMultiplier = circuit.plfMultiplier;

    S.filmLocations.theaterAgreements.push({
      filmId: film.id,
      filmTitle: film.title,
      circuitName: circuit.name,
      screens: circuit.screens,
      mult: circuit.plfMultiplier,
      week: S.week || 1
    });

    if(typeof log === "function"){
      log("[THEATER CIRCUIT] Secured exclusive PLF carriage on " + circuit.name + " (" + circuit.screens + " screens, Box Office ×" + circuit.plfMultiplier + ") for \"" + film.title + "\".", "gold");
    }

    return { ok: true, msg: "Carriage agreement confirmed!" };
  }

  // Open Global Locations & Tax Rebates Modal
  function openLocationsTaxModal(){
    const S = _getG();
    if(!S) return;
    initFilmLocationsTax(S);

    const inProd = (S.projects || []).filter(p => p.phase === "prod" || p.phase === "pre" || p.phase === "post");

    function renderInner(){
      let h = "<h3>Global Filming Destinations &amp; Tax Rebate Desk</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Shoot on-location across international film commission hubs to capture 15% to 35% government tax rebates, authentic scenic boosts, and regional market pull (Box Office Sim 2 parity).</p>";

      h += "<div class='stat-hero' style='margin-bottom:12px'>"+
        "<div class='stat'><div class='s-v' style='color:var(--gold)'>$" + (S.filmLocations.rebatesCollected || 0).toFixed(1) + "M</div><div class='s-l'>Total Tax Rebates Cashed</div></div>"+
        "<div class='stat'><div class='s-v'>" + inProd.length + "</div><div class='s-l'>Active In-Production Projects</div></div>"+
      "</div>";

      h += "<div class='section-title'>Filming Destinations &amp; State Rebate Programs</div><div class='grid g2' style='gap:8px'>";
      for(const k in DESTINATIONS){
        const d = DESTINATIONS[k];
        h += "<div class='card' style='display:flex;flex-direction:column;justify-content:space-between'>"+
          "<div>"+
            "<div class='spread'><b>" + d.name + "</b><span class='tag gold'>" + Math.round(d.taxRebatePct*100) + "% Tax Rebate</span></div>"+
            "<div class='tiny muted' style='margin:4px 0'>" + d.desc + "</div>"+
            "<div class='tiny' style='color:var(--blue)'>Region: " + d.region + " | Travel Cost: $" + d.travelCost + "M</div>"+
          "</div>"+
          "<div style='margin-top:10px'>";
        if(inProd.length){
          h += "<button class='btn btn-xs btn-primary' style='width:100%' data-dest-id='" + d.id + "'>Assign to Active Project</button>";
        } else {
          h += "<button class='btn btn-xs' style='width:100%' disabled>No In-Production Films</button>";
        }
        h += "</div></div>";
      }
      h += "</div>";

      h += "<div class='section-title' style='margin-top:14px'>Animal &amp; Creature Actors Division</div><div class='grid g2' style='gap:8px'>";
      ANIMAL_TALENT.forEach(a => {
        h += "<div class='card'>"+
          "<div class='spread'><b>" + a.name + "</b><span class='tag purple'>" + a.species + "</span></div>"+
          "<div class='tiny muted' style='margin:4px 0'>" + a.desc + "</div>"+
          "<div class='tiny gold'>Handler Fee: $" + a.handlerFee + "M | Family Pull: +" + Math.round(a.bonusFamilyPull*100) + "% | Quality: +" + a.bonusQuality + "</div>"+
        "</div>";
      });
      h += "</div>";

      h += "<div class='section-title' style='margin-top:14px'>Premium Large Format (PLF) &amp; IMAX Theater Circuits</div><div class='grid g1' style='gap:6px'>";
      THEATER_CIRCUITS.forEach(c => {
        h += "<div class='card spread'>"+
          "<div><b>" + c.name + "</b><div class='tiny muted'>" + c.screens + " Screens · " + c.desc + "</div></div>"+
          "<span class='tag gold'>Box Office ×" + c.plfMultiplier + "</span>"+
        "</div>";
      });
      h += "</div>";

      return h;
    }

    function wireEvents(container){
      container.querySelectorAll("[data-dest-id]").forEach(btn => {
        btn.onclick = () => {
          const destId = btn.dataset.destId;
          if(inProd.length > 0){
            const targetProj = inProd[0];
            const res = assignFilmingDestination(targetProj.id, destId, S);
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

    const initialHtml = "<div id='locationsModalInner'>" + renderInner() + "</div>";
    if(typeof openModal === "function"){
      const v = openModal(initialHtml);
      if(v){
        const inner = v.querySelector("#locationsModalInner") || v;
        wireEvents(inner);
      }
    }
  }

  const FilmLocationsTaxAPI = {
    DESTINATIONS,
    LOCATIONS: Object.values(DESTINATIONS),
    ANIMAL_TALENT,
    ANIMALS: Object.values(ANIMAL_TALENT),
    WARDROBE_COLLECTIONS,
    WARDROBES: Object.values(WARDROBE_COLLECTIONS),
    THEATER_CIRCUITS,
    CHAINS: Object.values(THEATER_CIRCUITS),
    AWARD_CIRCUITS,
    AWARD_SHOWS: Object.values(AWARD_CIRCUITS),
    initFilmLocationsTax,
    assignFilmingDestination,
    settleTaxRebate,
    signPLFCarriageAgreement,
    openLocationsTaxModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = FilmLocationsTaxAPI;
  }
  global.FilmLocationsTax = FilmLocationsTaxAPI;
  global.openLocationsTaxModal = openLocationsTaxModal;
})(typeof window !== "undefined" ? window : global);
